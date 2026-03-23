import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { GraduationCap, Pencil, Trash2 } from 'lucide-react';
import AddButton from '../common/AddButton';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';

const EMPTY_FORM: {
  payerName: string;
  grossDistribution: number;
  earnings: number;
  basisReturn: number;
  qualifiedExpenses: number;
  taxFreeAssistance: number;
  expensesClaimedForCredit: number;
  distributionType: 'qualified' | 'non_qualified' | 'rollover';
  recipientType: 'accountOwner' | 'beneficiary';
} = {
  payerName: '',
  grossDistribution: 0,
  earnings: 0,
  basisReturn: 0,
  qualifiedExpenses: 0,
  taxFreeAssistance: 0,
  expensesClaimedForCredit: 0,
  distributionType: 'qualified',
  recipientType: 'accountOwner',
};

const help = HELP_CONTENT['1099q_income'];

export default function Q1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const items = taxReturn.income1099Q || [];
  const itemWarnings = useItemWarnings('1099q_income');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const cancelForm = () => { setForm({ ...EMPTY_FORM }); setAdding(false); setEditingId(null); };

  const startEdit = (item: typeof items[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      payerName: item.payerName,
      grossDistribution: item.grossDistribution,
      earnings: item.earnings,
      basisReturn: item.basisReturn,
      qualifiedExpenses: item.qualifiedExpenses,
      taxFreeAssistance: item.taxFreeAssistance || 0,
      expensesClaimedForCredit: item.expensesClaimedForCredit || 0,
      distributionType: item.distributionType,
      recipientType: item.recipientType || 'accountOwner',
    });
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, '1099q', form);
    updateField('income1099Q', [...items, { id: result.id, ...form }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, '1099q', editingId, form);
    updateField('income1099Q', items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099Q',
      item: item as any,
      label: `1099-Q${item.payerName ? ` from ${item.payerName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Plan / Trustee Name" tooltip={help?.fields['Plan / Trustee Name']?.tooltip} irsRef={help?.fields['Plan / Trustee Name']?.irsRef}>
        <input className="input-field" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} placeholder="Vanguard, Fidelity, etc." />
      </FormField>
      <FormField label="Gross Distribution (Box 1)" tooltip={help?.fields['Gross Distribution (Box 1)']?.tooltip} irsRef={help?.fields['Gross Distribution (Box 1)']?.irsRef}>
        <CurrencyInput value={form.grossDistribution} onChange={(v) => setForm({ ...form, grossDistribution: v })} />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Earnings (Box 2)" tooltip={help?.fields['Earnings (Box 2)']?.tooltip} irsRef={help?.fields['Earnings (Box 2)']?.irsRef}>
            <CurrencyInput value={form.earnings} onChange={(v) => setForm({ ...form, earnings: v })} />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Basis / Return of Contribution (Box 3)" tooltip={help?.fields['Basis / Return of Contribution (Box 3)']?.tooltip} irsRef={help?.fields['Basis / Return of Contribution (Box 3)']?.irsRef}>
            <CurrencyInput value={form.basisReturn} onChange={(v) => setForm({ ...form, basisReturn: v })} />
          </FormField>
        </div>
      </div>
      <FormField label="Distribution Type" tooltip={help?.fields['Distribution Type']?.tooltip} irsRef={help?.fields['Distribution Type']?.irsRef}>
        <select className="input-field" value={form.distributionType} onChange={(e) => setForm({ ...form, distributionType: e.target.value as typeof form.distributionType })}>
          <option value="qualified">Qualified (used for education)</option>
          <option value="non_qualified">Non-Qualified</option>
          <option value="rollover">Rollover to another 529</option>
        </select>
      </FormField>
      <FormField label="Recipient" tooltip="Who received this 1099-Q? If issued to the beneficiary (student), the income is reported on their return." irsRef={help?.fields['Recipient']?.irsRef}>
        <select className="input-field" value={form.recipientType} onChange={(e) => setForm({ ...form, recipientType: e.target.value as typeof form.recipientType })}>
          <option value="accountOwner">Account Owner (you)</option>
          <option value="beneficiary">Beneficiary (student)</option>
        </select>
      </FormField>
      {form.distributionType !== 'rollover' && (
        <>
          <FormField label="Qualified Education Expenses Paid" helpText="Tuition, fees, books, room & board. Distributions for non-qualified expenses are taxable + 10% penalty." tooltip={help?.fields['Qualified Education Expenses Paid']?.tooltip} irsRef={help?.fields['Qualified Education Expenses Paid']?.irsRef}>
            <CurrencyInput value={form.qualifiedExpenses} onChange={(v) => setForm({ ...form, qualifiedExpenses: v })} />
          </FormField>
          <FormField label="Tax-Free Scholarships / Grants" helpText="Tax-free scholarships, fellowships, Pell grants, employer-provided educational assistance, or veterans' educational assistance received for the same student. These reduce the qualified expenses that can exclude 529 earnings from tax. (Pub 970, Ch. 8)" tooltip={help?.fields['Tax-Free Scholarships / Grants']?.tooltip} irsRef={help?.fields['Tax-Free Scholarships / Grants']?.irsRef}>
            <CurrencyInput value={form.taxFreeAssistance} onChange={(v) => setForm({ ...form, taxFreeAssistance: v })} />
          </FormField>
          <FormField label="Expenses Claimed for Education Credits" helpText="Qualified education expenses you are using to claim the American Opportunity Credit or Lifetime Learning Credit. The same expenses cannot be used for both a 529 tax-free exclusion and an education credit. (IRC §25A, Pub 970)" tooltip={help?.fields['Expenses Claimed for Education Credits']?.tooltip} irsRef={help?.fields['Expenses Claimed for Education Credits']?.irsRef}>
            <CurrencyInput value={form.expensesClaimedForCredit} onChange={(v) => setForm({ ...form, expensesClaimedForCredit: v })} />
          </FormField>
        </>
      )}
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.payerName} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="1099q_income" />

      <SectionIntro
        icon={<GraduationCap className="w-8 h-8" />}
        title="1099-Q (529 Plan Distributions)"
        description="Enter each distribution from a 529 education savings plan."
      />

      <CalloutCard variant="info" title="Are 529 distributions taxable?" irsUrl="https://www.irs.gov/publications/p970">
        Distributions from 529 plans used for qualified education expenses — tuition, fees, books, supplies, and room and board — are tax-free. If distributions exceed qualified expenses, the earnings portion is taxable and may be subject to a 10% additional tax. Coordinate with any education credits claimed to avoid double-counting the same expenses.
      </CalloutCard>

      {items.map((item, idx) =>
        editingId === item.id ? (
          <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
        ) : (
          <div key={item.id} className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`} role="button" tabIndex={0} onClick={() => startEdit(item)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(item); } }}>
            <div>
              <div className="font-medium">{item.payerName || 'Unknown Plan'}</div>
              <div className="text-sm text-slate-400">
                Distribution: ${(item.grossDistribution ?? 0).toLocaleString()} &middot; {item.distributionType === 'qualified' ? 'Qualified' : item.distributionType === 'rollover' ? 'Rollover' : 'Non-Qualified'}
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
        adding ? renderForm(addItem, 'Save 1099-Q') : <AddButton onClick={() => setAdding(true)}>Add 1099-Q</AddButton>
      )}

      <StepNavigation />
    </div>
  );
}
