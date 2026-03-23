import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Globe, ExternalLink } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';

export default function ForeignTaxCreditStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['foreign_tax_credit'];

  const cats = taxReturn.foreignTaxCreditCategories || [
    { category: 'general' as const, foreignTaxPaid: 0, foreignSourceIncome: 0 },
    { category: 'passive' as const, foreignTaxPaid: 0, foreignSourceIncome: 0 },
  ];

  const updateCat = (index: number, field: string, value: number) => {
    const updated = cats.map((c, i) => i === index ? { ...c, [field]: value } : c);
    updateField('foreignTaxCreditCategories', updated);
  };

  const save = async () => {
    await updateReturn(returnId, { foreignTaxCreditCategories: taxReturn.foreignTaxCreditCategories });
  };

  const totalForeignTax = cats.reduce((s, c) => s + c.foreignTaxPaid, 0);

  return (
    <div>
      <StepWarningsBanner stepId="foreign_tax_credit" />

      <SectionIntro
        icon={<Globe className="w-8 h-8" />}
        title="Foreign Tax Credit (Form 1116)"
        description="If you paid income tax to a foreign country, you may be able to claim a credit to avoid double taxation. Enter amounts by category."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <p className="text-sm text-slate-400 mt-4 mb-2">
        If your total foreign tax paid is $300 or less ($600 MFJ), you can usually claim it directly without Form 1116.
        For larger amounts, the credit is limited per category based on the ratio of foreign-source income to total income.
      </p>

      {cats.map((cat, i) => (
        <div key={cat.category} className="card mt-4">
          <h3 className="font-medium text-slate-200 mb-3 capitalize">{cat.category} Category Income</h3>
          <p className="text-xs text-slate-400 mb-3">
            {cat.category === 'general'
              ? 'Wages, salaries, and most business income earned abroad.'
              : 'Dividends, interest, rents, royalties, and other passive income from foreign sources.'}
          </p>
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="Foreign Tax Paid" tooltip={help?.fields['Foreign Tax Paid']?.tooltip} irsRef={help?.fields['Foreign Tax Paid']?.irsRef}>
                <CurrencyInput value={cat.foreignTaxPaid} onChange={(v) => updateCat(i, 'foreignTaxPaid', v)} />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="Foreign-Source Income" tooltip={help?.fields['Foreign-Source Income']?.tooltip} irsRef={help?.fields['Foreign-Source Income']?.irsRef}>
                <CurrencyInput value={cat.foreignSourceIncome} onChange={(v) => updateCat(i, 'foreignSourceIncome', v)} />
              </FormField>
            </div>
          </div>
        </div>
      ))}

      {totalForeignTax > 0 && (
        <div className="rounded-xl border p-6 mt-4 bg-telos-blue-600/10 border-telos-blue-600/30 text-center">
          <p className="text-sm text-slate-400">Total Foreign Tax Paid</p>
          <p className="text-2xl font-bold text-white">${totalForeignTax.toLocaleString()}</p>
        </div>
      )}

      <a
        href="https://www.irs.gov/forms-pubs/about-form-1116"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation onContinue={save} />
    </div>
  );
}
