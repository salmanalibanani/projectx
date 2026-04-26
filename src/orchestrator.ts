import type {
  ApprovalGate,
  IssueDraft,
  OrchestratorResult,
  Phase,
  Task,
} from "./types.js";

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

const issueDraft: IssueDraft = {
  title: "Build TheSkeleton Google login authentication",
  labels: ["app:theskeleton", "type:feature", "status:planned"],
  body: [
    "## Background",
    "ProjectX is the automation system, and TheSkeleton is the first app it will eventually build.",
    "This milestone only drafts a deterministic GitHub issue for Google login authentication work without calling external APIs.",
    "",
    "## Goal",
    "Define a simple, deterministic issue draft for building TheSkeleton as a React app with Google/Gmail login authentication.",
    "",
    "## Scope",
    "- Define the planned work for TheSkeleton React app structure.",
    "- Define the planned work for Google/Gmail sign-in support.",
    "- Define the planned work for displaying auth state in the UI.",
    "- Define the planned work for sign-out support.",
    "- Capture approval gates before risky repository, deployment, or communication actions.",
    "",
    "## Out of scope",
    "- Calling the GitHub API.",
    "- Calling the OpenAI API.",
    "- Creating TheSkeleton in this milestone.",
    "- Implementing the authentication flow in this milestone.",
    "- Deploying any environment in this milestone.",
    "",
    "## Acceptance criteria",
    "- TheSkeleton has a React app structure.",
    "- User can sign in with a Google/Gmail account.",
    "- Auth state can be displayed in the UI.",
    "- User can sign out.",
    "- No production deployment happens without human approval.",
    "",
    "## Approval gates",
    ...approvalGates.map(
      (gate) => `- ${gate.id}: ${gate.description} Reason: ${gate.reason}`,
    ),
  ].join("\n"),
};

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
    issueDraft,
    nextRecommendedAction:
      "Review the plan and confirm the first safe task: clarify requirements and draft the initial GitHub issue.",
  };
}
