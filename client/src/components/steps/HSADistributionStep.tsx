import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { HeartPulse, Pencil, Trash2 } from 'lucide-react';
import AddButton from '../common/AddButton';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';

const EMPTY_1099SA = {
  payerName: '',
  grossDistribution: 0,
  distributionCode: '1',
  qualifiedMedicalExpenses: true,
  federalTaxWithheld: 0,
};

export default function HSADistributionStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('1099sa_income');

  const help = HELP_CONTENT['1099sa_income'];

  const items = taxReturn.income1099SA || [];

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_1099SA });

  const cancelForm = () => {
    setForm({ ...EMPTY_1099SA });
    setAdding(false);
    setEditingId(null);
  };

  const startEdit = (item: typeof items[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      payerName: item.payerName,
      grossDistribution: item.grossDistribution,
      distributionCode: item.distributionCode || '1',
      qualifiedMedicalExpenses: item.qualifiedMedicalExpenses ?? true,
      federalTaxWithheld: item.federalTaxWithheld || 0,
    });
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, '1099sa', form);
    updateField('income1099SA', [...items, { id: result.id, ...form }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, '1099sa', editingId, form);
    updateField('income1099SA', items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099SA',
      item: item as any,
      label: `1099-SA${item.payerName ? ` from ${item.payerName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const codeLabels: Record<string, string> = {
    '1': 'Normal distribution',
    '2': 'Excess contributions',
    '3': 'Disability',
    '4': 'Death (non-spouse)',
    '5': 'Prohibited transaction',
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="HSA Trustee/Payer Name" tooltip={help?.fields['HSA Trustee/Payer Name']?.tooltip} irsRef={help?.fields['HSA Trustee/Payer Name']?.irsRef}>
        <input className="input-field" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} placeholder="HSA provider name" />
      </FormField>
      <FormField label="Gross Distribution (Box 1)" tooltip={help?.fields['Gross Distribution (Box 1)']?.tooltip} irsRef={help?.fields['Gross Distribution (Box 1)']?.irsRef}>
        <CurrencyInput value={form.grossDistribution} onChange={(v) => setForm({ ...form, grossDistribution: v })} />
      </FormField>
      <FormField label="Distribution Code (Box 3)" tooltip={help?.fields['Distribution Code (Box 3)']?.tooltip} irsRef={help?.fields['Distribution Code (Box 3)']?.irsRef}>
        <select className="input-field" value={form.distributionCode} onChange={(e) => setForm({ ...form, distributionCode: e.target.value })}>
          <option value="1">1 — Normal distribution</option>
          <option value="2">2 — Excess contributions</option>
          <option value="3">3 — Disability</option>
          <option value="4">4 — Death (non-spouse beneficiary)</option>
          <option value="5">5 — Prohibited transaction</option>
        </select>
      </FormField>
      <FormField label="Used for Qualified Medical Expenses?">
        <select className="input-field" value={form.qualifiedMedicalExpenses ? 'yes' : 'no'} onChange={(e) => setForm({ ...form, qualifiedMedicalExpenses: e.target.value === 'yes' })}>
          <option value="yes">Yes — Not taxable</option>
          <option value="no">No — Taxable distribution</option>
        </select>
      </FormField>
      <FormField label="Federal Tax Withheld (Box 4)" optional>
        <CurrencyInput value={form.federalTaxWithheld} onChange={(v) => setForm({ ...form, federalTaxWithheld: v })} />
      </FormField>
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.payerName} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="1099sa_income" />
      <SectionIntro
        icon={<HeartPulse className="w-8 h-8" />}
        title="HSA Distributions (1099-SA)"
        description="Enter distributions from your Health Savings Account. Distributions used for qualified medical expenses are tax-free."
      />

      <div className="space-y-3 mt-4 mb-2">
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
              <div className="font-medium">{item.payerName || 'Unknown HSA'}</div>
              <div className="text-sm text-slate-400">
                ${(item.grossDistribution ?? 0).toLocaleString()} &middot;
                Code {item.distributionCode || '1'} ({codeLabels[item.distributionCode || '1'] || 'Unknown'})
                {item.qualifiedMedicalExpenses && (
                  <span className="ml-2 text-green-400">Qualified Medical</span>
                )}
                {!item.qualifiedMedicalExpenses && (
                  <span className="ml-2 text-amber-400">Taxable</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ItemWarningBadge warnings={itemWarnings.get(idx)} /><button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-2 text-slate-400 hover:text-telos-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="p-2 text-slate-400 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        )
      )}

      {!editingId && (
        adding ? (
          renderForm(addItem, 'Save 1099-SA')
        ) : (
          <AddButton onClick={() => setAdding(true)}>Add 1099-SA</AddButton>
        )
      )}

      <StepNavigation />
    </div>
  );
}
