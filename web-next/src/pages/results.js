// Results (grades) tracking: partials, exams, quizzes and projects, with trends and what needs attention.
import { state, save } from '../store.js';
import { h, byId, uid, todayKey, isDateKey, dayDiff } from '../util.js';
import { t, subjectName, fmtDate, getLang } from '../i18n.js';
import { register, refresh } from '../actions.js';
import { subjectSelect } from '../ui.js';
import { gradeOf, subjectSummaries, overallAverage, attentionList, PASS_MARK } from '../calc.js';

const KINDS = ['partial', 'exam', 'quiz', 'project', 'other'];
const COLORS = ['#e0608a', '#7a5cc4', '#38b6e8', '#4cc38a', '#e3b341', '#f6a05c', '#d78be8', '#8a8f98'];
const ARROW = { up: '↗', down: '↘', flat: '→', none: '–' };
const ui = { focus: '', pre: null, error: '', lastMax: 10 };

export const num = (n) => new Intl.NumberFormat(getLang() === 'es' ? 'es-ES' : 'en-GB', { maximumFractionDigits: 1 }).format(Math.round(n * 10) / 10);
const cls = (g) => (g < PASS_MARK ? 'hot' : g >= 7 ? 'good' : '');
const trend = (dir) => h`<span class="trend ${dir}" title="${t('trend.' + dir)}" aria-label="${t('trend.' + dir)}">${ARROW[dir]}</span>`;

function stat(label, value, sub, c) {
  return h`<div class="card stat"><div class="stat-h"><span>${label}</span></div><div class="stat-v ${c || ''}">${value}</div><div class="muted small">${sub}</div></div>`;
}

// opts.focus: show one subject only. opts.staticLegend: legend without buttons (used by the parent view).
export function trendChart(sums, opts = {}) {
  const focus = opts.focus !== undefined ? opts.focus : ui.focus;
  const shown = focus ? sums.filter((s) => s.subject === focus) : sums;
  const all = shown.flatMap((s) => s.list);
  if (!all.length) return h``;
  const W = 600, H = 226, x0 = 34, x1 = 588, y0 = 12, y1 = 196;
  const dates = all.map((r) => r.date).sort();
  const first = dates[0], last = dates[dates.length - 1], span = Math.max(1, dayDiff(first, last));
  const X = (d) => (first === last ? (x0 + x1) / 2 : x0 + (dayDiff(first, d) / span) * (x1 - x0));
  const Y = (g) => y1 - (Math.max(0, Math.min(10, g)) / 10) * (y1 - y0);
  return h`<svg class="gchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('trendChart')}">
    ${[0, 5, 10].map((g) => h`<line x1="${x0}" x2="${x1}" y1="${Y(g)}" y2="${Y(g)}" class="${g === PASS_MARK ? 'pass' : 'grid'}"/><text x="${x0 - 6}" y="${Y(g) + 4}" class="axis" text-anchor="end">${g}</text>`)}
    <text x="${x0}" y="${H - 6}" class="axis">${fmtDate(first, { day: 'numeric', month: 'short' })}</text>
    ${first !== last ? h`<text x="${x1}" y="${H - 6}" class="axis" text-anchor="end">${fmtDate(last, { day: 'numeric', month: 'short' })}</text>` : ''}
    ${shown.map((s) => {
      const color = COLORS[sums.indexOf(s) % COLORS.length];
      const pts = s.list.map((r) => [X(r.date), Y(gradeOf(r)), r]);
      return h`${pts.length > 1 ? h`<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>` : ''}
        ${pts.map((p) => h`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="${color}"><title>${subjectName(s.subject)} · ${t('kind.' + p[2].kind)} · ${num(p[2].score)}/${num(p[2].max)}</title></circle>`)}`;
    })}</svg>
    <div class="legend-row">${sums.map((s, i) => opts.staticLegend ? h`<span class="chip"><i style="background:${COLORS[i % COLORS.length]}"></i>${subjectName(s.subject)}</span>` : h`<button class="chip${focus === s.subject ? ' on' : ''}" data-act="results.focus" data-subject="${s.subject}"><i style="background:${COLORS[i % COLORS.length]}"></i>${subjectName(s.subject)}</button>`)}</div>`;
}

