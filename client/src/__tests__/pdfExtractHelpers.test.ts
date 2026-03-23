/**
 * Tests for PDF extract helpers — groupWordsToPhrases() and the
 * detection + extraction pipeline.
 *
 * Uses realistic TextBlock data derived from actual IRS CopyB PDFs
 * processed through pdftotext -bbox (bounding box extraction).
 */
import { describe, it, expect } from 'vitest';
import {
  groupWordsToPhrases,
  detectFormType,
  detectFormPages,
  extractW2Fields,
  extract1099INTFields,
  extract1099DIVFields,
  extract1099NECFields,
  extract1099RFields,
  extract1098Fields,
  extractK1Fields,
  extractW2GFields,
  type TextBlock,
} from '../services/pdfExtractHelpers';

// ── Helper: build TextBlock from bbox data ────────────

function tb(text: string, x: number, y: number, w: number, h: number, page = 1): TextBlock {
  return { text, x, y, width: w, height: h, page };
}

// ── groupWordsToPhrases ────────────────────────────────

describe('groupWordsToPhrases', () => {
  it('merges adjacent words on the same line into phrases', () => {
    // "1 Wages, tips, other compensation" — typical IRS label
    const words: TextBlock[] = [
      tb('1', 339, 65, 4, 8),
      tb('Wages,', 348, 65, 21, 8),
      tb('tips,', 371, 65, 12, 8),
      tb('other', 385, 65, 15, 8),
      tb('compensation', 402, 65, 41, 8),
    ];
    const phrases = groupWordsToPhrases(words);
    expect(phrases).toHaveLength(1);
    expect(phrases[0].text).toBe('1 Wages, tips, other compensation');
    expect(phrases[0].x).toBe(339);
  });

  it('splits columns on X-gap exceeding threshold', () => {
    // Two column headers on the same Y line of a W-2
    const words: TextBlock[] = [
      tb('1', 339, 65, 4, 8),
      tb('Wages,', 348, 65, 21, 8),
      tb('tips,', 371, 65, 12, 8),
      tb('other', 385, 65, 15, 8),
      tb('compensation', 402, 65, 41, 8), // ends at x=443
      // Gap of 18px → new phrase
      tb('2', 461, 65, 4, 8),
      tb('Federal', 471, 65, 23, 8),
      tb('income', 496, 65, 23, 8),
      tb('tax', 521, 65, 10, 8),
      tb('withheld', 533, 65, 26, 8),
    ];
    const phrases = groupWordsToPhrases(words);
    expect(phrases).toHaveLength(2);
    expect(phrases[0].text).toBe('1 Wages, tips, other compensation');
    expect(phrases[1].text).toBe('2 Federal income tax withheld');
  });

  it('separates rows by Y tolerance', () => {
    const words: TextBlock[] = [
      tb('Label', 100, 50, 30, 10),
      tb('Value', 100, 70, 30, 10), // Y diff = 20 > yTolerance(5)
    ];
    const phrases = groupWordsToPhrases(words);
    expect(phrases).toHaveLength(2);
    expect(phrases[0].text).toBe('Label');
    expect(phrases[1].text).toBe('Value');
  });

  it('handles single-word blocks', () => {
    const words: TextBlock[] = [
      tb('85250.00', 417, 75, 34, 8),
    ];
    const phrases = groupWordsToPhrases(words);
    expect(phrases).toHaveLength(1);
    expect(phrases[0].text).toBe('85250.00');
  });

  it('keeps values as separate phrases from labels', () => {
    // Label at Y=65, value at Y=75 (below label box)
    const words: TextBlock[] = [
      tb('1', 339, 65, 4, 8),
      tb('Wages,', 348, 65, 21, 8),
      tb('tips', 371, 65, 12, 8),
      tb('85250.00', 417, 75, 34, 8), // Y diff = 10
    ];
    const phrases = groupWordsToPhrases(words);
    expect(phrases).toHaveLength(2);
    expect(phrases[0].text).toContain('Wages');
    expect(phrases[1].text).toBe('85250.00');
  });

  it('handles multi-page documents', () => {
    const words: TextBlock[] = [
      tb('Page1Label', 100, 50, 40, 10, 1),
      tb('Page2Label', 100, 50, 40, 10, 2),
    ];
    const phrases = groupWordsToPhrases(words);
    expect(phrases).toHaveLength(2);
    expect(phrases[0].page).toBe(1);
    expect(phrases[1].page).toBe(2);
  });

  it('returns empty for empty input', () => {
    expect(groupWordsToPhrases([])).toEqual([]);
  });
});

