/**
 * IRS Form 8863 (2025) — AcroForm Field Mapping
 *
 * Education Credits (American Opportunity and Lifetime Learning Credits)
 * PDF: client/public/irs-forms/f8863.pdf (Form 8863, 2025)
 * Attachment Sequence No. 50
 * Total fields: 77 (text: 61, checkbox: 16)
 *
 * Structure:
 *   Page 1 — Parts I & II
 *     Header: f1_1 (name), SocialSecurity f1_2/f1_3/f1_4 (SSN 3-part)
 *     Part I — Refundable AOTC (Lines 1-8):
 *       f1_5 (L1), f1_6 (L2), f1_7 (L3), f1_8 (L4), f1_9 (L5),
 *       f1_10/f1_11 (L6 integer/decimal), c1_1 (L7 under-24 checkbox),
 *       f1_12 (L7), f1_13 (L8)
 *     Part II — Nonrefundable (Lines 9-19):
 *       f1_14 (L9), f1_15 (L10), f1_16 (L11), f1_17 (L12),
 *       f1_18 (L13), f1_19 (L14), f1_20 (L15), f1_21 (L16),
 *       f1_22/f1_23 (L17 integer/decimal), f1_24 (L18), f1_25 (L19)
 *
 *   Page 2 — Part III (one student per page; use additional copies for more)
 *     Header: f2_1 (name), SSN f2_2/f2_3/f2_4
 *     Line 20: f2-5 (student name — note dash, not underscore)
 *     Line 21: StudentSSN f2_6/f2_7/f2_8
 *     Line 22a (first institution): f2_9 (name), f2_10 (address),
 *       c2_1[0]/[1] (1098-T 2025 Y/N), c2_2[0]/[1] (1098-T 2024 box 7 Y/N),
 *       f2_11..f2_19 (EIN digits)
 *     Line 22b (second institution): f2_20 (name), f2_21 (address),
 *       c2_3[0]/[1], c2_4[0]/[1], f2_22..f2_30 (EIN digits)
 *     Lines 23-26: c2_5..c2_8 (Yes/No checkbox pairs)
 *     Lines 27-31: f2_31..f2_35
 *
 * Multi-instance: Page 2 holds one student. Instance 0 fills both pages;
 * instances 1+ fill only page 2 for subsequent students.
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult, EducationCreditInfo } from '../types/index.js';
import { FilingStatus } from '../types/index.js';
import { EDUCATION_CREDITS } from './tax2025.js';
import { parseDateString } from '../engine/utils.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';

// ─── Helpers ────────────────────────────────────────────────────

function ssnPart(ssn: string | undefined, part: 0 | 1 | 2): string {
  const digits = (ssn || '').replace(/\D/g, '');
  if (part === 0) return digits.substring(0, 3);
  if (part === 1) return digits.substring(3, 5);
  return digits.substring(5, 9);
}

function fmtDollar(n: number): string | undefined {
  const v = Math.round(n);
  return v > 0 ? String(v) : undefined;
}

/** For lines where IRS instructions say "enter -0-" instead of leaving blank. */
function fmtDollarOrZero(n: number): string {
  return String(Math.max(0, Math.round(n)));
}

function einDigit(ein: string | undefined, index: number): string | undefined {
  const digits = (ein || '').replace(/\D/g, '');
  return digits[index] || undefined;
}

function isMFJOrQSS(tr: TaxReturn): boolean {
  return tr.filingStatus === FilingStatus.MarriedFilingJointly ||
    tr.filingStatus === FilingStatus.QualifyingSurvivingSpouse;
}

/** Compute tentative AOTC per student (pre-phase-out, Form 8863 Part III Lines 27-30). */
function tentativeAOTC(qualifiedExpenses: number): number {
  const ec = EDUCATION_CREDITS;
  const adjExpenses = Math.min(qualifiedExpenses, 4000); // Line 27 cap
  let credit = Math.min(adjExpenses, ec.AOTC_FIRST_TIER); // first $2,000 at 100%
  credit += Math.min(Math.max(0, adjExpenses - ec.AOTC_FIRST_TIER), ec.AOTC_SECOND_TIER) * 0.25;
  return Math.min(credit, ec.AOTC_MAX);
}

/** Sum tentative AOTC across all AOTC students (Part I, Line 1). */
function totalTentativeAOTC(credits: EducationCreditInfo[]): number {
  let total = 0;
  for (const c of credits) {
    if (c.type !== 'american_opportunity') continue;
    const qe = Math.max(0, c.tuitionPaid - (c.scholarships || 0));
    total += tentativeAOTC(qe);
  }
  return total;
}

