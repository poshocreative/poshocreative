import {
  useCallback,
  useEffect,
  useState,
} from 'react';


import Icon from '../components/ui/Icon';
import BrandLoader from '../components/BrandLoader';
import PageHeader from '../components/ui/PageHeader';
import Tabs from '../components/ui/Tabs';
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
  getKnowledge,
  getTeam,
  runOperationsAction,
} from '../lib/operations';

import {
  supabase,
} from '../lib/supabase';

const SETTING_FIELDS = [
  {
    key: 'quote_validity_days',
    label: 'Default quote validity (days)',
    type: 'number',
  },
  {
    key: 'payment_deadline_days',
    label: 'Default payment deadline (days)',
    type: 'number',
  },
  {
    key: 'default_revision_allowance',
    label: 'Default revision allowance',
    type: 'number',
  },
  {
    key: 'currency',
    label: 'Currency',
    type: 'text',
  },
  {
    key: 'business_timezone',
    label: 'Business timezone',
    type: 'text',
  },
];

const FLAG_LABELS = {
  sales_crm:
    'Sales CRM (leads, pipeline, proposals)',
  proposals:
    'Proposals and agreements',
  requests:
    'Service requests',
  retainers:
    'Retainers',
  proofing:
    'Creative proofing annotations',
  time_tracking:
    'Time tracking',
  automations:
    'Automation engine',
  organizations:
    'Client organizations',
  team: 'Team accounts',
};