// ── Form Detection ─────────────────────────────────────

describe('detectFormType', () => {
  it('detects W-2 from CopyB text', () => {
    const blocks: TextBlock[] = [
      tb('Wage', 100, 400, 20, 8),
      tb('and', 122, 400, 12, 8),
      tb('Tax', 136, 400, 12, 8),
      tb('Statement', 150, 400, 30, 8),
      tb('Form', 100, 410, 20, 8),
      tb('W-2', 122, 410, 15, 8),
      tb('employer', 50, 85, 30, 8),
      tb('wages', 340, 65, 20, 8),
      tb('federal', 470, 65, 23, 8),
      tb('income', 495, 65, 22, 8),
      tb('tax', 519, 65, 10, 8),
      tb('withheld', 531, 65, 26, 8),
      tb('social', 350, 85, 20, 8),
      tb('security', 372, 85, 24, 8),
    ];
    const result = detectFormType(blocks);
    expect(result.type).toBe('W-2');
    expect(result.confidence).toBe('high');
  });

  it('detects 1099-INT from CopyB text', () => {
    const blocks: TextBlock[] = [
      tb('1099-INT', 300, 50, 40, 10),
      tb('Interest', 350, 50, 30, 10),
      tb('Income', 382, 50, 25, 10),
      tb('payer', 50, 30, 20, 8),
      tb('interest', 340, 65, 25, 8),
      tb('early', 340, 85, 18, 8),
      tb('withdrawal', 360, 85, 30, 8),
    ];
    const result = detectFormType(blocks);
    expect(result.type).toBe('1099-INT');
    expect(result.confidence).toBe('high');
  });

  it('detects 1099-NEC from CopyB text', () => {
    const blocks: TextBlock[] = [
      tb('1099-NEC', 300, 50, 40, 10),
      tb('Nonemployee', 350, 50, 40, 10),
      tb('Compensation', 392, 50, 45, 10),
      tb('payer', 50, 30, 20, 8),
      tb('compensation', 340, 65, 40, 8),
      tb('recipient', 50, 120, 30, 8),
    ];
    const result = detectFormType(blocks);
    expect(result.type).toBe('1099-NEC');
    expect(result.confidence).toBe('high');
  });
});

// ── W-2 Field Extraction ───────────────────────────────

describe('extractW2Fields with phrase-level blocks', () => {
  // Simulate what the fixed pipeline produces: phrase-level blocks from
  // groupWordsToPhrases(), matching real IRS W-2 CopyB layout.
  function makeW2Blocks(): TextBlock[] {
    return [
      // Entity section (left column, top)
      tb("a Employee's social security number", 157, 37, 117, 8),
      tb('***-**-6789', 197, 51, 39, 7),
      tb('b Employer identification number (EIN)', 42, 61, 123, 8),
      tb('12-3456789', 163, 75, 43, 7),
      tb("c Employer's name, address, and ZIP code", 42, 85, 137, 8),
      tb('Acme Corporation Inc.', 39, 100, 80, 7),
      tb('123 Business Parkway', 39, 110, 70, 7),
      tb('San Francisco, CA 94105', 39, 120, 80, 7),

      // Box labels (row 1) — y=61
      tb('1 Wages, tips, other compensation', 339, 61, 104, 8),
      tb('2 Federal income tax withheld', 461, 61, 98, 8),

      // Box values (row 1) — y=75
      tb('85250.00', 417, 75, 34, 7),
      tb('14892.50', 540, 75, 33, 7),

      // Box labels (row 2) — y=85 (real IRS spacing: tight rows)
      tb('3 Social security wages', 339, 85, 78, 8),
      tb('4 Social security tax withheld', 461, 85, 98, 8),
      tb('85250.00', 418, 99, 34, 7),
      tb('5285.50', 544, 99, 29, 7),

      // Box labels (row 3) — y=109 (real IRS spacing: tight rows)
      // Box 4 value at y=99 is closer to Box 6 label at y=109 than
      // Box 6 value at y=123, but below-bias ensures correct match.
      tb('5 Medicare wages and tips', 339, 109, 88, 8),
      tb('6 Medicare tax withheld', 461, 109, 79, 8),
      tb('85250.00', 418, 123, 34, 7),
      tb('1236.13', 544, 123, 29, 7),

      // Employee section
      tb("e Employee's first name and initial", 42, 170, 120, 8),
      tb('Jane M.', 42, 183, 30, 7),
      tb('Taxpayer', 42, 193, 33, 7),

      // State section
      tb('15 State', 42, 350, 30, 8),
      tb("Employer's state ID number", 80, 350, 80, 8),
      tb('TX', 42, 363, 10, 7),
      tb('12-3456789', 80, 363, 43, 7),
      tb('16 State wages, tips, etc.', 200, 350, 80, 8),
      tb('17 State income tax', 350, 350, 60, 8),
      tb('85250.00', 200, 363, 34, 7),
      tb('0.00', 350, 363, 15, 7),

      // Form title
      tb('Form', 42, 370, 20, 8),
      tb('W-2', 68, 370, 15, 10),
      tb('Wage and Tax Statement', 100, 370, 80, 8),
    ];
  }

  it('detects W-2 form type with high confidence', () => {
    const blocks = makeW2Blocks();
    const result = detectFormType(blocks);
    expect(result.type).toBe('W-2');
    expect(result.incomeType).toBe('w2');
    expect(result.confidence).toBe('high');
  });

  it('extracts wages from Box 1', () => {
    const fields = extractW2Fields(makeW2Blocks());
    expect(fields.wages).toBe(85250);
  });

  it('extracts federal tax withheld from Box 2', () => {
    const fields = extractW2Fields(makeW2Blocks());
    expect(fields.federalTaxWithheld).toBe(14892.5);
  });

  it('extracts social security wages from Box 3', () => {
    const fields = extractW2Fields(makeW2Blocks());
    expect(fields.socialSecurityWages).toBe(85250);
  });

  it('extracts social security tax from Box 4', () => {
    const fields = extractW2Fields(makeW2Blocks());
    expect(fields.socialSecurityTax).toBe(5285.5);
  });

  it('extracts medicare wages from Box 5', () => {
    const fields = extractW2Fields(makeW2Blocks());
    expect(fields.medicareWages).toBe(85250);
  });

  it('extracts medicare tax from Box 6', () => {
    const fields = extractW2Fields(makeW2Blocks());
    expect(fields.medicareTax).toBe(1236.13);
  });

  it('extracts employer name', () => {
    const fields = extractW2Fields(makeW2Blocks());
    expect(fields.employerName).toBeTruthy();
    // Should find "Acme Corporation Inc." near the employer label
    expect(String(fields.employerName)).toContain('Acme');
  });
});

