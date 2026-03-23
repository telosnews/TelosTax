/**
 * Thinking Indicator — shows contextual "reasoning" steps while the AI is working.
 *
 * Replaces the generic bouncing dots with tax-specific thinking steps that
 * accumulate over time, giving users a sense of progress. Steps are picked
 * based on the user's message content and current wizard section.
 *
 * Steps are simulated (not streamed from the model) but contextually accurate —
 * they reflect the kind of analysis the model is actually performing.
 */

import { useState, useEffect, useRef } from 'react';
import { Loader2, Check } from 'lucide-react';

interface Props {
  /** The user's last message, used to pick contextual steps. */
  userMessage?: string;
  /** Current wizard section (income, deductions, credits, etc.). */
  section?: string;
}

// ─── Thinking Step Pools ─────────────────────────

const POOLS: Record<string, string[]> = {
  income: [
    'Analyzing income sources...',
    'Checking tax bracket impact...',
    'Reviewing withholding details...',
  ],
  deductions: [
    'Reviewing available deductions...',
    'Checking AGI limitations...',
    'Comparing standard vs. itemized...',
  ],
  credits: [
    'Scanning eligible credits...',
    'Checking phase-out ranges...',
    'Calculating credit amounts...',
  ],
  retirement: [
    'Reviewing retirement contributions...',
    'Checking contribution limits...',
    'Analyzing tax-deferred benefits...',
  ],
  investment: [
    'Analyzing capital gains...',
    'Checking holding periods...',
    'Reviewing cost basis calculations...',
  ],
  amt: [
    'Calculating regular tax...',
    'Reviewing AMT implications...',
    'Checking exemption amounts...',
  ],
  selfEmployment: [
    'Calculating self-employment tax...',
    'Reviewing business deductions...',
    'Checking QBI deduction eligibility...',
  ],
  general: [
    'Analyzing your tax situation...',
    'Reviewing relevant tax rules...',
    'Checking for applicable provisions...',
  ],
};

const FINISHER = 'Preparing response...';

function pickPool(message: string, section: string): string[] {
  const msg = message.toLowerCase();

  if (/amt|alternative minimum/i.test(msg)) return POOLS.amt;
  if (/qbi|qualified business|self-employ|1099-nec|schedule c|freelanc/i.test(msg)) return POOLS.selfEmployment;
  if (/deduct|itemiz|standard deduction|mortgage|charit|donat|medical|state.?tax/i.test(msg)) return POOLS.deductions;
  if (/credit|child tax|earned income|eic|eitc|education|savers|ev.?credit/i.test(msg)) return POOLS.credits;
  if (/invest|capital gain|stock|divid|1099-b|1099-div|crypto/i.test(msg)) return POOLS.investment;
  if (/retir|ira|401k|roth|pension|1099-r|social security/i.test(msg)) return POOLS.retirement;
  if (/w-?2|1099|income|wage|salary/i.test(msg)) return POOLS.income;

  switch (section) {
    case 'income': return POOLS.income;
    case 'deductions': return POOLS.deductions;
    case 'credits': return POOLS.credits;
    default: return POOLS.general;
  }
}

// ─── Component ───────────────────────────────────

const STEP_INTERVAL_MS = 2500;

export default function ThinkingIndicator({ userMessage = '', section = '' }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const prevMessage = useRef(userMessage);

  const pool = pickPool(userMessage, section);
  const steps = [...pool, FINISHER];

  // Reset when a new message triggers loading
  useEffect(() => {
    if (userMessage !== prevMessage.current) {
      setStepIndex(0);
      prevMessage.current = userMessage;
    }
  }, [userMessage]);

  // Advance to next step on interval
  useEffect(() => {
    if (stepIndex >= steps.length - 1) return; // Stay on finisher
    const timer = setTimeout(() => {
      setStepIndex((i) => i + 1);
    }, STEP_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [stepIndex, steps.length]);

  const visibleSteps = steps.slice(0, stepIndex + 1);

  return (
    <div className="flex justify-start mb-3">
      <div className="bg-surface-700 border border-slate-600/50 rounded-xl px-4 py-3">
        <div className="space-y-1.5">
          {visibleSteps.map((step, i) => {
            const isActive = i === stepIndex;
            return (
              <div
                key={step}
                className="flex items-center gap-2"
                style={isActive ? {
                  animation: 'thinkFadeIn 300ms ease-out',
                } : undefined}
              >
                {isActive ? (
                  <Loader2 className="w-3 h-3 text-telos-blue-400 animate-spin flex-shrink-0" />
                ) : (
                  <Check className="w-3 h-3 text-slate-500 flex-shrink-0" />
                )}
                <span className={`text-xs ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Inline keyframe for fade-in — no external CSS dependency */}
      <style>{`@keyframes thinkFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
