import { useState, useEffect, useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateForm1040 } from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import FormField from '../common/FormField';
import CalloutCard from '../common/CalloutCard';
import CurrencyInput from '../common/CurrencyInput';
import {
  Banknote, Building2, CreditCard, CheckCircle2, ExternalLink, ArrowRight,
} from 'lucide-react';

// ── ABA Routing Number Checksum ─────────────────────────────────
function isValidRoutingNumber(value: string): boolean {
  if (!/^\d{9}$/.test(value)) return false;
  const d = value.split('').map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}

function isValidAccountNumber(value: string): boolean {
  return /^\d{4,17}$/.test(value);
}

export default function RefundPaymentStep() {
  const { taxReturn, updateField } = useTaxReturnStore();

  // Compute refund/owed from the calculation
  const calc = useMemo(() => {
    if (!taxReturn) return null;
    try { return calculateForm1040(taxReturn); } catch { return null; }
  }, [taxReturn]);

  const refundAmount = calc?.form1040.refundAmount || 0;
  const amountOwed = calc?.form1040.amountOwed || 0;

  // Apply refund to next year
  const [applyToNextYear, setApplyToNextYear] = useState<boolean>(
    (taxReturn?.refundAppliedToNextYear || 0) > 0,
  );
  const [applyAmount, setApplyAmount] = useState<number>(
    taxReturn?.refundAppliedToNextYear || 0,
  );

  useEffect(() => {
    if (!applyToNextYear || refundAmount <= 0) {
      if (taxReturn?.refundAppliedToNextYear) {
        updateField('refundAppliedToNextYear', undefined);
      }
      return;
    }
    const capped = Math.min(applyAmount, refundAmount);
    if (capped > 0) {
      updateField('refundAppliedToNextYear', capped);
    }
  }, [applyToNextYear, applyAmount, refundAmount]);

  // Local state for form fields
  const [wantDirectDeposit, setWantDirectDeposit] = useState<boolean>(
    !!taxReturn?.directDeposit,
  );
  const [routingNumber, setRoutingNumber] = useState(
    taxReturn?.directDeposit?.routingNumber || '',
  );
  const [accountNumber, setAccountNumber] = useState(
    taxReturn?.directDeposit?.accountNumber || '',
  );
  const [accountType, setAccountType] = useState<'checking' | 'savings'>(
    taxReturn?.directDeposit?.accountType || 'checking',
  );
  const [touched, setTouched] = useState({ routing: false, account: false });

  // Sync to store when fields change
  useEffect(() => {
    if (!wantDirectDeposit || refundAmount <= 0) {
      // Clear direct deposit when user opts out or no refund
      if (taxReturn?.directDeposit) {
        updateField('directDeposit', undefined);
      }
      return;
    }
    if (isValidRoutingNumber(routingNumber) && isValidAccountNumber(accountNumber)) {
      updateField('directDeposit', { routingNumber, accountNumber, accountType });
    }
  }, [wantDirectDeposit, routingNumber, accountNumber, accountType, refundAmount]);

  if (!taxReturn) return null;

  const routingError = touched.routing && routingNumber.length > 0 && !isValidRoutingNumber(routingNumber)
    ? routingNumber.length !== 9
      ? 'Routing number must be exactly 9 digits'
      : 'Invalid routing number (ABA checksum failed)'
    : undefined;

  const accountError = touched.account && accountNumber.length > 0 && !isValidAccountNumber(accountNumber)
    ? 'Account number must be 4-17 digits'
    : undefined;

  const formattedRefund = refundAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const formattedOwed = amountOwed.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // ── Refund Mode ───────────────────────────────────────────────
  if (refundAmount > 0) {
    return (
      <div className="space-y-6">
        <SectionIntro
          title="Refund & Payment"
          description="You're getting a refund! Choose how you'd like to receive it."
          icon={<Banknote className="w-8 h-8" />}
        />

        {/* Refund amount card */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
          <p className="text-sm text-emerald-300 mb-1">Your Federal Refund</p>
          <p className="text-3xl font-bold text-emerald-400">{formattedRefund}</p>
        </div>

        {/* Delivery choice */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-300">How would you like to receive your refund?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setWantDirectDeposit(true)}
              className={`rounded-lg border p-4 text-left transition-all ${
                wantDirectDeposit
                  ? 'border-telos-blue-500 bg-telos-blue-600/10 ring-1 ring-telos-blue-500/50'
                  : 'border-slate-700 bg-surface-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-telos-blue-400" />
                <span className="text-sm font-medium text-white">Direct Deposit</span>
              </div>
              <p className="text-xs text-slate-400">Fastest — typically 21 days</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setWantDirectDeposit(false);
                if (taxReturn.directDeposit) {
                  updateField('directDeposit', undefined);
                }
              }}
              className={`rounded-lg border p-4 text-left transition-all ${
                !wantDirectDeposit
                  ? 'border-telos-blue-500 bg-telos-blue-600/10 ring-1 ring-telos-blue-500/50'
                  : 'border-slate-700 bg-surface-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-white">Paper Check</span>
              </div>
              <p className="text-xs text-slate-400">Mailed to your address — 6-8 weeks</p>
            </button>
          </div>
        </div>

        {/* Direct deposit fields */}
        {wantDirectDeposit && (
          <div className="rounded-lg border border-slate-700 bg-surface-800 p-5 space-y-4">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-telos-blue-400" />
              Bank Account Information
            </h3>

            <FormField label="Routing Number" error={routingError} irsRef="Form 1040, Line 35b">
              <input
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, ''))}
                onBlur={() => setTouched((t) => ({ ...t, routing: true }))}
                placeholder="9 digits"
                className="input"
              />
            </FormField>

            <FormField label="Account Number" error={accountError} irsRef="Form 1040, Line 35c">
              <input
                type="text"
                inputMode="numeric"
                maxLength={17}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                onBlur={() => setTouched((t) => ({ ...t, account: true }))}
                placeholder="4-17 digits"
                className="input"
              />
            </FormField>

            <FormField label="Account Type" irsRef="Form 1040, Line 35d">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAccountType('checking')}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                    accountType === 'checking'
                      ? 'border-telos-blue-500 bg-telos-blue-600/10 text-telos-blue-300 ring-1 ring-telos-blue-500/50'
                      : 'border-slate-700 bg-surface-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  Checking
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('savings')}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                    accountType === 'savings'
                      ? 'border-telos-blue-500 bg-telos-blue-600/10 text-telos-blue-300 ring-1 ring-telos-blue-500/50'
                      : 'border-slate-700 bg-surface-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  Savings
                </button>
              </div>
            </FormField>

            {isValidRoutingNumber(routingNumber) && isValidAccountNumber(accountNumber) && (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Direct deposit info saved — Lines 35b-d will appear on your Form 1040
              </div>
            )}
          </div>
        )}

        {/* Apply refund to next year's estimated tax */}
        <div className="rounded-lg border border-slate-700 bg-surface-800 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-telos-blue-400" />
            <p className="text-sm font-medium text-white">Apply to Next Year's Estimated Tax</p>
          </div>
          <p className="text-xs text-slate-400">
            You can apply some or all of your refund to your 2026 estimated tax instead of receiving it back.
            This is reported on Form 1040, Line 36.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setApplyToNextYear(false); setApplyAmount(0); }}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                !applyToNextYear
                  ? 'border-telos-blue-500 bg-telos-blue-600/10 text-telos-blue-300 ring-1 ring-telos-blue-500/50'
                  : 'border-slate-700 bg-surface-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              Receive full refund
            </button>
            <button
              type="button"
              onClick={() => { setApplyToNextYear(true); setApplyAmount(refundAmount); }}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                applyToNextYear
                  ? 'border-telos-blue-500 bg-telos-blue-600/10 text-telos-blue-300 ring-1 ring-telos-blue-500/50'
                  : 'border-slate-700 bg-surface-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              Apply to 2026
            </button>
          </div>

          {applyToNextYear && (
            <div className="space-y-2 pt-1">
              <FormField label="Amount to apply to 2026 estimated tax" irsRef="Form 1040, Line 36">
                <CurrencyInput
                  value={applyAmount}
                  onChange={(v) => setApplyAmount(Math.min(v, refundAmount))}
                />
              </FormField>
              {applyAmount > 0 && applyAmount < refundAmount && (
                <p className="text-xs text-slate-400">
                  Refund to you: {(refundAmount - applyAmount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  {' | '}Applied to 2026: {applyAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
              )}
              {applyAmount >= refundAmount && (
                <p className="text-xs text-emerald-400">
                  Full refund of {refundAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} will be applied to 2026 estimated tax.
                </p>
              )}
            </div>
          )}
        </div>

        <StepNavigation />
      </div>
    );
  }

  // ── Owed Mode ─────────────────────────────────────────────────
  if (amountOwed > 0) {
    return (
      <div className="space-y-6">
        <SectionIntro
          title="Refund & Payment"
          description="You have a balance due. Here's how to pay."
          icon={<Banknote className="w-8 h-8" />}
        />

        {/* Amount owed card */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
          <p className="text-sm text-amber-300 mb-1">Amount You Owe</p>
          <p className="text-3xl font-bold text-amber-400">{formattedOwed}</p>
        </div>

        <CalloutCard variant="info" title="Form 1040-V Payment Voucher">
          A Form 1040-V payment voucher will be automatically included in your PDF download.
          Detach it and mail with your check or money order.
        </CalloutCard>

        <div className="rounded-lg border border-slate-700 bg-surface-800 p-5 space-y-4">
          <h3 className="text-sm font-medium text-white">Payment Options</h3>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-telos-blue-600/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-telos-blue-400">1</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">IRS Direct Pay (Recommended)</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pay directly from your bank account — free, secure, instant confirmation.
                </p>
                <a
                  href="https://www.irs.gov/payments/direct-pay"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  irs.gov/directpay
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-telos-blue-600/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-telos-blue-400">2</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Check or Money Order</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Make payable to "United States Treasury." Write your SSN, daytime phone,
                  and "2025 Form 1040" on the payment. Do not send cash.
                </p>
              </div>
            </div>
          </div>
        </div>

        <StepNavigation />
      </div>
    );
  }

  // ── Break-Even Mode ───────────────────────────────────────────
  return (
    <div className="space-y-6">
      <SectionIntro
        title="Refund & Payment"
        description="You're all set — nothing owed, nothing refunded."
        icon={<Banknote className="w-8 h-8" />}
      />

      <div className="rounded-xl border border-slate-700 bg-surface-800 p-5 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
        <p className="text-sm text-slate-300">
          Your tax liability exactly matches your payments and credits. No refund or balance due.
        </p>
      </div>

      <StepNavigation />
    </div>
  );
}
