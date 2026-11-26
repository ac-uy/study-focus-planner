// Authorisation matrix for the family routes, with an in-memory fake of DynamoDB and a fake Cognito.
// Roles and links are read from the table on every request; the token only says who is calling.
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
process.env.TABLE_NAME = 't'; process.env.MODEL_ID = 'm'; process.env.USER_POOL_ID = 'pool-1';

const out = [];
const check = (n, c) => out.push((c ? 'PASS ' : 'FAIL ') + n);

// ----- fake DynamoDB -----
const store = new Map();
const key = (pk, sk) => pk + '|' + sk;
const condFail = () => { const e = new Error('condition failed'); e.name = 'ConditionalCheckFailedException'; return e; };
DynamoDBClient.prototype.send = async function (cmd) {
  const i = cmd.input, kind = cmd.constructor.name;
  if (kind === 'GetItemCommand') { const it = store.get(key(i.Key.pk.S, i.Key.sk.S)); return it ? { Item: it } : {}; }
  if (kind === 'PutItemCommand') {
    if (i.ConditionExpression && /attribute_not_exists/.test(i.ConditionExpression) && store.has(key(i.Item.pk.S, i.Item.sk.S))) throw condFail();
    store.set(key(i.Item.pk.S, i.Item.sk.S), i.Item); return {};
  }
  if (kind === 'QueryCommand') {
    const pk = i.ExpressionAttributeValues[':pk'].S, p = i.ExpressionAttributeValues[':p'].S;
    return { Items: [...store.values()].filter((it) => it.pk.S === pk && it.sk.S.startsWith(p)) };
  }
  if (kind === 'UpdateItemCommand') {
    const k = key(i.Key.pk.S, i.Key.sk.S), it = store.get(k);
    if (i.UpdateExpression === 'SET lastSeen = :now') {
      if (!it) throw condFail();
      if (it.lastSeen && Number(it.lastSeen.N) >= Number(i.ExpressionAttributeValues[':old'].N)) throw condFail();
      it.lastSeen = i.ExpressionAttributeValues[':now']; return {};
    }
    return {};
  }
  if (kind === 'TransactWriteItemsCommand') {
    for (const t of i.TransactItems) if (t.Put.ConditionExpression && store.has(key(t.Put.Item.pk.S, t.Put.Item.sk.S))) throw condFail();
    for (const t of i.TransactItems) store.set(key(t.Put.Item.pk.S, t.Put.Item.sk.S), t.Put.Item);
    return {};
  }
  throw new Error('unexpected command ' + kind);
};

// ----- fake Cognito -----
const cognitoCalls = [];
const existingEmails = new Set(['taken@example.com']);
let cognitoFailure = null, nextId = 100;
const uuid = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
CognitoIdentityProviderClient.prototype.send = async function (cmd) {
  cognitoCalls.push(cmd.input);
  if (cognitoFailure) { const e = new Error('x'); e.name = cognitoFailure; throw e; }
  const email = cmd.input.Username;
  if (existingEmails.has(email)) { const e = new Error('exists'); e.name = 'UsernameExistsException'; throw e; }
  existingEmails.add(email);
  const sub = uuid(nextId++);
  return { User: { Username: sub, Attributes: [{ Name: 'sub', Value: sub }, { Name: 'email', Value: email }] } };
};

const { handler } = require(path.resolve(__dirname, '..', 'lambda', 'api', 'index.js'));

