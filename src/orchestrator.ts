import type { ApprovalGate, OrchestratorResult, Phase, Task } from "./types.js";

const phases: Phase[] = [
  {
    id: "understanding",
    name: "Requirement understanding",
    description: "Translate the user request into a clear app and system plan.",
    tasks: [
      {
        id: "review-request",
        description:
          "Review the request and identify the target app and scope.",
      },
      {
        id: "define-goal",
        description: "Define the orchestration goal for ProjectX.",
      },
    ],
  },
  {
    id: "planning",
    name: "Planning",
    description:
      "Break the work into phases and tasks that ProjectX can execute.",
    tasks: [
      {
        id: "outline-workflow",
        description:
          "Outline the sequence of work from issue creation to release preparation.",
      },
      {
        id: "identify-approval-gates",
        description:
          "Identify where human approval is required before risky actions.",
      },
    ],
  },
  {
    id: "preparation",
    name: "Preparation",
    description:
      "Prepare for later implementation without taking external actions.",
    tasks: [
      {
        id: "draft-issue",
        description:
          "Draft what a GitHub issue and feature branch plan would look like.",
      },
      {
        id: "prepare-deliverables",
        description:
          "Prepare the list of deliverables and verification checkpoints.",
      },
    ],
  },
];

const approvalGates: ApprovalGate[] = [
  {
    id: "push-code",
    description:
      "Confirm before pushing major code changes to a shared branch.",
    reason: "Avoid making risky repository changes without human approval.",
  },
  {
    id: "deploy-staging",
    description: "Confirm before deploying to staging.",
    reason: "Staging deployment should only happen after review and approval.",
  },
  {
    id: "publish-release-notes",
    description:
      "Confirm before publishing release notes or social campaign drafts.",
    reason: "External communications require human review.",
  },
];

export async function runOrchestrator(
  request: string,
): Promise<OrchestratorResult> {
  return {
    request,
    systemName: "ProjectX",
    targetAppName: "TheSkeleton",
    goal: "Plan the creation of TheSkeleton, a React app with Google login authentication, while keeping ProjectX simple and deterministic.",
    phases,
    approvalGates,
    nextRecommendedAction:
      "Review the plan and confirm the first safe task: clarify requirements and draft the initial GitHub issue.",
  };
}
