import type { TaxReturn, FilingStatus } from '@telostax/engine';
import { HSA, IRA, SOLO_401K, STUDENT_LOAN_INTEREST, EDUCATOR_EXPENSES } from '@telostax/engine';
import {
  Users, Baby, Building2, Landmark, TrendingUp, BarChart3, Wallet, Briefcase,
  Sliders, Scissors, ListChecks, Laptop, PersonStanding, GraduationCap,
  PiggyBank, HeartPulse, PencilRuler,
} from 'lucide-react';
import { getAgeAtEndOfYear } from '../../utils/dateValidation';
import type { ScenarioVariable } from './types';

// ---------------------------------------------------------------------------
// Helper: get age-aware limits
// ---------------------------------------------------------------------------

function getFilerAge(tr: TaxReturn): number | undefined {
  return getAgeAtEndOfYear(tr.dateOfBirth, tr.taxYear);
}

function getIRAMax(tr: TaxReturn): number {
  const age = getFilerAge(tr);
  return IRA.MAX_CONTRIBUTION + (age !== undefined && age >= 50 ? IRA.CATCH_UP_50_PLUS : 0);
}

function getHSAMax(tr: TaxReturn): number {
  const age = getFilerAge(tr);
  const coverage = tr.hsaContribution?.coverageType || 'self_only';
  return (coverage === 'family' ? HSA.FAMILY_LIMIT : HSA.INDIVIDUAL_LIMIT) +
    (age !== undefined && age >= 55 ? HSA.CATCH_UP_55_PLUS : 0);
}

function getSolo401kMax(tr: TaxReturn): number {
  const age = getFilerAge(tr);
  return SOLO_401K.EMPLOYEE_DEFERRAL_LIMIT + (age !== undefined && age >= 50 ? SOLO_401K.CATCH_UP_50_PLUS : 0);
}

function hasSEIncome(tr: TaxReturn): boolean {
  return (tr.income1099NEC?.length > 0) ||
    (tr.income1099K?.length > 0) ||
    (tr.businesses?.length > 0);
}

// ---------------------------------------------------------------------------
// Runtime coercion helper — safely converts unknown override values to number
// ---------------------------------------------------------------------------

function toNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// Variable Definitions (~20 core variables)
// ---------------------------------------------------------------------------

