import { useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface LearnMoreModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  explanation: string;
  irsUrl?: string;
}

export default function LearnMoreModal({
  open,
  onClose,
  title,
  explanation,
  irsUrl,
}: LearnMoreModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-surface-800 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white pr-4">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 -m-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{explanation}</div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center gap-3">
          {irsUrl && (
            <a
              href={irsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on IRS.gov
            </a>
          )}
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm font-medium bg-surface-900 text-slate-300 rounded-lg hover:bg-surface-700 border border-slate-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
