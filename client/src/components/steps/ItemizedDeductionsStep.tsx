import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateForm1040 } from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { Scissors, Stethoscope, Receipt, Home, HandHeart, Dices, AlertTriangle, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';

export default function ItemizedDeductionsStep() {
  const { taxReturn, goToStep } = useTaxReturnStore();
  if (!taxReturn) return null;

  const result = useMemo(() => {
    try { return calculateForm1040(taxReturn); } catch { return null; }
  }, [taxReturn]);

  const scheduleA = result?.scheduleA;
  const standardDeduction = result?.form1040?.standardDeduction || 0;
  const totalItemized = scheduleA?.totalItemized || 0;
  const gamblingDeduction = Math.min(taxReturn.gamblingLosses || 0, result?.form1040?.totalGamblingIncome || 0);
  const investmentInterest = result?.form1040?.investmentInterestDeduction || 0;
  const totalWithGambling = totalItemized + gamblingDeduction + investmentInterest;
  const itemizedBetter = totalWithGambling > standardDeduction;

  const lineItems: { label: string; icon: React.ReactNode; amount: number; stepId: string }[] = [
    { label: 'Medical & Dental', icon: <Stethoscope className="w-4 h-4" />, amount: scheduleA?.medicalDeduction || 0, stepId: 'medical_expenses' },
    { label: 'State & Local Taxes (SALT)', icon: <Receipt className="w-4 h-4" />, amount: scheduleA?.saltDeduction || 0, stepId: 'salt_deduction' },
    { label: 'Mortgage Interest', icon: <Home className="w-4 h-4" />, amount: scheduleA?.interestDeduction || 0, stepId: 'mortgage_interest_ded' },
    { label: 'Charitable Donations', icon: <HandHeart className="w-4 h-4" />, amount: scheduleA?.charitableDeduction || 0, stepId: 'charitable_deduction' },
    { label: 'Gambling Losses', icon: <Dices className="w-4 h-4" />, amount: gamblingDeduction, stepId: 'gambling_losses_ded' },
  ].filter(li => li.amount > 0);

  return (
    <div>
      <StepWarningsBanner stepId="itemized_deductions" />
      <SectionIntro
        icon={<Scissors className="w-8 h-8" />}
        title="Itemized Deductions Summary"
        description="Here's a breakdown of your Schedule A deductions."
      />

      {/* Comparison hero */}
      <div className={`rounded-xl border p-6 mt-6 text-center ${itemizedBetter ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
        <p className="text-sm text-slate-400 mb-1">Your Itemized Deductions</p>
        <p className="text-3xl font-bold text-white">${totalWithGambling.toLocaleString()}</p>
        <p className="text-xs text-slate-400 mt-2">
          Standard deduction: ${standardDeduction.toLocaleString()}
          {itemizedBetter
            ? <span className="text-emerald-400 ml-1">— Itemizing saves you ${(totalWithGambling - standardDeduction).toLocaleString()}</span>
            : <span className="text-amber-400 ml-1">— Standard deduction is ${(standardDeduction - totalWithGambling).toLocaleString()} more</span>
          }
        </p>
      </div>

      {!itemizedBetter && (
        <CalloutCard variant="tip" title="Consider the standard deduction">
          Your itemized deductions (${totalWithGambling.toLocaleString()}) are less than the standard deduction (${standardDeduction.toLocaleString()}). You may want to switch to the standard deduction on the Deduction Method page.
        </CalloutCard>
      )}

      {/* Line items with Edit buttons */}
      {lineItems.length > 0 ? (
        <div className="card mt-4">
          <div className="space-y-0 divide-y divide-slate-700/50">
            {lineItems.map((li) => (
              <div key={li.label} className="flex items-center gap-3 py-3">
                <div className="text-telos-orange-400 shrink-0">{li.icon}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-200">{li.label}</span>
                </div>
                <span className="text-sm font-medium text-white tabular-nums">
                  ${li.amount.toLocaleString()}
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
      ) : (
        <div className="card mt-4 text-center py-6">
          <p className="text-slate-400 text-sm">No itemized deductions entered yet.</p>
          <p className="text-xs text-slate-500 mt-1">Use the steps above to enter your deductions.</p>
        </div>
      )}

      {scheduleA && (scheduleA.otherDeduction || 0) > 0 && (
        <div className="card mt-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-400">Other Deductions</span>
            <span className="text-sm font-medium text-white tabular-nums">${scheduleA.otherDeduction.toLocaleString()}</span>
          </div>
        </div>
      )}

      <a href="https://www.irs.gov/forms-pubs/about-schedule-a-form-1040" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation />
    </div>
  );
}
