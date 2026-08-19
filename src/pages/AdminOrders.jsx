import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ArrowLeft,
  BadgeDollarSign,
  MessageSquareText,
  Save,
} from 'lucide-react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  supabase,
} from '../lib/supabase';

import {
  formatMoney,
  formatOrderStatus,
} from '../lib/orders';

const statuses = [
  'new',
  'under_review',
  'quote_sent',
  'awaiting_payment',
  'paid',
  'in_progress',
  'awaiting_client',
  'completed',
  'cancelled',
];

async function loadAdminOrder(
  reference,
) {
  const {
    data: order,
    error,
  } =
    await supabase
      .from('orders')
      .select(`
        *,
        customers (
          id,
          full_name,
          email,
          phone,
          business_name
        )
      `)
      .eq(
        'reference',
        reference,
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!order) {
    return null;
  }

  const [
    quotesResult,
    notesResult,
    paymentsResult,
    historyResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'order_quotes',
        )
        .select('*')
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending: false,
          },
        ),

      supabase
        .from(
          'order_notes',
        )
        .select('*')
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending: false,
          },
        ),

      supabase
        .from(
          'payment_transactions',
        )
        .select('*')
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending: false,
          },
        ),

      supabase
        .from(
          'order_status_history',
        )
        .select('*')
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending: false,
          },
        ),
    ]);

  return {
    ...order,

    quotes:
      quotesResult.data ||
      [],

    notes:
      notesResult.data ||
      [],

    payments:
      paymentsResult.data ||
      [],

    history:
      historyResult.data ||
      [],
  };
}

