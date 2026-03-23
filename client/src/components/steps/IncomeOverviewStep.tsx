import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import LearnMoreModal from '../common/LearnMoreModal';
import PillToggle from '../common/PillToggle';
import {
  DollarSign, Briefcase, Building2, Building, Landmark, TrendingUp,
  CircleDollarSign, Coins, Search, ChevronDown, ChevronUp,
  Check, PenLine, PiggyBank, FileSpreadsheet, HelpCircle, Info,
  BarChart3, ShieldCheck, Home, HeartPulse, Wallet, Dices, FileX, GraduationCap, Globe,
  ArrowRightLeft, Wheat, Ticket, CalendarClock, Music
} from 'lucide-react';
import { ReactNode } from 'react';

interface LearnMore {
  title: string;
  explanation: string;
  irsUrl?: string;
}

interface IncomeCategory {
  key: string;
  stepId: string;
  label: string;
  description: string;
  icon: ReactNode;
  group: string;
  getCount: (taxReturn: any) => number;
  getSummary: (taxReturn: any) => string;
  learnMore?: LearnMore;
  isCommon?: boolean;
}

interface IncomeCategoryGroup {
  id: string;
  label: string;
  description: string;
}

const INCOME_GROUPS: IncomeCategoryGroup[] = [
  { id: 'wages', label: 'Wages & Employment', description: 'W-2 wages and salary' },
  { id: 'self_employment', label: 'Self-Employment & Freelance', description: 'Independent contractor and gig income' },
  { id: 'interest_dividends', label: 'Interest & Dividends', description: 'Bank interest, bonds, and stock dividends' },
  { id: 'investments', label: 'Investments', description: 'Stock sales, crypto, and business pass-throughs' },
  { id: 'retirement', label: 'Retirement & Benefits', description: 'Pensions, Social Security, and government payments' },
  { id: 'property', label: 'Property & Farming', description: 'Real estate, rentals, and farm income' },
  { id: 'health_education', label: 'Health & Education', description: 'HSA and 529 plan distributions' },
  { id: 'other', label: 'Other Income', description: 'Less common income types' },
];

