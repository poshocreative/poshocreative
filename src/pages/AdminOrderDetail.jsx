import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  MessageSquareText,
  Save,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  getAdminOrder,
  runAdminOrderAction,
} from '../lib/admin';

import {
  formatMoney,
  formatOrderStatus,
} from '../lib/orders';

const workflowStatuses = [
  'under_review',
  'awaiting_payment',
  'paid',
  'in_progress',
  'awaiting_client',
  'completed',
  'cancelled',
];

export default function AdminOrderDetail() {
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
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    success,
    setSuccess,
  ] =
    useState('');

  const [
    declineOpen,
    setDeclineOpen,
  ] =
    useState(false);

  const [
    declineReason,
    setDeclineReason,
  ] =
    useState('');

  const [
    quote,
    setQuote,
  ] =
    useState({
      amount: '',
      message: '',
    });

  const [
    statusForm,
    setStatusForm,
  ] =
    useState({
      status:
        'under_review',

      note: '',
    });

  const [
    customerUpdate,
    setCustomerUpdate,
  ] =
    useState('');

  const load =
    useCallback(
      async () => {
        try {
          const result =
            await getAdminOrder(
              reference,
            );

          setOrder(
            result,
          );

          if (result) {
            setStatusForm(
              (current) => ({
                ...current,

                status:
                  workflowStatuses.includes(
                    result.status,
                  )
                    ? result.status
                    : 'under_review',
              }),
            );
          }
        } catch (
          loadError
        ) {
          console.error(
            loadError,
          );

          setError(
            'This project could not be loaded.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        reference,
      ],
    );

  useEffect(() => {
    document.title =
      `${reference} | Posho Creative Management`;

    load();
  }, [
    reference,
    load,
  ]);

  const execute =
    async (
      payload,
      successMessage,
    ) => {
      if (!order) {
        return false;
      }

      try {
        setBusy(
          true,
        );

        setError('');
        setSuccess('');

        await runAdminOrderAction({
          orderId:
            order.id,

          ...payload,
        });

        await load();

        setSuccess(
          successMessage,
        );

        return true;
      } catch (
        actionError
      ) {
        console.error(
          actionError,
        );

        setError(
          actionError.message,
        );

        return false;
      } finally {
        setBusy(
          false,
        );
      }
    };

  const approve =
    async () => {
      await execute(
        {
          action:
            'approve_order',
        },

        'Project request approved successfully.',
      );
    };

  const decline =
    async (
      event,
    ) => {
      event.preventDefault();

      if (
        declineReason
          .trim()
          .length <
        10
      ) {
        setError(
          'Provide a clear reason before declining this request.',
        );

        return;
      }

      const completed =
        await execute(
          {
            action:
              'decline_order',

            reason:
              declineReason,
          },

          'Project request declined and the customer has been informed.',
        );

      if (completed) {
        setDeclineOpen(
          false,
        );

        setDeclineReason(
          '',
        );
      }
    };

  const sendQuote =
    async (
      event,
    ) => {
      event.preventDefault();

      const naira =
        Number(
          quote.amount,
        );

      if (
        !Number.isFinite(
          naira,
        ) ||
        naira <= 0
      ) {
        setError(
          'Enter a valid quote amount.',
        );

        return;
      }

      const completed =
        await execute(
          {
            action:
              'send_quote',

            amountKobo:
              Math.round(
                naira *
                  100,
              ),

            message:
              quote.message,
          },

          'Quote issued successfully.',
        );

      if (completed) {
        setQuote({
          amount: '',
          message: '',
        });
      }
    };

  const updateStatus =
    async (
      event,
    ) => {
      event.preventDefault();

      const completed =
        await execute(
          {
            action:
              'update_status',

            status:
              statusForm.status,

            note:
              statusForm.note,
          },

          'Project status updated.',
        );

      if (completed) {
        setStatusForm(
          (current) => ({
            ...current,
            note: '',
          }),
        );
      }
    };

  const publishUpdate =
    async (
      event,
    ) => {
      event.preventDefault();

      if (
        !customerUpdate
          .trim()
      ) {
        setError(
          'Write an update before publishing.',
        );

        return;
      }

      const completed =
        await execute(
          {
            action:
              'add_note',

            note:
              customerUpdate,

            isInternal:
              false,
          },

          'Project update published.',
        );

      if (completed) {
        setCustomerUpdate(
          '',
        );
      }
    };

  if (loading) {
    return (
      <BrandLoader
        label="Opening project request..."
      />
    );
  }

  if (!order) {
    return (
      <div className="admin-clean-state">
        Project request not found.
      </div>
    );
  }

  const pending =
    order
      .review_decision ===
    'pending';

  const approved =
    order
      .review_decision ===
    'approved';

  const declined =
    order
      .review_decision ===
    'declined';

  const quoted =
    Number(
      order
        .quoted_amount_kobo ||
        0,
    );

  const paid =
    Number(
      order
        .paid_amount_kobo ||
        0,
    );

  const balance =
    Math.max(
      quoted -
        paid,
      0,
    );

  return (
    <div className="admin-view page-reveal">
      <Link
        to="/admin/orders"
        className="workspace-back-link"
      >
        <ArrowLeft
          size={17}
        />

        Project requests
      </Link>

      <div className="admin-project-hero admin-project-hero-v2">
        <div>
          <span>
            {order.reference}
          </span>

          <h1>
            {order.project_title}
          </h1>

          <p>
            {order
              .customers
              ?.full_name ||
              'Customer'}

            {' · '}

            {order
              .customers
              ?.email}
          </p>
        </div>

        <span
          className={`admin-decision-pill ${order.review_decision}`}
        >
          {pending
            ? 'Awaiting Review'
            : declined
              ? 'Declined'
              : formatOrderStatus(
                  order.status,
                )}
        </span>
      </div>

      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}

      {success && (
        <div className="workspace-success-message">
          {success}
        </div>
      )}

      {pending && (
        <section className="admin-review-decision-card">
          <div>
            <span>
              MANAGEMENT DECISION REQUIRED
            </span>

            <h2>
              Review this request before it proceeds.
            </h2>

            <p>
              Approval moves the project into the commercial workflow. Declining requires a clear customer-facing reason.
            </p>
          </div>

          <div className="admin-review-buttons">
            <button
              type="button"
              className="admin-approve-button"
              onClick={
                approve
              }
              disabled={
                busy
              }
            >
              <CheckCircle2
                size={18}
              />

              Approve request
            </button>

            <button
              type="button"
              className="admin-decline-button"
              onClick={() =>
                setDeclineOpen(
                  true,
                )
              }
              disabled={
                busy
              }
            >
              <XCircle
                size={18}
              />

              Decline request
            </button>
          </div>
        </section>
      )}

      {declineOpen && (
        <section className="admin-decline-panel">
          <div className="admin-decline-panel-heading">
            <div>
              <span>
                DECLINE REQUEST
              </span>

              <h3>
                Give the customer a clear reason.
              </h3>
            </div>

            <button
              type="button"
              onClick={() =>
                setDeclineOpen(
                  false,
                )
              }
              aria-label="Close decline form"
            >
              <X
                size={18}
              />
            </button>
          </div>

          <form
            onSubmit={
              decline
            }
          >
            <textarea
              value={
                declineReason
              }
              onChange={(
                event,
              ) =>
                setDeclineReason(
                  event
                    .target
                    .value,
                )
              }
              placeholder="Example: We are unable to accept this project at the requested timeline because the scope requires a longer production period."
            />

            <div>
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setDeclineOpen(
                    false,
                  )
                }
              >
                Keep request
              </button>

              <button
                type="submit"
                className="admin-decline-confirm"
                disabled={
                  busy
                }
              >
                Confirm decline
              </button>
            </div>
          </form>
        </section>
      )}

      {approved && (
        <section className="admin-approved-banner">
          <ShieldCheck
            size={21}
          />

          <div>
            <strong>
              Approved project
            </strong>

            <span>
              This project may now proceed through quoting, payment and production.
            </span>
          </div>
        </section>
      )}

      {declined && (
        <section className="admin-declined-banner">
          <XCircle
            size={21}
          />

          <div>
            <strong>
              Request declined
            </strong>

            <span>
              {order.decline_reason}
            </span>
          </div>
        </section>
      )}

      <div className="admin-project-grid">
        <div className="admin-project-main">
          <section className="admin-control-card">
            <span>
              PROJECT BRIEF
            </span>

            <h2>
              Customer requirements
            </h2>

            <div className="admin-brief-grid">
              <div>
                <span>
                  Service
                </span>

                <strong>
                  {order.service_slug
                    ?.replaceAll(
                      '-',
                      ' ',
                    )}
                </strong>
              </div>

              <div>
                <span>
                  Project type
                </span>

                <strong>
                  {order.project_type
                    ?.replaceAll(
                      '-',
                      ' ',
                    )}
                </strong>
              </div>

              <div>
                <span>
                  Budget
                </span>

                <strong>
                  {order.budget
                    ?.replaceAll(
                      '-',
                      ' ',
                    )}
                </strong>
              </div>

              <div>
                <span>
                  Timeline
                </span>

                <strong>
                  {order.timeline
                    ?.replaceAll(
                      '-',
                      ' ',
                    )}
                </strong>
              </div>
            </div>

            <div className="admin-brief-block">
              <strong>
                Description
              </strong>

              <p>
                {order.project_description}
              </p>
            </div>

            <div className="admin-brief-block">
              <strong>
                Goal
              </strong>

              <p>
                {order.project_goal}
              </p>
            </div>

            {order.reference_links && (
              <div className="admin-brief-block">
                <strong>
                  References
                </strong>

                <p>
                  {order.reference_links}
                </p>
              </div>
            )}
          </section>

          {approved && (
            <>
              <section className="admin-control-card">
                <BadgeDollarSign
                  size={22}
                />

                <span>
                  COMMERCIAL
                </span>

                <h2>
                  Quote management
                </h2>

                <p className="admin-card-description">
                  Current project value:{' '}

                  <strong>
                    {formatMoney(
                      order
                        .quoted_amount_kobo,
                    )}
                  </strong>
                </p>

                <form
                  onSubmit={
                    sendQuote
                  }
                  className="admin-form-stack"
                >
                  <label>
                    <span>
                      Final amount in Naira
                    </span>

                    <input
                      type="number"
                      min="1"
                      value={
                        quote.amount
                      }
                      onChange={(
                        event,
                      ) =>
                        setQuote(
                          (current) => ({
                            ...current,

                            amount:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      placeholder="180000"
                    />
                  </label>

                  <label>
                    <span>
                      Quote note
                    </span>

                    <textarea
                      value={
                        quote.message
                      }
                      onChange={(
                        event,
                      ) =>
                        setQuote(
                          (current) => ({
                            ...current,

                            message:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      placeholder="Briefly explain what the quoted amount covers."
                    />
                  </label>

                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={
                      busy
                    }
                  >
                    Issue quote
                  </button>
                </form>
              </section>

              <section className="admin-control-card">
                <MessageSquareText
                  size={22}
                />

                <span>
                  CLIENT COMMUNICATION
                </span>

                <h2>
                  Publish an update
                </h2>

                <form
                  onSubmit={
                    publishUpdate
                  }
                  className="admin-form-stack"
                >
                  <textarea
                    value={
                      customerUpdate
                    }
                    onChange={(
                      event,
                    ) =>
                      setCustomerUpdate(
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Write a concise project update for the client."
                  />

                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={
                      busy
                    }
                  >
                    Publish update
                  </button>
                </form>
              </section>
            </>
          )}
        </div>

        <aside className="admin-project-sidebar">
          {approved && (
            <section className="admin-control-card">
              <Save
                size={22}
              />

              <span>
                WORKFLOW
              </span>

              <h2>
                Project status
              </h2>

              <form
                onSubmit={
                  updateStatus
                }
                className="admin-form-stack"
              >
                <select
                  value={
                    statusForm.status
                  }
                  onChange={(
                    event,
                  ) =>
                    setStatusForm(
                      (current) => ({
                        ...current,

                        status:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  {workflowStatuses.map(
                    (
                      status,
                    ) => (
                      <option
                        key={
                          status
                        }
                        value={
                          status
                        }
                      >
                        {formatOrderStatus(
                          status,
                        )}
                      </option>
                    ),
                  )}
                </select>

                <textarea
                  value={
                    statusForm.note
                  }
                  onChange={(
                    event,
                  ) =>
                    setStatusForm(
                      (current) => ({
                        ...current,

                        note:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Optional note for the client."
                />

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={
                    busy
                  }
                >
                  Save status
                </button>
              </form>
            </section>
          )}

          <section className="admin-control-card">
            <span>
              CUSTOMER
            </span>

            <h2>
              Contact details
            </h2>

            <div className="admin-contact-list">
              <div>
                <span>
                  Name
                </span>

                <strong>
                  {order
                    .customers
                    ?.full_name ||
                    'Not provided'}
                </strong>
              </div>

              <div>
                <span>
                  Email
                </span>

                <strong>
                  {order
                    .customers
                    ?.email ||
                    'Not provided'}
                </strong>
              </div>

              <div>
                <span>
                  Phone
                </span>

                <strong>
                  {order
                    .customers
                    ?.phone ||
                    'Not provided'}
                </strong>
              </div>

              <div>
                <span>
                  Business
                </span>

                <strong>
                  {order
                    .customers
                    ?.business_name ||
                    'Not provided'}
                </strong>
              </div>
            </div>
          </section>

          {approved && (
            <section className="admin-control-card">
              <span>
                FINANCIALS
              </span>

              <h2>
                Payment position
              </h2>

              <div className="admin-money-row">
                <span>
                  Quoted
                </span>

                <strong>
                  {formatMoney(
                    quoted,
                  )}
                </strong>
              </div>

              <div className="admin-money-row">
                <span>
                  Paid
                </span>

                <strong>
                  {formatMoney(
                    paid,
                  )}
                </strong>
              </div>

              <div className="admin-money-row">
                <span>
                  Balance
                </span>

                <strong>
                  {formatMoney(
                    balance,
                  )}
                </strong>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}