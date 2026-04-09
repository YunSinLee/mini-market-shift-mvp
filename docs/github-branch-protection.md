# GitHub Branch Protection Guide

This project expects PR merges to be blocked unless CI passes.

## Target branch
- Apply these rules to your default branch (typically `main`).

## Required GitHub settings
1. Open repository settings:
   - `Settings` -> `Branches` -> `Branch protection rules` -> `Add rule`
2. Branch name pattern:
   - `main` (or your production branch name)
3. Enable:
   - `Require a pull request before merging`
   - `Require status checks to pass before merging`
   - `Require branches to be up to date before merging`
4. In required status checks, add CI check from this workflow:
   - Workflow: `PR Quality Gate`
   - Job: `quality-gate`
   - UI label is usually: `PR Quality Gate / quality-gate`
5. Optional hardening:
   - `Require conversation resolution before merging`
   - `Do not allow bypassing the above settings`
   - `Restrict who can push to matching branches`
6. Enable code owner reviews:
   - Add a `CODEOWNERS` file at `.github/CODEOWNERS`
   - In branch protection rule, enable `Require review from Code Owners`

## Why this matters
- Blocks stale or missing Unity runtime smoke reports.
- Enforces `liveops` schema + freshness through CI:
  - default PR: `max-age-days=14`
  - PR with `hotfix` label: `max-age-days=30`
- Prevents merging code that skips telemetry/liveops gate integrity.
- Ensures critical paths (Unity runtime, CI workflow, smoke inputs) always receive owner review.
- When `hotfix` label is present, CI also upserts a PR comment explaining the relaxed freshness policy.

## Quick verification
Run locally before pushing:
```bash
npm run ci:pr
```

If this command fails, the branch protection gate will also fail on PR.

## Optional: apply rule via GitHub CLI
If you prefer API-based setup over UI clicks:
```bash
npm run gh:apply-branch-protection -- --repo <owner/name> --branch main
```

Dry-run preview:
```bash
npm run gh:apply-branch-protection -- --repo <owner/name> --branch main --dry-run
```

Optional flags:
- `--required-checks "PR Quality Gate / quality-gate"`
- `--approvals 1`
- `--require-codeowners true`
