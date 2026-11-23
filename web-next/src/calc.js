// Derived numbers: minutes studied, streaks, weekly challenges and achievements.
import { addDays, todayKey, mondayOf, dayDiff } from './util.js';

export function minutesByDate(sessions) {
  const m = {};
  sessions.forEach((s) => { m[s.date] = (m[s.date] || 0) + s.minutes; });
  return m;
}
export function minutesBetween(sessions, from, to) {
  let n = 0;
  sessions.forEach((s) => { if (s.date >= from && s.date <= to) n += s.minutes; });
  return n;
}
export function minutesBySubject(sessions, from, to) {
  const m = {};
  sessions.forEach((s) => {
    if (s.date >= from && s.date <= to) m[s.subject || ''] = (m[s.subject || ''] || 0) + s.minutes;
  });
  return m;
}
export function minutesByMode(sessions) {
  const m = {};
  sessions.forEach((s) => { m[s.mode] = (m[s.mode] || 0) + s.minutes; });
  return m;
}
export function weekStart(key) { return mondayOf(key || todayKey()); }
export function weekMinutesSeries(sessions, weeks) {
  const start = weekStart();
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = addDays(start, -7 * i);
    out.push({ from, minutes: minutesBetween(sessions, from, addDays(from, 6)) });
  }
  return out;
}
export function dayMinutesSeries(sessions, days) {
  const by = minutesByDate(sessions);
  const t = todayKey();
  const out = [];
  for (let i = days - 1; i >= 0; i--) { const k = addDays(t, -i); out.push({ date: k, minutes: by[k] || 0 }); }
  return out;
}

export function streakInfo(sessions) {
  const days = new Set(sessions.filter((s) => s.minutes >= 1).map((s) => s.date));
  const t = todayKey();
  let cur = 0, d = days.has(t) ? t : addDays(t, -1);
  while (days.has(d)) { cur++; d = addDays(d, -1); }
  const sorted = Array.from(days).sort();
  let best = 0, run = 0, prev = null;
  sorted.forEach((k) => {
    run = prev && dayDiff(prev, k) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  });
  return { current: cur, best, todayDone: days.has(t), days };
}

export function weekChallenges(sessions) {
  const from = weekStart(), to = addDays(from, 6);
  const by = minutesByDate(sessions);
  const dates = Object.keys(by).filter((k) => k >= from && k <= to);
  return [
    { id: 'days', value: dates.length, target: 5, unit: 'days' },
    { id: 'minutes', value: minutesBetween(sessions, from, to), target: 300, unit: 'min' },
    { id: 'long', value: dates.filter((k) => by[k] >= 30).length, target: 3, unit: 'days' },
  ];
}

export function goalProgress(goal, sessions) {
  const t = todayKey();
  let from = t, to = t;
  if (goal.period === 'week') { from = weekStart(); to = addDays(from, 6); }
  if (goal.period === 'month') { from = t.slice(0, 8) + '01'; to = t.slice(0, 8) + '31'; }
  const ss = goal.subject ? sessions.filter((s) => s.subject === goal.subject) : sessions;
  return minutesBetween(ss, from, to);
}

export function achievements(st) {
  const total = st.sessions.reduce((a, s) => a + s.minutes, 0);
  const { best } = streakInfo(st.sessions);
  const doneTasks = st.tasks.filter((x) => x.done).length;
  const known = st.cards.filter((c) => c.known).length;
  const c = st.counters;
  return [
    { id: 'first', icon: '🌱', ok: st.sessions.length >= 1 },
    { id: 'hour1', icon: '⏱️', ok: total >= 60 },
    { id: 'hour10', icon: '⏳', ok: total >= 600 },
    { id: 'hour50', icon: '🏅', ok: total >= 3000 },
    { id: 'streak3', icon: '🔥', ok: best >= 3 },
    { id: 'streak7', icon: '🌟', ok: best >= 7 },
    { id: 'tasks5', icon: '✅', ok: doneTasks >= 5 },
    { id: 'tasks25', icon: '🏆', ok: doneTasks >= 25 },
    { id: 'notes3', icon: '📝', ok: st.notes.length >= 3 },
    { id: 'cards10', icon: '🃏', ok: st.cards.length >= 10 },
    { id: 'known10', icon: '🧠', ok: known >= 10 },
    { id: 'exam', icon: '📅', ok: st.exams.length >= 1 },
    { id: 'review', icon: '📷', ok: c.reviews >= 1 },
    { id: 'miniexam', icon: '🎯', ok: c.exams >= 1 },
    { id: 'tutor', icon: '💬', ok: c.chats >= 5 },
  ];
}

// ----- grades: averages, trends and what needs attention -----
export const PASS_MARK = 5; // Spanish scale, 0 to 10
export const gradeOf = (r) => (r.max > 0 ? (r.score / r.max) * 10 : 0);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function trendOf(grades) {
  const n = grades.length;
  if (n < 2) return { dir: 'none', delta: 0 };
  const recent = n >= 4 ? mean(grades.slice(-2)) : grades[n - 1];
  const earlier = n >= 4 ? mean(grades.slice(0, -2)) : mean(grades.slice(0, -1));
  const delta = recent - earlier;
  return { dir: delta >= 0.7 ? 'up' : delta <= -0.7 ? 'down' : 'flat', delta };
}

export function subjectSummaries(results) {
  const by = {};
  results.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => { (by[r.subject] = by[r.subject] || []).push(r); });
  return Object.keys(by).map((subject) => {
    const list = by[subject], g = list.map(gradeOf), tr = trendOf(g);
    return { subject, list, count: list.length, avg: mean(g), last: g[g.length - 1], best: Math.max(...g), worst: Math.min(...g), dir: tr.dir, delta: tr.delta };
  });
}
export const overallAverage = (results) => mean(results.map(gradeOf));

// Subjects that deserve attention, most urgent first. Each carries the reasons so the page can explain them.
export function attentionList(results, sessions, exams, today) {
  const sums = subjectSummaries(results), overall = overallAverage(results);
  const mins = minutesBySubject(sessions, addDays(today, -13), today);
  const tracking = sessions.some((s) => s.date >= addDays(today, -13));
  return sums.map((s) => {
    const reasons = [];
    let score = 0;
    if (s.avg < PASS_MARK) { reasons.push('failing'); score += 3; } else if (s.avg < 6) { reasons.push('borderline'); score += 1.5; }
    if (s.dir === 'down') { reasons.push('declining'); score += 2; }
    if (s.count >= 2 && overall - s.avg >= 1.5) { reasons.push('belowAvg'); score += 1; }
    const exam = exams.filter((e) => e.subject === s.subject && e.date >= today && dayDiff(today, e.date) <= 14).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
    if (exam && s.avg < 7) { reasons.push('examSoon'); score += 1.5; }
    const minutes = mins[s.subject] || 0;
    if (tracking && s.avg < 7 && minutes < 60) { reasons.push('littleStudy'); score += 1; }
    score += Math.max(0, 7 - s.avg) * 0.3;
    return { ...s, reasons, score, minutes, exam };
  }).filter((x) => x.reasons.length).sort((a, b) => b.score - a.score);
}
