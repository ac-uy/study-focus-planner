// Design settings: colors, light/dark mode, shape, font and background.
import { isDark } from './util.js';

export const COLORS = ['#e0608a', '#f28b82', '#f6a05c', '#e3b341', '#4cc38a', '#38b6e8', '#7a5cc4', '#d78be8'];

export const FONTS = [
  { id: 'system', css: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif' },
  { id: 'rounded', css: 'ui-rounded,"SF Pro Rounded","Nunito","Quicksand","Segoe UI",system-ui,sans-serif' },
  { id: 'hand', css: '"Ink Free","Segoe Print","Bradley Hand","Chalkboard SE","Comic Sans MS",cursive' },
  { id: 'comic', css: '"Comic Sans MS","Comic Neue","Chalkboard SE",cursive' },
  { id: 'serif', css: 'Georgia,"Times New Roman",serif' },
  { id: 'classic', css: '"Palatino Linotype",Palatino,"Book Antiqua",serif' },
  { id: 'trebuchet', css: '"Trebuchet MS","Lucida Grande",sans-serif' },
  { id: 'verdana', css: 'Verdana,Geneva,sans-serif' },
  { id: 'gill', css: '"Gill Sans","Gill Sans MT",Calibri,sans-serif' },
  { id: 'mono', css: 'ui-monospace,"Cascadia Code",Consolas,Menlo,monospace' },
];
export const FONT_IDS = FONTS.map((f) => f.id);

export const SHAPES = { sharp: '4px', soft: '10px', rounded: '18px', pill: '28px' };
export const SHAPE_IDS = Object.keys(SHAPES);

// Each background is a CSS class (bg-<id>) defined in styles.css. "photo" uses an image stored on this device.
export const BACKGROUNDS = [
  { id: 'plain' }, { id: 'paper' }, { id: 'grid' }, { id: 'blush' }, { id: 'sunset' }, { id: 'sky' }, { id: 'mint' }, { id: 'lavender' }, { id: 'night', dark: true },
  { id: 'aurora', anim: true }, { id: 'stars', anim: true, dark: true }, { id: 'rain', anim: true }, { id: 'snow', anim: true },
  { id: 'bubbles', anim: true }, { id: 'hearts', anim: true }, { id: 'ocean', anim: true, dark: true }, { id: 'fireflies', anim: true, dark: true },
  { id: 'photo' },
];
export const BG_IDS = BACKGROUNDS.map((b) => b.id);
export const PHOTO_KEY = 'sp2-bgphoto';

export function resolvedMode(design) {
  if (design.mode === 'dark') return 'dark';
  if (design.mode === 'light') return 'light';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyDesign(d) {
  const root = document.documentElement;
  const mode = resolvedMode(d);
  const font = FONTS.find((f) => f.id === d.font) || FONTS[0];
  root.dataset.theme = mode;
  root.style.setProperty('--primary', d.primary);
  root.style.setProperty('--on-primary', isDark(d.primary) ? '#ffffff' : '#2a2433');
  root.style.setProperty('--accent', d.accent);
  root.style.setProperty('--radius', SHAPES[d.shape] || SHAPES.rounded);
  root.style.setProperty('--font', font.css);
  const bg = document.getElementById('bg');
  if (bg) {
    bg.className = 'bg bg-' + d.bg;
    bg.style.backgroundImage = '';
    if (d.bg === 'photo') {
      let url = '';
      try { url = localStorage.getItem(PHOTO_KEY) || ''; } catch (e) { /* ignore */ }
      if (url) bg.style.backgroundImage = 'url("' + url.replace(/"/g, '') + '")';
      else bg.className = 'bg bg-plain';
    }
    const meta = BACKGROUNDS.find((b) => b.id === d.bg);
    root.dataset.bgdark = meta && meta.dark ? '1' : '0';
  }
}

export function savePhoto(dataUrl) {
  try { localStorage.setItem(PHOTO_KEY, dataUrl); return true; } catch (e) { return false; }
}
export function removePhoto() {
  try { localStorage.removeItem(PHOTO_KEY); } catch (e) { /* ignore */ }
}
export function hasPhoto() {
  try { return !!localStorage.getItem(PHOTO_KEY); } catch (e) { return false; }
}
