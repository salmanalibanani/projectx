import { readFile } from "node:fs/promises";

import type { RequirementsStatus } from "./types.js";

const STATUS_LINE_PATTERN = /^Status:\s*(.+)$/m;

export function parseRequirementsStatus(markdown: string): RequirementsStatus {
  const match = markdown.match(STATUS_LINE_PATTERN);
  const statusValue = match?.[1]?.trim().toLowerCase();

  if (statusValue === "approved") {
    return "approved";
  }

  return "draft";
}

export async function readRequirementsStatus(
  filePath: string,
): Promise<RequirementsStatus> {
  const markdown = await readFile(filePath, "utf8");

  return parseRequirementsStatus(markdown);
}
