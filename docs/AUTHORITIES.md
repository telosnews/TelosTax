# Authority Reference: Module-by-Module Tax Authority Map

> **Generated from:** YAML authority files in `shared/authorities/` (46 modules in table; 80 engine modules total)
> **Constants file:** `shared/src/constants/tax2025.ts` (inline IRC/Rev. Proc. citations)
> **Tax year:** 2025

This document provides a comprehensive reference of the legal authorities (IRC sections, Treasury Regulations, Revenue Procedures, IRS Forms, and Publications) that govern each computation module in the tax engine. Every exported function is mapped to its binding and explanatory authorities, along with scope descriptions and known limitations.

---

## Summary Table

| # | Module | File | Primary IRC Sections | Scope |
|---|--------|------|---------------------|-------|
| 1 | Form 1040 | `form1040.ts` | 1, 62, 63 | Main orchestrator: gross income through refund/amount owed |
| 2 | Schedule C | `scheduleC.ts` | 162, 274, 280A | Sole proprietorship net profit/loss |
| 3 | Schedule E | `scheduleE.ts` | 469, 469(i) | Rental income/loss with passive activity limits |
| 4 | K-1 Routing | `k1.ts` | 701-704, 1366, 179 | Pass-through income routing from partnerships/S corps |
| 5 | Social Security | `socialSecurity.ts` | 86 | Taxable portion of Social Security benefits |
| 6 | Tax Brackets | `brackets.ts` | 1(a)-(d) | Progressive ordinary income tax computation |
| 7 | Capital Gains | `capitalGains.ts` | 1(h), 1(h)(1)(E) | Preferential rate tax on LTCG and qualified dividends; 25% unrecaptured §1250 rate zone |
| 8 | NIIT | `niit.ts` | 1411 | 3.8% Net Investment Income Tax |
| 9 | Additional Medicare | `additionalMedicare.ts` | 3101(b)(2) | 0.9% Additional Medicare Tax on high earners |
| 10 | Kiddie Tax | `kiddieTax.ts` | 1(g) | Child's unearned income taxed at parent's rate |
| 11 | Schedule SE | `scheduleSE.ts` | 1401(a)-(b), 1402(a) | Self-employment tax (Social Security + Medicare) |
| 12 | Schedule A | `scheduleA.ts` | 164, 163(h), 170, 213, 11042 (TCJA) | Itemized deductions |
| 13 | QBI Deduction | `qbi.ts` | 199A | Section 199A qualified business income deduction |
| 14 | Home Office | `homeOffice.ts` | 280A | Home office deduction (regular and simplified) |
| 15 | Vehicle | `vehicle.ts` | 162, 274(d) | Vehicle expense deduction (mileage or actual) |
| 16 | Investment Interest | `investmentInterest.ts` | 163(d) | Investment interest expense limitation |
| 17 | Schedule 1-A | `schedule1A.ts` | OBBBA 101-104 | OBBBA deductions: tips, overtime, car loan, senior |
| 18 | Home Sale | `homeSale.ts` | 121 | Principal residence gain exclusion |
| 19 | Credits | `credits.ts` | 24, 24(d), 25A | CTC, ACTC, ODC, AOTC, LLC |
| 20 | EITC | `eitc.ts` | 32 | Earned Income Tax Credit |
| 21 | Dependent Care | `dependentCare.ts` | 21, 21(d)(2), 129 | Child and dependent care credit (full Form 2441) |
| 22 | Saver's Credit | `saversCredit.ts` | 25B | Retirement savings contributions credit |
| 23 | Clean Energy | `cleanEnergy.ts` | 25D | Residential clean energy credit (solar, wind, etc.) |
| 24 | EV Credit | `evCredit.ts` | 30D, 25E | New and previously owned clean vehicle credits |
| 25 | Energy Efficiency | `energyEfficiency.ts` | 25C | Energy efficient home improvement credit |
| 26 | Adoption Credit | `adoptionCredit.ts` | 23 | Adoption expense credit |
| 27 | Foreign Tax Credit | `foreignTaxCredit.ts` | 901, 904, 904(d) | Credit for foreign income taxes paid; per-category limitations (general/passive) |
| 28 | Premium Tax Credit | `premiumTaxCredit.ts` | 36B | ACA marketplace health insurance credit |
| 29 | HSA (Form 8889) | `hsaForm8889.ts` | 223 | HSA contribution deduction |
| 30 | HSA Distributions | `hsaDistributions.ts` | 223(f)(2), 223(f)(4) | HSA distribution taxation and penalties |
| 31 | Form 8606 | `form8606.ts` | 408(d)(1)-(2), 408A | IRA distribution pro-rata rule and Roth conversions |
| 32 | Form 5329 | `form5329.ts` | 4973(a), 4973(g) | Excess contribution and early distribution penalties |
| 33 | Schedule D | `scheduleD.ts` | 1(h), 1211(b), 1212(b) | Capital gains/losses, loss limitation, carryforward |
| 34 | Schedule H | `scheduleH.ts` | 3111, 3101, 3301, 3121(x) | Household employment taxes (FICA + FUTA) |
| 35 | Estimated Tax | `estimatedTax.ts` | 6654, 6654(d) | Quarterly estimated payments and safe harbor |
| 36 | Estimated Tax Penalty | `estimatedTaxPenalty.ts` | 6654, 6654(d)(2) | Underpayment penalty computation; annualized income installment method |
| 37 | FEIE | `feie.ts` | 911 | Foreign earned income and housing exclusion |
| 38 | Cancellation of Debt | `cancellationOfDebt.ts` | 61(a)(11), 108 | COD income and exclusions |
| 39 | Form 8911 | `form8911.ts` | 30C | Alternative Fuel Vehicle Refueling Property Credit |
| 40 | Form 4797 | `form4797.ts` | 1231, 1245, 1250 | Business property depreciation recapture |
| 41 | Filing Status Validation | `filingStatusValidation.ts` | 2(b), 7703(b) | Head of household definition and qualifying person validation |
| 42 | Form 4137 | `form4137.ts` | 3121(q), 3101(a), 3101(b) | Unreported tip income FICA tax |
| 43 | Schedule F | `scheduleF.ts` | 61, 162 | Farm income and expenses |
| 44 | Schedule R | `scheduleR.ts` | 22 | Credit for the elderly or the disabled |
| 45 | Deceased Spouse | `deceasedSpouse.ts` | 6013(a)(2), 2(a) | Deceased spouse MFJ/QSS filing validation |
| 46 | Form 7206 (SEHI) | `form7206.ts` | 162(l), 213(d)(10) | Self-employed health insurance deduction (3-part: premiums, proration, net profit limitation) |

---

## Detailed Module Sections

---

### Income Computation

---

#### 1. Form 1040 -- `form1040.ts`

**Source:** `shared/authorities/form1040.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateForm1040` | IRC | 1 | binding | Imposition of individual income tax |
| | IRC | 63 | binding | Taxable income defined as AGI minus deductions (standard or itemized) |
| | IRC | 62 | binding | Adjusted Gross Income defined as gross income minus above-the-line deductions |
| | Form | Form 1040 | explanatory | |

**Scope:** Main orchestrator that computes the complete Form 1040 from gross income through total tax, credits, payments, and refund/amount owed by invoking all subsidiary engine modules. Form 4797 (business property sales) is fully integrated for §1231/§1245/§1250 recapture routing and gain/loss netting.

**Limitations:**
- Relies on all subsidiary modules being correctly implemented and producing valid outputs
- Filing status determination must be provided as input; not independently validated
- Standard deduction amounts must be updated annually per revenue procedure
- Does not handle amended return (1040-X) computations
- Does not handle alternative minimum tax (AMT) under IRC 55-59
- Ordering of credits (nonrefundable before refundable) follows Form 1040 line sequence
- Does not handle net operating loss (NOL) deductions under IRC 172
- Prior year data (carryforwards, basis) must be supplied externally

---

#### 2. Schedule C -- `scheduleC.ts`

**Source:** `shared/authorities/scheduleC.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateScheduleC` | IRC | 162 | binding | Allows deduction for ordinary and necessary trade or business expenses |
| | IRC | 280A | binding | Limitations on deductions for business use of home |
| | IRC | 274 | binding | Limitations on deductions for vehicle and travel expenses; substantiation requirements |
| | Form | Schedule C (Form 1040), Lines 1-31 | explanatory | |

**Scope:** Computes net profit or loss from sole proprietorship by netting gross income against allowable business expenses.

**Limitations:**
- Does not enforce detailed substantiation requirements under IRC 274(d)
- Does not handle inventory accounting methods or cost of goods sold in detail
- Home office deduction delegated to homeOffice.ts
- Vehicle deduction delegated to vehicle.ts
- At-risk and passive activity rules not applied here

