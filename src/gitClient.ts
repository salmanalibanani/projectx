import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import type {
  BranchPushResult,
  ImplementationBranchResult,
  TargetRepoBranchResult,
  TargetRepoCommitResult,
  TargetRepoCloneResult,
} from "./types.js";

const execFileAsync = promisify(execFile);

type GitCommandOptions = {
  cwd?: string;
  authToken?: string;
};

function withGitAuthArgs(
  args: string[],
  authToken?: string,
): string[] {
  if (!authToken) {
    return args;
  }

  return [
    "-c",
    `http.extraHeader=Authorization: Bearer ${authToken}`,
    ...args,
  ];
}

async function runGitCommand(
  args: string[],
  options: GitCommandOptions = {},
): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: options.cwd ?? process.cwd(),
  });

  return stdout.trim();
}

async function runGitCommandWithAuth(
  args: string[],
  options: GitCommandOptions = {},
): Promise<string> {
  return runGitCommand(withGitAuthArgs(args, options.authToken), options);
}

function getGitErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Git command failed.";
  }

  const execError = error as Error & {
    stderr?: string;
    stdout?: string;
  };
  const stderr = execError.stderr?.trim();

  if (stderr) {
    return stderr;
  }

  return error.message;
}

function normalizeRepoUrl(repoUrl: string): string {
  return repoUrl.replace(/\.git$/u, "").replace(/\/$/u, "").toLowerCase();
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isGitRepository(path: string): Promise<boolean> {
  return pathExists(resolve(path, ".git"));
}

async function getRemoteOriginUrl(repoPath: string): Promise<string> {
  return runGitCommand(["remote", "get-url", "origin"], { cwd: repoPath });
}

async function checkoutBranch(repoPath: string, branchName: string): Promise<void> {
  try {
    await runGitCommand(["checkout", branchName], { cwd: repoPath });
  } catch {
    await runGitCommand(
      ["checkout", "-b", branchName, "--track", `origin/${branchName}`],
      { cwd: repoPath },
    );
  }
}

async function fetchOrigin(
  repoPath: string,
  authToken?: string,
): Promise<void> {
  const options: GitCommandOptions = {
    cwd: repoPath,
  };

  if (authToken !== undefined) {
    options.authToken = authToken;
  }

  await runGitCommandWithAuth(["fetch", "origin"], options);
}

async function branchExists(repoPath: string, branchName: string): Promise<boolean> {
  const output = await runGitCommand(["branch", "--list", branchName], {
    cwd: repoPath,
  });

  return output !== "";
}

export async function getCurrentBranchInRepo(repoPath: string): Promise<string> {
  return runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: resolve(repoPath),
  });
}

export async function targetRepoBranchExists(
  repoPath: string,
  branchName: string,
): Promise<boolean> {
  return branchExists(resolve(repoPath), branchName);
}

export async function targetRepoIsCloned(repoPath: string): Promise<boolean> {
  return isGitRepository(resolve(repoPath));
}

async function checkoutBaseBranch(
  repoPath: string,
  baseBranch: string,
  authToken?: string,
): Promise<void> {
  await fetchOrigin(repoPath, authToken);

  try {
    await runGitCommand(["checkout", baseBranch], { cwd: repoPath });
  } catch {
    await runGitCommand(
      ["checkout", "-b", baseBranch, "--track", `origin/${baseBranch}`],
      { cwd: repoPath },
    );
  }
}

function sanitizeBranchSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+/u, "")
    .replace(/-+$/u, "")
    .slice(0, 40);
}

export function buildTicketBranchName(
  issueNumber: number,
  issueTitle: string,
): string {
  const sanitizedTitle = sanitizeBranchSegment(issueTitle);
  const suffix = sanitizedTitle === "" ? "ticket" : sanitizedTitle;

  return `feature/issue-${issueNumber}-${suffix}`;
}

