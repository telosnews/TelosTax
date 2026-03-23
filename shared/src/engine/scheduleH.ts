import { HouseholdEmployeeInfo, ScheduleHResult } from '../types/index.js';
import { SCHEDULE_H } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Schedule H — Household Employee ("Nanny") Tax.
 *
 * If you paid any single household employee cash wages of $2,800+ in 2025,
 * you owe BOTH the employer's AND employee's share of Social Security and
 * Medicare taxes. The employer reports and pays the full combined amount
 * on Schedule H, which is added to Form 1040 total tax.
 *
 * FUTA tax applies if you paid $1,000+ in any calendar quarter.
 *
 * Social Security: 12.4% combined (6.2% employer + 6.2% employee) on wages up to $176,100
 * Medicare: 2.9% combined (1.45% employer + 1.45% employee) on all wages
 * FUTA: 0.6% on first $7,000 per employee (employer only)
 *
 * Per IRS Schedule H instructions: Line 2 = wages × 12.4%, Line 4 = wages × 2.9%.
 * The employer may withhold the employee's share from wages, but reports and remits
 * the full combined amount on Schedule H.
 *
 * @authority
 *   IRC: Section 3111(a) — employer SS tax rate (6.2%)
 *   IRC: Section 3101(a) — employee SS tax rate (6.2%)
 *   IRC: Section 3111(b) — employer Medicare tax rate (1.45%)
 *   IRC: Section 3101(b) — employee Medicare tax rate (1.45%)
 *   IRC: Section 3301 — rate of FUTA tax
 *   IRC: Section 3121(x) — domestic service employment threshold
 *   Form: Schedule H (Form 1040), Lines 2 and 4
 * @scope Household employee tax (combined SS + Medicare + FUTA)
 * @limitations None
 */
export function calculateScheduleH(info: HouseholdEmployeeInfo): ScheduleHResult {
  const zero: ScheduleHResult = {
    socialSecurityTax: 0,
    medicareTax: 0,
    futaTax: 0,
    totalTax: 0,
  };

  if (!info || info.totalCashWages <= 0) return zero;

  // Below threshold: no SS/Medicare obligation
  if (info.totalCashWages < SCHEDULE_H.CASH_WAGE_THRESHOLD) return zero;

  const c = SCHEDULE_H;

  // Social Security tax: combined employer+employee share on wages up to SS wage base
  // Schedule H Line 2: wages × 12.4% (IRC §§3111(a)+3101(a))
  const ssWageBase = c.SS_WAGE_BASE;
  const ssWages = Math.min(info.totalCashWages, ssWageBase);
  const socialSecurityTax = round2(ssWages * c.SS_RATE);

  // Medicare tax: combined employer+employee share on all wages (no cap)
  // Schedule H Line 4: wages × 2.9% (IRC §§3111(b)+3101(b))
  const medicareTax = round2(info.totalCashWages * c.MEDICARE_RATE);

  // FUTA: 0.6% on first $7,000 per employee (employer only)
  // Schedule H Line 9: "Did you pay $1,000 or more in any calendar quarter?"
  // If subjectToFUTA is explicitly set, use that; otherwise auto-detect from total wages
  const numEmployees = Math.max(1, info.numberOfEmployees || 1);
  const futaWages = Math.min(info.totalCashWages, c.FUTA_WAGE_BASE * numEmployees);
  const isFUTASubject = info.subjectToFUTA !== undefined
    ? info.subjectToFUTA
    : info.totalCashWages >= c.FUTA_WAGE_THRESHOLD;
  const futaTax = isFUTASubject
    ? round2(futaWages * c.FUTA_RATE)
    : 0;

  const totalTax = round2(socialSecurityTax + medicareTax + futaTax);

  return {
    socialSecurityTax,
    medicareTax,
    futaTax,
    totalTax,
  };
}
