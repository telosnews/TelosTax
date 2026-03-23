import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Wheat, ExternalLink } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';

export default function ScheduleFStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const sf = taxReturn.scheduleF || {};
  const help = HELP_CONTENT['schedule_f'];

  const update = (field: string, value: number | boolean) => {
    updateField('scheduleF', { ...sf, [field]: value });
  };

  const save = async () => {
    await updateReturn(returnId, { scheduleF: taxReturn.scheduleF });
  };

  // Calculate totals for preview
  const grossIncome =
    (sf.salesOfLivestock || 0) - (sf.costOfLivestock || 0) +
    (sf.salesOfProducts || 0) +
    (sf.cooperativeDistributionsTaxable || 0) +
    (sf.agriculturalProgramPayments || 0) +
    (sf.cccLoans || 0) +
    (sf.cropInsuranceProceeds || 0) +
    (sf.customHireIncome || 0) +
    (sf.otherFarmIncome || 0);

  const totalExpenses =
    (sf.carAndTruck || 0) + (sf.chemicals || 0) + (sf.conservation || 0) +
    (sf.customHireExpense || 0) + (sf.depreciation || 0) + (sf.employeeBenefit || 0) +
    (sf.feed || 0) + (sf.fertilizers || 0) + (sf.freight || 0) +
    (sf.gasolineFuel || 0) + (sf.insurance || 0) + (sf.interest || 0) +
    (sf.labor || 0) + (sf.pension || 0) + (sf.rentLease || 0) +
    (sf.repairs || 0) + (sf.seeds || 0) + (sf.storage || 0) +
    (sf.supplies || 0) + (sf.taxes || 0) + (sf.utilities || 0) +
    (sf.veterinary || 0) + (sf.otherExpenses || 0);

  const netProfit = grossIncome - totalExpenses;

  return (
    <div>
      <StepWarningsBanner stepId="schedule_f" />

      <SectionIntro
        icon={<Wheat className="w-8 h-8" />}
        title="Schedule F — Farm Income"
        description="Report income and expenses from your farming operation."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Part I — Farm Income */}
      <div className="card mt-6">
        <h3 className="font-medium text-slate-200 mb-3">Part I — Farm Income (Cash Method)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
          <FormField label="Sales of Livestock (Line 1a)" optional tooltip={help?.fields['Sales of Livestock (Line 1a)']?.tooltip} irsRef={help?.fields['Sales of Livestock (Line 1a)']?.irsRef}>
            <CurrencyInput value={sf.salesOfLivestock} onChange={(v) => update('salesOfLivestock', v)} />
          </FormField>
          <FormField label="Cost of Livestock (Line 1b)" optional tooltip={help?.fields['Cost of Livestock (Line 1b)']?.tooltip} irsRef={help?.fields['Cost of Livestock (Line 1b)']?.irsRef}>
            <CurrencyInput value={sf.costOfLivestock} onChange={(v) => update('costOfLivestock', v)} />
          </FormField>
        </div>
        <FormField label="Sales of Products You Raised (Line 2)" optional tooltip={help?.fields['Sales of Products You Raised (Line 2)']?.tooltip} irsRef={help?.fields['Sales of Products You Raised (Line 2)']?.irsRef}>
          <CurrencyInput value={sf.salesOfProducts} onChange={(v) => update('salesOfProducts', v)} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
          <FormField label="Cooperative Distributions (Line 3a)" optional tooltip={help?.fields['Cooperative Distributions (Line 3a)']?.tooltip} irsRef={help?.fields['Cooperative Distributions (Line 3a)']?.irsRef}>
            <CurrencyInput value={sf.cooperativeDistributions} onChange={(v) => update('cooperativeDistributions', v)} />
          </FormField>
          <FormField label="Taxable Amount (Line 3b)" optional tooltip={help?.fields['Taxable Amount (Line 3b)']?.tooltip} irsRef={help?.fields['Taxable Amount (Line 3b)']?.irsRef}>
            <CurrencyInput value={sf.cooperativeDistributionsTaxable} onChange={(v) => update('cooperativeDistributionsTaxable', v)} />
          </FormField>
        </div>
        <FormField label="Agricultural Program Payments (Line 4a)" optional tooltip={help?.fields['Agricultural Program Payments (Line 4a)']?.tooltip} irsRef={help?.fields['Agricultural Program Payments (Line 4a)']?.irsRef}>
          <CurrencyInput value={sf.agriculturalProgramPayments} onChange={(v) => update('agriculturalProgramPayments', v)} />
        </FormField>
        <FormField label="CCC Loans Reported as Income (Line 5a)" optional tooltip={help?.fields['CCC Loans Reported as Income (Line 5a)']?.tooltip} irsRef={help?.fields['CCC Loans Reported as Income (Line 5a)']?.irsRef}>
          <CurrencyInput value={sf.cccLoans} onChange={(v) => update('cccLoans', v)} />
        </FormField>
        <FormField label="Crop Insurance Proceeds (Line 6)" optional tooltip={help?.fields['Crop Insurance Proceeds (Line 6)']?.tooltip} irsRef={help?.fields['Crop Insurance Proceeds (Line 6)']?.irsRef}>
          <CurrencyInput value={sf.cropInsuranceProceeds} onChange={(v) => update('cropInsuranceProceeds', v)} />
        </FormField>
        <FormField label="Custom Hire / Machine Work (Line 7)" optional tooltip={help?.fields['Custom Hire / Machine Work (Line 7)']?.tooltip} irsRef={help?.fields['Custom Hire / Machine Work (Line 7)']?.irsRef}>
          <CurrencyInput value={sf.customHireIncome} onChange={(v) => update('customHireIncome', v)} />
        </FormField>
        <FormField label="Other Farm Income (Line 8)" optional helpText="Breeding fees, government payments, etc." tooltip={help?.fields['Other Farm Income (Line 8)']?.tooltip} irsRef={help?.fields['Other Farm Income (Line 8)']?.irsRef}>
          <CurrencyInput value={sf.otherFarmIncome} onChange={(v) => update('otherFarmIncome', v)} />
        </FormField>
      </div>

      {/* Part II — Farm Expenses */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-3">Part II — Farm Expenses</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
          <FormField label="Car & Truck (Line 10)" optional tooltip={help?.fields['Car & Truck (Line 10)']?.tooltip} irsRef={help?.fields['Car & Truck (Line 10)']?.irsRef}>
            <CurrencyInput value={sf.carAndTruck} onChange={(v) => update('carAndTruck', v)} />
          </FormField>
          <FormField label="Chemicals (Line 11)" optional tooltip={help?.fields['Chemicals (Line 11)']?.tooltip} irsRef={help?.fields['Chemicals (Line 11)']?.irsRef}>
            <CurrencyInput value={sf.chemicals} onChange={(v) => update('chemicals', v)} />
          </FormField>
          <FormField label="Conservation (Line 12)" optional tooltip={help?.fields['Conservation (Line 12)']?.tooltip} irsRef={help?.fields['Conservation (Line 12)']?.irsRef}>
            <CurrencyInput value={sf.conservation} onChange={(v) => update('conservation', v)} />
          </FormField>
          <FormField label="Custom Hire (Line 13)" optional tooltip={help?.fields['Custom Hire (Line 13)']?.tooltip} irsRef={help?.fields['Custom Hire (Line 13)']?.irsRef}>
            <CurrencyInput value={sf.customHireExpense} onChange={(v) => update('customHireExpense', v)} />
          </FormField>
          <FormField label="Depreciation (Line 14)" optional tooltip={help?.fields['Depreciation (Line 14)']?.tooltip} irsRef={help?.fields['Depreciation (Line 14)']?.irsRef}>
            <CurrencyInput value={sf.depreciation} onChange={(v) => update('depreciation', v)} />
          </FormField>
          <FormField label="Employee Benefits (Line 15)" optional tooltip={help?.fields['Employee Benefits (Line 15)']?.tooltip} irsRef={help?.fields['Employee Benefits (Line 15)']?.irsRef}>
            <CurrencyInput value={sf.employeeBenefit} onChange={(v) => update('employeeBenefit', v)} />
          </FormField>
          <FormField label="Feed (Line 16)" optional tooltip={help?.fields['Feed (Line 16)']?.tooltip} irsRef={help?.fields['Feed (Line 16)']?.irsRef}>
            <CurrencyInput value={sf.feed} onChange={(v) => update('feed', v)} />
          </FormField>
          <FormField label="Fertilizers & Lime (Line 17)" optional tooltip={help?.fields['Fertilizers & Lime (Line 17)']?.tooltip} irsRef={help?.fields['Fertilizers & Lime (Line 17)']?.irsRef}>
            <CurrencyInput value={sf.fertilizers} onChange={(v) => update('fertilizers', v)} />
          </FormField>
          <FormField label="Freight & Trucking (Line 18)" optional tooltip={help?.fields['Freight & Trucking (Line 18)']?.tooltip} irsRef={help?.fields['Freight & Trucking (Line 18)']?.irsRef}>
            <CurrencyInput value={sf.freight} onChange={(v) => update('freight', v)} />
          </FormField>
          <FormField label="Gasoline & Fuel (Line 19)" optional tooltip={help?.fields['Gasoline & Fuel (Line 19)']?.tooltip} irsRef={help?.fields['Gasoline & Fuel (Line 19)']?.irsRef}>
            <CurrencyInput value={sf.gasolineFuel} onChange={(v) => update('gasolineFuel', v)} />
          </FormField>
          <FormField label="Insurance (Line 20)" optional tooltip={help?.fields['Insurance (Line 20)']?.tooltip} irsRef={help?.fields['Insurance (Line 20)']?.irsRef}>
            <CurrencyInput value={sf.insurance} onChange={(v) => update('insurance', v)} />
          </FormField>
          <FormField label="Interest (Line 21)" optional tooltip={help?.fields['Interest (Line 21)']?.tooltip} irsRef={help?.fields['Interest (Line 21)']?.irsRef}>
            <CurrencyInput value={sf.interest} onChange={(v) => update('interest', v)} />
          </FormField>
          <FormField label="Labor Hired (Line 22)" optional tooltip={help?.fields['Labor Hired (Line 22)']?.tooltip} irsRef={help?.fields['Labor Hired (Line 22)']?.irsRef}>
            <CurrencyInput value={sf.labor} onChange={(v) => update('labor', v)} />
          </FormField>
          <FormField label="Pension & Profit-Sharing (Line 23)" optional tooltip={help?.fields['Pension & Profit-Sharing (Line 23)']?.tooltip} irsRef={help?.fields['Pension & Profit-Sharing (Line 23)']?.irsRef}>
            <CurrencyInput value={sf.pension} onChange={(v) => update('pension', v)} />
          </FormField>
          <FormField label="Rent / Lease (Line 24)" optional tooltip={help?.fields['Rent / Lease (Line 24)']?.tooltip} irsRef={help?.fields['Rent / Lease (Line 24)']?.irsRef}>
            <CurrencyInput value={sf.rentLease} onChange={(v) => update('rentLease', v)} />
          </FormField>
          <FormField label="Repairs & Maintenance (Line 25)" optional tooltip={help?.fields['Repairs & Maintenance (Line 25)']?.tooltip} irsRef={help?.fields['Repairs & Maintenance (Line 25)']?.irsRef}>
            <CurrencyInput value={sf.repairs} onChange={(v) => update('repairs', v)} />
          </FormField>
          <FormField label="Seeds & Plants (Line 26)" optional tooltip={help?.fields['Seeds & Plants (Line 26)']?.tooltip} irsRef={help?.fields['Seeds & Plants (Line 26)']?.irsRef}>
            <CurrencyInput value={sf.seeds} onChange={(v) => update('seeds', v)} />
          </FormField>
          <FormField label="Storage & Warehousing (Line 27)" optional tooltip={help?.fields['Storage & Warehousing (Line 27)']?.tooltip} irsRef={help?.fields['Storage & Warehousing (Line 27)']?.irsRef}>
            <CurrencyInput value={sf.storage} onChange={(v) => update('storage', v)} />
          </FormField>
          <FormField label="Supplies (Line 28)" optional tooltip={help?.fields['Supplies (Line 28)']?.tooltip} irsRef={help?.fields['Supplies (Line 28)']?.irsRef}>
            <CurrencyInput value={sf.supplies} onChange={(v) => update('supplies', v)} />
          </FormField>
          <FormField label="Taxes (Line 29)" optional tooltip={help?.fields['Taxes (Line 29)']?.tooltip} irsRef={help?.fields['Taxes (Line 29)']?.irsRef}>
            <CurrencyInput value={sf.taxes} onChange={(v) => update('taxes', v)} />
          </FormField>
          <FormField label="Utilities (Line 30)" optional tooltip={help?.fields['Utilities (Line 30)']?.tooltip} irsRef={help?.fields['Utilities (Line 30)']?.irsRef}>
            <CurrencyInput value={sf.utilities} onChange={(v) => update('utilities', v)} />
          </FormField>
          <FormField label="Veterinary, Breeding, Medicine (Line 31)" optional tooltip={help?.fields['Veterinary, Breeding, Medicine (Line 31)']?.tooltip} irsRef={help?.fields['Veterinary, Breeding, Medicine (Line 31)']?.irsRef}>
            <CurrencyInput value={sf.veterinary} onChange={(v) => update('veterinary', v)} />
          </FormField>
        </div>
        <FormField label="Other Expenses (Line 32)" optional helpText="Specify other farm expenses not listed above" tooltip={help?.fields['Other Expenses (Line 32)']?.tooltip} irsRef={help?.fields['Other Expenses (Line 32)']?.irsRef}>
          <CurrencyInput value={sf.otherExpenses} onChange={(v) => update('otherExpenses', v)} />
        </FormField>
      </div>

      {/* Summary */}
      {(grossIncome > 0 || totalExpenses > 0) && (
        <div className={`rounded-xl border p-6 mt-4 ${netProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-400">Gross Income</p>
              <p className="text-lg font-semibold text-white">${grossIncome.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Expenses</p>
              <p className="text-lg font-semibold text-white">${totalExpenses.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Net Farm {netProfit >= 0 ? 'Profit' : 'Loss'}</p>
              <p className={`text-lg font-semibold ${netProfit >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                ${Math.abs(netProfit).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Farm Optional SE Method — Schedule SE Part II §A */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-3">Self-Employment Tax Election</h3>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="accent-telos-orange-400 mt-0.5"
            checked={!!sf.useFarmOptionalMethod}
            onChange={(e) => update('useFarmOptionalMethod', e.target.checked)}
          />
          <div>
            <span className="text-sm text-slate-300">Use the farm optional method for SE tax (Schedule SE, Part II §A)</span>
            <p className="text-xs text-slate-500 mt-1">
              Reports ⅔ of gross farm income (up to $7,240) as net SE earnings instead of actual net farm profit. Useful for building Social Security credits in low-income or loss years. Eligible when gross farm income ≤ $10,860 or net farm profit &lt; $7,840.
            </p>
          </div>
        </label>
      </div>

      <a
        href="https://www.irs.gov/forms-pubs/about-schedule-f-form-1040"
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
