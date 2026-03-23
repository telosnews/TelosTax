// Filing status enum matching IRS codes
export enum FilingStatus {
  Single = 1,
  MarriedFilingJointly = 2,
  MarriedFilingSeparately = 3,
  HeadOfHousehold = 4,
  QualifyingSurvivingSpouse = 5,
}

// ─── W-2 Box 12 Codes ────────────────────────────────────────
// IRS Form W-2 Box 12 coded benefit entries
// @authority IRS Form W-2 Instructions — Box 12 Codes
export type W2Box12Code =
  | 'A'   // Uncollected Social Security or RRTA tax on tips
  | 'B'   // Uncollected Medicare tax on tips
  | 'C'   // Taxable cost of group-term life insurance >$50k
  | 'D'   // Elective deferrals under 401(k)
  | 'DD'  // Cost of employer-sponsored health coverage (informational)
  | 'E'   // Elective deferrals under 403(b)
  | 'F'   // Elective deferrals under 408(k)(6) SEP
  | 'G'   // Elective deferrals under 457(b)
  | 'H'   // Elective deferrals under 501(c)(18)(D)
  | 'J'   // Nontaxable sick pay
  | 'K'   // 20% excise tax on excess golden parachute payments
  | 'L'   // Substantiated employee business expense reimbursements
  | 'M'   // Uncollected SS/RRTA tax on group-term life insurance
  | 'N'   // Uncollected Medicare tax on group-term life insurance
  | 'P'   // Excludable moving expense reimbursements (military only)
  | 'Q'   // Nontaxable combat pay
  | 'R'   // Employer contributions to Archer MSA
  | 'S'   // Employee salary reduction contributions under 408(p) SIMPLE
  | 'T'   // Adoption benefits
  | 'V'   // Income from exercise of nonstatutory stock options
  | 'W'   // Employer contributions to HSA
  | 'Y'   // Deferrals under 409A nonqualified deferred compensation plan
  | 'Z'   // Income under 409A on a nonqualified deferred compensation plan
  | 'AA'  // Designated Roth contributions under 401(k)
  | 'BB'  // Designated Roth contributions under 403(b)
  | 'CC'  // HIRE exempt wages and tips (obsolete)
  | 'EE'  // Designated Roth contributions under governmental 457(b)
  | 'FF'  // Permitted benefits under a qualified small employer HRA
  | 'GG'  // Income from qualified equity grants under 83(i)
  | 'HH'  // Aggregate deferrals under 83(i) elections
  | 'II';  // Medicaid waiver payments not included in Box 1

export interface W2Box12Entry {
  code: W2Box12Code;
  amount: number;
}

// W-2 Box 13 checkboxes
export interface W2Box13 {
  statutoryEmployee?: boolean;   // Box 13: Statutory employee
  retirementPlan?: boolean;      // Box 13: Retirement plan (affects IRA deduction)
  thirdPartySickPay?: boolean;   // Box 13: Third-party sick pay
}

// Income types
export interface W2Income {
  id: string;
  employerName: string;
  employerEin?: string;
  wages: number;          // Box 1
  federalTaxWithheld: number; // Box 2
  socialSecurityWages?: number; // Box 3
  socialSecurityTax?: number;  // Box 4
  medicareWages?: number;      // Box 5
  medicareTax?: number;        // Box 6
  stateTaxWithheld?: number;   // Box 17
  stateWages?: number;         // Box 16
  state?: string;              // Box 15
  box12?: W2Box12Entry[];      // Box 12a-d: Coded benefit amounts
  box13?: W2Box13;             // Box 13: Checkboxes
  isSpouse?: boolean;          // True if this W-2 belongs to the spouse (for MFJ per-person SS cap)
}

export interface Income1099NEC {
  id: string;
  payerName: string;
  payerEin?: string;
  amount: number;                    // Box 1: Nonemployee compensation
  federalTaxWithheld?: number;       // Box 4: Federal income tax withheld (backup withholding)
  businessId?: string;               // Associates with a specific Schedule C business (multi-business routing)
  stateCode?: string;                // Box 6: State (2-letter abbreviation)
  stateTaxWithheld?: number;         // Box 7: State income tax withheld
}

export interface Income1099K {
  id: string;
  platformName: string;
  grossAmount: number;               // Box 1a: Gross amount of payment card/third-party network transactions
  cardNotPresent?: number;           // Box 1b: Card not present transactions
  federalTaxWithheld?: number;       // Box 4: Federal income tax withheld (backup withholding)
  returnsAndAllowances?: number;     // User adjustment: refunds, returns, platform fees, personal txns to subtract
  businessId?: string;               // Associates with a specific Schedule C business (multi-business routing)
}

export interface Income1099INT {
  id: string;
  payerName: string;
  amount: number;         // Box 1: Interest income
  earlyWithdrawalPenalty?: number; // Box 2
  usBondInterest?: number; // Box 3
  federalTaxWithheld?: number; // Box 4
  taxExemptInterest?: number; // Box 8: Tax-exempt interest (municipal bonds)
  stateCode?: string;          // Box 15: State (2-letter abbreviation)
  stateTaxWithheld?: number;   // Box 17: State income tax withheld
}

// 1099-OID (Original Issue Discount)
// @authority IRC §1272 — Current inclusion of OID
export interface Income1099OID {
  id: string;
  payerName: string;
  originalIssueDiscount: number;      // Box 1: OID for the year
  otherPeriodicInterest?: number;     // Box 2: Other periodic interest
  earlyWithdrawalPenalty?: number;    // Box 3: Early withdrawal penalty
  federalTaxWithheld?: number;        // Box 4
  marketDiscount?: number;            // Box 5: Market discount
  acquisitionPremium?: number;        // Box 6: Acquisition premium (reduces OID)
  description?: string;               // Box 8: Description of obligation
  stateCode?: string;                 // Box 10: State
  stateTaxWithheld?: number;          // Box 11: State tax withheld
}

export interface Income1099DIV {
  id: string;
  payerName: string;
  ordinaryDividends: number;   // Box 1a
  qualifiedDividends: number;  // Box 1b
  capitalGainDistributions?: number; // Box 2a
  federalTaxWithheld?: number; // Box 4
  foreignTaxPaid?: number;     // Box 7: Foreign tax paid
  foreignSourceIncome?: number; // Supplemental: foreign source income (from fund statement)
  stateCode?: string;          // Box 14: State (2-letter abbreviation)
  stateTaxWithheld?: number;   // Box 16: State income tax withheld
}

export interface Income1099R {
  id: string;
  payerName: string;
  grossDistribution: number;    // Box 1
  taxableAmount: number;        // Box 2a
  federalTaxWithheld?: number;  // Box 4
  distributionCode?: string;    // Box 7 (1, 2, 7, G, Q, T)
  isIRA?: boolean;              // Box 7 IRA/SEP/SIMPLE checkbox — true = Line 4a/4b, false = Line 5a/5b
  isRothIRA?: boolean;          // Roth IRA distribution — basis (contributions) portion is always tax-free
  rothContributionBasis?: number; // Roth IRA contribution basis — total contributions available for tax-free withdrawal
  qcdAmount?: number;            // Qualified Charitable Distribution amount (IRC §408(d)(8))
  stateCode?: string;           // Box 13: State (2-letter abbreviation)
  stateTaxWithheld?: number;    // Box 14: State income tax withheld
  isSpouse?: boolean;           // Distribution belongs to spouse (MFJ)

  // Form 5329 early distribution exception — IRC §72(t)(2)
  // When distributionCode = '1' (early, no known exception), the taxpayer may still
  // qualify for a partial exception. The exception amount is subtracted from the
  // taxable amount before applying the 10% penalty.
  earlyDistributionExceptionCode?: string;    // Exception reason code (Form 5329 Line 2)
  earlyDistributionExceptionAmount?: number;  // Dollar amount exempt from penalty under the exception

  // Simplified Method for pensions — IRS Pub 939
  // When Box 2a (taxableAmount) is blank or marked "unknown", the taxpayer uses the
  // Simplified Method to determine the taxable portion based on after-tax contributions.
  // If useSimplifiedMethod is true, the engine computes taxableAmount from these fields.
  useSimplifiedMethod?: boolean;
  simplifiedMethod?: {
    totalContributions: number;       // Total after-tax contributions to the plan
    ageAtStartDate: number;           // Age of annuitant at annuity start date
    isJointAndSurvivor: boolean;      // Joint-and-survivor annuity
    combinedAge?: number;             // Combined ages (for joint-and-survivor)
    paymentsThisYear: number;         // Number of payments received this year (typically 12)
    priorYearTaxFreeRecovery?: number; // Tax-free amount recovered in prior years
  };
}

export interface Income1099G {
  id: string;
  payerName: string;
  unemploymentCompensation: number; // Box 1
  federalTaxWithheld?: number;     // Box 4
  stateCode?: string;              // Box 10: State (2-letter abbreviation)
  stateTaxWithheld?: number;       // Box 11: State income tax withheld
}

export interface Income1099MISC {
  id: string;
  payerName: string;
  rents?: number;                  // Box 1 — Rents (flows to Schedule E)
  royalties?: number;              // Box 2 — Royalties (flows to Schedule E)
  otherIncome: number;             // Box 3 — Other income (prizes, awards, etc.)
  federalTaxWithheld?: number;     // Box 4
  stateTaxWithheld?: number;       // Box 16 — State income tax withheld
  stateCode?: string;              // Box 15 — State (2-letter abbreviation)
}

export interface Income1099B {
  id: string;
  brokerName: string;
  description: string;           // e.g. "100 shares AAPL"
  dateAcquired?: string;         // Date acquired
  dateSold: string;              // Date sold
  proceeds: number;              // Sales price
  costBasis: number;             // Cost or other basis
  isLongTerm: boolean;           // Held > 1 year
  federalTaxWithheld?: number;   // Box 4
  washSaleLossDisallowed?: number; // Box 1g: Wash sale loss disallowed
  basisReportedToIRS?: boolean;    // Box 12: true (default) = covered security, broker basis is authoritative
  isCollectible?: boolean;         // True if asset is a collectible (IRC §408(m)) — art, antiques, metals, gems, stamps, etc.
}

export interface IncomeSSA1099 {
  id: string;
  totalBenefits: number;         // Box 5: Net benefits
  federalTaxWithheld?: number;   // Box 6
}

export interface RentalProperty {
  id: string;
  address: string;
  propertyType: 'single_family' | 'multi_family' | 'condo' | 'commercial' | 'other';
  daysRented: number;
  personalUseDays: number;
  rentalIncome: number;
  // Expense line items (Schedule E Part I, Lines 5-19)
  advertising?: number;
  auto?: number;
  cleaning?: number;
  commissions?: number;
  insurance?: number;
  legal?: number;
  management?: number;
  mortgageInterest?: number;
  otherInterest?: number;
  repairs?: number;
  supplies?: number;
  taxes?: number;
  utilities?: number;
  depreciation?: number;
  otherExpenses?: number;
  // Form 8582 — Passive Activity Loss Limitations
  activeParticipation?: boolean;       // IRC §469(i) — required for $25k special allowance (default true)
  disposedDuringYear?: boolean;        // IRC §469(g)(1) — full disposition releases all suspended losses
  dispositionGainLoss?: number;        // Gain/loss recognized on disposition of the activity
  priorYearUnallowedLoss?: number;     // Prior-year suspended passive loss for this specific property
  // Form 4797 — Sale details for disposed properties (enables §1250 recapture routing)
  salesPrice?: number;                 // Gross sale proceeds
  costBasis?: number;                  // Original cost basis (depreciable portion, excluding land)
  cumulativeDepreciation?: number;     // Total depreciation allowed over ownership period
}

// Royalty income — Schedule E Part I, Line 4
export interface RoyaltyProperty {
  id: string;
  description: string;            // e.g., "Oil & Gas Lease - West Texas"
  royaltyType: 'oil_gas' | 'mineral' | 'book_literary' | 'music' | 'patent' | 'timber' | 'other';
  royaltyIncome: number;          // Schedule E Line 4
  // Expense line items (Schedule E Part I, Lines 5-19)
  advertising?: number;
  auto?: number;
  cleaning?: number;
  commissions?: number;
  insurance?: number;
  legal?: number;
  management?: number;
  mortgageInterest?: number;
  otherInterest?: number;
  repairs?: number;
  supplies?: number;
  taxes?: number;
  utilities?: number;
  depreciation?: number;          // Also covers depletion for oil/gas/mineral
  otherExpenses?: number;
}

// Schedule K-1 income (partnerships & S-Corps)
export interface IncomeK1 {
  id: string;
  entityName: string;                   // Partnership or S-Corp name
  entityEin?: string;                   // Entity EIN
  entityType: 'partnership' | 's_corp' | 'estate' | 'trust'; // Determines SE treatment
  ordinaryBusinessIncome?: number;      // Box 1: Ordinary business income
  rentalIncome?: number;                // Box 2: Rental income
  guaranteedPayments?: number;          // Box 4: Guaranteed payments to partner
  interestIncome?: number;              // Box 5: Interest income
  ordinaryDividends?: number;           // Box 6a: Ordinary dividends
  qualifiedDividends?: number;          // Box 6b: Qualified dividends
  royalties?: number;                   // Box 7: Royalties
  shortTermCapitalGain?: number;        // Box 8: Short-term capital gain
  longTermCapitalGain?: number;         // Box 9a: Long-term capital gain
  netSection1231Gain?: number;          // Box 10: Net Section 1231 gain
  otherIncome?: number;                 // Box 11: Other income
  section199AQBI?: number;              // Box 20, Code Z: Section 199A QBI
  selfEmploymentIncome?: number;        // Box 14, Code A: SE earnings (partnerships)
  section179Deduction?: number;          // Box 12, Code A: Section 179 expense deduction
  federalTaxWithheld?: number;          // Tax withheld

  // Box 13 — Partner's deductions
  box13CharitableCash?: number;           // Codes A/B: Cash charitable contributions
  box13CharitableNonCash?: number;        // Codes C/D/E/F: Non-cash charitable contributions
  box13InvestmentInterestExpense?: number; // Code H: Investment interest expense
  box131231Loss?: number;                  // Code K: Section 1231 loss (net)
  box13OtherDeductions?: number;          // Codes I-L: Other deductions (royalty, portfolio, etc.)

