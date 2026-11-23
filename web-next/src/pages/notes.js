import { state, save, LIMITS, sectionSize, SECTION_MAX_BYTES } from '../store.js';
import { h, byId, uid, debounce } from '../util.js';
import { t, subjectName, fmtDate } from '../i18n.js';
import { register, refresh, go } from '../actions.js';
import { aiEnabled } from '../api.js';
import { subjectSelect } from '../ui.js';
import { examView, generateExam, resetExam, examBusy } from '../exam.js';

const ui = { sel: '', error: '' };
const saveNotes = debounce(() => save('notes'), 400);
const cur = () => state.notes.find((n) => n.id === ui.sel);

export const notes = {
  id: 'notes', icon: '📝', titleKey: 'nav.notes',
  view() {
    const list = state.notes.slice().sort((a, b) => b.updated - a.updated);
    const n = cur();
    return h`
    <div class="page-head"><h1>${t('nav.notes')}</h1><button class="btn" data-act="notes.new">+ ${t('newNote')}</button></div>
    ${ui.error ? h`<div class="err">${ui.error}</div>` : ''}
    <div class="notes-layout">
      <section class="card notes-list">
        ${list.length ? list.map((x) => h`<button class="note-item${x.id === ui.sel ? ' sel' : ''}" data-act="notes.open" data-id="${x.id}">
          <strong data-label="${x.id}">${x.title || t('untitled')}</strong><span class="muted small">${subjectName(x.subject)} · ${fmtDate(new Date(x.updated || Date.now()).toISOString().slice(0, 10))}</span></button>`) : h`<p class="muted">${t('noNotes')}</p>`}
      </section>
      <section class="card notes-edit">
        ${n ? h`
          <div class="form"><input id="nTitle" class="grow" type="text" maxlength="120" placeholder="${t('noteTitle')}" value="${n.title}" data-input="notes.title">
            ${subjectSelect('nSubject', n.subject, { change: 'notes.subject' })}</div>
          <textarea id="nBody" rows="14" maxlength="20000" placeholder="${t('noteBody')}" data-input="notes.body">
${n.body}</textarea>
          <p class="muted small"><span id="nCount">${n.body.length}</span> / 20000</p>
          <div class="form">
            ${aiEnabled() ? h`<button class="btn" data-act="notes.exam"${examBusy() ? h` disabled` : ''}>🎯 ${t('makeExam')}</button><button class="btn ghost" data-act="notes.cards">🃏 ${t('goCards')}</button>` : ''}
            <button class="link" data-act="notes.del">${t('delete')}</button></div>
          ${aiEnabled() ? examView() : ''}` : h`<p class="muted">${t('pickNote')}</p>`}
      </section>
    </div>`;
  },
};

register('notes', {
  new() {
    if (state.notes.length >= LIMITS.notes || sectionSize('notes') > SECTION_MAX_BYTES - 30000) { ui.error = t('notesFull'); refresh(); return; }
    const n = { id: uid(), title: '', subject: state.settings.subjects[0], body: '', updated: Date.now() };
    state.notes.push(n); ui.sel = n.id; ui.error = ''; resetExam();
    save('notes'); refresh();
    const el = byId('nTitle'); if (el) el.focus();
  },
  open(el) { ui.sel = el.dataset.id; ui.error = ''; resetExam(); refresh(); },
  title(el) {
    const n = cur(); if (!n) return;
    n.title = el.value.slice(0, 120); n.updated = Date.now();
    const lab = document.querySelector('[data-label="' + n.id + '"]'); if (lab) lab.textContent = n.title || t('untitled');
    saveNotes();
  },
  body(el) {
    const n = cur(); if (!n) return;
    const prev = n.body;
    n.body = el.value.slice(0, 20000); n.updated = Date.now();
    if (sectionSize('notes') > SECTION_MAX_BYTES) {
      n.body = prev; el.value = prev;
      const err = byId('nCount'); if (err) err.textContent = prev.length;
      ui.error = t('notesFull'); return;
    }
    const c = byId('nCount'); if (c) c.textContent = n.body.length;
    saveNotes();
  },
  subject(el) { const n = cur(); if (n) { n.subject = el.value; n.updated = Date.now(); save('notes'); refresh(); } },
  del() {
    const n = cur();
    if (!n || !window.confirm(t('confirmDelete'))) return;
    state.notes = state.notes.filter((x) => x.id !== n.id); ui.sel = ''; resetExam();
    save('notes'); refresh();
  },
  exam() { const n = cur(); if (!n) return; if (n.body.trim().length < 30) { ui.error = t('noteTooShort'); refresh(); return; } ui.error = ''; generateExam(n.body, n.subject); },
  cards() { go('#/cards'); },
});
