// Parent pages: a read-only view of the linked children, and the form that adds a child.
// The server decides what a parent may see (see lambda/api/index.js, shareCore); this file only shows it.
import { h, todayKey, addDays, dayDiff, fmtMin } from '../util.js';
import { t, subjectName, fmtDate, weekdayShort, daysLeftText } from '../i18n.js';
import { register, refresh } from '../actions.js';
import { api, net, reloadMe } from '../api.js';
import { icon } from '../icons.js';
import { bar, barChart, lineChart, hBars } from '../ui.js';
import {
  minutesBetween, minutesBySubject, dayMinutesSeries, weekMinutesSeries, streakInfo, attentionList,
  subjectSummaries, overallAverage, weekStart, goalProgress, gradeOf, PASS_MARK,
} from '../calc.js';
import { trendChart, num } from './results.js';

const CACHE_MS = 60 * 1000;
const MAX_CHILDREN = 5;
const TABS = ['summary', 'study', 'tasks', 'grades', 'goals'];
const ARROW = { up: '↗', down: '↘', flat: '→', none: '–' };
const cache = new Map(); // child sub -> { at, loading } | { at, error } | { at, data }
const ui = { tab: 'summary', busy: false, msg: '', error: '', name: '', email: '' };

const children = () => (net.me && net.me.children) || [];
const gcls = (g) => (g < PASS_MARK ? 'hot' : g >= 7 ? 'good' : '');
const trendMark = (dir) => h`<span class="trend ${dir}" title="${t('trend.' + dir)}">${ARROW[dir]}</span>`;

function ago(ts) {
  if (!ts) return t('fam.never');
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 2) return t('fam.justNow');
  if (min < 60) return t('fam.minAgo', { n: min });
  if (min < 1440) return t('fam.hoursAgo', { n: Math.floor(min / 60) });
  if (min < 14 * 1440) return t('fam.daysAgo', { n: Math.floor(min / 1440) });
  return fmtDate(new Date(ts).toISOString().slice(0, 10));
}

// Loads one child's data. A recent answer (or an answer still on its way) is reused, so re-drawing the page never loops.
async function load(sub, force) {
  const hit = cache.get(sub);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return;
  cache.set(sub, { at: Date.now(), loading: true });
  try {
    cache.set(sub, { at: Date.now(), data: await api('GET', '/api/parent/children/' + encodeURIComponent(sub) + '/data') });
  } catch (e) {
    cache.set(sub, { at: Date.now(), error: true });
  }
  refresh();
}

function summarize(d) {
  const today = todayKey(), wk = weekStart(today);
  const pending = d.core.tasks.filter((x) => !x.done);
  const exams = d.core.exams.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return {
    today,
    weekMin: minutesBetween(d.sessions, wk, addDays(wk, 6)),
    streak: streakInfo(d.sessions).current,
    pending: pending.length,
    overdue: pending.filter((x) => x.due && x.due < today).length,
    next: exams[0] || null,
    exams,
    attention: attentionList(d.core.results, d.sessions, d.core.exams, today),
  };
}

function stat(label, value, sub, c) {
  return h`<div class="card stat"><div class="stat-h"><span>${label}</span></div><div class="stat-v ${c || ''}">${value}</div><div class="muted small">${sub || ''}</div></div>`;
}
function summaryStats(s) {
  return h`<div class="stats5">
    ${stat(t('minutesWeek'), fmtMin(s.weekMin), t('sinceMonday'))}
    ${stat(t('streak'), t('nDays', { n: s.streak }), '')}
    ${stat(t('pendingTasks'), s.pending, t('notDoneYet'))}
    ${stat(t('overdueTasks'), s.overdue, t('overdueSub'), s.overdue ? 'hot' : '')}
    ${stat(t('fam.nextExam'), s.next ? subjectName(s.next.subject) : '–', s.next ? daysLeftText(dayDiff(s.today, s.next.date)) : t('fam.noNextExam'))}
  </div>`;
}

