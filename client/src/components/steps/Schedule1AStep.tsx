import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Banknote, ExternalLink } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';
import WhatsNewCard from '../common/WhatsNewCard';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';

export default function Schedule1AStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const s1a = taxReturn.schedule1A || {};
  const help = HELP_CONTENT['schedule1a'];

  const update = (field: string, value: number | boolean | string) => {
    updateField('schedule1A', { ...s1a, [field]: value });
  };

  const save = async () => {
    await updateReturn(returnId, { schedule1A: taxReturn.schedule1A, form4137: taxReturn.form4137 });
  };

  return (
    <div>
      <StepWarningsBanner stepId="schedule1a" />

      <SectionIntro
        icon={<Banknote className="w-8 h-8" />}
        title="No Tax on Tips, Overtime & More"
        description="The One Big Beautiful Bill Act created new above-the-line deductions for 2025. Enter amounts that apply to you."
      />

      <WhatsNewCard items={[
        { title: 'Brand New for 2025', description: 'Schedule 1-A is entirely new under the One Big Beautiful Bill Act (OBBBA §§101-104). These above-the-line deductions did not exist before 2025.' },
        { title: 'No Tax on Tips: Up to $25,000', description: 'Qualified tips in IRS-recognized tipped occupations can be deducted from taxable income. Self-employed tips also qualify if not an SSTB.' },
        { title: 'No Tax on Overtime: Up to $25,000', description: 'The premium portion of overtime pay (the extra "half" in time-and-a-half) is deductible for FLSA non-exempt employees. $12,500 if MFS.' },
        { title: 'Car Loan Interest: Up to $10,000', description: 'Interest on auto loans for vehicles manufactured or assembled in the U.S. is deductible. $5,000 if MFS.' },
        { title: 'Enhanced Senior Deduction: $4,000', description: 'An additional above-the-line deduction for taxpayers aged 65+ with income under $75,000 ($150,000 MFJ). $2,000 if MFS.' },
      ]} />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Tips */}
      <div className="card mt-6">
        <h3 className="font-medium text-slate-200 mb-1">No Tax on Tips</h3>
        <p className="text-sm text-slate-400 mb-4">
          Deduct up to $25,000 of qualified tips from your taxable income. Must be in an IRS-recognized tipped occupation.
        </p>
        <FormField label="Qualified Tips" optional helpText="From W-2 Box 7 or Form 4137" tooltip={help?.fields['Qualified Tips']?.tooltip} irsRef={help?.fields['Qualified Tips']?.irsRef}>
          <CurrencyInput value={s1a.qualifiedTips} onChange={(v) => update('qualifiedTips', v)} />
        </FormField>
        <div className="space-y-2 mt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="accent-telos-orange-400" checked={!!s1a.isTippedOccupation} onChange={(e) => update('isTippedOccupation', e.target.checked)} />
            <span className="text-sm text-slate-300">I work in an IRS-listed tipped occupation</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="accent-telos-orange-400" checked={!!s1a.isSelfEmployedTipped} onChange={(e) => update('isSelfEmployedTipped', e.target.checked)} />
            <span className="text-sm text-slate-300">I am self-employed in a tipped occupation (non-SSTB)</span>
          </label>
          <a
            href="https://www.irs.gov/forms-pubs/occupations-that-customarily-and-regularly-received-tips-on-or-before-december-31-2024"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors ml-6"
          >
            <ExternalLink className="w-3 h-3" />
            See IRS-listed tipped occupations
          </a>
        </div>
      </div>

      {/* Overtime */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-1">No Tax on Overtime</h3>
        <p className="text-sm text-slate-400 mb-4">
          Deduct the premium portion of overtime pay (the extra "half" in time-and-a-half). Must be FLSA non-exempt.
        </p>
        <FormField label="Qualified Overtime Premium Pay" optional helpText="The premium portion only — not the base rate" tooltip={help?.fields['Qualified Overtime Premium Pay']?.tooltip} irsRef={help?.fields['Qualified Overtime Premium Pay']?.irsRef}>
          <CurrencyInput value={s1a.qualifiedOvertimePay} onChange={(v) => update('qualifiedOvertimePay', v)} />
        </FormField>
        <label className="flex items-center gap-3 mt-2 cursor-pointer">
          <input type="checkbox" className="accent-telos-orange-400" checked={!!s1a.isFLSANonExempt} onChange={(e) => update('isFLSANonExempt', e.target.checked)} />
          <span className="text-sm text-slate-300">I am FLSA non-exempt (overtime-eligible employee)</span>
        </label>
      </div>

      {/* Car Loan Interest */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-1">Auto Loan Interest Deduction</h3>
        <p className="text-sm text-slate-400 mb-4">
          Deduct up to $10,000 in interest on a qualified motor vehicle loan. Vehicle must be new and assembled in the U.S.
        </p>
        <FormField label="Car Loan Interest Paid" optional tooltip={help?.fields['Car Loan Interest Paid']?.tooltip} irsRef={help?.fields['Car Loan Interest Paid']?.irsRef}>
          <CurrencyInput value={s1a.carLoanInterestPaid} onChange={(v) => update('carLoanInterestPaid', v)} />
        </FormField>
        {(s1a.carLoanInterestPaid || 0) > 0 && (
          <>
            <FormField label="Vehicle VIN" helpText="17-character VIN from your title or registration" tooltip={help?.fields['Vehicle VIN']?.tooltip} irsRef={help?.fields['Vehicle VIN']?.irsRef}
              warning={s1a.vehicleVIN && s1a.vehicleVIN.length > 0 && s1a.vehicleVIN.length < 17 ? 'VIN must be exactly 17 characters.' : (s1a.vehicleVIN && !/^[A-HJ-NPR-Z0-9]{17}$/.test(s1a.vehicleVIN) && s1a.vehicleVIN.length === 17 ? 'VIN contains invalid characters (I, O, Q are not used in VINs).' : undefined)}>
              <input className="input-field" value={s1a.vehicleVIN || ''} onChange={(e) => update('vehicleVIN', e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17))} maxLength={17} placeholder="e.g. 1HGBH41JXMN109186" />
            </FormField>
            <div className="space-y-2 mt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="accent-telos-orange-400" checked={!!s1a.vehicleAssembledInUS} onChange={(e) => update('vehicleAssembledInUS', e.target.checked)} />
                <span className="text-sm text-slate-300">Vehicle was assembled in the United States</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="accent-telos-orange-400" checked={!!s1a.isNewVehicle} onChange={(e) => update('isNewVehicle', e.target.checked)} />
                <span className="text-sm text-slate-300">This is a new vehicle (original use starts with me)</span>
              </label>
            </div>
          </>
        )}
      </div>

      {/* Form 4137 — Unreported Tips */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-1">Unreported Tip Income (Form 4137)</h3>
        <p className="text-sm text-slate-400 mb-4">
          If you received tips that you did not report to your employer, enter the total here. These tips are subject to Social Security and Medicare tax.
        </p>
        <FormField label="Unreported Tips" optional helpText="Tips not reported to your employer on Form 4070" tooltip={help?.fields['Unreported Tips']?.tooltip} irsRef={help?.fields['Unreported Tips']?.irsRef}>
          <CurrencyInput
            value={taxReturn.form4137?.unreportedTips}
            onChange={(v) => updateField('form4137', { unreportedTips: v })}
          />
        </FormField>
        {(taxReturn.form4137?.unreportedTips || 0) > 0 && (
          <div className="mt-2 p-3 rounded-lg bg-slate-500/10 border border-slate-600 text-xs text-slate-400">
            Estimated additional tax: ${((taxReturn.form4137?.unreportedTips || 0) * 0.0765).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (SS 6.2% + Medicare 1.45%)
          </div>
        )}
        <a
          href="https://www.irs.gov/forms-pubs/about-form-4137"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Learn more on IRS.gov
        </a>
      </div>

      <a
        href="https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions-individuals-and-workers"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation onContinue={save} />
    </div>
  );
}
