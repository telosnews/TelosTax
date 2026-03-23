import { useMemo } from 'react';
import { useTaxReturnStore, SECTIONS } from '../../store/taxReturnStore';
import { useChatStore } from '../../store/chatStore';
import { Sparkles } from 'lucide-react';

interface SectionInfo {
  id: string;
  label: string;
  shortLabel: string;
  stepCount: number;
  firstStepIndex: number;
  lastStepIndex: number;
  state: 'completed' | 'active' | 'future';
  /** 0–100 fill percentage within this section */
  fillPercent: number;
}

/** Short labels for narrow viewports */
const SHORT_LABELS: Record<string, string> = {
  my_info: 'Info',
  income: 'Income',
  self_employment: 'SE',
  deductions: 'Deduct',
  credits: 'Credits',
  state: 'State',
  review: 'Review',
  finish: 'Finish',
};

export default function ProgressBar() {
  const { currentStepIndex, goToStep, getVisibleSteps } = useTaxReturnStore();
  const { isAvailable: chatAvailable, togglePanel: toggleChat } = useChatStore();
  const visibleSteps = getVisibleSteps();
  const currentStep = visibleSteps[currentStepIndex];

  const sections = useMemo(() => {
    const result: SectionInfo[] = [];
    for (const section of SECTIONS) {
      const sectionSteps = visibleSteps.filter((s) => s.section === section.id);
      if (sectionSteps.length === 0) continue;

      const firstStepIndex = visibleSteps.indexOf(sectionSteps[0]);
      const lastStepIndex = visibleSteps.indexOf(sectionSteps[sectionSteps.length - 1]);
      const isActive = currentStep?.section === section.id;
      const isCompleted = lastStepIndex < currentStepIndex && !isActive;

      let fillPercent = 0;
      if (isCompleted) {
        fillPercent = 100;
      } else if (isActive) {
        const stepsIntoSection = currentStepIndex - firstStepIndex;
        // +1 so the first step in a section already shows some fill
        fillPercent = sectionSteps.length > 1
          ? ((stepsIntoSection + 1) / sectionSteps.length) * 100
          : 100;
      }

      result.push({
        id: section.id,
        label: section.label,
        shortLabel: SHORT_LABELS[section.id] || section.label,
        stepCount: sectionSteps.length,
        firstStepIndex,
        lastStepIndex,
        state: isCompleted ? 'completed' as const : isActive ? 'active' as const : 'future' as const,
        fillPercent: Math.min(fillPercent, 100),
      });
    }
    return result;
  }, [visibleSteps, currentStepIndex, currentStep]);

  const handleClick = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const targetIndex = section.state === 'completed' ? section.lastStepIndex : section.firstStepIndex;
    const step = visibleSteps[targetIndex];
    if (step) goToStep(step.id);
  };

  return (
    <div className="bg-surface-800 border-b border-slate-700">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-4">
        {/* Segmented progress bar */}
        <div className="flex items-end gap-0.5 sm:gap-1 flex-1 min-w-0">
          {sections.map((section) => {
            const labelColor =
              section.state === 'active'
                ? 'text-white font-semibold'
                : section.state === 'completed'
                  ? 'text-telos-orange-400'
                  : 'text-slate-400';

            return (
              <button
                key={section.id}
                onClick={() => handleClick(section.id)}
                className="flex flex-col items-center gap-1 sm:gap-1.5 cursor-pointer group min-w-0 focus-visible:ring-2 focus-visible:ring-telos-blue-500 focus-visible:rounded focus-visible:outline-none"
                style={{ flex: section.stepCount }}
                aria-current={section.state === 'active' ? 'true' : undefined}
                aria-label={`${section.label}, ${section.stepCount} steps, ${section.state === 'completed' ? 'completed' : section.state === 'active' ? 'in progress' : 'not started'}`}
                title={`${section.label} (${section.stepCount} steps)`}
              >
                {/* Section label — short on mobile, full on sm+ */}
                <span className={`text-xs leading-none truncate max-w-full transition-colors ${labelColor} group-hover:text-slate-300`}>
                  <span className="sm:hidden">{section.shortLabel}</span>
                  <span className="hidden sm:inline">{section.label}</span>
                </span>

                {/* Track + fill */}
                <div className="w-full h-2 sm:h-1.5 bg-surface-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      section.state === 'future'
                        ? 'bg-transparent'
                        : 'bg-telos-orange-500'
                    }`}
                    style={{ width: `${section.fillPercent}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* AI Assistant button — same pill style as the original header button */}
        {chatAvailable && (
          <button
            onClick={toggleChat}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg shrink-0
                       bg-gradient-to-r from-telos-orange-500/15 to-telos-blue-500/15
                       border border-telos-orange-500/30
                       hover:from-telos-orange-500/25 hover:to-telos-blue-500/25
                       hover:border-telos-orange-500/50
                       transition-all duration-200 text-sm group"
            aria-label="Toggle AI assistant"
            title="AI Assistant"
          >
            <Sparkles className="w-4 h-4 text-telos-orange-400 group-hover:text-telos-orange-300 transition-colors" />
            <span className="hidden sm:inline text-sm font-semibold">
              <span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">AI</span> <span className="text-slate-300">Assistant</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
