# TelosTax Scope Matrix

**Tax Year:** 2025 | **Engine Version:** 1.0 | **Last Updated:** 2026-03-20

> **See also:** [`KNOWN-LIMITATIONS.md`](./KNOWN-LIMITATIONS.md) for detailed gap analysis with rationale.

---

## Summary

TelosTax ships with **90+ implemented tax features** across **80 engine modules** (66 federal + 14 state), validated by **6,100+ tests** spanning **139 test files**. The engine supports all five filing statuses (Single, MFJ, MFS, HoH, QSS) for federal tax year 2025, with full state tax coverage for **all 50 states + DC**.

This document exists to prevent scope confusion. If a feature is listed as unsupported below, it was **intentionally deferred** with a documented rationale -- not forgotten. Open an issue only if you believe the rationale is wrong, not to report it as missing.

### At a Glance

| Metric | Value |
|---|---|
| Implemented features | 90+ |
| Engine modules (federal) | 66 |
| Engine modules (state) | 14 (covering all 50 states + DC) |
| Constants files | 103 |
| IRS PDF templates | 41 |
| State PDF templates | 43 |
| Wizard step components | 105 |
| Test files | 139 |
| Total tests | 6,100+ |
| Filing statuses | 5 (Single, MFJ, MFS, HoH, QSS) |
| Tax year | 2025 |

---

## Income Types

| Item | Status | Form / Schedule | Notes |
|---|---|---|---|
| W-2 wages | ✅ | W-2 | Full support including multiple W-2s |
| Interest income | ✅ | 1099-INT | |
| Dividends | ✅ | 1099-DIV | Ordinary, qualified dividends, and capital gain distributions |
| Stock and bond sales | ✅ | 1099-B | Short-term and long-term; cost basis tracking |
| Crypto sales | ✅ | 1099-DA | Treated as property dispositions |
| Retirement distributions | ✅ | 1099-R | Taxable portion calculation |
| Unemployment and government payments | ✅ | 1099-G | |
| Prizes, awards, rents, royalties | ✅ | 1099-MISC | Box 1 rents → Schedule E; Box 2 royalties → Schedule E; Box 3 other income → Schedule 1 |
| HSA distributions | ✅ | 1099-SA | Qualified and non-qualified |
| 529 distributions | ✅ | 1099-Q | IRC §529(c)(3)(B) pro-rata exclusion ratio; 10% penalty on taxable earnings |
| Cancellation of debt | ✅ | 1099-C | With Form 982 COD exclusions (insolvency, bankruptcy, QPRI, farm) |
| Social Security benefits | ✅ | SSA-1099 | Provisional income method for taxability; MFS "lived apart" exception handled |
| Business income | ✅ | Schedule C | Multiple businesses supported; COGS; full Lines 1-42 |
| Rental income | ✅ | Schedule E | Passive loss limitation ($25k allowance with AGI phase-out) |
| Pass-through income | ✅ | Schedule K-1 | Partnership, S-Corp, and estate/trust; Box 13 deductions (charitable, investment interest, §1231 loss) and Box 15 credits (foreign tax, other credits) |
| Gambling winnings | ✅ | W-2G | Losses limited to winnings |
| Alimony received (pre-2019 agreements) | ✅ | Line 2a | Divorce/separation agreements executed before 2019 |
| Tips income | ✅ | Form 4137 | Unreported tip FICA computation with SS wage base coordination |
| Overtime income | ✅ | | Relevant for OBBBA Schedule 1-A provisions |
| Farm income | ✅ | Schedule F | 23 expense categories; SE tax integration; cash method |
| Original issue discount | ✅ | 1099-OID | OID + other periodic interest; acquisition premium offset; early withdrawal penalty flows to Schedule 1 |
| Installment sale income | ✅ | Form 6252 | Gross profit ratio computation; depreciation recapture ordering; multi-year payment tracking |
| Farm rental income (passive) | ✅ | Form 4835 | Passive farm rental for non-materially-participating landowners; flows through Schedule E |

