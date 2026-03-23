import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X, Search, Calculator, BookOpen, AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import PillToggle from '../common/PillToggle';
import type { PillOption } from '../common/PillToggle';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import RangeSlider from '../scenarioLab/RangeSlider';
import CalloutCard from '../common/CalloutCard';
import {
  searchDonationItems,
  getItemsByCategory,
  calculateSliderFMV,
  calculateDepreciatedFMV,
  DONATION_CATEGORIES,
  type DonationItemEntry,
  type DonationCategory,
  type DonationItemCondition,
} from '@telostax/engine';

interface DonationValuationPanelProps {
  onSelect: (result: { fairMarketValue: number; method: string; itemName?: string }) => void;
  onClose: () => void;
}

type PanelMode = 'lookup' | 'calculator';

const MODE_OPTIONS: PillOption<PanelMode>[] = [
  { value: 'lookup', label: 'Value Lookup', icon: <Search className="w-4 h-4" /> },
  { value: 'calculator', label: 'Depreciation Calc', icon: <Calculator className="w-4 h-4" /> },
];

const CONDITION_OPTIONS: PillOption<DonationItemCondition>[] = [
  { value: 'good', label: 'Good' },
  { value: 'very_good', label: 'Very Good' },
  { value: 'like_new', label: 'Like New' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  ...DONATION_CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
];

const SOURCE_LABELS: Record<string, string> = {
  salvation_army: 'SA',
  goodwill: 'GW',
};

const SOURCE_METHOD: Record<string, string> = {
  salvation_army: 'Salvation Army Valuation Guide',
  goodwill: 'Goodwill Valuation Guide',
};

export default function DonationValuationPanel({ onSelect, onClose }: DonationValuationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useFocusTrap(panelRef, true, onClose);

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  // ─── Mode toggle ──────────────────────────────────────
  const [mode, setMode] = useState<PanelMode>('lookup');

  // ─── Lookup state ─────────────────────────────────────
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DonationCategory | ''>('');
  const [selectedItem, setSelectedItem] = useState<DonationItemEntry | null>(null);
  const [condition, setCondition] = useState<DonationItemCondition | undefined>('good');
  const [sliderValue, setSliderValue] = useState<number>(0);

  // ─── Calculator state ─────────────────────────────────
  const [originalPrice, setOriginalPrice] = useState<number>(0);
  const [ageYears, setAgeYears] = useState<string>('');
  const [calcCategory, setCalcCategory] = useState<DonationCategory | 'general'>('general');

  // ─── Search results ───────────────────────────────────
  const searchResults = useMemo(() => {
    if (query.trim().length > 0) {
      return searchDonationItems(query, categoryFilter || undefined);
    }
    if (categoryFilter) {
      return getItemsByCategory(categoryFilter).map((item) => ({ item, score: 0 }));
    }
    return [];
  }, [query, categoryFilter]);

  // ─── Computed FMV (lookup) ────────────────────────────
  const lookupFMV = useMemo(() => {
    if (!selectedItem) return 0;
    return calculateSliderFMV(selectedItem, sliderValue);
  }, [selectedItem, sliderValue]);

  // ─── Computed FMV (calculator) ────────────────────────
  const calcResult = useMemo(() => {
    const age = parseFloat(ageYears);
    if (originalPrice <= 0 || isNaN(age) || age < 0) return null;
    return calculateDepreciatedFMV({ originalPrice, ageYears: age, category: calcCategory });
  }, [originalPrice, ageYears, calcCategory]);

  // The active estimated FMV for warning checks
  const activeFMV = mode === 'lookup' ? lookupFMV : (calcResult?.estimatedFMV ?? 0);

  // ─── Condition pill → slider sync ─────────────────────
  const handleConditionChange = useCallback((val: DonationItemCondition | undefined) => {
    setCondition(val);
    if (val === 'good') setSliderValue(0);
    else if (val === 'very_good') setSliderValue(0.5);
    else if (val === 'like_new') setSliderValue(1);
  }, []);

  const handleSliderChange = useCallback((val: number) => {
    setSliderValue(val);
    // Snap condition pills to nearest position
    if (val <= 0.15) setCondition('good');
    else if (val >= 0.4 && val <= 0.6) setCondition('very_good');
    else if (val >= 0.85) setCondition('like_new');
    else setCondition(undefined);
  }, []);

  const handleSelectItem = useCallback((item: DonationItemEntry) => {
    setSelectedItem(item);
    setCondition('good');
    setSliderValue(0);
  }, []);

  // ─── Use This Value handlers ──────────────────────────
  const handleUseLookupValue = useCallback(() => {
    if (!selectedItem) return;
    onSelect({
      fairMarketValue: lookupFMV,
      method: SOURCE_METHOD[selectedItem.source] ?? 'Charity valuation guide',
      itemName: selectedItem.name,
    });
  }, [selectedItem, lookupFMV, onSelect]);

  const handleUseCalcValue = useCallback(() => {
    if (!calcResult) return;
    onSelect({
      fairMarketValue: calcResult.estimatedFMV,
      method: calcResult.method,
    });
  }, [calcResult, onSelect]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Panel — slides in from right, z-50 to appear above chat panel (z-40) */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Donation Value Lookup"
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[28rem] bg-surface-800 border-l border-slate-700 z-50 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-telos-blue-400" />
            <h2 className="font-semibold text-white">Donation Value Lookup</h2>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 py-4 space-y-4">
          {/* Disclaimer */}
          <CalloutCard variant="info" title="Estimates only">
            These values are estimates based on published charity valuation guides and typical
            depreciation rates. Your actual fair market value may differ based on condition, brand,
            and local market. For items valued over $5,000, a qualified appraisal is required by the IRS.
          </CalloutCard>

          {/* $5,000 appraisal warning */}
          {activeFMV > 5000 && (
            <div className="rounded-lg border p-3 bg-amber-500/10 border-amber-500/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" />
              <p className="text-sm text-amber-300">
                Items valued over $5,000 require a qualified appraisal and Form 8283 Section B.
                This tool cannot substitute for a professional appraisal.
              </p>
            </div>
          )}

          {/* Mode toggle */}
          <PillToggle<PanelMode>
            value={mode}
            onChange={(v) => v && setMode(v)}
            options={MODE_OPTIONS}
            size="sm"
          />

          {/* ─── Mode A: Database Lookup ─────────────── */}
          {mode === 'lookup' && (
            <div className="space-y-3">
              {/* Search + Category filter */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="input-field pl-9"
                  placeholder="Search items (e.g., sofa, winter coat)..."
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedItem(null); }}
                />
              </div>

              <select
                className="input-field text-sm"
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value as DonationCategory | ''); setSelectedItem(null); }}
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Results */}
              {searchResults.length > 0 && !selectedItem && (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700/50">
                  {searchResults.map((r) => {
                    const item = 'item' in r ? r.item : r;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-700/50 transition-colors flex items-center justify-between gap-2"
                        onClick={() => handleSelectItem(item)}
                      >
                        <div>
                          <div className="text-sm text-white">{item.name}</div>
                          <div className="text-xs text-slate-400">
                            ${item.lowFMV} &ndash; ${item.highFMV}
                          </div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-medium shrink-0">
                          {SOURCE_LABELS[item.source]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Source abbreviation legend */}
              {searchResults.length > 0 && !selectedItem && (
                <div className="flex items-center gap-3 text-[11px] text-slate-500 px-1">
                  <span><span className="px-1 py-0.5 rounded bg-slate-700 text-slate-400 font-medium">SA</span> Salvation Army</span>
                  <span><span className="px-1 py-0.5 rounded bg-slate-700 text-slate-400 font-medium">GW</span> Goodwill</span>
                </div>
              )}

              {query.trim().length > 0 && searchResults.length === 0 && !selectedItem && (
                <p className="text-sm text-slate-500 text-center py-4">No items found. Try a different search term.</p>
              )}

              {/* Selected item detail */}
              {selectedItem && (
                <div className="rounded-lg border border-slate-700 p-4 space-y-3 bg-surface-900/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{selectedItem.name}</div>
                      <div className="text-xs text-slate-400">
                        ${selectedItem.lowFMV} &ndash; ${selectedItem.highFMV}
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-700 text-slate-500 font-medium">
                          {SOURCE_LABELS[selectedItem.source]}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-telos-blue-400 hover:text-telos-blue-300"
                      onClick={() => setSelectedItem(null)}
                    >
                      Change
                    </button>
                  </div>

                  {/* Condition pills */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Condition</label>
                    <PillToggle<DonationItemCondition>
                      value={condition}
                      onChange={handleConditionChange}
                      options={CONDITION_OPTIONS}
                      size="sm"
                    />
                  </div>

                  {/* Slider */}
                  <RangeSlider
                    value={selectedItem.lowFMV + sliderValue * (selectedItem.highFMV - selectedItem.lowFMV)}
                    min={selectedItem.lowFMV}
                    max={selectedItem.highFMV}
                    step={1}
                    format="currency"
                    label="Fair Market Value"
                    onChange={(raw) => {
                      const range = selectedItem.highFMV - selectedItem.lowFMV;
                      const pos = range > 0 ? (raw - selectedItem.lowFMV) / range : 0;
                      handleSliderChange(Math.min(1, Math.max(0, pos)));
                    }}
                  />

                  {/* Estimated FMV */}
                  <div className="text-center py-2">
                    <div className="text-xs text-slate-400">Estimated FMV</div>
                    <div className="text-2xl font-semibold text-telos-orange-400">
                      ${lookupFMV.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-primary w-full text-sm"
                    onClick={handleUseLookupValue}
                  >
                    Use This Value
                  </button>
                </div>
              )}

              {/* Enter manually fallback */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  className="text-sm text-telos-blue-400 hover:text-telos-blue-300 underline underline-offset-2"
                  onClick={onClose}
                >
                  Enter manually instead
                </button>
              </div>
            </div>
          )}

          {/* ─── Mode B: Depreciation Calculator ─────── */}
          {mode === 'calculator' && (
            <div className="space-y-3">
              <FormField label="Original Purchase Price">
                <CurrencyInput
                  value={originalPrice || undefined}
                  onChange={setOriginalPrice}
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="Age (years)" helpText="Use decimals for partial years (e.g., 0.5 for 6 months)">
                <input
                  type="number"
                  className="input-field"
                  value={ageYears}
                  onChange={(e) => setAgeYears(e.target.value)}
                  placeholder="e.g., 3"
                  min="0"
                  step="0.5"
                />
              </FormField>

              <FormField label="Category">
                <select
                  className="input-field"
                  value={calcCategory}
                  onChange={(e) => setCalcCategory(e.target.value as DonationCategory | 'general')}
                >
                  <option value="general">General</option>
                  {DONATION_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </FormField>

              {/* Result */}
              {calcResult && (
                <div className="rounded-lg border border-slate-700 p-4 space-y-3 bg-surface-900/50">
                  <div className="text-center">
                    <div className="text-xs text-slate-400">Estimated FMV</div>
                    <div className="text-2xl font-semibold text-telos-orange-400">
                      ${calcResult.estimatedFMV.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {Math.round(calcResult.depreciationRate * 100)}% depreciation
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-primary w-full text-sm"
                    onClick={handleUseCalcValue}
                  >
                    Use This Value
                  </button>
                </div>
              )}

              {/* Enter manually fallback */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  className="text-sm text-telos-blue-400 hover:text-telos-blue-300 underline underline-offset-2"
                  onClick={onClose}
                >
                  Enter manually instead
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
