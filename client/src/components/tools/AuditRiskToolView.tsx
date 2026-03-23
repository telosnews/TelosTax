/**
 * Audit Risk Assessment — standalone tool view.
 *
 * Wraps the existing AuditRiskCard component in a full-page layout
 * so it can be accessed from the sidebar at any point in the workflow.
 */

import AuditRiskCard from '../common/AuditRiskCard';
import SectionIntro from '../common/SectionIntro';
import ToolViewWrapper from './ToolViewWrapper';
import { Shield } from 'lucide-react';

export default function AuditRiskToolView() {
  return (
    <ToolViewWrapper>
      <SectionIntro
        icon={<Shield className="w-8 h-8" />}
        title="Audit Risk Assessment"
        description="See how your return stacks up against common IRS audit triggers. This updates live as you enter data."
      />
      <AuditRiskCard alwaysOpen />
    </ToolViewWrapper>
  );
}
