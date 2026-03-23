import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertCleanEnergy } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import WhatsNewCard from '../common/WhatsNewCard';
import { Zap } from 'lucide-react';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';

export default function CleanEnergyStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['clean_energy'];

  const info = taxReturn.cleanEnergy || {
    solarElectric: 0, solarWaterHeating: 0, smallWindEnergy: 0,
    geothermalHeatPump: 0, batteryStorage: 0, fuelCell: 0, fuelCellKW: 0,
    priorYearCarryforward: 0,
  };

  const update = (field: string, value: number) => {
    updateField('cleanEnergy', { ...info, [field]: value });
  };

  const save = async () => {
    await upsertCleanEnergy(returnId, { ...info });
  };

  const totalExpenses =
    (info.solarElectric || 0) + (info.solarWaterHeating || 0) + (info.smallWindEnergy || 0) +
    (info.geothermalHeatPump || 0) + (info.batteryStorage || 0) + (info.fuelCell || 0);
  const estimatedCredit = Math.round(totalExpenses * 0.30);

  return (
    <div>
      <StepWarningsBanner stepId="clean_energy" />
      <SectionIntro
        icon={<Zap className="w-8 h-8" />}
        title="Residential Clean Energy Credit"
        description="A 30% credit for installing qualified clean energy systems in your home (Form 5695, Part I)."
      />

      <WhatsNewCard items={[
        { title: 'Residential Clean Energy Credits Ending', description: 'Under the One Big Beautiful Bill Act (P.L. 119-21), the residential clean energy credit (Section 25D) is being terminated. Systems placed in service after December 31, 2025 will no longer qualify.', marker: '⚠' },
        { title: '2025 Installations Still Qualify', description: 'If your clean energy system was placed in service during 2025, you still receive the full 30% credit. The termination affects future years only.' },
        { title: 'EV Credits Also Affected', description: 'The clean vehicle credit (Section 30D) for new EVs terminates for vehicles placed in service after September 30, 2025. Previously-owned EV credits (Section 25E) end after December 31, 2025.', marker: '⚠' },
        { title: 'Home Energy Efficiency Credits', description: 'The energy efficient home improvement credit (Section 25C) for items like heat pumps and insulation is also terminated after December 31, 2025.' },
      ]} />

      <CalloutCard variant="info" title="About Residential Clean Energy" irsUrl="https://www.irs.gov/credits-deductions/residential-clean-energy-credit">
        The residential clean energy credit provides a 30% credit for qualifying clean energy
        systems installed in your primary or secondary U.S. residence, with the rate applying
        through tax year 2032. There is no maximum credit for solar, wind, geothermal, or battery
        storage systems — only fuel cell property is capped at $500 per 0.5 kW of capacity. This
        is a non-refundable credit, meaning it can reduce your tax to $0 but not below. Any unused
        credit carries forward to future years.
      </CalloutCard>

      <div className="mt-6 space-y-4">
        <p className="text-sm text-slate-400">
          Enter the cost of any qualifying clean energy improvements made to your primary or secondary home during the tax year. Leave at $0 for categories that don't apply.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Solar Electric (PV)" tooltip="Cost of solar photovoltaic panels and installation. No maximum." irsRef={help?.fields['Solar Electric (PV)']?.irsRef}>
            <CurrencyInput value={info.solarElectric} onChange={(v) => update('solarElectric', v)} />
          </FormField>

          <FormField label="Solar Water Heating" tooltip="Cost of solar water heating systems used for the dwelling (not for pools/hot tubs)." irsRef={help?.fields['Solar Water Heating']?.irsRef}>
            <CurrencyInput value={info.solarWaterHeating} onChange={(v) => update('solarWaterHeating', v)} />
          </FormField>

          <FormField label="Small Wind Energy" tooltip="Cost of small wind energy turbine systems. No maximum." irsRef={help?.fields['Small Wind Energy']?.irsRef}>
            <CurrencyInput value={info.smallWindEnergy} onChange={(v) => update('smallWindEnergy', v)} />
          </FormField>

          <FormField label="Geothermal Heat Pump" tooltip="Cost of geothermal heat pump systems. No maximum." irsRef={help?.fields['Geothermal Heat Pump']?.irsRef}>
            <CurrencyInput value={info.geothermalHeatPump} onChange={(v) => update('geothermalHeatPump', v)} />
          </FormField>

          <FormField label="Battery Storage" tooltip="Cost of battery/energy storage technology with capacity of 3 kWh or greater." irsRef={help?.fields['Battery Storage']?.irsRef}>
            <CurrencyInput value={info.batteryStorage} onChange={(v) => update('batteryStorage', v)} />
          </FormField>

          <FormField label="Fuel Cell" tooltip="Cost of qualified fuel cell property. Credit capped at $500 per 0.5 kW of capacity." irsRef={help?.fields['Fuel Cell']?.irsRef}>
            <CurrencyInput value={info.fuelCell} onChange={(v) => update('fuelCell', v)} />
          </FormField>

          <FormField label="Prior Year Unused Credit (Form 5695 Line 16)" tooltip="Residential energy credit from your prior year return that you were unable to use due to tax liability limits." optional>
            <CurrencyInput value={info.priorYearCarryforward} onChange={(v) => update('priorYearCarryforward', v)} />
          </FormField>
        </div>

        {(info.fuelCell || 0) > 0 && (
          <FormField label="Fuel Cell Capacity (kW)" tooltip="The capacity in kilowatts of the fuel cell system. Used to calculate the $500/0.5kW cap." irsRef={help?.fields['Fuel Cell Capacity (kW)']?.irsRef}>
            <input
              type="number"
              className="input-field w-32"
              step="0.5"
              min="0"
              value={info.fuelCellKW || ''}
              onChange={(e) => update('fuelCellKW', parseFloat(e.target.value) || 0)}
              placeholder="e.g. 5.0"
            />
          </FormField>
        )}

        {totalExpenses > 0 && (
          <div className="rounded-xl border p-6 bg-telos-orange-500/10 border-telos-orange-500/20">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-telos-orange-300 font-medium">
                  Estimated Credit: ${estimatedCredit.toLocaleString()}
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  30% of ${totalExpenses.toLocaleString()} in qualifying expenditures
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
