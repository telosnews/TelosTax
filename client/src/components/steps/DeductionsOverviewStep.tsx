import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import PillToggle from '../common/PillToggle';
import {
  Scissors, HeartPulse, Stethoscope, GraduationCap, PiggyBank, Receipt,
  Home, PencilRuler, HandHeart, Banknote, TrendingUp, RefreshCw,
  AlertTriangle, ShieldAlert, FileBarChart, BadgeDollarSign,
  UserMinus, RotateCcw, Dices, Ban, CloudLightning,
  Search, ChevronDown, ChevronUp, Check, PenLine, HelpCircle, Info, ExternalLink,
} from 'lucide-react';
import { ReactNode } from 'react';

interface DeductionQuestion {
  key: string;
  label: string;
  description: string;
  icon: ReactNode;
  group: string;
  stepId: string;
  isCommon?: boolean;
  getSummary: (tr: any) => string;
}

interface DeductionGroup {
  id: string;
  label: string;
  description: string;
}

const DEDUCTION_GROUPS: DeductionGroup[] = [
  { id: 'home', label: 'Home & Property', description: 'Mortgage, property tax, and SALT' },
  { id: 'health', label: 'Health & Medical', description: 'HSA contributions and medical expenses' },
  { id: 'charitable', label: 'Charitable Giving', description: 'Donations to qualified charities' },
  { id: 'education', label: 'Education', description: 'Student loans and educator expenses' },
  { id: 'retirement', label: 'Retirement', description: 'IRA, Roth conversions, and excess contributions' },
  { id: 'payments', label: 'Tax Payments', description: 'Estimated quarterly payments' },
  { id: 'obbba', label: 'New for 2025 (OBBBA)', description: 'Tips, overtime, and car loan deductions' },
  { id: 'other', label: 'Other Deductions', description: 'Less common deductions and adjustments' },
];

