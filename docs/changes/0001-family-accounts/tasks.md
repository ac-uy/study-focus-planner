# 0001 Family accounts: tasks

Branch: `change/0001-family-accounts`. Status of each step is ticked here as it is done.

## Phase 1 (v2.1.0)

### Preparation
- [x] Owner answers or accepts the open decisions in `proposal.md`
- [x] Set status to `approved`

### Server
- [x] Profile and link helpers in `lambda/api/index.js` (read role, read link, 404 for unlinked)
- [x] `GET /api/me`
- [x] `POST /api/parent/children` (AdminCreateUser, profile, links, 409, limit of 5)
- [x] `GET /api/parent/children`
- [x] `GET /api/parent/children/{childSub}/data` (sanitised: no notes, flashcards, task notes)
- [x] Update `lastSeen` when a user loads their data (at most every 10 minutes)
- [x] `tests/authz.test.js`: matrix of child, parent, unlinked parent, no profile, crafted bodies on every route

### Infrastructure
- [x] IAM permission `AdminCreateUser` on this pool, user pool id in the environment
- [x] New routes in the HTTP API
- [x] Set removal policy RETAIN on `StudentUser` and `OwnerUser`, deploy, confirm both still exist
- [ ] Later change (not this one): remove those two resources from the template

### Tooling
- [x] `tools/admin.mjs`: `set-role`, `link`, `add-parent`
- [ ] Run the migration: the existing parent and child accounts get their roles and are linked

### App
- [x] `/api/me` at start, role switch in `main.js`
- [x] Parent pages: overview, child page with tabs, add a child
- [x] Child notice (Design page card and one-time banner)
- [x] "No profile" screen
- [x] Spanish and English strings
- [x] Version shown in the sidebar (build-time, from `package.json`)
- [x] UI tests for both roles

### Release
- [x] `npm test` passes
- [x] New spec `docs/specs/family.md`, update `accounts-sync.md`, `safety-costs.md`, `design-i18n.md`
- [x] `CHANGELOG.md` entry, version 2.1.0
- [ ] Merge to `main`, tag `v2.1.0`
- [ ] Deploy and live check: parent and child routes answer correctly with fake claims through the Lambda, 401 without a token
- [ ] Owner signs in as the parent and as the child and confirms
- [ ] Mark the proposal `shipped in v2.1.0`

## Phase 2 (v2.2.0)
Planned after phase 1 ships. Needs decision 2 first.
- [ ] Daily usage counters visible to the parent
- [ ] Music search log (60 days) if approved
- [ ] Activity tab
- [ ] Weekly email summary (optional)
