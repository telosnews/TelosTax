/**
 * Self-Employed Retirement Plans step.
 *
 * Split from SEDeductionsStep. Covers SEP-IRA, Solo 401(k) (with Roth tracking,
 * SIMPLE IRA coordination, cross-plan §415(c), and Form 5500-EZ), SIMPLE IRA,
 * and Other Retirement Contributions. All deduct on Schedule 1, Line 16.
 */
import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { PiggyBank, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp, ExternalLink, FileWarning } from 'lucide-react';
import WhatsNewCard from '../common/WhatsNewCard';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';

const FORM_5500_EZ_THRESHOLD = 250000;

export default function SERetirementStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  const calculation = useTaxReturnStore((s) => s.calculation);
  const [showPlanDetails, setShowPlanDetails] = useState(false);
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['se_retirement'];

  const sed = taxReturn.selfEmploymentDeductions || {
    healthInsurancePremiums: 0,
    sepIraContributions: 0,
    solo401kEmployeeDeferral: 0,
    solo401kEmployerContribution: 0,
    solo401kRothDeferral: 0,
    solo401kContributions: 0,
    simpleIraContributions: 0,
    otherRetirementContributions: 0,
  };

  const solo401k = calculation?.solo401k;
  const sepIRA = calculation?.sepIRA;
  const hasSEIncome = (calculation?.scheduleC?.netProfit || 0) > 0;
  const planBalance = sed.solo401kPlanBalance || 0;
  const needs5500EZ = planBalance > FORM_5500_EZ_THRESHOLD;

  const update = (field: string, value: number | string) => {
    const updated = { ...sed, [field]: value };
    // Sync the backward-compat solo401kContributions with the split fields
    if (field === 'solo401kEmployeeDeferral' || field === 'solo401kEmployerContribution') {
      const empDef = field === 'solo401kEmployeeDeferral' ? (value as number) : (updated.solo401kEmployeeDeferral || 0);
      const empCon = field === 'solo401kEmployerContribution' ? (value as number) : (updated.solo401kEmployerContribution || 0);
      updated.solo401kContributions = empDef + empCon;
    }
    updateField('selfEmploymentDeductions', updated);
  };

  const save = async () => {
    await updateReturn(returnId, { selfEmploymentDeductions: sed });
  };

  // Mutual exclusivity warning: SEP-IRA + Solo 401(k) for same business
  const hasBothSEPAndSolo = (sed.sepIraContributions || 0) > 0 &&
    ((sed.solo401kEmployeeDeferral || 0) > 0 || (sed.solo401kEmployerContribution || 0) > 0);

  return (
    <div>
      <StepWarningsBanner stepId="se_retirement" />
      <SectionIntro
        icon={<PiggyBank className="w-8 h-8" />}
        title="Self-Employed Retirement Plans"
        description="Retirement contributions are above-the-line deductions on Schedule 1, Line 16. They reduce your AGI dollar-for-dollar."
      />

      <WhatsNewCard items={[
        { title: 'Solo 401(k) Deferral: $23,500', description: 'Up from $23,000 in 2024. Catch-up for 50+: $7,500. SECURE 2.0 super catch-up for ages 60-63: $11,250.' },
        { title: 'Annual Addition Limit: $70,000', description: 'Up from $69,000. Applies to combined employee + employer contributions (catch-up excluded).' },
        { title: 'SEP-IRA Max: $70,000', description: 'Same $70,000 limit. Compensation cap: $350,000.' },
        { title: 'SIMPLE IRA: $16,500', description: 'Up from $16,000. Catch-up 50+: $3,500. Super catch-up 60-63: $5,250.' },
      ]} />

      <CalloutCard variant="info" title="Self-employed retirement options" irsUrl="https://www.irs.gov/retirement-plans/retirement-plans-for-self-employed-people">
        Self-employed retirement contributions are among the most powerful tax deductions available. SEP-IRAs allow up to 25% of net self-employment earnings (max $70,000 for 2025). Solo 401(k) plans allow both employee deferrals ($23,500 plus $7,500 catch-up if 50+) and employer contributions. All contributions are deducted on Schedule 1, Line 16.
      </CalloutCard>

      {/* Mutual exclusivity warning */}
      {hasBothSEPAndSolo && (
        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            You have contributions to both a SEP-IRA and Solo 401(k) for the same business.
            These are aggregated under IRC &sect;415(c) &mdash; combined employer contributions cannot exceed $70,000 (or 100% of compensation).
            Most self-employed individuals use one plan or the other.
          </span>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* ─── SEP-IRA Section ─────────────────────── */}
        <div>
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
          <a href="https://www.irs.gov/retirement-plans/plan-sponsor/simplified-employee-pension-plan-sep" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />SEP-IRA on IRS.gov</a>
        </div>

        {/* ─── Solo 401(k) Section ─────────────────── */}
        <div className="card bg-surface-800">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-medium text-slate-200">Solo 401(k) Contributions</h3>
            <span className="text-xs text-slate-400">(optional)</span>
          </div>

          {/* Adjusted net SE income context */}
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
            label="Employee Deferral (Traditional + Roth)"
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

          {/* Roth portion sub-field */}
          {(sed.solo401kEmployeeDeferral || 0) > 0 && (
            <div className="ml-6 -mt-2 mb-3">
              <FormField
                label="Roth portion"
                optional
                helpText="Roth deferrals are after-tax (not deductible) but grow tax-free. Leave at $0 for all-traditional."
              >
                <CurrencyInput
                  value={sed.solo401kRothDeferral || 0}
                  onChange={(v) => update('solo401kRothDeferral', v)}
                />
              </FormField>
              {(sed.solo401kRothDeferral || 0) > (sed.solo401kEmployeeDeferral || 0) && (
                <p className="text-xs text-amber-400 -mt-1">Roth portion cannot exceed your employee deferral.</p>
              )}
            </div>
          )}

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
              {solo401k.appliedRothDeferral > 0 && (
                <div className="flex justify-between text-xs mb-1 ml-4">
                  <span className="text-slate-500">of which Roth (not deductible):</span>
                  <span className="text-slate-400 font-mono">${solo401k.appliedRothDeferral.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Employer contribution (applied):</span>
                <span className="text-slate-200 font-mono">${solo401k.appliedEmployerContribution.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-700 pt-1 mt-1">
                <span className="text-slate-200 font-medium">Total contribution:</span>
                <span className="text-telos-orange-400 font-mono font-semibold">${solo401k.totalContribution.toLocaleString()}</span>
              </div>
              {solo401k.appliedRothDeferral > 0 && (
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-slate-400">Deductible amount (Schedule 1):</span>
                  <span className="text-slate-400 font-mono">${solo401k.deductibleContribution.toLocaleString()}</span>
                </div>
              )}
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

          {solo401k && solo401k.totalContribution > 0 && solo401k.warnings.length === 0 && (
            <div className="flex items-start gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2 mt-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Contributions are within IRS limits.</span>
            </div>
          )}

          {/* ─── Plan Balance & Form 5500-EZ ─────── */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <button
              onClick={() => setShowPlanDetails(!showPlanDetails)}
              className="text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              {showPlanDetails ? '- Hide' : '+ Show'} plan balance &amp; Form 5500-EZ details
            </button>

            {showPlanDetails && (
              <div className="mt-3 space-y-3">
                <FormField
                  label="Plan Balance (End of Year)"
                  optional
                  helpText={needs5500EZ
                    ? 'Exceeds $250,000 — Form 5500-EZ filing is required!'
                    : 'If total plan assets exceed $250,000, you must file Form 5500-EZ'
                  }
                >
                  <CurrencyInput
                    value={planBalance}
                    onChange={(v) => update('solo401kPlanBalance', v)}
                  />
                </FormField>

                {needs5500EZ && (
                  <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <FileWarning className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-400 mb-2">Form 5500-EZ Required</p>
                        <p className="text-xs text-slate-300 mb-2">
                          Your Solo 401(k) plan assets exceed $250,000. You must file Form 5500-EZ with the IRS.
                        </p>
                        <ul className="text-xs text-slate-400 space-y-1 mb-3">
                          <li><strong className="text-slate-300">Due date:</strong> July 31 (for calendar-year plans), extendable via Form 5558</li>
                          <li><strong className="text-red-400">Penalty for failure to file:</strong> $250 per day, up to $150,000 per plan year</li>
                          <li><strong className="text-slate-300">Filed separately</strong> from your Form 1040 (different deadline)</li>
                        </ul>

                        <FormField label="Plan Balance (Start of Year)" optional>
                          <CurrencyInput
                            value={sed.solo401kPlanStartBalance || 0}
                            onChange={(v) => update('solo401kPlanStartBalance', v)}
                          />
                        </FormField>
                        <FormField label="Distributions During Year" optional>
                          <CurrencyInput
                            value={sed.solo401kPlanDistributions || 0}
                            onChange={(v) => update('solo401kPlanDistributions', v)}
                          />
                        </FormField>
                        <FormField label="Plan Name" optional helpText='e.g., "John Smith Solo 401(k)"'>
                          <input
                            type="text"
                            value={sed.solo401kPlanName || ''}
                            onChange={(e) => update('solo401kPlanName', e.target.value)}
                            className="input-field"
                            placeholder="My Solo 401(k) Plan"
                          />
                        </FormField>
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Plan Number" optional helpText="3-digit (typically 001)">
                            <input
                              type="text"
                              value={sed.solo401kPlanNumber || ''}
                              onChange={(e) => update('solo401kPlanNumber', e.target.value)}
                              className="input-field"
                              placeholder="001"
                              maxLength={3}
                            />
                          </FormField>
                          <FormField label="Employer EIN" optional helpText="Your business EIN (or SSN)">
                            <input
                              type="text"
                              value={sed.solo401kPlanEIN || ''}
                              onChange={(e) => update('solo401kPlanEIN', e.target.value)}
                              className="input-field"
                              placeholder="XX-XXXXXXX"
                            />
                          </FormField>
                        </div>
                        <a href="https://www.irs.gov/forms-pubs/about-form-5500-ez" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Form 5500-EZ on IRS.gov</a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <a href="https://www.irs.gov/retirement-plans/one-participant-401k-plans" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Solo 401(k) on IRS.gov</a>
        </div>

        {/* ─── SIMPLE IRA Section ──────────────────── */}
        <div>
          <FormField
            label="SIMPLE IRA Employee Deferrals"
            optional
            helpText="Self-employed SIMPLE IRA elective deferrals ($16,500 limit for 2025). These aggregate with 401(k) deferrals under §402(g)."
            tooltip="If you maintain a SIMPLE IRA plan for your business, your employee deferrals are limited to $16,500 for 2025. Catch-up for age 50+: $3,500. Super catch-up for ages 60-63: $5,250. These deferrals are also coordinated with any Solo 401(k) deferrals under the §402(g) limit."
          >
            <CurrencyInput
              value={sed.simpleIraContributions || 0}
              onChange={(v) => update('simpleIraContributions', v)}
            />
          </FormField>
          {(sed.simpleIraContributions || 0) > 0 && (
            <a href="https://www.irs.gov/retirement-plans/plan-sponsor/simple-ira-plan" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />SIMPLE IRA on IRS.gov</a>
          )}
        </div>

        {/* ─── Other Retirement Contributions ──────── */}
        <FormField
          label="Other Retirement Contributions"
          optional
          helpText="Other qualified plan contributions (e.g., defined benefit plan)"
          tooltip={help?.fields['Other Retirement Contributions']?.tooltip}
          irsRef={help?.fields['Other Retirement Contributions']?.irsRef}
        >
          <CurrencyInput value={sed.otherRetirementContributions} onChange={(v) => update('otherRetirementContributions', v)} />
        </FormField>
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