---

## Deductions

| Item | Status | Form / Schedule | Notes |
|---|---|---|---|
| Standard deduction | ✅ | | All statuses; 65+/blind add-on; dependent standard deduction; OBBBA $15,750/$31,500 amounts |
| SALT (state and local taxes) | ✅ | Schedule A | OBBBA $40,000 cap ($20,000 MFS); phase-down above $500k MAGI at 30% rate; $10,000/$5,000 floor |
| Mortgage interest | ✅ | Schedule A | $750k/$375k acquisition debt limits; mortgage insurance premiums |
| Charitable contributions | ✅ | Schedule A, Form 8283 | AGI percentage limits (cash 60%, property 30%, etc.); Form 8283 per-item non-cash detail with Section A/B classification, 5-year FIFO carryforward |
| Medical and dental expenses | ✅ | Schedule A | 7.5% AGI floor |
| Casualty and theft losses | ✅ | Schedule A, Form 4684 | $100/event floor, 10% AGI floor, FEMA disaster requirement; personal and business property |
| Business expenses | ✅ | Schedule C | Full expense deduction support (Lines 8-27) |
| Home office deduction | ✅ | Schedule C / Form 8829 | Simplified ($5/sqft) and regular (three-tier cascade) methods; MACRS depreciation on home; prior-year carryovers |
| Vehicle expenses | ✅ | Schedule C / Form 4562 Part V | Standard mileage ($0.70/mi) and actual with Section 280F limits; MACRS 5-yr; GVW >6,000 lb exception |
| HSA deduction | ✅ | Form 8889 | Self-only and family limits; employer offset; catch-up contributions |
| Student loan interest | ✅ | | $2,500 max; MAGI phaseout |
| Traditional IRA deduction | ✅ | | Active participant phaseout rules; spouse-covered phaseout |
| Educator expenses | ✅ | | $300 limit |
| Alimony paid (pre-2019 agreements) | ✅ | | Above-the-line deduction |
| Early withdrawal penalty | ✅ | | Penalty on early savings withdrawal |
| SE tax deductible half | ✅ | | 50% of self-employment tax |
| QBI deduction (Section 199A) | ✅ | | W-2 wage and UBIA limitations; SSTB rules; multi-business via QBIBusinessEntry[]; AG cooperative patron |
| Schedule 1-A (OBBBA provisions) | ✅ | Schedule 1-A | Tips, overtime, car loan interest, senior deductions with phase-outs |
| Capital loss deduction | ✅ | Schedule D | $3,000 limit ($1,500 MFS); ST/LT carryforward tracked |
| Investment interest expense | ✅ | Form 4952 | Limited to net investment income; QD/LTCG election; carryforward |
| NOL carryforward | ✅ | | 80% of taxable income limitation |
| Depreciation (multi-asset) | ✅ | Form 4562 | Section 179 ($1.25M), bonus (100%), MACRS GDS (3/5/7/10/15/20-yr); half-year and mid-quarter conventions; §179 double-dip prevention; prior-year convention tracking |
| FEIE housing exclusion | ✅ | Form 2555 | $130K exclusion + housing; stacking rule (Section 911(f)) |
| Moving expenses (military) | ✅ | Form 3903 | Active-duty military only |
| Self-employed health insurance (Form 7206) | ✅ | Form 7206 | Full 3-part calculation: premium aggregation (medical/dental/vision + LTC age-based limits + Medicare), monthly proration, net profit limitation per IRC §162(l)(2)(A); PTC/APTC interaction; MFJ per-person LTC splitting |
| Solo 401(k) / SEP-IRA | ✅ | | Full limit computation; employee + employer contributions; age 50+ catch-up; age 60-63 super catch-up (SECURE 2.0); Form 5500-EZ |
| Archer MSA deduction | ✅ | Form 8853 | Coverage-type rates (65%/75%); HDHP deductible limits; partial-year proration; employer contribution offset; excess contribution tracking |
| Sales tax SALT alternative | ✅ | Schedule A | IRC §164(b)(5)(I); toggle between income tax and sales tax as SALT component; IRS table lookup or actual receipts |
| Nonbusiness bad debt | ✅ | Schedule D | Worthless debt treated as short-term capital loss; IRC §166(d) |
| Apply refund to next year | ✅ | Form 1040 Line 36 | All or partial refund applied to next year's estimated tax |