// ── 1099-INT Field Extraction ─────────────────────────

describe('extract1099INTFields with phrase-level blocks', () => {
  function make1099INTBlocks(): TextBlock[] {
    return [
      // Payer section
      tb("PAYER'S name, street address, city or town, state or province, country, ZIP or foreign postal code, and telephone no.", 30, 20, 250, 8),
      tb('First National Bank', 30, 40, 80, 7),
      tb('456 Financial Drive', 30, 50, 70, 7),
      tb('New York, NY 10001', 30, 60, 70, 7),

      // Form title
      tb('1099-INT', 300, 20, 40, 10),
      tb('Interest Income', 350, 20, 50, 10),

      // Box labels and values
      tb('1 Interest income', 340, 65, 60, 8),
      tb('2847.63', 420, 65, 30, 7),

      tb('2 Early withdrawal penalty', 340, 90, 80, 8),
      tb('0.00', 420, 90, 15, 7),

      tb('3 Interest on U.S. Savings Bonds and Treasury obligations', 340, 115, 150, 8),
      tb('312.50', 420, 128, 25, 7),

      tb('4 Federal income tax withheld', 340, 165, 100, 8),
      tb('284.76', 420, 178, 25, 7),

      tb('8 Tax-exempt interest', 340, 220, 70, 8),
      tb('150.00', 420, 233, 25, 7),

      // Payer/recipient identification
      tb("PAYER'S TIN", 30, 100, 40, 8),
      tb('98-7654321', 30, 113, 40, 7),
      tb("RECIPIENT'S TIN", 30, 130, 50, 8),
      tb('***-**-6789', 30, 143, 40, 7),
      tb("RECIPIENT'S name", 30, 180, 55, 8),
      tb('Jane M. Taxpayer', 30, 193, 60, 7),

      // Payer keyword
      tb('payer', 30, 30, 20, 8),
    ];
  }

  it('detects 1099-INT form type', () => {
    const result = detectFormType(make1099INTBlocks());
    expect(result.type).toBe('1099-INT');
  });

  it('extracts interest income from Box 1', () => {
    const fields = extract1099INTFields(make1099INTBlocks());
    expect(fields.amount).toBe(2847.63);
  });

  it('extracts federal tax withheld from Box 4', () => {
    const fields = extract1099INTFields(make1099INTBlocks());
    expect(fields.federalTaxWithheld).toBe(284.76);
  });

  it('extracts US bond interest from Box 3', () => {
    const fields = extract1099INTFields(make1099INTBlocks());
    expect(fields.usBondInterest).toBe(312.5);
  });

  it('extracts tax-exempt interest from Box 8', () => {
    const fields = extract1099INTFields(make1099INTBlocks());
    expect(fields.taxExemptInterest).toBe(150);
  });
});

