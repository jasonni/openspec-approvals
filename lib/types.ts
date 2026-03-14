export type ArtifactType = 'proposal' | 'design' | 'tasks' | 'spec';
export type ApprovalDecision = 'approve' | 'request_changes' | 'reject';
export type ReviewSessionStatus = 'draft' | 'submitted';
export type CommentStatus = 'open' | 'resolved';

export interface Artifact {
  type: ArtifactType;
  path: string;
  content: string;
  headings: string[];
  /** For specs, the folder name (e.g., "otp-login"). Undefined for other artifact types. */
  specId?: string;
}

export interface ChangeSummary {
  projectId: string;
  id: string;
  title: string;
  path: string;
  updatedAt: string;
  artifactCount: number;
  decision?: ApprovalDecision;
}

export interface ChangeDetail extends ChangeSummary {
  artifacts: Artifact[];
}

export interface ApprovalRecord {
  id: string;
  projectId: string;
  changeId: string;
  artifactType: ArtifactType;
  decision: ApprovalDecision;
  comment: string;
  reviewer: string;
  createdAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface InlineComment {
  id: string;
  projectId: string;
  changeId: string;
  artifactType: ArtifactType;
  paragraphId: string;
  selectedText: string;
  author: string;
  body: string;
  parentId: string | null;
  status: CommentStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommentThread {
  root: InlineComment;
  replies: InlineComment[];
}

export interface ReviewSession {
  id: string;
  projectId: string;
  changeId: string;
  reviewer: string;
  status: ReviewSessionStatus;
  decision: ApprovalDecision | null;
  body: string;
  submittedAt: string | null;
  createdAt: string;
}

export interface SearchHit {
  projectId: string;
  changeId: string;
  artifactType: ArtifactType;
  path: string;
  snippet: string;
  score: number;
  location: number;
}

export type DashboardDocView = 'proposal' | 'requirements' | 'design' | 'tasks';

export type DashboardActivityType =
  | 'approval_created'
  | 'sync_status'
  | 'indexed'
  | 'artifact_updated'
  | 'connection_status';

export interface TaskProgress {
  total: number;
  completed: number;
  completionPercentage: number;
}

export interface TaskTreeNode extends TaskProgress {
  id: string;
  title: string;
  done: boolean;
  depth: number;
  children: TaskTreeNode[];
}

export interface TaskSection extends TaskProgress {
  id: string;
  title: string;
  tasks: TaskTreeNode[];
}

export interface DashboardTaskSummary extends TaskProgress {
  changeId: string;
  changeTitle: string;
  updatedAt: string;
  sections: TaskSection[];
}

export interface DashboardActivity extends Record<string, unknown> {
  id: string;
  projectId: string;
  type: DashboardActivityType;
  message: string;
  createdAt: string;
  changeId?: string;
  status?: 'connected' | 'disconnected' | 'reconnecting' | 'pending' | 'synced' | 'retrying' | 'failed';
}

export interface DashboardOverview extends TaskProgress {
  totalChanges: number;
  inProgressChanges: number;
  totalTasks: number;
  completedTasks: number;
}

export interface DashboardData {
  projectId: string;
  overview: DashboardOverview;
  tasks: DashboardTaskSummary[];
  recentActivity: DashboardActivity[];
}
