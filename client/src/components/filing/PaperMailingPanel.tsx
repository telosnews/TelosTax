/**
 * PaperMailingPanel — Paper filing instructions for printing & mailing.
 *
 * Extracted from the original FilingInstructionsStep. Contains:
 * - Forms in Your Return (numbered list)
 * - Before You Mail (signature, attachments, no-staple)
 * - Mailing Address (state-based)
 * - Payment / Refund sections (conditional)
 * - State Filing section (conditional)
 */
import { useMemo } from 'react';
import type { TaxReturn, CalculationResult, FilingInstructions } from '@telostax/engine';
import { getFilingInstructions, FilingStatus, assessEstimatedPaymentNeed } from '@telostax/engine';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import DeadlineCard from './DeadlineCard';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import {
  FileText,
  PenLine,
  Paperclip,
  Mailbox,
  MapPin,
  DollarSign,
  CheckSquare,
  ExternalLink,
  ArrowLeft,
  Calendar,
} from 'lucide-react';

interface PaperMailingPanelProps {
  taxReturn: TaxReturn;
  result: CalculationResult;
  onBack: () => void;
}

export default function PaperMailingPanel({ taxReturn, result, onBack }: PaperMailingPanelProps) {
  const navigateToFormLine = useTaxReturnStore((s) => s.navigateToFormLine);

  const instructions = useMemo(
    () => getFilingInstructions(taxReturn, result),
    [taxReturn, result],
  );

  const estimatedRec = useMemo(
    () => assessEstimatedPaymentNeed(taxReturn, result),
    [taxReturn, result],
  );

  const help = HELP_CONTENT['filing_instructions'];

  return (
    <div>
      {/* Back to hub */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-telos-blue-400 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Filing Options
      </button>

      <h2 className="text-xl font-bold text-white mb-1">Print & Mail Your Return</h2>
      <p className="text-sm text-slate-400 mb-4">
        Here's exactly what to do to file your return by mail.
      </p>

      <div className="space-y-3 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Deadline + Countdown */}
      <DeadlineCard deadline={instructions.deadline} />

      {/* Forms in Your Return */}
      <Section icon={<FileText className="w-5 h-5" />} title="Forms in Your Return">
        <div className="space-y-2">
          {instructions.formsIncluded.map((form, i) => (
            <button
              key={form.formId}
              onClick={() => navigateToFormLine(form.formId)}
              className="flex items-center gap-3 w-full text-left group py-0.5 -mx-1 px-1 rounded hover:bg-surface-700/50 transition-colors"
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-surface-700 text-xs font-medium text-slate-400 group-hover:bg-telos-blue-600/30 group-hover:text-telos-blue-400 transition-colors">
                {i + 1}
              </span>
              <span className="text-sm text-slate-300 group-hover:text-telos-blue-400 transition-colors">{form.displayName}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Download these forms on the next step. Print all pages, even if some are blank.
        </p>
      </Section>

      {/* Before You Mail */}
      <Section icon={<CheckSquare className="w-5 h-5" />} title="Before You Mail">
        <div className="space-y-3">
          <ChecklistItem>
            <PenLine className="w-4 h-4 text-telos-blue-400 shrink-0 mt-0.5" />
            <span>{instructions.signatureLines}</span>
          </ChecklistItem>

          {instructions.attachments.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-2">
                <Paperclip className="w-4 h-4 text-telos-blue-400 shrink-0" />
                <span className="text-sm font-medium text-slate-300">Attach to the front of your return:</span>
              </div>
              <ul className="ml-8 space-y-1.5">
                {instructions.attachments.map((item, i) => (
                  <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                    <span className="text-telos-blue-400 mt-0.5">&bull;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}

          <ChecklistItem>
            <FileText className="w-4 h-4 text-telos-blue-400 shrink-0 mt-0.5" />
            <span>Do <strong className="text-slate-300">not</strong> staple or paper-clip your payment to the return. Place it loosely in the envelope.</span>
          </ChecklistItem>
        </div>
      </Section>

      {/* Mailing Address */}
      <Section icon={<Mailbox className="w-5 h-5" />} title="Mail To">
        <div className="bg-surface-800 border border-slate-700 rounded-lg p-4 font-mono text-sm text-slate-200 leading-relaxed">
          {instructions.mailingAddress.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Send via USPS. Use certified mail with return receipt if you want proof of delivery.
        </p>
      </Section>

      {/* Payment (only if they owe) */}
      {instructions.owesAmount > 0 && (
        <Section icon={<DollarSign className="w-5 h-5" />} title="Payment">
          <div className="rounded-xl border p-6 bg-amber-500/10 border-amber-500/20">
            <div className="text-center mb-3">
              <p className="text-sm text-slate-400">Amount Owed</p>
              <p className="text-3xl font-bold text-amber-400">
                ${instructions.owesAmount.toLocaleString()}
              </p>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {instructions.paymentNote}
            </p>
            <a
              href="https://directpay.irs.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Pay online via IRS Direct Pay
            </a>
          </div>
        </Section>
      )}

      {/* Refund note */}
      {instructions.refundAmount > 0 && (
        <Section icon={<DollarSign className="w-5 h-5" />} title="Your Refund">
          <div className="rounded-xl border p-6 bg-emerald-500/10 border-emerald-500/30">
            <div className="text-center mb-3">
              <p className="text-sm text-slate-400">Estimated Refund</p>
              <p className="text-3xl font-bold text-emerald-400">
                ${instructions.refundAmount.toLocaleString()}
              </p>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Paper-filed returns typically take 6-8 weeks to process. You can check your refund
              status at{' '}
              <a
                href="https://www.irs.gov/refunds"
                target="_blank"
                rel="noopener noreferrer"
                className="text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
              >
                irs.gov/refunds
              </a>{' '}
              about 4 weeks after mailing.
            </p>
          </div>
        </Section>
      )}

      {/* State Filing */}
      {instructions.hasStateReturn && (
        <Section icon={<MapPin className="w-5 h-5" />} title="State Filing">
          {result.stateResults?.filter(sr => (sr.totalStateTax || 0) !== 0 || (sr.localTax || 0) !== 0 || sr.stateCode).map(sr => {
            const stateRefund = sr.stateRefundOrOwed >= 0;
            const stateInfo = instructions.stateFilingInfo.find(si => si.stateCode === sr.stateCode);
            const addr = stateInfo?.mailingAddress;
            const addrLines = addr
              ? (stateRefund ? addr.refund : addr.balanceDue)
              : null;

            return (
              <div key={sr.stateCode} className="card bg-surface-800 border-slate-700 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-telos-blue-600/20 flex items-center justify-center text-telos-blue-400 font-bold text-xs">
                      {sr.stateCode}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{sr.stateName}</p>
                      <p className="text-xs text-slate-400 capitalize">
                        {sr.residencyType === 'resident' ? 'Full-year resident' : sr.residencyType === 'part_year' ? 'Part-year' : 'Nonresident'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${stateRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
                      ${Math.abs(sr.stateRefundOrOwed).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">{stateRefund ? 'Refund' : 'Owed'}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-slate-400 border-t border-slate-700/50 pt-2">
                  <span>Total tax: ${sr.totalStateTax.toLocaleString()}</span>
                  <span>Effective rate: {(sr.effectiveStateRate * 100).toFixed(2)}%</span>
                </div>

                {addrLines ? (
                  <>
                    <p className="text-xs font-medium text-slate-300 mt-3 mb-1">
                      Mail {sr.stateCode} return to:
                    </p>
                    <div className="bg-surface-900 border border-slate-700/50 rounded-lg p-3 font-mono text-xs text-slate-200 leading-relaxed">
                      {addrLines.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                    {addr!.notes && (
                      <p className="text-xs text-slate-400 mt-1.5">{addr!.notes}</p>
                    )}
                    {addr!.onlinePaymentUrl && !stateRefund && (
                      <a
                        href={addr!.onlinePaymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Pay online
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-400 mt-2">
                    File separately with your state's department of revenue.
                  </p>
                )}
              </div>
            );
          })}
          {(!result.stateResults || result.stateResults.filter(sr => (sr.totalStateTax || 0) !== 0 || (sr.localTax || 0) !== 0 || sr.stateCode).length === 0) && (
            <div className="card bg-surface-800 border-slate-700">
              <p className="text-sm text-slate-400">
                You also need to file{' '}
                {instructions.stateNames.length === 1
                  ? `a ${instructions.stateNames[0]} state return`
                  : `state returns for ${instructions.stateNames.join(' and ')}`}
                {' '}separately. State returns are mailed to your state's department of revenue — not
                to the IRS addresses above.
              </p>
            </div>
          )}
        </Section>
      )}

      {/* Estimated Tax Voucher Awareness */}
      {estimatedRec.recommended && (
        <div className="mt-6 rounded-xl border border-telos-blue-500/20 bg-telos-blue-500/5 p-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-telos-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-telos-blue-300">Estimated Tax Payments Recommended</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Based on your return, you may need to make estimated tax payments of{' '}
                <span className="text-white font-medium">${estimatedRec.quarterlyAmount.toLocaleString()}</span> per
                quarter for the next tax year. Download estimated tax vouchers on the Export step —
                they are mailed separately from your Form 1040 to a different IRS address.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper Components ─────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-telos-blue-400">{icon}</span>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm text-slate-400 leading-relaxed">
      {children}
    </div>
  );
}
