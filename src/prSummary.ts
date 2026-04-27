import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { readPrSummaryStatus } from "./prSummaryApproval.js";
import type {
  OrchestratorResult,
  PrSummaryResult,
  PrSummaryStatus,
} from "./types.js";

const prSummaryFile = "output/pr/theskeleton-google-login.pr-summary.md";
const sourceBranch = "feature/theskeleton-google-login";
const baseBranch = "main";

function renderPrSummaryMarkdown(
  result: OrchestratorResult,
  status: PrSummaryStatus,
): string {
  const relatedIssue =
    result.githubIssue.url ??
    "Not created yet. Use the deterministic implementation issue draft or local issue artifact.";

  return [
    "# TheSkeleton PR summary draft",
    "",
    `Status: ${status}`,
    "",
    `Work item ID: ${result.workItemId}`,
    "",
    `Target app: ${result.targetAppName}`,
    "",
    `Source branch: ${sourceBranch}`,
    "",
    `Intended base branch: ${baseBranch}`,
    "",
    `Related GitHub issue if known: ${relatedIssue}`,
    "",
    "## Summary",
    "Prepare the initial TheSkeleton application scaffold and supporting ProjectX artifacts for review before any push or PR creation.",
    "",
    "## Changes included",
    "- Added TheSkeleton React app scaffold under apps/theskeleton",
    "- Added placeholder Google auth boundary",
    "- Added scaffold verification artifact",
    "- No real OAuth secrets or production auth flow added yet",
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
    status = await readPrSummaryStatus(prSummaryFile);
  } catch {
    status = "draft";
  }

  await mkdir(dirname(prSummaryFile), { recursive: true });
  await writeFile(prSummaryFile, renderPrSummaryMarkdown(result, status), "utf8");

  return {
    generated: true,
    file: prSummaryFile,
    sourceBranch,
    baseBranch,
  };
}
