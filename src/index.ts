import { readFile, stat } from "node:fs/promises";

import {
  createGitHubIssue,
  createGitHubPullRequest,
  getMissingGitHubEnvVars,
} from "./githubClient.js";
import { createGitHubRepository } from "./github/createRepo.js";
import {
  ensureImplementationBranch,
  getCurrentBranch,
  isWorkingTreeClean,
  pushBranchToOrigin,
} from "./gitClient.js";
import { readImplementationPlanStatus } from "./implementationPlanApproval.js";
import {
  writeOrchestratorOutput,
  writeImplementationPlan,
  writeIssueDraft,
  writeRequirementsDraft,
} from "./outputWriter.js";
import { runOrchestrator } from "./orchestrator.js";
import { writePocSummary } from "./pocSummary.js";
import {
  APP_VERIFICATION_FILE_PATH,
  BASE_BRANCH,
  IMPLEMENTATION_BRANCH,
  IMPLEMENTATION_PLAN_FILE_PATH,
  PR_SUMMARY_FILE_PATH,
  REQUIREMENTS_FILE_PATH,
} from "./projectxConfig.js";
import { draftPrSummary } from "./prSummary.js";
import { readPrSummaryStatus } from "./prSummaryApproval.js";
import { readRequirementsStatus } from "./requirementsApproval.js";

const knownFlags = new Set([
  "--create-pr",
  "--generate-requirements",
  "--approve-requirements",
  "--create-github-issue",
  "--generate-implementation-plan",
  "--approve-implementation-plan",
  "--prepare-implementation",
  "--create-implementation-branch",
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

async function refreshApprovalStatuses(
  result: Awaited<ReturnType<typeof runOrchestrator>>,
) {
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

async function generateRequirements(
  result: Awaited<ReturnType<typeof runOrchestrator>>,
) {
  await writeRequirementsDraft(result);
  await refreshApprovalStatuses(result);
}

async function generateImplementationPlan(
  result: Awaited<ReturnType<typeof runOrchestrator>>,
) {
  await refreshApprovalStatuses(result);

  if (result.requirementsDraft.status !== "approved") {
    result.nextRecommendedAction =
      "Approve the requirements draft before generating the implementation plan artifact.";
    return;
  }

  await writeImplementationPlan(result);
  await refreshApprovalStatuses(result);
}

async function prepareImplementation(
  result: Awaited<ReturnType<typeof runOrchestrator>>,
) {
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

async function createImplementationBranch(
  result: Awaited<ReturnType<typeof runOrchestrator>>,
) {
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

  if (!(await fileExists(APP_VERIFICATION_FILE_PATH))) {
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

async function pushImplementationBranch(
  result: Awaited<ReturnType<typeof runOrchestrator>>,
) {
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
      error:
        "PR summary must be approved before pushing implementation branch.",
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

function parseCreateRepoArgs(args: string[]) {
  const result = {
    repoName: undefined as string | undefined,
    isPublic: false,
    description: undefined as string | undefined,
    error: undefined as string | undefined,
  };

  if (args.length < 2) {
    result.error =
      'Usage: npm run dev -- create-repo <repo-name> [--public] [--description "text"]';
    return result;
  }

  result.repoName = args[1];

  for (let index = 2; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (arg === "--public") {
      result.isPublic = true;
      continue;
    }

    if (arg === "--description") {
      if (index + 1 >= args.length) {
        result.error = "--description requires a value.";
        return result;
      }

      result.description = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--description=")) {
      result.description = arg.slice("--description=".length);
      continue;
    }

    result.error = `Unknown option: ${arg}`;
    return result;
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "create-repo") {
    const { repoName, isPublic, description, error } =
      parseCreateRepoArgs(args);

    if (error || !repoName) {
      console.error(error ?? "Repository name is required.");
      process.exit(1);
    }

    console.log(`Creating GitHub repository: ${repoName}`);
    console.log(`Owner: ${process.env.GITHUB_OWNER ?? "<missing>"}`);
    console.log("");

    const result = await createGitHubRepository(repoName, {
      private: !isPublic,
      description,
    });

    if (!result.created) {
      if (result.alreadyExists) {
        console.error(`Repository may already exist: ${result.url}`);
        console.error(`Clone it locally with:`);
        console.error(
          `git clone https://github.com/${result.owner}/${result.repoName}.git`,
        );
        process.exit(1);
      }

      console.error(result.error ?? "Failed to create repository.");
      process.exit(1);
    }

    console.log("Repository created successfully.");
    console.log("");
    console.log("URL:");
    console.log(result.url);
    console.log("");
    console.log("Clone it locally with:");
    console.log(
      `git clone https://github.com/${result.owner}/${result.repoName}.git`,
    );
    process.exit(0);
  }

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
  const shouldGenerateAppScaffold = false;
  const shouldGenerateCode = false;
  const shouldVerifyApp = false;
  const shouldDraftPrSummary =
    hasFlag(args, "--draft-pr-summary") ||
    hasFlag(args, "--generate-pr-summary") ||
    shouldRunAllSafeLocal;
  const shouldPreparePr = hasFlag(args, "--prepare-pr");
  const shouldPushImplementationBranch = hasFlag(
    args,
    "--push-implementation-branch",
  );
  const shouldOpenPr =
    hasFlag(args, "--open-pr") || hasFlag(args, "--create-pr");
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