const INCOME_CATEGORIES: IncomeCategory[] = [
  // Employment & Self-Employment
  {
    key: 'w2', stepId: 'w2_income', group: 'wages',
    label: 'Employment Income (W-2)',
    description: 'Wages, salary, or tips from an employer',
    icon: <Building2 className="w-5 h-5" />,
    getCount: (tr) => tr.w2Income?.length || 0,
    getSummary: (tr) => {
      const total = (tr.w2Income || []).reduce((s: number, w: any) => s + w.wages, 0);
      return total > 0 ? `$${total.toLocaleString()} in wages` : '';
    },
    learnMore: {
      title: 'What is a W-2?',
      explanation: 'A W-2 is the form your employer sends you each January showing your total wages and the taxes withheld during the year. You should receive one from each employer you worked for. If you earned more than $600 from any employer, they are required to send you a W-2 by January 31.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-w-2',
    },
  },
  {
    key: '1099nec', stepId: '1099nec_income', group: 'self_employment',
    label: 'Nonemployee Compensation (1099-NEC)',
    description: 'Independent contractor or self-employment income',
    icon: <Briefcase className="w-5 h-5" />,
    getCount: (tr) => tr.income1099NEC?.length || 0,
    getSummary: (tr) => {
      const total = (tr.income1099NEC || []).reduce((s: number, i: any) => s + i.amount, 0);
      return total > 0 ? `$${total.toLocaleString()} in 1099-NEC income` : '';
    },
    learnMore: {
      title: 'What is a 1099-NEC?',
      explanation: 'A 1099-NEC (Nonemployee Compensation) reports income you earned as an independent contractor or self-employed person. If a client or business paid you $600 or more, they must send you this form. This income is subject to both income tax and self-employment tax (Social Security + Medicare).',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-nec',
    },
  },
  {
    key: '1099k', stepId: '1099k_income', group: 'self_employment',
    label: 'Platform Income (1099-K)',
    description: 'Income from Stripe, PayPal, Etsy, etc.',
    icon: <CircleDollarSign className="w-5 h-5" />,
    getCount: (tr) => tr.income1099K?.length || 0,
    getSummary: (tr) => {
      const total = (tr.income1099K || []).reduce((s: number, i: any) => s + i.grossAmount, 0);
      return total > 0 ? `$${total.toLocaleString()} in platform income` : '';
    },
    learnMore: {
      title: 'What is a 1099-K?',
      explanation: 'A 1099-K reports payments you received through third-party payment platforms like PayPal, Stripe, Venmo, or marketplace platforms like Etsy and eBay. For 2025, platforms must report if you received more than $20,000 in payments and had more than 200 transactions. The gross amount on the form may include refunds and fees — your actual taxable income may be lower.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-k',
    },
  },
  {
    key: '1099misc', stepId: '1099misc_income', group: 'self_employment',
    label: 'Miscellaneous (1099-MISC)',
    description: 'Prizes, awards, rents, royalties, other income',
    icon: <FileSpreadsheet className="w-5 h-5" />,
    getCount: (tr) => tr.income1099MISC?.length || 0,
    getSummary: (tr) => {
      const total = (tr.income1099MISC || []).reduce((s: number, m: any) => s + m.otherIncome, 0);
      return total > 0 ? `$${total.toLocaleString()} in misc income` : '';
    },
    learnMore: {
      title: 'What is a 1099-MISC?',
      explanation: 'A 1099-MISC reports miscellaneous income that doesn\'t fit other 1099 categories. Common examples include prizes and awards, rental income, royalties, and crop insurance proceeds. Since 2020, most independent contractor income has moved to the 1099-NEC instead.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-misc',
    },
  },

  // Investments & Savings
  {
    key: '1099int', stepId: '1099int_income', group: 'interest_dividends',
    label: 'Interest (1099-INT)',
    description: 'Bank account interest, CD interest',
    icon: <Landmark className="w-5 h-5" />,
    getCount: (tr) => tr.income1099INT?.length || 0,
    getSummary: (tr) => {
      const total = (tr.income1099INT || []).reduce((s: number, i: any) => s + i.amount, 0);
      return total > 0 ? `$${total.toLocaleString()} in interest` : '';
    },
    learnMore: {
      title: 'What is a 1099-INT?',
      explanation: 'A 1099-INT reports interest income you earned from bank accounts, certificates of deposit (CDs), or other interest-bearing investments. Banks and financial institutions send this form if you earned $10 or more in interest during the year. This is taxed as ordinary income.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-int',
    },
  },
  {
    key: '1099div', stepId: '1099div_income', group: 'interest_dividends',
    label: 'Dividends (1099-DIV)',
    description: 'Stock dividends, mutual fund distributions',
    icon: <TrendingUp className="w-5 h-5" />,
    getCount: (tr) => tr.income1099DIV?.length || 0,
    getSummary: (tr) => {
      const total = (tr.income1099DIV || []).reduce((s: number, i: any) => s + i.ordinaryDividends, 0);
      return total > 0 ? `$${total.toLocaleString()} in dividends` : '';
    },
    learnMore: {
      title: 'What is a 1099-DIV?',
      explanation: 'A 1099-DIV reports dividend income from stocks, mutual funds, and other investments. Qualified dividends are taxed at lower capital gains rates, while ordinary dividends are taxed at your regular income tax rate. Your brokerage will send this form if you received $10 or more in dividends.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-div',
    },
  },
  {
    key: '1099oid', stepId: '1099oid_income', group: 'interest_dividends',
    label: 'Original Issue Discount (1099-OID)', isCommon: false,
    description: 'OID from bonds or debt instruments issued at a discount',
    icon: <Ticket className="w-5 h-5" />,
    getCount: (tr) => (tr as any).income1099OID?.length || 0,
    getSummary: (tr) => {
      const total = ((tr as any).income1099OID || []).reduce((s: number, o: any) => s + (o.originalIssueDiscount || 0), 0);
      return total > 0 ? `$${total.toLocaleString()} in OID` : '';
    },
    learnMore: {
      title: 'What is a 1099-OID?',
      explanation: 'A 1099-OID reports original issue discount on bonds and other debt instruments purchased below face value. OID is accrued as taxable interest income each year, even if you don\'t receive a payment until maturity.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-oid',
    },
  },
  {
    key: '1099b', stepId: '1099b_income', group: 'investments',
    label: 'Capital Gains (1099-B)',
    description: 'Stock sales, crypto, investment transactions',
    icon: <BarChart3 className="w-5 h-5" />,
    getCount: (tr) => tr.income1099B?.length || 0,
    getSummary: (tr) => {
      const total = (tr.income1099B || []).reduce((s: number, b: any) => s + (b.proceeds - b.costBasis), 0);
      return total !== 0 ? `${total >= 0 ? '+' : '-'}$${Math.abs(total).toLocaleString()} net` : '';
    },
    learnMore: {
      title: 'What is a 1099-B?',
      explanation: 'A 1099-B reports proceeds from the sale of stocks, bonds, mutual funds, cryptocurrency, and other investments. Your broker or exchange sends this form showing sale prices and cost basis. Short-term gains (held 1 year or less) are taxed as ordinary income, while long-term gains (held more than 1 year) get preferential rates of 0%, 15%, or 20%. Net losses can offset up to $3,000 of other income.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-b',
    },
  },
  {
    key: '1099da', stepId: '1099da_income', group: 'investments',
    label: 'Digital Assets (1099-DA)', isCommon: false,
    description: 'Cryptocurrency sales, trades, and dispositions',
    icon: <Coins className="w-5 h-5" />,
    getCount: (tr) => tr.income1099DA?.length || 0,
    getSummary: (tr) => {
      const total = (tr.income1099DA || []).reduce((s: number, d: any) => s + (d.proceeds - d.costBasis), 0);
      return total !== 0 ? `${total >= 0 ? '+' : '-'}$${Math.abs(total).toLocaleString()} net` : '';
    },
    learnMore: {
      title: 'What is a 1099-DA?',
      explanation: 'Starting in 2025, the IRS requires crypto exchanges to issue Form 1099-DA (Digital Assets) for cryptocurrency and digital asset transactions. This form reports the proceeds from sales, trades, and dispositions of digital assets like Bitcoin, Ethereum, and NFTs. Short-term gains (held 1 year or less) are taxed as ordinary income, while long-term gains (held more than 1 year) get preferential rates of 0%, 15%, or 20%. Net losses can offset up to $3,000 of other income per year.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-da',
    },
  },
  {
    key: 'k1', stepId: 'k1_income', group: 'investments',
    label: 'Partnership / S-Corp (K-1)', isCommon: false,
    description: 'Income from partnerships or S-Corporations',
    icon: <FileSpreadsheet className="w-5 h-5" />,
    getCount: (tr) => tr.incomeK1?.length || 0,
    getSummary: (tr) => {
      const total = (tr.incomeK1 || []).reduce((s: number, k: any) =>
        s + (k.ordinaryBusinessIncome || 0) + (k.guaranteedPayments || 0), 0);
      return total !== 0 ? `$${total.toLocaleString()} in K-1 income` : '';
    },
    learnMore: {
      title: 'What is a Schedule K-1?',
      explanation: 'A Schedule K-1 reports your share of income, deductions, and credits from a partnership (Form 1065) or S-Corporation (Form 1120-S). Partnerships may subject your income to self-employment tax, while S-Corp income is not subject to SE tax since shareholders receive W-2 wages. K-1 income can include ordinary business income, rental income, interest, dividends, and capital gains.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1065',
    },
  },

  // Retirement & Benefits
  {
    key: '1099r', stepId: '1099r_income', group: 'retirement',
    label: 'Retirement Distributions (1099-R)',
    description: 'Distributions from pensions, IRAs, 401(k)s',
    icon: <PiggyBank className="w-5 h-5" />,
    getCount: (tr) => tr.income1099R?.length || 0,
    getSummary: (tr) => {
      const total = (tr.income1099R || []).reduce((s: number, r: any) => s + r.taxableAmount, 0);
      return total > 0 ? `$${total.toLocaleString()} taxable` : '';
    },
    learnMore: {
      title: 'What is a 1099-R?',
      explanation: 'A 1099-R reports distributions (withdrawals) from retirement accounts like pensions, IRAs, 401(k)s, and annuities. The distribution code on the form tells the IRS why you took the money out — some withdrawals are tax-free (like Roth IRA qualified distributions), while others are fully taxable.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-r',
    },
  },
  {
    key: 'ssa1099', stepId: 'ssa1099_income', group: 'retirement',
    label: 'Social Security (SSA-1099)',
    description: 'Social Security retirement, disability, or survivor benefits',
    icon: <ShieldCheck className="w-5 h-5" />,
    getCount: (tr) => tr.incomeSSA1099?.totalBenefits ? 1 : 0,
    getSummary: (tr) => {
      const amt = tr.incomeSSA1099?.totalBenefits || 0;
      return amt > 0 ? `$${amt.toLocaleString()} in benefits` : '';
    },
    learnMore: {
      title: 'What is an SSA-1099?',
      explanation: 'An SSA-1099 reports Social Security benefits you received during the year. Depending on your total income, between 0% and 85% of your benefits may be taxable. If Social Security was your only income, it\'s usually not taxable. The IRS uses a formula based on your "provisional income" to determine the taxable portion.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-ssa-1099',
    },
  },
  {
    key: '1099g', stepId: '1099g_income', group: 'retirement',
    label: 'Unemployment (1099-G)',
    description: 'Unemployment compensation, government payments',
    icon: <Landmark className="w-5 h-5" />,
    getCount: (tr) => tr.income1099G?.length || 0,
    getSummary: (tr) => {
      const total = (tr.income1099G || []).reduce((s: number, g: any) => s + g.unemploymentCompensation, 0);
      return total > 0 ? `$${total.toLocaleString()} in unemployment` : '';
    },
    learnMore: {
      title: 'What is a 1099-G?',
      explanation: 'A 1099-G reports certain government payments, most commonly unemployment compensation. Unemployment benefits are taxable income at the federal level. You may have had taxes withheld from your payments — check Box 4 of your form. State tax refunds may also appear on a 1099-G if you itemized deductions the previous year.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-g',
    },
  },

  // Property & Real Estate
  {
    key: 'home_sale', stepId: 'home_sale', group: 'property',
    label: 'Home Sale',
    description: 'Did you sell your primary residence in 2025?',
    icon: <Home className="w-5 h-5" />,
    getCount: (tr) => tr.homeSale?.salePrice ? 1 : 0,
    getSummary: (tr) => {
      const sp = tr.homeSale?.salePrice || 0;
      return sp > 0 ? `$${sp.toLocaleString()} sale price` : '';
    },
    learnMore: {
      title: 'Home Sale Exclusion (Section 121)',
      explanation: 'If you sold your primary residence, you may be able to exclude up to $250,000 of gain ($500,000 if married filing jointly) from your income. To qualify, you must have owned and used the home as your main residence for at least 2 of the last 5 years.',
      irsUrl: 'https://www.irs.gov/taxtopics/tc701',
    },
  },
  {
    key: 'rental', stepId: 'rental_income', group: 'property',
    label: 'Rental Income (Sch E)',
    description: 'Income from rental properties you own',
    icon: <Building className="w-5 h-5" />,
    getCount: (tr) => tr.rentalProperties?.length || 0,
    getSummary: (tr) => {
      const total = (tr.rentalProperties || []).reduce((s: number, r: any) => s + r.rentalIncome, 0);
      return total > 0 ? `$${total.toLocaleString()} in rental income` : '';
    },
    learnMore: {
      title: 'What is Schedule E?',
      explanation: 'Schedule E reports income and expenses from rental real estate. You can deduct expenses like mortgage interest, repairs, insurance, taxes, and depreciation. If your expenses exceed your income, you may be able to deduct up to $25,000 of passive losses against other income (subject to AGI phase-out between $100,000-$150,000).',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-schedule-e-form-1040',
    },
  },
  {
    key: 'royalty',
    stepId: 'royalty_income',
    label: 'Royalty Income (Sch E)',
    description: 'Oil & gas, minerals, books, music, patents, timber, and other royalties',
    icon: <Music className="w-5 h-5" />,
    group: 'property',
    getCount: (tr) => (tr.royaltyProperties || []).length,
    getSummary: (tr) => {
      const props = tr.royaltyProperties || [];
      if (props.length === 0) return '';
      const total = props.reduce((s: number, p: any) => s + (p.royaltyIncome || 0), 0);
      return `${props.length} source${props.length > 1 ? 's' : ''} · $${total.toLocaleString()}`;
    },
    learnMore: {
      title: 'What is Royalty Income?',
      explanation: 'Royalty income is payment you receive for the use of your property — such as oil & gas leases, mineral rights, book publishing, music licensing, or patents. Royalties are reported on Schedule E, Part I (Line 4) and are not subject to self-employment tax. You can deduct related expenses like depletion, management fees, and legal costs directly against the income.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-schedule-e-form-1040',
    },
  },

  // Other Income
  {
    key: '1099sa', stepId: '1099sa_income', group: 'health_education',
    label: 'HSA Distributions (1099-SA)',
    description: 'Distributions from a Health Savings Account',
    icon: <HeartPulse className="w-5 h-5" />,
    getCount: (tr) => tr.income1099SA?.length || 0,
    getSummary: (tr) => {
      const total = (tr.income1099SA || []).reduce((s: number, d: any) => s + d.grossDistribution, 0);
      return total > 0 ? `$${total.toLocaleString()} distributed` : '';
    },
    learnMore: {
      title: 'What is a 1099-SA?',
      explanation: 'A 1099-SA reports distributions from a Health Savings Account (HSA). If you used the money for qualified medical expenses, the distribution is completely tax-free. If not, it\'s added to your taxable income and may be subject to a 20% additional penalty unless you\'re 65 or older, disabled, or the distribution is due to death.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-sa',
    },
  },
  {
    key: 'w2g', stepId: 'w2g_income', group: 'other',
    label: 'Gambling Winnings (W-2G)', isCommon: false,
    description: 'Casino, lottery, horse racing, or other gambling winnings',
    icon: <Dices className="w-5 h-5" />,
    getCount: (tr) => tr.incomeW2G?.length || 0,
    getSummary: (tr) => {
      const total = (tr.incomeW2G || []).reduce((s: number, w: any) => s + w.grossWinnings, 0);
      return total > 0 ? `$${total.toLocaleString()} in winnings` : '';
    },
    learnMore: {
      title: 'What is a W-2G?',
      explanation: 'A W-2G reports gambling winnings from casinos, lotteries, horse racing, and other wagering activities. You receive one if your winnings exceed certain thresholds (e.g., $1,200 for slot machines, $5,000 for poker tournaments). All gambling income is taxable, even if you don\'t receive a W-2G. You can deduct gambling losses but only up to the amount of your winnings.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-w-2g',
    },
  },
  {
    key: '1099c', stepId: '1099c_income', group: 'other',
    label: 'Cancelled Debt (1099-C)',
    description: 'Credit card, mortgage, or other debt forgiven by a lender',
    icon: <FileX className="w-5 h-5" />,
    getCount: (tr) => tr.income1099C?.length || 0,
    getSummary: (tr) => {
      const total = (tr.income1099C || []).reduce((s: number, c: any) => s + c.amountCancelled, 0);
      return total > 0 ? `$${total.toLocaleString()} cancelled` : '';
    },
    learnMore: {
      title: 'What is a 1099-C?',
      explanation: 'A 1099-C reports debt that has been cancelled or forgiven by a creditor. In most cases, cancelled debt is treated as taxable income. However, exceptions exist for bankruptcy, insolvency, qualified principal residence indebtedness, and certain farm debts.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-c',
    },
  },
  {
    key: '1099q', stepId: '1099q_income', group: 'health_education',
    label: '529 Distributions (1099-Q)',
    description: 'Distributions from a 529 education savings plan',
    icon: <GraduationCap className="w-5 h-5" />,
    getCount: (tr) => tr.income1099Q?.length || 0,
    getSummary: (tr) => {
      const total = (tr.income1099Q || []).reduce((s: number, q: any) => s + q.grossDistribution, 0);
      return total > 0 ? `$${total.toLocaleString()} distributed` : '';
    },
    learnMore: {
      title: 'What is a 1099-Q?',
      explanation: 'A 1099-Q reports distributions from qualified tuition programs (529 plans). If the distribution is used for qualified education expenses, it\'s tax-free. If not, the earnings portion is taxable and may be subject to a 10% additional tax.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-q',
    },
  },
  {
    key: 'foreign_income', stepId: 'foreign_earned_income', group: 'other',
    label: 'Foreign Earned Income (2555)', isCommon: false,
    description: 'Income earned while living and working abroad',
    icon: <Globe className="w-5 h-5" />,
    getCount: (tr) => tr.foreignEarnedIncome?.foreignEarnedIncome ? 1 : 0,
    getSummary: (tr) => {
      const amt = tr.foreignEarnedIncome?.foreignEarnedIncome || 0;
      return amt > 0 ? `$${amt.toLocaleString()} foreign income` : '';
    },
    learnMore: {
      title: 'What is the Foreign Earned Income Exclusion?',
      explanation: 'If you live and work abroad, you may be able to exclude up to $130,000 (2025) of foreign earned income from U.S. tax using Form 2555. You must meet either the bona fide residence test or the physical presence test (330 full days abroad in a 12-month period).',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-2555',
    },
  },
  {
    key: 'form4797', stepId: 'form4797', group: 'other',
    label: 'Business Property Sales (4797)', isCommon: false,
    description: 'Sale of equipment, vehicles, or real estate used in business',
    icon: <ArrowRightLeft className="w-5 h-5" />,
    getCount: (tr) => tr.form4797Properties?.length || 0,
    getSummary: (tr) => {
      const count = tr.form4797Properties?.length || 0;
      return count > 0 ? `${count} ${count === 1 ? 'property' : 'properties'}` : '';
    },
    learnMore: {
      title: 'What is Form 4797?',
      explanation: 'Form 4797 reports the sale or disposition of business property, including equipment (Section 1245) and real estate (Section 1250). Gains may be treated as ordinary income to the extent of prior depreciation (depreciation recapture), with remaining gain treated as capital gain under Section 1231.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-4797',
    },
  },
  {
    key: 'schedule_f', stepId: 'schedule_f', group: 'property',
    label: 'Farm Income (Sch F)', isCommon: false,
    description: 'Income and expenses from a farming operation',
    icon: <Wheat className="w-5 h-5" />,
    getCount: (tr) => tr.scheduleF ? 1 : 0,
    getSummary: (tr) => {
      const sf = tr.scheduleF;
      if (!sf) return '';
      const income = (sf.salesOfLivestock || 0) + (sf.salesOfProducts || 0) + (sf.otherFarmIncome || 0);
      return income > 0 ? `$${income.toLocaleString()} gross farm income` : '';
    },
    learnMore: {
      title: 'What is Schedule F?',
      explanation: 'Schedule F is used to report income and expenses from farming operations. This includes sales of livestock, crops, and other agricultural products, as well as farm-related expenses like feed, seed, fertilizer, and equipment. Net farm income is subject to both income tax and self-employment tax.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-schedule-f-form-1040',
    },
  },
  {
    key: 'farm_rental', stepId: 'farm_rental', group: 'property',
    label: 'Farm Rental (4835)', isCommon: false,
    description: 'Rental income from farmland you own but don\'t actively farm',
    icon: <Wheat className="w-5 h-5" />,
    getCount: (tr) => (tr as any).farmRentals?.length || 0,
    getSummary: (tr) => {
      const count = (tr as any).farmRentals?.length || 0;
      return count > 0 ? `${count} farm ${count === 1 ? 'rental' : 'rentals'}` : '';
    },
    learnMore: {
      title: 'What is Form 4835?',
      explanation: 'Form 4835 reports farm rental income when you own farmland but rent it to a tenant farmer and do not materially participate in farming. This income is passive and flows to Schedule E.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-4835',
    },
  },
  {
    key: 'installment_sale', stepId: 'installment_sale', group: 'other',
    label: 'Installment Sales (6252)', isCommon: false,
    description: 'Property sold with payments received over multiple years',
    icon: <CalendarClock className="w-5 h-5" />,
    getCount: (tr) => (tr as any).installmentSales?.length || 0,
    getSummary: (tr) => {
      const count = (tr as any).installmentSales?.length || 0;
      return count > 0 ? `${count} installment ${count === 1 ? 'sale' : 'sales'}` : '';
    },
    learnMore: {
      title: 'What is Form 6252?',
      explanation: 'Form 6252 reports income from sales where you receive payments over multiple years. Each year, you report a portion of the gain based on payments received times the gross profit ratio.',
      irsUrl: 'https://www.irs.gov/forms-pubs/about-form-6252',
    },
  },
  {
    key: 'other', stepId: 'other_income', group: 'other',
    label: 'Other Income',
    description: 'Any other income not covered above',
    icon: <Wallet className="w-5 h-5" />,
    getCount: (tr) => (tr.otherIncome || 0) > 0 ? 1 : 0,
    getSummary: (tr) => {
      const amt = tr.otherIncome || 0;
      return amt > 0 ? `$${amt.toLocaleString()} in other income` : '';
    },
    learnMore: {
      title: 'What counts as "Other Income"?',
      explanation: 'Other income includes any taxable income not reported on a specific 1099 form. Common examples include gambling winnings, jury duty pay, hobby income, Alaska Permanent Fund dividends, and cancelled debts. If you received money and aren\'t sure if it\'s taxable, it likely goes here.',
      irsUrl: 'https://www.irs.gov/taxtopics/tc400',
    },
  },
];

