/**
 * Income generators — W-2, all 1099 variants, SSA-1099, K-1, W-2G, rental properties.
 */

import type { Rng } from './random';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL',
  'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT',
  'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
] as const;

// ─── W-2 ─────────────────────────────────────────

export function generateW2(rng: Rng, opts?: {
  wagesMin?: number; wagesMax?: number; state?: string;
}): Record<string, unknown> {
  const wages = rng.wholeDollars(opts?.wagesMin ?? 25000, opts?.wagesMax ?? 120000);
  const ssWages = Math.min(wages, 176100); // 2025 SS wage base
  const fedWithheld = Math.round(wages * rng.float(0.10, 0.28));
  const stateCode = opts?.state ?? rng.pick(US_STATES);

  const w2: Record<string, unknown> = {
    id: rng.uuid(),
    employerName: rng.employerName(),
    employerEin: rng.ein(),
    wages,
    federalTaxWithheld: fedWithheld,
    socialSecurityWages: ssWages,
    socialSecurityTax: Math.round(ssWages * 0.062),
    medicareWages: wages,
    medicareTax: Math.round(wages * 0.0145),
    state: stateCode,
    stateWages: wages,
    stateTaxWithheld: Math.round(wages * rng.float(0.02, 0.08)),
  };

  // Optionally add Box 12 entries
  if (rng.chance(0.4)) {
    const box12: Record<string, unknown>[] = [];
    if (rng.chance(0.6)) {
      box12.push({ code: 'D', amount: rng.wholeDollars(3000, 23500) }); // 401k
    }
    if (rng.chance(0.3)) {
      box12.push({ code: 'DD', amount: rng.wholeDollars(5000, 20000) }); // health
    }
    if (box12.length > 0) w2.box12 = box12;
  }

  // Optionally add Box 13
  if (rng.chance(0.3)) {
    w2.box13 = { retirementPlan: true };
  }

  return w2;
}

export function generateMultipleW2s(rng: Rng, count: number, opts?: {
  wagesMin?: number; wagesMax?: number; state?: string;
}): Record<string, unknown>[] {
  return Array.from({ length: count }, () => generateW2(rng, opts));
}

// ─── 1099-NEC ────────────────────────────────────

export function generate1099NEC(rng: Rng, opts?: {
  min?: number; max?: number; businessId?: string;
}): Record<string, unknown> {
  return {
    id: rng.uuid(),
    payerName: rng.employerName(),
    payerTin: rng.ein(),
    amount: rng.wholeDollars(opts?.min ?? 2000, opts?.max ?? 80000),
    federalTaxWithheld: 0,
    businessId: opts?.businessId,
  };
}

// ─── 1099-K ──────────────────────────────────────

export function generate1099K(rng: Rng, opts?: {
  min?: number; max?: number; businessId?: string;
}): Record<string, unknown> {
  return {
    id: rng.uuid(),
    payerName: rng.pick(['PayPal', 'Stripe', 'Square', 'Venmo', 'Etsy Payments', 'Amazon Pay']),
    grossAmount: rng.wholeDollars(opts?.min ?? 5000, opts?.max ?? 60000),
    federalTaxWithheld: 0,
    numberOfTransactions: rng.int(50, 500),
    businessId: opts?.businessId,
    returnsAndAllowances: rng.chance(0.3) ? rng.wholeDollars(100, 2000) : 0,
  };
}

// ─── 1099-INT ────────────────────────────────────

export function generate1099INT(rng: Rng, opts?: {
  min?: number; max?: number;
}): Record<string, unknown> {
  const interest = rng.wholeDollars(opts?.min ?? 50, opts?.max ?? 5000);
  return {
    id: rng.uuid(),
    payerName: rng.pick(['Chase Bank', 'Bank of America', 'Wells Fargo', 'Ally Bank', 'Marcus by Goldman Sachs', 'Capital One']),
    amount: interest,
    earlyWithdrawalPenalty: rng.chance(0.1) ? rng.wholeDollars(10, 100) : 0,
    usSavingsBondInterest: 0,
    taxExemptInterest: rng.chance(0.15) ? rng.wholeDollars(100, 2000) : 0,
    federalTaxWithheld: rng.chance(0.1) ? Math.round(interest * 0.24) : 0,
  };
}

// ─── 1099-DIV ────────────────────────────────────

export function generate1099DIV(rng: Rng, opts?: {
  min?: number; max?: number;
}): Record<string, unknown> {
  const ordinary = rng.wholeDollars(opts?.min ?? 100, opts?.max ?? 15000);
  const qualifiedPct = rng.float(0.3, 0.9);
  return {
    id: rng.uuid(),
    payerName: rng.brokerName(),
    ordinaryDividends: ordinary,
    qualifiedDividends: Math.round(ordinary * qualifiedPct),
    capitalGainDistributions: rng.chance(0.3) ? rng.wholeDollars(100, 3000) : 0,
    foreignTaxPaid: rng.chance(0.2) ? rng.wholeDollars(10, 500) : 0,
    federalTaxWithheld: 0,
  };
}

// ─── 1099-R ──────────────────────────────────────

