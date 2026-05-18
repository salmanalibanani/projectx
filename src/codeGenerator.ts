import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";

import { DEFAULT_OPENAI_MODEL, OUTPUT_BASE_PATH } from "./projectxConfig.js";
import type {
  CodeGenerationPreparationResult,
  CodeGenerationResult,
} from "./types.js";

type RepoContextFile = {
  path: string;
  content: string;
};

type GeneratedFile = {
  path: string;
  content: string;
};

type ModelOutput = {
  summary: string;
  files: GeneratedFile[];
  refusedFiles?: string[];
};

const MAX_FILE_SIZE_BYTES = 24_000;
const MAX_CONTEXT_FILES = 20;
const MAX_CONTEXT_CHARS = 120_000;
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  "output",
  "coverage",
  ".next",
  ".turbo",
]);

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/gu, "/");
}

function isLikelyTextFile(filePath: string): boolean {
  const extension = extname(filePath).toLowerCase();

  return new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".css",
    ".scss",
    ".html",
    ".txt",
    ".yml",
    ".yaml",
    ".xml",
    ".env",
  ]).has(extension) || extension === "";
}

function scoreRepoFile(filePath: string): number {
  const normalized = normalizeRelativePath(filePath).toLowerCase();
  let score = 0;

  if (normalized === "readme.md") {
    score += 120;
  }

  if (
    normalized.endsWith("/readme.md") ||
    normalized === "package.json" ||
    normalized === "tsconfig.json"
  ) {
    score += 100;
  }

  if (normalized.startsWith("src/")) {
    score += 80;
  }

  if (normalized.startsWith("app/") || normalized.startsWith("pages/")) {
    score += 70;
  }

  if (normalized.includes("test") || normalized.includes("spec")) {
    score -= 10;
  }

  score -= Math.floor(normalized.length / 10);

  return score;
}

async function collectRepoFiles(
  rootPath: string,
  currentPath = rootPath,
): Promise<string[]> {
  const entries = await readdir(currentPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      files.push(...(await collectRepoFiles(rootPath, join(currentPath, entry.name))));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fullPath = join(currentPath, entry.name);
    const relativePath = normalizeRelativePath(relative(rootPath, fullPath));

    if (!isLikelyTextFile(relativePath)) {
      continue;
    }

    files.push(relativePath);
  }

  return files;
}

async function loadRepoContext(repoPath: string): Promise<RepoContextFile[]> {
  const allFiles = await collectRepoFiles(repoPath);
  const selectedFiles = allFiles
    .sort((left, right) => scoreRepoFile(right) - scoreRepoFile(left))
    .slice(0, MAX_CONTEXT_FILES);
  const result: RepoContextFile[] = [];
  let currentChars = 0;

  for (const relativePath of selectedFiles) {
    const fullPath = join(repoPath, relativePath);
    const fileStats = await stat(fullPath);

    if (fileStats.size > MAX_FILE_SIZE_BYTES) {
      continue;
    }

    const content = await readFile(fullPath, "utf8");

    if (currentChars + content.length > MAX_CONTEXT_CHARS) {
      continue;
    }

    result.push({
      path: relativePath,
      content,
    });
    currentChars += content.length;
  }

  return result;
}

function buildRepoContextPrompt(files: RepoContextFile[]): string {
  const fileList = files.map((file) => `- ${file.path}`).join("\n");
  const fileContents = files
    .map(
      (file) =>
        `FILE: ${file.path}\n---\n${file.content}\n---`,
    )
    .join("\n\n");

  return [
    "Repository file list:",
    fileList || "- No files selected",
    "",
    "Repository file contents:",
    fileContents || "No file contents were selected.",
  ].join("\n");
}

function extractResponseText(payload: any): string {
  if (typeof payload.output_text === "string" && payload.output_text !== "") {
    return payload.output_text;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const texts: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const contentItem of content) {
      const textValue = contentItem?.text;

      if (typeof textValue === "string") {
        texts.push(textValue);
      }
    }
  }

  return texts.join("\n").trim();
}

async function requestGeneratedFiles(
  prep: CodeGenerationPreparationResult,
  repoContext: RepoContextFile[],
  apiKey: string,
  model: string,
): Promise<ModelOutput> {
  const developerPrompt = [
    "You are generating code changes for a local git repository.",
    "Only return JSON matching the requested schema.",
    "Modify only a small set of files that are necessary to implement the issue.",
    "Prefer updating existing application files over creating placeholder docs.",
    "Do not include code fences.",
    "Do not propose committing or pushing anything.",
  ].join(" ");
  const userPrompt = [
    `Issue URL: ${prep.issueUrl}`,
    `Issue number: ${prep.issueNumber}`,
    `Issue title: ${prep.issueTitle}`,
    `Base branch: ${prep.baseBranch}`,
    `Implementation branch: ${prep.branchName}`,
    "",
    "Implement the issue in the local repository context below.",
    "Return full file contents for every file you want written.",
    "Use only relative paths inside the repository.",
    "",
    buildRepoContextPrompt(repoContext),
  ].join("\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: developerPrompt,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: userPrompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "projectx_code_generation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: {
                type: "string",
              },
              files: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    path: { type: "string" },
                    content: { type: "string" },
                  },
                  required: ["path", "content"],
                },
              },
              refusedFiles: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["summary", "files", "refusedFiles"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `OpenAI API request failed: ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ""}`,
    );
  }

  const payload = await response.json();
  const responseText = extractResponseText(payload);

  if (!responseText) {
    throw new Error("OpenAI API returned no text output.");
  }

  return JSON.parse(responseText) as ModelOutput;
}

