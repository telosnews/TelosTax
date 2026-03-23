import { RentalProperty, RoyaltyProperty, ScheduleEResult, PropertyResult, RoyaltyPropertyResult } from '../types/index.js';
import { round2 } from './utils.js';

/**
 * Calculate Schedule E — Rental and Royalty Income.
 *
 * For each rental property, compute net income (income - expenses).
 *
 * Personal use day rules (IRS Pub 527):
 *   1. If rented < 15 days/year: income is tax-free, no expenses deductible.
 *      (The "14-day exclusion" / "Augusta rule.")
 *   2. If personal use > greater of (14 days) or (10% of rental days):
 *      property is "personal use" — expenses prorated by rental ratio,
 *      and deductible expenses cannot exceed rental income (no loss allowed).
 *   3. Otherwise: normal Schedule E treatment.
 *
 * Returns raw net rental income (before passive loss limitation).
 * Form 8582 applies the IRC §469 passive activity loss limitation on top.
 *
 * Royalty income (1099-MISC Box 2 + K-1 Box 7) flows through Schedule E Line 4.
 * Royalties are NOT subject to passive activity loss rules (not passive income),
 * so they are tracked separately.
 *
 * @authority
 *   IRC: Section 469 — passive activity losses and credits limited
 *   IRC: Section 469(i) — $25,000 offset for rental real estate activities
 *   Form: Schedule E (Form 1040), Part I
 *   Pub: Publication 925 — Passive Activity and At-Risk Rules
 * @scope Rental income computation + per-property detail; passive loss via Form 8582
 * @limitations No at-risk rules (Section 465), no material participation tests
 */
