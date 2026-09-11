import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';


import Icon from '../ui/Icon';
import {
  useToast,
} from '../ui/Toast';

import {
  ErrorBlock,
} from '../ui/StateBlocks';

import StatusBadge from '../ui/StatusBadge';

import {
  supabase,
} from '../../lib/supabase';

import {
  getVersionAnnotations,
  runClientProjectAction,
} from '../../lib/clientOps';

function formatDateTime(
  value,
) {
  if (!value) {
    return '';
  }

  return new Date(
    value,
  ).toLocaleString(
    'en-NG',
    {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    },
  );
}

function threadLabel(
  annotation,
) {
  const parts = [];

  if (
    annotation.page
  ) {
    parts.push(
      `p.${annotation.page}`,
    );
  }

  if (
    annotation.video_timestamp_seconds !==
      null &&
    annotation.video_timestamp_seconds !==
      undefined
  ) {
    const total = Math.round(
      Number(
        annotation.video_timestamp_seconds,
      ),
    );

    parts.push(
      `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`,
    );
  }

  if (
    annotation.x !==
      null &&
    annotation.x !==
      undefined
  ) {
    parts.push(
      `${Math.round(Number(annotation.x))}%,${Math.round(Number(annotation.y))}%`,
    );
  }

  return parts.join(
    ' · ',
  );
}