/** Sum qualified expenses across all LLC students (Part II, Line 10). */
function totalLLCExpenses(credits: EducationCreditInfo[]): number {
  let total = 0;
  for (const c of credits) {
    if (c.type !== 'lifetime_learning') continue;
    total += Math.max(0, c.tuitionPaid - (c.scholarships || 0));
  }
  return total;
}

/** Compute the phase-out ratio (Lines 6/17). Returns value between 0 and 1. */
function phaseOutRatio(agi: number, upperLimit: number, range: number): number {
  const diff = upperLimit - agi;
  if (diff <= 0) return 0;
  if (diff >= range) return 1;
  return diff / range;
}

/** Format a phase-out ratio: integer part (before decimal) */
function ratioInteger(ratio: number): string {
  return String(Math.floor(Math.min(ratio, 1)));
}

/** Format a phase-out ratio: decimal part (after decimal, 3 digits) */
function ratioDecimal(ratio: number): string {
  const clamped = Math.min(ratio, 1);
  const decimal = clamped - Math.floor(clamped);
  const scaled = Math.min(999, Math.round(decimal * 1000));
  return String(scaled).padStart(3, '0');
}

/** Form 8863 Line 7: Is the refundable AOTC excluded because filer is under 24,
 *  didn't provide half own support, and has a living parent (and isn't MFJ/QSS)? */
function isAotcRefundableExcluded(tr: TaxReturn): boolean {
  if (isMFJOrQSS(tr)) return false;
  if (!tr.dateOfBirth) return false;
  const dob = parseDateString(tr.dateOfBirth);
  if (!dob) return false;
  const yearEnd = tr.taxYear || 2025;
  if (yearEnd - dob.year >= 24) return false;
  const providedHalfSupport = tr.providedHalfOwnSupport ?? true;
  const hasLivingParent = tr.hasLivingParent ?? true;
  return !providedHalfSupport && hasLivingParent;
}

// ─── Page 1: Parts I & II ───────────────────────────────────────

