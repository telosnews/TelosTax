# TelosTax Testing Guide

Comprehensive reference for running, understanding, and extending the TelosTax test suite.

**Total: 139 test files | 6,100+ tests**

---

## Quick Start

```bash
# Run all shared engine tests (fastest, most comprehensive)
cd shared && npx vitest run

# Run all client unit/service tests
cd client && npx vitest run

# Run all server tests
cd server && npx vitest run

# Run E2E tests (requires dev server or auto-starts via Playwright)
cd client && npx playwright test

# Run a specific test file
cd shared && npx vitest run __tests__/irs-tax-table.test.ts

# Watch mode (re-runs on file changes)
cd shared && npx vitest
```

---

## Test Architecture Overview

```
tax-project/
├── shared/__tests__/           89 files — Engine: brackets, forms, credits, states, fuzzing
├── client/src/__tests__/       30 files — Services: import, parsing, AI, audit risk
├── client/e2e/                  9 files — Playwright: wizard flow, accessibility, fuzzer
│   └── scenario-fuzzer/        13 archetypes, 8 generators, PRNG-seeded
└── server/__tests__/            1 file  — PII stripping
```

**Runners:**
- **Vitest** — shared, client unit, server (fast, TypeScript-native)
- **Playwright** — client E2E (Chromium, Firefox, WebKit)

---

## 1. Shared Engine Tests (89 files, ~5,000 tests)

The core of the test suite. Validates every tax calculation module against IRS rules.

### 1.1 Unit Tests — Forms & Schedules (28 files)

Each IRS form/schedule has a dedicated test file with hand-calculated expected values.

```bash
cd shared && npx vitest run __tests__/form1040.test.ts
cd shared && npx vitest run __tests__/scheduleC.test.ts
cd shared && npx vitest run __tests__/amt.test.ts
```

| File | Tests | Coverage |
|------|-------|----------|
| `form1040.test.ts` | ~23 | Main 1040: income, deductions, AGI, tax, refund/owed |
| `scheduleA.test.ts` | ~25 | Itemized deductions, SALT cap, medical 7.5% AGI floor |
| `scheduleC.test.ts` | ~38 | Business income, expenses, home office, vehicle |
| `scheduleSE.test.ts` | ~8 | Self-employment tax, wage base, Additional Medicare |
| `amt.test.ts` | ~76 | Alternative Minimum Tax (Form 6251) |
| `credits.test.ts` | ~18 | CTC, AOTC, Saver's Credit, energy credits |
| `eitc.test.ts` | ~15 | Earned Income Tax Credit, phase-outs |
| `qbi.test.ts` | ~28 | Qualified Business Income deduction (Section 199A) |
| `form4562.test.ts` | ~42 | Depreciation, Section 179, MACRS |
| `form8283.test.ts` | ~32 | Non-cash charitable contributions |
| `form8582.test.ts` | ~58 | Passive activity loss limitations |
| `homeOffice.test.ts` | ~32 | Simplified ($5/sqft) and actual method |
| `vehicle.test.ts` | ~32 | Standard mileage vs. actual expenses |
| `solo401k.test.ts` | ~27 | Solo 401(k) contribution limits |
| `foreignTaxCredit.test.ts` | ~21 | Foreign tax credit (Form 1116) |
| `donationValuation.test.ts` | ~42 | FMV lookup, depreciation calculator |
| `estimatedTax.test.ts` | ~6 | Quarterly voucher calculations |
| `estimatedTaxPenalty.test.ts` | ~25 | Underpayment penalty, safe harbor |
| `military.test.ts` | ~18 | Combat zone exclusion, moving expenses |
| `k1-box13-15.test.ts` | ~48 | K-1 pass-through income routing |

### 1.2 State Tax Tests (5 files)

```bash
cd shared && npx vitest run __tests__/state-tax.test.ts
cd shared && npx vitest run __tests__/ca.test.ts
cd shared && npx vitest run __tests__/smoke-states.test.ts
```

| File | Tests | Coverage |
|------|-------|----------|
| `state-tax.test.ts` | ~138 | All 50 states: no-tax, flat, progressive, custom |
| `state-tax-progressive.test.ts` | ~68 | Progressive state bracket calculations |
| `state-allocation.test.ts` | ~56 | Multi-state: part-year, nonresident, credit for taxes paid |
| `ca.test.ts` | ~175 | California Form 540: 10+ brackets, SDI, Mental Health surcharge |
| `smoke-states.test.ts` | ~27 | Quick validation for all 50 states + DC |

### 1.3 Integration Tests (6 files)

