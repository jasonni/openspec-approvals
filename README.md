# OpenSpec Approvals Dashboard

A self-hosted review dashboard for OpenSpec changes.

## Features

- Read `openspec/changes/*` artifacts (`proposal.md`, `design.md`, `tasks.md`, `specs/**/spec.md`)
- Semantic search across artifacts
- Review actions: `approve`, `request_changes`, `reject`
- Approval timeline per change
- Live update stream via SSE when files/index/sync status change
- GitHub sync for approval records to `openspec/approvals/{changeId}.json`

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Integrate with Existing OpenSpec Repo (Standalone Sidecar)

Use this dashboard as a separate repo that reads your existing OpenSpec repo.

### 1) Prepare two local checkouts

- Main repo: contains `openspec/changes/*`
- This repo: `openspec-approvals`

### 2) Configure environment variables

```bash
cp .env.example .env.local
```

Update at least:

- `OPENSPEC_ROOT=/absolute/path/to/<your-main-repo>/openspec`
- `DB_PATH=/absolute/path/to/openspec-approvals/data/approvals.db`

Enable shared approvals sync to GitHub:

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH` (default: `main`)
- `GITHUB_TOKEN` (needs repository contents write access)

### 3) Validate setup

```bash
npm run doctor
```

This checks whether `OPENSPEC_ROOT` and `openspec/changes` are discoverable and whether GitHub sync env vars are complete.

### 4) Start dashboard

```bash
npm run dev
```

When running, the app will:

- index all current changes
- watch `openspec/changes/*` for updates
- sync approvals to `openspec/approvals/{changeId}.json` when GitHub env vars are configured

## Environment Variables

- `REPO_ROOT` (optional): repo root path (default: current directory)
- `OPENSPEC_ROOT` (optional): OpenSpec root path (default: `${REPO_ROOT}/openspec`)
- `DB_PATH` (optional): SQLite path (default: `${REPO_ROOT}/data/approvals.db`)
- `GITHUB_OWNER` (optional): GitHub owner for approvals sync
- `GITHUB_REPO` (optional): GitHub repository name
- `GITHUB_BRANCH` (optional): branch for sync, default `main`
- `GITHUB_TOKEN` (optional): token with repo contents write access

If GitHub env vars are missing, approvals remain local in SQLite.

## API

- `GET /api/changes`
- `GET /api/changes/:id`
- `GET /api/search?q=...`
- `GET /api/approvals?changeId=...`
- `POST /api/approvals`
- `GET /api/stream` (SSE)
