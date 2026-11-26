# Changelog

Format: newest first. Versions are explained in `docs/process.md`.

## [Unreleased]

- Planned: phase 2 of family accounts (usage counts, activity tab), now v2.3.0.

## [2.2.0] - 2026-11-21

Other adults in the family (`docs/changes/0002-family-adults`).

### Added
- The family admin can add other adults ("Add an adult"). They see all the admin's children, read only.
- `GET/POST /api/parent/adults`; `GET /api/me` returns `admin` and the added adults.

### Changed
- Creating child accounts now needs the family admin; an added adult cannot create children or adults.
- The Lambda stays within the same Cognito permission (create users in this pool).

## [2.1.0] - 2026-11-21

Family accounts, phase 1 (`docs/changes/0001-family-accounts`).

### Added
- Roles: parent and child. `GET /api/me`, `GET/POST /api/parent/children`, `GET /api/parent/children/{childSub}/data`.
- Parent family view (read only): overview per child, child page with Summary, Study, Tasks, Grades and Goals tabs.
- Parents can create child accounts (up to 5).
- Notice for the child on the home page and a "Who can see my progress" card on the Design page.
- Screen for accounts without a role.
- App version shown in the sidebar.
- `tools/admin.mjs` to set roles and link accounts.
- Tests: `tests/authz.test.js`, `tests/family.test.js`.

### Changed
- The two Cognito users in the stack have a retain policy, so removing them from the template later will not delete the accounts.
- The Lambda may create users in this user pool only.

## [2.0.0] - 2026-11-21

Baseline of the new app, served at `/next/`. Work before this point was not under version control, so this entry summarises everything built so far.

### Added
- Pages: home, calendar, exam weeks, study plan, tasks, results (grades), study tutor, flashcards, notes, goals and achievements, streaks, statistics, timer, timetable, study history, design.
- Results: grades with averages, trends and a "needs attention" list.
- AI features (Amazon Bedrock): Socratic tutor with photos, photo review of handwritten work, mini exams, flashcards from notes, goal step suggestions.
- 29 background sounds: 16 public domain recordings from Wikimedia Commons looped with crossfade, the rest generated in the browser.
- Music search and player (YouTube): typed text check, strict safe search, Music-category and age-restriction screening, pasted-link check, automatic next song, fallback between the two official embed addresses, message when a device blocks YouTube.
- Design: 8 colours plus custom, light/dark/system, 4 corner shapes, 10 fonts, 18 backgrounds (8 animated), own photo.
- Quote on every page load with a refresh button; line icons in the menu.
- Cloud sync in four sections, import of the v1 data on first sign-in.
- Cost controls: monthly budget alerts and anomaly detection.
- Tests in the repository (`npm test`), including a check that no personal or deployment value is in a tracked file.
- Deployment values (account, region, emails, budget) read from `infra/config.local.json`, which git ignores. `infra/config.example.json` shows the shape. The deployed stack is unchanged by this.

### Known gaps
- No parent accounts yet (planned in 0001).
- Names of artists are allowed in music search, so explicit songs by allowed artists rely on YouTube's own filters and the title check.
- School-managed devices may block the YouTube player.

## [1.0.0]

The original single page in `web/`: timer, tasks, goals, 7-day chart, settings, English and Spanish, simple AI step suggestions. Still served at the site root.