export default function ProofingPanel({
  version,
  storagePath,
  readOnly = false,
  isPdf = false,
  onChanged,
}) {
  const toast =
    useToast();

  const [
    previewUrl,
    setPreviewUrl] =
    useState('');

  const [
    previewError,
    setPreviewError] =
    useState('');

  const [
    annotations,
    setAnnotations] =
    useState([]);

  const [
    loadError,
    setLoadError] =
    useState('');

  const [
    draft,
    setDraft] =
    useState(null);

  const [
    comment,
    setComment] =
    useState('');

  const [
    page,
    setPage] =
    useState('');

  const [
    timestamp,
    setTimestamp] =
    useState('');

  const [
    replyTo,
    setReplyTo] =
    useState(null);

  const [
    replyBody,
    setReplyBody] =
    useState('');

  const [
    busy,
    setBusy] =
    useState(false);

  const frameRef =
    useRef(null);

  const load = useCallback(
    async () => {
      try {
        setLoadError('');

        const rows =
          await getVersionAnnotations(
            version.id,
          );

        setAnnotations(
          rows,
        );
      } catch (loadError) {
        setLoadError(
          loadError.message ||
            'Comments could not be loaded.',
        );
      }
    },
    [
      version.id,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      if (!storagePath) {
        setPreviewError(
          'Preview is not available for this file yet.',
        );

        return;
      }

      try {
        const {
          data,
          error,
        } =
          await supabase.storage
            .from(
              'project-references',
            )
            .createSignedUrl(
              storagePath,
              600,
            );

        if (error) {
          throw error;
        }

        if (
          !cancelled
        ) {
          setPreviewUrl(
            data.signedUrl,
          );
        }
      } catch {
        if (
          !cancelled
        ) {
          setPreviewError(
            'Preview could not be prepared. Download still works.',
          );
        }
      }
    }

    prepare();
    load();

    return () => {
      cancelled = true;
    };
  }, [
    storagePath,
    load,
  ]);

  const placePin = (
    event,
  ) => {
    if (
      readOnly ||
      !frameRef.current
    ) {
      return;
    }

    const rect =
      frameRef.current.getBoundingClientRect();

    const x =
      ((event.clientX -
        rect.left) /
        rect.width) *
      100;

    const y =
      ((event.clientY -
        rect.top) /
        rect.height) *
      100;

    setDraft({
      x: Math.round(
        x * 10,
      ) / 10,
      y: Math.round(
        y * 10,
      ) / 10,
    });
    setComment('');
  };

  const submitAnnotation = async (
    event,
  ) => {
    event.preventDefault();

    if (
      !comment.trim()
    ) {
      toast.error(
        'Write your comment first.',
      );

      return;
    }

    try {
      setBusy(
        true,
      );

      await runClientProjectAction({
        action:
          'annotation_save',
        version_id:
          version.id,
        body:
          comment.trim(),
        x: draft?.x ?? null,
        y: draft?.y ?? null,
        page:
          page.trim() ||
          null,
        video_timestamp_seconds:
          timestamp.trim() ||
          null,
        parent_id: null,
      });

      toast.success(
        'Comment pinned.',
      );
      setDraft(
        null,
      );
      setComment('');
      setPage('');
      setTimestamp('');
      await load();
      await onChanged?.();
    } catch (saveError) {
      toast.error(
        saveError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const submitReply = async (
    event,
    parentId,
  ) => {
    event.preventDefault();

    if (
      !replyBody.trim()
    ) {
      return;
    }

    try {
      setBusy(
        true,
      );

      await runClientProjectAction({
        action:
          'annotation_save',
        version_id:
          version.id,
        body:
          replyBody.trim(),
        parent_id:
          parentId,
      });

      setReplyTo(
        null,
      );
      setReplyBody(
        '',
      );
      await load();
    } catch (replyError) {
      toast.error(
        replyError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const reopen = async (
    id,
  ) => {
    try {
      setBusy(
        true,
      );

      await runClientProjectAction({
        action:
          'annotation_reopen',
        id,
      });

      toast.success(
        'Thread reopened.',
      );
      await load();
    } catch (reopenError) {
      toast.error(
        reopenError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const roots = annotations.filter(
    (
      annotation,
    ) => !annotation.parent_id,
  );

  const repliesFor = (
    id,
  ) =>
    annotations.filter(
      (
        annotation,
      ) =>
        annotation.parent_id ===
        id,
    );

  return (
    <div className="posho-proofing">
      {!readOnly && (
        <p className="admin-card-description">
          Tap the preview to place a pin,
          then write your comment. Pins
          store percentages, so they
          survive resizing.
        </p>
      )}

      {readOnly && (
        <p className="admin-card-description">
          This version is approved and
          read-only. New feedback needs a
          revision, change request, or new
          request.
        </p>
      )}

      {previewError ? (
        <p
          className="admin-card-description"
          role="alert"
        >
          {previewError}
        </p>
      ) : previewUrl ? (
        <div
          ref={
            frameRef
          }
          className={`posho-proof-frame${readOnly ? '' : ' posho-proof-frame-active'}`}
          onClick={
            placePin
          }
          role={
            readOnly
              ? undefined
              : 'button'
          }
          tabIndex={
            readOnly
              ? undefined
              : 0
          }
          aria-label={
            readOnly
              ? 'Deliverable preview'
              : 'Place a comment pin on the preview'
          }
          onKeyDown={(
            event,
          ) => {
            if (
              !readOnly &&
              (
                event.key ===
                  'Enter' ||
                event.key ===
                  ' '
              )
            ) {
              event.preventDefault();
              setDraft({
                x: 50,
                y: 50,
              });
              setComment(
                '',
              );
            }
          }}
        >
          {isPdf ? (
            <iframe
              title="PDF preview"
              src={
                previewUrl
              }
              className="posho-proof-pdf"
            />
          ) : (
            <img
              src={
                previewUrl
              }
              alt="Deliverable preview"
              className="posho-proof-image"
            />
          )}

          {roots
            .filter(
              (
                annotation,
              ) =>
                annotation.x !==
                  null &&
                annotation.status !==
                  'resolved',
            )
            .map(
              (
                annotation,
              ) => (
                <span
                  key={
                    annotation.id
                  }
                  className={`posho-proof-pin posho-proof-pin-${annotation.status}`}
                  style={{
                    left: `${annotation.x}%`,
                    top: `${annotation.y}%`,
                  }}
                  aria-hidden="true"
                >
                  •
                </span>
              ),
            )}

          {draft && (
            <span
              className="posho-proof-pin posho-proof-pin-draft"
              style={{
                left: `${draft.x}%`,
                top: `${draft.y}%`,
              }}
              aria-hidden="true"
            >
              •
            </span>
          )}
        </div>
      ) : (
        <p className="admin-card-description">
          Preparing preview…
        </p>
      )}

      {draft && !readOnly && (
        <form
          onSubmit={
            submitAnnotation
          }
          className="posho-form-grid"
          style={{
            marginTop: 12,
          }}
        >
          <p className="admin-card-description">
            Pin at {draft.x}%, {draft.y}%
            —{' '}
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                setDraft(
                  null,
                )
              }
            >
              <Icon name="close"                 size={14}
              />{' '}
              Remove pin
            </button>
          </p>

          <label>
            <span>
              Comment
            </span>

            <textarea
              value={
                comment
              }
              onChange={(
                event,
              ) =>
                setComment(
                  event.target
                    .value,
                )
              }
              maxLength={2000}
              required
              placeholder="The logo needs more breathing room here…"
            />
          </label>

          {isPdf && (
            <label>
              <span>
                PDF page
              </span>

              <input
                type="number"
                min="1"
                step="1"
                value={
                  page
                }
                onChange={(
                  event,
                ) =>
                  setPage(
                    event.target
                      .value,
                  )
                }
                placeholder="3"
              />
            </label>
          )}

          <label>
            <span>
              Video time (seconds,
              if reviewing video)
            </span>

            <input
              type="number"
              min="0"
              step="1"
              value={
                timestamp
              }
              onChange={(
                event,
              ) =>
                setTimestamp(
                  event.target
                    .value,
                )
              }
              placeholder="84 for 01:24"
            />
          </label>

          <button
            type="submit"
            className="button button-primary"
            disabled={
              busy
            }
            aria-busy={
              busy
            }
          >
            {busy
              ? 'Saving…'
              : 'Save comment'}
          </button>
        </form>
      )}

      <div
        style={{
          marginTop: 16,
        }}
      >
        <span className="posho-section-label">
          Threads ({roots.length})
        </span>

        {loadError ? (
          <ErrorBlock
            message={
              loadError
            }
            onRetry={
              load
            }
          />
        ) : roots.length ===
          0 ? (
          <p className="admin-card-description">
            No pinned comments yet.
          </p>
        ) : (
          <div className="posho-timeline">
            {roots.map(
              (
                annotation,
              ) => (
                <div
                  key={
                    annotation.id
                  }
                  className="posho-timeline-item"
                >
                  <span
                    className="posho-timeline-dot"
                    aria-hidden="true"
                  />

                  <div className="posho-timeline-body">
                    <strong>
                      {threadLabel(
                        annotation,
                      ) ||
                        'General comment'}{' '}
                      ·{' '}
                      {
                        annotation.author_kind
                      }
                    </strong>

                    <p>
                      {
                        annotation.body
                      }
                    </p>

                    <time>
                      {formatDateTime(
                        annotation.created_at,
                      )}{' '}
                      ·{' '}
                      <StatusBadge
                        value={
                          annotation.status
                        }
                      />
                    </time>

                    {repliesFor(
                      annotation.id,
                    ).map(
                      (
                        reply,
                      ) => (
                        <div
                          key={
                            reply.id
                          }
                          style={{
                            marginTop: 8,
                            paddingLeft: 12,
                            borderLeft:
                              '2px solid var(--posho-line)',
                          }}
                        >
                          <strong>
                            {
                              reply.author_kind
                            }
                          </strong>

                          <p>
                            {
                              reply.body
                            }
                          </p>

                          <time>
                            {formatDateTime(
                              reply.created_at,
                            )}
                          </time>
                        </div>
                      ),
                    )}

                    {!readOnly && (
                      <div
                        className="finance-review-actions"
                        style={{
                          marginTop: 8,
                        }}
                      >
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => {
                            setReplyTo(
                              replyTo ===
                              annotation.id
                                ? null
                                : annotation.id,
                            );
                            setReplyBody(
                              '',
                            );
                          }}
                        >
                          <Icon name="chat"                             size={14}
                          />
                          Reply
                        </button>

                        {annotation.status ===
                          'resolved' && (
                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              reopen(
                                annotation.id,
                              )
                            }
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    )}

                    {replyTo ===
                      annotation.id && (
                      <form
                        onSubmit={(
                          event,
                        ) =>
                          submitReply(
                            event,
                            annotation.id,
                          )
                        }
                        className="posho-form-grid"
                        style={{
                          marginTop: 8,
                        }}
                      >
                        <label>
                          <span>
                            Reply
                          </span>

                          <input
                            value={
                              replyBody
                            }
                            onChange={(
                              event,
                            ) =>
                              setReplyBody(
                                event
                                  .target
                                  .value,
                              )
                            }
                            maxLength={2000}
                            required
                          />
                        </label>

                        <button
                          type="submit"
                          className="button button-secondary"
                          disabled={
                            busy
                          }
                        >
                          Send reply
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
