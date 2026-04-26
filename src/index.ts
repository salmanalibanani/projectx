import { runOrchestrator } from "./orchestrator";

async function main() {
  const userRequest = process.argv.slice(2).join(" ");

  if (!userRequest) {
    console.log("Please provide a request.");
    console.log(
      'Example: npm run dev -- "Build TheSkeleton app with Google login"',
    );
    process.exit(1);
  }

  const result = await runOrchestrator(userRequest);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("ProjectX failed:", error);
  process.exit(1);
});