  // Box 15 — Partner's credits
  box15ForeignTaxPaid?: number;           // Code L: Foreign taxes paid/accrued
  box15OtherCredits?: number;             // Various credit codes
  box15ForeignCountry?: string;           // Country for FTC routing
  isCooperativePatronage?: boolean;       // Subchapter T cooperative (Form 1120-C) — income already on Schedule F line 3a, not SE via K-1
  // Form 8582 — Passive Activity Loss Limitations
  isPassiveActivity?: boolean;            // True if this K-1 income is from a passive activity
  isLimitedPartner?: boolean;             // IRC §469(i)(6)(C) — LP excluded from $25K rental allowance
  priorYearUnallowedLoss?: number;        // Prior-year suspended passive loss for this K-1 activity
  disposedDuringYear?: boolean;           // IRC §469(g)(1) — full disposition releases suspended losses
  dispositionGainLoss?: number;           // Gain/loss recognized on disposition
}

// 1099-SA (HSA Distributions)
export interface Income1099SA {
  id: string;
  payerName: string;                    // Trustee/payer name
  grossDistribution: number;            // Box 1: Gross distribution
  distributionCode?: string;            // Box 3: Distribution code (1-5)
  qualifiedMedicalExpenses?: boolean;   // Was it used for qualified medical expenses?
  federalTaxWithheld?: number;          // Tax withheld
}

// W-2G (Gambling Income)
export interface IncomeW2G {
  id: string;
  payerName: string;
  grossWinnings: number;          // Box 1: Gross winnings
  federalTaxWithheld?: number;    // Box 4: Federal income tax withheld
  typeOfWager?: string;           // Box 4 description: type of wager
  stateCode?: string;             // Box 13: State abbreviation (2-letter)
  stateTaxWithheld?: number;      // Box 15: State income tax withheld
}

// Direct deposit info (Lines 35b-d)
export interface DirectDeposit {
  routingNumber: string;    // 9 digits, ABA checksum
  accountNumber: string;    // 4-17 digits
  accountType: 'checking' | 'savings';
}

// Dependent info
export interface Dependent {
  id: string;
  firstName: string;
  lastName: string;
  ssn?: string;                // Full 9-digit SSN (stored encrypted)
  ssnLastFour?: string;
  relationship: string;
  dateOfBirth?: string;
  monthsLivedWithYou: number;
  isStudent?: boolean;
  isDisabled?: boolean;
}

// Business / Schedule C
export interface BusinessInfo {
  id: string;
  businessName?: string;
  businessEin?: string;
  principalBusinessCode?: string;
  businessDescription?: string;
  accountingMethod: 'cash' | 'accrual';
  didStartThisYear: boolean;
  isSpouse?: boolean;             // True if this business belongs to the spouse (for MFJ per-person SE tax)
}

export interface ExpenseEntry {
  id: string;
  scheduleCLine: number;   // 8-27
  category: string;
  description?: string;
  amount: number;
  businessId?: string;     // Associates expense with a specific business (for multi-business support)
}

export interface HomeOfficeInfo {
  method: 'simplified' | 'actual' | null;

  // Part I — Business percentage (both methods)
  squareFeet?: number;              // Office area (Form 8829 Line 1)
  totalHomeSquareFeet?: number;     // Total home area (Form 8829 Line 2)

  // Part II — Actual method expense categories
  // Tier 1: Deductible regardless of business use (Lines 9-11)
  mortgageInterest?: number;        // Line 10 — deductible mortgage interest (indirect)
  realEstateTaxes?: number;         // Line 11 — real estate taxes (indirect)
  casualtyLosses?: number;          // Line 9 — casualty losses, federally declared disasters only (indirect)

  // Tier 2: Operating expenses (Lines 16-22)
  excessMortgageInterest?: number;  // Line 16 — mortgage interest beyond Tier 1 (standard deduction filers)
  excessRealEstateTaxes?: number;   // Line 17 — real estate taxes beyond Tier 1 (standard deduction filers)
  insurance?: number;               // Line 18 — homeowner's/renter's insurance (indirect)
  rent?: number;                    // Line 19 — rent paid (indirect)
  repairsAndMaintenance?: number;   // Line 20 — repairs and maintenance (indirect)
  utilities?: number;               // Line 21 — utilities (indirect)
  otherExpenses?: number;           // Line 22 — other expenses (indirect)

  // Part III — Depreciation of Your Home
  homeCostOrValue?: number;         // Line 37: lesser of adjusted basis or FMV at date first used for business
  landValue?: number;               // Line 38: land portion (not depreciable)
  dateFirstUsedForBusiness?: string; // For MACRS percentage lookup (month determines first-year rate)

  // Part IV — Carryovers from prior year
  priorYearOperatingCarryover?: number;   // Line 25 (from prior year Form 8829 line 43)
  priorYearDepreciationCarryover?: number; // Line 31 (from prior year Form 8829 line 44)

  // Backward compat — legacy single-number actual method
  actualExpenses?: number;
}

// Home Office Deduction — detailed calculation result (Form 8829)
export interface HomeOfficeResult {
  method: 'simplified' | 'actual';
  businessPercentage: number;           // Part I Line 7

  // Simplified method
  simplifiedDeduction?: number;         // $5 × sqft

  // Actual method — Form 8829 three-tier cascade
  grossIncome?: number;                 // Line 8 (tentative profit passed in)
  tier1Total?: number;                  // Lines 9-11 business portion (interest, taxes, casualty)
  tier2Total?: number;                  // Lines 16-22 business portion + prior year carryover
  tier3Total?: number;                  // Depreciation + prior year depreciation carryover
  tier1Allowed?: number;                // Always = tier1Total (always deductible)
  tier2Allowed?: number;                // min(remaining after tier1, tier2Total)
  tier3Allowed?: number;                // min(remaining after tier1+tier2, tier3Total)
  depreciationComputed?: number;        // Part III Line 42 — auto-calculated MACRS depreciation

  totalDeduction: number;               // Line 36: final deduction (tier1 + tier2 + tier3 allowed)

  // Part IV — Carryovers to next year
  operatingExpenseCarryover?: number;   // Line 43 (tier2Total - tier2Allowed)
  depreciationCarryover?: number;       // Line 44 (tier3Total - tier3Allowed)
}

export interface VehicleInfo {
  method: 'standard_mileage' | 'actual' | null;
  businessMiles?: number;
  totalMiles?: number;
  commuteMiles?: number;
  dateInService?: string;
  actualExpenses?: number;            // Legacy single-number (backward compat)

  // ── Actual expense categories ──────────────────────────
  gas?: number;                       // Gasoline / fuel / electricity
  oilAndLubes?: number;               // Oil changes, lubricants
  repairs?: number;                   // Mechanical repairs, body work
  tires?: number;                     // Tire purchases, rotations
  insurance?: number;                 // Auto insurance premiums
  registration?: number;              // State registration fees
  licenses?: number;                  // License plate costs
  garageRent?: number;                // Parking garage / storage rent
  tolls?: number;                     // Business-related tolls
  parking?: number;                   // Business-related parking fees
  leasePayments?: number;             // Monthly lease payments
  otherVehicleExpenses?: number;      // Other expenses not listed above

  // ── Depreciation (Form 4562) ───────────────────────────
  vehicleCost?: number;               // Original cost / basis
  priorDepreciation?: number;         // Accumulated depreciation from prior years

  // ── Form 4562 Part V documentation ─────────────────────
  otherMiles?: number;                       // Personal miles other than commute
  availableForPersonalUse?: boolean;         // Available for personal use during off-duty hours?
  hasAnotherVehicle?: boolean;               // Another vehicle available for personal use?
  writtenEvidence?: boolean;                 // Written records to substantiate business use?
  writtenEvidenceContemporaneous?: boolean;  // Records kept at or near time of use?
  vehicleWeight?: number;                    // GVW in lbs (Section 280F SUV exception: >6,000)
}

// Vehicle deduction result — detailed breakdown for UI display
export interface VehicleResult {
  method: 'standard_mileage' | 'actual';
  businessUsePercentage: number;

  // Standard mileage
  standardDeduction?: number;         // businessMiles * $0.70

  // Actual method breakdown
  totalActualExpenses?: number;       // Sum of all expense categories
  businessPortionExpenses?: number;   // totalActualExpenses * businessPct
  depreciationComputed?: number;      // Full MACRS depreciation before Section 280F
  depreciationBusinessPortion?: number; // depreciation * businessPct
  depreciationAllowed?: number;       // After Section 280F limit
  section280FLimit?: number;          // The applicable limit for the year
  section280FApplied?: boolean;       // Whether the limit was binding

  totalDeduction: number;             // Final vehicle deduction

  // Expense breakdown for display (each category * businessPct)
  expenseBreakdown?: Record<string, number>;

  // Form 4562 Part V — Listed Property informational output
  form4562PartV?: {
    totalMiles: number;
    businessMiles: number;
    commuteMiles: number;
    otherMiles: number;
    availableForPersonalUse: boolean;
    hasAnotherVehicle: boolean;
    writtenEvidence: boolean;
    writtenEvidenceContemporaneous: boolean;
  };

  // Depreciation method used (MACRS or straight-line when business use ≤ 50%)
  depreciationMethod?: 'macrs_200db' | 'straight_line';

  // Validation warnings
  warnings?: string[];
}

// ── Form 4562 — Depreciation Asset Registry ────────────────

/** MACRS property class (GDS recovery period in years) */
export type MACRSPropertyClass = 3 | 5 | 7 | 10 | 15 | 20;

/** A depreciable business asset tracked in the asset registry */
export interface DepreciationAsset {
  id: string;
  description: string;                    // "MacBook Pro", "Office desk"
  cost: number;                           // Original cost basis
  dateInService: string;                  // ISO date placed in service (YYYY-MM-DD)
  propertyClass: MACRSPropertyClass;      // MACRS recovery period
  businessUsePercent: number;             // 0-100 (default 100)
  section179Election?: number;            // Amount elected for Section 179 (0 = none)
  priorDepreciation?: number;             // Accumulated depreciation from prior years
  priorSection179?: number;               // Section 179 claimed in prior years (reduces basis)
  disposed?: boolean;                     // Asset disposed/sold during year (skip depreciation)
  businessId?: string;                    // Multi-business routing (optional)
  convention?: 'half-year' | 'mid-quarter'; // Convention used when first depreciated (for prior-year continuation)
  quarterPlaced?: 1 | 2 | 3 | 4;         // Quarter placed in service (derived from dateInService)
  isSoftware?: boolean;                   // Off-the-shelf software: 36-month SL amortization per IRC §167(f)(1)
}

/** Form 4562 calculation result — Parts I through IV */
export interface Form4562Result {
  // Part I — Section 179 (Lines 1-13)
  totalCostSection179Property: number;    // Line 2: total cost of all 179-eligible property
  section179Limit: number;                // Line 1: maximum deduction ($1,250,000 for 2025)
  section179ThresholdReduction: number;   // Line 3: reduction for cost exceeding threshold
  section179MaxAfterReduction: number;    // Line 4: adjusted limit after phaseout
  section179Elected: number;              // Lines 5-6: total elected across all assets
  section179BusinessIncomeLimit: number;  // Line 11: taxable business income limit
  section179Deduction: number;            // Line 12: actual deduction (lesser of elected vs limits)
  section179Carryforward: number;         // Line 13: excess to carry forward to next year

  // Part II — Special Depreciation Allowance / Bonus (Line 14)
  bonusDepreciationTotal: number;         // 100% of remaining basis for current-year assets

  // Part III — MACRS Depreciation (Lines 19-20)
  macrsCurrentYear: number;               // Depreciation on assets placed in service this year
  macrsPriorYears: number;                // Depreciation on assets from prior years

  // Part IV — Summary (Line 22)
  totalDepreciation: number;              // Section 179 + bonus + MACRS

  // Convention auto-detected for current-year assets (IRC §168(d)(3))
  convention: 'half-year' | 'mid-quarter';

  // Per-asset detail (for UI display)
  assetDetails: Form4562AssetDetail[];

  // Validation warnings
  warnings?: string[];
}

/** Per-asset depreciation breakdown for UI display */
export interface Form4562AssetDetail {
  assetId: string;
  description: string;
  cost: number;
  businessUseBasis: number;               // cost × (businessUsePercent / 100)
  section179Amount: number;               // Section 179 elected for this asset
  bonusDepreciation: number;              // Bonus depreciation for this asset
  macrsDepreciation: number;              // Regular MACRS depreciation
  totalDepreciation: number;              // Sum of all three methods
  depreciableRemaining: number;           // Remaining basis after all depreciation
  propertyClass: MACRSPropertyClass;
  yearIndex: number;                      // Which year of MACRS schedule (0 = first year)
  convention: 'half-year' | 'mid-quarter'; // Convention used for this asset's depreciation
  quarterPlaced?: 1 | 2 | 3 | 4;           // Quarter placed in service (for mid-quarter convention)
}

// Cost of Goods Sold — Schedule C Part III (Lines 35-42)
export interface CostOfGoodsSold {
  beginningInventory?: number;       // Line 35: Inventory at beginning of year
  purchases?: number;                // Line 36: Purchases less cost of items withdrawn for personal use
  costOfLabor?: number;              // Line 37: Cost of labor (do not include any amounts paid to yourself)
  materialsAndSupplies?: number;     // Line 38: Materials and supplies
  otherCosts?: number;               // Line 39: Other costs
  endingInventory?: number;          // Line 41: Inventory at end of year
  // Line 40 = sum(35-39), Line 42 = Line 40 - Line 41 — both computed by engine
}

// Itemized deductions (Schedule A)
export interface ItemizedDeductions {
  medicalExpenses: number;
  saltMethod?: 'income_tax' | 'sales_tax'; // Default: 'income_tax' — IRC §164(b)(5)(I) election
  stateLocalIncomeTax: number;  // Subject to SALT cap ($40k, $20k MFS; OBBBA 2025-2029)
  salesTaxAmount?: number;      // General sales tax (alternative to income tax) — IRS Pub 600 / Schedule A Line 5a
  realEstateTax: number;        // Subject to SALT cap (combined with above)
  personalPropertyTax: number;  // Subject to SALT cap (combined with above)
  mortgageInterest: number;
  mortgageInsurancePremiums: number;
  mortgageBalance?: number;     // Outstanding mortgage balance (for $750k/$375k interest limitation)
  charitableCash: number;
  charitableNonCash: number;
  nonCashDonations?: NonCashDonation[];             // Per-item non-cash donations for Form 8283
  charitableCarryforward?: CharitableCarryforward[]; // Prior-year charitable contribution carryforwards
  casualtyLoss: number;
  otherDeductions: number;
}

