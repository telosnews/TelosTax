import { useState, useEffect, useCallback } from 'react';

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => {
          // Always allow closing the palette (even from the palette's own input)
          if (prev) return false;
          // Don't open when user is typing in a form input/textarea
          const target = e.target as HTMLElement | null;
          if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target?.isContentEditable === true
          ) {
            return false;
          }
          return true;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, open, close };
}