---

## Credits

| Item | Status | Form / Schedule | Notes |
|---|---|---|---|
| Child Tax Credit (CTC) | ✅ | | $2,000 per qualifying child; phaseout at $200K/$400K |
| Other Dependents Credit (ODC) | ✅ | | $500 per qualifying dependent |
| Additional Child Tax Credit (ACTC) | ✅ | Schedule 8812 | Refundable portion of CTC |
| Earned Income Tax Credit (EITC) | ✅ | Schedule EIC | 0 to 3 qualifying children; investment income test |
| American Opportunity Tax Credit (AOTC) | ✅ | Form 8863 | 40% refundable; 4-year limit |
| Lifetime Learning Credit (LLC) | ✅ | Form 8863 | Nonrefundable; no year limit |
| Dependent care credit | ✅ | Form 2441 | Full implementation: employer benefits Part III, student/disabled spouse, MFS lived-apart |
| Saver's credit | ✅ | Form 8880 | Retirement savings contribution credit; 50%/20%/10% rates |
| Residential clean energy credit | ✅ | Form 5695 Part I | Solar, wind, geothermal, battery storage, fuel cell; prior year carryforward and tax limitation per IRC §25D(c) |
| EV credit (new vehicles) | ✅ | Form 8936 | MSRP and income limits; final assembly; battery/mineral requirements |
| EV credit (used vehicles) | ✅ | Form 8936 | $4,000 max; price and income limits |
| Energy efficiency home improvement | ✅ | Form 5695 Part II | Per-item and aggregate annual limits |
| Foreign tax credit | ✅ | Form 1116 | Both simplified and full calculation methods; per-category limitations (general/passive) |
| Excess Social Security tax credit | ✅ | | Multiple-employer excess withholding refund |
| Adoption credit | ✅ | Form 8839 | Special needs and foreign adoption rules |
| Premium Tax Credit (PTC) | ✅ | Form 8962 | Full implementation including reconciliation; FPL calculation; APTC repayment caps |
| Alt Fuel Vehicle Refueling Credit | ✅ | Form 8911 | 30% of qualified property cost; per-property and tax liability limits |
| Credit for Elderly/Disabled | ✅ | Schedule R | IRC §22; initial amounts reduced by AGI and nontaxable SS/pensions |
| Scholarship Credit | ✅ | IRC §25F | $1,700 per qualifying child; Notice 2025-70 |
| Prior Year Minimum Tax Credit | ✅ | Form 8801 | Net prior-year minimum tax + carryforward; credit limited to regular tax minus current-year AMT; carryforward to next year |

---

## Surtaxes and Penalties

| Item | Status | Form / Schedule | Notes |
|---|---|---|---|
| Self-employment tax | ✅ | Schedule SE | 15.3% (12.4% SS + 2.9% Medicare); 92.35% factor; $176,100 wage base |
| Net Investment Income Tax (NIIT) | ✅ | Form 8960 | 3.8% on NII above $200K/$250K thresholds |
| Additional Medicare Tax | ✅ | Form 8959 | 0.9% on earnings above $200K/$250K thresholds |
| Alternative Minimum Tax (AMT) | ✅ | Form 6251 | Full implementation: Part I (all adjustments 2a-3), Part II (exemption, phase-out, 26%/28% rates), Part III (preferential capital gains rates within AMT); retroactive FTC adjustment |
| Estimated tax penalty | ✅ | Form 2210 | Safe harbor and annualized income methods; annualized income installment method (Schedule AI) supported |
| Kiddie tax | ✅ | Form 8615 | Unearned income of dependents under 19 (or 24 if student) |
| Early distribution penalty | ✅ | Form 5329 | 10% on non-qualified retirement distributions |
| Excess contribution penalties | ✅ | Form 5329 | IRA, HSA, and Coverdell ESA excess contribution penalties |
| 529 non-qualified distribution penalty | ✅ | | 10% on earnings portion of non-qualified distributions (IRC §529(c)(3)(B) pro-rata) |
| Household employee tax | ✅ | Schedule H | Combined employer+employee SS (12.4%) and Medicare (2.9%); FUTA (0.6%); subjectToFUTA flag for quarterly threshold override |
| COD income exclusions | ✅ | Form 982 | Insolvency, bankruptcy, and other exclusions |
| Unreported tip FICA tax | ✅ | Form 4137 | Social Security and Medicare tax on unreported tip income |

