// App state, validation, local persistence and the change hook used for cloud sync.
import { uid, clamp, isDateKey } from './util.js';
import { FONT_IDS, BG_IDS } from './theme.js';

export const LS_KEY = 'study-planner-v2';
export const DEFAULT_SUBJECTS = ['Maths', 'Language', 'English', 'Science', 'History'];
export const MAX_SUBJECTS = 15;
export const LEVELS = [
  { id: '1eso', label: '1º ESO' }, { id: '2eso', label: '2º ESO' }, { id: '3eso', label: '3º ESO' }, { id: '4eso', label: '4º ESO' },
  { id: '1bach', label: '1º Bachillerato' }, { id: '2bach', label: '2º Bachillerato' },
];
export const levelLabel = (id) => (LEVELS.find((l) => l.id === id) || {}).label || '';
export const SOUND_IDS = [
  'none', 'white', 'pink', 'brown', 'blue', 'violet', 'rain', 'storm', 'waves', 'stream', 'wind', 'birds', 'crickets',
  'rainwindow', 'forest', 'dawn', 'fountain', 'satie', 'satie2', 'gymnopedie', 'debussy',
  'cafe', 'keyboard', 'tick', 'elevator', 'piano', 'delta', 'theta', 'alpha', 'beta',
];

// Which top-level keys live in which cloud section (each section is one DynamoDB item).
export const SECTION_KEYS = {
  core: ['lang', 'profile', 'design', 'settings', 'tasks', 'exams', 'examWeeks', 'plan', 'timetable', 'goals', 'weeklyGoals', 'results', 'counters'],
  notes: ['notes'],
  cards: ['cards'],
  sessions: ['sessions'],
};
export const SECTION_OF = {};
Object.keys(SECTION_KEYS).forEach((s) => SECTION_KEYS[s].forEach((k) => { SECTION_OF[k] = s; }));
export const SECTIONS = Object.keys(SECTION_KEYS);
export const LIMITS = { tasks: 500, exams: 200, examWeeks: 50, plan: 1000, goals: 100, weeklyGoals: 30, results: 500, notes: 200, cards: 1500, sessions: 2000 };
export const SECTION_MAX_BYTES = 300 * 1024;

export function defaults() {
  return {
    lang: 'es',
    profile: { name: '' },
    design: { primary: '#e0608a', accent: '#e0608a', mode: 'light', shape: 'rounded', font: 'system', bg: 'sunset' },
    settings: { focusMin: 25, breakMin: 5, subjects: DEFAULT_SUBJECTS.slice(), level: '', sound: 'none', volume: 40, timerMin: 30 },
    tasks: [], exams: [], examWeeks: [], plan: [], timetable: {}, goals: [], weeklyGoals: [], results: [],
    counters: { reviews: 0, exams: 0, chats: 0, cards: 0 },
    notes: [], cards: [], sessions: [],
  };
}

export const state = defaults();
export const meta = { core: 0, notes: 0, cards: 0, sessions: 0 };
export const flags = { loadError: false, storageError: false };

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d);
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const bool = (v) => v === true;

