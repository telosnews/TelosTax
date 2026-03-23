/**
 * Pre-export readiness checks.
 *
 * Distinguishes two severity levels:
 *   BLOCKER  — Missing data that makes the return un-fileable (e.g., no name,
 *              no filing status). Blocks PDF/IRS export until resolved.
 *   WARNING  — Existing advisory warnings from warningService.ts.
 *              Surfaced in the export gate but do NOT block download.
 *
 * The readiness check runs every time ExportPdfStep renders and feeds
 * into a pre-export validation panel.
 */

import type { TaxReturn } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReadinessIssue {
  severity: 'blocker' | 'warning';
  section: string;      // human-readable section name
  stepId: string;       // wizard step id for "Go fix" navigation
  message: string;
}

export interface ReadinessResult {
  ready: boolean;           // true when zero blockers
  blockers: ReadinessIssue[];
  blockerCount: number;
}

// ---------------------------------------------------------------------------
// Required-field checks
// ---------------------------------------------------------------------------

export function checkExportReadiness(taxReturn: TaxReturn): ReadinessResult {
  const blockers: ReadinessIssue[] = [];

  // ── Personal Info ──────────────────────────────────────────────
  if (!taxReturn.firstName?.trim()) {
    blockers.push({
      severity: 'blocker',
      section: 'Personal Info',
      stepId: 'personal_info',
      message: 'First name is required.',
    });
  }

  if (!taxReturn.lastName?.trim()) {
    blockers.push({
      severity: 'blocker',
      section: 'Personal Info',
      stepId: 'personal_info',
      message: 'Last name is required.',
    });
  }

  // ── Filing Status ──────────────────────────────────────────────
  if (!taxReturn.filingStatus) {
    blockers.push({
      severity: 'blocker',
      section: 'Filing Status',
      stepId: 'filing_status',
      message: 'Filing status is required.',
    });
  }

  // ── MFJ: spouse name required ──────────────────────────────────
  if (taxReturn.filingStatus === FilingStatus.MarriedFilingJointly) {
    if (!taxReturn.spouseFirstName?.trim()) {
      blockers.push({
        severity: 'blocker',
        section: 'Filing Status',
        stepId: 'filing_status',
        message: 'Spouse first name is required for Married Filing Jointly.',
      });
    }
    if (!taxReturn.spouseLastName?.trim()) {
      blockers.push({
        severity: 'blocker',
        section: 'Filing Status',
        stepId: 'filing_status',
        message: 'Spouse last name is required for Married Filing Jointly.',
      });
    }
  }

  // ── Address ────────────────────────────────────────────────────
  if (!taxReturn.addressStreet?.trim()) {
    blockers.push({
      severity: 'blocker',
      section: 'Personal Info',
      stepId: 'personal_info',
      message: 'Street address is required.',
    });
  }

  if (!taxReturn.addressCity?.trim()) {
    blockers.push({
      severity: 'blocker',
      section: 'Personal Info',
      stepId: 'personal_info',
      message: 'City is required.',
    });
  }

  if (!taxReturn.addressState?.trim()) {
    blockers.push({
      severity: 'blocker',
      section: 'Personal Info',
      stepId: 'personal_info',
      message: 'State is required.',
    });
  }

  if (!taxReturn.addressZip?.trim()) {
    blockers.push({
      severity: 'blocker',
      section: 'Personal Info',
      stepId: 'personal_info',
      message: 'ZIP code is required.',
    });
  }

  // ── Income: at least one income source ─────────────────────────
  const hasAnyIncome =
    (taxReturn.w2Income?.length || 0) > 0 ||
    (taxReturn.income1099NEC?.length || 0) > 0 ||
    (taxReturn.income1099K?.length || 0) > 0 ||
    (taxReturn.income1099INT?.length || 0) > 0 ||
    (taxReturn.income1099DIV?.length || 0) > 0 ||
    (taxReturn.income1099R?.length || 0) > 0 ||
    (taxReturn.income1099G?.length || 0) > 0 ||
    (taxReturn.income1099MISC?.length || 0) > 0 ||
    (taxReturn.income1099B?.length || 0) > 0 ||
    (taxReturn.income1099DA?.length || 0) > 0 ||
    (taxReturn.incomeK1?.length || 0) > 0 ||
    (taxReturn.incomeSSA1099 != null) ||
    (taxReturn.incomeW2G?.length || 0) > 0 ||
    (taxReturn.businesses?.length || 0) > 0 ||
    (taxReturn.rentalProperties?.length || 0) > 0 ||
    (taxReturn.otherIncome || 0) !== 0;

  if (!hasAnyIncome) {
    blockers.push({
      severity: 'blocker',
      section: 'Income',
      stepId: 'income_overview',
      message: 'No income sources entered. Add at least one income item before exporting.',
    });
  }

  // ── W-2: each W-2 must have wages ─────────────────────────────
  (taxReturn.w2Income || []).forEach((w2, idx) => {
    if (!w2.wages && w2.wages !== 0) {
      blockers.push({
        severity: 'blocker',
        section: 'W-2 Income',
        stepId: 'w2_income',
        message: `W-2 #${idx + 1}${w2.employerName ? ` (${w2.employerName})` : ''}: Wages amount is required.`,
      });
    }
  });

  // ── HoH: requires at least one dependent ──────────────────────
  if (
    taxReturn.filingStatus === FilingStatus.HeadOfHousehold &&
    (taxReturn.dependents?.length || 0) === 0
  ) {
    blockers.push({
      severity: 'blocker',
      section: 'Dependents',
      stepId: 'dependents',
      message: 'Head of Household requires at least one qualifying dependent.',
    });
  }

  return {
    ready: blockers.length === 0,
    blockers,
    blockerCount: blockers.length,
  };
}
