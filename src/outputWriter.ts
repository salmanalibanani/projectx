import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { readImplementationPlanStatus } from "./implementationPlanApproval.js";
import {
  IMPLEMENTATION_PLAN_FILE_PATH,
  ISSUE_FILE_PATH,
  REQUIREMENTS_FILE_PATH,
} from "./projectxConfig.js";
import { readRequirementsStatus } from "./requirementsApproval.js";
import type { OrchestratorResult } from "./types.js";

function renderRequirementsMarkdown(result: OrchestratorResult): string {
  const sectionLines = result.requirementsDraft.sections.flatMap((section) => [
    `## ${section.title}`,
    ...section.content,
    "",
  ]);

  return [
    `# ${result.requirementsDraft.title}`,
    "",
    `Work item ID: ${result.requirementsDraft.workItemId}`,
    "",
    `Status: ${result.requirementsDraft.status}`,
    "",
    `Source request: ${result.requirementsDraft.sourceRequest}`,
    "",
    `Target app: ${result.requirementsDraft.targetAppName}`,
    "",
    ...sectionLines,
  ].join("\n");
}

function renderIssueMarkdown(result: OrchestratorResult): string {
  const labelsLine = `Labels: ${result.issueDraft.labels.join(", ")}`;

  return [
    `# ${result.issueDraft.title}`,
    "",
    `Work item ID: ${result.issueDraft.workItemId}`,
    "",
    labelsLine,
    "",
    result.issueDraft.body,
    "",
  ].join("\n");
}

function renderImplementationPlanMarkdown(
  result: OrchestratorResult,
  sourceRequirementsStatus: string,
): string {
  const sectionLines = result.implementationPlan.sections.flatMap((section) => [
    `## ${section.title}`,
    ...section.content,
    "",
  ]);

  return [
    `# ${result.implementationPlan.title}`,
    "",
    `Work item ID: ${result.implementationPlan.workItemId}`,
    "",
    `Status: ${result.implementationPlan.status}`,
    "",
    `Source requirements file: ${result.implementationPlan.sourceRequirementsFile}`,
    "",
    `Source requirements status: ${sourceRequirementsStatus}`,
    "",
    `Target app: ${result.implementationPlan.targetAppName}`,
    "",
    ...sectionLines,
  ].join("\n");
}

async function writeFileIfMissingOrSame(
  filePath: string,
  contents: string,
): Promise<void> {
  try {
    const existingContents = await readFile(filePath, "utf8");

    if (existingContents !== contents) {
      return;
    }
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;

    if (fileError.code !== "ENOENT") {
      throw error;
    }
  }

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}

export async function writeRequirementsDraft(
  result: OrchestratorResult,
): Promise<void> {
  let status = result.requirementsDraft.status;

  try {
    status = await readRequirementsStatus(REQUIREMENTS_FILE_PATH);
  } catch {
    status = result.requirementsDraft.status;
  }

  await writeFileIfMissingOrSame(
    REQUIREMENTS_FILE_PATH,
    renderRequirementsMarkdown({
      ...result,
      requirementsDraft: {
        ...result.requirementsDraft,
        status,
      },
    }),
  );
}

export async function writeIssueDraft(result: OrchestratorResult): Promise<void> {
  await writeFileIfMissingOrSame(ISSUE_FILE_PATH, renderIssueMarkdown(result));
}

export async function writeImplementationPlan(
  result: OrchestratorResult,
): Promise<void> {
  let sourceRequirementsStatus = result.requirementsDraft.status;
  let implementationPlanStatus = result.implementationPlan.status;

  try {
    sourceRequirementsStatus = await readRequirementsStatus(REQUIREMENTS_FILE_PATH);
  } catch {
    sourceRequirementsStatus = result.requirementsDraft.status;
  }

  try {
    implementationPlanStatus = await readImplementationPlanStatus(
      IMPLEMENTATION_PLAN_FILE_PATH,
    );
  } catch {
    implementationPlanStatus = result.implementationPlan.status;
  }

  await writeFileIfMissingOrSame(
    IMPLEMENTATION_PLAN_FILE_PATH,
    renderImplementationPlanMarkdown(
      {
        ...result,
        implementationPlan: {
          ...result.implementationPlan,
          status: implementationPlanStatus,
        },
      },
      sourceRequirementsStatus,
    ),
  );
}

export async function writeOrchestratorOutput(
  result: OrchestratorResult,
): Promise<void> {
  await writeRequirementsDraft(result);
  await writeImplementationPlan(result);
  await writeIssueDraft(result);
}
