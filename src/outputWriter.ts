import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { OrchestratorResult } from "./types.js";

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
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, renderIssueMarkdown(result), "utf8");
  }
}
