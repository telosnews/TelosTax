import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import { PencilRuler, ExternalLink } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';

export default function EducatorExpensesStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const save = async () => {
    await updateReturn(returnId, { educatorExpenses: taxReturn.educatorExpenses });
  };

  return (
    <div>
      <StepWarningsBanner stepId="educator_expenses_ded" />

      <SectionIntro
        icon={<PencilRuler className="w-8 h-8" />}
        title="Educator Expenses"
        description="K-12 teachers, instructors, counselors, and principals can deduct up to $300 in unreimbursed classroom expenses."
      />

      <CalloutCard variant="info" title="Educator Expense Deduction" irsUrl="https://www.irs.gov/taxtopics/tc458">
        You can deduct up to $300 ($600 if both spouses are educators filing jointly) in unreimbursed expenses for books, supplies, equipment, and other classroom materials. You must have worked at least 900 hours during the school year.
      </CalloutCard>

      <div className="card mt-6">
        <FormField
          label="Educator Expenses"
          tooltip="Unreimbursed expenses for books, supplies, equipment, and other materials used in the classroom. You must have worked at least 900 hours during the school year."
          irsRef="Schedule 1, Line 11"
          helpText="Up to $300 per educator ($600 if both spouses are educators)"
        >
          <CurrencyInput
            value={taxReturn.educatorExpenses || 0}
            onChange={(v) => updateField('educatorExpenses', v)}
          />
        </FormField>

        {(taxReturn.educatorExpenses || 0) > 300 && (
          <p className="text-xs text-amber-400 mt-2">
            The deduction is limited to $300 per educator. Amounts above $300 will not be deductible.
          </p>
        )}

        <a href="https://www.irs.gov/taxtopics/tc458" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
