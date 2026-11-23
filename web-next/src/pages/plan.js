import { state, save } from '../store.js';
import { h, byId, uid, todayKey, addDays, fmtMin, clamp } from '../util.js';
import { t, subjectName, fmtDateLong } from '../i18n.js';
import { register, refresh } from '../actions.js';
import { subjectSelect } from '../ui.js';

const ui = { date: '' };
const cur = () => ui.date || todayKey();

export const plan = {
  id: 'plan', icon: '🧭', titleKey: 'nav.plan',
  view() {
    const date = cur(), isToday = date === todayKey();
    const items = state.plan.filter((p) => p.date === date);
    const total = items.reduce((a, p) => a + p.minutes, 0);
    const pending = state.tasks.filter((x) => !x.done);
    return h`
    <div class="page-head"><h1>${t('nav.plan')}</h1></div>
    <section class="card">
      <div class="day-nav"><button class="btn ghost" data-act="plan.prev" aria-label="${t('prev')}">‹</button>
        <div><strong>${fmtDateLong(date)}</strong> ${isToday ? h`<span class="badge">${t('todayBtn')}</span>` : h`<button class="link" data-act="plan.today">${t('todayBtn')}</button>`}</div>
        <button class="btn ghost" data-act="plan.next" aria-label="${t('next')}">›</button></div>
      ${items.length ? items.map((p) => h`<div class="row-line${p.done ? ' done' : ''}"><label class="check"><input type="checkbox" data-change="plan.toggle" data-id="${p.id}"${p.done ? h` checked` : ''}>
        <span>${p.title}<br><span class="muted small">${subjectName(p.subject)} · ${fmtMin(p.minutes)}</span></span></label>
        <button class="link" data-act="plan.del" data-id="${p.id}">${t('delete')}</button></div>`) : h`<p class="muted">${t('nothingPlanned')}</p>`}
      ${items.length ? h`<p class="muted small">${t('plannedTotal', { time: fmtMin(total) })}</p>` : ''}
      <div class="form">
        <input id="plTitle" type="text" maxlength="200" placeholder="${t('planTitle')}" data-enter="plan.add">
        ${subjectSelect('plSubject', state.settings.subjects[0])}
        <input id="plMin" type="number" min="5" max="600" step="5" value="30" aria-label="${t('minutes')}">
        <button class="btn" data-act="plan.add">+ ${t('add')}</button>
      </div>
      ${pending.length ? h`<div class="form"><select id="plTask"><option value="">${t('fromTask')}</option>${pending.map((x) => h`<option value="${x.id}">${x.title}</option>`)}</select>
        <button class="btn ghost" data-act="plan.addTask">${t('add')}</button></div>` : ''}
    </section>`;
  },
};

register('plan', {
  prev() { ui.date = addDays(cur(), -1); refresh(); },
  next() { ui.date = addDays(cur(), 1); refresh(); },
  today() { ui.date = ''; refresh(); },
  add() {
    const title = byId('plTitle').value.trim();
    if (!title) return;
    state.plan.push({ id: uid(), date: cur(), title: title.slice(0, 200), subject: byId('plSubject').value, minutes: clamp(byId('plMin').value, 5, 600), done: false });
    save('plan'); refresh();
  },
  addTask() {
    const id = byId('plTask').value, task = state.tasks.find((x) => x.id === id);
    if (!task) return;
    state.plan.push({ id: uid(), date: cur(), title: task.title, subject: task.subject, minutes: task.minutes, done: false });
    save('plan'); refresh();
  },
  toggle(el) { const p = state.plan.find((x) => x.id === el.dataset.id); if (p) { p.done = el.checked; save('plan'); refresh(); } },
  del(el) { state.plan = state.plan.filter((x) => x.id !== el.dataset.id); save('plan'); refresh(); },
});
