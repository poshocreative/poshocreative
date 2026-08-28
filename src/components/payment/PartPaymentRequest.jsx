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
  getPartPaymentRequests,
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
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!orderId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      setRequests(await getPartPaymentRequests(orderId));
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

    if (cleanReason.length < 10) {
      setError(
        'Please give Management a short explanation of at least 10 characters.',
      );
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      await requestProjectPartPayment({ orderId, reason: cleanReason });
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
            Ask Management to approve a smaller first installment. Management
            sets the approved amount and payment dates.
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

      {!loading && !activeRequest && outstandingKobo > 0 && (
        <form onSubmit={submit} className="finance-request-form">
          <label>
            <span>Why do you need a part-payment arrangement?</span>
            <textarea
              value={reason}
              maxLength="3000"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Briefly explain the arrangement you need so Management can review it fairly."
              required
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
