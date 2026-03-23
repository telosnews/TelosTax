# TelosTax Engine: Design Principles

> Architecture and design philosophy for the TelosTax open-source tax engine.

---

## 1. Ground Truth Hierarchy

Tax law is layered. Not all sources carry equal weight, and conflicts between
sources must be resolved by deferring to the higher authority. The TelosTax
engine follows a strict hierarchy when implementing any tax computation:

1. **Internal Revenue Code (IRC)** -- Primary binding authority. Statutory text
   enacted by Congress. Every computation in the engine must trace to a specific
   IRC section. When the Code speaks directly, no lower authority can override
   it.

2. **Treasury Regulations (Treas. Reg.)** -- Binding interpretive rules issued
   by the Department of the Treasury. Regulations fill gaps left by the IRC with
   detailed rules and definitions (e.g., Treas. Reg. Section 1.1402(a)-1 on
   self-employment net earnings). The engine treats final and temporary
   regulations as authoritative unless they conflict with the Code.

3. **Revenue Procedures (Rev. Proc.)** -- Binding inflation-adjusted constants
   and procedural guidance published annually by the IRS. Rev. Proc. 2024-40
   contains all Tax Year 2025 bracket thresholds, standard deduction amounts,
   credit limits, phase-out ranges, and other indexed values. The engine's
   `tax2025.ts` constants file is derived directly from the applicable Revenue
   Procedure.

4. **IRS Forms and Instructions** -- Procedural authority. Line-by-line
   worksheets implement the IRC rules into concrete computation steps. The
   engine follows worksheet algorithms (e.g., the Qualified Dividends and
   Capital Gain Tax Worksheet, the Social Security Benefits Worksheet) to ensure
   output matches what the IRS expects on filed returns.

5. **IRS Publications** -- Explanatory, non-binding guidance. Publications
   (e.g., Pub. 17, Pub. 590-A) are useful for examples and edge-case
   clarification, but they are not legal authority. When a Publication conflicts
   with the IRC, a Treasury Regulation, or a Revenue Procedure, the engine
   relies on the higher authority.

This hierarchy is not merely documentation. It is enforced in the codebase
through `@authority` JSDoc blocks, citation comments on constants, and
machine-readable authority YAML files. Every function and every constant should
be traceable upward through the hierarchy to its legal source.

---

## 2. Pure Function Architecture ("Option B")

The TelosTax engine is built on a strict pure-function architecture. This was a
deliberate design choice (referred to internally as "Option B") that separates
computation from persistence and side effects.

### Core Principles

- **All engine modules are pure functions.** Given a `TaxReturn` input, each
  module produces a deterministic output with no side effects. The same input
  always yields the same output, regardless of when or where the function is
  called.

- **No database access, no network calls, no mutable state** in the calculation
  layer. The engine never reads from or writes to a database. It never makes
  HTTP requests. It never modifies shared state.

- **The engine is a standalone library** (`@telostax/engine`) that can be
  imported and used independently of any server, UI, or storage layer. A
  researcher can `import { calculateTax } from '@telostax/engine'` and compute
  a complete federal return in a single function call.

- **The server layer handles persistence and PII.** SQLite storage, user
  authentication, and personally identifiable information live in the server
  layer, which is architecturally separate from the engine. The engine never
  stores, transmits, or logs taxpayer data.

### Why This Matters

| Benefit                    | How Pure Functions Enable It                     |
| -------------------------- | ------------------------------------------------ |
| Easy testing               | No mocks needed; pass input, assert output       |
| Reproducible results       | Deterministic by construction                    |
| Academic verification      | Researchers can run the engine without a server   |
| No PII in open-source code | Engine has no concept of storage or identity      |
| Parallelizable             | No shared mutable state                          |
| Auditable                  | Every output is a function of its inputs alone   |

---

## 3. Audit Trail Philosophy

A tax engine that produces correct numbers is necessary but not sufficient. Tax
professionals, academics, and regulators need to verify *why* the engine
produces those numbers. The TelosTax audit trail is designed to make every
computed value traceable to its legal authority.

### Authority References in Code

- **`@authority` JSDoc blocks** on every exported engine function. Each block
  cites the IRC section, Treasury Regulation, or Form/line reference that
  governs the computation.

