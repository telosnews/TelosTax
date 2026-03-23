/**
 * QuickPresets — one-click template buttons that apply common scenario overrides.
 *
 * Each preset shows an estimated delta badge computed from the base calculation.
 */

import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { calculateForm1040, FilingStatus, IRA, HSA, SOLO_401K } from '@telostax/engine';
import type { TaxReturn, CalculationResult } from '@telostax/engine';
import { getAgeAtEndOfYear } from '../../utils/dateValidation';
import type { QuickPreset, Scenario, ScenarioLabAction } from './types';
import { applyOverrides } from './useScenarioLab';

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

function buildPresets(tr: TaxReturn): QuickPreset[] {
  const age = getAgeAtEndOfYear(tr.dateOfBirth, tr.taxYear);
  const is50Plus = age !== undefined && age >= 50;
  const is55Plus = age !== undefined && age >= 55;
  const iraMax = IRA.MAX_CONTRIBUTION + (is50Plus ? IRA.CATCH_UP_50_PLUS : 0);
  const coverage = tr.hsaContribution?.coverageType || 'self_only';
  const hsaMax = (coverage === 'family' ? HSA.FAMILY_LIMIT : HSA.INDIVIDUAL_LIMIT) +
    (is55Plus ? HSA.CATCH_UP_55_PLUS : 0);
  const hasSE = (tr.income1099NEC?.length > 0) || (tr.income1099K?.length > 0) || (tr.businesses?.length > 0);
  const solo401kMax = SOLO_401K.EMPLOYEE_DEFERRAL_LIMIT + (is50Plus ? SOLO_401K.CATCH_UP_50_PLUS : 0);

  const presets: QuickPreset[] = [
    {
      id: 'max_retirement',
      label: 'Max Retirement',
      description: 'Max out IRA + HSA' + (hasSE ? ' + Solo 401(k)' : ''),
      getOverrides: () => {
        const overrides = new Map<string, unknown>();
        overrides.set('ira_contribution', iraMax);
        overrides.set('hsa_contribution', hsaMax);
        if (hasSE) overrides.set('solo_401k', solo401kMax);
        return overrides;
      },
    },
    {
      id: 'extra_10k',
      label: 'Extra $10k Income',
      description: 'Add $10,000 in additional wages',
      getOverrides: () => {
        const overrides = new Map<string, unknown>();
        const currentWages = tr.w2Income?.[0]?.wages ?? 0;
        overrides.set('w2_wages', currentWages + 10_000);
        return overrides;
      },
    },
    {
      id: 'switch_deduction',
      label: tr.deductionMethod === 'itemized' ? 'Try Standard' : 'Try Itemized',
      description: tr.deductionMethod === 'itemized' ? 'Switch to standard deduction' : 'Switch to itemized deductions',
      getOverrides: () => {
        const overrides = new Map<string, unknown>();
        overrides.set('deduction_method', tr.deductionMethod === 'itemized' ? 'standard' : 'itemized');
        return overrides;
      },
    },
  ];

  // Add filing status preset if applicable
  if (tr.filingStatus === FilingStatus.Single && (tr.dependents?.length ?? 0) > 0) {
    presets.push({
      id: 'filing_hoh',
      label: 'Head of Household',
      description: 'Try filing as Head of Household',
      getOverrides: () => {
        const overrides = new Map<string, unknown>();
        overrides.set('filing_status', String(FilingStatus.HeadOfHousehold));
        return overrides;
      },
    });
  }

  if (tr.filingStatus === FilingStatus.MarriedFilingSeparately) {
    presets.push({
      id: 'filing_mfj',
      label: 'File Jointly',
      description: 'Try filing as Married Filing Jointly',
      getOverrides: () => {
        const overrides = new Map<string, unknown>();
        overrides.set('filing_status', String(FilingStatus.MarriedFilingJointly));
        return overrides;
      },
    });
  }

  return presets;
}

// ---------------------------------------------------------------------------
// Delta badge helper
// ---------------------------------------------------------------------------

function estimateDelta(tr: TaxReturn, baseResult: CalculationResult, overrides: Map<string, unknown>): number | null {
  try {
    const modified = applyOverrides(tr, overrides);
    const result = calculateForm1040({
      ...modified,
      filingStatus: modified.filingStatus || FilingStatus.Single,
    });
    const baseNet = baseResult.form1040.refundAmount > 0 ? baseResult.form1040.refundAmount : -baseResult.form1040.amountOwed;
    const scenNet = result.form1040.refundAmount > 0 ? result.form1040.refundAmount : -result.form1040.amountOwed;
    return scenNet - baseNet;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface QuickPresetsProps {
  taxReturn: TaxReturn;
  baseResult: CalculationResult;
  activeScenarioId: string | null;
  dispatch: React.Dispatch<ScenarioLabAction>;
}

export default function QuickPresets({ taxReturn, baseResult, activeScenarioId, dispatch }: QuickPresetsProps) {
  const presets = useMemo(() => buildPresets(taxReturn), [taxReturn]);

  const presetDeltas = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const p of presets) {
      map.set(p.id, estimateDelta(taxReturn, baseResult, p.getOverrides(taxReturn)));
    }
    return map;
  }, [taxReturn, baseResult, presets]);

  if (!activeScenarioId) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Zap className="w-3.5 h-3.5 text-telos-orange-400" />
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Quick Presets</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map(p => {
          const delta = presetDeltas.get(p.id);
          return (
            <button
              key={p.id}
              onClick={() => dispatch({
                type: 'APPLY_PRESET',
                scenarioId: activeScenarioId,
                overrides: p.getOverrides(taxReturn),
              })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-800 border border-slate-700/50 hover:border-telos-orange-500/40 hover:bg-telos-orange-500/5 transition-colors"
              title={p.description}
            >
              <span className="text-slate-200">{p.label}</span>
              {delta != null && Math.abs(delta) >= 1 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  delta > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {delta > 0 ? '+' : '-'}${Math.abs(Math.round(delta)).toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
