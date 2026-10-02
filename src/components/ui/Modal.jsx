import {
  useEffect,
  useRef,
} from 'react';

import { createPortal } from 'react-dom';

import Icon from './Icon';

/**
 * Canonical application modal.
 *
 * Rendered through a portal to document.body so no ancestor
 * transform / filter / overflow can ever clip it, with:
 * - body scroll locked while open
 * - Escape to close (unless busy)
 * - focus moved into the dialog and returned on close
 * - safe centering: centered when it fits, top-aligned and
 *   scrollable when taller than the viewport
 * - bottom-sheet presentation on small screens
 *
 * Styling reuses the global posho-modal classes so every
 * dialog looks identical without new CSS.
 */
export default function Modal({
  labelledBy = 'modal-title',
  onClose,
  busy = false,
  wide = false,
  children,
  dialogClassName = '',
  labelledby,
}) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  const labelId =
    labelledby || labelledBy;

  // Body scroll lock (reference-counted for stacked dialogs).
  useEffect(() => {
    if (
      typeof document ===
      'undefined'
    ) {
      return undefined;
    }

    const count = Number(
      document.body.dataset
        .poshoModalCount || 0,
    );

    document.body.dataset.poshoModalCount =
      String(count + 1);

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      'hidden';

    return () => {
      const next = Number(
        document.body.dataset
          .poshoModalCount || 1,
      );

      document.body.dataset.poshoModalCount =
        String(
          Math.max(0, next - 1),
        );

      if (next <= 1) {
        document.body.style.overflow =
          previousOverflow;
      }
    };
  }, []);

  // Escape closes (unless busy). Focus enters + returns.
  useEffect(() => {
    previousFocusRef.current =
      document.activeElement;

    const node =
      dialogRef.current;

    if (node) {
      const focusable = node.querySelector(
        'input, select, textarea, button:not([disabled])',
      );

      (focusable || node).focus?.();
    }

    const onKeyDown = (
      event,
    ) => {
      if (
        event.key ===
          'Escape' &&
        !busy &&
        typeof onClose ===
          'function'
      ) {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener(
      'keydown',
      onKeyDown,
      true,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        onKeyDown,
        true,
      );

      const previous =
        previousFocusRef.current;

      if (
        previous &&
        typeof previous.focus ===
          'function'
      ) {
        previous.focus();
      }
    };
  }, [busy, onClose]);

  return createPortal(
    <div
      className="posho-modal-backdrop"
      data-modal-portal="true"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !busy &&
          typeof onClose ===
            'function'
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          labelId
        }
        tabIndex={-1}
        className={
          wide
            ? `posho-modal posho-modal-wide ${dialogClassName}`.trim()
            : `posho-modal ${dialogClassName}`.trim()
        }
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ModalHeading({
  id = 'modal-title',
  title,
  onClose,
  busy = false,
}) {
  return (
    <div className="posho-modal-heading">
      <h3 id={id}>{title}</h3>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        disabled={busy}
      >
        <Icon
          name="close"
          size={19}
        />
      </button>
    </div>
  );
}
