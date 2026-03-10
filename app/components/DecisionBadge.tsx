import type { ApprovalDecision } from '@/lib/types';

export function DecisionBadge({ decision }: { decision?: ApprovalDecision }): React.ReactElement {
  if (!decision) {
    return <span className="badge">no decision</span>;
  }

  return <span className={`badge ${decision}`}>{decision}</span>;
}
