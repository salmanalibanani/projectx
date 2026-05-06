import { Octokit } from "@octokit/core";

export type CreateRepositoryOptions = {
  private: boolean;
  description?: string | undefined;
};

export type CreateRepositoryResult = {
  created: boolean;
  alreadyExists?: boolean;
  owner: string;
  repoName: string;
  url?: string;
  cloneUrl?: string;
  error?: string;
};

function getCreateRepoConfig(
  env: NodeJS.ProcessEnv,
): { token: string; owner: string } | { missing: string[] } {
  const missing: string[] = [];

  if (!env.GITHUB_TOKEN) {
    missing.push("GITHUB_TOKEN");
  }

  if (!env.GITHUB_OWNER) {
    missing.push("GITHUB_OWNER");
  }

  if (missing.length > 0) {
    return { missing };
  }

  return {
    token: env.GITHUB_TOKEN as string,
    owner: env.GITHUB_OWNER as string,
  };
}

async function getAuthenticatedOwner(octokit: Octokit): Promise<string> {
  const response = await octokit.request("GET /user");

  if (!response.data || typeof response.data.login !== "string") {
    throw new Error("Unable to determine the authenticated GitHub user.");
  }

  return response.data.login;
}

export async function createGitHubRepository(
  repoName: string,
  options: CreateRepositoryOptions,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CreateRepositoryResult> {
  const config = getCreateRepoConfig(env);

  if ("missing" in config) {
    return {
      created: false,
      repoName,
      owner: env.GITHUB_OWNER ?? "unknown",
      error: `Missing required environment variables: ${config.missing.join(", ")}`,
    };
  }

  const octokit = new Octokit({ auth: config.token });

  let targetOwner = config.owner;
  let apiEndpoint = "/user/repos";
  let requestParams: Record<string, unknown> = {
    name: repoName,
    private: options.private,
  };

  if (options.description) {
    requestParams.description = options.description;
  }

  try {
    const authenticatedOwner = await getAuthenticatedOwner(octokit);

    if (authenticatedOwner.toLowerCase() !== config.owner.toLowerCase()) {
      apiEndpoint = "/orgs/{org}/repos";
      requestParams.org = config.owner;
    }

    const response = await octokit.request(apiEndpoint, requestParams);

    if (!response?.data || typeof response.data !== "object") {
      throw new Error("GitHub returned an unexpected repository response.");
    }

    const url =
      typeof response.data.html_url === "string"
        ? response.data.html_url
        : `https://github.com/${targetOwner}/${repoName}`;
    const cloneUrl =
      typeof response.data.clone_url === "string"
        ? response.data.clone_url
        : `https://github.com/${targetOwner}/${repoName}.git`;

    return {
      created: true,
      owner: targetOwner,
      repoName,
      url,
      cloneUrl,
    };
  } catch (error) {
    const err = error as any;
    const status = err.status ?? err?.response?.status;
    const githubMessage =
      err?.response?.data?.message ??
      err?.message ??
      "GitHub repository creation failed.";
    const errorMessage = status
      ? `GitHub error ${status}: ${githubMessage}`
      : githubMessage;

    if (status === 422) {
      return {
        created: false,
        alreadyExists: true,
        owner: targetOwner,
        repoName,
        url: `https://github.com/${targetOwner}/${repoName}`,
        error: `Repository may already exist: https://github.com/${targetOwner}/${repoName}`,
      };
    }

    if (status === 403) {
      return {
        created: false,
        owner: targetOwner,
        repoName,
        error: `${errorMessage} Permission denied. Check that the GitHub token can create repositories for the configured owner.`,
      };
    }

    return {
      created: false,
      owner: targetOwner,
      repoName,
      error: errorMessage,
    };
  }
}
