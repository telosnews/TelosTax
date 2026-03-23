import { useState, useRef, useEffect, useId } from 'react';
import { HelpCircle, ExternalLink } from 'lucide-react';

export interface TooltipContent {
  title?: string;
  body: string;
  irsRef?: string;
  irsUrl?: string;
}

interface InfoTooltipProps {
  text: string | TooltipContent;
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const isStructured = typeof text === 'object';

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={tooltipId}
        aria-label="More info"
        className="text-slate-400 hover:text-slate-300 transition-colors p-0.5"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div id={tooltipId} role="tooltip" className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-surface-700 border border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {isStructured ? (
            <>
              {text.title && (
                <div className="font-medium text-slate-100 mb-1">{text.title}</div>
              )}
              <div className="text-slate-300 leading-relaxed">{text.body}</div>
              {text.irsRef && (
                <div className="mt-2 pt-2 border-t border-slate-600 text-slate-400">
                  {text.irsUrl ? (
                    <a
                      href={text.irsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" />
                      IRS: {text.irsRef}
                    </a>
                  ) : (
                    <span>IRS: {text.irsRef}</span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-slate-200">{text}</div>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-surface-700 border-b border-r border-slate-600 rotate-45" />
        </div>
      )}
    </div>
  );
}