export default function AdminSettings() {
  const toast =
    useToast();

  const [
    tab,
    setTab,
  ] =
    useState(
      'business',
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
    settings,
    setSettings,
  ] =
    useState([]);

  const [
    flags,
    setFlags,
  ] =
    useState([]);

  const [
    sops,
    setSops,
  ] =
    useState([]);

  const [
    members,
    setMembers,
  ] =
    useState([]);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    health,
    setHealth,
  ] =
    useState(null);

  const [
    sopForm,
    setSopForm,
  ] =
    useState(null);

  useEscapeClose(
    Boolean(
      sopForm,
    ) && !busy,
    () =>
      setSopForm(
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

          const [
            knowledge,
            team,
          ] =
            await Promise.all([
              getKnowledge(),
              getTeam().catch(
                () => ({
                  members: [],
                }),
              ),
            ]);

          setSettings(
            knowledge.settings,
          );
          setFlags(
            knowledge.flags,
          );
          setSops(
            knowledge.sops,
          );
          setMembers(
            team.members,
          );

          try {
            const checks =
              await Promise.all([
                supabase
                  .from(
                    'orders',
                  )
                  .select(
                    'id',
                    {
                      count:
                        'exact',
                      head: true,
                    },
                  )
                  .then(
                    (
                      result,
                    ) => ({
                      ok: !result.error,
                    }),
                    () => ({
                      ok: false,
                    }),
                  ),
                supabase.storage
                  .from(
                    'project-references',
                  )
                  .list(
                    '',
                    {
                      limit: 1,
                    },
                  )
                  .then(
                    (
                      result,
                    ) => ({
                      ok: !result.error,
                    }),
                    () => ({
                      ok: false,
                    }),
                  ),
                supabase
                  .from(
                    'payment_transactions',
                  )
                  .select(
                    'id,created_at',
                  )
                  .eq(
                    'status',
                    'successful',
                  )
                  .order(
                    'created_at',
                    {
                      ascending:
                        false,
                    },
                  )
                  .limit(1)
                  .then(
                    (
                      result,
                    ) => ({
                      ok: !result.error,
                      last:
                        result
                          .data?.[0]
                          ?.created_at ||
                        null,
                    }),
                    () => ({
                      ok: false,
                      last: null,
                    }),
                  ),
              ]);

            setHealth({
              database:
                checks[0].ok,
              storage:
                checks[1].ok,
              lastPayment:
                checks[2].last,
            });
          } catch {
            setHealth(
              null,
            );
          }
        } catch (loadError) {
          setError(
            loadError.message ||
              'Settings could not be loaded.',
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
      'Settings | Posho Creative Management';

    load();
  }, [
    load,
  ]);

  const settingValue = (
    key,
  ) => {
    const found = settings.find(
      (
        setting,
      ) =>
        setting.key ===
        key,
    );

    return found
      ? found.value
      : '';
  };

  const saveSetting = async (
    key,
    value,
  ) => {
    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'setting_save',
        key,
        value,
      });

      toast.success(
        'Setting saved.',
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

  const toggleFlag = async (
    key,
    enabled,
  ) => {
    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'flag_toggle',
        key,
        enabled,
      });

      toast.success(
        `Feature ${enabled ? 'enabled' : 'disabled'}. Disabled modules hide from navigation but keep their data.`,
      );
      await load();
    } catch (flagError) {
      toast.error(
        flagError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const saveSop = async (
    event,
  ) => {
    event.preventDefault();

    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'sop_save',
        id:
          sopForm.id ||
          undefined,
        title:
          sopForm.title.trim(),
        body:
          sopForm.body.trim(),
        service_slug:
          sopForm.service_slug.trim() ||
          null,
        role:
          sopForm.role.trim() ||
          null,
      });

      toast.success(
        'SOP saved. Internal only — never shown to clients.',
      );
      setSopForm(
        null,
      );
      await load();
    } catch (sopError) {
      toast.error(
        sopError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  if (loading) {
    return (
      <BrandLoader label="Loading settings…" />
    );
  }

  return (
    <div className="admin-view page-reveal">
      <PageHeader
        kicker="Control"
        title="Settings"
        description="Business rules, feature releases, internal procedures and platform health."
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
            key: 'business',
            label: 'Business rules',
          },
          {
            key: 'features',
            label: 'Features',
          },
          {
            key: 'sops',
            label: 'SOPs',
          },
          {
            key: 'security',
            label: 'Security',
          },
          {
            key: 'health',
            label: 'System health',
          },
        ]}
        active={
          tab
        }
        onChange={
          setTab
        }
        label="Settings sections"
      />

      {tab ===
        'business' && (
        <section className="admin-control-card">
          <span className="posho-section-label">
            Policy, not hard code
          </span>

          <div className="posho-form-grid">
            {SETTING_FIELDS.map(
              (
                field,
              ) => (
                <form
                  key={
                    field.key
                  }
                  onSubmit={(
                    event,
                  ) => {
                    event.preventDefault();

                    const input =
                      event.target.elements.namedItem(
                        'value',
                      );

                    saveSetting(
                      field.key,
                      field.type ===
                      'number'
                        ? Number(
                            input.value,
                          )
                        : input.value,
                    );
                  }}
                  className="posho-grid-auto"
                >
                  <label>
                    <span>
                      {
                        field.label
                      }
                    </span>

                    <input
                      name="value"
                      type={
                        field.type
                      }
                      defaultValue={
                        settingValue(
                          field.key,
                        ) ?? ''
                      }
                      key={`${field.key}-${JSON.stringify(settingValue(field.key))}`}
                    />
                  </label>

                  <button
                    type="submit"
                    className="button button-secondary"
                    disabled={
                      busy
                    }
                  >
                    Save
                  </button>
                </form>
              ),
            )}
          </div>

          <p className="admin-card-description">
            Security-critical rules stay in
            code and database policy — never
            here.
          </p>
        </section>
      )}

      {tab ===
        'features' && (
        <section className="admin-control-card">
          <span className="posho-section-label">
            Gradual release
          </span>

          {flags.length ===
          0 ? (
            <p className="admin-card-description">
              Feature flags are unavailable
              until the Phase 3 tables
              exist.
            </p>
          ) : (
            <div className="posho-ledger">
              {flags.map(
                (
                  flag,
                ) => (
                  <article
                    key={
                      flag.key
                    }
                    className="posho-ledger-item"
                  >
                    <header>
                      <strong>
                        {FLAG_LABELS[
                          flag.key
                        ] ||
                          flag.key}
                      </strong>

                      <StatusBadge
                        value={
                          flag.enabled
                            ? 'active'
                            : 'disabled'
                        }
                      />
                    </header>

                    <div className="finance-review-actions">
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          toggleFlag(
                            flag.key,
                            !flag.enabled,
                          )
                        }
                      >
                        {flag.enabled
                          ? 'Disable'
                          : 'Enable'}
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}

          <p className="admin-card-description">
            Flags gate visibility, never
            authorization. Permissions still
            enforce every action.
          </p>
        </section>
      )}

      {tab ===
        'sops' && (
        <>
          <div className="finance-review-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                setSopForm({
                  id: '',
                  title: '',
                  body: '',
                  service_slug: '',
                  role: '',
                })
              }
            >
              <Icon name="add"                 size={17}
              />
              New SOP
            </button>
          </div>

          {sops.length ===
          0 ? (
            <EmptyState
              title="No SOPs yet"
              body="Checklists for delivery, payments, complaints and handover live here — internal only."
            />
          ) : (
            <div className="admin-data-card">
              {sops.map(
                (
                  sop,
                ) => (
                  <article
                    key={
                      sop.id
                    }
                    className="admin-data-row"
                  >
                    <div>
                      <strong className="posho-long-value">
                        {
                          sop.title
                        }
                      </strong>

                      <span>
                        {sop.service_slug ||
                          'All services'}
                        {sop.role
                          ? ` · ${sop.role}`
                          : ''}
                      </span>
                    </div>

                    <div className="finance-review-actions">
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() =>
                          setSopForm({
                            id: sop.id,
                            title:
                              sop.title,
                            body:
                              sop.body,
                            service_slug:
                              sop.service_slug ||
                              '',
                            role:
                              sop.role ||
                              '',
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
                        aria-label={`Delete ${sop.title}`}
                        onClick={async () => {
                          try {
                            setBusy(
                              true,
                            );

                            await runOperationsAction(
                              {
                                action:
                                  'sop_delete',
                                id: sop.id,
                              },
                            );

                            toast.success(
                              'SOP deleted.',
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
                        <Icon name="delete"                           size={15}
                        />
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}

          {sopForm && (
            <div
              className="posho-modal-backdrop"
              onClick={() =>
                !busy &&
                setSopForm(
                  null,
                )
              }
            >
              <form
                role="dialog"
                aria-modal="true"
                aria-label="SOP editor"
                className="posho-modal posho-modal-wide"
                onClick={(
                  event,
                ) =>
                  event.stopPropagation()
                }
                onSubmit={
                  saveSop
                }
              >
                <div className="posho-modal-heading">
                  <h3>
                    {sopForm.id
                      ? 'Edit SOP'
                      : 'New SOP'}
                  </h3>

                  <button
                    type="button"
                    onClick={() =>
                      setSopForm(
                        null,
                      )
                    }
                    aria-label="Close SOP editor"
                    disabled={
                      busy
                    }
                  >
                    <Icon name="close"                       size={19}
                    />
                  </button>
                </div>

                <div className="posho-form-grid">
                  <label>
                    <span>
                      Title
                    </span>

                    <input
                      value={
                        sopForm.title
                      }
                      onChange={(
                        event,
                      ) =>
                        setSopForm(
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
                      Procedure
                    </span>

                    <textarea
                      value={
                        sopForm.body
                      }
                      onChange={(
                        event,
                      ) =>
                        setSopForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            body: event
                              .target
                              .value,
                          }),
                        )
                      }
                      required
                      rows={8}
                    />
                  </label>

                  <label>
                    <span>
                      Service (optional)
                    </span>

                    <input
                      value={
                        sopForm.service_slug
                      }
                      onChange={(
                        event,
                      ) =>
                        setSopForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            service_slug:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      maxLength={80}
                    />
                  </label>

                  <label>
                    <span>
                      Role (optional)
                    </span>

                    <input
                      value={
                        sopForm.role
                      }
                      onChange={(
                        event,
                      ) =>
                        setSopForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            role: event
                              .target
                              .value,
                          }),
                        )
                      }
                      maxLength={40}
                    />
                  </label>
                </div>

                <div className="posho-modal-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() =>
                      setSopForm(
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
                      : 'Save SOP'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {tab ===
        'security' && (
        <section className="admin-control-card">
          <span className="posho-section-label">
            Access overview
          </span>

          <h3>
            Who can operate
          </h3>

          <p className="admin-card-description">
            No session tokens or secrets are
            shown here. Owner access uses
            the existing protected session.
          </p>

          {members.length ===
          0 ? (
            <p className="admin-card-description">
              Single-admin mode — only the
              owner account has access.
            </p>
          ) : (
            <div className="posho-ledger">
              {members.map(
                (
                  member,
                ) => (
                  <article
                    key={
                      member.id
                    }
                    className="posho-ledger-item"
                  >
                    <header>
                      <strong>
                        {
                          member.display_name
                        }
                      </strong>

                      <StatusBadge
                        value={
                          member.status
                        }
                      />
                    </header>

                    <p>
                      {member.role} ·{' '}
                      {(
                        member.capabilities ||
                        []
                      ).length}{' '}
                      capabilities ·{' '}
                      {member.user_id
                        ? 'account linked'
                        : 'no sign-in linked'}
                    </p>
                  </article>
                ),
              )}
            </div>
          )}

          <p className="admin-card-description">
            Email login codes and one-time
            passwords remain disabled until
            transactional email is
            configured and approved.
          </p>
        </section>
      )}

      {tab ===
        'health' && (
        <section className="admin-control-card">
          <span className="posho-section-label">
            Platform health
          </span>

          <h3>
            Connectivity
          </h3>

          {!health ? (
            <p className="admin-card-description">
              Health checks could not run.
            </p>
          ) : (
            <div className="posho-kv">
              <div>
                <span>
                  Database
                </span>

                <strong>
                  {health.database
                    ? 'Reachable'
                    : 'Unreachable'}
                </strong>
              </div>

              <div>
                <span>
                  File storage
                </span>

                <strong>
                  {health.storage
                    ? 'Reachable'
                    : 'Unreachable'}
                </strong>
              </div>

              <div>
                <span>
                  Last verified payment
                </span>

                <strong>
                  {health.lastPayment
                    ? new Date(
                        health.lastPayment,
                      ).toLocaleString(
                        'en-NG',
                      )
                    : 'None yet'}
                </strong>
              </div>
            </div>
          )}

          <p className="admin-card-description">
            Keys, tokens and webhook
            secrets are never displayed.
          </p>
        </section>
      )}
    </div>
  );
}
