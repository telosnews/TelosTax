/**
 * Document Inventory — standalone tool view.
 *
 * Wraps the DocumentInventoryPanel in a full-page layout
 * so it can be accessed from the sidebar at any point in the workflow.
 */

import DocumentInventoryPanel from '../common/DocumentInventoryPanel';
import SectionIntro from '../common/SectionIntro';
import ToolViewWrapper from './ToolViewWrapper';
import { FolderOpen } from 'lucide-react';

export default function DocumentInventoryToolView() {
  return (
    <ToolViewWrapper>
      <SectionIntro
        icon={<FolderOpen className="w-8 h-8" />}
        title="Document Inventory"
        description="Everything you've entered, organized by form type. Check completeness and navigate to any section."
      />
      <DocumentInventoryPanel />
    </ToolViewWrapper>
  );
}
