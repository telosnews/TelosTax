import { useState, useEffect, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaxReturnStore, SECTIONS } from '../../store/taxReturnStore';
import {
  Check, ChevronRight, ChevronDown, Circle, User, DollarSign, Briefcase, Scissors, Award,
  MapPin, ClipboardCheck, Download, LucideIcon, BookOpen, AlertCircle, Trash2, Wrench,
} from 'lucide-react';
import ResourcesPanel from './ResourcesPanel';
import { SIDEBAR_TOOLS, hasMinimumIncomeData } from '../../data/sidebarTools';
import { deleteReturn } from '../../api/client';
import { flushAutoSave } from '../../store/taxReturnStore';
import { toast } from 'sonner';
import { useWarningsByStepId } from '../../hooks/useWarnings';
import type { ValidationWarning } from '../../services/warningService';

const SECTION_ICONS: Record<string, LucideIcon> = {
  User, DollarSign, Briefcase, Scissors, Award, MapPin, ClipboardCheck, Download,
};

// ── Warning Popover ──────────────────────────────────────────────
// Shows warning messages on hover over the AlertCircle icons.
// Positions itself above the icon; if that would overflow the top
// of the sidebar, it flips below.

function WarningPopover({ warnings, children }: { warnings: ValidationWarning[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [above, setAbove] = useState(true);

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    // Flip below if there's not enough room above (popover ~120px tall)
    setAbove(rect.top > 140);
  }, [open]);

  return (
    <span
      ref={anchorRef}
      className="relative shrink-0"
      tabIndex={0}
      role="button"
      aria-expanded={open}
      aria-label={`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen((prev) => !prev); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen((prev) => !prev); } }}
    >
      {children}
      {open && warnings.length > 0 && (
        <div
          ref={popRef}
          className={`fixed z-50 w-64 p-2.5 text-xs bg-surface-700 border border-slate-600 rounded-lg shadow-xl`}
          style={{
            left: anchorRef.current ? anchorRef.current.getBoundingClientRect().left + anchorRef.current.offsetWidth / 2 - 128 : 0,
            top: anchorRef.current
              ? above
                ? anchorRef.current.getBoundingClientRect().top - 8
                : anchorRef.current.getBoundingClientRect().bottom + 8
              : 0,
            transform: above ? 'translateY(-100%)' : undefined,
          }}
        >
          <div className="max-h-40 overflow-y-auto space-y-1.5">
            {warnings.slice(0, 5).map((w, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-slate-300 leading-snug">{w.message}</span>
              </div>
            ))}
            {warnings.length > 5 && (
              <div className="text-slate-400 text-center">+{warnings.length - 5} more</div>
            )}
          </div>
          {/* Arrow */}
          <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-surface-700 border-slate-600 rotate-45 ${
            above ? 'top-full -mt-1 border-b border-r' : 'bottom-full -mb-1 border-t border-l'
          }`} />
        </div>
      )}
    </span>
  );
}

interface StepSidebarProps {
  onStepClick?: () => void;
}

