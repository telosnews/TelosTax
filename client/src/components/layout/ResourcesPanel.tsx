import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import * as icons from 'lucide-react';
import { TAX_RESOURCES, ResourceCategory } from '../../data/taxResources';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ResourcesPanelProps {
  open: boolean;
  onClose: () => void;
}

function getIcon(name: string) {
  const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[name];
  return Icon || BookOpen;
}

export default function ResourcesPanel({ open, onClose }: ResourcesPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['irs_essentials']));

  useFocusTrap(panelRef, open, onClose);

  // Focus close button when panel opens
  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  const toggleCategory = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-30"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tax Resources"
        className="fixed left-0 top-0 bottom-0 w-full sm:w-96 bg-surface-800 border-r border-slate-700 z-40 overflow-y-auto shadow-2xl animate-in slide-in-from-left duration-200 lg:left-[var(--sidebar-width,256px)]"
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-telos-blue-400" />
            <h2 className="font-semibold text-white">Tax Resources</h2>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close resources panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="px-4 py-3 text-xs text-slate-400 border-b border-slate-700/50">
          Curated links to official IRS tools, publications, and free tax help resources.
        </p>

        {/* Categories */}
        <div className="py-2">
          {TAX_RESOURCES.map((category: ResourceCategory) => {
            const CategoryIcon = getIcon(category.icon);
            const isOpen = expanded.has(category.id);

            return (
              <div key={category.id}>
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-700 transition-colors"
                >
                  {isOpen
                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  }
                  <CategoryIcon className="w-4 h-4 text-telos-blue-400" />
                  <span className="text-sm font-medium text-slate-200">{category.label}</span>
                  <span className="ml-auto text-xs text-slate-600">{category.resources.length}</span>
                </button>

                {/* Resources */}
                {isOpen && (
                  <div className="pb-1">
                    {category.resources.map((resource) => {
                      const ResourceIcon = getIcon(resource.icon);

                      return (
                        <a
                          key={resource.url}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2.5 px-4 pl-11 py-2 hover:bg-surface-700 transition-colors group"
                        >
                          <ResourceIcon className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0 group-hover:text-telos-blue-400 transition-colors" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-300 group-hover:text-white transition-colors flex items-center gap-1">
                              <span className="truncate">{resource.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-telos-blue-400" />
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                              {resource.description}
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
