import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem, updateReturn } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { BarChart3, Pencil, Trash2, History, ExternalLink } from 'lucide-react';
import AddButton from '../common/AddButton';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import InlineImportButton from '../import/InlineImportButton';
import InlineCSVImport from '../import/InlineCSVImport';
import { validateSaleDate, validateAcquiredDate, computeHoldingPeriod, validateHoldingPeriod, validatePlacedInServiceDate } from '../../utils/dateValidation';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import StepWarningsBanner from '../common/StepWarningsBanner';
import WhatsNewCard from '../common/WhatsNewCard';

const EMPTY_FORM = {
  brokerName: '',
  description: '',
  dateAcquired: '',
  dateSold: '',
  proceeds: 0,
  costBasis: 0,
  isLongTerm: false,
  federalTaxWithheld: 0,
  washSaleLossDisallowed: 0,
  basisReportedToIRS: true,
  isCollectible: false,
};

export default function B1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('1099b_income');

  const help = HELP_CONTENT['1099b_income'];

  const items = taxReturn.income1099B || [];

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [importing, setImporting] = useState(false);

  const cancelForm = () => {
    setForm({ ...EMPTY_FORM });
    setAdding(false);
    setEditingId(null);
  };

  const startEdit = (item: typeof items[number]) => {
    setAdding(false);
    setEditingId(item.id);
    setForm({
      brokerName: item.brokerName,
      description: item.description,
      dateAcquired: item.dateAcquired || '',
      dateSold: item.dateSold || '',
      proceeds: item.proceeds,
      costBasis: item.costBasis,
      isLongTerm: item.isLongTerm,
      federalTaxWithheld: item.federalTaxWithheld || 0,
      washSaleLossDisallowed: item.washSaleLossDisallowed || 0,
      basisReportedToIRS: item.basisReportedToIRS !== false,
      isCollectible: item.isCollectible || false,
    });
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, '1099b', form);
    updateField('income1099B', [...items, { id: result.id, ...form }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, '1099b', editingId, form);
    updateField('income1099B', items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099B',
      item: item as any,
      label: `1099-B${item.description ? `: ${item.description}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const gainLoss = (item: typeof form) => {
    const gl = (item.proceeds ?? 0) - (item.costBasis ?? 0);
    return gl >= 0 ? `+$${gl.toLocaleString()}` : `-$${Math.abs(gl).toLocaleString()}`;
  };

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      <FormField label="Broker Name" tooltip={help?.fields['Broker Name']?.tooltip} irsRef={help?.fields['Broker Name']?.irsRef}>
        <input className="input-field" value={form.brokerName} onChange={(e) => setForm({ ...form, brokerName: e.target.value })} placeholder="Fidelity, Schwab, etc." />
      </FormField>
      <FormField label="Description" tooltip={help?.fields['Description']?.tooltip} optional>
        <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="100 shares AAPL" />
      </FormField>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Date Acquired" tooltip={help?.fields['Date Acquired']?.tooltip} warning={validateAcquiredDate(form.dateAcquired, form.dateSold)}>
            <input type="date" className="input-field" value={form.dateAcquired} onChange={(e) => {
              const newAcquired = e.target.value;
              const hp = computeHoldingPeriod(newAcquired, form.dateSold);
              setForm({ ...form, dateAcquired: newAcquired, ...(hp ? { isLongTerm: hp === 'long' } : {}) });
            }} />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Date Sold" tooltip={help?.fields['Date Sold']?.tooltip} warning={validateSaleDate(form.dateSold)}>
            <input type="date" className="input-field" value={form.dateSold} onChange={(e) => {
              const newSold = e.target.value;
              const hp = computeHoldingPeriod(form.dateAcquired, newSold);
              setForm({ ...form, dateSold: newSold, ...(hp ? { isLongTerm: hp === 'long' } : {}) });
            }} />
          </FormField>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Proceeds (Box 1d)" tooltip={help?.fields['Proceeds (Box 1d)']?.tooltip} irsRef={help?.fields['Proceeds (Box 1d)']?.irsRef}>
            <CurrencyInput value={form.proceeds} onChange={(v) => setForm({ ...form, proceeds: v })} />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Cost Basis (Box 1e)" tooltip={help?.fields['Cost Basis (Box 1e)']?.tooltip} irsRef={help?.fields['Cost Basis (Box 1e)']?.irsRef}>
            <CurrencyInput value={form.costBasis} onChange={(v) => setForm({ ...form, costBasis: v })} />
          </FormField>
        </div>
      </div>
      <FormField label="Holding Period" warning={validateHoldingPeriod(form.dateAcquired, form.dateSold, form.isLongTerm)}>
        <select className="input-field" value={form.isLongTerm ? 'long' : 'short'} onChange={(e) => setForm({ ...form, isLongTerm: e.target.value === 'long' })}>
          <option value="short">Short-term (held 1 year or less)</option>
          <option value="long">Long-term (held more than 1 year)</option>
        </select>
      </FormField>
      <FormField label="Federal Tax Withheld (Box 4)" optional>
        <CurrencyInput value={form.federalTaxWithheld} onChange={(v) => setForm({ ...form, federalTaxWithheld: v })} />
      </FormField>
      <FormField label="Wash Sale Loss Disallowed (Box 1g)" optional helpText="Loss disallowed due to purchasing substantially identical securities within 30 days.">
        <CurrencyInput value={form.washSaleLossDisallowed} onChange={(v) => setForm({ ...form, washSaleLossDisallowed: v })} />
      </FormField>
      <FormField label="Cost basis reported to IRS (Box 12)" helpText="Covered security — broker reported basis. Uncheck if basis was not reported.">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.basisReportedToIRS} onChange={(e) => setForm({ ...form, basisReportedToIRS: e.target.checked })} className="rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500" />
          <span className="text-sm text-slate-300">Cost basis reported to IRS (Box 12)</span>
        </label>
      </FormField>
      <FormField label="Collectible (28% rate gain)" helpText="Art, antiques, metals, gems, stamps, coins, etc. Subject to 28% maximum capital gains rate.">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isCollectible} onChange={(e) => setForm({ ...form, isCollectible: e.target.checked })} className="rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500" />
          <span className="text-sm text-slate-300">Collectible (28% rate gain)</span>
        </label>
      </FormField>
      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.brokerName} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="1099b_income" />

      <SectionIntro
        icon={<BarChart3 className="w-8 h-8" />}
        title="1099-B Capital Gains & Losses"
        description="Enter each stock, bond, or other investment you sold during 2025."
      />

      <WhatsNewCard items={[
        { title: 'Capital Gains Rate Thresholds Increased', description: '0% rate threshold: $48,350 Single (up from $47,025), $96,700 MFJ (up from $94,050). 15% rate applies up to $533,400 Single / $600,050 MFJ.' },
        { title: '100% Bonus Depreciation Restored', description: 'Relevant if selling business assets — 100% first-year bonus depreciation is back for assets placed in service in 2025 under the OBBBA.' },
      ]} />

      <div className="space-y-3 mt-4 mb-2">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Inline CSV import */}
      {importing ? (
        <InlineCSVImport
          targetType="1099b"
          formLabel="1099-B"
          onClose={() => setImporting(false)}
        />
      ) : (
        <InlineImportButton importType="csv" formLabel="1099-B" onClick={() => setImporting(true)} />
      )}

      {items.map((item, idx) =>
        editingId === item.id ? (
          <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
        ) : (
          <div key={item.id} className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`} role="button" tabIndex={0} onClick={() => startEdit(item)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(item); } }}>
            <div>
              <div className="font-medium">{item.brokerName || 'Unknown Broker'}</div>
              <div className="text-sm text-slate-400">
                {item.description && <span>{item.description} &middot; </span>}
                Proceeds: ${(item.proceeds ?? 0).toLocaleString()} &middot; Basis: ${(item.costBasis ?? 0).toLocaleString()}
                <span className={`ml-2 font-medium ${item.proceeds >= item.costBasis ? 'text-green-400' : 'text-red-400'}`}>
                  {gainLoss(item as typeof form)}
                </span>
                <span className="ml-2 text-xs text-slate-400">
                  {item.isLongTerm ? 'Long-term' : 'Short-term'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ItemWarningBadge warnings={itemWarnings.get(idx)} /><button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="p-2 text-slate-400 hover:text-telos-blue-400" title="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="p-2 text-slate-400 hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        )
      )}

      {!editingId && (
        adding ? (
          renderForm(addItem, 'Save 1099-B')
        ) : (
          <AddButton onClick={() => setAdding(true)}>Add 1099-B Transaction</AddButton>
        )
      )}

      {/* Prior-year carryforwards */}
      <div className="card mt-6">
        <div className="flex items-center gap-3 mb-3">
          <History className="w-5 h-5 text-telos-blue-400" />
          <h3 className="font-medium text-slate-200">Prior-Year Capital Loss Carryforward</h3>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          If you had net capital losses exceeding $3,000 in a prior year, the excess carries forward. Enter amounts from your prior year Schedule D.
        </p>
        <div className="flex gap-3">
          <div className="flex-1">
            <FormField label="Short-Term Carryforward" optional helpText="Prior year Schedule D, Line 7" tooltip="Short-term capital loss carryforward from your prior year's Schedule D (Line 7). If your total net capital losses exceeded $3,000 last year, the excess carries forward. Short-term losses are applied first against short-term gains, then excess offsets long-term gains.">
              <CurrencyInput
                value={taxReturn.capitalLossCarryforwardST}
                onChange={(v) => updateField('capitalLossCarryforwardST', v)}
              />
            </FormField>
          </div>
          <div className="flex-1">
            <FormField label="Long-Term Carryforward" optional helpText="Prior year Schedule D, Line 15" tooltip="Long-term capital loss carryforward from your prior year's Schedule D (Line 15). Unused long-term losses carry forward indefinitely. Long-term losses offset long-term gains first, then excess can offset short-term gains.">
              <CurrencyInput
                value={taxReturn.capitalLossCarryforwardLT}
                onChange={(v) => updateField('capitalLossCarryforwardLT', v)}
              />
            </FormField>
          </div>
        </div>
        <FormField label="Unrecaptured Section 1250 Gain" optional helpText="From sale of depreciable real property — taxed at max 25%">
          <CurrencyInput
            value={taxReturn.unrecapturedSection1250Gain}
            onChange={(v) => updateField('unrecapturedSection1250Gain', v)}
          />
        </FormField>
        <a
          href="https://www.irs.gov/taxtopics/tc409"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Learn more on IRS.gov
        </a>
      </div>

      {/* Qualified Opportunity Zone (Form 8997) */}
      <div className="card mt-4">
        <div className="flex items-center gap-3 mb-3">
          <BarChart3 className="w-5 h-5 text-telos-blue-400" />
          <h3 className="font-medium text-slate-200">Qualified Opportunity Zone Deferral</h3>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          If you invested capital gains into a Qualified Opportunity Zone Fund, you can defer the gain. Report on Form 8997.
        </p>
        <FormField label="Capital Gain Deferred" optional helpText="Gain invested in a QOZ fund within 180 days of sale" tooltip="Under IRC §1400Z-2, you can defer capital gains by investing them in a Qualified Opportunity Zone (QOZ) fund within 180 days of the sale. The deferred gain is reported on Form 8997 and must be recognized by December 31, 2026, or when the QOZ investment is sold, whichever comes first.">
          <CurrencyInput
            value={taxReturn.qozInvestment?.deferredGain}
            onChange={(v) => updateField('qozInvestment', { ...taxReturn.qozInvestment, deferredGain: v })}
          />
        </FormField>
        {(taxReturn.qozInvestment?.deferredGain || 0) > 0 && (
          <>
            <div className="flex gap-3">
              <div className="flex-1">
                <FormField label="Investment Amount" helpText="Total invested in QOZ fund">
                  <CurrencyInput
                    value={taxReturn.qozInvestment?.investmentAmount}
                    onChange={(v) => updateField('qozInvestment', { ...taxReturn.qozInvestment, investmentAmount: v })}
                  />
                </FormField>
              </div>
              <div className="flex-1">
                <FormField label="Investment Date" warning={validatePlacedInServiceDate(taxReturn.qozInvestment?.investmentDate || '')}>
                  <input
                    type="date"
                    className="input-field"
                    value={taxReturn.qozInvestment?.investmentDate || ''}
                    onChange={(e) => updateField('qozInvestment', { ...taxReturn.qozInvestment, investmentDate: e.target.value })}
                  />
                </FormField>
              </div>
            </div>
          </>
        )}
        <a
          href="https://www.irs.gov/credits-deductions/opportunity-zones-frequently-asked-questions"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Learn more on IRS.gov
        </a>
      </div>

      <StepNavigation onContinue={async () => {
        await updateReturn(returnId, {
          capitalLossCarryforwardST: taxReturn.capitalLossCarryforwardST,
          capitalLossCarryforwardLT: taxReturn.capitalLossCarryforwardLT,
          unrecapturedSection1250Gain: taxReturn.unrecapturedSection1250Gain,
          qozInvestment: taxReturn.qozInvestment,
        });
      }} />
    </div>
  );
}
