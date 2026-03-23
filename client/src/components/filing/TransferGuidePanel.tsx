/**
 * TransferGuidePanel — Interactive line-by-line copy helper.
 *
 * Bridges the gap between TelosTax's calculated values and
 * IRS Free Fillable Forms. Users can copy individual line values
 * or an entire form's values for manual transfer.
 */
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { TaxReturn, CalculationResult, TransferGuideData, TransferGuideForm } from '@telostax/engine';
import { generateTransferGuide, FILING_URLS } from '@telostax/engine';
import CalloutCard from '../common/CalloutCard';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Check,
  ExternalLink,
  Lightbulb,
} from 'lucide-react';

interface TransferGuidePanelProps {
  taxReturn: TaxReturn;
  result: CalculationResult;
  onBack: () => void;
}

export default function TransferGuidePanel({ taxReturn, result, onBack }: TransferGuidePanelProps) {
  const guide = useMemo(
    () => generateTransferGuide(taxReturn, result),
    [taxReturn, result],
  );

  if (guide.forms.length === 0) {
    return (
      <div>
        <BackButton onClick={onBack} label="Back to E-Filing Options" />
        <h2 className="text-xl font-bold text-white mb-2">Transfer Guide</h2>
        <p className="text-sm text-slate-400">
          No form values to transfer — your return appears empty. Enter your income data first.
        </p>
      </div>
    );
  }

  return (
    <div>
      <BackButton onClick={onBack} label="Back to E-Filing Options" />

      <h2 className="text-xl font-bold text-white mb-1">Transfer Guide</h2>
      <p className="text-sm text-slate-400 mb-4">
        Copy your calculated values line-by-line into IRS Free Fillable Forms.
      </p>

      <CalloutCard variant="tip" title="How to use this guide">
        Open Free Fillable Forms in another tab, then use the copy buttons below to transfer
        each value. The line numbers match exactly.
      </CalloutCard>

      <div className="mt-5 space-y-3">
        {guide.forms.map((form, i) => (
          <FormSection key={form.formId} form={form} defaultExpanded={i === 0} />
        ))}
      </div>

      {/* External link */}
      <div className="mt-6 flex justify-center">
        <a
          href={FILING_URLS.freeFileForms}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-telos-blue-600 hover:bg-telos-blue-500 text-white text-sm font-medium transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Open Free Fillable Forms
        </a>
      </div>
    </div>
  );
}

// ── FormSection (expandable) ─────────────────────

function FormSection({ form, defaultExpanded }: { form: TransferGuideForm; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyAll = async () => {
    const text = form.lines
      .map(l => `Line ${l.line}\t${l.label}\t${l.value}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      toast.success(`Copied all ${form.lines.length} lines from ${form.formName.split(' — ')[0]}`);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      toast.error('Failed to copy — check browser permissions');
    }
  };

  return (
    <div className="card bg-surface-800 border-slate-700">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          }
          <span className="text-sm font-semibold text-white truncate">{form.formName}</span>
        </div>
        <span className="text-xs text-slate-400 shrink-0">{form.lines.length} lines</span>
      </button>

      {/* Lines table */}
      {expanded && (
        <div className="mt-3">
          {/* Copy All button */}
          <div className="flex justify-end mb-2">
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-telos-blue-400 transition-colors"
            >
              {copiedAll
                ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                : <ClipboardCopy className="w-3.5 h-3.5" />
              }
              {copiedAll ? 'Copied!' : 'Copy All'}
            </button>
          </div>

          <div className="space-y-0.5">
            {form.lines.map(line => (
              <TransferLine
                key={`${form.formId}-${line.line}`}
                line={line.line}
                label={line.label}
                value={line.value}
                formattedValue={line.formattedValue}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TransferLine (single copy-able line) ─────────

function TransferLine({
  line,
  label,
  value,
  formattedValue,
}: {
  line: string;
  label: string;
  value: number;
  formattedValue: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Copy the raw number (what they'll type into the form)
      await navigator.clipboard.writeText(String(Math.abs(Math.round(value))));
      setCopied(true);
      toast.success(`Copied Line ${line}: ${formattedValue}`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-surface-700/50 transition-colors group">
      {/* Line number */}
      <span className="text-xs font-mono text-slate-300 w-8 shrink-0 text-right">
        {line}
      </span>

      {/* Label */}
      <span className="text-sm text-slate-400 flex-1 min-w-0 truncate">
        {label}
      </span>

      {/* Value */}
      <span className="text-sm font-semibold text-white tabular-nums shrink-0">
        {formattedValue}
      </span>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-surface-600 transition-colors shrink-0"
        title={`Copy ${formattedValue}`}
      >
        {copied
          ? <Check className="w-4 h-4 text-emerald-400" />
          : <ClipboardCopy className="w-4 h-4 text-slate-400 group-hover:text-slate-300 transition-colors" />
        }
      </button>
    </div>
  );
}

// ── Shared sub-components ────────────────────────

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-telos-blue-400 transition-colors mb-4"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
