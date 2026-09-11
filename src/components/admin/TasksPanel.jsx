import {
  useEffect,
  useState,
} from 'react';


import Icon from '../ui/Icon';
import {
  useToast,
} from '../ui/Toast';

import {
  EmptyState,
  ErrorBlock,
} from '../ui/StateBlocks';

import StatusBadge from '../ui/StatusBadge';

import {
  useEscapeClose,
} from '../ui/useEscapeClose';

import {
  deleteTask,
  saveTask,
} from '../../lib/projectWork';

import {
  getTeamMembers,
  runOperationsAction,
} from '../../lib/operations';

import {
  runAdminOrderAction,
} from '../../lib/admin';

const TASK_STATUSES = [
  'backlog',
  'ready',
  'open',
  'in_progress',
  'in_review',
  'blocked',
  'waiting_on_client',
  'done',
  'cancelled',
];

const PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent',
];

const emptyForm = {
  taskId: '',
  title: '',
  description: '',
  milestoneId: '',
  status: 'open',
  priority: 'normal',
  estimate_minutes: '',
  assignee_id: '',
  due_at: '',
  clientVisible: false,
};

function formatMinutes(
  minutes,
) {
  const total =
    Math.round(
      Number(
        minutes ||
          0,
      ),
    );

  if (
    total <
    60
  ) {
    return `${total}m`;
  }

  const hours =
    Math.floor(
      total /
        60,
    );

  const rest =
    total %
    60;

  return rest
    ? `${hours}h ${rest}m`
    : `${hours}h`;
}

