import { useEffect, useState } from 'react';

import { PlusCircle, Trash2 } from 'lucide-react';

import { useToast } from '../ui/Toast';
import { EmptyState, ErrorBlock } from '../ui/StateBlocks';
import { formatKobo } from '../../lib/money';
import { getQuoteItems, saveQuoteItems } from '../../lib/projectWork';

function toNaira(kobo) {
  const value = Number(kobo || 0) / 100;
  return Number.isFinite(value) ? String(value) : '';
}

export default function QuoteItemsEditor({ order, onChanged }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const quote = (order?.quotes || [])[0] || null;

  const load = async () => {
    if (!quote) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoadError('');
      setLoading(true);
      const rows = await getQuoteItems([quote.id]);
      setItems(rows.map((row) => ({
        title: row.title || '',
        description: row.description || '',
        quantity: String(row.quantity ?? 1),
        unitPrice: toNaira(row.unit_price_kobo),
      })));
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.id]);

  const set = (index, field, value) => {
    setItems((current) => current.map((item, position) => (
      position === index ? { ...item, [field]: value } : item
    )));
  };

  const add = () => setItems((current) => [...current, { title: '', description: '', quantity: '1', unitPrice: '' }]);

  const remove = (index) => setItems((current) => current.filter((_, position) => position !== index));

  const lineTotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 0;
    const unit = Math.round(Number(String(item.unitPrice).replaceAll(',', '')) * 100);
    return sum + (Number.isFinite(unit) ? Math.round(quantity * unit) : 0);
  }, 0);

  const submit = async (event) => {
    event.preventDefault();

    const rows = items
      .filter((item) => item.title.trim())
      .map((item) => ({
        title: item.title.trim(),
        description: item.description.trim(),
        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
        unitPriceKobo: Math.round(Number(String(item.unitPrice).replaceAll(',', '')) * 100),
      }));

    if (rows.length === 0) {
      toast.error('Add at least one item with a title.');
      return;
    }

    if (rows.some((row) => !Number.isFinite(row.unitPriceKobo) || row.unitPriceKobo < 0)) {
      toast.error('Enter a valid price for every item.');
      return;
    }

    try {
      setBusy(true);
      await saveQuoteItems({ orderId: order.id, quoteId: quote.id, items: rows });
      toast.success('Quote breakdown saved. The quote total stays authoritative.');
      await load();
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (!quote) {
    return (
      <section className="admin-control-card">
        <span className="posho-section-label">Quote breakdown</span>
        <h3>Itemized quote</h3>
        <EmptyState title="No quote yet" body="Send a quote first, then break it into line items here." />
      </section>
    );
  }

  return (
    <section className="admin-control-card">
      <span className="posho-section-label">Quote breakdown</span>
      <h3>Itemized quote</h3>
      <p className="admin-card-description">
        Quote total {formatKobo(quote.amount_kobo)} stays authoritative. Lines
        explain the price — they never replace it.
      </p>

      {loading ? (
        <p className="admin-card-description">Loading quote items…</p>
      ) : loadError ? (
        <ErrorBlock message={`Quote items could not be loaded. ${loadError}`} onRetry={load} />
      ) : (
        <form onSubmit={submit} className="posho-form-grid">
          {items.map((item, index) => (
            <div key={index} className="posho-ledger-item">
              <label>
                Item
                <input value={item.title} maxLength={160} onChange={(e) => set(index, 'title', e.target.value)} placeholder="Website design" />
              </label>
              <label>
                Description
                <input value={item.description} maxLength={2000} onChange={(e) => set(index, 'description', e.target.value)} placeholder="5 pages, responsive, contact form" />
              </label>
              <div className="posho-grid-trio">
                <label>
                  Qty
                  <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => set(index, 'quantity', e.target.value)} />
                </label>
                <label>
                  Unit price (NGN)
                  <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => set(index, 'unitPrice', e.target.value)} />
                </label>
                <button type="button" className="button button-secondary" onClick={() => remove(index)} aria-label={`Remove item ${index + 1}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          <button type="button" className="button button-secondary" onClick={add}>
            <PlusCircle size={17} /> Add item
          </button>

          <div className="posho-preview-box" role="status">
            Lines total {formatKobo(lineTotal)} · Quote total {formatKobo(quote.amount_kobo)}
          </div>

          <button type="submit" className="button button-primary" disabled={busy || items.length === 0} aria-busy={busy}>
            {busy ? 'Saving…' : 'Save breakdown'}
          </button>
        </form>
      )}
    </section>
  );
}
