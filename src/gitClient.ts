import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { BranchPushResult, ImplementationBranchResult } from "./types.js";

const execFileAsync = promisify(execFile);

async function runGitCommand(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
  });

  return stdout.trim();
}

export async function isWorkingTreeClean(): Promise<boolean> {
  const statusOutput = await runGitCommand(["status", "--porcelain"]);

  return statusOutput === "";
}

export async function getCurrentBranch(): Promise<string> {
  return runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"]);
}

export async function ensureImplementationBranch(
  branchName: string,
): Promise<ImplementationBranchResult> {
  if (!(await isWorkingTreeClean())) {
    return {
      branchName,
      created: false,
      existing: false,
      switched: false,
      error: "Working tree must be clean before creating implementation branch.",
    };
  }

  const existingBranch = await runGitCommand(["branch", "--list", branchName]);

  if (existingBranch !== "") {
    await runGitCommand(["checkout", branchName]);

    return {
      branchName,
      created: false,
      existing: true,
      switched: true,
    };
  }

  await runGitCommand(["checkout", "-b", branchName]);

  return {
    branchName,
    created: true,
    existing: false,
    switched: true,
  };
}

export async function pushBranchToOrigin(
  branchName: string,
): Promise<BranchPushResult> {
  try {
    await runGitCommand(["push", "-u", "origin", branchName]);

    return {
      pushed: true,
      branchName,
      remote: "origin",
    };
  } catch (error) {
    return {
      pushed: false,
      error:
        error instanceof Error
          ? `Failed to push implementation branch: ${error.message}`
          : "Failed to push implementation branch.",
    };
  }
}