export default function StepSidebar({ onStepClick }: StepSidebarProps) {
  const { returnId, taxReturn, activeToolId, currentStepIndex, highestStepVisited, goToStep, getVisibleSteps, setActiveTool } = useTaxReturnStore();
  const navigate = useNavigate();
  const hasData = hasMinimumIncomeData(taxReturn);
  const visibleSteps = getVisibleSteps();
  const visibleStepIds = new Set(visibleSteps.map((s) => s.id));
  const currentStep = visibleSteps[currentStepIndex];
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const warningsByStepId = useWarningsByStepId();

  const handleDelete = () => {
    if (!returnId) return;
    flushAutoSave();
    deleteReturn(returnId);
    toast.success('All data has been permanently deleted.');
    navigate('/');
  };

  // Group visible steps by section
  const sectionSteps = SECTIONS.map((section) => ({
    ...section,
    steps: visibleSteps.filter((s) => s.section === section.id && !s.id.startsWith('transition_')),
  })).filter((s) => s.steps.length > 0);

  // Auto-expand the active section whenever the current step changes
  useEffect(() => {
    if (currentStep) {
      setExpandedSections((prev) => {
        const next = new Set(prev);
        next.add(currentStep.section);
        return next;
      });
    }
  }, [currentStep?.section]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const handleClick = (stepId: string) => {
    goToStep(stepId);
    onStepClick?.();
  };

  return (
    <>
      <aside role="navigation" aria-label="Tax return steps" className="w-full shrink-0 bg-surface-800 border-r border-slate-700 h-full flex flex-col">
        {/* About link */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => navigate('/pledge')}
            className="w-full px-3 py-2 text-xs font-bold tracking-wider text-telos-orange-400 hover:text-telos-orange-300
                       border border-telos-orange-500/30 hover:border-telos-orange-500/50 bg-telos-orange-500/5 hover:bg-telos-orange-500/10
                       rounded-lg transition-colors text-center uppercase"
          >
            Learn more about this project
          </button>
        </div>

        {/* Scrollable step list */}
        <div className="flex-1 overflow-y-auto py-4">
          {sectionSteps.map((section, sectionIdx) => {
            const sectionStepIndices = section.steps.map((s) => visibleSteps.indexOf(s));
            const isSectionActive = section.steps.some((s) => s.id === currentStep?.id);
            const isSectionComplete = sectionStepIndices.every((i) => i < currentStepIndex);
            const isExpanded = expandedSections.has(section.id);
            const completedCount = sectionStepIndices.filter((i) => i < currentStepIndex).length;
            const Icon = SECTION_ICONS[section.icon];
            const sectionWarnings = section.steps.flatMap((s) => warningsByStepId.get(s.id)?.warnings ?? []);

            return (
              <div key={section.id} className={sectionIdx > 0 ? 'mt-1 pt-1 border-t border-slate-700/60' : ''}>
                {/* Section Header — clickable to collapse/expand */}
                <button
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`section-${section.id}`}
                  className={`w-full px-4 py-2.5 flex items-center justify-between text-left transition-colors cursor-pointer bg-surface-700/30 hover:bg-surface-700/60 focus-visible:ring-2 focus-visible:ring-telos-blue-500 focus-visible:ring-inset focus-visible:outline-none ${
                    isSectionActive
                      ? 'text-telos-blue-400'
                      : isSectionComplete
                        ? 'text-telos-orange-500'
                        : 'text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSectionComplete
                      ? <Check className="w-3.5 h-3.5 shrink-0" />
                      : Icon ? <Icon className="w-3.5 h-3.5 shrink-0" /> : null
                    }
                    <span className="text-[11px] font-bold uppercase tracking-wider">{section.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {sectionWarnings.length > 0 && (
                      <WarningPopover warnings={sectionWarnings}>
                        <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                      </WarningPopover>
                    )}
                    {!isSectionComplete && completedCount > 0 && (
                      <span className="text-xs text-slate-400 font-medium">{completedCount}/{section.steps.length}</span>
                    )}
                    {isExpanded
                      ? <ChevronDown className="w-3 h-3 text-slate-600" />
                      : <ChevronRight className="w-3 h-3 text-slate-600" />
                    }
                  </div>
                </button>

                {/* Steps — collapsible */}
                {isExpanded && <div id={`section-${section.id}`}>{section.steps.map((step) => {
                  const stepIndex = visibleSteps.indexOf(step);
                  const isActive = step.id === currentStep?.id;
                  const isPast = stepIndex < currentStepIndex;
                  const isUnreached = stepIndex > highestStepVisited && !isActive;

                  return (
                    <button
                      key={step.id}
                      onClick={() => handleClick(step.id)}
                      aria-current={isActive ? 'step' : undefined}
                      className={`
                        w-full text-left pl-9 pr-4 py-1.5 text-sm flex items-center gap-2
                        transition-colors duration-150 border-l-2 cursor-pointer
                        focus-visible:ring-2 focus-visible:ring-telos-blue-500 focus-visible:ring-inset focus-visible:outline-none
                        ${isActive
                          ? 'text-white bg-telos-blue-600/20 border-telos-blue-400'
                          : isPast
                            ? 'text-slate-400 hover:text-slate-200 hover:bg-surface-700 border-transparent'
                            : isUnreached
                              ? 'text-slate-600 hover:text-slate-400 hover:bg-surface-700 border-transparent border-l-slate-700/40 border-dashed'
                              : 'text-slate-400 hover:text-slate-300 hover:bg-surface-700 border-transparent'
                        }
                      `}
                    >
                      {isPast && <Check className="w-3 h-3 text-telos-orange-500 shrink-0" />}
                      {isActive && <Circle className="w-2 h-2 text-telos-blue-400 fill-telos-blue-400 shrink-0" />}
                      <span className={`truncate ${isUnreached ? 'opacity-60' : ''}`}>{step.label}</span>
                      {warningsByStepId.has(step.id) && (
                        <WarningPopover warnings={warningsByStepId.get(step.id)!.warnings}>
                          <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 ml-auto" />
                        </WarningPopover>
                      )}
                    </button>
                  );
                })}</div>}
              </div>
            );
          })}

          {/* ── Tools Section ── */}
          <div className="mt-3 pt-3 border-t-2 border-slate-600/60">
            <div className="px-4 py-2.5 flex items-center justify-between bg-surface-700/50 rounded-sm mx-1">
              <div className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-telos-blue-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tools</span>
              </div>
              <span className="text-[10px] text-slate-400">Use anytime</span>
            </div>
            {SIDEBAR_TOOLS.map((tool) => {
              // Disable if needs data and none entered, OR if it's a navigate tool
              // whose target step isn't currently visible (e.g., charitable_deduction
              // requires itemized + charitable discovery enabled).
              const isDisabled = (tool.needsData && !hasData) ||
                (tool.type === 'navigate' && tool.stepId && !visibleStepIds.has(tool.stepId));
              const isActive = activeToolId === tool.id;
              const Icon = tool.icon;

              return (
                <div key={tool.id} className="relative group">
                  <button
                    onClick={() => {
                      if (isDisabled) return;
                      if (tool.type === 'navigate' && tool.stepId) {
                        goToStep(tool.stepId);
                      } else {
                        setActiveTool(tool.id);
                      }
                      onStepClick?.();
                    }}
                    className={`
                      w-full text-left pl-9 pr-4 py-1.5 text-sm flex items-center gap-2
                      transition-colors duration-150 border-l-2
                      focus-visible:ring-2 focus-visible:ring-telos-blue-500 focus-visible:ring-inset focus-visible:outline-none
                      ${isDisabled
                        ? 'text-slate-600 border-transparent cursor-not-allowed'
                        : isActive
                          ? 'text-white bg-telos-blue-600/20 border-telos-blue-400 cursor-pointer'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-surface-700 border-transparent cursor-pointer'
                      }
                    `}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isDisabled ? 'opacity-40' : isActive ? 'text-telos-blue-400' : ''}`} />
                    <span className={isDisabled ? 'opacity-40' : ''}>{tool.label}</span>
                  </button>
                  {/* Tooltip for disabled tools */}
                  {isDisabled && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block z-50 whitespace-nowrap px-2.5 py-1.5 text-xs bg-surface-700 border border-slate-600 rounded-lg shadow-xl text-slate-300">
                      {tool.type === 'navigate' && tool.stepId && !visibleStepIds.has(tool.stepId)
                        ? 'Enable this section in the wizard first'
                        : 'Enter some income data first'}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 mr-0 w-0 h-0 border-y-4 border-y-transparent border-r-4 border-r-slate-600" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom actions - pinned */}
        <div className="shrink-0 border-t border-slate-700 p-3 space-y-2">
          <button
            onClick={() => setResourcesOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-surface-700 rounded-lg transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Resources
          </button>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete my data
            </button>
          ) : (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 mt-1">
              <p className="text-xs text-red-300 font-medium mb-1">Delete everything?</p>
              <p className="text-[11px] text-slate-400 mb-2">This permanently deletes your entire return.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="px-2.5 py-1 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Resources panel */}
      <ResourcesPanel open={resourcesOpen} onClose={() => setResourcesOpen(false)} />
    </>
  );
}