// ─── Non-Cash Charitable Contributions (Form 8283) ──────

export interface NonCashDonation {
  id: string;
  description: string;
  doneeOrganization: string;
  dateOfContribution: string;
  dateAcquired?: string;
  howAcquired?: 'purchase' | 'gift' | 'inheritance' | 'exchange' | 'other';
  fairMarketValue: number;
  costBasis?: number;
  method?: string;                    // Valuation method
  isCapitalGainProperty?: boolean;    // Determines 30% vs 50% AGI limit
  hasQualifiedAppraisal?: boolean;    // Required for Section B (>$5,000)
  appraiserName?: string;
}

// ─── Donation Valuation Tool ──────────────────────────────

export type DonationCategory =
  | 'clothing_mens' | 'clothing_womens' | 'clothing_childrens'
  | 'furniture' | 'electronics'
  | 'appliances_small' | 'appliances_large'
  | 'kitchen' | 'sports_recreation' | 'toys_games'
  | 'books_media' | 'household' | 'miscellaneous';

export type DonationItemCondition = 'good' | 'very_good' | 'like_new';

export type DonationItemSource = 'salvation_army' | 'goodwill';

export interface DonationItemEntry {
  id: string;
  name: string;
  category: DonationCategory;
  lowFMV: number;   // Good condition
  highFMV: number;  // Like New condition
  source: DonationItemSource;
  keywords?: string[];
}

export interface DonationCategoryMeta {
  id: DonationCategory;
  label: string;
}

export interface DepreciationSchedule {
  category: DonationCategory | 'general';
  /** Cumulative depreciation rates by year (index 0 = year 1). Rate = fraction LOST, not retained. */
  rates: number[];
  /** Rate for items older than the rates array length */
  floorRate: number;
  /** Human-readable disclaimer displayed in UI */
  disclaimer: string;
}

export interface CharitableCarryforward {
  year: number;                       // Year the excess originated
  amount: number;                     // Remaining carryforward amount
  category: 'cash' | 'non_cash_30' | 'non_cash_50';
}

export interface Form8283Result {
  sectionAItems: NonCashDonation[];   // Items with FMV ≤ $5,000
  sectionBItems: NonCashDonation[];   // Items with FMV > $5,000
  totalNonCashFMV: number;
  allowableNonCashDeduction: number;  // After AGI limits
  allowableCashDeduction: number;     // After AGI limits (for total charitable calc)
  excessCarryforward: number;         // Amount carried forward to next year
  carryforwardUsed: number;           // Prior-year carryforward applied this year
}

// Credits
export interface ChildTaxCreditInfo {
  qualifyingChildren: number;   // Under 17
  otherDependents: number;      // 17+ or other qualifying
}

export interface EducationCreditInfo {
  id: string;
  type: 'american_opportunity' | 'lifetime_learning';
  studentName: string;
  studentSSN?: string;            // Student's SSN (Form 8863 Line 21)
  institution: string;
  institutionAddress?: string;    // Institution address (Form 8863 Line 22a(1))
  institutionEIN?: string;        // Institution EIN, 9 digits (Form 8863 Line 22a(4))
  received1098T?: boolean;        // Did student receive 1098-T for 2025? (Form 8863 Line 22a(2))
  received1098TBox7?: boolean;    // Did 2024 1098-T have Box 7 checked? (Form 8863 Line 22a(3))
  tuitionPaid: number;            // From 1098-T Box 1
  scholarships?: number;          // From 1098-T Box 5

  // Second educational institution (Form 8863 Line 22b)
  institution2?: string;            // Line 22b: Second institution name
  institution2Address?: string;     // Line 22b(1): Second institution address
  institution2EIN?: string;         // Line 22b(4): Second institution EIN, 9 digits
  received1098T2?: boolean;         // Line 22b(2): Did student receive 1098-T from second institution?
  received1098T2Box7?: boolean;     // Line 22b(3): Did 2024 1098-T from second institution have Box 7 checked?

  // AOTC eligibility questions (Form 8863 Lines 23-26)
  aotcClaimedPrior4Years?: boolean;   // Line 23: Has AOTC/Hope been claimed for this student for 4+ earlier years?
  enrolledHalfTime?: boolean;          // Line 24: Was student enrolled at least half-time? (default: true for AOTC)
  completedFirst4Years?: boolean;      // Line 25: Did student complete first 4 years before 2025?
  felonyDrugConviction?: boolean;      // Line 26: Was student convicted of a felony drug offense?
}

export interface EducationCreditStudentDetail {
  studentName: string;
  institution: string;
  creditType: 'american_opportunity' | 'lifetime_learning';
  qualifiedExpenses: number;
  creditAmount: number;        // After phase-out
  aotcRefundable: number;      // 40% (AOTC only, 0 for LLC)
  aotcNonRefundable: number;   // 60% (AOTC only, 0 for LLC)
}

// Dependent Care Credit (Form 2441)
export interface DependentCareProvider {
  name: string;                     // Care provider name
  ein?: string;                     // Provider EIN or SSN
  address?: string;                 // Provider address
  amountPaid: number;               // Amount paid to this provider
}

export interface DependentCareInfo {
  totalExpenses: number;            // Total child/dependent care expenses paid
  qualifyingPersons: number;        // Number of qualifying persons (1 or 2+)
  providerName?: string;            // Care provider name (legacy, single-provider)
  providerEin?: string;             // Provider EIN/SSN (legacy, single-provider)
  providers?: DependentCareProvider[];  // Full Part I: multiple providers
  spouseEarnedIncome?: number;      // Spouse earned income (MFJ only — credit limited to lower earner)
  dependentCareFSA?: number;        // Employer-provided dependent care FSA (reduces credit-eligible expenses)
  employerBenefits?: number;        // Part III: Total employer-provided dependent care benefits (W-2 Box 10)
  isStudentSpouse?: boolean;        // IRC §21(d)(2) — Student spouse deemed to earn $250/$500/month
  isDisabledSpouse?: boolean;       // IRC §21(d)(2) — Disabled spouse deemed to earn $250/$500/month
}

// Saver's Credit (Form 8880)
export interface SaversCreditInfo {
  totalContributions: number;       // Total retirement contributions eligible for credit
}

// Residential Clean Energy Credit (Form 5695)
export interface CleanEnergyInfo {
  solarElectric?: number;           // Solar electric (photovoltaic) costs
  solarWaterHeating?: number;       // Solar water heating costs
  smallWindEnergy?: number;         // Small wind energy system costs
  geothermalHeatPump?: number;      // Geothermal heat pump costs
  batteryStorage?: number;          // Battery/energy storage costs (≥3 kWh)
  fuelCell?: number;                // Fuel cell system costs
  fuelCellKW?: number;              // Fuel cell capacity in kW (for cap calculation)
  priorYearCarryforward?: number;   // Prior year carryforward of unused credit (Form 5695, Line 16 from prior year)
}

// EV Credit (Form 8936) — Clean Vehicle Credit
export interface EVCreditInfo {
  vehicleDescription?: string;         // e.g. "2025 Tesla Model 3"
  dateAcquired?: string;               // Date vehicle was placed in service
  vehicleMSRP: number;                 // Manufacturer's Suggested Retail Price
  purchasePrice: number;               // Actual purchase price
  isNewVehicle: boolean;               // New vs. previously owned
  finalAssemblyUS: boolean;            // Final assembly in North America
  meetsBatteryComponentReq: boolean;   // Meets critical mineral/battery component requirements
  meetsMineralReq: boolean;            // Meets critical mineral sourcing requirements
  isVanSUVPickup?: boolean;            // Vehicle is a van, SUV, or pickup truck ($80k MSRP cap vs $55k)
}

// Energy Efficient Home Improvement Credit (Form 5695, Part II)
export interface EnergyEfficiencyInfo {
  heatPump?: number;                   // Heat pumps, heat pump water heaters, biomass stoves ($2000 annual limit)
  centralAC?: number;                  // Central air conditioning
  waterHeater?: number;                // Non-heat-pump water heaters (gas, oil, propane)
  furnaceBoiler?: number;              // Natural gas, propane, or oil furnaces/boilers
  insulation?: number;                 // Insulation and air sealing materials
  windows?: number;                    // Exterior windows, skylights ($200 per item not tracked, aggregate $600 limit)
  doors?: number;                      // Exterior doors ($250/door, $500 aggregate limit)
  electricalPanel?: number;            // Electrical panel upgrade (for electrification, $600 limit)
  homeEnergyAudit?: number;            // Home energy audit ($150 limit)
}

// EV Refueling Property Credit (Form 8911) — per-property detail
export interface EVRefuelingProperty {
  id?: string;                             // UI tracking ID (optional for engine, used by client)
  cost: number;                          // Cost of qualified refueling property
  isBusinessUse?: boolean;               // Business use = $100k cap; personal use = $1k cap
  description?: string;                  // Optional description of property
}

// EV Refueling Property Credit (Form 8911) — input
export interface EVRefuelingCreditInfo {
  properties: EVRefuelingProperty[];     // One or more qualified refueling properties
}

// EV Refueling Property Credit (Form 8911) — result
export interface EVRefuelingCreditResult {
  totalCost: number;                     // Sum of all property costs
  totalCredit: number;                   // Total credit after per-property caps
  propertyResults: { cost: number; credit: number; isBusinessUse: boolean }[];
}

// Alimony paid (for pre-2019 divorce agreements)
export interface AlimonyInfo {
  totalPaid: number;                   // Total alimony/separate maintenance paid during tax year
  recipientSSN?: string;               // Recipient's full 9-digit SSN (stored encrypted)
  recipientSSNLastFour?: string;       // Recipient's SSN last 4 (required for deduction)
  divorceDate: string;                 // Date of divorce/separation agreement
}

// Alimony received (for pre-2019 divorce agreements — included in income per IRC §71)
// @scope Pre-2019 divorce instruments only.
// @limitations Does not model post-2018 modifications that explicitly adopt TCJA treatment.
export interface AlimonyReceivedInfo {
  totalReceived: number;               // Total alimony/separate maintenance received during tax year
  payerSSN?: string;                   // Payer's full 9-digit SSN (stored encrypted)
  payerSSNLastFour?: string;           // Payer's SSN last 4 (informational)
  divorceDate: string;                 // Date of divorce/separation agreement
}

// Form 4684 — Casualties and Thefts
// Authority: IRC §165(c)(3), (h) — Losses from federally declared disasters
export interface CasualtyLossInfo {
  id: string;
  description: string;                 // Property description
  femaDisasterNumber?: string;         // FEMA disaster declaration number (required post-TCJA)
  propertyType: 'personal' | 'business' | 'income_producing';
  costBasis: number;                   // Adjusted basis of property
  insuranceReimbursement: number;      // Insurance or other reimbursement received
  fairMarketValueBefore: number;       // FMV immediately before casualty
  fairMarketValueAfter: number;        // FMV immediately after casualty
}

export interface CasualtyLossResult {
  losses: { id: string; lossPerProperty: number }[];
  totalPersonalLoss: number;           // After $100/event floor, before 10% AGI floor
  agiFloorAmount: number;              // 10% of AGI
  netDeductiblePersonalLoss: number;   // Personal loss after 10% AGI floor
  totalBusinessLoss: number;           // Direct business loss (no floors)
  totalDeductibleLoss: number;         // Combined personal + business
}

// Form 6252 — Installment Sales
// Authority: IRC §453 — Installment method
export interface InstallmentSaleInfo {
  id: string;
  description: string;                // Property description
  dateOfSale: string;                 // Date of sale
  sellingPrice: number;               // Selling price
  mortgagesAssumedByBuyer?: number;   // Buyer-assumed mortgages
  costOrBasis: number;                // Cost or adjusted basis
  depreciationAllowed?: number;       // Depreciation allowed/allowable
  sellingExpenses?: number;           // Commissions, legal fees, etc.
  paymentsReceivedThisYear: number;   // Payments received in current tax year
}

export interface InstallmentSaleResult {
  contractPrice: number;              // Selling price - buyer-assumed mortgages
  grossProfit: number;                // Selling price - basis - expenses
  grossProfitRatio: number;           // Gross profit / contract price (percentage)
  ordinaryIncomeRecapture: number;    // Depreciation recapture (§1250/§1245) — reported in full in year of sale
  installmentSaleIncome: number;      // Payments × gross profit ratio
  totalReportableIncome: number;      // installmentSaleIncome (capital gain portion)
}

// Nonbusiness Bad Debt — IRC §166(d)
// Treated as short-term capital loss on Schedule D.
export interface NonbusinessBadDebt {
  id: string;
  debtorName: string;                  // Name of person/entity who owed the debt
  description: string;                 // Nature of the debt
  amountOwed: number;                  // Total amount that became worthless
}

// Excess Contribution Penalties (Form 5329)
// @scope Current-year excess only.
// @limitations Does not model prior-year carryforward of uncorrected excess
//   or last-month rule testing period (Form 8889 Part III).
export interface ExcessContributionInfo {
  iraExcessContribution?: number;      // Amount over annual IRA limit
  hsaExcessContribution?: number;      // Amount over HSA annual limit
  esaExcessContribution?: number;      // Amount over Coverdell ESA annual limit ($2,000) — IRC §4973(e)
}

// HSA Excess Contribution Withdrawal — IRC §4973(g) corrective withdrawal
// When HSA contributions exceed the annual limit, the filer can withdraw the excess
// (plus earnings) by the filing deadline to avoid the 6% excise tax.
// @authority Pub 969 — "Excess Employer Contributions"; Form 5329 Instructions Part VII
export interface HSAExcessWithdrawal {
  choice: 'full' | 'partial' | 'none';  // Will filer withdraw excess before filing deadline?
  withdrawalAmount?: number;             // Amount to withdraw (only for 'partial')
  earningsOnExcess?: number;             // Net income attributable to excess — withdrawn & reported as Other income
}

