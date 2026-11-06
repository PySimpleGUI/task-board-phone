// dropbox.js - signing in to Dropbox (PKCE, no app secret) and the few calls the board needs: list the data folder, download a file,
// upload THIS phone's own file.  Every path goes through allowed(): only the Task_Board data folder, never 2026_Claude or 2026_Private.

export const APP_KEY = 'h1v9djxhugixlo6';
const AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const API = 'https://api.dropboxapi.com/2/';
const CONTENT = 'https://content.dropboxapi.com/2/';
const K_TOKEN = 'tb.dropbox', K_PKCE = 'tb.pkce';

export const REAL_FOLDER = '/2026DebPython/Task_Board';          // the shared folder (in Deb's Dropbox and Mike's)
export const TEST_FOLDER = '/2026_PSG_Work/Tools/task_board_phone_test/Task_Board';   // a COPY, for testing on Mike's Dropbox

const FORBIDDEN = /(^|\/)(2026_claude|2026_private)(\/|$)/i;

// Testing on the PC only (http://localhost:8765/?mock=1): the test server stands in for Dropbox, on the COPY of the folder.  ?mock=0 turns it off
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
if (LOCAL && /[?&]mock=1/.test(location.search)) localStorage.setItem('tb.mock', '1');
if (/[?&]mock=0/.test(location.search) || !LOCAL) localStorage.removeItem('tb.mock');
export const MOCK = LOCAL && localStorage.getItem('tb.mock') === '1';
async function mock(what, params, body) {
  const r = await fetch('/_mock/' + what + '?' + new URLSearchParams(params), body === undefined ? {} : { method: 'POST', body });
  if (!r.ok) throw new Error('test server: ' + (await r.text()));
  return r;
}

export function cleanFolder(path) {                             // '/a/b/Task_Board' or null if it isn't a folder this app may use
  let p = String(path || '').trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  if (p && !p.startsWith('/')) p = '/' + p;
  if (!p || FORBIDDEN.test(p) || !/\/task_board$/i.test(p) || p.split('/').some(x => x === '..' || x === '.')) return null;
  return p;
}
function allowed(folder, path) {                                // the file must be directly inside the chosen data folder
  const f = cleanFolder(folder);
  if (!f || FORBIDDEN.test(path)) throw new Error('Not the board folder: ' + path);
  const lower = path.toLowerCase();
  if (!lower.startsWith(f.toLowerCase() + '/') || path.slice(f.length + 1).includes('/')) throw new Error('Not in the board folder: ' + path);
  return path;
}

// Dropbox-API-Arg must be plain ASCII: escape everything else as \uXXXX
const headerJson = o => JSON.stringify(o).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function save(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }

const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function randomText(n) { const b = new Uint8Array(n); crypto.getRandomValues(b); return b64url(b).slice(0, n); }

export function redirectUri() { return location.origin + location.pathname.replace(/index\.html$/, ''); }
export function signedIn() { if (MOCK) return true; const t = load(K_TOKEN); return !!(t && t.refresh_token); }
export function accountId() { if (MOCK) return 'test server (mock)'; const t = load(K_TOKEN); return t ? t.account_id || '' : ''; }
export function signOut() { save(K_TOKEN, null); }

export async function startSignIn() {                           // goes to Dropbox; it comes back to this page with ?code=
  const verifier = randomText(64);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const state = randomText(16);
  save(K_PKCE, { verifier, state, redirect: redirectUri() });
  const q = new URLSearchParams({ client_id: APP_KEY, response_type: 'code', code_challenge: b64url(digest), code_challenge_method: 'S256',
    redirect_uri: redirectUri(), token_access_type: 'offline', state });
  location.assign(AUTH_URL + '?' + q.toString());
}

