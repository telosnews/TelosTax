import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface StepNavigationProps {
  onContinue?: () => void | Promise<void>;
  continueLabel?: string;
  showBack?: boolean;
  disabled?: boolean;
}

export default function StepNavigation({
  onContinue,
  continueLabel = 'Continue',
  showBack = true,
  disabled = false,
}: StepNavigationProps) {
  const { currentStepIndex, goNext, goPrev, getVisibleSteps, setSaveState } = useTaxReturnStore();
  const visibleSteps = getVisibleSteps();
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === visibleSteps.length - 1;
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (onContinue) {
      setSaving(true);
      setSaveState('saving');
      try {
        await onContinue();
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch {
        toast.error('Failed to save. Please try again.');
        setSaveState('idle');
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    if (!isLast) {
      goNext();
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 pt-6 pb-6 sm:pb-0 sticky bottom-0 bg-surface-900 sm:static sm:bg-transparent z-10 border-t border-slate-700 sm:border-none mt-auto">
      {showBack && !isFirst ? (
        <button
          onClick={goPrev}
          disabled={disabled || saving}
          className={`btn-secondary flex items-center gap-2 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      ) : (
        <div />
      )}

      <button
        onClick={handleContinue}
        disabled={disabled || saving}
        className="btn-primary flex items-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            {continueLabel}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </>
        )}
      </button>
    </div>
  );
}
