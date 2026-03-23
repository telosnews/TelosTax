import { useState, useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import {
  getAllStates, isStateSupported, getStateName, NO_INCOME_TAX_STATES,
  StateReturnConfig, StateResidencyType,
} from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import { MapPin, Search, Plus, X, Check, AlertTriangle, ArrowRight } from 'lucide-react';

const ALL_STATES = getAllStates();

// States sorted alphabetically
const SORTED_STATES = [...ALL_STATES].sort((a, b) => a.name.localeCompare(b.name));

export default function StateOverviewStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const stateReturns: StateReturnConfig[] = taxReturn.stateReturns || [];
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [multiStateDismissed, setMultiStateDismissed] = useState(false);

  // Auto-detect state from address
  const detectedState = useMemo(() => {
    const state = taxReturn.addressState?.toUpperCase();
    if (state && state.length === 2) return state;
    return null;
  }, [taxReturn.addressState]);

  // Filter states by search
  const filteredStates = useMemo(() => {
    if (!search.trim()) return SORTED_STATES;
    const q = search.toLowerCase();
    return SORTED_STATES.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [search]);

  const addState = (code: string) => {
    if (stateReturns.some((s) => s.stateCode === code)) return;
    const newReturns: StateReturnConfig[] = [
      ...stateReturns,
      { stateCode: code, residencyType: 'resident' as StateResidencyType },
    ];
    updateField('stateReturns', newReturns);
    setAdding(false);
    setSearch('');
  };

  const removeState = (code: string) => {
    const newReturns = stateReturns.filter((s) => s.stateCode !== code);
    updateField('stateReturns', newReturns);
  };

  const updateResidency = (code: string, residency: StateResidencyType) => {
    const newReturns = stateReturns.map((s) =>
      s.stateCode === code ? { ...s, residencyType: residency } : s,
    );
    updateField('stateReturns', newReturns);
  };

  const updateStateData = (code: string, data: Record<string, unknown>) => {
    const newReturns = stateReturns.map((s) =>
      s.stateCode === code
        ? { ...s, stateSpecificData: { ...(s.stateSpecificData || {}), ...data } }
        : s,
    );
    updateField('stateReturns', newReturns);
  };

  const save = async () => {
    await updateReturn(returnId, { stateReturns: taxReturn.stateReturns });
  };

  const noIncomeTaxStates = NO_INCOME_TAX_STATES;
  const supported = isStateSupported;

  return (
    <div>
      <SectionIntro
        icon={<MapPin className="w-8 h-8" />}
        title="State Taxes"
        description="Tell us which states you need to file in. We'll calculate your state tax automatically."
      />

      {/* Auto-detect prompt */}
      {detectedState && stateReturns.length === 0 && (
        <div className="rounded-xl border p-6 mt-4 bg-telos-blue-500/5 border-telos-blue-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-telos-blue-400" />
              <div>
                <p className="text-sm text-slate-200">
                  Based on your address, it looks like you live in <strong>{getStateName(detectedState)}</strong>.
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {noIncomeTaxStates.includes(detectedState)
                    ? `${getStateName(detectedState)} has no state income tax — you may not need to file a state return.`
                    : 'Would you like to add this state?'}
                </p>
              </div>
            </div>
            {!noIncomeTaxStates.includes(detectedState) && (
              <button
                onClick={() => addState(detectedState)}
                className="btn-primary text-sm"
              >
                Add {detectedState}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Selected states */}
      {stateReturns.map((sr) => {
        const isNoTax = noIncomeTaxStates.includes(sr.stateCode);
        const isSupported = supported(sr.stateCode);
        const isNY = sr.stateCode === 'NY';

        return (
          <div key={sr.stateCode} className="card mt-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-telos-blue-600/20 flex items-center justify-center text-telos-blue-400 font-bold text-sm">
                  {sr.stateCode}
                </div>
                <div>
                  <h3 className="font-medium text-slate-200">{getStateName(sr.stateCode)}</h3>
                  {isNoTax && (
                    <p className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1">
                      <Check className="w-3 h-3" /> No state income tax
                    </p>
                  )}
                  {!isNoTax && !isSupported && (
                    <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> State calculation coming soon
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeState(sr.stateCode)}
                className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                title="Remove state"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Residency type */}
            {!isNoTax && isSupported && (
              <div className="mt-4">
                <label className="text-xs text-slate-400 mb-2 block">Residency Status</label>
                <div className="flex gap-2">
                  {(['resident', 'part_year', 'nonresident'] as StateResidencyType[]).map((rt) => (
                    <button
                      key={rt}
                      onClick={() => updateResidency(sr.stateCode, rt)}
                      className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                        sr.residencyType === rt
                          ? 'bg-telos-blue-600 text-white'
                          : 'bg-surface-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {rt === 'resident' ? 'Full-Year Resident' :
                       rt === 'part_year' ? 'Part-Year Resident' :
                       'Nonresident'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Part-year days lived input */}
            {!isNoTax && isSupported && sr.residencyType === 'part_year' && (
              <div className="mt-3">
                <label className="text-xs text-slate-400 mb-1 block">Days lived in {sr.stateCode} in {taxReturn.taxYear}</label>
                <input
                  type="number"
                  min="0"
                  max={((taxReturn.taxYear % 4 === 0 && taxReturn.taxYear % 100 !== 0) || taxReturn.taxYear % 400 === 0) ? 366 : 365}
                  className="input-field w-24"
                  value={sr.daysLivedInState || ''}
                  placeholder="182"
                  onChange={(e) => {
                    const days = parseInt(e.target.value) || 0;
                    const newReturns = stateReturns.map((s) =>
                      s.stateCode === sr.stateCode ? { ...s, daysLivedInState: days } : s,
                    );
                    updateField('stateReturns', newReturns);
                  }}
                />
                <p className="text-xs text-slate-500 mt-1">Your tax will be prorated based on the portion of the year you lived in the state.</p>
              </div>
            )}

            {/* NY-specific questions */}
            {isNY && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Do you live in New York City?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        updateStateData('NY', { nycResident: true, yonkersResident: false });
                      }}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        sr.stateSpecificData?.nycResident === true
                          ? 'bg-telos-blue-600 text-white'
                          : 'bg-surface-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => updateStateData('NY', { nycResident: false })}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        sr.stateSpecificData?.nycResident === false
                          ? 'bg-telos-blue-600 text-white'
                          : 'bg-surface-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
                {sr.stateSpecificData?.nycResident === false && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Do you live in Yonkers?</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStateData('NY', { yonkersResident: true })}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                          sr.stateSpecificData?.yonkersResident === true
                            ? 'bg-telos-blue-600 text-white'
                            : 'bg-surface-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => updateStateData('NY', { yonkersResident: false })}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                          sr.stateSpecificData?.yonkersResident === false
                            ? 'bg-telos-blue-600 text-white'
                            : 'bg-surface-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Multi-state guided prompt — shows after first state is added */}
      {stateReturns.length >= 1 && !adding && !multiStateDismissed && (
        <div className="rounded-xl border p-6 mt-4 bg-amber-500/5 border-amber-500/20">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-slate-200 font-medium">
                Did you live in or earn income from another state in 2025?
              </p>
              <p className="text-xs text-slate-400 mt-1">
                If you moved between states, worked remotely for an out-of-state employer, or earned rental/business income in another state, you may need to file additional state returns.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setAdding(true); setMultiStateDismissed(true); }}
                  className="btn-primary text-sm flex items-center gap-1.5"
                >
                  Yes, add another state <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setMultiStateDismissed(true)}
                  className="px-4 py-2 text-sm rounded-lg bg-surface-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  No, just {stateReturns.length === 1 ? getStateName(stateReturns[0].stateCode) : 'these states'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add state button + search */}
      {adding ? (
        <div className="card mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              className="input-field flex-1"
              placeholder="Search by state name or abbreviation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <button onClick={() => { setAdding(false); setSearch(''); }} className="p-2 text-slate-400 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredStates.map((state) => {
              const alreadyAdded = stateReturns.some((s) => s.stateCode === state.code);
              return (
                <button
                  key={state.code}
                  onClick={() => !alreadyAdded && addState(state.code)}
                  disabled={alreadyAdded}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                    alreadyAdded
                      ? 'text-slate-600 cursor-not-allowed'
                      : 'text-slate-300 hover:bg-surface-700 cursor-pointer'
                  }`}
                >
                  <span>
                    <span className="font-medium">{state.code}</span>
                    <span className="text-slate-400 ml-2">{state.name}</span>
                  </span>
                  <span className="text-xs">
                    {alreadyAdded && <span className="text-telos-blue-400">Added</span>}
                    {!alreadyAdded && !state.hasIncomeTax && <span className="text-emerald-500">No income tax</span>}
                    {!alreadyAdded && state.hasIncomeTax && !isStateSupported(state.code) && (
                      <span className="text-slate-400">Coming soon</span>
                    )}
                    {!alreadyAdded && state.hasIncomeTax && isStateSupported(state.code) && (
                      <span className="text-telos-blue-400">Supported</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full mt-4 py-3 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-telos-blue-500/50 hover:text-telos-blue-400 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          {stateReturns.length === 0 ? 'Add a State' : 'Add Another State'}
        </button>
      )}

      {/* No income tax callout */}
      {stateReturns.length === 0 && !adding && (
        <div className="mt-4">
          <CalloutCard variant="tip" title="No state income tax?">
            If you live in Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas, Washington, or Wyoming,
            you don't need to file a state income tax return. You can skip this section.
          </CalloutCard>
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
