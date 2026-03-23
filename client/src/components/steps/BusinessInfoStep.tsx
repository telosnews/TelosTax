import { useState, useEffect } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem, deleteIncomeItem } from '../../api/client';
import FormField from '../common/FormField';
import CardSelector from '../common/CardSelector';
import NAICSCodeSearch from '../common/NAICSCodeSearch';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import AddButton from '../common/AddButton';
import { Store, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import { findNAICSByCode, FilingStatus, type NAICSEntry } from '@telostax/engine';

interface BusinessForm {
  businessName: string;
  businessDescription: string;
  principalBusinessCode: string;
  accountingMethod: 'cash' | 'accrual';
  isSpouse: boolean;
  didStartThisYear: boolean;
}

const emptyForm: BusinessForm = {
  businessName: '',
  businessDescription: '',
  principalBusinessCode: '',
  accountingMethod: 'cash',
  isSpouse: false,
  didStartThisYear: false,
};

export default function BusinessInfoStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['business_info'];
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const businesses = taxReturn.businesses || [];
  const itemWarnings = useItemWarnings('business_info');
  const isMFJ = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly;

  // On mount: migrate legacy singular `business` to `businesses[]` if needed
  useEffect(() => {
    if (taxReturn.business && (!taxReturn.businesses || taxReturn.businesses.length === 0)) {
      const migrated = {
        ...taxReturn.business,
        id: taxReturn.business.id || crypto.randomUUID(),
      };
      updateField('businesses', [migrated]);
    }
  }, []);

  // If no businesses yet, show the form immediately for first-time entry
  useEffect(() => {
    if (businesses.length === 0 && !adding && !editingId) {
      setAdding(true);
    }
  }, [businesses.length]);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAdding(true);
  };

  const startEdit = (biz: typeof businesses[number]) => {
    setAdding(false);
    setEditingId(biz.id);
    setForm({
      businessName: biz.businessName || '',
      businessDescription: biz.businessDescription || '',
      principalBusinessCode: biz.principalBusinessCode || '',
      accountingMethod: biz.accountingMethod || 'cash',
      isSpouse: biz.isSpouse || false,
      didStartThisYear: biz.didStartThisYear || false,
    });
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const addItem = async () => {
    const result = addIncomeItem(returnId, 'businesses', { ...form });
    const updated = [...businesses, { id: result.id, ...form }];
    updateField('businesses', updated);
    // Keep legacy `business` in sync
    syncLegacyBusiness(updated);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    updateIncomeItem(returnId, 'businesses', editingId, { ...form });
    const updated = businesses.map((b) =>
      b.id === editingId ? { ...b, ...form } : b,
    );
    updateField('businesses', updated);
    syncLegacyBusiness(updated);
    cancelForm();
  };

  const removeItem = async (id: string) => {
    deleteIncomeItem(returnId, 'businesses', id);
    const updated = businesses.filter((b) => b.id !== id);
    updateField('businesses', updated);
    syncLegacyBusiness(updated);
    if (editingId === id) cancelForm();
  };

  // Keep taxReturn.business (singular) in sync for backward compat
  const syncLegacyBusiness = (updated: typeof businesses) => {
    if (updated.length > 0) {
      updateField('business', updated[0]);
    } else {
      updateField('business', undefined);
    }
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Business Name" optional helpText="Or your name if you're a sole proprietor" tooltip={help?.fields['Business Name']?.tooltip} irsRef={help?.fields['Business Name']?.irsRef}>
        <input className="input-field" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Jane's Design Studio" />
      </FormField>

      <FormField label="What does your business do?" helpText="e.g. Graphic design services, Software consulting" tooltip={help?.fields['What does your business do?']?.tooltip} irsRef={help?.fields['What does your business do?']?.irsRef}>
        <input className="input-field" value={form.businessDescription} onChange={(e) => setForm({ ...form, businessDescription: e.target.value })} />
      </FormField>

      <FormField label="Principal Business Code" helpText="6-digit NAICS code for Schedule C, Line B. Search by industry or code number." tooltip={help?.fields['Principal Business Code']?.tooltip || 'Your principal business activity code classifies your business for IRS reporting. It also determines whether your business is a Specified Service Trade or Business (SSTB) for the QBI deduction.'} irsRef={help?.fields['Principal Business Code']?.irsRef || 'Schedule C, Line B'}>
        <NAICSCodeSearch
          value={form.principalBusinessCode}
          onChange={(code) => setForm({ ...form, principalBusinessCode: code })}
        />
      </FormField>

      <FormField label="Accounting Method" tooltip={help?.fields['Accounting Method']?.tooltip} irsRef={help?.fields['Accounting Method']?.irsRef}>
        <CardSelector
          columns={2}
          options={[
            { value: 'cash', label: 'Cash', description: 'Income counted when received, expenses when paid. Most common for small businesses.' },
            { value: 'accrual', label: 'Accrual', description: 'Income counted when earned, expenses when incurred.' },
          ]}
          value={form.accountingMethod}
          onChange={(v) => setForm({ ...form, accountingMethod: v as 'cash' | 'accrual' })}
        />
      </FormField>

      {isMFJ && (
        <FormField label="Whose business is this?" helpText="Select who operates this business">
          <CardSelector
            columns={2}
            options={[
              { value: 'taxpayer', label: 'Taxpayer', description: 'Primary filer\'s business' },
              { value: 'spouse', label: 'Spouse', description: 'Spouse\'s business' },
            ]}
            value={form.isSpouse ? 'spouse' : 'taxpayer'}
            onChange={(v) => setForm({ ...form, isSpouse: v === 'spouse' })}
          />
        </FormField>
      )}

      <label className="flex items-center gap-3 mt-3 cursor-pointer">
        <input type="checkbox" className="accent-telos-orange-400" checked={form.didStartThisYear} onChange={(e) => setForm({ ...form, didStartThisYear: e.target.checked })} />
        <span className="text-sm text-slate-300">Business started this year</span>
        <span className="text-xs text-slate-500 ml-1">Schedule C, Line I</span>
      </label>

      <div className="flex gap-3 mt-4">
        <button onClick={onSave} className="btn-primary text-sm">{saveLabel}</button>
        {/* Only show Cancel if there's already at least one business */}
        {businesses.length > 0 && (
          <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="business_info" />
      <SectionIntro
        icon={<Store className="w-8 h-8" />}
        title="Tell us about your business"
        description={businesses.length > 1
          ? 'Manage your businesses for Schedule C filing.'
          : 'We need some details about your business activity for Schedule C.'
        }
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* List of existing businesses */}
      {businesses.length > 0 && (
        <div className="space-y-3 mt-6">
          {businesses.map((biz, idx) =>
            editingId === biz.id ? (
              <div key={biz.id}>{renderForm(saveEdit, 'Save Changes')}</div>
            ) : (
              <div
                key={biz.id}
                className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`}
                onClick={() => startEdit(biz)}
              >
                <div>
                  <div className="font-medium">{biz.businessName || 'Unnamed Business'}</div>
                  <div className="text-sm text-slate-400">
                    {biz.businessDescription || 'No description'}
                    {biz.principalBusinessCode && (
                      <span className="ml-2 text-xs font-mono text-telos-blue-400">{biz.principalBusinessCode}</span>
                    )}
                    <span className="ml-2 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                      {biz.accountingMethod === 'accrual' ? 'Accrual' : 'Cash'}
                    </span>
                    {biz.principalBusinessCode && findNAICSByCode(biz.principalBusinessCode)?.isSSTB && (
                      <span className="ml-2 text-xs text-amber-400">(SSTB)</span>
                    )}
                    {biz.isSpouse && (
                      <span className="ml-2 text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full">Spouse</span>
                    )}
                    {biz.didStartThisYear && (
                      <span className="ml-2 text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full">New</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <ItemWarningBadge warnings={itemWarnings.get(idx)} />
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(biz); }}
                    className="p-2 text-slate-400 hover:text-telos-blue-400"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {businesses.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeItem(biz.id); }}
                      className="p-2 text-slate-400 hover:text-red-400"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {/* Add form or add button */}
      {adding ? (
        renderForm(addItem, businesses.length === 0 ? 'Save Business' : 'Add Business')
      ) : (
        !editingId && (
          <AddButton onClick={startAdd}>Add Another Business</AddButton>
        )
      )}

      <a href="https://www.irs.gov/forms-pubs/about-schedule-c" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation />
    </div>
  );
}
