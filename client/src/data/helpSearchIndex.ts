// MAINTENANCE: COMMON_QUESTIONS (bottom of file) is static. When adding new
// wizard steps or tax topics, consider adding a matching question so it appears
// in the Cmd+K command palette under "Help". buildHelpItems() auto-updates from
// HELP_CONTENT and needs no manual changes.
import { HELP_CONTENT } from './helpContent';

export interface HelpSearchItem {
  id: string;
  label: string;
  stepId: string;
  keywords: string[];
}

/** Extracts searchable items from HELP_CONTENT callouts and IRS-referenced fields. */
export function buildHelpItems(): HelpSearchItem[] {
  const items: HelpSearchItem[] = [];

  for (const [stepId, stepHelp] of Object.entries(HELP_CONTENT)) {
    // Extract callout titles
    if (stepHelp.callouts) {
      for (const [i, callout] of stepHelp.callouts.entries()) {
        items.push({
          id: `help-callout-${stepId}-${i}`,
          label: callout.title,
          stepId,
          keywords: [callout.type, callout.body.slice(0, 80)],
        });
      }
    }

    // Extract fields with IRS references
    for (const [fieldName, fieldHelp] of Object.entries(stepHelp.fields)) {
      if (fieldHelp.irsRef) {
        const safeFieldId = fieldName.replace(/[^a-zA-Z0-9]/g, '_');
        items.push({
          id: `help-field-${stepId}-${safeFieldId}`,
          label: `${fieldName} — ${fieldHelp.irsRef}`,
          stepId,
          keywords: [fieldHelp.tooltip ?? '', fieldHelp.irsRef],
        });
      }
    }
  }

  return items;
}

export interface CommonQuestion {
  id: string;
  label: string;
  stepId: string;
  keywords: string[];
}

