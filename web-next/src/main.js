import { state, load, flags, save } from './store.js';
import { setLang, t, getLang } from './i18n.js';
import { applyDesign } from './theme.js';
import { ACTIONS, register, setRefresh } from './actions.js';
import { h, byId } from './util.js';
import { net, startCloud, signOut } from './api.js';
import { clock, initClock, setHooks, formatClock, audio } from './clock.js';
import { resetExam } from './exam.js';
import { home } from './pages/home.js';
import { calendar } from './pages/calendar.js';
import { examweeks } from './pages/examweeks.js';
import { plan } from './pages/plan.js';
import { tasks } from './pages/tasks.js';
import { tutor } from './pages/tutor.js';
import { cards } from './pages/cards.js';
import { notes } from './pages/notes.js';
import { goals } from './pages/goals.js';
import { streaks } from './pages/streaks.js';
import { stats } from './pages/stats.js';
import { timer, paintClock } from './pages/timerpage.js';
import { timetable } from './pages/timetable.js';
import { history } from './pages/history.js';
import { design } from './pages/design.js';
import { results } from './pages/results.js';
import { icon } from './icons.js';
import { renderDock } from './music.js';
import { family, addchild, addadult, noprofile } from './pages/family.js';

const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const STUDENT_PAGES = [home, calendar, examweeks, plan, tasks, results, tutor, cards, notes, goals, streaks, stats, timer, timetable, history, design];
const PARENT_PAGES = [family, addchild, addadult];
const VIEWER_PAGES = [family]; // an adult added by the family admin only looks
// Who is signed in decides which pages exist: students get the study app, parents the family view,
// and an account that has no role yet gets only a notice.
const pages = () => (net.role === 'parent' ? (net.me && net.me.admin === false ? VIEWER_PAGES : PARENT_PAGES) : net.role === 'none' ? [noprofile] : STUDENT_PAGES);

function route() {
  const list = pages();
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const found = list.find((p) => p.id === parts[0]);
  const page = found || list[0];
  return { page, arg: found && parts[1] ? decodeURIComponent(parts[1]) : '' };
}

let lastKey = '';
function render() {
  const { page, arg } = route();
  const key = page.id + '/' + arg;
  const changed = key !== lastKey;
  lastKey = key;
  byId('view').innerHTML = page.view(arg).s;
  if (page.mount) page.mount(arg);
  renderSide();
  updateMini();
  if (changed) window.scrollTo(0, 0);
}

function refresh() {
  const a = document.activeElement;
  const id = a && a.id, start = a && a.selectionStart, end = a && a.selectionEnd;
  const y = window.scrollY;
  render();
  if (id) {
    const el = byId(id);
    if (el && el !== document.activeElement) {
      el.focus();
      try { if (start != null && el.setSelectionRange) el.setSelectionRange(start, end); } catch (e) { /* not a text field */ }
    }
  }
  window.scrollTo(0, y);
}

function userName() {
  if (net.role === 'parent' && net.me && net.me.name) return net.me.name;
  return state.profile.name || (net.email ? net.email.split('@')[0] : t('student'));
}

function renderSide() {
  const cur = route().page.id;
  byId('side').innerHTML = h`
    <div class="brand"><span class="logo">📚</span><div><strong>${t('appName')}</strong><div class="muted small">${t('appSub')}</div></div></div>
    <nav>${(net.role === 'none' ? [] : pages()).map((p) => h`<a class="nav${p.id === cur ? ' on' : ''}" href="#/${p.id}">${icon(p.id)}<span>${t(p.titleKey)}</span></a>`)}</nav>
    <div class="side-foot">
      <div class="seg"><button class="chip${getLang() === 'es' ? ' on' : ''}" data-act="app.lang" data-lang="es">ES</button><button class="chip${getLang() === 'en' ? ' on' : ''}" data-act="app.lang" data-lang="en">EN</button></div>
      <div class="who"><span class="avatar">${userName().charAt(0).toUpperCase()}</span><span class="small">${userName()}</span></div>
      ${net.cloud ? h`<button class="link" data-act="app.signOut">${t('signOut')}</button>` : h`<span class="muted small">${t('localMode')}</span>`}
      <span class="muted small" id="appVersion">v${VERSION}</span>
    </div>`.s;
}

function renderBanner() {
  const msgs = [];
  if (flags.loadError) msgs.push(t('errLoad'));
  if (flags.storageError) msgs.push(t('errSave'));
  if (net.syncError === 'size') msgs.push(t('errSyncSize'));
  else if (net.syncError) msgs.push(t('errSync'));
  byId('banner').innerHTML = msgs.map((m) => h`<div class="banner">${m}</div>`.s).join('');
}

function updateMini() {
  const el = byId('miniTimer');
  const show = (clock.running || clock.acc > 0 || clock.preview) && route().page.id !== 'timer';
  el.hidden = !show;
  if (show) el.innerHTML = h`<a href="#/timer">⏱️ ${formatClock(clock.seconds)}${clock.running ? '' : ' ⏸'}</a>`.s;
}

register('app', {
  lang(el) { state.lang = el.dataset.lang; setLang(state.lang); save('lang'); refresh(); },
  signOut() { signOut(); },
  menu() { document.body.classList.toggle('menu-open'); },
});

function boot() {
  load();
  setLang(state.lang);
  applyDesign(state.design);
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', () => applyDesign(state.design));
  }
  initClock();
  setHooks({
    tick() {
      paintClock(); updateMini();
      document.title = clock.running ? formatClock(clock.seconds) + ' · ' + t('appName') : t('appName');
    },
    done(kind) { if (kind !== 'break' || route().page.id === 'timer') refresh(); },
  });
  setRefresh(refresh);
  document.title = t('appName');

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) fn(el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    const fn = el && ACTIONS[el.dataset.change];
    if (fn) fn(el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    const fn = el && ACTIONS[el.dataset.input];
    if (fn) fn(el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      const el = e.target.closest('[data-enter]');
      const fn = el && ACTIONS[el.dataset.enter];
      if (fn) { e.preventDefault(); fn(el, e); return; }
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.dataset.act) {
      e.preventDefault();
      const fn = ACTIONS[e.target.dataset.act];
      if (fn) fn(e.target, e);
    }
  });
  byId('menuBtn').addEventListener('click', () => document.body.classList.toggle('menu-open'));
  byId('scrim').addEventListener('click', () => document.body.classList.remove('menu-open'));
  window.addEventListener('hashchange', () => { document.body.classList.remove('menu-open'); resetExam(); render(); });

  net.onChange = () => { renderBanner(); renderSide(); };
  render();
  renderDock();
  renderBanner();
  startCloud().then((changed) => {
    if (changed) { setLang(state.lang); applyDesign(state.design); if (!clock.running && clock.acc === 0) initClock(); audio(); }
    renderBanner();
    refresh();
  });
}

boot();
