import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ScaffoldVerificationResult } from "./types.js";

const verificationFile =
  "output/verification/theskeleton-google-login.scaffold-verification.md";

const checkedFiles = [
  "apps/theskeleton/package.json",
  "apps/theskeleton/index.html",
  "apps/theskeleton/tsconfig.json",
  "apps/theskeleton/vite.config.ts",
  "apps/theskeleton/src/main.tsx",
  "apps/theskeleton/src/App.tsx",
  "apps/theskeleton/src/auth/googleAuthPlaceholder.ts",
];

function renderVerificationMarkdown(
  result: ScaffoldVerificationResult,
): string {
  const checkedFileLines = result.checkedFiles.map((filePath) => `- ${filePath}`);
  const missingFileLines =
    result.missingFiles.length > 0
      ? result.missingFiles.map((filePath) => `- Missing: ${filePath}`)
      : ["- No required scaffold files are missing."];

  return [
    "# TheSkeleton scaffold verification",
    "",
    "Work item ID: theskeleton-google-login",
    "",
    "Target app: TheSkeleton",
    "",
    `Verification status: ${result.verified ? "verified" : "incomplete"}`,
    "",
    "## Checked files",
    ...checkedFileLines,
    "",
    "## Missing files",
    ...missingFileLines,
    "",
    "## Manual commands to run",
    "```bash",
    "npm run build",
    "",
    "cd apps/theskeleton",
    "npm install",
    "npm run build",
    "npm run dev",
    "```",
    "",
    "## Result checklist",
    "- [ ] ProjectX build passed",
    "- [ ] TheSkeleton dependencies installed",
    "- [ ] TheSkeleton build passed",
    "- [ ] TheSkeleton local dev server started",
    "- [ ] Placeholder UI reviewed in browser",
    "",
  ].join("\n");
}

export async function verifyAppScaffold(): Promise<ScaffoldVerificationResult> {
  const missingFiles: string[] = [];

  for (const filePath of checkedFiles) {
    try {
      await stat(filePath);
    } catch {
      missingFiles.push(filePath);
    }
  }

  const result: ScaffoldVerificationResult = {
    verified: missingFiles.length === 0,
    verificationFile,
    checkedFiles,
    missingFiles,
  };

  await mkdir(dirname(verificationFile), { recursive: true });
  await writeFile(verificationFile, renderVerificationMarkdown(result), "utf8");

  return result;
}
