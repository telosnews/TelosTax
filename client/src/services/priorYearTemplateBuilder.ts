/**
 * Prior Year Template Builder
 *
 * Extracts individual income items from a prior-year TaxReturn and creates
 * zero-amount "template" items preserving payer/employer names. Users select
 * which items to import, and the builder creates current-year placeholders
 * so they don't have to re-type the same payer names every year.
 *
 * Only works with JSON imports (which contain full TaxReturn data).
 * PDF imports only have summary numbers — no individual items to template.
 *
 * Intentionally excludes:
 * - 1099-B / 1099-DA individual transactions (trade-specific, not recurring)
 * - SSA-1099 (single global entry, not per-payer)
 * - W-2G (gambling winnings are not recurring)
 */

import type { TaxReturn } from '@telostax/engine';

// ─── Types ─────────────────────────────────────────

export interface TemplateItem {
  /** Income type key: 'w2', '1099int', '1099div', etc. */
  type: string;
  /** Display label: "Acme Corp (W-2)" */
  label: string;
  /** Human-friendly type label: "W-2", "1099-INT", etc. */
  typeLabel: string;
  /** Original payer/employer name */
  payerName: string;
  /** Zero-amount data ready for import (names preserved, amounts zeroed) */
  templateData: Record<string, unknown>;
  /** Whether the user wants to import this item (default: true) */
  selected: boolean;
}

export interface TemplateImportManifest {
  /** All template items */
  items: TemplateItem[];
  /** Items grouped by income type */
  byType: Record<string, TemplateItem[]>;
  /** Total number of template items */
  totalCount: number;
  /** Source tax year */
  sourceYear: number;
  /** Schedule C businesses (separate from income items) */
  businesses: BusinessTemplate[];
}

export interface BusinessTemplate {
  /** Display name */
  label: string;
  /** Template data for creating a new BusinessInfo */
  templateData: Record<string, unknown>;
  /** Whether selected for import */
  selected: boolean;
}

// ─── Type label map ────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  w2: 'W-2',
  '1099int': '1099-INT',
  '1099div': '1099-DIV',
  '1099r': '1099-R',
  '1099nec': '1099-NEC',
  '1099misc': '1099-MISC',
  '1099g': '1099-G',
  '1099k': '1099-K',
  '1099sa': '1099-SA',
  '1099q': '1099-Q',
};

// ─── Builder ───────────────────────────────────────