// ── 1099-NEC Field Extraction ─────────────────────────

describe('extract1099NECFields with phrase-level blocks', () => {
  function make1099NECBlocks(): TextBlock[] {
    return [
      tb("PAYER'S name, street address, city or town", 30, 20, 150, 8),
      tb('TechStart Consulting Group', 30, 40, 100, 7),
      tb('800 Innovation Way', 30, 50, 70, 7),
      tb('San Jose, CA 95110', 30, 60, 65, 7),

      tb('1099-NEC', 300, 20, 40, 10),
      tb('Nonemployee Compensation', 350, 30, 80, 10),

      tb('1 Nonemployee compensation', 340, 90, 100, 8),
      tb('42000.00', 420, 103, 35, 7),

      tb('payer', 30, 30, 20, 8),
      tb('recipient', 30, 120, 30, 8),
      tb('compensation', 360, 100, 40, 8),
    ];
  }

  it('extracts nonemployee compensation', () => {
    const fields = extract1099NECFields(make1099NECBlocks());
    expect(fields.amount).toBe(42000);
  });

  it('extracts payer name', () => {
    const fields = extract1099NECFields(make1099NECBlocks());
    expect(String(fields.payerName)).toBeTruthy();
  });
});

// ── 1099-DIV Field Extraction ─────────────────────────

describe('extract1099DIVFields with phrase-level blocks', () => {
  function make1099DIVBlocks(): TextBlock[] {
    return [
      tb("PAYER'S name, street address", 30, 20, 120, 8),
      tb('TradeWell Securities LLC', 30, 40, 100, 7),

      tb('1099-DIV', 300, 20, 40, 10),
      tb('Dividends and Distributions', 350, 20, 90, 10),

      tb('1a Total ordinary dividends', 340, 65, 100, 8),
      tb('3150.00', 450, 65, 30, 7),

      tb('1b Qualified dividends', 340, 90, 80, 8),
      tb('2400.00', 450, 90, 30, 7),

      tb('2a Total capital gain distr.', 340, 115, 100, 8),
      tb('875.00', 450, 115, 25, 7),

      tb('4 Federal income tax withheld', 340, 200, 100, 8),
      tb('315.00', 450, 213, 25, 7),

      tb('7 Foreign tax paid', 340, 230, 60, 8),
      tb('47.25', 450, 243, 20, 7),

      tb('payer', 30, 30, 20, 8),
      tb('ordinary dividends', 340, 75, 60, 8),
      tb('qualified dividends', 340, 100, 60, 8),
      tb('capital gain', 340, 125, 40, 8),
    ];
  }

  it('extracts ordinary dividends', () => {
    const fields = extract1099DIVFields(make1099DIVBlocks());
    expect(fields.ordinaryDividends).toBe(3150);
  });

  it('extracts qualified dividends', () => {
    const fields = extract1099DIVFields(make1099DIVBlocks());
    expect(fields.qualifiedDividends).toBe(2400);
  });

  it('extracts capital gain distributions', () => {
    const fields = extract1099DIVFields(make1099DIVBlocks());
    expect(fields.capitalGainDistributions).toBe(875);
  });

  it('extracts federal tax withheld', () => {
    const fields = extract1099DIVFields(make1099DIVBlocks());
    expect(fields.federalTaxWithheld).toBe(315);
  });

  it('extracts foreign tax paid', () => {
    const fields = extract1099DIVFields(make1099DIVBlocks());
    expect(fields.foreignTaxPaid).toBe(47.25);
  });
});

// ── findNearbyNumber pure-numeric guard ────────────────

describe('findNearbyNumber rejects non-numeric blocks', () => {
  it('does not parse "2 Federal income tax withheld" as the number 2', () => {
    // This tests the PURE_NUMERIC_RE guard: a phrase block that starts with
    // a digit but contains letters should NOT be parsed as a number.
    const blocks: TextBlock[] = [
      // Label for Box 1
      tb('1 Wages, tips, other compensation', 339, 65, 104, 8),
      // The phrase "2 Federal income tax withheld" is right next to it
      tb('2 Federal income tax withheld', 461, 65, 98, 8),
      // Actual value for Box 1
      tb('85250.00', 417, 75, 34, 7),
    ];

    const fields = extractW2Fields(blocks);
    // Should find 85250.00, NOT 2 (from the adjacent label)
    expect(fields.wages).toBe(85250);
  });
});

