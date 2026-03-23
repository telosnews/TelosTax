# TelosTax Known Limitations

**Last Updated:** 2026-03-20
**Tax Year:** 2025

This document lists tax forms, income types, deductions, credits, and features that TelosTax does **not** currently support. Each item includes a rationale and IRS filer population estimate where available.

---

## Recently Implemented (Cleared from Backlog)

These items were previously planned and have been fully implemented:

| # | Item | Form/IRC | Date Implemented |
|---|---|---|---|
| 1 | Sales tax as SALT alternative | Sched A / IRC §164(b)(5)(I) | 2026-03-06 |
| 2 | Apply refund to next year's estimated tax | 1040 Line 36 | 2026-03-06 |
| 6 | 1099-OID (Original Issue Discount) | 1099-OID | 2026-03-06 |
| 7 | Installment sales | Form 6252 / IRC §453 | 2026-03-06 |
| 8 | Casualties and thefts | Form 4684 / IRC §165 | 2026-03-06 |
| 9 | Farm rental income (passive) | Form 4835 | 2026-03-06 |
| 10 | Coverdell ESA excess contributions | Form 5329 Part II | 2026-03-06 |
| 11 | Nonbusiness bad debt | Sched D / IRC §166(d) | 2026-03-06 |
| — | Prior Year AMT Credit | Form 8801 / IRC §53 | 2026-03-10 |
| — | Archer MSA deduction | Form 8853 | 2026-03-10 |
| — | Scholarship Credit | IRC §25F / Notice 2025-70 | 2026-03-06 |
| — | SECURE 2.0 Emergency Distribution | Notice 2026-13 | 2026-03-06 |

---

## Not Planned — Niche or Low Impact

These items are intentionally deferred due to very low filer population, extreme complexity relative to impact, or post-TCJA irrelevance.

### Income Types

| Item | Form/IRC | Rationale |
|---|---|---|
| Form 6781 — Contracts & Straddles | IRC §1256 | Section 1256 contracts (futures, options) with 60/40 long-term/short-term split. Niche: ~200K filers, primarily professional traders. |
| Form 2439 — Undistributed Capital Gains | IRC §852(b)(3) | Rare: RICs/REITs retaining capital gains and paying tax at entity level. Taxpayer gets credit for tax paid. Very few funds still do this. |
| Canadian Registered Pension | US-Canada Treaty Art. XVIII | Requires treaty-based exclusion computation. Niche cross-border situation. |
| Seller-Financed Loan Interest Income | IRC §453 | Interest received on installment sales the taxpayer originated. Uncommon. |
| Schedule Q (REMIC) | IRC §860D | Real Estate Mortgage Investment Conduit income pass-through. Extremely rare for individual filers. |

### Credits & Deductions

| Item | Form/IRC | Rationale |
|---|---|---|
| Form 8396 — Mortgage Credit Certificate | IRC §25 | State/local government MCC programs. Very limited geographic availability; ~50K filers nationally. |
| D.C. First-Time Homebuyer Credit | IRC §1400C | Expired federally. DC-only provision with limited annual funding. |
| Other Investment Expenses | Misc. | Largely non-deductible post-TCJA (2018-2025). Investment advisory fees, safe deposit box, etc. |
| Form 3800 — General Business Credit | IRC §38 | Aggregation shell for individual business credits (R&D, work opportunity, etc.). Individual credits (8911, 8936) are computed; the consolidation form is not needed for individual filers with simple credit situations. |

### Administrative / Informational Forms

| Item | Form | Rationale |
|---|---|---|
| Form 14039 — Identity Theft Affidavit | IRS administrative | Identity theft reporting form filed separately from the tax return. Not a calculation; IP PIN is supported. |
| Form W-4 Withholding Calculator | IRS tool | Payroll withholding projection. Not part of tax return preparation; could be a standalone planning tool. |
| IRA Calculator / Optimizer Tool | Advisory | Contribution optimization tool. Not a tax form; could be a future sidebar tool. |
| Form 1040-X Amendment Workflow | 1040-X | Full amendment requires line-by-line comparison with original return. Complex workflow; filing instructions reference it but no interactive amendment builder. |

### Post-TCJA Non-Deductible Items

These appear in commercial software but are **not deductible** for tax years 2018-2025 under TCJA:

| Item | Rationale |
|---|---|
| Tax Preparation Fees | TCJA §11045 suspended miscellaneous itemized deductions subject to 2% AGI floor |
| Job-Related / Unreimbursed Employee Expenses | TCJA §11045 suspended (Form 2106 eliminated for most filers) |
| Other Investment Expenses (advisory fees, etc.) | TCJA §11045 suspended |

Some commercial tax software retains these items in its UI for completeness and to capture data if TCJA provisions expire. TelosTax omits them because they have zero tax impact for TY2025.

---

## Partial Implementations

These items have basic support but lack dedicated form calculations:

| Item | Current State | Gap |
|---|---|---|
| Legal Fees | Business legal fees via Schedule C expense categories | No personal legal fee deduction (mostly non-deductible post-TCJA anyway, except employment discrimination, whistleblower, IRS claims) |
| Other Credits (catch-all) | K-1 Box 15 credits flow through | No general "other nonrefundable credit" entry for credits not covered by specific forms |

---

## IRS Bulletin Compliance Notes (2025-43 through 2026-10)

Items from recent IRS guidance that affect TY2025 filing:

| Item | Bulletin | Status |
|---|---|---|
| IRC §25F Scholarship Credit ($1,700) | Notice 2025-70 | **Implemented** (2026-03-06) |
| SECURE 2.0 Emergency Distribution Exception ($1,000) | Notice 2026-13 | **Implemented** (2026-03-06) |
| Prior Year AMT Credit (Form 8801) | IRC §53 | **Implemented** (2026-03-10) |
| Archer MSA Deduction (Form 8853) | IRC §220 | **Implemented** (2026-03-10) |
| §1062 Farmland Sale Estimated Tax Relief | Notice 2026-3 | Not implemented — narrow applicability |
| 100% Bonus Depreciation (OBBBA restoration) | Notice 2026-11 | Already implemented |
| HSA Expansion (bronze/catastrophic as HDHPs) | Notice 2026-5 | Effective 1/1/2026, not TY2025 |
| Trump Accounts (IRC §530A) | Notice 2025-68 | Funding begins 7/4/2026, not TY2025 |
| Q2 2026 underpayment rate drops to 6% | Rev. Rul. 2026-5 | TY2025 penalty rate (7%) is correct |

---

## Version History

| Date | Change |
|---|---|
| 2026-03-10 | Moved all 11 planned items to "Recently Implemented"; added Form 8801 and Archer MSA; removed Casualties from Partial Implementations (now fully implemented via Form 4684) |
| 2026-03-06 | Initial document from IRS Bulletin audit + commercial tax software comparison |
