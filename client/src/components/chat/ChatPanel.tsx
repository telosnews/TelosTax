/**
 * Chat Panel — right drawer containing the full chat experience.
 *
 * Slides in from the right edge. Contains:
 * - Header with title, mode indicator, settings gear, and close button
 * - Privacy disclaimer (first open only, mode-aware)
 * - PII warning banner (when PII detected in cloud modes)
 * - Scrollable message area with auto-scroll
 * - Loading indicator (pulsing dots)
 * - Error display
 * - Sticky input at bottom
 */

import { X, Sparkles, Trash2, Settings, ArrowDown, Shield, CheckCircle2, Key } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { getStarterPrompts, type NudgePrompt } from '../../data/starterPrompts';
import { useNudges } from '../../hooks/useNudges';
import PrivacyDisclaimer from './PrivacyDisclaimer';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import PIIWarning from './PIIWarning';
import AISettingsPanel from './AISettingsPanel';
import PrivacyAuditPanel from './PrivacyAuditPanel';
import ThinkingIndicator from './ThinkingIndicator';
import ResizeHandle from '../common/ResizeHandle';

/** Short labels for the mode indicator in the header. */
const MODE_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  private: { label: 'Private', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  byok: { label: 'BYOK', color: 'text-telos-blue-400', bg: 'bg-telos-blue-500/10', border: 'border-telos-blue-500/30' },
};

interface ChatPanelProps {
  panelWidth?: number;
  isDragging?: boolean;
  onResizeStart?: (e: React.MouseEvent | React.TouchEvent) => void;
  onResizeReset?: () => void;
  topOffset?: number;
}

