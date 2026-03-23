import { useState, useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import { STANDARD_DEDUCTION_2025, ADDITIONAL_STANDARD_DEDUCTION, FilingStatus } from '@telostax/engine';
import CardSelector from '../common/CardSelector';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import WhatsNewCard from '../common/WhatsNewCard';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import { Scissors, ChevronDown, ChevronUp, TrendingDown, Info, ExternalLink } from 'lucide-react';
import { isAge65OrOlder } from '../../utils/dateValidation';

const FILING_STATUS_LABELS: Record<number, string> = {
  1: 'Single',
  2: 'Married Filing Jointly',
  3: 'Married Filing Separately',
  4: 'Head of Household',
  5: 'Qualifying Surviving Spouse',
};

export default function DeductionMethodStep() {
  const { taxReturn, returnId, updateField, calculation } = useTaxReturnStore();
  const [showMore, setShowMore] = useState(false);

  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['deduction_method'];

  const filingStatus = taxReturn.filingStatus || FilingStatus.Single;
  const baseStdAmount = STANDARD_DEDUCTION_2025[filingStatus];

  // Calculate additional standard deduction for age 65+ and/or blindness
  const { additionalAmount, additionalDetails } = useMemo(() => {
    const isMarried = filingStatus === FilingStatus.MarriedFilingJointly || filingStatus === FilingStatus.MarriedFilingSeparately;
    const perQualification = isMarried ? ADDITIONAL_STANDARD_DEDUCTION.MARRIED : ADDITIONAL_STANDARD_DEDUCTION.UNMARRIED;
    let extra = 0;
    const details: string[] = [];

    if (isAge65OrOlder(taxReturn.dateOfBirth, taxReturn.taxYear)) {
      extra += perQualification;
      details.push(`+$${perQualification.toLocaleString()} (age 65+)`);
    }
    if (taxReturn.isLegallyBlind) {
      extra += perQualification;
      details.push(`+$${perQualification.toLocaleString()} (blind)`);
    }
    if (filingStatus === FilingStatus.MarriedFilingJointly) {
      if (isAge65OrOlder(taxReturn.spouseDateOfBirth, taxReturn.taxYear)) {
        extra += perQualification;
        details.push(`+$${perQualification.toLocaleString()} (spouse age 65+)`);
      }
      if (taxReturn.spouseIsLegallyBlind) {
        extra += perQualification;
        details.push(`+$${perQualification.toLocaleString()} (spouse blind)`);
      }
    }
    return { additionalAmount: extra, additionalDetails: details };
  }, [filingStatus, taxReturn.dateOfBirth, taxReturn.spouseDateOfBirth, taxReturn.isLegallyBlind, taxReturn.spouseIsLegallyBlind, taxReturn.taxYear]);

  const stdAmount = baseStdAmount + additionalAmount;

  // Calculate itemized total if available for comparison
  const itemizedTotal = calculation?.scheduleA?.totalItemized || 0;
  const recommendStandard = itemizedTotal <= stdAmount;
  const difference = Math.abs(stdAmount - itemizedTotal);
  const betterAmount = Math.max(stdAmount, itemizedTotal);

  const save = async () => {
    await updateReturn(returnId, { deductionMethod: taxReturn.deductionMethod });
  };

  return (
    <div>
      <StepWarningsBanner stepId="deduction_method" />
      <SectionIntro
        icon={<Scissors className="w-8 h-8" />}
        title="Standard or Itemized?"
        description="Choose the deduction method that gives you the biggest tax break."
      />

      <WhatsNewCard items={[
        { title: 'Increased Standard Deduction', description: 'Now $15,750 for single filers (up from $14,600 in 2024) under the One Big Beautiful Bill Act.' },
        { title: 'Updated Tax Brackets', description: 'All bracket thresholds adjusted for inflation.' },
        { title: 'Higher SS Wage Base', description: 'Social Security wage base increased to $176,100.' },
        { title: 'Standard Mileage Rate', description: 'Business mileage rate is $0.70/mile.' },
        { title: 'SALT Cap Raised to $40,000', description: 'Up from $10,000, with phase-down for high earners.' },
        { title: 'Child Tax Credit Increased', description: 'Now $2,200 per qualifying child (up from $2,000).' },
        { title: 'New Deductions', description: 'Tips (up to $25k), overtime pay, car loan interest, and enhanced senior deduction.' },
      ]} />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Consolidated explainer card */}
      <div className="rounded-lg border p-4 mt-4 bg-telos-blue-600/10 border-telos-blue-600/30">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-telos-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-telos-blue-300">
            <p>
              Choose the method that gives you the larger deduction. Your standard deduction is{' '}
              <strong className="text-white">${stdAmount.toLocaleString()}</strong> ({FILING_STATUS_LABELS[filingStatus]}).
              Itemize if your mortgage interest, state/local taxes, charitable donations, and medical expenses exceed that amount.
            </p>
            {showMore && (
              <div className="mt-3 space-y-3 text-slate-400">
                <div>
                  <p className="text-slate-300 font-medium mb-1">2025 Standard Deduction Amounts</p>
                  <ul className="space-y-0.5 text-xs">
                    <li>Single: $15,750</li>
                    <li>Married Filing Jointly: $31,500</li>
                    <li>Head of Household: $23,625</li>
                    <li>65 or older / blind: additional $1,600 (single) or $1,300 (married) each</li>
                  </ul>
                </div>
                <div>
                  <p className="text-slate-300 font-medium mb-1">When to Itemize</p>
                  <ul className="space-y-0.5 text-xs">
                    <li>Large mortgage interest on your primary home</li>
                    <li>State & local taxes (SALT) — now capped at $40,000 for 2025 (up from $10,000)</li>
                    <li>Significant charitable donations</li>
                    <li>Medical expenses exceeding 7.5% of your AGI</li>
                  </ul>
                </div>
                <p className="text-xs">
                  About 87% of filers take the standard deduction. You're more likely to benefit from itemizing if you have a large mortgage, live in a high-tax state, or make significant charitable contributions.
                </p>
                <a href="https://www.irs.gov/taxtopics/tc501" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  Learn more on IRS.gov
                </a>
              </div>
            )}
            <button
              onClick={() => setShowMore(!showMore)}
              className="mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              {showMore ? 'Show less' : 'Show more'}
            </button>
          </div>
        </div>
      </div>

      {/* Deduction method selector */}
      <div className="mt-4">
        <CardSelector
          options={[
            {
              value: 'standard',
              label: `Standard Deduction - $${stdAmount.toLocaleString()}`,
              description: `The fixed amount based on your filing status. ${recommendStandard ? 'Recommended for you.' : ''}`,
            },
            {
              value: 'itemized',
              label: `Itemize Deductions${itemizedTotal > 0 ? ` - $${itemizedTotal.toLocaleString()}` : ''}`,
              description: 'Medical expenses, mortgage interest, state/local taxes, charitable donations.',
            },
          ]}
          value={taxReturn.deductionMethod}
          onChange={(v) => updateField('deductionMethod', v)}
        />
      </div>

      {/* Side-by-side comparison — only show when itemized deductions have been entered */}
      {itemizedTotal > 0 ? (
        <div className="card mt-4 bg-surface-900">
          <h4 className="text-sm font-medium text-slate-300 mb-3">Side-by-Side Comparison</h4>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-center">
            <div className={`rounded-lg p-3 ${recommendStandard ? 'bg-telos-orange-500/10 border border-telos-orange-500/30' : 'bg-surface-800 border border-slate-700'}`}>
              <div className="text-xs text-slate-400 mb-1">Standard</div>
              <div className={`text-lg font-bold ${recommendStandard ? 'text-telos-orange-400' : 'text-slate-300'}`}>
                ${stdAmount.toLocaleString()}
              </div>
              {recommendStandard && <div className="text-xs text-telos-orange-400 mt-1 font-medium">Recommended</div>}
            </div>
            <div className="text-slate-600">
              <span className="text-xs">vs</span>
            </div>
            <div className={`rounded-lg p-3 ${!recommendStandard ? 'bg-telos-orange-500/10 border border-telos-orange-500/30' : 'bg-surface-800 border border-slate-700'}`}>
              <div className="text-xs text-slate-400 mb-1">Itemized</div>
              <div className={`text-lg font-bold ${!recommendStandard ? 'text-telos-orange-400' : 'text-slate-300'}`}>
                ${itemizedTotal.toLocaleString()}
              </div>
              {!recommendStandard && <div className="text-xs text-telos-orange-400 mt-1 font-medium">Recommended</div>}
            </div>
          </div>

          {/* Dollar savings callout */}
          {difference > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-telos-orange-500/10 rounded-lg px-3 py-2">
              <TrendingDown className="w-4 h-4 text-telos-orange-400 shrink-0" />
              <p className="text-sm text-telos-orange-300">
                {recommendStandard ? 'Standard' : 'Itemizing'} saves you{' '}
                <span className="font-bold">${difference.toLocaleString()}</span> more in deductions.
                {difference > 2000 && <span className="text-telos-orange-400/70"> That could lower your tax by ${Math.round(difference * 0.22).toLocaleString()} or more.</span>}
              </p>
            </div>
          )}
        </div>
      ) : taxReturn.deductionMethod === 'itemized' ? (
        <div className="card mt-4 bg-surface-900">
          <p className="text-sm text-slate-400 text-center py-2">
            Enter your itemized deductions on the next step to see a comparison with the standard deduction of <span className="font-semibold text-slate-300">${stdAmount.toLocaleString()}</span>.
          </p>
        </div>
      ) : null}

      {additionalDetails.length > 0 && (
        <div className="rounded-xl border p-6 mt-4 bg-telos-orange-500/10 border-telos-orange-500/20 text-sm">
          <p className="text-telos-orange-300 font-medium">Your standard deduction includes additional amounts:</p>
          <p className="text-xs text-slate-400 mt-1">
            Base: ${baseStdAmount.toLocaleString()} {additionalDetails.join(' ')} = <span className="font-semibold text-slate-300">${stdAmount.toLocaleString()}</span>
          </p>
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
