/**
 * Forms Mode — Discovery Flag Synchronization
 *
 * When a user edits fields in Forms Mode, ensure the corresponding wizard
 * discovery flags are set so that wizard steps remain visible after switching
 * back to interview mode.
 */
import type { TaxReturn } from '@telostax/engine';

/** Map of formId → discovery flags that should be set when editing that form */
const FORM_DISCOVERY_MAP: Record<string, Record<string, string>> = {
  // ── Income ──
  f1040sb: { '1099int': 'yes', '1099div': 'yes' },  // Schedule B: Interest & Dividends
  f1040sc: { '1099nec': 'yes' },                     // Schedule C: Self-Employment
  f1040sd: { '1099b': 'yes' },                       // Schedule D: Capital Gains
  f1040se: { rental: 'yes', k1: 'yes' },             // Schedule E: Rental, K-1
  f1040sf: { schedule_f: 'yes' },                    // Schedule F: Farm Income
  f1040sr: { elderly_disabled: 'yes' },              // Schedule R: Elderly/Disabled Credit
  f1040sse: { '1099nec': 'yes' },                    // Schedule SE: Self-Employment Tax
  f8949: { '1099b': 'yes' },                         // Form 8949: Sales & Dispositions
  f982: { '1099c': 'yes' },                          // Form 982: Cancellation of Debt

  // ── Deductions ──
  f1040sa: { deductionMethod: 'itemized' },          // Schedule A: Itemized Deductions
  f1040sh: { schedule_h: 'yes' },                    // Schedule H: Household Employment
  f8283: { ded_charitable: 'yes' },                  // Form 8283: Noncash Charitable
  f8889: { ded_hsa: 'yes', '1099sa': 'yes' },       // Form 8889: HSA
  f3903: { '1099nec': 'yes' },                       // Form 3903: Moving Expenses (military)
  f4562: { '1099nec': 'yes' },                       // Form 4562: Depreciation/Amortization
  f7206: { ded_hsa: 'yes' },                         // Form 7206: SE Health Insurance
  f2210: { ded_estimated_payments: 'yes' },          // Form 2210: Underpayment Penalty

  // ── Credits ──
  f8863: { education_credit: 'yes' },                // Form 8863: Education Credits
  f8962: { premium_tax_credit: 'yes' },              // Form 8962: Premium Tax Credit
  f5695: { clean_energy: 'yes', energy_efficiency: 'yes' }, // Form 5695: Residential Energy
  f8936: { ev_credit: 'yes' },                       // Form 8936: EV Credit
  f8911: { ev_refueling: 'yes' },                    // Form 8911: EV Refueling
  f8839: { adoption_credit: 'yes' },                 // Form 8839: Adoption Credit
  f8615: { child_credit: 'yes' },                    // Form 8615: Child's Unearned Income

  // ── Other Forms ──
  f6251: { amt_data: 'yes' },                        // Form 6251: AMT
  f8606: { form8606: 'yes' },                        // Form 8606: Nondeductible IRAs
  f5329: { form5329: 'yes' },                        // Form 5329: Early Distribution Penalty
  f4797: { form4797: 'yes' },                        // Form 4797: Business Property Sales
  f8582: { rental: 'yes' },                          // Form 8582: Passive Activity Losses
  f2555: { foreign_income: 'yes' },                  // Form 2555: Foreign Earned Income
  f4952: { investment_interest: 'yes' },             // Form 4952: Investment Interest
  f4137: { '1099k': 'yes' },                         // Form 4137: Unreported Tip Income
};

/**
 * Ensure discovery flags are set for the given form.
 * Called after each field edit in Forms Mode.
 */
export function ensureDiscoveryFlags(
  formId: string,
  taxReturn: TaxReturn,
  updateField: (field: string, value: unknown) => void,
): void {
  const flags = FORM_DISCOVERY_MAP[formId];
  if (!flags) return;

  for (const [key, value] of Object.entries(flags)) {
    // Special case: deductionMethod is a top-level field
    if (key === 'deductionMethod') {
      if (taxReturn.deductionMethod !== value) {
        updateField('deductionMethod', value);
      }
      continue;
    }

    // Income discovery flags
    const disc = taxReturn.incomeDiscovery || {};
    if (disc[key] !== value) {
      updateField('incomeDiscovery', { ...disc, [key]: value });
    }
  }
}