// IRA Excess Contribution Withdrawal — IRC §4973(a) / §219(b) corrective withdrawal
// When IRA contributions exceed the annual limit, the filer can withdraw the excess
// (plus net income attributable) by the filing deadline to avoid the 6% excise tax.
// @authority Pub 590-A — "What if You Contribute Too Much?"; Form 5329 Instructions Part III
export interface IRAExcessWithdrawal {
  choice: 'full' | 'partial' | 'none';  // Will filer withdraw excess before filing deadline?
  withdrawalAmount?: number;             // Amount to withdraw (only for 'partial')
  earningsOnExcess?: number;             // Net income attributable to excess — withdrawn & reported as Other income
}

// SECURE 2.0 Emergency Personal Expense Distribution — IRC §72(t)(2)(I)
export interface EmergencyDistributionInfo {
  totalEmergencyDistributions: number; // Total emergency distributions taken in tax year (up to $1,000 exempt)
}

export interface Form5329Result {
  iraExciseTax: number;                // 6% of IRA excess contribution
  hsaExciseTax: number;                // 6% of HSA excess contribution
  esaExciseTax: number;                // 6% of Coverdell ESA excess contribution — IRC §4973(e)
  earlyDistributionPenalty: number;    // 10% penalty on early distributions (after exemptions)
  emergencyExemption: number;          // Amount exempt under §72(t)(2)(I) emergency provision
  earlyDistributionExceptionAmount: number; // Amount exempt under IRC §72(t)(2) partial exceptions
  totalPenalty: number;
}

// 1099-Q (Qualified Education Program — 529/Coverdell Distributions)
// @scope Basic qualified/non-qualified determination.
// @limitations Does not model basis/earnings ratio for partial qualified use,
//   coordination with education credits, or Coverdell ESA interaction.
export interface Income1099Q {
  id: string;
  payerName: string;                   // Plan/trustee name
  grossDistribution: number;           // Box 1: Gross distribution
  earnings: number;                    // Box 2: Earnings
  basisReturn: number;                 // Box 3: Basis (return of contribution, not taxable)
  qualifiedExpenses: number;           // User-entered: amount used for qualified education expenses
  taxFreeAssistance?: number;          // Scholarships, grants, tax-free aid (reduces QEE for AQEE)
  expensesClaimedForCredit?: number;   // QEE allocated to AOC/LLC (reduces QEE for AQEE, anti-double-dip)
  distributionType: 'qualified' | 'non_qualified' | 'rollover';
  recipientType?: 'accountOwner' | 'beneficiary'; // IRC §529(c)(3)(A): 1099-Q issued to beneficiary → income on beneficiary's return
}

// QBI (Qualified Business Income) detail — per-business for W-2 wages/UBIA calculation
export interface QBIInfo {
  isSSTB?: boolean;                     // Is this a Specified Service Trade or Business? (legacy single-business)
  w2WagesPaidByBusiness?: number;       // Total W-2 wages paid by the business (legacy single-business)
  ubiaOfQualifiedProperty?: number;     // Unadjusted Basis Immediately After Acquisition of qualified property (legacy single-business)
  isAgriculturalCooperativePatron?: boolean; // IRC §199A(g) — patron of specified ag cooperative (QBI computed by cooperative, not individual)
  businesses?: QBIBusinessEntry[];      // Per-business QBI detail (Form 8995-A) — overrides legacy fields when present
}

// Per-business QBI entry for multi-business scenarios (Form 8995-A)
export interface QBIBusinessEntry {
  businessId: string;                   // Links to BusinessInfo.id or K-1 entity
  businessName?: string;                // For identification / display
  qualifiedBusinessIncome: number;      // QBI attributable to this business
  isSSTB: boolean;                      // Is this business an SSTB?
  w2WagesPaid: number;                  // W-2 wages paid by this business
  ubiaOfQualifiedProperty: number;      // UBIA for this business
}

// ── Form 7206 — Self-Employed Health Insurance Deduction ──

export interface Form7206MonthlyEligibility {
  /** Per month (Jan=0..Dec=11): was taxpayer eligible for an employer-subsidized plan? */
  taxpayerEligibleForEmployerPlan: boolean[];  // 12 booleans
  /** MFJ only: per month, was spouse eligible? */
  spouseEligibleForEmployerPlan?: boolean[];
}

export interface Form7206Input {
  businessId?: string;                        // Which business established the plan (for multi-Sched-C)
  medicalDentalVisionPremiums: number;        // Line 1
  longTermCarePremiums?: number;              // Line 2 (before age-based limit)
  medicarePremiums?: number;                  // Line 3 (Parts A/B/D/Advantage)
  monthlyEligibility?: Form7206MonthlyEligibility; // Part II (omit = all 12 months eligible)
  taxpayerAge?: number;                       // For LTC limit lookup
  spouseAge?: number;                         // For LTC limit lookup (MFJ)
  taxpayerLTCPremium?: number;                // Per-person split for age-based limits
  spouseLTCPremium?: number;
}

export interface Form7206Result {
  medicalDentalVisionPremiums: number;
  longTermCarePremiumsClaimed: number;        // After age-based limit
  medicarePremiums: number;
  totalPremiums: number;                      // Sum of lines 1-3
  eligibleMonths: number;                     // 0-12
  proratedPremiums: number;                   // totalPremiums * eligibleMonths/12
  netSEProfit: number;
  deductibleHalfSETax: number;
  seRetirementContributions: number;
  adjustedNetSEProfit: number;                // net - SE tax deduction - retirement
  netProfitLimitedAmount: number;             // min(prorated, adjustedNet)
  ptcAdjustment: number;
  finalDeduction: number;                     // → Schedule 1 Line 17
  taxpayerLTCLimit: number;
  spouseLTCLimit: number;
  warnings: string[];
}

// Self-employment specific deductions
export interface SelfEmploymentDeductions {
  healthInsurancePremiums: number;
  form7206?: Form7206Input;                   // Detailed Form 7206 input (overrides healthInsurancePremiums when present)
  sepIraContributions: number;
  // Solo 401(k): split into employee deferral + employer contribution
  solo401kEmployeeDeferral?: number;
  solo401kEmployerContribution?: number;
  solo401kRothDeferral?: number;              // Portion of employee deferral designated as Roth (after-tax, not deductible)
  solo401kContributions: number;              // Backward-compat total (= sum of above, or flat amount if above not provided)
  // Solo 401(k) plan details (for Form 5500-EZ)
  solo401kPlanBalance?: number;               // Plan assets at end of year (triggers Form 5500-EZ if >$250,000)
  solo401kPlanStartBalance?: number;          // Plan assets at start of year
  solo401kPlanDistributions?: number;         // Distributions during the year
  solo401kPlanName?: string;                  // Plan name (e.g., "John Smith Solo 401(k)")
  solo401kPlanNumber?: string;                // 3-digit plan number (typically "001")
  solo401kPlanEIN?: string;                   // Employer Identification Number
  // SIMPLE IRA contributions
  simpleIraContributions?: number;            // Employee elective deferrals to SIMPLE IRA
  otherRetirementContributions: number;
}

// Solo 401(k) calculation input
export interface Solo401kInput {
  scheduleCNetProfit: number;      // Schedule C net profit
  seDeductibleHalf: number;        // Deductible half of SE tax (from Schedule SE)
  employeeDeferral?: number;       // User's desired employee deferral (traditional + Roth combined)
  rothDeferral?: number;           // Portion of employee deferral designated as Roth (not deductible)
  employerContribution?: number;   // User's desired employer contribution
  age?: number;                    // Taxpayer's age at end of tax year (for catch-up eligibility)
  w2SalaryDeferrals?: number;      // W-2 401(k)/403(b) deferrals (reduces §402(g) limit)
  simpleIraDeferrals?: number;     // SIMPLE IRA elective deferrals (reduces §402(g) limit)
  sepIraContributions?: number;    // SEP-IRA contributions from same business (aggregated for §415(c))
}

// Solo 401(k) calculation result
export interface Solo401kResult {
  adjustedNetSEIncome: number;         // Net profit - SE deductible half
  maxEmployeeDeferral: number;         // Maximum employee deferral (after W-2/SIMPLE coordination + catch-up)
  maxEmployerContribution: number;     // Maximum employer contribution (20% of adjusted net SE income)
  maxTotalContribution: number;        // Annual addition limit + catch-up (lesser of $70k or 100% comp)
  appliedEmployeeDeferral: number;     // Actual employee deferral (capped to limits)
  appliedEmployerContribution: number; // Actual employer contribution (capped to limits)
  appliedRothDeferral: number;         // Portion of applied employee deferral designated as Roth
  deductibleContribution: number;      // Deductible amount = total - Roth deferral (for Schedule 1 Line 16)
  totalContribution: number;           // Total applied contribution
  catchUpEligible: boolean;            // Age 50+ catch-up eligible
  superCatchUpEligible: boolean;       // Age 60-63 super catch-up eligible (SECURE 2.0)
  catchUpAmount: number;               // Catch-up amount ($0, $7,500, or $11,250)
  form5500EZRequired: boolean;         // Whether Form 5500-EZ filing is required (plan balance > $250k)
  warnings: string[];                  // Limit enforcement messages
}

// SEP-IRA calculation input
export interface SEPIRAInput {
  scheduleCNetProfit: number;      // Schedule C net profit
  seDeductibleHalf: number;        // Deductible half of SE tax
  desiredContribution?: number;    // User's desired contribution
}

// SEP-IRA calculation result
export interface SEPIRAResult {
  adjustedNetSEIncome: number;     // Net profit - SE deductible half
  maxContribution: number;         // Maximum allowed contribution
  appliedContribution: number;     // Actual contribution (capped)
  warnings: string[];              // Limit enforcement messages
}

// HSA Form 8889 — detailed HSA contribution tracking
export interface HSAContributionInfo {
  coverageType: 'self_only' | 'family';
  totalContributions: number;        // Total contributions (employee + employer)
  employerContributions?: number;    // Employer contributions (W-2 Box 12, Code W)
  catchUpContributions?: number;     // Additional $1,000 if age 55+ (already included in totalContributions)
  hdhpCoverageMonths?: number;       // Months of HDHP coverage (1-12, default 12). Prorates contribution limit per IRC §223(b)(2).
  dateOfBirth?: string;              // For age 55+ catch-up verification per IRC §223(b)(3)
  taxYear?: number;                  // Tax year for age calculation
}

// Form 8606 — Nondeductible IRA / Roth Conversion tracking
export interface Form8606Info {
  nondeductibleContributions?: number;  // Current year non-deductible traditional IRA contributions
  priorYearBasis?: number;              // Total non-deductible basis from prior years (Form 8606 Line 2)
  traditionalIRABalance?: number;       // Total traditional IRA balance (year-end, for pro-rata)
  rothConversionAmount?: number;        // Amount converted from traditional to Roth
}

// Estimated Tax Penalty (Form 2210)
export interface EstimatedTaxPenaltyResult {
  requiredAnnualPayment: number;
  totalPaymentsMade: number;
  underpaymentAmount: number;
  penalty: number;
  usedAnnualizedMethod?: boolean;    // True if annualized method produced lower penalty
  regularPenalty?: number;           // Regular method penalty (for comparison)
  annualizedPenalty?: number;        // Annualized method penalty (for comparison)
  // Per-quarter detail for Form 2210 Part II (Lines 11-18)
  quarterlyDetail?: QuarterlyPenaltyDetail[];
}

// Per-quarter penalty detail (Form 2210 Part II)
export interface QuarterlyPenaltyDetail {
  requiredInstallment: number;   // Line 12: required installment for this quarter
  paymentMade: number;           // Line 13: payment applied to this quarter
  underpayment: number;          // Line 17: underpayment for this quarter
  penalty: number;               // Line 18: penalty for this quarter
}

// Annualized Income Installment Method (Form 2210, Schedule AI)
// IRC §6654(d)(2) — Taxpayers with uneven income can use quarterly annualized income
// to reduce or eliminate the underpayment penalty.
export interface AnnualizedIncomeInfo {
  // Cumulative taxable income through end of each period:
  //   Q1: Jan 1 - Mar 31
  //   Q2: Jan 1 - May 31
  //   Q3: Jan 1 - Aug 31
  //   Q4: Jan 1 - Dec 31 (= full year)
  cumulativeIncome: [number, number, number, number];
  // Cumulative tax withheld through end of each period (optional — defaults to equal quarters)
  cumulativeWithholding?: [number, number, number, number];
}

// Kiddie Tax (Form 8615) — one entry per qualifying child
export interface KiddieTaxInfo {
  id: string;                             // Unique identifier
  dependentId?: string;                   // Links to Dependent.id (for name/age auto-fill)
  childName?: string;                     // Child's name (auto-filled from dependent or manual)
  childUnearnedIncome: number;            // Child's unearned income (interest, dividends, cap gains)
  childEarnedIncome?: number;             // Child's earned income
  parentMarginalRate?: number;            // Parent's marginal tax rate (if known)
  childAge: number;                       // Child's age at end of tax year
  isFullTimeStudent?: boolean;            // Full-time student (extends age limit to 24)
}

// Foreign Earned Income Exclusion (Form 2555)
export interface ForeignEarnedIncomeInfo {
  foreignEarnedIncome: number;          // Total foreign earned income
  qualifyingDays?: number;              // Days meeting bona fide/physical presence test (max 365)
  housingExpenses?: number;             // Foreign housing expenses paid
}

// Schedule H — Household Employee Tax
export interface HouseholdEmployeeInfo {
  totalCashWages: number;               // Total cash wages paid to all household employees
  federalTaxWithheld?: number;          // Federal income tax withheld (optional, agreed upon)
  numberOfEmployees?: number;           // Number of household employees
  subjectToFUTA?: boolean;             // Schedule H Line 9: paid $1,000+ in any calendar quarter? (default: auto-detect from wages)
}

export interface ScheduleHResult {
  socialSecurityTax: number;
  medicareTax: number;
  futaTax: number;
  totalTax: number;
}

// Adoption Credit (Form 8839)
export interface AdoptionCreditInfo {
  qualifiedExpenses: number;            // Qualified adoption expenses per child
  numberOfChildren?: number;            // Number of children adopted (default 1)
  isSpecialNeeds?: boolean;             // Special needs adoption (full credit regardless of expenses)
}

export interface AdoptionCreditResult {
  expensesBasis: number;
  credit: number;
}

// Form 4797 — Sales of Business Property
// Authority: IRC §§1231, 1245, 1250; Form 4797

