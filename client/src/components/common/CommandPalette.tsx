import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTaxReturnStore, SECTIONS } from '../../store/taxReturnStore';
import { SIDEBAR_TOOLS, hasMinimumIncomeData } from '../../data/sidebarTools';
import { IRS_FORM_STEP_MAP } from '../../data/irsFormStepMap';
import { buildHelpItems, COMMON_QUESTIONS } from '../../data/helpSearchIndex';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  Search, ArrowRight, Wrench, User, HelpCircle, Hash, X,
} from 'lucide-react';

// ── Highlight helper ─────────────────────────────────────────────

/** Wraps substrings that match `query` tokens in a <mark> for visual emphasis. */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  // Escape regex special chars, then join tokens with "|"
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (tokens.length === 0) return text;
  const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-telos-blue-600/30 text-white rounded-sm px-0.5">{part}</mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

// ── Types ────────────────────────────────────────────────────────

type CommandCategory = 'step' | 'tool' | 'data' | 'irs_form' | 'help';

interface CommandItem {
  id: string;
  label: string;
  category: CommandCategory;
  section?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  disabled?: boolean;
  disabledReason?: string;
  navHint?: string;
  onSelect: () => void;
}

const CATEGORY_ORDER: CommandCategory[] = ['step', 'data', 'irs_form', 'tool', 'help'];

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  step: 'Steps',
  data: 'Your Data',
  irs_form: 'IRS Forms',
  tool: 'Tools',
  help: 'Help',
};

const CATEGORY_ICONS: Record<CommandCategory, React.ReactNode> = {
  step: <ArrowRight className="w-3 h-3" />,
  data: <User className="w-3 h-3" />,
  irs_form: <Hash className="w-3 h-3" />,
  tool: <Wrench className="w-3 h-3" />,
  help: <HelpCircle className="w-3 h-3" />,
};

// ── Section label lookup ─────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {};
for (const s of SECTIONS) {
  SECTION_LABELS[s.id] = s.label;
}

