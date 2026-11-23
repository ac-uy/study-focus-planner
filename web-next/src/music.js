// "Listen to your favourite music": search through our backend (YouTube Data API, strict safe search, music only)
// and play in YouTube's own embedded player, kept visible in a dock that survives page changes.
// When a song ends the next one from the same search plays (free). When the list runs out, one more search
// for songs like the last one is made (100 API quota units), skipping songs already played.
import { h, byId } from './util.js';
import { t } from './i18n.js';
import { api, aiEnabled } from './api.js';
import { register, refresh } from './actions.js';

const AUTO_KEY = 'sp2-music-auto';
const readAuto = () => { try { return localStorage.getItem(AUTO_KEY) !== '0'; } catch (e) { return true; } };
const ui = {
  q: '', busy: false, error: '', results: [], searched: false,
  playing: null, queue: [], played: new Set(), auto: readAuto(), following: false, note: '',
};
let watchdog = null;
let player = null, playToken = 0, ytPromise = null, wantedId = '', initialId = '', ready = false, ytFailed = false;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const SHOWN = 8; // cards shown; the rest of the results wait in the queue

// Accepts a YouTube link (watch, youtu.be, embed, shorts, music.youtube.com) and returns the video id, or ''.
export function parseYouTubeId(text) {
  const s = String(text || '').trim();
  // Only real links count. A bare 11-character word such as "Tchaikovsky" is a search, not a video id.
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return ''; }
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
  let id = '';
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
    else { const m = /^\/(?:embed|shorts|live|v)\/([^/?]+)/.exec(u.pathname); id = m ? m[1] : ''; }
  }
  return YT_ID.test(id) ? id : '';
}

// ----- YouTube IFrame Player API (loaded on first use) -----
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((resolve, reject) => {
    let done = false;
    const fail = (e) => { if (done) return; done = true; ytPromise = null; reject(e); };
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); if (!done) { done = true; resolve(window.YT); } };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api'; s.async = true; s.onerror = () => fail(new Error('script'));
    document.head.appendChild(s);
    setTimeout(() => fail(new Error('timeout')), window.YT_TIMEOUT_MS || 10000);
  });
  return ytPromise;
}

// YouTube's two official embed addresses. The privacy-enhanced one is tried first; if the player never starts,
// the standard one is tried once (some networks allow one and not the other). The one that works is remembered.
const HOST_KEY = 'sp2-yt-host';
const HOSTS = { nocookie: 'https://www.youtube-nocookie.com', std: 'https://www.youtube.com' };
let hostKind = (() => { try { return localStorage.getItem(HOST_KEY) === 'std' ? 'std' : 'nocookie'; } catch (e) { return 'nocookie'; } })();
let switched = false;
function setHost(kind, remember) {
  hostKind = kind;
  if (remember) { try { localStorage.setItem(HOST_KEY, kind); } catch (e) { /* ignore */ } }
}
function embedUrl(id) {
  return HOSTS[hostKind] + '/embed/' + id + '?autoplay=1&rel=0&playsinline=1';
}

// ----- dock (lives outside the page content so the music keeps playing while she moves around the app) -----
function skeleton(d) {
  if (d.querySelector('.dock-head')) return;
  d.innerHTML = h`<div class="dock-head"><span class="dock-title"></span><span class="dock-btns">
      <button class="link" data-act="music.next" aria-label="${t('musicNext')}" title="${t('musicNext')}">⏭</button>
      <button class="link" data-act="music.close" aria-label="${t('musicClose')}" title="${t('musicClose')}">×</button></span></div>
    <div id="ytWrap"><div id="ytPlayer"></div></div><div class="dock-next muted small"></div>`.s;
}
function updateText() {
  const d = byId('musicDock');
  if (!d || !ui.playing) return;
  const ti = d.querySelector('.dock-title'); if (ti) { ti.textContent = '♪ ' + ui.playing.title; ti.title = ui.playing.title; }
  const nx = d.querySelector('.dock-next');
  if (nx) {
    const up = ui.queue.find((x) => !ui.played.has(x.id));
    nx.textContent = ui.note || (ui.following ? t('musicLooking') : up ? t('musicUpNext', { title: up.title }) : ui.auto ? t('musicWillSearch') : '');
  }
}
// If the player never reports that it started, the device is probably blocking YouTube (for example a school Chromebook).
function startWatchdog() {
  clearTimeout(watchdog);
  watchdog = setTimeout(onWatchdog, window.YT_WATCHDOG_MS || 12000);
}
function onWatchdog() {
  if (!ui.playing) return;
  if (!switched && player) { // first miss: try YouTube's other official embed address once
    switched = true;
    setHost(hostKind === 'nocookie' ? 'std' : 'nocookie', false);
    ui.note = t('musicTryingOther'); updateText();
    rebuildPlayer(ui.playing.id);
    startWatchdog();
    return;
  }
  ui.note = t('musicDeviceBlocked'); updateText(); // second miss: the device is blocking YouTube; stop here
}
function rebuildPlayer(id) {
  if (player && player.destroy) { try { player.destroy(); } catch (e) { /* already gone */ } }
  player = null; ready = false; wantedId = ''; initialId = '';
  const wrap = byId('ytWrap');
  if (wrap) wrap.innerHTML = '<div id="ytPlayer"></div>';
  ensurePlayer(id);
}
function teardown() {
  clearTimeout(watchdog);
  playToken++;
  if (player && player.destroy) { try { player.destroy(); } catch (e) { /* already gone */ } }
  player = null; ready = false; wantedId = ''; initialId = '';
}
export function renderDock() {
  const d = byId('musicDock');
  if (!d) return;
  document.body.classList.toggle('dock-open', !!ui.playing);
  if (!ui.playing) { teardown(); d.hidden = true; d.innerHTML = ''; return; }
  d.hidden = false;
  skeleton(d);
  updateText();
}

