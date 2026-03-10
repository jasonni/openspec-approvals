export type ArtifactType = 'proposal' | 'design' | 'tasks' | 'spec';
export type ApprovalDecision = 'approve' | 'request_changes' | 'reject';

export interface Artifact {
  type: ArtifactType;
  path: string;
  content: string;
  headings: string[];
}

export interface ChangeSummary {
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
  changeId: string;
  artifactType: ArtifactType;
  decision: ApprovalDecision;
  comment: string;
  reviewer: string;
  createdAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface SearchHit {
  changeId: string;
  artifactType: ArtifactType;
  path: string;
  snippet: string;
  score: number;
  location: number;
}
