import { useEffect } from 'react';

/** Close a modal/sheet on Escape and lock body scroll while open. */
export function useEscapeClose(open, onClose) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);
}
