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
    "ProjectX should produce a deterministic plan for building TheSkeleton with Google login authentication without calling external APIs.",
    "",
    "## Goal",
    "Plan the creation of TheSkeleton Google login authentication in a way that is simple, reviewable, and deterministic.",
    "",
    "## Scope",
    "- Define the work needed to add Google login authentication to TheSkeleton.",
    "- Describe the expected deliverables and checkpoints before implementation and release preparation.",
    "- Capture human approval gates before risky repository, deployment, or communication actions.",
    "",
    "## Out of scope",
    "- Calling the GitHub API.",
    "- Calling the OpenAI API.",
    "- Implementing the authentication flow.",
    "- Deploying any environment.",
    "",
    "## Acceptance criteria",
    "- ProjectX returns a deterministic issue draft for this request.",
    '- The issue draft title is "Build TheSkeleton Google login authentication".',
    '- The issue draft labels include "app:theskeleton", "type:feature", and "status:planned".',
    "- The issue draft body includes Background, Goal, Scope, Out of scope, Acceptance criteria, and Approval gates.",
    "- The orchestrator output remains free of GitHub API and OpenAI API calls.",
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
