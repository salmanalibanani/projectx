import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  buildTicketBranchName,
  getCurrentBranchInRepo,
  targetRepoBranchExists,
  targetRepoIsCloned,
} from "./gitClient.js";
import type { TargetRepoSettings } from "./envConfig.js";
import { OUTPUT_BASE_PATH } from "./projectxConfig.js";
import type {
  CodeGenerationPreparationResult,
  GitHubIssueDetails,
} from "./types.js";

function buildCodeGenerationLogPath(issueNumber: number): string {
  return `${OUTPUT_BASE_PATH}/logs/issue-${issueNumber}.code-generation-prep.md`;
}

function renderCodeGenerationPrepMarkdown(
  issue: GitHubIssueDetails,
  targetRepo: TargetRepoSettings,
  branchName: string,
): string {
  return [
    "# Code generation preparation",
    "",
    `Issue URL: ${issue.url ?? "unknown"}`,
    "",
    `Issue number: ${issue.number ?? "unknown"}`,
    "",
    `Issue title: ${issue.title ?? "unknown"}`,
    "",
    `Target repo path: ${targetRepo.repoPath}`,
    "",
    `Target repo URL: ${targetRepo.repoUrl}`,
    "",
    `Base branch: ${targetRepo.baseBranch}`,
    "",
    `Implementation branch: ${branchName}`,
    "",
    "## Issue body",
    issue.body && issue.body.trim() !== "" ? issue.body : "No issue body was provided.",
    "",
    "## What the future code generation engine should do",
    "- Read the target repo from the configured local path.",
    "- Read the GitHub issue title and body as the implementation brief.",
    "- Make code changes only on the prepared implementation branch.",
    "- Leave the work uncommitted so the user can review and test it before PR creation.",
    "",
    "## Operator note",
    "This file is the handoff artifact for the future code generation engine.",
    "",
  ].join("\n");
}

export async function prepareCodeGenerationFromTicket(
  issue: GitHubIssueDetails,
  targetRepo: TargetRepoSettings,
): Promise<CodeGenerationPreparationResult> {
  if (!issue.found || !issue.number || !issue.title || !issue.url) {
    return {
      ready: false,
      branchName: "",
      issueUrl: issue.url ?? "",
      issueNumber: issue.number ?? 0,
      issueTitle: issue.title ?? "",
      repoPath: targetRepo.repoPath,
      baseBranch: targetRepo.baseBranch,
      logFile: buildCodeGenerationLogPath(issue.number ?? 0),
      error: "GitHub issue details are incomplete.",
    };
  }

  const branchName = buildTicketBranchName(issue.number, issue.title);
  const logFile = buildCodeGenerationLogPath(issue.number);

  if (!(await targetRepoIsCloned(targetRepo.repoPath))) {
    return {
      ready: false,
      branchName,
      issueUrl: issue.url,
      issueNumber: issue.number,
      issueTitle: issue.title,
      repoPath: targetRepo.repoPath,
      baseBranch: targetRepo.baseBranch,
      logFile,
      error: "Target repo is not cloned locally yet.",
    };
  }

  if (!(await targetRepoBranchExists(targetRepo.repoPath, branchName))) {
    return {
      ready: false,
      branchName,
      issueUrl: issue.url,
      issueNumber: issue.number,
      issueTitle: issue.title,
      repoPath: targetRepo.repoPath,
      baseBranch: targetRepo.baseBranch,
      logFile,
      error:
        "Ticket implementation branch does not exist yet. Run `npm run dev -- implement-ticket <issue-url>` first.",
    };
  }

  const currentBranch = await getCurrentBranchInRepo(targetRepo.repoPath);

  if (currentBranch !== branchName) {
    return {
      ready: false,
      branchName,
      issueUrl: issue.url,
      issueNumber: issue.number,
      issueTitle: issue.title,
      repoPath: targetRepo.repoPath,
      baseBranch: targetRepo.baseBranch,
      logFile,
      error:
        `Target repo is on branch ${currentBranch}. Switch to ${branchName} or rerun \`npm run dev -- implement-ticket ${issue.url}\`.`,
    };
  }

  await mkdir(dirname(logFile), { recursive: true });
  await writeFile(
    logFile,
    renderCodeGenerationPrepMarkdown(issue, targetRepo, branchName),
    "utf8",
  );

  return {
    ready: true,
    branchName,
    issueUrl: issue.url,
    issueNumber: issue.number,
    issueTitle: issue.title,
    repoPath: targetRepo.repoPath,
    baseBranch: targetRepo.baseBranch,
    logFile,
  };
}
