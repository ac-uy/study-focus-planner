# Study Focus Planner

A study app for secondary-school students, in Spanish and English. It runs on AWS in eu-west-1 and costs a few cents a month.

- The app is served from your own CloudFront distribution: the new app (v2) at `/next/` and the original single page (v1, frozen) at the root. The address belongs to your deployment, not to this repository.
- Current version: `package.json` and `CHANGELOG.md`

## Layout

| Folder | What it is |
| --- | --- |
| `web-next/` | The v2 app: vanilla JS modules in `src/`, bundled by esbuild into `dist/` |
| `web/` | The v1 single page. Frozen, only kept because it is still deployed |
| `lambda/api/` | The API: one Node 22 Lambda |
| `infra/` | The AWS CDK stack (TypeScript) |
| `tests/` | Automated tests. `npm test` runs all of them |
| `tools/` | Manual helpers (for example the music filter calibration) |
| `docs/` | Specs of what the app does, architecture, and the change history |

## Everyday commands (PowerShell, repo root)

```
npm install                       once: test dependencies
npm --prefix web-next install     once: bundler
npm --prefix infra install        once: CDK
npm test                          build the app and run every test
npm run test:fast                 same without rebuilding
```

Deploy (needs the AWS profile `planner`, see `docs/architecture.md`):

```
npm test
cd infra
$env:AWS_PROFILE = "planner"
npm run deploy
```

## How we work

Specs in `docs/specs/` describe what the app does today. Every non-trivial change starts as a proposal in `docs/changes/` and ends as a tagged version. See `docs/process.md`.

## Local configuration and privacy

This repository is public, so it holds no personal or deployment-specific values.

- The AWS account, region, emails and budget live in `infra/config.local.json`, which git ignores. Copy `infra/config.example.json` to that name and fill it in before the first deploy.
- The YouTube API key lives in AWS SSM Parameter Store, never in the code.
- `npm test` includes a check that fails if a value from your local config, or anything that looks like an account id, an email or a live address, appears in a file git tracks.