function buildPage1Fields(tr: TaxReturn, calc: CalculationResult): IRSFieldMapping[] {
  const credits = tr.educationCredits || [];
  const mfj = isMFJOrQSS(tr);
  const agi = calc.form1040.agi;

  // AOTC phase-out values
  const aotcUpperLimit = mfj
    ? EDUCATION_CREDITS.AOTC_PHASE_OUT_MFJ + EDUCATION_CREDITS.AOTC_PHASE_OUT_RANGE_MFJ
    : EDUCATION_CREDITS.AOTC_PHASE_OUT_SINGLE + EDUCATION_CREDITS.AOTC_PHASE_OUT_RANGE_SINGLE;
  const aotcRange = mfj
    ? EDUCATION_CREDITS.AOTC_PHASE_OUT_RANGE_MFJ
    : EDUCATION_CREDITS.AOTC_PHASE_OUT_RANGE_SINGLE;

  // LLC phase-out values
  const llcUpperLimit = mfj
    ? EDUCATION_CREDITS.LLC_PHASE_OUT_MFJ + EDUCATION_CREDITS.LLC_PHASE_OUT_RANGE_MFJ
    : EDUCATION_CREDITS.LLC_PHASE_OUT_SINGLE + EDUCATION_CREDITS.LLC_PHASE_OUT_RANGE_SINGLE;
  const llcRange = mfj
    ? EDUCATION_CREDITS.LLC_PHASE_OUT_RANGE_MFJ
    : EDUCATION_CREDITS.LLC_PHASE_OUT_RANGE_SINGLE;

  // Part I calculations
  const line1 = totalTentativeAOTC(credits);
  const line2 = aotcUpperLimit;
  const line3 = agi;
  const line4 = Math.max(0, line2 - line3);
  const line5 = aotcRange;
  const line6 = line4 <= 0 ? 0 : phaseOutRatio(agi, aotcUpperLimit, aotcRange);
  const line7 = Math.round(line1 * line6);
  const line8 = Math.round(line7 * 0.40);

  // Part II calculations
  const line9 = line7 - line8;
  const line10 = totalLLCExpenses(credits);
  const line11 = Math.min(line10, 10000);
  const line12 = Math.round(line11 * 0.20);
  const line13 = llcUpperLimit;
  const line14 = agi;
  const line15 = Math.max(0, line13 - line14);
  const line16 = llcRange;
  const line17 = line15 <= 0 ? 0 : phaseOutRatio(agi, llcUpperLimit, llcRange);
  const line18 = Math.round(line12 * line17);

  const hasAOTC = credits.some(c => c.type === 'american_opportunity');
  const hasLLC = credits.some(c => c.type === 'lifetime_learning');

  const fields: IRSFieldMapping[] = [
    // ── Header ──
    {
      pdfFieldName: `${P1}.f1_1[0]`,
      formLabel: 'Name shown on return',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim() || undefined,
    },
    {
      pdfFieldName: `${P1}.SocialSecurity[0].f1_2[0]`,
      formLabel: 'SSN (first 3 digits)',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: (tr) => ssnPart(tr.ssn, 0),
    },
    {
      pdfFieldName: `${P1}.SocialSecurity[0].f1_3[0]`,
      formLabel: 'SSN (middle 2 digits)',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: (tr) => ssnPart(tr.ssn, 1),
    },
    {
      pdfFieldName: `${P1}.SocialSecurity[0].f1_4[0]`,
      formLabel: 'SSN (last 4 digits)',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: (tr) => ssnPart(tr.ssn, 2),
    },
  ];

  // ── Part I — Refundable American Opportunity Credit ──
  if (hasAOTC) {
    fields.push(
      // Line 1: Total tentative AOTC
      { pdfFieldName: `${P1}.f1_5[0]`, formLabel: 'Line 1: Tentative American opportunity credit', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line1) },
      // Line 2: Phase-out upper limit
      { pdfFieldName: `${P1}.f1_6[0]`, formLabel: 'Line 2: AOTC phase-out upper limit', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line2) },
      // Line 3: MAGI
      { pdfFieldName: `${P1}.f1_7[0]`, formLabel: 'Line 3: Modified adjusted gross income', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line3) },
      // Line 4: Line 2 - Line 3 (IRS: enter -0- if zero or less)
      { pdfFieldName: `${P1}.f1_8[0]`, formLabel: 'Line 4: Subtract line 3 from line 2', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollarOrZero(line4) },
      // Line 5: Phase-out range
      { pdfFieldName: `${P1}.f1_9[0]`, formLabel: 'Line 5: AOTC phase-out range', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line5) },
      // Line 6: Phase-out ratio (integer part)
      { pdfFieldName: `${P1}.f1_10[0]`, formLabel: 'Line 6: Phase-out ratio (integer)', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => line4 > 0 ? ratioInteger(line6) : undefined },
      // Line 6: Phase-out ratio (decimal part)
      { pdfFieldName: `${P1}.f1_11[0]`, formLabel: 'Line 6: Phase-out ratio (decimal)', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => line4 > 0 ? ratioDecimal(line6) : undefined },
      // Line 7 checkbox: Filer under 24, didn't provide half support, has living parent
      { pdfFieldName: `${P1}.c1_1[0]`, formLabel: 'Line 7: Under 24, did not provide half support, has living parent', sourcePath: '', source: 'taxReturn', format: 'checkbox',
        transform: (tr) => isAotcRefundableExcluded(tr) },
      // Line 7: Line 1 × Line 6
      { pdfFieldName: `${P1}.f1_12[0]`, formLabel: 'Line 7: Multiply line 1 by line 6', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line7) },
      // Line 8: Refundable AOTC (Line 7 × 40%, or $0 if Line 7 checkbox is checked)
      { pdfFieldName: `${P1}.f1_13[0]`, formLabel: 'Line 8: Refundable American opportunity credit', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: (tr) => fmtDollarOrZero(isAotcRefundableExcluded(tr) ? 0 : line8) },
    );
  }

  // ── Part II — Nonrefundable Education Credits ──
  // Line 9: Line 7 - Line 8 (when Line 7 checkbox is checked, Line 8 = 0, so Line 9 = Line 7)
  fields.push(
    { pdfFieldName: `${P1}.f1_14[0]`, formLabel: 'Line 9: Subtract line 8 from line 7', sourcePath: '', source: 'taxReturn', format: 'string',
      transform: (tr) => fmtDollar(isAotcRefundableExcluded(tr) ? line7 : line9) },
  );

  if (hasLLC) {
    fields.push(
      // Line 10: Total LLC qualified expenses
      { pdfFieldName: `${P1}.f1_15[0]`, formLabel: 'Line 10: Total lifetime learning expenses', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line10) },
      // Line 11: min(Line 10, $10,000)
      { pdfFieldName: `${P1}.f1_16[0]`, formLabel: 'Line 11: Enter the smaller of line 10 or $10,000', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line11) },
      // Line 12: Line 11 × 20%
      { pdfFieldName: `${P1}.f1_17[0]`, formLabel: 'Line 12: Multiply line 11 by 20%', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line12) },
      // Line 13: LLC phase-out upper limit
      { pdfFieldName: `${P1}.f1_18[0]`, formLabel: 'Line 13: LLC phase-out upper limit', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line13) },
      // Line 14: MAGI
      { pdfFieldName: `${P1}.f1_19[0]`, formLabel: 'Line 14: Modified adjusted gross income', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line14) },
      // Line 15: Line 13 - Line 14 (IRS: enter -0- if zero or less)
      { pdfFieldName: `${P1}.f1_20[0]`, formLabel: 'Line 15: Subtract line 14 from line 13', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollarOrZero(line15) },
      // Line 16: LLC phase-out range
      { pdfFieldName: `${P1}.f1_21[0]`, formLabel: 'Line 16: LLC phase-out range', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line16) },
      // Line 17: LLC phase-out ratio (integer)
      { pdfFieldName: `${P1}.f1_22[0]`, formLabel: 'Line 17: LLC phase-out ratio (integer)', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => line15 > 0 ? ratioInteger(line17) : undefined },
      // Line 17: LLC phase-out ratio (decimal)
      { pdfFieldName: `${P1}.f1_23[0]`, formLabel: 'Line 17: LLC phase-out ratio (decimal)', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => line15 > 0 ? ratioDecimal(line17) : undefined },
      // Line 18: Line 12 × Line 17
      { pdfFieldName: `${P1}.f1_24[0]`, formLabel: 'Line 18: Multiply line 12 by line 17', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line18) },
    );
  }

  // Line 19: Nonrefundable education credits (from Credit Limit Worksheet)
  fields.push(
    { pdfFieldName: `${P1}.f1_25[0]`, formLabel: 'Line 19: Nonrefundable education credits', sourcePath: '', source: 'calculationResult', format: 'string',
      transform: (_tr, calc) => fmtDollar(calc.credits.educationCredit) },
  );

  return fields;
}

