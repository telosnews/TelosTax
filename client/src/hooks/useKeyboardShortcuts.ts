/**
 * Global Keyboard Shortcuts
 *
 * Centralized handler for all app-wide keyboard shortcuts.
 * Individual shortcuts (⌘K in useCommandPalette, ⌘J in TelosAIButton)
 * remain in their own hooks/components for now — this hook handles the
 * new navigation and utility shortcuts.
 *
 * Shortcuts:
 *   ⌘ Enter       Next step
 *   ⌘ ⇧ Enter     Previous step
 *   ⌘ \           Toggle Interview / Forms view
 *   ⌘ S           Visual save confirmation
 *   ?             Show keyboard shortcuts help (when not in an input)
 */

import { useEffect, useCallback, useState } from 'react';
import { useTaxReturnStore } from '../store/taxReturnStore';

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

export function useKeyboardShortcuts() {
  const [helpOpen, setHelpOpen] = useState(false);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // ⌘ Enter — next step
      if (meta && e.key === 'Enter' && !e.shiftKey) {
        if (isInputFocused()) return; // Don't hijack form submission
        e.preventDefault();
        useTaxReturnStore.getState().goNext();
        return;
      }

      // ⌘ ⇧ Enter — previous step
      if (meta && e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        useTaxReturnStore.getState().goPrev();
        return;
      }

      // ⌘ \ — toggle Interview / Forms view
      if (meta && e.key === '\\') {
        e.preventDefault();
        const store = useTaxReturnStore.getState();
        store.setViewMode(store.viewMode === 'wizard' ? 'forms' : 'wizard');
        return;
      }

      // ⌘ S — visual save confirmation (data is already auto-saved)
      if (meta && e.key === 's') {
        e.preventDefault();
        // Flash the save indicator by briefly setting saveState
        const store = useTaxReturnStore.getState();
        store.setSaveState('saved');
        return;
      }

      // ? — show keyboard shortcuts help (only when not typing)
      if (e.key === '?' && !meta && !e.altKey) {
        if (isInputFocused()) return;
        e.preventDefault();
        setHelpOpen(prev => !prev);
        return;
      }

      // Escape — close help modal
      if (e.key === 'Escape' && helpOpen) {
        e.preventDefault();
        setHelpOpen(false);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [helpOpen]);

  return { helpOpen, openHelp, closeHelp };
}
