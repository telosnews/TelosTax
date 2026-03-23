/**
 * FileExtensionToolView — standalone tool for generating Form 4868.
 *
 * Provides a focused, self-contained panel for filing a tax extension
 * without navigating to the full Filing Instructions page.
 *
 * Shows all Form 4868 fields pre-populated from earlier steps, but
 * fully editable so users can complete everything in one place.
 */

import { useMemo, useState, useCallback } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateForm1040, FilingStatus } from '@telostax/engine';
import { generateForm4868PDF } from '../../services/irsFormFiller';
import ToolViewWrapper from './ToolViewWrapper';
import SectionIntro from '../common/SectionIntro';
import DeadlineCard from '../filing/DeadlineCard';
import FormField from '../common/FormField';
import SSNInput from '../common/SSNInput';
import ZIPInput from '../common/ZIPInput';
import { toast } from 'sonner';
import { Clock, Download, ExternalLink, ShieldCheck, Hourglass, CheckCircle2 } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────

const FILING_STATUS_LABELS: Record<number, string> = {
  [FilingStatus.Single]: 'Single',
  [FilingStatus.MarriedFilingJointly]: 'Married Filing Jointly',
  [FilingStatus.MarriedFilingSeparately]: 'Married Filing Separately',
  [FilingStatus.HeadOfHousehold]: 'Head of Household',
  [FilingStatus.QualifyingSurvivingSpouse]: 'Qualifying Surviving Spouse',
};

