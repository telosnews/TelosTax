import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import LearnMoreModal from './LearnMoreModal';

interface ContextualHelpLinkProps {
  /** The clickable link text, e.g. "What's my filing status?" */
  label: string;
  /** Title shown in the modal header. */
  modalTitle: string;
  /** Explanation text shown in the modal body. */
  modalExplanation: string;
  /** Optional IRS.gov URL for a "View on IRS.gov" link. */
  irsUrl?: string;
  /** Optional className override for the wrapper. */
  className?: string;
}

export default function ContextualHelpLink({
  label,
  modalTitle,
  modalExplanation,
  irsUrl,
  className = '',
}: ContextualHelpLinkProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-sm text-telos-blue-400 hover:text-telos-blue-300 transition-colors group ${className}`}
      >
        <HelpCircle className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
        <span className="underline underline-offset-2 decoration-telos-blue-400/40 group-hover:decoration-telos-blue-300/60">
          {label}
        </span>
      </button>

      <LearnMoreModal
        open={open}
        onClose={() => setOpen(false)}
        title={modalTitle}
        explanation={modalExplanation}
        irsUrl={irsUrl}
      />
    </>
  );
}