function fallbackIframe(id) {
  const wrap = byId('ytWrap');
  if (!wrap) return;
  teardown(); // also stops the watchdog: a plain embed reports nothing back
  wrap.innerHTML = h`<iframe title="${ui.playing ? ui.playing.title : ''}" src="${embedUrl(id)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`.s;
  ui.note = t('musicNoAuto') + ' ' + t('musicDeviceHint');
  updateText();
}

async function ensurePlayer(id) {
  const token = ++playToken;
  wantedId = id;
  if (player && ready && player.loadVideoById) { player.loadVideoById(id); return; }
  if (player) return; // created but not ready yet: onReady will load wantedId
  if (ytFailed) { fallbackIframe(id); return; }
  try {
    const YT = await loadYT();
    if (token !== playToken || !ui.playing) return;
    if (player) { if (ready) player.loadVideoById(wantedId); return; }
    if (!byId('ytPlayer')) return;
    initialId = id;
    player = new YT.Player('ytPlayer', {
      width: '100%', height: '200', videoId: id, host: HOSTS[hostKind],
      playerVars: { autoplay: 1, rel: 0, playsinline: 1, origin: location.origin },
      events: { onReady: onReady, onStateChange: onState, onError: onErr },
    });
  } catch (e) {
    ytFailed = true; // the player script could not be loaded: plain embed from now on (no automatic next song)
    if (token === playToken && ui.playing) fallbackIframe(wantedId);
  }
}
function onReady() {
  ready = true;
  if (player && wantedId && wantedId !== initialId && player.loadVideoById) player.loadVideoById(wantedId);
}
function onState(e) {
  if (!e) return;
  if (e.data === 1 || e.data === 2 || e.data === 3 || e.data === 5) { // the player is alive
    clearTimeout(watchdog);
    if (switched) { setHost(hostKind, true); switched = false; } // the other address worked: remember it
    if (ui.note === t('musicDeviceBlocked') || ui.note === t('musicTryingOther')) { ui.note = ''; updateText(); }
  }
  if (e.data === 0) playNext(false); // ended
  if (e.data === 1 && player && player.getVideoData && ui.playing) { // playing: learn the real title (pasted links)
    try {
      const d = player.getVideoData();
      if (d && d.title && d.video_id === ui.playing.id && d.title !== ui.playing.title) { ui.playing.title = d.title; updateText(); }
    } catch (err) { /* ignore */ }
  }
}
function onErr() { setTimeout(() => playNext(false), 800); } // video not playable here: go to the next one

