import { state, save, LIMITS, levelLabel } from '../store.js';
import { h, byId, uid } from '../util.js';
import { t, subjectName, getLang } from '../i18n.js';
import { register, refresh } from '../actions.js';
import { api, aiEnabled } from '../api.js';
import { subjectSelect } from '../ui.js';

const ui = { unknownOnly: false, flipped: new Set(), busy: false, error: '' };

export const cards = {
  id: 'cards', icon: '🃏', titleKey: 'nav.cards',
  view() {
    const known = state.cards.filter((c) => c.known).length;
    const list = state.cards.filter((c) => !ui.unknownOnly || !c.known);
    return h`
    <div class="page-head"><div><h1>${t('nav.cards')}</h1><p class="muted">${t('cardsSub')}</p></div></div>
    <section class="card"><h2>${t('newCard')}</h2>
      <div class="form">
        <input id="cdFront" class="grow" type="text" maxlength="500" placeholder="${t('cardFront')}">
        <input id="cdBack" class="grow" type="text" maxlength="1000" placeholder="${t('cardBack')}" data-enter="cards.add">
        ${subjectSelect('cdSubject', state.settings.subjects[0])}
        <button class="btn" data-act="cards.add">+ ${t('add')}</button>
      </div>
      ${aiEnabled() && state.notes.length ? h`<div class="form"><span class="muted small">${t('fromNotes')}</span>
        <select id="cdNote">${state.notes.map((n) => h`<option value="${n.id}">${n.title || t('untitled')}</option>`)}</select>
        <select id="cdCount"><option value="5">5</option><option value="10" selected>10</option><option value="15">15</option></select>
        <button class="btn ghost" data-act="cards.fromNote"${ui.busy ? h` disabled` : ''}>${ui.busy ? t('making') : '✨ ' + t('createFromNotes')}</button></div>` : ''}
      ${ui.error ? h`<div class="err">${ui.error}</div>` : ''}
    </section>
    <section class="card">
      <div class="row-line"><span>${t('knowCount', { n: known, total: state.cards.length })}</span>
        <label class="check"><input type="checkbox" data-change="cards.unknownOnly"${ui.unknownOnly ? h` checked` : ''}> ${t('onlyUnknown')}</label></div>
      ${list.length ? h`<div class="flash-grid">${list.map((c) => {
        const open = ui.flipped.has(c.id);
        return h`<div class="flash${c.known ? ' known' : ''}${open ? ' open' : ''}" data-act="cards.flip" data-id="${c.id}" role="button" tabindex="0">
          <div class="muted small">${subjectName(c.subject)}</div>
          <div class="ft">${open ? c.back : c.front}</div>
          <div class="fa">${open ? h`<button class="btn small" data-act="cards.mark" data-id="${c.id}" data-known="1">${t('iKnow')}</button> <button class="btn ghost small" data-act="cards.mark" data-id="${c.id}" data-known="0">${t('iDont')}</button>` : h`<span class="muted small">${t('tapToFlip')}</span>`}
          <button class="link" data-act="cards.del" data-id="${c.id}">${t('delete')}</button></div></div>`;
      })}</div>` : h`<p class="muted">${t('noCards')}</p>`}
    </section>`;
  },
};

register('cards', {
  add() {
    const front = byId('cdFront').value.trim(), back = byId('cdBack').value.trim();
    if (!front || !back || state.cards.length >= LIMITS.cards) return;
    state.cards.push({ id: uid(), front: front.slice(0, 500), back: back.slice(0, 1000), subject: byId('cdSubject').value, known: false });
    save('cards'); refresh();
  },
  flip(el) { const id = el.dataset.id; if (ui.flipped.has(id)) ui.flipped.delete(id); else ui.flipped.add(id); refresh(); },
  mark(el) { const c = state.cards.find((x) => x.id === el.dataset.id); if (c) { c.known = el.dataset.known === '1'; ui.flipped.delete(c.id); save('cards'); refresh(); } },
  del(el) { state.cards = state.cards.filter((c) => c.id !== el.dataset.id); save('cards'); refresh(); },
  unknownOnly(el) { ui.unknownOnly = el.checked; refresh(); },
  async fromNote() {
    const note = state.notes.find((n) => n.id === byId('cdNote').value);
    if (!note || ui.busy || note.body.trim().length < 30) { ui.error = t('noteTooShort'); refresh(); return; }
    ui.busy = true; ui.error = ''; refresh();
    try {
      const res = await api('POST', '/api/ai/cards', { text: note.body, subject: subjectName(note.subject), count: +byId('cdCount').value, lang: getLang(), level: levelLabel(state.settings.level) });
      const room = LIMITS.cards - state.cards.length;
      (res.cards || []).slice(0, room).forEach((c) => state.cards.push({ id: uid(), front: c.front, back: c.back, subject: note.subject, known: false }));
      state.counters.cards += (res.cards || []).length;
      save('cards', 'counters');
    } catch (e) { ui.error = e && e.status === 429 ? t('errLimit') : t('cardsErr'); }
    ui.busy = false; refresh();
  },
});