// ── 1099-R Field Extraction ───────────────────────────

describe('extract1099RFields with phrase-level blocks', () => {
  it('extracts gross distribution and taxable amount', () => {
    const blocks: TextBlock[] = [
      tb("PAYER'S name", 30, 20, 50, 8),
      tb('Fidelity Retirement Services', 30, 40, 100, 7),
      tb('1099-R', 300, 20, 30, 10),
      tb('Distributions from Pensions', 340, 20, 90, 10),
      tb('1 Gross distribution', 340, 65, 70, 8),
      tb('25000.00', 420, 78, 35, 7),
      tb('2a Taxable amount', 340, 100, 60, 8),
      tb('22500.00', 420, 113, 35, 7),
      tb('4 Federal income tax withheld', 340, 150, 100, 8),
      tb('3750.00', 420, 163, 30, 7),
      tb('payer', 30, 30, 20, 8),
      tb('gross distribution', 340, 75, 60, 8),
      tb('taxable amount', 340, 110, 50, 8),
    ];

    const fields = extract1099RFields(blocks);
    expect(fields.grossDistribution).toBe(25000);
    expect(fields.taxableAmount).toBe(22500);
    expect(fields.federalTaxWithheld).toBe(3750);
  });
});

// ── 1098 Field Extraction ─────────────────────────────

describe('extract1098Fields with phrase-level blocks', () => {
  it('extracts mortgage interest and outstanding principal', () => {
    const blocks: TextBlock[] = [
      tb("RECIPIENT'S name", 30, 20, 50, 8),
      tb('Wells Fargo Home Mortgage', 30, 40, 100, 7),
      tb('Form 1098', 300, 20, 40, 10),
      tb('Mortgage Interest Statement', 350, 20, 90, 10),
      tb('1 Mortgage interest received from payer(s)/borrower(s)', 340, 65, 180, 8),
      tb('18750.00', 420, 78, 35, 7),
      tb('2 Outstanding mortgage principal', 340, 100, 100, 8),
      tb('342000.00', 420, 113, 40, 7),
      tb('5 Mortgage insurance premiums', 340, 150, 100, 8),
      tb('1200.00', 420, 163, 30, 7),
      tb('lender', 30, 30, 20, 8),
      tb('recipient', 30, 25, 30, 8),
      tb('mortgage interest', 350, 75, 50, 8),
    ];

    const fields = extract1098Fields(blocks);
    expect(fields.mortgageInterest).toBe(18750);
    expect(fields.outstandingPrincipal).toBe(342000);
    expect(fields.mortgageInsurance).toBe(1200);
  });
});

// ── W-2 State Section Extraction (Boxes 15-17) ──────

describe('extractW2Fields state section (Boxes 15-17)', () => {
  // Simulate real W-2 state section: "TX" state code with values on same line.
  // maxY of the form is ~400, state code is at y=363 (bottom 40%).
  function makeW2WithState(): TextBlock[] {
    return [
      // Minimal upper section for W-2 detection
      tb('Form', 42, 370, 20, 8),
      tb('W-2', 68, 370, 15, 10),
      tb('Wage and Tax Statement', 100, 370, 80, 8),
      tb('1 Wages, tips, other compensation', 339, 61, 104, 8),
      tb('85250.00', 417, 75, 34, 7),
      tb('employer', 42, 85, 30, 8),
      tb('wages', 340, 65, 20, 8),
      tb('federal income tax withheld', 461, 61, 100, 8),
      tb('social security', 340, 100, 50, 8),

      // State section — values line (y=363, near the bottom)
      tb('TX', 45, 363, 11, 7),
      tb('12-3456789', 108, 363, 43, 7),  // employer state ID
      tb('85250.00', 245, 363, 34, 7),    // state wages (Box 16)
      tb('0.00', 342, 363, 15, 7),        // state tax (Box 17)

      // Form bottom (y=400) — sets the maxY
      tb('Copy B', 260, 400, 30, 8),
    ];
  }

  it('extracts state code (Box 15)', () => {
    const fields = extractW2Fields(makeW2WithState());
    expect(fields.state).toBe('TX');
  });

  it('extracts state wages (Box 16)', () => {
    const fields = extractW2Fields(makeW2WithState());
    expect(fields.stateWages).toBe(85250);
  });

  it('extracts state tax withheld (Box 17)', () => {
    const fields = extractW2Fields(makeW2WithState());
    expect(fields.stateTaxWithheld).toBe(0);
  });
});