- **Citation comments on every constant** in `tax2025.ts`. Each bracket
  threshold, deduction amount, and phase-out range includes a comment citing the
  Revenue Procedure and section from which it was derived.

- **Machine-readable authority graph** in YAML files
  (`shared/authorities/*.yaml`). These files map engine functions and constants
  to their legal authorities in a structured format suitable for automated
  validation and documentation generation.

### Test-Level Verification

- **ATS scenario tests** validate engine output against IRS-published
  Acceptance Testing System reference outputs. These are the same scenarios the
  IRS uses to certify commercial tax software.

- **Worksheet trace tests** mirror IRS worksheets step-by-step. Each
  intermediate value in a worksheet (e.g., line 5 of the QDCG worksheet) is
  individually asserted, not just the final result.

- **Rev. Proc. constants validation tests** verify that every inflation-adjusted
  value in `tax2025.ts` matches the published Revenue Procedure. This catches
  transcription errors before they propagate into calculations.

---

## 4. Type-Driven Design

The engine uses TypeScript's type system as a first line of defense against
invalid states. Rather than validating data at runtime after it has already
caused incorrect calculations, the type system prevents entire categories of
errors at compile time.

### Key Type Structures

- **`TaxReturn`** -- The master input type. Captures all possible inputs for an
  individual federal return: W-2 wage statements, 1099 information returns
  (INT, DIV, R, MISC, NEC, B, SSA, G), K-1 partnership/S-corp income,
  self-employment businesses, itemized deductions, tax credits, dependents,
  health coverage, estimated payments, and more.

- **`CalculationResult`** -- The master output type. Provides a full breakdown
  of the computed return: `Form1040Result` plus all sub-schedule results
  (Schedule 1 through Schedule SE), all credit computations, and all
  intermediate values needed for audit trail purposes.

- **Union types for enumerations.** Filing status, 1099-R distribution codes,
  business entity types, and other categorical values are expressed as TypeScript
  union types (e.g., `'single' | 'marriedFilingJointly' | 'marriedFilingSeparately' | 'headOfHousehold' | 'qualifyingSurvivingSpouse'`).
  This prevents invalid states at compile time rather than runtime.

- **Zod schemas on the server layer.** Incoming data from the UI or API is
  validated with Zod schemas before being passed to the engine. This provides
  runtime validation at the boundary while keeping the engine itself free of
  validation logic.

### Design Rationale

Complete type definitions serve a dual purpose. For developers, they provide
autocompletion, refactoring safety, and compile-time error detection. For
reviewers and academics, the type definitions in `shared/src/types/index.ts`
serve as a precise, machine-readable specification of what the engine accepts
and what it produces.

---

## 5. Defensive Computation

Tax calculations involve money, and money demands precision. The engine employs
several defensive patterns to prevent computational errors.

### Rounding

- **`round2()` helper** used throughout the engine for 2-decimal-place rounding.
  This prevents floating-point drift that would otherwise accumulate across
  multi-step calculations. Every intermediate dollar amount that feeds into a
  subsequent calculation is rounded to the cent.

### Floor and Ceiling Guards

- **`Math.max(0, ...)` floor-at-zero pattern.** Many tax computations can
  produce negative intermediate values that must be treated as zero (e.g., a
  negative taxable income, a negative credit amount). The engine applies
  `Math.max(0, ...)` wherever the IRC or worksheet instructions specify that a
  value cannot be less than zero.

- **`Math.min(cap, ...)` statutory cap enforcement.** Contribution limits,
  deduction limits, and credit limits are enforced with `Math.min()`. For
  example, the Child Tax Credit per qualifying child is capped at the statutory
  amount regardless of other factors.

### Phase-Out Calculations

Phase-out computations use consistent, well-tested patterns:

- **Linear reduction:** Credit or deduction reduced by a fixed rate per dollar
  of income above a threshold.
- **Step functions:** Benefit eliminated entirely above a threshold.
- **Floor and ceiling:** Phase-out result is floored at zero and ceilinged at
  the maximum benefit amount.

### Edge Case Handling

