import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ArrowLeft,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Gauge,
  MessageSquareText,
  Save,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';

import {
  useParams,
} from 'react-router-dom';

import Link from '../components/PortalLink';

import AdminPaymentAttempts from '../components/AdminPaymentAttempts';
import BrandLoader from '../components/BrandLoader';
import ProjectServiceDetails from '../components/ProjectServiceDetails';
import AdminBalanceCollection from '../components/payment/AdminBalanceCollection';
import AdminPaymentRequestManager from '../components/payment/AdminPaymentRequestManager';

import {
  getAdminOrder,
  runAdminOrderAction,
} from '../lib/admin';

import {
  formatMoney,
  formatOrderStatus,
} from '../lib/orders';

import {
  describeFileType,
  formatFileRole,
  formatFileSize,
  getProjectProgress,
  openProjectFile,
  updateAdminProjectProgress,
} from '../lib/projectOperations';

const workflowStatuses = [
  'under_review',
  'awaiting_payment',
  'paid',
  'in_progress',
  'awaiting_client',
  'completed',
  'cancelled',
];

const progressPresets = [
  {
    value: 0,
    label:
      'Not started',
  },
  {
    value: 10,
    label:
      'Planning',
  },
  {
    value: 25,
    label:
      'Foundation complete',
  },
  {
    value: 50,
    label:
      'Production in progress',
  },
  {
    value: 75,
    label:
      'Review and refinement',
  },
  {
    value: 90,
    label:
      'Final checks',
  },
  {
    value: 100,
    label:
      'Completed',
  },
];

function formatDateTime(
  value,
) {
  if (!value) {
    return 'Not yet';
  }

  return new Intl.DateTimeFormat(
    'en-NG',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  ).format(
    new Date(value),
  );
}

