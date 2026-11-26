# 0002 Other adults in the family

- **Status:** shipped in v2.2.0 (requested by the owner 2026-11-21)
- **Target version:** 2.2.0
- **Touches specs:** `family.md`, `safety-costs.md`, `accounts-sync.md`

## Why
Decision 5 of change 0001 left a second parent for later. The owner wants the family admin to add other adults from the app instead of using the admin script.

## Decisions (defaults, taken without questions because the owner asked for the feature)
1. The **family admin** is a parent who was not added by another parent (the existing parent account).
2. An added adult is a **parent, read only**: sees all the admin's children, cannot create children or add adults.
3. The adult is linked to every current child, and to every child the admin creates later.
4. Limit of 4 added adults per admin.
5. Children see added adults in their "Who can see my progress" notice. The notice is shown again when the set of parents changes.
6. Removing an adult is not built. The administrator does it with the admin tool.

## Design
- `POST /api/parent/adults {name, email}` (admin only): creates the Cognito user, a `PROFILE` with `role: parent` and `addedBy`, an `ADULT#<adult>` item under the admin, and both link items for each child. 409 if the email exists, 422 above 4 adults.
- `GET /api/parent/adults` (admin only).
- `GET /api/me` for a parent returns `admin` and, for the admin, `adults`.
- `POST /api/parent/children` now needs the admin.
- App: "Add an adult" page for the admin. An added adult sees only the Family page.

## Acceptance criteria
1. A child, a no-profile account and an added adult get 403 on `/api/parent/adults`; no token gets 401.
2. An added adult cannot create children or adults.
3. The adult reads the admin's children and nobody else's.
4. A child created after the adult is linked to the adult.
5. Duplicate email: 409 and nothing written. Fifth adult: 422.
6. `npm test` passes.
