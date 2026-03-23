import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import { Dices, ExternalLink } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';

export default function GamblingLossesStep() {
  const { taxReturn, returnId, updateField, calculation } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const totalWinnings = calculation?.form1040?.totalGamblingIncome || 0;

  const save = async () => {
    await updateReturn(returnId, { gamblingLosses: taxReturn.gamblingLosses });
  };

  return (
    <div>
      <StepWarningsBanner stepId="gambling_losses_ded" />

      <SectionIntro
        icon={<Dices className="w-8 h-8" />}
        title="Gambling Losses"
        description="Deduct gambling losses up to the amount of your gambling winnings."
      />

      <CalloutCard variant="info" title="Gambling Loss Limitation" irsUrl="https://www.irs.gov/taxtopics/tc419">
        Gambling losses are deductible only up to the amount of your gambling winnings. You must report all winnings as income. You cannot use losses to create a net deduction — only to offset winnings.
      </CalloutCard>

      <div className="card mt-6">
        <FormField
          label="Total Gambling Losses"
          tooltip="Your total gambling losses for the year, including losses from casinos, lotteries, horse racing, and online gambling. You can only deduct losses up to the amount of your gambling winnings — you cannot use gambling losses to create a net deduction. Keep records such as receipts, tickets, statements, or a gambling diary."
          irsRef="Schedule A, Line 16 (Other Deductions)"
          helpText="Cannot exceed total gambling winnings reported on your return"
        >
          <CurrencyInput
            value={taxReturn.gamblingLosses || 0}
            onChange={(v) => updateField('gamblingLosses', v)}
          />
        </FormField>

        {totalWinnings > 0 && (
          <p className="text-xs text-slate-400 mt-2">
            Your reported gambling winnings: ${totalWinnings.toLocaleString()}
          </p>
        )}

        {(taxReturn.gamblingLosses || 0) > totalWinnings && totalWinnings > 0 && (
          <p className="text-xs text-amber-400 mt-1">
            Losses (${(taxReturn.gamblingLosses || 0).toLocaleString()}) exceed winnings (${totalWinnings.toLocaleString()}) — only ${totalWinnings.toLocaleString()} will be deductible.
          </p>
        )}

        <a href="https://www.irs.gov/taxtopics/tc419" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
