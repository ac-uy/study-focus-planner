import { state, save, LIMITS } from '../store.js';
import { h, byId, uid, todayKey, clamp, isDateKey } from '../util.js';
import { t, subjectName, fmtDate } from '../i18n.js';
import { register, refresh } from '../actions.js';
import { subjectSelect } from '../ui.js';

const ui = { mode: 'all', q: '' };

export const history = {
  id: 'history', icon: '🗂️', titleKey: 'nav.history',
  view() {
    let list = state.sessions.slice().sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
    if (ui.mode !== 'all') list = list.filter((s) => s.mode === ui.mode);
    if (ui.q) { const q = ui.q.toLowerCase(); list = list.filter((s) => (s.title || '').toLowerCase().includes(q) || subjectName(s.subject).toLowerCase().includes(q)); }
    return h`<div class="page-head"><h1>${t('historyTitle')}</h1></div>
    <section class="card"><h2>${t('newSession')}</h2>
      <div class="form"><input id="hsTitle" type="text" maxlength="120" placeholder="${t('sessionTitleOptional')}">
        ${subjectSelect('hsSubject', '', { any: t('subjectOptional') })}
        <input id="hsDate" type="date" value="${todayKey()}"><input id="hsMin" type="number" min="1" max="1440" value="30" aria-label="${t('minutes')}">
        <button class="btn" data-act="history.add">+ ${t('add')}</button></div></section>
    <section class="card">
      <div class="form"><input id="hsQ" type="search" placeholder="${t('searchByTitle')}" value="${ui.q}" data-input="history.search">
        <select data-change="history.mode" aria-label="${t('modeLabel')}"><option value="all">${t('allModes')}</option>
          ${['timer', 'stopwatch', 'pomodoro', 'manual'].map((m) => h`<option value="${m}"${ui.mode === m ? h` selected` : ''}>${t('mode.' + m)}</option>`)}</select></div>
      <div class="tablewrap"><table><thead><tr><th>${t('title')}</th><th>${t('date')}</th><th>${t('minutes')}</th><th>${t('modeLabel')}</th><th>${t('subject')}</th><th></th></tr></thead>
        <tbody>${list.length ? list.slice(0, 200).map((s) => h`<tr><td>${s.title || t('session')}</td><td>${fmtDate(s.date)}</td><td>${s.minutes}</td>
          <td><span class="badge">${t('mode.' + s.mode)}</span></td><td>${subjectName(s.subject)}</td><td><button class="link" data-act="history.del" data-id="${s.id}">${t('delete')}</button></td></tr>`) : h`<tr><td colspan="6" class="muted">${t('noSessions')}</td></tr>`}</tbody></table></div>
    </section>`;
  },
};

register('history', {
  add() {
    const date = byId('hsDate').value;
    if (!isDateKey(date)) return;
    state.sessions.push({ id: uid(), date, minutes: clamp(byId('hsMin').value, 1, 1440), mode: 'manual', subject: byId('hsSubject').value, title: byId('hsTitle').value.trim().slice(0, 120), ts: Date.now() });
    if (state.sessions.length > LIMITS.sessions) state.sessions.splice(0, state.sessions.length - LIMITS.sessions);
    save('sessions'); refresh();
  },
  del(el) { state.sessions = state.sessions.filter((s) => s.id !== el.dataset.id); save('sessions'); refresh(); },
  search(el) { ui.q = el.value; refresh(); },
  mode(el) { ui.mode = el.value; refresh(); },
});
