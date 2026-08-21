import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Info,
  ReceiptText,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

import {
  Link,
  useParams,
} from 'react-router-dom';

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

function MethodIcon({
  method,
}) {
  if (
    method ===
    'opay'
  ) {
    return (
      <Smartphone
        size={23}
      />
    );
  }

  return (
    <Building2
      size={23}
    />
  );
}

export default function DashboardPay() {
  const {
    reference,
  } =
    useParams();

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

          const quote =
            await getPaymentFeeQuote(
              loadedOrder.id,
            );

          setCheckout(
            quote,
          );

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
        !selected.available
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
            `/dashboard/orders/${reference}`,
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

  const feeAmount =
    payment
      ?.processingFeeKobo ??
    selected
      ?.processingFeeKobo ??
    0;

  const estimatedTotal =
    payment
      ?.estimatedCustomerTotalKobo ??
    selected
      ?.customerTotalKobo ??
    baseAmount +
      feeAmount;

  const exactTransferAmount =
    payment
      ?.account
      ?.amountKobo;

  return (
    <div className="commerce-page page-reveal">
      <Link
        to={`/dashboard/orders/${reference}`}
        className="workspace-back-link"
      >
        <ArrowLeft
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

          <div className="payment-cost-breakdown">
            <div className="payment-cost-heading">
              <div>
                <ReceiptText
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
                Project amount
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
                {selected
                  ?.feeAvailable ===
                false
                  ? 'Unavailable'
                  : formatMoney(
                      feeAmount,
                    )}
              </strong>
            </div>

            <div className="payment-cost-total">
              <span>
                Estimated total
              </span>

              <strong>
                {formatMoney(
                  estimatedTotal,
                )}
              </strong>
            </div>

            <div className="payment-cost-note">
              <Info
                size={15}
              />

              <span>
                Processing fees are calculated securely using the current payment-provider rate. The final payable amount is confirmed when payment details are created.
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
                          {item.available
                            ? item.description
                            : item.message ||
                              'Temporarily unavailable'}
                        </span>

                        {item.available && (
                          <small>
                            Total:{' '}
                            {formatMoney(
                              item.customerTotalKobo,
                            )}
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
                    <ExternalLink
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
                <Check
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
                    <Copy
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
                  Exact transfer amount
                </span>

                <strong>
                  {formatMoney(
                    exactTransferAmount ??
                      estimatedTotal,
                  )}
                </strong>
              </div>

              <div className="payment-transfer-warning">
                Transfer the exact amount shown above. Do not round the figure or send a different amount.
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
          <ShieldCheck
            size={24}
          />

          <span>
            PAYMENT PROTECTION
          </span>

          <h3>
            Payments are confirmed before your project status changes.
          </h3>

          <p>
            A payment is recorded as successful only after the transaction details have been independently confirmed.
          </p>
        </aside>
      </div>
    </div>
  );
}