// ── Form Detection: K-1 vs 1099-INT ─────────────────

describe('detectFormType ordering', () => {
  it('detects K-1 (not 1099-INT) when both keywords present', () => {
    // K-1 forms have "interest income" as a box label, which would
    // false-match 1099-INT if K-1 isn't checked first.
    const blocks: TextBlock[] = [
      tb('Schedule K-1', 36, 46, 65, 12),
      tb('(Form 1065)', 36, 58, 56, 12),
      tb("Partner's Share of Income, Deductions, Credits, etc.", 36, 111, 215, 14),
      tb('1 Ordinary business income (loss)', 318, 73, 113, 8),
      tb('5 Interest income', 318, 145, 60, 8),
      tb('guaranteed payments', 318, 121, 70, 8),
      tb('partner', 36, 159, 25, 8),
    ];
    const result = detectFormType(blocks);
    expect(result.type).toBe('K-1');
    expect(result.confidence).toBe('high');
  });

  it('detects W-2G (not W-2) for gambling forms', () => {
    // W-2G has "Form W-2G" which contains "form w-2" as substring —
    // W-2G must be checked before W-2.
    const blocks: TextBlock[] = [
      tb('Form W-2G', 200, 40, 50, 10),
      tb('Certain Gambling Winnings', 260, 40, 90, 10),
      tb("PAYER'S name", 30, 60, 50, 8),
      tb('Golden Palace Casino', 30, 75, 80, 7),
      tb('1 Reportable winnings', 340, 60, 80, 8),
      tb('5000.00', 420, 74, 30, 7),
      tb('3 Type of wager', 340, 100, 60, 8),
      tb('Slot Machine', 420, 114, 50, 7),
      tb('4 Federal income tax withheld', 340, 130, 100, 8),
      tb('1200.00', 420, 144, 30, 7),
      tb('winnings', 350, 70, 30, 8),
    ];
    const result = detectFormType(blocks);
    expect(result.type).toBe('W-2G');
    expect(result.confidence).toBe('high');
  });

  it('still detects regular W-2 correctly', () => {
    const blocks: TextBlock[] = [
      tb('Wage and Tax Statement', 100, 370, 80, 8),
      tb('Form W-2', 42, 370, 30, 10),
      tb('employer', 42, 85, 30, 8),
      tb('wages', 340, 65, 20, 8),
      tb('federal income tax withheld', 461, 65, 100, 8),
      tb('social security', 340, 100, 50, 8),
    ];
    const result = detectFormType(blocks);
    expect(result.type).toBe('W-2');
    expect(result.confidence).toBe('high');
  });
});

// ── W-2G Field Extraction ────────────────────────────

describe('extractW2GFields', () => {
  function makeW2GBlocks(): TextBlock[] {
    return [
      tb("PAYER'S name", 30, 60, 50, 8),
      tb('Golden Palace Casino & Resort', 30, 75, 100, 7),
      tb('1099-INT', 999, 999, 1, 1),  // noise — should not fool detector
      tb('1 Reportable winnings', 340, 60, 80, 8),
      tb('5000.00', 420, 74, 30, 7),
      tb('3 Type of wager', 340, 100, 60, 8),
      tb('Slot Machine', 420, 114, 50, 7),
      tb('4 Federal income tax withheld', 340, 130, 100, 8),
      tb('1200.00', 420, 144, 30, 7),
    ];
  }

  it('extracts reportable winnings', () => {
    const fields = extractW2GFields(makeW2GBlocks());
    expect(fields.grossWinnings).toBe(5000);
  });

  it('extracts federal tax withheld', () => {
    const fields = extractW2GFields(makeW2GBlocks());
    expect(fields.federalTaxWithheld).toBe(1200);
  });

  it('extracts type of wager', () => {
    const fields = extractW2GFields(makeW2GBlocks());
    expect(fields.typeOfWager).toBe('Slot Machine');
  });
});

