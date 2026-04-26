import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

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

export async function writeOrchestratorOutput(
  result: OrchestratorResult,
): Promise<void> {
  for (const filePath of result.generatedFiles) {
    let fileContents = renderIssueMarkdown(result);

    if (filePath.endsWith(".requirements.md")) {
      const requirementsDraft = { ...result.requirementsDraft };

      try {
        requirementsDraft.status = await readRequirementsStatus(filePath);
      } catch {
        requirementsDraft.status = result.requirementsDraft.status;
      }

      fileContents = renderRequirementsMarkdown({
        ...result,
        requirementsDraft,
      });
    }

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, fileContents, "utf8");
  }
}
