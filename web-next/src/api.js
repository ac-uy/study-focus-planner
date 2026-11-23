// Cognito sign-in (authorization code + PKCE), authenticated API calls and cloud sync.
import {
  meta, SECTIONS, exportSection, applySection, setPusher, hasUserData, migrateV1, flushLocal,
} from './store.js';

const ROLE_KEY = 'sp2-role';
function storedRole() { try { const r = localStorage.getItem(ROLE_KEY); return r === 'parent' || r === 'none' ? r : 'child'; } catch (e) { return 'child'; } }
function storeRole(r) { try { localStorage.setItem(ROLE_KEY, r); } catch (e) { /* ignore */ } }

// role: 'child' (the student app), 'parent' (family view) or 'none' (account without a role). me: the answer of /api/me.
export const net = { cloud: false, ready: false, syncError: false, email: '', cfg: null, role: storedRole(), me: null, onChange: () => {} };
const AUTH_KEY = 'sp2-auth';

function readAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch (e) { return null; } }
function writeAuth(a) { try { if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a)); else localStorage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ } }
function b64url(bytes) {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randomString(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); }
function jwtClaims(tok) {
  try { return JSON.parse(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return {}; }
}

async function startLogin() {
  const verifier = randomString(48), st = randomString(16);
  sessionStorage.setItem('sp2-pkce-verifier', verifier);
  sessionStorage.setItem('sp2-pkce-state', st);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const q = new URLSearchParams({
    response_type: 'code', client_id: net.cfg.clientId, redirect_uri: net.cfg.redirectUri,
    scope: 'openid email', code_challenge_method: 'S256', code_challenge: b64url(new Uint8Array(hash)), state: st,
  });
  location.href = net.cfg.cognitoDomain + '/oauth2/authorize?' + q.toString();
  return new Promise(() => {});
}
async function tokenRequest(params) {
  const r = await fetch(net.cfg.cognitoDomain + '/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString(),
  });
  if (!r.ok) throw new Error('token');
  return r.json();
}
function storeTokens(tok, prev) {
  const a = { idToken: tok.id_token, refreshToken: tok.refresh_token || (prev && prev.refreshToken), exp: Date.now() + (tok.expires_in || 3600) * 1000 };
  writeAuth(a);
  net.email = jwtClaims(a.idToken).email || net.email;
  return a;
}
async function handleCallback(code, returned) {
  const verifier = sessionStorage.getItem('sp2-pkce-verifier');
  if (!verifier || returned !== sessionStorage.getItem('sp2-pkce-state')) throw new Error('state');
  const tok = await tokenRequest({
    grant_type: 'authorization_code', client_id: net.cfg.clientId, code, redirect_uri: net.cfg.redirectUri, code_verifier: verifier,
  });
  sessionStorage.removeItem('sp2-pkce-verifier'); sessionStorage.removeItem('sp2-pkce-state');
  return storeTokens(tok);
}
async function getToken() {
  const a = readAuth();
  if (!a) throw new Error('no-auth');
  if (a.exp - 60000 > Date.now()) return a.idToken;
  if (!a.refreshToken) throw new Error('no-auth');
  try {
    const tok = await tokenRequest({ grant_type: 'refresh_token', client_id: net.cfg.clientId, refresh_token: a.refreshToken });
    return storeTokens(tok, a).idToken;
  } catch (e) { writeAuth(null); throw new Error('no-auth'); }
}

export async function api(method, path, body) {
  try {
    const token = await getToken();
    const r = await fetch(net.cfg.apiUrl + path, {
      method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) { const e = new Error('http'); e.status = r.status; throw e; }
    return await r.json();
  } catch (e) {
    if (e && e.message === 'no-auth') startLogin();
    throw e;
  }
}

export function signOut() {
  writeAuth(null);
  try { localStorage.removeItem('study-planner-v2'); localStorage.removeItem(ROLE_KEY); } catch (e) { /* ignore */ }
  location.href = net.cfg.cognitoDomain + '/logout?client_id=' + encodeURIComponent(net.cfg.clientId) + '&logout_uri=' + encodeURIComponent(net.cfg.redirectUri);
}

// ----- sync: one DynamoDB item per section, newest timestamp wins -----
const timers = {};
function schedulePush(section) {
  clearTimeout(timers[section]);
  timers[section] = setTimeout(() => push(section), 800);
}
async function push(section) {
  const body = { data: exportSection(section), updatedAt: meta[section] };
  if (JSON.stringify(body).length > 340 * 1024) { net.syncError = 'size'; net.onChange(); return; }
  try { await api('PUT', '/api/v2/' + section, body); net.syncError = false; } catch (e) { net.syncError = true; }
  net.onChange();
}

async function pullAll() {
  const res = await api('GET', '/api/v2');
  const remote = (res && res.sections) || {};
  const toPush = [];
  let changed = false;
  SECTIONS.forEach((s) => {
    const r = remote[s];
    if (r && r.updatedAt > meta[s]) { applySection(s, r.data); meta[s] = r.updatedAt; changed = true; }
    else if (meta[s] > ((r && r.updatedAt) || 0)) toPush.push(s);
  });
  // First sign-in on the new version: bring over what she saved in the first version.
  if (!remote.core && !hasUserData()) {
    try {
      const old = await api('GET', '/api/data');
      if (old && old.data && migrateV1(old.data)) changed = true;
    } catch (e) { /* nothing to migrate */ }
  }
  flushLocal();
  toPush.forEach((s) => push(s));
  return changed;
}

// Asks the server who this account is. A parent gets the family view, an account without a role gets a notice,
// and when the question cannot be answered (offline, server error) the student app keeps working as before.
async function loadMe() {
  try {
    const me = await api('GET', '/api/me');
    net.me = me; net.role = me.role === 'parent' ? 'parent' : 'child';
  } catch (e) {
    if (e && e.status === 403) { net.me = null; net.role = 'none'; }
    else if (e && e.message === 'no-auth') throw e;
    else return;
  }
  storeRole(net.role);
}
export async function reloadMe() {
  net.me = await api('GET', '/api/me');
  net.role = net.me.role === 'parent' ? 'parent' : 'child';
}

// Returns true when remote data replaced local data (so the caller should re-render).
export async function startCloud() {
  if (location.protocol === 'file:') return false;
  try {
    const r = await fetch('config.json', { cache: 'no-store' });
    if (!r.ok) { net.role = 'child'; return false; }
    const cfg = await r.json();
    if (!cfg || !cfg.clientId) { net.role = 'child'; return false; }
    net.cfg = cfg;
  } catch (e) { net.role = 'child'; return false; }
  net.cloud = true;
  const p = new URLSearchParams(location.search), code = p.get('code');
  if (code) {
    try { await handleCallback(code, p.get('state')); history.replaceState(null, '', location.pathname + location.hash); }
    catch (e) { history.replaceState(null, '', location.pathname + location.hash); await startLogin(); return false; }
  }
  const auth = readAuth();
  if (!auth) { await startLogin(); return false; }
  net.email = jwtClaims(auth.idToken).email || '';
  try {
    await loadMe();
    if (net.role !== 'child') { net.ready = true; net.onChange(); return false; } // parents and accounts without a role do not sync study data
    setPusher(schedulePush);
    const changed = await pullAll();
    net.ready = true;
    net.onChange();
    return changed;
  } catch (e) {
    if (!(e && e.message === 'no-auth')) { net.syncError = true; net.onChange(); }
    return false;
  }
}

export const aiEnabled = () => net.cloud && net.ready;
