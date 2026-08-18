import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  Check,
  Clock3,
  Download,
  FileText,
  ReceiptText,
} from 'lucide-react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  downloadProjectFile,
  formatMoney,
  formatOrderStatus,
  getOrderByReference,
} from '../lib/orders';

const workflow = [
  'new',
  'under_review',
  'quote_sent',
  'awaiting_payment',
  'paid',
  'in_progress',
  'awaiting_client',
  'completed',
];

function formatDate(value) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'en-NG',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(
    new Date(value),
  );
}

function formatFileSize(bytes) {
  if (!bytes) {
    return '0 KB';
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

export default function DashboardOrderDetail() {
  const {
    reference,
  } = useParams();

  const [order, setOrder] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [
    downloadingFile,
    setDownloadingFile,
  ] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result =
          await getOrderByReference(
            reference,
          );

        setOrder(result);

        document.title =
          result
            ? `${result.reference} | Posho Creative`
            : 'Project Not Found | Posho Creative';
      } catch (loadError) {
        console.error(
          loadError,
        );

        setError(
          'We could not load this project.',
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [reference]);

  const currentIndex =
    useMemo(() => {
      if (!order) {
        return -1;
      }

      return workflow.indexOf(
        order.status,
      );
    }, [order]);

  const handleDownload =
    async (file) => {
      try {
        setDownloadingFile(
          file.id,
        );

        await downloadProjectFile(
          file,
        );
      } catch (downloadError) {
        console.error(
          downloadError,
        );

        setError(
          'We could not prepare this file for download.',
        );
      } finally {
        setDownloadingFile(
          null,
        );
      }
    };

  if (loading) {
    return (
      <div className="workspace-loading-panel page-reveal">
        <BrandLoader label="Opening your project..." />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="workspace-view page-reveal">
        <Link
          to="/dashboard/orders"
          className="workspace-back-link"
        >
          <ArrowLeft size={17} />
          Orders
        </Link>

        <div className="workspace-empty">
          <h3>
            Project not found.
          </h3>

          <p>
            This project does not exist or does not belong to your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-view page-reveal">
      <Link
        to="/dashboard/orders"
        className="workspace-back-link"
      >
        <ArrowLeft size={17} />
        All orders
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

        <div className="project-detail-status">
          <span
            className={`workspace-status workspace-status-${order.status}`}
          >
            {formatOrderStatus(
              order.status,
            )}
          </span>

          <small>
            Updated{' '}
            {formatDate(
              order.updated_at,
            )}
          </small>
        </div>
      </div>

      {error && (
        <div className="workspace-alert">
          {error}
        </div>
      )}

      <section className="project-progress-panel">
        <div className="workspace-panel-heading">
          <div>
            <span>
              PROJECT JOURNEY
            </span>

            <h3>
              Progress
            </h3>
          </div>
        </div>

        <div className="project-progress-track">
          {workflow.map(
            (
              status,
              index,
            ) => {
              const completed =
                currentIndex >
                index;

              const current =
                currentIndex ===
                index;

              return (
                <div
                  key={status}
                  className={`project-progress-step ${
                    completed
                      ? 'complete'
                      : ''
                  } ${
                    current
                      ? 'current'
                      : ''
                  }`}
                >
                  <div className="project-progress-marker">
                    {completed ? (
                      <Check size={14} />
                    ) : current ? (
                      <Clock3 size={14} />
                    ) : (
                      index + 1
                    )}
                  </div>

                  <span>
                    {formatOrderStatus(
                      status,
                    )}
                  </span>
                </div>
              );
            },
          )}
        </div>
      </section>

      <div className="project-detail-grid">
        <div className="project-detail-main">
          <section className="workspace-panel project-info-panel">
            <div className="workspace-panel-heading">
              <div>
                <span>
                  PROJECT
                </span>

                <h3>
                  Brief
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

              {order.reference_links && (
                <div>
                  <span>
                    References
                  </span>

                  <p className="project-reference-links">
                    {order.reference_links}
                  </p>
                </div>
              )}
            </div>
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

              <FileText size={20} />
            </div>

            {order.files.length ===
            0 ? (
              <div className="workspace-empty workspace-empty-compact">
                <p>
                  No files are attached to this project yet.
                </p>
              </div>
            ) : (
              <div className="project-file-list">
                {order.files.map(
                  (file) => (
                    <div
                      key={file.id}
                      className="project-file-row"
                    >
                      <div className="project-file-icon">
                        <FileText size={19} />
                      </div>

                      <div>
                        <strong>
                          {file.original_name}
                        </strong>

                        <span>
                          {formatFileSize(
                            file.size_bytes,
                          )}
                          {' · '}
                          {file.file_role
                            .replaceAll(
                              '_',
                              ' ',
                            )}
                        </span>
                      </div>

                      {file.upload_status ===
                        'uploaded' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleDownload(
                              file,
                            )
                          }
                          disabled={
                            downloadingFile ===
                            file.id
                          }
                        >
                          <Download size={17} />

                          {downloadingFile ===
                          file.id
                            ? 'Preparing...'
                            : 'Download'}
                        </button>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <span>
                  UPDATES
                </span>

                <h3>
                  Project activity
                </h3>
              </div>
            </div>

            <div className="project-history">
              {order.history.map(
                (item) => (
                  <div
                    key={item.id}
                    className="project-history-item"
                  >
                    <span className="project-history-dot" />

                    <div>
                      <strong>
                        {formatOrderStatus(
                          item.new_status,
                        )}
                      </strong>

                      {item.note && (
                        <p>
                          {item.note}
                        </p>
                      )}

                      <time>
                        {formatDate(
                          item.created_at,
                        )}
                      </time>
                    </div>
                  </div>
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
                  DETAILS
                </span>

                <h3>
                  Project summary
                </h3>
              </div>
            </div>

            <div className="project-summary-list">
              <div>
                <span>
                  Project type
                </span>

                <strong>
                  {order.project_type
                    .replaceAll(
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
                    .replaceAll(
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
                    .replaceAll(
                      '-',
                      ' ',
                    )}
                </strong>
              </div>

              <div>
                <span>
                  Deadline
                </span>

                <strong>
                  {order.deadline ||
                    'Flexible'}
                </strong>
              </div>

              <div>
                <span>
                  Submitted
                </span>

                <strong>
                  {formatDate(
                    order.created_at,
                  )}
                </strong>
              </div>
            </div>
          </section>

          <section className="workspace-panel project-payment-card">
            <ReceiptText size={22} />

            <span>
              PAYMENT
            </span>

            <h3>
              {formatMoney(
                order.quoted_amount_kobo,
              )}
            </h3>

            <p>
              Paid:{' '}
              {formatMoney(
                order.paid_amount_kobo,
              )}
            </p>

            <strong
              className={`workspace-status workspace-payment-${order.payment_status}`}
            >
              {formatOrderStatus(
                order.payment_status,
              )}
            </strong>
          </section>
        </aside>
      </div>
    </div>
  );
}