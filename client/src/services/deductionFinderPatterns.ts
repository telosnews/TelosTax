/**
 * Deduction Finder — Pattern Catalog
 *
 * Each pattern defines a set of merchant substrings to match against bank
 * statement descriptions, plus context gates that suppress irrelevant signals.
 *
 * IMPORTANT: All merchant strings are matched as UPPERCASE substrings against
 * the uppercased transaction description. They should reflect how merchants
 * actually appear on bank/credit card statements, not just brand names.
 *
 * This is pure data — no side effects, no external deps beyond local types.
 */

import type { MerchantPattern } from './deductionFinderTypes';

export const DEDUCTION_PATTERNS: MerchantPattern[] = [
  // ── 1. Student Loans ──────────────────────────────
  {
    id: 'student_loan',
    category: 'student_loan',
    recurrenceRelevant: true,
    merchants: [
      // Federal servicers
      'NAVIENT', 'NELNET', 'MOHELA', 'FEDLOAN', 'AIDVANTAGE',
      'GREAT LAKES', 'EDFINANCIAL', 'PHEAA', 'TIVAS',
      'CORNERSTONE SL',
      // Treasury / government descriptors
      'TREAS 310', 'DEPT OF ED', 'DEPT EDUCATION', 'US DEPT OF ED',
      'DOE TREAS', 'STUDENT AID', 'STUDENTAID', 'FED STUDENT AID',
      // Private lenders
      'SALLIE MAE', 'SOFI STUDENT', 'SOFI SL', 'EARNEST STUDENT',
      'COMMONBOND', 'COLLEGE AVE', 'FIRSTMARK', 'CITIZENS STUDENT',
      'DISCOVER STUDENT', 'LAUREL ROAD', 'BRAZOS STUDENT',
      'IOWA STUDENT', 'RISLA', 'MEFA', 'NJCLASS',
      // University / ECSI billing
      'HEARTLAND ECSI', 'ECSI PAYMENT', 'CAMPUS PARTNERS',
      'UNIV ACCT', 'BURSAR',
      // Generic descriptors
      'STUDENT LOAN', 'STU LOAN', 'STDNT LOAN', 'EDUCATION LOAN',
    ],
    confidence: 'high',
    gate: { requireFalse: ['hasStudentLoanInterest'] },
    title: 'Student Loan Interest Deduction',
    description:
      'Payments to student loan servicers may include deductible interest. ' +
      'The student loan interest deduction is an above-the-line adjustment ' +
      'available even if you take the standard deduction (IRC §221).',
    statutoryMax: 'up to $2,500',
    actionStepId: 'student_loan_ded',
    impactScore: 0.7,
    easeScore: 0.9,
  },

  // ── 2. Childcare / Dependent Care ─────────────────
  {
    id: 'childcare',
    category: 'childcare',
    recurrenceRelevant: true,
    mccCodes: ['8351', '7299', '8211'],
    merchants: [
      // National chains
      'KINDERCARE', 'BRIGHT HORIZONS', 'GODDARD SCHOOL', 'GODDARD',
      'PRIMROSE SCHOOL', 'PRIMROSE', 'KIDDIE ACADEMY', 'CHILDTIME',
      'LEARNING TREE', 'LA PETITE', 'TUTOR TIME',
      "CHILDREN'S COURTYARD", 'CHILDRENS COURTYARD',
      'LITTLE SPROUTS', 'KIDZ WORLD',
      // Cadence Education brands
      'CADENCE EDUCATION', 'CHILDCARE NETWORK', 'CREATIVE WORLD',
      'SUNRISE PRESCHOOL',
      // Montessori / educational
      'MONTESSORI', 'HEAD START',
      // Community / nonprofit
      'YMCA CHILD', 'YWCA CHILD', 'YMCA DAYCARE', 'YMCA CAMP',
      'BOYS AND GIRLS CLUB', 'BOYS & GIRLS CLUB',
      'JCC CHILD', 'JCC DAYCARE', 'JCC CAMP',
      // Au pair / nanny services
      'AU PAIR', 'AUPAIR', 'CARE.COM', 'SITTERCITY', 'URBANSITTER',
      // Camp (summer/day)
      'DAY CAMP', 'SUMMER CAMP', 'CAMP REGISTRATION',
      // After-school programs
      'AFTER SCHOOL', 'AFTERSCHOOL', 'EXTENDED DAY',
      'BEFORE & AFTER', 'BEFORE AND AFTER',
      // Regional chains
      'LIGHTBRIDGE ACADEMY', 'CELEBREE', 'KIDSTRONG',
      'LITTLE SUNSHINE', 'COUNTRY HOME LEARNING', 'CHESTERBROOK',
      'GODDARD SCH', 'KIDS R KIDS', 'KIDS ARE KIDS',
      'CHILDRENS LEARNING', "CHILDREN'S LEARNING",
      'DISCOVERY POINT', 'SPRING EDUCATION',
      // Payment platforms
      'BRIGHTWHEEL', 'PROCARE', 'TUITION EXPRESS', 'KANGAROO TIME',
      // Generic descriptors
      'DAYCARE', 'DAY CARE', 'CHILD CARE', 'CHILDCARE',
      'PRESCHOOL', 'PRE-SCHOOL', 'NURSERY SCHOOL',
      'EARLY LEARNING', 'EARLY CHILDHOOD',
    ],
    confidence: 'high',
    gate: { requirePositive: ['minorDependentCount'] },
    title: 'Child & Dependent Care Credit',
    description:
      'Payments to childcare providers may qualify for the Child and Dependent ' +
      'Care Credit (IRC §21). This is a nonrefundable credit worth 20-35% of ' +
      'qualifying expenses.',
    statutoryMax: 'up to $3,000 (1 child) or $6,000 (2+)',
    actionStepId: 'dependent_care',
    impactScore: 0.8,
    easeScore: 0.8,
  },

  // ── 3. Charitable Donations ───────────────────────
  {
    id: 'charitable',
    category: 'charitable',
    recurrenceRelevant: true,
    mccCodes: ['8398', '8641', '8661'],
    merchants: [
      // Major national charities
      'GOODWILL', 'SALVATION ARMY', 'RED CROSS', 'AMERICAN RED CROSS',
      'UNITED WAY', 'HABITAT FOR HUMANITY', 'HABITAT HUMANITY',
      'FEEDING AMERICA', 'FOOD BANK', 'FOODBANK',
      'ST JUDE', 'SAINT JUDE', 'ALSAC',
      'AMERICAN CANCER', 'CANCER SOCIETY',
      'WORLD WILDLIFE', 'WORLD WILDLIFE FUND', 'UNICEF',
      'DOCTORS WITHOUT', 'DOCTORS WITHOUT BORDERS',
      'PLANNED PARENTHOOD',
      'ACLU', 'ACLU FOUNDATION',
      'SIERRA CLUB', 'NATURE CONSERVANCY',
      'ASPCA', 'HUMANE SOCIETY',
      'WOUNDED WARRIOR', 'SHRINERS',
      // Religious organizations (specific terms only — no CHURCH/TEMPLE due to false positives)
      'TITHE', 'TITHELY', 'PUSHPAY', 'SUBSPLASH',
      'PARISH', 'DIOCESE', 'ARCHDIOCESE',
      'MINISTRY', 'MINISTRIES', 'OFFERING',
      // Media / education nonprofits
      'NPR', 'PUBLIC RADIO', 'PBS', 'PUBLIC BROADCASTING',
      'WIKIMEDIA', 'WIKIPEDIA', 'KHAN ACADEMY',
      'INTERNET ARCHIVE',
      // Disaster / humanitarian
      'DIRECT RELIEF', 'CARE.ORG', 'OXFAM', 'MERCY CORPS',
      'WORLD VISION', 'COMPASSION INTL', 'COMPASSION INTERNATIONAL',
      'HEIFER', 'KIVA',
      // Health-related charities
      'MARCH OF DIMES', 'MAKE A WISH', 'MAKE-A-WISH',
      'SPECIAL OLYMPICS', 'LEUKEMIA', 'LYMPHOMA',
      'ALZHEIMER', 'HEART ASSOCIATION', 'LUNG ASSOCIATION',
      'DIABETES ASSOC', 'SUSAN G KOMEN', 'KOMEN',
      // Veterans / military
      'DAV', 'DISABLED AMERICAN VET', 'USO', 'FISHER HOUSE',
      // Environmental
      'GREENPEACE', 'EARTHJUSTICE', 'NRDC',
      'ENVIRONMENTAL DEFENSE', 'RAINFOREST',
      'OCEAN CONSERVANCY', 'AUDUBON',
      // Civil rights / social
      'NAACP', 'SOUTHERN POVERTY', 'SPLC',
      'ELECTRONIC FRONTIER', 'AMNESTY',
      // Donation platforms (501(c)(3) only)
      'ACTBLUE CHARITIES', 'DONORBOX', 'CLASSY.ORG',
      'NETWORK FOR GOOD', 'EVERY ACTION', 'EVERYACTION',
      'BENEVITY', 'BRIGHT FUNDS', 'GIVEBUTTER',
      // Generic descriptors
      'CHARITY', 'CHARITABLE', 'DONATION', 'DONATE',
      'NONPROFIT', 'NON-PROFIT', '501C3', '501(C)(3)',
      'TAX DEDUCTIBLE',
    ],
    confidence: 'high',
    matchMode: 'word_boundary',
    // Suppress political contributions and personal fundraising
    negativeTokens: ['WINRED', 'GOFUNDME', 'POLITICAL', 'PAC'],
    gate: { existingDataKeys: ['hasCharitableDeductions'] },
    title: 'Charitable Contribution Deduction',
    description:
      'Cash donations to qualified 501(c)(3) organizations are deductible if ' +
      'you itemize (IRC §170). Even with standard deduction, keep records — ' +
      'your total may push you past the itemization threshold.',
    statutoryMax: 'up to 60% of AGI (cash)',
    actionStepId: 'itemized_deductions',
    impactScore: 0.6,
    easeScore: 0.7,
  },

  // ── 4. Mortgage Payments ──────────────────────────
  {
    id: 'mortgage',
    category: 'mortgage',
    recurrenceRelevant: true,
    merchants: [
      // Top servicers
      'MR COOPER', 'ROCKET MORTGAGE', 'ROCKET MORT', 'PENNYMAC',
      'QUICKEN LOANS', 'LOANCARE', 'NEWREZ', 'NEW REZ',
      'FREEDOM MORTGAGE', 'FREEDOM MORT',
      'CALIBER HOME', 'NATIONSTAR', 'PHH MORTGAGE', 'PHH MORT',
      'SHELLPOINT', 'SHELLPOINT MORT',
      // Bank mortgage divisions (use specific suffixes to avoid CC matches)
      'WELLS FARGO MORT', 'WELLS FARGO HOME', 'WF HOME MORTGAGE',
      'CHASE MORTGAGE', 'CHASE HOME', 'JPMORGAN MORT',
      'BANK OF AMERICA MORT', 'BOA MORTGAGE', 'BOA HOME',
      'CITI MORTGAGE', 'CITIMORTGAGE',
      'US BANK HOME', 'USB HOME MORT',
      'PNC MORTGAGE', 'PNC HOME',
      'TRUIST MORT', 'SUNTRUST MORT', 'BB&T MORT',
      'TD BANK MORT', 'FIFTH THIRD MORT',
      'REGIONS MORT', 'KEYBANK MORT', 'M&T MORT',
      'HUNTINGTON MORT',
      // Credit union / military
      'USAA MORTGAGE', 'USAA MORT', 'NAVY FEDERAL MORT',
      'NAVY FED MORT', 'PENTAGON FCU MORT', 'PENFED MORT',
      // Specialty / sub-servicers
      'CENLAR', 'DOVENMUEHLE', 'DOVENMUHLE',
      'SPECIALIZED LOAN', 'SLS MORTGAGE',
      'HOMEPOINT', 'HOME POINT',
      'GUILD MORTGAGE', 'GUILD MORT',
      'ROUNDPOINT', 'ROUND POINT',
      'FLAGSTAR MORT', 'FLAGSTAR BANK MORT',
      'DITECH', 'BAYVIEW LOAN', 'CARRINGTON MORT',
      'PLANET HOME', 'PLANET MORT',
      'AMERIHOME', 'AMERI HOME',
      'LAKEVIEW LOAN', 'LAKEVIEW MORT',
      'MATRIX FINANCIAL',
      'MIDLAND MORTGAGE', 'MIDLAND MORT',
      'OCWEN', 'BSI FINANCIAL',
      'FAIRWAY IND', 'MOVEMENT MORT',
      'UWM', 'UNITED WHOLESALE',
      // Generic descriptors
      'MORTGAGE', 'MORT PMT', 'MORT PYMT', 'HOME LOAN',
      'ESCROW PMT', 'ESCROW PAYMENT', 'ESCROW DISB', 'MTGE PMT',
    ],
    confidence: 'medium',
    gate: { requireFalse: ['hasMortgageInterest'] },
    title: 'Mortgage Interest Deduction',
    description:
      'Mortgage payments typically include deductible interest. The mortgage ' +
      'interest deduction (IRC §163(h)) can be one of the largest itemized ' +
      'deductions and may make itemizing more beneficial than the standard deduction.',
    statutoryMax: 'interest on up to $750,000 of debt',
    actionStepId: 'itemized_deductions',
    impactScore: 0.9,
    easeScore: 0.6,
  },

  // ── 5. HSA Contributions ──────────────────────────
  {
    id: 'hsa',
    category: 'hsa',
    recurrenceRelevant: true,
    merchants: [
      // Dedicated HSA custodians
      'HSA BANK', 'OPTUM BANK', 'OPTUM HSA', 'OPTUM FINANCIAL',
      'HEALTHEQUITY', 'HEALTH EQUITY',
      'FIDELITY HSA', 'FIDELITY HEALTH',
      'LIVELY HSA', 'LIVELY INC',
      'FURTHER HSA', 'FURTHER INC',
      'DEVENIR HSA',
      'BENEFIT WALLET', 'BENEFITWALLET',
      'WAGEWORKS HSA', 'WAGEWORKS',
      // Additional custodians
      'CONNECTYOURCARE', 'CONNECT YOUR CARE',
      'PAYFLEX', 'NAVIA BENEFIT', 'NAVIA HSA',
      'DATAPATH HSA', 'DATAPATH INC',
      'ALEGEUS', 'WEX HEALTH', 'WEX HSA',
      'HEALTHSAVINGS', 'HEALTH SAVINGS',
      'UMB HSA', 'UMB BANK HSA',
      'BEND HSA', 'BEND FINANCIAL',
      'SATURNA HSA',
      // Generic descriptors
      'HSA CONTRIBUTION', 'HSA CONTRIB', 'HSA DEPOSIT',
      'HSA FUNDING', 'HSA TRANSFER', 'HSA PMT',
    ],
    confidence: 'high',
    gate: { requireFalse: ['hasHSA'] },
    title: 'HSA Deduction',
    description:
      'Contributions to a Health Savings Account are deductible above the line ' +
      '(IRC §223). HSA funds grow tax-free and withdrawals for medical expenses ' +
      'are also tax-free — a triple tax advantage.',
    statutoryMax: 'up to $4,300 (self) / $8,550 (family) for 2025',
    actionStepId: 'hsa_contributions',
    impactScore: 0.8,
    easeScore: 0.9,
  },

  // ── 6. Medical / Pharmacy ─────────────────────────
  {
    id: 'medical',
    category: 'medical',
    mccCodes: [
      '4119', '5047', '5122', '5912', '5975', '5976',
      '8011', '8021', '8031', '8041', '8042', '8043',
      '8049', '8050', '8062', '8071', '8099',
    ],
    merchants: [
      // National pharmacy chains
      'CVS', 'WALGREENS', 'RITE AID', 'DUANE READE',
      'WALMART PHARM', 'WAL-MART PHARM', 'WM PHARMACY',
      'TARGET PHARM', 'COSTCO PHARM', 'SAMS PHARM', 'SAMS CLUB PHARM',
      'KROGER PHARM', 'PUBLIX PHARM', 'HEB PHARM', 'HEB PHARMACY',
      'SAFEWAY PHARM', 'ALBERTSONS PHARM',
      // Regional pharmacy chains
      'WINN DIXIE PHARM', 'MEIJER PHARM', 'MEIJER PHARMACY',
      'GIANT PHARM', 'WEGMANS PHARM',
      'STOP & SHOP PHARM', 'FRED MEYER PHARM',
      'HARRIS TEETER PHARM', 'KINNEY DRUG', 'BARTELL DRUG',
      // Mail-order / specialty pharmacy
      'EXPRESS SCRIPTS', 'EXPRESSSCRIPTS', 'CAREMARK',
      'OPTUMRX', 'OPTUM RX', 'PILLPACK', 'AMAZON PHARM',
      'CAPSULE PHARM', 'ALTO PHARMACY',
      'COSTPLUSDRUGS', 'COST PLUS DRUG',
      // Labs / diagnostics
      'LABCORP', 'QUEST DIAG', 'QUEST DIAGNOSTICS',
      'BIOREFERENCE', 'SONIC HEALTHCARE',
      // Urgent care / clinics
      'MINUTECLINIC', 'MINUTE CLINIC', 'PATIENT FIRST',
      'CONCENTRA', 'MEDEXPRESS', 'MED EXPRESS',
      'CITYMD', 'CARBON HEALTH', 'ONE MEDICAL',
      // Dental chains
      'ASPEN DENTAL', 'HEARTLAND DENTAL', 'PACIFIC DENTAL',
      'WESTERN DENTAL', 'GENTLE DENTAL', 'COMFORT DENTAL',
      // Vision chains
      'LENSCRAFTERS', 'PEARLE VISION', 'AMERICAS BEST',
      'VISIONWORKS', 'WARBY PARKER', '1-800 CONTACTS',
      '1800CONTACTS',
      // Hospital systems (common statement descriptors)
      'HCA HEALTH', 'ASCENSION', 'COMMONSPIRIT',
      'PROVIDENCE HEALTH', 'KAISER PERM',
      'CLEVELAND CLINIC', 'MAYO CLINIC',
      // Generic descriptors
      'PHARMACY', 'CHIROPRACTIC',
    ],
    confidence: 'medium',
    evidenceTokens: [
      'RX', 'PHARM', 'PHARMACY', 'PRESCRIPTION',
      'MEDICAL', 'HEALTH', 'CLINIC', 'HOSPITAL',
      'DENTAL', 'VISION', 'OPTOM', 'OPHTHAL',
      'COPAY', 'CO-PAY', 'PATIENT', 'DOCTOR', 'DR',
      'LABCORP', 'QUEST', 'DIAGNOSTIC',
      'URGENT CARE', 'DDS', 'MD', 'LAB',
    ],
    negativeTokens: ['BEAUTY', 'COSMETIC', 'FRAGRANCE', 'PHOTO'],
    gate: { requireItemizing: true, existingDataKeys: ['hasMedicalExpenses'] },
    title: 'Medical Expense Deduction',
    description:
      'Medical, dental, and vision costs are deductible if you itemize and ' +
      'your total medical expenses exceed 7.5% of AGI (IRC §213). This includes ' +
      'prescriptions, lab work, copays, and insurance premiums you pay out of pocket.',
    statutoryMax: 'expenses exceeding 7.5% of AGI',
    actionStepId: 'itemized_deductions',
    impactScore: 0.5,
    easeScore: 0.4,
  },

  // ── 7. Home Office Supplies ───────────────────────
  {
    id: 'home_office_supplies',
    category: 'home_office_supplies',
    mccCodes: ['5111', '5943', '5045'],
    merchants: [
      // Office supply retailers
      'STAPLES', 'OFFICE DEPOT', 'OFFICE MAX', 'OFFICEMAX',
      'QUILL.COM', 'QUILL CORP',
      'W.B. MASON', 'WB MASON',
      'ULINE', 'GLOBAL INDUSTRIAL',
      // Printing / shipping (business use)
      'FEDEX OFFICE', 'FEDEX KINKOS', 'KINKOS',
      'UPS STORE', 'THE UPS STORE',
      // Furniture (office-specific)
      'HERMAN MILLER', 'STEELCASE', 'AUTONOMOUS',
      'BRANCH FURNITURE', 'FULLY.COM', 'UPLIFT DESK',
      // Generic descriptors
      'OFFICE SUPPLY', 'OFFICE SUPPLIES',
    ],
    confidence: 'medium',
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Business Office Supply Expenses',
    description:
      'Office supply purchases may be deductible as business expenses if you ' +
      'have a qualifying home office (IRC §280A). These are separate from the ' +
      'home office deduction itself.',
    statutoryMax: 'actual cost (no cap)',
    actionStepId: 'expense_categories',
    impactScore: 0.4,
    easeScore: 0.7,
  },

  // ── 8. Self-Employed Health Insurance ─────────────
  {
    id: 'se_health_insurance',
    category: 'se_health_insurance',
    recurrenceRelevant: true,
    mccCodes: ['5960', '6300', '6381'],
    merchants: [
      // Major insurers
      'BLUE CROSS', 'BLUECROSS', 'BCBS', 'BLUE SHIELD', 'BLUESHIELD',
      'AETNA', 'CIGNA', 'EVERNORTH',
      'UNITEDHEALTH', 'UNITED HEALTH', 'UHC',
      'HUMANA', 'KAISER', 'KAISER PERMANENTE',
      'ANTHEM', 'ELEVANCE',
      'MOLINA', 'CENTENE', 'WELLCARE',
      'OSCAR HEALTH', 'AMBETTER', 'HEALTHMARKETS',
      // Regional insurers
      'HIGHMARK', 'CAREFIRST', 'INDEPENDENCE BLUE',
      'HORIZON BCBS', 'PREMERA', 'REGENCE',
      'EMBLEM HEALTH', 'EMBLEMHEALTH',
      'HEALTH NET', 'HEALTHNET', 'MEDICA',
      'PRIORITY HEALTH', 'SELECTHEALTH', 'GEISINGER',
      'TUFTS HEALTH', 'HARVARD PILGRIM', 'POINT32',
      'FLORIDA BLUE', 'EXCELLUS', 'CAPITAL BLUE',
      'TRIPLE-S', 'GUIDEWELL',
      // ACA marketplace
      'HEALTHCARE.GOV', 'HEALTHCARE GOV',
      'COVERED CA', 'COVERED CALIFORNIA',
      'NY STATE OF HEALTH', 'NYSOH',
      'ACCESS HEALTH', 'CONNECT FOR HEALTH',
      'PENNIE', 'MARYLAND HEALTH',
      'HEALTH CONNECTOR', 'MNSURE', 'WAHEALTHPLAN',
      'GET COVERED NJ', 'GETCOVEREDNJ',
      // Freelancer health brokers
      'STRIDE HEALTH',
      // Health sharing ministries
      'MEDISHARE', 'MEDI-SHARE', 'LIBERTY HEALTHSHARE',
      'CHRISTIAN HEALTHCARE', 'SAMARITAN MINISTRIES',
      // Generic descriptors
      'HEALTH INSURANCE', 'HEALTH INS', 'MEDICAL INSURANCE',
      'HEALTH PREMIUM', 'INSURANCE PREMIUM',
      'HLTH PREM', 'MED PREM',
    ],
    confidence: 'medium',
    gate: { requireTrue: ['hasScheduleC'], requireFalse: ['hasSEHealthInsurance'] },
    title: 'Self-Employed Health Insurance Deduction',
    description:
      'Self-employed individuals can deduct 100% of health insurance premiums ' +
      'as an above-the-line adjustment (IRC §162(l)). This is one of the most ' +
      'valuable SE deductions and is available even with the standard deduction.',
    statutoryMax: 'up to net SE income',
    actionStepId: 'se_health_insurance',
    impactScore: 0.9,
    easeScore: 0.8,
  },

  // ══════════════════════════════════════════════════
  // NEW CATEGORIES
  // ══════════════════════════════════════════════════

  // ── 9. Educator Expenses ──────────────────────────
  {
    id: 'educator_expenses',
    category: 'educator_expenses',
    mccCodes: ['5943', '8211'],
    merchants: [
      // Teacher supply stores
      'LAKESHORE LEARNING', 'LAKESHORE LEARN',
      'SCHOOL SPECIALTY', 'SCHOLASTIC',
      'TEACHERS PAY TEACHERS', 'TEACHERSPAYTEACHERS',
      'REALLY GOOD STUFF', 'NASCO EDUCATION',
      'DISCOUNT SCHOOL SUPPLY', 'KAPLAN EARLY',
      // General retailers (with education evidence tokens)
      'MICHAELS', 'JOANN', 'JO-ANN',
      // Book retailers
      'BARNES & NOBLE', 'BARNES AND NOBLE', 'HALF PRICE BOOKS',
      // Generic descriptors
      'CLASSROOM SUPPLY', 'TEACHER SUPPLY', 'SCHOOL SUPPLY',
      'EDUCATIONAL SUPPLY',
    ],
    confidence: 'low',
    evidenceTokens: [
      'TEACHER', 'CLASSROOM', 'SCHOOL', 'EDUCATION', 'LEARNING',
      'SCHOLASTIC', 'CURRICULUM',
    ],
    gate: {},
    title: 'Educator Expense Deduction',
    description:
      'K-12 teachers, instructors, counselors, and principals can deduct up to ' +
      '$300 of unreimbursed classroom expenses as an above-the-line deduction ' +
      '(IRC §62(a)(2)(D)). This is available even with the standard deduction.',
    statutoryMax: 'up to $300 ($600 if both spouses are educators)',
    actionStepId: 'educator_expenses_ded',
    impactScore: 0.3,
    easeScore: 0.9,
  },

  // ── 10. Retirement Contributions (IRA) ────────────
  {
    id: 'retirement_contributions',
    category: 'retirement_contributions',
    recurrenceRelevant: true,
    matchMode: 'word_boundary',
    merchants: [
      // Major brokerages / custodians
      'VANGUARD', 'FIDELITY', 'CHARLES SCHWAB', 'SCHWAB',
      'TD AMERITRADE', 'TDAMERITRADE',
      'E*TRADE', 'ETRADE', 'MERRILL LYNCH', 'MERRILL EDGE',
      'EDWARD JONES', 'RAYMOND JAMES',
      'TIAA', 'TIAA-CREF',
      'T ROWE PRICE', 'T. ROWE PRICE',
      'AMERICAN FUNDS', 'CAPITAL GROUP',
      'PRINCIPAL FINANCIAL', 'PRINCIPAL LIFE',
      'EMPOWER RETIREMENT', 'EMPOWER',
      'TRANSAMERICA', 'NATIONWIDE RETIRE',
      'JOHN HANCOCK', 'LINCOLN FINANCIAL',
      'MASS MUTUAL', 'MASSMUTUAL',
      'PRUDENTIAL', 'METLIFE',
      // Robo-advisors
      'BETTERMENT', 'WEALTHFRONT', 'ACORNS',
      'ELLEVEST', 'SOFI INVEST', 'SOFI WEALTH',
      'M1 FINANCE', 'STASH INVEST',
      // Self-employed retirement
      'SEP IRA', 'SIMPLE IRA', 'SOLO 401',
      // Generic descriptors
      'IRA CONTRIB', 'IRA CONTRIBUTION', 'IRA DEPOSIT',
      'ROTH IRA', 'TRAD IRA', 'TRADITIONAL IRA',
      'RETIREMENT CONTRIB', 'RETIREMENT CONTRIBUTION',
      '401K CONTRIB', '401(K)',
    ],
    confidence: 'low',
    evidenceTokens: [
      'IRA', 'RETIRE', 'RETIREMENT', 'CONTRIB', 'CONTRIBUTION',
      '401K', '401(K)', 'SEP', 'ROTH', 'TRADITIONAL',
    ],
    gate: {},
    title: 'IRA Contribution Deduction',
    description:
      'Traditional IRA contributions may be deductible above the line (IRC §219). ' +
      'Self-employed individuals may also deduct SEP-IRA or SIMPLE IRA contributions. ' +
      'Even if not deductible, Roth IRA contributions provide tax-free growth.',
    statutoryMax: 'up to $7,000 ($8,000 if 50+) for 2025',
    actionStepId: 'ira_contribution_ded',
    impactScore: 0.7,
    easeScore: 0.8,
  },

  // ── 11. Tax Preparation Fees ──────────────────────
  {
    id: 'tax_prep',
    category: 'tax_prep',
    matchMode: 'word_boundary',
    mccCodes: ['7276'],
    merchants: [
      // Tax prep chains
      'H&R BLOCK', 'H & R BLOCK', 'HRB DIGITAL', 'HRB TAX',
      'JACKSON HEWITT', 'LIBERTY TAX',
      // Software
      'TURBOTAX', 'TURBO TAX', 'INTUIT TURBO',
      'TAXACT', 'TAX ACT',
      'TAXSLAYER', 'TAX SLAYER',
      'FREETAXUSA', 'FREE TAX USA',
      // Generic descriptors
      'TAX PREP', 'TAX PREPARATION',
      'TAX SERVICE', 'TAX ADVISOR', 'TAX CONSULT',
    ],
    confidence: 'medium',
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Tax Preparation Expense (Business Portion)',
    description:
      'Self-employed individuals can deduct the business portion of tax preparation ' +
      'fees on Schedule C. The cost of preparing Schedule C, SE, and related forms ' +
      'is a deductible business expense.',
    statutoryMax: 'business portion of actual cost',
    actionStepId: 'expense_categories',
    impactScore: 0.3,
    easeScore: 0.9,
  },

  // ── 12. Business Software & Subscriptions ─────────
  {
    id: 'business_software',
    category: 'business_software',
    recurrenceRelevant: true,
    mccCodes: ['5734', '7372'],
    merchants: [
      // Accounting / invoicing
      'QUICKBOOKS', 'INTUIT QB', 'FRESHBOOKS', 'XERO',
      'WAVE FINANCIAL', 'WAVE APPS', 'ZOHO INVOICE',
      'HONEYBOOK', 'DUBSADO',
      // Design / creative
      'ADOBE', 'CANVA', 'FIGMA',
      // Productivity / communication
      'SLACK', 'ZOOM.US', 'ZOOM VIDEO', 'ZOOM PMT',
      'DROPBOX', 'GOOGLE WORKSPACE', 'GOOGLE GSUITE',
      'MICROSOFT 365', 'MICROSOFT OFFICE', 'MSFT',
      // Website / hosting
      'SQUARESPACE', 'WIX.COM', 'SHOPIFY', 'GODADDY',
      'NAMECHEAP', 'BLUEHOST', 'SITEGROUND',
      'WORDPRESS', 'WEBFLOW',
      // Marketing / email
      'MAILCHIMP', 'CONSTANT CONTACT', 'CONVERTKIT',
      'HUBSPOT', 'HOOTSUITE', 'BUFFER',
      'SEMRUSH', 'AHREFS',
      // Project management
      'ASANA', 'TRELLO', 'MONDAY.COM', 'NOTION',
      'CLICKUP', 'BASECAMP',
      // CRM
      'SALESFORCE', 'PIPEDRIVE',
      // Cloud / dev tools
      'AMAZON WEB SERV', 'GOOGLE CLOUD',
      'DIGITALOCEAN', 'HEROKU', 'GITHUB', 'GITLAB',
      'NETLIFY', 'VERCEL',
    ],
    confidence: 'low',
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Business Software & Subscription Expenses',
    description:
      'Software subscriptions used for business are deductible on Schedule C ' +
      '(IRC §162). This includes accounting software, design tools, cloud hosting, ' +
      'and communication platforms used in your trade or business.',
    statutoryMax: 'actual cost (no cap)',
    actionStepId: 'expense_categories',
    impactScore: 0.5,
    easeScore: 0.8,
  },

  // ── 13. Business Travel ───────────────────────────
  {
    id: 'business_travel',
    category: 'business_travel',
    mccCodes: ['3000', '3501', '4111', '4121', '4511', '7011', '7512', '7523'],
    merchants: [
      // Airlines
      'AMERICAN AIR', 'DELTA AIR', 'UNITED AIR', 'SOUTHWEST AIR',
      'JETBLUE', 'SPIRIT AIR', 'FRONTIER AIR', 'ALASKA AIR',
      'HAWAIIAN AIR', 'ALLEGIANT',
      // Booking platforms
      'EXPEDIA', 'BOOKING.COM', 'PRICELINE', 'KAYAK',
      'HOPPER', 'GOOGLE FLIGHTS',
      // Hotels
      'MARRIOTT', 'HILTON', 'HYATT', 'IHG', 'WYNDHAM',
      'BEST WESTERN', 'CHOICE HOTELS',
      'AIRBNB', 'VRBO',
      // Rental cars
      'HERTZ', 'ENTERPRISE RENT', 'NATIONAL CAR', 'AVIS', 'BUDGET RENT',
      'DOLLAR RENT', 'THRIFTY', 'SIXT', 'TURO',
      // Rideshare
      'UBER', 'LYFT',
      // Parking
      'PARKWHIZ', 'SPOTHERO', 'PARKMOBILE',
    ],
    confidence: 'low',
    // No evidence tokens — Schedule C gate is sufficient.
    // Hotel/rideshare bank descriptors (MARRIOTT, UBER) rarely contain
    // generic travel terms, so evidence tokens would suppress valid matches.
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Business Travel Expenses',
    description:
      'Travel expenses for business purposes are deductible on Schedule C ' +
      '(IRC §162). This includes airfare, hotels, rental cars, and local ' +
      'transportation while traveling away from your tax home.',
    statutoryMax: 'actual cost (no cap, must be ordinary & necessary)',
    actionStepId: 'expense_categories',
    impactScore: 0.6,
    easeScore: 0.5,
  },

  // ── 14. Business Telecom / Internet ───────────────
  {
    id: 'business_telecom',
    category: 'business_telecom',
    recurrenceRelevant: true,
    mccCodes: ['4812', '4814', '4816'],
    merchants: [
      // Mobile carriers
      'VERIZON', 'AT&T', 'ATT', 'T-MOBILE', 'TMOBILE',
      'SPRINT', 'MINT MOBILE', 'GOOGLE FI', 'VISIBLE',
      'US CELLULAR', 'CRICKET',
      // Internet providers
      'COMCAST', 'XFINITY', 'SPECTRUM', 'COX COMM',
      'CENTURYLINK', 'LUMEN', 'FRONTIER COMM',
      'OPTIMUM', 'ALTICE', 'WINDSTREAM',
      'GOOGLE FIBER', 'ATT INTERNET', 'VERIZON FIOS',
      'STARLINK',
    ],
    confidence: 'low',
    gate: { requireTrue: ['hasScheduleC', 'hasHomeOffice'] },
    title: 'Business Phone & Internet Deduction',
    description:
      'The business-use percentage of your phone and internet bills is deductible ' +
      'on Schedule C (IRC §162). You must calculate the business-use percentage ' +
      'and deduct only that portion.',
    statutoryMax: 'business-use percentage of actual cost',
    actionStepId: 'expense_categories',
    impactScore: 0.4,
    easeScore: 0.6,
  },

  // ── 15. Energy Efficiency / Clean Energy Credits ──
  {
    id: 'energy_efficiency',
    category: 'energy_efficiency',
    merchants: [
      // Solar installers
      'SUNRUN', 'SUNPOWER', 'VIVINT SOLAR', 'TESLA ENERGY',
      'TESLA SOLAR', 'ENPHASE', 'SUNNOVA', 'FREEDOM SOLAR',
      'PALMETTO SOLAR', 'MOMENTUM SOLAR', 'BLUE RAVEN',
      'TRINITY SOLAR', 'ELEVATION SOLAR',
      // Home improvement (energy — requires evidence tokens)
      'HOME DEPOT', 'LOWES', "LOWE'S",
      // EV charging
      'CHARGEPOINT', 'ELECTRIFY AMERICA', 'EVGO', 'BLINK CHARGING',
      'TESLA SUPERCHARGER',
      // Generic
      'SOLAR PANEL', 'HEAT PUMP',
    ],
    confidence: 'low',
    evidenceTokens: [
      'SOLAR', 'ENERGY', 'HEAT PUMP', 'INSULATION',
      'EV', 'CHARGER', 'CHARGING', 'ELECTRIC VEHICLE',
      'GEOTHERMAL', 'WIND TURBINE', 'BATTERY',
    ],
    gate: {},
    title: 'Residential Clean Energy Credit',
    description:
      'The Residential Clean Energy Credit (IRC §25D) covers 30% of the cost of ' +
      'solar panels, battery storage, geothermal heat pumps, and other clean energy ' +
      'installations. The Energy Efficient Home Improvement Credit (IRC §25C) covers ' +
      'heat pumps, insulation, windows, and doors.',
    statutoryMax: '30% of cost (§25D, no cap) / up to $3,200/year (§25C)',
    actionStepId: 'credits_overview',
    impactScore: 0.9,
    easeScore: 0.5,
  },

  // ── 16. Therapy / Mental Health ───────────────────
  {
    id: 'therapy_mental_health',
    category: 'therapy_mental_health',
    recurrenceRelevant: true,
    mccCodes: ['7277'],
    merchants: [
      // Telehealth / online therapy
      'BETTERHELP', 'TALKSPACE', 'CEREBRAL', 'BRIGHTSIDE',
      'GINGER', 'HEADWAY', 'ALMA', 'GROW THERAPY',
      'LYRA HEALTH', 'SPRING HEALTH', 'MODERN HEALTH',
      // Generic descriptors
      'THERAPIST', 'THERAPY', 'COUNSELING', 'COUNSELOR',
      'PSYCHOLOG', 'PSYCHIATR', 'MENTAL HEALTH',
      'BEHAVIORAL HEALTH', 'LCSW', 'LPC', 'LMFT',
    ],
    confidence: 'medium',
    gate: { requireItemizing: true, existingDataKeys: ['hasMedicalExpenses'] },
    title: 'Mental Health Expense Deduction',
    description:
      'Therapy and mental health services are deductible medical expenses if you ' +
      'itemize and your total medical expenses exceed 7.5% of AGI (IRC §213). ' +
      'This includes psychotherapy, psychiatry, and licensed counseling.',
    statutoryMax: 'expenses exceeding 7.5% of AGI (combined with other medical)',
    actionStepId: 'itemized_deductions',
    impactScore: 0.5,
    easeScore: 0.5,
  },

  // ══════════════════════════════════════════════════
  // TIER A — High impact, clear merchant signals
  // ══════════════════════════════════════════════════

  // ── 17. Advertising & Marketing ─────────────────────
  {
    id: 'advertising_marketing',
    category: 'advertising_marketing',
    recurrenceRelevant: true,
    merchants: [
      // Digital advertising platforms
      'FACEBOOK ADS', 'FB ADS', 'META ADS', 'META PLATFORMS',
      'GOOGLE ADS', 'GOOGLE ADWORDS', 'GOOGLE CLOUD ADS',
      'LINKEDIN ADS', 'LINKEDIN MARKETING',
      'TIKTOK ADS', 'TIKTOK FOR BUSINESS',
      'TWITTER ADS', 'X ADS',
      'PINTEREST ADS', 'SNAPCHAT ADS', 'SNAP ADS',
      'MICROSOFT ADS', 'BING ADS',
      'AMAZON ADVERTISING', 'AMAZON ADS',
      // Print / direct mail
      'VISTAPRINT', 'MINTED', 'UPRINTING',
      'USPS MARKETING', 'USPS EVERY DOOR',
      'VALASSIS', 'VALPAK',
      // Signage / trade shows
      'FASTSIGNS', 'SIGNARAMA', 'SIGNS.COM',
      // PR / media
      'PR NEWSWIRE', 'BUSINESS WIRE', 'GLOBENEWSWIRE',
      'CISION', 'MELTWATER',
      // Generic descriptors
      'ADVERTISING', 'AD SPEND', 'MARKETING',
    ],
    confidence: 'low',
    evidenceTokens: [
      'AD', 'ADS', 'ADVERTISING', 'MARKETING', 'PROMOTION',
      'CAMPAIGN', 'MEDIA', 'PRINT', 'SIGN',
    ],
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Advertising & Marketing Expenses',
    description:
      'Advertising and marketing costs are deductible business expenses on Schedule C ' +
      '(IRC §162). This includes digital ads, print materials, signage, and promotional items.',
    statutoryMax: 'actual cost (no cap)',
    actionStepId: 'expense_categories',
    impactScore: 0.6,
    easeScore: 0.7,
  },

  // ── 18. Payment Processing Fees ─────────────────────
  {
    id: 'payment_processing_fees',
    category: 'payment_processing_fees',
    recurrenceRelevant: true,
    merchants: [
      // Major processors
      'STRIPE', 'SQUARE', 'PAYPAL FEE', 'PAYPAL MERCHANT',
      'CLOVER', 'TOAST', 'LIGHTSPEED',
      // Gateway / POS
      'BRAINTREE', 'AUTHORIZE.NET', 'WORLDPAY',
      'HEARTLAND PAYMENT', 'FIRST DATA', 'FISERV',
      'ADYEN', 'CHECKOUT.COM',
      'HELCIM', 'STAX', 'FATTMERCHANT',
      // E-commerce
      'SHOPIFY PMT', 'SHOPIFY PAYMENT',
      'WOOCOMMERCE', 'BIGCOMMERCE',
      // Invoicing platforms
      'INVOICE NINJA', 'HARVEST PMT',
      // Generic descriptors
      'PROCESSING FEE', 'MERCHANT FEE', 'TRANSACTION FEE',
      'PAYMENT PROCESSING', 'CC PROCESSING',
    ],
    confidence: 'medium',
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Payment Processing Fee Deduction',
    description:
      'Merchant processing fees charged by payment platforms (Stripe, Square, PayPal, etc.) ' +
      'are deductible business expenses on Schedule C (IRC §162).',
    statutoryMax: 'actual cost (no cap)',
    actionStepId: 'expense_categories',
    impactScore: 0.5,
    easeScore: 0.9,
  },

  // ── 19. Contract Labor ──────────────────────────────
  {
    id: 'contract_labor',
    category: 'contract_labor',
    merchants: [
      // Freelance platforms
      'UPWORK', 'FIVERR', 'TOPTAL', '99DESIGNS',
      'GURU.COM', 'FREELANCER.COM',
      // Staffing / gig
      'TASKRABBIT', 'THUMBTACK', 'ANGI',
      'HANDY', 'BARK.COM',
      // Payroll for contractors
      'GUSTO', 'JUSTWORKS', 'PAYABLE',
      // Design / creative
      'DESIGNCROWD', 'PENJI', 'SUPERSIDE',
      // Generic descriptors
      'CONTRACTOR', 'FREELANCE', 'SUBCONTRACT',
      'CONTRACT LABOR',
    ],
    confidence: 'low',
    evidenceTokens: [
      'CONTRACTOR', 'FREELANCE', 'SUBCONTRACT', 'LABOR',
      'SERVICE', 'CONSULT', 'PROJECT',
    ],
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Contract Labor Deduction',
    description:
      'Payments to independent contractors are deductible on Schedule C (IRC §162). ' +
      'If you paid any individual contractor $600+ during the year, you must also file Form 1099-NEC.',
    statutoryMax: 'actual cost (no cap)',
    actionStepId: 'expense_categories',
    impactScore: 0.7,
    easeScore: 0.6,
  },

  // ── 20. Vehicle / Business Mileage ──────────────────
  {
    id: 'vehicle_business',
    category: 'vehicle_business',
    recurrenceRelevant: true,
    merchants: [
      // Gas stations / fuel
      'SHELL', 'EXXON', 'MOBIL', 'CHEVRON', 'BP',
      'SUNOCO', 'SPEEDWAY', 'MARATHON', 'CASEY',
      'WAWA', 'SHEETZ', 'QUIKTRIP', 'QT',
      'RACETRAC', 'MURPHY USA', 'SAMS FUEL', "SAM'S FUEL",
      'COSTCO GAS', 'COSTCO FUEL', 'BJS GAS',
      // Tolls
      'E-ZPASS', 'EZPASS', 'IPASS', 'SUNPASS',
      'FASTRAK', 'TOLL', 'TURNPIKE',
      'NTTA', 'HCTRA',
      // Parking
      'PARKWHIZ', 'SPOTHERO', 'PARKMOBILE',
      'PARKME', 'BESTPARKING',
      'LAZ PARKING', 'SP PLUS', 'ABM PARKING',
      // Car wash (business vehicle)
      'MISTER CAR WASH', 'TAKE 5 CAR WASH',
      // Mileage tracking
      'MILEIQ', 'EVERLANCE', 'HURDLR', 'STRIDE',
      // Generic descriptors
      'FUEL', 'GASOLINE', 'PARKING',
    ],
    confidence: 'low',
    evidenceTokens: [
      'TOLL', 'PARKING', 'MILEAGE', 'BUSINESS',
      'CLIENT', 'JOBSITE', 'COMMERCIAL',
    ],
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Vehicle / Business Mileage Deduction',
    description:
      'Business use of your vehicle is deductible using either the standard mileage rate ' +
      '(67¢/mile for 2024) or actual expenses (IRC §162). Track mileage carefully — ' +
      'fuel and tolls are only deductible for the business-use percentage.',
    statutoryMax: 'standard mileage rate or actual expenses (business % only)',
    actionStepId: 'vehicle_expenses',
    impactScore: 0.7,
    easeScore: 0.5,
  },

  // ── 21. Professional Development ────────────────────
  {
    id: 'professional_development',
    category: 'professional_development',
    merchants: [
      // Online learning platforms
      'UDEMY', 'COURSERA', 'LINKEDIN LEARNING',
      'SKILLSHARE', 'MASTERCLASS', 'PLURALSIGHT',
      'TREEHOUSE', 'CODECADEMY', 'DATACAMP',
      'BRILLIANT.ORG', 'EDEX', 'EDX',
      // Conference / event platforms
      'EVENTBRITE', 'CVENT', 'WHOVA', 'HOPIN',
      // Books (business / professional)
      'OREILLY', "O'REILLY", 'SAFARI BOOKS',
      'AUDIBLE', 'KINDLE',
      // Certification bodies
      'COMPTIA', 'PMI', 'SCRUM.ORG', 'AWS TRAINING',
      'GOOGLE CERT', 'MICROSOFT CERT',
      // Generic descriptors
      'CONFERENCE', 'WORKSHOP', 'SEMINAR', 'TRAINING',
      'WEBINAR', 'CERTIFICATION', 'PROFESSIONAL DEV',
    ],
    confidence: 'low',
    evidenceTokens: [
      'TRAINING', 'COURSE', 'LEARN', 'CERT', 'CONFERENCE',
      'WORKSHOP', 'SEMINAR', 'EDUCATION', 'PROFESSIONAL',
    ],
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Professional Development Expenses',
    description:
      'Education and training that maintains or improves skills for your current business ' +
      'are deductible on Schedule C (IRC §162). This includes courses, conferences, ' +
      'certifications, and professional books.',
    statutoryMax: 'actual cost (no cap)',
    actionStepId: 'expense_categories',
    impactScore: 0.5,
    easeScore: 0.7,
  },

  // ── 22. Coworking / Office Rent ─────────────────────
  {
    id: 'coworking_office_rent',
    category: 'coworking_office_rent',
    recurrenceRelevant: true,
    merchants: [
      // Major coworking chains
      'WEWORK', 'REGUS', 'IWG', 'SPACES', 'KNOTEL',
      'INDUSTRIOUS', 'CONVENE', 'NOVEL COWORKING',
      'SERENDIPITY LABS', 'IMPACT HUB',
      // Flexible workspace
      'LIQUIDSPACE', 'DESKPASS', 'CROISSANT',
      'BREATHER', 'PEERSPACE',
      // Mailbox / virtual office
      'UPS STORE MAILBOX', 'ANYTIME MAILBOX',
      'DAVINCI VIRTUAL', 'OPUS VIRTUAL',
      'ALLIANCE VIRTUAL',
      // Generic descriptors
      'COWORKING', 'CO-WORKING', 'OFFICE RENT',
      'OFFICE LEASE', 'WORKSPACE',
    ],
    confidence: 'medium',
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Office Rent / Coworking Deduction',
    description:
      'Rent for office space or coworking memberships is deductible on Schedule C ' +
      '(IRC §162). This is separate from the home office deduction and applies when ' +
      'you rent workspace outside the home.',
    statutoryMax: 'actual cost (no cap)',
    actionStepId: 'expense_categories',
    impactScore: 0.6,
    easeScore: 0.8,
  },

  // ── 23. Business Insurance ──────────────────────────
  {
    id: 'business_insurance',
    category: 'business_insurance',
    recurrenceRelevant: true,
    merchants: [
      // Business insurance providers
      'HISCOX', 'NEXT INSURANCE', 'THIMBLE',
      'SIMPLY BUSINESS', 'EMBROKER', 'COTERIE',
      'BIBERK', 'BOLTTECH',
      // E&O / professional liability
      'BERXI', 'PROLIABILITY',
      // General commercial insurers
      'HARTFORD', 'TRAVELERS INS', 'CHUBB',
      'NATIONWIDE BUS', 'STATE FARM BUS',
      'PROGRESSIVE COMM', 'GEICO COMM',
      'LIBERTY MUTUAL BUS',
      // Workers comp
      'EMPLOYERS INSURANCE', 'GUARD INSURANCE',
      // Generic descriptors
      'BUSINESS INS', 'COMMERCIAL INS', 'LIABILITY INS',
      'PROFESSIONAL LIABILITY', 'E&O INSURANCE',
      'GENERAL LIABILITY', 'BOP INSURANCE',
    ],
    confidence: 'medium',
    evidenceTokens: [
      'INSURANCE', 'LIABILITY', 'COVERAGE', 'PREMIUM',
      'POLICY', 'COMMERCIAL', 'BUSINESS',
    ],
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Business Insurance Deduction',
    description:
      'Business insurance premiums — including general liability, professional liability (E&O), ' +
      'and commercial property insurance — are deductible on Schedule C (IRC §162).',
    statutoryMax: 'actual cost (no cap)',
    actionStepId: 'expense_categories',
    impactScore: 0.5,
    easeScore: 0.8,
  },

  // ══════════════════════════════════════════════════
  // TIER B — Medium impact
  // ══════════════════════════════════════════════════

  // ── 24. Gambling Losses ─────────────────────────────
  {
    id: 'gambling_losses',
    category: 'gambling_losses',
    merchants: [
      // Online sportsbooks / DFS
      'DRAFTKINGS', 'FANDUEL', 'BETMGM', 'CAESARS SPORTS',
      'BARSTOOL', 'POINTSBET', 'BETRIVERS',
      'HARD ROCK BET', 'FANATICS BET',
      'ESPN BET', 'BET365',
      // Casinos (statement descriptors)
      'MGM RESORTS', 'CAESARS ENTMT', 'WYNN RESORTS',
      'LAS VEGAS SANDS', 'PENN NATIONAL', 'PENN ENTMT',
      'MOHEGAN SUN', 'FOXWOODS', 'HARRAHS',
      'BORGATA', 'TROPICANA', 'BELLAGIO',
      'VENETIAN', 'GOLDEN NUGGET',
      // Lottery / state gaming
      'JACKPOCKET', 'LOTTERY', 'LOTTO',
      // Poker / card rooms
      'POKERSTARS', 'WSOP', 'GLOBAL POKER',
      // Horse racing
      'TWINSPIRES', 'TVGNETWORK', 'TVG',
      'XPRESSBET', 'NYRA BETS',
      // Generic descriptors
      'CASINO', 'GAMBLING', 'WAGER', 'SPORTSBOOK',
    ],
    confidence: 'medium',
    gate: { requireTrue: ['hasGamblingWinnings'] },
    title: 'Gambling Loss Deduction',
    description:
      'Gambling losses are deductible as an itemized deduction, but only up to the amount ' +
      'of gambling winnings reported on your return (IRC §165(d)). Keep detailed records ' +
      'of all wins and losses.',
    statutoryMax: 'up to the amount of gambling winnings',
    actionStepId: 'itemized_deductions',
    impactScore: 0.7,
    easeScore: 0.6,
  },

  // ── 25. Education Credits ───────────────────────────
  {
    id: 'education_credits',
    category: 'education_credits',
    merchants: [
      // Major universities (common statement descriptors)
      'UNIVERSITY', 'COLLEGE', 'COMMUNITY COLLEGE',
      // Student account / bursar systems
      'TOUCHNET', 'CASHNET', 'NELNET CAMPUS',
      'TRANSACT CAMPUS', 'FLYWIRE', 'WESTERN UNION EDU',
      // Textbook retailers
      'CHEGG', 'CENGAGE', 'MCGRAW-HILL', 'MCGRAW HILL',
      'PEARSON EDUCATION', 'WILEY', 'ELSEVIER',
      'CAMPUS BOOKSTORE', 'FOLLETT', 'BARNES NOBLE COLL',
      // Student housing (qualified, on-campus)
      'CAMPUS HOUSING', 'RESIDENCE HALL',
      // Generic descriptors
      'TUITION', 'ENROLLMENT', 'REGISTRAR',
      'STUDENT ACCOUNT', 'BURSAR',
    ],
    confidence: 'medium',
    evidenceTokens: [
      'TUITION', 'EDUCATION', 'COLLEGE', 'UNIVERSITY',
      'STUDENT', 'ENROLLMENT', 'ACADEMIC', 'SEMESTER',
    ],
    negativeTokens: ['LOAN', 'REFUND'],
    gate: {},
    title: 'Education Credits (AOTC / LLC)',
    description:
      'The American Opportunity Tax Credit (AOTC) provides up to $2,500 per student for ' +
      'the first four years of post-secondary education. The Lifetime Learning Credit (LLC) ' +
      'covers 20% of up to $10,000 in qualified expenses (IRC §25A).',
    statutoryMax: 'up to $2,500/student (AOTC) or $2,000 (LLC)',
    actionStepId: 'education_credits',
    impactScore: 0.8,
    easeScore: 0.7,
  },

  // ── 26. State & Local / Property Tax ────────────────
  {
    id: 'salt_property_tax',
    category: 'salt_property_tax',
    recurrenceRelevant: true,
    matchMode: 'word_boundary',
    merchants: [
      // County / municipal tax offices
      'COUNTY TAX', 'COUNTY TREAS', 'COUNTY COLLECTOR',
      'PROPERTY TAX', 'REAL ESTATE TAX',
      // State tax payments
      'STATE TAX', 'STATE REVENUE', 'DEPT OF REVENUE',
      'FRANCHISE TAX', 'INCOME TAX PMT',
      // Tax payment platforms
      'OFFICIAL PAYMENTS', 'GOVTECHPAY',
      'PAYIT', 'PAYGOV', 'PAY.GOV',
      'POINT AND PAY', 'MUNICIPAY',
      // Escrow (property tax portion)
      'ESCROW TAX', 'TAX ESCROW',
      // Generic descriptors
      'PROPERTY ASSESSMENT', 'TAX ASSESSMENT',
      'SCHOOL TAX', 'MUNICIPAL TAX', 'CITY TAX',
    ],
    confidence: 'medium',
    negativeTokens: ['PREP', 'PREPARATION', 'TURBOTAX', 'H&R', 'JACKSON'],
    gate: { requireItemizing: true },
    title: 'State & Local Tax (SALT) Deduction',
    description:
      'State and local taxes — including property taxes and state income/sales taxes — ' +
      'are deductible if you itemize (IRC §164). The SALT deduction is capped at $40,000 ' +
      '($20,000 MFS) for 2025 under the OBBBA.',
    statutoryMax: 'up to $40,000 ($20,000 MFS)',
    actionStepId: 'itemized_deductions',
    impactScore: 0.8,
    easeScore: 0.6,
  },

  // ── 27. Business Meals ──────────────────────────────
  {
    id: 'business_meals',
    category: 'business_meals',
    recurrenceRelevant: true,
    mccCodes: ['5812', '5813', '5814'],
    merchants: [
      // Delivery / ordering platforms
      'DOORDASH', 'GRUBHUB', 'UBER EATS', 'UBEREATS',
      'POSTMATES', 'CAVIAR', 'SEAMLESS',
      'INSTACART', 'GOPUFF',
      // Catering
      'EZ CATER', 'EZCATER', 'CATER2ME',
      'FOODA', 'ZEROCATER',
      // Corporate dining / meal plans
      'RITUAL', 'CORPORATE DINING',
      // Generic descriptors (need evidence tokens)
      'RESTAURANT', 'CATERING', 'BUSINESS MEAL',
    ],
    confidence: 'low',
    evidenceTokens: [
      'CATERING', 'CORPORATE', 'CLIENT', 'MEETING',
      'CONFERENCE', 'BUSINESS MEAL', 'TRAVEL',
    ],
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Business Meals Deduction',
    description:
      'Business meals with clients, employees, or while traveling for business are 50% ' +
      'deductible on Schedule C (IRC §162). Keep receipts and record the business purpose ' +
      'and attendees for each meal.',
    statutoryMax: '50% of actual cost',
    actionStepId: 'expense_categories',
    impactScore: 0.4,
    easeScore: 0.5,
  },

  // ══════════════════════════════════════════════════
  // TIER C — Niche
  // ══════════════════════════════════════════════════

  // ── 28. Military Moving Expenses ────────────────────
  {
    id: 'military_moving',
    category: 'military_moving',
    merchants: [
      // Moving companies
      'UNITED VAN LINES', 'ALLIED VAN LINES', 'MAYFLOWER',
      'ATLAS VAN LINES', 'NORTH AMERICAN VAN',
      'TWO MEN AND A TRUCK', 'COLLEGE HUNKS',
      'PODS', 'U-PACK', 'ABF FREIGHT',
      // Truck rental
      'U-HAUL', 'UHAUL', 'PENSKE', 'BUDGET TRUCK',
      // Storage
      'PUBLIC STORAGE', 'EXTRA SPACE', 'CUBESMART',
      'LIFE STORAGE', 'UNCLE BOBS',
      // Military-specific
      'MILITARY ONESOURCE', 'PCS', 'DITY MOVE',
      // Generic descriptors
      'MOVING', 'RELOCATION', 'HOUSEHOLD GOODS',
    ],
    confidence: 'low',
    evidenceTokens: [
      'MOVING', 'RELOCATION', 'PCS', 'MILITARY',
      'STORAGE', 'FREIGHT', 'HAULING',
    ],
    gate: {},
    title: 'Military Moving Expense Deduction',
    description:
      'Active-duty military members who move due to a permanent change of station (PCS) ' +
      'can deduct unreimbursed moving expenses as an above-the-line adjustment (IRC §217). ' +
      'This deduction was eliminated for non-military taxpayers under TCJA.',
    statutoryMax: 'actual unreimbursed cost (military PCS only)',
    actionStepId: 'deductions_discovery',
    impactScore: 0.6,
    easeScore: 0.7,
  },

  // ── 29. Professional Dues & Memberships ─────────────
  {
    id: 'professional_dues',
    category: 'professional_dues',
    recurrenceRelevant: true,
    merchants: [
      // Bar associations
      'BAR ASSOCIATION', 'STATE BAR', 'ABA MEMBERSHIP',
      'AMERICAN BAR',
      // CPA / accounting
      'AICPA', 'STATE CPA', 'CPA SOCIETY',
      // Medical
      'AMA MEMBER', 'AMERICAN MEDICAL',
      'STATE MEDICAL', 'MEDICAL SOCIETY',
      // Engineering / tech
      'IEEE', 'ACM MEMBERSHIP', 'ASME',
      // Real estate
      'NAR MEMBERSHIP', 'REALTOR DUES', 'MLS DUES',
      // Professional licensing
      'LICENSE RENEWAL', 'PROFESSIONAL LICENSE',
      'STATE LICENSE', 'BOARD CERTIFICATION',
      // Trade unions
      'UNION DUES', 'LOCAL UNION', 'IBEW', 'UAW',
      // Generic descriptors
      'MEMBERSHIP DUES', 'ANNUAL DUES', 'PROFESSIONAL DUES',
      'ASSOCIATION DUES',
    ],
    confidence: 'medium',
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Professional Dues & Memberships',
    description:
      'Dues to professional organizations and licensing fees are deductible on Schedule C ' +
      '(IRC §162) for self-employed taxpayers. TCJA eliminated the employee deduction for ' +
      'unreimbursed professional dues through 2025.',
    statutoryMax: 'actual cost (no cap)',
    actionStepId: 'expense_categories',
    impactScore: 0.3,
    easeScore: 0.9,
  },

  // ── 30. Continuing Education ────────────────────────
  {
    id: 'continuing_education',
    category: 'continuing_education',
    merchants: [
      // CE providers
      'CONTINUING EDUCATION', 'CE CREDITS', 'CE DIRECT',
      'PROPREP', 'SURGENT', 'BECKER',
      'KAPLAN', 'BARBRI', 'THEMIS',
      // Professional development (CE-specific)
      'CPE', 'CLE', 'CME', 'CEU',
      'NASBA', 'MCLE',
      // Licensing boards
      'BOARD OF ACCOUNTANCY', 'BOARD OF PHARMACY',
      'MEDICAL BOARD', 'NURSING BOARD',
      // Test prep / certification exams
      'PROMETRIC', 'PEARSON VUE', 'PSI EXAMS',
      // Generic descriptors
      'ACCREDITATION', 'RECERTIFICATION',
    ],
    confidence: 'low',
    matchMode: 'word_boundary',
    evidenceTokens: [
      'CE', 'CPE', 'CLE', 'CME', 'CEU', 'CREDIT',
      'CONTINUING', 'LICENSE', 'CERTIFICATION', 'EXAM',
    ],
    gate: { requireTrue: ['hasScheduleC'] },
    title: 'Continuing Education Expenses',
    description:
      'Continuing education required to maintain a professional license or certification ' +
      'is deductible on Schedule C (IRC §162). This includes CE credits for CPAs, attorneys, ' +
      'medical professionals, and other licensed practitioners.',
    statutoryMax: 'actual cost (no cap)',
    actionStepId: 'expense_categories',
    impactScore: 0.3,
    easeScore: 0.8,
  },
];
