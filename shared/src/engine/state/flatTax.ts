/**
 * Flat-Tax State Calculator Factory — Tax Year 2025
 *
 * Creates a generic calculator for states that levy a single flat rate on
 * taxable income. Each state's deduction / exemption rules are read from
 * the FLAT_TAX_CONSTANTS record so one code path covers PA, IL, MA, NC,
 * MI, IN, CO, KY, and UT.
 *
 * Special-case handling:
 *   - PA: No deductions or exemptions — flat 3.07% on most income.
 *   - CO: Uses federal taxable income as starting point (no further deductions).
 *   - MA: 5% flat for initial implementation. Short-term capital gains (12%)
 *         noted but not split out yet.
 *   - UT: Taxpayer credit = 6% of (federal std deduction + personal exemptions).
 */

import {
  type TaxReturn, type CalculationResult, type StateCalculationResult,
  type StateReturnConfig, type CalculationTrace, FilingStatus,
} from '../../types/index.js';
import { FLAT_TAX_CONSTANTS, MA_PERSONAL_EXEMPTION } from '../../constants/states/flatTax.js';
import { STANDARD_DEDUCTION_2025 } from '../../constants/tax2025.js';
import { STATE_FORM_REFS } from '../../constants/states/stateFormRefs.js';
import { TraceBuilder } from '../traceBuilder.js';
import { getStateWithholding, getStateFilingKey, getStateName } from './index.js';
import type { StateCalculator } from './stateRegistry.js';

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Count "persons" for exemption purposes: taxpayer + spouse (if MFJ/MFS).
 */
function countPersons(filingStatus: FilingStatus | undefined): number {
  if (
    filingStatus === FilingStatus.MarriedFilingJointly ||
    filingStatus === FilingStatus.QualifyingSurvivingSpouse
  ) {
    return 2; // Taxpayer + spouse
  }
  return 1; // Single, HoH, MFS (MFS taxpayer only)
}

/**
 * Get the federal standard deduction for the filing status.
 * Used by UT's taxpayer credit calculation.
 */
function getFederalStandardDeduction(filingStatus: FilingStatus | undefined): number {
  if (!filingStatus) return STANDARD_DEDUCTION_2025[FilingStatus.Single];
  return STANDARD_DEDUCTION_2025[filingStatus] || STANDARD_DEDUCTION_2025[FilingStatus.Single];
}

// ─── Factory ────────────────────────────────────────────────────

/**
 * Create a StateCalculator for a flat-tax state.
 *
 * @param stateCode  Two-letter state code (must exist in FLAT_TAX_CONSTANTS).
 * @returns          A StateCalculator whose `.calculate()` method performs the
 *                   full flat-tax computation.
 */
