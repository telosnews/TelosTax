import { ReactNode, useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import StepSidebar from './StepSidebar';
import ProgressBar from './ProgressBar';
import SaveIndicator from '../common/SaveIndicator';
import ResizeHandle from '../common/ResizeHandle';
import TelosAIButton from '../common/TelosAIButton';
import FormsSkeleton from '../formsMode/FormsSkeleton';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { useChatStore } from '../../store/chatStore';
import { useLiveCalculation } from '../../hooks/useLiveCalculation';
import { useResizePanel } from '../../hooks/useResizePanel';
import { Menu, X, Info, Calculator, ChevronDown, ChevronUp, Search, FileText, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatPercent } from '../../utils/format';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useCommandPalette } from '../../hooks/useCommandPalette';
import { useContextExplainer } from '../../hooks/useContextExplainer';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import StepNudgesBanner from '../common/StepNudgesBanner';
import KeyboardShortcutsModal from '../common/KeyboardShortcutsModal';

const LazyFormSidebar = lazy(() => import('../formsMode/FormSidebar'));
const LazyFormsViewer = lazy(() => import('../formsMode/FormsMode'));
const LazyExplainTaxesPanel = lazy(() => import('./ExplainTaxesPanel'));
const LazyCommandPalette = lazy(() => import('../common/CommandPalette'));
const LazyChatPanel = lazy(() => import('../chat/ChatPanel'));

interface WizardLayoutProps {
  children: ReactNode;
}

