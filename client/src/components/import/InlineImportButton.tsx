/**
 * InlineImportButton — a contextual "Import from PDF/CSV" trigger
 * shown on individual tax form steps.
 *
 * Renders a subtle but visible button that, when clicked, expands
 * an inline import panel directly on the step page. This keeps users
 * in context rather than navigating to the separate Import Data step.
 */

import { FileInput, FileText, FileSpreadsheet } from 'lucide-react';

interface InlineImportButtonProps {
  /** 'pdf' for W-2 / 1099 forms, 'csv' for 1099-B / 1099-DA */
  importType: 'pdf' | 'csv';
  /** Human-readable form name, e.g. "W-2" or "1099-B" */
  formLabel: string;
  onClick: () => void;
}

export default function InlineImportButton({ importType, formLabel, onClick }: InlineImportButtonProps) {
  const Icon = importType === 'pdf' ? FileText : FileSpreadsheet;

  // On mobile (touch-primary), mention photo since camera capture is available.
  // On desktop, just say "PDF" since photo capture opens a file picker anyway.
  const isTouchDevice = typeof window !== 'undefined'
    && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const label = importType === 'pdf'
    ? `Import ${formLabel} from PDF${isTouchDevice ? ' or photo' : ''}`
    : `Import ${formLabel} from CSV`;

  return (
    <button
      onClick={onClick}
      className="mt-2 mb-4 w-full flex items-center justify-center gap-2 py-2.5 px-4
                 border border-dashed border-telos-blue-500/40 rounded-lg
                 bg-telos-blue-500/5 hover:bg-telos-blue-500/10
                 hover:border-telos-blue-400/60
                 text-telos-blue-400 hover:text-telos-blue-300
                 transition-all text-sm font-medium group"
    >
      <FileInput className="w-4 h-4 group-hover:scale-110 transition-transform" />
      <span>{label}</span>
      <Icon className="w-3.5 h-3.5 text-telos-blue-400/60" />
    </button>
  );
}
