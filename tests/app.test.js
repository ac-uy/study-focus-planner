const { JSDOM } = require('jsdom');
const fs = require('fs');
const DIST = require('path').resolve(__dirname, '..', 'web-next', 'dist').replace(/\\/g, '/');
const appjs = fs.readFileSync(DIST + '/app.js', 'utf8');
const html = fs.readFileSync(DIST + '/index.html', 'utf8');
const out = [];
const check = (n, c) => out.push((c ? 'PASS ' : 'FAIL ') + n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeDom(opts = {}) {
  const errors = [];
  const dom = new JSDOM(html, { url: 'http://localhost/next/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.__errors = errors;
  w.addEventListener('error', (e) => errors.push(e.message));
  w.scrollTo = () => {}; w.confirm = () => true;
  w.Element.prototype.scrollIntoView = function () {};
  w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
  let n = 0;
  w.Image = class { set src(v) { this.width = 100; this.height = 100; setTimeout(() => this.onload && this.onload(), 0); } };
  w.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} });
  w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,IMG' + (++n);
  w.fetch = opts.fetch || (() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }));
  if (opts.setup) opts.setup(w);
  w.eval(appjs);
  return dom;
}
const $ = (w, s) => w.document.querySelector(s);
const $$ = (w, s) => Array.from(w.document.querySelectorAll(s));
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const fire = (w, el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
const setVal = (w, id, v) => { const el = w.document.getElementById(id); el.value = v; return el; };
const go = async (w, hash) => { w.location.hash = hash; await sleep(30); };
const text = (w) => w.document.getElementById('view').textContent;
const document_has = (w, s) => !!w.document.querySelector(s);
const stateOf = (w) => JSON.parse(w.localStorage.getItem('study-planner-v2')).state;

// Fake YouTube IFrame Player API: records players and the videos they are told to load.
const yt = { instances: [], loaded: [] };
function installYT(w) {
  w.YT = { Player: class {
    constructor(el, cfg) { this.el = el; this.cfg = cfg; this.destroyed = false; yt.instances.push(this); setTimeout(() => cfg.events.onReady && cfg.events.onReady({ target: this }), 0); }
    loadVideoById(id) { yt.loaded.push(id); }
    destroy() { this.destroyed = true; }
    getVideoData() { return { title: this.title || '', video_id: this.vid || '' }; }
  } };
}

(async () => {
  try {
    // ---------- local mode ----------
    const dom = makeDom();
    const w = dom.window;
    await sleep(100);
    check('boots with home page', /Hola de nuevo/.test(text(w)));
    check('16 nav links', $$(w, 'a.nav').length === 16);
    check('every nav link has an svg icon and no emoji', $$(w, 'a.nav').every((a) => a.querySelector('svg.ico') && !/[\u{1F300}-\u{1FAFF}]/u.test(a.textContent)));
    check('quote shown with refresh button', $(w, '#quoteText').textContent.length > 10 && !!$(w, '[data-act="home.newQuote"]'));
    {
      const seen = new Set([$(w, '#quoteText').textContent]);
      let changedEveryTime = true;
      for (let i = 0; i < 6; i++) { const before = $(w, '#quoteText').textContent; click(w, $(w, '[data-act="home.newQuote"]')); if ($(w, '#quoteText').textContent === before) changedEveryTime = false; seen.add($(w, '#quoteText').textContent); }
      check('refresh button always gives a different quote', changedEveryTime && seen.size >= 3);
    }

    const ids = ['home', 'calendar', 'examweeks', 'plan', 'tasks', 'results', 'tutor', 'cards', 'notes', 'goals', 'streaks', 'stats', 'timer', 'timetable', 'history', 'design'];
    let bad = [];
    for (const id of ids) {
      await go(w, '#/' + id);
      const t = text(w);
      if (!t.trim() || /undefined|\[object|NaN/.test(t)) bad.push(id);
    }
    check('every page renders cleanly (' + (bad.join(',') || 'ok') + ')', bad.length === 0);
    check('no script errors while navigating', w.__errors.length === 0);

    // tasks
    await go(w, '#/tasks');
    setVal(w, 'tkTitle', 'Ejercicios de fracciones'); setVal(w, 'tkMin', '45'); setVal(w, 'tkImp', 'alta');
    click(w, $(w, '[data-act="tasks.add"]'));
    check('task added', /Ejercicios de fracciones/.test(text(w)) && /45 min/.test(text(w)));
    let st = stateOf(w);
    check('task saved to localStorage', st.tasks.length === 1 && st.tasks[0].importance === 'alta' && st.tasks[0].minutes === 45);
    click(w, $(w, 'a[href^="#/tasks/"]')); await sleep(30);
    check('task detail opens', $(w, '#tdTitle') && $(w, '#tdTitle').value === 'Ejercicios de fracciones');
    const tdTitle = $(w, '#tdTitle'); tdTitle.value = 'Fracciones 2'; fire(w, tdTitle, 'change');
    check('task title edit saved', stateOf(w).tasks[0].title === 'Fracciones 2');
    check('AI tools hidden in local mode', !/Revisar mi trabajo/.test(text(w)));
    await go(w, '#/tasks');
    const cb = $(w, '[data-change="tasks.toggle"]'); cb.checked = true; fire(w, cb, 'change');
    check('task marked done', stateOf(w).tasks[0].done === true);

    // calendar + exam week + plan
    await go(w, '#/calendar');
    setVal(w, 'exDate', '2026-11-25'); setVal(w, 'exTitle', 'Tema 3');
    click(w, $(w, '[data-act="calendar.add"]'));
    check('exam added', stateOf(w).exams.length === 1 && /Tema 3/.test(text(w)));
    await go(w, '#/examweeks');
    setVal(w, 'ewName', 'Globales'); setVal(w, 'ewStart', '2026-11-23'); setVal(w, 'ewEnd', '2026-11-27');
    click(w, $(w, '[data-act="examweeks.add"]'));
    check('exam week added with 5 days', /Globales/.test(text(w)) && /5 días/.test(text(w)));
    await go(w, '#/plan');
    setVal(w, 'plTitle', 'Repasar tema 3');
    click(w, $(w, '[data-act="plan.add"]'));
    check('plan item added', stateOf(w).plan.length === 1 && /Repasar tema 3/.test(text(w)));

    // cards + notes
    await go(w, '#/cards');
    setVal(w, 'cdFront', 'Capital de Francia'); setVal(w, 'cdBack', 'París');
    click(w, $(w, '[data-act="cards.add"]'));
    check('card added', stateOf(w).cards.length === 1);
    click(w, $(w, '[data-act="cards.flip"]'));
    check('card flips', /París/.test(text(w)));
    click(w, $(w, '[data-act="cards.mark"][data-known="1"]'));
    check('card marked known', stateOf(w).cards[0].known === true && /Te sabes 1 de 1/.test(text(w)));
    await go(w, '#/notes');
    click(w, $(w, '[data-act="notes.new"]'));
    const nb = $(w, '#nBody'); nb.value = 'La fotosíntesis ocurre en los cloroplastos.'; fire(w, nb, 'input');
    await sleep(500);
    check('note body saved', stateOf(w).notes.length === 1 && /cloroplastos/.test(stateOf(w).notes[0].body));

    // goals
    await go(w, '#/goals');
    click(w, $(w, '[data-tab="objectives"]'));
    setVal(w, 'obTitle', 'Examen de Mates');
    click(w, $(w, '[data-act="goals.addObjective"]'));
    const gid = stateOf(w).goals[0].id;
    setVal(w, 'stepIn-' + gid, 'Repasar tema 1');
    click(w, $(w, '[data-act="goals.addStep"]'));
    check('objective with step', stateOf(w).goals[0].steps.length === 1);
    click(w, $(w, '[data-tab="achievements"]'));
    check('achievements show', /logros/.test(text(w)));

    // timetable
    await go(w, '#/timetable');
    const cell = $(w, '[data-key="0-0"]'); cell.value = 'Matemáticas'; fire(w, cell, 'change');
    check('timetable saved', stateOf(w).timetable['0-0'] === 'Matemáticas');

    // timer: log a session with a faked clock
    await go(w, '#/timer');
    click(w, $(w, '[data-act="timer.mode"][data-mode="stopwatch"]'));
    const realNow = w.Date.now.bind(w.Date); let offset = 0;
    w.Date.now = () => realNow() + offset;
    click(w, $(w, '[data-act="timer.toggle"]'));
    check('timer running', /Pausar/.test(text(w)));
    offset = 125000; await sleep(400);
    check('stopwatch advanced ~2 min', /0?2:0[4-6]/.test($(w, '#clock').textContent));
    await go(w, '#/home');
    check('mini timer shown on other pages', !$(w, '#miniTimer').hidden);
    await go(w, '#/timer');
    click(w, $(w, '[data-act="timer.reset"]'));
    st = stateOf(w);
    check('session logged (2 min)', st.sessions.length === 1 && st.sessions[0].minutes === 2 && st.sessions[0].mode === 'stopwatch');
    await go(w, '#/stats');
    check('stats show total', /2 min/.test(text(w)));
    await go(w, '#/history');
    check('history lists session', /Cronómetro/.test(text(w)));

    // results: grades, trends and attention
    await go(w, '#/results');
    check('empty state before any grade', /Todavía no hay resultados/.test(text(w)));
    const addGrade = (subject, kind, date, score, max) => {
      setVal(w, 'rsSubject', subject); setVal(w, 'rsKind', kind); setVal(w, 'rsDate', date); setVal(w, 'rsScore', score); if (max) setVal(w, 'rsMax', max);
      click(w, $(w, '[data-act="results.add"]'));
    };
    addGrade('Maths', 'partial', '2026-10-05', '8,5');
    addGrade('Maths', 'exam', '2026-10-25', '6');
    addGrade('Maths', 'exam', '2026-11-10', '3.5');
    addGrade('English', 'quiz', '2026-10-12', '16', '20');
    addGrade('English', 'exam', '2026-11-12', '8');
    const rs = stateOf(w).results;
    check('5 grades saved, decimal comma accepted', rs.length === 5 && rs.find((x) => x.score === 8.5) && rs.find((x) => x.max === 20));
    check('averages shown (Maths 6, English 8)', /Matemáticas/.test(text(w)) && /Inglés/.test(text(w)));
    check('declining maths flagged as needing attention', /Necesita atención/.test(text(w)) && /van bajando/.test(text(w)));
    check('trend chart rendered with a pass line', !!$(w, 'svg.gchart line.pass') && $$(w, 'svg.gchart circle').length === 5);
    setVal(w, 'rsScore', '12'); setVal(w, 'rsDate', '2026-11-20'); click(w, $(w, '[data-act="results.add"]'));
    check('grade above the maximum rejected', stateOf(w).results.length === 5 && /no puede ser mayor/.test(text(w)));
    click(w, $(w, '[data-act="results.focus"][data-subject="English"]'));
    check('focus shows one subject only', $$(w, 'svg.gchart circle').length === 2);
    await go(w, '#/home');
    check('home attention card lists the weak subject', /Necesita atención/.test(text(w)) && /Matemáticas/.test(text(w)));

    // design
    await go(w, '#/design');
    click(w, $(w, '[data-act="design.set"][data-key="mode"][data-v="dark"]'));
    check('dark mode applied', w.document.documentElement.dataset.theme === 'dark');
    click(w, $(w, '[data-act="design.color"][data-kind="primary"]:nth-child(6)'));
    check('primary color applied', /^#/.test(w.document.documentElement.style.getPropertyValue('--primary')) && stateOf(w).design.primary === w.document.documentElement.style.getPropertyValue('--primary'));
    click(w, $(w, '[data-act="design.set"][data-key="bg"][data-v="aurora"]'));
    check('background class applied', $(w, '#bg').className === 'bg bg-aurora');
    click(w, $(w, '[data-act="design.set"][data-key="shape"][data-v="sharp"]'));
    check('shape applied', w.document.documentElement.style.getPropertyValue('--radius') === '4px');
    setVal(w, 'pfSubject', 'Música'); click(w, $(w, '[data-act="design.addSubject"]'));
    check('subject added', stateOf(w).settings.subjects.includes('Música'));
    setVal(w, 'pfSubject', 'música'); click(w, $(w, '[data-act="design.addSubject"]'));
    check('duplicate subject rejected', /ya existe/.test(text(w)));

    // language
    click(w, $(w, '[data-act="app.lang"][data-lang="en"]'));
    check('switches to English', /Study timer|Design/.test(w.document.getElementById('side').textContent) && /Home/.test(w.document.getElementById('side').textContent));
    check('no script errors in local flow', w.__errors.length === 0);

    // ---------- cloud mode with migration from the first version ----------
    const calls = []; let musicCalls = 0;
    const v1 = {
      lang: 'es', settings: { focusMin: 30, breakMin: 5, subjects: ['Maths', 'Música'], level: '2eso', sound: 'rain', volume: 55 },
      sessions: { '2026-11-19': 2, '2026-11-20': 1 },
      tasks: [{ id: 't1', title: 'Fracciones', subject: 'Maths', due: '2026-11-25', done: false, goalId: 'g1' }],
      goals: [{ id: 'g1', title: 'Maths mid-term', due: '2026-12-10', steps: [{ id: 's1', title: 'Repasar', done: true }] }],
    };
    const fetchCloud = (url, opts) => {
      const body = opts && opts.body ? opts.body : '';
      calls.push({ url, method: (opts && opts.method) || 'GET', body });
      const ok = (j) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(j) });
      if (/config\.json$/.test(url)) return ok({ clientId: 'c', cognitoDomain: 'https://x', apiUrl: 'https://api', redirectUri: 'http://localhost/next/' });
      if (/\/api\/v2$/.test(url)) return ok({ sections: {} });
      if (/\/api\/data$/.test(url)) return ok({ data: v1 });
      if (/\/api\/v2\//.test(url)) return ok({ ok: true });
      if (/\/api\/ai\/chat$/.test(url)) return ok({ reply: '¿Qué paso probaste primero?' });
      if (/\/api\/ai\/review$/.test(url)) return ok({ transcription: 'Las plantas absorben oxígeno.', verdict: 'Hay errores.', correct: ['Hacen glucosa'], corrections: [{ issue: 'Gas incorrecto', fix: 'Absorben dióxido de carbono.' }], additions: ['Clorofila'], unclear: [] });
      if (/\/api\/ai\/exam$/.test(url)) return ok({ questions: [{ question: '¿Dónde ocurre la fotosíntesis?', options: ['Cloroplastos', 'Núcleo', 'Vacuola', 'Ribosomas'], answer: 0, explanation: 'En los cloroplastos.' }] });
      if (/\/api\/music\/check$/.test(url)) { const id = JSON.parse(body).id; return id === 'BLOCKEDvid1' ? ok({ ok: false, reason: 'not allowed' }) : ok({ ok: true, id, title: id === 'abcdefghijk' ? 'Mozart piano' : 'Some video', channel: 'Classic' }); }
      if (/\/api\/music\/search$/.test(url) && /explicit/.test(body)) return Promise.resolve({ ok: false, status: 422, json: () => Promise.resolve({ error: 'not allowed' }) });
      if (/\/api\/music\/search$/.test(url)) {
        musicCalls++;
        const base = [{ id: 'dQw4w9WgXcQ', title: 'Lofi beats to study', channel: 'Chill Channel', thumb: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg' }, { id: 'abcdefghijk', title: 'Mozart piano', channel: 'Classic', thumb: '' }];
        if (musicCalls === 1) return ok({ results: base });
        return ok({ results: base.concat([{ id: ('FollowUp' + musicCalls + 'xxxxxxxxxxx').slice(0, 11), title: 'Similar song ' + musicCalls, channel: 'Mix', thumb: '' }]) });
      }
      if (/\/api\/ai\/cards$/.test(url)) return ok({ cards: [{ front: '¿Qué es un cloroplasto?', back: 'Orgánulo de la fotosíntesis' }] });
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    };
    const dom2 = makeDom({ fetch: fetchCloud, setup: (w2) => { installYT(w2); w2.localStorage.setItem('sp2-auth', JSON.stringify({ idToken: 'a.' + Buffer.from(JSON.stringify({ email: 'student@example.com' })).toString('base64').replace(/=/g, '') + '.c', refreshToken: 'r', exp: Date.now() + 3600000 })); } });
    const w2 = dom2.window;
    await sleep(1200);
    check('cloud: greeting uses email name', /Student/.test(text(w2)));
    check('cloud: sign out shown', /Cerrar sesión/.test(w2.document.getElementById('side').textContent));
    const s2 = stateOf(w2);
    check('migration: tasks imported with new fields', s2.tasks.length === 1 && s2.tasks[0].importance === 'media' && s2.tasks[0].minutes === 30 && s2.tasks[0].goalId === 'g1');
    check('migration: goals + steps imported', s2.goals.length === 1 && s2.goals[0].steps[0].done === true);
    check('migration: focus blocks became sessions', s2.sessions.length === 2 && s2.sessions.find((x) => x.date === '2026-11-19').minutes === 60);
    check('migration: settings imported', s2.settings.focusMin === 30 && s2.settings.level === '2eso' && s2.settings.sound === 'rain' && s2.settings.subjects.length === 2);
    const puts = calls.filter((c) => c.method === 'PUT' && /\/api\/v2\//.test(c.url)).map((c) => c.url.split('/').pop());
    check('migration pushed core and sessions', puts.includes('core') && puts.includes('sessions'));

    // tutor with a photo
    await go(w2, '#/tutor');
    const f = $(w2, '#chatFile');
    Object.defineProperty(f, 'files', { configurable: true, value: [new w2.File(['x'], 'a.jpg', { type: 'image/jpeg' })] });
    fire(w2, f, 'change'); await sleep(80);
    check('tutor: photo attached', $$(w2, '#chatPending .thumb').length === 1);
    setVal(w2, 'chatInput', 'No entiendo este ejercicio');
    click(w2, $(w2, '[data-act="tutor.send"]')); await sleep(120);
    const chatCall = calls.filter((c) => /ai\/chat$/.test(c.url))[0];
    const payload = chatCall && JSON.parse(chatCall.body);
    check('tutor: request carries image and level', payload && payload.messages[0].images.length === 1 && payload.level === '2º ESO');
    check('tutor: reply shown', /¿Qué paso probaste primero\?/.test($(w2, '#chatLog').textContent));

    // task review -> discuss with tutor -> exam
    await go(w2, '#/tasks/t1');
    check('review tools visible', /Revisar mi trabajo/.test(text(w2)));
    const rf = $(w2, '#rvChoose');
    Object.defineProperty(rf, 'files', { configurable: true, value: [new w2.File(['x'], 'b.jpg', { type: 'image/jpeg' })] });
    fire(w2, rf, 'change'); await sleep(80);
    click(w2, $(w2, '[data-act="task.run"]')); await sleep(120);
    check('review shown', /Gas incorrecto/.test(text(w2)) && /Las plantas absorben oxígeno/.test(text(w2)));
    check('review text saved on task', stateOf(w2).tasks[0].notes.indexOf('oxígeno') >= 0);
    click(w2, $(w2, '[data-act="task.exam"]')); await sleep(120);
    check('exam generated', /fotosíntesis/.test(text(w2)));
    const radio = $(w2, 'input[data-change="exam.pick"][data-o="0"]'); radio.checked = true; fire(w2, radio, 'change');
    click(w2, $(w2, '[data-act="exam.submit"]'));
    check('exam scored', /Puntuación: 1 de 1/.test(text(w2)));
    click(w2, $(w2, '[data-act="task.discuss"]')); await sleep(200);
    check('discuss navigates to tutor with context', w2.location.hash === '#/tutor');
    const chats = calls.filter((c) => /ai\/chat$/.test(c.url)).map((c) => JSON.parse(c.body));
    check('discuss sends review as context', chats.length === 2 && chats[1].context.indexOf('Absorben dióxido de carbono') >= 0 && /sin darme las respuestas/.test(chats[1].messages[0].content));

    // flashcards from notes
    await go(w2, '#/notes');
    click(w2, $(w2, '[data-act="notes.new"]'));
    const nb2 = $(w2, '#nBody'); nb2.value = 'La fotosíntesis ocurre en los cloroplastos de las células vegetales.'; fire(w2, nb2, 'input'); await sleep(450);
    await go(w2, '#/cards');
    click(w2, $(w2, '[data-act="cards.fromNote"]')); await sleep(150);
    check('cards created from notes', stateOf(w2).cards.length === 1 && /cloroplasto/.test(stateOf(w2).cards[0].front));
    // music search, player and automatic next song
    await go(w2, '#/timer');
    check('music card visible when signed in', /Escucha tu música favorita/.test(text(w2)) && !!$(w2, '#musicQ'));
    check('automatic similar songs is on by default', $(w2, '[data-change="music.auto"]').checked === true);
    const mq = setVal(w2, 'musicQ', 'lofi para estudiar'); fire(w2, mq, 'input');
    click(w2, $(w2, '[data-act="music.search"]')); await sleep(100);
    const searches = () => calls.filter((c) => /music\/search$/.test(c.url));
    check('search sent the typed text', searches().length === 1 && JSON.parse(searches()[0].body).q === 'lofi para estudiar');
    check('results listed', $$(w2, '.music-item').length === 2 && /Lofi beats to study/.test(text(w2)));
    click(w2, $(w2, '[data-act="music.play"][data-id="dQw4w9WgXcQ"]')); await sleep(60);
    const dock = $(w2, '#musicDock');
    check('player created through the YouTube API with the privacy domain and autoplay', yt.instances.length === 1 && yt.instances[0].cfg.videoId === 'dQw4w9WgXcQ' && yt.instances[0].cfg.host === 'https://www.youtube-nocookie.com' && yt.instances[0].cfg.playerVars.autoplay === 1);
    check('dock shows the song and what is next', !dock.hidden && /Lofi beats to study/.test(dock.textContent) && /Siguiente: Mozart piano/.test(dock.textContent));
    await go(w2, '#/home');
    check('player stays while changing section', !$(w2, '#musicDock').hidden && !yt.instances[0].destroyed);
    await go(w2, '#/timer');
    // the song ends: the next one from the same search plays, without another search
    yt.instances[0].cfg.events.onStateChange({ data: 0 }); await sleep(60);
    check('ending plays the next result from the same search (no quota used)', yt.loaded[yt.loaded.length - 1] === 'abcdefghijk' && searches().length === 1);
    check('dock title follows the song', /Mozart piano/.test($(w2, '#musicDock').textContent));
    // the list is over: one follow-up search for similar songs, skipping those already played
    yt.instances[0].cfg.events.onStateChange({ data: 0 }); await sleep(100);
    check('empty list triggers one follow-up search based on the last song', searches().length === 2 && JSON.parse(searches()[1].body).q === 'Mozart piano');
    check('follow-up plays a new song, never one already played', yt.loaded[yt.loaded.length - 1] === 'dQw4w9WgXcQ' ? false : /^[A-Za-z0-9_-]{11}$/.test(yt.loaded[yt.loaded.length - 1]) && !['dQw4w9WgXcQ', 'abcdefghijk'].includes(yt.loaded[yt.loaded.length - 1]));
    // automatic option off: the list simply ends
    const auto = $(w2, '[data-change="music.auto"]'); auto.checked = false; fire(w2, auto, 'change');
    const before = searches().length;
    yt.instances[0].cfg.events.onStateChange({ data: 0 }); await sleep(80);
    check('with the option off nothing else is searched or played', searches().length === before && /Se acabó la lista/.test($(w2, '#musicDock').textContent));
    // skip button searches even when the option is off
    click(w2, $(w2, '[data-act="music.next"]')); await sleep(100);
    check('skip button works on demand', searches().length === before + 1);
    // unplayable video: skips ahead on its own (automatic option back on)
    { const autoNow = $(w2, '[data-change="music.auto"]'); autoNow.checked = true; fire(w2, autoNow, 'change'); }
    const loadedBefore = yt.loaded.length;
    yt.instances[0].cfg.events.onError({ data: 150 }); await sleep(1200);
    check('an unplayable video is skipped', yt.loaded.length > loadedBefore || searches().length > before + 1);
    click(w2, $(w2, '[data-act="music.close"]'));
    check('close removes the player', $(w2, '#musicDock').hidden && yt.instances[0].destroyed && !document_has(w2, '#ytPlayer'));
    const checks = () => calls.filter((c) => /music\/check$/.test(c.url));
    const mq2 = setVal(w2, 'musicQ', 'https://youtu.be/abcdefghijk?t=3'); fire(w2, mq2, 'input');
    const beforeLink = searches().length, instBefore = yt.instances.length;
    click(w2, $(w2, '[data-act="music.search"]')); await sleep(100);
    check('pasted link is checked by the server first, without a search', checks().length === 1 && JSON.parse(checks()[0].body).id === 'abcdefghijk' && searches().length === beforeLink);
    check('an approved link plays with the real title', yt.instances.length === instBefore + 1 && yt.instances[instBefore].cfg.videoId === 'abcdefghijk' && /Mozart piano/.test($(w2, '#musicDock').textContent));
    click(w2, $(w2, '[data-act="music.close"]'));
    const mq3 = setVal(w2, 'musicQ', 'https://www.youtube.com/watch?v=BLOCKEDvid1'); fire(w2, mq3, 'input');
    const instBlocked = yt.instances.length;
    click(w2, $(w2, '[data-act="music.search"]')); await sleep(100);
    check('a link the server refuses is not played and the user is told', yt.instances.length === instBlocked && $(w2, '#musicDock').hidden && /no se puede reproducir/.test(text(w2)));
    const mq4 = setVal(w2, 'musicQ', 'something explicit'); fire(w2, mq4, 'input');
    click(w2, $(w2, '[data-act="music.search"]')); await sleep(100);
    check('a refused search shows a plain message and no results', /no está permitida/.test(text(w2)) && $$(w2, '.music-item').length === 0);
    const mq5 = setVal(w2, 'musicQ', 'Tchaikovsky'); fire(w2, mq5, 'input');
    const checksBefore = checks().length, searchesBefore = searches().length;
    click(w2, $(w2, '[data-act="music.search"]')); await sleep(100);
    check('an 11-letter word is a search, not a video id', searches().length === searchesBefore + 1 && checks().length === checksBefore);
    // if the YouTube player script cannot load, a plain embed is used and the user is told
    const dom3 = makeDom({ fetch: fetchCloud, setup: (w3) => { w3.YT_TIMEOUT_MS = 60; w3.localStorage.setItem('sp2-auth', JSON.stringify({ idToken: 'a.' + Buffer.from(JSON.stringify({ email: 'x@example.com' })).toString('base64').replace(/=/g, '') + '.c', refreshToken: 'r', exp: Date.now() + 3600000 })); } });
    const w3 = dom3.window;
    await sleep(900);
    await go(w3, '#/timer');
    setVal(w3, 'musicQ', 'lofi'); click(w3, $(w3, '[data-act="music.search"]')); await sleep(100);
    click(w3, $(w3, '[data-act="music.play"][data-id="dQw4w9WgXcQ"]')); await sleep(300);
    const fb = $(w3, '#musicDock iframe');
    check('fallback: plain nocookie embed when the player API cannot load', !!fb && /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/.test(fb.src) && /autoplay/.test(fb.getAttribute('allow')));
    check('fallback: the user is told it will not move on by itself', /no pasará sola/.test($(w3, '#musicDock').textContent));
    check('fallback: no script errors', w3.__errors.length === 0);
    // a player that never reports it started (a device that blocks YouTube) gets a plain explanation
    const dom4 = makeDom({ fetch: fetchCloud, setup: (w4) => { installYT(w4); w4.YT_WATCHDOG_MS = 80; w4.localStorage.setItem('sp2-auth', JSON.stringify({ idToken: 'a.' + Buffer.from(JSON.stringify({ email: 'x@example.com' })).toString('base64').replace(/=/g, '') + '.c', refreshToken: 'r', exp: Date.now() + 3600000 })); } });
    const w4 = dom4.window;
    await sleep(900);
    await go(w4, '#/timer');
    setVal(w4, 'musicQ', 'lofi'); click(w4, $(w4, '[data-act="music.search"]')); await sleep(100);
    const i4 = yt.instances.length;
    click(w4, $(w4, '[data-act="music.play"][data-id="dQw4w9WgXcQ"]')); await sleep(600);
    check('both official addresses were tried before giving up', yt.instances.length === i4 + 2 && /nocookie/.test(yt.instances[i4].cfg.host) && yt.instances[i4 + 1].cfg.host === 'https://www.youtube.com');
    check('a player that never starts shows the blocked-device message', /no está dejando reproducir YouTube/.test($(w4, '#musicDock').textContent));
    yt.instances[yt.instances.length - 1].cfg.events.onStateChange({ data: 1 }); await sleep(40);
    check('the message disappears once the player starts', !/no está dejando reproducir/.test($(w4, '#musicDock').textContent));
    check('blocked-device flow: no script errors', w4.__errors.length === 0);
    // the privacy-enhanced address is blocked but the standard YouTube address works: it is tried and remembered
    const dom5 = makeDom({ fetch: fetchCloud, setup: (w5) => {
      installYT(w5); w5.YT_WATCHDOG_MS = 80;
      const Base = w5.YT.Player;
      w5.YT = { Player: class extends Base { constructor(el, cfg) { super(el, cfg); if (!/nocookie/.test(cfg.host)) setTimeout(() => cfg.events.onStateChange && cfg.events.onStateChange({ data: 1 }), 10); } } };
      w5.localStorage.setItem('sp2-auth', JSON.stringify({ idToken: 'a.' + Buffer.from(JSON.stringify({ email: 'x@example.com' })).toString('base64').replace(/=/g, '') + '.c', refreshToken: 'r', exp: Date.now() + 3600000 }));
    } });
    const w5 = dom5.window;
    await sleep(900);
    await go(w5, '#/timer');
    setVal(w5, 'musicQ', 'lofi'); click(w5, $(w5, '[data-act="music.search"]')); await sleep(100);
    const i5 = yt.instances.length;
    click(w5, $(w5, '[data-act="music.play"][data-id="dQw4w9WgXcQ"]')); await sleep(600);
    check('fallback address: second player uses the standard YouTube host and the first is removed', yt.instances.length === i5 + 2 && yt.instances[i5].destroyed === true && yt.instances[i5 + 1].cfg.host === 'https://www.youtube.com');
    check('fallback address: no blocked message when the second address works', !/no está dejando reproducir/.test($(w5, '#musicDock').textContent) && !/Probando la otra/.test($(w5, '#musicDock').textContent));
    check('fallback address: the working address is remembered', w5.localStorage.getItem('sp2-yt-host') === 'std');
    check('fallback address: no script errors', w5.__errors.length === 0);    check('no script errors in cloud flow', w2.__errors.length === 0);
    console.log(out.join('\n'));
    if (w.__errors.length) console.log('local errors:', w.__errors.join(' | '));
    if (w2.__errors.length) console.log('cloud errors:', w2.__errors.join(' | '));
  } catch (e) {
    console.log(out.join('\n'));
    console.log('EXCEPTION ' + e.stack);
  }
  process.exit(0);
})();
