# Results (grades)

## Behaviour
- A result has: subject, type (partial, exam, quiz, project, other), optional title, date, grade and "out of" (default 10, at most 100). Decimal comma or point accepted. A grade above the maximum is refused.
- Everything is shown on a 0 to 10 scale. The pass mark is 5.
- Past exams from the calendar that have no result are offered as one-tap shortcuts.
- Summary: overall average, latest result, best subject, subject needing most attention.
- Per subject: count, average, last, trend, best, worst.
- Trend: with 4 or more results, the last two against the earlier average. With fewer, the last against the earlier average. A change of 0.7 or more is "up" or "down", otherwise "steady".
- Chart: grades over time per subject with a dashed line at 5. Tap a subject to show it alone.

## Needs attention
Each subject with results gets points. Subjects with at least one reason are listed, highest score first, with the reasons in words and shortcuts to plan, flashcards, tutor and timer.

| Reason | Condition | Points |
| --- | --- | --- |
| Failing | average below 5 | 3 |
| Borderline | average below 6 | 1.5 |
| Declining | trend is down | 2 |
| Below her own average | 2 or more results and 1.5 under the overall average | 1 |
| Exam soon | exam in the next 14 days and average below 7 | 1.5 |
| Little study | average below 7, under 60 minutes of study in 14 days, and some study recorded in that window | 1 |

Plus 0.3 per point the average is below 7.

## Data
`results` in the `core` section. Up to 500.

## Tests
`tests/app.test.js`: adding grades, decimal comma, a grade over the maximum is refused, the attention reasons, the chart, focusing one subject, and the card on the home page.

## Known gaps
No weighting by credit or exam importance, no per-term averages, no export.
