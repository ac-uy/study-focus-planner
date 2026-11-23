import { state } from '../store.js';
import { h } from '../util.js';
import { todayKey, dayDiff, addDays, fmtMin } from '../util.js';
import { t, subjectName, fmtDate, fmtDateLong, daysLeftText, getLang } from '../i18n.js';
import { weekChallenges, weekMinutesSeries, minutesBetween, minutesBySubject, streakInfo, weekStart } from '../calc.js';
import { bar, lineChart, donut, hBars } from '../ui.js';
import { net } from '../api.js';
import { register, refresh } from '../actions.js';
import { QUOTES, firstQuoteIndex, randomIndex, rememberQuote } from '../quotes.js';
import { icon } from '../icons.js';
import { attentionList } from '../calc.js';
import { num } from './results.js';

// A new quote on every page load; the button picks another one.
let quoteIdx = firstQuoteIndex();

function firstName() {
  if (state.profile.name) return state.profile.name;
  const m = /^[a-záéíóúñ]{3,}/i.exec((net.email || '').split('@')[0]);
  return m ? m[0].charAt(0).toUpperCase() + m[0].slice(1).toLowerCase() : '';
}

function stat(emoji, label, value, sub) {
  return h`<div class="card stat"><div class="stat-h"><span>${label}</span><span>${emoji}</span></div><div class="stat-v">${value}</div><div class="muted small">${sub}</div></div>`;
}

