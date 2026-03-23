import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import EINInput from '../common/EINInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { FileSpreadsheet, Pencil, Trash2 } from 'lucide-react';
import WhatsNewCard from '../common/WhatsNewCard';
import AddButton from '../common/AddButton';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';

const EMPTY_K1 = {
  entityName: '',
  entityEin: '',
  entityType: 'partnership' as 'partnership' | 's_corp',
  ordinaryBusinessIncome: 0,
  rentalIncome: 0,
  guaranteedPayments: 0,
  interestIncome: 0,
  ordinaryDividends: 0,
  qualifiedDividends: 0,
  royalties: 0,
  shortTermCapitalGain: 0,
  longTermCapitalGain: 0,
  netSection1231Gain: 0,
  otherIncome: 0,
  section199AQBI: 0,
  selfEmploymentIncome: 0,
  federalTaxWithheld: 0,
  box13CharitableCash: 0,
  box13CharitableNonCash: 0,
  box13InvestmentInterestExpense: 0,
  box131231Loss: 0,
  box13OtherDeductions: 0,
  box15ForeignTaxPaid: 0,
  box15ForeignCountry: '',
  box15OtherCredits: 0,
  isPassiveActivity: false,
  isLimitedPartner: false,
  priorYearUnallowedLoss: 0,
  disposedDuringYear: false,
  dispositionGainLoss: 0,
  isCooperativePatronage: false,
};

