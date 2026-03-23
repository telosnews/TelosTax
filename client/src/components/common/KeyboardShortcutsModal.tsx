/**
 * Keyboard Shortcuts Help Modal
 *
 * Shows all available keyboard shortcuts, organized by category.
 * Opened via ? key or from the command palette.
 * Matches the command palette's visual style.
 */

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl';

interface Shortcut {
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: [MOD, 'Enter'], label: 'Continue to next step' },
      { keys: [MOD, '⇧', 'Enter'], label: 'Go to previous step' },
      { keys: [MOD, '\\'], label: 'Switch Interview / Forms view' },
    ],
  },
  {
    title: 'AI & Search',
    shortcuts: [
      { keys: [MOD, 'J'], label: 'Open / close AI chat' },
      { keys: [MOD, 'K'], label: 'Open / close command palette' },
    ],
  },
  {
    title: 'Utility',
    shortcuts: [
      { keys: [MOD, 'S'], label: 'Save (auto-saves continuously)' },
      { keys: ['?'], label: 'Show this help' },
    ],
  },
  {
    title: 'Chat',
    shortcuts: [
      { keys: ['Enter'], label: 'Send message' },
      { keys: ['⇧', 'Enter'], label: 'New line in message' },
      { keys: ['Esc'], label: 'Stop AI response' },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5
                    rounded bg-surface-600 border border-surface-500
                    text-xs font-mono text-slate-300 shadow-sm">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsModal({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current === e.target) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm
                 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md mx-4 rounded-xl bg-surface-800 border border-slate-700
                      shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-600">
          <h2 className="text-base font-semibold text-slate-200">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-surface-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Shortcut groups */}
        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.label} className="flex items-center justify-between py-1">
                    <span className="text-sm text-slate-300">{shortcut.label}</span>
                    <div className="flex items-center gap-1 ml-4 shrink-0">
                      {shortcut.keys.map((key, i) => (
                        <Kbd key={i}>{key}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-600">
          <p className="text-[11px] text-slate-500 text-center">
            Press <Kbd>?</Kbd> to toggle this help
          </p>
        </div>
      </div>
    </div>
  );
}