---

#### 3. Schedule E -- `scheduleE.ts`

**Source:** `shared/authorities/scheduleE.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateScheduleE` | IRC | 469 | binding | Passive activity loss rules: losses from passive activities only deductible against passive income |
| | IRC | 469(i) | binding | Special $25,000 allowance for active participation in rental real estate activities; phases out between $100,000-$150,000 MAGI |
| | Form | Schedule E (Form 1040), Part I | explanatory | |

**Scope:** Computes rental income/loss from real estate activities, applies passive activity loss limitations including the $25,000 rental allowance.

**Limitations:**
- Does not handle real estate professional exception under IRC 469(c)(7)
- Does not handle material participation tests for non-rental activities
- Suspended passive losses from prior years must be provided as input
- Parts II-IV of Schedule E (partnerships, S corps, estates/trusts) handled via k1.ts
- Does not handle grouping elections under Reg 1.469-4

---

#### 4. K-1 Routing -- `k1.ts`

**Source:** `shared/authorities/k1.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `routeK1Income` | IRC | 701-704 | binding | Partnership taxation: pass-through of income, deductions, gains, losses, and credits to partners |
| | IRC | 1366 | binding | S corporation pass-through of income, deductions, and credits to shareholders |
| | IRC | 179 | binding | Section 179 expense deduction passed through on K-1 |
| | Form | Schedule K-1 (Form 1065 / Form 1120-S / Form 1041) | explanatory | |
| `aggregateK1Income` | IRC | 701-704 | binding | Aggregation of pass-through income from multiple entities |
| | IRC | 1366 | binding | S corporation income aggregation rules |

**Scope:**
- `routeK1Income`: Routes individual K-1 line items to the appropriate lines on Form 1040 and supporting schedules.
- `aggregateK1Income`: Aggregates income, deductions, and credits from multiple K-1 forms into unified totals for Form 1040 reporting.

**Limitations:**
- Does not compute partner/shareholder basis; assumes sufficient basis for loss deductions
- At-risk limitations under IRC 465 not applied
- Passive activity loss limitations under IRC 469 applied separately in scheduleE.ts
- Does not handle guaranteed payments to partners (IRC 707(c)) separately
- Trust/estate K-1 (Form 1041) handling is limited
- Does not net passive losses from one entity against passive income from another (see scheduleE.ts)
- QBI aggregation for Section 199A purposes not handled here (see qbi.ts)

---

#### 5. Social Security -- `socialSecurity.ts`

**Source:** `shared/authorities/socialSecurity.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateTaxableSocialSecurity` | IRC | 86 | binding | Taxation of Social Security benefits: up to 50% taxable if provisional income exceeds $25,000 (single) / $32,000 (MFJ); up to 85% taxable if exceeds $34,000 (single) / $44,000 (MFJ) |
| | Publication | Publication 915 | explanatory | |
| | Form | Social Security Benefits Worksheet (Form 1040 Instructions) | explanatory | |

**Scope:** Determines the taxable portion (0%, up to 50%, or up to 85%) of Social Security benefits based on provisional income.

**Limitations:**
- Provisional income thresholds are not indexed for inflation
- Does not handle lump-sum election under IRC 86(e)
- Does not handle repayment of benefits in current year
- MFS "lived apart" exception now supported: filers who lived apart from their spouse for the entire taxable year use Single filing thresholds per IRC 86(c)(1)(C)(ii); requires `livedApartFromSpouse` flag on TaxReturn input

---

### Tax Computation

---

#### 6. Tax Brackets -- `brackets.ts`

**Source:** `shared/authorities/brackets.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateProgressiveTax` | IRC | 1(a)-(d) | binding | Imposes individual income tax using rate tables for four filing statuses |
| | Rev. Proc. | Rev. Proc. 2024-40, Section 3.01 | binding | Inflation-adjusted bracket thresholds for tax year 2025 |
| | Form | Form 1040, Line 16 | explanatory | |
| `getMarginalRate` | IRC | 1(a)-(d) | binding | Statutory rate tables defining marginal rates of 10%, 12%, 22%, 24%, 32%, 35%, and 37% |
| | Rev. Proc. | Rev. Proc. 2024-40, Section 3.01 | binding | Inflation-adjusted bracket boundaries for determining applicable marginal rate |

**Scope:**
- `calculateProgressiveTax`: Computes regular income tax by applying progressive marginal rates to taxable income across all brackets.
- `getMarginalRate`: Returns the marginal tax rate applicable to the last dollar of taxable income.

**Limitations:**
- Does not include preferential rates for capital gains or qualified dividends (see capitalGains.ts)
- Does not apply AMT computation
- Bracket thresholds must be updated annually per revenue procedure
- Returns the statutory marginal rate only; effective rate may differ
- Does not account for phase-outs or surtaxes that alter effective marginal rates

---

#### 7. Capital Gains -- `capitalGains.ts`

**Source:** `shared/authorities/capitalGains.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculatePreferentialRateTax` | IRC | 1(h) | binding | Preferential tax rates of 0%, 15%, and 20% on net capital gains and qualified dividends |
| | IRC | 1(h)(1)(E) | binding | 25% rate on unrecaptured Section 1250 gain; tax is lesser of amount taxed at 25% or amount that would be taxed at ordinary rates |
| | Rev. Proc. | Rev. Proc. 2024-40, Section 3.12 | binding | Inflation-adjusted thresholds for 0%/15%/20% capital gains rate brackets |
| | Form | Form 1040, Qualified Dividends and Capital Gain Tax Worksheet | explanatory | |
| | Form | Schedule D Tax Worksheet | explanatory | |

**Scope:** Computes tax on net long-term capital gains and qualified dividends at preferential rates, integrating with ordinary income brackets. Includes the 25% rate zone for unrecaptured Section 1250 gain with min(special, regular) comparison per the Schedule D Tax Worksheet.

**Limitations:**
- Does not handle 28% rate on collectibles gain
- NIIT (3.8% surtax) computed separately in niit.ts
- Short-term gains taxed at ordinary rates are handled in brackets.ts
- Net capital loss deduction limited to $3,000 handled in scheduleD.ts

---

#### 8. NIIT -- `niit.ts`

**Source:** `shared/authorities/niit.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateNIIT` | IRC | 1411 | binding | Net Investment Income Tax of 3.8% on lesser of NII or excess MAGI over threshold ($200k single, $250k MFJ) |
| | Form | Form 8960 | explanatory | |

**Scope:** Computes the 3.8% Net Investment Income Tax on the lesser of net investment income or the excess of MAGI over the applicable threshold.

**Limitations:**
- MAGI thresholds are not indexed for inflation
- Does not decompose net investment income into component categories (interest, dividends, rents, etc.)
- Does not handle NII adjustments for self-charged interest or trading income
- Does not handle nonresident alien exceptions

---

#### 9. Additional Medicare Tax -- `additionalMedicare.ts`

**Source:** `shared/authorities/additionalMedicare.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateAdditionalMedicareTaxW2` | IRC | 3101(b)(2) | binding | Additional Hospital Insurance tax of 0.9% on wages exceeding threshold ($200k single, $250k MFJ) |
| | Form | Form 8959 | explanatory | |

**Scope:** Computes the 0.9% Additional Medicare Tax on W-2 wages and/or self-employment income exceeding the applicable threshold, net of employer withholding.

**Limitations:**
- Thresholds are not indexed for inflation
- Employer withholding credit must be reconciled with actual liability
- Does not combine W-2 wages with SE income for married filing jointly threshold; taxpayer must aggregate
- Railroad Tier 1 compensation not handled

---

#### 10. Kiddie Tax -- `kiddieTax.ts`

**Source:** `shared/authorities/kiddieTax.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateKiddieTax` | IRC | 1(g) | binding | Kiddie tax: unearned income of certain children taxed at parent's marginal rate; applies to children under 19 (or under 24 if full-time student) |
| | Rev. Proc. | Rev. Proc. 2024-40, Section 3 | binding | Inflation-adjusted kiddie tax thresholds for 2025 |
| | Form | Form 8615 | explanatory | |

**Scope:** Computes the kiddie tax on a child's unearned income exceeding the threshold, taxed at the parent's marginal rate.

**Limitations:**
- Requires parent's taxable income as input for marginal rate computation
- Does not handle parent's election to include child's income on parent's return (Form 8814)
- Does not validate age and student status requirements
- Net unearned income computation assumes accurate investment income inputs
- TCJA restored parent-rate method (was briefly estate/trust rates in 2018-2019)

---

#### 11. Schedule SE -- `scheduleSE.ts`

**Source:** `shared/authorities/scheduleSE.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateScheduleSE` | IRC | 1401(a)-(b) | binding | Self-employment tax rates: 12.4% Social Security and 2.9% Medicare |
| | IRC | 1402(a) | binding | Definition of net earnings from self-employment; 92.35% multiplier |
| | Rev. Proc. | Rev. Proc. 2024-40, Section 3 | binding | Social Security wage base for 2025: $176,100 |
| | Form | Schedule SE (Form 1040), Lines 4a-12 | explanatory | |

**Scope:** Computes self-employment tax (Social Security and Medicare) on net SE earnings and the corresponding above-the-line deduction for the employer-equivalent portion.

**Limitations:**
- Does not handle optional methods for self-employment tax (farm or non-farm)
- Does not handle church employee income subject to SE tax
- Additional Medicare Tax (0.9%) handled separately by additionalMedicare.ts

---

### Deductions

---

#### 12. Schedule A -- `scheduleA.ts`

**Source:** `shared/authorities/scheduleA.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateScheduleA` | IRC | 164 | binding | Deduction for state and local income, sales, and property taxes |
| | IRC | 163(h) | binding | Deduction for qualified residence interest (acquisition indebtedness) |
| | IRC | 170 | binding | Deduction for charitable contributions subject to AGI percentage limits |
| | IRC | 213 | binding | Deduction for medical expenses exceeding 7.5% of AGI |
| | IRC | 11042 (TCJA) | binding | SALT deduction cap of $10,000 ($5,000 for MFS) effective 2018-2025 |
| | Form | Schedule A (Form 1040) | explanatory | |

**Scope:** Computes total itemized deductions by aggregating medical, taxes, interest, charitable contributions, and other deductions subject to applicable limitations.

**Limitations:**
- Does not compare itemized vs. standard deduction (handled in form1040.ts)
- SALT cap may change after TCJA sunset; must be reviewed for post-2025 years
- Charitable contribution carryforwards not tracked
- Mortgage interest limited to $750,000 acquisition indebtedness ($1M for pre-12/16/2017 loans) not fully validated
- Pease limitation suspended through 2025 under TCJA

---

#### 13. QBI Deduction -- `qbi.ts`

**Source:** `shared/authorities/qbi.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateQBIDeduction` | IRC | 199A | binding | Qualified Business Income deduction of up to 20% of QBI; subject to W-2 wages/UBIA limits and SSTB restrictions above income thresholds |
| | Rev. Proc. | Rev. Proc. 2024-40, Section 3.29 | binding | Inflation-adjusted income thresholds for QBI deduction phase-in of limitations |
| | Form | Form 8995 (Simplified) / Form 8995-A (Standard) | explanatory | |

**Scope:** Computes the Section 199A deduction as the lesser of 20% of QBI (subject to W-2/UBIA limits) or 20% of taxable income before QBI deduction, with SSTB exclusion above thresholds.

**Limitations:**
- Does not independently determine SSTB classification; relies on input flag
- Does not handle QBI loss carryforward from prior years
- Aggregation of multiple businesses not fully modeled
- REIT dividends and PTP income components treated as separate buckets but not fully decomposed
- Deduction sunsets after 2025 under current TCJA provisions unless extended

---

#### 14. Home Office -- `homeOffice.ts`

**Source:** `shared/authorities/homeOffice.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateHomeOfficeDeduction` | IRC | 280A | binding | Requirements for business use of home deduction: regular and exclusive use as principal place of business |
| | Rev. Proc. | Rev. Proc. 2013-13 | binding | Simplified method allowing $5 per square foot, maximum 300 square feet ($1,500 max) |
| | Form | Form 8829 | explanatory | |
| `compareHomeOfficeMethods` | IRC | 280A | binding | Regular method based on actual expenses allocated by business use percentage |
| | Rev. Proc. | Rev. Proc. 2013-13 | binding | Simplified method at $5/sq ft up to 300 sq ft |

**Scope:**
- `calculateHomeOfficeDeduction`: Computes the home office deduction using either the regular (actual expenses) method or the simplified method.
- `compareHomeOfficeMethods`: Compares the regular and simplified home office methods and returns the more beneficial deduction amount.

**Limitations:**
- Does not validate regular and exclusive use requirement
- Carryforward of disallowed expenses under regular method not tracked across years
- Does not handle daycare facility exception under IRC 280A(c)(4)
- Employees cannot claim home office deduction under TCJA (2018-2025)
- Comparison is for single tax year only; multi-year impact not modeled
- Depreciation recapture implications of regular method not flagged

---

#### 15. Vehicle -- `vehicle.ts`

**Source:** `shared/authorities/vehicle.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateVehicleDeduction` | IRC | 162 | binding | Deduction for ordinary and necessary business expenses including vehicle expenses |
| | IRC | 274(d) | binding | Substantiation requirements for listed property including vehicles |
| | Treas. Reg. | 1.274-5T | binding | Temporary regulations on substantiation of vehicle expenses; adequate records requirement |
| | Rev. Proc. | IRS Notice 2024-79 | binding | Standard mileage rate of $0.70 per mile for business use in 2025 |
| | Form | Form 1040, Schedule C or Form 2106 | explanatory | |
| `compareVehicleMethods` | IRC | 162 | binding | Business expense deduction for vehicle use |
| | Rev. Proc. | IRS Notice 2024-79 | binding | Standard mileage rate for 2025: $0.70/mile |

**Scope:**
- `calculateVehicleDeduction`: Computes vehicle deduction using either the standard mileage rate or actual expense method for business use of a personal vehicle.
- `compareVehicleMethods`: Compares the standard mileage rate method to the actual expense method and returns the more beneficial deduction.

**Limitations:**
- Does not enforce the first-year election requirement for standard mileage rate
- Does not track depreciation component embedded in standard mileage rate
- Actual expense method luxury auto depreciation limits (IRC 280F) not enforced
- Does not handle fleet vehicles (five or more)
- Comparison is single-year; long-term depreciation impact of method choice not modeled
- Switching from actual to standard mileage has restrictions not validated

---

#### 16. Investment Interest -- `investmentInterest.ts`

**Source:** `shared/authorities/investmentInterest.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateInvestmentInterest` | IRC | 163(d) | binding | Investment interest expense deduction limited to net investment income; excess carries forward indefinitely |
| | Form | Form 4952 | explanatory | |

**Scope:** Computes the deductible investment interest expense limited to net investment income, and determines the carryforward of disallowed interest.

**Limitations:**
- Election to treat qualified dividends and/or capital gains as investment income (forgoing preferential rates) modeled but taxpayer must affirmatively elect
- Net investment income computation does not decompose all component types
- Carryforward from prior years must be provided as input
- Does not apply to interest properly allocable to a passive activity
- Margin interest and other investment borrowing costs must be correctly classified as input

---

#### 17. Schedule 1-A -- `schedule1A.ts`

**Source:** `shared/authorities/schedule1A.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateSchedule1A` | Statute | OBBBA Section 101 | binding | No Tax on Tips: above-the-line deduction for cash and charged tips for eligible workers |
| | Statute | OBBBA Section 102 | binding | No Tax on Overtime: above-the-line deduction for overtime pay exceeding 40 hours per week |
| | Statute | OBBBA Section 103 | binding | Car Loan Interest: above-the-line deduction for interest on auto loans for domestically manufactured vehicles |
| | Statute | OBBBA Section 104 | binding | Enhanced Senior Standard Deduction: additional standard deduction amount for taxpayers age 65+ |
| | Form | Schedule 1-A (Form 1040) | explanatory | |

**Scope:** Computes above-the-line deductions introduced by the One Big Beautiful Bill Act including tip income exclusion, overtime pay exclusion, auto loan interest deduction, and enhanced senior deduction.

**Limitations:**
- OBBBA provisions are new legislation; IRS guidance and regulations may not yet be finalized
- Tip income exclusion eligibility criteria (occupation, income limits) may require further regulatory guidance
- Overtime deduction computation depends on employer-reported data; verification not modeled
- Auto loan interest deduction domestic manufacture requirement not validated
- Enhanced senior deduction interaction with existing age-65+ standard deduction add-on must be coordinated
- Effective dates and phase-in periods per OBBBA must be verified

---

#### 18. Home Sale Exclusion -- `homeSale.ts`

**Source:** `shared/authorities/homeSale.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateHomeSaleExclusion` | IRC | 121 | binding | Exclusion of gain on sale of principal residence: up to $250,000 (single) or $500,000 (MFJ) if ownership and use tests met (2 of last 5 years) |
| | Publication | Publication 523 | explanatory | |

**Scope:** Computes the excludable gain on the sale of a principal residence and any taxable gain exceeding the exclusion.

**Limitations:**
- Does not validate the 2-out-of-5-year ownership and use tests
- Reduced exclusion for failure to meet full requirements (unforeseen circumstances) simplified
- Does not handle nonqualified use allocation for periods after 2008
- Depreciation recapture on home office portion not computed (unrecaptured Section 1250 gain)
- Exclusion available only once every two years; prior use not tracked

---

#### 46. Form 7206 (SEHI) -- `form7206.ts`

**Source:** `shared/authorities/form7206.yaml` (pending)

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateForm7206` | IRC | 162(l) | binding | Self-employed health insurance deduction: 100% of premiums paid for medical, dental, vision, long-term care, and Medicare insurance for the self-employed individual, spouse, and dependents |
| | IRC | 162(l)(2)(A) | binding | Deduction limited to taxpayer's net SE profit minus deductible half of SE tax minus SE retirement contributions |
| | IRC | 213(d)(10) | binding | Eligible long-term care premiums: per-person age-based limits on deductible LTC insurance premiums |
| | Rev. Proc. | Rev. Proc. 2024-40 | binding | 2025 inflation-adjusted LTC premium limits by age bracket |
| | Form | Form 7206 (2025) | explanatory | Self-Employed Health Insurance Deduction worksheet |
| `getLTCPremiumLimit` | IRC | 213(d)(10) | binding | Age-bracket lookup for per-person LTC premium deduction limit |
| `legacyToForm7206Input` | — | — | — | Backward compatibility bridge from legacy `healthInsurancePremiums` field |

