// Shared view fragments: charts, progress bars, selects.
import { h, raw } from './util.js';
import { t, subjectName } from './i18n.js';
import { subjectsWithOther } from './store.js';

export function bar(pct) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return h`<div class="bar"><div style="width:${p}%"></div></div>`;
}

export function barChart(items) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return h`<div class="chart">${items.map((i) => h`<div class="col"><div class="n">${i.value || ''}</div><div class="b${i.value ? '' : ' zero'}" style="height:${i.value ? Math.max(6, Math.round((i.value / max) * 100)) : 4}px"></div><div class="d">${i.label}</div></div>`)}</div>`;
}

export function hBars(items) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return h`<div class="hbars">${items.map((i) => h`<div class="hrow"><span class="hl">${i.label}</span><span class="hb"><span style="width:${Math.max(3, Math.round((i.value / max) * 100))}%"></span></span><span class="hv">${i.text}</span></div>`)}</div>`;
}

const PALETTE = ['#e0608a', '#7a5cc4', '#38b6e8', '#4cc38a', '#e3b341', '#f6a05c', '#d78be8', '#8a8f98'];
export function donut(items) {
  const total = items.reduce((a, i) => a + i.value, 0);
  if (!total) return h`<div class="muted">${t('noData')}</div>`;
  let acc = 0;
  const stops = items.map((i, idx) => {
    const from = (acc / total) * 100; acc += i.value;
    return PALETTE[idx % PALETTE.length] + ' ' + from.toFixed(2) + '% ' + ((acc / total) * 100).toFixed(2) + '%';
  }).join(',');
  return h`<div class="donutwrap"><div class="donut" style="background:conic-gradient(${raw(stops)})"><span>${items.reduce((a, i) => a + i.value, 0)}</span></div>
    <ul class="legend">${items.map((i, idx) => h`<li><i style="background:${PALETTE[idx % PALETTE.length]}"></i>${i.label}<b>${i.text || i.value}</b></li>`)}</ul></div>`;
}

export function lineChart(points) {
  const W = 300, H = 90, max = Math.max(1, ...points);
  const step = points.length > 1 ? W / (points.length - 1) : W;
  const xy = points.map((v, i) => [Math.round(i * step), Math.round(H - 6 - (v / max) * (H - 14))]);
  const line = xy.map((p) => p.join(',')).join(' ');
  return h`<svg class="line" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"><polyline points="${line + ' ' + W + ',' + H + ' 0,' + H}" class="area"/><polyline points="${line}" class="stroke"/></svg>`;
}

export function subjectSelect(id, value, opts = {}) {
  const subs = subjectsWithOther(value);
  return h`<select id="${id}"${opts.change ? raw(' data-change="' + opts.change + '"') : ''}${opts.attrs ? raw(' ' + opts.attrs) : ''}>${opts.any ? h`<option value="">${opts.any}</option>` : ''}${subs.map((s) => h`<option value="${s}"${s === value ? raw(' selected') : ''}>${subjectName(s)}</option>`)}</select>`;
}

export const importanceLabel = (v) => t('imp.' + v);
