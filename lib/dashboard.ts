import { listApprovals } from '@/lib/db';
import { getChangeDetail, listChanges } from '@/lib/openspec';
import { collectTaskProgress, parseTaskSections } from '@/lib/task-parser';
import type { ApprovalRecord, ChangeDetail, ChangeSummary, DashboardActivity, DashboardData, DashboardTaskSummary } from '@/lib/types';

const MAX_ACTIVITY_ITEMS = 20;

function toTaskSummary(change: ChangeSummary, detail: ChangeDetail | null): DashboardTaskSummary {
  const tasksArtifact = detail?.artifacts.find((artifact) => artifact.type === 'tasks');
  const sections = tasksArtifact ? parseTaskSections(tasksArtifact.content) : [];
  const progress = collectTaskProgress(sections);

  return {
    changeId: change.id,
    changeTitle: change.title,
    updatedAt: change.updatedAt,
    sections,
    ...progress,
  };
}

function inProgressChanges(taskSummaries: DashboardTaskSummary[]): number {
  return taskSummaries.filter((summary) => summary.total === 0 || summary.completed < summary.total).length;
}

function taskTotals(taskSummaries: DashboardTaskSummary[]): { total: number; completed: number } {
  return taskSummaries.reduce(
    (acc, summary) => {
      acc.total += summary.total;
      acc.completed += summary.completed;
      return acc;
    },
    { total: 0, completed: 0 }
  );
}

function toActivityFromApprovals(approvals: ApprovalRecord[]): DashboardActivity[] {
  return approvals.map((approval) => ({
    id: `approval:${approval.id}`,
    projectId: approval.projectId,
    type: 'approval_created',
    message: `${approval.reviewer} set ${approval.decision} on ${approval.changeId} (${approval.artifactType})`,
    createdAt: approval.createdAt,
    changeId: approval.changeId,
    status: approval.syncStatus,
  }));
}

function toActivityFromChanges(projectId: string, changes: ChangeSummary[]): DashboardActivity[] {
  return changes.map((change) => ({
    id: `change:${change.id}:${change.updatedAt}`,
    projectId,
    type: 'artifact_updated',
    message: `Artifacts updated for ${change.title}`,
    createdAt: change.updatedAt,
    changeId: change.id,
  }));
}

function sortRecent(activities: DashboardActivity[]): DashboardActivity[] {
  return [...activities]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_ACTIVITY_ITEMS);
}

export function buildDashboardData(
  projectId: string,
  changes: ChangeSummary[],
  changeDetails: Array<ChangeDetail | null>,
  approvals: ApprovalRecord[]
): DashboardData {
  const detailsById = new Map(
    changeDetails
      .filter((detail): detail is ChangeDetail => detail !== null)
      .map((detail) => [detail.id, detail] as const)
  );
  const taskSummaries = changes.map((change) => toTaskSummary(change, detailsById.get(change.id) ?? null));
  const totals = taskTotals(taskSummaries);
  const completionPercentage = totals.total === 0 ? 0 : Math.round((totals.completed / totals.total) * 100);

  return {
    projectId,
    overview: {
      totalChanges: changes.length,
      inProgressChanges: inProgressChanges(taskSummaries),
      totalTasks: totals.total,
      completedTasks: totals.completed,
      total: totals.total,
      completed: totals.completed,
      completionPercentage,
    },
    tasks: taskSummaries,
    recentActivity: sortRecent([...toActivityFromApprovals(approvals), ...toActivityFromChanges(projectId, changes)]),
  };
}

export function loadDashboardData(projectId: string): DashboardData {
  const changes = listChanges(projectId);
  const details = changes.map((change) => getChangeDetail(projectId, change.id));
  const approvals = listApprovals(projectId);
  return buildDashboardData(projectId, changes, details, approvals);
}