/** Individual property reported on Form 4797 */
export interface Form4797Property {
  id: string;
  description: string;                   // Property description (e.g. "Office Equipment", "Rental Building")
  dateAcquired: string;                  // Date acquired
  dateSold: string;                      // Date sold or disposed
  salesPrice: number;                    // Gross sales price
  costBasis: number;                     // Original cost or other basis
  depreciationAllowed: number;           // Total depreciation allowed or allowable
  isSection1245?: boolean;               // Section 1245 property (personal property, equipment — full depreciation recapture)
  isSection1250?: boolean;               // Section 1250 property (real property, buildings — partial recapture)
  straightLineDepreciation?: number;     // Straight-line depreciation amount (for §1250 excess recapture calc)
}

/** Per-property result from Form 4797 calculation */
export interface Form4797PropertyResult {
  propertyId: string;
  description: string;
  gain: number;                           // Total gain (salesPrice - adjustedBasis)
  loss: number;                           // Total loss (0 if gain)
  adjustedBasis: number;                  // costBasis - depreciationAllowed
  section1245OrdinaryIncome: number;      // §1245 depreciation recaptured as ordinary income
  section1250OrdinaryIncome: number;      // §1250 excess depreciation recaptured as ordinary income
  unrecapturedSection1250Gain: number;    // Straight-line depreciation on §1250 property → 25% rate
  section1231GainOrLoss: number;          // Remaining gain/loss → §1231 netting
}

/** Aggregate Form 4797 result */
export interface Form4797Result {
  // Aggregate results
  totalOrdinaryIncome: number;            // §1245 + §1250 ordinary recapture (→ Form 1040 other income)
  netSection1231GainOrLoss: number;       // Net of all §1231 gains and losses
  section1231IsGain: boolean;             // If net positive → treated as LTCG; if negative → ordinary loss
  unrecapturedSection1250Gain: number;    // Total unrecaptured §1250 gain → 25% rate zone
  totalGain: number;                      // Sum of all gains
  totalLoss: number;                      // Sum of all losses
  // Per-property breakdown
  propertyResults: Form4797PropertyResult[];
}

// Form 4137 — Social Security and Medicare Tax on Unreported Tip Income
// Authority: IRC §3121(q), Form 4137
export interface Form4137Info {
  unreportedTips: number;                // Total unreported tips subject to SS/Medicare
}

export interface Form4137Result {
  unreportedTips: number;               // Tips subject to tax
  socialSecurityTax: number;            // Employee share SS tax (6.2%)
  medicareTax: number;                  // Employee share Medicare tax (1.45%)
  totalTax: number;                     // SS + Medicare
  tipsSubjectToSS: number;             // Tips subject to SS (after wage base cap)
  tipsSubjectToMedicare: number;        // Tips subject to Medicare (no cap)
}

// Schedule F — Farm Income (Profit or Loss from Farming)
// Authority: IRC §§61, 162; Schedule F (Form 1040)
export interface ScheduleFInfo {
  // Part I — Farm Income (Cash Method)
  salesOfLivestock?: number;
  costOfLivestock?: number;
  salesOfProducts?: number;
  cooperativeDistributions?: number;
  cooperativeDistributionsTaxable?: number;
  agriculturalProgramPayments?: number;
  cccLoans?: number;
  cropInsuranceProceeds?: number;
  customHireIncome?: number;
  otherFarmIncome?: number;
  // Part II — Farm Expenses
  carAndTruck?: number;
  chemicals?: number;
  conservation?: number;
  customHireExpense?: number;
  depreciation?: number;
  employeeBenefit?: number;
  feed?: number;
  fertilizers?: number;
  freight?: number;
  gasolineFuel?: number;
  insurance?: number;
  interest?: number;
  labor?: number;
  pension?: number;
  rentLease?: number;
  repairs?: number;
  seeds?: number;
  storage?: number;
  supplies?: number;
  taxes?: number;
  utilities?: number;
  veterinary?: number;
  otherExpenses?: number;
  // Schedule SE Part II §A — Farm Optional Method election
  // Allows reporting min(2/3 × gross farm income, $7,240) as net SE earnings
  // instead of actual net farm profit. Used when gross farm income ≤ $10,860
  // or net farm profit < $7,840 to build Social Security credits.
  useFarmOptionalMethod?: boolean;
}

export interface ScheduleFResult {
  grossIncome: number;
  totalExpenses: number;
  netFarmProfit: number;
  farmOptionalMethodAmount?: number;  // If elected: min(2/3 × gross, $7,240)
}

// Form 4835 — Farm Rental Income (passive)
// Authority: IRC §469; Form 4835
// For landowners who do not materially participate in farming.
// Income flows to Schedule E as passive income.
export interface FarmRentalInfo {
  id: string;
  description?: string;               // Description of farm (location, crop, etc.)
  rentalIncome: number;               // Gross farm rental income
  expenses: {
    insurance?: number;
    repairs?: number;
    taxes?: number;
    utilities?: number;
    depreciation?: number;
    other?: number;
  };
}

export interface FarmRentalResult {
  grossIncome: number;
  totalExpenses: number;
  netIncome: number;                  // May be negative (loss)
}

// Schedule R — Credit for the Elderly or the Disabled
// Authority: IRC §22; Schedule R (Form 1040)
export interface ScheduleRInfo {
  isAge65OrOlder: boolean;
  isSpouseAge65OrOlder?: boolean;
  isDisabled?: boolean;
  isSpouseDisabled?: boolean;
  taxableDisabilityIncome?: number;
  spouseTaxableDisabilityIncome?: number;
  nontaxableSocialSecurity?: number;
  nontaxablePensions?: number;
}

export interface ScheduleRResult {
  qualifies: boolean;
  initialAmount: number;
  nontaxableReduction: number;
  agiReduction: number;
  creditBase: number;
  creditRate: number;
  credit: number;
}

// Head of Household Validation Result
export interface HoHValidationResult {
  isValid: boolean;                      // Whether HoH filing status requirements are met
  errors: string[];                      // Specific validation errors
  warnings: string[];                    // Non-blocking warnings (informational)
}

// Deceased Spouse Validation Result — IRC §6013(a)(2), IRC §2(a)
export interface DeceasedSpouseValidationResult {
  isValid: boolean;                      // Whether the filing status is consistent with deceased spouse info
  spouseDiedDuringTaxYear: boolean;      // Spouse died during the return's tax year
  qualifiesForMFJ: boolean;             // MFJ allowed for year of death per IRC §6013(a)(2)
  qualifiesForQSS: boolean;             // QSS allowed within 2 years after year of death per IRC §2(a)
  errors: string[];                      // Validation errors
  warnings: string[];                    // Informational warnings
}

// Qualified Opportunity Zone (Form 8997)
export interface QOZInvestmentInfo {
  deferredGain: number;                  // Capital gain deferred via QOZ investment
  investmentDate: string;                // Date of QOZ investment
  investmentAmount: number;              // Amount invested in QOZ
}

// Premium Tax Credit (Form 8962)
export interface Form1095AInfo {
  id: string;
  marketplace: string;                    // Marketplace name
  policyNumber?: string;                  // Policy number
  // Monthly data (12 months)
  enrollmentPremiums: number[];           // Column A: Monthly enrollment premiums (12 entries)
  slcspPremiums: number[];               // Column B: Monthly SLCSP premiums (12 entries)
  advancePTC: number[];                  // Column C: Monthly advance PTC (12 entries)
  coverageMonths: boolean[];             // Which months had coverage (12 entries)
}

export interface PremiumTaxCreditInfo {
  forms1095A: Form1095AInfo[];            // One or more 1095-A forms
  familySize: number;                     // Tax family size (for FPL calculation)
  state?: 'AK' | 'HI' | string;         // State for FPL table selection (AK/HI have different FPL)
  isVictimOfDomesticAbuse?: boolean;      // MFS exception: domestic abuse
  isSpousalAbandonment?: boolean;         // MFS exception: spousal abandonment
}

export interface PremiumTaxCreditResult {
  annualPTC: number;                      // Total PTC calculated for the year
  totalAPTC: number;                      // Total advance PTC received (from 1095-A)
  netPTC: number;                         // Net PTC = annualPTC - totalAPTC (if positive, additional credit)
  excessAPTC: number;                     // Excess APTC = totalAPTC - annualPTC (if positive, must repay)
  repaymentCap: number;                   // Repayment limitation (from Table 5)
  excessAPTCRepayment: number;            // Actual repayment = min(excessAPTC, repaymentCap)
  householdIncome: number;                // Household income used for calculation
  fplPercentage: number;                  // Income as % of FPL
  applicableFigure: number;              // Expected contribution percentage
  expectedContribution: number;           // Annual expected contribution
  monthlyDetails: {
    month: number;
    enrollmentPremium: number;
    slcspPremium: number;
    monthlyPTC: number;
    advancePTC: number;
    hasCoverage: boolean;
  }[];
}

// Schedule 1-A — Additional Deductions (OBBBA, 2025-2028)
export interface Schedule1AInfo {
  // No Tax on Tips
  qualifiedTips?: number;                // Total qualified tips reported (W-2 Box 7 / 4137)
  isTippedOccupation?: boolean;          // In IRS-listed tipped occupation
  isSelfEmployedTipped?: boolean;        // Self-employed in tipped occupation (non-SSTB)

  // No Tax on Overtime
  qualifiedOvertimePay?: number;         // Premium portion of overtime (the "half" in time-and-a-half)
  isFLSANonExempt?: boolean;            // Employee is FLSA non-exempt (overtime-eligible)

  // No Tax on Car Loan Interest
  carLoanInterestPaid?: number;          // Interest paid on qualified motor vehicle loan
  vehicleVIN?: string;                   // VIN (required for deduction)
  vehicleAssembledInUS?: boolean;        // Final assembly in the United States
  isNewVehicle?: boolean;                // Original use commences with taxpayer

  // Enhanced Senior Deduction
  // (Age 65+ determined from dateOfBirth on TaxReturn; spouse from spouseDateOfBirth)
}

export interface Schedule1AResult {
  tipsDeduction: number;                 // Qualified tips deduction (after cap + phase-out)
  overtimeDeduction: number;             // Qualified overtime deduction (after cap + phase-out)
  carLoanInterestDeduction: number;      // Car loan interest deduction (after cap + phase-out)
  seniorDeduction: number;               // Enhanced senior deduction (after phase-out)
  totalDeduction: number;                // Sum of all four → Form 1040 line 13b
  tipsPhaseOutReduction: number;         // Phase-out reduction applied to tips
  overtimePhaseOutReduction: number;     // Phase-out reduction applied to overtime
  carLoanPhaseOutReduction: number;      // Phase-out reduction applied to car loan interest
  seniorPhaseOutReduction: number;       // Phase-out reduction applied to senior deduction
}

// Sale of Home Exclusion (Section 121)
export interface HomeSaleInfo {
  salePrice: number;                     // Gross sale price (Form 1099-S Box 2)
  costBasis: number;                     // Original purchase price + improvements
  sellingExpenses?: number;              // Commissions, transfer taxes, etc.
  ownedMonths: number;                   // Months owned in last 5 years (need ≥24)
  usedAsResidenceMonths: number;         // Months used as primary residence in last 5 years (need ≥24)
  priorExclusionUsedWithin2Years?: boolean; // Used Section 121 exclusion within last 2 years
}

export interface HomeSaleResult {
  gainOrLoss: number;                    // Total gain (or loss)
  exclusionAmount: number;               // Section 121 exclusion applied
  taxableGain: number;                   // Gain after exclusion (flows to Schedule D as LTCG)
  qualifiesForExclusion: boolean;        // Whether taxpayer qualifies
  maxExclusion: number;                  // $250k or $500k based on filing status
}

// 1099-DA (Digital Asset / Crypto) — NEW for 2025
export interface Income1099DA {
  id: string;
  brokerName: string;
  tokenName: string;                   // e.g. "Bitcoin", "Ethereum"
  tokenSymbol?: string;                // e.g. "BTC", "ETH"
  description?: string;                // e.g. "0.5 BTC"
  dateAcquired?: string;               // Date acquired (may be unknown for older assets)
  dateSold: string;                     // Date sold/disposed
  proceeds: number;                     // Gross proceeds (Box 1b)
  costBasis: number;                    // Cost or other basis (Box 1c) — may be 0 if unknown
  isLongTerm: boolean;                  // Held > 1 year
  federalTaxWithheld?: number;         // Box 4
  washSaleLossDisallowed?: number;     // Wash sale loss disallowed
  transactionId?: string;              // Blockchain transaction hash
  isBasisReportedToIRS?: boolean;      // Whether broker reported basis (TY2025: proceeds only)
}

// 1099-C (Cancellation of Debt)
export interface Income1099C {
  id: string;
  payerName: string;                    // Creditor/lender name
  dateOfCancellation: string;           // Box 1: Date of identifiable event
  amountCancelled: number;              // Box 2: Amount of debt cancelled
  interestIncluded?: number;            // Box 3: Interest if included in Box 2
  debtDescription?: string;            // Box 4: Description of debt
  identifiableEventCode?: string;       // Box 6: Code A-H (bankruptcy, statute of limitations, etc.)
  federalTaxWithheld?: number;
}

// Form 982 — Reduction of Tax Attributes Due to Discharge of Indebtedness
export interface Form982Info {
  isInsolvent: boolean;                 // Line 1b: Discharge occurred when insolvent
  totalLiabilitiesBefore: number;       // Total liabilities immediately before discharge
  totalAssetsBefore: number;            // FMV of all assets immediately before discharge
  isBankruptcy?: boolean;              // Line 1a: Discharge in Title 11 bankruptcy
  isQualifiedPrincipalResidence?: boolean; // Line 1e: Qualified principal residence (expired 2025)
  isQualifiedFarmDebt?: boolean;       // Line 1c: Qualified farm indebtedness
}

export interface Form982Result {
  totalCancelledDebt: number;          // Total from all 1099-C forms
  insolvencyAmount: number;            // Liabilities - Assets (amount of insolvency)
  exclusionAmount: number;             // Amount excluded from income
  taxableAmount: number;               // Amount included in income

  // Part II — Reduction of Tax Attributes (IRC §108(b)(2) mandatory order)
  // These represent how much of the exclusion amount reduces each attribute.
  nolReduction: number;                // Line 4: NOL for the year + carryforward
  gbcReduction: number;                // Line 5: General business credit carryover (not tracked — always 0)
  mtcReduction: number;                // Line 6: Minimum tax credit (not tracked — always 0)
  capitalLossReduction: number;        // Line 7: Net capital loss + carryover
  basisReduction: number;              // Line 8: Basis reduction under §1017 (remainder)
  palReduction: number;                // Line 9: Passive activity loss / credit carryover
}

