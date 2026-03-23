import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { TrendingUp, ExternalLink } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';

export default function InvestmentInterestStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['investment_interest'];
  const ii = taxReturn.investmentInterest || {
    investmentInterestPaid: 0, priorYearDisallowed: 0,
    electToIncludeQualifiedDividends: false, electToIncludeLTCG: false,
  };

  const update = (field: string, value: number | boolean) => {
    updateField('investmentInterest', { ...ii, [field]: value });
  };

  const save = async () => {
    await updateReturn(returnId, { investmentInterest: taxReturn.investmentInterest });
  };

  return (
    <div>
      <StepWarningsBanner stepId="investment_interest" />

      <SectionIntro
        icon={<TrendingUp className="w-8 h-8" />}
        title="Investment Interest Expense (Form 4952)"
        description="If you borrowed money to buy investments (margin loans, etc.), you may deduct the interest — limited to your net investment income."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="card mt-6">
        <FormField label="Investment Interest Paid (Line 1)" helpText="Interest on margin loans, investment-purpose borrowing" tooltip={help?.fields['Investment Interest Paid (Line 1)']?.tooltip} irsRef={help?.fields['Investment Interest Paid (Line 1)']?.irsRef}>
          <CurrencyInput value={ii.investmentInterestPaid} onChange={(v) => update('investmentInterestPaid', v)} />
        </FormField>
        <FormField label="Prior Year Disallowed Amount (Line 2)" optional helpText="From last year's Form 4952, Line 8" tooltip={help?.fields['Prior Year Disallowed Amount (Line 2)']?.tooltip} irsRef={help?.fields['Prior Year Disallowed Amount (Line 2)']?.irsRef}>
          <CurrencyInput value={ii.priorYearDisallowed || 0} onChange={(v) => update('priorYearDisallowed', v)} />
        </FormField>
      </div>

      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-3">Elections</h3>
        <p className="text-sm text-slate-400 mb-4">
          You can elect to include qualified dividends and/or long-term capital gains in net investment income, which increases your deduction limit but taxes those amounts at ordinary rates instead of preferential rates.
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="accent-telos-orange-400" checked={!!ii.electToIncludeQualifiedDividends} onChange={(e) => update('electToIncludeQualifiedDividends', e.target.checked)} />
            <span className="text-sm text-slate-300">Include qualified dividends in net investment income</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="accent-telos-orange-400" checked={!!ii.electToIncludeLTCG} onChange={(e) => update('electToIncludeLTCG', e.target.checked)} />
            <span className="text-sm text-slate-300">Include net long-term capital gains in net investment income</span>
          </label>
        </div>
        <a href="https://www.irs.gov/forms-pubs/about-form-4952" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
