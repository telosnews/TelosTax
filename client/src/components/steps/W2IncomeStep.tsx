import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import EINInput from '../common/EINInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import { Building2, Trash2, Pencil, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import AddButton from '../common/AddButton';
import { W2Income, W2Box12Entry, W2Box12Code, W2Box13, getAllStates, FilingStatus } from '@telostax/engine';
import { HELP_CONTENT } from '../../data/helpContent';
import InlineImportButton from '../import/InlineImportButton';
import InlinePDFImport from '../import/InlinePDFImport';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import StepWarningsBanner from '../common/StepWarningsBanner';
import WhatsNewCard from '../common/WhatsNewCard';

// Box 12 code labels for the dropdown
const BOX12_CODES: { code: W2Box12Code; label: string }[] = [
  { code: 'A', label: 'A — Uncollected SS tax on tips' },
  { code: 'B', label: 'B — Uncollected Medicare tax on tips' },
  { code: 'C', label: 'C — Group-term life insurance >$50k' },
  { code: 'D', label: 'D — 401(k) deferrals' },
  { code: 'DD', label: 'DD — Employer health coverage cost' },
  { code: 'E', label: 'E — 403(b) deferrals' },
  { code: 'F', label: 'F — 408(k)(6) SEP deferrals' },
  { code: 'G', label: 'G — 457(b) deferrals' },
  { code: 'H', label: 'H — 501(c)(18)(D) deferrals' },
  { code: 'J', label: 'J — Nontaxable sick pay' },
  { code: 'K', label: 'K — Excess golden parachute excise tax' },
  { code: 'L', label: 'L — Employee business expense reimb.' },
  { code: 'M', label: 'M — Uncollected SS on group-term life' },
  { code: 'N', label: 'N — Uncollected Medicare on group-term life' },
  { code: 'P', label: 'P — Moving expense reimb. (military)' },
  { code: 'Q', label: 'Q — Nontaxable combat pay' },
  { code: 'R', label: 'R — Archer MSA employer contributions' },
  { code: 'S', label: 'S — SIMPLE 408(p) deferrals' },
  { code: 'T', label: 'T — Adoption benefits' },
  { code: 'V', label: 'V — Nonstatutory stock option income' },
  { code: 'W', label: 'W — HSA employer contributions' },
  { code: 'Y', label: 'Y — 409A deferrals' },
  { code: 'Z', label: 'Z — 409A income' },
  { code: 'AA', label: 'AA — Roth 401(k) contributions' },
  { code: 'BB', label: 'BB — Roth 403(b) contributions' },
  { code: 'EE', label: 'EE — Roth 457(b) contributions' },
  { code: 'FF', label: 'FF — Qualified small employer HRA' },
  { code: 'GG', label: 'GG — Qualified equity grant income' },
  { code: 'HH', label: 'HH — Aggregate 83(i) deferrals' },
  { code: 'II', label: 'II — Medicaid waiver payments' },
];

const emptyBox12Entry: W2Box12Entry = { code: 'D', amount: 0 };

const emptyW2 = {
  employerName: '',
  employerEin: '',
  wages: 0,
  federalTaxWithheld: 0,
  socialSecurityWages: 0,
  socialSecurityTax: 0,
  medicareWages: 0,
  medicareTax: 0,
  stateTaxWithheld: 0,
  stateWages: 0,
  state: '',
  box12: [] as W2Box12Entry[],
  box13: { statutoryEmployee: false, retirementPlan: false, thirdPartySickPay: false } as W2Box13,
  isSpouse: false,
};

const stateOptions = getAllStates().map((s) => ({ code: s.code, name: s.name }));

