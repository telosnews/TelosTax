import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertItemized } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import AddButton from '../common/AddButton';
import { HandHeart, Pencil, Trash2, Search, AlertTriangle, Lightbulb, Info, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import StepWarningsBanner from '../common/StepWarningsBanner';
import WhatsNewCard from '../common/WhatsNewCard';
import DonationValuationPanel from './DonationValuationPanel';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import { validateContributionDate, validateAcquiredDate } from '../../utils/dateValidation';
import type { NonCashDonation, ItemizedDeductions, CharitableCarryforward } from '@telostax/engine';

const emptyItemized: ItemizedDeductions = {
  medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
  personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
  charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
};

const EMPTY_DONATION = {
  doneeOrganization: '',
  description: '',
  dateOfContribution: '',
  dateAcquired: '',
  howAcquired: '' as NonCashDonation['howAcquired'],
  fairMarketValue: 0,
  costBasis: 0,
  method: '',
  isCapitalGainProperty: false,
  hasQualifiedAppraisal: false,
  appraiserName: '',
};

const EMPTY_CARRYFORWARD = {
  year: new Date().getFullYear() - 1,
  amount: 0,
  category: 'cash' as CharitableCarryforward['category'],
};

export default function CharitableStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['itemized_deductions'];
  const form8283Help = HELP_CONTENT['form_8283'];
  const itemWarnings = useItemWarnings('form_8283');

  const items = taxReturn.itemizedDeductions || emptyItemized;
  const nonCashDonations: NonCashDonation[] = items.nonCashDonations || [];
  const showForm8283 = items.charitableNonCash > 500 || nonCashDonations.length > 0;

  // Form 8283 CRUD state
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_DONATION });
  const [showValuation, setShowValuation] = useState(false);

  const update = (field: keyof ItemizedDeductions, value: number) => {
    updateField('itemizedDeductions', { ...items, [field]: value });
  };

  const persistDonations = (donations: NonCashDonation[]) => {
    updateField('itemizedDeductions', { ...items, nonCashDonations: donations });
  };

  const cancelForm = () => {
    setForm({ ...EMPTY_DONATION });
    setAdding(false);
    setEditingId(null);
  };

  const startEdit = (item: NonCashDonation) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      doneeOrganization: item.doneeOrganization,
      description: item.description,
      dateOfContribution: item.dateOfContribution,
      dateAcquired: item.dateAcquired || '',
      howAcquired: (item.howAcquired || '') as NonCashDonation['howAcquired'],
      fairMarketValue: item.fairMarketValue,
      costBasis: item.costBasis || 0,
      method: item.method || '',
      isCapitalGainProperty: item.isCapitalGainProperty || false,
      hasQualifiedAppraisal: item.hasQualifiedAppraisal || false,
      appraiserName: item.appraiserName || '',
    });
  };

  const addItem = () => {
    const newItem: NonCashDonation = { id: crypto.randomUUID(), ...form };
    persistDonations([...nonCashDonations, newItem]);
    cancelForm();
  };

  const saveEdit = () => {
    if (!editingId) return;
    persistDonations(nonCashDonations.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = nonCashDonations.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'itemizedDeductions',
      nestedArrayKey: 'nonCashDonations',
      item: item as any,
      label: `Non-cash donation${item.description ? `: ${item.description}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const save = async () => {
    await upsertItemized(returnId, { ...items });
  };

  // ── Carryforward CRUD ──
  const carryforwards: CharitableCarryforward[] = items.charitableCarryforward || [];
  const [addingCF, setAddingCF] = useState(false);
  const [cfForm, setCfForm] = useState({ ...EMPTY_CARRYFORWARD });

  const persistCarryforwards = (cfs: CharitableCarryforward[]) => {
    updateField('itemizedDeductions', { ...items, charitableCarryforward: cfs });
  };

  const cancelCfForm = () => {
    setCfForm({ ...EMPTY_CARRYFORWARD });
    setAddingCF(false);
  };

  const addCarryforward = () => {
    persistCarryforwards([...carryforwards, { ...cfForm }]);
    cancelCfForm();
  };

  const removeCarryforward = (idx: number) => {
    persistCarryforwards(carryforwards.filter((_, i) => i !== idx));
  };

  const renderDonationForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Donee Organization" tooltip="Name of the qualified charitable organization that received the donation." irsRef={form8283Help?.fields['Donee Organization']?.irsRef}>
        <input className="input-field" value={form.doneeOrganization} onChange={(e) => setForm({ ...form, doneeOrganization: e.target.value })} placeholder="Charity name" />
      </FormField>
      <FormField label="Description of Donated Property" tooltip="Describe what you donated (e.g., 'Clothing and household goods', 'Used furniture', 'Artwork')." irsRef={form8283Help?.fields['Description of Donated Property']?.irsRef}>
        <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g., Clothing and household goods" />
      </FormField>
      <FormField label="Date Contributed" tooltip="The date you gave the property to the charity." irsRef={form8283Help?.fields['Date Contributed']?.irsRef} warning={validateContributionDate(form.dateOfContribution, form.dateAcquired)}>
        <input type="date" className="input-field" value={form.dateOfContribution} onChange={(e) => setForm({ ...form, dateOfContribution: e.target.value })} />
      </FormField>
      <FormField label="Fair Market Value" tooltip="The fair market value of the property on the date you contributed it." irsRef={form8283Help?.fields['Fair Market Value']?.irsRef}>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <CurrencyInput value={form.fairMarketValue} onChange={(v) => setForm({ ...form, fairMarketValue: v })} />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-telos-blue-600/15 text-telos-blue-300 border border-telos-blue-600/30 hover:bg-telos-blue-600/25 transition-colors whitespace-nowrap"
            onClick={() => setShowValuation(true)}
          >
            <Search className="w-3.5 h-3.5" />
            Look up value
          </button>
        </div>
      </FormField>
      <FormField label="Date Acquired" optional tooltip="The date you originally acquired the property." irsRef={form8283Help?.fields['Date Acquired']?.irsRef} warning={validateAcquiredDate(form.dateAcquired, form.dateOfContribution)}>
        <input type="date" className="input-field" value={form.dateAcquired} onChange={(e) => setForm({ ...form, dateAcquired: e.target.value })} />
      </FormField>
      <FormField label="How Acquired" optional tooltip="How you got the property." irsRef={form8283Help?.fields['How Acquired']?.irsRef}>
        <select className="input-field" value={form.howAcquired || ''} onChange={(e) => setForm({ ...form, howAcquired: (e.target.value || undefined) as NonCashDonation['howAcquired'] })}>
          <option value="">Select...</option>
          <option value="purchase">Purchase</option>
          <option value="gift">Gift</option>
          <option value="inheritance">Inheritance</option>
          <option value="exchange">Exchange</option>
          <option value="other">Other</option>
        </select>
      </FormField>
      <FormField label="Cost or Other Basis" optional tooltip="What you originally paid. Required for donations over $5,000." irsRef={form8283Help?.fields['Cost or Other Basis']?.irsRef}>
        <CurrencyInput value={form.costBasis} onChange={(v) => setForm({ ...form, costBasis: v })} />
      </FormField>
      <FormField label="Method of Valuation" optional tooltip="How you determined the fair market value." irsRef={form8283Help?.fields['Method of Valuation']?.irsRef}>
        <input className="input-field" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} placeholder="e.g., Thrift shop value" />
      </FormField>
      <FormField label="Capital gain property" tooltip="Property that would produce long-term capital gain if sold. Subject to 30% AGI limit instead of 50%.">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded border-slate-600 bg-surface-700 text-telos-blue-500 focus:ring-telos-blue-500" checked={form.isCapitalGainProperty} onChange={(e) => setForm({ ...form, isCapitalGainProperty: e.target.checked })} />
          <span className="text-sm text-slate-300">This is capital gain property</span>
        </label>
      </FormField>
      {form.fairMarketValue > 5000 && (
        <FormField label="Has qualified appraisal" tooltip="Required for Form 8283 Section B (donations over $5,000).">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded border-slate-600 bg-surface-700 text-telos-blue-500 focus:ring-telos-blue-500" checked={form.hasQualifiedAppraisal} onChange={(e) => setForm({ ...form, hasQualifiedAppraisal: e.target.checked })} />
            <span className="text-sm text-slate-300">Qualified appraisal obtained</span>
          </label>
        </FormField>
      )}
      {form.hasQualifiedAppraisal && (
        <FormField label="Appraiser Name" tooltip="Name of the qualified appraiser who performed the appraisal.">
          <input className="input-field" value={form.appraiserName} onChange={(e) => setForm({ ...form, appraiserName: e.target.value })} placeholder="Qualified appraiser name" />
        </FormField>
      )}
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.doneeOrganization || !form.description} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="charitable_deduction" />

      <SectionIntro
        icon={<HandHeart className="w-8 h-8" />}
        title="Charitable Donations"
        description="Enter cash and non-cash donations to qualified charities."
      />

      <WhatsNewCard items={[
        { title: 'No More $300 Non-Itemizer Deduction', description: 'The above-the-line deduction for charitable donations (up to $300 for non-itemizers) is no longer available. You must itemize to deduct donations.' },
        { title: 'Cash Donation Limit Unchanged', description: 'Cash donations remain deductible up to 60% of AGI to public charities.' },
      ]} />

      <CalloutCard variant="info" title="Charitable deduction limits" irsUrl="https://www.irs.gov/taxtopics/tc506">
        Cash donations to public charities are deductible up to 60% of AGI. Non-cash donations are generally limited to 30% of AGI (or 20% for capital gain property). Amounts exceeding these limits can be carried forward for up to 5 years.
      </CalloutCard>

      {/* Tier 1: Cash and Non-Cash totals */}
      <div className="card">
        <FormField label="Cash Donations" tooltip={help?.fields['Cash Donations']?.tooltip} irsRef={help?.fields['Cash Donations']?.irsRef || 'Schedule A, Line 12'}>
          <CurrencyInput value={items.charitableCash} onChange={(v) => update('charitableCash', v)} />
        </FormField>
        <FormField label="Non-Cash Donations" tooltip={help?.fields['Non-Cash Donations']?.tooltip} irsRef={help?.fields['Non-Cash Donations']?.irsRef || 'Schedule A, Line 12'} optional helpText="Clothing, household items, etc.">
          <CurrencyInput value={items.charitableNonCash} onChange={(v) => update('charitableNonCash', v)} />
        </FormField>
        <a href="https://www.irs.gov/taxtopics/tc506" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      {/* Tier 2: Form 8283 — appears when noncash > $500 */}
      {showForm8283 && (
        <div className="mt-6">
          <div className="rounded-lg border border-telos-blue-500/30 bg-telos-blue-600/5 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-telos-blue-400" />
              <span className="text-sm font-medium text-telos-blue-300">Form 8283 Required</span>
            </div>
            <p className="text-xs text-slate-400">
              Non-cash donations over $500 require per-item detail on Form 8283. Add each donated item below.
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-surface-800 mb-4 overflow-hidden">
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                <div className="text-sm text-slate-400 leading-relaxed">
                  <span className="font-medium text-amber-300">Appraisal requirements:</span>{' '}
                  Items or groups valued over $5,000 require a qualified appraisal by a certified appraiser.
                  <a href="https://www.irs.gov/forms-pubs/about-form-8283" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-1.5 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
                    <ExternalLink className="w-3 h-3" />Learn more
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-telos-orange-400" />
                <div className="text-sm text-slate-400 leading-relaxed">
                  <span className="font-medium text-telos-orange-300">Valuing donations:</span>{' '}
                  Clothing and household items must be in "good used condition or better." Check thrift stores or IRS Publication 561 for guidelines.
                  <a href="https://www.irs.gov/publications/p561" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-1.5 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
                    <ExternalLink className="w-3 h-3" />Pub 561
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Donation Value Lookup button */}
          <button
            type="button"
            onClick={() => setShowValuation(true)}
            className="w-full rounded-lg border border-telos-blue-500/30 bg-telos-blue-500/10 hover:bg-telos-blue-500/15 transition-colors p-4 text-left flex items-center gap-3"
          >
            <div className="rounded-full p-2 bg-telos-blue-500/20 shrink-0">
              <Search className="w-5 h-5 text-telos-blue-400" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-telos-blue-300">Donation Value Lookup</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Look up fair market values from Salvation Army and Goodwill guides, or estimate from original price.
              </p>
            </div>
          </button>

          {/* Per-item donation list */}
          {nonCashDonations.map((item, idx) =>
            editingId === item.id ? (
              <div key={item.id}>{renderDonationForm(saveEdit, 'Save Changes')}</div>
            ) : (
              <div
                key={item.id}
                className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`}
                onClick={() => startEdit(item)}
              >
                <div>
                  <div className="font-medium">{item.doneeOrganization || 'Unknown Organization'}</div>
                  <div className="text-sm text-slate-400">
                    {item.description}
                    {item.fairMarketValue > 0 && <span> &middot; FMV: ${item.fairMarketValue.toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <ItemWarningBadge warnings={itemWarnings.get(idx)} />
                  <button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-2 text-slate-400 hover:text-telos-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="p-2 text-slate-400 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ),
          )}

          {!editingId && (
            adding ? renderDonationForm(addItem, 'Save Donation') : <AddButton onClick={() => setAdding(true)}>Add Noncash Donation</AddButton>
          )}
        </div>
      )}

      {showValuation && (
        <DonationValuationPanel
          onSelect={({ fairMarketValue, method, itemName }) => {
            setForm((prev) => ({
              ...prev,
              fairMarketValue,
              method,
              description: prev.description || itemName || '',
            }));
            setShowValuation(false);
            if (!adding && !editingId) setAdding(true);
          }}
          onClose={() => setShowValuation(false)}
        />
      )}

      {/* Prior-Year Charitable Carryforward */}
      <div className="mt-6">
        <h3 className="text-base font-semibold mb-1">Prior-Year Charitable Carryforward</h3>
        <p className="text-sm text-slate-400 mb-4">
          If you had excess charitable contributions in prior years that exceeded AGI limits, enter the carryforward amounts here. Carryforwards expire after 5 years.
        </p>

        {carryforwards.map((cf, idx) => (
          <div key={idx} className="card mt-2 flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Year {cf.year}</div>
              <div className="text-sm text-slate-400">
                ${(cf.amount ?? 0).toLocaleString()}
                {' · '}
                {cf.category === 'cash' && 'Cash (60% AGI limit)'}
                {cf.category === 'non_cash_30' && 'Non-cash (30% AGI limit)'}
                {cf.category === 'non_cash_50' && 'Non-cash capital gain (20% AGI limit)'}
              </div>
            </div>
            <button onClick={() => removeCarryforward(idx)} className="p-2 text-slate-400 hover:text-red-400" title="Remove">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {addingCF ? (
          <div className="card mt-4">
            <FormField label="Year" tooltip="The tax year in which the excess contribution originated.">
              <input type="number" className="input-field" value={cfForm.year} min={2020} max={new Date().getFullYear() - 1} onChange={(e) => setCfForm({ ...cfForm, year: parseInt(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Amount" tooltip="The remaining carryforward amount from that year.">
              <CurrencyInput value={cfForm.amount} onChange={(v) => setCfForm({ ...cfForm, amount: v })} />
            </FormField>
            <FormField label="Category" tooltip="The type of contribution that generated the carryforward.">
              <select className="input-field" value={cfForm.category} onChange={(e) => setCfForm({ ...cfForm, category: e.target.value as CharitableCarryforward['category'] })}>
                <option value="cash">Cash (60% AGI limit)</option>
                <option value="non_cash_30">Non-cash (30% AGI limit)</option>
                <option value="non_cash_50">Non-cash capital gain (20% AGI limit)</option>
              </select>
            </FormField>
            <div className="flex gap-3 mt-2">
              <button onClick={addCarryforward} disabled={!cfForm.amount || !cfForm.year} className="btn-primary text-sm">Save</button>
              <button onClick={cancelCfForm} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <AddButton onClick={() => setAddingCF(true)}>Add Carryforward</AddButton>
        )}
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
