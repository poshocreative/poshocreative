import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link2,
  Plus,
  Search,
  Timer,
  X,
} from 'lucide-react';

import BrandLoader from '../components/BrandLoader';
import PageHeader from '../components/ui/PageHeader';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import Tabs from '../components/ui/Tabs';
import {
  EmptyState,
  ErrorBlock,
} from '../components/ui/StateBlocks';

import {
  useToast,
} from '../components/ui/Toast';

import {
  useEscapeClose,
} from '../components/ui/useEscapeClose';

import {
  getMyMembership,
} from '../lib/permissions';

import {
  getAdminOrders,
} from '../lib/admin';

import {
  getTeam,
  runOperationsAction,
} from '../lib/operations';

import {
  runAdminOrderAction,
} from '../lib/admin';

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

const KANBAN_COLUMNS = [
  'ready',
  'in_progress',
  'in_review',
  'blocked',
  'done',
];

const PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent',
];

function pretty(
  value,
) {
  return String(
    value ||
      '',
  ).replaceAll(
    '_',
    ' ',
  );
}

function isOverdue(
  task,
) {
  if (
    !task.due_at
  ) {
    return false;
  }

  return (
    task.due_at <
      new Date()
        .toISOString()
        .slice(
          0,
          10,
        ) &&
    ![
      'done',
      'cancelled',
    ].includes(
      task.status,
    )
  );
}

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

