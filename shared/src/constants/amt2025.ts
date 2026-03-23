/**
 * Alternative Minimum Tax (AMT) Constants — Tax Year 2025
 *
 * @authority
 *   IRC: Section 55 — Alternative Minimum Tax imposed
 *   IRC: Section 56 — Adjustments in computing AMTI
 *   IRC: Section 57 — Items of tax preference
 *   IRC: Section 58 — Denial of certain losses
 *   Form: Form 6251
 *   Rev Proc 2024-40 — 2025 inflation-adjusted amounts
 */

export const AMT_2025 = {
  // Exemption amounts (Section 55(d)(1))
  EXEMPTION: {
    SINGLE: 88_100,
    MFJ: 137_000,  // Married Filing Jointly / Qualifying Surviving Spouse
    MFS: 68_500,   // Married Filing Separately
    HOH: 88_100,   // Head of Household (same as single)
  },

  // Phase-out thresholds — exemption reduced by 25% of AMTI over this amount
  // (Section 55(d)(3)) — Rev. Proc. 2024-40 §3.02
  PHASE_OUT: {
    SINGLE: 626_350,
    MFJ: 1_252_700,
    MFS: 626_350,
    HOH: 626_350,
  },

  // AMT tax rates (Section 55(b)(1))
  RATES: {
    LOW: 0.26,     // 26% on first portion
    HIGH: 0.28,    // 28% on excess
  },

  // Threshold where 28% rate begins
  RATE_THRESHOLD: {
    SINGLE: 239_100,
    MFJ: 239_100,  // Same for all filing statuses in 2025
    MFS: 119_550,  // Half for MFS
    HOH: 239_100,
  },

  // Child under 18 (or 24 if student) exemption for kiddie tax AMT
  CHILD_UNEARNED_INCOME_AMT_THRESHOLD: 2_900,
} as const;
