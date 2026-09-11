import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Plus,
  X,
} from 'lucide-react';

import BrandLoader from '../components/BrandLoader';
import PageHeader from '../components/ui/PageHeader';
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
  ROLE_LABELS,
  capabilitiesForRole,
} from '../lib/permissions';

import {
  getTeam,
  runOperationsAction,
} from '../lib/operations';

import {
  getAdminOrders,
} from '../lib/admin';

const TEAM_ROLES = Object.keys(
  ROLE_LABELS,
);

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

function mondayOf(
  date = new Date(),
) {
  const copy =
    new Date(
      date,
    );

  copy.setHours(
    0,
    0,
    0,
    0,
  );

  const day =
    (copy.getDay() +
      6) %
    7;

  copy.setDate(
    copy.getDate() -
      day,
  );

  return copy
    .toISOString()
    .slice(
      0,
      10,
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

function heatTone(
  utilization,
) {
  if (
    utilization >
    100
  ) {
    return 'red';
  }

  if (
    utilization >=
    85
  ) {
    return 'amber';
  }

  if (
    utilization <= 0
  ) {
    return 'neutral';
  }

  return 'green';
}

function heatLabel(
  utilization,
) {
  if (
    utilization >
    100
  ) {
    return 'Overloaded';
  }

  if (
    utilization >=
    85
  ) {
    return 'High';
  }

  if (
    utilization <= 0
  ) {
    return 'Available';
  }

  return 'Healthy';
}

export default function AdminTeam() {
  const toast =
    useToast();

  const [
    tab,
    setTab,
  ] =
    useState(
      'members',
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
    members,
    setMembers,
  ] =
    useState([]);

  const [
    allocations,
    setAllocations,
  ] =
    useState([]);

  const [
    timeEntries,
    setTimeEntries,
  ] =
    useState([]);

  const [
    tasks,
    setTasks,
  ] =
    useState([]);

  const [
    projects,
    setProjects,
  ] =
    useState([]);

  const [
    weekOffset,
    setWeekOffset,
  ] =
    useState(0);

  const [
    memberForm,
    setMemberForm,
  ] =
    useState(null);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    linkEmail,
    setLinkEmail,
  ] =
    useState({});

  const [
    allocationForm,
    setAllocationForm,
  ] =
    useState(null);

  const [
    timeForm,
    setTimeForm,
  ] =
    useState(null);

  useEscapeClose(
    Boolean(
      memberForm,
    ) && !busy,
    () =>
      setMemberForm(
        null,
      ),
  );

  useEscapeClose(
    Boolean(
      allocationForm,
    ) && !busy,
    () =>
      setAllocationForm(
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

          setMembers(
            team.members,
          );
          setAllocations(
            team.allocations,
          );
          setTimeEntries(
            team.timeEntries,
          );
          setTasks(
            team.tasks,
          );

          const orderRows =
            await getAdminOrders().catch(
              () => [],
            );

          setProjects(
            orderRows,
          );
        } catch (loadError) {
          setError(
            loadError.message ||
              'Team data could not be loaded.',
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
      'Team | Posho Creative Management';

    load();
  }, [
    load,
  ]);

  const weekStart = useMemo(() => {
    const base =
      new Date(
        mondayOf(),
      );

    base.setDate(
      base.getDate() +
        weekOffset *
          7,
    );

    return base
      .toISOString()
      .slice(
        0,
        10,
      );
  }, [
    weekOffset,
  ]);

  const capacity = useMemo(() => {
    const active = members.filter(
      (
        member,
      ) =>
        member.status ===
        'active',
    );

    return active.map(
      (
        member,
      ) => {
        const weekly =
          Number(
            member.weekly_capacity_minutes ||
              0,
          );

        const allocated =
          allocations
            .filter(
              (
                allocation,
              ) =>
                allocation.member_id ===
                  member.id &&
                allocation.week_start ===
                  weekStart,
            )
            .reduce(
              (
                sum,
                allocation,
              ) =>
                sum +
                Number(
                  allocation.minutes ||
                    0,
                ),
              0,
            );

        const utilization =
          weekly >
          0
            ? Math.round(
                (allocated /
                  weekly) *
                  100,
              )
            : allocated >
                0
              ? 101
              : 0;

        const tasksOpen = tasks.filter(
          (
            task,
          ) =>
            task.assignee_id ===
              member.id &&
            ![
              'done',
              'cancelled',
            ].includes(
              task.status,
            ),
        ).length;

        return {
          member,
          weekly,
          allocated,
          remaining:
            weekly -
            allocated,
          utilization,
          tasksOpen,
        };
      },
    );
  }, [
    members,
    allocations,
    tasks,
    weekStart,
  ]);

  const timeTotals =
    useMemo(() => {
      const byMember =
        new Map();

      for (const entry of timeEntries) {
        if (
          !entry.member_id
        ) {
          continue;
        }

        byMember.set(
          entry.member_id,
          (byMember.get(
            entry.member_id,
          ) || 0) +
            Number(
              entry.minutes ||
                0,
            ),
        );
      }

      return byMember;
    }, [
      timeEntries,
    ]);

  const saveMember = async (
    event,
  ) => {
    event.preventDefault();

    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'team_save',
        id:
          memberForm.id ||
          undefined,
        display_name:
          memberForm.display_name.trim(),
        email:
          memberForm.email.trim(),
        role:
          memberForm.role,
        capabilities:
          capabilitiesForRole(
            memberForm.role,
            memberForm.capabilities,
          ),
        status:
          memberForm.status,
        weekly_capacity_minutes:
          Math.round(
            Number(
              memberForm.weekly_hours ||
                0,
            ) * 60,
          ),
        timezone:
          memberForm.timezone.trim() ||
          'Africa/Lagos',
        skills:
          memberForm.skills
            .split(
              '\n',
            )
            .map(
              (
                skill,
              ) =>
                skill.trim(),
            )
            .filter(
              Boolean,
            ),
      });

      toast.success(
        'Team member saved.',
      );
      setMemberForm(
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

  const linkMember = async (
    id,
  ) => {
    const email = (
      linkEmail[
        id
      ] || ''
    ).trim();

    if (!email) {
      toast.error(
        'Enter the sign-in email first.',
      );

      return;
    }

    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'team_link',
        id,
        email,
      });

      toast.success(
        'Account linked.',
      );
      await load();
    } catch (linkError) {
      toast.error(
        linkError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const saveAllocation = async (
    event,
  ) => {
    event.preventDefault();

    try {
      setBusy(
        true,
      );

      const result =
        await runOperationsAction({
          action:
            'allocation_save',
          member_id:
            allocationForm.member_id,
          order_id:
            allocationForm.order_id ||
            null,
          week_start:
            allocationForm.week_start,
          minutes:
            Math.round(
              Number(
                allocationForm.hours ||
                  0,
              ) * 60,
            ),
          tentative:
            allocationForm.tentative,
          note:
            allocationForm.note.trim(),
        });

      if (
        result.overallocated
      ) {
        toast.info(
          `Saved — but this exceeds weekly capacity (${formatMinutes(result.weekAllocatedMinutes)} of ${formatMinutes(result.weekCapacityMinutes)}).`,
        );
      } else {
        toast.success(
          'Allocation saved.',
        );
      }

      setAllocationForm(
        null,
      );
      await load();
    } catch (allocationError) {
      toast.error(
        allocationError.message,
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
          timeForm.task_id ||
          null,
        member_id:
          timeForm.member_id ||
          null,
        entry_date:
          timeForm.entry_date,
        minutes:
          Math.round(
            Number(
              timeForm.minutes ||
                0,
            ),
          ),
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
      <BrandLoader label="Loading team…" />
    );
  }

  return (
    <div className="admin-view page-reveal">
      <PageHeader
        kicker="People"
        title="Team and capacity"
        description="Capabilities gate sensitive actions server-side. Capacity guides decisions — never surveillance."
        actions={
          <button
            type="button"
            className="button button-primary"
            onClick={() =>
              setMemberForm({
                id: '',
                display_name: '',
                email: '',
                role: 'support',
                capabilities: [],
                status:
                  'active',
                weekly_hours:
                  '40',
                timezone:
                  'Africa/Lagos',
                skills: '',
              })
            }
          >
            <Plus
              size={17}
            />
            Add member
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

      <Tabs
        tabs={[
          {
            key: 'members',
            label: 'Members',
          },
          {
            key: 'capacity',
            label: 'Capacity',
          },
          {
            key: 'time',
            label: 'Time',
          },
        ]}
        active={
          tab
        }
        onChange={
          setTab
        }
        label="Team sections"
      />

      {tab ===
        'members' && (
        <>
          {members.length ===
          0 ? (
            <EmptyState
              title="Single-admin mode"
              body="Add team members when a second person joins. The owner account keeps full access either way."
              action={
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() =>
                    setMemberForm({
                      id: '',
                      display_name:
                        '',
                      email: '',
                      role: 'support',
                      capabilities:
                        [],
                      status:
                        'active',
                      weekly_hours:
                        '40',
                      timezone:
                        'Africa/Lagos',
                      skills: '',
                    })
                  }
                >
                  Add member
                </button>
              }
            />
          ) : (
            <div className="admin-data-card">
              {members.map(
                (
                  member,
                ) => (
                  <article
                    key={
                      member.id
                    }
                    className="admin-data-row"
                  >
                    <div>
                      <strong>
                        {
                          member.display_name
                        }
                      </strong>

                      <span className="posho-long-value">
                        {member.email ||
                          'No email'}
                      </span>

                      <span>
                        {ROLE_LABELS[
                          member.role
                        ] ||
                          member.role}{' '}
                        ·{' '}
                        {formatMinutes(
                          timeTotals.get(
                            member.id,
                          ) || 0,
                        )}{' '}
                        tracked
                      </span>
                    </div>

                    <div>
                      <StatusBadge
                        value={
                          member.status
                        }
                      />
                    </div>

                    <div
                      className="finance-review-actions"
                      style={{
                        justifyContent:
                          'flex-end',
                      }}
                    >
                      {!member.user_id && (
                        <span
                          style={{
                            display:
                              'flex',
                            gap: 6,
                          }}
                        >
                          <input
                            type="email"
                            placeholder="Sign-in email"
                            value={
                              linkEmail[
                                member
                                  .id
                              ] || ''
                            }
                            onChange={(
                              event,
                            ) =>
                              setLinkEmail(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [member.id]:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                            aria-label={`Sign-in email for ${member.display_name}`}
                            style={{
                              maxWidth: 180,
                            }}
                          />

                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              linkMember(
                                member.id,
                              )
                            }
                          >
                            Link
                          </button>
                        </span>
                      )}

                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() =>
                          setMemberForm({
                            id: member.id,
                            display_name:
                              member.display_name,
                            email:
                              member.email ||
                              '',
                            role:
                              member.role,
                            capabilities:
                              member.capabilities ||
                              [],
                            status:
                              member.status,
                            weekly_hours:
                              String(
                                Number(
                                  member.weekly_capacity_minutes ||
                                    0,
                                ) /
                                  60,
                              ),
                            timezone:
                              member.timezone ||
                              'Africa/Lagos',
                            skills: (
                              member.skills ||
                              []
                            ).join(
                              '\n',
                            ),
                          })
                        }
                      >
                        Edit
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}

          <p className="admin-card-description">
            Internal team details never reach
            clients. Compensation is not
            stored in this system at all.
          </p>
        </>
      )}

      {tab ===
        'capacity' && (
        <>
          <div className="finance-review-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                setWeekOffset(
                  (
                    offset,
                  ) =>
                    offset -
                    1,
                )
              }
            >
              ← Previous week
            </button>

            <strong>
              Week of{' '}
              {weekStart}
            </strong>

            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                setWeekOffset(
                  (
                    offset,
                  ) =>
                    offset +
                    1,
                )
              }
            >
              Next week →
            </button>

            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                setAllocationForm({
                  member_id: '',
                  order_id: '',
                  week_start:
                    weekStart,
                  hours: '',
                  tentative: false,
                  note: '',
                })
              }
            >
              <Plus
                size={17}
              />
              Allocate
            </button>
          </div>

          {capacity.length ===
          0 ? (
            <EmptyState
              title="No active members"
              body="Add team members to plan capacity."
            />
          ) : (
            <div className="admin-data-card">
              {capacity.map(
                (
                  row,
                ) => (
                  <article
                    key={
                      row.member
                        .id
                    }
                    className="admin-data-row"
                  >
                    <div>
                      <strong>
                        {
                          row.member
                            .display_name
                        }
                      </strong>

                      <span>
                        {formatMinutes(
                          row.allocated,
                        )}{' '}
                        of{' '}
                        {formatMinutes(
                          row.weekly,
                        )}{' '}
                        ·{' '}
                        {
                          row.tasksOpen
                        }{' '}
                        open tasks
                      </span>

                      <div className="posho-report-bar">
                        <span
                          style={{
                            width: `${Math.min(100, row.utilization)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <StatusBadge
                        value={heatTone(
                          row.utilization,
                        )}
                        label={`${row.utilization}% · ${heatLabel(row.utilization)}`}
                      />
                    </div>
                  </article>
                ),
              )}
            </div>
          )}

          <section className="admin-control-card">
            <span className="posho-section-label">
              Allocations · week of{' '}
              {weekStart}
            </span>

            {allocations.filter(
              (
                allocation,
              ) =>
                allocation.week_start ===
                weekStart,
            ).length ===
            0 ? (
              <p className="admin-card-description">
                No allocations this week.
              </p>
            ) : (
              <div className="posho-ledger">
                {allocations
                  .filter(
                    (
                      allocation,
                    ) =>
                      allocation.week_start ===
                      weekStart,
                  )
                  .map(
                    (
                      allocation,
                    ) => (
                      <article
                        key={
                          allocation.id
                        }
                        className="posho-ledger-item"
                      >
                        <header>
                          <strong>
                            {members.find(
                              (
                                member,
                              ) =>
                                member.id ===
                                allocation.member_id,
                            )
                              ?.display_name ||
                              'Member'}
                          </strong>

                          <strong>
                            {formatMinutes(
                              allocation.minutes,
                            )}
                          </strong>
                        </header>

                        <p>
                          {allocation.tentative
                            ? 'Tentative · '
                            : 'Confirmed · '}
                          {allocation.note ||
                            'Project allocation'}
                        </p>

                        <div className="finance-review-actions">
                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={busy}
                            onClick={async () => {
                              try {
                                setBusy(true);

                                // Confirm by re-saving as
                                // non-tentative would duplicate;
                                // release and re-create instead.
                                await runOperationsAction(
                                  {
                                    action:
                                      'allocation_delete',
                                    id: allocation.id,
                                  },
                                );

                                toast.success(
                                  allocation.tentative
                                    ? 'Tentative allocation released. Re-create it as confirmed when the work is won.'
                                    : 'Allocation released.',
                                );
                                await load();
                              } catch (deleteError) {
                                toast.error(
                                  deleteError.message,
                                );
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            Release
                          </button>
                        </div>
                      </article>
                    ),
                  )}
              </div>
            )}
          </section>
        </>
      )}

      {tab ===
        'time' && (
        <>
          <div className="finance-review-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                setTimeForm({
                  order_id: '',
                  task_id: '',
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
              <Plus
                size={17}
              />
              Log time
            </button>
          </div>

          {timeEntries.length ===
          0 ? (
            <EmptyState
              title="No time tracked yet"
              body="Manual entries attach to projects and tasks for estimates and margins."
            />
          ) : (
            <div className="admin-data-card">
              {timeEntries
                .slice(
                  0,
                  100,
                )
                .map(
                  (
                    entry,
                  ) => (
                    <article
                      key={
                        entry.id
                      }
                      className="admin-data-row"
                    >
                      <div>
                        <small>
                          {
                            entry.entry_date
                          }
                        </small>

                        <strong>
                          {formatMinutes(
                            entry.minutes,
                          )}
                          {entry.billable
                            ? ''
                            : ' · non-billable'}
                        </strong>

                        <span className="posho-long-value">
                          {entry.description ||
                            'No description'}
                        </span>
                      </div>

                      <div>
                        <button
                          type="button"
                          className="button button-secondary"
                          disabled={
                            busy
                          }
                          onClick={async () => {
                            try {
                              setBusy(
                                true,
                              );

                              await runOperationsAction(
                                {
                                  action:
                                    'time_delete',
                                  id: entry.id,
                                },
                              );

                              await load();
                            } catch (deleteError) {
                              toast.error(
                                deleteError.message,
                              );
                            } finally {
                              setBusy(
                                false,
                              );
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ),
                )}
            </div>
          )}
        </>
      )}

      {memberForm && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setMemberForm(
              null,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Team member"
            className="posho-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              saveMember
            }
          >
            <div className="posho-modal-heading">
              <h3>
                {memberForm.id
                  ? 'Edit member'
                  : 'Add member'}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setMemberForm(
                    null,
                  )
                }
                aria-label="Close member form"
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
                  Display name
                </span>

                <input
                  value={
                    memberForm.display_name
                  }
                  onChange={(
                    event,
                  ) =>
                    setMemberForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        display_name:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  required
                  maxLength={160}
                />
              </label>

              <label>
                <span>
                  Email
                </span>

                <input
                  type="email"
                  value={
                    memberForm.email
                  }
                  onChange={(
                    event,
                  ) =>
                    setMemberForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        email:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  maxLength={160}
                />
              </label>

              <label>
                <span>
                  Role
                </span>

                <select
                  value={
                    memberForm.role
                  }
                  onChange={(
                    event,
                  ) =>
                    setMemberForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        role: event
                          .target
                          .value,
                        capabilities:
                          [],
                      }),
                    )
                  }
                >
                  {TEAM_ROLES.map(
                    (
                      role,
                    ) => (
                      <option
                        key={
                          role
                        }
                        value={
                          role
                        }
                      >
                        {ROLE_LABELS[
                          role
                        ] ||
                          role}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Status
                </span>

                <select
                  value={
                    memberForm.status
                  }
                  onChange={(
                    event,
                  ) =>
                    setMemberForm(
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
                  <option value="active">
                    Active
                  </option>

                  <option value="disabled">
                    Disabled
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Weekly capacity
                  (hours)
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={
                    memberForm.weekly_hours
                  }
                  onChange={(
                    event,
                  ) =>
                    setMemberForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        weekly_hours:
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
                  Timezone
                </span>

                <input
                  value={
                    memberForm.timezone
                  }
                  onChange={(
                    event,
                  ) =>
                    setMemberForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        timezone:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  maxLength={60}
                />
              </label>

              <label>
                <span>
                  Skills (one per
                  line)
                </span>

                <textarea
                  value={
                    memberForm.skills
                  }
                  onChange={(
                    event,
                  ) =>
                    setMemberForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        skills:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>
            </div>

            <p className="posho-modal-description">
              Default capabilities follow
              the role: {pretty(
                memberForm.role,
              )}{' '}
              →{' '}
              {capabilitiesForRole(
                memberForm.role,
                [],
              ).length
                ? capabilitiesForRole(
                    memberForm.role,
                    [],
                  ).join(
                    ', ',
                  )
                : 'view only'}.
              Owner-level grants stay
              owner-protected.
            </p>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setMemberForm(
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
                  : 'Save member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {allocationForm && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setAllocationForm(
              null,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="New allocation"
            className="posho-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              saveAllocation
            }
          >
            <div className="posho-modal-heading">
              <h3>
                Allocate capacity
              </h3>

              <button
                type="button"
                onClick={() =>
                  setAllocationForm(
                    null,
                  )
                }
                aria-label="Close allocation form"
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
                  Member
                </span>

                <select
                  value={
                    allocationForm.member_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setAllocationForm(
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
                  required
                >
                  <option value="">
                    Choose member…
                  </option>

                  {members
                    .filter(
                      (
                        member,
                      ) =>
                        member.status ===
                        'active',
                    )
                    .map(
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
                  Week starting
                </span>

                <input
                  type="date"
                  value={
                    allocationForm.week_start
                  }
                  onChange={(
                    event,
                  ) =>
                    setAllocationForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        week_start:
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
                  Hours
                </span>

                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={
                    allocationForm.hours
                  }
                  onChange={(
                    event,
                  ) =>
                    setAllocationForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        hours:
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
                  Note
                </span>

                <input
                  value={
                    allocationForm.note
                  }
                  onChange={(
                    event,
                  ) =>
                    setAllocationForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        note: event
                          .target
                          .value,
                      }),
                    )
                  }
                  maxLength={500}
                  placeholder="Ecommerce build · frontend"
                />
              </label>

              <label className="finance-checkbox-row">
                <input
                  type="checkbox"
                  checked={
                    allocationForm.tentative
                  }
                  onChange={(
                    event,
                  ) =>
                    setAllocationForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        tentative:
                          event
                            .target
                            .checked,
                      }),
                    )
                  }
                />

                <span>
                  Tentative (pipeline
                  planning, converts on
                  win)
                </span>
              </label>
            </div>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setAllocationForm(
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
                  : 'Save allocation'}
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

            <p className="posho-modal-description">
              Manual entry. Attach the
              project from its workspace
              for task-level tracking.
            </p>

            <div className="posho-form-grid">
              <label>
                <span>
                  Project
                </span>

                <select
                  value={
                    timeForm.order_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setTimeForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        order_id:
                          event
                            .target
                            .value,
                        task_id:
                          '',
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

              <label>
                <span>
                  Task (optional)
                </span>

                <select
                  value={
                    timeForm.task_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setTimeForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        task_id:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  <option value="">
                    No specific task
                  </option>

                  {tasks
                    .filter(
                      (
                        task,
                      ) =>
                        !timeForm.order_id ||
                        task.order_id ===
                          timeForm.order_id,
                    )
                    .slice(
                      0,
                      200,
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
              </label>

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
