// Goals and achievements: weekly study-time goals, main objectives with steps, and unlocked medals.
import { state, save, levelLabel } from '../store.js';
import { h, byId, uid, todayKey, dayDiff, clamp, fmtMin, isDateKey } from '../util.js';
import { t, subjectName, fmtDate, daysLeftText, getLang } from '../i18n.js';
import { register, refresh } from '../actions.js';
import { api, aiEnabled } from '../api.js';
import { bar, subjectSelect } from '../ui.js';
import { goalProgress, achievements } from '../calc.js';

const ui = { tab: 'goals', busy: '', error: '' };

function goalsTab() {
  return h`<section class="card"><h2>${t('newStudyGoal')}</h2>
    <div class="form">
      ${subjectSelect('wgSubject', '', { any: t('anySubject') })}
      <input id="wgMin" type="number" min="5" max="6000" step="5" value="120" aria-label="${t('minutes')}">
      <select id="wgPeriod"><option value="day">${t('period.day')}</option><option value="week" selected>${t('period.week')}</option><option value="month">${t('period.month')}</option></select>
      <button class="btn" data-act="goals.addWeekly">+ ${t('add')}</button></div></section>
    <section class="card">
      ${state.weeklyGoals.length ? state.weeklyGoals.map((g) => {
        const done = goalProgress(g, state.sessions);
        return h`<div class="goalrow"><div class="row-line"><span><strong>${g.subject ? subjectName(g.subject) : t('anySubject')}</strong> <span class="muted small">${t('period.' + g.period)}</span></span>
          <span>${fmtMin(done)} / ${fmtMin(g.minutes)} <button class="link" data-act="goals.delWeekly" data-id="${g.id}">${t('delete')}</button></span></div>${bar((done / g.minutes) * 100)}
          ${done >= g.minutes ? h`<span class="badge">🎉 ${t('goalReached')}</span>` : ''}</div>`;
      }) : h`<p class="muted">${t('noStudyGoals')}</p>`}</section>`;
}

function objectivesTab() {
  const today = todayKey();
  return h`<section class="card"><h2>${t('newObjective')}</h2>
    <div class="form"><input id="obTitle" class="grow" type="text" maxlength="200" placeholder="${t('objectiveTitle')}" data-enter="goals.addObjective">
      <input id="obDue" type="date" aria-label="${t('dueDate')}"><button class="btn" data-act="goals.addObjective">+ ${t('add')}</button></div></section>
    ${ui.error ? h`<div class="err">${ui.error}</div>` : ''}
    ${state.goals.length ? state.goals.map((g) => {
      const linked = state.tasks.filter((x) => x.goalId === g.id);
      const total = g.steps.length + linked.length;
      const done = g.steps.filter((s) => s.done).length + linked.filter((x) => x.done).length;
      return h`<section class="card"><div class="row-line"><div><h2>${g.title}</h2>
        <p class="muted small">${g.due ? fmtDate(g.due) + ' · ' + daysLeftText(dayDiff(today, g.due)) + ' · ' : ''}${t('stepsDone', { done, total })}</p></div>
        <button class="link" data-act="goals.delObjective" data-id="${g.id}">${t('deleteGoal')}</button></div>
        ${bar(total ? (done / total) * 100 : 0)}
        ${g.steps.map((s) => h`<div class="row-line${s.done ? ' done' : ''}"><label class="check"><input type="checkbox" data-change="goals.step" data-gid="${g.id}" data-id="${s.id}"${s.done ? h` checked` : ''}><span>${s.title}</span></label>
          <button class="link" data-act="goals.delStep" data-gid="${g.id}" data-id="${s.id}">${t('remove')}</button></div>`)}
        ${linked.length ? h`<h3>${t('linkedTasks')}</h3>${linked.map((x) => h`<div class="row-line${x.done ? ' done' : ''}"><a href="#/tasks/${x.id}">${x.title}</a><span class="muted small">${x.due ? fmtDate(x.due) : ''}</span></div>`)}` : ''}
        <div class="form"><input id="stepIn-${g.id}" class="grow" type="text" maxlength="200" placeholder="${t('newStep')}" data-enter="goals.addStep" data-id="${g.id}">
          <button class="btn ghost" data-act="goals.addStep" data-id="${g.id}">${t('addStep')}</button>
          ${aiEnabled() ? h`<button class="btn ghost" data-act="goals.suggest" data-id="${g.id}"${ui.busy === g.id ? h` disabled` : ''}>✨ ${ui.busy === g.id ? t('thinking') : t('suggestSteps')}</button>` : ''}</div></section>`;
    }) : h`<p class="muted">${t('noObjectives')}</p>`}`;
}

