import { useState, useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import AddButton from '../common/AddButton';
import CalloutCard from '../common/CalloutCard';
import { CloudLightning, Trash2, Pencil, ExternalLink } from 'lucide-react';
import { calculateForm4684 } from '@telostax/engine';
import type { CasualtyLossInfo } from '@telostax/engine';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';

const emptyForm: Omit<CasualtyLossInfo, 'id'> = {
  description: '', femaDisasterNumber: '', propertyType: 'personal',
  costBasis: 0, insuranceReimbursement: 0,
  fairMarketValueBefore: 0, fairMarketValueAfter: 0,
};

export default function CasualtyLossStep() {
  const { taxReturn, returnId, updateField, calculation } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const items = taxReturn.casualtyLosses || [];
  const itemWarnings = useItemWarnings('casualty_loss');
  const agi = calculation?.form1040?.agi || 0;
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const startAdd = () => { setEditingId(null); setForm(emptyForm); setAdding(true); };
  const startEdit = (item: CasualtyLossInfo) => {
    setAdding(false); setEditingId(item.id);
    setForm({
      description: item.description, femaDisasterNumber: item.femaDisasterNumber || '',
      propertyType: item.propertyType, costBasis: item.costBasis,
      insuranceReimbursement: item.insuranceReimbursement,
      fairMarketValueBefore: item.fairMarketValueBefore, fairMarketValueAfter: item.fairMarketValueAfter,
    });
  };
  const cancelForm = () => { setAdding(false); setEditingId(null); setForm(emptyForm); };

  const addItem = () => {
    const id = crypto.randomUUID();
    updateField('casualtyLosses', [...items, { id, ...form }]);
    cancelForm();
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateField('casualtyLosses', items.map((i) => i.id === editingId ? { ...i, ...form } : i));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'casualtyLosses',
      item: item as any,
      label: `Casualty loss${item.description ? `: ${item.description}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const save = async () => {
    await updateReturn(returnId, { casualtyLosses: taxReturn.casualtyLosses });
  };

  const result = useMemo(() => items.length > 0 ? calculateForm4684(items, agi) : null, [items, agi]);

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Property Description">
        <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g., Primary residence flood damage" />
      </FormField>
      <FormField label="FEMA Disaster Number" tooltip="Required post-TCJA. Personal casualty losses are only deductible for federally declared disasters." irsRef="IRC §165(h)(5)">
        <input className="input-field" value={form.femaDisasterNumber} onChange={(e) => setForm({ ...form, femaDisasterNumber: e.target.value })} placeholder="e.g., DR-4000" />
      </FormField>
      <FormField label="Property Type" irsRef="Form 4684, Section A vs B">
        <select className="input-field" value={form.propertyType} onChange={(e) => setForm({ ...form, propertyType: e.target.value as CasualtyLossInfo['propertyType'] })}>
          <option value="personal">Personal-use property</option>
          <option value="business">Business property</option>
          <option value="income_producing">Income-producing property</option>
        </select>
      </FormField>
      <FormField label="Adjusted Basis (Cost)" tooltip="Your cost or other basis in the property, adjusted for improvements and depreciation." irsRef="Form 4684, Line 5">
        <CurrencyInput value={form.costBasis} onChange={(v) => setForm({ ...form, costBasis: v })} />
      </FormField>
      <FormField label="FMV Before Casualty" tooltip="Fair market value of the property immediately before the casualty." irsRef="Form 4684, Line 6">
        <CurrencyInput value={form.fairMarketValueBefore} onChange={(v) => setForm({ ...form, fairMarketValueBefore: v })} />
      </FormField>
      <FormField label="FMV After Casualty" tooltip="Fair market value of the property immediately after the casualty." irsRef="Form 4684, Line 7">
        <CurrencyInput value={form.fairMarketValueAfter} onChange={(v) => setForm({ ...form, fairMarketValueAfter: v })} />
      </FormField>
      <FormField label="Insurance Reimbursement" tooltip="Amount received or expected from insurance or other reimbursement." irsRef="Form 4684, Line 3">
        <CurrencyInput value={form.insuranceReimbursement} onChange={(v) => setForm({ ...form, insuranceReimbursement: v })} />
      </FormField>
      <div className="flex gap-3 mt-3">
        <button onClick={onSave} disabled={!form.description} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="casualty_loss" />
      <SectionIntro icon={<CloudLightning className="w-8 h-8" />} title="Casualties and Thefts (Form 4684)" description="Report losses from federally declared disasters, theft, or other casualties." />

      <CalloutCard variant="warning" title="Post-TCJA Limitation" irsUrl="https://www.irs.gov/forms-pubs/about-form-4684">
        Since 2018, personal casualty losses are only deductible if they're attributable to a federally declared disaster (FEMA). Each loss is reduced by a $100 floor, then total personal losses must exceed 10% of your AGI.
      </CalloutCard>

      {items.length > 0 && (
        <div className="space-y-3 mt-6">
          {items.map((item, idx) =>
            editingId === item.id ? (
              <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
            ) : (
              <div key={item.id} className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`} onClick={() => startEdit(item)}>
                <div>
                  <div className="font-medium">{item.description}</div>
                  <div className="text-sm text-slate-400">{item.femaDisasterNumber || 'No FEMA #'} — {item.propertyType} property</div>
                </div>
                <div className="flex items-center gap-1">
                  <ItemWarningBadge warnings={itemWarnings.get(idx)} />
                  <button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-2 text-slate-400 hover:text-telos-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="p-2 text-slate-400 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {result && result.totalDeductibleLoss > 0 && (
        <div className="rounded-xl border p-4 mt-4 bg-amber-500/10 border-amber-500/30 text-center">
          <p className="text-sm text-slate-400">Deductible Casualty Loss</p>
          <p className="text-xl font-bold text-amber-400">${result.totalDeductibleLoss.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">
            After $100/event floor and 10% AGI floor (${Math.round(agi * 0.1).toLocaleString()})
          </p>
        </div>
      )}

      {adding ? renderForm(addItem, 'Add Casualty Loss') : !editingId && <AddButton onClick={startAdd}>Add Casualty or Theft</AddButton>}

      <a href="https://www.irs.gov/forms-pubs/about-form-4684" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation onContinue={save} />
    </div>
  );
}