// ─── Page 2: Part III (per student) ─────────────────────────────

function buildPage2Fields(
  studentIndex: number,
  tr: TaxReturn,
  _calc: CalculationResult,
): IRSFieldMapping[] {
  const credits = tr.educationCredits || [];
  const student = credits[studentIndex];
  if (!student) return [];

  const qe = Math.max(0, student.tuitionPaid - (student.scholarships || 0));
  const isAOTC = student.type === 'american_opportunity';

  const fields: IRSFieldMapping[] = [
    // ── Page 2 Header ──
    {
      pdfFieldName: `${P2}.f2_1[0]`,
      formLabel: 'Name shown on return (page 2)',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim() || undefined,
    },
    {
      pdfFieldName: `${P2}.SSN[0].f2_2[0]`,
      formLabel: 'SSN (first 3 digits, page 2)',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: (tr) => ssnPart(tr.ssn, 0),
    },
    {
      pdfFieldName: `${P2}.SSN[0].f2_3[0]`,
      formLabel: 'SSN (middle 2 digits, page 2)',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: (tr) => ssnPart(tr.ssn, 1),
    },
    {
      pdfFieldName: `${P2}.SSN[0].f2_4[0]`,
      formLabel: 'SSN (last 4 digits, page 2)',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: (tr) => ssnPart(tr.ssn, 2),
    },

    // ── Line 20: Student name ──
    {
      pdfFieldName: `${P2}.f2-5[0]`,  // Note: dash not underscore in PDF field name
      formLabel: 'Line 20: Student name',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => student.studentName || undefined,
    },

    // ── Line 21: Student SSN (3-part) ──
    {
      pdfFieldName: `${P2}.StudentSSN[0].f2_6[0]`,
      formLabel: 'Line 21: Student SSN (first 3 digits)',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => ssnPart(student.studentSSN, 0),
    },
    {
      pdfFieldName: `${P2}.StudentSSN[0].f2_7[0]`,
      formLabel: 'Line 21: Student SSN (middle 2 digits)',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => ssnPart(student.studentSSN, 1),
    },
    {
      pdfFieldName: `${P2}.StudentSSN[0].f2_8[0]`,
      formLabel: 'Line 21: Student SSN (last 4 digits)',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => ssnPart(student.studentSSN, 2),
    },

    // ── Line 22a: First educational institution ──
    {
      pdfFieldName: `${P2}.Line22a[0].f2_9[0]`,
      formLabel: 'Line 22a: Institution name',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => student.institution || undefined,
    },
    // Line 22a(1): Institution address
    {
      pdfFieldName: `${P2}.Line22a[0].f2_10[0]`,
      formLabel: 'Line 22a(1): Institution address',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => student.institutionAddress || undefined,
    },
    // Line 22a(2): Did student receive 1098-T for 2025?
    {
      pdfFieldName: `${P2}.Line22a[0].c2_1[${student.received1098T === false ? 1 : 0}]`,
      formLabel: 'Line 22a(2): Received 1098-T for 2025',
      sourcePath: '', source: 'taxReturn', format: 'checkbox',
      transform: () => student.received1098T !== undefined,
    },
    // Line 22a(3): Did 1098-T for 2024 have Box 7 checked?
    {
      pdfFieldName: `${P2}.Line22a[0].c2_2[${student.received1098TBox7 === false ? 1 : 0}]`,
      formLabel: 'Line 22a(3): 2024 1098-T Box 7 checked',
      sourcePath: '', source: 'taxReturn', format: 'checkbox',
      transform: () => student.received1098TBox7 !== undefined,
    },
    // Line 22a(4): Institution EIN (9 individual digit fields)
    ...Array.from({ length: 9 }, (_, i): IRSFieldMapping => ({
      pdfFieldName: `${P2}.Line22a[0].f2_${11 + i}[0]`,
      formLabel: `Line 22a(4): Institution EIN digit ${i + 1}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'string',
      transform: () => einDigit(student.institutionEIN, i),
    })),

    // ── Line 22b: Second educational institution ──
    ...(student.institution2 ? [
      {
        pdfFieldName: `${P2}.Line22b[0].f2_20[0]`,
        formLabel: 'Line 22b: Second institution name',
        sourcePath: '', source: 'taxReturn' as const, format: 'string' as const,
        transform: () => student.institution2 || undefined,
      },
      // Line 22b(1): Second institution address
      {
        pdfFieldName: `${P2}.Line22b[0].f2_21[0]`,
        formLabel: 'Line 22b(1): Second institution address',
        sourcePath: '', source: 'taxReturn' as const, format: 'string' as const,
        transform: () => student.institution2Address || undefined,
      },
      // Line 22b(2): Did student receive 1098-T from second institution?
      {
        pdfFieldName: `${P2}.Line22b[0].c2_3[${student.received1098T2 === false ? 1 : 0}]`,
        formLabel: 'Line 22b(2): Received 1098-T from second institution',
        sourcePath: '', source: 'taxReturn' as const, format: 'checkbox' as const,
        transform: () => student.received1098T2 !== undefined,
      },
      // Line 22b(3): Did 2024 1098-T from second institution have Box 7 checked?
      {
        pdfFieldName: `${P2}.Line22b[0].c2_4[${student.received1098T2Box7 === false ? 1 : 0}]`,
        formLabel: 'Line 22b(3): 2024 1098-T Box 7 checked (second institution)',
        sourcePath: '', source: 'taxReturn' as const, format: 'checkbox' as const,
        transform: () => student.received1098T2Box7 !== undefined,
      },
      // Line 22b(4): Second institution EIN (9 individual digit fields)
      ...Array.from({ length: 9 }, (_, i): IRSFieldMapping => ({
        pdfFieldName: `${P2}.Line22b[0].f2_${22 + i}[0]`,
        formLabel: `Line 22b(4): Second institution EIN digit ${i + 1}`,
        sourcePath: '',
        source: 'taxReturn',
        format: 'string',
        transform: () => einDigit(student.institution2EIN, i),
      })),
    ] as IRSFieldMapping[] : []),

    // ── Lines 23-26: AOTC eligibility questions (only filled for AOTC students) ──
    // Line 23: Has AOTC/Hope been claimed for this student for 4+ prior years?
    // Default: No (eligible) — [0] = Yes, [1] = No
    ...(isAOTC ? [{
      pdfFieldName: `${P2}.c2_5[${student.aotcClaimedPrior4Years ? 0 : 1}]`,
      formLabel: 'Line 23: AOTC claimed for 4+ prior years',
      sourcePath: '', source: 'taxReturn' as const, format: 'checkbox' as const,
      transform: () => true,
    }] as IRSFieldMapping[] : []),
    // Line 24: Was student enrolled at least half-time?
    // Default: Yes (eligible) — [0] = Yes, [1] = No
    ...(isAOTC ? [{
      pdfFieldName: `${P2}.c2_6[${(student.enrolledHalfTime ?? true) ? 0 : 1}]`,
      formLabel: 'Line 24: Student enrolled at least half-time',
      sourcePath: '', source: 'taxReturn' as const, format: 'checkbox' as const,
      transform: () => true,
    }] as IRSFieldMapping[] : []),
    // Line 25: Did student complete first 4 years of postsecondary education before 2025?
    // Default: No (eligible) — [0] = Yes, [1] = No
    ...(isAOTC ? [{
      pdfFieldName: `${P2}.c2_7[${student.completedFirst4Years ? 0 : 1}]`,
      formLabel: 'Line 25: Completed first 4 years before 2025',
      sourcePath: '', source: 'taxReturn' as const, format: 'checkbox' as const,
      transform: () => true,
    }] as IRSFieldMapping[] : []),
    // Line 26: Was student convicted of a felony drug offense before end of 2025?
    // Default: No (eligible) — [0] = Yes, [1] = No
    ...(isAOTC ? [{
      pdfFieldName: `${P2}.c2_8[${student.felonyDrugConviction ? 0 : 1}]`,
      formLabel: 'Line 26: Felony drug conviction',
      sourcePath: '', source: 'taxReturn' as const, format: 'checkbox' as const,
      transform: () => true,
    }] as IRSFieldMapping[] : []),
  ];

  if (isAOTC) {
    // ── American Opportunity Credit (Lines 27-30) ──
    const adjExpenses = Math.min(qe, 4000);
    const line28 = Math.max(0, adjExpenses - 2000);
    const line29 = Math.round(line28 * 0.25);
    const line30 = line28 === 0 ? adjExpenses : 2000 + line29;

    fields.push(
      // Line 27: Adjusted qualified education expenses (max $4,000)
      { pdfFieldName: `${P2}.f2_31[0]`, formLabel: 'Line 27: Adjusted qualified education expenses', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(adjExpenses) },
      // Line 28: Line 27 - $2,000
      { pdfFieldName: `${P2}.f2_32[0]`, formLabel: 'Line 28: Subtract $2,000 from line 27', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line28) },
      // Line 29: Line 28 × 25%
      { pdfFieldName: `${P2}.f2_33[0]`, formLabel: 'Line 29: Multiply line 28 by 25%', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line29) },
      // Line 30: Tentative AOTC
      { pdfFieldName: `${P2}.f2_34[0]`, formLabel: 'Line 30: Tentative American opportunity credit', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(line30) },
    );
  } else {
    // ── Lifetime Learning Credit (Line 31) ──
    fields.push(
      // Line 31: Adjusted qualified education expenses
      { pdfFieldName: `${P2}.f2_35[0]`, formLabel: 'Line 31: Adjusted qualified education expenses (LLC)', sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => fmtDollar(qe) },
    );
  }

  return fields;
}

// ─── Template ───────────────────────────────────────────────────

export const FORM_8863_FIELDS: IRSFieldMapping[] = [];

export const FORM_8863_TEMPLATE: IRSFormTemplate = {
  formId: 'f8863',
  displayName: 'Form 8863',
  attachmentSequence: 50,
  pdfFileName: 'f8863.pdf',

  condition: (tr, calc) =>
    (tr.educationCredits?.length ?? 0) > 0 &&
    ((calc.credits.educationCredit || 0) > 0 || (calc.credits.aotcRefundableCredit || 0) > 0),

  fields: FORM_8863_FIELDS,

  instanceCount: (tr: TaxReturn) => Math.max(1, (tr.educationCredits || []).length),

  fieldsForInstance: (
    index: number,
    tr: TaxReturn,
    calc: CalculationResult,
  ): IRSFieldMapping[] => {
    const fields: IRSFieldMapping[] = [];

    // Instance 0: Parts I & II (page 1) + Part III student 0 (page 2)
    // Instance 1+: Part III only (page 2) for subsequent students
    if (index === 0) {
      fields.push(...buildPage1Fields(tr, calc));
    }

    fields.push(...buildPage2Fields(index, tr, calc));
    return fields;
  },
};
