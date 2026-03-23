import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import CardSelector from '../common/CardSelector';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { GraduationCap, Pencil, Trash2, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import PillToggle from '../common/PillToggle';
import AddButton from '../common/AddButton';
import { HELP_CONTENT } from '../../data/helpContent';
import { FilingStatus } from '@telostax/engine';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import CalloutCard from '../common/CalloutCard';
import StepWarningsBanner from '../common/StepWarningsBanner';

const EMPTY_FORM = {
  creditType: 'american_opportunity' as string,
  studentName: '',
  institution: '',
  tuitionPaid: 0,
  scholarships: 0,
};

export default function EducationCreditsStep() {
  const { taxReturn, returnId, updateField, calculation } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('education_credits');

  const help = HELP_CONTENT['education_credits'];

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const cancelForm = () => {
    setForm({ ...EMPTY_FORM });
    setAdding(false);
    setEditingId(null);
  };

  const startEdit = (ec: typeof taxReturn.educationCredits[number]) => {
    setAdding(false);
    setEditingId(ec.id);
    setForm({
      creditType: ec.type,
      studentName: ec.studentName,
      institution: ec.institution,
      tuitionPaid: ec.tuitionPaid,
      scholarships: ec.scholarships || 0,
    });
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, 'education-credits', form);
    updateField('educationCredits', [...taxReturn.educationCredits, { id: result.id, type: form.creditType, studentName: form.studentName, institution: form.institution, tuitionPaid: form.tuitionPaid, scholarships: form.scholarships }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, 'education-credits', editingId, form);
    updateField('educationCredits', taxReturn.educationCredits.map((ec) => (ec.id === editingId ? { ...ec, type: form.creditType, studentName: form.studentName, institution: form.institution, tuitionPaid: form.tuitionPaid, scholarships: form.scholarships } : ec)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = taxReturn.educationCredits.find((e) => e.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'educationCredits',
      item: item as any,
      label: `Education credit${item.institution ? `: ${item.institution}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Credit Type" tooltip={help?.fields['Credit Type']?.tooltip} irsRef={help?.fields['Credit Type']?.irsRef}>
        <CardSelector
          options={[
            { value: 'american_opportunity', label: 'American Opportunity (AOTC)', description: 'Up to $2,500 per student. First 4 years of college only.' },
            { value: 'lifetime_learning', label: 'Lifetime Learning (LLC)', description: 'Up to $2,000 per return. Any year of college or courses.' },
          ]}
          value={form.creditType}
          onChange={(v) => setForm({ ...form, creditType: v })}
        />
      </FormField>
      <FormField label="Student Name" tooltip={help?.fields['Student Name']?.tooltip} irsRef={help?.fields['Student Name']?.irsRef}>
        <input className="input-field" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} placeholder="Student's full name" />
      </FormField>
      <FormField label="Institution" tooltip={help?.fields['Institution']?.tooltip} irsRef={help?.fields['Institution']?.irsRef}>
        <input className="input-field" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="University or college name" />
      </FormField>
      <FormField label="Tuition & Fees Paid" tooltip={help?.fields['Tuition & Fees Paid']?.tooltip} irsRef={help?.fields['Tuition & Fees Paid']?.irsRef}>
        <CurrencyInput value={form.tuitionPaid} onChange={(v) => setForm({ ...form, tuitionPaid: v })} />
      </FormField>
      <FormField label="Scholarships & Grants" tooltip={help?.fields['Scholarships & Grants']?.tooltip} irsRef={help?.fields['Scholarships & Grants']?.irsRef} optional>
        <CurrencyInput value={form.scholarships} onChange={(v) => setForm({ ...form, scholarships: v })} />
      </FormField>
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.studentName || !form.institution} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="education_credits" />

      <SectionIntro icon={<GraduationCap className="w-8 h-8" />} title="Education Credits" description="Enter education expenses from 1098-T forms." />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {taxReturn.filingStatus === FilingStatus.MarriedFilingSeparately && (
        <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">Not available for Married Filing Separately</p>
            <p className="text-xs text-slate-400 mt-1">Both the American Opportunity Credit and the Lifetime Learning Credit are disallowed when filing MFS. Consider filing jointly if you want to claim education credits.</p>
          </div>
        </div>
      )}
      {taxReturn.filingStatus !== FilingStatus.MarriedFilingSeparately && (() => {
        const edAgi = calculation?.form1040?.agi;
        if (edAgi == null || isNaN(edAgi)) return null;
        const isMFJ = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly || taxReturn.filingStatus === FilingStatus.QualifyingSurvivingSpouse;
        const start = isMFJ ? 160000 : 80000;
        const end = isMFJ ? 180000 : 90000;
        if (edAgi <= start) return null;
        return (
          <div className="mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-300">
                {edAgi >= end ? 'Education credits fully phased out' : 'Education credits partially reduced'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Your AGI (${edAgi.toLocaleString()}) {edAgi >= end ? `exceeds $${end.toLocaleString()}` : `is in the phase-out range ($${start.toLocaleString()}-$${end.toLocaleString()})`}. {edAgi >= end ? 'No education credit is available.' : 'Your credit will be reduced.'}
              </p>
            </div>
          </div>
        );
      })()}

      {taxReturn.educationCredits.map((ec, idx) =>
        editingId === ec.id ? (
          <div key={ec.id}>{renderForm(saveEdit, 'Save Changes')}</div>
        ) : (
          <div key={ec.id} className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`} role="button" tabIndex={0} onClick={() => startEdit(ec)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(ec); } }}>
            <div>
              <div className="font-medium">{ec.studentName} — {ec.institution}</div>
              <div className="text-sm text-slate-400">{ec.type === 'american_opportunity' ? 'AOTC' : 'LLC'} &middot; Tuition: ${(ec.tuitionPaid ?? 0).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-1">
              <ItemWarningBadge warnings={itemWarnings.get(idx)} /><button onClick={(e) => { e.stopPropagation(); startEdit(ec); }} className="p-2 text-slate-400 hover:text-telos-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); removeItem(ec.id); }} className="p-2 text-slate-400 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        )
      )}

      {!editingId && (
        adding ? (
          renderForm(addItem, 'Save Education Credit')
        ) : (
          <AddButton onClick={() => setAdding(true)}>Add Education Credit</AddButton>
        )
      )}

      {/* AOTC refundable-credit eligibility (Form 8863 Line 7) */}
      {taxReturn.educationCredits.some((ec) => ec.type === 'american_opportunity') && (
        <div className="card mt-6 space-y-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-telos-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-200">AOTC Refundable Credit Eligibility</p>
              <p className="text-xs text-slate-400 mt-1">Up to 40% of the American Opportunity Credit ($1,000) is refundable — unless you were a dependent who didn&apos;t provide over half your own support. Most filers can skip these questions.</p>
            </div>
          </div>

          <div className="space-y-3 pl-6">
            <div>
              <label className="label">Did you provide more than half of your own support this year?</label>
              <PillToggle
                twoOption
                size="sm"
                value={taxReturn.providedHalfOwnSupport === undefined ? undefined : taxReturn.providedHalfOwnSupport ? 'yes' : 'no'}
                onChange={(v) => updateField('providedHalfOwnSupport', v === undefined ? undefined : v === 'yes')}
              />
            </div>
            <div>
              <label className="label">Did you have at least one living parent at the end of the tax year?</label>
              <PillToggle
                twoOption
                size="sm"
                value={taxReturn.hasLivingParent === undefined ? undefined : taxReturn.hasLivingParent ? 'yes' : 'no'}
                onChange={(v) => updateField('hasLivingParent', v === undefined ? undefined : v === 'yes')}
              />
            </div>
          </div>
        </div>
      )}

      <StepNavigation />
    </div>
  );
}