export default function TasksPanel({
  order,
  work,
  onChanged,
}) {
  const toast =
    useToast();

  const [
    formOpen,
    setFormOpen,
  ] =
    useState(false);

  const [
    busy,
    setBusy] =
    useState(false);

  const [
    form,
    setForm] =
    useState(
      emptyForm,
    );

  const [
    deleteTarget,
    setDeleteTarget,
  ] =
    useState(null);

  const [
    members,
    setMembers,
  ] =
    useState([]);

  const [
    dependencies,
    setDependencies,
  ] =
    useState([]);

  const [
    timeByTask,
    setTimeByTask,
  ] =
    useState(
      new Map(),
    );

  const [
    expanded,
    setExpanded,
  ] =
    useState(null);

  const [
    depCandidate,
    setDepCandidate,
  ] =
    useState('');

  const [
    timeMinutes,
    setTimeMinutes,
  ] =
    useState('');

  useEscapeClose(
    formOpen &&
      !busy,
    () =>
      setFormOpen(
        false,
      ),
  );

  useEscapeClose(
    Boolean(
      deleteTarget,
    ) && !busy,
    () =>
      setDeleteTarget(
        null,
      ),
  );

  const tasks =
    work?.tasks || [];

  const milestones =
    work?.milestones || [];

  const loadError =
    work?.loadErrors
      ?.tasks;

  useEffect(() => {
    getTeamMembers()
      .then(
        setMembers,
      )
      .catch(
        () => {},
      );
  }, []);

  useEffect(() => {
    if (
      !expanded
    ) {
      return;
    }

    Promise.all([
      import(
        '../../lib/supabase'
      ).then(
        async ({
          supabase,
        }) => {
          const [
            deps,
            time,
          ] =
            await Promise.all([
              supabase
                .from(
                  'task_dependencies',
                )
                .select(
                  'depends_on_task_id',
                )
                .eq(
                  'task_id',
                  expanded,
                )
                .then(
                  (
                    result,
                  ) =>
                    result.data ||
                    [],
                  () => [],
                ),
              supabase
                .from(
                  'time_entries',
                )
                .select(
                  'minutes',
                )
                .eq(
                  'task_id',
                  expanded,
                )
                .then(
                  (
                    result,
                  ) =>
                    result.data ||
                    [],
                  () => [],
                ),
            ]);

          setDependencies(
            deps.map(
              (
                dep,
              ) =>
                dep.depends_on_task_id,
            ),
          );
          setTimeByTask(
            new Map([
              [
                expanded,
                time.reduce(
                  (
                    sum,
                    entry,
                  ) =>
                    sum +
                    Number(
                      entry.minutes ||
                        0,
                    ),
                  0,
                ),
              ],
            ]),
          );
        },
      ),
    ]).catch(
      () => {},
    );
  }, [
    expanded,
    work,
  ]);

  const set = (
    field,
    value,
  ) =>
    setForm(
      (
        current,
      ) => ({
        ...current,
        [field]:
          value,
      }),
    );

  const milestoneTitle = (
    id,
  ) =>
    milestones.find(
      (
        milestone,
      ) =>
        milestone.id ===
        id,
    )?.title ||
    'No milestone';

  const assigneeName = (
    id,
  ) =>
    members.find(
      (
        member,
      ) =>
        member.id ===
        id,
    )?.display_name ||
    'Unassigned';

  const openNew = () => {
    setForm(
      emptyForm,
    );
    setFormOpen(
      true,
    );
  };

  const openEdit = (
    task,
  ) => {
    setForm({
      taskId:
        task.id,
      title:
        task.title ||
        '',
      description:
        task.description ||
        '',
      milestoneId:
        task.milestone_id ||
        '',
      status:
        task.status ||
        'open',
      priority:
        task.priority ||
        'normal',
      estimate_minutes:
        task.estimate_minutes ??
        '',
      assignee_id:
        task.assignee_id ||
        '',
      due_at:
        task.due_at ||
        '',
      clientVisible:
        task.client_visible ===
        true,
    });
    setFormOpen(
      true,
    );
  };

  const submit = async (
    event,
  ) => {
    event.preventDefault();

    if (
      !form.title.trim()
    ) {
      toast.error(
        'Describe the task before saving.',
      );

      return;
    }

    try {
      setBusy(
        true,
      );

      await saveTask({
        orderId:
          order.id,
        task: {
          taskId:
            form.taskId ||
            undefined,
          title:
            form.title.trim(),
          description:
            form.description.trim(),
          milestoneId:
            form.milestoneId ||
            null,
          status:
            form.status,
          priority:
            form.priority,
          estimate_minutes:
            form.estimate_minutes ===
              '' ||
            form.estimate_minutes ===
              null
              ? null
              : Math.round(
                  Number(
                    form.estimate_minutes,
                  ),
                ),
          assignee_id:
            form.assignee_id ||
            null,
          dueAt:
            form.due_at ||
            null,
          clientVisible:
            form.clientVisible,
        },
      });
      toast.success(
        form.taskId
          ? 'Task updated.'
          : 'Task added.',
      );
      setFormOpen(
        false,
      );
      setForm(
        emptyForm,
      );
      await onChanged?.();
    } catch (error) {
      toast.error(
        error.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const setStatus = async (
    task,
    status,
  ) => {
    try {
      setBusy(
        true,
      );

      await saveTask({
        orderId:
          order.id,
        task: {
          taskId:
            task.id,
          title:
            task.title,
          description:
            task.description,
          milestoneId:
            task.milestone_id ||
            null,
          status,
          priority:
            task.priority ||
            'normal',
          estimate_minutes:
            task.estimate_minutes,
          assignee_id:
            task.assignee_id,
          dueAt:
            task.due_at,
          clientVisible:
            task.client_visible ===
            true,
        },
      });
      toast.success(
        `Task marked as ${status.replaceAll('_', ' ')}.`,
      );
      await onChanged?.();
    } catch (error) {
      toast.error(
        error.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const confirmDelete =
    async () => {
      if (
        !deleteTarget
      ) {
        return;
      }

      try {
        setBusy(
          true,
        );

        await deleteTask({
          orderId:
            order.id,
          taskId:
            deleteTarget.id,
        });
        toast.success(
          'Task removed.',
        );
        setDeleteTarget(
          null,
        );
        await onChanged?.();
      } catch (error) {
        toast.error(
          error.message,
        );
      } finally {
        setBusy(
          false,
        );
      }
    };

  const addDependency =
    async (
      taskId,
    ) => {
      if (
        !depCandidate
      ) {
        return;
      }

      try {
        setBusy(
          true,
        );

        await runAdminOrderAction({
          orderId:
            order.id,
          action:
            'task_depends_add',
          taskId,
          dependsOnTaskId:
            depCandidate,
        });

        toast.success(
          'Dependency recorded. The task cannot begin until it completes.',
        );
        setDepCandidate(
          '',
        );
        setExpanded(
          null,
        );
        await onChanged?.();
      } catch (error) {
        toast.error(
          error.message,
        );
      } finally {
        setBusy(
          false,
        );
      }
    };

  const logTime = async (
    task,
  ) => {
    const minutes =
      Math.round(
        Number(
          timeMinutes ||
            0,
        ),
      );

    if (
      !Number.isFinite(
        minutes,
      ) ||
      minutes <= 0
    ) {
      toast.error(
        'Enter minutes above zero.',
      );

      return;
    }

    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'time_save',
        order_id:
          order.id,
        task_id:
          task.id,
        entry_date:
          new Date()
            .toISOString()
            .slice(
              0,
              10,
            ),
        minutes,
        billable: true,
        description: `Tracked from ${order.reference}`,
      });

      toast.success(
        'Time recorded.',
      );
      setTimeMinutes(
        '',
      );
      await onChanged?.();
    } catch (error) {
      toast.error(
        error.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const openTasks = tasks.filter(
    (
      task,
    ) =>
      task.status !==
        'done' &&
      task.status !==
        'cancelled',
  );

  const doneTasks = tasks.filter(
    (
      task,
    ) =>
      task.status ===
        'done' ||
      task.status ===
        'cancelled',
  );

  const renderTask = (
    task,
  ) => {
    const actual =
      timeByTask.get(
        task.id,
      );

    const estimate =
      Number(
        task.estimate_minutes ||
          0,
      );

    return (
      <article
        key={
          task.id
        }
        className="posho-ledger-item"
      >
        <header>
          <strong className="posho-long-value">
            {
              task.title
            }
          </strong>

          <StatusBadge
            value={
              task.status
            }
          />
        </header>

        <p>
          {milestoneTitle(
            task.milestone_id,
          )}
          {task.client_visible
            ? ' · Visible to client'
            : ' · Internal'}{' '}
          ·{' '}
          {prettyPriority(
            task.priority,
          )}
          {' · '}
          {assigneeName(
            task.assignee_id,
          )}
        </p>

        {task.description && (
          <p>
            {
              task.description
            }
          </p>
        )}

        {(estimate > 0 ||
          actual > 0) && (
          <p>
            Estimated{' '}
            {estimate > 0
              ? formatMinutes(
                  estimate,
                )
              : '—'}{' '}
            · Tracked{' '}
            {formatMinutes(
              actual ||
                0,
            )}
            {estimate > 0 &&
            (actual ||
              0) >
              estimate ? (
              <strong className="posho-text-danger">
                {' '}
                · Over estimate
              </strong>
            ) : null}
          </p>
        )}

        <div className="finance-review-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              setExpanded(
                expanded ===
                task.id
                  ? null
                  : task.id,
              )
            }
          >
            {expanded ===
            task.id
              ? 'Hide details'
              : 'Details'}
          </button>

          {task.status !==
            'done' && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                setStatus(
                  task,
                  'done',
                )
              }
              disabled={
                busy
              }
            >
              Mark done
            </button>
          )}

          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              openEdit(
                task,
              )
            }
          >
            <Icon name="edit"               size={15}
            />{' '}
            Edit
          </button>

          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              setDeleteTarget(
                task,
              )
            }
          >
            <Icon name="delete"               size={15}
            />{' '}
            Remove
          </button>
        </div>

        {expanded ===
          task.id && (
          <div
            style={{
              marginTop: 12,
              display:
                'grid',
              gap: 12,
            }}
          >
            <div>
              <span className="posho-section-label">
                Blocked by
              </span>

              {dependencies.length ===
              0 ? (
                <p className="admin-card-description">
                  No dependencies.
                </p>
              ) : (
                <ul>
                  {dependencies.map(
                    (
                      depId,
                    ) => (
                      <li
                        key={
                          depId
                        }
                      >
                        {tasks.find(
                          (
                            candidate,
                          ) =>
                            candidate.id ===
                            depId,
                        )?.title ||
                          'Another task'}
                      </li>
                    ),
                  )}
                </ul>
              )}

              <div
                className="finance-review-actions"
                style={{
                  marginTop: 8,
                }}
              >
                <select
                  value={
                    depCandidate
                  }
                  onChange={(
                    event,
                  ) =>
                    setDepCandidate(
                      event.target
                        .value,
                    )
                  }
                  aria-label="Task this depends on"
                >
                  <option value="">
                    Depends on…
                  </option>

                  {tasks
                    .filter(
                      (
                        candidate,
                      ) =>
                        candidate.id !==
                          task.id &&
                        !dependencies.includes(
                          candidate.id,
                        ),
                    )
                    .map(
                      (
                        candidate,
                      ) => (
                        <option
                          key={
                            candidate.id
                          }
                          value={
                            candidate.id
                          }
                        >
                          {
                            candidate.title
                          }
                        </option>
                      ),
                    )}
                </select>

                <button
                  type="button"
                  className="button button-secondary"
                  disabled={
                    busy ||
                    !depCandidate
                  }
                  onClick={() =>
                    addDependency(
                      task.id,
                    )
                  }
                >
                  <Icon name="link"                     size={15}
                  />
                  Add
                </button>
              </div>
            </div>

            <div>
              <span className="posho-section-label">
                Log time
              </span>

              <div
                className="finance-review-actions"
                style={{
                  marginTop: 8,
                }}
              >
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Minutes"
                  value={
                    timeMinutes
                  }
                  onChange={(
                    event,
                  ) =>
                    setTimeMinutes(
                      event
                        .target
                        .value,
                    )
                  }
                  aria-label="Minutes worked"
                  style={{
                    maxWidth: 140,
                  }}
                />

                <button
                  type="button"
                  className="button button-secondary"
                  disabled={
                    busy
                  }
                  onClick={() =>
                    logTime(
                      task,
                    )
                  }
                >
                  <Icon name="timer"                     size={15}
                  />
                  Log
                </button>
              </div>
            </div>
          </div>
        )}
      </article>
    );
  };

  function prettyPriority(
    value,
  ) {
    return String(
      value ||
        'normal',
    );
  }

  return (
    <section className="admin-control-card">
      <div className="finance-request-heading">
        <div>
          <span>
            EXECUTION
          </span>

          <h3>
            Tasks
          </h3>

          <p className="admin-card-description">
            Assignees, priorities, estimates
            and dependencies. Internal work
            stays private unless marked
            client-visible.
          </p>
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={
            openNew
          }
        >
          <Icon name="add_circle"             size={17}
          />{' '}
          Add task
        </button>
      </div>

      {loadError ? (
        <ErrorBlock
          message={`Tasks could not be loaded. ${loadError}`}
          onRetry={
            onChanged
          }
        />
      ) : tasks.length ===
        0 ? (
        <EmptyState
          title="No tasks yet"
          body="Track the internal and client-visible steps for this project."
        />
      ) : (
        <>
          <div className="posho-ledger">
            {openTasks.map(
              renderTask,
            )}
          </div>

          {doneTasks.length >
            0 && (
            <details
              style={{
                marginTop: 12,
              }}
            >
              <summary>
                Completed (
                {
                  doneTasks.length
                })
              </summary>

              <div
                className="posho-ledger"
                style={{
                  marginTop: 10,
                }}
              >
                {doneTasks.map(
                  renderTask,
                )}
              </div>
            </details>
          )}
        </>
      )}

      {formOpen && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setFormOpen(
              false,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label={
              form.taskId
                ? 'Edit task'
                : 'Add task'
            }
            className="posho-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              submit
            }
          >
            <div className="posho-modal-heading">
              <h3>
                {form.taskId
                  ? 'Edit task'
                  : 'Add task'}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setFormOpen(
                    false,
                  )
                }
                aria-label="Close"
                disabled={
                  busy
                }
              >
                <Icon name="close"                   size={19}
                />
              </button>
            </div>

            <div className="posho-form-grid">
              <label>
                Task
                <input
                  value={
                    form.title
                  }
                  maxLength={200}
                  onChange={(
                    e,
                  ) =>
                    set(
                      'title',
                      e.target
                        .value,
                    )
                  }
                  placeholder="Prepare homepage draft"
                  required
                />
              </label>

              <label>
                Description
                <textarea
                  value={
                    form.description
                  }
                  maxLength={5000}
                  onChange={(
                    e,
                  ) =>
                    set(
                      'description',
                      e.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                Milestone
                <select
                  value={
                    form.milestoneId
                  }
                  onChange={(
                    e,
                  ) =>
                    set(
                      'milestoneId',
                      e.target
                        .value,
                    )
                  }
                >
                  <option value="">
                    No milestone
                  </option>

                  {milestones.map(
                    (
                      milestone,
                    ) => (
                      <option
                        key={
                          milestone.id
                        }
                        value={
                          milestone.id
                        }
                      >
                        {
                          milestone.title
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Status
                <select
                  value={
                    form.status
                  }
                  onChange={(
                    e,
                  ) =>
                    set(
                      'status',
                      e.target
                        .value,
                    )
                  }
                >
                  {TASK_STATUSES.map(
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
                        {status.replaceAll(
                          '_',
                          ' ',
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Priority
                <select
                  value={
                    form.priority
                  }
                  onChange={(
                    e,
                  ) =>
                    set(
                      'priority',
                      e.target
                        .value,
                    )
                  }
                >
                  {PRIORITIES.map(
                    (
                      priority,
                    ) => (
                      <option
                        key={
                          priority
                        }
                        value={
                          priority
                        }
                      >
                        {
                          priority
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Assignee
                <select
                  value={
                    form.assignee_id
                  }
                  onChange={(
                    e,
                  ) =>
                    set(
                      'assignee_id',
                      e.target
                        .value,
                    )
                  }
                >
                  <option value="">
                    Unassigned
                  </option>

                  {members.map(
                    (
                      member,
                    ) => (
                      <option
                        key={
                          member.id
                        }
                        value={
                          member.id
                        }
                      >
                        {
                          member.display_name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Estimate (minutes)
                <input
                  type="number"
                  min="0"
                  step="15"
                  value={
                    form.estimate_minutes
                  }
                  onChange={(
                    e,
                  ) =>
                    set(
                      'estimate_minutes',
                      e.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                Due date
                <input
                  type="date"
                  value={
                    form.due_at
                  }
                  onChange={(
                    e,
                  ) =>
                    set(
                      'due_at',
                      e.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="finance-checkbox-row">
                <input
                  type="checkbox"
                  checked={
                    form.clientVisible
                  }
                  onChange={(
                    e,
                  ) =>
                    set(
                      'clientVisible',
                      e.target
                        .checked,
                    )
                  }
                />

                <span>
                  Visible to client
                  (client action or
                  shared step)
                </span>
              </label>
            </div>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setFormOpen(
                    false,
                  )
                }
                disabled={
                  busy
                }
              >
                Cancel
              </button>

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
                  : 'Save task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setDeleteTarget(
              null,
            )
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Remove task"
            className="posho-modal"
            onClick={(
              e,
            ) =>
              e.stopPropagation()
            }
          >
            <div className="posho-modal-heading">
              <h3>
                Remove task
              </h3>

              <button
                type="button"
                onClick={() =>
                  setDeleteTarget(
                    null,
                  )
                }
                aria-label="Close"
                disabled={
                  busy
                }
              >
                <Icon name="close"                   size={19}
                />
              </button>
            </div>

            <p className="posho-modal-description">
              Remove “
              {
                deleteTarget.title
              }
              ” from this project?
            </p>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setDeleteTarget(
                    null,
                  )
                }
                disabled={
                  busy
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="posho-button-danger"
                onClick={
                  confirmDelete
                }
                disabled={
                  busy
                }
                aria-busy={
                  busy
                }
              >
                {busy
                  ? 'Removing…'
                  : 'Remove task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