**Scope:** Computes the deductible amount of health insurance premiums for self-employed individuals (Schedule C/F filers) using the full 3-part Form 7206 calculation: Part I aggregates premiums (medical/dental/vision + age-capped LTC + Medicare), Part II prorates for months without employer-subsidized coverage, Part III applies the net profit limitation. APTC from 1095-A forms reduces the deduction to break PTC circularity.

**Limitations:**
- PTC iterative convergence deferred (uses single-pass APTC from 1095-A; difference typically <$100)
- Per-business limitation for multiple Schedule Cs uses combined net profit (full per-business allocation deferred)
- S-Corp shareholders (>2%) should use W-2 Box 1, not Form 7206; engine does not enforce this exclusion

---

### Credits

---

#### 19. Credits (CTC/ACTC/Education) -- `credits.ts`

**Source:** `shared/authorities/credits.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateCredits` | IRC | 24 | binding | Child Tax Credit of up to $2,000 per qualifying child under age 17; Other Dependents Credit of $500 |
| | IRC | 24(d) | binding | Additional Child Tax Credit (refundable portion) with earned income formula |
| | IRC | 25A | binding | Education credits: AOTC up to $2,500 per student; LLC up to $2,000 per return |
| | Rev. Proc. | Rev. Proc. 2024-40, Sections 3.23-3.27 | binding | Inflation-adjusted CTC/ACTC phase-out thresholds and education credit income limits |
| | Form | Schedule 8812 (Form 1040) | explanatory | |
| | Form | Form 8863 | explanatory | |

