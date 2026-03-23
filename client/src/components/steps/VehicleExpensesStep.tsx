import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertBusiness } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import CardSelector from '../common/CardSelector';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Car, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import CalloutCard from '../common/CalloutCard';
import WhatsNewCard from '../common/WhatsNewCard';
import { calculateVehicleDetailed, compareVehicleMethods } from '@telostax/engine';
import { HELP_CONTENT } from '../../data/helpContent';
import { validatePlacedInServiceDate } from '../../utils/dateValidation';
import StepWarningsBanner from '../common/StepWarningsBanner';

export default function VehicleExpensesStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  const [showDocs, setShowDocs] = useState(false);
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['vehicle_expenses'];

  const vh = taxReturn.vehicle || { method: null, businessMiles: 0, totalMiles: 0 };

  const updateVH = (field: string, value: unknown) => {
    updateField('vehicle', { ...vh, [field]: value });
  };

  // Business use percentage
  const businessPct = (vh.totalMiles && vh.totalMiles > 0)
    ? Math.min(1, (vh.businessMiles || 0) / vh.totalMiles)
    : 0;

  // Detailed calculation for preview
  const detailed = vh.method ? calculateVehicleDetailed(vh) : null;

  // Method comparison
  const comparison = (vh.businessMiles && vh.businessMiles > 0)
    ? compareVehicleMethods(vh)
    : null;

  const save = async () => {
    await upsertBusiness(returnId, { vehicle: vh });
  };

  const f = (field: string) => help?.fields[field];

  return (
    <div>
      <StepWarningsBanner stepId="vehicle_expenses" />

      <SectionIntro icon={<Car className="w-8 h-8" />} title="Vehicle Expenses" description="Did you use a vehicle for business in 2025?" />

      <WhatsNewCard items={[
        { title: 'Standard Mileage Rate: $0.70/mile', description: 'Up from $0.67/mile in 2024 (per Notice 2025-5). This rate covers gas, insurance, depreciation, and maintenance.' },
        { title: 'Medical/Moving Mileage: $0.21/mile', description: 'Unchanged from 2024 (per Notice 2025-5).' },
        { title: 'Charitable Mileage: $0.14/mile', description: 'Set by statute and unchanged.' },
        { title: '100% Bonus Depreciation Restored', description: 'Under the One Big Beautiful Bill Act, 100% first-year bonus depreciation is back for vehicles placed in service in 2025 (previously reduced to 60%).' },
      ]} />

      <CalloutCard variant="info" title="About Vehicle Expenses" irsUrl="https://www.irs.gov/publications/p463">
        You can deduct vehicle expenses using either the standard mileage rate ($0.70/mile for 2025)
        or actual expenses — but your first-year method choice is generally binding, so you cannot
        switch from actual to standard mileage for the same vehicle in later years. Commuting from
        home to a regular workplace is never deductible, though trips from a qualifying home office
        to clients or temporary work sites do count as business mileage. If you use the actual
        expense method and own the vehicle, depreciation is subject to Section 280F luxury vehicle
        limits — for 2025, the first-year limit with bonus depreciation is $20,200, though vehicles
        over 6,000 lbs GVW are exempt.
      </CalloutCard>

      <div className="mt-6">
        <FormField label="What vehicle expense method do you want to use?" tooltip={f('What vehicle expense method do you want to use?')?.tooltip}>
          <CardSelector
            options={[
              { value: 'standard_mileage', label: 'Standard Mileage', description: '$0.70 per business mile. Simpler — just track your miles.' },
              { value: 'actual', label: 'Actual Expenses', description: 'Deduct the business percentage of each vehicle cost category, plus depreciation.' },
              { value: 'none', label: 'No vehicle expenses', description: 'Skip this deduction.' },
            ]}
            value={vh.method || 'none'}
            onChange={(v) => updateVH('method', v === 'none' ? null : v)}
          />
        </FormField>

        {/* ── Standard Mileage Method ──────────────────────────────── */}
        {vh.method === 'standard_mileage' && (
          <div className="card mt-4">
            <FormField label="Business Miles Driven" tooltip={f('Business Miles Driven')?.tooltip} helpText="Don't include commuting miles" irsRef={f('Business Miles Driven')?.irsRef}>
              <input type="number" className="input-field" value={vh.businessMiles || ''} onChange={(e) => updateVH('businessMiles', parseInt(e.target.value) || 0)} />
            </FormField>
            <div className="text-sm text-telos-orange-400 mt-2">
              Deduction: ${((vh.businessMiles || 0) * 0.70).toLocaleString()}
            </div>
          </div>
        )}

        {/* ── Actual Expenses Method ───────────────────────────────── */}
        {vh.method === 'actual' && (
          <>
            {/* Card 1: Miles & Business Use */}
            <div className="card mt-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <span className="text-xs bg-telos-blue-600/30 text-telos-blue-300 px-2 py-0.5 rounded">Miles</span>
                Business Use Percentage
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Business Miles" tooltip={f('Business Miles')?.tooltip} irsRef={f('Business Miles')?.irsRef}>
                  <input type="number" className="input-field" value={vh.businessMiles || ''} onChange={(e) => updateVH('businessMiles', parseInt(e.target.value) || 0)} />
                </FormField>
                <FormField label="Total Miles" tooltip={f('Total Miles')?.tooltip} irsRef={f('Total Miles')?.irsRef}>
                  <input type="number" className="input-field" value={vh.totalMiles || ''} onChange={(e) => updateVH('totalMiles', parseInt(e.target.value) || 0)} />
                </FormField>
                <FormField label="Commute Miles" tooltip={f('Commute Miles')?.tooltip} irsRef={f('Commute Miles')?.irsRef} optional>
                  <input type="number" className="input-field" value={vh.commuteMiles ?? ''} onChange={(e) => updateVH('commuteMiles', e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value) || 0))} />
                </FormField>
                <FormField label="Other Miles" tooltip={f('Other Miles')?.tooltip} irsRef={f('Other Miles')?.irsRef} optional>
                  <input type="number" className="input-field" value={vh.otherMiles ?? ''} onChange={(e) => updateVH('otherMiles', e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value) || 0))} />
                </FormField>
              </div>
              {businessPct > 0 && (
                <div className="text-sm text-telos-orange-400 mt-2 font-medium">
                  Business use: {(businessPct * 100).toFixed(1)}%
                </div>
              )}
            </div>

            {/* Card 2: Operating Expenses */}
            <div className="card mt-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                <span className="text-xs bg-amber-600/30 text-amber-300 px-2 py-0.5 rounded">Expenses</span>
                Operating Expenses
              </h4>
              <p className="text-xs text-slate-400 mb-3">
                Enter your total annual vehicle costs. The business-use percentage ({(businessPct * 100).toFixed(1)}%) will be applied automatically.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                <FormField label="Gas & Fuel" tooltip={f('Gas & Fuel')?.tooltip} optional>
                  <CurrencyInput value={vh.gas} onChange={(v) => updateVH('gas', v)} />
                </FormField>
                <FormField label="Oil & Lubricants" tooltip={f('Oil & Lubricants')?.tooltip} optional>
                  <CurrencyInput value={vh.oilAndLubes} onChange={(v) => updateVH('oilAndLubes', v)} />
                </FormField>
                <FormField label="Repairs" tooltip={f('Repairs')?.tooltip} optional>
                  <CurrencyInput value={vh.repairs} onChange={(v) => updateVH('repairs', v)} />
                </FormField>
                <FormField label="Tires" tooltip={f('Tires')?.tooltip} optional>
                  <CurrencyInput value={vh.tires} onChange={(v) => updateVH('tires', v)} />
                </FormField>
                <FormField label="Insurance" tooltip={f('Insurance')?.tooltip} optional>
                  <CurrencyInput value={vh.insurance} onChange={(v) => updateVH('insurance', v)} />
                </FormField>
                <FormField label="Registration" tooltip={f('Registration')?.tooltip} optional>
                  <CurrencyInput value={vh.registration} onChange={(v) => updateVH('registration', v)} />
                </FormField>
                <FormField label="Licenses" tooltip={f('Licenses')?.tooltip} optional>
                  <CurrencyInput value={vh.licenses} onChange={(v) => updateVH('licenses', v)} />
                </FormField>
                <FormField label="Garage Rent" tooltip={f('Garage Rent')?.tooltip} optional>
                  <CurrencyInput value={vh.garageRent} onChange={(v) => updateVH('garageRent', v)} />
                </FormField>
                <FormField label="Tolls" tooltip={f('Tolls')?.tooltip} optional>
                  <CurrencyInput value={vh.tolls} onChange={(v) => updateVH('tolls', v)} />
                </FormField>
                <FormField label="Parking" tooltip={f('Parking')?.tooltip} optional>
                  <CurrencyInput value={vh.parking} onChange={(v) => updateVH('parking', v)} />
                </FormField>
                <FormField label="Lease Payments" tooltip={f('Lease Payments')?.tooltip} optional>
                  <CurrencyInput value={vh.leasePayments} onChange={(v) => updateVH('leasePayments', v)} />
                </FormField>
                <FormField label="Other Expenses" tooltip={f('Other Expenses')?.tooltip} optional>
                  <CurrencyInput value={vh.otherVehicleExpenses} onChange={(v) => updateVH('otherVehicleExpenses', v)} />
                </FormField>
              </div>
              {detailed && detailed.totalActualExpenses != null && detailed.totalActualExpenses > 0 && (
                <div className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-700/50">
                  Total expenses: ${detailed.totalActualExpenses.toLocaleString()}
                  {businessPct > 0 && (
                    <> &rarr; Business portion ({(businessPct * 100).toFixed(1)}%): <span className="text-amber-400 font-medium">${detailed.businessPortionExpenses?.toLocaleString()}</span></>
                  )}
                </div>
              )}
            </div>

            {/* Card 3: Depreciation (Form 4562) */}
            <div className="card mt-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded">Depreciation</span>
                Vehicle Depreciation (Form 4562)
              </h4>
              <p className="text-xs text-slate-400 mb-3">
                If you own the vehicle, you may deduct depreciation. For 2025, 100% bonus depreciation is available for vehicles placed in service this year.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                <FormField label="Vehicle Cost" tooltip={f('Vehicle Cost')?.tooltip} irsRef={f('Vehicle Cost')?.irsRef} helpText={f('Vehicle Cost')?.helpText} optional>
                  <CurrencyInput value={vh.vehicleCost} onChange={(v) => updateVH('vehicleCost', v)} />
                </FormField>
                <FormField label="Date Placed in Service" tooltip={f('Date Placed in Service')?.tooltip} irsRef={f('Date Placed in Service')?.irsRef} optional warning={validatePlacedInServiceDate(vh.dateInService || '')}>
                  <input
                    type="date"
                    className="input-field"
                    value={vh.dateInService || ''}
                    onChange={(e) => updateVH('dateInService', e.target.value)}
                  />
                </FormField>
                <FormField label="Prior Depreciation" tooltip={f('Prior Depreciation')?.tooltip} irsRef={f('Prior Depreciation')?.irsRef} helpText={f('Prior Depreciation')?.helpText} optional>
                  <CurrencyInput value={vh.priorDepreciation} onChange={(v) => updateVH('priorDepreciation', v)} />
                </FormField>
                <FormField label="Vehicle Weight" tooltip={f('Vehicle Weight')?.tooltip} irsRef={f('Vehicle Weight')?.irsRef} helpText={f('Vehicle Weight')?.helpText} optional>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="lbs"
                    value={vh.vehicleWeight || ''}
                    onChange={(e) => updateVH('vehicleWeight', parseInt(e.target.value) || 0)}
                  />
                </FormField>
              </div>
              {detailed && detailed.depreciationComputed != null && detailed.depreciationComputed > 0 && (
                <div className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-700/50 space-y-1">
                  <div className="flex justify-between">
                    <span>MACRS depreciation</span>
                    <span>${detailed.depreciationComputed.toLocaleString()}</span>
                  </div>
                  {businessPct < 1 && (
                    <div className="flex justify-between">
                      <span>Business portion ({(businessPct * 100).toFixed(1)}%)</span>
                      <span>${detailed.depreciationBusinessPortion?.toLocaleString()}</span>
                    </div>
                  )}
                  {detailed.section280FApplied && (
                    <div className="flex justify-between text-amber-400">
                      <span>Section 280F limit</span>
                      <span>-${((detailed.depreciationBusinessPortion || 0) - (detailed.depreciationAllowed || 0)).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium">
                    <span>Depreciation deduction{detailed.section280FApplied ? ' (280F limited)' : ''}</span>
                    <span className="text-purple-400">${detailed.depreciationAllowed?.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Card 4: IRS Documentation (Collapsible) */}
            <div className="card mt-4">
              <button
                onClick={() => setShowDocs(!showDocs)}
                className="w-full flex items-center gap-2 text-sm font-semibold text-slate-200"
              >
                <span className="text-xs bg-slate-600/30 text-slate-300 px-2 py-0.5 rounded">Form 4562</span>
                IRS Documentation (Part V)
                {showDocs ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
                )}
              </button>
              {showDocs && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-slate-400">
                    The IRS requires answers to these questions for vehicles used in business (Form 4562, Part V).
                  </p>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-800">
                    <div className="min-w-0">
                      <span className="text-sm text-slate-300">Available for personal use during off-duty hours?</span>
                      <p className="text-xs text-slate-400 mt-0.5">{f('Available for personal use?')?.tooltip}</p>
                    </div>
                    <button
                      onClick={() => updateVH('availableForPersonalUse', !vh.availableForPersonalUse)}
                      className={`shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors ${
                        vh.availableForPersonalUse
                          ? 'bg-telos-blue-600 text-white'
                          : 'bg-surface-800 text-slate-400'
                      }`}
                    >
                      {vh.availableForPersonalUse ? 'Yes' : 'No'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-800">
                    <div className="min-w-0">
                      <span className="text-sm text-slate-300">Was another vehicle available for personal use?</span>
                      <p className="text-xs text-slate-400 mt-0.5">Whether another vehicle was available for personal use during the year.</p>
                    </div>
                    <button
                      onClick={() => updateVH('hasAnotherVehicle', !vh.hasAnotherVehicle)}
                      className={`shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors ${
                        vh.hasAnotherVehicle
                          ? 'bg-telos-blue-600 text-white'
                          : 'bg-surface-800 text-slate-400'
                      }`}
                    >
                      {vh.hasAnotherVehicle ? 'Yes' : 'No'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-800">
                    <div className="min-w-0">
                      <span className="text-sm text-slate-300">Do you have written evidence to support your mileage?</span>
                      <p className="text-xs text-slate-400 mt-0.5">{f('Written evidence?')?.tooltip}</p>
                    </div>
                    <button
                      onClick={() => updateVH('writtenEvidence', !vh.writtenEvidence)}
                      className={`shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors ${
                        vh.writtenEvidence
                          ? 'bg-telos-blue-600 text-white'
                          : 'bg-surface-800 text-slate-400'
                      }`}
                    >
                      {vh.writtenEvidence ? 'Yes' : 'No'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-800">
                    <div className="min-w-0">
                      <span className="text-sm text-slate-300">Were records maintained at or near the time of use?</span>
                      <p className="text-xs text-slate-400 mt-0.5">Whether your mileage records were kept contemporaneously (at or near the time of each trip).</p>
                    </div>
                    <button
                      onClick={() => updateVH('writtenEvidenceContemporaneous', !vh.writtenEvidenceContemporaneous)}
                      className={`shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors ${
                        vh.writtenEvidenceContemporaneous
                          ? 'bg-telos-blue-600 text-white'
                          : 'bg-surface-800 text-slate-400'
                      }`}
                    >
                      {vh.writtenEvidenceContemporaneous ? 'Yes' : 'No'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Deduction Preview ────────────────────────────────── */}
            {detailed && detailed.totalDeduction > 0 && (
              <div className="rounded-xl border p-6 mt-4 bg-telos-orange-500/10 border-telos-orange-500/20">
                <h4 className="text-sm font-medium text-telos-orange-300 mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Deduction Preview — Actual Expenses
                </h4>
                <div className="space-y-2 text-sm">
                  {detailed.businessPortionExpenses != null && detailed.businessPortionExpenses > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Operating expenses (business portion)</span>
                      <span className="text-slate-200">${detailed.businessPortionExpenses.toLocaleString()}</span>
                    </div>
                  )}
                  {detailed.depreciationAllowed != null && detailed.depreciationAllowed > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Depreciation{detailed.section280FApplied ? ' (Section 280F limited)' : ''}
                      </span>
                      <span className="text-slate-200">${detailed.depreciationAllowed.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-telos-orange-500/20 font-medium">
                    <span className="text-telos-orange-300">Total Vehicle Deduction</span>
                    <span className="text-telos-orange-400">${detailed.totalDeduction.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Method Comparison ─────────────────────────────────── */}
        {comparison && vh.method && (
          <div className="rounded-xl border p-6 mt-4 bg-telos-blue-600/10 border-telos-blue-600/30">
            <h4 className="text-sm font-medium text-telos-blue-300 mb-2">Method Comparison</h4>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-slate-400">Standard Mileage: </span>
                <span className={vh.method === 'standard_mileage' ? 'text-telos-orange-400 font-medium' : 'text-slate-400'}>
                  ${comparison.standardMileage.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Actual: </span>
                <span className={vh.method === 'actual' ? 'text-telos-orange-400 font-medium' : 'text-slate-400'}>
                  ${comparison.actual.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