Test interactions between modules that unit tests miss.

```bash
cd shared && npx vitest run __tests__/integration.test.ts
cd shared && npx vitest run __tests__/scenarios.test.ts
```

| File | Tests | Coverage |
|------|-------|----------|
| `integration.test.ts` | 95 | 15 realistic scenarios: AMT+NIIT, Schedule C+QBI, K-1, kiddie tax, HSA, Roth conversion |
| `scenarios.test.ts` | ~40 | Hand-calculated line-by-line IRS Pub 17 scenarios |
| `realworld-scenarios.test.ts` | ~48 | Real-world user situations |
| `cross-module.test.ts` | ~48 | Cross-module dependency validation |
| `e2e-integration.test.ts` | ~52 | Full pipeline: input → engine → output |

### 1.4 Boundary & Edge Case Tests (4 files)

```bash
cd shared && npx vitest run __tests__/boundary-values.test.ts
cd shared && npx vitest run __tests__/stress-scenarios.test.ts
```

| File | Tests | Coverage |
|------|-------|----------|
| `boundary-values.test.ts` | ~68 | Every bracket edge ±$1, standard deduction floor, SE threshold, phase-outs |
| `stress-scenarios.test.ts` | ~178 | 13 stress scenarios: AMT, depreciation, multi-state, Section 179, state EITC |
| `adversarial-phase3.test.ts` | ~48 | Multi-model AI red-team: ordering hazards, circular dependencies |
| `adversarial-scenarios.test.ts` | ~90 | Edge-case combinations designed to break the engine |

### 1.5 Cross-Validation Tests (4 files)

Independent verification that the engine computes correct results.

#### IRS Tax Table Oracle (588 tests)

```bash
cd shared && npx vitest run __tests__/irs-tax-table.test.ts
```

An independent tax calculator with hard-coded brackets and standard deductions (NOT imported from the engine). Feeds W-2 returns through both and checks every field matches.

| Section | Tests | What |
|---------|-------|------|
| A. Zero income | 5 | $0 wages → $0 tax, all 5 statuses |
| B. Bracket boundaries | 90 | Every bracket edge ±$1, all 5 statuses |
| C. Round-number incomes | 45 | $25k–$500k × 5 statuses |
| D. Bracket midpoints | 35 | Middle of each bracket × 5 statuses |
| E. Mathematical invariants | 354 | Identity, monotonicity, continuity, MFJ/QSS parity, filing status ordering, effective rate bounds, piecewise linearity |
| F. Extreme income levels | 59 | $1 to $10M, sanity checks at extremes |

**Invariants tested (Section E):**
1. `taxableIncome === agi - deductionAmount`
2. `totalTax >= 0`, `taxableIncome >= 0`
3. `refundAmount > 0` XOR `amountOwed > 0` (or both zero)
4. Adding $1 of income never decreases tax
5. Adding $1 changes tax by at most $0.37 (top rate)
6. MFJ and QSS produce identical results
7. MFS matches Single brackets (except 35% cap divergence)
8. `tax(MFJ) <= tax(Single)` and `tax(HOH) <= tax(Single)`
9. `0 <= effectiveTaxRate <= marginalTaxRate <= 0.37`
10. Tax is linear within any single bracket

#### IRS Constants Validation (62 tests)

```bash
cd shared && npx vitest run __tests__/rev-proc-2024-40.test.ts
```

Validates 700+ tax constants against Rev. Proc. 2024-40: brackets, standard deductions, AMT exemptions, EITC tables, NIIT thresholds, CTC, SALT cap, QBI, SE tax, IRA phase-outs, education credits, HSA limits, Section 179.

### 1.6 Advanced Testing Methodologies (5 files)

```bash
cd shared && npx vitest run __tests__/phase9-metamorphic.test.ts
cd shared && npx vitest run __tests__/phase9-properties.test.ts
cd shared && npx vitest run __tests__/mutation-testing.test.ts
```

| File | Tests | Methodology |
|------|-------|-------------|
| `phase9-metamorphic.test.ts` | ~35 | **Metamorphic relations** — transforms inputs and validates structural invariants between outputs (no oracle needed) |
| `phase9-properties.test.ts` | ~42 | **Property-based testing** — fast-check PRNG with automatic shrinking |
| `phase9-differential.test.ts` | ~28 | **Differential testing** — compares multiple calculation paths |
| `mutation-testing.test.ts` | ~88 | **Mutation testing** — mutates engine code, verifies tests detect the mutation |
| `fuzzing.test.ts` | 111 | **Fuzz testing** — probes every module with boundary values, extreme inputs, negative numbers, pathological combinations |

