import { AlertCircle } from 'lucide-react';
import type { ValidationWarning } from '../../services/warningService';

interface ItemWarningBadgeProps {
  warnings?: ValidationWarning[];
}

/**
 * Amber warning badge for individual item cards.
 * Shows an AlertCircle icon when the item has validation warnings.
 * Hover tooltip displays the warning messages.
 *
 * Renders nothing when there are no warnings.
 */
export default function ItemWarningBadge({ warnings }: ItemWarningBadgeProps) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div
      className="p-1.5 text-amber-400 shrink-0"
      title={warnings.map((w) => w.message).join('\n')}
    >
      <AlertCircle className="w-4 h-4" />
    </div>
  );
}
