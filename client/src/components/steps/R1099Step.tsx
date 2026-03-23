import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { PiggyBank, Pencil, Trash2 } from 'lucide-react';
import AddButton from '../common/AddButton';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import InlineImportButton from '../import/InlineImportButton';
import InlinePDFImport from '../import/InlinePDFImport';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import { getAllStates, EARLY_DISTRIBUTION } from '@telostax/engine';
import { Info } from 'lucide-react';

const stateOptions = getAllStates().map((s) => ({ code: s.code, name: s.name }));
const DISTRIBUTION_CODES = [
  { value: '1', label: '1 — Early distribution (before age 59½)' },
  { value: '2', label: '2 — Early distribution, exception applies' },
  { value: '7', label: '7 — Normal distribution' },
  { value: 'G', label: 'G — Direct rollover (not taxable)' },
  { value: 'T', label: 'T — Roth IRA qualified distribution (not taxable)' },
];

const EXCEPTION_CODE_OPTIONS = Object.entries(EARLY_DISTRIBUTION.EXCEPTION_REASON_CODES).map(
  ([code, label]) => ({ value: code, label: `${code} — ${label}` })
);

const EMPTY_SIMPLIFIED_METHOD = {
  totalContributions: 0,
  ageAtStartDate: 55,
  isJointAndSurvivor: false,
  combinedAge: 0,
  paymentsThisYear: 12,
  priorYearTaxFreeRecovery: 0,
};

