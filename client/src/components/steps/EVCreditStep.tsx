import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertEVCredit } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import WhatsNewCard from '../common/WhatsNewCard';
import { Leaf, AlertTriangle } from 'lucide-react';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import { validateTaxYearEventDate } from '../../utils/dateValidation';
import { FilingStatus } from '@telostax/engine';

export default function EVCreditStep() {
  const { taxReturn, returnId, updateField, calculation } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['ev_credit'];

  const info = taxReturn.evCredit || {
    vehicleDescription: '',
    dateAcquired: '',
    vehicleMSRP: 0,
    purchasePrice: 0,
    isNewVehicle: true,
    isVanSUVPickup: false,
    finalAssemblyUS: true,
    meetsBatteryComponentReq: true,
    meetsMineralReq: true,
  };

  const update = (field: string, value: unknown) => {
    updateField('evCredit', { ...info, [field]: value });
  };

  const save = async () => {
    await upsertEVCredit(returnId, { ...info });
  };

  // Estimate credit
  let estimatedCredit = 0;
  if (info.isNewVehicle) {
    const mineralCredit = info.meetsMineralReq ? 3750 : 0;
    const batteryCredit = info.meetsBatteryComponentReq ? 3750 : 0;
    estimatedCredit = info.finalAssemblyUS ? mineralCredit + batteryCredit : 0;
  } else {
    estimatedCredit = Math.min(4000, Math.round(info.purchasePrice * 0.30));
  }

  return (
    <div>
      <StepWarningsBanner stepId="ev_credit" />
      <SectionIntro
        icon={<Leaf className="w-8 h-8" />}
        title="Clean Vehicle Credit"
        description="A credit for purchasing a new or previously owned electric or plug-in hybrid vehicle."
      />

      <WhatsNewCard items={[
        { title: 'New EV Credit Terminates', description: 'Under the One Big Beautiful Bill Act (P.L. 119-21), the new clean vehicle credit (Section 30D) terminates for vehicles placed in service after September 30, 2025. Vehicles acquired before that date still qualify.', marker: '⚠' },
        { title: 'Used EV Credit Terminates', description: 'The previously-owned clean vehicle credit (Section 25E) terminates for vehicles acquired after December 31, 2025.', marker: '⚠' },
      ]} />

      <CalloutCard variant="info" title="About the Clean Vehicle Credit" irsUrl="https://www.irs.gov/credits-deductions/credits-for-new-clean-vehicles-purchased-in-2023-or-after">
        {info.isNewVehicle
          ? 'The new clean vehicle credit under Section 30D provides up to $7,500 — split between $3,750 for meeting critical mineral requirements and $3,750 for meeting battery component requirements. The vehicle must be assembled in North America and have an MSRP of $55,000 or less for sedans, or $80,000 or less for vans, SUVs, and trucks. Income limits apply: $150,000 for single filers, $225,000 for head of household, and $300,000 for married filing jointly. The credit is non-refundable — it reduces your tax but not below $0.'
          : 'The previously owned clean vehicle credit under Section 25E provides the lesser of $4,000 or 30% of the purchase price. The vehicle must be purchased from a licensed dealer for $25,000 or less. Income limits apply: $75,000 for single filers, $112,500 for head of household, and $150,000 for married filing jointly. The credit is non-refundable — it reduces your tax but not below $0.'}
      </CalloutCard>

      {(() => {
        const agi = calculation?.form1040?.agi;
        if (agi == null || isNaN(agi)) return null;
        const fs = taxReturn.filingStatus;
        let limit: number;
        let limitLabel: string;
        if (info.isNewVehicle) {
          limit = fs === FilingStatus.MarriedFilingJointly || fs === FilingStatus.QualifyingSurvivingSpouse ? 300000
            : fs === FilingStatus.HeadOfHousehold ? 225000 : 150000;
          limitLabel = `$${limit.toLocaleString()}`;
        } else {
          limit = fs === FilingStatus.MarriedFilingJointly || fs === FilingStatus.QualifyingSurvivingSpouse ? 150000
            : fs === FilingStatus.HeadOfHousehold ? 112500 : 75000;
          limitLabel = `$${limit.toLocaleString()}`;
        }
        return agi > limit ? (
          <div className="mt-4 mb-2 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">Your income may exceed the limit</p>
              <p className="text-xs text-slate-400 mt-1">Your AGI is ${agi.toLocaleString()}, which exceeds the {limitLabel} income limit for {info.isNewVehicle ? 'new' : 'used'} vehicle credits based on your filing status. You may not be eligible.</p>
            </div>
          </div>
        ) : null;
      })()}

      <div className="mt-6 space-y-4">
        {/* New vs Used toggle */}
        <FormField label="Vehicle Type" tooltip={help?.fields['Vehicle Type']?.tooltip}>
          <div className="flex gap-2">
            <button
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${info.isNewVehicle ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400 hover:text-slate-200'}`}
              onClick={() => update('isNewVehicle', true)}
            >
              New Vehicle
            </button>
            <button
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${!info.isNewVehicle ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400 hover:text-slate-200'}`}
              onClick={() => update('isNewVehicle', false)}
            >
              Previously Owned
            </button>
          </div>
        </FormField>

        <FormField label="Vehicle Description" tooltip="Year, make, and model of the vehicle." optional>
          <input
            className="input-field"
            value={info.vehicleDescription || ''}
            onChange={(e) => update('vehicleDescription', e.target.value)}
            placeholder="e.g. 2025 Tesla Model 3"
          />
        </FormField>

        <FormField label="Date Acquired" tooltip="The date the vehicle was placed in service." optional warning={validateTaxYearEventDate(info.dateAcquired || '')}>
          <input
            type="date"
            className="input-field"
            value={info.dateAcquired || ''}
            onChange={(e) => update('dateAcquired', e.target.value)}
          />
        </FormField>

        {info.isNewVehicle ? (
          <>
            <FormField label="Manufacturer's Suggested Retail Price (MSRP)" tooltip="The MSRP of the vehicle. Sedans must be under $55,000; vans, SUVs, and trucks under $80,000." irsRef={help?.fields['MSRP']?.irsRef}>
              <CurrencyInput value={info.vehicleMSRP} onChange={(v) => update('vehicleMSRP', v)} />
            </FormField>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={!!info.isVanSUVPickup}
                onChange={(e) => update('isVanSUVPickup', e.target.checked)}
                className="mt-1 rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500"
              />
              <div>
                <span className="text-sm text-slate-200 group-hover:text-white">
                  Vehicle is a van, SUV, or pickup truck
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Increases the MSRP limit from $55,000 to $80,000.
                </p>
              </div>
            </label>

            <FormField label="Final Assembly in North America?" tooltip="The vehicle must undergo final assembly in North America to qualify.">
              <div className="flex gap-3">
                <button className={`py-1.5 px-4 rounded text-sm ${info.finalAssemblyUS ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('finalAssemblyUS', true)}>Yes</button>
                <button className={`py-1.5 px-4 rounded text-sm ${!info.finalAssemblyUS ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('finalAssemblyUS', false)}>No</button>
              </div>
            </FormField>

            <FormField label="Meets Critical Mineral Requirement?" tooltip="The vehicle's battery must contain a certain percentage of critical minerals extracted or processed in the US or a free trade partner.">
              <div className="flex gap-3">
                <button className={`py-1.5 px-4 rounded text-sm ${info.meetsMineralReq ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('meetsMineralReq', true)}>Yes ($3,750)</button>
                <button className={`py-1.5 px-4 rounded text-sm ${!info.meetsMineralReq ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('meetsMineralReq', false)}>No</button>
              </div>
            </FormField>

            <FormField label="Meets Battery Component Requirement?" tooltip="The vehicle's battery must contain a certain percentage of components manufactured or assembled in North America.">
              <div className="flex gap-3">
                <button className={`py-1.5 px-4 rounded text-sm ${info.meetsBatteryComponentReq ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('meetsBatteryComponentReq', true)}>Yes ($3,750)</button>
                <button className={`py-1.5 px-4 rounded text-sm ${!info.meetsBatteryComponentReq ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('meetsBatteryComponentReq', false)}>No</button>
              </div>
            </FormField>
          </>
        ) : (
          <>
            <FormField label="Purchase Price" tooltip="The price you paid. Must be $25,000 or less to qualify for the used vehicle credit." irsRef={help?.fields['Purchase Price']?.irsRef}>
              <CurrencyInput value={info.purchasePrice} onChange={(v) => update('purchasePrice', v)} />
            </FormField>
            {info.purchasePrice > 25000 && (
              <p className="text-sm text-amber-400">Purchase price exceeds the $25,000 limit for previously owned vehicles.</p>
            )}
          </>
        )}

        {estimatedCredit > 0 && (
          <div className="rounded-xl border p-6 bg-telos-orange-500/10 border-telos-orange-500/20">
            <span className="text-telos-orange-300 font-medium">
              Estimated Credit: ${estimatedCredit.toLocaleString()}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              {info.isNewVehicle
                ? 'Up to $7,500 for new vehicles ($3,750 critical minerals + $3,750 battery components)'
                : 'Up to $4,000 or 30% of purchase price (whichever is less) for used vehicles'}
            </p>
          </div>
        )}

      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