export function generate1099R(rng: Rng, opts?: {
  min?: number; max?: number;
}): Record<string, unknown> {
  const gross = rng.wholeDollars(opts?.min ?? 5000, opts?.max ?? 80000);
  const taxable = rng.chance(0.3) ? Math.round(gross * rng.float(0.5, 1.0)) : gross;
  return {
    id: rng.uuid(),
    payerName: rng.pick(['Fidelity Investments', 'Vanguard', 'TIAA', 'T. Rowe Price', 'Schwab']),
    grossDistribution: gross,
    taxableAmount: taxable,
    federalTaxWithheld: Math.round(taxable * rng.float(0.10, 0.22)),
    distributionCode: rng.pick(['1', '7', '7', '7', 'G', 'T']),
    isIRA: rng.chance(0.5),
  };
}

// ─── 1099-G ──────────────────────────────────────

export function generate1099G(rng: Rng): Record<string, unknown> {
  const comp = rng.wholeDollars(3000, 25000);
  return {
    id: rng.uuid(),
    payerName: rng.pick(['State Unemployment Agency', 'Department of Labor']),
    unemploymentCompensation: comp,
    federalTaxWithheld: rng.chance(0.5) ? Math.round(comp * 0.10) : 0,
  };
}

// ─── 1099-MISC ───────────────────────────────────

export function generate1099MISC(rng: Rng): Record<string, unknown> {
  return {
    id: rng.uuid(),
    payerName: rng.employerName(),
    rents: rng.chance(0.3) ? rng.wholeDollars(1000, 20000) : 0,
    royalties: rng.chance(0.3) ? rng.wholeDollars(500, 10000) : 0,
    otherIncome: rng.chance(0.4) ? rng.wholeDollars(200, 5000) : 0,
    federalTaxWithheld: 0,
  };
}

// ─── 1099-B ──────────────────────────────────────

export function generate1099B(rng: Rng, opts?: {
  min?: number; max?: number;
}): Record<string, unknown> {
  const proceeds = rng.wholeDollars(opts?.min ?? 500, opts?.max ?? 50000);
  const isLongTerm = rng.chance(0.5);
  const gainLossRatio = rng.float(0.5, 1.5);
  const costBasis = Math.round(proceeds / gainLossRatio);
  const hasWashSale = rng.chance(0.1);

  return {
    id: rng.uuid(),
    brokerName: rng.brokerName(),
    description: rng.stockDescription(),
    dateAcquired: rng.dateInYear(isLongTerm ? 2023 : 2025),
    dateSold: rng.dateInYear(2025),
    proceeds,
    costBasis,
    isLongTerm,
    washSaleLossDisallowed: hasWashSale && costBasis > proceeds ? rng.wholeDollars(50, costBasis - proceeds) : 0,
    isCollectible: false,
  };
}

export function generateMultiple1099B(rng: Rng, count: number, opts?: {
  min?: number; max?: number;
}): Record<string, unknown>[] {
  return Array.from({ length: count }, () => generate1099B(rng, opts));
}

// ─── 1099-DA (Crypto) ────────────────────────────

export function generate1099DA(rng: Rng, opts?: {
  min?: number; max?: number;
}): Record<string, unknown> {
  const proceeds = rng.wholeDollars(opts?.min ?? 100, opts?.max ?? 30000);
  const isLongTerm = rng.chance(0.3);
  const costBasis = Math.round(proceeds * rng.float(0.3, 2.0));

  return {
    id: rng.uuid(),
    brokerName: rng.pick(['Coinbase', 'Kraken', 'Gemini', 'Binance.US', 'Crypto.com']),
    description: rng.cryptoDescription(),
    dateAcquired: rng.dateInYear(isLongTerm ? 2023 : 2025),
    dateSold: rng.dateInYear(2025),
    proceeds,
    costBasis,
    isLongTerm,
  };
}

// ─── SSA-1099 ────────────────────────────────────

export function generateSSA1099(rng: Rng, opts?: {
  min?: number; max?: number;
}): Record<string, unknown> {
  const benefits = rng.wholeDollars(opts?.min ?? 12000, opts?.max ?? 42000);
  return {
    id: rng.uuid(),
    totalBenefits: benefits,
    federalTaxWithheld: rng.chance(0.6) ? Math.round(benefits * rng.float(0.07, 0.22)) : 0,
  };
}

// ─── K-1 ─────────────────────────────────────────

export function generateK1(rng: Rng, opts?: {
  type?: 'partnership' | 'scorp' | 'trust';
}): Record<string, unknown> {
  const entityType = opts?.type ?? rng.pick(['partnership', 'scorp', 'trust'] as const);
  return {
    id: rng.uuid(),
    entityName: rng.employerName(),
    entityEin: rng.ein(),
    entityType,
    ordinaryBusinessIncome: rng.chance(0.7) ? rng.wholeDollars(1000, 50000) : 0,
    rentalIncome: rng.chance(0.2) ? rng.wholeDollars(-5000, 10000) : 0,
    guaranteedPayments: entityType === 'partnership' ? rng.wholeDollars(0, 30000) : 0,
    interestIncome: rng.chance(0.3) ? rng.wholeDollars(100, 3000) : 0,
    dividends: rng.chance(0.2) ? rng.wholeDollars(100, 5000) : 0,
    shortTermCapitalGain: rng.chance(0.2) ? rng.wholeDollars(-2000, 5000) : 0,
    longTermCapitalGain: rng.chance(0.3) ? rng.wholeDollars(-3000, 10000) : 0,
    section179Deduction: rng.chance(0.1) ? rng.wholeDollars(500, 5000) : 0,
    selfEmploymentIncome: entityType === 'partnership' ? rng.wholeDollars(0, 40000) : 0,
    isPassiveActivity: rng.chance(0.3),
    qbiIncome: rng.chance(0.4) ? rng.wholeDollars(1000, 30000) : 0,
  };
}