function fmt$(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

// ── Component ────────────────────────────────────────────────────

export default function FileExtensionToolView() {
  const { taxReturn, updateField } = useTaxReturnStore();
  const [generating, setGenerating] = useState(false);

  const result = useMemo(() => {
    if (!taxReturn) return null;
    return calculateForm1040({
      ...taxReturn,
      filingStatus: taxReturn.filingStatus || FilingStatus.Single,
    });
  }, [taxReturn]);

  if (!taxReturn || !result) {
    return (
      <ToolViewWrapper>
        <SectionIntro
          icon={<Hourglass className="w-8 h-8" />}
          title="File an Extension"
          description="Start your return first, then come back here to generate Form 4868."
        />
      </ToolViewWrapper>
    );
  }

  const isJoint = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly;
  const canGenerate = !!(taxReturn.firstName && taxReturn.lastName && (taxReturn.ssn || taxReturn.ssnLastFour));

  // Tax estimate lines (read-only, from calc)
  const totalTax = result.form1040.totalTax || 0;
  const penalty = result.form1040.estimatedTaxPenalty || 0;
  const line4 = Math.max(0, totalTax - penalty);
  const line5 = result.form1040.totalPayments || 0;
  const line6 = Math.max(0, line4 - line5);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || generating || !result) return;
    setGenerating(true);
    try {
      const pdfBytes = await generateForm4868PDF(taxReturn, result);
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Form4868_Extension.pdf';
      a.click();
      URL.revokeObjectURL(url);

      updateField('extensionFiled', true);

      toast.warning(
        'Downloaded. You must still submit this to the IRS by April 15 — by mail or e-file at irs.gov/extensions.',
        { duration: 12000 },
      );
    } catch (err) {
      toast.error('Failed to generate Form 4868. Please try again.');
      console.error('Form 4868 generation error:', err);
    } finally {
      setGenerating(false);
    }
  }, [taxReturn, result, canGenerate, generating, updateField]);

  // ── Already filed state ──
  if (taxReturn.extensionFiled) {
    return (
      <ToolViewWrapper>
        <SectionIntro
          icon={<Hourglass className="w-8 h-8" />}
          title="File an Extension"
          description="Generate Form 4868 for an automatic 6-month extension."
        />

        <div className="mt-4">
          <DeadlineCard deadline="April 15, 2026" extensionFiled />
        </div>

        <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">Extension Filed</p>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Your deadline has been extended to <span className="font-semibold text-white">October 15, 2026</span>.
                Remember to submit the form to the IRS — by mail or e-file at irs.gov/extensions.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Any tax owed is still due April 15. The extension only extends the <em>filing</em> deadline.
              </p>
              <a
                href="https://www.irs.gov/forms-pubs/extension-of-time-to-file-your-tax-return"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                E-file your extension at irs.gov/extensions
              </a>
              <button
                type="button"
                className="block mt-3 text-xs text-slate-400 hover:text-slate-300 underline"
                onClick={() => updateField('extensionFiled', false)}
              >
                I didn&apos;t file an extension
              </button>
            </div>
          </div>
        </div>
      </ToolViewWrapper>
    );
  }

  // ── Generate state ──
  return (
    <ToolViewWrapper>
      <SectionIntro
        icon={<Hourglass className="w-8 h-8" />}
        title="File an Extension"
        description="Generate Form 4868 for an automatic 6-month extension to October 15, 2026."
      />

      <div className="mt-4">
        <DeadlineCard deadline="April 15, 2026" extensionFiled={false} />
      </div>

      {/* ── Your Information ── */}
      <div className="mt-5 card">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Your Information</h3>
        <p className="text-xs text-slate-400 mb-4">
          Pre-filled from your return. Edit anything that needs updating — changes save to your return automatically.
        </p>

        {/* Filing Status (read-only display) */}
        {taxReturn.filingStatus && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-surface-700/50 border border-slate-700/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-telos-blue-400 shrink-0" />
            <span className="text-xs text-slate-300">
              Filing as <span className="font-medium text-white">{FILING_STATUS_LABELS[taxReturn.filingStatus] || 'Unknown'}</span>
            </span>
          </div>
        )}

        {/* Name row */}
        <div className="space-y-1">
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="First Name">
                <input
                  className="input-field"
                  value={taxReturn.firstName || ''}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  placeholder="Jane"
                />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="Last Name">
                <input
                  className="input-field"
                  value={taxReturn.lastName || ''}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  placeholder="Doe"
                />
              </FormField>
            </div>
          </div>

          {/* Spouse name (MFJ only) */}
          {isJoint && (
            <div className="flex gap-3">
              <div className="flex-1">
                <FormField label="Spouse First Name">
                  <input
                    className="input-field"
                    value={taxReturn.spouseFirstName || ''}
                    onChange={(e) => updateField('spouseFirstName', e.target.value)}
                  />
                </FormField>
              </div>
              <div className="flex-1">
                <FormField label="Spouse Last Name">
                  <input
                    className="input-field"
                    value={taxReturn.spouseLastName || ''}
                    onChange={(e) => updateField('spouseLastName', e.target.value)}
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* Address */}
          <FormField label="Street Address">
            <input
              className="input-field"
              value={taxReturn.addressStreet || ''}
              onChange={(e) => updateField('addressStreet', e.target.value)}
              placeholder="123 Main St"
            />
          </FormField>

          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="City">
                <input
                  className="input-field"
                  value={taxReturn.addressCity || ''}
                  onChange={(e) => updateField('addressCity', e.target.value)}
                />
              </FormField>
            </div>
            <div className="w-24">
              <FormField label="State">
                <input
                  className="input-field"
                  value={taxReturn.addressState || ''}
                  onChange={(e) => updateField('addressState', e.target.value.toUpperCase().slice(0, 2))}
                  maxLength={2}
                  placeholder="CA"
                />
              </FormField>
            </div>
            <div className="w-32">
              <FormField label="ZIP">
                <ZIPInput value={taxReturn.addressZip || ''} onChange={(v) => updateField('addressZip', v)} />
              </FormField>
            </div>
          </div>

          {/* SSN */}
          <div className={`grid gap-4 mt-1 ${isJoint ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
            <SSNInput
              label="Social Security Number"
              value={taxReturn.ssn || ''}
              onChange={(val) => {
                updateField('ssn', val);
                updateField('ssnLastFour', val.length >= 4 ? val.slice(-4) : val);
              }}
            />
            {isJoint && (
              <SSNInput
                label="Spouse SSN"
                value={taxReturn.spouseSsn || ''}
                onChange={(val) => {
                  updateField('spouseSsn', val);
                  updateField('spouseSsnLastFour', val.length >= 4 ? val.slice(-4) : val);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Tax Estimate (Lines 4–6) ── */}
      <div className="mt-4 card">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Tax Estimate</h3>
        <p className="text-xs text-slate-400 mb-4">
          Calculated from your return. These values auto-fill Lines 4–6 on Form 4868.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
            <span className="text-xs text-slate-400">Line 4 — Estimated total tax liability</span>
            <span className="text-sm font-medium text-slate-200">{fmt$(line4)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
            <span className="text-xs text-slate-400">Line 5 — Total payments already made</span>
            <span className="text-sm font-medium text-slate-200">{fmt$(line5)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-slate-400">Line 6 — Balance due</span>
            <span className={`text-sm font-bold ${line6 > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {fmt$(line6)}
            </span>
          </div>
        </div>

        {line6 > 0 && (
          <p className="text-[11px] text-amber-400/80 mt-3">
            Even with an extension, the balance due is still owed by April 15. Interest and penalties accrue on unpaid amounts.
          </p>
        )}
      </div>

      {/* ── Generate Card ── */}
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">Ready to Generate</p>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Form 4868 gives you an automatic 6-month extension to <span className="font-semibold text-white">October 15, 2026</span>.
              This extends your <em>filing</em> deadline only — any tax owed is still due April 15.
            </p>

            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || generating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                title={!canGenerate ? 'Enter your name and SSN above first' : undefined}
              >
                <Download className="w-4 h-4" />
                {generating ? 'Generating...' : 'Generate Form 4868'}
              </button>

              {!canGenerate && (
                <span className="text-[10px] text-slate-400">
                  Fill in your name and SSN above first.
                </span>
              )}
            </div>

            <a
              href="https://www.irs.gov/forms-pubs/extension-of-time-to-file-your-tax-return"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              E-file your extension at irs.gov/extensions
            </a>
          </div>
        </div>
      </div>
    </ToolViewWrapper>
  );
}