export default function IncomeOverviewStep() {
  const { taxReturn, returnId, updateField, goToStep } = useTaxReturnStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [learnMoreOpen, setLearnMoreOpen] = useState<LearnMore | null>(null);

  if (!taxReturn || !returnId) return null;

  const discovery = taxReturn.incomeDiscovery;

  const setAnswer = (key: string, value: 'yes' | 'no' | 'later' | undefined) => {
    const updated = { ...discovery, [key]: value };
    updateField('incomeDiscovery', updated);
  };

  const save = async () => {
    await updateReturn(returnId, { incomeDiscovery: taxReturn.incomeDiscovery });
  };

  // Calculate total income for the summary card
  const totalIncome =
    (taxReturn.w2Income || []).reduce((s, w) => s + w.wages, 0) +
    (taxReturn.income1099NEC || []).reduce((s, i) => s + i.amount, 0) +
    (taxReturn.income1099K || []).reduce((s, i) => s + i.grossAmount, 0) +
    (taxReturn.income1099INT || []).reduce((s, i) => s + i.amount, 0) +
    (taxReturn.income1099DIV || []).reduce((s, i) => s + i.ordinaryDividends, 0) +
    (taxReturn.income1099R || []).reduce((s: number, r: any) => s + r.taxableAmount, 0) +
    (taxReturn.income1099G || []).reduce((s: number, g: any) => s + g.unemploymentCompensation, 0) +
    (taxReturn.income1099MISC || []).reduce((s: number, m: any) => s + m.otherIncome, 0) +
    (taxReturn.income1099B || []).reduce((s: number, b: any) => s + (b.proceeds - b.costBasis), 0) +
    (taxReturn.income1099DA || []).reduce((s: number, d: any) => s + (d.proceeds - d.costBasis), 0) +
    (taxReturn.incomeSSA1099?.totalBenefits || 0) +
    (taxReturn.incomeK1 || []).reduce((s: number, k: any) => s + (k.ordinaryBusinessIncome || 0) + (k.guaranteedPayments || 0), 0) +
    (taxReturn.income1099SA || []).reduce((s: number, d: any) => s + d.grossDistribution, 0) +
    (taxReturn.rentalProperties || []).reduce((s: number, r: any) => s + r.rentalIncome, 0) +
    (taxReturn.otherIncome || 0);

  const activeCategories = INCOME_CATEGORIES.filter(c => discovery[c.key] === 'yes');
  const hasAnyIncome = totalIncome > 0;

  // Filter categories by search
  const filteredCategories = INCOME_CATEGORIES.filter(c =>
    !searchQuery || c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group management: track which groups are collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Check if any category in a group has discovery === 'yes' or has data
  const groupHasActivity = (groupId: string) =>
    INCOME_CATEGORIES.filter(c => c.group === groupId).some(
      c => discovery[c.key] === 'yes' || c.getCount(taxReturn) > 0
    );

  // Count active items in group (for badge)
  const groupActiveCount = (groupId: string) =>
    INCOME_CATEGORIES.filter(c => c.group === groupId && discovery[c.key] === 'yes').length;

  // Render a single income category accordion row
  const renderCategoryRow = (cat: IncomeCategory) => {
    const answer = discovery[cat.key];
    const count = cat.getCount(taxReturn);
    const summary = cat.getSummary(taxReturn);
    const isExpanded = expandedKey === cat.key;
    const isActive = answer === 'yes';
    const hasData = count > 0;

    return (
      <div key={cat.key} className="rounded-lg border border-slate-700 overflow-hidden">
        {/* Accordion header */}
        <button
          onClick={() => setExpandedKey(isExpanded ? null : cat.key)}
          className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
            isActive ? 'bg-surface-800' : 'bg-surface-900 hover:bg-surface-800'
          }`}
        >
          <div className={`${isActive ? 'text-telos-orange-400' : 'text-slate-400'}`}>
            {cat.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-medium text-sm ${isActive ? 'text-slate-200' : 'text-slate-400'}`}>
                {cat.label}
              </span>
              {cat.isCommon === false && answer !== 'yes' && !hasData && (
                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-normal whitespace-nowrap">
                  not common
                </span>
              )}
              {hasData && (
                <span className="text-xs text-telos-orange-400 bg-telos-orange-500/10 px-2 py-0.5 rounded-full">
                  {count} {count === 1 ? 'form' : 'forms'}
                </span>
              )}
            </div>
            {hasData && summary && (
              <div className="text-xs text-slate-400 mt-0.5">{summary}</div>
            )}
          </div>

          {/* Status + action */}
          <div className="flex items-center gap-2 shrink-0">
            {hasData && (
              <button
                onClick={(e) => { e.stopPropagation(); goToStep(cat.stepId); }}
                className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-3 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors"
              >
                Revisit
              </button>
            )}
            {isActive && !hasData && (
              <button
                onClick={(e) => { e.stopPropagation(); goToStep(cat.stepId); }}
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

        {/* Accordion content — selection + details */}
        {isExpanded && (
          <div className="px-4 py-3 bg-surface-900 border-t border-slate-700">
            <p className="text-sm text-slate-400 mb-1">{cat.description}</p>
            {cat.learnMore && (
              <button
                type="button"
                onClick={() => setLearnMoreOpen(cat.learnMore!)}
                className="text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors flex items-center gap-1 mb-3"
              >
                <Info className="w-3 h-3" />
                Learn more
              </button>
            )}
            {!cat.learnMore && <div className="mb-2" />}
            <PillToggle
              value={answer}
              onChange={(val) => setAnswer(cat.key, val)}
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
                Got it — you won't need to report this.
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
        icon={<DollarSign className="w-8 h-8" />}
        title="Income"
        description="Tell us which types of income you received in 2025."
      />


      {/* Income summary card */}
      <div className="card mt-6 text-center">
        <div className="text-slate-400 text-sm mb-1">
          {hasAnyIncome ? 'Your income so far' : 'Your income'}
        </div>
        {hasAnyIncome ? (
          <div className="text-2xl font-bold text-white">${totalIncome.toLocaleString()}</div>
        ) : (
          <div className="text-slate-400 text-sm">
            No income entered yet. Select income types below to get started.
          </div>
        )}
        {activeCategories.length > 0 && (
          <div className="text-xs text-slate-400 mt-1">
            {activeCategories.length} income {activeCategories.length === 1 ? 'type' : 'types'} selected
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search income types..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Income categories — grouped by life category */}
      {searchQuery ? (
        /* Flat list when searching */
        <div className="space-y-2 mt-4">
          {filteredCategories.map(renderCategoryRow)}
        </div>
      ) : (
        /* Grouped view when not searching */
        <div className="space-y-4 mt-4">
          {INCOME_GROUPS.map((group) => {
            const groupCats = INCOME_CATEGORIES.filter(c => c.group === group.id);
            if (groupCats.length === 0) return null;

            const isCollapsed = collapsedGroups[group.id] ?? false;
            const hasActivity = groupHasActivity(group.id);
            const activeCount = groupActiveCount(group.id);

            // Auto-expand groups that have activity
            const showContent = hasActivity ? !isCollapsed : !isCollapsed;

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
                    {isCollapsed ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Group content */}
                {showContent && (
                  <div className="space-y-2">
                    {groupCats.map(renderCategoryRow)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {searchQuery && filteredCategories.length === 0 && (
        <div className="text-center text-slate-400 text-sm py-8">
          No income types match "{searchQuery}"
        </div>
      )}

      <StepNavigation onContinue={save} continueLabel="Done with income" />

      {/* Learn More Modal */}
      <LearnMoreModal
        open={!!learnMoreOpen}
        onClose={() => setLearnMoreOpen(null)}
        title={learnMoreOpen?.title || ''}
        explanation={learnMoreOpen?.explanation || ''}
        irsUrl={learnMoreOpen?.irsUrl}
      />
    </div>
  );
}
