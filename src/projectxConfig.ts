const TARGET_REPO_NAME = process.env.GITHUB_REPO ?? "projectx";
export const OUTPUT_BASE_PATH = `output/${TARGET_REPO_NAME}`;

export const SYSTEM_NAME = "ProjectX";
export const TARGET_APP_NAME = "TheSkeleton";
export const WORK_ITEM_ID = "theskeleton-google-login";
export const REPO_MODE = "standalone";
export const TARGET_APP_PATH =
  process.env.TARGET_REPO_PATH ?? "<target-repo-path>";
export const IMPLEMENTATION_BRANCH = "feature/theskeleton-google-login";
export const BASE_BRANCH = "main";
export const ISSUE_TITLE = "Build TheSkeleton Google login authentication";
export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

export const REQUIREMENTS_FILE_PATH = `${OUTPUT_BASE_PATH}/requirements/${WORK_ITEM_ID}.requirements.md`;
export const ISSUE_FILE_PATH = `${OUTPUT_BASE_PATH}/issues/${WORK_ITEM_ID}.md`;
export const IMPLEMENTATION_PLAN_FILE_PATH = `${OUTPUT_BASE_PATH}/plans/${WORK_ITEM_ID}.implementation-plan.md`;
export const APP_VERIFICATION_FILE_PATH = `${OUTPUT_BASE_PATH}/verification/${WORK_ITEM_ID}.app-verification.md`;
export const LEGACY_SCAFFOLD_VERIFICATION_FILE_PATH = `${OUTPUT_BASE_PATH}/verification/${WORK_ITEM_ID}.scaffold-verification.md`;
export const PR_SUMMARY_FILE_PATH = `${OUTPUT_BASE_PATH}/pr-summaries/${WORK_ITEM_ID}.pr-summary.md`;
export const POC_SUMMARY_FILE_PATH = `${OUTPUT_BASE_PATH}/logs/${WORK_ITEM_ID}.poc-summary.md`;
export const CODE_GENERATION_LOG_FILE_PATH = `${OUTPUT_BASE_PATH}/logs/${WORK_ITEM_ID}.code-generation.md`;

export const OUTPUT_DIRECTORIES = [
  `${OUTPUT_BASE_PATH}/issues`,
  `${OUTPUT_BASE_PATH}/requirements`,
  `${OUTPUT_BASE_PATH}/plans`,
  `${OUTPUT_BASE_PATH}/research`,
  `${OUTPUT_BASE_PATH}/verification`,
  `${OUTPUT_BASE_PATH}/pr-summaries`,
  `${OUTPUT_BASE_PATH}/release-notes`,
  `${OUTPUT_BASE_PATH}/logs`,
];

export const defaultGeneratedFiles = [
  REQUIREMENTS_FILE_PATH,
  IMPLEMENTATION_PLAN_FILE_PATH,
  ISSUE_FILE_PATH,
];
