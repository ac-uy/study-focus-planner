# Safety and costs

The app is used by a minor, so safety checks fail closed: if a check cannot run, the action is refused.

## Data and privacy
- Each user's data is stored under their own verified identity. The server never trusts a user id from the browser.
- Photos sent to the AI are used for one call and are not stored. The text read from a review is stored on the task.
- Tutor conversations are not saved.
- The app has no chat, friends, rankings or other social features, and no ads of its own.
- The repository is public. It must contain no account ids, emails, addresses of the live site, names of people or secrets. Deployment values live in `infra/config.local.json`, which git ignores, and `tests/public.test.mjs` enforces this.

## Parent access
- Role and links are read from DynamoDB on every request, never from the token or the request body.
- A parent can read only the children linked to them, and only through a field-by-field whitelist (see `family.md`). Data of an unlinked child answers 404, the same as a child that does not exist. A child calling a parent route gets 403.
- Only a parent can create child accounts, at most 5 per parent. A parent cannot change a child's data.
- The child is told on the home page and on the Design page who can see her progress and what they see.

## Music content filters (three layers)
1. **Typed text.** A model classifies what she typed as allowed or blocked before anything is searched. Names of artists, songs and genres are allowed. Sexual or explicit requests, violence or weapons, hate, drugs or alcohol, self-harm, vulgar words and anything not about music are blocked. The text is wrapped as data and cannot change the instructions. A blocked search shows a plain message and nothing is searched.
2. **Search.** YouTube is asked for strict safe search, Music category and embeddable videos only.
3. **Results.** Every result is re-checked with YouTube's own details: Music category, public, embeddable, not age-restricted, and no "explicit", "uncensored", "NSFW", "18+" or similar in the title. Pasted links go through the same check, plus the title filter.

Known weakness: because artist names are allowed, an explicit song by an allowed artist is only caught by YouTube's own safe search, its age restriction or the title check. The embedded player also lets her click through to YouTube. Controls on her device (for example Google Family Link) are outside this app.

## AI limits
Daily per user: tutor 100, steps 30, reviews 30, exams 30, flashcards 30. API throttling is 5 requests a second.

## Costs
- Account budget of USD 5 a month: email alerts at 50%, 80% and 100% of actual spend and at a forecast of 100%. A daily anomaly alert for jumps of USD 2 or more. The owner receives them. Nothing is switched off automatically.
- Expected cost is cents a month. A photo review is about 0.13 US cents.
- The YouTube key has no billing attached. If its free quota runs out, music search fails until the next day and nothing is charged.

## Secrets
The YouTube key is a SecureString in SSM Parameter Store, restricted to the YouTube Data API, readable only by the Lambda.

## Tests
`tests/music.test.js` (31 cases of filters and failures), `tools/filter-calibration.js` (manual calibration of the text prompts).
