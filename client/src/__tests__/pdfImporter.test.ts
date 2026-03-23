/**
 * PDF Importer Unit Tests
 *
 * Tests form type detection, field extraction helpers, and edge cases.
 * Uses synthetic TextBlock arrays (not real PDFs) to test the pure logic
 * without requiring pdfjs-dist in the test environment.
 */

import { describe, it, expect } from 'vitest';
import {
  detectFormType,
  extractW2Fields,
  extract1099INTFields,
  extract1099DIVFields,
  extract1099RFields,
  extract1099NECFields,
  extract1099MISCFields,
  extract1099GFields,
  extract1099BFields,
  extract1099KFields,
  extractSSA1099Fields,
  extract1099SAFields,
  extract1099QFields,
  generateImportTrace,
  FORM_TYPE_LABELS,
  INCOME_TYPE_STEP_MAP,
  INCOME_DISCOVERY_KEYS,
  type TextBlock,
  type SupportedFormType,
} from '../services/pdfExtractHelpers';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS — create synthetic text blocks for testing
// ═══════════════════════════════════════════════════════════════════════════════

function makeBlock(text: string, x = 0, y = 0, page = 1): TextBlock {
  return { text, x, y, width: text.length * 7, height: 12, page };
}

/**
 * Create a full set of text blocks that simulate a W-2 PDF.
 */
function makeW2Blocks(): TextBlock[] {
  // Position labels on the left (x=30) and values to the right (x=250)
  // with enough vertical spacing (100px) to prevent proximity collisions.
  // Value x must be within 200px of label end: label at x=30 with ~150px width → value at x=250 is ~70px away.
  return [
    makeBlock('Form W-2', 250, 20),
    makeBlock('Wage and Tax Statement', 200, 40),
    makeBlock("Employer's name", 30, 100),
    makeBlock('Acme Corp', 30, 130),
    makeBlock('Wages, tips', 30, 250),
    makeBlock('75000.00', 250, 250),
    makeBlock('Federal income tax withheld', 30, 350),
    makeBlock('12000.00', 250, 350),
    makeBlock('Social security wages', 30, 450),
    makeBlock('75000.00', 250, 450),
    makeBlock('Social security tax withheld', 30, 550),
    makeBlock('4650.00', 250, 550),
    makeBlock('Medicare wages and tips', 30, 650),
    makeBlock('75000.00', 250, 650),
    makeBlock('Medicare tax withheld', 30, 750),
    makeBlock('1087.50', 250, 750),
    // Boxes 15-17: positional layout — state code + numbers on the same Y line
    // (real IRS W-2 layout: state code left, state wages middle, state tax right)
    makeBlock('NY', 30, 1150),
    makeBlock('75000.00', 150, 1150),
    makeBlock('3750.00', 300, 1150),
    makeBlock('Department of the Treasury', 300, 1350),
    makeBlock('Copy B', 400, 1370),
    makeBlock('employer', 30, 60),
    makeBlock('social security', 30, 1400),
  ];
}

/**
 * Create text blocks that simulate a 1099-INT PDF.
 */
function make1099INTBlocks(): TextBlock[] {
  return [
    makeBlock('Form 1099-INT', 250, 20),
    makeBlock('Interest Income', 200, 40),
    makeBlock("Payer's name", 30, 100),
    makeBlock('First National Bank', 30, 120),
    makeBlock('1 Interest income', 30, 160),
    makeBlock('1250.00', 250, 160),
    makeBlock('2 Early withdrawal penalty', 30, 200),
    makeBlock('50.00', 250, 200),
    makeBlock('4 Federal income tax withheld', 30, 240),
    makeBlock('0.00', 250, 240),
    makeBlock('8 Tax-exempt interest', 30, 280),
    makeBlock('200.00', 250, 280),
    makeBlock('Payer', 30, 320),
    makeBlock('Recipient', 30, 360),
  ];
}

/**
 * Create text blocks that simulate a 1099-DIV PDF.
 */
function make1099DIVBlocks(): TextBlock[] {
  return [
    makeBlock('Form 1099-DIV', 250, 20),
    makeBlock('Dividends and Distributions', 200, 40),
    makeBlock("Payer's name", 30, 100),
    makeBlock('Vanguard Group', 30, 120),
    makeBlock('1a Ordinary dividends', 30, 160),
    makeBlock('3200.00', 250, 160),
    makeBlock('1b Qualified dividends', 30, 200),
    makeBlock('2800.00', 250, 200),
    makeBlock('2a Capital gain distributions', 30, 240),
    makeBlock('500.00', 250, 240),
    makeBlock('4 Federal income tax withheld', 30, 280),
    makeBlock('0.00', 250, 280),
    makeBlock('7 Foreign tax paid', 30, 320),
    makeBlock('45.00', 250, 320),
    makeBlock('Payer', 30, 360),
  ];
}