---

## Special Calculations and Forms

| Item | Status | Form / Schedule | Notes |
|---|---|---|---|
| Capital gains and losses | ✅ | Schedule D | Short-term/long-term netting; carryforward tracking; 25% unrecaptured §1250 rate zone; 0%/15%/20% preferential rates |
| Social Security taxability | ✅ | Worksheet | Provisional income method; up to 85% taxable; MFS "lived apart" exception supported |
| Sale of home exclusion | ✅ | Section 121 | $250K/$500K exclusion; ownership and use tests |
| Foreign Earned Income Exclusion | ✅ | Form 2555 | Bona fide residence and physical presence tests; housing exclusion; stacking rule |
| Qualified Opportunity Zones | ✅ | Form 8997 | Informational tracking only |
| Nondeductible IRA and Roth conversions | ✅ | Form 8606 | Pro-rata rule for basis tracking |
| Form 8283 (Non-Cash Charitable) | ✅ | Form 8283 | Section A (≤$5,000) and Section B (>$5,000) classification; category-specific AGI limits (60% cash, 50% ordinary, 30% capital gain); 5-year FIFO carryforward |
| Donation Valuation Tool | ✅ | Form 8283 | 170-item database from Salvation Army + Goodwill guides; condition-based FMV (Good/Very Good/Like New); depreciation calculator with fractional year interpolation; slide-over panel integrated into Form 8283 step |
| Business property sales | ✅ | Form 4797 | Section 1231/1245/1250 depreciation recapture; netting; flows to Form 1040 and Schedule D |
| HoH Filing Status Validation | ✅ | | Qualifying person, residency, household cost checks (non-blocking); IRC §2(b), §7703(b) |
| Deceased Spouse Handling | ✅ | | MFJ for year of death, QSS for 2 subsequent years; non-blocking validation; IRC §6013(a)(2), §2(a) |
| Plausibility warnings | ✅ | | Yellow warnings for implausible values based on IRS audit triggers and SOI norms |
| Trace disclosure | ✅ | | Every computed number is explainable with step-by-step derivation |

---

## State Tax Coverage (All 50 States + DC)

| Category | States | Implementation |
|---|---|---|
| No income tax (9) | AK, FL, NV, NH, SD, TN, TX, WA, WY | Zero result in `stateRegistry.ts` |
| Flat tax (13) | AZ, CO, GA, IA, IL, IN, KY, LA, MA, MI, NC, PA, UT | `createFlatTaxCalculator()` factory |
| Progressive tax (20) | AR, DC, DE, ID, KS, ME, MN, MO, MS, MT, ND, NE, NM, OK, OR, RI, SC, VA, VT, WV | `createProgressiveTaxCalculator()` factory with escape-hatch hooks |
| Custom calculators (9) | AL, CA, CT, HI, MD, NJ, NY, OH, WI | Individual files with state-specific logic |

**State features:** Multi-state allocation with part-year proration by days, nonresident source-income-only, credit for taxes paid to other states (two-pass approach), state EITC via `stateEITCRate`, MD county piggyback tax, AL federal tax deduction.

---