**Scope:** Computes Child Tax Credit, Other Dependents Credit, Additional Child Tax Credit (refundable), AOTC, and LLC with applicable phase-outs.

**Limitations:**
- Does not validate qualifying child or dependent tests
- AOTC four-year per-student limit not tracked across tax years
- LLC and AOTC cannot both be claimed for the same student; validation not enforced
- Does not handle CTC/ACTC changes post-TCJA sunset
- Education credit qualified expenses must be input correctly

---

#### 20. EITC -- `eitc.ts`

**Source:** `shared/authorities/eitc.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateEITC` | IRC | 32 | binding | Earned Income Tax Credit computation including phase-in, maximum credit, and phase-out ranges based on earned income, AGI, and qualifying children |
| | Rev. Proc. | Rev. Proc. 2024-40, Sections 3.04-3.07 | binding | Inflation-adjusted EITC amounts, phase-in/phase-out thresholds, earned income thresholds, and investment income limit for 2025 |
| | Form | Schedule EIC (Form 1040) | explanatory | |
| | Publication | Publication 596 | explanatory | |

**Scope:** Computes the refundable Earned Income Tax Credit based on earned income, AGI, filing status, and number of qualifying children.

**Limitations:**
- Does not validate qualifying child tests (age, relationship, residency)
- Investment income disqualification test applied but components not decomposed
- Does not handle disallowance period after prior year audit
- Does not handle taxpayers with foreign earned income
- Self-employed income must already be computed before calling this function

---

#### 21. Dependent Care Credit -- `dependentCare.ts`

**Source:** `shared/authorities/dependentCare.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateDependentCareCredit` | IRC | 21 | binding | Credit for child and dependent care expenses: 20%-35% of up to $3,000 (one) / $6,000 (two or more) qualifying individuals |
| | IRC | 21(d)(2) | binding | Earned income limitation for student or disabled spouse: deemed earned income of $250/month (one qualifying individual) or $500/month (two or more) |
| | IRC | 129 | binding | Employer-provided dependent care benefits exclusion; Part III Form 2441 coordination |
| | Form | Form 2441 | explanatory | |

**Scope:** Computes the nonrefundable credit for child and dependent care expenses based on AGI-determined credit percentage and qualifying expense limits. Full Form 2441 implementation including employer-provided benefits (Part III), student/disabled spouse deemed earned income, and MFS lived-apart exception.

**Limitations:**
- Does not validate qualifying individual tests (age, dependency, incapacity)
- Does not validate care provider identification requirements
- Earned income limitation (lower-earning spouse) applied but not validated against actual earnings
- Enhanced ARPA provisions (2021 only) not applicable for 2025

---

#### 22. Saver's Credit -- `saversCredit.ts`

**Source:** `shared/authorities/saversCredit.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateSaversCredit` | IRC | 25B | binding | Retirement savings contributions credit: 10%, 20%, or 50% of up to $2,000 in eligible contributions based on AGI |
| | Rev. Proc. | Rev. Proc. 2024-40, Section 3.06 | binding | Inflation-adjusted AGI thresholds for Saver's Credit rate tiers |
| | Form | Form 8880 | explanatory | |

**Scope:** Computes the nonrefundable Saver's Credit based on eligible retirement contributions and AGI-determined credit rate.

**Limitations:**
- Does not validate eligibility (age 18+, not student, not dependent)
- Distributions from retirement plans in testing period reduce eligible contributions but not fully tracked
- Maximum contribution considered is $2,000 per person ($4,000 MFJ)
- Nonrefundable; cannot exceed tax liability

---

#### 23. Clean Energy Credit -- `cleanEnergy.ts`

**Source:** `shared/authorities/cleanEnergy.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateCleanEnergyCredit` | IRC | 25D | binding | Residential clean energy credit: 30% of qualified expenditures for solar electric, solar water heating, fuel cell, small wind, geothermal, and battery storage |
| | IRC | 25D(c) | binding | Carryforward of unused credit: credit limited to tax liability; excess carries forward to subsequent taxable years |
| | Form | Form 5695, Part I | explanatory | |

**Scope:** Computes the residential clean energy credit at 30% of qualifying expenditures for eligible clean energy property. Supports prior year carryforward and tax limitation with carryforward to next year per IRC §25D(c).

**Limitations:**
- Does not validate property eligibility or certification requirements
- Fuel cell credit has per-kW capacity limit ($500/half kW) not fully modeled
- Property must be placed in service at taxpayer's US residence
- 30% rate applies through 2032; phases down to 26% in 2033 and 22% in 2034

---

#### 24. EV Credit -- `evCredit.ts`

**Source:** `shared/authorities/evCredit.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateEVCredit` | IRC | 30D | binding | New clean vehicle credit: up to $7,500 ($3,750 critical minerals + $3,750 battery components) subject to MSRP caps and AGI limits |
| | IRC | 25E | binding | Previously owned clean vehicle credit: lesser of $4,000 or 30% of sale price; AGI and price limits apply |
| | Form | Form 8936 | explanatory | |

**Scope:** Computes the clean vehicle credit for new (Section 30D) or previously owned (Section 25E) electric vehicles subject to MSRP, AGI, and sourcing requirements.

**Limitations:**
- Does not validate critical minerals or battery component sourcing percentages
- Does not verify final assembly in North America
- MSRP limits ($55k car / $80k van-SUV-truck for new; $25k for used) applied but vehicle classification not validated
- AGI limits ($150k single / $300k MFJ for new; $75k single / $150k MFJ for used) use prior or current year lesser AGI
- Point-of-sale transfer to dealer mechanism not modeled
- Foreign entity of concern (FEOC) battery restrictions not validated

---

#### 25. Energy Efficiency Credit -- `energyEfficiency.ts`

**Source:** `shared/authorities/energyEfficiency.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateEnergyEfficiencyCredit` | IRC | 25C | binding | Energy efficient home improvement credit: 30% of qualified expenditures up to $1,200 annual limit ($2,000 for heat pumps); per-item sublimits apply |
| | Form | Form 5695, Part II | explanatory | |

