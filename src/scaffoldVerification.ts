import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  APP_VERIFICATION_FILE_PATH,
  LEGACY_SCAFFOLD_VERIFICATION_FILE_PATH,
  requiredScaffoldFiles,
} from "./projectxConfig.js";
import type {
  AppVerificationResult,
  ScaffoldVerificationResult,
} from "./types.js";

function renderVerificationMarkdown(
  result: AppVerificationResult,
): string {
  const checkedFileLines = result.checkedFiles.map((filePath) => `- ${filePath}`);
  const missingFileLines =
    result.missingFiles.length > 0
      ? result.missingFiles.map((filePath) => `- Missing: ${filePath}`)
      : ["- No required scaffold files are missing."];
  const warningLines =
    result.warnings.length > 0
      ? result.warnings.map((warning) => `- ${warning}`)
      : ["- No warnings detected in the known generated files."];

  return [
    "# TheSkeleton app verification",
    "",
    `Status: ${result.verified ? "complete" : "draft"}`,
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
    "## Warnings",
    ...warningLines,
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
    "- [ ] Generated code reviewed if --generate-code was used",
    "",
  ].join("\n");
}

export async function verifyApp(): Promise<AppVerificationResult> {
  const missingFiles: string[] = [];
  const warnings: string[] = [];

  for (const filePath of requiredScaffoldFiles) {
    try {
      await stat(filePath);
    } catch {
      missingFiles.push(filePath);
    }
  }

  if (missingFiles.length > 0) {
    warnings.push(
      "One or more required scaffold files are missing, so local app review is incomplete.",
    );
  }

  const result: AppVerificationResult = {
    verified: missingFiles.length === 0,
    verificationFile: APP_VERIFICATION_FILE_PATH,
    checkedFiles: [...requiredScaffoldFiles],
    missingFiles,
    warnings,
  };

  await mkdir(dirname(APP_VERIFICATION_FILE_PATH), { recursive: true });
  const markdown = renderVerificationMarkdown(result);
  await writeFile(APP_VERIFICATION_FILE_PATH, markdown, "utf8");
  await writeFile(LEGACY_SCAFFOLD_VERIFICATION_FILE_PATH, markdown, "utf8");

  return result;
}

export async function verifyAppScaffold(): Promise<ScaffoldVerificationResult> {
  const result = await verifyApp();

  return {
    verified: result.verified,
    verificationFile: LEGACY_SCAFFOLD_VERIFICATION_FILE_PATH,
    checkedFiles: result.checkedFiles,
    missingFiles: result.missingFiles,
  };
}
