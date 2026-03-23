import { useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateForm1040 } from '@telostax/engine';
import type { AMTResult } from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { HELP_CONTENT } from '../../data/helpContent';
import { ShieldAlert, CheckCircle, AlertTriangle, Info, TrendingDown } from 'lucide-react';
import AMTWaterfall from '../charts/AMTWaterfall';

export default function AMTStep() {
  const { taxReturn } = useTaxReturnStore();
  if (!taxReturn) return null;

  const result = useMemo(() => {
    try {
      return calculateForm1040(taxReturn);
    } catch {
      return null;
    }
  }, [taxReturn]);

  const amt = result?.amt;
  const help = HELP_CONTENT['amt_review'];
  const amtIrsUrl = help?.callouts?.[0]?.irsUrl;

  // No calculation yet (insufficient data)
  if (!amt) {
    return (
      <div>
        <SectionIntro
          icon={<ShieldAlert className="w-8 h-8" />}
          title="AMT Review (Form 6251)"
          description="Review whether the Alternative Minimum Tax applies to your return."
        />
        <div className="card mt-6 text-center py-8">
          <Info className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            Enter your income and deduction data first. The AMT calculation
            will appear here automatically.
          </p>
        </div>
        <StepNavigation />
      </div>
    );
  }

  // Collect non-zero adjustment lines for Part I display
  const adjustmentLines = buildAdjustmentLines(amt.adjustments);

  return (
    <div>
      <StepWarningsBanner stepId="amt_review" />

      <SectionIntro
        icon={<ShieldAlert className="w-8 h-8" />}
        title="AMT Review (Form 6251)"
        description="Full Alternative Minimum Tax computation for your return."
      />

      <CalloutCard variant="info" title="About Form 6251" irsUrl={amtIrsUrl}>
        The Alternative Minimum Tax is a parallel tax system that limits certain deductions
        and preferences. When the AMT computation yields a higher tax than the regular method,
        you pay the difference as additional tax on Form 1040 Line 17.
      </CalloutCard>

      {/* Hero Card */}
      {amt.applies ? (
        <div className="rounded-xl border mt-6 text-center py-6 px-6 bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-slate-400 text-sm mb-1">Alternative Minimum Tax Applies</p>
          <p className="text-4xl font-bold text-amber-400">
            ${amt.amtAmount.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">Form 6251, Line 11</p>
        </div>
      ) : (
        <div className="rounded-xl border mt-6 text-center py-6 px-6 bg-emerald-500/10 border-emerald-500/30">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-slate-400 text-sm mb-1">No Alternative Minimum Tax</p>
          <p className="text-2xl font-bold text-emerald-400">$0</p>
          <p className="text-xs text-slate-500 mt-1">
            Your regular tax exceeds the tentative minimum tax
          </p>
        </div>
      )}

      {/* AMT waterfall chart */}
      <AMTWaterfall
        taxableIncome={amt.line1_taxableIncome}
        adjustmentsTotal={amt.amti - amt.line1_taxableIncome}
        exemption={amt.exemption}
        tentativeMinTax={amt.tentativeMinimumTax}
        regularTax={amt.regularTax}
        amtAmount={amt.amtAmount}
        applies={amt.applies}
      />

      {/* Part I: AMTI Adjustments */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-1 text-sm uppercase tracking-wide">
          Part I — Alternative Minimum Taxable Income
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Items added to or subtracted from regular taxable income for AMT purposes.
        </p>
        <div className="space-y-0 text-sm">
          <Row label="Line 1: Taxable income" value={amt.line1_taxableIncome} bold />

          {adjustmentLines.length > 0 && (
            <>
              <div className="border-t border-slate-700/50 my-2" />
              <p className="text-xs text-slate-500 py-1">Adjustments (Lines 2a–3):</p>
              {adjustmentLines.map((line) => (
                <Row
                  key={line.lineRef}
                  label={`${line.lineRef}: ${line.label}`}
                  value={line.value}
                  plus={line.value > 0}
                />
              ))}
            </>
          )}

          <div className="border-t border-slate-700/50 my-2" />
          <Row
            label="Line 4: Alternative Minimum Taxable Income (AMTI)"
            value={amt.amti}
            bold
          />
        </div>
      </div>

      {/* Part II: AMT Computation */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-1 text-sm uppercase tracking-wide">
          Part II — AMT Computation
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Applying exemption, AMT rates, and comparing to regular tax.
        </p>
        <div className="space-y-0 text-sm">
          <Row label="Line 4: AMTI" value={amt.amti} />
          <Row label="Line 5: AMT exemption" value={-amt.exemption} />
          <Row label="Line 6: AMT base" value={amt.amtBase} bold />

          <div className="border-t border-slate-700/50 my-2" />

          <Row
            label={`Line 7: Tentative minimum tax${amt.usedPartIII ? ' (Part III)' : ' (26%/28%)'}`}
            value={amt.tentativeMinimumTax}
          />

          {amt.amtForeignTaxCredit > 0 && (
            <Row label="Line 8: AMT foreign tax credit" value={-amt.amtForeignTaxCredit} />
          )}

          <Row label="Line 9: TMT after foreign tax credit" value={amt.tmtAfterFTC} />
          <Row label="Line 10: Regular income tax" value={amt.regularTax} />

          <div className="border-t border-slate-700/50 my-2" />

          <div className="flex items-center justify-between py-1">
            <span className={`font-semibold ${amt.applies ? 'text-amber-400' : 'text-emerald-400'}`}>
              Line 11: AMT amount
            </span>
            <span className={`font-bold font-mono text-xs ${amt.applies ? 'text-amber-400' : 'text-emerald-400'}`}>
              ${amt.amtAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Part III: Capital Gains Rates (conditional) */}
      {amt.usedPartIII && amt.partIII && (
        <div className="card mt-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-telos-blue-400" />
            <h3 className="font-medium text-slate-200 text-sm uppercase tracking-wide">
              Part III — Capital Gains Rates for AMT
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Preferential rates applied to your capital gains/qualified dividends, reducing
            the tentative minimum tax below the flat 26%/28% rate.
          </p>
          <div className="space-y-0 text-sm">
            <Row label="AMT base" value={amt.partIII.amtBase} />
            <Row label="Adjusted net capital gain" value={amt.partIII.adjustedNetCapitalGain} />
            <Row label="Ordinary AMT income" value={amt.partIII.ordinaryAMTIncome} />

            <div className="border-t border-slate-700/50 my-2" />

            <Row label="Tax on ordinary income (26%/28%)" value={amt.partIII.ordinaryTax} />
            <Row label="Tax on capital gains (0%/15%/20%)" value={amt.partIII.capitalGainsTax} />
            {amt.partIII.section1250Tax > 0 && (
              <Row label="Tax on unrecaptured §1250 gain (25%)" value={amt.partIII.section1250Tax} />
            )}

            <div className="border-t border-slate-700/50 my-2" />

            <Row label="Special computation tax" value={amt.partIII.specialComputationTax} />
            <Row label="Flat-rate tax (26%/28% on full base)" value={amt.partIII.flatRateTax} />

            <div className="border-t border-slate-700/50 my-2" />

            <div className="flex items-center justify-between py-1">
              <span className="font-semibold text-telos-blue-400">
                TMT (lesser of special vs flat)
              </span>
              <span className="font-bold font-mono text-xs text-telos-blue-400">
                ${amt.partIII.tentativeMinimumTax.toLocaleString()}
              </span>
            </div>

            {amt.partIII.specialComputationTax < amt.partIII.flatRateTax && (
              <p className="text-xs text-emerald-400 mt-1">
                Part III saved ${(amt.partIII.flatRateTax - amt.partIII.specialComputationTax).toLocaleString()} vs flat rates
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tips Card */}
      {amt.applies && (
        <div className="card mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-5 h-5 text-telos-blue-400" />
            <h3 className="font-medium text-slate-200 text-sm">Ways to Potentially Reduce AMT</h3>
          </div>
          <ul className="text-sm text-slate-400 space-y-2 list-disc pl-5">
            {amt.adjustments.saltAddBack > 0 && (
              <li>
                <span className="text-slate-300">SALT deduction:</span> ${amt.adjustments.saltAddBack.toLocaleString()} of your
                state/local tax deduction is added back for AMT. Consider whether itemizing still benefits you.
              </li>
            )}
            {amt.adjustments.isoExerciseSpread > 0 && (
              <li>
                <span className="text-slate-300">ISO exercise:</span> ${amt.adjustments.isoExerciseSpread.toLocaleString()} spread from
                incentive stock options. Timing ISO exercises across tax years can help manage AMT exposure.
              </li>
            )}
            <li>
              <span className="text-slate-300">AMT credit:</span> If your AMT is caused by timing
              differences (like ISO exercises), you may be able to claim an AMT credit in future years
              via Form 8801.
            </li>
          </ul>
        </div>
      )}

      <StepNavigation />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

interface AdjustmentLine {
  lineRef: string;
  label: string;
  value: number;
}

function buildAdjustmentLines(adj: AMTResult['adjustments']): AdjustmentLine[] {
  const lines: AdjustmentLine[] = [];
  const add = (lineRef: string, label: string, value: number) => {
    if (value !== 0) lines.push({ lineRef, label, value });
  };

  add('Line 2a', 'Standard deduction add-back', adj.standardDeductionAddBack);
  add('Line 2b', 'Tax refund adjustment', adj.taxRefundAdjustment);
  add('Line 2c', 'Investment interest difference', adj.investmentInterestAdjustment);
  add('Line 2d', 'Depletion', adj.depletion);
  add('Line 2e', 'State & local tax deduction', adj.saltAddBack);
  add('Line 2f', 'Alt. tax NOL deduction', adj.atnold);
  add('Line 2g', 'Private activity bond interest', adj.privateActivityBondInterest);
  add('Line 2h', 'QSBS exclusion (§1202)', adj.qsbsExclusion);
  add('Line 2i', 'ISO exercise spread', adj.isoExerciseSpread);
  add('Line 2k', 'Disposition of property', adj.dispositionOfProperty);
  add('Line 2l', 'Depreciation adjustment', adj.depreciationAdjustment);
  add('Line 2m', 'Passive activity loss', adj.passiveActivityLoss);
  add('Line 2n', 'Loss limitations', adj.lossLimitations);
  add('Line 2o', 'Circulation costs', adj.circulationCosts);
  add('Line 2p', 'Long-term contracts', adj.longTermContracts);
  add('Line 2q', 'Mining costs', adj.miningCosts);
  add('Line 2r', 'Research & experimental costs', adj.researchCosts);
  add('Line 2t', 'Intangible drilling costs', adj.intangibleDrillingCosts);
  add('Line 3', 'Other AMT adjustments', adj.otherAdjustments);

  return lines;
}

function Row({
  label,
  value,
  bold,
  plus,
}: {
  label: string;
  value: number;
  bold?: boolean;
  plus?: boolean;
}) {
  const formatted = value < 0
    ? `-$${Math.abs(value).toLocaleString()}`
    : plus
      ? `+$${value.toLocaleString()}`
      : `$${value.toLocaleString()}`;

  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={bold ? 'text-slate-200 font-medium' : 'text-slate-400'}>{label}</span>
      <span className={`font-mono text-xs ${bold ? 'text-white font-medium' : 'text-slate-300'}`}>
        {formatted}
      </span>
    </div>
  );
}
