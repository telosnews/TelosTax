/**
 * Tax Calendar — standalone tool view.
 *
 * Wraps the existing TaxCalendarCard component in a full-page layout
 * so it can be accessed from the sidebar at any point in the workflow.
 */

import TaxCalendarCard from '../common/TaxCalendarCard';
import SectionIntro from '../common/SectionIntro';
import ToolViewWrapper from './ToolViewWrapper';
import { Calendar } from 'lucide-react';

export default function TaxCalendarToolView() {
  return (
    <ToolViewWrapper>
      <SectionIntro
        icon={<Calendar className="w-8 h-8" />}
        title="Tax Calendar"
        description="Key deadlines for your 2025 tax return — filing dates, contribution windows, and estimated payment due dates."
      />
      <TaxCalendarCard alwaysOpen />
    </ToolViewWrapper>
  );
}
