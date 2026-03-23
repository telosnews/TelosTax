import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import AddButton from '../common/AddButton';
import { Ticket, Trash2, Pencil } from 'lucide-react';
import CalloutCard from '../common/CalloutCard';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';

const emptyForm = {
  payerName: '',
  originalIssueDiscount: 0,
  otherPeriodicInterest: 0,
  earlyWithdrawalPenalty: 0,
  acquisitionPremium: 0,
  federalTaxWithheld: 0,
  description: '',
};

export default function OID1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const items = taxReturn.income1099OID || [];
  const itemWarnings = useItemWarnings('1099oid_income');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const startAdd = () => { setEditingId(null); setForm(emptyForm); setAdding(true); };
  const startEdit = (item: typeof items[0]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      payerName: item.payerName,
      originalIssueDiscount: item.originalIssueDiscount || 0,
      otherPeriodicInterest: item.otherPeriodicInterest || 0,
      earlyWithdrawalPenalty: item.earlyWithdrawalPenalty || 0,
      acquisitionPremium: item.acquisitionPremium || 0,
      federalTaxWithheld: item.federalTaxWithheld || 0,
      description: item.description || '',
    });
  };
  const cancelForm = () => { setAdding(false); setEditingId(null); setForm(emptyForm); };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, '1099oid', form);
    updateField('income1099OID', [...items, { id: result.id, ...form }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, '1099oid', editingId, form);
    updateField('income1099OID', items.map((i) => i.id === editingId ? { ...i, ...form } : i));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099OID',
      item: item as any,
      label: `1099-OID${item.payerName ? ` from ${item.payerName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Payer Name" irsRef="1099-OID, Payer's Name">
        <input className="input-field" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} placeholder="Issuer or institution" />
      </FormField>
      <FormField label="Original Issue Discount (Box 1)" tooltip="The OID accrued during the year. This is reported as interest income." irsRef="Form 1099-OID, Box 1">
        <CurrencyInput value={form.originalIssueDiscount} onChange={(v) => setForm({ ...form, originalIssueDiscount: v })} />
      </FormField>
      <FormField label="Other Periodic Interest (Box 2)" optional tooltip="Interest other than OID paid on the obligation." irsRef="Form 1099-OID, Box 2">
        <CurrencyInput value={form.otherPeriodicInterest} onChange={(v) => setForm({ ...form, otherPeriodicInterest: v })} />
      </FormField>
      <FormField label="Acquisition Premium (Box 6)" optional tooltip="If you purchased the bond at a premium above its adjusted issue price, this reduces your taxable OID." irsRef="Form 1099-OID, Box 6">
        <CurrencyInput value={form.acquisitionPremium} onChange={(v) => setForm({ ...form, acquisitionPremium: v })} />
      </FormField>
      <FormField label="Early Withdrawal Penalty (Box 3)" optional tooltip="Penalty for early redemption of a time deposit (e.g., CD). This is deductible as an adjustment to income." irsRef="Form 1099-OID, Box 3">
        <CurrencyInput value={form.earlyWithdrawalPenalty} onChange={(v) => setForm({ ...form, earlyWithdrawalPenalty: v })} />
      </FormField>
      <FormField label="Federal Tax Withheld (Box 4)" optional irsRef="Form 1099-OID, Box 4">
        <CurrencyInput value={form.federalTaxWithheld} onChange={(v) => setForm({ ...form, federalTaxWithheld: v })} />
      </FormField>
      <FormField label="Description (Box 8)" optional>
        <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g., U.S. Treasury Bond" />
      </FormField>
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.payerName} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="1099oid_income" />
      <SectionIntro icon={<Ticket className="w-8 h-8" />} title="Original Issue Discount (1099-OID)" description="Enter OID income from bonds, notes, or other debt instruments issued at a discount." />

      <CalloutCard variant="info" title="What is OID?" irsUrl="https://www.irs.gov/forms-pubs/about-form-1099-oid">
        Original Issue Discount is the difference between a bond's face value and its lower original purchase price. You accrue a portion as taxable interest income each year, even if you don't receive payment until maturity. Acquisition premium (Box 6) offsets OID.
      </CalloutCard>

      {items.length > 0 && (
        <div className="space-y-3 mt-6">
          {items.map((item, idx) =>
            editingId === item.id ? (
              <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
            ) : (
              <div key={item.id} className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`} onClick={() => startEdit(item)}>
                <div>
                  <div className="font-medium">{item.payerName}</div>
                  <div className="text-sm text-slate-400">${(item.originalIssueDiscount || 0).toLocaleString()} OID{item.description ? ` — ${item.description}` : ''}</div>
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

      {adding ? renderForm(addItem, 'Save 1099-OID') : !editingId && <AddButton onClick={startAdd}>Add 1099-OID</AddButton>}

      <StepNavigation />
    </div>
  );
}
