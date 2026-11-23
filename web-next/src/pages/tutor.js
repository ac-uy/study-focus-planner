// Study tutor: explains and guides with hints, but never hands over the answer (enforced in the server prompt).
import { state, save, levelLabel } from '../store.js';
import { h, byId } from '../util.js';
import { t, getLang, subjectName } from '../i18n.js';
import { register } from '../actions.js';
import { api, aiEnabled } from '../api.js';
import { subjectSelect } from '../ui.js';
import { fileToJpeg } from '../image.js';

export const chat = { msgs: [], busy: false, error: '', context: '', about: '', pending: [], subject: '', autoStart: '' };
const MAX_PENDING = 3, MAX_SENT_IMAGES = 4;

export function startWithContext(task, review) {
  const parts = ['Task: ' + task.title, 'Subject: ' + subjectName(task.subject), 'Student\'s work (transcribed): ' + (review.transcription || '').slice(0, 2000), 'Review verdict: ' + (review.verdict || '')];
  (review.corrections || []).forEach((c) => parts.push('Issue: ' + c.issue + ' | Correct information: ' + c.fix));
  (review.additions || []).forEach((a) => parts.push('Missing: ' + a));
  chat.context = parts.join('\n').slice(0, 4000);
  chat.about = task.title; chat.msgs = []; chat.error = ''; chat.pending = []; chat.subject = task.subject;
  chat.autoStart = t('chatOpener', { title: task.title });
}

function logHtml() {
  return h`<div class="msg bot">${t('chatWelcome')}</div>
    ${chat.about ? h`<div class="muted small center">${t('chatAbout', { title: chat.about })}</div>` : ''}
    ${chat.msgs.map((m) => h`<div class="msg ${m.role === 'user' ? 'me' : 'bot'}">${(m.images || []).map((b) => h`<img alt="" src="data:image/jpeg;base64,${b}">`)}${m.images && m.images.length ? h`<br>` : ''}${m.content}</div>`)}
    ${chat.busy ? h`<div class="msg bot muted">${t('thinking')}</div>` : ''}
    ${chat.error ? h`<div class="msg errmsg">${chat.error}</div>` : ''}`;
}
function pendingHtml() {
  return h`${chat.pending.map((b, i) => h`<div class="thumb"><img alt="" src="data:image/jpeg;base64,${b}"><button type="button" data-act="tutor.pendDel" data-i="${i}" aria-label="${t('remove')}">×</button></div>`)}`;
}
export function renderLog() {
  const log = byId('chatLog');
  if (!log) return;
  log.innerHTML = logHtml().s;
  log.scrollTop = log.scrollHeight;
  const p = byId('chatPending');
  if (p) { p.hidden = !chat.pending.length; p.innerHTML = pendingHtml().s; }
  const send = byId('chatSend'); if (send) send.disabled = chat.busy;
  const att = byId('chatAttach'); if (att) att.disabled = chat.busy || chat.pending.length >= MAX_PENDING;
}

function payloadMessages() {
  let budget = MAX_SENT_IMAGES;
  const out = [], recent = chat.msgs.slice(-12);
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i], o = { role: m.role, content: m.content };
    if (m.images && m.images.length && budget > 0) { o.images = m.images.slice(0, budget); budget -= o.images.length; }
    out.unshift(o);
  }
  return out;
}

async function send(text) {
  const imgs = chat.pending.slice();
  if (!text && imgs.length) text = t('chatImgDefault');
  if (!text || chat.busy || !aiEnabled()) return;
  chat.pending = [];
  chat.msgs.push({ role: 'user', content: text, images: imgs });
  if (chat.msgs.length > 40) chat.msgs = chat.msgs.slice(-40);
  const input = byId('chatInput'); if (input) input.value = '';
  chat.busy = true; chat.error = ''; renderLog();
  try {
    const res = await api('POST', '/api/ai/chat', {
      messages: payloadMessages(), subject: chat.subject ? subjectName(chat.subject) : '', lang: getLang(),
      level: levelLabel(state.settings.level), context: chat.context,
    });
    chat.msgs.push({ role: 'assistant', content: String(res.reply || '') });
    state.counters.chats++; save('counters');
  } catch (e) { chat.error = e && e.status === 429 ? t('errLimit') : t('chatErr'); }
  chat.busy = false; renderLog();
}

export const tutor = {
  id: 'tutor', icon: '🧑‍🏫', titleKey: 'nav.tutor',
  view() {
    return h`<div class="page-head"><div><h1>${t('nav.tutor')}</h1><p class="muted">${t('tutorSub')}</p></div></div>
    ${aiEnabled() ? h`<section class="card chat">
      <div id="chatLog" class="chat-log" aria-live="polite"></div>
      <div id="chatPending" class="thumbs" hidden></div>
      <div class="form">
        ${subjectSelect('chatSubject', chat.subject, { any: t('anySubject'), change: 'tutor.subject' })}
        <button class="btn ghost" id="chatAttach" type="button" data-act="tutor.attach" title="${t('chatAttach')}" aria-label="${t('chatAttach')}">📎</button>
        <input type="file" id="chatFile" accept="image/*" multiple hidden data-change="tutor.files">
        <input id="chatInput" class="grow" type="text" maxlength="1500" placeholder="${t('chatPlaceholder')}" data-enter="tutor.send">
        <button class="btn" id="chatSend" data-act="tutor.send">${t('send')}</button>
        <button class="btn ghost" data-act="tutor.new">${t('newChat')}</button>
      </div></section>` : h`<section class="card"><p class="muted">${t('needOnline')}</p></section>`}`;
  },
  mount() {
    renderLog();
    if (chat.autoStart) { const txt = chat.autoStart; chat.autoStart = ''; send(txt); }
  },
};

register('tutor', {
  send() { const el = byId('chatInput'); send(el ? el.value.trim() : ''); },
  new() { chat.msgs = []; chat.error = ''; chat.context = ''; chat.about = ''; chat.pending = []; renderLog(); },
  subject(el) { chat.subject = el.value; },
  attach() { byId('chatFile').click(); },
  async files(el) {
    const room = MAX_PENDING - chat.pending.length;
    const list = Array.prototype.slice.call(el.files || [], 0, Math.max(0, room));
    chat.error = '';
    const res = await Promise.all(list.map((f) => fileToJpeg(f, 1568, 0.8).then((u) => u.split(',')[1], () => null)));
    res.forEach((b) => { if (b) chat.pending.push(b); else chat.error = t('imageErr'); });
    el.value = '';
    renderLog();
  },
  pendDel(el) { chat.pending.splice(+el.dataset.i, 1); renderLog(); },
});
