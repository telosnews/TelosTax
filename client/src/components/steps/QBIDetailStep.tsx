import { useState, useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import AddButton from '../common/AddButton';
import { Calculator, Pencil, Trash2, ExternalLink, AlertTriangle, Zap } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';
import WhatsNewCard from '../common/WhatsNewCard';
import CalloutCard from '../common/CalloutCard';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import { HELP_CONTENT } from '../../data/helpContent';
import { findNAICSByCode } from '@telostax/engine';

interface QBIForm {
  businessName: string;
  qualifiedBusinessIncome: number;
  isSSTB: boolean;
  w2WagesPaid: number;
  ubiaOfQualifiedProperty: number;
}

const EMPTY_FORM: QBIForm = {
  businessName: '',
  qualifiedBusinessIncome: 0,
  isSSTB: false,
  w2WagesPaid: 0,
  ubiaOfQualifiedProperty: 0,
};

let nextId = 1;
function generateLocalId() {
  return `qbi_${Date.now()}_${nextId++}`;
}

export default function QBIDetailStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['qbi_detail'];

  const qbi = taxReturn.qbiInfo || {};
  const items = qbi.businesses || [];
  const itemWarnings = useItemWarnings('qbi_detail');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QBIForm>({ ...EMPTY_FORM });

  // Build a map from business name → SSTB status (from NAICS code) for auto-detection
  const sstbByName = useMemo(() => {
    const map = new Map<string, { isSSTB: boolean; code: string; description: string }>();
    for (const biz of taxReturn.businesses || []) {
      if (biz.businessName && biz.principalBusinessCode) {
        const entry = findNAICSByCode(biz.principalBusinessCode);
        if (entry) {
          map.set(biz.businessName.toLowerCase(), {
            isSSTB: entry.isSSTB,
            code: entry.code,
            description: entry.description,
          });
        }
      }
    }
    return map;
  }, [taxReturn.businesses]);

  // Resolve SSTB auto-detection for the current form's business name
  const autoSSTB = form.businessName
    ? sstbByName.get(form.businessName.toLowerCase())
    : undefined;

  const updateQBI = (field: string, value: unknown) => {
    updateField('qbiInfo', { ...qbi, [field]: value });
  };

  const cancelForm = () => {
    setForm({ ...EMPTY_FORM });
    setAdding(false);
    setEditingId(null);
  };

  const startEdit = (item: typeof items[number]) => {
    setAdding(false);
    setEditingId(item.businessId);
    setForm({
      businessName: item.businessName || '',
      qualifiedBusinessIncome: item.qualifiedBusinessIncome,
      isSSTB: item.isSSTB,
      w2WagesPaid: item.w2WagesPaid,
      ubiaOfQualifiedProperty: item.ubiaOfQualifiedProperty,
    });
  };

  const addItem = () => {
    const newItem = {
      businessId: generateLocalId(),
      ...form,
    };
    updateQBI('businesses', [...items, newItem]);
    cancelForm();
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateQBI(
      'businesses',
      items.map((i) => (i.businessId === editingId ? { ...i, ...form } : i)),
    );
    cancelForm();
  };

  const removeItem = (id: string) => {
    updateQBI('businesses', items.filter((i) => i.businessId !== id));
    if (editingId === id) cancelForm();
  };

  const save = async () => {
    await updateReturn(returnId, { qbiInfo: taxReturn.qbiInfo });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Business Name" tooltip={help?.fields['Business Name']?.tooltip} irsRef={help?.fields['Business Name']?.irsRef}>
        <input
          className="input-field"
          value={form.businessName}
          onChange={(e) => {
            const name = e.target.value;
            const match = name ? sstbByName.get(name.toLowerCase()) : undefined;
            setForm({
              ...form,
              businessName: name,
              // Auto-set SSTB when the name matches a Schedule C business with a NAICS code
              ...(match !== undefined ? { isSSTB: match.isSSTB } : {}),
            });
          }}
          placeholder="e.g., My Consulting LLC"
        />
      </FormField>
      <FormField label="Qualified Business Income" helpText="Net income from this business that qualifies for the QBI deduction" tooltip={help?.fields['Qualified Business Income']?.tooltip} irsRef={help?.fields['Qualified Business Income']?.irsRef}>
        <CurrencyInput value={form.qualifiedBusinessIncome} onChange={(v) => setForm({ ...form, qualifiedBusinessIncome: v })} />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="W-2 Wages Paid" helpText="Total W-2 wages paid by this business" tooltip={help?.fields['W-2 Wages Paid']?.tooltip} irsRef={help?.fields['W-2 Wages Paid']?.irsRef}>
            <CurrencyInput value={form.w2WagesPaid} onChange={(v) => setForm({ ...form, w2WagesPaid: v })} />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="UBIA of Qualified Property" helpText="Unadjusted Basis Immediately After Acquisition" tooltip={help?.fields['UBIA of Qualified Property']?.tooltip} irsRef={help?.fields['UBIA of Qualified Property']?.irsRef}>
            <CurrencyInput value={form.ubiaOfQualifiedProperty} onChange={(v) => setForm({ ...form, ubiaOfQualifiedProperty: v })} />
          </FormField>
        </div>
      </div>
      {/* SSTB status — auto-detected from NAICS code when available */}
      {autoSSTB ? (
        <div className="mt-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
            autoSSTB.isSSTB
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-emerald-500/10 border-emerald-500/30'
          }`}>
            <Zap className={`w-4 h-4 shrink-0 ${autoSSTB.isSSTB ? 'text-amber-400' : 'text-emerald-400'}`} />
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-medium ${autoSSTB.isSSTB ? 'text-amber-400' : 'text-emerald-400'}`}>
                {autoSSTB.isSSTB ? 'SSTB detected' : 'Not an SSTB'}
              </span>
              <span className="text-xs text-slate-400 ml-2">
                based on NAICS {autoSSTB.code} ({autoSSTB.description})
              </span>
            </div>
          </div>
          <label className="flex items-center gap-3 mt-2 ml-1 cursor-pointer">
            <input
              type="checkbox"
              className="accent-telos-orange-400"
              checked={form.isSSTB}
              onChange={(e) => setForm({ ...form, isSSTB: e.target.checked })}
            />
            <span className="text-sm text-slate-400">
              {form.isSSTB === autoSSTB.isSSTB
                ? 'SSTB status (auto-detected from business code)'
                : 'Override: manual SSTB status'
              }
            </span>
          </label>
        </div>
      ) : (
        <>
          <label className="flex items-center gap-3 mt-3 cursor-pointer">
            <input
              type="checkbox"
              className="accent-telos-orange-400"
              checked={form.isSSTB}
              onChange={(e) => setForm({ ...form, isSSTB: e.target.checked })}
            />
            <span className="text-sm text-slate-300">This is a Specified Service Trade or Business (SSTB)</span>
          </label>
          <p className="text-xs text-slate-400 ml-8 mt-1">
            SSTBs include health, law, accounting, consulting, athletics, financial services, and performing arts.
            {(taxReturn.businesses || []).length > 0 && (
              <span className="text-telos-blue-400"> Tip: Add a business code on the Business Info step to auto-detect SSTB status.</span>
            )}
          </p>
        </>
      )}
      <div className="flex gap-3 mt-4">
        <button onClick={onSave} disabled={!form.businessName} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="qbi_detail" />

      <SectionIntro
        icon={<Calculator className="w-8 h-8" />}
        title="QBI Detail (Form 8995-A)"
        description="Enter per-business detail for the Qualified Business Income deduction. Required when taxable income exceeds $191,950 (single) or $383,900 (MFJ)."
      />

      <WhatsNewCard items={[
        { title: 'QBI Threshold Increased', description: 'The §199A deduction threshold is $197,300 (Single/HoH) and $394,600 (MFJ), up from $191,950/$383,900 in 2024. Below these thresholds, you get the full 20% deduction regardless of business type.' },
        { title: 'Wage/Property Limits Apply Above Threshold', description: 'Above the threshold, the deduction is limited to the greater of 50% of W-2 wages or 25% of wages plus 2.5% of UBIA of qualified property.' },
      ]} />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Legacy single-business fields */}
      <div className="card mt-6">
        <h3 className="font-medium text-slate-200 mb-3">General QBI Settings</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="accent-telos-orange-400"
            checked={!!qbi.isAgriculturalCooperativePatron}
            onChange={(e) => updateQBI('isAgriculturalCooperativePatron', e.target.checked)}
          />
          <span className="text-sm text-slate-300">I am a patron of a specified agricultural cooperative (IRC §199A(g))</span>
        </label>
        <a href="https://www.irs.gov/forms-pubs/about-form-8995-a" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      {/* Per-business list */}
      {items.map((item, idx) =>
        editingId === item.businessId ? (
          <div key={item.businessId}>{renderForm(saveEdit, 'Save Changes')}</div>
        ) : (
          <div
            key={item.businessId}
            className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`}
            onClick={() => startEdit(item)}
          >
            <div>
              <div className="font-medium">{item.businessName || 'Unnamed Business'}</div>
              <div className="text-sm text-slate-400">
                QBI: ${(item.qualifiedBusinessIncome ?? 0).toLocaleString()} · W-2 Wages: ${(item.w2WagesPaid ?? 0).toLocaleString()}
                {item.isSSTB && <span className="text-amber-400 ml-2">(SSTB)</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ItemWarningBadge warnings={itemWarnings.get(idx)} />
              <button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-2 text-slate-400 hover:text-telos-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); removeItem(item.businessId); }} className="p-2 text-slate-400 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ),
      )}

      {!editingId && (
        adding ? renderForm(addItem, 'Add Business') : <AddButton onClick={() => setAdding(true)}>Add Business</AddButton>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
