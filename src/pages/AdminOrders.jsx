import { useEffect, useMemo, useState } from 'react';


import Icon from '../components/ui/Icon';
import Link from '../components/PortalLink';

import BrandLoader from '../components/BrandLoader';
import { EmptyState, ErrorBlock } from '../components/ui/StateBlocks';

import { useToast } from '../components/ui/Toast';

import { getAdminOrders } from '../lib/admin';
import { supabase } from '../lib/supabase';
import { formatKobo } from '../lib/money';
import { formatOrderStatus } from '../lib/orders';

const FILTERS = [
  { id: 'all', label: 'All active' },
  { id: 'pending', label: 'Awaiting review' },
  { id: 'approved', label: 'Approved' },
  { id: 'awaiting_payment', label: 'Awaiting payment' },
  { id: 'part_payment', label: 'Part payment' },
  { id: 'active', label: 'Active' },
  { id: 'awaiting_client', label: 'Awaiting client' },
  { id: 'completed', label: 'Completed' },
  { id: 'declined', label: 'Declined' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'archived', label: 'Archived' },
];

function matchesFilter(order, filter) {
  const archived = Boolean(order.archived_at);

  if (filter === 'archived') {
    return archived;
  }

  if (archived) {
    return false;
  }

  switch (filter) {
    case 'all':
      return true;
    case 'pending':
      return order.review_decision === 'pending';
    case 'approved':
      return order.review_decision === 'approved';
    case 'awaiting_payment':
      return (
        order.review_decision === 'approved' &&
        ['awaiting_payment', 'processing'].includes(order.payment_status)
      );
    case 'part_payment':
      return Boolean(order.has_open_part_request);
    case 'active':
      return ['paid', 'in_progress'].includes(order.status);
    case 'awaiting_client':
      return order.status === 'awaiting_client' || order.customer_action_required === true;
    case 'completed':
      return order.status === 'completed';
    case 'declined':
      return order.review_decision === 'declined';
    case 'cancelled':
      return order.status === 'cancelled';
    default:
      return true;
  }
}

function actionRequired(order) {
  if (order.review_decision === 'pending') return 'Review needed';
  if (order.has_open_part_request) return 'Part-payment review';
  if (order.status === 'awaiting_client') return 'Waiting on client';

  const outstanding =
    Math.max(
      Number(order.quoted_amount_kobo || 0) - Number(order.paid_amount_kobo || 0),
      0,
    );

  if (order.review_decision === 'approved' && outstanding > 0) {
    return 'Payment outstanding';
  }

  return null;
}

