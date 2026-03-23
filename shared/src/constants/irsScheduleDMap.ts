/**
 * IRS Schedule D (Form 1040) 2025 — AcroForm Field Mapping
 *
 * Capital Gains and Losses
 * PDF: client/public/irs-forms/f1040sd.pdf (Schedule D, 2025, Created 10/6/25)
 * Attachment Sequence No. 12
 * Total fields: 55 (text: 49, checkbox: 6)
 *
 * Field prefix: topmostSubform[0].Page1[0] (page 1) / topmostSubform[0].Page2[0] (page 2)
 *
 * Page 1 field map:
 *   f1_1     = Name(s) shown on return
 *   f1_2     = SSN
 *   c1_1[0]  = Qualified opportunity fund — Yes
 *   c1_1[1]  = Qualified opportunity fund — No
 *
 *   Part I — Short-Term (Lines 1a–7):
 *   Table_PartI Row1a: f1_3(d), f1_4(e), f1_5(g), f1_6(h)   → Line 1a (basis reported, no adjustments)
 *   Table_PartI Row1b: f1_7(d), f1_8(e), f1_9(g), f1_10(h)  → Line 1b (Form 8949 Box A/G)
 *   Table_PartI Row2:  f1_11(d), f1_12(e), f1_13(g), f1_14(h) → Line 2 (Box B/H)
 *   Table_PartI Row3:  f1_15(d), f1_16(e), f1_17(g), f1_18(h) → Line 3 (Box C/I)
 *   f1_19 = Line 4 (Form 6252, 4684, 6781, 8824)
 *   f1_20 = Line 5 (K-1 short-term)
 *   f1_21 = Line 6 (ST capital loss carryover)
 *   f1_22 = Line 7 (net ST capital gain/loss)
 *
 *   Part II — Long-Term (Lines 8a–15):
 *   Table_PartII Row8a:  f1_23(d), f1_24(e), f1_25(g), f1_26(h) → Line 8a (basis reported, no adjustments)
 *   Table_PartII Row8b:  f1_27(d), f1_28(e), f1_29(g), f1_30(h) → Line 8b (Box D/J)
 *   Table_PartII Row9:   f1_31(d), f1_32(e), f1_33(g), f1_34(h) → Line 9 (Box E/K)
 *   Table_PartII Row10:  f1_35(d), f1_36(e), f1_37(g), f1_38(h) → Line 10 (Box F/L)
 *   f1_39 = Line 11 (Form 4797, 2439, 6252, 4684, 6781, 8824)
 *   f1_40 = Line 12 (K-1 long-term)
 *   f1_41 = Line 13 (capital gain distributions)
 *   f1_42 = Line 14 (LT capital loss carryover)
 *   f1_43 = Line 15 (net LT capital gain/loss)
 *
 * Page 2 — Part III Summary:
 *   f2_1     = Line 16 (combine lines 7 and 15)
 *   c2_1[0]  = Line 17 Yes (both lines 15 & 16 are gains)
 *   c2_1[1]  = Line 17 No
 *   f2_2     = Line 18 (28% rate gain)
 *   f2_3     = Line 19 (unrecaptured §1250 gain)
 *   c2_2[0]  = Line 20 Yes (lines 18 & 19 both zero/blank)
 *   c2_2[1]  = Line 20 No
 *   f2_4     = Line 21 (capital loss deduction)
 *   c2_3[0]  = Line 22 Yes (qualified dividends on line 3a)
 *   c2_3[1]  = Line 22 No
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult, Income1099B, Income1099DA } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';

// ─── Helpers ─────────────────────────────────────────────────────
// Aggregate 1099-B + 1099-DA transactions into Schedule D line categories.
// Line 1a/8a: basis reported to IRS, no adjustments (direct to Schedule D)
// Line 1b/8b: basis reported but with adjustments (Form 8949 Box A/D)
// Line 2/9: basis NOT reported (Form 8949 Box B/E)
// Line 3/10: no 1099-B received (Form 8949 Box C/F)
// For simplicity, we treat basisReportedToIRS === undefined as true (default for modern brokerages).

interface TransactionAgg {
  proceeds: number;
  costBasis: number;
  adjustments: number;
  gainLoss: number;
}

const EMPTY_AGG: TransactionAgg = { proceeds: 0, costBasis: 0, adjustments: 0, gainLoss: 0 };

function aggregateTransactions(tr: TaxReturn): {
  stLine1a: TransactionAgg; // ST, basis reported, no adjustments
  stLine1b: TransactionAgg; // ST, Form 8949 Box A (with adjustments)
  stLine2: TransactionAgg;  // ST, basis NOT reported (Box B)
  ltLine8a: TransactionAgg; // LT, basis reported, no adjustments
  ltLine8b: TransactionAgg; // LT, Form 8949 Box D (with adjustments)
  ltLine9: TransactionAgg;  // LT, basis NOT reported (Box E)
} {
  const result = {
    stLine1a: { ...EMPTY_AGG },
    stLine1b: { ...EMPTY_AGG },
    stLine2: { ...EMPTY_AGG },
    ltLine8a: { ...EMPTY_AGG },
    ltLine8b: { ...EMPTY_AGG },
    ltLine9: { ...EMPTY_AGG },
  };

  const all1099B: Income1099B[] = tr.income1099B || [];
  for (const t of all1099B) {
    const basisReported = t.basisReportedToIRS !== false; // default true
    const hasAdjustments = (t.washSaleLossDisallowed || 0) !== 0;
    const gainLoss = (t.proceeds - t.costBasis) + (t.washSaleLossDisallowed || 0);
    const entry = {
      proceeds: t.proceeds,
      costBasis: t.costBasis,
      adjustments: t.washSaleLossDisallowed || 0,
      gainLoss,
    };

    if (!t.isLongTerm) {
      if (basisReported && !hasAdjustments) {
        addTo(result.stLine1a, entry);
      } else if (basisReported) {
        addTo(result.stLine1b, entry);
      } else {
        addTo(result.stLine2, entry);
      }
    } else {
      if (basisReported && !hasAdjustments) {
        addTo(result.ltLine8a, entry);
      } else if (basisReported) {
        addTo(result.ltLine8b, entry);
      } else {
        addTo(result.ltLine9, entry);
      }
    }
  }

  // 1099-DA (digital assets) — treated as covered securities for TY2025
  const all1099DA: Income1099DA[] = (tr as unknown as Record<string, unknown>).income1099DA as Income1099DA[] || [];
  for (const t of all1099DA) {
    const basisReported = t.isBasisReportedToIRS !== false;
    const hasAdjustments = (t.washSaleLossDisallowed || 0) !== 0;
    const gainLoss = (t.proceeds - t.costBasis) + (t.washSaleLossDisallowed || 0);
    const entry = {
      proceeds: t.proceeds,
      costBasis: t.costBasis,
      adjustments: t.washSaleLossDisallowed || 0,
      gainLoss,
    };

    if (!t.isLongTerm) {
      if (basisReported && !hasAdjustments) {
        addTo(result.stLine1a, entry);
      } else if (basisReported) {
        addTo(result.stLine1b, entry);
      } else {
        addTo(result.stLine2, entry);
      }
    } else {
      if (basisReported && !hasAdjustments) {
        addTo(result.ltLine8a, entry);
      } else if (basisReported) {
        addTo(result.ltLine8b, entry);
      } else {
        addTo(result.ltLine9, entry);
      }
    }
  }

  return result;
}

function addTo(target: TransactionAgg, entry: TransactionAgg): void {
  target.proceeds += entry.proceeds;
  target.costBasis += entry.costBasis;
  target.adjustments += entry.adjustments;
  target.gainLoss += entry.gainLoss;
}

function fmtDollar(v: number): string {
  return v && !isNaN(v) ? Math.round(v).toString() : '';
}

export const SCHEDULE_D_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════
  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name(s) shown on return',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim(),
  },
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // Qualified opportunity fund — No (default)
  {
    pdfFieldName: `${P1}.c1_1[1]`,
    formLabel: 'Qualified Opportunity Fund investment: No',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => true,
  },

  // ══════════════════════════════════════════════════════════════
  // Part I — Short-Term Capital Gains and Losses
  // ══════════════════════════════════════════════════════════════

  // Line 1a: Totals for ST transactions with basis reported, no adjustments
  // (d) Proceeds
  {
    pdfFieldName: `${P1}.Table_PartI[0].Row1a[0].f1_3[0]`,
    formLabel: 'Line 1a(d): ST proceeds (basis reported, no adjustments)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).stLine1a.proceeds),
  },
  // (e) Cost
  {
    pdfFieldName: `${P1}.Table_PartI[0].Row1a[0].f1_4[0]`,
    formLabel: 'Line 1a(e): ST cost or other basis (basis reported, no adjustments)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).stLine1a.costBasis),
  },
  // (g) Adjustments — blank for line 1a (no adjustments by definition)
  // (h) Gain or loss
  {
    pdfFieldName: `${P1}.Table_PartI[0].Row1a[0].f1_6[0]`,
    formLabel: 'Line 1a(h): ST gain or loss (basis reported, no adjustments)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).stLine1a.gainLoss),
  },

  // Line 1b: ST transactions reported on Form 8949 Box A (basis reported, with adjustments)
  {
    pdfFieldName: `${P1}.Table_PartI[0].Row1b[0].f1_7[0]`,
    formLabel: 'Line 1b(d): ST proceeds (Form 8949 Box A)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).stLine1b.proceeds),
  },
  {
    pdfFieldName: `${P1}.Table_PartI[0].Row1b[0].f1_8[0]`,
    formLabel: 'Line 1b(e): ST cost or other basis (Form 8949 Box A)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).stLine1b.costBasis),
  },
  {
    pdfFieldName: `${P1}.Table_PartI[0].Row1b[0].f1_9[0]`,
    formLabel: 'Line 1b(g): ST adjustments (Form 8949 Box A)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).stLine1b.adjustments),
  },
  {
    pdfFieldName: `${P1}.Table_PartI[0].Row1b[0].f1_10[0]`,
    formLabel: 'Line 1b(h): ST gain or loss (Form 8949 Box A)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).stLine1b.gainLoss),
  },

  // Line 2: ST transactions Box B (basis NOT reported to IRS)
  {
    pdfFieldName: `${P1}.Table_PartI[0].Row2[0].f1_11[0]`,
    formLabel: 'Line 2(d): ST proceeds (basis not reported, Box B)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).stLine2.proceeds),
  },
  {
    pdfFieldName: `${P1}.Table_PartI[0].Row2[0].f1_12[0]`,
    formLabel: 'Line 2(e): ST cost or other basis (basis not reported, Box B)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).stLine2.costBasis),
  },
  {
    pdfFieldName: `${P1}.Table_PartI[0].Row2[0].f1_13[0]`,
    formLabel: 'Line 2(g): ST adjustments (basis not reported, Box B)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).stLine2.adjustments),
  },
  {
    pdfFieldName: `${P1}.Table_PartI[0].Row2[0].f1_14[0]`,
    formLabel: 'Line 2(h): ST gain or loss (basis not reported, Box B)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).stLine2.gainLoss),
  },

  // Line 3: ST transactions Box C (no 1099-B) — typically empty
  // Lines 3 fields (Row3) left unmapped — rare case

  // Line 4: Short-term gain from Form 6252 and Forms 4684, 6781, 8824
  // Currently not computed by engine — left blank

  // Line 5: Net ST gain/loss from partnerships, S corporations, K-1
  {
    pdfFieldName: `${P1}.f1_20[0]`,
    formLabel: 'Line 5: Net ST gain/loss from partnerships, S corps, K-1',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // K-1 short-term capital gains flow through the engine
      // Check form1040 for K-1 capital gain that's short-term
      return '';  // K-1 ST capital gains not separately tracked in current engine
    },
  },

  // Line 6: Short-term capital loss carryover from prior year
  {
    pdfFieldName: `${P1}.f1_21[0]`,
    formLabel: 'Line 6: Short-term capital loss carryover',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const v = tr.capitalLossCarryforwardST || 0;
      return v ? `(${Math.round(Math.abs(v))})` : '';
    },
  },

  // Line 7: Net short-term capital gain or (loss)
  {
    pdfFieldName: `${P1}.f1_22[0]`,
    formLabel: 'Line 7: Net short-term capital gain or (loss)',
    sourcePath: 'scheduleD.netShortTerm',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // ══════════════════════════════════════════════════════════════
  // Part II — Long-Term Capital Gains and Losses
  // ══════════════════════════════════════════════════════════════

  // Line 8a: Totals for LT transactions with basis reported, no adjustments
  {
    pdfFieldName: `${P1}.Table_PartII[0].Row8a[0].f1_23[0]`,
    formLabel: 'Line 8a(d): LT proceeds (basis reported, no adjustments)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).ltLine8a.proceeds),
  },
  {
    pdfFieldName: `${P1}.Table_PartII[0].Row8a[0].f1_24[0]`,
    formLabel: 'Line 8a(e): LT cost or other basis (basis reported, no adjustments)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).ltLine8a.costBasis),
  },
  {
    pdfFieldName: `${P1}.Table_PartII[0].Row8a[0].f1_26[0]`,
    formLabel: 'Line 8a(h): LT gain or loss (basis reported, no adjustments)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).ltLine8a.gainLoss),
  },

  // Line 8b: LT transactions Form 8949 Box D (basis reported, with adjustments)
  {
    pdfFieldName: `${P1}.Table_PartII[0].Row8b[0].f1_27[0]`,
    formLabel: 'Line 8b(d): LT proceeds (Form 8949 Box D)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).ltLine8b.proceeds),
  },
  {
    pdfFieldName: `${P1}.Table_PartII[0].Row8b[0].f1_28[0]`,
    formLabel: 'Line 8b(e): LT cost or other basis (Form 8949 Box D)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).ltLine8b.costBasis),
  },
  {
    pdfFieldName: `${P1}.Table_PartII[0].Row8b[0].f1_29[0]`,
    formLabel: 'Line 8b(g): LT adjustments (Form 8949 Box D)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).ltLine8b.adjustments),
  },
  {
    pdfFieldName: `${P1}.Table_PartII[0].Row8b[0].f1_30[0]`,
    formLabel: 'Line 8b(h): LT gain or loss (Form 8949 Box D)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).ltLine8b.gainLoss),
  },

  // Line 9: LT transactions Box E (basis NOT reported)
  {
    pdfFieldName: `${P1}.Table_PartII[0].Row9[0].f1_31[0]`,
    formLabel: 'Line 9(d): LT proceeds (basis not reported, Box E)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).ltLine9.proceeds),
  },
  {
    pdfFieldName: `${P1}.Table_PartII[0].Row9[0].f1_32[0]`,
    formLabel: 'Line 9(e): LT cost or other basis (basis not reported, Box E)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).ltLine9.costBasis),
  },
  {
    pdfFieldName: `${P1}.Table_PartII[0].Row9[0].f1_33[0]`,
    formLabel: 'Line 9(g): LT adjustments (basis not reported, Box E)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).ltLine9.adjustments),
  },
  {
    pdfFieldName: `${P1}.Table_PartII[0].Row9[0].f1_34[0]`,
    formLabel: 'Line 9(h): LT gain or loss (basis not reported, Box E)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(aggregateTransactions(tr).ltLine9.gainLoss),
  },

  // Line 10: LT transactions Box F (no 1099-B) — typically empty

  // Line 11: Gain from Form 4797, Part I
  {
    pdfFieldName: `${P1}.f1_39[0]`,
    formLabel: 'Line 11: Gain from Form 4797, Part I (section 1231)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // §1231 gain that's treated as LTCG flows to Schedule D line 11
      const r = calc.form4797;
      if (r && r.section1231IsGain && r.netSection1231GainOrLoss > 0) {
        return fmtDollar(r.netSection1231GainOrLoss);
      }
      return '';
    },
  },

  // Line 12: Net LT gain/loss from partnerships, K-1
  // K-1 LT capital gains not separately tracked — left blank

  // Line 13: Capital gain distributions (1099-DIV Box 2a)
  {
    pdfFieldName: `${P1}.f1_41[0]`,
    formLabel: 'Line 13: Capital gain distributions',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const divs = tr.income1099DIV || [];
      const total = divs.reduce((sum: number, d) =>
        sum + ((d as unknown as Record<string, number>).capitalGainDistributions || 0), 0);
      return fmtDollar(total);
    },
  },

  // Line 14: Long-term capital loss carryover from prior year
  {
    pdfFieldName: `${P1}.f1_42[0]`,
    formLabel: 'Line 14: Long-term capital loss carryover',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const v = tr.capitalLossCarryforwardLT || 0;
      return v ? `(${Math.round(Math.abs(v))})` : '';
    },
  },

  // Line 15: Net long-term capital gain or (loss)
  {
    pdfFieldName: `${P1}.f1_43[0]`,
    formLabel: 'Line 15: Net long-term capital gain or (loss)',
    sourcePath: 'scheduleD.netLongTerm',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // ══════════════════════════════════════════════════════════════
  // Page 2 — Part III Summary (Lines 16-22)
  // ══════════════════════════════════════════════════════════════

  // Line 16: Combine lines 7 and 15
  {
    pdfFieldName: `${P2}.f2_1[0]`,
    formLabel: 'Line 16: Combine lines 7 and 15',
    sourcePath: 'scheduleD.netGainOrLoss',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 17: Are lines 15 and 16 both gains?
  // Yes
  {
    pdfFieldName: `${P2}.c2_1[0]`,
    formLabel: 'Line 17: Are lines 15 and 16 both gains: Yes',
    sourcePath: '',
    source: 'calculationResult',
    format: 'checkbox',
    transform: (_tr, calc) => {
      const d = calc.scheduleD;
      if (!d) return false;
      return d.netLongTerm > 0 && d.netGainOrLoss > 0;
    },
  },
  // No
  {
    pdfFieldName: `${P2}.c2_1[1]`,
    formLabel: 'Line 17: Are lines 15 and 16 both gains: No',
    sourcePath: '',
    source: 'calculationResult',
    format: 'checkbox',
    transform: (_tr, calc) => {
      const d = calc.scheduleD;
      if (!d) return false;
      return !(d.netLongTerm > 0 && d.netGainOrLoss > 0);
    },
  },

  // Line 18: 28% Rate Gain (collectibles, §1202 exclusion)
  // Currently not computed separately — leave blank for MVP

  // Line 19: Unrecaptured Section 1250 Gain
  {
    pdfFieldName: `${P2}.f2_3[0]`,
    formLabel: 'Line 19: Unrecaptured section 1250 gain',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // From Form 4797 or direct unrecaptured §1250 on TaxReturn
      const v = calc.form4797?.unrecapturedSection1250Gain || 0;
      return fmtDollar(v);
    },
  },

  // Line 20: Are lines 18 and 19 both zero or blank?
  // Yes
  {
    pdfFieldName: `${P2}.c2_2[0]`,
    formLabel: 'Line 20: Are lines 18 and 19 both zero or blank: Yes',
    sourcePath: '',
    source: 'calculationResult',
    format: 'checkbox',
    transform: (_tr, calc) => {
      const s1250 = calc.form4797?.unrecapturedSection1250Gain || 0;
      return s1250 === 0; // Line 18 (28% rate) is always 0 for MVP
    },
  },
  // No
  {
    pdfFieldName: `${P2}.c2_2[1]`,
    formLabel: 'Line 20: Are lines 18 and 19 both zero or blank: No',
    sourcePath: '',
    source: 'calculationResult',
    format: 'checkbox',
    transform: (_tr, calc) => {
      const s1250 = calc.form4797?.unrecapturedSection1250Gain || 0;
      return s1250 !== 0;
    },
  },

  // Line 21: Capital loss deduction (smaller of loss on line 16 or $3,000/$1,500)
  {
    pdfFieldName: `${P2}.f2_4[0]`,
    formLabel: 'Line 21: Capital loss deduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleD?.capitalLossDeduction || 0;
      return v ? `(${Math.round(Math.abs(v))})` : '';
    },
  },

  // Line 22: Do you have qualified dividends on Form 1040 line 3a?
  // Yes
  {
    pdfFieldName: `${P2}.c2_3[0]`,
    formLabel: 'Line 22: Qualified dividends on Form 1040, line 3a: Yes',
    sourcePath: '',
    source: 'calculationResult',
    format: 'checkbox',
    transform: (_tr, calc) => (calc.form1040?.qualifiedDividends || 0) > 0,
  },
  // No
  {
    pdfFieldName: `${P2}.c2_3[1]`,
    formLabel: 'Line 22: Qualified dividends on Form 1040, line 3a: No',
    sourcePath: '',
    source: 'calculationResult',
    format: 'checkbox',
    transform: (_tr, calc) => (calc.form1040?.qualifiedDividends || 0) === 0,
  },
];

export const SCHEDULE_D_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040sd',
  displayName: 'Schedule D',
  attachmentSequence: 12,
  pdfFileName: 'f1040sd.pdf',
  condition: (tr: TaxReturn, calc: CalculationResult) => {
    const has1099B = (tr.income1099B?.length ?? 0) > 0;
    const has1099DA = ((tr as unknown as Record<string, unknown>).income1099DA as unknown[] || []).length > 0;
    const hasCarryforward = (tr.capitalLossCarryforwardST || 0) !== 0 ||
      (tr.capitalLossCarryforwardLT || 0) !== 0;
    const hasCapGains = (calc.scheduleD?.netGainOrLoss ?? 0) !== 0;
    const hasForm4797 = calc.form4797 != null && calc.form4797.section1231IsGain;
    return has1099B || has1099DA || hasCarryforward || hasCapGains || hasForm4797 === true;
  },
  fields: SCHEDULE_D_FIELDS,
};
