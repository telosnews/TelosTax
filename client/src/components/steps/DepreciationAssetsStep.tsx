import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import CardSelector from '../common/CardSelector';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import AddButton from '../common/AddButton';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { Cog, Trash2, Pencil, Calculator } from 'lucide-react';
import CalloutCard from '../common/CalloutCard';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import WhatsNewCard from '../common/WhatsNewCard';
import { HELP_CONTENT } from '../../data/helpContent';
import { validatePlacedInServiceDate } from '../../utils/dateValidation';
import {
  DepreciationAsset,
  MACRSPropertyClass,
  calculateForm4562,
  calculateScheduleC,
} from '@telostax/engine';

const PROPERTY_CLASS_OPTIONS = [
  { value: '5', label: '5-Year', description: 'Computers, phones, cameras, printers, office machines, vehicles, research equipment' },
  { value: '7', label: '7-Year', description: 'Furniture, desks, shelving, fixtures, tools, appliances, signs' },
  { value: '3', label: '3-Year', description: 'Tractor units, racehorses (2+ yrs), special manufacturing tools' },
  { value: '10', label: '10-Year', description: 'Barges, vessels, agricultural structures, tree/vine bearing fruit' },
  { value: '15', label: '15-Year', description: 'Land improvements, fences, roads, bridges, retail motor fuel outlets' },
  { value: '20', label: '20-Year', description: 'Farm buildings, municipal sewers, initial clearing of land' },
];

const emptyForm: Omit<DepreciationAsset, 'id'> = {
  description: '',
  cost: 0,
  dateInService: '',
  propertyClass: 5 as MACRSPropertyClass,
  businessUsePercent: 100,
  section179Election: 0,
};

