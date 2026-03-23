import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { addIncomeItem, updateIncomeItem } from '../../api/client';
import { deleteItemWithUndo } from '../../utils/deleteWithUndo';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Coins, Pencil, Trash2 } from 'lucide-react';
import WhatsNewCard from '../common/WhatsNewCard';
import AddButton from '../common/AddButton';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import InlineImportButton from '../import/InlineImportButton';
import InlineCSVImport from '../import/InlineCSVImport';
import { validateSaleDate, validateAcquiredDate, computeHoldingPeriod, validateHoldingPeriod } from '../../utils/dateValidation';
import ItemWarningBadge from '../common/ItemWarningBadge';
import { useItemWarnings } from '../../hooks/useWarnings';
import StepWarningsBanner from '../common/StepWarningsBanner';

// Common crypto assets for quick-select
const COMMON_TOKENS = [
  { name: 'Bitcoin', symbol: 'BTC' },
  { name: 'Ethereum', symbol: 'ETH' },
  { name: 'Solana', symbol: 'SOL' },
  { name: 'Cardano', symbol: 'ADA' },
  { name: 'Dogecoin', symbol: 'DOGE' },
  { name: 'XRP', symbol: 'XRP' },
  { name: 'Polygon', symbol: 'MATIC' },
  { name: 'Avalanche', symbol: 'AVAX' },
];

const EMPTY_FORM = {
  brokerName: '',
  tokenName: '',
  tokenSymbol: '',
  description: '',
  dateAcquired: '',
  dateSold: '',
  proceeds: 0,
  costBasis: 0,
  isLongTerm: false,
  federalTaxWithheld: 0,
  washSaleLossDisallowed: 0,
  transactionId: '',
  isBasisReportedToIRS: true,
};

