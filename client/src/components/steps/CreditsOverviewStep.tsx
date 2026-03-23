import { useState, useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import { calculateForm1040, FilingStatus } from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import PillToggle from '../common/PillToggle';
import EligibilityBadge from '../common/EligibilityBadge';
import {
  Award, Baby, Banknote, BookOpen, Fuel, GraduationCap, Globe, HandCoins, Heart,
  HeartHandshake, Leaf, Lightbulb, PersonStanding, UserCheck, Zap, Calculator,
  Search, ChevronDown, ChevronUp, Check, PenLine, HelpCircle, Info, ExternalLink,
} from 'lucide-react';
import { ReactNode } from 'react';
import StepWarningsBanner from '../common/StepWarningsBanner';

interface CreditQuestion {
  key: string;
  label: string;
  description: string;
  icon: ReactNode;
  group: string;
  stepId: string;
  isCommon?: boolean;
  isAutoCalculated?: boolean;
  agiLimit?: Partial<Record<FilingStatus, number>>;
  getSummary: (tr: any, calc: any) => string;
}

interface CreditGroup {
  id: string;
  label: string;
  description: string;
}

const CREDIT_GROUPS: CreditGroup[] = [
  { id: 'family', label: 'Family', description: 'Child, dependent care, and adoption credits' },
  { id: 'education', label: 'Education', description: 'College tuition and scholarship credits' },
  { id: 'home', label: 'Home & Energy', description: 'Solar, EV, and energy efficiency credits' },
  { id: 'health', label: 'Health Insurance', description: 'Marketplace premium tax credit' },
  { id: 'retirement', label: 'Retirement & Savings', description: "Saver's credit for retirement contributions" },
  { id: 'income_based', label: 'Income-Based', description: 'EITC, elderly/disabled, and foreign tax credits' },
];

const CREDIT_QUESTIONS: CreditQuestion[] = [
  // Family
  {
    key: 'child_credit', label: 'Child Tax Credit', stepId: 'child_tax_credit',
    description: 'Do you have children under 17 or other dependents?',
    icon: <Baby className="w-5 h-5" />, group: 'family',
    getSummary: (_, calc) => {
      const ctc = (calc?.credits?.childTaxCredit || 0) + (calc?.credits?.otherDependentCredit || 0);
      return ctc > 0 ? `$${ctc.toLocaleString()} estimated` : '';
    },
  },
  {
    key: 'dependent_care', label: 'Child & Dependent Care', stepId: 'dependent_care',
    description: 'Did you pay for childcare (under 13) or dependent care so you could work?',
    icon: <PersonStanding className="w-5 h-5" />, group: 'family',
    getSummary: (_, calc) => {
      const amt = calc?.credits?.dependentCareCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
  {
    key: 'adoption_credit', label: 'Adoption Credit', stepId: 'adoption_credit', isCommon: false,
    description: 'Did you adopt or begin the process of adopting an eligible child?',
    icon: <Heart className="w-5 h-5" />, group: 'family',
    getSummary: (_, calc) => {
      const amt = calc?.credits?.adoptionCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
  // Education
  {
    key: 'education_credit', label: 'Education Credits', stepId: 'education_credits',
    description: 'Did you pay college tuition or education expenses?',
    icon: <GraduationCap className="w-5 h-5" />, group: 'education',
    getSummary: (_, calc) => {
      const amt = (calc?.credits?.educationCredit || 0) + (calc?.credits?.aotcRefundableCredit || 0);
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
  {
    key: 'scholarship_credit', label: 'Scholarship Credit (§25F)', stepId: 'scholarship_credit', isCommon: false,
    description: 'Did you contribute to a qualified Scholarship Granting Organization (SGO) for K-12 scholarships?',
    icon: <BookOpen className="w-5 h-5" />, group: 'education',
    getSummary: (_, calc) => {
      const amt = calc?.credits?.scholarshipCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
  // Home & Energy
  {
    key: 'clean_energy', label: 'Residential Clean Energy Credit', stepId: 'clean_energy',
    description: 'Did you install solar panels, battery storage, or other clean energy systems?',
    icon: <Zap className="w-5 h-5" />, group: 'home',
    getSummary: (_, calc) => {
      const amt = calc?.credits?.cleanEnergyCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
  {
    key: 'energy_efficiency', label: 'Home Improvement Credit', stepId: 'energy_efficiency',
    description: 'Did you make energy-efficient home improvements (heat pump, insulation, windows)?',
    icon: <Lightbulb className="w-5 h-5" />, group: 'home',
    getSummary: (_, calc) => {
      const amt = calc?.credits?.energyEfficiencyCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
  {
    key: 'ev_credit', label: 'Clean Vehicle Credit', stepId: 'ev_credit',
    description: 'Did you purchase a new or previously owned electric or plug-in hybrid vehicle?',
    icon: <Leaf className="w-5 h-5" />, group: 'home',
    agiLimit: { [FilingStatus.Single]: 150000, [FilingStatus.MarriedFilingJointly]: 300000, [FilingStatus.MarriedFilingSeparately]: 150000, [FilingStatus.HeadOfHousehold]: 225000, [FilingStatus.QualifyingSurvivingSpouse]: 300000 },
    getSummary: (_, calc) => {
      const amt = calc?.credits?.evCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
  {
    key: 'ev_refueling', label: 'EV Charging Credit', stepId: 'ev_refueling', isCommon: false,
    description: 'Did you install an electric vehicle charging station or alternative fuel refueling equipment?',
    icon: <Fuel className="w-5 h-5" />, group: 'home',
    getSummary: (_, calc) => {
      const amt = calc?.credits?.evRefuelingCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
  // Health Insurance
  {
    key: 'premium_tax_credit', label: 'Premium Tax Credit', stepId: 'premium_tax_credit',
    description: 'Did you purchase health insurance through the Marketplace and receive a Form 1095-A?',
    icon: <HeartHandshake className="w-5 h-5" />, group: 'health',
    getSummary: (_, calc) => {
      const amt = calc?.credits?.premiumTaxCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
  // Retirement & Savings
  {
    key: 'savers_credit', label: "Saver's Credit", stepId: 'savers_credit',
    description: 'Did you contribute to a retirement plan (IRA, 401(k))? For low-to-moderate income savers.',
    icon: <HandCoins className="w-5 h-5" />, group: 'retirement',
    agiLimit: { [FilingStatus.Single]: 36500, [FilingStatus.MarriedFilingJointly]: 73000, [FilingStatus.MarriedFilingSeparately]: 36500, [FilingStatus.HeadOfHousehold]: 54750, [FilingStatus.QualifyingSurvivingSpouse]: 73000 },
    getSummary: (_, calc) => {
      const amt = calc?.credits?.saversCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
  // Income-Based
  {
    key: 'eitc', label: 'Earned Income Tax Credit', stepId: 'credits_overview', isAutoCalculated: true,
    description: 'Refundable credit for low-to-moderate income workers. Calculated automatically.',
    icon: <Banknote className="w-5 h-5" />, group: 'income_based',
    getSummary: (_, calc) => {
      const amt = calc?.credits?.eitcCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} (auto-calculated)` : '';
    },
  },
  {
    key: 'elderly_disabled', label: 'Elderly or Disabled Credit', stepId: 'elderly_disabled', isCommon: false,
    description: 'Are you (or your spouse) age 65+ or permanently and totally disabled?',
    icon: <UserCheck className="w-5 h-5" />, group: 'income_based',
    getSummary: (_, calc) => {
      const amt = calc?.credits?.elderlyDisabledCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
  {
    key: 'prior_year_amt_credit', label: 'Prior Year AMT Credit', stepId: 'prior_year_amt_credit', isCommon: false,
    description: 'Did you pay Alternative Minimum Tax (AMT) in a prior year due to timing items like ISO exercises?',
    icon: <Calculator className="w-5 h-5" />, group: 'income_based',
    getSummary: (_, calc) => {
      const amt = calc?.credits?.priorYearMinTaxCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
  {
    key: 'foreign_tax_credit', label: 'Foreign Tax Credit', stepId: 'foreign_tax_credit', isCommon: false,
    description: 'Did you pay income tax to a foreign country?',
    icon: <Globe className="w-5 h-5" />, group: 'income_based',
    getSummary: (_, calc) => {
      const amt = calc?.credits?.foreignTaxCredit || 0;
      return amt > 0 ? `$${amt.toLocaleString()} credit` : '';
    },
  },
];

export default function CreditsOverviewStep() {
  const { taxReturn, returnId, updateField, goToStep } = useTaxReturnStore();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  if (!taxReturn || !returnId) return null;

  const discovery = taxReturn.incomeDiscovery;
  const filingStatus = taxReturn.filingStatus || FilingStatus.Single;

  const calcResult = useMemo(() => {
    try { return calculateForm1040(taxReturn); } catch { return null; }
  }, [taxReturn]);

  const agi = calcResult?.form1040?.agi;
  const totalCredits = calcResult?.credits?.totalCredits || 0;

  const setAnswer = (key: string, value: 'yes' | 'no' | 'later' | undefined) => {
    updateField('incomeDiscovery', { ...discovery, [key]: value });
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const save = async () => {
    await updateReturn(returnId, { incomeDiscovery: taxReturn.incomeDiscovery });
  };

  const yesCount = CREDIT_QUESTIONS.filter(q => discovery[q.key] === 'yes').length;

  const groupActiveCount = (groupId: string) =>
    CREDIT_QUESTIONS.filter(q => q.group === groupId && discovery[q.key] === 'yes').length;

  const getAgiExceeded = (q: CreditQuestion): boolean => {
    if (!q.agiLimit || agi == null) return false;
    const limit = q.agiLimit[filingStatus as FilingStatus];
    return limit != null && agi > limit;
  };

  const filteredQuestions = searchQuery
    ? CREDIT_QUESTIONS.filter(q =>
        q.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const renderCreditCard = (q: CreditQuestion) => {
    const answer = discovery[q.key];
    const summary = q.getSummary(taxReturn, calcResult);
    const isExpanded = expandedKey === q.key;
    const isActive = answer === 'yes';
    const hasData = !!summary;
    const agiExceeded = getAgiExceeded(q);

    return (
      <div key={q.key} className={`rounded-lg border border-slate-700 overflow-hidden ${agiExceeded ? 'opacity-50' : ''}`}>
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
              <span className={`font-medium text-sm ${isActive ? 'text-slate-200' : agiExceeded ? 'text-slate-500' : 'text-slate-400'}`}>
                {q.label}
              </span>
              {q.isCommon === false && answer !== 'yes' && !hasData && !agiExceeded && (
                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-normal whitespace-nowrap">
                  not common
                </span>
              )}
              {q.isAutoCalculated && (
                <span className="text-[10px] text-telos-blue-400 bg-telos-blue-600/10 px-1.5 py-0.5 rounded font-normal whitespace-nowrap">
                  auto
                </span>
              )}
            </div>
            {hasData && (
              <div className="text-xs text-slate-400 mt-0.5">{summary}</div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isActive && hasData && !q.isAutoCalculated && (
              <button
                onClick={(e) => { e.stopPropagation(); goToStep(q.stepId); }}
                className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-3 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors"
              >
                Revisit
              </button>
            )}
            {isActive && !hasData && !q.isAutoCalculated && (
              <button
                onClick={(e) => { e.stopPropagation(); goToStep(q.stepId); }}
                className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-3 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors"
              >
                Start
              </button>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 py-3 bg-surface-900 border-t border-slate-700">
            <p className="text-sm text-slate-400 mb-3">{q.description}</p>
            {agiExceeded ? (
              <p className="text-xs text-slate-500">
                Not available — your AGI of ${agi!.toLocaleString()} exceeds the income limit for this credit.
              </p>
            ) : (
              <>
                <PillToggle
                  value={answer}
                  onChange={(val) => setAnswer(q.key, val)}
                />
                {answer === 'yes' && !hasData && !q.isAutoCalculated && (
                  <p className="text-xs text-telos-blue-400 mt-2 flex items-center gap-1">
                    <PenLine className="w-3 h-3" />
                    Click "Start" above or continue to enter your data.
                  </p>
                )}
                {answer === 'yes' && hasData && (
                  <p className="text-xs text-telos-orange-400 mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {q.isAutoCalculated ? 'Calculated automatically from your income.' : 'Data entered. Click "Revisit" to make changes.'}
                  </p>
                )}
                {answer === 'no' && (
                  <p className="text-xs text-slate-400 mt-2">Got it — we won't include this credit.</p>
                )}
                {answer === 'later' && (
                  <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3" />
                    No worries — we'll include this section so you can decide later.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <StepWarningsBanner stepId="credits_overview" />

      <SectionIntro icon={<Award className="w-8 h-8" />} title="Tax Credits" description="Credits directly reduce your tax bill. Select any that apply to you." />



      {/* Consolidated info callout */}
      <div className="rounded-lg border border-telos-blue-600/30 bg-telos-blue-600/10 mt-4 mb-4 p-4">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-telos-blue-300" />
          <div className="text-sm text-slate-400 leading-relaxed space-y-2">
            <p>
              <span className="font-medium text-telos-blue-300">How credits work:</span>{' '}
              Tax credits reduce your tax dollar-for-dollar — much more valuable than deductions. Some credits are <strong className="text-slate-300">refundable</strong> (EITC, ACTC, AOTC) meaning you get the money even if you owe no tax.{' '}
              <a href="https://www.irs.gov/credits-deductions-for-individuals" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
                <ExternalLink className="w-3 h-3" />Learn more on IRS.gov
              </a>
            </p>
            <p>
              Some credits have AGI limits — we'll automatically dim credits you don't qualify for based on your income.
            </p>
          </div>
        </div>
      </div>

      {/* Status callout */}
      {(yesCount > 0 || totalCredits > 0) && (
        <div className="card mt-4 text-center bg-telos-orange-500/5 border-telos-orange-500/20">
          {totalCredits > 0 ? (
            <>
              <p className="text-sm text-slate-300">
                <span className="text-telos-orange-400 font-bold">${totalCredits.toLocaleString()}</span> in total credits
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {yesCount} {yesCount === 1 ? 'credit' : 'credits'} selected
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-300">
              <span className="text-telos-orange-400 font-bold">{yesCount}</span>{' '}
              {yesCount === 1 ? 'credit' : 'credits'} selected
            </p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search credits..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Credit categories */}
      {filteredQuestions ? (
        <div className="space-y-2 mt-4">
          {filteredQuestions.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No matching credits found.</p>
          )}
          {filteredQuestions.map(renderCreditCard)}
        </div>
      ) : (
        <div className="space-y-4 mt-4">
          {CREDIT_GROUPS.map((group) => {
            const groupQuestions = CREDIT_QUESTIONS.filter(q => q.group === group.id);
            if (groupQuestions.length === 0) return null;

            const isCollapsed = collapsedGroups[group.id] ?? false;
            const activeCount = groupActiveCount(group.id);

            return (
              <div key={group.id}>
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
                  <span className="text-xs text-slate-600 hidden sm:inline">{group.description}</span>
                  <div className="ml-auto">
                    {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="space-y-2">
                    {groupQuestions.map(renderCreditCard)}
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
