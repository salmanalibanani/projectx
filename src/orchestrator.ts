import type {
  ApprovalGate,
  IssueDraft,
  OrchestratorResult,
  Phase,
  RequirementsDraft,
  Task,
} from "./types.js";

const workItemId = "theskeleton-google-login";

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
  workItemId,
  title: "Build TheSkeleton Google login authentication",
  labels: ["app:theskeleton", "type:feature", "status:planned"],
  body: [
    "<!-- projectx",
    `workItemId: ${workItemId}`,
    "targetApp: TheSkeleton",
    "artifactType: implementation-issue",
    "-->",
    "",
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
  const requirementsDraft: RequirementsDraft = {
    workItemId,
    title: "TheSkeleton Google login requirements draft",
    sourceRequest: request,
    targetAppName: "TheSkeleton",
    status: "draft",
    sections: [
      {
        title: "Background",
        content: [
          "ProjectX is the automation system, and TheSkeleton is the first app it will eventually build.",
          "This stage creates a deterministic requirements draft that a human can review before ProjectX proceeds.",
        ],
      },
      {
        title: "Problem statement",
        content: [
          "TheSkeleton needs a clearly reviewed requirements baseline for Google/Gmail login before implementation planning moves forward.",
        ],
      },
      {
        title: "Goals",
        content: [
          "Define the initial product requirements for TheSkeleton.",
          "Keep the requirements deterministic, reviewable, and simple.",
          "Prepare for later implementation issue generation after human approval.",
        ],
      },
      {
        title: "Functional requirements",
        content: [
          "The system should define TheSkeleton as a React app.",
          "The system should define Google/Gmail sign-in as the only authentication method.",
          "The system should define that authenticated state can be displayed in the UI.",
          "The system should define that the user can sign out.",
        ],
      },
      {
        title: "Non-functional requirements",
        content: [
          "ProjectX output should remain deterministic for the same request.",
          "ProjectX should keep a local markdown artifact for human review.",
          "ProjectX should not require external API calls to generate the requirements draft.",
        ],
      },
      {
        title: "Out of scope",
        content: [
          "Creating TheSkeleton in this milestone.",
          "Implementing Google login in this milestone.",
          "Calling the OpenAI API.",
          "Adding more GitHub behavior in this milestone.",
        ],
      },
      {
        title: "Open questions",
        content: [
          "Should TheSkeleton show a signed-out landing view before login?",
          "Should any user profile fields beyond basic auth state be displayed in the UI?",
          "What repository workflow should ProjectX follow after human approval is granted?",
        ],
      },
      {
        title: "Approval checklist",
        content: [
          "- [ ] Requirements reviewed by human",
          "- [ ] Scope confirmed",
          "- [ ] Out-of-scope items confirmed",
          "- [ ] Approval given to generate implementation issue",
        ],
      },
    ],
  };

  return {
    workItemId,
    request,
    systemName: "ProjectX",
    targetAppName: "TheSkeleton",
    goal: "Plan the creation of TheSkeleton, a React app with Google login authentication, while keeping ProjectX simple and deterministic.",
    phases,
    approvalGates,
    requirementsDraft,
    issueDraft,
    generatedFiles: [
      "output/requirements/theskeleton-google-login.requirements.md",
      "output/issues/theskeleton-google-login.md",
    ],
    githubIssue: {
      created: false,
    },
    nextRecommendedAction:
      "Review the plan and confirm the first safe task: clarify requirements and draft the initial GitHub issue.",
  };
}
