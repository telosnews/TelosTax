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
import { Ban, Trash2, Pencil, ExternalLink } from 'lucide-react';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';

const emptyForm = { debtorName: '', description: '', amountOwed: 0 };

export default function BadDebtStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const items = taxReturn.nonbusinessBadDebts || [];
  const itemWarnings = useItemWarnings('bad_debt');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const startAdd = () => { setEditingId(null); setForm(emptyForm); setAdding(true); };
  const startEdit = (item: typeof items[0]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({ debtorName: item.debtorName, description: item.description, amountOwed: item.amountOwed });
  };
  const cancelForm = () => { setAdding(false); setEditingId(null); setForm(emptyForm); };

  const addItem = () => {
    const id = crypto.randomUUID();
    updateField('nonbusinessBadDebts', [...items, { id, ...form }]);
    cancelForm();
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateField('nonbusinessBadDebts', items.map((i) => i.id === editingId ? { ...i, ...form } : i));
    cancelForm();
  };

  const removeItem = (id: string) => {
    updateField('nonbusinessBadDebts', items.filter((i) => i.id !== id));
    if (editingId === id) cancelForm();
  };

  const save = async () => {
    await updateReturn(returnId, { nonbusinessBadDebts: taxReturn.nonbusinessBadDebts });
  };

  const totalLoss = items.reduce((sum, d) => sum + Math.max(0, d.amountOwed), 0);

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Debtor Name" tooltip="Name of the person or entity who owed you the debt.">
        <input className="input-field" value={form.debtorName} onChange={(e) => setForm({ ...form, debtorName: e.target.value })} placeholder="Person or business who owed the debt" />
      </FormField>
      <FormField label="Description" tooltip="Describe the nature of the debt (e.g., personal loan, unpaid invoice).">
        <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g., Personal loan made in 2023" />
      </FormField>
      <FormField label="Amount Owed (Worthless)" tooltip="The total amount of the debt that became completely worthless during the tax year." irsRef="IRC §166(d); Schedule D">
        <CurrencyInput value={form.amountOwed} onChange={(v) => setForm({ ...form, amountOwed: v })} />
      </FormField>
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.debtorName || !form.amountOwed} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="bad_debt" />
      <SectionIntro icon={<Ban className="w-8 h-8" />} title="Nonbusiness Bad Debt" description="Report debts owed to you that became completely worthless during the tax year." />

      <CalloutCard variant="info" title="How bad debt is treated" irsUrl="https://www.irs.gov/taxtopics/tc453">
        A nonbusiness bad debt is treated as a short-term capital loss on Schedule D, subject to the $3,000 annual capital loss deduction limit. The debt must be completely worthless — partial bad debts are not deductible for nonbusiness debts. You must have a bona fide debt (not a gift) and have taken reasonable steps to collect.
      </CalloutCard>

      {items.length > 0 && (
        <div className="space-y-3 mt-6">
          {items.map((item, idx) =>
            editingId === item.id ? (
              <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
            ) : (
              <div key={item.id} className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`} onClick={() => startEdit(item)}>
                <div>
                  <div className="font-medium">{item.debtorName}</div>
                  <div className="text-sm text-slate-400">${(item.amountOwed ?? 0).toLocaleString()} — {item.description}</div>
                </div>
                <div className="flex items-center gap-1">
                  <ItemWarningBadge warnings={itemWarnings.get(idx)} />
                  <button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-2 text-slate-400 hover:text-telos-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="p-2 text-slate-400 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {totalLoss > 0 && (
        <div className="rounded-xl border p-4 mt-4 bg-amber-500/10 border-amber-500/30 text-center">
          <p className="text-sm text-slate-400">Total Bad Debt Loss</p>
          <p className="text-xl font-bold text-amber-400">${totalLoss.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">Reported as short-term capital loss on Schedule D (up to $3,000 deductible per year)</p>
        </div>
      )}

      {adding ? renderForm(addItem, 'Add Bad Debt') : !editingId && <AddButton onClick={startAdd}>Add Bad Debt</AddButton>}

      <a href="https://www.irs.gov/taxtopics/tc453" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation onContinue={save} />
    </div>
  );
}
