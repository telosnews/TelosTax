import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { Landmark, Trash2, Pencil } from 'lucide-react';
import AddButton from '../common/AddButton';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import InlineImportButton from '../import/InlineImportButton';
import InlinePDFImport from '../import/InlinePDFImport';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import { getAllStates } from '@telostax/engine';

const stateOptions = getAllStates().map((s) => ({ code: s.code, name: s.name }));
const emptyForm = { payerName: '', amount: 0, stateCode: '', stateTaxWithheld: 0 };

export default function INT1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('1099int_income');

  const help = HELP_CONTENT['1099int_income'];
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importing, setImporting] = useState(false);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAdding(true);
  };

  const startEdit = (item: { id: string; payerName: string; amount: number; stateCode?: string; stateTaxWithheld?: number }) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      payerName: item.payerName,
      amount: item.amount,
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
    const result = await addIncomeItem(returnId, '1099int', form);
    updateField('income1099INT', [...taxReturn.income1099INT, { id: result.id, ...form }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, '1099int', editingId, form);
    updateField(
      'income1099INT',
      taxReturn.income1099INT.map((i) =>
        i.id === editingId ? { ...i, ...form } : i,
      ),
    );
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = taxReturn.income1099INT.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099INT',
      item: item as any,
      label: `1099-INT${item.payerName ? ` from ${item.payerName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Payer Name" tooltip={help?.fields['Payer Name']?.tooltip} irsRef={help?.fields['Payer Name']?.irsRef}>
        <input className="input-field" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} placeholder="Bank or institution" />
      </FormField>
      <FormField label="Interest Income (Box 1)" tooltip={help?.fields['Interest Income (Box 1)']?.tooltip} irsRef={help?.fields['Interest Income (Box 1)']?.irsRef}>
        <CurrencyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
      </FormField>
      <FormField label="State (Box 15)" optional tooltip="The state listed on your 1099-INT for state tax withholding.">
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
      <FormField label="State Tax Withheld (Box 17)" optional
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
      <StepWarningsBanner stepId="1099int_income" />
      <SectionIntro icon={<Landmark className="w-8 h-8" />} title="Interest Income (1099-INT)" description="Enter interest income from banks, CDs, and other sources." />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Inline PDF import */}
      {importing ? (
        <InlinePDFImport
          expectedFormType="1099-INT"
          onClose={() => setImporting(false)}
        />
      ) : (
        <InlineImportButton importType="pdf" formLabel="1099-INT" onClick={() => setImporting(true)} />
      )}

      {taxReturn.income1099INT.length > 0 && (
        <div className="space-y-3 mt-6">
          {taxReturn.income1099INT.map((item, idx) =>
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
                  <div className="text-sm text-slate-400">${(item.amount ?? 0).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-1">
                  <ItemWarningBadge warnings={itemWarnings.get(idx)} />
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                    className="p-2 text-slate-400 hover:text-telos-blue-400"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                    className="p-2 text-slate-400 hover:text-red-400"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {adding ? (
        renderForm(addItem, 'Save 1099-INT')
      ) : (
        !editingId && (
          <AddButton onClick={startAdd}>Add 1099-INT</AddButton>
        )
      )}

      <StepNavigation />
    </div>
  );
}