export default function DA1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const itemWarnings = useItemWarnings('1099da_income');

  const help = HELP_CONTENT['1099da_income'];

  const items = taxReturn.income1099DA || [];

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
      tokenName: item.tokenName,
      tokenSymbol: item.tokenSymbol || '',
      description: item.description || '',
      dateAcquired: item.dateAcquired || '',
      dateSold: item.dateSold || '',
      proceeds: item.proceeds,
      costBasis: item.costBasis,
      isLongTerm: item.isLongTerm,
      federalTaxWithheld: item.federalTaxWithheld || 0,
      washSaleLossDisallowed: item.washSaleLossDisallowed || 0,
      transactionId: item.transactionId || '',
      isBasisReportedToIRS: item.isBasisReportedToIRS ?? true,
    });
  };

  const addItem = async () => {
    const result = await addIncomeItem(returnId, '1099da', form);
    updateField('income1099DA', [...items, { id: result.id, ...form }]);
    cancelForm();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateIncomeItem(returnId, '1099da', editingId, form);
    updateField('income1099DA', items.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    cancelForm();
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    deleteItemWithUndo({
      returnId,
      fieldName: 'income1099DA',
      item: item as any,
      label: `1099-DA${item.description ? `: ${item.description}` : ''}`,
      onCleanup: editingId === id ? cancelForm : undefined,
    });
  };

  const gainLoss = (item: typeof form) => {
    const gl = (item.proceeds ?? 0) - (item.costBasis ?? 0);
    return gl >= 0 ? `+$${gl.toLocaleString()}` : `-$${Math.abs(gl).toLocaleString()}`;
  };

  const selectToken = (name: string, symbol: string) => {
    setForm({ ...form, tokenName: name, tokenSymbol: symbol });
  };

  // Summary stats
  const totalProceeds = items.reduce((s, i) => s + i.proceeds, 0);
  const totalBasis = items.reduce((s, i) => s + i.costBasis, 0);
  const netGainLoss = totalProceeds - totalBasis;
  const shortTermCount = items.filter((i) => !i.isLongTerm).length;
  const longTermCount = items.filter((i) => i.isLongTerm).length;

  const renderForm = (onSave: () => void, saveLabel: string) => (
    <div className="card mt-4">
      {/* Quick token selector */}
      {!form.tokenName && (
        <div className="mb-4">
          <label className="text-xs text-slate-400 mb-2 block">Quick select:</label>
          <div className="flex flex-wrap gap-2">
            {COMMON_TOKENS.map((t) => (
              <button
                key={t.symbol}
                type="button"
                onClick={() => selectToken(t.name, t.symbol)}
                className="px-3 py-1.5 text-xs rounded-full border border-slate-600 text-slate-300 hover:border-telos-orange-500/50 hover:text-telos-orange-400 transition-colors"
              >
                {t.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Token / Asset Name" tooltip={help?.fields['Token / Asset Name']?.tooltip}>
            <input
              className="input-field"
              value={form.tokenName}
              onChange={(e) => setForm({ ...form, tokenName: e.target.value })}
              placeholder="Bitcoin, Ethereum, etc."
            />
          </FormField>
        </div>
        <div className="w-24">
          <FormField label="Symbol" optional>
            <input
              className="input-field"
              value={form.tokenSymbol}
              onChange={(e) => setForm({ ...form, tokenSymbol: e.target.value.toUpperCase() })}
              placeholder="BTC"
              maxLength={10}
            />
          </FormField>
        </div>
      </div>

      <FormField label="Exchange / Broker" tooltip={help?.fields['Exchange / Broker']?.tooltip} irsRef={help?.fields['Exchange / Broker']?.irsRef}>
        <input
          className="input-field"
          value={form.brokerName}
          onChange={(e) => setForm({ ...form, brokerName: e.target.value })}
          placeholder="Coinbase, Kraken, Binance, etc."
        />
      </FormField>

      <FormField label="Description" tooltip={help?.fields['Description']?.tooltip} optional>
        <input
          className="input-field"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="e.g. Sold 0.5 BTC"
        />
      </FormField>

      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Date Acquired" tooltip={help?.fields['Date Acquired']?.tooltip} warning={validateAcquiredDate(form.dateAcquired, form.dateSold)}>
            <input
              type="date"
              className="input-field"
              value={form.dateAcquired}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                const newAcquired = e.target.value;
                const hp = computeHoldingPeriod(newAcquired, form.dateSold);
                setForm({ ...form, dateAcquired: newAcquired, ...(hp ? { isLongTerm: hp === 'long' } : {}) });
              }}
            />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Date Sold" tooltip={help?.fields['Date Sold']?.tooltip} warning={validateSaleDate(form.dateSold)}>
            <input
              type="date"
              className="input-field"
              value={form.dateSold}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                const newSold = e.target.value;
                const hp = computeHoldingPeriod(form.dateAcquired, newSold);
                setForm({ ...form, dateSold: newSold, ...(hp ? { isLongTerm: hp === 'long' } : {}) });
              }}
            />
          </FormField>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Proceeds (Box 1b)" tooltip={help?.fields['Proceeds (Box 1b)']?.tooltip} irsRef={help?.fields['Proceeds (Box 1b)']?.irsRef}>
            <CurrencyInput value={form.proceeds} onChange={(v) => setForm({ ...form, proceeds: v })} />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Cost Basis (Box 1c)" tooltip={help?.fields['Cost Basis (Box 1c)']?.tooltip} irsRef={help?.fields['Cost Basis (Box 1c)']?.irsRef}>
            <CurrencyInput value={form.costBasis} onChange={(v) => setForm({ ...form, costBasis: v })} />
          </FormField>
        </div>
      </div>

      {/* Gain/loss preview */}
      {(form.proceeds > 0 || form.costBasis > 0) && (
        <div className={`text-sm font-medium mt-1 mb-2 ${form.proceeds >= form.costBasis ? 'text-green-400' : 'text-red-400'}`}>
          {form.proceeds >= form.costBasis ? 'Gain' : 'Loss'}: {gainLoss(form)}
        </div>
      )}

      <FormField label="Holding Period" warning={validateHoldingPeriod(form.dateAcquired, form.dateSold, form.isLongTerm)}>
        <select
          className="input-field"
          value={form.isLongTerm ? 'long' : 'short'}
          onChange={(e) => setForm({ ...form, isLongTerm: e.target.value === 'long' })}
        >
          <option value="short">Short-term (held 1 year or less)</option>
          <option value="long">Long-term (held more than 1 year)</option>
        </select>
      </FormField>

      <FormField label="Was cost basis reported to the IRS?" tooltip={help?.fields['Basis Reported']?.tooltip}>
        <select
          className="input-field"
          value={form.isBasisReportedToIRS ? 'yes' : 'no'}
          onChange={(e) => setForm({ ...form, isBasisReportedToIRS: e.target.value === 'yes' })}
        >
          <option value="yes">Yes — broker reported basis to IRS</option>
          <option value="no">No — basis was not reported</option>
        </select>
      </FormField>

      <FormField label="Federal Tax Withheld (Box 4)" optional>
        <CurrencyInput value={form.federalTaxWithheld} onChange={(v) => setForm({ ...form, federalTaxWithheld: v })} />
      </FormField>

      <FormField label="Wash Sale Loss Disallowed" tooltip={help?.fields['Wash Sale Loss']?.tooltip} optional>
        <CurrencyInput value={form.washSaleLossDisallowed} onChange={(v) => setForm({ ...form, washSaleLossDisallowed: v })} />
      </FormField>

      <FormField label="Transaction ID / Hash" optional>
        <input
          className="input-field font-mono text-xs"
          value={form.transactionId}
          onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
          placeholder="0x..."
        />
      </FormField>

      <div className="flex gap-3 mt-2">
        <button onClick={onSave} disabled={!form.tokenName || !form.brokerName} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={cancelForm} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <StepWarningsBanner stepId="1099da_income" />
      <SectionIntro
        icon={<Coins className="w-8 h-8" />}
        title="Digital Assets (1099-DA)"
        description="Enter each cryptocurrency or digital asset transaction from 2025. This includes sales, trades, and dispositions."
      />

      <WhatsNewCard items={[
        { title: 'New Form 1099-DA for 2025', description: 'Beginning in tax year 2025, cryptocurrency exchanges and digital asset brokers must issue Form 1099-DA reporting gross proceeds from your transactions (IRS final regulations, TD 9989).' },
        { title: 'Broker-Reported Data', description: 'Your exchange should have sent you a 1099-DA with proceeds for each sale or trade, similar to how stock brokers report on Form 1099-B. Full cost basis reporting begins for certain transactions in 2026.' },
        { title: 'Verify and Supplement', description: 'Review your 1099-DA for accuracy. You must still report transactions from non-custodial wallets, decentralized exchanges, or platforms that did not issue a 1099-DA.' },
      ]} />

      {/* Inline CSV import */}
      {importing ? (
        <InlineCSVImport
          targetType="1099da"
          formLabel="1099-DA"
          onClose={() => setImporting(false)}
        />
      ) : (
        <InlineImportButton importType="csv" formLabel="1099-DA" onClick={() => setImporting(true)} />
      )}

      <div className="space-y-3 mt-4 mb-2">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Summary stats */}
      {items.length > 0 && (
        <div className="card mt-4 text-center">
          <p className="text-slate-400 text-sm mb-1">{items.length} {items.length === 1 ? 'transaction' : 'transactions'}</p>
          <p className={`text-2xl font-bold ${netGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {netGainLoss >= 0 ? '+' : '-'}${Math.abs(netGainLoss).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {shortTermCount > 0 && `${shortTermCount} short-term`}
            {shortTermCount > 0 && longTermCount > 0 && ' · '}
            {longTermCount > 0 && `${longTermCount} long-term`}
          </p>
        </div>
      )}

      {items.map((item, idx) =>
        editingId === item.id ? (
          <div key={item.id}>{renderForm(saveEdit, 'Save Changes')}</div>
        ) : (
          <div
            key={item.id}
            className={`card mt-4 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors${itemWarnings.has(idx) ? " border-amber-500/40" : ""}`}
            onClick={() => startEdit(item)}
          >
            <div>
              <div className="font-medium flex items-center gap-2">
                {item.tokenName}
                {item.tokenSymbol && (
                  <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">
                    {item.tokenSymbol}
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-400">
                {item.brokerName}
                {item.description && <span> &middot; {item.description}</span>}
              </div>
              <div className="text-sm text-slate-400 mt-0.5">
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
          renderForm(addItem, 'Save Transaction')
        ) : (
          <AddButton onClick={() => setAdding(true)}>Add Digital Asset Transaction</AddButton>
        )
      )}

      <StepNavigation />
    </div>
  );
}
