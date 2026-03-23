import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Briefcase, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp, Megaphone, Heart, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import type { Form7206Input, Form7206MonthlyEligibility } from '@telostax/engine';

export default function SEDeductionsStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  const calculation = useTaxReturnStore((s) => s.calculation);
  const [showChanges, setShowChanges] = useState(false);
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['se_deductions'];

  const sed = taxReturn.selfEmploymentDeductions || {
    healthInsurancePremiums: 0,
    sepIraContributions: 0,
    solo401kEmployeeDeferral: 0,
    solo401kEmployerContribution: 0,
    solo401kContributions: 0,
    otherRetirementContributions: 0,
  };

  const [showHealthDetail, setShowHealthDetail] = useState(!!sed.form7206);
  const [showEmployerPlanGrid, setShowEmployerPlanGrid] = useState(
    !!sed.form7206?.monthlyEligibility,
  );

  // Get live calculation results for Solo 401(k), SEP-IRA, and Form 7206
  const solo401k = calculation?.solo401k;
  const sepIRA = calculation?.sepIRA;
  const form7206 = calculation?.form7206;

  const update = (field: string, value: number) => {
    const updated = { ...sed, [field]: value };
    // Sync the backward-compat solo401kContributions with the split fields
    if (field === 'solo401kEmployeeDeferral' || field === 'solo401kEmployerContribution') {
      const empDef = field === 'solo401kEmployeeDeferral' ? value : (updated.solo401kEmployeeDeferral || 0);
      const empCon = field === 'solo401kEmployerContribution' ? value : (updated.solo401kEmployerContribution || 0);
      updated.solo401kContributions = empDef + empCon;
    }
    updateField('selfEmploymentDeductions', updated);
  };

  const updateForm7206 = (field: keyof Form7206Input, value: number) => {
    const current: Form7206Input = sed.form7206 || { medicalDentalVisionPremiums: sed.healthInsurancePremiums || 0 };
    const updated7206 = { ...current, [field]: value };
    // Sync backward-compat healthInsurancePremiums with total premiums
    const totalPremiums = (updated7206.medicalDentalVisionPremiums || 0)
      + (updated7206.longTermCarePremiums || 0)
      + (updated7206.medicarePremiums || 0);
    updateField('selfEmploymentDeductions', {
      ...sed,
      form7206: updated7206,
      healthInsurancePremiums: totalPremiums,
    });
  };

  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const toggleEmployerPlanMonth = (monthIdx: number, isSpouse: boolean) => {
    const current: Form7206Input = sed.form7206 || { medicalDentalVisionPremiums: sed.healthInsurancePremiums || 0 };
    const eligibility: Form7206MonthlyEligibility = current.monthlyEligibility || {
      taxpayerEligibleForEmployerPlan: Array(12).fill(false),
    };

    if (isSpouse) {
      const arr = [...(eligibility.spouseEligibleForEmployerPlan || Array(12).fill(false))];
      arr[monthIdx] = !arr[monthIdx];
      updateField('selfEmploymentDeductions', {
        ...sed,
        form7206: { ...current, monthlyEligibility: { ...eligibility, spouseEligibleForEmployerPlan: arr } },
      });
    } else {
      const arr = [...eligibility.taxpayerEligibleForEmployerPlan];
      arr[monthIdx] = !arr[monthIdx];
      updateField('selfEmploymentDeductions', {
        ...sed,
        form7206: { ...current, monthlyEligibility: { ...eligibility, taxpayerEligibleForEmployerPlan: arr } },
      });
    }
  };

  const isMFJ = taxReturn.filingStatus === 2;

  const save = async () => {
    await updateReturn(returnId, { selfEmploymentDeductions: sed });
  };

  const hasSEIncome = (calculation?.scheduleC?.netProfit || 0) > 0;

  return (
    <div>
      <SectionIntro icon={<Briefcase className="w-8 h-8" />} title="Self-Employment Deductions" description="These reduce your income before tax — they're above-the-line deductions." />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* 2025 tax law changes */}
      <div className="mt-6 mb-6 rounded-lg border border-slate-700 overflow-hidden">
        <button
          onClick={() => setShowChanges(!showChanges)}
          className="w-full px-4 py-3 flex items-center gap-3 bg-surface-800 hover:bg-surface-700 transition-colors"
        >
          <Megaphone className="w-5 h-5 text-amber-400" />
          <span className="font-medium text-sm text-slate-200">What changed for 2025</span>
          {showChanges ? (
            <ChevronUp className="w-4 h-4 text-slate-400 ml-auto" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
          )}
        </button>
        {showChanges && (
          <div className="px-4 py-3 bg-surface-900 border-t border-slate-700 text-sm text-slate-400">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-telos-orange-400 mt-0.5">+</span>
                <span><strong className="text-slate-300">Solo 401(k) Deferral: $23,500</strong> — Up from $23,000 in 2024. Catch-up contribution for age 50+: $7,500. SECURE 2.0 super catch-up for ages 60-63: $11,250 (per Notice 2024-80).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-telos-orange-400 mt-0.5">+</span>
                <span><strong className="text-slate-300">SEP-IRA Max: $70,000</strong> — The total annual additions limit increased to $70,000 (up from $69,000). The compensation limit is $350,000.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-telos-orange-400 mt-0.5">+</span>
                <span><strong className="text-slate-300">Social Security Wage Base: $176,100</strong> — Up from $168,600 in 2024. This affects the deductible half of self-employment tax and retirement contribution calculations.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-telos-orange-400 mt-0.5">+</span>
                <span><strong className="text-slate-300">100% Bonus Depreciation Restored</strong> — Under the One Big Beautiful Bill Act, 100% first-year bonus depreciation is available again for business assets placed in service in 2025.</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      <div className="mt-6">
        {/* Health Insurance Section (Form 7206) */}
        <div className="card mb-4 bg-surface-800">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-5 h-5 text-telos-orange-400" />
            <h3 className="font-medium text-slate-200">Health Insurance Premiums</h3>
            <span className="text-xs text-slate-400">(Form 7206)</span>
          </div>

          <FormField
            label="Medical / Dental / Vision Premiums"
            helpText="Self-employed health insurance deduction (100% of premiums)"
            tooltip={help?.fields['Health Insurance Premiums']?.tooltip}
            irsRef={help?.fields['Health Insurance Premiums']?.irsRef}
          >
            <CurrencyInput
              value={showHealthDetail ? (sed.form7206?.medicalDentalVisionPremiums || 0) : sed.healthInsurancePremiums}
              onChange={(v) => {
                if (showHealthDetail) {
                  updateForm7206('medicalDentalVisionPremiums', v);
                } else {
                  update('healthInsurancePremiums', v);
                }
              }}
            />
          </FormField>

          {!showHealthDetail && (
            <button
              onClick={() => {
                setShowHealthDetail(true);
                // Initialize form7206 if not present
                if (!sed.form7206) {
                  updateField('selfEmploymentDeductions', {
                    ...sed,
                    form7206: { medicalDentalVisionPremiums: sed.healthInsurancePremiums || 0 },
                  });
                }
              }}
              className="text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors mb-2"
            >
              + Add LTC, Medicare, or monthly eligibility details
            </button>
          )}

          {showHealthDetail && (
            <>
              <FormField
                label="Long-Term Care Premiums"
                optional
                helpText={form7206
                  ? `Age-based limit: $${form7206.taxpayerLTCLimit.toLocaleString()}/person (IRC §213(d)(10))`
                  : 'Subject to age-based limits per IRC §213(d)(10)'
                }
                tooltip="Long-term care insurance premiums are deductible up to an age-based annual limit per person. The limit is per the IRS Rev. Proc. 2024-40 inflation-adjusted amounts."
              >
                <CurrencyInput
                  value={sed.form7206?.longTermCarePremiums || 0}
                  onChange={(v) => updateForm7206('longTermCarePremiums', v)}
                />
              </FormField>

              <FormField
                label="Medicare Premiums"
                optional
                helpText="Parts A, B, D, and Medicare Advantage"
                tooltip="Medicare premiums you paid for yourself, your spouse, and dependents are deductible as self-employed health insurance. This includes Parts A, B, D, and Medicare Advantage plans."
              >
                <CurrencyInput
                  value={sed.form7206?.medicarePremiums || 0}
                  onChange={(v) => updateForm7206('medicarePremiums', v)}
                />
              </FormField>

              {/* Monthly Eligibility Toggle */}
              <div className="mt-3 mb-3">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEmployerPlanGrid}
                    onChange={(e) => {
                      setShowEmployerPlanGrid(e.target.checked);
                      if (!e.target.checked) {
                        // Clear monthly eligibility when hidden
                        const current = sed.form7206 || { medicalDentalVisionPremiums: 0 };
                        const { monthlyEligibility: _, ...rest } = current;
                        updateField('selfEmploymentDeductions', { ...sed, form7206: rest });
                      }
                    }}
                    className="rounded border-slate-600 bg-surface-900 text-telos-orange-500 focus:ring-telos-orange-500"
                  />
                  Were you eligible for an employer health plan in any month of 2025?
                </label>
                <p className="text-xs text-slate-500 ml-6 mt-1">
                  Months with employer coverage are not eligible for the self-employed deduction.
                </p>
              </div>

              {showEmployerPlanGrid && (
                <div className="bg-surface-900 rounded-lg p-3 mb-3">
                  <p className="text-xs text-slate-400 mb-2">Check months when you had access to an employer-subsidized plan:</p>
                  <div className="grid grid-cols-6 gap-1 mb-2">
                    {MONTH_LABELS.map((label, idx) => (
                      <label key={idx} className="flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sed.form7206?.monthlyEligibility?.taxpayerEligibleForEmployerPlan?.[idx] || false}
                          onChange={() => toggleEmployerPlanMonth(idx, false)}
                          className="rounded border-slate-600 bg-surface-800 text-telos-orange-500 focus:ring-telos-orange-500 w-3.5 h-3.5"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {isMFJ && (
                    <>
                      <p className="text-xs text-slate-400 mb-2 mt-3">Spouse&apos;s employer plan months:</p>
                      <div className="grid grid-cols-6 gap-1">
                        {MONTH_LABELS.map((label, idx) => (
                          <label key={idx} className="flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sed.form7206?.monthlyEligibility?.spouseEligibleForEmployerPlan?.[idx] || false}
                              onChange={() => toggleEmployerPlanMonth(idx, true)}
                              className="rounded border-slate-600 bg-surface-800 text-telos-orange-500 focus:ring-telos-orange-500 w-3.5 h-3.5"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Form 7206 Live Summary */}
          {form7206 && form7206.finalDeduction > 0 && (
            <div className="bg-surface-900 rounded-lg p-3 mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Eligible months:</span>
                <span className="text-slate-200 font-mono">{form7206.eligibleMonths} of 12</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-700 pt-1 mt-1">
                <span className="text-slate-200 font-medium">SE health insurance deduction:</span>
                <span className="text-telos-orange-400 font-mono font-semibold">${form7206.finalDeduction.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Form 7206 warnings */}
          {form7206 && form7206.warnings.length > 0 && (
            <div className="mt-2">
              {form7206.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 mb-1">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
          <a href="https://www.irs.gov/forms-pubs/about-form-7206" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Form 7206 on IRS.gov</a>
        </div>

        {/* SEP-IRA Section */}
        <div className="mb-6">
          <FormField
            label="SEP-IRA Contributions"
            optional
            helpText={sepIRA
              ? `Max: $${sepIRA.maxContribution.toLocaleString()} (20% of adjusted net SE income)`
              : 'Up to 20% of adjusted net self-employment earnings'
            }
            tooltip={help?.fields['SEP-IRA Contributions']?.tooltip}
            irsRef={help?.fields['SEP-IRA Contributions']?.irsRef}
          >
            <CurrencyInput value={sed.sepIraContributions} onChange={(v) => update('sepIraContributions', v)} />
          </FormField>

          {/* SEP-IRA warnings */}
          {sepIRA && sepIRA.warnings.length > 0 && (
            <div className="mb-4 -mt-2">
              {sepIRA.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 mb-1">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
          <a href="https://www.irs.gov/retirement-plans/plan-sponsor/simplified-employee-pension-plan-sep" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 mb-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />SEP-IRA on IRS.gov</a>
        </div>

        {/* Solo 401(k) Section */}
        <div className="card mb-4 bg-surface-800">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-medium text-slate-200">Solo 401(k) Contributions</h3>
            <span className="text-xs text-slate-400">(optional)</span>
          </div>

          {/* Show adjusted net SE income context */}
          {solo401k && hasSEIncome && (
            <div className="flex items-start gap-2 text-xs text-telos-blue-400 bg-telos-blue-600/10 rounded-lg px-3 py-2 mb-4">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Adjusted net SE income: <strong>${solo401k.adjustedNetSEIncome.toLocaleString()}</strong>
                {solo401k.catchUpEligible && (
                  <>
                    {' '}&middot; {solo401k.superCatchUpEligible ? 'Super catch-up eligible (ages 60-63)' : 'Catch-up eligible (age 50+)'}:
                    {' '}+${solo401k.catchUpAmount.toLocaleString()}
                  </>
                )}
              </span>
            </div>
          )}

          <FormField
            label="Employee Deferral"
            helpText={solo401k
              ? `Max: $${solo401k.maxEmployeeDeferral.toLocaleString()}${solo401k.catchUpEligible ? ` (includes $${solo401k.catchUpAmount.toLocaleString()} catch-up)` : ''}`
              : 'Your salary deferral ($23,500 limit for 2025, plus catch-up if eligible)'
            }
            tooltip="As both employee and employer of your business, you can defer up to $23,500 of your earnings. If you're 50 or older, you can contribute an additional $7,500 catch-up. Ages 60-63 qualify for a $11,250 super catch-up under SECURE 2.0."
          >
            <CurrencyInput
              value={sed.solo401kEmployeeDeferral || 0}
              onChange={(v) => update('solo401kEmployeeDeferral', v)}
            />
          </FormField>

          <FormField
            label="Employer Contribution"
            helpText={solo401k
              ? `Max: $${solo401k.maxEmployerContribution.toLocaleString()} (20% of $${solo401k.adjustedNetSEIncome.toLocaleString()})`
              : 'Up to 20% of adjusted net self-employment income'
            }
            tooltip="As the employer, you can contribute up to 20% of your adjusted net self-employment income (net profit minus the deductible half of SE tax). The 20% effective rate accounts for the circular calculation described in IRS Publication 560."
          >
            <CurrencyInput
              value={sed.solo401kEmployerContribution || 0}
              onChange={(v) => update('solo401kEmployerContribution', v)}
            />
          </FormField>

          {/* Solo 401(k) limits summary */}
          {solo401k && (solo401k.appliedEmployeeDeferral > 0 || solo401k.appliedEmployerContribution > 0) && (
            <div className="bg-surface-900 rounded-lg p-3 mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Employee deferral (applied):</span>
                <span className="text-slate-200 font-mono">${solo401k.appliedEmployeeDeferral.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Employer contribution (applied):</span>
                <span className="text-slate-200 font-mono">${solo401k.appliedEmployerContribution.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-700 pt-1 mt-1">
                <span className="text-slate-200 font-medium">Total contribution:</span>
                <span className="text-telos-orange-400 font-mono font-semibold">${solo401k.totalContribution.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-slate-400">Annual addition limit:</span>
                <span className="text-slate-400 font-mono">${solo401k.maxTotalContribution.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Solo 401(k) warnings */}
          {solo401k && solo401k.warnings.length > 0 && (
            <div className="mt-2">
              {solo401k.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 mb-1">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Success indicator if within limits */}
          {solo401k && solo401k.totalContribution > 0 && solo401k.warnings.length === 0 && (
            <div className="flex items-start gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2 mt-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Contributions are within IRS limits.</span>
            </div>
          )}
          <a href="https://www.irs.gov/retirement-plans/one-participant-401k-plans" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Solo 401(k) on IRS.gov</a>
        </div>

        <FormField label="Other Retirement Contributions" optional helpText="SIMPLE IRA or other qualified plan contributions" tooltip={help?.fields['Other Retirement Contributions']?.tooltip} irsRef={help?.fields['Other Retirement Contributions']?.irsRef}>
          <CurrencyInput value={sed.otherRetirementContributions} onChange={(v) => update('otherRetirementContributions', v)} />
        </FormField>
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
