/**
 * FindPreparerPanel — Help users find an authorized IRS e-file provider.
 *
 * Links to the IRS e-file provider directory and provides
 * guidance on what to bring.
 */
import type { TaxReturn } from '@telostax/engine';
import { FILING_URLS } from '@telostax/engine';
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  CreditCard,
  Fingerprint,
} from 'lucide-react';

interface FindPreparerPanelProps {
  taxReturn: TaxReturn;
  onBack: () => void;
}

export default function FindPreparerPanel({ taxReturn, onBack }: FindPreparerPanelProps) {
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

      <h2 className="text-xl font-bold text-white mb-1">Find an E-File Provider</h2>
      <p className="text-sm text-slate-400 mb-5">
        Locate an authorized IRS e-file provider who can file your return electronically.
      </p>

      {/* Search Link */}
      <div className="card bg-surface-800 border-slate-700">
        <a
          href={FILING_URLS.efileProviders}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-telos-blue-600 hover:bg-telos-blue-500 text-white text-sm font-medium transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Find Authorized E-File Providers
        </a>

        <p className="text-xs text-slate-400 mt-3">
          Opens the IRS authorized e-file provider directory on irs.gov.
        </p>
      </div>

      {/* What to bring */}
      <div className="mt-6">
        <h3 className="text-base font-semibold text-white mb-3">What to Bring</h3>
        <div className="space-y-2.5">
          <BringItem
            icon={<FileText className="w-4 h-4 text-telos-blue-400" />}
            text="Your TelosTax Filing Packet (printed PDF from the next step)"
          />
          <BringItem
            icon={<FileText className="w-4 h-4 text-telos-blue-400" />}
            text="W-2 forms from all employers"
          />
          <BringItem
            icon={<FileText className="w-4 h-4 text-telos-blue-400" />}
            text="1099 forms (interest, dividends, freelance income, retirement)"
          />
          <BringItem
            icon={<Fingerprint className="w-4 h-4 text-telos-blue-400" />}
            text="Photo ID and Social Security cards for you (and spouse / dependents)"
          />
          <BringItem
            icon={<CreditCard className="w-4 h-4 text-telos-blue-400" />}
            text="Bank routing and account numbers (for direct deposit)"
          />
        </div>
      </div>

      {/* What an e-file provider can do */}
      <div className="mt-6">
        <h3 className="text-base font-semibold text-white mb-3">What an E-File Provider Can Do</h3>
        <div className="card bg-surface-800 border-slate-700">
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">&bull;</span>
              E-file your federal and state returns (faster refunds, fewer errors)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">&bull;</span>
              Handle complex situations (multi-state, business income, rental properties)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">&bull;</span>
              Review your return for accuracy and missed deductions
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function BringItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm text-slate-400">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
