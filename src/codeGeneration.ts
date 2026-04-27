import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { scaffoldFiles } from "./appScaffold.js";
import {
  allowedCodeGenerationExactPaths,
  allowedCodeGenerationPrefixPaths,
  CODE_GENERATION_LOG_FILE_PATH,
  DEFAULT_OPENAI_MODEL,
  IMPLEMENTATION_PLAN_FILE_PATH,
  REQUIREMENTS_FILE_PATH,
  TARGET_APP_PATH,
} from "./projectxConfig.js";
import type { CodeGenerationResult } from "./types.js";

const RAW_TEXT_LOG_LIMIT = 4000;
const promptAllowedFiles = [
  "apps/theskeleton/src/App.tsx",
  "apps/theskeleton/src/main.tsx",
  "apps/theskeleton/src/auth/googleAuthPlaceholder.ts",
] as const;

type ProposedFileUpdate = {
  path: string;
  content: string;
};

type OpenAIFileUpdatePayload = {
  files?: ProposedFileUpdate[];
};

type CodeGenerationContext = {
  requirements: string;
  implementationPlan: string;
  files: Record<string, string>;
};

type ResponseContentItem = {
  type?: string;
  text?: string;
  [key: string]: unknown;
};

type ResponseOutputItem = {
  type?: string;
  status?: string;
  content?: ResponseContentItem[];
  [key: string]: unknown;
};

type ResponseDiagnostics = {
  responseId?: string;
  responseStatus?: string;
  finishReason?: string;
  outputItemTypes: string[];
  outputStatuses: string[];
};

type ExtractedResponseText = {
  text: string | null;
  diagnostics: ResponseDiagnostics;
};

function isAllowedCodeGenerationPath(filePath: string): boolean {
  if (allowedCodeGenerationExactPaths.has(filePath)) {
    return true;
  }

  return allowedCodeGenerationPrefixPaths.some((prefix) =>
    filePath.startsWith(prefix),
  );
}

async function readFileIfPresent(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;

    if (fileError.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function truncateText(text: string, maxLength = RAW_TEXT_LOG_LIMIT): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
}

function extractTextFromContentItems(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const contentItem = item as ResponseContentItem;

      if (
        contentItem.type === "output_text" &&
        typeof contentItem.text === "string" &&
        contentItem.text.trim()
      ) {
        return [contentItem.text];
      }

      if (typeof contentItem.text === "string" && contentItem.text.trim()) {
        return [contentItem.text];
      }

      return [];
    })
    .join("")
    .trim();
}

export function extractResponseText(payload: unknown): ExtractedResponseText {
  const diagnostics: ResponseDiagnostics = {
    outputItemTypes: [],
    outputStatuses: [],
  };

  if (!payload || typeof payload !== "object") {
    return { text: null, diagnostics };
  }

  const response = payload as {
    id?: string;
    status?: string;
    output_text?: string;
    output?: ResponseOutputItem[];
    choices?: Array<{
      finish_reason?: string;
      message?: {
        content?: string | ResponseContentItem[];
      };
    }>;
  };

  if (typeof response.id === "string") {
    diagnostics.responseId = response.id;
  }

  if (typeof response.status === "string") {
    diagnostics.responseStatus = response.status;
  }

  if (
    typeof response.output_text === "string" &&
    response.output_text.trim().length > 0
  ) {
    return {
      text: response.output_text.trim(),
      diagnostics,
    };
  }

  if (Array.isArray(response.output)) {
    diagnostics.outputItemTypes = response.output
      .map((item) => item?.type)
      .filter((value): value is string => typeof value === "string");
    diagnostics.outputStatuses = response.output
      .map((item) => item?.status)
      .filter((value): value is string => typeof value === "string");

    const outputText = response.output
      .map((item) => extractTextFromContentItems(item?.content))
      .join("")
      .trim();

    if (outputText) {
      return {
        text: outputText,
        diagnostics,
      };
    }
  }

  const firstChoice = response.choices?.[0];

  if (typeof firstChoice?.finish_reason === "string") {
    diagnostics.finishReason = firstChoice.finish_reason;
  }

  const choiceContent = firstChoice?.message?.content;

  if (typeof choiceContent === "string" && choiceContent.trim()) {
    return {
      text: choiceContent.trim(),
      diagnostics,
    };
  }

  const choiceText = extractTextFromContentItems(choiceContent);

  if (choiceText) {
    return {
      text: choiceText,
      diagnostics,
    };
  }

  return { text: null, diagnostics };
}

function unwrapMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fencedMatch?.[1]?.trim() ?? trimmed;
}

function findFirstTopLevelJsonObject(text: string): string | null {
  const trimmed = unwrapMarkdownCodeFence(text);

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;
  let startIndex = -1;

  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (character === "\\") {
      isEscaped = true;
      continue;
    }

    if (character === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        startIndex = index;
      }

      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0 && startIndex >= 0) {
        return trimmed.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

export function parseFileUpdatePayload(text: string): OpenAIFileUpdatePayload {
  const candidateJson = findFirstTopLevelJsonObject(text);

  if (!candidateJson) {
    throw new Error("OpenAI response text did not contain a top-level JSON object.");
  }

  return JSON.parse(candidateJson) as OpenAIFileUpdatePayload;
}

function renderDiagnosticsSection(
  diagnostics: ResponseDiagnostics | undefined,
  rawModelText: string | undefined,
): string[] {
  if (!diagnostics && !rawModelText) {
    return [];
  }

  const lines = ["## Diagnostics"];

  if (diagnostics) {
    lines.push(
      `- Response ID: ${diagnostics.responseId ?? "Unavailable"}`,
      `- Response status: ${diagnostics.responseStatus ?? "Unavailable"}`,
      `- Finish reason: ${diagnostics.finishReason ?? "Unavailable"}`,
      `- Output item types: ${diagnostics.outputItemTypes.length > 0 ? diagnostics.outputItemTypes.join(", ") : "Unavailable"}`,
      `- Output item statuses: ${diagnostics.outputStatuses.length > 0 ? diagnostics.outputStatuses.join(", ") : "Unavailable"}`,
    );
  }

  if (rawModelText) {
    lines.push("", "## Raw extracted model text (truncated)", "```text", rawModelText, "```");
  }

  lines.push("");

  return lines;
}

function renderCodeGenerationLog(
  status: string,
  model: string,
  filesRead: string[],
  filesProposed: string[],
  filesChanged: string[],
  refusedFiles: string[],
  errors: string[],
  diagnostics?: ResponseDiagnostics,
  rawModelText?: string,
): string {
  return [
    "# TheSkeleton code generation log",
    "",
    `Status: ${status}`,
    "",
    "Work item ID: theskeleton-google-login",
    "",
    `Model used: ${model}`,
    "",
    "## Files read",
    ...filesRead.map((filePath) => `- ${filePath}`),
    "",
    "## Files proposed",
    ...(filesProposed.length > 0
      ? filesProposed.map((filePath) => `- ${filePath}`)
      : ["- None"]),
    "",
    "## Files changed",
    ...(filesChanged.length > 0
      ? filesChanged.map((filePath) => `- ${filePath}`)
      : ["- None"]),
    "",
    "## Refused files",
    ...(refusedFiles.length > 0
      ? refusedFiles.map((filePath) => `- ${filePath}`)
      : ["- None"]),
    "",
    "## Errors",
    ...(errors.length > 0 ? errors.map((error) => `- ${error}`) : ["- None"]),
    "",
    ...renderDiagnosticsSection(diagnostics, rawModelText),
    "Generated code must be reviewed before it is committed, pushed, or included in a pull request.",
    "",
  ].join("\n");
}

async function writeCodeGenerationLog(
  status: string,
  model: string,
  filesRead: string[],
  filesProposed: string[],
  filesChanged: string[],
  refusedFiles: string[],
  errors: string[],
  diagnostics?: ResponseDiagnostics,
  rawModelText?: string,
): Promise<void> {
  await mkdir(dirname(CODE_GENERATION_LOG_FILE_PATH), { recursive: true });
  await writeFile(
    CODE_GENERATION_LOG_FILE_PATH,
    renderCodeGenerationLog(
      status,
      model,
      filesRead,
      filesProposed,
      filesChanged,
      refusedFiles,
      errors,
      diagnostics,
      rawModelText,
    ),
    "utf8",
  );
}

async function buildCodeGenerationContext(): Promise<CodeGenerationContext> {
  const currentFiles: Record<string, string> = {};
  const contextualFiles = [
    "apps/theskeleton/src/App.tsx",
    "apps/theskeleton/src/main.tsx",
    "apps/theskeleton/src/auth/googleAuthPlaceholder.ts",
  ];

  for (const filePath of contextualFiles) {
    const fileContents = await readFileIfPresent(filePath);

    if (fileContents !== null) {
      currentFiles[filePath] = fileContents;
    }
  }

  return {
    requirements: (await readFileIfPresent(REQUIREMENTS_FILE_PATH)) ?? "",
    implementationPlan:
      (await readFileIfPresent(IMPLEMENTATION_PLAN_FILE_PATH)) ?? "",
    files: currentFiles,
  };
}

async function requestCodeChanges(
  model: string,
  apiKey: string,
  context: CodeGenerationContext,
): Promise<{
  extractedText: string;
  diagnostics: ResponseDiagnostics;
}> {
  const prompt = [
    "You are generating safe React TypeScript code updates for ProjectX.",
    `Target app path: ${TARGET_APP_PATH}`,
    "Return JSON only.",
    "Do not use markdown.",
    "Do not include explanations outside JSON.",
    'Return shape: {"files":[{"path":"apps/theskeleton/src/...","content":"..."}]}',
    "Only propose file updates for the explicitly listed allowed files.",
    "Prefer modifying existing scaffold files.",
    "Do not create new files unless they are explicitly listed in the allowed paths.",
    "Do not create requirements, plans, PR summaries, logs, docs, or output files inside apps/theskeleton.",
    "Requirements live in ProjectX output/requirements, not inside the React app.",
    "Do not create auth.tsx.",
    "Keep all auth boundary code inside apps/theskeleton/src/auth/googleAuthPlaceholder.ts for this POC.",
    "Keep UI code inside apps/theskeleton/src/App.tsx for this POC.",
    "No secrets.",
    "No real Google client ID.",
    "No package.json changes.",
    "No dependency changes.",
    "",
    "Allowed files for this run:",
    ...promptAllowedFiles.map((filePath) => `- ${filePath}`),
    "",
    "The model must not return any other path.",
    "",
    "Approved requirements:",
    context.requirements,
    "",
    "Approved implementation plan:",
    context.implementationPlan,
    "",
    "Current files:",
    JSON.stringify(context.files, null, 2),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `OpenAI code generation failed: ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ""}`,
    );
  }

  const payload = (await response.json()) as unknown;
  const extracted = extractResponseText(payload);

  if (!extracted.text) {
    await writeCodeGenerationLog(
      "failed",
      model,
      [
        REQUIREMENTS_FILE_PATH,
        IMPLEMENTATION_PLAN_FILE_PATH,
        "apps/theskeleton/src/App.tsx",
        "apps/theskeleton/src/main.tsx",
        "apps/theskeleton/src/auth/googleAuthPlaceholder.ts",
      ],
      [],
      [],
      [],
      [
        `OpenAI response did not contain JSON output text. See diagnostic log: ${CODE_GENERATION_LOG_FILE_PATH}`,
      ],
      extracted.diagnostics,
    );

    throw new Error(
      `OpenAI response did not contain JSON output text. See diagnostic log: ${CODE_GENERATION_LOG_FILE_PATH}`,
    );
  }

  return {
    extractedText: extracted.text,
    diagnostics: extracted.diagnostics,
  };
}

