import { ArrowRight } from 'lucide-react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import StepNavigation from '../layout/StepNavigation';

interface TransitionContent {
  checkpoint: string;
  upNext: string;
}

const TRANSITION_CONTENT: Record<string, TransitionContent> = {
  transition_income: {
    checkpoint: 'Great start!',
    upNext: "Now let's walk through each type of income you received in 2025.",
  },
  transition_se: {
    checkpoint: 'You mentioned self-employment income.',
    upNext: "Let's get your business details, expenses, and home office set up.",
  },
  transition_deductions: {
    checkpoint: 'Nice work on your income!',
    upNext: "Now let's find deductions to lower your taxable income.",
  },
  transition_credits: {
    checkpoint: 'Making great progress!',
    upNext: "Now let's look for tax credits — these reduce your tax bill dollar for dollar.",
  },
  transition_state: {
    checkpoint: "You're almost there!",
    upNext: "Let's handle your state tax return.",
  },
  transition_review: {
    checkpoint: 'Almost done!',
    upNext: "Let's review everything and make sure it all looks right.",
  },
};

export default function SectionTransitionStep() {
  const step = useTaxReturnStore((s) => s.getCurrentStep());
  const content = step ? TRANSITION_CONTENT[step.id] : null;

  if (!content) return null;

  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-telos-blue-600/20 text-telos-blue-400 mb-6">
        <ArrowRight className="w-8 h-8" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-3">
        {content.checkpoint}
      </h1>

      <p className="text-slate-400 text-lg mb-2">
        {content.upNext}
      </p>

      <StepNavigation continueLabel="Let's Go" />
    </div>
  );
}
