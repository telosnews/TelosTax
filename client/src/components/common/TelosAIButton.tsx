/**
 * Telos AI Button — floating sparkle + expandable toolbar in the bottom-right.
 *
 * Collapsed: sparkle icon toggles chat panel open/close.
 * Hover: pill expands left to show "Guide me" action button.
 * ⌘J: sends a contextual guide prompt for the current step.
 *
 * Hidden when: a tool view is active, in Forms mode, or on mobile.
 */

import { Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { getGuidePrompt } from '../../data/starterPrompts';

export default function TelosAIButton() {
  const { isOpen: chatOpen, togglePanel, openWithPrompt } = useChatStore();
  const activeToolId = useTaxReturnStore((s) => s.activeToolId);
  const viewMode = useTaxReturnStore((s) => s.viewMode);
  const getCurrentStep = useTaxReturnStore((s) => s.getCurrentStep);

  const currentStep = getCurrentStep();
  const stepId = activeToolId || currentStep?.id || 'unknown';
  const section = activeToolId ? 'tools' : (currentStep?.section || 'unknown');

  const handleGuide = () => {
    const prompt = getGuidePrompt(stepId, section, currentStep?.label);
    openWithPrompt(prompt);
  };

  // ⌘J / Ctrl+J keyboard shortcut — toggles chat panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        togglePanel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  // Hidden in Forms mode (Forms has its own toolbar)
  if (viewMode === 'forms') return null;

  // Offset right when chat panel is open so the button stays visible
  const chatPanelRight = chatOpen
    ? (document.querySelector('[data-testid="chat-panel"]') as HTMLElement)?.offsetWidth ?? 384
    : 0;

  return (
    <div
      className="fixed bottom-6 z-20 hidden sm:block transition-[right] duration-300 ease-in-out"
      style={{ right: chatPanelRight + 24 }}
    >
      <div className="group flex items-center rounded-full
                      bg-surface-700 border border-slate-600/50
                      shadow-lg shadow-black/30
                      hover:shadow-xl hover:shadow-black/40
                      hover:border-telos-orange-500/40
                      transition-all duration-200 ease-out">
        {/* Guide me action — slides out on hover */}
        <div className="max-w-0 overflow-hidden whitespace-nowrap
                        opacity-0 group-hover:max-w-[300px] group-hover:opacity-100
                        transition-all duration-300 ease-out">
          <div className="flex items-center gap-1 pl-3">
            <button
              onClick={handleGuide}
              className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold
                         text-slate-300 hover:bg-surface-600 hover:text-white transition-colors"
              title="Ask AI about this step"
            >
              <span>Guide me with <span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">AI</span></span>
            </button>
          </div>
        </div>

        {/* Sparkle icon — toggles chat panel */}
        <button
          onClick={togglePanel}
          className="flex items-center justify-center w-[60px] h-[60px] rounded-full
                     hover:bg-surface-600 transition-colors"
          aria-label={chatOpen ? 'Close AI chat' : 'Open AI chat'}
          title={chatOpen ? 'Close AI chat' : 'Open AI chat'}
        >
          <Sparkles className="w-7 h-7 text-telos-orange-400 ai-sparkle" />
        </button>
      </div>

      {/* Idle pulse animation */}
      <style>{`
        @keyframes aiSparkle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .ai-sparkle { animation: aiSparkle 3s ease-in-out infinite; }
        .group:hover .ai-sparkle { animation: none; opacity: 1; }
      `}</style>
    </div>
  );
}