export default function WizardLayout({ children }: WizardLayoutProps) {
  const { saveState, jumpAheadWarning, dismissJumpWarning, getCurrentStep, activeToolId, calculation, viewMode, setViewMode } = useTaxReturnStore();
  const currentStep = getCurrentStep();
  const isTransitionStep = currentStep?.id.startsWith('transition_') ?? false;
  const { isAvailable: chatAvailable, isOpen: chatOpen, checkAvailability } = useChatStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isOpen: paletteOpen, open: openPalette, close: closePalette } = useCommandPalette();
  useLiveCalculation();
  const [explainOpen, setExplainOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const contextExplainerPortal = useContextExplainer(mainRef);
  const { helpOpen, closeHelp } = useKeyboardShortcuts();

  // Resizable panels
  const {
    width: sidebarWidth,
    isDragging: sidebarDragging,
    startResize: startSidebarResize,
    resetWidth: resetSidebarWidth,
  } = useResizePanel({
    storageKey: 'sidebar',
    defaultWidth: 256,
    minWidth: 180,
    maxWidth: 400,
    side: 'left',
  });

  const {
    width: chatWidth,
    isDragging: chatDragging,
    startResize: startChatResize,
    resetWidth: resetChatWidth,
  } = useResizePanel({
    storageKey: 'chat',
    defaultWidth: 384,
    minWidth: 320,
    maxWidth: 600,
    side: 'right',
  });

  // Scroll main content to top when step changes
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [currentStep?.id]);

  // Focus trap + body scroll lock for mobile sidebar
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  useFocusTrap(sidebarRef, sidebarOpen, closeSidebar);

  // Move focus into sidebar when it opens on mobile
  useEffect(() => {
    if (sidebarOpen && sidebarRef.current) {
      const first = sidebarRef.current.querySelector<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])');
      first?.focus();
    }
  }, [sidebarOpen]);

  const handleExplainToggle = () => setExplainOpen((prev) => !prev);

  // Check if chat feature is available on mount
  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Measure header height so the chat panel can be offset below it
  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, []);

  return (
    <div
      className="h-screen flex flex-col"
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-telos-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      {/* Top bar — logo, estimate, explain toggle, save */}
      <header ref={headerRef} className="bg-surface-800 border-b border-slate-700 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 gap-6">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-1 text-slate-400 hover:text-white transition-colors shrink-0"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
          >
            <span className="font-bold text-xl sm:hidden"><span className="text-telos-orange-400">T</span><span className="text-telos-blue-400">T</span></span>
            <span className="font-bold text-xl hidden sm:inline"><span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">Tax</span></span>
          </button>
          <span className="text-slate-400 hidden sm:inline shrink-0">2025 Tax Year</span>

          {/* Divider */}
          {calculation && <div className="hidden md:block w-px h-6 bg-slate-700 shrink-0" />}

          {/* Estimate info — inline */}
          {calculation && (() => {
            const f = calculation.form1040;
            const isRefund = f.refundAmount > 0;
            return (
              <>
                <div className="hidden md:flex items-center gap-2 shrink-0" aria-live="polite" aria-atomic="true">
                  <span className="text-slate-400">{isRefund ? 'Estimated Refund:' : 'Estimated Owed:'}</span>
                  <span className={`font-bold text-lg ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {formatCurrency(isRefund ? f.refundAmount : f.amountOwed)}
                  </span>
                </div>

                <div className="hidden lg:flex items-center gap-2 shrink-0">
                  <span className="text-slate-400">Effective Rate:</span>
                  <span className="text-slate-300 font-medium">{formatPercent(f.effectiveTaxRate)}</span>
                </div>
              </>
            );
          })()}

          {/* Explain my taxes toggle */}
          {calculation && (
            <button
              onClick={handleExplainToggle}
              aria-expanded={explainOpen}
              aria-controls="explain-taxes-panel"
              className="hidden sm:flex items-center gap-1.5 text-telos-blue-400 hover:text-telos-blue-300 transition-colors shrink-0"
            >
              <Calculator className="w-4 h-4" />
              <span className="font-medium">Explain my taxes</span>
              {explainOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Mobile explain trigger */}
          {calculation && (
            <button
              onClick={handleExplainToggle}
              aria-expanded={explainOpen}
              aria-controls="explain-taxes-panel"
              className="sm:hidden p-1.5 text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
              aria-label="Explain my taxes"
            >
              <Calculator className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={openPalette}
            aria-label="Search steps, forms, and tools"
            className="flex items-center gap-1.5 px-2 py-1 text-slate-400 hover:text-white bg-surface-700/50 hover:bg-surface-700 border border-slate-700 rounded-lg transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Search</span>
            <kbd className="hidden sm:inline text-[10px] text-slate-500 bg-surface-800 px-1 py-0.5 rounded font-mono ml-1">&thinsp;&#8984;K&thinsp;</kbd>
          </button>
          <SaveIndicator state={saveState} />
        </div>
      </header>

      {/* Explain my taxes expandable panel */}
      {explainOpen && (
        <Suspense fallback={null}>
          <LazyExplainTaxesPanel open={explainOpen} onClose={handleExplainToggle} />
        </Suspense>
      )}

      {/* Progress bar */}
      <ProgressBar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ── Left sidebar column (toggle + sidebar content) ── */}
        {sidebarOpen && (
          <div
            role="presentation"
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          ref={sidebarRef}
          style={{ width: sidebarWidth }}
          className={`
            shrink-0 h-full flex flex-col bg-surface-800 border-r border-slate-700
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
            transition-transform duration-200 fixed lg:static z-30 lg:z-auto
          `}
        >
          {/* Interview / Forms toggle */}
          {calculation && (
            <div className="px-3 pt-3 pb-2 border-b border-slate-700/60 shrink-0">
              <div className="flex items-center bg-surface-700/50 border border-slate-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('wizard')}
                  aria-pressed={viewMode === 'wizard'}
                  title="Step-by-step guided Q&A to enter your tax data"
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'wizard'
                      ? 'bg-telos-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Interview
                </button>
                <button
                  onClick={() => setViewMode('forms')}
                  aria-pressed={viewMode === 'forms'}
                  title="View and edit your return on the actual IRS forms"
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'forms'
                      ? 'bg-telos-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Forms
                </button>
              </div>
            </div>
          )}

          {/* Sidebar content — switches between step list and form list */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {viewMode === 'forms' ? (
              <Suspense fallback={null}>
                <LazyFormSidebar />
              </Suspense>
            ) : (
              <StepSidebar onStepClick={() => setSidebarOpen(false)} />
            )}
          </div>
        </div>

        {/* Sidebar resize handle — desktop only */}
        <ResizeHandle
          isDragging={sidebarDragging}
          onMouseDown={startSidebarResize}
          onDoubleClick={resetSidebarWidth}
        />

        {/* ── Main content ── */}
        {viewMode === 'forms' ? (
          <Suspense fallback={<FormsSkeleton />}>
            <div
              className={`flex-1 overflow-hidden ${!chatDragging ? 'transition-[margin] duration-300' : ''}`}
              style={{ marginRight: chatOpen && chatAvailable ? chatWidth : undefined }}
            >
              <LazyFormsViewer />
            </div>
          </Suspense>
        ) : (
          <main
            id="main-content"
            ref={mainRef}
            tabIndex={-1}
            className={`flex-1 overflow-y-auto focus:outline-none ${!chatDragging ? 'transition-[margin] duration-300' : ''}`}
            style={{ marginRight: chatOpen && chatAvailable ? chatWidth : undefined }}
          >
            <div className={`${activeToolId === 'tax_scenario_lab' ? 'max-w-5xl' : 'max-w-wizard'} mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-28 sm:pb-8`}>
              {/* Jump-ahead warning (non-blocking, informational) */}
              {jumpAheadWarning && !isTransitionStep && !activeToolId && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-300">
                      You haven&apos;t filled out earlier steps yet — some fields on this page may be empty.
                    </p>
                  </div>
                  <button
                    onClick={dismissJumpWarning}
                    className="text-xs text-amber-400/60 hover:text-amber-300 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {/* Proactive AI nudges — shown on data entry steps, not transitions or tools */}
              {!isTransitionStep && !activeToolId && <StepNudgesBanner />}
              {children}
            </div>
          </main>
        )}
      </div>

      {/* Command palette — conditionally mounted to avoid hooks running on every form keystroke */}
      {paletteOpen && (
        <Suspense fallback={null}>
          <LazyCommandPalette open={paletteOpen} onClose={closePalette} />
        </Suspense>
      )}

      {/* Floating Telos AI button */}
      {chatAvailable && <TelosAIButton />}

      {/* Chat panel overlay */}
      {chatAvailable && (
        <Suspense fallback={null}>
          <LazyChatPanel
            panelWidth={chatWidth}
            isDragging={chatDragging}
            onResizeStart={startChatResize}
            onResizeReset={resetChatWidth}
            topOffset={headerHeight}
          />
        </Suspense>
      )}
      {contextExplainerPortal}
      <KeyboardShortcutsModal open={helpOpen} onClose={closeHelp} />
    </div>
  );
}