// Investment Interest Expense (Form 4952)
export interface InvestmentInterestInfo {
  investmentInterestPaid: number;       // Line 1: Investment interest expense paid
  priorYearDisallowed?: number;        // Line 2: Disallowed investment interest from prior year
  electToIncludeQualifiedDividends?: boolean; // Line 4a election: include QD in NII
  electToIncludeLTCG?: boolean;        // Line 4b election: include net LTCG in NII
}

export interface InvestmentInterestResult {
  totalExpense: number;                 // Line 1 + Line 2
  netInvestmentIncome: number;         // Line 3 (or 4 if elections made)
  deductibleAmount: number;            // Line 8: min(totalExpense, NII)
  carryforward: number;                // Excess to carry forward to next year
}

// Prior-year summary for YoY comparison (LookBack)
export interface PriorYearSummary {
  source: 'telostax-json' | '1040-pdf' | 'competitor-pdf';
  taxYear: number;
  filingStatus?: string;
  providerName?: string;           // Detected provider name (e.g. competitor software name)
  totalIncome: number;
  agi: number;
  taxableIncome: number;
  deductionAmount: number;
  totalTax: number;
  totalCredits: number;
  totalPayments: number;
  refundAmount: number;
  amountOwed: number;
  effectiveTaxRate: number;
  // Breakdown (all available from JSON import; partial from PDF)
  totalWages?: number;
  totalInterest?: number;
  totalDividends?: number;
  scheduleCNetProfit?: number;
  capitalGainOrLoss?: number;
  seTax?: number;
  // Enhanced breakdown (PDF can extract some of these from 1040 lines)
  estimatedTaxPayments?: number;
  iraDistributions?: number;      // Line 4b — taxable IRA distributions
  pensionsAnnuities?: number;     // Line 5b — taxable pensions/annuities
  socialSecurityBenefits?: number; // Line 6b — taxable Social Security
}

// Full tax return data
export interface TaxReturn {
  id: string;
  schemaVersion: number;            // Data migration version — bumped by migration runner on load
  taxYear: number;
  status: 'in_progress' | 'review' | 'completed';
  currentStep: number;
  currentStepId?: string;          // Wizard step ID for safe restoration (e.g. 'filing_status')
  currentSection: string;

  // Personal info
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  suffix?: string;                    // Jr., Sr., III, etc.
  ssn?: string;                        // Full 9-digit SSN (stored encrypted)
  ssnLastFour?: string;
  dateOfBirth?: string;
  occupation?: string;
  isLegallyBlind?: boolean;
  canBeClaimedAsDependent?: boolean;  // "Can someone else claim you as a dependent?"
  isFullTimeStudent?: boolean;         // IRC §25B(c)(2) — disqualifies from Saver's Credit
  isSpouseFullTimeStudent?: boolean;   // IRC §25B(c)(2) — disqualifies spouse from Saver's Credit (MFJ)
  isClaimedAsDependent?: boolean;      // IRC §25B(c)(3) — actually claimed as dependent (disqualifies from Saver's Credit)
  providedHalfOwnSupport?: boolean;   // Form 8863 Line 7: Did filer provide more than half own support?
  hasLivingParent?: boolean;          // Form 8863 Line 7: Did filer have at least one living parent at year-end?
  isActiveDutyMilitary?: boolean;     // Active-duty Armed Forces member — unlocks Form 3903 moving expenses
  nontaxableCombatPay?: number;       // Form 1040 Line 1i — nontaxable combat zone pay (EITC election)
  includeCombatPayForEITC?: boolean;  // IRC §32(c)(2)(B)(vi) — elect to include combat pay in earned income for EITC
  movingExpenses?: number;            // Form 3903 — moving expenses deduction (military only, Schedule 1 Line 14)
  presidentialCampaignFund?: boolean; // $3 to Presidential Election Campaign Fund
  ipPin?: string;                      // IRS Identity Protection PIN (6 digits) — protects against tax identity theft

  // Address
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;

  // Filing
  filingStatus?: FilingStatus;
  livedApartFromSpouse?: boolean;       // IRC §86(c)(1)(C)(ii) — MFS filer lived apart from spouse entire year (affects SS taxability thresholds)

  // Spouse (if MFJ)
  spouseFirstName?: string;
  spouseMiddleInitial?: string;
  spouseLastName?: string;
  spouseSuffix?: string;
  spouseSsn?: string;                   // Full 9-digit spouse SSN (stored encrypted)
  spouseSsnLastFour?: string;
  spouseDateOfBirth?: string;
  spouseOccupation?: string;
  spouseIsLegallyBlind?: boolean;
  spousePresidentialCampaignFund?: boolean;
  spouseIpPin?: string;                    // Spouse's IRS Identity Protection PIN (6 digits)

  // Deceased spouse — IRC §6013(a)(2), IRC §2(a)
  spouseDateOfDeath?: string;         // Date of spouse's death (if deceased during or before tax year)
  isDeceasedSpouseReturn?: boolean;   // True if filing joint return for year of spouse's death

  // Dependents
  dependents: Dependent[];

  // Income
  w2Income: W2Income[];
  income1099NEC: Income1099NEC[];
  income1099K: Income1099K[];
  income1099INT: Income1099INT[];
  income1099OID?: Income1099OID[];
  income1099DIV: Income1099DIV[];
  income1099R: Income1099R[];
  income1099G: Income1099G[];
  income1099MISC: Income1099MISC[];
  income1099B: Income1099B[];
  incomeSSA1099?: IncomeSSA1099;
  incomeK1: IncomeK1[];
  income1099SA: Income1099SA[];
  incomeW2G: IncomeW2G[];
  income1099DA: Income1099DA[];
  income1099C: Income1099C[];
  rentalProperties: RentalProperty[];
  royaltyProperties?: RoyaltyProperty[];
  capitalLossCarryforward?: number;    // Carryforward from prior year (legacy, single number treated as ST)
  capitalLossCarryforwardST?: number;  // Short-term carryforward from prior year
  capitalLossCarryforwardLT?: number;  // Long-term carryforward from prior year
  unrecapturedSection1250Gain?: number; // IRC §1(h)(1)(E) — unrecaptured §1250 gain (25% rate zone, from Form 4797 or direct)
  form4797Properties?: Form4797Property[]; // Form 4797 — Sales of Business Property (Sprint 23 integration)
  otherIncome: number;

  // 1099-Q (529 distributions)
  income1099Q: Income1099Q[];

  // Self-employment
  business?: BusinessInfo;              // Single business (legacy, backward-compatible)
  businesses: BusinessInfo[];           // Multiple businesses (Sprint 15+)
  expenses: ExpenseEntry[];
  homeOffice?: HomeOfficeInfo;
  vehicle?: VehicleInfo;
  depreciationAssets?: DepreciationAsset[];  // Form 4562 — business asset registry
  selfEmploymentDeductions?: SelfEmploymentDeductions;
  costOfGoodsSold?: CostOfGoodsSold;    // Schedule C Part III (Lines 35-42)
  returnsAndAllowances?: number;        // Schedule C Line 2 — refunds, returns (non-1099-K portion)

  // Deductions
  deductionMethod: 'standard' | 'itemized';
  itemizedDeductions?: ItemizedDeductions;

  // Alimony
  alimony?: AlimonyInfo;
  alimonyReceived?: AlimonyReceivedInfo;

  // Excess Contributions (Form 5329)
  excessContributions?: ExcessContributionInfo;

  // SECURE 2.0 Emergency Distributions — IRC §72(t)(2)(I)
  emergencyDistributions?: EmergencyDistributionInfo;

  // AMT (Alternative Minimum Tax) data — Form 6251
  amtData?: {
    // ── Common Adjustments (Form 6251 Part I) ──
    /** Line 2i: ISO exercise spread (FMV - exercise price at exercise) */
    isoExerciseSpread?: number;
    /** Line 2g: Tax-exempt interest from private activity bonds */
    privateActivityBondInterest?: number;

    // ── Additional Adjustments (Form 6251 Part I) ──
    /** Line 2b: Tax refund adjustment (state refund add-back for AMT) */
    taxRefundAdjustment?: number;
    /** Line 2c: Investment interest expense difference (AMT vs regular) */
    investmentInterestAdjustment?: number;
    /** Line 2d: Depletion difference */
    depletion?: number;
    /** Line 2f: Alternative tax net operating loss deduction (ATNOLD) */
    atnold?: number;
    /** Line 2h: Qualified small business stock exclusion (Section 1202) */
    qsbsExclusion?: number;
    /** Line 2k: Disposition of property difference (AMT vs regular basis) */
    dispositionOfProperty?: number;
    /** Line 2l: Post-1986 depreciation (ADS vs MACRS difference) */
    depreciationAdjustment?: number;
    /** Line 2m: Passive activity loss difference */
    passiveActivityLoss?: number;
    /** Line 2n: Loss limitation difference */
    lossLimitations?: number;
    /** Line 2o: Circulation costs */
    circulationCosts?: number;
    /** Line 2p: Long-term contracts difference */
    longTermContracts?: number;
    /** Line 2q: Mining costs */
    miningCosts?: number;
    /** Line 2r: Research and experimental costs */
    researchCosts?: number;
    /** Line 2t: Intangible drilling costs */
    intangibleDrillingCosts?: number;
    /** Line 3: Other adjustments (catch-all) */
    otherAMTAdjustments?: number;

    // ── Part II, Line 8 ──
    /** AMT foreign tax credit (user-entered) */
    amtForeignTaxCredit?: number;
  };

  // Form 8582 — Passive Activity Loss Limitations
  form8582Data?: {
    /** Aggregate prior-year unallowed losses from all passive activities (Form 8582, prior year Line 16) */
    priorYearUnallowedLoss?: number;
    /** Real estate professional election — IRC §469(c)(7): bypasses PAL for material participation */
    realEstateProfessional?: boolean;
  };

  // Gambling losses (itemized deduction, limited to winnings)
  gamblingLosses?: number;

  // Nonbusiness bad debts — IRC §166(d) (treated as short-term capital loss)
  nonbusinessBadDebts?: NonbusinessBadDebt[];

  // Farm Rental (Form 4835) — passive farm rental income
  farmRentals?: FarmRentalInfo[];

  // Casualty and theft losses (Form 4684)
  casualtyLosses?: CasualtyLossInfo[];

  // Installment sales (Form 6252)
  installmentSales?: InstallmentSaleInfo[];

  // Credits
  childTaxCredit?: ChildTaxCreditInfo;
  educationCredits: EducationCreditInfo[];
  dependentCare?: DependentCareInfo;
  saversCredit?: SaversCreditInfo;
  cleanEnergy?: CleanEnergyInfo;
  evCredit?: EVCreditInfo;
  energyEfficiency?: EnergyEfficiencyInfo;
  evRefuelingCredit?: EVRefuelingCreditInfo;   // Form 8911 — EV refueling property credit
  scholarshipCredit?: ScholarshipCreditInfo;   // IRC §25F — SGO scholarship credit

  // QBI detail (for W-2 wages/UBIA calculation above threshold)
  qbiInfo?: QBIInfo;

  // Adoption Credit (Form 8839)
  adoptionCredit?: AdoptionCreditInfo;

  // Form 8801 — Prior Year Minimum Tax Credit
  form8801?: Form8801Info;

  // Form 8606 — Nondeductible IRA / Roth Conversion
  form8606?: Form8606Info;

  // Kiddie Tax (Form 8615) — array for multiple qualifying children
  kiddieTaxEntries?: KiddieTaxInfo[];
  /** @deprecated Use kiddieTaxEntries[] instead. Kept for backward compatibility with saved data. */
  kiddieTax?: Omit<KiddieTaxInfo, 'id'>;

  // Foreign Earned Income Exclusion (Form 2555)
  foreignEarnedIncome?: ForeignEarnedIncomeInfo;

  // Schedule H — Household Employee Tax
  householdEmployees?: HouseholdEmployeeInfo;

  // Qualified Opportunity Zone (Form 8997)
  qozInvestment?: QOZInvestmentInfo;

  // Schedule 1-A — Additional Deductions (OBBBA)
  schedule1A?: Schedule1AInfo;

  // Form 982 — Cancellation of Debt exclusion
  form982?: Form982Info;

  // Foreign Tax Credit Categories (Form 1116)
  foreignTaxCreditCategories?: ForeignTaxCreditCategory[];  // IRC §904(d) separate limitation categories

  // Investment Interest Expense (Form 4952)
  investmentInterest?: InvestmentInterestInfo;

  // Sale of Home Exclusion (Section 121)
  homeSale?: HomeSaleInfo;

  // Premium Tax Credit (Form 8962)
  premiumTaxCredit?: PremiumTaxCreditInfo;

  // Form 4137 — Unreported Tip Income (SS/Medicare)
  form4137?: Form4137Info;

  // Schedule F — Farm Income
  scheduleF?: ScheduleFInfo;

  // Schedule R — Credit for the Elderly or the Disabled
  scheduleR?: ScheduleRInfo;

  // Head of Household validation
  paidOverHalfHouseholdCost?: boolean;   // IRC §2(b)(1)(A) — paid > 50% of household maintenance cost

  // Extension filing
  extensionFiled?: boolean;

  // Above-the-line adjustments (Priority 2)
  hsaDeduction?: number;
  hsaContribution?: HSAContributionInfo;   // Full HSA Form 8889 tracking (Feature 26)
  // Archer MSA — Form 8853
  archerMSA?: ArcherMSAInfo;
  hsaExcessWithdrawal?: HSAExcessWithdrawal; // Corrective withdrawal of excess HSA contributions
  iraExcessWithdrawal?: IRAExcessWithdrawal; // Corrective withdrawal of excess IRA contributions
  studentLoanInterest?: number;
  iraContribution?: number;
  coveredByEmployerPlan?: boolean;  // Is taxpayer covered by a workplace retirement plan?
  spouseCoveredByEmployerPlan?: boolean;  // Is spouse covered by a workplace retirement plan? (MFJ spouse-covered phase-out)
  educatorExpenses?: number;        // K-12 educator unreimbursed classroom expenses (up to $300)
  estimatedPaymentsMade?: number;
  estimatedQuarterlyPayments?: [number, number, number, number];  // Per-quarter payments: Q1(Apr 15), Q2(Jun 15), Q3(Sep 15), Q4(Jan 15)
  priorYearTax?: number;                    // Prior year tax liability (for Form 2210 safe harbor)
  annualizedIncome?: AnnualizedIncomeInfo;  // Form 2210 Schedule AI — quarterly cumulative income for annualized method
  nolCarryforward?: number;                 // Prior year NOL available for carryforward
  priorYearSummary?: PriorYearSummary;       // Imported prior-year data for YoY comparison

