# ProjectX

ProjectX is a CLI-first automation repo that manages software-delivery workflow for a separate target application repo.

ProjectX is not the app you are building. It is the control plane.

ProjectX manages:

- target repo setup
- planning artifacts
- approval-gated workflow steps
- GitHub issue and PR automation

The target repo contains:

- application source code
- tests
- build config
- deployment config

## Repos And Paths

ProjectX works with four distinct things:

1. The ProjectX GitHub repo
2. Your local clone of the ProjectX repo
3. The target app GitHub repo
4. Your local clone of the target app repo

ProjectX runs from its own local repo, but it operates against the target app repo.

The target app local clone should live outside the ProjectX folder.

Example:

```text
C:\Code\Github\projectx
C:\Code\Targets\my-app
```

## What ProjectX Does Now

ProjectX currently supports:

- interactive target-repo initialization with `init`
- target repo access validation
- local target path validation
- target repo cloning into the configured local path
- ticket-driven branch preparation from a GitHub issue URL
- ticket-driven commit, push, and PR creation
- deterministic requirements draft generation
- deterministic implementation plan generation
- deterministic issue draft generation
- approval-gated workflow progression
- GitHub repo creation
- GitHub issue creation
- implementation branch creation
- PR summary generation
- guarded PR creation workflow

ProjectX does not yet fully automate:

- running the target app and completing manual QA end-to-end

## Installation

Install dependencies:

```bash
npm install
```

Run ProjectX in development mode:

```bash
<<<<<<< HEAD
npm run dev -- <command-or-request>
=======
export GITHUB_REPO=my-new-app
>>>>>>> 16190a7d9fbe9014d462328c31d4274b86928174
```

Build the project:

```bash
<<<<<<< HEAD
npm run build
=======
npm run dev -- create-repo my-new-app
>>>>>>> 16190a7d9fbe9014d462328c31d4274b86928174
```

## Environment Variables

ProjectX stores local configuration in `ProjectX/.env`.

This file is local-only and should not be committed.

Common variables:

```env
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
TARGET_REPO_URL=
TARGET_REPO_PATH=
TARGET_BASE_BRANCH=main
OPENAI_API_KEY=
OPENAI_MODEL=
```

## GitHub Token

If the target repo is private, or if you want ProjectX to create issues or pull requests, you need a GitHub personal access token.

Create it from:

1. GitHub
2. Settings
3. Developer settings
4. Personal access tokens

Store it in `ProjectX/.env` like this:

```env
GITHUB_TOKEN=ghp_your_token_here
```

For private repos, the token needs repository access. If you want ProjectX to create issues or pull requests later, it also needs the corresponding write permissions.

## First-Time Setup

Start with the interactive initializer:

```bash
<<<<<<< HEAD
npm run dev -- init
=======
npm run dev -- create-repo my-new-app --description "My app"
npm run dev -- create-repo my-new-app --public
>>>>>>> 16190a7d9fbe9014d462328c31d4274b86928174
```

`init` will ask for:

- target repo URL
- local target repo path
- base branch (`main` or `master`)
- GitHub token if needed
- OpenAI API key for local code generation
- whether ProjectX should clone the target repo now

`init` will then:

- check whether the target GitHub repo exists and is accessible
- check whether the local target path is outside the ProjectX repo
- detect whether the local target path already contains a git repo
- save the configuration into `.env`
- optionally clone the target repo immediately

If the target repo is not accessible, ProjectX will tell you:

- how to create a GitHub token
- where to save it
- how to rerun `init`

After the token is set, run this again:

```bash
<<<<<<< HEAD
npm run dev -- init
=======
git clone https://github.com/salmanalibanani/my-new-app.git
>>>>>>> 16190a7d9fbe9014d462328c31d4274b86928174
```

ProjectX will re-check that the target repo exists and is accessible.

If `OPENAI_API_KEY` is missing, `init` will stop, tell you how to set it in `ProjectX/.env`, and ask you to rerun `npm run dev -- init`.

## Basic Workflow

The intended operator workflow is:

1. Run `init`
2. Make sure the target repo is accessible
3. Let `init` clone the target repo now, or run `clone-target` later
4. Give ProjectX a short requirement
5. Review the generated planning artifacts
6. Approve each gated step before moving forward
7. Prepare the target repo branch from the GitHub issue
8. Kick off code generation from the GitHub issue
9. Later, use the guarded PR workflow

You can also start from an existing GitHub issue URL after `init`.

## Give ProjectX A Requirement

Once `init` succeeds and the target repo has been cloned locally, give ProjectX a brief request:

```bash
npm run dev -- "Add Google login to the target app"
```

At the current stage, ProjectX turns that request into planning artifacts rather than full target-app implementation.

After that command runs, ProjectX tells you where the generated documents were written.
Review them under `output/<target-repo-name>/`.
You can edit those markdown files directly before approving anything.

## Generated Output

ProjectX stores workflow artifacts under:

```text
output/<target-repo-name>/
```

Typical layout:

```text
output/
<<<<<<< HEAD
  my-app/
=======
  my-new-app/
>>>>>>> 16190a7d9fbe9014d462328c31d4274b86928174
    issues/
    requirements/
    plans/
    research/
    verification/
    pr-summaries/
    release-notes/
    logs/
```

These artifacts belong to ProjectX, not to the target application repo.

## Editing And Approval

ProjectX expects you to review and edit the generated markdown artifacts directly.

Typical operator flow after submitting a brief requirement:

1. Open the generated requirements draft
2. Edit any sections that need clarification or correction
3. Save the file
4. Approve it by changing the status line
5. Ask ProjectX to create the GitHub issue

