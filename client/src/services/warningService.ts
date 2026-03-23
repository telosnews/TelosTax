/**
 * Centralized warning computation service.
 *
 * Pure function that evaluates all saved tax return data and returns
 * a structured list of active validation warnings grouped by wizard step.
 *
 * Reuses existing validators from dateValidation.ts — no duplicated logic.
 *
 * HOW TO ADD A NEW WARNING:
 * 1. Add a validation function to dateValidation.ts (or inline if simple)
 * 2. Add a new section in getActiveWarnings() below, before the "Group by step" block
 * 3. Push to the `warnings` array with the correct stepId (must match WIZARD_STEPS id)
 * 4. For array items (e.g. W-2s), use forEach and include itemIndex + itemLabel
 * 5. That's it — sidebar dots and review card pick it up automatically
 *
 * Example — flag W-2 withholding that exceeds wages:
 *   (taxReturn.w2Income || []).forEach((w2, idx) => {
 *     if (w2.federalTaxWithheld > w2.wages) {
 *       warnings.push({
 *         stepId: 'w2_income',
 *         field: `w2Income[${idx}].federalTaxWithheld`,
 *         message: 'Federal tax withheld exceeds wages — please verify.',
 *         itemIndex: idx,
 *         itemLabel: w2.employerName || `W-2 ${idx + 1}`,
 *       });
 *     }
 *   });
 */

import type { TaxReturn, CalculationResult } from '@telostax/engine';
import { checkPlausibility, FilingStatus, SANCTIONED_COUNTRIES, QCD } from '@telostax/engine';
import {
  validateDateOfBirth,
  validateSaleDate,
  validateAcquiredDate,
  validateHoldingPeriod,
  validateContributionDate,
  validateTaxYearEventDate,
  validateDivorceDate,
  validateDeathDate,
  validatePlacedInServiceDate,
  isAge65OrOlder,
  getAgeAtEndOfYear,
} from '../utils/dateValidation';
import { WIZARD_STEPS } from '../store/taxReturnStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationWarning {
  stepId: string;        // wizard step id, e.g. '1099b_income'
  field: string;         // path, e.g. 'income1099B[2].dateSold'
  message: string;       // human-readable warning text
  itemIndex?: number;    // index within an array (for per-item warnings)
  itemLabel?: string;    // human-readable item label, e.g. "Fidelity" or "Bitcoin"
}

export interface WarningsByStep {
  stepId: string;
  stepLabel: string;     // from WIZARD_STEPS, e.g. "Capital Gains (1099-B)"
  warnings: ValidationWarning[];
}

// ---------------------------------------------------------------------------
// Proximity helper
// ---------------------------------------------------------------------------

/**
 * Check if a value is approaching a threshold from below.
 * Returns true when value is within the band (e.g., within 10% of threshold).
 * Used for percentage-based proximity alerts per reviewer guidance.
 */
function isApproaching(current: number, threshold: number, bandPercent: number = 0.10): boolean {
  return current > threshold * (1 - bandPercent) && current <= threshold;
}

// ---------------------------------------------------------------------------
// Core service
// ---------------------------------------------------------------------------

/**
 * Compute all active validation warnings for a tax return.
 * Pure function — no side effects, deterministic output.
 *
 * When a CalculationResult is provided, also runs plausibility checks
 * (e.g., W-2 wages > $1M, charitable > 50% of AGI). These are
 * WARN-level checks that never block calculation.
 */
