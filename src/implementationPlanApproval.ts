import { readFile } from "node:fs/promises";

import type { ImplementationPlanStatus } from "./types.js";

const STATUS_LINE_PATTERN = /^Status:\s*(.+)$/m;

export function parseImplementationPlanStatus(
  markdown: string,
): ImplementationPlanStatus {
  const match = markdown.match(STATUS_LINE_PATTERN);
  const statusValue = match?.[1]?.trim().toLowerCase();

  if (statusValue === "approved") {
    return "approved";
  }

  return "draft";
}

export async function readImplementationPlanStatus(
  filePath: string,
): Promise<ImplementationPlanStatus> {
  const markdown = await readFile(filePath, "utf8");

  return parseImplementationPlanStatus(markdown);
}
