import type { LucideIcon } from 'lucide-react';
import { Calculator, Shield, History, Calendar, FileInput, Download, FlaskConical, FolderOpen, ScanSearch, Hourglass, Tag } from 'lucide-react';
import type { TaxReturn } from '@telostax/engine';

export interface SidebarTool {
  id: string;
  label: string;
  icon: LucideIcon;
  type: 'standalone' | 'navigate';
  /** Step ID to navigate to (only for type: 'navigate') */
  stepId?: string;
  /** Whether this tool requires minimum income data to be useful */
  needsData?: boolean;
  /** Search keywords for the command palette (Cmd+K) */
  keywords?: string[];
}

export const SIDEBAR_TOOLS: SidebarTool[] = [
  { id: 'explain_taxes', label: 'Explain My Taxes', icon: Calculator, type: 'standalone', needsData: true, keywords: ['explain', 'summary', 'breakdown', 'understand', 'why'] },
  { id: 'tax_scenario_lab', label: 'Tax Scenario Lab', icon: FlaskConical, type: 'standalone', needsData: true, keywords: ['scenario', 'compare', 'what-if', 'sensitivity'] },
  { id: 'audit_risk', label: 'Audit Risk', icon: Shield, type: 'standalone', needsData: true, keywords: ['audit', 'risk', 'red flag', 'irs audit', 'likelihood'] },
  { id: 'yoy_comparison', label: 'Year-over-Year', icon: History, type: 'standalone', keywords: ['year over year', 'yoy', 'compare', 'last year', 'prior year', 'history'] },
  { id: 'tax_calendar', label: 'Tax Calendar', icon: Calendar, type: 'standalone', keywords: ['calendar', 'deadlines', 'due dates', 'extension', 'april 15', 'quarterly'] },
  { id: 'expense_scanner', label: 'Expense Scanner', icon: ScanSearch, type: 'standalone', needsData: false, keywords: ['expense', 'scanner', 'deduction', 'finder', 'scan', 'bank', 'transactions', 'upload', 'categorize', 'smart'] },
  { id: 'donation_lookup', label: 'Donation Lookup', icon: Tag, type: 'navigate', stepId: 'charitable_deduction', keywords: ['donation', 'valuation', 'goodwill', 'salvation army', 'fair market value', 'noncash', 'charitable'] },
  { id: 'file_extension', label: 'File an Extension', icon: Hourglass, type: 'standalone', keywords: ['extension', '4868', 'deadline', 'more time', 'october'] },
  { id: 'import_data', label: 'Import Data', icon: FileInput, type: 'navigate', stepId: 'import_data', keywords: ['import', 'csv', 'upload'] },
  { id: 'export_pdf', label: 'Export / Download', icon: Download, type: 'navigate', stepId: 'export_pdf', keywords: ['export', 'download', 'pdf', 'print'] },
  { id: 'document_inventory', label: 'Document Inventory', icon: FolderOpen, type: 'standalone', needsData: false, keywords: ['binder', 'inventory', 'documents', 'forms', 'completeness', 'checklist'] },
];

/** Returns true when the return has at least one income source entered. */
export function hasMinimumIncomeData(taxReturn: TaxReturn | null): boolean {
  if (!taxReturn) return false;
  const disc = taxReturn.incomeDiscovery;
  if (disc && Object.values(disc).some((v) => v === 'yes')) return true;
  return (
    (taxReturn.w2Income?.length > 0) ||
    (taxReturn.income1099NEC?.length > 0) ||
    (taxReturn.income1099INT?.length > 0) ||
    (taxReturn.income1099DIV?.length > 0) ||
    (taxReturn.income1099B?.length > 0) ||
    (taxReturn.income1099R?.length > 0)
  );
}