export default function AdminOrders() {
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [error, setError] = useState('');
  const [savedViews, setSavedViews] = useState([]);
  const [viewName, setViewName] = useState('');
  const [savingView, setSavingView] = useState(false);

  const load = async () => {
    try {
      setError('');
      setLoading(true);
      setOrders(await getAdminOrders());

      try {
        const {
          data: {
            user,
          },
        } = await supabase.auth.getUser();

        if (user) {
          const { data } = await supabase
            .from('saved_views')
            .select('*')
            .eq('owner_user_id', user.id)
            .eq('scope', 'projects')
            .order('created_at', { ascending: false });

          setSavedViews(data || []);
        }
      } catch {
        setSavedViews([]);
      }
    } catch {
      setError('Project requests could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Projects | Posho Creative Management';
    load();

    try {
      const clientFilter = window.sessionStorage.getItem('posho.admin-client-filter');

      if (clientFilter) {
        setSearch(clientFilter);
        window.sessionStorage.removeItem('posho.admin-client-filter');
      }
    } catch {
      // storage unavailable — ignore
    }
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = orders.filter((order) => {
      const customer = order.customers?.full_name || '';
      const email = order.customers?.email || '';

      const matchesSearch =
        !query ||
        String(order.reference || '').toLowerCase().includes(query) ||
        String(order.project_title || '').toLowerCase().includes(query) ||
        customer.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query);

      return matchesSearch && matchesFilter(order, filter);
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'deadline') {
        return String(a.deadline || '9999').localeCompare(String(b.deadline || '9999'));
      }

      if (sort === 'value') {
        return Number(b.quoted_amount_kobo || 0) - Number(a.quoted_amount_kobo || 0);
      }

      if (sort === 'oldest') {
        return new Date(a.created_at) - new Date(b.created_at);
      }

      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [orders, search, filter, sort]);

  if (loading) {
    return <BrandLoader label="Loading projects…" />;
  }

  return (
    <div className="admin-view page-reveal">
      <div className="admin-view-heading">
        <div>
          <span>PROJECTS</span>
          <h1>Project control.</h1>
          <p>Triage every project by status, payment state and required action.</p>
        </div>
        <strong className="admin-total-count">{visible.length} shown</strong>
      </div>

      {error && (
        <div style={{ marginBottom: 12 }}>
          <ErrorBlock message={error} onRetry={load} />
        </div>
      )}

      <div className="posho-search-row">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="search" size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reference, project, customer or email…"
            aria-label="Search projects"
          />
        </label>
        <label>
          <span className="posho-section-label">Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort projects">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="deadline">Deadline</option>
            <option value="value">Project value</option>
          </select>
        </label>
      </div>

      <div className="posho-ops-filters" role="tablist" aria-label="Project filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            className={filter === item.id ? 'active' : ''}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="finance-review-actions" style={{ marginBottom: 12 }}>
        <span className="posho-section-label">Saved views</span>

        {savedViews.map((view) => (
          <button
            key={view.id}
            type="button"
            className="button button-secondary"
            onClick={() => {
              const filters = view.filters || {};
              setSearch(filters.search || '');
              setFilter(filters.filter || 'all');
              setSort(filters.sort || 'newest');
            }}
          >
            {view.name}
          </button>
        ))}

        <span style={{ display: 'inline-flex', gap: 6 }}>
          <input
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            placeholder="Name this view…"
            maxLength={60}
            aria-label="Saved view name"
            style={{ maxWidth: 180 }}
          />

          <button
            type="button"
            className="button button-secondary"
            disabled={savingView || !viewName.trim()}
            onClick={async () => {
              try {
                setSavingView(true);

                const {
                  data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                  toast.error('Sign in again to save views.');
                  return;
                }

                const { error: saveError } = await supabase
                  .from('saved_views')
                  .insert({
                    owner_user_id: user.id,
                    scope: 'projects',
                    name: viewName.trim(),
                    filters: { search, filter, sort },
                  });

                if (saveError) throw saveError;

                toast.success('View saved.');
                setViewName('');

                const { data } = await supabase
                  .from('saved_views')
                  .select('*')
                  .eq('owner_user_id', user.id)
                  .eq('scope', 'projects')
                  .order('created_at', { ascending: false });

                setSavedViews(data || []);
              } catch (saveError) {
                toast.error(saveError.message);
              } finally {
                setSavingView(false);
              }
            }}
          >
            {savingView ? 'Saving…' : 'Save view'}
          </button>
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No projects match this view"
          body="Change the search or choose a different filter."
        />
      ) : (
        <div className="admin-orders-directory">
          {visible.map((order) => {
            const outstanding = Math.max(
              Number(order.quoted_amount_kobo || 0) - Number(order.paid_amount_kobo || 0),
              0,
            );
            const action = actionRequired(order);
            const progress = Math.max(0, Math.min(100, Number(order.progress_percent || 0)));

            return (
              <Link
                key={order.id}
                to={`./${order.reference}`}
                className="admin-order-directory-card"
              >
                <div className="admin-order-directory-main">
                  <div className="admin-order-directory-reference posho-long-value">
                    {order.reference}
                    {order.archived_at ? ' · Archived' : ''}
                  </div>
                  <h3 className="posho-long-value">{order.project_title}</h3>
                  <p className="posho-long-value">
                    {order.customers?.full_name || order.customers?.email}
                  </p>
                  <div className="admin-order-directory-meta">
                    <span>{formatOrderStatus(order.status)}</span>
                    <span>Pay: {formatOrderStatus(order.payment_status)}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="admin-order-directory-meta">
                    <span>Value {formatKobo(order.quoted_amount_kobo)}</span>
                    <span>Paid {formatKobo(order.paid_amount_kobo)}</span>
                    <span>Balance {formatKobo(outstanding)}</span>
                  </div>
                  {order.deadline && (
                    <div className="admin-order-directory-meta">
                      <span className="posho-long-value">Due {order.deadline}</span>
                    </div>
                  )}
                  {action && (
                    <div className="admin-order-directory-meta">
                      <strong style={{ color: '#92400e', fontSize: 13 }}>{action}</strong>
                    </div>
                  )}
                </div>

                <div className="admin-order-directory-finance">
                  <span>Balance</span>
                  <strong>{formatKobo(outstanding)}</strong>
                </div>

                <span className={`admin-decision-pill ${order.review_decision}`}>
                  {order.review_decision === 'pending'
                    ? 'Awaiting Review'
                    : formatOrderStatus(order.review_decision)}
                </span>

                <Icon name="arrow_forward" size={18} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