export const VARIABLE_DEFINITIONS: ScenarioVariable[] = [
  // ── Personal & Filing ──────────────────────────────────────
  {
    key: 'filing_status',
    label: 'Filing Status',
    description: 'Changes tax brackets, standard deduction, and credit eligibility',
    category: 'personal',
    inputType: 'select',
    options: [
      { value: '1', label: 'Single' },
      { value: '2', label: 'Married Filing Jointly' },
      { value: '3', label: 'Married Filing Separately' },
      { value: '4', label: 'Head of Household' },
      { value: '5', label: 'Qualifying Surviving Spouse' },
    ],
    read: (tr) => String(tr.filingStatus ?? 1),
    write: (tr, val) => ({ ...tr, filingStatus: Number(val) as FilingStatus }),
    applyMode: 'direct',
    targetStepId: 'filing_status',
    icon: Users,
  },
  {
    key: 'num_dependents',
    label: 'Number of Dependents',
    description: 'Affects Child Tax Credit, dependent care, and filing status eligibility',
    category: 'personal',
    inputType: 'slider',
    format: 'number',
    min: 0,
    max: 10,
    step: 1,
    read: (tr) => tr.dependents?.length ?? 0,
    write: (tr, val) => {
      const count = toNumber(val);
      const existing = tr.dependents ?? [];
      if (count <= existing.length) return { ...tr, dependents: existing.slice(0, count) };
      const newDeps = Array.from({ length: count - existing.length }, (_, i) => ({
        id: `synth-dep-${existing.length + i}`,
        firstName: `Dependent`,
        lastName: `${existing.length + i + 1}`,
        relationship: 'child',
        dateOfBirth: `${tr.taxYear - 10}-01-01`,
        monthsLivedWithYou: 12,
      }));
      return { ...tr, dependents: [...existing, ...newDeps] };
    },
    applyMode: 'navigate',
    targetStepId: 'dependents',
    icon: Baby,
  },

  // ── Wage Income ────────────────────────────────────────────
  {
    key: 'w2_wages',
    label: 'W-2 Wages (Primary)',
    description: 'Wages from your primary employer',
    category: 'income_wage',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: 1_000_000,
    step: 1000,
    read: (tr) => tr.w2Income?.[0]?.wages ?? 0,
    write: (tr, val) => {
      const wages = toNumber(val);
      if (tr.w2Income?.length) {
        const updated = [...tr.w2Income];
        updated[0] = { ...updated[0], wages };
        return { ...tr, w2Income: updated };
      }
      return {
        ...tr,
        w2Income: [{
          id: 'synth-w2', employerName: 'Scenario', wages,
          federalTaxWithheld: 0, socialSecurityWages: wages,
          socialSecurityTax: 0, medicareWages: wages, medicareTax: 0,
        }],
      };
    },
    applyMode: 'navigate',
    targetStepId: 'w2_income',
    icon: Building2,
  },
  {
    key: 'w2_withholding',
    label: 'Federal Withholding',
    description: 'Federal income tax withheld from your primary W-2',
    category: 'income_wage',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: 200_000,
    step: 500,
    read: (tr) => tr.w2Income?.[0]?.federalTaxWithheld ?? 0,
    write: (tr, val) => {
      const withheld = toNumber(val);
      if (tr.w2Income?.length) {
        const updated = [...tr.w2Income];
        updated[0] = { ...updated[0], federalTaxWithheld: withheld };
        return { ...tr, w2Income: updated };
      }
      return { ...tr };
    },
    isRelevant: (tr) => (tr.w2Income?.length ?? 0) > 0,
    applyMode: 'navigate',
    targetStepId: 'w2_income',
    icon: Building2,
  },
  {
    key: 'extra_w2',
    label: 'Extra W-2 Income',
    description: 'Additional wages (side job, second employer)',
    category: 'income_wage',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: 500_000,
    step: 1000,
    read: (tr) => tr.w2Income?.length > 1 ? tr.w2Income[1].wages : 0,
    write: (tr, val) => {
      const wages = toNumber(val);
      const w2s = [...(tr.w2Income ?? [])];
      if (wages === 0 && w2s.length > 1) {
        return { ...tr, w2Income: [w2s[0]] };
      }
      if (wages > 0) {
        if (w2s.length > 1) {
          w2s[1] = { ...w2s[1], wages };
        } else {
          w2s.push({
            id: 'synth-w2-extra', employerName: 'Extra Income', wages,
            federalTaxWithheld: 0, socialSecurityWages: wages,
            socialSecurityTax: 0, medicareWages: wages, medicareTax: 0,
          });
        }
        return { ...tr, w2Income: w2s };
      }
      return { ...tr };
    },
    applyMode: 'navigate',
    targetStepId: 'w2_income',
    icon: Building2,
  },

  // ── Investment Income ──────────────────────────────────────
  {
    key: 'interest_income',
    label: 'Interest Income',
    description: 'Aggregate 1099-INT interest income',
    category: 'income_investment',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: 100_000,
    step: 500,
    read: (tr) => tr.income1099INT?.reduce((s, i) => s + i.amount, 0) ?? 0,
    write: (tr, val) => {
      const amount = toNumber(val);
      if (tr.income1099INT?.length) {
        return { ...tr, income1099INT: [{ ...tr.income1099INT[0], amount }, ...tr.income1099INT.slice(1)] };
      }
      return { ...tr, income1099INT: [{ id: 'synth-int', payerName: 'Scenario Interest', amount }] };
    },
    applyMode: 'navigate',
    targetStepId: '1099int_income',
    icon: Landmark,
  },
  {
    key: 'qualified_dividends',
    label: 'Qualified Dividends',
    description: 'Taxed at preferential capital gains rates',
    category: 'income_investment',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: 200_000,
    step: 500,
    read: (tr) => tr.income1099DIV?.reduce((s, d) => s + d.qualifiedDividends, 0) ?? 0,
    write: (tr, val) => {
      const qd = toNumber(val);
      if (tr.income1099DIV?.length) {
        return {
          ...tr,
          income1099DIV: [{
            ...tr.income1099DIV[0],
            qualifiedDividends: qd,
            ordinaryDividends: Math.max(tr.income1099DIV[0].ordinaryDividends, qd),
          }, ...tr.income1099DIV.slice(1)],
        };
      }
      return { ...tr, income1099DIV: [{ id: 'synth-div', payerName: 'Scenario Dividends', qualifiedDividends: qd, ordinaryDividends: qd }] };
    },
    applyMode: 'navigate',
    targetStepId: '1099div_income',
    icon: TrendingUp,
  },
  {
    key: 'net_capital_gain',
    label: 'Net Capital Gain/Loss',
    description: 'Net realized gain or loss from investments (negative = loss)',
    category: 'income_investment',
    inputType: 'slider',
    format: 'currency',
    min: -50_000,
    max: 500_000,
    step: 1000,
    read: (tr) => {
      return tr.income1099B?.reduce((s, b) => s + (b.proceeds - b.costBasis), 0) ?? 0;
    },
    write: (tr, val) => {
      const gain = toNumber(val);
      if (tr.income1099B?.length) {
        // Adjust first entry to achieve desired net gain/loss, keeping proceeds/costBasis non-negative
        const restGain = tr.income1099B.slice(1).reduce((s, b) => s + (b.proceeds - b.costBasis), 0);
        const needed = gain - restGain;
        const updated = [...tr.income1099B];
        updated[0] = { ...updated[0], proceeds: Math.max(0, needed), costBasis: Math.max(0, -needed) };
        return { ...tr, income1099B: updated };
      }
      return {
        ...tr,
        income1099B: [{
          id: 'synth-cap', brokerName: 'Scenario', description: 'Scenario gain/loss',
          dateSold: `${tr.taxYear}-06-15`, proceeds: Math.max(0, gain), costBasis: Math.max(0, -gain),
          isLongTerm: true,
        }],
      };
    },
    applyMode: 'navigate',
    targetStepId: '1099b_income',
    icon: BarChart3,
  },
  {
    key: 'other_income',
    label: 'Other Income',
    description: 'Miscellaneous income (gambling, prizes, etc.)',
    category: 'income_investment',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: 100_000,
    step: 500,
    read: (tr) => tr.otherIncome ?? 0,
    write: (tr, val) => ({ ...tr, otherIncome: toNumber(val) }),
    applyMode: 'direct',
    targetStepId: 'other_income',
    icon: Wallet,
  },

  // ── Self-Employment ────────────────────────────────────────
  {
    key: 'se_net_profit',
    label: 'SE Net Profit',
    description: 'Schedule C net profit from your primary business',
    category: 'income_se',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: 500_000,
    step: 1000,
    read: (tr) => {
      if (!tr.income1099NEC?.length && !tr.income1099K?.length) return 0;
      const necTotal = tr.income1099NEC?.reduce((s, n) => s + n.amount, 0) ?? 0;
      const kTotal = tr.income1099K?.reduce((s, k) => s + k.grossAmount - (k.returnsAndAllowances ?? 0), 0) ?? 0;
      const expenses = tr.expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;
      return Math.max(0, necTotal + kTotal - expenses);
    },
    write: (tr, val) => {
      const profit = toNumber(val);
      // Set NEC income to desired profit + existing expenses
      const expenses = tr.expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;
      const necAmount = profit + expenses;
      if (tr.income1099NEC?.length) {
        return { ...tr, income1099NEC: [{ ...tr.income1099NEC[0], amount: necAmount }, ...tr.income1099NEC.slice(1)] };
      }
      return { ...tr, income1099NEC: [{ id: 'synth-nec', payerName: 'Scenario Business', amount: necAmount }] };
    },
    isRelevant: hasSEIncome,
    applyMode: 'navigate',
    targetStepId: '1099nec_income',
    icon: Briefcase,
  },

  // ── Retirement & Savings ───────────────────────────────────
  {
    key: 'ira_contribution',
    label: 'IRA Contribution',
    description: 'Traditional IRA contribution reduces AGI',
    category: 'retirement',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: (tr) => getIRAMax(tr),
    step: 500,
    read: (tr) => tr.iraContribution ?? 0,
    write: (tr, val) => ({ ...tr, iraContribution: toNumber(val) }),
    applyMode: 'direct',
    targetStepId: 'adjustments',
    icon: PiggyBank,
  },
  {
    key: 'hsa_contribution',
    label: 'HSA Contribution',
    description: 'Health Savings Account contribution reduces AGI',
    category: 'retirement',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: (tr) => getHSAMax(tr),
    step: 500,
    read: (tr) => tr.hsaDeduction || tr.hsaContribution?.totalContributions || 0,
    write: (tr, val) => {
      const amount = toNumber(val);
      return {
        ...tr,
        hsaDeduction: amount,
        hsaContribution: tr.hsaContribution
          ? { ...tr.hsaContribution, totalContributions: amount }
          : { coverageType: 'self_only' as const, totalContributions: amount },
      };
    },
    applyMode: 'direct',
    targetStepId: 'adjustments',
    icon: HeartPulse,
  },
  {
    key: 'solo_401k',
    label: 'Solo 401(k) Deferral',
    description: 'Employee deferral for self-employed retirement plan',
    category: 'retirement',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: (tr) => getSolo401kMax(tr),
    step: 1000,
    read: (tr) => tr.selfEmploymentDeductions?.solo401kEmployeeDeferral ?? 0,
    write: (tr, val) => {
      const amount = toNumber(val);
      const existing = tr.selfEmploymentDeductions;
      return {
        ...tr,
        selfEmploymentDeductions: {
          healthInsurancePremiums: existing?.healthInsurancePremiums ?? 0,
          sepIraContributions: existing?.sepIraContributions ?? 0,
          solo401kEmployeeDeferral: amount,
          solo401kEmployerContribution: existing?.solo401kEmployerContribution ?? 0,
          solo401kContributions: amount + (existing?.solo401kEmployerContribution ?? 0),
          otherRetirementContributions: existing?.otherRetirementContributions ?? 0,
        },
      };
    },
    isRelevant: hasSEIncome,
    applyMode: 'direct',
    targetStepId: 'se_retirement',
    icon: Briefcase,
  },

  // ── Deductions ─────────────────────────────────────────────
  {
    key: 'deduction_method',
    label: 'Deduction Method',
    description: 'Standard deduction vs. itemizing',
    category: 'deductions',
    inputType: 'select',
    options: [
      { value: 'standard', label: 'Standard Deduction' },
      { value: 'itemized', label: 'Itemized Deductions' },
    ],
    read: (tr) => tr.deductionMethod || 'standard',
    write: (tr, val) => ({ ...tr, deductionMethod: val as 'standard' | 'itemized' }),
    applyMode: 'direct',
    targetStepId: 'deduction_method',
    icon: Scissors,
  },
  {
    key: 'charitable_cash',
    label: 'Charitable (Cash)',
    description: 'Cash charitable contributions (auto-switches to itemized)',
    category: 'deductions',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: 100_000,
    step: 500,
    read: (tr) => tr.itemizedDeductions?.charitableCash ?? 0,
    write: (tr, val) => {
      const base = {
        medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
        personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
        charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
        ...tr.itemizedDeductions,
      };
      return { ...tr, deductionMethod: 'itemized' as const, itemizedDeductions: { ...base, charitableCash: toNumber(val) } };
    },
    applyMode: 'direct',
    targetStepId: 'itemized_deductions',
    icon: ListChecks,
  },
  {
    key: 'mortgage_interest',
    label: 'Mortgage Interest',
    description: 'Home mortgage interest deduction',
    category: 'deductions',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: 50_000,
    step: 500,
    read: (tr) => tr.itemizedDeductions?.mortgageInterest ?? 0,
    write: (tr, val) => {
      const base = {
        medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
        personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
        charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
        ...tr.itemizedDeductions,
      };
      return { ...tr, deductionMethod: 'itemized' as const, itemizedDeductions: { ...base, mortgageInterest: toNumber(val) } };
    },
    applyMode: 'direct',
    targetStepId: 'itemized_deductions',
    icon: ListChecks,
  },
  {
    key: 'salt',
    label: 'State & Local Taxes (SALT)',
    description: 'State/local income + property tax (capped at $40,000 for 2025)',
    category: 'deductions',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: 40_000,
    step: 500,
    read: (tr) => {
      const id = tr.itemizedDeductions;
      return (id?.stateLocalIncomeTax ?? 0) + (id?.realEstateTax ?? 0) + (id?.personalPropertyTax ?? 0);
    },
    write: (tr, val) => {
      const base = {
        medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
        personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
        charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
        ...tr.itemizedDeductions,
      };
      return { ...tr, deductionMethod: 'itemized' as const, itemizedDeductions: { ...base, stateLocalIncomeTax: toNumber(val), realEstateTax: 0, personalPropertyTax: 0 } };
    },
    applyMode: 'navigate',
    targetStepId: 'itemized_deductions',
    icon: ListChecks,
  },
  {
    key: 'student_loan_interest',
    label: 'Student Loan Interest',
    description: 'Above-the-line deduction (max $2,500)',
    category: 'deductions',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: STUDENT_LOAN_INTEREST.MAX_DEDUCTION,
    step: 100,
    read: (tr) => tr.studentLoanInterest ?? 0,
    write: (tr, val) => ({ ...tr, studentLoanInterest: toNumber(val) }),
    applyMode: 'direct',
    targetStepId: 'adjustments',
    icon: GraduationCap,
  },
  {
    key: 'home_office_sqft',
    label: 'Home Office (Simplified)',
    description: '$5/sq ft simplified method — enter dedicated workspace square footage',
    category: 'deductions',
    inputType: 'slider',
    format: 'number',
    min: 0,
    max: 300,
    step: 10,
    read: (tr) => tr.homeOffice?.squareFeet ?? 0,
    write: (tr, val) => {
      const sqft = toNumber(val);
      return {
        ...tr,
        homeOffice: {
          method: 'simplified' as const,
          squareFeet: Math.min(sqft, 300),
          totalHomeSquareFeet: tr.homeOffice?.totalHomeSquareFeet ?? 1500,
        },
      };
    },
    isRelevant: hasSEIncome,
    applyMode: 'direct',
    targetStepId: 'home_office',
    icon: Laptop,
  },
  {
    key: 'educator_expenses',
    label: 'Educator Expenses',
    description: 'K-12 teachers: unreimbursed classroom supplies (max $300)',
    category: 'deductions',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: EDUCATOR_EXPENSES.MAX_DEDUCTION,
    step: 25,
    read: (tr) => tr.educatorExpenses ?? 0,
    write: (tr, val) => ({ ...tr, educatorExpenses: toNumber(val) }),
    applyMode: 'direct',
    targetStepId: 'adjustments',
    icon: PencilRuler,
  },

  // ── Credits ────────────────────────────────────────────────
  {
    key: 'dependent_care_expenses',
    label: 'Dependent Care Expenses',
    description: 'Child/dependent care expenses for the credit',
    category: 'credits',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: 6_000,
    step: 250,
    read: (tr) => tr.dependentCare?.totalExpenses ?? 0,
    write: (tr, val) => ({
      ...tr,
      dependentCare: {
        qualifyingPersons: Math.min(tr.dependents?.length ?? 0, 2),
        ...tr.dependentCare,
        totalExpenses: toNumber(val),
      },
    }),
    isRelevant: (tr) => (tr.dependents?.length ?? 0) > 0,
    applyMode: 'direct',
    targetStepId: 'dependent_care',
    icon: PersonStanding,
  },
  {
    key: 'education_expenses',
    label: 'Education Expenses',
    description: 'Tuition for American Opportunity or Lifetime Learning Credit',
    category: 'credits',
    inputType: 'slider',
    format: 'currency',
    min: 0,
    max: 20_000,
    step: 500,
    read: (tr) => tr.educationCredits?.[0]?.tuitionPaid ?? 0,
    write: (tr, val) => {
      const tuition = toNumber(val);
      if (tr.educationCredits?.length) {
        return { ...tr, educationCredits: [{ ...tr.educationCredits[0], tuitionPaid: tuition }, ...tr.educationCredits.slice(1)] };
      }
      return {
        ...tr,
        educationCredits: [{
          id: 'synth-edu', type: 'american_opportunity' as const,
          studentName: 'Student', institution: 'University', tuitionPaid: tuition,
        }],
      };
    },
    applyMode: 'navigate',
    targetStepId: 'education_credits',
    icon: GraduationCap,
  },
];

// Grouped by category for accordion display
export function getVariablesByCategory(variables: ScenarioVariable[]): Map<string, ScenarioVariable[]> {
  const grouped = new Map<string, ScenarioVariable[]>();
  for (const v of variables) {
    const list = grouped.get(v.category) ?? [];
    list.push(v);
    grouped.set(v.category, list);
  }
  return grouped;
}