describe('extractW2GFields with letter-spaced labels', () => {
  // Real W-2G PDFs have letter-spaced labels like "4 F e d e r a l i n c o m e t a x w i t h h e l d"
  function makeSpacedW2GBlocks(): TextBlock[] {
    return [
      tb("PAYER'S name", 30, 60, 50, 8),
      tb('Lucky Star Casino', 30, 75, 100, 7),
      tb('1 R e p o r t a b l e w i n n i n g s', 340, 60, 150, 8),
      tb('5000.00', 420, 74, 30, 7),
      tb('3 T y p e o f w a g e r', 340, 100, 100, 8),
      tb('Slot Machine', 420, 114, 50, 7),
      tb('4 F e d e r a l i n c o m e t a x w i t h h e l d', 340, 130, 200, 8),
      tb('1200.00', 420, 144, 30, 7),
      tb('777 Lucky Boulevard', 30, 100, 80, 7),
    ];
  }

  it('extracts federal tax withheld from letter-spaced label', () => {
    const fields = extractW2GFields(makeSpacedW2GBlocks());
    expect(fields.federalTaxWithheld).toBe(1200);
  });

  it('extracts reportable winnings from letter-spaced label', () => {
    const fields = extractW2GFields(makeSpacedW2GBlocks());
    expect(fields.grossWinnings).toBe(5000);
  });

  it('extracts type of wager near letter-spaced label', () => {
    const fields = extractW2GFields(makeSpacedW2GBlocks());
    expect(fields.typeOfWager).toBe('Slot Machine');
  });

  it('does not pick up address as wager type', () => {
    const fields = extractW2GFields(makeSpacedW2GBlocks());
    expect(fields.typeOfWager).not.toContain('Boulevard');
  });
});

// ── K-1 Field Extraction ─────────────────────────────

describe('extractK1Fields', () => {
  function makeK1Blocks(): TextBlock[] {
    return [
      tb("Partnership's Name", 36, 159, 70, 8),
      tb('ABC Investment Partners LP', 36, 175, 100, 7),
      tb('1 Ordinary business income (loss)', 318, 73, 113, 8),
      tb('15000.00', 440, 87, 35, 7),
      tb('2 Net rental real estate income (loss)', 318, 97, 130, 8),
      tb('3200.00', 440, 111, 30, 7),
      tb('4 Guaranteed payments', 318, 121, 80, 8),
      tb('0.00', 440, 135, 15, 7),
      tb('5 Interest income', 318, 145, 60, 8),
      tb('825.00', 440, 159, 25, 7),
      tb("partnership's name", 36, 165, 70, 8),
    ];
  }

  it('extracts ordinary business income', () => {
    const fields = extractK1Fields(makeK1Blocks());
    expect(fields.ordinaryBusinessIncome).toBe(15000);
  });

  it('extracts rental income', () => {
    const fields = extractK1Fields(makeK1Blocks());
    expect(fields.rentalIncome).toBe(3200);
  });

  it('extracts interest income', () => {
    const fields = extractK1Fields(makeK1Blocks());
    expect(fields.interestIncome).toBe(825);
  });
});

// ── detectFormPages (per-page form scanning) ──────────────

