import { useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateForm1040 } from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import {
  Award, Baby, GraduationCap, PersonStanding, HandCoins, Zap, Banknote,
  HeartHandshake, Leaf, Lightbulb, Fuel, Heart, BookOpen, UserCheck, Globe, Calculator,
} from 'lucide-react';
import CreditsChartSwitcher from '../charts/CreditsChartSwitcher';

export default function CreditsSummaryStep() {
  const { taxReturn, goToStep } = useTaxReturnStore();
  if (!taxReturn) return null;

  const result = useMemo(() => {
    try { return calculateForm1040(taxReturn); } catch { return null; }
  }, [taxReturn]);

  const c = result?.credits;
  const totalNonRefundable = c?.totalNonRefundable || 0;
  const totalRefundable = c?.totalRefundable || 0;
  const totalCredits = c?.totalCredits || 0;

  const creditLines: { label: string; icon: React.ReactNode; amount: number; stepId: string; refundable: boolean }[] = [
    { label: 'Child Tax Credit', icon: <Baby className="w-4 h-4" />, amount: c?.childTaxCredit || 0, stepId: 'child_tax_credit', refundable: false },
    { label: 'Other Dependent Credit', icon: <Baby className="w-4 h-4" />, amount: c?.otherDependentCredit || 0, stepId: 'child_tax_credit', refundable: false },
    { label: 'Additional Child Tax Credit', icon: <Baby className="w-4 h-4" />, amount: c?.actcCredit || 0, stepId: 'child_tax_credit', refundable: true },
    { label: 'Education Credit', icon: <GraduationCap className="w-4 h-4" />, amount: c?.educationCredit || 0, stepId: 'education_credits', refundable: false },
    { label: 'AOTC (Refundable)', icon: <GraduationCap className="w-4 h-4" />, amount: c?.aotcRefundableCredit || 0, stepId: 'education_credits', refundable: true },
    { label: 'Dependent Care Credit', icon: <PersonStanding className="w-4 h-4" />, amount: c?.dependentCareCredit || 0, stepId: 'dependent_care', refundable: false },
    { label: "Saver's Credit", icon: <HandCoins className="w-4 h-4" />, amount: c?.saversCredit || 0, stepId: 'savers_credit', refundable: false },
    { label: 'Clean Energy Credit', icon: <Zap className="w-4 h-4" />, amount: c?.cleanEnergyCredit || 0, stepId: 'clean_energy', refundable: false },
    { label: 'Energy Efficiency Credit', icon: <Lightbulb className="w-4 h-4" />, amount: c?.energyEfficiencyCredit || 0, stepId: 'energy_efficiency', refundable: false },
    { label: 'Clean Vehicle Credit', icon: <Leaf className="w-4 h-4" />, amount: c?.evCredit || 0, stepId: 'ev_credit', refundable: false },
    { label: 'EV Charging Credit', icon: <Fuel className="w-4 h-4" />, amount: c?.evRefuelingCredit || 0, stepId: 'ev_refueling', refundable: false },
    { label: 'Scholarship Credit', icon: <BookOpen className="w-4 h-4" />, amount: c?.scholarshipCredit || 0, stepId: 'scholarship_credit', refundable: false },
    { label: 'Adoption Credit', icon: <Heart className="w-4 h-4" />, amount: c?.adoptionCredit || 0, stepId: 'adoption_credit', refundable: false },
    { label: 'Premium Tax Credit', icon: <HeartHandshake className="w-4 h-4" />, amount: c?.premiumTaxCredit || 0, stepId: 'premium_tax_credit', refundable: true },
    { label: 'Elderly/Disabled Credit', icon: <UserCheck className="w-4 h-4" />, amount: c?.elderlyDisabledCredit || 0, stepId: 'elderly_disabled', refundable: false },
    { label: 'Prior Year AMT Credit', icon: <Calculator className="w-4 h-4" />, amount: c?.priorYearMinTaxCredit || 0, stepId: 'prior_year_amt_credit', refundable: false },
    { label: 'Foreign Tax Credit', icon: <Globe className="w-4 h-4" />, amount: c?.foreignTaxCredit || 0, stepId: 'foreign_tax_credit', refundable: false },
    { label: 'Earned Income Credit', icon: <Banknote className="w-4 h-4" />, amount: c?.eitcCredit || 0, stepId: 'credits_overview', refundable: true },
    { label: 'Excess SS Tax Credit', icon: <Banknote className="w-4 h-4" />, amount: c?.excessSSTaxCredit || 0, stepId: 'credits_overview', refundable: true },
  ].filter(cl => cl.amount > 0);

  const nonRefundableLines = creditLines.filter(cl => !cl.refundable);
  const refundableLines = creditLines.filter(cl => cl.refundable);

  return (
    <div>
      <SectionIntro
        icon={<Award className="w-8 h-8" />}
        title="Credits Summary"
        description="Here's a breakdown of all tax credits applied to your return."
      />

      {/* Total credits hero */}
      {totalCredits > 0 ? (
        <div className="rounded-xl border p-6 mt-6 text-center bg-emerald-500/10 border-emerald-500/30">
          <p className="text-sm text-slate-400 mb-1">Total Tax Credits</p>
          <p className="text-3xl font-bold text-emerald-400">${totalCredits.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">
            ${totalNonRefundable.toLocaleString()} nonrefundable + ${totalRefundable.toLocaleString()} refundable
          </p>
        </div>
      ) : (
        <div className="rounded-xl border p-6 mt-6 text-center bg-slate-800 border-slate-700">
          <p className="text-sm text-slate-400">No tax credits computed yet.</p>
          <p className="text-xs text-slate-500 mt-1">Select credits on the overview page and enter your data.</p>
        </div>
      )}

      {/* Credits chart (donut / bar switcher) */}
      {creditLines.length >= 2 && (
        <CreditsChartSwitcher
          items={creditLines.map(cl => ({ label: cl.label, value: cl.amount, stepId: cl.stepId, refundable: cl.refundable }))}
          onSliceClick={(stepId) => goToStep(stepId)}
        />
      )}

      {/* Nonrefundable credits */}
      {nonRefundableLines.length > 0 && (
        <div className="card mt-4">
          <h3 className="font-medium text-slate-200 mb-3">Nonrefundable Credits</h3>
          <p className="text-xs text-slate-400 mb-3">Reduce your tax but not below zero.</p>
          <div className="space-y-0 divide-y divide-slate-700/50">
            {nonRefundableLines.map((cl) => (
              <div key={cl.label} className="flex items-center gap-3 py-2.5">
                <div className="text-telos-orange-400 shrink-0">{cl.icon}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-200">{cl.label}</span>
                </div>
                <span className="text-sm font-medium text-white tabular-nums">${cl.amount.toLocaleString()}</span>
                <button
                  onClick={() => goToStep(cl.stepId)}
                  className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors shrink-0"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-slate-600 pt-2 mt-1">
            <span className="text-sm font-medium text-slate-200">Total Nonrefundable</span>
            <span className="text-sm font-bold text-emerald-400 tabular-nums">${totalNonRefundable.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Refundable credits */}
      {refundableLines.length > 0 && (
        <div className="card mt-4">
          <h3 className="font-medium text-slate-200 mb-3">Refundable Credits</h3>
          <p className="text-xs text-slate-400 mb-3">You receive these even if your tax is zero.</p>
          <div className="space-y-0 divide-y divide-slate-700/50">
            {refundableLines.map((cl) => (
              <div key={cl.label} className="flex items-center gap-3 py-2.5">
                <div className="text-telos-orange-400 shrink-0">{cl.icon}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-200">{cl.label}</span>
                </div>
                <span className="text-sm font-medium text-white tabular-nums">${cl.amount.toLocaleString()}</span>
                <button
                  onClick={() => goToStep(cl.stepId)}
                  className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors shrink-0"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-slate-600 pt-2 mt-1">
            <span className="text-sm font-medium text-slate-200">Total Refundable</span>
            <span className="text-sm font-bold text-emerald-400 tabular-nums">${totalRefundable.toLocaleString()}</span>
          </div>
        </div>
      )}

      <StepNavigation />
    </div>
  );
}
