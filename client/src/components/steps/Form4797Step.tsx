import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, deleteIncomeItem, updateIncomeItem } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { ArrowRightLeft, Pencil, Trash2, ExternalLink } from 'lucide-react';
import AddButton from '../common/AddButton';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import { validateAcquiredDate, validateTaxYearEventDate } from '../../utils/dateValidation';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';

const EMPTY_FORM = {
  description: '',
  dateAcquired: '',
  dateSold: '',
  salesPrice: 0,
  costBasis: 0,
  depreciationAllowed: 0,
  isSection1245: false,
  isSection1250: false,
  straightLineDepreciation: 0,
};

const help = HELP_CONTENT['form4797'];

export default function Form4797Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const items = taxReturn.form4797Properties || [];
  const itemWarnings = useItemWarnings('form4797');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const cancelForm = () => { setForm({ ...EMPTY_FORM }); setAdding(false); setEditingId(null); };

  const startEdit = (item: typeof items[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      description: item.description,
      dateAcquired: item.dateAcquired,
      dateSold: item.dateSold,
      salesPrice: item.salesPrice,
      costBasis: item.costBasis,
      depreciationAllowed: item.depreciationAllowed,
      isSection1245: !!item.isSection1245,
      isSection1250: !!item.isSection1250,
      straightLineDepreciation: item.straightLineDepreciation || 0,
    });
  };

  const addItem = () => {
    const result = addIncomeItem(returnId, 'form4797', form);
    // Read fresh items from store to avoid stale closure reference
    const currentItems = useTaxReturnStore.getState().taxReturn?.form4797Properties || [];
    updateField('form4797Properties', [...currentItems, { id: result.id, ...form }]);
    cancelForm();
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateIncomeItem(returnId, 'form4797', editingId, form);
    const currentItems = useTaxReturnStore.getState().taxReturn?.form4797Properties || [];
    updateField('form4797Properties', currentItems.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    deleteIncomeItem(returnId, 'form4797', id);
    const currentItems = useTaxReturnStore.getState().taxReturn?.form4797Properties || [];
    updateField('form4797Properties', currentItems.filter((i) => i.id !== id));
    if (editingId === id) cancelForm();
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Property Description" tooltip={help?.fields['Property Description']?.tooltip} irsRef={help?.fields['Property Description']?.irsRef}>
        <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Office equipment, rental building, etc." />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Date Acquired" tooltip={help?.fields['Date Acquired']?.tooltip} irsRef={help?.fields['Date Acquired']?.irsRef} warning={validateAcquiredDate(form.dateAcquired, form.dateSold)}>
            <input type="date" className="input-field" value={form.dateAcquired} onChange={(e) => setForm({ ...form, dateAcquired: e.target.value })} />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Date Sold" tooltip={help?.fields['Date Sold']?.tooltip} irsRef={help?.fields['Date Sold']?.irsRef} warning={validateTaxYearEventDate(form.dateSold)}>
            <input type="date" className="input-field" value={form.dateSold} onChange={(e) => setForm({ ...form, dateSold: e.target.value })} />
          </FormField>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Sales Price" tooltip={help?.fields['Sales Price']?.tooltip} irsRef={help?.fields['Sales Price']?.irsRef}>
            <CurrencyInput value={form.salesPrice} onChange={(v) => setForm({ ...form, salesPrice: v })} />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Cost Basis" tooltip={help?.fields['Cost Basis']?.tooltip} irsRef={help?.fields['Cost Basis']?.irsRef}>
            <CurrencyInput value={form.costBasis} onChange={(v) => setForm({ ...form, costBasis: v })} />
          </FormField>
        </div>
      </div>
      <FormField label="Depreciation Allowed" helpText="Total depreciation claimed over the life of the asset" tooltip={help?.fields['Depreciation Allowed']?.tooltip} irsRef={help?.fields['Depreciation Allowed']?.irsRef}>
        <CurrencyInput value={form.depreciationAllowed} onChange={(v) => setForm({ ...form, depreciationAllowed: v })} />
      </FormField>
      <div className="space-y-2 mt-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="accent-telos-orange-400" checked={form.isSection1245} onChange={(e) => setForm({ ...form, isSection1245: e.target.checked, isSection1250: false })} />
          <span className="text-sm text-slate-300">Section 1245 property (equipment, vehicles — full depreciation recapture)</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="accent-telos-orange-400" checked={form.isSection1250} onChange={(e) => setForm({ ...form, isSection1250: e.target.checked, isSection1245: false })} />
          <span className="text-sm text-slate-300">Section 1250 property (buildings, real estate — partial recapture)</span>
        </label>
      </div>
      {form.isSection1250 && (
        <FormField label="Straight-Line Depreciation" optional helpText="For computing excess depreciation recapture" tooltip={help?.fields['Straight-Line Depreciation']?.tooltip} irsRef={help?.fields['Straight-Line Depreciation']?.irsRef}>
          <CurrencyInput value={form.straightLineDepreciation} onChange={(v) => setForm({ ...form, straightLineDepreciation: v })} />
        </FormField>
      )}
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.description} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="form4797" />

      <SectionIntro
        icon={<ArrowRightLeft className="w-8 h-8" />}
        title="Business Property Sales (Form 4797)"
        description="Enter sales or dispositions of business property, including equipment, vehicles, and real estate used in a trade or business."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {items.map((item, idx) =>
        editingId === item.id ? (
          <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
        ) : (
          <div key={item.id} className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`} role="button" tabIndex={0} onClick={() => startEdit(item)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(item); } }}>
            <div>
              <div className="font-medium">{item.description || 'Property'}</div>
              <div className="text-sm text-slate-400">
                Sale: ${(item.salesPrice ?? 0).toLocaleString()} &middot; Basis: ${(item.costBasis ?? 0).toLocaleString()}
                {item.depreciationAllowed > 0 && <span> &middot; Depr: ${item.depreciationAllowed.toLocaleString()}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ItemWarningBadge warnings={itemWarnings.get(idx)} />
              <button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-2 text-slate-400 hover:text-telos-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="p-2 text-slate-400 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        )
      )}

      {!editingId && (
        adding ? renderForm(addItem, 'Save Property') : <AddButton onClick={() => setAdding(true)}>Add Business Property Sale</AddButton>
      )}

      <a
        href="https://www.irs.gov/forms-pubs/about-form-4797"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation />
    </div>
  );
}
