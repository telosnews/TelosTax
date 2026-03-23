import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem, updateReturn } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Baby, Trash2, Pencil, ExternalLink, AlertTriangle } from 'lucide-react';
import AddButton from '../common/AddButton';
import PillToggle from '../common/PillToggle';
import { useState } from 'react';
import type { Dependent, KiddieTaxInfo } from '@telostax/engine';
import { HELP_CONTENT } from '../../data/helpContent';
import { validateDateOfBirth } from '../../utils/dateValidation';
import { maskSSN } from '@telostax/engine';
import ItemWarningBadge from '../common/ItemWarningBadge';
import SSNInput from '../common/SSNInput';
import { useItemWarnings } from '../../hooks/useWarnings';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';

const RELATIONSHIP_OPTIONS = [
  // Children
  'Son', 'Daughter', 'Stepson', 'Stepdaughter', 'Foster Child',
  // Siblings
  'Brother', 'Sister', 'Half Brother', 'Half Sister', 'Stepbrother', 'Stepsister',
  // Parents (engine checks for these to validate Head of Household)
  'Parent', 'Mother', 'Father', 'Stepmother', 'Stepfather',
  // Extended family
  'Grandchild', 'Grandparent',
  'Niece', 'Nephew', 'Aunt', 'Uncle',
  // Other
  'Son-in-Law', 'Daughter-in-Law',
  'Father-in-Law', 'Mother-in-Law',
  'Brother-in-Law', 'Sister-in-Law',
  'None (not related)',
] as const;

const emptyForm = { firstName: '', lastName: '', ssn: '', ssnLastFour: '', dateOfBirth: '', relationship: '', monthsLivedWithYou: 12, isStudent: false, isDisabled: false };