export function normalize(key, v) {
  const D = defaults();
  switch (key) {
    case 'lang': return v === 'en' ? 'en' : 'es';
    case 'profile': return { name: str(v && v.name, 40).trim() };
    case 'design': {
      const o = v || {};
      return {
        primary: hex(o.primary, D.design.primary), accent: hex(o.accent, D.design.accent),
        mode: ['light', 'dark', 'system'].includes(o.mode) ? o.mode : D.design.mode,
        shape: ['sharp', 'soft', 'rounded', 'pill'].includes(o.shape) ? o.shape : D.design.shape,
        font: FONT_IDS.includes(o.font) ? o.font : D.design.font,
        bg: BG_IDS.includes(o.bg) ? o.bg : D.design.bg,
      };
    }
    case 'settings': {
      const o = v || {};
      let subs = list(o.subjects, MAX_SUBJECTS).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 40));
      subs = subs.filter((x, i) => subs.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
      if (!subs.length) subs = DEFAULT_SUBJECTS.slice();
      return {
        focusMin: o.focusMin ? clamp(o.focusMin, 1, 120) : 25, breakMin: o.breakMin ? clamp(o.breakMin, 1, 60) : 5,
        subjects: subs, level: LEVELS.some((l) => l.id === o.level) ? o.level : '',
        sound: SOUND_IDS.includes(o.sound) ? o.sound : 'none', volume: o.volume !== undefined ? clamp(o.volume, 0, 100) : 40,
        timerMin: o.timerMin ? clamp(o.timerMin, 1, 300) : 30,
      };
    }
    case 'tasks': return list(v, LIMITS.tasks).filter((x) => x && typeof x.title === 'string' && x.title.trim()).map((x) => ({
      id: str(x.id, 40) || uid(), title: x.title.trim().slice(0, 200), subject: str(x.subject, 40),
      minutes: x.minutes ? clamp(x.minutes, 1, 600) : 30,
      importance: ['alta', 'media', 'baja'].includes(x.importance) ? x.importance : 'media',
      due: isDateKey(x.due) ? x.due : '', done: bool(x.done), notes: str(x.notes, 4000), goalId: str(x.goalId, 40),
    }));
    case 'exams': return list(v, LIMITS.exams).filter((x) => x && isDateKey(x.date)).map((x) => ({
      id: str(x.id, 40) || uid(), subject: str(x.subject, 40), date: x.date, title: str(x.title, 120),
    }));
    case 'examWeeks': return list(v, LIMITS.examWeeks).filter((x) => x && isDateKey(x.start) && isDateKey(x.end)).map((x) => ({
      id: str(x.id, 40) || uid(), name: str(x.name, 60) || 'Exámenes', start: x.start, end: x.end < x.start ? x.start : x.end,
    }));
    case 'plan': return list(v, LIMITS.plan).filter((x) => x && isDateKey(x.date) && typeof x.title === 'string' && x.title.trim()).map((x) => ({
      id: str(x.id, 40) || uid(), date: x.date, title: x.title.trim().slice(0, 200), subject: str(x.subject, 40),
      minutes: x.minutes ? clamp(x.minutes, 1, 600) : 30, done: bool(x.done),
    }));
    case 'timetable': {
      const out = {};
      if (v && typeof v === 'object') Object.keys(v).forEach((k) => { if (/^[0-4]-[0-6]$/.test(k) && typeof v[k] === 'string' && v[k].trim()) out[k] = v[k].slice(0, 40); });
      return out;
    }
    case 'goals': return list(v, LIMITS.goals).filter((x) => x && typeof x.title === 'string' && x.title.trim()).map((x) => ({
      id: str(x.id, 40) || uid(), title: x.title.trim().slice(0, 200), due: isDateKey(x.due) ? x.due : '',
      steps: list(x.steps, 40).filter((s) => s && typeof s.title === 'string' && s.title.trim()).map((s) => ({ id: str(s.id, 40) || uid(), title: s.title.trim().slice(0, 200), done: bool(s.done) })),
    }));
    case 'weeklyGoals': return list(v, LIMITS.weeklyGoals).filter((x) => x && x.minutes).map((x) => ({
      id: str(x.id, 40) || uid(), subject: str(x.subject, 40), minutes: clamp(x.minutes, 5, 6000),
      period: ['day', 'week', 'month'].includes(x.period) ? x.period : 'week',
    }));
    case 'results': return list(v, LIMITS.results).filter((x) => x && isDateKey(x.date) && isFinite(Number(x.score)) && Number(x.score) >= 0).map((x) => {
      const max = Number(x.max) > 0 ? Math.min(100, Math.round(Number(x.max) * 10) / 10) : 10;
      return {
        id: str(x.id, 40) || uid(), subject: str(x.subject, 40), kind: ['partial', 'exam', 'quiz', 'project', 'other'].includes(x.kind) ? x.kind : 'exam',
        title: str(x.title, 80), date: x.date, score: Math.min(max, Math.round(Number(x.score) * 10) / 10), max,
      };
    });
    case 'counters': {
      const o = v || {};
      const n = (k) => clamp(o[k] || 0, 0, 1e6);
      return { reviews: n('reviews'), exams: n('exams'), chats: n('chats'), cards: n('cards') };
    }
    case 'notes': return list(v, LIMITS.notes).filter((x) => x && typeof x === 'object').map((x) => ({
      id: str(x.id, 40) || uid(), title: str(x.title, 120), subject: str(x.subject, 40), body: str(x.body, 20000), updated: Number(x.updated) || 0,
    }));
    case 'cards': return list(v, LIMITS.cards).filter((x) => x && typeof x.front === 'string' && x.front.trim() && typeof x.back === 'string').map((x) => ({
      id: str(x.id, 40) || uid(), front: x.front.trim().slice(0, 500), back: x.back.trim().slice(0, 1000), subject: str(x.subject, 40), known: bool(x.known),
    }));
    case 'sessions': return list(v, LIMITS.sessions).filter((x) => x && isDateKey(x.date) && x.minutes > 0).map((x) => ({
      id: str(x.id, 40) || uid(), date: x.date, minutes: clamp(x.minutes, 1, 1440),
      mode: ['timer', 'stopwatch', 'pomodoro', 'manual'].includes(x.mode) ? x.mode : 'timer',
      subject: str(x.subject, 40), title: str(x.title, 120), ts: Number(x.ts) || 0,
    }));
    default: return undefined;
  }
}

