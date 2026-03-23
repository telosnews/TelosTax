import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { Heart, AlertTriangle, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import type { Form7206Input, Form7206MonthlyEligibility } from '@telostax/engine';

export default function SEHealthInsuranceStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  const calculation = useTaxReturnStore((s) => s.calculation);
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['se_health_insurance'];

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

  const form7206 = calculation?.form7206;

  const update = (field: string, value: number) => {
    const updated = { ...sed, [field]: value };
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

  return (
    <div>
      <StepWarningsBanner stepId="se_health_insurance" />
      <SectionIntro
        icon={<Heart className="w-8 h-8" />}
        title="Self-Employed Health Insurance"
        description="Deduct premiums for medical, dental, vision, LTC, and Medicare — 100% above-the-line deduction."
      />

      <CalloutCard variant="info" title="Who qualifies for this deduction?" irsUrl="https://www.irs.gov/forms-pubs/about-form-7206">
        You can deduct 100% of health insurance premiums paid for yourself, your spouse, and dependents — but only for months you were not eligible for an employer-subsidized plan. The deduction cannot exceed your net self-employment income.
      </CalloutCard>

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
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
