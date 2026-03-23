import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Dices, Pencil, Trash2, ExternalLink } from 'lucide-react';
import AddButton from '../common/AddButton';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';

const EMPTY_FORM = {
  payerName: '',
  grossWinnings: 0,
  federalTaxWithheld: 0,
  typeOfWager: '',
  stateCode: '',
  stateTaxWithheld: 0,
};

const help = HELP_CONTENT['w2g_income'];

export default function W2GIncomeStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const items = taxReturn.incomeW2G || [];
  const itemWarnings = useItemWarnings('w2g_income');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const cancelForm = () => { setForm({ ...EMPTY_FORM }); setAdding(false); setEditingId(null); };

  const startEdit = (item: typeof items[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      payerName: item.payerName,
      grossWinnings: item.grossWinnings,
      federalTaxWithheld: item.federalTaxWithheld || 0,
      typeOfWager: item.typeOfWager || '',
      stateCode: item.stateCode || '',
      stateTaxWithheld: item.stateTaxWithheld || 0,
    });
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, 'w2g', form);
    updateField('incomeW2G', [...items, { id: result.id, ...form }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, 'w2g', editingId, form);
    updateField('incomeW2G', items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'incomeW2G',
      item: item as any,
      label: `W-2G${item.payerName ? ` from ${item.payerName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Payer Name" tooltip={help?.fields['Payer Name']?.tooltip} irsRef={help?.fields['Payer Name']?.irsRef}>
        <input className="input-field" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} placeholder="Casino name, lottery, etc." />
      </FormField>
      <FormField label="Gross Winnings (Box 1)" tooltip={help?.fields['Gross Winnings (Box 1)']?.tooltip} irsRef={help?.fields['Gross Winnings (Box 1)']?.irsRef}>
        <CurrencyInput value={form.grossWinnings} onChange={(v) => setForm({ ...form, grossWinnings: v })} />
      </FormField>
      <FormField label="Federal Tax Withheld (Box 4)" optional tooltip={help?.fields['Federal Tax Withheld (Box 4)']?.tooltip} irsRef={help?.fields['Federal Tax Withheld (Box 4)']?.irsRef}>
        <CurrencyInput value={form.federalTaxWithheld} onChange={(v) => setForm({ ...form, federalTaxWithheld: v })} />
      </FormField>
      <FormField label="Type of Wager" optional helpText="e.g. Slot machine, Horse race, Poker" tooltip={help?.fields['Type of Wager']?.tooltip} irsRef={help?.fields['Type of Wager']?.irsRef}>
        <input className="input-field" value={form.typeOfWager} onChange={(e) => setForm({ ...form, typeOfWager: e.target.value })} />
      </FormField>
      <FormField label="State (Box 13)" optional helpText="2-letter state abbreviation" tooltip="The state where the gambling income was earned and taxes were withheld.">
        <input className="input-field" value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })} maxLength={2} placeholder="e.g. NV" />
      </FormField>
      <FormField label="State Tax Withheld (Box 15)" optional tooltip="State income tax withheld from your gambling winnings, if any.">
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
      <StepWarningsBanner stepId="w2g_income" />

      <SectionIntro
        icon={<Dices className="w-8 h-8" />}
        title="W-2G Gambling Winnings"
        description="Enter each W-2G form you received for gambling, lottery, or other winnings."
      />

      <div className="space-y-3 mt-4 mb-6">
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
              <div className="font-medium">{item.payerName || 'Unknown Payer'}</div>
              <div className="text-sm text-slate-400">
                Winnings: ${(item.grossWinnings ?? 0).toLocaleString()}
                {item.typeOfWager && <span> &middot; {item.typeOfWager}</span>}
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
        adding ? renderForm(addItem, 'Save W-2G') : <AddButton onClick={() => setAdding(true)}>Add W-2G</AddButton>
      )}

      <a
        href="https://www.irs.gov/forms-pubs/about-form-w-2g"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation />
    </div>
  );
}
