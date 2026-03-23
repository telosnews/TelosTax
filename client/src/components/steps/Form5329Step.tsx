import { useEffect, useRef } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { AlertTriangle, ExternalLink, Lightbulb, Info, ArrowRight } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import { HSA, IRA } from '@telostax/engine';

export default function Form5329Step() {
  const { taxReturn, returnId, updateField, goToStep } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['form5329'];
  const ec = taxReturn.excessContributions || { iraExcessContribution: 0, hsaExcessContribution: 0, esaExcessContribution: 0 };

  // Auto-calculate excess from Adjustments data on first visit
  const didPrefill = useRef(false);
  useEffect(() => {
    if (didPrefill.current) return;
    if ((ec.iraExcessContribution || 0) > 0 || (ec.hsaExcessContribution || 0) > 0) return;
    didPrefill.current = true;

    const hsaLimit = taxReturn.hsaContribution?.coverageType === 'family' ? HSA.FAMILY_LIMIT : HSA.INDIVIDUAL_LIMIT;
    const hsaCatchUp = (taxReturn.hsaContribution?.catchUpContributions || 0) > 0 ? HSA.CATCH_UP_55_PLUS : 0;
    const hsaMax = hsaLimit + hsaCatchUp;
    const hsaExcess = Math.max(0, (taxReturn.hsaDeduction || 0) - hsaMax);

    const age = taxReturn.dateOfBirth ? Math.floor((Date.now() - new Date(taxReturn.dateOfBirth).getTime()) / 31557600000) : 0;
    const iraLimit = IRA.MAX_CONTRIBUTION + (age >= 50 ? IRA.CATCH_UP_50_PLUS : 0);
    const iraExcess = Math.max(0, (taxReturn.iraContribution || 0) - iraLimit);

    if (hsaExcess > 0 || iraExcess > 0) {
      updateField('excessContributions', {
        ...ec,
        hsaExcessContribution: hsaExcess,
        iraExcessContribution: iraExcess,
      });
    }
  }, []);

  const update = (field: string, value: number) => {
    updateField('excessContributions', { ...ec, [field]: value });
  };

  const emergencyDist = taxReturn.emergencyDistributions || { totalEmergencyDistributions: 0 };

  const save = async () => {
    await updateReturn(returnId, {
      excessContributions: taxReturn.excessContributions,
      emergencyDistributions: taxReturn.emergencyDistributions,
      hsaExcessWithdrawal: taxReturn.hsaExcessWithdrawal,
      iraExcessWithdrawal: taxReturn.iraExcessWithdrawal,
    });
  };

  // ── HSA corrective withdrawal state (read-only summary — full advisory on HSA step) ──
  const rawHsaExcess = ec.hsaExcessContribution || 0;
  const hsaW = taxReturn.hsaExcessWithdrawal;
  const hsaWChoice = hsaW?.choice || 'none';

  let effectiveHsaExcess = rawHsaExcess;
  if (hsaW && rawHsaExcess > 0) {
    if (hsaWChoice === 'full') effectiveHsaExcess = 0;
    else if (hsaWChoice === 'partial') {
      effectiveHsaExcess = Math.max(0, rawHsaExcess - (hsaW.withdrawalAmount || 0));
    }
  }

  // ── IRA corrective withdrawal state (read-only summary — full advisory on IRA step) ──
  const rawIraExcess = ec.iraExcessContribution || 0;
  const iraW = taxReturn.iraExcessWithdrawal;
  const iraWChoice = iraW?.choice || 'none';

  let effectiveIraExcess = rawIraExcess;
  if (iraW && rawIraExcess > 0) {
    if (iraWChoice === 'full') effectiveIraExcess = 0;
    else if (iraWChoice === 'partial') {
      effectiveIraExcess = Math.max(0, rawIraExcess - (iraW.withdrawalAmount || 0));
    }
  }

  const iraPenalty = Math.round(effectiveIraExcess * 0.06);
  const hsaPenalty = Math.round(effectiveHsaExcess * 0.06);
  const esaPenalty = Math.round((ec.esaExcessContribution || 0) * 0.06);
  const totalPenalty = iraPenalty + hsaPenalty + esaPenalty;

  return (
    <div>
      <StepWarningsBanner stepId="form5329" />

      <SectionIntro
        icon={<AlertTriangle className="w-8 h-8" />}
        title="Excess Contributions (Form 5329)"
        description="If you contributed more than the annual limit to an IRA, HSA, or Coverdell ESA, a 6% excise tax applies to the excess amount each year it remains."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="card mt-6">
        <FormField label="IRA Excess Contribution" optional helpText="Amount over the annual limit ($7,000 / $8,000 if 50+)" tooltip={help?.fields['IRA Excess Contribution']?.tooltip} irsRef={help?.fields['IRA Excess Contribution']?.irsRef}>
          <CurrencyInput value={ec.iraExcessContribution || 0} onChange={(v) => update('iraExcessContribution', v)} />
        </FormField>
        <FormField label="HSA Excess Contribution" optional helpText="Amount over the annual limit ($4,300 self / $8,550 family)" tooltip={help?.fields['HSA Excess Contribution']?.tooltip} irsRef={help?.fields['HSA Excess Contribution']?.irsRef}>
          <CurrencyInput value={ec.hsaExcessContribution || 0} onChange={(v) => update('hsaExcessContribution', v)} />
        </FormField>
        <FormField label="Coverdell ESA Excess Contribution" optional helpText="Amount over the $2,000 annual limit per beneficiary" tooltip={help?.fields['Coverdell ESA Excess Contribution']?.tooltip} irsRef={help?.fields['Coverdell ESA Excess Contribution']?.irsRef}>
          <CurrencyInput value={ec.esaExcessContribution || 0} onChange={(v) => update('esaExcessContribution', v)} />
        </FormField>
        <a href="https://www.irs.gov/forms-pubs/about-form-5329" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      {/* ── HSA Excess Summary (full advisory lives on HSA step) ── */}
      {rawHsaExcess > 0 && (
        <div className={`card mt-4 ${
          hsaWChoice === 'full' ? 'border-emerald-500/30 bg-emerald-500/5'
          : hsaWChoice === 'partial' && effectiveHsaExcess > 0 ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-red-500/30 bg-red-500/5'
        }`}>
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-slate-200">
                HSA Excess: ${rawHsaExcess.toLocaleString()}
              </h4>
              {hsaWChoice === 'full' && (
                <p className="text-xs text-emerald-400 mt-1">
                  Withdrawing the full excess before your filing deadline &mdash; no 6% penalty.
                  {(hsaW?.earningsOnExcess || 0) > 0 && (
                    <span className="text-slate-400"> (${(hsaW?.earningsOnExcess || 0).toLocaleString()} in earnings added to Other income.)</span>
                  )}
                </p>
              )}
              {hsaWChoice === 'partial' && (
                <p className="text-xs text-amber-400 mt-1">
                  Withdrawing ${(hsaW?.withdrawalAmount || 0).toLocaleString()} of the excess &mdash; 6% penalty on remaining ${effectiveHsaExcess.toLocaleString()}: <strong>${hsaPenalty.toLocaleString()}</strong>
                  {(hsaW?.earningsOnExcess || 0) > 0 && (
                    <span className="text-slate-400"> (${(hsaW?.earningsOnExcess || 0).toLocaleString()} in earnings added to Other income.)</span>
                  )}
                </p>
              )}
              {hsaWChoice === 'none' && (
                <p className="text-xs text-red-400 mt-1">
                  6% excise tax: <strong>${hsaPenalty.toLocaleString()}</strong>/year until withdrawn or absorbed.
                </p>
              )}
              <button
                type="button"
                onClick={() => goToStep('hsa_contributions')}
                className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
              >
                Change on HSA Contributions step <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IRA Excess Summary (full advisory lives on IRA Contributions step) ── */}
      {rawIraExcess > 0 && (
        <div className={`card mt-4 ${
          iraWChoice === 'full' ? 'border-emerald-500/30 bg-emerald-500/5'
          : iraWChoice === 'partial' && effectiveIraExcess > 0 ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-red-500/30 bg-red-500/5'
        }`}>
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-slate-200">
                IRA Excess: ${rawIraExcess.toLocaleString()}
              </h4>
              {iraWChoice === 'full' && (
                <p className="text-xs text-emerald-400 mt-1">
                  Withdrawing the full excess before your filing deadline &mdash; no 6% penalty.
                  {(iraW?.earningsOnExcess || 0) > 0 && (
                    <span className="text-slate-400"> (${(iraW?.earningsOnExcess || 0).toLocaleString()} in earnings added to Other income.)</span>
                  )}
                </p>
              )}
              {iraWChoice === 'partial' && (
                <p className="text-xs text-amber-400 mt-1">
                  Withdrawing ${(iraW?.withdrawalAmount || 0).toLocaleString()} of the excess &mdash; 6% penalty on remaining ${effectiveIraExcess.toLocaleString()}: <strong>${iraPenalty.toLocaleString()}</strong>
                  {(iraW?.earningsOnExcess || 0) > 0 && (
                    <span className="text-slate-400"> (${(iraW?.earningsOnExcess || 0).toLocaleString()} in earnings added to Other income.)</span>
                  )}
                </p>
              )}
              {iraWChoice === 'none' && (
                <p className="text-xs text-red-400 mt-1">
                  6% excise tax: <strong>${iraPenalty.toLocaleString()}</strong>/year until withdrawn or absorbed.
                </p>
              )}
              <button
                type="button"
                onClick={() => goToStep('ira_contribution_ded')}
                className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
              >
                Change on IRA Contributions step <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECURE 2.0 Emergency Distribution Exception */}
      <div className="card mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-medium text-slate-200">Early Distribution Exception (SECURE 2.0)</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          If you took an early withdrawal for an emergency personal expense, up to $1,000 is exempt from the 10% penalty under IRC §72(t)(2)(I).
        </p>
        <FormField label="Emergency Distribution Amount" optional helpText="Amount withdrawn for emergency personal expenses (max $1,000/year exempt)" irsRef="IRC §72(t)(2)(I); SECURE 2.0 Act §314">
          <CurrencyInput
            value={emergencyDist.totalEmergencyDistributions || 0}
            onChange={(v) => updateField('emergencyDistributions', { totalEmergencyDistributions: v })}
          />
        </FormField>
        {(emergencyDist.totalEmergencyDistributions || 0) > 1000 && (
          <p className="text-xs text-amber-400 mt-1">Only the first $1,000 is exempt from the 10% penalty.</p>
        )}
      </div>

      {totalPenalty > 0 && (
        <div className="rounded-xl border p-6 mt-4 bg-red-500/10 border-red-500/30 text-center">
          <p className="text-sm text-slate-400">6% Excise Tax Penalty</p>
          <p className="text-2xl font-bold text-red-400">${totalPenalty.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">
            {[
              iraPenalty > 0 ? `IRA: $${iraPenalty.toLocaleString()}` : '',
              hsaPenalty > 0 ? `HSA: $${hsaPenalty.toLocaleString()}` : '',
              esaPenalty > 0 ? `ESA: $${esaPenalty.toLocaleString()}` : '',
            ].filter(Boolean).join(' + ')}
            {' — withdraw the excess before your filing deadline to avoid this.'}
          </p>
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
