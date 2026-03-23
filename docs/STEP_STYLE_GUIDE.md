# Step Style Guide

> **STATUS: FINAL** — All new wizard steps must conform to this guide.

Standardization guide for all wizard step components in TelosTax. Integrates with [DESIGN_PRINCIPLES.md](./DESIGN_PRINCIPLES.md) for architecture. Color conventions are included in the [UI Color Reference](#ui-color-reference) section at the end of this document.

---

## Step Categories

Every wizard step falls into one of 7 categories. Each category has its own template.

| # | Category | Count | Template Section |
|---|----------|-------|------------------|
| 1 | **Overview** | 4 | [§1 Overview Steps](#1-overview-steps) |
| 2 | **Core Data Entry** | ~72 | [§2 Core Data Entry Steps](#2-core-data-entry-steps) |
| 3 | **Summary** | 5 | [§3 Summary Steps](#3-summary-steps) |
| 4 | **Transition** | 6 | [§4 Transition Steps](#4-transition-steps) |
| 5 | **Review** | 4 | [§5 Review Steps](#5-review-steps) |
| 6 | **Finish** | 3 | [§6 Finish Steps](#6-finish-steps) |
| 7 | **My Info / Setup** | 5 | [§7 My Info Steps](#7-my-info-steps) |

**Utility/Tool views** (Audit Risk, Deduction Finder, YoY, Calendar, etc.) are sidebar tools, not wizard steps. They reuse shared components but don't follow step templates.

---

## 1. Overview Steps

**Purpose:** Gateway screens that open a section (Income, Deductions, Credits, State Taxes). Users answer yes/no/not sure questions to enable downstream data entry steps.

**Steps:** IncomeOverviewStep, DeductionsOverviewStep, CreditsOverviewStep, StateOverviewStep

### Required Elements

```
┌──────────────────────────────────────────────┐
│ SectionIntro                                 │
│   Icon: Section's main icon (w-8 h-8)       │
│   Title: Section name                        │
│   Description: 1-line instruction            │
├──────────────────────────────────────────────┤
│ Guide Me Card (AI-assisted discovery)        │
│   Sparkles icon + contextual description     │
│   "Guide me" button → opens chat with prompt │
│   Placed immediately after SectionIntro      │
├──────────────────────────────────────────────┤
│ Info Callout (CalloutCard variant="info")     │
│   How [income/deductions/credits] work       │
│   IRS link                                   │
├──────────────────────────────────────────────┤
│ Hero Status Card                             │
│   Total computed value OR selection count     │
│   Semantic color per UI Color Reference       │
├──────────────────────────────────────────────┤
│ Search Field                                 │
│   Placeholder: "Search [category]..."        │
│   Filters label + description in real time   │
│   Flat list when searching (bypasses groups) │
├──────────────────────────────────────────────┤
│ Grouped Accordion Cards                      │
│   Group header: label + active count badge   │
│   Per-item: icon + label + PillToggle        │
│   PillToggle: Yes / No / Not Sure            │
│   Feedback line below toggle                 │
│   "Start" / "Revisit" action buttons         │
├──────────────────────────────────────────────┤
│ StepNavigation                               │
└──────────────────────────────────────────────┘
```

### Guide Me Card

Every Overview Step must include a Guide Me card immediately after `SectionIntro`. The card opens the AI chat panel with a contextual starter prompt. Pattern:

```tsx
import { Sparkles } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

function GuideMe() {
  const openWithPrompt = useChatStore((s) => s.openWithPrompt);

  return (
    <div className="rounded-lg border border-slate-700 bg-surface-800/50 mt-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Sparkles className="w-4 h-4 text-telos-orange-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-300">{/* Contextual question */}</p>
            <p className="text-xs text-slate-400 mt-0.5">{/* Brief description */}</p>
          </div>
        </div>
        <button
          onClick={() => openWithPrompt('...')}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                     bg-telos-orange-600/20 hover:bg-telos-orange-600/30 text-telos-orange-300
                     border border-telos-orange-500/30 hover:border-telos-orange-500/50 transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          Guide me
        </button>
      </div>
    </div>
  );
}
```

**Rules:**
- **Placement:** Always immediately after `SectionIntro` (before info callouts, hero cards, or search)
- **Prompt:** Must be section-specific (e.g., "Help me enter my income" / "Help me find deductions" / "Help me find tax credits")
- **Styling:** `border-slate-700 bg-surface-800/50` (subtle, not attention-grabbing)
- **Icon:** Always `Sparkles` in `text-telos-orange-400`
- **Button text:** Always "Guide me" (two words, lowercase "me")

### PillToggle Feedback Messages

| Answer | State | Message | Color |
|--------|-------|---------|-------|
| Yes | No data | "Click 'Start' above or continue to enter your data" | `text-telos-blue-400` |
| Yes | Data entered | "Data entered. Click 'Revisit' to make changes." | `text-telos-orange-400` |
| No | — | "Got it — you won't need to report this." | `text-slate-400` |
| Not Sure | — | "No worries — we'll include this section so you can decide later." | `text-amber-400` |

### Naming Convention

Use **"Overview"** consistently: `IncomeOverviewStep`, `DeductionsOverviewStep`, `CreditsOverviewStep`, `StateOverviewStep`.

### StateOverviewStep Exception

StateOverviewStep uses a different UX pattern (explicit add/remove + residency configuration) rather than yes/no toggles. This is intentional — state selection is a different interaction model. It still must have SectionIntro, search, and hero status elements.

---

## 2. Core Data Entry Steps

**Purpose:** The primary data capture steps where users enter tax form data. This is the largest category (~72 steps) and the one most in need of standardization.

### Standardized Element Ordering

**This ordering is mandatory for all data entry steps.** Elements appear in this exact sequence. Omit any that don't apply, but never reorder.

```
┌──────────────────────────────────────────────┐
│ 1. StepWarningsBanner                        │  REQUIRED
│    Dynamic validation warnings for this step │
│    Renders null when no warnings — zero cost │
├──────────────────────────────────────────────┤
│ 2. SectionIntro                              │  REQUIRED
│    Icon: Step-specific icon (w-8 h-8)        │
│    Title: Form/topic name                    │
│    Description: 1-line purpose statement     │
├──────────────────────────────────────────────┤
│ 3. WhatsNewCard (if material 2025 changes)   │  CONDITIONAL
│    Standalone — never nested in other cards  │
│    Collapsed by default (user expands)       │
│    Use shared WhatsNewCard component         │
├──────────────────────────────────────────────┤
│ 4. CalloutCard(s) / Info Zone                │  REQUIRED (at least one)
│    a. CalloutCard (variant="info")           │
│       Key tax concept or gotcha              │
│    b. IRS Link                               │
│       "Learn more on IRS.gov" ExternalLink   │
│       Links to form instructions or pub      │
├──────────────────────────────────────────────┤
│ 5. Hero Value Box (when computed value)      │  CONDITIONAL
│    Computed total for this step's data        │
│    Semantic color per UI Color Reference:     │
│      emerald = credits, refunds, profit      │
│      amber = tax owed, penalties             │
│      orange = deductions, savings            │
│      white = neutral (income line items)     │
│      red = losses                            │
├──────────────────────────────────────────────┤
│ 6. Item List (multi-item steps only)         │  CONDITIONAL
│    Per-item row:                              │
│      Icon + Primary label + Amount           │
│      Secondary detail (employer, payer)      │
│      ItemWarningBadge (if warnings exist)    │
│      Edit button (Pencil icon)               │
│      Delete button (Trash2 icon)             │
├──────────────────────────────────────────────┤
│ 7. Add / Import Buttons                      │  CONDITIONAL
│    AddButton: "Add [Item Type]"              │
│    InlineImportButton: PDF/CSV (if form      │
│      has a standard importable format)       │
├──────────────────────────────────────────────┤
│ 8. Edit Form (when editing or adding)        │  CONDITIONAL
│    Primary fields (always visible)           │
│    Collapsible "Additional Details" section  │
│      (for optional/advanced fields)          │
│    Save / Cancel buttons                     │
├──────────────────────────────────────────────┤
│ 9. StepNavigation (Back / Continue)          │  REQUIRED
└──────────────────────────────────────────────┘
```

**Rationale for ordering:**
- **WarningsBanner first** — validation issues are the most urgent; user sees them before anything else
- **SectionIntro second** — orients the user to what this step is
- **WhatsNewCard third** — important context before data entry, but collapsed by default so it doesn't dominate
- **CalloutCards/Info fourth** — persistent educational content
- **Hero value fifth** — computed result, below the informational zone
- **Form content last** — the actual data entry

### Sub-Patterns

Data entry steps fall into 4 sub-patterns. Use the appropriate one:

#### A. Multi-Item CRUD (most common)

For steps where users can have multiple entries (W-2s, 1099s, K-1s, rental properties, etc.).

- Display existing items as summary cards
- Click to expand inline edit form OR open edit overlay
- Add via `AddButton` component
- Delete with confirmation
- `ItemWarningBadge` on each item row
- Optional: `InlineImportButton` for PDF/CSV import

**Reference implementations:** W2IncomeStep, B1099Step, K1Step, RentalPropertyStep

#### B. Single-Form Entry

For steps with one set of fields (HSA, Student Loan, Educator Expenses, etc.).

- Direct form fields, no list management
- Still needs CalloutCard, hero value, and IRS link
- Optional: collapsible advanced section for edge cases

**Reference implementations:** HSAStep, StudentLoanStep, MedicalExpensesStep

#### C. Method Selection + Sub-Form

For steps where users choose between calculation methods before entering data.

- `CardSelector` at top for method choice
- Conditional sub-form based on selection
- Live calculation preview comparing methods
- "Better for you" badge on recommended option

**Reference implementations:** VehicleExpensesStep, HomeOfficeStep, DeductionMethodStep

#### D. Derived/Auto-Calculated

For steps where values are computed from other steps with minimal direct input.

- Focus on display and explanation, not data entry
- Show source of derived values with "Edit" links to origin steps
- Hero value box is essential here

**Reference implementations:** ChildTaxCreditStep, QBIDetailStep, Form8582Step

### WhatsNewCard

Use the shared `WhatsNewCard` component when there are material tax law changes affecting the step. **Do not** copy-paste the megaphone/chevron boilerplate — use the component.

```tsx
import WhatsNewCard from '../common/WhatsNewCard';

<WhatsNewCard items={[
  { title: 'SALT Cap Quadrupled', description: 'Raised from $10,000 to $40,000 under OBBBA.' },
  { title: 'Phase-Down for High Earners', description: 'Phases down above $500k MAGI.' },
]} />
```

**Placement rules:**
- Always **standalone** — never nested inside a CalloutCard, hero card, or info box
- Always **position 3** in the standard element ordering (after SectionIntro, before CalloutCards)
- Collapsed by default — user clicks to expand

**When to include:**
- **Tier A (must have):** Brand-new forms, legislative changes (OBBBA), credit/deduction creation or termination
- **Tier B (should have):** Meaningful threshold/limit changes ($1,000+ shifts)
- **Skip:** Routine inflation indexing under $500, purely mechanical changes

**Item markers:**
- Default `+` (orange) — new or increased items
- `⚠` (amber) — terminations, phase-outs, or things users should watch out for

### CalloutCard Usage

Use the `CalloutCard` component — not custom `<div>` cards with inline styling. Variants:

| Variant | When to use |
|---------|-------------|
| `info` | General tax concept explanation (default) |
| `warning` | Edge case that could cause errors (e.g., alimony pre/post-2019) |
| `tip` | Optimization suggestion |

### CalloutCard Wrapper Pattern

When rendering callouts from `helpContent`, always wrap the map in a spacing container:

```tsx
<div className="space-y-3 mt-4 mb-6">
  {help?.callouts?.map((c, i) => (
    <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
  ))}
</div>
```

Hardcoded `CalloutCard` components (for steps without helpContent callouts) don't need the wrapper div — just place them directly in the element ordering.

### IRS Link Pattern

Every step that corresponds to an IRS form or publication should include a standalone link near the bottom (before `<StepNavigation />`). The link text must always be **"Learn more on IRS.gov"** with the icon before the text:

```tsx
<a
  href="https://www.irs.gov/forms-pubs/about-form-XXXX"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
>
  <ExternalLink className="w-3 h-3" />
  Learn more on IRS.gov
</a>
```

Do **not** abbreviate to just "IRS.gov" — always use the full "Learn more on IRS.gov" text for consistency.

Many steps also have IRS refs via the `helpContent` system's `irsRef` field on individual form fields. Both approaches are complementary — field-level `irsRef` for specific line references, standalone link for the form overview page.

### Hero Value Box

```tsx
<div className="card mt-4 text-center py-4">
  <div className="text-slate-400 text-sm mb-1">Label</div>
  <div className={`text-2xl font-bold ${semanticColorClass}`}>
    ${value.toLocaleString()}
  </div>
</div>
```

Color logic per [UI Color Reference](#ui-color-reference):
- Income amounts: `text-white`
- Deductions/savings: `text-telos-orange-400`
- Credits/refunds/profit: `text-emerald-400`
- Tax owed/penalties: `text-amber-400`
- Losses: `text-red-400`

---

## 3. Summary Steps

**Purpose:** Capstone step for each major section. Includes visualizations, itemized breakdowns, and a hero total.

**Steps:** IncomeSummaryStep, SelfEmploymentSummaryStep, DeductionsSummaryStep, CreditsSummaryStep, TaxSummaryStep

### Required Elements

```
┌──────────────────────────────────────────────┐
│ SectionIntro                                 │
│   Icon: Section's main icon (same as sidebar)│
├──────────────────────────────────────────────┤
│ StepWarningsBanner                           │
├──────────────────────────────────────────────┤
│ Hero Total Card                              │
│   Large value (text-2xl or text-5xl)         │
│   Semantic color per section                 │
│   Breakdown subtitle                         │
├──────────────────────────────────────────────┤
│ Chart Switcher                               │
│   2-3 visualization modes                    │
│   Clickable elements → navigate to step      │
├──────────────────────────────────────────────┤
│ Itemized Breakdown                           │
│   Per-item rows: icon + label + amount       │
│   Edit button per row → navigate to step     │
│   Section totals with semantic color         │
│   divide-y borders between items             │
├──────────────────────────────────────────────┤
│ "Still needs data" warning (if incomplete)   │
│   Amber card listing items answered "yes"    │
│   but with no data entered                   │
├──────────────────────────────────────────────┤
│ Additional Tools/Questions (optional)        │
│   e.g., Schedule B questions, Deduction      │
│   Finder, Audit Risk, YoY Comparison         │
├──────────────────────────────────────────────┤
│ StepNavigation                               │
└──────────────────────────────────────────────┘
```

### Hero Total Color by Section

| Summary | Color | Class |
|---------|-------|-------|
| Income | White (neutral) | `text-white` |
| Self-Employment | Profit: emerald / Loss: red | `text-emerald-400` / `text-red-400` |
| Deductions | Orange (savings) | `text-telos-orange-400` |
| Credits | Emerald | `text-emerald-400` |
| Tax Summary | Refund: emerald / Owed: amber | `text-emerald-400` / `text-amber-400` |

---

## 4. Transition Steps

**Purpose:** Lightweight motivational checkpoint between major sections.

**Steps:** transition_income, transition_se, transition_deductions, transition_credits, transition_state, transition_review

### Template

Centered card with:
- Large section icon
- Heading: brief motivational message (e.g., "Great start!")
- Subheading: what comes next
- "Let's Go" CTA button
- No SectionIntro, no warnings, no data — purely navigational

### Exception

`CreditsTransitionStep` has a custom variant with additional context. This is acceptable for sections that benefit from pre-context.

---

## 5. Review Steps

**Purpose:** Calculation verification checkpoints in the Review section. Read-heavy with expandable traces.

**Steps:** ReviewScheduleCStep, AMTStep, Form8582Step, ReviewForm1040Step

### Required Elements

- SectionIntro with section-appropriate icon
- StepWarningsBanner
- CalloutCard explaining the form/calculation
- Hero value box showing key result (AMT amount, suspended loss, etc.)
- Detailed breakdown table (line-by-line where appropriate)
- TraceDisclosure for calculation transparency
- IRS link to relevant form

---

## 6. Finish Steps

**Purpose:** Post-calculation steps for payment, filing, and export.

**Steps:** RefundPaymentStep, FilingInstructionsStep, ExportPdfStep

These are unique enough that rigid templating isn't appropriate. Guidelines:

- SectionIntro with descriptive icon
- Hero card showing refund/owed amount (semantic emerald/amber)
- Conditional content based on refund vs. owed vs. break-even
- IRS links for payment methods and filing options
- Clear CTAs for primary actions (download, print, etc.)

---

## 7. My Info Steps

**Purpose:** Initial setup (identity, filing status, dependents, encryption).

**Steps:** WelcomeStep, PersonalInfoStep, EncryptionSetupStep, FilingStatusStep, DependentsStep

Guidelines:
- SectionIntro on all steps except WelcomeStep (which is a landing page)
- StepWarningsBanner where validation is relevant
- CalloutCard for tax concept explanations (filing status rules, dependent qualifications)
- IRS links embedded in labels for complex rules

---

## Shared Component Reference

Components available for use in all step categories:

| Component | Purpose | Import Path |
|-----------|---------|-------------|
| `SectionIntro` | Step header (icon + title + desc) | `../common/SectionIntro` |
| `StepWarningsBanner` | Step-level validation warnings | `../common/StepWarningsBanner` |
| `WhatsNewCard` | Collapsible 2025 tax changes card | `../common/WhatsNewCard` |
| `CalloutCard` | Info/warning/tip callout box | `../common/CalloutCard` |
| `StepNavigation` | Back/Continue footer | `../layout/StepNavigation` |
| `FormField` | Label + tooltip + input wrapper | `../common/FormField` |
| `CurrencyInput` | Dollar amount input | `../common/CurrencyInput` |
| `PillToggle` | 2-3 option toggle | `../common/PillToggle` |
| `CardSelector` | Radio-like card selection | `../common/CardSelector` |
| `AddButton` | Add new item button | `../common/AddButton` |
| `ItemWarningBadge` | Per-item warning indicator | `../common/ItemWarningBadge` |
| `InlineImportButton` | PDF/CSV import trigger | `../import/InlineImportButton` |
| `EligibilityBadge` | Credit/deduction eligibility | `../common/EligibilityBadge` |

---

---

## UI Color Reference

Semantic color conventions for monetary values, text, and interactive elements across the TelosTax UI.

### Monetary Value Colors

| Color | Tailwind Class | Usage |
|-------|---------------|-------|
| **White** | `text-white` | Line item values in breakdown lists (neutral — context communicates meaning) |
| **Telos Orange** | `text-telos-orange-400` | Hero totals on deduction/savings pages; section total rows (e.g., "Total Adjustments") |
| **Emerald** | `text-emerald-400` | Refunds, credits, positive outcomes for the taxpayer |
| **Amber** | `text-amber-400` | Taxes owed, AMT, penalties — amounts the taxpayer must pay |
| **Red** | `text-red-400` | Losses (capital losses, negative balances in non-refund contexts) |

#### Hierarchy

1. **Hero amounts** (the big number at the top of a summary page): Use the semantic color for the page context — orange for deductions/savings, emerald for credits, emerald/amber for refund/owed.
2. **Line item values** in breakdown lists: `text-white`. The section heading and any prefix (e.g., `-$`) provide context; coloring every row is visual noise.
3. **Section total rows** (e.g., "Total Adjustments", "Total Itemized"): Semantic color to emphasize the summary.
4. **Conditional refund/owed**: Use `isRefund ? 'text-emerald-400' : 'text-amber-400'` wherever the sign of an amount changes the taxpayer's outcome.

### Text Colors

| Color | Tailwind Class | Usage |
|-------|---------------|-------|
| **Slate 200** | `text-slate-200` | Card headings, section titles |
| **Slate 300** | `text-slate-300` | Form labels, secondary text |
| **Slate 400** | `text-slate-400` | Row labels in breakdown lists, descriptions |
| **Slate 500** | `text-slate-500` | Helper text, comparison notes, fine print |

### Interactive Elements

| Element | Color |
|---------|-------|
| Primary buttons | `bg-telos-blue-600` / `text-white` |
| Secondary buttons | `bg-surface-700` / `text-slate-200` |
| Inline "Edit" buttons | `text-telos-blue-400` with `border-telos-blue-500/30` |
| Text links / navigation | `text-telos-blue-400` hover → `text-telos-blue-300` |
| Selected card border | `border-telos-orange-500` with `bg-telos-orange-500/10` |

### Summary Page Icons (SectionIntro)

Each summary/review page uses the same icon as its parent section in the sidebar. This reinforces section identity — the summary is the capstone of its section, not a separate context.

| Summary Page | Icon | Matches Section |
|---|---|---|
| Income Overview | `DollarSign` | Income |
| Income Summary | `DollarSign` | Income |
| SE Summary | `Briefcase` | Self-Employment |
| Itemized Deductions | `Scissors` | Deductions |
| Deductions Summary | `Scissors` | Deductions |
| Credits Summary | `Award` | Credits |
| State Tax Review | `MapPin` | State Taxes |
| Tax Summary | `ClipboardCheck` | Review |
| Explain My Taxes | `Calculator` | *(matches tool icon)* |

All SectionIntro icons use `w-8 h-8` sizing.

### Chart / Visualization Colors

Semantic colors used across all chart components (waterfalls, Sankeys, bar charts, donuts). Every visualization on the same page must use the same color for the same concept.

#### Core Semantic Palette

| Concept | Hex | Color | Usage |
|---------|-----|-------|-------|
| **Income / Source** | `#3B82F6` | Blue | Total income, gross receipts, starting amounts |
| **Adjustments** | `#F59E0B` | Amber | Above-the-line adjustments to income |
| **Expenses / COGS** | `#F59E0B` | Amber | Business expenses, cost of goods sold |
| **Deductions** | `#14B8A6` | Teal | Standard or itemized deductions |
| **QBI Deduction** | `#06B6D4` | Cyan | Qualified Business Income deduction |
| **SE Deductions** | `#10B981` | Emerald | SE health insurance, retirement, tax deduction |
| **Credits (nonrefundable)** | `#FB923C` | Orange | Warm palette for nonrefundable credits |
| **Credits (refundable)** | `#34D399` | Emerald | Cool palette for refundable credits |
| **Positive result** | `#10B981` | Emerald | Net profit, positive outcomes |
| **Negative result** | `#EF4444` | Red | Net loss, negative outcomes |
| **Intermediate sums** | `#94A3B8` | Slate | AGI, taxable income, checkpoint bars |

#### SE Expense Subcategories (Sankey only)

| Concept | Hex | Color |
|---------|-----|-------|
| Home Office | `#A78BFA` | Purple |
| Vehicle | `#818CF8` | Indigo |
| Depreciation | `#6366F1` | Dark Indigo |

#### Multi-Category Rotating Palette

For charts with many items that don't map to a single semantic concept (income donut, expense bar chart), use this 10-color rotating palette:

```
#3B82F6, #10B981, #F59E0B, #8B5CF6, #14B8A6,
#EF4444, #F97316, #EC4899, #06B6D4, #84CC16
```

#### Chart UI Constants

| Element | Color |
|---------|-------|
| Tooltip background | `#1E293B` |
| Tooltip border | `#475569` |
| Tooltip text | `#E2E8F0` |
| Axis labels | `#94A3B8` |
| Data labels | `#E2E8F0` |
| Connector lines | `#475569` (dashed `4,3`) |
| Sankey node labels | `#CBD5E1` |
| Sankey amount text | `#94A3B8` |
| Font family | `Inter Variable, sans-serif` |

### Icon Colors

- Section heading icons: `text-telos-orange-400` (consistent brand accent)
- Inline status icons: Match the semantic color of their context

### Background Accents

- Hero cards with orange context: `bg-telos-orange-500/5 border-telos-orange-500/20`
- Hero cards with emerald context: `bg-emerald-500/5 border-emerald-500/20`
- Hero cards with amber context: `bg-amber-500/5 border-amber-500/20`