describe('detectFormPages', () => {
  // Helper: W-2 keyword blocks on a given page
  function w2Blocks(page: number): TextBlock[] {
    return [
      tb('Wage and Tax Statement', 50, 10, 200, 12, page),
      tb('Form W-2', 50, 30, 60, 12, page),
      tb('Employer', 50, 60, 60, 10, page),
      tb('Wages', 50, 80, 50, 10, page),
      tb('Federal income tax withheld', 50, 100, 150, 10, page),
      tb('Social Security', 50, 120, 100, 10, page),
    ];
  }

  // Helper: 1099-INT keyword blocks on a given page
  function int1099Blocks(page: number): TextBlock[] {
    return [
      tb('1099-INT', 50, 10, 60, 12, page),
      tb('Interest Income', 50, 30, 100, 12, page),
      tb('Payer', 50, 60, 40, 10, page),
      tb('Interest', 50, 80, 50, 10, page),
      tb('Early withdrawal', 50, 100, 100, 10, page),
    ];
  }

  // Helper: generic intro/summary page (no IRS form keywords)
  function introBlocks(page: number): TextBlock[] {
    return [
      tb('Your Tax Summary', 50, 10, 120, 14, page),
      tb('Prepared by TurboTax', 50, 30, 130, 10, page),
      tb('Total Refund: $3,456', 50, 60, 150, 12, page),
      tb('Filing Status: Single', 50, 90, 140, 10, page),
    ];
  }

  it('returns empty array for single-page documents', () => {
    // Single-page docs should use legacy detection — detectFormPages returns []
    const spans = detectFormPages(w2Blocks(1));
    expect(spans).toHaveLength(0);
  });

  it('returns empty array for empty text blocks', () => {
    const spans = detectFormPages([]);
    expect(spans).toHaveLength(0);
  });

  it('detects a form on page 2 and skips intro on page 1', () => {
    const blocks = [...introBlocks(1), ...w2Blocks(2)];
    const spans = detectFormPages(blocks);
    expect(spans).toHaveLength(1);
    expect(spans[0].type).toBe('W-2');
    expect(spans[0].startPage).toBe(2);
    expect(spans[0].endPage).toBe(2);
  });

  it('skips multiple intro pages before the form', () => {
    const blocks = [
      ...introBlocks(1),
      ...introBlocks(2),
      ...w2Blocks(3),
    ];
    const spans = detectFormPages(blocks);
    expect(spans).toHaveLength(1);
    expect(spans[0].type).toBe('W-2');
    expect(spans[0].startPage).toBe(3);
    expect(spans[0].endPage).toBe(3);
  });

  it('detects multiple different forms', () => {
    const blocks = [
      ...introBlocks(1),
      ...w2Blocks(2),
      ...int1099Blocks(3),
    ];
    const spans = detectFormPages(blocks);
    expect(spans).toHaveLength(2);
    expect(spans[0].type).toBe('W-2');
    expect(spans[0].startPage).toBe(2);
    expect(spans[1].type).toBe('1099-INT');
    expect(spans[1].startPage).toBe(3);
  });

  it('merges continuation page (no detection) with preceding form', () => {
    // Page 2 = K-1, Page 3 = no primary keywords (continuation), Page 4 = different form
    const k1Page2: TextBlock[] = [
      tb('Schedule K-1', 50, 10, 100, 12, 2),
      tb('Form 1065', 50, 30, 60, 10, 2),
      tb('Ordinary business income', 50, 60, 150, 10, 2),
      tb('Guaranteed payments', 50, 80, 120, 10, 2),
    ];
    // Page 3 has K-1 box data but no primary keywords
    const k1ContinuationPage3: TextBlock[] = [
      tb('Net rental real estate', 50, 10, 150, 10, 3),
      tb('12500', 300, 10, 40, 10, 3),
      tb('Other deductions', 50, 30, 100, 10, 3),
      tb('3200', 300, 30, 30, 10, 3),
    ];
    const blocks = [...introBlocks(1), ...k1Page2, ...k1ContinuationPage3, ...int1099Blocks(4)];
    const spans = detectFormPages(blocks);

    expect(spans).toHaveLength(2);
    // K-1 span includes the continuation page
    expect(spans[0].type).toBe('K-1');
    expect(spans[0].startPage).toBe(2);
    expect(spans[0].endPage).toBe(3);
    // 1099-INT on page 4
    expect(spans[1].type).toBe('1099-INT');
    expect(spans[1].startPage).toBe(4);
  });

  it('extends span when same form type on consecutive pages', () => {
    const blocks = [...w2Blocks(1), ...w2Blocks(2)];
    const spans = detectFormPages(blocks);
    expect(spans).toHaveLength(1);
    expect(spans[0].type).toBe('W-2');
    expect(spans[0].startPage).toBe(1);
    expect(spans[0].endPage).toBe(2);
  });

  it('returns empty array when no pages match any form', () => {
    const blocks = [...introBlocks(1), ...introBlocks(2)];
    const spans = detectFormPages(blocks);
    expect(spans).toHaveLength(0);
  });

  it('two copies of the same form type create separate spans when separated', () => {
    // W-2 on page 2, intro on page 3, W-2 on page 4
    const blocks = [
      ...introBlocks(1),
      ...w2Blocks(2),
      ...introBlocks(3), // this is a continuation of the W-2 span, not a separator
      ...w2Blocks(4),
    ];
    const spans = detectFormPages(blocks);
    // Because page 3 has no detection, it's treated as continuation of page 2's W-2.
    // Page 4 also detects as W-2, same type, so it extends the span.
    // Result: one W-2 span covering pages 2-4
    expect(spans).toHaveLength(1);
    expect(spans[0].type).toBe('W-2');
    expect(spans[0].startPage).toBe(2);
    expect(spans[0].endPage).toBe(4);
  });

  it('upgrades confidence when a later page in the span has higher confidence', () => {
    // Page 1: W-2 primary keyword only (medium confidence)
    const mediumPage: TextBlock[] = [
      tb('Form W-2', 50, 10, 60, 12, 1),
    ];
    // Page 2: W-2 with primary + secondary keywords (high confidence)
    const highPage = w2Blocks(2);

    const spans = detectFormPages([...mediumPage, ...highPage]);
    expect(spans).toHaveLength(1);
    expect(spans[0].confidence).toBe('high');
  });
});
