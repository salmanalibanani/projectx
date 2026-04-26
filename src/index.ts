import { createGitHubIssue } from "./githubClient.js";
import { readImplementationPlanStatus } from "./implementationPlanApproval.js";
import { runOrchestrator } from "./orchestrator.js";
import { writeOrchestratorOutput } from "./outputWriter.js";
import { readRequirementsStatus } from "./requirementsApproval.js";

async function main() {
  const args = process.argv.slice(2);
  const shouldCreateGitHubIssue = args.includes("--create-github-issue");
  const shouldPrepareImplementation = args.includes("--prepare-implementation");
  const userRequest = args
    .filter(
      (arg) =>
        arg !== "--create-github-issue" && arg !== "--prepare-implementation",
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

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("ProjectX failed:", error);
  process.exit(1);
});
