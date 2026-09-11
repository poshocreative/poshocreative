import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  XCircle,
} from 'lucide-react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';
import StatusBadge from '../components/ui/StatusBadge';
import {
  ErrorBlock,
} from '../components/ui/StateBlocks';

import {
  useToast,
} from '../components/ui/Toast';

import {
  useEscapeClose,
} from '../components/ui/useEscapeClose';

import {
  getMyProposals,
  runClientProjectAction,
} from '../lib/clientOps';

import {
  formatNaira,
} from '../lib/reports';

function formatDate(value) {
  if (!value) {
    return 'No expiry set';
  }

  return new Date(
    value.length <= 10
      ? `${value}T12:00:00`
      : value,
  ).toLocaleDateString(
    'en-NG',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );
}

export default function DashboardProposal() {
  const toast = useToast();
  const { id } = useParams();

  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState(null);
  const [note, setNote] = useState('');

  useEscapeClose(
    Boolean(deciding) && !busy,
    () => setDeciding(null),
  );

  const load = useCallback(async () => {
    try {
      setLoadError('');
      setLoading(true);

      const rows = await getMyProposals();
      const found = (rows || []).find((row) => row.id === id);

      if (!found) {
        throw new Error('This proposal is no longer available.');
      }

      setProposal(found);
      document.title = `${found.number} | Posho Creative`;
    } catch (loadErr) {
      setLoadError(
        loadErr.message || 'This proposal could not be opened.',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (event) => {
    event?.preventDefault?.();

    if (!deciding) {
      return;
    }

    if (
      deciding !== 'accept' &&
      !note.trim()
    ) {
      toast.error(
        'Add a note so Management understands your response.',
      );

      return;
    }

    try {
      setBusy(true);

      await runClientProjectAction({
        action: 'proposal_decide',
        proposal_id: proposal.id,
        decision: deciding,
        note: note.trim(),
      });

      toast.success(
        deciding === 'accept'
          ? 'Proposal accepted. Management will prepare the next step.'
          : deciding === 'decline'
            ? 'Proposal declined. Management has been notified.'
            : 'Question sent. Management will respond shortly.',
      );

      setDeciding(null);
      setNote('');
      await load();
    } catch (decideError) {
      toast.error(decideError.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <BrandLoader label="Opening proposal…" />;
  }

  if (loadError || !proposal) {
    return (
      <div className="workspace-view">
        <Link to="/dashboard/orders" className="workspace-back-link">
          <ArrowLeft size={17} /> Projects
        </Link>

        <div style={{ marginTop: 16 }}>
          <ErrorBlock
            message={loadError || 'Proposal not found.'}
            onRetry={() => load()}
          />
        </div>
      </div>
    );
  }

  const items = [...(proposal.items || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
  );

  const decidable = ['sent', 'viewed'].includes(proposal.status);

  return (
    <div className="workspace-view page-reveal">
      <Link to="/dashboard/orders" className="workspace-back-link">
        <ArrowLeft size={17} /> Projects
      </Link>

      <div className="project-detail-hero">
        <div>
          <span className="posho-long-value">{proposal.number} · V{proposal.version}</span>
          <h2 className="posho-long-value">{proposal.title}</h2>
        </div>

        <StatusBadge value={proposal.status} />
      </div>

      {proposal.overview && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <span>OVERVIEW</span>
              <h3>What we propose</h3>
            </div>
          </div>

          <p style={{ whiteSpace: 'pre-wrap' }}>{proposal.overview}</p>
        </section>
      )}

      {(proposal.goals || proposal.scope || proposal.deliverables || proposal.timeline) && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <span>DETAIL</span>
              <h3>Scope and delivery</h3>
            </div>
          </div>

          <div className="project-info-content">
            {proposal.goals && (
              <div>
                <span>Goals</span>
                <p style={{ whiteSpace: 'pre-wrap' }}>{proposal.goals}</p>
              </div>
            )}

            {proposal.scope && (
              <div>
                <span>Scope</span>
                <p style={{ whiteSpace: 'pre-wrap' }}>{proposal.scope}</p>
              </div>
            )}

            {proposal.deliverables && (
              <div>
                <span>Deliverables</span>
                <p style={{ whiteSpace: 'pre-wrap' }}>{proposal.deliverables}</p>
              </div>
            )}

            {proposal.timeline && (
              <div>
                <span>Timeline</span>
                <p style={{ whiteSpace: 'pre-wrap' }}>{proposal.timeline}</p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="workspace-panel">
        <div className="workspace-panel-heading">
          <div>
            <span>COMMERCIAL</span>
            <h3>Investment</h3>
          </div>
        </div>

        <div className="project-cost-list">
          {items.map((item) => (
            <div key={item.id}>
              <div>
                <strong>{item.title}</strong>
                {item.description && <span>{item.description}</span>}
                {Number(item.quantity) !== 1 && (
                  <span>
                    {item.quantity} × {formatNaira(item.unit_price_kobo)}
                  </span>
                )}
              </div>

              <strong>{formatNaira(item.amount_kobo)}</strong>
            </div>
          ))}
        </div>

        <div className="project-summary-list" style={{ marginTop: 12 }}>
          <div>
            <span>Subtotal</span>
            <strong>{formatNaira(proposal.subtotal_kobo)}</strong>
          </div>

          {Number(proposal.discount_kobo || 0) > 0 && (
            <div>
              <span>Discount</span>
              <strong>−{formatNaira(proposal.discount_kobo)}</strong>
            </div>
          )}

          <div>
            <span>Total</span>
            <strong>{formatNaira(proposal.total_kobo)}</strong>
          </div>

          <div>
            <span>Valid until</span>
            <strong>{formatDate(proposal.valid_until)}</strong>
          </div>
        </div>

        {proposal.terms && (
          <p style={{ fontSize: 13, color: '#5f5878', whiteSpace: 'pre-wrap' }}>
            {proposal.terms}
          </p>
        )}
      </section>

      {decidable ? (
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <span>YOUR DECISION</span>
              <h3>Accept, decline or clarify</h3>
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#5f5878' }}>
            Acceptance is recorded with a timestamp. Accepted proposals become
            historical records — later changes arrive as new versions.
          </p>

          <div className="finance-review-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setDeciding('accept');
                setNote('');
              }}
            >
              <CheckCircle2 size={17} /> Accept proposal
            </button>

            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setDeciding('decline');
                setNote('');
              }}
            >
              <XCircle size={17} /> Decline
            </button>

            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setDeciding('clarify');
                setNote('');
              }}
            >
              <HelpCircle size={17} /> Ask a question
            </button>
          </div>
        </section>
      ) : (
        <section className="workspace-panel">
          <p style={{ fontSize: 13, color: '#5f5878' }}>
            {proposal.status === 'accepted' &&
              'You accepted this proposal. Management is preparing the next step.'}
            {proposal.status === 'declined' &&
              'You declined this proposal. A revised version may follow.'}
            {proposal.status === 'expired' &&
              'This proposal expired. Management can issue a new version.'}
            {proposal.status === 'superseded' &&
              'This version was replaced by a newer proposal.'}
            {proposal.decision_note && ` Note: ${proposal.decision_note}`}
          </p>
        </section>
      )}

      {deciding && (
        <div
          className="posho-modal-backdrop"
          onClick={() => !busy && setDeciding(null)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Proposal decision"
            className="posho-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="posho-modal-heading">
              <h3>
                {deciding === 'accept'
                  ? 'Accept proposal'
                  : deciding === 'decline'
                    ? 'Decline proposal'
                    : 'Ask a question'}
              </h3>

              <button
                type="button"
                onClick={() => setDeciding(null)}
                aria-label="Close"
                disabled={busy}
              >
                ×
              </button>
            </div>

            <p className="posho-modal-description">
              {proposal.number} · {formatNaira(proposal.total_kobo)}
              {deciding !== 'accept' &&
                ' — add a note so Management understands.'}
            </p>

            {deciding !== 'accept' && (
              <div className="posho-form-grid">
                <label>
                  <span>Note to Management</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={2000}
                    required
                  />
                </label>
              </div>
            )}

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setDeciding(null)}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="button button-primary"
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