export default function R1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('1099r_income');

  const help = HELP_CONTENT['1099r_income'];
  const items = taxReturn.income1099R || [];

  const emptyForm = {
    payerName: '', grossDistribution: 0, taxableAmount: 0, federalTaxWithheld: 0,
    distributionCode: '7', isIRA: false, isRothIRA: false, rothContributionBasis: 0,
    qcdAmount: 0, stateCode: '', stateTaxWithheld: 0,
    earlyDistributionExceptionCode: '' as string | undefined,
    earlyDistributionExceptionAmount: 0,
    useSimplifiedMethod: false,
    simplifiedMethod: { ...EMPTY_SIMPLIFIED_METHOD },
  };

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importing, setImporting] = useState(false);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAdding(true);
  };

  const startEdit = (item: typeof items[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      payerName: item.payerName,
      grossDistribution: item.grossDistribution,
      taxableAmount: item.taxableAmount,
      federalTaxWithheld: item.federalTaxWithheld || 0,
      distributionCode: item.distributionCode || '7',
      isIRA: item.isIRA || false,
      isRothIRA: item.isRothIRA || false,
      rothContributionBasis: item.rothContributionBasis || 0,
      qcdAmount: item.qcdAmount || 0,
      stateCode: item.stateCode || '',
      stateTaxWithheld: item.stateTaxWithheld || 0,
      earlyDistributionExceptionCode: item.earlyDistributionExceptionCode || '',
      earlyDistributionExceptionAmount: item.earlyDistributionExceptionAmount || 0,
      useSimplifiedMethod: item.useSimplifiedMethod || false,
      simplifiedMethod: item.simplifiedMethod
        ? { ...EMPTY_SIMPLIFIED_METHOD, ...item.simplifiedMethod }
        : { ...EMPTY_SIMPLIFIED_METHOD },
    });
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, '1099r', form);
    updateField('income1099R', [...items, { id: result.id, ...form }]);
    setForm(emptyForm);
    setAdding(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, '1099r', editingId, form);
    updateField('income1099R', items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    setEditingId(null);
    setForm(emptyForm);
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099R',
      item: item as any,
      label: `1099-R${item.payerName ? ` from ${item.payerName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Payer Name" tooltip={help?.fields['Payer Name']?.tooltip} irsRef={help?.fields['Payer Name']?.irsRef}>
        <input className="input-field" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} placeholder="Retirement plan administrator" />
      </FormField>
      <FormField label="Gross Distribution (Box 1)" tooltip={help?.fields['Gross Distribution (Box 1)']?.tooltip} irsRef={help?.fields['Gross Distribution (Box 1)']?.irsRef}>
        <CurrencyInput value={form.grossDistribution} onChange={(v) => setForm({ ...form, grossDistribution: v })} />
      </FormField>
      <FormField label="Taxable Amount (Box 2a)" tooltip={help?.fields['Taxable Amount (Box 2a)']?.tooltip} irsRef={help?.fields['Taxable Amount (Box 2a)']?.irsRef}>
        <CurrencyInput value={form.taxableAmount} onChange={(v) => setForm({ ...form, taxableAmount: v })} />
      </FormField>
      <FormField label="Federal Tax Withheld (Box 4)" tooltip={help?.fields['Federal Tax Withheld (Box 4)']?.tooltip} irsRef={help?.fields['Federal Tax Withheld (Box 4)']?.irsRef} optional>
        <CurrencyInput value={form.federalTaxWithheld} onChange={(v) => setForm({ ...form, federalTaxWithheld: v })} />
      </FormField>
      <FormField label="Distribution Code (Box 7)" tooltip={help?.fields['Distribution Code (Box 7)']?.tooltip} irsRef={help?.fields['Distribution Code (Box 7)']?.irsRef}>
        <select className="input-field" value={form.distributionCode} onChange={(e) => setForm({ ...form, distributionCode: e.target.value })}>
          <option value="1">1 — Early distribution (before age 59½)</option>
          <option value="2">2 — Early distribution, exception applies</option>
          <option value="7">7 — Normal distribution</option>
          <option value="G">G — Direct rollover (not taxable)</option>
          <option value="T">T — Roth IRA qualified distribution (not taxable)</option>
        </select>
      </FormField>
      {/* ── Form 5329 Partial Exception — shown for code 1 (early distribution) ── */}
      {form.distributionCode === '1' && (
        <div className="ml-4 border-l-2 border-amber-500/30 pl-4 mt-1 mb-2 space-y-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400">
              Early distributions are subject to a 10% penalty. If part or all of your distribution qualifies for an exception under IRC §72(t)(2), enter the details below to reduce the penalty on Form 5329.
            </p>
          </div>
          <FormField label="Exception Reason" optional tooltip="Select the IRC §72(t)(2) exception that applies to this distribution. This maps to Form 5329, Line 2." irsRef="Form 5329, Line 2">
            <select
              className="input-field"
              value={form.earlyDistributionExceptionCode || ''}
              onChange={(e) => setForm({
                ...form,
                earlyDistributionExceptionCode: e.target.value || undefined,
                earlyDistributionExceptionAmount: e.target.value ? form.earlyDistributionExceptionAmount : 0,
              })}
            >
              <option value="">No exception</option>
              {EXCEPTION_CODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FormField>
          {form.earlyDistributionExceptionCode && (
            <FormField label="Exception Amount" tooltip="The dollar amount of this distribution that is exempt from the 10% early distribution penalty. Cannot exceed the taxable amount of the distribution." irsRef="Form 5329, Line 2">
              <CurrencyInput
                value={form.earlyDistributionExceptionAmount}
                onChange={(v) => setForm({ ...form, earlyDistributionExceptionAmount: v })}
              />
              {form.earlyDistributionExceptionAmount > (form.taxableAmount || 0) && (
                <p className="text-xs text-amber-400 mt-1">Exception amount exceeds the taxable amount — it will be capped automatically.</p>
              )}
            </FormField>
          )}
        </div>
      )}

      <FormField label="Distribution Source" tooltip="Check the IRA/SEP/SIMPLE box on your 1099-R (Box 7). IRA distributions go on Form 1040 Lines 4a/4b; employer plan distributions go on Lines 5a/5b.">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, isIRA: true })}
            className={`px-4 py-2 text-sm rounded-lg border font-medium transition-colors ${form.isIRA ? 'bg-telos-blue-600/20 text-telos-blue-300 border-telos-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300'}`}
          >
            IRA / SEP / SIMPLE
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, isIRA: false })}
            className={`px-4 py-2 text-sm rounded-lg border font-medium transition-colors ${!form.isIRA ? 'bg-telos-blue-600/20 text-telos-blue-300 border-telos-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300'}`}
          >
            Employer Plan (401k, pension, etc.)
          </button>
        </div>
      </FormField>
      <label className="flex items-center gap-3 mt-2 ml-1 cursor-pointer">
        <input
          type="checkbox"
          className="accent-telos-orange-400"
          checked={form.isRothIRA}
          onChange={(e) => setForm({ ...form, isRothIRA: e.target.checked, rothContributionBasis: e.target.checked ? form.rothContributionBasis : 0 })}
        />
        <span className="text-sm text-slate-300">This is a Roth IRA distribution</span>
      </label>
      {form.isRothIRA && (
        <FormField label="Roth Contribution Basis" tooltip="Total Roth IRA contributions (not earnings) available for tax-free withdrawal.">
          <CurrencyInput value={form.rothContributionBasis} onChange={(v) => setForm({ ...form, rothContributionBasis: v })} />
          <p className="text-xs text-slate-400 mt-1">Total Roth IRA contributions (not earnings) available for tax-free withdrawal.</p>
        </FormField>
      )}
      {form.isIRA && !form.isRothIRA && form.distributionCode === '7' && (
        <FormField label="Qualified Charitable Distribution (QCD)" tooltip={help?.fields['Qualified Charitable Distribution (QCD)']?.tooltip || 'Amount from this IRA paid directly to a qualified charity. Must be age 70\u00BD or older. Excluded from taxable income on Line 4b.'} irsRef={help?.fields['Qualified Charitable Distribution (QCD)']?.irsRef} optional>
          <CurrencyInput value={form.qcdAmount} onChange={(v) => setForm({ ...form, qcdAmount: v })} />
          <p className="text-xs text-slate-400 mt-1">Amount paid directly from this IRA to a qualified charity. Must be age 70½+. Up to $105,000/year.</p>
        </FormField>
      )}

      {/* ── Simplified Method — for employer plan pensions when Box 2a is undetermined ── */}
      {!form.isIRA && (
        <>
          <label className="flex items-start gap-3 mt-3 ml-1 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 accent-telos-orange-400"
              checked={form.useSimplifiedMethod}
              onChange={(e) => setForm({
                ...form,
                useSimplifiedMethod: e.target.checked,
                simplifiedMethod: e.target.checked ? form.simplifiedMethod : { ...EMPTY_SIMPLIFIED_METHOD },
              })}
            />
            <div>
              <span className="text-sm text-slate-200">Use IRS Simplified Method to calculate taxable amount</span>
              <p className="text-xs text-slate-400 mt-0.5">
                If your 1099-R Box 2a is blank or marked "unknown," the IRS Simplified Method computes the taxable portion based on your after-tax contributions and expected payments.
              </p>
            </div>
          </label>
          {form.useSimplifiedMethod && (
            <div className="ml-4 border-l-2 border-telos-blue-500/30 pl-4 mt-2 space-y-3">
              <FormField label="Total After-Tax Contributions" tooltip="Total employee contributions (after-tax, non-deductible) to the pension plan. Found in your plan statement or HR records." irsRef="IRS Pub 939; Form 1040 Instructions — Simplified Method Worksheet">
                <CurrencyInput
                  value={form.simplifiedMethod.totalContributions}
                  onChange={(v) => setForm({ ...form, simplifiedMethod: { ...form.simplifiedMethod, totalContributions: v } })}
                />
              </FormField>
              <FormField label="Age at Annuity Start Date" tooltip="Your age when pension payments first began. Used to look up the expected number of payments from the IRS table.">
                <input
                  type="number"
                  className="input-field w-24"
                  min={1}
                  max={120}
                  value={form.simplifiedMethod.ageAtStartDate}
                  onChange={(e) => setForm({ ...form, simplifiedMethod: { ...form.simplifiedMethod, ageAtStartDate: parseInt(e.target.value) || 55 } })}
                />
              </FormField>
              <label className="flex items-center gap-3 ml-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-telos-orange-400"
                  checked={form.simplifiedMethod.isJointAndSurvivor}
                  onChange={(e) => setForm({ ...form, simplifiedMethod: { ...form.simplifiedMethod, isJointAndSurvivor: e.target.checked, combinedAge: e.target.checked ? form.simplifiedMethod.combinedAge : 0 } })}
                />
                <span className="text-sm text-slate-300">Joint and survivor annuity</span>
              </label>
              {form.simplifiedMethod.isJointAndSurvivor && (
                <FormField label="Combined Ages at Start Date" tooltip="Your age plus your beneficiary's age at the annuity start date. Used with the joint-and-survivor IRS table.">
                  <input
                    type="number"
                    className="input-field w-24"
                    min={2}
                    max={240}
                    value={form.simplifiedMethod.combinedAge || 0}
                    onChange={(e) => setForm({ ...form, simplifiedMethod: { ...form.simplifiedMethod, combinedAge: parseInt(e.target.value) || 0 } })}
                  />
                </FormField>
              )}
              <FormField label="Payments Received This Year" tooltip="Number of pension payments received during this tax year. Typically 12 for a full year of monthly payments.">
                <input
                  type="number"
                  className="input-field w-24"
                  min={1}
                  max={365}
                  value={form.simplifiedMethod.paymentsThisYear}
                  onChange={(e) => setForm({ ...form, simplifiedMethod: { ...form.simplifiedMethod, paymentsThisYear: parseInt(e.target.value) || 12 } })}
                />
              </FormField>
              <FormField label="Prior Year Tax-Free Recovery" optional tooltip="Total tax-free amounts recovered in all prior years from this same pension. From your prior-year Simplified Method worksheets.">
                <CurrencyInput
                  value={form.simplifiedMethod.priorYearTaxFreeRecovery || 0}
                  onChange={(v) => setForm({ ...form, simplifiedMethod: { ...form.simplifiedMethod, priorYearTaxFreeRecovery: v } })}
                />
              </FormField>
            </div>
          )}
        </>
      )}
      <FormField label="State (Box 13)" optional tooltip="The state listed on your 1099-R for state tax withholding.">
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
      <FormField label="State Tax Withheld (Box 14)" optional
        warning={(form.stateTaxWithheld || 0) > 0 && !form.stateCode ? 'State withholding entered without selecting a state — select the state from Box 13.' : undefined}>
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
      <StepWarningsBanner stepId="1099r_income" />
      <SectionIntro
        icon={<PiggyBank className="w-8 h-8" />}
        title="1099-R Retirement Distributions"
        description="Enter each 1099-R you received for retirement account distributions."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Inline PDF import */}
      {importing ? (
        <InlinePDFImport
          expectedFormType="1099-R"
          onClose={() => setImporting(false)}
        />
      ) : (
        <InlineImportButton importType="pdf" formLabel="1099-R" onClick={() => setImporting(true)} />
      )}

      {items.map((item, idx) =>
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
                Gross: ${(item.grossDistribution ?? 0).toLocaleString()} · Taxable: ${(item.taxableAmount ?? 0).toLocaleString()}
                {item.distributionCode && <span className="ml-2 text-xs text-slate-400">Code {item.distributionCode}</span>}
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
        renderForm(addItem, 'Save 1099-R')
      ) : (
        !editingId && <AddButton onClick={startAdd}>Add 1099-R</AddButton>
      )}

      <StepNavigation />
    </div>
  );
}
