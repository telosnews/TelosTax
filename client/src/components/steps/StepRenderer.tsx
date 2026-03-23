import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';

// ── Lazy Step Loading Skeleton ──────────────────────────────────
function StepSkeleton() {
  return (
    <div className="animate-pulse space-y-6 py-4">
      <div className="h-6 bg-slate-700/50 rounded w-48" />
      <div className="h-4 bg-slate-700/30 rounded w-72" />
      <div className="space-y-3 mt-8">
        <div className="h-10 bg-slate-700/20 rounded" />
        <div className="h-10 bg-slate-700/20 rounded" />
        <div className="h-10 bg-slate-700/20 rounded" />
      </div>
    </div>
  );
}

// ── Lazy Tool Components ────────────────────────────────────────
const TOOL_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  audit_risk: lazy(() => import('../tools/AuditRiskToolView')),
  explain_taxes: lazy(() => import('../tools/ExplainTaxesToolView')),
  yoy_comparison: lazy(() => import('../tools/YoYComparisonToolView')),
  tax_calendar: lazy(() => import('../tools/TaxCalendarToolView')),
  tax_scenario_lab: lazy(() => import('../scenarioLab/ScenarioLabToolView')),
  document_inventory: lazy(() => import('../tools/DocumentInventoryToolView')),
  expense_scanner: lazy(() => import('../tools/ExpenseScannerToolView')),
  file_extension: lazy(() => import('../tools/FileExtensionToolView')),
};

// ── Lazy Step Components ────────────────────────────────────────
const STEP_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  welcome: lazy(() => import('./WelcomeStep')),
  personal_info: lazy(() => import('./PersonalInfoStep')),
  encryption_setup: lazy(() => import('./EncryptionSetupStep')),
  filing_status: lazy(() => import('./FilingStatusStep')),
  dependents: lazy(() => import('./DependentsStep')),
  transition_income: lazy(() => import('./SectionTransitionStep')),
  transition_se: lazy(() => import('./SectionTransitionStep')),
  transition_deductions: lazy(() => import('./SectionTransitionStep')),
  transition_credits: lazy(() => import('./CreditsTransitionStep')),
  transition_state: lazy(() => import('./SectionTransitionStep')),
  transition_review: lazy(() => import('./SectionTransitionStep')),
  income_overview: lazy(() => import('./IncomeOverviewStep')),
  import_data: lazy(() => import('./ImportDataStep')),
  w2_income: lazy(() => import('./W2IncomeStep')),
  '1099nec_income': lazy(() => import('./NEC1099Step')),
  '1099k_income': lazy(() => import('./K1099Step')),
  '1099int_income': lazy(() => import('./INT1099Step')),
  '1099oid_income': lazy(() => import('./OID1099Step')),
  '1099div_income': lazy(() => import('./DIV1099Step')),
  '1099r_income': lazy(() => import('./R1099Step')),
  '1099g_income': lazy(() => import('./G1099Step')),
  '1099misc_income': lazy(() => import('./MISC1099Step')),
  '1099b_income': lazy(() => import('./B1099Step')),
  '1099da_income': lazy(() => import('./DA1099Step')),
  'ssa1099_income': lazy(() => import('./SSA1099Step')),
  'k1_income': lazy(() => import('./K1Step')),
  '1099sa_income': lazy(() => import('./HSADistributionStep')),
  'rental_income': lazy(() => import('./RentalPropertyStep')),
  'royalty_income': lazy(() => import('./RoyaltyIncomeStep')),
  'w2g_income': lazy(() => import('./W2GIncomeStep')),
  '1099c_income': lazy(() => import('./C1099Step')),
  '1099q_income': lazy(() => import('./Q1099Step')),
  'home_sale': lazy(() => import('./HomeSaleStep')),
  'foreign_earned_income': lazy(() => import('./ForeignEarnedIncomeStep')),
  'form4797': lazy(() => import('./Form4797Step')),
  'schedule_f': lazy(() => import('./ScheduleFStep')),
  'farm_rental': lazy(() => import('./FarmRentalStep')),
  'installment_sale': lazy(() => import('./InstallmentSaleStep')),
  other_income: lazy(() => import('./OtherIncomeStep')),
  income_summary: lazy(() => import('./IncomeSummaryStep')),
  business_info: lazy(() => import('./BusinessInfoStep')),
  expense_categories: lazy(() => import('./ExpenseCategoriesStep')),
  cost_of_goods_sold: lazy(() => import('./CostOfGoodsSoldStep')),
  home_office: lazy(() => import('./HomeOfficeStep')),
  vehicle_expenses: lazy(() => import('./VehicleExpensesStep')),
  depreciation_assets: lazy(() => import('./DepreciationAssetsStep')),
  se_summary: lazy(() => import('./SelfEmploymentSummaryStep')),
  deductions_discovery: lazy(() => import('./DeductionsOverviewStep')),
  deduction_method: lazy(() => import('./DeductionMethodStep')),
  medical_expenses: lazy(() => import('./MedicalExpensesStep')),
  salt_deduction: lazy(() => import('./SALTStep')),
  mortgage_interest_ded: lazy(() => import('./MortgageInterestStep')),
  charitable_deduction: lazy(() => import('./CharitableStep')),
  gambling_losses_ded: lazy(() => import('./GamblingLossesStep')),
  itemized_deductions: lazy(() => import('./ItemizedDeductionsStep')),
  hsa_contributions: lazy(() => import('./HSAStep')),
  archer_msa: lazy(() => import('./ArcherMSAStep')),
  student_loan_ded: lazy(() => import('./StudentLoanStep')),
  ira_contribution_ded: lazy(() => import('./IRAContributionStep')),
  educator_expenses_ded: lazy(() => import('./EducatorExpensesStep')),
  alimony_paid: lazy(() => import('./AlimonyPaidStep')),
  nol_carryforward: lazy(() => import('./NOLStep')),
  adjustments: lazy(() => import('./AdjustmentsStep')),
  estimated_payments: lazy(() => import('./EstimatedPaymentsStep')),
  credits_overview: lazy(() => import('./CreditsOverviewStep')),
  child_tax_credit: lazy(() => import('./ChildTaxCreditStep')),
  education_credits: lazy(() => import('./EducationCreditsStep')),
  dependent_care: lazy(() => import('./DependentCareStep')),
  savers_credit: lazy(() => import('./SaversCreditStep')),
  scholarship_credit: lazy(() => import('./ScholarshipCreditStep')),
  prior_year_amt_credit: lazy(() => import('./PriorYearAMTCreditStep')),
  clean_energy: lazy(() => import('./CleanEnergyStep')),
  ev_refueling: lazy(() => import('./EVRefuelingStep')),
  ev_credit: lazy(() => import('./EVCreditStep')),
  energy_efficiency: lazy(() => import('./EnergyEfficiencyStep')),
  adoption_credit: lazy(() => import('./AdoptionCreditStep')),
  premium_tax_credit: lazy(() => import('./PremiumTaxCreditStep')),
  elderly_disabled: lazy(() => import('./ScheduleRStep')),
  schedule1a: lazy(() => import('./Schedule1AStep')),
  investment_interest: lazy(() => import('./InvestmentInterestStep')),
  form8606: lazy(() => import('./Form8606Step')),
  schedule_h: lazy(() => import('./ScheduleHStep')),
  form5329: lazy(() => import('./Form5329Step')),
  bad_debt: lazy(() => import('./BadDebtStep')),
  casualty_loss: lazy(() => import('./CasualtyLossStep')),
  foreign_tax_credit: lazy(() => import('./ForeignTaxCreditStep')),
  credits_summary: lazy(() => import('./CreditsSummaryStep')),
  qbi_detail: lazy(() => import('./QBIDetailStep')),
  se_health_insurance: lazy(() => import('./SEHealthInsuranceStep')),
  se_retirement: lazy(() => import('./SERetirementStep')),
  deductions_summary: lazy(() => import('./DeductionsSummaryStep')),
  state_overview: lazy(() => import('./StateOverviewStep')),
  state_details: lazy(() => import('./StateDetailsStep')),
  state_review: lazy(() => import('./StateReviewStep')),
  amt_data: lazy(() => import('./AMTDataStep')),
  amt_review: lazy(() => import('./AMTStep')),
  form8582_data: lazy(() => import('./Form8582DataStep')),
  form8582_review: lazy(() => import('./Form8582Step')),
  review_schedule_c: lazy(() => import('./ReviewScheduleCStep')),
  review_form_1040: lazy(() => import('./ReviewForm1040Step')),
  tax_summary: lazy(() => import('./TaxSummaryStep')),
  explain_taxes: lazy(() => import('./ExplainTaxesStep')),
  refund_payment: lazy(() => import('./RefundPaymentStep')),
  filing_instructions: lazy(() => import('./FilingInstructionsStep')),
  export_pdf: lazy(() => import('./ExportPdfStep')),
};

