import { useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import {
  calculateForm1040, getStateName, isStateSupported, NO_INCOME_TAX_STATES,
  StateReturnConfig,
} from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import { MapPin, AlertTriangle, Check } from 'lucide-react';

export default function StateDetailsStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const stateReturns: StateReturnConfig[] = taxReturn.stateReturns || [];

  // Run calculation for preview
  const calcResult = useMemo(() => {
    try {
      return calculateForm1040(taxReturn);
    } catch {
      return null;
    }
  }, [taxReturn]);

  const updateStateData = (code: string, key: string, value: unknown) => {
    const newReturns = stateReturns.map((s) =>
      s.stateCode === code
        ? { ...s, stateSpecificData: { ...(s.stateSpecificData || {}), [key]: value } }
        : s,
    );
    updateField('stateReturns', newReturns);
  };

  const save = async () => {
    await updateReturn(returnId, { stateReturns: taxReturn.stateReturns });
  };

  const noIncomeTaxStates = NO_INCOME_TAX_STATES;

  // Filter to states that need details (have income tax and are supported)
  const statesNeedingDetails = stateReturns.filter(
    (sr) => !noIncomeTaxStates.includes(sr.stateCode) && isStateSupported(sr.stateCode),
  );

  const statesUnsupported = stateReturns.filter(
    (sr) => !noIncomeTaxStates.includes(sr.stateCode) && !isStateSupported(sr.stateCode),
  );

  const statesWithQuestions = statesNeedingDetails.filter(
    (sr) => ['NY', 'NJ', 'MD', 'AL', 'CA'].includes(sr.stateCode),
  );

  return (
    <div>
      <SectionIntro
        icon={<MapPin className="w-8 h-8" />}
        title="State Details"
        description={statesWithQuestions.length > 0
          ? "Let's fill in a few details for each state you're filing in."
          : "Here's a summary of your state tax estimate."}
      />

      {statesNeedingDetails.map((sr) => {
        const stateResult = calcResult?.stateResults?.find((r) => r.stateCode === sr.stateCode);

        return (
          <div key={sr.stateCode} className="card mt-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-telos-blue-600/20 flex items-center justify-center text-telos-blue-400 font-bold text-sm">
                {sr.stateCode}
              </div>
              <div>
                <h3 className="font-medium text-slate-200">{getStateName(sr.stateCode)}</h3>
                <p className="text-xs text-slate-400 capitalize">{sr.residencyType === 'resident' ? 'Full-year resident' : sr.residencyType === 'part_year' ? 'Part-year resident' : 'Nonresident'}</p>
              </div>
            </div>

            {/* State withholding info */}
            {stateResult && stateResult.stateWithholding > 0 && (
              <div className="flex items-center gap-2 mb-3 text-sm">
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">
                  ${stateResult.stateWithholding.toLocaleString()} state tax withheld (from W-2s)
                </span>
              </div>
            )}

            {/* State-specific questions */}
            {sr.stateCode === 'NY' && renderNYDetails(sr, updateStateData)}
            {sr.stateCode === 'NJ' && renderNJDetails(sr, updateStateData)}
            {sr.stateCode === 'MD' && renderMDDetails(sr, updateStateData)}
            {sr.stateCode === 'AL' && renderALDetails(sr, updateStateData)}
            {sr.stateCode === 'CA' && renderCADetails(sr, updateStateData)}

            {/* Preview estimate */}
            {stateResult && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Estimated state tax</span>
                  <span className="text-white font-medium">${stateResult.totalStateTax.toLocaleString()}</span>
                </div>
                {stateResult.stateWithholding > 0 && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-slate-400">
                      {stateResult.stateRefundOrOwed >= 0 ? 'Estimated refund' : 'Estimated owed'}
                    </span>
                    <span className={`font-medium ${stateResult.stateRefundOrOwed >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      ${Math.abs(stateResult.stateRefundOrOwed).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Unsupported states warning */}
      {statesUnsupported.length > 0 && (
        <CalloutCard variant="warning" title="State not yet supported">
          {statesUnsupported.map((s) => getStateName(s.stateCode)).join(', ')}{' '}
          {statesUnsupported.length === 1 ? 'is' : 'are'} not yet supported for automatic
          calculation. We'll show estimated federal amounts, but you may need to file state
          returns separately.
        </CalloutCard>
      )}

      {/* Nothing to configure */}
      {statesNeedingDetails.length === 0 && statesUnsupported.length === 0 && (
        <div className="card mt-4 text-center py-8">
          <Check className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">No additional state details needed</p>
          <p className="text-sm text-slate-400 mt-1">
            {stateReturns.length === 0
              ? "You haven't added any states."
              : 'Your selected states have no income tax.'}
          </p>
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}

// ─── State-Specific Detail Renderers ──────────────────────

function renderNYDetails(
  sr: StateReturnConfig,
  updateStateData: (code: string, key: string, value: unknown) => void,
) {
  const data = sr.stateSpecificData || {};
  return (
    <div className="space-y-3">
      <ToggleQuestion
        label="Do you live in New York City?"
        value={data.nycResident as boolean | undefined}
        onChange={(v) => {
          updateStateData('NY', 'nycResident', v);
          if (v) updateStateData('NY', 'yonkersResident', false);
        }}
      />
      {data.nycResident === false && (
        <ToggleQuestion
          label="Do you live in Yonkers?"
          value={data.yonkersResident as boolean | undefined}
          onChange={(v) => updateStateData('NY', 'yonkersResident', v)}
        />
      )}
      {data.nycResident === true && (
        <p className="text-xs text-slate-400 pl-1">
          NYC income tax will be calculated on top of NYS tax.
        </p>
      )}
      {data.yonkersResident === true && (
        <p className="text-xs text-slate-400 pl-1">
          Yonkers surcharge (16.535% of NYS tax) will be applied.
        </p>
      )}
    </div>
  );
}

function renderNJDetails(
  sr: StateReturnConfig,
  updateStateData: (code: string, key: string, value: unknown) => void,
) {
  const data = sr.stateSpecificData || {};
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm text-slate-300 block mb-1.5">Annual Property Tax Paid</label>
        <p className="text-xs text-slate-400 mb-2">
          NJ allows a property tax deduction up to $15,000 or a $50 credit.
        </p>
        <input
          type="number"
          className="input-field w-48"
          placeholder="$0"
          value={data.propertyTaxPaid as number || ''}
          onChange={(e) => updateStateData('NJ', 'propertyTaxPaid', Number(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}

function renderMDDetails(
  sr: StateReturnConfig,
  updateStateData: (code: string, key: string, value: unknown) => void,
) {
  const data = sr.stateSpecificData || {};
  const MD_COUNTIES = [
    { code: 'allegany', label: 'Allegany (3.05%)' },
    { code: 'anne_arundel', label: 'Anne Arundel (2.81%)' },
    { code: 'baltimore_county', label: 'Baltimore County (3.2%)' },
    { code: 'baltimore_city', label: 'Baltimore City (3.2%)' },
    { code: 'calvert', label: 'Calvert (3.0%)' },
    { code: 'caroline', label: 'Caroline (3.2%)' },
    { code: 'carroll', label: 'Carroll (3.05%)' },
    { code: 'cecil', label: 'Cecil (3.0%)' },
    { code: 'charles', label: 'Charles (3.03%)' },
    { code: 'dorchester', label: 'Dorchester (3.2%)' },
    { code: 'frederick', label: 'Frederick (3.0%)' },
    { code: 'garrett', label: 'Garrett (2.65%)' },
    { code: 'harford', label: 'Harford (3.06%)' },
    { code: 'howard', label: 'Howard (3.2%)' },
    { code: 'kent', label: 'Kent (2.85%)' },
    { code: 'montgomery', label: 'Montgomery (3.2%)' },
    { code: 'prince_georges', label: "Prince George's (3.2%)" },
    { code: 'queen_annes', label: "Queen Anne's (3.2%)" },
    { code: 'st_marys', label: "St. Mary's (3.17%)" },
    { code: 'somerset', label: 'Somerset (3.15%)' },
    { code: 'talbot', label: 'Talbot (2.4%)' },
    { code: 'washington', label: 'Washington (3.2%)' },
    { code: 'wicomico', label: 'Wicomico (3.2%)' },
    { code: 'worcester', label: 'Worcester (2.25%)' },
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm text-slate-300 block mb-1.5">Maryland County</label>
        <p className="text-xs text-slate-400 mb-2">
          Maryland levies a county income tax on top of the state tax. Select your county.
        </p>
        <select
          className="input-field w-full"
          value={(data.countyCode as string) || ''}
          onChange={(e) => updateStateData('MD', 'countyCode', e.target.value || undefined)}
        >
          <option value="">Select county (default 3.07%)</option>
          {MD_COUNTIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function renderALDetails(
  sr: StateReturnConfig,
  updateStateData: (code: string, key: string, value: unknown) => void,
) {
  const data = sr.stateSpecificData || {};
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm text-slate-300 block mb-1.5">Federal Income Tax Paid</label>
        <p className="text-xs text-slate-400 mb-2">
          Alabama uniquely allows a deduction for federal income tax paid. We'll use your calculated federal tax if not provided.
        </p>
        <input
          type="number"
          className="input-field w-48"
          placeholder="Auto-calculated"
          value={data.federalTaxPaid as number || ''}
          onChange={(e) => updateStateData('AL', 'federalTaxPaid', Number(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}

function renderCADetails(
  sr: StateReturnConfig,
  updateStateData: (code: string, key: string, value: unknown) => void,
) {
  const data = sr.stateSpecificData || {};
  return (
    <div className="space-y-3">
      <ToggleQuestion
        label="Did you rent your primary residence in California for more than 6 months?"
        value={data.isRenter as boolean | undefined}
        onChange={(v) => updateStateData('CA', 'isRenter', v)}
      />
      {data.isRenter === true && (
        <p className="text-xs text-slate-400 pl-1">
          You may qualify for the CA renter's credit ($60 single / $120 joint) if your AGI is below the threshold.
        </p>
      )}
      {/* Nonresident source income inputs */}
      {sr.residencyType === 'nonresident' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Only income earned from California sources is taxable. W-2 wages from CA employers are automatically detected.
          </p>
          <div>
            <label className="text-sm text-slate-300 block mb-1">CA-Source Business Income</label>
            <input
              type="number"
              className="input-field w-48"
              placeholder="$0"
              value={data.sourceBusinessIncome as number || ''}
              onChange={(e) => updateStateData('CA', 'sourceBusinessIncome', Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 block mb-1">CA-Source Rental Income</label>
            <input
              type="number"
              className="input-field w-48"
              placeholder="$0"
              value={data.sourceRentalIncome as number || ''}
              onChange={(e) => updateStateData('CA', 'sourceRentalIncome', Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 block mb-1">Other CA-Source Income</label>
            <input
              type="number"
              className="input-field w-48"
              placeholder="$0"
              value={data.sourceOtherIncome as number || ''}
              onChange={(e) => updateStateData('CA', 'sourceOtherIncome', Number(e.target.value) || 0)}
            />
          </div>
        </div>
      )}
      <div>
        <label className="text-sm text-slate-300 block mb-1.5">CA Estimated Tax Payments</label>
        <p className="text-xs text-slate-400 mb-2">
          Enter any estimated tax payments you made to California (Form 540-ES).
        </p>
        <input
          type="number"
          className="input-field w-48"
          placeholder="$0"
          value={data.estimatedPayments as number || ''}
          onChange={(e) => updateStateData('CA', 'estimatedPayments', Number(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────

function ToggleQuestion({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-300">{label}</span>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(true)}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            value === true
              ? 'bg-telos-blue-600 text-white'
              : 'bg-surface-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => onChange(false)}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            value === false
              ? 'bg-telos-blue-600 text-white'
              : 'bg-surface-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}