## IRS PDF Generation (40 Templates)

| Form | Condition |
|---|---|
| Form 1040 (199 fields) | Always |
| Schedule A | Itemized deductions chosen |
| Schedule B | Interest/dividend payers require listing |
| Schedule 1 | Adjustments or additional income |
| Schedule 2 | Additional taxes (AMT, SE, NIIT, etc.) |
| Schedule 3 | Additional credits or payments |
| Schedule C | Self-employment income |
| Schedule D | Capital gains/losses |
| Schedule E | Rental/royalty/pass-through income |
| Schedule F | Farm income |
| Schedule H | Household employment taxes |
| Schedule R | Credit for elderly/disabled |
| Schedule SE | Self-employment tax |
| Form 1040-V | Payment voucher (balance due) |
| Form 1040-ES | Estimated tax vouchers |
| Form 2210 | Estimated tax penalty |
| Form 2555 | Foreign earned income exclusion |
| Form 3903 | Moving expenses (military) |
| Form 4137 | Unreported tip income |
| Form 4562 | Depreciation and amortization |
| Form 4797 | Sale of business property |
| Form 4868 | Extension of time to file |
| Form 4952 | Investment interest expense |
| Form 5329 | Additional taxes on qualified plans |
| Form 5695 | Energy credits |
| Form 6251 | Alternative minimum tax |
| Form 7206 | Self-employed health insurance |
| Form 8283 | Noncash charitable contributions |
| Form 8582 | Passive activity loss limitations |
| Form 8606 | Nondeductible IRAs |
| Form 8615 | Kiddie tax |
| Form 8839 | Qualified adoption expenses |
| Form 8863 | Education credits |
| Form 8889 | Health savings accounts |
| Form 8911 | EV refueling property credit |
| Form 8936 | Clean Vehicle Credit |
| Form 8949 | Stock/crypto transactions (multi-instance) |
| Form 8962 | Premium Tax Credit |
| Form 982 | Reduction of tax attributes (COD) |
| Form 5500-EZ | Solo 401(k) annual return |

## State PDF Generation (43 Templates)

All 43 income-tax states + DC have declarative field mapping templates in `shared/src/constants/stateFormMappings/`. State forms are conditionally included when the user has a filing obligation for that state.

---

## Filing and Infrastructure

| Item | Status | Notes |
|---|---|---|
| All 5 filing statuses | ✅ | Single, MFJ, MFS, HoH, QSS |
| Tax year 2025 | ✅ | Current year brackets, thresholds, and phaseouts (including OBBBA changes) |
| All 50 states + DC | ✅ | Full coverage: 9 no-tax, 13 flat, 20 progressive, 9 custom calculators |
| Schema migration system | ✅ | Lazy migration on read with version stamping |
| AES-256-GCM encryption | ✅ | All localStorage data encrypted at rest; passphrase lock screen; auto-lock on inactivity |
| PDF password protection | ✅ | Optional encryption for all export types (PDF, JSON, CSV) |
| Prior year import | ✅ | JSON and PDF import with YoY comparison |
| Data import parsers | ✅ | CSV, TXF, FDX formats; brokerage transaction import; duplicate detection |
| Audit risk scoring | ✅ | 20-factor scoring model; every factor sourced from TIGTA reports, GAO studies, or IRS LB&I campaigns; 40 tests |
| Smart Expense Scanner | ✅ | AI-powered transaction categorization and deduction discovery |
| Multi-year support | ❌ | Engine is single-year (2025); historical years require separate bracket/threshold constants |
| E-filing (MeF XML) | ❌ | IRS Modernized e-File XML generation — **explicitly out of scope** |
| Amended returns | ❌ | Form 1040-X not supported |
| IP PIN support | ❌ | Identity Protection PIN is a transmittal-layer concern |

---

## Unsupported Items: Rationale