async function ensureLocalPathIsCloneable(targetPath: string): Promise<string | null> {
  if (!(await pathExists(targetPath))) {
    return null;
  }

  if (await isGitRepository(targetPath)) {
    return null;
  }

  const targetStats = await stat(targetPath);

  if (!targetStats.isDirectory()) {
    return "Target repo path exists but is not a directory.";
  }

  const entries = await readdir(targetPath);

  if (entries.length > 0) {
    return "Target repo path exists and is not empty, but it is not a git repository.";
  }

  return null;
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

export async function cloneTargetRepository(
  repoUrl: string,
  targetPath: string,
  baseBranch: string,
  authToken?: string,
): Promise<TargetRepoCloneResult> {
  try {
    const normalizedTargetPath = resolve(targetPath);
    const localPathError = await ensureLocalPathIsCloneable(normalizedTargetPath);

    if (localPathError) {
      return {
        cloned: false,
        path: normalizedTargetPath,
        repoUrl,
        baseBranch,
        error: localPathError,
      };
    }

    if (await isGitRepository(normalizedTargetPath)) {
      const originUrl = await getRemoteOriginUrl(normalizedTargetPath);

      if (normalizeRepoUrl(originUrl) !== normalizeRepoUrl(repoUrl)) {
        return {
          cloned: false,
          existing: true,
          path: normalizedTargetPath,
          repoUrl,
          baseBranch,
          error:
            `Target path already contains a different git repository. Existing origin: ${originUrl}`,
        };
      }

      await fetchOrigin(normalizedTargetPath, authToken);
      await checkoutBranch(normalizedTargetPath, baseBranch);

      return {
        cloned: true,
        existing: true,
        path: normalizedTargetPath,
        repoUrl,
        baseBranch,
      };
    }

    const cloneOptions: GitCommandOptions = {
      cwd: dirname(normalizedTargetPath),
    };

    if (authToken !== undefined) {
      cloneOptions.authToken = authToken;
    }

    await runGitCommandWithAuth(
      [
        "clone",
        "--branch",
        baseBranch,
        "--single-branch",
        repoUrl,
        normalizedTargetPath,
      ],
      cloneOptions,
    );

    return {
      cloned: true,
      existing: false,
      path: normalizedTargetPath,
      repoUrl,
      baseBranch,
    };
  } catch (error) {
    const gitErrorMessage = getGitErrorMessage(error);
    const lowerCaseError = gitErrorMessage.toLowerCase();
    const authHint =
      lowerCaseError.includes("authentication failed") ||
      lowerCaseError.includes("could not read username") ||
      lowerCaseError.includes("repository not found") ||
      lowerCaseError.includes("fatal: could not") ||
      lowerCaseError.includes("http basic")
        ? " Check that GITHUB_TOKEN is valid in ProjectX/.env and that it can access the target repository."
        : "";

    return {
      cloned: false,
      path: resolve(targetPath),
      repoUrl,
      baseBranch,
      error:
        `Failed to clone target repository: ${gitErrorMessage}${authHint}`,
    };
  }
}

export async function prepareTargetRepoBranchFromTicket(
  repoPath: string,
  baseBranch: string,
  issueNumber: number,
  issueTitle: string,
  authToken?: string,
): Promise<TargetRepoBranchResult> {
  const branchName = buildTicketBranchName(issueNumber, issueTitle);
  const normalizedRepoPath = resolve(repoPath);

  try {
    if (!(await isGitRepository(normalizedRepoPath))) {
      return {
        ready: false,
        branchName,
        path: normalizedRepoPath,
        baseBranch,
        error: "Target repo is not cloned locally yet.",
      };
    }

    const statusOutput = await runGitCommand(["status", "--porcelain"], {
      cwd: normalizedRepoPath,
    });

    if (statusOutput !== "") {
      return {
        ready: false,
        branchName,
        path: normalizedRepoPath,
        baseBranch,
        error: "Target repo working tree must be clean before creating the ticket branch.",
      };
    }

    await checkoutBaseBranch(normalizedRepoPath, baseBranch, authToken);

    if (await branchExists(normalizedRepoPath, branchName)) {
      await runGitCommand(["checkout", branchName], { cwd: normalizedRepoPath });

      return {
        ready: true,
        branchName,
        path: normalizedRepoPath,
        baseBranch,
        existing: true,
      };
    }

    await runGitCommand(["checkout", "-b", branchName], {
      cwd: normalizedRepoPath,
    });

    return {
      ready: true,
      branchName,
      path: normalizedRepoPath,
      baseBranch,
      existing: false,
    };
  } catch (error) {
    return {
      ready: false,
      branchName,
      path: normalizedRepoPath,
      baseBranch,
      error:
        error instanceof Error
          ? `Failed to prepare ticket branch: ${getGitErrorMessage(error)}`
          : "Failed to prepare ticket branch.",
    };
  }
}

export async function commitAllTargetRepoChanges(
  repoPath: string,
  branchName: string,
  commitMessage: string,
): Promise<TargetRepoCommitResult> {
  const normalizedRepoPath = resolve(repoPath);

  try {
    const currentBranch = await runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: normalizedRepoPath,
    });

    if (currentBranch !== branchName) {
      return {
        committed: false,
        branchName,
        error:
          `Target repo is on branch ${currentBranch}. Switch back to ${branchName} before creating the PR.`,
      };
    }

    if (!(await branchExists(normalizedRepoPath, branchName))) {
      return {
        committed: false,
        branchName,
        error: `Expected ticket branch does not exist locally: ${branchName}`,
      };
    }

    const statusOutput = await runGitCommand(["status", "--porcelain"], {
      cwd: normalizedRepoPath,
    });

    if (statusOutput === "") {
      return {
        committed: false,
        branchName,
        error: "No local changes found in the target repo.",
      };
    }

    await runGitCommand(["add", "-A"], { cwd: normalizedRepoPath });
    await runGitCommand(["commit", "-m", commitMessage], {
      cwd: normalizedRepoPath,
    });

    return {
      committed: true,
      commitMessage,
      branchName,
    };
  } catch (error) {
    return {
      committed: false,
      branchName,
      error:
        error instanceof Error
          ? `Failed to commit target repo changes: ${getGitErrorMessage(error)}`
          : "Failed to commit target repo changes.",
    };
  }
}

export async function pushTargetRepoBranchToOrigin(
  repoPath: string,
  branchName: string,
  authToken?: string,
): Promise<BranchPushResult> {
  const normalizedRepoPath = resolve(repoPath);

  try {
    const options: GitCommandOptions = {
      cwd: normalizedRepoPath,
    };

    if (authToken !== undefined) {
      options.authToken = authToken;
    }

    await runGitCommandWithAuth(["push", "-u", "origin", branchName], options);

    return {
      pushed: true,
      branchName,
      remote: "origin",
    };
  } catch (error) {
    return {
      pushed: false,
      branchName,
      remote: "origin",
      error:
        error instanceof Error
          ? `Failed to push target repo branch: ${getGitErrorMessage(error)}`
          : "Failed to push target repo branch.",
    };
  }
}
