# 0001 Family accounts

- **Status:** phase 1 shipped in v2.1.0 (approved 2026-11-21); phase 2 planned
- **Target versions:** 2.1.0 (phase 1), 2.2.0 (phase 2)
- **Touches specs:** `accounts-sync.md`, `safety-costs.md`, new `family.md`, `design-i18n.md` (child notice)

## Why

A parent wants to see how their child uses the app: study time, tasks, exams, grades. Today every account is equal and nobody can see another user's data. Child accounts should only be created by a parent.

Account facts today: the pool has one child account and one parent account, both created by the administrator. There are no groups or roles.

## Scope

### Phase 1 (v2.1.0): roles, links, read-only dashboard
- Two roles, **parent** and **child**, stored on the server. The browser cannot set or change a role.
- Parent accounts are created by the owner (administrator) with a script. Self sign-up stays off.
- A parent creates child accounts from the app ("Add a child": name and email). The child gets the usual Cognito email with a temporary password.
- A parent can see only the children linked to them. A child can have several parents and a parent several children.
- Read-only family dashboard for parents.
- A notice for the child saying what her parents can see.
- Show the app version in the sidebar.
- One-time migration: the existing parent account gets the parent role, the existing child account gets the child role, and they are linked.

### Phase 2 (v2.2.0): activity
- Daily counts of tutor messages, photo reviews, mini exams.
- Music searches she made, including blocked ones, kept 60 days.
- "Last active" time.
- Optional weekly email summary to the parent.

### Out of scope
- Parents editing a child's data, resetting her password, or reading notes, flashcards or tutor conversations.
- Deleting a child account from the app (done by the administrator).
- Self-service parent sign-up.

## Open decisions (defaults apply if the owner says "defaults")

| # | Question | Default |
| --- | --- | --- |
| 1 | What can a parent see? | Study time and sessions, streak, tasks, exams, grades and trends, goals, timetable, last active. Not notes, flashcards, tutor text or photos |
| 2 | Log music searches and AI-use counts for the parent (phase 2)? | Yes for counts. Searches only after an explicit yes. Not built without it |
| 3 | Does the child see a notice? | Yes: on her Design page and once at her next sign-in |
| 4 | Does the parent account also keep a personal planner? | No. The family view only. Their existing planner data is left untouched |
| 5 | Add a second parent now? | Not now. The admin script can do it later |

**Answer from the owner:** defaults for all five decisions. Logging music searches (phase 2) stays off until the owner says yes.

## Design

### Data (same DynamoDB table)

| Partition key | Sort key | Content |
| --- | --- | --- |
| `USER#<sub>` | `PROFILE` | `role` (`parent` or `child`), `name`, `email`, `createdAt`, `createdBy`, `lastSeen` |
| `USER#<parentSub>` | `CHILD#<childSub>` | `name`, `email`, `linkedAt` |
| `USER#<childSub>` | `PARENT#<parentSub>` | `name`, `email`, `linkedAt` (so the child can see who can view her data) |

The existing storage routes write only `V2#...` and `DATA` items, so no ordinary call can touch `PROFILE` or the link items.

### Routes (all behind the existing token check)

| Route | Who | What |
| --- | --- | --- |
| `GET /api/me` | anyone signed in | role, name, email, linked children or parents. 403 if the account has no profile |
| `POST /api/parent/children` | parent | `{name, email}`: creates the Cognito user (invitation email), `PROFILE`, both link items. 409 if the email already exists. Limit 5 children per parent |
| `GET /api/parent/children` | parent | linked children with last active |
| `GET /api/parent/children/{childSub}/data` | parent, linked | the child's `core` and `sessions`, without notes, flashcards and per-task notes. An unlinked id answers 404 |
| `GET /api/parent/children/{childSub}/activity` | parent, linked | phase 2 |

Role and link are read from DynamoDB on every request. Nothing in the token or the request body is trusted for them. `lastSeen` is updated when she loads her data, at most every 10 minutes.

### Infrastructure
- IAM: `cognito-idp:AdminCreateUser` on this user pool only, and the table access that exists.
- Environment: the user pool id.
- New routes in the HTTP API.

### App
- At start the app asks `/api/me`. A **child** gets the app as it is, plus a "Who can see my progress" card on the Design page and a one-time notice. A **parent** gets a different menu:
  - Overview: one card per child (last active, minutes this week, streak, overdue tasks, next exam, attention list)
  - Child page with tabs: Summary, Study, Tasks, Exams and grades, Goals
  - Add a child
  - Sign out and language
- The family pages reuse `calc.js` (averages, trends, attention, streaks) on the data the server returns.
- An account with no profile sees a short "ask your parent" message and nothing else.

### Tooling
`tools/admin.mjs` (uses the `planner` profile): `set-role`, `link`, `add-parent`. Used once for the migration.

## Risks

- **Removing the two users from the CDK stack would delete them.** `StudentUser` and `OwnerUser` are CloudFormation resources. First set their removal policy to retain and deploy, only then remove them from the template. Verify both can still sign in.
- **Privacy of a minor.** The child must be told what is visible. Parent access is read-only and limited to the list above.
- **Cognito's default email sender** is limited to about 50 emails a day. Enough here.
- **Role escalation.** Mitigated by server-side roles, no route that writes `PROFILE`, and tests that try to call parent routes as a child and as an unlinked parent.
- **Tokens issued before the change** keep working. That is fine because roles are read from the table, not the token.

## Acceptance criteria

1. A child account gets 403 on every `/api/parent/*` route.
2. A parent gets 404 for a child they are not linked to, and cannot read any other user's data through any route.
3. The data returned to a parent contains no notes, flashcards, task notes or tutor text.
4. A child cannot change her role or links by any request (tested with crafted bodies to every write route).
5. Creating a child with an email that already has an account fails with 409 and changes nothing.
6. A new child receives the Cognito invitation email and appears linked to the parent.
7. The parent menu shows the family pages. The child menu is unchanged apart from the notice.
8. After deploy: the parent can sign in and see the child's data, and the child still signs in and keeps all of her data.
9. `npm test` passes, including a new authorisation test matrix.
10. Specs, changelog and version updated, tag `v2.1.0` created.