export async function finishSignIn() {                          // on the way back from Dropbox.  Returns true if it signed in
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return false;
  const pk = load(K_PKCE);
  save(K_PKCE, null);
  history.replaceState(null, '', redirectUri());
  if (q.has('error')) throw new Error(q.get('error_description') || q.get('error'));
  if (!pk || pk.state !== q.get('state')) throw new Error('The sign-in came back without its key - please try again');
  const r = await fetch(TOKEN_URL, { method: 'POST', body: new URLSearchParams({ code: q.get('code'), grant_type: 'authorization_code',
    code_verifier: pk.verifier, client_id: APP_KEY, redirect_uri: pk.redirect }) });
  const t = await r.json();
  if (!r.ok || !t.refresh_token) throw new Error(t.error_description || t.error || 'Dropbox did not sign in');
  save(K_TOKEN, { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in - 120) * 1000, account_id: t.account_id });
  return true;
}

async function token(force) {
  const t = load(K_TOKEN);
  if (!t || !t.refresh_token) throw Object.assign(new Error('Not signed in'), { signin: true });
  if (!force && t.access_token && Date.now() < t.expires_at) return t.access_token;
  const r = await fetch(TOKEN_URL, { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: APP_KEY }) });
  const n = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 400 || r.status === 401) { signOut(); throw Object.assign(new Error('Dropbox signed this phone out - sign in again'), { signin: true }); }
    throw new Error('Dropbox: ' + (n.error_description || r.status));
  }
  t.access_token = n.access_token;
  t.expires_at = Date.now() + (n.expires_in - 120) * 1000;
  save(K_TOKEN, t);
  return t.access_token;
}

async function call(url, opts, retried) {                       // one request, with a fresh token after a 401 and a wait after a 429
  const tk = await token(false);
  const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + tk }, opts.headers || {}) }));
  if (r.status === 401 && !retried) { await token(true); return call(url, opts, true); }
  if (r.status === 429 && !retried) { await new Promise(ok => setTimeout(ok, 1500)); return call(url, opts, true); }
  return r;
}
async function rpc(name, args) {
  const r = await call(API + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch (e) { /* plain text error */ }
  if (!r.ok) throw Object.assign(new Error(`Dropbox ${name}: ${(body && body.error_summary) || text || r.status}`), { status: r.status, body });
  return body;
}

export async function folderExists(folder) {
  const f = cleanFolder(folder);
  if (!f) return false;
  if (MOCK) return (await (await mock('exists', { path: f })).json()).exists;
  try { const m = await rpc('files/get_metadata', { path: f }); return m['.tag'] === 'folder'; }
  catch (e) { if (e.status === 409) return false; throw e; }
}

export async function listFolder(folder) {                      // the .json files directly in the folder: [{name, path, rev, modified}]
  const f = cleanFolder(folder);
  if (!f) throw new Error('Not the board folder');
  if (MOCK) return (await mock('list', { path: f })).json();
  let res = await rpc('files/list_folder', { path: f, recursive: false, include_deleted: false });
  const out = [];
  for (;;) {
    for (const e of res.entries) if (e['.tag'] === 'file' && /\.json$/i.test(e.name))
      out.push({ name: e.name, path: e.path_display, rev: e.rev, modified: Date.parse(e.server_modified) / 1000 });
    if (!res.has_more) break;
    res = await rpc('files/list_folder/continue', { cursor: res.cursor });
  }
  return out;
}

export async function download(folder, path) {
  allowed(folder, path);
  if (MOCK) return (await mock('download', { path })).text();
  const r = await call(CONTENT + 'files/download', { method: 'POST', headers: { 'Dropbox-API-Arg': headerJson({ path }) } });
  if (!r.ok) throw new Error(`Dropbox download ${r.status}`);
  return new TextDecoder('utf-8').decode(await r.arrayBuffer());
}

export async function uploadMine(folder, device, text, keepalive) {   // the ONLY write: <folder>/<device>.json
  if (!/^[a-z0-9]+_[a-z0-9-]+$/.test(device)) throw new Error('Bad device name');
  const path = allowed(folder, cleanFolder(folder) + '/' + device + '.json');
  if (MOCK) return (await mock('upload', { path }, new TextEncoder().encode(text))).json();
  const r = await call(CONTENT + 'files/upload', { method: 'POST', keepalive: !!keepalive,
    headers: { 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': headerJson({ path, mode: 'overwrite', autorename: false, mute: true }) },
    body: new TextEncoder().encode(text) });
  if (!r.ok) throw new Error(`Dropbox upload ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();                                              // {rev, server_modified, ...}
}
