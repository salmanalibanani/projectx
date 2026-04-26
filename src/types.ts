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
  workItemId: string;
  title: string;
  body: string;
  labels: string[];
};

export type RequirementsSection = {
  title: string;
  content: string[];
};

export type RequirementsStatus = "draft" | "approved";

export type RequirementsDraft = {
  workItemId: string;
  title: string;
  sourceRequest: string;
  targetAppName: string;
  status: RequirementsStatus;
  sections: RequirementsSection[];
};

export type ImplementationPlan = {
  workItemId: string;
  title: string;
  sourceRequirementsFile: string;
  status: "draft";
  targetAppName: string;
  sections: RequirementsSection[];
};

export type GitHubIssueResult = {
  created: boolean;
  existing?: boolean;
  url?: string;
  number?: number;
  error?: string;
};

export type OrchestratorResult = {
  workItemId: string;
  systemName: string;
  targetAppName: string;
  request: string;
  goal: string;
  phases: Phase[];
  approvalGates: ApprovalGate[];
  requirementsDraft: RequirementsDraft;
  implementationPlan: ImplementationPlan;
  issueDraft: IssueDraft;
  generatedFiles: string[];
  githubIssue: GitHubIssueResult;
  nextRecommendedAction: string;
};
