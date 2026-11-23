// One task: edit it, photograph the work for an AI review, and make a mini exam.
import { state, save, levelLabel } from '../store.js';
import { h, byId, clamp, isDateKey } from '../util.js';
import { t, getLang, subjectName } from '../i18n.js';
import { register, refresh, go } from '../actions.js';
import { api, aiEnabled } from '../api.js';
import { subjectSelect } from '../ui.js';
import { fileToJpeg } from '../image.js';
import { examView, generateExam, resetExam, examBusy } from '../exam.js';
import { startWithContext } from './tutor.js';

const rv = { taskId: '', image: '', preview: '', busy: false, error: '', review: null };
let seq = 0;

function resetReview(id) {
  seq++;
  rv.taskId = id; rv.image = ''; rv.preview = ''; rv.busy = false; rv.error = ''; rv.review = null;
  resetExam();
}
const task = () => state.tasks.find((x) => x.id === rv.taskId);

function material() {
  const x = task();
  if (!x) return '';
  if (rv.review) {
    const r = rv.review;
    return [r.transcription || '', ...(r.corrections || []).map((c) => 'Correction: ' + c.fix), ...(r.additions || []).map((a) => 'Also important: ' + a)].join('\n').trim();
  }
  return x.notes || '';
}

function list(title, items) {
  return items && items.length ? h`<h3>${title}</h3><ul>${items.map((i) => h`<li>${i}</li>`)}</ul>` : '';
}

export function taskDetailView(id) {
  if (rv.taskId !== id) resetReview(id);
  const x = task();
  if (!x) return h`<p><a href="#/tasks">${t('back')}</a></p><p class="muted">${t('taskNotFound')}</p>`;
  const r = rv.review;
  const mat = material();
  return h`
  <p><a href="#/tasks">${t('back')}</a></p>
  <section class="card">
    <div class="form"><input id="tdTitle" class="grow" type="text" maxlength="200" value="${x.title}" data-change="task.edit" data-field="title" aria-label="${t('title')}"></div>
    <div class="form">
      ${subjectSelect('tdSubject', x.subject, { change: 'task.edit', attrs: 'data-field="subject"' })}
      <label class="inline">${t('time')} <input type="number" min="5" max="600" step="5" value="${x.minutes}" data-change="task.edit" data-field="minutes"></label>
      <label class="inline">${t('importance')} <select data-change="task.edit" data-field="importance">${['alta', 'media', 'baja'].map((k) => h`<option value="${k}"${x.importance === k ? h` selected` : ''}>${t('imp.' + k)}</option>`)}</select></label>
      <label class="inline">${t('dueDate')} <input type="date" value="${x.due}" data-change="task.edit" data-field="due"></label>
    </div>
    <div class="form">
      <label class="check"><input type="checkbox" data-change="task.edit" data-field="done"${x.done ? h` checked` : ''}> ${t('markDone')}</label>
      ${state.goals.length ? h`<label class="inline">${t('goal')} <select data-change="task.edit" data-field="goalId"><option value="">${t('noGoal')}</option>${state.goals.map((g) => h`<option value="${g.id}"${x.goalId === g.id ? h` selected` : ''}>${g.title}</option>`)}</select></label>` : ''}
      <button class="link" data-act="task.del">${t('delete')}</button>
    </div>
  </section>
  ${aiEnabled() ? h`<section class="card"><h2>📷 ${t('checkMyWork')}</h2>
    <p class="muted small">${t('checkHint')}</p>
    <div class="form"><button class="btn ghost" data-act="task.take">${t('takePhoto')}</button><button class="btn ghost" data-act="task.choose">${t('choosePhoto')}</button>
      <button class="btn" data-act="task.run"${rv.image && !rv.busy ? '' : h` disabled`}>${rv.busy ? t('checking') : t('check')}</button></div>
    <input type="file" id="rvTake" accept="image/*" capture="environment" hidden data-change="task.file">
    <input type="file" id="rvChoose" accept="image/*" hidden data-change="task.file">
    ${rv.preview ? h`<img class="preview" alt="" src="${rv.preview}">` : ''}
    ${rv.error ? h`<div class="err">${rv.error}</div>` : ''}
    ${r ? h`<div class="review"><h3>${t('verdict')}</h3><p>${r.verdict}</p>${list(t('hardToRead'), r.unclear)}
      ${r.transcription ? h`<details><summary>${t('whatIRead')}</summary><div class="muted pre">${r.transcription}</div><p class="muted small">${t('readTip')}</p></details>` : ''}
      ${list(t('whatIsRight'), r.correct)}
      ${r.corrections && r.corrections.length ? h`<h3>${t('corrections')}</h3><ul>${r.corrections.map((c) => h`<li>${c.issue}<br><strong>${t('better')}:</strong> ${c.fix}</li>`)}</ul>` : ''}
      ${list(t('toAdd'), r.additions)}
      <p><button class="btn" data-act="task.discuss">💬 ${t('discussTutor')}</button></p></div>` : ''}
    ${mat.length >= 20 ? h`<p><button class="btn" data-act="task.exam"${examBusy() ? h` disabled` : ''}>🎯 ${t('makeExam')}</button></p>` : ''}
    ${examView()}
  </section>` : ''}`;
}

register('task', {
  edit(el) {
    const x = task();
    if (!x) return;
    const f = el.dataset.field;
    if (f === 'title') { const v = el.value.trim(); if (v) x.title = v.slice(0, 200); else el.value = x.title; }
    else if (f === 'subject') x.subject = el.value;
    else if (f === 'minutes') x.minutes = clamp(el.value, 5, 600);
    else if (f === 'importance') x.importance = el.value;
    else if (f === 'due') x.due = isDateKey(el.value) ? el.value : '';
    else if (f === 'done') x.done = el.checked;
    else if (f === 'goalId') x.goalId = el.value;
    save('tasks'); refresh();
  },
  del() {
    state.tasks = state.tasks.filter((x) => x.id !== rv.taskId);
    save('tasks'); go('#/tasks');
  },
  take() { byId('rvTake').click(); },
  choose() { byId('rvChoose').click(); },
  async file(el) {
    const f = el.files && el.files[0];
    if (!f) return;
    rv.error = '';
    try {
      const url = await fileToJpeg(f, 1568, 0.85);
      rv.image = url.split(',')[1]; rv.preview = url;
    } catch (e) { rv.error = t('imageErr'); }
    refresh();
  },
  async run() {
    const x = task();
    if (!x || !rv.image || rv.busy) return;
    const token = ++seq;
    rv.busy = true; rv.error = ''; rv.review = null; resetExam();
    refresh();
    try {
      const res = await api('POST', '/api/ai/review', { image: rv.image, subject: subjectName(x.subject), task: x.title, lang: getLang(), level: levelLabel(state.settings.level) });
      if (token !== seq) return;
      rv.review = res;
      if (res.transcription) x.notes = res.transcription.slice(0, 4000);
      state.counters.reviews++;
      save('tasks', 'counters');
    } catch (e) {
      if (token !== seq) return;
      rv.error = e && e.status === 429 ? t('errLimit') : t('reviewErr');
    }
    rv.busy = false;
    refresh();
  },
  exam() { const x = task(); if (x) generateExam(material(), x.subject); },
  discuss() {
    const x = task();
    if (!x || !rv.review) return;
    startWithContext(x, rv.review);
    go('#/tutor');
  },
});
