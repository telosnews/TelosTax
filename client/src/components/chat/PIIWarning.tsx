/**
 * PII Warning Banner — shown above the chat input when PII is detected.
 *
 * Displays what was detected and offers three options:
 *   1. Send the sanitized version (PII replaced with placeholders)
 *   2. Edit the message (dismiss warning, keep text in input)
 *   3. Cancel (dismiss warning, clear text)
 */

import { ShieldAlert } from 'lucide-react';
import { useChatStore, type PIIWarningState } from '../../store/chatStore';

interface Props {
  warning: PIIWarningState;
}

export default function PIIWarning({ warning }: Props) {
  const { sendSanitizedMessage, dismissPIIWarning } = useChatStore();

  return (
    <div className="mx-3 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <div className="flex items-start gap-2 mb-2">
        <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-amber-300">
            Sensitive information detected
          </p>
          <p className="text-[11px] text-amber-400/80 mt-1">
            Your message appears to contain personal information that will be
            removed before sending to the AI provider:
          </p>
        </div>
      </div>

      {/* What was detected */}
      <ul className="ml-6 mb-3 space-y-0.5">
        {warning.warnings.map((w, i) => (
          <li key={i} className="text-[11px] text-amber-400/70 flex items-start gap-1.5">
            <span className="text-amber-500 mt-px">&#x2022;</span>
            {w}
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-6">
        <button
          onClick={sendSanitizedMessage}
          className="text-[11px] px-3 py-1.5 rounded-md bg-telos-orange-600 hover:bg-telos-orange-500
                     text-white font-medium transition-colors"
        >
          Send without PII
        </button>
        <button
          onClick={dismissPIIWarning}
          className="text-[11px] px-3 py-1.5 rounded-md bg-surface-700 hover:bg-surface-600
                     text-slate-300 transition-colors"
        >
          Edit message
        </button>
      </div>
    </div>
  );
}
