# Accounts and sync

## Sign-in
- Accounts are created by an administrator. There is no self sign-up.
- Sign-in uses the Cognito hosted page with an emailed temporary password, then the user sets their own (at least 10 characters with upper case, lower case and a digit).
- A session lasts up to 30 days on one device. "Sign out" clears the tokens and the local copy of the data.
- Without a `config.json` or when opened as a file, the app runs in local mode: everything works except the AI features and music, and nothing syncs.

## Sync
- Data is split into four sections: `core` (profile, settings, design, tasks, exams, exam weeks, plan, timetable, goals, study goals, results, usage counters), `notes`, `cards` and `sessions`.
- Every change is saved to local storage straight away and pushed to the server about 0.8 seconds later.
- On open, each section is compared by its last-changed time. The newer side wins and the older side is overwritten.
- If a section grows past the size cap, syncing it stops and the page says there is too much data.
- Two devices editing at the same moment can overwrite each other's last change.

## First sign-in on v2
If the server has no v2 data and the device has none, the app imports what the account saved in v1: tasks, goals, settings, and study blocks converted to minutes of study.

## Account data she controls
Name and school year (profile), subjects, timer lengths, design. Her background photo stays on the device.

## Tests
`tests/app.test.js`: import from v1, sync pushes, token handling in the sign-in flow.

## Known gaps
No conflict merge inside a section. No way to export or delete her own data from the app. Roles and parent access do not exist yet (change 0001).
