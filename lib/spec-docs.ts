import type { Artifact, DashboardDocView } from '@/lib/types';

const VIEW_ORDER: DashboardDocView[] = ['proposal', 'requirements', 'design', 'tasks'];

function findArtifactForView(artifacts: Artifact[], view: DashboardDocView): Artifact | null {
  if (view === 'proposal') {
    return artifacts.find((a) => a.type === 'proposal') ?? null;
  }
  if (view === 'requirements') {
    return artifacts.find((a) => a.type === 'spec') ?? null;
  }
  if (view === 'design') {
    return artifacts.find((a) => a.type === 'design') ?? null;
  }
  return artifacts.find((a) => a.type === 'tasks') ?? null;
}

function isDocView(value: string): value is DashboardDocView {
  return VIEW_ORDER.includes(value as DashboardDocView);
}

export function resolveSpecDocumentView(
  artifacts: Artifact[],
  requestedView?: string
): { activeView: DashboardDocView; availableViews: DashboardDocView[]; activeArtifact: Artifact | null } {
  const availableViews = VIEW_ORDER.filter((view) => Boolean(findArtifactForView(artifacts, view)));
  const fallbackView = availableViews[0] ?? 'proposal';
  const candidate = requestedView?.trim().toLowerCase();
  const activeView = candidate && isDocView(candidate) && availableViews.includes(candidate) ? candidate : fallbackView;
  return {
    activeView,
    availableViews,
    activeArtifact: findArtifactForView(artifacts, activeView),
  };
}

export function artifactTypeForView(view: DashboardDocView): string {
  if (view === 'proposal') return 'proposal';
  if (view === 'requirements') return 'spec';
  if (view === 'design') return 'design';
  return 'tasks';
}

export function viewLabel(view: DashboardDocView): string {
  if (view === 'proposal') return 'Proposal';
  if (view === 'requirements') return 'Requirements';
  if (view === 'design') return 'Design';
  return 'Tasks';
}
