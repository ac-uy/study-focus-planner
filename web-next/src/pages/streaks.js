import { state } from '../store.js';
import { h, todayKey, addDays } from '../util.js';
import { t, weekdayShort, fmtDate } from '../i18n.js';
import { streakInfo, minutesByDate } from '../calc.js';
import { parseKey } from '../util.js';

export const streaks = {
  id: 'streaks', icon: '🔥', titleKey: 'nav.streaks',
  view() {
    const st = streakInfo(state.sessions);
    const by = minutesByDate(state.sessions);
    const today = todayKey();
    const days = [];
    for (let i = 27; i >= 0; i--) days.push(addDays(today, -i));
    return h`<div class="page-head"><div><h1>${t('nav.streaks')}</h1><p class="muted">${t('streaksSub')}</p></div></div>
    <div class="grid2">
      <section class="card"><h2>${t('myStreak')}</h2><p class="muted small">${t('streakDef')}</p>
        <div class="big">🔥 ${t('nDays', { n: st.current })}</div>
        <p class="muted small">${st.todayDone ? t('streakTodayDone') : t('streakTodayNot')}</p></section>
      <section class="card"><h2>${t('bestStreakTitle')}</h2><p class="muted small">${t('bestStreakSub')}</p>
        <div class="big">🏅 ${t('nDays', { n: st.best })}</div></section>
    </div>
    <section class="card"><h2>${t('last28')}</h2>
      <div class="dots">${days.map((k) => h`<div class="dot${by[k] ? ' on' : ''}${k === today ? ' today' : ''}" title="${fmtDate(k)}: ${by[k] || 0} min"><span>${weekdayShort((parseKey(k).getDay() + 6) % 7).slice(0, 1)}</span></div>`)}</div>
    </section>`;
  },
};
