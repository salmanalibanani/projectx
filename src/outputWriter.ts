import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

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
    const fileContents = filePath.endsWith(".requirements.md")
      ? renderRequirementsMarkdown(result)
      : renderIssueMarkdown(result);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, fileContents, "utf8");
  }
}