// ----- seed -----
const P = uuid(1), C = uuid(2), D = uuid(3), Q = uuid(4), N = uuid(5);
const s = (v) => ({ S: v }), n = (v) => ({ N: String(v) });
const put = (pk, sk, extra) => store.set(key(pk, sk), Object.assign({ pk: s(pk), sk: s(sk) }, extra));
put('USER#' + P, 'PROFILE', { role: s('parent'), name: s('Pat'), email: s('pat@example.com') });
put('USER#' + Q, 'PROFILE', { role: s('parent'), name: s('Quinn'), email: s('quinn@example.com') });
put('USER#' + C, 'PROFILE', { role: s('child'), name: s('Cleo'), email: s('cleo@example.com'), lastSeen: n(1000) });
put('USER#' + D, 'PROFILE', { role: s('child'), name: s('Dana'), email: s('dana@example.com') });
put('USER#' + P, 'CHILD#' + C, { name: s('Cleo'), email: s('cleo@example.com'), linkedAt: n(1) });
put('USER#' + C, 'PARENT#' + P, { name: s('Pat'), email: s('pat@example.com'), linkedAt: n(1) });
const coreData = {
  lang: 'es', profile: { name: 'Cleo', secretProfileField: 'SECRET-PROFILE' }, design: { primary: '#ff0000', secretDesign: 'SECRET-DESIGN' },
  settings: { level: '2eso', subjects: ['Maths', 'English'], sound: 'rain', volume: 10, secretSetting: 'SECRET-SETTING' },
  tasks: [{ id: 't1', title: 'Fractions', subject: 'Maths', minutes: 30, importance: 'alta', due: '2026-11-25', done: false, notes: 'SECRET-TASK-NOTE', goalId: 'g1', extraField: 'SECRET-EXTRA' }],
  exams: [{ id: 'e1', subject: 'Maths', date: '2026-11-27', title: 'Unit 3', secret: 'SECRET-EXAM' }],
  examWeeks: [{ id: 'w1', name: 'Finals', start: '2026-11-23', end: '2026-11-27' }],
  plan: [{ id: 'p1', date: '2026-11-21', title: 'SECRET-PLAN', subject: 'Maths', minutes: 30, done: false }],
  timetable: { '0-0': 'Maths', '9-9': 'SECRET-BAD-KEY' },
  goals: [{ id: 'g1', title: 'Pass Maths', due: '2026-12-10', steps: [{ id: 's1', title: 'Review', done: true }] }],
  weeklyGoals: [{ id: 'wg1', subject: 'Maths', minutes: 120, period: 'week' }],
  results: [{ id: 'r1', subject: 'Maths', kind: 'exam', title: 'Unit 2', date: '2026-10-25', score: 6, max: 10 }],
  counters: { reviews: 3, exams: 2, chats: 9, cards: 1 },
};
put('USER#' + C, 'V2#core', { body: s(JSON.stringify(coreData)), updatedAt: n(2000) });
put('USER#' + C, 'V2#sessions', { body: s(JSON.stringify([{ id: 'x1', date: '2026-11-20', minutes: 30, mode: 'timer', subject: 'Maths', title: 'Fractions', ts: 5, secret: 'SECRET-SESSION' }])), updatedAt: n(3000) });
put('USER#' + C, 'V2#notes', { body: s(JSON.stringify({ notes: [{ id: 'n1', title: 'SECRET-NOTE-TITLE', body: 'SECRET-NOTE-BODY' }] })), updatedAt: n(4000) });
put('USER#' + C, 'V2#cards', { body: s(JSON.stringify({ cards: [{ id: 'c1', front: 'SECRET-CARD', back: 'SECRET-BACK' }] })), updatedAt: n(5000) });
const seeded = store.size;

const call = async (sub, method, p, body) => {
  const ev = { rawPath: p, requestContext: { http: { method }, authorizer: sub ? { jwt: { claims: { sub } } } : undefined }, body: body === undefined ? undefined : JSON.stringify(body) };
  const r = await handler(ev);
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null, raw: r.body };
};
const snapshot = () => JSON.stringify([...store.entries()].sort());

