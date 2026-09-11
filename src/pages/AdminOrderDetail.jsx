import { useCallback, useEffect, useMemo, useState } from 'react';


import Icon from '../components/ui/Icon';
import { useParams } from 'react-router-dom';

import Link from '../components/PortalLink';

import ActivityPanel from '../components/admin/ActivityPanel';
import AdminPaymentAttempts from '../components/AdminPaymentAttempts';
import ChangeRequestsPanel from '../components/admin/ChangeRequestsPanel';
import ClientNotesPanel from '../components/admin/ClientNotesPanel';
import ClientPreview from '../components/admin/ClientPreview';
import CloseoutPanel from '../components/admin/CloseoutPanel';
import CostManager from '../components/admin/CostManager';
import DangerZone from '../components/admin/DangerZone';
import DeliverablesPanel from '../components/admin/DeliverablesPanel';
import InternalCostsPanel from '../components/admin/InternalCostsPanel';
import ManualPaymentPanel from '../components/admin/ManualPaymentPanel';
import MilestonesPanel from '../components/admin/MilestonesPanel';
import PartPaymentReview from '../components/admin/PartPaymentReview';
import ProjectHeader from '../components/admin/ProjectHeader';
import ProjectMeetings from '../components/admin/ProjectMeetings';
import QuoteItemsEditor from '../components/admin/QuoteItemsEditor';
import RevisionsPanel from '../components/admin/RevisionsPanel';
import ScopePanel from '../components/admin/ScopePanel';
import TasksPanel from '../components/admin/TasksPanel';
import BudgetPanel from '../components/admin/BudgetPanel';
import PostmortemPanel from '../components/admin/PostmortemPanel';
import ProjectHealth from '../components/admin/ProjectHealth';
import OnboardingPanel from '../components/admin/OnboardingPanel';
import AnnotationsPanel from '../components/admin/AnnotationsPanel';
import {
  FilesPanel,
  ProgressHistory,
  ProgressPublisher,
} from '../components/admin/ProjectPanels';
import FinanceCards from '../components/ui/FinanceCards';
import { EmptyState, ErrorBlock } from '../components/ui/StateBlocks';
import { useToast } from '../components/ui/Toast';
import { useEscapeClose } from '../components/ui/useEscapeClose';
import ProjectServiceDetails from '../components/ProjectServiceDetails';
import BrandLoader from '../components/BrandLoader';

import { getAdminOrder, runAdminOrderAction } from '../lib/admin';
import { buildFinanceSnapshot } from '../lib/finance';
import { formatKobo } from '../lib/money';
import { setProjectPrice } from '../lib/projectLifecycle';
import { getAdminProjectWork } from '../lib/projectWork';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'work', label: 'Work' },
  { key: 'finance', label: 'Finance' },
  { key: 'files', label: 'Files' },
  { key: 'progress', label: 'Progress' },
  { key: 'activity', label: 'Activity' },
  { key: 'client', label: 'Client' },
  { key: 'settings', label: 'Settings' },
];

const workflowStatuses = [
  'under_review',
  'awaiting_payment',
  'paid',
  'in_progress',
  'awaiting_client',
  'completed',
  'cancelled',
];

