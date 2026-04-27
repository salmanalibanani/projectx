# ProjectX

## ProjectX Monorepo POC Workflow

```bash
npm run dev -- "Build TheSkeleton app with Google login" --generate-requirements
```

Edit `output/requirements/theskeleton-google-login.requirements.md` and set `Status: approved`.

```bash
npm run dev -- "Build TheSkeleton app with Google login" --create-github-issue
npm run dev -- "Build TheSkeleton app with Google login" --generate-implementation-plan
```

Edit `output/plans/theskeleton-google-login.implementation-plan.md` and set `Status: approved`.

```bash
npm run dev -- "Build TheSkeleton app with Google login" --create-implementation-branch
npm run dev -- "Build TheSkeleton app with Google login" --generate-app-scaffold

# Optional, requires OPENAI_API_KEY
npm run dev -- "Build TheSkeleton app with Google login" --generate-code

npm run dev -- "Build TheSkeleton app with Google login" --verify-app
npm run dev -- "Build TheSkeleton app with Google login" --draft-pr-summary
```

Edit `output/pr/theskeleton-google-login.pr-summary.md` and set `Status: approved`.

```bash
npm run dev -- "Build TheSkeleton app with Google login" --push-implementation-branch
npm run dev -- "Build TheSkeleton app with Google login" --open-pr
npm run dev -- "Build TheSkeleton app with Google login" --poc-summary
```

Safe local workflow without external APIs:

```bash
npm run dev -- "Build TheSkeleton app with Google login" --run-all-safe-local
```
