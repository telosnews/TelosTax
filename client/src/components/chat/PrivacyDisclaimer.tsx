/**
 * Privacy Disclaimer — shown on first chat open.
 *
 * Mode-aware: shows different privacy information based on the active AI mode.
 *   - Private: minimal disclaimer (data stays local)
 *   - BYOK: explains server proxy + user's Anthropic API key
 */

import { Lock, Key, ExternalLink } from 'lucide-react';
import { useAISettingsStore } from '../../store/aiSettingsStore';

interface Props {
  onAccept: () => void;
}

export default function PrivacyDisclaimer({ onAccept }: Props) {
  const mode = useAISettingsStore((s) => s.mode);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      <div className="max-w-sm text-center">
        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-telos-blue-600/20">
          {mode === 'private' ? (
            <Lock className="w-7 h-7 text-emerald-400" />
          ) : (
            <Key className="w-7 h-7 text-telos-blue-400" />
          )}
        </div>

        <h3 className="text-lg font-semibold text-slate-100 mb-3">
          {mode === 'private'
            ? 'Private AI — Your Data Stays Here'
            : 'Your API Key — Your Rules'}
        </h3>

        <div className="space-y-3 text-sm text-slate-400 text-left mb-6">
          {mode === 'private' && <PrivateDisclaimer />}
          {mode === 'byok' && <BYOKDisclaimer />}

          {/* Common to all modes */}
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5 text-xs">&#x2713;</span>
              <span>
                <strong className="text-slate-300">AI doesn&apos;t do your tax calculations</strong>{' '}
                — AI suggests data entries, but all tax math uses our IRS-based engine.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5 text-xs">&#x2713;</span>
              <span>
                <strong className="text-slate-300">You confirm all actions</strong> — The
                AI proposes changes that you review and approve before anything is
                applied.
              </span>
            </li>
          </ul>
        </div>

        <button onClick={onAccept} className="btn-primary w-full">
          I Understand
        </button>
      </div>
    </div>
  );
}

function PrivateDisclaimer() {
  return (
    <>
      <p>
        Private Mode keeps all your data on your device. The full tax engine,
        smart suggestions, Smart Expense Scanner, and document import work without
        any network calls.
      </p>
      <ul className="space-y-2">
        <li className="flex items-start gap-2">
          <span className="text-emerald-400 mt-0.5 text-xs">&#x2713;</span>
          <span>
            <strong className="text-slate-300">100% local</strong> — Your tax data
            never leaves your device. No server, no API, no exceptions.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-400 mt-0.5 text-xs">&#x2713;</span>
          <span>
            <strong className="text-slate-300">AI chat requires BYOK</strong> — Add
            your Anthropic API key to unlock conversational AI features.
          </span>
        </li>
      </ul>
    </>
  );
}

function BYOKDisclaimer() {
  return (
    <>
      <p>
        BYOK Mode uses your own Anthropic API key. Messages pass through
        our server as a relay — we don&apos;t store, log, or read your messages.
      </p>
      <ul className="space-y-2">
        <li className="flex items-start gap-2">
          <span className="text-emerald-400 mt-0.5 text-xs">&#x2713;</span>
          <span>
            <strong className="text-slate-300">PII is blocked client-side</strong> — SSNs,
            EINs, emails, and addresses are detected and removed before your message
            leaves your browser.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-400 mt-0.5 text-xs">&#x2713;</span>
          <span>
            <strong className="text-slate-300">Your key, your account</strong> — Messages
            are processed under Anthropic&apos;s privacy policy, billed to your account.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-400 mt-0.5 text-xs">&#x2713;</span>
          <span>
            <strong className="text-slate-300">Data stays local</strong> — Your
            tax return lives in your browser. The AI receives only your message text
            plus approximate financial context — never exact amounts or names.
          </span>
        </li>
      </ul>
      <p className="text-xs text-slate-400">
        Messages are processed by Anthropic.{' '}
        <a
          href="https://www.anthropic.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-telos-blue-400 hover:text-telos-blue-300 inline-flex items-center gap-1"
        >
          Privacy policy <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </>
  );
}