async function runAdminAction(
  body,
) {
  const {
    data,
    error,
  } =
    await supabase.functions
      .invoke(
        'admin-order-action',
        {
          body,
        },
      );

  if (error) {
    let message =
      'Administrative action could not be completed.';

    try {
      const response =
        await error.context
          ?.json();

      if (
        response?.message
      ) {
        message =
          response.message;
      }
    } catch {
      // Keep fallback message.
    }

    throw new Error(
      message,
    );
  }

  if (
    !data?.success
  ) {
    throw new Error(
      data?.message ||
        'Administrative action could not be completed.',
    );
  }

  return data;
}

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
    quoteForm,
    setQuoteForm,
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
            await loadAdminOrder(
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
                  result.status,
              }),
            );
          }
        } catch (
          loadError
        ) {
          console.error(
            'Admin order loading failed:',
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
      `${reference} | Posho Creative Admin`;

    load();
  }, [
    reference,
    load,
  ]);

  const performAction =
    async (
      payload,
      successMessage,
    ) => {
      if (!order) {
        return;
      }

      try {
        setBusy(
          true,
        );

        setError('');
        setSuccess('');

        await runAdminAction({
          orderId:
            order.id,

          ...payload,
        });

        await load();

        setSuccess(
          successMessage,
        );
      } catch (
        actionError
      ) {
        console.error(
          'Admin order action failed:',
          actionError,
        );

        setError(
          actionError.message,
        );
      } finally {
        setBusy(
          false,
        );
      }
    };

  const sendQuote =
    async (
      event,
    ) => {
      event.preventDefault();

      const nairaAmount =
        Number(
          quoteForm.amount,
        );

      if (
        !Number.isFinite(
          nairaAmount,
        ) ||
        nairaAmount <= 0
      ) {
        setError(
          'Enter a valid quote amount.',
        );

        return;
      }

      await performAction(
        {
          action:
            'send_quote',

          amountKobo:
            Math.round(
              nairaAmount *
                100,
            ),

          message:
            quoteForm.message,
        },

        'The quote has been sent to the customer.',
      );

      setQuoteForm({
        amount: '',
        message: '',
      });
    };

  const updateStatus =
    async (
      event,
    ) => {
      event.preventDefault();

      await performAction(
        {
          action:
            'update_status',

          status:
            statusForm.status,

          note:
            statusForm.note,
        },

        'The project status has been updated.',
      );

      setStatusForm(
        (current) => ({
          ...current,

          note: '',
        }),
      );
    };

  const sendCustomerUpdate =
    async (
      event,
    ) => {
      event.preventDefault();

      if (
        !customerUpdate
          .trim()
      ) {
        setError(
          'Write an update before sending.',
        );

        return;
      }

      await performAction(
        {
          action:
            'add_note',

          note:
            customerUpdate,

          isInternal:
            false,
        },

        'The customer update has been published.',
      );

      setCustomerUpdate(
        '',
      );
    };

  if (loading) {
    return (
      <BrandLoader
        label="Opening project..."
      />
    );
  }

  if (!order) {
    return (
      <div className="admin-empty">
        Project not found.
      </div>
    );
  }

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

        Orders
      </Link>

      <div className="admin-project-hero">
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
          className={`workspace-status workspace-status-${order.status}`}
        >
          {formatOrderStatus(
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

      <div className="admin-project-grid">
        <div className="admin-project-main">
          <section className="admin-control-card">
            <span>
              PROJECT BRIEF
            </span>

            <h2>
              Customer requirements
            </h2>

            <div className="admin-brief-block">
              <strong>
                Service
              </strong>

              <p>
                {order.service_slug
                  ?.replaceAll(
                    '-',
                    ' ',
                  )}
              </p>
            </div>

            <div className="admin-brief-block">
              <strong>
                Project type
              </strong>

              <p>
                {order.project_type
                  ?.replaceAll(
                    '-',
                    ' ',
                  )}
              </p>
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
                  Reference links
                </strong>

                <p>
                  {order.reference_links}
                </p>
              </div>
            )}
          </section>

          <section className="admin-control-card">
            <BadgeDollarSign
              size={22}
            />

            <span>
              COMMERCIAL
            </span>

            <h2>
              Send project quote
            </h2>

            <p>
              Current quote:{' '}

              <strong>
                {formatMoney(
                  order
                    .quoted_amount_kobo,
                )}
              </strong>
            </p>

            <form
              className="admin-form-stack"
              onSubmit={
                sendQuote
              }
            >
              <label>
                <span>
                  Final quote in Naira
                </span>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={
                    quoteForm.amount
                  }
                  onChange={(
                    event,
                  ) =>
                    setQuoteForm(
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
                  Message to customer
                </span>

                <textarea
                  value={
                    quoteForm.message
                  }
                  onChange={(
                    event,
                  ) =>
                    setQuoteForm(
                      (current) => ({
                        ...current,

                        message:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Explain what is included in this quote."
                />
              </label>

              <button
                type="submit"
                className="button button-primary"
                disabled={
                  busy
                }
              >
                Send quote
              </button>
            </form>
          </section>

          <section className="admin-control-card">
            <MessageSquareText
              size={22}
            />

            <span>
              CUSTOMER UPDATE
            </span>

            <h2>
              Publish project update
            </h2>

            <form
              className="admin-form-stack"
              onSubmit={
                sendCustomerUpdate
              }
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
                placeholder="Write an update that will appear in the customer's workspace."
              />

              <button
                type="submit"
                className="button button-primary"
                disabled={
                  busy
                }
              >
                Send update
              </button>
            </form>
          </section>
        </div>

        <aside className="admin-project-sidebar">
          <section className="admin-control-card">
            <Save
              size={22}
            />

            <span>
              PROJECT STATUS
            </span>

            <h2>
              Control workflow
            </h2>

            <form
              className="admin-form-stack"
              onSubmit={
                updateStatus
              }
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
                {statuses.map(
                  (status) => (
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
                placeholder="Optional customer-facing message."
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

          <section className="admin-control-card">
            <span>
              FINANCIALS
            </span>

            <h2>
              Payment state
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

          <section className="admin-control-card">
            <span>
              CUSTOMER
            </span>

            <h2>
              Contact
            </h2>

            <div className="admin-brief-block">
              <strong>
                Name
              </strong>

              <p>
                {order
                  .customers
                  ?.full_name}
              </p>
            </div>

            <div className="admin-brief-block">
              <strong>
                Email
              </strong>

              <p>
                {order
                  .customers
                  ?.email}
              </p>
            </div>

            <div className="admin-brief-block">
              <strong>
                Phone
              </strong>

              <p>
                {order
                  .customers
                  ?.phone}
              </p>
            </div>

            <div className="admin-brief-block">
              <strong>
                Business
              </strong>

              <p>
                {order
                  .customers
                  ?.business_name ||
                  'Not provided'}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}