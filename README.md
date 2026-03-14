# OpenSpec Approvals Dashboard

A self-hosted review dashboard for OpenSpec changes.

## Features

- Dashboard overview metrics (in-progress changes, task totals, completion progress, recent activity)
- Read `openspec/changes/*` artifacts (`proposal.md`, `design.md`, `tasks.md`, `specs/**/spec.md`)
- Spec-oriented route for document navigation: `/spec/<changeId>?doc=requirements|design|tasks`
- Hierarchical task manager parsed from `tasks.md` with per-section progress and quick task actions
- Keyboard shortcuts for dashboard navigation (`Alt+1`, `Alt+2`, `Alt+3`, `/`)
- Persistent display preferences (theme and completed-task visibility)
- Semantic search across artifacts
- Review actions: `approve`, `request_changes`, `reject`
- Approval timeline per change
- Live update stream via SSE when files/index/sync status change
- GitHub sync for approval records to `openspec/approvals/<projectId>/<changeId>.json`
- Multiple OpenSpec projects on one server with project switcher

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Optional validation:

```bash
npm test
```

## Configure Projects (Static Registry)

The server supports multiple projects via static config.

### Quick setup via shell script (no npx)

From your OpenSpec project root (the directory that contains `changes/`), run:

```bash
bash /absolute/path/to/openspec-approvals/scripts/setup-openspec-project.sh \
  --dashboard-root /absolute/path/to/openspec-approvals \
  --project-id core \
  --name "Core Platform"
```

Optional flags:

- `--openspec-root`: override OpenSpec root path (default: current directory)
- `--db-path`: write `DB_PATH` into dashboard `.env.local`
- `--github-owner`, `--github-repo`, `--github-token`, `--github-branch`: enable GitHub sync for this project
- `--dry-run`: preview `.env.local` changes without writing

This script upserts one project entry into `OPENSPEC_PROJECTS` in `<dashboard-root>/.env.local` and keeps other env lines.

### Recommended: `OPENSPEC_PROJECTS`

Set a JSON array in `.env.local`:

```bash
OPENSPEC_PROJECTS=[{"id":"core","name":"Core Platform","openspecRoot":"/absolute/path/to/core/openspec"},{"id":"mobile","name":"Mobile App","openspecRoot":"/absolute/path/to/mobile/openspec","githubOwner":"acme","githubRepo":"product-specs","githubBranch":"main","githubToken":"<token>"}]
DB_PATH=/absolute/path/to/openspec-approvals/data/approvals.db
```

Each project entry supports:

- `id` (required): URL/API identifier; letters, numbers, `_`, `-`
- `name` (optional): display name in UI
- `openspecRoot` (required): absolute path to OpenSpec root
- `githubOwner`, `githubRepo`, `githubBranch`, `githubToken` (optional): per-project GitHub sync config

### Legacy single-project fallback

If `OPENSPEC_PROJECTS` is not set, app falls back to one `default` project using:

- `OPENSPEC_ROOT` (or `${REPO_ROOT}/openspec`)
- `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_TOKEN`

## Validate setup

```bash
npm run doctor
```

Doctor validates all configured projects and their `changes` directories.

## URL/API project scoping

All runtime requests must include `projectId`.

- UI examples:
  - `/?projectId=core`
  - `/search?projectId=core`
  - `/changes/<changeId>?projectId=core`
  - `/spec/<changeId>?projectId=core&doc=requirements`
- API examples:
  - `GET /api/changes?projectId=core`
  - `GET /api/changes/<id>?projectId=core`
  - `GET /api/dashboard?projectId=core`
  - `GET /api/search?projectId=core&q=...`
  - `GET /api/approvals?projectId=core&changeId=...`
  - `POST /api/approvals` with JSON body including `projectId`
  - `GET /api/stream?projectId=core`

## Environment Variables

- `REPO_ROOT` (optional): repo root path (default: current directory)
- `DB_PATH` (optional): SQLite path (default: `${REPO_ROOT}/data/approvals.db`)
- `OPENSPEC_PROJECTS` (optional): JSON array of project configs

Legacy single-project variables (used only when `OPENSPEC_PROJECTS` is absent):

- `OPENSPEC_ROOT`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH`
- `GITHUB_TOKEN`
