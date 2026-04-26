import { createGitHubIssue } from "./githubClient.js";
import { runOrchestrator } from "./orchestrator.js";
import { writeOrchestratorOutput } from "./outputWriter.js";

async function main() {
  const args = process.argv.slice(2);
  const shouldCreateGitHubIssue = args.includes("--create-github-issue");
  const userRequest = args
    .filter((arg) => arg !== "--create-github-issue")
    .join(" ");

  if (!userRequest) {
    console.log("Please provide a request.");
    console.log(
      'Example: npm run dev -- "Build TheSkeleton app with Google login"',
    );
    process.exit(1);
  }

  const result = await runOrchestrator(userRequest);
  await writeOrchestratorOutput(result);

  if (shouldCreateGitHubIssue) {
    result.githubIssue = await createGitHubIssue(result.issueDraft);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("ProjectX failed:", error);
  process.exit(1);
});
