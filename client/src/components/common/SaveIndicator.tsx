import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, Loader2, HardDrive } from 'lucide-react';

type SaveState = 'idle' | 'saving' | 'saved';

/**
 * A hook that provides auto-save state tracking.
 * Call `markSaving()` when a save begins and `markSaved()` when it completes.
 * The "saved" state auto-clears after 2 seconds back to "idle".
 */
export function useSaveIndicator() {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSaving = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState('saving');
  }, []);

  const markSaved = useCallback(() => {
    setSaveState('saved');
    timerRef.current = setTimeout(() => setSaveState('idle'), 2000);
  }, []);

  const markError = useCallback(() => {
    setSaveState('idle');
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { saveState, markSaving, markSaved, markError };
}

/**
 * Visual save indicator — shows saving/saved/idle states.
 * Place in the top-right of any form step for persistent feedback.
 */
export default function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs transition-opacity duration-300 ${
        state === 'idle' ? 'opacity-40' : 'opacity-100'
      }`}
    >
      {state === 'saving' && (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-telos-blue-400" />
          <span className="text-telos-blue-400">Saving...</span>
        </>
      )}
      {state === 'saved' && (
        <>
          <CheckCircle2 className="w-3 h-3 text-telos-orange-400" />
          <span className="text-telos-orange-400">Saved</span>
        </>
      )}
      {state === 'idle' && (
        <>
          <HardDrive className="w-3 h-3 text-slate-400" />
          <span className="text-slate-400">All changes saved</span>
        </>
      )}
    </div>
  );
}
