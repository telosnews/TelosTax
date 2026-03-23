/**
 * Transaction Categorizer — Type Definitions
 *
 * Types for the AI-powered transaction categorization system.
 * The categorizer uses a hybrid approach:
 *   1. AI categorizes all transactions (primary classifier)
 *   2. Pattern engine validates and gates (cross-validation)
 *   3. Disagreements flagged for user review
 */

import type { NormalizedTransaction, ReturnContext } from './deductionFinderTypes';

// ─── Tax Categories ────────────────────────────────

/** Top-level tax-relevant categories. */
export type TransactionCategory =
  | 'business_expense'       // Schedule C
  | 'home_office'            // Form 8829
  | 'medical'                // Schedule A
  | 'charitable'             // Schedule A
  | 'education'              // Form 8863 / Schedule 1
  | 'childcare'              // Form 2441
  | 'vehicle'                // Schedule C (business use)
  | 'retirement'             // Schedule 1 (IRA, SEP)
  | 'tax_payment'            // 1040 Line 26 (estimated), Schedule A (SALT)
  | 'salt'                   // Schedule A — state/local/property tax
  | 'investment'             // Schedule A (advisory fees, margin interest)
  | 'rental_property'        // Schedule E
  | 'health_insurance_se'    // Schedule 1 (self-employed health insurance)
  | 'student_loan'           // Schedule 1 adjustment
  | 'hsa'                    // Schedule 1 / Form 8889
  | 'mortgage'               // Schedule A (interest portion)
  | 'personal'               // Not tax-relevant
  | 'unclear';               // Needs user review

/** Sub-categories for detailed classification. */
export type TransactionSubCategory =
  // Business (Schedule C)
  | 'advertising' | 'car_and_truck' | 'commissions' | 'contract_labor'
  | 'depreciation' | 'insurance_business' | 'interest_business' | 'legal_professional'
  | 'office_expense' | 'rent_lease' | 'repairs_maintenance' | 'supplies'
  | 'taxes_licenses' | 'travel' | 'meals' | 'utilities_business'
  | 'wages' | 'other_expense' | 'software_subscriptions' | 'equipment'
  // Home Office (Form 8829)
  | 'internet' | 'electric' | 'gas_heating' | 'water' | 'rent_mortgage_pct'
  | 'insurance_home' | 'repairs_home' | 'office_supplies' | 'office_furniture'
  // Medical
  | 'prescriptions' | 'doctor_visits' | 'dental' | 'vision' | 'insurance_premiums'
  | 'mental_health' | 'medical_devices' | 'hospital' | 'lab_tests'
  // Charitable
  | 'cash_donation' | 'noncash_donation' | 'volunteer_mileage'
  // Education
  | 'tuition' | 'books_supplies' | 'student_loan_payment'
  // Childcare
  | 'daycare' | 'after_school' | 'summer_camp' | 'nanny'
  // Vehicle
  | 'fuel' | 'maintenance_vehicle' | 'parking' | 'tolls' | 'insurance_vehicle'
  // Other
  | 'ira_contribution' | 'sep_ira' | 'solo_401k'
  | 'estimated_federal' | 'estimated_state' | 'property_tax' | 'state_income_tax'
  | 'general';

// ─── Categorized Transaction ───────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Source of the categorization. */
export type CategorizationSource = 'ai' | 'pattern' | 'both' | 'user';

/** A single transaction with its AI + pattern categorization. */
export interface CategorizedTransaction {
  /** Index into the original NormalizedTransaction array. */
  transactionIndex: number;
  /** Original transaction data. */
  transaction: NormalizedTransaction;
  /** Primary category assignment. */
  category: TransactionCategory;
  /** Detailed sub-category. */
  subCategory: TransactionSubCategory;
  /** Confidence in the categorization. */
  confidence: ConfidenceLevel;
  /** Who assigned this category. */
  source: CategorizationSource;
  /** Which tax form/line this maps to (e.g., "Schedule C, Line 27a"). */
  formLine?: string;
  /** One-sentence explanation of why this category was chosen. */
  reasoning?: string;
  /** Whether the user has approved this categorization. */
  approved: boolean;
  /** User override — if the user reclassified, store the original AI category. */
  originalCategory?: TransactionCategory;
  /** For split transactions: what % is tax-relevant (0-100). Default 100. */
  businessUsePercent: number;
}

