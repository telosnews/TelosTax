import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Building, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import AddButton from '../common/AddButton';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import StepWarningsBanner from '../common/StepWarningsBanner';

const PROPERTY_TYPES = [
  { value: 'single_family', label: 'Single Family Home' },
  { value: 'multi_family', label: 'Multi-Family / Duplex' },
  { value: 'condo', label: 'Condo / Townhouse' },
  { value: 'commercial', label: 'Commercial Property' },
  { value: 'other', label: 'Other' },
];

const emptyProperty = {
  address: '',
  propertyType: 'single_family' as string,
  daysRented: undefined as number | undefined,
  personalUseDays: undefined as number | undefined,
  rentalIncome: 0,
  advertising: 0,
  auto: 0,
  cleaning: 0,
  commissions: 0,
  insurance: 0,
  legal: 0,
  management: 0,
  mortgageInterest: 0,
  otherInterest: 0,
  repairs: 0,
  supplies: 0,
  taxes: 0,
  utilities: 0,
  depreciation: 0,
  otherExpenses: 0,
  activeParticipation: true,
  disposedDuringYear: false,
  dispositionGainLoss: 0,
  priorYearUnallowedLoss: 0,
  salesPrice: 0,
  costBasis: 0,
  cumulativeDepreciation: 0,
};

type PropertyForm = typeof emptyProperty;

function totalExpenses(p: PropertyForm): number {
  return (
    p.advertising + p.auto + p.cleaning + p.commissions + p.insurance +
    p.legal + p.management + p.mortgageInterest + p.otherInterest +
    p.repairs + p.supplies + p.taxes + p.utilities + p.depreciation + p.otherExpenses
  );
}

