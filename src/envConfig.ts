import { readFile } from "node:fs/promises";

export type EnvMap = Record<string, string>;

export type TargetRepoSettings = {
  repoUrl: string;
  repoPath: string;
  baseBranch: string;
  token?: string;
  openAiApiKey?: string;
  openAiModel?: string;
};

export function parseEnvContents(contents: string): EnvMap {
  const env: EnvMap = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key !== "") {
      env[key] = value;
    }
  }

  return env;
}

export async function readExistingEnv(
  envFilePath: string,
): Promise<EnvMap> {
  try {
    const contents = await readFile(envFilePath, "utf8");
    return parseEnvContents(contents);
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;

    if (fileError.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

export async function loadEnvIntoProcessEnv(
  envFilePath = ".env",
): Promise<void> {
  const env = await readExistingEnv(envFilePath);

  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function getTargetRepoSettingsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): TargetRepoSettings | string[] {
  const missing: string[] = [];

  if (!env.TARGET_REPO_URL) {
    missing.push("TARGET_REPO_URL");
  }

  if (!env.TARGET_REPO_PATH) {
    missing.push("TARGET_REPO_PATH");
  }

  if (!env.TARGET_BASE_BRANCH) {
    missing.push("TARGET_BASE_BRANCH");
  }

  if (missing.length > 0) {
    return missing;
  }

  const result: TargetRepoSettings = {
    repoUrl: env.TARGET_REPO_URL!,
    repoPath: env.TARGET_REPO_PATH!,
    baseBranch: env.TARGET_BASE_BRANCH!,
  };

  if (env.GITHUB_TOKEN && env.GITHUB_TOKEN.trim() !== "") {
    result.token = env.GITHUB_TOKEN.trim();
  }

  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim() !== "") {
    result.openAiApiKey = env.OPENAI_API_KEY.trim();
  }

  if (env.OPENAI_MODEL && env.OPENAI_MODEL.trim() !== "") {
    result.openAiModel = env.OPENAI_MODEL.trim();
  }

  return result;
}