### 1.7 Smoke Tests (3 files)

Fast validation across the entire engine surface area.

```bash
cd shared && npx vitest run __tests__/smoke-states.test.ts
cd shared && npx vitest run __tests__/smoke-filingStatus-incomeType.test.ts
cd shared && npx vitest run __tests__/smoke-credits.test.ts
```

| File | Tests | Coverage |
|------|-------|----------|
| `smoke-states.test.ts` | ~27 | All 50 states + DC in a single pass |
| `smoke-filingStatus-incomeType.test.ts` | ~38 | Every filing status × income type combination |
| `smoke-credits.test.ts` | ~58 | All credits: CTC, AOTC, EITC, Saver's, energy, etc. |

---

## 2. Client Tests (30 files, ~1,000 tests)

Service-layer tests validating import, parsing, AI, and business logic.

```bash
cd client && npx vitest run
```

### 2.1 Import & Parsing (10 files)

| File | Tests | Coverage |
|------|-------|----------|
| `pdfImporter.test.ts` | ~65 | PDF import via OCR, field detection, confidence scoring |
| `csvParser.test.ts` | ~28 | CSV transaction parsing, bank statement import |
| `txfParser.test.ts` | ~53 | TXF (tax interchange format) |
| `fdxParser.test.ts` | ~44 | FDX (financial data exchange) |
| `competitorReturnParser.test.ts` | ~45 | Commercial tax software export parsing |
| `ocrService.test.ts` | ~36 | OCR character recognition |
| `documentInventoryService.test.ts` | ~51 | Document cataloging, duplicate detection |
| `duplicateDetection.test.ts` | ~55 | Duplicate transaction identification |
| `priorYearImporter.test.ts` | ~30 | Prior year return import |
| `transactionParser.test.ts` | ~20 | Generic transaction parsing |

### 2.2 Services & Business Logic (12 files)

| File | Tests | Coverage |
|------|-------|----------|
| `auditRiskService.test.ts` | ~59 | Audit risk scoring by IRS category |
| `deductionFinderEngine.test.ts` | ~92 | Deduction recommendation, pattern matching |
| `suggestionService.test.ts` | ~34 | Tax planning suggestions |
| `warningService.test.ts` | ~26 | Red-flag detection |
| `scenarioLab.test.ts` | ~19 | What-if analysis |
| `sensitivityAnalysis.test.ts` | ~14 | Variable sensitivity |
| `taxCalendarService.test.ts` | ~30 | Deadline calendar |
| `chatContextBuilder.test.ts` | ~24 | AI chat context assembly |
| `intentExecutor.test.ts` | ~54 | AI intent execution |
| `exportReadiness.test.ts` | ~24 | Return readiness for PDF export |

### 2.3 Fuzzer (1 file)

```bash
cd client && npx vitest run src/__tests__/fuzzerCalcValidation.test.ts
```

Generates 50 randomized TaxReturn objects from 13 archetypes, runs `calculateForm1040()` on each, validates no NaN/undefined/negative values in critical fields.

---

## 3. E2E Tests (9 files, Playwright)

Browser-based end-to-end tests across Chromium, Firefox, and WebKit.

```bash
# Run all E2E tests
cd client && npx playwright test

# Run with UI (interactive mode)
cd client && npx playwright test --ui

# Run specific spec
cd client && npx playwright test e2e/wizard-flow.spec.ts
```

### 3.1 Core Wizard Tests

| File | Tests | Coverage |
|------|-------|----------|
| `wizard-flow.spec.ts` | 13 | Step navigation, filing status, auto-save, sidebar |
| `dashboard.spec.ts` | ~8 | Dashboard rendering, return creation |
| `form-validation.spec.ts` | ~30 | Input validation, error messages |
| `navigation.spec.ts` | ~6 | Page navigation, breadcrumbs |
| `import-data.spec.ts` | ~22 | File upload, data parsing |

### 3.2 Feature Tests

| File | Tests | Coverage |
|------|-------|----------|
| `chat.spec.ts` | ~30 | AI chat interface, context persistence |
| `cross-browser.spec.ts` | ~16 | Chromium, Firefox, WebKit compatibility |
| `accessibility.spec.ts` | ~24 | axe-core, keyboard navigation, screen reader |

### 3.3 Scenario Fuzzer

```bash
cd client && npx playwright test e2e/scenario-fuzzer/
```

The E2E fuzzer generates 20 diverse TaxReturn objects from 13 archetypes, injects them via localStorage, walks every visible wizard step, and validates UI health and calculation results.

