/**
 * Tax Calendar Service
 *
 * Generates a personalized list of forward-looking tax deadlines based on
 * a taxpayer's return data. Pure function, no side effects.
 *
 * Context: TelosTax handles the 2025 tax year. Users file in early 2026.
 * All deadlines shown are forward-looking — filing deadlines, contribution
 * deadlines, and 2026 estimated payments derived from the 2025 return.
 */

import type { TaxReturn, CalculationResult } from '@telostax/engine';

// ─── Types ──────────────────────────────────────────

export type DeadlineType = 'filing' | 'payment' | 'contribution' | 'extension';
export type DeadlineStatus = 'upcoming' | 'due_soon' | 'overdue' | 'completed';

export interface TaxDeadline {
  id: string;
  label: string;
  date: string;           // ISO date string "YYYY-MM-DD"
  type: DeadlineType;
  amount?: number;
  status: DeadlineStatus;
  notes: string;
  applicable: boolean;
}

export interface TaxCalendar {
  deadlines: TaxDeadline[];
  nextDeadline: TaxDeadline | null;
}

// ─── Constants ──────────────────────────────────────

const FILING_DEADLINE = '2026-04-15';
const EXTENSION_DEADLINE = '2026-10-15';

const ESTIMATED_PAYMENT_DATES = {
  Q1: '2026-04-15',
  Q2: '2026-06-16',
  Q3: '2026-09-15',
  Q4: '2027-01-15',
} as const;

// ─── Core Function ──────────────────────────────────

