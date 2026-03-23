import { useTaxReturnStore } from '../../store/taxReturnStore';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import {
  DollarSign, Building2, Briefcase, CircleDollarSign, Landmark,
  TrendingUp, PiggyBank, FileSpreadsheet, BarChart3, Coins, ShieldCheck, Home,
  HeartPulse, Wallet, PenLine, ArrowLeft, Globe, Ticket, Wheat, CalendarClock,
} from 'lucide-react';
import { ReactNode, useCallback, useMemo } from 'react';
import StepWarningsBanner from '../common/StepWarningsBanner';
import IncomeChartSwitcher from '../charts/IncomeChartSwitcher';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';

interface IncomeSummaryRow {
  key: string;
  stepId: string;
  label: string;
  icon: ReactNode;
  getCount: (tr: any) => number;
  getTotal: (tr: any) => number;
}

const INCOME_ROWS: IncomeSummaryRow[] = [
  {
    key: 'w2', stepId: 'w2_income', label: 'W-2 Employment',
    icon: <Building2 className="w-4 h-4" />,
    getCount: (tr) => tr.w2Income?.length || 0,
    getTotal: (tr) => (tr.w2Income || []).reduce((s: number, w: any) => s + w.wages, 0),
  },
  {
    key: '1099nec', stepId: '1099nec_income', label: '1099-NEC',
    icon: <Briefcase className="w-4 h-4" />,
    getCount: (tr) => tr.income1099NEC?.length || 0,
    getTotal: (tr) => (tr.income1099NEC || []).reduce((s: number, i: any) => s + i.amount, 0),
  },
  {
    key: '1099k', stepId: '1099k_income', label: '1099-K Platform',
    icon: <CircleDollarSign className="w-4 h-4" />,
    getCount: (tr) => tr.income1099K?.length || 0,
    getTotal: (tr) => (tr.income1099K || []).reduce((s: number, i: any) => s + i.grossAmount, 0),
  },
  {
    key: '1099int', stepId: '1099int_income', label: 'Interest (1099-INT)',
    icon: <Landmark className="w-4 h-4" />,
    getCount: (tr) => tr.income1099INT?.length || 0,
    getTotal: (tr) => (tr.income1099INT || []).reduce((s: number, i: any) => s + i.amount, 0),
  },
  {
    key: '1099oid', stepId: '1099oid_income', label: 'OID Income (1099-OID)',
    icon: <Ticket className="w-4 h-4" />,
    getCount: (tr) => tr.income1099OID?.length || 0,
    getTotal: (tr) => (tr.income1099OID || []).reduce((s: number, o: any) => s + Math.max(0, (o.originalIssueDiscount || 0) - (o.acquisitionPremium || 0)) + (o.otherPeriodicInterest || 0), 0),
  },
  {
    key: '1099div', stepId: '1099div_income', label: 'Dividends (1099-DIV)',
    icon: <TrendingUp className="w-4 h-4" />,
    getCount: (tr) => tr.income1099DIV?.length || 0,
    getTotal: (tr) => (tr.income1099DIV || []).reduce((s: number, i: any) => s + i.ordinaryDividends, 0),
  },
  {
    key: '1099r', stepId: '1099r_income', label: 'Retirement (1099-R)',
    icon: <PiggyBank className="w-4 h-4" />,
    getCount: (tr) => tr.income1099R?.length || 0,
    getTotal: (tr) => (tr.income1099R || []).reduce((s: number, r: any) => s + r.taxableAmount, 0),
  },
  {
    key: '1099g', stepId: '1099g_income', label: 'Unemployment (1099-G)',
    icon: <Landmark className="w-4 h-4" />,
    getCount: (tr) => tr.income1099G?.length || 0,
    getTotal: (tr) => (tr.income1099G || []).reduce((s: number, g: any) => s + g.unemploymentCompensation, 0),
  },
  {
    key: '1099misc', stepId: '1099misc_income', label: 'Misc (1099-MISC)',
    icon: <FileSpreadsheet className="w-4 h-4" />,
    getCount: (tr) => tr.income1099MISC?.length || 0,
    getTotal: (tr) => (tr.income1099MISC || []).reduce((s: number, m: any) => s + m.otherIncome, 0),
  },
  {
    key: '1099b', stepId: '1099b_income', label: 'Capital Gains (1099-B)',
    icon: <BarChart3 className="w-4 h-4" />,
    getCount: (tr) => tr.income1099B?.length || 0,
    getTotal: (tr) => (tr.income1099B || []).reduce((s: number, b: any) => s + (b.proceeds - b.costBasis), 0),
  },
  {
    key: '1099da', stepId: '1099da_income', label: 'Digital Assets (1099-DA)',
    icon: <Coins className="w-4 h-4" />,
    getCount: (tr) => tr.income1099DA?.length || 0,
    getTotal: (tr) => (tr.income1099DA || []).reduce((s: number, d: any) => s + (d.proceeds - d.costBasis), 0),
  },
  {
    key: 'ssa1099', stepId: 'ssa1099_income', label: 'Social Security',
    icon: <ShieldCheck className="w-4 h-4" />,
    getCount: (tr) => tr.incomeSSA1099?.totalBenefits ? 1 : 0,
    getTotal: (tr) => tr.incomeSSA1099?.totalBenefits || 0,
  },
  {
    key: 'k1', stepId: 'k1_income', label: 'Schedule K-1',
    icon: <FileSpreadsheet className="w-4 h-4" />,
    getCount: (tr) => tr.incomeK1?.length || 0,
    getTotal: (tr) => (tr.incomeK1 || []).reduce((s: number, k: any) => s + (k.ordinaryBusinessIncome || 0) + (k.guaranteedPayments || 0), 0),
  },
  {
    key: '1099sa', stepId: '1099sa_income', label: 'HSA Distributions',
    icon: <HeartPulse className="w-4 h-4" />,
    getCount: (tr) => tr.income1099SA?.length || 0,
    getTotal: (tr) => (tr.income1099SA || []).reduce((s: number, d: any) => s + d.grossDistribution, 0),
  },
  {
    key: 'rental', stepId: 'rental_income', label: 'Rental Income',
    icon: <Home className="w-4 h-4" />,
    getCount: (tr) => tr.rentalProperties?.length || 0,
    getTotal: (tr) => (tr.rentalProperties || []).reduce((s: number, r: any) => s + r.rentalIncome, 0),
  },
  {
    key: 'farm_rental', stepId: 'farm_rental', label: 'Farm Rental (4835)',
    icon: <Wheat className="w-4 h-4" />,
    getCount: (tr) => tr.farmRentals?.length || 0,
    getTotal: (tr) => (tr.farmRentals || []).reduce((s: number, fr: any) => {
      const exp = fr.expenses || {};
      const totalExp = (exp.insurance || 0) + (exp.repairs || 0) + (exp.taxes || 0) + (exp.utilities || 0) + (exp.depreciation || 0) + (exp.other || 0);
      return s + Math.max(0, fr.rentalIncome) - totalExp;
    }, 0),
  },
  {
    key: 'installment_sale', stepId: 'installment_sale', label: 'Installment Sales',
    icon: <CalendarClock className="w-4 h-4" />,
    getCount: (tr) => tr.installmentSales?.length || 0,
    getTotal: (tr) => (tr.installmentSales || []).reduce((s: number, sale: any) => {
      const contractPrice = Math.max(0, sale.sellingPrice - (sale.mortgagesAssumedByBuyer || 0));
      const adjustedBasis = Math.max(0, sale.costOrBasis - (sale.depreciationAllowed || 0));
      const grossProfit = Math.max(0, sale.sellingPrice - adjustedBasis - (sale.sellingExpenses || 0));
      const ratio = contractPrice > 0 ? grossProfit / contractPrice : 0;
      return s + Math.round(sale.paymentsReceivedThisYear * Math.min(1, ratio));
    }, 0),
  },
  {
    key: 'other', stepId: 'other_income', label: 'Other Income',
    icon: <Wallet className="w-4 h-4" />,
    getCount: (tr) => (tr.otherIncome || 0) > 0 ? 1 : 0,
    getTotal: (tr) => tr.otherIncome || 0,
  },
];