const DEDUCTION_QUESTIONS: DeductionQuestion[] = [
  // Home & Property
  {
    key: 'ded_mortgage', label: 'Mortgage Interest', stepId: 'mortgage_interest_ded',
    description: 'Do you pay mortgage interest on your home?',
    icon: <Home className="w-5 h-5" />, group: 'home',
    getSummary: (tr) => {
      const amt = tr.itemizedDeductions?.mortgageInterest || 0;
      return amt > 0 ? `$${amt.toLocaleString()} in mortgage interest` : '';
    },
  },
  {
    key: 'ded_property_tax', label: 'Property & State Taxes', stepId: 'salt_deduction',
    description: 'Do you pay property tax or state/local income tax?',
    icon: <Receipt className="w-5 h-5" />, group: 'home',
    getSummary: (tr) => {
      const id = tr.itemizedDeductions;
      const total = (id?.stateLocalIncomeTax || 0) + (id?.realEstateTax || 0) + (id?.personalPropertyTax || 0);
      return total > 0 ? `$${total.toLocaleString()} in SALT` : '';
    },
  },
  // Health & Medical
  {
    key: 'ded_hsa', label: 'HSA Contributions', stepId: 'hsa_contributions',
    description: 'Did you contribute to a Health Savings Account?',
    icon: <HeartPulse className="w-5 h-5" />, group: 'health',
    getSummary: (tr) => {
      const amt = tr.hsaDeduction || 0;
      return amt > 0 ? `$${amt.toLocaleString()} contributed` : '';
    },
  },
  {
    key: 'ded_archer_msa', label: 'Archer MSA', stepId: 'archer_msa', isCommon: false,
    description: 'Do you have an Archer Medical Savings Account (pre-2008)?',
    icon: <HeartPulse className="w-5 h-5" />, group: 'health',
    getSummary: (tr) => {
      const amt = tr.archerMSA?.personalContributions || 0;
      return amt > 0 ? `$${amt.toLocaleString()} contributed` : '';
    },
  },
  {
    key: 'ded_medical', label: 'Medical Expenses', stepId: 'medical_expenses',
    description: 'Did you have significant unreimbursed medical or dental expenses?',
    icon: <Stethoscope className="w-5 h-5" />, group: 'health',
    getSummary: (tr) => {
      const amt = tr.itemizedDeductions?.medicalExpenses || 0;
      return amt > 0 ? `$${amt.toLocaleString()} in medical expenses` : '';
    },
  },
  // Charitable Giving
  {
    key: 'ded_charitable', label: 'Charitable Donations', stepId: 'charitable_deduction',
    description: 'Did you make donations to qualified charities?',
    icon: <HandHeart className="w-5 h-5" />, group: 'charitable',
    getSummary: (tr) => {
      const cash = tr.itemizedDeductions?.charitableCash || 0;
      const nonCash = tr.itemizedDeductions?.charitableNonCash || 0;
      const total = cash + nonCash;
      return total > 0 ? `$${total.toLocaleString()} in donations` : '';
    },
  },
  // Education
  {
    key: 'ded_student_loan', label: 'Student Loan Interest', stepId: 'student_loan_ded',
    description: 'Did you pay interest on student loans?',
    icon: <GraduationCap className="w-5 h-5" />, group: 'education',
    getSummary: (tr) => {
      const amt = tr.studentLoanInterest || 0;
      return amt > 0 ? `$${amt.toLocaleString()} in interest` : '';
    },
  },
  {
    key: 'ded_educator', label: 'Educator Expenses', stepId: 'educator_expenses_ded',
    description: 'Are you a K-12 teacher who bought classroom supplies?',
    icon: <PencilRuler className="w-5 h-5" />, group: 'education',
    getSummary: (tr) => {
      const amt = tr.educatorExpenses || 0;
      return amt > 0 ? `$${amt.toLocaleString()} in expenses` : '';
    },
  },
  // Retirement
  {
    key: 'ded_ira', label: 'IRA Contributions', stepId: 'ira_contribution_ded',
    description: 'Did you contribute to a traditional IRA?',
    icon: <PiggyBank className="w-5 h-5" />, group: 'retirement',
    getSummary: (tr) => {
      const amt = tr.iraContribution || 0;
      return amt > 0 ? `$${amt.toLocaleString()} contributed` : '';
    },
  },
  {
    key: 'form8606', label: 'Roth Conversion / Nondeductible IRA', stepId: 'form8606', isCommon: false,
    description: 'Did you convert a traditional IRA to Roth or make nondeductible IRA contributions?',
    icon: <RefreshCw className="w-5 h-5" />, group: 'retirement',
    getSummary: (tr) => {
      const amt = tr.form8606?.conversionAmount || 0;
      return amt > 0 ? `$${amt.toLocaleString()} converted` : '';
    },
  },
  {
    key: 'form5329', label: 'Excess IRA/HSA/ESA Contributions', stepId: 'form5329', isCommon: false,
    description: 'Did you contribute more than the annual limit to an IRA, HSA, or Coverdell ESA?',
    icon: <AlertTriangle className="w-5 h-5" />, group: 'retirement',
    getSummary: (tr) => {
      const ec = tr.excessContributions;
      const total = (ec?.iraExcessContribution || 0) + (ec?.hsaExcessContribution || 0) + (ec?.esaExcessContribution || 0);
      return total > 0 ? `$${total.toLocaleString()} excess` : '';
    },
  },
  // Tax Payments
  {
    key: 'ded_estimated_payments', label: 'Estimated Tax Payments', stepId: 'estimated_payments',
    description: 'Did you make quarterly estimated tax payments in 2025?',
    icon: <Receipt className="w-5 h-5" />, group: 'payments',
    getSummary: (tr) => {
      const q = tr.estimatedPayments;
      const total = (q?.q1 || 0) + (q?.q2 || 0) + (q?.q3 || 0) + (q?.q4 || 0);
      return total > 0 ? `$${total.toLocaleString()} paid` : '';
    },
  },
  // New for 2025 (OBBBA)
  {
    key: 'schedule1a', label: 'No Tax on Tips / Overtime / Car Loan', stepId: 'schedule1a',
    description: 'Did you earn tips, overtime pay, or pay interest on an auto loan? (OBBBA 2025)',
    icon: <Banknote className="w-5 h-5" />, group: 'obbba',
    getSummary: (tr) => {
      const s = tr.schedule1AInfo;
      const total = (s?.qualifiedTips || 0) + (s?.qualifiedOvertimePay || 0) + (s?.carLoanInterestPaid || 0);
      return total > 0 ? `$${total.toLocaleString()} in deductions` : '';
    },
  },
  // Other Deductions — ordered most to least common
  {
    key: 'ded_gambling', label: 'Gambling Losses', stepId: 'gambling_losses_ded', isCommon: false,
    description: 'Did you have gambling losses to deduct against winnings?',
    icon: <Dices className="w-5 h-5" />, group: 'other',
    getSummary: (tr) => {
      const amt = tr.gamblingLosses || 0;
      return amt > 0 ? `$${amt.toLocaleString()} in losses` : '';
    },
  },
  {
    key: 'investment_interest', label: 'Investment Interest Expense', stepId: 'investment_interest', isCommon: false,
    description: 'Did you pay interest on margin loans or other investment-purpose borrowing?',
    icon: <TrendingUp className="w-5 h-5" />, group: 'other',
    getSummary: (tr) => {
      const amt = tr.investmentInterestExpense || 0;
      return amt > 0 ? `$${amt.toLocaleString()} in interest` : '';
    },
  },
  {
    key: 'schedule_h', label: 'Household Employees (Nanny Tax)', stepId: 'schedule_h', isCommon: false,
    description: 'Did you pay $2,800+ in cash wages to a household employee (nanny, housekeeper)?',
    icon: <BadgeDollarSign className="w-5 h-5" />, group: 'other',
    getSummary: (tr) => {
      const amt = tr.householdEmployees?.totalCashWages || 0;
      return amt > 0 ? `$${amt.toLocaleString()} in wages` : '';
    },
  },
  {
    key: 'ded_alimony', label: 'Alimony Paid', stepId: 'alimony_paid', isCommon: false,
    description: 'Did you pay alimony under a pre-2019 divorce agreement?',
    icon: <UserMinus className="w-5 h-5" />, group: 'other',
    getSummary: (tr) => {
      const amt = tr.alimony?.annualAmount || 0;
      return amt > 0 ? `$${amt.toLocaleString()} paid` : '';
    },
  },
  {
    key: 'ded_nol', label: 'Net Operating Loss Carryforward', stepId: 'nol_carryforward', isCommon: false,
    description: 'Do you have a net operating loss carryforward from a prior year?',
    icon: <RotateCcw className="w-5 h-5" />, group: 'other',
    getSummary: (tr) => {
      const amt = tr.nolCarryforward || 0;
      return amt > 0 ? `$${amt.toLocaleString()} carryforward` : '';
    },
  },
  {
    key: 'qbi_detail', label: 'QBI Detail (Form 8995-A)', stepId: 'qbi_detail', isCommon: false,
    description: 'Do you need per-business QBI detail for W-2 wages and UBIA? (Required above income thresholds)',
    icon: <FileBarChart className="w-5 h-5" />, group: 'other',
    getSummary: () => '',
  },
  {
    key: 'amt_data', label: 'AMT Adjustments (Form 6251)', stepId: 'amt_data', isCommon: false,
    description: 'Do you have ISO exercises, private activity bonds, or other items that may trigger the Alternative Minimum Tax?',
    icon: <ShieldAlert className="w-5 h-5" />, group: 'other',
    getSummary: (tr) => {
      const amt = tr.amtData?.isoExerciseSpread || 0;
      return amt > 0 ? `$${amt.toLocaleString()} ISO spread` : '';
    },
  },
  {
    key: 'bad_debt', label: 'Nonbusiness Bad Debt', stepId: 'bad_debt', isCommon: false,
    description: 'Did someone owe you money that became completely worthless this year?',
    icon: <Ban className="w-5 h-5" />, group: 'other',
    getSummary: (tr) => {
      const count = tr.nonbusinessBadDebts?.length || 0;
      return count > 0 ? `${count} bad ${count === 1 ? 'debt' : 'debts'}` : '';
    },
  },
  {
    key: 'casualty_loss', label: 'Casualty or Theft Loss', stepId: 'casualty_loss', isCommon: false,
    description: 'Did you suffer property loss from a federally declared disaster?',
    icon: <CloudLightning className="w-5 h-5" />, group: 'other',
    getSummary: (tr) => {
      const count = tr.casualtyLosses?.length || 0;
      return count > 0 ? `${count} ${count === 1 ? 'casualty' : 'casualties'}` : '';
    },
  },
];

