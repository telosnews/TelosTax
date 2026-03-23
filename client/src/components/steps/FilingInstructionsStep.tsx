/**
 * FilingInstructionsStep — Filing Options Hub
 *
 * Presents three pathways for filing:
 *   1. Print & Mail (paper filing)
 *   2. Free Electronic Filing (IRS programs + Transfer Guide)
 *   3. Find an Authorized IRS E-File Provider
 *
 * Internal navigation via FilingView state. Each pathway renders
 * its own panel component with a back button to return here.
 */
import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TaxReturn, CalculationResult } from '@telostax/engine';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateForm1040, FilingStatus, assessFilingOptions, assessEstimatedPaymentNeed } from '@telostax/engine';
import { generateForm4868PDF } from '../../services/irsFormFiller';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import DeadlineCard from '../filing/DeadlineCard';
import PaperMailingPanel from '../filing/PaperMailingPanel';
import FreeEfilingPanel from '../filing/FreeEfilingPanel';
import FindPreparerPanel from '../filing/FindPreparerPanel';
import { toast } from 'sonner';
import {
  FileCheck,
  Printer,
  Monitor,
  UserCheck,
  ChevronRight,
  DollarSign,
  Zap,
  MapPin,
  AlertTriangle,
  ExternalLink,
  Calendar,
  Clock,
  Download,
  Shield,
} from 'lucide-react';

type FilingView = 'hub' | 'paper' | 'efiling' | 'preparer';

export default function FilingInstructionsStep() {
  const navigate = useNavigate();
  const { taxReturn, updateField } = useTaxReturnStore();
  const [view, setView] = useState<FilingView>('hub');

  if (!taxReturn) return null;

  const result = useMemo(() => calculateForm1040({
    ...taxReturn,
    filingStatus: taxReturn.filingStatus || FilingStatus.Single,
  }), [taxReturn]);

  // ── Sub-views ─────────────────────────────────────
  if (view === 'paper') {
    return (
      <div>
        <PaperMailingPanel
          taxReturn={taxReturn}
          result={result}
          onBack={() => setView('hub')}
        />
        <StepNavigation showBack continueLabel="Download Forms" />
      </div>
    );
  }

  if (view === 'efiling') {
    return (
      <div>
        <FreeEfilingPanel
          taxReturn={taxReturn}
          result={result}
          onBack={() => setView('hub')}
        />
        <StepNavigation showBack continueLabel="Download Forms" />
      </div>
    );
  }

  if (view === 'preparer') {
    return (
      <div>
        <FindPreparerPanel
          taxReturn={taxReturn}
          onBack={() => setView('hub')}
        />
        <StepNavigation showBack continueLabel="Download Forms" />
      </div>
    );
  }

  // ── Hub view ──────────────────────────────────────
  return <HubView taxReturn={taxReturn} result={result} onSelect={setView} updateField={updateField} />;
}

// ── HubView (main landing) ──────────────────────

