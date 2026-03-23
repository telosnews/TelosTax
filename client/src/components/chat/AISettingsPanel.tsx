/**
 * AI Settings Panel — mode selection and configuration for the AI assistant.
 *
 * Displays the two AI tiers with honest privacy explanations:
 *   - Private Mode (no data leaves device)
 *   - BYOK Mode (user's Anthropic API key, proxied through server)
 *
 * Each tier clearly explains what happens to the user's data.
 */

import { useState, useEffect } from 'react';
import {
  Lock,
  Key,
  ChevronLeft,
  ChevronDown,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  Shield,
} from 'lucide-react';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import type { AIMode } from '@telostax/engine';
import { getTipLinks } from '../../services/stripeService';

interface Props {
  onBack: () => void;
  onOpenPrivacyLog?: () => void;
}

export default function AISettingsPanel({ onBack, onOpenPrivacyLog }: Props) {
  const settings = useAISettingsStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(settings._decryptedApiKey);
  const [showBYOKInfo, setShowBYOKInfo] = useState(false);
  const [tipLinks, setTipLinks] = useState<{ small: string | null; medium: string | null; large: string | null }>({
    small: null, medium: null, large: null,
  });

  // Sync API key input when store changes
  useEffect(() => {
    setApiKeyInput(settings._decryptedApiKey || '');
  }, [settings._decryptedApiKey]);

  const handleModeChange = (mode: AIMode) => {
    settings.setMode(mode);
  };

  const handleSaveApiKey = () => {
    settings.setBYOKApiKey(apiKeyInput);
  };

  // ─── Fetch tip links ───────────────────────────
  useEffect(() => {
    getTipLinks().then(setTipLinks);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
        <button
          onClick={onBack}
          className="p-1 rounded-md text-slate-400 hover:text-slate-300 hover:bg-surface-700 transition-colors"
          aria-label="Back to chat"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-semibold text-slate-200">AI Settings</h2>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <p className="text-xs text-slate-400 mb-4">
          Choose how AI works. More capability requires more data sharing.
          You&apos;re always in control.
        </p>

        {/* ─── Private Mode ──────────────────────── */}
        <ModeCard
          mode="private"
          active={settings.mode === 'private'}
          onSelect={() => handleModeChange('private')}
          icon={<Lock className="w-4 h-4" />}
          title="Private Mode"
          badge="Free"
          badgeColor="text-emerald-400 bg-emerald-400/10"
          description="Full tax preparation with zero data leaving your device. All core features work — AI chat requires a BYOK API key."
          features={[
            'Complete tax engine (all forms & schedules)',
            'Smart suggestions & proactive nudges',
            'Audit risk assessment',
            'Document import (PDF & photo OCR)',
            'Scenario Lab & what-if analysis',
          ]}
          limitations={[
            'AI chat conversations',
            'AI-powered scanning and classification of tax-related expenses',
            'AI-enhanced document extraction',
            'Voice data entry via AI',
          ]}
          privacyNote="Your tax data lives in your browser's encrypted storage. Nothing is ever sent to any server."
        >
          {settings.mode === 'private' && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Want AI-powered features? Add your Anthropic API key with{' '}
                <button
                  onClick={(e) => { e.stopPropagation(); handleModeChange('byok'); }}
                  className="text-telos-blue-400 hover:text-telos-blue-300 font-medium transition-colors"
                >
                  BYOK mode
                </button>
                {' '}— your key, your account, your rules. Anthropic gives $5 in free credits on signup.
              </p>
            </div>
          )}
        </ModeCard>

        {/* ─── Tip Jar ──────────────────────────── */}
        <div className="rounded-lg border border-telos-orange-400 bg-telos-orange-500/5 p-3">
          <p className="text-xs text-white font-medium mb-1">Support TelosTax</p>
          <p className="text-[11px] text-slate-400 mb-2.5">
            Love the app? Leave a tip.
          </p>
          <div className="flex gap-2">
            {([
              { label: '$5', link: tipLinks.small },
              { label: '$10', link: tipLinks.medium },
              { label: '$25', link: tipLinks.large },
            ] as const).map(({ label, link }) => (
              <button
                key={label}
                onClick={() => link && window.open(link, '_blank', 'noopener,noreferrer')}
                disabled={!link}
                className="flex-1 text-[11px] px-2 py-1.5 rounded-md border border-telos-orange-400
                           text-telos-orange-300 hover:text-white hover:bg-telos-orange-600 hover:border-telos-orange-500
                           transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5 text-center">
            Powered by Stripe
          </p>
        </div>

        {/* ─── BYOK Mode ────────────────────────── */}
        <ModeCard
          mode="byok"
          active={settings.mode === 'byok'}
          onSelect={() => handleModeChange('byok')}
          icon={<Key className="w-4 h-4" />}
          title="Bring Your Own Key"
          badge="Free"
          badgeColor="text-telos-blue-400 bg-telos-blue-400/10"
          description="You provide your own Anthropic API key. Messages pass through our server (we can't read them) and go to Anthropic, billed to your account."
          features={[
            'Everything in Private Mode, plus:',
            'AI chat for tax questions & data entry',
            'AI-powered scanning and classification of tax-related expenses',
            'AI-enhanced document extraction',
            'Voice data entry via dictation',
          ]}
          limitations={[]}
          privacyNote="Our server relays your messages to Anthropic but does not store, log, or read them. We block SSNs and EINs before they leave your browser. Anthropic says API data is not used for training."
        >
          {settings.mode === 'byok' && (
            <div className="mt-3 pt-3 border-t border-slate-700 space-y-3">
              {/* API Key */}
              <div>
                <label className="text-[11px] text-slate-400 font-medium">Anthropic API Key</label>
                <div className="mt-1 flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full bg-surface-900 border border-slate-600 rounded-md px-2.5 py-1.5 pr-8
                                 text-xs text-white font-mono
                                 focus:outline-none focus:ring-2 focus:ring-telos-blue-500"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400"
                      aria-label={showApiKey ? 'Hide key' : 'Show key'}
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput || apiKeyInput === settings._decryptedApiKey}
                    className="px-3 py-1.5 rounded-md bg-telos-blue-600 hover:bg-telos-blue-500 text-white
                               text-[11px] font-medium transition-colors
                               disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Stored in your browser only. Never sent to our server for storage.
                </p>
              </div>

              {/* Model */}
              <div>
                <label className="text-[11px] text-slate-400 font-medium">Model</label>
                <select
                  value={settings.byokModel}
                  onChange={(e) => settings.setBYOKModel(e.target.value)}
                  className="mt-1 w-full bg-surface-900 border border-slate-600 rounded-md px-2.5 py-1.5
                             text-xs text-white focus:outline-none focus:ring-2 focus:ring-telos-blue-500"
                >
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fast, affordable)</option>
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (balanced)</option>
                  <option value="claude-opus-4-6">Claude Opus 4.6 (best quality)</option>
                </select>
              </div>

              {/* Where to get a key */}
              <div className="flex items-start gap-1.5 text-[10px] text-slate-500">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  Get an API key from{' '}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-telos-blue-400 hover:text-telos-blue-300 inline-flex items-center gap-0.5"
                  >
                    console.anthropic.com <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  . Anthropic gives $5 in free credits on signup. Typical cost: $0.01-0.10 per conversation.
                </span>
              </div>

              {/* ─── Learn More (expandable) ────────── */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowBYOKInfo(!showBYOKInfo); }}
                className="flex items-center gap-1.5 text-[11px] text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
              >
                <Key className="w-3 h-3" />
                <span>How BYOK works, what gets sent, and what it costs</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showBYOKInfo ? 'rotate-180' : ''}`} />
              </button>

              {showBYOKInfo && <BYOKExplainer />}
            </div>
          )}
        </ModeCard>

        {/* ─── Privacy Audit Log ──────────────────── */}
        {onOpenPrivacyLog && (
          <button
            onClick={onOpenPrivacyLog}
            className="w-full flex items-center gap-2.5 rounded-lg border border-slate-700 bg-surface-700/50 p-3 hover:border-emerald-500/30 transition-colors text-left"
          >
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-300 font-medium">Privacy Audit Log</p>
              <p className="text-[11px] text-slate-500">See every AI request that left your device</p>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-500 -rotate-90" />
          </button>
        )}

      </div>
    </div>
  );
}

// ─── Mode Card Component ────────────────────────────

interface ModeCardProps {
  mode: AIMode;
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  features: string[];
  limitations: string[];
  privacyNote: string;
  children?: React.ReactNode;
}

function ModeCard({
  active,
  onSelect,
  icon,
  title,
  badge,
  badgeColor,
  description,
  features,
  limitations,
  privacyNote,
  children,
}: ModeCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 transition-colors cursor-pointer ${
        active
          ? 'border-telos-blue-500/50 bg-telos-blue-500/5'
          : 'border-slate-700 hover:border-slate-600 bg-surface-700/30'
      }`}
      onClick={() => !active && onSelect()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`${active ? 'text-telos-blue-400' : 'text-slate-500'}`}>
            {icon}
          </div>
          <span className="text-xs font-semibold text-slate-200">{title}</span>
        </div>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeColor}`}>
          {badge}
        </span>
      </div>

      {/* Description */}
      <p className="text-[11px] text-slate-400 mb-2">{description}</p>

      {/* Features */}
      {features.length > 0 && (
        <div className="mb-1.5">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-slate-400">
              <span className="text-emerald-400 mt-px">&#x2713;</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      )}

      {/* Limitations */}
      {limitations.length > 0 && (
        <div className="mb-1.5">
          {limitations.map((l, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-slate-500">
              <span className="text-slate-600 mt-px">&#x2717;</span>
              <span>{l}</span>
            </div>
          ))}
        </div>
      )}

      {/* Privacy note (collapsible in non-active state) */}
      {active && (
        <div className="mt-2 pt-2 border-t border-slate-700/50">
          <p className="text-[10px] text-slate-500 italic leading-relaxed">
            {privacyNote}
          </p>
        </div>
      )}

      {/* Mode-specific config (only when active) */}
      {children}
    </div>
  );
}

// ─── BYOK Explainer ──────────────────────────────────

function BYOKExplainer() {
  return (
    <div className="rounded-md border border-slate-700/70 bg-surface-900/50 p-3 space-y-3 text-[11px] leading-relaxed text-slate-400">

      <Section title="What happens when you send a message">
        <div className="mt-1 space-y-1">
          <p>
            Your message goes through several steps, and we want you to know
            exactly what each one does:
          </p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>
              <span className="text-slate-400">Your browser scans the message for PII</span> —
              SSNs, phone numbers, street addresses, EINs, dates of birth. If anything
              is found, you&apos;re warned and given the choice to remove it or send
              anyway. This is the primary gate.
            </li>
            <li>
              <span className="text-slate-400">The message is sent to our server</span> — along
              with your API key (in the request body, not headers, so it doesn&apos;t
              appear in access logs). Our server runs a second PII scan as
              defense-in-depth.
            </li>
            <li>
              <span className="text-slate-400">Our server forwards it to Anthropic</span> — using
              their API with your key. We add a system prompt that tells the AI how
              to help with taxes. We also send non-PII context (which wizard step
              you&apos;re on, how many W-2s you&apos;ve entered, your filing status — but
              never names, SSNs, or addresses).
            </li>
            <li>
              <span className="text-slate-400">Anthropic processes it and responds</span> — our
              server passes the response back to your browser. That&apos;s it.
            </li>
          </ol>
        </div>
      </Section>

      <Section title="What our server does and doesn't do">
        <div className="mt-1 space-y-1">
          <p>
            Our server is a relay. It exists because your browser can&apos;t call
            the Anthropic API directly (CORS restrictions). Here&apos;s what it
            does and does not do:
          </p>
          <div className="space-y-0.5 ml-1">
            <div className="flex gap-1.5">
              <span className="text-emerald-500 shrink-0">&#x2713;</span>
              <span>Forwards your message to Anthropic and returns the response</span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-emerald-500 shrink-0">&#x2713;</span>
              <span>Runs a secondary PII scan (defense-in-depth)</span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-emerald-500 shrink-0">&#x2713;</span>
              <span>Rate-limits requests (to prevent abuse)</span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-red-400 shrink-0">&#x2717;</span>
              <span>Does not store, log, or cache your messages</span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-red-400 shrink-0">&#x2717;</span>
              <span>Does not store, log, or cache your API key</span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-red-400 shrink-0">&#x2717;</span>
              <span>Does not read or analyze your messages for any purpose</span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-red-400 shrink-0">&#x2717;</span>
              <span>Has no database of user conversations</span>
            </div>
          </div>
          <p className="italic mt-1">
            This is an open-source project. You can read the server code yourself
            and verify every claim above.
          </p>
        </div>
      </Section>

      <Section title="What Anthropic sees">
        <div className="mt-1 space-y-1">
          <p>
            Anthropic receives your message, the conversation history (up to 10
            messages), and metadata about your position in the tax wizard. This is
            processed under <span className="text-slate-400">Anthropic&apos;s API
            terms of service</span>, which are different from their consumer product
            terms (Claude chatbot, etc.):
          </p>
          <div className="space-y-0.5 ml-1">
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">&bull;</span>
              <span>
                Anthropic says API requests are <span className="text-slate-400">not used for training</span>.
                This is a standard API term, not something special we negotiated.
                Anthropic says API data is retained for up to 30 days for safety monitoring, then deleted.
              </span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">&bull;</span>
              <span>
                Despite these protections, your message <span className="text-slate-400">does
                pass through Anthropic&apos;s servers in plaintext</span>. There is
                no end-to-end encryption between your browser and their AI model —
                that isn&apos;t how these APIs work. If this concerns you, Private Mode
                is the only option where your data truly goes nowhere.
              </span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Where your API key lives">
        <div className="mt-1 space-y-1">
          <p>
            Your API key is stored in your browser&apos;s localStorage — the same place
            this app stores your tax return. It never leaves your device except in the
            moment a message is sent, when it&apos;s included in the request body to our
            server. Our server uses it for that single API call and immediately
            discards it. It is never written to disk, logged, or cached in memory
            beyond the request lifecycle.
          </p>
          <p>
            This means if you clear your browser data, your key is gone. We have
            no way to recover it because we never had it. You&apos;d need to generate
            a new one from your Anthropic account.
          </p>
        </div>
      </Section>

      <Section title="What it costs">
        <div className="mt-1 space-y-1">
          <p>
            You pay Anthropic directly through your API account. We receive
            nothing — BYOK mode is genuinely free on our end. Anthropic gives
            $5 in free credits when you create an API account. Typical costs for
            a tax-related conversation:
          </p>
          <div className="mt-1.5 space-y-1.5">
            <InfoRow label="Quick Q&A" value="1-3 messages, ~$0.01-0.03 with Claude Haiku" />
            <InfoRow label="Longer chat" value="10-15 messages, ~$0.05-0.15 with Claude Haiku" />
            <InfoRow label="Full season" value="Even heavy use rarely exceeds $1-5 total" />
          </div>
          <p className="mt-1">
            Costs vary by model. Haiku (fast, affordable) is roughly 10-20x
            cheaper than Opus (best quality) per message. For most tax questions,
            Haiku is more than sufficient.
          </p>
        </div>
      </Section>

      <Section title="Why Anthropic?">
        <div className="mt-1 space-y-1">
          <p>
            We chose Anthropic as the exclusive provider for several reasons:
          </p>
          <div className="space-y-0.5 ml-1">
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">&bull;</span>
              <span>
                <span className="text-slate-300">Best privacy policy</span> — Anthropic
                says its API terms prohibit using API data for training. No opt-out
                required, no toggle to find — it&apos;s just not allowed. OpenAI also
                says it doesn&apos;t train on API data by default, but it&apos;s opt-in rather than
                a blanket prohibition. Google&apos;s Gemini API training policy is
                murkier — it varies by tier, logging settings, and whether you
                share datasets, making it harder to know exactly what happens to
                your data.
              </span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">&bull;</span>
              <span>
                <span className="text-slate-300">No model training on API data</span> — Anthropic
                says it does not use API inputs or outputs to train models. API data
                is retained for up to 30 days for safety monitoring, then
                automatically deleted.
              </span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">&bull;</span>
              <span>
                <span className="text-slate-300">Free credits on signup</span> — new accounts
                get $5 in free credits, enough for hundreds of tax conversations.
              </span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">&bull;</span>
              <span>
                <span className="text-slate-300">Precision with factual claims</span> — Claude
                models tend to be careful and accurate with tax information, which
                matters when discussing IRS rules and deduction eligibility.
              </span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="The honest tradeoff">
        BYOK gives you cloud-grade AI without paying us anything and without
        giving us access to your data. The tradeoff is that your tax-related
        messages do pass through our server (briefly, in transit) and through
        Anthropic&apos;s servers (for processing). We&apos;ve done everything we
        can to minimize exposure — client-side PII blocking, server-side PII
        defense-in-depth, no logging — but the data does leave your device.
        If absolute privacy is your priority, Private Mode is the right choice.
        If you need better AI answers and are comfortable with the tradeoffs
        described above, BYOK is the most cost-effective way to get them.
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-300 mb-0.5">{title}</p>
      <div className="text-[10px] text-slate-500 leading-relaxed">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-400 font-medium shrink-0 w-16">{label}:</span>
      <span>{value}</span>
    </div>
  );
}
