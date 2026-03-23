import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertBusiness } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import CardSelector from '../common/CardSelector';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Laptop, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { calculateHomeOfficeDetailed, compareHomeOfficeMethods } from '@telostax/engine';
import { HELP_CONTENT } from '../../data/helpContent';
import { validatePlacedInServiceDate } from '../../utils/dateValidation';
import CalloutCard from '../common/CalloutCard';
import StepWarningsBanner from '../common/StepWarningsBanner';

export default function HomeOfficeStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['home_office'];

  const ho = taxReturn.homeOffice || { method: null, squareFeet: 0, totalHomeSquareFeet: 0 };
  const itemized = taxReturn.itemizedDeductions;

  const [showCarryovers, setShowCarryovers] = useState(
    !!(ho.priorYearOperatingCarryover || ho.priorYearDepreciationCarryover),
  );

  const updateHO = (field: string, value: unknown) => {
    updateField('homeOffice', { ...ho, [field]: value });
  };

  // Auto-populate Tier 1 fields from Schedule A itemized deductions if available
  // and the home office field hasn't been set yet. Only when actual method is selected.
  const autoMortgage = ho.method === 'actual' ? (ho.mortgageInterest ?? itemized?.mortgageInterest) : ho.mortgageInterest;
  const autoRealEstateTax = ho.method === 'actual' ? (ho.realEstateTaxes ?? itemized?.realEstateTax) : ho.realEstateTaxes;

  // Mismatch detection for inline hints
  const mortgageMismatch = (
    ho.mortgageInterest != null && ho.mortgageInterest > 0 &&
    itemized?.mortgageInterest != null && itemized.mortgageInterest > 0 &&
    ho.mortgageInterest !== itemized.mortgageInterest
  );
  const taxMismatch = (
    ho.realEstateTaxes != null && ho.realEstateTaxes > 0 &&
    itemized?.realEstateTax != null && itemized.realEstateTax > 0 &&
    ho.realEstateTaxes !== itemized.realEstateTax
  );

  // Business percentage for display
  const businessPct = (ho.totalHomeSquareFeet && ho.totalHomeSquareFeet > 0)
    ? Math.min(1, (ho.squareFeet || 0) / ho.totalHomeSquareFeet)
    : 0;

  // Detailed calculation for the actual method (use placeholder tentative profit for preview)
  const tentativeProfitPreview = 100000; // Placeholder — actual comes from Schedule C at calculation time
  const detailedResult = ho.method === 'actual' && ho.squareFeet && ho.totalHomeSquareFeet
    ? calculateHomeOfficeDetailed(ho, tentativeProfitPreview)
    : null;

  // Method comparison — pass full ho object so actual method sees granular categories
  const comparison = ho.squareFeet
    ? compareHomeOfficeMethods(ho, tentativeProfitPreview)
    : null;

  const save = async () => {
    await upsertBusiness(returnId, { homeOffice: ho });
  };

  const f = (field: string) => help?.fields[field];

  return (
    <div>
      <StepWarningsBanner stepId="home_office" />

      <SectionIntro
        icon={<Laptop className="w-8 h-8" />}
        title="Home Office Deduction"
        description="Do you use part of your home exclusively for business? The IRS allows you to deduct a portion of your home expenses."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="mt-6">
        <FormField label="Do you have a home office?" tooltip={f('Do you have a home office?')?.tooltip}>
          <CardSelector
            options={[
              { value: 'simplified', label: 'Yes — Simplified Method', description: '$5 per sq ft, max 300 sq ft ($1,500 max). No tracking required.' },
              { value: 'actual', label: 'Yes — Actual Expenses (Form 8829)', description: 'Deduct the business-use percentage of each home expense category. Recommended for larger deductions.' },
              { value: 'none', label: 'No home office', description: 'Skip this deduction.' },
            ]}
            value={ho.method || 'none'}
            onChange={(v) => updateHO('method', v === 'none' ? null : v)}
          />
        </FormField>

        {/* ── Simplified Method ──────────────────────────────────────────── */}
        {ho.method === 'simplified' && (
          <div className="card mt-4">
            <FormField label="Office Square Footage" tooltip={f('Office Square Footage')?.tooltip} irsRef={f('Office Square Footage')?.irsRef} helpText="Max 300 sq ft for simplified method">
              <input
                type="number"
                className="input-field"
                value={ho.squareFeet || ''}
                onChange={(e) => updateHO('squareFeet', Math.min(300, parseInt(e.target.value) || 0))}
                max={300}
              />
            </FormField>
            <div className="text-sm text-telos-orange-400 mt-2">
              Deduction: ${((Math.min(ho.squareFeet || 0, 300)) * 5).toLocaleString()}
            </div>
          </div>
        )}

        {/* ── Actual Method (Form 8829) ──────────────────────────────────── */}
        {ho.method === 'actual' && (
          <>
            {/* Part I: Business Percentage */}
            <div className="card mt-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <span className="text-xs bg-telos-blue-600/30 text-telos-blue-300 px-2 py-0.5 rounded">Part I</span>
                Business Use Percentage
              </h4>
              <div className="flex gap-3">
                <div className="flex-1">
                  <FormField label="Office Square Footage" tooltip={f('Office Square Footage')?.tooltip} irsRef={f('Office Square Footage')?.irsRef}>
                    <input type="number" className="input-field" value={ho.squareFeet || ''} onChange={(e) => updateHO('squareFeet', parseInt(e.target.value) || 0)} />
                  </FormField>
                </div>
                <div className="flex-1">
                  <FormField label="Total Home Square Footage" tooltip={f('Total Home Square Footage')?.tooltip} irsRef={f('Total Home Square Footage')?.irsRef}>
                    <input type="number" className="input-field" value={ho.totalHomeSquareFeet || ''} onChange={(e) => updateHO('totalHomeSquareFeet', parseInt(e.target.value) || 0)} />
                  </FormField>
                </div>
              </div>
              {businessPct > 0 && (
                <div className="text-sm text-telos-orange-400 mt-2 font-medium">
                  Business use: {(businessPct * 100).toFixed(1)}%
                </div>
              )}
            </div>

            {/* Tier 1: Always-Deductible Expenses */}
            <div className="card mt-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                <span className="text-xs bg-green-600/30 text-green-300 px-2 py-0.5 rounded">Tier 1</span>
                Mortgage Interest, Taxes & Casualty Losses
              </h4>
              <p className="text-xs text-slate-400 mb-3">
                These would be deductible on Schedule A anyway. The business portion is always allowed, regardless of income.
              </p>
              <FormField label="Mortgage Interest" tooltip={f('Mortgage Interest')?.tooltip} irsRef={f('Mortgage Interest')?.irsRef} helpText={autoMortgage && !ho.mortgageInterest ? 'Auto-filled from Itemized Deductions' : 'Total annual mortgage interest on your home'} warning={mortgageMismatch ? `This differs from Itemized Deductions ($${itemized?.mortgageInterest?.toLocaleString()}). Both should be your total mortgage interest.` : undefined} optional>
                <CurrencyInput value={ho.mortgageInterest ?? autoMortgage} onChange={(v) => updateHO('mortgageInterest', v)} />
              </FormField>
              <FormField label="Real Estate Taxes" tooltip={f('Real Estate Taxes')?.tooltip} irsRef={f('Real Estate Taxes')?.irsRef} helpText={autoRealEstateTax && !ho.realEstateTaxes ? 'Auto-filled from Itemized Deductions' : 'Total annual property taxes'} warning={taxMismatch ? `This differs from Itemized Deductions ($${itemized?.realEstateTax?.toLocaleString()}). Both should be your total real estate taxes.` : undefined} optional>
                <CurrencyInput value={ho.realEstateTaxes ?? autoRealEstateTax} onChange={(v) => updateHO('realEstateTaxes', v)} />
              </FormField>
              <FormField label="Casualty Losses" tooltip={f('Casualty Losses')?.tooltip} irsRef={f('Casualty Losses')?.irsRef} helpText="Federally declared disasters only" optional>
                <CurrencyInput value={ho.casualtyLosses} onChange={(v) => updateHO('casualtyLosses', v)} />
              </FormField>
              {businessPct > 0 && (ho.mortgageInterest || ho.realEstateTaxes || ho.casualtyLosses) ? (
                <div className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-700/50">
                  Business portion ({(businessPct * 100).toFixed(1)}%): <span className="text-green-400 font-medium">
                    ${(((ho.mortgageInterest || 0) + (ho.realEstateTaxes || 0) + (ho.casualtyLosses || 0)) * businessPct).toFixed(0)}
                  </span>
                  <span className="text-slate-400 ml-2">— always deductible</span>
                </div>
              ) : null}
            </div>

            {/* Tier 2: Operating Expenses */}
            <div className="card mt-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                <span className="text-xs bg-amber-600/30 text-amber-300 px-2 py-0.5 rounded">Tier 2</span>
                Operating Expenses
              </h4>
              <p className="text-xs text-slate-400 mb-3">
                These are deductible up to your remaining business income after Tier 1. Excess carries forward.
              </p>
              <FormField label="Insurance" tooltip={f('Insurance')?.tooltip} irsRef={f('Insurance')?.irsRef} helpText="Homeowner's or renter's insurance" optional>
                <CurrencyInput value={ho.insurance} onChange={(v) => updateHO('insurance', v)} />
              </FormField>
              <FormField label="Utilities" tooltip={f('Utilities')?.tooltip} irsRef={f('Utilities')?.irsRef} helpText="Electric, gas, water, internet, phone" optional>
                <CurrencyInput value={ho.utilities} onChange={(v) => updateHO('utilities', v)} />
              </FormField>
              <FormField label="Repairs & Maintenance" tooltip={f('Repairs & Maintenance')?.tooltip} irsRef={f('Repairs & Maintenance')?.irsRef} helpText="General home repairs and maintenance" optional>
                <CurrencyInput value={ho.repairsAndMaintenance} onChange={(v) => updateHO('repairsAndMaintenance', v)} />
              </FormField>
              <FormField label="Rent" tooltip={f('Rent')?.tooltip} irsRef={f('Rent')?.irsRef} helpText="Annual rent if you rent your home" optional>
                <CurrencyInput value={ho.rent} onChange={(v) => updateHO('rent', v)} />
              </FormField>
              <FormField label="Other Expenses" tooltip={f('Other Expenses')?.tooltip} irsRef={f('Other Expenses')?.irsRef} helpText="HOA fees, security system, cleaning, etc." optional>
                <CurrencyInput value={ho.otherExpenses} onChange={(v) => updateHO('otherExpenses', v)} />
              </FormField>
              {businessPct > 0 && (ho.insurance || ho.utilities || ho.repairsAndMaintenance || ho.rent || ho.otherExpenses) ? (
                <div className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-700/50">
                  Business portion ({(businessPct * 100).toFixed(1)}%): <span className="text-amber-400 font-medium">
                    ${(((ho.insurance || 0) + (ho.utilities || 0) + (ho.repairsAndMaintenance || 0) + (ho.rent || 0) + (ho.otherExpenses || 0)) * businessPct).toFixed(0)}
                  </span>
                  <span className="text-slate-400 ml-2">— subject to income limit</span>
                </div>
              ) : null}
            </div>

            {/* Part III: Depreciation */}
            <div className="card mt-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded">Tier 3</span>
                Depreciation
              </h4>
              <p className="text-xs text-slate-400 mb-3">
                Depreciation is deducted last and faces the tightest income limitation. Excess carries forward to next year.
              </p>
              <FormField label="Home Cost or Value" tooltip={f('Home Cost or Value')?.tooltip} irsRef={f('Home Cost or Value')?.irsRef} helpText="Lesser of adjusted basis or FMV when first used for business" optional>
                <CurrencyInput value={ho.homeCostOrValue} onChange={(v) => updateHO('homeCostOrValue', v)} />
              </FormField>
              <FormField label="Land Value" tooltip={f('Land Value')?.tooltip} irsRef={f('Land Value')?.irsRef} helpText="Land is not depreciable — check your property tax assessment" optional>
                <CurrencyInput value={ho.landValue} onChange={(v) => updateHO('landValue', v)} />
              </FormField>
              <FormField label="Date First Used for Business" tooltip={f('Date First Used for Business')?.tooltip} irsRef={f('Date First Used for Business')?.irsRef} optional warning={validatePlacedInServiceDate(ho.dateFirstUsedForBusiness || '')}>
                <input
                  type="date"
                  className="input-field"
                  value={ho.dateFirstUsedForBusiness || ''}
                  onChange={(e) => updateHO('dateFirstUsedForBusiness', e.target.value)}
                />
              </FormField>
              {detailedResult?.depreciationComputed != null && detailedResult.depreciationComputed > 0 && (
                <div className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-700/50 flex items-center gap-1.5">
                  <Calculator className="w-3 h-3 text-telos-blue-400" />
                  <span>Computed depreciation: <span className="text-purple-400 font-medium">${detailedResult.depreciationComputed.toLocaleString()}</span></span>
                  <span className="text-slate-400 ml-1">— subject to income limit</span>
                </div>
              )}
            </div>

            {/* Part IV: Prior-Year Carryovers (collapsible) */}
            <div className="card mt-4">
              <button
                onClick={() => setShowCarryovers(!showCarryovers)}
                className="w-full flex items-center justify-between text-left"
              >
                <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <span className="text-xs bg-slate-600/30 text-slate-300 px-2 py-0.5 rounded">Part IV</span>
                  Prior-Year Carryovers
                </h4>
                {showCarryovers
                  ? <ChevronUp className="w-4 h-4 text-slate-400" />
                  : <ChevronDown className="w-4 h-4 text-slate-400" />
                }
              </button>
              {!showCarryovers && (
                <p className="text-xs text-slate-400 mt-1">
                  If you had disallowed home office expenses last year, enter the carryover amounts here.
                </p>
              )}
              {showCarryovers && (
                <div className="mt-3">
                  <FormField label="Prior Year Operating Carryover" tooltip={f('Prior Year Operating Carryover')?.tooltip} irsRef={f('Prior Year Operating Carryover')?.irsRef} helpText="From prior year Form 8829, Line 43" optional>
                    <CurrencyInput value={ho.priorYearOperatingCarryover} onChange={(v) => updateHO('priorYearOperatingCarryover', v)} />
                  </FormField>
                  <FormField label="Prior Year Depreciation Carryover" tooltip={f('Prior Year Depreciation Carryover')?.tooltip} irsRef={f('Prior Year Depreciation Carryover')?.irsRef} helpText="From prior year Form 8829, Line 44" optional>
                    <CurrencyInput value={ho.priorYearDepreciationCarryover} onChange={(v) => updateHO('priorYearDepreciationCarryover', v)} />
                  </FormField>
                </div>
              )}
            </div>

            {/* Deduction Summary (preview) */}
            {detailedResult && businessPct > 0 && (detailedResult.tier1Total || detailedResult.tier2Total || detailedResult.tier3Total) ? (
              <div className="rounded-xl border p-6 mt-4 bg-surface-900 border-telos-orange-500/30">
                <h4 className="text-sm font-semibold text-telos-orange-300 mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Deduction Preview (Form 8829)
                </h4>
                <p className="text-xs text-slate-400 mb-3">
                  Final amounts will be calculated based on your actual Schedule C income. This preview uses the three-tier cascade from IRS Publication 587.
                </p>
                <div className="space-y-1.5 text-sm font-mono">
                  {detailedResult.tier1Allowed != null && detailedResult.tier1Allowed > 0 && (
                    <div className="flex justify-between">
                      <span className="text-green-300">Tier 1 (interest, taxes)</span>
                      <span className="text-green-400">${detailedResult.tier1Allowed.toLocaleString()}</span>
                    </div>
                  )}
                  {detailedResult.tier2Total != null && detailedResult.tier2Total > 0 && (
                    <div className="flex justify-between">
                      <span className="text-amber-300">Tier 2 (operating expenses)</span>
                      <span className="text-amber-400">${(detailedResult.tier2Allowed || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {detailedResult.tier3Total != null && detailedResult.tier3Total > 0 && (
                    <div className="flex justify-between">
                      <span className="text-purple-300">Tier 3 (depreciation)</span>
                      <span className="text-purple-400">${(detailedResult.tier3Allowed || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-600 pt-1.5 mt-1.5">
                    <span className="text-slate-200 font-semibold">Estimated deduction</span>
                    <span className="text-telos-orange-400 font-bold">${detailedResult.totalDeduction.toLocaleString()}</span>
                  </div>
                  {(detailedResult.operatingExpenseCarryover || detailedResult.depreciationCarryover) ? (
                    <div className="flex justify-between text-xs text-slate-400 pt-1">
                      <span>Carryover to next year</span>
                      <span>
                        ${((detailedResult.operatingExpenseCarryover || 0) + (detailedResult.depreciationCarryover || 0)).toLocaleString()}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Method comparison */}
        {comparison && ho.method && (
          <div className="rounded-xl border p-6 mt-4 bg-telos-blue-600/10 border-telos-blue-600/30">
            <h4 className="text-sm font-medium text-telos-blue-300 mb-2">Method Comparison</h4>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-slate-400">Simplified: </span>
                <span className={ho.method === 'simplified' ? 'text-telos-orange-400 font-medium' : 'text-slate-400'}>${comparison.simplified.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400">Actual: </span>
                <span className={ho.method === 'actual' ? 'text-telos-orange-400 font-medium' : 'text-slate-400'}>${comparison.actual.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