export default function DepreciationAssetsStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const help = HELP_CONTENT['depreciation_assets'];

  if (!taxReturn || !returnId) return null;

  const assets = taxReturn.depreciationAssets || [];
  const itemWarnings = useItemWarnings('depreciation_assets');

  // Compute Schedule C to get tentativeProfit for Form 4562 preview
  const schedCResult = calculateScheduleC(taxReturn);
  const form4562Result = assets.length > 0
    ? calculateForm4562(assets, schedCResult.tentativeProfit)
    : null;

  const startAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, section179Election: 0 });
    setAdding(true);
  };

  const startEdit = (asset: DepreciationAsset) => {
    setAdding(false);
    setEditingId(asset.id);
    setForm({
      description: asset.description,
      cost: asset.cost,
      dateInService: asset.dateInService || '',
      propertyClass: asset.propertyClass,
      businessUsePercent: asset.businessUsePercent ?? 100,
      section179Election: asset.section179Election ?? 0,
      priorDepreciation: asset.priorDepreciation,
      priorSection179: asset.priorSection179,
      disposed: asset.disposed,
    });
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const addAsset = () => {
    const result = addIncomeItem(returnId, 'depreciation-assets', {
      ...form,
      // Default Section 179 to full cost if not set and asset is current year
      section179Election: form.section179Election || 0,
    });
    const newAsset: DepreciationAsset = {
      id: result.id as string,
      ...form,
    };
    updateField('depreciationAssets', [...assets, newAsset]);
    cancelForm();
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateIncomeItem(returnId, 'depreciation-assets', editingId, form);
    updateField(
      'depreciationAssets',
      assets.map((a) => (a.id === editingId ? { ...a, ...form } : a)),
    );
    cancelForm();
  };

  const removeAsset = (assetId: string) => {
    const item = assets.find((a) => a.id === assetId);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'depreciationAssets',
      item: item as any,
      label: `Asset${item.description ? `: ${item.description}` : ''}`,
      onCleanup: editingId === assetId ? cancelForm : undefined,
    });
  };

  // Check if asset is placed in a prior year
  const isPriorYear = (dateInService: string) => {
    if (!dateInService) return false;
    const year = new Date(dateInService + 'T00:00:00').getFullYear();
    return year < 2025;
  };

  const renderForm = (onSave: () => void, saveLabel: string) => {
    const priorYear = isPriorYear(form.dateInService);
    const businessBasis = (form.cost || 0) * ((form.businessUsePercent ?? 100) / 100);

    return (
      <div className="card mt-4">
        <FormField label="Description" helpText="e.g., MacBook Pro, standing desk, camera" tooltip={help?.fields['Description']?.tooltip} irsRef={help?.fields['Description']?.irsRef}>
          <input
            className="input-field"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What did you purchase?"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Cost" helpText="Original purchase price" tooltip={help?.fields['Cost']?.tooltip} irsRef={help?.fields['Cost']?.irsRef}>
            <CurrencyInput
              value={form.cost}
              onChange={(v) => {
                const newForm = { ...form, cost: v || 0 };
                // Auto-set Section 179 to full cost for convenience (current year only)
                if (!priorYear && (form.section179Election === 0 || form.section179Election === form.cost)) {
                  newForm.section179Election = v || 0;
                }
                setForm(newForm);
              }}
            />
          </FormField>

          <FormField label="Date Placed in Service" helpText="When you started using it for business" tooltip={help?.fields['Date Placed in Service']?.tooltip} irsRef={help?.fields['Date Placed in Service']?.irsRef} warning={validatePlacedInServiceDate(form.dateInService)}>
            <input
              type="date"
              className="input-field"
              value={form.dateInService}
              onChange={(e) => setForm({ ...form, dateInService: e.target.value })}
            />
          </FormField>
        </div>

        <FormField label="Property Class" helpText="MACRS recovery period — most equipment is 5 or 7 year" tooltip={help?.fields['Property Class']?.tooltip} irsRef={help?.fields['Property Class']?.irsRef}>
          <CardSelector
            options={PROPERTY_CLASS_OPTIONS}
            value={String(form.propertyClass)}
            onChange={(v) => setForm({ ...form, propertyClass: Number(v) as MACRSPropertyClass })}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Business Use %" helpText="Percentage used for business (100% if exclusively business)" tooltip={help?.fields['Business Use %']?.tooltip} irsRef={help?.fields['Business Use %']?.irsRef}>
            <input
              type="number"
              className="input-field"
              min={0}
              max={100}
              value={form.businessUsePercent}
              onChange={(e) => setForm({ ...form, businessUsePercent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
            />
          </FormField>

          {!priorYear && (
            <FormField label="Section 179 Election" helpText="Amount to deduct in full this year (up to cost)" tooltip={help?.fields['Section 179 Election']?.tooltip} irsRef={help?.fields['Section 179 Election']?.irsRef}>
              <CurrencyInput
                value={form.section179Election}
                onChange={(v) => setForm({ ...form, section179Election: Math.min(v || 0, businessBasis) })}
              />
            </FormField>
          )}
        </div>

        {priorYear && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <FormField label="Prior Depreciation" helpText="Total depreciation claimed in previous years" optional tooltip={help?.fields['Prior Depreciation']?.tooltip} irsRef={help?.fields['Prior Depreciation']?.irsRef}>
              <CurrencyInput
                value={form.priorDepreciation}
                onChange={(v) => setForm({ ...form, priorDepreciation: v })}
              />
            </FormField>
            <FormField label="Prior Section 179" helpText="Section 179 claimed in the year placed in service" optional tooltip={help?.fields['Prior Section 179']?.tooltip} irsRef={help?.fields['Prior Section 179']?.irsRef}>
              <CurrencyInput
                value={form.priorSection179}
                onChange={(v) => setForm({ ...form, priorSection179: v })}
              />
            </FormField>
          </div>
        )}

        {form.businessUsePercent < 100 && form.businessUsePercent > 0 && (
          <div className="text-xs text-amber-400 mt-2">
            Business-use basis: ${businessBasis.toLocaleString()} ({form.businessUsePercent}% of ${(form.cost || 0).toLocaleString()})
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onSave}
            disabled={!form.description || !form.cost}
            className="btn-primary text-sm"
          >
            {saveLabel}
          </button>
          <button onClick={cancelForm} className="btn-secondary text-sm">
            Cancel
          </button>
        </div>
      </div>
    );
  };

  // Find per-asset detail for display
  const getAssetDetail = (assetId: string) =>
    form4562Result?.assetDetails.find((d) => d.assetId === assetId);

  return (
    <div>
      <StepWarningsBanner stepId="depreciation_assets" />

      <SectionIntro
        icon={<Cog className="w-8 h-8" />}
        title="Business Equipment & Depreciation"
        description="Add business assets you purchased or placed in service. Section 179 lets you deduct the full cost of qualifying equipment in the year you buy it."
      />

      <WhatsNewCard items={[
        { title: '100% Bonus Depreciation Restored', description: 'Under the One Big Beautiful Bill Act (P.L. 119-21), 100% first-year bonus depreciation is back for assets placed in service in 2025. Previously this had been reduced to 60%.' },
        { title: 'Section 179 Limit: $1,250,000', description: 'The maximum Section 179 deduction for 2025 is $1,250,000, with a phase-out beginning at $3,130,000 in total equipment purchases (Rev. Proc. 2024-40).' },
      ]} />

      <CalloutCard variant="info" title="About Business Equipment & Depreciation" irsUrl="https://www.irs.gov/forms-pubs/about-form-4562">
        When you purchase equipment for your business, you can deduct the cost through depreciation.
        Section 179 lets you deduct the full cost of qualifying equipment in the year you buy it —
        up to $1,250,000 for 2025 — making it the simplest option for most small businesses. Your
        Section 179 deduction is limited to your net business income, and any excess carries forward
        to future years. Business use must exceed 50% to qualify for Section 179 and accelerated
        depreciation. For 2025, 100% bonus depreciation is also available, so any cost not covered
        by Section 179 is automatically deducted in full. Prior-year assets continue their original
        MACRS recovery schedule (5-year, 7-year, etc.) using IRS depreciation rate tables.
      </CalloutCard>

      {/* Existing assets */}
      {assets.length > 0 && (
        <div className="space-y-3 mt-6">
          {assets.map((asset, idx) => {
            const detail = getAssetDetail(asset.id);
            return editingId === asset.id ? (
              <div key={asset.id}>{renderForm(saveEdit, 'Save Changes')}</div>
            ) : (
              <div
                key={asset.id}
                className={`card flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`}
                onClick={() => startEdit(asset)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{asset.description}</div>
                  <div className="text-sm text-slate-400">
                    ${(asset.cost ?? 0).toLocaleString()}
                    <span className="mx-1">&middot;</span>
                    {asset.propertyClass}-year
                    {asset.dateInService && (
                      <span className="mx-1">&middot; {asset.dateInService}</span>
                    )}
                    {asset.businessUsePercent < 100 && (
                      <span className="mx-1">&middot; {asset.businessUsePercent}% business</span>
                    )}
                  </div>
                  {detail && detail.totalDepreciation > 0 && (
                    <div className="text-xs text-telos-orange-400 mt-1">
                      Depreciation: ${detail.totalDepreciation.toLocaleString()}
                      {detail.section179Amount > 0 && (
                        <span className="text-slate-400"> (§179: ${detail.section179Amount.toLocaleString()})</span>
                      )}
                      {detail.convention === 'mid-quarter' && (
                        <span className="text-slate-500"> · MQ</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <ItemWarningBadge warnings={itemWarnings.get(idx)} />
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(asset); }}
                    className="p-2 text-slate-400 hover:text-telos-blue-400"
                    title="Edit asset"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAsset(asset.id); }}
                    className="p-2 text-slate-400 hover:text-red-400"
                    title="Remove asset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {adding ? (
        renderForm(addAsset, 'Save Asset')
      ) : (
        !editingId && (
          <AddButton onClick={startAdd}>Add a Business Asset</AddButton>
        )
      )}

      {/* Depreciation Summary */}
      {form4562Result && form4562Result.totalDepreciation > 0 && (
        <div className="rounded-xl border p-6 mt-6 bg-telos-orange-500/10 border-telos-orange-500/20">
          <h4 className="text-sm font-medium text-telos-orange-300 mb-3 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Form 4562 Depreciation Summary
            <span className="ml-auto text-xs font-normal text-slate-400">
              Convention: {form4562Result.convention === 'mid-quarter' ? 'Mid-Quarter' : 'Half-Year'}
            </span>
          </h4>
          {form4562Result.convention === 'mid-quarter' && (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-3">
              Mid-quarter convention applies because more than 40% of depreciable basis was placed in service in Q4 (Oct–Dec). IRC §168(d)(3).
            </div>
          )}
          <div className="space-y-2 text-sm">
            {form4562Result.section179Deduction > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">Section 179 deduction</span>
                <span className="text-slate-200">${form4562Result.section179Deduction.toLocaleString()}</span>
              </div>
            )}
            {form4562Result.bonusDepreciationTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">Bonus depreciation (100%)</span>
                <span className="text-slate-200">${form4562Result.bonusDepreciationTotal.toLocaleString()}</span>
              </div>
            )}
            {form4562Result.macrsCurrentYear > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">MACRS depreciation (current year)</span>
                <span className="text-slate-200">${form4562Result.macrsCurrentYear.toLocaleString()}</span>
              </div>
            )}
            {form4562Result.macrsPriorYears > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">MACRS depreciation (prior years)</span>
                <span className="text-slate-200">${form4562Result.macrsPriorYears.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-telos-orange-500/20 font-medium">
              <span className="text-telos-orange-300">Total → Schedule C Line 13</span>
              <span className="text-telos-orange-400">${form4562Result.totalDepreciation.toLocaleString()}</span>
            </div>
            {form4562Result.section179Carryforward > 0 && (
              <div className="flex justify-between text-amber-400 text-xs mt-1">
                <span>Section 179 carryforward (limited by income)</span>
                <span>${form4562Result.section179Carryforward.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warnings from Form 4562 */}
      {form4562Result?.warnings && form4562Result.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {form4562Result.warnings.map((warning, i) => (
            <div key={i} className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              {warning}
            </div>
          ))}
        </div>
      )}

      <StepNavigation />
    </div>
  );
}
