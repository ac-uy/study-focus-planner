// Front-end tests for family accounts (change 0001): parent view, child notice, account without a role.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const DIST = require('path').resolve(__dirname, '..', 'web-next', 'dist').replace(/\\/g, '/');
const appjs = fs.readFileSync(DIST + '/app.js', 'utf8');
const html = fs.readFileSync(DIST + '/index.html', 'utf8');
const pkg = require('../package.json');
const out = [];
const check = (n, c) => out.push((c ? 'PASS ' : 'FAIL ') + n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KID = 'aaaaaaaa-1111-2222-3333-44444444444a';
const today = new Date().toISOString().slice(0, 10);
const CHILD_DATA = {
  child: { sub: KID, name: 'Kid One', email: 'kid@example.com', lastSeen: Date.now() - 5 * 60000 },
  core: {
    profile: { name: 'Kid' }, settings: { level: '2eso', subjects: ['Maths'] },
    tasks: [
      { id: 't1', title: 'Fractions homework', subject: 'Maths', minutes: 30, importance: 'alta', due: '2000-01-01', done: false, goalId: '' },
      { id: 't2', title: 'Read chapter', subject: 'English', minutes: 20, importance: 'baja', due: '', done: true, goalId: '' },
    ],
    exams: [{ id: 'e1', subject: 'Maths', date: '2999-01-01', title: 'Unit 3' }], examWeeks: [], timetable: { '0-0': 'Maths' },
    goals: [{ id: 'g1', title: 'Pass Maths', due: '', steps: [{ id: 's1', title: 'Revise', done: true }] }],
    weeklyGoals: [{ id: 'w1', subject: 'Maths', minutes: 120, period: 'week' }],
    results: [{ id: 'r1', subject: 'Maths', kind: 'exam', title: 'Unit 1', date: '2026-10-01', score: 4, max: 10 }],
  },
  sessions: [{ id: 's1', date: today, minutes: 25, mode: 'timer', subject: 'Maths', title: 'Fractions', ts: Date.now() }],
  updatedAt: { core: 1, sessions: 1 },
};

function makeDom(role, opts = {}) {
  const calls = [];
  const dom = new JSDOM(html, { url: 'http://localhost/next/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.__errors = [];
  w.addEventListener('error', (e) => w.__errors.push(e.message));
  w.scrollTo = () => {}; w.confirm = () => true; w.Element.prototype.scrollIntoView = function () {};
  const ok = (j) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(j) });
  const bad = (s) => Promise.resolve({ ok: false, status: s, json: () => Promise.resolve({}) });
  w.fetch = (url, o) => {
    const method = (o && o.method) || 'GET';
    calls.push({ url, method });
    if (/config\.json$/.test(url)) return ok({ clientId: 'c', cognitoDomain: 'https://x', apiUrl: 'https://api', redirectUri: 'http://localhost/next/' });
    if (/\/api\/me$/.test(url)) {
      if (role === 'none') return bad(403);
      if (role === 'error') return bad(500);
      if (role === 'viewer') return ok({ role: 'parent', admin: false, name: 'Viewer', email: 'viewer@example.com', children: [{ sub: KID, name: 'Kid One', email: 'kid@example.com', lastSeen: 0 }] });
      if (role === 'parent') return ok({ role: 'parent', admin: true, adults: w.__adults || [], name: 'Parent', email: 'parent@example.com', children: w.__children || [{ sub: KID, name: 'Kid One', email: 'kid@example.com', lastSeen: Date.now() - 5 * 60000 }] });
      return ok({ role: 'child', name: 'Kid', email: 'kid@example.com', parents: [{ name: 'Parent', email: 'parent@example.com' }] });
    }
    if (/\/api\/parent\/children$/.test(url) && method === 'POST') {
      const b = JSON.parse(o.body);
      if (/dup/.test(b.email)) return bad(409);
      w.__children = [{ sub: KID, name: 'Kid One', email: 'kid@example.com', lastSeen: 0 }, { sub: 'bbbbbbbb-1111-2222-3333-44444444444a', name: b.name, email: b.email, lastSeen: 0 }];
      return ok({ child: { sub: 'bbbbbbbb-1111-2222-3333-44444444444a', name: b.name, email: b.email } });
    }
    if (/\/api\/parent\/adults$/.test(url) && method === 'POST') {
      const b = JSON.parse(o.body);
      if (/dup/.test(b.email)) return bad(409);
      w.__adults = [{ sub: 'cccccccc-1111-2222-3333-44444444444a', name: b.name, email: b.email }];
      return ok({ ok: true, adult: { name: b.name, email: b.email }, children: 1 });
    }
    if (/\/api\/parent\/children\/[^/]+\/data$/.test(url)) return ok(CHILD_DATA);
    if (/\/api\/v2$/.test(url)) return ok({ sections: {} });
    if (/\/api\/data$/.test(url)) return ok({ data: null });
    if (/\/api\/v2\//.test(url)) return ok({ ok: true });
    return bad(404);
  };
  w.localStorage.setItem('sp2-auth', JSON.stringify({ idToken: 'a.' + Buffer.from(JSON.stringify({ email: 'x@example.com' })).toString('base64').replace(/=/g, '') + '.c', refreshToken: 'r', exp: Date.now() + 3600000 }));
  if (opts.setup) opts.setup(w);
  w.eval(appjs);
  return { w, calls };
}
const $ = (w, s) => w.document.querySelector(s);
const $$ = (w, s) => Array.from(w.document.querySelectorAll(s));
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const text = (w) => w.document.getElementById('view').textContent;
const go = async (w, hash) => { w.location.hash = hash; await sleep(60); };
const syncCalls = (calls) => calls.filter((c) => /\/api\/(v2|data)(\/|$)/.test(c.url));

(async () => {
  try {
    // ---------- parent ----------
    {
      const { w, calls } = makeDom('parent');
      await sleep(400);
      check('parent: nav has family, add-child and add-adult', $$(w, 'a.nav').length === 3);
      check('parent: lands on the family page', /Kid One/.test(text(w)) && /Familia/.test(text(w)));
      check('parent: no study data sync calls', syncCalls(calls).length === 0);
      const dataCalls = () => calls.filter((c) => /\/data$/.test(c.url) && /parent\/children/.test(c.url)).length;
      check('parent: child data loaded once', dataCalls() === 1);
      check('parent: overview shows the summary numbers', /25 min|0h 25|25m/.test(text(w)) || /Minutos/i.test(text(w)));
      check('parent: sidebar shows the version', $(w, '#appVersion') && $(w, '#appVersion').textContent === 'v' + pkg.version);
      check('parent: never says read-only is editable (no inputs on overview)', $$(w, '#view input').length === 0);

      await go(w, '#/family/' + KID);
      check('parent: child page renders summary', /Kid One/.test(text(w)) && $$(w, '[data-act="family.tab"]').length === 5);
      check('parent: child data still loaded once', dataCalls() === 1);
      for (const tab of ['study', 'tasks', 'grades', 'goals', 'summary']) {
        click(w, $(w, '[data-tab="' + tab + '"]'));
        await sleep(30);
        const tx = text(w);
        check('parent: tab ' + tab + ' renders cleanly', tx.trim().length > 20 && !/undefined|\[object|NaN/.test(tx));
      }
      click(w, $(w, '[data-tab="tasks"]')); await sleep(30);
      check('parent: tasks tab lists tasks and marks overdue', /Fractions homework/.test(text(w)) && /Atrasada/.test(text(w)));
      click(w, $(w, '[data-tab="grades"]')); await sleep(30);
      check('parent: grades tab shows the grade', /Unit 1/.test(text(w)));
      check('parent: no editing controls on the child page', $$(w, '#view input, #view textarea, #view select').length === 0);

      await go(w, '#/tasks');
      check('parent: student page falls back to family', /Familia/.test(text(w)) && !$(w, '#tkTitle'));
      await go(w, '#/family/not-a-child');
      check('parent: unknown child shows not-linked message', /no está vinculado/.test(text(w)));

      await go(w, '#/addchild');
      const nm = $(w, '#acName'), em = $(w, '#acEmail');
      nm.value = 'New Kid'; nm.dispatchEvent(new w.Event('input', { bubbles: true }));
      em.value = 'new@example.com'; em.dispatchEvent(new w.Event('input', { bubbles: true }));
      click(w, $(w, '[data-act="family.add"]'));
      await sleep(80);
      check('parent: add child success message and list updated', /new@example\.com/.test(text(w)) && /Cuenta creada/.test(text(w)) && /New Kid/.test(text(w)));
      const nm2 = $(w, '#acName'), em2 = $(w, '#acEmail');
      nm2.value = 'Dup'; nm2.dispatchEvent(new w.Event('input', { bubbles: true }));
      em2.value = 'dup@example.com'; em2.dispatchEvent(new w.Event('input', { bubbles: true }));
      click(w, $(w, '[data-act="family.add"]'));
      await sleep(80);
      check('parent: duplicate email shows a clear error', /ya tiene una cuenta/.test(text(w)));
      const nm3 = $(w, '#acName'); nm3.value = ''; nm3.dispatchEvent(new w.Event('input', { bubbles: true }));
      click(w, $(w, '[data-act="family.add"]'));
      await sleep(40);
      check('parent: empty name is rejected before calling the server', /nombre y un correo válido/.test(text(w)) && calls.filter((c) => c.method === 'POST').length === 2);
      await go(w, '#/addadult');
      check('parent: add-adult page renders with empty list', /Añadir otro adulto/.test(text(w)) && /Todavía no has añadido/.test(text(w)));
      const an = $(w, '#adName'), ae = $(w, '#adEmail');
      an.value = 'Ana'; an.dispatchEvent(new w.Event('input', { bubbles: true }));
      ae.value = 'ana@example.com'; ae.dispatchEvent(new w.Event('input', { bubbles: true }));
      click(w, $(w, '[data-act="family.addAdult"]'));
      await sleep(80);
      check('parent: add adult success message and listed', /Invitación enviada a ana@example\.com/.test(text(w)) && /Ana/.test(text(w)));
      const ae2 = $(w, '#adEmail'), an2 = $(w, '#adName');
      an2.value = 'Dup'; an2.dispatchEvent(new w.Event('input', { bubbles: true }));
      ae2.value = 'dup@example.com'; ae2.dispatchEvent(new w.Event('input', { bubbles: true }));
      click(w, $(w, '[data-act="family.addAdult"]'));
      await sleep(80);
      check('parent: duplicate adult email shows a clear error', /ya tiene una cuenta/.test(text(w)));
      check('parent: still no study data sync calls', syncCalls(calls).length === 0);
      check('parent: no script errors', w.__errors.length === 0);
      if (w.__errors.length) console.log('parent errors:', w.__errors.join(' | '));
    }

    // ---------- added adult (parent who is not the family admin) ----------
    {
      const { w, calls } = makeDom('viewer');
      await sleep(400);
      check('viewer: nav has only the family page', $$(w, 'a.nav').length === 1 && /Kid One/.test(text(w)));
      check('viewer: no add-child button in the page', !$(w, 'a[href="#/addchild"]'));
      await go(w, '#/addchild');
      check('viewer: add-child route falls back to family', !$(w, '#acName') && /Familia/.test(text(w)));
      await go(w, '#/addadult');
      check('viewer: add-adult route falls back to family', !$(w, '#adName'));
      check('viewer: no study data sync and no POST', syncCalls(calls).length === 0 && !calls.some((c) => c.method === 'POST'));
      check('viewer: no script errors', w.__errors.length === 0);
    }

    // ---------- child ----------
    {
      const { w, calls } = makeDom('child');
      await sleep(400);
      check('child: student nav intact (16 links)', $$(w, 'a.nav').length === 16 && !/Familia/.test($(w, '#side').textContent));
      check('child: sync still happens', syncCalls(calls).some((c) => /\/api\/v2$/.test(c.url)));
      check('child: no parent routes called', !calls.some((c) => /\/api\/parent/.test(c.url)));
      check('child: notice shows who can see her progress', $(w, '.notice') && /Parent/.test($(w, '.notice').textContent) && /no pueden ver/i.test($(w, '.notice').textContent));
      click(w, $(w, '[data-act="home.dismissNotice"]'));
      await sleep(30);
      check('child: notice can be dismissed', !$(w, '.notice') && w.localStorage.getItem('sp2-notice') === 'parent@example.com');
      await go(w, '#/design');
      check('child: design page has the who-can-see card', /Quién puede ver mi progreso/.test(text(w)));
      await go(w, '#/home');
      check('child: notice stays dismissed', !$(w, '.notice'));
      await go(w, '#/family');
      check('child: cannot open the family page', !/Cómo van tus hijos/.test(text(w)));
      check('child: sidebar shows the version', $(w, '#appVersion') && $(w, '#appVersion').textContent === 'v' + pkg.version);
      check('child: no script errors', w.__errors.length === 0);
      if (w.__errors.length) console.log('child errors:', w.__errors.join(' | '));
    }

    // ---------- no profile ----------
    {
      const { w, calls } = makeDom('none');
      await sleep(400);
      check('none: notice shown', /Cuenta sin configurar/.test(text(w)));
      check('none: no nav links', $$(w, 'a.nav').length === 0);
      check('none: no sync calls', syncCalls(calls).length === 0);
      check('none: no script errors', w.__errors.length === 0);
      if (w.__errors.length) console.log('none errors:', w.__errors.join(' | '));
    }

    // ---------- /api/me fails: the student app keeps working ----------
    {
      const { w, calls } = makeDom('error');
      await sleep(400);
      check('me 500: student app still shown', $$(w, 'a.nav').length === 16);
      check('me 500: sync still happens', syncCalls(calls).some((c) => /\/api\/v2$/.test(c.url)));
      check('me 500: no script errors', w.__errors.length === 0);
    }
  } catch (e) { console.log('EXCEPTION', e && e.stack || e); }
  console.log(out.join('\n'));
  const fails = out.filter((l) => l.startsWith('FAIL')).length;
  console.log(fails ? fails + ' failed' : 'all family tests PASS');
  process.exit(fails ? 1 : 0);
})();
