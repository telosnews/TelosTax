// ---------------------------------------------------------------------------
// helpContent.ts — Central data file for contextual help across every wizard
// step in the tax preparation app. Field keys must exactly match the label
// props passed to <FormField label="..."> in each step component.
// ---------------------------------------------------------------------------

export interface FieldHelp {
  tooltip?: string;
  helpText?: string;
  irsRef?: string;
  irsUrl?: string;
}

export interface StepCallout {
  type: 'info' | 'warning' | 'tip';
  title: string;
  body: string;
  irsUrl?: string;
}

export interface StepHelp {
  fields: Record<string, FieldHelp>;
  callouts?: StepCallout[];
}

// ---------------------------------------------------------------------------
// HELP_CONTENT — keyed by wizard step id
// ---------------------------------------------------------------------------

export const HELP_CONTENT: Record<string, StepHelp> = {
  // =======================================================================
  // MY INFO SECTION
  // =======================================================================

  personal_info: {
    fields: {
      'First Name': {
        tooltip:
          'Enter your first name exactly as it appears on your Social Security card.',
        irsRef: 'Form 1040, Page 1',
      },
      'MI': {
        tooltip:
          'Middle initial. If you have no middle name, leave this blank.',
      },
      'Last Name': {
        tooltip:
          'Enter your last name exactly as it appears on your Social Security card.',
        irsRef: 'Form 1040, Page 1',
      },
      'Date of Birth': {
        tooltip:
          'Used to determine eligibility for age-based tax benefits like the additional standard deduction for taxpayers 65 and older.',
      },
      'Occupation': {
        tooltip:
          'Your primary occupation as you\'d describe it to the IRS. This appears on your tax return.',
        helpText: 'e.g. Teacher, Software Engineer, Nurse',
        irsRef: 'Form 1040, Page 1',
      },
      'Street Address': {
        tooltip:
          'Your current mailing address where you want IRS correspondence sent.',
        irsRef: 'Form 1040, Page 1',
      },
      'City': {
        tooltip: 'City of your current mailing address.',
      },
      'State': {
        tooltip: 'Two-letter state abbreviation (e.g., CA, NY, TX).',
      },
      'ZIP': {
        tooltip: '5-digit ZIP code for your mailing address.',
      },
      'Can be claimed as dependent': {
        tooltip:
          'Check this if someone else (such as a parent) can claim you as a dependent on their return. You can still file your own return, but your standard deduction will be limited to the greater of $1,350 or your earned income plus $450 (up to the normal standard deduction).',
        irsRef: 'Form 1040, Page 1; IRS Pub. 501',
        irsUrl: 'https://www.irs.gov/publications/p501',
      },
      'Legally blind': {
        tooltip:
          'Check this if you are totally or partly blind and cannot be corrected to better than 20/200 in your better eye, or your field of vision is 20 degrees or less. This qualifies you for an additional standard deduction amount ($2,000 for single/HoH, $1,600 for married).',
        irsRef: 'Form 1040, Page 1; IRS Topic 551',
        irsUrl: 'https://www.irs.gov/taxtopics/tc551',
      },
    },
    callouts: [
      {
        type: 'tip',
        title: 'Make sure your name matches your Social Security card',
        body: 'The IRS matches the name on your return against Social Security Administration records. A mismatch can delay processing of your refund.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  filing_status: {
    fields: {
      'Spouse First Name': {
        tooltip:
          'Enter your spouse\'s first name as it appears on their Social Security card.',
      },
      'Spouse Last Name': {
        tooltip:
          'Enter your spouse\'s last name as it appears on their Social Security card.',
      },
      'Spouse Date of Birth': {
        tooltip:
          'Used for age-based benefits. For example, taxpayers 65+ get an additional standard deduction.',
      },
      'Spouse Occupation': {
        tooltip: 'Your spouse\'s primary occupation.',
      },
      'MI': {
        tooltip:
          'Your spouse\'s middle initial.',
        irsRef: 'Form 1040, Spouse line',
      },
      'Suffix': {
        tooltip: 'Name suffix such as Jr., Sr., III, etc.',
        irsRef: 'Form 1040, Spouse line',
      },
      "Spouse's Identity Protection PIN (IP PIN)": {
        tooltip:
          'A 6-digit number assigned by the IRS to protect your spouse\'s identity. If the IRS issued your spouse an IP PIN (via Letter CP01A or the online tool), it must be entered on every return filed. A missing or incorrect IP PIN will cause the IRS to reject the return.',
        irsRef: 'Form 1040, Spouse IP PIN',
        irsUrl: 'https://www.irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin',
      },
      'Spouse Date of Death': {
        tooltip:
          'The date your spouse passed away. If your spouse died during the tax year, you can generally still file a joint return for that year.',
        irsRef: 'Form 1040, Deceased spouse',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Why your filing status matters',
        body: 'Your filing status determines your tax bracket thresholds and standard deduction amount. For example, the 2025 standard deduction is $15,750 for Single, $31,500 for Married Filing Jointly, and $23,625 for Head of Household.',
        irsUrl: 'https://www.irs.gov/taxtopics/tc353',
      },
      {
        type: 'warning',
        title: 'Head of Household requirements',
        body: 'To file as Head of Household, you must be unmarried (or considered unmarried) on the last day of the year, have paid more than half the cost of keeping up your home, AND had a qualifying person living with you for more than half the year.',
        irsUrl: 'https://www.irs.gov/publications/p501',
      },
    ],
  },

  // -----------------------------------------------------------------------
  dependents: {
    fields: {
      'First Name': {
        tooltip:
          'Dependent\'s first name as it appears on their Social Security card.',
      },
      'Last Name': {
        tooltip: 'Dependent\'s last name.',
      },
      'Relationship': {
        tooltip:
          'How this person is related to you. The IRS uses this to determine qualifying child vs. qualifying relative status, which affects credits like the Child Tax Credit and Head of Household filing status.',
        irsRef: 'Form 1040, Dependents column (4)',
      },
      'SSN (last 4)': {
        tooltip:
          'The last four digits of this dependent\u2019s Social Security Number. The IRS requires an SSN for each dependent claimed on your return.',
        irsRef: 'Form 1040, Dependents column (2)',
      },
      'Date of Birth': {
        tooltip:
          'Your dependent\u2019s date of birth. This determines eligibility for the Child Tax Credit (must be under 17) and other age-based credits.',
        irsRef: 'Form 1040, Dependents column',
      },
      'Months Lived With You': {
        tooltip:
          'The number of months this dependent lived in your home during 2025. Most credits require at least 6 months.',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Who qualifies as a dependent?',
        body: 'A dependent must be either a qualifying child (under 19, or under 24 if a full-time student, lived with you 6+ months) or a qualifying relative (income under $5,200, you provided over half their support). They cannot file a joint return claiming an exemption.',
        irsUrl: 'https://www.irs.gov/publications/p501',
      },
    ],
  },

  // =======================================================================
  // INCOME SECTION
  // =======================================================================

  import_data: {
    fields: {
      'Target Type': {
        tooltip:
          'Choose whether you\'re importing 1099-B (stock/investment trades) or 1099-DA (digital asset/crypto transactions).',
      },
      'Broker Name': {
        tooltip:
          'The name of the brokerage or exchange that issued the CSV or PDF (e.g., Schwab, Fidelity, Coinbase).',
      },
    },
    callouts: [
      {
        type: 'warning',
        title: 'Import Limitations',
        body: 'CSV import reads 1099-B and 1099-DA transaction data from brokerage exports. PDF import reads digitally-generated W-2 and 1099 forms — it does NOT work with scanned documents, photos, or image-based PDFs. Imported data is a starting point; always review every value for accuracy before filing.',
      },
      {
        type: 'info',
        title: 'Supported CSV Formats',
        body: 'Auto-detects exports from Schwab, Fidelity, E*Trade, Robinhood, and Coinbase. Other brokerage CSVs can be imported using manual column mapping.',
      },
      {
        type: 'tip',
        title: 'How to Get Your CSV',
        body: 'Log into your brokerage account and look for "Download" or "Export" in the capital gains or tax reporting section. Download as CSV (not PDF). Most brokerages make this available in January–February.',
      },
    ],
  },

  w2_income: {
    fields: {
      'Employer Name': {
        tooltip:
          'The name of the company or organization that issued this W-2.',
        irsRef: 'Form W-2, Box c',
      },
      'Wages (Box 1)': {
        tooltip:
          'Total taxable wages, tips, and other compensation. This is your gross pay minus pre-tax deductions like 401(k) contributions.',
        irsRef: 'Form W-2, Box 1',
      },
      'Federal Tax Withheld (Box 2)': {
        tooltip:
          'The amount of federal income tax your employer already withheld from your pay. This reduces your tax owed or increases your refund.',
        irsRef: 'Form W-2, Box 2',
      },
      'State Tax Withheld (Box 17)': {
        tooltip:
          'State income tax withheld by your employer. Not all states have income tax.',
        irsRef: 'Form W-2, Box 17',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Understanding your W-2',
        body: 'Your W-2 reports wages, tips, and other compensation from your employer. Box 1 shows taxable wages (after pre-tax deductions like 401(k)), and Box 2 shows federal tax already withheld. Make sure the amounts match your pay stubs.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-w-2',
      },
    ],
  },

  // -----------------------------------------------------------------------
  '1099nec_income': {
    fields: {
      'Client / Payer Name': {
        tooltip:
          'The name of the client or company that paid you as an independent contractor and issued this 1099-NEC.',
        irsRef: 'Form 1099-NEC, Payer',
      },
      'Nonemployee Compensation (Box 1)': {
        tooltip:
          'Total payment received for services as a non-employee. This income is subject to both income tax and self-employment tax (15.3%).',
        irsRef: 'Form 1099-NEC, Box 1',
      },
      'Federal Tax Withheld (Box 4)': {
        tooltip:
          'Federal income tax withheld from your payments (backup withholding). This amount is credited against your total tax liability, reducing your balance due or increasing your refund.',
        irsRef: 'Form 1099-NEC, Box 4',
        irsUrl: 'https://www.irs.gov/taxtopics/tc307',
      },
      'Business': {
        tooltip:
          'The name of your business or activity that earned this income, if applicable. This helps categorize the income on your Schedule C.',
        irsRef: 'Schedule C, Line A',
      },
    },
    callouts: [
      {
        type: 'warning',
        title: 'Self-employment tax applies',
        body: 'Income reported on 1099-NEC is subject to self-employment tax (15.3% \u2014 12.4% Social Security + 2.9% Medicare) in addition to your regular income tax. You can deduct half of this tax as an adjustment to income.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-nec',
      },
    ],
  },

  // -----------------------------------------------------------------------
  '1099k_income': {
    fields: {
      'Platform Name': {
        tooltip:
          'The name of the payment platform or marketplace that issued this 1099-K (e.g., PayPal, Stripe, Etsy, Venmo).',
        irsRef: 'Form 1099-K, Filer',
      },
      'Gross Amount (Box 1a)': {
        tooltip:
          'The total gross amount of all reportable payment transactions. This is the raw total before any adjustments for refunds, returns, platform fees, or personal transactions.',
        irsRef: 'Form 1099-K, Box 1a',
      },
      'Federal Tax Withheld (Box 4)': {
        tooltip:
          'Federal income tax withheld from your payments (backup withholding at 24%). This amount is credited against your total tax liability.',
        irsRef: 'Form 1099-K, Box 4',
        irsUrl: 'https://www.irs.gov/taxtopics/tc307',
      },
      'Adjustments': {
        tooltip:
          'Amounts to subtract from the gross amount that are not taxable income. Common adjustments include: platform fees/commissions (e.g., Uber\'s 20-30% cut), refunds and returns issued to customers, shipping and sales tax collected on behalf of buyers, and personal (non-business) transactions included in the gross amount.',
        irsRef: 'Schedule C, Line 2',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-k',
      },
    },
    callouts: [
      {
        type: 'warning',
        title: 'Your 1099-K gross amount may be too high',
        body: 'The gross amount on your 1099-K includes ALL transactions processed through the platform \u2014 including refunds, platform fees, and personal sales. Enter adjustments below to subtract amounts that are not taxable business income. Without adjustments, you may be taxed on income you never actually received.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-k',
      },
    ],
  },

  // -----------------------------------------------------------------------
  '1099int_income': {
    fields: {
      'Bank / Payer Name': {
        tooltip:
          'The bank, credit union, or financial institution that paid you interest and issued this 1099-INT.',
        irsRef: 'Form 1099-INT, Payer',
      },
      'Interest Income (Box 1)': {
        tooltip:
          'Total taxable interest earned. This includes interest from savings accounts, CDs, money market accounts, and bonds.',
        irsRef: 'Form 1099-INT, Box 1',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'About interest income',
        body: 'Most interest income is taxed as ordinary income at your regular tax rate. If you earned interest from U.S. Treasury bonds, it\'s exempt from state tax (but still federally taxable). Municipal bond interest may be tax-exempt at the federal level.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-int',
      },
    ],
  },

  // -----------------------------------------------------------------------
  '1099div_income': {
    fields: {
      'Payer Name': {
        tooltip:
          'The brokerage firm, mutual fund company, or corporation that paid dividends and issued this 1099-DIV.',
        irsRef: 'Form 1099-DIV, Payer',
      },
      'Ordinary Dividends (Box 1a)': {
        tooltip:
          'Total ordinary dividends received. These are taxed at your regular income tax rate.',
        irsRef: 'Form 1099-DIV, Box 1a',
      },
      'Qualified Dividends (Box 1b)': {
        tooltip:
          'The portion of your ordinary dividends that qualify for the lower long-term capital gains tax rate (0%, 15%, or 20% depending on your income). Must be included in Box 1a as well.',
        irsRef: 'Form 1099-DIV, Box 1b',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Ordinary vs. qualified dividends',
        body: 'Qualified dividends are taxed at the favorable capital gains rate (0-20%), while ordinary dividends are taxed at your regular income rate (up to 37%). Most dividends from U.S. companies held for at least 60 days qualify for the lower rate.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-div',
      },
    ],
  },

  // -----------------------------------------------------------------------
  '1099r_income': {
    fields: {
      'Payer Name': {
        tooltip:
          'The retirement plan administrator, insurance company, or financial institution that made the distribution.',
        irsRef: 'Form 1099-R, Payer',
      },
      'Gross Distribution (Box 1)': {
        tooltip:
          'The total amount distributed to you from the retirement account before any taxes were withheld.',
        irsRef: 'Form 1099-R, Box 1',
      },
      'Taxable Amount (Box 2a)': {
        tooltip:
          'The taxable portion of the distribution. For traditional IRA/401(k) withdrawals, this is usually the same as Box 1. For Roth distributions, it may be $0.',
        irsRef: 'Form 1099-R, Box 2a',
      },
      'Distribution Code (Box 7)': {
        tooltip:
          'This code tells the IRS why you took the distribution. Code 1 = early withdrawal (may have 10% penalty). Code 7 = normal distribution. Code G = direct rollover (not taxable).',
        irsRef: 'Form 1099-R, Box 7',
      },
      'Federal Tax Withheld (Box 4)': {
        tooltip:
          'Federal income tax already withheld from this distribution. This reduces your tax owed or increases your refund.',
        irsRef: 'Form 1099-R, Box 4',
      },
      'Qualified Charitable Distribution (QCD)': {
        tooltip:
          'If you are 70\u00BD or older and directed your IRA custodian to pay this distribution directly to a qualified charity, enter the QCD amount here. QCDs are excluded from taxable income (Line 4b) but still appear on Line 4a. Up to $105,000 per year (2025). QCDs cannot also be claimed as charitable deductions on Schedule A.',
        irsRef: 'IRC \u00A7408(d)(8)',
      },
    },
    callouts: [
      {
        type: 'warning',
        title: 'Rollovers are not taxable',
        body: 'If you rolled over retirement funds directly (distribution code G), the amount is not taxable income. Make sure Box 2a shows $0 or the taxable amount is correct. A common mistake is reporting the full amount as income.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-r',
      },
      {
        type: 'tip',
        title: 'Early withdrawal penalty',
        body: 'If you\'re under 59\u00BD and took an early withdrawal (code 1), you may owe a 10% early distribution penalty on top of regular income tax. Some exceptions apply (disability, first-time home purchase up to $10,000, etc.).',
        irsUrl:
          'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-tax-on-early-distributions',
      },
      {
        type: 'tip',
        title: 'Qualified Charitable Distributions (QCDs)',
        body: 'If you\'re 70\u00BD or older and donated directly from your traditional IRA to a qualified charity, enter the QCD amount on the 1099-R. QCDs are excluded from taxable income (Line 4b) and reduce your AGI, which may help avoid the 3.8% Net Investment Income Tax.',
        irsUrl: 'https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs',
      },
    ],
  },

  // -----------------------------------------------------------------------
  '1099g_income': {
    fields: {
      'Payer Name': {
        tooltip:
          'The state agency that paid unemployment compensation and issued this 1099-G.',
        irsRef: 'Form 1099-G, Payer',
      },
      'Unemployment Compensation (Box 1)': {
        tooltip:
          'Total unemployment benefits received during 2025. Unemployment compensation is fully taxable as ordinary income.',
        irsRef: 'Form 1099-G, Box 1',
      },
      'Federal Tax Withheld (Box 4)': {
        tooltip:
          'Federal tax withheld from your unemployment payments. If you opted for voluntary withholding, this amount reduces your tax owed.',
        irsRef: 'Form 1099-G, Box 4',
      },
    },
    callouts: [
      {
        type: 'tip',
        title: 'Voluntary withholding',
        body: 'If you didn\'t have taxes withheld from your unemployment benefits, you may owe taxes when you file. You can request 10% federal tax withholding on Form W-4V to avoid a surprise tax bill.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-g',
      },
    ],
  },

  // -----------------------------------------------------------------------
  '1099misc_income': {
    fields: {
      'Payer Name': {
        tooltip:
          'The person or company that made the payment and issued this 1099-MISC.',
        irsRef: 'Form 1099-MISC, Payer',
      },
      'Rents (Box 1)': {
        tooltip:
          'Rent payments you received for real estate or other property. Reported on Schedule E and subject to passive activity loss rules.',
        irsRef: 'Form 1099-MISC, Box 1',
      },
      'Royalties (Box 2)': {
        tooltip:
          'Royalty payments of $10 or more for oil, gas, mineral properties, copyrights, patents, or other intellectual property. Reported on Schedule E.',
        irsRef: 'Form 1099-MISC, Box 2',
      },
      'Other Income (Box 3)': {
        tooltip:
          'Prizes, awards, or other miscellaneous income not reported in Boxes 1 or 2. Note: Nonemployee compensation is now reported on 1099-NEC, not 1099-MISC.',
        irsRef: 'Form 1099-MISC, Box 3',
      },
      'Federal Tax Withheld (Box 4)': {
        tooltip:
          'Any federal income tax that was withheld from this payment.',
        irsRef: 'Form 1099-MISC, Box 4',
      },
      'State Tax Withheld (Box 16)': {
        tooltip:
          'Any state income tax that was withheld from this payment. This amount will be applied as a credit on your state return.',
        irsRef: 'Form 1099-MISC, Box 16',
      },
    },
    callouts: [
      {
        type: 'info',
        title: '1099-MISC vs. 1099-NEC',
        body: 'Since 2020, freelance/contractor payments are reported on 1099-NEC (not 1099-MISC). The 1099-MISC is now used for rent payments, prizes, awards, royalties, crop insurance proceeds, and other miscellaneous income.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-misc',
      },
    ],
  },

  // -----------------------------------------------------------------------
  '1099b_income': {
    fields: {
      'Broker / Institution': {
        tooltip:
          'The name of the brokerage or financial institution that sent the 1099-B.',
        irsRef: 'Form 1099-B',
      },
      'Description of Property': {
        tooltip:
          'A brief description of what you sold, such as "100 shares AAPL" or "Bitcoin".',
        irsRef: 'Form 1099-B',
      },
      'Date Acquired': {
        tooltip:
          'The date you originally purchased or acquired the investment.',
        irsRef: 'Form 1099-B, Box 1b',
      },
      'Date Sold': {
        tooltip: 'The date you sold or disposed of the investment.',
        irsRef: 'Form 1099-B, Box 1c',
      },
      'Proceeds (Box 1d)': {
        tooltip:
          'The total amount you received from the sale. This is the sales price.',
        irsRef: 'Form 1099-B, Box 1d',
      },
      'Cost Basis (Box 1e)': {
        tooltip:
          'Your original purchase price plus any adjustments. This determines your gain or loss.',
        irsRef: 'Form 1099-B, Box 1e',
      },
      'Holding Period': {
        tooltip:
          'Long-term means you held the investment for more than one year. Long-term gains are taxed at lower rates (0%, 15%, or 20%).',
        irsRef: 'Form 1099-B',
      },
      'Federal Tax Withheld (Box 4)': {
        tooltip:
          'Any federal income tax withheld from the proceeds of this sale.',
        irsRef: 'Form 1099-B, Box 4',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Short-term vs. long-term gains',
        body: 'Investments held for one year or less are short-term and taxed at your ordinary income rate (up to 37%). Investments held longer than one year are long-term and taxed at 0%, 15%, or 20% depending on your income. If your losses exceed your gains, you can deduct up to $3,000 per year against other income — unused losses carry forward to future years.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-b',
      },
    ],
  },

  // -----------------------------------------------------------------------
  '1099da_income': {
    fields: {
      'Token / Asset Name': {
        tooltip:
          'The name of the cryptocurrency or digital asset you sold, such as "Bitcoin" or "Ethereum".',
      },
      'Exchange / Broker': {
        tooltip:
          'The name of the crypto exchange or platform that sent the 1099-DA (e.g. Coinbase, Kraken, Binance).',
        irsRef: 'Form 1099-DA',
      },
      'Description': {
        tooltip:
          'Optional description of the transaction, such as "Sold 0.5 BTC" or "Converted ETH to USDC".',
      },
      'Date Acquired': {
        tooltip:
          'The date you originally purchased or received the digital asset. Leave blank if unknown.',
        irsRef: 'Form 1099-DA',
      },
      'Date Sold': {
        tooltip:
          'The date you sold, traded, or disposed of the digital asset.',
        irsRef: 'Form 1099-DA',
      },
      'Proceeds (Box 1b)': {
        tooltip:
          'The total amount you received from the sale or trade in US dollars.',
        irsRef: 'Form 1099-DA, Box 1b',
      },
      'Cost Basis (Box 1c)': {
        tooltip:
          'Your original purchase price in US dollars. For 2025, many exchanges only report proceeds — you may need to look up your own cost basis records.',
        irsRef: 'Form 1099-DA, Box 1c',
      },
      'Basis Reported': {
        tooltip:
          'Whether the exchange reported your cost basis to the IRS. For 2025, most exchanges only report proceeds. If basis was not reported, you\'ll need your own records.',
      },
      'Wash Sale Loss': {
        tooltip:
          'If you sold a crypto asset at a loss and repurchased the same asset within 30 days, the loss may be disallowed under the wash sale rule. Enter any disallowed amount here.',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'New for 2025',
        body: 'Starting in 2025, crypto exchanges must issue Form 1099-DA for digital asset transactions. Short-term gains (held 1 year or less) are taxed as ordinary income. Long-term gains get preferential rates of 0%, 15%, or 20%.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-da',
      },
    ],
  },

  // -----------------------------------------------------------------------
  ssa1099_income: {
    fields: {
      'Net Benefits (Box 5)': {
        tooltip:
          'This is the total amount of Social Security benefits you received during the year, after any deductions. It\'s shown in Box 5 of your SSA-1099.',
        irsRef: 'SSA-1099, Box 5',
      },
      'Federal Tax Withheld (Box 6)': {
        tooltip:
          'If you elected to have federal income tax withheld from your Social Security payments, the total withheld is shown in Box 6.',
        irsRef: 'SSA-1099, Box 6',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'How Social Security is taxed',
        body: 'Depending on your total income, either 0%, up to 50%, or up to 85% of your Social Security benefits may be taxable. If Social Security was your only income source, your benefits are generally not taxable. The IRS uses your "provisional income" (adjusted gross income + nontaxable interest + half your benefits) to determine the taxable portion. We\'ll calculate the exact amount based on your overall income.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-ssa-1099',
      },
    ],
  },

  // -----------------------------------------------------------------------
  k1_income: {
    fields: {
      'Entity Name': {
        tooltip:
          'The name of the partnership or S-Corporation that issued the K-1.',
        irsRef: 'Schedule K-1, Box A',
      },
      'Entity EIN': {
        tooltip: 'The Employer Identification Number of the entity.',
        irsRef: 'Schedule K-1, Box B',
      },
      'Entity Type': {
        tooltip:
          'Partnerships issue K-1 from Form 1065; S-Corporations issue K-1 from Form 1120-S. Partnership income may be subject to self-employment tax.',
        irsRef: 'Schedule K-1',
      },
      'Box 1: Ordinary Business Income': {
        tooltip:
          'Your share of the entity\'s ordinary business income or loss.',
        irsRef: 'Schedule K-1, Box 1',
      },
      'Box 2: Rental Income': {
        tooltip: 'Your share of net rental real estate income or loss.',
        irsRef: 'Schedule K-1, Box 2',
      },
      'Box 4: Guaranteed Payments': {
        tooltip:
          'Guaranteed payments to partners for services or use of capital. Always subject to SE tax.',
        irsRef: 'Schedule K-1, Box 4',
      },
      'Box 5: Interest Income': {
        tooltip: 'Your share of portfolio interest income.',
        irsRef: 'Schedule K-1, Box 5',
      },
      'Box 6a: Ordinary Dividends': {
        tooltip:
          'Your share of ordinary dividends from the entity\'s investments.',
        irsRef: 'Schedule K-1, Box 6a',
      },
      'Box 6b: Qualified Dividends': {
        tooltip:
          'Portion of ordinary dividends eligible for lower tax rates.',
        irsRef: 'Schedule K-1, Box 6b',
      },
      'Box 7: Royalties': {
        tooltip: 'Your share of royalty income.',
        irsRef: 'Schedule K-1, Box 7',
      },
      'Box 8: Short-Term Capital Gain': {
        tooltip: 'Your share of net short-term capital gain or loss.',
        irsRef: 'Schedule K-1, Box 8',
      },
      'Box 9a: Long-Term Capital Gain': {
        tooltip: 'Your share of net long-term capital gain or loss.',
        irsRef: 'Schedule K-1, Box 9a',
      },
      'Box 10: Net Section 1231 Gain': {
        tooltip:
          'Gains from the sale of business property held more than one year. Net gains are taxed at capital gains rates.',
        irsRef: 'Schedule K-1, Box 10',
      },
      'Box 11: Other Income': {
        tooltip:
          'Any other income not categorized in the boxes above.',
        irsRef: 'Schedule K-1, Box 11',
      },
      'Box 20 Code Z: Section 199A QBI': {
        tooltip:
          'Qualified Business Income for the Section 199A deduction (up to 20% of QBI).',
        irsRef: 'Schedule K-1, Box 20',
      },
      'Box 14 Code A: SE Earnings': {
        tooltip:
          'Net self-employment earnings from the partnership. Only applicable for partnerships \u2014 S-Corp shareholders do not have SE income.',
        irsRef: 'Schedule K-1, Box 14',
      },
      'Federal Tax Withheld': {
        tooltip: 'Any federal income tax withheld by the entity.',
        irsRef: 'Schedule K-1',
      },
      'Charitable Cash (Box 13 Code A)': {
        tooltip:
          'Cash contributions made by the partnership to charitable organizations. This flows to Schedule A for itemized deduction purposes.',
        irsRef: 'Schedule K-1, Box 13 Code A',
      },
      'Charitable Non-Cash (Box 13 Code B-F)': {
        tooltip:
          'Non-cash charitable contributions made by the partnership. May require Form 8283 if over $500.',
        irsRef: 'Schedule K-1, Box 13 Codes B-F',
      },
      'Investment Interest Expense (Box 13 Code H)': {
        tooltip:
          'Your share of investment interest expense. Deductible on Schedule A, limited to investment income.',
        irsRef: 'Schedule K-1, Box 13 Code H',
      },
      'Section 1231 Loss (Box 13 Code K)': {
        tooltip:
          'Your share of Section 1231 losses from the sale of business property held more than one year. Treated as ordinary loss.',
        irsRef: 'Schedule K-1, Box 13 Code K',
      },
      'Other Deductions (Box 13 Codes I-L)': {
        tooltip:
          'Other deductions passed through from the partnership, such as soil and water conservation expenses, portfolio deductions, or other itemized deductions.',
        irsRef: 'Schedule K-1, Box 13',
      },
      'Foreign Tax Paid (Box 15 Code L)': {
        tooltip:
          'Your share of foreign taxes paid by the partnership. Eligible for the foreign tax credit or as an itemized deduction.',
        irsRef: 'Schedule K-1, Box 15 Code L',
      },
      'Foreign Country': {
        tooltip:
          'The country to which the foreign tax was paid. Required for proper foreign tax credit calculation.',
        irsRef: 'Schedule K-1, Box 15',
      },
      'Other Credits (Box 15)': {
        tooltip:
          'Other tax credits passed through from the partnership, such as low-income housing credits, renewable energy credits, or other business credits.',
        irsRef: 'Schedule K-1, Box 15',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Partnership vs. S-Corporation',
        body: 'Partnership K-1 income (Form 1065) may be subject to self-employment tax, especially guaranteed payments and ordinary business income for general partners. S-Corporation K-1 income (Form 1120-S) is not subject to SE tax — shareholders receive wages via W-2 instead. Both entity types may generate a Section 199A qualified business income deduction of up to 20%.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1065',
      },
    ],
  },

  // -----------------------------------------------------------------------
  '1099sa_income': {
    fields: {
      'HSA Trustee / Payer Name': {
        tooltip:
          'The name of the financial institution that manages your HSA.',
        irsRef: 'Form 1099-SA, Payer',
      },
      'Gross Distribution (Box 1)': {
        tooltip:
          'The total amount distributed from your HSA during the year.',
        irsRef: 'Form 1099-SA, Box 1',
      },
      'Distribution Code (Box 3)': {
        tooltip:
          'Code 1: Normal distribution. Code 2: Excess contributions removed. Code 3: Disability. Code 4: Death distribution to non-spouse. Code 5: Prohibited transaction.',
        irsRef: 'Form 1099-SA, Box 3',
      },
      'Used for Qualified Medical Expenses?': {
        tooltip:
          'If you used the entire distribution for qualified medical expenses (doctor visits, prescriptions, etc.), it\'s completely tax-free.',
        irsRef: 'Form 1099-SA',
      },
      'Federal Tax Withheld (Box 4)': {
        tooltip:
          'Any federal income tax withheld from the distribution.',
        irsRef: 'Form 1099-SA, Box 4',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Are HSA distributions taxable?',
        body: 'Distributions used for qualified medical expenses (doctor visits, prescriptions, dental, vision, etc.) are completely tax-free. If the money was not used for medical expenses, it\'s added to your taxable income and may be subject to a 20% additional penalty — unless you\'re 65 or older, disabled, or the account holder is deceased.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-sa',
      },
    ],
  },

  // -----------------------------------------------------------------------
  rental_income: {
    fields: {
      'Property Address': {
        tooltip:
          'The full street address of the rental property.',
        irsRef: 'Schedule E, Line 1',
      },
      'Property Type': {
        tooltip:
          'The type of rental property \u2014 single-family, multi-family, condo, or commercial. Used for classification purposes.',
        irsRef: 'Schedule E',
      },
      'Days Rented': {
        tooltip:
          'The number of days the property was rented at fair market rate during the year.',
        irsRef: 'Schedule E, Line 1',
      },
      'Personal Use Days': {
        tooltip:
          'Days you or your family used the property for personal purposes. If personal use exceeds 14 days or 10% of rental days, deductions may be limited.',
        irsRef: 'Schedule E',
      },
      'Gross Rental Income': {
        tooltip:
          'Total rent you received (or were entitled to receive) for this property during the year.',
        irsRef: 'Schedule E, Line 3',
      },
      'Advertising': {
        tooltip: 'Cost of advertising the property to prospective tenants.',
        irsRef: 'Schedule E, Line 5',
      },
      'Auto & Travel': {
        tooltip:
          'Mileage or travel expenses for property management activities such as visiting the property, collecting rent, or meeting contractors.',
        irsRef: 'Schedule E, Line 6',
      },
      'Cleaning & Maintenance': {
        tooltip:
          'Costs to clean and maintain the rental property between tenants or during the rental period.',
        irsRef: 'Schedule E, Line 7',
      },
      'Commissions': {
        tooltip:
          'Commissions paid to rental agents or property management companies for finding tenants.',
        irsRef: 'Schedule E, Line 8',
      },
      'Insurance': {
        tooltip:
          'Premiums for fire, theft, flood, and liability insurance on the rental property.',
        irsRef: 'Schedule E, Line 9',
      },
      'Legal & Professional': {
        tooltip:
          'Fees for attorneys, accountants, and other professionals for services related to the rental.',
        irsRef: 'Schedule E, Line 10',
      },
      'Management Fees': {
        tooltip:
          'Fees paid to a property management company for managing the rental property.',
        irsRef: 'Schedule E, Line 11',
      },
      'Mortgage Interest': {
        tooltip:
          'Interest paid on a mortgage or loan for the rental property. From Form 1098.',
        irsRef: 'Schedule E, Line 12',
      },
      'Other Interest': {
        tooltip:
          'Interest paid on other loans used for the rental property (e.g., home equity line).',
        irsRef: 'Schedule E, Line 13',
      },
      'Repairs': {
        tooltip:
          'Costs to repair and maintain the property in its current condition (not improvements that add value).',
        irsRef: 'Schedule E, Line 14',
      },
      'Supplies': {
        tooltip: 'Supplies used for the rental activity.',
        irsRef: 'Schedule E, Line 15',
      },
      'Taxes': {
        tooltip:
          'Property taxes and other taxes on the rental property (not income taxes).',
        irsRef: 'Schedule E, Line 16',
      },
      'Utilities': {
        tooltip:
          'Utility costs you paid for the rental property \u2014 electric, gas, water, sewer, trash.',
        irsRef: 'Schedule E, Line 17',
      },
      'Depreciation': {
        tooltip:
          'Annual depreciation of the rental property. Residential rental property is depreciated over 27.5 years.',
        irsRef: 'Schedule E, Line 18',
      },
      'Other Expenses': {
        tooltip:
          'Any other deductible rental expenses not listed in the categories above.',
        irsRef: 'Schedule E, Line 19',
      },
      'Rental Income': {
        tooltip:
          'Total rent you received (or were entitled to receive) for this property during the year.',
        irsRef: 'Schedule E, Line 3',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Rental income & passive activity rules',
        body: 'Rental income is generally considered passive income. You can deduct expenses like mortgage interest, repairs, insurance, taxes, and depreciation. If your deductible expenses exceed rental income, you may be able to deduct up to $25,000 in losses against other income — subject to a phase-out between $100,000 and $150,000 AGI.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-schedule-e-form-1040',
      },
    ],
  },

  // -----------------------------------------------------------------------
  royalty_income: {
    fields: {
      'Description': {
        tooltip: 'A description of the royalty source — e.g., the property name, lease description, book title, or patent number.',
      },
      'Royalty Type': {
        tooltip: 'Select the type of royalty: oil & gas, mineral rights, book/literary, music, patent/intellectual property, timber, or other.',
      },
      'Royalty Income': {
        tooltip: 'Total royalty income received during the tax year for this source. This appears on Schedule E, Line 4.',
        irsRef: 'Schedule E, Line 4',
      },
      'Depreciation / Depletion': {
        tooltip: 'For oil, gas, and mineral royalties, enter the depletion deduction. For other assets, enter depreciation. Cost depletion is calculated based on the fraction of the resource extracted during the year.',
        irsRef: 'Schedule E, Line 18',
      },
    },
    callouts: [
      {
        type: 'info' as const,
        title: 'What counts as royalty income?',
        body: 'Royalties include payments for the use of natural resources (oil, gas, minerals, timber), intellectual property (patents, copyrights, trademarks), and creative works (books, music, art). Report royalty income on Schedule E, Part I, Line 4.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-schedule-e-form-1040',
      },
      {
        type: 'tip' as const,
        title: 'Depletion deduction for natural resources',
        body: 'If you receive oil, gas, or mineral royalties, you may be entitled to a depletion deduction (similar to depreciation). For most individual taxpayers, percentage depletion is 15% of gross royalty income, limited to 100% of net income from the property.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  other_income: {
    fields: {
      'Other Income Amount': {
        tooltip:
          'Any taxable income not reported on another form \u2014 jury duty pay, hobby income, prizes, bartering income, etc.',
        helpText:
          'e.g. jury duty pay, hobby income, prizes, bartering income',
        irsRef: 'Form 1040, Schedule 1, Line 8z',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'What counts as other income?',
        body: 'Other income includes jury duty pay, hobby income, Alaska Permanent Fund dividends, prizes, bartering income, and other income not classified elsewhere. Gambling winnings and canceled debt have their own dedicated sections (W-2G and 1099-C).',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-schedule-1-form-1040',
      },
    ],
  },

  // =======================================================================
  // SELF-EMPLOYMENT SECTION
  // =======================================================================

  business_info: {
    fields: {
      'Business Name': {
        tooltip:
          'Your business name or DBA (Doing Business As). If you\'re a sole proprietor without a business name, leave blank or enter your name.',
        helpText: 'Or your name if you\'re a sole proprietor',
        irsRef: 'Schedule C, Line C',
      },
      'What does your business do?': {
        tooltip:
          'Briefly describe your principal business activity. The IRS uses this to classify your business by industry code.',
        helpText: 'e.g. Graphic design services, Software consulting',
        irsRef: 'Schedule C, Line A',
      },
      'Accounting Method': {
        tooltip:
          'Cash basis means you report income when received and expenses when paid. Accrual basis means you report income when earned and expenses when incurred. Most sole proprietors use cash.',
        irsRef: 'Schedule C, Line F',
      },
    },
    callouts: [
      {
        type: 'tip',
        title: 'EIN vs. SSN',
        body: 'If you\'re a sole proprietor with no employees, you can use your Social Security Number as your business tax ID. You need an EIN if you have employees, operate as a partnership/LLC, or want to separate your business identity.',
        irsUrl:
          'https://www.irs.gov/businesses/small-businesses-self-employed/do-you-need-an-ein',
      },
    ],
  },

  // -----------------------------------------------------------------------
  cost_of_goods_sold: {
    fields: {
      'Beginning Inventory': {
        tooltip:
          'The cost of all merchandise, raw materials, and supplies on hand at the start of the tax year. This should match last year\'s ending inventory.',
        irsRef: 'Schedule C, Part III, Line 35',
      },
      'Purchases': {
        tooltip:
          'Cost of all raw materials, merchandise, and goods purchased for resale during the year, minus the cost of any items withdrawn for personal use.',
        irsRef: 'Schedule C, Part III, Line 36',
      },
      'Cost of Labor': {
        tooltip:
          'Direct labor costs for producing or acquiring goods. Do not include amounts paid to yourself \u2014 only payments to others for labor directly related to producing your products.',
        irsRef: 'Schedule C, Part III, Line 37',
      },
      'Materials & Supplies': {
        tooltip:
          'Cost of materials and supplies used in manufacturing or packaging your products. This is separate from office supplies (Line 22).',
        irsRef: 'Schedule C, Part III, Line 38',
      },
      'Other Costs': {
        tooltip:
          'Other costs related to producing or acquiring goods for sale, such as freight-in, overhead allocated to production, and containers.',
        irsRef: 'Schedule C, Part III, Line 39',
      },
      'Ending Inventory': {
        tooltip:
          'The cost of all merchandise, raw materials, and supplies still on hand at the end of the tax year. Use the same valuation method as beginning inventory (cost, lower of cost or market, or other).',
        irsRef: 'Schedule C, Part III, Line 41',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'When to report Cost of Goods Sold',
        body: 'If you sell products (Etsy, eBay, Amazon FBA, Poshmark, etc.), you must report Cost of Goods Sold to subtract the cost of your inventory from gross receipts. Without COGS, you would be taxed on the full selling price rather than just your profit.',
        irsUrl: 'https://www.irs.gov/publications/p334#en_US_2024_publink100051285',
      },
      {
        type: 'tip',
        title: 'Inventory valuation method',
        body: 'Most small businesses value inventory at cost. You can also use "lower of cost or market." Whichever method you choose, you must use it consistently from year to year. If you are starting out, cost is the simplest method.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  expense_categories: {
    fields: {},
    callouts: [
      {
        type: 'tip',
        title: 'Keep records for every deduction',
        body: 'The IRS requires you to keep records that support your business deductions \u2014 receipts, bank statements, mileage logs, and invoices. Keep records for at least 3 years from the date you filed the return.',
        irsUrl:
          'https://www.irs.gov/businesses/small-businesses-self-employed/what-kind-of-records-should-i-keep',
      },
    ],
  },

  // -----------------------------------------------------------------------
  home_office: {
    fields: {
      'Do you have a home office?': {
        tooltip:
          'To claim the home office deduction, you must use a specific area of your home regularly and exclusively for business. A dedicated room or defined workspace qualifies.',
      },
      'Office Square Footage': {
        tooltip:
          'The square footage of the area used exclusively for business. For the simplified method, the maximum is 300 sq ft.',
        helpText: 'Max 300 sq ft for simplified method',
        irsRef: 'Form 8829, Line 1',
      },
      'Total Home Square Footage': {
        tooltip:
          'The total square footage of your entire home, including all rooms, hallways, etc. Used to calculate the business-use percentage.',
        irsRef: 'Form 8829, Line 2',
      },
      'Total Home Expenses': {
        tooltip:
          'The total annual cost of maintaining your home \u2014 rent or mortgage interest, property tax, utilities, insurance, and repairs. Only the business-use percentage is deductible.',
        helpText: 'Rent/mortgage, utilities, insurance, repairs, etc.',
        irsRef: 'Form 8829',
      },
      // Tier 1 fields (always deductible)
      'Mortgage Interest': {
        tooltip:
          'The total mortgage interest you paid on your home this year. The business-use percentage of this amount is deducted first and is always allowed regardless of your income.',
        irsRef: 'Form 8829, Line 10',
      },
      'Real Estate Taxes': {
        tooltip:
          'The total real estate taxes you paid on your home this year. Like mortgage interest, the business portion is always deductible.',
        irsRef: 'Form 8829, Line 11',
      },
      'Casualty Losses': {
        tooltip:
          'Casualty losses from federally declared disasters only. Most filers will leave this blank.',
        irsRef: 'Form 8829, Line 9',
      },
      // Tier 2 fields (operating expenses, subject to income limit)
      'Insurance': {
        tooltip:
          'Homeowner\'s or renter\'s insurance premiums for the year. The business-use percentage is deductible, subject to the gross income limitation.',
        irsRef: 'Form 8829, Line 18',
      },
      'Utilities': {
        tooltip:
          'Total utility costs including electric, gas, water, trash, internet, and phone. The business-use percentage is deductible.',
        irsRef: 'Form 8829, Line 21',
      },
      'Repairs & Maintenance': {
        tooltip:
          'General repairs and maintenance for the entire home (e.g., HVAC servicing, plumbing, pest control). Repairs only to the office area are direct expenses at 100%.',
        irsRef: 'Form 8829, Line 20',
      },
      'Rent': {
        tooltip:
          'If you rent your home, enter the total annual rent paid. The business-use percentage is deductible.',
        irsRef: 'Form 8829, Line 19',
      },
      'Other Expenses': {
        tooltip:
          'Other home expenses not listed above, such as security system costs, HOA fees, or cleaning services for common areas.',
        irsRef: 'Form 8829, Line 22',
      },
      // Part III fields (depreciation)
      'Home Cost or Value': {
        tooltip:
          'Enter the lesser of (1) your home\'s adjusted basis (what you paid, plus improvements) or (2) its fair market value on the date you first used it for business. Do not include the value of the land.',
        irsRef: 'Form 8829, Line 37',
      },
      'Land Value': {
        tooltip:
          'The value of the land your home sits on. Land cannot be depreciated. You can estimate this from your property tax assessment (which typically separates land and building values).',
        irsRef: 'Form 8829, Line 38',
      },
      'Date First Used for Business': {
        tooltip:
          'The date you first started using this home for business. This determines your first-year depreciation rate. If you started before 2025, the standard rate applies.',
        irsRef: 'Form 8829, Line 41',
      },
      // Part IV fields (carryovers)
      'Prior Year Operating Carryover': {
        tooltip:
          'If you used the actual method last year and some operating expenses were disallowed due to the gross income limit, enter the carryover amount from your prior year Form 8829, Line 43.',
        irsRef: 'Form 8829, Line 25',
      },
      'Prior Year Depreciation Carryover': {
        tooltip:
          'If depreciation was disallowed last year due to the gross income limit, enter the carryover from your prior year Form 8829, Line 44.',
        irsRef: 'Form 8829, Line 31',
      },
    },
    callouts: [
      {
        type: 'warning',
        title: 'Exclusive use requirement',
        body: 'The IRS requires that your home office space be used regularly and exclusively for business. A desk in the corner of your living room does not qualify unless that area is used only for business. An audit of this deduction is more common for home-based businesses.',
        irsUrl: 'https://www.irs.gov/publications/p587',
      },
      {
        type: 'info',
        title: 'Gross income limitation',
        body: 'Your home office deduction for operating expenses and depreciation cannot exceed your business income. The IRS applies a three-tier priority: (1) mortgage interest and taxes are always deductible, (2) operating expenses are deducted next, and (3) depreciation is deducted last. Any excess carries forward to next year.',
        irsUrl: 'https://www.irs.gov/publications/p587#en_US_2024_publink10003621',
      },
    ],
  },

  // -----------------------------------------------------------------------
  vehicle_expenses: {
    fields: {
      'What vehicle expense method do you want to use?': {
        tooltip:
          'Standard mileage rate is simpler \u2014 just track your business miles. Actual expenses requires tracking all vehicle costs. You generally can\'t switch from actual to standard after the first year.',
      },
      'Business Miles Driven': {
        tooltip:
          'Total miles driven for business purposes only. Commuting from home to a regular workplace does NOT count as business mileage.',
        helpText: 'Don\'t include commuting miles',
        irsRef: 'Schedule C, Line 9',
      },
      'Business Miles': {
        tooltip:
          'Miles driven exclusively for business. Trips between your office and a client, supply runs, and travel to temporary work locations qualify.',
        irsRef: 'Schedule C, Line 9',
      },
      'Total Miles': {
        tooltip:
          'Total miles driven during the year for all purposes (business + personal). Used to calculate the business-use percentage for actual expenses.',
        irsRef: 'Form 4562, Part V',
      },
      'Commute Miles': {
        tooltip:
          'Miles driven for your daily commute to a regular workplace. These are NOT deductible. If you have a home office, your home counts as your workplace.',
        irsRef: 'Form 4562, Part V',
      },
      'Other Miles': {
        tooltip:
          'Personal miles driven for non-business, non-commute purposes (errands, recreation, etc.).',
        irsRef: 'Form 4562, Part V',
      },
      'Gas & Fuel': {
        tooltip:
          'Annual cost of gasoline, diesel, or electricity used to power your vehicle.',
      },
      'Oil & Lubricants': {
        tooltip:
          'Oil changes, transmission fluid, and other lubricants for your vehicle.',
      },
      'Repairs': {
        tooltip:
          'Mechanical repairs, body work, and replacement parts for your vehicle.',
      },
      'Tires': {
        tooltip:
          'Tire purchases, tire rotations, and tire repair costs.',
      },
      'Insurance': {
        tooltip:
          'Annual auto insurance premiums. Only the business-use portion is deductible.',
      },
      'Registration': {
        tooltip:
          'State vehicle registration fees and related costs.',
      },
      'Licenses': {
        tooltip:
          'License plate costs and other licensing fees.',
      },
      'Garage Rent': {
        tooltip:
          'Parking garage rent or vehicle storage fees.',
      },
      'Tolls': {
        tooltip:
          'Tolls paid while driving for business purposes.',
      },
      'Parking': {
        tooltip:
          'Parking fees paid at business destinations. Does not include parking at your regular workplace.',
      },
      'Lease Payments': {
        tooltip:
          'Monthly lease payments for a leased vehicle. Only the business-use portion is deductible.',
      },
      'Other Expenses': {
        tooltip:
          'Other vehicle-related expenses not listed above (e.g., car washes, roadside assistance).',
      },
      'Vehicle Cost': {
        tooltip:
          'Original purchase price or cost basis of the vehicle. Used to calculate MACRS depreciation. Do not include sales tax unless you elected to deduct it separately.',
        helpText: 'Original purchase price',
        irsRef: 'Form 4562, Part V',
      },
      'Date Placed in Service': {
        tooltip:
          'The date you first used this vehicle for business. Determines the first-year depreciation rate and which year of the MACRS recovery period you are in.',
        irsRef: 'Form 4562, Part V',
      },
      'Prior Depreciation': {
        tooltip:
          'Total depreciation you have claimed for this vehicle in all prior tax years combined. Check your previous Form 4562 or Schedule C records.',
        helpText: 'From prior year Form 4562',
        irsRef: 'Form 4562, Part V',
      },
      'Vehicle Weight': {
        tooltip:
          'Gross vehicle weight rating (GVWR) in pounds. Vehicles over 6,000 lbs are exempt from Section 280F luxury vehicle depreciation limits, allowing larger first-year deductions.',
        helpText: 'Enter if over 6,000 lbs for SUV exception',
        irsRef: 'IRC Section 280F(d)(5)',
      },
      'Available for personal use?': {
        tooltip:
          'The IRS requires disclosure of whether your vehicle is available for personal use during off-duty hours. This is a Form 4562 Part V question.',
        irsRef: 'Form 4562, Part V, Line 37',
      },
      'Written evidence?': {
        tooltip:
          'Do you have written records (mileage log, calendar, app, or other documentation) to substantiate your claimed business mileage? The IRS requires contemporaneous records under IRC Section 274(d).',
        irsRef: 'Form 4562, Part V, Line 38',
      },
    },
    callouts: [
      {
        type: 'warning',
        title: 'Commuting is not business mileage',
        body: 'Driving from your home to your regular place of business is commuting \u2014 not deductible. However, if you have a qualifying home office, trips from home to a client or temporary work site are business miles.',
        irsUrl: 'https://www.irs.gov/publications/p463',
      },
      {
        type: 'info',
        title: 'Section 280F luxury vehicle limits',
        body: 'The IRS caps depreciation on passenger vehicles. For 2025, the first-year limit with bonus depreciation is $20,200. Vehicles over 6,000 lbs GVW are exempt from these limits.',
        irsUrl: 'https://www.irs.gov/publications/p946',
      },
      {
        type: 'warning',
        title: 'First-year method choice is binding',
        body: 'If you choose the actual expense method the first year you use a vehicle for business, you must continue using it for that vehicle. You cannot switch to standard mileage later.',
        irsUrl: 'https://www.irs.gov/publications/p463',
      },
    ],
  },

  se_summary: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'This is a checkpoint, not a tax form',
        body: 'This page summarizes your Schedule C data so far. Review the numbers, fix anything that looks off, and then continue to deductions. You\'ll see a detailed line-by-line Schedule C review later in the Review section.',
      },
      {
        type: 'warning',
        title: 'Self-employment tax is separate from income tax',
        body: 'If you have net profit, you owe SE tax (15.3%) on top of regular income tax. Half of SE tax is deductible as an adjustment to income, which reduces your AGI.',
        irsUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes',
      },
    ],
  },

  // =======================================================================
  // DEDUCTIONS & CREDITS SECTION
  // =======================================================================

  itemized_deductions: {
    fields: {
      'Total Medical Expenses': {
        tooltip:
          'Include payments for doctors, dentists, prescriptions, health insurance premiums (not pre-tax), hospital bills, and medical equipment. Only the amount exceeding 7.5% of your AGI is deductible.',
        helpText: 'Only the amount exceeding 7.5% of your AGI is deductible',
        irsRef: 'Schedule A, Lines 1-4',
      },
      'State/Local Income Tax': {
        tooltip:
          'State and local income taxes paid or withheld during 2025. You can choose to deduct either income tax or sales tax, but not both.',
        irsRef: 'Schedule A, Line 5a',
      },
      'Real Estate Tax': {
        tooltip:
          'Property taxes paid on your primary residence and other real property you own. Must be ad valorem (based on assessed value).',
        irsRef: 'Schedule A, Line 5b',
      },
      'Personal Property Tax': {
        tooltip:
          'Annual tax on personal property like vehicles, boats, or RVs, if based on the value of the property. Registration fees alone don\'t count.',
        irsRef: 'Schedule A, Line 5c',
      },
      'Mortgage Interest Paid': {
        tooltip:
          'Interest paid on a mortgage for your primary or second home. Deductible on up to $750,000 of mortgage debt ($375,000 if MFS). From Form 1098.',
        irsRef: 'Schedule A, Line 8a',
      },
      'Mortgage Insurance Premiums': {
        tooltip:
          'Private mortgage insurance (PMI) premiums paid, if your AGI is below the phase-out threshold.',
        irsRef: 'Schedule A, Line 8d',
      },
      'Cash Donations': {
        tooltip:
          'Cash or check contributions to qualified charitable organizations. Keep receipts for all donations. Contributions over $250 require written acknowledgment from the charity.',
        irsRef: 'Schedule A, Line 12',
      },
      'Non-Cash Donations': {
        tooltip:
          'Fair market value of donated property \u2014 clothing, household goods, vehicles, stocks, etc. Items must be in good condition or better. Donations over $500 require Form 8283.',
        helpText: 'Clothing, household items, etc.',
        irsRef: 'Schedule A, Line 12',
      },
    },
    callouts: [
      {
        type: 'warning',
        title: 'SALT deduction cap increased to $40,000',
        body: 'For 2025, the combined deduction for state/local income taxes, real estate taxes, and personal property taxes is limited to $40,000 ($20,000 if Married Filing Separately). The cap phases down for incomes above $500,000. This increase was enacted by the One Big Beautiful Bill Act.',
        irsUrl:
          'https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions-individuals-and-workers',
      },
      {
        type: 'info',
        title: 'Medical expense threshold',
        body: 'You can only deduct the portion of medical expenses that exceeds 7.5% of your AGI. For example, if your AGI is $50,000, only expenses above $3,750 are deductible.',
        irsUrl: 'https://www.irs.gov/taxtopics/tc502',
      },
    ],
  },

  // -----------------------------------------------------------------------
  adjustments: {
    fields: {
      'HSA Contributions': {
        tooltip:
          'Tax-deductible contributions to your Health Savings Account. Employer contributions should be included. 2025 limits: $4,300 (individual), $8,550 (family). Extra $1,000 catch-up if age 55+.',
        helpText:
          'Total contributions made in 2025 (including employer contributions)',
        irsRef: 'Form 8889 \u2192 Schedule 1, Line 13',
      },
      'Student Loan Interest Paid': {
        tooltip:
          'Interest paid on qualified student loans. The deduction is capped at $2,500 and phases out at higher income levels ($85k-$100k single, $170k-$200k MFJ).',
        helpText: 'From Form 1098-E or lender statement',
        irsRef: 'Schedule 1, Line 21',
      },
      'Traditional IRA Contributions': {
        tooltip:
          'Deductible contributions to a traditional IRA. 2025 limit: $7,000 ($8,000 if age 50+). The deduction phases out if you or your spouse are covered by a workplace retirement plan.',
        helpText: 'Roth IRA contributions are not deductible',
        irsRef: 'Schedule 1, Line 20',
      },
      'Total Estimated Payments Made': {
        tooltip:
          'The total of your quarterly estimated tax payments (Form 1040-ES) made during 2025. These are credited against your total tax liability.',
        helpText: 'Sum of all quarterly payments for tax year 2025',
        irsRef: 'Form 1040, Line 26',
      },
    },
  },

  // -----------------------------------------------------------------------
  estimated_payments: {
    fields: {
      'Q1 Payment': {
        tooltip:
          'Estimated tax payment made for Q1 (January 1 \u2013 March 31). Due April 15, 2025.',
        irsRef: 'Form 1040-ES',
      },
      'Q2 Payment': {
        tooltip:
          'Estimated tax payment made for Q2 (April 1 \u2013 May 31). Due June 16, 2025.',
        irsRef: 'Form 1040-ES',
      },
      'Q3 Payment': {
        tooltip:
          'Estimated tax payment made for Q3 (June 1 \u2013 August 31). Due September 15, 2025.',
        irsRef: 'Form 1040-ES',
      },
      'Q4 Payment': {
        tooltip:
          'Estimated tax payment made for Q4 (September 1 \u2013 December 31). Due January 15, 2026.',
        irsRef: 'Form 1040-ES',
      },
      'Prior Year Tax Liability': {
        tooltip:
          'Your total tax from your 2024 Form 1040, Line 24. Used to determine safe harbor eligibility and Form 2210 penalty calculation.',
        irsRef: 'Form 2210, Line 9',
      },
      'Through Mar 31': {
        tooltip:
          'Your cumulative amount from January 1 through March 31. For income: your adjusted gross income for Q1. For withholding: federal tax withheld through Q1. Used to annualize and potentially reduce your underpayment penalty.',
        irsRef: 'Form 2210, Schedule AI, Col (a)',
      },
      'Through May 31': {
        tooltip:
          'Your cumulative amount from January 1 through May 31. For income: your adjusted gross income through Q2. For withholding: federal tax withheld through Q2.',
        irsRef: 'Form 2210, Schedule AI, Col (b)',
      },
      'Through Aug 31': {
        tooltip:
          'Your cumulative amount from January 1 through August 31. For income: your adjusted gross income through Q3. For withholding: federal tax withheld through Q3.',
        irsRef: 'Form 2210, Schedule AI, Col (c)',
      },
      'Through Dec 31': {
        tooltip:
          'Your cumulative amount for the full year (January 1 through December 31). For income: your total adjusted gross income. For withholding: total federal tax withheld.',
        irsRef: 'Form 2210, Schedule AI, Col (d)',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'When are estimated payments required?',
        body: 'If you expect to owe $1,000 or more when you file your return, you generally need to make quarterly estimated tax payments. This applies to self-employed individuals, freelancers, and those with significant investment income not subject to withholding.',
        irsUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes',
      },
      {
        type: 'tip',
        title: 'Safe harbor rules can eliminate penalties',
        body: 'You can avoid the underpayment penalty if your total payments (withholding + estimated) equal at least 90% of your current year tax OR 100% of your prior year tax (110% if your AGI exceeds $150,000). Enter your prior year tax below so we can check this for you.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-2210',
      },
      {
        type: 'info',
        title: 'Planning ahead: 2026 estimated tax vouchers',
        body: 'If your 2025 return shows you owe $1,000 or more after withholding, TelosTax can generate pre-filled Form 1040-ES payment vouchers for 2026. Download them on the Export step. These vouchers are mailed separately from your tax return to a different IRS address.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1040-es',
      },
    ],
  },

  // -----------------------------------------------------------------------
  child_tax_credit: {
    fields: {
      'Qualifying Children (under 17)': {
        tooltip:
          'Children who are under age 17 at the end of the tax year, are your dependents, and have a valid SSN. Each qualifying child is worth a $2,200 credit.',
        helpText: '$2,200 credit per child',
        irsRef: 'Schedule 8812',
      },
      'Other Dependents (17+)': {
        tooltip:
          'Dependents who don\'t qualify for the $2,200 child tax credit \u2014 typically children aged 17-18, full-time students aged 19-24, or elderly parents you support. Worth $500 each.',
        helpText: '$500 credit per dependent',
        irsRef: 'Schedule 8812',
      },
    },
    callouts: [
      {
        type: 'warning',
        title: 'Under 17, not under 18',
        body: 'A common mistake: the Child Tax Credit requires the child to be under age 17 at the end of the tax year \u2014 not under 18. A child who turns 17 during the year does not qualify for the $2,200 credit (but may qualify for the $500 other dependent credit).',
        irsUrl: 'https://www.irs.gov/credits-deductions/individuals/child-tax-credit',
      },
      {
        type: 'info',
        title: 'Income phase-out',
        body: 'The Child Tax Credit begins to phase out at $200,000 AGI for single filers and $400,000 for married filing jointly. The credit is reduced by $50 for every $1,000 of income above the threshold.',
        irsUrl: 'https://www.irs.gov/credits-deductions/individuals/child-tax-credit',
      },
    ],
  },

  // -----------------------------------------------------------------------
  education_credits: {
    fields: {
      'Credit Type': {
        tooltip:
          'The American Opportunity Tax Credit (AOTC) provides up to $2,500 per student for the first 4 years of college. The Lifetime Learning Credit (LLC) provides up to $2,000 per return for any postsecondary education.',
      },
      'Student Name': {
        tooltip:
          'The student for whom education expenses were paid. Must be you, your spouse, or a dependent claimed on your return.',
      },
      'School / Institution': {
        tooltip:
          'The eligible educational institution. Must be accredited and participate in federal student aid programs.',
      },
      'Tuition Paid (1098-T Box 1)': {
        tooltip:
          'Qualified tuition and related expenses paid. Does not include room, board, insurance, or transportation. From Form 1098-T, Box 1.',
        irsRef: 'Form 1098-T, Box 1 \u2192 Form 8863',
      },
      'Scholarships (1098-T Box 5)': {
        tooltip:
          'Scholarships, grants, and tax-free education assistance received. These reduce your qualified expenses. Box 5 minus Box 1 may result in taxable scholarship income.',
        irsRef: 'Form 1098-T, Box 5',
      },
    },
    callouts: [
      {
        type: 'warning',
        title: 'AOTC 4-year limit',
        body: 'The American Opportunity Credit can only be claimed for 4 tax years per student. After that, you may still be eligible for the Lifetime Learning Credit. Also, the AOTC requires the student to be at least half-time.',
        irsUrl: 'https://www.irs.gov/credits-deductions/individuals/aotc',
      },
      {
        type: 'info',
        title: 'MFS filers are ineligible',
        body: 'If your filing status is Married Filing Separately, you cannot claim either education credit. This is one of the significant downsides of filing separately.',
        irsUrl:
          'https://www.irs.gov/credits-deductions/individuals/education-credits-questions-and-answers',
      },
    ],
  },

  // -----------------------------------------------------------------------
  dependent_care: {
    fields: {
      'Total Care Expenses Paid': {
        tooltip:
          'Total amount you paid for care of qualifying persons during the year so that you (and your spouse) could work or look for work.',
        irsRef: 'Form 2441',
      },
      'Number of Qualifying Persons': {
        tooltip:
          'The number of qualifying individuals (children under 13 or disabled dependents/spouse) for whom you paid care expenses so you could work or look for work. Maximum expenses: $3,000 for one, $6,000 for two or more.',
        helpText:
          'Children under 13 or disabled dependents. Limit: $3,000 for 1, $6,000 for 2+.',
        irsRef: 'Form 2441, Part I',
      },
      'Care Provider Name': {
        tooltip:
          'The name of the daycare, preschool, babysitter, or other care provider you paid.',
        irsRef: 'Form 2441',
      },
      'Provider EIN or SSN': {
        tooltip:
          'The tax identification number of the care provider. Required to claim the credit.',
        irsRef: 'Form 2441',
      },
    },
  },

  // -----------------------------------------------------------------------
  savers_credit: {
    fields: {
      'Total Eligible Retirement Contributions': {
        tooltip:
          'Contributions to traditional/Roth IRA, 401(k), 403(b), TSP, SIMPLE, or SEP plans during the tax year. Limit: $2,000 ($4,000 if filing jointly).',
        irsRef: 'Form 8880',
      },
    },
  },

  // -----------------------------------------------------------------------
  clean_energy: {
    fields: {
      'Solar Electric (PV)': {
        tooltip:
          'Cost of solar photovoltaic panels and installation. No maximum.',
        irsRef: 'Form 5695, Line 1',
      },
      'Solar Water Heating': {
        tooltip:
          'Cost of solar water heating systems used for the dwelling (not for pools/hot tubs).',
        irsRef: 'Form 5695, Line 2',
      },
      'Small Wind Energy': {
        tooltip: 'Cost of small wind energy turbine systems. No maximum.',
        irsRef: 'Form 5695, Line 3',
      },
      'Geothermal Heat Pump': {
        tooltip: 'Cost of geothermal heat pump systems. No maximum.',
        irsRef: 'Form 5695, Line 4',
      },
      'Battery Storage': {
        tooltip:
          'Cost of battery/energy storage technology with capacity of 3 kWh or greater.',
        irsRef: 'Form 5695, Line 5',
      },
      'Fuel Cell': {
        tooltip:
          'Cost of qualified fuel cell property. Credit capped at $500 per 0.5 kW of capacity.',
        irsRef: 'Form 5695, Line 7',
      },
      'Fuel Cell Capacity (kW)': {
        tooltip:
          'The capacity in kilowatts of the fuel cell system. Used to calculate the $500/0.5kW cap.',
        irsRef: 'Form 5695, Line 8',
      },
      'Prior Year Unused Credit (Form 5695 Line 16)': {
        tooltip:
          'Unused residential clean energy credit carried forward from the previous tax year. If your credit exceeded your tax liability last year, the excess carries forward to this year.',
        irsRef: 'Form 5695, Line 16',
      },
    },
  },

  // -----------------------------------------------------------------------
  se_health_insurance: {
    fields: {
      'Health Insurance Premiums': {
        tooltip:
          'Premiums you paid for health, dental, and long-term care insurance for yourself, your spouse, and dependents while you were self-employed. Deductible up to your net self-employment income.',
        helpText: 'Self-employed health insurance deduction (100% of premiums)',
        irsRef: 'Schedule 1, Line 17',
      },
    },
  },

  // -----------------------------------------------------------------------
  se_retirement: {
    fields: {
      'SEP-IRA Contributions': {
        tooltip:
          'Contributions to a Simplified Employee Pension (SEP) IRA. The maximum is the lesser of 25% of compensation (20% effective for self-employed) or $70,000 for 2025.',
        irsRef: 'Schedule 1, Line 16',
      },
      'Employee Deferral': {
        tooltip:
          'As both employee and employer of your business, you can defer up to $23,500 of your earnings. If you\'re 50 or older, you can contribute an additional $7,500 catch-up. Ages 60-63 qualify for a $11,250 super catch-up under SECURE 2.0.',
        irsRef: 'Schedule 1, Line 16',
      },
      'Employer Contribution': {
        tooltip:
          'As the employer, you can contribute up to 20% of your adjusted net self-employment income (net profit minus the deductible half of SE tax). The 20% effective rate accounts for the circular calculation described in IRS Publication 560.',
        irsRef: 'Schedule 1, Line 16',
      },
      'SIMPLE IRA Deferrals': {
        tooltip:
          'Elective deferrals to a SIMPLE IRA plan. These share the §402(g) annual deferral limit with 401(k) and 403(b) plans. The 2025 SIMPLE IRA limit is $16,500 ($20,000 if 50+ or $21,750 if 60-63).',
        irsRef: 'Schedule 1, Line 16',
      },
      'Other Retirement Contributions': {
        tooltip:
          'Contributions to other qualified retirement plans such as SIMPLE IRA plans.',
        helpText: 'SIMPLE IRA or other qualified plan contributions',
        irsRef: 'Schedule 1, Line 16',
      },
      'Plan Balance': {
        tooltip:
          'End-of-year plan assets for your Solo 401(k). If plan assets exceed $250,000, Form 5500-EZ must be filed with the IRS. Failure to file can result in penalties of $250/day, up to $150,000 per year.',
        irsRef: 'Form 5500-EZ',
      },
    },
  },

  ev_credit: {
    fields: {
      'Vehicle Type': {
        tooltip: 'Choose whether this is a new vehicle (Section 30D) or a previously owned vehicle (Section 25E).',
      },
      'MSRP': {
        tooltip: 'Manufacturer\'s Suggested Retail Price. Sedans: $55,000 cap. Vans/SUVs/pickups: $80,000 cap.',
        irsRef: 'Form 8936',
      },
      'Purchase Price': {
        tooltip: 'The actual price you paid. Must be $25,000 or less for previously owned vehicles.',
        irsRef: 'Form 8936',
      },
    },
  },

  energy_efficiency: {
    fields: {
      'Heat Pumps / Biomass Stoves': {
        tooltip: 'Electric or natural gas heat pumps, heat pump water heaters, or biomass stoves/boilers. Annual limit: $2,000.',
        irsRef: 'Form 5695, Part II',
      },
      'Central Air Conditioning': {
        tooltip: 'Qualifying central air conditioning systems.',
        irsRef: 'Form 5695, Part II',
      },
      'Water Heater': {
        tooltip: 'Non-heat-pump water heaters (gas, oil, propane).',
        irsRef: 'Form 5695, Part II',
      },
      'Furnace / Boiler': {
        tooltip: 'Natural gas, propane, or oil furnaces and hot water boilers.',
        irsRef: 'Form 5695, Part II',
      },
      'Insulation & Air Sealing': {
        tooltip: 'Insulation materials, air sealing products, and related installation.',
        irsRef: 'Form 5695, Part II',
      },
      'Windows & Skylights': {
        tooltip: 'Energy Star certified exterior windows and skylights. Credit capped at $600.',
        irsRef: 'Form 5695, Part II',
      },
      'Exterior Doors': {
        tooltip: 'Energy Star certified exterior doors. Credit capped at $500 ($250 per door).',
        irsRef: 'Form 5695, Part II',
      },
      'Electrical Panel Upgrade': {
        tooltip: 'Electrical panel upgrade to 200+ amps for electrification. Credit capped at $600.',
        irsRef: 'Form 5695, Part II',
      },
      'Home Energy Audit': {
        tooltip: 'A qualified home energy audit by a certified auditor. Credit capped at $150.',
        irsRef: 'Form 5695, Part II',
      },
    },
  },

  adoption_credit: {
    fields: {
      'Number of Children Adopted': {
        tooltip: 'The number of eligible children adopted during or in connection with the tax year.',
        irsRef: 'Form 8839',
      },
      'Qualified Adoption Expenses': {
        tooltip: 'Reasonable and necessary adoption fees, court costs, attorney fees, travel expenses, and other expenses directly related to the adoption. Maximum $17,280 per child.',
        irsRef: 'Form 8839, Line 1',
      },
    },
  },

  premium_tax_credit: {
    fields: {
      'Enrollment Premium': {
        tooltip: 'The total monthly premium for your health plan from Form 1095-A, Column A.',
        irsRef: 'Form 8962',
      },
      'SLCSP Premium': {
        tooltip: 'The second lowest cost Silver plan premium in your area from Form 1095-A, Column B.',
        irsRef: 'Form 8962',
      },
      'Advance PTC': {
        tooltip: 'The advance premium tax credit paid directly to your insurer from Form 1095-A, Column C.',
        irsRef: 'Form 8962',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Premium Tax Credit (Form 8962)',
        body: 'The premium tax credit is a refundable credit that helps eligible individuals and families cover the cost of health insurance purchased through the Marketplace. If you received advance payments (APTC), you must file Form 8962 to reconcile the advance with the actual credit based on your final income.',
        irsUrl: 'https://www.irs.gov/affordable-care-act/individuals-and-families/the-premium-tax-credit-the-basics',
      },
    ],
  },

  depreciation_assets: {
    fields: {
      'Description': {
        tooltip: 'A brief description of the business asset — e.g., "MacBook Pro," "standing desk," "camera equipment."',
        irsRef: 'Form 4562, Part I',
      },
      'Cost': {
        tooltip: 'The original purchase price of the asset.',
        irsRef: 'Form 4562, Part I, Column (c)',
      },
      'Date Placed in Service': {
        tooltip: 'The date you first started using this asset for business. This determines the first-year depreciation rate.',
        irsRef: 'Form 4562, Part I, Column (b)',
      },
      'Property Class': {
        tooltip: 'The MACRS recovery period for this type of asset. Most business equipment is 5-year (computers, phones) or 7-year (furniture, tools).',
        irsRef: 'Form 4562, Part III',
      },
      'Business Use %': {
        tooltip: 'The percentage of time the asset is used for business. Must be over 50% to qualify for Section 179 and accelerated depreciation.',
        irsRef: 'Form 4562, Part V',
      },
      'Section 179 Election': {
        tooltip: 'The amount you elect to deduct in full this year under Section 179. Limited to your net business income.',
        irsRef: 'Form 4562, Part I, Line 1',
      },
      'Prior Depreciation': {
        tooltip:
          'The total depreciation you have claimed on this asset in all prior tax years combined. This is needed to calculate the remaining depreciable basis.',
        irsRef: 'Form 4562, Column (g)',
      },
      'Prior Section 179': {
        tooltip:
          'Any Section 179 deduction you claimed on this asset in the year it was placed in service. This reduces the depreciable basis for MACRS calculations.',
        irsRef: 'Form 4562, Part I',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Business Equipment Depreciation (Form 4562)',
        body: 'When you purchase equipment for your business, you can deduct the cost through depreciation. Section 179 lets you deduct the full cost in the year of purchase (up to $1,250,000 for 2025). For 2025, 100% bonus depreciation is also available for any remaining cost.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-4562',
      },
    ],
  },

  elderly_disabled: {
    fields: {
      'Age 65 or Older': {
        tooltip: 'You were age 65 or older at the end of the tax year (born before January 2, 1961 for TY2025).',
        irsRef: 'Schedule R, Part I',
      },
      'Disabled': {
        tooltip: 'You retired on permanent and total disability and received taxable disability income during the year.',
        irsRef: 'Schedule R, Part I',
      },
      'Taxable Disability Income': {
        tooltip: 'Your taxable disability income for the year. The credit is limited to this amount if you\'re under 65.',
        irsRef: 'Schedule R, Part II',
      },
      'Nontaxable Social Security': {
        tooltip: 'Total nontaxable Social Security benefits received. This reduces the credit base.',
        irsRef: 'Schedule R, Part III',
      },
      'Nontaxable Pensions': {
        tooltip: 'Other nontaxable pensions, annuities, or disability income. This reduces the credit base.',
        irsRef: 'Schedule R, Part III',
      },
    },
  },

  // -----------------------------------------------------------------------
  prior_year_amt_credit: {
    fields: {
      'Net Prior Year Minimum Tax': {
        tooltip: 'The net minimum tax from your prior year return attributable to deferral items (e.g., ISO exercises, depreciation timing). This comes from your prior year Form 8801 Line 18 or tax software.',
        irsRef: 'Form 8801, Line 18',
      },
      'Credit Carryforward': {
        tooltip: 'Unused minimum tax credit carried forward from prior years. This is the amount from your prior year Form 8801 Line 26.',
        irsRef: 'Form 8801, Line 19',
      },
    },
  },

  // -----------------------------------------------------------------------
  archer_msa: {
    fields: {
      'HDHP Deductible': {
        tooltip: 'The annual deductible for your High Deductible Health Plan. Your Archer MSA contribution limit is based on a percentage of this amount (65% self-only, 75% family).',
        irsRef: 'Form 8853, Line 3',
      },
      'Personal Contributions': {
        tooltip: 'Your personal contributions to the Archer MSA during the tax year. Does not include employer contributions (W-2 Box 12 Code R).',
        irsRef: 'Form 8853, Line 2',
      },
    },
  },

  // -----------------------------------------------------------------------
  ev_refueling: {
    fields: {
      'Description': {
        tooltip:
          'Describe the equipment you installed, such as "Level 2 home EV charger" or "DC fast charging station."',
        irsRef: 'Form 8911',
      },
      'Cost of Equipment and Installation': {
        tooltip:
          'The total cost of the EV charging equipment plus installation labor. The credit is 30% of this amount, capped at $1,000 for personal use or $100,000 for business.',
        irsRef: 'Form 8911',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Alternative Fuel Vehicle Refueling Property Credit',
        body: 'The credit is 30% of equipment and installation costs. For personal/home use, the cap is $1,000 per property. For business use, the cap is $100,000. Eligible equipment includes EV chargers, hydrogen fuel dispensers, natural gas refueling, and E85 ethanol stations. The property must be located in an eligible census tract.',
        irsUrl: 'https://www.irs.gov/credits-deductions/alternative-fuel-vehicle-refueling-property-credit',
      },
    ],
  },

  // -----------------------------------------------------------------------
  form_8283: {
    fields: {
      'Donee Organization': {
        tooltip:
          'The name of the charitable organization that received your noncash donation. Must be a qualified 501(c)(3) organization.',
        irsRef: 'Form 8283, Section A, Column (a)',
      },
      'Description of Donated Property': {
        tooltip:
          'Describe the donated property — e.g., "Men\'s clothing (good condition)," "2019 Honda Civic," or "100 shares of AAPL stock."',
        irsRef: 'Form 8283, Section A, Column (b)',
      },
      'Date Contributed': {
        tooltip: 'The date you donated the property to the organization.',
        irsRef: 'Form 8283, Section A, Column (c)',
      },
      'Fair Market Value': {
        tooltip:
          'The price a willing buyer would pay a willing seller on the date of the donation. For clothing and household items, use thrift store or resale prices — not what you originally paid.',
        irsRef: 'Form 8283, Section A, Column (d)',
      },
      'Date Acquired': {
        tooltip:
          'When you originally acquired the property. This determines whether any gain is long-term or short-term.',
        irsRef: 'Form 8283, Section A, Column (e)',
      },
      'How Acquired': {
        tooltip:
          'How you obtained the property: purchase, gift, inheritance, or exchange.',
        irsRef: 'Form 8283, Section A, Column (f)',
      },
      'Cost or Other Basis': {
        tooltip:
          'What you originally paid for the property, or its adjusted basis if inherited or received as a gift.',
        irsRef: 'Form 8283, Section A, Column (g)',
      },
      'Method of Valuation': {
        tooltip:
          'How you determined the fair market value — e.g., "Thrift shop comparison," "KBB value," "Broker statement," or "Qualified appraisal."',
        irsRef: 'Form 8283, Section A, Column (h)',
      },
    },
    callouts: [
      {
        type: 'warning',
        title: 'Appraisal requirements',
        body: 'Donations of a single item or group of similar items valued over $5,000 generally require a qualified appraisal by a certified appraiser. Vehicles, boats, and airplanes over $500 need a Form 1098-C from the charity.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-8283',
      },
      {
        type: 'tip',
        title: 'Valuing used clothing and household items',
        body: 'Items must be in "good used condition or better" to be deductible. Check thrift stores, consignment shops, or IRS Publication 561 for valuation guidelines. Keep photos and written descriptions for higher-value items.',
        irsUrl: 'https://www.irs.gov/publications/p561',
      },
      {
        type: 'tip',
        title: 'Built-in value lookup tool',
        body: 'Use the built-in value lookup to find fair market values based on Salvation Army and Goodwill pricing guides, or estimate value from original purchase price using typical depreciation rates. These are estimates only — not IRS-published values.',
      },
    ],
  },

  // =======================================================================
  // DISCOVERY & OVERVIEW STEPS (no form fields — callouts only)
  // =======================================================================

  income_overview: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'Reporting all income',
        body: 'The IRS receives copies of all tax forms (W-2s, 1099s, etc.) sent to you. Even if you didn\'t receive a form, income from freelance work, cash payments, gambling winnings, and side gigs is taxable and must be reported.',
        irsUrl: 'https://www.irs.gov/taxtopics/tc400',
      },
      {
        type: 'tip',
        title: 'Not sure which forms you need?',
        body: 'Select "Yes" for any income type you received in 2025, "No" if you\'re sure you didn\'t, and "Later" if you need to check. You can always come back and change your answer.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  income_summary: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'Review your income',
        body: 'This page shows all income entered so far. Review each category for accuracy before moving to deductions. Missing income is the #1 cause of IRS notices.',
        irsUrl: 'https://www.irs.gov/individuals/understanding-your-form-1040',
      },
    ],
  },

  // -----------------------------------------------------------------------
  deductions_discovery: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'Deductions reduce your taxable income',
        body: 'Deductions lower the amount of income subject to tax. Common deductions include HSA contributions, student loan interest, IRA contributions, and self-employment expenses. Select "Yes" for any deduction you may qualify for.',
        irsUrl: 'https://www.irs.gov/credits-and-deductions-for-individuals',
      },
      {
        type: 'tip',
        title: 'Above-the-line vs. below-the-line',
        body: 'The deductions listed here are "above-the-line" adjustments — they reduce your AGI regardless of whether you itemize. This is different from itemized deductions (mortgage interest, SALT, charity) which are "below-the-line."',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-schedule-1-form-1040',
      },
    ],
  },

  // -----------------------------------------------------------------------
  deduction_method: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'Standard deduction vs. itemized',
        body: 'Choose the method that gives you the larger deduction. The standard deduction for 2025 is $15,750 (Single), $31,500 (MFJ), or $23,625 (HoH). Itemize if your total qualifying expenses (mortgage interest, state/local taxes, charitable donations, medical expenses) exceed the standard amount.',
        irsUrl: 'https://www.irs.gov/taxtopics/tc501',
      },
      {
        type: 'tip',
        title: '2025 SALT cap increase',
        body: 'The SALT deduction cap has been raised from $10,000 to $40,000 for 2025. If you live in a high-tax state, this may make itemizing more beneficial than in prior years.',
        irsUrl: 'https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions-individuals-and-workers',
      },
    ],
  },

  // -----------------------------------------------------------------------
  credits_overview: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'Credits reduce your tax directly',
        body: 'Unlike deductions (which reduce taxable income), credits reduce your tax dollar-for-dollar. A $1,000 credit saves you $1,000 in tax. Some credits are even "refundable" — meaning they can result in a refund even if your tax is $0.',
        irsUrl: 'https://www.irs.gov/credits-and-deductions-for-individuals',
      },
      {
        type: 'tip',
        title: 'Don\'t leave money on the table',
        body: 'Select "Yes" for any credit you might qualify for. If you\'re not sure about eligibility, select "Not Sure" and we\'ll help you determine if you qualify on the next page.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  deductions_summary: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'Your deductions and credits summary',
        body: 'This page shows the combined impact of your deductions, adjustments, and credits. Review the totals and make sure nothing is missing before moving to the review section.',
        irsUrl: 'https://www.irs.gov/credits-and-deductions-for-individuals',
      },
    ],
  },

  // =======================================================================
  // STATE TAX STEPS
  // =======================================================================

  state_overview: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'State income tax filing',
        body: 'Most states require a separate income tax return. Your state tax is based on your federal AGI with state-specific additions and subtractions. Nine states have no income tax: Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas, Washington, and Wyoming.',
        irsUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/state-government-websites',
      },
      {
        type: 'tip',
        title: 'Multiple states',
        body: 'If you lived in or earned income in more than one state during 2025, you may need to file in each state. Add all states where you had income or residency.',
        irsUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/state-government-websites',
      },
    ],
  },

  // -----------------------------------------------------------------------
  state_details: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'State-specific adjustments',
        body: 'Each state has its own rules for additions (income taxed by the state but not federally) and subtractions (income exempt from state tax). Common examples: some states exempt Social Security, retirement income, or military pay.',
        irsUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/state-government-websites',
      },
    ],
  },

  // -----------------------------------------------------------------------
  state_review: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'State tax summary',
        body: 'Review your estimated state tax for each state. The amounts shown are estimates based on your current data. Your actual state tax may differ slightly due to rounding or state-specific rules not yet modeled.',
        irsUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/state-government-websites',
      },
    ],
  },

  // =======================================================================
  // REVIEW STEPS
  // =======================================================================

  review_schedule_c: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'Schedule C: Profit or Loss from Business',
        body: 'This review shows your self-employment income, expenses, and net profit or loss as it will appear on Schedule C. Net profit is subject to both income tax and self-employment tax (15.3%). Review all amounts before proceeding.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-schedule-c-form-1040',
      },
    ],
  },

  // -----------------------------------------------------------------------
  amt_data: {
    fields: {
      'ISO Exercise Spread (Line 2i)': {
        tooltip:
          'The difference between the fair market value (FMV) of the stock at exercise and the exercise price paid. This spread is not taxed as regular income for ISOs but is added back for AMT.',
        irsRef: 'Form 6251, Line 2i; IRC §56(b)(3)',
      },
      'Private Activity Bond Interest (Line 2g)': {
        tooltip:
          'Tax-exempt interest from private activity bonds issued after August 7, 1986. This interest is exempt from regular tax but must be added back for AMT.',
        irsRef: 'Form 6251, Line 2g; IRC §57(a)(5)',
      },
      'Tax Refund Adjustment (Line 2b)': {
        tooltip:
          'If you claimed an itemized deduction for state/local taxes in a prior year, received a refund, and reported it as income, you may need an AMT adjustment if the deduction was not allowed for AMT.',
        irsRef: 'Form 6251, Line 2b',
      },
      'Investment Interest Difference (Line 2c)': {
        tooltip:
          'The difference between regular and AMT investment interest expense. Under AMT, investment interest may be recomputed because certain items of investment income are treated differently.',
        irsRef: 'Form 6251, Line 2c; IRC §56(b)(2)',
      },
      'Depletion (Line 2d)': {
        tooltip:
          'The excess of percentage depletion over the adjusted basis of the property. For AMT, depletion is limited to the adjusted basis of the property.',
        irsRef: 'Form 6251, Line 2d; IRC §57(a)(1)',
      },
      'ATNOLD (Line 2f)': {
        tooltip:
          'Alternative tax net operating loss deduction. The NOL is recomputed under AMT rules, which may differ from the regular NOL. Enter as a negative number to reduce AMTI.',
        irsRef: 'Form 6251, Line 2f; IRC §56(d)',
      },
      'QSBS Exclusion (Line 2h)': {
        tooltip:
          'The excluded gain from qualified small business stock under Section 1202. A portion of the excluded gain (7%) is a tax preference item for AMT.',
        irsRef: 'Form 6251, Line 2h; IRC §57(a)(7)',
      },
      'Disposition of Property (Line 2k)': {
        tooltip:
          'The difference between AMT and regular gain or loss on disposition of property when AMT basis differs from regular basis (e.g., due to depreciation adjustments).',
        irsRef: 'Form 6251, Line 2k',
      },
      'Depreciation Adjustment (Line 2l)': {
        tooltip:
          'The difference between MACRS depreciation (regular tax) and ADS depreciation (AMT) for property placed in service after 1986. ADS generally uses longer recovery periods and straight-line method.',
        irsRef: 'Form 6251, Line 2l; IRC §56(a)(1)',
      },
      'Passive Activity Loss (Line 2m)': {
        tooltip:
          'The difference between passive activity loss allowed under regular tax and AMT rules. Passive losses must be recomputed using AMT income and deductions.',
        irsRef: 'Form 6251, Line 2m; IRC §58(b)',
      },
      'Loss Limitations (Line 2n)': {
        tooltip:
          'The difference between regular and AMT loss limitations, including basis, at-risk, and excess business loss limitations recomputed under AMT rules.',
        irsRef: 'Form 6251, Line 2n',
      },
      'Circulation Costs (Line 2o)': {
        tooltip:
          'Circulation expenditures that were deducted currently for regular tax but must be amortized over 3 years for AMT.',
        irsRef: 'Form 6251, Line 2o; IRC §56(b)(1)(A)(i)',
      },
      'Long-Term Contracts (Line 2p)': {
        tooltip:
          'The difference in income from long-term contracts under regular tax (completed contract method) vs. AMT (percentage of completion method).',
        irsRef: 'Form 6251, Line 2p; IRC §56(a)(3)',
      },
      'Mining Costs (Line 2q)': {
        tooltip:
          'Mining exploration and development costs that were expensed currently for regular tax but must be amortized over 10 years for AMT.',
        irsRef: 'Form 6251, Line 2q; IRC §56(a)(2)',
      },
      'Research & Experimental Costs (Line 2r)': {
        tooltip:
          'Research and experimental expenditures that were deducted currently for regular tax but must be amortized over 10 years for AMT (for costs paid or incurred after 2021).',
        irsRef: 'Form 6251, Line 2r; IRC §56(b)(1)(A)(ii)',
      },
      'Intangible Drilling Costs (Line 2t)': {
        tooltip:
          'Excess intangible drilling costs. For AMT, IDCs may need to be amortized over 10 years instead of being expensed, unless they do not exceed 65% of net oil and gas income.',
        irsRef: 'Form 6251, Line 2t; IRC §57(a)(2)',
      },
      'Other AMT Adjustments (Line 3)': {
        tooltip:
          'Any other AMT adjustments not covered by the specific lines above. Include adjustments from estates, trusts, or electing large partnerships.',
        irsRef: 'Form 6251, Line 3',
      },
      'AMT Foreign Tax Credit (Part II, Line 8)': {
        tooltip:
          'The foreign tax credit recomputed under AMT rules. This credit reduces the tentative minimum tax. Cannot exceed the tentative minimum tax.',
        irsRef: 'Form 6251, Part II Line 8; IRC §59(a)',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Form 6251 Adjustments',
        body: 'The AMT requires adding back certain deductions and preferences to your regular taxable income. The most common items are incentive stock option (ISO) exercise spreads and private activity bond interest. Most other adjustments are rare for typical individual filers.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-6251',
      },
    ],
  },

  // -----------------------------------------------------------------------
  amt_review: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'Alternative Minimum Tax (AMT)',
        body: 'The AMT is a parallel tax system that limits certain deductions and tax preferences. If your AMT calculation exceeds your regular tax, you owe the difference as additional tax. Common AMT triggers include large state tax deductions, incentive stock options (ISOs), and certain tax-exempt interest.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-6251',
      },
    ],
  },

  // -----------------------------------------------------------------------
  review_form_1040: {
    fields: {
      'Your Social Security Number': {
        tooltip:
          'Your full 9-digit Social Security number. Encrypted with AES-256-GCM and stored only on your device. Required for IRS form filing.',
        irsRef: 'Form 1040, SSN field',
      },
      'Spouse Social Security Number': {
        tooltip:
          'Your spouse\'s full 9-digit Social Security number. Encrypted and stored only on your device. Required when filing a joint return.',
        irsRef: 'Form 1040, Spouse SSN field',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Form 1040 line-by-line review',
        body: 'This is your complete federal return as it will be filed. Each line maps to the official IRS Form 1040. Review all amounts carefully — this is your last chance to catch errors before generating your PDF.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-1040',
      },
      {
        type: 'warning',
        title: 'Verify your withholding',
        body: 'Check that your total withholding (from W-2s and 1099s) matches your actual tax documents. Incorrect withholding is a common source of discrepancies between your return and IRS records.',
        irsUrl: 'https://www.irs.gov/individuals/tax-withholding-estimator',
      },
    ],
  },

  // -----------------------------------------------------------------------
  tax_summary: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'Your tax return summary',
        body: 'This summary shows your total income, deductions, credits, and final refund or amount owed. If you owe taxes, they are due by April 15, 2026. If you expect a refund, e-filing with direct deposit is the fastest way to receive it.',
        irsUrl: 'https://www.irs.gov/filing/individuals/how-to-file',
      },
    ],
  },

  // -----------------------------------------------------------------------
  filing_instructions: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'Paper filing instructions',
        body: 'Print your completed forms from the next step, sign them, and mail to the IRS address shown below.',
        irsUrl: 'https://www.irs.gov/filing/where-to-file-paper-tax-returns-with-or-without-a-payment',
      },
      {
        type: 'tip',
        title: 'You can pay online even if you file by mail',
        body: 'If you owe taxes, you don\'t have to mail a check. Use IRS Direct Pay (irs.gov/directpay) to pay electronically for free. Your payment will be matched to your paper return.',
        irsUrl: 'https://directpay.irs.gov',
      },
    ],
  },

  // -----------------------------------------------------------------------
  export_pdf: {
    fields: {},
    callouts: [
      {
        type: 'warning',
        title: 'Review before exporting',
        body: 'Your PDF will contain all data entered in this return. Double-check your personal information, income amounts, and deductions before generating the final document. TelosTax is a preparation tool — you still need to file your return with the IRS.',
      },
      {
        type: 'tip',
        title: 'Keep a copy for your records',
        body: 'The IRS recommends keeping copies of your tax returns and supporting documents for at least 3 years from the filing date (or 6 years if you underreported income by more than 25%).',
        irsUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records',
      },
    ],
  },

  // =======================================================================
  // NEW STEPS — migrated from missing-tooltips.ts
  // =======================================================================

  // -----------------------------------------------------------------------
  w2g_income: {
    fields: {
      'Payer Name': {
        tooltip:
          'The name of the casino, racetrack, lottery commission, or other payer that issued the W-2G.',
        irsRef: 'W-2G, Payer box',
      },
      'Gross Winnings (Box 1)': {
        tooltip:
          'The total amount of gambling winnings reported on this W-2G. All gambling income is taxable and must be reported.',
        irsRef: 'W-2G, Box 1',
      },
      'Federal Tax Withheld (Box 4)': {
        tooltip:
          'Federal income tax withheld from your gambling winnings. Winnings are subject to 24% withholding when they exceed certain thresholds.',
        irsRef: 'W-2G, Box 4',
      },
      'Type of Wager': {
        tooltip:
          'The type of gambling activity, such as slot machine, horse racing, poker tournament, lottery, keno, or bingo.',
        irsRef: 'W-2G, Box 9',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'All gambling income is taxable',
        body: 'You must report all gambling winnings as income, even if you did not receive a W-2G. You may deduct gambling losses up to the amount of your winnings if you itemize deductions on Schedule A.',
        irsUrl: 'https://www.irs.gov/taxtopics/tc419',
      },
      {
        type: 'tip',
        title: 'Keep a gambling log',
        body: 'The IRS recommends keeping a diary of gambling activities including dates, types of wager, amounts won and lost, and the names of establishments. This documentation supports your deduction for gambling losses.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  '1099c_income': {
    fields: {
      'Creditor / Lender Name': {
        tooltip:
          'The name of the creditor or lender who cancelled the debt, as shown on your 1099-C form.',
        irsRef: '1099-C, Creditor box',
      },
      'Amount of Debt Cancelled (Box 2)': {
        tooltip:
          'The amount of debt that was cancelled, forgiven, or discharged. This is generally taxable income unless an exclusion applies.',
        irsRef: '1099-C, Box 2',
      },
      'Interest Included in Box 2 (Box 3)': {
        tooltip:
          'The portion of the cancelled debt (Box 2) that represents interest, if specified by the creditor.',
        irsRef: '1099-C, Box 3',
      },
      'Date of Cancellation (Box 1)': {
        tooltip:
          'The date the creditor cancelled or discharged the debt.',
        irsRef: '1099-C, Box 1',
      },
      'Description of Debt (Box 4)': {
        tooltip:
          'A description of the origin of the debt, such as credit card, mortgage, student loan, medical, or auto loan.',
        irsRef: '1099-C, Box 4',
      },
      'Event Code (Box 6)': {
        tooltip:
          'The code identifying the event that caused the cancellation. A=Bankruptcy, B=Other judicial relief, C=Statute of limitations, D=Foreclosure, E=Debt relief from probate, F=By agreement, G=Decision to discontinue collection, H=Other.',
        irsRef: '1099-C, Box 6',
      },
      'Federal Tax Withheld': {
        tooltip:
          'Federal income tax withheld from the cancellation of debt, if any.',
        irsRef: '1099-C, Box 7',
      },
      'Total Liabilities Before Discharge': {
        tooltip:
          'The total of all your debts (mortgages, credit cards, car loans, student loans, etc.) immediately before the debt was cancelled. Used to determine if you were insolvent.',
        irsRef: 'Form 982, Insolvency Worksheet',
      },
      'Total Assets (FMV) Before Discharge': {
        tooltip:
          'The fair market value of all your assets (home equity, vehicles, bank accounts, retirement accounts, etc.) immediately before the cancellation. If liabilities exceed assets, you were insolvent.',
        irsRef: 'Form 982, Insolvency Worksheet',
      },
    },
    callouts: [
      {
        type: 'warning',
        title: 'Cancelled debt is usually taxable income',
        body: 'When a creditor cancels $600 or more of your debt, the cancelled amount is generally reported as taxable income. However, exclusions may apply if you were insolvent, the debt was discharged in bankruptcy, or it was qualified principal residence indebtedness.',
        irsUrl: 'https://www.irs.gov/taxtopics/tc431',
      },
      {
        type: 'tip',
        title: 'Insolvency exclusion',
        body: 'If your total liabilities exceeded your total assets immediately before the cancellation, you were insolvent. You can exclude cancelled debt up to the amount of your insolvency. Enter your liabilities and assets below to check.',
        irsUrl: 'https://www.irs.gov/pub/irs-pdf/p4681.pdf',
      },
    ],
  },

  // -----------------------------------------------------------------------
  '1099q_income': {
    fields: {
      'Plan / Trustee Name': {
        tooltip:
          'The name of the 529 plan administrator or trustee that made the distribution, as shown on your 1099-Q.',
        irsRef: '1099-Q, Payer box',
      },
      'Gross Distribution (Box 1)': {
        tooltip:
          'The total amount distributed from the 529 plan during the year. This includes both earnings and return of contributions.',
        irsRef: '1099-Q, Box 1',
      },
      'Earnings (Box 2)': {
        tooltip:
          'The earnings portion of the distribution. If used for qualified education expenses, this amount is tax-free. Otherwise it is taxable and subject to a 10% penalty.',
        irsRef: '1099-Q, Box 2',
      },
      'Basis / Return of Contribution (Box 3)': {
        tooltip:
          'The portion of the distribution that represents a return of your original contributions (basis). This amount is always tax-free.',
        irsRef: '1099-Q, Box 3',
      },
      'Distribution Type': {
        tooltip:
          'Whether the distribution was used for qualified education expenses (tax-free), non-qualified purposes (taxable + 10% penalty on earnings), or rolled over to another 529 plan (tax-free).',
        irsRef: '1099-Q, Box 4',
      },
      'Qualified Education Expenses Paid': {
        tooltip:
          'The total qualified education expenses paid during the year, including tuition, fees, books, supplies, equipment, and room and board (for students enrolled at least half-time). Up to $10,000 for K-12 tuition.',
        irsRef: 'IRS Pub 970, Ch. 8',
      },
      'Tax-Free Scholarships / Grants': {
        tooltip:
          'Tax-free educational assistance received for the same student, including scholarships, fellowships, Pell grants, employer-provided educational assistance (IRC §127), and veterans\' educational assistance. This amount reduces your qualified expenses when calculating the tax-free portion of 529 earnings.',
        irsRef: 'IRS Pub 970, Ch. 8 Worksheet',
      },
      'Expenses Claimed for Education Credits': {
        tooltip:
          'Qualified education expenses you are allocating to the American Opportunity Credit (AOC) or Lifetime Learning Credit (LLC). The same expenses cannot be used for both a 529 tax-free exclusion and an education credit.',
        irsRef: 'IRC §25A; IRS Pub 970, Ch. 8',
      },
    },
    callouts: [
      {
        type: 'info',
        title: '529 distributions and taxes',
        body: 'Distributions used for qualified education expenses are tax-free. Non-qualified distributions are taxed on the earnings portion and subject to a 10% penalty. Rollovers to another 529 plan within 60 days are not taxable.',
        irsUrl: 'https://www.irs.gov/taxtopics/tc313',
      },
      {
        type: 'warning',
        title: 'No double-dipping with education credits',
        body: 'The same expenses cannot be used for both a 529 tax-free exclusion and an education credit (AOTC or LLC). Allocate expenses to the credit that provides the greater benefit.',
        irsUrl: 'https://www.irs.gov/publications/p970',
      },
    ],
  },

  // -----------------------------------------------------------------------
  home_sale: {
    fields: {
      'Sale Price': {
        tooltip:
          'The total amount you received for the sale of your home, as reported on Form 1099-S. Include cash, notes, and the fair market value of any property received.',
        irsRef: '1099-S, Box 2',
      },
      'Cost Basis': {
        tooltip:
          'Your adjusted basis in the home — typically the original purchase price plus the cost of permanent improvements (additions, renovations, landscaping), minus any casualty losses claimed.',
        irsRef: 'IRS Pub 523, Adjusted Basis',
      },
      'Selling Expenses': {
        tooltip:
          'Costs directly related to selling the home, including real estate agent commissions, title insurance, legal fees, transfer taxes, and advertising.',
        irsRef: 'IRS Pub 523, Selling Expenses',
      },
      'Months Owned (last 5 years)': {
        tooltip:
          'The number of months you owned the home during the 5-year period ending on the date of sale. You need at least 24 months to meet the ownership test for the Section 121 exclusion.',
        irsRef: 'IRC §121(a), Pub 523',
      },
      'Months Used as Residence (last 5 years)': {
        tooltip:
          'The number of months the home was your primary residence during the 5-year period ending on the date of sale. You need at least 24 months to meet the use test. The months do not need to be consecutive.',
        irsRef: 'IRC §121(a), Pub 523',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Section 121 exclusion',
        body: 'If you owned and used the home as your primary residence for at least 2 of the 5 years before the sale, you can exclude up to $250,000 of gain ($500,000 if married filing jointly). Any gain above the exclusion is taxed as a capital gain.',
        irsUrl: 'https://www.irs.gov/publications/p523',
      },
      {
        type: 'tip',
        title: 'Improvements increase your basis',
        body: 'Permanent home improvements (kitchen remodel, new roof, addition) increase your cost basis, which reduces your taxable gain. Keep records and receipts for all improvements.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  foreign_earned_income: {
    fields: {
      'Foreign Earned Income': {
        tooltip:
          'Wages, salaries, professional fees, and other income earned for personal services performed in a foreign country while your tax home was abroad.',
        irsRef: 'Form 2555, Line 19',
      },
      'Qualifying Days Abroad': {
        tooltip:
          'The number of days during the tax year that you met the bona fide residence test or the physical presence test (330 full days in a 12-month period). Partial years are prorated.',
        irsRef: 'Form 2555, Lines 16-18',
      },
      'Foreign Housing Expenses': {
        tooltip:
          'Qualifying housing expenses paid abroad, including rent, utilities, insurance, and repairs (but not extravagant costs). The housing exclusion is the excess over a base amount (16% of the FEIE limit).',
        irsRef: 'Form 2555, Line 28',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Foreign Earned Income Exclusion (FEIE)',
        body: 'For 2025, you can exclude up to $130,000 of foreign earned income from U.S. tax if you meet either the bona fide residence test or the physical presence test (330 full days in a 12-month period). You may also exclude or deduct certain housing expenses.',
        irsUrl: 'https://www.irs.gov/individuals/international-taxpayers/foreign-earned-income-exclusion',
      },
      {
        type: 'warning',
        title: 'You must still file a U.S. return',
        body: 'U.S. citizens and resident aliens must report worldwide income, even if it qualifies for the FEIE. The exclusion reduces your taxable income but does not eliminate your filing requirement.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  form4797: {
    fields: {
      'Property Description': {
        tooltip:
          'A brief description of the business property sold, such as "office equipment," "rental building," or "delivery truck."',
        irsRef: 'Form 4797, Column (a)',
      },
      'Date Acquired': {
        tooltip:
          'The date you originally acquired the property. Enter "Various" if acquired on different dates.',
        irsRef: 'Form 4797, Column (b)',
      },
      'Date Sold': {
        tooltip:
          'The date you sold or otherwise disposed of the property.',
        irsRef: 'Form 4797, Column (c)',
      },
      'Sales Price': {
        tooltip:
          'The total amount you received for the property, including cash, fair market value of property received, and any debt the buyer assumed.',
        irsRef: 'Form 4797, Column (d)',
      },
      'Cost Basis': {
        tooltip:
          'Your adjusted basis in the property — generally the original cost plus improvements, minus depreciation allowed or allowable.',
        irsRef: 'Form 4797, Column (e)',
      },
      'Depreciation Allowed': {
        tooltip:
          'The total depreciation you claimed (or could have claimed) over the life of the asset. This amount is subject to depreciation recapture as ordinary income.',
        irsRef: 'Form 4797, Part III, Line 22',
      },
      'Straight-Line Depreciation': {
        tooltip:
          'For Section 1250 property (real estate), the depreciation that would have been allowed using the straight-line method. The excess over this amount is recaptured as ordinary income.',
        irsRef: 'Form 4797, Part III, Line 26',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Depreciation recapture',
        body: 'When you sell depreciated business property, the IRS "recaptures" prior depreciation deductions as ordinary income (Section 1245 for personal property, Section 1250 for real estate). Any remaining gain is taxed at capital gains rates.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-4797',
      },
      {
        type: 'warning',
        title: 'Section 1250 unrecaptured gain',
        body: 'For real property, unrecaptured Section 1250 gain (the lesser of total depreciation or total gain) is taxed at a maximum rate of 25%, which is higher than the standard long-term capital gains rates.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  schedule_f: {
    fields: {
      // --- Part I: Farm Income ---
      'Sales of Livestock (Line 1a)': {
        tooltip:
          'Total sales of livestock and other resale items you bought for resale. Report the full sale price here; the cost or basis is subtracted on Line 1b.',
        irsRef: 'Schedule F, Line 1a',
      },
      'Cost of Livestock (Line 1b)': {
        tooltip:
          'The cost or other basis of livestock and other items you bought for resale and actually sold during the year.',
        irsRef: 'Schedule F, Line 1b',
      },
      'Sales of Products You Raised (Line 2)': {
        tooltip:
          'Total sales of livestock, produce, grains, and other products you raised on your farm.',
        irsRef: 'Schedule F, Line 2',
      },
      'Cooperative Distributions (Line 3a)': {
        tooltip:
          'Total distributions received from cooperatives. This includes both taxable and nontaxable portions.',
        irsRef: 'Schedule F, Line 3a',
      },
      'Taxable Amount (Line 3b)': {
        tooltip:
          'The taxable portion of cooperative distributions. This amount is included in your farm income.',
        irsRef: 'Schedule F, Line 3b',
      },
      'Agricultural Program Payments (Line 4a)': {
        tooltip:
          'Payments received from federal or state agricultural programs, including USDA conservation, disaster, and commodity programs.',
        irsRef: 'Schedule F, Line 4a',
      },
      'CCC Loans Reported as Income (Line 5a)': {
        tooltip:
          'Commodity Credit Corporation (CCC) loans reported as income. If you pledge crops as collateral for a CCC loan, you can elect to report the loan as income.',
        irsRef: 'Schedule F, Line 5a',
      },
      'Crop Insurance Proceeds (Line 6)': {
        tooltip:
          'Proceeds received from crop insurance and federal crop disaster payments. You may be able to defer this income to the following year.',
        irsRef: 'Schedule F, Line 6',
      },
      'Custom Hire / Machine Work (Line 7)': {
        tooltip:
          'Income from custom hire (machine work) you performed for others using your farm equipment.',
        irsRef: 'Schedule F, Line 7',
      },
      'Other Farm Income (Line 8)': {
        tooltip:
          'Other farm income not reported elsewhere, including breeding fees, bartering income, federal gas tax credits, state gas tax refunds, and other miscellaneous farm income.',
        irsRef: 'Schedule F, Line 8',
      },
      // --- Part II: Farm Expenses ---
      'Car & Truck (Line 10)': {
        tooltip:
          'Expenses for cars and trucks used in your farming business. You can use the standard mileage rate (70 cents/mile for 2025) or actual expenses.',
        irsRef: 'Schedule F, Line 10',
      },
      'Chemicals (Line 11)': {
        tooltip:
          'Cost of chemicals used in farming operations, including pesticides, herbicides, fungicides, and other crop protection products.',
        irsRef: 'Schedule F, Line 11',
      },
      'Conservation (Line 12)': {
        tooltip:
          'Expenses for soil and water conservation on farmland, including terracing, contour farming, and drainage ditches. Subject to the 25%-of-gross-income limitation unless you elect to deduct under IRC §175.',
        irsRef: 'Schedule F, Line 12',
      },
      'Custom Hire (Line 13)': {
        tooltip:
          'Amounts paid for custom hire (machine work) others performed on your farm, such as combining, baling, or crop dusting.',
        irsRef: 'Schedule F, Line 13',
      },
      'Depreciation (Line 14)': {
        tooltip:
          'Depreciation and Section 179 expense deduction for farm machinery, equipment, buildings, and other depreciable farm assets. Calculated on Form 4562.',
        irsRef: 'Schedule F, Line 14',
      },
      'Employee Benefits (Line 15)': {
        tooltip:
          'Amounts paid for employee benefit programs for farm workers, including health insurance, accident insurance, and qualified retirement plans.',
        irsRef: 'Schedule F, Line 15',
      },
      'Feed (Line 16)': {
        tooltip:
          'Cost of feed purchased for livestock, including hay, grain, supplements, salt, and other animal feed.',
        irsRef: 'Schedule F, Line 16',
      },
      'Fertilizers & Lime (Line 17)': {
        tooltip:
          'Cost of fertilizers and lime used in farming operations. If the benefit lasts more than one year, you may need to capitalize and depreciate instead.',
        irsRef: 'Schedule F, Line 17',
      },
      'Freight & Trucking (Line 18)': {
        tooltip:
          'Freight and trucking costs for hauling farm products, livestock, supplies, and equipment.',
        irsRef: 'Schedule F, Line 18',
      },
      'Gasoline & Fuel (Line 19)': {
        tooltip:
          'Cost of gasoline, diesel, and other fuels used in farming operations. You may also be eligible for a federal fuel tax credit on Form 4136.',
        irsRef: 'Schedule F, Line 19',
      },
      'Insurance (Line 20)': {
        tooltip:
          'Premiums paid for farm business insurance, including liability, property, crop, and livestock insurance. Do not include health insurance here.',
        irsRef: 'Schedule F, Line 20',
      },
      'Interest (Line 21)': {
        tooltip:
          'Interest paid on farm business debts, including mortgages on farm property, operating loans, and equipment financing.',
        irsRef: 'Schedule F, Line 21',
      },
      'Labor Hired (Line 22)': {
        tooltip:
          'Wages and salaries paid to farm employees (not contract labor). Include the employee share of Social Security and Medicare taxes you paid.',
        irsRef: 'Schedule F, Line 22',
      },
      'Pension & Profit-Sharing (Line 23)': {
        tooltip:
          'Contributions to pension and profit-sharing plans for farm employees, including SEP, SIMPLE, and other qualified retirement plans.',
        irsRef: 'Schedule F, Line 23',
      },
      'Rent / Lease (Line 24)': {
        tooltip:
          'Rent or lease payments for farm property, machinery, and equipment used in your farming business.',
        irsRef: 'Schedule F, Line 24',
      },
      'Repairs & Maintenance (Line 25)': {
        tooltip:
          'Costs to repair and maintain farm buildings, fences, machinery, and equipment. Improvements that add value or extend the life must be capitalized.',
        irsRef: 'Schedule F, Line 25',
      },
      'Seeds & Plants (Line 26)': {
        tooltip:
          'Cost of seeds and plants purchased for farming operations.',
        irsRef: 'Schedule F, Line 26',
      },
      'Storage & Warehousing (Line 27)': {
        tooltip:
          'Costs for storage and warehousing of crops, grain, and other farm products, including commercial storage facility fees.',
        irsRef: 'Schedule F, Line 27',
      },
      'Supplies (Line 28)': {
        tooltip:
          'Cost of supplies used in your farming business that were not included in other expense categories, such as tools, small items, and office supplies.',
        irsRef: 'Schedule F, Line 28',
      },
      'Taxes (Line 29)': {
        tooltip:
          'Real estate and personal property taxes on farm business assets. Do not include federal income tax, self-employment tax, or your personal property taxes.',
        irsRef: 'Schedule F, Line 29',
      },
      'Utilities (Line 30)': {
        tooltip:
          'Cost of utilities for farm operations, including electricity, telephone, water, and internet used for farm business.',
        irsRef: 'Schedule F, Line 30',
      },
      'Veterinary, Breeding, Medicine (Line 31)': {
        tooltip:
          'Costs for veterinary services, breeding fees, and medicine for farm livestock.',
        irsRef: 'Schedule F, Line 31',
      },
      'Other Expenses (Line 32)': {
        tooltip:
          'Any other deductible farm expenses not listed in Lines 10–31, such as advertising, postage, professional fees, or subscriptions.',
        irsRef: 'Schedule F, Line 32',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Schedule F overview',
        body: 'Schedule F reports farm income and expenses for sole proprietor farmers. Net farm profit is subject to both income tax and self-employment tax. You may also need Form 4562 for depreciation and Form 4797 for sales of farm assets.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-schedule-f-form-1040',
      },
      {
        type: 'tip',
        title: 'Cash vs. accrual method',
        body: 'Most farmers use the cash method — reporting income when received and expenses when paid. If you raise livestock or crops over multiple years, the accrual method may better match income with the costs of production.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  schedule1a: {
    fields: {
      'Qualified Tips': {
        tooltip:
          'Cash and credit card tips you received in an occupation where tipping is customary. Deductible up to $25,000 per year. Must be reported on your W-2 (Box 7) or Form 4137.',
        irsRef: 'Schedule 1-A, Tips Deduction',
      },
      'Qualified Overtime Premium Pay': {
        tooltip:
          'The premium portion of overtime pay — the extra amount above your regular hourly rate (e.g., the extra "half" in time-and-a-half). You must be an FLSA non-exempt employee.',
        irsRef: 'Schedule 1-A, Overtime Deduction',
      },
      'Car Loan Interest Paid': {
        tooltip:
          'Interest paid on a qualifying auto loan during the tax year. The vehicle must be new, assembled in the United States, and purchased after enactment of the OBBBA. Maximum deduction is $10,000.',
        irsRef: 'Schedule 1-A, Auto Loan Interest',
      },
      'Vehicle VIN': {
        tooltip:
          'The 17-character Vehicle Identification Number from the title or registration. Required to verify the vehicle was assembled in the United States.',
        irsRef: 'Schedule 1-A, VIN requirement',
      },
      'Unreported Tips': {
        tooltip:
          'Cash tips you received but did not report to your employer. These are subject to Social Security (6.2%) and Medicare (1.45%) taxes calculated on Form 4137.',
        irsRef: 'Form 4137, Line 1',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'No Tax on Tips & Overtime (OBBBA)',
        body: 'The One Big Beautiful Bill Act created new above-the-line deductions for qualified tips (up to $25,000), overtime premium pay, and auto loan interest on U.S.-assembled vehicles (up to $10,000). These deductions reduce your adjusted gross income.',
      },
      {
        type: 'warning',
        title: 'Tips must be reported on W-2 or Form 4137',
        body: 'To claim the tips deduction, the tips must already be included in your income — either reported by your employer on your W-2 (Box 7) or self-reported on Form 4137. You cannot deduct tips that were never included in income.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  investment_interest: {
    fields: {
      'Investment Interest Paid (Line 1)': {
        tooltip:
          'Interest paid on debt used to purchase or carry investment property, such as margin loan interest from your brokerage account. Does not include mortgage interest or business interest.',
        irsRef: 'Form 4952, Line 1',
      },
      'Prior Year Disallowed Amount (Line 2)': {
        tooltip:
          'Investment interest expense from prior years that was not deductible because it exceeded your net investment income. This amount carries forward from Line 8 of your prior year Form 4952.',
        irsRef: 'Form 4952, Line 2',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Investment interest expense deduction',
        body: 'Investment interest is deductible only up to the amount of your net investment income (interest, dividends, short-term capital gains). Any excess carries forward to future years. You can elect to treat long-term capital gains as investment income, but they will then be taxed at ordinary rates.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-4952',
      },
    ],
  },

  // -----------------------------------------------------------------------
  form8606: {
    fields: {
      'Current Year Nondeductible Contributions': {
        tooltip:
          'Traditional IRA contributions made for the current tax year that you cannot deduct (because you or your spouse are covered by an employer plan and your income exceeds the deduction limit).',
        irsRef: 'Form 8606, Line 1',
      },
      'Prior Year Basis (Line 2)': {
        tooltip:
          'Your total nondeductible IRA basis carried forward from prior years. This is the amount from Line 14 of your prior year Form 8606.',
        irsRef: 'Form 8606, Line 2',
      },
      'Amount Converted to Roth': {
        tooltip:
          'The total amount you converted from a traditional IRA to a Roth IRA during the tax year. A portion may be tax-free based on your nondeductible basis.',
        irsRef: 'Form 8606, Line 16',
      },
      'Year-End Traditional IRA Balance': {
        tooltip:
          'The total value of ALL your traditional, SEP, and SIMPLE IRA accounts as of December 31 of the tax year. This is required for the pro-rata calculation that determines how much of your conversion is taxable.',
        irsRef: 'Form 8606, Line 6',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'The pro-rata rule',
        body: 'When you convert a traditional IRA to a Roth, the IRS uses the pro-rata rule to determine the taxable portion. It considers ALL your traditional IRA balances (including SEP and SIMPLE IRAs) — not just the account you converted from. The taxable portion = (total pre-tax balance / total IRA balance) × conversion amount.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-8606',
      },
      {
        type: 'tip',
        title: 'Backdoor Roth strategy',
        body: 'If you contribute to a traditional IRA (nondeductible) and then convert to a Roth, this is a "backdoor Roth." Form 8606 tracks the basis to ensure you are not double-taxed. If you have existing pre-tax IRA balances, part of each conversion will be taxable.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  schedule_h: {
    fields: {
      'Total Cash Wages Paid': {
        tooltip:
          'Total cash wages paid to all household employees during the tax year. You owe employment taxes if you paid $2,800 or more to any single household employee in 2025.',
        irsRef: 'Schedule H, Line 1',
      },
      'Federal Tax Withheld': {
        tooltip:
          'Federal income tax you withheld from household employee wages, if you and the employee agreed to withholding. This is voluntary for household employees.',
        irsRef: 'Schedule H, Line 7',
      },
      'Number of Household Employees': {
        tooltip:
          'The number of household employees (nannies, housekeepers, gardeners, home health aides, etc.) you paid during the tax year.',
        irsRef: 'Schedule H, Line A',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Household employer tax threshold',
        body: 'You owe Social Security and Medicare taxes (employer share: 7.65%) if you paid any one household employee $2,800 or more in cash wages during 2025. You also owe FUTA tax if you paid total household wages of $1,000 or more in any calendar quarter.',
        irsUrl: 'https://www.irs.gov/publications/p926',
      },
      {
        type: 'warning',
        title: 'Household employees are not independent contractors',
        body: 'If you control what work is done and how it is done, the worker is your employee — even if they have other clients. Nannies, housekeepers, and home health aides are almost always employees, not contractors.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  form5329: {
    fields: {
      'IRA Excess Contribution': {
        tooltip:
          'The amount by which your IRA contributions exceeded the annual limit ($7,000 for 2025, or $8,000 if age 50+). A 6% excise tax applies each year the excess remains in the account.',
        irsRef: 'Form 5329, Part III, Line 17',
      },
      'HSA Excess Contribution': {
        tooltip:
          'The amount by which your HSA contributions exceeded the annual limit ($4,300 self-only, $8,550 family for 2025). A 6% excise tax applies each year the excess remains.',
        irsRef: 'Form 5329, Part VII, Line 43',
      },
      'Coverdell ESA Excess Contribution': {
        tooltip:
          'The amount by which your Coverdell ESA contributions exceeded the $2,000 annual limit per beneficiary. A 6% excise tax applies each year the excess remains in the account.',
        irsRef: 'Form 5329, Part II, Line 7',
      },
    },
    callouts: [
      {
        type: 'warning',
        title: '6% penalty on excess contributions',
        body: 'The IRS imposes a 6% excise tax on excess IRA, HSA, and Coverdell ESA contributions for each year the excess remains in the account. You can avoid the penalty by withdrawing the excess (plus any earnings) before the tax filing deadline.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-5329',
      },
    ],
  },

  // -----------------------------------------------------------------------
  qbi_detail: {
    fields: {
      'Business Name': {
        tooltip:
          'The name of the qualified trade or business, such as your LLC, sole proprietorship, or S-corp.',
        irsRef: 'Form 8995-A, Line 1',
      },
      'Qualified Business Income': {
        tooltip:
          'The net income from this business that qualifies for the Section 199A QBI deduction. Generally your Schedule C net profit, K-1 income, or rental income from the business.',
        irsRef: 'Form 8995-A, Line 2',
      },
      'W-2 Wages Paid': {
        tooltip:
          'Total W-2 wages paid by this business during the tax year. At higher income levels, the QBI deduction is limited to the greater of: (a) 50% of W-2 wages, or (b) 25% of W-2 wages plus 2.5% of UBIA.',
        irsRef: 'Form 8995-A, Line 3',
      },
      'UBIA of Qualified Property': {
        tooltip:
          'Unadjusted Basis Immediately After Acquisition — the original cost of tangible depreciable property held by the business and still within its MACRS recovery period or 10 years, whichever is longer.',
        irsRef: 'Form 8995-A, Line 4',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Section 199A QBI deduction',
        body: 'The QBI deduction allows eligible self-employed and small business owners to deduct up to 20% of qualified business income. For 2025, the deduction is limited for specified service trades/businesses (SSTB) when taxable income exceeds $197,300 (single) or $394,600 (MFJ).',
        irsUrl: 'https://www.irs.gov/newsroom/qualified-business-income-deduction',
      },
    ],
  },

  // -----------------------------------------------------------------------
  foreign_tax_credit: {
    fields: {
      'Foreign Tax Paid': {
        tooltip:
          'The total income tax paid or accrued to a foreign country or U.S. possession during the tax year for this income category. Include taxes shown on Form 1099-DIV Box 7 and Form 1099-INT Box 6.',
        irsRef: 'Form 1116, Part II',
      },
      'Foreign-Source Income': {
        tooltip:
          'Your gross income from sources outside the United States for this category. The credit is limited to the ratio of foreign-source income to total worldwide income, multiplied by your U.S. tax.',
        irsRef: 'Form 1116, Part I, Line 3a',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Foreign Tax Credit',
        body: 'The foreign tax credit prevents double taxation on income earned abroad. You can claim a credit for income taxes paid to a foreign country, limited to the U.S. tax on your foreign-source income. If your total foreign tax is $300 or less ($600 MFJ), you may be able to claim the credit directly on Form 1040 without filing Form 1116.',
        irsUrl: 'https://www.irs.gov/individuals/international-taxpayers/foreign-tax-credit',
      },
    ],
  },

  // -----------------------------------------------------------------------
  form8582_data: {
    fields: {
      'Prior-Year Unallowed Loss (Form 8582, Line 16)': {
        tooltip:
          'Passive activity losses from prior years that were not deductible because they exceeded your passive income. These suspended losses carry forward and can offset passive income in the current year or be fully deducted when you completely dispose of the activity.',
        irsRef: 'Form 8582, Line 1c/3c',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Passive activity loss rules',
        body: 'Under IRC §469, losses from passive activities (rentals, limited partnerships, businesses in which you do not materially participate) can only offset passive income. Excess losses are suspended and carry forward to future years. A special $25,000 allowance exists for active participation in rental real estate, phased out between $100,000 and $150,000 AGI.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-8582',
      },
      {
        type: 'tip',
        title: 'Real estate professional exception',
        body: 'If you qualify as a real estate professional (750+ hours and more than half your personal services in real property trades or businesses), your rental activities are not automatically treated as passive. This can allow you to deduct rental losses without limitation.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  form8582_review: {
    fields: {},
    callouts: [
      {
        type: 'info',
        title: 'Passive Loss Limitation Results',
        body: 'This page shows the computed results of Form 8582. It calculates how much of your passive losses are currently deductible and how much must be suspended and carried forward to future years.',
        irsUrl: 'https://www.irs.gov/forms-pubs/about-form-8582',
      },
      {
        type: 'tip',
        title: 'Disposing of a passive activity',
        body: 'When you completely dispose of a passive activity in a fully taxable transaction (e.g., selling a rental property), all accumulated suspended losses from that activity become deductible in the year of disposition.',
      },
    ],
  },

  // -----------------------------------------------------------------------
  refund_payment: {
    fields: {
      'Routing Number': {
        tooltip:
          'Your bank\'s 9-digit routing number, found at the bottom left of a check or on your bank\'s website. This identifies your financial institution for direct deposit or electronic payment.',
        irsRef: 'Form 1040, Line 35b',
      },
      'Account Number': {
        tooltip:
          'Your bank account number for direct deposit of your refund or electronic payment of tax owed. Double-check this number — an incorrect account number can delay your refund by weeks.',
        irsRef: 'Form 1040, Line 35c',
      },
      'Account Type': {
        tooltip:
          'Select whether this is a checking or savings account. This must match the account type at your bank for the routing and account numbers entered above.',
        irsRef: 'Form 1040, Line 35d',
      },
    },
    callouts: [
      {
        type: 'info',
        title: 'Direct deposit is the fastest refund method',
        body: 'The IRS processes direct deposit refunds in about 21 days for e-filed returns. Paper checks take 6-8 weeks. You can split your refund across up to three accounts using Form 8888.',
        irsUrl: 'https://www.irs.gov/refunds',
      },
      {
        type: 'warning',
        title: 'Double-check your bank details',
        body: 'An incorrect routing or account number can cause your refund to be deposited into the wrong account or returned to the IRS, resulting in significant delays. Verify these numbers with your bank before filing.',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// CONTEXTUAL_HELP — standalone help content for ContextualHelpLink components.
// These are longer-form explanations displayed in modals, not tied to specific
// form fields. Used for "What's my filing status?" and similar prominent links.
// ---------------------------------------------------------------------------

export interface ContextualHelp {
  label: string;
  title: string;
  explanation: string;
  irsUrl?: string;
}

export const CONTEXTUAL_HELP: Record<string, ContextualHelp> = {
  filing_status_helper: {
    label: "I'm not sure \u2014 help me decide",
    title: "Which filing status is right for you?",
    explanation:
      "Your filing status depends on your marital status and family situation on December 31, 2025.\n\n" +
      "\u2022 Single \u2014 You were unmarried, divorced, or legally separated on 12/31/2025.\n\n" +
      "\u2022 Married Filing Jointly \u2014 You were married on 12/31/2025 and want to file one return together. This usually results in the lowest tax.\n\n" +
      "\u2022 Married Filing Separately \u2014 You were married but want to file your own return. This may help if your spouse has tax debts or you want to keep finances separate, but it often results in higher tax.\n\n" +
      "\u2022 Head of Household \u2014 You were unmarried on 12/31/2025, you paid more than half the cost of keeping up your home, AND a qualifying dependent lived with you for more than half the year. This gives you a larger standard deduction and wider tax brackets than Single.\n\n" +
      "\u2022 Qualifying Surviving Spouse \u2014 Your spouse died in 2023 or 2024, you have a dependent child, and you haven\u2019t remarried. This lets you use the same rates as Married Filing Jointly for up to 2 years after your spouse\u2019s death.",
    irsUrl: "https://www.irs.gov/help/ita/what-is-my-filing-status",
  },

  dependent_qualifier: {
    label: "Who can I claim as a dependent?",
    title: "Who qualifies as a dependent?",
    explanation:
      "The IRS has two categories of dependents, each with different rules:\n\n" +
      "QUALIFYING CHILD (all must be true):\n" +
      "\u2022 Your son, daughter, stepchild, foster child, sibling, or a descendant of any of them\n" +
      "\u2022 Under age 19 at end of 2025 (or under 24 if a full-time student)\n" +
      "\u2022 Lived with you for more than half of 2025\n" +
      "\u2022 Did not provide more than half of their own support\n" +
      "\u2022 Does not file a joint return (unless only to claim a refund)\n\n" +
      "QUALIFYING RELATIVE (all must be true):\n" +
      "\u2022 Either lives with you all year OR is a close relative (parent, sibling, etc.)\n" +
      "\u2022 Gross income under $5,200 for 2025\n" +
      "\u2022 You provided more than half of their total support\n" +
      "\u2022 Not someone else\u2019s qualifying child\n\n" +
      "Dependents you claim may qualify you for the Child Tax Credit ($2,200 per qualifying child under 17), the Earned Income Tax Credit, and other tax benefits.",
    irsUrl: "https://www.irs.gov/publications/p501",
  },

  deduction_method_helper: {
    label: "Standard vs. itemized \u2014 which is better for me?",
    title: "Standard Deduction vs. Itemized Deductions",
    explanation:
      "Every filer gets to choose one: the standard deduction (a fixed dollar amount) or itemized deductions (the total of specific expenses you can document).\n\n" +
      "STANDARD DEDUCTION (2025 amounts):\n" +
      "\u2022 Single: $15,750\n" +
      "\u2022 Married Filing Jointly: $31,500\n" +
      "\u2022 Head of Household: $23,625\n" +
      "\u2022 65 or older / blind: additional $1,600 (single) or $1,300 (married) each\n\n" +
      "ITEMIZE if your total of these expenses exceeds the standard deduction:\n" +
      "\u2022 Mortgage interest on your primary home\n" +
      "\u2022 State and local taxes (SALT) \u2014 now capped at $40,000 for 2025 (up from $10,000)\n" +
      "\u2022 Charitable donations\n" +
      "\u2022 Medical expenses exceeding 7.5% of your income\n\n" +
      "RULE OF THUMB: About 87% of filers take the standard deduction. You\u2019re more likely to benefit from itemizing if you have a large mortgage, live in a high-tax state, or make significant charitable contributions.",
    irsUrl: "https://www.irs.gov/taxtopics/tc501",
  },
};