(async () => {
  // ----- no token, no profile -----
  for (const [m, p] of [['GET', '/api/me'], ['GET', '/api/parent/children'], ['POST', '/api/parent/children'], ['GET', '/api/parent/children/' + C + '/data']]) {
    const r = await call(null, m, p, m === 'POST' ? {} : undefined);
    check('no token -> 401 on ' + m + ' ' + p.replace(C, '<child>'), r.status === 401);
  }
  let r = await call(N, 'GET', '/api/me');
  check('account without a profile -> 403 on /api/me', r.status === 403 && r.body.error === 'no profile');
  for (const [m, p] of [['GET', '/api/parent/children'], ['POST', '/api/parent/children'], ['GET', '/api/parent/children/' + C + '/data']]) {
    r = await call(N, m, p, m === 'POST' ? { name: 'x', email: 'x@example.com' } : undefined);
    check('account without a profile -> 403 on ' + m + ' ' + p.replace(C, '<child>'), r.status === 403);
  }
  check('a call without a profile never creates one', !store.has(key('USER#' + N, 'PROFILE')));

  // ----- child -----
  r = await call(C, 'GET', '/api/me');
  check('child /api/me: role, own name and her parents', r.status === 200 && r.body.role === 'child' && r.body.name === 'Cleo' && r.body.parents.length === 1 && r.body.parents[0].name === 'Pat' && !r.body.children);
  for (const [m, p] of [['GET', '/api/parent/children'], ['POST', '/api/parent/children'], ['GET', '/api/parent/children/' + C + '/data'], ['GET', '/api/parent/children/' + D + '/data']]) {
    r = await call(C, m, p, m === 'POST' ? { name: 'Evil', email: 'evil@example.com' } : undefined);
    check('child -> 403 on ' + m + ' ' + p.replace(C, '<self>').replace(D, '<other>'), r.status === 403);
  }
  check('a child can never reach Cognito', cognitoCalls.length === 0);

  // ----- lastSeen -----
  const seen1 = Number(store.get(key('USER#' + C, 'PROFILE')).lastSeen.N);
  check('child opening the app sets lastSeen', seen1 > 1000);
  await call(C, 'GET', '/api/me');
  check('lastSeen is not rewritten within 10 minutes', Number(store.get(key('USER#' + C, 'PROFILE')).lastSeen.N) === seen1);
  const realNow = Date.now; Date.now = () => realNow() + 11 * 60 * 1000;
  await call(C, 'GET', '/api/me');
  Date.now = realNow;
  check('lastSeen is refreshed after 10 minutes', Number(store.get(key('USER#' + C, 'PROFILE')).lastSeen.N) > seen1);

  // ----- parent -----
  r = await call(P, 'GET', '/api/me');
  check('parent /api/me: role and linked children', r.status === 200 && r.body.role === 'parent' && r.body.children.length === 1 && r.body.children[0].sub === C && r.body.children[0].name === 'Cleo' && r.body.children[0].lastSeen > 1000 && !r.body.parents);
  r = await call(P, 'GET', '/api/parent/children');
  check('parent lists their children', r.status === 200 && r.body.children.length === 1 && r.body.children[0].sub === C);
  r = await call(Q, 'GET', '/api/parent/children');
  check('another parent sees no children', r.status === 200 && r.body.children.length === 0);

  // ----- what a parent may read -----
  r = await call(P, 'GET', '/api/parent/children/' + C + '/data');
  check('linked parent gets the child data', r.status === 200 && r.body.child.name === 'Cleo' && r.body.core.tasks.length === 1 && r.body.sessions.length === 1 && r.body.core.results.length === 1);
  check('updatedAt of core and sessions is reported', r.body.updatedAt.core === 2000 && r.body.updatedAt.sessions === 3000);
  check('no secret from any section or field reaches the parent', !/SECRET/.test(r.raw));
  check('task notes, plan, design, counters and unknown fields are absent', !('notes' in r.body.core.tasks[0]) && !('extraField' in r.body.core.tasks[0]) && !('plan' in r.body.core) && !('design' in r.body.core) && !('counters' in r.body.core) && !('lang' in r.body.core));
  check('notes and flashcards sections are never returned', !('notes' in r.body) && !('cards' in r.body.core));
  check('timetable keeps only valid slots', r.body.core.timetable['0-0'] === 'Maths' && !('9-9' in r.body.core.timetable));
  check('the rest of what parents may see is present', r.body.core.exams[0].date === '2026-11-27' && r.body.core.goals[0].steps[0].done === true && r.body.core.settings.level === '2eso' && r.body.core.weeklyGoals[0].minutes === 120 && r.body.core.examWeeks[0].name === 'Finals');

  // ----- who may NOT read -----
  for (const [who, label, sub, target] of [['P', 'parent, other child', P, D], ['Q', 'unlinked parent', Q, C], ['P', 'parent, unknown id', P, uuid(999)], ['P', 'parent, own id', P, P]]) {
    r = await call(sub, 'GET', '/api/parent/children/' + target + '/data');
    check(label + ' -> 404', r.status === 404);
  }
  r = await call(P, 'GET', '/api/parent/children/not-a-uuid/data');
  check('malformed id -> 404', r.status === 404);
  r = await call(P, 'GET', '/api/parent/children/' + C + '/data/extra');
  check('extra path segments -> 404', r.status === 404);
  r = await call(P, 'PUT', '/api/parent/children/' + C + '/data', { core: { tasks: [] } });
  check('a parent cannot write a child\'s data (PUT -> 404)', r.status === 404 && store.get(key('USER#' + C, 'V2#core')).body.S === JSON.stringify(coreData));
  r = await call(P, 'DELETE', '/api/parent/children/' + C + '/data');
  check('a parent cannot delete a child\'s data', r.status === 404);

  // ----- crafted writes cannot change roles or links -----
  const before = snapshot();
  const crafted = [
    ['PUT', '/api/v2/core', { role: 'parent', data: { role: 'parent' } }],
    ['PUT', '/api/v2/PROFILE', { role: 'parent' }],
    ['PUT', '/api/v2/CHILD#' + D, { name: 'x' }],
    ['PUT', '/api/v2/..%2FPROFILE', { role: 'parent' }],
    ['PUT', '/api/data', { role: 'parent' }],
  ];
  for (const [m, p, b] of crafted) await call(C, m, p, Object.assign({ data: b }, b));
  const profileC = store.get(key('USER#' + C, 'PROFILE'));
  check('crafted writes leave the child profile as a child', profileC.role.S === 'child');
  check('crafted writes create no PROFILE or link items', ![...store.keys()].some((k) => /\|(PROFILE|CHILD#|PARENT#)/.test(k) && !before.includes(JSON.stringify(k))));
  check('a child still cannot use parent routes afterwards', (await call(C, 'GET', '/api/parent/children')).status === 403);
  check('the only items changed are the child\'s own V2#core and DATA', (() => {
    const changed = [...store.entries()].filter(([k, v]) => !before.includes(JSON.stringify([k, v])));
    return changed.every(([k]) => k === key('USER#' + C, 'V2#core') || k === key('USER#' + C, 'DATA') || k === key('USER#' + C, 'PROFILE'));
  })());

  // ----- creating a child -----
  const beforeCreate = store.size;
  r = await call(P, 'POST', '/api/parent/children', { name: '  Eva   Lopez ', email: ' EVA@' + 'EXAMPLE.com ', role: 'parent', createdBy: 'someone' });
  check('parent creates a child -> 200', r.status === 200 && r.body.ok && r.body.child.name === 'Eva Lopez' && r.body.child.email === 'eva@example.com');
  const call0 = cognitoCalls[cognitoCalls.length - 1];
  check('Cognito gets the lowercase email, invitation by email, verified address', call0.UserPoolId === 'pool-1' && call0.Username === 'eva@example.com' && call0.DesiredDeliveryMediums[0] === 'EMAIL' && call0.UserAttributes.some((a) => a.Name === 'email_verified' && a.Value === 'true'));
  const newSub = r.body.child.sub;
  const prof = store.get(key('USER#' + newSub, 'PROFILE'));
  check('new account is a child created by this parent, whatever the body said', prof.role.S === 'child' && prof.createdBy.S === P);
  check('both link items exist', store.has(key('USER#' + P, 'CHILD#' + newSub)) && store.has(key('USER#' + newSub, 'PARENT#' + P)) && store.size === beforeCreate + 3);
  r = await call(newSub, 'GET', '/api/me');
  check('the new child can open the app and sees who her parent is', r.status === 200 && r.body.role === 'child' && r.body.parents[0].email === 'pat@example.com');
  r = await call(P, 'GET', '/api/parent/children/' + newSub + '/data');
  check('the parent can read the new child (empty data)', r.status === 200 && r.body.core.tasks.length === 0 && r.body.sessions.length === 0);
  r = await call(Q, 'GET', '/api/parent/children/' + newSub + '/data');
  check('another parent cannot read the new child', r.status === 404);

  const snapDup = snapshot();
  r = await call(P, 'POST', '/api/parent/children', { name: 'Taken', email: 'taken@example.com' });
  check('an email that already has an account -> 409 and nothing is written', r.status === 409 && snapshot() === snapDup);
  cognitoFailure = 'AliasExistsException';
  r = await call(P, 'POST', '/api/parent/children', { name: 'Alias', email: 'alias@example.com' });
  cognitoFailure = null;
  check('alias conflict -> 409', r.status === 409 && snapshot() === snapDup);
  const callsBefore = cognitoCalls.length;
  for (const [label, body] of [['no name', { email: 'a@example.com' }], ['blank name', { name: '   ', email: 'a@example.com' }], ['no email', { name: 'A' }], ['bad email', { name: 'A', email: 'not-an-email' }], ['huge email', { name: 'A', email: 'a'.repeat(130) + '@example.com' }]]) {
    r = await call(P, 'POST', '/api/parent/children', body);
    check('invalid input (' + label + ') -> 400', r.status === 400);
  }
  r = await call(P, 'POST', '/api/parent/children', undefined);
  check('empty body -> 400', r.status === 400);
  check('invalid input never reaches Cognito', cognitoCalls.length === callsBefore);

  // limit of 5 children
  let last;
  for (let k = 0; k < 6; k++) last = await call(P, 'POST', '/api/parent/children', { name: 'Kid ' + k, email: 'kid' + k + '@example.com' });
  const kids = (await call(P, 'GET', '/api/parent/children')).body.children.length;
  check('a parent can have at most 5 children (-> 422 after that)', last.status === 422 && kids === 5);
  const callsAtLimit = cognitoCalls.length;
  await call(P, 'POST', '/api/parent/children', { name: 'One more', email: 'more@example.com' });
  check('at the limit Cognito is not called', cognitoCalls.length === callsAtLimit);

  // ----- other adults (change 0002) -----
  r = await call(C, 'POST', '/api/parent/adults', { name: 'Sneak', email: 'sneak@example.com' });
  check('a child cannot add an adult -> 403', r.status === 403);
  r = await call(N, 'POST', '/api/parent/adults', { name: 'Sneak', email: 'sneak@example.com' });
  check('an account without a profile cannot add an adult -> 403', r.status === 403);
  r = await call(null, 'GET', '/api/parent/adults');
  check('no token on adults -> 401', r.status === 401);
  r = await call(P, 'GET', '/api/me');
  check('the family admin sees admin=true and an empty adults list', r.body.admin === true && r.body.adults.length === 0);

  const snapAd = snapshot(), callsAd = cognitoCalls.length;
  for (const [label, body] of [['no name', { email: 'a@example.com' }], ['bad email', { name: 'A', email: 'nope' }]]) {
    r = await call(P, 'POST', '/api/parent/adults', body);
    check('adult: invalid input (' + label + ') -> 400', r.status === 400);
  }
  r = await call(P, 'POST', '/api/parent/adults', { name: 'Taken', email: 'taken@example.com' });
  check('adult: existing email -> 409 and nothing written', r.status === 409 && snapshot() === snapAd);
  check('adult: invalid input never reaches Cognito', cognitoCalls.length === callsAd + 1);

  const kidsOfP = (await call(P, 'GET', '/api/parent/children')).body.children;
  r = await call(P, 'POST', '/api/parent/adults', { name: ' Ana   Ruiz ', email: 'ANA@' + 'example.com', role: 'child', addedBy: 'x' });
  check('admin adds an adult -> 200', r.status === 200 && r.body.adult.name === 'Ana Ruiz' && r.body.adult.email === 'ana@example.com' && r.body.children === kidsOfP.length);
  const A = r.body.adult.sub;
  const profA = store.get(key('USER#' + A, 'PROFILE'));
  check('the adult is a parent added by this admin, whatever the body said', profA.role.S === 'parent' && profA.addedBy.S === P);
  check('the adult is linked to every child of the admin, both sides', kidsOfP.every((k) => store.has(key('USER#' + A, 'CHILD#' + k.sub)) && store.has(key('USER#' + k.sub, 'PARENT#' + A))));
  r = await call(A, 'GET', '/api/me');
  check('the adult opens the app as a non-admin parent with the children', r.status === 200 && r.body.role === 'parent' && r.body.admin === false && r.body.children.length === kidsOfP.length && r.body.adults === undefined);
  r = await call(A, 'GET', '/api/parent/children/' + C + '/data');
  check('the adult can read a linked child (read only)', r.status === 200 && r.body.child.sub === C && Array.isArray(r.body.core.tasks));
  r = await call(A, 'POST', '/api/parent/children', { name: 'Nope', email: 'nope@example.com' });
  check('the adult cannot create a child -> 403', r.status === 403);
  r = await call(A, 'POST', '/api/parent/adults', { name: 'Nope', email: 'nope2@example.com' });
  check('the adult cannot add another adult -> 403', r.status === 403);
  r = await call(A, 'GET', '/api/parent/adults');
  check('the adult cannot list adults -> 403', r.status === 403);
  r = await call(Q, 'GET', '/api/parent/children/' + C + '/data');
  check('an unrelated parent still cannot read the child', r.status === 404);
  r = await call(C, 'GET', '/api/me');
  check('the child now sees both parents', r.body.parents.length === 2 && r.body.parents.some((p) => p.email === 'ana@example.com'));
  r = await call(P, 'GET', '/api/me');
  check('the admin sees the adult listed', r.body.adults.length === 1 && r.body.adults[0].email === 'ana@example.com');

  // a child created after the adult is linked to the adult too (use Q: no children yet)
  r = await call(Q, 'POST', '/api/parent/adults', { name: 'Bo', email: 'bo@example.com' });
  const B = r.body.adult.sub;
  check('admin with no children can add an adult (0 children linked)', r.status === 200 && r.body.children === 0);
  r = await call(Q, 'POST', '/api/parent/children', { name: 'Fio', email: 'fio@example.com' });
  const F = r.body.child.sub;
  check('a later child is linked to the adult on both sides', r.status === 200 && store.has(key('USER#' + B, 'CHILD#' + F)) && store.has(key('USER#' + F, 'PARENT#' + B)));
  r = await call(B, 'GET', '/api/parent/children/' + F + '/data');
  check('the adult reads the later child', r.status === 200);
  r = await call(A, 'GET', '/api/parent/children/' + F + '/data');
  check('an adult of another family cannot read that child', r.status === 404);

  // limit of 4 adults
  let lastAd;
  for (let k = 0; k < 5; k++) lastAd = await call(Q, 'POST', '/api/parent/adults', { name: 'Ad ' + k, email: 'ad' + k + '@example.com' });
  check('an admin can add at most 4 adults (-> 422 after that)', lastAd.status === 422 && (await call(Q, 'GET', '/api/parent/adults')).body.adults.length === 4);

  console.log(out.join('\n'));
})().catch((e) => { console.log(out.join('\n')); console.log('EXCEPTION ' + e.stack); });