export function exportSection(name) {
  const o = {};
  SECTION_KEYS[name].forEach((k) => { o[k] = state[k]; });
  return o;
}
export function applySection(name, data) {
  const d = data && typeof data === 'object' ? data : {};
  SECTION_KEYS[name].forEach((k) => {
    if (d[k] !== undefined) state[k] = normalize(k, d[k]);
  });
}
export function sectionSize(name) {
  return JSON.stringify(exportSection(name)).length;
}

// ----- persistence and change notification -----
let pusher = null;
export function setPusher(fn) { pusher = fn; }

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ state, meta })); flags.storageError = false; } catch (e) { flags.storageError = true; }
}
export function touchSections(...names) {
  const now = Date.now();
  const uniq = Array.from(new Set(names));
  uniq.forEach((s) => { meta[s] = now; });
  persist();
  uniq.forEach((s) => { if (pusher) pusher(s); });
}
// save('tasks', 'goals') marks the sections that own those keys as changed.
export function save(...keys) {
  touchSections(...keys.map((k) => SECTION_OF[k]).filter(Boolean));
}

export function load() {
  Object.assign(state, defaults());
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      Object.keys(SECTION_OF).forEach((k) => {
        if (o.state && o.state[k] !== undefined) state[k] = normalize(k, o.state[k]);
      });
      Object.keys(meta).forEach((s) => { meta[s] = Number(o.meta && o.meta[s]) || 0; });
      return true;
    }
  } catch (e) { flags.loadError = true; }
  return false;
}

export function hasUserData() {
  return !!(state.tasks.length || state.exams.length || state.notes.length || state.cards.length || state.sessions.length || state.goals.length || state.plan.length);
}

// Import the record saved by the first version of the planner (one document, key study-planner).
export function migrateV1(o) {
  if (!o || typeof o !== 'object') return false;
  const s = o.settings || {};
  const focus = s.focusMin ? clamp(s.focusMin, 1, 120) : 25;
  const sessions = [];
  Object.keys(o.sessions || {}).forEach((date) => {
    const n = Number(o.sessions[date]);
    if (isDateKey(date) && n > 0) sessions.push({ id: uid(), date, minutes: Math.min(1440, n * focus), mode: 'pomodoro', subject: '', title: '', ts: 0 });
  });
  const data = {
    lang: o.lang,
    settings: { ...state.settings, focusMin: focus, breakMin: s.breakMin, subjects: s.subjects, level: s.level, sound: s.sound, volume: s.volume },
    tasks: list(o.tasks, LIMITS.tasks).map((t) => ({ ...t, importance: 'media', minutes: 30 })),
    goals: o.goals,
  };
  applySection('core', data);
  state.sessions = normalize('sessions', sessions);
  touchSections('core', 'sessions');
  return true;
}

export function flushLocal() { persist(); }

// Subject list for a dropdown, keeping a subject that was removed from settings but is still used by an item.
export const subjectsWithOther = (extra) => {
  const s = state.settings.subjects.slice();
  if (extra && !s.includes(extra)) s.push(extra);
  return s;
};