// ─── Deduplicated Merchant ─────────────────────────

/** Aggregated merchant data sent to the AI (not individual transactions). */
export interface MerchantAggregate {
  /** Cleaned merchant name. */
  merchant: string;
  /** Total amount across all transactions. */
  totalAmount: number;
  /** Number of transactions. */
  transactionCount: number;
  /** Months with transactions (e.g., "Jan-Dec" or "Mar, Jun, Sep"). */
  monthRange: string;
  /** Average transaction amount. */
  averageAmount: number;
  /** Indices into the original transaction array. */
  transactionIndices: number[];
}

// ─── Category Summary ──────────────────────────────

/** Aggregated summary for a single category. */
export interface CategorySummary {
  category: TransactionCategory;
  /** Human-readable label (e.g., "Business Expenses"). */
  label: string;
  /** Total dollar amount across all transactions in this category. */
  totalAmount: number;
  /** Number of transactions. */
  transactionCount: number;
  /** Number of high/medium/low confidence transactions. */
  confidenceCounts: { high: number; medium: number; low: number };
  /** Target form/schedule (e.g., "Schedule C"). */
  targetForm: string;
  /** Whether the user has approved this category for import. */
  approved: boolean;
}

// ─── Categorization Result ─────────────────────────

/** Full result of the categorization pipeline. */
export interface CategorizationResult {
  /** All categorized transactions. */
  transactions: CategorizedTransaction[];
  /** Summary per category (sorted by totalAmount descending). */
  summaries: CategorySummary[];
  /** Total transactions processed. */
  totalProcessed: number;
  /** How many were categorized as personal (not tax-relevant). */
  personalCount: number;
  /** How many need user review (unclear or low confidence). */
  reviewNeededCount: number;
  /** Estimated total deductible amount (across all non-personal categories). */
  estimatedDeductibleTotal: number;
}

// ─── Category Metadata ─────────────────────────────

export interface CategoryMeta {
  label: string;
  targetForm: string;
  icon: string;        // Lucide icon name
  color: string;       // Tailwind color class
  description: string; // Short description for UI
}

