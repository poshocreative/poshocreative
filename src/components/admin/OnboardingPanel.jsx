import { useState } from 'react';


import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { runAdminOrderAction } from '../../lib/admin';

export function computeOnboarding(order, finance, files = []) {
  const customer = order?.customers || {};
  const paid = Number(order?.paid_amount_kobo || 0);
  const quoted = Number(order?.quoted_amount_kobo || 0);
  const references = (files || []).filter(
    (file) => file.file_role === 'customer_reference' && file.upload_status === 'uploaded',
  );

  const steps = [
    {
      key: 'created',
      label: 'Project created',
      done: true,
    },
    {
      key: 'client-info',
      label: 'Client information',
      done: Boolean(customer.full_name && customer.email && customer.phone),
    },
    {
      key: 'brief',
      label: 'Project brief',
      done: Boolean(order?.project_description && order?.project_goal),
    },
    {
      key: 'references',
      label: 'Reference files',
      done: references.length > 0,
    },
    {
      key: 'priced',
      label: 'Commercial terms set',
      done: quoted > 0,
    },
    {
      key: 'payment',
      label: 'Initial payment',
      done: paid > 0,
    },
  ];

  const ready =
    order?.review_decision === 'approved' &&
    quoted > 0 &&
    paid > 0 &&
    !['in_progress', 'completed', 'cancelled'].includes(order?.status);

  return { steps, ready };
}

export default function OnboardingPanel({ order, finance, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const files = order?.files || [];
  const { steps, ready } = computeOnboarding(order, finance, files);
  const doneCount = steps.filter((step) => step.done).length;

  const begin = async () => {
    try {
      setBusy(true);

      await runAdminOrderAction({
        orderId: order.id,
        action: 'update_status',
        status: 'in_progress',
        note: 'Project kickoff — work has begun.',
      });

      toast.success('Project started. The client has been notified.');
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (['completed', 'cancelled'].includes(order?.status)) {
    return null;
  }

  return (
    <section className="admin-control-card">
      <div className="finance-request-heading">
        <div>
          <span>ONBOARDING</span>
          <h3>
            Kickoff readiness · {doneCount}/{steps.length}
          </h3>
          <p className="admin-card-description">
            Derived from live records — brief, files, commercial terms and
            first payment. Nothing here is stored separately.
          </p>
        </div>
      </div>

      <div className="posho-timeline">
        {steps.map((step) => (
          <div key={step.key} className="posho-timeline-item">
            <span className="posho-timeline-dot" aria-hidden="true">
              {step.done ? <Icon name="check_circle" size={14} /> : <Icon name="radio_button_unchecked" size={14} />}
            </span>
            <div className="posho-timeline-body">
              <strong>{step.label}</strong>
            </div>
          </div>
        ))}
      </div>

      {ready && order?.status !== 'in_progress' && (
        <div className="finance-review-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="button button-primary"
            onClick={begin}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? <Icon name="hourglass_empty" size={15} className="admin-spin" /> : null}
            {busy ? 'Starting…' : 'Begin project'}
          </button>
        </div>
      )}
    </section>
  );
}