function formatDateOnly(
  value,
) {
  if (!value) {
    return 'Not specified';
  }

  return new Intl.DateTimeFormat(
    'en-NG',
    {
      dateStyle:
        'medium',
    },
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
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
    progressHistory,
    setProgressHistory,
  ] =
    useState([]);

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
    progressBusy,
    setProgressBusy,
  ] =
    useState(false);

  const [
    fileBusy,
    setFileBusy,
  ] =
    useState('');

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

  const [
    progressForm,
    setProgressForm,
  ] =
    useState({
      percent:
        '0',

      label:
        'Not started',

      message:
        '',
    });

  const load =
    useCallback(
      async () => {
        try {
          setError('');

          const result =
            await getAdminOrder(
              reference,
            );

          if (!result) {
            setOrder(
              null,
            );

            return;
          }

          const progress =
            await getProjectProgress(
              result.id,
            );

          const hydrated =
            {
              ...result,
              ...progress.current,
            };

          setOrder(
            hydrated,
          );

          setProgressHistory(
            progress.updates,
          );

          setStatusForm(
            (current) => ({
              ...current,

              status:
                workflowStatuses.includes(
                  hydrated.status,
                )
                  ? hydrated.status
                  : 'under_review',
            }),
          );

          setProgressForm({
            percent:
              String(
                hydrated
                  .progress_percent ??
                  0,
              ),

            label:
              hydrated
                .progress_label ||
              'Not started',

            message:
              '',
          });
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

  const publishProgress =
    async (
      event,
    ) => {
      event.preventDefault();

      if (!order) {
        return;
      }

      try {
        setProgressBusy(
          true,
        );

        setError('');
        setSuccess('');

        await updateAdminProjectProgress({
          orderId:
            order.id,

          progressPercent:
            Number(
              progressForm.percent,
            ),

          progressLabel:
            progressForm.label,

          message:
            progressForm.message,
        });

        await load();

        setSuccess(
          'Project progress published successfully. The customer can now see the update.',
        );
      } catch (
        progressError
      ) {
        console.error(
          progressError,
        );

        setError(
          progressError.message,
        );
      } finally {
        setProgressBusy(
          false,
        );
      }
    };

  const chooseProgressPreset =
    (
      preset,
    ) => {
      setProgressForm(
        (current) => ({
          ...current,

          percent:
            String(
              preset.value,
            ),

          label:
            preset.label,
        }),
      );
    };

  const handleProjectFile =
    async (
      file,
      download,
    ) => {
      const key =
        `${file.id}-${download ? 'download' : 'view'}`;

      try {
        setFileBusy(
          key,
        );

        setError('');

        await openProjectFile(
          file,
          {
            download,
          },
        );
      } catch (
        fileError
      ) {
        console.error(
          fileError,
        );

        setError(
          'This project file could not be opened securely.',
        );
      } finally {
        setFileBusy('');
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

  const currentProgress =
    Number(
      order
        .progress_percent ??
        0,
    );

  const projectFiles =
    order.files ||
    [];

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
              placeholder="Clearly explain why Posho Creative cannot proceed with this request."
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
              This project may now proceed through quotation, payment and production.
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
              {order.decline_reason ||
                'No decline reason was recorded.'}
            </span>
          </div>
        </section>
      )}

      <div className="admin-project-grid">
        <div className="admin-project-main">
          <section className="admin-control-card admin-project-overview-card">
            <span>
              PROJECT BRIEF
            </span>

            <h2>
              Customer requirements
            </h2>

            <div className="admin-project-facts-grid">
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
                    ) ||
                    'Not specified'}
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
                    ) ||
                    'Not specified'}
                </strong>
              </div>

              <div>
                <span>
                  Deadline
                </span>

                <strong>
                  {formatDateOnly(
                    order.deadline,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Submitted
                </span>

                <strong>
                  {formatDateTime(
                    order.submitted_at ||
                      order.created_at,
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
                  Reference links
                </strong>

                <p className="admin-reference-links">
                  {order.reference_links}
                </p>
              </div>
            )}
          </section>

          <ProjectServiceDetails
            details={order.service_details}
          />

          <section className="admin-control-card admin-project-files-card">
            <div className="admin-project-section-heading">
              <div>
                <FileText
                  size={22}
                />

                <div>
                  <span>
                    CUSTOMER FILES
                  </span>

                  <h2>
                    Uploaded references
                  </h2>
                </div>
              </div>

              <strong className="admin-project-count-pill">
                {projectFiles.length}
                {' '}
                {projectFiles.length ===
                1
                  ? 'file'
                  : 'files'}
              </strong>
            </div>

            <p className="admin-card-description">
              Review the files supplied with this project request. Files are accessed through temporary private links.
            </p>

            {projectFiles.length ===
            0 ? (
              <div className="admin-project-empty-state">
                <FileText
                  size={24}
                />

                <strong>
                  No files were uploaded.
                </strong>

                <span>
                  This customer submitted the project without an attachment.
                </span>
              </div>
            ) : (
              <div className="admin-project-file-list">
                {projectFiles.map(
                  (
                    file,
                  ) => {
                    const uploaded =
                      file.upload_status ===
                      'uploaded';

                    const viewKey =
                      `${file.id}-view`;

                    const downloadKey =
                      `${file.id}-download`;

                    return (
                      <article
                        key={
                          file.id
                        }
                        className="admin-project-file"
                      >
                        <div className="admin-project-file-icon">
                          <FileText
                            size={21}
                          />
                        </div>

                        <div className="admin-project-file-info">
                          <div className="admin-project-file-title">
                            <strong>
                              {file.original_name}
                            </strong>

                            <span
                              className={`admin-file-state admin-file-state-${file.upload_status}`}
                            >
                              {formatOrderStatus(
                                file.upload_status,
                              )}
                            </span>
                          </div>

                          <div className="admin-project-file-meta">
                            <span>
                              {describeFileType(
                                file.mime_type,
                                file.original_name,
                              )}
                            </span>

                            <span>
                              {formatFileSize(
                                file.size_bytes,
                              )}
                            </span>

                            <span>
                              {formatFileRole(
                                file.file_role,
                              )}
                            </span>

                            <span>
                              {file.uploaded_at
                                ? `Uploaded ${formatDateTime(
                                    file.uploaded_at,
                                  )}`
                                : `Created ${formatDateTime(
                                    file.created_at,
                                  )}`}
                            </span>
                          </div>
                        </div>

                        <div className="admin-project-file-actions">
                          <button
                            type="button"
                            disabled={
                              !uploaded ||
                              fileBusy ===
                                viewKey
                            }
                            onClick={() =>
                              handleProjectFile(
                                file,
                                false,
                              )
                            }
                          >
                            <Eye
                              size={16}
                            />

                            {fileBusy ===
                            viewKey
                              ? 'Opening...'
                              : 'View'}
                          </button>

                          <button
                            type="button"
                            disabled={
                              !uploaded ||
                              fileBusy ===
                                downloadKey
                            }
                            onClick={() =>
                              handleProjectFile(
                                file,
                                true,
                              )
                            }
                          >
                            <Download
                              size={16}
                            />

                            {fileBusy ===
                            downloadKey
                              ? 'Preparing...'
                              : 'Download'}
                          </button>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            )}
          </section>

          {approved && (
            <section className="admin-control-card admin-progress-management">
              <div className="admin-project-section-heading">
                <div>
                  <Gauge
                    size={22}
                  />

                  <div>
                    <span>
                      PROJECT PROGRESS
                    </span>

                    <h2>
                      Production tracking
                    </h2>
                  </div>
                </div>

                <strong className="admin-progress-percentage">
                  {currentProgress}%
                </strong>
              </div>

              <div className="admin-current-progress-card">
                <div className="admin-current-progress-top">
                  <div>
                    <span>
                      CURRENT MILESTONE
                    </span>

                    <strong>
                      {order.progress_label ||
                        'Awaiting project start'}
                    </strong>
                  </div>

                  <span>
                    {currentProgress}%
                  </span>
                </div>

                <div
                  className="project-progress-track"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={
                    currentProgress
                  }
                >
                  <div
                    className="project-progress-fill"
                    style={{
                      width:
                        `${currentProgress}%`,
                    }}
                  />
                </div>

                {order.progress_message && (
                  <p>
                    {order.progress_message}
                  </p>
                )}

                <small>
                  {order.progress_updated_at
                    ? `Last published ${formatDateTime(
                        order.progress_updated_at,
                      )}`
                    : 'No production progress has been published yet.'}
                </small>
              </div>

              <form
                onSubmit={
                  publishProgress
                }
                className="admin-progress-form"
              >
                <div className="admin-progress-form-heading">
                  <div>
                    <strong>
                      Publish progress update
                    </strong>

                    <span>
                      This is visible to the customer immediately.
                    </span>
                  </div>

                  <strong>
                    {progressForm.percent}%
                  </strong>
                </div>

                <div className="admin-progress-presets">
                  {progressPresets.map(
                    (
                      preset,
                    ) => (
                      <button
                        type="button"
                        key={
                          preset.value
                        }
                        className={
                          Number(
                            progressForm.percent,
                          ) ===
                          preset.value
                            ? 'active'
                            : ''
                        }
                        onClick={() =>
                          chooseProgressPreset(
                            preset,
                          )
                        }
                      >
                        {preset.value}%
                      </button>
                    ),
                  )}
                </div>

                <label className="admin-progress-range-field">
                  <span>
                    Completion percentage
                  </span>

                  <div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={
                        progressForm.percent
                      }
                      onChange={(
                        event,
                      ) =>
                        setProgressForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            percent:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                    />

                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={
                        progressForm.percent
                      }
                      onChange={(
                        event,
                      ) =>
                        setProgressForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            percent:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                    />
                  </div>
                </label>

                <label>
                  <span>
                    Milestone
                  </span>

                  <input
                    type="text"
                    maxLength="120"
                    value={
                      progressForm.label
                    }
                    onChange={(
                      event,
                    ) =>
                      setProgressForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          label:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    placeholder="e.g. Design and development"
                  />
                </label>

                <label>
                  <span>
                    Customer progress update
                  </span>

                  <textarea
                    value={
                      progressForm.message
                    }
                    onChange={(
                      event,
                    ) =>
                      setProgressForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          message:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    placeholder="Explain what has been completed, what is currently being worked on, and what happens next."
                  />
                </label>

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={
                    progressBusy
                  }
                >
                  <Gauge
                    size={17}
                  />

                  {progressBusy
                    ? 'Publishing progress...'
                    : 'Publish progress update'}
                </button>
              </form>

              <div className="admin-progress-history">
                <div className="admin-progress-history-heading">
                  <strong>
                    Progress history
                  </strong>

                  <span>
                    {progressHistory.length}
                    {' '}
                    updates
                  </span>
                </div>

                {progressHistory.length ===
                0 ? (
                  <div className="admin-project-empty-state admin-project-empty-state-small">
                    <span>
                      No progress updates have been published yet.
                    </span>
                  </div>
                ) : (
                  progressHistory.map(
                    (
                      update,
                    ) => (
                      <article
                        key={
                          update.id
                        }
                        className="admin-progress-history-item"
                      >
                        <div className="admin-progress-history-percent">
                          {update.progress_percent}%
                        </div>

                        <div>
                          <strong>
                            {update.progress_label}
                          </strong>

                          <p>
                            {update.message}
                          </p>

                          <span>
                            {formatDateTime(
                              update.created_at,
                            )}
                          </span>
                        </div>
                      </article>
                    ),
                  )
                )}
              </div>
            </section>
          )}

          <AdminPaymentAttempts
            orderId={
              order.id
            }
          />

          {approved &&
            paid > 0 &&
            balance > 0 && (
            <AdminBalanceCollection
              orderId={order.id}
              projectValueKobo={quoted}
              paidKobo={paid}
              outstandingKobo={balance}
              costs={order.costs}
              onUpdated={load}
            />
          )}

          {approved &&
            balance > 0 && (
            <AdminPaymentRequestManager
              orderId={order.id}
              outstandingKobo={balance}
              onUpdated={load}
            />
          )}

          {approved && (
            <>
              {paid === 0 && (
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
                          (
                            current,
                          ) => ({
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
                          (
                            current,
                          ) => ({
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
              )}

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

                <p className="admin-card-description">
                  Use this for general communication that is separate from production progress.
                </p>

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
                    placeholder="Write a clear project update for the customer."
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

              <p className="admin-card-description">
                Keep the operational state aligned with the actual position of the project.
              </p>

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
                      (
                        current,
                      ) => ({
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
                      (
                        current,
                      ) => ({
                        ...current,

                        note:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Optional customer-facing explanation for this status change."
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

              <div>
                <span>
                  Preferred contact
                </span>

                <strong>
                  {formatOrderStatus(
                    order
                      .customers
                      ?.preferred_contact_method ||
                      'not specified',
                  )}
                </strong>
              </div>
            </div>
          </section>

          {approved && (
            <section className="admin-control-card">
              <Gauge
                size={22}
              />

              <span>
                DELIVERY
              </span>

              <h2>
                Current progress
              </h2>

              <div className="admin-sidebar-progress">
                <strong>
                  {currentProgress}%
                </strong>

                <span>
                  {order.progress_label ||
                    'Awaiting project start'}
                </span>

                <div className="project-progress-track">
                  <div
                    className="project-progress-fill"
                    style={{
                      width:
                        `${currentProgress}%`,
                    }}
                  />
                </div>
              </div>
            </section>
          )}

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

          <section className="admin-control-card">
            <CalendarDays
              size={22}
            />

            <span>
              PROJECT RECORD
            </span>

            <h2>
              Key dates
            </h2>

            <div className="admin-contact-list">
              <div>
                <span>
                  Submitted
                </span>

                <strong>
                  {formatDateTime(
                    order.submitted_at ||
                      order.created_at,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Deadline
                </span>

                <strong>
                  {formatDateOnly(
                    order.deadline,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Last updated
                </span>

                <strong>
                  {formatDateTime(
                    order.updated_at,
                  )}
                </strong>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
