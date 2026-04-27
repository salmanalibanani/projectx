export const SYSTEM_NAME = "ProjectX";
export const TARGET_APP_NAME = "TheSkeleton";
export const WORK_ITEM_ID = "theskeleton-google-login";
export const REPO_MODE = "monorepo";
export const TARGET_APP_PATH = "apps/theskeleton";
export const IMPLEMENTATION_BRANCH = "feature/theskeleton-google-login";
export const BASE_BRANCH = "main";
export const ISSUE_TITLE = "Build TheSkeleton Google login authentication";
export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

export const REQUIREMENTS_FILE_PATH =
  "output/requirements/theskeleton-google-login.requirements.md";
export const ISSUE_FILE_PATH = "output/issues/theskeleton-google-login.md";
export const IMPLEMENTATION_PLAN_FILE_PATH =
  "output/plans/theskeleton-google-login.implementation-plan.md";
export const APP_VERIFICATION_FILE_PATH =
  "output/verification/theskeleton-google-login.app-verification.md";
export const LEGACY_SCAFFOLD_VERIFICATION_FILE_PATH =
  "output/verification/theskeleton-google-login.scaffold-verification.md";
export const PR_SUMMARY_FILE_PATH =
  "output/pr/theskeleton-google-login.pr-summary.md";
export const POC_SUMMARY_FILE_PATH =
  "output/poc/theskeleton-google-login.poc-summary.md";
export const CODE_GENERATION_LOG_FILE_PATH =
  "output/code/theskeleton-google-login.code-generation.md";

export const requiredScaffoldFiles = [
  "apps/theskeleton/package.json",
  "apps/theskeleton/index.html",
  "apps/theskeleton/tsconfig.json",
  "apps/theskeleton/vite.config.ts",
  "apps/theskeleton/src/main.tsx",
  "apps/theskeleton/src/App.tsx",
  "apps/theskeleton/src/auth/googleAuthPlaceholder.ts",
] as const;

export const allowedCodeGenerationExactPaths = new Set([
  "apps/theskeleton/src/App.tsx",
  "apps/theskeleton/src/main.tsx",
  "apps/theskeleton/src/auth/googleAuthPlaceholder.ts",
  "apps/theskeleton/src/auth/googleAuth.ts",
  "apps/theskeleton/src/auth/AuthState.ts",
]);

export const allowedCodeGenerationPrefixPaths = [
  "apps/theskeleton/src/components/",
];

export const defaultGeneratedFiles = [
  REQUIREMENTS_FILE_PATH,
  IMPLEMENTATION_PLAN_FILE_PATH,
  ISSUE_FILE_PATH,
];
