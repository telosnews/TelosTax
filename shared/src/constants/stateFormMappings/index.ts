/**
 * State Form Mappings — Auto-Aggregating Barrel
 *
 * Central registry of all state form templates. Each new state adds:
 *   1. A re-export line
 *   2. An import line
 *   3. An entry in ALL_STATE_FORM_TEMPLATES
 *   4. An entry in STATE_FORM_REGISTRY
 *
 * Git auto-merges additions at different alphabetical positions,
 * so parallel workers can each add their states without conflicts.
 */
import type { StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Re-exports (one per state mapping file) ────────────────────
export * from './al40Map.js';
export * from './ar1000fMap.js';
export * from './az140Map.js';
export * from './ca540Map.js';
export * from './ca540nrMap.js';
export * from './co104Map.js';
export * from './dcD40Map.js';
export * from './dePitResMap.js';
export * from './ga500Map.js';
export * from './hiN11Map.js';
export * from './ia1040Map.js';
export * from './id40Map.js';
export * from './il1040Map.js';
export * from './inIt40Map.js';
export * from './ksK40Map.js';
export * from './ky740Map.js';
export * from './laIt540Map.js';
export * from './ma1Map.js';
export * from './md502Map.js';
export * from './me1040Map.js';
export * from './mi1040Map.js';
export * from './mnM1Map.js';
export * from './mo1040Map.js';
export * from './ms80105Map.js';
export * from './mtForm2Map.js';
export * from './ncD400Map.js';
export * from './nd1Map.js';
export * from './ne1040nMap.js';
export * from './nj1040Map.js';
export * from './nmPit1Map.js';
export * from './nyIt201Map.js';
export * from './ohIt1040Map.js';
export * from './ok511Map.js';
export * from './or40Map.js';
export * from './pa40Map.js';
export * from './ri1040Map.js';
export * from './sc1040Map.js';
export * from './utTc40Map.js';
export * from './va760Map.js';
export * from './vtIn111Map.js';
export * from './wiForm1Map.js';
export * from './wvIt140Map.js';

// ─── Imports for registry ───────────────────────────────────────
import { AL_40_TEMPLATE } from './al40Map.js';
import { AR_1000F_TEMPLATE } from './ar1000fMap.js';
import { AZ_140_TEMPLATE } from './az140Map.js';
import { CA_540_TEMPLATE } from './ca540Map.js';
import { CA_540NR_TEMPLATE } from './ca540nrMap.js';
import { CO_104_TEMPLATE } from './co104Map.js';
import { DC_D40_TEMPLATE } from './dcD40Map.js';
import { DE_PIT_RES_TEMPLATE } from './dePitResMap.js';
import { GA_500_TEMPLATE } from './ga500Map.js';
import { HI_N11_TEMPLATE } from './hiN11Map.js';
import { IA_1040_TEMPLATE } from './ia1040Map.js';
import { ID_40_TEMPLATE } from './id40Map.js';
import { IL_1040_TEMPLATE } from './il1040Map.js';
import { IN_IT40_TEMPLATE } from './inIt40Map.js';
import { KS_K40_TEMPLATE } from './ksK40Map.js';
import { KY_740_TEMPLATE } from './ky740Map.js';
import { LA_IT540_TEMPLATE } from './laIt540Map.js';
import { MA_1_TEMPLATE } from './ma1Map.js';
import { MD_502_TEMPLATE } from './md502Map.js';
import { ME_1040_TEMPLATE } from './me1040Map.js';
import { MI_1040_TEMPLATE } from './mi1040Map.js';
import { MN_M1_TEMPLATE } from './mnM1Map.js';
import { MO_1040_TEMPLATE } from './mo1040Map.js';
import { MS_80105_TEMPLATE } from './ms80105Map.js';
import { MT_FORM2_TEMPLATE } from './mtForm2Map.js';
import { NC_D400_TEMPLATE } from './ncD400Map.js';
import { ND_1_TEMPLATE } from './nd1Map.js';
import { NE_1040N_TEMPLATE } from './ne1040nMap.js';
import { NJ_1040_TEMPLATE } from './nj1040Map.js';
import { NM_PIT1_TEMPLATE } from './nmPit1Map.js';
import { NY_IT201_TEMPLATE } from './nyIt201Map.js';
import { OH_IT1040_TEMPLATE } from './ohIt1040Map.js';
import { OK_511_TEMPLATE } from './ok511Map.js';
import { OR_40_TEMPLATE } from './or40Map.js';
import { PA_40_TEMPLATE } from './pa40Map.js';
import { RI_1040_TEMPLATE } from './ri1040Map.js';
import { SC_1040_TEMPLATE } from './sc1040Map.js';
import { UT_TC40_TEMPLATE } from './utTc40Map.js';
import { VA_760_TEMPLATE } from './va760Map.js';
import { VT_IN111_TEMPLATE } from './vtIn111Map.js';
import { WI_FORM1_TEMPLATE } from './wiForm1Map.js';
import { WV_IT140_TEMPLATE } from './wvIt140Map.js';

// ─── Master list (all templates, flat) ──────────────────────────
export const ALL_STATE_FORM_TEMPLATES: StateFormTemplate[] = [
  AL_40_TEMPLATE,
  AR_1000F_TEMPLATE,
  AZ_140_TEMPLATE,
  CA_540_TEMPLATE,
  CA_540NR_TEMPLATE,
  CO_104_TEMPLATE,
  DC_D40_TEMPLATE,
  DE_PIT_RES_TEMPLATE,
  GA_500_TEMPLATE,
  HI_N11_TEMPLATE,
  IA_1040_TEMPLATE,
  ID_40_TEMPLATE,
  IL_1040_TEMPLATE,
  IN_IT40_TEMPLATE,
  KS_K40_TEMPLATE,
  KY_740_TEMPLATE,
  LA_IT540_TEMPLATE,
  MA_1_TEMPLATE,
  MD_502_TEMPLATE,
  ME_1040_TEMPLATE,
  MI_1040_TEMPLATE,
  MN_M1_TEMPLATE,
  MO_1040_TEMPLATE,
  MS_80105_TEMPLATE,
  MT_FORM2_TEMPLATE,
  NC_D400_TEMPLATE,
  ND_1_TEMPLATE,
  NE_1040N_TEMPLATE,
  NJ_1040_TEMPLATE,
  NM_PIT1_TEMPLATE,
  NY_IT201_TEMPLATE,
  OH_IT1040_TEMPLATE,
  OK_511_TEMPLATE,
  OR_40_TEMPLATE,
  PA_40_TEMPLATE,
  RI_1040_TEMPLATE,
  SC_1040_TEMPLATE,
  UT_TC40_TEMPLATE,
  VA_760_TEMPLATE,
  VT_IN111_TEMPLATE,
  WI_FORM1_TEMPLATE,
  WV_IT140_TEMPLATE,
];

// ─── Registry keyed by state code ───────────────────────────────
export const STATE_FORM_REGISTRY: Record<string, StateFormTemplate[]> = {
  AL: [AL_40_TEMPLATE],
  AR: [AR_1000F_TEMPLATE],
  AZ: [AZ_140_TEMPLATE],
  CA: [CA_540_TEMPLATE, CA_540NR_TEMPLATE],
  CO: [CO_104_TEMPLATE],
  DC: [DC_D40_TEMPLATE],
  DE: [DE_PIT_RES_TEMPLATE],
  GA: [GA_500_TEMPLATE],
  HI: [HI_N11_TEMPLATE],
  IA: [IA_1040_TEMPLATE],
  ID: [ID_40_TEMPLATE],
  IL: [IL_1040_TEMPLATE],
  IN: [IN_IT40_TEMPLATE],
  KS: [KS_K40_TEMPLATE],
  KY: [KY_740_TEMPLATE],
  LA: [LA_IT540_TEMPLATE],
  MA: [MA_1_TEMPLATE],
  MD: [MD_502_TEMPLATE],
  ME: [ME_1040_TEMPLATE],
  MI: [MI_1040_TEMPLATE],
  MN: [MN_M1_TEMPLATE],
  MO: [MO_1040_TEMPLATE],
  MS: [MS_80105_TEMPLATE],
  MT: [MT_FORM2_TEMPLATE],
  NC: [NC_D400_TEMPLATE],
  ND: [ND_1_TEMPLATE],
  NE: [NE_1040N_TEMPLATE],
  NJ: [NJ_1040_TEMPLATE],
  NM: [NM_PIT1_TEMPLATE],
  NY: [NY_IT201_TEMPLATE],
  OH: [OH_IT1040_TEMPLATE],
  OK: [OK_511_TEMPLATE],
  OR: [OR_40_TEMPLATE],
  PA: [PA_40_TEMPLATE],
  RI: [RI_1040_TEMPLATE],
  SC: [SC_1040_TEMPLATE],
  UT: [UT_TC40_TEMPLATE],
  VA: [VA_760_TEMPLATE],
  VT: [VT_IN111_TEMPLATE],
  WI: [WI_FORM1_TEMPLATE],
  WV: [WV_IT140_TEMPLATE],
};
