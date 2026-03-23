import { describe, it, expect } from 'vitest';
import { buildTemplateItems, getTypeLabel } from '../services/priorYearTemplateBuilder';
import type { TaxReturn } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';

// ─── Minimal TaxReturn factory ─────────────────────

function minimalReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return-001',
    taxYear: 2024,
    schemaVersion: 1,
    filingStatus: FilingStatus.Single,
    firstName: 'Test',
    lastName: 'User',
    dependents: [],
    w2Income: [],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    rentalProperties: [],
    otherIncome: 0,
    businesses: [],
    expenses: [],
    incomeDiscovery: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as TaxReturn;
}

// ─── Tests ─────────────────────────────────────────

describe('buildTemplateItems', () => {
  it('returns empty manifest for a return with no income items', () => {
    const result = buildTemplateItems(minimalReturn());

    expect(result.totalCount).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.byType).toEqual({});
    expect(result.businesses).toEqual([]);
    expect(result.sourceYear).toBe(2024);
  });

  it('extracts W-2 templates with zeroed amounts and preserved names', () => {
    const result = buildTemplateItems(minimalReturn({
      w2Income: [
        {
          id: 'w2-1',
          employerName: 'Acme Corp',
          employerEin: '12-3456789',
          wages: 85000,
          federalTaxWithheld: 15000,
          socialSecurityWages: 85000,
          socialSecurityTax: 5270,
          medicareWages: 85000,
          medicareTax: 1232.50,
          stateTaxWithheld: 4000,
          stateWages: 85000,
          state: 'CA',
        },
      ],
    }));

    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);

    const tpl = result.items[0];
    expect(tpl.type).toBe('w2');
    expect(tpl.label).toBe('Acme Corp (W-2)');
    expect(tpl.typeLabel).toBe('W-2');
    expect(tpl.payerName).toBe('Acme Corp');
    expect(tpl.selected).toBe(true);

    // Amounts zeroed
    expect(tpl.templateData.wages).toBe(0);
    expect(tpl.templateData.federalTaxWithheld).toBe(0);
    expect(tpl.templateData.socialSecurityWages).toBe(0);
    expect(tpl.templateData.socialSecurityTax).toBe(0);
    expect(tpl.templateData.medicareWages).toBe(0);
    expect(tpl.templateData.medicareTax).toBe(0);
    expect(tpl.templateData.stateTaxWithheld).toBe(0);
    expect(tpl.templateData.stateWages).toBe(0);

    // Names/identifiers preserved
    expect(tpl.templateData.employerName).toBe('Acme Corp');
    expect(tpl.templateData.employerEin).toBe('12-3456789');
    expect(tpl.templateData.state).toBe('CA');
  });

  it('omits optional W-2 fields when not present in original', () => {
    const result = buildTemplateItems(minimalReturn({
      w2Income: [
        { id: 'w2-1', employerName: 'Simple Co', wages: 50000, federalTaxWithheld: 8000 },
      ],
    }));

    const tpl = result.items[0];
    // socialSecurityWages was undefined on original → should be undefined on template
    expect(tpl.templateData.socialSecurityWages).toBeUndefined();
    expect(tpl.templateData.socialSecurityTax).toBeUndefined();
    expect(tpl.templateData.medicareWages).toBeUndefined();
    expect(tpl.templateData.medicareTax).toBeUndefined();
    expect(tpl.templateData.stateTaxWithheld).toBeUndefined();
    expect(tpl.templateData.stateWages).toBeUndefined();
    expect(tpl.templateData.state).toBeUndefined();
  });

  it('extracts 1099-INT templates', () => {
    const result = buildTemplateItems(minimalReturn({
      income1099INT: [
        { id: 'int-1', payerName: 'Chase Bank', amount: 245.50, federalTaxWithheld: 0 },
        { id: 'int-2', payerName: 'Ally Savings', amount: 890, federalTaxWithheld: 0 },
      ],
    }));

    expect(result.totalCount).toBe(2);
    expect(result.byType['1099int']).toHaveLength(2);

    expect(result.items[0].payerName).toBe('Chase Bank');
    expect(result.items[0].templateData.amount).toBe(0);
    expect(result.items[0].templateData.payerName).toBe('Chase Bank');

    expect(result.items[1].payerName).toBe('Ally Savings');
    expect(result.items[1].templateData.amount).toBe(0);
  });

  it('extracts 1099-DIV templates', () => {
    const result = buildTemplateItems(minimalReturn({
      income1099DIV: [
        { id: 'div-1', payerName: 'Vanguard', ordinaryDividends: 1200, qualifiedDividends: 800 },
      ],
    }));

    const tpl = result.items[0];
    expect(tpl.type).toBe('1099div');
    expect(tpl.label).toBe('Vanguard (1099-DIV)');
    expect(tpl.templateData.ordinaryDividends).toBe(0);
    expect(tpl.templateData.qualifiedDividends).toBe(0);
    expect(tpl.templateData.payerName).toBe('Vanguard');
  });

  it('extracts 1099-R templates preserving distributionCode and isIRA', () => {
    const result = buildTemplateItems(minimalReturn({
      income1099R: [
        {
          id: 'r-1',
          payerName: 'Fidelity 401k',
          grossDistribution: 5000,
          taxableAmount: 5000,
          distributionCode: '1',
          isIRA: false,
        },
      ],
    }));

    const tpl = result.items[0];
    expect(tpl.type).toBe('1099r');
    expect(tpl.templateData.grossDistribution).toBe(0);
    expect(tpl.templateData.taxableAmount).toBe(0);
    expect(tpl.templateData.distributionCode).toBe('1');
    expect(tpl.templateData.isIRA).toBe(false);
    expect(tpl.templateData.payerName).toBe('Fidelity 401k');
  });

  it('extracts 1099-NEC templates preserving businessId', () => {
    const result = buildTemplateItems(minimalReturn({
      income1099NEC: [
        {
          id: 'nec-1',
          payerName: 'Freelance Client LLC',
          payerEin: '98-7654321',
          amount: 12000,
          businessId: 'biz-1',
        },
      ],
    }));

    const tpl = result.items[0];
    expect(tpl.type).toBe('1099nec');
    expect(tpl.templateData.amount).toBe(0);
    expect(tpl.templateData.payerName).toBe('Freelance Client LLC');
    expect(tpl.templateData.payerEin).toBe('98-7654321');
    expect(tpl.templateData.businessId).toBe('biz-1');
  });

  it('extracts 1099-MISC templates preserving rent/royalty structure', () => {
    const result = buildTemplateItems(minimalReturn({
      income1099MISC: [
        { id: 'misc-1', payerName: 'Property Mgmt', rents: 24000, otherIncome: 0 },
        { id: 'misc-2', payerName: 'Publisher', royalties: 5000, otherIncome: 500 },
      ],
    }));

    expect(result.totalCount).toBe(2);

    // First has rents → template preserves rents field (zeroed)
    expect(result.items[0].templateData.rents).toBe(0);
    expect(result.items[0].templateData.royalties).toBeUndefined();

    // Second has royalties → template preserves royalties field (zeroed)
    expect(result.items[1].templateData.royalties).toBe(0);
  });

  it('extracts 1099-G templates', () => {
    const result = buildTemplateItems(minimalReturn({
      income1099G: [
        { id: 'g-1', payerName: 'State of California', unemploymentCompensation: 8400 },
      ],
    }));

    const tpl = result.items[0];
    expect(tpl.type).toBe('1099g');
    expect(tpl.templateData.unemploymentCompensation).toBe(0);
    expect(tpl.templateData.payerName).toBe('State of California');
  });

  it('extracts 1099-K templates preserving businessId', () => {
    const result = buildTemplateItems(minimalReturn({
      income1099K: [
        { id: 'k-1', platformName: 'Stripe', grossAmount: 45000, businessId: 'biz-1' },
      ],
    }));

    const tpl = result.items[0];
    expect(tpl.type).toBe('1099k');
    expect(tpl.templateData.grossAmount).toBe(0);
    expect(tpl.templateData.platformName).toBe('Stripe');
    expect(tpl.templateData.businessId).toBe('biz-1');
  });

  it('extracts 1099-SA templates preserving distributionCode', () => {
    const result = buildTemplateItems(minimalReturn({
      income1099SA: [
        { id: 'sa-1', payerName: 'HSA Bank', grossDistribution: 1200, distributionCode: '1' },
      ],
    }));

    const tpl = result.items[0];
    expect(tpl.type).toBe('1099sa');
    expect(tpl.templateData.grossDistribution).toBe(0);
    expect(tpl.templateData.distributionCode).toBe('1');
  });

  it('extracts 1099-Q templates preserving distributionType', () => {
    const result = buildTemplateItems(minimalReturn({
      income1099Q: [
        {
          id: 'q-1',
          payerName: 'College 529 Plan',
          grossDistribution: 10000,
          earnings: 3000,
          basisReturn: 7000,
          qualifiedExpenses: 10000,
          distributionType: 'qualified',
        },
      ],
    }));

    const tpl = result.items[0];
    expect(tpl.type).toBe('1099q');
    expect(tpl.templateData.grossDistribution).toBe(0);
    expect(tpl.templateData.earnings).toBe(0);
    expect(tpl.templateData.basisReturn).toBe(0);
    expect(tpl.templateData.qualifiedExpenses).toBe(0);
    expect(tpl.templateData.distributionType).toBe('qualified');
    expect(tpl.templateData.payerName).toBe('College 529 Plan');
  });

  it('extracts Schedule C businesses from businesses array', () => {
    const result = buildTemplateItems(minimalReturn({
      businesses: [
        {
          id: 'biz-1',
          businessName: 'Freelance Dev',
          businessEin: '11-2233445',
          principalBusinessCode: '541511',
          businessDescription: 'Software development',
          accountingMethod: 'cash',
          didStartThisYear: false,
        },
      ],
    }));

    expect(result.businesses).toHaveLength(1);
    const biz = result.businesses[0];
    expect(biz.label).toBe('Freelance Dev');
    expect(biz.selected).toBe(true);
    expect(biz.templateData.businessName).toBe('Freelance Dev');
    expect(biz.templateData.businessEin).toBe('11-2233445');
    expect(biz.templateData.principalBusinessCode).toBe('541511');
    expect(biz.templateData.accountingMethod).toBe('cash');
    expect(biz.templateData.didStartThisYear).toBe(false);
  });

  it('deduplicates legacy business + businesses array', () => {
    const result = buildTemplateItems(minimalReturn({
      business: {
        id: 'legacy-biz',
        businessName: 'My Consulting',
        accountingMethod: 'cash',
        didStartThisYear: false,
      },
      businesses: [
        {
          id: 'biz-1',
          businessName: 'My Consulting',
          accountingMethod: 'cash',
          didStartThisYear: false,
        },
        {
          id: 'biz-2',
          businessName: 'Side Project',
          accountingMethod: 'accrual',
          didStartThisYear: true,
        },
      ],
    }));

    // 'My Consulting' appears in both legacy and array — should only appear once
    expect(result.businesses).toHaveLength(2);
    expect(result.businesses[0].label).toBe('My Consulting');
    expect(result.businesses[1].label).toBe('Side Project');
  });

  it('handles multi-type return with correct grouping', () => {
    const result = buildTemplateItems(minimalReturn({
      w2Income: [
        { id: 'w2-1', employerName: 'BigCo', wages: 100000, federalTaxWithheld: 20000 },
        { id: 'w2-2', employerName: 'Moonlight Inc', wages: 15000, federalTaxWithheld: 2000 },
      ],
      income1099INT: [
        { id: 'int-1', payerName: 'Bank A', amount: 100 },
      ],
      income1099DIV: [
        { id: 'div-1', payerName: 'Fund B', ordinaryDividends: 500, qualifiedDividends: 300 },
      ],
    }));

    expect(result.totalCount).toBe(4);
    expect(Object.keys(result.byType)).toEqual(
      expect.arrayContaining(['w2', '1099int', '1099div'])
    );
    expect(result.byType['w2']).toHaveLength(2);
    expect(result.byType['1099int']).toHaveLength(1);
    expect(result.byType['1099div']).toHaveLength(1);
  });

  it('does NOT include 1099-B transactions (trade-specific, not recurring)', () => {
    const result = buildTemplateItems(minimalReturn({
      income1099B: [
        {
          id: 'b-1',
          brokerName: 'Schwab',
          description: '100 AAPL',
          dateSold: '2024-06-15',
          proceeds: 15000,
          costBasis: 10000,
          isLongTerm: true,
        },
      ],
    }));

    // 1099-B should not produce template items
    expect(result.totalCount).toBe(0);
    expect(result.byType['1099b']).toBeUndefined();
  });

  it('uses source tax year from the return', () => {
    const result = buildTemplateItems(minimalReturn({ taxYear: 2023 }));
    expect(result.sourceYear).toBe(2023);
  });

  it('handles missing payer names gracefully', () => {
    const result = buildTemplateItems(minimalReturn({
      income1099INT: [
        { id: 'int-1', payerName: '', amount: 100 },
      ],
      income1099K: [
        { id: 'k-1', platformName: '', grossAmount: 5000 },
      ],
    }));

    expect(result.items[0].payerName).toBe('Unknown payer');
    expect(result.items[0].label).toBe('Unknown payer (1099-INT)');
    expect(result.items[1].payerName).toBe('Unknown platform');
    expect(result.items[1].label).toBe('Unknown platform (1099-K)');
  });
});

describe('getTypeLabel', () => {
  it('maps known types correctly', () => {
    expect(getTypeLabel('w2')).toBe('W-2');
    expect(getTypeLabel('1099int')).toBe('1099-INT');
    expect(getTypeLabel('1099div')).toBe('1099-DIV');
    expect(getTypeLabel('1099r')).toBe('1099-R');
    expect(getTypeLabel('1099nec')).toBe('1099-NEC');
    expect(getTypeLabel('1099misc')).toBe('1099-MISC');
    expect(getTypeLabel('1099g')).toBe('1099-G');
    expect(getTypeLabel('1099k')).toBe('1099-K');
    expect(getTypeLabel('1099sa')).toBe('1099-SA');
    expect(getTypeLabel('1099q')).toBe('1099-Q');
  });

  it('returns uppercased key for unknown types', () => {
    expect(getTypeLabel('unknown')).toBe('UNKNOWN');
  });
});
