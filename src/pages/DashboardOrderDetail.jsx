import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Info,
  ReceiptText,
  XCircle,
} from 'lucide-react';

import { useParams } from 'react-router-dom';

import Link from '../components/PortalLink';

import BrandLoader from '../components/BrandLoader';
import PartPaymentRequest from '../components/payment/PartPaymentRequest';
import ProjectFileUploader from '../components/ProjectFileUploader';
import ProjectServiceDetails from '../components/ProjectServiceDetails';
import ChangeResponse from '../components/client/ChangeResponse';
import ClientAgreements from '../components/client/ClientAgreements';
import DeliverableReview from '../components/client/DeliverableReview';
import FeedbackForm from '../components/client/FeedbackForm';
import MilestonesView from '../components/client/MilestonesView';
import QuoteCard from '../components/client/QuoteCard';
import FinanceCards from '../components/ui/FinanceCards';
import { ErrorBlock } from '../components/ui/StateBlocks';

import { buildFinanceSnapshot } from '../lib/finance';
import { formatKobo, paymentSourceLabel } from '../lib/money';
import { formatProjectState, getOrderByReference } from '../lib/orders';
import { getClientProjectWork } from '../lib/projectWork';

function formatDate(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function displayFileName(value) {
  const normalized = String(value || '')
    .replaceAll('\\', '/')
    .split('/')
    .filter(Boolean)
    .pop();

  return normalized || 'Project file';
}

export default function DashboardOrderDetail() {
  const { reference } = useParams();

  const [order, setOrder] = useState(null);
  const [work, setWork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoadError('');
      const result = await getOrderByReference(reference);
      setOrder(result);

      if (result) {
        document.title = `${result.reference} | Posho Creative`;

        try {
          setWork(await getClientProjectWork(result.id));
        } catch (workError) {
          console.error(workError);
          setWork({ loadErrors: { general: workError.message } });
        }
      }
    } catch (loadErr) {
      setLoadError(loadErr.message || 'This project could not be opened.');
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    load();
  }, [load]);

  const finance = useMemo(() => {
    if (!order) return null;

    return buildFinanceSnapshot({
      order,
      costs: order.costs || [],
      partRequests: order.partRequests || [],
    });
  }, [order]);

  if (loading) {
    return <BrandLoader label="Opening project…" />;
  }

  if (loadError) {
    return (
      <div className="workspace-view">
        <Link to="/dashboard/orders" className="workspace-back-link">
          <ArrowLeft size={17} /> Projects
        </Link>
        <div style={{ marginTop: 16 }}>
          <ErrorBlock message={loadError} onRetry={() => { setLoading(true); load(); }} />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="workspace-view">
        <Link to="/dashboard/orders" className="workspace-back-link">
          <ArrowLeft size={17} /> Projects
        </Link>
        <div className="workspace-empty">Project not found.</div>
      </div>
    );
  }

  const pending = order.review_decision === 'pending';
  const approved = order.review_decision === 'approved';
  const declined = order.review_decision === 'declined';
  const awaitingClient = approved && order.status === 'awaiting_client';
  const cancelled = approved && order.status === 'cancelled';
  const latestUpdate = order.notes?.[0]?.note || '';

  const outstanding = finance?.outstanding ?? 0;
  const paid = finance?.paid ?? 0;
  const total = finance?.total ?? 0;
  const dueNow = finance?.dueNow ?? outstanding;
  const approvedInstallment = finance?.approvedRequest || null;
  const pendingRequest = finance?.pendingRequest || null;

  const activeCosts = (order.costs || []).filter((cost) => cost.status === 'active');

  const canPay =
    approved &&
    !cancelled &&
    outstanding > 0 &&
    !['completed', 'cancelled'].includes(order.status);

  const progress = Math.max(0, Math.min(100, Number(order.progress_percent || 0)));
  const progressUpdates = order.progressUpdates || [];
  const payments = (order.payments || []).filter((payment) => payment.status === 'successful');
  const references = (order.files || []).filter((file) => file.file_role !== 'deliverable' && file.file_role !== 'final_deliverable');

  const currentQuote = (order.quotes || [])[0] || null;
  const quoteAwaiting = currentQuote && currentQuote.status === 'sent';
  const visibleDeliverables = (work?.deliverables || []).filter(
    (deliverable) => deliverable.visible_to_client !== false,
  );
  const pendingReview = visibleDeliverables.filter(
    (deliverable) => deliverable.client_approval_state === 'pending',
  );
  const awaitingChanges = (work?.changeRequests || []).filter(
    (change) => change.status === 'sent',
  );
  const feedbackOpen = (Boolean(order.delivered_at) || order.status === 'completed') && !work?.feedback;

  const actions = [];

  if (quoteAwaiting) {
    actions.push({
      title: `Review your quote of ${formatKobo(currentQuote.amount_kobo)}`,
      body: 'Accept the quote to enable payment, or decline it so Management can revise it.',
      to: null,
      cta: null,
    });
  }

  if (pendingReview.length > 0) {
    actions.push({
      title: `${pendingReview.length} deliverable${pendingReview.length === 1 ? '' : 's'} waiting for your review`,
      body: 'Approve finished work or request a revision with specific feedback.',
      to: null,
      cta: null,
    });
  }

  if (awaitingChanges.length > 0) {
    actions.push({
      title: `${awaitingChanges.length} change request${awaitingChanges.length === 1 ? '' : 's'} need${awaitingChanges.length === 1 ? 's' : ''} your decision`,
      body: 'Review the cost and timeline impact, then accept, decline or ask a question.',
      to: null,
      cta: null,
    });
  }

  if (feedbackOpen) {
    actions.push({
      title: 'How did we do?',
      body: 'Your project is delivered — a quick rating helps Posho Creative improve.',
      to: null,
      cta: null,
    });
  }

  if (canPay && approvedInstallment) {
    actions.push({
      title: `Pay your approved installment of ${formatKobo(approvedInstallment.approved_amount_kobo)}`,
      body: `Due ${formatDate(approvedInstallment.approval_expires_at)}. The full project value of ${formatKobo(total)} is unchanged.`,
      to: `/dashboard/orders/${order.reference}/pay`,
      cta: `Pay ${formatKobo(approvedInstallment.approved_amount_kobo)}`,
    });
  } else if (canPay) {
    actions.push({
      title: `Payment of ${formatKobo(outstanding)} is ready`,
      body: pendingRequest
        ? 'Your part-payment request is waiting for Management review.'
        : 'Settle the balance securely or request a part-payment arrangement below.',
      to: `/dashboard/orders/${order.reference}/pay`,
      cta: 'Pay securely',
    });
  }

  if (awaitingClient || order.customer_action_required) {
    actions.push({
      title: order.customer_action_label || 'Your response is needed',
      body: latestUpdate || 'Review the latest update and respond through your agreed channel.',
      to: null,
      cta: null,
    });
  }

  const earlyStage = ['new', 'under_review', 'quote_sent', 'awaiting_payment'].includes(order.status)
    && !['completed', 'cancelled'].includes(order.status);

  const nextSteps = [];

  if (earlyStage) {
    if (pending) {
      nextSteps.push('We review your request');
    }

    if (approved && !finance?.hasPrice) {
      nextSteps.push('We prepare your quote');
    }

    if (references.length === 0) {
      nextSteps.push('You upload reference files');
    }

    if (approved && finance?.hasPrice && outstanding > 0 && paid === 0) {
      nextSteps.push('You complete the first payment');
    }

    if (approved && paid > 0) {
      nextSteps.push('We begin your project');
    }
  }

  return (
    <div className="workspace-view page-reveal">
      <Link to="/dashboard/orders" className="workspace-back-link">
        <ArrowLeft size={17} /> Projects
      </Link>

      <div className="project-detail-hero">
        <div>
          <span className="posho-long-value">{order.reference}</span>
          <h2 className="posho-long-value">{order.project_title}</h2>
          <p>{String(order.service_slug || '').replaceAll('-', ' ')}</p>
        </div>
        <span className={`workspace-status project-review-status ${order.review_decision}`}>
          {formatProjectState(order)}
        </span>
      </div>

      {order.progress_percent !== null && order.progress_percent !== undefined && approved && (
        <section className="workspace-panel" aria-label="Project progress">
          <div className="workspace-panel-heading">
            <div>
              <span>PROGRESS</span>
              <h3>{progress}% · {order.progress_label || 'In progress'}</h3>
            </div>
            <strong>{progress}%</strong>
          </div>
          <div className="posho-progress-track" style={{ background: '#ece7f8' }} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Project progress">
            <div className="posho-progress-fill" style={{ width: `${progress}%`, background: '#6C2BD9' }} />
          </div>
          {order.progress_message && <p style={{ marginTop: 10 }}>{order.progress_message}</p>}
        </section>
      )}

      {earlyStage && nextSteps.length > 0 && (
        <section className="workspace-panel" aria-label="Getting started">
          <div className="workspace-panel-heading">
            <div>
              <span>GETTING STARTED</span>
              <h3>What happens next</h3>
            </div>
          </div>
          <ol className="posho-timeline" style={{ listStyle: 'none', padding: 0 }}>
            {nextSteps.map((step) => (
              <li key={step} className="posho-timeline-item">
                <span className="posho-timeline-dot" aria-hidden="true">•</span>
                <div className="posho-timeline-body">
                  <strong>{step}</strong>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {actions.length > 0 && (
        <div className="posho-action-center">
          <h2>What you need to do</h2>
          {actions.map((action) => (
            <div key={action.title} className="posho-action-item">
              <div>
                <strong>{action.title}</strong>
                {action.body && <p>{action.body}</p>}
                {action.to && (
                  <Link to={action.to} className="button button-primary">
                    {action.cta} <ArrowRight size={16} />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pending && (
        <section className="project-review-banner pending">
          <Clock3 size={22} />
          <div>
            <span>REQUEST RECEIVED</span>
            <h3>Your project is being reviewed.</h3>
            <p>
              We are reviewing the scope, timeline and requirements before confirming the next step. Any decision or quotation will appear here.
            </p>
          </div>
        </section>
      )}

      {approved && !cancelled && (
        <section className="project-review-banner approved">
          <CheckCircle2 size={22} />
          <div>
            <span>PROJECT APPROVED</span>
            <h3>Your request has been accepted.</h3>
            <p>
              Your project may now progress through quotation, payment and production according to its requirements.
            </p>
          </div>
        </section>
      )}

      {declined && (
        <section className="project-review-banner declined">
          <XCircle size={22} />
          <div>
            <span>MANAGEMENT DECISION</span>
            <h3>We are unable to proceed with this request.</h3>
            <p>
              {order.decline_reason ||
                'Please contact Posho Creative if you would like to discuss a different approach.'}
            </p>
          </div>
        </section>
      )}

      {cancelled && (
        <section className="project-review-banner declined">
          <XCircle size={22} />
          <div>
            <span>PROJECT STATUS</span>
            <h3>This project has been closed.</h3>
            <p>
              {latestUpdate ||
                'Please contact Posho Creative if you need clarification about this project status.'}
            </p>
          </div>
        </section>
      )}

      {awaitingClient && (
        <section className="project-review-banner pending">
          <Info size={22} />
          <div>
            <span>YOUR RESPONSE IS NEEDED</span>
            <h3>{order.customer_action_label || 'We need information from you.'}</h3>
            <p>
              {latestUpdate ||
                'Please review your latest project update and respond through the agreed communication channel.'}
            </p>
          </div>
        </section>
      )}

      {order.delivered_at && order.status !== 'completed' && (
        <section className="project-review-banner approved">
          <CheckCircle2 size={22} />
          <div>
            <span>PROJECT DELIVERED</span>
            <h3>Your finished work is ready.</h3>
            <p>
              Delivered {formatDate(order.delivered_at)}. Download the final
              files below and share your feedback — it takes less than a minute.
            </p>
          </div>
        </section>
      )}

      {order.status === 'completed' && (
        <section className="project-review-banner approved">
          <CheckCircle2 size={22} />
          <div>
            <span>PROJECT COMPLETED</span>
            <h3>Thank you for working with Posho Creative.</h3>
            <p>
              This project is complete. Your files remain available below.
            </p>

            <Link
              to="/order"
              className="button button-secondary"
              style={{ marginTop: 8 }}
            >
              Need another project? Start a new request
            </Link>
          </div>
        </section>
      )}

      {approved && !cancelled && finance?.hasPrice && (
        <FinanceCards
          baseKobo={finance.base}
          additionalKobo={finance.additional}
          totalKobo={total}
          paidKobo={paid}
          outstandingKobo={outstanding}
          dueNowKobo={dueNow}
          dueLabel={approvedInstallment ? 'Amount due now (installment)' : 'Amount due now'}
          action={
            canPay ? (
              <Link to={`/dashboard/orders/${order.reference}/pay`} className="button button-primary">
                {approvedInstallment
                  ? `Pay ${formatKobo(approvedInstallment.approved_amount_kobo)}`
                  : `Pay ${formatKobo(outstanding)}`}
              </Link>
            ) : null
          }
        />
      )}

      {approvedInstallment && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <span>PAYMENT ARRANGEMENT</span>
              <h3>Installment approved</h3>
            </div>
            <CheckCircle2 size={20} />
          </div>
          <div className="project-summary-list">
            <div>
              <span>Total project value</span>
              <strong>{formatKobo(total)}</strong>
            </div>
            <div>
              <span>Confirmed paid</span>
              <strong>{formatKobo(paid)}</strong>
            </div>
            <div>
              <span>Remaining balance</span>
              <strong>{formatKobo(outstanding)}</strong>
            </div>
            <div>
              <span>Amount due now</span>
              <strong>{formatKobo(approvedInstallment.approved_amount_kobo)}</strong>
            </div>
            <div>
              <span>Due</span>
              <strong>{formatDate(approvedInstallment.approval_expires_at)}</strong>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#5f5878' }}>
            The installment changes what is due now — not the overall project value of {formatKobo(total)}.
          </p>
        </section>
      )}

      {canPay && (
        <PartPaymentRequest
          orderId={order.id}
          orderReference={order.reference}
          outstandingKobo={outstanding}
        />
      )}

      {approved && !cancelled && (
        <QuoteCard order={order} onChanged={load} />
      )}

      <div className="project-detail-grid">
        <div className="project-detail-main">
          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <span>PROJECT BRIEF</span>
                <h3>Requirements</h3>
              </div>
            </div>
            <div className="project-info-content">
              <div>
                <span>Description</span>
                <p>{order.project_description}</p>
              </div>
              <div>
                <span>Goal</span>
                <p>{order.project_goal}</p>
              </div>
            </div>
          </section>

          <ProjectServiceDetails details={order.service_details} />

          <MilestonesView work={work} onChanged={load} />

          <DeliverableReview order={order} work={work} onChanged={load} />

          <ChangeResponse order={order} work={work} onChanged={load} />

          <ClientAgreements order={order} onChanged={load} />

          {progressUpdates.length > 0 && (
            <section className="workspace-panel">
              <div className="workspace-panel-heading">
                <div>
                  <span>PROGRESS HISTORY</span>
                  <h3>How your project evolved</h3>
                </div>
              </div>
              <div className="posho-timeline">
                {progressUpdates.map((update) => (
                  <div key={update.id} className="posho-timeline-item">
                    <span className="posho-timeline-dot">{Number(update.progress_percent ?? 0)}%</span>
                    <div className="posho-timeline-body">
                      <strong>{update.label || 'Progress update'}</strong>
                      <p>{update.message}</p>
                      <time>{formatDate(update.created_at)}</time>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <span>PROJECT UPDATES</span>
                <h3>Communication</h3>
              </div>
            </div>
            {order.loadErrors?.notes ? (
              <ErrorBlock message={`Updates could not be loaded. ${order.loadErrors.notes}`} onRetry={load} />
            ) : order.notes.length === 0 ? (
              <div className="workspace-empty workspace-empty-compact">
                <p>No project updates yet.</p>
              </div>
            ) : (
              <div className="project-history">
                {order.notes.map((note) => (
                  <article key={note.id} className="project-history-item">
                    <span className="project-history-dot" aria-hidden="true" />
                    <strong>Posho Creative</strong>
                    <p>{note.note}</p>
                    {note.created_at && (
                      <time dateTime={note.created_at}>{formatDate(note.created_at)}</time>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <span>FILES</span>
                <h3>Project files</h3>
              </div>
              <FileText size={20} />
            </div>
            <ProjectFileUploader
              orderId={order.id}
              disabled={cancelled}
              onUploaded={load}
            />
            {order.loadErrors?.files ? (
              <ErrorBlock message={`Project files could not be loaded securely. ${order.loadErrors.files}`} onRetry={load} />
            ) : references.length === 0 ? (
              <div className="workspace-empty workspace-empty-compact">
                <p>No project files available.</p>
              </div>
            ) : (
              <div className="project-file-list">
                {references.map((file) => (
                  <article key={file.id} className="project-file-row">
                    <div className="project-file-icon">
                      <FileText size={18} />
                    </div>
                    <div>
                      <strong className="posho-long-value" title={displayFileName(file.original_name)}>
                        {displayFileName(file.original_name)}
                      </strong>
                      <span>{String(file.file_role || 'reference').replaceAll('_', ' ')}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="project-detail-sidebar">
          {approved && !cancelled && finance?.hasPrice && (
            <section className="workspace-panel project-summary-panel">
              <div className="workspace-panel-heading">
                <div>
                  <span>FINANCIALS</span>
                  <h3>Project value</h3>
                </div>
              </div>
              <div className="project-summary-list">
                <div>
                  <span>Project value</span>
                  <strong>{formatKobo(total)}</strong>
                </div>
                <div>
                  <span>Paid</span>
                  <strong>{formatKobo(paid)}</strong>
                </div>
                <div>
                  <span>Outstanding</span>
                  <strong>{formatKobo(outstanding)}</strong>
                </div>
                <div>
                  <span>Due now</span>
                  <strong>{formatKobo(dueNow)}</strong>
                </div>
              </div>
            </section>
          )}

          {approved && !cancelled && activeCosts.length > 0 && (
            <section className="workspace-panel project-cost-breakdown">
              <div className="workspace-panel-heading">
                <div>
                  <span>ADDITIONAL COSTS</span>
                  <h3>Project additions</h3>
                </div>
                <ReceiptText size={20} />
              </div>
              <div className="project-cost-list">
                {activeCosts.map((cost) => (
                  <div key={cost.id}>
                    <div>
                      <strong>{cost.title}</strong>
                      {cost.description && <span>{cost.description}</span>}
                    </div>
                    <strong>{formatKobo(cost.amount_kobo)}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          <FeedbackForm order={order} work={work} onChanged={load} />

          {payments.length > 0 && (
            <section className="workspace-panel">
              <div className="workspace-panel-heading">
                <div>
                  <span>RECEIPTS</span>
                  <h3>Payment history</h3>
                </div>
              </div>
              <div className="project-cost-list">
                {payments.slice(0, 8).map((payment) => (
                  <div key={payment.id}>
                    <div>
                      <strong>{formatKobo(payment.base_amount_kobo ?? payment.amount_kobo)}</strong>
                      <span>
                        {formatDate(payment.completed_at || payment.verified_at || payment.created_at)} ·{' '}
                        {paymentSourceLabel(payment)}
                      </span>
                    </div>
                    <span className="posho-long-value" style={{ fontSize: 12 }}>
                      {payment.manual_reference || payment.provider_reference}
                    </span>
                  </div>
                ))}
              </div>
              <Link to="/dashboard/payments" className="button button-secondary" style={{ marginTop: 10 }}>
                View all payments
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
