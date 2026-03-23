import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { Briefcase, Trash2, Pencil } from 'lucide-react';
import AddButton from '../common/AddButton';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import InlineImportButton from '../import/InlineImportButton';
import InlinePDFImport from '../import/InlinePDFImport';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import { getAllStates } from '@telostax/engine';

const stateOptions = getAllStates().map((s) => ({ code: s.code, name: s.name }));
const emptyForm = { payerName: '', amount: 0, federalTaxWithheld: 0, businessId: '', stateCode: '', stateTaxWithheld: 0 };

export default function NEC1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('1099nec_income');

  const help = HELP_CONTENT['1099nec_income'];
  const businesses = taxReturn.businesses?.length > 0
    ? taxReturn.businesses
    : (taxReturn.business ? [taxReturn.business] : []);
  const hasMultipleBusinesses = businesses.length > 1;

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importing, setImporting] = useState(false);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAdding(true);
  };

  const startEdit = (item: typeof taxReturn.income1099NEC[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      payerName: item.payerName,
      amount: item.amount,
      federalTaxWithheld: item.federalTaxWithheld || 0,
      businessId: item.businessId || '',
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
    const payload = { ...form };
    // Auto-assign to single business when there's only one
    if (businesses.length === 1 && !payload.businessId) {
      payload.businessId = businesses[0].id;
    }
    const result = await addIncomeItem(returnId, '1099nec', payload);
    updateField('income1099NEC', [...taxReturn.income1099NEC, { id: result.id, ...payload }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const payload = { ...form };
    if (businesses.length === 1 && !payload.businessId) {
      payload.businessId = businesses[0].id;
    }
    await updateIncomeItem(returnId, '1099nec', editingId, payload);
    updateField(
      'income1099NEC',
      taxReturn.income1099NEC.map((i) =>
        i.id === editingId ? { ...i, ...payload } : i,
      ),
    );
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = taxReturn.income1099NEC.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099NEC',
      item: item as any,
      label: `1099-NEC${item.payerName ? ` from ${item.payerName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Payer Name" tooltip={help?.fields['Payer Name']?.tooltip} irsRef={help?.fields['Payer Name']?.irsRef}>
        <input className="input-field" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} placeholder="Company name" />
      </FormField>
      <FormField label="Nonemployee Compensation (Box 1)" tooltip={help?.fields['Nonemployee Compensation (Box 1)']?.tooltip} irsRef={help?.fields['Nonemployee Compensation (Box 1)']?.irsRef}>
        <CurrencyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
      </FormField>
      <FormField label="Federal Tax Withheld (Box 4)" tooltip={help?.fields['Federal Tax Withheld (Box 4)']?.tooltip} irsRef={help?.fields['Federal Tax Withheld (Box 4)']?.irsRef}>
        <CurrencyInput value={form.federalTaxWithheld} onChange={(v) => setForm({ ...form, federalTaxWithheld: v })} />
      </FormField>
      <FormField label="State (Box 6)" optional tooltip="The state listed on your 1099-NEC for state tax withholding.">
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
      <FormField label="State Tax Withheld (Box 7)" optional
        warning={(form.stateTaxWithheld || 0) > 0 && !form.stateCode ? 'State withholding entered without selecting a state — select the state from Box 6.' : undefined}>
        <CurrencyInput value={form.stateTaxWithheld} onChange={(v) => setForm({ ...form, stateTaxWithheld: v })} />
      </FormField>
      {hasMultipleBusinesses && (
        <FormField label="Business" helpText="Which business is this income for?" tooltip={help?.fields['Business']?.tooltip} irsRef={help?.fields['Business']?.irsRef}>
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
        <button onClick={onSave} disabled={!form.payerName} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="1099nec_income" />
      <SectionIntro
        icon={<Briefcase className="w-8 h-8" />}
        title="1099-NEC Nonemployee Compensation"
        description="Enter each 1099-NEC you received for nonemployee compensation."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Inline PDF import */}
      {importing ? (
        <InlinePDFImport
          expectedFormType="1099-NEC"
          onClose={() => setImporting(false)}
        />
      ) : (
        <InlineImportButton importType="pdf" formLabel="1099-NEC" onClick={() => setImporting(true)} />
      )}

      {taxReturn.income1099NEC.length > 0 && (
        <div className="space-y-3 mt-6">
          {taxReturn.income1099NEC.map((item, idx) =>
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
                  <div className="text-sm text-slate-400">
                    ${(item.amount ?? 0).toLocaleString()}
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
        renderForm(addItem, 'Save 1099-NEC')
      ) : (
        !editingId && (
          <AddButton onClick={startAdd}>Add 1099-NEC</AddButton>
        )
      )}

      <StepNavigation />
    </div>
  );
}
