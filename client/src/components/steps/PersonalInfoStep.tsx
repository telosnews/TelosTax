import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import StepNavigation from '../layout/StepNavigation';
import { User, ExternalLink, Shield } from 'lucide-react';
import SectionIntro from '../common/SectionIntro';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import { validateDateOfBirth } from '../../utils/dateValidation';
import { validateZipStateMatch } from '../../utils/zipValidation';
import ZIPInput from '../common/ZIPInput';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { FilingStatus } from '@telostax/engine';

export default function PersonalInfoStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['personal_info'];

  const save = async () => {
    await updateReturn(returnId, {
      firstName: taxReturn.firstName,
      middleInitial: taxReturn.middleInitial,
      lastName: taxReturn.lastName,
      dateOfBirth: taxReturn.dateOfBirth,
      occupation: taxReturn.occupation,
      addressStreet: taxReturn.addressStreet,
      addressCity: taxReturn.addressCity,
      addressState: taxReturn.addressState,
      suffix: taxReturn.suffix,
      addressZip: taxReturn.addressZip,
      isLegallyBlind: taxReturn.isLegallyBlind,
      canBeClaimedAsDependent: taxReturn.canBeClaimedAsDependent,
      isActiveDutyMilitary: taxReturn.isActiveDutyMilitary,
      nontaxableCombatPay: taxReturn.nontaxableCombatPay,
      movingExpenses: taxReturn.movingExpenses,
      digitalAssetActivity: taxReturn.digitalAssetActivity,
      presidentialCampaignFund: taxReturn.presidentialCampaignFund,
      extensionFiled: taxReturn.extensionFiled,
      ipPin: taxReturn.ipPin,
      isFullTimeStudent: taxReturn.isFullTimeStudent,
      isSpouseFullTimeStudent: taxReturn.isSpouseFullTimeStudent,
      isClaimedAsDependent: taxReturn.isClaimedAsDependent,
    });
  };

  return (
    <div>
      <StepWarningsBanner stepId="personal_info" />

      <SectionIntro
        icon={<User className="w-8 h-8" />}
        title="Tell us about yourself"
        description="We need some basic information to get started."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="space-y-1 mt-6">
        <div className="flex gap-3">
          <div className="flex-1">
            <FormField label="First Name" tooltip={help?.fields['First Name']?.tooltip} irsRef={help?.fields['First Name']?.irsRef}>
              <input
                className="input-field"
                value={taxReturn.firstName || ''}
                onChange={(e) => updateField('firstName', e.target.value)}
                placeholder="Jane"
              />
            </FormField>
          </div>
          <div className="w-20">
            <FormField label="MI" optional tooltip={help?.fields['MI']?.tooltip} irsRef={help?.fields['MI']?.irsRef}>
              <input
                className="input-field"
                value={taxReturn.middleInitial || ''}
                onChange={(e) => updateField('middleInitial', e.target.value.slice(0, 1))}
                maxLength={1}
              />
            </FormField>
          </div>
          <div className="flex-1">
            <FormField label="Last Name" tooltip={help?.fields['Last Name']?.tooltip} irsRef={help?.fields['Last Name']?.irsRef}>
              <input
                className="input-field"
                value={taxReturn.lastName || ''}
                onChange={(e) => updateField('lastName', e.target.value)}
                placeholder="Doe"
              />
            </FormField>
          </div>
          <div className="w-20">
            <FormField label="Suffix" optional>
              <input
                className="input-field"
                value={taxReturn.suffix || ''}
                onChange={(e) => updateField('suffix', e.target.value.slice(0, 4))}
                maxLength={4}
                placeholder="Jr."
              />
            </FormField>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <FormField label="Date of Birth" tooltip={help?.fields['Date of Birth']?.tooltip} irsRef={help?.fields['Date of Birth']?.irsRef} warning={validateDateOfBirth(taxReturn.dateOfBirth || '')}>
              <input
                type="date"
                className="input-field"
                value={taxReturn.dateOfBirth || ''}
                onChange={(e) => updateField('dateOfBirth', e.target.value)}
              />
            </FormField>
          </div>
          <div className="flex-1">
            <FormField label="Occupation" optional helpText="e.g. Teacher, Software Engineer, Nurse" tooltip={help?.fields['Occupation']?.tooltip} irsRef={help?.fields['Occupation']?.irsRef}>
              <input
                className="input-field"
                value={taxReturn.occupation || ''}
                onChange={(e) => updateField('occupation', e.target.value)}
              />
            </FormField>
          </div>
        </div>

        <FormField label="Street Address" tooltip={help?.fields['Street Address']?.tooltip} irsRef={help?.fields['Street Address']?.irsRef}>
          <input
            className="input-field"
            value={taxReturn.addressStreet || ''}
            onChange={(e) => updateField('addressStreet', e.target.value)}
            placeholder="123 Main St"
          />
        </FormField>

        <div className="flex gap-3">
          <div className="flex-1">
            <FormField label="City" tooltip={help?.fields['City']?.tooltip} irsRef={help?.fields['City']?.irsRef}>
              <input
                className="input-field"
                value={taxReturn.addressCity || ''}
                onChange={(e) => updateField('addressCity', e.target.value)}
              />
            </FormField>
          </div>
          <div className="w-24">
            <FormField label="State" tooltip={help?.fields['State']?.tooltip} irsRef={help?.fields['State']?.irsRef}>
              <input
                className="input-field"
                value={taxReturn.addressState || ''}
                onChange={(e) => updateField('addressState', e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                placeholder="CA"
              />
            </FormField>
          </div>
          <div className="w-32">
            <FormField label="ZIP" tooltip={help?.fields['ZIP']?.tooltip} irsRef={help?.fields['ZIP']?.irsRef} warning={validateZipStateMatch(taxReturn.addressZip, taxReturn.addressState)}>
              <ZIPInput value={taxReturn.addressZip || ''} onChange={(v) => updateField('addressZip', v)} />
            </FormField>
          </div>
        </div>
      </div>

      {/* Additional IRS Questions */}
      <div className="mt-6 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Additional Questions</h3>

        <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
          <input
            type="checkbox"
            className="mt-0.5 accent-telos-orange-400"
            checked={!!taxReturn.canBeClaimedAsDependent}
            onChange={(e) => {
              updateField('canBeClaimedAsDependent', e.target.checked);
              if (!e.target.checked) {
                updateField('isClaimedAsDependent', false);
              }
            }}
          />
          <div>
            <span className="text-sm text-slate-200">Someone else can claim me as a dependent</span>
            <p className="text-xs text-slate-400 mt-0.5">
              Check this if a parent, guardian, or someone else can claim you on their tax return. This reduces your standard deduction.
            </p>
            <a
              href="https://www.irs.gov/publications/p501"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Learn more on IRS.gov
            </a>
          </div>
        </label>

        {/* Nested: actually claimed as dependent — only when canBeClaimedAsDependent is checked */}
        {taxReturn.canBeClaimedAsDependent && (
          <label className="flex items-start gap-3 p-3 ml-6 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
            <input
              type="checkbox"
              className="mt-0.5 accent-telos-orange-400"
              checked={!!taxReturn.isClaimedAsDependent}
              onChange={(e) => updateField('isClaimedAsDependent', e.target.checked)}
            />
            <div>
              <span className="text-sm text-slate-200">I was actually claimed as a dependent on another return</span>
              <p className="text-xs text-slate-400 mt-0.5">
                Disqualifies you from the Saver's Credit and EITC.
              </p>
            </div>
          </label>
        )}

        <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
          <input
            type="checkbox"
            className="mt-0.5 accent-telos-orange-400"
            checked={!!taxReturn.isFullTimeStudent}
            onChange={(e) => updateField('isFullTimeStudent', e.target.checked)}
          />
          <div>
            <span className="text-sm text-slate-200">I was a full-time student in {taxReturn.taxYear}</span>
            <p className="text-xs text-slate-400 mt-0.5">
              Full-time student for at least 5 months. Affects Saver's Credit eligibility.
            </p>
          </div>
        </label>

        {taxReturn.filingStatus === FilingStatus.MarriedFilingJointly && (
          <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
            <input
              type="checkbox"
              className="mt-0.5 accent-telos-orange-400"
              checked={!!taxReturn.isSpouseFullTimeStudent}
              onChange={(e) => updateField('isSpouseFullTimeStudent', e.target.checked)}
            />
            <div>
              <span className="text-sm text-slate-200">My spouse was a full-time student in {taxReturn.taxYear}</span>
              <p className="text-xs text-slate-400 mt-0.5">
                Affects spouse's Saver's Credit eligibility.
              </p>
            </div>
          </label>
        )}

        <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
          <input
            type="checkbox"
            className="mt-0.5 accent-telos-orange-400"
            checked={!!taxReturn.isLegallyBlind}
            onChange={(e) => updateField('isLegallyBlind', e.target.checked)}
          />
          <div>
            <span className="text-sm text-slate-200">I am legally blind</span>
            <p className="text-xs text-slate-400 mt-0.5">
              This increases your standard deduction by $2,000 ($1,600 if married).
            </p>
            <a
              href="https://www.irs.gov/taxtopics/tc551"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Learn more on IRS.gov
            </a>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
          <input
            type="checkbox"
            className="mt-0.5 accent-telos-orange-400"
            checked={!!taxReturn.isActiveDutyMilitary}
            onChange={(e) => {
              updateField('isActiveDutyMilitary', e.target.checked);
              if (!e.target.checked) {
                updateField('movingExpenses', undefined);
                updateField('nontaxableCombatPay', undefined);
                updateField('includeCombatPayForEITC', undefined);
              }
            }}
          />
          <div>
            <span className="text-sm text-slate-200">I am an active-duty member of the US Armed Forces</span>
            <p className="text-xs text-slate-400 mt-0.5">
              Includes active duty, reserve, or National Guard. This unlocks the military moving expenses deduction (Form 3903) and nontaxable combat pay reporting.
            </p>
            <a
              href="https://www.irs.gov/individuals/military"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Learn more on IRS.gov
            </a>
          </div>
        </label>

        {/* Conditional military fields */}
        {taxReturn.isActiveDutyMilitary && (
          <div className="ml-6 space-y-3 border-l-2 border-telos-blue-500/30 pl-4">
            <div className="flex items-center gap-2 text-xs text-telos-blue-400 mb-2">
              <Shield className="w-3.5 h-3.5" />
              <span className="font-medium uppercase tracking-wider">Military Tax Benefits</span>
            </div>

            <FormField
              label="Moving Expenses (Form 3903)"
              optional
              helpText="Unreimbursed moving expenses for a military-ordered permanent change of station"
              tooltip="Only active-duty members can deduct moving expenses. Enter the amount from Form 3903. This is an above-the-line deduction (Schedule 1, Line 14)."
              irsRef="https://www.irs.gov/forms-pubs/about-form-3903"
            >
              <input
                type="number"
                className="input-field"
                value={taxReturn.movingExpenses || ''}
                onChange={(e) => updateField('movingExpenses', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="0"
                min="0"
                step="1"
              />
            </FormField>

            <FormField
              label="Nontaxable Combat Pay"
              optional
              helpText="Pay received while serving in a combat zone (Form 1040, Line 1i)"
              tooltip="Enter nontaxable combat zone pay from your W-2, Box 12, Code Q. This amount is excluded from income but you may elect to include it as earned income for the EITC."
              irsRef="https://www.irs.gov/newsroom/combat-zone-tax-exclusions"
            >
              <input
                type="number"
                className="input-field"
                value={taxReturn.nontaxableCombatPay || ''}
                onChange={(e) => updateField('nontaxableCombatPay', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="0"
                min="0"
                step="1"
              />
            </FormField>

            {taxReturn.nontaxableCombatPay && taxReturn.nontaxableCombatPay > 0 && (
              <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800/50 border border-slate-700/30 cursor-pointer hover:border-slate-600/50 transition-colors">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-telos-orange-400"
                  checked={!!taxReturn.includeCombatPayForEITC}
                  onChange={(e) => updateField('includeCombatPayForEITC', e.target.checked)}
                />
                <div>
                  <span className="text-sm text-slate-200">Include combat pay as earned income for EITC</span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    You may elect to include your nontaxable combat pay as earned income when computing the Earned Income Tax Credit. This may increase or decrease your EITC depending on your income level.
                  </p>
                </div>
              </label>
            )}
          </div>
        )}

        <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
          <input
            type="checkbox"
            className="mt-0.5 accent-telos-orange-400"
            checked={!!taxReturn.digitalAssetActivity}
            onChange={(e) => updateField('digitalAssetActivity', e.target.checked)}
          />
          <div>
            <span className="text-sm text-slate-200">I received, sold, exchanged, or disposed of digital assets</span>
            <p className="text-xs text-slate-400 mt-0.5">
              The IRS requires all filers to answer this question. Check "Yes" if you received, sold, sent, exchanged, or otherwise acquired any digital assets (e.g. cryptocurrency, NFTs) during 2025.
            </p>
            <a
              href="https://www.irs.gov/individuals/digital-assets"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Learn more on IRS.gov
            </a>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
          <input
            type="checkbox"
            className="mt-0.5 accent-telos-orange-400"
            checked={!!taxReturn.presidentialCampaignFund}
            onChange={(e) => updateField('presidentialCampaignFund', e.target.checked)}
          />
          <div>
            <span className="text-sm text-slate-200">Designate $3 to the Presidential Election Campaign Fund</span>
            <p className="text-xs text-slate-400 mt-0.5">
              This does not change your tax or reduce your refund.
            </p>
            <a
              href="https://www.irs.gov/taxtopics/tc505"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Learn more on IRS.gov
            </a>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
          <input
            type="checkbox"
            className="mt-0.5 accent-telos-orange-400"
            checked={!!taxReturn.extensionFiled}
            onChange={(e) => updateField('extensionFiled', e.target.checked)}
          />
          <div>
            <span className="text-sm text-slate-200">I filed an extension (Form 4868)</span>
            <p className="text-xs text-slate-400 mt-0.5">
              Check this if you already filed for an automatic 6-month extension. Your new deadline is October 15, 2026.
              You can also generate Form 4868 from the Filing Instructions page.
            </p>
            <a
              href="https://www.irs.gov/forms-pubs/about-form-4868"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Learn more on IRS.gov
            </a>
          </div>
        </label>

        {/* IP PIN */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50">
          <div>
            <span className="text-sm text-slate-200">Identity Protection PIN (IP PIN)</span>
            <p className="text-xs text-slate-400 mt-0.5">
              If the IRS issued you a 6-digit Identity Protection PIN (on notice CP01A), enter it below. Your return will be rejected without it.
            </p>
            <a
              href="https://www.irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Learn more on IRS.gov
            </a>
            <div className="mt-3">
              <input
                className="input-field w-32 font-mono tracking-widest"
                value={taxReturn.ipPin || ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  updateField('ipPin', v || undefined);
                }}
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]{6}"
                placeholder="000000"
              />
              {taxReturn.ipPin && taxReturn.ipPin.length !== 6 && (
                <p className="text-xs text-amber-400 mt-1">IP PIN must be exactly 6 digits</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
