import { Form4137Result } from '../types/index.js';
import { FORM_4137 } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Social Security and Medicare Tax on Unreported Tip Income (Form 4137).
 *
 * Employees who receive tips but don't report them to their employer owe the
 * employee share of FICA taxes on those tips. This is the employee's share only
 * (not the employer portion).
 *
 * The SS tax applies only up to the SS wage base ($176,100 for 2025), considering
 * W-2 Social Security wages already reported. Medicare has no wage base cap.
 *
 * Unreported tips also count as earned income for EITC purposes.
 *
 * @authority
 *   IRC: Section 3121(q) — tips treated as wages for FICA purposes
 *   IRC: Section 3101(a) — employee SS rate (6.2%)
 *   IRC: Section 3101(b) — employee Medicare rate (1.45%)
 *   Form: Form 4137
 * @scope Employee FICA on unreported tips with SS wage base coordination
 * @limitations Does not handle Additional Medicare Tax (0.9%) on tips — that is computed separately
 */
export function calculateForm4137(
  unreportedTips: number,
  w2SocialSecurityWages: number = 0,
): Form4137Result {
  const zero: Form4137Result = {
    unreportedTips: 0,
    socialSecurityTax: 0,
    medicareTax: 0,
    totalTax: 0,
    tipsSubjectToSS: 0,
    tipsSubjectToMedicare: 0,
  };

  if (unreportedTips <= 0) return zero;

  const tips = round2(unreportedTips);

  // Medicare: no wage base cap — all unreported tips subject to Medicare
  const tipsSubjectToMedicare = tips;
  const medicareTax = round2(tipsSubjectToMedicare * FORM_4137.MEDICARE_RATE);

  // Social Security: subject to SS wage base ($176,100 for 2025)
  // W-2 SS wages already count toward the wage base cap
  const remainingWageBase = round2(Math.max(0, FORM_4137.SS_WAGE_BASE - w2SocialSecurityWages));
  const tipsSubjectToSS = round2(Math.min(tips, remainingWageBase));
  const socialSecurityTax = round2(tipsSubjectToSS * FORM_4137.SS_RATE);

  const totalTax = round2(socialSecurityTax + medicareTax);

  return {
    unreportedTips: tips,
    socialSecurityTax,
    medicareTax,
    totalTax,
    tipsSubjectToSS,
    tipsSubjectToMedicare,
  };
}
