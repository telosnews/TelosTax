import { useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertArcherMSA } from '../../api/client';
import { calculateForm1040, ARCHER_MSA } from '@telostax/engine';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HeartPulse, ExternalLink, Info, AlertTriangle } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';

export default function ArcherMSAStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['archer_msa'];

  const info = taxReturn.archerMSA || {
    coverageType: 'self_only' as const,
    hdhpDeductible: 0,
    personalContributions: 0,
    coverageMonths: 12,
    isEnrolledInMedicare: false,
  };

  const update = (field: string, value: unknown) => {
    updateField('archerMSA', { ...info, [field]: value });
  };

  const save = async () => {
    await upsertArcherMSA(returnId, { ...info });
  };

  // Live calculation
  const result = useMemo(() => {
    try { return calculateForm1040(taxReturn); } catch { return null; }
  }, [taxReturn]);

  const archerMSADeduction = result?.form1040?.archerMSADeduction || 0;

  // Auto-detect employer contributions from W-2 Box 12 Code R
  const employerContributions = (taxReturn.w2Income || []).reduce((sum, w) => {
    const box12R = w.box12?.find(e => e.code === 'R');
    return sum + (box12R?.amount || 0);
  }, 0);

  // Deductible range validation
  const deductibleMin = info.coverageType === 'family' ? ARCHER_MSA.FAMILY_DEDUCTIBLE_MIN : ARCHER_MSA.SELF_ONLY_DEDUCTIBLE_MIN;
  const deductibleMax = info.coverageType === 'family' ? ARCHER_MSA.FAMILY_DEDUCTIBLE_MAX : ARCHER_MSA.SELF_ONLY_DEDUCTIBLE_MAX;
  const deductibleOutOfRange = info.hdhpDeductible > 0 && (info.hdhpDeductible < deductibleMin || info.hdhpDeductible > deductibleMax);

  return (
    <div>
      <StepWarningsBanner stepId="archer_msa" />

      <SectionIntro
        icon={<HeartPulse className="w-8 h-8" />}
        title="Archer MSA"
        description="Deduct contributions to your Archer Medical Savings Account (Form 8853)."
      />

      <CalloutCard variant="info" title="Who qualifies for an Archer MSA?" irsUrl="https://www.irs.gov/forms-pubs/about-form-8853">
        Archer MSAs are legacy accounts for self-employed individuals and employees of small businesses (50 or fewer employees). No new accounts could be opened after 2007, but existing account holders can still contribute. Contributions are 100% deductible above-the-line. If your employer contributes (W-2 Box 12 Code R), you cannot also make personal contributions in the same year.
      </CalloutCard>

      <div className="mt-6 space-y-4">
        {info.isEnrolledInMedicare && (
          <CalloutCard variant="warning" title="Medicare enrollment blocks contributions">
            You indicated you are enrolled in Medicare. Archer MSA contributions are not allowed once you enroll in Medicare.
          </CalloutCard>
        )}

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <HeartPulse className="w-5 h-5 text-telos-blue-400" />
            <h3 className="font-medium text-slate-200">Coverage & Contributions</h3>
          </div>

          <FormField label="HDHP Coverage Type" tooltip="Whether your high deductible health plan covers just you or your family.">
            <div className="flex gap-3">
              <button
                className={`py-1.5 px-4 rounded text-sm ${info.coverageType === 'self_only' ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`}
                onClick={() => update('coverageType', 'self_only')}
              >
                Self-Only
              </button>
              <button
                className={`py-1.5 px-4 rounded text-sm ${info.coverageType === 'family' ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`}
                onClick={() => update('coverageType', 'family')}
              >
                Family
              </button>
            </div>
          </FormField>

          <FormField
            label="HDHP Annual Deductible"
            tooltip={help?.fields['HDHP Deductible']?.tooltip}
            irsRef={help?.fields['HDHP Deductible']?.irsRef}
            helpText={`${info.coverageType === 'family' ? 'Family' : 'Self-only'}: $${deductibleMin.toLocaleString()}–$${deductibleMax.toLocaleString()} (2025)`}
          >
            <CurrencyInput
              value={info.hdhpDeductible}
              onChange={(v) => update('hdhpDeductible', v)}
            />
          </FormField>

          {deductibleOutOfRange && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Your deductible of ${info.hdhpDeductible.toLocaleString()} is outside the qualifying range for {info.coverageType === 'family' ? 'family' : 'self-only'} coverage (${deductibleMin.toLocaleString()}–${deductibleMax.toLocaleString()}).
              </p>
            </div>
          )}

          <FormField
            label="Coverage Months"
            tooltip="Number of months you were covered by the qualifying HDHP. Contributions are prorated for partial-year coverage."
            irsRef="Form 8853"
          >
            <select
              value={info.coverageMonths}
              onChange={(e) => update('coverageMonths', parseInt(e.target.value, 10))}
              className="input-field"
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <option key={m} value={m}>{m} month{m !== 1 ? 's' : ''}</option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Personal Contributions"
            tooltip={help?.fields['Personal Contributions']?.tooltip}
            irsRef={help?.fields['Personal Contributions']?.irsRef}
          >
            <CurrencyInput
              value={info.personalContributions}
              onChange={(v) => update('personalContributions', v)}
            />
          </FormField>

          <FormField label="Enrolled in Medicare?" tooltip="If you enrolled in Medicare, you cannot make Archer MSA contributions.">
            <div className="flex gap-3">
              <button
                className={`py-1.5 px-4 rounded text-sm ${info.isEnrolledInMedicare ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`}
                onClick={() => update('isEnrolledInMedicare', true)}
              >
                Yes
              </button>
              <button
                className={`py-1.5 px-4 rounded text-sm ${!info.isEnrolledInMedicare ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`}
                onClick={() => update('isEnrolledInMedicare', false)}
              >
                No
              </button>
            </div>
          </FormField>
        </div>

        {/* Employer contributions detected */}
        {employerContributions > 0 && (
          <div className="card bg-surface-800">
            <div className="flex items-center gap-3 mb-2">
              <Info className="w-5 h-5 text-telos-blue-400" />
              <h3 className="font-medium text-slate-200">Employer Contributions Detected</h3>
            </div>
            <p className="text-sm text-slate-400">
              Your W-2(s) show <span className="text-white font-medium">${employerContributions.toLocaleString()}</span> in employer Archer MSA contributions (Box 12 Code R). These are already excluded from your taxable wages.
            </p>
            {(info.personalContributions || 0) > 0 && (
              <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  You cannot make personal contributions in a year when your employer also contributes. Your personal contributions may be treated as excess.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Live deduction summary */}
        {archerMSADeduction > 0 && (
          <div className="rounded-xl border p-6 bg-telos-orange-500/10 border-telos-orange-500/20 text-center">
            <p className="text-sm text-slate-400 mb-1">Archer MSA Deduction</p>
            <p className="text-2xl font-bold text-telos-orange-400">${archerMSADeduction.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">
              Above-the-line deduction — reduces your AGI
            </p>
          </div>
        )}

        {/* Contribution limits reference */}
        <div className="card bg-surface-800 border-slate-700 text-sm text-slate-400">
          <div className="flex items-center gap-3 mb-3">
            <Info className="w-5 h-5 text-telos-blue-400" />
            <h3 className="font-medium text-slate-200">Contribution Limits (2025)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-left py-1">Coverage</th>
                  <th className="text-right py-1">Rate</th>
                  <th className="text-right py-1">Deductible Range</th>
                  <th className="text-right py-1">Max Contribution</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr>
                  <td className="py-0.5">Self-Only</td>
                  <td className="text-right">65%</td>
                  <td className="text-right">${ARCHER_MSA.SELF_ONLY_DEDUCTIBLE_MIN.toLocaleString()}–${ARCHER_MSA.SELF_ONLY_DEDUCTIBLE_MAX.toLocaleString()}</td>
                  <td className="text-right">${Math.round(ARCHER_MSA.SELF_ONLY_DEDUCTIBLE_MAX * ARCHER_MSA.SELF_ONLY_RATE).toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-0.5">Family</td>
                  <td className="text-right">75%</td>
                  <td className="text-right">${ARCHER_MSA.FAMILY_DEDUCTIBLE_MIN.toLocaleString()}–${ARCHER_MSA.FAMILY_DEDUCTIBLE_MAX.toLocaleString()}</td>
                  <td className="text-right">${Math.round(ARCHER_MSA.FAMILY_DEDUCTIBLE_MAX * ARCHER_MSA.FAMILY_RATE).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs">
            Limit = rate × your HDHP deductible, prorated for partial-year coverage.
          </p>
        </div>
      </div>

      <a
        href="https://www.irs.gov/forms-pubs/about-form-8853"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation onContinue={save} />
    </div>
  );
}