export function getActiveWarnings(taxReturn: TaxReturn, calculation?: CalculationResult | null): WarningsByStep[] {
  const warnings: ValidationWarning[] = [];

  // ── Personal Info: filer DOB ──────────────────────────────────────────
  if (taxReturn.dateOfBirth) {
    const w = validateDateOfBirth(taxReturn.dateOfBirth);
    if (w) {
      warnings.push({ stepId: 'personal_info', field: 'dateOfBirth', message: w });
    }
  }

  // ── Filing Status: spouse DOB ─────────────────────────────────────────
  if (taxReturn.spouseDateOfBirth) {
    const w = validateDateOfBirth(taxReturn.spouseDateOfBirth);
    if (w) {
      warnings.push({ stepId: 'filing_status', field: 'spouseDateOfBirth', message: w });
    }
  }

  // ── Dependents: DOB, SSN, residency, relationship, duplicates ────────
  const depSSNs = new Map<string, number>();
  (taxReturn.dependents || []).forEach((dep, idx) => {
    const depLabel = [dep.firstName, dep.lastName].filter(Boolean).join(' ') || `Dependent ${idx + 1}`;

    // DOB validation
    if (dep.dateOfBirth) {
      const w = validateDateOfBirth(dep.dateOfBirth);
      if (w) {
        warnings.push({
          stepId: 'dependents',
          field: `dependents[${idx}].dateOfBirth`,
          message: w,
          itemIndex: idx,
          itemLabel: depLabel,
        });
      }
    }

    // SSN missing — needed for CTC/EITC claims
    if (!dep.ssn && !dep.ssnLastFour) {
      warnings.push({
        stepId: 'dependents',
        field: `dependents[${idx}].ssn`,
        message: `${depLabel} has no SSN entered. An SSN (or ITIN) is required to claim the dependent on your return and for tax credits like the Child Tax Credit.`,
        itemIndex: idx,
        itemLabel: depLabel,
      });
    }

    // Duplicate SSN check
    if (dep.ssn && dep.ssn.length >= 9) {
      const prev = depSSNs.get(dep.ssn);
      if (prev !== undefined) {
        const prevLabel = [taxReturn.dependents[prev].firstName, taxReturn.dependents[prev].lastName].filter(Boolean).join(' ') || `Dependent ${prev + 1}`;
        warnings.push({
          stepId: 'dependents',
          field: `dependents[${idx}].ssn`,
          message: `${depLabel} has the same SSN as ${prevLabel}. Each dependent must have a unique SSN.`,
          itemIndex: idx,
          itemLabel: depLabel,
        });
      }
      depSSNs.set(dep.ssn, idx);
    }

    // Qualifying relative residency: non-relatives must live with you all year
    const isChildRelationship = ['Son', 'Daughter', 'Stepson', 'Stepdaughter', 'Foster Child', 'Grandchild', 'Brother', 'Sister', 'Half Brother', 'Half Sister', 'Stepbrother', 'Stepsister', 'Niece', 'Nephew'].includes(dep.relationship);
    const isParentRelationship = ['Parent', 'Mother', 'Father', 'Stepmother', 'Stepfather', 'Grandparent'].includes(dep.relationship);
    if (dep.relationship === 'None (not related)' && (dep.monthsLivedWithYou ?? 12) < 12) {
      warnings.push({
        stepId: 'dependents',
        field: `dependents[${idx}].monthsLivedWithYou`,
        message: `${depLabel} is not a relative and lived with you only ${dep.monthsLivedWithYou} months. Non-relatives must live with you for the entire year to qualify as a dependent.`,
        itemIndex: idx,
        itemLabel: depLabel,
      });
    }

    // Qualifying child age limits
    if (dep.dateOfBirth && isChildRelationship) {
      const depAge = getAgeAtEndOfYear(dep.dateOfBirth, taxReturn.taxYear);
      if (depAge !== undefined && depAge >= 19 && !dep.isStudent) {
        warnings.push({
          stepId: 'dependents',
          field: `dependents[${idx}].dateOfBirth`,
          message: `${depLabel} is ${depAge} — qualifying children must be under 19 at year-end (or under 24 if a full-time student). If they're a full-time student, mark them as such. Otherwise, they may still qualify as a qualifying relative if their gross income is under $5,200.`,
          itemIndex: idx,
          itemLabel: depLabel,
        });
      } else if (depAge !== undefined && depAge >= 24 && dep.isStudent) {
        warnings.push({
          stepId: 'dependents',
          field: `dependents[${idx}].dateOfBirth`,
          message: `${depLabel} is ${depAge} — even full-time students must be under 24 at year-end to qualify as a qualifying child. They may still qualify as a qualifying relative if their gross income is under $5,200.`,
          itemIndex: idx,
          itemLabel: depLabel,
        });
      }
    }
  });

  // ── 1099-B: date acquired, date sold, holding period ──────────────────
  (taxReturn.income1099B || []).forEach((item, idx) => {
    const label = item.description || item.brokerName || `Transaction ${idx + 1}`;

    if (item.dateAcquired) {
      const w = validateAcquiredDate(item.dateAcquired, item.dateSold);
      if (w) {
        warnings.push({
          stepId: '1099b_income', field: `income1099B[${idx}].dateAcquired`,
          message: w, itemIndex: idx, itemLabel: label,
        });
      }
    }

    if (item.dateSold) {
      const w = validateSaleDate(item.dateSold);
      if (w) {
        warnings.push({
          stepId: '1099b_income', field: `income1099B[${idx}].dateSold`,
          message: w, itemIndex: idx, itemLabel: label,
        });
      }
    }

    if (item.dateAcquired && item.dateSold) {
      const w = validateHoldingPeriod(item.dateAcquired, item.dateSold, item.isLongTerm);
      if (w) {
        warnings.push({
          stepId: '1099b_income', field: `income1099B[${idx}].isLongTerm`,
          message: w, itemIndex: idx, itemLabel: label,
        });
      }
    }
  });

  // ── 1099-DA: date acquired, date sold, holding period ─────────────────
  (taxReturn.income1099DA || []).forEach((item, idx) => {
    const label = item.tokenName || item.brokerName || `Transaction ${idx + 1}`;

    if (item.dateAcquired) {
      const w = validateAcquiredDate(item.dateAcquired, item.dateSold);
      if (w) {
        warnings.push({
          stepId: '1099da_income', field: `income1099DA[${idx}].dateAcquired`,
          message: w, itemIndex: idx, itemLabel: label,
        });
      }
    }

    if (item.dateSold) {
      const w = validateSaleDate(item.dateSold);
      if (w) {
        warnings.push({
          stepId: '1099da_income', field: `income1099DA[${idx}].dateSold`,
          message: w, itemIndex: idx, itemLabel: label,
        });
      }
    }

    if (item.dateAcquired && item.dateSold) {
      const w = validateHoldingPeriod(item.dateAcquired, item.dateSold, item.isLongTerm);
      if (w) {
        warnings.push({
          stepId: '1099da_income', field: `income1099DA[${idx}].isLongTerm`,
          message: w, itemIndex: idx, itemLabel: label,
        });
      }
    }
  });

  // ── Cross-form: digital asset activity question vs. 1099-DA entries ──
  const has1099DAEntries = (taxReturn.income1099DA || []).length > 0;
  const has1099BEntries = (taxReturn.income1099B || []).length > 0;
  if (has1099DAEntries && !taxReturn.digitalAssetActivity) {
    warnings.push({
      stepId: 'personal_info',
      field: 'digitalAssetActivity',
      message: 'You have digital asset transactions (1099-DA) but the mandatory IRS digital asset question is not set to "Yes". All filers must answer this question on Form 1040.',
    });
  }
  if (taxReturn.digitalAssetActivity && !has1099DAEntries && !has1099BEntries) {
    warnings.push({
      stepId: 'personal_info',
      field: 'digitalAssetActivity',
      message: 'You answered "Yes" to the digital asset question but have no 1099-DA or 1099-B entries. Add your digital asset transactions, or change this to "No" if you had none.',
    });
  }

  // ── Form 4797: business property date validation ─────────────────────
  (taxReturn.form4797Properties || []).forEach((prop, idx) => {
    const label = prop.description || `Property ${idx + 1}`;
    if (prop.dateAcquired) {
      const w = validateAcquiredDate(prop.dateAcquired, prop.dateSold);
      if (w) {
        warnings.push({
          stepId: 'form4797', field: `form4797Properties[${idx}].dateAcquired`,
          message: w, itemIndex: idx, itemLabel: label,
        });
      }
    }
    if (prop.dateSold) {
      const w = validateTaxYearEventDate(prop.dateSold);
      if (w) {
        warnings.push({
          stepId: 'form4797', field: `form4797Properties[${idx}].dateSold`,
          message: w, itemIndex: idx, itemLabel: label,
        });
      }
    }
  });

  // ── 1099-C: date of cancellation validation ─────────────────────────
  (taxReturn.income1099C || []).forEach((item, idx) => {
    if (item.dateOfCancellation) {
      const w = validateTaxYearEventDate(item.dateOfCancellation);
      if (w) {
        warnings.push({
          stepId: '1099c_income', field: `income1099C[${idx}].dateOfCancellation`,
          message: w, itemIndex: idx, itemLabel: item.payerName || `1099-C ${idx + 1}`,
        });
      }
    }
  });

  // ── Depreciation assets: date placed in service validation ──────────
  (taxReturn.depreciationAssets || []).forEach((asset, idx) => {
    if (asset.dateInService) {
      const w = validatePlacedInServiceDate(asset.dateInService);
      if (w) {
        warnings.push({
          stepId: 'depreciation_assets', field: `depreciationAssets[${idx}].dateInService`,
          message: w, itemIndex: idx, itemLabel: asset.description || `Asset ${idx + 1}`,
        });
      }
    }
  });

  // ── EV credit: date acquired validation ─────────────────────────────
  const evInfo = taxReturn.evCredit;
  if (evInfo?.dateAcquired) {
    const w = validateTaxYearEventDate(evInfo.dateAcquired);
    if (w) {
      warnings.push({
        stepId: 'ev_credit', field: 'evCredit.dateAcquired',
        message: w,
      });
    }
  }

  // ── Vehicle expenses: date placed in service validation ─────────────
  if (taxReturn.vehicle?.dateInService) {
    const w = validatePlacedInServiceDate(taxReturn.vehicle.dateInService);
    if (w) {
      warnings.push({
        stepId: 'vehicle_expenses', field: 'vehicle.dateInService',
        message: w,
      });
    }
  }

  // ── Home office: date first used for business validation ────────────
  if (taxReturn.homeOffice?.dateFirstUsedForBusiness) {
    const w = validatePlacedInServiceDate(taxReturn.homeOffice.dateFirstUsedForBusiness);
    if (w) {
      warnings.push({
        stepId: 'home_office', field: 'homeOffice.dateFirstUsedForBusiness',
        message: w,
      });
    }
  }

  // ── QOZ investment date validation ──────────────────────────────────
  if (taxReturn.qozInvestment?.investmentDate) {
    const w = validatePlacedInServiceDate(taxReturn.qozInvestment.investmentDate);
    if (w) {
      warnings.push({
        stepId: '1099b_income', field: 'qozInvestment.investmentDate',
        message: w,
      });
    }
  }

  // ── Divorce/separation date validation (adjustments + other income) ─
  if (taxReturn.alimony?.divorceDate) {
    const w = validateDivorceDate(taxReturn.alimony.divorceDate);
    if (w) {
      warnings.push({
        stepId: 'alimony_paid', field: 'alimony.divorceDate',
        message: w,
      });
    }
  }
  if (taxReturn.alimonyReceived?.divorceDate) {
    const w = validateDivorceDate(taxReturn.alimonyReceived.divorceDate);
    if (w) {
      warnings.push({
        stepId: 'other_income', field: 'alimonyReceived.divorceDate',
        message: w,
      });
    }
  }

  // ── Spouse date of death validation ─────────────────────────────────
  if (taxReturn.spouseDateOfDeath) {
    const w = validateDeathDate(taxReturn.spouseDateOfDeath);
    if (w) {
      warnings.push({
        stepId: 'filing_status', field: 'spouseDateOfDeath',
        message: w,
      });
    }
  }

  // ── Home Office ↔ Itemized Deductions: cross-form mismatch ───────────
  // When using the actual method (Form 8829), mortgage interest and real
  // estate taxes should match between the Home Office page and Itemized
  // Deductions because they represent the same total amounts for the same
  // home. The engine splits the business portion to Form 8829 and the
  // personal portion to Schedule A.
  const ho = taxReturn.homeOffice;
  const itemized = taxReturn.itemizedDeductions;
  if (ho?.method === 'actual' && itemized) {
    if (
      ho.mortgageInterest != null && ho.mortgageInterest > 0 &&
      itemized.mortgageInterest > 0 &&
      ho.mortgageInterest !== itemized.mortgageInterest
    ) {
      warnings.push({
        stepId: 'home_office',
        field: 'homeOffice.mortgageInterest',
        message: `Mortgage interest on Home Office ($${ho.mortgageInterest.toLocaleString()}) differs from Itemized Deductions ($${itemized.mortgageInterest.toLocaleString()}). Both should be your total annual mortgage interest.`,
      });
      warnings.push({
        stepId: 'itemized_deductions',
        field: 'itemizedDeductions.mortgageInterest',
        message: `Mortgage interest on Itemized Deductions ($${itemized.mortgageInterest.toLocaleString()}) differs from Home Office ($${ho.mortgageInterest.toLocaleString()}). Both should be your total annual mortgage interest.`,
      });
    }

    if (
      ho.realEstateTaxes != null && ho.realEstateTaxes > 0 &&
      itemized.realEstateTax > 0 &&
      ho.realEstateTaxes !== itemized.realEstateTax
    ) {
      warnings.push({
        stepId: 'home_office',
        field: 'homeOffice.realEstateTaxes',
        message: `Real estate taxes on Home Office ($${ho.realEstateTaxes.toLocaleString()}) differs from Itemized Deductions ($${itemized.realEstateTax.toLocaleString()}). Both should be your total annual real estate taxes.`,
      });
      warnings.push({
        stepId: 'itemized_deductions',
        field: 'itemizedDeductions.realEstateTax',
        message: `Real estate taxes on Itemized Deductions ($${itemized.realEstateTax.toLocaleString()}) differs from Home Office ($${ho.realEstateTaxes.toLocaleString()}). Both should be your total annual real estate taxes.`,
      });
    }
  }

  // ── 1099-K: gross amount with no adjustments ──────────────────────────
  (taxReturn.income1099K || []).forEach((k, idx) => {
    if (k.grossAmount > 5000 && !k.returnsAndAllowances) {
      warnings.push({
        stepId: '1099k_income',
        field: `income1099K[${idx}].returnsAndAllowances`,
        message: `${k.platformName} reports $${k.grossAmount.toLocaleString()} gross. If this includes refunds, platform fees, or personal transactions, enter adjustments to avoid being taxed on the full amount.`,
        itemIndex: idx,
        itemLabel: k.platformName || `1099-K ${idx + 1}`,
      });
    }
  });

  // ── COGS: incomplete Part III ────────────────────────────────────────
  const cogs = taxReturn.costOfGoodsSold;
  if (cogs) {
    const hasAnyField = (cogs.beginningInventory || 0) > 0 || (cogs.purchases || 0) > 0 ||
      (cogs.costOfLabor || 0) > 0 || (cogs.materialsAndSupplies || 0) > 0 || (cogs.otherCosts || 0) > 0;
    if (hasAnyField && cogs.endingInventory == null) {
      warnings.push({
        stepId: 'cost_of_goods_sold',
        field: 'costOfGoodsSold.endingInventory',
        message: 'You entered COGS fields but ending inventory is missing. Enter 0 if you have no inventory remaining.',
      });
    }
  }

  // ── Expense Line 9 + Vehicle step overlap (engine suppresses Line 9) ──
  const hasLine9Expense = taxReturn.expenses.some(e => e.scheduleCLine === 9 && e.amount > 0);
  const hasVehicleDeduction = taxReturn.vehicle && taxReturn.vehicle.method !== null;
  if (hasLine9Expense && hasVehicleDeduction) {
    const line9Total = taxReturn.expenses
      .filter(e => e.scheduleCLine === 9 && e.amount > 0)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    warnings.push({
      stepId: 'expense_categories',
      field: 'expenses.line9',
      message: `Your $${line9Total.toLocaleString()} in Car & Truck expenses is being excluded because your Vehicle Expenses page calculates this deduction. Remove the Car & Truck entries here to clear this notice.`,
    });
    warnings.push({
      stepId: 'vehicle_expenses',
      field: 'vehicle.overlap',
      message: `You also have $${line9Total.toLocaleString()} in Car & Truck expenses on the Expenses page. That amount is excluded — your vehicle deduction here takes priority. Remove the duplicate to clear this notice.`,
    });
  }

  // ── Line 19 (Pension) + SE Retirement double-deduction guard ─────────
  const hasLine19Expense = taxReturn.expenses.some(e => e.scheduleCLine === 19 && (e.amount || 0) > 0);
  const hasEmployeeWages = taxReturn.expenses.some(e => e.scheduleCLine === 26 && (e.amount || 0) > 0);
  if (hasLine19Expense) {
    const line19Total = taxReturn.expenses
      .filter(e => e.scheduleCLine === 19 && (e.amount || 0) > 0)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    if (!hasEmployeeWages) {
      // No employees — Line 19 is suppressed by the engine. Warn the user.
      warnings.push({
        stepId: 'expense_categories',
        field: 'expenses.line19',
        message: `Your $${line19Total.toLocaleString()} in Pension & Profit-Sharing expenses (Line 19) is being excluded — Schedule C Line 19 is for contributions to plans for your employees, not yourself. Your own retirement contributions (SEP-IRA, Solo 401(k), etc.) are deducted on the SE Retirement Plans page (Schedule 1, Line 16).`,
      });
      warnings.push({
        stepId: 'se_retirement',
        field: 'selfEmploymentDeductions.line19overlap',
        message: `You have $${line19Total.toLocaleString()} in Pension & Profit-Sharing expenses on your Business Expenses page (Line 19). That amount is excluded — Line 19 is for employee plans only. Enter your own contributions here instead.`,
      });
    } else {
      // Has employees — Line 19 is allowed, but warn if SE retirement contributions also exist
      const sed = taxReturn.selfEmploymentDeductions;
      const hasOwnerRetirement = (sed?.sepIraContributions || 0) > 0 ||
        (sed?.solo401kEmployeeDeferral || 0) > 0 || (sed?.solo401kEmployerContribution || 0) > 0 ||
        (sed?.solo401kContributions || 0) > 0;
      if (hasOwnerRetirement) {
        warnings.push({
          stepId: 'expense_categories',
          field: 'expenses.line19',
          message: `You have $${line19Total.toLocaleString()} in Pension & Profit-Sharing expenses (Line 19) and also have retirement contributions on the SE Retirement Plans page. Make sure Line 19 only includes contributions for your employees — your own SEP-IRA or Solo 401(k) contributions should only appear on the SE Retirement page.`,
        });
      }
    }
  }

  // ── Vehicle: documentation and consistency checks ─────────────────────
  const veh = taxReturn.vehicle;
  if (veh?.method === 'actual') {
    // Warn if using actual expenses without written evidence
    if (!veh.writtenEvidence) {
      warnings.push({
        stepId: 'vehicle_expenses',
        field: 'vehicle.writtenEvidence',
        message: 'The IRS requires written records (mileage log) to substantiate vehicle deductions under the actual expense method (IRC Section 274(d)).',
      });
    }

    // Warn if high business use without written evidence
    const vehicleBizPct = (veh.totalMiles && veh.totalMiles > 0)
      ? (veh.businessMiles || 0) / veh.totalMiles
      : 0;
    if (vehicleBizPct > 0.9 && !veh.writtenEvidence) {
      warnings.push({
        stepId: 'vehicle_expenses',
        field: 'vehicle.businessMiles',
        message: `Business use is ${(vehicleBizPct * 100).toFixed(0)}% — the IRS closely scrutinizes rates above 90%. Ensure you have a detailed mileage log.`,
      });
    }

    // Warn if depreciation fields set without date in service
    if ((veh.vehicleCost || 0) > 0 && !veh.dateInService) {
      warnings.push({
        stepId: 'vehicle_expenses',
        field: 'vehicle.dateInService',
        message: 'Vehicle cost entered but no date placed in service. This is needed to calculate the correct MACRS depreciation year.',
      });
    }
  }

  // ── Cross-form: CTC child count vs. derived from dependents ───────────
  const deps = taxReturn.dependents || [];
  const ctc = taxReturn.childTaxCredit;
  if (ctc && deps.length > 0) {
    let derivedQualifying = 0;
    let derivedOther = 0;
    for (const dep of deps) {
      const age = getAgeAtEndOfYear(dep.dateOfBirth, taxReturn.taxYear);
      if (age !== undefined && age < 17 && dep.monthsLivedWithYou >= 7) {
        derivedQualifying++;
      } else {
        derivedOther++;
      }
    }
    if (ctc.qualifyingChildren !== derivedQualifying) {
      warnings.push({
        stepId: 'child_tax_credit',
        field: 'childTaxCredit.qualifyingChildren',
        message: `You entered ${ctc.qualifyingChildren} qualifying children, but ${derivedQualifying} of your ${deps.length} dependents appear to qualify (under 17 with 7+ months residency). Please verify.`,
      });
    }
    if (ctc.otherDependents !== derivedOther) {
      warnings.push({
        stepId: 'child_tax_credit',
        field: 'childTaxCredit.otherDependents',
        message: `You entered ${ctc.otherDependents} other dependents, but ${derivedOther} were expected from your dependents list. Please verify.`,
      });
    }
  }

  // ── Cross-form: Dependent care qualifying persons > dependents under 13 ─
  const dcInfo = taxReturn.dependentCare;
  if (dcInfo && (dcInfo.qualifyingPersons || 0) > 0 && deps.length > 0) {
    let under13OrDisabled = 0;
    for (const dep of deps) {
      const age = getAgeAtEndOfYear(dep.dateOfBirth, taxReturn.taxYear);
      if ((age !== undefined && age < 13) || dep.isDisabled) {
        under13OrDisabled++;
      }
    }
    if ((dcInfo.qualifyingPersons || 0) > under13OrDisabled && under13OrDisabled > 0) {
      warnings.push({
        stepId: 'dependent_care',
        field: 'dependentCare.qualifyingPersons',
        message: `You entered ${dcInfo.qualifyingPersons} qualifying persons, but only ${under13OrDisabled} of your dependents are under 13 or disabled.`,
      });
    }
  }

  // ── Cross-form: HoH filing status with no qualifying dependent ──────────
  if (taxReturn.filingStatus === FilingStatus.HeadOfHousehold) {
    const hasQualifyingDep = deps.some(d => d.monthsLivedWithYou >= 7);
    if (deps.length === 0) {
      warnings.push({
        stepId: 'filing_status',
        field: 'filingStatus',
        message: 'Head of Household requires a qualifying dependent. No dependents have been added yet.',
      });
    } else if (!hasQualifyingDep) {
      warnings.push({
        stepId: 'filing_status',
        field: 'filingStatus',
        message: 'Head of Household requires a qualifying dependent who lived with you for more than half the year (7+ months). None of your dependents meet this requirement.',
      });
    }
  }

  // ── Cross-form: Schedule R age claim contradicts DOB ────────────────────
  const schedR = taxReturn.scheduleR;
  if (schedR) {
    if (schedR.isAge65OrOlder && taxReturn.dateOfBirth) {
      const filerIs65 = isAge65OrOlder(taxReturn.dateOfBirth, taxReturn.taxYear);
      if (!filerIs65) {
        warnings.push({
          stepId: 'elderly_disabled',
          field: 'scheduleR.isAge65OrOlder',
          message: 'You indicated you are 65 or older, but your date of birth suggests otherwise. Please verify your date of birth or eligibility.',
        });
      }
    }
    if (schedR.isSpouseAge65OrOlder && taxReturn.spouseDateOfBirth) {
      const spouseIs65 = isAge65OrOlder(taxReturn.spouseDateOfBirth, taxReturn.taxYear);
      if (!spouseIs65) {
        warnings.push({
          stepId: 'elderly_disabled',
          field: 'scheduleR.isSpouseAge65OrOlder',
          message: "You indicated your spouse is 65 or older, but their date of birth suggests otherwise. Please verify your spouse's date of birth or eligibility.",
        });
      }
    }
  }

  // ── Cross-form: MFS + disqualifying credits ─────────────────────────────
  if (taxReturn.filingStatus === FilingStatus.MarriedFilingSeparately) {
    if ((taxReturn.educationCredits || []).length > 0) {
      warnings.push({
        stepId: 'education_credits',
        field: 'educationCredits',
        message: 'Education credits (AOTC and Lifetime Learning) are not available when filing Married Filing Separately.',
      });
    }
    if ((taxReturn.studentLoanInterest || 0) > 0) {
      warnings.push({
        stepId: 'student_loan_ded',
        field: 'studentLoanInterest',
        message: 'Student loan interest deduction is not available when filing Married Filing Separately.',
      });
    }
  }

  // ── Cross-form: EITC investment income exceeds $11,600 ──────────────────
  const totalInterest = (taxReturn.income1099INT || []).reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalDividends = (taxReturn.income1099DIV || []).reduce((sum, d) => sum + (d.ordinaryDividends || 0), 0);
  const totalCapGainDist = (taxReturn.income1099DIV || []).reduce((sum, d) => sum + (d.capitalGainDistributions || 0), 0);
  const investmentIncome = totalInterest + totalDividends + totalCapGainDist;
  if (investmentIncome > 11600 && taxReturn.incomeDiscovery?.['eitc'] !== 'no') {
    warnings.push({
      stepId: 'credits_overview',
      field: 'eitc.investmentIncome',
      message: `Investment income is $${investmentIncome.toLocaleString()}, which exceeds the $11,600 EITC limit. You are not eligible for the Earned Income Tax Credit.`,
    });
  }

  // ── Cross-form: PTC family size ≠ actual household count ────────────────
  const ptcInfo = taxReturn.premiumTaxCredit;
  if (ptcInfo && (ptcInfo.forms1095A || []).length > 0) {
    const isMFJ = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly;
    const expectedSize = 1 + (isMFJ ? 1 : 0) + deps.length;
    if ((ptcInfo.familySize || 1) !== expectedSize) {
      warnings.push({
        stepId: 'premium_tax_credit',
        field: 'premiumTaxCredit.familySize',
        message: `Tax family size is ${ptcInfo.familySize || 1}, but your return has ${expectedSize} household members (you${isMFJ ? ' + spouse' : ''}${deps.length > 0 ? ` + ${deps.length} dependents` : ''}). Please verify.`,
      });
    }
  }

  // ── Cross-form: Education credit student not in dependents or filer ─────
  const filerFullName = [taxReturn.firstName, taxReturn.lastName].filter(Boolean).join(' ').toLowerCase();
  const spouseFullName = [taxReturn.spouseFirstName, taxReturn.spouseLastName].filter(Boolean).join(' ').toLowerCase();
  const depNames = new Set(deps.map(d => [d.firstName, d.lastName].filter(Boolean).join(' ').toLowerCase()));
  for (const ec of (taxReturn.educationCredits || [])) {
    if (ec.studentName) {
      const studentLower = ec.studentName.toLowerCase().trim();
      if (studentLower && studentLower !== filerFullName && studentLower !== spouseFullName && !depNames.has(studentLower)) {
        warnings.push({
          stepId: 'education_credits',
          field: 'educationCredits.studentName',
          message: `Student "${ec.studentName}" doesn't match you, your spouse, or any claimed dependent. Education credits generally require the student to be a claimed dependent (or yourself).`,
        });
      }
    }
  }

  // ── Cross-form: Adoption credit children > dependents ───────────────────
  const adoption = taxReturn.adoptionCredit;
  if (adoption && (adoption.numberOfChildren || 1) > 0 && deps.length > 0) {
    if ((adoption.numberOfChildren || 1) > deps.length) {
      warnings.push({
        stepId: 'adoption_credit',
        field: 'adoptionCredit.numberOfChildren',
        message: `Adoption credit claims ${adoption.numberOfChildren} children, but you only have ${deps.length} dependents listed. Adopted children should be added as dependents.`,
      });
    }
  }

  // ── AGI-sensitive threshold warnings ─────────────────────────────────
  const agi = calculation?.form1040?.agi;
  const fs = taxReturn.filingStatus;
  const isMFJorQSS = fs === FilingStatus.MarriedFilingJointly || fs === FilingStatus.QualifyingSurvivingSpouse;
  const isMFS = fs === FilingStatus.MarriedFilingSeparately;

  if (agi != null && !isNaN(agi)) {
    // SALT deduction phase-down: AGI > $500,000
    const saltEntered = (taxReturn.itemizedDeductions?.stateLocalIncomeTax || 0) +
      (taxReturn.itemizedDeductions?.realEstateTax || 0) +
      (taxReturn.itemizedDeductions?.personalPropertyTax || 0);
    if (saltEntered > 0 && agi > 500000) {
      warnings.push({
        stepId: 'itemized_deductions',
        field: 'itemizedDeductions.salt',
        message: `Your AGI ($${agi.toLocaleString()}) exceeds $500,000. The $40,000 SALT cap phases down for high earners — your effective cap may be lower.`,
      });
    }

    // Student loan interest phase-out: $85k single / $170k MFJ
    if ((taxReturn.studentLoanInterest || 0) > 0) {
      const slPhaseStart = isMFJorQSS ? 170000 : 85000;
      const slPhaseEnd = isMFJorQSS ? 200000 : 100000;
      if (agi > slPhaseStart) {
        const msg = agi >= slPhaseEnd
          ? `Your AGI ($${agi.toLocaleString()}) exceeds $${slPhaseEnd.toLocaleString()} — student loan interest deduction is fully phased out.`
          : `Your AGI ($${agi.toLocaleString()}) exceeds $${slPhaseStart.toLocaleString()} — student loan interest deduction is partially reduced.`;
        warnings.push({ stepId: 'student_loan_ded', field: 'studentLoanInterest', message: msg });
      }
    }

    // IRA deduction phase-out when covered by employer plan
    if ((taxReturn.iraContribution || 0) > 0 && taxReturn.coveredByEmployerPlan) {
      const iraPhaseStart = isMFJorQSS ? 126000 : (fs === FilingStatus.Single || fs === FilingStatus.HeadOfHousehold ? 79000 : 0);
      const iraPhaseEnd = isMFJorQSS ? 146000 : (fs === FilingStatus.Single || fs === FilingStatus.HeadOfHousehold ? 89000 : 10000);
      if (agi > iraPhaseStart && iraPhaseStart > 0) {
        const msg = agi >= iraPhaseEnd
          ? `Your AGI ($${agi.toLocaleString()}) exceeds the phase-out — your traditional IRA contribution is not deductible (you're covered by an employer plan).`
          : `Your AGI ($${agi.toLocaleString()}) is in the IRA deduction phase-out range ($${iraPhaseStart.toLocaleString()}-$${iraPhaseEnd.toLocaleString()}) since you're covered by an employer plan. Your deduction may be reduced.`;
        warnings.push({ stepId: 'ira_contribution_ded', field: 'iraContribution', message: msg });
      }
    }

    // Education credit phase-out: $80k/$160k
    if ((taxReturn.educationCredits || []).length > 0 && !isMFS) {
      const edPhaseStart = isMFJorQSS ? 160000 : 80000;
      const edPhaseEnd = isMFJorQSS ? 180000 : 90000;
      if (agi > edPhaseStart) {
        const msg = agi >= edPhaseEnd
          ? `Your AGI ($${agi.toLocaleString()}) exceeds $${edPhaseEnd.toLocaleString()} — education credits are fully phased out.`
          : `Your AGI ($${agi.toLocaleString()}) is in the education credit phase-out range. Your credit may be reduced.`;
        warnings.push({ stepId: 'education_credits', field: 'educationCredits', message: msg });
      }
    }

    // Adoption credit phase-out: AGI > $259,190
    if (taxReturn.adoptionCredit && (taxReturn.adoptionCredit.qualifiedExpenses > 0 || taxReturn.adoptionCredit.isSpecialNeeds)) {
      if (agi > 259190) {
        const msg = agi >= 299190
          ? `Your AGI ($${agi.toLocaleString()}) exceeds $299,190 — the adoption credit is fully phased out.`
          : `Your AGI ($${agi.toLocaleString()}) exceeds $259,190 — your adoption credit is partially reduced.`;
        warnings.push({ stepId: 'adoption_credit', field: 'adoptionCredit', message: msg });
      }
    }

    // Saver's credit rate threshold
    if (taxReturn.saversCredit && (taxReturn.saversCredit.totalContributions || 0) > 0) {
      const saversZero = isMFJorQSS ? 73000 : (fs === FilingStatus.HeadOfHousehold ? 54750 : 36500);
      if (agi > saversZero) {
        warnings.push({
          stepId: 'savers_credit',
          field: 'saversCredit.totalContributions',
          message: `Your AGI ($${agi.toLocaleString()}) exceeds the $${saversZero.toLocaleString()} threshold — the Saver's Credit rate is 0% and no credit is available.`,
        });
      }
    }

    // Passive rental loss limitation (Form 8582): AGI > $100k (phases out by $150k)
    const form8582 = calculation?.form8582;
    if (form8582 && form8582.totalSuspendedLoss > 0) {
      const msg = form8582.specialAllowance === 0 && agi >= 150000
        ? `Your AGI ($${agi.toLocaleString()}) exceeds $150,000 — the $25,000 passive rental loss allowance is fully phased out. $${form8582.totalSuspendedLoss.toLocaleString()} in passive losses is suspended and carries forward.`
        : `$${form8582.totalSuspendedLoss.toLocaleString()} in passive losses exceeds your allowance and is suspended — it carries forward to next year.`;
      warnings.push({ stepId: 'rental_income', field: 'rentalProperties.passiveLoss', message: msg });
    } else if (!form8582) {
      // Fallback: estimate from raw data if calculation not available
      const rentalLoss = (taxReturn.rentalProperties || []).reduce((sum, p) => {
        const expenses = (p.advertising || 0) + (p.auto || 0) + (p.cleaning || 0) + (p.commissions || 0) +
          (p.insurance || 0) + (p.legal || 0) + (p.management || 0) + (p.mortgageInterest || 0) +
          (p.otherInterest || 0) + (p.repairs || 0) + (p.supplies || 0) + (p.taxes || 0) +
          (p.utilities || 0) + (p.depreciation || 0) + (p.otherExpenses || 0);
        const net = p.rentalIncome - expenses;
        return net < 0 ? sum + net : sum;
      }, 0);
      if (rentalLoss < 0 && agi > 100000) {
        const msg = agi >= 150000
          ? `Your AGI ($${agi.toLocaleString()}) exceeds $150,000 — the $25,000 passive rental loss allowance is fully phased out. Your $${Math.abs(rentalLoss).toLocaleString()} rental loss may be suspended.`
          : `Your AGI ($${agi.toLocaleString()}) exceeds $100,000 — the $25,000 passive rental loss allowance is being reduced. Some of your rental loss may be suspended.`;
        warnings.push({ stepId: 'rental_income', field: 'rentalProperties.passiveLoss', message: msg });
      }
    }

    // ── Royalty + 1099-MISC double-count check ──────────────────────
    const royaltyProps = taxReturn.royaltyProperties || [];
    const misc1099Royalties = (taxReturn.income1099MISC || []).reduce((s, m) => s + (m.royalties || 0), 0);
    if (royaltyProps.length > 0 && misc1099Royalties > 0) {
      const propTotal = royaltyProps.reduce((s, p) => s + (p.royaltyIncome || 0), 0);
      if (propTotal > 0 && misc1099Royalties > 0) {
        warnings.push({
          stepId: 'royalty_income',
          field: 'royaltyProperties.doubleCount',
          message: `You have $${misc1099Royalties.toLocaleString()} in royalties from 1099-MISC forms and $${propTotal.toLocaleString()} entered as royalty properties. Make sure these aren't the same income counted twice.`,
        });
      }
    }

    // NIIT surcharge: AGI > $200k single / $250k MFJ
    const niitThreshold = isMFJorQSS ? 250000 : (isMFS ? 125000 : 200000);
    if (agi > niitThreshold && investmentIncome > 0) {
      warnings.push({
        stepId: 'income_summary',
        field: 'niit',
        message: `Your AGI ($${agi.toLocaleString()}) exceeds the $${niitThreshold.toLocaleString()} threshold and you have $${investmentIncome.toLocaleString()} in investment income. You may owe the 3.8% Net Investment Income Tax.`,
      });
    }
  }

  // ── Cross-form: W-2 withholding exceeds wages ──────────────────────────
  (taxReturn.w2Income || []).forEach((w2, idx) => {
    if (w2.federalTaxWithheld > w2.wages && w2.wages > 0) {
      warnings.push({
        stepId: 'w2_income',
        field: `w2Income[${idx}].federalTaxWithheld`,
        message: `Federal tax withheld ($${w2.federalTaxWithheld.toLocaleString()}) exceeds wages ($${w2.wages.toLocaleString()}) — please verify. Withholding should not exceed gross wages.`,
        itemIndex: idx,
        itemLabel: w2.employerName || `W-2 ${idx + 1}`,
      });
    }
  });

  // ── Cross-form: 1099-R early distribution code vs. filer age ──────────
  // Distribution code 1 = "early distribution, no known exception" but if
  // the filer is 59½ or older, code 7 (normal) is expected.
  (taxReturn.income1099R || []).forEach((r, idx) => {
    if ((r.distributionCode === '1' || r.distributionCode === '2') && taxReturn.dateOfBirth) {
      const age = getAgeAtEndOfYear(taxReturn.dateOfBirth, taxReturn.taxYear);
      if (age !== undefined && age >= 60) {
        warnings.push({
          stepId: '1099r_income',
          field: `income1099R[${idx}].distributionCode`,
          message: `Distribution code "${r.distributionCode}" (early${r.distributionCode === '2' ? ', exception applies' : ', no exception'}) but you were ${age} at year-end. If you were 59½+, the code should be "7" (normal). Verify with your plan administrator — an incorrect code may trigger a 10% early withdrawal penalty.`,
          itemIndex: idx,
          itemLabel: r.payerName || `1099-R ${idx + 1}`,
        });
      }
    }
  });

  // ── Cross-form: QCD (Qualified Charitable Distribution) validation ────
  // IRC §408(d)(8) — QCDs from traditional IRAs to qualified charities.
  {
    let totalQCD = 0;
    (taxReturn.income1099R || []).forEach((r, idx) => {
      const qcd = r.qcdAmount || 0;
      if (qcd <= 0) return;
      totalQCD += qcd;

      // QCD exceeds gross distribution
      if (qcd > r.grossDistribution) {
        warnings.push({
          stepId: '1099r_income',
          field: `income1099R[${idx}].qcdAmount`,
          message: `QCD amount ($${qcd.toLocaleString()}) exceeds gross distribution ($${r.grossDistribution.toLocaleString()}). The QCD cannot exceed the total distribution.`,
          itemIndex: idx,
          itemLabel: r.payerName || `1099-R ${idx + 1}`,
        });
      }

      // QCD on non-IRA or Roth distribution
      if (!r.isIRA || r.isRothIRA) {
        warnings.push({
          stepId: '1099r_income',
          field: `income1099R[${idx}].qcdAmount`,
          message: `QCD entered on a ${r.isRothIRA ? 'Roth IRA' : 'non-IRA'} distribution. Qualified Charitable Distributions are only available from traditional IRAs (not Roth or employer plans).`,
          itemIndex: idx,
          itemLabel: r.payerName || `1099-R ${idx + 1}`,
        });
      }
    });

    // QCD total exceeds annual limit
    if (totalQCD > QCD.MAX_AMOUNT) {
      warnings.push({
        stepId: '1099r_income',
        field: 'qcdTotal',
        message: `Total QCDs ($${totalQCD.toLocaleString()}) exceed the $${QCD.MAX_AMOUNT.toLocaleString()} annual limit. Only $${QCD.MAX_AMOUNT.toLocaleString()} will be excluded from taxable income.`,
      });
    }

    // QCD age check — must be 70½ or older
    if (totalQCD > 0 && taxReturn.dateOfBirth) {
      const age = getAgeAtEndOfYear(taxReturn.dateOfBirth, taxReturn.taxYear);
      if (age !== undefined && age < 70) {
        warnings.push({
          stepId: '1099r_income',
          field: 'qcdAge',
          message: `You were ${age} at year-end. Qualified Charitable Distributions require age 70½ or older. The QCD will still be excluded in the calculation, but verify your eligibility.`,
        });
      }
    }

    // QCD + itemized charitable deduction double-benefit reminder
    if (totalQCD > 0 && taxReturn.itemizedDeductions) {
      const charitableTotal = (taxReturn.itemizedDeductions.charitableCash || 0) + (taxReturn.itemizedDeductions.charitableNonCash || 0);
      if (charitableTotal > 0) {
        warnings.push({
          stepId: '1099r_income',
          field: 'qcdDoubleBenefit',
          message: `You have $${totalQCD.toLocaleString()} in QCDs and $${charitableTotal.toLocaleString()} in charitable deductions on Schedule A. QCD amounts should not also be claimed as charitable deductions — they are excluded from income instead.`,
        });
      }
    }
  }

  // ── Cross-form: MFS + dependent care credit conflict ──────────────────
  // The Child & Dependent Care Credit is generally unavailable when filing
  // MFS unless you lived apart from your spouse for the last 6 months.
  if (
    taxReturn.filingStatus === FilingStatus.MarriedFilingSeparately &&
    taxReturn.dependentCare &&
    (taxReturn.dependentCare.totalExpenses || 0) > 0 &&
    !taxReturn.livedApartFromSpouse
  ) {
    warnings.push({
      stepId: 'dependent_care',
      field: 'dependentCare',
      message: 'The Child & Dependent Care Credit is generally not available when filing Married Filing Separately — unless you lived apart from your spouse for the last 6 months of the year.',
    });
    warnings.push({
      stepId: 'filing_status',
      field: 'filingStatus',
      message: 'You claimed dependent care expenses, but the credit is generally unavailable with MFS status. Consider filing jointly or verify you lived apart from your spouse for the last 6 months.',
    });
  }

  // ── Cross-form: Home sale ownership/use test ──────────────────────────
  // Section 121 exclusion requires owning AND using the home as a primary
  // residence for at least 24 of the prior 60 months.
  const hs = taxReturn.homeSale;
  if (hs) {
    if (hs.ownedMonths < 24) {
      warnings.push({
        stepId: 'other_income',
        field: 'homeSale.ownedMonths',
        message: `You owned the home for ${hs.ownedMonths} months. The Section 121 exclusion requires at least 24 months of ownership in the last 5 years. You may not qualify for the $${isMFJorQSS ? '500,000' : '250,000'} exclusion.`,
      });
    }
    if (hs.usedAsResidenceMonths < 24) {
      warnings.push({
        stepId: 'other_income',
        field: 'homeSale.usedAsResidenceMonths',
        message: `You used the home as your primary residence for ${hs.usedAsResidenceMonths} months. The Section 121 exclusion requires at least 24 months of use in the last 5 years.`,
      });
    }
  }

  // ── Cross-form: Alimony post-2019 not deductible ──────────────────────
  // Alimony paid under agreements executed after 12/31/2018 is NOT
  // deductible by the payer (and not income to the recipient) per TCJA.
  if (taxReturn.alimony && taxReturn.alimony.totalPaid > 0 && taxReturn.alimony.divorceDate) {
    const divDate = new Date(taxReturn.alimony.divorceDate);
    if (!isNaN(divDate.getTime()) && divDate >= new Date('2019-01-01')) {
      warnings.push({
        stepId: 'alimony_paid',
        field: 'alimony.totalPaid',
        message: `Your divorce/separation agreement is dated ${taxReturn.alimony.divorceDate} (after 12/31/2018). Under the Tax Cuts and Jobs Act, alimony paid under post-2018 agreements is not deductible. This amount will not reduce your AGI.`,
      });
    }
  }

  // ── Cross-form: 529 AQEE less than distributions ────────────────────
  // Non-qualified 529 distributions have taxable earnings + 10% penalty.
  // Uses Adjusted Qualified Education Expenses (AQEE) per Pub 970 Ch. 8.
  (taxReturn.income1099Q || []).forEach((q, idx) => {
    const aqee = Math.max(0, (q.qualifiedExpenses || 0) - (q.taxFreeAssistance || 0) - (q.expensesClaimedForCredit || 0));
    if (q.grossDistribution > 0 && aqee < q.grossDistribution && q.distributionType !== 'rollover') {
      const unqualified = q.grossDistribution - aqee;
      warnings.push({
        stepId: '1099q_income',
        field: `income1099Q[${idx}].qualifiedExpenses`,
        message: `${q.payerName || '1099-Q'}: Adjusted qualified expenses ($${aqee.toLocaleString()}) are less than the distribution ($${q.grossDistribution.toLocaleString()}). The $${unqualified.toLocaleString()} difference may have taxable earnings subject to income tax plus a 10% penalty.`,
        itemIndex: idx,
        itemLabel: q.payerName || `1099-Q ${idx + 1}`,
      });
    }
  });

  // ── Cross-form: SE tax owed but no estimated payments ───────────────────
  const seTax = calculation?.scheduleSE?.totalSETax ?? 0;
  const estPayments = taxReturn.estimatedQuarterlyPayments;
  const hasEstPayments = estPayments && estPayments.some((p: number) => p > 0);
  if (seTax > 0 && !hasEstPayments) {
    warnings.push({
      stepId: 'se_summary',
      field: 'scheduleSE.totalSETax',
      message: `You owe $${seTax.toLocaleString()} in self-employment tax. Consider making estimated quarterly payments to avoid an underpayment penalty.`,
    });
    warnings.push({
      stepId: 'estimated_payments',
      field: 'estimatedQuarterlyPayments',
      message: `You have $${seTax.toLocaleString()} in self-employment tax but no estimated payments entered. The IRS expects quarterly payments if you'll owe $1,000+ at filing.`,
    });
  }

  // ── Itemized: charitable cash > 60% AGI ──────────────────────────────
  if (agi != null && agi > 0) {
    const charitableCash = taxReturn.itemizedDeductions?.charitableCash || 0;
    if (charitableCash > 0 && charitableCash > agi * 0.60) {
      warnings.push({
        stepId: 'itemized_deductions',
        field: 'itemizedDeductions.charitableCash',
        message: `Cash donations ($${charitableCash.toLocaleString()}) exceed 60% of your AGI ($${Math.round(agi * 0.60).toLocaleString()}). The excess can be carried forward up to 5 years, but only the limited amount is deductible this year.`,
      });
    }
  }

  // ── Noncash donations (Form 8283): contribution date & value validation ──
  const nonCashDonations = taxReturn.itemizedDeductions?.nonCashDonations || [];
  nonCashDonations.forEach((don, idx) => {
    const contribWarn = validateContributionDate(don.dateOfContribution, don.dateAcquired);
    if (contribWarn) {
      warnings.push({
        stepId: 'charitable_deduction',
        field: `itemizedDeductions.nonCashDonations[${idx}].dateOfContribution`,
        message: contribWarn,
        itemIndex: idx,
        itemLabel: don.doneeOrganization || `Donation ${idx + 1}`,
      });
    }
    // Items over $5,000 require a qualified appraisal and Form 8283 Section B
    if ((don.fairMarketValue || 0) > 5000) {
      warnings.push({
        stepId: 'charitable_deduction',
        field: `itemizedDeductions.nonCashDonations[${idx}].fairMarketValue`,
        message: `"${don.description || don.doneeOrganization || `Donation ${idx + 1}`}" is valued at $${(don.fairMarketValue || 0).toLocaleString()}, which exceeds $5,000. Items over $5,000 require a qualified appraisal by a certified appraiser and Form 8283 Section B.`,
        itemIndex: idx,
        itemLabel: don.doneeOrganization || `Donation ${idx + 1}`,
      });
    }
  });

  // ── Itemized vs. standard deduction comparison ─────────────────────────
  const totalItemized = calculation?.scheduleA?.totalItemized;
  const standardDed = calculation?.form1040?.standardDeduction;
  if (totalItemized != null && standardDed != null && totalItemized > 0 && totalItemized < standardDed) {
    warnings.push({
      stepId: 'itemized_deductions',
      field: 'itemizedDeductions.total',
      message: `Your itemized deductions ($${totalItemized.toLocaleString()}) are less than the standard deduction ($${standardDed.toLocaleString()}). You may save more by taking the standard deduction instead.`,
    });
  }

  // ── OBBBA Schedule 1-A: tips/overtime phase-out proximity ──────────────
  const s1a = taxReturn.schedule1A;
  if (s1a && agi != null) {
    const phaseOutStart = isMFJorQSS ? 300000 : 150000;
    if (s1a.qualifiedTips && s1a.qualifiedTips > 0 && agi > phaseOutStart * 0.90) {
      if (agi >= phaseOutStart) {
        warnings.push({
          stepId: 'schedule1a',
          field: 'schedule1A.qualifiedTips',
          message: `Your AGI ($${agi.toLocaleString()}) exceeds the $${phaseOutStart.toLocaleString()} phase-out threshold. Your $${s1a.qualifiedTips.toLocaleString()} tips deduction is being reduced.`,
        });
      } else {
        warnings.push({
          stepId: 'schedule1a',
          field: 'schedule1A.qualifiedTips',
          message: `Your AGI ($${agi.toLocaleString()}) is within 10% of the $${phaseOutStart.toLocaleString()} tips deduction phase-out threshold. Small income changes could reduce your deduction.`,
        });
      }
    }
    if (s1a.qualifiedOvertimePay && s1a.qualifiedOvertimePay > 0 && agi > phaseOutStart * 0.90) {
      if (agi >= phaseOutStart) {
        warnings.push({
          stepId: 'schedule1a',
          field: 'schedule1A.qualifiedOvertimePay',
          message: `Your AGI ($${agi.toLocaleString()}) exceeds the $${phaseOutStart.toLocaleString()} phase-out threshold. Your $${s1a.qualifiedOvertimePay.toLocaleString()} overtime deduction is being reduced.`,
        });
      } else {
        warnings.push({
          stepId: 'schedule1a',
          field: 'schedule1A.qualifiedOvertimePay',
          message: `Your AGI ($${agi.toLocaleString()}) is within 10% of the $${phaseOutStart.toLocaleString()} overtime deduction phase-out threshold. Small income changes could reduce your deduction.`,
        });
      }
    }
  }

  // ── HSA: excess contributions ──────────────────────────────────────────
  const hsaAmount = taxReturn.hsaDeduction || 0;
  if (hsaAmount > 0) {
    const hsaCoverageType = taxReturn.hsaContribution?.coverageType;
    const catchUpAllowance = (taxReturn.hsaContribution?.catchUpContributions || 0) > 0 ? 1000 : 0;
    const baseLimit = hsaCoverageType === 'family' ? 8550 : 4300;
    const effectiveLimit = baseLimit + catchUpAllowance;

    if (hsaCoverageType && hsaAmount > effectiveLimit) {
      // Coverage type selected — give a precise warning using the effective limit
      warnings.push({
        stepId: 'hsa_contributions',
        field: 'hsaDeduction',
        message: `HSA contributions ($${hsaAmount.toLocaleString()}) exceed the 2025 ${hsaCoverageType === 'family' ? 'family' : 'self-only'} limit of $${effectiveLimit.toLocaleString()}${catchUpAllowance > 0 ? ` (base $${baseLimit.toLocaleString()} + $${catchUpAllowance.toLocaleString()} catch-up)` : ''}. Excess contributions are subject to a 6% excise tax each year they remain in the account.`,
      });
    } else if (!hsaCoverageType && hsaAmount > 4300) {
      // No coverage type selected — show informational warning
      warnings.push({
        stepId: 'hsa_contributions',
        field: 'hsaDeduction',
        message: `HSA contributions ($${hsaAmount.toLocaleString()}) exceed the 2025 self-only limit of $4,300. Select your coverage type on the HSA page for a precise check. The family limit is $8,550.`,
      });
    }
  }

  // ── AMT crossover proximity warning ──────────────────────────────────
  const amtResult = calculation?.amt;
  if (amtResult && !amtResult.applies && amtResult.tentativeMinimumTax > 0) {
    // Regular tax — incomeTax already includes preferential and §1250 tax
    // when the preferential rate path is used (see form1040Sections.ts)
    const f = calculation?.form1040;
    const regularTax = f?.incomeTax || 0;
    if (regularTax > 0 && amtResult.tentativeMinimumTax > regularTax * 0.90) {
      const gap = regularTax - amtResult.tentativeMinimumTax;
      warnings.push({
        stepId: 'amt_review',
        field: 'amt.tentativeMinimumTax',
        message: `Your tentative minimum tax ($${amtResult.tentativeMinimumTax.toLocaleString()}) is within $${gap.toLocaleString()} of your regular tax. Small changes to deductions or income could trigger AMT.`,
      });
    }
  }

  // ── Proximity alerts (percentage-based bands) ─────────────────────────

  // NIIT proximity: approaching the 3.8% surtax threshold (10% band)
  if (agi != null && investmentIncome > 0) {
    const niitThreshold = isMFJorQSS ? 250000 : (isMFS ? 125000 : 200000);
    if (isApproaching(agi, niitThreshold, 0.10)) {
      warnings.push({
        stepId: 'income_summary',
        field: 'niit.proximity',
        message: `Your AGI ($${agi.toLocaleString()}) is within 10% of the $${niitThreshold.toLocaleString()} NIIT threshold. Exceeding it would trigger a 3.8% surtax on $${investmentIncome.toLocaleString()} of investment income.`,
      });
    }
  }

  // SALT cap proximity: approaching the $40,000 deduction cap (15% band)
  const saltEnteredTotal = (taxReturn.itemizedDeductions?.stateLocalIncomeTax || 0) +
    (taxReturn.itemizedDeductions?.realEstateTax || 0) +
    (taxReturn.itemizedDeductions?.personalPropertyTax || 0);
  if (saltEnteredTotal > 0 && isApproaching(saltEnteredTotal, 40000, 0.15)) {
    warnings.push({
      stepId: 'itemized_deductions',
      field: 'itemizedDeductions.salt.proximity',
      message: `Your SALT total ($${saltEnteredTotal.toLocaleString()}) is within 15% of the $40,000 cap. Amounts above $40,000 are not deductible.`,
    });
  }

  // QBI phase-in proximity: approaching the SSTB limitation threshold (10% band)
  const taxableIncome = calculation?.form1040?.taxableIncome;
  const qbiDeduction = calculation?.form1040?.qbiDeduction;
  if (taxableIncome != null && qbiDeduction != null && qbiDeduction > 0) {
    const qbiThreshold = isMFJorQSS ? 394600 : 197300;
    if (isApproaching(taxableIncome, qbiThreshold, 0.10)) {
      warnings.push({
        stepId: 'deductions_summary',
        field: 'qbi.proximity',
        message: `Your taxable income ($${taxableIncome.toLocaleString()}) is within 10% of the $${qbiThreshold.toLocaleString()} QBI phase-out threshold. Above this, the 20% deduction may be limited for specified service businesses.`,
      });
    }
  }

  // ACA subsidy cliff proximity: approaching 400% FPL (5% band)
  const ptcResult = calculation?.premiumTaxCredit;
  if (ptcResult && ptcResult.fplPercentage > 0) {
    if (isApproaching(ptcResult.fplPercentage, 400, 0.05)) {
      warnings.push({
        stepId: 'premium_tax_credit',
        field: 'premiumTaxCredit.fplPercentage.proximity',
        message: `Your household income is ${ptcResult.fplPercentage.toFixed(0)}% of the Federal Poverty Level — within 5% of the 400% threshold. Above 400% FPL, your premium contribution rate caps at 8.5% of income.`,
      });
    }
  }

  // ── AMT data warnings ───────────────────────────────────────────────────
  const amtData = taxReturn.amtData;
  if (amtData) {
    // ISO spread without a stock sale → remind about AMT credit (Form 8801)
    if ((amtData.isoExerciseSpread || 0) > 0) {
      const hasStockSales = (taxReturn.income1099B || []).length > 0;
      if (!hasStockSales) {
        warnings.push({
          stepId: 'amt_data',
          field: 'amtData.isoExerciseSpread',
          message: `You reported an ISO exercise spread of $${(amtData.isoExerciseSpread || 0).toLocaleString()} but have no stock sales (1099-B). If this AMT is from timing differences, you may be able to claim an AMT credit (Form 8801) in future years when you sell the stock.`,
        });
      }
    }

    // AMTFTC entered without regular foreign tax credit → flag inconsistency
    if ((amtData.amtForeignTaxCredit || 0) > 0 && !calculation?.foreignTaxCredit) {
      warnings.push({
        stepId: 'amt_data',
        field: 'amtData.amtForeignTaxCredit',
        message: 'You entered an AMT foreign tax credit but have no regular foreign tax credit. The AMTFTC is typically based on foreign taxes paid — verify this entry is correct.',
      });
    }
  }

  // AMT > 20% of regular tax → suggest professional review
  if (amtResult && amtResult.applies && amtResult.regularTax > 0) {
    const amtPct = amtResult.amtAmount / amtResult.regularTax;
    if (amtPct > 0.20) {
      warnings.push({
        stepId: 'amt_review',
        field: 'amt.highRatio',
        message: `Your AMT ($${amtResult.amtAmount.toLocaleString()}) is ${(amtPct * 100).toFixed(0)}% of your regular tax. This is a significant AMT impact — consider consulting a tax professional to explore strategies for reducing AMT exposure.`,
      });
    }
  }

  // ── Plausibility warnings (from shared engine) ─────────────────────────
  // These WARN-level checks flag implausible but not invalid values
  // (e.g., W-2 wages > $1M, charitable > 50% of AGI).
  const plausibilityWarnings = checkPlausibility(taxReturn, agi ?? undefined);
  for (const pw of plausibilityWarnings) {
    warnings.push({
      stepId: pw.stepId,
      field: pw.field,
      message: pw.message,
      itemIndex: pw.itemIndex,
      itemLabel: pw.itemLabel,
    });
  }

  // ── Schedule B Part III: incomplete foreign accounts answers ───────────
  const partIII = taxReturn.scheduleBPartIII;
  if (partIII?.hasForeignAccounts === true && partIII.requireFBAR == null) {
    warnings.push({
      stepId: 'income_summary',
      field: 'scheduleBPartIII.requireFBAR',
      message: 'You indicated you have foreign financial accounts but haven\'t answered whether you\'re required to file FinCEN Form 114 (FBAR). Please complete this in the Schedule B — Foreign Accounts section.',
    });
  }
  if (partIII?.hasForeignAccounts === true && partIII?.requireFBAR === true && !partIII.foreignAccountCountries?.trim()) {
    warnings.push({
      stepId: 'income_summary',
      field: 'scheduleBPartIII.foreignAccountCountries',
      message: 'You indicated you are required to file an FBAR but haven\'t listed the country name(s). Please enter the countries in the Schedule B — Foreign Accounts section.',
    });
  }

  // ── K-1: Sanctioned country FTC disallowance (IRC §901(j)) ──────────
  (taxReturn.incomeK1 || []).forEach((k1, idx) => {
    const country = (k1.box15ForeignCountry || '').trim();
    if (country && SANCTIONED_COUNTRIES.some(sc => country.toLowerCase().includes(sc.toLowerCase()))) {
      if ((k1.box15ForeignTaxPaid || 0) > 0) {
        warnings.push({
          stepId: 'k1_income',
          field: `incomeK1[${idx}].box15ForeignCountry`,
          message: `Foreign tax credit is disallowed for income from ${country} under IRC §901(j). The $${(k1.box15ForeignTaxPaid || 0).toLocaleString()} in foreign tax paid cannot be claimed as a credit.`,
          itemIndex: idx,
          itemLabel: k1.entityName || `K-1 ${idx + 1}`,
        });
      } else {
        warnings.push({
          stepId: 'k1_income',
          field: `incomeK1[${idx}].box15ForeignCountry`,
          message: `${country} is a sanctioned country under IRC §901(j). Foreign tax credits are disallowed for income sourced from this country.`,
          itemIndex: idx,
          itemLabel: k1.entityName || `K-1 ${idx + 1}`,
        });
      }
    }
  });

  // ── Group by step ─────────────────────────────────────────────────────
  const grouped = new Map<string, ValidationWarning[]>();
  for (const warning of warnings) {
    const existing = grouped.get(warning.stepId) || [];
    existing.push(warning);
    grouped.set(warning.stepId, existing);
  }

  const result: WarningsByStep[] = [];
  for (const [stepId, stepWarnings] of grouped.entries()) {
    const step = WIZARD_STEPS.find((s) => s.id === stepId);
    result.push({
      stepId,
      stepLabel: step?.label || stepId,
      warnings: stepWarnings,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a specific step has any warnings. */
export function hasWarningsForStep(stepId: string, warnings: WarningsByStep[]): boolean {
  return warnings.some((w) => w.stepId === stepId);
}

/** Get total warning count across all steps. */
export function getTotalWarningCount(warnings: WarningsByStep[]): number {
  return warnings.reduce((sum, w) => sum + w.warnings.length, 0);
}
