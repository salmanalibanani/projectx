import { readFile, stat } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import {
  createGitHubIssue,
  getGitHubIssueDetails,
  createGitHubPullRequest,
  getMissingGitHubEnvVars,
} from "./githubClient.js";
import { createGitHubRepository } from "./github/createRepo.js";
import { prepareCodeGenerationFromTicket } from "./codeGenerationPrep.js";
import { generateCodeFromTicket } from "./codeGenerator.js";
import {
  buildTicketBranchName,
  cloneTargetRepository,
  commitAllTargetRepoChanges,
  ensureImplementationBranch,
  getCurrentBranch,
  isWorkingTreeClean,
  prepareTargetRepoBranchFromTicket,
  pushTargetRepoBranchToOrigin,
  pushBranchToOrigin,
} from "./gitClient.js";
import {
  getTargetRepoSettingsFromEnv,
  loadEnvIntoProcessEnv,
  type TargetRepoSettings,
} from "./envConfig.js";
import { readImplementationPlanStatus } from "./implementationPlanApproval.js";
import { runInit } from "./init.js";
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
  ISSUE_FILE_PATH,
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

async function promptForIssueUrl(): Promise<string> {
  const rl = createInterface({ input, output });

  try {
    return (await rl.question("GitHub issue URL: ")).trim();
  } finally {
    rl.close();
  }
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

function printPlanningArtifactsGuidance(
  result: Awaited<ReturnType<typeof runOrchestrator>>,
) {
  console.log("");
  console.log("Generated planning artifacts:");
  console.log(`- Requirements draft: ${REQUIREMENTS_FILE_PATH}`);
  console.log(`- Implementation plan: ${IMPLEMENTATION_PLAN_FILE_PATH}`);
  console.log(`- Issue draft: ${ISSUE_FILE_PATH}`);
  console.log("");
  console.log("You can edit these markdown files directly.");
  console.log(
    "ProjectX will preserve your edits when the generated content would otherwise differ.",
  );
  console.log("");
  console.log("Review the requirements draft first.");
  console.log(
    `To approve it, open ${REQUIREMENTS_FILE_PATH} and change \`Status: draft\` to \`Status: approved\`.`,
  );
  console.log(
    'After you approve the requirements, create the GitHub issue with: `npm run dev -- "<your requirement>" --create-github-issue`',
  );
  console.log(
    "ProjectX will then create the issue on GitHub and print the issue URL.",
  );
}

function printGitHubIssueGuidance(
  result: Awaited<ReturnType<typeof runOrchestrator>>,
) {
  console.log("");

  if (!result.githubIssue.created && !result.githubIssue.existing) {
    console.log(
      result.githubIssue.error ?? "GitHub issue was not created.",
    );
    return;
  }

  if (result.githubIssue.existing) {
    console.log("GitHub issue already exists.");
  } else {
    console.log("GitHub issue created successfully.");
  }

  if (result.githubIssue.url) {
    console.log(`Issue URL: ${result.githubIssue.url}`);
  }

  if (result.githubIssue.number !== undefined) {
    console.log(`Issue number: #${result.githubIssue.number}`);
  }

  if (result.githubIssue.warnings && result.githubIssue.warnings.length > 0) {
    for (const warning of result.githubIssue.warnings) {
      console.log(`Warning: ${warning}`);
    }
  }

  console.log("");
  console.log(
    `If you need to update the drafted local issue artifact first, edit ${ISSUE_FILE_PATH}.`,
  );
  console.log(
    'Next, review or generate the implementation plan with: `npm run dev -- "<your requirement>" --generate-implementation-plan`',
  );
}

function normalizeRepoUrl(repoUrl: string): string {
  return repoUrl.replace(/\.git$/u, "").replace(/\/$/u, "").toLowerCase();
}

function ensureIssueMatchesTargetRepo(
  issueOwner: string,
  issueRepo: string,
  targetRepoSettings: TargetRepoSettings,
): string | null {
  const expectedRepoUrl = `https://github.com/${issueOwner}/${issueRepo}`;

  if (normalizeRepoUrl(targetRepoSettings.repoUrl) !== normalizeRepoUrl(expectedRepoUrl)) {
    return `Issue repo does not match configured target repo. Configured: ${targetRepoSettings.repoUrl} Issue repo: ${expectedRepoUrl}`;
  }

  return null;
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
  await loadEnvIntoProcessEnv();

  const args = process.argv.slice(2);

  if (args[0] === "init") {
    await runInit(process.cwd());
    process.exit(0);
  }

  if (args[0] === "implement-ticket") {
    const issueUrl = args[1] && args[1] !== "" ? args[1] : await promptForIssueUrl();
    const targetRepoSettings = getTargetRepoSettingsFromEnv();

    if (Array.isArray(targetRepoSettings)) {
      console.error(
        `Missing required target repo configuration: ${targetRepoSettings.join(", ")}`,
      );
      console.error("Run `npm run dev -- init` first.");
      process.exit(1);
    }

    const issueDetails = await getGitHubIssueDetails(issueUrl);

    if (!issueDetails.found || !issueDetails.owner || !issueDetails.repo || !issueDetails.number || !issueDetails.title) {
      console.error(issueDetails.error ?? "GitHub issue could not be loaded.");
      process.exit(1);
    }

    const repoMatchError = ensureIssueMatchesTargetRepo(
      issueDetails.owner,
      issueDetails.repo,
      targetRepoSettings,
    );

    if (repoMatchError) {
      console.error(repoMatchError);
      process.exit(1);
    }

    const cloneResult = await cloneTargetRepository(
      targetRepoSettings.repoUrl,
      targetRepoSettings.repoPath,
      targetRepoSettings.baseBranch,
      targetRepoSettings.token,
    );

    if (!cloneResult.cloned) {
      console.error(cloneResult.error ?? "Failed to prepare target repo clone.");
      process.exit(1);
    }

    const branchResult = await prepareTargetRepoBranchFromTicket(
      targetRepoSettings.repoPath,
      targetRepoSettings.baseBranch,
      issueDetails.number,
      issueDetails.title,
      targetRepoSettings.token,
    );

    if (!branchResult.ready) {
      console.error(branchResult.error ?? "Failed to prepare the ticket branch.");
      process.exit(1);
    }

    console.log("Ticket implementation workspace is ready.");
    console.log(`Issue: ${issueDetails.url ?? issueUrl}`);
    console.log(`Branch: ${branchResult.branchName}`);
    console.log(`Target repo path: ${branchResult.path}`);
    console.log("");
    console.log(
      "This branch name was generated from the GitHub issue title so the local implementation work stays tied to the requirement.",
    );
    console.log(
      "ProjectX has prepared the local branch, but it has not committed anything yet.",
    );
    console.log("Implement the required code changes in that target repo branch.");
    console.log("");
    console.log(
      `Next kickoff step for code generation: npm run dev -- generate-code-from-ticket ${issueDetails.url ?? issueUrl}`,
    );
    console.log(
      `After code is generated and tested locally, create the PR with: npm run dev -- create-ticket-pr ${issueDetails.url ?? issueUrl}`,
    );
    process.exit(0);
  }

  if (args[0] === "generate-code-from-ticket") {
    const issueUrl = args[1] && args[1] !== "" ? args[1] : await promptForIssueUrl();
    const targetRepoSettings = getTargetRepoSettingsFromEnv();

    if (Array.isArray(targetRepoSettings)) {
      console.error(
        `Missing required target repo configuration: ${targetRepoSettings.join(", ")}`,
      );
      console.error("Run `npm run dev -- init` first.");
      process.exit(1);
    }

    const issueDetails = await getGitHubIssueDetails(issueUrl);

    if (
      !issueDetails.found ||
      !issueDetails.owner ||
      !issueDetails.repo ||
      !issueDetails.number ||
      !issueDetails.title ||
      !issueDetails.url
    ) {
      console.error(issueDetails.error ?? "GitHub issue could not be loaded.");
      process.exit(1);
    }

    const repoMatchError = ensureIssueMatchesTargetRepo(
      issueDetails.owner,
      issueDetails.repo,
      targetRepoSettings,
    );

    if (repoMatchError) {
      console.error(repoMatchError);
      process.exit(1);
    }

    const preparationResult = await prepareCodeGenerationFromTicket(
      issueDetails,
      targetRepoSettings,
    );

    if (!preparationResult.ready) {
      console.error(
        preparationResult.error ?? "Code generation preparation failed.",
      );
      process.exit(1);
    }

    console.log("Code generation kickoff is ready.");
    console.log(`Issue: ${preparationResult.issueUrl}`);
    console.log(`Branch: ${preparationResult.branchName}`);
    console.log(`Target repo path: ${preparationResult.repoPath}`);
    console.log(`Preparation log: ${preparationResult.logFile}`);
    console.log("");
    const codeGenerationResult = await generateCodeFromTicket(
      preparationResult,
      targetRepoSettings.openAiApiKey,
      targetRepoSettings.openAiModel,
    );

    if (!codeGenerationResult.succeeded) {
      console.error(
        codeGenerationResult.error ?? "Code generation failed.",
      );
      if (codeGenerationResult.logFile) {
        console.error(`Code generation log: ${codeGenerationResult.logFile}`);
      }
      process.exit(1);
    }

    console.log(`Model: ${codeGenerationResult.model ?? "unknown"}`);
    console.log(`Code generation log: ${codeGenerationResult.logFile}`);
    console.log("");
    console.log("Code generation completed locally on the prepared branch.");
    if (codeGenerationResult.filesChanged.length > 0) {
      console.log("Files changed:");
      for (const filePath of codeGenerationResult.filesChanged) {
        console.log(`- ${filePath}`);
      }
    }
    if (codeGenerationResult.refusedFiles.length > 0) {
      console.log("Files not changed by the model:");
      for (const filePath of codeGenerationResult.refusedFiles) {
        console.log(`- ${filePath}`);
      }
    }
    console.log("");
    console.log("Next steps:");
    console.log(`- Review the local changes in ${preparationResult.repoPath}`);
    console.log("- Run the target repo's build/tests manually.");
    console.log(
      `- When testing is complete, create the PR with: npm run dev -- create-ticket-pr ${preparationResult.issueUrl}`,
    );
    process.exit(0);
  }

  if (args[0] === "create-ticket-pr") {
    const issueUrl = args[1] && args[1] !== "" ? args[1] : await promptForIssueUrl();
    const targetRepoSettings = getTargetRepoSettingsFromEnv();

    if (Array.isArray(targetRepoSettings)) {
      console.error(
        `Missing required target repo configuration: ${targetRepoSettings.join(", ")}`,
      );
      console.error("Run `npm run dev -- init` first.");
      process.exit(1);
    }

    const issueDetails = await getGitHubIssueDetails(issueUrl);

    if (!issueDetails.found || !issueDetails.owner || !issueDetails.repo || !issueDetails.number || !issueDetails.title) {
      console.error(issueDetails.error ?? "GitHub issue could not be loaded.");
      process.exit(1);
    }

    const repoMatchError = ensureIssueMatchesTargetRepo(
      issueDetails.owner,
      issueDetails.repo,
      targetRepoSettings,
    );

    if (repoMatchError) {
      console.error(repoMatchError);
      process.exit(1);
    }

    const branchName = buildTicketBranchName(
      issueDetails.number,
      issueDetails.title,
    );
    const commitMessage = `Implement #${issueDetails.number} ${issueDetails.title}`;
    const commitResult = await commitAllTargetRepoChanges(
      targetRepoSettings.repoPath,
      branchName,
      commitMessage,
    );

    if (!commitResult.committed) {
      console.error(commitResult.error ?? "Failed to commit target repo changes.");
      process.exit(1);
    }

    const pushResult = await pushTargetRepoBranchToOrigin(
      targetRepoSettings.repoPath,
      branchName,
      targetRepoSettings.token,
    );

    if (!pushResult.pushed) {
      console.error(pushResult.error ?? "Failed to push target repo branch.");
      process.exit(1);
    }

    const prTitle = `Implement #${issueDetails.number}: ${issueDetails.title}`;
    const prBody = [
      `Implements #${issueDetails.number}`,
      "",
      `Source issue: ${issueDetails.url ?? issueUrl}`,
      "",
      "Local work was completed in the target repo branch prepared by ProjectX.",
    ].join("\n");
    const prEnv: NodeJS.ProcessEnv = {
      ...process.env,
      GITHUB_OWNER: issueDetails.owner,
      GITHUB_REPO: issueDetails.repo,
      GITHUB_TOKEN: targetRepoSettings.token,
    };
    const pullRequestResult = await createGitHubPullRequest(
      prTitle,
      prBody,
      branchName,
      targetRepoSettings.baseBranch,
      prEnv,
    );

    if (!pullRequestResult.created && !pullRequestResult.existing) {
      console.error(
        pullRequestResult.error ?? "Failed to create pull request.",
      );
      process.exit(1);
    }

    console.log(
      pullRequestResult.existing
        ? "Pull request already exists."
        : "Pull request created successfully.",
    );

    if (pullRequestResult.url) {
      console.log(`PR URL: ${pullRequestResult.url}`);
    }

    if (pullRequestResult.number !== undefined) {
      console.log(`PR number: #${pullRequestResult.number}`);
    }

    process.exit(0);
  }

  if (args[0] === "clone-target") {
    const targetRepoSettings = getTargetRepoSettingsFromEnv();

    if (Array.isArray(targetRepoSettings)) {
      console.error(
        `Missing required target repo configuration: ${targetRepoSettings.join(", ")}`,
      );
      console.error("Run `npm run dev -- init` first.");
      process.exit(1);
    }

    console.log(`Cloning target repo: ${targetRepoSettings.repoUrl}`);
    console.log(`Destination: ${targetRepoSettings.repoPath}`);
    console.log(`Base branch: ${targetRepoSettings.baseBranch}`);
    console.log("");

    const cloneResult = await cloneTargetRepository(
      targetRepoSettings.repoUrl,
      targetRepoSettings.repoPath,
      targetRepoSettings.baseBranch,
      targetRepoSettings.token,
    );

    if (!cloneResult.cloned) {
      console.error(cloneResult.error ?? "Failed to clone target repository.");
      process.exit(1);
    }

    console.log(
      cloneResult.existing
        ? "Target repository already existed locally and was refreshed."
        : "Target repository cloned successfully.",
    );
    console.log("");
    console.log(`Local path: ${cloneResult.path}`);
    process.exit(0);
  }

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
      `git clone ${result.cloneUrl ?? `https://github.com/${result.owner}/${result.repoName}.git`}`,
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
  let wrotePlanningArtifacts = false;
  let attemptedGitHubIssueCreation = false;

  if (!hasExplicitFlags(args)) {
    await writeOrchestratorOutput(result);
    await refreshApprovalStatuses(result);
    wrotePlanningArtifacts = true;
  }

  if (shouldGenerateRequirements) {
    await generateRequirements(result);
    wrotePlanningArtifacts = true;
  }

  if (shouldCreateGitHubIssue) {
    attemptedGitHubIssueCreation = true;
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

  if (wrotePlanningArtifacts) {
    printPlanningArtifactsGuidance(result);
  }

  if (attemptedGitHubIssueCreation) {
    printGitHubIssueGuidance(result);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("ProjectX failed:", error);
  process.exit(1);
});
