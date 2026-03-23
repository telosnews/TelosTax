import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import { GraduationCap, AlertTriangle, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import StepWarningsBanner from '../common/StepWarningsBanner';
import WhatsNewCard from '../common/WhatsNewCard';
import { FilingStatus } from '@telostax/engine';

export default function StudentLoanStep() {
  const { taxReturn, returnId, updateField, calculation } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['adjustments'];
  const agi = calculation?.form1040?.agi;
  const isMFJ = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly || taxReturn.filingStatus === FilingStatus.QualifyingSurvivingSpouse;
  const isMFS = taxReturn.filingStatus === FilingStatus.MarriedFilingSeparately;
  const phaseOutStart = isMFJ ? 170000 : 85000;
  const phaseOutEnd = isMFJ ? 200000 : 100000;

  const save = async () => {
    await updateReturn(returnId, { studentLoanInterest: taxReturn.studentLoanInterest });
  };

  return (
    <div>
      <StepWarningsBanner stepId="student_loan_ded" />

      <SectionIntro
        icon={<GraduationCap className="w-8 h-8" />}
        title="Student Loan Interest"
        description="Deduct up to $2,500 in student loan interest paid. Subject to income phase-out."
      />

      <WhatsNewCard items={[
        { title: 'Phase-Out Thresholds Increased', description: 'Single/HoH: $85,000-$100,000 (up from $80,000-$95,000). MFJ: $170,000-$200,000 (up from $165,000-$195,000). Still not available if filing MFS.' },
      ]} />

      <CalloutCard variant="info" title="Student Loan Interest Deduction" irsUrl="https://www.irs.gov/taxtopics/tc456">
        You can deduct up to $2,500 of interest paid on qualified student loans. The deduction phases out at $85,000-$100,000 (single) or $170,000-$200,000 (MFJ). Not available if filing MFS.
      </CalloutCard>

      {isMFS && (
        <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300">Student loan interest deduction is not available when filing Married Filing Separately.</p>
        </div>
      )}

      <div className="card mt-6">
        <FormField label="Student Loan Interest Paid" tooltip={help?.fields['Student Loan Interest Paid']?.tooltip} irsRef={help?.fields['Student Loan Interest Paid']?.irsRef || 'Schedule 1, Line 21'} helpText="From Form 1098-E or lender statement">
          <CurrencyInput
            value={taxReturn.studentLoanInterest || 0}
            onChange={(v) => updateField('studentLoanInterest', v)}
          />
        </FormField>

        {(taxReturn.studentLoanInterest || 0) > 0 && agi != null && !isNaN(agi) && agi > phaseOutStart && (
          <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              {agi >= phaseOutEnd
                ? `AGI of $${agi.toLocaleString()} exceeds $${phaseOutEnd.toLocaleString()} — this deduction is fully phased out.`
                : `AGI of $${agi.toLocaleString()} is in the phase-out range ($${phaseOutStart.toLocaleString()}-$${phaseOutEnd.toLocaleString()}) — deduction is reduced.`}
            </p>
          </div>
        )}

        <a href="https://www.irs.gov/taxtopics/tc456" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