export function calculateTaxCalendar(
  taxReturn: TaxReturn,
  calculation: CalculationResult | undefined,
  currentDate: Date = new Date(),
): TaxCalendar {
  const deadlines: TaxDeadline[] = [];
  const today = toDateString(currentDate);

  const extended = !!taxReturn.extensionFiled;

  // 1. Tax filing deadline — always present
  deadlines.push({
    id: 'filing_deadline',
    label: extended ? 'Original Filing Deadline (Extension Filed)' : 'Tax Filing Deadline',
    date: FILING_DEADLINE,
    type: 'filing',
    status: extended ? 'completed' : getStatus(FILING_DEADLINE, today),
    notes: extended
      ? 'Extension granted — your new deadline is October 15, 2026. Taxes owed were still due by this date.'
      : 'File Form 1040 or request an extension (Form 4868)',
    applicable: true,
  });

  // 2. IRA/Roth contribution deadline
  const hasIRA = (taxReturn.iraContribution ?? 0) > 0;
  deadlines.push({
    id: 'ira_contribution',
    label: '2025 IRA/Roth Contribution Deadline',
    date: FILING_DEADLINE,
    type: 'contribution',
    status: getStatus(FILING_DEADLINE, today),
    notes: 'Last day to make IRA or Roth IRA contributions for the 2025 tax year',
    applicable: hasIRA,
  });

  // 3. HSA contribution deadline
  const hasHSA = (taxReturn.hsaDeduction ?? 0) > 0 || !!taxReturn.hsaContribution;
  deadlines.push({
    id: 'hsa_contribution',
    label: '2025 HSA Contribution Deadline',
    date: FILING_DEADLINE,
    type: 'contribution',
    status: getStatus(FILING_DEADLINE, today),
    notes: 'Last day to make HSA contributions for the 2025 tax year',
    applicable: hasHSA,
  });

  // 4. Solo 401(k) employer contribution deadline
  const sed = taxReturn.selfEmploymentDeductions;
  const hasSolo401k = sed && (
    (sed.solo401kEmployerContribution ?? 0) > 0 ||
    (sed.solo401kEmployeeDeferral ?? 0) > 0 ||
    (sed.solo401kContributions ?? 0) > 0
  );
  const solo401kDate = extended ? EXTENSION_DEADLINE : FILING_DEADLINE;
  deadlines.push({
    id: 'solo401k_employer',
    label: 'Solo 401(k) Employer Contribution Deadline',
    date: solo401kDate,
    type: 'contribution',
    status: getStatus(solo401kDate, today),
    notes: extended
      ? 'Extended deadline — employer profit-sharing contributions due by October 15'
      : 'Employer profit-sharing contributions due by filing deadline (Oct 15 if extended)',
    applicable: !!hasSolo401k,
  });

  // 5. 2026 estimated quarterly payments
  // When we have a calculation, use the engine's quarterly amount to determine
  // obligation (no point showing deadlines if the amount is $0). Fall back to
  // SE income detection only when calculation isn't available yet.
  const quarterlyAmount = calculation?.form1040?.estimatedQuarterlyPayment;
  const needsEstimated = quarterlyAmount != null
    ? quarterlyAmount > 0
    : hasEstimatedPaymentObligation(taxReturn, calculation);

  const quarters = [
    { id: 'est_q1', label: '2026 Q1 Estimated Payment', date: ESTIMATED_PAYMENT_DATES.Q1 },
    { id: 'est_q2', label: '2026 Q2 Estimated Payment', date: ESTIMATED_PAYMENT_DATES.Q2 },
    { id: 'est_q3', label: '2026 Q3 Estimated Payment', date: ESTIMATED_PAYMENT_DATES.Q3 },
    { id: 'est_q4', label: '2026 Q4 Estimated Payment', date: ESTIMATED_PAYMENT_DATES.Q4 },
  ];

  for (const q of quarters) {
    deadlines.push({
      id: q.id,
      label: q.label,
      date: q.date,
      type: 'payment',
      amount: quarterlyAmount && quarterlyAmount > 0 ? quarterlyAmount : undefined,
      status: getStatus(q.date, today),
      notes: 'Pay via IRS Direct Pay or EFTPS',
      applicable: needsEstimated,
    });
  }

  // 6. Extension deadline
  deadlines.push({
    id: 'extension_deadline',
    label: extended ? 'Extended Filing Deadline' : 'Extension Deadline (if filed)',
    date: EXTENSION_DEADLINE,
    type: extended ? 'filing' : 'extension',
    status: getStatus(EXTENSION_DEADLINE, today),
    notes: extended
      ? 'You must file your return by this date. This is your final deadline.'
      : 'File Form 4868 by April 15 for an automatic 6-month extension to this date',
    applicable: true,
  });

  // Filter to applicable deadlines only
  const applicable = deadlines.filter(d => d.applicable);

  // Find next upcoming/due_soon deadline (skip completed and overdue)
  const nextDeadline = applicable
    .filter(d => d.status !== 'overdue' && d.status !== 'completed')
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;

  return { deadlines: applicable, nextDeadline };
}

// ─── Helpers ────────────────────────────────────────

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getStatus(deadlineDate: string, today: string): DeadlineStatus {
  if (today > deadlineDate) return 'overdue';

  // Check if within 30 days
  const deadline = new Date(deadlineDate + 'T00:00:00');
  const current = new Date(today + 'T00:00:00');
  const diffMs = deadline.getTime() - current.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 30) return 'due_soon';
  return 'upcoming';
}

/**
 * Determines if the taxpayer likely needs to make estimated payments.
 * Triggers on: SE income (Schedule C, 1099-NEC, K-1, Schedule F)
 * or when the engine calculates $1k+ owed.
 */
function hasEstimatedPaymentObligation(
  taxReturn: TaxReturn,
  calculation: CalculationResult | undefined,
): boolean {
  // SE income sources
  if ((taxReturn.businesses?.length ?? 0) > 0) return true;
  if ((taxReturn.income1099NEC?.length ?? 0) > 0) return true;
  if ((taxReturn.incomeK1?.length ?? 0) > 0) return true;
  if (taxReturn.scheduleF) return true;

  // Engine says $1k+ owed
  if (calculation?.form1040?.amountOwed && calculation.form1040.amountOwed >= 1000) return true;

  return false;
}

/** Format ISO date string to readable format: "Apr 15, 2026" */
export function formatDeadlineDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
