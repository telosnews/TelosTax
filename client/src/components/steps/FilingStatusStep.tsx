import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import { FilingStatus } from '@telostax/engine';
import CardSelector from '../common/CardSelector';
import FormField from '../common/FormField';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import ContextualHelpLink from '../common/ContextualHelpLink';
import { Users, ExternalLink, Shield } from 'lucide-react';
import { HELP_CONTENT, CONTEXTUAL_HELP } from '../../data/helpContent';
import { validateDateOfBirth, validateDeathDate } from '../../utils/dateValidation';
import CalloutCard from '../common/CalloutCard';
import StepWarningsBanner from '../common/StepWarningsBanner';

const FILING_OPTIONS = [
  { value: FilingStatus.Single, label: 'Single', description: 'Unmarried, or legally separated' },
  { value: FilingStatus.MarriedFilingJointly, label: 'Married Filing Jointly', description: 'Married, filing one return together' },
  { value: FilingStatus.MarriedFilingSeparately, label: 'Married Filing Separately', description: 'Married, each filing their own return' },
  { value: FilingStatus.HeadOfHousehold, label: 'Head of Household', description: 'Unmarried with qualifying dependent' },
  { value: FilingStatus.QualifyingSurvivingSpouse, label: 'Qualifying Surviving Spouse', description: 'Spouse died in 2023 or 2024, with dependent child' },
];