export default function IncomeSummaryStep() {
  const { taxReturn, goToStep, updateField } = useTaxReturnStore();
  if (!taxReturn) return null;

  const discovery = taxReturn.incomeDiscovery;
  const help = HELP_CONTENT['income_summary'];

  // Schedule B Part III — shown when interest or dividends exceed $1,500
  const totalInterest = (taxReturn.income1099INT || []).reduce((s: number, i: any) => s + (i.amount || 0), 0)
    + (taxReturn.income1099OID || []).reduce((s: number, o: any) => s + Math.max(0, (o.originalIssueDiscount || 0) - (o.acquisitionPremium || 0)) + (o.otherPeriodicInterest || 0), 0)
    + (taxReturn.incomeK1 || []).reduce((s: number, k: any) => s + (k.interestIncome || 0), 0);
  const totalDividends = (taxReturn.income1099DIV || []).reduce((s: number, i: any) => s + (i.ordinaryDividends || 0), 0)
    + (taxReturn.incomeK1 || []).reduce((s: number, k: any) => s + (k.ordinaryDividends || 0), 0);
  const partIII = taxReturn.scheduleBPartIII || {};
  const showScheduleBPartIII = totalInterest > 1500 || totalDividends > 1500
    || partIII.hasForeignAccounts === true || partIII.hasForeignTrust === true;

  const updatePartIII = useCallback((patch: Record<string, unknown>) => {
    updateField('scheduleBPartIII', { ...partIII, ...patch });
  }, [partIII, updateField]);

  // Only show rows the user selected "yes" for
  const activeRows = INCOME_ROWS.filter((r) => discovery[r.key] === 'yes');
  const rowsWithData = activeRows.filter((r) => r.getCount(taxReturn) > 0);
  const rowsMissing = activeRows.filter((r) => r.getCount(taxReturn) === 0);
  const grandTotal = activeRows.reduce((sum, r) => sum + r.getTotal(taxReturn), 0);
  const totalWithholding =
    (taxReturn.w2Income || []).reduce((s: number, w: any) => s + (w.federalTaxWithheld || 0), 0) +
    (taxReturn.income1099R || []).reduce((s: number, r: any) => s + (r.federalTaxWithheld || 0), 0) +
    (taxReturn.income1099G || []).reduce((s: number, g: any) => s + (g.federalTaxWithheld || 0), 0) +
    (taxReturn.income1099DA || []).reduce((s: number, d: any) => s + (d.federalTaxWithheld || 0), 0) +
    (taxReturn.incomeSSA1099?.federalTaxWithheld || 0);

  return (
    <div>
      <StepWarningsBanner stepId="income_summary" />

      <SectionIntro
        icon={<DollarSign className="w-8 h-8" />}
        title="Income Summary"
        description="Here's everything you've entered so far. Review it, then we'll move on to deductions."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {activeRows.length === 0 ? (
        <div className="card mt-6 text-center py-8">
          <p className="text-slate-400 mb-3">No income types selected yet.</p>
          <button
            onClick={() => goToStep('income_overview')}
            className="inline-flex items-center gap-1.5 text-sm text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back to Income Overview
          </button>
        </div>
      ) : (
        <>
          {/* Grand total hero card */}
          <div className="card mt-6 text-center">
            <p className="text-slate-400 text-sm mb-1">Total Income</p>
            <p className="text-3xl font-bold text-white">
              ${grandTotal.toLocaleString()}
            </p>
            {totalWithholding > 0 && (
              <p className="text-sm text-slate-400 mt-1">
                Federal tax withheld: ${totalWithholding.toLocaleString()}
              </p>
            )}
          </div>

          {/* Income chart (donut / bar switcher) */}
          {rowsWithData.length >= 2 && (
            <IncomeChartSwitcher
              items={rowsWithData.map(r => ({ label: r.label, value: r.getTotal(taxReturn), stepId: r.stepId })).filter(i => i.value > 0)}
              onSliceClick={(stepId) => goToStep(stepId)}
            />
          )}

          {/* Income rows with data */}
          {rowsWithData.length > 0 && (
            <div className="card mt-4">
              <h3 className="font-medium text-slate-200 mb-3">Income Entered</h3>
              <div className="space-y-0 divide-y divide-slate-700/50">
                {rowsWithData.map((row) => {
                  const count = row.getCount(taxReturn);
                  const total = row.getTotal(taxReturn);
                  return (
                    <div key={row.key} className="flex items-center gap-3 py-2.5">
                      <div className="text-telos-orange-400 shrink-0">{row.icon}</div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-200">{row.label}</span>
                        <span className="text-xs text-slate-400 ml-2">
                          {count} {count === 1 ? 'form' : 'forms'}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-white tabular-nums">
                        ${total.toLocaleString()}
                      </div>
                      <button
                        onClick={() => goToStep(row.stepId)}
                        className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Income selected but not yet entered */}
          {rowsMissing.length > 0 && (
            <div className="rounded-xl border p-6 mt-4 bg-amber-500/5 border-amber-500/20">
              <h3 className="font-medium text-amber-300 mb-3 flex items-center gap-2">
                <PenLine className="w-4 h-4" />
                Still need data
              </h3>
              <div className="space-y-2">
                {rowsMissing.map((row) => (
                  <div key={row.key} className="flex items-center gap-3">
                    <div className="text-slate-400 shrink-0">{row.icon}</div>
                    <span className="text-sm text-slate-400 flex-1">{row.label}</span>
                    <button
                      onClick={() => goToStep(row.stepId)}
                      className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors shrink-0"
                    >
                      Enter
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total row */}
          <div className="card mt-4 bg-surface-800">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-200">Grand Total</span>
              <span className="text-lg font-bold text-white tabular-nums">
                ${grandTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Schedule B Part III — Foreign Accounts and Trusts */}
      {showScheduleBPartIII && (
        <div className="card mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-telos-blue-400" />
            <h3 className="font-medium text-slate-200">Schedule B — Foreign Accounts</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Because your interest or dividends exceed $1,500, the IRS requires you to answer these questions.
            Schedule B will be auto-generated in your PDF return.
          </p>

          {/* Line 7a */}
          <div className="mb-4">
            <label className="block text-sm text-slate-300 mb-2">
              At any time during 2025, did you have a financial interest in or signature authority over a financial account located in a foreign country?
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => updatePartIII({ hasForeignAccounts: true })}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${partIII.hasForeignAccounts === true ? 'bg-telos-blue-600 text-white' : 'bg-surface-700 text-slate-400 hover:text-slate-200'}`}
              >
                Yes
              </button>
              <button
                onClick={() => updatePartIII({ hasForeignAccounts: false, requireFBAR: undefined, foreignAccountCountries: undefined })}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${partIII.hasForeignAccounts === false ? 'bg-telos-blue-600 text-white' : 'bg-surface-700 text-slate-400 hover:text-slate-200'}`}
              >
                No
              </button>
            </div>
          </div>

          {/* Line 7a follow-up: FBAR requirement */}
          {partIII.hasForeignAccounts === true && (
            <div className="mb-4 ml-4 pl-4 border-l-2 border-telos-blue-500/30">
              <label className="block text-sm text-slate-300 mb-2">
                Are you required to file FinCEN Form 114 (FBAR) to report that financial interest or signature authority?
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => updatePartIII({ requireFBAR: true })}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${partIII.requireFBAR === true ? 'bg-telos-blue-600 text-white' : 'bg-surface-700 text-slate-400 hover:text-slate-200'}`}
                >
                  Yes
                </button>
                <button
                  onClick={() => updatePartIII({ requireFBAR: false })}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${partIII.requireFBAR === false ? 'bg-telos-blue-600 text-white' : 'bg-surface-700 text-slate-400 hover:text-slate-200'}`}
                >
                  No
                </button>
              </div>

              {/* Line 7b: Country names */}
              <div className="mt-3">
                <label className="block text-sm text-slate-300 mb-1">
                  Country name(s) where the foreign account(s) are located:
                </label>
                <input
                  type="text"
                  value={partIII.foreignAccountCountries || ''}
                  onChange={(e) => updatePartIII({ foreignAccountCountries: e.target.value })}
                  placeholder="e.g., United Kingdom, Switzerland"
                  className="input-field w-full"
                />
              </div>
            </div>
          )}

          {/* Line 8 */}
          <div className="mb-1">
            <label className="block text-sm text-slate-300 mb-2">
              During 2025, did you receive a distribution from, or were you the grantor of, or transferor to, a foreign trust?
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => updatePartIII({ hasForeignTrust: true })}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${partIII.hasForeignTrust === true ? 'bg-telos-blue-600 text-white' : 'bg-surface-700 text-slate-400 hover:text-slate-200'}`}
              >
                Yes
              </button>
              <button
                onClick={() => updatePartIII({ hasForeignTrust: false })}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${partIII.hasForeignTrust === false ? 'bg-telos-blue-600 text-white' : 'bg-surface-700 text-slate-400 hover:text-slate-200'}`}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      <StepNavigation />
    </div>
  );
}