export default function DeductionsOverviewStep() {
  const { taxReturn, returnId, updateField, goToStep } = useTaxReturnStore();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  if (!taxReturn || !returnId) return null;

  const discovery = taxReturn.incomeDiscovery;

  const setAnswer = (key: string, value: 'yes' | 'no' | 'later' | undefined) => {
    updateField('incomeDiscovery', { ...discovery, [key]: value });
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const save = async () => {
    await updateReturn(returnId, { incomeDiscovery: taxReturn.incomeDiscovery });
  };

  const yesCount = DEDUCTION_QUESTIONS.filter(q => discovery[q.key] === 'yes').length;
  const hasItemizedIndicators = ['ded_mortgage', 'ded_property_tax', 'ded_charitable', 'ded_medical'].some(
    k => discovery[k] === 'yes'
  );

  const groupActiveCount = (groupId: string) =>
    DEDUCTION_QUESTIONS.filter(q => q.group === groupId && discovery[q.key] === 'yes').length;

  // Search filter
  const filteredQuestions = searchQuery
    ? DEDUCTION_QUESTIONS.filter(q =>
        q.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const renderDeductionCard = (q: DeductionQuestion) => {
    const answer = discovery[q.key];
    const summary = q.getSummary(taxReturn);
    const isExpanded = expandedKey === q.key;
    const isActive = answer === 'yes';
    const hasData = !!summary;

    return (
      <div key={q.key} className="rounded-lg border border-slate-700 overflow-hidden">
        {/* Accordion header */}
        <button
          onClick={() => setExpandedKey(isExpanded ? null : q.key)}
          className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
            isActive ? 'bg-surface-800' : 'bg-surface-900 hover:bg-surface-800'
          }`}
        >
          <div className={`${isActive ? 'text-telos-orange-400' : 'text-slate-400'}`}>
            {q.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-medium text-sm ${isActive ? 'text-slate-200' : 'text-slate-400'}`}>
                {q.label}
              </span>
              {q.isCommon === false && answer !== 'yes' && !hasData && (
                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-normal whitespace-nowrap">
                  not common
                </span>
              )}
            </div>
            {hasData && (
              <div className="text-xs text-slate-400 mt-0.5">{summary}</div>
            )}
          </div>

          {/* Status + action */}
          <div className="flex items-center gap-2 shrink-0">
            {isActive && hasData && (
              <button
                onClick={(e) => { e.stopPropagation(); goToStep(q.stepId); }}
                className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-3 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors"
              >
                Revisit
              </button>
            )}
            {isActive && !hasData && (
              <button
                onClick={(e) => { e.stopPropagation(); goToStep(q.stepId); }}
                className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-3 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors"
              >
                Start
              </button>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>

        {/* Accordion content */}
        {isExpanded && (
          <div className="px-4 py-3 bg-surface-900 border-t border-slate-700">
            <p className="text-sm text-slate-400 mb-3">{q.description}</p>
            <PillToggle
              value={answer}
              onChange={(val) => setAnswer(q.key, val)}
            />
            {answer === 'yes' && !hasData && (
              <p className="text-xs text-telos-blue-400 mt-2 flex items-center gap-1">
                <PenLine className="w-3 h-3" />
                Click "Start" above or continue to the next step to enter your data.
              </p>
            )}
            {answer === 'yes' && hasData && (
              <p className="text-xs text-telos-orange-400 mt-2 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Data entered. Click "Revisit" to make changes.
              </p>
            )}
            {answer === 'no' && (
              <p className="text-xs text-slate-400 mt-2">
                Got it — this won't apply to your return.
              </p>
            )}
            {answer === 'later' && (
              <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                <HelpCircle className="w-3 h-3" />
                No worries — we'll include this section so you can decide later.
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <SectionIntro
        icon={<Scissors className="w-8 h-8" />}
        title="Deductions & Adjustments"
        description="Let's find ways to lower your taxable income. Select any that apply to you."
      />


      {/* Consolidated info callout */}
      <div className="rounded-lg border border-telos-blue-600/30 bg-telos-blue-600/10 mt-4 mb-4 p-4">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-telos-blue-300" />
          <div className="text-sm text-slate-400 leading-relaxed space-y-2">
            <p>
              <span className="font-medium text-telos-blue-300">How deductions work:</span>{' '}
              Deductions reduce the amount of income subject to tax. This page covers all types — select "Yes" for any that apply.
            </p>
            <p>
              <span className="font-medium text-slate-300">Above-the-line (adjustments)</span> — HSA, student loan interest, IRA contributions, educator expenses, and estimated payments reduce your AGI regardless of whether you itemize.{' '}
              <a href="https://www.irs.gov/taxtopics/tc451" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
                <ExternalLink className="w-3 h-3" />Learn more on IRS.gov
              </a>
            </p>
            <p>
              <span className="font-medium text-slate-300">Below-the-line (itemized)</span> — Mortgage interest, SALT, charitable donations, medical expenses, and gambling losses are Schedule A deductions. These only reduce your tax if your total itemized deductions exceed the standard deduction ($15,750 single / $31,500 MFJ for 2025).{' '}
              <a href="https://www.irs.gov/taxtopics/tc501" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
                <ExternalLink className="w-3 h-3" />Learn more on IRS.gov
              </a>
            </p>
            <p>
              We'll compare standard vs. itemized for you automatically and recommend the better option.
            </p>
          </div>
        </div>
      </div>

      {/* Status callout */}
      {yesCount > 0 && (
        <div className="card mt-4 text-center bg-telos-orange-500/5 border-telos-orange-500/20">
          <p className="text-sm text-slate-300">
            <span className="text-telos-orange-400 font-bold">{yesCount}</span>{' '}
            {yesCount === 1 ? 'deduction' : 'deductions'} selected
          </p>
          {hasItemizedIndicators && (
            <p className="text-xs text-slate-400 mt-1">
              You may benefit from itemizing — we'll compare on the next step.
            </p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search deductions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Deduction categories */}
      {filteredQuestions ? (
        /* Flat list when searching */
        <div className="space-y-2 mt-4">
          {filteredQuestions.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No matching deductions found.</p>
          )}
          {filteredQuestions.map(renderDeductionCard)}
        </div>
      ) : (
        /* Grouped view */
        <div className="space-y-4 mt-4">
          {DEDUCTION_GROUPS.map((group) => {
            const groupQuestions = DEDUCTION_QUESTIONS.filter(q => q.group === group.id);
            if (groupQuestions.length === 0) return null;

            const isCollapsed = collapsedGroups[group.id] ?? false;
            const activeCount = groupActiveCount(group.id);

            return (
              <div key={group.id}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-2 px-1 py-2 group"
                >
                  <span className="text-sm font-semibold text-slate-300 group-hover:text-slate-200 transition-colors">
                    {group.label}
                  </span>
                  {activeCount > 0 && (
                    <span className="text-xs text-telos-orange-400 bg-telos-orange-500/10 px-2 py-0.5 rounded-full">
                      {activeCount}
                    </span>
                  )}
                  <span className="text-xs text-slate-600 hidden sm:inline">
                    {group.description}
                  </span>
                  <div className="ml-auto">
                    {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="space-y-2">
                    {groupQuestions.map(renderDeductionCard)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
