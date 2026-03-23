import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { HandHeart, Pencil, Trash2, Search, ExternalLink, AlertTriangle, Lightbulb, Info } from 'lucide-react';
import AddButton from '../common/AddButton';
import type { NonCashDonation } from '@telostax/engine';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import { HELP_CONTENT } from '../../data/helpContent';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import DonationValuationPanel from './DonationValuationPanel';
import { validateContributionDate, validateAcquiredDate } from '../../utils/dateValidation';

const EMPTY_DONATION = {
  doneeOrganization: '',
  description: '',
  dateOfContribution: '',
  dateAcquired: '',
  howAcquired: '' as NonCashDonation['howAcquired'],
  fairMarketValue: 0,
  costBasis: 0,
  method: '',
};

export default function Form8283Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('form_8283');
  const help = HELP_CONTENT['form_8283'];

  // NonCashDonation[] lives inside itemizedDeductions
  const itemized = taxReturn.itemizedDeductions;
  const items: NonCashDonation[] = itemized?.nonCashDonations || [];

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_DONATION });
  const [showValuation, setShowValuation] = useState(false);

  // Helper: persist the donations array into itemizedDeductions
  const persistDonations = (donations: NonCashDonation[]) => {
    updateField('itemizedDeductions', {
      ...(itemized || {
        medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
        personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
        charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
      }),
      nonCashDonations: donations,
    });
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
    });
  };

  const addItem = () => {
    const newItem: NonCashDonation = { id: crypto.randomUUID(), ...form };
    persistDonations([...items, newItem]);
    cancelForm();
  };

  const saveEdit = () => {
    if (!editingId) return;
    persistDonations(items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
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

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Donee Organization" tooltip="Name of the qualified charitable organization that received the donation." irsRef={help?.fields['Donee Organization']?.irsRef}>
        <input
          className="input-field"
          value={form.doneeOrganization}
          onChange={(e) => setForm({ ...form, doneeOrganization: e.target.value })}
          placeholder="Charity name"
        />
      </FormField>
      <FormField label="Description of Donated Property" tooltip="Describe what you donated (e.g., 'Clothing and household goods', 'Used furniture', 'Artwork')." irsRef={help?.fields['Description of Donated Property']?.irsRef}>
        <input
          className="input-field"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="e.g., Clothing and household goods"
        />
      </FormField>
      <FormField label="Date Contributed" tooltip="The date you gave the property to the charity." irsRef={help?.fields['Date Contributed']?.irsRef} warning={validateContributionDate(form.dateOfContribution, form.dateAcquired)}>
        <input
          type="date"
          className="input-field"
          value={form.dateOfContribution}
          onChange={(e) => setForm({ ...form, dateOfContribution: e.target.value })}
        />
      </FormField>
      <FormField label="Fair Market Value" tooltip="The fair market value of the property on the date you contributed it. For clothing/household items, this is typically much less than what you paid." irsRef={help?.fields['Fair Market Value']?.irsRef}>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <CurrencyInput
              value={form.fairMarketValue}
              onChange={(v) => setForm({ ...form, fairMarketValue: v })}
            />
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
      <FormField label="Date Acquired" optional tooltip="The date you originally acquired or purchased the property. Leave blank if unknown." irsRef={help?.fields['Date Acquired']?.irsRef} warning={validateAcquiredDate(form.dateAcquired, form.dateOfContribution)}>
        <input
          type="date"
          className="input-field"
          value={form.dateAcquired}
          onChange={(e) => setForm({ ...form, dateAcquired: e.target.value })}
        />
      </FormField>
      <FormField label="How Acquired" optional tooltip="How you got the property (e.g., 'Purchase', 'Gift', 'Inheritance')." irsRef={help?.fields['How Acquired']?.irsRef}>
        <select
          className="input-field"
          value={form.howAcquired || ''}
          onChange={(e) => setForm({ ...form, howAcquired: (e.target.value || undefined) as NonCashDonation['howAcquired'] })}
        >
          <option value="">Select...</option>
          <option value="purchase">Purchase</option>
          <option value="gift">Gift</option>
          <option value="inheritance">Inheritance</option>
          <option value="exchange">Exchange</option>
          <option value="other">Other</option>
        </select>
      </FormField>
      <FormField label="Cost or Other Basis" optional tooltip="What you originally paid for the property. Required for donations over $5,000." irsRef={help?.fields['Cost or Other Basis']?.irsRef}>
        <CurrencyInput
          value={form.costBasis}
          onChange={(v) => setForm({ ...form, costBasis: v })}
        />
      </FormField>
      <FormField label="Method of Valuation" optional tooltip="How you determined the fair market value (e.g., 'Thrift shop value', 'Appraisal', 'Comparable sales')." irsRef={help?.fields['Method of Valuation']?.irsRef}>
        <input
          className="input-field"
          value={form.method}
          onChange={(e) => setForm({ ...form, method: e.target.value })}
          placeholder="e.g., Thrift shop value"
        />
      </FormField>
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.doneeOrganization || !form.description} className="btn-primary text-sm">
          {saveLabel}
        </button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="form_8283" />

      <SectionIntro
        icon={<HandHeart className="w-8 h-8" />}
        title="Noncash Charitable Contributions (Form 8283)"
        description="Report donations of property (clothing, household goods, vehicles, stocks, etc.) worth more than $500 in total."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="rounded-lg border border-slate-700 bg-surface-800 mt-4 mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/60 flex items-center gap-2">
          <Info className="w-4 h-4 text-telos-blue-400" />
          <span className="text-sm font-medium text-slate-200">When do you need Form 8283?</span>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-slate-400 leading-relaxed">
            You need Form 8283 when your total noncash charitable donations exceed $500 for the year.
          </p>
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
            <div className="text-sm text-slate-400 leading-relaxed">
              <span className="font-medium text-amber-300">Appraisal requirements:</span>{' '}
              Items or groups valued over $5,000 require a qualified appraisal by a certified appraiser. Vehicles, boats, and airplanes over $500 need a Form 1098-C from the charity.
              <a href="https://www.irs.gov/forms-pubs/about-form-8283" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-1.5 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
                <ExternalLink className="w-3 h-3" />Learn more on IRS.gov
              </a>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-telos-orange-400" />
            <div className="text-sm text-slate-400 leading-relaxed">
              <span className="font-medium text-telos-orange-300">Valuing donations:</span>{' '}
              Clothing and household items must be in "good used condition or better" to be deductible. Keep photos and written descriptions for higher-value items. Check thrift stores, consignment shops, or IRS Publication 561 for guidelines.
              <a href="https://www.irs.gov/publications/p561" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-1.5 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
                <ExternalLink className="w-3 h-3" />Learn more on IRS.gov
              </a>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowValuation(true)}
        className="w-full mt-4 rounded-lg border border-telos-blue-500/30 bg-telos-blue-500/10 hover:bg-telos-blue-500/15 transition-colors p-4 text-left flex items-center gap-3"
      >
        <div className="rounded-full p-2 bg-telos-blue-500/20 shrink-0">
          <Search className="w-5 h-5 text-telos-blue-400" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-telos-blue-300">Donation Value Lookup</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Look up fair market values from Salvation Army and Goodwill guides, or estimate from original price using depreciation rates.
          </p>
        </div>
      </button>

      {items.map((item, idx) =>
        editingId === item.id ? (
          <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
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
                {item.fairMarketValue > 0 && (
                  <span> &middot; FMV: ${item.fairMarketValue.toLocaleString()}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ItemWarningBadge warnings={itemWarnings.get(idx)} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(item);
                }}
                className="p-2 text-slate-400 hover:text-telos-blue-400"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(item.id);
                }}
                className="p-2 text-slate-400 hover:text-red-400"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      )}

      {!editingId && (
        adding ? (
          renderForm(addItem, 'Save Donation')
        ) : (
          <AddButton onClick={() => setAdding(true)}>Add Noncash Donation</AddButton>
        )
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
          }}
          onClose={() => setShowValuation(false)}
        />
      )}

      <StepNavigation />
    </div>
  );
}
