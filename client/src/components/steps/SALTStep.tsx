import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertItemized } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import WhatsNewCard from '../common/WhatsNewCard';
import CalloutCard from '../common/CalloutCard';
import { Receipt, AlertTriangle, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { ItemizedDeductions } from '@telostax/engine';

const emptyItemized: ItemizedDeductions = {
  medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
  personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
  charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
};

export default function SALTStep() {
  const { taxReturn, returnId, updateField, calculation } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['itemized_deductions'];
  const items = taxReturn.itemizedDeductions || emptyItemized;
  const agi = calculation?.form1040?.agi || 0;
  const ho = taxReturn.homeOffice;
  const hasHomeOfficeActual = ho?.method === 'actual';

  const update = (field: keyof ItemizedDeductions, value: unknown) => {
    updateField('itemizedDeductions', { ...items, [field]: value });
  };

  const save = async () => {
    await upsertItemized(returnId, { ...items });
  };

  // Home office mismatch detection
  const autoRealEstateTax = items.realEstateTax || (hasHomeOfficeActual ? ho?.realEstateTaxes : undefined);
  const taxMismatch = hasHomeOfficeActual && (
    items.realEstateTax > 0 &&
    ho?.realEstateTaxes != null && ho.realEstateTaxes > 0 &&
    items.realEstateTax !== ho.realEstateTaxes
  );

  const saltTaxComponent = items.saltMethod === 'sales_tax' ? (items.salesTaxAmount || 0) : items.stateLocalIncomeTax;
  const saltTotal = saltTaxComponent + items.realEstateTax + items.personalPropertyTax;
  const saltCapped = Math.min(saltTotal, 40000);

  return (
    <div>
      <StepWarningsBanner stepId="salt_deduction" />

      <SectionIntro
        icon={<Receipt className="w-8 h-8" />}
        title="State & Local Taxes (SALT)"
        description="Deduct state/local income tax (or sales tax), real estate tax, and personal property tax — subject to the $40,000 cap."
      />

      <WhatsNewCard items={[
        { title: 'SALT Cap Quadrupled to $40,000', description: 'The combined deduction for state/local income taxes, real estate taxes, and personal property taxes has been raised from $10,000 to $40,000 ($20,000 if MFS) under the One Big Beautiful Bill Act.' },
        { title: 'Phase-Down for High Earners', description: 'The $40,000 cap phases down for incomes above $500,000 ($250,000 MFS), reducing by 30% of excess MAGI.' },
      ]} />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="card">
        <p className="text-xs text-amber-400 mb-3">Combined SALT deduction is capped at $40,000 (phases down for incomes above $500,000)</p>

        {/* Sales Tax vs Income Tax toggle */}
        <div className="mb-4">
          <p className="text-xs text-slate-400 mb-2">You can deduct either state/local income tax OR general sales tax — not both.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => update('saltMethod', 'income_tax' as any)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                (items.saltMethod || 'income_tax') === 'income_tax'
                  ? 'border-telos-blue-500 bg-telos-blue-600/10 text-telos-blue-300 ring-1 ring-telos-blue-500/50'
                  : 'border-slate-700 bg-surface-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              State/Local Income Tax
            </button>
            <button
              type="button"
              onClick={() => update('saltMethod', 'sales_tax' as any)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                items.saltMethod === 'sales_tax'
                  ? 'border-telos-blue-500 bg-telos-blue-600/10 text-telos-blue-300 ring-1 ring-telos-blue-500/50'
                  : 'border-slate-700 bg-surface-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              General Sales Tax
            </button>
          </div>
        </div>

        {items.saltMethod === 'sales_tax' ? (
          <FormField label="General Sales Tax Paid" tooltip="Total general sales tax you paid during the year. You can use the IRS Optional Sales Tax Tables (Pub 600) or your actual receipts." irsRef="Schedule A, Line 5a; IRC §164(b)(5)(I)">
            <CurrencyInput value={items.salesTaxAmount || 0} onChange={(v) => updateField('itemizedDeductions', { ...items, salesTaxAmount: v })} />
          </FormField>
        ) : (
          <FormField label="State/Local Income Tax" tooltip={help?.fields['State/Local Income Tax']?.tooltip} irsRef={help?.fields['State/Local Income Tax']?.irsRef}>
            <CurrencyInput value={items.stateLocalIncomeTax} onChange={(v) => update('stateLocalIncomeTax', v)} />
          </FormField>
        )}

        <FormField label="Real Estate Tax" tooltip={help?.fields['Real Estate Tax']?.tooltip} irsRef={help?.fields['Real Estate Tax']?.irsRef} helpText={!items.realEstateTax && autoRealEstateTax ? 'Auto-filled from Home Office (Form 8829)' : undefined} warning={taxMismatch ? `This differs from Home Office ($${ho?.realEstateTaxes?.toLocaleString()}). Both should be your total real estate taxes.` : undefined}>
          <CurrencyInput value={items.realEstateTax || autoRealEstateTax || 0} onChange={(v) => update('realEstateTax', v)} />
        </FormField>

        <FormField label="Personal Property Tax" tooltip={help?.fields['Personal Property Tax']?.tooltip} irsRef={help?.fields['Personal Property Tax']?.irsRef} optional>
          <CurrencyInput value={items.personalPropertyTax} onChange={(v) => update('personalPropertyTax', v)} />
        </FormField>

        {saltTotal > 40000 && (
          <p className="text-xs text-amber-400 mt-2">Total SALT is ${saltTotal.toLocaleString()} — will be capped at $40,000</p>
        )}

        {saltTotal > 0 && agi > 500000 && (
          <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">Your AGI (${agi.toLocaleString()}) exceeds $500,000. The $40,000 SALT cap phases down for high earners — your effective cap may be lower.</p>
          </div>
        )}

        <a href="https://www.irs.gov/taxtopics/tc503" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      {saltTotal > 0 && (
        <div className="rounded-xl border p-5 mt-4 text-center bg-emerald-500/10 border-emerald-500/30">
          <p className="text-sm text-slate-400">SALT Deduction</p>
          <p className="text-2xl font-bold text-emerald-400">${saltCapped.toLocaleString()}</p>
          {saltTotal > saltCapped && (
            <p className="text-xs text-amber-400 mt-1">Capped from ${saltTotal.toLocaleString()}</p>
          )}
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
