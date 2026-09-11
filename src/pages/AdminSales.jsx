import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CalendarClock,
  FileText,
  Plus,
  Search,
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
  getLeadDetail,
  getLeads,
  getMeetings,
  getProposals,
  getServicesHub,
  runSalesAction,
} from '../lib/sales';

import {
  formatNaira,
} from '../lib/reports';

const PIPELINE = [
  'new',
  'contacted',
  'qualified',
  'discovery',
  'proposal_prepared',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
];

const SOURCES = [
  'google',
  'instagram',
  'whatsapp',
  'referral',
  'existing_client',
  'website',
  'linkedin',
  'facebook',
  'offline',
  'other',
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
  dateValue,
) {
  if (!dateValue) {
    return false;
  }

  return (
    dateValue <
    new Date()
      .toISOString()
      .slice(
        0,
        10,
      )
  );
}

const emptyLead = {
  id: '',
  name: '',
  company: '',
  email: '',
  phone: '',
  source: 'other',
  service_slug: '',
  expected_value_kobo: '',
  notes: '',
  next_action: '',
  next_action_due: '',
};

export default function AdminSales() {
  const toast =
    useToast();

  const [
    tab,
    setTab,
  ] =
    useState(
      'leads',
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
    leads,
    setLeads,
  ] =
    useState([]);

  const [
    proposals,
    setProposals,
  ] =
    useState([]);

  const [
    meetings,
    setMeetings,
  ] =
    useState([]);

  const [
    services,
    setServices,
  ] =
    useState([]);

  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    view,
    setView,
  ] =
    useState(
      'kanban',
    );

  const [
    leadForm,
    setLeadForm,
  ] =
    useState(null);

  const [
    leadBusy,
    setLeadBusy,
  ] =
    useState(false);

  const [
    duplicates,
    setDuplicates,
  ] =
    useState([]);

  const [
    detail,
    setDetail,
  ] =
    useState(null);

  const [
    detailLoading,
    setDetailLoading,
  ] =
    useState(false);

  const [
    stageBusy,
    setStageBusy] =
    useState(false);

  const [
    lostReason,
    setLostReason] =
    useState('');

  const [
    showLost,
    setShowLost] =
    useState(false);

  const [
    contactNote,
    setContactNote] =
    useState('');

  const [
    contactNext,
    setContactNext] =
    useState('');

  const [
    contactDue,
    setContactDue] =
    useState('');

  const [
    proposalForm,
    setProposalForm] =
    useState(null);

  const [
    proposalBusy,
    setProposalBusy] =
    useState(false);

  const [
    proposalItems,
    setProposalItems] =
    useState([]);

  const [
    meetingForm,
    setMeetingForm] =
    useState(null);

  const [
    meetingBusy,
    setMeetingBusy] =
    useState(false);

  const [
    preview,
    setPreview] =
    useState(null);

  useEscapeClose(
    Boolean(
      leadForm,
    ) &&
      !leadBusy,
    () =>
      setLeadForm(
        null,
      ),
  );

  useEscapeClose(
    Boolean(
      detail,
    ) &&
      !stageBusy,
    () =>
      setDetail(
        null,
      ),
  );

  useEscapeClose(
    Boolean(
      proposalForm,
    ) &&
      !proposalBusy,
    () =>
      setProposalForm(
        null,
      ),
  );

  useEscapeClose(
    Boolean(
      meetingForm,
    ) &&
      !meetingBusy,
    () =>
      setMeetingForm(
        null,
      ),
  );

  useEscapeClose(
    Boolean(
      preview,
    ),
    () =>
      setPreview(
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
            leadRows,
            proposalRows,
            meetingRows,
            hub,
          ] =
            await Promise.all([
              getLeads(),
              getProposals(),
              getMeetings(),
              getServicesHub().catch(
                () => ({
                  catalog:
                    [],
                }),
              ),
            ]);

          setLeads(
            leadRows,
          );
          setProposals(
            proposalRows,
          );
          setMeetings(
            meetingRows,
          );
          setServices(
            hub.catalog ||
              [],
          );
        } catch (loadError) {
          setError(
            loadError.message ||
              'Sales data could not be loaded.',
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
      'Sales | Posho Creative Management';

    load();
  }, [
    load,
  ]);

  const openLead = async (
    id,
  ) => {
    try {
      setDetailLoading(
        true,
      );
      setDetail({
        lead: null,
      });

      const result =
        await getLeadDetail(
          id,
        );

      setDetail(
        result,
      );
    } catch (detailError) {
      toast.error(
        detailError.message,
      );
      setDetail(
        null,
      );
    } finally {
      setDetailLoading(
        false,
      );
    }
  };

  const filteredLeads =
    useMemo(() => {
      const needle =
        query
          .trim()
          .toLowerCase();

      return leads.filter(
        (
          lead,
        ) => {
          if (
            !needle
          ) {
            return true;
          }

          return [
            lead.name,
            lead.company,
            lead.email,
            lead.phone,
            lead.reference,
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
            );
        },
      );
    }, [
      leads,
      query,
    ]);

  const metrics =
    useMemo(() => {
      const active = leads.filter(
        (
          lead,
        ) =>
          ![
            'won',
            'lost',
            'archived',
          ].includes(
            lead.stage,
          ),
      );

      const pipelineValue =
        active.reduce(
          (
            sum,
            lead,
          ) =>
            sum +
            Number(
              lead.expected_value_kobo ||
                0,
            ),
          0,
        );

      const noAction =
        active.filter(
          (
            lead,
          ) => !lead.next_action,
        ).length;

      const overdueAction =
        active.filter(
          (
            lead,
          ) =>
            lead.next_action &&
            isOverdue(
              lead.next_action_due,
            ),
        ).length;

      return {
        active:
          active.length,
        pipelineValue,
        noAction,
        overdueAction,
      };
    }, [
      leads,
    ]);

  const saveLead = async (
    event,
  ) => {
    event?.preventDefault?.();

    if (
      !leadForm.name.trim()
    ) {
      toast.error(
        'Give the lead a name.',
      );

      return;
    }

    try {
      setLeadBusy(
        true,
      );

      const result =
        await runSalesAction({
          action:
            'lead_save',
          id:
            leadForm.id ||
            undefined,
          name:
            leadForm.name.trim(),
          company:
            leadForm.company.trim(),
          email:
            leadForm.email.trim(),
          phone:
            leadForm.phone.trim(),
          source:
            leadForm.source,
          service_slug:
            leadForm.service_slug,
          expected_value_kobo:
            Math.round(
              Number(
                leadForm.expected_value_kobo ||
                  0,
              ) * 100,
            ),
          notes:
            leadForm.notes.trim(),
          next_action:
            leadForm.next_action.trim(),
          next_action_due:
            leadForm.next_action_due ||
            null,
        });

      if (
        result.duplicates &&
        result.duplicates
          .length >
          0
      ) {
        setDuplicates(
          result.duplicates,
        );
        toast.info(
          'Saved — but possible duplicates were found. Review before converting.',
        );
      } else {
        setDuplicates(
          [],
        );
        toast.success(
          leadForm.id
            ? 'Lead updated.'
            : 'Lead added to the pipeline.',
        );
      }

      setLeadForm(
        null,
      );
      await load();

      if (
        detail
      ) {
        await openLead(
          result.leadId,
        );
      }
    } catch (saveError) {
      toast.error(
        saveError.message,
      );
    } finally {
      setLeadBusy(
        false,
      );
    }
  };

  const moveStage = async (
    stage,
  ) => {
    if (
      !detail?.lead
    ) {
      return;
    }

    if (
      stage ===
        'lost' &&
      !lostReason.trim()
    ) {
      setShowLost(
        true,
      );

      return;
    }

    try {
      setStageBusy(
        true,
      );

      await runSalesAction({
        action:
          'lead_stage',
        id: detail.lead
          .id,
        stage,
        lost_reason:
          lostReason.trim(),
      });

      toast.success(
        `Lead moved to ${pretty(stage)}.`,
      );
      setShowLost(
        false,
      );
      setLostReason(
        '',
      );
      await load();
      await openLead(
        detail.lead
          .id,
      );
    } catch (stageError) {
      toast.error(
        stageError.message,
      );
    } finally {
      setStageBusy(
        false,
      );
    }
  };

  const logContact = async (
    event,
  ) => {
    event.preventDefault();

    if (
      !contactNote.trim()
    ) {
      toast.error(
        'Record what was discussed.',
      );

      return;
    }

    try {
      setStageBusy(
        true,
      );

      await runSalesAction({
        action:
          'lead_contact',
        id: detail.lead
          .id,
        note:
          contactNote.trim(),
        next_action:
          contactNext.trim(),
        next_action_due:
          contactDue ||
          null,
      });

      toast.success(
        'Contact logged.',
      );
      setContactNote(
        '',
      );
      setContactNext(
        '',
      );
      setContactDue(
        '',
      );
      await load();
      await openLead(
        detail.lead
          .id,
      );
    } catch (contactError) {
      toast.error(
        contactError.message,
      );
    } finally {
      setStageBusy(
        false,
      );
    }
  };

  const convertLead = async (
    createProject,
  ) => {
    if (
      !detail?.lead
    ) {
      return;
    }

    if (
      !detail.lead
        .email
    ) {
      toast.error(
        'Add an email address before converting.',
      );

      return;
    }

    try {
      setStageBusy(
        true,
      );

      const result =
        await runSalesAction({
          action:
            'lead_convert',
          id: detail.lead
            .id,
          createProject,
        });

      toast.success(
        result.alreadyConverted
          ? 'This lead was already converted.'
          : createProject
            ? 'Converted to client with a new project.'
            : 'Converted to client.',
      );
      await load();
      await openLead(
        detail.lead
          .id,
      );
    } catch (convertError) {
      toast.error(
        convertError.message,
      );
    } finally {
      setStageBusy(
        false,
      );
    }
  };

  const saveProposal = async (
    event,
  ) => {
    event.preventDefault();

    const rows =
      proposalItems.filter(
        (
          item,
        ) =>
          item.title.trim(),
      );

    if (
      !proposalForm.title.trim()
    ) {
      toast.error(
        'Give the proposal a title.',
      );

      return;
    }

    if (
      rows.length ===
      0
    ) {
      toast.error(
        'Add at least one commercial item.',
      );

      return;
    }

    try {
      setProposalBusy(
        true,
      );

      await runSalesAction({
        action:
          'proposal_save',
        id:
          proposalForm.id ||
          undefined,
        lead_id:
          proposalForm.lead_id ||
          null,
        order_id:
          proposalForm.order_id ||
          null,
        customer_id:
          proposalForm.customer_id ||
          null,
        title:
          proposalForm.title.trim(),
        overview:
          proposalForm.overview.trim(),
        goals:
          proposalForm.goals.trim(),
        scope:
          proposalForm.scope.trim(),
        deliverables:
          proposalForm.deliverables.trim(),
        timeline:
          proposalForm.timeline.trim(),
        terms:
          proposalForm.terms.trim(),
        valid_until:
          proposalForm.valid_until ||
          null,
        discount_kobo:
          Math.round(
            Number(
              proposalForm.discount ||
                0,
            ) * 100,
          ),
        items: rows.map(
          (
            item,
          ) => ({
            title:
              item.title.trim(),
            description:
              item.description.trim(),
            quantity:
              Number(
                item.quantity ||
                  1,
              ),
            unit_price_kobo:
              Math.round(
                Number(
                  item.unit_price ||
                    0,
                ) * 100,
              ),
          }),
        ),
      });

      toast.success(
        'Proposal saved as draft.',
      );
      setProposalForm(
        null,
      );
      setProposalItems(
        [],
      );
      await load();
    } catch (proposalError) {
      toast.error(
        proposalError.message,
      );
    } finally {
      setProposalBusy(
        false,
      );
    }
  };

  const proposalAction = async (
    id,
    action,
    extra = {},
  ) => {
    try {
      setProposalBusy(
        true,
      );

      await runSalesAction({
        action,
        id,
        ...extra,
      });

      toast.success(
        'Proposal updated.',
      );
      await load();
    } catch (proposalError) {
      toast.error(
        proposalError.message,
      );
    } finally {
      setProposalBusy(
        false,
      );
    }
  };

  const saveMeeting = async (
    event,
  ) => {
    event.preventDefault();

    try {
      setMeetingBusy(
        true,
      );

      await runSalesAction({
        action:
          'meeting_save',
        id:
          meetingForm.id ||
          undefined,
        lead_id:
          meetingForm.lead_id ||
          null,
        customer_id:
          meetingForm.customer_id ||
          null,
        order_id:
          meetingForm.order_id ||
          null,
        kind:
          meetingForm.kind,
        scheduled_at:
          meetingForm.scheduled_at,
        duration_minutes:
          meetingForm.duration_minutes,
        participants:
          meetingForm.participants.trim(),
        notes:
          meetingForm.notes.trim(),
      });

      toast.success(
        'Meeting scheduled. The client is notified in-app.',
      );
      setMeetingForm(
        null,
      );
      await load();
    } catch (meetingError) {
      toast.error(
        meetingError.message,
      );
    } finally {
      setMeetingBusy(
        false,
      );
    }
  };

  if (loading) {
    return (
      <BrandLoader label="Loading sales…" />
    );
  }

  return (
    <div className="admin-view page-reveal">
      <PageHeader
        kicker="Sales"
        title="Pipeline and proposals"
        description="Follow every inquiry until it becomes a client. No lead disappears silently."
        actions={
          <>
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                setMeetingForm({
                  id: '',
                  lead_id: '',
                  customer_id: '',
                  order_id: '',
                  kind: 'discovery',
                  scheduled_at: '',
                  duration_minutes: 30,
                  participants: '',
                  notes: '',
                })
              }
            >
              <CalendarClock
                size={17}
              />
              Schedule meeting
            </button>

            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                setLeadForm({
                  ...emptyLead,
                })
              }
            >
              <Plus
                size={17}
              />
              New lead
            </button>
          </>
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
          label="Active leads"
          value={
            metrics.active
          }
          detail="Across the pipeline"
        />

        <MetricCard
          label="Pipeline value"
          value={formatNaira(
            metrics.pipelineValue,
          )}
          detail="Expected value, active leads"
          tone="purple"
        />

        <MetricCard
          label="No next action"
          value={
            metrics.noAction
          }
          detail="Leads that can go cold"
          tone={
            metrics.noAction >
            0
              ? 'amber'
              : 'neutral'
          }
        />

        <MetricCard
          label="Overdue follow-ups"
          value={
            metrics.overdueAction
          }
          detail="Past their next-action date"
          tone={
            metrics.overdueAction >
            0
              ? 'red'
              : 'neutral'
          }
        />
      </div>

      <Tabs
        tabs={[
          {
            key: 'leads',
            label: 'Leads',
          },
          {
            key: 'proposals',
            label: 'Proposals',
            count:
              proposals.filter(
                (
                  proposal,
                ) =>
                  [
                    'ready',
                    'sent',
                    'viewed',
                  ].includes(
                    proposal.status,
                  ),
              ).length,
          },
          {
            key: 'meetings',
            label: 'Meetings',
          },
        ]}
        active={
          tab
        }
        onChange={
          setTab
        }
        label="Sales sections"
      />

      {tab ===
        'leads' && (
        <>
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
                    event
                      .target
                      .value,
                  )
                }
                placeholder="Search name, company, email, phone…"
                aria-label="Search leads"
              />
            </label>

            <label>
              <span className="posho-section-label">
                View
              </span>

              <select
                value={
                  view
                }
                onChange={(
                  event,
                ) =>
                  setView(
                    event.target
                      .value,
                  )
                }
                aria-label="Pipeline view"
              >
                <option value="kanban">
                  Kanban
                </option>

                <option value="list">
                  List
                </option>
              </select>
            </label>
          </div>

          {filteredLeads.length ===
          0 ? (
            <EmptyState
              title="No leads here"
              body="Add the first inquiry and give it a next action with a date."
              action={
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() =>
                    setLeadForm({
                      ...emptyLead,
                    })
                  }
                >
                  New lead
                </button>
              }
            />
          ) : view ===
            'list' ? (
            <div className="admin-data-card">
              {filteredLeads.map(
                (
                  lead,
                ) => (
                  <button
                    key={
                      lead.id
                    }
                    type="button"
                    className="admin-data-row admin-data-row-button"
                    onClick={() =>
                      openLead(
                        lead.id,
                      )
                    }
                  >
                    <div>
                      <strong className="posho-long-value">
                        {lead.company ||
                          lead.name}
                      </strong>

                      <span className="posho-long-value">
                        {lead.name}
                        {lead.email
                          ? ` · ${lead.email}`
                          : ''}
                      </span>
                    </div>

                    <div>
                      <span>
                        Stage
                      </span>

                      <StatusBadge
                        value={
                          lead.stage
                        }
                      />
                    </div>

                    <div>
                      <span>
                        Value
                      </span>

                      <strong>
                        {formatNaira(
                          lead.expected_value_kobo,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Next action
                      </span>

                      <strong
                        className={
                          !lead.next_action ||
                          isOverdue(
                            lead.next_action_due,
                          )
                            ? 'posho-long-value posho-text-danger'
                            : 'posho-long-value'
                        }
                      >
                        {lead.next_action ||
                          'None set'}
                      </strong>
                    </div>
                  </button>
                ),
              )}
            </div>
          ) : (
            <div className="posho-kanban">
              {PIPELINE.filter(
                (
                  stage,
                ) =>
                  stage !==
                  'archived',
              ).map(
                (
                  stage,
                ) => {
                  const cards =
                    filteredLeads.filter(
                      (
                        lead,
                      ) =>
                        lead.stage ===
                        stage,
                    );

                  return (
                    <section
                      key={
                        stage
                      }
                      className="posho-kanban-column"
                      aria-label={`${pretty(stage)} column`}
                    >
                      <header>
                        <strong>
                          {pretty(
                            stage,
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
                          lead,
                        ) => (
                          <button
                            key={
                              lead.id
                            }
                            type="button"
                            className="posho-kanban-card"
                            onClick={() =>
                              openLead(
                                lead.id,
                              )
                            }
                          >
                            <strong className="posho-long-value">
                              {lead.company ||
                                lead.name}
                            </strong>

                            <span className="posho-long-value">
                              {
                                lead.name
                              }
                            </span>

                            <span>
                              {formatNaira(
                                lead.expected_value_kobo,
                              )}
                            </span>

                            <small
                              className={
                                !lead.next_action ||
                                isOverdue(
                                  lead.next_action_due,
                                )
                                  ? 'posho-text-danger'
                                  : ''
                              }
                            >
                              {lead.next_action
                                ? `${lead.next_action}${
                                    lead.next_action_due
                                      ? ` · ${lead.next_action_due}`
                                      : ''
                                  }`
                                : 'No next action'}
                            </small>
                          </button>
                        ),
                      )}
                    </section>
                  );
                },
              )}
            </div>
          )}
        </>
      )}

      {tab ===
        'proposals' && (
        <>
          <div className="finance-review-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setProposalForm({
                  id: '',
                  lead_id: detail?.lead?.id || '',
                  order_id: '',
                  customer_id: '',
                  title: '',
                  overview: '',
                  goals: '',
                  scope: '',
                  deliverables: '',
                  timeline: '',
                  terms: '',
                  valid_until: '',
                  discount: '',
                });
                setProposalItems([
                  {
                    title: '',
                    description: '',
                    quantity: '1',
                    unit_price: '',
                  },
                ]);
              }}
            >
              <FileText
                size={17}
              />
              New proposal
            </button>
          </div>

          {proposals.length ===
          0 ? (
            <EmptyState
              title="No proposals yet"
              body="Professional proposals with versions live here."
            />
          ) : (
            <div className="admin-data-card">
              {proposals.map(
                (
                  proposal,
                ) => (
                  <article
                    key={
                      proposal.id
                    }
                    className="admin-data-row"
                  >
                    <div>
                      <small className="posho-long-value">
                        {
                          proposal.number
                        }{' '}
                        · V
                        {
                          proposal.version
                        }
                      </small>

                      <strong className="posho-long-value">
                        {
                          proposal.title
                        }
                      </strong>

                      <span>
                        {
                          (
                            proposal.items ||
                            []
                          ).length
                        }{' '}
                        items
                        {proposal.valid_until
                          ? ` · Valid until ${proposal.valid_until}`
                          : ''}
                      </span>
                    </div>

                    <div>
                      <span>
                        Total
                      </span>

                      <strong>
                        {formatNaira(
                          proposal.total_kobo,
                        )}
                      </strong>
                    </div>

                    <div>
                      <StatusBadge
                        value={
                          proposal.status
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
                      {![
                        'accepted',
                        'superseded',
                      ].includes(
                        proposal.status,
                      ) && (
                        <>
                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={
                              proposalBusy
                            }
                            onClick={() => {
                              setProposalForm({
                                id: proposal.id,
                                lead_id:
                                  proposal.lead_id ||
                                  '',
                                order_id:
                                  proposal.order_id ||
                                  '',
                                customer_id:
                                  proposal.customer_id ||
                                  '',
                                title:
                                  proposal.title ||
                                  '',
                                overview:
                                  proposal.overview ||
                                  '',
                                goals:
                                  proposal.goals ||
                                  '',
                                scope:
                                  proposal.scope ||
                                  '',
                                deliverables:
                                  proposal.deliverables ||
                                  '',
                                timeline:
                                  proposal.timeline ||
                                  '',
                                terms:
                                  proposal.terms ||
                                  '',
                                valid_until:
                                  proposal.valid_until ||
                                  '',
                                discount:
                                  proposal.discount_kobo
                                    ? String(
                                        Number(
                                          proposal.discount_kobo,
                                        ) /
                                          100,
                                      )
                                    : '',
                              });
                              setProposalItems(
                                (
                                  proposal.items ||
                                  []
                                ).map(
                                  (
                                    item,
                                  ) => ({
                                    title:
                                      item.title ||
                                      '',
                                    description:
                                      item.description ||
                                      '',
                                    quantity:
                                      String(
                                        item.quantity ??
                                          1,
                                      ),
                                    unit_price:
                                      String(
                                        Number(
                                          item.unit_price_kobo ||
                                            0,
                                        ) /
                                          100,
                                      ),
                                  }),
                                ),
                              );
                            }}
                          >
                            Edit draft
                          </button>

                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={
                              proposalBusy
                            }
                            onClick={() =>
                              proposalAction(
                                proposal.id,
                                'proposal_status',
                                {
                                  status:
                                    'sent',
                                },
                              )
                            }
                          >
                            Mark sent
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() =>
                          setPreview(
                            proposal,
                          )
                        }
                      >
                        Preview as client
                      </button>

                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={
                          proposalBusy
                        }
                        onClick={() =>
                          proposalAction(
                            proposal.id,
                            'proposal_version',
                          )
                        }
                      >
                        New version
                      </button>

                      {proposal.status ===
                        'draft' && (
                        <button
                          type="button"
                          className="button button-secondary"
                          disabled={
                            proposalBusy
                          }
                          onClick={() =>
                            proposalAction(
                              proposal.id,
                              'proposal_delete',
                            )
                          }
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </>
      )}

      {tab ===
        'meetings' && (
        <>
          {meetings.length ===
          0 ? (
            <EmptyState
              title="No meetings scheduled"
              body="Discovery calls, kickoffs and reviews appear here with in-app reminders."
            />
          ) : (
            <div className="admin-data-card">
              {meetings.map(
                (
                  meeting,
                ) => (
                  <article
                    key={
                      meeting.id
                    }
                    className="admin-data-row"
                  >
                    <div>
                      <small>
                        {String(
                          meeting.scheduled_at ||
                            '',
                        ).slice(
                          0,
                          16,
                        ).replace(
                          'T',
                          ' ',
                        )}
                      </small>

                      <strong className="posho-long-value">
                        {pretty(
                          meeting.kind,
                        )}{' '}
                        ·{' '}
                        {meeting.lead
                          ?.company ||
                          meeting.lead
                            ?.name ||
                          'Meeting'}
                      </strong>

                      <span>
                        {meeting.duration_minutes}{' '}
                        min
                        {meeting.participants
                          ? ` · ${meeting.participants}`
                          : ''}
                      </span>
                    </div>

                    <div>
                      <StatusBadge
                        value={
                          meeting.status
                        }
                      />
                    </div>

                    <div className="finance-review-actions">
                      {meeting.status ===
                        'scheduled' && (
                        <>
                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={
                              meetingBusy
                            }
                            onClick={async () => {
                              try {
                                setMeetingBusy(
                                  true,
                                );

                                await runSalesAction(
                                  {
                                    action:
                                      'meeting_status',
                                    id: meeting.id,
                                    status:
                                      'completed',
                                  },
                                );

                                toast.success(
                                  'Meeting completed.',
                                );
                                await load();
                              } catch (
                                meetingError
                              ) {
                                toast.error(
                                  meetingError.message,
                                );
                              } finally {
                                setMeetingBusy(
                                  false,
                                );
                              }
                            }}
                          >
                            Complete
                          </button>

                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={
                              meetingBusy
                            }
                            onClick={() =>
                              runSalesAction({
                                action:
                                  'meeting_status',
                                id: meeting.id,
                                status:
                                  'cancelled',
                              })
                                .then(
                                  () => {
                                    toast.success(
                                      'Meeting cancelled.',
                                    );

                                    return load();
                                  },
                                )
                                .catch(
                                  (
                                    meetingError,
                                  ) =>
                                    toast.error(
                                      meetingError.message,
                                    ),
                                )
                            }
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </>
      )}

      {leadForm && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !leadBusy &&
            setLeadForm(
              null,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label={
              leadForm.id
                ? 'Edit lead'
                : 'New lead'
            }
            className="posho-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              saveLead
            }
          >
            <div className="posho-modal-heading">
              <h3>
                {leadForm.id
                  ? 'Edit lead'
                  : 'New lead'}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setLeadForm(
                    null,
                  )
                }
                aria-label="Close lead form"
                disabled={
                  leadBusy
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
                  Name
                </span>

                <input
                  value={
                    leadForm.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setLeadForm(
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
                />
              </label>

              <label>
                <span>
                  Company
                </span>

                <input
                  value={
                    leadForm.company
                  }
                  onChange={(
                    event,
                  ) =>
                    setLeadForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        company:
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
                  Email
                </span>

                <input
                  type="email"
                  value={
                    leadForm.email
                  }
                  onChange={(
                    event,
                  ) =>
                    setLeadForm(
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
                  Phone
                </span>

                <input
                  type="tel"
                  value={
                    leadForm.phone
                  }
                  onChange={(
                    event,
                  ) =>
                    setLeadForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        phone:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  maxLength={40}
                />
              </label>

              <label>
                <span>
                  Source
                </span>

                <select
                  value={
                    leadForm.source
                  }
                  onChange={(
                    event,
                  ) =>
                    setLeadForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        source:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  {SOURCES.map(
                    (
                      source,
                    ) => (
                      <option
                        key={
                          source
                        }
                        value={
                          source
                        }
                      >
                        {pretty(
                          source,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Service interest
                </span>

                <select
                  value={
                    leadForm.service_slug
                  }
                  onChange={(
                    event,
                  ) =>
                    setLeadForm(
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
                >
                  <option value="">
                    Not specified
                  </option>

                  {services.map(
                    (
                      service,
                    ) => (
                      <option
                        key={`${service.service_slug}:${service.project_type}`}
                        value={
                          service.service_slug
                        }
                      >
                        {
                          service.title
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Expected value (₦)
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    leadForm.expected_value_kobo
                  }
                  onChange={(
                    event,
                  ) =>
                    setLeadForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        expected_value_kobo:
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
                  Next action
                </span>

                <input
                  value={
                    leadForm.next_action
                  }
                  onChange={(
                    event,
                  ) =>
                    setLeadForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        next_action:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Call client"
                  maxLength={200}
                />
              </label>

              <label>
                <span>
                  Next action date
                </span>

                <input
                  type="date"
                  value={
                    leadForm.next_action_due
                  }
                  onChange={(
                    event,
                  ) =>
                    setLeadForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        next_action_due:
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
                  Notes
                </span>

                <textarea
                  value={
                    leadForm.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    setLeadForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        notes:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  maxLength={5000}
                />
              </label>
            </div>

            {duplicates.length >
              0 && (
              <div
                className="posho-error-block"
                role="alert"
              >
                <strong>
                  Possible duplicates
                </strong>

                <p>
                  {duplicates
                    .map(
                      (
                        duplicate,
                      ) =>
                        duplicate.label,
                    )
                    .join(
                      ', ',
                    )}
                </p>
              </div>
            )}

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setLeadForm(
                    null,
                  )
                }
                disabled={
                  leadBusy
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="button button-primary"
                disabled={
                  leadBusy
                }
                aria-busy={
                  leadBusy
                }
              >
                {leadBusy
                  ? 'Saving…'
                  : 'Save lead'}
              </button>
            </div>
          </form>
        </div>
      )}

      {detailLoading && (
        <div
          className="posho-modal-backdrop"
          aria-hidden="true"
        >
          <div className="posho-modal">
            <p>
              Opening lead…
            </p>
          </div>
        </div>
      )}

      {detail?.lead && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !stageBusy &&
            setDetail(
              null,
            )
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Lead detail"
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
                  LEAD ·{' '}
                  {
                    detail.lead
                      .reference
                  }
                </span>

                <h3>
                  {detail.lead
                    .company ||
                    detail.lead
                      .name}
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setDetail(
                    null,
                  )
                }
                aria-label="Close lead detail"
                disabled={
                  stageBusy
                }
              >
                <X
                  size={19}
                />
              </button>
            </div>

            <div className="posho-form-grid">
              <div>
                <span>
                  Contact
                </span>

                <p className="posho-long-value">
                  {
                    detail.lead
                      .name
                  }
                  {detail.lead
                    .email
                    ? ` · ${detail.lead.email}`
                    : ''}
                  {detail.lead
                    .phone
                    ? ` · ${detail.lead.phone}`
                    : ''}
                </p>
              </div>

              <div>
                <span>
                  Value · Source
                </span>

                <p>
                  {formatNaira(
                    detail.lead
                      .expected_value_kobo,
                  )}{' '}
                  ·{' '}
                  {pretty(
                    detail.lead
                      .source,
                  )}
                </p>
              </div>

              {detail.lead
                .notes && (
                <div>
                  <span>
                    Notes
                  </span>

                  <p>
                    {
                      detail.lead
                        .notes
                    }
                  </p>
                </div>
              )}
            </div>

            <div
              className="finance-review-actions"
              style={{
                marginTop: 12,
              }}
            >
              <span className="posho-section-label">
                Move stage
              </span>

              {[
                'contacted',
                'qualified',
                'discovery',
                'proposal_prepared',
                'proposal_sent',
                'negotiation',
                'won',
                'lost',
              ]
                .filter(
                  (
                    stage,
                  ) =>
                    stage !==
                    detail.lead
                      .stage,
                )
                .map(
                  (
                    stage,
                  ) => (
                    <button
                      key={
                        stage
                      }
                      type="button"
                      className="button button-secondary"
                      disabled={
                        stageBusy
                      }
                      onClick={() =>
                        moveStage(
                          stage,
                        )
                      }
                    >
                      {pretty(
                        stage,
                      )}
                    </button>
                  ),
                )}
            </div>

            {showLost && (
              <form
                onSubmit={(
                  event,
                ) => {
                  event.preventDefault();
                  moveStage(
                    'lost',
                  );
                }}
                className="posho-form-grid"
                style={{
                  marginTop: 12,
                }}
              >
                <label>
                  <span>
                    Why was this lost?
                  </span>

                  <input
                    value={
                      lostReason
                    }
                    onChange={(
                      event,
                    ) =>
                      setLostReason(
                        event
                          .target
                          .value,
                      )
                    }
                    maxLength={500}
                    required
                  />
                </label>

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={
                    stageBusy
                  }
                >
                  {stageBusy
                    ? 'Saving…'
                    : 'Mark lost'}
                </button>
              </form>
            )}

            <div
              className="finance-review-actions"
              style={{
                marginTop: 12,
              }}
            >
              <button
                type="button"
                className="button button-secondary"
                disabled={
                  stageBusy
                }
                onClick={() =>
                  convertLead(
                    false,
                  )
                }
              >
                Convert to client
              </button>

              <button
                type="button"
                className="button button-secondary"
                disabled={
                  stageBusy
                }
                onClick={() =>
                  convertLead(
                    true,
                  )
                }
              >
                Convert + new project
              </button>

              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setLeadForm({
                    id: detail.lead
                      .id,
                    name:
                      detail.lead
                        .name ||
                      '',
                    company:
                      detail.lead
                        .company ||
                      '',
                    email:
                      detail.lead
                        .email ||
                      '',
                    phone:
                      detail.lead
                        .phone ||
                      '',
                    source:
                      detail.lead
                        .source ||
                      'other',
                    service_slug:
                      detail.lead
                        .service_slug ||
                      '',
                    expected_value_kobo:
                      detail.lead
                        .expected_value_kobo
                        ? String(
                            Number(
                              detail
                                .lead
                                .expected_value_kobo,
                            ) /
                              100,
                          )
                        : '',
                    notes:
                      detail.lead
                        .notes ||
                      '',
                    next_action:
                      detail.lead
                        .next_action ||
                      '',
                    next_action_due:
                      detail.lead
                        .next_action_due ||
                      '',
                  })
                }
              >
                Edit
              </button>
            </div>

            <form
              onSubmit={
                logContact
              }
              className="posho-form-grid"
              style={{
                marginTop: 12,
              }}
            >
              <span className="posho-section-label">
                Log contact
              </span>

              <label>
                <span>
                  What was discussed?
                </span>

                <textarea
                  value={
                    contactNote
                  }
                  onChange={(
                    event,
                  ) =>
                    setContactNote(
                      event
                        .target
                        .value,
                    )
                  }
                  maxLength={2000}
                />
              </label>

              <label>
                <span>
                  Next action
                </span>

                <input
                  value={
                    contactNext
                  }
                  onChange={(
                    event,
                  ) =>
                    setContactNext(
                      event
                        .target
                        .value,
                    )
                  }
                  maxLength={200}
                />
              </label>

              <label>
                <span>
                  Next action date
                </span>

                <input
                  type="date"
                  value={
                    contactDue
                  }
                  onChange={(
                    event,
                  ) =>
                    setContactDue(
                      event
                        .target
                        .value,
                    )
                  }
                />
              </label>

              <button
                type="submit"
                className="button button-secondary"
                disabled={
                  stageBusy
                }
              >
                {stageBusy
                  ? 'Saving…'
                  : 'Log contact'}
              </button>
            </form>

            {(detail.proposals
              .length >
              0 ||
              detail.meetings
                .length >
                0 ||
              detail.activity
                .length >
                0) && (
              <div
                style={{
                  marginTop: 16,
                }}
              >
                <span className="posho-section-label">
                  History
                </span>

                <div className="posho-timeline">
                  {[
                    ...detail.proposals.map(
                      (
                        proposal,
                      ) => ({
                        id: `proposal-${proposal.id}`,
                        at: proposal.created_at,
                        title: `Proposal ${proposal.number} · ${formatNaira(proposal.total_kobo)}`,
                        detail:
                          proposal.status,
                      }),
                    ),
                    ...detail.meetings.map(
                      (
                        meeting,
                      ) => ({
                        id: `meeting-${meeting.id}`,
                        at: meeting.scheduled_at,
                        title: `Meeting: ${pretty(meeting.kind)}`,
                        detail:
                          meeting.status,
                      }),
                    ),
                    ...detail.activity.map(
                      (
                        entry,
                      ) => ({
                        id: `activity-${entry.id}`,
                        at: entry.created_at,
                        title:
                          pretty(
                            entry.action,
                          ),
                        detail:
                          entry.note,
                      }),
                    ),
                  ]
                    .sort(
                      (
                        a,
                        b,
                      ) =>
                        new Date(
                          b.at || 0,
                        ).getTime() -
                        new Date(
                          a.at || 0,
                        ).getTime(),
                    )
                    .slice(
                      0,
                      20,
                    )
                    .map(
                      (
                        item,
                      ) => (
                        <div
                          key={
                            item.id
                          }
                          className="posho-timeline-item"
                        >
                          <span
                            className="posho-timeline-dot"
                            aria-hidden="true"
                          />

                          <div className="posho-timeline-body">
                            <strong>
                              {
                                item.title
                              }
                            </strong>

                            {item.detail && (
                              <p>
                                {
                                  item.detail
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {proposalForm && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !proposalBusy &&
            setProposalForm(
              null,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Proposal editor"
            className="posho-modal posho-modal-wide"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              saveProposal
            }
          >
            <div className="posho-modal-heading">
              <h3>
                {proposalForm.id
                  ? 'Edit proposal draft'
                  : 'New proposal'}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setProposalForm(
                    null,
                  )
                }
                aria-label="Close proposal editor"
                disabled={
                  proposalBusy
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
                  Title
                </span>

                <input
                  value={
                    proposalForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setProposalForm(
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
                  Overview
                </span>

                <textarea
                  value={
                    proposalForm.overview
                  }
                  onChange={(
                    event,
                  ) =>
                    setProposalForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        overview:
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
                  Goals
                </span>

                <textarea
                  value={
                    proposalForm.goals
                  }
                  onChange={(
                    event,
                  ) =>
                    setProposalForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        goals:
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
                  Scope
                </span>

                <textarea
                  value={
                    proposalForm.scope
                  }
                  onChange={(
                    event,
                  ) =>
                    setProposalForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        scope:
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
                  Deliverables
                </span>

                <textarea
                  value={
                    proposalForm.deliverables
                  }
                  onChange={(
                    event,
                  ) =>
                    setProposalForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        deliverables:
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
                  Timeline
                </span>

                <input
                  value={
                    proposalForm.timeline
                  }
                  onChange={(
                    event,
                  ) =>
                    setProposalForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        timeline:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  maxLength={3000}
                />
              </label>

              <label>
                <span>
                  Terms
                </span>

                <textarea
                  value={
                    proposalForm.terms
                  }
                  onChange={(
                    event,
                  ) =>
                    setProposalForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        terms:
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
                  Valid until
                </span>

                <input
                  type="date"
                  value={
                    proposalForm.valid_until
                  }
                  onChange={(
                    event,
                  ) =>
                    setProposalForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        valid_until:
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
                  Discount (₦)
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    proposalForm.discount
                  }
                  onChange={(
                    event,
                  ) =>
                    setProposalForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        discount:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                />
              </label>
            </div>

            <span
              className="posho-section-label"
              style={{
                marginTop: 12,
              }}
            >
              Commercial items
            </span>

            {proposalItems.map(
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
                      Item{' '}
                      {index +
                        1}
                    </span>

                    <input
                      value={
                        item.title
                      }
                      onChange={(
                        event,
                      ) =>
                        setProposalItems(
                          (
                            current,
                          ) =>
                            current.map(
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
                        setProposalItems(
                          (
                            current,
                          ) =>
                            current.map(
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
                        )
                      }
                      maxLength={2000}
                    />
                  </label>

                  <div className="posho-grid-trio">
                    <label>
                      <span>
                        Qty
                      </span>

                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={
                          item.quantity
                        }
                        onChange={(
                          event,
                        ) =>
                          setProposalItems(
                            (
                              current,
                            ) =>
                              current.map(
                                (
                                  row,
                                  position,
                                ) =>
                                  position ===
                                  index
                                    ? {
                                        ...row,
                                        quantity:
                                          event
                                            .target
                                            .value,
                                      }
                                    : row,
                              ),
                          )
                        }
                      />
                    </label>

                    <label>
                      <span>
                        Unit price
                        (₦)
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          item.unit_price
                        }
                        onChange={(
                          event,
                        ) =>
                          setProposalItems(
                            (
                              current,
                            ) =>
                              current.map(
                                (
                                  row,
                                  position,
                                ) =>
                                  position ===
                                  index
                                    ? {
                                        ...row,
                                        unit_price:
                                          event
                                            .target
                                            .value,
                                      }
                                    : row,
                              ),
                          )
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="button button-secondary"
                      aria-label={`Remove item ${index + 1}`}
                      onClick={() =>
                        setProposalItems(
                          (
                            current,
                          ) =>
                            current.filter(
                              (
                                _,
                                position,
                              ) =>
                                position !==
                                index,
                            ),
                        )
                      }
                    >
                      <X
                        size={15}
                      />
                    </button>
                  </div>
                </div>
              ),
            )}

            <div className="finance-review-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setProposalItems(
                    (
                      current,
                    ) => [
                      ...current,
                      {
                        title: '',
                        description: '',
                        quantity:
                          '1',
                        unit_price:
                          '',
                      },
                    ],
                  )
                }
              >
                Add item
              </button>
            </div>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setProposalForm(
                    null,
                  )
                }
                disabled={
                  proposalBusy
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="button button-primary"
                disabled={
                  proposalBusy
                }
                aria-busy={
                  proposalBusy
                }
              >
                {proposalBusy
                  ? 'Saving…'
                  : 'Save proposal'}
              </button>
            </div>
          </form>
        </div>
      )}

      {preview && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            setPreview(
              null,
            )
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Proposal preview"
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
                  PREVIEW AS CLIENT ·
                  READ ONLY
                </span>

                <h3>
                  {preview.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPreview(
                    null,
                  )
                }
                aria-label="Close preview"
              >
                <X
                  size={19}
                />
              </button>
            </div>

            {preview.overview && (
              <p
                style={{
                  whiteSpace:
                    'pre-wrap',
                }}
              >
                {preview.overview}
              </p>
            )}

            <div className="project-cost-list">
              {(preview.items || []).map(
                (
                  item,
                ) => (
                  <div
                    key={
                      item.id ||
                      item.title
                    }
                  >
                    <div>
                      <strong>
                        {
                          item.title
                        }
                      </strong>

                      {item.description && (
                        <span>
                          {
                            item.description
                          }
                        </span>
                      )}
                    </div>

                    <strong>
                      {formatNaira(
                        item.amount_kobo,
                      )}
                    </strong>
                  </div>
                ),
              )}
            </div>

            <div
              className="project-summary-list"
              style={{
                marginTop: 12,
              }}
            >
              <div>
                <span>
                  Total
                </span>

                <strong>
                  {formatNaira(
                    preview.total_kobo,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Valid until
                </span>

                <strong>
                  {
                    preview.valid_until ||
                    'Not set'
                  }
                </strong>
              </div>
            </div>

            {preview.terms && (
              <p
                style={{
                  fontSize: 13,
                  color: '#5f5878',
                  whiteSpace:
                    'pre-wrap',
                }}
              >
                {preview.terms}
              </p>
            )}

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setPreview(
                    null,
                  )
                }
              >
                Close preview
              </button>
            </div>
          </div>
        </div>
      )}

      {meetingForm && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !meetingBusy &&
            setMeetingForm(
              null,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Schedule meeting"
            className="posho-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              saveMeeting
            }
          >
            <div className="posho-modal-heading">
              <h3>
                Schedule meeting
              </h3>

              <button
                type="button"
                onClick={() =>
                  setMeetingForm(
                    null,
                  )
                }
                aria-label="Close meeting form"
                disabled={
                  meetingBusy
                }
              >
                <X
                  size={19}
                />
              </button>
            </div>

            <p className="posho-modal-description">
              In-app reminders only — no emails
              are sent until email is
              configured.
            </p>

            <div className="posho-form-grid">
              <label>
                <span>
                  Type
                </span>

                <select
                  value={
                    meetingForm.kind
                  }
                  onChange={(
                    event,
                  ) =>
                    setMeetingForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        kind: event
                          .target
                          .value,
                      }),
                    )
                  }
                >
                  <option value="discovery">
                    Discovery call
                  </option>

                  <option value="kickoff">
                    Project kickoff
                  </option>

                  <option value="review">
                    Review session
                  </option>

                  <option value="support">
                    Support session
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Date and time
                </span>

                <input
                  type="datetime-local"
                  value={
                    meetingForm.scheduled_at
                  }
                  onChange={(
                    event,
                  ) =>
                    setMeetingForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        scheduled_at:
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
                  Duration (minutes)
                </span>

                <input
                  type="number"
                  min="5"
                  step="5"
                  value={
                    meetingForm.duration_minutes
                  }
                  onChange={(
                    event,
                  ) =>
                    setMeetingForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        duration_minutes:
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
                  Participants
                </span>

                <input
                  value={
                    meetingForm.participants
                  }
                  onChange={(
                    event,
                  ) =>
                    setMeetingForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        participants:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  maxLength={500}
                />
              </label>

              <label>
                <span>
                  Notes
                </span>

                <textarea
                  value={
                    meetingForm.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    setMeetingForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        notes:
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
                  setMeetingForm(
                    null,
                  )
                }
                disabled={
                  meetingBusy
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="button button-primary"
                disabled={
                  meetingBusy
                }
                aria-busy={
                  meetingBusy
                }
              >
                {meetingBusy
                  ? 'Scheduling…'
                  : 'Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