/** Human-readable metadata for each category. */
export const CATEGORY_META: Record<TransactionCategory, CategoryMeta> = {
  business_expense:    { label: 'Business Expenses',       targetForm: 'Schedule C',  icon: 'Briefcase',    color: 'text-blue-400',    description: 'Deductible business costs (supplies, software, travel, etc.)' },
  home_office:         { label: 'Home Office',             targetForm: 'Form 8829',   icon: 'Home',         color: 'text-violet-400',  description: 'Home office expenses (internet, utilities, rent %, repairs)' },
  medical:             { label: 'Medical & Dental',        targetForm: 'Schedule A',  icon: 'Heart',        color: 'text-red-400',     description: 'Medical expenses exceeding 7.5% of AGI' },
  charitable:          { label: 'Charitable Donations',    targetForm: 'Schedule A',  icon: 'Gift',         color: 'text-emerald-400', description: 'Donations to qualified organizations' },
  education:           { label: 'Education',               targetForm: 'Form 8863',   icon: 'GraduationCap',color: 'text-amber-400',   description: 'Tuition, books, and education credits' },
  childcare:           { label: 'Childcare',               targetForm: 'Form 2441',   icon: 'Baby',         color: 'text-pink-400',    description: 'Childcare costs for dependents under 13' },
  vehicle:             { label: 'Vehicle (Business)',       targetForm: 'Schedule C',  icon: 'Car',          color: 'text-sky-400',     description: 'Business-use vehicle expenses' },
  retirement:          { label: 'Retirement Contributions', targetForm: 'Schedule 1', icon: 'PiggyBank',    color: 'text-teal-400',    description: 'IRA, SEP-IRA, Solo 401(k) contributions' },
  tax_payment:         { label: 'Estimated Tax Payments',  targetForm: '1040 Line 26',icon: 'Landmark',     color: 'text-slate-400',   description: 'Federal and state estimated tax payments' },
  salt:                { label: 'State & Local Taxes',     targetForm: 'Schedule A',  icon: 'Building2',    color: 'text-orange-400',  description: 'State income tax, property tax (up to $40,000 SALT cap)' },
  investment:          { label: 'Investment Expenses',     targetForm: 'Schedule A',  icon: 'TrendingUp',   color: 'text-indigo-400',  description: 'Advisory fees, margin interest' },
  rental_property:     { label: 'Rental Property',         targetForm: 'Schedule E',  icon: 'Building',     color: 'text-cyan-400',    description: 'Rental property expenses (repairs, insurance, etc.)' },
  health_insurance_se: { label: 'Self-Employed Health Insurance', targetForm: 'Schedule 1', icon: 'ShieldPlus', color: 'text-rose-400', description: 'Self-employed health insurance premiums' },
  student_loan:        { label: 'Student Loan Interest',   targetForm: 'Schedule 1',  icon: 'BookOpen',     color: 'text-yellow-400',  description: 'Student loan interest (up to $2,500)' },
  hsa:                 { label: 'HSA Contributions',       targetForm: 'Form 8889',   icon: 'Stethoscope',  color: 'text-lime-400',    description: 'Health Savings Account contributions' },
  mortgage:            { label: 'Mortgage Interest',       targetForm: 'Schedule A',  icon: 'Home',         color: 'text-orange-400',  description: 'Mortgage interest payments (deductible on Schedule A)' },
  personal:            { label: 'Personal',                targetForm: '',            icon: 'User',         color: 'text-slate-500',   description: 'Not tax-relevant' },
  unclear:             { label: 'Needs Review',            targetForm: '',            icon: 'HelpCircle',   color: 'text-amber-500',   description: 'Could not determine — please review' },
};

// ─── Sub-Category Metadata ──────────────────────────

export interface SubCategoryMeta {
  label: string;
  /** Schedule C line or form reference. */
  formLine: string;
  /** Deductibility rate (0-1). Most are 1.0; meals are 0.5. */
  deductibilityRate: number;
}

