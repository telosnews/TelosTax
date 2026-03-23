export interface TaxResource {
  title: string;
  description: string;
  url: string;
  icon: string;  // Lucide React icon name
}

export interface ResourceCategory {
  id: string;
  label: string;
  icon: string;  // Lucide React icon name
  resources: TaxResource[];
}

export const TAX_RESOURCES: ResourceCategory[] = [
  {
    id: 'irs_essentials',
    label: 'IRS Essentials',
    icon: 'Landmark',
    resources: [
      { title: 'IRS Free File', description: 'File your federal taxes for free if your income is $89,000 or less', url: 'https://www.irs.gov/filing/free-file-do-your-federal-taxes-for-free', icon: 'FileCheck' },
      { title: "Where's My Refund?", description: 'Check the status of your federal tax refund', url: 'https://www.irs.gov/refunds', icon: 'Search' },
      { title: 'IRS Forms & Instructions', description: 'Download any IRS tax form or publication', url: 'https://www.irs.gov/forms-instructions', icon: 'Download' },
      { title: 'Publication 17', description: 'The complete guide to federal income tax for individuals', url: 'https://www.irs.gov/publications/p17', icon: 'BookOpen' },
      { title: 'Interactive Tax Assistant', description: 'Get answers to common tax questions from the IRS', url: 'https://www.irs.gov/help/ita', icon: 'MessageCircle' },
    ],
  },
  {
    id: 'free_help',
    label: 'Free Tax Help',
    icon: 'Users',
    resources: [
      { title: 'VITA / TCE Site Locator', description: 'Find free in-person tax preparation help in your area', url: 'https://irs.treasury.gov/freetaxprep/', icon: 'MapPin' },
      { title: 'Taxpayer Advocate Service', description: 'Get help resolving tax problems with the IRS', url: 'https://www.taxpayeradvocate.irs.gov/', icon: 'Shield' },
      { title: 'Low Income Taxpayer Clinics', description: 'Free legal help for tax disputes if you meet income guidelines', url: 'https://www.taxpayeradvocate.irs.gov/about-us/low-income-taxpayer-clinics-litc/', icon: 'Scale' },
      { title: 'Tax Counseling for the Elderly', description: 'Free tax help for taxpayers age 60 and older', url: 'https://www.irs.gov/individuals/tax-counseling-for-the-elderly', icon: 'Heart' },
    ],
  },
  {
    id: 'payments_estimates',
    label: 'Payments & Estimates',
    icon: 'CreditCard',
    resources: [
      { title: 'IRS Direct Pay', description: 'Pay your taxes directly from your bank account — no fees', url: 'https://www.irs.gov/payments/direct-pay', icon: 'Landmark' },
      { title: 'Estimated Tax Payments (1040-ES)', description: 'Make quarterly estimated tax payments online', url: 'https://www.irs.gov/forms-pubs/about-form-1040-es', icon: 'Calendar' },
      { title: 'IRS Payment Plans', description: 'Set up a monthly installment agreement if you owe taxes', url: 'https://www.irs.gov/payments/online-payment-agreement-application', icon: 'Clock' },
      { title: 'Tax Withholding Estimator', description: 'Check if you are having the right amount of tax withheld from your paycheck', url: 'https://www.irs.gov/individuals/tax-withholding-estimator', icon: 'Calculator' },
    ],
  },
  {
    id: 'deadlines_extensions',
    label: 'Deadlines & Extensions',
    icon: 'CalendarDays',
    resources: [
      { title: 'Tax Calendar (Publication 509)', description: 'All key filing and payment dates for 2025', url: 'https://www.irs.gov/publications/p509', icon: 'Calendar' },
      { title: 'File an Extension (Form 4868)', description: 'Get an automatic 6-month extension to file your return', url: 'https://www.irs.gov/forms-pubs/about-form-4868', icon: 'CalendarPlus' },
      { title: 'Penalties for Late Filing', description: 'Understand failure-to-file and failure-to-pay penalties', url: 'https://www.irs.gov/payments/penalties', icon: 'AlertTriangle' },
    ],
  },
  {
    id: 'state_filing',
    label: 'State Tax Filing',
    icon: 'Map',
    resources: [
      { title: 'State Tax Agency Directory', description: 'Find your state tax department website', url: 'https://www.taxadmin.org/state-tax-agencies', icon: 'Building' },
      { title: 'States With No Income Tax', description: 'Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas, Washington, Wyoming', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/state-government-websites', icon: 'MapPin' },
    ],
  },
  {
    id: 'self_employment',
    label: 'Self-Employment',
    icon: 'Briefcase',
    resources: [
      { title: 'SE Tax Guide (Publication 334)', description: 'Tax guide for small business and self-employed individuals', url: 'https://www.irs.gov/publications/p334', icon: 'BookOpen' },
      { title: 'Business Expenses (Publication 535)', description: 'What business expenses you can and cannot deduct', url: 'https://www.irs.gov/publications/p535', icon: 'Receipt' },
      { title: 'Home Office Deduction (Publication 587)', description: 'Rules for claiming the home office deduction', url: 'https://www.irs.gov/publications/p587', icon: 'Home' },
      { title: 'Vehicle Expenses (Publication 463)', description: 'Standard mileage rate and actual expense rules', url: 'https://www.irs.gov/publications/p463', icon: 'Car' },
      { title: 'Do You Need an EIN?', description: 'Find out if your business needs an Employer Identification Number', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/do-you-need-an-ein', icon: 'Hash' },
    ],
  },
  {
    id: 'retirement_education',
    label: 'Retirement & Education',
    icon: 'GraduationCap',
    resources: [
      { title: 'Retirement Topics', description: 'IRA, 401(k), Roth, and other retirement plan tax rules', url: 'https://www.irs.gov/retirement-plans', icon: 'PiggyBank' },
      { title: 'Education Credits (Publication 970)', description: 'AOTC, Lifetime Learning, and other education tax benefits', url: 'https://www.irs.gov/publications/p970', icon: 'GraduationCap' },
      { title: 'Student Loan Interest Deduction', description: 'Rules for deducting student loan interest', url: 'https://www.irs.gov/taxtopics/tc456', icon: 'BookOpen' },
    ],
  },
];
