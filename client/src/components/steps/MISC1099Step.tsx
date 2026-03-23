import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { FileSpreadsheet, Pencil, Trash2 } from 'lucide-react';
import AddButton from '../common/AddButton';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import InlineImportButton from '../import/InlineImportButton';
import InlinePDFImport from '../import/InlinePDFImport';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import { getAllStates } from '@telostax/engine';

const stateOptions = getAllStates().map((s) => ({ code: s.code, name: s.name }));

export default function MISC1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('1099misc_income');

  const help = HELP_CONTENT['1099misc_income'];
  const items = taxReturn.income1099MISC || [];

  const emptyForm = {
    payerName: '',
    rents: 0,
    royalties: 0,
    otherIncome: 0,
    federalTaxWithheld: 0,
    stateTaxWithheld: 0,
    stateCode: '',
  };

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
      rents: item.rents || 0,
      royalties: item.royalties || 0,
      otherIncome: item.otherIncome,
      federalTaxWithheld: item.federalTaxWithheld || 0,
      stateTaxWithheld: item.stateTaxWithheld || 0,
      stateCode: item.stateCode || '',
    });
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, '1099misc', form);
    updateField('income1099MISC', [...items, { id: result.id, ...form }]);
    setForm(emptyForm);
    setAdding(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, '1099misc', editingId, form);
    updateField('income1099MISC', items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    setEditingId(null);
    setForm(emptyForm);
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099MISC',
      item: item as any,
      label: `1099-MISC${item.payerName ? ` from ${item.payerName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  // Build summary text for item card
  const summarizeItem = (item: typeof items[number]) => {
    const parts: string[] = [];
    if (item.rents) parts.push(`$${item.rents.toLocaleString()} rents`);
    if (item.royalties) parts.push(`$${item.royalties.toLocaleString()} royalties`);
    if (item.otherIncome) parts.push(`$${item.otherIncome.toLocaleString()} other`);
    return parts.length > 0 ? parts.join(', ') : '$0 income';
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Payer Name" tooltip={help?.fields['Payer Name']?.tooltip} irsRef={help?.fields['Payer Name']?.irsRef}>
        <input className="input-field" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} placeholder="Company name" />
      </FormField>
      <FormField label="Rents (Box 1)" tooltip={help?.fields['Rents (Box 1)']?.tooltip} irsRef={help?.fields['Rents (Box 1)']?.irsRef} optional>
        <CurrencyInput value={form.rents} onChange={(v) => setForm({ ...form, rents: v })} />
      </FormField>
      <FormField label="Royalties (Box 2)" tooltip={help?.fields['Royalties (Box 2)']?.tooltip} irsRef={help?.fields['Royalties (Box 2)']?.irsRef} optional>
        <CurrencyInput value={form.royalties} onChange={(v) => setForm({ ...form, royalties: v })} />
      </FormField>
      <FormField label="Other Income (Box 3)" tooltip={help?.fields['Other Income (Box 3)']?.tooltip} irsRef={help?.fields['Other Income (Box 3)']?.irsRef} optional>
        <CurrencyInput value={form.otherIncome} onChange={(v) => setForm({ ...form, otherIncome: v })} />
      </FormField>
      <FormField label="Federal Tax Withheld (Box 4)" tooltip={help?.fields['Federal Tax Withheld (Box 4)']?.tooltip} irsRef={help?.fields['Federal Tax Withheld (Box 4)']?.irsRef} optional>
        <CurrencyInput value={form.federalTaxWithheld} onChange={(v) => setForm({ ...form, federalTaxWithheld: v })} />
      </FormField>
      <FormField label="State (Box 15)" optional tooltip="The state listed on your 1099-MISC for state tax withholding.">
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
      <FormField label="State Tax Withheld (Box 16)" tooltip={help?.fields['State Tax Withheld (Box 16)']?.tooltip} irsRef={help?.fields['State Tax Withheld (Box 16)']?.irsRef} optional
        warning={(form.stateTaxWithheld || 0) > 0 && !form.stateCode ? 'State withholding entered without selecting a state — select the state from Box 15.' : undefined}>
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
      <StepWarningsBanner stepId="1099misc_income" />
      <SectionIntro
        icon={<FileSpreadsheet className="w-8 h-8" />}
        title="1099-MISC Miscellaneous Income"
        description="Enter each 1099-MISC you received for prizes, awards, rents, royalties, or other income."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Inline PDF import */}
      {importing ? (
        <InlinePDFImport
          expectedFormType="1099-MISC"
          onClose={() => setImporting(false)}
        />
      ) : (
        <InlineImportButton importType="pdf" formLabel="1099-MISC" onClick={() => setImporting(true)} />
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
              <div className="text-sm text-slate-400">{summarizeItem(item)}</div>
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
        renderForm(addItem, 'Save 1099-MISC')
      ) : (
        !editingId && <AddButton onClick={startAdd}>Add 1099-MISC</AddButton>
      )}

      <StepNavigation />
    </div>
  );
}