**Scope:** Computes the energy efficient home improvement credit subject to annual aggregate and per-category limits for insulation, windows, doors, HVAC, and heat pumps.

**Limitations:**
- Annual limit resets each year; prior year usage not tracked
- Per-item sublimits: $600 for windows, $250/$500 for doors, $600 for other items
- Heat pump/biomass stove $2,000 limit is separate from the $1,200 general limit
- Does not validate product certification (Energy Star, IECC requirements)
- Home energy audit credit ($150 max) included in $1,200 aggregate
- Credit is nonrefundable

---

#### 26. Adoption Credit -- `adoptionCredit.ts`

**Source:** `shared/authorities/adoptionCredit.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateAdoptionCredit` | IRC | 23 | binding | Adoption credit for qualified adoption expenses; maximum credit amount per child; additional provisions for special needs adoptions |
| | Rev. Proc. | Rev. Proc. 2024-40, Section 3.35 | binding | Inflation-adjusted maximum adoption credit and income phase-out thresholds for 2025 |
| | Form | Form 8839 | explanatory | |

**Scope:** Computes the nonrefundable adoption credit based on qualified adoption expenses subject to per-child maximum and AGI phase-out.

**Limitations:**
- Special needs adoption deemed to have maximum qualified expenses regardless of actual expenses; input must flag special needs
- Credit timing rules differ for domestic vs. foreign adoptions; simplified
- Five-year carryforward of unused credit not tracked across years
- Employer adoption assistance exclusion (IRC 137) coordination not fully modeled
- Phase-out range is statutory and inflation-adjusted annually

---

#### 27. Foreign Tax Credit -- `foreignTaxCredit.ts`

**Source:** `shared/authorities/foreignTaxCredit.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateForeignTaxCredit` | IRC | 901 | binding | Credit for income taxes paid or accrued to foreign countries or US possessions |
| | IRC | 904 | binding | Foreign tax credit limitation: credit cannot exceed US tax on foreign source income (separate category baskets) |
| | IRC | 904(d) | binding | Separate limitation categories: general category and passive category income limitations computed independently |
| | Form | Form 1116 | explanatory | |

**Scope:** Computes the foreign tax credit limited to the US tax attributable to foreign source taxable income, with per-category limitations for general and passive income categories per IRC 904(d).

**Limitations:**
- Per-category limitations implemented for general and passive categories; Section 901(j) and other specialized baskets not handled
- Does not handle foreign tax credit carryback (1 year) or carryforward (10 years)
- Source of income rules (IRC 861-865) not independently computed; relies on input classification
- Does not handle high-tax kickout under IRC 904(d)(2)(F)
- De minimis exception ($300/$600 MFJ) for direct credit without Form 1116 modeled
- Treaty-based positions not considered

---

#### 28. Premium Tax Credit -- `premiumTaxCredit.ts`

**Source:** `shared/authorities/premiumTaxCredit.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculatePremiumTaxCredit` | IRC | 36B | binding | Premium Tax Credit: refundable credit for health insurance purchased through Marketplace; based on applicable benchmark plan and household income as percentage of FPL |
| | Statute | ACA Section 1401 | binding | Affordable Care Act establishment of PTC |
| | Statute | IRA Section 12001 | binding | Inflation Reduction Act extension of enhanced PTC subsidies through 2025 |
| | Rev. Proc. | Rev. Proc. 2024-35 | binding | Applicable percentage table for PTC computation for 2025 |
| | Form | Form 8962 | explanatory | |
| `calculatePTCHouseholdIncome` | IRC | 36B(d)(2) | binding | Household income definition: MAGI of taxpayer plus MAGI of all individuals claimed as dependents required to file |
| | Form | Form 8962, Part I | explanatory | |

**Scope:**
- `calculatePremiumTaxCredit`: Computes the Premium Tax Credit as the excess of the benchmark plan premium over the expected contribution (applicable percentage of household income).
- `calculatePTCHouseholdIncome`: Computes household income as a percentage of the Federal Poverty Level for PTC eligibility and amount determination.

**Limitations:**
- Federal Poverty Level guidelines must be updated annually
- Does not handle Marketplace-specific SLCSP (second lowest cost silver plan) lookups
- Advance PTC reconciliation (excess APTC repayment) modeled but repayment caps may change
- Does not handle employer offer of affordable coverage (affordability safe harbors)
- Family glitch fix (2023+) included but not all edge cases modeled
- Family size determination relies on tax family; may differ from Marketplace application
- FPL amounts must be updated annually from HHS guidelines

---

#### 39. Form 8911 (Alt Fuel Vehicle Refueling Credit) -- `form8911.ts`

**Source:** `shared/authorities/form8911.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateForm8911` | IRC | 30C | binding | Alternative fuel vehicle refueling property credit: 30% of qualified property cost, subject to per-property dollar limits and tax liability limitation |
| | Form | Form 8911 | explanatory | |

**Scope:** Computes the nonrefundable credit for qualified alternative fuel vehicle refueling property under IRC 30C, including per-property limits and tax liability limitation.

**Limitations:**
- Does not validate property eligibility or certification requirements
- Per-property limits ($100,000 for business / $1,000 for personal) applied but property classification not validated
- Credit is nonrefundable; limited to tax liability after other credits
- Does not handle carryback or carryforward of unused credit (business property only)
- Placed-in-service date requirements not independently validated

---

#### 40. Form 4797 (Business Property Sales) -- `form4797.ts`

**Source:** `shared/authorities/form4797.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateForm4797` | IRC | 1231 | binding | Net Section 1231 gains treated as long-term capital gains; net losses treated as ordinary losses |
| | IRC | 1245 | binding | Depreciation recapture on personal property: gain treated as ordinary income to the extent of prior depreciation |
| | IRC | 1250 | binding | Depreciation recapture on real property: unrecaptured Section 1250 gain taxed at 25% rate under IRC 1(h)(1)(E) |
| | Form | Form 4797 | explanatory | |

**Scope:** Computes gains and losses on the sale of business property, applying Section 1231 characterization and Sections 1245/1250 depreciation recapture rules on a per-property basis.

**Limitations:**
- Does not handle Section 1231 lookback rule (5-year ordinary loss recapture under IRC 1231(c))
- Does not handle like-kind exchange (IRC 1031) deferral
- Does not handle involuntary conversion (IRC 1033) deferral
- Depreciation history must be provided as input per property
- Does not handle installment sales under IRC 453
- Does not handle related-party sale rules under IRC 1239

---

#### 41. Filing Status Validation -- `filingStatusValidation.ts`

