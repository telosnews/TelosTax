import { useEffect, RefObject } from 'react';

const FOCUSABLE_SELECTOR = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Reference counter so stacked overlays don't prematurely unlock scroll. */
let scrollLockCount = 0;

function lockScroll() {
  scrollLockCount++;
  if (scrollLockCount === 1) {
    document.body.style.overflow = 'hidden';
  }
}

function unlockScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = '';
  }
}

/**
 * Traps Tab key focus within a container element.
 * Also locks body scroll and handles Escape to call onClose.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onClose?: () => void,
) {
  useEffect(() => {
    if (!active) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
        return;
      }

      if (e.key === 'Tab' && containerRef.current) {
        const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    lockScroll();

    return () => {
      document.removeEventListener('keydown', handleKey);
      unlockScroll();
    };
  }, [active, containerRef, onClose]);
}