function validateGeneratedPath(repoPath: string, generatedPath: string): string {
  const trimmedPath = normalizeRelativePath(generatedPath.trim());

  if (trimmedPath === "") {
    throw new Error("Generated file path is empty.");
  }

  if (trimmedPath.startsWith("/") || trimmedPath.includes("..")) {
    throw new Error(`Generated file path is invalid: ${generatedPath}`);
  }

  if (trimmedPath.startsWith(".git/")) {
    throw new Error(`Generated file path is not allowed: ${generatedPath}`);
  }

  const fullPath = resolve(repoPath, trimmedPath);
  const normalizedRepoPath = resolve(repoPath);

  if (!fullPath.startsWith(normalizedRepoPath)) {
    throw new Error(`Generated file path escaped the repo: ${generatedPath}`);
  }

  return fullPath;
}

async function writeGeneratedFiles(
  repoPath: string,
  generatedFiles: GeneratedFile[],
): Promise<string[]> {
  const changedFiles: string[] = [];

  for (const generatedFile of generatedFiles) {
    const fullPath = validateGeneratedPath(repoPath, generatedFile.path);

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, generatedFile.content, "utf8");
    changedFiles.push(normalizeRelativePath(generatedFile.path));
  }

  return changedFiles;
}

function buildGenerationLogPath(issueNumber: number): string {
  return `${OUTPUT_BASE_PATH}/logs/issue-${issueNumber}.code-generation.md`;
}

function renderGenerationLog(
  prep: CodeGenerationPreparationResult,
  model: string,
  repoContext: RepoContextFile[],
  output: ModelOutput,
  changedFiles: string[],
): string {
  return [
    "# Code generation log",
    "",
    `Issue URL: ${prep.issueUrl}`,
    "",
    `Issue number: ${prep.issueNumber}`,
    "",
    `Issue title: ${prep.issueTitle}`,
    "",
    `Model: ${model}`,
    "",
    `Target repo path: ${prep.repoPath}`,
    "",
    `Branch: ${prep.branchName}`,
    "",
    "## Summary",
    output.summary,
    "",
    "## Changed files",
    ...(changedFiles.length > 0 ? changedFiles.map((file) => `- ${file}`) : ["- None"]),
    "",
    "## Refused files",
    ...((output.refusedFiles ?? []).length > 0
      ? (output.refusedFiles ?? []).map((file) => `- ${file}`)
      : ["- None"]),
    "",
    "## Repo context files sent to the model",
    ...(repoContext.length > 0
      ? repoContext.map((file) => `- ${file.path}`)
      : ["- None"]),
    "",
  ].join("\n");
}

export async function generateCodeFromTicket(
  prep: CodeGenerationPreparationResult,
  apiKey: string | undefined,
  configuredModel: string | undefined,
): Promise<CodeGenerationResult> {
  const model = configuredModel?.trim() || DEFAULT_OPENAI_MODEL;
  const logFile = buildGenerationLogPath(prep.issueNumber);

  if (!apiKey || apiKey.trim() === "") {
    return {
      attempted: true,
      succeeded: false,
      model,
      logFile,
      filesChanged: [],
      refusedFiles: [],
      error:
        "OPENAI_API_KEY is not configured. Add it to ProjectX/.env or rerun `npm run dev -- init` and provide the key.",
    };
  }

  try {
    const repoContext = await loadRepoContext(prep.repoPath);
    const modelOutput = await requestGeneratedFiles(
      prep,
      repoContext,
      apiKey.trim(),
      model,
    );

    if (!Array.isArray(modelOutput.files) || modelOutput.files.length === 0) {
      return {
        attempted: true,
        succeeded: false,
        model,
        logFile,
        filesChanged: [],
        refusedFiles: modelOutput.refusedFiles ?? [],
        error: "The model did not return any files to write.",
      };
    }

    const changedFiles = await writeGeneratedFiles(prep.repoPath, modelOutput.files);

    await mkdir(dirname(logFile), { recursive: true });
    await writeFile(
      logFile,
      renderGenerationLog(prep, model, repoContext, modelOutput, changedFiles),
      "utf8",
    );

    return {
      attempted: true,
      succeeded: true,
      model,
      logFile,
      filesChanged: changedFiles,
      refusedFiles: modelOutput.refusedFiles ?? [],
    };
  } catch (error) {
    return {
      attempted: true,
      succeeded: false,
      model,
      logFile,
      filesChanged: [],
      refusedFiles: [],
      error:
        error instanceof Error
          ? `Code generation failed: ${error.message}`
          : "Code generation failed.",
    };
  }
}
