// Administrator helper for family accounts (roles and links). It talks to your AWS account with the profile in
// AWS_PROFILE (for example "planner") and finds the table and the user pool through the CloudFormation stack.
//
//   node tools/admin.mjs show
//   node tools/admin.mjs add-parent --email <email> --name <name>
//   node tools/admin.mjs set-role --email <email> --role parent|child [--name <name>] [--force]
//   node tools/admin.mjs link --parent <email> --child <email>
//
// Region comes from infra/config.local.json. Nothing personal is stored in this file.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CloudFormationClient, DescribeStackResourcesCommand } from '@aws-sdk/client-cloudformation';
import { CognitoIdentityProviderClient, ListUsersCommand, AdminCreateUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'infra', 'config.local.json'), 'utf8'));
const region = cfg.region;
const stackName = process.env.STACK || 'StudyPlannerStack';
const EMAIL = /^[^@\s"\\]+@[^@\s"\\]+\.[^@\s"\\]+$/;

const [cmd, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) { const k = rest[i].slice(2); const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; opt[k] = v; }
}
const die = (m) => { console.error('Error: ' + m); process.exit(1); };
const need = (k) => { if (!opt[k] || opt[k] === true) die('--' + k + ' is required'); return String(opt[k]); };
const email = (k) => { const e = need(k).trim().toLowerCase(); if (!EMAIL.test(e)) die('--' + k + ' is not a valid email'); return e; };

const cfn = new CloudFormationClient({ region }), idp = new CognitoIdentityProviderClient({ region }), ddb = new DynamoDBClient({ region });
let TABLE, POOL;
async function locate() {
  const res = await cfn.send(new DescribeStackResourcesCommand({ StackName: stackName }));
  const find = (type) => (res.StackResources.find((r) => r.ResourceType === type) || {}).PhysicalResourceId;
  TABLE = find('AWS::DynamoDB::Table'); POOL = find('AWS::Cognito::UserPool');
  if (!TABLE || !POOL) die('could not find the table and the user pool in stack ' + stackName);
}
async function userByEmail(e) {
  const res = await idp.send(new ListUsersCommand({ UserPoolId: POOL, Filter: 'email = "' + e + '"', Limit: 2 }));
  const u = (res.Users || [])[0];
  if (!u) return null;
  const sub = (u.Attributes.find((a) => a.Name === 'sub') || {}).Value;
  return { sub, email: e, status: u.UserStatus };
}
const S = (v) => ({ S: String(v) });
const N = (v) => ({ N: String(v) });
async function getProfile(sub) {
  const r = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: { pk: S('USER#' + sub), sk: S('PROFILE') } }));
  return r.Item ? { role: r.Item.role && r.Item.role.S, name: r.Item.name && r.Item.name.S, email: r.Item.email && r.Item.email.S } : null;
}
const defaultName = (e) => { const p = e.split('@')[0].replace(/[^A-Za-zÀ-ÿ]+/g, ' ').trim(); return p ? p.charAt(0).toUpperCase() + p.slice(1) : 'User'; };

async function setRole(e, role, name, force) {
  const u = await userByEmail(e);
  if (!u) die('no account with that email in the user pool');
  const existing = await getProfile(u.sub);
  if (existing && !force) {
    if (existing.role === role) { console.log(e + ' is already a ' + role + ' (nothing changed)'); return u; }
    die(e + ' already has the role ' + existing.role + '. Use --force to change it.');
  }
  await ddb.send(new PutItemCommand({ TableName: TABLE, Item: {
    pk: S('USER#' + u.sub), sk: S('PROFILE'), role: S(role), name: S(name || (existing && existing.name) || defaultName(e)), email: S(e), createdAt: N(Date.now()), createdBy: S('admin'),
  } }));
  console.log(e + ' is now a ' + role);
  return u;
}

async function main() {
  if (!cmd || !['show', 'add-parent', 'set-role', 'link'].includes(cmd)) die('usage: node tools/admin.mjs show | add-parent | set-role | link (see the top of this file)');
  await locate();

  if (cmd === 'show') {
    const res = await ddb.send(new ScanCommand({ TableName: TABLE, FilterExpression: 'sk = :p OR begins_with(sk, :c) OR begins_with(sk, :q)', ExpressionAttributeValues: { ':p': S('PROFILE'), ':c': S('CHILD#'), ':q': S('PARENT#') } }));
    const items = res.Items || [];
    console.log('Profiles:');
    items.filter((i) => i.sk.S === 'PROFILE').forEach((i) => console.log('  ' + i.role.S.padEnd(7) + ' ' + (i.name ? i.name.S : '').padEnd(14) + ' ' + (i.email ? i.email.S : '').padEnd(36) + ' ' + i.pk.S.slice(5, 13) + '…' + (i.lastSeen ? '  last seen ' + new Date(Number(i.lastSeen.N)).toISOString() : '')));
    console.log('Links (parent -> child):');
    items.filter((i) => i.sk.S.startsWith('CHILD#')).forEach((i) => console.log('  ' + i.pk.S.slice(5, 13) + '… -> ' + i.sk.S.slice(6, 14) + '…  ' + (i.name ? i.name.S : '')));
    return;
  }
  if (cmd === 'add-parent') {
    const e = email('email'), name = need('name');
    if (await userByEmail(e)) die('that email already has an account. Use set-role --role parent instead.');
    await idp.send(new AdminCreateUserCommand({ UserPoolId: POOL, Username: e, DesiredDeliveryMediums: ['EMAIL'], UserAttributes: [{ Name: 'email', Value: e }, { Name: 'email_verified', Value: 'true' }] }));
    await setRole(e, 'parent', name, false);
    console.log('An invitation with a temporary password was emailed to ' + e);
    return;
  }
  if (cmd === 'set-role') {
    const role = need('role');
    if (role !== 'parent' && role !== 'child') die('--role must be parent or child');
    await setRole(email('email'), role, opt.name === true ? '' : opt.name, !!opt.force);
    return;
  }
  if (cmd === 'link') {
    const pe = email('parent'), ce = email('child');
    const [p, c] = await Promise.all([userByEmail(pe), userByEmail(ce)]);
    if (!p || !c) die('both accounts must exist in the user pool');
    const [pp, cp] = await Promise.all([getProfile(p.sub), getProfile(c.sub)]);
    if (!pp || pp.role !== 'parent') die(pe + ' is not a parent yet (use set-role first)');
    if (!cp || cp.role !== 'child') die(ce + ' is not a child yet (use set-role first)');
    const now = Date.now();
    await ddb.send(new TransactWriteItemsCommand({ TransactItems: [
      { Put: { TableName: TABLE, Item: { pk: S('USER#' + p.sub), sk: S('CHILD#' + c.sub), name: S(cp.name || defaultName(ce)), email: S(ce), linkedAt: N(now) } } },
      { Put: { TableName: TABLE, Item: { pk: S('USER#' + c.sub), sk: S('PARENT#' + p.sub), name: S(pp.name || defaultName(pe)), email: S(pe), linkedAt: N(now) } } },
    ] }));
    console.log('Linked: ' + pe + ' can now see ' + ce);
  }
}
main().catch((e) => die((e && e.name ? e.name + ': ' : '') + (e && e.message ? e.message : e)));
