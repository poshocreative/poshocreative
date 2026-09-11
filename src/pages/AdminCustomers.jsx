import { useEffect, useMemo, useState } from 'react';


import Icon from '../components/ui/Icon';
import BrandLoader from '../components/BrandLoader';
import Link from '../components/PortalLink';
import PageHeader from '../components/ui/PageHeader';
import Tabs from '../components/ui/Tabs';
import StatusBadge from '../components/ui/StatusBadge';
import { EmptyState, ErrorBlock } from '../components/ui/StateBlocks';
import { useToast } from '../components/ui/Toast';
import { useEscapeClose } from '../components/ui/useEscapeClose';
import { useAuth } from '../context/AuthContext';

import { getAdminCustomers } from '../lib/admin';
import { supabase } from '../lib/supabase';
import { formatKobo } from '../lib/money';
import {
  getOrganizations,
  getRetainers,
  runOperationsAction,
} from '../lib/operations';
import { formatNaira } from '../lib/reports';

const ORG_ROLES = ['owner', 'billing', 'member', 'reviewer', 'viewer'];

function pretty(value) {
  return String(value || '').replaceAll('_', ' ');
}

export default function AdminCustomers() {
  const toast = useToast();
  const { adminPath } = useAuth();
  const [tab, setTab] = useState('clients');
  const [customers, setCustomers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [retainers, setRetainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailExtra, setDetailExtra] = useState(null);
  const [busy, setBusy] = useState(false);
  const [orgForm, setOrgForm] = useState(null);
  const [memberForm, setMemberForm] = useState(null);
  const [retainerForm, setRetainerForm] = useState(null);

  useEscapeClose(Boolean(detail) && !busy, () => setDetail(null));
  useEscapeClose(Boolean(orgForm) && !busy, () => setOrgForm(null));
  useEscapeClose(Boolean(memberForm) && !busy, () => setMemberForm(null));
  useEscapeClose(Boolean(retainerForm) && !busy, () => setRetainerForm(null));

  const load = async () => {
    try {
      setError('');
      setLoading(true);

      const [customerRows, orgRows, retainerRows] = await Promise.all([
        getAdminCustomers(),
        getOrganizations().catch(() => []),
        getRetainers().catch(() => []),
      ]);

      setCustomers(customerRows);
      setOrganizations(orgRows);
      setRetainers(retainerRows);
    } catch (loadError) {
      setError(loadError.message || 'Clients could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Clients | Posho Creative Management';
    load();
     
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return customers
      .map((customer) => {
        const orders = customer.orders || [];
        const active = orders.filter((order) =>
          !['completed', 'cancelled'].includes(order.status),
        );
        const completed = orders.filter(
          (order) => order.status === 'completed',
        );
        const value = orders.reduce(
          (sum, order) => sum + Number(order.quoted_amount_kobo || 0),
          0,
        );
        const paid = orders.reduce(
          (sum, order) => sum + Number(order.paid_amount_kobo || 0),
          0,
        );

        return {
          ...customer,
          activeCount: active.length,
          completedCount: completed.length,
          projectValue: value,
          confirmedPaid: paid,
          outstanding: Math.max(value - paid, 0),
        };
      })
      .filter((customer) => {
        if (!needle) return true;

        return [
          customer.full_name,
          customer.email,
          customer.phone,
          customer.business_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle);
      });
  }, [customers, query]);

  if (loading) {
    return <BrandLoader label="Loading clients…" />;
  }

  const openDetail = async (customer) => {
    setDetail(customer);
    setDetailExtra(null);

    try {
      const [requests, feedback, notes, quotes] = await Promise.all([
        supabase
          .from('service_requests')
          .select('id,reference,title,status,priority,created_at')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false })
          .limit(20)
          .then((result) => result.data || [], () => []),
        supabase
          .from('project_feedback')
          .select('rating,feedback,testimonial_permission,created_at,order_id')
          .then(
            async (result) => {
              if (result.error) return [];
              const orderIds = (customer.orders || []).map((order) => order.id);
              return (result.data || []).filter((row) => orderIds.includes(row.order_id));
            },
            () => [],
          ),
        supabase
          .from('client_notes')
          .select('*')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false })
          .limit(20)
          .then((result) => result.data || [], () => []),
        Promise.resolve([]),
      ]);

      setDetailExtra({ requests, feedback, notes, quotes });
    } catch {
      setDetailExtra({ requests: [], feedback: [], notes: [], quotes: [] });
    }
  };

  const orgs = organizations.filter((org) => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return [org.name]
      .concat((org.members || []).map((member) => member.customer?.full_name || member.customer?.email || ''))
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });

  const retainerRows = retainers.filter((retainer) => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return [retainer.title, retainer.customer?.full_name, retainer.customer?.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });

  return (
    <div className="admin-view page-reveal">
      <PageHeader
        kicker="Clients"
        title="Relationships"
        description="People, organizations and recurring work. History stays summarized here; detail lives in projects."
      />

      {error && (
        <div style={{ marginBottom: 12 }}>
          <ErrorBlock message={error} onRetry={load} />
        </div>
      )}

      <Tabs
        tabs={[
          { key: 'clients', label: 'Clients', count: rows.length },
          { key: 'organizations', label: 'Organizations', count: organizations.length },
          { key: 'retainers', label: 'Retainers', count: retainers.length },
        ]}
        active={tab}
        onChange={setTab}
        label="Client sections"
      />

      {tab === 'clients' && (
        <>
          <div className="posho-search-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="search" size={17} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, phone or business…"
                aria-label="Search clients"
              />
            </label>
            <div className="finance-balance-strip" aria-live="polite">
              <span>{rows.length} client{rows.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title={query ? 'No clients match this search' : 'No clients yet'}
              body={
                query
                  ? 'Try a different name, email or business.'
                  : 'New customer accounts appear here automatically after signup.'
              }
            />
          ) : (
            <div className="admin-data-card">
              {rows.map((customer) => (
                <article key={customer.id} className="admin-data-row">
                  <div>
                    <strong className="posho-long-value">
                      {customer.full_name || 'Unnamed client'}
                    </strong>
                    <span className="posho-long-value">{customer.email}</span>
                    {customer.business_name && (
                      <span className="posho-long-value">{customer.business_name}</span>
                    )}
                  </div>

                  <div>
                    <span>Active · Completed</span>
                    <strong>
                      {customer.activeCount} · {customer.completedCount}
                    </strong>
                  </div>

                  <div>
                    <span>Project value</span>
                    <strong>{formatKobo(customer.projectValue)}</strong>
                  </div>

                  <div>
                    <span>Paid · Outstanding</span>
                    <strong>
                      {formatKobo(customer.confirmedPaid)} ·{' '}
                      {formatKobo(customer.outstanding)}
                    </strong>
                  </div>

                  <div className="finance-review-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => openDetail(customer)}
                    >
                      History
                    </button>

                    <Link
                      to={adminPath('orders')}
                      className="button button-secondary"
                      onClick={() => {
                        try {
                          window.sessionStorage.setItem(
                            'posho.admin-client-filter',
                            customer.email || '',
                          );
                        } catch {
                          toast.info('Opening projects.');
                        }
                      }}
                    >
                      Open projects
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'organizations' && (
        <>
          <div className="finance-review-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => setOrgForm({ id: '', name: '' })}
            >
              New organization
            </button>
          </div>

          {orgs.length === 0 ? (
            <EmptyState
              title="No organizations yet"
              body="Business clients with several members get permission-scoped access here."
            />
          ) : (
            <div className="admin-data-card">
              {orgs.map((org) => (
                <article key={org.id} className="admin-data-row">
                  <div>
                    <strong className="posho-long-value">{org.name}</strong>
                    <span>
                      {(org.members || []).length} member{(org.members || []).length === 1 ? '' : 's'}
                    </span>
                    {(org.members || []).slice(0, 4).map((member) => (
                      <span key={member.id} className="posho-long-value">
                        {member.customer?.full_name || member.customer?.email} · {pretty(member.org_role)}
                      </span>
                    ))}
                  </div>

                  <div className="finance-review-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setMemberForm({ organization_id: org.id, customer_id: '', org_role: 'member', can_pay: false, can_view_finance: false, can_approve: false, can_upload: true, can_request: true, can_invite: false })}
                    >
                      Add member
                    </button>

                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setOrgForm({ id: org.id, name: org.name })}
                    >
                      Rename
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <p className="admin-card-description">
            Financial visibility is per-member. Only members with billing or
            finance permission see project money.
          </p>
        </>
      )}

      {tab === 'retainers' && (
        <>
          <div className="finance-review-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => setRetainerForm({
                id: '', customer_id: '', service_slug: 'creative-solutions', title: '',
                monthly_amount: '', included_hours: '', billing_day: '1',
                start_date: new Date().toISOString().slice(0, 10), end_date: '',
                status: 'draft', overage_policy: 'approve',
              })}
            >
              New retainer
            </button>
          </div>

          {retainerRows.length === 0 ? (
            <EmptyState
              title="No retainers yet"
              body="Recurring relationships track monthly allowance per period. No automatic charging."
            />
          ) : (
            <div className="admin-data-card">
              {retainerRows.map((retainer) => {
                const current = (retainer.periods || []).find((period) => period.status === 'open');
                const used = current ? Number(current.used_minutes || 0) : 0;
                const included = current ? Number(current.included_minutes || 0) : Number(retainer.included_minutes || 0);
                const remaining = Math.max(included - used, 0);

                return (
                  <article key={retainer.id} className="admin-data-row">
                    <div>
                      <small className="posho-long-value">
                        {retainer.customer?.business_name || retainer.customer?.full_name || retainer.customer?.email}
                      </small>
                      <strong className="posho-long-value">{retainer.title}</strong>
                      <span>
                        {formatNaira(retainer.monthly_amount_kobo)}/mo ·{' '}
                        {Math.floor(included / 60)}h included
                        {current ? ` · ${Math.floor(used / 60)}h used · ${Math.floor(remaining / 60)}h left` : ''}
                      </span>

                      {(retainer.periods || []).length > 0 && (
                        <span className="posho-long-value">
                          Periods:{' '}
                          {(retainer.periods || [])
                            .slice(0, 4)
                            .map(
                              (period) =>
                                `${period.period_start.slice(0, 7)} (${Math.floor(Number(period.used_minutes || 0) / 60)}h, ${period.status})`,
                            )
                            .join(' · ')}
                        </span>
                      )}
                    </div>

                    <div>
                      <StatusBadge value={retainer.status} />
                    </div>

                    <div className="finance-review-actions">
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => setRetainerForm({
                          id: retainer.id,
                          customer_id: retainer.customer_id,
                          service_slug: retainer.service_slug,
                          title: retainer.title,
                          monthly_amount: String(Number(retainer.monthly_amount_kobo || 0) / 100),
                          included_hours: String(Number(retainer.included_minutes || 0) / 60),
                          billing_day: String(retainer.billing_day || 1),
                          start_date: retainer.start_date || '',
                          end_date: retainer.end_date || '',
                          status: retainer.status,
                          overage_policy: retainer.overage_policy,
                        })}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={busy}
                        onClick={async () => {
                          try {
                            setBusy(true);
                            await runOperationsAction({ action: 'retainer_period_ensure', retainer_id: retainer.id });
                            toast.success('Current period is open.');
                            await load();
                          } catch (periodError) {
                            toast.error(periodError.message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Open period
                      </button>

                      {current && (
                        <button
                          type="button"
                          className="button button-secondary"
                          disabled={busy}
                          onClick={async () => {
                            try {
                              setBusy(true);
                              await runOperationsAction({ action: 'retainer_period_close', id: current.id });
                              toast.success('Period closed with its own totals.');
                              await load();
                            } catch (periodError) {
                              toast.error(periodError.message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Close period
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {detail && (
        <div
          className="posho-modal-backdrop"
          onClick={() => !busy && setDetail(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Client history"
            className="posho-modal posho-modal-wide"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="posho-modal-heading">
              <div>
                <span>CLIENT HISTORY</span>
                <h3 className="posho-long-value">{detail.full_name || detail.email}</h3>
              </div>

              <button type="button" onClick={() => setDetail(null)} aria-label="Close history" disabled={busy}>
                <Icon name="close" size={19} />
              </button>
            </div>

            <div className="posho-kv">
              <div>
                <span>Project value</span>
                <strong>{formatKobo(detail.projectValue)}</strong>
              </div>

              <div>
                <span>Collected</span>
                <strong>{formatKobo(detail.confirmedPaid)}</strong>
              </div>

              <div>
                <span>Outstanding</span>
                <strong>{formatKobo(detail.outstanding)}</strong>
              </div>

              <div>
                <span>Projects</span>
                <strong>{detail.activeCount} active · {detail.completedCount} completed</strong>
              </div>
            </div>

            {!detailExtra ? (
              <p className="admin-card-description">Loading relationship timeline…</p>
            ) : (
              <div className="posho-timeline" style={{ marginTop: 12 }}>
                {(detail.orders || []).map((order) => (
                  <div key={`order-${order.id}`} className="posho-timeline-item">
                    <span className="posho-timeline-dot" aria-hidden="true" />
                    <div className="posho-timeline-body">
                      <strong className="posho-long-value">
                        Project · {order.project_title || order.reference}
                      </strong>
                      <p>
                        {formatKobo(order.quoted_amount_kobo)} value ·{' '}
                        {formatKobo(order.paid_amount_kobo)} paid · {pretty(order.status)}
                      </p>
                    </div>
                  </div>
                ))}

                {(detailExtra.requests || []).map((request) => (
                  <div key={`request-${request.id}`} className="posho-timeline-item">
                    <span className="posho-timeline-dot" aria-hidden="true" />
                    <div className="posho-timeline-body">
                      <strong className="posho-long-value">Request · {request.title}</strong>
                      <p>{pretty(request.status)} · {request.reference}</p>
                    </div>
                  </div>
                ))}

                {(detailExtra.feedback || []).map((entry, index) => (
                  <div key={`feedback-${index}`} className="posho-timeline-item">
                    <span className="posho-timeline-dot" aria-hidden="true" />
                    <div className="posho-timeline-body">
                      <strong>Feedback · {entry.rating}/5</strong>
                      {entry.feedback && <p>{entry.feedback}</p>}
                    </div>
                  </div>
                ))}

                {(detailExtra.notes || []).map((note) => (
                  <div key={`note-${note.id}`} className="posho-timeline-item">
                    <span className="posho-timeline-dot" aria-hidden="true" />
                    <div className="posho-timeline-body">
                      <strong>Internal note</strong>
                      <p>{note.note}</p>
                    </div>
                  </div>
                ))}

                {(detail.orders || []).length === 0 &&
                  (detailExtra.requests || []).length === 0 &&
                  (detailExtra.feedback || []).length === 0 && (
                    <p className="admin-card-description">No history yet.</p>
                  )}
              </div>
            )}
          </div>
        </div>
      )}

      {orgForm && (
        <div
          className="posho-modal-backdrop"
          onClick={() => !busy && setOrgForm(null)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Organization"
            className="posho-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={async (event) => {
              event.preventDefault();

              try {
                setBusy(true);

                await runOperationsAction({
                  action: 'org_save',
                  id: orgForm.id || undefined,
                  name: orgForm.name.trim(),
                });

                toast.success('Organization saved.');
                setOrgForm(null);
                await load();
              } catch (orgError) {
                toast.error(orgError.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="posho-modal-heading">
              <h3>{orgForm.id ? 'Rename organization' : 'New organization'}</h3>

              <button type="button" onClick={() => setOrgForm(null)} aria-label="Close" disabled={busy}>
                <Icon name="close" size={19} />
              </button>
            </div>

            <div className="posho-form-grid">
              <label>
                <span>Name</span>
                <input
                  value={orgForm.name}
                  onChange={(event) => setOrgForm((current) => ({ ...current, name: event.target.value }))}
                  required
                  maxLength={160}
                  placeholder="Zentel Insight"
                />
              </label>
            </div>

            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setOrgForm(null)} disabled={busy}>
                Cancel
              </button>

              <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {memberForm && (
        <div
          className="posho-modal-backdrop"
          onClick={() => !busy && setMemberForm(null)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Organization member"
            className="posho-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={async (event) => {
              event.preventDefault();

              try {
                setBusy(true);

                await runOperationsAction({
                  action: 'org_member_save',
                  organization_id: memberForm.organization_id,
                  customer_id: memberForm.customer_id,
                  org_role: memberForm.org_role,
                  can_pay: memberForm.can_pay,
                  can_view_finance: memberForm.can_view_finance,
                  can_approve: memberForm.can_approve,
                  can_upload: memberForm.can_upload,
                  can_request: memberForm.can_request,
                  can_invite: memberForm.can_invite,
                });

                toast.success('Membership saved with scoped permissions.');
                setMemberForm(null);
                await load();
              } catch (memberError) {
                toast.error(memberError.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="posho-modal-heading">
              <h3>Add member</h3>

              <button type="button" onClick={() => setMemberForm(null)} aria-label="Close" disabled={busy}>
                <Icon name="close" size={19} />
              </button>
            </div>

            <div className="posho-form-grid">
              <label>
                <span>Client account</span>
                <select
                  value={memberForm.customer_id}
                  onChange={(event) => setMemberForm((current) => ({ ...current, customer_id: event.target.value }))}
                  required
                >
                  <option value="">Choose account…</option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name || customer.email}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Role</span>
                <select
                  value={memberForm.org_role}
                  onChange={(event) => setMemberForm((current) => ({ ...current, org_role: event.target.value }))}
                >
                  {ORG_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {pretty(role)}
                    </option>
                  ))}
                </select>
              </label>

              {[
                ['can_pay', 'Can pay'],
                ['can_view_finance', 'Can view finance'],
                ['can_approve', 'Can approve deliverables'],
                ['can_upload', 'Can upload files'],
                ['can_request', 'Can submit requests'],
                ['can_invite', 'Can invite members'],
              ].map(([field, label]) => (
                <label key={field} className="finance-checkbox-row">
                  <input
                    type="checkbox"
                    checked={Boolean(memberForm[field])}
                    onChange={(event) => setMemberForm((current) => ({ ...current, [field]: event.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setMemberForm(null)} disabled={busy}>
                Cancel
              </button>

              <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
                {busy ? 'Saving…' : 'Save member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {retainerForm && (
        <div
          className="posho-modal-backdrop"
          onClick={() => !busy && setRetainerForm(null)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Retainer"
            className="posho-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={async (event) => {
              event.preventDefault();

              try {
                setBusy(true);

                await runOperationsAction({
                  action: 'retainer_save',
                  id: retainerForm.id || undefined,
                  customer_id: retainerForm.customer_id,
                  service_slug: retainerForm.service_slug,
                  title: retainerForm.title.trim(),
                  monthly_amount_kobo: Math.round(Number(retainerForm.monthly_amount || 0) * 100),
                  included_minutes: Math.round(Number(retainerForm.included_hours || 0) * 60),
                  billing_day: retainerForm.billing_day,
                  start_date: retainerForm.start_date,
                  end_date: retainerForm.end_date || null,
                  status: retainerForm.status,
                  overage_policy: retainerForm.overage_policy,
                });

                toast.success('Retainer saved. No automatic charging is ever enabled.');
                setRetainerForm(null);
                await load();
              } catch (retainerError) {
                toast.error(retainerError.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="posho-modal-heading">
              <h3>{retainerForm.id ? 'Edit retainer' : 'New retainer'}</h3>

              <button type="button" onClick={() => setRetainerForm(null)} aria-label="Close" disabled={busy}>
                <Icon name="close" size={19} />
              </button>
            </div>

            <div className="posho-form-grid">
              <label>
                <span>Client</span>
                <select
                  value={retainerForm.customer_id}
                  onChange={(event) => setRetainerForm((current) => ({ ...current, customer_id: event.target.value }))}
                  required
                  disabled={Boolean(retainerForm.id)}
                >
                  <option value="">Choose client…</option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name || customer.email}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Title</span>
                <input
                  value={retainerForm.title}
                  onChange={(event) => setRetainerForm((current) => ({ ...current, title: event.target.value }))}
                  required
                  maxLength={200}
                  placeholder="Monthly design support"
                />
              </label>

              <label>
                <span>Monthly amount (₦)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={retainerForm.monthly_amount}
                  onChange={(event) => setRetainerForm((current) => ({ ...current, monthly_amount: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Included hours / month</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={retainerForm.included_hours}
                  onChange={(event) => setRetainerForm((current) => ({ ...current, included_hours: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Start date</span>
                <input
                  type="date"
                  value={retainerForm.start_date}
                  onChange={(event) => setRetainerForm((current) => ({ ...current, start_date: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Status</span>
                <select
                  value={retainerForm.status}
                  onChange={(event) => setRetainerForm((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="expired">Expired</option>
                </select>
              </label>

              <label>
                <span>Overage policy</span>
                <select
                  value={retainerForm.overage_policy}
                  onChange={(event) => setRetainerForm((current) => ({ ...current, overage_policy: event.target.value }))}
                >
                  <option value="stop">Stop accepting work</option>
                  <option value="charge">Create overage charge</option>
                  <option value="approve">Require approval</option>
                  <option value="upgrade">Upgrade retainer</option>
                </select>
              </label>
            </div>

            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setRetainerForm(null)} disabled={busy}>
                Cancel
              </button>

              <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
                {busy ? 'Saving…' : 'Save retainer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