/**
 * Create text blocks that simulate a 1099-R PDF.
 */
function make1099RBlocks(): TextBlock[] {
  return [
    makeBlock('Form 1099-R', 250, 20),
    makeBlock('Distributions from Pensions', 200, 40),
    makeBlock("Payer's name", 30, 100),
    makeBlock('Fidelity Investments', 30, 120),
    makeBlock('1 Gross distribution', 30, 160),
    makeBlock('25000.00', 250, 160),
    makeBlock('2a Taxable amount', 30, 200),
    makeBlock('25000.00', 250, 200),
    makeBlock('4 Federal income tax withheld', 30, 240),
    makeBlock('5000.00', 250, 240),
    makeBlock('Distribution code', 30, 280),
    makeBlock('7', 250, 280),
  ];
}

/**
 * Create text blocks that simulate a 1099-NEC PDF.
 */
function make1099NECBlocks(): TextBlock[] {
  return [
    makeBlock('Form 1099-NEC', 250, 20),
    makeBlock('Nonemployee Compensation', 200, 40),
    makeBlock("Payer's name", 30, 100),
    makeBlock('Freelance Co LLC', 30, 120),
    makeBlock('1 Nonemployee compensation', 30, 160),
    makeBlock('45000.00', 250, 160),
    makeBlock('Payer', 30, 200),
    makeBlock('Recipient', 30, 240),
    makeBlock('Compensation', 30, 260),
  ];
}

/**
 * Create text blocks that simulate a 1099-MISC PDF.
 */
function make1099MISCBlocks(): TextBlock[] {
  return [
    makeBlock('Form 1099-MISC', 250, 20),
    makeBlock('Miscellaneous Information', 200, 40),
    makeBlock("Payer's name", 30, 100),
    makeBlock('Property Mgmt Inc', 30, 130),
    makeBlock('Other income', 30, 250),
    makeBlock('8000.00', 250, 250),
    makeBlock('Federal income tax withheld', 30, 350),
    makeBlock('800.00', 250, 350),
    makeBlock('Rents', 30, 450),
    makeBlock('Payer', 30, 490),
    makeBlock('Royalties', 30, 510),
    makeBlock('Other income', 30, 530),
  ];
}

/**
 * Create text blocks that simulate a 1099-G PDF.
 */
function make1099GBlocks(): TextBlock[] {
  return [
    makeBlock('Form 1099-G', 250, 20),
    makeBlock('Certain Government Payments', 200, 40),
    makeBlock("Payer's name", 30, 100),
    makeBlock('State Unemployment Agency', 30, 120),
    makeBlock('1 Unemployment compensation', 30, 160),
    makeBlock('15600.00', 250, 160),
    makeBlock('4 Federal income tax withheld', 30, 200),
    makeBlock('1560.00', 250, 200),
    makeBlock('Unemployment', 30, 240),
    makeBlock('State tax refund', 30, 260),
    makeBlock('Payer', 30, 280),
  ];
}

/**
 * Create text blocks that simulate a 1099-B consolidated brokerage statement PDF.
 */
function make1099BBlocks(): TextBlock[] {
  // Use 100px vertical spacing between field rows to prevent proximity collisions.
  // Label width = text.length * 7; value at x=250 must be closer than next label row.
  return [
    makeBlock('Form 1099-B', 250, 20),
    makeBlock('Proceeds from Broker', 200, 40),
    makeBlock("Payer's name", 30, 100),
    makeBlock('Charles Schwab & Co', 30, 130),
    makeBlock('Short-term transactions', 30, 200),
    makeBlock('Long-term transactions', 30, 250),
    makeBlock('Total proceeds', 30, 350),
    makeBlock('125000.00', 250, 350),
    makeBlock('Cost or other basis', 30, 450),
    makeBlock('110000.00', 250, 450),
    makeBlock('4 Federal income tax withheld', 30, 550),
    makeBlock('250.00', 250, 550),
  ];
}

/**
 * Create text blocks that simulate a 1099-K PDF.
 */
function make1099KBlocks(): TextBlock[] {
  // Use 100px vertical spacing between field rows to prevent proximity collisions.
  return [
    makeBlock('Form 1099-K', 250, 20),
    makeBlock('Payment Card and Third Party', 200, 40),
    makeBlock("Filer's name", 30, 100),
    makeBlock('Uber Technologies', 30, 130),
    makeBlock('1a Gross amount', 30, 250),
    makeBlock('42000.00', 250, 250),
    makeBlock('1b Card not present', 30, 350),
    makeBlock('38000.00', 250, 350),
    makeBlock('4 Federal income tax withheld', 30, 450),
    makeBlock('4200.00', 250, 450),
    makeBlock('Payment settlement', 30, 550),
    makeBlock('Third party network', 30, 600),
  ];
}

