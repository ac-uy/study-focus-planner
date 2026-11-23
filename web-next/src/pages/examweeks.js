import { state, save } from '../store.js';
import { h, byId, uid, todayKey, dayDiff, isDateKey, addDays } from '../util.js';
import { t, fmtDate } from '../i18n.js';
import { register, refresh } from '../actions.js';

export const examweeks = {
  id: 'examweeks', icon: '🗓️', titleKey: 'nav.examweeks',
  view() {
    const today = todayKey();
    const weeks = state.examWeeks.slice().sort((a, b) => a.start.localeCompare(b.start));
    return h`
    <div class="page-head"><h1>${t('nav.examweeks')}</h1></div>
    <section class="card"><h2>${t('newExamWeek')}</h2>
      <div class="form">
        <input id="ewName" type="text" maxlength="60" placeholder="${t('examWeekName')}" data-enter="examweeks.add">
        <label class="inline">${t('from')} <input id="ewStart" type="date" value="${today}"></label>
        <label class="inline">${t('to')} <input id="ewEnd" type="date" value="${addDays(today, 4)}"></label>
        <button class="btn" data-act="examweeks.add">${t('add')}</button>
      </div></section>
    <section class="card"><div class="tablewrap"><table>
      <thead><tr><th>${t('name')}</th><th>${t('startDate')}</th><th>${t('endDate')}</th><th>${t('duration')}</th><th></th></tr></thead>
      <tbody>${weeks.length ? weeks.map((w) => h`<tr><td>${w.name}${w.start <= today && today <= w.end ? h` <span class="badge">${t('inProgress')}</span>` : ''}</td><td>${fmtDate(w.start)}</td><td>${fmtDate(w.end)}</td>
        <td>${t('nDaysLong', { n: dayDiff(w.start, w.end) + 1 })}</td><td><button class="link" data-act="examweeks.del" data-id="${w.id}">${t('delete')}</button></td></tr>`) : h`<tr><td colspan="5" class="muted">${t('noExamWeeks')}</td></tr>`}</tbody>
    </table></div></section>`;
  },
};

register('examweeks', {
  add() {
    const start = byId('ewStart').value, end = byId('ewEnd').value;
    if (!isDateKey(start) || !isDateKey(end)) return;
    state.examWeeks.push({ id: uid(), name: byId('ewName').value.trim().slice(0, 60) || t('examWeekDefault'), start, end: end < start ? start : end });
    save('examWeeks'); refresh();
  },
  del(el) { state.examWeeks = state.examWeeks.filter((w) => w.id !== el.dataset.id); save('examWeeks'); refresh(); },
});
