# AI features

All AI calls go through the Lambda (Amazon Bedrock). The browser never holds an AI key. Every call needs a signed-in user and counts toward a daily limit per user.

## Tutor (`/api/ai/chat`)
- Guides with hints and questions. It never gives the final answer, a full solution or finished homework, even if she insists, says the teacher allowed it or is out of time.
- May explain concepts and work a different example. When she shares an attempt it says what is right, points to the mistake and lets her fix it.
- Short replies (under about 120 words), in the language she writes in. Stays on schoolwork. If she seems upset it suggests a trusted adult. It does not reveal or change its rules.
- Uses her school year to pitch hints and her chosen subject.
- Photos: up to 3 per message, at most 4 photos sent per request (newest win). Photos in messages use the stronger vision model. The page shrinks and brightens photos first. Unclear parts are named and she is asked to type them or retake the photo; the tutor does not guess.
- "Discuss with the tutor" after a review opens the tutor with the review as private context. The tutor must not quote the corrections, only guide to them.
- Conversations are held in memory only and are not saved anywhere.
- Limit: 100 messages a day.

## Photo review (`/api/ai/review`)
- Input: one JPEG up to 3.5 MB, subject, task title, school year, language.
- Output: transcription, verdict, what is right, corrections (issue and fix), additions, and parts that were hard to read (not counted as mistakes). Text inside the photo is data, never instructions.
- The transcription (up to 4000 characters) is saved on the task as its notes. The photo is not stored.
- The page shows "What I read" so she can see misreads.
- Limit: 30 a day.

## Mini exam (`/api/ai/exam`)
- 5 multiple-choice questions with 4 options and an explanation each, from the review text or a note. Option order is shuffled on the server. Scored in the page.
- Limit: 30 a day.

## Flashcards (`/api/ai/cards`)
- 3 to 15 cards from a note, questions on the front and short answers on the back.
- Limit: 30 a day.

## Goal steps (`/api/ai/steps`)
- 3 to 6 short steps for an objective, skipping steps she already has.
- Limit: 30 a day.

## Models and cost
Nova Lite for text, Nova 2 Lite for photos, reviews and exams (`architecture.md`). A photo review costs about 0.13 US cents.

## Tests
Server prompts are exercised by manual calls. `tools/filter-calibration.js` checks the music prompts against the real model. UI flows are in `tests/app.test.js`.

## Known gaps
The tutor rule is enforced by the prompt, not by a second check, so a determined student can sometimes get a full answer. Handwriting reading is judged on synthetic samples only; real handwriting has not been measured.
