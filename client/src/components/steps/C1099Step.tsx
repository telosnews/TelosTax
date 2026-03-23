import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem, updateReturn } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { FileX, Pencil, Trash2, ShieldCheck, ExternalLink } from 'lucide-react';
import AddButton from '../common/AddButton';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import { validateTaxYearEventDate } from '../../utils/dateValidation';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';

const EMPTY_FORM = {
  payerName: '',
  amountCancelled: 0,
  interestIncluded: 0,
  dateOfCancellation: '',
  debtDescription: '',
  identifiableEventCode: '',
  federalTaxWithheld: 0,
};

const help = HELP_CONTENT['1099c_income'];

export default function C1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const items = taxReturn.income1099C || [];
  const itemWarnings = useItemWarnings('1099c_income');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const cancelForm = () => { setForm({ ...EMPTY_FORM }); setAdding(false); setEditingId(null); };

  const startEdit = (item: typeof items[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      payerName: item.payerName,
      amountCancelled: item.amountCancelled,
      interestIncluded: item.interestIncluded || 0,
      dateOfCancellation: item.dateOfCancellation || '',
      debtDescription: item.debtDescription || '',
      identifiableEventCode: item.identifiableEventCode || '',
      federalTaxWithheld: item.federalTaxWithheld || 0,
    });
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, '1099c', form);
    updateField('income1099C', [...items, { id: result.id, ...form }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, '1099c', editingId, form);
    updateField('income1099C', items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099C',
      item: item as any,
      label: `1099-C${item.payerName ? ` from ${item.payerName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Creditor / Lender Name" tooltip={help?.fields['Creditor / Lender Name']?.tooltip} irsRef={help?.fields['Creditor / Lender Name']?.irsRef}>
        <input className="input-field" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} placeholder="Bank of America, Chase, etc." />
      </FormField>
      <FormField label="Amount of Debt Cancelled (Box 2)" tooltip={help?.fields['Amount of Debt Cancelled (Box 2)']?.tooltip} irsRef={help?.fields['Amount of Debt Cancelled (Box 2)']?.irsRef}>
        <CurrencyInput value={form.amountCancelled} onChange={(v) => setForm({ ...form, amountCancelled: v })} />
      </FormField>
      <FormField label="Interest Included in Box 2 (Box 3)" optional tooltip={help?.fields['Interest Included in Box 2 (Box 3)']?.tooltip} irsRef={help?.fields['Interest Included in Box 2 (Box 3)']?.irsRef}>
        <CurrencyInput value={form.interestIncluded} onChange={(v) => setForm({ ...form, interestIncluded: v })} />
      </FormField>
      <FormField label="Date of Cancellation (Box 1)" optional tooltip={help?.fields['Date of Cancellation (Box 1)']?.tooltip} irsRef={help?.fields['Date of Cancellation (Box 1)']?.irsRef} warning={validateTaxYearEventDate(form.dateOfCancellation)}>
        <input type="date" className="input-field" value={form.dateOfCancellation} onChange={(e) => setForm({ ...form, dateOfCancellation: e.target.value })} />
      </FormField>
      <FormField label="Description of Debt (Box 4)" optional tooltip={help?.fields['Description of Debt (Box 4)']?.tooltip} irsRef={help?.fields['Description of Debt (Box 4)']?.irsRef}>
        <input className="input-field" value={form.debtDescription} onChange={(e) => setForm({ ...form, debtDescription: e.target.value })} placeholder="Credit card, mortgage, student loan" />
      </FormField>
      <FormField label="Event Code (Box 6)" optional helpText="A=Bankruptcy, B=Foreclosure, C=Statute of limitations, etc." tooltip={help?.fields['Event Code (Box 6)']?.tooltip} irsRef={help?.fields['Event Code (Box 6)']?.irsRef}>
        <input className="input-field" value={form.identifiableEventCode} onChange={(e) => setForm({ ...form, identifiableEventCode: e.target.value.toUpperCase().slice(0, 1) })} maxLength={1} placeholder="A" />
      </FormField>
      <FormField label="Federal Tax Withheld" optional tooltip={help?.fields['Federal Tax Withheld']?.tooltip} irsRef={help?.fields['Federal Tax Withheld']?.irsRef}>
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
      <StepWarningsBanner stepId="1099c_income" />

      <SectionIntro
        icon={<FileX className="w-8 h-8" />}
        title="1099-C Cancellation of Debt"
        description="Enter each 1099-C you received. Cancelled debt is generally taxable income unless an exclusion applies."
      />

      <CalloutCard variant="info" title="When is canceled debt taxable?" irsUrl="https://www.irs.gov/forms-pubs/about-form-982">
        When a lender forgives or cancels $600 or more of your debt, it's generally treated as taxable income. However, you may be able to exclude it if you were insolvent at the time of cancellation, the debt was discharged in bankruptcy, or it qualifies as qualified principal residence indebtedness. Use Form 982 to claim an exclusion.
      </CalloutCard>

      {items.map((item, idx) =>
        editingId === item.id ? (
          <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
        ) : (
          <div key={item.id} className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`} role="button" tabIndex={0} onClick={() => startEdit(item)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(item); } }}>
            <div>
              <div className="font-medium">{item.payerName || 'Unknown Creditor'}</div>
              <div className="text-sm text-slate-400">
                Cancelled: ${(item.amountCancelled ?? 0).toLocaleString()}
                {item.debtDescription && <span> &middot; {item.debtDescription}</span>}
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
        adding ? renderForm(addItem, 'Save 1099-C') : <AddButton onClick={() => setAdding(true)}>Add 1099-C</AddButton>
      )}

      {/* Form 982 — Exclusion of Cancelled Debt */}
      {items.length > 0 && (
        <div className="card mt-6">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-medium text-slate-200">Form 982 — Debt Exclusion</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            You may be able to exclude cancelled debt from income if you were insolvent, in bankruptcy, or qualify for another exception.
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="accent-telos-orange-400"
                checked={!!taxReturn.form982?.isBankruptcy}
                onChange={(e) => updateField('form982', { ...taxReturn.form982, isBankruptcy: e.target.checked })}
              />
              <span className="text-sm text-slate-300">Discharge in Title 11 bankruptcy (Line 1a)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="accent-telos-orange-400"
                checked={!!taxReturn.form982?.isInsolvent}
                onChange={(e) => updateField('form982', { ...taxReturn.form982, isInsolvent: e.target.checked })}
              />
              <span className="text-sm text-slate-300">Discharge occurred when insolvent (Line 1b)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="accent-telos-orange-400"
                checked={!!taxReturn.form982?.isQualifiedFarmDebt}
                onChange={(e) => updateField('form982', { ...taxReturn.form982, isQualifiedFarmDebt: e.target.checked })}
              />
              <span className="text-sm text-slate-300">Qualified farm indebtedness (Line 1c)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="accent-telos-orange-400"
                checked={!!taxReturn.form982?.isQualifiedPrincipalResidence}
                onChange={(e) => updateField('form982', { ...taxReturn.form982, isQualifiedPrincipalResidence: e.target.checked })}
              />
              <span className="text-sm text-slate-300">Qualified principal residence indebtedness (Line 1e)</span>
            </label>
          </div>
          {taxReturn.form982?.isInsolvent && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Total Liabilities Before Discharge" helpText="All debts immediately before the cancellation" tooltip={help?.fields['Total Liabilities Before Discharge']?.tooltip} irsRef={help?.fields['Total Liabilities Before Discharge']?.irsRef}>
                <CurrencyInput
                  value={taxReturn.form982?.totalLiabilitiesBefore}
                  onChange={(v) => updateField('form982', { ...taxReturn.form982, totalLiabilitiesBefore: v })}
                />
              </FormField>
              <FormField label="Total Assets (FMV) Before Discharge" helpText="Fair market value of all assets before cancellation" tooltip={help?.fields['Total Assets (FMV) Before Discharge']?.tooltip} irsRef={help?.fields['Total Assets (FMV) Before Discharge']?.irsRef}>
                <CurrencyInput
                  value={taxReturn.form982?.totalAssetsBefore}
                  onChange={(v) => updateField('form982', { ...taxReturn.form982, totalAssetsBefore: v })}
                />
              </FormField>
              {(taxReturn.form982?.totalLiabilitiesBefore || 0) > 0 && (taxReturn.form982?.totalAssetsBefore || 0) > 0 && (() => {
                const insolvencyAmount = (taxReturn.form982?.totalLiabilitiesBefore || 0) - (taxReturn.form982?.totalAssetsBefore || 0);
                if (insolvencyAmount <= 0) return (
                  <div className="sm:col-span-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                    Assets exceed liabilities — you may not qualify as insolvent. Exclusion limited to the extent of insolvency.
                  </div>
                );
                return (
                  <div className="sm:col-span-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                    Insolvency amount: ${insolvencyAmount.toLocaleString()} — you can exclude up to this amount of cancelled debt.
                  </div>
                );
              })()}
            </div>
          )}
          <a
            href="https://www.irs.gov/forms-pubs/about-form-982"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Learn more on IRS.gov
          </a>
        </div>
      )}

      <a
        href="https://www.irs.gov/forms-pubs/about-form-1099-c"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Learn more about 1099-C on IRS.gov
      </a>

      <StepNavigation onContinue={async () => {
        if (taxReturn.form982) {
          await updateReturn(returnId, { form982: taxReturn.form982 });
        }
      }} />
    </div>
  );
}