/** Human-readable metadata + Schedule C line mapping for business sub-categories. */
export const BUSINESS_SUB_CATEGORY_META: Partial<Record<TransactionSubCategory, SubCategoryMeta>> = {
  advertising:            { label: 'Advertising',                 formLine: 'Line 8',   deductibilityRate: 1.0 },
  car_and_truck:          { label: 'Car & Truck',                 formLine: 'Line 9',   deductibilityRate: 1.0 },
  commissions:            { label: 'Commissions & Fees',          formLine: 'Line 10',  deductibilityRate: 1.0 },
  contract_labor:         { label: 'Contract Labor',              formLine: 'Line 11',  deductibilityRate: 1.0 },
  depreciation:           { label: 'Depreciation',                formLine: 'Line 13',  deductibilityRate: 1.0 },
  insurance_business:     { label: 'Insurance',                   formLine: 'Line 15',  deductibilityRate: 1.0 },
  interest_business:      { label: 'Interest',                    formLine: 'Line 16a', deductibilityRate: 1.0 },
  legal_professional:     { label: 'Legal & Professional',        formLine: 'Line 17',  deductibilityRate: 1.0 },
  office_expense:         { label: 'Office Expense',              formLine: 'Line 18',  deductibilityRate: 1.0 },
  rent_lease:             { label: 'Rent or Lease',               formLine: 'Line 20a', deductibilityRate: 1.0 },
  repairs_maintenance:    { label: 'Repairs & Maintenance',       formLine: 'Line 21',  deductibilityRate: 1.0 },
  supplies:               { label: 'Supplies',                    formLine: 'Line 22',  deductibilityRate: 1.0 },
  taxes_licenses:         { label: 'Taxes & Licenses',            formLine: 'Line 23',  deductibilityRate: 1.0 },
  travel:                 { label: 'Travel',                      formLine: 'Line 24a', deductibilityRate: 1.0 },
  meals:                  { label: 'Meals',                       formLine: 'Line 24b', deductibilityRate: 0.5 },
  utilities_business:     { label: 'Utilities',                   formLine: 'Line 25',  deductibilityRate: 1.0 },
  wages:                  { label: 'Wages',                       formLine: 'Line 26',  deductibilityRate: 1.0 },
  other_expense:          { label: 'Other Expenses',              formLine: 'Line 27a', deductibilityRate: 1.0 },
  software_subscriptions: { label: 'Software & Subscriptions',    formLine: 'Line 27a', deductibilityRate: 1.0 },
  equipment:              { label: 'Equipment',                   formLine: 'Line 13',  deductibilityRate: 1.0 },
};

/** Sub-categories valid for business_expense category (for dropdown selection). */
export const BUSINESS_SUB_CATEGORIES: TransactionSubCategory[] = [
  'advertising', 'car_and_truck', 'commissions', 'contract_labor', 'depreciation',
  'insurance_business', 'interest_business', 'legal_professional', 'office_expense',
  'rent_lease', 'repairs_maintenance', 'supplies', 'taxes_licenses', 'travel', 'meals',
  'utilities_business', 'wages', 'other_expense', 'software_subscriptions', 'equipment',
];

// ─── Home Office Sub-Categories (Form 8829) ─────────

export const HOME_OFFICE_SUB_CATEGORY_META: Partial<Record<TransactionSubCategory, SubCategoryMeta>> = {
  internet:          { label: 'Internet',               formLine: 'Line 22 (Indirect)', deductibilityRate: 1.0 },
  electric:          { label: 'Electric',               formLine: 'Line 22 (Indirect)', deductibilityRate: 1.0 },
  gas_heating:       { label: 'Gas / Heating',          formLine: 'Line 22 (Indirect)', deductibilityRate: 1.0 },
  water:             { label: 'Water',                  formLine: 'Line 22 (Indirect)', deductibilityRate: 1.0 },
  rent_mortgage_pct: { label: 'Rent / Mortgage',        formLine: 'Line 10 (Indirect)', deductibilityRate: 1.0 },
  insurance_home:    { label: 'Homeowner\'s Insurance', formLine: 'Line 18 (Indirect)', deductibilityRate: 1.0 },
  repairs_home:      { label: 'Repairs & Maintenance',  formLine: 'Line 21 (Direct)',   deductibilityRate: 1.0 },
  office_supplies:   { label: 'Office Supplies',        formLine: 'Line 22 (Direct)',   deductibilityRate: 1.0 },
  office_furniture:  { label: 'Office Furniture',       formLine: 'Line 41 (Depreciation)', deductibilityRate: 1.0 },
};

export const HOME_OFFICE_SUB_CATEGORIES: TransactionSubCategory[] = [
  'internet', 'electric', 'gas_heating', 'water', 'rent_mortgage_pct',
  'insurance_home', 'repairs_home', 'office_supplies', 'office_furniture',
];

// ─── Vehicle Sub-Categories (Schedule C) ─────────────