export const results = {
  id: 'results', icon: '📝', titleKey: 'nav.results',
  view() {
    const today = todayKey(), rs = state.results;
    const sums = subjectSummaries(rs).sort((a, b) => b.avg - a.avg);
    const attention = attentionList(rs, state.sessions, state.exams, today);
    const overall = overallAverage(rs);
    const latest = rs.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    const missing = state.exams.filter((e) => e.date <= today && !rs.some((r) => r.subject === e.subject && r.date === e.date)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const pre = ui.pre || {};
    const best = sums[0];
    return h`
    <div class="page-head"><div><h1>${t('nav.results')}</h1><p class="muted">${t('resultsSub')}</p></div></div>
    <section class="card"><h2>${t('addResult')}</h2>
      <div class="form">
        ${subjectSelect('rsSubject', pre.subject || state.settings.subjects[0])}
        <select id="rsKind" aria-label="${t('kind')}">${KINDS.map((k) => h`<option value="${k}"${(pre.kind || 'partial') === k ? h` selected` : ''}>${t('kind.' + k)}</option>`)}</select>
        <input id="rsTitle" type="text" maxlength="80" placeholder="${t('resultTitle')}" value="${pre.title || ''}">
        <input id="rsDate" type="date" value="${pre.date || today}" aria-label="${t('date')}">
        <input id="rsScore" type="text" inputmode="decimal" size="5" placeholder="${t('grade')}" aria-label="${t('grade')}" data-enter="results.add">
        <label class="inline">${t('outOf')} <input id="rsMax" type="text" inputmode="decimal" size="3" value="${ui.lastMax}" data-enter="results.add"></label>
        <button class="btn" data-act="results.add">+ ${t('add')}</button>
      </div>
      ${ui.error ? h`<div class="err">${ui.error}</div>` : ''}
      ${missing.length ? h`<p class="muted small">${t('pastExams')}</p>${missing.map((e) => h`<button class="chip" data-act="results.fromExam" data-id="${e.id}">${subjectName(e.subject)} · ${fmtDate(e.date)}${e.title ? ' · ' + e.title : ''} +</button>`)}` : ''}
    </section>
    ${rs.length ? h`
    <div class="stats4">
      ${stat(t('overallAvg'), num(overall), t('passMarkNote', { n: PASS_MARK }), cls(overall))}
      ${stat(t('latestResult'), latest ? num(gradeOf(latest)) : '–', latest ? subjectName(latest.subject) + ' · ' + fmtDate(latest.date) : '', latest ? cls(gradeOf(latest)) : '')}
      ${stat(t('bestSubject'), best ? num(best.avg) : '–', best ? subjectName(best.subject) : '', 'good')}
      ${stat(t('needsMost'), attention[0] ? num(attention[0].avg) : '–', attention[0] ? subjectName(attention[0].subject) : t('allGood'), attention[0] ? cls(attention[0].avg) : 'good')}
    </div>
    <section class="card"><h2>⚠ ${t('needsAttention')}</h2><p class="muted small">${t('needsAttentionSub')}</p>
      ${attention.length ? attention.map((a) => h`<div class="attn"><div class="row-line"><span><strong>${subjectName(a.subject)}</strong> ${trend(a.dir)}</span><span class="${cls(a.avg)}">${t('avgShort')} ${num(a.avg)} · ${t('lastShort')} ${num(a.last)}</span></div>
        <ul class="why">${a.reasons.map((r) => h`<li>${t('why.' + r, { n: a.exam ? dayDiff(today, a.exam.date) : 0, min: a.minutes })}</li>`)}</ul>
        <div class="form"><a class="btn ghost small" href="#/plan">${t('nav.plan')}</a><a class="btn ghost small" href="#/cards">${t('nav.cards')}</a><a class="btn ghost small" href="#/tutor">${t('nav.tutor')}</a><a class="btn ghost small" href="#/timer">${t('nav.timer')}</a></div></div>`) : h`<p class="good">✓ ${t('nothingToWorry')}</p>`}
    </section>
    <section class="card"><h2>${t('trends')}</h2><p class="muted small">${t('trendsSub')}</p>${trendChart(sums)}</section>
    <section class="card"><h2>${t('bySubject')}</h2><div class="tablewrap"><table>
      <thead><tr><th>${t('subject')}</th><th>${t('results')}</th><th>${t('average')}</th><th>${t('lastShort')}</th><th>${t('trendLabel')}</th><th>${t('best')}</th><th>${t('worst')}</th></tr></thead>
      <tbody>${sums.map((s) => h`<tr><td>${subjectName(s.subject)}</td><td>${s.count}</td><td class="${cls(s.avg)}"><strong>${num(s.avg)}</strong></td><td class="${cls(s.last)}">${num(s.last)}</td><td>${trend(s.dir)}</td><td>${num(s.best)}</td><td>${num(s.worst)}</td></tr>`)}</tbody></table></div></section>
    <section class="card"><h2>${t('allResults')}</h2><div class="tablewrap"><table>
      <thead><tr><th>${t('date')}</th><th>${t('subject')}</th><th>${t('kind')}</th><th>${t('title')}</th><th>${t('grade')}</th><th></th></tr></thead>
      <tbody>${rs.slice().sort((a, b) => b.date.localeCompare(a.date)).map((r) => h`<tr><td>${fmtDate(r.date)}</td><td>${subjectName(r.subject)}</td><td>${t('kind.' + r.kind)}</td><td>${r.title}</td>
        <td class="${cls(gradeOf(r))}"><strong>${num(r.score)}</strong>${r.max !== 10 ? h` <span class="muted small">/ ${num(r.max)}</span>` : ''}</td><td><button class="link" data-act="results.del" data-id="${r.id}">${t('delete')}</button></td></tr>`)}</tbody></table></div></section>`
      : h`<section class="card"><p class="muted">${t('noResults')}</p></section>`}`;
  },
};

const toNum = (s) => parseFloat(String(s).replace(',', '.'));

register('results', {
  add() {
    const date = byId('rsDate').value;
    const score = toNum(byId('rsScore').value);
    let max = toNum(byId('rsMax').value);
    if (!isFinite(max) || max <= 0) max = 10;
    max = Math.min(100, max);
    if (!isDateKey(date) || !isFinite(score) || score < 0) { ui.error = t('badGrade'); refresh(); return; }
    if (score > max) { ui.error = t('overMax'); refresh(); return; }
    state.results.push({
      id: uid(), subject: byId('rsSubject').value, kind: byId('rsKind').value, title: byId('rsTitle').value.trim().slice(0, 80),
      date, score: Math.round(score * 10) / 10, max: Math.round(max * 10) / 10,
    });
    ui.pre = null; ui.error = ''; // "out of" goes back to 10 each time, so one grade on another scale never leaks into the next
    save('results'); refresh();
  },
  fromExam(el) {
    const e = state.exams.find((x) => x.id === el.dataset.id);
    if (!e) return;
    ui.pre = { subject: e.subject, date: e.date, title: e.title, kind: 'exam' };
    refresh();
    const s = byId('rsScore'); if (s) s.focus();
  },
  del(el) {
    if (!window.confirm(t('confirmDelete'))) return;
    state.results = state.results.filter((r) => r.id !== el.dataset.id);
    save('results'); refresh();
  },
  focus(el) { ui.focus = ui.focus === el.dataset.subject ? '' : el.dataset.subject; refresh(); },
});
