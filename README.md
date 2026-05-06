# ProjectX

ProjectX is a CLI-first automation engine for software delivery workflows. It is not the target application repository. ProjectX lives in its own repository and works against external standalone target repos.

## What ProjectX does now

- Creates GitHub repositories for new target apps.
- Generates planning and orchestration artifacts in `output/<target_repo_name>/`.
- Keeps application code in external target repositories, not inside ProjectX.
- Supports a future workflow where target work happens from `--target-repo-path`.
- Does not implement a localhost UI yet.

## Required environment variables

```bash
export GITHUB_TOKEN=ghp_xxx
export GITHUB_OWNER=salmanalibanani
```

For commands that operate on an existing target repository, also set:

```bash
export GITHUB_REPO=dgdocs-new-app
```

## Create a new GitHub repository

```bash
npm run dev -- create-repo dgdocs-new-app
```

Optional flags:

```bash
npm run dev -- create-repo dgdocs-new-app --description "DG Docs app"
npm run dev -- create-repo dgdocs-new-app --public
```

After repository creation, clone it manually:

```bash
git clone https://github.com/salmanalibanani/dgdocs-new-app.git
```

## Future workflow

1. Run ProjectX from the ProjectX repository.
2. Create a remote target repo with `create-repo`.
3. Clone the target repo locally.
4. Run future ProjectX commands against the cloned target repo with a `--target-repo-path` style argument.
5. Store application source code and tests in the target repo.
6. Store ProjectX orchestration artifacts in `output/<target_repo_name>/`.

## Output artifact layout

ProjectX stores planning artifacts in target-specific folders under `output/`:

```text
output/
  dgdocs-new-app/
    issues/
    requirements/
    plans/
    research/
    verification/
    pr-summaries/
    release-notes/
    logs/
```

### Separation of responsibilities

ProjectX repo contains:

- automation engine code
- planning and orchestration artifacts
- logs
- workflow metadata

Target application repo contains:

- application source code
- tests
- app documentation
- deployment config
- app-specific build files

## Notes

- ProjectX changes are made directly on `main` for now.
- There is no ProjectX self-PR flow in this repo yet.
- No cloning is performed automatically by `create-repo`.
- Target application code is not written into `ProjectX/output`.
