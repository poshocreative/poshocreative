import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  BadgeCheck,
  Clock3,
  HandCoins,
  Send,
  XCircle,
} from 'lucide-react';

import Link from '../PortalLink';

import { formatMoney } from '../../lib/orders';
import {
  getPartPaymentState,
  PART_PAYMENT_UNAVAILABLE_MESSAGE,
  requestProjectPartPayment,
} from '../../lib/projectFinance';

function formatDate(value) {
  if (!value) {
    return 'Not specified';
  }

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
  }).format(new Date(value));
}
const statusCopy = {
  approved: 'Management approved an installment amount for this project.',
  cancelled: 'This request was cancelled.',
  declined: 'Management could not approve this request.',
  expired: 'This approval has expired. You may submit a new request.',
  fulfilled: 'The approved installment has been received.',
  pending: 'Your request is waiting for Management review.',
};

function statusTitle(status) {
  return status
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PartPaymentRequest({
  orderId,
  orderReference,
  outstandingKobo,
}) {
  const [requests, setRequests] = useState([]);
  const [available, setAvailable] = useState(true);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!orderId) {
      setRequests([]);
      setAvailable(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const state = await getPartPaymentState(orderId);
      setRequests(state.requests);
      setAvailable(state.available);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeRequest = useMemo(
    () =>
      requests.find((request) =>
        request.status === 'pending' ||
        (request.status === 'approved' &&
          (!request.approval_expires_at ||
            new Date(request.approval_expires_at) > new Date())),
      ) || null,
    [requests],
  );

  const storedLatestRequest = activeRequest || requests[0] || null;
  const latestRequest =
    storedLatestRequest?.status === 'approved' &&
    storedLatestRequest.approval_expires_at &&
    new Date(storedLatestRequest.approval_expires_at) <= new Date()
      ? {
          ...storedLatestRequest,
          status: 'expired',
        }
      : storedLatestRequest;

  const submit = async (event) => {
    event.preventDefault();
    const cleanReason = reason.trim();
    const requestedAmountKobo = Math.round(Number(amount) * 100);

    if (
      !Number.isFinite(requestedAmountKobo) ||
      requestedAmountKobo <= 0
    ) {
      setError(
        'Enter the amount you would like Management to approve.',
      );
      return;
    }

    if (requestedAmountKobo >= outstandingKobo) {
      setError(
        'The requested part payment must be lower than the outstanding project balance.',
      );
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      await requestProjectPartPayment({
        orderId,
        requestedAmountKobo,
        reason: cleanReason,
      });
      setAmount('');
      setReason('');
      setSuccess('Your request has been sent to Management for review.');
      await load();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="part-payment-request finance-request-card">
      <div className="finance-request-heading">
        <div>
          <span>PAYMENT FLEXIBILITY</span>
          <h3>Request a part-payment arrangement</h3>
          <p>
            Enter the installment you can pay for this project. Management will
            review that exact amount before payment is enabled.
          </p>
        </div>
        <HandCoins size={23} />
      </div>

      <div className="finance-balance-strip">
        <span>Current outstanding balance</span>
        <strong>{formatMoney(outstandingKobo)}</strong>
      </div>

      {loading ? (
        <p className="finance-muted-message">Checking your requests...</p>
      ) : !available ? (
        <div className="finance-capability-notice" role="status">
          <Clock3 size={20} />
          <div>
            <strong>Payment arrangements are being activated</strong>
            <p>{PART_PAYMENT_UNAVAILABLE_MESSAGE}</p>
          </div>
        </div>
      ) : latestRequest ? (
        <div
          className={`finance-request-state finance-request-state-${latestRequest.status}`}
        >
          <div className="finance-request-state-heading">
            {latestRequest.status === 'approved' ? (
              <BadgeCheck size={20} />
            ) : latestRequest.status === 'declined' ? (
              <XCircle size={20} />
            ) : (
              <Clock3 size={20} />
            )}
            <div>
              <strong>{statusTitle(latestRequest.status)}</strong>
              <p>{statusCopy[latestRequest.status]}</p>
            </div>
          </div>

          {latestRequest.status === 'approved' && (
            <div className="finance-approval-details">
              <div>
                <span>Approved installment</span>
                <strong>
                  {formatMoney(latestRequest.approved_amount_kobo)}
                </strong>
              </div>
              <div>
                <span>Pay before</span>
                <strong>{formatDate(latestRequest.approval_expires_at)}</strong>
              </div>
              <div>
                <span>Remaining balance due</span>
                <strong>{formatDate(latestRequest.balance_due_at)}</strong>
              </div>
            </div>
          )}

          {latestRequest.requested_amount_kobo > 0 &&
            latestRequest.status !== 'approved' && (
            <div className="finance-requested-amount-line">
              <span>Amount requested</span>
              <strong>
                {formatMoney(latestRequest.requested_amount_kobo)}
              </strong>
            </div>
          )}

          {(latestRequest.admin_note || latestRequest.decline_reason) && (
            <p className="finance-admin-note">
              <strong>Management note:</strong>{' '}
              {latestRequest.admin_note || latestRequest.decline_reason}
            </p>
          )}

          {latestRequest.status === 'approved' && orderReference && (
            <Link
              to={`/dashboard/orders/${orderReference}/pay`}
              className="button button-primary"
            >
              Pay approved installment
            </Link>
          )}
        </div>
      ) : null}

      {!loading && available && !activeRequest && outstandingKobo > 0 && (
        <form onSubmit={submit} className="finance-request-form">
          <label>
            <span>Amount you want to pay now (NGN)</span>
            <input
              type="number"
              min="1"
              max={Math.max(outstandingKobo / 100 - 0.01, 1)}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="e.g. 50000"
              required
            />
            <small>
              This must be lower than {formatMoney(outstandingKobo)}.
            </small>
          </label>
          <label>
            <span>Note to Management (optional)</span>
            <textarea
              value={reason}
              maxLength="3000"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Add any helpful context for your request."
            />
          </label>
          <button type="submit" disabled={submitting}>
            <Send size={17} />
            {submitting ? 'Sending request...' : 'Send request to Management'}
          </button>
        </form>
      )}

      {success && <div className="finance-success-message">{success}</div>}
      {error && <div className="finance-error-message">{error}</div>}
    </section>
  );
}
