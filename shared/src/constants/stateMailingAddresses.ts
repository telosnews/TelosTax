/**
 * State Tax Return Mailing Addresses
 *
 * Keyed by two-letter state code. Each state has separate addresses for
 * refund returns vs. balance-due returns (many states use the same address
 * for both). Data sourced from official state DOR booklets and websites.
 *
 * Workers populate entries for their batch of states; the additive structure
 * auto-merges across parallel branches.
 */

export interface StateMailingAddress {
  /** Address lines when the return claims a refund */
  refund: string[];
  /** Address lines when the return has a balance due */
  balanceDue: string[];
  /** Optional notes (e.g., "Make check payable to...") */
  notes?: string;
  /** URL for online/electronic payment */
  onlinePaymentUrl?: string;
}

export const STATE_MAILING_ADDRESSES: Record<string, StateMailingAddress> = {

  AL: {
    refund: [
      'Alabama Department of Revenue',
      'P.O. Box 327464',
      'Montgomery, AL 36132-7464',
    ],
    balanceDue: [
      'Alabama Department of Revenue',
      'P.O. Box 327469',
      'Montgomery, AL 36132-7469',
    ],
    notes: 'Make check or money order payable to "Alabama Department of Revenue." Write your SSN and "2025 AL Form 40" on the check.',
    onlinePaymentUrl: 'https://myalabamataxes.alabama.gov',
  },

  AZ: {
    refund: [
      'Arizona Department of Revenue',
      'PO Box 52138',
      'Phoenix, AZ 85072-2138',
    ],
    balanceDue: [
      'Arizona Department of Revenue',
      'PO Box 52016',
      'Phoenix, AZ 85072-2016',
    ],
    notes: 'Make check payable to "Arizona Department of Revenue." Write SSN, Form 140, and tax year on the front.',
  },

  CA: {
    refund: [
      'Franchise Tax Board',
      'PO Box 942840',
      'Sacramento, CA 94240-0001',
    ],
    balanceDue: [
      'Franchise Tax Board',
      'PO Box 942867',
      'Sacramento, CA 94267-0001',
    ],
    notes: 'Make check or money order payable to "Franchise Tax Board." Write your SSN or ITIN and "2025 Form 540" on the check.',
    onlinePaymentUrl: 'https://webapp.ftb.ca.gov/efile/pay.aspx',
  },

  CO: {
    refund: [
      'Colorado Department of Revenue',
      'Denver, CO 80261-0005',
    ],
    balanceDue: [
      'Colorado Department of Revenue',
      'Denver, CO 80261-0006',
    ],
    notes: 'These addresses and zip codes are exclusive to the Colorado Department of Revenue. A street address is not required.',
  },

  CT: {
    refund: [
      'Department of Revenue Services',
      'State of Connecticut',
      'PO Box 150407',
      'Hartford, CT 06115-0407',
    ],
    balanceDue: [
      'Department of Revenue Services',
      'State of Connecticut',
      'PO Box 150406',
      'Hartford, CT 06115-0406',
    ],
    notes: 'Make check or money order payable to "Commissioner of Revenue Services." Write your SSN and "2025 Form CT-1040" on the check.',
    onlinePaymentUrl: 'https://portal.ct.gov/drs/myconnect',
  },

  GA: {
    refund: [
      'Processing Center',
      'Georgia Department of Revenue',
      'PO Box 740392',
      'Atlanta, GA 30374-0392',
    ],
    balanceDue: [
      'Processing Center',
      'Georgia Department of Revenue',
      'PO Box 740399',
      'Atlanta, GA 30374-0399',
    ],
    notes: 'Make check or money order payable to the Georgia Department of Revenue.',
  },

  HI: {
    refund: [
      'Hawaii Department of Taxation',
      'P.O. Box 3559',
      'Honolulu, HI 96811-3559',
    ],
    balanceDue: [
      'Hawaii Department of Taxation',
      'Attn: Payment Section',
      'P.O. Box 1530',
      'Honolulu, HI 96806-1530',
    ],
    notes: 'Make check payable to "Hawaii State Tax Collector."',
  },

  ID: {
    refund: [
      'Idaho State Tax Commission',
      'PO Box 56',
      'Boise, ID 83756-0056',
    ],
    balanceDue: [
      'Idaho State Tax Commission',
      'PO Box 83784',
      'Boise, ID 83707-3784',
    ],
  },

  IL: {
    refund: [
      'Illinois Department of Revenue',
      'Springfield, IL 62736-0101',
    ],
    balanceDue: [
      'Illinois Department of Revenue',
      'Springfield, IL 62736-0001',
    ],
    notes: 'A street address is not required; these zip codes are exclusive to the department.',
  },

  IN: {
    refund: [
      'Indiana Department of Revenue',
      'P.O. Box 40',
      'Indianapolis, IN 46206-0040',
    ],
    balanceDue: [
      'Indiana Department of Revenue',
      'P.O. Box 7224',
      'Indianapolis, IN 46207-7224',
    ],
    notes: 'Make check payable to "Indiana Department of Revenue."',
  },

  KS: {
    refund: [
      'Individual Income Tax',
      'Kansas Department of Revenue',
      'PO Box 750260',
      'Topeka, KS 66699-0260',
    ],
    balanceDue: [
      'Individual Income Tax',
      'Kansas Department of Revenue',
      'PO Box 750260',
      'Topeka, KS 66699-0260',
    ],
    notes: 'Make check or money order payable to "Kansas Income Tax." Submit Form K-40V with payment.',
  },

  KY: {
    refund: [
      'Kentucky Department of Revenue',
      'Frankfort, KY 40618-0006',
    ],
    balanceDue: [
      'Kentucky Department of Revenue',
      'Frankfort, KY 40619-0008',
    ],
    notes: 'Make check payable to "Kentucky State Treasurer." Write "KY Income Tax--2025" and your SSN on the check.',
  },

  LA: {
    refund: [
      'Louisiana Department of Revenue',
      'P.O. Box 3440',
      'Baton Rouge, LA 70821-3440',
    ],
    balanceDue: [
      'Louisiana Department of Revenue',
      'P.O. Box 3550',
      'Baton Rouge, LA 70821-3550',
    ],
    notes: 'Make check or money order payable to "Louisiana Department of Revenue." Louisiana deadline is May 15, 2026.',
  },

  MA: {
    refund: [
      'Massachusetts Department of Revenue',
      'PO Box 7000',
      'Boston, MA 02204',
    ],
    balanceDue: [
      'Massachusetts Department of Revenue',
      'PO Box 7003',
      'Boston, MA 02204',
    ],
  },

  MD: {
    refund: [
      'Comptroller of Maryland',
      'Revenue Administration Division',
      '110 Carroll Street',
      'Annapolis, MD 21411-0001',
    ],
    balanceDue: [
      'Comptroller of Maryland',
      'Revenue Administration Division',
      '110 Carroll Street',
      'Annapolis, MD 21411-0001',
    ],
    notes: 'Make check or money order payable to "Comptroller of Maryland." Write your SSN and "2025 Form 502" on the check. Include Form PV with payment.',
    onlinePaymentUrl: 'https://interactive.marylandtaxes.gov/Individuals/iFile_ChooseForm/default.asp',
  },

  MI: {
    refund: [
      'Michigan Department of Treasury',
      'Lansing, MI 48956',
    ],
    balanceDue: [
      'Michigan Department of Treasury',
      'Lansing, MI 48929',
    ],
    notes: 'Make check payable to "State of Michigan." Print last four digits of SSN and "2025 income tax" on the check.',
  },

  NC: {
    refund: [
      'NC Department of Revenue',
      'PO Box R',
      'Raleigh, NC 27634-0001',
    ],
    balanceDue: [
      'NC Department of Revenue',
      'PO Box 25000',
      'Raleigh, NC 27640-0640',
    ],
    notes: 'Make check payable to "NC Department of Revenue." Write "2025 D-400" and last 4 digits of SSN on payment. Submit Form D-400V with payment.',
  },

  NE: {
    refund: [
      'Nebraska Department of Revenue',
      'PO Box 98911',
      'Lincoln, NE 68509-8911',
    ],
    balanceDue: [
      'Nebraska Department of Revenue',
      'PO Box 98911',
      'Lincoln, NE 68509-8911',
    ],
    notes: 'Make check payable to "Nebraska Department of Revenue."',
  },

  NJ: {
    refund: [
      'State of New Jersey',
      'Division of Taxation',
      'Revenue Processing Center',
      'PO Box 555',
      'Trenton, NJ 08647-0555',
    ],
    balanceDue: [
      'State of New Jersey',
      'Division of Taxation',
      'Revenue Processing Center',
      'PO Box 111',
      'Trenton, NJ 08645-0111',
    ],
    notes: 'Make check or money order payable to "State of New Jersey - TGI." Write your SSN and "2025 NJ-1040" on the check.',
    onlinePaymentUrl: 'https://www.nj.gov/treasury/taxation/payments.shtml',
  },

  NY: {
    refund: [
      'NYS Tax Processing',
      'PO Box 61000',
      'Albany, NY 12261-0001',
    ],
    balanceDue: [
      'NYS Tax Processing',
      'PO Box 15555',
      'Albany, NY 12212-5555',
    ],
    notes: 'Make check or money order payable to "NYS Income Tax." Write the last four digits of your SSN and "2025 IT-201" on the check.',
    onlinePaymentUrl: 'https://www.tax.ny.gov/pay/',
  },

  OH: {
    refund: [
      'Ohio Department of Taxation',
      'PO Box 2679',
      'Columbus, OH 43216-2679',
    ],
    balanceDue: [
      'Ohio Department of Taxation',
      'PO Box 2057',
      'Columbus, OH 43216-2057',
    ],
    notes: 'Make check or money order payable to "Ohio Treasurer of State." Write your SSN and "2025 IT 1040" on the check.',
    onlinePaymentUrl: 'https://tax.ohio.gov/individual/pay-online',
  },

  OK: {
    refund: [
      'Oklahoma Tax Commission',
      'PO Box 26800',
      'Oklahoma City, OK 73126-0800',
    ],
    balanceDue: [
      'Oklahoma Tax Commission',
      'PO Box 26800',
      'Oklahoma City, OK 73126-0800',
    ],
    notes: 'Make check or money order payable to "Oklahoma Tax Commission."',
  },

  PA: {
    refund: [
      'PA Department of Revenue',
      'Refund Requested',
      '1 Revenue Place',
      'Harrisburg, PA 17129-0003',
    ],
    balanceDue: [
      'PA Department of Revenue',
      'Payment Enclosed',
      '1 Revenue Place',
      'Harrisburg, PA 17129-0001',
    ],
    notes: 'Make check or money order payable to "PA Department of Revenue."',
    onlinePaymentUrl: 'https://mypath.pa.gov',
  },

  UT: {
    refund: [
      'Utah State Tax Commission',
      '210 N 1950 W',
      'Salt Lake City, UT 84134-0260',
    ],
    balanceDue: [
      'Utah State Tax Commission',
      '210 N 1950 W',
      'Salt Lake City, UT 84134-0266',
    ],
    notes: 'Make check payable to "Utah State Tax Commission." Write daytime phone and "2025 TC-40" on check. Include TC-547 coupon with payment.',
  },

  IA: {
    refund: [
      'Iowa Income Tax Document Processing',
      'PO Box 9187',
      'Des Moines, IA 50306-9187',
    ],
    balanceDue: [
      'Iowa Income Tax Document Processing',
      'PO Box 9187',
      'Des Moines, IA 50306-9187',
    ],
    notes: 'Make check or money order payable to "Treasurer — State of Iowa." Write your SSN and "2025 IA 1040" on the check.',
  },

  MN: {
    refund: [
      'Minnesota Department of Revenue',
      'Mail Station 0010',
      'St. Paul, MN 55145-0010',
    ],
    balanceDue: [
      'Minnesota Department of Revenue',
      'Mail Station 0010',
      'St. Paul, MN 55145-0010',
    ],
    notes: 'Make check payable to "Minnesota Revenue." Write your SSN and "2025 M1" on the check.',
    onlinePaymentUrl: 'https://www.revenue.state.mn.us',
  },

  MO: {
    refund: [
      'Missouri Department of Revenue',
      'PO Box 500',
      'Jefferson City, MO 65105-0500',
    ],
    balanceDue: [
      'Missouri Department of Revenue',
      'PO Box 329',
      'Jefferson City, MO 65105-0329',
    ],
    notes: 'Make check or money order payable to "Director of Revenue." Write your SSN and "2025 MO-1040" on the check.',
  },

  MS: {
    refund: [
      'Mississippi Department of Revenue',
      'PO Box 23058',
      'Jackson, MS 39225-3058',
    ],
    balanceDue: [
      'Mississippi Department of Revenue',
      'PO Box 23050',
      'Jackson, MS 39225-3050',
    ],
    notes: 'Make check or money order payable to "Mississippi Department of Revenue." Write your SSN and "2025 80-105" on the check.',
  },

  SC: {
    refund: [
      'SC Department of Revenue',
      'PO Box 101100',
      'Columbia, SC 29211-0100',
    ],
    balanceDue: [
      'SC Department of Revenue',
      'Individual Income Tax',
      'PO Box 101105',
      'Columbia, SC 29211-0105',
    ],
    notes: 'Make check payable to "SC Department of Revenue." Write your SSN and "2025 SC1040" on the check.',
    onlinePaymentUrl: 'https://mydorway.dor.sc.gov',
  },

  VA: {
    refund: [
      'Virginia Department of Taxation',
      'PO Box 1498',
      'Richmond, VA 23218-1498',
    ],
    balanceDue: [
      'Virginia Department of Taxation',
      'PO Box 760',
      'Richmond, VA 23218-0760',
    ],
    notes: 'Make check payable to "Virginia Department of Taxation." Write your SSN and "2025 Form 760" on the check.',
    onlinePaymentUrl: 'https://www.individual.tax.virginia.gov',
  },

  WI: {
    refund: [
      'Wisconsin Department of Revenue',
      'PO Box 59',
      'Madison, WI 53785-0001',
    ],
    balanceDue: [
      'Wisconsin Department of Revenue',
      'PO Box 268',
      'Madison, WI 53790-0001',
    ],
    notes: 'Make check or money order payable to "Wisconsin Department of Revenue." Write your SSN and "2025 WI Form 1" on the check.',
    onlinePaymentUrl: 'https://www.revenue.wi.gov/Pages/OnlineServices/w-epay.aspx',
  },

  // ─── Worker C states ──────────────────────────────────────────

  AR: {
    refund: [
      'Arkansas State Income Tax',
      'P.O. Box 1000',
      'Little Rock, AR 72203-1000',
    ],
    balanceDue: [
      'Arkansas State Income Tax',
      'P.O. Box 2144',
      'Little Rock, AR 72203-2144',
    ],
    notes: 'Make check or money order payable to "Department of Finance and Administration." Write your SSN, tax year, and form type on the payment.',
  },

  DC: {
    refund: [
      'Office of Tax and Revenue',
      'PO Box 96145',
      'Washington, DC 20090-6145',
    ],
    balanceDue: [
      'Office of Tax and Revenue',
      'PO Box 96169',
      'Washington, DC 20090-6169',
    ],
    notes: 'Make check or money order payable to "DC Treasurer."',
    onlinePaymentUrl: 'https://mytax.dc.gov',
  },

  DE: {
    refund: [
      'Delaware Division of Revenue',
      'PO Box 8710',
      'Wilmington, DE 19899-8710',
    ],
    balanceDue: [
      'Delaware Division of Revenue',
      'PO Box 508',
      'Wilmington, DE 19899-0508',
    ],
    notes: 'Make check payable to "Delaware Division of Revenue."',
  },

  ME: {
    refund: [
      'Maine Revenue Services',
      'P.O. Box 1067',
      'Augusta, ME 04332-1067',
    ],
    balanceDue: [
      'Maine Revenue Services',
      'P.O. Box 1067',
      'Augusta, ME 04332-1067',
    ],
    notes: 'Make check payable to "Treasurer, State of Maine." Write your SSN and "2025 1040ME" on the check.',
  },

  MT: {
    refund: [
      'Montana Department of Revenue',
      'PO Box 6577',
      'Helena, MT 59604-6577',
    ],
    balanceDue: [
      'Montana Department of Revenue',
      'PO Box 6308',
      'Helena, MT 59604-6308',
    ],
    notes: 'Make check payable to "Montana Department of Revenue." Write your SSN and "2025 Form 2" on the check.',
  },

  ND: {
    refund: [
      'Office of State Tax Commissioner',
      '600 E. Boulevard Ave., Dept. 127',
      'Bismarck, ND 58505-0599',
    ],
    balanceDue: [
      'Office of State Tax Commissioner',
      '600 E. Boulevard Ave., Dept. 127',
      'Bismarck, ND 58505-0599',
    ],
    notes: 'Make check payable to "ND State Tax Commissioner." Write your SSN and "2025 ND-1" on the check.',
    onlinePaymentUrl: 'https://www.tax.nd.gov',
  },

  NM: {
    refund: [
      'NM Taxation and Revenue Dept.',
      'P.O. Box 25122',
      'Santa Fe, NM 87504-5122',
    ],
    balanceDue: [
      'NM Taxation and Revenue Dept.',
      'P.O. Box 8390',
      'Santa Fe, NM 87504-8390',
    ],
    notes: 'Make check payable to "New Mexico Taxation and Revenue Department."',
  },

  OR: {
    refund: [
      'Oregon Department of Revenue',
      'PO Box 14700',
      'Salem, OR 97309-0930',
    ],
    balanceDue: [
      'Oregon Department of Revenue',
      'PO Box 14555',
      'Salem, OR 97309-0940',
    ],
    notes: 'Make check payable to "Oregon Department of Revenue." Write your SSN, daytime phone, and "2025 OR-40" on the check.',
    onlinePaymentUrl: 'https://www.oregon.gov/dor',
  },

  RI: {
    refund: [
      'Rhode Island Division of Taxation',
      'One Capitol Hill',
      'Providence, RI 02908-5807',
    ],
    balanceDue: [
      'Rhode Island Division of Taxation',
      'One Capitol Hill',
      'Providence, RI 02908-5807',
    ],
    notes: 'Make check or money order payable to "Rhode Island Division of Taxation." Include Form RI-1040V with payment.',
  },

  VT: {
    refund: [
      'Vermont Department of Taxes',
      'PO Box 1881',
      'Montpelier, VT 05601-1881',
    ],
    balanceDue: [
      'Vermont Department of Taxes',
      'PO Box 1881',
      'Montpelier, VT 05601-1881',
    ],
    notes: 'Make check payable to "Vermont Department of Taxes." Write your SSN and "2025 IN-111" on the check.',
    onlinePaymentUrl: 'https://myvtax.vermont.gov',
  },

  WV: {
    refund: [
      'West Virginia State Tax Department',
      'PO Box 1071',
      'Charleston, WV 25324-1071',
    ],
    balanceDue: [
      'West Virginia State Tax Department',
      'PO Box 3694',
      'Charleston, WV 25336-3694',
    ],
    notes: 'Make check payable to "West Virginia State Tax Department." Write your SSN and "2025 IT-140" on the check.',
  },

};
