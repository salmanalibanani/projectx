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
export type ImplementationPlanStatus = "draft" | "approved";
export type PrSummaryStatus = "draft" | "approved";
export type RepoMode = "monorepo";

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
  status: ImplementationPlanStatus;
  targetAppName: string;
  sections: RequirementsSection[];
};

export type ImplementationPreparationResult = {
  ready: boolean;
  reason: string;
  planFile: string;
  requiredStatus: "approved";
  actualStatus: ImplementationPlanStatus;
  proposedBranchName?: string;
};

export type ImplementationBranchResult = {
  branchName: string;
  created: boolean;
  existing: boolean;
  switched: boolean;
  error?: string;
};

export type AppScaffoldResult = {
  generated: boolean;
  appPath: string;
  files: string[];
  error?: string;
  conflicts?: string[];
};

export type ScaffoldVerificationResult = {
  verified: boolean;
  verificationFile: string;
  checkedFiles: string[];
  missingFiles: string[];
};

export type AppVerificationResult = {
  verified: boolean;
  verificationFile: string;
  checkedFiles: string[];
  missingFiles: string[];
  warnings: string[];
};

export type PrSummaryResult = {
  generated: boolean;
  file: string;
  path?: string;
  sourceBranch: string;
  baseBranch: string;
  error?: string;
};

export type PrPreparationResult = {
  ready: boolean;
  reason: string;
  prSummaryFile: string;
  requiredStatus: "approved";
  actualStatus: PrSummaryStatus;
  sourceBranch?: string;
  baseBranch?: string;
};

export type BranchPushResult = {
  pushed: boolean;
  branchName?: string;
  remote?: string;
  error?: string;
  requiredStatus?: "approved";
  actualStatus?: PrSummaryStatus;
};

export type PullRequestResult = {
  created: boolean;
  existing?: boolean;
  alreadyExists?: boolean;
  number?: number;
  url?: string;
  sourceBranch?: string;
  headBranch?: string;
  baseBranch?: string;
  error?: string;
};

export type GitHubIssueResult = {
  created: boolean;
  existing?: boolean;
  url?: string;
  number?: number;
  error?: string;
  warnings?: string[];
};

export type CodeGenerationResult = {
  attempted: boolean;
  succeeded: boolean;
  model?: string;
  logFile: string;
  filesChanged: string[];
  refusedFiles: string[];
  error?: string;
};

export type PocSummaryResult = {
  generated: boolean;
  file: string;
  error?: string;
};

export type OrchestratorResult = {
  workItemId: string;
  systemName: string;
  targetAppName: string;
  repoMode: RepoMode;
  targetAppPath: string;
  implementationBranch: string;
  baseBranch: string;
  request: string;
  goal: string;
  phases: Phase[];
  approvalGates: ApprovalGate[];
  requirementsDraft: RequirementsDraft;
  implementationPlan: ImplementationPlan;
  issueDraft: IssueDraft;
  generatedFiles: string[];
  githubIssue: GitHubIssueResult;
  implementationPreparation?: ImplementationPreparationResult;
  implementationBranchResult?: ImplementationBranchResult;
  appScaffold?: AppScaffoldResult;
  scaffoldVerification?: ScaffoldVerificationResult;
  appVerification?: AppVerificationResult;
  codeGeneration?: CodeGenerationResult;
  prSummary?: PrSummaryResult;
  prPreparation?: PrPreparationResult;
  branchPush?: BranchPushResult;
  pullRequest?: PullRequestResult;
  pocSummary?: PocSummaryResult;
  nextRecommendedAction: string;
};