export const COMMON_QUESTIONS: CommonQuestion[] = [
  { id: 'cq-freelance', label: 'How do I report freelance income?', stepId: '1099nec_income', keywords: ['freelance', 'self-employed', 'gig', 'contractor', '1099'] },
  { id: 'cq-itemize', label: 'Should I itemize or take the standard deduction?', stepId: 'deduction_method', keywords: ['itemize', 'standard deduction', 'schedule a'] },
  { id: 'cq-dependent', label: 'Can I claim someone as a dependent?', stepId: 'dependents', keywords: ['dependent', 'qualifying child', 'qualifying relative'] },
  { id: 'cq-home-office', label: 'How do I deduct my home office?', stepId: 'home_office', keywords: ['home office', 'work from home', 'form 8829', 'simplified method'] },
  { id: 'cq-w2', label: 'How do I enter my W-2?', stepId: 'w2_income', keywords: ['w-2', 'employer', 'wages'] },
  { id: 'cq-capital-gains', label: 'How do I report stock sales?', stepId: '1099b_income', keywords: ['stock', 'capital gains', 'broker', '1099-b'] },
  { id: 'cq-crypto', label: 'How do I report cryptocurrency?', stepId: '1099da_income', keywords: ['crypto', 'bitcoin', 'digital assets', '1099-da'] },
  { id: 'cq-child-credit', label: 'Do I qualify for the Child Tax Credit?', stepId: 'child_tax_credit', keywords: ['child tax credit', 'ctc', 'under 17'] },
  { id: 'cq-education', label: 'Can I claim education credits?', stepId: 'education_credits', keywords: ['education', 'tuition', 'american opportunity', 'lifetime learning', '1098-t'] },
  { id: 'cq-retirement', label: 'How are retirement distributions taxed?', stepId: '1099r_income', keywords: ['retirement', 'ira', '401k', 'distribution', 'rollover'] },
  { id: 'cq-estimated', label: 'Did I pay enough estimated taxes?', stepId: 'estimated_payments', keywords: ['estimated tax', 'quarterly', 'underpayment penalty'] },
  { id: 'cq-estimated-next', label: 'How do I make estimated tax payments for next year?', stepId: 'estimated_payments', keywords: ['estimated tax', '1040-es', 'quarterly payment', 'next year', 'voucher', '2026'] },
  { id: 'cq-rental', label: 'How do I report rental income?', stepId: 'rental_income', keywords: ['rental', 'landlord', 'schedule e', 'property'] },
  { id: 'cq-hsa', label: 'How do I report HSA contributions and distributions?', stepId: '1099sa_income', keywords: ['hsa', 'health savings', 'medical expenses'] },
  { id: 'cq-ev', label: 'Do I qualify for the EV tax credit?', stepId: 'ev_credit', keywords: ['electric vehicle', 'ev', 'clean vehicle', 'plug-in'] },
  { id: 'cq-filing-status', label: 'Which filing status should I choose?', stepId: 'filing_status', keywords: ['filing status', 'single', 'married', 'head of household'] },
  { id: 'cq-mileage', label: 'How do I deduct business mileage?', stepId: 'vehicle_expenses', keywords: ['mileage', 'vehicle', 'car', 'standard mileage rate'] },
  { id: 'cq-charitable', label: 'How much can I deduct for charitable donations?', stepId: 'itemized_deductions', keywords: ['charitable', 'donation', 'contribution', 'charity'] },
  { id: 'cq-export', label: 'How do I export or print my return?', stepId: 'export_pdf', keywords: ['export', 'print', 'pdf', 'download'] },
  { id: 'cq-ip-pin', label: 'What is an Identity Protection PIN (IP PIN)?', stepId: 'personal_info', keywords: ['ip pin', 'identity protection', 'identity theft', 'cp01a', '6-digit pin', 'rejected'] },
  { id: 'cq-state-tax', label: 'How do I file my state taxes?', stepId: 'state_overview', keywords: ['state tax', 'state return', 'state income tax', 'state filing'] },
  { id: 'cq-which-states', label: 'Which states require an income tax return?', stepId: 'state_overview', keywords: ['state required', 'no income tax', 'state selection', 'which states'] },
  { id: 'cq-state-refund', label: 'Where can I see my state refund or amount owed?', stepId: 'state_review', keywords: ['state refund', 'state owed', 'state balance', 'state summary'] },
  { id: 'cq-state-form', label: 'How do I generate my state tax form PDF?', stepId: 'export_pdf', keywords: ['state form', 'state pdf', 'state download', 'pa-40', 'it-201'] },
  { id: 'cq-mail-return', label: 'Where do I mail my tax return?', stepId: 'filing_instructions', keywords: ['mail', 'mailing address', 'paper filing', 'where to send', 'irs address'] },
  { id: 'cq-filing-instructions', label: 'How do I finish and file my return?', stepId: 'filing_instructions', keywords: ['filing instructions', 'finish', 'submit', 'file return', 'paper'] },
  { id: 'cq-donation-value', label: 'How do I determine the value of donated items?', stepId: 'charitable_deduction', keywords: ['donation value', 'fair market value', 'fmv', 'noncash', 'clothing value', 'furniture value', 'goodwill', 'salvation army', 'itsdeductible'] },
  { id: 'cq-home-sale', label: 'Can I exclude my home sale gain from taxes?', stepId: 'home_sale', keywords: ['home sale', 'section 121', 'exclusion', 'primary residence', '250000'] },
  { id: 'cq-foreign-income', label: 'How do I exclude foreign earned income?', stepId: 'foreign_earned_income', keywords: ['foreign income', 'form 2555', 'feie', 'abroad', 'overseas'] },
  { id: 'cq-passive-loss', label: 'What is the passive activity loss limitation?', stepId: 'form8582_data', keywords: ['passive loss', 'rental loss', 'suspended', 'form 8582', 'allowance'] },
  { id: 'cq-investment-interest', label: 'Can I deduct margin or investment interest?', stepId: 'investment_interest', keywords: ['investment interest', 'margin', 'form 4952', 'brokerage'] },
  { id: 'cq-tips-overtime', label: 'Can I deduct tips or overtime from my income?', stepId: 'schedule1a', keywords: ['tips', 'overtime', 'obbba', 'schedule 1-a', 'car loan'] },
  { id: 'cq-direct-deposit', label: 'How do I set up direct deposit for my refund?', stepId: 'refund_payment', keywords: ['direct deposit', 'bank', 'routing', 'refund', 'checking', 'savings'] },
];
