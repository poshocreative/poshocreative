import { useEffect, useState } from 'react';


import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';
import StatusBadge from '../ui/StatusBadge';
import ConfirmDialog from '../ui/ConfirmDialog';
import { formatKobo } from '../../lib/money';
import { acceptQuote, declineQuote, getQuoteItems } from '../../lib/projectWork';

function formatDate(value) {
  if (!value) return 'No expiry set';
  return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function QuoteCard({ order, onChanged }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const quote = (order?.quotes || [])[0] || null;

  useEffect(() => {
    if (!quote) {
      setItems([]);
      return;
    }

    getQuoteItems([quote.id]).then(setItems).catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.id]);

  if (!quote) {
    return null;
  }

  const decided = ['accepted', 'declined', 'expired', 'superseded', 'cancelled'].includes(quote.status);

  const submit = async () => {
    if (!confirming) return;

    try {
      setBusy(true);

      if (confirming === 'accept') {
        await acceptQuote({ orderId: order.id, quoteId: quote.id });
        toast.success('Quote accepted. Payment is now available.');
      } else {
        await declineQuote({ orderId: order.id, quoteId: quote.id });
        toast.success('Quote declined. Management has been notified.');
      }

      setConfirming(null);
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="workspace-panel current-quote-card">
      <div className="workspace-panel-heading">
        <div>
          <span>CURRENT QUOTE</span>
          <h3>{formatKobo(quote.amount_kobo)}</h3>
        </div>
        <StatusBadge value={quote.status} />
      </div>

      <p>{quote.message || 'Your current Posho Creative project quotation.'}</p>

      {items.length > 0 && (
        <div className="project-cost-list" style={{ marginTop: 8 }}>
          {items.map((item) => (
            <div key={item.id}>
              <div>
                <strong>{item.title}</strong>
                {item.description && <span>{item.description}</span>}
                {Number(item.quantity) !== 1 && <span>Qty {item.quantity}</span>}
              </div>
              <strong>{formatKobo(item.amount_kobo)}</strong>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 13, color: '#5f5878' }}>Valid until {formatDate(quote.valid_until)}</p>

      {quote.status === 'sent' && (
        <div className="finance-review-actions">
          <button type="button" className="button button-primary" onClick={() => setConfirming('accept')} disabled={busy}>
            <Icon name="check_circle" size={17} /> Accept quote
          </button>
          <button type="button" className="button button-secondary" onClick={() => setConfirming('decline')} disabled={busy}>
            <Icon name="cancel" size={17} /> Decline
          </button>
        </div>
      )}

      {decided && quote.status !== 'sent' && (
        <p style={{ fontSize: 13, color: '#5f5878' }}>
          {quote.status === 'accepted' && 'You accepted this quote.'}
          {quote.status === 'declined' && 'You declined this quote. Contact us if circumstances change.'}
          {quote.status === 'expired' && 'This quote expired. Management can issue a fresh one.'}
          {quote.status === 'superseded' && 'This quote was replaced by a newer one.'}
        </p>
      )}

      <ConfirmDialog
        open={confirming === 'accept'}
        title="Accept quote"
        description={`Accept the quote of ${formatKobo(quote.amount_kobo)}? This records your agreement and enables payment.`}
        confirmLabel="Accept quote"
        busy={busy}
        busyLabel="Saving…"
        onClose={() => !busy && setConfirming(null)}
        onConfirm={submit}
      />

      <ConfirmDialog
        open={confirming === 'decline'}
        title="Decline quote"
        description="Decline this quote? Management will be notified and can revise it."
        confirmLabel="Decline quote"
        busy={busy}
        busyLabel="Saving…"
        onClose={() => !busy && setConfirming(null)}
        onConfirm={submit}
      />
    </section>
  );
}