/**
 * Create text blocks that simulate an SSA-1099 PDF.
 */
function makeSSA1099Blocks(): TextBlock[] {
  // Use 100px vertical spacing between field rows to prevent proximity collisions.
  // Use shorter label for box 6 so value at x=350 is right of label right edge.
  return [
    makeBlock('Form SSA-1099', 250, 20),
    makeBlock('Social Security Benefit Statement', 200, 40),
    makeBlock('Social Security Administration', 30, 80),
    makeBlock('5 Net benefits', 30, 250),
    makeBlock('24000.00', 250, 250),
    makeBlock('6 Voluntary federal tax withheld', 30, 350),
    makeBlock('2400.00', 350, 350),
    makeBlock('Benefits paid', 30, 450),
  ];
}

/**
 * Create text blocks that simulate a 1099-SA PDF.
 */
function make1099SABlocks(): TextBlock[] {
  return [
    makeBlock('Form 1099-SA', 250, 20),
    makeBlock('Distributions From an HSA', 200, 40),
    makeBlock("Trustee's name", 30, 100),
    makeBlock('HealthEquity Inc', 30, 120),
    makeBlock('1 Gross distribution', 30, 160),
    makeBlock('3500.00', 250, 160),
    makeBlock('Federal income tax withheld', 30, 200),
    makeBlock('0.00', 250, 200),
    makeBlock('Health savings', 30, 240),
    makeBlock('Distribution code', 30, 260),
    makeBlock('Gross distribution', 30, 280),
  ];
}

/**
 * Create text blocks that simulate a 1099-Q PDF.
 */
