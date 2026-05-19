# ProjectX

ProjectX is a CLI-first automation tool for managing delivery workflow around a separate target application repository.

It is not the app being built. It is the control plane that:

- stores target-repo configuration in a local `.env`
- generates local planning artifacts
- enforces approval gates before risky steps
- prepares branches from GitHub issues
- can create GitHub repos, issues, and pull requests
- can generate code into the target repo through the OpenAI API

## Current State

The codebase currently supports two related workflows:

1. A planning workflow driven by a free-form requirement string
2. A ticket workflow driven by a GitHub issue URL

The planning workflow is still opinionated and partially hardcoded around the sample work item `theskeleton-google-login`. The generated requirements draft, implementation plan, issue draft, branch name, and PR summary all reflect that proof-of-concept shape today.

This means ProjectX is usable, but it is not yet a general-purpose multi-project orchestrator.

## Repository Layout

ProjectX should live separately from the target application repo.

Example:

```text
C:\Code\Github\projectx
C:\Code\Targets\my-app
```

The target repo path must be outside the ProjectX directory. `init` enforces that.

## Installation

```bash
npm install
```

Development entrypoint:

```bash
npm run dev -- <command>
```

Build:

```bash
npm run build
```

Run built output:

```bash
npm start -- <command>
```

## Environment

ProjectX reads local configuration from `.env` in the repo root.

Common variables:

```env
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
TARGET_REPO_URL=
TARGET_REPO_PATH=
TARGET_BASE_BRANCH=main
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Notes:

- `TARGET_REPO_URL`, `TARGET_REPO_PATH`, and `TARGET_BASE_BRANCH` are required for target-repo operations.
- `GITHUB_TOKEN` is needed for private repos and GitHub write operations.
- `OPENAI_API_KEY` is required for `init` to complete and for code generation from ticket flow.
- `OPENAI_MODEL` defaults to `gpt-4.1-mini`.

## First-Time Setup

Use the interactive initializer:

```bash
npm run dev -- init
```

`init` will:

- prompt for the target GitHub repo URL
- prompt for the local target repo path
- prompt for the base branch (`main` or `master`)
- optionally capture a GitHub token
- require an OpenAI API key before finishing setup
- optionally clone the target repo immediately
- save resolved settings into `.env`
- verify GitHub repo accessibility

If the target repo is private or inaccessible, `init` writes the config anyway and prints remediation steps.

## Main Commands

### Initialize configuration

```bash
npm run dev -- init
```

### Clone the configured target repo

```bash
npm run dev -- clone-target
```

This clones the configured target repo into `TARGET_REPO_PATH`, or refreshes it if it already exists locally.

### Create a GitHub repo

```bash
npm run dev -- create-repo my-new-app
```

Optional flags:

```bash
npm run dev -- create-repo my-new-app --public
npm run dev -- create-repo my-new-app --description "My new app"
```

Requires `GITHUB_OWNER` and `GITHUB_TOKEN`.

### Generate planning artifacts from a requirement

```bash
npm run dev -- "Add Google login to the target app"
```

With no explicit flags, ProjectX runs the local orchestrator and writes the default planning artifacts:

- requirements draft
- implementation plan
- issue draft

You can also run specific stages:

```bash
npm run dev -- "Add Google login to the target app" --generate-requirements
npm run dev -- "Add Google login to the target app" --create-github-issue
npm run dev -- "Add Google login to the target app" --generate-implementation-plan
npm run dev -- "Add Google login to the target app" --prepare-implementation
npm run dev -- "Add Google login to the target app" --create-implementation-branch
npm run dev -- "Add Google login to the target app" --generate-pr-summary
npm run dev -- "Add Google login to the target app" --prepare-pr
npm run dev -- "Add Google login to the target app" --push-implementation-branch
npm run dev -- "Add Google login to the target app" --open-pr
npm run dev -- "Add Google login to the target app" --poc-summary
npm run dev -- "Add Google login to the target app" --run-all-safe-local
```

`--run-all-safe-local` currently runs the safe local artifact steps:

- generate requirements
- generate implementation plan
- generate PR summary
- write POC summary

### Prepare a target repo branch from a GitHub issue

```bash
npm run dev -- implement-ticket https://github.com/<owner>/<repo>/issues/<number>
```

This command:

- loads the issue from GitHub
- verifies it belongs to the configured target repo
- clones or refreshes the target repo if needed
- creates or switches to a feature branch derived from the issue number and title

### Generate code into the target repo from a GitHub issue

```bash
npm run dev -- generate-code-from-ticket https://github.com/<owner>/<repo>/issues/<number>
```

This command:

- validates the issue and prepared branch
- gathers a limited text-only context from the target repo
- calls the OpenAI Responses API
- writes returned file contents directly into the target repo
- writes a code generation log under `output/.../logs/`

The current implementation skips large files and common generated directories such as `node_modules`, `.git`, `dist`, `build`, and `output`.

### Commit, push, and open a PR for a ticket branch

```bash
npm run dev -- create-ticket-pr https://github.com/<owner>/<repo>/issues/<number>
```

This command:

- commits all current changes in the prepared target repo branch
- pushes the branch to `origin`
- opens a GitHub pull request against the configured base branch

## Output Artifacts

ProjectX writes local artifacts under:

```text
output/<github-repo>/
```

Current directories:

```text
output/<github-repo>/
  issues/
  requirements/
  plans/
  research/
  verification/
  pr-summaries/
  release-notes/
  logs/
