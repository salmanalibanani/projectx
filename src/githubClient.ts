import type { GitHubIssueResult, IssueDraft } from "./types.js";

type GitHubConfig = {
  token: string;
  owner: string;
  repo: string;
};

type GitHubIssueApiResponse = {
  html_url?: string;
  number?: number;
};

function getMissingGitHubEnvVars(env: NodeJS.ProcessEnv): string[] {
  const requiredVars = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"] as const;

  return requiredVars.filter((name) => !env[name]);
}

function getGitHubConfig(env: NodeJS.ProcessEnv): GitHubConfig | string[] {
  const missingVars = getMissingGitHubEnvVars(env);

  if (missingVars.length > 0) {
    return missingVars;
  }

  return {
    token: env.GITHUB_TOKEN!,
    owner: env.GITHUB_OWNER!,
    repo: env.GITHUB_REPO!,
  };
}

export async function createGitHubIssue(
  issueDraft: IssueDraft,
  env: NodeJS.ProcessEnv = process.env,
): Promise<GitHubIssueResult> {
  const config = getGitHubConfig(env);

  if (Array.isArray(config)) {
    return {
      created: false,
      error: `Missing required environment variables: ${config.join(", ")}`,
    };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/issues`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          title: issueDraft.title,
          body: issueDraft.body,
          labels: issueDraft.labels,
        }),
      },
    );

    if (!response.ok) {
      const responseText = await response.text();

      return {
        created: false,
        error: `GitHub issue creation failed: ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ""}`,
      };
    }

    const data = (await response.json()) as GitHubIssueApiResponse;

    const result: GitHubIssueResult = {
      created: true,
    };

    if (data.html_url !== undefined) {
      result.url = data.html_url;
    }

    if (data.number !== undefined) {
      result.number = data.number;
    }

    return result;
  } catch (error) {
    return {
      created: false,
      error:
        error instanceof Error
          ? `GitHub issue creation failed: ${error.message}`
          : "GitHub issue creation failed: unknown error",
    };
  }
}
