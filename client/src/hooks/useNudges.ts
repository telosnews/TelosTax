/**
 * useNudges — reactive hook for proactive AI nudges.
 *
 * Computes nudges from the suggestion engine (deterministic gate),
 * manages dismissed state, and provides actions for enable/go and ask AI.
 */

import { useMemo, useCallback } from 'react';
import { useTaxReturnStore } from '../store/taxReturnStore';
import { useChatStore } from '../store/chatStore';
import { computeNudges, getNudgesForStep, type ProactiveNudge } from '../services/nudgeService';

interface UseNudgesResult {
  /** All nudges for the current return (sorted by priority). */
  allNudges: ProactiveNudge[];
  /** Nudges relevant to the current step (max 2). */
  stepNudges: ProactiveNudge[];
  /** Dismiss a nudge (won't appear again for this return). */
  dismissNudge: (id: string) => void;
  /** Enable the discovery key and navigate to the step. */
  enableAndGo: (nudge: ProactiveNudge) => void;
  /** Open the chat with a pre-filled prompt about the nudge. */
  askAI: (nudge: ProactiveNudge) => void;
}

export function useNudges(): UseNudgesResult {
  const { taxReturn, calculation, updateField, goToStep, getCurrentStep } = useTaxReturnStore();
  const { openWithPrompt } = useChatStore();
  const currentStep = getCurrentStep();
  const currentSection = currentStep?.section || 'my_info';
  const currentStepId = currentStep?.id || 'welcome';

  const allNudges = useMemo(() => {
    if (!taxReturn) return [];
    return computeNudges(
      taxReturn,
      calculation,
      currentStepId,
      currentSection,
      taxReturn.dismissedNudges || [],
    );
  }, [taxReturn, calculation, currentStepId, currentSection]);

  const stepNudges = useMemo(
    () => getNudgesForStep(allNudges, currentSection),
    [allNudges, currentSection],
  );

  const dismissNudge = useCallback((id: string) => {
    if (!taxReturn) return;
    const current = taxReturn.dismissedNudges || [];
    if (!current.includes(id)) {
      updateField('dismissedNudges', [...current, id]);
    }
  }, [taxReturn, updateField]);

  const enableAndGo = useCallback((nudge: ProactiveNudge) => {
    if (!taxReturn || !nudge.discoveryKey) return;
    const discovery = taxReturn.incomeDiscovery as Record<string, string>;
    updateField('incomeDiscovery', { ...discovery, [nudge.discoveryKey]: 'yes' });
    if (nudge.stepId) goToStep(nudge.stepId);
  }, [taxReturn, updateField, goToStep]);

  const askAI = useCallback((nudge: ProactiveNudge) => {
    openWithPrompt(nudge.chatPrompt);
  }, [openWithPrompt]);

  return { allNudges, stepNudges, dismissNudge, enableAndGo, askAI };
}
