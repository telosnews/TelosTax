import { useState, useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import AddButton from '../common/AddButton';
import CalloutCard from '../common/CalloutCard';
import { CalendarClock, Trash2, Pencil } from 'lucide-react';
import { calculateForm6252 } from '@telostax/engine';
import { validateTaxYearEventDate } from '../../utils/dateValidation';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';

const emptyForm = {
  description: '', dateOfSale: '', sellingPrice: 0,
  costOrBasis: 0, depreciationAllowed: 0, sellingExpenses: 0,
  paymentsReceivedThisYear: 0,
};

export default function InstallmentSaleStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const items = taxReturn.installmentSales || [];
  const itemWarnings = useItemWarnings('installment_sale');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const startAdd = () => { setEditingId(null); setForm(emptyForm); setAdding(true); };
  const startEdit = (item: typeof items[0]) => {
    setAdding(false); setEditingId(item.id);
    setForm({
      description: item.description, dateOfSale: item.dateOfSale,
      sellingPrice: item.sellingPrice, costOrBasis: item.costOrBasis,
      depreciationAllowed: item.depreciationAllowed || 0,
      sellingExpenses: item.sellingExpenses || 0,
      paymentsReceivedThisYear: item.paymentsReceivedThisYear,
    });
  };
  const cancelForm = () => { setAdding(false); setEditingId(null); setForm(emptyForm); };

  const addItem = () => {
    const id = crypto.randomUUID();
    updateField('installmentSales', [...items, { id, ...form }]);
    cancelForm();
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateField('installmentSales', items.map((i) => i.id === editingId ? { ...i, ...form } : i));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'installmentSales',
      item: item as any,
      label: `Installment sale${item.description ? `: ${item.description}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const save = async () => {
    await updateReturn(returnId, { installmentSales: taxReturn.installmentSales });
  };

  // Preview computation for current form
  const preview = useMemo(() => {
    if (form.sellingPrice <= 0 || form.paymentsReceivedThisYear <= 0) return null;
    return calculateForm6252({ id: 'preview', ...form });
  }, [form]);

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Property Description">
        <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g., Vacant land on 123 Main St" />
      </FormField>
      <FormField label="Date of Sale" irsRef="Form 6252, Line 1" warning={validateTaxYearEventDate(form.dateOfSale)}>
        <input type="date" className="input-field" value={form.dateOfSale} onChange={(e) => setForm({ ...form, dateOfSale: e.target.value })} />
      </FormField>
      <FormField label="Selling Price" irsRef="Form 6252, Line 5">
        <CurrencyInput value={form.sellingPrice} onChange={(v) => setForm({ ...form, sellingPrice: v })} />
      </FormField>
      <FormField label="Cost or Adjusted Basis" irsRef="Form 6252, Line 6">
        <CurrencyInput value={form.costOrBasis} onChange={(v) => setForm({ ...form, costOrBasis: v })} />
      </FormField>
      <FormField label="Depreciation Allowed" optional irsRef="Form 6252, Line 7">
        <CurrencyInput value={form.depreciationAllowed} onChange={(v) => setForm({ ...form, depreciationAllowed: v })} />
      </FormField>
      <FormField label="Selling Expenses" optional tooltip="Commissions, legal fees, and other selling expenses.">
        <CurrencyInput value={form.sellingExpenses} onChange={(v) => setForm({ ...form, sellingExpenses: v })} />
      </FormField>
      <FormField label="Payments Received This Year" tooltip="Total payments (principal + interest) received during the current tax year." irsRef="Form 6252, Line 21">
        <CurrencyInput value={form.paymentsReceivedThisYear} onChange={(v) => setForm({ ...form, paymentsReceivedThisYear: v })} />
      </FormField>

      {preview && (
        <div className="mt-3 p-3 rounded-lg bg-telos-blue-600/10 border border-telos-blue-500/30 text-xs text-slate-300 space-y-1">
          <p>Gross Profit Ratio: {(preview.grossProfitRatio * 100).toFixed(1)}%</p>
          <p>Reportable Income This Year: <span className="font-medium text-telos-blue-300">${preview.installmentSaleIncome.toLocaleString()}</span></p>
        </div>
      )}

      <div className="flex gap-3 mt-3">
        <button onClick={onSave} disabled={!form.description || !form.sellingPrice} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="installment_sale" />
      <SectionIntro icon={<CalendarClock className="w-8 h-8" />} title="Installment Sales (Form 6252)" description="Report income from property sales where you receive payments over multiple years." />

      <CalloutCard variant="info" title="How installment sales work" irsUrl="https://www.irs.gov/forms-pubs/about-form-6252">
        When you sell property and receive payments over time, you report gain proportionally as payments are received. Each year's taxable amount = payments received × gross profit ratio. Depreciation recapture is recognized in full in the year of sale.
      </CalloutCard>

      {items.length > 0 && (
        <div className="space-y-3 mt-6">
          {items.map((item, idx) => {
            const result = calculateForm6252(item);
            return editingId === item.id ? (
              <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
            ) : (
              <div key={item.id} className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`} onClick={() => startEdit(item)}>
                <div>
                  <div className="font-medium">{item.description}</div>
                  <div className="text-sm text-slate-400">${(result.installmentSaleIncome ?? 0).toLocaleString()} income ({((result.grossProfitRatio ?? 0) * 100).toFixed(0)}% GP ratio)</div>
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

      {adding ? renderForm(addItem, 'Add Installment Sale') : !editingId && <AddButton onClick={startAdd}>Add Installment Sale</AddButton>}

      <StepNavigation onContinue={save} />
    </div>
  );
}
