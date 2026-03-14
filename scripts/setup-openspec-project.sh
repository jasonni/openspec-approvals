#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  setup-openspec-project.sh --dashboard-root <path> [options]

Run this command from an OpenSpec project root (a directory that contains `changes/`).

Options:
  --dashboard-root <path>   Path to openspec-approvals repository (required)
  --openspec-root <path>    OpenSpec root path (default: current directory)
  --project-id <id>         Project id for OPENSPEC_PROJECTS (default: default)
  --name <name>             Project display name (default: same as project-id)
  --github-owner <owner>    GitHub owner (optional; must be used with repo/token)
  --github-repo <repo>      GitHub repo (optional; must be used with owner/token)
  --github-branch <branch>  GitHub branch (default: main)
  --github-token <token>    GitHub token (optional; must be used with owner/repo)
  --db-path <path>          DB_PATH value to write into .env.local (optional)
  --dry-run                 Print result without writing files
  -h, --help                Show this help
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

resolve_path() {
  node --input-type=module -e "import path from 'node:path'; process.stdout.write(path.resolve(process.argv[1]));" "$1"
}

dashboard_root=""
openspec_root="$PWD"
project_id="default"
project_name=""
github_owner=""
github_repo=""
github_branch="main"
github_token=""
db_path=""
dry_run=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dashboard-root)
      [[ $# -ge 2 ]] || die "--dashboard-root requires a value."
      dashboard_root="$2"
      shift 2
      ;;
    --openspec-root)
      [[ $# -ge 2 ]] || die "--openspec-root requires a value."
      openspec_root="$2"
      shift 2
      ;;
    --project-id)
      [[ $# -ge 2 ]] || die "--project-id requires a value."
      project_id="$2"
      shift 2
      ;;
    --name)
      [[ $# -ge 2 ]] || die "--name requires a value."
      project_name="$2"
      shift 2
      ;;
    --github-owner)
      [[ $# -ge 2 ]] || die "--github-owner requires a value."
      github_owner="$2"
      shift 2
      ;;
    --github-repo)
      [[ $# -ge 2 ]] || die "--github-repo requires a value."
      github_repo="$2"
      shift 2
      ;;
    --github-branch)
      [[ $# -ge 2 ]] || die "--github-branch requires a value."
      github_branch="$2"
      shift 2
      ;;
    --github-token)
      [[ $# -ge 2 ]] || die "--github-token requires a value."
      github_token="$2"
      shift 2
      ;;
    --db-path)
      [[ $# -ge 2 ]] || die "--db-path requires a value."
      db_path="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

[[ -n "$dashboard_root" ]] || die "--dashboard-root is required."
[[ "$project_id" =~ ^[A-Za-z0-9_-]+$ ]] || die "Invalid --project-id \"$project_id\". Use letters, numbers, _ or -."

if [[ -z "$project_name" ]]; then
  project_name="$project_id"
fi

openspec_root="$(resolve_path "$openspec_root")"
dashboard_root="$(resolve_path "$dashboard_root")"
if [[ -n "$db_path" ]]; then
  db_path="$(resolve_path "$db_path")"
fi

[[ -d "$dashboard_root" ]] || die "Dashboard root does not exist: $dashboard_root"
[[ -d "$openspec_root" ]] || die "OpenSpec root does not exist: $openspec_root"
[[ -d "$openspec_root/changes" ]] || die "OpenSpec changes directory not found: $openspec_root/changes"

github_count=0
[[ -n "$github_owner" ]] && github_count=$((github_count + 1))
[[ -n "$github_repo" ]] && github_count=$((github_count + 1))
[[ -n "$github_token" ]] && github_count=$((github_count + 1))
if (( github_count > 0 && github_count < 3 )); then
  die "GitHub sync options are partial. Provide --github-owner, --github-repo, and --github-token together."
fi

env_file="$dashboard_root/.env.local"
backup_file="$env_file.bak"

existing_projects_json="[]"
if [[ -f "$env_file" ]]; then
  existing_line="$(grep -m1 '^OPENSPEC_PROJECTS=' "$env_file" || true)"
  if [[ -n "$existing_line" ]]; then
    existing_projects_json="${existing_line#OPENSPEC_PROJECTS=}"
  fi
fi

merged_projects_json="$(
  EXISTING_PROJECTS_JSON="$existing_projects_json" \
  PROJECT_ID="$project_id" \
  PROJECT_NAME="$project_name" \
  OPENSPEC_ROOT="$openspec_root" \
  GITHUB_OWNER="$github_owner" \
  GITHUB_REPO="$github_repo" \
  GITHUB_BRANCH="$github_branch" \
  GITHUB_TOKEN="$github_token" \
  node --input-type=module <<'NODE'
const raw = process.env.EXISTING_PROJECTS_JSON ?? '[]';
let projects = [];

if (raw.trim()) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('OPENSPEC_PROJECTS must be a JSON array');
    }
    projects = parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({ ...item }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: Failed to parse existing OPENSPEC_PROJECTS: ${message}`);
    process.exit(1);
  }
}

const projectId = process.env.PROJECT_ID ?? '';
const project = {
  id: projectId,
  name: process.env.PROJECT_NAME ?? projectId,
  openspecRoot: process.env.OPENSPEC_ROOT ?? '',
};

const owner = process.env.GITHUB_OWNER ?? '';
const repo = process.env.GITHUB_REPO ?? '';
const token = process.env.GITHUB_TOKEN ?? '';
const branch = (process.env.GITHUB_BRANCH ?? 'main').trim() || 'main';
if (owner && repo && token) {
  project.githubOwner = owner;
  project.githubRepo = repo;
  project.githubBranch = branch;
  project.githubToken = token;
}

const index = projects.findIndex((entry) => entry.id === project.id);
if (index >= 0) {
  projects[index] = { ...projects[index], ...project };
} else {
  projects.push(project);
}

process.stdout.write(JSON.stringify(projects));
NODE
)"

tmp_file="$(mktemp)"
cleanup() {
  rm -f "$tmp_file"
}
trap cleanup EXIT

if [[ -f "$env_file" ]]; then
  if [[ -n "$db_path" ]]; then
    grep -vE '^(OPENSPEC_PROJECTS|DB_PATH)=' "$env_file" > "$tmp_file" || true
  else
    grep -vE '^OPENSPEC_PROJECTS=' "$env_file" > "$tmp_file" || true
  fi
fi

if [[ -s "$tmp_file" ]]; then
  printf '\n' >> "$tmp_file"
fi

printf 'OPENSPEC_PROJECTS=%s\n' "$merged_projects_json" >> "$tmp_file"
if [[ -n "$db_path" ]]; then
  printf 'DB_PATH=%s\n' "$db_path" >> "$tmp_file"
fi

if (( dry_run == 1 )); then
  echo "Dry run: would write $env_file with:"
  echo "----------------------------------------"
  cat "$tmp_file"
  echo "----------------------------------------"
  exit 0
fi

if [[ -f "$env_file" ]]; then
  cp "$env_file" "$backup_file"
  echo "Backup created: $backup_file"
fi

mv "$tmp_file" "$env_file"
echo "Updated: $env_file"
echo
echo "Next steps:"
echo "1) cd \"$dashboard_root\""
echo "2) npm run doctor"
echo "3) npm run dev"
