import { useMemo, useEffect } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertScheduleR } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { UserCheck, User, Users, Banknote, AlertTriangle } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import { FilingStatus } from '@telostax/engine';
import { isAge65OrOlder } from '../../utils/dateValidation';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';

export default function ScheduleRStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['elderly_disabled'];
  const isMFJ = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly;

  const info = taxReturn.scheduleR || {
    isAge65OrOlder: false,
    isSpouseAge65OrOlder: false,
    isDisabled: false,
    isSpouseDisabled: false,
    taxableDisabilityIncome: 0,
    spouseTaxableDisabilityIncome: 0,
    nontaxableSocialSecurity: 0,
    nontaxablePensions: 0,
  };

  // Pre-fill age from DOB when available
  const filerAgeFromDOB = useMemo(
    () => taxReturn.dateOfBirth ? isAge65OrOlder(taxReturn.dateOfBirth, taxReturn.taxYear) : undefined,
    [taxReturn.dateOfBirth, taxReturn.taxYear],
  );
  const spouseAgeFromDOB = useMemo(
    () => taxReturn.spouseDateOfBirth ? isAge65OrOlder(taxReturn.spouseDateOfBirth, taxReturn.taxYear) : undefined,
    [taxReturn.spouseDateOfBirth, taxReturn.taxYear],
  );

  // Sync pre-filled age into scheduleR when DOB is available
  useEffect(() => {
    if (filerAgeFromDOB !== undefined && info.isAge65OrOlder !== filerAgeFromDOB) {
      updateField('scheduleR', { ...info, isAge65OrOlder: filerAgeFromDOB });
    }
  }, [filerAgeFromDOB]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isMFJ && spouseAgeFromDOB !== undefined && info.isSpouseAge65OrOlder !== spouseAgeFromDOB) {
      updateField('scheduleR', { ...info, isSpouseAge65OrOlder: spouseAgeFromDOB });
    }
  }, [spouseAgeFromDOB, isMFJ]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (field: string, value: unknown) => {
    updateField('scheduleR', { ...info, [field]: value });
  };

  const save = async () => {
    await upsertScheduleR(returnId, { ...info });
  };

  const qualifiesFiler = info.isAge65OrOlder || info.isDisabled;
  const qualifiesSpouse = isMFJ && (info.isSpouseAge65OrOlder || info.isSpouseDisabled);

  return (
    <div>
      <StepWarningsBanner stepId="elderly_disabled" />

      <SectionIntro
        icon={<UserCheck className="w-8 h-8" />}
        title="Credit for the Elderly or Disabled"
        description="A credit for taxpayers age 65+ or who are permanently and totally disabled (Schedule R)."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <CalloutCard variant="info" title="How the credit is calculated" irsUrl="https://www.irs.gov/forms-pubs/about-schedule-r-form-1040">
        The credit equals 15% of your initial credit base after reductions. Your base starts at $5,000 (single/HoH), $7,500 (MFJ if both qualify), or $3,750 (MFS), then is reduced by any nontaxable Social Security or pension income and by 50% of AGI above the threshold ($7,500 single, $10,000 MFJ, $5,000 MFS). The credit is nonrefundable — it can reduce your tax to zero but won't generate a refund.
      </CalloutCard>

      <div className="mt-6 space-y-4">
        {/* Filer qualification */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <User className="w-5 h-5 text-telos-blue-400" />
            <h3 className="font-medium text-slate-200">Your Qualification</h3>
          </div>

          <FormField label="Are you age 65 or older?" tooltip="You were age 65 or older at the end of the tax year (born before January 2, 1961 for TY2025)." irsRef={help?.fields['Age 65 or Older']?.irsRef}>
            {filerAgeFromDOB !== undefined && (
              <p className="text-xs text-telos-blue-400 mb-2">
                Pre-filled from your date of birth. You can override if needed.
              </p>
            )}
            <div className="flex gap-3">
              <button className={`py-1.5 px-4 rounded text-sm ${info.isAge65OrOlder ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('isAge65OrOlder', true)}>Yes</button>
              <button className={`py-1.5 px-4 rounded text-sm ${!info.isAge65OrOlder ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('isAge65OrOlder', false)}>No</button>
            </div>
            {filerAgeFromDOB !== undefined && info.isAge65OrOlder !== filerAgeFromDOB && (
              <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  {filerAgeFromDOB
                    ? 'Your date of birth indicates you are age 65 or older, but you selected "No." Please verify this matches your Personal Info.'
                    : 'Your date of birth indicates you are under 65, but you selected "Yes." Please verify this matches your Personal Info.'}
                </p>
              </div>
            )}
          </FormField>

          {!info.isAge65OrOlder && (
            <FormField label="Are you permanently and totally disabled?" tooltip="You retired on permanent and total disability and received taxable disability income during the year." irsRef={help?.fields['Disabled']?.irsRef}>
              <div className="flex gap-3">
                <button className={`py-1.5 px-4 rounded text-sm ${info.isDisabled ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('isDisabled', true)}>Yes</button>
                <button className={`py-1.5 px-4 rounded text-sm ${!info.isDisabled ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('isDisabled', false)}>No</button>
              </div>
            </FormField>
          )}

          {info.isDisabled && !info.isAge65OrOlder && (
            <FormField label="Taxable Disability Income" tooltip="Your taxable disability income for the year. The credit is limited to this amount if you're under 65 and disabled." irsRef={help?.fields['Taxable Disability Income']?.irsRef}>
              <CurrencyInput value={info.taxableDisabilityIncome} onChange={(v) => update('taxableDisabilityIncome', v)} />
            </FormField>
          )}
        </div>

        {/* Spouse qualification (MFJ only) */}
        {isMFJ && (
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-telos-blue-400" />
              <h3 className="font-medium text-slate-200">Spouse's Qualification</h3>
            </div>

            <FormField label="Is your spouse age 65 or older?" tooltip="Your spouse was age 65 or older at the end of the tax year.">
              {spouseAgeFromDOB !== undefined && (
                <p className="text-xs text-telos-blue-400 mb-2">
                  Pre-filled from your spouse's date of birth. You can override if needed.
                </p>
              )}
              <div className="flex gap-3">
                <button className={`py-1.5 px-4 rounded text-sm ${info.isSpouseAge65OrOlder ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('isSpouseAge65OrOlder', true)}>Yes</button>
                <button className={`py-1.5 px-4 rounded text-sm ${!info.isSpouseAge65OrOlder ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('isSpouseAge65OrOlder', false)}>No</button>
              </div>
              {spouseAgeFromDOB !== undefined && info.isSpouseAge65OrOlder !== spouseAgeFromDOB && (
                <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">
                    {spouseAgeFromDOB
                      ? "Your spouse's date of birth indicates they are age 65 or older, but you selected \"No.\" Please verify this matches your Personal Info."
                      : "Your spouse's date of birth indicates they are under 65, but you selected \"Yes.\" Please verify this matches your Personal Info."}
                  </p>
                </div>
              )}
            </FormField>

            {!info.isSpouseAge65OrOlder && (
              <FormField label="Is your spouse permanently and totally disabled?" tooltip="Your spouse retired on permanent and total disability.">
                <div className="flex gap-3">
                  <button className={`py-1.5 px-4 rounded text-sm ${info.isSpouseDisabled ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('isSpouseDisabled', true)}>Yes</button>
                  <button className={`py-1.5 px-4 rounded text-sm ${!info.isSpouseDisabled ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('isSpouseDisabled', false)}>No</button>
                </div>
              </FormField>
            )}

            {info.isSpouseDisabled && !info.isSpouseAge65OrOlder && (
              <FormField label="Spouse's Taxable Disability Income" tooltip="Your spouse's taxable disability income for the year.">
                <CurrencyInput value={info.spouseTaxableDisabilityIncome} onChange={(v) => update('spouseTaxableDisabilityIncome', v)} />
              </FormField>
            )}
          </div>
        )}

        {/* Nontaxable income reductions */}
        {(qualifiesFiler || qualifiesSpouse) && (
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Banknote className="w-5 h-5 text-telos-blue-400" />
              <h3 className="font-medium text-slate-200">Nontaxable Income (reduces credit base)</h3>
            </div>

            <FormField label="Nontaxable Social Security & Railroad Retirement Benefits" tooltip="Total nontaxable Social Security benefits (from Form SSA-1099 minus the taxable amount)." irsRef={help?.fields['Nontaxable Social Security']?.irsRef}>
              <CurrencyInput value={info.nontaxableSocialSecurity} onChange={(v) => update('nontaxableSocialSecurity', v)} />
            </FormField>

            <FormField label="Other Nontaxable Pensions, Annuities, or Disability Income" tooltip="Other nontaxable pensions or disability payments that reduce the credit base." irsRef={help?.fields['Nontaxable Pensions']?.irsRef}>
              <CurrencyInput value={info.nontaxablePensions} onChange={(v) => update('nontaxablePensions', v)} />
            </FormField>
          </div>
        )}

        {!qualifiesFiler && !qualifiesSpouse && (
          <div className="card bg-surface-800 border-slate-700 text-sm text-slate-400">
            <p>Based on your answers, you don't appear to qualify for this credit. You must be age 65+ or permanently and totally disabled.</p>
          </div>
        )}
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