**Source:** `shared/authorities/filingStatusValidation.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `validateFilingStatus` | IRC | 2(b) | binding | Head of household definition — unmarried, qualifying person, household maintenance |
| | IRC | 7703(b) | binding | "Considered unmarried" determination for HoH when lived apart from spouse |
| | Publication | Publication 501 | explanatory | HoH requirements, qualifying person rules |

**Scope:** Validates Head of Household filing status eligibility by checking qualifying person presence, residency requirements, and household cost maintenance. Validation is non-blocking (produces warnings, not errors) to allow the engine to continue processing while flagging potential filing status issues.

**Limitations:**
- Validation is non-blocking; does not prevent computation if HoH requirements are not met
- Does not independently verify marital status or "considered unmarried" facts beyond input flags
- Qualifying person relationship tests rely on dependent data provided as input
- Household maintenance cost threshold (more than half) not independently computed from financial records

---

#### 42. Form 4137 (Unreported Tip FICA Tax) -- `form4137.ts`

**Source:** `shared/authorities/form4137.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateForm4137` | IRC | 3121(q) | binding | Tips received by an employee treated as remuneration for FICA purposes; employer and employee shares of Social Security and Medicare tax |
| | IRC | 3101(a) | binding | Employee share of Social Security tax rate (6.2%) on unreported tips |
| | IRC | 3101(b) | binding | Employee share of Medicare tax rate (1.45%) on unreported tips |
| | Form | Form 4137 | explanatory | |

**Scope:** Computes the employee share of Social Security and Medicare taxes on tip income not reported to the employer, as reported on Form 4137.

**Limitations:**
- Does not validate whether tips were actually unreported to employer
- Social Security wage base ceiling applied but requires total wages (W-2 + tips) as input
- Does not handle allocated tips from Form W-2 Box 8
- Additional Medicare Tax (0.9%) on tips handled separately by additionalMedicare.ts

---

#### 43. Schedule F (Farm Income) -- `scheduleF.ts`

**Source:** `shared/authorities/scheduleF.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateScheduleF` | IRC | 61 | binding | Gross income includes income from all sources, including farming |
| | IRC | 162 | binding | Allows deduction for ordinary and necessary trade or business expenses, including farm expenses |
| | Form | Schedule F (Form 1040) | explanatory | |

**Scope:** Computes net farm profit or loss from farming operations by netting gross farm income against 23 categories of allowable farm expenses. Net farm profit flows to Schedule SE for self-employment tax computation.

**Limitations:**
- Does not handle crop insurance proceeds deferral elections
- Does not handle conservation expense deductions under IRC 175
- Does not handle commodity credit loan special rules
- Farm income averaging under IRC 1301 not modeled
- Does not handle net operating loss special rules for farmers (2-year carryback)
- Inventory and cost of goods sold for livestock not fully modeled

---

#### 44. Schedule R (Credit for the Elderly or the Disabled) -- `scheduleR.ts`

**Source:** `shared/authorities/scheduleR.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateScheduleR` | IRC | 22 | binding | Credit for the elderly and the permanently and totally disabled; initial amount based on filing status and age/disability, reduced by nontaxable Social Security/pensions and excess AGI over threshold |
| | Form | Schedule R (Form 1040) | explanatory | |

**Scope:** Computes the nonrefundable credit for taxpayers age 65+ or permanently and totally disabled under IRC 22. Initial amount ($5,000/$7,500/$3,750) reduced by nontaxable Social Security and pension benefits and by 50% of AGI exceeding the applicable threshold ($7,500/$10,000/$5,000).

**Limitations:**
- Does not independently validate permanent and total disability status; relies on input flag
- Does not handle the physician's statement requirement for disabled filers under age 65
- Credit is nonrefundable; cannot exceed tax liability
- MFS filers must have lived apart from spouse for the entire year to claim the credit
- Mandatory retirement age rule for disability not validated

---

#### 45. Deceased Spouse Validation -- `deceasedSpouse.ts`

**Source:** `shared/authorities/deceasedSpouse.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `validateDeceasedSpouse` | IRC | 6013(a)(2) | binding | Joint return permitted for year in which spouse dies; surviving spouse may file MFJ for the taxable year of death |
| | IRC | 2(a) | binding | Qualifying Surviving Spouse filing status: available for 2 taxable years following year of death if dependent child maintained in household |
| | Publication | Publication 501 | explanatory | Filing status rules for surviving spouses |

**Scope:** Validates deceased spouse filing eligibility. For the year of death, confirms that MFJ filing is permitted per IRC §6013(a)(2). For the 2 subsequent taxable years, validates QSS (Qualifying Surviving Spouse) eligibility per IRC §2(a). Validation is non-blocking (produces warnings, not errors) to allow the engine to continue processing while flagging potential filing status issues.

**Limitations:**
- Validation is non-blocking; does not prevent computation if requirements are not met
- Does not independently verify date of death; relies on `spouseDateOfDeath` input
- QSS eligibility requires a dependent child maintained in the household; dependent validation relies on input data
- Does not handle executor-filed returns or final return complexities
- Does not validate community property state rules for deceased spouse income allocation

---

### Retirement & Health

---

#### 29. HSA Form 8889 -- `hsaForm8889.ts`

**Source:** `shared/authorities/hsaForm8889.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateHSADeduction` | IRC | 223 | binding | HSA deduction for contributions to Health Savings Account; requires HDHP coverage; above-the-line deduction |
| | Rev. Proc. | Rev. Proc. 2024-25 | binding | HSA contribution limits for 2025: $4,300 self-only, $8,550 family; catch-up $1,000 (age 55+) |
| | Form | Form 8889 | explanatory | |

**Scope:** Computes the HSA above-the-line deduction based on HDHP coverage type, contribution limits, employer contributions, and catch-up eligibility.

**Limitations:**
- Does not validate HDHP coverage eligibility or months of coverage
- Pro-rata monthly limitation for partial-year coverage applied but testing period not modeled
- Employer contributions reduce deductible limit but are not independently verified
- Last-month rule under IRC 223(b)(2)(B) not fully modeled
- Excess contribution penalty handled in form5329.ts

---

#### 30. HSA Distributions -- `hsaDistributions.ts`

**Source:** `shared/authorities/hsaDistributions.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateHSADistribution` | IRC | 223(f)(2) | binding | HSA distributions for non-qualified expenses included in gross income |
| | IRC | 223(f)(4) | binding | 20% additional tax on HSA distributions not used for qualified medical expenses (unless age 65+, disabled, or deceased) |
| | Form | Form 1099-SA | explanatory | |
| | Form | Form 8889, Part II | explanatory | |
| `aggregateHSADistributions` | IRC | 223(f) | binding | Rules for HSA distributions from multiple accounts |
| | Form | Form 8889, Part II | explanatory | |

**Scope:**
- `calculateHSADistribution`: Computes taxable amount and 20% penalty on HSA distributions not used for qualified medical expenses.
- `aggregateHSADistributions`: Aggregates distributions from multiple HSA accounts for unified reporting on Form 8889.

**Limitations:**
- Does not validate whether expenses are qualified medical expenses under IRC 213(d)
- Does not track prior year distribution/expense matching
- Exception for age 65+ (no penalty, but taxable) applied based on input flag
- Disability and death exceptions rely on input flags
- Assumes all 1099-SA forms are provided as input
- Does not handle mistaken distributions returned to HSA

---

#### 31. Form 8606 -- `form8606.ts`

**Source:** `shared/authorities/form8606.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateForm8606` | IRC | 408(d)(1)-(2) | binding | IRA distribution rules including pro-rata allocation between basis (nondeductible contributions) and taxable amounts |
| | IRC | 408A | binding | Roth IRA rules including conversions from traditional IRA; taxable conversion amount |
| | Form | Form 8606 | explanatory | |

**Scope:** Computes the taxable portion of traditional IRA distributions using the pro-rata rule, and tracks Roth conversion taxable amounts and nondeductible IRA basis.

**Limitations:**
- Requires accurate prior-year basis (nondeductible contributions) as input
- Pro-rata rule aggregates ALL traditional IRA, SEP, and SIMPLE balances; year-end balances must be provided
- Roth conversion recharacterization no longer available post-TCJA but prior recharacterizations may affect basis
- Does not handle inherited IRA distribution rules
- Back-door Roth strategy tax implications computed but not flagged as planning advice

---

#### 32. Form 5329 -- `form5329.ts`

**Source:** `shared/authorities/form5329.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateForm5329` | IRC | 4973(a) | binding | 6% excise tax on excess contributions to IRAs (traditional and Roth) |
| | IRC | 4973(g) | binding | 6% excise tax on excess contributions to Health Savings Accounts |
| | Form | Form 5329 | explanatory | |

**Scope:** Computes additional taxes on excess contributions to IRAs and HSAs, early distributions, and other retirement plan penalty taxes reported on Form 5329.

**Limitations:**
- 10% early distribution penalty (IRC 72(t)) exceptions must be flagged as input
- Excess contribution carryforward from prior years must be provided
- Does not handle excess accumulation penalty (IRC 4974) for required minimum distributions
- Coverdell ESA excess contribution penalty (IRC 4973(e)) not modeled
- Corrective distribution deadline tracking not modeled
- Does not compute excess contribution amounts; relies on input from hsaForm8889.ts and form8606.ts

---

### Other

---

#### 33. Schedule D -- `scheduleD.ts`

**Source:** `shared/authorities/scheduleD.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateScheduleD` | IRC | 1(h) | binding | Tax rates on net capital gain including 0%, 15%, and 20% brackets |
| | IRC | 1211(b) | binding | Capital loss limitation: net capital loss deduction limited to $3,000 ($1,500 MFS) per year |
| | IRC | 1212(b) | binding | Capital loss carryover rules for individuals; unlimited carryforward |
| | Form | Schedule D (Form 1040) | explanatory | |

**Scope:** Computes net short-term and long-term capital gains/losses, applies the $3,000 loss limitation, and determines capital loss carryforward.

**Limitations:**
- Does not handle wash sale adjustments (IRC 1091)
- Does not handle constructive sales under IRC 1259
- 28% rate group (collectibles) and 25% rate group (unrecaptured 1250 gain) not fully modeled
- Capital loss carryforward from prior years must be provided as input
- Does not handle section 1256 contracts (60/40 split)

---

#### 34. Schedule H -- `scheduleH.ts`

**Source:** `shared/authorities/scheduleH.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateScheduleH` | IRC | 3111 | binding | Employer share of Social Security (6.2%) and Medicare (1.45%) taxes |
| | IRC | 3101 | binding | Employee share of Social Security (6.2%) and Medicare (1.45%) taxes — combined with employer share on Schedule H |
| | IRC | 3301 | binding | Federal Unemployment Tax Act (FUTA): 6.0% on first $7,000 of wages per employee, reduced by state credit |
| | IRC | 3121(x) | binding | Domestic service employment threshold ($2,800 for 2025) |
| | Form | Schedule H (Form 1040), Lines 2 and 4 | explanatory | |

