/**
 * Year-over-Year Comparison — standalone tool view.
 *
 * Wraps the existing YoYComparisonCard component in a full-page layout
 * so it can be accessed from the sidebar at any point in the workflow.
 */

import { useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateForm1040, FilingStatus } from '@telostax/engine';
import YoYComparisonCard from '../common/YoYComparisonCard';
import SectionIntro from '../common/SectionIntro';
import ToolViewWrapper from './ToolViewWrapper';
import { History } from 'lucide-react';

export default function YoYComparisonToolView() {
  const { taxReturn } = useTaxReturnStore();

  const result = useMemo(() => {
    if (!taxReturn) return null;
    return calculateForm1040({
      ...taxReturn,
      filingStatus: taxReturn.filingStatus || FilingStatus.Single,
    });
  }, [taxReturn]);

  if (!taxReturn || !result) return null;

  return (
    <ToolViewWrapper>
      <SectionIntro
        icon={<History className="w-8 h-8" />}
        title="Year-over-Year Comparison"
        description="Compare your 2025 return against last year's to see what changed and why."
      />
      <YoYComparisonCard priorYear={taxReturn.priorYearSummary} current={result.form1040} />
    </ToolViewWrapper>
  );
}