// ── Error Boundary ────────────────────────────────────────────
// Catches render errors in any step/tool component so the app
// shows a recoverable fallback instead of a blank white screen.

interface EBProps { children: ReactNode; stepId: string }
interface EBState { hasError: boolean; error: Error | null }

class StepErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[StepErrorBoundary] Crash in step "${this.props.stepId}":`, error, info.componentStack);
  }

  componentDidUpdate(prevProps: EBProps) {
    // Auto-reset when the user navigates to a different step
    if (prevProps.stepId !== this.props.stepId && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card bg-red-500/10 border-red-500/30 text-center py-12 space-y-4">
          <h2 className="text-lg font-semibold text-red-400">Something went wrong on this step</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            An unexpected error occurred while rendering this page. Your data is safe — try going back or skipping ahead.
          </p>
          <pre className="text-xs text-red-300/70 mx-auto max-w-lg overflow-x-auto">
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-secondary text-sm"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main Renderer ─────────────────────────────────────────────

export default function StepRenderer() {
  const activeToolId = useTaxReturnStore((s) => s.activeToolId);
  const step = useTaxReturnStore((s) => s.getCurrentStep());

  const currentId = activeToolId ?? step?.id ?? 'unknown';

  // Show standalone tool view when active
  if (activeToolId) {
    const ToolComponent = TOOL_COMPONENTS[activeToolId];
    if (ToolComponent) {
      return (
        <StepErrorBoundary stepId={currentId}>
          <Suspense fallback={<StepSkeleton />}>
            <ToolComponent />
          </Suspense>
        </StepErrorBoundary>
      );
    }
  }

  if (!step) {
    return <div className="text-slate-400">No step found.</div>;
  }

  const StepComponent = STEP_COMPONENTS[step.id];
  if (!StepComponent) {
    return <div className="text-slate-400">Step "{step.id}" not implemented yet.</div>;
  }

  return (
    <StepErrorBoundary stepId={currentId}>
      <Suspense fallback={<StepSkeleton />}>
        <StepComponent />
      </Suspense>
    </StepErrorBoundary>
  );
}
