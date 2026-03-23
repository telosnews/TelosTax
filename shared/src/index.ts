export * from './types/index.js';
export * from './constants/tax2025.js';
export * from './engine/utils.js';
export * from './engine/brackets.js';
export * from './engine/scheduleC.js';
export * from './engine/scheduleSE.js';
export * from './engine/scheduleA.js';
export * from './engine/credits.js';
export * from './engine/qbi.js';
export * from './engine/homeOffice.js';
export * from './engine/vehicle.js';
export * from './engine/estimatedTax.js';
export * from './engine/estimatedTaxVoucher.js';
export * from './engine/capitalGains.js';
export * from './engine/niit.js';
export * from './engine/additionalMedicare.js';
export * from './engine/scheduleD.js';
export * from './engine/socialSecurity.js';
export * from './engine/scheduleE.js';
export * from './engine/dependentCare.js';
export * from './engine/saversCredit.js';
export * from './engine/cleanEnergy.js';
export * from './engine/k1.js';
export * from './engine/hsaDistributions.js';
export * from './engine/foreignTaxCredit.js';
export * from './engine/evCredit.js';
export * from './engine/energyEfficiency.js';
export * from './engine/hsaForm8889.js';
export * from './engine/form8606.js';
export * from './engine/estimatedTaxPenalty.js';
export * from './engine/kiddieTax.js';
export * from './engine/feie.js';
export * from './engine/scheduleH.js';
export * from './engine/adoptionCredit.js';
export * from './engine/premiumTaxCredit.js';
export * from './engine/schedule1A.js';
export * from './engine/homeSale.js';
export * from './engine/cancellationOfDebt.js';
export * from './engine/investmentInterest.js';
export * from './engine/form5329.js';
export * from './engine/form8911.js';
export * from './engine/form4562.js';
export * from './engine/form4797.js';
export * from './engine/form4684.js';
export * from './engine/form4835.js';
export * from './engine/form6252.js';
export * from './engine/form4137.js';
export * from './engine/scheduleF.js';
export * from './engine/scheduleR.js';
export * from './engine/form8801.js';
export * from './engine/archerMSA.js';
export * from './engine/filingStatusValidation.js';
export * from './engine/deceasedSpouse.js';
export * from './engine/solo401k.js';
export * from './engine/form7206.js';
export * from './engine/form1040.js';

// AMT (Form 6251)
export * from './engine/amt.js';
export * from './constants/amt2025.js';

// State tax engine
export * from './engine/state/index.js';
export * from './engine/state/stateRegistry.js';

// Chat types (AI assistant)
export * from './types/chat.js';

// AI settings types (three-tier AI mode system)
export * from './types/aiSettings.js';

// LLM response parser (shared between server and client LocalTransport)
export * from './utils/llmResponseParser.js';

// PII scanner (client primary gate + server defense-in-depth)
export * from './utils/piiScanner.js';

// IRS fillable PDF form mappings
export * from './types/irsFormMappings.js';
export * from './types/stateFormMappings.js';
export * from './constants/stateFormMappings/index.js';
export * from './constants/irsForm1040Map.js';
export * from './constants/irsSchedule1Map.js';
export * from './constants/irsSchedule2Map.js';
export * from './constants/irsSchedule3Map.js';
export * from './constants/irsScheduleCMap.js';
export * from './constants/irsScheduleDMap.js';
export * from './constants/irsScheduleSEMap.js';
export * from './constants/irsForm8949Map.js';
export * from './constants/irsScheduleEMap.js';
export * from './constants/irsForm8962Map.js';
export * from './constants/irsForm5695Map.js';
export * from './constants/irsForm8936Map.js';
export * from './constants/irsScheduleAMap.js';
export * from './constants/irsScheduleBMap.js';
export * from './constants/irsForm4562Map.js';
export * from './constants/irsForm7206Map.js';
export * from './constants/irsForm1040VMap.js';
export * from './constants/irsScheduleFMap.js';
export * from './constants/irsScheduleHMap.js';
export * from './constants/irsScheduleRMap.js';
export * from './constants/irsForm6251Map.js';
export * from './constants/irsForm4797Map.js';
export * from './constants/irsForm5329Map.js';
export * from './constants/irsForm8606Map.js';
export * from './constants/irsForm4137Map.js';
export * from './constants/irsForm8283Map.js';
export * from './constants/irsForm8911Map.js';
export * from './constants/irsForm8863Map.js';
export * from './constants/irsForm8889Map.js';
export * from './constants/irsForm8582Map.js';
export * from './constants/irsForm2210Map.js';
export * from './constants/irsForm4952Map.js';
export * from './constants/irsForm8615Map.js';
export * from './constants/irsForm8839Map.js';
export * from './constants/irsForm2555Map.js';
export * from './constants/irsForm3903Map.js';
export * from './constants/irsForm982Map.js';
export * from './constants/irsMailingAddresses.js';
export * from './constants/estimatedTaxMailingAddresses.js';
export * from './constants/stateMailingAddresses.js';
export * from './constants/filingInstructions.js';
export * from './constants/irsForm1040ESMap.js';
export * from './constants/irsForm4868Map.js';
export * from './constants/irsForm5500EZMap.js';

// Forms Mode — field editability classifier
export * from './engine/formFieldClassifier.js';

// NAICS business code lookup (Schedule C Line B + SSTB auto-detection)
export * from './constants/naicsCodes.js';

// Donation valuation tool (charitable contribution FMV lookup + depreciation)
export * from './constants/donationValuationDb.js';
export * from './engine/donationValuation.js';

// Filing options service (eligibility + Transfer Guide)
export * from './services/filingOptionsService.js';

// Dynamic IRS reference data for AI chat
export * from './services/buildIrsReferenceData.js';

// Calculation trace engine (inspired by IRS Direct File Fact Graph)
export * from './engine/traceBuilder.js';
export * from './engine/plausibility.js';

// SSN utilities
export * from './utils/ssn.js';

// Schema migration system
export * from './migrations/index.js';

// Declarative wizard conditions (inspired by Direct File's condition-driven flow)
export * from './wizard/conditionTypes.js';
export * from './wizard/conditionEvaluator.js';
