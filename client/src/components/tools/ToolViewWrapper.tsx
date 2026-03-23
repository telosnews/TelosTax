/**
 * ToolViewWrapper — shared layout for standalone tool views.
 *
 * Provides a "Back to [step]" header and consistent spacing.
 * When the user clicks Back, they return to the wizard step they were on.
 */

import { ReactNode } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { ArrowLeft } from 'lucide-react';

interface ToolViewWrapperProps {
  children: ReactNode;
}

export default function ToolViewWrapper({ children }: ToolViewWrapperProps) {
  const { setActiveTool, getCurrentStep } = useTaxReturnStore();
  const currentStep = getCurrentStep();

  return (
    <div>
      <button
        onClick={() => setActiveTool(null)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-telos-blue-400 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {currentStep?.label || 'wizard'}
      </button>
      {children}
    </div>
  );
}
