import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateScheduleC } from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { FileText, Info } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';

export default function ReviewScheduleCStep() {
  const { taxReturn } = useTaxReturnStore();
  if (!taxReturn) return null;

  const schedC = calculateScheduleC(taxReturn);
  const help = HELP_CONTENT['review_schedule_c'];

  const LineRow = ({ label, line, amount }: { label: string; line?: number | string; amount: number }) => (
    <div className="flex justify-between py-2 border-b border-slate-700/50">
      <span className="text-slate-300">
        {line && <span className="text-slate-400 text-xs mr-2">Line {line}</span>}
        {label}
      </span>
      <span className="text-white font-medium">
        ${Math.abs(amount).toLocaleString()}
      </span>
    </div>
  );

  // Sort line items with special handling for 24a/24b
  const sortedLineItems = Object.entries(schedC.lineItems).sort(([a], [b]) => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    return numA - numB;
  });

  return (
    <div>
      <SectionIntro
        icon={<FileText className="w-8 h-8" />}
        title="Schedule C Review"
        description="Review your business income and expenses."
        transition="Almost done! Let's review everything to make sure it looks right."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="card mt-6">
        <h3 className="font-medium text-slate-200 mb-4">Profit or Loss from Business</h3>

        {/* Lines 1-7: Gross Income Pipeline */}
        <LineRow label="Gross Receipts" line={1} amount={schedC.grossReceipts} />
        {schedC.returnsAndAllowances > 0 && (
          <LineRow label="Returns & Allowances" line={2} amount={schedC.returnsAndAllowances} />
        )}
        {schedC.costOfGoodsSold > 0 && (
          <LineRow label="Cost of Goods Sold" line={4} amount={schedC.costOfGoodsSold} />
        )}
        <LineRow label="Gross Income" line={7} amount={schedC.grossIncome} />

        {/* Expense line items */}
        {sortedLineItems.map(([line, amount]) => {
          const label = line === '24a' ? 'Travel' : line === '24b' ? 'Meals (50%)' : 'Expenses';
          return <LineRow key={line} label={label} line={line} amount={amount} />;
        })}

        <LineRow label="Total Expenses" line={28} amount={schedC.totalExpenses} />

        <div className="border-t-2 border-slate-600 mt-2 pt-2">
          <LineRow label="Tentative Profit" line={29} amount={schedC.tentativeProfit} />
        </div>

        {schedC.homeOfficeDeduction > 0 && (
          <LineRow label="Home Office Deduction" line={30} amount={schedC.homeOfficeDeduction} />
        )}

        {schedC.vehicleDeduction > 0 && (
          <>
            <LineRow label="Vehicle Deduction" amount={schedC.vehicleDeduction} />
            {schedC.vehicleResult && (
              <div className="pl-4 text-xs text-slate-400 pb-2 space-y-0.5">
                {schedC.vehicleResult.method === 'actual' ? (
                  <>
                    <div className="flex justify-between">
                      <span>Method: Actual Expenses</span>
                      <span>Business use: {(schedC.vehicleResult.businessUsePercentage * 100).toFixed(1)}%</span>
                    </div>
                    {schedC.vehicleResult.businessPortionExpenses != null && schedC.vehicleResult.businessPortionExpenses > 0 && (
                      <div className="flex justify-between">
                        <span>Operating expenses (business portion)</span>
                        <span>${schedC.vehicleResult.businessPortionExpenses.toLocaleString()}</span>
                      </div>
                    )}
                    {schedC.vehicleResult.depreciationAllowed != null && schedC.vehicleResult.depreciationAllowed > 0 && (
                      <div className="flex justify-between">
                        <span>Depreciation{schedC.vehicleResult.section280FApplied ? ' (Section 280F limited)' : ''}</span>
                        <span>${schedC.vehicleResult.depreciationAllowed.toLocaleString()}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div>Method: Standard Mileage (${schedC.vehicleResult.standardDeduction?.toLocaleString() ?? '0'})</div>
                )}
              </div>
            )}
            {schedC.line9Suppressed && schedC.suppressedLine9Amount != null && schedC.suppressedLine9Amount > 0 && (
              <div className="mx-1 mb-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  ${schedC.suppressedLine9Amount.toLocaleString()} in Car & Truck expenses (Line 9) was excluded from total expenses — the vehicle deduction above covers these costs.
                </p>
              </div>
            )}
            {schedC.line19Suppressed && schedC.suppressedLine19Amount != null && schedC.suppressedLine19Amount > 0 && (
              <div className="mx-1 mb-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  ${schedC.suppressedLine19Amount.toLocaleString()} in Pension & Profit-Sharing (Line 19) was excluded — this line is for employee plans only. Your own retirement contributions deduct on Schedule 1, Line 16 (SE Retirement Plans page).
                </p>
              </div>
            )}
          </>
        )}

        <div className="border-t-2 border-slate-600 mt-2 pt-2">
          <div className="flex justify-between py-2">
            <span className="text-white font-semibold">Net Profit (Loss)</span>
            <span className={`text-lg font-bold ${schedC.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${schedC.netProfit.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Per-business breakdown for multi-business filers */}
      {schedC.businessResults && schedC.businessResults.length > 1 && (
        <div className="card mt-4">
          <h3 className="font-medium text-slate-200 mb-4">Per-Business Breakdown</h3>
          {schedC.businessResults.map((biz) => (
            <div key={biz.businessId} className="flex justify-between items-center py-3 border-b border-slate-700/50 last:border-b-0">
              <span className="text-slate-300 font-medium">{biz.businessName || 'Unnamed Business'}</span>
              <div className="text-right">
                <div className="text-sm text-slate-400">
                  Income: ${biz.grossIncome.toLocaleString()} &middot; Expenses: ${biz.totalExpenses.toLocaleString()}
                </div>
                <div className={`font-medium ${biz.netProfit >= 0 ? 'text-white' : 'text-red-400'}`}>
                  Net: {biz.netProfit < 0 ? '-' : ''}${Math.abs(biz.netProfit).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <StepNavigation />
    </div>
  );
}