  // Deduction Finder — persisted dismissed/addressed state (insights regenerated on upload)
  deductionFinder?: {
    dismissedInsightIds: string[];
    addressedInsightIds: string[];
  };

  // Direct deposit for refund (Lines 35b-d)
  directDeposit?: DirectDeposit;

  // Apply refund to next year's estimated tax (Line 36)
  refundAppliedToNextYear?: number;

  // IRS Digital Asset Question (mandatory for 2025+)
  digitalAssetActivity?: boolean;

  // Schedule B Part III — Foreign Accounts and Trusts
  scheduleBPartIII?: {
    hasForeignAccounts?: boolean;       // Line 7a
    requireFBAR?: boolean;              // Line 7a follow-up: required to file FinCEN Form 114?
    foreignAccountCountries?: string;   // Line 7b (comma-separated country names)
    hasForeignTrust?: boolean;          // Line 8
  };

  // State tax filing
  stateReturns?: StateReturnConfig[];   // States the user is filing in

  // Income discovery answers
  incomeDiscovery: Record<string, 'yes' | 'no' | 'later'>;

  // Proactive nudge dismissals
  dismissedNudges?: string[];

  // Smart Expense Scanner
  expenseScanner?: {
    /** Categories the user opted in for AI scanning. */
    enabledCategories: string[];
    /** Quick-select context hints for sparse-return users. */
    contextHints?: {
      isSelfEmployed?: boolean;
      isHomeowner?: boolean;
      hasKids?: boolean;
      isStudent?: boolean;
      hasRentalProperty?: boolean;
    };
    /** Dismissed insight IDs (carried from deductionFinder). */
    dismissedInsightIds?: string[];
    /** Addressed insight IDs. */
    addressedInsightIds?: string[];
  };

  createdAt: string;
  updatedAt: string;
}

// ─── State Tax Types ─────────────────────────────────────────
export type StateResidencyType = 'resident' | 'part_year' | 'nonresident';

export interface StateReturnConfig {
  stateCode: string;                    // 2-letter abbreviation
  residencyType: StateResidencyType;
  daysLivedInState?: number;            // For part-year filers
  stateSpecificData?: Record<string, unknown>;  // State-specific fields
}

export interface StateCalculationResult {
  stateCode: string;
  stateName: string;
  residencyType: StateResidencyType;

  // Income
  federalAGI: number;                   // Starting point — federal AGI
  stateAdditions: number;               // Additions to federal AGI
  stateSubtractions: number;            // Subtractions from federal AGI
  stateAGI: number;                     // State-adjusted gross income
  stateDeduction: number;               // Standard or itemized deduction
  stateTaxableIncome: number;           // After deductions and exemptions
  stateExemptions: number;              // Personal/dependent exemptions

  // Tax computation
  stateIncomeTax: number;               // Computed income tax
  stateCredits: number;                 // Total state credits
  stateTaxAfterCredits: number;         // Tax minus credits
  localTax: number;                     // City/county tax (e.g., NYC, Yonkers)
  totalStateTax: number;                // Income + local tax

  // Payments
  stateWithholding: number;             // From W-2 Box 17 + estimated payments
  stateEstimatedPayments: number;       // Quarterly payments made to state
  stateRefundOrOwed: number;            // Positive = refund, negative = owed

  // Allocation (part-year / nonresident)
  allocationRatio?: number;            // Part-year: days/year; nonresident: source/total; resident: 1.0
  allocatedAGI?: number;               // State-taxable portion of federal AGI

  // Effective rate
  effectiveStateRate: number;           // totalStateTax / federalAGI

  // Bracket detail
  bracketDetails?: StateBracketDetail[];
  additionalLines?: Record<string, number>;  // State-specific line items

  /** Calculation traces explaining how each state tax value was computed. */
  traces?: CalculationTrace[];
}

export interface StateBracketDetail {
  rate: number;
  taxableAtRate: number;
  taxAtRate: number;
}

export interface StateConstants {
  stateCode: string;
  stateName: string;
  hasIncomeTax: boolean;
  brackets: Record<string, StateTaxBracket[]>;  // Keyed by filing status
  standardDeduction: Record<string, number>;     // Keyed by filing status
  personalExemption: number;
  dependentExemption: number;
}

export interface StateTaxBracket {
  min: number;
  max: number;
  rate: number;
}

// Calculation results
export interface ScheduleCResult {
  // Schedule C Lines 1-7 — Gross Income Pipeline
  grossReceipts: number;              // Line 1: Total gross receipts (sum of all 1099-NEC + 1099-K)
  returnsAndAllowances: number;       // Line 2: Returns, allowances, adjustments
  netReceipts: number;                // Line 3: Line 1 - Line 2
  costOfGoodsSold: number;            // Line 4: Cost of goods sold (Part III)
  grossProfit: number;                // Line 5: Line 3 - Line 4
  otherBusinessIncome: number;        // Line 6: Other business income
  grossIncome: number;                // Line 7: Gross income (Line 5 + Line 6) — backward compat

  totalExpenses: number;
  tentativeProfit: number;
  homeOfficeDeduction: number;
  vehicleDeduction: number;
  depreciationDeduction?: number;          // Line 13 auto-computed from Form 4562 asset registry
  netProfit: number;
  lineItems: Record<string, number>;  // Expenses by line (string keys: "8"-"27", "24a", "24b")
  businessResults?: ScheduleCBusinessResult[]; // Per-business breakdown (multi-business)
  homeOfficeResult?: HomeOfficeResult;         // Detailed Form 8829 breakdown (for UI display)
  vehicleResult?: VehicleResult;               // Detailed vehicle deduction breakdown (for UI display)
  form4562Result?: Form4562Result;             // Detailed Form 4562 depreciation breakdown (for UI display)

  // Line 9 suppression metadata — when a vehicle deduction is active,
  // Line 9 (car/truck) expenses are excluded to prevent double-counting.
  line9Suppressed?: boolean;                     // true when Line 9 expenses were excluded
  suppressedLine9Amount?: number;                // total dollar amount of excluded Line 9 expenses

  // Line 13 suppression metadata — when a Form 4562 asset registry is active,
  // Line 13 (depreciation) expenses are excluded to prevent double-counting.
  line13Suppressed?: boolean;                    // true when Line 13 expenses were excluded
  suppressedLine13Amount?: number;               // total dollar amount of excluded Line 13 expenses

  // Line 19 suppression metadata — when the filer has no employees (no Line 26 wages),
  // Line 19 (pension/profit-sharing) is excluded because the owner's own retirement
  // contributions belong on Schedule 1 Line 16, not Schedule C Line 19 (Pub 560).
  line19Suppressed?: boolean;                    // true when Line 19 expenses were excluded
  suppressedLine19Amount?: number;               // total dollar amount of excluded Line 19 expenses
}

export interface ScheduleCBusinessResult {
  businessId: string;
  businessName?: string;
  grossIncome: number;
  totalExpenses: number;
  netProfit: number;
}

export interface ScheduleSEResult {
  netEarnings: number;
  socialSecurityTax: number;
  medicareTax: number;
  additionalMedicareTax: number;
  totalSETax: number;
  deductibleHalf: number;
}

export interface ScheduleAResult {
  medicalDeduction: number;
  saltDeduction: number;
  interestDeduction: number;
  charitableDeduction: number;
  otherDeduction: number;
  totalItemized: number;
  form8283?: Form8283Result;           // Per-item non-cash charitable detail (when nonCashDonations provided)
}

export interface ScheduleDResult {
  shortTermGain: number;
  shortTermLoss: number;
  netShortTerm: number;
  longTermGain: number;
  longTermLoss: number;
  netLongTerm: number;
  netGainOrLoss: number;
  capitalLossDeduction: number;     // Up to $3k ($1.5k MFS) deductible against ordinary income
  capitalLossCarryforward: number;  // Total excess loss carried to future years
  capitalLossCarryforwardST: number; // Short-term portion of carryforward
  capitalLossCarryforwardLT: number; // Long-term portion of carryforward
}

export interface SocialSecurityResult {
  totalBenefits: number;
  taxableBenefits: number;
  taxablePercentage: number;      // 0%, 50%, or 85%
  provisionalIncome: number;
}

export interface PropertyResult {
  id: string;
  address: string;
  rentalIncome: number;
  totalExpenses: number;
  netIncome: number;              // rentalIncome - totalExpenses (can be negative)
  isPersonalUse: boolean;         // Expenses prorated, loss disallowed
  isExcluded: boolean;            // <15 days rented — not reported
}

export interface RoyaltyPropertyResult {
  id: string;
  description: string;
  royaltyIncome: number;
  totalExpenses: number;
  netIncome: number;
}

export interface ScheduleEResult {
  totalRentalIncome: number;
  totalRentalExpenses: number;
  netRentalIncome: number;        // Can be negative (loss) — raw, before PAL limitation
  allowableLoss: number;          // After passive loss limitation (set by Form 8582)
  suspendedLoss: number;          // Loss not currently deductible (set by Form 8582)
  royaltyIncome: number;          // Schedule E Line 4 — total royalties
  totalRoyaltyExpenses: number;   // Total expenses from royalty properties
  scheduleEIncome: number;        // Amount that flows to Form 1040 (rents + royalties)
  propertyResults?: PropertyResult[];  // Per-property detail for Form 8582
  royaltyPropertyResults?: RoyaltyPropertyResult[];
}

// Form 8582 — Passive Activity Loss Limitations
// Authority: IRC §469; Form 8582; Publication 925

export interface PassiveActivityDetail {
  id: string;                         // Matches RentalProperty.id or IncomeK1.id
  name: string;                       // Property address or K-1 entity name
  type: 'rental' | 'k1_passive';
  currentYearNetIncome: number;       // Can be negative (loss)
  priorYearUnallowed: number;         // Allocated share of prior-year unallowed loss
  overallGainOrLoss: number;          // currentYear + priorYear
  allowedLoss: number;                // Loss allowed this year after Form 8582 limitation
  suspendedLoss: number;              // Loss carried forward to next year
  disposedDuringYear: boolean;
  activeParticipation: boolean;       // Only meaningful for rentals
}

export interface Form8582Result {
  // Part I — Rental Activities With Active Participation
  netRentalActiveIncome: number;      // Line 1a (income) or 1b (loss)
  // Part I — All Other Passive Activities
  netOtherPassiveIncome: number;      // Line 2a (income) or 2b (loss)
  // Part I — Totals
  totalPassiveIncome: number;         // Line 3a — sum of all positive passive amounts
  totalPassiveLoss: number;           // Line 3b — sum of all negative passive amounts (≤ 0)
  combinedNetIncome: number;          // Line 4 — net of all passive (if ≥ 0, no limitation)

  // Part II — Special Allowance (rental RE with active participation only)
  specialAllowance: number;           // Line 10 — $25k (or $12.5k MFS) after AGI phase-out
  allowedPassiveLoss: number;         // Line 12 — total passive loss actually deductible this year

  // Disposition handling — IRC §469(g)(1)
  dispositionReleasedLosses: number;  // Total suspended losses released by full dispositions

  // Per-activity detail (Worksheets 1-2 equivalent)
  activities: PassiveActivityDetail[];

  // Carryforward
  totalSuspendedLoss: number;         // Carries to next year's Form 8582
  totalAllowedLoss: number;           // Negative or zero — flows back to Schedule E income

  warnings: string[];
}

export interface DependentCareResult {
  qualifyingExpenses: number;       // Capped at $3k/$6k
  creditRate: number;               // 20-35%
  credit: number;                   // Final credit amount
  employerBenefitsExclusion?: number;   // Part III: excludable employer benefits (up to $5k)
  employerBenefitsTaxable?: number;     // Part III: excess employer benefits → taxable income
  deemedEarnedIncome?: number;          // Student/disabled spouse deemed earned income
}

export interface SaversCreditResult {
  eligibleContributions: number;    // Capped at $2k/$4k
  creditRate: number;               // 0%, 10%, 20%, or 50%
  credit: number;                   // Final credit amount
}

// Scholarship Granting Organization Credit (IRC §25F)
// OBBBA §70202 — Nonrefundable credit for contributions to qualified SGOs
export interface ScholarshipCreditInfo {
  contributionAmount: number;           // Total contributions to qualified SGOs
  stateTaxCreditReceived?: number;      // State tax credit received for same contribution (reduces §25F dollar-for-dollar)
}

export interface ScholarshipCreditResult {
  eligibleContribution: number;         // Contribution after state credit offset
  credit: number;                       // Final nonrefundable credit (capped at $1,700)
}

export interface CleanEnergyResult {
  totalExpenditures: number;        // Total qualifying expenditures
  currentYearCredit: number;        // 30% of current year expenditures
  priorYearCarryforward: number;    // Carryforward from prior year
  totalAvailableCredit: number;     // currentYearCredit + priorYearCarryforward
  credit: number;                   // Credit allowed (limited by tax liability when applied in orchestrator)
  carryforwardToNextYear: number;   // Unused credit to carry forward (totalAvailable - credit used)
}

export interface EVCreditResult {
  baseCredit: number;               // Base $7,500 (new) or $4,000 (used)
  credit: number;                   // Final credit after limitations
}

export interface EnergyEfficiencyResult {
  totalExpenditures: number;        // Total qualifying expenditures
  credit: number;                   // Credit after per-item and aggregate caps
}

export interface ForeignTaxCreditResult {
  foreignTaxPaid: number;           // Total foreign tax paid
  creditAllowed: number;            // Credit allowed (limited to US tax on foreign income)
  categoryResults?: ForeignTaxCreditCategoryResult[];  // Per-category results (if categories provided)
}

// Form 1116 FTC per-category detail
// IRC §904(d) — Separate limitation categories
export interface ForeignTaxCreditCategory {
  category: 'general' | 'passive';    // IRC §904(d)(1) categories
  foreignTaxPaid: number;             // Foreign tax paid in this category
  foreignSourceIncome: number;        // Foreign-source income in this category
}

