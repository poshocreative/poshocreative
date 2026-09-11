import Icon from './Icon';

import { useEffect, useRef } from 'react';


/**
 * Accessible modal confirmation — replaces window.confirm / alert.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  busyLabel = 'Working…',
  onConfirm,
  onClose,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKey);
    const timer = window.setTimeout(() => confirmRef.current?.focus(), 40);

    return () => {
      window.removeEventListener('keydown', handleKey);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="posho-modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`posho-modal posho-modal-${tone}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="posho-modal-heading">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close dialog" disabled={busy}>
            <Icon name="close" size={19} />
          </button>
        </div>

        {description && <p className="posho-modal-description">{description}</p>}

        <div className="posho-modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={
              tone === 'danger'
                ? 'posho-button-danger'
                : 'button button-primary'
            }
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
