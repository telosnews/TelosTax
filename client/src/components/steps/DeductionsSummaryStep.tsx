import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateForm1040, STANDARD_DEDUCTION_2025, ADDITIONAL_STANDARD_DEDUCTION, FilingStatus } from '@telostax/engine';
import { updateReturn } from '../../api/client';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import {
  Scissors, FileCheck, Receipt,
} from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import DeductionsFlowSwitcher from '../charts/DeductionsFlowSwitcher';
import { isAge65OrOlder } from '../../utils/dateValidation';

export default function DeductionsSummaryStep() {
  const { taxReturn, returnId, goToStep, updateField } = useTaxReturnStore();
  if (!taxReturn) return null;

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;
  const help = HELP_CONTENT['deductions_summary'];

  // Deduction info
  const isItemized = taxReturn.deductionMethod === 'itemized';
  const deductionAmount = f.deductionAmount;
  const scheduleA = result.scheduleA;

  // Adjustments (above the line)
  const adjustments: { label: string; amount: number; stepId: string }[] = [
    { label: 'HSA Deduction', amount: f.hsaDeduction || 0, stepId: 'hsa_contributions' },
    { label: 'Archer MSA Deduction', amount: f.archerMSADeduction || 0, stepId: 'archer_msa' },
    { label: 'Student Loan Interest', amount: f.studentLoanInterest || 0, stepId: 'student_loan_ded' },
    { label: 'IRA Deduction', amount: f.iraDeduction || 0, stepId: 'ira_contribution_ded' },
    { label: 'Educator Expenses', amount: f.educatorExpenses || 0, stepId: 'educator_expenses_ded' },
    { label: 'SE Tax Deduction', amount: f.seDeduction || 0, stepId: 'se_retirement' },
    { label: 'SE Health Insurance', amount: f.selfEmployedHealthInsurance || 0, stepId: 'se_health_insurance' },
    { label: 'SE Retirement', amount: f.retirementContributions || 0, stepId: 'se_retirement' },
    { label: 'Alimony Paid', amount: f.alimonyDeduction || 0, stepId: 'alimony_paid' },
    { label: 'Moving Expenses', amount: f.movingExpenses || 0, stepId: 'other_income' },
    { label: 'Early Withdrawal Penalty', amount: f.earlyWithdrawalPenalty || 0, stepId: 'other_income' },
  ].filter((a) => a.amount > 0);

  const totalAdjustments = adjustments.reduce((s, a) => s + a.amount, 0);

  // Itemized deduction line items (for bar chart)
  const deductionItems: { label: string; amount: number; stepId: string }[] = scheduleA ? [
    { label: 'Medical & Dental', amount: scheduleA.medicalDeduction || 0, stepId: 'medical_expenses' },
    { label: 'SALT', amount: scheduleA.saltDeduction || 0, stepId: 'salt_deduction' },
    { label: 'Mortgage Interest', amount: scheduleA.interestDeduction || 0, stepId: 'mortgage_interest_ded' },
    { label: 'Charitable', amount: scheduleA.charitableDeduction || 0, stepId: 'charitable_deduction' },
  ].filter(d => d.amount > 0) : [];
  const totalSavings = deductionAmount + totalAdjustments;
  const totalIncome = f.totalIncome || 0;
  const agi = f.agi || 0;
  const deductionLabel = isItemized ? 'Itemized Deductions' : 'Standard Deduction';
  const qbiDeduction = f.qbiDeduction || 0;
  const taxableIncome = f.taxableIncome || 0;

  // Standard deduction (from constants, always available for comparison)
  const filingStatus = taxReturn.filingStatus || FilingStatus.Single;
  const isMarried = filingStatus === FilingStatus.MarriedFilingJointly || filingStatus === FilingStatus.MarriedFilingSeparately;
  const perQualification = isMarried ? ADDITIONAL_STANDARD_DEDUCTION.MARRIED : ADDITIONAL_STANDARD_DEDUCTION.UNMARRIED;
  let additionalStd = 0;
  if (isAge65OrOlder(taxReturn.dateOfBirth, taxReturn.taxYear)) additionalStd += perQualification;
  if (taxReturn.isLegallyBlind) additionalStd += perQualification;
  if (filingStatus === FilingStatus.MarriedFilingJointly) {
    if (isAge65OrOlder(taxReturn.spouseDateOfBirth, taxReturn.taxYear)) additionalStd += perQualification;
    if (taxReturn.spouseIsLegallyBlind) additionalStd += perQualification;
  }
  const stdAmount = STANDARD_DEDUCTION_2025[filingStatus] + additionalStd;
  const itemizedTotal = scheduleA?.totalItemized || 0;
  const recommendStandard = itemizedTotal <= stdAmount;
  const deductionDifference = Math.abs(stdAmount - itemizedTotal);

  const handleMethodChange = (method: 'standard' | 'itemized') => {
    updateField('deductionMethod', method);
    if (returnId) {
      try { updateReturn(returnId, { deductionMethod: method }); } catch { /* ignore */ }
    }
    // Changing deductionMethod adds/removes conditional steps from the visible list,
    // which shifts the numeric currentStepIndex. Re-anchor to this step by id.
    goToStep('deductions_summary');
  };

  return (
    <div>
      <SectionIntro
        icon={<Scissors className="w-8 h-8" />}
        title="Deductions Summary"
        description="Here's a summary of all your deductions and adjustments."
      />
      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Total savings hero */}
      <div className="rounded-xl border p-6 mt-6 text-center bg-telos-orange-500/5 border-telos-orange-500/20">
        <p className="text-slate-400 text-sm mb-1">Total Deductions & Adjustments</p>
        <p className="text-3xl font-bold text-telos-orange-400">
          ${totalSavings.toLocaleString()}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          ${deductionAmount.toLocaleString()} {isItemized ? 'itemized deductions' : 'standard deduction'} + ${totalAdjustments.toLocaleString()} adjustments
        </p>
      </div>

      {/* Deductions & Adjustments visualization switcher */}
      <DeductionsFlowSwitcher
        totalIncome={totalIncome}
        adjustments={adjustments}
        deductions={deductionItems}
        isItemized={isItemized}
        totalAdjustments={totalAdjustments}
        agi={agi}
        deductionAmount={deductionAmount}
        deductionLabel={deductionLabel}
        qbiDeduction={qbiDeduction}
        taxableIncome={taxableIncome}
        onBarClick={(stepId) => goToStep(stepId)}
      />

      {/* Deduction method toggle */}
      <div className="card mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-slate-200 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-telos-orange-400" />
            Deduction Method
          </h3>
          <button
            onClick={() => goToStep('deduction_method')}
            className="text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
          >
            Learn more
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Standard Deduction card */}
          <button
            onClick={() => handleMethodChange('standard')}
            className={`relative rounded-lg border p-3 text-left transition-all ${
              !isItemized
                ? 'border-telos-orange-500/60 bg-telos-orange-500/10 ring-1 ring-telos-orange-500/30'
                : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600/60'
            }`}
          >
            {!isItemized && (
              <span className="absolute -top-2 right-2 text-[10px] font-semibold bg-telos-orange-500 text-white px-1.5 py-0.5 rounded">
                Selected
              </span>
            )}
            {itemizedTotal > 0 && recommendStandard && (
              <span className={`absolute -top-2 ${!isItemized ? 'left-2' : 'right-2'} text-[10px] font-semibold bg-emerald-500 text-white px-1.5 py-0.5 rounded`}>
                Better for you
              </span>
            )}
            <p className="text-xs text-slate-400 mb-1">Standard Deduction</p>
            <p className={`text-lg font-bold tabular-nums ${!isItemized ? 'text-telos-orange-400' : 'text-slate-300'}`}>
              ${stdAmount.toLocaleString()}
            </p>
          </button>

          {/* Itemized Deductions card */}
          <button
            onClick={() => handleMethodChange('itemized')}
            className={`relative rounded-lg border p-3 text-left transition-all ${
              isItemized
                ? 'border-telos-orange-500/60 bg-telos-orange-500/10 ring-1 ring-telos-orange-500/30'
                : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600/60'
            }`}
          >
            {isItemized && (
              <span className="absolute -top-2 right-2 text-[10px] font-semibold bg-telos-orange-500 text-white px-1.5 py-0.5 rounded">
                Selected
              </span>
            )}
            {itemizedTotal > 0 && !recommendStandard && (
              <span className={`absolute -top-2 ${isItemized ? 'left-2' : 'right-2'} text-[10px] font-semibold bg-emerald-500 text-white px-1.5 py-0.5 rounded`}>
                Better for you
              </span>
            )}
            <p className="text-xs text-slate-400 mb-1">Itemized Deductions</p>
            <p className={`text-lg font-bold tabular-nums ${isItemized ? 'text-telos-orange-400' : 'text-slate-300'}`}>
              ${itemizedTotal > 0 ? itemizedTotal.toLocaleString() : '—'}
            </p>
          </button>
        </div>

        {/* Comparison note */}
        {itemizedTotal > 0 && (
          <p className="text-xs text-slate-500 mt-2 text-center">
            {recommendStandard
              ? `Standard saves you $${deductionDifference.toLocaleString()} more`
              : `Itemizing saves you $${deductionDifference.toLocaleString()} more`}
          </p>
        )}

        {/* Itemized breakdown when itemized is selected */}
        {isItemized && scheduleA && (
          <div className="border-t border-slate-700/50 mt-3">
            <div className="space-y-0 divide-y divide-slate-700/50">
              {scheduleA.medicalDeduction > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-400">Medical & Dental</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white tabular-nums">
                      ${scheduleA.medicalDeduction.toLocaleString()}
                    </span>
                    <button
                      onClick={() => goToStep('medical_expenses')}
                      className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
              {scheduleA.saltDeduction > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-400">State & Local Taxes (SALT)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white tabular-nums">
                      ${scheduleA.saltDeduction.toLocaleString()}
                    </span>
                    <button
                      onClick={() => goToStep('salt_deduction')}
                      className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
              {scheduleA.interestDeduction > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-400">Mortgage Interest</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white tabular-nums">
                      ${scheduleA.interestDeduction.toLocaleString()}
                    </span>
                    <button
                      onClick={() => goToStep('mortgage_interest_ded')}
                      className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
              {scheduleA.charitableDeduction > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-400">Charitable Donations</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white tabular-nums">
                      ${scheduleA.charitableDeduction.toLocaleString()}
                    </span>
                    <button
                      onClick={() => goToStep('charitable_deduction')}
                      className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-700 pt-2 mt-1">
              <span className="text-sm font-medium text-slate-200">Total Itemized</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-telos-orange-400 tabular-nums">
                  ${itemizedTotal.toLocaleString()}
                </span>
                <button
                  onClick={() => goToStep('itemized_deductions')}
                  className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors"
                >
                  View all
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Note when standard is selected but itemized data exists */}
        {!isItemized && itemizedTotal > 0 && (
          <p className="text-xs text-slate-500 mt-3 border-t border-slate-700/50 pt-2">
            Your itemized deductions total ${itemizedTotal.toLocaleString()}.{' '}
            <button
              onClick={() => goToStep('itemized_deductions')}
              className="text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              View breakdown
            </button>
          </p>
        )}
      </div>

      {/* Adjustments */}
      {adjustments.length > 0 && (
        <div className="card mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-slate-200 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-telos-orange-400" />
              Adjustments to Income
            </h3>
          </div>
          <div className="space-y-0 divide-y divide-slate-700/50">
            {adjustments.map((adj) => (
              <div key={adj.label} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-400">{adj.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white tabular-nums">
                    -${adj.amount.toLocaleString()}
                  </span>
                  <button
                    onClick={() => goToStep(adj.stepId)}
                    className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-700 pt-2 mt-1">
            <span className="text-sm font-medium text-slate-200">Total Adjustments</span>
            <span className="text-sm font-bold text-telos-orange-400 tabular-nums">
              -${totalAdjustments.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      <StepNavigation />
    </div>
  );
}
