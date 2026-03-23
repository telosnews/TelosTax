/**
 * useSensitivityData — hook for generating N-point sensitivity analysis.
 *
 * Chunks calculations across frames via requestIdleCallback to avoid
 * blocking the main thread. 100 points × ~2ms ≈ 200ms total.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { calculateForm1040, FilingStatus } from '@telostax/engine';
import type { TaxReturn, CalculationResult } from '@telostax/engine';
import { applyOverrides } from '../useScenarioLab';
import { VARIABLE_DEFINITIONS } from '../variableDefinitions';
import type { SensitivityConfig } from '../types';

export interface SensitivityDataPoint {
  input: number;
  output: number;
  delta: number;
}

interface UseSensitivityDataReturn {
  data: SensitivityDataPoint[];
  isComputing: boolean;
  progress: number; // 0-1
  currentValue: number;
  currentOutput: number;
}

export function useSensitivityData(
  taxReturn: TaxReturn,
  config: SensitivityConfig | null,
  overrides: Map<string, unknown>,
): UseSensitivityDataReturn {
  const [data, setData] = useState<SensitivityDataPoint[]>([]);
  const [isComputing, setIsComputing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Current value for the variable — read from the overridden TR, not raw
  const varDef = config ? VARIABLE_DEFINITIONS.find(v => v.key === config.variableKey) : null;
  const overriddenTr = useMemo(() => applyOverrides(taxReturn, overrides), [taxReturn, overrides]);
  const currentValue = varDef ? (varDef.read(overriddenTr) as number) : 0;

  // Compute baseline output (proper useMemo returning a value, no side effects)
  const baseCalcResult = useMemo<CalculationResult | null>(() => {
    if (!config) return null;
    try {
      return calculateForm1040({
        ...overriddenTr,
        filingStatus: overriddenTr.filingStatus || FilingStatus.Single,
      });
    } catch {
      return null;
    }
  }, [config, overriddenTr]);

  const getOutputMetric = useCallback((result: CalculationResult, metric: string): number => {
    const f = result.form1040;
    switch (metric) {
      case 'refundOrOwed': return f.refundAmount > 0 ? f.refundAmount : -f.amountOwed;
      case 'totalTax': return f.totalTax;
      case 'taxableIncome': return f.taxableIncome;
      case 'effectiveTaxRate': return f.effectiveTaxRate;
      case 'marginalTaxRate': return f.marginalTaxRate;
      default: return f.refundAmount > 0 ? f.refundAmount : -f.amountOwed;
    }
  }, []);

  const currentOutput = baseCalcResult
    ? getOutputMetric(baseCalcResult, config?.outputMetric ?? 'refundOrOwed')
    : 0;

  useEffect(() => {
    if (!config || !varDef) {
      setData([]);
      return;
    }

    // Closure-scoped cancellation flag — each effect instance gets its own,
    // preventing race conditions between overlapping async computations.
    let isCancelled = false;
    setIsComputing(true);
    setProgress(0);
    setData([]);

    const { min, max, steps } = config;
    const stepSize = (max - min) / Math.max(steps - 1, 1);
    const points: SensitivityDataPoint[] = [];
    let idx = 0;

    const CHUNK_SIZE = 10; // Calculate 10 points per idle callback

    function computeChunk(deadline?: IdleDeadline) {
      if (isCancelled) return;

      const chunkEnd = Math.min(idx + CHUNK_SIZE, steps);
      while (idx < chunkEnd && (!deadline || deadline.timeRemaining() > 2)) {
        const inputVal = min + idx * stepSize;
        const testOverrides = new Map(overrides);
        testOverrides.set(config!.variableKey, inputVal);

        try {
          const modified = applyOverrides(taxReturn, testOverrides);
          const result = calculateForm1040({
            ...modified,
            filingStatus: modified.filingStatus || FilingStatus.Single,
          });
          const output = getOutputMetric(result, config!.outputMetric);
          points.push({
            input: inputVal,
            output,
            delta: output - currentOutput,
          });
        } catch {
          points.push({ input: inputVal, output: currentOutput, delta: 0 });
        }
        idx++;
      }

      setProgress(idx / steps);

      if (idx < steps && !isCancelled) {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(computeChunk);
        } else {
          setTimeout(computeChunk, 0);
        }
      } else {
        setData([...points]);
        setIsComputing(false);
      }
    }

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(computeChunk);
    } else {
      setTimeout(computeChunk, 0);
    }

    return () => {
      isCancelled = true;
    };
  }, [config, taxReturn, overrides, varDef, getOutputMetric, currentOutput]);

  return { data, isComputing, progress, currentValue, currentOutput };
}