// ─── W-2G ────────────────────────────────────────

export function generateW2G(rng: Rng): Record<string, unknown> {
  const winnings = rng.wholeDollars(1200, 20000);
  return {
    id: rng.uuid(),
    payerName: rng.pick(['MGM Grand', 'Caesars Palace', 'DraftKings', 'FanDuel', 'BetMGM']),
    grossWinnings: winnings,
    federalTaxWithheld: Math.round(winnings * 0.24),
    typeOfWager: rng.pick(['slots', 'poker', 'sports', 'horse racing', 'lottery']),
  };
}

// ─── Rental Property ─────────────────────────────

export function generateRentalProperty(rng: Rng): Record<string, unknown> {
  const rentalIncome = rng.wholeDollars(8000, 48000);
  const addr = rng.address();

  return {
    id: rng.uuid(),
    address: `${addr.street}, ${addr.city}`,
    propertyType: rng.pick(['single_family', 'condo', 'multi_family', 'townhouse'] as const),
    daysRented: rng.int(270, 365),
    personalUseDays: rng.int(0, 14),
    rentalIncome,
    advertising: rng.chance(0.3) ? rng.wholeDollars(100, 500) : 0,
    auto: rng.chance(0.2) ? rng.wholeDollars(200, 1000) : 0,
    cleaning: rng.chance(0.4) ? rng.wholeDollars(500, 3000) : 0,
    commissions: rng.chance(0.1) ? rng.wholeDollars(100, 1000) : 0,
    insurance: rng.wholeDollars(800, 3000),
    legal: rng.chance(0.2) ? rng.wholeDollars(200, 1500) : 0,
    management: rng.chance(0.4) ? Math.round(rentalIncome * rng.float(0.05, 0.10)) : 0,
    mortgageInterest: rng.chance(0.7) ? rng.wholeDollars(3000, 15000) : 0,
    otherInterest: 0,
    repairs: rng.chance(0.5) ? rng.wholeDollars(200, 5000) : 0,
    supplies: rng.chance(0.3) ? rng.wholeDollars(100, 1000) : 0,
    taxes: rng.wholeDollars(1500, 8000),
    utilities: rng.chance(0.4) ? rng.wholeDollars(500, 3000) : 0,
    depreciation: rng.wholeDollars(3000, 12000),
    otherExpenses: rng.chance(0.2) ? rng.wholeDollars(100, 2000) : 0,
    activeParticipation: rng.chance(0.85),
    disposedDuringYear: false,
    dispositionGainLoss: 0,
  };
}

// ─── 1099-SA ─────────────────────────────────────

export function generate1099SA(rng: Rng): Record<string, unknown> {
  return {
    id: rng.uuid(),
    payerName: rng.pick(['Optum Bank', 'Fidelity', 'HSA Bank', 'HealthEquity']),
    grossDistribution: rng.wholeDollars(500, 6000),
    distributionCode: rng.pick(['1', '2']),
  };
}

// ─── 1099-C ──────────────────────────────────────

export function generate1099C(rng: Rng): Record<string, unknown> {
  return {
    id: rng.uuid(),
    creditorName: rng.pick(['Chase', 'Citibank', 'Capital One', 'Discover', 'Amex']),
    amountCancelled: rng.wholeDollars(1000, 15000),
    interestIncluded: rng.chance(0.3) ? rng.wholeDollars(100, 2000) : 0,
    debtDescription: rng.pick(['Credit card', 'Personal loan', 'Medical debt']),
    identifiableEventCode: rng.pick(['A', 'B', 'C', 'G']),
  };
}

// ─── 1099-Q ──────────────────────────────────────

export function generate1099Q(rng: Rng): Record<string, unknown> {
  const gross = rng.wholeDollars(5000, 30000);
  return {
    id: rng.uuid(),
    payerName: rng.pick(['Vanguard 529', 'NY 529 Direct', 'Fidelity 529', 'Schwab 529']),
    grossDistribution: gross,
    earnings: Math.round(gross * rng.float(0.1, 0.4)),
    basisReturn: Math.round(gross * rng.float(0.5, 0.9)),
    distributionType: rng.pick(['qualified', 'non_qualified', 'rollover'] as const),
    qualifiedExpenses: rng.chance(0.8) ? rng.wholeDollars(5000, 30000) : 0,
    isBeneficiaryTaxpayer: rng.chance(0.7),
  };
}