// ── Component ────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isKeyboardNav, setIsKeyboardNav] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { taxReturn, goToStep, setActiveTool, getVisibleSteps, viewMode, setViewMode, setActiveForm } = useTaxReturnStore();
  const hasData = hasMinimumIncomeData(taxReturn);

  // Focus trap (handles Escape + Tab trapping + scroll lock)
  useFocusTrap(containerRef, open, onClose);

  // Reset state and autofocus when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ── Build full command list ──────────────────────────────────

  const allCommands = useMemo((): CommandItem[] => {
    const commands: CommandItem[] = [];

    const selectAndClose = (fn: () => void) => () => { fn(); onClose(); };

    const goToWizardStep = (stepId: string) => {
      if (viewMode === 'forms') setViewMode('wizard');
      goToStep(stepId);
    };

    // 1. Visible steps (skip transition_*)
    const visibleSteps = getVisibleSteps();
    for (const step of visibleSteps) {
      if (step.id.startsWith('transition_')) continue;
      commands.push({
        id: `step-${step.id}`,
        label: step.label,
        category: 'step',
        section: SECTION_LABELS[step.section] ?? step.section,
        icon: <ArrowRight className="w-3.5 h-3.5" />,
        onSelect: selectAndClose(() => goToWizardStep(step.id)),
      });
    }

    // 2. Sidebar tools (includes Import Data and Export/Download)
    for (const tool of SIDEBAR_TOOLS) {
      const isDisabled = tool.needsData === true && !hasData;
      commands.push({
        id: `tool-${tool.id}`,
        label: tool.label,
        category: 'tool',
        icon: <tool.icon className="w-3.5 h-3.5" />,
        keywords: tool.keywords,
        disabled: isDisabled,
        disabledReason: isDisabled ? 'Enter income data first' : undefined,
        onSelect: selectAndClose(() => {
          if (tool.type === 'navigate' && tool.stepId) {
            goToWizardStep(tool.stepId);
          } else {
            if (viewMode === 'forms') setViewMode('wizard');
            setActiveTool(tool.id);
          }
        }),
      });
    }

    // 3. User data entities
    // MAINTENANCE: When adding a new income array to TaxReturn (e.g. income1099LTC),
    // add a corresponding extraction block below so user-entered entities appear in
    // the Cmd+K command palette under "Your Data".
    if (taxReturn) {
      // W-2 employers
      if (taxReturn.w2Income) {
        for (const w2 of taxReturn.w2Income) {
          if (w2.employerName) {
            commands.push({
              id: `data-w2-${w2.id}`,
              label: w2.employerName,
              category: 'data',
              section: 'W-2 Employer',
              keywords: ['w-2', 'w2', 'employer', 'wages'],
              onSelect: selectAndClose(() => goToWizardStep('w2_income')),
            });
          }
        }
      }

      // 1099-NEC payers
      if (taxReturn.income1099NEC) {
        for (const nec of taxReturn.income1099NEC) {
          if (nec.payerName) {
            commands.push({
              id: `data-1099nec-${nec.id}`,
              label: nec.payerName,
              category: 'data',
              section: '1099-NEC Payer',
              keywords: ['1099-nec', 'freelance', 'contractor'],
              onSelect: selectAndClose(() => goToWizardStep('1099nec_income')),
            });
          }
        }
      }

      // 1099-K platforms
      if (taxReturn.income1099K) {
        for (const k of taxReturn.income1099K) {
          if (k.platformName) {
            commands.push({
              id: `data-1099k-${k.id}`,
              label: k.platformName,
              category: 'data',
              section: '1099-K Platform',
              keywords: ['1099-k', 'payment', 'platform'],
              onSelect: selectAndClose(() => goToWizardStep('1099k_income')),
            });
          }
        }
      }

      // 1099-INT payers
      if (taxReturn.income1099INT) {
        for (const i of taxReturn.income1099INT) {
          if (i.payerName) {
            commands.push({
              id: `data-1099int-${i.id}`,
              label: i.payerName,
              category: 'data',
              section: '1099-INT Payer',
              keywords: ['1099-int', 'interest', 'bank'],
              onSelect: selectAndClose(() => goToWizardStep('1099int_income')),
            });
          }
        }
      }

      // 1099-DIV payers
      if (taxReturn.income1099DIV) {
        for (const d of taxReturn.income1099DIV) {
          if (d.payerName) {
            commands.push({
              id: `data-1099div-${d.id}`,
              label: d.payerName,
              category: 'data',
              section: '1099-DIV Payer',
              keywords: ['1099-div', 'dividend'],
              onSelect: selectAndClose(() => goToWizardStep('1099div_income')),
            });
          }
        }
      }

      // 1099-R payers
      if (taxReturn.income1099R) {
        for (const r of taxReturn.income1099R) {
          if (r.payerName) {
            commands.push({
              id: `data-1099r-${r.id}`,
              label: r.payerName,
              category: 'data',
              section: '1099-R Payer',
              keywords: ['1099-r', 'retirement'],
              onSelect: selectAndClose(() => goToWizardStep('1099r_income')),
            });
          }
        }
      }

      // 1099-G payers
      if (taxReturn.income1099G) {
        for (const g of taxReturn.income1099G) {
          if (g.payerName) {
            commands.push({
              id: `data-1099g-${g.id}`,
              label: g.payerName,
              category: 'data',
              section: '1099-G Payer',
              keywords: ['1099-g', 'unemployment'],
              onSelect: selectAndClose(() => goToWizardStep('1099g_income')),
            });
          }
        }
      }

      // 1099-MISC payers
      if (taxReturn.income1099MISC) {
        for (const m of taxReturn.income1099MISC) {
          if (m.payerName) {
            commands.push({
              id: `data-1099misc-${m.id}`,
              label: m.payerName,
              category: 'data',
              section: '1099-MISC Payer',
              keywords: ['1099-misc', 'miscellaneous'],
              onSelect: selectAndClose(() => goToWizardStep('1099misc_income')),
            });
          }
        }
      }

      // 1099-SA payers (HSA)
      if (taxReturn.income1099SA) {
        for (const sa of taxReturn.income1099SA) {
          if (sa.payerName) {
            commands.push({
              id: `data-1099sa-${sa.id}`,
              label: sa.payerName,
              category: 'data',
              section: '1099-SA Payer',
              keywords: ['1099-sa', 'hsa', 'health savings'],
              onSelect: selectAndClose(() => goToWizardStep('1099sa_income')),
            });
          }
        }
      }

      // W-2G payers (gambling)
      if (taxReturn.incomeW2G) {
        for (const wg of taxReturn.incomeW2G) {
          if (wg.payerName) {
            commands.push({
              id: `data-w2g-${wg.id}`,
              label: wg.payerName,
              category: 'data',
              section: 'W-2G Payer',
              keywords: ['w-2g', 'gambling', 'winnings'],
              onSelect: selectAndClose(() => goToWizardStep('w2g_income')),
            });
          }
        }
      }

      // 1099-C creditors (cancelled debt)
      if (taxReturn.income1099C) {
        for (const c of taxReturn.income1099C) {
          if (c.payerName) {
            commands.push({
              id: `data-1099c-${c.id}`,
              label: c.payerName,
              category: 'data',
              section: '1099-C Creditor',
              keywords: ['1099-c', 'cancelled debt', 'cancellation'],
              onSelect: selectAndClose(() => goToWizardStep('1099c_income')),
            });
          }
        }
      }

      // 1099-Q payers (529 plans)
      if (taxReturn.income1099Q) {
        for (const q of taxReturn.income1099Q) {
          if (q.payerName) {
            commands.push({
              id: `data-1099q-${q.id}`,
              label: q.payerName,
              category: 'data',
              section: '1099-Q Plan',
              keywords: ['1099-q', '529', 'education'],
              onSelect: selectAndClose(() => goToWizardStep('1099q_income')),
            });
          }
        }
      }

      // Business names (both legacy single and multi-business)
      const allBusinesses = [
        ...(taxReturn.businesses ?? []),
        ...(taxReturn.business ? [taxReturn.business] : []),
      ];
      const seenBizIds = new Set<string>();
      for (const biz of allBusinesses) {
        if (biz.businessName && !seenBizIds.has(biz.id)) {
          seenBizIds.add(biz.id);
          commands.push({
            id: `data-biz-${biz.id}`,
            label: biz.businessName,
            category: 'data',
            section: 'Business',
            keywords: ['business', 'schedule c', 'self-employment'],
            onSelect: selectAndClose(() => goToWizardStep('business_info')),
          });
        }
      }

      // Rental properties
      if (taxReturn.rentalProperties) {
        for (const prop of taxReturn.rentalProperties) {
          if (prop.address) {
            commands.push({
              id: `data-rental-${prop.id}`,
              label: prop.address,
              category: 'data',
              section: 'Rental Property',
              keywords: ['rental', 'property', 'schedule e'],
              onSelect: selectAndClose(() => goToWizardStep('rental_income')),
            });
          }
        }
      }

      // K-1 entities
      if (taxReturn.incomeK1) {
        for (const k1 of taxReturn.incomeK1) {
          if (k1.entityName) {
            commands.push({
              id: `data-k1-${k1.id}`,
              label: k1.entityName,
              category: 'data',
              section: 'K-1 Entity',
              keywords: ['k-1', 'partnership', 's-corp'],
              onSelect: selectAndClose(() => goToWizardStep('k1_income')),
            });
          }
        }
      }

      // Dependents
      if (taxReturn.dependents) {
        for (const dep of taxReturn.dependents) {
          if (dep.firstName) {
            const name = [dep.firstName, dep.lastName].filter(Boolean).join(' ');
            commands.push({
              id: `data-dep-${dep.id}`,
              label: name,
              category: 'data',
              section: 'Dependent',
              keywords: ['dependent', 'child', 'qualifying'],
              onSelect: selectAndClose(() => goToWizardStep('dependents')),
            });
          }
        }
      }

      // 1099-B brokers
      if (taxReturn.income1099B) {
        for (const b of taxReturn.income1099B) {
          if (b.brokerName) {
            commands.push({
              id: `data-1099b-${b.id}`,
              label: b.brokerName,
              category: 'data',
              section: '1099-B Broker',
              keywords: ['1099-b', 'broker', 'stock', 'capital gains'],
              onSelect: selectAndClose(() => goToWizardStep('1099b_income')),
            });
          }
        }
      }

      // 1099-DA brokers (digital assets)
      if (taxReturn.income1099DA) {
        for (const da of taxReturn.income1099DA) {
          const label = [da.brokerName, da.tokenName].filter(Boolean).join(' — ');
          if (label) {
            commands.push({
              id: `data-1099da-${da.id}`,
              label,
              category: 'data',
              section: '1099-DA Digital Asset',
              keywords: ['1099-da', 'crypto', 'digital asset', 'bitcoin', 'token'],
              onSelect: selectAndClose(() => goToWizardStep('1099da_income')),
            });
          }
        }
      }

      // Education credits
      if (taxReturn.educationCredits) {
        for (const ec of taxReturn.educationCredits) {
          const label = [ec.studentName, ec.institution].filter(Boolean).join(' — ');
          if (label) {
            commands.push({
              id: `data-edu-${ec.id}`,
              label,
              category: 'data',
              section: 'Education Credit',
              keywords: ['education', 'tuition', '1098-t', 'student', 'american opportunity', 'lifetime learning'],
              onSelect: selectAndClose(() => goToWizardStep('education_credits')),
            });
          }
        }
      }

      // Dependent care providers
      if (taxReturn.dependentCare?.providers) {
        for (const [i, prov] of taxReturn.dependentCare.providers.entries()) {
          if (prov.name) {
            commands.push({
              id: `data-depcare-${i}`,
              label: prov.name,
              category: 'data',
              section: 'Care Provider',
              keywords: ['dependent care', 'child care', 'daycare', 'provider', 'form 2441'],
              onSelect: selectAndClose(() => goToWizardStep('dependent_care')),
            });
          }
        }
      }

      // Form 4797 properties
      if (taxReturn.form4797Properties) {
        for (const prop of taxReturn.form4797Properties) {
          if (prop.description) {
            commands.push({
              id: `data-4797-${prop.id}`,
              label: prop.description,
              category: 'data',
              section: 'Form 4797 Property',
              keywords: ['4797', 'business property', 'sale'],
              onSelect: selectAndClose(() => goToWizardStep('form4797')),
            });
          }
        }
      }

      // Non-cash charitable donations
      if (taxReturn.itemizedDeductions?.nonCashDonations) {
        for (const don of taxReturn.itemizedDeductions.nonCashDonations) {
          if (don.doneeOrganization) {
            commands.push({
              id: `data-noncash-${don.id}`,
              label: don.doneeOrganization,
              category: 'data',
              section: 'Non-Cash Donation',
              keywords: ['noncash', 'charitable', 'donation', 'form 8283'],
              onSelect: selectAndClose(() => goToWizardStep('charitable_deduction')),
            });
          }
        }
      }

      // 1095-A marketplace forms
      if (taxReturn.premiumTaxCredit?.forms1095A) {
        for (const f of taxReturn.premiumTaxCredit.forms1095A) {
          if (f.marketplace) {
            commands.push({
              id: `data-1095a-${f.id}`,
              label: f.marketplace,
              category: 'data',
              section: '1095-A Marketplace',
              keywords: ['1095-a', 'marketplace', 'premium tax credit', 'aca', 'health insurance'],
              onSelect: selectAndClose(() => goToWizardStep('premium_tax_credit')),
            });
          }
        }
      }

      // Depreciation assets
      if (taxReturn.depreciationAssets) {
        for (const asset of taxReturn.depreciationAssets) {
          if (asset.description) {
            commands.push({
              id: `data-deprec-${asset.id}`,
              label: asset.description,
              category: 'data',
              section: 'Depreciation Asset',
              keywords: ['depreciation', 'section 179', 'macrs', 'form 4562', 'asset'],
              onSelect: selectAndClose(() => goToWizardStep('depreciation_assets')),
            });
          }
        }
      }

      // EV refueling properties
      if (taxReturn.evRefuelingCredit?.properties) {
        for (const [i, prop] of taxReturn.evRefuelingCredit.properties.entries()) {
          if (prop.description) {
            commands.push({
              id: `data-evrefuel-${i}`,
              label: prop.description,
              category: 'data',
              section: 'EV Refueling Property',
              keywords: ['ev', 'refueling', 'charger', 'form 8911'],
              onSelect: selectAndClose(() => goToWizardStep('ev_refueling')),
            });
          }
        }
      }

      // State returns
      if (taxReturn.stateReturns) {
        const stateNames: Record<string, string> = {
          AL: 'Alabama', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
          CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', GA: 'Georgia', HI: 'Hawaii',
          ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
          KY: 'Kentucky', LA: 'Louisiana', MA: 'Massachusetts', MD: 'Maryland', ME: 'Maine',
          MI: 'Michigan', MN: 'Minnesota', MO: 'Missouri', MS: 'Mississippi', MT: 'Montana',
          NC: 'North Carolina', ND: 'North Dakota', NE: 'Nebraska', NJ: 'New Jersey', NM: 'New Mexico',
          NY: 'New York', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
          RI: 'Rhode Island', SC: 'South Carolina', UT: 'Utah', VA: 'Virginia', VT: 'Vermont',
          WI: 'Wisconsin', WV: 'West Virginia',
        };
        for (const sr of taxReturn.stateReturns) {
          if (sr.stateCode) {
            commands.push({
              id: `data-state-${sr.stateCode}`,
              label: `${stateNames[sr.stateCode] || sr.stateCode} State Return`,
              category: 'data',
              section: 'State Return',
              keywords: ['state', 'state tax', sr.stateCode.toLowerCase(), (stateNames[sr.stateCode] || '').toLowerCase()],
              onSelect: selectAndClose(() => goToWizardStep('state_review')),
            });
          }
        }
      }
    }

    // 4. IRS form mappings (view-aware navigation)
    for (const [i, entry] of IRS_FORM_STEP_MAP.entries()) {
      commands.push({
        id: `irs-${entry.stepId}-${i}`,
        label: entry.label,
        category: 'irs_form',
        keywords: entry.terms,
        navHint: entry.formId
          ? (viewMode === 'forms' ? 'PDF' : 'Interview')
          : undefined,
        onSelect: selectAndClose(() => {
          if (viewMode === 'forms' && entry.formId) {
            setActiveForm(entry.formId, 0);
          } else {
            goToWizardStep(entry.stepId);
          }
        }),
      });
    }

    // 5. Help items
    const helpItems = buildHelpItems();
    for (const item of helpItems) {
      commands.push({
        id: item.id,
        label: item.label,
        category: 'help',
        keywords: item.keywords,
        onSelect: selectAndClose(() => goToWizardStep(item.stepId)),
      });
    }

    for (const q of COMMON_QUESTIONS) {
      commands.push({
        id: q.id,
        label: q.label,
        category: 'help',
        keywords: q.keywords,
        onSelect: selectAndClose(() => goToWizardStep(q.stepId)),
      });
    }

    return commands;
  }, [taxReturn, getVisibleSteps, hasData, goToStep, setActiveTool, onClose, viewMode, setViewMode, setActiveForm]);

  // ── Filter (multi-token: "w2 inc" matches "W-2 Income") ─────

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return allCommands.filter((item) => {
      const haystack = [
        item.label.toLowerCase(),
        item.section?.toLowerCase() ?? '',
        ...(item.keywords?.map(k => k.toLowerCase()) ?? []),
      ].join(' ');
      return tokens.every((t) => haystack.includes(t));
    });
  }, [allCommands, query]);

  // ── Group by category ────────────────────────────────────────

  const grouped = useMemo(() => {
    const map = new Map<CommandCategory, CommandItem[]>();
    for (const item of filteredCommands) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return CATEGORY_ORDER
      .filter(cat => map.has(cat))
      .map(cat => ({ category: cat, label: CATEGORY_LABELS[cat], items: map.get(cat)! }));
  }, [filteredCommands]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Stable index map for rendering (avoids mutable counter in render body)
  const flatIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    let idx = 0;
    for (const group of grouped) {
      for (const item of group.items) {
        m.set(item.id, idx++);
      }
    }
    return m;
  }, [grouped]);

  // Clamp activeIndex when results change
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, flatItems.length - 1)));
  }, [flatItems.length]);

  // Scroll active item into view (only for keyboard navigation)
  useEffect(() => {
    if (!listRef.current || !isKeyboardNav) return;
    const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isKeyboardNav]);

  // ── Keyboard handler ─────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setIsKeyboardNav(true);
          setActiveIndex((prev) => (prev + 1) % Math.max(1, flatItems.length));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setIsKeyboardNav(true);
          setActiveIndex((prev) => (prev - 1 + flatItems.length) % Math.max(1, flatItems.length));
          break;
        case 'Home':
          e.preventDefault();
          setIsKeyboardNav(true);
          setActiveIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setIsKeyboardNav(true);
          setActiveIndex(Math.max(0, flatItems.length - 1));
          break;
        case 'Enter': {
          e.preventDefault();
          const item = flatItems[activeIndex];
          if (item && !item.disabled) item.onSelect();
          break;
        }
        // Escape is handled by useFocusTrap
      }
    },
    [flatItems, activeIndex],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-start pt-[20vh]">
      {/* Click-outside overlay */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Dialog */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg mx-4 bg-surface-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[60vh]"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            role="combobox"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search steps, forms, tools, or help..."
            className="flex-1 bg-transparent text-white placeholder-slate-400 text-sm outline-none"
            aria-expanded={true}
            aria-autocomplete="list"
            aria-controls="command-palette-list"
            aria-activedescendant={isKeyboardNav && flatItems[activeIndex] ? `cmd-${flatItems[activeIndex].id}` : undefined}
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-surface-700 transition-colors"
            aria-label="Close"
            tabIndex={-1}
          >
            <X size={16} />
          </button>
        </div>

        {/* Live region for screen readers */}
        <div aria-live="polite" className="sr-only">
          {flatItems.length === 0 && query.trim()
            ? `No results for ${query}`
            : `${flatItems.length} result${flatItems.length !== 1 ? 's' : ''}`}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          aria-label="Search results"
          className="flex-1 overflow-y-auto py-2"
        >
          {flatItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category} role="group" aria-label={group.label}>
                {/* Category header (visual only — group label handles a11y) */}
                <div className="flex items-center gap-2 px-4 py-1.5" aria-hidden="true">
                  <span className="text-slate-400">{CATEGORY_ICONS[group.category]}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </span>
                </div>

                {/* Items */}
                {group.items.map((item) => {
                  const idx = flatIndexMap.get(item.id)!;
                  const isActive = idx === activeIndex;

                  return (
                    <div
                      key={item.id}
                      id={`cmd-${item.id}`}
                      role="option"
                      aria-selected={isActive}
                      aria-disabled={item.disabled || undefined}
                      aria-label={item.disabled ? `${item.label} — ${item.disabledReason}` : undefined}
                      data-index={idx}
                      onClick={() => { if (!item.disabled) item.onSelect(); }}
                      onMouseEnter={() => { setIsKeyboardNav(false); setActiveIndex(idx); }}
                      className={`
                        flex items-center gap-3 px-4 py-2 text-sm
                        ${item.disabled
                          ? 'text-slate-600 cursor-not-allowed'
                          : isActive
                            ? 'bg-telos-blue-600/20 text-white cursor-pointer'
                            : 'text-slate-300 hover:bg-surface-700 cursor-pointer'
                        }
                      `}
                    >
                      <span className={`shrink-0 ${item.disabled ? 'opacity-40' : isActive ? 'text-telos-blue-400' : 'text-slate-400'}`}>
                        {item.icon ?? CATEGORY_ICONS[item.category]}
                      </span>
                      <span className={`flex-1 truncate ${item.disabled ? 'opacity-40' : ''}`}>
                        {highlightMatch(item.label, query)}
                      </span>
                      {item.section && (
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 bg-surface-700 px-1.5 py-0.5 rounded shrink-0">
                          {item.section}
                        </span>
                      )}
                      {item.navHint && (
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                          item.navHint === 'PDF'
                            ? 'text-telos-blue-400 bg-telos-blue-600/15'
                            : 'text-slate-500 bg-surface-700'
                        }`}>
                          {item.navHint}
                        </span>
                      )}
                      {item.disabled && item.disabledReason && (
                        <span className="text-[10px] text-slate-600 shrink-0">{item.disabledReason}</span>
                      )}
                      {isActive && !item.disabled && (
                        <ArrowRight className="w-3 h-3 text-telos-blue-400 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-700 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <kbd className="bg-surface-700 text-slate-400 px-1.5 py-0.5 rounded font-mono">&uarr;&darr;</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-surface-700 text-slate-400 px-1.5 py-0.5 rounded font-mono">&crarr;</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-surface-700 text-slate-400 px-1.5 py-0.5 rounded font-mono">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
