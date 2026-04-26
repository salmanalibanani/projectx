export type OrchestratorResult = {
  request: string;
  appName: string;
  systemName: string;
  goal: string;
  steps: string[];
  requiresHumanApproval: string[];
};

export async function runOrchestrator(
  request: string,
): Promise<OrchestratorResult> {
  return {
    request,
    systemName: "ProjectX",
    appName: "TheSkeleton",
    goal: "Use ProjectX to plan the creation of TheSkeleton, a React app with Google login authentication.",
    steps: [
      "Clarify the requested app outcome.",
      "Create a GitHub issue for the work.",
      "Generate an implementation plan.",
      "Create a feature branch.",
      "Create the React app structure.",
      "Add Google login authentication.",
      "Run build and tests.",
      "Open a pull request.",
      "Prepare release notes.",
    ],
    requiresHumanApproval: [
      "Before pushing major code changes.",
      "Before deploying to staging.",
      "Before publishing release notes or social posts.",
    ],
  };
}
