import {
  useRef,
} from 'react';

import Modal, {
  ModalHeading,
} from './Modal';

/**
 * Accessible modal confirmation — replaces window.confirm / alert.
 * Portal-based: never clipped by ancestors, body locked, Escape
 * aware, focus trapped in and returned on close.
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

  if (!open) {
    return null;
  }

  return (
    <Modal
      labelledBy="confirm-dialog-title"
      busy={busy}
      dialogClassName={`posho-modal-${tone}`}
      onClose={onClose}
    >
      <ModalHeading
        id="confirm-dialog-title"
        title={title}
        busy={busy}
        onClose={onClose}
      />

      {description && (
        <p className="posho-modal-description">
          {description}
        </p>
      )}

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
    </Modal>
  );
}
