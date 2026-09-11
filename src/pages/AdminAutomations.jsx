import {
  useCallback,
  useEffect,
  useState,
} from 'react';


import Icon from '../components/ui/Icon';
import BrandLoader from '../components/BrandLoader';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
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
  getAutomations,
  runOperationsAction,
} from '../lib/operations';

const TRIGGERS = [
  'lead_created',
  'lead_stage_changed',
  'proposal_accepted',
  'project_submitted',
  'project_approved',
  'project_declined',
  'payment_confirmed',
  'installment_paid',
  'milestone_completed',
  'deliverable_published',
  'deliverable_approved',
  'revision_requested',
  'client_file_uploaded',
  'change_request_accepted',
  'project_completed',
];

const CONDITION_KINDS = [
  'service_equals',
  'min_project_value_kobo',
  'has_outstanding_balance',
  'client_action_pending',
  'days_before_deadline_lte',
  'milestone_title_contains',
];

const ACTION_KINDS = [
  'create_task',
  'create_client_action',
  'move_project_phase',
  'set_due_date',
  'create_notification',
  'create_checklist',
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

const emptyRule = {
  id: '',
  name: '',
  description: '',
  trigger_event: 'project_approved',
  conditions: [],
  actions: [],
  enabled: true,
};

export default function AdminAutomations() {
  const toast =
    useToast();

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
    rules,
    setRules,
  ] =
    useState([]);

  const [
    runs,
    setRuns,
  ] =
    useState([]);

  const [
    form,
    setForm,
  ] =
    useState(null);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    dryRun,
    setDryRun,
  ] =
    useState(null);

  useEscapeClose(
    Boolean(
      form,
    ) && !busy,
    () =>
      setForm(
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

          const data =
            await getAutomations();

          setRules(
            data.rules,
          );
          setRuns(
            data.runs,
          );
        } catch (loadError) {
          setError(
            loadError.message ||
              'Automations could not be loaded.',
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
      'Automations | Posho Creative Management';

    load();
  }, [
    load,
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

  const addCondition = () =>
    set(
      'conditions',
      [
        ...form.conditions,
        {
          kind: 'service_equals',
          service_slug: '',
          value_kobo: '',
          expected: true,
          days: '',
          text: '',
        },
      ],
    );

  const addAction = () =>
    set(
      'actions',
      [
        ...form.actions,
        {
          kind: 'create_task',
          title: '',
          description: '',
          label: '',
          message: '',
          phase: '',
          days_from_now: '',
          items: '',
        },
      ],
    );

  const save = async (
    event,
  ) => {
    event.preventDefault();

    if (
      !form.name.trim()
    ) {
      toast.error(
        'Name the automation.',
      );

      return;
    }

    if (
      form.actions
        .length ===
      0
    ) {
      toast.error(
        'Add at least one action.',
      );

      return;
    }

    const conditions =
      form.conditions.map(
        (
          condition,
        ) => {
          const clean = {
            kind: condition.kind,
          };

          if (
            condition.kind ===
            'service_equals'
          ) {
            clean.service_slug =
              condition.service_slug;
          }

          if (
            condition.kind ===
            'min_project_value_kobo'
          ) {
            clean.value_kobo =
              Math.round(
                Number(
                  condition.value_kobo ||
                    0,
                ) * 100,
              );
          }

          if (
            condition.kind ===
            'has_outstanding_balance' ||
            condition.kind ===
              'client_action_pending'
          ) {
            clean.expected =
              condition.expected !==
              false;
          }

          if (
            condition.kind ===
            'days_before_deadline_lte'
          ) {
            clean.days =
              Math.round(
                Number(
                  condition.days ||
                    0,
                ),
              );
          }

          if (
            condition.kind ===
            'milestone_title_contains'
          ) {
            clean.text =
              condition.text;
          }

          return clean;
        },
      );

    const actions =
      form.actions.map(
        (
          item,
        ) => {
          const clean = {
            kind: item.kind,
          };

          if (
            item.kind ===
            'create_task'
          ) {
            clean.title =
              item.title;
            clean.description =
              item.description;
          }

          if (
            item.kind ===
            'create_client_action'
          ) {
            clean.label =
              item.label;
          }

          if (
            item.kind ===
            'move_project_phase'
          ) {
            clean.phase =
              item.phase;
          }

          if (
            item.kind ===
            'set_due_date'
          ) {
            clean.days_from_now =
              Number(
                item.days_from_now ||
                  0,
              );
          }

          if (
            item.kind ===
            'create_notification'
          ) {
            clean.message =
              item.message;
          }

          if (
            item.kind ===
            'create_checklist'
          ) {
            clean.items =
              String(
                item.items ||
                  '',
              )
                .split(
                  '\n',
                )
                .map(
                  (
                    line,
                  ) =>
                    line.trim(),
                )
                .filter(
                  Boolean,
                );
          }

          return clean;
        },
      );

    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'automation_save',
        id:
          form.id ||
          undefined,
        name:
          form.name.trim(),
        description:
          form.description.trim(),
        trigger_event:
          form.trigger_event,
        conditions,
        actions,
        enabled:
          form.enabled,
      });

      toast.success(
        'Automation saved.',
      );
      setForm(
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

  const toggle = async (
    rule,
  ) => {
    try {
      await runOperationsAction({
        action:
          'automation_toggle',
        id: rule.id,
        enabled:
          !rule.enabled,
      });

      await load();
    } catch (toggleError) {
      toast.error(
        toggleError.message,
      );
    }
  };

  const remove = async (
    rule,
  ) => {
    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'automation_delete',
        id: rule.id,
      });

      toast.success(
        'Automation deleted.',
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
  };

  const test = async (
    rule,
  ) => {
    try {
      setBusy(
        true,
      );

      const result =
        await runOperationsAction({
          action:
            'automation_dry_run',
          id: rule.id,
        });

      setDryRun({
        name: rule.name,
        ...result,
      });
    } catch (testError) {
      toast.error(
        testError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  if (loading) {
    return (
      <BrandLoader label="Loading automations…" />
    );
  }

  return (
    <div className="admin-view page-reveal">
      <PageHeader
        kicker="Automation"
        title="Rules that reduce repetition"
        description="When an event occurs and conditions match, safe in-app actions run. Financial and destructive actions are never automated. Email actions stay unavailable until email is configured."
        actions={
          <button
            type="button"
            className="button button-primary"
            onClick={() =>
              setForm({
                ...emptyRule,
              })
            }
          >
            <Icon name="add"               size={17}
            />
            New rule
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

      {rules.length ===
      0 ? (
        <EmptyState
          title="No automation rules yet"
          body="Example: when a project is approved and a deposit is required, move it to Awaiting Payment and notify the client."
          action={
            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                setForm({
                  ...emptyRule,
                })
              }
            >
              Create the first rule
            </button>
          }
        />
      ) : (
        <div className="admin-data-card">
          {rules.map(
            (
              rule,
            ) => (
              <article
                key={
                  rule.id
                }
                className="admin-data-row"
              >
                <div>
                  <small className="posho-long-value">
                    WHEN{' '}
                    {pretty(
                      rule.trigger_event,
                    )}
                  </small>

                  <strong>
                    {
                      rule.name
                    }
                  </strong>

                  <span>
                    {
                      (
                        rule.conditions ||
                        []
                      ).length
                    }{' '}
                    conditions ·{' '}
                    {
                      (
                        rule.actions ||
                        []
                      ).length
                    }{' '}
                    actions · run{' '}
                    {
                      rule.run_count ||
                      0
                    }
                    ×
                  </span>
                </div>

                <div>
                  <StatusBadge
                    value={
                      rule.enabled
                        ? 'active'
                        : 'disabled'
                    }
                  />
                </div>

                <div className="finance-review-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() =>
                      toggle(
                        rule,
                      )
                    }
                  >
                    {rule.enabled
                      ? 'Pause'
                      : 'Enable'}
                  </button>

                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      test(
                        rule,
                      )
                    }
                  >
                    Dry run
                  </button>

                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() =>
                      setForm({
                        id: rule.id,
                        name: rule.name,
                        description:
                          rule.description ||
                          '',
                        trigger_event:
                          rule.trigger_event,
                        conditions: (
                          rule.conditions ||
                          []
                        ).map(
                          (
                            condition,
                          ) => ({
                            kind: condition.kind,
                            service_slug:
                              condition.service_slug ||
                              '',
                            value_kobo:
                              condition.value_kobo
                                ? String(
                                    Number(
                                      condition.value_kobo,
                                    ) /
                                      100,
                                  )
                                : '',
                            expected:
                              condition.expected !==
                              false,
                            days:
                              condition.days ??
                              '',
                            text:
                              condition.text ||
                              '',
                          }),
                        ),
                        actions: (
                          rule.actions ||
                          []
                        ).map(
                          (
                            item,
                          ) => ({
                            kind: item.kind,
                            title:
                              item.title ||
                              '',
                            description:
                              item.description ||
                              '',
                            label:
                              item.label ||
                              '',
                            message:
                              item.message ||
                              '',
                            phase:
                              item.phase ||
                              '',
                            days_from_now:
                              item.days_from_now ??
                              '',
                            items: (
                              item.items ||
                              []
                            ).join(
                              '\n',
                            ),
                          }),
                        ),
                        enabled:
                          rule.enabled,
                      })
                    }
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      remove(
                        rule,
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </article>
            ),
          )}
        </div>
      )}

      {dryRun && (
        <section className="admin-control-card">
          <span className="posho-section-label">
            Dry run
          </span>

          <h3>
            {dryRun.name}
          </h3>

          <div className="posho-kv">
            <div>
              <span>
                Trigger
              </span>

              <strong>
                {pretty(
                  dryRun.trigger,
                )}
              </strong>
            </div>

            <div>
              <span>
                Conditions
              </span>

              <strong>
                {
                  dryRun.conditionCount
                }
              </strong>
            </div>

            <div>
              <span>
                Actions that would run
              </span>

              <strong>
                {
                  dryRun.actionCount
                }
              </strong>
            </div>
          </div>

          <p className="admin-card-description">
            Dry runs never change data. Use
            “Execute” inside a project only
            for a deliberate manual run.
          </p>

          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              setDryRun(
                null,
              )
            }
          >
            Dismiss
          </button>
        </section>
      )}

      <section className="admin-control-card">
        <span className="posho-section-label">
          Run history
        </span>

        <h3>
          Automation log
        </h3>

        {runs.length ===
        0 ? (
          <p className="admin-card-description">
            Every execution lands here with
            its trigger, actions and
            outcome.
          </p>
        ) : (
          <div className="posho-timeline">
            {runs
              .slice(
                0,
                30,
              )
              .map(
                (
                  run,
                ) => (
                  <div
                    key={
                      run.id
                    }
                    className="posho-timeline-item"
                  >
                    <span
                      className="posho-timeline-dot"
                      aria-hidden="true"
                    />

                    <div className="posho-timeline-body">
                      <strong>
                        {pretty(
                          run.trigger_event,
                        )}{' '}
                        ·{' '}
                        {run.status}
                      </strong>

                      <p className="posho-long-value">
                        {JSON.stringify(
                          run.detail ||
                            {},
                        ).slice(
                          0,
                          200,
                        )}
                      </p>

                      <time>
                        {new Date(
                          run.created_at,
                        ).toLocaleString(
                          'en-NG',
                        )}
                      </time>
                    </div>
                  </div>
                ),
              )}
          </div>
        )}
      </section>

      {form && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setForm(
              null,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Automation rule"
            className="posho-modal posho-modal-wide"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              save
            }
          >
            <div className="posho-modal-heading">
              <h3>
                {form.id
                  ? 'Edit rule'
                  : 'New rule'}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setForm(
                    null,
                  )
                }
                aria-label="Close rule editor"
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
                <span>
                  Name
                </span>

                <input
                  value={
                    form.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        name: event
                          .target
                          .value,
                      }),
                    )
                  }
                  required
                  maxLength={160}
                  placeholder="Deposit follow-up on approval"
                />
              </label>

              <label>
                <span>
                  Description
                </span>

                <input
                  value={
                    form.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
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

              <label>
                <span>
                  When (trigger)
                </span>

                <select
                  value={
                    form.trigger_event
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        trigger_event:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  {TRIGGERS.map(
                    (
                      trigger,
                    ) => (
                      <option
                        key={
                          trigger
                        }
                        value={
                          trigger
                        }
                      >
                        {pretty(
                          trigger,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="finance-checkbox-row">
                <input
                  type="checkbox"
                  checked={
                    form.enabled
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        enabled:
                          event
                            .target
                            .checked,
                      }),
                    )
                  }
                />

                <span>
                  Enabled
                </span>
              </label>
            </div>

            <span
              className="posho-section-label"
              style={{
                marginTop: 12,
              }}
            >
              If (conditions)
            </span>

            {form.conditions.map(
              (
                condition,
                index,
              ) => (
                <div
                  key={
                    index
                  }
                  className="posho-form-grid"
                  style={{
                    borderTop:
                      '1px solid var(--posho-line)',
                    paddingTop: 12,
                    marginTop: 12,
                  }}
                >
                  <label>
                    <span>
                      Condition
                    </span>

                    <select
                      value={
                        condition.kind
                      }
                      onChange={(
                        event,
                      ) =>
                        setForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            conditions:
                              current.conditions.map(
                                (
                                  row,
                                  position,
                                ) =>
                                  position ===
                                  index
                                    ? {
                                        ...row,
                                        kind: event
                                          .target
                                          .value,
                                      }
                                    : row,
                              ),
                          }),
                        )
                      }
                    >
                      {CONDITION_KINDS.map(
                        (
                          kind,
                        ) => (
                          <option
                            key={
                              kind
                            }
                            value={
                              kind
                            }
                          >
                            {pretty(
                              kind,
                            )}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  {condition.kind ===
                    'service_equals' && (
                    <label>
                      <span>
                        Service slug
                      </span>

                      <input
                        value={
                          condition.service_slug
                        }
                        onChange={(
                          event,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              conditions:
                                current.conditions.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          service_slug:
                                            event
                                              .target
                                              .value,
                                        }
                                      : row,
                                ),
                            }),
                          )
                        }
                        maxLength={80}
                      />
                    </label>
                  )}

                  {condition.kind ===
                    'min_project_value_kobo' && (
                    <label>
                      <span>
                        Minimum value
                        (₦)
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          condition.value_kobo
                        }
                        onChange={(
                          event,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              conditions:
                                current.conditions.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          value_kobo:
                                            event
                                              .target
                                              .value,
                                        }
                                      : row,
                                ),
                            }),
                          )
                        }
                      />
                    </label>
                  )}

                  {(
                    condition.kind ===
                      'has_outstanding_balance' ||
                    condition.kind ===
                      'client_action_pending'
                  ) && (
                    <label>
                      <span>
                        Expected
                      </span>

                      <select
                        value={
                          condition.expected
                            ? 'yes'
                            : 'no'
                        }
                        onChange={(
                          event,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              conditions:
                                current.conditions.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          expected:
                                            event
                                              .target
                                              .value ===
                                            'yes',
                                        }
                                      : row,
                                ),
                            }),
                          )
                        }
                      >
                        <option value="yes">
                          Yes
                        </option>

                        <option value="no">
                          No
                        </option>
                      </select>
                    </label>
                  )}

                  {condition.kind ===
                    'days_before_deadline_lte' && (
                    <label>
                      <span>
                        Days or fewer
                      </span>

                      <input
                        type="number"
                        step="1"
                        value={
                          condition.days
                        }
                        onChange={(
                          event,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              conditions:
                                current.conditions.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          days: event
                                            .target
                                            .value,
                                        }
                                      : row,
                                ),
                            }),
                          )
                        }
                      />
                    </label>
                  )}

                  {condition.kind ===
                    'milestone_title_contains' && (
                    <label>
                      <span>
                        Title contains
                      </span>

                      <input
                        value={
                          condition.text
                        }
                        onChange={(
                          event,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              conditions:
                                current.conditions.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          text: event
                                            .target
                                            .value,
                                        }
                                      : row,
                                ),
                            }),
                          )
                        }
                        maxLength={120}
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          conditions:
                            current.conditions.filter(
                              (
                                _,
                                position,
                              ) =>
                                position !==
                                index,
                            ),
                        }),
                      )
                    }
                  >
                    <Icon name="close"                       size={15}
                    />
                    Remove
                  </button>
                </div>
              ),
            )}

            <div className="finance-review-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={
                  addCondition
                }
              >
                Add condition
              </button>
            </div>

            <span
              className="posho-section-label"
              style={{
                marginTop: 12,
              }}
            >
              Then (actions — safe only)
            </span>

            {form.actions.map(
              (
                item,
                index,
              ) => (
                <div
                  key={
                    index
                  }
                  className="posho-form-grid"
                  style={{
                    borderTop:
                      '1px solid var(--posho-line)',
                    paddingTop: 12,
                    marginTop: 12,
                  }}
                >
                  <label>
                    <span>
                      Action
                    </span>

                    <select
                      value={
                        item.kind
                      }
                      onChange={(
                        event,
                      ) =>
                        setForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            actions:
                              current.actions.map(
                                (
                                  row,
                                  position,
                                ) =>
                                  position ===
                                  index
                                    ? {
                                        ...row,
                                        kind: event
                                          .target
                                          .value,
                                      }
                                    : row,
                              ),
                          }),
                        )
                      }
                    >
                      {ACTION_KINDS.map(
                        (
                          kind,
                        ) => (
                          <option
                            key={
                              kind
                            }
                            value={
                              kind
                            }
                          >
                            {pretty(
                              kind,
                            )}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  {item.kind ===
                    'create_task' && (
                    <>
                      <label>
                        <span>
                          Task title
                        </span>

                        <input
                          value={
                            item.title
                          }
                          onChange={(
                            event,
                          ) =>
                            setForm(
                              (
                                current,
                              ) => ({
                                ...current,
                                actions:
                                  current.actions.map(
                                    (
                                      row,
                                      position,
                                    ) =>
                                      position ===
                                      index
                                        ? {
                                            ...row,
                                            title:
                                              event
                                                .target
                                                .value,
                                          }
                                        : row,
                                  ),
                              }),
                            )
                          }
                          maxLength={200}
                        />
                      </label>

                      <label>
                        <span>
                          Description
                        </span>

                        <input
                          value={
                            item.description
                          }
                          onChange={(
                            event,
                          ) =>
                            setForm(
                              (
                                current,
                              ) => ({
                                ...current,
                                actions:
                                  current.actions.map(
                                    (
                                      row,
                                      position,
                                    ) =>
                                      position ===
                                      index
                                        ? {
                                            ...row,
                                            description:
                                              event
                                                .target
                                                .value,
                                          }
                                        : row,
                                  ),
                              }),
                            )
                          }
                          maxLength={2000}
                        />
                      </label>
                    </>
                  )}

                  {item.kind ===
                    'create_client_action' && (
                    <label>
                      <span>
                        Client action
                        label
                      </span>

                      <input
                        value={
                          item.label
                        }
                        onChange={(
                          event,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              actions:
                                current.actions.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          label:
                                            event
                                              .target
                                              .value,
                                        }
                                      : row,
                                ),
                            }),
                          )
                        }
                        maxLength={200}
                      />
                    </label>
                  )}

                  {item.kind ===
                    'move_project_phase' && (
                    <label>
                      <span>
                        Phase
                      </span>

                      <input
                        value={
                          item.phase
                        }
                        onChange={(
                          event,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              actions:
                                current.actions.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          phase:
                                            event
                                              .target
                                              .value,
                                        }
                                      : row,
                                ),
                            }),
                          )
                        }
                        placeholder="awaiting_payment"
                        maxLength={60}
                      />
                    </label>
                  )}

                  {item.kind ===
                    'set_due_date' && (
                    <label>
                      <span>
                        Days from now
                      </span>

                      <input
                        type="number"
                        step="1"
                        value={
                          item.days_from_now
                        }
                        onChange={(
                          event,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              actions:
                                current.actions.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          days_from_now:
                                            event
                                              .target
                                              .value,
                                        }
                                      : row,
                                ),
                            }),
                          )
                        }
                      />
                    </label>
                  )}

                  {item.kind ===
                    'create_notification' && (
                    <label>
                      <span>
                        Message to client
                      </span>

                      <textarea
                        value={
                          item.message
                        }
                        onChange={(
                          event,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              actions:
                                current.actions.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          message:
                                            event
                                              .target
                                              .value,
                                        }
                                      : row,
                                ),
                            }),
                          )
                        }
                        maxLength={2000}
                      />
                    </label>
                  )}

                  {item.kind ===
                    'create_checklist' && (
                    <label>
                      <span>
                        Checklist items
                        (one per line)
                      </span>

                      <textarea
                        value={
                          item.items
                        }
                        onChange={(
                          event,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              actions:
                                current.actions.map(
                                  (
                                    row,
                                    position,
                                  ) =>
                                    position ===
                                    index
                                      ? {
                                          ...row,
                                          items:
                                            event
                                              .target
                                              .value,
                                        }
                                      : row,
                                ),
                            }),
                          )
                        }
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          actions:
                            current.actions.filter(
                              (
                                _,
                                position,
                              ) =>
                                position !==
                                index,
                            ),
                        }),
                      )
                    }
                  >
                    <Icon name="close"                       size={15}
                    />
                    Remove
                  </button>
                </div>
              ),
            )}

            <div className="finance-review-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={
                  addAction
                }
              >
                Add action
              </button>
            </div>

            <p className="admin-card-description">
              Email and financial actions
              are never available here.
            </p>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setForm(
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
                  : 'Save rule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