export function createFlatTaxCalculator(stateCode: string): StateCalculator {
  const config = FLAT_TAX_CONSTANTS[stateCode];
  if (!config) {
    throw new Error(`No flat-tax configuration found for state: ${stateCode}`);
  }

  return {
    calculate(
      taxReturn: TaxReturn,
      federalResult: CalculationResult,
      stateConfig: StateReturnConfig,
    ): StateCalculationResult {
      const f = federalResult.form1040;
      const filingKey = getStateFilingKey(taxReturn.filingStatus);
      const filingStatus = taxReturn.filingStatus;
      const numDependents = taxReturn.dependents?.length || 0;
      const numPersons = countPersons(filingStatus);
      const tb = new TraceBuilder();
      const sName = getStateName(stateCode);
      const refs = STATE_FORM_REFS[stateCode];

      // ── Step 1: Starting Income ──────────────────
      // CO starts from federal taxable income; all others from federal AGI.
      let startingIncome: number;
      if (config.usesFederalTaxableIncome) {
        startingIncome = f.taxableIncome;
      } else {
        startingIncome = f.agi;
      }

      // ── Step 2: Subtractions ─────────────────────
      // Most flat-tax states don't tax Social Security benefits.
      let subtractions = 0;
      if (!config.usesFederalTaxableIncome && !config.skipSocialSecuritySubtraction) {
        const ssaBenefits = federalResult.socialSecurity?.taxableBenefits || 0;
        if (ssaBenefits > 0) {
          subtractions += ssaBenefits;
        }
      }

      const stateAGI = tb.trace(
        'state.stateAGI', `${sName} Adjusted Gross Income`,
        Math.max(0, startingIncome - subtractions), {
          authority: refs?.agiLine,
          formula: subtractions > 0 ? 'Federal AGI − Subtractions' : 'Federal AGI',
          inputs: [
            { lineId: config.usesFederalTaxableIncome ? 'form1040.line15' : 'form1040.line11',
              label: config.usesFederalTaxableIncome ? 'Federal Taxable Income' : 'Federal AGI',
              value: startingIncome },
            ...(subtractions > 0 ? [{ lineId: 'state.ssSubtraction', label: 'Social Security Subtraction', value: subtractions }] : []),
          ],
        },
      );

      // ── Step 3: Deductions ───────────────────────
      const stateDeduction = config.standardDeduction[filingKey] || 0;

      // ── Step 4: Exemptions ───────────────────────
      let exemptions = 0;

      if (stateCode === 'MA') {
        // MA has filing-status-specific personal exemptions
        const maExemption = MA_PERSONAL_EXEMPTION[filingKey] || 4400;
        exemptions = maExemption + (numDependents * config.dependentExemption);
      } else if (stateCode === 'AZ' && config.agedExemption) {
        // AZ: $2,100 exemption only for filers aged 65+ (ARS §43-1023)
        let agedExemptions = 0;
        if (taxReturn.dateOfBirth) {
          const birthYear = parseInt(taxReturn.dateOfBirth.substring(0, 4), 10);
          if (!isNaN(birthYear) && (2025 - birthYear) >= 65) {
            agedExemptions += config.agedExemption;
          }
        }
        if (numPersons >= 2 && taxReturn.spouseDateOfBirth) {
          const spouseBirthYear = parseInt(taxReturn.spouseDateOfBirth.substring(0, 4), 10);
          if (!isNaN(spouseBirthYear) && (2025 - spouseBirthYear) >= 65) {
            agedExemptions += config.agedExemption;
          }
        }
        exemptions = agedExemptions;
      } else if (stateCode === 'IN') {
        // IN: $1,000 per person (taxpayer + spouse) + $1,500 per dependent
        exemptions = (numPersons * config.personalExemption) + (numDependents * config.dependentExemption);
      } else {
        // General case: personalExemption per person + dependentExemption per dependent
        exemptions = (numPersons * config.personalExemption) + (numDependents * config.dependentExemption);
      }

      // ── Step 5: Taxable Income ───────────────────
      const taxableIncome = tb.trace(
        'state.taxableIncome', `${sName} Taxable Income`,
        Math.max(0, stateAGI - stateDeduction - exemptions), {
          authority: refs?.taxableIncomeLine,
          formula: 'State AGI − Deduction − Exemptions',
          inputs: [
            { lineId: 'state.stateAGI', label: 'State AGI', value: stateAGI },
            ...(stateDeduction > 0 ? [{ lineId: 'state.deduction', label: 'Standard Deduction', value: stateDeduction }] : []),
            ...(exemptions > 0 ? [{ lineId: 'state.exemptions', label: 'Exemptions', value: exemptions }] : []),
          ],
        },
      );

      // ── Step 6: Compute Tax ──────────────────────
      let grossTax: number;
      let surtax = 0;
      let maCapGainsDetail: { ordinary: number; stCapGains: number; ltCapGains: number; collectiblesGains: number } | undefined;

      if (stateCode === 'MA' && config.shortTermCapitalGainsRate) {
        // MA splits income into Part A (5%), ST cap gains (8.5%), LT cap gains (5%),
        // and LT collectibles (12%). Deductions reduce Part A first, then cap gains.
        const schedD = federalResult.scheduleD;
        const stGains = Math.max(0, schedD?.netShortTerm || 0);
        const ltGainsTotal = Math.max(0, schedD?.netLongTerm || 0);

        // Collectibles: sum of positive LT gains on collectible assets
        const collectiblesGains = Math.min(ltGainsTotal, (taxReturn.income1099B || [])
          .filter(t => t.isCollectible && t.isLongTerm)
          .reduce((sum, t) => sum + Math.max(0, t.proceeds - (t.costBasis || 0)), 0));
        const ltNonCollectibles = ltGainsTotal - collectiblesGains;

        // Deductions reduce ordinary income first (Part A), then ST, then LT
        const totalCapGains = stGains + ltGainsTotal;
        const ordinaryAGI = Math.max(0, stateAGI - totalCapGains);
        let remaining = stateDeduction + exemptions;

        const taxableOrdinary = Math.max(0, ordinaryAGI - remaining);
        remaining = Math.max(0, remaining - ordinaryAGI);

        const taxableST = Math.max(0, stGains - remaining);
        remaining = Math.max(0, remaining - stGains);

        const taxableLTNonColl = Math.max(0, ltNonCollectibles - remaining);
        remaining = Math.max(0, remaining - ltNonCollectibles);

        const taxableColl = Math.max(0, collectiblesGains - remaining);

        const stRate = config.shortTermCapitalGainsRate;   // 8.5%
        const ltRate = config.longTermCapitalGainsRate || config.rate; // 5%
        const collRate = config.collectiblesCapitalGainsRate || 0.12;  // 12%

        grossTax = Math.round((
          taxableOrdinary * config.rate +
          taxableST * stRate +
          taxableLTNonColl * ltRate +
          taxableColl * collRate
        ) * 100) / 100;

        maCapGainsDetail = {
          ordinary: taxableOrdinary,
          stCapGains: taxableST,
          ltCapGains: taxableLTNonColl,
          collectiblesGains: taxableColl,
        };
      } else {
        grossTax = Math.round(taxableIncome * config.rate * 100) / 100;
      }

      // Millionaire surtax: additional % on taxable income over threshold
      if (config.surtax && taxableIncome > config.surtax.threshold) {
        surtax = Math.round((taxableIncome - config.surtax.threshold) * config.surtax.rate * 100) / 100;
        grossTax += surtax;
      }

      // ── Trace: Income Tax ──────────────────────
      const bracketChildren: CalculationTrace[] = [];
      if (maCapGainsDetail) {
        if (maCapGainsDetail.ordinary > 0) bracketChildren.push({ lineId: 'state.bracket.partA', label: `5.00% Part A income`, value: Math.round(maCapGainsDetail.ordinary * config.rate * 100) / 100, formula: `${maCapGainsDetail.ordinary.toLocaleString()} × 5.00%`, inputs: [] });
        if (maCapGainsDetail.stCapGains > 0) bracketChildren.push({ lineId: 'state.bracket.stCG', label: `8.50% ST cap gains`, value: Math.round(maCapGainsDetail.stCapGains * (config.shortTermCapitalGainsRate || 0.085) * 100) / 100, formula: `${maCapGainsDetail.stCapGains.toLocaleString()} × 8.50%`, inputs: [] });
        if (maCapGainsDetail.ltCapGains > 0) bracketChildren.push({ lineId: 'state.bracket.ltCG', label: `5.00% LT cap gains`, value: Math.round(maCapGainsDetail.ltCapGains * (config.longTermCapitalGainsRate || 0.05) * 100) / 100, formula: `${maCapGainsDetail.ltCapGains.toLocaleString()} × 5.00%`, inputs: [] });
        if (maCapGainsDetail.collectiblesGains > 0) bracketChildren.push({ lineId: 'state.bracket.coll', label: `12.00% collectibles`, value: Math.round(maCapGainsDetail.collectiblesGains * (config.collectiblesCapitalGainsRate || 0.12) * 100) / 100, formula: `${maCapGainsDetail.collectiblesGains.toLocaleString()} × 12.00%`, inputs: [] });
      } else if (taxableIncome > 0) {
        bracketChildren.push({ lineId: `state.bracket.flat`, label: `${(config.rate * 100).toFixed(2)}% flat rate`, value: Math.round(taxableIncome * config.rate * 100) / 100, formula: `${taxableIncome.toLocaleString()} × ${(config.rate * 100).toFixed(2)}%`, inputs: [] });
      }
      if (surtax > 0) {
        bracketChildren.push({ lineId: 'state.bracket.surtax', label: `${(config.surtax!.rate * 100).toFixed(0)}% surtax`, value: surtax, formula: `(${taxableIncome.toLocaleString()} − ${(config.surtax!.threshold as number).toLocaleString()}) × ${(config.surtax!.rate * 100).toFixed(0)}%`, inputs: [] });
      }
      tb.trace('state.incomeTax', `${sName} Income Tax`, grossTax, {
        authority: refs?.incomeTaxLine,
        formula: `${taxableIncome.toLocaleString()} × ${(config.rate * 100).toFixed(2)}%${surtax > 0 ? ' + surtax' : ''}`,
        inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
        children: bracketChildren.length > 0 ? bracketChildren : undefined,
      });

      // ── Step 7: Credits ──────────────────────────
      let stateCredits = 0;

      // UT taxpayer credit: 6% of (federal std deduction + federal personal exemptions)
      // The credit phases out at higher incomes, but for initial implementation
      // we apply it without phase-out.
      if (stateCode === 'UT' && config.taxpayerCreditRate) {
        const federalStdDed = getFederalStandardDeduction(filingStatus);
        const utCredit = Math.round(config.taxpayerCreditRate * federalStdDed * 100) / 100;
        stateCredits += utCredit;
      }

      // AZ dependent credit: $100 per child under 17, $25 per dependent 17+
      // Nonrefundable with AGI phaseout (ARS §43-1073.01)
      if (stateCode === 'AZ' && config.dependentCredit && numDependents > 0) {
        const phaseoutStart = (filingKey === 'married_joint')
          ? (config.dependentCreditPhaseout?.married_joint || 400000)
          : (config.dependentCreditPhaseout?.single || 200000);

        if (f.agi < phaseoutStart) {
          let depCredit = 0;
          for (const dep of (taxReturn.dependents || [])) {
            let age = 17; // Default to 17+ if no DOB
            if (dep.dateOfBirth) {
              const depBirthYear = parseInt(dep.dateOfBirth.substring(0, 4), 10);
              if (!isNaN(depBirthYear)) {
                age = 2025 - depBirthYear;
              }
            }
            depCredit += age < 17 ? config.dependentCredit.under17 : config.dependentCredit.age17plus;
          }
          // Nonrefundable: capped at tax liability
          stateCredits += Math.min(depCredit, grossTax);
        }
      }

      const taxAfterCredits = Math.max(0, grossTax - stateCredits);

      // ── Step 8: Withholding & Payments ───────────
      const stateWithholding = getStateWithholding(taxReturn, stateCode);
      const estimatedPayments = 0; // Could be extended later
      const totalPayments = stateWithholding + estimatedPayments;

      const totalStateTax = tb.trace(
        'state.totalTax', `${sName} Total Tax`, taxAfterCredits, {
          authority: refs?.totalTaxLine,
          formula: stateCredits > 0 ? 'Income Tax − Credits' : 'Income Tax',
          inputs: [
            { lineId: 'state.incomeTax', label: 'Income Tax', value: grossTax },
            ...(stateCredits > 0 ? [{ lineId: 'state.credits', label: 'Credits', value: stateCredits }] : []),
          ],
        },
      );

      const refundOrOwedRaw = totalPayments - totalStateTax;
      const refundOrOwed = tb.trace(
        'state.refundOrOwed',
        refundOrOwedRaw >= 0 ? `${sName} Refund` : `${sName} Amount Owed`,
        refundOrOwedRaw, {
          authority: refs?.refundLine,
          formula: 'Withholding − Total Tax',
          inputs: [
            { lineId: 'state.totalTax', label: 'Total State Tax', value: totalStateTax },
            ...(stateWithholding > 0 ? [{ lineId: 'state.withholding', label: 'Withholding', value: stateWithholding }] : []),
          ],
        },
      );

      const effectiveRate = f.agi > 0
        ? Math.round((totalStateTax / f.agi) * 10000) / 10000
        : 0;

      // ── Step 9: Bracket Details ──────────────────
      // Flat tax = single bracket for display purposes
      const bracketDetails = taxableIncome > 0
        ? [{
            rate: config.rate,
            taxableAtRate: taxableIncome,
            taxAtRate: grossTax,
          }]
        : [];

      return {
        stateCode,
        stateName: getStateName(stateCode),
        residencyType: stateConfig.residencyType,
        federalAGI: f.agi,
        stateAdditions: 0,
        stateSubtractions: subtractions,
        stateAGI,
        stateDeduction,
        stateTaxableIncome: taxableIncome,
        stateExemptions: exemptions,
        stateIncomeTax: grossTax,
        stateCredits,
        stateTaxAfterCredits: taxAfterCredits,
        localTax: 0,
        totalStateTax,
        stateWithholding,
        stateEstimatedPayments: estimatedPayments,
        stateRefundOrOwed: refundOrOwed,
        effectiveStateRate: effectiveRate,
        bracketDetails,
        additionalLines: {
          flatRate: config.rate,
          ...(stateCode === 'UT' ? { utTaxpayerCredit: stateCredits } : {}),
          ...(stateCode === 'CO' ? { usedFederalTaxableIncome: 1 } : {}),
          ...(surtax > 0 ? { surtax, surtaxThreshold: config.surtax!.threshold, surtaxRate: config.surtax!.rate } : {}),
          ...(stateCode === 'AZ' ? { agedExemption: exemptions, dependentCredit: stateCredits } : {}),
          ...(maCapGainsDetail ? {
            maOrdinaryIncome: maCapGainsDetail.ordinary,
            maSTCapGains: maCapGainsDetail.stCapGains,
            maLTCapGains: maCapGainsDetail.ltCapGains,
            maCollectiblesGains: maCapGainsDetail.collectiblesGains,
          } : {}),
        },
        traces: tb.build(),
      };
    },
  };
}