function achievementsTab() {
  const list = achievements(state);
  return h`<section class="card"><p class="muted">${t('medalsCount', { n: list.filter((a) => a.ok).length, total: list.length })}</p>
    <div class="medals">${list.map((a) => h`<div class="medal${a.ok ? ' on' : ''}"><div class="mi">${a.ok ? a.icon : '🔒'}</div><strong>${t('ach.' + a.id)}</strong><span class="muted small">${t('ach.' + a.id + '.d')}</span></div>`)}</div></section>`;
}

export const goals = {
  id: 'goals', icon: '🏆', titleKey: 'nav.goals',
  view() {
    return h`<div class="page-head"><div><h1>${t('nav.goals')}</h1><p class="muted">${t('goalsSub')}</p></div></div>
    <div class="tabs">${['goals', 'objectives', 'achievements'].map((k) => h`<button class="tab${ui.tab === k ? ' on' : ''}" data-act="goals.tab" data-tab="${k}">${t('tab.' + k)}</button>`)}</div>
    ${ui.tab === 'goals' ? goalsTab() : ui.tab === 'objectives' ? objectivesTab() : achievementsTab()}`;
  },
};

const objective = (id) => state.goals.find((g) => g.id === id);

register('goals', {
  tab(el) { ui.tab = el.dataset.tab; ui.error = ''; refresh(); },
  addWeekly() {
    state.weeklyGoals.push({ id: uid(), subject: byId('wgSubject').value, minutes: clamp(byId('wgMin').value, 5, 6000), period: byId('wgPeriod').value });
    save('weeklyGoals'); refresh();
  },
  delWeekly(el) { state.weeklyGoals = state.weeklyGoals.filter((g) => g.id !== el.dataset.id); save('weeklyGoals'); refresh(); },
  addObjective() {
    const title = byId('obTitle').value.trim();
    if (!title) return;
    const due = byId('obDue').value;
    state.goals.push({ id: uid(), title: title.slice(0, 200), due: isDateKey(due) ? due : '', steps: [] });
    save('goals'); refresh();
  },
  delObjective(el) {
    state.goals = state.goals.filter((g) => g.id !== el.dataset.id);
    state.tasks.forEach((x) => { if (x.goalId === el.dataset.id) x.goalId = ''; });
    save('goals', 'tasks'); refresh();
  },
  step(el) { const g = objective(el.dataset.gid); const s = g && g.steps.find((x) => x.id === el.dataset.id); if (s) { s.done = el.checked; save('goals'); refresh(); } },
  delStep(el) { const g = objective(el.dataset.gid); if (g) { g.steps = g.steps.filter((x) => x.id !== el.dataset.id); save('goals'); refresh(); } },
  addStep(el) {
    const g = objective(el.dataset.id), input = byId('stepIn-' + el.dataset.id);
    const title = input ? input.value.trim() : '';
    if (!g || !title || g.steps.length >= 40) return;
    g.steps.push({ id: uid(), title: title.slice(0, 200), done: false });
    save('goals'); refresh();
  },
  async suggest(el) {
    const g = objective(el.dataset.id);
    if (!g || ui.busy) return;
    ui.busy = g.id; ui.error = ''; refresh();
    try {
      const res = await api('POST', '/api/ai/steps', { goal: g.title, due: g.due, lang: getLang(), existing: g.steps.map((s) => s.title) });
      const have = g.steps.map((s) => s.title.toLowerCase());
      (res.steps || []).forEach((title) => {
        if (g.steps.length < 40 && !have.includes(String(title).toLowerCase())) g.steps.push({ id: uid(), title: String(title).slice(0, 200), done: false });
      });
      save('goals');
    } catch (e) { ui.error = e && e.status === 429 ? t('errLimit') : t('stepsErr'); }
    ui.busy = ''; refresh();
  },
});
