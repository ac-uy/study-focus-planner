import { STRINGS as BASE } from './strings.js';
import { STRINGS_MORE } from './strings-more.js';
import { parseKey } from './util.js';
import { DEFAULT_SUBJECTS } from './store.js';

const STRINGS = { es: { ...BASE.es, ...STRINGS_MORE.es }, en: { ...BASE.en, ...STRINGS_MORE.en } };

let lang = 'es';
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'es';
  document.documentElement.lang = lang;
}
export const getLang = () => lang;

export function t(key, vars) {
  let s = STRINGS[lang][key];
  if (s === undefined) s = STRINGS.en[key];
  if (s === undefined) return key;
  if (vars) Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(vars[k]); });
  return s;
}

// Default subject names are translated; names she typed herself are shown as written.
export function subjectName(name) {
  if (!name) return t('noSubject');
  const k = 'subj.' + name;
  return DEFAULT_SUBJECTS.includes(name) && STRINGS[lang][k] ? STRINGS[lang][k] : name;
}

const locale = () => (lang === 'es' ? 'es-ES' : 'en-GB');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function fmtDate(key, opts) {
  if (!key) return '';
  return new Intl.DateTimeFormat(locale(), opts || { day: 'numeric', month: 'short', year: 'numeric' }).format(parseKey(key));
}
export const fmtDateLong = (key) => cap(fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' }));
export function weekdayShort(i) { // 0 = Monday
  return cap(new Intl.DateTimeFormat(locale(), { weekday: 'short' }).format(new Date(2024, 0, 1 + i)).replace('.', ''));
}
export function weekdayLong(i) {
  return cap(new Intl.DateTimeFormat(locale(), { weekday: 'long' }).format(new Date(2024, 0, 1 + i)));
}
export function monthYear(y, m) {
  return cap(new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date(y, m, 1)));
}
export function daysLeftText(n) {
  if (n < 0) return t('daysAgo', { n: -n });
  if (n === 0) return t('today');
  if (n === 1) return t('tomorrow');
  return t('daysLeft', { n });
}