export default function RentalPropertyStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('rental_income');

  const help = HELP_CONTENT['rental_income'];

  const items = taxReturn.rentalProperties || [];

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PropertyForm>({ ...emptyProperty });
  const [showExpenses, setShowExpenses] = useState(false);

  const cancelForm = () => {
    setForm({ ...emptyProperty });
    setAdding(false);
    setEditingId(null);
    setShowExpenses(false);
  };

  const startEdit = (item: typeof items[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      address: item.address,
      propertyType: item.propertyType as string,
      daysRented: item.daysRented ?? undefined,
      personalUseDays: item.personalUseDays ?? undefined,
      rentalIncome: item.rentalIncome,
      advertising: item.advertising || 0,
      auto: item.auto || 0,
      cleaning: item.cleaning || 0,
      commissions: item.commissions || 0,
      insurance: item.insurance || 0,
      legal: item.legal || 0,
      management: item.management || 0,
      mortgageInterest: item.mortgageInterest || 0,
      otherInterest: item.otherInterest || 0,
      repairs: item.repairs || 0,
      supplies: item.supplies || 0,
      taxes: item.taxes || 0,
      utilities: item.utilities || 0,
      depreciation: item.depreciation || 0,
      otherExpenses: item.otherExpenses || 0,
      activeParticipation: item.activeParticipation !== false,
      disposedDuringYear: item.disposedDuringYear || false,
      dispositionGainLoss: item.dispositionGainLoss || 0,
      priorYearUnallowedLoss: item.priorYearUnallowedLoss || 0,
      salesPrice: item.salesPrice || 0,
      costBasis: item.costBasis || 0,
      cumulativeDepreciation: item.cumulativeDepreciation || 0,
    });
    setShowExpenses(false);
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, 'rental-properties', form);
    updateField('rentalProperties', [...items, { id: result.id, ...form }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, 'rental-properties', editingId, form);
    updateField('rentalProperties', items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'rentalProperties',
      item: item as any,
      label: `Rental${item.address ? `: ${item.address}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Property Address" tooltip={help?.fields['Property Address']?.tooltip} irsRef={help?.fields['Property Address']?.irsRef}>
        <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Rental Ave" />
      </FormField>
      <FormField label="Property Type" tooltip={help?.fields['Property Type']?.tooltip} irsRef={help?.fields['Property Type']?.irsRef}>
        <select className="input-field" value={form.propertyType} onChange={(e) => setForm({ ...form, propertyType: e.target.value as any })}>
          <option value="single_family">Single Family Home</option>
          <option value="multi_family">Multi-Family / Duplex</option>
          <option value="condo">Condo / Townhouse</option>
          <option value="commercial">Commercial Property</option>
          <option value="other">Other</option>
        </select>
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Days Rented" tooltip={help?.fields['Days Rented']?.tooltip} irsRef={help?.fields['Days Rented']?.irsRef}>
            <input type="number" className="input-field" min={0} max={365} value={form.daysRented ?? ''} onChange={(e) => setForm({ ...form, daysRented: e.target.value === '' ? undefined : Math.min(365, Math.max(0, parseInt(e.target.value) || 0)) })} />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Personal Use Days" optional tooltip={help?.fields['Personal Use Days']?.tooltip} irsRef={help?.fields['Personal Use Days']?.irsRef}>
            <input type="number" className="input-field" min={0} max={365} value={form.personalUseDays ?? ''} onChange={(e) => setForm({ ...form, personalUseDays: e.target.value === '' ? undefined : Math.min(365, Math.max(0, parseInt(e.target.value) || 0)) })} />
          </FormField>
        </div>
      </div>
      <FormField label="Rental Income" tooltip={help?.fields['Rental Income']?.tooltip} irsRef={help?.fields['Rental Income']?.irsRef}>
        <CurrencyInput value={form.rentalIncome} onChange={(v) => setForm({ ...form, rentalIncome: v })} />
      </FormField>
      <button type="button" onClick={() => setShowExpenses(!showExpenses)} className="flex items-center gap-2 text-sm text-telos-blue-400 hover:text-telos-blue-300 mt-2 mb-2">
        {showExpenses ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {showExpenses ? 'Hide' : 'Show'} Expense Categories
      </button>
      {showExpenses && (
        <div className="space-y-1 border-t border-slate-700 pt-3 mt-2">
          <FormField label="Advertising" optional tooltip={help?.fields['Advertising']?.tooltip} irsRef={help?.fields['Advertising']?.irsRef}><CurrencyInput value={form.advertising} onChange={(v) => setForm({ ...form, advertising: v })} /></FormField>
          <FormField label="Auto & Travel" optional tooltip={help?.fields['Auto & Travel']?.tooltip} irsRef={help?.fields['Auto & Travel']?.irsRef}><CurrencyInput value={form.auto} onChange={(v) => setForm({ ...form, auto: v })} /></FormField>
          <FormField label="Cleaning & Maintenance" optional tooltip={help?.fields['Cleaning & Maintenance']?.tooltip} irsRef={help?.fields['Cleaning & Maintenance']?.irsRef}><CurrencyInput value={form.cleaning} onChange={(v) => setForm({ ...form, cleaning: v })} /></FormField>
          <FormField label="Commissions" optional tooltip={help?.fields['Commissions']?.tooltip} irsRef={help?.fields['Commissions']?.irsRef}><CurrencyInput value={form.commissions} onChange={(v) => setForm({ ...form, commissions: v })} /></FormField>
          <FormField label="Insurance" optional tooltip={help?.fields['Insurance']?.tooltip} irsRef={help?.fields['Insurance']?.irsRef}><CurrencyInput value={form.insurance} onChange={(v) => setForm({ ...form, insurance: v })} /></FormField>
          <FormField label="Legal & Professional" optional tooltip={help?.fields['Legal & Professional']?.tooltip} irsRef={help?.fields['Legal & Professional']?.irsRef}><CurrencyInput value={form.legal} onChange={(v) => setForm({ ...form, legal: v })} /></FormField>
          <FormField label="Management Fees" optional tooltip={help?.fields['Management Fees']?.tooltip} irsRef={help?.fields['Management Fees']?.irsRef}><CurrencyInput value={form.management} onChange={(v) => setForm({ ...form, management: v })} /></FormField>
          <FormField label="Mortgage Interest" optional tooltip={help?.fields['Mortgage Interest']?.tooltip} irsRef={help?.fields['Mortgage Interest']?.irsRef}><CurrencyInput value={form.mortgageInterest} onChange={(v) => setForm({ ...form, mortgageInterest: v })} /></FormField>
          <FormField label="Other Interest" optional tooltip={help?.fields['Other Interest']?.tooltip} irsRef={help?.fields['Other Interest']?.irsRef}><CurrencyInput value={form.otherInterest} onChange={(v) => setForm({ ...form, otherInterest: v })} /></FormField>
          <FormField label="Repairs" optional tooltip={help?.fields['Repairs']?.tooltip} irsRef={help?.fields['Repairs']?.irsRef}><CurrencyInput value={form.repairs} onChange={(v) => setForm({ ...form, repairs: v })} /></FormField>
          <FormField label="Supplies" optional tooltip={help?.fields['Supplies']?.tooltip} irsRef={help?.fields['Supplies']?.irsRef}><CurrencyInput value={form.supplies} onChange={(v) => setForm({ ...form, supplies: v })} /></FormField>
          <FormField label="Taxes" optional tooltip={help?.fields['Taxes']?.tooltip} irsRef={help?.fields['Taxes']?.irsRef}><CurrencyInput value={form.taxes} onChange={(v) => setForm({ ...form, taxes: v })} /></FormField>
          <FormField label="Utilities" optional tooltip={help?.fields['Utilities']?.tooltip} irsRef={help?.fields['Utilities']?.irsRef}><CurrencyInput value={form.utilities} onChange={(v) => setForm({ ...form, utilities: v })} /></FormField>
          <FormField label="Depreciation" optional tooltip={help?.fields['Depreciation']?.tooltip} irsRef={help?.fields['Depreciation']?.irsRef}><CurrencyInput value={form.depreciation} onChange={(v) => setForm({ ...form, depreciation: v })} /></FormField>
          <FormField label="Other Expenses" optional tooltip={help?.fields['Other Expenses']?.tooltip} irsRef={help?.fields['Other Expenses']?.irsRef}><CurrencyInput value={form.otherExpenses} onChange={(v) => setForm({ ...form, otherExpenses: v })} /></FormField>
        </div>
      )}
      {/* Form 8582: Passive Activity Loss fields */}
      <div className="mt-4 pt-3 border-t border-slate-700 space-y-3">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
          Form 8582 — Passive Loss Rules
        </p>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={form.activeParticipation !== false}
            onChange={(e) => setForm({ ...form, activeParticipation: e.target.checked })}
            className="mt-1 rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500"
          />
          <div>
            <span className="text-sm text-slate-200 group-hover:text-white">
              Active participation
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Required for the $25,000 special loss allowance. Most landlords who make management
              decisions (approving tenants, repairs, etc.) qualify. IRC §469(i).
            </p>
          </div>
        </label>

        <FormField label="Prior-Year Unallowed Loss" optional tooltip="Suspended passive loss from prior years for this property (Form 8582).">
          <CurrencyInput
            value={form.priorYearUnallowedLoss}
            onChange={(v) => setForm({ ...form, priorYearUnallowedLoss: v })}
          />
        </FormField>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={!!form.disposedDuringYear}
            onChange={(e) => setForm({ ...form, disposedDuringYear: e.target.checked })}
            className="mt-1 rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500"
          />
          <div>
            <span className="text-sm text-slate-200 group-hover:text-white">
              Disposed of this property during the year
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              If you sold or fully disposed of this property, all suspended passive losses
              are released and deductible. IRC §469(g)(1).
            </p>
          </div>
        </label>

        {form.disposedDuringYear && (
          <FormField label="Gain/Loss on Disposition" optional tooltip="Enter the gain or loss recognized on the sale or disposition of this rental property. Use a negative number for a loss." irsRef="IRC §469(g); Form 4797">
            <CurrencyInput
              value={form.dispositionGainLoss}
              onChange={(v) => setForm({ ...form, dispositionGainLoss: v })}
              allowNegative
            />
          </FormField>
        )}

        {form.disposedDuringYear && (
          <div className="space-y-3 mt-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
              Disposition Details
            </p>
            <FormField label="Sales Price" optional tooltip="Gross sale proceeds.">
              <CurrencyInput
                value={form.salesPrice}
                onChange={(v) => setForm({ ...form, salesPrice: v })}
              />
            </FormField>
            <FormField label="Adjusted Cost Basis" optional tooltip="Original cost basis of the property (excluding land).">
              <CurrencyInput
                value={form.costBasis}
                onChange={(v) => setForm({ ...form, costBasis: v })}
              />
            </FormField>
            <FormField label="Cumulative Depreciation" optional tooltip="Total depreciation claimed over the ownership period.">
              <CurrencyInput
                value={form.cumulativeDepreciation}
                onChange={(v) => setForm({ ...form, cumulativeDepreciation: v })}
              />
            </FormField>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.address} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="rental_income" />

      <SectionIntro
        icon={<Building className="w-8 h-8" />}
        title="Rental Properties (Schedule E)"
        description="Enter each rental property you own. Include income and expenses for the year."
      />

      <div className="space-y-3 mt-4 mb-2">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {items.map((item, idx) => {
        const exp = totalExpenses(item as any);
        const net = (item.rentalIncome ?? 0) - exp;
        return editingId === item.id ? (
          <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
        ) : (
          <div key={item.id} className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`} role="button" tabIndex={0} onClick={() => startEdit(item)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(item); } }}>
            <div>
              <div className="font-medium">{item.address || 'Unnamed Property'}</div>
              <div className="text-sm text-slate-400">
                Income: ${(item.rentalIncome ?? 0).toLocaleString()} &middot; Expenses: ${exp.toLocaleString()}
                <span className={`ml-2 font-medium ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  Net: {net >= 0 ? '+' : '-'}${Math.abs(net).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ItemWarningBadge warnings={itemWarnings.get(idx)} /><button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-2 text-slate-400 hover:text-telos-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="p-2 text-slate-400 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        );
      })}

      {!editingId && (
        adding ? (
          renderForm(addItem, 'Save Rental Property')
        ) : (
          <AddButton onClick={() => setAdding(true)}>Add Rental Property</AddButton>
        )
      )}

      <StepNavigation />
    </div>
  );
}
