import { state, save } from '../store.js';
import { h, byId, uid, todayKey, dateKey, isDateKey } from '../util.js';
import { t, subjectName, fmtDate, monthYear, weekdayShort } from '../i18n.js';
import { register, refresh } from '../actions.js';
import { subjectSelect } from '../ui.js';

const now = new Date();
const ui = { y: now.getFullYear(), m: now.getMonth(), q: '', date: '' };

function matches(e) {
  if (!ui.q) return true;
  const q = ui.q.toLowerCase();
  return subjectName(e.subject).toLowerCase().includes(q) || (e.title || '').toLowerCase().includes(q);
}

export const calendar = {
  id: 'calendar', icon: '📅', titleKey: 'nav.calendar',
  view() {
    const today = todayKey();
    const first = new Date(ui.y, ui.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(ui.y, ui.m, 1 - offset + i), key = dateKey(d);
      cells.push({
        key, day: d.getDate(), inMonth: d.getMonth() === ui.m, today: key === today,
        week: state.examWeeks.some((w) => w.start <= key && key <= w.end),
        exams: state.exams.filter((e) => e.date === key && matches(e)),
      });
    }
    const formDate = ui.date || today;
    const upcoming = state.exams.filter(matches).sort((a, b) => a.date.localeCompare(b.date));
    return h`
    <div class="page-head"><h1>${t('nav.calendar')}</h1>
      <input id="calQ" type="search" placeholder="${t('searchExams')}" value="${ui.q}" data-input="calendar.search"></div>
    <section class="card">
      <h2>${t('addExam')}</h2>
      <div class="form">
        ${subjectSelect('exSubject', state.settings.subjects[0])}
        <input id="exTitle" type="text" maxlength="120" placeholder="${t('examTopic')}" data-enter="calendar.add">
        <input id="exDate" type="date" value="${formDate}">
        <button class="btn" data-act="calendar.add">${t('add')}</button>
      </div>
    </section>
    <section class="card">
      <div class="cal-head"><button class="btn ghost" data-act="calendar.prev" aria-label="${t('prev')}">‹</button>
        <h2>${monthYear(ui.y, ui.m)}</h2>
        <button class="btn ghost" data-act="calendar.next" aria-label="${t('next')}">›</button>
        <button class="btn ghost" data-act="calendar.today">${t('todayBtn')}</button></div>
      <div class="cal">
        ${[0, 1, 2, 3, 4, 5, 6].map((i) => h`<div class="cal-wd">${weekdayShort(i)}</div>`)}
        ${cells.map((c) => h`<div class="cal-day${c.inMonth ? '' : ' out'}${c.today ? ' today' : ''}${c.week ? ' examweek' : ''}" data-act="calendar.pick" data-date="${c.key}" role="button" tabindex="0">
          <span class="dn">${c.day}</span>${c.exams.map((e) => h`<span class="chip-exam" title="${e.title}">${subjectName(e.subject)}</span>`)}</div>`)}
      </div>
      <p class="muted small">${t('examWeekLegend')}</p>
    </section>
    <section class="card"><h2>${t('upcomingExams')}</h2>
      ${upcoming.length ? upcoming.map((e) => h`<div class="row-line"><span><strong>${subjectName(e.subject)}</strong> ${e.title ? '· ' + e.title : ''}</span>
        <span><span class="muted small">${fmtDate(e.date)}</span> <button class="link" data-act="calendar.del" data-id="${e.id}">${t('delete')}</button></span></div>`) : h`<p class="muted">${t('noExams')}</p>`}
    </section>`;
  },
};

register('calendar', {
  prev() { ui.m--; if (ui.m < 0) { ui.m = 11; ui.y--; } refresh(); },
  next() { ui.m++; if (ui.m > 11) { ui.m = 0; ui.y++; } refresh(); },
  today() { const d = new Date(); ui.y = d.getFullYear(); ui.m = d.getMonth(); ui.date = ''; refresh(); },
  pick(el) { ui.date = el.dataset.date; refresh(); const e = byId('exTitle'); if (e) e.focus(); },
  search(el) { ui.q = el.value; refresh(); },
  add() {
    const date = byId('exDate').value;
    if (!isDateKey(date)) return;
    state.exams.push({ id: uid(), subject: byId('exSubject').value, date, title: byId('exTitle').value.trim().slice(0, 120) });
    ui.date = '';
    save('exams'); refresh();
  },
  del(el) { state.exams = state.exams.filter((e) => e.id !== el.dataset.id); save('exams'); refresh(); },
});
