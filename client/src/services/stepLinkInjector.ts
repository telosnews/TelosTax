/**
 * Step Link Injector — auto-converts step/section references in chat messages
 * into clickable markdown links that navigate to wizard steps or open tools.
 *
 * Uses fragment URLs (`#step--step_id` / `#tool--tool_id`) instead of a custom
 * protocol because rehype-sanitize strips URLs with unrecognized protocols.
 * Fragment-only URLs have no protocol, so they always pass sanitization.
 *
 * LLMs don't reliably emit navigation links inside JSON strings, so we
 * post-process their output on the client. This is model-agnostic.
 *
 * Strategy:
 * 1. Patterns are ordered longest-first to avoid partial matches
 * 2. Every occurrence is linked (not just the first) for comprehensive navigation
 * 3. Skip text already inside markdown links or code blocks
 * 4. Process one pattern at a time, replacing all matches before moving to next
 */

/** Fragment prefix used for step navigation links. */
export const STEP_LINK_PREFIX = '#step--';

/** Fragment prefix used for tool panel links (Audit Risk, Calendar, etc.). */
export const TOOL_LINK_PREFIX = '#tool--';

/**
 * Pattern → target mapping. Longer/more-specific patterns come first so they
 * match before shorter ones (e.g., "1099-MISC Income" before "1099-MISC").
 *
 * Each entry: [regex, targetId, type] where type is 'step' or 'tool'.
 * Default type is 'step' if omitted.
 */
