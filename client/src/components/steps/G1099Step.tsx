import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { Landmark, Pencil, Trash2 } from 'lucide-react';
import AddButton from '../common/AddButton';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import InlineImportButton from '../import/InlineImportButton';
import InlinePDFImport from '../import/InlinePDFImport';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import { getAllStates } from '@telostax/engine';

const stateOptions = getAllStates().map((s) => ({ code: s.code, name: s.name }));

export default function G1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('1099g_income');

  const help = HELP_CONTENT['1099g_income'];
  const items = taxReturn.income1099G || [];

  const emptyForm = { payerName: '', unemploymentCompensation: 0, federalTaxWithheld: 0, stateCode: '', stateTaxWithheld: 0 };

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importing, setImporting] = useState(false);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAdding(true);
  };

  const startEdit = (item: typeof items[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      payerName: item.payerName,
      unemploymentCompensation: item.unemploymentCompensation,
      federalTaxWithheld: item.federalTaxWithheld || 0,
      stateCode: item.stateCode || '',
      stateTaxWithheld: item.stateTaxWithheld || 0,
    });
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, '1099g', form);
    updateField('income1099G', [...items, { id: result.id, ...form }]);
    setForm(emptyForm);
    setAdding(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, '1099g', editingId, form);
    updateField('income1099G', items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    setEditingId(null);
    setForm(emptyForm);
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099G',
      item: item as any,
      label: `1099-G${item.payerName ? ` from ${item.payerName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Payer Name" tooltip={help?.fields['Payer Name']?.tooltip} irsRef={help?.fields['Payer Name']?.irsRef}>
        <input className="input-field" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} placeholder="State agency" />
      </FormField>
      <FormField label="Unemployment Compensation (Box 1)" tooltip={help?.fields['Unemployment Compensation (Box 1)']?.tooltip} irsRef={help?.fields['Unemployment Compensation (Box 1)']?.irsRef}>
        <CurrencyInput value={form.unemploymentCompensation} onChange={(v) => setForm({ ...form, unemploymentCompensation: v })} />
      </FormField>
      <FormField label="Federal Tax Withheld (Box 4)" tooltip={help?.fields['Federal Tax Withheld (Box 4)']?.tooltip} irsRef={help?.fields['Federal Tax Withheld (Box 4)']?.irsRef} optional>
        <CurrencyInput value={form.federalTaxWithheld} onChange={(v) => setForm({ ...form, federalTaxWithheld: v })} />
      </FormField>
      <FormField label="State (Box 10)" optional tooltip="The state listed on your 1099-G for state tax withholding.">
        <select
          className="input-field w-48"
          value={form.stateCode}
          onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
        >
          <option value="">Select state</option>
          {stateOptions.map((s) => (
            <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
          ))}
        </select>
      </FormField>
      <FormField label="State Tax Withheld (Box 11)" optional
        warning={(form.stateTaxWithheld || 0) > 0 && !form.stateCode ? 'State withholding entered without selecting a state — select the state from Box 10.' : undefined}>
        <CurrencyInput value={form.stateTaxWithheld} onChange={(v) => setForm({ ...form, stateTaxWithheld: v })} />
      </FormField>
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.payerName} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="1099g_income" />
      <SectionIntro
        icon={<Landmark className="w-8 h-8" />}
        title="1099-G Government Payments"
        description="Enter each 1099-G you received for unemployment compensation."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Inline PDF import */}
      {importing ? (
        <InlinePDFImport
          expectedFormType="1099-G"
          onClose={() => setImporting(false)}
        />
      ) : (
        <InlineImportButton importType="pdf" formLabel="1099-G" onClick={() => setImporting(true)} />
      )}

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
              <div className="font-medium">{item.payerName}</div>
              <div className="text-sm text-slate-400">${(item.unemploymentCompensation ?? 0).toLocaleString()} in unemployment</div>
            </div>
            <div className="flex items-center gap-1">
              <ItemWarningBadge warnings={itemWarnings.get(idx)} /><button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-2 text-slate-400 hover:text-telos-blue-400" title="Edit">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="p-2 text-slate-400 hover:text-red-400" title="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      )}

      {adding ? (
        renderForm(addItem, 'Save 1099-G')
      ) : (
        !editingId && <AddButton onClick={startAdd}>Add 1099-G</AddButton>
      )}

      <StepNavigation />
    </div>
  );
}
