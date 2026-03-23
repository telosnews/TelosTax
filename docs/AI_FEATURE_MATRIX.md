# AI Feature Availability Matrix

Which features work in each AI mode. **All new features must be added to this matrix.**

## Modes

| Mode | Data leaves device? | Cost | AI Provider |
|------|-------------------|------|-------------|
| **Private** | Never | Free | None (deterministic only) |
| **BYOK** | PII-stripped text to user's chosen provider | Free (user pays provider) | User's API key |

## Feature Matrix

### Tax Engine & Calculation

| Feature | Private | BYOK | Notes |
|---------|---------|-----------|-------|
| Tax engine (calculateForm1040) | Yes | Yes | Deterministic, always local |
| State tax calculations | Yes | Yes | All 50 states |
| Live recalculation | Yes | Yes | 150ms debounce |
| Scenario Lab (what-if) | Yes | Yes | Full engine re-run |

### Warnings & Suggestions

| Feature | Private | BYOK | Notes |
|---------|---------|-----------|-------|
| Validation warnings | Yes | Yes | IRC-grounded thresholds |
| Proactive nudges | Yes | Yes | Deterministic eligibility gate |
| Suggestion engine | Yes | Yes | 14 detection rules |
| AI-enriched nudge descriptions | No | Yes | Async LLM enhancement (Phase 3) |

### Deduction & Credit Discovery

| Feature | Private | BYOK | Notes |
|---------|---------|-----------|-------|
| Pattern-based cross-validation | N/A | Yes | Used internally by expense scanner for confidence boosting |
| AI transaction categorizer | No | Yes | Full transaction categorization with 17 tax categories |
| AI + pattern cross-validation | No | Yes | Boosts confidence when AI and patterns agree |
| Transaction review dashboard | No | Yes | Summary cards, batch approve, reclassify, split transactions |
| Apply to return pipeline | No | Yes | Maps approved categories → wizard step fields |
| Audit risk assessment | Yes | Yes | IRS/GAO/TIGTA sourced |

### Transaction Import Formats

| Format | Supported | Notes |
|--------|-----------|-------|
| Chase CSV | Yes | Auto-detected |
| Bank of America CSV | Yes | Auto-detected |
| Citi CSV | Yes | Split debit/credit columns |
| American Express CSV | Yes | Includes MCC codes |
| Wells Fargo CSV | Yes | Auto-detected |
| Monarch Money CSV | Yes | Auto-detected via institution/notes columns |
| YNAB CSV | Yes | Outflow/inflow format |
| Copilot CSV | Yes | Auto-detected via account name/status columns |
| Apple Card CSV | Yes | Amount (USD) format, includes MCC |
| Generic CSV | Yes | Fuzzy column matching fallback |

### Document Import

| Feature | Private | BYOK | Notes |
|---------|---------|-----------|-------|
| Digital PDF extraction | Yes | Yes | Syncfusion, fully local |
| OCR (scanned PDFs, photos) | Yes | Yes | Tesseract.js, fully local |
| AI-enhanced extraction | No | Yes | PII-stripped OCR text sent to LLM |
| Competitor return import | Yes | Yes | pdf-lib, fully local |
| CSV import (brokerage) | Yes | Yes | Papaparse, fully local |
| Transaction CSV import | Yes | Yes | Bank statement parsing, fully local |

### AI Chat

| Feature | Private | BYOK | Notes |
|---------|---------|-----------|-------|
| Chat conversations | No | Yes | Requires cloud LLM |
| Voice data entry (dictation) | No | Yes | Speech-to-text is local, but chat required to process |
| "Guide me" step walkthroughs | No | Yes | Requires chat |
| Field explanations via chat | No | Yes | Right-click → Ask TelosAI → chat |
| Document attachment in chat | Partial | Yes | Extraction is local; AI review requires LLM |
| Structured actions (add_income, etc.) | No | Yes | LLM parses natural language → JSON actions |
| Local intent detection | Yes | Yes | Deterministic fast-path for deletion/navigation intents; no LLM round-trip |
| Prompt caching | N/A | Yes | Static system prompts cached; ~90% input token discount on follow-ups |

### Forms Mode

| Feature | Private | BYOK | Notes |
|---------|---------|-----------|-------|
| PDF form viewer | Yes | Yes | Syncfusion PDF Viewer |
| Form field population | Yes | Yes | Deterministic from store |
| Field explanations (AI picker) | No | Yes | Requires chat |
| Click-to-explain tooltip | No | Yes | Requires chat |
| Form review | No | Yes | Requires chat |
| Read-only computed fields | Yes | Yes | DOM enforcement |

### Interview View

| Feature | Private | BYOK | Notes |
|---------|---------|-----------|-------|
| All 82 wizard steps | Yes | Yes | Full UI |
| Right-click → Ask TelosAI | No | Yes | Requires chat |
| Help content & callout cards | Yes | Yes | Static from helpContent.ts |
| Step warnings banner | Yes | Yes | Deterministic |
| Nudge cards | Yes | Yes | Deterministic (AI enrichment is additive) |

### Sidebar Tools

| Feature | Private | BYOK | Notes |
|---------|---------|-----------|-------|
| Explain My Taxes | Yes | Yes | Waterfall chart, bracket chart, effective rate, trace tree — fully deterministic |
| Year-over-Year Comparison | Yes | Yes | Prior-year vs. current delta breakdown — deterministic |
| Tax Calendar | Yes | Yes | Key deadlines, contribution windows, estimated payment dates — deterministic |
| Document Inventory | Yes | Yes | Forms checklist organized by type — deterministic |
| File an Extension (Form 4868) | Yes | Yes | Pre-populated from return, generates PDF — deterministic |
| Donation Valuation Lookup | Yes | Yes | 170-item FMV database (Salvation Army, Goodwill) — deterministic |

### Privacy & Security

| Feature | Private | BYOK | Notes |
|---------|---------|-----------|-------|
| AES-256-GCM encryption | Yes | Yes | localStorage encryption |
| PII scanning (outbound) | N/A | Yes | Blocks SSNs, addresses, etc. |
| Dollar amount rounding (context) | N/A | Yes | roundForPrivacy() |
| Chat history encryption | N/A | Yes | Encrypted per-return |
| Privacy audit log | N/A | Yes | Transparency panel showing every outbound AI request, blocked PII, and responses |

## Adding a New Feature

When building a new feature, ask:

1. **Does it need an LLM?** If yes, it only works in BYOK.
2. **Can a deterministic fallback provide partial value?** If yes, build the fallback for Private mode.
3. **What data would leave the browser?** Run through PII scanning. Document in this matrix.
4. **Does the feature degrade gracefully?** Private mode users should see helpful messaging, not errors.

## Design Principles

- **Private mode is the default.** It must be a complete, useful tax preparation experience.
- **AI features are additive, not required.** The app works without them.
- **Deterministic gate first, LLM enhancement second.** No nudge/suggestion appears without passing the engine's eligibility checks.
- **Be honest about tradeoffs.** Don't pretend Private mode has AI. Don't pretend cloud modes are private.
