import {
  useEffect,
  useState,
} from 'react';

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  XCircle,
} from 'lucide-react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  formatMoney,
  formatProjectState,
  getOrderByReference,
} from '../lib/orders';

export default function DashboardOrderDetail() {
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

  useEffect(() => {
    getOrderByReference(
      reference,
    )
      .then(
        (result) => {
          setOrder(
            result,
          );

          if (result) {
            document.title =
              `${result.reference} | Posho Creative`;
          }
        },
      )
      .catch(
        console.error,
      )
      .finally(() =>
        setLoading(
          false,
        ),
      );
  }, [
    reference,
  ]);

  if (loading) {
    return (
      <BrandLoader
        label="Opening project..."
      />
    );
  }

  if (!order) {
    return (
      <div className="workspace-empty">
        Project not found.
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

  const outstanding =
    Math.max(
      Number(
        order
          .quoted_amount_kobo ||
          0,
      ) -
        Number(
          order
            .paid_amount_kobo ||
            0,
        ),
      0,
    );

  const canPay =
    approved &&
    outstanding > 0 &&
    ![
      'completed',
      'cancelled',
    ].includes(
      order.status,
    );

  return (
    <div className="workspace-view page-reveal">
      <Link
        to="/dashboard/orders"
        className="workspace-back-link"
      >
        <ArrowLeft
          size={17}
        />

        Projects
      </Link>

      <div className="project-detail-hero">
        <div>
          <span>
            {order.reference}
          </span>

          <h2>
            {order.project_title}
          </h2>

          <p>
            {order.service_slug
              .replaceAll(
                '-',
                ' ',
              )}
          </p>
        </div>

        <span
          className={`workspace-status project-review-status ${order.review_decision}`}
        >
          {formatProjectState(
            order,
          )}
        </span>
      </div>

      {pending && (
        <section className="project-review-banner pending">
          <Clock3
            size={22}
          />

          <div>
            <span>
              REQUEST RECEIVED
            </span>

            <h3>
              Your project is being reviewed.
            </h3>

            <p>
              We are reviewing the scope, timeline and service requirements before confirming the next step. Any decision or quote will appear here.
            </p>
          </div>
        </section>
      )}

      {approved && (
        <section className="project-review-banner approved">
          <CheckCircle2
            size={22}
          />

          <div>
            <span>
              PROJECT APPROVED
            </span>

            <h3>
              Your request has been accepted.
            </h3>

            <p>
              The project can now proceed through quoting, payment and production according to its requirements.
            </p>
          </div>
        </section>
      )}

      {declined && (
        <section className="project-review-banner declined">
          <XCircle
            size={22}
          />

          <div>
            <span>
              REQUEST UPDATE
            </span>

            <h3>
              We are unable to proceed with this request.
            </h3>

            <p>
              {order.decline_reason ||
                'Please contact Posho Creative if you would like to discuss an alternative approach.'}
            </p>
          </div>
        </section>
      )}

      {approved &&
        order.customer_action_required && (
        <section className="project-action-banner">
          <div>
            <span>
              ACTION REQUIRED
            </span>

            <h3>
              {order.customer_action_label ||
                'Your attention is required.'}
            </h3>

            {order
              .quoted_amount_kobo && (
              <strong>
                {formatMoney(
                  outstanding,
                )}
                {' '}
                due
              </strong>
            )}
          </div>

          {canPay && (
            <Link
              to={`/dashboard/orders/${order.reference}/pay`}
              className="button button-primary"
            >
              Pay securely

              <ArrowRight
                size={17}
              />
            </Link>
          )}
        </section>
      )}

      <div className="project-detail-grid">
        <div className="project-detail-main">
          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <span>
                  PROJECT BRIEF
                </span>

                <h3>
                  Requirements
                </h3>
              </div>
            </div>

            <div className="project-info-content">
              <div>
                <span>
                  Description
                </span>

                <p>
                  {order.project_description}
                </p>
              </div>

              <div>
                <span>
                  Goal
                </span>

                <p>
                  {order.project_goal}
                </p>
              </div>
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <span>
                  PROJECT UPDATES
                </span>

                <h3>
                  Communication
                </h3>
              </div>
            </div>

            {order.notes.length ===
            0 ? (
              <div className="workspace-empty workspace-empty-compact">
                <p>
                  No project updates yet.
                </p>
              </div>
            ) : (
              <div className="project-history">
                {order.notes.map(
                  (
                    note,
                  ) => (
                    <article
                      key={
                        note.id
                      }
                      className="project-history-item"
                    >
                      <strong>
                        Posho Creative
                      </strong>

                      <p>
                        {note.note}
                      </p>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <span>
                  FILES
                </span>

                <h3>
                  Project references
                </h3>
              </div>

              <FileText
                size={20}
              />
            </div>

            {order.files.length ===
            0 ? (
              <div className="workspace-empty workspace-empty-compact">
                <p>
                  No project files available.
                </p>
              </div>
            ) : (
              <div className="project-file-list">
                {order.files.map(
                  (
                    file,
                  ) => (
                    <article
                      key={
                        file.id
                      }
                      className="project-file-row"
                    >
                      <FileText
                        size={18}
                      />

                      <div>
                        <strong>
                          {file.original_name}
                        </strong>

                        <span>
                          {file.file_role
                            .replaceAll(
                              '_',
                              ' ',
                            )}
                        </span>
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="project-detail-sidebar">
          {approved && (
            <section className="workspace-panel project-summary-panel">
              <div className="workspace-panel-heading">
                <div>
                  <span>
                    FINANCIALS
                  </span>

                  <h3>
                    Project value
                  </h3>
                </div>
              </div>

              <div className="project-summary-list">
                <div>
                  <span>
                    Quoted
                  </span>

                  <strong>
                    {formatMoney(
                      order
                        .quoted_amount_kobo,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Paid
                  </span>

                  <strong>
                    {formatMoney(
                      order
                        .paid_amount_kobo,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Balance
                  </span>

                  <strong>
                    {formatMoney(
                      outstanding,
                    )}
                  </strong>
                </div>
              </div>
            </section>
          )}

          {approved &&
            order.quotes?.[0] && (
            <section className="workspace-panel current-quote-card">
              <span>
                CURRENT QUOTE
              </span>

              <h3>
                {formatMoney(
                  order
                    .quotes[0]
                    .amount_kobo,
                )}
              </h3>

              <p>
                {order
                  .quotes[0]
                  .message ||
                  'Project quote from Posho Creative.'}
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}