import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertItemized } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import { Stethoscope } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { ItemizedDeductions } from '@telostax/engine';

const emptyItemized: ItemizedDeductions = {
  medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
  personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
  charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
};

export default function MedicalExpensesStep() {
  const { taxReturn, returnId, updateField, calculation } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['itemized_deductions'];
  const items = taxReturn.itemizedDeductions || emptyItemized;
  const agi = calculation?.form1040?.agi || 0;
  const floor = Math.round(agi * 0.075);
  const deductible = Math.max(0, items.medicalExpenses - floor);

  const update = (value: number) => {
    updateField('itemizedDeductions', { ...items, medicalExpenses: value });
  };

  const save = async () => {
    await upsertItemized(returnId, { ...items });
  };

  return (
    <div>
      <StepWarningsBanner stepId="medical_expenses" />

      <SectionIntro
        icon={<Stethoscope className="w-8 h-8" />}
        title="Medical & Dental Expenses"
        description="Enter unreimbursed medical and dental expenses. Only the amount exceeding 7.5% of your AGI is deductible."
      />

      <CalloutCard variant="info" title="7.5% AGI Floor" irsUrl="https://www.irs.gov/taxtopics/tc502">
        You can deduct medical expenses that exceed 7.5% of your AGI. Common expenses include insurance premiums (not employer-paid), doctor visits, prescriptions, dental, vision, and long-term care.
      </CalloutCard>

      <div className="card mt-6">
        <FormField
          label="Total Medical & Dental Expenses"
          tooltip={help?.fields['Total Medical Expenses']?.tooltip}
          irsRef={help?.fields['Total Medical Expenses']?.irsRef || 'Schedule A, Line 1'}
          helpText="Include all unreimbursed medical/dental expenses for you, your spouse, and dependents"
        >
          <CurrencyInput value={items.medicalExpenses} onChange={update} />
        </FormField>
      </div>

      {items.medicalExpenses > 0 && (
        <div className={`rounded-xl border p-5 mt-4 text-center ${deductible > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800 border-slate-700'}`}>
          <p className="text-sm text-slate-400">Deductible Amount</p>
          <p className={`text-2xl font-bold ${deductible > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
            ${deductible.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            ${items.medicalExpenses.toLocaleString()} total − ${floor.toLocaleString()} floor (7.5% of ${agi.toLocaleString()} AGI)
          </p>
          {deductible === 0 && items.medicalExpenses > 0 && (
            <p className="text-xs text-amber-400 mt-2">
              Your expenses don't exceed the 7.5% floor — no medical deduction applies.
            </p>
          )}
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
