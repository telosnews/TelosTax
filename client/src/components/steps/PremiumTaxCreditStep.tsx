import { useState, useMemo, useEffect } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertPremiumTaxCredit } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import AddButton from '../common/AddButton';
import { HeartHandshake, Trash2, Pencil, FileText } from 'lucide-react';
import CalloutCard from '../common/CalloutCard';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import WhatsNewCard from '../common/WhatsNewCard';
import { HELP_CONTENT } from '../../data/helpContent';
import { FilingStatus } from '@telostax/engine';
import type { PremiumTaxCreditInfo, Form1095AInfo } from '@telostax/engine';
import StepWarningsBanner from '../common/StepWarningsBanner';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EMPTY_1095A: Omit<Form1095AInfo, 'id'> = {
  marketplace: '',
  policyNumber: '',
  enrollmentPremiums: Array(12).fill(0),
  slcspPremiums: Array(12).fill(0),
  advancePTC: Array(12).fill(0),
  coverageMonths: Array(12).fill(true),
};

export default function PremiumTaxCreditStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['premium_tax_credit'];

  const info: PremiumTaxCreditInfo = taxReturn.premiumTaxCredit || {
    forms1095A: [],
    familySize: 1,
  };
  const itemWarnings = useItemWarnings('premium_tax_credit');

  // Auto-calculate family size: 1 (self) + 1 (spouse if MFJ) + dependents
  const derivedFamilySize = useMemo(() => {
    const isMFJ = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly;
    return 1 + (isMFJ ? 1 : 0) + (taxReturn.dependents || []).length;
  }, [taxReturn.filingStatus, taxReturn.dependents]);

  // Auto-sync family size
  useEffect(() => {
    if ((info.familySize || 1) !== derivedFamilySize) {
      updateGeneralField('familySize', derivedFamilySize);
    }
  }, [derivedFamilySize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate FPL state from addressState when not yet set
  useEffect(() => {
    if (info.state === undefined && taxReturn.addressState) {
      const mapped = (taxReturn.addressState === 'AK' || taxReturn.addressState === 'HI') ? taxReturn.addressState : '';
      updateGeneralField('state', mapped);
    }
  }, [taxReturn.addressState]); // eslint-disable-line react-hooks/exhaustive-deps

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Form1095AInfo, 'id'>>({ ...EMPTY_1095A });
  const [useAnnual, setUseAnnual] = useState(true);

  const cancelForm = () => {
    setForm({ ...EMPTY_1095A, enrollmentPremiums: [...EMPTY_1095A.enrollmentPremiums], slcspPremiums: [...EMPTY_1095A.slcspPremiums], advancePTC: [...EMPTY_1095A.advancePTC], coverageMonths: [...EMPTY_1095A.coverageMonths] });
    setAdding(false);
    setEditingId(null);
    setUseAnnual(true);
  };

  const startEdit = (item: Form1095AInfo) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      marketplace: item.marketplace,
      policyNumber: item.policyNumber,
      enrollmentPremiums: [...item.enrollmentPremiums],
      slcspPremiums: [...item.slcspPremiums],
      advancePTC: [...item.advancePTC],
      coverageMonths: [...item.coverageMonths],
    });
    // Check if all months are the same (annual entry)
    const ep = item.enrollmentPremiums;
    const sp = item.slcspPremiums;
    const ap = item.advancePTC;
    const allSame = ep.every(v => v === ep[0]) && sp.every(v => v === sp[0]) && ap.every(v => v === ap[0]);
    setUseAnnual(allSame);
  };

  const persistForms = (newForms: Form1095AInfo[]) => {
    const updated = { ...info, forms1095A: newForms };
    updateField('premiumTaxCredit', updated);
  };

  const addItem = () => {
    const newItem: Form1095AInfo = { id: crypto.randomUUID(), ...form };
    persistForms([...info.forms1095A, newItem]);
    cancelForm();
  };

  const saveEdit = () => {
    if (!editingId) return;
    persistForms(info.forms1095A.map((f) => f.id === editingId ? { ...f, ...form } : f));
    cancelForm();
  };

  const removeItem = (id: string) => {
    persistForms(info.forms1095A.filter((f) => f.id !== id));
    if (editingId === id) cancelForm();
  };

  const updateMonthlyValue = (field: 'enrollmentPremiums' | 'slcspPremiums' | 'advancePTC', monthIdx: number, value: number) => {
    const arr = [...form[field]];
    arr[monthIdx] = value;
    setForm({ ...form, [field]: arr });
  };

  const updateAnnualValue = (field: 'enrollmentPremiums' | 'slcspPremiums' | 'advancePTC', value: number) => {
    setForm({ ...form, [field]: Array(12).fill(value) });
  };

  const updateGeneralField = (field: string, value: unknown) => {
    const updated = { ...info, [field]: value };
    updateField('premiumTaxCredit', updated);
  };

  const save = async () => {
    await upsertPremiumTaxCredit(returnId, { ...info });
  };

  // Summary
  const totalAPTC = info.forms1095A.reduce((sum, f) => sum + f.advancePTC.reduce((a, b) => a + b, 0), 0);

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Marketplace" tooltip="The name of the Health Insurance Marketplace (e.g., Healthcare.gov, Covered California)." optional>
        <input className="input-field" value={form.marketplace} onChange={(e) => setForm({ ...form, marketplace: e.target.value })} placeholder="e.g. Healthcare.gov" />
      </FormField>
      <FormField label="Policy Number" tooltip="The policy number from your Form 1095-A." optional>
        <input className="input-field" value={form.policyNumber || ''} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} placeholder="Optional" />
      </FormField>

      {/* Annual vs Monthly toggle */}
      <div className="flex gap-2 mb-4">
        <button className={`py-1.5 px-3 rounded text-sm ${useAnnual ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => setUseAnnual(true)}>Same Every Month</button>
        <button className={`py-1.5 px-3 rounded text-sm ${!useAnnual ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => setUseAnnual(false)}>Enter Monthly</button>
      </div>

      {useAnnual ? (
        <div className="space-y-3">
          <FormField label="Monthly Enrollment Premium (Column A)" tooltip="The total monthly premium for your plan from Form 1095-A, Column A." irsRef={help?.fields['Enrollment Premium']?.irsRef}>
            <CurrencyInput value={form.enrollmentPremiums[0]} onChange={(v) => updateAnnualValue('enrollmentPremiums', v)} />
          </FormField>
          <FormField label="Monthly SLCSP Premium (Column B)" tooltip="The second lowest cost Silver plan premium from Form 1095-A, Column B." irsRef={help?.fields['SLCSP Premium']?.irsRef}>
            <CurrencyInput value={form.slcspPremiums[0]} onChange={(v) => updateAnnualValue('slcspPremiums', v)} />
          </FormField>
          <FormField label="Monthly Advance PTC (Column C)" tooltip="The advance premium tax credit paid on your behalf from Form 1095-A, Column C." irsRef={help?.fields['Advance PTC']?.irsRef}>
            <CurrencyInput value={form.advancePTC[0]} onChange={(v) => updateAnnualValue('advancePTC', v)} />
          </FormField>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left py-1 pr-2">Month</th>
                <th className="text-right py-1 px-1">Premium (A)</th>
                <th className="text-right py-1 px-1">SLCSP (B)</th>
                <th className="text-right py-1 px-1">APTC (C)</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((month, idx) => (
                <tr key={month} className="border-t border-slate-700/50">
                  <td className="py-1 pr-2 text-slate-400">{month}</td>
                  <td className="py-1 px-1"><input type="number" className="input-field text-right text-xs py-1" value={form.enrollmentPremiums[idx] || ''} onChange={(e) => updateMonthlyValue('enrollmentPremiums', idx, parseFloat(e.target.value) || 0)} /></td>
                  <td className="py-1 px-1"><input type="number" className="input-field text-right text-xs py-1" value={form.slcspPremiums[idx] || ''} onChange={(e) => updateMonthlyValue('slcspPremiums', idx, parseFloat(e.target.value) || 0)} /></td>
                  <td className="py-1 px-1"><input type="number" className="input-field text-right text-xs py-1" value={form.advancePTC[idx] || ''} onChange={(e) => updateMonthlyValue('advancePTC', idx, parseFloat(e.target.value) || 0)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-3 mt-4">
        <button onClick={onSave} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="premium_tax_credit" />

      <SectionIntro
        icon={<HeartHandshake className="w-8 h-8" />}
        title="Premium Tax Credit"
        description="If you purchased health insurance through a Marketplace (Healthcare.gov), enter your Form 1095-A information to reconcile your premium tax credit."
      />

      <WhatsNewCard items={[
        { title: 'Enhanced ACA Subsidies — Final Year', description: 'The Inflation Reduction Act (IRA §12001) extended the enhanced premium tax credit rates through 2025. There is no "subsidy cliff" at 400% FPL — households above 400% pay no more than 8.5% of income toward premiums.' },
        { title: 'Updated Applicable Percentage Table', description: 'The 2025 applicable figure table (Rev. Proc. 2024-35) sets contribution percentages: 150–200% FPL pays 0–2%, 200–250% pays 2–4%, 250–300% pays 4–6%, 300–400% pays 6–8.5% of household income.' },
        { title: 'Revised Repayment Caps', description: 'If you received more advance PTC than you qualified for, excess repayment is capped: under 200% FPL: $375/$750 (Single/Other), 200–300%: $975/$1,950, 300–400%: $1,625/$3,250 (Rev. Proc. 2024-40, Table 5).' },
      ]} />

      <CalloutCard variant="info" title="About the Premium Tax Credit" irsUrl="https://www.irs.gov/affordable-care-act/individuals-and-families/the-premium-tax-credit-the-basics">
        The premium tax credit is a refundable credit that helps eligible individuals and families
        cover the cost of health insurance purchased through the Marketplace. Your credit amount is
        based on household income as a percentage of the Federal Poverty Level. For 2025, the
        enhanced ARP/IRA rates remain in effect, eliminating the "subsidy cliff" at 400% FPL —
        households above that threshold pay no more than 8.5% of income toward premiums. If you
        received advance payments (APTC), you must file Form 8962 to reconcile the advance with
        your actual credit based on final income. Any excess APTC repayment is capped for
        households below 400% FPL.
      </CalloutCard>

      <div className="mt-6 space-y-4">
        <FormField label="Tax Family Size" tooltip="The number of people in your tax household (you, spouse if filing jointly, and dependents). This determines your Federal Poverty Level percentage.">
          <p className="text-xs text-telos-blue-400 mb-2">
            Auto-calculated: 1 (you){taxReturn.filingStatus === FilingStatus.MarriedFilingJointly ? ' + 1 (spouse)' : ''}{(taxReturn.dependents || []).length > 0 ? ` + ${(taxReturn.dependents || []).length} (dependents)` : ''} = {derivedFamilySize}
          </p>
          <input
            type="number"
            className="input-field w-24"
            min={1}
            max={20}
            value={info.familySize || 1}
            onChange={(e) => updateGeneralField('familySize', parseInt(e.target.value) || 1)}
          />
        </FormField>

        <FormField label="State for FPL Calculation" tooltip="Only Alaska and Hawaii affect the Federal Poverty Level table used for premium tax credit calculation.">
          <select
            className="input-field w-64"
            value={info.state ?? ''}
            onChange={(e) => updateGeneralField('state', e.target.value)}
          >
            <option value="">Continental US (default)</option>
            <option value="AK">Alaska</option>
            <option value="HI">Hawaii</option>
          </select>
          <p className="text-xs text-slate-400 mt-1">Only Alaska and Hawaii affect the Federal Poverty Level table used for premium tax credit calculation.</p>
        </FormField>

        {taxReturn.filingStatus === 3 && (
          <div className="space-y-2">
            <FormField label="Victim of domestic abuse?" tooltip="MFS filers can only claim PTC if they are victims of domestic abuse or spousal abandonment.">
              <div className="flex gap-3">
                <button className={`py-1.5 px-4 rounded text-sm ${info.isVictimOfDomesticAbuse ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => updateGeneralField('isVictimOfDomesticAbuse', true)}>Yes</button>
                <button className={`py-1.5 px-4 rounded text-sm ${!info.isVictimOfDomesticAbuse ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => updateGeneralField('isVictimOfDomesticAbuse', false)}>No</button>
              </div>
            </FormField>
            <FormField label="Spousal abandonment?" tooltip="You lived apart from your spouse for the entire tax year.">
              <div className="flex gap-3">
                <button className={`py-1.5 px-4 rounded text-sm ${info.isSpousalAbandonment ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => updateGeneralField('isSpousalAbandonment', true)}>Yes</button>
                <button className={`py-1.5 px-4 rounded text-sm ${!info.isSpousalAbandonment ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => updateGeneralField('isSpousalAbandonment', false)}>No</button>
              </div>
            </FormField>
          </div>
        )}

        <div className="flex items-center gap-3 mt-4 mb-1">
          <FileText className="w-5 h-5 text-telos-blue-400" />
          <h3 className="font-medium text-slate-200">Form 1095-A Entries</h3>
        </div>
        <p className="text-sm text-slate-400">Add each Form 1095-A you received from the Marketplace. Most people have one per policy.</p>

        {/* Existing 1095-A entries */}
        {info.forms1095A.map((item, idx) =>
          editingId === item.id ? (
            <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
          ) : (
            <div
              key={item.id}
              className={`card mt-3 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`}
              onClick={() => startEdit(item)}
            >
              <div>
                <div className="font-medium">{item.marketplace || 'Marketplace Policy'}</div>
                <div className="text-sm text-slate-400">
                  {item.policyNumber && <span>Policy: {item.policyNumber} &middot; </span>}
                  Annual premium: ${(item.enrollmentPremiums ?? []).reduce((a: number, b: number) => a + b, 0).toLocaleString()}
                  {' '}&middot; APTC: ${(item.advancePTC ?? []).reduce((a: number, b: number) => a + b, 0).toLocaleString()}
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
          adding ? (
            renderForm(addItem, 'Save 1095-A')
          ) : (
            <AddButton onClick={() => { setForm({ ...EMPTY_1095A, enrollmentPremiums: [...EMPTY_1095A.enrollmentPremiums], slcspPremiums: [...EMPTY_1095A.slcspPremiums], advancePTC: [...EMPTY_1095A.advancePTC], coverageMonths: [...EMPTY_1095A.coverageMonths] }); setAdding(true); }}>Add Form 1095-A</AddButton>
          )
        )}

        {totalAPTC > 0 && (
          <div className="rounded-xl border p-6 bg-telos-blue-600/10 border-telos-blue-600/30 text-sm">
            <p className="text-telos-blue-300 font-medium">Total Advance PTC received: ${totalAPTC.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">
              This will be reconciled against your actual PTC based on final income. You may owe back excess APTC or receive an additional credit.
            </p>
          </div>
        )}

      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
