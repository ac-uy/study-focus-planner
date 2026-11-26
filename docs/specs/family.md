# Family accounts

Introduced in 2.1.0 (change 0001). Describes current behaviour.

## Roles
- `child`: the student app. Syncs her own data.
- `parent`: a read-only family view of linked children. No personal planner and no sync of study data.
- No profile: the account exists in Cognito but has no role. `/api/me` answers 403 and the app shows a notice with no menu.
- Only a parent can create child accounts (up to 5, duplicate email answers 409). Further parents or role changes are made by the administrator with `tools/admin.mjs` (`show`, `add-parent`, `set-role`, `link`).

## Storage
`USER#<sub>/PROFILE` holds role, name, email, createdAt, createdBy and lastSeen. A link is stored on both sides: `USER#<parent>/CHILD#<child>` and `USER#<child>/PARENT#<parent>`. Role and links are read from the table on each request. They are never taken from the token or the request body. `lastSeen` is updated at most every 10 minutes when a child calls `/api/me`, and never creates a profile.

## What a parent sees
Study minutes and sessions, streak, tasks, exams, exam weeks, grades with trends, goals and study goals, timetable and last active time.

Not shared: notes, flashcards, tutor conversations, photos, the plan, design choices and usage counters. The server copies each shared field one by one with length limits (`shareCore`, `shareSessions`), so a new field in the child's data is not shared until it is added there.

## Other adults (since 2.2.0, change 0002)
- The family admin is a parent without `addedBy` in the profile. The admin can add up to 4 other adults ("Add an adult": name and email, Cognito invitation). Duplicate email answers 409.
- An added adult is a parent who can only look: no creating children, no adding adults. They are linked to all the admin's children now and to children created later (`USER#<admin>/ADULT#<adult>` records who was added).
- Children see added adults in their notice. Removing an adult is done with the admin tool.

## Pages (parent)
- Menu: Family, Add a child and Add an adult for the admin. An added adult sees only Family.
- Family: one card per child with the week's figures and the top attention items. Data per child is loaded once and reused for 60 seconds.
- Child page: tabs Summary, Study, Tasks, Grades, Goals. Everything is read only.
- Add a child: name and email. The child receives the Cognito invitation email.

## Pages (child)
Home card and Design card explaining who can see her progress. See `design-i18n.md`.

## Errors
Unlinked child data: 404. A child on a parent route: 403. A parent without children sees an empty state with a link to the add form.

## Tests
`tests/authz.test.js` (every route against child, parent, unlinked parent, no profile and crafted bodies) and `tests/family.test.js` (both roles, no-profile and `/api/me` failure in the browser).

## Known gaps
Adults cannot be removed from the app. No usage counts or activity log yet (phase 2 of change 0001, now planned for v2.3.0).
