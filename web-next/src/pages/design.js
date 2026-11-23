// Design (colors, mode, shape, font, background) and the profile: name, school year, subjects, timer lengths.
import { state, save, LEVELS, MAX_SUBJECTS, defaults } from '../store.js';
import { h, byId, clamp } from '../util.js';
import { t, subjectName } from '../i18n.js';
import { register, refresh } from '../actions.js';
import { COLORS, FONTS, SHAPE_IDS, BACKGROUNDS, applyDesign, savePhoto, removePhoto, hasPhoto } from '../theme.js';
import { fileToJpeg } from '../image.js';
import { settingsChanged } from '../clock.js';

const ui = { error: '', photoError: '' };

function swatches(kind) {
  const cur = state.design[kind];
  return h`<div class="swatches">${COLORS.map((c) => h`<button class="swatch${cur === c ? ' on' : ''}" style="background:${c}" data-act="design.color" data-kind="${kind}" data-color="${c}" aria-label="${c}"></button>`)}
    <input type="color" value="${cur}" data-change="design.color" data-kind="${kind}" aria-label="${t('customColor')}"></div>`;
}

export const design = {
  id: 'design', icon: '🎨', titleKey: 'nav.design',
  view() {
    const d = state.design, s = state.settings;
    return h`<div class="page-head"><div><h1>${t('nav.design')}</h1><p class="muted">${t('designSub')}</p></div><button class="btn ghost" data-act="design.resetDesign">↺ ${t('reset')}</button></div>
    <section class="card"><h2>${t('profile')}</h2>
      <div class="form"><label class="inline">${t('yourName')} <input id="pfName" type="text" maxlength="40" value="${state.profile.name}" data-change="design.name"></label>
        <label class="inline">${t('schoolYear')} <select data-change="design.level"><option value="">${t('levelNone')}</option>${LEVELS.map((l) => h`<option value="${l.id}"${s.level === l.id ? h` selected` : ''}>${l.label}</option>`)}</select></label></div>
      <div class="form"><label class="inline">${t('focusLen')} <input type="number" min="1" max="120" value="${s.focusMin}" data-change="design.len" data-key="focusMin"></label>
        <label class="inline">${t('breakLen')} <input type="number" min="1" max="60" value="${s.breakMin}" data-change="design.len" data-key="breakMin"></label></div>
      <h3>${t('subjects')}</h3>
      <div>${s.subjects.map((n, i) => h`<span class="chip">${subjectName(n)}<button data-act="design.delSubject" data-i="${i}" aria-label="${t('remove')}">×</button></span>`)}</div>
      <div class="form"><input id="pfSubject" type="text" maxlength="40" placeholder="${t('newSubject')}" data-enter="design.addSubject"><button class="btn ghost" data-act="design.addSubject">${t('add')}</button></div>
      ${ui.error ? h`<div class="err">${ui.error}</div>` : ''}</section>
    <section class="card"><h2>${t('colors')}</h2><p class="muted small">${t('colorsSub')}</p>
      <div class="grid2"><div><h3>${t('mainColor')}</h3>${swatches('primary')}</div><div><h3>${t('accentColor')}</h3>${swatches('accent')}</div></div></section>
    <section class="card"><h2>${t('lightDark')}</h2><div class="seg">${['light', 'dark', 'system'].map((m) => h`<button class="chip${d.mode === m ? ' on' : ''}" data-act="design.set" data-key="mode" data-v="${m}">${t('mode.' + m + 'Theme')}</button>`)}</div></section>
    <section class="card"><h2>${t('shapeFont')}</h2>
      <h3>${t('corners')}</h3><div class="seg">${SHAPE_IDS.map((m) => h`<button class="chip${d.shape === m ? ' on' : ''}" data-act="design.set" data-key="shape" data-v="${m}">${t('shape.' + m)}</button>`)}</div>
      <h3>${t('font')}</h3><div class="seg">${FONTS.map((f) => h`<button class="chip${d.font === f.id ? ' on' : ''}" style="font-family:${f.css}" data-act="design.set" data-key="font" data-v="${f.id}">${t('font.' + f.id)}</button>`)}</div></section>
    <section class="card"><h2>${t('background')}</h2><p class="muted small">${t('backgroundSub')}</p>
      <div class="bggrid">${BACKGROUNDS.filter((b) => b.id !== 'photo' || hasPhoto()).map((b) => h`<button class="bgopt${d.bg === b.id ? ' on' : ''}" data-act="design.set" data-key="bg" data-v="${b.id}"><span class="bg bg-${b.id} preview"></span><span>${t('bg.' + b.id)}${b.anim ? ' ✨' : ''}</span></button>`)}</div>
      <div class="form"><button class="btn ghost" data-act="design.photo">🖼️ ${t('uploadPhoto')}</button>${hasPhoto() ? h`<button class="btn ghost" data-act="design.rmPhoto">${t('removePhoto')}</button>` : ''}
        <input type="file" id="bgFile" accept="image/*" hidden data-change="design.photoFile"></div>
      <p class="muted small">${t('photoNote')}</p>${ui.photoError ? h`<div class="err">${ui.photoError}</div>` : ''}</section>`;
  },
};

function applyAndSave() { applyDesign(state.design); save('design'); refresh(); }

register('design', {
  color(el) { state.design[el.dataset.kind] = el.dataset.color || el.value; applyAndSave(); },
  set(el) { state.design[el.dataset.key] = el.dataset.v; applyAndSave(); },
  resetDesign() { state.design = defaults().design; applyAndSave(); },
  name(el) { state.profile.name = el.value.trim().slice(0, 40); save('profile'); },
  level(el) { state.settings.level = el.value; save('settings'); },
  len(el) {
    const k = el.dataset.key;
    state.settings[k] = clamp(el.value, 1, k === 'focusMin' ? 120 : 60);
    save('settings'); settingsChanged(); refresh();
  },
  addSubject() {
    const input = byId('pfSubject'), name = input.value.trim(), subs = state.settings.subjects;
    if (!name) return;
    if (subs.some((x) => x.toLowerCase() === name.toLowerCase() || subjectName(x).toLowerCase() === name.toLowerCase())) ui.error = t('errDup');
    else if (subs.length >= MAX_SUBJECTS) ui.error = t('errMax', { n: MAX_SUBJECTS });
    else { subs.push(name.slice(0, 40)); ui.error = ''; save('settings'); }
    refresh();
  },
  delSubject(el) {
    const subs = state.settings.subjects;
    if (subs.length <= 1) { ui.error = t('errLast'); refresh(); return; }
    subs.splice(+el.dataset.i, 1); ui.error = ''; save('settings'); refresh();
  },
  photo() { byId('bgFile').click(); },
  async photoFile(el) {
    const f = el.files && el.files[0];
    if (!f) return;
    ui.photoError = '';
    try {
      const url = await fileToJpeg(f, 1600, 0.7, false);
      if (!savePhoto(url)) { ui.photoError = t('photoTooBig'); refresh(); return; }
      state.design.bg = 'photo'; applyAndSave();
    } catch (e) { ui.photoError = t('imageErr'); refresh(); }
  },
  rmPhoto() { removePhoto(); if (state.design.bg === 'photo') state.design.bg = 'sunset'; applyAndSave(); },
});
