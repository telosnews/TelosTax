import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import AddButton from '../common/AddButton';
import CalloutCard from '../common/CalloutCard';
import { Wheat, Trash2, Pencil } from 'lucide-react';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';

const emptyForm = {
  description: '', rentalIncome: 0,
  insurance: 0, repairs: 0, taxes: 0, utilities: 0, depreciation: 0, other: 0,
};

export default function FarmRentalStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const items = taxReturn.farmRentals || [];
  const itemWarnings = useItemWarnings('farm_rental');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const startAdd = () => { setEditingId(null); setForm(emptyForm); setAdding(true); };
  const startEdit = (item: typeof items[0]) => {
    setAdding(false); setEditingId(item.id);
    setForm({
      description: item.description || '', rentalIncome: item.rentalIncome,
      insurance: item.expenses?.insurance || 0, repairs: item.expenses?.repairs || 0,
      taxes: item.expenses?.taxes || 0, utilities: item.expenses?.utilities || 0,
      depreciation: item.expenses?.depreciation || 0, other: item.expenses?.other || 0,
    });
  };
  const cancelForm = () => { setAdding(false); setEditingId(null); setForm(emptyForm); };

  const formToData = () => ({
    description: form.description, rentalIncome: form.rentalIncome,
    expenses: { insurance: form.insurance, repairs: form.repairs, taxes: form.taxes, utilities: form.utilities, depreciation: form.depreciation, other: form.other },
  });

  const addItem = () => {
    const id = crypto.randomUUID();
    updateField('farmRentals', [...items, { id, ...formToData() }]);
    cancelForm();
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateField('farmRentals', items.map((i) => i.id === editingId ? { ...i, ...formToData() } : i));
    cancelForm();
  };

  const removeItem = (id: string) => {
    updateField('farmRentals', items.filter((i) => i.id !== id));
    if (editingId === id) cancelForm();
  };

  const save = async () => {
    await updateReturn(returnId, { farmRentals: taxReturn.farmRentals });
  };

  const totalExpenses = form.insurance + form.repairs + form.taxes + form.utilities + form.depreciation + form.other;
  const netPreview = form.rentalIncome - totalExpenses;

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Farm Description" tooltip="Location, type of crop/use, or other identifying details.">
        <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g., 40 acres corn/soybean, Polk County, IA" />
      </FormField>
      <FormField label="Gross Rental Income" irsRef="Form 4835, Line 1">
        <CurrencyInput value={form.rentalIncome} onChange={(v) => setForm({ ...form, rentalIncome: v })} />
      </FormField>
      <h4 className="text-sm font-medium text-slate-300 mt-4 mb-2">Expenses</h4>
      <FormField label="Insurance" optional><CurrencyInput value={form.insurance} onChange={(v) => setForm({ ...form, insurance: v })} /></FormField>
      <FormField label="Repairs & Maintenance" optional><CurrencyInput value={form.repairs} onChange={(v) => setForm({ ...form, repairs: v })} /></FormField>
      <FormField label="Taxes" optional><CurrencyInput value={form.taxes} onChange={(v) => setForm({ ...form, taxes: v })} /></FormField>
      <FormField label="Utilities" optional><CurrencyInput value={form.utilities} onChange={(v) => setForm({ ...form, utilities: v })} /></FormField>
      <FormField label="Depreciation" optional><CurrencyInput value={form.depreciation} onChange={(v) => setForm({ ...form, depreciation: v })} /></FormField>
      <FormField label="Other Expenses" optional><CurrencyInput value={form.other} onChange={(v) => setForm({ ...form, other: v })} /></FormField>

      {form.rentalIncome > 0 && (
        <div className={`mt-3 p-3 rounded-lg text-xs ${netPreview >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'}`}>
          Net: ${netPreview.toLocaleString()} ({netPreview >= 0 ? 'income' : 'loss'})
        </div>
      )}

      <div className="flex gap-3 mt-3">
        <button onClick={onSave} disabled={!form.rentalIncome} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="farm_rental" />
      <SectionIntro icon={<Wheat className="w-8 h-8" />} title="Farm Rental Income (Form 4835)" description="Report income from farmland you own but do not actively farm — the land is rented to a tenant farmer." />

      <CalloutCard variant="info" title="Farm Rental vs Schedule F" irsUrl="https://www.irs.gov/forms-pubs/about-form-4835">
        Use Form 4835 when you rent out farmland and do <strong>not</strong> materially participate in farming. This income is passive. If you actively farm the land, use Schedule F instead.
      </CalloutCard>

      {items.length > 0 && (
        <div className="space-y-3 mt-6">
          {items.map((item, idx) => {
            const exp = item.expenses || {};
            const totalExp = (exp.insurance || 0) + (exp.repairs || 0) + (exp.taxes || 0) + (exp.utilities || 0) + (exp.depreciation || 0) + (exp.other || 0);
            const net = (item.rentalIncome ?? 0) - totalExp;
            return editingId === item.id ? (
              <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
            ) : (
              <div key={item.id} className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`} onClick={() => startEdit(item)}>
                <div>
                  <div className="font-medium">{item.description || 'Farm rental'}</div>
                  <div className="text-sm text-slate-400">Net: ${net.toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-1">
                  <ItemWarningBadge warnings={itemWarnings.get(idx)} />
                  <button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-2 text-slate-400 hover:text-telos-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="p-2 text-slate-400 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding ? renderForm(addItem, 'Add Farm Rental') : !editingId && <AddButton onClick={startAdd}>Add Farm Rental Property</AddButton>}

      <StepNavigation onContinue={save} />
    </div>
  );
}