function attentionBlock(list, today, limit) {
  const rows = list.slice(0, limit || 50);
  if (!rows.length) return h`<p class="good">✓ ${t('nothingToWorry')}</p>`;
  return h`${rows.map((a) => h`<div class="attn"><div class="row-line"><span><strong>${subjectName(a.subject)}</strong> ${trendMark(a.dir)}</span><span class="${gcls(a.avg)}">${t('avgShort')} ${num(a.avg)} · ${t('lastShort')} ${num(a.last)}</span></div>
    <ul class="why">${a.reasons.map((r) => h`<li>${t('why.' + r, { n: a.exam ? dayDiff(today, a.exam.date) : 0, min: a.minutes })}</li>`)}</ul></div>`)}`;
}

function examsCard(s) {
  return h`<section class="card"><h2>${t('upcomingExams')}</h2>${s.exams.length ? s.exams.slice(0, 6).map((e) => h`<div class="row-line"><span><strong>${subjectName(e.subject)}</strong>${e.title ? ' · ' + e.title : ''}</span><span class="muted small">${fmtDate(e.date)} · ${daysLeftText(dayDiff(s.today, e.date))}</span></div>`) : h`<p class="muted">${t('noExams')}</p>`}</section>`;
}

function childCard(k) {
  const e = cache.get(k.sub), s = e && e.data ? summarize(e.data) : null;
  return h`<section class="card famcard">
    <div class="row-line"><div><h2>${k.name}</h2><p class="muted small">${k.email} · ${t('fam.lastActive', { when: ago(k.lastSeen) })}</p></div><a class="btn" href="#/family/${k.sub}">${t('fam.open')}</a></div>
    ${s ? h`${summaryStats(s)}${s.attention.length ? h`<h3>${t('needsAttention')}</h3>${attentionBlock(s.attention, s.today, 2)}` : ''}`
      : e && e.error ? h`<p class="err">${t('fam.loadErr')} <button class="link" data-act="family.retry" data-sub="${k.sub}">${t('fam.retry')}</button></p>`
        : h`<p class="muted">${t('fam.loading')}</p>`}
  </section>`;
}

// ----- the five tabs of a child's page -----
function summaryTab(d, s) {
  const tt = d.core.timetable, hasTT = Object.keys(tt).length > 0;
  return h`${summaryStats(s)}
    <section class="card"><h2>${t('needsAttention')}</h2>${d.core.results.length ? attentionBlock(s.attention, s.today) : h`<p class="muted">${t('fam.noResultsYet')}</p>`}</section>
    ${examsCard(s)}
    ${hasTT ? h`<section class="card"><h2>${t('timetable')}</h2><div class="tablewrap"><table class="tt mini"><thead><tr><th></th>${[0, 1, 2, 3, 4].map((i) => h`<th>${weekdayShort(i)}</th>`)}</tr></thead>
      <tbody>${[0, 1, 2, 3, 4, 5, 6].map((p) => h`<tr><th>${p + 1}</th>${[0, 1, 2, 3, 4].map((i) => h`<td>${tt[i + '-' + p] || ''}</td>`)}</tr>`)}</tbody></table></div></section>` : ''}`;
}