**13 Archetypes:**
`simple-w2` | `self-employed-single` | `self-employed-couple` | `gig-worker` | `investor` | `dual-income-family` | `multi-state` | `rental-landlord` | `retiree` | `high-income-itemizer` | `crypto-trader` | `low-income-credits` | `kitchen-sink`

**8 Generator Modules:**
`base` | `income` | `self-employment` | `credits` | `deductions` | `dependents` | `discovery` | `state`

Uses a deterministic PRNG seed for reproducible random generation.

---

## 4. Server Tests (2 files)

```bash
cd server && npx vitest run
```

| File | Tests | Coverage |
|------|-------|----------|
| `piiStripper.test.ts` | ~68 | PII detection: SSN, phone, email, address, dollar amounts |

---

## Testing Methodologies

### Fuzz Testing (3 layers)

| Layer | File | Approach |
|-------|------|----------|
| Engine | `shared/__tests__/fuzzing.test.ts` | 111 tests: boundary values, extreme inputs, negative numbers, pathological combos |
| Client | `client/src/__tests__/fuzzerCalcValidation.test.ts` | 50 randomized returns from 13 archetypes |
| E2E | `client/e2e/scenario-fuzzer/` | 20 full-stack scenarios through the UI |

### Cross-Validation (2 sources)

| Source | File | Method |
|--------|------|--------|
| Independent Oracle | `irs-tax-table.test.ts` | Hard-coded brackets, 588 tests |
| IRS Constants | `rev-proc-2024-40.test.ts` | 700+ constants from Rev. Proc. 2024-40 |

### Adversarial Testing

Multi-model AI-generated scenarios designed to break the engine through:
- Multi-provision interactions
- Ordering hazards
- Circular dependencies
- Phase-out cliff effects

### Property-Based & Metamorphic

- **Property-based:** fast-check PRNG with automatic shrinking finds minimal failing inputs
- **Metamorphic:** validates structural relationships between outputs without needing an oracle (e.g., doubling income should roughly double tax in a flat bracket)
- **Mutation:** modifies engine code and verifies tests catch the mutation (test suite effectiveness)

---

## How to Add Tests

### Adding a new engine unit test

Follow the pattern in existing tests:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test', taxYear: 2025, status: 'in_progress',
    currentStep: 0, currentSection: 'review',
    dependents: [], w2Income: [], income1099NEC: [], income1099K: [],
    income1099INT: [], income1099DIV: [], income1099R: [], income1099G: [],
    income1099MISC: [], income1099B: [], income1099DA: [], income1099C: [],
    income1099Q: [], incomeK1: [], income1099SA: [], incomeW2G: [],
    rentalProperties: [], otherIncome: 0, businesses: [],
    deductionMethod: 'standard', expenses: [], educationCredits: [],
    incomeDiscovery: {}, createdAt: '', updatedAt: '',
    ...overrides,
  };
}

describe('My New Test', () => {
  it('computes correct tax for ...', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 50000,
        federalTaxWithheld: 5000, socialSecurityWages: 50000,
        socialSecurityTax: 3100, medicareWages: 50000, medicareTax: 725 }],
    }));
    expect(result.form1040.agi).toBe(50000);
  });
});
```

### Adding a new E2E archetype

Create a new generator in `client/e2e/scenario-fuzzer/generators/` and register it in the archetype list.

---

## CI / Local Workflow

```bash
# Full local validation (recommended before pushing)
cd shared && npx vitest run          # ~18s, 4,500+ tests
cd client && npx vitest run          # ~8s, 1,000+ tests
cd server && npx vitest run          # ~2s, 80+ tests

# E2E (slower, requires browser binaries)
cd client && npx playwright test     # ~45s, 320+ tests across 3 browsers

```

---

## Key Test File Locations

| What | Path |
|------|------|
| IRS tax table oracle | `shared/__tests__/irs-tax-table.test.ts` |
| IRS constants validation | `shared/__tests__/rev-proc-2024-40.test.ts` |
| Integration scenarios | `shared/__tests__/integration.test.ts` |
| Boundary values | `shared/__tests__/boundary-values.test.ts` |
| Fuzz testing | `shared/__tests__/fuzzing.test.ts` |
| E2E wizard flow | `client/e2e/wizard-flow.spec.ts` |
| E2E scenario fuzzer | `client/e2e/scenario-fuzzer/scenario-fuzzer.spec.ts` |
| Playwright config | `client/playwright.config.ts` |
| Audit report | `docs/AUDIT_REPORT.md` |