export default function DependentsStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('dependents');

  const help = HELP_CONTENT['dependents'];
  const [hasDependents, setHasDependents] = useState<'yes' | 'no' | undefined>(
    taxReturn.dependents.length > 0 ? 'yes' : undefined,
  );
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAdding(true);
  };

  const startEdit = (dep: Dependent) => {
    setAdding(false);
    setEditingId(dep.id);
    setForm({
      firstName: dep.firstName,
      lastName: dep.lastName,
      ssn: dep.ssn || '',
      ssnLastFour: dep.ssnLastFour || '',
      dateOfBirth: dep.dateOfBirth || '',
      relationship: dep.relationship,
      monthsLivedWithYou: dep.monthsLivedWithYou ?? 12,
      isStudent: dep.isStudent ?? false,
      isDisabled: dep.isDisabled ?? false,
    });
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const addDependent = async () => {
    const result = await addIncomeItem(returnId, 'dependents', form);
    const newDep: Dependent = {
      id: result.id,
      firstName: form.firstName,
      lastName: form.lastName,
      ssn: form.ssn || undefined,
      ssnLastFour: form.ssn ? form.ssn.slice(-4) : (form.ssnLastFour || undefined),
      dateOfBirth: form.dateOfBirth || undefined,
      relationship: form.relationship,
      monthsLivedWithYou: form.monthsLivedWithYou,
      isStudent: form.isStudent || undefined,
      isDisabled: form.isDisabled || undefined,
    };
    updateField('dependents', [...taxReturn.dependents, newDep]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, 'dependents', editingId, form);
    updateField(
      'dependents',
      taxReturn.dependents.map((d) =>
        d.id === editingId ? { ...d, ...form } : d,
      ),
    );
    cancelForm();
  };

  const removeDependent = (depId: string) => {
    const item = taxReturn.dependents.find((d) => d.id === depId);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'dependents',
      item: item as any,
      label: `Dependent${item.firstName ? `: ${item.firstName}` : ''}`,
      onCleanup: editingId === depId ? cancelForm : undefined,
    });
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="First Name" tooltip={help?.fields['First Name']?.tooltip}>
            <input className="input-field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Last Name" tooltip={help?.fields['Last Name']?.tooltip}>
            <input className="input-field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </FormField>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="w-48">
          <FormField label="SSN" tooltip={help?.fields['SSN (last 4)']?.tooltip} irsRef={help?.fields['SSN (last 4)']?.irsRef}>
            <SSNInput
              value={form.ssn}
              onChange={(val) => setForm({ ...form, ssn: val, ssnLastFour: val.length >= 4 ? val.slice(-4) : val })}
              optional
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Date of Birth" tooltip={help?.fields['Date of Birth']?.tooltip} irsRef={help?.fields['Date of Birth']?.irsRef} warning={validateDateOfBirth(form.dateOfBirth)}>
            <input type="date" className="input-field" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          </FormField>
        </div>
      </div>
      <FormField label="Relationship" tooltip={help?.fields['Relationship']?.tooltip} irsRef={help?.fields['Relationship']?.irsRef}>
        <select className="input-field" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
          <option value="">Select relationship…</option>
          {RELATIONSHIP_OPTIONS.map((rel) => (
            <option key={rel} value={rel}>{rel}</option>
          ))}
        </select>
      </FormField>
      <div className="flex gap-3">
        <div className="w-48">
          <FormField label="Months Lived With You" tooltip="Number of months this person lived in your home during the tax year. For qualifying children, must be more than 6 months (7+). Temporary absences (school, illness, military) count as time lived with you.">
            <input
              type="number"
              className="input-field"
              value={form.monthsLivedWithYou}
              onChange={(e) => setForm({ ...form, monthsLivedWithYou: Math.min(12, Math.max(0, parseInt(e.target.value) || 0)) })}
              min={0}
              max={12}
            />
          </FormField>
        </div>
        <div className="flex-1 flex items-end pb-2 gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-telos-orange-400"
              checked={form.isStudent}
              onChange={(e) => setForm({ ...form, isStudent: e.target.checked })}
            />
            <span className="text-sm text-slate-300">Full-time student</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-telos-orange-400"
              checked={form.isDisabled}
              onChange={(e) => setForm({ ...form, isDisabled: e.target.checked })}
            />
            <span className="text-sm text-slate-300">Permanently disabled</span>
          </label>
        </div>
      </div>
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.firstName || !form.lastName || !form.relationship} className="btn-primary text-sm">
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
      <StepWarningsBanner stepId="dependents" />

      <SectionIntro
        icon={<Baby className="w-8 h-8" />}
        title="Do you have any dependents?"
        description="Dependents can qualify you for tax credits and deductions."
      />

      <CalloutCard variant="info" title="Who qualifies as a dependent?" irsUrl="https://www.irs.gov/publications/p501">
        <p>
          A dependent must be either a <strong className="text-slate-300">qualifying child</strong> (under 19, or under 24 if a full-time student, lived with you 6+ months) or a <strong className="text-slate-300">qualifying relative</strong> (income under $5,200, you provided over half their support). They cannot file a joint return claiming an exemption.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <div className="font-medium text-slate-300 mb-1">Qualifying Child (all must be true):</div>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Your son, daughter, stepchild, foster child, sibling, or a descendant of any of them</li>
              <li>Under age 19 at end of 2025 (or under 24 if a full-time student)</li>
              <li>Lived with you for more than half of 2025</li>
              <li>Did not provide more than half of their own support</li>
              <li>Does not file a joint return (unless only to claim a refund)</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-slate-300 mb-1">Qualifying Relative (all must be true):</div>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Either lives with you all year OR is a close relative (parent, sibling, etc.)</li>
              <li>Gross income under $5,200 for 2025</li>
              <li>You provided more than half of their total support</li>
              <li>Not someone else's qualifying child</li>
            </ul>
          </div>
          <p className="text-xs text-slate-400">
            Dependents you claim may qualify you for the Child Tax Credit ($2,200 per qualifying child under 17), the Earned Income Tax Credit, and other tax benefits.
          </p>
        </div>
      </CalloutCard>

      <div className="mt-6 mb-6">
        <PillToggle
          value={hasDependents}
          onChange={(v) => {
            setHasDependents(v);
            if (v !== 'yes') { setAdding(false); setEditingId(null); }
          }}
          twoOption
        />
      </div>

      {hasDependents === 'yes' && (
        <>

          {/* Existing dependents */}
          {taxReturn.dependents.length > 0 && (
        <div className="space-y-3 mt-6">
          {taxReturn.dependents.map((dep, idx) =>
            editingId === dep.id ? (
              <div key={dep.id}>{renderForm(saveEdit, 'Save Changes')}</div>
            ) : (
              <div
                key={dep.id}
                className={`card flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => startEdit(dep)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(dep); } }}
              >
                <div>
                  <div className="font-medium">{dep.firstName} {dep.lastName}</div>
                  <div className="text-sm text-slate-400">
                    {dep.relationship}
                    {(dep.ssn || dep.ssnLastFour) && <span> &middot; SSN {dep.ssn ? maskSSN(dep.ssn) : `···${dep.ssnLastFour}`}</span>}
                    {dep.dateOfBirth && <span> &middot; DOB {dep.dateOfBirth}</span>}
                    {dep.monthsLivedWithYou < 12 && <span> &middot; {dep.monthsLivedWithYou}mo</span>}
                    {dep.isStudent && <span className="ml-1 text-xs bg-telos-blue-600/30 text-telos-blue-300 px-1.5 py-0.5 rounded">Student</span>}
                    {dep.isDisabled && <span className="ml-1 text-xs bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded">Disabled</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <ItemWarningBadge warnings={itemWarnings.get(idx)} />
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(dep); }}
                    className="p-2 text-slate-400 hover:text-telos-blue-400"
                    title="Edit dependent"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeDependent(dep.id); }}
                    className="p-2 text-slate-400 hover:text-red-400"
                    title="Remove dependent"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {/* Add form */}
      {adding ? (
        renderForm(addDependent, 'Save Dependent')
      ) : (
        !editingId && (
          <AddButton onClick={startAdd}>Add a Dependent</AddButton>
        )
      )}

      {/* Kiddie Tax (Form 8615) — per-child entries */}
      {taxReturn.dependents.length > 0 && (
        <KiddieTaxSection />
      )}
        </>
      )}

      <StepNavigation onContinue={async () => {
        const entries = taxReturn.kiddieTaxEntries;
        if (entries && entries.length > 0) {
          await updateReturn(returnId, { kiddieTaxEntries: entries });
        }
      }} />
    </div>
  );
}

// ─── Kiddie Tax Section (extracted for clarity) ───────────────────────
const EMPTY_KIDDIE: Omit<KiddieTaxInfo, 'id'> = {
  childUnearnedIncome: 0,
  childEarnedIncome: 0,
  childAge: 0,
  isFullTimeStudent: false,
  childName: '',
  dependentId: '',
};

function KiddieTaxSection() {
  const { taxReturn, updateField } = useTaxReturnStore();
  if (!taxReturn) return null;

  const entries = taxReturn.kiddieTaxEntries || [];
  const dependents = taxReturn.dependents || [];

  const [addingKiddie, setAddingKiddie] = useState(false);
  const [editingKiddieId, setEditingKiddieId] = useState<string | null>(null);
  const [kiddieForm, setKiddieForm] = useState({ ...EMPTY_KIDDIE });

  const cancelKiddie = () => { setKiddieForm({ ...EMPTY_KIDDIE }); setAddingKiddie(false); setEditingKiddieId(null); };

  const persistEntries = (next: KiddieTaxInfo[]) => {
    updateField('kiddieTaxEntries', next);
  };

  const addKiddieEntry = () => {
    persistEntries([...entries, { id: crypto.randomUUID(), ...kiddieForm }]);
    cancelKiddie();
  };

  const saveKiddieEdit = () => {
    if (!editingKiddieId) return;
    persistEntries(entries.map(e => e.id === editingKiddieId ? { ...e, ...kiddieForm } : e));
    cancelKiddie();
  };

  const removeKiddieEntry = (id: string) => {
    persistEntries(entries.filter(e => e.id !== id));
    if (editingKiddieId === id) cancelKiddie();
  };

  const startKiddieEdit = (entry: KiddieTaxInfo) => {
    setAddingKiddie(false);
    setEditingKiddieId(entry.id);
    setKiddieForm({
      childName: entry.childName || '',
      dependentId: entry.dependentId || '',
      childUnearnedIncome: entry.childUnearnedIncome,
      childEarnedIncome: entry.childEarnedIncome || 0,
      childAge: entry.childAge,
      isFullTimeStudent: !!entry.isFullTimeStudent,
    });
  };

  const handleDependentSelect = (depId: string) => {
    const dep = dependents.find(d => d.id === depId);
    if (dep) {
      const age = dep.dateOfBirth
        ? Math.floor((new Date(2025, 11, 31).getTime() - new Date(dep.dateOfBirth).getTime()) / 31557600000)
        : kiddieForm.childAge;
      setKiddieForm(prev => ({
        ...prev,
        dependentId: depId,
        childName: `${dep.firstName} ${dep.lastName}`.trim(),
        childAge: age,
      }));
    } else {
      setKiddieForm(prev => ({ ...prev, dependentId: '', childName: '' }));
    }
  };

  const renderKiddieForm = (onSave: () => void, label: string) => (
    <div className="card mt-4">
      <FormField label="Dependent" optional helpText="Select a dependent or enter manually">
        <select
          className="input-field"
          value={kiddieForm.dependentId || ''}
          onChange={(e) => handleDependentSelect(e.target.value)}
        >
          <option value="">Select a dependent...</option>
          {dependents.map(d => (
            <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
          ))}
        </select>
      </FormField>
      {!kiddieForm.dependentId && (
        <FormField label="Child's Name" optional>
          <input className="input-field" value={kiddieForm.childName || ''} onChange={(e) => setKiddieForm({ ...kiddieForm, childName: e.target.value })} placeholder="Child's full name" />
        </FormField>
      )}
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Unearned Income" helpText="Interest, dividends, capital gains">
            <CurrencyInput value={kiddieForm.childUnearnedIncome} onChange={(v) => setKiddieForm({ ...kiddieForm, childUnearnedIncome: v })} />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Earned Income" optional helpText="Wages, salary">
            <CurrencyInput value={kiddieForm.childEarnedIncome} onChange={(v) => setKiddieForm({ ...kiddieForm, childEarnedIncome: v })} />
          </FormField>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="w-32">
          <FormField label="Age" optional>
            <input type="number" className="input-field" value={kiddieForm.childAge || ''} onChange={(e) => setKiddieForm({ ...kiddieForm, childAge: Number(e.target.value) })} min={0} max={24} />
          </FormField>
        </div>
        <div className="flex-1 flex items-end pb-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="accent-telos-orange-400" checked={!!kiddieForm.isFullTimeStudent} onChange={(e) => setKiddieForm({ ...kiddieForm, isFullTimeStudent: e.target.checked })} />
            <span className="text-sm text-slate-300">Full-time student (extends age limit to 24)</span>
          </label>
        </div>
      </div>
      {kiddieForm.childUnearnedIncome > 2500 && (
        <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
          Unearned income exceeds $2,500 threshold — Form 8615 applies.
        </div>
      )}
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!kiddieForm.childUnearnedIncome} className="btn-primary text-sm">{label}</button>
        <button onClick={cancelKiddie} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="card mt-6">
      <div className="flex items-center gap-3 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <h3 className="font-medium text-slate-200">Kiddie Tax (Form 8615)</h3>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        If a dependent child under 19 (or under 24 if a full-time student) has unearned income over $2,500, the excess may be taxed at the parent's rate. Add an entry for each qualifying child.
      </p>

      {entries.map((entry) =>
        editingKiddieId === entry.id ? (
          <div key={entry.id}>{renderKiddieForm(saveKiddieEdit, 'Save Changes')}</div>
        ) : (
          <div
            key={entry.id}
            className="mt-3 rounded-lg border border-slate-700 bg-surface-800 p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors"
            onClick={() => startKiddieEdit(entry)}
          >
            <div>
              <div className="font-medium text-sm">{entry.childName || 'Unnamed Child'}</div>
              <div className="text-xs text-slate-400">
                Age {entry.childAge ?? '?'} &middot; Unearned: ${(entry.childUnearnedIncome ?? 0).toLocaleString()}
                {entry.childUnearnedIncome > 2500 && <span className="text-amber-400 ml-1">(Form 8615 applies)</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); startKiddieEdit(entry); }} className="p-2 text-slate-400 hover:text-telos-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); removeKiddieEntry(entry.id); }} className="p-2 text-slate-400 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        )
      )}

      {!editingKiddieId && (
        addingKiddie ? (
          renderKiddieForm(addKiddieEntry, 'Save Entry')
        ) : (
          <button onClick={() => { cancelKiddie(); setAddingKiddie(true); }} className="mt-3 w-full rounded-lg border border-dashed border-slate-600 hover:border-slate-500 p-3 text-sm text-slate-400 hover:text-slate-300 transition-colors">
            + Add Child for Kiddie Tax
          </button>
        )
      )}

      <a
        href="https://www.irs.gov/forms-pubs/about-form-8615"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>
    </div>
  );
}
