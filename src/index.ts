import { readFile, stat } from "node:fs/promises";

import { generateAppScaffold } from "./appScaffold.js";
import { generateCodeWithOpenAI } from "./codeGeneration.js";
import {
  createGitHubIssue,
  createGitHubPullRequest,
  getMissingGitHubEnvVars,
} from "./githubClient.js";
import {
  ensureImplementationBranch,
  getCurrentBranch,
  isWorkingTreeClean,
  pushBranchToOrigin,
} from "./gitClient.js";
import { readImplementationPlanStatus } from "./implementationPlanApproval.js";
import { writeOrchestratorOutput, writeImplementationPlan, writeIssueDraft, writeRequirementsDraft } from "./outputWriter.js";
import { runOrchestrator } from "./orchestrator.js";
import { writePocSummary } from "./pocSummary.js";
import {
  BASE_BRANCH,
  IMPLEMENTATION_BRANCH,
  IMPLEMENTATION_PLAN_FILE_PATH,
  PR_SUMMARY_FILE_PATH,
  REQUIREMENTS_FILE_PATH,
  TARGET_APP_PATH,
} from "./projectxConfig.js";
import { draftPrSummary } from "./prSummary.js";
import { readPrSummaryStatus } from "./prSummaryApproval.js";
import { readRequirementsStatus } from "./requirementsApproval.js";
import { verifyApp, verifyAppScaffold } from "./scaffoldVerification.js";