```

Important current files include:

- `output/<github-repo>/requirements/theskeleton-google-login.requirements.md`
- `output/<github-repo>/plans/theskeleton-google-login.implementation-plan.md`
- `output/<github-repo>/issues/theskeleton-google-login.md`
- `output/<github-repo>/pr-summaries/theskeleton-google-login.pr-summary.md`
- `output/<github-repo>/logs/theskeleton-google-login.poc-summary.md`
- `output/<github-repo>/logs/issue-<number>.code-generation.md`

## Approval Model

ProjectX uses markdown status fields as gates.

Current approval states are read from generated files and use:

```text
Status: draft
Status: approved
```

Current enforced gates:

- requirements must be approved before creating a GitHub issue
- requirements must be approved before generating the implementation plan
- implementation plan must be approved before creating the implementation branch
- PR summary must be approved before pushing the implementation branch
- PR summary must be approved before opening a pull request

## Practical Workflow

For the planning flow:

1. Run `npm run dev -- init`
2. Run `npm run dev -- "<your requirement>"`
3. Review the generated files in `output/<github-repo>/`
4. Change status lines from `draft` to `approved` where required
5. Run the next gated command

For the ticket flow:

1. Run `npm run dev -- init`
2. Run `npm run dev -- implement-ticket <issue-url>`
3. Run `npm run dev -- generate-code-from-ticket <issue-url>`
4. Review and test changes in the target repo manually
5. Run `npm run dev -- create-ticket-pr <issue-url>`

## Limitations

The current codebase has several important constraints:

- planning artifacts are not fully dynamic and still describe the hardcoded TheSkeleton Google login work item
- the implementation branch used by the planning workflow is fixed to `feature/theskeleton-google-login`
- PR summary generation expects an app verification artifact to exist, but there is no completed app verification flow in this repo yet
- `--prepare-implementation` and `--prepare-pr` report readiness only; they do not perform external actions
- target-repo testing and QA are still manual

## Source

Main entrypoints live in:

- [src/index.ts](/c:/Code/Github/projectx/src/index.ts)
- [src/init.ts](/c:/Code/Github/projectx/src/init.ts)
- [src/orchestrator.ts](/c:/Code/Github/projectx/src/orchestrator.ts)
- [src/codeGenerator.ts](/c:/Code/Github/projectx/src/codeGenerator.ts)