export default function W2IncomeStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('w2_income');

  const help = HELP_CONTENT['w2_income'];

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyW2);
  const [importing, setImporting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyW2);
    setAdding(true);
  };

  const startEdit = (item: W2Income) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      employerName: item.employerName,
      employerEin: item.employerEin || '',
      wages: item.wages,
      federalTaxWithheld: item.federalTaxWithheld,
      socialSecurityWages: item.socialSecurityWages || 0,
      socialSecurityTax: item.socialSecurityTax || 0,
      medicareWages: item.medicareWages || 0,
      medicareTax: item.medicareTax || 0,
      stateTaxWithheld: item.stateTaxWithheld || 0,
      stateWages: item.stateWages || 0,
      state: item.state || '',
      box12: item.box12 || [],
      box13: item.box13 || { statutoryEmployee: false, retirementPlan: false, thirdPartySickPay: false },
      isSpouse: item.isSpouse || false,
    });
    // Auto-expand details section if any additional fields have data
    const hasDetails = item.employerEin || item.socialSecurityWages || item.socialSecurityTax
      || item.medicareWages || item.medicareTax || item.stateWages
      || (item.box12 && item.box12.length > 0)
      || (item.box13 && (item.box13.statutoryEmployee || item.box13.retirementPlan || item.box13.thirdPartySickPay));
    if (hasDetails) {
      setShowDetails(true);
    }
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setForm(emptyW2);
  };

  const addW2 = async () => {
    const result = await addIncomeItem(returnId, 'w2', form);
    const newItem: W2Income = { id: result.id, ...form, federalTaxWithheld: form.federalTaxWithheld };
    updateField('w2Income', [...taxReturn.w2Income, newItem]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, 'w2', editingId, form);
    updateField(
      'w2Income',
      taxReturn.w2Income.map((w) =>
        w.id === editingId ? { ...w, ...form } : w,
      ),
    );
    cancelForm();
  };

  const removeW2 = (itemId: string) => {
    const item = taxReturn.w2Income.find((w) => w.id === itemId);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'w2Income',
      item: item as any,
      label: `W-2${item.employerName ? ` from ${item.employerName}` : ''}`,
      onCleanup: editingId === itemId ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Employer Name" tooltip={help?.fields['Employer Name']?.tooltip} irsRef={help?.fields['Employer Name']?.irsRef}>
        <input className="input-field" value={form.employerName} onChange={(e) => setForm({ ...form, employerName: e.target.value })} placeholder="Company Inc." />
      </FormField>
      <FormField label="Wages (Box 1)" tooltip="This is your total taxable wages from Box 1 of your W-2. It includes salary, bonuses, and tips." irsRef={help?.fields['Wages (Box 1)']?.irsRef}>
        <CurrencyInput value={form.wages} onChange={(v) => setForm({ ...form, wages: v })} />
      </FormField>
      <FormField label="Federal Tax Withheld (Box 2)" tooltip="The total federal income tax your employer withheld from your paychecks during the year." irsRef={help?.fields['Federal Tax Withheld (Box 2)']?.irsRef}>
        <CurrencyInput value={form.federalTaxWithheld} onChange={(v) => setForm({ ...form, federalTaxWithheld: v })} />
      </FormField>
      <FormField label="State (Box 15)" optional tooltip="The state listed on your W-2 for state tax withholding.">
        <select
          className="input-field w-48"
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
        >
          <option value="">Select state</option>
          {stateOptions.map((s) => (
            <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
          ))}
        </select>
      </FormField>
      <FormField label="State Tax Withheld (Box 17)" optional tooltip="State income tax withheld. This may be deductible if you itemize (subject to the $10,000 SALT cap)." irsRef={help?.fields['State Tax Withheld (Box 17)']?.irsRef}>
        <CurrencyInput value={form.stateTaxWithheld} onChange={(v) => setForm({ ...form, stateTaxWithheld: v })} />
      </FormField>

      {taxReturn.filingStatus === FilingStatus.MarriedFilingJointly && (
        <FormField label="Whose W-2 is this?" tooltip="Indicate whether this W-2 belongs to the taxpayer or the spouse. This is used for per-person Social Security wage cap calculations.">
          <div className="flex gap-3">
            <button
              type="button"
              className={`py-1.5 px-4 rounded text-sm ${!form.isSpouse ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`}
              onClick={() => setForm({ ...form, isSpouse: false })}
            >
              Taxpayer
            </button>
            <button
              type="button"
              className={`py-1.5 px-4 rounded text-sm ${form.isSpouse ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`}
              onClick={() => setForm({ ...form, isSpouse: true })}
            >
              Spouse
            </button>
          </div>
        </FormField>
      )}

      {/* Collapsible additional W-2 details */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between text-left mt-4 py-2 border-t border-slate-700/50"
      >
        <span className="text-sm text-slate-400">Additional W-2 Details (Boxes 3–6, 12, 13, 16, EIN)</span>
        {showDetails
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />
        }
      </button>
      {showDetails && (
        <div className="space-y-0 mt-2">
          <FormField label="Employer EIN (Box b)" optional tooltip="Your employer's Employer Identification Number, found in Box b of your W-2." irsRef="Form W-2, Box b">
            <EINInput className="w-48" value={form.employerEin} onChange={(v) => setForm({ ...form, employerEin: v })} />
          </FormField>
          <FormField label="Social Security Wages (Box 3)" optional tooltip="Wages subject to Social Security tax. This may differ from Box 1 due to pre-tax deductions that are not exempt from Social Security." irsRef="Form W-2, Box 3">
            <CurrencyInput value={form.socialSecurityWages} onChange={(v) => setForm({ ...form, socialSecurityWages: v })} />
          </FormField>
          <FormField label="Social Security Tax Withheld (Box 4)" optional tooltip="The Social Security tax withheld from your pay (6.2% of Box 3, up to the wage base limit). Used to calculate any excess Social Security tax credit if you have multiple employers." irsRef="Form W-2, Box 4">
            <CurrencyInput value={form.socialSecurityTax} onChange={(v) => setForm({ ...form, socialSecurityTax: v })} />
          </FormField>
          <FormField label="Medicare Wages (Box 5)" optional tooltip="Wages subject to Medicare tax. Usually the same as or higher than Box 1 since most pre-tax deductions are still subject to Medicare." irsRef="Form W-2, Box 5">
            <CurrencyInput value={form.medicareWages} onChange={(v) => setForm({ ...form, medicareWages: v })} />
          </FormField>
          <FormField label="Medicare Tax Withheld (Box 6)" optional tooltip="The Medicare tax withheld from your pay (1.45% of Box 5). Used to calculate the Additional Medicare Tax credit on Form 8959." irsRef="Form W-2, Box 6">
            <CurrencyInput value={form.medicareTax} onChange={(v) => setForm({ ...form, medicareTax: v })} />
          </FormField>
          <FormField label="State Wages (Box 16)" optional tooltip="Wages subject to state income tax. May differ from Box 1 if you worked in multiple states or have state-specific adjustments." irsRef="Form W-2, Box 16">
            <CurrencyInput value={form.stateWages} onChange={(v) => setForm({ ...form, stateWages: v })} />
          </FormField>

          {/* Box 13 Checkboxes */}
          <div className="mt-4 border-t border-slate-700/30 pt-3">
            <div className="text-sm font-medium text-slate-300 mb-2">Box 13</div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.box13.statutoryEmployee || false}
                  onChange={(e) => setForm({ ...form, box13: { ...form.box13, statutoryEmployee: e.target.checked } })}
                  className="rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500"
                />
                Statutory employee
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.box13.retirementPlan || false}
                  onChange={(e) => setForm({ ...form, box13: { ...form.box13, retirementPlan: e.target.checked } })}
                  className="rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500"
                />
                Retirement plan
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.box13.thirdPartySickPay || false}
                  onChange={(e) => setForm({ ...form, box13: { ...form.box13, thirdPartySickPay: e.target.checked } })}
                  className="rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500"
                />
                Third-party sick pay
              </label>
            </div>
          </div>

          {/* Box 12 Repeater */}
          <div className="mt-4 border-t border-slate-700/30 pt-3">
            <div className="text-sm font-medium text-slate-300 mb-2">Box 12 (up to 4 entries)</div>
            {form.box12.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <select
                  className="input-field w-64 text-sm"
                  value={entry.code}
                  onChange={(e) => {
                    const updated = [...form.box12];
                    updated[i] = { ...entry, code: e.target.value as W2Box12Code };
                    setForm({ ...form, box12: updated });
                  }}
                >
                  {BOX12_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <CurrencyInput
                  value={entry.amount}
                  onChange={(v) => {
                    const updated = [...form.box12];
                    updated[i] = { ...entry, amount: v };
                    setForm({ ...form, box12: updated });
                  }}
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, box12: form.box12.filter((_, j) => j !== i) })}
                  className="p-1.5 text-slate-400 hover:text-red-400"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {form.box12.length < 4 && (
              <button
                type="button"
                onClick={() => setForm({ ...form, box12: [...form.box12, { ...emptyBox12Entry }] })}
                className="flex items-center gap-1 text-sm text-telos-blue-400 hover:text-telos-blue-300 mt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Box 12 entry
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.employerName} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="w2_income" />

      <SectionIntro
        icon={<Building2 className="w-8 h-8" />}
        title="W-2 Wage Income"
        description="Enter your W-2 information from each employer."
      />

      <WhatsNewCard items={[
        { title: 'Social Security Wage Base: $176,100', description: 'Up from $168,600 in 2024. The 6.2% employee SS tax applies to wages up to this amount. Your W-2 Box 3 should not exceed this.' },
      ]} />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Inline PDF import */}
      {importing ? (
        <InlinePDFImport
          expectedFormType="W-2"
          onClose={() => setImporting(false)}
        />
      ) : (
        <InlineImportButton importType="pdf" formLabel="W-2" onClick={() => setImporting(true)} />
      )}

      {taxReturn.w2Income.length > 0 && (
        <div className="space-y-3 mt-6">
          {taxReturn.w2Income.map((w2, idx) =>
            editingId === w2.id ? (
              <div key={w2.id}>{renderForm(saveEdit, 'Save Changes')}</div>
            ) : (
              <div
                key={w2.id}
                className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => startEdit(w2)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(w2); } }}
              >
                <div>
                  <div className="font-medium">{w2.employerName || 'Unnamed Employer'}{w2.isSpouse && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-telos-blue-600/20 text-telos-blue-400 border border-telos-blue-500/30">Spouse</span>}{w2.employerEin ? <span className="text-xs text-slate-500 ml-2">EIN: {w2.employerEin}</span> : ''}</div>
                  <div className="text-sm text-slate-400">
                    Wages: ${(w2.wages ?? 0).toLocaleString()} &middot; Federal withheld: ${(w2.federalTaxWithheld ?? 0).toLocaleString()}
                    {w2.stateTaxWithheld ? ` · ${w2.state || '??'} withheld: $${w2.stateTaxWithheld.toLocaleString()}` : ''}
                  </div>
                  {(w2.socialSecurityWages || w2.medicareWages) && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {w2.socialSecurityWages ? `SS wages: $${w2.socialSecurityWages.toLocaleString()}` : ''}
                      {w2.socialSecurityWages && w2.medicareWages ? ' · ' : ''}
                      {w2.medicareWages ? `Medicare wages: $${w2.medicareWages.toLocaleString()}` : ''}
                    </div>
                  )}
                  {w2.box12 && w2.box12.length > 0 && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      Box 12: {w2.box12.map(e => `${e.code}=$${e.amount.toLocaleString()}`).join(', ')}
                    </div>
                  )}
                  {w2.box13 && (w2.box13.retirementPlan || w2.box13.statutoryEmployee) && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {[
                        w2.box13.retirementPlan && 'Retirement plan',
                        w2.box13.statutoryEmployee && 'Statutory employee',
                      ].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <ItemWarningBadge warnings={itemWarnings.get(idx)} />
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(w2); }}
                    className="p-2 text-slate-400 hover:text-telos-blue-400"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeW2(w2.id); }}
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
        renderForm(addW2, 'Save W-2')
      ) : (
        !editingId && (
          <AddButton onClick={startAdd}>Add W-2</AddButton>
        )
      )}

      <StepNavigation />
    </div>
  );
}
