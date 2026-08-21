import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Gauge,
  History,
  Info,
  LockKeyhole,
  Maximize2,
  Paperclip,
  X,
} from 'lucide-react';

import {
  canPreviewAdminProjectFile,
  getAdminProjectFileUrl,
} from '../lib/adminProjectWorkspace';

import {
  describeFileType,
  formatFileRole,
  formatFileSize,
  updateAdminProjectProgress,
} from '../lib/projectOperations';

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

export default function AdminProjectControlCenter({
  order,
  files = [],
  progressHistory = [],
  onRefresh,
  onSuccess,
  onError,
}) {
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

  const [
    publishing,
    setPublishing,
  ] =
    useState(false);

  const [
    fileBusy,
    setFileBusy,
  ] =
    useState('');

  const [
    preview,
    setPreview,
  ] =
    useState(null);

  const [
    previewLoading,
    setPreviewLoading,
  ] =
    useState(false);

  useEffect(() => {
    setProgressForm({
      percent:
        String(
          order
            ?.progress_percent ??
            0,
        ),

      label:
        order
          ?.progress_label ||
        'Not started',

      message:
        '',
    });
  }, [
    order?.id,
    order?.progress_percent,
    order?.progress_label,
  ]);

  const uploadedFiles =
    useMemo(
      () =>
        files.filter(
          (
            file,
          ) =>
            file.upload_status ===
            'uploaded',
        ),
      [
        files,
      ],
    );

  const pendingFiles =
    files.filter(
      (
        file,
      ) =>
        file.upload_status !==
        'uploaded',
    );

  const currentProgress =
    Number(
      order
        ?.progress_percent ??
        0,
    );

  const draftProgress =
    Math.min(
      100,
      Math.max(
        0,
        Number(
          progressForm.percent ||
            0,
        ),
      ),
    );

  const choosePreset =
    (
      preset,
    ) => {
      setProgressForm(
        (
          current,
        ) => ({
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

  const publishProgress =
    async (
      event,
    ) => {
      event.preventDefault();

      if (!order?.id) {
        return;
      }

      try {
        setPublishing(
          true,
        );

        onError?.('');

        const result =
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

        onSuccess?.(
          `Progress published at ${result.progress_percent}%. The customer can now see the new milestone.`,
        );

        if (
          typeof onRefresh ===
          'function'
        ) {
          await onRefresh();
        }
      } catch (
        error
      ) {
        console.error(
          'Publish project progress:',
          error,
        );

        onError?.(
          error.message ||
            'Project progress could not be published.',
        );
      } finally {
        setPublishing(
          false,
        );
      }
    };

  const previewFile =
    async (
      file,
    ) => {
      if (
        file.upload_status !==
        'uploaded'
      ) {
        return;
      }

      const key =
        `${file.id}-preview`;

      try {
        setFileBusy(
          key,
        );

        setPreviewLoading(
          true,
        );

        onError?.('');

        const url =
          await getAdminProjectFileUrl(
            file,
          );

        setPreview({
          file,
          url,

          inline:
            canPreviewAdminProjectFile(
              file,
            ),
        });
      } catch (
        error
      ) {
        console.error(
          error,
        );

        onError?.(
          error.message ||
            'This project attachment could not be opened.',
        );
      } finally {
        setPreviewLoading(
          false,
        );

        setFileBusy('');
      }
    };

  const downloadFile =
    async (
      file,
    ) => {
      if (
        file.upload_status !==
        'uploaded'
      ) {
        return;
      }

      const key =
        `${file.id}-download`;

      try {
        setFileBusy(
          key,
        );

        onError?.('');

        const url =
          await getAdminProjectFileUrl(
            file,
            {
              download:
                true,
            },
          );

        window.location.assign(
          url,
        );
      } catch (
        error
      ) {
        console.error(
          error,
        );

        onError?.(
          error.message ||
            'This project attachment could not be downloaded.',
        );
      } finally {
        setFileBusy('');
      }
    };

  const isImage =
    preview
      ?.file
      ?.mime_type
      ?.toLowerCase()
      ?.startsWith(
        'image/',
      );

  const isPdf =
    preview &&
    (
      preview.file
        ?.mime_type ===
        'application/pdf' ||
      preview.file
        ?.original_name
        ?.toLowerCase()
        ?.endsWith(
          '.pdf',
        )
    );

  return (
    <>
      <section className="admin-pcc-project-context">
        <div>
          <span>
            PROJECT OPERATIONS
          </span>

          <h2>
            {order.project_title}
          </h2>

          <p>
            All attachments and progress updates below belong specifically to{' '}
            <strong>
              {order.reference}
            </strong>.
          </p>
        </div>

        <div className="admin-pcc-context-meta">
          <div>
            <Paperclip
              size={17}
            />

            <span>
              Attachments
            </span>

            <strong>
              {uploadedFiles.length}
            </strong>
          </div>

          <div>
            <Gauge
              size={17}
            />

            <span>
              Progress
            </span>

            <strong>
              {currentProgress}%
            </strong>
          </div>
        </div>
      </section>

      <section className="admin-control-card admin-pcc-files">
        <div className="admin-pcc-section-heading">
          <div className="admin-pcc-heading-icon">
            <Paperclip
              size={20}
            />
          </div>

          <div>
            <span>
              PROJECT ATTACHMENTS
            </span>

            <h2>
              Customer files & references
            </h2>

            <p>
              Securely inspect the files attached to this exact project request.
            </p>
          </div>

          <strong className="admin-pcc-count">
            {uploadedFiles.length}
            {' '}
            {uploadedFiles.length ===
            1
              ? 'file'
              : 'files'}
          </strong>
        </div>

        <div className="admin-pcc-security-note">
          <LockKeyhole
            size={15}
          />

          <span>
            Files remain private. Preview and download links are temporary and available only inside the verified Management session.
          </span>
        </div>

        {uploadedFiles.length ===
        0 ? (
          <div className="admin-pcc-empty">
            <FileText
              size={27}
            />

            <strong>
              No completed attachment was found.
            </strong>

            <p>
              If the customer supplied a file, it will appear here after its secure upload completes.
            </p>
          </div>
        ) : (
          <div className="admin-pcc-file-list">
            {uploadedFiles.map(
              (
                file,
              ) => {
                const previewKey =
                  `${file.id}-preview`;

                const downloadKey =
                  `${file.id}-download`;

                return (
                  <article
                    key={
                      file.id
                    }
                    className="admin-pcc-file"
                  >
                    <div className="admin-pcc-file-icon">
                      <FileText
                        size={21}
                      />
                    </div>

                    <div className="admin-pcc-file-copy">
                      <div className="admin-pcc-file-name">
                        <strong>
                          {file.original_name}
                        </strong>

                        <span>
                          {formatFileRole(
                            file.file_role,
                          )}
                        </span>
                      </div>

                      <div className="admin-pcc-file-meta">
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
                          {formatDateTime(
                            file.uploaded_at ||
                              file.created_at,
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="admin-pcc-file-actions">
                      <button
                        type="button"
                        onClick={() =>
                          previewFile(
                            file,
                          )
                        }
                        disabled={
                          fileBusy ===
                          previewKey
                        }
                      >
                        <Eye
                          size={15}
                        />

                        {fileBusy ===
                        previewKey
                          ? 'Opening...'
                          : 'Preview'}
                      </button>

                      <button
                        type="button"
                        className="primary"
                        onClick={() =>
                          downloadFile(
                            file,
                          )
                        }
                        disabled={
                          fileBusy ===
                          downloadKey
                        }
                      >
                        <Download
                          size={15}
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

        {pendingFiles.length >
          0 && (
          <div className="admin-pcc-pending-files">
            <Info
              size={15}
            />

            <span>
              {pendingFiles.length}
              {' '}
              attachment
              {pendingFiles.length ===
              1
                ? ''
                : 's'}
              {' '}
              have not completed uploading and are not available for preview yet.
            </span>
          </div>
        )}
      </section>

      {order.review_decision ===
        'approved' && (
        <section className="admin-control-card admin-pcc-progress">
          <div className="admin-pcc-section-heading">
            <div className="admin-pcc-heading-icon">
              <Gauge
                size={20}
              />
            </div>

            <div>
              <span>
                PRODUCTION PROGRESS
              </span>

              <h2>
                Manage customer-visible progress
              </h2>

              <p>
                Publish an accurate percentage, current milestone and clear explanation of what is happening.
              </p>
            </div>

            <strong className="admin-pcc-progress-number">
              {currentProgress}%
            </strong>
          </div>

          <div className="admin-pcc-current">
            <div className="admin-pcc-current-top">
              <div>
                <span>
                  CURRENT MILESTONE
                </span>

                <strong>
                  {order.progress_label ||
                    'Awaiting project start'}
                </strong>
              </div>

              <strong>
                {currentProgress}%
              </strong>
            </div>

            <div
              className="admin-pcc-progress-track"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={
                currentProgress
              }
            >
              <div
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
                ? `Published ${formatDateTime(
                    order.progress_updated_at,
                  )}`
                : 'No progress update has been published yet.'}
            </small>
          </div>

          <form
            className="admin-pcc-progress-form"
            onSubmit={
              publishProgress
            }
          >
            <div className="admin-pcc-form-heading">
              <div>
                <span>
                  NEW PROGRESS UPDATE
                </span>

                <strong>
                  Prepare the next customer update.
                </strong>
              </div>

              <strong>
                {draftProgress}%
              </strong>
            </div>

            <div className="admin-pcc-presets">
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
                      choosePreset(
                        preset,
                      )
                    }
                  >
                    <span>
                      {preset.value}%
                    </span>

                    <small>
                      {preset.label}
                    </small>
                  </button>
                ),
              )}
            </div>

            <label className="admin-pcc-range">
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

                <div className="admin-pcc-percent-input">
                  <input
                    type="number"
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

                  <span>
                    %
                  </span>
                </div>
              </div>
            </label>

            <label>
              <span>
                Current milestone
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
                Customer-facing progress update
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
                placeholder="Explain what has been completed, what is currently being worked on, and what the customer should expect next."
              />
            </label>

            <div className="admin-pcc-customer-preview">
              <div className="admin-pcc-preview-heading">
                <span>
                  CUSTOMER PREVIEW
                </span>

                <strong>
                  This is how the update will appear.
                </strong>
              </div>

              <div className="admin-pcc-preview-progress">
                <div>
                  <strong>
                    {progressForm.label ||
                      'Current milestone'}
                  </strong>

                  <span>
                    {draftProgress}%
                  </span>
                </div>

                <div className="admin-pcc-progress-track">
                  <div
                    style={{
                      width:
                        `${draftProgress}%`,
                    }}
                  />
                </div>

                <p>
                  {progressForm.message ||
                    'Your customer-facing explanation will appear here before you publish it.'}
                </p>
              </div>
            </div>

            {draftProgress ===
              100 && (
              <div className="admin-pcc-completion-warning">
                <CheckCircle2
                  size={17}
                />

                <div>
                  <strong>
                    Completing this project
                  </strong>

                  <span>
                    Publishing 100% also moves the project to Completed.
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="button button-primary admin-pcc-publish"
              disabled={
                publishing
              }
            >
              <Gauge
                size={17}
              />

              {publishing
                ? 'Publishing progress...'
                : `Publish ${draftProgress}% progress`}
            </button>
          </form>

          <div className="admin-pcc-history">
            <div className="admin-pcc-history-heading">
              <div>
                <History
                  size={18}
                />

                <div>
                  <span>
                    PROGRESS HISTORY
                  </span>

                  <strong>
                    Previous customer updates
                  </strong>
                </div>
              </div>

              <span>
                {progressHistory.length}
                {' '}
                {progressHistory.length ===
                1
                  ? 'update'
                  : 'updates'}
              </span>
            </div>

            {progressHistory.length ===
            0 ? (
              <div className="admin-pcc-history-empty">
                No progress update has been published for this project.
              </div>
            ) : (
              <div className="admin-pcc-history-list">
                {progressHistory.map(
                  (
                    update,
                  ) => (
                    <article
                      key={
                        update.id
                      }
                    >
                      <div className="admin-pcc-history-percent">
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
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {preview && (
        <div
          className="admin-pcc-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Project attachment preview"
        >
          <button
            type="button"
            className="admin-pcc-preview-backdrop"
            onClick={() =>
              setPreview(
                null,
              )
            }
            aria-label="Close preview"
          />

          <section className="admin-pcc-preview-dialog">
            <header>
              <div>
                <span>
                  PROJECT ATTACHMENT
                </span>

                <strong>
                  {preview.file.original_name}
                </strong>

                <small>
                  {order.reference}
                  {' · '}
                  {formatFileSize(
                    preview.file.size_bytes,
                  )}
                </small>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPreview(
                    null,
                  )
                }
                aria-label="Close file preview"
              >
                <X
                  size={19}
                />
              </button>
            </header>

            <div className="admin-pcc-preview-body">
              {previewLoading ? (
                <div className="admin-pcc-preview-message">
                  Preparing secure preview...
                </div>
              ) : isImage ? (
                <img
                  src={
                    preview.url
                  }
                  alt={
                    preview.file.original_name
                  }
                />
              ) : isPdf ? (
                <iframe
                  src={
                    preview.url
                  }
                  title={
                    preview.file.original_name
                  }
                />
              ) : (
                <div className="admin-pcc-preview-message">
                  <FileText
                    size={35}
                  />

                  <strong>
                    Browser preview is not available for this file type.
                  </strong>

                  <p>
                    You can securely open the original file in another tab or download it.
                  </p>
                </div>
              )}
            </div>

            <footer>
              <a
                href={
                  preview.url
                }
                target="_blank"
                rel="noreferrer"
              >
                <Maximize2
                  size={15}
                />

                Open original
              </a>

              <button
                type="button"
                onClick={() =>
                  downloadFile(
                    preview.file,
                  )
                }
              >
                <Download
                  size={15}
                />

                Download
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}