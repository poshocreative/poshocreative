import {
  useEffect,
  useState,
} from 'react';

import {
  ArrowLeft,
  ArrowRight,
  FileText,
} from 'lucide-react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  formatMoney,
  formatOrderStatus,
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
        (
          result,
        ) => {
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
        setLoading(false),
      );
  }, [
    reference,
  ]);

  if (loading) {
    return (
      <BrandLoader label="Opening project..." />
    );
  }

  if (!order) {
    return (
      <div className="workspace-empty">
        Project not found.
      </div>
    );
  }

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
            {
              order.reference
            }
          </span>

          <h2>
            {
              order.project_title
            }
          </h2>

          <p>
            {order.service_slug
              .replaceAll(
                '-',
                ' ',
              )}
          </p>
        </div>

        <span className={`workspace-status workspace-status-${order.status}`}>
          {formatOrderStatus(
            order.status,
          )}
        </span>
      </div>

      {order.customer_action_required && (
        <section className="project-action-banner">
          <div>
            <span>
              ACTION REQUIRED
            </span>

            <h3>
              {order.customer_action_label ||
                'Your attention is required.'}
            </h3>

            {order.quoted_amount_kobo && (
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
                  {
                    order.project_description
                  }
                </p>
              </div>

              <div>
                <span>
                  Goal
                </span>

                <p>
                  {
                    order.project_goal
                  }
                </p>
              </div>
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <span>
                  UPDATES
                </span>

                <h3>
                  From Posho Creative
                </h3>
              </div>
            </div>

            {order.notes.length ===
            0 ? (
              <div className="workspace-empty workspace-empty-compact">
                No customer updates yet.
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
                  Project files
                </h3>
              </div>

              <FileText
                size={20}
              />
            </div>

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
                        {
                          file.original_name
                        }
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
          </section>
        </div>

        <aside className="project-detail-sidebar">
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

          {order.quotes?.[0] && (
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
                  'Professional project quote from Posho Creative.'}
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}