export const home = {
  id: 'home', icon: '🏠', titleKey: 'nav.home',
  view() {
    const today = todayKey();
    const quote = QUOTES[getLang()][quoteIdx];
    const attn = attentionList(state.results, state.sessions, state.exams, today).slice(0, 3);
    const exams = state.exams.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const pending = state.tasks.filter((x) => !x.done);
    const overdue = pending.filter((x) => x.due && x.due < today);
    const wk = weekStart();
    const weekMin = minutesBetween(state.sessions, wk, addDays(wk, 6));
    const in30 = exams.filter((e) => dayDiff(today, e.date) <= 30).length;
    const activeWeek = state.examWeeks.filter((w) => w.start <= today && today <= w.end).length;
    const st = streakInfo(state.sessions);
    const series = weekMinutesSeries(state.sessions, 10);
    const monthFrom = today.slice(0, 8) + '01';
    const bySubj = Object.entries(minutesBySubject(state.sessions, monthFrom, today)).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const imp = ['alta', 'media', 'baja'].map((k) => ({ label: t('imp.' + k), value: pending.filter((x) => x.importance === k).length })).filter((x) => x.value);
    const todo = pending.slice().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 5);
    const wd = (new Date().getDay() + 6) % 7;
    const classes = wd < 5 ? [0, 1, 2, 3, 4, 5, 6].map((p) => ({ p, name: state.timetable[wd + '-' + p] })).filter((c) => c.name) : [];
    const name = firstName();

    return h`
    <div class="page-head"><div><h1>${name ? t('hello', { name }) : t('helloAnon')}</h1><p class="muted">${fmtDateLong(today)}. ${t('homeSub')}</p></div>
      <a class="btn" href="#/timer">▶ ${t('startStudying')}</a></div>
    <div class="card quote"><span>💬 <em id="quoteText">${quote}</em></span>
      <button class="btn ghost small" data-act="home.newQuote" title="${t('newQuote')}" aria-label="${t('newQuote')}">${icon('refresh')} ${t('newQuote')}</button></div>
    ${noticeCard()}
    <div class="grid2">
      <section class="card"><h2>${t('examCountdown')}</h2><p class="muted small">${t('examCountdownSub')}</p>
        ${exams.length ? exams.slice(0, 5).map((e) => h`<div class="row-line"><span><strong>${subjectName(e.subject)}</strong>${e.title ? h`<br><span class="muted small">${e.title}</span>` : ''}</span><span class="${dayDiff(today, e.date) <= 2 ? 'hot' : ''}">${daysLeftText(dayDiff(today, e.date))}</span></div>`) : h`<p class="muted">${t('noExams')}</p>`}
      </section>
      <section class="card"><h2>${t('weeklyChallenges')}</h2><p class="muted small">${t('resetsMonday')}</p>
        ${weekChallenges(state.sessions).map((c) => h`<div class="chal"><div class="row-line"><span>${t('chal.' + c.id, { n: c.target })}</span><span class="muted small">${c.value}/${c.target}${c.unit === 'min' ? ' min' : ''}</span></div>${bar((c.value / c.target) * 100)}</div>`)}
      </section>
    </div>
    <div class="stats5">
      ${stat('📋', t('pendingTasks'), pending.length, t('notDoneYet'))}
      ${stat('⚠️', t('overdueTasks'), overdue.length, t('overdueSub'))}
      ${stat('⏱️', t('minutesWeek'), weekMin, t('sinceMonday'))}
      ${stat('📅', t('examsNext30'), in30, t('fromToday'))}
      ${stat('🗓️', t('examWeekNow'), activeWeek, activeWeek ? t('inProgress') : t('notInExamWeek'))}
    </div>
    <section class="card"><div class="row-line"><h2>⚠ ${t('needsAttention')}</h2><a href="#/results" class="small">${t('seeResults')}</a></div>
      ${!state.results.length ? h`<p class="muted">${t('attnCardNone')}</p>` : attn.length ? attn.map((a) => h`<div class="row-line"><span><strong>${subjectName(a.subject)}</strong><br><span class="muted small">${t('why.' + a.reasons[0], { n: 0, min: a.minutes })}</span></span><span class="${a.avg < 5 ? 'hot' : ''}">${t('avgShort')} ${num(a.avg)}</span></div>`) : h`<p class="good">✓ ${t('attnCardOk')}</p>`}
    </section>
    <div class="grid2">
      <section class="card"><h2>${t('minutesPerWeek')}</h2><p class="muted small">${t('last10Weeks')}</p>${lineChart(series.map((s) => s.minutes))}</section>
      <section class="card"><h2>${t('tasksByImportance')}</h2>${imp.length ? donut(imp) : h`<p class="muted">${t('noPending')}</p>`}</section>
    </div>
    <section class="card"><h2>${t('minutesBySubject')}</h2><p class="muted small">${t('thisMonth')}</p>
      ${bySubj.length ? hBars(bySubj.map(([s, m]) => ({ label: subjectName(s), value: m, text: fmtMin(m) }))) : h`<p class="muted">${t('noData')}</p>`}</section>
    <div class="grid2">
      <section class="card"><div class="row-line"><h2>${t('upcomingExams')}</h2><a href="#/calendar" class="small">${t('seeAll')}</a></div>
        ${exams.length ? exams.slice(0, 5).map((e) => h`<div class="row-line"><span>${subjectName(e.subject)}</span><span class="muted small">${fmtDate(e.date)}</span></div>`) : h`<p class="muted">${t('noExams')}</p>`}</section>
      <section class="card"><div class="row-line"><h2>${t('todoTasks')}</h2><a href="#/tasks" class="small">${t('seeAll')}</a></div>
        ${todo.length ? todo.map((x) => h`<div class="row-line"><a href="#/tasks/${x.id}">${x.title}</a><span class="muted small${x.due && x.due < today ? ' hot' : ''}">${x.due ? fmtDate(x.due) : ''}</span></div>`) : h`<p class="muted">${t('noPending')}</p>`}</section>
    </div>
    <div class="grid2">
      <section class="card"><h2>${t('streak')}</h2><div class="big">🔥 ${t('nDays', { n: st.current })}</div>
        <p class="muted small">${st.todayDone ? t('streakTodayDone') : t('streakTodayNot')} ${t('bestStreak', { n: st.best })}</p></section>
      <section class="card"><div class="row-line"><h2>${t('todayClasses')}</h2><a href="#/timetable" class="small">${t('timetable')}</a></div>
        ${wd >= 5 ? h`<p class="muted">${t('weekend')}</p>` : classes.length ? classes.map((c) => h`<div class="row-line"><span class="muted small">${t('period', { n: c.p + 1 })}</span><span>${c.name}</span></div>`) : h`<p class="muted">${t('noClasses')}</p>`}</section>
    </div>`;
  },
};

// A student is told, once per set of parents, who can see her progress and what they see.
const NOTICE_KEY = 'sp2-notice';
const parentsList = () => (net.role === 'child' && net.me && net.me.parents) || [];
const parentsKey = () => parentsList().map((p) => p.email).sort().join(',');
function noticeSeen() { try { return localStorage.getItem(NOTICE_KEY) === parentsKey(); } catch (e) { return false; } }
function noticeCard() {
  const ps = parentsList();
  if (!ps.length || noticeSeen()) return h``;
  return h`<section class="card notice"><h2>${icon('family')} ${t('seeTitle')}</h2>
    <p>${t('seeWho', { names: ps.map((p) => p.name || p.email).join(', ') })}</p>
    <p class="small">${t('seeSee')}</p><p class="small">${t('seeNot')}</p>
    <button class="btn" data-act="home.dismissNotice">${t('seeGotIt')}</button></section>`;
}

register('home', {
  dismissNotice() { try { localStorage.setItem(NOTICE_KEY, parentsKey()); } catch (e) { /* ignore */ } refresh(); },
  newQuote() { quoteIdx = randomIndex(quoteIdx); rememberQuote(quoteIdx); refresh(); },
});
