import { state, save } from '../store.js';
import { h, byId, uid, todayKey, clamp, fmtMin, isDateKey } from '../util.js';
import { t, subjectName, fmtDate } from '../i18n.js';
import { register, refresh } from '../actions.js';
import { subjectSelect } from '../ui.js';
import { taskDetailView } from './taskdetail.js';

const ui = { imp: 'all', overdue: false, showDone: false, q: '' };

export const tasks = {
  id: 'tasks', icon: '✅', titleKey: 'nav.tasks',
  view(arg) {
    if (arg) return taskDetailView(arg);
    const today = todayKey();
    let list = state.tasks.slice();
    if (!ui.showDone) list = list.filter((x) => !x.done);
    if (ui.imp !== 'all') list = list.filter((x) => x.importance === ui.imp);
    if (ui.overdue) list = list.filter((x) => !x.done && x.due && x.due < today);
    if (ui.q) { const q = ui.q.toLowerCase(); list = list.filter((x) => x.title.toLowerCase().includes(q) || subjectName(x.subject).toLowerCase().includes(q)); }
    list.sort((a, b) => (a.done - b.done) || (a.due || '9999').localeCompare(b.due || '9999'));
    return h`
    <div class="page-head"><h1>${t('nav.tasks')}</h1></div>
    <section class="card"><h2>${t('newTask')}</h2>
      <div class="form">
        <input id="tkTitle" type="text" maxlength="200" placeholder="${t('taskTitle')}" data-enter="tasks.add">
        ${subjectSelect('tkSubject', state.settings.subjects[0])}
        <input id="tkMin" type="number" min="5" max="600" step="5" value="30" title="${t('minutes')}" aria-label="${t('minutes')}">
        <select id="tkImp" aria-label="${t('importance')}"><option value="alta">${t('imp.alta')}</option><option value="media" selected>${t('imp.media')}</option><option value="baja">${t('imp.baja')}</option></select>
        <input id="tkDue" type="date" value="${today}" aria-label="${t('dueDate')}">
        <button class="btn" data-act="tasks.add">+ ${t('add')}</button>
      </div></section>
    <section class="card">
      <div class="form">
        <input id="tkQ" type="search" placeholder="${t('searchTasks')}" value="${ui.q}" data-input="tasks.search">
        <select id="tkFilter" data-change="tasks.imp" aria-label="${t('importance')}"><option value="all">${t('impAll')}</option>
          ${['alta', 'media', 'baja'].map((k) => h`<option value="${k}"${ui.imp === k ? h` selected` : ''}>${t('imp.' + k)}</option>`)}</select>
        <button class="btn ${ui.overdue ? '' : 'ghost'}" data-act="tasks.overdue">${t('overdueBtn')}</button>
        <button class="btn ${ui.showDone ? '' : 'ghost'}" data-act="tasks.showDone">${t('showDone')}</button>
      </div>
      <div class="tablewrap"><table>
        <thead><tr><th></th><th>${t('title')}</th><th>${t('subject')}</th><th>${t('time')}</th><th>${t('importance')}</th><th>${t('dueDate')}</th><th></th></tr></thead>
        <tbody>${list.length ? list.map((x) => h`<tr class="${x.done ? 'done' : ''}">
          <td><input type="checkbox" data-change="tasks.toggle" data-id="${x.id}"${x.done ? h` checked` : ''} aria-label="${t('done')}"></td>
          <td><a href="#/tasks/${x.id}">${x.title}</a></td><td>${subjectName(x.subject)}</td><td>${fmtMin(x.minutes)}</td>
          <td><span class="badge imp-${x.importance}">${t('imp.' + x.importance)}</span></td>
          <td class="${!x.done && x.due && x.due < today ? 'hot' : ''}">${x.due ? fmtDate(x.due) : '—'}</td>
          <td><button class="link" data-act="tasks.del" data-id="${x.id}">${t('delete')}</button></td></tr>`) : h`<tr><td colspan="7" class="muted">${t('noTasks')}</td></tr>`}</tbody>
      </table></div>
    </section>`;
  },
};

register('tasks', {
  add() {
    const title = byId('tkTitle').value.trim();
    if (!title) return;
    const due = byId('tkDue').value;
    state.tasks.push({
      id: uid(), title: title.slice(0, 200), subject: byId('tkSubject').value, minutes: clamp(byId('tkMin').value, 5, 600),
      importance: byId('tkImp').value, due: isDateKey(due) ? due : '', done: false, notes: '', goalId: '',
    });
    save('tasks'); refresh();
  },
  toggle(el) { const x = state.tasks.find((y) => y.id === el.dataset.id); if (x) { x.done = el.checked; save('tasks'); refresh(); } },
  del(el) { state.tasks = state.tasks.filter((x) => x.id !== el.dataset.id); save('tasks'); refresh(); },
  search(el) { ui.q = el.value; refresh(); },
  imp(el) { ui.imp = el.value; refresh(); },
  overdue() { ui.overdue = !ui.overdue; refresh(); },
  showDone() { ui.showDone = !ui.showDone; refresh(); },
});
