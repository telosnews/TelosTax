import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';

export default function Form8606Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['form8606'];
  const f = taxReturn.form8606 || {
    nondeductibleContributions: 0, priorYearBasis: 0,
    traditionalIRABalance: 0, rothConversionAmount: 0,
  };

  const update = (field: string, value: number) => {
    updateField('form8606', { ...f, [field]: value });
  };

  const save = async () => {
    await updateReturn(returnId, { form8606: taxReturn.form8606 });
  };

  // Pro-rata calculation preview
  const totalBasis = (f.nondeductibleContributions || 0) + (f.priorYearBasis || 0);
  const conversionAmount = f.rothConversionAmount || 0;
  const iraBalance = f.traditionalIRABalance || 0;
  const hasConversion = conversionAmount > 0 && iraBalance > 0;
  const taxFreeRatio = hasConversion ? totalBasis / (iraBalance + conversionAmount) : 0;
  const taxableConversion = hasConversion ? Math.round(conversionAmount * (1 - taxFreeRatio)) : 0;

  return (
    <div>
      <StepWarningsBanner stepId="form8606" />

      <SectionIntro
        icon={<RefreshCw className="w-8 h-8" />}
        title="Nondeductible IRAs & Roth Conversions (Form 8606)"
        description="Track your nondeductible IRA basis and calculate the taxable portion of any Roth conversion."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="card mt-6">
        <h3 className="font-medium text-slate-200 mb-3">Nondeductible IRA Basis</h3>
        <FormField label="Current Year Nondeductible Contributions" helpText="Traditional IRA contributions that were NOT deductible" tooltip={help?.fields['Current Year Nondeductible Contributions']?.tooltip} irsRef={help?.fields['Current Year Nondeductible Contributions']?.irsRef}>
          <CurrencyInput value={f.nondeductibleContributions || 0} onChange={(v) => update('nondeductibleContributions', v)} />
        </FormField>
        <FormField label="Prior Year Basis (Line 2)" helpText="Total nondeductible basis carried forward from prior years" tooltip={help?.fields['Prior Year Basis (Line 2)']?.tooltip} irsRef={help?.fields['Prior Year Basis (Line 2)']?.irsRef}>
          <CurrencyInput value={f.priorYearBasis || 0} onChange={(v) => update('priorYearBasis', v)} />
        </FormField>
      </div>

      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-3">Roth Conversion</h3>
        <FormField label="Amount Converted to Roth" helpText="The total amount you converted from traditional to Roth IRA" tooltip={help?.fields['Amount Converted to Roth']?.tooltip} irsRef={help?.fields['Amount Converted to Roth']?.irsRef}>
          <CurrencyInput value={f.rothConversionAmount || 0} onChange={(v) => update('rothConversionAmount', v)} />
        </FormField>
        <FormField label="Year-End Traditional IRA Balance" helpText="Total balance of ALL traditional IRA accounts as of December 31 (needed for pro-rata calculation)" tooltip={help?.fields['Year-End Traditional IRA Balance']?.tooltip} irsRef={help?.fields['Year-End Traditional IRA Balance']?.irsRef}>
          <CurrencyInput value={f.traditionalIRABalance || 0} onChange={(v) => update('traditionalIRABalance', v)} />
        </FormField>
        <a href="https://www.irs.gov/forms-pubs/about-form-8606" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      {hasConversion && (
        <div className="rounded-xl border p-6 mt-4 bg-telos-blue-600/10 border-telos-blue-600/30">
          <div className="text-center mb-2">
            <p className="text-sm text-slate-400">Taxable Conversion Amount (estimated)</p>
            <p className="text-2xl font-bold text-white">${taxableConversion.toLocaleString()}</p>
          </div>
          <div className="flex items-start gap-2 mt-2">
            <AlertTriangle className="w-4 h-4 text-telos-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400">
              The pro-rata rule means you can't convert only the nondeductible portion.
              Your basis ratio is {(taxFreeRatio * 100).toFixed(1)}% — so {((1 - taxFreeRatio) * 100).toFixed(1)}% of the conversion is taxable.
            </p>
          </div>
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
