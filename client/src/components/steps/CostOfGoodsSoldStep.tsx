import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertBusiness } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { Package, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import { CostOfGoodsSold } from '@telostax/engine';

export default function CostOfGoodsSoldStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['cost_of_goods_sold'];
  const f = (field: string) => help?.fields[field];

  const [cogs, setCogs] = useState<CostOfGoodsSold>(
    taxReturn.costOfGoodsSold || {},
  );

  const update = (field: keyof CostOfGoodsSold, value: number) => {
    const next = { ...cogs, [field]: value };
    setCogs(next);
    updateField('costOfGoodsSold', next);
  };

  const save = async () => {
    await upsertBusiness(returnId, { costOfGoodsSold: cogs });
  };

  // Computed totals — mirrors Schedule C Part III
  const line40 =
    (cogs.beginningInventory || 0) +
    (cogs.purchases || 0) +
    (cogs.costOfLabor || 0) +
    (cogs.materialsAndSupplies || 0) +
    (cogs.otherCosts || 0);
  const cogsTotal = Math.max(0, line40 - (cogs.endingInventory || 0));

  return (
    <div>
      <StepWarningsBanner stepId="cost_of_goods_sold" />

      <SectionIntro
        icon={<Package className="w-8 h-8" />}
        title="Cost of Goods Sold"
        description="If you sell products, enter your inventory costs to calculate cost of goods sold (Schedule C, Part III)."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Computed COGS total */}
      <div className="card bg-surface-700/50 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Cost of Goods Sold</span>
          <span className="text-lg font-semibold text-white">${cogsTotal.toLocaleString()}</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Schedule C, Line 4 — subtracted from gross receipts</p>
      </div>

      {/* Part III fields */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3 mb-3">
          <Package className="w-5 h-5 text-telos-blue-400" />
          <h3 className="font-medium text-slate-200">Schedule C Part III</h3>
        </div>

        <FormField label="Beginning Inventory" tooltip={f('Beginning Inventory')?.tooltip} irsRef={f('Beginning Inventory')?.irsRef}>
          <CurrencyInput value={cogs.beginningInventory || 0} onChange={(v) => update('beginningInventory', v)} />
        </FormField>

        <FormField label="Purchases" tooltip={f('Purchases')?.tooltip} irsRef={f('Purchases')?.irsRef}>
          <CurrencyInput value={cogs.purchases || 0} onChange={(v) => update('purchases', v)} />
        </FormField>

        <FormField label="Cost of Labor" tooltip={f('Cost of Labor')?.tooltip} irsRef={f('Cost of Labor')?.irsRef}>
          <CurrencyInput value={cogs.costOfLabor || 0} onChange={(v) => update('costOfLabor', v)} />
        </FormField>

        <FormField label="Materials & Supplies" tooltip={f('Materials & Supplies')?.tooltip} irsRef={f('Materials & Supplies')?.irsRef}>
          <CurrencyInput value={cogs.materialsAndSupplies || 0} onChange={(v) => update('materialsAndSupplies', v)} />
        </FormField>

        <FormField label="Other Costs" tooltip={f('Other Costs')?.tooltip} irsRef={f('Other Costs')?.irsRef}>
          <CurrencyInput value={cogs.otherCosts || 0} onChange={(v) => update('otherCosts', v)} />
        </FormField>

        {/* Line 40 subtotal */}
        <div className="flex justify-between items-center py-2 border-t border-slate-700">
          <span className="text-sm text-slate-400">Subtotal (Lines 35-39)</span>
          <span className="text-sm font-medium text-slate-300">${line40.toLocaleString()}</span>
        </div>

        <FormField label="Ending Inventory" tooltip={f('Ending Inventory')?.tooltip} irsRef={f('Ending Inventory')?.irsRef}>
          <CurrencyInput value={cogs.endingInventory || 0} onChange={(v) => update('endingInventory', v)} />
        </FormField>

        {/* COGS result */}
        <div className="flex justify-between items-center py-2 border-t border-slate-700">
          <span className="text-sm font-semibold text-slate-300">Cost of Goods Sold (Line 42)</span>
          <span className="text-sm font-semibold text-telos-orange-400">${cogsTotal.toLocaleString()}</span>
        </div>
      </div>

      <a href="https://www.irs.gov/forms-pubs/about-schedule-c" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation onContinue={save} />
    </div>
  );
}
