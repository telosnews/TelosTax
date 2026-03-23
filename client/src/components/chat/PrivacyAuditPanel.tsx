/**
 * Privacy Audit Panel — lets users inspect every outbound AI request.
 *
 * Shows a scrollable list of audit log entries with:
 * - Timestamp, feature, provider/model
 * - What was sent (redacted message)
 * - What PII was blocked
 * - Which context keys were included
 * - Truncated AI response
 *
 * Accessible from the chat settings panel.
 */

import { useState, useEffect } from 'react';
import { ChevronLeft, Shield, ChevronDown, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import { getAuditEntries, clearAuditLog, type PrivacyAuditEntry } from '../../services/privacyAuditLog';

interface Props {
  onBack: () => void;
}

const FEATURE_LABELS: Record<string, string> = {
  chat: 'AI Chat',
  'expense-scanner': 'Expense Scanner',
  'document-extract': 'Document Extract',
};

/** Human-readable labels for PII type badges. */
const PII_TYPE_LABELS: Record<string, string> = {
  ssn: 'SSN',
  ssn_partial: 'Partial SSN',
  email: 'Email',
  phone: 'Phone',
  ein: 'EIN',
  address: 'Address',
  zip_code: 'ZIP Code',
  dob: 'Date of Birth',
  bank_account: 'Bank Account',
  credit_card: 'Credit Card',
  ip_pin: 'IP PIN',
  drivers_license: "Driver's License",
};

/** Human-readable descriptions for context keys sent to the AI. */
const CONTEXT_KEY_INFO: Record<string, { label: string; description: string }> = {
  currentStep: { label: 'Current Step', description: 'Which wizard step you are on' },
  currentSection: { label: 'Section', description: 'Which section of the wizard (income, deductions, etc.)' },
  filingStatus: { label: 'Filing Status', description: 'Single, married, head of household, etc.' },
  incomeDiscovery: { label: 'Income Types', description: 'Which income types you indicated (yes/no flags only)' },
  deductionMethod: { label: 'Deduction Method', description: 'Standard or itemized' },
  dependentCount: { label: 'Dependent Count', description: 'Number of dependents (count only, no names)' },
  incomeTypeCounts: { label: 'Income Counts', description: 'How many W-2s, 1099s, etc. (counts only, no amounts)' },
  traceContext: { label: 'Tax Calculations', description: 'How your tax was calculated — approximate amounts and IRS form lines (no personal data)' },
  flowContext: { label: 'Wizard Flow', description: 'Which steps are visible/hidden and why' },
  suggestionsContext: { label: 'Suggestions', description: 'Credits and deductions you may qualify for (names anonymized)' },
  warningsContext: { label: 'Warnings', description: 'Validation issues on your return (names anonymized)' },
  deductionFinderContext: { label: 'Expense Scanner', description: 'Category totals from your scanned transactions (no merchant names)' },
  scenarioLabContext: { label: 'Scenario Lab', description: 'What-if scenario results and comparisons' },
  stepFieldsContext: { label: 'Step Values', description: 'Approximate values you entered on the current step (names anonymized)' },
  auditRiskContext: { label: 'Audit Risk', description: 'Risk score and triggered factors (names anonymized)' },
  taxCalendarContext: { label: 'Tax Calendar', description: 'Upcoming deadlines and payment due dates' },
  documentInventoryContext: { label: 'Document Status', description: 'Which forms are entered, pending, or missing (names anonymized)' },
  yearOverYearContext: { label: 'Year Comparison', description: 'How this year compares to last year (approximate amounts)' },
  // Expense scanner / document extract context keys
  merchants: { label: 'Merchants', description: 'Cleaned merchant names from your transactions' },
  taxContext: { label: 'Tax Context', description: 'Your tax situation flags (self-employed, has mortgage, etc.)' },
  enabledCategories: { label: 'Categories', description: 'Which expense categories you selected to scan' },
  ocrText: { label: 'OCR Text', description: 'Scanned document text (PII-stripped before sending)' },
  formTypeHint: { label: 'Form Type', description: 'Which tax form was detected in the document' },
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function PrivacyAuditPanel({ onBack }: Props) {
  const [entries, setEntries] = useState<PrivacyAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    getAuditEntries()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  const handleClear = async () => {
    await clearAuditLog();
    setEntries([]);
    setConfirmClear(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
        <button
          onClick={onBack}
          className="p-1 text-slate-400 hover:text-white transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Shield className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white flex-1">Privacy Audit Log</h3>
        <span className="text-xs text-slate-500">{entries.length} entries</span>
      </div>

      {/* Description */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <p className="text-xs text-slate-400 leading-relaxed">
          Every AI request that leaves your device is logged here. You can verify exactly what was sent,
          what PII was blocked, and what the AI received. No pre-redaction data is stored.
        </p>
        <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
          This log shows what TelosTax sent. It cannot verify what the AI provider retains or deletes on their end.
          Anthropic&apos;s API data is not used for model training and is deleted after 7 days per their{' '}
          <a href="https://www.anthropic.com/policies/privacy" target="_blank" rel="noopener noreferrer" className="text-telos-blue-400 hover:text-telos-blue-300">data policy</a>.
        </p>
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Shield className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No AI requests logged yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Entries appear here when you use AI Chat, the Expense Scanner, or AI document enhancement.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              return (
                <button
                  key={entry.id}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full text-left px-4 py-3 hover:bg-surface-700/50 transition-colors"
                >
                  {/* Summary row */}
                  <div className="flex items-center gap-2">
                    {isExpanded
                      ? <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                      : <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                    }
                    <span className="text-xs font-medium text-telos-blue-400">
                      {FEATURE_LABELS[entry.feature] || entry.feature}
                    </span>
                    <span className="text-xs text-slate-500">&middot;</span>
                    <span className="text-xs text-slate-500 truncate flex-1">
                      {entry.model}
                    </span>
                    <span className="text-xs text-slate-600 shrink-0">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>

                  {/* PII badge */}
                  {entry.piiBlocked.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 ml-5">
                      {entry.piiBlocked.map((p, i) => {
                        // p is like "ssn" or "email ×2" — extract the type key
                        const typeKey = p.replace(/\s*×\d+$/, '');
                        const count = p.match(/×(\d+)$/)?.[1];
                        const label = PII_TYPE_LABELS[typeKey] || typeKey;
                        return (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                            {label}{count ? ` ×${count}` : ''} blocked
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 ml-5 space-y-2.5 text-xs" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <span className="text-slate-500 font-medium">Sent:</span>
                        <p className="text-slate-300 mt-0.5 whitespace-pre-wrap break-words bg-surface-800 rounded p-2 border border-slate-700/50">
                          {entry.redactedMessage}
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-500 font-medium">Data included with request:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {entry.contextKeysSent.map((k) => {
                            const info = CONTEXT_KEY_INFO[k];
                            return (
                              <span
                                key={k}
                                title={info ? info.description : k}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-slate-400 border border-slate-700/50 cursor-help"
                              >
                                {info ? info.label : k}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 font-medium">Response:</span>
                        <p className="text-slate-400 mt-0.5 italic">
                          {entry.responseTruncated}
                          {entry.responseTruncated.length >= 200 && '...'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-slate-600 pt-1">
                        <span>Provider: {entry.provider}</span>
                        <span>&middot;</span>
                        <span>Model: {entry.model}</span>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: clear button */}
      {entries.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-700">
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400 flex-1">Clear all {entries.length} entries?</span>
              <button
                onClick={handleClear}
                className="text-xs px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Yes, clear
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="text-xs px-3 py-1 bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear log
            </button>
          )}
        </div>
      )}
    </div>
  );
}