| Item | Rationale |
|---|---|
| E-filing (MeF XML) | Requires IRS Transmitter Control Code (TCC) approval and strict XML schema compliance. **Explicitly marked out of scope** for this project (not just deferred). |
| Amended returns (Form 1040-X) | Requires diff logic against a previously filed return. Deferred until core filing flow is stable. |
| Multi-year support | Each tax year has unique brackets, phaseouts, and legislative changes. Engine architecture supports extension but only 2025 constants are shipped. |
| IP PIN support | Identity Protection PIN is a transmittal-layer concern, not a calculation concern. Relevant only if e-filing is added. |

---

## Known Limitations Within Supported Features

These are edge cases within otherwise comprehensive modules:

| Feature | Limitation |
|---|---|
| Form 4562 (Depreciation) | No ADS (Alternative Depreciation System); no amortization; no listed property (except vehicles) |
| Capital gains | No 28% collectibles rate |
| AMT (Form 6251) | No AMT foreign tax credit; no AMT net operating loss |
| Foreign tax credit (Form 1116) | No carryback/carryforward; no re-sourcing rules |
| Schedule E (Rentals) | No at-risk rules (Section 465); no material participation tests |
| Home sale (Section 121) | No partial exclusion for reduced maximum (unforeseen circumstances) |
| EITC | No tie-breaker rules when multiple people claim same child |
| Premium Tax Credit | Assumes annual coverage (no monthly proration for coverage gaps) |
| Adoption credit | No multi-year carryforward tracking |
| Form 8606 (IRA basis) | Single-year only; no multi-year basis accumulation |
| Schedule F (Farm) | Cash method only; no accrual method; no optional SE method |
| Charitable (Form 8283) | No private foundation 20% AGI limits |
| Form 5329 (Penalties) | No correction window modeling for returned contributions |

### State-Specific Limitations: New York (IT-201)

| Feature | Limitation |
|---|---|
| IT-203 (Nonresident/Part-Year) | Not supported; engine computes full-year resident (IT-201) only |
| Real Property Tax Credit (IT-214) | Not implemented; requires `rentPaid` / property tax fields not on TaxReturn |
| College Tuition Deduction (IT-272 alt) | Only the credit path (4%, max $400/student) is implemented; the itemized deduction alternative ($10K/student) is not |
| Noncustodial Parent EITC (IT-209) | Not implemented; requires child support payment verification data |
| PTET Credit (Pass-Through Entity Tax) | Not implemented; requires K-1 PTET data from entity-level election |
| NY 529/bond interest additions | Municipal bond interest addback requires bond-level issuer detail not currently captured |
| NY estimated tax penalty | Uses federal Form 2210; no NY-specific penalty calculation |

### State-Specific Limitations: California (540 / 540NR)

| Feature | Limitation |
|---|---|
| Foster Youth Tax Credit (FYTC) | Not implemented |
| Joint Custody Head of Household Credit | Not implemented |
| Pass-Through Entity Tax (AB 2220) | Not implemented; requires entity-level election and K-1 PET credit data |
| CA estimated tax penalty (Form 5805) | Uses federal Form 2210; no CA-specific penalty calculation |
| Schedule CA (540) | Additions/subtractions calculated inline in engine; no separate Schedule CA PDF form mapping |
| Multi-state credit cap | Uses general `allocation.ts` credit-for-other-states; no CA-specific credit limitation worksheet |
| Advanced nonresident source tracing | 540NR uses ratio-based proration; no detailed income-source tracing by category |
| Section 179 conformity | CA $25K limit correctly enforced, but no inventory-method special treatment |
| Bonus depreciation phase-down | Assumes 100% bonus (2025); no 2023-2026 phase-down schedule tracking |

---

## How to Read This Document

- **✅ Supported** means the feature is implemented, tested, and included in the 8,700+ test suite.
- **❌ Not Supported** means the feature was evaluated and intentionally deferred with a documented rationale.
- If you believe a deferred item should be prioritized, open a discussion (not an issue) referencing this document and the rationale above.
- If you find a bug in a supported feature, open an issue with a minimal reproduction case.
