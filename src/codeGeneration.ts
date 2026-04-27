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

function extractResponseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const response = payload as {
    output_text?: string;
    choices?: Array<{
      message?: {
        content?:
          | string
          | Array<{
              type?: string;
              text?: string;
            }>;
      };
    }>;
  };

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const firstChoice = response.choices?.[0]?.message?.content;

  if (typeof firstChoice === "string" && firstChoice.trim()) {
    return firstChoice;
  }

  if (Array.isArray(firstChoice)) {
    const textValue = firstChoice
      .map((item) => item?.text ?? "")
      .join("")
      .trim();

    return textValue || null;
  }

  return null;
}

function parseFileUpdatePayload(text: string): OpenAIFileUpdatePayload {
  return JSON.parse(text) as OpenAIFileUpdatePayload;
}

function renderCodeGenerationLog(
  status: string,
  model: string,
  filesRead: string[],
  filesProposed: string[],
  filesChanged: string[],
  refusedFiles: string[],
  errors: string[],
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
): Promise<string> {
  const prompt = [
    "You are generating safe React TypeScript code updates for ProjectX.",
    `Target app path: ${TARGET_APP_PATH}`,
    "Return JSON only.",
    'Return shape: {"files":[{"path":"apps/theskeleton/src/...","content":"..."}]}',
    "Do not add markdown fences.",
    "Do not modify package.json.",
    "Do not include real OAuth secrets, client IDs, backend calls, or environment values.",
    "Create a clear placeholder auth boundary for future Google login wiring.",
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
  const responseText = extractResponseText(payload);

  if (!responseText) {
    throw new Error("OpenAI response did not contain JSON output text.");
  }

  return responseText;
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
    const responseText = await requestCodeChanges(
      model,
      env.OPENAI_API_KEY,
      context,
    );
    const parsedPayload = parseFileUpdatePayload(responseText);

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

    await writeCodeGenerationLog(
      succeeded ? "complete" : "refused",
      model,
      filesRead,
      parsedPayload.files.map((file) => file.path),
      filesChanged,
      refusedFiles,
      errors,
    );

    const result: CodeGenerationResult = {
      attempted: true,
      succeeded,
      model,
      logFile: CODE_GENERATION_LOG_FILE_PATH,
      filesChanged,
      refusedFiles,
    };

    if (errors.length > 0) {
      result.error = errors.join(" ");
    }

    return result;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "OpenAI code generation failed with an unknown error.";

    await writeCodeGenerationLog(
      "failed",
      model,
      filesRead,
      [],
      filesChanged,
      refusedFiles,
      [message],
    );

    return {
      attempted: true,
      succeeded: false,
      model,
      logFile: CODE_GENERATION_LOG_FILE_PATH,
      filesChanged,
      refusedFiles,
      error: message,
    };
  }
}