function studyTab(d) {
  const today = todayKey(), ss = d.sessions;
  const days = dayMinutesSeries(ss, 14), weeks = weekMinutesSeries(ss, 8);
  const subj = Object.entries(minutesBySubject(ss, '0000-01-01', today)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const recent = ss.slice().sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts).slice(0, 30);
  return h`<div class="grid2">
      <section class="card"><h2>${t('minutesPerDay')}</h2><p class="muted small">${t('last14Days')}</p>${barChart(days.map((x) => ({ label: fmtDate(x.date, { day: 'numeric' }), value: x.minutes })))}</section>
      <section class="card"><h2>${t('minutesPerWeek')}</h2><p class="muted small">${t('last8Weeks')}</p>${lineChart(weeks.map((w) => w.minutes))}<p class="muted small">${weeks.map((w) => w.minutes).join(' · ')}</p></section>
    </div>
    <section class="card"><h2>${t('bySubject')}</h2>${subj.length ? hBars(subj.map(([s, m]) => ({ label: subjectName(s), value: m, text: fmtMin(m) }))) : h`<p class="muted">${t('noData')}</p>`}</section>
    <section class="card"><h2>${t('fam.sessions')}</h2><div class="tablewrap"><table>
      <thead><tr><th>${t('date')}</th><th>${t('minutes')}</th><th>${t('modeLabel')}</th><th>${t('subject')}</th><th>${t('title')}</th></tr></thead>
      <tbody>${recent.length ? recent.map((x) => h`<tr><td>${fmtDate(x.date)}</td><td>${x.minutes}</td><td>${t('mode.' + x.mode)}</td><td>${subjectName(x.subject)}</td><td>${x.title}</td></tr>`) : h`<tr><td colspan="5" class="muted">${t('noSessions')}</td></tr>`}</tbody></table></div></section>`;
}

