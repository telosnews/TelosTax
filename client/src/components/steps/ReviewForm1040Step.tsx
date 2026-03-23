import { useTaxReturnStore } from '../../store/taxReturnStore';
import { FilingStatus } from '@telostax/engine';
import type { CalculationTrace } from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import FormField from '../common/FormField';
import WarningsSummaryCard from '../common/WarningsSummaryCard';
import TraceDisclosure from '../common/TraceDisclosure';
import { FileText, ShieldCheck } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import SSNInput from '../common/SSNInput';

export default function ReviewForm1040Step() {
  const { taxReturn, updateField } = useTaxReturnStore();
  const calculation = useTaxReturnStore((s) => s.calculation);
  if (!taxReturn || !calculation) return null;

  const isJoint = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly;
  const result = calculation;
  const f = result.form1040;
  const help = HELP_CONTENT['review_form_1040'];

  const findTrace = (id: string) => result.traces?.find((t: CalculationTrace) => t.lineId === id);

  const Row = ({ label, amount, bold, indent, trace }: { label: string; amount: number; bold?: boolean; indent?: boolean; trace?: CalculationTrace }) => (
    <div className={indent ? 'pl-4' : ''}>
      <div className="flex justify-between py-1.5">
        <span className={bold ? 'text-white font-medium' : 'text-slate-300'}>{label}</span>
        <span className={bold ? 'text-white font-semibold' : 'text-slate-200'}>${amount.toLocaleString()}</span>
      </div>
      {trace && <TraceDisclosure trace={trace} />}
    </div>
  );

  return (
    <div>
      <SectionIntro
        icon={<FileText className="w-8 h-8" />}
        title="Form 1040 Review"
        description="Review key lines of your federal tax return."
        transition="You're in the home stretch! Let's review your complete return."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <WarningsSummaryCard />

      {/* Identity Verification — SSN collected at review for security */}
      <div className="card mt-6 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-telos-blue-400" />
          <h3 className="font-medium text-slate-200 text-sm uppercase tracking-wide">Identity Verification</h3>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Your SSN is encrypted with AES-256-GCM and never leaves your device.
        </p>
        <div className={`grid gap-4 ${isJoint ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
          <FormField label="Your Social Security Number" tooltip={help?.fields['Your Social Security Number']?.tooltip} irsRef={help?.fields['Your Social Security Number']?.irsRef}>
            <SSNInput
              value={taxReturn.ssn || ''}
              onChange={(val) => {
                updateField('ssn', val);
                updateField('ssnLastFour', val.length >= 4 ? val.slice(-4) : val);
              }}
            />
          </FormField>
          {isJoint && (
            <FormField label="Spouse Social Security Number" tooltip={help?.fields['Spouse Social Security Number']?.tooltip} irsRef={help?.fields['Spouse Social Security Number']?.irsRef}>
              <SSNInput
                value={taxReturn.spouseSsn || ''}
                onChange={(val) => {
                  updateField('spouseSsn', val);
                  updateField('spouseSsnLastFour', val.length >= 4 ? val.slice(-4) : val);
                }}
              />
            </FormField>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Income */}
        <div className="card">
          <h3 className="font-medium text-slate-200 mb-3 text-sm uppercase tracking-wide">Income</h3>
          {f.totalWages > 0 && <Row label="Wages (Line 1)" amount={f.totalWages} />}
          {f.totalInterest > 0 && <Row label="Interest (Line 2b)" amount={f.totalInterest} />}
          {f.totalDividends > 0 && <Row label="Dividends (Line 3b)" amount={f.totalDividends} />}
          {f.totalCapitalGainDistributions > 0 && <Row label="Capital Gain Distributions" amount={f.totalCapitalGainDistributions} />}
          {f.scheduleDNetGain > 0 && <Row label="Schedule D Net Gain (Line 7)" amount={f.scheduleDNetGain} />}
          {f.capitalLossDeduction > 0 && (
            <div className="flex justify-between py-1.5">
              <span className="text-slate-300">Capital Loss Deduction</span>
              <span className="text-white">-${f.capitalLossDeduction.toLocaleString()}</span>
            </div>
          )}
          {f.totalRetirementIncome > 0 && <Row label="Retirement Distributions (Line 4b)" amount={f.totalRetirementIncome} />}
          {f.taxableSocialSecurity > 0 && <Row label="Taxable Social Security (Line 6b)" amount={f.taxableSocialSecurity} />}
          {f.totalUnemployment > 0 && <Row label="Unemployment (Line 7)" amount={f.totalUnemployment} />}
          {f.scheduleCNetProfit > 0 && <Row label="Schedule C Net Profit (Line 8)" amount={f.scheduleCNetProfit} />}
          {f.total1099MISCIncome > 0 && <Row label="1099-MISC Other Income (Line 8)" amount={f.total1099MISCIncome} />}
          {f.k1OrdinaryIncome > 0 && <Row label="K-1 Business Income" amount={f.k1OrdinaryIncome} />}
          {f.hsaDistributionTaxable > 0 && <Row label="HSA Taxable Distributions" amount={f.hsaDistributionTaxable} />}
          {f.scheduleEIncome !== 0 && (
            <div className="flex justify-between py-1.5">
              <span className="text-slate-300">Schedule E Rental Income</span>
              <span className="text-white">
                {f.scheduleEIncome < 0 ? '-' : ''}${Math.abs(f.scheduleEIncome).toLocaleString()}
              </span>
            </div>
          )}
          <div className="border-t border-slate-700 mt-1 pt-1">
            <Row label="Total Income (Line 9)" amount={f.totalIncome} bold trace={findTrace('form1040.line9')} />
          </div>
        </div>

        {/* Adjustments */}
        {f.totalAdjustments > 0 && (
          <div className="card">
            <h3 className="font-medium text-slate-200 mb-3 text-sm uppercase tracking-wide">Adjustments</h3>
            {f.seDeduction > 0 && <Row label="SE Tax Deduction" amount={f.seDeduction} indent />}
            {f.selfEmployedHealthInsurance > 0 && <Row label="SE Health Insurance" amount={f.selfEmployedHealthInsurance} indent />}
            {f.retirementContributions > 0 && <Row label="Retirement Contributions" amount={f.retirementContributions} indent />}
            {f.hsaDeduction > 0 && <Row label="HSA Contributions" amount={f.hsaDeduction} indent />}
            {f.studentLoanInterest > 0 && <Row label="Student Loan Interest" amount={f.studentLoanInterest} indent />}
            {f.iraDeduction > 0 && <Row label="Traditional IRA Deduction" amount={f.iraDeduction} indent />}
            {f.earlyWithdrawalPenalty > 0 && <Row label="Early Withdrawal Penalty" amount={f.earlyWithdrawalPenalty} indent />}
            <div className="border-t border-slate-700 mt-1 pt-1">
              <div>
              <div className="flex justify-between py-1.5">
                <span className="text-white font-medium">Total Adjustments (Line 10)</span>
                <span className="text-telos-orange-400 font-semibold">${f.totalAdjustments.toLocaleString()}</span>
              </div>
              {findTrace('form1040.line10') && <TraceDisclosure trace={findTrace('form1040.line10')!} />}
            </div>
            </div>
          </div>
        )}

        {/* AGI & Deductions */}
        <div className="card">
          <h3 className="font-medium text-slate-200 mb-3 text-sm uppercase tracking-wide">AGI & Deductions</h3>
          <Row label="Adjusted Gross Income (Line 11)" amount={f.agi} bold trace={findTrace('form1040.line11')} />
          <Row label={`${f.deductionUsed === 'standard' ? 'Standard' : 'Itemized'} Deduction (Line 12)`} amount={f.deductionAmount} />
          {f.qbiDeduction > 0 && <Row label="QBI Deduction (Line 13)" amount={f.qbiDeduction} />}
          <div className="border-t border-slate-700 mt-1 pt-1">
            <Row label="Taxable Income (Line 15)" amount={f.taxableIncome} bold trace={findTrace('form1040.line15')} />
          </div>
        </div>

        {/* Tax */}
        <div className="card">
          <h3 className="font-medium text-slate-200 mb-3 text-sm uppercase tracking-wide">Tax</h3>
          <Row label="Income Tax (Line 16)" amount={f.incomeTax} trace={findTrace('form1040.line16')} />
          {f.preferentialTax > 0 && <Row label="Includes Preferential Rate Tax" amount={f.preferentialTax} indent />}
          {f.amtAmount > 0 && <Row label="Alternative Minimum Tax (Form 6251)" amount={f.amtAmount} />}
          {f.seTax > 0 && <Row label="Self-Employment Tax" amount={f.seTax} />}
          {f.niitTax > 0 && <Row label="Net Investment Income Tax (3.8%)" amount={f.niitTax} />}
          {f.additionalMedicareTaxW2 > 0 && <Row label="Additional Medicare Tax (0.9%)" amount={f.additionalMedicareTaxW2} />}
          {f.earlyDistributionPenalty > 0 && <Row label="Early Distribution Penalty (10%)" amount={f.earlyDistributionPenalty} />}
          {f.hsaDistributionPenalty > 0 && <Row label="HSA Distribution Penalty (20%)" amount={f.hsaDistributionPenalty} />}
          <div className="border-t border-slate-700 mt-1 pt-1">
            <div>
              <div className="flex justify-between py-1.5">
                <span className="text-white font-medium">Total Tax</span>
                <span className="text-amber-400 font-semibold">${f.totalTax.toLocaleString()}</span>
              </div>
              {findTrace('form1040.line24') && <TraceDisclosure trace={findTrace('form1040.line24')!} />}
            </div>
          </div>
        </div>

        {/* Credits */}
        {f.totalCredits > 0 && (
          <div className="card">
            <h3 className="font-medium text-slate-200 mb-3 text-sm uppercase tracking-wide">Credits</h3>
            {result.credits.childTaxCredit > 0 && <Row label="Child Tax Credit" amount={result.credits.childTaxCredit} indent />}
            {result.credits.otherDependentCredit > 0 && <Row label="Other Dependent Credit" amount={result.credits.otherDependentCredit} indent />}
            {result.credits.educationCredit > 0 && <Row label="Education Credit (non-refundable)" amount={result.credits.educationCredit} indent />}
            {result.credits.actcCredit > 0 && <Row label="Additional Child Tax Credit (refundable)" amount={result.credits.actcCredit} indent />}
            {result.credits.aotcRefundableCredit > 0 && <Row label="AOTC Refundable (40%)" amount={result.credits.aotcRefundableCredit} indent />}
            {result.credits.dependentCareCredit > 0 && <Row label="Dependent Care Credit" amount={result.credits.dependentCareCredit} indent />}
            {result.credits.saversCredit > 0 && <Row label="Saver's Credit" amount={result.credits.saversCredit} indent />}
            {result.credits.cleanEnergyCredit > 0 && <Row label="Clean Energy Credit" amount={result.credits.cleanEnergyCredit} indent />}
            {result.credits.eitcCredit > 0 && <Row label="Earned Income Tax Credit" amount={result.credits.eitcCredit} indent />}
            <div className="border-t border-slate-700 mt-1 pt-1">
              <div>
                <div className="flex justify-between py-1.5">
                  <span className="text-white font-medium">Total Credits</span>
                  <span className="text-emerald-400 font-semibold">${f.totalCredits.toLocaleString()}</span>
                </div>
                {findTrace('form1040.line21') && <TraceDisclosure trace={findTrace('form1040.line21')!} />}
              </div>
            </div>
          </div>
        )}

        {/* Tax After Credits */}
        <div className="card">
          <div className="border-t border-slate-700 mt-1 pt-1">
            <Row label="Tax After Credits" amount={f.taxAfterCredits} bold />
          </div>
        </div>

        {/* Payments & Balance */}
        <div className="card">
          <h3 className="font-medium text-slate-200 mb-3 text-sm uppercase tracking-wide">Payments & Balance</h3>
          {f.totalWithholding > 0 && <Row label="Federal Tax Withheld" amount={f.totalWithholding} />}
          {f.estimatedPayments > 0 && <Row label="Estimated Tax Payments" amount={f.estimatedPayments} />}
          <div className="border-t border-slate-700 mt-1 pt-1">
            {f.refundAmount > 0 ? (
              <div>
                <div className="flex justify-between py-2">
                  <span className="text-emerald-300 font-semibold">Refund</span>
                  <span className="text-emerald-400 text-lg font-bold">${f.refundAmount.toLocaleString()}</span>
                </div>
                {findTrace('form1040.line37') && <TraceDisclosure trace={findTrace('form1040.line37')!} />}
              </div>
            ) : (
              <div>
                <div className="flex justify-between py-2">
                  <span className="text-amber-300 font-semibold">Amount Owed</span>
                  <span className="text-amber-400 text-lg font-bold">${f.amountOwed.toLocaleString()}</span>
                </div>
                {findTrace('form1040.line37') && <TraceDisclosure trace={findTrace('form1040.line37')!} />}
              </div>
            )}
          </div>
        </div>
      </div>

      <StepNavigation />
    </div>
  );
}
