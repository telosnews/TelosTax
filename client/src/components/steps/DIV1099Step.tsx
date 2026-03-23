import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { TrendingUp, Trash2, Pencil } from 'lucide-react';
import AddButton from '../common/AddButton';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import InlineImportButton from '../import/InlineImportButton';
import InlinePDFImport from '../import/InlinePDFImport';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import { getAllStates } from '@telostax/engine';

const stateOptions = getAllStates().map((s) => ({ code: s.code, name: s.name }));
const emptyForm = { payerName: '', ordinaryDividends: 0, qualifiedDividends: 0, foreignTaxPaid: 0, foreignSourceIncome: 0, stateCode: '', stateTaxWithheld: 0 };

export default function DIV1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('1099div_income');

  const help = HELP_CONTENT['1099div_income'];
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importing, setImporting] = useState(false);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAdding(true);
  };

  const startEdit = (item: { id: string; payerName: string; ordinaryDividends: number; qualifiedDividends: number; foreignTaxPaid?: number; foreignSourceIncome?: number; stateCode?: string; stateTaxWithheld?: number }) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      payerName: item.payerName,
      ordinaryDividends: item.ordinaryDividends,
      qualifiedDividends: item.qualifiedDividends,
      foreignTaxPaid: item.foreignTaxPaid || 0,
      foreignSourceIncome: item.foreignSourceIncome || 0,
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
    const result = await addIncomeItem(returnId, '1099div', form);
    updateField('income1099DIV', [...taxReturn.income1099DIV, { id: result.id, ...form }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, '1099div', editingId, form);
    updateField(
      'income1099DIV',
      taxReturn.income1099DIV.map((i) =>
        i.id === editingId ? { ...i, ...form } : i,
      ),
    );
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = taxReturn.income1099DIV.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099DIV',
      item: item as any,
      label: `1099-DIV${item.payerName ? ` from ${item.payerName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Payer Name" tooltip={help?.fields['Payer Name']?.tooltip} irsRef={help?.fields['Payer Name']?.irsRef}>
        <input className="input-field" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} placeholder="Brokerage or fund" />
      </FormField>
      <FormField label="Ordinary Dividends (Box 1a)" tooltip={help?.fields['Ordinary Dividends (Box 1a)']?.tooltip} irsRef={help?.fields['Ordinary Dividends (Box 1a)']?.irsRef}>
        <CurrencyInput value={form.ordinaryDividends} onChange={(v) => setForm({ ...form, ordinaryDividends: v })} />
      </FormField>
      <FormField label="Qualified Dividends (Box 1b)" tooltip={help?.fields['Qualified Dividends (Box 1b)']?.tooltip} irsRef={help?.fields['Qualified Dividends (Box 1b)']?.irsRef}>
        <CurrencyInput value={form.qualifiedDividends} onChange={(v) => setForm({ ...form, qualifiedDividends: v })} />
      </FormField>
      <FormField label="Foreign Tax Paid (Box 7)" optional tooltip="Foreign tax paid or accrued on dividends from foreign-sourced investments. Claimed as a credit on Form 1116.">
        <CurrencyInput value={form.foreignTaxPaid} onChange={(v) => setForm({ ...form, foreignTaxPaid: v })} />
      </FormField>
      {(form.foreignTaxPaid || 0) > 0 && (
        <FormField label="Foreign Source Income" optional tooltip="The portion of dividends from foreign sources, reported on your fund's supplemental statement. If blank, defaults to total ordinary dividends.">
          <CurrencyInput value={form.foreignSourceIncome} onChange={(v) => setForm({ ...form, foreignSourceIncome: v })} />
        </FormField>
      )}
      <FormField label="State (Box 14)" optional tooltip="The state listed on your 1099-DIV for state tax withholding.">
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
      <FormField label="State Tax Withheld (Box 16)" optional
        warning={(form.stateTaxWithheld || 0) > 0 && !form.stateCode ? 'State withholding entered without selecting a state — select the state from Box 14.' : undefined}>
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
      <StepWarningsBanner stepId="1099div_income" />
      <SectionIntro icon={<TrendingUp className="w-8 h-8" />} title="Dividend Income (1099-DIV)" description="Enter dividend income from stocks, mutual funds, etc." />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Inline PDF import */}
      {importing ? (
        <InlinePDFImport
          expectedFormType="1099-DIV"
          onClose={() => setImporting(false)}
        />
      ) : (
        <InlineImportButton importType="pdf" formLabel="1099-DIV" onClick={() => setImporting(true)} />
      )}

      {taxReturn.income1099DIV.length > 0 && (
        <div className="space-y-3 mt-6">
          {taxReturn.income1099DIV.map((item, idx) =>
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
                  <div className="text-sm text-slate-400">Ordinary: ${(item.ordinaryDividends ?? 0).toLocaleString()} &middot; Qualified: ${(item.qualifiedDividends ?? 0).toLocaleString()}</div>
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
        renderForm(addItem, 'Save 1099-DIV')
      ) : (
        !editingId && (
          <AddButton onClick={startAdd}>Add 1099-DIV</AddButton>
        )
      )}

      <StepNavigation />
    </div>
  );
}
