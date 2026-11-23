import { state, save } from '../store.js';
import { h, byId, clamp } from '../util.js';
import { t } from '../i18n.js';
import { register, refresh } from '../actions.js';
import { clock, setMode, setPreset, start, pause, reset, setPreview, audio, formatClock } from '../clock.js';
import { SOUND_GROUPS } from '../sound.js';
import { subjectSelect } from '../ui.js';
import { streakInfo } from '../calc.js';
import { musicCard } from '../music.js';
import SOURCES from '../../public/sounds/sources.json';

const PRESETS = [10, 15, 20, 30, 45, 60, 90, 120];
const label = () => (clock.mode === 'pomodoro' ? (clock.phase === 'focus' ? t('focusBlock') : t('shortBreak')) : clock.mode === 'stopwatch' ? t('stopwatchLabel') : t('studyTime'));

// Called every tick: update the clock without re-rendering the page.
export function paintClock() {
  const c = byId('clock');
  if (!c) return;
  c.textContent = formatClock(clock.seconds);
  const pct = clock.total ? (1 - clock.seconds / clock.total) * 100 : 0;
  const b = byId('clockBar'); if (b) b.style.width = Math.max(0, Math.min(100, pct)) + '%';
  const s = byId('startBtn'); if (s) s.textContent = clock.running ? '⏸ ' + t('pause') : '▶ ' + t('start');
  const l = byId('clockLabel'); if (l) l.textContent = label();
}

export const timer = {
  id: 'timer', icon: '⏱️', titleKey: 'nav.timer',
  view() {
    const st = streakInfo(state.sessions);
    return h`<div class="page-head"><h1>${t('timerTitle')}</h1><span class="badge">🔥 ${t('streakChip', { n: st.current })}</span></div>
    <div class="form">${subjectSelect('tmSubject', clock.subject, { any: t('subjectOptional'), change: 'timer.subject' })}
      <input id="tmTitle" type="text" maxlength="120" placeholder="${t('sessionTitleOptional')}" value="${clock.title}" data-change="timer.title"></div>
    <div class="tabs">${['timer', 'stopwatch', 'pomodoro'].map((m) => h`<button class="tab${clock.mode === m ? ' on' : ''}" data-act="timer.mode" data-mode="${m}"${clock.running ? h` disabled` : ''}>${t('mode.' + m)}</button>`)}</div>
    <section class="card center">
      ${clock.mode === 'timer' ? h`<div class="presets">${PRESETS.map((p) => h`<button class="chip${state.settings.timerMin === p ? ' on' : ''}" data-act="timer.preset" data-min="${p}"${clock.running ? h` disabled` : ''}>${p >= 60 ? (p / 60) + ' h' : p + ' min'}</button>`)}
        <label class="inline">${t('custom')} <input id="tmCustom" type="number" min="1" max="300" value="${state.settings.timerMin}" data-change="timer.custom"${clock.running ? h` disabled` : ''}> min</label></div>` : ''}
      <div id="clockLabel" class="muted">${label()}</div>
      <div id="clock" class="clock">${formatClock(clock.seconds)}</div>
      <div class="bar"><div id="clockBar" style="width:0%"></div></div>
      <button class="btn" id="startBtn" data-act="timer.toggle">${clock.running ? '⏸ ' + t('pause') : '▶ ' + t('start')}</button>
      <button class="btn ghost" data-act="timer.reset">${clock.mode === 'timer' ? t('resetSave') : t('stopSave')}</button>
      <p class="muted small">${t('timerSaveNote')}</p>
    </section>
    <section class="card"><h2>🎧 ${t('bgSound')}</h2>
      <div class="form"><select id="tmSound" data-change="timer.sound" aria-label="${t('bgSound')}"><option value="none">${t('snd.none')}</option>
        ${SOUND_GROUPS.map((g) => h`<optgroup label="${t('sndg.' + g.id)}">${g.ids.map((id) => h`<option value="${id}"${state.settings.sound === id ? h` selected` : ''}>${t('snd.' + id)}</option>`)}</optgroup>`)}</select>
        <button class="btn ghost" data-act="timer.preview">${clock.preview ? '■ ' + t('stopPreview') : '▶ ' + t('preview')}</button>
        <label class="inline">${t('volume')} <input id="tmVol" type="range" min="0" max="100" value="${state.settings.volume}" data-input="timer.volume"></label></div>
      <p class="muted small">${['delta', 'theta', 'alpha', 'beta'].includes(state.settings.sound) ? t('binauralNote') + ' ' : ''}${t('soundNote')}</p>
      <details><summary>${t('soundsCredits')}</summary>
        <p class="muted small">${t('soundsPublicDomain')}</p>
        <ul class="small">${Object.keys(SOURCES).map((id) => h`<li><b>${t('snd.' + id)}</b>: ${SOURCES[id].sources.map((s, i) => h`${i ? ' · ' : ''}<a href="${s.page}" target="_blank" rel="noopener">${s.title}</a> (${s.license})`)}</li>`)}</ul></details>
    </section>
    ${musicCard()}`;
  },
  mount() { paintClock(); },
};

register('timer', {
  subject(el) { clock.subject = el.value; },
  title(el) { clock.title = el.value.trim().slice(0, 120); },
  mode(el) { setMode(el.dataset.mode); refresh(); },
  preset(el) { setPreset(+el.dataset.min); refresh(); },
  custom(el) { setPreset(clamp(el.value, 1, 300)); refresh(); },
  toggle() { if (clock.running) pause(); else start(); refresh(); },
  reset() { reset(); refresh(); },
  sound(el) { state.settings.sound = el.value; save('settings'); audio(); refresh(); },
  volume(el) { state.settings.volume = clamp(el.value, 0, 100); audio(); },
  preview() { setPreview(!clock.preview); refresh(); },
});
