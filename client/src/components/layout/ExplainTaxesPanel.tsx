import { useState, useEffect, useRef } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { ChevronDown, ChevronUp, ArrowRight, X } from 'lucide-react';
import type { CalculationTrace } from '@telostax/engine';
import { formatCurrency, formatPercent } from '../../utils/format';
import TraceDisclosure from '../common/TraceDisclosure';

interface ExplainTaxesPanelProps {
  /** Controlled open state (from WizardLayout). */
  open: boolean;
  /** Called when the user dismisses the panel (e.g. close button). */
  onClose?: () => void;
}

export default function ExplainTaxesPanel({ open, onClose }: ExplainTaxesPanelProps) {
  const calculation = useTaxReturnStore((s) => s.calculation);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Focus close button when panel opens
  useEffect(() => {
    if (open && calculation) closeBtnRef.current?.focus();
  }, [open, calculation]);

  if (!calculation || !open) return null;

  const f = calculation.form1040;
  const isRefund = f.refundAmount > 0;
  const traces = calculation.traces;

  /** Find a trace by lineId. */
  const findTrace = (lineId: string) => traces?.find((t) => t.lineId === lineId);

  return (
    <div id="explain-taxes-panel" className="bg-surface-800 border-b border-slate-700">
      <div className="max-w-6xl mx-auto px-4">
          <div className="pb-4 pt-2 space-y-4">
            {/* Panel header with close button */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">Tax Breakdown</h3>
              {onClose && (
                <button
                  ref={closeBtnRef}
                  onClick={onClose}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  aria-label="Close tax breakdown"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Income Breakdown */}
            <div className="bg-surface-900 rounded-lg p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Your Income</h4>
              <div className="space-y-2">
                {f.totalWages > 0 && (
                  <ExplainRow label="W-2 Wages" amount={f.totalWages} />
                )}
                {f.scheduleCNetProfit !== 0 && (
                  <ExplainRow label={`Self-Employment ${f.scheduleCNetProfit >= 0 ? 'Profit' : 'Loss'} (Schedule C)`} amount={f.scheduleCNetProfit} favorable={f.scheduleCNetProfit < 0} />
                )}
                {f.totalInterest > 0 && (
                  <ExplainRow label="Interest Income" amount={f.totalInterest} />
                )}
                {f.totalDividends > 0 && (
                  <ExplainRow label="Dividend Income" amount={f.totalDividends} />
                )}
                {f.totalRetirementIncome > 0 && (
                  <ExplainRow label="Retirement Distributions (1099-R)" amount={f.totalRetirementIncome} />
                )}
                {f.totalUnemployment > 0 && (
                  <ExplainRow label="Unemployment Compensation (1099-G)" amount={f.totalUnemployment} />
                )}
                {f.total1099MISCIncome > 0 && (
                  <ExplainRow label="Miscellaneous Income (1099-MISC)" amount={f.total1099MISCIncome} />
                )}
                {f.capitalGainOrLoss !== 0 && (
                  <ExplainRow label="Capital Gains/Losses (1099-B)" amount={f.capitalGainOrLoss} favorable={f.capitalGainOrLoss < 0} />
                )}
                {f.k1OrdinaryIncome > 0 && (
                  <ExplainRow label="K-1 Business Income" amount={f.k1OrdinaryIncome} />
                )}
                {f.taxableSocialSecurity > 0 && (
                  <ExplainRow label={`Social Security (taxable portion of ${formatCurrency(f.socialSecurityBenefits)})`} amount={f.taxableSocialSecurity} />
                )}
                {f.scheduleEIncome !== 0 && (
                  <ExplainRow label="Rental & Royalty Income (Schedule E)" amount={f.scheduleEIncome} favorable={f.scheduleEIncome < 0} />
                )}
                {f.hsaDistributionTaxable > 0 && (
                  <ExplainRow label="Taxable HSA Distributions" amount={f.hsaDistributionTaxable} />
                )}
                {f.totalGamblingIncome > 0 && (
                  <ExplainRow label="Gambling Winnings (W-2G)" amount={f.totalGamblingIncome} />
                )}
                {f.scheduleFNetProfit !== 0 && (
                  <ExplainRow label={`Farm ${f.scheduleFNetProfit >= 0 ? 'Income' : 'Loss'} (Schedule F)`} amount={f.scheduleFNetProfit} favorable={f.scheduleFNetProfit < 0} />
                )}
                {f.alimonyReceivedIncome > 0 && (
                  <ExplainRow label="Alimony Received (pre-2019)" amount={f.alimonyReceivedIncome} />
                )}
                {f.cancellationOfDebtIncome > 0 && (
                  <ExplainRow label="Cancellation of Debt (1099-C)" amount={f.cancellationOfDebtIncome} />
                )}
                {f.taxable529Income > 0 && (
                  <ExplainRow label="Taxable 529 Distribution" amount={f.taxable529Income} />
                )}
                {f.form4797OrdinaryIncome > 0 && (
                  <ExplainRow label="Business Property Sales (Form 4797)" amount={f.form4797OrdinaryIncome} />
                )}
                {f.rothConversionTaxable > 0 && (
                  <ExplainRow label="Taxable Roth Conversion" amount={f.rothConversionTaxable} />
                )}
                <ExplainRow label="Total Income" amount={f.totalIncome} bold trace={findTrace('form1040.line9')} />
              </div>
            </div>

            {/* Adjustments */}
            {f.totalAdjustments > 0 && (
              <div className="bg-surface-900 rounded-lg p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Adjustments <span className="text-telos-orange-500">(reduce your income)</span>
                </h4>
                <div className="space-y-2">
                  {f.seDeduction > 0 && (
                    <ExplainRow label="Self-Employment Tax Deduction (50%)" amount={-f.seDeduction} favorable />
                  )}
                  {f.selfEmployedHealthInsurance > 0 && (
                    <ExplainRow label="SE Health Insurance" amount={-f.selfEmployedHealthInsurance} favorable />
                  )}
                  {f.retirementContributions > 0 && (
                    <ExplainRow label="Retirement Contributions" amount={-f.retirementContributions} favorable />
                  )}
                  {f.hsaDeduction > 0 && (
                    <ExplainRow label="HSA Contributions" amount={-f.hsaDeduction} favorable />
                  )}
                  {f.studentLoanInterest > 0 && (
                    <ExplainRow label="Student Loan Interest" amount={-f.studentLoanInterest} favorable />
                  )}
                  {f.iraDeduction > 0 && (
                    <ExplainRow label="Traditional IRA Deduction" amount={-f.iraDeduction} favorable />
                  )}
                  {f.educatorExpenses > 0 && (
                    <ExplainRow label="Educator Expenses" amount={-f.educatorExpenses} favorable />
                  )}
                  {f.alimonyDeduction > 0 && (
                    <ExplainRow label="Alimony Paid (pre-2019)" amount={-f.alimonyDeduction} favorable />
                  )}
                </div>
              </div>
            )}

            {/* AGI and Deductions */}
            <div className="bg-surface-900 rounded-lg p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Deductions</h4>
              <div className="space-y-2">
                <ExplainRow label="Adjusted Gross Income (AGI)" amount={f.agi} bold trace={findTrace('form1040.line11')} />
                <div className="flex items-center gap-1 text-xs text-slate-400 -mt-1 mb-1">
                  <ArrowRight className="w-3 h-3" />
                  <span>
                    Using {f.deductionUsed === 'standard' ? 'standard' : 'itemized'} deduction
                  </span>
                </div>
                <ExplainRow
                  label={f.deductionUsed === 'standard' ? 'Standard Deduction' : 'Itemized Deductions'}
                  amount={-f.deductionAmount}
                  favorable
                />
                {f.qbiDeduction > 0 && (
                  <ExplainRow label="QBI Deduction (20%)" amount={-f.qbiDeduction} favorable />
                )}
                <ExplainRow label="Taxable Income" amount={f.taxableIncome} bold trace={findTrace('form1040.line15')} />
              </div>
            </div>

            {/* Tax Calculation */}
            <div className="bg-surface-900 rounded-lg p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Tax Calculation</h4>
              <div className="space-y-2">
                <ExplainRow
                  label={`Income Tax (${formatPercent(f.marginalTaxRate, 0)} bracket)`}
                  amount={f.incomeTax}
                  trace={findTrace('form1040.line16')}
                />
                {f.seTax > 0 && (
                  <ExplainRow label="Self-Employment Tax (15.3%)" amount={f.seTax} />
                )}
                {f.amtAmount > 0 && (
                  <ExplainRow label="Alternative Minimum Tax (AMT)" amount={f.amtAmount} />
                )}
                {f.niitTax > 0 && (
                  <ExplainRow label="Net Investment Income Tax (3.8%)" amount={f.niitTax} />
                )}
                {f.additionalMedicareTaxW2 > 0 && (
                  <ExplainRow label="Additional Medicare Tax (0.9%)" amount={f.additionalMedicareTaxW2} />
                )}
                {f.earlyDistributionPenalty > 0 && (
                  <ExplainRow label="Early Distribution Penalty (10%)" amount={f.earlyDistributionPenalty} />
                )}
                {f.penalty529 > 0 && (
                  <ExplainRow label="529 Non-Qualified Penalty (10%)" amount={f.penalty529} />
                )}
                {f.hsaDistributionPenalty > 0 && (
                  <ExplainRow label="HSA Non-Qualified Penalty (20%)" amount={f.hsaDistributionPenalty} />
                )}
                {f.estimatedTaxPenalty > 0 && (
                  <ExplainRow label="Underpayment Penalty" amount={f.estimatedTaxPenalty} />
                )}
              </div>
            </div>

            {/* Credits */}
            {f.totalCredits > 0 && (
              <div className="bg-surface-900 rounded-lg p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Credits <span className="text-emerald-500">(reduce your tax)</span>
                </h4>
                <div className="space-y-2">
                  {(() => {
                    const c = calculation.credits;
                    return (
                      <>
                        {c.childTaxCredit > 0 && <ExplainRow label="Child Tax Credit" amount={-c.childTaxCredit} favorable />}
                        {c.otherDependentCredit > 0 && <ExplainRow label="Other Dependent Credit" amount={-c.otherDependentCredit} favorable />}
                        {c.actcCredit > 0 && <ExplainRow label="Additional Child Tax Credit (refundable)" amount={-c.actcCredit} favorable />}
                        {c.eitcCredit > 0 && <ExplainRow label="Earned Income Tax Credit (refundable)" amount={-c.eitcCredit} favorable />}
                        {c.educationCredit > 0 && <ExplainRow label="Education Credit" amount={-c.educationCredit} favorable />}
                        {c.aotcRefundableCredit > 0 && <ExplainRow label="AOTC Refundable Portion" amount={-c.aotcRefundableCredit} favorable />}
                        {c.dependentCareCredit > 0 && <ExplainRow label="Child & Dependent Care Credit" amount={-c.dependentCareCredit} favorable />}
                        {c.saversCredit > 0 && <ExplainRow label="Saver's Credit" amount={-c.saversCredit} favorable />}
                        {c.foreignTaxCredit > 0 && <ExplainRow label="Foreign Tax Credit" amount={-c.foreignTaxCredit} favorable />}
                        {c.cleanEnergyCredit > 0 && <ExplainRow label="Clean Energy Credit" amount={-c.cleanEnergyCredit} favorable />}
                        {c.evCredit > 0 && <ExplainRow label="Clean Vehicle Credit (EV)" amount={-c.evCredit} favorable />}
                        {c.energyEfficiencyCredit > 0 && <ExplainRow label="Energy Efficiency Credit" amount={-c.energyEfficiencyCredit} favorable />}
                        {c.adoptionCredit > 0 && <ExplainRow label="Adoption Credit" amount={-c.adoptionCredit} favorable />}
                        {c.elderlyDisabledCredit > 0 && <ExplainRow label="Elderly/Disabled Credit" amount={-c.elderlyDisabledCredit} favorable />}
                        {c.premiumTaxCredit > 0 && <ExplainRow label="Premium Tax Credit" amount={-c.premiumTaxCredit} favorable />}
                        {c.excessSSTaxCredit > 0 && <ExplainRow label="Excess Social Security Tax" amount={-c.excessSSTaxCredit} favorable />}
                      </>
                    );
                  })()}
                  <ExplainRow label="Total Tax After Credits" amount={f.taxAfterCredits} bold trace={findTrace('form1040.line24')} />
                </div>
              </div>
            )}

            {/* Payments & Result */}
            <div className={`rounded-lg p-4 ${isRefund ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Bottom Line</h4>
              <div className="space-y-2">
                <ExplainRow label="Tax Owed" amount={f.taxAfterCredits} />
                {f.totalWithholding > 0 && (
                  <ExplainRow label="Already Withheld (W-2s, etc.)" amount={-f.totalWithholding} favorable />
                )}
                {f.estimatedPayments > 0 && (
                  <ExplainRow label="Estimated Tax Payments" amount={-f.estimatedPayments} favorable />
                )}
                <div className="border-t border-slate-700 pt-2 mt-2">
                  {isRefund ? (
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-emerald-300">Estimated Refund</span>
                      <span className="text-xl font-bold text-emerald-400">
                        {formatCurrency(f.refundAmount)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-amber-300">Estimated Amount Owed</span>
                      <span className="text-xl font-bold text-amber-400">
                        {formatCurrency(f.amountOwed)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* State Tax Section — shown when state returns are present */}
            {(() => {
              const stateResults = calculation.stateResults ?? [];
              if (stateResults.length === 0) return null;
              return (
              <div className="bg-surface-900 rounded-lg p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">State Taxes</h4>
                <div className="space-y-3">
                  {stateResults.map((sr, srIdx) => {
                    const stateRefund = sr.stateRefundOrOwed > 0;
                    return (
                      <div key={sr.stateCode} className="space-y-2">
                        {stateResults.length > 1 && (
                          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span>{sr.stateName} ({sr.stateCode})</span>
                            <span className="text-slate-600">· {sr.residencyType.replace('_', '-')}</span>
                          </div>
                        )}
                        <ExplainRow label="Federal AGI" amount={sr.federalAGI} />
                        {sr.stateAdditions > 0 && (
                          <ExplainRow label="State Additions" amount={sr.stateAdditions} />
                        )}
                        {sr.stateSubtractions > 0 && (
                          <ExplainRow label="State Subtractions" amount={-sr.stateSubtractions} favorable />
                        )}
                        <ExplainRow label="State Taxable Income" amount={sr.stateTaxableIncome} bold />
                        <ExplainRow label={`${sr.stateName} Income Tax`} amount={sr.stateIncomeTax} />
                        {sr.stateCredits > 0 && (
                          <ExplainRow label="State Credits" amount={-sr.stateCredits} favorable />
                        )}
                        {sr.localTax > 0 && (
                          <ExplainRow label="Local Tax" amount={sr.localTax} />
                        )}
                        <ExplainRow label={`Total ${sr.stateCode} Tax`} amount={sr.totalStateTax} bold />
                        {sr.stateWithholding > 0 && (
                          <ExplainRow label="State Withholding" amount={-sr.stateWithholding} favorable />
                        )}
                        {sr.stateEstimatedPayments > 0 && (
                          <ExplainRow label="State Estimated Payments" amount={-sr.stateEstimatedPayments} favorable />
                        )}
                        <div className="border-t border-slate-700 pt-2 mt-1">
                          <div className="flex justify-between items-center">
                            <span className={`text-sm font-semibold ${stateRefund ? 'text-emerald-300' : 'text-amber-300'}`}>
                              {stateRefund ? `${sr.stateCode} Refund` : `${sr.stateCode} Owed`}
                            </span>
                            <span className={`text-sm font-bold font-mono ${stateRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {formatCurrency(Math.abs(sr.stateRefundOrOwed))}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            Effective rate: {formatPercent(sr.effectiveStateRate)}
                          </div>
                        </div>
                        {/* Separator between multiple states */}
                        {stateResults.length > 1 && srIdx < stateResults.length - 1 && (
                          <div className="border-b border-slate-700/50 pb-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}

            {/* Helpful context */}
            <p className="text-xs text-slate-400 text-center">
              This estimate updates in real-time as you enter data. Your final tax may differ slightly.
            </p>
          </div>
      </div>
    </div>
  );
}

// ─── ExplainRow ──────────────────────────────────────

function ExplainRow({ label, amount, bold, favorable, trace }: {
  label: string;
  amount: number;
  bold?: boolean;
  favorable?: boolean;
  trace?: CalculationTrace;
}) {
  const isNegative = amount < 0;
  const display = formatCurrency(amount);

  return (
    <div>
      <div className={`flex justify-between items-center ${bold ? 'border-t border-slate-700 pt-2 mt-1' : ''}`}>
        <span className={`text-sm ${bold ? 'font-semibold text-slate-200' : 'text-slate-400'}`}>
          {label}
        </span>
        <span className={`text-sm font-mono ${
          bold ? 'font-semibold text-slate-200' :
          favorable || isNegative ? 'text-emerald-400' :
          'text-slate-300'
        }`}>
          {display}
        </span>
      </div>
      {trace && <TraceDisclosure trace={trace} />}
    </div>
  );
}
