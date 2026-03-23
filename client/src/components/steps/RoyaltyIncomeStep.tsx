import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import { Music, ChevronDown, ChevronUp, Trash2, Edit3, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import AddButton from '../common/AddButton';

const ROYALTY_TYPES = [
  { value: 'oil_gas', label: 'Oil & Gas' },
  { value: 'mineral', label: 'Mineral Rights' },
  { value: 'book_literary', label: 'Book / Literary' },
  { value: 'music', label: 'Music / Performance' },
  { value: 'patent', label: 'Patent / Intellectual Property' },
  { value: 'timber', label: 'Timber' },
  { value: 'other', label: 'Other Royalties' },
];

const EXPENSE_CATEGORIES = [
  { key: 'advertising', label: 'Advertising', line: 5 },
  { key: 'auto', label: 'Auto & Travel', line: 6 },
  { key: 'cleaning', label: 'Cleaning & Maintenance', line: 7 },
  { key: 'commissions', label: 'Commissions', line: 8 },
  { key: 'insurance', label: 'Insurance', line: 9 },
  { key: 'legal', label: 'Legal & Professional', line: 10 },
  { key: 'management', label: 'Management Fees', line: 11 },
  { key: 'mortgageInterest', label: 'Mortgage Interest', line: 12 },
  { key: 'otherInterest', label: 'Other Interest', line: 13 },
  { key: 'repairs', label: 'Repairs', line: 14 },
  { key: 'supplies', label: 'Supplies', line: 15 },
  { key: 'taxes', label: 'Taxes', line: 16 },
  { key: 'utilities', label: 'Utilities', line: 17 },
  { key: 'depreciation', label: 'Depreciation / Depletion', line: 18 },
  { key: 'otherExpenses', label: 'Other Expenses', line: 19 },
];

const emptyRoyalty = {
  id: '',
  description: '',
  royaltyType: 'oil_gas' as string,
  royaltyIncome: 0,
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
};

type RoyaltyForm = typeof emptyRoyalty;

function totalExpenses(p: Record<string, any>): number {
  return EXPENSE_CATEGORIES.reduce((sum, cat) => sum + (Number(p[cat.key]) || 0), 0);
}

function getRoyaltyTypeLabel(value: string): string {
  return ROYALTY_TYPES.find((t) => t.value === value)?.label || value;
}

export default function RoyaltyIncomeStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('royalty_income');

  const help = HELP_CONTENT['royalty_income'];

  const items = taxReturn.royaltyProperties || [];

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoyaltyForm>({ ...emptyRoyalty });
  const [showExpenses, setShowExpenses] = useState(false);

  // Calculate net royalty income across all properties
  const netRoyaltyIncome = items.reduce((total, item) => {
    const income = item.royaltyIncome || 0;
    const expenses = totalExpenses(item as any);
    return total + income - expenses;
  }, 0);

  const cancelForm = () => {
    setForm({ ...emptyRoyalty });
    setAdding(false);
    setEditingId(null);
    setShowExpenses(false);
  };

  const startEdit = (item: typeof items[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      id: item.id,
      description: item.description,
      royaltyType: item.royaltyType as string,
      royaltyIncome: item.royaltyIncome,
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
    });
    setShowExpenses(false);
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, 'royalty-properties', form);
    updateField('royaltyProperties', [...items, { ...form, id: result.id }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, 'royalty-properties', editingId, form);
    updateField(
      'royaltyProperties',
      items.map((i) => (i.id === editingId ? { ...i, ...form } : i))
    );
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'royaltyProperties',
      item: item as any,
      label: `Royalty${item.description ? `: ${item.description}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField
        label="Description"
        tooltip={help?.fields['Description']?.tooltip}
        irsRef={help?.fields['Description']?.irsRef}
      >
        <input
          className="input-field"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="e.g., Oil & Gas Lease - West Texas"
        />
      </FormField>

      <FormField
        label="Royalty Type"
        tooltip={help?.fields['Royalty Type']?.tooltip}
        irsRef={help?.fields['Royalty Type']?.irsRef}
      >
        <select
          className="input-field"
          value={form.royaltyType}
          onChange={(e) => setForm({ ...form, royaltyType: e.target.value as any })}
        >
          {ROYALTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Royalty Income"
        tooltip={help?.fields['Royalty Income']?.tooltip}
        irsRef={help?.fields['Royalty Income']?.irsRef}
      >
        <CurrencyInput
          value={form.royaltyIncome}
          onChange={(v) => setForm({ ...form, royaltyIncome: v })}
        />
      </FormField>

      <button
        type="button"
        onClick={() => setShowExpenses(!showExpenses)}
        className="flex items-center gap-2 text-sm text-telos-blue-400 hover:text-telos-blue-300 mt-2 mb-2"
      >
        {showExpenses ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        {showExpenses ? 'Hide' : 'Show'} Expense Categories
      </button>

      {showExpenses && (
        <div className="space-y-1 border-t border-slate-700 pt-3 mt-2">
          {EXPENSE_CATEGORIES.map((cat) => (
            <FormField
              key={cat.key}
              label={cat.label}
              optional
              tooltip={help?.fields[cat.label]?.tooltip}
              irsRef={help?.fields[cat.label]?.irsRef}
            >
              <CurrencyInput
                value={(form as any)[cat.key] || 0}
                onChange={(v) => setForm({ ...form, [cat.key]: v })}
              />
            </FormField>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <button
          onClick={onSave}
          disabled={!form.description}
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

  return (
    <div>
      <StepWarningsBanner stepId="royalty_income" />

      <SectionIntro
        icon={<Music className="w-8 h-8" />}
        title="Royalty Income"
        description="Report income from oil & gas, minerals, books, music, patents, and other royalties."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>
            {c.body}
          </CalloutCard>
        ))}
        <CalloutCard variant="info" title="1099-MISC Royalties">
          If you received a 1099-MISC with Box 2 (Royalties), add a royalty property here to
          track expenses. The income will automatically appear on Schedule E, Line 4.
        </CalloutCard>
      </div>

      {items.length > 0 && (
        <div className="card mt-4 text-center py-4">
          <div className="text-slate-400 text-sm mb-1">Net Royalty Income</div>
          <div className={`text-2xl font-bold ${netRoyaltyIncome >= 0 ? 'text-white' : 'text-red-400'}`}>
            ${netRoyaltyIncome.toLocaleString()}
          </div>
        </div>
      )}

      {items.map((item, idx) => {
        const exp = totalExpenses(item as any);
        const net = (item.royaltyIncome ?? 0) - exp;
        return editingId === item.id ? (
          <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
        ) : (
          <div
            key={item.id}
            className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? ' border-amber-500/40' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => startEdit(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                startEdit(item);
              }
            }}
          >
            <div>
              <div className="font-medium">
                {item.description || 'Unnamed Royalty'}
              </div>
              <div className="text-xs text-slate-500">
                {getRoyaltyTypeLabel(item.royaltyType)}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                Income: ${(item.royaltyIncome ?? 0).toLocaleString()} &middot; Expenses: $
                {exp.toLocaleString()}
                <span
                  className={`ml-2 font-medium ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  Net: {net >= 0 ? '+' : '-'}${Math.abs(net).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ItemWarningBadge warnings={itemWarnings.get(idx)} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(item);
                }}
                className="p-2 text-slate-400 hover:text-telos-blue-400"
                title="Edit"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(item.id);
                }}
                className="p-2 text-slate-400 hover:text-red-400"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      {!editingId &&
        (adding ? (
          renderForm(addItem, 'Save Royalty Property')
        ) : (
          <AddButton onClick={() => setAdding(true)}>Add Royalty Property</AddButton>
        ))}

      <a
        href="https://www.irs.gov/forms-pubs/about-schedule-e-form-1040"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation />
    </div>
  );
}
