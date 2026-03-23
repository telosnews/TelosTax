import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { CircleDollarSign, Pencil, Trash2 } from 'lucide-react';
import AddButton from '../common/AddButton';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import StepWarningsBanner from '../common/StepWarningsBanner';

export default function K1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('1099k_income');

  const help = HELP_CONTENT['1099k_income'];
  const businesses = taxReturn.businesses?.length > 0
    ? taxReturn.businesses
    : (taxReturn.business ? [taxReturn.business] : []);
  const hasMultipleBusinesses = businesses.length > 1;

  const emptyForm = { platformName: '', grossAmount: 0, federalTaxWithheld: 0, returnsAndAllowances: 0, businessId: '' };

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAdding(true);
  };

  const startEdit = (item: typeof taxReturn.income1099K[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      platformName: item.platformName,
      grossAmount: item.grossAmount,
      federalTaxWithheld: item.federalTaxWithheld || 0,
      returnsAndAllowances: item.returnsAndAllowances || 0,
      businessId: item.businessId || '',
    });
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const addItem = async () => {
    const payload = { ...form };
    if (businesses.length === 1 && !payload.businessId) {
      payload.businessId = businesses[0].id;
    }
    const result = await addIncomeItem(returnId, '1099k', payload);
    updateField('income1099K', [...taxReturn.income1099K, { id: result.id, ...payload }]);
    setForm(emptyForm);
    setAdding(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const payload = { ...form };
    if (businesses.length === 1 && !payload.businessId) {
      payload.businessId = businesses[0].id;
    }
    await updateIncomeItem(returnId, '1099k', editingId, payload);
    updateField('income1099K', taxReturn.income1099K.map((i) => (i.id === editingId ? { ...i, ...payload } : i)));
    setEditingId(null);
    setForm(emptyForm);
  };

  const removeItem = (id: string) => {
    const item = taxReturn.income1099K.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099K',
      item: item as any,
      label: `1099-K${item.platformName ? ` from ${item.platformName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Platform Name" tooltip={help?.fields['Platform Name']?.tooltip}>
        <input className="input-field" value={form.platformName} onChange={(e) => setForm({ ...form, platformName: e.target.value })} placeholder="PayPal, Stripe, etc." />
      </FormField>
      <FormField label="Gross Amount (Box 1a)" tooltip={help?.fields['Gross Amount (Box 1a)']?.tooltip} irsRef={help?.fields['Gross Amount (Box 1a)']?.irsRef}>
        <CurrencyInput value={form.grossAmount} onChange={(v) => setForm({ ...form, grossAmount: v })} />
      </FormField>
      <FormField label="Federal Tax Withheld (Box 4)" tooltip={help?.fields['Federal Tax Withheld (Box 4)']?.tooltip} irsRef={help?.fields['Federal Tax Withheld (Box 4)']?.irsRef}>
        <CurrencyInput value={form.federalTaxWithheld} onChange={(v) => setForm({ ...form, federalTaxWithheld: v })} />
      </FormField>
      <FormField label="Adjustments" tooltip={help?.fields['Adjustments']?.tooltip} irsRef={help?.fields['Adjustments']?.irsRef}>
        <CurrencyInput value={form.returnsAndAllowances} onChange={(v) => setForm({ ...form, returnsAndAllowances: v })} />
        <p className="text-xs text-slate-400 mt-1">Refunds, returns, platform fees, personal transactions to subtract from gross</p>
      </FormField>
      {hasMultipleBusinesses && (
        <FormField label="Business" helpText="Which business is this income for?">
          <select
            className="input-field"
            value={form.businessId}
            onChange={(e) => setForm({ ...form, businessId: e.target.value })}
          >
            <option value="">Unassigned</option>
            {businesses.map((biz) => (
              <option key={biz.id} value={biz.id}>
                {biz.businessName || 'Unnamed Business'}
              </option>
            ))}
          </select>
        </FormField>
      )}
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.platformName} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="1099k_income" />

      <SectionIntro
        icon={<CircleDollarSign className="w-8 h-8" />}
        title="1099-K Platform Income"
        description="Enter 1099-K forms from payment platforms like Stripe, PayPal, or Etsy."
      />

      <div className="space-y-3 mt-4 mb-2">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {taxReturn.income1099K.map((item, idx) =>
        editingId === item.id ? (
          <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
        ) : (
          <div
            key={item.id}
            className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`}
            onClick={() => startEdit(item)}
          >
            <div>
              <div className="font-medium">{item.platformName}</div>
              <div className="text-sm text-slate-400">
                Gross: ${(item.grossAmount ?? 0).toLocaleString()}
                {(item.returnsAndAllowances || 0) > 0 && (
                  <span className="ml-2 text-amber-400">Adj: -${item.returnsAndAllowances!.toLocaleString()}</span>
                )}
                {(item.federalTaxWithheld || 0) > 0 && (
                  <span className="ml-2 text-emerald-400">Withheld: ${item.federalTaxWithheld!.toLocaleString()}</span>
                )}
                {item.businessId && hasMultipleBusinesses && (
                  <span className="ml-2 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                    {businesses.find(b => b.id === item.businessId)?.businessName || 'Unknown'}
                  </span>
                )}
              </div>
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
        renderForm(addItem, 'Save 1099-K')
      ) : (
        !editingId && <AddButton onClick={startAdd}>Add 1099-K</AddButton>
      )}

      <StepNavigation />
    </div>
  );
}