export const VEHICLE_SUB_CATEGORY_META: Partial<Record<TransactionSubCategory, SubCategoryMeta>> = {
  fuel:                { label: 'Gas / Fuel',           formLine: 'Actual Expenses', deductibilityRate: 1.0 },
  maintenance_vehicle: { label: 'Maintenance & Repairs', formLine: 'Actual Expenses', deductibilityRate: 1.0 },
  parking:             { label: 'Parking',              formLine: 'Always deductible', deductibilityRate: 1.0 },
  tolls:               { label: 'Tolls',                formLine: 'Always deductible', deductibilityRate: 1.0 },
  insurance_vehicle:   { label: 'Auto Insurance',       formLine: 'Actual Expenses', deductibilityRate: 1.0 },
};

export const VEHICLE_SUB_CATEGORIES: TransactionSubCategory[] = [
  'fuel', 'maintenance_vehicle', 'parking', 'tolls', 'insurance_vehicle',
];

// ─── Charitable Sub-Categories (Schedule A) ──────────

export const CHARITABLE_SUB_CATEGORY_META: Partial<Record<TransactionSubCategory, SubCategoryMeta>> = {
  cash_donation:     { label: 'Cash Donations',         formLine: 'Line 12', deductibilityRate: 1.0 },
  noncash_donation:  { label: 'Noncash Donations',      formLine: 'Line 13', deductibilityRate: 1.0 },
  volunteer_mileage: { label: 'Volunteer Mileage',      formLine: 'Line 12', deductibilityRate: 1.0 },
};

export const CHARITABLE_SUB_CATEGORIES: TransactionSubCategory[] = [
  'cash_donation', 'noncash_donation', 'volunteer_mileage',
];

// ─── SALT Sub-Categories (Schedule A) ────────────────

export const SALT_SUB_CATEGORY_META: Partial<Record<TransactionSubCategory, SubCategoryMeta>> = {
  state_income_tax: { label: 'State & Local Income Tax', formLine: 'Line 5a', deductibilityRate: 1.0 },
  property_tax:     { label: 'Real Estate Tax',          formLine: 'Line 5b', deductibilityRate: 1.0 },
};

export const SALT_SUB_CATEGORIES: TransactionSubCategory[] = [
  'state_income_tax', 'property_tax',
];

// ─── Tax Payment Sub-Categories (1040 / Schedule A) ──

export const TAX_PAYMENT_SUB_CATEGORY_META: Partial<Record<TransactionSubCategory, SubCategoryMeta>> = {
  estimated_federal: { label: 'Federal Estimated Tax',  formLine: '1040, Line 26', deductibilityRate: 1.0 },
  estimated_state:   { label: 'State Estimated Tax',    formLine: 'State return',  deductibilityRate: 1.0 },
};

export const TAX_PAYMENT_SUB_CATEGORIES: TransactionSubCategory[] = [
  'estimated_federal', 'estimated_state',
];

// ─── Unified Sub-Category Config ─────────────────────

/** Per-category sub-category metadata and dropdown options. */
export const SUB_CATEGORY_CONFIG: Partial<Record<TransactionCategory, {
  meta: Partial<Record<TransactionSubCategory, SubCategoryMeta>>;
  subCategories: TransactionSubCategory[];
}>> = {
  business_expense: { meta: BUSINESS_SUB_CATEGORY_META, subCategories: BUSINESS_SUB_CATEGORIES },
  home_office:      { meta: HOME_OFFICE_SUB_CATEGORY_META, subCategories: HOME_OFFICE_SUB_CATEGORIES },
  vehicle:          { meta: VEHICLE_SUB_CATEGORY_META, subCategories: VEHICLE_SUB_CATEGORIES },
  charitable:       { meta: CHARITABLE_SUB_CATEGORY_META, subCategories: CHARITABLE_SUB_CATEGORIES },
  salt:             { meta: SALT_SUB_CATEGORY_META, subCategories: SALT_SUB_CATEGORIES },
  tax_payment:      { meta: TAX_PAYMENT_SUB_CATEGORY_META, subCategories: TAX_PAYMENT_SUB_CATEGORIES },
};
