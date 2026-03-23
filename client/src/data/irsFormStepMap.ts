export interface IrsFormEntry {
  terms: string[];
  label: string;
  stepId: string;
  formId?: string;   // Maps to IRSFormTemplate.formId for Forms view navigation
}

// MAINTENANCE: This list is static. When adding new wizard steps or supporting
// new IRS forms/schedules, add a corresponding entry here so it appears in the
// Cmd+K command palette under "IRS Forms".
export const IRS_FORM_STEP_MAP: IrsFormEntry[] = [
  // Form 1040 lines
  { terms: ['form 1040', '1040', 'tax return'], label: 'Form 1040 — U.S. Individual Tax Return', stepId: 'review_form_1040', formId: 'f1040' },
  { terms: ['line 1', 'wages line'], label: 'Line 1 — Wages, Salaries, Tips', stepId: 'w2_income', formId: 'f1040' },
  { terms: ['line 8', 'other income line'], label: 'Line 8 — Other Income', stepId: 'other_income', formId: 'f1040' },
  { terms: ['line 9', 'total income'], label: 'Line 9 — Total Income', stepId: 'income_summary', formId: 'f1040' },
  { terms: ['line 11', 'agi', 'adjusted gross income'], label: 'Line 11 — Adjusted Gross Income (AGI)', stepId: 'income_summary', formId: 'f1040' },
  { terms: ['line 12', 'standard deduction', 'itemized deduction'], label: 'Line 12 — Standard or Itemized Deduction', stepId: 'deduction_method', formId: 'f1040' },
  { terms: ['line 15', 'tax'], label: 'Line 15 — Tax', stepId: 'tax_summary', formId: 'f1040' },

  // W-2
  { terms: ['w-2', 'w2', 'form w-2'], label: 'Form W-2 — Wage and Tax Statement', stepId: 'w2_income' },

  // 1099 series
  { terms: ['1099-nec', '1099nec', 'nonemployee compensation'], label: 'Form 1099-NEC — Nonemployee Compensation', stepId: '1099nec_income' },
  { terms: ['1099-k', '1099k', 'payment card'], label: 'Form 1099-K — Payment Card Transactions', stepId: '1099k_income' },
  { terms: ['1099-int', '1099int', 'interest income'], label: 'Form 1099-INT — Interest Income', stepId: '1099int_income' },
  { terms: ['1099-div', '1099div', 'dividend income', 'dividends'], label: 'Form 1099-DIV — Dividends', stepId: '1099div_income' },
  { terms: ['1099-r', '1099r', 'retirement distribution'], label: 'Form 1099-R — Retirement Distributions', stepId: '1099r_income' },
  { terms: ['1099-g', '1099g', 'unemployment'], label: 'Form 1099-G — Unemployment Compensation', stepId: '1099g_income' },
  { terms: ['1099-misc', '1099misc'], label: 'Form 1099-MISC — Miscellaneous Income', stepId: '1099misc_income' },
  { terms: ['1099-b', '1099b', 'capital gains', 'stock sales'], label: 'Form 1099-B — Proceeds from Broker', stepId: '1099b_income' },
  { terms: ['1099-da', '1099da', 'digital assets', 'crypto'], label: 'Form 1099-DA — Digital Assets', stepId: '1099da_income' },
  { terms: ['1099-sa', '1099sa', 'hsa distribution'], label: 'Form 1099-SA — HSA Distributions', stepId: '1099sa_income' },
  { terms: ['1099-c', '1099c', 'cancelled debt', 'cancellation of debt'], label: 'Form 1099-C — Cancellation of Debt', stepId: '1099c_income' },
  { terms: ['1099-q', '1099q', '529 distribution'], label: 'Form 1099-Q — 529 Plan Distributions', stepId: '1099q_income' },
  { terms: ['1099-oid', '1099oid', 'original issue discount', 'oid'], label: 'Form 1099-OID — Original Issue Discount', stepId: '1099oid_income' },

  // SSA-1099
  { terms: ['ssa-1099', 'ssa1099', 'social security benefits'], label: 'Form SSA-1099 — Social Security Benefits', stepId: 'ssa1099_income' },

  // 1098 series
  { terms: ['1098', 'form 1098', 'mortgage interest statement'], label: 'Form 1098 — Mortgage Interest Statement', stepId: 'mortgage_interest_ded' },
  { terms: ['1098-t', '1098t', 'tuition statement'], label: 'Form 1098-T — Tuition Statement', stepId: 'education_credits' },
  { terms: ['1095-a', '1095a', 'marketplace statement', 'health insurance marketplace'], label: 'Form 1095-A — Health Insurance Marketplace Statement', stepId: 'premium_tax_credit' },
  { terms: ['1099-s', '1099s', 'real estate proceeds', 'real estate sale'], label: 'Form 1099-S — Proceeds from Real Estate', stepId: 'home_sale' },

  // W-2G
  { terms: ['w-2g', 'w2g', 'gambling winnings'], label: 'Form W-2G — Gambling Winnings', stepId: 'w2g_income' },

  // Schedules
  { terms: ['schedule c', 'self-employment', 'profit or loss', 'sole proprietor'], label: 'Schedule C — Profit or Loss from Business', stepId: 'business_info', formId: 'f1040sc' },
  { terms: ['schedule e', 'rental', 'supplemental income'], label: 'Schedule E — Rental & Supplemental Income', stepId: 'rental_income', formId: 'f1040se' },
  { terms: ['royalty', 'royalties', 'oil gas royalty', 'mineral rights', 'book royalty', 'patent royalty'], label: 'Royalty Income (Schedule E)', stepId: 'royalty_income', formId: 'f1040se' },
  { terms: ['schedule a', 'itemized deductions'], label: 'Schedule A — Itemized Deductions Summary', stepId: 'itemized_deductions', formId: 'f1040sa' },
  { terms: ['medical expenses', 'medical deduction', 'dental expenses'], label: 'Medical & Dental Expenses', stepId: 'medical_expenses' },
  { terms: ['salt', 'state and local tax', 'salt deduction', 'property tax', 'sales tax'], label: 'State & Local Taxes (SALT)', stepId: 'salt_deduction' },
  { terms: ['mortgage interest', 'home interest', 'mortgage deduction'], label: 'Mortgage Interest', stepId: 'mortgage_interest_ded' },
  { terms: ['charitable donation', 'charity', 'charitable contribution'], label: 'Charitable Donations', stepId: 'charitable_deduction' },
  { terms: ['gambling loss', 'gambling deduction'], label: 'Gambling Losses', stepId: 'gambling_losses_ded' },
  { terms: ['schedule b', 'interest and dividends', 'interest and ordinary dividends', 'foreign accounts'], label: 'Schedule B — Interest and Ordinary Dividends', stepId: '1099int_income', formId: 'f1040sb' },
  { terms: ['schedule d', 'capital gains and losses'], label: 'Schedule D — Capital Gains and Losses', stepId: '1099b_income', formId: 'f1040sd' },
  { terms: ['schedule f', 'farm income', 'farming'], label: 'Schedule F — Farm Income', stepId: 'schedule_f', formId: 'f1040sf' },
  { terms: ['schedule h', 'household employment', 'nanny tax'], label: 'Schedule H — Household Employment Taxes', stepId: 'schedule_h', formId: 'f1040sh' },
  { terms: ['schedule k-1', 'k-1', 'k1', 'partnership', 's-corp'], label: 'Schedule K-1 — Partner/Shareholder Income', stepId: 'k1_income' },
  { terms: ['schedule se', 'self-employment tax'], label: 'Schedule SE — Self-Employment Tax', stepId: 'se_summary', formId: 'f1040sse' },

  // Schedules 1-3
  { terms: ['schedule 1', 'additional income', 'adjustments to income'], label: 'Schedule 1 — Additional Income & Adjustments', stepId: 'income_summary', formId: 'f1040s1' },
  { terms: ['schedule 2', 'additional taxes', 'amt schedule', 'niit schedule'], label: 'Schedule 2 — Additional Taxes', stepId: 'tax_summary', formId: 'f1040s2' },
  { terms: ['schedule 3', 'additional credits', 'additional payments'], label: 'Schedule 3 — Additional Credits & Payments', stepId: 'credits_overview', formId: 'f1040s3' },

  // Other forms
  { terms: ['form 8949', '8949', 'sales and dispositions'], label: 'Form 8949 — Sales of Capital Assets', stepId: '1099b_income', formId: 'f8949' },
  { terms: ['form 8829', '8829', 'home office'], label: 'Form 8829 — Home Office Deduction', stepId: 'home_office' },
  { terms: ['form 4562', '4562', 'depreciation', 'section 179'], label: 'Form 4562 — Depreciation & Section 179', stepId: 'depreciation_assets', formId: 'f4562' },
  { terms: ['form 4797', '4797', 'business property sale'], label: 'Form 4797 — Business Property Sales', stepId: 'form4797', formId: 'f4797' },
  { terms: ['form 5695', '5695', 'residential energy'], label: 'Form 5695 — Residential Energy Credits', stepId: 'clean_energy', formId: 'f5695' },
  { terms: ['form 8283', '8283', 'noncash charitable'], label: 'Form 8283 — Noncash Charitable Contributions', stepId: 'charitable_deduction', formId: 'f8283' },
  { terms: ['form 8606', '8606', 'roth conversion', 'nondeductible ira'], label: 'Form 8606 — Roth Conversions & Nondeductible IRAs', stepId: 'form8606', formId: 'f8606' },
  { terms: ['form 8962', '8962', 'premium tax credit', 'ptc'], label: 'Form 8962 — Premium Tax Credit', stepId: 'premium_tax_credit', formId: 'f8962' },
  { terms: ['form 2441', '2441', 'child and dependent care'], label: 'Form 2441 — Child & Dependent Care Credit', stepId: 'dependent_care' },
  { terms: ['form 8863', '8863', 'education credit'], label: 'Form 8863 — Education Credits', stepId: 'education_credits', formId: 'f8863' },
  { terms: ['form 5329', '5329', 'excess contributions', 'early distribution penalty'], label: 'Form 5329 — Additional Taxes on Qualified Plans', stepId: 'form5329', formId: 'f5329' },
  { terms: ['form 8880', '8880', 'savers credit', "saver's credit"], label: "Form 8880 — Saver's Credit", stepId: 'savers_credit' },
  { terms: ['form 7206', '7206', 'self-employed health insurance'], label: 'Form 7206 — Self-Employed Health Insurance Deduction', stepId: 'se_health_insurance', formId: 'f7206' },
  { terms: ['form 6251', '6251', 'alternative minimum tax', 'amt form'], label: 'Form 6251 — Alternative Minimum Tax', stepId: 'amt_review', formId: 'f6251' },
  { terms: ['form 4137', '4137', 'unreported tips', 'tip income'], label: 'Form 4137 — Social Security Tax on Unreported Tips', stepId: 'w2_income', formId: 'f4137' },
  { terms: ['form 8911', '8911', 'ev refueling', 'refueling credit'], label: 'Form 8911 — Alternative Fuel Vehicle Refueling Credit', stepId: 'ev_credit', formId: 'f8911' },
  { terms: ['schedule r', 'elderly credit', 'disabled credit', 'credit for elderly'], label: 'Schedule R — Credit for Elderly or Disabled', stepId: 'credits_overview', formId: 'f1040sr' },

  // Retirement plan filings
  { terms: ['form 5500-ez', '5500-ez', '5500ez', 'plan annual return', 'one-participant plan'], label: 'Form 5500-EZ — Annual Return of One-Participant Plan', stepId: 'se_retirement', formId: 'f5500ez' },

  // Vouchers & extensions
  { terms: ['form 1040-es', '1040-es', '1040es', 'estimated tax voucher', 'quarterly voucher'], label: 'Form 1040-ES — Estimated Tax Vouchers', stepId: 'estimated_payments' },
  { terms: ['form 1040-v', '1040-v', '1040v', 'payment voucher'], label: 'Form 1040-V — Payment Voucher', stepId: 'refund_payment', formId: 'f1040v' },
  { terms: ['form 4868', '4868', 'extension', 'automatic extension', 'file extension'], label: 'Form 4868 — Automatic Extension of Time to File', stepId: 'export_pdf' },

  // Missing forms with templates
  { terms: ['form 2210', '2210', 'underpayment penalty', 'estimated tax penalty'], label: 'Form 2210 — Underpayment of Estimated Tax', stepId: 'estimated_payments', formId: 'f2210' },
  { terms: ['form 3903', '3903', 'moving expenses', 'military move'], label: 'Form 3903 — Moving Expenses (Military)', stepId: 'other_income', formId: 'f3903' },
  { terms: ['form 8615', '8615', 'kiddie tax', 'child unearned income'], label: 'Form 8615 — Tax for Certain Children (Kiddie Tax)', stepId: 'tax_summary', formId: 'f8615' },
  { terms: ['form 8889', '8889', 'hsa form', 'hsa contributions', 'hsa deduction'], label: 'Form 8889 — Health Savings Accounts', stepId: 'hsa_contributions', formId: 'f8889' },
  { terms: ['form 982', '982', 'cod exclusion', 'insolvency', 'cancellation of debt exclusion'], label: 'Form 982 — Reduction of Tax Attributes (COD)', stepId: '1099c_income', formId: 'f982' },

  // Alimony
  { terms: ['alimony received', 'alimony income', 'spousal support received'], label: 'Alimony Received (Pre-2019 Agreements)', stepId: 'other_income' },
  { terms: ['alimony paid', 'alimony deduction', 'spousal support paid', 'alimony'], label: 'Alimony Paid (Pre-2019 Agreements)', stepId: 'alimony_paid' },

  // Tax concepts
  { terms: ['eitc', 'earned income tax credit', 'earned income credit', 'eic'], label: 'Earned Income Tax Credit (EITC)', stepId: 'credits_overview' },
  { terms: ['qbi', 'qualified business income', 'section 199a', '199a'], label: 'Qualified Business Income (QBI) Deduction', stepId: 'qbi_detail' },
  { terms: ['salt', 'state and local tax', 'salt cap', 'salt deduction'], label: 'SALT Deduction (State & Local Tax)', stepId: 'itemized_deductions' },
  { terms: ['hsa', 'health savings account'], label: 'Health Savings Account (HSA)', stepId: 'hsa_contributions' },
  { terms: ['student loan interest', 'student loan deduction', '1098-e'], label: 'Student Loan Interest Deduction', stepId: 'student_loan_ded' },
  { terms: ['ira contribution', 'ira deduction', 'traditional ira'], label: 'IRA Contribution Deduction', stepId: 'ira_contribution_ded' },
  { terms: ['educator expenses', 'teacher expenses', 'classroom supplies'], label: 'Educator Expenses', stepId: 'educator_expenses_ded' },
  { terms: ['net operating loss', 'nol', 'nol carryforward'], label: 'Net Operating Loss Carryforward', stepId: 'nol_carryforward' },
  { terms: ['amt', 'alternative minimum tax'], label: 'Alternative Minimum Tax (AMT)', stepId: 'amt_review' },
  { terms: ['ctc', 'child tax credit'], label: 'Child Tax Credit (CTC)', stepId: 'child_tax_credit' },
  { terms: ['ev credit', 'electric vehicle credit', 'clean vehicle', '8936', 'form 8936'], label: 'Electric Vehicle (EV) Credit', stepId: 'ev_credit' },
  { terms: ['foreign tax credit', 'ftc'], label: 'Foreign Tax Credit', stepId: 'foreign_tax_credit' },
  { terms: ['adoption credit', 'adoption', '8839', 'form 8839'], label: 'Adoption Credit', stepId: 'adoption_credit' },

  // State tax forms
  { terms: ['state tax', 'state return', 'state income tax'], label: 'State Income Tax Return', stepId: 'state_overview' },
  { terms: ['state withholding', 'state w-2', 'box 17'], label: 'State Tax Withholding (W-2 Box 17)', stepId: 'state_details' },
  { terms: ['state refund', 'state owed', 'state balance due'], label: 'State Refund / Amount Owed', stepId: 'state_review' },
  { terms: ['state eitc', 'state earned income credit'], label: 'State Earned Income Tax Credit (EITC)', stepId: 'state_review' },
  { terms: ['state deduction', 'state standard deduction'], label: 'State Standard Deduction', stepId: 'state_details' },
  { terms: ['state form pdf', 'state form', 'state pdf'], label: 'State Form PDF Generation', stepId: 'export_pdf' },

  // State-specific forms
  { terms: ['pa-40', 'pennsylvania tax'], label: 'PA-40 — Pennsylvania Income Tax Return', stepId: 'state_review' },
  { terms: ['ny it-201', 'it201', 'new york tax'], label: 'IT-201 — New York Resident Income Tax Return', stepId: 'state_review' },
  { terms: ['ca 540', 'california tax'], label: 'Form 540 — California Resident Income Tax Return', stepId: 'state_review' },
  { terms: ['nj-1040', 'new jersey tax'], label: 'NJ-1040 — New Jersey Income Tax Return', stepId: 'state_review' },
  { terms: ['il-1040', 'illinois tax'], label: 'IL-1040 — Illinois Income Tax Return', stepId: 'state_review' },
  { terms: ['va-760', 'virginia tax'], label: 'Form 760 — Virginia Resident Income Tax Return', stepId: 'state_review' },
  { terms: ['or-40', 'oregon tax'], label: 'OR-40 — Oregon Individual Income Tax Return', stepId: 'state_review' },
  { terms: ['oh it-1040', 'ohio tax'], label: 'IT-1040 — Ohio Individual Income Tax Return', stepId: 'state_review' },
  { terms: ['nc d-400', 'north carolina tax'], label: 'D-400 — North Carolina Individual Income Tax Return', stepId: 'state_review' },
  { terms: ['ga 500', 'georgia tax'], label: 'Form 500 — Georgia Individual Income Tax Return', stepId: 'state_review' },
  { terms: ['md 502', 'maryland tax'], label: 'Form 502 — Maryland Resident Income Tax Return', stepId: 'state_review' },
  { terms: ['ma form 1', 'massachusetts tax'], label: 'Form 1 — Massachusetts Resident Income Tax Return', stepId: 'state_review' },

  // Home sale / Section 121
  { terms: ['home sale', 'section 121', 'pub 523', 'home exclusion'], label: 'Home Sale Exclusion (Section 121)', stepId: 'home_sale' },

  // Foreign earned income
  { terms: ['form 2555', 'foreign earned income', 'feie', 'foreign exclusion'], label: 'Form 2555 — Foreign Earned Income Exclusion', stepId: 'foreign_earned_income', formId: 'f2555' },

  // Schedule 1-A (OBBBA)
  { terms: ['schedule 1-a', '1a', 'tips deduction', 'overtime deduction', 'obbba'], label: 'Schedule 1-A — Tips, Overtime & Auto Loan', stepId: 'schedule1a' },

  // Investment interest
  { terms: ['form 4952', 'investment interest', 'margin interest'], label: 'Form 4952 — Investment Interest Deduction', stepId: 'investment_interest', formId: 'f4952' },

  // Passive activity loss
  { terms: ['form 8582', 'passive loss', 'passive activity', 'suspended loss'], label: 'Form 8582 — Passive Activity Loss Limitations', stepId: 'form8582_data', formId: 'f8582' },

  // Refund / payment
  { terms: ['direct deposit', 'bank account', 'refund', 'routing number'], label: 'Refund Direct Deposit / Payment', stepId: 'refund_payment' },

  // Schedule C Part III — COGS
  { terms: ['cost of goods sold', 'cogs', 'inventory', 'schedule c part iii'], label: 'Schedule C Part III — Cost of Goods Sold', stepId: 'cost_of_goods_sold' },

  // Schedule C Part II — Business Expenses
  { terms: ['business expenses', 'schedule c expenses', 'advertising', 'office expense'], label: 'Schedule C Part II — Business Expenses', stepId: 'expense_categories' },

  // Filing / mailing
  { terms: ['filing instructions', 'mail return', 'mailing address'], label: 'Filing Instructions & Mailing', stepId: 'filing_instructions' },
  { terms: ['where to mail', 'mail tax return', 'paper filing'], label: 'Where to Mail Your Return', stepId: 'filing_instructions' },

  // New features (IRS Bulletin audit)
  { terms: ['form 4684', '4684', 'casualty loss', 'theft loss', 'disaster loss'], label: 'Form 4684 — Casualties and Thefts', stepId: 'casualty_loss' },
  { terms: ['form 4835', '4835', 'farm rental'], label: 'Form 4835 — Farm Rental Income', stepId: 'farm_rental' },
  { terms: ['form 6252', '6252', 'installment sale', 'installment method'], label: 'Form 6252 — Installment Sale Income', stepId: 'installment_sale' },
  { terms: ['bad debt', 'nonbusiness bad debt', 'worthless debt'], label: 'Nonbusiness Bad Debt (Schedule D)', stepId: 'bad_debt' },
  { terms: ['scholarship credit', 'sgo', 'scholarship granting organization', '25f'], label: 'IRC §25F — Scholarship Credit', stepId: 'scholarship_credit' },
];