export function buildTemplateItems(priorReturn: TaxReturn): TemplateImportManifest {
  const items: TemplateItem[] = [];
  const businesses: BusinessTemplate[] = [];

  // ── W-2s ──
  for (const w2 of priorReturn.w2Income ?? []) {
    const name = w2.employerName || 'Unknown employer';
    items.push({
      type: 'w2',
      label: `${name} (W-2)`,
      typeLabel: 'W-2',
      payerName: name,
      templateData: {
        employerName: name,
        employerEin: w2.employerEin || '',
        wages: 0,
        federalTaxWithheld: 0,
        socialSecurityWages: w2.socialSecurityWages !== undefined ? 0 : undefined,
        socialSecurityTax: w2.socialSecurityTax !== undefined ? 0 : undefined,
        medicareWages: w2.medicareWages !== undefined ? 0 : undefined,
        medicareTax: w2.medicareTax !== undefined ? 0 : undefined,
        stateTaxWithheld: w2.stateTaxWithheld !== undefined ? 0 : undefined,
        stateWages: w2.stateWages !== undefined ? 0 : undefined,
        state: w2.state || undefined,
      },
      selected: true,
    });
  }

  // ── 1099-INT ──
  for (const item of priorReturn.income1099INT ?? []) {
    const name = item.payerName || 'Unknown payer';
    items.push({
      type: '1099int',
      label: `${name} (1099-INT)`,
      typeLabel: '1099-INT',
      payerName: name,
      templateData: {
        payerName: name,
        amount: 0,
        federalTaxWithheld: 0,
        taxExemptInterest: item.taxExemptInterest !== undefined ? 0 : undefined,
        usBondInterest: item.usBondInterest !== undefined ? 0 : undefined,
        earlyWithdrawalPenalty: item.earlyWithdrawalPenalty !== undefined ? 0 : undefined,
      },
      selected: true,
    });
  }

  // ── 1099-DIV ──
  for (const item of priorReturn.income1099DIV ?? []) {
    const name = item.payerName || 'Unknown payer';
    items.push({
      type: '1099div',
      label: `${name} (1099-DIV)`,
      typeLabel: '1099-DIV',
      payerName: name,
      templateData: {
        payerName: name,
        ordinaryDividends: 0,
        qualifiedDividends: 0,
        federalTaxWithheld: 0,
        capitalGainDistributions: item.capitalGainDistributions !== undefined ? 0 : undefined,
        foreignTaxPaid: item.foreignTaxPaid !== undefined ? 0 : undefined,
      },
      selected: true,
    });
  }

  // ── 1099-R ──
  for (const item of priorReturn.income1099R ?? []) {
    const name = item.payerName || 'Unknown payer';
    items.push({
      type: '1099r',
      label: `${name} (1099-R)`,
      typeLabel: '1099-R',
      payerName: name,
      templateData: {
        payerName: name,
        grossDistribution: 0,
        taxableAmount: 0,
        federalTaxWithheld: 0,
        distributionCode: item.distributionCode || '',
        isIRA: item.isIRA ?? false,
      },
      selected: true,
    });
  }

  // ── 1099-NEC ──
  for (const item of priorReturn.income1099NEC ?? []) {
    const name = item.payerName || 'Unknown payer';
    items.push({
      type: '1099nec',
      label: `${name} (1099-NEC)`,
      typeLabel: '1099-NEC',
      payerName: name,
      templateData: {
        payerName: name,
        payerEin: item.payerEin || '',
        amount: 0,
        federalTaxWithheld: 0,
        businessId: item.businessId || undefined,
      },
      selected: true,
    });
  }

  // ── 1099-MISC ──
  for (const item of priorReturn.income1099MISC ?? []) {
    const name = item.payerName || 'Unknown payer';
    items.push({
      type: '1099misc',
      label: `${name} (1099-MISC)`,
      typeLabel: '1099-MISC',
      payerName: name,
      templateData: {
        payerName: name,
        rents: item.rents !== undefined ? 0 : undefined,
        royalties: item.royalties !== undefined ? 0 : undefined,
        otherIncome: item.otherIncome !== undefined ? 0 : undefined,
        federalTaxWithheld: 0,
        stateTaxWithheld: item.stateTaxWithheld !== undefined ? 0 : undefined,
      },
      selected: true,
    });
  }

  // ── 1099-G ──
  for (const item of priorReturn.income1099G ?? []) {
    const name = item.payerName || 'Unknown payer';
    items.push({
      type: '1099g',
      label: `${name} (1099-G)`,
      typeLabel: '1099-G',
      payerName: name,
      templateData: {
        payerName: name,
        unemploymentCompensation: 0,
        federalTaxWithheld: 0,
      },
      selected: true,
    });
  }

  // ── 1099-K ──
  for (const item of priorReturn.income1099K ?? []) {
    const name = item.platformName || 'Unknown platform';
    items.push({
      type: '1099k',
      label: `${name} (1099-K)`,
      typeLabel: '1099-K',
      payerName: name,
      templateData: {
        platformName: name,
        grossAmount: 0,
        federalTaxWithheld: 0,
        businessId: item.businessId || undefined,
      },
      selected: true,
    });
  }

  // ── 1099-SA ──
  for (const item of priorReturn.income1099SA ?? []) {
    const name = item.payerName || 'Unknown trustee';
    items.push({
      type: '1099sa',
      label: `${name} (1099-SA)`,
      typeLabel: '1099-SA',
      payerName: name,
      templateData: {
        payerName: name,
        grossDistribution: 0,
        distributionCode: item.distributionCode || '',
        federalTaxWithheld: 0,
      },
      selected: true,
    });
  }

  // ── 1099-Q ──
  for (const item of priorReturn.income1099Q ?? []) {
    const name = item.payerName || 'Unknown plan';
    items.push({
      type: '1099q',
      label: `${name} (1099-Q)`,
      typeLabel: '1099-Q',
      payerName: name,
      templateData: {
        payerName: name,
        grossDistribution: 0,
        earnings: 0,
        basisReturn: 0,
        qualifiedExpenses: 0,
        distributionType: item.distributionType || 'qualified',
      },
      selected: true,
    });
  }

  // ── Schedule C Businesses ──
  const allBusinesses = [
    ...(priorReturn.businesses ?? []),
    ...(priorReturn.business ? [priorReturn.business] : []),
  ];

  // Deduplicate by business name (legacy single + new array may overlap)
  const seenNames = new Set<string>();
  for (const biz of allBusinesses) {
    const name = biz.businessName || 'Unnamed Business';
    const key = name.toLowerCase().trim();
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    businesses.push({
      label: name,
      templateData: {
        businessName: name,
        businessEin: biz.businessEin || '',
        principalBusinessCode: biz.principalBusinessCode || '',
        businessDescription: biz.businessDescription || '',
        accountingMethod: biz.accountingMethod || 'cash',
        didStartThisYear: false,
      },
      selected: true,
    });
  }

  // ── Group by type ──
  const byType: Record<string, TemplateItem[]> = {};
  for (const item of items) {
    if (!byType[item.type]) byType[item.type] = [];
    byType[item.type].push(item);
  }

  return {
    items,
    byType,
    totalCount: items.length,
    sourceYear: priorReturn.taxYear,
    businesses,
  };
}

/**
 * Returns human-readable type label for display.
 * e.g., '1099int' → '1099-INT'
 */
export function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] || type.toUpperCase();
}