export function calculateScheduleE(
  properties: RentalProperty[],
  k1RentalIncome: number = 0,
  misc1099Rents: number = 0,
  royaltyIncome: number = 0,
  royaltyProperties: RoyaltyProperty[] = [],
): ScheduleEResult {
  const hasAnyIncome = (properties && properties.length > 0) ||
    k1RentalIncome !== 0 || misc1099Rents !== 0 || royaltyIncome !== 0 ||
    (royaltyProperties && royaltyProperties.length > 0);

  if (!hasAnyIncome) {
    return {
      totalRentalIncome: 0,
      totalRentalExpenses: 0,
      netRentalIncome: 0,
      allowableLoss: 0,
      suspendedLoss: 0,
      royaltyIncome: 0,
      totalRoyaltyExpenses: 0,
      scheduleEIncome: 0,
    };
  }

  let totalRentalIncome = 0;
  let totalRentalExpenses = 0;
  const propertyResults: PropertyResult[] = [];

  for (const prop of properties) {
    const daysRented = prop.daysRented || 0;
    const personalUseDays = prop.personalUseDays || 0;

    // Rule 1: Rented fewer than 15 days — income is tax-free, no expenses
    if (daysRented < 15) {
      propertyResults.push({
        id: prop.id,
        address: prop.address || '',
        rentalIncome: 0,
        totalExpenses: 0,
        netIncome: 0,
        isPersonalUse: false,
        isExcluded: true,
      });
      continue;
    }

    const rawExpenses = getPropertyExpenses(prop);

    // Rule 2: Check if property qualifies as "personal use"
    // Personal use if: personal days > greater of 14 or 10% of rental days
    const personalUseThreshold = Math.max(14, Math.floor(daysRented * 0.10));
    const isPersonalUse = personalUseDays > personalUseThreshold;

    if (isPersonalUse) {
      // Prorate expenses by rental ratio (rental days / total days)
      const totalDays = daysRented + personalUseDays;
      const rentalRatio = totalDays > 0 ? daysRented / totalDays : 0;
      const proratedExpenses = round2(rawExpenses * rentalRatio);

      // Expenses limited to rental income (no loss allowed for personal-use property)
      const income = prop.rentalIncome || 0;
      const allowableExpenses = Math.min(proratedExpenses, income);

      totalRentalIncome += income;
      totalRentalExpenses += allowableExpenses;

      propertyResults.push({
        id: prop.id,
        address: prop.address || '',
        rentalIncome: round2(income),
        totalExpenses: round2(allowableExpenses),
        netIncome: round2(income - allowableExpenses),
        isPersonalUse: true,
        isExcluded: false,
      });
    } else {
      // Normal Schedule E: full expenses against income
      const income = prop.rentalIncome || 0;
      totalRentalIncome += income;
      totalRentalExpenses += rawExpenses;

      propertyResults.push({
        id: prop.id,
        address: prop.address || '',
        rentalIncome: round2(income),
        totalExpenses: round2(rawExpenses),
        netIncome: round2(income - rawExpenses),
        isPersonalUse: false,
        isExcluded: false,
      });
    }
  }

  totalRentalIncome = round2(totalRentalIncome);
  totalRentalExpenses = round2(totalRentalExpenses);
  const netDirectRental = round2(totalRentalIncome - totalRentalExpenses);

  // Include K-1 rental income (Box 2) — this is passive income that nets with direct rentals
  // K-1 rental income can be positive (profit) or negative (loss)
  if (k1RentalIncome !== 0) {
    totalRentalIncome = round2(totalRentalIncome + k1RentalIncome);
  }

  // Include 1099-MISC Box 1 rents — supplemental rental income without per-property tracking
  if (misc1099Rents !== 0) {
    totalRentalIncome = round2(totalRentalIncome + misc1099Rents);
  }

  const netRentalIncome = round2(netDirectRental + k1RentalIncome + misc1099Rents);

  // ── Royalty Properties ─────────────────────────────────────────
  const royaltyPropertyResults: RoyaltyPropertyResult[] = [];
  let totalRoyaltyPropertyIncome = 0;
  let totalRoyaltyExpenses = 0;

  for (const rp of royaltyProperties) {
    const expenses = getPropertyExpenses(rp as any); // Same expense fields as rental
    const net = round2(rp.royaltyIncome - expenses);
    totalRoyaltyPropertyIncome += rp.royaltyIncome;
    totalRoyaltyExpenses += expenses;
    royaltyPropertyResults.push({
      id: rp.id,
      description: rp.description,
      royaltyIncome: rp.royaltyIncome,
      totalExpenses: expenses,
      netIncome: net,
    });
  }

  // Total royalties = royalty properties + 1099-MISC + K-1 (passed as royaltyIncome param)
  const totalRoyalties = round2(totalRoyaltyPropertyIncome + royaltyIncome);
  const netRoyalties = round2(totalRoyalties - totalRoyaltyExpenses);

  // Return raw numbers — passive loss limitation is applied by Form 8582
  // allowableLoss and suspendedLoss are set to 0 here; Form 8582 sets the actual values
  // scheduleEIncome = raw net rental + net royalties (Form 8582 adjusts in the orchestrator)
  return {
    totalRentalIncome,
    totalRentalExpenses,
    netRentalIncome,
    allowableLoss: 0,
    suspendedLoss: 0,
    royaltyIncome: totalRoyalties,
    totalRoyaltyExpenses,
    scheduleEIncome: round2(netRentalIncome + netRoyalties),
    propertyResults,
    royaltyPropertyResults: royaltyPropertyResults.length > 0 ? royaltyPropertyResults : undefined,
  };
}

/**
 * Sum all expense line items for a rental property.
 */
function getPropertyExpenses(prop: RentalProperty): number {
  return (
    (prop.advertising || 0) +
    (prop.auto || 0) +
    (prop.cleaning || 0) +
    (prop.commissions || 0) +
    (prop.insurance || 0) +
    (prop.legal || 0) +
    (prop.management || 0) +
    (prop.mortgageInterest || 0) +
    (prop.otherInterest || 0) +
    (prop.repairs || 0) +
    (prop.supplies || 0) +
    (prop.taxes || 0) +
    (prop.utilities || 0) +
    (prop.depreciation || 0) +
    (prop.otherExpenses || 0)
  );
}
