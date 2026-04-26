import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ImplementationBranchResult } from "./types.js";

const execFileAsync = promisify(execFile);

async function runGitCommand(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
  });

  return stdout.trim();
}

export async function ensureImplementationBranch(
  branchName: string,
): Promise<ImplementationBranchResult> {
  const statusOutput = await runGitCommand(["status", "--porcelain"]);

  if (statusOutput !== "") {
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