function make1099QBlocks(): TextBlock[] {
  // Use 100px vertical spacing between field rows to prevent proximity collisions.
  // Use longer label text so value at x=250 is closer than next row's number-prefixed label.
  return [
    makeBlock('Form 1099-Q', 250, 20),
    makeBlock('Payments From Qualified Education', 200, 40),
    makeBlock("Trustee's name", 30, 100),
    makeBlock('Vanguard 529 Plan', 30, 130),
    makeBlock('1 Gross distribution amount', 30, 250),
    makeBlock('15000.00', 250, 250),
    makeBlock('2 Earnings for the year', 30, 350),
    makeBlock('3200.00', 250, 350),
    makeBlock('3 Basis of return', 30, 450),
    makeBlock('11800.00', 250, 450),
    makeBlock('Education program', 30, 550),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM TYPE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectFormType', () => {
  it('detects W-2 with high confidence', () => {
    const result = detectFormType(makeW2Blocks());
    expect(result.type).toBe('W-2');
    expect(result.incomeType).toBe('w2');
    expect(result.confidence).toBe('high');
  });

  it('detects 1099-INT with high confidence', () => {
    const result = detectFormType(make1099INTBlocks());
    expect(result.type).toBe('1099-INT');
    expect(result.incomeType).toBe('1099int');
    expect(result.confidence).toBe('high');
  });

  it('detects 1099-DIV with high confidence', () => {
    const result = detectFormType(make1099DIVBlocks());
    expect(result.type).toBe('1099-DIV');
    expect(result.incomeType).toBe('1099div');
    expect(result.confidence).toBe('high');
  });

  it('detects 1099-R with high confidence', () => {
    const result = detectFormType(make1099RBlocks());
    expect(result.type).toBe('1099-R');
    expect(result.incomeType).toBe('1099r');
    expect(result.confidence).toBe('high');
  });

  it('detects 1099-NEC with high confidence', () => {
    const result = detectFormType(make1099NECBlocks());
    expect(result.type).toBe('1099-NEC');
    expect(result.incomeType).toBe('1099nec');
    expect(result.confidence).toBe('high');
  });

  it('detects 1099-MISC with high confidence', () => {
    const result = detectFormType(make1099MISCBlocks());
    expect(result.type).toBe('1099-MISC');
    expect(result.incomeType).toBe('1099misc');
    expect(result.confidence).toBe('high');
  });

  it('detects 1099-G with high confidence', () => {
    const result = detectFormType(make1099GBlocks());
    expect(result.type).toBe('1099-G');
    expect(result.incomeType).toBe('1099g');
    expect(result.confidence).toBe('high');
  });

  it('detects 1099-B with high confidence', () => {
    const result = detectFormType(make1099BBlocks());
    expect(result.type).toBe('1099-B');
    expect(result.incomeType).toBe('1099b');
    expect(result.confidence).toBe('high');
  });

  it('detects 1099-K with high confidence', () => {
    const result = detectFormType(make1099KBlocks());
    expect(result.type).toBe('1099-K');
    expect(result.incomeType).toBe('1099k');
    expect(result.confidence).toBe('high');
  });

  it('detects SSA-1099 with high confidence', () => {
    const result = detectFormType(makeSSA1099Blocks());
    expect(result.type).toBe('SSA-1099');
    expect(result.incomeType).toBe('ssa1099');
    expect(result.confidence).toBe('high');
  });

  it('detects 1099-SA with high confidence', () => {
    const result = detectFormType(make1099SABlocks());
    expect(result.type).toBe('1099-SA');
    expect(result.incomeType).toBe('1099sa');
    expect(result.confidence).toBe('high');
  });

  it('detects 1099-Q with high confidence', () => {
    const result = detectFormType(make1099QBlocks());
    expect(result.type).toBe('1099-Q');
    expect(result.incomeType).toBe('1099q');
    expect(result.confidence).toBe('high');
  });

  it('returns medium confidence when only primary keyword matches', () => {
    // Only "form w-2" keyword, no secondary matches
    const blocks = [makeBlock('Form W-2', 100, 20)];
    const result = detectFormType(blocks);
    expect(result.type).toBe('W-2');
    expect(result.confidence).toBe('medium');
  });

  it('returns null for unrecognized forms', () => {
    const blocks = [
      makeBlock('Some Random Document', 100, 20),
      makeBlock('Not a tax form', 100, 60),
      makeBlock('Invoice #12345', 100, 100),
    ];
    const result = detectFormType(blocks);
    expect(result.type).toBeNull();
    expect(result.incomeType).toBeNull();
    expect(result.confidence).toBe('low');
  });

  it('returns null for empty text blocks', () => {
    const result = detectFormType([]);
    expect(result.type).toBeNull();
    expect(result.confidence).toBe('low');
  });

  it('prefers 1099-NEC over 1099-INT when both keywords appear', () => {
    // 1099-NEC is before 1099-INT in the signature list
    const blocks = [
      makeBlock('Form 1099-NEC', 100, 20),
      makeBlock('Nonemployee Compensation', 100, 40),
      makeBlock('Payer', 100, 60),
      makeBlock('Recipient', 100, 80),
      makeBlock('Compensation', 100, 100),
    ];
    const result = detectFormType(blocks);
    expect(result.type).toBe('1099-NEC');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD EXTRACTION — W-2
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractW2Fields', () => {
  it('extracts all W-2 fields from synthetic PDF blocks', () => {
    const data = extractW2Fields(makeW2Blocks());
    expect(data.employerName).toBe('Acme Corp');
    expect(data.wages).toBe(75000);
    expect(data.federalTaxWithheld).toBe(12000);
    expect(data.socialSecurityWages).toBe(75000);
    expect(data.socialSecurityTax).toBe(4650);
    expect(data.medicareWages).toBe(75000);
    expect(data.medicareTax).toBe(1087.5);
    expect(data.stateTaxWithheld).toBe(3750);
    expect(data.stateWages).toBe(75000);
    expect(data.state).toBe('NY');
  });

  it('returns zeros for blocks with no matching labels', () => {
    const blocks = [
      makeBlock('xy', 30, 300), // too short for fallback (< 3 chars)
      makeBlock('ab', 30, 340),
    ];
    const data = extractW2Fields(blocks);
    expect(data.wages).toBe(0);
    expect(data.federalTaxWithheld).toBe(0);
    expect(data.employerName).toBe('');
  });

  it('handles W-2 with partial fields', () => {
    const blocks = [
      makeBlock("Employer's name", 30, 100),
      makeBlock('Test Company', 30, 120),
      makeBlock('1 Wages, tips', 30, 160),
      makeBlock('50000', 250, 160),
      // No federal tax withheld blocks
    ];
    const data = extractW2Fields(blocks);
    expect(data.employerName).toBe('Test Company');
    expect(data.wages).toBe(50000);
    expect(data.federalTaxWithheld).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD EXTRACTION — 1099 Forms
// ═══════════════════════════════════════════════════════════════════════════════

describe('extract1099INTFields', () => {
  it('extracts interest income fields', () => {
    const data = extract1099INTFields(make1099INTBlocks());
    expect(data.payerName).toBe('First National Bank');
    expect(data.amount).toBe(1250);
    expect(data.earlyWithdrawalPenalty).toBe(50);
    expect(data.taxExemptInterest).toBe(200);
  });
});

describe('extract1099DIVFields', () => {
  it('extracts dividend fields', () => {
    const data = extract1099DIVFields(make1099DIVBlocks());
    expect(data.payerName).toBe('Vanguard Group');
    expect(data.ordinaryDividends).toBe(3200);
    expect(data.qualifiedDividends).toBe(2800);
    expect(data.capitalGainDistributions).toBe(500);
    expect(data.foreignTaxPaid).toBe(45);
  });
});

describe('extract1099RFields', () => {
  it('extracts retirement distribution fields', () => {
    const data = extract1099RFields(make1099RBlocks());
    expect(data.payerName).toBe('Fidelity Investments');
    expect(data.grossDistribution).toBe(25000);
    expect(data.taxableAmount).toBe(25000);
    expect(data.federalTaxWithheld).toBe(5000);
  });
});

describe('extract1099NECFields', () => {
  it('extracts nonemployee compensation fields', () => {
    const data = extract1099NECFields(make1099NECBlocks());
    expect(data.payerName).toBe('Freelance Co LLC');
    expect(data.amount).toBe(45000);
  });
});

describe('extract1099MISCFields', () => {
  it('extracts miscellaneous income fields', () => {
    const data = extract1099MISCFields(make1099MISCBlocks());
    expect(data.payerName).toBe('Property Mgmt Inc');
    expect(data.otherIncome).toBe(8000);
    expect(data.federalTaxWithheld).toBe(800);
  });
});

describe('extract1099GFields', () => {
  it('extracts government payment fields', () => {
    const data = extract1099GFields(make1099GBlocks());
    expect(data.payerName).toBe('State Unemployment Agency');
    expect(data.unemploymentCompensation).toBe(15600);
    expect(data.federalTaxWithheld).toBe(1560);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD EXTRACTION — New Form Types (Phase 4)
// ═══════════════════════════════════════════════════════════════════════════════

describe('extract1099BFields', () => {
  it('extracts consolidated brokerage statement fields', () => {
    const data = extract1099BFields(make1099BBlocks());
    expect(data.brokerName).toBe('Charles Schwab & Co');
    expect(data.proceeds).toBe(125000);
    expect(data.costBasis).toBe(110000);
    expect(data.federalTaxWithheld).toBe(250);
    expect(data.description).toBe('Consolidated Summary (PDF Import)');
    expect(data.isLongTerm).toBe(false);
  });

  it('returns zeros when no matching fields exist', () => {
    const blocks = [makeBlock('Department of the Treasury', 30, 100)];
    const data = extract1099BFields(blocks);
    expect(data.proceeds).toBe(0);
    expect(data.costBasis).toBe(0);
    expect(data.brokerName).toBe('');
  });
});

describe('extract1099KFields', () => {
  it('extracts payment card transaction fields', () => {
    const data = extract1099KFields(make1099KBlocks());
    expect(data.platformName).toBe('Uber Technologies');
    expect(data.grossAmount).toBe(42000);
    expect(data.cardNotPresent).toBe(38000);
    expect(data.federalTaxWithheld).toBe(4200);
  });

  it('returns zeros for empty blocks', () => {
    const data = extract1099KFields([]);
    expect(data.grossAmount).toBe(0);
    expect(data.platformName).toBe('');
  });
});

describe('extractSSA1099Fields', () => {
  it('extracts social security benefit fields', () => {
    const data = extractSSA1099Fields(makeSSA1099Blocks());
    expect(data.totalBenefits).toBe(24000);
    expect(data.federalTaxWithheld).toBe(2400);
  });

  it('has no payer name field (always SSA)', () => {
    const data = extractSSA1099Fields(makeSSA1099Blocks());
    // SSA-1099 doesn't have a payerName — it's always SSA
    expect(data.payerName).toBeUndefined();
  });
});

describe('extract1099SAFields', () => {
  it('extracts HSA distribution fields', () => {
    const data = extract1099SAFields(make1099SABlocks());
    expect(data.payerName).toBe('HealthEquity Inc');
    expect(data.grossDistribution).toBe(3500);
  });

  it('handles partial data gracefully', () => {
    const blocks = [
      makeBlock("Trustee's name", 30, 100),
      makeBlock('Optum Bank', 30, 120),
      makeBlock('1 Gross distribution', 30, 160),
      makeBlock('1200.00', 250, 160),
    ];
    const data = extract1099SAFields(blocks);
    expect(data.payerName).toBe('Optum Bank');
    expect(data.grossDistribution).toBe(1200);
  });
});

describe('extract1099QFields', () => {
  it('extracts education program payment fields', () => {
    const data = extract1099QFields(make1099QBlocks());
    expect(data.payerName).toBe('Vanguard 529 Plan');
    expect(data.grossDistribution).toBe(15000);
    expect(data.earnings).toBe(3200);
    expect(data.basisReturn).toBe(11800);
    expect(data.distributionType).toBe('qualified');
    expect(data.qualifiedExpenses).toBe(0);
  });

  it('returns default values for missing fields', () => {
    const blocks = [
      makeBlock("Trustee's name", 30, 100),
      makeBlock('State 529 Plan', 30, 120),
      makeBlock('1 Gross distribution', 30, 160),
      makeBlock('5000.00', 250, 160),
    ];
    const data = extract1099QFields(blocks);
    expect(data.payerName).toBe('State 529 Plan');
    expect(data.grossDistribution).toBe(5000);
    expect(data.earnings).toBe(0);
    expect(data.basisReturn).toBe(0);
    expect(data.distributionType).toBe('qualified');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY / CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('FORM_TYPE_LABELS', () => {
  it('has labels for all supported form types', () => {
    const expected: SupportedFormType[] = ['W-2', '1099-INT', '1099-DIV', '1099-R', '1099-NEC', '1099-MISC', '1099-G', '1099-B', '1099-K', 'SSA-1099', '1099-SA', '1099-Q'];
    for (const ft of expected) {
      expect(FORM_TYPE_LABELS[ft]).toBeTruthy();
    }
  });
});

describe('INCOME_TYPE_STEP_MAP', () => {
  it('maps all income types to step IDs', () => {
    expect(INCOME_TYPE_STEP_MAP['w2']).toBe('w2_income');
    expect(INCOME_TYPE_STEP_MAP['1099int']).toBe('1099int_income');
    expect(INCOME_TYPE_STEP_MAP['1099div']).toBe('1099div_income');
    expect(INCOME_TYPE_STEP_MAP['1099r']).toBe('1099r_income');
    expect(INCOME_TYPE_STEP_MAP['1099nec']).toBe('1099nec_income');
    expect(INCOME_TYPE_STEP_MAP['1099misc']).toBe('1099misc_income');
    expect(INCOME_TYPE_STEP_MAP['1099g']).toBe('1099g_income');
    expect(INCOME_TYPE_STEP_MAP['1099b']).toBe('1099b_income');
    expect(INCOME_TYPE_STEP_MAP['1099k']).toBe('1099k_income');
    expect(INCOME_TYPE_STEP_MAP['ssa1099']).toBe('ssa1099_income');
    expect(INCOME_TYPE_STEP_MAP['1099sa']).toBe('1099sa_income');
    expect(INCOME_TYPE_STEP_MAP['1099q']).toBe('1099q_income');
  });
});

describe('INCOME_DISCOVERY_KEYS', () => {
  it('maps all income types to discovery keys', () => {
    expect(INCOME_DISCOVERY_KEYS['w2']).toBe('w2');
    expect(INCOME_DISCOVERY_KEYS['1099int']).toBe('1099int');
    expect(INCOME_DISCOVERY_KEYS['1099nec']).toBe('1099nec');
    expect(INCOME_DISCOVERY_KEYS['1099b']).toBe('1099b');
    expect(INCOME_DISCOVERY_KEYS['1099k']).toBe('1099k');
    expect(INCOME_DISCOVERY_KEYS['ssa1099']).toBe('ssa1099');
    expect(INCOME_DISCOVERY_KEYS['1099sa']).toBe('1099sa');
    expect(INCOME_DISCOVERY_KEYS['1099q']).toBe('1099q');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('edge cases', () => {
  it('handles currency-formatted numbers in text blocks', () => {
    const blocks = [
      makeBlock("Employer's name", 30, 100),
      makeBlock('Acme Corp', 30, 120),
      makeBlock('Wages, tips', 30, 160),
      makeBlock('$75,000.00', 250, 160),
      makeBlock('employer', 30, 50),
      makeBlock('social security', 30, 300),
    ];
    const data = extractW2Fields(blocks);
    // findNearbyNumber strips $ and commas
    expect(data.wages).toBe(75000);
  });

  it('handles blocks where numeric value is far away (>200px) — returns 0', () => {
    const blocks = [
      makeBlock('1 Wages, tips', 30, 100),
      makeBlock('75000', 500, 500), // 400+ pixels away
    ];
    const data = extractW2Fields(blocks);
    expect(data.wages).toBe(0);
  });

  it('prefers the nearest numeric value when multiple exist', () => {
    const blocks = [
      makeBlock("Employer's name", 30, 100),
      makeBlock('Acme Corp', 30, 120),
      makeBlock('1 Wages, tips', 30, 160),
      makeBlock('50000', 250, 160), // closest
      makeBlock('75000', 250, 190), // farther
      makeBlock('employer', 30, 50),
      makeBlock('social security', 30, 300),
    ];
    const data = extractW2Fields(blocks);
    expect(data.wages).toBe(50000);
  });

  it('handles the payer name fallback when label finds nearby name', () => {
    // "Employer's name" label with company name directly below
    const blocks = [
      makeBlock("Employer's name", 30, 100, 1),
      makeBlock('Big Finance Corp', 30, 130, 1),
      makeBlock('Wages, tips', 30, 200, 1),
      makeBlock('60000', 400, 200, 1),
    ];
    const data = extractW2Fields(blocks);
    expect(data.employerName).toBe('Big Finance Corp');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KEYWORD COLLISION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('keyword collision prevention', () => {
  it('1099-DIV with "proceeds" text does not misdetect as 1099-B', () => {
    // A 1099-DIV form that mentions "proceeds" in nearby context text
    // should still be detected as 1099-DIV, not 1099-B
    const blocks = [
      makeBlock('Form 1099-DIV', 250, 20),
      makeBlock('Dividends and Distributions', 200, 40),
      makeBlock("Payer's name", 30, 100),
      makeBlock('Vanguard', 30, 130),
      makeBlock('Reinvested proceeds', 30, 200), // "proceeds" appears but shouldn't trigger 1099-B
      makeBlock('1a Ordinary dividends', 30, 300),
      makeBlock('5000.00', 250, 300),
      makeBlock('Qualified dividends', 30, 400),
    ];
    const result = detectFormType(blocks);
    expect(result.type).toBe('1099-DIV');
    expect(result.type).not.toBe('1099-B');
  });

  it('1099-SA distribution code is extracted', () => {
    // Verify the new distribution code (Box 3) extraction works
    const blocks = [
      makeBlock("Trustee's name", 30, 100),
      makeBlock('HealthEquity Inc', 30, 130),
      makeBlock('1 Gross distribution', 30, 250),
      makeBlock('3500.00', 250, 250),
      makeBlock('3 Distribution code', 30, 350),
      makeBlock('1', 250, 350),
      makeBlock('Federal income tax withheld', 30, 450),
      makeBlock('350.00', 250, 450),
    ];
    const data = extract1099SAFields(blocks);
    expect(data.distributionCode).toBe('1');
    expect(data.grossDistribution).toBe(3500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// detectFormType — matchedKeywords
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectFormType matchedKeywords', () => {
  it('returns matched keywords for high confidence W-2', () => {
    const result = detectFormType(makeW2Blocks());
    expect(result.matchedKeywords).toContain('wage and tax statement');
    expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(3);
  });

  it('returns single keyword for medium confidence', () => {
    const blocks = [makeBlock('Form W-2', 100, 20)];
    const result = detectFormType(blocks);
    expect(result.matchedKeywords).toContain('form w-2');
    expect(result.matchedKeywords.length).toBe(1);
  });

  it('returns empty array for unrecognized forms', () => {
    const blocks = [makeBlock('Invoice #12345', 100, 20)];
    const result = detectFormType(blocks);
    expect(result.matchedKeywords).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT TRACE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateImportTrace', () => {
  it('generates trace for successful W-2 extraction', () => {
    const extractedData = extractW2Fields(makeW2Blocks());
    const { matchedKeywords, confidence } = detectFormType(makeW2Blocks());

    const trace = generateImportTrace('W-2', confidence, matchedKeywords, extractedData, 22, 1);

    expect(trace.formDetection.detectedType).toBe('W-2');
    expect(trace.formDetection.confidence).toBe('high');
    expect(trace.formDetection.matchedKeywords.length).toBeGreaterThan(0);
    expect(trace.formDetection.reasoning).toContain('primary keyword');
    expect(trace.fields.length).toBe(Object.keys(extractedData).length);
    expect(trace.summary).toContain('W-2');
    expect(trace.textBlockCount).toBe(22);
    expect(trace.pagesScanned).toBe(1);
  });

  it('marks found fields correctly', () => {
    const extractedData = extractW2Fields(makeW2Blocks());
    const trace = generateImportTrace('W-2', 'high', ['form w-2'], extractedData, 20, 1);

    const wagesEntry = trace.fields.find(f => f.field === 'wages');
    expect(wagesEntry).toBeDefined();
    expect(wagesEntry!.status).toBe('found');
    expect(wagesEntry!.value).toContain('75,000');
    expect(wagesEntry!.label).toBe('Wages, Tips (Box 1)');
  });

  it('marks not_found fields correctly when value is 0', () => {
    // Partial W-2 — wages present but stateWages absent
    const extractedData = {
      employerName: 'Acme',
      wages: 50000,
      federalTaxWithheld: 0,
      socialSecurityWages: 0,
      socialSecurityTax: 0,
      medicareWages: 0,
      medicareTax: 0,
      stateTaxWithheld: 0,
      stateWages: 0,
    };
    const trace = generateImportTrace('W-2', 'high', ['form w-2'], extractedData, 10, 1);

    const fedTax = trace.fields.find(f => f.field === 'federalTaxWithheld');
    expect(fedTax!.status).toBe('not_found');
    expect(fedTax!.value).toBeUndefined();

    const wages = trace.fields.find(f => f.field === 'wages');
    expect(wages!.status).toBe('found');
  });

  it('handles null form type (unrecognized PDF)', () => {
    const trace = generateImportTrace(null, 'low', [], {}, 3, 1);

    expect(trace.formDetection.detectedType).toBeNull();
    expect(trace.formDetection.reasoning).toContain('No primary');
    expect(trace.fields).toHaveLength(0);
    expect(trace.summary).toContain('Could not identify');
  });

  it('generates trace for 1099-NEC with medium confidence', () => {
    const extractedData = { payerName: 'Client Co', amount: 45000 };
    const trace = generateImportTrace('1099-NEC', 'medium', ['1099-nec'], extractedData, 8, 1);

    expect(trace.formDetection.confidence).toBe('medium');
    expect(trace.formDetection.reasoning).toContain('fewer than 2 secondary');
    expect(trace.fields).toHaveLength(2);
    expect(trace.summary).toContain('2 of 2');
  });

  it('includes all 1099-DIV field labels', () => {
    const extractedData = extract1099DIVFields(make1099DIVBlocks());
    const trace = generateImportTrace('1099-DIV', 'high', ['1099-div'], extractedData, 12, 1);

    const labels = trace.fields.map(f => f.label);
    expect(labels).toContain('Ordinary Dividends (Box 1a)');
    expect(labels).toContain('Qualified Dividends (Box 1b)');
    expect(labels).toContain('Capital Gain Distributions (Box 2a)');
  });

  it('summary shows correct found/total counts', () => {
    // 3 fields, 2 found
    const extractedData = { payerName: 'Bank', amount: 500, federalTaxWithheld: 0 };
    const trace = generateImportTrace('1099-INT', 'high', ['1099-int'], extractedData, 15, 1);

    expect(trace.summary).toContain('2 of 3');
  });

  it('formats currency values correctly', () => {
    const extractedData = { payerName: '', amount: 1234.56 };
    const trace = generateImportTrace('1099-NEC', 'high', ['1099-nec'], extractedData, 10, 1);

    const amount = trace.fields.find(f => f.field === 'amount');
    expect(amount!.value).toBe('$1,234.56');
  });

  it('handles name fields (empty string = not_found)', () => {
    const extractedData = { payerName: '', amount: 5000 };
    const trace = generateImportTrace('1099-NEC', 'high', ['1099-nec'], extractedData, 10, 1);

    const name = trace.fields.find(f => f.field === 'payerName');
    expect(name!.status).toBe('not_found');
    expect(name!.reasoning).toContain('enter manually');
  });

  it('generates trace for 1099-B extraction', () => {
    const extractedData = extract1099BFields(make1099BBlocks());
    const trace = generateImportTrace('1099-B', 'high', ['1099-b'], extractedData, 12, 1);

    expect(trace.summary).toContain('1099-B');
    const proceedsEntry = trace.fields.find(f => f.field === 'proceeds');
    expect(proceedsEntry!.status).toBe('found');
    expect(proceedsEntry!.label).toBe('Total Proceeds (Box 1d)');
  });

  it('generates trace for SSA-1099 with field labels', () => {
    const extractedData = extractSSA1099Fields(makeSSA1099Blocks());
    const trace = generateImportTrace('SSA-1099', 'high', ['ssa-1099'], extractedData, 7, 1);

    expect(trace.summary).toContain('SSA-1099');
    const benefitsEntry = trace.fields.find(f => f.field === 'totalBenefits');
    expect(benefitsEntry!.status).toBe('found');
    expect(benefitsEntry!.label).toBe('Net Benefits (Box 5)');
  });

  it('generates trace for 1099-Q with all fields', () => {
    const extractedData = extract1099QFields(make1099QBlocks());
    const trace = generateImportTrace('1099-Q', 'high', ['1099-q'], extractedData, 11, 1);

    const labels = trace.fields.map(f => f.label);
    expect(labels).toContain('Gross Distribution (Box 1)');
    expect(labels).toContain('Earnings (Box 2)');
    expect(labels).toContain('Basis (Box 3)');
  });
});
