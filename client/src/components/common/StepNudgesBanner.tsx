/**
 * StepNudgesBanner — renders 0-2 proactive nudge cards for the current step.
 *
 * Positioned in the step layout between StepWarningsBanner and SectionIntro.
 * Only shows nudges relevant to the current wizard section, with a hard cap
 * of 2 to prevent nudge fatigue.
 */

import { useNudges } from '../../hooks/useNudges';
import NudgeCard from './NudgeCard';

export default function StepNudgesBanner() {
  const { stepNudges, dismissNudge, enableAndGo, askAI } = useNudges();

  if (stepNudges.length === 0) return null;

  return (
    <div className="space-y-3 mt-4 mb-2">
      {stepNudges.map(nudge => (
        <NudgeCard
          key={nudge.id}
          nudge={nudge}
          onEnableAndGo={enableAndGo}
          onAskAI={askAI}
          onDismiss={dismissNudge}
        />
      ))}
    </div>
  );
}
