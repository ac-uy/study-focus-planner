# How we work

## Versions

Semantic versions, `MAJOR.MINOR.PATCH`, tagged in git as `vX.Y.Z`.

- **MAJOR**: a rewrite or a break in stored data.
- **MINOR**: a new capability (normally one change from `docs/changes/`).
- **PATCH**: a fix or a small tweak.

The version lives in the root `package.json`, in `CHANGELOG.md`, and as the git tag. Never deploy code that is not tagged.

`v1.0.0` is the original single page in `web/`. `v2.0.0` is the new app in `web-next/`. Work before `v2.0.0` was not under version control.

## Specs and changes

- `docs/specs/*.md` say what the app does **now**. They are updated in the same change that alters the behaviour.
- `docs/changes/NNNN-name/` says what will be true **next**:
  - `proposal.md`: why, scope, decisions, risks, acceptance criteria. Its header has a status: `proposed`, `approved`, `in progress`, `shipped in vX.Y.Z`.
  - `tasks.md`: a checklist, ticked as work is done.
- A small fix needs no folder: one commit and one line in the changelog.
- Anything touching a child's data, the content filters, accounts or costs always needs a proposal.

## Flow

1. Write `proposal.md` and `tasks.md`. Open decisions are listed with a default.
2. The owner approves, or answers the open decisions. Status becomes `approved`.
3. Create a branch `change/NNNN-name`.
4. Implement in small commits. Prefixes: `feat`, `fix`, `docs`, `test`, `chore`. Add or update tests with the code.
5. `npm test` must pass.
6. Update the affected specs, add a `CHANGELOG.md` entry, bump the version in `package.json`.
7. Merge to `main` and tag `vX.Y.Z`.
8. Deploy from `infra`, then check the live site (page loads, new routes answer 401 without a token, one real call through the Lambda).
9. Set the proposal status to `shipped in vX.Y.Z`.

## Rules

- The repository is public. No secrets and nothing personal or deployment-specific is committed: no account ids, emails, live addresses or names. Those live in `infra/config.local.json` (ignored by git). `tests/public.test.mjs` fails if any appear.
- The YouTube key stays in SSM.
- Server code never trusts a role, an owner or a user ID sent by the browser. Identity comes from the verified token only.
- Failures in a safety check (content filter, link check) block the action. They never allow it.
- Every new text exists in Spanish and English. The test `tests/keys.test.mjs` fails if one is missing.
- Do not delete data or AWS resources without the owner's explicit yes.

## Definition of done

- [ ] Behaviour matches the acceptance criteria in the proposal
- [ ] `npm test` passes
- [ ] Specs, changelog and version updated
- [ ] Tagged, deployed, live check done
- [ ] Proposal marked shipped