- Empty arrays (e.g., no W-2s, no dependents) return zero, not errors.
- Missing optional fields default to zero or the appropriate neutral value.
- Division by zero is guarded wherever denominators could be zero.

---

## 6. Tax Year Isolation

Tax law changes every year. Bracket thresholds are adjusted for inflation.
Credits are added, modified, or sunset. The engine is designed so that each tax
year's rules are fully isolated.

### Constants File Per Tax Year

All tax-year-specific constants live in a single file: `tax2025.ts` for Tax Year
2025. This file contains:

- Income tax bracket thresholds and rates
- Standard deduction amounts
- AMT exemption amounts and phase-out thresholds
- Credit amounts and phase-out ranges
- Contribution limits (IRA, HSA, etc.)
- Social Security wage base and tax rates
- Every other inflation-adjusted or legislatively set value

### No Hardcoded Constants in Engine Logic

Engine functions receive constants as imports, never as inline literals. A
function computing the Child Tax Credit imports the credit amount and phase-out
threshold from the constants file. The computation logic itself is
year-agnostic.

### Future Multi-Year Support

Supporting Tax Year 2026 requires adding a `tax2026.ts` file with updated
constants and parametrizing the import path. The engine functions themselves do
not change unless Congress changes the underlying computation rules. This
separation means that annual inflation adjustments (published each fall in the
Revenue Procedure) can be incorporated by updating a single file.

---

## 7. Comparison with Existing Open-Source Tax Engines

The landscape of open-source and publicly available tax computation tools is
limited. TelosTax occupies a distinct position.

| Project                        | Nature                           | Scope                                    | Audit Trail       |
| ------------------------------ | -------------------------------- | ---------------------------------------- | ------------------ |
| **IRS Direct File**            | Government-built, closed-source  | Simple returns (W-2, SSA, limited credits) | Not applicable     |
| **PSLmodels Tax-Calculator**   | Academic microsimulation (Python)| Policy analysis, aggregate statistics     | Policy parameters  |
| **tax-logic-core**             | Minimal open-source engine       | Limited income types and credits          | Minimal            |
| **TelosTax Engine**            | Open-source TypeScript library   | Complete individual return (~85-90% filer coverage) | Full authority chain |

### How TelosTax Differentiates

- **Complete individual return coverage.** The engine handles the income types,
  deductions, and credits that cover an estimated 85-90% of individual filers,
  including self-employment, rental income, capital gains, retirement
  distributions, and a wide range of credits.

- **Full audit trail.** Every computed value traces to IRC, Treasury Regulation,
  Revenue Procedure, or Form/line authority through code-level citations and
  machine-readable YAML.

- **IRS ATS validation.** Engine output is tested against IRS Acceptance Testing
  System scenarios, the same reference data used to certify commercial tax
  software.

- **Machine-readable authority citations.** The authority graph is not just
  documentation; it is structured data that can be queried, validated, and used
  to generate compliance reports.

---

## 8. Engine Statistics

| Metric                              | Value          |
| ----------------------------------- | -------------- |
| Engine modules in `shared/src/engine/` | 80           |
| Constants files in `shared/src/constants/` | 103      |
| Implemented tax features             | 90+           |
| Total tests                          | 6,100+        |
| Test files                           | 139           |
| Wizard step components               | 105           |
| IRS PDF templates                    | 41            |
| State PDF templates                  | 43            |
| State tax calculators                | All 50 states + DC |
| Authority YAML files                 | 45            |
| Estimated filer coverage             | ~85-90% (by income types and credits supported) |

---

## Contributing

This document describes the principles that govern the TelosTax engine
architecture. Contributors should ensure that new code adheres to these
principles:

1. Every new computation must cite its legal authority in an `@authority` JSDoc
   block.
2. Every new constant must include a citation comment referencing the source
   (Rev. Proc., IRC section, etc.).
3. All engine functions must remain pure -- no side effects, no database access,
   no network calls.
4. New constants go in the tax year constants file, not inline in engine logic.
5. Defensive computation patterns (`round2()`, `Math.max(0, ...)`,
   `Math.min(cap, ...)`) must be applied where applicable.
6. Tests must assert intermediate values, not just final results, to maintain
   worksheet-level traceability.
