import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertEnergyEfficiency } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import WhatsNewCard from '../common/WhatsNewCard';
import { Lightbulb, Flame, Home } from 'lucide-react';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';

export default function EnergyEfficiencyStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['energy_efficiency'];

  const info = taxReturn.energyEfficiency || {
    heatPump: 0, centralAC: 0, waterHeater: 0, furnaceBoiler: 0,
    insulation: 0, windows: 0, doors: 0, electricalPanel: 0, homeEnergyAudit: 0,
  };

  const update = (field: string, value: number) => {
    updateField('energyEfficiency', { ...info, [field]: value });
  };

  const save = async () => {
    await upsertEnergyEfficiency(returnId, { ...info });
  };

  // Category A: Heat pump items ($2,000 cap)
  const heatPumpTotal = info.heatPump || 0;
  const heatPumpCredit = Math.min(Math.round(heatPumpTotal * 0.30), 2000);

  // Category B: Non-heat-pump items ($1,200 cap with sub-limits)
  const windowsCredit = Math.min(Math.round((info.windows || 0) * 0.30), 600);
  const doorsCredit = Math.min(Math.round((info.doors || 0) * 0.30), 500);
  const electricalCredit = Math.min(Math.round((info.electricalPanel || 0) * 0.30), 600);
  const auditCredit = Math.min(info.homeEnergyAudit || 0, 150);

  const otherTotal = (info.centralAC || 0) + (info.waterHeater || 0) + (info.furnaceBoiler || 0) + (info.insulation || 0);
  const otherCredit = Math.round(otherTotal * 0.30);
  const nonHPRaw = windowsCredit + doorsCredit + electricalCredit + auditCredit + otherCredit;
  const nonHPCredit = Math.min(nonHPRaw, 1200);

  const estimatedCredit = Math.min(heatPumpCredit + nonHPCredit, 3200);

  return (
    <div>
      <StepWarningsBanner stepId="energy_efficiency" />
      <SectionIntro
        icon={<Lightbulb className="w-8 h-8" />}
        title="Energy Efficient Home Improvement Credit"
        description="A 30% credit for making energy-efficient improvements to your home (Form 5695, Part II)."
      />

      <WhatsNewCard items={[
        { title: 'Credit Terminates After 2025', description: 'Under the One Big Beautiful Bill Act (P.L. 119-21), the energy efficient home improvement credit (Section 25C) is terminated after December 31, 2025. Improvements placed in service during 2025 still qualify.', marker: '⚠' },
      ]} />

      <CalloutCard variant="info" title="About Energy Efficient Home Improvements" irsUrl="https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit">
        This credit is subject to annual limits that reset each year, with an overall aggregate of
        $3,200 per year split between two categories: heat pump and biomass items (up to $2,000/year)
        and all other improvements combined (up to $1,200/year). Within the $1,200 category,
        individual sub-limits apply — windows at $600, exterior doors at $500, electrical panel
        upgrades at $600, and home energy audits at $150. The credit is non-refundable, reducing
        your tax to $0 but not below.
      </CalloutCard>

      <div className="mt-6 space-y-5">
        <p className="text-sm text-slate-400">
          Enter the cost of qualifying home improvements installed during the tax year. The credit is 30% of costs, subject to annual limits per category.
        </p>

        {/* Category A: Heat Pump Items ($2,000 limit) */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Flame className="w-5 h-5 text-telos-blue-400" />
            <h3 className="font-medium text-slate-200">Heat Pump Items (up to $2,000/year)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Heat Pumps / Biomass Stoves" tooltip="Electric or natural gas heat pumps, heat pump water heaters, or biomass stoves/boilers." irsRef={help?.fields['Heat Pumps / Biomass Stoves']?.irsRef}>
              <CurrencyInput value={info.heatPump} onChange={(v) => update('heatPump', v)} />
            </FormField>
          </div>
        </div>

        {/* Category B: Non-Heat-Pump Items ($1,200 limit) */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Home className="w-5 h-5 text-telos-blue-400" />
            <h3 className="font-medium text-slate-200">Other Improvements (up to $1,200/year)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Central Air Conditioning" tooltip="Qualifying central air conditioning systems." irsRef={help?.fields['Central Air Conditioning']?.irsRef}>
              <CurrencyInput value={info.centralAC} onChange={(v) => update('centralAC', v)} />
            </FormField>

            <FormField label="Water Heater" tooltip="Non-heat-pump water heaters (gas, oil, propane)." irsRef={help?.fields['Water Heater']?.irsRef}>
              <CurrencyInput value={info.waterHeater} onChange={(v) => update('waterHeater', v)} />
            </FormField>

            <FormField label="Furnace / Boiler" tooltip="Natural gas, propane, or oil furnaces and hot water boilers." irsRef={help?.fields['Furnace / Boiler']?.irsRef}>
              <CurrencyInput value={info.furnaceBoiler} onChange={(v) => update('furnaceBoiler', v)} />
            </FormField>

            <FormField label="Insulation & Air Sealing" tooltip="Insulation materials, air sealing products, and related installation." irsRef={help?.fields['Insulation & Air Sealing']?.irsRef}>
              <CurrencyInput value={info.insulation} onChange={(v) => update('insulation', v)} />
            </FormField>

            <FormField label="Windows & Skylights" tooltip="Energy Star certified exterior windows and skylights. Credit capped at $600." irsRef={help?.fields['Windows & Skylights']?.irsRef}>
              <CurrencyInput value={info.windows} onChange={(v) => update('windows', v)} />
            </FormField>

            <FormField label="Exterior Doors" tooltip="Energy Star certified exterior doors. Credit capped at $500 ($250 per door)." irsRef={help?.fields['Exterior Doors']?.irsRef}>
              <CurrencyInput value={info.doors} onChange={(v) => update('doors', v)} />
            </FormField>

            <FormField label="Electrical Panel Upgrade" tooltip="Electrical panel upgrade to 200 amps or more (for electrification). Credit capped at $600." irsRef={help?.fields['Electrical Panel Upgrade']?.irsRef}>
              <CurrencyInput value={info.electricalPanel} onChange={(v) => update('electricalPanel', v)} />
            </FormField>

            <FormField label="Home Energy Audit" tooltip="A qualified home energy audit by a certified auditor. Credit capped at $150." irsRef={help?.fields['Home Energy Audit']?.irsRef}>
              <CurrencyInput value={info.homeEnergyAudit} onChange={(v) => update('homeEnergyAudit', v)} />
            </FormField>
          </div>
        </div>

        {estimatedCredit > 0 && (
          <div className="rounded-xl border p-6 bg-telos-orange-500/10 border-telos-orange-500/20">
            <span className="text-telos-orange-300 font-medium">
              Estimated Credit: ${estimatedCredit.toLocaleString()}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              30% of qualifying expenditures (heat pump: ${heatPumpCredit.toLocaleString()}, other: ${nonHPCredit.toLocaleString()})
            </p>
          </div>
        )}

      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
