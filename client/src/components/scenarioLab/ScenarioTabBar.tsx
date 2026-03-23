import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, X, Lock, Pencil } from 'lucide-react';
import type { Scenario, ScenarioLabAction } from './types';

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; activeBg: string }> = {
  orange: { bg: 'bg-telos-orange-500/10', border: 'border-telos-orange-500/40', text: 'text-telos-orange-400', activeBg: 'bg-telos-orange-500/20' },
  blue: { bg: 'bg-telos-blue-500/10', border: 'border-telos-blue-500/40', text: 'text-telos-blue-400', activeBg: 'bg-telos-blue-500/20' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/40', text: 'text-violet-400', activeBg: 'bg-violet-500/20' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-400', activeBg: 'bg-emerald-500/20' },
};

interface ScenarioTabBarProps {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  dispatch: React.Dispatch<ScenarioLabAction>;
}

export default function ScenarioTabBar({ scenarios, activeScenarioId, dispatch }: ScenarioTabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startRename = useCallback((id: string, currentName: string) => {
    setEditingId(id);
    setEditText(currentName);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editText.trim()) {
      dispatch({ type: 'RENAME_SCENARIO', id: editingId, name: editText.trim() });
    }
    setEditingId(null);
  }, [editingId, editText, dispatch]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Baseline tab (always present, not editable) */}
      <button
        onClick={() => dispatch({ type: 'SET_ACTIVE_SCENARIO', id: null })}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
          activeScenarioId === null
            ? 'bg-surface-700 border-slate-500 text-white'
            : 'bg-surface-800 border-slate-700/50 text-slate-400 hover:text-slate-300 hover:border-slate-600'
        }`}
      >
        <Lock className="w-3 h-3" />
        Baseline
      </button>

      {/* Scenario tabs */}
      {scenarios.map((s) => {
        const colors = COLOR_CLASSES[s.color] || COLOR_CLASSES.orange;
        const isActive = s.id === activeScenarioId;
        const isEditing = s.id === editingId;

        return (
          <div key={s.id} className="group flex items-center">
            <button
              onClick={() => dispatch({ type: 'SET_ACTIVE_SCENARIO', id: s.id })}
              title={s.overrides.size > 0 ? `${s.overrides.size} variable${s.overrides.size !== 1 ? 's' : ''} changed` : 'No changes yet'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                isActive
                  ? `${colors.activeBg} ${colors.border} ${colors.text}`
                  : `${colors.bg} border-transparent ${colors.text} opacity-70 hover:opacity-100`
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${colors.text.replace('text-', 'bg-')}`} />
              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="bg-transparent border-none outline-none w-24 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span>{s.name}</span>
              )}
            </button>
            {/* Actions: always visible on active tab (touch-friendly), hover-reveal on inactive */}
            <div className={`flex items-center transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
            }`}>
              {!isEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); startRename(s.id, s.name); }}
                  className="p-1 text-slate-500 hover:text-slate-300 transition-colors rounded"
                  title="Rename scenario"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'REMOVE_SCENARIO', id: s.id });
                }}
                className="p-1 text-slate-500 hover:text-red-400 transition-colors rounded"
                title="Remove scenario"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Add scenario button */}
      {scenarios.length < 4 && (
        <button
          onClick={() => dispatch({ type: 'ADD_SCENARIO' })}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white border border-dashed border-slate-600 hover:border-slate-400 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Scenario
        </button>
      )}
    </div>
  );
}
