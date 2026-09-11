import {
  useEffect,
  useMemo,
  useState,
} from 'react';



import Icon from '../components/ui/Icon';
import {
  useParams,
} from 'react-router-dom';

import Link from '../components/PortalLink';

import {
  useAuth,
} from '../context/AuthContext';

import BrandLoader from '../components/BrandLoader';

import {
  formatMoney,
  getOrderByReference,
} from '../lib/orders';

import {
  createPaymentSession,
  getPaymentFeeQuote,
  verifyPayment,
} from '../lib/payments';

import {
  getPartPaymentState,
} from '../lib/projectFinance';

import {
  resolvePortalPath,
} from '../lib/portalSession';

function MethodIcon({
  method,
}) {
  if (
    method ===
    'opay'
  ) {
    return (
      <Icon name="smartphone" 
        size={23}
      />
    );
  }

  return (
    <Icon name="apartment" 
      size={23}
    />
  );
}

export default function DashboardPay() {
  const {
    reference,
  } =
    useParams();

  const {
    portalRoutes,
  } = useAuth();

  const [
    order,
    setOrder,
  ] =
    useState(null);

  const [
    checkout,
    setCheckout,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    method,
    setMethod,
  ] =
    useState('');

  const [
    payment,
    setPayment,
  ] =
    useState(null);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    checking,
    setChecking,
  ] =
    useState(false);

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    checkoutBlocked,
    setCheckoutBlocked,
  ] =
    useState(false);

  useEffect(() => {
    document.title =
      'Pay for Project | Posho Creative';

    const load =
      async () => {
        try {
          setLoading(
            true,
          );

          setError('');

          const loadedOrder =
            await getOrderByReference(
              reference,
            );

          setOrder(
            loadedOrder,
          );

          if (
            !loadedOrder
          ) {
            return;
          }

          const [
            quote,
            partPaymentState,
          ] =
            await Promise.all([
              getPaymentFeeQuote(
                loadedOrder.id,
              ),

              getPartPaymentState(
                loadedOrder.id,
              ),
            ]);

          setCheckout(
            quote,
          );

          const now =
            new Date();

          const activeApproval =
            partPaymentState.requests.find(
              (
                request,
              ) =>
                request.status ===
                  'approved' &&
                (
                  !request
                    .approval_expires_at ||
                  new Date(
                    request
                      .approval_expires_at,
                  ) > now
                ),
            );

          const installmentMismatch =
            Boolean(
              activeApproval,
            ) &&
            quote.paymentScope !==
              'approved_installment';

          const pendingRequest =
            partPaymentState.requests.find(
              (request) => request.status === 'pending',
            );

          setCheckoutBlocked(
            Boolean(pendingRequest) || installmentMismatch,
          );

          if (pendingRequest) {
            setError(
              'Your part-payment request is awaiting Management review. Payment will be enabled here as soon as it is approved.',
            );
          } else if (installmentMismatch) {
            setError(
              'Your installment is approved, but the installment checkout is still being updated. Payment has been paused so you are not charged the full balance. Please try again shortly.',
            );
          }

          const firstAvailable =
            (
              quote.methods ||
              []
            ).find(
              (
                item,
              ) =>
                item.available,
            );

          setMethod(
            firstAvailable
              ?.key ||
              '',
          );
        } catch (
          loadError
        ) {
          console.error(
            loadError,
          );

          setError(
            loadError.message ||
              'Payment details could not be prepared.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      };

    load();
  }, [
    reference,
  ]);

  const selected =
    useMemo(
      () =>
        checkout
          ?.methods
          ?.find(
            (
              item,
            ) =>
              item.key ===
              method,
          ) ||
        null,
      [
        checkout,
        method,
      ],
    );

  const startPayment =
    async () => {
      if (
        !order ||
        !selected ||
        !selected
          .available
      ) {
        return;
      }

      try {
        setSubmitting(
          true,
        );

        setError('');

        const result =
          await createPaymentSession({
            orderId:
              order.id,

            method:
              selected.key,
          });

        if (
          result.method ===
            'opay' &&
          result.redirectUrl
        ) {
          window.location.assign(
            result.redirectUrl,
          );

          return;
        }

        setPayment(
          result,
        );
      } catch (
        paymentError
      ) {
        setError(
          paymentError.message,
        );
      } finally {
        setSubmitting(
          false,
        );
      }
    };

  const checkPayment =
    async () => {
      if (
        !payment?.id
      ) {
        return;
      }

      try {
        setChecking(
          true,
        );

        setError('');

        const result =
          await verifyPayment(
            payment.id,
          );

        if (
          result?.success
        ) {
          window.location.assign(
            resolvePortalPath(
              `/dashboard/orders/${reference}`,
              portalRoutes,
            ),
          );

          return;
        }

        setError(
          result?.message ||
            'Payment has not been confirmed yet. Please try again shortly.',
        );
      } catch (
        verifyError
      ) {
        setError(
          verifyError.message,
        );
      } finally {
        setChecking(
          false,
        );
      }
    };

  const copyAccount =
    async () => {
      const number =
        payment
          ?.account
          ?.accountNumber;

      if (!number) {
        return;
      }

      await navigator
        .clipboard
        .writeText(
          number,
        );

      setCopied(
        true,
      );

      window.setTimeout(
        () =>
          setCopied(
            false,
          ),
        1800,
      );
    };

  if (loading) {
    return (
      <BrandLoader
        label="Preparing payment..."
      />
    );
  }

  if (!order) {
    return (
      <div className="commerce-empty">
        Project not found.
      </div>
    );
  }

  const baseAmount =
    payment
      ?.baseAmountKobo ??
    selected
      ?.baseAmountKobo ??
    checkout
      ?.baseAmountKobo ??
    0;

  const feeKnown =
    payment
      ?.processingFeeKobo !==
      undefined &&
    payment
      ?.processingFeeKobo !==
      null
      ? true
      : selected
          ?.feeAvailable ===
        true;

  const feeAmount =
    payment
      ?.processingFeeKobo ??
    selected
      ?.processingFeeKobo ??
    null;

  const customerTotal =
    payment
      ?.estimatedCustomerTotalKobo ??
    selected
      ?.customerTotalKobo ??
    null;

  const exactTransferAmount =
    payment
      ?.account
      ?.amountKobo ??
    customerTotal;

  return (
    <div className="commerce-page page-reveal">
      <Link
        to={`/dashboard/orders/${reference}`}
        className="workspace-back-link"
      >
        <Icon name="arrow_back" 
          size={17}
        />

        Back to project
      </Link>

      <div className="payment-layout">
        <section className="payment-main-card">
          <span className="workspace-kicker">
            SECURE PAYMENT
          </span>

          <h2>
            Complete your project payment.
          </h2>

          <p className="payment-project-reference">
            {order.reference}
            {' · '}
            {order.project_title}
          </p>

          {checkout?.paymentScope ===
            'approved_installment' && (
            <div className="workspace-success-message">
              Management approved this installment. This checkout charges only
              the approved amount, not the full outstanding balance.
            </div>
          )}

          {order?.quoted_amount_kobo > 0 && (
            <div className="posho-finance-grid" style={{ marginBottom: 14 }}>
              <div className="posho-finance-card">
                <span>Total project value</span>
                <strong>{formatMoney(order.quoted_amount_kobo)}</strong>
              </div>
              <div className="posho-finance-card posho-finance-paid">
                <span>Confirmed paid</span>
                <strong>{formatMoney(order.paid_amount_kobo)}</strong>
              </div>
              <div className="posho-finance-card posho-finance-outstanding">
                <span>Remaining balance</span>
                <strong>
                  {formatMoney(
                    Math.max(
                      Number(order.quoted_amount_kobo || 0) -
                        Number(order.paid_amount_kobo || 0),
                      0,
                    ),
                  )}
                </strong>
              </div>
              <div className="posho-finance-card posho-finance-due">
                <span>Amount due now</span>
                <strong>{formatMoney(baseAmount)}</strong>
                <small>
                  {checkout?.paymentScope === 'approved_installment'
                    ? 'Approved installment — not the total project value.'
                    : 'Full outstanding balance.'}
                </small>
              </div>
            </div>
          )}

          <div className="payment-cost-breakdown">
            <div className="payment-cost-heading">
              <div>
                <Icon name="receipt" 
                  size={19}
                />

                <strong>
                  Payment summary
                </strong>
              </div>

              <span>
                NGN
              </span>
            </div>

            <div className="payment-cost-row">
              <span>
                {checkout?.paymentScope ===
                'approved_installment'
                  ? 'Approved installment'
                  : 'Project amount'}
              </span>

              <strong>
                {formatMoney(
                  baseAmount,
                )}
              </strong>
            </div>

            <div className="payment-cost-row">
              <span>
                Processing fee
              </span>

              <strong>
                {feeKnown &&
                feeAmount !==
                  null
                  ? formatMoney(
                      feeAmount,
                    )
                  : 'Confirmed before payment'}
              </strong>
            </div>

            <div className="payment-cost-total">
              <span>
                {payment
                  ? 'Total to pay'
                  : 'Estimated total'}
              </span>

              <strong>
                {customerTotal !==
                null
                  ? formatMoney(
                      customerTotal,
                    )
                  : 'Confirmed next'}
              </strong>
            </div>

            <div className="payment-cost-note">
              <Icon name="info" 
                size={15}
              />

              <span>
                Processing fees are obtained from the active payment provider. If a fee cannot be quoted in advance, the exact amount is confirmed before you transfer any money.
              </span>
            </div>
          </div>

          {!payment && (
            <>
              <div className="payment-method-title">
                Choose payment method
              </div>

              <div className="payment-method-grid">
                {checkout
                  ?.methods
                  ?.map(
                    (
                      item,
                    ) => (
                      <button
                        type="button"
                        key={
                          item.key
                        }
                        className={[
                          'payment-method',

                          method ===
                          item.key
                            ? 'selected'
                            : '',

                          !item.available
                            ? 'payment-method-disabled'
                            : '',
                        ]
                          .filter(
                            Boolean,
                          )
                          .join(
                            ' ',
                          )}
                        onClick={() =>
                          item.available &&
                          setMethod(
                            item.key,
                          )
                        }
                        disabled={
                          !item.available
                        }
                      >
                        <MethodIcon
                          method={
                            item.key
                          }
                        />

                        <strong>
                          {item.name}
                        </strong>

                        <span>
                          {item.description}
                        </span>

                        {item.feeAvailable ? (
                          <small>
                            Estimated total:{' '}
                            {formatMoney(
                              item.customerTotalKobo,
                            )}
                          </small>
                        ) : (
                          <small>
                            Exact fee confirmed before payment
                          </small>
                        )}
                      </button>
                    ),
                  )}
              </div>

              {checkout
                ?.methods
                ?.length ===
                0 && (
                <div className="workspace-alert">
                  No payment method is currently available. Please contact Posho Creative.
                </div>
              )}

              <button
                type="button"
                className="button button-primary payment-continue-button"
                onClick={
                  startPayment
                }
                disabled={
                  submitting ||
                  checkoutBlocked ||
                  !selected ||
                  !selected
                    .available
                }
              >
                {submitting
                  ? 'Preparing payment...'
                  : selected
                    ? `Continue with ${selected.name}`
                    : 'Choose payment method'}

                {!submitting &&
                  selected && (
                    <Icon name="open_in_new" 
                      size={17}
                    />
                  )}
              </button>
            </>
          )}

          {payment
            ?.method ===
            'bank_transfer' && (
            <div className="bank-transfer-panel">
              <div className="bank-transfer-heading">
                <Icon name="check" 
                  size={18}
                />

                Bank transfer ready
              </div>

              <div className="bank-account-detail">
                <span>
                  Bank
                </span>

                <strong>
                  {
                    payment
                      .account
                      .bankName
                  }
                </strong>
              </div>

              <div className="bank-account-detail">
                <span>
                  Account number
                </span>

                <div>
                  <strong>
                    {
                      payment
                        .account
                        .accountNumber
                    }
                  </strong>

                  <button
                    type="button"
                    onClick={
                      copyAccount
                    }
                  >
                    <Icon name="content_copy" 
                      size={15}
                    />

                    {copied
                      ? 'Copied'
                      : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="bank-account-detail">
                <span>
                  Project amount
                </span>

                <strong>
                  {formatMoney(
                    payment
                      .baseAmountKobo,
                  )}
                </strong>
              </div>

              <div className="bank-account-detail">
                <span>
                  Processing fee
                </span>

                <strong>
                  {formatMoney(
                    payment
                      .processingFeeKobo,
                  )}
                </strong>
              </div>

              <div className="bank-account-detail">
                <span>
                  Exact transfer amount
                </span>

                <strong>
                  {formatMoney(
                    exactTransferAmount,
                  )}
                </strong>
              </div>

              <div className="payment-transfer-warning">
                Transfer exactly the amount shown above. Do not round the figure or send a different amount.
              </div>

              <button
                type="button"
                className="button button-primary"
                onClick={
                  checkPayment
                }
                disabled={
                  checking
                }
              >
                {checking
                  ? 'Checking payment...'
                  : 'I have made the transfer'}
              </button>
            </div>
          )}

          {error && (
            <div className="workspace-alert">
              {error}
            </div>
          )}
        </section>

        <aside className="payment-security-card">
          <Icon name="verified_user" 
            size={24}
          />

          <span>
            PAYMENT PROTECTION
          </span>

          <h3>
            Your transaction is independently confirmed.
          </h3>

          <p>
            Your project status changes only after the payment provider confirms the transaction details and amount.
          </p>
        </aside>
      </div>
    </div>
  );
}
