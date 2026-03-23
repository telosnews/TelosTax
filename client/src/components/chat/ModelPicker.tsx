/**
 * Model Picker — dropdown for switching AI models within the chat panel.
 *
 * Shows the current model with its provider icon. Clicking opens a dropdown
 * (pops upward) listing all available Anthropic models.
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronUp, Check, Lock } from 'lucide-react';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import ProviderIcon from './ProviderIcon';

// ─── Model Catalog ───────────────────────────────

interface ModelOption {
  id: string;
  displayName: string;
  description: string;
}

const MODELS: ModelOption[] = [
  { id: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5', description: 'Fast, affordable' },
  { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', description: 'Balanced' },
  { id: 'claude-opus-4-6', displayName: 'Claude Opus 4.6', description: 'Best quality' },
];

// ─── Component ───────────────────────────────────

export default function ModelPicker() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const mode = useAISettingsStore((s) => s.mode);
  const byokModel = useAISettingsStore((s) => s.byokModel);
  const byokApiKey = useAISettingsStore((s) => s._decryptedApiKey);
  const setBYOKModel = useAISettingsStore((s) => s.setBYOKModel);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape — capture phase so it fires before ChatPanel's Escape handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open]);

  // ── Private mode: no model to pick (no LLM) ──
  if (mode === 'private') {
    return (
      <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md">
        <Lock size={12} className="text-emerald-400" />
        <span className="text-[11px] text-slate-500">Private</span>
      </div>
    );
  }

  // ── BYOK mode: model picker ──

  if (!byokApiKey) {
    return (
      <span className="text-[11px] text-slate-500 px-1.5 py-1">No API key configured</span>
    );
  }

  // Current model info
  const currentModel = MODELS.find((m) => m.id === byokModel);
  const displayName = currentModel?.displayName || byokModel;

  const handleSelect = (model: ModelOption) => {
    setBYOKModel(model.id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1
                   hover:bg-surface-700 transition-colors group"
      >
        <ProviderIcon size={13} />
        <span className="text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors truncate">
          {displayName}
        </span>
        <ChevronUp
          className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${
            open ? '' : 'rotate-180'
          }`}
        />
      </button>

      {/* Dropdown (pops upward) */}
      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 w-64
                     bg-surface-700 border border-slate-600 rounded-lg shadow-xl
                     overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          {MODELS.map((model) => {
            const isActive = model.id === byokModel;
            return (
              <button
                key={model.id}
                onClick={() => handleSelect(model)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors
                  ${isActive ? 'bg-surface-600' : 'hover:bg-surface-600/50'}`}
              >
                <ProviderIcon size={14} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white">{model.displayName}</span>
                  <span className="text-[10px] text-slate-500 ml-1.5">{model.description}</span>
                </div>
                {isActive && (
                  <Check className="w-3.5 h-3.5 text-telos-blue-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
