import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Fuel, Pencil, Trash2, ExternalLink } from 'lucide-react';
import AddButton from '../common/AddButton';
import type { EVRefuelingProperty } from '@telostax/engine';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import StepWarningsBanner from '../common/StepWarningsBanner';

const EMPTY_PROPERTY = {
  cost: 0,
  isBusinessUse: false,
  description: '',
};

export default function EVRefuelingStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('ev_refueling');
  const help = HELP_CONTENT['ev_refueling'];

  // EVRefuelingProperty[] lives inside evRefuelingCredit.properties
  const creditInfo = taxReturn.evRefuelingCredit;
  const items: EVRefuelingProperty[] = creditInfo?.properties || [];

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_PROPERTY });

  // Helper: persist the properties array into evRefuelingCredit
  const persistProperties = (properties: EVRefuelingProperty[]) => {
    updateField('evRefuelingCredit', { properties });
  };

  const cancelForm = () => {
    setForm({ ...EMPTY_PROPERTY });
    setAdding(false);
    setEditingId(null);
  };

  const startEdit = (item: EVRefuelingProperty) => {
    setAdding(false);
    setEditingId(item.id || null);
    setForm({
      cost: item.cost,
      isBusinessUse: item.isBusinessUse || false,
      description: item.description || '',
    });
  };

  const addItem = () => {
    const newItem: EVRefuelingProperty = { id: crypto.randomUUID(), ...form };
    persistProperties([...items, newItem]);
    cancelForm();
  };

  const saveEdit = () => {
    if (!editingId) return;
    persistProperties(items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    persistProperties(items.filter((i) => i.id !== id));
    if (editingId === id) cancelForm();
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Description" tooltip="Description of the EV charging equipment (e.g., 'Level 2 home charger', 'Commercial DC fast charger')." irsRef={help?.fields['Description']?.irsRef}>
        <input
          className="input-field"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="e.g., Level 2 home charger"
        />
      </FormField>
      <FormField label="Cost of Equipment and Installation" tooltip="Total cost of qualified alternative fuel vehicle refueling property, including installation." irsRef={help?.fields['Cost of Equipment and Installation']?.irsRef}>
        <CurrencyInput
          value={form.cost}
          onChange={(v) => setForm({ ...form, cost: v })}
        />
      </FormField>
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-800">
        <div className="min-w-0">
          <span className="text-sm text-slate-300">Business Use</span>
          <p className="text-xs text-slate-400 mt-0.5">
            Business use has a $100,000 credit cap. Personal use has a $1,000 cap.
          </p>
        </div>
        <button
          onClick={() => setForm({ ...form, isBusinessUse: !form.isBusinessUse })}
          className={`shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors ${
            form.isBusinessUse
              ? 'bg-telos-blue-600 text-white'
              : 'bg-surface-800 text-slate-400'
          }`}
        >
          {form.isBusinessUse ? 'Yes' : 'No'}
        </button>
      </div>
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={form.cost <= 0} className="btn-primary text-sm">
          {saveLabel}
        </button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);
  const estimatedCredit = Math.min(totalCost * 0.30, items.some((i) => i.isBusinessUse) ? 100000 : 1000);

  return (
    <div>
      <StepWarningsBanner stepId="ev_refueling" />

      <SectionIntro
        icon={<Fuel className="w-8 h-8" />}
        title="EV Charging Credit"
        description="Credit for installing qualified electric vehicle charging stations and other alternative fuel refueling equipment (Form 8911)."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="card mt-6 bg-surface-800 border-slate-700 text-sm text-slate-400">
        <p className="font-medium text-slate-300 mb-2">What qualifies?</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Electric vehicle charging stations (Level 2 or DC fast chargers)</li>
          <li>Hydrogen fuel dispensing equipment</li>
          <li>Natural gas, propane, or other alternative fuel dispensing equipment</li>
          <li>30% credit on qualified costs (max $1,000 for personal use, $100,000 for business)</li>
          <li>Must be placed in service during the tax year</li>
        </ul>
      </div>

      {items.map((item, idx) =>
        editingId === item.id ? (
          <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
        ) : (
          <div
            key={item.id}
            className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`}
            onClick={() => startEdit(item)}
          >
            <div>
              <div className="font-medium">{item.description || 'EV Charging Equipment'}</div>
              <div className="text-sm text-slate-400">
                Cost: ${(item.cost ?? 0).toLocaleString()}
                <span> &middot; {item.isBusinessUse ? 'Business Use' : 'Personal Use'}</span>
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
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(item.id!);
                }}
                className="p-2 text-slate-400 hover:text-red-400"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      )}

      {!editingId && (
        adding ? (
          renderForm(addItem, 'Save Property')
        ) : (
          <AddButton onClick={() => setAdding(true)}>Add Refueling Property</AddButton>
        )
      )}

      {totalCost > 0 && (
        <div className="rounded-xl border p-6 mt-4 bg-telos-orange-500/10 border-telos-orange-500/20">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-telos-orange-300 font-medium">
                Estimated Credit: ${Math.round(estimatedCredit).toLocaleString()}
              </span>
              <p className="text-xs text-slate-400 mt-1">
                30% of ${totalCost.toLocaleString()} in qualifying costs
              </p>
            </div>
          </div>
        </div>
      )}

      <a href="https://www.irs.gov/forms-pubs/about-form-8911" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation />
    </div>
  );
}
