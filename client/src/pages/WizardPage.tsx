import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReturn } from '../api/client';
import { useTaxReturnStore, flushAutoSave } from '../store/taxReturnStore';
import { useChatStore } from '../store/chatStore';
import WizardLayout from '../components/layout/WizardLayout';
import StepRenderer from '../components/steps/StepRenderer';
import { toast } from 'sonner';

export default function WizardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Load return from localStorage and restore step position
  useEffect(() => {
    if (!id) {
      navigate('/', { replace: true });
      return;
    }
    try {
      const { setReturn, setReturnId, setStartTime, goToStep, setCurrentStep } = useTaxReturnStore.getState();
      const hydrateChat = useChatStore.getState().hydrateForReturn;
      const data = getReturn(id);
      setReturn(data);
      setReturnId(id);
      hydrateChat(id);

      // Always start in wizard/interview mode when loading a return
      // (prevents being stuck in Forms view with no forms on a new return)
      useTaxReturnStore.setState({ viewMode: 'wizard' });

      // Restore highest visited step BEFORE restoring position (prevents false jump-ahead warning)
      const savedHighest = typeof (data as any).highestStepVisited === 'number'
        ? (data as any).highestStepVisited
        : (typeof data.currentStep === 'number' ? data.currentStep : 0);
      useTaxReturnStore.setState({ highestStepVisited: savedHighest });

      // Restore navigation position — prefer step ID (safe with dynamic steps)
      if (data.currentStepId) {
        goToStep(data.currentStepId);
      } else if (typeof data.currentStep === 'number' && data.currentStep > 0) {
        setCurrentStep(data.currentStep);
      } else {
        // New return or no saved position — start at Welcome (step 0)
        setCurrentStep(0);
      }

      const { startTime } = useTaxReturnStore.getState();
      if (!startTime) {
        setStartTime(Date.now());
      }

      // Open a tool if requested via ?tool= query param (e.g., from dashboard)
      const params = new URLSearchParams(window.location.search);
      const toolParam = params.get('tool');
      if (toolParam) {
        useTaxReturnStore.getState().setActiveTool(toolParam);
      }
    } catch {
      toast.error('Tax return not found — it may have been deleted or your browser storage was cleared.', {
        id: 'return-not-found',
        duration: 6000,
      });
      navigate('/', { replace: true });
    }
  }, [id, navigate]);

  // Flush any pending auto-save when the user leaves the page
  useEffect(() => {
    window.addEventListener('beforeunload', flushAutoSave);
    return () => window.removeEventListener('beforeunload', flushAutoSave);
  }, []);

  const taxReturn = useTaxReturnStore((s) => s.taxReturn);

  if (!taxReturn) {
    return (
      <div className="min-h-screen bg-surface-900">
        {/* Skeleton header */}
        <div className="bg-surface-800 border-b border-slate-700 px-6 py-3 flex items-center gap-6">
          <div className="h-6 w-24 bg-surface-700 rounded animate-pulse" />
          <div className="h-4 w-20 bg-surface-700 rounded animate-pulse" />
        </div>
        <div className="h-1.5 bg-surface-700" />
        <div className="flex">
          {/* Skeleton sidebar */}
          <div className="hidden lg:block w-64 shrink-0 bg-surface-800 border-r border-slate-700 p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 bg-surface-700 rounded animate-pulse" />
                <div className="h-3 w-32 bg-surface-700/60 rounded animate-pulse ml-4" />
                <div className="h-3 w-28 bg-surface-700/60 rounded animate-pulse ml-4" />
              </div>
            ))}
          </div>
          {/* Skeleton content */}
          <div className="flex-1 p-6 sm:p-8 max-w-3xl mx-auto w-full space-y-4">
            <div className="h-8 w-48 bg-surface-700 rounded animate-pulse" />
            <div className="h-4 w-72 bg-surface-700/60 rounded animate-pulse" />
            <div className="mt-6 space-y-3">
              <div className="h-12 bg-surface-700/40 rounded-lg animate-pulse" />
              <div className="h-12 bg-surface-700/40 rounded-lg animate-pulse" />
              <div className="h-12 bg-surface-700/40 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <WizardLayout>
      <StepRenderer />
    </WizardLayout>
  );
}