To mark the requirements as approved:

1. Open the requirements file under `output/<target-repo-name>/requirements/`
2. Find the line:

```text
Status: draft
```

3. Change it to:

```text
Status: approved
```

4. Save the file

ProjectX reads that status line to determine whether later workflow steps are allowed.

After the requirements are approved, create the GitHub issue with:

```bash
npm run dev -- "<your requirement>" --create-github-issue
```

When that succeeds, ProjectX will print the GitHub issue URL so you can open the ticket directly.

## Main Commands

### Initialize A Target Repo

```bash
npm run dev -- init
```

Use this first.

### Create A New GitHub Repo

```bash
npm run dev -- create-repo my-new-app
```

Optional:

```bash
npm run dev -- create-repo my-new-app --description "My new app"
npm run dev -- create-repo my-new-app --public
```

### Generate Planning Artifacts From A Requirement

If you did not clone during `init`, clone the target repo first:

```bash
npm run dev -- clone-target
```

Then run a brief requirement:

```bash
npm run dev -- "Build TheSkeleton app with Google login"
```

### Clone The Configured Target Repo

```bash
npm run dev -- clone-target
```

This command:

- reads `TARGET_REPO_URL`, `TARGET_REPO_PATH`, and `TARGET_BASE_BRANCH`
- clones the target repo into the configured local path if it is missing
- if the path already contains the same repo, fetches `origin` and checks out the configured base branch
- fails safely if the target path contains a different or non-empty non-git directory

### Start From A GitHub Issue URL

```bash
npm run dev -- implement-ticket https://github.com/<owner>/<repo>/issues/<number>
```

If you omit the URL, ProjectX will ask for it.

This command:

- loads the GitHub issue details
- verifies that the issue belongs to the configured target repo
- clones the target repo if needed
- creates or switches to a new local feature branch for that ticket
- leaves the branch uncommitted so code can be completed there

After that, ProjectX tells you:

- the issue URL
- the branch name
- the local target repo path
- the command to run next to kick off code generation

The branch name is generated from the ticket number and issue title, for example:

```text
feature/issue-123-add-google-login
```

Local implementation work should stay on that branch until the PR is created.

### Kick Off Code Generation From A GitHub Issue URL

```bash
npm run dev -- generate-code-from-ticket https://github.com/<owner>/<repo>/issues/<number>
```

If you omit the URL, ProjectX will ask for it.

This command:

- verifies that the target repo is cloned locally
- verifies that the prepared ticket branch exists
- verifies that the target repo is currently on that branch
- writes a code-generation preparation log under `output/<target-repo-name>/logs/`
- calls the OpenAI API to generate local file changes
- writes those file changes into the prepared branch without committing them
- prints the changed files and the code-generation log path

After it completes, you should review the local changes and run the target repo's build/tests manually before creating the PR.

### Create A PR From A GitHub Issue URL

```bash
npm run dev -- create-ticket-pr https://github.com/<owner>/<repo>/issues/<number>
```

If you omit the URL, ProjectX will ask for it.

This command:

- commits all local changes in the target repo branch
- pushes that branch to GitHub
- opens a pull request against the configured base branch
- prints the PR URL

If you have switched away from the prepared ticket branch, ProjectX will stop and tell you to switch back before creating the PR.

### Generate Requirements Draft

```bash
npm run dev -- "Build TheSkeleton app with Google login" --generate-requirements
```

### Create GitHub Issue

Requirements must already be approved.

```bash
npm run dev -- "Build TheSkeleton app with Google login" --create-github-issue
```

ProjectX will print the issue URL after creation, or tell you if the issue already exists.

### Generate Implementation Plan

Requirements must already be approved.

```bash
npm run dev -- "Build TheSkeleton app with Google login" --generate-implementation-plan
```

### Prepare Implementation

Implementation plan must already be approved.

```bash
npm run dev -- "Build TheSkeleton app with Google login" --prepare-implementation
```

### Create Implementation Branch

Implementation plan must already be approved.

```bash
npm run dev -- "Build TheSkeleton app with Google login" --create-implementation-branch
```

### Generate PR Summary

```bash
npm run dev -- "Build TheSkeleton app with Google login" --generate-pr-summary
```

### Prepare PR

```bash
npm run dev -- "Build TheSkeleton app with Google login" --prepare-pr
```

### Push Implementation Branch

PR summary must already be approved.

```bash
npm run dev -- "Build TheSkeleton app with Google login" --push-implementation-branch
```

### Open PR

PR summary must already be approved.

```bash
npm run dev -- "Build TheSkeleton app with Google login" --open-pr
```

## Approval Model

ProjectX is intentionally guarded.

Current approval gates are:

- requirements must be approved before GitHub issue creation
- requirements must be approved before implementation-plan generation
- implementation plan must be approved before implementation preparation
- implementation plan must be approved before branch creation
- PR summary must be approved before branch push
- PR summary must be approved before PR creation

Approval status is read from the generated markdown artifacts.

## What To Do Next

If you are using ProjectX for the first time:

1. Run `npm run dev -- init`
2. Fix any GitHub access issue
3. Rerun `npm run dev -- init` until access succeeds
4. Let `init` clone the target repo, or run `npm run dev -- clone-target`
5. Submit a short requirement with `npm run dev -- "<your requirement>"`
6. Review the generated files under `output/`

## Notes

- ProjectX runs from its own repo, but the target repo is the execution target.
- The target repo local path should not be inside the ProjectX folder.
- `ProjectX/.env` is local-only and should remain uncommitted.
- ProjectX changes are currently made directly on `main`.
