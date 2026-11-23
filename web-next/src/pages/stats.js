import { state } from '../store.js';
import { h, todayKey, fmtMin } from '../util.js';
import { t, subjectName, fmtDate } from '../i18n.js';
import { minutesBetween, minutesBySubject, minutesByMode, dayMinutesSeries, weekMinutesSeries, minutesByDate } from '../calc.js';
import { barChart, donut, hBars, lineChart } from '../ui.js';

function stat(label, value, sub) {
  return h`<div class="card stat"><div class="stat-h"><span>${label}</span></div><div class="stat-v">${value}</div><div class="muted small">${sub}</div></div>`;
}

export const stats = {
  id: 'stats', icon: '📊', titleKey: 'nav.stats',
  view() {
    const today = todayKey(), ss = state.sessions;
    const total = ss.reduce((a, s) => a + s.minutes, 0);
    const monthFrom = today.slice(0, 8) + '01';
    const month = minutesBetween(ss, monthFrom, today);
    const by = minutesByDate(ss), activeDays = Object.keys(by).length;
    const avg = activeDays ? Math.round(total / activeDays) : 0;
    const days = dayMinutesSeries(ss, 14);
    const weeks = weekMinutesSeries(ss, 8);
    const subj = Object.entries(minutesBySubject(ss, '0000-01-01', today)).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const modes = Object.entries(minutesByMode(ss)).map(([k, v]) => ({ label: t('mode.' + k), value: v, text: fmtMin(v) }));
    return h`<div class="page-head"><div><h1>${t('nav.stats')}</h1><p class="muted">${t('statsSub')}</p></div></div>
    <div class="stats4">${stat(t('totalStudied'), fmtMin(total), t('sinceStart'))}${stat(t('thisMonthLabel'), fmtMin(month), t('sinceDay1'))}${stat(t('daysStudied'), activeDays, t('daysWithSession'))}${stat(t('avgPerDay'), fmtMin(avg), t('onStudyDays'))}</div>
    <div class="grid2">
      <section class="card"><h2>${t('minutesPerDay')}</h2><p class="muted small">${t('last14Days')}</p>${barChart(days.map((d) => ({ label: fmtDate(d.date, { day: 'numeric' }), value: d.minutes })))}</section>
      <section class="card"><h2>${t('minutesPerWeek')}</h2><p class="muted small">${t('last8Weeks')}</p>${lineChart(weeks.map((w) => w.minutes))}
        <p class="muted small">${weeks.map((w) => w.minutes).join(' · ')}</p></section>
    </div>
    <div class="grid2">
      <section class="card"><h2>${t('bySubject')}</h2>${subj.length ? hBars(subj.map(([s, m]) => ({ label: subjectName(s), value: m, text: fmtMin(m) }))) : h`<p class="muted">${t('noData')}</p>`}</section>
      <section class="card"><h2>${t('howYouStudy')}</h2>${modes.length ? donut(modes) : h`<p class="muted">${t('noData')}</p>`}</section>
    </div>`;
  },
};