export default function FilingStatusStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['filing_status'];
  const isMFJ = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly;
  const isMFS = taxReturn.filingStatus === FilingStatus.MarriedFilingSeparately;
  const isHoH = taxReturn.filingStatus === FilingStatus.HeadOfHousehold;
  const isQSS = taxReturn.filingStatus === FilingStatus.QualifyingSurvivingSpouse;
  const showSpouseInfo = isMFJ || isQSS;

  const save = async () => {
    const body: Record<string, unknown> = { filingStatus: taxReturn.filingStatus };
    if (showSpouseInfo) {
      body.spouseFirstName = taxReturn.spouseFirstName;
      body.spouseMiddleInitial = taxReturn.spouseMiddleInitial;
      body.spouseLastName = taxReturn.spouseLastName;
      body.spouseSuffix = taxReturn.spouseSuffix;
      body.spouseDateOfBirth = taxReturn.spouseDateOfBirth;
      body.spouseOccupation = taxReturn.spouseOccupation;
      body.spouseIsLegallyBlind = taxReturn.spouseIsLegallyBlind;
      body.spousePresidentialCampaignFund = taxReturn.spousePresidentialCampaignFund;
      body.spouseIpPin = taxReturn.spouseIpPin;
    } else {
      // Clear spouse IP PIN when filing status doesn't include spouse
      body.spouseIpPin = undefined;
    }
    if (showSpouseInfo || isQSS) {
      body.spouseDateOfDeath = taxReturn.spouseDateOfDeath;
      body.isDeceasedSpouseReturn = taxReturn.isDeceasedSpouseReturn;
    }
    if (isMFS) {
      body.livedApartFromSpouse = taxReturn.livedApartFromSpouse;
    }
    if (isHoH) {
      body.paidOverHalfHouseholdCost = taxReturn.paidOverHalfHouseholdCost;
    }
    await updateReturn(returnId, body);
  };

  return (
    <div>
      <StepWarningsBanner stepId="filing_status" />

      <SectionIntro
        icon={<Users className="w-8 h-8" />}
        title="What's your filing status?"
        description="This affects your tax rates and standard deduction amount."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="mt-4 mb-2">
        <ContextualHelpLink
          label={CONTEXTUAL_HELP.filing_status_helper.label}
          modalTitle={CONTEXTUAL_HELP.filing_status_helper.title}
          modalExplanation={CONTEXTUAL_HELP.filing_status_helper.explanation}
          irsUrl={CONTEXTUAL_HELP.filing_status_helper.irsUrl}
        />
      </div>

      <div className="mt-4">
        <CardSelector
          options={FILING_OPTIONS}
          value={taxReturn.filingStatus}
          onChange={(v) => updateField('filingStatus', v)}
        />
      </div>

      {/* Spouse info for MFJ / QSS */}
      {showSpouseInfo && (
        <div className="mt-6 card">
          <h3 className="font-medium text-slate-200 mb-4">Spouse Information</h3>
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="Spouse First Name" tooltip={help?.fields['Spouse First Name']?.tooltip} irsRef={help?.fields['Spouse First Name']?.irsRef}>
                <input
                  className="input-field"
                  value={taxReturn.spouseFirstName || ''}
                  onChange={(e) => updateField('spouseFirstName', e.target.value)}
                />
              </FormField>
            </div>
            <div className="w-20">
              <FormField label="MI" optional tooltip={help?.fields['MI']?.tooltip} irsRef={help?.fields['MI']?.irsRef}>
                <input
                  className="input-field"
                  value={taxReturn.spouseMiddleInitial || ''}
                  onChange={(e) => updateField('spouseMiddleInitial', e.target.value.slice(0, 1))}
                  maxLength={1}
                />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="Spouse Last Name" tooltip={help?.fields['Spouse Last Name']?.tooltip} irsRef={help?.fields['Spouse Last Name']?.irsRef}>
                <input
                  className="input-field"
                  value={taxReturn.spouseLastName || ''}
                  onChange={(e) => updateField('spouseLastName', e.target.value)}
                />
              </FormField>
            </div>
            <div className="w-20">
              <FormField label="Suffix" optional tooltip={help?.fields['Suffix']?.tooltip} irsRef={help?.fields['Suffix']?.irsRef}>
                <input
                  className="input-field"
                  value={taxReturn.spouseSuffix || ''}
                  onChange={(e) => updateField('spouseSuffix', e.target.value.slice(0, 4))}
                  maxLength={4}
                  placeholder="Jr."
                />
              </FormField>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="Spouse Date of Birth" optional warning={validateDateOfBirth(taxReturn.spouseDateOfBirth || '')} tooltip={help?.fields['Spouse Date of Birth']?.tooltip} irsRef={help?.fields['Spouse Date of Birth']?.irsRef}>
                <input
                  type="date"
                  className="input-field"
                  value={taxReturn.spouseDateOfBirth || ''}
                  onChange={(e) => updateField('spouseDateOfBirth', e.target.value)}
                />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="Spouse Occupation" optional tooltip={help?.fields['Spouse Occupation']?.tooltip} irsRef={help?.fields['Spouse Occupation']?.irsRef}>
                <input
                  className="input-field"
                  value={taxReturn.spouseOccupation || ''}
                  onChange={(e) => updateField('spouseOccupation', e.target.value)}
                />
              </FormField>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 accent-telos-orange-400"
                checked={!!taxReturn.spouseIsLegallyBlind}
                onChange={(e) => updateField('spouseIsLegallyBlind', e.target.checked)}
              />
              <div>
                <span className="text-sm text-slate-200">Spouse is legally blind</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  This increases your standard deduction by $1,600.
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
                checked={!!taxReturn.spousePresidentialCampaignFund}
                onChange={(e) => updateField('spousePresidentialCampaignFund', e.target.checked)}
              />
              <div>
                <span className="text-sm text-slate-200">Spouse designates $3 to the Presidential Election Campaign Fund</span>
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

            <div className="p-3 rounded-lg bg-surface-800 border border-slate-700/50">
              <FormField
                label="Spouse's Identity Protection PIN (IP PIN)"
                optional
                helpText="6-digit number issued by the IRS to your spouse"
                tooltip="If the IRS issued your spouse an Identity Protection PIN, enter it here. It's a 6-digit number on their CP01A notice."
                irsRef="https://www.irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin"
                warning={taxReturn.spouseIpPin && taxReturn.spouseIpPin.length !== 6 ? 'IP PIN must be exactly 6 digits' : undefined}
              >
                <input
                  className="input-field w-32 font-mono tracking-widest"
                  value={taxReturn.spouseIpPin || ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    updateField('spouseIpPin', v || undefined);
                  }}
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  placeholder="000000"
                />
              </FormField>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 accent-telos-orange-400"
                checked={!!taxReturn.isDeceasedSpouseReturn}
                onChange={(e) => updateField('isDeceasedSpouseReturn', e.target.checked)}
              />
              <div>
                <span className="text-sm text-slate-200">My spouse passed away</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  If your spouse died during 2025, you can still file jointly for this tax year.
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

            {taxReturn.isDeceasedSpouseReturn && (
              <div className="ml-9">
                <FormField label="Spouse Date of Death" tooltip={help?.fields['Spouse Date of Death']?.tooltip} irsRef={help?.fields['Spouse Date of Death']?.irsRef} warning={validateDeathDate(taxReturn.spouseDateOfDeath || '')}>
                  <input
                    type="date"
                    className="input-field"
                    value={taxReturn.spouseDateOfDeath || ''}
                    onChange={(e) => updateField('spouseDateOfDeath', e.target.value)}
                  />
                </FormField>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MFS-specific questions */}
      {isMFS && (
        <div className="mt-6 card">
          <h3 className="font-medium text-slate-200 mb-3">Married Filing Separately</h3>
          <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
            <input
              type="checkbox"
              className="mt-0.5 accent-telos-orange-400"
              checked={!!taxReturn.livedApartFromSpouse}
              onChange={(e) => updateField('livedApartFromSpouse', e.target.checked)}
            />
            <div>
              <span className="text-sm text-slate-200">I lived apart from my spouse for all of 2025</span>
              <p className="text-xs text-slate-400 mt-0.5">
                This affects Social Security taxability thresholds and may allow you to claim the dependent care credit.
              </p>
              <a
                href="https://www.irs.gov/publications/p504"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Learn more on IRS.gov
              </a>
            </div>
          </label>
        </div>
      )}

      {/* HoH-specific questions */}
      {isHoH && (
        <div className="mt-6 card">
          <h3 className="font-medium text-slate-200 mb-3">Head of Household</h3>
          <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-800 border border-slate-700/50 cursor-pointer hover:border-slate-600/50 transition-colors">
            <input
              type="checkbox"
              className="mt-0.5 accent-telos-orange-400"
              checked={!!taxReturn.paidOverHalfHouseholdCost}
              onChange={(e) => updateField('paidOverHalfHouseholdCost', e.target.checked)}
            />
            <div>
              <span className="text-sm text-slate-200">I paid more than half the cost of keeping up my home in 2025</span>
              <p className="text-xs text-slate-400 mt-0.5">
                Head of Household requires that you paid more than half of the household maintenance costs (rent, mortgage, utilities, food, etc.).
              </p>
              <a
                href="https://www.irs.gov/publications/p501#en_US_2025_publink1000220775"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Learn more on IRS.gov
              </a>
            </div>
          </label>
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