export interface ForeignTaxCreditCategoryResult {
  category: 'general' | 'passive';
  foreignTaxPaid: number;
  foreignSourceIncome: number;
  limitation: number;                  // US tax × (category foreign income / worldwide income)
  creditAllowed: number;               // min(foreignTaxPaid, limitation)
}

// Form 8801 — Credit for Prior Year Minimum Tax
export interface Form8801Info {
  /** Net minimum tax from prior year attributable to deferral items (Form 8801 Line 18 equivalent) */
  netPriorYearMinimumTax: number;
  /** Credit carryforward from prior year Form 8801 (Line 19) */
  priorYearCreditCarryforward: number;
}

export interface Form8801Result {
  /** Total credit available before limitation */
  totalCreditAvailable: number;
  /** Credit limitation: max(0, regularTax - currentYearAMT) */
  creditLimitation: number;
  /** Credit claimed this year (to Schedule 3 Line 6b) */
  credit: number;
  /** Remaining credit to carry forward to next year */
  carryforwardToNextYear: number;
}

// Archer MSA — Form 8853
export interface ArcherMSAInfo {
  /** Self-only or family HDHP coverage */
  coverageType: 'self_only' | 'family';
  /** HDHP annual deductible amount */
  hdhpDeductible: number;
  /** Personal contributions made during the year */
  personalContributions: number;
  /** Number of months covered by HDHP (1-12, for proration) */
  coverageMonths: number;
  /** Whether enrolled in Medicare (blocks all contributions) */
  isEnrolledInMedicare?: boolean;
}

export interface ArcherMSAResult {
  /** Contribution limit based on HDHP deductible */
  contributionLimit: number;
  /** Prorated limit for partial-year coverage */
  proratedLimit: number;
  /** Employer contributions from W-2 Box 12 Code R */
  employerContributions: number;
  /** Allowable deduction (personal contributions up to limit minus employer contributions) */
  deduction: number;
  /** Excess contributions subject to 6% excise tax */
  excessContributions: number;
}

export interface CreditsResult {
  childTaxCredit: number;
  otherDependentCredit: number;
  actcCredit: number;              // Additional Child Tax Credit (refundable portion)
  educationCredit: number;         // Non-refundable education credit portion
  aotcRefundableCredit: number;    // AOTC 40% refundable portion
  dependentCareCredit: number;     // Child and Dependent Care Credit (non-refundable)
  saversCredit: number;            // Saver's Credit (non-refundable)
  cleanEnergyCredit: number;       // Residential Clean Energy Credit (non-refundable)
  evCredit: number;                // Clean Vehicle Credit (non-refundable)
  energyEfficiencyCredit: number;  // Energy Efficient Home Improvement Credit (non-refundable)
  foreignTaxCredit: number;        // Foreign Tax Credit (non-refundable)
  adoptionCredit: number;          // Adoption Credit (Form 8839, non-refundable)
  evRefuelingCredit: number;       // EV Refueling Property Credit (Form 8911, non-refundable)
  elderlyDisabledCredit: number;   // Credit for the Elderly or Disabled (Schedule R, non-refundable)
  scholarshipCredit: number;       // SGO Scholarship Credit (IRC §25F, non-refundable)
  priorYearMinTaxCredit: number;   // Prior Year Minimum Tax Credit (Form 8801, non-refundable)
  k1OtherCredits: number;          // K-1 Box 15 other credits (non-refundable)
  premiumTaxCredit: number;        // Premium Tax Credit (Form 8962, refundable)
  excessSSTaxCredit: number;       // Excess SS Tax Credit (refundable)
  eitcCredit: number;
  educationCreditDetails?: EducationCreditStudentDetail[];
  totalNonRefundable: number;
  totalRefundable: number;
  totalCredits: number;
}

export interface Form1040Result {
  // Income
  totalWages: number;
  totalInterest: number;
  taxExemptInterest: number;       // Line 2a — informational (muni bond interest)
  totalDividends: number;
  qualifiedDividends: number;      // Line 3a — informational (qualified dividends)
  totalCapitalGainDistributions: number;
  scheduleDNetGain: number;        // Net capital gain (ST ordinary + LT preferential)
  capitalLossDeduction: number;    // $3k max deductible loss
  capitalGainOrLoss: number;       // Line 7 — net capital gain/loss for Form 1040
  taxableSocialSecurity: number;   // Taxable portion of SS benefits
  socialSecurityBenefits: number;  // Line 6a — total SS benefits (gross)
  scheduleEIncome: number;         // Net rental/royalty income (after passive loss rules)
  royaltyIncome: number;           // Schedule E Line 4 — total royalties (1099-MISC + K-1)
  totalRetirementIncome: number;
  iraDistributionsGross: number;   // Line 4a — IRA distributions (gross)
  iraDistributionsTaxable: number; // Line 4b — IRA distributions (taxable)
  totalQCD: number;                // Total Qualified Charitable Distributions (excluded from Line 4b)
  pensionDistributionsGross: number;  // Line 5a — Pensions/annuities (gross)
  pensionDistributionsTaxable: number; // Line 5b — Pensions/annuities (taxable)
  totalUnemployment: number;
  total1099MISCIncome: number;
  scheduleCNetProfit: number;
  rothConversionTaxable: number;         // Taxable portion of Roth conversion (Form 8606)
  additionalIncome: number;              // Line 8 — Additional income from Schedule 1 (excl. capital gains)
  totalIncome: number;

  // Adjustments
  seDeduction: number;
  selfEmployedHealthInsurance: number;
  retirementContributions: number;
  hsaDeduction: number;
  hsaDeductionComputed: number;          // HSA deduction computed from Form 8889
  archerMSADeduction: number;       // Form 8853 — Archer MSA deduction (Schedule 1 Line 8)
  studentLoanInterest: number;
  iraDeduction: number;
  educatorExpenses: number;
  earlyWithdrawalPenalty: number;
  movingExpenses: number;                // Form 3903 — military moving expenses (Schedule 1 Line 14)
  feieExclusion: number;                 // Foreign Earned Income Exclusion (Form 2555)
  nolDeduction: number;                  // Net Operating Loss deduction
  totalAdjustments: number;

  // AGI and deductions
  agi: number;
  standardDeduction: number;
  itemizedDeduction: number;
  deductionUsed: 'standard' | 'itemized';
  deductionAmount: number;
  qbiDeduction: number;
  schedule1ADeduction: number;             // Schedule 1-A total (tips + overtime + car loan + senior)
  homeSaleExclusion: number;               // Section 121 home sale exclusion
  taxableIncome: number;

  // K-1 income
  k1OrdinaryIncome: number;        // K-1 ordinary business income added to total
  k1SEIncome: number;              // K-1 SE income (partnerships only)

  // HSA distributions
  hsaDistributionTaxable: number;   // Taxable HSA distributions
  hsaDistributionPenalty: number;   // 20% penalty on non-qualified HSA distributions

  // Tax
  incomeTax: number;
  preferentialTax: number;         // Tax on qualified dividends + LTCG at 0%/15%/20%
  section1250Tax: number;          // Tax on unrecaptured §1250 gain at 25% (or lower ordinary rate)
  amtAmount: number;               // Alternative Minimum Tax (Form 6251)
  seTax: number;
  niitTax: number;                 // Net Investment Income Tax (3.8%)
  additionalMedicareTaxW2: number; // Additional Medicare Tax on W-2 wages (0.9%)
  earlyDistributionPenalty: number;// 10% penalty on early 1099-R distributions
  kiddieTaxAmount: number;               // Kiddie Tax additional amount (Form 8615)
  householdEmploymentTax: number;        // Schedule H household employee tax
  estimatedTaxPenalty: number;           // Estimated tax underpayment penalty (Form 2210)
  totalTax: number;

  // Credits
  totalCredits: number;
  taxAfterCredits: number;

  // Withholding & payments
  w2Withholding: number;                 // Line 25a — Federal tax withheld from W-2s
  form1099Withholding: number;           // Line 25b — Federal tax withheld from 1099s and other forms
  form8959WithholdingCredit: number;     // Line 25d — Form 8959 excess Medicare tax withheld (Additional Medicare Tax)
  totalWithholding: number;
  estimatedPayments: number;

  // Final
  totalPayments: number;
  amountOwed: number;
  refundAmount: number;
  refundAppliedToNextYear: number;   // Line 36 — portion of refund applied to next year's estimated tax
  netRefund: number;                 // Line 35a — refund after applying to next year

  // Gambling income
  totalGamblingIncome: number;      // Total W-2G gross winnings

  // Cancellation of debt
  cancellationOfDebtIncome: number; // Taxable cancelled debt (after Form 982 exclusion)

  // Investment interest
  investmentInterestDeduction: number; // Deductible investment interest expense (Form 4952)

  // Alimony
  alimonyDeduction: number;         // Above-the-line deduction for pre-2019 alimony
  alimonyReceivedIncome: number;    // Pre-2019 alimony included in income

  // Excess contribution penalties (Form 5329)
  excessContributionPenalty: number; // 6% excise on excess IRA/HSA contributions

  // 1099-Q (529 distributions)
  taxable529Income: number;          // Taxable earnings from non-qualified 529 distributions
  penalty529: number;                // 10% penalty on taxable non-qualified 529 earnings

  // K-1 Section 179
  k1Section179Deduction: number;     // Section 179 deduction from K-1 Box 12

  // Premium Tax Credit (Form 8962)
  premiumTaxCreditNet: number;           // Net PTC (additional credit if positive)
  excessAPTCRepayment: number;           // Excess APTC repayment (additional tax if positive)

  // Form 4797
  form4797OrdinaryIncome: number;   // §1245 + §1250 ordinary recapture income
  form4797Section1231GainOrLoss: number; // Net §1231 gain (→LTCG) or loss (→ordinary)

  // Form 4137
  form4137Tax: number;              // Social Security + Medicare tax on unreported tips

  // Schedule F
  scheduleFNetProfit: number;       // Net farm profit/loss (Schedule F Line 36)

  // Informational
  foreignTaxPaid: number;           // Total foreign tax paid (1099-DIV Box 7)
  extensionFiled: boolean;               // Whether extension (Form 4868) was filed

  // Solo 401(k) / SEP-IRA calculation details (informational)
  solo401kCalculation?: Solo401kResult;
  sepIRACalculation?: SEPIRAResult;

  // Summary
  effectiveTaxRate: number;
  marginalTaxRate: number;
  estimatedQuarterlyPayment: number;
}

export interface CalculationResult {
  scheduleC?: ScheduleCResult;
  scheduleSE?: ScheduleSEResult;
  scheduleA?: ScheduleAResult;
  scheduleD?: ScheduleDResult;
  socialSecurity?: SocialSecurityResult;
  scheduleE?: ScheduleEResult;
  dependentCare?: DependentCareResult;
  saversCreditResult?: SaversCreditResult;
  cleanEnergy?: CleanEnergyResult;
  evCredit?: EVCreditResult;
  energyEfficiency?: EnergyEfficiencyResult;
  foreignTaxCredit?: ForeignTaxCreditResult;
  k1Routing?: import('../engine/k1.js').K1RoutingResult;
  hsaDistributions?: { totalTaxable: number; totalPenalty: number };
  form8606?: { taxableConversion: number; nonTaxableDistributions: number; taxableDistributions: number; regularDistributions: number; remainingBasis: number };
  estimatedTaxPenalty?: EstimatedTaxPenaltyResult;
  kiddieTax?: { additionalTax: number; childTaxableUnearned: number };
  kiddieTaxEntries?: { childName?: string; additionalTax: number; childTaxableUnearned: number }[];
  feie?: { incomeExclusion: number; housingExclusion: number };
  scheduleH?: ScheduleHResult;
  adoptionCredit?: AdoptionCreditResult;
  evRefuelingCredit?: EVRefuelingCreditResult;
  scholarshipCredit?: ScholarshipCreditResult;
  form4562?: Form4562Result;
  form4797?: Form4797Result;
  form4137?: Form4137Result;
  scheduleF?: ScheduleFResult;
  scheduleR?: ScheduleRResult;
  form8801?: Form8801Result;
  archerMSA?: ArcherMSAResult;
  hohValidation?: HoHValidationResult;
  deceasedSpouseValidation?: DeceasedSpouseValidationResult;
  premiumTaxCredit?: PremiumTaxCreditResult;
  schedule1A?: Schedule1AResult;
  homeSale?: HomeSaleResult;
  form982?: Form982Result;
  investmentInterest?: InvestmentInterestResult;
  form8283?: Form8283Result;
  form5329?: Form5329Result;
  solo401k?: Solo401kResult;
  sepIRA?: SEPIRAResult;
  form7206?: Form7206Result;
  amt?: import('../engine/amt.js').AMTResult;
  form8582?: Form8582Result;
  stateResults?: StateCalculationResult[];
  credits: CreditsResult;
  form1040: Form1040Result;
  /** Optional calculation trace tree — only present when tracing is enabled. */
  traces?: CalculationTrace[];
}

// ─── Calculation Trace Types ─────────────────────────────
// Inspired by IRS Direct File Fact Graph's Expression.explain() capability.
// Provides a structured audit trail of how each line item was computed.

export interface TraceInput {
  /** Path identifying the input (e.g., "form1040.line1a" or "w2[0].wages"). */
  lineId: string;
  /** Human-readable label (e.g., "W-2 from Acme Corp"). */
  label: string;
  /** The numeric value of this input. */
  value: number;
}

export interface CalculationTrace {
  /** Form line identifier (e.g., "form1040.line16"). */
  lineId: string;
  /** Human-readable label (e.g., "Income Tax"). */
  label: string;
  /** The computed value. */
  value: number;
  /** The formula or method used (e.g., "progressiveTax(taxableIncome, brackets)"). */
  formula?: string;
  /** Legal authority (e.g., "IRC §1" or "Form 1040, Line 16"). */
  authority?: string;
  /** Direct inputs to this computation. */
  inputs: TraceInput[];
  /** Nested sub-calculations (e.g., per-bracket breakdowns). */
  children?: CalculationTrace[];
  /** Optional human-readable note or explanation. */
  note?: string;
}

export interface TraceOptions {
  /** When false, trace generation is skipped for performance. */
  enabled: boolean;
}

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface BracketDetail {
  rate: number;
  taxableAtRate: number;
  taxAtRate: number;
}
