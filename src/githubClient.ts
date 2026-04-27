import type {
  GitHubIssueResult,
  IssueDraft,
  PullRequestResult,
} from "./types.js";

type GitHubConfig = {
  token: string;
  owner: string;
  repo: string;
};

type GitHubIssueApiResponse = {
  body?: string;
  html_url?: string;
  number?: number;
  title?: string;
};

type GitHubPullRequestApiResponse = {
  html_url?: string;
  number?: number;
  state?: string;
  head?: {
    ref?: string;
  };
  base?: {
    ref?: string;
  };
};

function getGitHubHeaders(config: GitHubConfig): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${config.token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function hasMatchingProjectXMetadata(
  issueBody: string | undefined,
  workItemId: string,
): boolean {
  if (!issueBody) {
    return false;
  }

  const metadataPattern = new RegExp(
    `<!--\\s*projectx[\\s\\S]*?workItemId:\\s*${workItemId}[\\s\\S]*?-->`,
  );

  return metadataPattern.test(issueBody);
}

async function findExistingOpenIssue(
  config: GitHubConfig,
  workItemId: string,
  issueTitle: string,
): Promise<GitHubIssueResult | null> {
  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues?state=open&per_page=100`,
    {
      method: "GET",
      headers: getGitHubHeaders(config),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();

    return {
      created: false,
      error: `GitHub issue lookup failed: ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ""}`,
    };
  }

  const issues = (await response.json()) as GitHubIssueApiResponse[];
  const existingIssueByMetadata = issues.find((issue) =>
    hasMatchingProjectXMetadata(issue.body, workItemId),
  );
  const existingIssue =
    existingIssueByMetadata ?? issues.find((issue) => issue.title === issueTitle);

  if (!existingIssue) {
    return null;
  }

  const result: GitHubIssueResult = {
    created: false,
    existing: true,
  };

  if (existingIssue.html_url !== undefined) {
    result.url = existingIssue.html_url;
  }

  if (existingIssue.number !== undefined) {
    result.number = existingIssue.number;
  }

  return result;
}

export function getMissingGitHubEnvVars(env: NodeJS.ProcessEnv): string[] {
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
    const existingIssueResult = await findExistingOpenIssue(
      config,
      issueDraft.workItemId,
      issueDraft.title,
    );

    if (existingIssueResult?.error) {
      return existingIssueResult;
    }

    if (existingIssueResult) {
      return existingIssueResult;
    }

    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/issues`,
      {
        method: "POST",
        headers: getGitHubHeaders(config),
        body: JSON.stringify({
          title: issueDraft.title,
          body: issueDraft.body,
          labels: issueDraft.labels,
        }),
      },
    );

    if (!response.ok) {
      const responseText = await response.text();

      if (response.status === 422) {
        const fallbackResponse = await fetch(
          `https://api.github.com/repos/${config.owner}/${config.repo}/issues`,
          {
            method: "POST",
            headers: getGitHubHeaders(config),
            body: JSON.stringify({
              title: issueDraft.title,
              body: issueDraft.body,
            }),
          },
        );

        if (fallbackResponse.ok) {
          const fallbackData =
            (await fallbackResponse.json()) as GitHubIssueApiResponse;

          const result: GitHubIssueResult = {
            created: true,
            existing: false,
            warnings: [
              "GitHub issue was created without labels because one or more labels could not be applied.",
            ],
          };

          if (fallbackData.html_url !== undefined) {
            result.url = fallbackData.html_url;
          }

          if (fallbackData.number !== undefined) {
            result.number = fallbackData.number;
          }

          return result;
        }
      }

      return {
        created: false,
        error: `GitHub issue creation failed: ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ""}`,
      };
    }

    const data = (await response.json()) as GitHubIssueApiResponse;

    const result: GitHubIssueResult = {
      created: true,
      existing: false,
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

async function findExistingOpenPullRequest(
  config: GitHubConfig,
  sourceBranch: string,
  baseBranch: string,
): Promise<PullRequestResult | null> {
  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/pulls?state=open&head=${config.owner}:${sourceBranch}&base=${baseBranch}`,
    {
      method: "GET",
      headers: getGitHubHeaders(config),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();

    return {
      created: false,
      existing: false,
      sourceBranch,
      baseBranch,
      error: `GitHub pull request lookup failed: ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ""}`,
    };
  }

  const pullRequests = (await response.json()) as GitHubPullRequestApiResponse[];
  const existingPullRequest = pullRequests.find(
    (pullRequest) =>
      pullRequest.state === "open" &&
      pullRequest.head?.ref === sourceBranch &&
      pullRequest.base?.ref === baseBranch,
  );

  if (!existingPullRequest) {
    return null;
  }

  const result: PullRequestResult = {
    created: false,
    existing: true,
    alreadyExists: true,
    sourceBranch,
    headBranch: sourceBranch,
    baseBranch,
  };

  if (existingPullRequest.number !== undefined) {
    result.number = existingPullRequest.number;
  }

  if (existingPullRequest.html_url !== undefined) {
    result.url = existingPullRequest.html_url;
  }

  return result;
}

export async function createGitHubPullRequest(
  title: string,
  body: string,
  sourceBranch: string,
  baseBranch: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<PullRequestResult> {
  const config = getGitHubConfig(env);

  if (Array.isArray(config)) {
    return {
      created: false,
      existing: false,
      alreadyExists: false,
      sourceBranch,
      headBranch: sourceBranch,
      baseBranch,
      error: `Missing required environment variables: ${config.join(", ")}`,
    };
  }

  try {
    const existingPullRequestResult = await findExistingOpenPullRequest(
      config,
      sourceBranch,
      baseBranch,
    );

    if (existingPullRequestResult?.error) {
      return existingPullRequestResult;
    }

    if (existingPullRequestResult) {
      return existingPullRequestResult;
    }

    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/pulls`,
      {
        method: "POST",
        headers: getGitHubHeaders(config),
        body: JSON.stringify({
          title,
          body,
          head: sourceBranch,
          base: baseBranch,
        }),
      },
    );

    if (!response.ok) {
      const responseText = await response.text();

      return {
        created: false,
        existing: false,
        alreadyExists: false,
        sourceBranch,
        headBranch: sourceBranch,
        baseBranch,
        error: `GitHub pull request creation failed: ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ""}`,
      };
    }

    const data = (await response.json()) as GitHubPullRequestApiResponse;
    const result: PullRequestResult = {
      created: true,
      existing: false,
      alreadyExists: false,
      sourceBranch,
      headBranch: sourceBranch,
      baseBranch,
    };

    if (data.number !== undefined) {
      result.number = data.number;
    }

    if (data.html_url !== undefined) {
      result.url = data.html_url;
    }

    return result;
  } catch (error) {
    return {
      created: false,
      existing: false,
      alreadyExists: false,
      sourceBranch,
      headBranch: sourceBranch,
      baseBranch,
      error:
        error instanceof Error
          ? `GitHub pull request creation failed: ${error.message}`
          : "GitHub pull request creation failed: unknown error",
    };
  }
}
