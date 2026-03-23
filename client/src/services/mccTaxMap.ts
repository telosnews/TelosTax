/**
 * MCC Tax Map — Merchant Category Code → Tax Category Lookup
 *
 * Maps ~55 tax-relevant MCC codes to deduction categories and confidence boosts.
 * Source: greggles/mcc-codes (MIT license), filtered to IRS-relevant categories.
 *
 * Bundled as a TS module (not lazy-fetched JSON) to eliminate async loading,
 * race conditions, and the need for useDeductionFinder to await MCC data.
 *
 * All processing runs client-side. Data never leaves the browser.
 */

import type { InsightCategory } from './deductionFinderTypes';

// ─── MCC Entry Type ──────────────────────────────────

export interface MCCTaxEntry {
  description: string;
  taxCategories: InsightCategory[];
  /** How much to boost confidence when MCC confirms a merchant-token match (0-1). */
  confidenceBoost: number;
}

// ─── MCC → Tax Category Map ─────────────────────────

export const MCC_TAX_MAP: Record<string, MCCTaxEntry> = {
  // ── Medical / Health ──────────────────────────────
  '4119': { description: 'Ambulance Services', taxCategories: ['medical'], confidenceBoost: 0.3 },
  '5047': { description: 'Medical/Dental/Ophthalmic Lab Equipment', taxCategories: ['medical'], confidenceBoost: 0.25 },
  '5122': { description: 'Drugs, Drug Proprietaries and Druggist Sundries', taxCategories: ['medical'], confidenceBoost: 0.2 },
  '5912': { description: 'Drug Stores and Pharmacies', taxCategories: ['medical'], confidenceBoost: 0.25 },
  '5975': { description: 'Hearing Aids', taxCategories: ['medical'], confidenceBoost: 0.3 },
  '5976': { description: 'Orthopedic Goods/Prosthetic Devices', taxCategories: ['medical'], confidenceBoost: 0.3 },
  '7277': { description: 'Counseling Services', taxCategories: ['therapy_mental_health', 'medical'], confidenceBoost: 0.25 },
  '8011': { description: 'Doctors', taxCategories: ['medical'], confidenceBoost: 0.3 },
  '8021': { description: 'Dentists and Orthodontists', taxCategories: ['medical'], confidenceBoost: 0.3 },
  '8031': { description: 'Osteopaths', taxCategories: ['medical'], confidenceBoost: 0.3 },
  '8041': { description: 'Chiropractors', taxCategories: ['medical'], confidenceBoost: 0.25 },
  '8042': { description: 'Optometrists and Ophthalmologists', taxCategories: ['medical'], confidenceBoost: 0.3 },
  '8043': { description: 'Opticians and Eyeglasses', taxCategories: ['medical'], confidenceBoost: 0.25 },
  '8049': { description: 'Podiatrists and Chiropodists', taxCategories: ['medical'], confidenceBoost: 0.3 },
  '8050': { description: 'Nursing and Personal Care Facilities', taxCategories: ['medical'], confidenceBoost: 0.25 },
  '8062': { description: 'Hospitals', taxCategories: ['medical'], confidenceBoost: 0.3 },
  '8071': { description: 'Medical and Dental Labs', taxCategories: ['medical'], confidenceBoost: 0.3 },
  '8099': { description: 'Medical Services and Health Practitioners', taxCategories: ['medical'], confidenceBoost: 0.25 },

  // ── Childcare / Education ─────────────────────────
  '7299': { description: 'Other Services (includes Babysitting/Childcare)', taxCategories: ['childcare'], confidenceBoost: 0.15 },
  '8211': { description: 'Elementary and Secondary Schools', taxCategories: ['childcare', 'educator_expenses'], confidenceBoost: 0.2 },
  '8220': { description: 'Colleges and Universities', taxCategories: ['student_loan'], confidenceBoost: 0.15 },
  '8241': { description: 'Correspondence Schools', taxCategories: ['student_loan'], confidenceBoost: 0.15 },
  '8244': { description: 'Business and Secretarial Schools', taxCategories: ['student_loan'], confidenceBoost: 0.15 },
  '8249': { description: 'Vocational and Trade Schools', taxCategories: ['student_loan'], confidenceBoost: 0.15 },
  '8351': { description: 'Child Care Services', taxCategories: ['childcare'], confidenceBoost: 0.3 },

  // ── Charitable / Nonprofits ───────────────────────
  '8398': { description: 'Charitable and Social Service Organizations', taxCategories: ['charitable'], confidenceBoost: 0.3 },
  '8641': { description: 'Civic, Social, Fraternal Associations', taxCategories: ['charitable'], confidenceBoost: 0.15 },
  '8661': { description: 'Religious Organizations', taxCategories: ['charitable'], confidenceBoost: 0.25 },

  // ── Real Estate / Mortgage ────────────────────────
  '6012': { description: 'Financial Institutions — Merchandise/Services', taxCategories: ['mortgage'], confidenceBoost: 0.1 },
  '6051': { description: 'Non-Financial Institutions — Quasi Cash', taxCategories: ['mortgage'], confidenceBoost: 0.1 },

  // ── Insurance ─────────────────────────────────────
  '5960': { description: 'Direct Marketing — Insurance Services', taxCategories: ['se_health_insurance'], confidenceBoost: 0.15 },
  '6300': { description: 'Insurance Underwriting, Premiums', taxCategories: ['se_health_insurance'], confidenceBoost: 0.2 },
  '6381': { description: 'Insurance Premiums', taxCategories: ['se_health_insurance'], confidenceBoost: 0.25 },

  // ── Office Supplies / Business ────────────────────
  '5111': { description: 'Stationery, Office Supplies, Printing', taxCategories: ['home_office_supplies'], confidenceBoost: 0.2 },
  '5943': { description: 'Stationery Stores, Office/School Supply Stores', taxCategories: ['home_office_supplies', 'educator_expenses'], confidenceBoost: 0.2 },

  // ── Software / Technology ─────────────────────────
  '5045': { description: 'Computers and Computer Peripherals', taxCategories: ['business_software', 'home_office_supplies'], confidenceBoost: 0.15 },
  '5734': { description: 'Computer Software Stores', taxCategories: ['business_software'], confidenceBoost: 0.2 },
  '7372': { description: 'Computer Programming, Data Processing', taxCategories: ['business_software'], confidenceBoost: 0.2 },

  // ── Travel ────────────────────────────────────────
  '3000': { description: 'Airlines (generic range start)', taxCategories: ['business_travel'], confidenceBoost: 0.15 },
  '3501': { description: 'Hotels and Motels (generic range start)', taxCategories: ['business_travel'], confidenceBoost: 0.15 },
  '4111': { description: 'Transportation — Suburban/Commuter', taxCategories: ['business_travel'], confidenceBoost: 0.1 },
  '4121': { description: 'Taxicabs and Limousines', taxCategories: ['business_travel'], confidenceBoost: 0.15 },
  '4131': { description: 'Bus Lines', taxCategories: ['business_travel'], confidenceBoost: 0.1 },
  '4411': { description: 'Cruise Lines', taxCategories: ['business_travel'], confidenceBoost: 0.1 },
  '4511': { description: 'Airlines and Air Carriers', taxCategories: ['business_travel'], confidenceBoost: 0.15 },
  '7011': { description: 'Hotels, Motels, and Resorts', taxCategories: ['business_travel'], confidenceBoost: 0.15 },
  '7012': { description: 'Timeshares', taxCategories: ['business_travel'], confidenceBoost: 0.1 },
  '7512': { description: 'Car Rental Agencies', taxCategories: ['business_travel'], confidenceBoost: 0.15 },
  '7523': { description: 'Parking Lots and Garages', taxCategories: ['business_travel'], confidenceBoost: 0.1 },

  // ── Telecom / Internet ────────────────────────────
  '4812': { description: 'Telecommunication Equipment', taxCategories: ['business_telecom'], confidenceBoost: 0.15 },
  '4814': { description: 'Telecommunication Services', taxCategories: ['business_telecom'], confidenceBoost: 0.2 },
  '4816': { description: 'Computer Network/Information Services', taxCategories: ['business_telecom', 'business_software'], confidenceBoost: 0.15 },

  // ── Restaurants / Meals ──────────────────────────────
  '5812': { description: 'Eating Places, Restaurants', taxCategories: ['business_meals'], confidenceBoost: 0.1 },
  '5813': { description: 'Drinking Places, Bars, Taverns', taxCategories: ['business_meals'], confidenceBoost: 0.1 },
  '5814': { description: 'Fast Food Restaurants', taxCategories: ['business_meals'], confidenceBoost: 0.1 },

  // ── Tax Preparation ───────────────────────────────
  '7276': { description: 'Tax Preparation Services', taxCategories: ['tax_prep'], confidenceBoost: 0.3 },

  // ── Retirement / Financial ────────────────────────
  '6010': { description: 'Financial Institutions — Manual Cash', taxCategories: ['retirement_contributions', 'hsa'], confidenceBoost: 0.1 },
  '6011': { description: 'Financial Institutions — Automated Cash', taxCategories: ['retirement_contributions', 'hsa'], confidenceBoost: 0.1 },
};

// ─── Lookup Functions ───────────────────────────────

/** Look up an MCC code in the tax map. Returns undefined for unknown codes.
 *  Supports range-based MCC codes: airlines (3000-3299) and hotels (3501-3999). */
export function lookupMCC(code: string): MCCTaxEntry | undefined {
  const direct = MCC_TAX_MAP[code];
  if (direct) return direct;

  // Range-based lookup for airlines and hotels
  const numeric = parseInt(code, 10);
  if (isNaN(numeric)) return undefined;
  if (numeric >= 3000 && numeric <= 3299) return MCC_TAX_MAP['3000'];
  if (numeric >= 3501 && numeric <= 3999) return MCC_TAX_MAP['3501'];

  return undefined;
}

/**
 * Extract an MCC code embedded in a transaction description.
 * Some banks embed MCC in descriptions as "MCC:5912" or "MCC 5912".
 * Returns the code string or undefined if none found.
 */
export function extractMCCFromDescription(description: string): string | undefined {
  const match = description.match(/\bMCC[:\s]?\s*(\d{4})\b/i);
  return match ? match[1] : undefined;
}
