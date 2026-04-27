import { generateAppScaffold } from "./appScaffold.js";
import { createGitHubIssue } from "./githubClient.js";
import { ensureImplementationBranch, getCurrentBranch } from "./gitClient.js";
import { readImplementationPlanStatus } from "./implementationPlanApproval.js";
import { draftPrSummary } from "./prSummary.js";
import { runOrchestrator } from "./orchestrator.js";
import { verifyAppScaffold } from "./scaffoldVerification.js";
import { writeOrchestratorOutput } from "./outputWriter.js";
import { readRequirementsStatus } from "./requirementsApproval.js";

async function refreshApprovalStatuses(result: Awaited<ReturnType<typeof runOrchestrator>>) {
  const requirementsFilePath = result.generatedFiles.find((filePath) =>
    filePath.endsWith(".requirements.md"),
  );
  const implementationPlanFilePath = result.generatedFiles.find((filePath) =>
    filePath.endsWith(".implementation-plan.md"),
  );

  if (requirementsFilePath) {
    result.requirementsDraft.status = await readRequirementsStatus(
      requirementsFilePath,
    );
  }

  if (implementationPlanFilePath) {
    result.implementationPlan.status = await readImplementationPlanStatus(
      implementationPlanFilePath,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const shouldCreateGitHubIssue = args.includes("--create-github-issue");
  const shouldPrepareImplementation = args.includes("--prepare-implementation");
  const shouldCreateImplementationBranch = args.includes(
    "--create-implementation-branch",
  );
  const shouldGenerateAppScaffold = args.includes("--generate-app-scaffold");
  const shouldVerifyAppScaffold = args.includes("--verify-app-scaffold");
  const shouldDraftPrSummary = args.includes("--draft-pr-summary");
  const userRequest = args
    .filter(
      (arg) =>
        arg !== "--create-github-issue" &&
        arg !== "--prepare-implementation" &&
        arg !== "--create-implementation-branch" &&
        arg !== "--generate-app-scaffold" &&
        arg !== "--verify-app-scaffold" &&
        arg !== "--draft-pr-summary",
    )
    .join(" ");

  if (!userRequest) {
    console.log("Please provide a request.");
    console.log(
      'Example: npm run dev -- "Build TheSkeleton app with Google login"',
    );
    process.exit(1);
  }

  const result = await runOrchestrator(userRequest);
  await writeOrchestratorOutput(result);
  await refreshApprovalStatuses(result);

  if (shouldCreateGitHubIssue) {
    const requirementsFilePath = result.generatedFiles.find((filePath) =>
      filePath.endsWith(".requirements.md"),
    );

    if (!requirementsFilePath) {
      result.githubIssue = {
        created: false,
        error: "Requirements file path is missing from generatedFiles.",
      };
    } else {
      const requirementsStatus = await readRequirementsStatus(
        requirementsFilePath,
      );

      result.requirementsDraft.status = requirementsStatus;

      if (requirementsStatus !== "approved") {
        result.githubIssue = {
          created: false,
          error: `Requirements must be approved before creating a GitHub issue. Review: ${requirementsFilePath}`,
        };
      } else {
        result.githubIssue = await createGitHubIssue(result.issueDraft);
      }
    }
  }

  if (shouldPrepareImplementation) {
    const implementationPlanFilePath = result.generatedFiles.find((filePath) =>
      filePath.endsWith(".implementation-plan.md"),
    );

    if (!implementationPlanFilePath) {
      result.implementationPreparation = {
        ready: false,
        reason: "Implementation plan file path is missing from generatedFiles.",
        planFile: "",
        requiredStatus: "approved",
        actualStatus: "draft",
      };
    } else {
      const implementationPlanStatus = await readImplementationPlanStatus(
        implementationPlanFilePath,
      );

      result.implementationPlan.status = implementationPlanStatus;

      if (implementationPlanStatus !== "approved") {
        result.implementationPreparation = {
          ready: false,
          reason:
            "Implementation plan must be approved before preparing implementation.",
          planFile: implementationPlanFilePath,
          requiredStatus: "approved",
          actualStatus: implementationPlanStatus,
        };
      } else {
        result.implementationPreparation = {
          ready: true,
          reason:
            "Implementation plan is approved. ProjectX may proceed to branch creation in the next milestone.",
          planFile: implementationPlanFilePath,
          requiredStatus: "approved",
          actualStatus: implementationPlanStatus,
          proposedBranchName: `feature/${result.workItemId}`,
        };
      }
    }
  }

  if (shouldCreateImplementationBranch) {
    const implementationPlanFilePath = result.generatedFiles.find((filePath) =>
      filePath.endsWith(".implementation-plan.md"),
    );
    const branchName = `feature/${result.workItemId}`;

    if (!implementationPlanFilePath) {
      result.implementationBranch = {
        branchName,
        created: false,
        existing: false,
        switched: false,
        error: "Implementation plan file path is missing from generatedFiles.",
      };
    } else {
      const implementationPlanStatus = await readImplementationPlanStatus(
        implementationPlanFilePath,
      );

      result.implementationPlan.status = implementationPlanStatus;

      if (implementationPlanStatus !== "approved") {
        result.implementationBranch = {
          branchName,
          created: false,
          existing: false,
          switched: false,
          error:
            "Implementation plan must be approved before creating implementation branch.",
        };
      } else {
        result.implementationBranch =
          await ensureImplementationBranch(branchName);
      }
    }
  }

  if (shouldGenerateAppScaffold) {
    const implementationPlanFilePath = result.generatedFiles.find((filePath) =>
      filePath.endsWith(".implementation-plan.md"),
    );
    const requiredBranchName = `feature/${result.workItemId}`;

    if (!implementationPlanFilePath) {
      result.appScaffold = {
        generated: false,
        appPath: "apps/theskeleton",
        files: [],
        error: "Implementation plan file path is missing from generatedFiles.",
      };
    } else {
      const implementationPlanStatus = await readImplementationPlanStatus(
        implementationPlanFilePath,
      );

      result.implementationPlan.status = implementationPlanStatus;

      if (implementationPlanStatus !== "approved") {
        result.appScaffold = {
          generated: false,
          appPath: "apps/theskeleton",
          files: [],
          error:
            "Implementation plan must be approved before generating app scaffold.",
        };
      } else {
        const currentBranch = await getCurrentBranch();

        if (currentBranch !== requiredBranchName) {
          result.appScaffold = {
            generated: false,
            appPath: "apps/theskeleton",
            files: [],
            error: `App scaffold can only be generated on branch ${requiredBranchName}.`,
          };
        } else {
          result.appScaffold = await generateAppScaffold();
        }
      }
    }
  }

  if (shouldVerifyAppScaffold) {
    result.scaffoldVerification = await verifyAppScaffold();
  }

  if (shouldDraftPrSummary) {
    const requiredBranchName = `feature/${result.workItemId}`;
    const currentBranch = await getCurrentBranch();

    if (currentBranch !== requiredBranchName) {
      result.prSummary = {
        generated: false,
        file: "output/pr/theskeleton-google-login.pr-summary.md",
        sourceBranch: requiredBranchName,
        baseBranch: "main",
        error: `PR summary can only be drafted from branch ${requiredBranchName}.`,
      };
    } else {
      result.prSummary = await draftPrSummary(result);
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("ProjectX failed:", error);
  process.exit(1);
});
