import { useState } from 'react';

import { Star } from 'lucide-react';

import { useToast } from '../ui/Toast';
import { submitFeedback } from '../../lib/projectWork';

export default function FeedbackForm({ order, work, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [testimonialPermission, setTestimonialPermission] = useState(false);

  const delivered = Boolean(order?.delivered_at) || order?.status === 'completed';
  const existing = work?.feedback || null;

  if (!delivered) {
    return null;
  }

  if (existing) {
    return (
      <section className="workspace-panel">
        <div className="workspace-panel-heading">
          <div>
            <span>FEEDBACK</span>
            <h3>Thank you</h3>
          </div>
        </div>
        <p>
          You rated this project {existing.rating} out of 5.
          {existing.testimonial_permission ? ' Thank you for letting us share your words.' : ''}
        </p>
      </section>
    );
  }

  const submit = async (event) => {
    event.preventDefault();

    if (rating < 1 || rating > 5) {
      toast.error('Choose a rating between 1 and 5.');
      return;
    }

    try {
      setBusy(true);
      await submitFeedback({
        orderId: order.id,
        rating,
        feedback: feedback.trim(),
        testimonialPermission,
      });
      toast.success('Thank you for your feedback.');
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="workspace-panel">
      <div className="workspace-panel-heading">
        <div>
          <span>FEEDBACK</span>
          <h3>How did we do?</h3>
        </div>
      </div>
      <form onSubmit={submit} className="posho-form-grid">
        <div role="radiogroup" aria-label="Project rating">
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} out of 5`}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHover(value)}
                onMouseLeave={() => setHover(0)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 6,
                  minWidth: 44,
                  minHeight: 44,
                }}
              >
                <Star
                  size={26}
                  fill={(hover || rating) >= value ? '#6C2BD9' : 'none'}
                  color="#6C2BD9"
                />
              </button>
            ))}
          </div>
        </div>
        <label>
          Anything we should know? (optional)
          <textarea value={feedback} maxLength={5000} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well, what could be better…" />
        </label>
        <label className="finance-checkbox-row">
          <input
            type="checkbox"
            checked={testimonialPermission}
            onChange={(e) => setTestimonialPermission(e.target.checked)}
          />
          <span>Posho Creative may share my words as a testimonial</span>
        </label>
        <button type="submit" className="button button-primary" disabled={busy || rating === 0} aria-busy={busy}>
          {busy ? 'Sending…' : 'Send feedback'}
        </button>
      </form>
    </section>
  );
}
