import { ArrowRight, Check, FileCheck, Receipt } from 'lucide-react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import StepNavigation from '../layout/StepNavigation';
import { formatCurrency } from '../../utils/format';

export default function CreditsTransitionStep() {
  const { taxReturn, goToStep } = useTaxReturnStore();
  const calculation = useTaxReturnStore((s) => s.calculation);

  // Fallback to generic transition if no data yet
  if (!taxReturn || !calculation) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-telos-blue-600/20 text-telos-blue-400 mb-6">
          <ArrowRight className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Making great progress!</h1>
        <p className="text-slate-400 text-lg mb-2">
          Now let&apos;s look for tax credits &mdash; these reduce your tax bill dollar for dollar.
        </p>
        <StepNavigation continueLabel="Let's Go" />
      </div>
    );
  }

  const f = calculation.form1040;
  const isItemized = taxReturn.deductionMethod === 'itemized';
  const deductionAmount = f.deductionAmount;
  const scheduleA = calculation.scheduleA;

  // Build adjustments list
  const adjustments: { label: string; amount: number }[] = [
    { label: 'HSA Deduction', amount: f.hsaDeduction || 0 },
    { label: 'Student Loan Interest', amount: f.studentLoanInterest || 0 },
    { label: 'IRA Deduction', amount: f.iraDeduction || 0 },
    { label: 'Educator Expenses', amount: f.educatorExpenses || 0 },
    { label: 'SE Tax Deduction', amount: f.seDeduction || 0 },
    { label: 'SE Health Insurance', amount: f.selfEmployedHealthInsurance || 0 },
    { label: 'SE Retirement', amount: f.retirementContributions || 0 },
  ].filter((a) => a.amount > 0);

  const totalAdjustments = adjustments.reduce((s, a) => s + a.amount, 0);
  const totalReducing = deductionAmount + totalAdjustments;

  return (
    <div className="max-w-lg mx-auto py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-600/20 text-emerald-400 mb-4">
          <Check className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Deductions Complete</h1>
      </div>

      {/* Deduction method */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-telos-orange-400" />
            {isItemized ? 'Itemized Deductions' : 'Standard Deduction'}
          </h3>
          <button
            onClick={() => goToStep('deduction_method')}
            className="text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
          >
            Change
          </button>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-slate-400">
            {isItemized ? 'Itemized Deductions' : 'Standard Deduction'}
          </span>
          <span className="text-sm font-medium text-white tabular-nums">
            {formatCurrency(deductionAmount)}
          </span>
        </div>
        {isItemized && scheduleA && (
          <div className="border-t border-slate-700/50 pt-2 mt-1 space-y-1">
            {scheduleA.medicalDeduction > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Medical & Dental</span>
                <span className="text-slate-500">{formatCurrency(scheduleA.medicalDeduction)}</span>
              </div>
            )}
            {scheduleA.saltDeduction > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">State & Local Taxes</span>
                <span className="text-slate-500">{formatCurrency(scheduleA.saltDeduction)}</span>
              </div>
            )}
            {scheduleA.interestDeduction > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Mortgage Interest</span>
                <span className="text-slate-500">{formatCurrency(scheduleA.interestDeduction)}</span>
              </div>
            )}
            {scheduleA.charitableDeduction > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Charitable Donations</span>
                <span className="text-slate-500">{formatCurrency(scheduleA.charitableDeduction)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Adjustments */}
      {adjustments.length > 0 && (
        <div className="card mt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-telos-orange-400" />
              Adjustments to Income
            </h3>
            <button
              onClick={() => goToStep('adjustments')}
              className="text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              Edit
            </button>
          </div>
          {adjustments.map((adj) => (
            <div key={adj.label} className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-400">{adj.label}</span>
              <span className="text-sm text-slate-400 tabular-nums">{formatCurrency(adj.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      <div className="mt-4 px-1">
        <div className="flex items-center justify-between border-t border-slate-600 pt-3">
          <span className="text-sm font-medium text-slate-200">Reducing your taxable income by</span>
          <span className="text-lg font-bold text-emerald-400 tabular-nums">
            {formatCurrency(totalReducing)}
          </span>
        </div>
      </div>

      {/* Up next prompt */}
      <p className="text-center text-slate-400 text-sm mt-6">
        Now let&apos;s look for tax credits &mdash; these reduce your tax bill dollar for dollar.
      </p>

      <StepNavigation continueLabel="Let's Go" />
    </div>
  );
}
