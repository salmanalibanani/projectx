import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { POC_SUMMARY_FILE_PATH } from "./projectxConfig.js";
import type { OrchestratorResult, PocSummaryResult } from "./types.js";

function renderPocSummaryMarkdown(result: OrchestratorResult): string {
  const githubArtifacts = [
    result.githubIssue.url ? `- GitHub issue: ${result.githubIssue.url}` : "- GitHub issue: not created yet",
    result.pullRequest?.url
      ? `- Pull request: ${result.pullRequest.url}`
      : "- Pull request: not created yet",
  ];

  const localArtifacts = [
    "- output/requirements/theskeleton-google-login.requirements.md",
    "- output/issues/theskeleton-google-login.md",
    "- output/plans/theskeleton-google-login.implementation-plan.md",
    "- output/verification/theskeleton-google-login.app-verification.md",
    "- output/pr/theskeleton-google-login.pr-summary.md",
    "- output/code/theskeleton-google-login.code-generation.md",
    "- output/poc/theskeleton-google-login.poc-summary.md",
  ];

  return [
    "# ProjectX POC completion summary",
    "",
    "Work item ID: theskeleton-google-login",
    "",
    `Target app: ${result.targetAppName}`,
    "",
    "## Current status",
    result.nextRecommendedAction,
    "",
    "## Completed ProjectX capabilities",
    "- Deterministic requirements draft generation",
    "- Requirements approval gate",
    "- GitHub issue creation",
    "- Duplicate issue and pull request protection",
    "- Stable work item ID",
    "- Implementation plan generation",
    "- Implementation plan approval gate",
    "- Guarded implementation branch creation",
    "- Monorepo scaffold generation",
    "- Optional OpenAI code generation hook",
    "- App verification artifact",
    "- PR summary draft generation",
    "- PR summary approval gate",
    "- Guarded branch push",
    "- Guarded GitHub PR creation",
    "",
    "## Human approval gates demonstrated",
    "- Requirements must be approved before GitHub issue creation",
    "- Implementation plan must be approved before implementation preparation or branch creation",
    "- PR summary must be approved before branch push or pull request creation",
    "",
    "## GitHub artifacts created",
    ...githubArtifacts,
    "",
    "## Local artifacts created",
    ...localArtifacts,
    "",
    "## What was intentionally not done",
    "- No real production Google OAuth secrets were committed",
    "- No deployment was added yet",
    "- No merge automation was added yet",
    "- No separate repo mode was added yet",
    "",
    "## Recommended next phase",
    "- Review the generated app code, wire a real client-side Google OAuth library behind the placeholder auth boundary, and add deterministic tests around the auth state UI.",
    "",
    "## Blog post notes",
    "- ProjectX can now carry a monorepo POC from request to reviewed artifacts, guarded implementation work, and a real GitHub pull request without automating risky approvals.",
    "",
  ].join("\n");
}

export async function writePocSummary(
  result: OrchestratorResult,
): Promise<PocSummaryResult> {
  await mkdir(dirname(POC_SUMMARY_FILE_PATH), { recursive: true });
  await writeFile(
    POC_SUMMARY_FILE_PATH,
    renderPocSummaryMarkdown(result),
    "utf8",
  );

  return {
    generated: true,
    file: POC_SUMMARY_FILE_PATH,
  };
}
