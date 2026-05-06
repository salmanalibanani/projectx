import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  OUTPUT_BASE_PATH,
  POC_SUMMARY_FILE_PATH,
  WORK_ITEM_ID,
} from "./projectxConfig.js";
import type { OrchestratorResult, PocSummaryResult } from "./types.js";

function renderPocSummaryMarkdown(result: OrchestratorResult): string {
  const githubArtifacts = [
    result.githubIssue.url
      ? `- GitHub issue: ${result.githubIssue.url}`
      : "- GitHub issue: not created yet",
    result.pullRequest?.url
      ? `- Pull request: ${result.pullRequest.url}`
      : "- Pull request: not created yet",
  ];

  const localArtifacts = [
    `- ${OUTPUT_BASE_PATH}/requirements/${WORK_ITEM_ID}.requirements.md`,
    `- ${OUTPUT_BASE_PATH}/issues/${WORK_ITEM_ID}.md`,
    `- ${OUTPUT_BASE_PATH}/plans/${WORK_ITEM_ID}.implementation-plan.md`,
    `- ${OUTPUT_BASE_PATH}/verification/${WORK_ITEM_ID}.app-verification.md`,
    `- ${OUTPUT_BASE_PATH}/pr-summaries/${WORK_ITEM_ID}.pr-summary.md`,
    `- ${OUTPUT_BASE_PATH}/logs/${WORK_ITEM_ID}.poc-summary.md`,
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
    "- External target repository workflow direction",
    "- Optional OpenAI code generation hook",
    "- Verification artifact generation",
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
