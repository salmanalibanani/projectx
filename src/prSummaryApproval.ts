import { readFile } from "node:fs/promises";

import type { PrSummaryStatus } from "./types.js";

const STATUS_LINE_PATTERN = /^Status:\s*(.+)$/m;

export function parsePrSummaryStatus(markdown: string): PrSummaryStatus {
  const match = markdown.match(STATUS_LINE_PATTERN);
  const statusValue = match?.[1]?.trim().toLowerCase();

  if (statusValue === "approved") {
    return "approved";
  }

  return "draft";
}

export async function readPrSummaryStatus(
  filePath: string,
): Promise<PrSummaryStatus> {
  const markdown = await readFile(filePath, "utf8");

  return parsePrSummaryStatus(markdown);
}
