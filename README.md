# TelosTax

Private, browser-based tax preparation powered by an open-source tax engine.

## What is TelosTax?

TelosTax is a free, open-source tax preparation app for the 2025 tax year, built entirely with AI. Your tax data never leaves your browser — all calculations happen client-side using the `@telostax/engine` library, encrypted at rest with AES-256-GCM.

**Two modes:**
- **Private Mode** (default) — fully offline, zero data leaves your device
- **BYOK Mode** (optional) — add your own Anthropic API key for AI chat, expense scanning, and document extraction. PII is stripped before anything is sent.

**Key features:**
- 90+ tax features covering ~85-90% of individual filers
- All 50 states + DC tax coverage
- Full Form 1040 with Schedules A-H, SE, D, and 30+ supplemental forms
- 41 IRS PDF templates + 43 state PDF templates with auto-populated field mapping
- Every computation traced to IRC, Treasury Regulations, or Revenue Procedures
- 6,100+ tests across 139 test files
- Offline-capable — installable on desktop and mobile

## Architecture

```
tax-project/
├── shared/   → @telostax/engine (open-source tax calculation library)
├── client/   → React 19 + Vite 6 + Tailwind CSS + Zustand 5
├── server/   → Express + better-sqlite3 + pdf-lib
└── docs/     → Project documentation
```

**Tech stack:** TypeScript throughout. React 19 with Vite 6. Zustand 5 for state. Tailwind CSS with Telos brand colors. Vitest for testing. pdf-lib for IRS form generation.

**Engine design:** Pure functions only — no side effects, no database access, no network calls. Given a `TaxReturn` input, the engine produces a deterministic `CalculationResult`. See [Design Principles](docs/DESIGN_PRINCIPLES.md).

## Quick Start

```bash
# Install dependencies
npm install

# Run the client dev server
npm run dev --prefix client

# Run tests
npx vitest run --prefix shared
```

## Tax Coverage

| Category | Coverage |
|----------|----------|
| Income types | W-2, 1099-INT/DIV/OID/R/MISC/NEC/B/G/SA/DA/Q/C, SSA-1099, K-1 (partnership/S-Corp/estate), Schedule C/E/F, W-2G, Form 6252 (installment sales), Form 4835 (farm rental) |
| Deductions | Standard, itemized (Schedule A), QBI (199A), SEHI (Form 7206), Schedule 1-A (OBBBA), IRA, HSA, Archer MSA (Form 8853), student loan, educator, home office, vehicle, NOL, investment interest, sales tax SALT alternative, nonbusiness bad debt |
| Credits | CTC/ACTC/ODC, EITC, AOTC/LLC, dependent care, saver's, clean energy, EV, energy efficiency, FTC, PTC, adoption, elderly/disabled, excess SS, EV refueling, scholarship (§25F), prior year AMT (Form 8801) |
| Capital gains | Schedule D, preferential rates (0/15/20%), 25% unrecaptured S1250, NIIT, $3k loss limit, carryforward |
| AMT | Full Form 6251 (Parts I-III) with preferential rates in AMT universe |
| Penalties | Form 5329 (IRA/HSA/Coverdell ESA excess contributions, early distributions), Form 4684 (casualties & thefts) |
| State taxes | All 50 states + DC (9 no-tax, 13 flat, 20 progressive factory, 9 custom) |
| Depreciation | Form 4562 with Section 179, bonus, MACRS GDS, half-year/mid-quarter conventions |

See [Scope Matrix](docs/SCOPE_MATRIX.md) for the complete feature list.

## Documentation

| Document | Description |
|----------|-------------|
| [Scope Matrix](docs/SCOPE_MATRIX.md) | Supported vs. unsupported features |
| [Design Principles](docs/DESIGN_PRINCIPLES.md) | Architecture philosophy and engine design |
| [Authorities](docs/AUTHORITIES.md) | Module-by-module legal authority reference |
| [Contributing](docs/CONTRIBUTING.md) | How to contribute ("no authority, no merge") |
| [Security](docs/SECURITY.md) | Security policy and vulnerability reporting |
| [Disclaimer](docs/DISCLAIMER.md) | Legal disclaimer — not tax advice |

## License

MIT. See [LICENSE](LICENSE).
