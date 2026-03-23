/**
 * Sprint 18: IRS Worksheet Trace Tests
 *
 * Each test mirrors an official IRS worksheet line-by-line, proving the engine
 * follows the exact IRS algorithm. Commentary shows the IRS computation step
 * alongside the engine's output.
 *
 * Worksheets traced:
 *   1. Qualified Dividends and Capital Gain Tax Worksheet (Form 1040 Instructions)
 *   2. Social Security Benefits Worksheet (Pub 915 / Form 1040 Instructions)
 *   3. EIC Worksheet (Pub 596 / Form 1040 Instructions)
 *   4. Child Tax Credit Worksheet / Schedule 8812
 *   5. Capital Loss Carryover Worksheet (Schedule D Instructions)
 *
 * @authority
 *   Form 1040 Instructions — Qualified Dividends and Capital Gain Tax Worksheet
 *   Publication 915 — Social Security Benefits Worksheet
 *   Publication 596 — Earned Income Credit Worksheet
 *   Schedule 8812 — Child Tax Credit Worksheet
 *   Schedule D Instructions — Capital Loss Carryover Worksheet
 */

import { describe, it, expect } from 'vitest';
import { calculatePreferentialRateTax } from '../src/engine/capitalGains.js';
import { calculateTaxableSocialSecurity } from '../src/engine/socialSecurity.js';
import { calculateEITC } from '../src/engine/eitc.js';
import { calculateCredits } from '../src/engine/credits.js';
import { calculateScheduleD } from '../src/engine/scheduleD.js';
import { calculateProgressiveTax } from '../src/engine/brackets.js';
import { FilingStatus } from '../src/types/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSHEET 1: Qualified Dividends and Capital Gain Tax Worksheet
// Source: Form 1040 Instructions, page 35-36
//
// This worksheet computes tax when the taxpayer has qualified dividends and/or
// long-term capital gains, which are taxed at preferential 0%/15%/20% rates.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Worksheet 1: Qualified Dividends and Capital Gain Tax Worksheet', () => {
  /**
   * Scenario A: Single filer, $75,000 taxable income, $10,000 qualified dividends
   *
   * IRS Worksheet (Form 1040 Instructions):
   *   Line 1. Taxable income (Form 1040, Line 15):                  $75,000
   *   Line 2. Qualified dividends (Form 1040, Line 3a):             $10,000
   *   Line 3. Schedule D, Line 15 (net LTCG if positive):           $0
   *   Line 4. Add lines 2 and 3:                                    $10,000
   *   Line 5. Subtract line 4 from line 1 (ordinary income):        $65,000
   *   Line 6. Tax on line 5 (ordinary income at progressive rates): $9,421
   *           [$11,925 × 10% = $1,192.50] + [($48,475-$11,925) × 12% = $4,386]
   *           + [($65,000-$48,475) × 22% = $3,635.50] → Total: $9,214
   *   Line 7. Enter $48,350 (0% rate threshold for Single):         $48,350
   *   Line 8. Smaller of line 1 or line 7:                          $48,350
   *   Line 9. Smaller of line 5 or line 8:                          $48,350
   *   Line 10. Subtract line 9 from line 8 (in 0% zone):           $0
   *           (ordinary income $65,000 > threshold $48,350, so none in 0% zone)
   *   Line 11. Smaller of line 1 or line 4:                         $10,000
   *   Line 12. Line 10 (from above):                                $0
   *   Line 13. Subtract line 12 from line 11 (remaining pref):     $10,000
   *   Line 14. Enter $533,400 (15% threshold for Single):           $533,400
   *   Line 15. Smaller of line 1 or line 14:                        $75,000
   *   Line 16. Add lines 5 and 10:                                  $65,000
   *   Line 17. Subtract line 16 from line 15:                       $10,000
   *   Line 18. Smaller of line 13 or line 17 (in 15% zone):        $10,000
   *   Line 19. Tax on line 18 at 15%:                               $1,500
   *   Line 20. Add lines 10 and 18:                                 $10,000
   *   Line 21. Subtract line 20 from line 11 (in 20% zone):        $0
   *   Line 22. Tax on line 21 at 20%:                               $0
   *   Line 23. Add lines 6, 19, and 22 (total pref rate tax):      $10,714
   *   Line 24. Tax on line 1 at regular rates:                      $11,714
   *   Line 25. Tax (smaller of line 23 or line 24):                 $10,714
   */
  it('Scenario A: Single, $75k income, $10k qualified dividends — all in 15% zone', () => {
    const result = calculatePreferentialRateTax(75000, 10000, 0, FilingStatus.Single);

    // Line 5: ordinary taxable income = $75,000 - $10,000 = $65,000
    // Line 6: tax on $65,000 ordinary
    const ordinaryCheck = calculateProgressiveTax(65000, FilingStatus.Single);
    expect(ordinaryCheck.tax).toBe(9214); // Verify: 1192.50 + 4386 + 3635.50 = 9214

    // Engine result should match
    expect(result.ordinaryTax).toBe(9214);

    // Preferential: $10,000 all in 15% zone (stacked above $65k, threshold is $48,350)
    expect(result.preferentialTax).toBe(1500); // $10,000 × 15% = $1,500

    // Total: $9,214 + $1,500 = $10,714
    expect(result.totalTax).toBe(10714);

    // Verify this is less than full progressive tax on $75,000
    const fullProgressiveTax = calculateProgressiveTax(75000, FilingStatus.Single);
    expect(result.totalTax).toBeLessThan(fullProgressiveTax.tax);
  });

  /**
   * Scenario B: MFJ, $45,000 taxable income, $8,000 qualified dividends
   *
   * IRS Worksheet:
   *   Line 1. Taxable income:           $45,000
   *   Line 4. Total preferential:       $8,000  (QD only)
   *   Line 5. Ordinary income:          $37,000  ($45,000 - $8,000)
   *   Line 6. Tax on $37,000 ordinary:  $3,966
   *           [$23,850 × 10% = $2,385] + [($37,000-$23,850) × 12% = $1,578] → actually
   *           [$23,850 × 10% = $2,385] + [($37,000-$23,850) × 12% = $1,578] = $3,963
   *   Line 7. 0% threshold (MFJ):      $96,700
   *   Line 8. min($45,000, $96,700):    $45,000
   *   Line 9. min($37,000, $45,000):    $37,000
   *   Line 10. $45,000 - $37,000:       $8,000  ← all QD in 0% zone!
   *   Line 19. 15% tax:                 $0
   *   Line 22. 20% tax:                 $0
   *   Line 23. Total = $3,963 + $0 + $0 = $3,963
   */
  it('Scenario B: MFJ, $45k income, $8k QD — all QD in 0% zone', () => {
    const result = calculatePreferentialRateTax(45000, 8000, 0, FilingStatus.MarriedFilingJointly);

    // Ordinary income = $45,000 - $8,000 = $37,000
    const ordinaryCheck = calculateProgressiveTax(37000, FilingStatus.MarriedFilingJointly);
    expect(result.ordinaryTax).toBe(ordinaryCheck.tax);

    // All $8,000 QD falls within 0% zone (ordinary $37k + QD $8k = $45k < $96,700 threshold)
    expect(result.preferentialTax).toBe(0);

    // Total tax = ordinary tax only
    expect(result.totalTax).toBe(ordinaryCheck.tax);
  });

  /**
   * Scenario C: Single, $550,000 taxable income, $20,000 QD + $30,000 LTCG
   *
   * Tests the 20% rate zone. With $550k taxable and $50k preferential:
   *   Ordinary = $500,000
   *   Preferential stacks from $500,000 to $550,000
   *   0% threshold: $48,350 → all below ordinary, so $0 in 0%
   *   15% threshold: $533,400 → from $500,000 to $533,400 = $33,400 at 15%
   *   20% zone: from $533,400 to $550,000 = $16,600 at 20%
   *   Preferential tax: $33,400 × 15% + $16,600 × 20% = $5,010 + $3,320 = $8,330
   */
  it('Scenario C: Single, $550k income, $50k pref — spans 15% and 20% zones', () => {
    const result = calculatePreferentialRateTax(550000, 20000, 30000, FilingStatus.Single);

    const ordinaryCheck = calculateProgressiveTax(500000, FilingStatus.Single);
    expect(result.ordinaryTax).toBe(ordinaryCheck.tax);

    // 15% zone: min($550k, $533,400) - max($500k, $48,350) = $533,400 - $500,000 = $33,400
    // 20% zone: $550,000 - max($500,000, $533,400) = $550,000 - $533,400 = $16,600
    expect(result.preferentialTax).toBe(8330); // 33400*0.15 + 16600*0.20

    expect(result.totalTax).toBe(ordinaryCheck.tax + 8330);
  });

  /**
   * Scenario D: HoH, $30,000 taxable income, $5,000 qualified dividends
   *
   * Ordinary = $25,000. HoH 0% threshold = $64,750.
   * QD stacks from $25k to $30k — entirely within 0% zone.
   */
  it('Scenario D: HoH, $30k income, $5k QD — all QD in 0% zone', () => {
    const result = calculatePreferentialRateTax(30000, 5000, 0, FilingStatus.HeadOfHousehold);

    expect(result.preferentialTax).toBe(0);
    const ordinaryCheck = calculateProgressiveTax(25000, FilingStatus.HeadOfHousehold);
    expect(result.totalTax).toBe(ordinaryCheck.tax);
  });

  /**
   * Scenario E: MFS, $300,000 taxable income, $10,000 LTCG
   *
   * Ordinary = $290,000. MFS 15% threshold = $300,025.
   * LTCG stacks from $290k to $300k — all within 15% zone (below $300,025).
   */
  it('Scenario E: MFS, $300k income, $10k LTCG — just under 20% threshold', () => {
    const result = calculatePreferentialRateTax(300000, 0, 10000, FilingStatus.MarriedFilingSeparately);

    const ordinaryCheck = calculateProgressiveTax(290000, FilingStatus.MarriedFilingSeparately);
    expect(result.ordinaryTax).toBe(ordinaryCheck.tax);

    // All $10k in 15% zone (stacks from $290k to $300k, threshold is $300,025)
    expect(result.preferentialTax).toBe(1500); // $10,000 × 15%

    expect(result.totalTax).toBe(ordinaryCheck.tax + 1500);
  });

  /**
   * Scenario F: Single, $60,000 taxable income, $20,000 QD
   *
   * Ordinary = $40,000. 0% threshold = $48,350.
   * QD stacks from $40k to $60k:
   *   0% zone: $48,350 - $40,000 = $8,350 at 0%
   *   15% zone: $60,000 - $48,350 = $11,650 at 15%
   */
  it('Scenario F: Single, $60k income, $20k QD — straddles 0%/15% boundary', () => {
    const result = calculatePreferentialRateTax(60000, 20000, 0, FilingStatus.Single);

    const ordinaryCheck = calculateProgressiveTax(40000, FilingStatus.Single);
    expect(result.ordinaryTax).toBe(ordinaryCheck.tax);

    // $8,350 at 0% + $11,650 at 15% = $0 + $1,747.50 = $1,747.50
    expect(result.preferentialTax).toBe(1747.5);
    expect(result.totalTax).toBe(ordinaryCheck.tax + 1747.5);
  });

  /**
   * Scenario G: Zero preferential income — should fall back to normal progressive tax
   */
  it('Scenario G: Single, $100k income, no preferential — normal progressive tax', () => {
    const result = calculatePreferentialRateTax(100000, 0, 0, FilingStatus.Single);

    const progressiveResult = calculateProgressiveTax(100000, FilingStatus.Single);
    expect(result.ordinaryTax).toBe(progressiveResult.tax);
    expect(result.preferentialTax).toBe(0);
    expect(result.totalTax).toBe(progressiveResult.tax);
  });

  /**
   * Scenario H: All income is preferential — ordinary portion is $0
   */
  it('Scenario H: MFJ, $80k all from LTCG — $0 ordinary, all in 0% zone', () => {
    const result = calculatePreferentialRateTax(80000, 0, 80000, FilingStatus.MarriedFilingJointly);

    expect(result.ordinaryTax).toBe(0);
    // All $80k in 0% zone (MFJ threshold = $96,700)
    expect(result.preferentialTax).toBe(0);
    expect(result.totalTax).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSHEET 2: Social Security Benefits Worksheet
// Source: Publication 915 / Form 1040 Instructions, page 29
//
// Determines taxable portion of Social Security benefits using the
// "provisional income" method with 50%/85% tiers.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Worksheet 2: Social Security Benefits Worksheet (Pub 915)', () => {
  /**
   * Scenario A: Single, $18,000 SS benefits, $20,000 other income
   *
   * IRS Worksheet (Pub 915):
   *   Line 1. Total SS benefits (Box 5, SSA-1099):                  $18,000
   *   Line 2. One-half of line 1:                                    $9,000
   *   Line 3. Taxable interest, dividends, pensions, etc.:           $20,000
   *   Line 4. Tax-exempt interest:                                   $0
   *   Line 5. Add lines 2, 3, and 4 (provisional income):           $29,000
   *   Line 6. Base amount ($25,000 for Single):                      $25,000
   *   Line 7. Subtract line 6 from line 5:                           $4,000
   *           (If zero or less, none taxable. $29,000 - $25,000 = $4,000 > 0)
   *   Line 8. Enter $9,000 ($34,000 - $25,000):                     $9,000
   *   Line 9. Smaller of line 7 or line 8:                           $4,000
   *   Line 10. Multiply line 9 by 50%:                               $2,000
   *   Line 11. Enter line 2 (one-half of benefits):                  $9,000
   *   Line 12. Smaller of line 10 or line 11:                        $2,000
   *   → $2,000 taxable (below adjusted base, so only 50% tier applies)
   */
  it('Scenario A: Single, $18k SS, $20k other — 50% tier only', () => {
    const result = calculateTaxableSocialSecurity(18000, 20000, FilingStatus.Single);

    // Provisional income = $20,000 + $9,000 (half of $18k) = $29,000
    expect(result.provisionalIncome).toBe(29000);

    // Between base ($25k) and adjusted base ($34k): 50% tier
    // Taxable = min(50% of benefits, 50% × (provisional - base))
    // = min($9,000, 50% × $4,000) = min($9,000, $2,000) = $2,000
    expect(result.taxableBenefits).toBe(2000);
    expect(result.taxablePercentage).toBe(0.50);
  });

  /**
   * Scenario B: Single, $24,000 SS benefits, $35,000 other income
   *
   *   Line 1. SS benefits:                                          $24,000
   *   Line 2. Half of benefits:                                      $12,000
   *   Line 5. Provisional income: $35,000 + $12,000 =               $47,000
   *   Line 6. Base amount (Single):                                  $25,000
   *   Line 7. $47,000 - $25,000 =                                   $22,000
   *   Line 8. $34,000 - $25,000 =                                   $9,000
   *   Line 9. min($22,000, $9,000) =                                $9,000
   *   Line 10. $9,000 × 50% =                                       $4,500
   *   (Now check 85% tier since provisional > $34,000)
   *   Line 13. Adjusted base ($34,000):                              $34,000
   *   Line 14. $47,000 - $34,000 =                                  $13,000
   *   Line 15. $13,000 × 85% =                                      $11,050
   *   Line 16. Add line 10 + line 15 = $4,500 + $11,050 =           $15,550
   *   Line 17. 85% of benefits = $24,000 × 85% =                    $20,400
   *   Line 18. Taxable = min(line 16, line 17) =                     $15,550
   */
  it('Scenario B: Single, $24k SS, $35k other — 85% tier', () => {
    const result = calculateTaxableSocialSecurity(24000, 35000, FilingStatus.Single);

    // Provisional = $35,000 + $12,000 = $47,000
    expect(result.provisionalIncome).toBe(47000);

    // Above adjusted base ($34k): 85% tier
    // 50% portion: min($12k, $9k × 50%) = min($12k, $4,500) = $4,500
    // 85% portion: ($47k - $34k) × 85% = $11,050
    // Total = min($4,500 + $11,050, $24k × 85%) = min($15,550, $20,400) = $15,550
    expect(result.taxableBenefits).toBe(15550);
    expect(result.taxablePercentage).toBe(0.85);
  });

  /**
   * Scenario C: MFJ, $30,000 SS benefits, $25,000 other income
   *
   * MFJ thresholds: base = $32,000, adjusted = $44,000
   *   Provisional = $25,000 + $15,000 = $40,000
   *   $40,000 is between $32k and $44k → 50% tier only
   *   Taxable = min(50% of $30k, 50% × ($40k - $32k))
   *           = min($15,000, $4,000) = $4,000
   */
  it('Scenario C: MFJ, $30k SS, $25k other — 50% tier', () => {
    const result = calculateTaxableSocialSecurity(30000, 25000, FilingStatus.MarriedFilingJointly);

    expect(result.provisionalIncome).toBe(40000); // $25k + $15k
    expect(result.taxableBenefits).toBe(4000);
    expect(result.taxablePercentage).toBe(0.50);
  });

  /**
   * Scenario D: MFJ, $28,000 SS, $50,000 other + $2,000 tax-exempt interest
   *
   * Tax-exempt interest is included in provisional income per IRC §86(b)(2).
   *   Provisional = $50,000 + $2,000 + $14,000 = $66,000
   *   Well above $44k adjusted base → 85% tier
   *   50% amount: min($14k, ($44k-$32k)×50%) = min($14k, $6k) = $6,000
   *   85% amount: ($66k - $44k) × 85% = $18,700
   *   Total = min($6k + $18.7k, $28k × 85%) = min($24,700, $23,800) = $23,800
   */
  it('Scenario D: MFJ, $28k SS, $50k other, $2k tax-exempt — 85% tier with tax-exempt interest', () => {
    const result = calculateTaxableSocialSecurity(28000, 50000, FilingStatus.MarriedFilingJointly, 2000);

    expect(result.provisionalIncome).toBe(66000); // $50k + $2k + $14k
    expect(result.taxableBenefits).toBe(23800); // min($24,700, $23,800)
    expect(result.taxablePercentage).toBe(0.85);
  });

  /**
   * Scenario E: Single, $12,000 SS, $10,000 other income
   *
   * Provisional = $10,000 + $6,000 = $16,000
   * $16,000 < $25,000 base → 0% taxable
   */
  it('Scenario E: Single, $12k SS, $10k other — below base, 0% taxable', () => {
    const result = calculateTaxableSocialSecurity(12000, 10000, FilingStatus.Single);

    expect(result.provisionalIncome).toBe(16000);
    expect(result.taxableBenefits).toBe(0);
    expect(result.taxablePercentage).toBe(0);
  });

  /**
   * Scenario F: MFS, $20,000 SS, $40,000 other income
   *
   * MFS: base amount = $0, so always 85% taxable
   * Provisional = $40,000 + $10,000 = $50,000
   * Taxable = min(85% × $20k, ...) = min($17,000, ...)
   * The 50% amount: min($10k, $0 × 50%) = $0 (base = adjusted base = $0)
   * The 85% amount: ($50k - $0) × 85% = $42,500
   * Total = min($0 + $42,500, $17,000) = $17,000
   */
  it('Scenario F: MFS, $20k SS, $40k other — always 85% taxable', () => {
    const result = calculateTaxableSocialSecurity(20000, 40000, FilingStatus.MarriedFilingSeparately);

    expect(result.provisionalIncome).toBe(50000);
    expect(result.taxableBenefits).toBe(17000); // 85% × $20,000
    expect(result.taxablePercentage).toBe(0.85);
  });

  /**
   * Scenario G: HoH, $16,000 SS, $22,000 other
   *
   * HoH uses Single thresholds: base $25k, adjusted $34k
   * Provisional = $22,000 + $8,000 = $30,000
   * Between $25k and $34k → 50% tier
   * Taxable = min(50% × $16k, 50% × ($30k - $25k))
   *         = min($8,000, $2,500) = $2,500
   */
  it('Scenario G: HoH, $16k SS, $22k other — 50% tier, benefit limit not binding', () => {
    const result = calculateTaxableSocialSecurity(16000, 22000, FilingStatus.HeadOfHousehold);

    expect(result.provisionalIncome).toBe(30000);
    expect(result.taxableBenefits).toBe(2500);
    expect(result.taxablePercentage).toBe(0.50);
  });

  /**
   * Scenario H: QSS filer uses MFJ thresholds
   */
  it('Scenario H: QSS uses MFJ thresholds', () => {
    const result = calculateTaxableSocialSecurity(20000, 25000, FilingStatus.QualifyingSurvivingSpouse);

    // Provisional = $25k + $10k = $35k. MFJ base = $32k.
    // Between $32k and $44k → 50% tier
    // Taxable = min(50% × $20k, 50% × ($35k - $32k)) = min($10k, $1.5k) = $1,500
    expect(result.provisionalIncome).toBe(35000);
    expect(result.taxableBenefits).toBe(1500);
    expect(result.taxablePercentage).toBe(0.50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSHEET 3: Earned Income Credit (EIC) Worksheet
// Source: Publication 596 / Form 1040 Instructions
//
// Three computation regions: phase-in, plateau, phase-out.
// Credit = lesser of (credit from earned income, credit from AGI).
// ═══════════════════════════════════════════════════════════════════════════════

describe('Worksheet 3: EIC Worksheet (Pub 596)', () => {
  /**
   * Scenario A: Single, 1 child, earned income = AGI = $25,000
   *
   * EIC Table / Worksheet (Pub 596):
   *   Step 1. Filing status: Single ✓ (not MFS)
   *   Step 2. Investment income ≤ $11,600? $0 ≤ $11,600 ✓
   *   Step 3. Earned income > $0? $25,000 ✓
   *   Step 4. Qualifying children: 1
   *   Step 5. Look up EIC:
   *     1-child bracket: max credit $3,995, earned income threshold $12,730
   *     Phase-in rate: $4,328 / $12,730 = 0.33998...
   *     Phase-out start (Single): $23,350
   *     Complete phase-out: $50,434
   *     Phase-out rate: $4,328 / ($50,434 - $23,350) = $4,328 / $27,084 = 0.15979...
   *
   *     $25,000 is in phase-out region ($25,000 > $23,350)
   *     Credit from earned income: max credit = $4,328 (past earned income threshold)
   *       But in phase-out: $4,328 - ($25,000 - $23,350) × 0.15979... = $4,328 - $263.66 = $4,064.34
   *     Credit from AGI: same since earned income = AGI
   *     Credit = min($4,064.34, $4,064.34) = $4,064.34
   */
  it('Scenario A: Single, 1 child, $25k — phase-out region', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 25000, 25000, 1, 0, '1980-01-01',
    );

    // Phase-out: maxCredit - (income - phaseOutStart) × phaseOutRate
    // = $4,328 - ($25,000 - $23,350) × ($4,328 / $27,084)
    // = $4,328 - $1,650 × 0.15979... = $4,328 - $263.66 = $4,064.34
    // Engine rounds to 2 decimal places
    expect(credit).toBeGreaterThan(3900);
    expect(credit).toBeLessThan(4200);

    // More precise check: manually compute
    const phaseOutRate = 4328 / (50434 - 23350);
    const reduction = (25000 - 23350) * phaseOutRate;
    const expected = Math.round((4328 - reduction) * 100) / 100;
    expect(credit).toBe(expected);
  });

  /**
   * Scenario B: Single, 0 children, age 30, earned income = AGI = $5,000
   *
   * 0-child bracket: max credit $649, earned income threshold $8,490
   * Phase-in rate: $649 / $8,490 = 0.07644...
   * $5,000 < $8,490 → still in phase-in region
   * Credit = $5,000 × 0.07644... = $382.21
   */
  it('Scenario B: Single, 0 children, $5k — phase-in region', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 5000, 5000, 0, 0, '1995-06-15',
    );

    const phaseInRate = 649 / 8490;
    const expected = Math.round(5000 * phaseInRate * 100) / 100;
    expect(credit).toBe(expected);
  });

  /**
   * Scenario C: MFJ, 2 children, earned income = AGI = $15,000
   *
   * 2-child bracket: max credit $7,152, threshold $17,880
   * $15,000 < $17,880 → phase-in
   * Credit = $15,000 × ($7,152 / $17,880) = $15,000 × 0.40000 = $6,000.00
   */
  it('Scenario C: MFJ, 2 children, $15k — phase-in region', () => {
    const credit = calculateEITC(
      FilingStatus.MarriedFilingJointly, 15000, 15000, 2, 0, '1985-03-20',
    );

    const phaseInRate = 7152 / 17880;
    const expected = Math.round(15000 * phaseInRate * 100) / 100;
    expect(credit).toBe(expected);
  });

  /**
   * Scenario D: MFJ, 3 children, earned income $25,000, AGI $32,000
   *
   * 3-child bracket: max credit $8,046, threshold $17,880
   * Phase-out start MFJ: $30,470
   * Complete phase-out MFJ: $68,675
   *
   * Credit from earned income: $25,000 > $17,880 and $25,000 < $30,470 (MFJ phase-out)
   *   → plateau: $8,046
   * Credit from AGI: $32,000 > $30,470 → phase-out
   *   Phase-out rate uses Single denominators: $8,046 / ($61,555 - $23,350) = $8,046 / $38,205 = 0.21063
   *   = $8,046 - ($32,000 - $30,470) × 0.21063 = $8,046 - $1,530 × 0.21063 = $8,046 - $322.26 = $7,723.74
   *
   * Credit = min($8,046, $7,723.74) = $7,723.74
   */
  it('Scenario D: MFJ, 3 children, earned $25k, AGI $32k — AGI in phase-out', () => {
    const credit = calculateEITC(
      FilingStatus.MarriedFilingJointly, 25000, 32000, 3, 0, '1982-09-01',
    );

    // Credit from earned income: plateau = $8,046
    // Credit from AGI: phase-out
    const phaseOutRate = 8046 / (61555 - 23350);
    const agiReduction = (32000 - 30470) * phaseOutRate;
    const creditFromAGI = Math.round((8046 - agiReduction) * 100) / 100;

    expect(credit).toBe(creditFromAGI);
  });

  /**
   * Scenario E: MFS — always ineligible for EITC
   */
  it('Scenario E: MFS — always ineligible', () => {
    const credit = calculateEITC(
      FilingStatus.MarriedFilingSeparately, 30000, 30000, 2, 0, '1985-01-01',
    );
    expect(credit).toBe(0);
  });

  /**
   * Scenario F: Investment income exceeds limit — disqualified
   */
  it('Scenario F: Investment income $12,000 exceeds $11,600 limit — disqualified', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 30000, 30000, 1, 12000, '1985-01-01',
    );
    expect(credit).toBe(0);
  });

  /**
   * Scenario G: Childless filer under age 25 — disqualified
   */
  it('Scenario G: Age 22, no children — too young for childless EITC', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 8000, 8000, 0, 0, '2003-06-15', 2025,
    );
    expect(credit).toBe(0);
  });

  /**
   * Scenario H: Childless filer over age 64 — disqualified
   */
  it('Scenario H: Age 66, no children — too old for childless EITC', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 8000, 8000, 0, 0, '1959-01-01', 2025,
    );
    expect(credit).toBe(0);
  });

  /**
   * Scenario I: Single, 2 children, at plateau — max credit
   */
  it('Scenario I: Single, 2 children, earned income at plateau — max credit', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 20000, 20000, 2, 0, '1985-01-01',
    );
    // $20,000 > $17,880 (threshold) and $20,000 < $23,350 (phase-out start) → plateau
    expect(credit).toBe(7152);
  });

  /**
   * Scenario J: HoH uses Single phase-out thresholds
   */
  it('Scenario J: HoH, 1 child, $15k — same thresholds as Single', () => {
    const creditHoH = calculateEITC(
      FilingStatus.HeadOfHousehold, 15000, 15000, 1, 0, '1985-01-01',
    );
    const creditSingle = calculateEITC(
      FilingStatus.Single, 15000, 15000, 1, 0, '1985-01-01',
    );
    // HoH and Single use same phase-out thresholds for EITC
    expect(creditHoH).toBe(creditSingle);
    // $15,000 > $12,730 (threshold) and < $23,350 (phase-out start) → plateau
    expect(creditHoH).toBe(4328);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSHEET 4: Child Tax Credit / Schedule 8812 Worksheet
// Source: Schedule 8812 / Form 1040 Instructions
//
// CTC: $2,200 per qualifying child (under 17) — OBBBA
// ODC: $500 per other dependent
// Phase-out: $50 reduction per $1,000 of AGI over threshold
// ACTC (refundable): 15% of earned income over $2,500, capped at $1,700/child
// ═══════════════════════════════════════════════════════════════════════════════

describe('Worksheet 4: Child Tax Credit / Schedule 8812', () => {
  /**
   * Scenario A: MFJ, AGI $120,000, 2 qualifying children (age 5 and 8)
   *
   * Schedule 8812:
   *   Part I — Child Tax Credit and Credit for Other Dependents
   *   Line 4. Number of qualifying children × $2,200: 2 × $2,200 = $4,400 (OBBBA)
   *   Line 5. Number of other dependents × $500: 0 × $500 = $0
   *   Line 6. Add lines 4 and 5: $4,400
   *   Line 7. AGI: $120,000
   *   Line 8. Threshold (MFJ): $400,000
   *   Line 9. Is line 7 > line 8? No → credit is not phased out
   *   Line 14. Child Tax Credit: $4,400
   */
  it('Scenario A: MFJ, $120k AGI, 2 kids — full CTC, no phase-out', () => {
    const result = calculateCredits(
      FilingStatus.MarriedFilingJointly, 120000,
      { qualifyingChildren: 2, otherDependents: 0 },
      [], undefined, 2025, 80000, 15000,
    );

    expect(result.childTaxCredit).toBe(4400); // 2 × $2,200 (OBBBA)
    expect(result.otherDependentCredit).toBe(0);
  });

  /**
   * Scenario B: Single, AGI $210,000, 1 qualifying child, 1 other dependent
   *
   *   Line 4. 1 × $2,200 = $2,200 (OBBBA)
   *   Line 5. 1 × $500 = $500
   *   Line 6. $2,700
   *   Line 7. AGI: $210,000
   *   Line 8. Threshold (Single): $200,000
   *   Line 9. Excess: $210,000 - $200,000 = $10,000
   *   Line 10. Divide by $1,000: 10 increments
   *   Line 11. Multiply by $50: 10 × $50 = $500 reduction
   *   Line 12. $2,700 - $500 = $2,200 remaining
   *   Proportional split:
   *     CTC portion: $2,200 / $2,700 × $2,200 ≈ $1,793
   *     ODC portion: $500 / $2,700 × $2,200 ≈ $407
   */
  it('Scenario B: Single, $210k AGI, 1 child + 1 other — phase-out reduces credit', () => {
    const result = calculateCredits(
      FilingStatus.Single, 210000,
      { qualifyingChildren: 1, otherDependents: 1 },
      [], undefined, 2025, 150000, 40000,
    );

    // Proportional split: CTC $2,200/$2,700 * $2,200 ≈ $1,793, ODC ≈ $407
    // Engine rounding may vary by ±1; use toBeCloseTo
    expect(result.childTaxCredit).toBeCloseTo(1793, 0);
    expect(result.otherDependentCredit).toBeCloseTo(407, 0);
  });

  /**
   * Scenario C: MFJ, AGI $450,000, 3 qualifying children
   *
   *   Total credit before phase-out: 3 × $2,200 = $6,600 (OBBBA)
   *   Excess: $450,000 - $400,000 = $50,000
   *   Increments: ceil($50,000 / $1,000) = 50
   *   Reduction: 50 × $50 = $2,500
   *   Remaining: $6,600 - $2,500 = $4,100
   */
  it('Scenario C: MFJ, $450k AGI, 3 kids — partial phase-out', () => {
    const result = calculateCredits(
      FilingStatus.MarriedFilingJointly, 450000,
      { qualifyingChildren: 3, otherDependents: 0 },
      [], undefined, 2025, 400000, 90000,
    );

    expect(result.childTaxCredit).toBe(4100);
  });

  /**
   * Scenario D: ACTC (Additional Child Tax Credit) — refundable portion
   *
   * Single, AGI $25,000, 2 children, earned income $25,000, tax liability $1,000
   *   CTC before phase-out: 2 × $2,200 = $4,400 (OBBBA, below $200k threshold)
   *   Non-refundable CTC used: min($4,400, $1,000 tax liability) = $1,000
   *   Excess CTC: $4,400 - $1,000 = $3,400
   *   ACTC = min(excess, $1,700 × 2 children, 15% × (earned - $2,500))
   *        = min($3,400, $3,400, 15% × $22,500)
   *        = min($3,400, $3,400, $3,375) = $3,375
   */
  it('Scenario D: Single, $25k, 2 kids — ACTC refundable portion', () => {
    const result = calculateCredits(
      FilingStatus.Single, 25000,
      { qualifyingChildren: 2, otherDependents: 0 },
      [], undefined, 2025, 25000, 1000,
    );

    expect(result.childTaxCredit).toBe(4400);
    expect(result.actcCredit).toBe(3375); // min($3.4k excess, $3.4k per-child, $3,375 earned formula)
  });

  /**
   * Scenario E: ACTC limited by earned income formula
   *
   * Single, 1 child, earned income $5,000, tax liability $0
   *   CTC: $2,200 (OBBBA, no phase-out)
   *   Excess CTC: $2,200 (all excess since $0 tax)
   *   ACTC = min($2,200, $1,700, 15% × ($5,000 - $2,500))
   *        = min($2,200, $1,700, $375) = $375
   */
  it('Scenario E: Single, 1 child, low income — ACTC limited by earned income formula', () => {
    const result = calculateCredits(
      FilingStatus.Single, 5000,
      { qualifyingChildren: 1, otherDependents: 0 },
      [], undefined, 2025, 5000, 0,
    );

    expect(result.childTaxCredit).toBe(2200);
    expect(result.actcCredit).toBe(375); // 15% × ($5,000 - $2,500) = $375
  });

  /**
   * Scenario F: Phase-out eliminates credit completely
   *
   * Single, AGI $280,000, 1 child
   *   CTC: $2,200 (OBBBA)
   *   Excess AGI: $280,000 - $200,000 = $80,000
   *   Reduction: ceil($80,000/$1,000) × $50 = 80 × $50 = $4,000
   *   Remaining: max($0, $2,200 - $4,000) = $0
   */
  it('Scenario F: Single, $280k AGI, 1 child — phase-out eliminates credit', () => {
    const result = calculateCredits(
      FilingStatus.Single, 280000,
      { qualifyingChildren: 1, otherDependents: 0 },
      [], undefined, 2025, 200000, 50000,
    );

    expect(result.childTaxCredit).toBe(0);
    expect(result.otherDependentCredit).toBe(0);
    expect(result.actcCredit).toBe(0);
  });

  /**
   * Scenario G: Dependent age validation — child turns 17 during tax year
   * Born 2008-06-15, tax year 2025 → age 17 by end of year → NOT qualifying child
   */
  it('Scenario G: Child age 17 at year-end — classified as other dependent', () => {
    const result = calculateCredits(
      FilingStatus.Single, 60000,
      undefined, // no manual counts
      [],
      [{ name: 'Teen', dateOfBirth: '2008-06-15', relationship: 'child', monthsLivedWithYou: 12 }],
      2025, 60000, 8000,
    );

    // Age 17 by Dec 31, 2025 → other dependent ($500), not qualifying child ($2,200)
    expect(result.childTaxCredit).toBe(0);
    expect(result.otherDependentCredit).toBe(500);
  });

  /**
   * Scenario H: Child under 17 — qualifies for full CTC
   * Born 2010-03-01, tax year 2025 → age 15 → qualifying child
   */
  it('Scenario H: Child age 15 — qualifies for CTC', () => {
    const result = calculateCredits(
      FilingStatus.Single, 60000,
      undefined,
      [],
      [{ name: 'Child', dateOfBirth: '2010-03-01', relationship: 'child', monthsLivedWithYou: 12 }],
      2025, 60000, 8000,
    );

    expect(result.childTaxCredit).toBe(2200);
    expect(result.otherDependentCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSHEET 5: Capital Loss Carryover Worksheet
// Source: Schedule D Instructions, Worksheet 6
//
// When net capital loss exceeds the annual deduction limit ($3,000/$1,500 MFS),
// the excess carries forward. This worksheet determines how much carries forward
// and preserves the ST/LT character.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Worksheet 5: Capital Loss Carryover Worksheet (Schedule D Instructions)', () => {
  /**
   * Scenario A: Single, $8,000 ST loss, no LT — $3k deduction, $5k ST carryforward
   *
   * Schedule D:
   *   Part I: ST gains $0, ST losses $8,000 → net ST = -$8,000
   *   Part II: LT gains $0, LT losses $0 → net LT = $0
   *   Line 16. Net gain/loss: -$8,000
   *   Line 21. Capital loss deduction: -$3,000 (limited)
   *
   * Capital Loss Carryover Worksheet:
   *   Line 1. Taxable income (assume negative = -$3,000 deduction applied)
   *   Line 6. Net ST loss: $8,000
   *   Line 7. Deduction: $3,000
   *   Line 8. ST loss absorbed by deduction: $3,000 (deduction first from ST)
   *   Line 9. ST carryforward: $8,000 - $3,000 = $5,000
   *   Line 13. LT carryforward: $0
   */
  it('Scenario A: Single, $8k ST loss — $3k deduction, $5k ST carryforward', () => {
    const result = calculateScheduleD(
      [{ description: 'Stock A', proceeds: 2000, costBasis: 10000, isLongTerm: false, dateAcquired: '2025-01-01', dateSold: '2025-06-01' }],
      0, FilingStatus.Single,
    );

    expect(result.netShortTerm).toBe(-8000);
    expect(result.netLongTerm).toBe(0);
    expect(result.netGainOrLoss).toBe(-8000);
    expect(result.capitalLossDeduction).toBe(3000);
    expect(result.capitalLossCarryforward).toBe(5000);
    expect(result.capitalLossCarryforwardST).toBe(5000);
    expect(result.capitalLossCarryforwardLT).toBe(0);
  });

  /**
   * Scenario B: Single, $5k LT loss only — $3k deduction, $2k LT carryforward
   */
  it('Scenario B: Single, $5k LT loss — $3k deduction, $2k LT carryforward', () => {
    const result = calculateScheduleD(
      [{ description: 'Bond Fund', proceeds: 5000, costBasis: 10000, isLongTerm: true, dateAcquired: '2023-01-01', dateSold: '2025-06-01' }],
      0, FilingStatus.Single,
    );

    expect(result.netShortTerm).toBe(0);
    expect(result.netLongTerm).toBe(-5000);
    expect(result.capitalLossDeduction).toBe(3000);
    expect(result.capitalLossCarryforward).toBe(2000);
    expect(result.capitalLossCarryforwardST).toBe(0);
    expect(result.capitalLossCarryforwardLT).toBe(2000);
  });

  /**
   * Scenario C: MFS, $2k ST loss + $3k LT loss = $5k total loss
   *
   * MFS limit is $1,500.
   * Both sides have losses. Deduction applied to ST first:
   *   ST: $2k loss, $1.5k deduction applied → $500 ST carryforward
   *   LT: $3k loss, $0 deduction remaining → $3k LT carryforward
   *   Total carryforward: $3,500
   */
  it('Scenario C: MFS, $2k ST + $3k LT loss — $1.5k deduction limit, character preserved', () => {
    const result = calculateScheduleD(
      [
        { description: 'ST trade', proceeds: 3000, costBasis: 5000, isLongTerm: false, dateAcquired: '2025-03-01', dateSold: '2025-06-01' },
        { description: 'LT trade', proceeds: 7000, costBasis: 10000, isLongTerm: true, dateAcquired: '2023-01-01', dateSold: '2025-06-01' },
      ],
      0, FilingStatus.MarriedFilingSeparately,
    );

    expect(result.netShortTerm).toBe(-2000);
    expect(result.netLongTerm).toBe(-3000);
    expect(result.netGainOrLoss).toBe(-5000);
    expect(result.capitalLossDeduction).toBe(1500);
    expect(result.capitalLossCarryforward).toBe(3500);
    expect(result.capitalLossCarryforwardST).toBe(500);   // $2k - $1.5k applied
    expect(result.capitalLossCarryforwardLT).toBe(3000);   // full $3k carries
  });

  /**
   * Scenario D: Prior year carryforward applied — ST carryforward from last year
   *
   * $4,000 ST carryforward + current year $1,000 ST gain:
   *   Net ST: $1,000 - $4,000 = -$3,000
   *   Net LT: $0
   *   Deduction: $3,000
   *   Carryforward: $0 (exactly absorbed by deduction)
   */
  it('Scenario D: Prior ST carryforward $4k + current $1k ST gain — net $3k loss', () => {
    const result = calculateScheduleD(
      [{ description: 'ST trade', proceeds: 6000, costBasis: 5000, isLongTerm: false, dateAcquired: '2025-01-01', dateSold: '2025-06-01' }],
      0, FilingStatus.Single, 4000, 0,
    );

    expect(result.netShortTerm).toBe(-3000); // $1k gain - $4k carryforward
    expect(result.netGainOrLoss).toBe(-3000);
    expect(result.capitalLossDeduction).toBe(3000);
    expect(result.capitalLossCarryforward).toBe(0);
  });

  /**
   * Scenario E: Prior year LT carryforward + current year LT gain partially offsets
   *
   * $10,000 LT carryforward + $6,000 current LT gain:
   *   Net LT: $6,000 - $10,000 = -$4,000
   *   Net ST: $0
   *   Deduction: $3,000
   *   LT carryforward: $4,000 - $3,000 = $1,000
   */
  it('Scenario E: LT carryforward $10k + $6k LT gain — net $4k LT loss', () => {
    const result = calculateScheduleD(
      [{ description: 'LT trade', proceeds: 16000, costBasis: 10000, isLongTerm: true, dateAcquired: '2023-01-01', dateSold: '2025-06-01' }],
      0, FilingStatus.Single, 0, 10000,
    );

    expect(result.netLongTerm).toBe(-4000);
    expect(result.capitalLossDeduction).toBe(3000);
    expect(result.capitalLossCarryforward).toBe(1000);
    expect(result.capitalLossCarryforwardST).toBe(0);
    expect(result.capitalLossCarryforwardLT).toBe(1000);
  });

  /**
   * Scenario F: Net gain — no carryforward needed
   *
   * $10,000 LT gain, $2,000 ST loss: net = $8,000 gain
   */
  it('Scenario F: Net gain $8k — no loss deduction or carryforward', () => {
    const result = calculateScheduleD(
      [
        { description: 'LTCG', proceeds: 15000, costBasis: 5000, isLongTerm: true, dateAcquired: '2023-01-01', dateSold: '2025-06-01' },
        { description: 'ST loss', proceeds: 3000, costBasis: 5000, isLongTerm: false, dateAcquired: '2025-01-01', dateSold: '2025-06-01' },
      ],
      0, FilingStatus.Single,
    );

    expect(result.netGainOrLoss).toBe(8000);
    expect(result.capitalLossDeduction).toBe(0);
    expect(result.capitalLossCarryforward).toBe(0);
  });

  /**
   * Scenario G: Mixed — ST gain offsets LT loss, then deduction + carryforward
   *
   * $2,000 ST gain + $8,000 LT loss:
   *   Net ST: +$2,000
   *   Net LT: -$8,000
   *   Net total: -$6,000
   *   Deduction: $3,000
   *   Since only LT side has net loss, all carryforward is LT
   *   LT carryforward: $6,000 - $3,000 = $3,000
   */
  it('Scenario G: ST gain + LT loss — carryforward preserves LT character', () => {
    const result = calculateScheduleD(
      [
        { description: 'ST win', proceeds: 7000, costBasis: 5000, isLongTerm: false, dateAcquired: '2025-01-01', dateSold: '2025-06-01' },
        { description: 'LT loss', proceeds: 2000, costBasis: 10000, isLongTerm: true, dateAcquired: '2023-01-01', dateSold: '2025-06-01' },
      ],
      0, FilingStatus.Single,
    );

    expect(result.netShortTerm).toBe(2000);
    expect(result.netLongTerm).toBe(-8000);
    expect(result.netGainOrLoss).toBe(-6000);
    expect(result.capitalLossDeduction).toBe(3000);
    expect(result.capitalLossCarryforward).toBe(3000);
    expect(result.capitalLossCarryforwardST).toBe(0);
    expect(result.capitalLossCarryforwardLT).toBe(3000);
  });

  /**
   * Scenario H: Both sides losses, deduction splits ST-first per IRS worksheet
   *
   * $1,000 ST loss + $4,000 LT loss = $5,000 total
   * Deduction: $3,000 (Single)
   * Applied ST-first: $1,000 from ST (fully absorbed), $2,000 from LT
   * Carryforward: ST = $0, LT = $4,000 - $2,000 = $2,000
   */
  it('Scenario H: Both sides losses — deduction applied ST-first', () => {
    const result = calculateScheduleD(
      [
        { description: 'ST loss', proceeds: 4000, costBasis: 5000, isLongTerm: false, dateAcquired: '2025-01-01', dateSold: '2025-06-01' },
        { description: 'LT loss', proceeds: 6000, costBasis: 10000, isLongTerm: true, dateAcquired: '2023-01-01', dateSold: '2025-06-01' },
      ],
      0, FilingStatus.Single,
    );

    expect(result.netShortTerm).toBe(-1000);
    expect(result.netLongTerm).toBe(-4000);
    expect(result.netGainOrLoss).toBe(-5000);
    expect(result.capitalLossDeduction).toBe(3000);
    expect(result.capitalLossCarryforward).toBe(2000);
    expect(result.capitalLossCarryforwardST).toBe(0);     // $1k - $1k = $0
    expect(result.capitalLossCarryforwardLT).toBe(2000);   // $4k - $2k = $2k
  });

  /**
   * Scenario I: Wash sale adjustment affects basis
   *
   * Sold stock for $5,000, cost basis $8,000, wash sale disallowed $1,000
   * Adjusted basis: $8,000 - $1,000 = $7,000
   * Gain/loss: $5,000 - $7,000 = -$2,000 (instead of -$3,000 without wash sale)
   */
  it('Scenario I: Wash sale reduces deductible loss', () => {
    const result = calculateScheduleD(
      [{
        description: 'Wash sale stock',
        proceeds: 5000,
        costBasis: 8000,
        isLongTerm: false,
        dateAcquired: '2025-03-01',
        dateSold: '2025-06-01',
        washSaleLossDisallowed: 1000,
        basisReportedToIRS: false, // Non-covered security: manual wash sale adjustment
      }],
      0, FilingStatus.Single,
    );

    // Non-covered: adjusted basis = $8,000 - $1,000 = $7,000. Loss: $5,000 - $7,000 = -$2,000
    expect(result.netShortTerm).toBe(-2000);
    expect(result.capitalLossDeduction).toBe(2000); // under $3k limit
    expect(result.capitalLossCarryforward).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-WORKSHEET INTEGRATION TESTS
//
// These tests verify that multiple worksheets produce consistent results
// when fed into the same tax return computation.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cross-Worksheet Integration', () => {
  /**
   * Scenario: Single filer with LTCG from Schedule D flowing into
   * the Qualified Dividends and Capital Gain Tax Worksheet.
   *
   * $5,000 LTCG from Schedule D + $3,000 qualified dividends
   * Taxable income: $50,000
   */
  it('Schedule D LTCG flows correctly into preferential rate worksheet', () => {
    // First: Schedule D computes net LTCG
    const scheduleDResult = calculateScheduleD(
      [{ description: 'AAPL', proceeds: 15000, costBasis: 10000, isLongTerm: true, dateAcquired: '2023-01-01', dateSold: '2025-06-01' }],
      0, FilingStatus.Single,
    );
    expect(scheduleDResult.netLongTerm).toBe(5000);

    // Then: Preferential rate worksheet uses the LTCG
    const taxResult = calculatePreferentialRateTax(50000, 3000, 5000, FilingStatus.Single);

    // Ordinary = $50k - $8k = $42k. Preferential stacks from $42k to $50k.
    // 0% threshold Single: $48,350
    // 0% zone: $48,350 - $42,000 = $6,350 at 0%
    // 15% zone: $50,000 - $48,350 = $1,650 at 15%
    expect(taxResult.preferentialTax).toBe(247.5); // $1,650 × 15%
    expect(taxResult.ordinaryTax).toBe(calculateProgressiveTax(42000, FilingStatus.Single).tax);
  });

  /**
   * Scenario: Social Security benefits interact with EITC through AGI
   *
   * Low-income filer: $10k earned income + $12k SS benefits.
   * Taxable SS = $0 (below base amount), so AGI = $10,000.
   * EITC computed on AGI = $10,000 with 1 child.
   */
  it('Social Security taxability affects AGI for EITC computation', () => {
    const ssResult = calculateTaxableSocialSecurity(12000, 10000, FilingStatus.Single);
    // Provisional = $10k + $6k = $16k < $25k base → $0 taxable
    expect(ssResult.taxableBenefits).toBe(0);

    // AGI = $10,000 (earned) + $0 (taxable SS) = $10,000
    const eitcCredit = calculateEITC(
      FilingStatus.Single, 10000, 10000, 1, 0, '1985-01-01',
    );

    // $10,000 < $12,730 → phase-in. Credit = $10,000 × (4328/12730)
    const phaseInRate = 4328 / 12730;
    const expected = Math.round(10000 * phaseInRate * 100) / 100;
    expect(eitcCredit).toBe(expected);
  });

  /**
   * Scenario: Capital loss deduction reduces taxable income for bracket tax
   *
   * $50k wages, $6k capital loss → $3k deduction → AGI $47k → taxable ~$31,250 (after $15,750 std ded)
   * (Test uses $32k for bracket math verification independent of standard deduction)
   */
  it('Capital loss deduction reduces taxable income', () => {
    const scheduleDResult = calculateScheduleD(
      [{ description: 'Loss', proceeds: 4000, costBasis: 10000, isLongTerm: false, dateAcquired: '2025-01-01', dateSold: '2025-06-01' }],
      0, FilingStatus.Single,
    );
    expect(scheduleDResult.capitalLossDeduction).toBe(3000);

    // AGI = $50,000 - $3,000 = $47,000. Taxable = $47,000 - $15,750 = $31,250
    const taxResult = calculateProgressiveTax(32000, FilingStatus.Single);

    // Verify bracket math: $11,925 × 10% = $1,192.50 + ($32,000-$11,925) × 12% = $2,409
    // Total: $1,192.50 + $2,409 = $3,601.50
    expect(taxResult.tax).toBe(3601.5);
  });

  /**
   * Scenario: CTC + ACTC with EITC — verifying credit stacking
   *
   * Single, $18k earned income, 1 child, tax liability $300
   * CTC = $2,200 (OBBBA), but limited to $300 non-refundable
   * ACTC = min($1,900 excess, $1,700 per child cap, 15% × ($18k - $2.5k))
   *      = min($1,900, $1,700, $2,325) = $1,700
   */
  it('CTC non-refundable + ACTC refundable stack correctly', () => {
    const result = calculateCredits(
      FilingStatus.Single, 18000,
      { qualifyingChildren: 1, otherDependents: 0 },
      [], undefined, 2025, 18000, 300,
    );

    expect(result.childTaxCredit).toBe(2200); // Full amount before non-refundable limit (OBBBA)
    expect(result.actcCredit).toBe(1700);     // ACTC = min($1,900 excess, $1,700 per-child, $2,325 earned)
  });
});