const knownFlags = new Set([
  "--create-pr",
  "--generate-requirements",
  "--approve-requirements",
  "--create-github-issue",
  "--generate-implementation-plan",
  "--approve-implementation-plan",
  "--prepare-implementation",
  "--create-implementation-branch",
  "--scaffold-app",
  "--generate-app-scaffold",
  "--generate-code",
  "--verify-app",
  "--verify-app-scaffold",
  "--generate-pr-summary",
  "--draft-pr-summary",
  "--prepare-pr",
  "--push-implementation-branch",
  "--open-pr",
  "--poc-summary",
  "--run-all-safe-local",
]);

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function getUserRequest(args: string[]): string {
  return args.filter((arg) => !knownFlags.has(arg)).join(" ");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function refreshApprovalStatuses(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  try {
    result.requirementsDraft.status = await readRequirementsStatus(
      REQUIREMENTS_FILE_PATH,
    );
  } catch {
    result.requirementsDraft.status = "draft";
  }

  try {
    result.implementationPlan.status = await readImplementationPlanStatus(
      IMPLEMENTATION_PLAN_FILE_PATH,
    );
  } catch {
    result.implementationPlan.status = "draft";
  }
}

function hasExplicitFlags(args: string[]): boolean {
  return args.some((arg) => knownFlags.has(arg));
}

async function generateRequirements(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  await writeRequirementsDraft(result);
  await refreshApprovalStatuses(result);
}

async function generateImplementationPlan(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  await refreshApprovalStatuses(result);

  if (result.requirementsDraft.status !== "approved") {
    result.nextRecommendedAction =
      "Approve the requirements draft before generating the implementation plan artifact.";
    return;
  }

  await writeImplementationPlan(result);
  await refreshApprovalStatuses(result);
}

async function prepareImplementation(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  await refreshApprovalStatuses(result);

  if (result.implementationPlan.status !== "approved") {
    result.implementationPreparation = {
      ready: false,
      reason:
        "Implementation plan must be approved before preparing implementation.",
      planFile: IMPLEMENTATION_PLAN_FILE_PATH,
      requiredStatus: "approved",
      actualStatus: result.implementationPlan.status,
    };
    return;
  }

  result.implementationPreparation = {
    ready: true,
    reason:
      "Implementation plan is approved. ProjectX may proceed to branch creation.",
    planFile: IMPLEMENTATION_PLAN_FILE_PATH,
    requiredStatus: "approved",
    actualStatus: result.implementationPlan.status,
    proposedBranchName: IMPLEMENTATION_BRANCH,
  };
}

async function createImplementationBranch(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  await refreshApprovalStatuses(result);

  if (result.implementationPlan.status !== "approved") {
    const branchResult = {
      branchName: IMPLEMENTATION_BRANCH,
      created: false,
      existing: false,
      switched: false,
      error:
        "Implementation plan must be approved before creating implementation branch.",
    };
    result.implementationBranchResult = branchResult;
    return;
  }

  const branchResult = await ensureImplementationBranch(IMPLEMENTATION_BRANCH);
  result.implementationBranchResult = branchResult;
}

async function generateScaffold(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  await refreshApprovalStatuses(result);

  if (result.implementationPlan.status !== "approved") {
    result.appScaffold = {
      generated: false,
      appPath: TARGET_APP_PATH,
      files: [],
      error:
        "Implementation plan must be approved before generating app scaffold.",
    };
    return;
  }

  const currentBranch = await getCurrentBranch();

  if (currentBranch !== IMPLEMENTATION_BRANCH) {
    result.appScaffold = {
      generated: false,
      appPath: TARGET_APP_PATH,
      files: [],
      error: `App scaffold can only be generated on branch ${IMPLEMENTATION_BRANCH}.`,
    };
    return;
  }

  result.appScaffold = await generateAppScaffold();
}

async function generateCode(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  await refreshApprovalStatuses(result);

  if (result.implementationPlan.status !== "approved") {
    result.codeGeneration = {
      attempted: false,
      succeeded: false,
      logFile: "output/code/theskeleton-google-login.code-generation.md",
      filesChanged: [],
      refusedFiles: [],
      error: "Implementation plan must be approved before code generation.",
    };
    return;
  }

  const currentBranch = await getCurrentBranch();

  if (currentBranch !== IMPLEMENTATION_BRANCH) {
    result.codeGeneration = {
      attempted: false,
      succeeded: false,
      logFile: "output/code/theskeleton-google-login.code-generation.md",
      filesChanged: [],
      refusedFiles: [],
      error: `Code generation can only run on branch ${IMPLEMENTATION_BRANCH}.`,
    };
    return;
  }

  if (!(await fileExists(TARGET_APP_PATH))) {
    result.codeGeneration = {
      attempted: false,
      succeeded: false,
      logFile: "output/code/theskeleton-google-login.code-generation.md",
      filesChanged: [],
      refusedFiles: [],
      error: "App scaffold must exist before code generation.",
    };
    return;
  }

  result.codeGeneration = await generateCodeWithOpenAI();
}

async function verifyApplication(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  result.appVerification = await verifyApp();
  result.scaffoldVerification = await verifyAppScaffold();
}

async function draftPr(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  const currentBranch = await getCurrentBranch();

  if (currentBranch !== IMPLEMENTATION_BRANCH) {
    result.prSummary = {
      generated: false,
      file: PR_SUMMARY_FILE_PATH,
      path: PR_SUMMARY_FILE_PATH,
      sourceBranch: IMPLEMENTATION_BRANCH,
      baseBranch: BASE_BRANCH,
      error: `PR summary can only be drafted from branch ${IMPLEMENTATION_BRANCH}.`,
    };
    return;
  }

  if (!(await fileExists("output/verification/theskeleton-google-login.app-verification.md"))) {
    result.prSummary = {
      generated: false,
      file: PR_SUMMARY_FILE_PATH,
      path: PR_SUMMARY_FILE_PATH,
      sourceBranch: IMPLEMENTATION_BRANCH,
      baseBranch: BASE_BRANCH,
      error: "App verification artifact must exist before drafting PR summary.",
    };
    return;
  }

  result.prSummary = await draftPrSummary(result);
}

async function preparePr(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  try {
    const prSummaryStatus = await readPrSummaryStatus(PR_SUMMARY_FILE_PATH);

    result.prPreparation = {
      ready: prSummaryStatus === "approved",
      reason:
        prSummaryStatus === "approved"
          ? "PR summary is approved. ProjectX may proceed to branch push and PR creation."
          : "PR summary must be approved before preparing pull request.",
      prSummaryFile: PR_SUMMARY_FILE_PATH,
      requiredStatus: "approved",
      actualStatus: prSummaryStatus,
      sourceBranch: IMPLEMENTATION_BRANCH,
      baseBranch: BASE_BRANCH,
    };
  } catch {
    result.prPreparation = {
      ready: false,
      reason: "PR summary file does not exist.",
      prSummaryFile: PR_SUMMARY_FILE_PATH,
      requiredStatus: "approved",
      actualStatus: "draft",
    };
  }
}

async function pushImplementationBranch(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  try {
    const prSummaryStatus = await readPrSummaryStatus(PR_SUMMARY_FILE_PATH);

    if (prSummaryStatus !== "approved") {
      result.branchPush = {
        pushed: false,
        error:
          "PR summary must be approved before pushing implementation branch.",
        requiredStatus: "approved",
        actualStatus: prSummaryStatus,
      };
      return;
    }

    const currentBranch = await getCurrentBranch();

    if (currentBranch !== IMPLEMENTATION_BRANCH) {
      result.branchPush = {
        pushed: false,
        error: `Implementation branch can only be pushed from branch ${IMPLEMENTATION_BRANCH}.`,
      };
      return;
    }

    if (!(await isWorkingTreeClean())) {
      result.branchPush = {
        pushed: false,
        error:
          "Working tree must be clean before pushing implementation branch.",
      };
      return;
    }

    result.branchPush = await pushBranchToOrigin(IMPLEMENTATION_BRANCH);
  } catch {
    result.branchPush = {
      pushed: false,
      error: "PR summary must be approved before pushing implementation branch.",
      requiredStatus: "approved",
      actualStatus: "draft",
    };
  }
}

async function openPr(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  try {
    const prSummaryStatus = await readPrSummaryStatus(PR_SUMMARY_FILE_PATH);

    if (prSummaryStatus !== "approved") {
      result.pullRequest = {
        created: false,
        alreadyExists: false,
        sourceBranch: IMPLEMENTATION_BRANCH,
        headBranch: IMPLEMENTATION_BRANCH,
        baseBranch: BASE_BRANCH,
        error: "PR summary must be approved before opening pull request.",
      };
      return;
    }

    const currentBranch = await getCurrentBranch();

    if (currentBranch !== IMPLEMENTATION_BRANCH) {
      result.pullRequest = {
        created: false,
        alreadyExists: false,
        sourceBranch: IMPLEMENTATION_BRANCH,
        headBranch: IMPLEMENTATION_BRANCH,
        baseBranch: BASE_BRANCH,
        error: `Pull request can only be opened from branch ${IMPLEMENTATION_BRANCH}.`,
      };
      return;
    }

    if (!(await isWorkingTreeClean())) {
      result.pullRequest = {
        created: false,
        alreadyExists: false,
        sourceBranch: IMPLEMENTATION_BRANCH,
        headBranch: IMPLEMENTATION_BRANCH,
        baseBranch: BASE_BRANCH,
        error: "Working tree must be clean before opening pull request.",
      };
      return;
    }

    const missingEnvVars = getMissingGitHubEnvVars(process.env);

    if (missingEnvVars.length > 0) {
      result.pullRequest = {
        created: false,
        alreadyExists: false,
        sourceBranch: IMPLEMENTATION_BRANCH,
        headBranch: IMPLEMENTATION_BRANCH,
        baseBranch: BASE_BRANCH,
        error: `Missing required environment variables: ${missingEnvVars.join(", ")}`,
      };
      return;
    }

    if (!(await fileExists(PR_SUMMARY_FILE_PATH))) {
      result.pullRequest = {
        created: false,
        alreadyExists: false,
        sourceBranch: IMPLEMENTATION_BRANCH,
        headBranch: IMPLEMENTATION_BRANCH,
        baseBranch: BASE_BRANCH,
        error:
          "PR summary file does not exist. Run --generate-pr-summary first.",
      };
      return;
    }

    const prBody = await readFile(PR_SUMMARY_FILE_PATH, "utf8");
    result.pullRequest = await createGitHubPullRequest(
      result.issueDraft.title,
      prBody,
      IMPLEMENTATION_BRANCH,
      BASE_BRANCH,
    );
  } catch {
      result.pullRequest = {
        created: false,
        alreadyExists: false,
        sourceBranch: IMPLEMENTATION_BRANCH,
        headBranch: IMPLEMENTATION_BRANCH,
        baseBranch: BASE_BRANCH,
        error: "PR summary must be approved before opening pull request.",
      };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const userRequest = getUserRequest(args);

  if (!userRequest) {
    console.log("Please provide a request.");
    console.log(
      'Example: npm run dev -- "Build TheSkeleton app with Google login"',
    );
    process.exit(1);
  }

  const result = await runOrchestrator(userRequest);
  const shouldRunAllSafeLocal = hasFlag(args, "--run-all-safe-local");
  const shouldGenerateRequirements =
    hasFlag(args, "--generate-requirements") || shouldRunAllSafeLocal;
  const shouldCreateGitHubIssue = hasFlag(args, "--create-github-issue");
  const shouldGenerateImplementationPlan =
    hasFlag(args, "--generate-implementation-plan") || shouldRunAllSafeLocal;
  const shouldPrepareImplementation = hasFlag(args, "--prepare-implementation");
  const shouldCreateImplementationBranch = hasFlag(
    args,
    "--create-implementation-branch",
  );
  const shouldGenerateAppScaffold =
    hasFlag(args, "--generate-app-scaffold") ||
    hasFlag(args, "--scaffold-app") ||
    shouldRunAllSafeLocal;
  const shouldGenerateCode = hasFlag(args, "--generate-code");
  const shouldVerifyApp =
    hasFlag(args, "--verify-app") ||
    hasFlag(args, "--verify-app-scaffold") ||
    shouldRunAllSafeLocal;
  const shouldDraftPrSummary =
    hasFlag(args, "--draft-pr-summary") ||
    hasFlag(args, "--generate-pr-summary") ||
    shouldRunAllSafeLocal;
  const shouldPreparePr = hasFlag(args, "--prepare-pr");
  const shouldPushImplementationBranch = hasFlag(
    args,
    "--push-implementation-branch",
  );
  const shouldOpenPr = hasFlag(args, "--open-pr") || hasFlag(args, "--create-pr");
  const shouldWritePocSummary =
    hasFlag(args, "--poc-summary") || shouldRunAllSafeLocal;

  if (!hasExplicitFlags(args)) {
    await writeOrchestratorOutput(result);
    await refreshApprovalStatuses(result);
  }

  if (shouldGenerateRequirements) {
    await generateRequirements(result);
  }

  if (shouldCreateGitHubIssue) {
    await generateRequirements(result);

    if (result.requirementsDraft.status !== "approved") {
      result.githubIssue = {
        created: false,
        error: `Requirements must be approved before creating a GitHub issue. Review: ${REQUIREMENTS_FILE_PATH}`,
      };
    } else {
      await writeIssueDraft(result);
      result.githubIssue = await createGitHubIssue(result.issueDraft);
    }
  }

  if (shouldGenerateImplementationPlan) {
    await generateImplementationPlan(result);
  }

  if (shouldPrepareImplementation) {
    await prepareImplementation(result);
  }

  if (shouldCreateImplementationBranch) {
    await createImplementationBranch(result);
  }

  if (shouldGenerateAppScaffold) {
    await generateScaffold(result);
  }

  if (shouldGenerateCode) {
    await generateCode(result);
  }

  if (shouldVerifyApp) {
    await verifyApplication(result);
  }

  if (shouldDraftPrSummary) {
    await draftPr(result);
  }

  if (shouldPreparePr) {
    await preparePr(result);
  }

  if (shouldPushImplementationBranch) {
    await pushImplementationBranch(result);
  }

  if (shouldOpenPr) {
    await openPr(result);
  }

  if (shouldWritePocSummary) {
    result.pocSummary = await writePocSummary(result);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("ProjectX failed:", error);
  process.exit(1);
});
