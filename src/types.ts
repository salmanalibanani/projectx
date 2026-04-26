export type Task = {
  id: string;
  description: string;
};

export type Phase = {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
};

export type ApprovalGate = {
  id: string;
  description: string;
  reason: string;
};

export type IssueDraft = {
  title: string;
  body: string;
  labels: string[];
};

export type GitHubIssueResult = {
  created: boolean;
  url?: string;
  number?: number;
  error?: string;
};

export type OrchestratorResult = {
  systemName: string;
  targetAppName: string;
  request: string;
  goal: string;
  phases: Phase[];
  approvalGates: ApprovalGate[];
  issueDraft: IssueDraft;
  generatedFiles: string[];
  githubIssue: GitHubIssueResult;
  nextRecommendedAction: string;
};
