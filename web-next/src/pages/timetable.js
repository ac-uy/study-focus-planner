import { state, save } from '../store.js';
import { h } from '../util.js';
import { t, weekdayLong } from '../i18n.js';
import { register } from '../actions.js';

const PERIODS = [0, 1, 2, 3, 4, 5, 6];
// A break row is shown after these periods (index) as in a typical Spanish school day.
const BREAKS = { 1: 'patio', 3: 'patio', 4: 'lunch' };

export const timetable = {
  id: 'timetable', icon: '🏫', titleKey: 'nav.timetable',
  view() {
    return h`<div class="page-head"><h1>${t('nav.timetable')}</h1></div>
    <section class="card"><div class="tablewrap"><table class="tt">
      <thead><tr><th>${t('hour')}</th>${[0, 1, 2, 3, 4].map((d) => h`<th>${weekdayLong(d)}</th>`)}</tr></thead>
      <tbody>${PERIODS.map((p) => h`<tr><th>${t('period', { n: p + 1 })}</th>${[0, 1, 2, 3, 4].map((d) => h`<td><input type="text" maxlength="40" placeholder="${t('add')}" value="${state.timetable[d + '-' + p] || ''}" data-change="timetable.set" data-key="${d + '-' + p}" aria-label="${weekdayLong(d)} ${t('period', { n: p + 1 })}"></td>`)}</tr>
        ${BREAKS[p] ? h`<tr class="brk"><td colspan="6">${t('break.' + BREAKS[p])}</td></tr>` : ''}`)}</tbody>
    </table></div></section>`;
  },
};

register('timetable', {
  set(el) {
    const v = el.value.trim().slice(0, 40);
    if (v) state.timetable[el.dataset.key] = v; else delete state.timetable[el.dataset.key];
    save('timetable');
  },
});
