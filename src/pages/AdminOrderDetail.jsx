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

function formatMoney(
  amountKobo,
) {
  if (
    amountKobo === null ||
    amountKobo === undefined
  ) {
    return 'Not quoted';
  }

  return new Intl.NumberFormat(
    'en-NG',
    {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    },
  ).format(
    Number(amountKobo) / 100,
  );
}

function formatStatus(
  value,
) {
  if (!value) {
    return '';
  }

  return value
    .replaceAll('_', ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

const statusOptions = [
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

async function fetchOrder(
  reference,
) {
  const {
    data,
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

  return data;
}

async function runAdminAction(
  payload,
) {
  const {
    data,
    error,
  } =
    await supabase.functions
      .invoke(
        'admin-order-action',
        {
          body: payload,
        },
      );

  if (error) {
    let message =
      'Administrative action failed.';

    try {
      const body =
        await error.context?.json();

      if (body?.message) {
        message =
          body.message;
      }
    } catch {
      // Keep fallback message.
    }

    throw new Error(
      message,
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.message ||
        'Administrative action failed.',
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
    quoteAmount,
    setQuoteAmount,
  ] =
    useState('');

  const [
    quoteMessage,
    setQuoteMessage,
  ] =
    useState('');

  const [
    projectStatus,
    setProjectStatus,
  ] =
    useState(
      'under_review',
    );

  const [
    statusNote,
    setStatusNote,
  ] =
    useState('');

  const [
    customerUpdate,
    setCustomerUpdate,
  ] =
    useState('');

  const loadOrder =
    useCallback(
      async () => {
        try {
          setError('');

          const result =
            await fetchOrder(
              reference,
            );

          setOrder(
            result,
          );

          if (result?.status) {
            setProjectStatus(
              result.status,
            );
          }
        } catch (
          loadError
        ) {
          console.error(
            'Admin project loading failed:',
            loadError,
          );

          setError(
            'The project could not be loaded.',
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

    loadOrder();
  }, [
    reference,
    loadOrder,
  ]);

  const execute =
    async (
      payload,
      successMessage,
    ) => {
      if (!order) {
        return;
      }

      try {
        setBusy(true);
        setError('');
        setSuccess('');

        await runAdminAction({
          orderId:
            order.id,

          ...payload,
        });

        await loadOrder();

        setSuccess(
          successMessage,
        );
      } catch (
        actionError
      ) {
        console.error(
          actionError,
        );

        setError(
          actionError.message,
        );
      } finally {
        setBusy(false);
      }
    };

  const handleQuote =
    async (
      event,
    ) => {
      event.preventDefault();

      const amount =
        Number(
          quoteAmount,
        );

      if (
        !Number.isFinite(
          amount,
        ) ||
        amount <= 0
      ) {
        setError(
          'Enter a valid quote amount.',
        );

        return;
      }

      await execute(
        {
          action:
            'send_quote',

          amountKobo:
            Math.round(
              amount * 100,
            ),

          message:
            quoteMessage.trim(),
        },
        'Quote sent successfully.',
      );

      setQuoteAmount('');
      setQuoteMessage('');
    };

  const handleStatus =
    async (
      event,
    ) => {
      event.preventDefault();

      await execute(
        {
          action:
            'update_status',

          status:
            projectStatus,

          note:
            statusNote.trim(),
        },
        'Project status updated.',
      );

      setStatusNote('');
    };

  const handleUpdate =
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

      await execute(
        {
          action:
            'add_note',

          note:
            customerUpdate.trim(),

          isInternal:
            false,
        },
        'Customer update published.',
      );

      setCustomerUpdate('');
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
      quoted - paid,
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
          {formatStatus(
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
              QUOTE
            </span>

            <h2>
              Send final price
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
                handleQuote
              }
            >
              <label>
                <span>
                  Quote amount in Naira
                </span>

                <input
                  type="number"
                  min="1"
                  value={
                    quoteAmount
                  }
                  onChange={(
                    event,
                  ) =>
                    setQuoteAmount(
                      event
                        .target
                        .value,
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
                    quoteMessage
                  }
                  onChange={(
                    event,
                  ) =>
                    setQuoteMessage(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Explain what is included in the quote..."
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
              Send project update
            </h2>

            <form
              className="admin-form-stack"
              onSubmit={
                handleUpdate
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
                placeholder="Write an update the customer can see..."
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
              Update workflow
            </h2>

            <form
              className="admin-form-stack"
              onSubmit={
                handleStatus
              }
            >
              <select
                value={
                  projectStatus
                }
                onChange={(
                  event,
                ) =>
                  setProjectStatus(
                    event
                      .target
                      .value,
                  )
                }
              >
                {statusOptions.map(
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
                      {formatStatus(
                        status,
                      )}
                    </option>
                  ),
                )}
              </select>

              <textarea
                value={
                  statusNote
                }
                onChange={(
                  event,
                ) =>
                  setStatusNote(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="Optional customer-facing message..."
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
              PAYMENT
            </span>

            <h2>
              Financial state
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
              Contact details
            </h2>

            <div className="admin-brief-block">
              <strong>
                Name
              </strong>

              <p>
                {order
                  .customers
                  ?.full_name ||
                  'Not provided'}
              </p>
            </div>

            <div className="admin-brief-block">
              <strong>
                Email
              </strong>

              <p>
                {order
                  .customers
                  ?.email ||
                  'Not provided'}
              </p>
            </div>

            <div className="admin-brief-block">
              <strong>
                Phone
              </strong>

              <p>
                {order
                  .customers
                  ?.phone ||
                  'Not provided'}
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