const LINK_PATTERNS: [RegExp, string, 'step' | 'tool'][] = [
  // ═══════════════════════════════════════════════════════
  // TOOLS — match before step patterns to avoid conflicts
  // ═══════════════════════════════════════════════════════
  [/Audit\s+Risk\s+(?:Score|Assessment|Summary|Analysis|Report)/gi, 'audit_risk', 'tool'],
  [/Audit\s+Risk/gi, 'audit_risk', 'tool'],
  [/Tax\s+Calendar/gi, 'tax_calendar', 'tool'],
  [/Smart\s+Expense\s+Scanner/gi, 'expense_scanner', 'tool'],
  [/Expense\s+Scanner/gi, 'expense_scanner', 'tool'],
  [/Deduction\s+Finder/gi, 'expense_scanner', 'tool'],
  [/Scenario\s+Lab/gi, 'tax_scenario_lab', 'tool'],
  [/Document\s+Inventory/gi, 'document_inventory', 'tool'],
  [/Year[- ]over[- ]Year/gi, 'yoy_comparison', 'tool'],
  [/YoY\s+Comparison/gi, 'yoy_comparison', 'tool'],

  // ═══════════════════════════════════════════════════════
  // INCOME — form + suffix phrases (longest first)
  // ═══════════════════════════════════════════════════════
  [/1099-MISC\s+(?:Income|Forms?|Step|Section)/gi, '1099misc_income', 'step'],
  [/1099-INT\s+(?:Income|Forms?|Step|Section)/gi, '1099int_income', 'step'],
  [/1099-DIV\s+(?:Income|Forms?|Step|Section)/gi, '1099div_income', 'step'],
  [/1099-OID\s+(?:Income|Forms?|Step|Section)/gi, '1099oid_income', 'step'],
  [/1099-NEC\s+(?:Income|Forms?|Step|Section)/gi, '1099nec_income', 'step'],
  [/1099-K\s+(?:Income|Forms?|Step|Section)/gi, '1099k_income', 'step'],
  [/1099-B\s+(?:Income|Forms?|Step|Section)/gi, '1099b_income', 'step'],
  [/1099-DA\s+(?:Income|Forms?|Step|Section)/gi, '1099da_income', 'step'],
  [/1099-R\s+(?:Income|Forms?|Step|Section|Distributions?)/gi, '1099r_income', 'step'],
  [/1099-G\s+(?:Income|Forms?|Step|Section)/gi, '1099g_income', 'step'],
  [/1099-SA\s+(?:Income|Forms?|Step|Section|Distributions?)/gi, '1099sa_income', 'step'],
  [/1099-Q\s+(?:Income|Forms?|Step|Section|Distributions?|Taxable)/gi, '1099q_income', 'step'],
  [/1099-C\s+(?:Income|Forms?|Step|Section)/gi, '1099c_income', 'step'],
  [/W-2G\s+(?:Income|Forms?|Step|Section)/gi, 'w2g_income', 'step'],
  [/K-1\s+(?:Income|Forms?|Step|Section)/gi, 'k1_income', 'step'],
  [/W-2\s+(?:Income|Forms?|Step|Section)/gi, 'w2_income', 'step'],

  // ═══════════════════════════════════════════════════════
  // INCOME — standalone form numbers
  // ═══════════════════════════════════════════════════════
  [/\b1099-MISC\b/gi, '1099misc_income', 'step'],
  [/\b1099-INT\b/gi, '1099int_income', 'step'],
  [/\b1099-DIV\b/gi, '1099div_income', 'step'],
  [/\b1099-OID\b/gi, '1099oid_income', 'step'],
  [/\b1099-NEC\b/gi, '1099nec_income', 'step'],
  [/\b1099-K\b/gi, '1099k_income', 'step'],
  [/\b1099-B\b/gi, '1099b_income', 'step'],
  [/\b1099-DA\b/gi, '1099da_income', 'step'],
  [/\b1099-R\b/gi, '1099r_income', 'step'],
  [/\b1099-G\b/gi, '1099g_income', 'step'],
  [/\b1099-SA\b/gi, '1099sa_income', 'step'],
  [/\b1099-Q\b/gi, '1099q_income', 'step'],
  [/\b1099-C\b/gi, '1099c_income', 'step'],
  [/\bW-2G\b/gi, 'w2g_income', 'step'],
  [/\bSSA-1099\b/gi, 'ssa1099_income', 'step'],
  [/\bK-1\b/gi, 'k1_income', 'step'],
  [/\bW-2\b/gi, 'w2_income', 'step'],

  // ═══════════════════════════════════════════════════════
  // INCOME — named sections (longer phrases first)
  // ═══════════════════════════════════════════════════════
  [/Foreign\s+Earned\s+Income\s+Exclusion/gi, 'foreign_earned_income', 'step'],
  [/Foreign\s+(?:Earned\s+)?Income/gi, 'foreign_earned_income', 'step'],
  [/\bFEIE\b/g, 'foreign_earned_income', 'step'],
  [/Social\s+Security\s+(?:Income|Benefits?)/gi, 'ssa1099_income', 'step'],
  [/Capital\s+Gains?\s+(?:and|&)\s+Losses?/gi, '1099b_income', 'step'],
  [/Capital\s+Gains?/gi, '1099b_income', 'step'],
  [/Digital\s+Asset\s+(?:Transactions?|Income)/gi, '1099da_income', 'step'],
  [/Digital\s+Assets?/gi, '1099da_income', 'step'],
  [/529\s+Distributions?/gi, '1099q_income', 'step'],
  [/Cancel+ed\s+Debt/gi, '1099c_income', 'step'],
  [/Gambling\s+(?:Winnings?|Income)/gi, 'w2g_income', 'step'],
  [/Unemployment\s+(?:Income|Compensation|Benefits?)/gi, '1099g_income', 'step'],
  [/Rental\s+(?:Income|Properties?|Property)/gi, 'rental_income', 'step'],
  [/Royalt(?:y|ies)\s+Income/gi, 'royalty_income', 'step'],
  [/Farm\s+(?:Income|Loss(?:es)?)/gi, 'schedule_f', 'step'],
  [/Farm\s+Rental/gi, 'farm_rental', 'step'],
  [/Installment\s+Sales?/gi, 'installment_sale', 'step'],
  [/Other\s+Income/gi, 'other_income', 'step'],
  [/Income\s+Summary/gi, 'income_summary', 'step'],
  [/Income\s+Overview/gi, 'income_overview', 'step'],
  [/Home\s+Sale/gi, 'home_sale', 'step'],

  // ═══════════════════════════════════════════════════════
  // SELF-EMPLOYMENT — longer phrases first
  // ═══════════════════════════════════════════════════════
  [/Schedule\s+C\s+(?:Expenses?|Review|Summary|Line\s+\d+)/gi, 'expense_categories', 'step'],
  [/Schedule\s+C\s+Retirement/gi, 'se_retirement', 'step'],
  [/Schedule\s+C\b/gi, 'expense_categories', 'step'],
  [/Self[- ]?Employment\s+(?:Income|Tax|Summary)/gi, 'business_info', 'step'],
  [/Self[- ]?Employment\b/gi, 'business_info', 'step'],
  [/Business\s+(?:Info(?:rmation)?|Profile)/gi, 'business_info', 'step'],
  [/Business\s+Expenses?/gi, 'expense_categories', 'step'],
  [/Business\s+Property\b/gi, 'form4797', 'step'],
  [/Expense\s+Categories/gi, 'expense_categories', 'step'],
  [/Meal\s+Expenses?/gi, 'expense_categories', 'step'],
  [/Home\s+Office/gi, 'home_office', 'step'],
  [/Vehicle\s+(?:Expenses?|Mileage|Deduction)/gi, 'vehicle_expenses', 'step'],
  [/Solo\s+401\s*\(?\s*k\s*\)?/gi, 'se_retirement', 'step'],
  [/SEP[- ]?IRA/gi, 'se_retirement', 'step'],
  [/(?:SE|Self[- ]?Employment)\s+Retirement/gi, 'se_retirement', 'step'],
  [/SE\s+Health\s+Insurance/gi, 'se_health_insurance', 'step'],
  [/Cost\s+of\s+Goods(?:\s+Sold)?/gi, 'cost_of_goods_sold', 'step'],
  [/Depreciation\s+(?:Assets?|Equipment)/gi, 'depreciation_assets', 'step'],

  // ═══════════════════════════════════════════════════════
  // DEDUCTIONS — longer phrases first
  // ═══════════════════════════════════════════════════════
  [/HSA\s+(?:Contributions?|Over[- ]?Contribution|Correction)/gi, 'hsa_contributions', 'step'],
  [/HSA\s+Distributions?/gi, '1099sa_income', 'step'],
  [/\bHSA\b/g, 'hsa_contributions', 'step'],
  [/Student\s+Loan\s+(?:Interest|Deduction)/gi, 'student_loan_ded', 'step'],
  [/Mortgage\s+Interest/gi, 'mortgage_interest_ded', 'step'],
  [/Medical\s+(?:Expenses?|Deduction)/gi, 'medical_expenses', 'step'],
  [/Charitable\s+(?:Donations?|Deductions?|Contributions?)/gi, 'charitable_deduction', 'step'],
  [/Gambling\s+Losses/gi, 'gambling_losses_ded', 'step'],
  [/(?:Traditional\s+)?IRA\s+(?:Contributions?|Deduction)/gi, 'ira_contribution_ded', 'step'],
  [/Educator\s+Expenses?/gi, 'educator_expenses_ded', 'step'],
  [/Estimated\s+(?:Tax\s+)?Payments?/gi, 'estimated_payments', 'step'],
  [/Investment\s+Interest/gi, 'investment_interest', 'step'],
  [/Roth\s+Conversion/gi, 'form8606', 'step'],
  [/Household\s+Employees?/gi, 'schedule_h', 'step'],
  [/NOL\s+Carryforward/gi, 'nol_carryforward', 'step'],
  [/Alimony\s+Paid/gi, 'alimony_paid', 'step'],
  [/Archer\s+MSA/gi, 'archer_msa', 'step'],
  [/Excess\s+Contributions?/gi, 'form5329', 'step'],
  [/[Tt]ips\s*(?:\/|&|and)\s*[Oo]vertime/g, 'schedule1a', 'step'],

  // SALT
  [/SALT\s+(?:Deduction|Cap|Limit)/gi, 'salt_deduction', 'step'],
  [/\bSALT\s+cap\b/gi, 'salt_deduction', 'step'],
  [/State\s+(?:&|and)\s+Local\s+Tax(?:es)?/gi, 'salt_deduction', 'step'],

  // Itemized
  [/Itemized\s+(?:Deductions?|Summary)/gi, 'itemized_deductions', 'step'],
  [/Standard\s+Deduction/gi, 'deduction_method', 'step'],
  [/Deduction\s+Method/gi, 'deduction_method', 'step'],

  // QBI / Passive / AMT
  [/QBI\s+(?:Detail|Deduction)/gi, 'qbi_detail', 'step'],
  [/Qualified\s+Business\s+Income/gi, 'qbi_detail', 'step'],
  [/Passive\s+(?:Loss(?:es)?|Activit(?:y|ies))/gi, 'form8582_data', 'step'],
  [/AMT\s+(?:Adjustments?|Data|Review)/gi, 'amt_data', 'step'],
  [/Alternative\s+Minimum\s+Tax/gi, 'amt_data', 'step'],
  [/Bad\s+Debt/gi, 'bad_debt', 'step'],
  [/Casualty\s+(?:Loss(?:es)?|Theft)/gi, 'casualty_loss', 'step'],

  // ═══════════════════════════════════════════════════════
  // CREDITS — longer phrases first
  // ═══════════════════════════════════════════════════════
  [/Child\s+Tax\s+Credit/gi, 'child_tax_credit', 'step'],
  [/Education\s+Credits?\s+\(AOTC\/LLC\)/gi, 'education_credits', 'step'],
  [/Education\s+Credits?/gi, 'education_credits', 'step'],
  [/(?:AOTC|American\s+Opportunity)/gi, 'education_credits', 'step'],
  [/Lifetime\s+Learning/gi, 'education_credits', 'step'],
  [/Dependent\s+Care/gi, 'dependent_care', 'step'],
  [/Saver'?s?\s+Credit/gi, 'savers_credit', 'step'],
  [/Clean\s+Energy\s+Credit/gi, 'clean_energy', 'step'],
  [/EV\s+(?:Charging|Refueling)\s+Credit/gi, 'ev_refueling', 'step'],
  [/(?:EV|Electric\s+Vehicle)\s+Credit/gi, 'ev_credit', 'step'],
  [/(?:Home\s+Improvement|Energy\s+Efficiency)\s+Credit/gi, 'energy_efficiency', 'step'],
  [/Adoption\s+Credit/gi, 'adoption_credit', 'step'],
  [/Premium\s+Tax\s+Credit/gi, 'premium_tax_credit', 'step'],
  [/Elderly\s*(?:\/|and|&)\s*Disabled\s+Credit/gi, 'elderly_disabled', 'step'],
  [/Prior\s+Year\s+AMT\s+Credit/gi, 'prior_year_amt_credit', 'step'],
  [/Foreign\s+Tax\s+Credits?/gi, 'foreign_tax_credit', 'step'],

  // ═══════════════════════════════════════════════════════
  // SCHEDULES & FORMS (standalone)
  // ═══════════════════════════════════════════════════════
  [/Schedule\s+F\b/gi, 'schedule_f', 'step'],
  [/Schedule\s+E\b/gi, 'rental_income', 'step'],
  [/Schedule\s+H\b/gi, 'schedule_h', 'step'],
  [/Form\s+8606\b/gi, 'form8606', 'step'],
  [/Form\s+5329\b/gi, 'form5329', 'step'],
  [/Form\s+4797\b/gi, 'form4797', 'step'],
  [/Form\s+6252\b/gi, 'installment_sale', 'step'],
  [/Form\s+8582\b/gi, 'form8582_data', 'step'],
  [/Form\s+2555\b/gi, 'foreign_earned_income', 'step'],
  [/Form\s+8283\b/gi, 'charitable_deduction', 'step'],
  [/Form\s+8889\b/gi, 'hsa_contributions', 'step'],

  // Standalone "Vehicle" — placed after credits to avoid matching inside "Electric Vehicle Credit"
  [/\bVehicle\b/gi, 'vehicle_expenses', 'step'],

  // ═══════════════════════════════════════════════════════
  // MY INFO
  // ═══════════════════════════════════════════════════════
  [/\bDependents?\b/gi, 'dependents', 'step'],
  [/Filing\s+Status/gi, 'filing_status', 'step'],
  [/Personal\s+Info(?:rmation)?/gi, 'personal_info', 'step'],

  // ═══════════════════════════════════════════════════════
  // REVIEW / FINISH
  // ═══════════════════════════════════════════════════════
  [/Warnings?\s+(?:Panel|to\s+Review)/gi, 'tax_summary', 'step'],
  [/Tax\s+Summary/gi, 'tax_summary', 'step'],
  [/Explain\s+(?:My\s+)?Taxes/gi, 'explain_taxes', 'step'],
  [/Form\s+1040\s+Review/gi, 'review_form_1040', 'step'],
  [/Refund\s+(?:&|and)\s+Payment/gi, 'refund_payment', 'step'],
  [/Filing\s+Instructions/gi, 'filing_instructions', 'step'],
  [/Export\s+(?:&|and)\s+PDF/gi, 'export_pdf', 'step'],
  [/Import\s+Data/gi, 'import_data', 'step'],
];

/**
 * Inject navigation links into a chat message for recognized references.
 * Links every occurrence so users can click any reference.
 *
 * Uses fragment URLs (#step--id / #tool--id) so rehype-sanitize never strips them.
 */
export function injectStepLinks(message: string): string {
  let result = message;

  for (const [pattern, targetId, type] of LINK_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;
    const prefix = type === 'tool' ? TOOL_LINK_PREFIX : STEP_LINK_PREFIX;

    // Collect all non-overlapping matches (working backwards to preserve indices)
    const matches: { index: number; text: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(result)) !== null) {
      const idx = match.index;
      // Skip matches inside existing markdown links or inline code
      if (!isInsideMarkdownLink(result, idx) && !isInsideInlineCode(result, idx)) {
        matches.push({ index: idx, text: match[0] });
      }
    }

    // Replace in reverse order to preserve earlier indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const { index: mIdx, text: mText } = matches[i];
      const before = result.slice(0, mIdx);
      const after = result.slice(mIdx + mText.length);
      result = `${before}[${mText}](${prefix}${targetId})${after}`;
    }
  }

  return result;
}

/** Check if position is inside an existing markdown link [...](...)  */
function isInsideMarkdownLink(text: string, pos: number): boolean {
  const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
  let m;
  while ((m = linkRegex.exec(text)) !== null) {
    if (pos >= m.index && pos < m.index + m[0].length) return true;
  }
  return false;
}

/** Check if position is inside inline code `...` */
function isInsideInlineCode(text: string, pos: number): boolean {
  const codeRegex = /`[^`]+`/g;
  let m;
  while ((m = codeRegex.exec(text)) !== null) {
    if (pos >= m.index && pos < m.index + m[0].length) return true;
  }
  return false;
}
