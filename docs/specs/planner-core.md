# Planner core

The study-management pages of the v2 app. Everything works offline from local storage and syncs when signed in (see `accounts-sync.md`).

## Behaviour

- **Home**: greeting, quote with refresh, exam countdown (next 5), weekly challenges (study 5 days, 300 minutes, 3 days of 30+ minutes; reset each Monday), five numbers (pending tasks, overdue tasks, minutes this week, exams in 30 days, exam week now), the top 3 "needs attention" subjects from results, minutes per week (10 weeks), pending tasks by importance, minutes by subject this month, upcoming exams, next tasks, streak, today's classes from the timetable.
- **Calendar**: Monday-first month view, exams per day, exam weeks tinted, search, add and delete exams (subject, topic, date).
- **Exam weeks**: name, start, end, "in progress" badge.
- **Study plan**: one day at a time, items with subject, minutes and done flag, total planned, add from a pending task.
- **Tasks**: title, subject, minutes, importance (high, medium, low), due date, done. Filters: search, importance, overdue, show done. Each task has a page (`#/tasks/<id>`) to edit everything, link it to an objective, delete it, and use the AI tools (see `ai.md`).
- **Notes**: up to 200 notes of 20,000 characters, subject, autosave. AI: mini exam from a note.
- **Flashcards**: manual or created from a note (5, 10 or 15 cards). Tap to flip, mark "I know it" or not, filter unknown only.
- **Goals and achievements**: study-time goals (per day, week or month, one subject or any), objectives with due date, steps (AI suggestions) and linked tasks, and 15 achievements.
- **Streaks**: current streak, best streak, last 28 days. A day counts if at least one minute was studied.
- **Statistics**: totals, minutes per day (14), per week (8), by subject, by timer mode.
- **Study history**: sessions from the timer and manual ones, filter by mode and title, delete.
- **Timetable**: 5 days by 7 periods, break rows after periods 2 and 4 and lunch after 5.
- **Subjects**: five defaults (Maths, Language, English, Science, History) translated in Spanish, up to 15, custom names shown as typed, duplicates refused ignoring capitals, at least one must remain.

## Data limits
Tasks 500, exams 200, exam weeks 50, plan items 1000, goals 100, study goals 30, results 500, notes 200, cards 1500, sessions 2000. Sections are capped in size (`architecture.md`).

## Tests
`tests/app.test.js` covers every page, adding and editing, the timer, sessions, goals, design and language.

## Known gaps
No recurring tasks, no reminders or notifications, no export of data.