**Scope:** Computes household employment taxes: combined employer+employee Social Security (12.4%), Medicare (2.9%), and FUTA (0.6%) on household employee wages. Supports subjectToFUTA flag for quarterly threshold override.

**Limitations:**
- Household employee threshold ($2,800 for 2025) must be verified annually
- FUTA quarterly threshold can be overridden via subjectToFUTA flag when quarterly wage data is known
- FUTA credit reduction for states with outstanding federal loans not modeled
- Does not handle state unemployment tax credit computation
- Employee withholding (income tax, employee share of FICA) assumed correctly withheld
- Does not handle family member or minor exceptions

---

#### 35. Estimated Tax -- `estimatedTax.ts`

**Source:** `shared/authorities/estimatedTax.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateEstimatedQuarterly` | IRC | 6654 | binding | Required annual payment of estimated tax; quarterly installment rules and due dates |
| | Form | Form 1040-ES | explanatory | |
| `calculateSafeHarbor` | IRC | 6654(d) | binding | Safe harbor rules: 100% of prior year tax or 90% of current year tax; 110% prior year for AGI over $150,000 |
| | Form | Form 1040-ES, Estimated Tax Worksheet | explanatory | |

**Scope:**
- `calculateEstimatedQuarterly`: Computes quarterly estimated tax payment amounts based on projected annual tax liability.
- `calculateSafeHarbor`: Determines the minimum required estimated payment to avoid underpayment penalty using safe harbor thresholds.

**Limitations:**
- Does not handle annualized income installment method
- Does not account for fiscal year taxpayers
- Due date adjustments for weekends/holidays not computed
- Prior year AGI threshold for 110% rule ($150,000 / $75,000 MFS) is statutory and not inflation-adjusted
- Does not handle exceptions for farmers and fishermen (66.67% rule)

---

#### 36. Estimated Tax Penalty -- `estimatedTaxPenalty.ts`

**Source:** `shared/authorities/estimatedTaxPenalty.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateEstimatedTaxPenalty` | IRC | 6654 | binding | Underpayment of estimated tax penalty: computed on quarterly shortfalls using federal short-term rate plus 3 percentage points |
| | IRC | 6654(d)(2) | binding | Annualized income installment method: allows taxpayers with uneven income to compute required installments based on income received in each period |
| | Form | Form 2210 | explanatory | |
| | Form | Form 2210 Schedule AI | explanatory | |

**Scope:** Computes the estimated tax underpayment penalty based on quarterly payment shortfalls and the applicable penalty rate. Supports the annualized income installment method (Schedule AI) for taxpayers with uneven income distribution across quarters.

**Limitations:**
- Penalty rate uses current federal short-term rate + 3%; rate must be updated quarterly
- Does not handle waiver requests for reasonable cause or retirement/disability
- Farmers and fishermen special rules (single installment) not modeled
- Does not handle the $1,000 de minimis safe harbor exception

---

#### 37. FEIE -- `feie.ts`

**Source:** `shared/authorities/feie.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateFEIE` | IRC | 911 | binding | Foreign earned income exclusion: qualifying individuals may exclude foreign earned income up to annual limit; foreign housing exclusion/deduction also available |
| | Rev. Proc. | Rev. Proc. 2024-40, Section 3 | binding | Inflation-adjusted FEIE exclusion amount for 2025: $130,000 |
| | Form | Form 2555 | explanatory | |

**Scope:** Computes the foreign earned income exclusion and foreign housing exclusion/deduction for qualifying taxpayers.

**Limitations:**
- Does not validate bona fide residence test or physical presence test (330-day rule)
- Housing exclusion base amount and limitation by location not fully modeled
- Self-employed taxpayers use housing deduction instead of exclusion; distinction simplified
- Exclusion reduces income but stacking rule (IRC 911(d)(7)) increases effective rate on remaining income
- Revocation of election has 5-year lockout; not tracked

---

#### 38. Cancellation of Debt -- `cancellationOfDebt.ts`

**Source:** `shared/authorities/cancellationOfDebt.yaml`

| Function | Authority | Reference | Weight | Description |
|----------|-----------|-----------|--------|-------------|
| `calculateCancellationOfDebt` | IRC | 61(a)(11) | binding | Cancellation of indebtedness income included in gross income |
| | IRC | 108 | binding | Exclusions from COD income: bankruptcy (108(a)(1)(A)), insolvency (108(a)(1)(B)), qualified principal residence indebtedness (108(a)(1)(E)), qualified farm indebtedness (108(a)(1)(C)) |
| | Form | Form 982 | explanatory | |

**Scope:** Computes taxable cancellation of debt income after applying applicable exclusions under IRC 108, and determines tax attribute reductions.

**Limitations:**
- Insolvency exclusion limited to extent of insolvency; requires balance sheet data as input
- Tax attribute reduction ordering rules (IRC 108(b)) simplified
- QPRI exclusion expired after 2025 for most discharges; effective date must be verified
- Does not handle related-party debt cancellation rules
- Student loan discharge exclusion (IRC 108(f)(5)) for 2021-2025 may be applicable
- 1099-C reporting reconciliation not modeled

---

## Constants File: `shared/src/constants/tax2025.ts`

The constants file contains inline citation comments referencing the underlying authorities for every numeric threshold, rate, and limit. Key authority references embedded in the constants include:

| Constant Group | Primary Authority | Rev. Proc. / Notice |
|---------------|-------------------|---------------------|
| `TAX_BRACKETS_2025` | IRC 1(a)-(d), (j); TCJA 11001 | Rev. Proc. 2024-40, Section 3.01, Table 1 |
| `STANDARD_DEDUCTION_2025` | IRC 63(c); TCJA 11021 | Rev. Proc. 2024-40, Section 3.02, Table 5 |
| `ADDITIONAL_STANDARD_DEDUCTION` | IRC 63(f) | Rev. Proc. 2024-40, Section 3.02 |
| `DEPENDENT_STANDARD_DEDUCTION` | IRC 63(c)(5) | Rev. Proc. 2024-40, Section 3.02 |
| `SE_TAX` | IRC 1401(a)-(b), 1402(a), 3101(b)(2) | Rev. Proc. 2024-40; SSA COLA announcement |
| `QBI` | IRC 199A; TCJA 11011 | Rev. Proc. 2024-40, Section 3.29 |
| `HOME_OFFICE` | IRC 280A(c) | Rev. Proc. 2013-13 |
| `VEHICLE` | IRC 162, 274(d) | IRS Notice 2024-79 |
| `SCHEDULE_A` | IRC 164(b)(6), 163(h)(3), 170, 213(a); TCJA 11042-11043 | -- |
| `CHILD_TAX_CREDIT` | IRC 24(a), (b), (d), (h); TCJA 11022 | Rev. Proc. 2024-40, Section 3.23 |
| `EDUCATION_CREDITS` | IRC 25A(b), (c), (i) | Rev. Proc. 2024-40, Sections 3.24-3.25 |
| `ESTIMATED_TAX` | IRC 6654(c)-(d) | -- |
| `HSA` | IRC 223(b), (b)(3) | Rev. Proc. 2024-25 |
| `STUDENT_LOAN_INTEREST` | IRC 221 | Rev. Proc. 2024-40, Section 3.20 |
| `IRA` | IRC 219(b)(5), (g) | Rev. Proc. 2024-40, Sections 3.08-3.10 |
| `CAPITAL_GAINS_RATES` | IRC 1(h)(1)(B)-(E) | Rev. Proc. 2024-40, Section 3.12, Table 3 |
| `FORM_4797` | IRC 1231, 1245, 1250 | -- |
| `NIIT` | IRC 1411 | -- (not indexed) |
| `EARLY_DISTRIBUTION` | IRC 72(t) | -- |
| `ACTC` | IRC 24(d) | -- |
| `DEPENDENT_CARE` | IRC 21 | -- (not indexed) |
| `SAVERS_CREDIT` | IRC 25B | Rev. Proc. 2024-40, Section 3.06 |
| `CLEAN_ENERGY` | IRC 25D; IRA 13302 | -- |
| `HSA_DISTRIBUTIONS` | IRC 223(f)(2), (f)(4) | -- |
| `SCHEDULE_D` | IRC 1211(b), 1212(b) | -- |
| `SOCIAL_SECURITY` | IRC 86, 86(c) | -- (not indexed) |
| `EDUCATOR_EXPENSES` | IRC 62(a)(2)(D) | Rev. Proc. 2024-40, Section 3.19 |
| `SCHEDULE_E` | IRC 469(i) | -- (not indexed) |
| `EV_CREDIT` | IRC 30D, 25E; IRA 13401-13402 | -- |
| `ENERGY_EFFICIENCY` | IRC 25C; IRA 13301 | -- |
| `FOREIGN_TAX_CREDIT` | IRC 901, 904(j) | -- |
| `EXCESS_SS_TAX` | IRC 31(b), 3101(a) | SSA COLA announcement |
| `ALIMONY` | IRC 215, 71 (pre-TCJA); TCJA 11051 | -- |
| `ESTIMATED_TAX_PENALTY` | IRC 6654, 6621(a)(2) | -- |
| `KIDDIE_TAX` | IRC 1(g) | Rev. Proc. 2024-40, Section 3.03 |
| `FEIE` | IRC 911 | Rev. Proc. 2024-40, Section 3.36 |
| `SCHEDULE_H` | IRC 3111, 3101, 3301, 3121(x) | SSA announcement |
| `NOL` | IRC 172(a), (b)(2); TCJA 13302 | -- |
| `ADOPTION_CREDIT` | IRC 23 | Rev. Proc. 2024-40, Section 3.35 |
| `DEPENDENT_CARE_FSA` | IRC 129 | -- |
| `PREMIUM_TAX_CREDIT` | IRC 36B; ACA 1401; IRA 12001 | Rev. Proc. 2024-35; Rev. Proc. 2024-40, Table 5; HHS 2024 FPL |
| `SCHEDULE_1A` | OBBBA 101-104 | -- |
| `HOME_SALE_EXCLUSION` | IRC 121 | -- |
| `CHARITABLE_AGI_LIMITS` | IRC 170(b)(1) | -- |
| `CANCELLATION_OF_DEBT` | IRC 61(a)(11), 108, 6050P | -- |
| `EXCESS_CONTRIBUTION` | IRC 4973(a), (g) | -- |
| `DISTRIBUTION_529` | IRC 529(c)(3), (c)(6) | -- |
| `QOZ` | IRC 1400Z-2; TCJA 13823 | -- |

