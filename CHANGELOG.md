# Changelog

Format: newest first. Versions are explained in `docs/process.md`.

## [Unreleased]

- Planned: `docs/changes/0001-family-accounts` (parent accounts and read-only family dashboard).

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
