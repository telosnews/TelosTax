import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateForm1040 } from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Sliders, HeartPulse, GraduationCap, PiggyBank, PencilRuler, UserMinus, RotateCcw } from 'lucide-react';
import CalloutCard from '../common/CalloutCard';
import AdjustmentsWaterfall from '../charts/AdjustmentsWaterfall';
import { useMemo } from 'react';

export default function AdjustmentsStep() {
  const { taxReturn, goToStep } = useTaxReturnStore();
  if (!taxReturn) return null;

  const result = useMemo(() => {
    try { return calculateForm1040(taxReturn); } catch { return null; }
  }, [taxReturn]);

  const f = result?.form1040;
  const totalAdjustments = f?.totalAdjustments || 0;
  const agi = f?.agi || 0;
  const totalIncome = f?.totalIncome || 0;

  const lineItems: { label: string; icon: React.ReactNode; amount: number; stepId: string }[] = [
    { label: 'HSA Deduction', icon: <HeartPulse className="w-4 h-4" />, amount: f?.hsaDeduction || 0, stepId: 'hsa_contributions' },
    { label: 'Student Loan Interest', icon: <GraduationCap className="w-4 h-4" />, amount: f?.studentLoanInterest || 0, stepId: 'student_loan_ded' },
    { label: 'IRA Deduction', icon: <PiggyBank className="w-4 h-4" />, amount: f?.iraDeduction || 0, stepId: 'ira_contribution_ded' },
    { label: 'Educator Expenses', icon: <PencilRuler className="w-4 h-4" />, amount: f?.educatorExpenses || 0, stepId: 'educator_expenses_ded' },
    { label: 'Alimony Paid', icon: <UserMinus className="w-4 h-4" />, amount: f?.alimonyDeduction || 0, stepId: 'alimony_paid' },
    { label: 'NOL Carryforward', icon: <RotateCcw className="w-4 h-4" />, amount: f?.nolDeduction || 0, stepId: 'nol_carryforward' },
    // SE-related adjustments (entered in Self-Employment section)
    ...(f?.seDeduction ? [{ label: 'SE Tax Deduction', icon: <Sliders className="w-4 h-4" />, amount: f.seDeduction, stepId: 'se_retirement' }] : []),
    ...(f?.selfEmployedHealthInsurance ? [{ label: 'SE Health Insurance', icon: <HeartPulse className="w-4 h-4" />, amount: f.selfEmployedHealthInsurance, stepId: 'se_health_insurance' }] : []),
    ...(f?.retirementContributions ? [{ label: 'SE Retirement', icon: <PiggyBank className="w-4 h-4" />, amount: f.retirementContributions, stepId: 'se_retirement' }] : []),
  ].filter(li => li.amount > 0);

  return (
    <div>
      <SectionIntro
        icon={<Sliders className="w-8 h-8" />}
        title="Adjustments Summary"
        description="These above-the-line deductions reduce your AGI — even if you don't itemize."
      />

      <CalloutCard variant="info" title="Why adjustments matter">
        Above-the-line deductions reduce your adjusted gross income (AGI), which can lower your tax bracket, increase eligibility for other deductions and credits, and reduce phase-outs. Unlike itemized deductions, you get these benefits regardless of whether you itemize or take the standard deduction.
      </CalloutCard>

      {/* Waterfall chart: Total Income → adjustments → AGI */}
      {totalAdjustments > 0 && totalIncome > 0 && (
        <AdjustmentsWaterfall
          totalIncome={totalIncome}
          adjustments={lineItems.map(li => ({ label: li.label, amount: li.amount, stepId: li.stepId }))}
          agi={agi}
          onBarClick={(stepId) => goToStep(stepId)}
        />
      )}

      {/* AGI reduction hero */}
      {totalAdjustments > 0 ? (
        <div className="rounded-xl border p-6 mt-6 text-center bg-emerald-500/10 border-emerald-500/30">
          <p className="text-sm text-slate-400 mb-1">Total Adjustments</p>
          <p className="text-3xl font-bold text-emerald-400">-${totalAdjustments.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">
            Total income ${totalIncome.toLocaleString()} → AGI ${agi.toLocaleString()}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border p-6 mt-6 text-center bg-slate-800 border-slate-700">
          <p className="text-sm text-slate-400">No above-the-line adjustments entered.</p>
          <p className="text-xs text-slate-500 mt-1">Use the steps above to enter any applicable deductions.</p>
        </div>
      )}

      {/* Line items with Edit buttons */}
      {lineItems.length > 0 && (
        <div className="card mt-4">
          <div className="space-y-0 divide-y divide-slate-700/50">
            {lineItems.map((li) => (
              <div key={li.label} className="flex items-center gap-3 py-3">
                <div className="text-telos-orange-400 shrink-0">{li.icon}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-200">{li.label}</span>
                </div>
                <span className="text-sm font-medium text-emerald-400 tabular-nums">
                  -${li.amount.toLocaleString()}
                </span>
                <button
                  onClick={() => goToStep(li.stepId)}
                  className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors shrink-0"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <StepNavigation />
    </div>
  );
}