// ----- queue -----
function similarQuery() {
  let title = ui.playing && ui.playing.title;
  try {
    if ((!title || title === t('youtubeVideo')) && player && player.getVideoData) title = (player.getVideoData() || {}).title || title;
  } catch (e) { /* ignore */ }
  const cleaned = String(title || '').replace(/[([][^)\]]*[)\]]/g, ' ').replace(/[^\p{L}\p{N}\s&'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return cleaned.length >= 2 ? cleaned : ui.q;
}

function startTrack(item) {
  ui.playing = { id: item.id, title: item.title, channel: item.channel || '' };
  ui.played.add(item.id); ui.note = '';
  renderDock();
  switched = false;
  ensurePlayer(item.id);
  if (!ytFailed) startWatchdog();
}

async function playNext(force) {
  if (!ui.playing || ui.following) return;
  let next = ui.queue.find((x) => !ui.played.has(x.id));
  if (!next && (ui.auto || force) && aiEnabled()) {
    ui.following = true; updateText();
    try {
      const q = similarQuery();
      if (q.length >= 2) {
        const res = await api('POST', '/api/music/search', { q });
        ui.queue = (res.results || []).filter((r) => !ui.played.has(r.id));
        next = ui.queue[0];
      }
    } catch (e) { /* stop quietly */ }
    ui.following = false;
  }
  if (!ui.playing) return; // closed while searching
  if (!next) { ui.note = t('musicEnded'); updateText(); return; }
  startTrack(next);
  refresh();
}

export function musicCard() {
  if (!aiEnabled()) return h``;
  return h`<section class="card"><h2>🎵 ${t('musicTitle')}</h2>
    <div class="form"><input id="musicQ" class="grow" type="search" maxlength="100" placeholder="${t('musicPlaceholder')}" value="${ui.q}" data-input="music.query" data-enter="music.search" aria-label="${t('musicTitle')}">
      <button class="btn" data-act="music.search"${ui.busy ? h` disabled` : ''}>${ui.busy ? t('musicBusy') : t('musicSearch')}</button></div>
    <label class="check"><input type="checkbox" data-change="music.auto"${ui.auto ? h` checked` : ''}> ${t('musicAuto')}</label>
    ${ui.error ? h`<div class="err">${ui.error}</div>` : ''}
    ${ui.results.length ? h`<div class="music-grid">${ui.results.slice(0, SHOWN).map((r) => h`<button class="music-item${ui.playing && ui.playing.id === r.id ? ' on' : ''}" data-act="music.play" data-id="${r.id}">
      ${r.thumb ? h`<img alt="" loading="lazy" src="${r.thumb}">` : ''}<span class="mt">${r.title}</span><span class="muted small">${r.channel}</span>
      <span class="badge">${ui.playing && ui.playing.id === r.id ? '♪ ' + t('musicPlaying') : '▶ ' + t('musicPlay')}</span></button>`)}</div>` : ui.searched && !ui.busy && !ui.error ? h`<p class="muted">${t('musicNone')}</p>` : ''}
    <p class="muted small">${t('musicNote')}</p></section>`;
}

register('music', {
  query(el) { ui.q = el.value; },
  async search() {
    const q = (byId('musicQ') ? byId('musicQ').value : ui.q).trim();
    ui.q = q;
    if (q.length < 2 || ui.busy) return;
    const direct = parseYouTubeId(q);
    ui.busy = true; ui.error = ''; refresh();
    if (direct) { // a pasted link is checked by the server first: it must be public, embeddable, music and not age-restricted
      try {
        const res = await api('POST', '/api/music/check', { id: direct });
        if (res.ok) { ui.queue = []; ui.played = new Set(); startTrack({ id: res.id, title: res.title, channel: res.channel }); }
        else ui.error = t('musicLinkBlocked');
      } catch (e) { ui.error = e && e.status === 503 ? t('musicUnavailable') : t('musicErr'); }
      ui.busy = false; refresh();
      return;
    }
    try {
      const res = await api('POST', '/api/music/search', { q });
      ui.results = res.results || []; ui.searched = true; ui.played = new Set();
    } catch (e) {
      ui.results = [];
      ui.error = e && e.status === 422 ? t('musicBlocked') : e && e.status === 429 ? t('errLimit') : e && e.status === 503 ? t('musicUnavailable') : t('musicErr');
    }
    ui.busy = false; refresh();
  },
  play(el) {
    const i = ui.results.findIndex((x) => x.id === el.dataset.id);
    if (i < 0) return;
    ui.played = new Set();
    ui.queue = ui.results.slice(i + 1).concat(ui.results.slice(0, i)); // the rest of the search plays next, free of quota
    startTrack(ui.results[i]);
    refresh();
  },
  next() { playNext(true); },
  auto(el) {
    ui.auto = el.checked;
    try { localStorage.setItem(AUTO_KEY, ui.auto ? '1' : '0'); } catch (e) { /* ignore */ }
    updateText();
  },
  close() { ui.playing = null; ui.queue = []; ui.note = ''; ui.following = false; renderDock(); refresh(); },
});