export default function ChatPanel({ panelWidth, isDragging, onResizeStart, onResizeReset, topOffset = 0 }: ChatPanelProps) {
  const {
    messages,
    isOpen,
    isLoading,
    hasAcceptedDisclaimer,
    error,
    piiWarning,
    closePanel,
    acceptDisclaimer,
    sendMessage,
    sendDocumentMessage,
    markActionsApplied,
    markActionsDismissed,
    setMessageFeedback,
    regenerateLastResponse,
    editAndResend,
    retryMessage,
    clearHistory,
    clearError,
    abortMessage,
  } = useChatStore();

  const mode = useAISettingsStore((s) => s.mode);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrivacyLog, setShowPrivacyLog] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Check if user is scrolled near the bottom
  const checkScrollPosition = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distanceFromBottom > 100);
  }, []);

  // Auto-scroll to bottom when new messages arrive (only if already near bottom)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Auto-scroll if user is near the bottom (within 150px) or it's a new loading state
    if (distanceFromBottom < 150 || isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Scroll to most recent message when chat panel opens
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      // Use requestAnimationFrame to ensure the panel has rendered
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      });
    }
  }, [isOpen]);

  // Escape key: abort in-flight request → close settings (panel closed via X or sparkle button only)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isLoading) {
          abortMessage();
        } else if (showSettings) {
          setShowSettings(false);
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, showSettings, abortMessage]);

  // Reset settings view when panel closes
  useEffect(() => {
    if (!isOpen) { setShowSettings(false); setShowPrivacyLog(false); }
  }, [isOpen]);

  // Contextual starter prompts based on current step or tool view + active nudges
  const activeToolId = useTaxReturnStore((s) => s.activeToolId);
  const currentStep = useTaxReturnStore((s) => s.getCurrentStep());
  const stepId = activeToolId || currentStep?.id || 'unknown';
  const section = activeToolId ? 'tools' : (currentStep?.section || 'unknown');
  const { stepNudges } = useNudges();
  const nudgePrompts: NudgePrompt[] = stepNudges.map((n) => ({
    prompt: n.chatPrompt,
    benefitLabel: n.estimatedBenefit ? `~$${n.estimatedBenefit.toLocaleString()}` : undefined,
  }));
  const starterPrompts = getStarterPrompts(stepId, section, nudgePrompts);

  // Identify the last assistant message (for regenerate button)
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const modeInfo = MODE_LABELS[mode] || MODE_LABELS.private;

  return (
    <>
      {/* Backdrop overlay (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={closePanel}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        data-testid="chat-panel"
        aria-hidden={!isOpen}
        style={{
          ...(panelWidth ? { width: panelWidth } : undefined),
        }}
        className={`fixed right-0 top-0 h-full w-full ${!panelWidth ? 'sm:w-96' : ''} z-40
                    bg-surface-800 border-l border-slate-700 shadow-2xl
                    flex flex-col
                    ${!isDragging ? 'transition-transform duration-300 ease-in-out' : ''}
                    ${isOpen ? 'translate-x-0' : 'translate-x-full invisible'}`}
      >
        {/* Resize handle on left edge — desktop only */}
        {onResizeStart && (
          <div className="absolute left-0 top-0 bottom-0 -translate-x-1/2 z-50">
            <ResizeHandle
              isDragging={isDragging ?? false}
              onMouseDown={onResizeStart}
              onDoubleClick={onResizeReset ?? (() => {})}
            />
          </div>
        )}
        {/* Show settings panel, privacy log, or chat */}
        {showPrivacyLog ? (
          <PrivacyAuditPanel onBack={() => setShowPrivacyLog(false)} />
        ) : showSettings ? (
          <AISettingsPanel
            onBack={() => setShowSettings(false)}
            onOpenPrivacyLog={() => { setShowSettings(false); setShowPrivacyLog(true); }}
          />
        ) : (
          <>
            {/* ─── Header ─────────────────────────────── */}
            <div
              className="flex items-center justify-between px-4 border-b border-slate-700 bg-surface-800"
              style={topOffset ? { height: topOffset } : { padding: '0.5rem 1rem' }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-telos-orange-400" />
                <h2 className="text-sm font-semibold">
                  <span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">AI</span> <span className="text-slate-300">Assistant</span>
                </h2>
                {/* Mode indicator — clickable tag to open settings */}
                <button
                  onClick={() => setShowSettings(true)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${modeInfo.color} ${modeInfo.bg} ${modeInfo.border} hover:brightness-125 transition-all cursor-pointer`}
                  title="Change AI mode"
                >
                  {modeInfo.label} ▾
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-300 hover:bg-surface-700
                             transition-colors"
                  aria-label="AI Settings"
                  title="AI Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {messages.length > 0 && hasAcceptedDisclaimer && (
                  <button
                    onClick={clearHistory}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-300 hover:bg-surface-700
                               transition-colors"
                    aria-label="Clear chat history"
                    title="Clear history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={closePanel}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-300 hover:bg-surface-700
                             transition-colors"
                  aria-label="Close chat panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ─── Content ────────────────────────────── */}
            {!hasAcceptedDisclaimer ? (
              <PrivacyDisclaimer onAccept={acceptDisclaimer} />
            ) : mode === 'private' ? (
              <PrivateModePanel onOpenSettings={() => setShowSettings(true)} />
            ) : (
              <>
                {/* Messages area */}
                <div
                  ref={scrollContainerRef}
                  onScroll={checkScrollPosition}
                  className="flex-1 overflow-y-auto px-4 py-4 relative"
                >
                  {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <p className="text-sm text-slate-400 mb-4">
                        How can I help with your taxes?
                      </p>
                      <div className="space-y-2 w-full max-w-[85%]">
                        {starterPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            onClick={() => sendMessage(prompt)}
                            className="w-full text-left text-xs px-3 py-2.5 rounded-lg
                                       bg-surface-700 border border-slate-600/50
                                       text-slate-400 hover:text-white hover:border-telos-blue-500/50
                                       transition-all duration-150"
                          >
                            &ldquo;{prompt}&rdquo;
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg) => (
                    <ChatMessage
                      key={msg.id}
                      message={msg}
                      isLastAssistant={msg.id === lastAssistantId}
                      onActionsApplied={markActionsApplied}
                      onActionsDismissed={markActionsDismissed}
                      onFeedback={setMessageFeedback}
                      onRegenerate={regenerateLastResponse}
                      onFollowUp={sendMessage}
                      onEditAndResend={editAndResend}
                      onRetry={retryMessage}
                    />
                  ))}

                  {/* Thinking indicator — contextual reasoning steps */}
                  {isLoading && (
                    <ThinkingIndicator
                      userMessage={messages.filter((m) => m.role === 'user').pop()?.content}
                      section={section}
                    />
                  )}

                  {/* Error display */}
                  {error && (
                    <div className="flex justify-start mb-3">
                      <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 bg-red-500/10 border border-red-500/30">
                        <p className="text-xs text-red-400">{error}</p>
                        <button
                          onClick={clearError}
                          className="text-[10px] text-red-400/60 hover:text-red-400 mt-1 underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Scroll to bottom button */}
                {showScrollDown && (
                  <div className="flex justify-center -mt-5 mb-1 relative z-10">
                    <button
                      onClick={scrollToBottom}
                      className="flex items-center justify-center w-8 h-8 rounded-full
                                 bg-surface-700 border border-slate-600/50 text-slate-400
                                 hover:text-white hover:bg-surface-600 hover:border-slate-500
                                 transition-all shadow-lg"
                      aria-label="Scroll to latest message"
                      title="Scroll to bottom"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* PII Warning (shown above input when PII detected) */}
                {piiWarning && <PIIWarning warning={piiWarning} />}

                {/* Input (includes model picker in toolbar) */}
                <ChatInput
                  onSend={sendMessage}
                  onAttachFile={sendDocumentMessage}
                  disabled={isLoading}
                  isLoading={isLoading}
                  onStop={abortMessage}
                />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── Private Mode Panel ────────────────────────────

function PrivateModePanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-6">
      <div className="flex flex-col items-center text-center">
        {/* Hero */}
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
          <Shield className="w-7 h-7 text-emerald-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-200 mb-2">Private Mode</h3>
        <p className="text-sm text-slate-400 mb-6 max-w-xs">
          Your data never leaves this device. All core features work without any AI provider.
        </p>

        {/* What works */}
        <div className="w-full text-left mb-6">
          <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
            What works in Private Mode
          </h4>
          <div className="space-y-2">
            {[
              'Full tax engine (all forms & schedules)',
              'Smart suggestions & proactive nudges',
              'Audit risk assessment',
              'Document import (PDF & photo OCR)',
              'Scenario Lab & what-if analysis',
              'Explain My Taxes (charts & traces)',
              'Keyboard shortcuts & command palette',
            ].map((feature) => (
              <div key={feature} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-xs text-slate-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade CTA */}
        <div className="w-full rounded-lg border border-telos-blue-500/30 bg-telos-blue-500/5 p-4">
          <div className="flex items-start gap-2.5">
            <Key className="w-4 h-4 text-telos-blue-400 mt-0.5 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-telos-blue-300 mb-1">
                Unlock AI chat
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Add your own API key to get conversational AI assistance,
                voice data entry, AI-powered expense scanning, and more.
              </p>
              <button
                onClick={onOpenSettings}
                className="text-xs font-medium text-telos-blue-400 hover:text-telos-blue-300
                           bg-telos-blue-500/10 hover:bg-telos-blue-500/20
                           border border-telos-blue-500/30 px-3 py-1.5 rounded transition-colors"
              >
                Set up BYOK
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