export async function generateCodeWithOpenAI(
  env: NodeJS.ProcessEnv = process.env,
): Promise<CodeGenerationResult> {
  const model = env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const filesRead = [
    REQUIREMENTS_FILE_PATH,
    IMPLEMENTATION_PLAN_FILE_PATH,
    "apps/theskeleton/src/App.tsx",
    "apps/theskeleton/src/main.tsx",
    "apps/theskeleton/src/auth/googleAuthPlaceholder.ts",
  ];
  const filesChanged: string[] = [];
  const refusedFiles: string[] = [];
  const errors: string[] = [];

  if (!env.OPENAI_API_KEY) {
    const error = "OPENAI_API_KEY is required for code generation.";

    await writeCodeGenerationLog(
      "not-attempted",
      model,
      filesRead,
      [],
      [],
      [],
      [error],
    );

    return {
      attempted: false,
      succeeded: false,
      model,
      logFile: CODE_GENERATION_LOG_FILE_PATH,
      filesChanged,
      refusedFiles,
      error,
    };
  }

  try {
    const context = await buildCodeGenerationContext();
    const { extractedText, diagnostics } = await requestCodeChanges(
      model,
      env.OPENAI_API_KEY,
      context,
    );
    let parsedPayload: OpenAIFileUpdatePayload;

    try {
      parsedPayload = parseFileUpdatePayload(extractedText);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to parse OpenAI JSON response.";

      await writeCodeGenerationLog(
        "failed",
        model,
        filesRead,
        [],
        filesChanged,
        refusedFiles,
        [`${message} See diagnostic log: ${CODE_GENERATION_LOG_FILE_PATH}`],
        diagnostics,
        truncateText(extractedText),
      );

      throw new Error(
        `${message} See diagnostic log: ${CODE_GENERATION_LOG_FILE_PATH}`,
      );
    }

    if (!Array.isArray(parsedPayload.files)) {
      throw new Error("OpenAI response JSON must contain a files array.");
    }

    for (const proposedFile of parsedPayload.files) {
      if (
        !proposedFile ||
        typeof proposedFile.path !== "string" ||
        typeof proposedFile.content !== "string"
      ) {
        throw new Error(
          "OpenAI response JSON must contain file entries with string path and content values.",
        );
      }
    }

    for (const proposedFile of parsedPayload.files) {
      if (!isAllowedCodeGenerationPath(proposedFile.path)) {
        refusedFiles.push(proposedFile.path);
        errors.push(`Refused unsafe file path: ${proposedFile.path}`);
        continue;
      }

      const existingContents = await readFileIfPresent(proposedFile.path);
      const scaffoldTemplate =
        scaffoldFiles[proposedFile.path as keyof typeof scaffoldFiles];

      if (
        existingContents !== null &&
        scaffoldTemplate !== undefined &&
        existingContents !== scaffoldTemplate
      ) {
        refusedFiles.push(proposedFile.path);
        errors.push(
          `Refused to overwrite user-edited scaffold file: ${proposedFile.path}`,
        );
        continue;
      }

      if (
        existingContents !== null &&
        scaffoldTemplate === undefined &&
        existingContents !== proposedFile.content
      ) {
        refusedFiles.push(proposedFile.path);
        errors.push(
          `Refused to overwrite existing non-scaffold file: ${proposedFile.path}`,
        );
        continue;
      }

      if (existingContents === proposedFile.content) {
        continue;
      }

      await mkdir(dirname(proposedFile.path), { recursive: true });
      await writeFile(proposedFile.path, proposedFile.content, "utf8");
      filesChanged.push(proposedFile.path);
    }

    const succeeded = errors.length === 0;
    const proposedUnsafeFiles = refusedFiles.length > 0;
    const logErrors = [...errors];

    if (proposedUnsafeFiles) {
      logErrors.unshift(
        "The model proposed files outside the allowed list. No unsafe files were written.",
      );
    }

    await writeCodeGenerationLog(
      succeeded ? "complete" : "refused",
      model,
      filesRead,
      parsedPayload.files.map((file) => file.path),
      filesChanged,
      refusedFiles,
      logErrors,
      diagnostics,
    );

    const result: CodeGenerationResult = {
      attempted: true,
      succeeded,
      model,
      logFile: CODE_GENERATION_LOG_FILE_PATH,
      filesChanged,
      refusedFiles,
    };

    if (logErrors.length > 0) {
      result.error = logErrors.join(" ");
    }

    return result;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "OpenAI code generation failed with an unknown error.";

    const result: CodeGenerationResult = {
      attempted: true,
      succeeded: false,
      model,
      logFile: CODE_GENERATION_LOG_FILE_PATH,
      filesChanged,
      refusedFiles,
      error: message,
    };

    if (!(await readFileIfPresent(CODE_GENERATION_LOG_FILE_PATH))) {
      await writeCodeGenerationLog(
        "failed",
        model,
        filesRead,
        [],
        filesChanged,
        refusedFiles,
        [message],
      );
    }

    return result;
  }
}