export default function AdminWork() {
  const toast =
    useToast();

  const [
    view,
    setView,
  ] =
    useState(
      'board',
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    tasks,
    setTasks,
  ] =
    useState([]);

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
    timeEntries,
    setTimeEntries,
  ] =
    useState([]);

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState('active');

  const [
    assigneeFilter,
    setAssigneeFilter,
  ] =
    useState('all');

  const [
    priorityFilter,
    setPriorityFilter,
  ] =
    useState('all');

  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    selected,
    setSelected,
  ] =
    useState([]);

  const [
    detail,
    setDetail,
  ] =
    useState(null);

  const [
    taskForm,
    setTaskForm,
  ] =
    useState(null);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    batchBusy,
    setBatchBusy,
  ] =
    useState(false);

  const [
    timeForm,
    setTimeForm,
  ] =
    useState(null);

  const [
    myMemberId,
    setMyMemberId,
  ] =
    useState('');

  const [
    projects,
    setProjects,
  ] =
    useState([]);

  const [
    depCandidate,
    setDepCandidate,
  ] =
    useState('');

  useEscapeClose(
    Boolean(
      detail,
    ) && !busy,
    () =>
      setDetail(
        null,
      ),
  );

  useEscapeClose(
    Boolean(
      taskForm,
    ) && !busy,
    () =>
      setTaskForm(
        null,
      ),
  );

  useEscapeClose(
    Boolean(
      timeForm,
    ) && !busy,
    () =>
      setTimeForm(
        null,
      ),
  );

  const load =
    useCallback(
      async () => {
        try {
          setError('');
          setLoading(
            true,
          );

          const team =
            await getTeam();

          setTasks(
            team.tasks,
          );
          setMembers(
            team.members,
          );
          setDependencies(
            team.dependencies ||
              [],
          );
          setTimeEntries(
            team.timeEntries,
          );
        } catch (loadError) {
          setError(
            loadError.message ||
              'Work data could not be loaded.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    document.title =
      'Work | Posho Creative Management';

    load();

    getAdminOrders()
      .then((rows) =>
        setProjects(
          (rows || []).filter(
            (order) =>
              !order.archived_at &&
              !['completed', 'cancelled'].includes(
                order.status,
              ),
          ),
        ),
      )
      .catch(() => {});

    getMyMembership()
      .then(
        (
          membership,
        ) => {
          if (
            membership.member
          ) {
            setMyMemberId(
              membership.member
                .id,
            );
          }
        },
      )
      .catch(
        () => {},
      );
  }, [
    load,
  ]);

  const timeByTask =
    useMemo(() => {
      const map =
        new Map();

      for (const entry of timeEntries) {
        if (
          !entry.task_id
        ) {
          continue;
        }

        map.set(
          entry.task_id,
          (map.get(
            entry.task_id,
          ) || 0) +
            Number(
              entry.minutes ||
                0,
            ),
        );
      }

      return map;
    }, [
      timeEntries,
    ]);

  const blockedBy =
    useMemo(() => {
      const map =
        new Map();

      for (const dep of dependencies) {
        if (
          !map.has(
            dep.task_id,
          )
        ) {
          map.set(
            dep.task_id,
            [],
          );
        }

        map
          .get(
            dep.task_id,
          )
          .push(
            dep.depends_on_task_id,
          );
      }

      return map;
    }, [
      dependencies,
    ]);

  const tasksById =
    useMemo(() => {
      const map =
        new Map();

      for (const task of tasks) {
        map.set(
          task.id,
          task,
        );
      }

      return map;
    }, [
      tasks,
    ]);

  const isBlocked = useCallback(
    (
      task,
    ) => {
      if (
        task.status ===
        'blocked'
      ) {
        return true;
      }

      const deps =
        blockedBy.get(
          task.id,
        ) || [];

      return deps.some(
        (
          depId,
        ) => {
          const dep =
            tasksById.get(
              depId,
            );

          return (
            dep &&
            ![
              'done',
              'cancelled',
            ].includes(
              dep.status,
            )
          );
        },
      );
    },
    [
      blockedBy,
      tasksById,
    ],
  );

  const filtered =
    useMemo(() => {
      const needle =
        query
          .trim()
          .toLowerCase();

      return tasks.filter(
        (
          task,
        ) => {
          if (
            statusFilter ===
            'active'
          ) {
            if (
              [
                'done',
                'cancelled',
              ].includes(
                task.status,
              )
            ) {
              return false;
            }
          } else if (
            statusFilter ===
            'blocked'
          ) {
            if (
              !isBlocked(
                task,
              )
            ) {
              return false;
            }
          } else if (
            statusFilter ===
            'overdue'
          ) {
            if (
              !isOverdue(
                task,
              )
            ) {
              return false;
            }
          } else if (
            statusFilter !==
              'all' &&
            task.status !==
              statusFilter
          ) {
            return false;
          }

          if (
            assigneeFilter ===
            'unassigned'
          ) {
            if (
              task.assignee_id
            ) {
              return false;
            }
          } else if (
            assigneeFilter ===
            'mine'
          ) {
            if (
              !myMemberId ||
              task.assignee_id !==
                myMemberId
            ) {
              return false;
            }
          } else if (
            assigneeFilter !==
              'all' &&
            task.assignee_id !==
              assigneeFilter
          ) {
            return false;
          }

          if (
            priorityFilter !==
              'all' &&
            (
              task.priority ||
              'normal'
            ) !==
              priorityFilter
          ) {
            return false;
          }

          if (
            needle &&
            ![
              task.title,
              task.order
                ?.reference,
              task.order
                ?.project_title,
              task.milestone
                ?.title,
            ]
              .filter(
                Boolean,
              )
              .join(
                ' ',
              )
              .toLowerCase()
              .includes(
                needle,
              )
          ) {
            return false;
          }

          return true;
        },
      );
    }, [
      tasks,
      statusFilter,
      assigneeFilter,
      priorityFilter,
      query,
      isBlocked,
      myMemberId,
    ]);

  const metrics =
    useMemo(() => {
      const active = tasks.filter(
        (
          task,
        ) =>
          ![
            'done',
            'cancelled',
          ].includes(
            task.status,
          ),
      );

      return {
        active:
          active.length,
        blocked: tasks.filter(
          (
            task,
          ) =>
            isBlocked(
              task,
            ),
        ).length,
        overdue:
          tasks.filter(
            isOverdue,
          ).length,
        waiting:
          tasks.filter(
            (
              task,
            ) =>
              task.status ===
              'waiting_on_client',
          ).length,
      };
    }, [
      tasks,
      isBlocked,
    ]);

  const toggleSelect = (
    id,
  ) => {
    setSelected(
      (
        current,
      ) =>
        current.includes(
          id,
        )
          ? current.filter(
              (
                item,
              ) =>
                item !==
                id,
            )
          : [
              ...current,
              id,
            ],
    );
  };

  const batchUpdate = async (
    patch,
    label,
  ) => {
    if (
      selected.length ===
      0
    ) {
      return;
    }

    try {
      setBatchBusy(
        true,
      );

      for (const id of selected) {
        const task =
          tasksById.get(
            id,
          );

        if (!task) {
          continue;
        }

        await runAdminOrderAction({
          orderId:
            task.order_id,
          action:
            'save_task',
          taskId: id,
          title:
            task.title,
          milestoneId:
            task.milestone_id,
          status:
            patch.status ||
            task.status,
          priority:
            patch.priority ||
            task.priority ||
            'normal',
          estimate_minutes:
            task.estimate_minutes,
          assignee_id:
            patch.assignee_id !==
            undefined
              ? patch.assignee_id
              : task.assignee_id,
          description:
            task.description,
          clientVisible:
            task.client_visible,
          dueAt:
            task.due_at,
        });
      }

      toast.success(
        `${selected.length} task${selected.length === 1 ? '' : 's'} ${label}.`,
      );
      setSelected(
        [],
      );
      await load();
    } catch (batchError) {
      toast.error(
        batchError.message,
      );
    } finally {
      setBatchBusy(
        false,
      );
    }
  };

  const saveTaskForm = async (
    event,
  ) => {
    event.preventDefault();

    if (
      !taskForm.title.trim() ||
      !taskForm.order_id
    ) {
      toast.error(
        'Project and title are required.',
      );

      return;
    }

    try {
      setBusy(
        true,
      );

      await runAdminOrderAction({
        orderId:
          taskForm.order_id,
        action:
          'save_task',
        taskId:
          taskForm.id ||
          undefined,
        title:
          taskForm.title.trim(),
        milestoneId:
          taskForm.milestone_id ||
          null,
        status:
          taskForm.status,
        priority:
          taskForm.priority,
        estimate_minutes:
          taskForm.estimate_minutes ===
            '' ||
          taskForm.estimate_minutes ===
            null
            ? null
            : Math.round(
                Number(
                  taskForm.estimate_minutes,
                ),
              ),
        assignee_id:
          taskForm.assignee_id ||
          null,
        description:
          taskForm.description.trim(),
        clientVisible:
          taskForm.client_visible,
        dueAt:
          taskForm.due_at ||
          null,
      });

      toast.success(
        'Task saved.',
      );
      setTaskForm(
        null,
      );
      await load();
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

  const moveTask = async (
    task,
    status,
  ) => {
    try {
      setBusy(
        true,
      );

      if (
        status !==
          'done' &&
        [
          'in_progress',
          'in_review',
        ].includes(
          status,
        )
      ) {
        const deps =
          blockedBy.get(
            task.id,
          ) || [];

        const openDeps =
          deps.filter(
            (
              depId,
            ) => {
              const dep =
                tasksById.get(
                  depId,
                );

              return (
                dep &&
                ![
                  'done',
                  'cancelled',
                ].includes(
                  dep.status,
                )
              );
            },
          );

        if (
          openDeps.length >
          0
        ) {
          toast.error(
            'This task is blocked by unfinished dependencies.',
          );

          return;
        }
      }

      await runAdminOrderAction({
        orderId:
          task.order_id,
        action:
          'save_task',
        taskId:
          task.id,
        title:
          task.title,
        milestoneId:
          task.milestone_id,
        status,
        priority:
          task.priority ||
          'normal',
        estimate_minutes:
          task.estimate_minutes,
        assignee_id:
          task.assignee_id,
        description:
          task.description,
        clientVisible:
          task.client_visible,
        dueAt:
          task.due_at,
      });

      toast.success(
        `Task moved to ${pretty(status)}.`,
      );
      await load();

      if (
        detail?.id ===
        task.id
      ) {
        const updated =
          tasksById.get(
            task.id,
          );

        setDetail(
          updated || {
            ...task,
            status,
          },
        );
      }
    } catch (moveError) {
      toast.error(
        moveError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const addDependency = async () => {
    if (
      !detail ||
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
          detail.order_id,
        action:
          'task_depends_add',
        taskId:
          detail.id,
        dependsOnTaskId:
          depCandidate,
      });

      toast.success(
        'Dependency recorded.',
      );
      setDepCandidate(
        '',
      );
      await load();
    } catch (depError) {
      toast.error(
        depError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const removeDependency = async (
    dependsOn,
  ) => {
    if (!detail) {
      return;
    }

    try {
      setBusy(
        true,
      );

      await runAdminOrderAction({
        orderId:
          detail.order_id,
        action:
          'task_depends_remove',
        taskId:
          detail.id,
        dependsOnTaskId:
          dependsOn,
      });

      await load();
    } catch (depError) {
      toast.error(
        depError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const saveTime = async (
    event,
  ) => {
    event.preventDefault();

    const minutes =
      Math.round(
        Number(
          timeForm.minutes ||
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
          timeForm.order_id,
        task_id:
          timeForm.task_id,
        member_id:
          timeForm.member_id ||
          null,
        entry_date:
          timeForm.entry_date,
        minutes,
        billable:
          timeForm.billable,
        description:
          timeForm.description.trim(),
      });

      toast.success(
        'Time recorded.',
      );
      setTimeForm(
        null,
      );
      await load();
    } catch (timeError) {
      toast.error(
        timeError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  if (loading) {
    return (
      <BrandLoader label="Loading work…" />
    );
  }

  const renderCard = (
    task,
    showProject = true,
  ) => {
    const blocked =
      isBlocked(
        task,
      );

    const actual =
      timeByTask.get(
        task.id,
      ) || 0;

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
        className={`posho-kanban-card${blocked ? ' posho-kanban-blocked' : ''}`}
      >
        <label className="posho-kanban-select">
          <input
            type="checkbox"
            checked={selected.includes(
              task.id,
            )}
            onChange={() =>
              toggleSelect(
                task.id,
              )
            }
            aria-label={`Select ${task.title}`}
          />
        </label>

        <button
          type="button"
          className="posho-kanban-open"
          onClick={() =>
            setDetail(
              task,
            )
          }
        >
          <strong className="posho-long-value">
            {task.title}
          </strong>

          {showProject && (
            <span className="posho-long-value">
              {task.order
                ?.reference ||
                ''}{' '}
              ·{' '}
              {task.order
                ?.project_title ||
                ''}
            </span>
          )}

          <span className="posho-kanban-meta">
            <StatusBadge
              value={
                task.priority ||
                'normal'
              }
            />

            {task.assignee
              ?.display_name && (
              <small>
                {
                  task.assignee
                    .display_name
                }
              </small>
            )}

            {task.due_at && (
              <small
                className={
                  isOverdue(
                    task,
                  )
                    ? 'posho-text-danger'
                    : ''
                }
              >
                Due {task.due_at}
              </small>
            )}

            {estimate > 0 && (
              <small>
                {formatMinutes(
                  actual,
                )}{' '}
                /{' '}
                {formatMinutes(
                  estimate,
                )}
              </small>
            )}
          </span>

          {blocked && (
            <small className="posho-text-danger">
              Blocked
              {(blockedBy.get(
                task.id,
              ) || [])
                .length > 0
                ? ` by ${(blockedBy.get(task.id) || [])
                    .map(
                      (
                        depId,
                      ) =>
                        tasksById.get(
                          depId,
                        )
                          ?.title ||
                        'another task',
                    )
                    .slice(
                      0,
                      2,
                    )
                    .join(
                      '; ',
                    )}`
                : ''}
            </small>
          )}
        </button>
      </article>
    );
  };

  return (
    <div className="admin-view page-reveal">
      <PageHeader
        kicker="Work"
        title="Delivery board"
        description="Every task across every project. Blocked work and overdue items surface first."
        actions={
          <button
            type="button"
            className="button button-primary"
            onClick={() =>
              setTaskForm({
                id: '',
                order_id: '',
                title: '',
                milestone_id: '',
                status: 'backlog',
                priority: 'normal',
                estimate_minutes: '',
                assignee_id: '',
                description: '',
                client_visible: false,
                due_at: '',
              })
            }
          >
            <Plus size={17} />
            New task
          </button>
        }
      />

      {error && (
        <ErrorBlock
          message={
            error
          }
          onRetry={
            load
          }
        />
      )}

      <div className="admin-dashboard-stat-grid">
        <MetricCard
          label="Active tasks"
          value={
            metrics.active
          }
          detail="Not done or cancelled"
        />

        <MetricCard
          label="Blocked"
          value={
            metrics.blocked
          }
          detail="Needs unblocking"
          tone={
            metrics.blocked >
            0
              ? 'red'
              : 'neutral'
          }
        />

        <MetricCard
          label="Overdue"
          value={
            metrics.overdue
          }
          detail="Past due date"
          tone={
            metrics.overdue >
            0
              ? 'amber'
              : 'neutral'
          }
        />

        <MetricCard
          label="Waiting on client"
          value={
            metrics.waiting
          }
          detail="Client dependencies"
          tone={
            metrics.waiting >
            0
              ? 'amber'
              : 'neutral'
          }
        />
      </div>

      <div className="posho-search-row">
        <label
          style={{
            display:
              'flex',
            alignItems:
              'center',
            gap: 8,
          }}
        >
          <Search
            size={17}
            aria-hidden="true"
          />

          <input
            type="search"
            value={
              query
            }
            onChange={(
              event,
            ) =>
              setQuery(
                event.target
                  .value,
              )
            }
            placeholder="Search tasks, projects, milestones…"
            aria-label="Search tasks"
          />
        </label>

        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              '1fr 1fr 1fr',
            gap: 8,
          }}
        >
          <label>
            <span className="posho-section-label">
              Status
            </span>

            <select
              value={
                statusFilter
              }
              onChange={(
                event,
              ) =>
                setStatusFilter(
                  event.target
                    .value,
                )
              }
              aria-label="Filter by status"
            >
              <option value="active">
                Active
              </option>

              <option value="blocked">
                Blocked
              </option>

              <option value="overdue">
                Overdue
              </option>

              <option value="all">
                All
              </option>

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
                    {pretty(
                      status,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span className="posho-section-label">
              Assignee
            </span>

            <select
              value={
                assigneeFilter
              }
              onChange={(
                event,
              ) =>
                setAssigneeFilter(
                  event.target
                    .value,
                )
              }
              aria-label="Filter by assignee"
            >
              <option value="all">
                Everyone
              </option>

              <option value="unassigned">
                Unassigned
              </option>

              <option value="mine">
                Mine
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
            <span className="posho-section-label">
              Priority
            </span>

            <select
              value={
                priorityFilter
              }
              onChange={(
                event,
              ) =>
                setPriorityFilter(
                  event.target
                    .value,
                )
              }
              aria-label="Filter by priority"
            >
              <option value="all">
                All
              </option>

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
                    {pretty(
                      priority,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            key: 'board',
            label: 'Kanban',
          },
          {
            key: 'list',
            label: 'List',
          },
          {
            key: 'timeline',
            label: 'Timeline',
          },
        ]}
        active={
          view
        }
        onChange={
          setView
        }
        label="Work views"
      />

      {selected.length >
        0 && (
        <div
          className="finance-review-actions"
          role="toolbar"
          aria-label="Batch task actions"
        >
          <span>
            {
              selected.length
            }{' '}
            selected
          </span>

          <select
            id="batch-assignee"
            defaultValue=""
            aria-label="Assign selected tasks"
            onChange={(
              event,
            ) => {
              if (
                event.target
                  .value
              ) {
                const rawValue =
                  event.target
                    .value;

                batchUpdate(
                  {
                    assignee_id:
                      rawValue ===
                      '__none__'
                        ? null
                        : rawValue,
                  },
                  'assigned',
                );
                event.target.value =
                  '';
              }
            }}
            disabled={
              batchBusy
            }
          >
            <option value="">
              Assign to…
            </option>

            <option value="__none__">
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

          <select
            defaultValue=""
            aria-label="Change priority of selected tasks"
            onChange={(
              event,
            ) => {
              if (
                event.target
                  .value
              ) {
                batchUpdate(
                  {
                    priority:
                      event
                        .target
                        .value,
                  },
                  'reprioritised',
                );
                event.target.value =
                  '';
              }
            }}
            disabled={
              batchBusy
            }
          >
            <option value="">
              Set priority…
            </option>

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
                  {pretty(
                    priority,
                  )}
                </option>
              ),
            )}
          </select>

          <button
            type="button"
            className="button button-secondary"
            disabled={
              batchBusy
            }
            onClick={() =>
              setSelected(
                [],
              )
            }
          >
            Clear
          </button>
        </div>
      )}

      {filtered.length ===
      0 ? (
        <EmptyState
          title="No tasks match"
          body="Adjust filters or create work from a project workspace."
        />
      ) : view ===
        'board' ? (
        <div className="posho-kanban">
          {KANBAN_COLUMNS.map(
            (
              column,
            ) => {
              const cards =
                filtered.filter(
                  (
                    task,
                  ) =>
                    task.status ===
                    column,
                );

              return (
                <section
                  key={
                    column
                  }
                  className="posho-kanban-column"
                  aria-label={`${pretty(column)} column`}
                >
                  <header>
                    <strong>
                      {pretty(
                        column,
                      )}
                    </strong>

                    <span>
                      {
                        cards.length
                      }
                    </span>
                  </header>

                  {cards.map(
                    (
                      task,
                    ) => (
                      <div
                        key={
                          task.id
                        }
                        className="posho-kanban-card-wrap"
                      >
                        {
                          renderCard(
                            task,
                          )
                        }

                        <div className="posho-kanban-move">
                          {KANBAN_COLUMNS.filter(
                            (
                              target,
                            ) =>
                              target !==
                              column,
                          ).map(
                            (
                              target,
                            ) => (
                              <button
                                key={
                                  target
                                }
                                type="button"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  moveTask(
                                    task,
                                    target,
                                  )
                                }
                                aria-label={`Move ${task.title} to ${pretty(target)}`}
                              >
                                →
                                {pretty(
                                  target,
                                )}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </section>
              );
            },
          )}
        </div>
      ) : view ===
        'list' ? (
        <div className="admin-data-card">
          {filtered.map(
            (
              task,
            ) => (
              <article
                key={
                  task.id
                }
                className="admin-data-row"
              >
                <div>
                  <input
                    type="checkbox"
                    checked={selected.includes(
                      task.id,
                    )}
                    onChange={() =>
                      toggleSelect(
                        task.id,
                      )
                    }
                    aria-label={`Select ${task.title}`}
                  />
                </div>

                <div>
                  <small className="posho-long-value">
                    {task.order
                      ?.reference ||
                      ''}
                  </small>

                  <strong className="posho-long-value">
                    {
                      task.title
                    }
                  </strong>

                  <span>
                    {task.assignee
                      ?.display_name ||
                      'Unassigned'}
                    {task.due_at
                      ? ` · Due ${task.due_at}`
                      : ''}
                  </span>
                </div>

                <div>
                  <StatusBadge
                    value={
                      task.priority ||
                      'normal'
                    }
                  />
                </div>

                <div>
                  <StatusBadge
                    value={
                      task.status
                    }
                  />
                </div>

                <div>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() =>
                      setDetail(
                        task,
                      )
                    }
                  >
                    Open
                  </button>
                </div>
              </article>
            ),
          )}
        </div>
      ) : (
        <div className="posho-timeline">
          {[...filtered]
            .filter(
              (
                task,
              ) =>
                task.due_at,
            )
            .sort(
              (
                a,
                b,
              ) =>
                a.due_at <
                b.due_at
                  ? -1
                  : 1,
            )
            .map(
              (
                task,
              ) => (
                <div
                  key={
                    task.id
                  }
                  className="posho-timeline-item"
                >
                  <span
                    className="posho-timeline-dot"
                    aria-hidden="true"
                  />

                  <div className="posho-timeline-body">
                    <strong className="posho-long-value">
                      {
                        task.title
                      }
                    </strong>

                    <p className="posho-long-value">
                      {task.order
                        ?.project_title ||
                        ''}{' '}
                      ·{' '}
                      {task.milestone
                        ?.title ||
                        'No milestone'}
                    </p>

                    <time>
                      Due{' '}
                      {
                        task.due_at
                      }{' '}
                      ·{' '}
                      {
                        task.assignee
                          ?.display_name ||
                          'Unassigned'
                      }
                    </time>

                    <div>
                      <StatusBadge
                        value={
                          task.status
                        }
                      />
                    </div>
                  </div>
                </div>
              ),
            )}
        </div>
      )}

      {detail && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setDetail(
              null,
            )
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Task detail"
            className="posho-modal posho-modal-wide"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
          >
            <div className="posho-modal-heading">
              <div>
                <span>
                  TASK ·{' '}
                  {
                    detail.order
                      ?.reference
                  }
                </span>

                <h3>
                  {
                    detail.title
                  }
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setDetail(
                    null,
                  )
                }
                aria-label="Close task detail"
                disabled={
                  busy
                }
              >
                <X
                  size={19}
                />
              </button>
            </div>

            {detail.description && (
              <p className="posho-modal-description">
                {
                  detail.description
                }
              </p>
            )}

            <div className="posho-kv">
              <div>
                <span>
                  Status
                </span>

                <strong>
                  {pretty(
                    detail.status,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Priority
                </span>

                <strong>
                  {pretty(
                    detail.priority ||
                      'normal',
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Assignee
                </span>

                <strong>
                  {detail.assignee
                    ?.display_name ||
                    'Unassigned'}
                </strong>
              </div>

              <div>
                <span>
                  Due
                </span>

                <strong>
                  {detail.due_at ||
                    'Not set'}
                </strong>
              </div>

              <div>
                <span>
                  Estimate / tracked
                </span>

                <strong>
                  {detail.estimate_minutes
                    ? formatMinutes(
                        detail.estimate_minutes,
                      )
                    : 'No estimate'}{' '}
                  /{' '}
                  {formatMinutes(
                    timeByTask.get(
                      detail.id,
                    ) || 0,
                  )}
                </strong>
              </div>
            </div>

            <div
              className="finance-review-actions"
              style={{
                marginTop: 12,
              }}
            >
              <span className="posho-section-label">
                Move to
              </span>

              {TASK_STATUSES.filter(
                (
                  status,
                ) =>
                  status !==
                  detail.status,
              ).map(
                (
                  status,
                ) => (
                  <button
                    key={
                      status
                    }
                    type="button"
                    className="button button-secondary"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      moveTask(
                        detail,
                        status,
                      )
                    }
                  >
                    {pretty(
                      status,
                    )}
                  </button>
                ),
              )}
            </div>

            <div
              style={{
                marginTop: 16,
              }}
            >
              <span className="posho-section-label">
                Blocked by
              </span>

              {(blockedBy.get(
                detail.id,
              ) || [])
                .length ===
              0 ? (
                <p className="admin-card-description">
                  No dependencies. This
                  task can begin any
                  time.
                </p>
              ) : (
                <div className="posho-ledger">
                  {(
                    blockedBy.get(
                      detail.id,
                    ) || []
                  ).map(
                    (
                      depId,
                    ) => {
                      const dep =
                        tasksById.get(
                          depId,
                        );

                      return (
                        <article
                          key={
                            depId
                          }
                          className="posho-ledger-item"
                        >
                          <header>
                            <strong className="posho-long-value">
                              {dep?.title ||
                                'Unknown task'}
                            </strong>

                            {dep && (
                              <StatusBadge
                                value={
                                  dep.status
                                }
                              />
                            )}
                          </header>

                          <div className="finance-review-actions">
                            <button
                              type="button"
                              className="button button-secondary"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                removeDependency(
                                  depId,
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
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
                        task,
                      ) =>
                        task.id !==
                          detail.id &&
                        task.order_id ===
                          detail.order_id &&
                        !(
                          blockedBy.get(
                            detail.id,
                          ) || []
                        ).includes(
                          task.id,
                        ),
                    )
                    .slice(
                      0,
                      100,
                    )
                    .map(
                      (
                        task,
                      ) => (
                        <option
                          key={
                            task.id
                          }
                          value={
                            task.id
                          }
                        >
                          {
                            task.title
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
                  onClick={
                    addDependency
                  }
                >
                  <Link2
                    size={15}
                  />
                  Add
                </button>
              </div>
            </div>

            <div
              className="finance-review-actions"
              style={{
                marginTop: 16,
              }}
            >
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setTaskForm({
                    id: detail.id,
                    order_id:
                      detail.order_id,
                    title:
                      detail.title,
                    milestone_id:
                      detail.milestone_id ||
                      '',
                    status:
                      detail.status,
                    priority:
                      detail.priority ||
                      'normal',
                    estimate_minutes:
                      detail.estimate_minutes ??
                      '',
                    assignee_id:
                      detail.assignee_id ||
                      '',
                    description:
                      detail.description ||
                      '',
                    client_visible:
                      detail.client_visible ===
                      true,
                    due_at:
                      detail.due_at ||
                      '',
                  });
                }}
              >
                Edit task
              </button>

              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setTimeForm({
                    order_id:
                      detail.order_id,
                    task_id:
                      detail.id,
                    member_id: '',
                    entry_date:
                      new Date()
                        .toISOString()
                        .slice(
                          0,
                          10,
                        ),
                    minutes: '',
                    billable: true,
                    description: '',
                  })
                }
              >
                <Timer
                  size={15}
                />
                Log time
              </button>

              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setDetail(
                    null,
                  )
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {taskForm && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setTaskForm(
              null,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Task editor"
            className="posho-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              saveTaskForm
            }
          >
            <div className="posho-modal-heading">
              <h3>
                {taskForm.id
                  ? 'Edit task'
                  : 'New task'}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setTaskForm(
                    null,
                  )
                }
                aria-label="Close task editor"
                disabled={
                  busy
                }
              >
                <X
                  size={19}
                />
              </button>
            </div>

            <p className="posho-modal-description">
              Urgent stays exceptional — most
              work should be normal priority.
            </p>

            <div className="posho-form-grid">
              {!taskForm.id && (
                <label>
                  <span>
                    Project
                  </span>

                  <select
                    value={
                      taskForm.order_id
                    }
                    onChange={(
                      event,
                    ) =>
                      setTaskForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          order_id:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    required
                  >
                    <option value="">
                      Choose project…
                    </option>

                    {projects.map(
                      (
                        project,
                      ) => (
                        <option
                          key={
                            project.id
                          }
                          value={
                            project.id
                          }
                        >
                          {
                            project.reference
                          }{' '}
                          ·{' '}
                          {
                            project.project_title
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}

              <label>
                <span>
                  Title
                </span>

                <input
                  value={
                    taskForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setTaskForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        title:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  required
                  maxLength={200}
                />
              </label>

              <label>
                <span>
                  Description
                </span>

                <textarea
                  value={
                    taskForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setTaskForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        description:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  maxLength={5000}
                />
              </label>

              <label>
                <span>
                  Status
                </span>

                <select
                  value={
                    taskForm.status
                  }
                  onChange={(
                    event,
                  ) =>
                    setTaskForm(
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
                        {pretty(
                          status,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Priority
                </span>

                <select
                  value={
                    taskForm.priority
                  }
                  onChange={(
                    event,
                  ) =>
                    setTaskForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        priority:
                          event
                            .target
                            .value,
                      }),
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
                        {pretty(
                          priority,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Assignee
                </span>

                <select
                  value={
                    taskForm.assignee_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setTaskForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        assignee_id:
                          event
                            .target
                            .value,
                      }),
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
                <span>
                  Estimate (minutes)
                </span>

                <input
                  type="number"
                  min="0"
                  step="15"
                  value={
                    taskForm.estimate_minutes
                  }
                  onChange={(
                    event,
                  ) =>
                    setTaskForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        estimate_minutes:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Due date
                </span>

                <input
                  type="date"
                  value={
                    taskForm.due_at
                  }
                  onChange={(
                    event,
                  ) =>
                    setTaskForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        due_at:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label className="finance-checkbox-row">
                <input
                  type="checkbox"
                  checked={
                    taskForm.client_visible
                  }
                  onChange={(
                    event,
                  ) =>
                    setTaskForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        client_visible:
                          event
                            .target
                            .checked,
                      }),
                    )
                  }
                />

                <span>
                  Visible to client
                </span>
              </label>
            </div>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setTaskForm(
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

      {timeForm && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setTimeForm(
              null,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Log time"
            className="posho-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              saveTime
            }
          >
            <div className="posho-modal-heading">
              <h3>
                Log time
              </h3>

              <button
                type="button"
                onClick={() =>
                  setTimeForm(
                    null,
                  )
                }
                aria-label="Close time form"
                disabled={
                  busy
                }
              >
                <X
                  size={19}
                />
              </button>
            </div>

            <div className="posho-form-grid">
              <label>
                <span>
                  Team member
                </span>

                <select
                  value={
                    timeForm.member_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setTimeForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        member_id:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  <option value="">
                    Unassigned time
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
                <span>
                  Date
                </span>

                <input
                  type="date"
                  value={
                    timeForm.entry_date
                  }
                  onChange={(
                    event,
                  ) =>
                    setTimeForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        entry_date:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  required
                />
              </label>

              <label>
                <span>
                  Minutes
                </span>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={
                    timeForm.minutes
                  }
                  onChange={(
                    event,
                  ) =>
                    setTimeForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        minutes:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  required
                />
              </label>

              <label className="finance-checkbox-row">
                <input
                  type="checkbox"
                  checked={
                    timeForm.billable
                  }
                  onChange={(
                    event,
                  ) =>
                    setTimeForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        billable:
                          event
                            .target
                            .checked,
                      }),
                    )
                  }
                />

                <span>
                  Billable
                </span>
              </label>

              <label>
                <span>
                  Description
                </span>

                <input
                  value={
                    timeForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setTimeForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        description:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  maxLength={2000}
                />
              </label>
            </div>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setTimeForm(
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
                  : 'Log time'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
