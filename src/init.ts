import { access, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import { dirname, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { readExistingEnv, type EnvMap } from "./envConfig.js";
import { cloneTargetRepository } from "./gitClient.js";

type ParsedRepoUrl = {
  url: string;
  owner: string;
  repo: string;
};

type RepoAccessResult = {
  accessible: boolean;
  defaultBranch?: string;
  private?: boolean;
  message: string;
  remediation?: string[];
};

type LocalPathCheckResult = {
  ok: boolean;
  resolvedPath: string;
  message: string;
};

const ENV_FILE_PATH = ".env";
const DEFAULT_BASE_BRANCH = "main";
const SUPPORTED_BASE_BRANCHES = ["main", "master"] as const;
const GITHUB_TOKEN_SETUP_STEPS = [
  "Go to GitHub -> Settings -> Developer settings -> Personal access tokens.",
  "Create a token that can access the target repository. For private repos, give it repository read access. If you want ProjectX to create issues or pull requests later, include repository write permissions too.",
  "Save the token in ProjectX/.env as GITHUB_TOKEN=<your-token>.",
  "Rerun `npm run dev -- init` so ProjectX can re-check that the target repo exists and is accessible.",
];
const OPENAI_API_KEY_SETUP_STEPS = [
  "Create an OpenAI API key from the OpenAI dashboard.",
  "Save it in ProjectX/.env as OPENAI_API_KEY=<your-api-key>.",
  "Optionally set OPENAI_MODEL if you want a model other than the default.",
  "Rerun `npm run dev -- init` if you want ProjectX to remember the key during setup.",
];

function stringifyEnvValue(value: string): string {
  if (value === "") {
    return "";
  }

  if (/[\s#"'=]/u.test(value)) {
    return JSON.stringify(value);
  }

  return value;
}

async function writeEnvFile(envFilePath: string, env: EnvMap): Promise<void> {
  const orderedKeys = [
    "GITHUB_TOKEN",
    "GITHUB_OWNER",
    "GITHUB_REPO",
    "TARGET_REPO_URL",
    "TARGET_REPO_PATH",
    "TARGET_BASE_BRANCH",
    "GITHUB_REPO_DESCRIPTION",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
  ];

  const extraKeys = Object.keys(env)
    .filter((key) => !orderedKeys.includes(key))
    .sort((left, right) => left.localeCompare(right));

  const lines = [...orderedKeys, ...extraKeys]
    .filter((key) => env[key] !== undefined)
    .map((key) => `${key}=${stringifyEnvValue(env[key]!)}`);

  await writeFile(envFilePath, `${lines.join("\n")}\n`, "utf8");
}

function parseGitHubRepoUrl(inputUrl: string): ParsedRepoUrl | null {
  const trimmed = inputUrl.trim();

  if (trimmed === "") {
    return null;
  }

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/u);

  if (sshMatch?.[1] && sshMatch[2]) {
    return {
      url: `https://github.com/${sshMatch[1]}/${sshMatch[2]}`,
      owner: sshMatch[1],
      repo: sshMatch[2],
    };
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.hostname !== "github.com") {
      return null;
    }

    const parts = parsed.pathname
      .split("/")
      .filter((segment) => segment !== "");

    if (parts.length < 2) {
      return null;
    }

    const owner = parts[0];
    const repo = parts[1]?.replace(/\.git$/u, "");

    if (!owner || !repo) {
      return null;
    }

    return {
      url: `https://github.com/${owner}/${repo}`,
      owner,
      repo,
    };
  } catch {
    return null;
  }
}

async function checkTargetRepoAccess(
  repo: ParsedRepoUrl,
  token: string | undefined,
): Promise<RepoAccessResult> {
  try {
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    if (token && token.trim() !== "") {
      headers.Authorization = `Bearer ${token.trim()}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.repo}`,
      {
        method: "GET",
        headers,
      },
    );

    if (response.ok) {
      const payload = (await response.json()) as {
        default_branch?: string;
        private?: boolean;
      };

      const result: RepoAccessResult = {
        accessible: true,
        message: `GitHub repo is accessible: ${repo.owner}/${repo.repo}`,
      };

      if (payload.default_branch !== undefined) {
        result.defaultBranch = payload.default_branch;
      }

      if (payload.private !== undefined) {
        result.private = payload.private;
      }

      return result;
    }

    if (response.status === 401) {
      return {
        accessible: false,
        message: "GitHub token was rejected by the API.",
        remediation: [
          ...GITHUB_TOKEN_SETUP_STEPS,
        ],
      };
    }

    if (response.status === 404) {
      return {
        accessible: false,
        message: `GitHub repo is not accessible: ${repo.owner}/${repo.repo}`,
        remediation: token
          ? [
              "Check that the repository URL is correct.",
              "Check that the token can access this repository.",
              "If the repo belongs to an organization, confirm the token is authorized for that organization.",
              "If needed, replace the token in ProjectX/.env as GITHUB_TOKEN=<your-token> and rerun `npm run dev -- init`.",
            ]
          : GITHUB_TOKEN_SETUP_STEPS,
      };
    }

    const responseText = await response.text();

    const result: RepoAccessResult = {
      accessible: false,
      message: `GitHub repo check failed: ${response.status} ${response.statusText}`,
    };

    if (responseText) {
      result.remediation = [`GitHub API response: ${responseText}`];
    }

    return result;
  } catch (error) {
    return {
      accessible: false,
      message:
        error instanceof Error
          ? `GitHub repo check failed: ${error.message}`
          : "GitHub repo check failed.",
      remediation: [
        "Check your network connection.",
        "Check that the GitHub URL is correct.",
        "If the repository is private, create or update ProjectX/.env with GITHUB_TOKEN=<your-token> and rerun `npm run dev -- init`.",
      ],
    };
  }
}

async function checkLocalTargetRepoPath(
  targetRepoPath: string,
  projectRoot: string,
): Promise<LocalPathCheckResult> {
  const resolvedPath = resolve(targetRepoPath);
  const normalizedProjectRoot = resolve(projectRoot);
  const projectRootWithSeparator = normalizedProjectRoot.endsWith(sep)
    ? normalizedProjectRoot
    : `${normalizedProjectRoot}${sep}`;
  const normalizedTargetPath = resolvedPath.endsWith(sep)
    ? resolvedPath
    : `${resolvedPath}${sep}`;

  if (
    normalizedTargetPath === projectRootWithSeparator ||
    normalizedTargetPath.startsWith(projectRootWithSeparator)
  ) {
    return {
      ok: false,
      resolvedPath,
      message:
        "Target repo path must live outside the ProjectX repository folder.",
    };
  }

  try {
    const targetStats = await stat(resolvedPath);

    if (!targetStats.isDirectory()) {
      return {
        ok: false,
        resolvedPath,
        message: "Target repo path exists but is not a directory.",
      };
    }

    try {
      await access(resolve(resolvedPath, ".git"), fsConstants.F_OK);
      return {
        ok: true,
        resolvedPath,
        message: "Local path already contains a git repository.",
      };
    } catch {
      return {
        ok: true,
        resolvedPath,
        message:
          "Local path exists but is not a git clone yet. ProjectX can use it as the future clone destination.",
      };
    }
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;

    if (fileError.code === "ENOENT") {
      try {
        const parentDir = dirname(resolvedPath);
        const parentStats = await stat(parentDir);

        if (!parentStats.isDirectory()) {
          return {
            ok: false,
            resolvedPath,
            message: "Parent directory for the target repo path is not valid.",
          };
        }

        return {
          ok: true,
          resolvedPath,
          message:
            "Local path does not exist yet, but its parent directory exists and can be used for a future clone.",
        };
      } catch {
        return {
          ok: false,
          resolvedPath,
          message:
            "Local path does not exist and its parent directory is not accessible.",
        };
      }
    }

    throw error;
  }
}

function getDefaultTargetRepoUrl(env: EnvMap): string {
  if (env.TARGET_REPO_URL) {
    return env.TARGET_REPO_URL;
  }

  if (env.GITHUB_OWNER && env.GITHUB_REPO) {
    return `https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
  }

  return "";
}

async function askQuestion(
  rl: ReturnType<typeof createInterface>,
  question: string,
): Promise<string> {
  return (await rl.question(question)).trim();
}

async function askBaseBranch(
  rl: ReturnType<typeof createInterface>,
  currentBaseBranch: string,
): Promise<string> {
  const normalizedCurrentBaseBranch = SUPPORTED_BASE_BRANCHES.includes(
    currentBaseBranch as (typeof SUPPORTED_BASE_BRANCHES)[number],
  )
    ? currentBaseBranch
    : DEFAULT_BASE_BRANCH;

  while (true) {
    const answer = (
      await askQuestion(
        rl,
        `Base branch - enter "main" or "master" [${normalizedCurrentBaseBranch}]: `,
      )
    ).toLowerCase();

    const selectedBranch =
      answer === "" ? normalizedCurrentBaseBranch : answer;

    if (
      SUPPORTED_BASE_BRANCHES.includes(
        selectedBranch as (typeof SUPPORTED_BASE_BRANCHES)[number],
      )
    ) {
      return selectedBranch;
    }

    console.log('Enter either "main" or "master".');
  }
}

async function askYesNo(
  rl: ReturnType<typeof createInterface>,
  question: string,
  defaultAnswer: "yes" | "no" = "yes",
): Promise<boolean> {
  const suffix = defaultAnswer === "yes" ? " [Y/n]: " : " [y/N]: ";

  while (true) {
    const answer = (await askQuestion(rl, `${question}${suffix}`)).toLowerCase();

    if (answer === "") {
      return defaultAnswer === "yes";
    }

    if (answer === "y" || answer === "yes") {
      return true;
    }

    if (answer === "n" || answer === "no") {
      return false;
    }

    console.log('Enter "y" or "n".');
  }
}

export async function runInit(projectRoot: string): Promise<void> {
  const existingEnv = await readExistingEnv(ENV_FILE_PATH);
  const rl = createInterface({ input, output });

  try {
    console.log("ProjectX init");
    console.log("");
    console.log("This command saves the target repository settings into .env.");
    console.log("");

    let parsedRepo: ParsedRepoUrl | null = null;
    const currentRepoUrl = getDefaultTargetRepoUrl(existingEnv);

    while (!parsedRepo) {
      const repoUrl = await askQuestion(
        rl,
        `Target repo URL${currentRepoUrl ? ` [${currentRepoUrl}]` : ""}: `,
      );
      const selectedRepoUrl = repoUrl === "" ? currentRepoUrl : repoUrl;

      parsedRepo = parseGitHubRepoUrl(selectedRepoUrl);

      if (!parsedRepo) {
        console.log(
          "Enter a valid GitHub repository URL, for example https://github.com/org/repo or git@github.com:org/repo.git",
        );
      }
    }

    let targetRepoPath = existingEnv.TARGET_REPO_PATH ?? "";
    let pathCheck: LocalPathCheckResult | null = null;

    while (!pathCheck?.ok) {
      const answer = await askQuestion(
        rl,
        `Local target repo path${targetRepoPath ? ` [${targetRepoPath}]` : ""}: `,
      );
      targetRepoPath = answer === "" ? targetRepoPath : answer;
      pathCheck = await checkLocalTargetRepoPath(targetRepoPath, projectRoot);

      if (!pathCheck.ok) {
        console.log(pathCheck.message);
      }
    }

    const currentBaseBranch = existingEnv.TARGET_BASE_BRANCH ?? DEFAULT_BASE_BRANCH;
    const baseBranch = await askBaseBranch(rl, currentBaseBranch);

    const hasExistingToken =
      typeof existingEnv.GITHUB_TOKEN === "string" &&
      existingEnv.GITHUB_TOKEN.trim() !== "";
    const tokenPrompt = hasExistingToken
      ? "GitHub token [press Enter to keep existing token]: "
      : "GitHub token [optional, needed for private repos and PR creation]: ";
    const tokenAnswer = await askQuestion(rl, tokenPrompt);
    const githubToken =
      tokenAnswer === ""
        ? existingEnv.GITHUB_TOKEN?.trim() || undefined
        : tokenAnswer.trim();
    const hasExistingOpenAiKey =
      typeof existingEnv.OPENAI_API_KEY === "string" &&
      existingEnv.OPENAI_API_KEY.trim() !== "";
    const openAiPrompt = hasExistingOpenAiKey
      ? "OpenAI API key [press Enter to keep existing key]: "
      : "OpenAI API key [optional, needed for code generation]: ";
    const openAiAnswer = await askQuestion(rl, openAiPrompt);
    const openAiApiKey =
      openAiAnswer === ""
        ? existingEnv.OPENAI_API_KEY?.trim() || undefined
        : openAiAnswer.trim();
    const currentOpenAiModel =
      existingEnv.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
    const openAiModelAnswer = await askQuestion(
      rl,
      `OpenAI model [${currentOpenAiModel}]: `,
    );
    const openAiModel =
      openAiModelAnswer === "" ? currentOpenAiModel : openAiModelAnswer.trim();

    console.log("");
    console.log("Checking target repository access...");

    const repoAccess = await checkTargetRepoAccess(parsedRepo, githubToken);
    console.log(repoAccess.message);

    if (repoAccess.remediation && repoAccess.remediation.length > 0) {
      for (const step of repoAccess.remediation) {
        console.log(`- ${step}`);
      }
    }

    console.log("");
    console.log(pathCheck.message);

    const configuredBaseBranch =
      repoAccess.defaultBranch && baseBranch === DEFAULT_BASE_BRANCH
        ? repoAccess.defaultBranch
        : baseBranch;

    const envToWrite: EnvMap = {
      ...existingEnv,
      GITHUB_OWNER: parsedRepo.owner,
      GITHUB_REPO: parsedRepo.repo,
      TARGET_REPO_URL: parsedRepo.url,
      TARGET_REPO_PATH: pathCheck.resolvedPath,
      TARGET_BASE_BRANCH: configuredBaseBranch,
    };

    if (githubToken && githubToken !== "") {
      envToWrite.GITHUB_TOKEN = githubToken;
    }

    if (openAiApiKey && openAiApiKey !== "") {
      envToWrite.OPENAI_API_KEY = openAiApiKey;
    }

    envToWrite.OPENAI_MODEL = openAiModel;

    await writeEnvFile(ENV_FILE_PATH, envToWrite);

    console.log("");
    console.log(`Saved configuration to ${ENV_FILE_PATH}`);
    console.log(`- Target repo: ${parsedRepo.owner}/${parsedRepo.repo}`);
    console.log(`- Local path: ${pathCheck.resolvedPath}`);
    console.log(`- Base branch: ${envToWrite.TARGET_BASE_BRANCH}`);
    console.log(
      `- OpenAI code generation: ${openAiApiKey ? "configured" : "not configured yet"}`,
    );

    if (!repoAccess.accessible) {
      console.log("");
      console.log(
        "ProjectX saved the config, but GitHub access is not ready yet. Fix the access issue above before running target-repo automation.",
      );
      console.log(
        `Token location: ${ENV_FILE_PATH} in the ProjectX repo root, using GITHUB_TOKEN=<your-token>`,
      );
      console.log("After updating the token, rerun `npm run dev -- init`.");
      return;
    }

    if (!openAiApiKey) {
      console.log("");
      console.log("OpenAI code generation is not configured yet.");
      for (const step of OPENAI_API_KEY_SETUP_STEPS) {
        console.log(`- ${step}`);
      }
      console.log("");
      console.log("ProjectX init cannot continue without OPENAI_API_KEY.");
      console.log("After setting the key, rerun `npm run dev -- init`.");
      return;
    }

    console.log("");
    const shouldCloneNow = await askYesNo(
      rl,
      "Should I clone the target repo now?",
      "yes",
    );

    if (shouldCloneNow) {
      console.log("");
      console.log("Cloning target repository...");

      const cloneResult = await cloneTargetRepository(
        parsedRepo.url,
        pathCheck.resolvedPath,
        configuredBaseBranch,
        githubToken,
      );

      if (!cloneResult.cloned) {
        console.log(cloneResult.error ?? "Failed to clone target repository.");
        console.log(
          "Fix the issue above, then rerun `npm run dev -- init` or `npm run dev -- clone-target`.",
        );
        return;
      }

      console.log(
        cloneResult.existing
          ? "Target repository already existed locally and was refreshed."
          : "Target repository cloned successfully.",
      );
      console.log(`Cloned repo path: ${cloneResult.path}`);
    }

    console.log("");
    console.log("Next steps:");
    if (!shouldCloneNow) {
      console.log("- Clone the target repo locally with `npm run dev -- clone-target`.");
    }
    console.log("- After the target repo is available locally, start with a brief requirement.");
    console.log(
      '- Run ProjectX with your request, for example: `npm run dev -- "Add Google login to the target app"`',
    );
    console.log(
      "- ProjectX will then generate the first planning artifacts for review and approval.",
    );
  } finally {
    rl.close();
  }
}
