import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  BASE_BRANCH,
  IMPLEMENTATION_BRANCH,
  PR_SUMMARY_FILE_PATH,
} from "./projectxConfig.js";
import { readPrSummaryStatus } from "./prSummaryApproval.js";
import type {
  OrchestratorResult,
  PrSummaryResult,
  PrSummaryStatus,
} from "./types.js";

function renderPrSummaryMarkdown(
  result: OrchestratorResult,
  status: PrSummaryStatus,
): string {
  const relatedIssue =
    result.githubIssue.url ??
    "Not created yet. Use the deterministic implementation issue draft or local issue artifact.";
  const verificationArtifact =
    result.appVerification?.verificationFile ??
    result.scaffoldVerification?.verificationFile ??
    "Not generated yet.";
  const codeGenerationLog =
    result.codeGeneration?.logFile ?? "Not generated yet.";

  return [
    "# Pull request summary: TheSkeleton Google login",
    "",
    `Status: ${status}`,
    "",
    `Work item ID: ${result.workItemId}`,
    "",
    `Target app: ${result.targetAppName}`,
    "",
    `Source branch: ${IMPLEMENTATION_BRANCH}`,
    "",
    `Base branch: ${BASE_BRANCH}`,
    "",
    `Related GitHub issue if known: ${relatedIssue}`,
    "",
    "## Summary",
    "Prepare the initial TheSkeleton application scaffold and supporting ProjectX artifacts for review before any push or PR creation.",
    "",
    "## Changes included",
    "- Added TheSkeleton React app scaffold under apps/theskeleton",
    "- Added placeholder Google auth boundary",
    `- Verification artifact: ${verificationArtifact}`,
    `- Code generation log: ${codeGenerationLog}`,
    "- No real OAuth secrets or production auth flow added yet",
    "- No deployment changes were included",
    "",
    "## Verification performed",
    "- ProjectX build should be run with `npm run build`",
    "- TheSkeleton build should be run from `apps/theskeleton` with `npm install` and `npm run build`",
    "- Browser review should be done with `npm run dev`",
    "",
    "## Known limitations",
    "- Google login is placeholder only",
    "- No real Google OAuth client ID is configured",
    "- No deployment has been added",
    "- No automated tests have been added yet unless already present",
    "",
    "## Reviewer checklist",
    "- [ ] Requirements were approved",
    "- [ ] Implementation plan was approved",
    "- [ ] Scaffold files reviewed",
    "- [ ] Generated code reviewed",
    "- [ ] ProjectX build passed",
    "- [ ] TheSkeleton build passed",
    "- [ ] Placeholder UI reviewed",
    "- [ ] Approval given to push branch and open PR",
    "",
  ].join("\n");
}

export async function draftPrSummary(
  result: OrchestratorResult,
): Promise<PrSummaryResult> {
  let status: PrSummaryStatus = "draft";

  try {
    status = await readPrSummaryStatus(PR_SUMMARY_FILE_PATH);
  } catch {
    status = "draft";
  }

  const markdown = renderPrSummaryMarkdown(result, status);

  if (status === "approved") {
    try {
      const existingContents = await readFile(PR_SUMMARY_FILE_PATH, "utf8");

      if (existingContents !== markdown) {
        return {
          generated: false,
          file: PR_SUMMARY_FILE_PATH,
          sourceBranch: IMPLEMENTATION_BRANCH,
          baseBranch: BASE_BRANCH,
          error:
            "Approved PR summary already exists with different content and was preserved.",
        };
      }
    } catch {
      // Fall through and write the file if it is missing.
    }
  }

  await mkdir(dirname(PR_SUMMARY_FILE_PATH), { recursive: true });
  await writeFile(PR_SUMMARY_FILE_PATH, markdown, "utf8");

  return {
    generated: true,
    file: PR_SUMMARY_FILE_PATH,
    sourceBranch: IMPLEMENTATION_BRANCH,
    baseBranch: BASE_BRANCH,
  };
}