export default function AdminOrderDetail() {
  const { reference } = useParams();
  const toast = useToast();

  const [order, setOrder] = useState(null);
  const [work, setWork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('overview');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [quote, setQuote] = useState({ amount: '', message: '' });
  const [price, setPrice] = useState('');
  const [statusForm, setStatusForm] = useState({ status: 'under_review', note: '' });
  const [customerUpdate, setCustomerUpdate] = useState('');
  const [balanceNote, setBalanceNote] = useState('');
  const [balanceDue, setBalanceDue] = useState('');

  useEscapeClose(declineOpen && actionBusy !== 'decline', () => setDeclineOpen(false));

  const load = useCallback(async () => {
    try {
      setLoadError('');
      const result = await getAdminOrder(reference);

      if (!result) {
        setOrder(null);
        setWork(null);
        return;
      }

      setOrder(result);

      try {
        const workResult = await getAdminProjectWork(result.id, result.customer_id);
        setWork(workResult);
      } catch (workError) {
        console.error(workError);
        setWork({ loadErrors: { general: workError.message } });
      }

      if (result?.quoted_amount_kobo && !price) {
        setPrice(String(Number(result.quoted_amount_kobo) / 100));
      }

      setStatusForm((current) => ({
        ...current,
        status: workflowStatuses.includes(result.status) ? result.status : 'under_review',
      }));
    } catch (loadErr) {
      setLoadError(loadErr.message || 'This project could not be loaded.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  useEffect(() => {
    document.title = `${reference} | Posho Creative Management`;
    load();
  }, [reference, load]);

  const finance = useMemo(() => {
    if (!order) return null;

    return buildFinanceSnapshot({
      order,
      costs: order.costs || [],
      partRequests: order.partRequests || [],
      milestones: order.milestones || [],
    });
  }, [order]);

  const execute = async (payload, successMessage, busyKey = 'action') => {
    if (!order) return false;

    try {
      setActionBusy(busyKey);
      setError('');
      setSuccess('');
      await runAdminOrderAction({ orderId: order.id, ...payload });
      await load();
      setSuccess(successMessage);
      toast.success(successMessage);
      return true;
    } catch (actionError) {
      setError(actionError.message);
      toast.error(actionError.message);
      return false;
    } finally {
      setActionBusy('');
    }
  };

  const approve = () =>
    execute({ action: 'approve_order' }, 'Project request approved successfully.', 'approve');

  const decline = async (event) => {
    event.preventDefault();

    if (declineReason.trim().length < 10) {
      setError('Provide a clear reason before declining this request.');
      return;
    }

    const completed = await execute(
      { action: 'decline_order', reason: declineReason },
      'Project request declined and the customer has been informed.',
      'decline',
    );

    if (completed) {
      setDeclineOpen(false);
      setDeclineReason('');
    }
  };

  const sendQuote = async (event) => {
    event.preventDefault();
    const naira = Number(quote.amount);

    if (!Number.isFinite(naira) || naira <= 0) {
      setError('Enter a valid quote amount.');
      return;
    }

    const completed = await execute(
      { action: 'send_quote', amountKobo: Math.round(naira * 100), message: quote.message },
      'Quote issued successfully.',
      'quote',
    );

    if (completed) setQuote({ amount: '', message: '' });
  };

  const savePrice = async (event) => {
    event.preventDefault();

    try {
      setBusy(true);
      await setProjectPrice({ orderId: order.id, amountNaira: price });
      toast.success('Project price saved. The customer can now see the updated total.');
      await load();
    } catch (priceError) {
      toast.error(priceError.message);
      setError(priceError.message);
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (event) => {
    event.preventDefault();

    const completed = await execute(
      { action: 'update_status', status: statusForm.status, note: statusForm.note },
      'Project status updated.',
      'status',
    );

    if (completed) setStatusForm((current) => ({ ...current, note: '' }));
  };

  const publishUpdate = async (event) => {
    event.preventDefault();

    if (!customerUpdate.trim()) {
      setError('Write an update before publishing.');
      return;
    }

    const completed = await execute(
      { action: 'add_note', note: customerUpdate, isInternal: false },
      'Project update published.',
      'note',
    );

    if (completed) setCustomerUpdate('');
  };

  const requestBalance = async (event) => {
    event.preventDefault();

    const completed = await execute(
      {
        action: 'request_remaining_payment',
        note: balanceNote,
        dueAt: balanceDue ? new Date(`${balanceDue}T12:00:00`).toISOString() : null,
      },
      'Remaining balance requested. The customer has been notified.',
      'balance',
    );

    if (completed) {
      setBalanceNote('');
      setBalanceDue('');
    }
  };

  if (loading) {
    return <BrandLoader label="Opening project record…" />;
  }

  if (loadError) {
    return (
      <div className="admin-view">
        <Link to="./.." className="button button-secondary">
          <Icon name="arrow_back" size={17} /> Back to projects
        </Link>
        <div style={{ marginTop: 16 }}>
          <ErrorBlock message={loadError} onRetry={() => { setLoading(true); load(); }} />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="admin-view">
        <Link to="./.." className="button button-secondary">
          <Icon name="arrow_back" size={17} /> Back to projects
        </Link>
        <div style={{ marginTop: 16 }}>
          <EmptyState title="Project not found" body="It may have been permanently deleted." />
        </div>
      </div>
    );
  }

  const customer = order.customers || {};
  const customerName = customer.full_name || customer.email || 'Customer';
  const isPendingReview = order.review_decision === 'pending';
  const ledger = order.payments || [];

  const openRevisions = (work?.revisions || []).filter(
    (revision) => !['resolved', 'rejected_out_of_scope'].includes(revision.status),
  );
  const pendingDeliverables = (work?.deliverables || []).filter(
    (deliverable) => deliverable.client_approval_state === 'pending',
  );
  const workAttention = openRevisions.length + pendingDeliverables.length;

  return (
    <div className="admin-view page-reveal">
      <Link to="./.." className="button button-secondary" style={{ marginBottom: 12 }}>
        <Icon name="arrow_back" size={17} /> Back to projects
      </Link>

      <div style={{ marginBottom: 12 }}>
        <button type="button" className="button button-secondary" onClick={() => setPreviewOpen(true)}>
          View as client (read-only)
        </button>
      </div>

      <ProjectHeader order={order} finance={finance} customerName={customerName} />

      {error && (
        <div className="admin-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      {success && (
        <div className="workspace-success-message" role="status" style={{ marginTop: 12 }}>
          {success}
        </div>
      )}

      {isPendingReview && (
        <div className="posho-action-center" style={{ marginTop: 12 }}>
          <h2>Review required</h2>
          <div className="posho-action-item">
            <div>
              <strong>New project request needs a decision</strong>
              <p>Review the full brief below, then approve or decline with a customer-facing reason.</p>
              <div className="finance-review-actions">
                <button type="button" className="button button-primary" onClick={approve} disabled={actionBusy === 'approve'} aria-busy={actionBusy === 'approve'}>
                  <Icon name="check_circle" size={17} /> {actionBusy === 'approve' ? 'Approving…' : 'Approve request'}
                </button>
                <button type="button" className="finance-decline-button" onClick={() => setDeclineOpen(true)}>
                  <Icon name="cancel" size={17} /> Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {finance?.pendingRequest && (
        <div className="posho-action-center" style={{ marginTop: 12 }}>
          <h2>Payment arrangement waiting</h2>
          <div className="posho-action-item">
            <div>
              <strong>Part-payment request of {formatKobo(finance.pendingRequest.requested_amount_kobo)}</strong>
              <p>Open the Finance tab to review and set the approved installment.</p>
              <button type="button" className="button button-primary" onClick={() => setTab('finance')}>
                Open Finance
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="posho-tabbar" aria-label="Project sections" style={{ marginTop: 14 }}>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'active' : ''}
            aria-current={tab === item.key ? 'page' : undefined}
            onClick={() => setTab(item.key)}
          >
            {item.label}
            {item.key === 'finance' && finance?.pendingRequest ? ' · 1' : ''}
            {item.key === 'work' && workAttention > 0 ? ` · ${workAttention}` : ''}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 14, marginTop: 6 }}>
          <ProjectHealth order={order} work={work} />

          <OnboardingPanel order={order} finance={finance} onChanged={load} />

          <section className="admin-control-card">
            <span className="posho-section-label">Client brief</span>
            <h3>{order.project_title}</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{order.description || 'No description provided.'}</p>
            <div className="posho-ledger" style={{ marginTop: 10 }}>
              {order.goal && <p><strong>Goal:</strong> {order.goal}</p>}
              {order.timeline && <p><strong>Timeline:</strong> {order.timeline}</p>}
              {order.budget && <p><strong>Budget:</strong> {order.budget}</p>}
              {order.deadline && <p><strong>Deadline:</strong> {order.deadline}</p>}
              {order.reference_links && <p className="posho-long-value"><strong>References:</strong> {order.reference_links}</p>}
            </div>
            <ProjectServiceDetails details={order.service_details} />
          </section>

          <section className="admin-control-card">
            <span className="posho-section-label">Quote</span>
            <h3>Send or revise quote</h3>
            {Number(order.paid_amount_kobo || 0) > 0 ? (
              <p className="admin-card-description">
                This project has confirmed payments. Use Additional Project
                Costs in Finance instead of replacing the original quote.
              </p>
            ) : (
              <form onSubmit={sendQuote} className="posho-form-grid">
                <label>
                  Quote amount (NGN)
                  <input type="number" min="1" step="0.01" value={quote.amount} onChange={(e) => setQuote((c) => ({ ...c, amount: e.target.value }))} />
                </label>
                <label>
                  Message to customer
                  <textarea value={quote.message} onChange={(e) => setQuote((c) => ({ ...c, message: e.target.value }))} placeholder="Scope, terms, validity…" />
                </label>
              <button type="submit" className="button button-primary" disabled={actionBusy === 'quote'} aria-busy={actionBusy === 'quote'}>
                {actionBusy === 'quote' ? 'Sending…' : 'Send quote'}
              </button>
            </form>
          )}
        </section>

        <QuoteItemsEditor order={order} onChanged={load} />

          <section className="admin-control-card">
            <span className="posho-section-label">Communication</span>
            <h3>Publish customer update</h3>
            <form onSubmit={publishUpdate} className="posho-form-grid">
              <label>
                Update
                <textarea value={customerUpdate} onChange={(e) => setCustomerUpdate(e.target.value)} placeholder="Share progress, decisions or next steps." />
              </label>
              <button type="submit" className="button button-primary" disabled={actionBusy === 'note'} aria-busy={actionBusy === 'note'}>
                {actionBusy === 'note' ? 'Publishing…' : 'Publish update'}
              </button>
            </form>
          </section>
        </div>
      )}

      {tab === 'work' && (
        <div style={{ display: 'grid', gap: 14, marginTop: 6 }}>
          <ScopePanel order={order} work={work} onChanged={load} />
          <MilestonesPanel order={order} work={work} onChanged={load} />
          <TasksPanel order={order} work={work} onChanged={load} />
          <DeliverablesPanel order={order} work={work} onChanged={load} />
          <AnnotationsPanel order={order} work={work} onChanged={load} />
          <RevisionsPanel order={order} work={work} onChanged={load} />
          <ChangeRequestsPanel order={order} work={work} onChanged={load} />
          <PostmortemPanel order={order} work={work} onChanged={load} />
          <CloseoutPanel order={order} work={work} finance={finance} onChanged={load} />
        </div>
      )}

      {tab === 'finance' && finance && (
        <div style={{ display: 'grid', gap: 14, marginTop: 6 }}>
          <FinanceCards
            baseKobo={finance.base}
            additionalKobo={finance.additional}
            totalKobo={finance.total}
            paidKobo={finance.paid}
            outstandingKobo={finance.outstanding}
            dueNowKobo={finance.dueNow}
          />

          <section className="admin-control-card">
            <span className="posho-section-label">Base project price</span>
            <h3>Set project price</h3>
            <p className="admin-card-description">
              {Number(order.paid_amount_kobo || 0) > 0
                ? 'Verified payments exist. Price changes are guarded — use Additional Costs for increases.'
                : 'Finalize the commercial value. The customer sees price, paid, outstanding and current amount due.'}
            </p>
            <form onSubmit={savePrice} className="posho-form-grid">
              <label>
                Project price (NGN)
                <input type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
              <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
                {busy ? 'Saving…' : 'Save project price'}
              </button>
            </form>
          </section>

          <PartPaymentReview order={order} finance={finance} onChanged={load} />

          <ManualPaymentPanel order={order} finance={finance} onChanged={load} />

          <CostManager order={order} finance={finance} onChanged={load} />

          <InternalCostsPanel order={order} work={work} finance={finance} onChanged={load} />

          <BudgetPanel order={order} work={work} finance={finance} onChanged={load} />

          <section className="admin-control-card">
            <span className="posho-section-label">Payment history</span>
            <h3>Complete ledger</h3>
            {order.loadErrors?.payments ? (
              <ErrorBlock message={`Payment history could not be loaded securely. ${order.loadErrors.payments}`} onRetry={load} />
            ) : ledger.length === 0 ? (
              <EmptyState title="No payment has been recorded for this project" body="Provider payments and manual entries appear here with references and balances." />
            ) : (
              <div className="posho-ledger">
                {ledger.map((entry) => (
                  <article key={entry.id} className="posho-ledger-item">
                    <header>
                      <span className={`posho-source-tag posho-source-${entry.payment_type || 'provider'}`}>
                        {entry.payment_type === 'manual' ? 'Manually recorded'
                          : entry.payment_type === 'adjustment' ? 'Adjustment'
                          : entry.payment_type === 'reversal' ? 'Reversal'
                          : 'Provider verified'}
                      </span>
                      <strong className="amount">{formatKobo(entry.amount_kobo)}</strong>
                    </header>
                    <p className="posho-long-value">
                      {entry.provider_reference || entry.manual_reference || 'No reference'} ·{' '}
                      {entry.payment_method || entry.manual_method || ''} · {entry.status}
                      {entry.is_reversed ? ' · Reversed' : ''}
                    </p>
                    <p>
                      {entry.created_at ? new Date(entry.created_at).toLocaleString('en-NG') : ''}
                      {entry.balance_after_kobo !== null && entry.balance_after_kobo !== undefined
                        ? ` · Balance after: ${formatKobo(entry.balance_after_kobo)}` : ''}
                      {entry.part_payment_request_id ? ' · Linked to installment' : ''}
                    </p>
                    {(entry.manual_note || entry.reversal_reason || entry.customer_message) && (
                      <p>{entry.manual_note || entry.reversal_reason || entry.customer_message}</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-control-card">
            <span className="posho-section-label">Provider diagnostics</span>
            <h3>Flutterwave attempts</h3>
            <p className="admin-card-description">
              Provider-verified activity with recheck. Provider transactions
              stay provider-controlled — corrections use manual entries above.
            </p>
            <AdminPaymentAttempts orderId={order.id} />
          </section>

          {finance.paid > 0 && finance.outstanding > 0 && (
            <section className="admin-control-card">
              <span className="posho-section-label">Remaining balance</span>
              <h3>Request remaining payment</h3>
              <form onSubmit={requestBalance} className="posho-form-grid">
                <label>
                  Note to customer
                  <textarea value={balanceNote} onChange={(e) => setBalanceNote(e.target.value)} placeholder="The remaining balance is ready…" />
                </label>
                <label>
                  Due date
                  <input type="date" value={balanceDue} onChange={(e) => setBalanceDue(e.target.value)} />
                </label>
                <button type="submit" className="button button-primary" disabled={actionBusy === 'balance'} aria-busy={actionBusy === 'balance'}>
                  {actionBusy === 'balance' ? 'Requesting…' : 'Request remaining balance'}
                </button>
              </form>
            </section>
          )}
        </div>
      )}

      {tab === 'files' && (
        <div style={{ marginTop: 6 }}>
          <FilesPanel files={order.files} loadError={order.loadErrors?.files} />
        </div>
      )}

      {tab === 'progress' && (
        <div style={{ display: 'grid', gap: 14, marginTop: 6 }}>
          <ProgressPublisher order={order} onChanged={load} />
          <section className="admin-control-card">
            <span className="posho-section-label">History</span>
            <h3>Progress history</h3>
            <ProgressHistory updates={order.progressUpdates} loadError={order.loadErrors?.progress} />
          </section>
        </div>
      )}

      {tab === 'activity' && (
        <div style={{ marginTop: 6 }}>
          <ActivityPanel order={order} loadError={order.loadErrors?.activity} />
        </div>
      )}

      {tab === 'client' && (
        <div style={{ display: 'grid', gap: 14, marginTop: 6 }}>
          <section className="admin-control-card">
            <span className="posho-section-label">Client record</span>
            <h3 className="posho-long-value">{customerName}</h3>
            <div className="posho-ledger">
              <p className="posho-long-value"><strong>Email:</strong> {customer.email || '—'}</p>
              <p className="posho-long-value"><strong>Phone:</strong> {customer.phone || '—'}</p>
              {customer.business_name && <p><strong>Organization:</strong> {customer.business_name}</p>}
              {customer.preferred_contact_method && <p><strong>Preferred contact:</strong> {customer.preferred_contact_method}</p>}
            </div>
          </section>

          <ClientNotesPanel order={order} work={work} onChanged={load} />

          <ProjectMeetings order={order} />

          <section className="admin-control-card">
            <span className="posho-section-label">Project status</span>
            <h3>Update workflow status</h3>            <form onSubmit={updateStatus} className="posho-form-grid">
              <label>
                Status
                <select value={statusForm.status} onChange={(e) => setStatusForm((c) => ({ ...c, status: e.target.value }))}>
                  {workflowStatuses.map((status) => (
                    <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              </label>
              <label>
                Note to customer (optional)
                <textarea value={statusForm.note} onChange={(e) => setStatusForm((c) => ({ ...c, note: e.target.value }))} placeholder="Context for this change…" />
              </label>
              <button type="submit" className="button button-primary" disabled={actionBusy === 'status'} aria-busy={actionBusy === 'status'}>
                {actionBusy === 'status' ? 'Updating…' : 'Update status'}
              </button>
            </form>
          </section>
        </div>
      )}

      {tab === 'settings' && (
        <div style={{ display: 'grid', gap: 14, marginTop: 6 }}>
          <section className="admin-control-card">
            <span className="posho-section-label">Record details</span>
            <h3>Project settings</h3>
            <div className="posho-ledger">
              <p className="posho-long-value"><strong>Reference:</strong> {order.reference}</p>
              <p><strong>Service:</strong> {order.service_slug || '—'} {order.project_type ? `· ${order.project_type}` : ''}</p>
              <p><strong>Submitted:</strong> {order.created_at ? new Date(order.created_at).toLocaleString('en-NG') : '—'}</p>
              <p><strong>Deadline:</strong> {order.deadline || 'Not specified'}</p>
              <p><strong>Archived:</strong> {order.archived_at ? new Date(order.archived_at).toLocaleString('en-NG') : 'No'}</p>
            </div>
          </section>

          <DangerZone order={order} onChanged={load} />
        </div>
      )}

      {declineOpen && (
        <div className="posho-modal-backdrop" onClick={() => actionBusy !== 'decline' && setDeclineOpen(false)}>
          <form
            role="dialog" aria-modal="true" aria-label="Decline project"
            className="posho-modal" onClick={(e) => e.stopPropagation()} onSubmit={decline}
          >
            <div className="posho-modal-heading">
              <h3>Decline project request</h3>
              <button type="button" onClick={() => setDeclineOpen(false)} aria-label="Close" disabled={actionBusy === 'decline'}>×</button>
            </div>
            <p className="posho-modal-description">
              A professional customer-facing reason is required. The customer is notified automatically.
            </p>
            <div className="posho-form-grid">
              <label>
                Reason
                <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Thank you for your request. After review…" />
              </label>
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setDeclineOpen(false)} disabled={actionBusy === 'decline'}>Cancel</button>
              <button type="submit" className="posho-button-danger" disabled={actionBusy === 'decline' || declineReason.trim().length < 10} aria-busy={actionBusy === 'decline'}>
                {actionBusy === 'decline' ? 'Declining…' : 'Decline request'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ClientPreview
        open={previewOpen}
        order={order}
        work={work}
        finance={finance}
        onClose={() => setPreviewOpen(false)}
      />

    </div>
  );
}
