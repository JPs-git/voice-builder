# Auto Version Bump CI

## Summary

Automate `npm version patch|minor` on PR merge to master, driven by conventional commit messages in the PR. Zero manual intervention — version bumps and GitHub Releases happen automatically.

## Workflow

```
feature branch → PR → merge to master
                        ↓
                 GitHub Actions (on: push master)
                        ↓
                 git fetch tags → get last tag
                        ↓
                 git log lastTag..HEAD --oneline
                        ↓
                 ┌─ contains "feat:" or "perf:"? → npm version minor
                 └─ otherwise?                   → npm version patch
                        ↓
                 git push --follow-tags
                 npm run build (verify no break)
                 create GitHub Release
```

## Trigger

Single GitHub Actions workflow file (`.github/workflows/release.yml`):

- Trigger: `push` to `master` branch
- No manual dispatch needed

## Bump Logic

| Commits between last tag and HEAD | Bump type |
|---|---|
| Contains `feat:` or `perf:` | `minor` |
| Otherwise | `patch` |

`major` bumps remain manual (`npm version major`) since they are rare and should be deliberate.

## Branch Management

- `master` is the stable branch
- All work goes through feature branches → PR → merge to master
- Recommendation: enable branch protection "Require pull request before merging" on master

## Files

| File | Purpose |
|---|---|
| `.github/workflows/release.yml` | GitHub Actions workflow |

No changes to `package.json`, codebase structure, or existing workflow.

## First-Time Setup

1. Create `.github/workflows/release.yml`
2. Ensure a tag exists for the current version (e.g., `v1.1.3`) as baseline for `git describe`

## Security & Permissions

- `GITHUB_TOKEN` default permission `contents: write` is sufficient for pushing tags and creating releases
- No secrets or deploy keys required

## Out of Scope

- `major` version bumps
- Pre-release / alpha / beta
- Changelog generation (GitHub auto-generated release notes suffice for a personal project)
- npm publish
