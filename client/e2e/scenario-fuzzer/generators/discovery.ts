/**
 * Discovery flag derivation — inspects populated TaxReturn data and
 * sets the matching incomeDiscovery keys to 'yes'.
 *
 * This is critical: wizard step visibility depends on these flags
 * (see dcDiscovery() conditions in taxReturnStore.ts).
 */

import type { FuzzerTaxReturn } from './base';

/** Inspect a populated TaxReturn and set incomeDiscovery flags. */
export function deriveDiscoveryFlags(tr: FuzzerTaxReturn): void {
  const d: Record<string, string> = {};

  // Income forms
  if (tr.w2Income.length > 0) d['w2'] = 'yes';
  if (tr.income1099NEC.length > 0) d['1099nec'] = 'yes';
  if (tr.income1099K.length > 0) d['1099k'] = 'yes';
  if (tr.income1099INT.length > 0) d['1099int'] = 'yes';
  if (tr.income1099DIV.length > 0) d['1099div'] = 'yes';
  if (tr.income1099R.length > 0) d['1099r'] = 'yes';
  if (tr.income1099G.length > 0) d['1099g'] = 'yes';
  if (tr.income1099MISC.length > 0) d['1099misc'] = 'yes';
  if (tr.income1099B.length > 0) d['1099b'] = 'yes';
  if (tr.income1099DA.length > 0) d['1099da'] = 'yes';
  if (tr.incomeSSA1099) d['ssa1099'] = 'yes';
  if (tr.incomeK1.length > 0) d['k1'] = 'yes';
  if (tr.income1099SA.length > 0) d['1099sa'] = 'yes';
  if (tr.rentalProperties.length > 0) d['rental'] = 'yes';
  if (tr.incomeW2G.length > 0) d['w2g'] = 'yes';
  if (tr.income1099C.length > 0) d['1099c'] = 'yes';
  if (tr.income1099Q.length > 0) d['1099q'] = 'yes';
  if (tr.otherIncome) d['other'] = 'yes';

  // Other income situations
  if (tr.homeSale) d['home_sale'] = 'yes';
  if (tr.foreignEarnedIncome) d['foreign_income'] = 'yes';
  if (tr.form4797Properties && tr.form4797Properties.length > 0) d['form4797'] = 'yes';
  if (tr.scheduleF) d['schedule_f'] = 'yes';

  // Credits
  if (tr.childTaxCredit) d['child_credit'] = 'yes';
  if (tr.educationCredits.length > 0) d['education_credit'] = 'yes';
  if (tr.dependentCare) d['dependent_care'] = 'yes';
  if (tr.saversCredit) d['savers_credit'] = 'yes';
  if (tr.cleanEnergy) d['clean_energy'] = 'yes';
  if (tr.evCredit) d['ev_credit'] = 'yes';
  if (tr.energyEfficiency) d['energy_efficiency'] = 'yes';
  if (tr.evRefuelingCredit) d['ev_refueling'] = 'yes';
  if (tr.adoptionCredit) d['adoption_credit'] = 'yes';
  if (tr.premiumTaxCredit) d['premium_tax_credit'] = 'yes';
  if (tr.scheduleR) d['elderly_disabled'] = 'yes';
  if (tr.foreignTaxCreditCategories && tr.foreignTaxCreditCategories.length > 0) d['foreign_tax_credit'] = 'yes';

  // Deduction-related discovery
  if (tr.estimatedPaymentsMade) d['ded_estimated_payments'] = 'yes';
  if (tr.schedule1A) d['schedule1a'] = 'yes';
  if (tr.investmentInterest) d['investment_interest'] = 'yes';
  if (tr.form8606) d['form8606'] = 'yes';
  if (tr.householdEmployees) d['schedule_h'] = 'yes';
  if (tr.excessContributions) d['form5329'] = 'yes';
  if (tr.qbiInfo) d['qbi_detail'] = 'yes';
  if (tr.amtData) d['amt_data'] = 'yes';

  // Digital asset activity
  if (tr.income1099DA.length > 0) {
    tr.digitalAssetActivity = true;
  }

  tr.incomeDiscovery = d;
}