export default function K1Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('k1_income');

  const help = HELP_CONTENT['k1_income'];

  const items = taxReturn.incomeK1 || [];

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_K1 });

  const cancelForm = () => {
    setForm({ ...EMPTY_K1 });
    setAdding(false);
    setEditingId(null);
  };

  const startEdit = (item: typeof items[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      entityName: item.entityName,
      entityEin: item.entityEin || '',
      entityType: (item.entityType === 'partnership' || item.entityType === 's_corp') ? item.entityType : 'partnership',
      ordinaryBusinessIncome: item.ordinaryBusinessIncome || 0,
      rentalIncome: item.rentalIncome || 0,
      guaranteedPayments: item.guaranteedPayments || 0,
      interestIncome: item.interestIncome || 0,
      ordinaryDividends: item.ordinaryDividends || 0,
      qualifiedDividends: item.qualifiedDividends || 0,
      royalties: item.royalties || 0,
      shortTermCapitalGain: item.shortTermCapitalGain || 0,
      longTermCapitalGain: item.longTermCapitalGain || 0,
      netSection1231Gain: item.netSection1231Gain || 0,
      otherIncome: item.otherIncome || 0,
      section199AQBI: item.section199AQBI || 0,
      selfEmploymentIncome: item.selfEmploymentIncome || 0,
      federalTaxWithheld: item.federalTaxWithheld || 0,
      box13CharitableCash: item.box13CharitableCash || 0,
      box13CharitableNonCash: item.box13CharitableNonCash || 0,
      box13InvestmentInterestExpense: item.box13InvestmentInterestExpense || 0,
      box131231Loss: item.box131231Loss || 0,
      box13OtherDeductions: item.box13OtherDeductions || 0,
      box15ForeignTaxPaid: item.box15ForeignTaxPaid || 0,
      box15ForeignCountry: item.box15ForeignCountry || '',
      box15OtherCredits: item.box15OtherCredits || 0,
      isPassiveActivity: item.isPassiveActivity || false,
      isLimitedPartner: item.isLimitedPartner || false,
      priorYearUnallowedLoss: item.priorYearUnallowedLoss || 0,
      disposedDuringYear: item.disposedDuringYear || false,
      dispositionGainLoss: item.dispositionGainLoss || 0,
      isCooperativePatronage: item.isCooperativePatronage || false,
    });
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, 'k1', form);
    updateField('incomeK1', [...items, { id: result.id, ...form }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, 'k1', editingId, form);
    updateField('incomeK1', items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'incomeK1',
      item: item as any,
      label: `K-1${item.entityName ? ` from ${item.entityName}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Entity Name" tooltip={help?.fields['Entity Name']?.tooltip} irsRef={help?.fields['Entity Name']?.irsRef}>
        <input className="input-field" value={form.entityName} onChange={(e) => setForm({ ...form, entityName: e.target.value })} placeholder="Business name from K-1" />
      </FormField>
      <FormField label="Entity EIN" tooltip={help?.fields['Entity EIN']?.tooltip} irsRef={help?.fields['Entity EIN']?.irsRef} optional>
        <EINInput value={form.entityEin} onChange={(v) => setForm({ ...form, entityEin: v })} />
      </FormField>
      <FormField label="Entity Type" tooltip={help?.fields['Entity Type']?.tooltip}>
        <select className="input-field" value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value as 'partnership' | 's_corp' })}>
          <option value="partnership">Partnership (Form 1065)</option>
          <option value="s_corp">S-Corporation (Form 1120-S)</option>
        </select>
      </FormField>
      <FormField label="Ordinary Business Income (Box 1)" tooltip={help?.fields['Ordinary Business Income (Box 1)']?.tooltip} irsRef={help?.fields['Ordinary Business Income (Box 1)']?.irsRef}>
        <CurrencyInput value={form.ordinaryBusinessIncome} onChange={(v) => setForm({ ...form, ordinaryBusinessIncome: v })} />
      </FormField>
      <FormField label="Guaranteed Payments (Box 4)" optional>
        <CurrencyInput value={form.guaranteedPayments} onChange={(v) => setForm({ ...form, guaranteedPayments: v })} />
      </FormField>
      <FormField label="Interest Income (Box 5)" optional>
        <CurrencyInput value={form.interestIncome} onChange={(v) => setForm({ ...form, interestIncome: v })} />
      </FormField>
      <FormField label="Ordinary Dividends (Box 6a)" optional>
        <CurrencyInput value={form.ordinaryDividends} onChange={(v) => setForm({ ...form, ordinaryDividends: v })} />
      </FormField>
      <FormField label="Qualified Dividends (Box 6b)" optional>
        <CurrencyInput value={form.qualifiedDividends} onChange={(v) => setForm({ ...form, qualifiedDividends: v })} />
      </FormField>
      <FormField label="Short-Term Capital Gain (Box 8)" optional>
        <CurrencyInput value={form.shortTermCapitalGain} onChange={(v) => setForm({ ...form, shortTermCapitalGain: v })} />
      </FormField>
      <FormField label="Long-Term Capital Gain (Box 9a)" optional>
        <CurrencyInput value={form.longTermCapitalGain} onChange={(v) => setForm({ ...form, longTermCapitalGain: v })} />
      </FormField>
      <FormField label="Net Section 1231 Gain (Box 10)" optional>
        <CurrencyInput value={form.netSection1231Gain} onChange={(v) => setForm({ ...form, netSection1231Gain: v })} />
      </FormField>
      <FormField label="Section 199A QBI (Box 17, Code V)" optional>
        <CurrencyInput value={form.section199AQBI} onChange={(v) => setForm({ ...form, section199AQBI: v })} />
      </FormField>
      <FormField label="Self-Employment Income (Box 14, Code A)" optional>
        <CurrencyInput value={form.selfEmploymentIncome} onChange={(v) => setForm({ ...form, selfEmploymentIncome: v })} />
      </FormField>

      <label className="flex items-start gap-3 cursor-pointer group mb-3">
        <input
          type="checkbox"
          checked={!!form.isCooperativePatronage}
          onChange={(e) => setForm({ ...form, isCooperativePatronage: e.target.checked })}
          className="mt-1 rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500"
        />
        <div>
          <span className="text-sm text-slate-200 group-hover:text-white">
            Cooperative patronage income (Subchapter T)
          </span>
          <p className="text-xs text-slate-500 mt-0.5">
            This income is not subject to self-employment tax.
          </p>
        </div>
      </label>

      <FormField label="Federal Tax Withheld" optional>
        <CurrencyInput value={form.federalTaxWithheld} onChange={(v) => setForm({ ...form, federalTaxWithheld: v })} />
      </FormField>

      <div className="mt-6 mb-3 text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">
        Box 13 — Partner Deductions
      </div>
      <FormField label="Charitable Cash (Box 13 Code A)" tooltip={help?.fields['Charitable Cash (Box 13 Code A)']?.tooltip} irsRef={help?.fields['Charitable Cash (Box 13 Code A)']?.irsRef} optional>
        <CurrencyInput value={form.box13CharitableCash} onChange={(v) => setForm({ ...form, box13CharitableCash: v })} />
      </FormField>
      <FormField label="Charitable Non-Cash (Box 13 Code B-F)" tooltip={help?.fields['Charitable Non-Cash (Box 13 Code B-F)']?.tooltip} irsRef={help?.fields['Charitable Non-Cash (Box 13 Code B-F)']?.irsRef} optional>
        <CurrencyInput value={form.box13CharitableNonCash} onChange={(v) => setForm({ ...form, box13CharitableNonCash: v })} />
      </FormField>
      <FormField label="Investment Interest Expense (Box 13 Code H)" tooltip={help?.fields['Investment Interest Expense (Box 13 Code H)']?.tooltip} irsRef={help?.fields['Investment Interest Expense (Box 13 Code H)']?.irsRef} optional>
        <CurrencyInput value={form.box13InvestmentInterestExpense} onChange={(v) => setForm({ ...form, box13InvestmentInterestExpense: v })} />
      </FormField>
      <FormField label="Section 1231 Loss (Box 13 Code K)" tooltip={help?.fields['Section 1231 Loss (Box 13 Code K)']?.tooltip} irsRef={help?.fields['Section 1231 Loss (Box 13 Code K)']?.irsRef} optional>
        <CurrencyInput value={form.box131231Loss} onChange={(v) => setForm({ ...form, box131231Loss: v })} />
      </FormField>
      <FormField label="Other Deductions (Box 13 Codes I-L)" tooltip={help?.fields['Other Deductions (Box 13 Codes I-L)']?.tooltip} irsRef={help?.fields['Other Deductions (Box 13 Codes I-L)']?.irsRef} optional>
        <CurrencyInput value={form.box13OtherDeductions} onChange={(v) => setForm({ ...form, box13OtherDeductions: v })} />
      </FormField>

      <div className="mt-6 mb-3 text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">
        Box 15 — Partner Credits
      </div>
      <FormField label="Foreign Tax Paid (Box 15 Code L)" tooltip={help?.fields['Foreign Tax Paid (Box 15 Code L)']?.tooltip} irsRef={help?.fields['Foreign Tax Paid (Box 15 Code L)']?.irsRef} optional>
        <CurrencyInput value={form.box15ForeignTaxPaid} onChange={(v) => setForm({ ...form, box15ForeignTaxPaid: v })} />
      </FormField>
      <FormField label="Foreign Country" tooltip={help?.fields['Foreign Country']?.tooltip} optional>
        <input className="input-field" value={form.box15ForeignCountry} onChange={(e) => setForm({ ...form, box15ForeignCountry: e.target.value })} placeholder="Country name" />
      </FormField>
      <FormField label="Other Credits (Box 15)" tooltip={help?.fields['Other Credits (Box 15)']?.tooltip} irsRef={help?.fields['Other Credits (Box 15)']?.irsRef} optional>
        <CurrencyInput value={form.box15OtherCredits} onChange={(v) => setForm({ ...form, box15OtherCredits: v })} />
      </FormField>

      {/* Form 8582: Passive Activity fields */}
      <div className="mt-6 mb-3 text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">
        Form 8582 — Passive Activity
      </div>

      <label className="flex items-start gap-3 cursor-pointer group mb-3">
        <input
          type="checkbox"
          checked={!!form.isPassiveActivity}
          onChange={(e) => setForm({ ...form, isPassiveActivity: e.target.checked })}
          className="mt-1 rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500"
        />
        <div>
          <span className="text-sm text-slate-200 group-hover:text-white">
            This K-1 income is from a passive activity
          </span>
          <p className="text-xs text-slate-500 mt-0.5">
            Check this if you did not materially participate in the entity's business.
            Rental income from K-1s is generally passive by default. IRC §469(c).
          </p>
        </div>
      </label>

      {form.isPassiveActivity && (
        <label className="flex items-start gap-3 cursor-pointer group mb-3 ml-6">
          <input
            type="checkbox"
            checked={!!form.isLimitedPartner}
            onChange={(e) => setForm({ ...form, isLimitedPartner: e.target.checked })}
            className="mt-1 rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500"
          />
          <div>
            <span className="text-sm text-slate-200 group-hover:text-white">
              Limited partner
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Excluded from the $25,000 rental real estate active participation allowance.
            </p>
          </div>
        </label>
      )}

      {form.isPassiveActivity && (
        <div className="ml-6">
          <FormField label="Prior-Year Unallowed Loss" optional tooltip="Suspended passive loss from prior years for this K-1 activity." irsRef="Form 8582, Line 1c/3c">
            <CurrencyInput
              value={form.priorYearUnallowedLoss}
              onChange={(v) => setForm({ ...form, priorYearUnallowedLoss: v })}
              allowNegative
            />
          </FormField>
        </div>
      )}

      <label className="flex items-start gap-3 cursor-pointer group mb-3">
        <input
          type="checkbox"
          checked={!!form.disposedDuringYear}
          onChange={(e) => setForm({ ...form, disposedDuringYear: e.target.checked })}
          className="mt-1 rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500"
        />
        <div>
          <span className="text-sm text-slate-200 group-hover:text-white">
            Disposed of this K-1 interest during the year
          </span>
          <p className="text-xs text-slate-500 mt-0.5">
            Fully disposing of your interest releases all suspended passive losses. IRC §469(g)(1).
          </p>
        </div>
      </label>

      {form.disposedDuringYear && (
        <FormField label="Gain/Loss on Disposition" optional tooltip="Gain or loss recognized on sale of your partnership or S-corp interest. Use a negative number for a loss." irsRef="IRC §469(g); Form 4797">
          <CurrencyInput
            value={form.dispositionGainLoss}
            onChange={(v) => setForm({ ...form, dispositionGainLoss: v })}
            allowNegative
          />
        </FormField>
      )}

      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.entityName} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="k1_income" />
      <SectionIntro
        icon={<FileSpreadsheet className="w-8 h-8" />}
        title="Schedule K-1 Income"
        description="Enter each Schedule K-1 from partnerships or S-Corporations you received."
      />

      <WhatsNewCard items={[
        { title: 'QBI Deduction Thresholds Increased', description: 'The §199A qualified business income deduction thresholds are now $197,300 (Single/HoH) and $394,600 (MFJ), up from $191,950/$383,900 in 2024 (Rev. Proc. 2024-40 §3.29).' },
        { title: 'Below-Threshold Advantage', description: 'If your taxable income is below these thresholds, you qualify for the full 20% QBI deduction on pass-through income regardless of whether the business is a specified service trade or business (SSTB).' },
      ]} />

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
              <div className="font-medium">{item.entityName || 'Unknown Entity'}</div>
              <div className="text-sm text-slate-400">
                <span className="capitalize">{item.entityType === 's_corp' ? 'S-Corporation' : 'Partnership'}</span>
                {(item.ordinaryBusinessIncome || 0) > 0 && (
                  <span> &middot; Business Income: ${(item.ordinaryBusinessIncome || 0).toLocaleString()}</span>
                )}
                {(item.guaranteedPayments || 0) > 0 && (
                  <span> &middot; Guaranteed: ${(item.guaranteedPayments || 0).toLocaleString()}</span>
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
          renderForm(addItem, 'Save K-1')
        ) : (
          <AddButton onClick={() => setAdding(true)}>Add Schedule K-1</AddButton>
        )
      )}

      <StepNavigation />
    </div>
  );
}
