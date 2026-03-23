import { useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateForm1040 } from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import {
  Briefcase, Receipt, Home, Car, TrendingUp, TrendingDown,
  AlertTriangle, PenLine, HeartPulse, PiggyBank, Cog,
} from 'lucide-react';
import SEFlowSwitcher from '../charts/SEFlowSwitcher';
import { getExpenseCategories } from '../../api/client';

export default function SelfEmploymentSummaryStep() {
  const { taxReturn, goToStep } = useTaxReturnStore();
  if (!taxReturn) return null;

  const result = useMemo(() => {
    try { return calculateForm1040(taxReturn); } catch { return null; }
  }, [taxReturn]);

  const schedC = result?.scheduleC;
  const f = result?.form1040;
  const businesses = taxReturn.businesses || (taxReturn.business ? [taxReturn.business] : []);
  const hasBusiness = businesses.length > 0 && businesses.some((b) => b.businessName);

  const grossReceipts = schedC?.grossReceipts || 0;
  const netProfit = schedC?.netProfit || 0;
  const isProfit = netProfit >= 0;

  // SE deductions from calculation
  const seHealthInsurance = f?.selfEmployedHealthInsurance || 0;
  const seRetirement = f?.retirementContributions || 0;
  const seTaxDeductible = f?.seDeduction || 0;

  // Completeness checks
  const hasExpenses = (taxReturn.expenses || []).length > 0;
  const hasHomeOffice = !!taxReturn.homeOffice && (taxReturn.homeOffice.squareFeet || 0) > 0;
  const hasVehicle = !!taxReturn.vehicle && ((taxReturn.vehicle.totalMiles || 0) > 0 || (taxReturn.vehicle.businessMiles || 0) > 0);
  const missingSteps: { label: string; stepId: string }[] = [];
  if (!hasBusiness) missingSteps.push({ label: 'Business Info', stepId: 'business_info' });
  if (!hasExpenses) missingSteps.push({ label: 'Expenses', stepId: 'expense_categories' });

  // Build individual expense items for the Sankey from lineItems
  const expenseItems = useMemo(() => {
    const lineItems = schedC?.lineItems || {};
    const categories = getExpenseCategories();
    // Map both by line number and by "line + suffix" (e.g., "24a" → Travel, "24b" → Meals)
    const catByKey = new Map(categories.map(c => [c.category_key, c.display_name]));
    const catByLine = new Map(categories.map(c => [String(c.schedule_c_line), c.display_name]));
    const SPLIT_LABELS: Record<string, string> = { '24a': 'Travel', '24b': 'Business Meals' };
    // Lines 9 (car/truck) and 13 (depreciation) are handled separately as vehicle/depreciation props
    return Object.entries(lineItems)
      .filter(([line, val]) => val > 0 && !['9', '13'].includes(line))
      .map(([line, val]) => ({
        label: SPLIT_LABELS[line] || catByLine.get(line) || catByKey.get(line) || `Line ${line}`,
        amount: val,
        stepId: 'expense_categories',
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [schedC]);

  // SE tax
  const seTax = f?.seTax || 0;

  const editBtn = (stepId: string) => (
    <button
      onClick={() => goToStep(stepId)}
      className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors shrink-0"
    >
      Edit
    </button>
  );

  return (
    <div>
      <StepWarningsBanner stepId="se_summary" />

      <SectionIntro
        icon={<Briefcase className="w-8 h-8" />}
        title="Self-Employment Summary"
        description="Here's a complete snapshot of your business income, expenses, and SE deductions."
        transition="Nice work! Let's make sure everything looks right."
      />

      {/* Net Profit hero card */}
      <div className={`rounded-xl border p-6 mt-6 text-center ${isProfit ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
        <p className="text-slate-400 text-sm mb-1">{isProfit ? 'Net Profit' : 'Net Loss'}</p>
        <p className={`text-3xl font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
          ${Math.abs(netProfit).toLocaleString()}
        </p>
        {grossReceipts > 0 && (
          <p className="text-xs text-slate-400 mt-1">
            ${grossReceipts.toLocaleString()} income − ${(schedC?.totalExpenses || 0).toLocaleString()} expenses
            {(schedC?.homeOfficeDeduction || 0) > 0 && ` − $${schedC!.homeOfficeDeduction.toLocaleString()} home office`}
            {(schedC?.vehicleDeduction || 0) > 0 && ` − $${schedC!.vehicleDeduction.toLocaleString()} vehicle`}
          </p>
        )}
      </div>

      {/* Waterfall / Sankey switcher */}
      <SEFlowSwitcher
        grossReceipts={grossReceipts}
        returnsAndAllowances={schedC?.returnsAndAllowances || 0}
        otherBusinessIncome={schedC?.otherBusinessIncome || 0}
        cogs={schedC?.costOfGoodsSold || 0}
        totalExpenses={schedC?.totalExpenses || 0}
        expenses={expenseItems}
        homeOffice={schedC?.homeOfficeDeduction || 0}
        vehicle={schedC?.vehicleDeduction || 0}
        depreciation={schedC?.depreciationDeduction || 0}
        netProfit={netProfit}
        seHealthInsurance={seHealthInsurance}
        seRetirement={seRetirement}
        seTaxDeductibleHalf={seTaxDeductible}
        onBarClick={(stepId) => goToStep(stepId)}
      />

      {/* Business info card */}
      {hasBusiness && (
        <div className="card mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-slate-200 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-telos-orange-400" />
              {businesses.length === 1 ? 'Your Business' : 'Your Businesses'}
            </h3>
            {editBtn('business_info')}
          </div>
          <div className="space-y-0 divide-y divide-slate-700/50">
            {businesses.map((biz) => (
              <div key={biz.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="text-sm text-slate-200">{biz.businessName || 'Unnamed Business'}</span>
                  {biz.businessDescription && (
                    <span className="text-xs text-slate-400 ml-2">{biz.businessDescription}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule C Breakdown */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-telos-orange-400" />
          Schedule C Breakdown
        </h3>
        <div className="space-y-0 divide-y divide-slate-700/50">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-300">Gross Receipts</span>
            <span className="text-sm font-medium text-white tabular-nums">${grossReceipts.toLocaleString()}</span>
          </div>
          {(schedC?.costOfGoodsSold || 0) > 0 && (
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-slate-300">Cost of Goods Sold</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white tabular-nums">-${schedC!.costOfGoodsSold.toLocaleString()}</span>
                {editBtn('cost_of_goods_sold')}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-300">Business Expenses</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white tabular-nums">-${(schedC?.totalExpenses || 0).toLocaleString()}</span>
              {editBtn('expense_categories')}
            </div>
          </div>
          {hasHomeOffice && (
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-slate-300 flex items-center gap-1.5"><Home className="w-3.5 h-3.5 text-slate-400" />Home Office</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white tabular-nums">-${(schedC?.homeOfficeDeduction || 0).toLocaleString()}</span>
                {editBtn('home_office')}
              </div>
            </div>
          )}
          {hasVehicle && (
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-slate-300 flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-slate-400" />Vehicle</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white tabular-nums">-${(schedC?.vehicleDeduction || 0).toLocaleString()}</span>
                {editBtn('vehicle_expenses')}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-600 pt-2 mt-1">
            <span className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
              {isProfit ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
              Net {isProfit ? 'Profit' : 'Loss'}
            </span>
            <span className={`text-sm font-bold tabular-nums ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
              ${Math.abs(netProfit).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* SE Deductions card */}
      {(seHealthInsurance > 0 || seRetirement > 0 || seTaxDeductible > 0) && (
        <div className="card mt-4">
          <h3 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
            <Cog className="w-4 h-4 text-telos-orange-400" />
            SE Deductions (Above-the-Line)
          </h3>
          <p className="text-xs text-slate-400 mb-3">These reduce your AGI — they're not part of Schedule C but are computed from your self-employment income.</p>
          <div className="space-y-0 divide-y divide-slate-700/50">
            {seHealthInsurance > 0 && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-slate-300 flex items-center gap-1.5"><HeartPulse className="w-3.5 h-3.5 text-slate-400" />Health Insurance</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white tabular-nums">-${seHealthInsurance.toLocaleString()}</span>
                  {editBtn('se_health_insurance')}
                </div>
              </div>
            )}
            {seRetirement > 0 && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-slate-300 flex items-center gap-1.5"><PiggyBank className="w-3.5 h-3.5 text-slate-400" />Retirement (SEP/Solo 401k)</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white tabular-nums">-${seRetirement.toLocaleString()}</span>
                  {editBtn('se_retirement')}
                </div>
              </div>
            )}
            {seTaxDeductible > 0 && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-slate-300">SE Tax Deduction (50%)</span>
                <span className="text-sm font-medium text-white tabular-nums">-${seTaxDeductible.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SE Tax preview */}
      {seTax > 0 && (
        <div className="card mt-4 bg-surface-800">
          <h3 className="font-medium text-slate-200 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Self-Employment Tax
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            In addition to income tax, self-employment income is subject to Social Security and Medicare taxes (15.3%).
          </p>
          <div className="flex justify-between text-xs border-t border-slate-700 pt-1.5">
            <span className="text-slate-300 font-medium">Total SE Tax</span>
            <span className="text-amber-400 font-medium">${seTax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-400">Deductible half (reduces AGI)</span>
            <span className="text-white">-${seTaxDeductible.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Missing data warning */}
      {missingSteps.length > 0 && (
        <div className="rounded-xl border p-6 mt-4 bg-amber-500/5 border-amber-500/20">
          <h3 className="font-medium text-amber-300 mb-3 flex items-center gap-2">
            <PenLine className="w-4 h-4" />
            Still needs attention
          </h3>
          <div className="space-y-2">
            {missingSteps.map((s) => (
              <div key={s.stepId} className="flex items-center justify-between">
                <span className="text-sm text-slate-400">{s.label}</span>
                <button
                  onClick={() => goToStep(s.stepId)}
                  className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors"
                >
                  Enter
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