function tasksTab(d, s) {
  const today = s.today;
  const open = d.core.tasks.filter((x) => !x.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const done = d.core.tasks.filter((x) => x.done).sort((a, b) => (b.due || '').localeCompare(a.due || '')).slice(0, 30);
  const all = open.concat(done);
  const row = (x) => {
    const over = !x.done && x.due && x.due < today;
    return h`<tr class="${x.done ? 'done' : ''}"><td>${x.title}</td><td>${subjectName(x.subject)}</td><td>${fmtMin(x.minutes)}</td><td><span class="badge imp-${x.importance}">${t('imp.' + x.importance)}</span></td>
      <td class="${over ? 'hot' : ''}">${x.due ? fmtDate(x.due) : '—'}</td><td>${x.done ? t('fam.status.done') : over ? t('fam.status.overdue') : t('fam.status.open')}</td></tr>`;
  };
  return h`<section class="card"><div class="tablewrap"><table>
    <thead><tr><th>${t('title')}</th><th>${t('subject')}</th><th>${t('time')}</th><th>${t('importance')}</th><th>${t('dueDate')}</th><th></th></tr></thead>
    <tbody>${all.length ? all.map(row) : h`<tr><td colspan="6" class="muted">${t('noTasks')}</td></tr>`}</tbody></table></div></section>`;
}

function gradesTab(d, s) {
  const rs = d.core.results;
  if (!rs.length) return h`<section class="card"><p class="muted">${t('fam.noResultsYet')}</p></section>${examsCard(s)}`;
  const sums = subjectSummaries(rs).sort((a, b) => b.avg - a.avg);
  const overall = overallAverage(rs);
  return h`<div class="stats4">${stat(t('overallAvg'), num(overall), t('passMarkNote', { n: PASS_MARK }), gcls(overall))}</div>
    <section class="card"><h2>⚠ ${t('needsAttention')}</h2><p class="muted small">${t('needsAttentionSub')}</p>${attentionBlock(s.attention, s.today)}</section>
    <section class="card"><h2>${t('trends')}</h2><p class="muted small">${t('trendsSub')}</p>${trendChart(sums, { focus: '', staticLegend: true })}</section>
    <section class="card"><h2>${t('bySubject')}</h2><div class="tablewrap"><table>
      <thead><tr><th>${t('subject')}</th><th>${t('results')}</th><th>${t('average')}</th><th>${t('lastShort')}</th><th>${t('trendLabel')}</th><th>${t('best')}</th><th>${t('worst')}</th></tr></thead>
      <tbody>${sums.map((x) => h`<tr><td>${subjectName(x.subject)}</td><td>${x.count}</td><td class="${gcls(x.avg)}"><strong>${num(x.avg)}</strong></td><td class="${gcls(x.last)}">${num(x.last)}</td><td>${trendMark(x.dir)}</td><td>${num(x.best)}</td><td>${num(x.worst)}</td></tr>`)}</tbody></table></div></section>
    <section class="card"><h2>${t('allResults')}</h2><div class="tablewrap"><table>
      <thead><tr><th>${t('date')}</th><th>${t('subject')}</th><th>${t('kind')}</th><th>${t('title')}</th><th>${t('grade')}</th></tr></thead>
      <tbody>${rs.slice().sort((a, b) => b.date.localeCompare(a.date)).map((r) => h`<tr><td>${fmtDate(r.date)}</td><td>${subjectName(r.subject)}</td><td>${t('kind.' + r.kind)}</td><td>${r.title}</td><td class="${gcls(gradeOf(r))}"><strong>${num(r.score)}</strong>${r.max !== 10 ? h` <span class="muted small">/ ${num(r.max)}</span>` : ''}</td></tr>`)}</tbody></table></div></section>
    ${examsCard(s)}`;
}

function goalsTab(d) {
  const today = todayKey(), wg = d.core.weeklyGoals, goals = d.core.goals, tasks = d.core.tasks;
  return h`<section class="card"><h2>${t('fam.studyGoals')}</h2>${wg.length ? wg.map((g) => {
      const done = goalProgress(g, d.sessions);
      return h`<div class="goalrow"><div class="row-line"><span><strong>${g.subject ? subjectName(g.subject) : t('anySubject')}</strong> <span class="muted small">${t('period.' + g.period)}</span></span><span>${fmtMin(done)} / ${fmtMin(g.minutes)}</span></div>${bar((done / (g.minutes || 1)) * 100)}</div>`;
    }) : h`<p class="muted">${t('noStudyGoals')}</p>`}</section>
    <section class="card"><h2>${t('fam.objectives')}</h2>${goals.length ? goals.map((g) => {
      const linked = tasks.filter((x) => x.goalId === g.id);
      const total = g.steps.length + linked.length, done = g.steps.filter((x) => x.done).length + linked.filter((x) => x.done).length;
      return h`<div class="goalrow"><div class="row-line"><span><strong>${g.title}</strong>${g.due ? h` <span class="muted small">${fmtDate(g.due)} · ${daysLeftText(dayDiff(today, g.due))}</span>` : ''}</span><span class="muted small">${t('stepsDone', { done, total })}</span></div>${bar(total ? (done / total) * 100 : 0)}
        ${g.steps.map((x) => h`<div class="row-line${x.done ? ' done' : ''}"><span>${x.done ? '✓' : '○'} ${x.title}</span></div>`)}</div>`;
    }) : h`<p class="muted">${t('noObjectives')}</p>`}</section>`;
}

function childView(sub) {
  const k = children().find((x) => x.sub === sub);
  if (!k) return h`<p><a href="#/family">${t('fam.back')}</a></p><p class="muted">${t('fam.notFound')}</p>`;
  const e = cache.get(sub);
  const head = h`<p><a href="#/family">${t('fam.back')}</a></p>
    <div class="page-head"><div><h1>${k.name}</h1><p class="muted small">${k.email} · ${t('fam.lastActive', { when: ago(k.lastSeen) })}</p></div>
      <button class="btn ghost" data-act="family.retry" data-sub="${sub}">${icon('refresh')} ${t('fam.refresh')}</button></div>
    <div class="tabs">${TABS.map((x) => h`<button class="tab${ui.tab === x ? ' on' : ''}" data-act="family.tab" data-tab="${x}">${t('fam.tab.' + x)}</button>`)}</div>`;
  if (!e || e.loading) return h`${head}<p class="muted">${t('fam.loading')}</p>`;
  if (e.error) return h`${head}<p class="err">${t('fam.loadErr')}</p>`;
  const d = e.data, s = summarize(d);
  const body = ui.tab === 'study' ? studyTab(d) : ui.tab === 'tasks' ? tasksTab(d, s) : ui.tab === 'grades' ? gradesTab(d, s) : ui.tab === 'goals' ? goalsTab(d) : summaryTab(d, s);
  return h`${head}${body}<p class="muted small">${t('fam.readOnly')} ${t('fam.notShared')}</p>`;
}

export const family = {
  id: 'family', titleKey: 'nav.family',
  view(arg) {
    if (arg) return childView(arg);
    const kids = children();
    return h`<div class="page-head"><div><h1>${t('nav.family')}</h1><p class="muted">${t('fam.sub')}</p></div>
        <button class="btn ghost" data-act="family.reload">${icon('refresh')} ${t('fam.refresh')}</button></div>
      <p class="muted small">${t('fam.readOnly')} ${t('fam.notShared')}</p>
      ${kids.length ? kids.map(childCard) : h`<section class="card"><p class="muted">${t('fam.noChildren')}</p><a class="btn" href="#/addchild">${t('nav.addchild')}</a></section>`}`;
  },
  mount(arg) {
    if (arg) load(arg); else children().forEach((k) => load(k.sub));
  },
};

export const addchild = {
  id: 'addchild', titleKey: 'nav.addchild',
  view() {
    const kids = children();
    return h`<div class="page-head"><div><h1>${t('add.title')}</h1><p class="muted">${t('add.sub')}</p></div></div>
      <section class="card">
        <div class="form">
          <input id="acName" type="text" maxlength="40" placeholder="${t('add.name')}" value="${ui.name}" data-input="family.field" data-field="name" data-enter="family.add" aria-label="${t('add.name')}">
          <input id="acEmail" type="email" maxlength="120" placeholder="${t('add.email')}" value="${ui.email}" data-input="family.field" data-field="email" data-enter="family.add" aria-label="${t('add.email')}">
          <button class="btn" data-act="family.add"${ui.busy ? h` disabled` : ''}>${ui.busy ? t('add.sending') : t('add.send')}</button>
        </div>
        ${ui.msg ? h`<p class="good">${ui.msg}</p>` : ''}${ui.error ? h`<p class="err">${ui.error}</p>` : ''}
        <p class="muted small">${t('add.note')}</p>
      </section>
      <section class="card"><h2>${t('fam.yourChildren')}</h2>${kids.length ? kids.map((k) => h`<div class="row-line"><span><strong>${k.name}</strong> <span class="muted small">${k.email}</span></span><a href="#/family/${k.sub}">${t('fam.open')}</a></div>`) : h`<p class="muted">${t('fam.noChildren')}</p>`}</section>`;
  },
};

// Shown instead of the app when an account has no role yet.
export const noprofile = {
  id: 'noprofile', titleKey: 'nopro.title',
  view() {
    return h`<section class="card"><h1>${t('nopro.title')}</h1><p>${t('nopro.text')}</p></section>`;
  },
};

register('family', {
  tab(el) { ui.tab = el.dataset.tab; refresh(); },
  retry(el) { load(el.dataset.sub, true); refresh(); },
  async reload() {
    try { await reloadMe(); } catch (e) { /* keep the list we have */ }
    children().forEach((k) => load(k.sub, true));
    refresh();
  },
  field(el) { ui[el.dataset.field] = el.value; },
  async add() {
    if (ui.busy) return;
    const name = ui.name.trim(), email = ui.email.trim();
    ui.msg = ''; ui.error = '';
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { ui.error = t('add.err400'); refresh(); return; }
    ui.busy = true; refresh();
    try {
      await api('POST', '/api/parent/children', { name, email });
      ui.msg = t('add.ok', { email: email.toLowerCase() });
      ui.name = ''; ui.email = '';
      await reloadMe();
    } catch (e) {
      ui.error = e && e.status === 409 ? t('add.err409') : e && e.status === 422 ? t('add.err422', { n: MAX_CHILDREN }) : e && e.status === 400 ? t('add.err400') : t('add.err');
    }
    ui.busy = false; refresh();
  },
});