function HubView({
  taxReturn,
  result,
  onSelect,
  updateField,
}: {
  taxReturn: TaxReturn;
  result: CalculationResult;
  onSelect: (view: FilingView) => void;
  updateField: (field: string, value: unknown) => void;
}) {
  const navigate = useNavigate();
  const assessment = useMemo(
    () => assessFilingOptions(taxReturn, result),
    [taxReturn, result],
  );

  const refund = result.form1040.refundAmount || 0;
  const owed = result.form1040.amountOwed || 0;

  const taxableStates = result.stateResults?.filter(sr => sr.totalStateTax > 0 || sr.localTax > 0) || [];

  const estimatedRec = useMemo(
    () => assessEstimatedPaymentNeed(taxReturn, result),
    [taxReturn, result],
  );

  // Count eligible e-filing options
  const efilingEligibleCount = [
    assessment.freeFile,
    assessment.freeFileForms,
    assessment.vita,
    assessment.tce,
  ].filter(e => e.status === 'eligible' || e.status === 'likely_eligible').length;

  return (
    <div>
      <SectionIntro
        icon={<FileCheck className="w-8 h-8" />}
        title="How Do You Want to File?"
        description="Choose how to submit your completed tax return to the IRS."
      />

      {/* Deadline */}
      <div className="mt-4">
        <DeadlineCard deadline="April 15, 2026" extensionFiled={taxReturn.extensionFiled} />
      </div>

      {/* Extension Card — shown when extension not yet filed */}
      {!taxReturn.extensionFiled ? (
        <ExtensionCard taxReturn={taxReturn} result={result} updateField={updateField} />
      ) : (
        <div className="card mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <FileCheck className="w-4 h-4" />
            <span>Extension (Form 4868) has been generated.</span>
          </div>
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-300 underline"
            onClick={() => updateField('extensionFiled', false)}
          >
            I didn&apos;t file an extension
          </button>
        </div>
      )}

      {/* Pathway Cards */}
      <div className="mt-5 space-y-3">
        {/* 1. Print & Mail */}
        <PathwayCard
          icon={<Printer className="w-6 h-6" />}
          title="Print & Mail"
          description="Print your completed forms and mail them to the IRS."
          onClick={() => onSelect('paper')}
        />

        {/* 2. Free Electronic Filing */}
        <PathwayCard
          icon={<Monitor className="w-6 h-6" />}
          title="Free Electronic Filing"
          description="E-file for free using IRS programs. Faster processing, quicker refunds."
          onClick={() => onSelect('efiling')}
          badge={efilingEligibleCount > 0
            ? `${efilingEligibleCount} ${efilingEligibleCount === 1 ? 'Option' : 'Options'} Available`
            : undefined
          }
        />

        {/* 3. Find an Authorized E-File Provider */}
        <PathwayCard
          icon={<UserCheck className="w-6 h-6" />}
          title="Find an E-File Provider"
          description="Locate an IRS-authorized e-file provider who can file electronically for you."
          onClick={() => onSelect('preparer')}
        />
      </div>

      {/* Refund/Owed Summary */}
      {(refund > 0 || owed > 0) && (
        <div className="mt-5">
          {refund > 0 && (
            <div className="rounded-xl border p-6 bg-emerald-500/10 border-emerald-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm text-slate-300">Estimated Federal Refund</span>
                </div>
                <span className="text-lg font-bold text-emerald-400">
                  ${refund.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <Zap className="w-3.5 h-3.5 text-telos-blue-400" />
                <span className="text-xs text-slate-400">
                  E-filing with direct deposit is the fastest way to get your refund.
                </span>
              </div>
            </div>
          )}
          {owed > 0 && (
            <div className="rounded-xl border p-6 bg-amber-500/10 border-amber-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                  <span className="text-sm text-slate-300">Federal Amount Owed</span>
                </div>
                <span className="text-lg font-bold text-amber-400">
                  ${owed.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* State Refund/Owed Cards */}
      {taxableStates.length > 0 && (
        <div className="mt-3 space-y-2">
          {taxableStates.map(sr => {
            const stateRefund = sr.stateRefundOrOwed >= 0;
            return (
              <div
                key={sr.stateCode}
                className={`rounded-xl border p-6 ${stateRefund ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/15'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-4 h-4 ${stateRefund ? 'text-emerald-400' : 'text-amber-400'}`} />
                    <span className="text-sm text-slate-300">{sr.stateName}</span>
                  </div>
                  <span className={`text-base font-bold ${stateRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
                    ${Math.abs(sr.stateRefundOrOwed).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 ml-6">
                  {stateRefund ? 'State refund' : 'State amount owed'} — file separately with your state
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Estimated Tax Payments — forward-looking guidance for next year */}
      {estimatedRec.recommended && (
        <div className="mt-5 rounded-xl border border-telos-blue-500/30 bg-telos-blue-500/10 p-5">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-telos-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-telos-blue-300">Plan Ahead: 2026 Estimated Tax Payments</p>
              <ul className="mt-2 space-y-1">
                {estimatedRec.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-slate-300 leading-relaxed flex items-start gap-1.5">
                    <span className="text-telos-blue-400 mt-0.5">&bull;</span>
                    {r}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-white font-semibold mt-3">
                Recommended: ${estimatedRec.quarterlyAmount.toLocaleString()} per quarter
              </p>
              <p className="text-xs text-slate-400 mt-1">
                First payment due {estimatedRec.dueDates[0].date}. Download vouchers on the Export step.
              </p>
              <a
                href="https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Learn more on IRS.gov
              </a>
            </div>
          </div>
        </div>
      )}

      {/* FBAR Warning — FinCEN 114 is filed separately from the tax return */}
      {hasForeignActivity(taxReturn) && (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">You May Need to File FBAR (FinCEN 114)</p>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                You reported foreign income or foreign tax paid. If you had a financial interest in or signature authority
                over foreign financial accounts with an aggregate value exceeding <span className="font-semibold text-white">$10,000</span> at
                any time during 2025, you must file FinCEN Form 114 (FBAR) separately — it is <em>not</em> filed with
                your tax return. Penalties for non-filing start at <span className="font-semibold text-white">$10,000 per violation</span>.
              </p>
              <a
                href="https://www.irs.gov/businesses/small-businesses-self-employed/report-of-foreign-bank-and-financial-accounts-fbar"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Learn more on IRS.gov
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Prototype Warning */}
      <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-300 mb-1.5">Important: This is a prototype</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This tool is for informational purposes only and does not constitute tax advice.
              Do not use this app to file your taxes without having your return carefully reviewed
              by a qualified tax professional. TelosTax needs vetting by tax experts and human
              coders, which is why it&apos;s available as a free, open-source project. The tax engine
              may contain errors. If you&apos;re a tax professional or developer who&apos;d like to help
              stress-test the app, please get in touch.
            </p>
            <button
              onClick={() => navigate('/pledge')}
              className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              Learn more about this project &rarr;
            </button>
          </div>
        </div>
      </div>

      <StepNavigation showBack continueLabel="Download Forms" />
    </div>
  );
}

/** Returns true if the tax return indicates any foreign financial activity. */
function hasForeignActivity(tr: TaxReturn): boolean {
  if (tr.foreignEarnedIncome?.foreignEarnedIncome && tr.foreignEarnedIncome.foreignEarnedIncome > 0) return true;
  if (tr.foreignTaxCreditCategories?.some(c => c.foreignTaxPaid > 0)) return true;
  if (tr.incomeDiscovery?.['foreign_income'] === 'yes') return true;
  if (tr.incomeDiscovery?.['foreign_tax_credit'] === 'yes') return true;
  return false;
}

// ── ExtensionCard ────────────────────────────────

function ExtensionCard({
  taxReturn,
  result,
  updateField,
}: {
  taxReturn: TaxReturn;
  result: CalculationResult;
  updateField: (field: string, value: unknown) => void;
}) {
  const [generating, setGenerating] = useState(false);

  const canGenerate = !!(taxReturn.firstName && taxReturn.lastName && (taxReturn.ssn || taxReturn.ssnLastFour));

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || generating) return;
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

  return (
    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
      <div className="flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-300">Need More Time?</p>
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
            Form 4868 gives you an automatic 6-month extension to <span className="font-semibold text-white">October 15, 2026</span>.
            This extends your <em>filing</em> deadline only — any tax owed is still due April 15.
          </p>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              title={!canGenerate ? 'Enter your name and SSN on the My Info page first' : undefined}
            >
              <Download className="w-4 h-4" />
              {generating ? 'Generating...' : 'Generate Form 4868'}
            </button>

            {!canGenerate && (
              <span className="text-[10px] text-slate-400">
                Enter your name and SSN on the My Info page first.
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
  );
}

// ── PathwayCard ──────────────────────────────────

function PathwayCard({
  icon,
  title,
  description,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="card-selectable w-full text-left flex items-center gap-4 py-4 group"
    >
      <span className="text-telos-blue-400 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white">{title}</span>
          {badge && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-telos-blue-400 transition-colors shrink-0" />
    </button>
  );
}