---

## Cross-Reference Index

### IRC Sections Referenced

| IRC Section | Module(s) |
|-------------|-----------|
| 1 | form1040 |
| 2(a) | deceasedSpouse |
| 2(b) | filingStatusValidation |
| 1(a)-(d) | brackets |
| 1(g) | kiddieTax |
| 1(h) | capitalGains, scheduleD |
| 1(h)(1)(E) | capitalGains, form4797 |
| 21 | dependentCare |
| 21(d)(2) | dependentCare |
| 22 | scheduleR |
| 23 | adoptionCredit |
| 24 | credits |
| 24(d) | credits |
| 25A | credits |
| 25B | saversCredit |
| 25C | energyEfficiency |
| 25D, 25D(c) | cleanEnergy |
| 25E | evCredit |
| 30C | form8911 |
| 30D | evCredit |
| 32 | eitc |
| 36B | premiumTaxCredit |
| 62 | form1040 |
| 63 | form1040 |
| 86 | socialSecurity |
| 108 | cancellationOfDebt |
| 61 | scheduleF |
| 61(a)(11) | cancellationOfDebt |
| 121 | homeSale |
| 129 | dependentCare |
| 162 | scheduleC, vehicle, scheduleF |
| 163(d) | investmentInterest |
| 163(h) | scheduleA |
| 164 | scheduleA |
| 170 | scheduleA |
| 179 | k1 |
| 199A | qbi |
| 213 | scheduleA |
| 223 | hsaForm8889 |
| 223(f)(2) | hsaDistributions |
| 223(f)(4) | hsaDistributions |
| 274 | scheduleC |
| 274(d) | vehicle |
| 280A | scheduleC, homeOffice |
| 408(d)(1)-(2) | form8606 |
| 408A | form8606 |
| 469 | scheduleE |
| 469(i) | scheduleE |
| 701-704 | k1 |
| 901 | foreignTaxCredit |
| 904 | foreignTaxCredit |
| 904(d) | foreignTaxCredit |
| 911 | feie |
| 1211(b) | scheduleD |
| 1212(b) | scheduleD |
| 1231 | form4797 |
| 1245 | form4797 |
| 1250 | form4797 |
| 1366 | k1 |
| 1401(a)-(b) | scheduleSE |
| 1402(a) | scheduleSE |
| 1411 | niit |
| 3101(a) | form4137, scheduleH |
| 3101(b) | form4137, scheduleH |
| 3101(b)(2) | additionalMedicare |
| 3121(q) | form4137 |
| 3111 | scheduleH |
| 3121(x) | scheduleH |
| 3301 | scheduleH |
| 4973(a) | form5329 |
| 4973(g) | form5329 |
| 6013(a)(2) | deceasedSpouse |
| 6654 | estimatedTax, estimatedTaxPenalty |
| 6654(d) | estimatedTax |
| 6654(d)(2) | estimatedTaxPenalty |
| 7703(b) | filingStatusValidation |
| 11042 (TCJA) | scheduleA |

### Revenue Procedures and Notices Referenced

| Reference | Module(s) |
|-----------|-----------|
| Rev. Proc. 2024-40, Section 3.01 | brackets |
| Rev. Proc. 2024-40, Section 3 | scheduleSE, kiddieTax, feie |
| Rev. Proc. 2024-40, Section 3.12 | capitalGains |
| Rev. Proc. 2024-40, Sections 3.04-3.07 | eitc |
| Rev. Proc. 2024-40, Section 3.29 | qbi |
| Rev. Proc. 2024-40, Sections 3.23-3.27 | credits |
| Rev. Proc. 2024-40, Section 3.06 | saversCredit |
| Rev. Proc. 2024-40, Section 3.35 | adoptionCredit |
| Rev. Proc. 2024-35 | premiumTaxCredit |
| Rev. Proc. 2024-25 | hsaForm8889 |
| Rev. Proc. 2013-13 | homeOffice |
| IRS Notice 2024-79 | vehicle |

### Statutes (Non-IRC) Referenced

| Statute | Module(s) |
|---------|-----------|
| ACA Section 1401 | premiumTaxCredit |
| IRA Section 12001 | premiumTaxCredit |
| OBBBA Section 101 (No Tax on Tips) | schedule1A |
| OBBBA Section 102 (No Tax on Overtime) | schedule1A |
| OBBBA Section 103 (Car Loan Interest) | schedule1A |
| OBBBA Section 104 (Enhanced Senior Deduction) | schedule1A |

### Treasury Regulations Referenced

| Regulation | Module(s) |
|------------|-----------|
| Treas. Reg. 1.274-5T | vehicle |

### IRS Forms Referenced

| Form | Module(s) |
|------|-----------|
| Form 1040 | form1040, brackets |
| Schedule C (Form 1040) | scheduleC |
| Schedule E (Form 1040) | scheduleE |
| Schedule K-1 (Form 1065 / 1120-S / 1041) | k1 |
| Social Security Benefits Worksheet | socialSecurity |
| Schedule D (Form 1040) | scheduleD |
| Schedule A (Form 1040) | scheduleA |
| Schedule SE (Form 1040) | scheduleSE |
| Schedule H (Form 1040) | scheduleH |
| Schedule EIC (Form 1040) | eitc |
| Schedule 8812 (Form 1040) | credits |
| Schedule 1-A (Form 1040) | schedule1A |
| Schedule F (Form 1040) | scheduleF |
| Schedule R (Form 1040) | scheduleR |
| Form 1040-ES | estimatedTax |
| Form 2106 | vehicle |
| Form 2210 | estimatedTaxPenalty |
| Form 2210 Schedule AI | estimatedTaxPenalty |
| Form 2441 | dependentCare |
| Form 4137 | form4137 |
| Form 2555 | feie |
| Form 4797 | form4797 |
| Form 4952 | investmentInterest |
| Form 5329 | form5329 |
| Form 5695 | cleanEnergy, energyEfficiency |
| Form 8606 | form8606 |
| Form 8615 | kiddieTax |
| Form 8829 | homeOffice |
| Form 8839 | adoptionCredit |
| Form 8863 | credits |
| Form 8880 | saversCredit |
| Form 8911 | form8911 |
| Form 8936 | evCredit |
| Form 8959 | additionalMedicare |
| Form 8960 | niit |
| Form 8962 | premiumTaxCredit |
| Form 8995 / 8995-A | qbi |
| Form 982 | cancellationOfDebt |
| Form 1099-SA | hsaDistributions |

### IRS Publications Referenced

| Publication | Module(s) |
|-------------|-----------|
| Publication 501 | filingStatusValidation |
| Publication 523 | homeSale |
| Publication 596 | eitc |
| Publication 915 | socialSecurity |

---

*Last updated: 2026-03-22 | 45 authority-mapped modules (80 engine modules total) + 1 constants file | Engine: 6,100+ tests across 139 files*
