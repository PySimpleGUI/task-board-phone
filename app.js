// app.js - the phone Task Board: screens, taps and the Dropbox sync loop.  The data rules live in engine.js (a port of task_board.pyw);
// Dropbox calls in dropbox.js.  Version and change log: version.js.
import {
  Board, parseFile, palette, acc, accText, chipColors, mix, isLight, goodColor, dueLabel, parseDay, today, iso, addDays, ago, dayShort, monShort,
  THEMES, STORES, PHONE_RE, LINK_RE, C_BOTH, C_SELECT, C_DONE, C_TODAY, C_SOON, C_LATE, C_NEW, userOf, seedDev, APP,
} from './engine.js';
import * as DB from './dropbox.js';

const VERSION = self.APP_VERSION || '?';
const K_SET = 'tb.settings', K_STATE = 'tb.state';
const POLL_MS = 8000, HEARTBEAT_MS = 5 * 60 * 1000, SAVE_DELAY = 1200;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full or private mode */ } };

// ---------- this phone's settings (never shared) ----------
const S = Object.assign({ me: '', device: '', folder: '', theme: 'Toybox', tsize: 100, page: '', who: [], today: false, star: false, showDone: false,
  collapsed: [], lastSec: '' }, lsGet(K_SET, {}));
const saveSettings = () => lsSet(K_SET, S);
const F = { who: new Set(S.who), today: S.today, star: S.star, showDone: S.showDone, query: '' };
const saveFilter = () => { S.who = [...F.who]; S.today = F.today; S.star = F.star; S.showDone = F.showDone; saveSettings(); };

let B = null;                                                   // the Board (engine.js)
let P = palette(S.theme);
const UI = { sel: null, layers: [], adding: null, toast: null, toastTimer: null, notesDirty: false, notesBase: '', titleBase: '', notesTimer: null,
  pickMsg: null, editStep: null, newVersion: '', pulse: 0, sheetKind: '' };
const Sync = { busy: false, again: false, timer: null, saveTimer: null, error: '', savedAt: 0, lastOk: 0, started: false };

// ---------- icons: the desktop board's line icons, as SVG on the same 24-unit grid ----------
function starPts() {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.3 : 10.2; pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12.8 + r * Math.sin(a)).toFixed(2)}`); }
  return pts.join(' ');
}
const STAR = starPts();
function ic(name, color = 'currentColor', size = 18, extra = '#ffffff') {
  const s = `stroke="${color}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const f = `fill="${color}"`;
  const body = {
    box: `<rect x="3" y="3" width="18" height="18" rx="5" ${s} stroke-width="2.1"/>`,
    boxon: `<rect x="2.5" y="2.5" width="19" height="19" rx="5.5" ${f}/><polyline points="7,12.5 10.5,16 17,8.5" stroke="${extra}" fill="none" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    check: `<polyline points="4,12.5 9.5,18 20,6.5" ${s} stroke-width="2.8"/>`,
    seen: `<polyline points="1.5,13 6,17.5 14.5,7.5" ${s} stroke-width="2.2"/><polyline points="10.5,16.5 11.5,17.5 21.5,7.5" ${s} stroke-width="2.2"/>`,
    star: `<polygon points="${STAR}" ${f}/>`,
    staro: `<polygon points="${STAR}" ${s} stroke-width="1.9"/>`,
    chat: `<rect x="2.5" y="3.5" width="19" height="13.5" rx="4.5" ${f}/><polygon points="6.5,15.5 6.5,21.5 12.5,16" ${f}/>`,
    phone: `<rect x="6.5" y="2" width="11" height="20" rx="3" ${s} stroke-width="2.1"/><line x1="10" y1="18.2" x2="14" y2="18.2" ${s} stroke-width="2"/>`,
    cal: `<rect x="3" y="5" width="18" height="16" rx="3" ${s} stroke-width="2.1"/><rect x="4" y="6" width="16" height="4" ${f}/><line x1="8" y1="2.5" x2="8" y2="7" ${s} stroke-width="2.2"/><line x1="16" y1="2.5" x2="16" y2="7" ${s} stroke-width="2.2"/>`,
    lock: `<path d="M7.2 11V8.5a4.8 4.8 0 0 1 9.6 0V11" ${s} stroke-width="2.4"/><rect x="4.5" y="10" width="15" height="11.5" rx="2.5" ${f}/>`,
    list: [6, 12, 18].map(y => `<line x1="10" y1="${y}" x2="21" y2="${y}" ${s} stroke-width="2"/><polyline points="2.5,${y} 4.5,${y + 2} 7.5,${y - 2}" ${s} stroke-width="1.8"/>`).join(''),
    chev_d: `<polyline points="6,9 12,15 18,9" ${s} stroke-width="2.6"/>`,
    chev_r: `<polyline points="9,6 15,12 9,18" ${s} stroke-width="2.6"/>`,
    plus: `<line x1="12" y1="4.5" x2="12" y2="19.5" ${s} stroke-width="2.6"/><line x1="4.5" y1="12" x2="19.5" y2="12" ${s} stroke-width="2.6"/>`,
    x: `<line x1="6" y1="6" x2="18" y2="18" ${s} stroke-width="2.4"/><line x1="18" y1="6" x2="6" y2="18" ${s} stroke-width="2.4"/>`,
    trash: `<line x1="3.5" y1="6.5" x2="20.5" y2="6.5" ${s} stroke-width="2"/><polyline points="9,6.5 9.5,3.5 14.5,3.5 15,6.5" ${s} stroke-width="1.8"/><polyline points="6,6.5 7.2,20.5 16.8,20.5 18,6.5" ${s} stroke-width="2"/><line x1="10" y1="10" x2="10" y2="17" ${s} stroke-width="1.6"/><line x1="14" y1="10" x2="14" y2="17" ${s} stroke-width="1.6"/>`,
    bell: `<path d="M5.5 9.5a6.5 6.5 0 0 1 13 0L20.5 17.5H3.5Z" ${f}/><circle cx="12" cy="19.5" r="2.5" ${f}/>`,
    search: `<circle cx="9.75" cy="9.75" r="6.25" ${s} stroke-width="2.3"/><line x1="14.5" y1="14.5" x2="20.5" y2="20.5" ${s} stroke-width="2.8"/>`,
    cart: `<polyline points="2,4 5.5,4 8,15.5 18.5,15.5 20.8,7.5 6.6,7.5" ${s} stroke-width="2.1"/><circle cx="9.5" cy="19.5" r="1.9" ${f}/><circle cx="17" cy="19.5" r="1.9" ${f}/>`,
    link: `<rect x="2.5" y="8.5" width="11" height="7" rx="3.5" ${s} stroke-width="2.1"/><rect x="10.5" y="8.5" width="11" height="7" rx="3.5" ${s} stroke-width="2.1"/>`,
    send: `<polygon points="2.5,11 21.5,3 14,21.5 11,13.5" ${f}/><line x1="11" y1="13.5" x2="21.5" y2="3" stroke="${extra}" stroke-width="1.3"/>`,
    dot: `<circle cx="12" cy="12" r="7" ${f}/>`,
    copy: `<rect x="8" y="8" width="13" height="13" rx="2.5" ${s} stroke-width="2"/><polyline points="5,16 3.5,16 3.5,3.5 16,3.5 16,5" ${s} stroke-width="2"/>`,
    undo: `<path d="M7 9.5A8 7 0 1 1 9 18" ${s} stroke-width="2.4"/><polygon points="2.5,6.5 9.5,6.5 6,12.5" ${f}/>`,
    person: `<circle cx="12" cy="7.5" r="4.5" ${f}/><path d="M3.5 22a8.5 8.5 0 0 1 17 0Z" ${f}/>`,
    arrow: `<line x1="4" y1="12" x2="19" y2="12" ${s} stroke-width="2.4"/><polyline points="13,6 19,12 13,18" ${s} stroke-width="2.4"/>`,
    back: `<line x1="20" y1="12" x2="5" y2="12" ${s} stroke-width="2.4"/><polyline points="11,6 5,12 11,18" ${s} stroke-width="2.4"/>`,
    menu: `<line x1="4" y1="6.5" x2="20" y2="6.5" ${s} stroke-width="2.4"/><line x1="4" y1="12" x2="20" y2="12" ${s} stroke-width="2.4"/><line x1="4" y1="17.5" x2="20" y2="17.5" ${s} stroke-width="2.4"/>`,
    sync: `<path d="M19.5 9A8 8 0 0 0 5 7.5M4.5 15A8 8 0 0 0 19 16.5" ${s} stroke-width="2.2"/><polyline points="19.5,3.5 19.5,9 14,9" ${s} stroke-width="2.2"/><polyline points="4.5,20.5 4.5,15 10,15" ${s} stroke-width="2.2"/>`,
    palette: `<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.5-1-2.6 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z" ${s} stroke-width="2"/><circle cx="7.5" cy="11" r="1.4" ${f}/><circle cx="10" cy="7" r="1.4" ${f}/><circle cx="14.5" cy="7" r="1.4" ${f}/>`,
    info: `<circle cx="12" cy="12" r="9" ${s} stroke-width="2"/><line x1="12" y1="11" x2="12" y2="16.5" ${s} stroke-width="2.4"/><circle cx="12" cy="7.5" r="1.4" ${f}/>`,
    text: `<polyline points="4,7 4,4.5 15,4.5 15,7" ${s} stroke-width="2.2"/><line x1="9.5" y1="4.5" x2="9.5" y2="19" ${s} stroke-width="2.2"/><polyline points="14,13 14,11.5 21,11.5 21,13" ${s} stroke-width="2"/><line x1="17.5" y1="11.5" x2="17.5" y2="19" ${s} stroke-width="2"/>`,
    out: `<path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" ${s} stroke-width="2.1"/><line x1="10" y1="12" x2="21" y2="12" ${s} stroke-width="2.2"/><polyline points="17,8 21,12 17,16" ${s} stroke-width="2.2"/>`,
    move: `<polyline points="4,8 4,19 20,19 20,8" ${s} stroke-width="2"/><line x1="12" y1="3" x2="12" y2="14" ${s} stroke-width="2.2"/><polyline points="8,10 12,14 16,10" ${s} stroke-width="2.2"/>`,
    open: `<rect x="3.5" y="3.5" width="17" height="17" rx="3" ${s} stroke-width="2"/><line x1="8" y1="9" x2="16" y2="9" ${s} stroke-width="2"/><line x1="8" y1="13" x2="16" y2="13" ${s} stroke-width="2"/><line x1="8" y1="17" x2="13" y2="17" ${s} stroke-width="2"/>`,
  }[name] || '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

// ---------- colors from the theme ----------
const A = c => acc(P, c);
const AT = c => accText(P, c);
function chip(text, { color = null, fill = null, fg = null, icon = null, cls = '', attrs = '' } = {}) {
  if (color && !fill) { const cc = chipColors(P, A(color)); fill = cc[0]; fg = fg || cc[1]; }
  const st = (fill ? `background:${fill};` : '') + (fg ? `color:${fg};` : '');
  return `<span class="chip ${text ? '' : 'icononly'} ${cls}" style="${st}" ${attrs}>${icon ? ic(icon, fg || P.dim, 13) : ''}${esc(text)}</span>`;
}
function pill(text, { on = false, color = null, icon = null, act = '', ref = '', tag = 'button', href = '' } = {}) {
  let st = '', fg = P.text;
  if (on) { const c = A(color || C_SELECT); fg = isLight(c) ? '#1b1206' : '#ffffff'; st = `background:${c};color:${fg};`; }
  else if (color) { fg = AT(color); st = `color:${fg};`; }
  const inner = `${icon ? ic(icon, fg, 16) : ''}${text ? `<span>${esc(text)}</span>` : ''}`;
  if (tag === 'a') return `<a class="pill" style="${st}" href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>`;
  return `<button class="pill" style="${st}" data-act="${act}" data-ref="${esc(ref)}">${inner}</button>`;
}
function applyTheme() {
  P = palette(S.theme);
  const r = document.documentElement.style;
  const set = { bg: P.bg, strip: P.strip, panel: P.panel, line: P.line, card: P.cardbg, 'card-line': P.card_line, 'card-done': P.card_done, field: P.field,
    'field-line': P.field_line, chip: P.chip, 'chip-hover': P.chip_hover, text: P.text, dim: P.dim, faint: P.faint, accent: A(C_SELECT), new: A(C_NEW), done: A(C_DONE) };
  for (const [k, v] of Object.entries(set)) r.setProperty('--' + k, v);
  r.setProperty('--k', String(S.tsize / 100));
  r.setProperty('color-scheme', P.light ? 'light' : 'dark');
  document.querySelector('meta[name=theme-color]').setAttribute('content', P.strip);
  // the fixed buttons' icons, in this theme's colors
  $('#fab').innerHTML = ic('plus', '#ffffff', 28);
  document.querySelectorAll('[data-act=back]').forEach(b => { b.innerHTML = ic('back', P.text, 22); });
  document.querySelectorAll('.send').forEach(b => { b.innerHTML = ic('send', '#ffffff', 20, A(C_SELECT)); });
  document.querySelector('[data-act=clearsearch]').innerHTML = ic('x', P.dim, 18);
  document.querySelector('#searchRow .sicon').innerHTML = ic('search', P.dim, 18);
  document.querySelector('.addstep .plus').innerHTML = ic('plus', P.faint, 15);
}

// ---------- the people ----------
function whoChip(it, done) {
  if (!it.who) return '';
  const p = B.person(it.who);
  return chip(p[1].toUpperCase(), { color: done ? null : goodColor(p[2]) });
}
function peerText() {                                           // "Mike's PC 2 min ago"
  const latest = {};
  for (const [dev, t] of Object.entries(B.shared.peers)) {
    const u = userOf(dev);
    if (u === B.me || u === 'claude') continue;
    if (!latest[u] || t > latest[u][0]) latest[u] = [t, dev];
  }
  const best = Object.entries(latest).sort((a, b) => b[1][0] - a[1][0])[0];
  if (!best) return `waiting for ${B.otherPeople().map(p => p[1]).join(' & ') || 'others'}`;
  const [u, [t, dev]] = best;
  return `${B.person(u)[1]}’s ${/_phone/.test(dev) ? 'phone' : 'PC'} ${ago(t)}`;
}
function syncState() {
  if (Sync.error) return [C_LATE, navigator.onLine === false ? 'Offline - your changes wait on this phone' : Sync.error];
  if (B.shared.dirtyAt && Date.now() - B.shared.dirtyAt > 30000) return [C_SOON, 'Not saved to Dropbox yet - trying again…'];
  if (B.shared.dirtyAt) return [C_SOON, 'Saving…'];
  if (!Sync.lastOk) return [C_SOON, 'Connecting to Dropbox…'];
  return [C_DONE, `Synced  ·  ${peerText()}`];
}

// ============================================================ RENDERING ============================================================
function renderAll() {
  if (!B) return;
  renderHeader();
  renderPages();
  renderFilters();
  renderBoard();
  if (isOpen('card')) renderCard();
  if (isOpen('new')) renderNew();
  document.title = (B.unseenCount() ? `(${B.unseenCount()}) ` : '') + (B.board.title || APP);
}

function renderHeader() {
  const [color, text] = syncState();
  const n = B.unseenCount();
  const me = B.person(B.me);
  $('#hdr').innerHTML = `
    <div class="hrow">
      <img class="hicon" src="icons/icon-192.png" alt="">
      <div class="htitle">${esc(B.board.title || APP)}</div>
      ${UI.newVersion ? `<button class="hchip" data-act="update" style="background:${A(C_SELECT)};color:#fff">${ic('undo', '#fff', 15)}Update</button>` : ''}
      ${n ? `<button class="hchip" data-act="whatsnew" style="background:${A(C_NEW)};color:#1b1206">${ic('bell', '#1b1206', 15)}${n} new</button>` : ''}
      <button class="iconbtn" data-act="menu" aria-label="Menu">${ic('menu', P.text, 22)}</button>
    </div>
    <button class="hsync ${Date.now() - UI.pulse < 1300 ? 'pulse' : ''}" data-act="syncnow" style="--pc:${A(color)}">
      <span class="dot" style="background:${A(color)}"></span><span>${esc(text)}</span>
      <span style="margin-left:auto;color:${P.faint}">${esc(me[1])}</span>
    </button>`;
}

function currentPage() {
  let pg = B.pages.find(p => p.id === S.page);
  if (!pg) { pg = B.pages[0]; S.page = pg.id; }
  return pg;
}
function openCount(pid) { return (B.secs[pid] || []).reduce((n, s) => n + (B.items[s.id] || []).filter(it => !it.done).length, 0); }

function renderPages() {
  const cur = currentPage();
  const sids = (B.secs[cur.id] || []).map(s => s.id);
  const folded = sids.length && sids.every(id => S.collapsed.includes(id));
  $('#pages').innerHTML = B.pages.map(pg => {
    const c = goodColor(pg.color, '#2ecc71');
    const on = pg.id === cur.id;
    const word = pg.kind === 'buy' ? 'to buy' : 'to do';
    return `<button class="ptab ${on ? '' : 'off'}" data-act="page" data-ref="${esc(pg.id)}">
      <span class="pname" style="color:${AT(c)};--mk:${mix(A(c), P.bg, 0.45)}">${esc(pg.name || 'Page')}</span><span class="pcount">${openCount(pg.id)} ${word}</span></button>`;
  }).join('') + `<button class="pfold" data-act="pagefold" style="background:${mix(P.bg, A(goodColor(cur.color, '#2ecc71')), 0.2)}" aria-label="Fold or open every section">
      ${ic(folded ? 'chev_r' : 'chev_d', AT(goodColor(cur.color, '#2ecc71')), 15)}</button>`;
}

function fchip(text, on, color, icon, act, ref = '') {
  let fill, fg;
  if (on) { const c = A(color || C_SELECT); fill = c; fg = isLight(c) ? '#1b1206' : '#ffffff'; }
  else { fill = mix(P.strip, P.text, 0.07); fg = color ? AT(color) : P.text; }
  return `<button class="hchip" data-act="${act}" data-ref="${esc(ref)}" style="background:${fill};color:${fg}">${icon ? ic(icon, fg, 14) : ''}${esc(text)}</button>`;
}
function renderFilters() {
  const c = B.counts();
  let h = fchip(`Everyone  ${c.all}`, !F.who.size, null, null, 'who', 'all');
  for (const [pid, name, color] of B.people) h += fchip(`${name}  ${c[pid]}`, F.who.has(pid), goodColor(color), 'person', 'who', pid);
  if (c.nobody || F.who.has('nobody')) h += fchip(`Nobody  ${c.nobody}`, F.who.has('nobody'), '#9aa5b5', null, 'who', 'nobody');
  h += '<span class="fsep"></span>';
  h += fchip(`Today  ${c.today}`, F.today, C_TODAY, 'cal', 'ftoday');
  h += fchip(`Starred  ${c.star}`, F.star, C_SOON, 'star', 'fstar');
  h += fchip('Done', F.showDone, C_DONE, 'check', 'fdone');
  h += fchip('', !!F.query, null, 'search', 'search');
  $('#filters').innerHTML = h;
}

function phoneMarked(text) {                                    // phone numbers in a title get underlined, like the desktop
  let out = '', last = 0;
  for (const m of String(text).matchAll(PHONE_RE)) { out += esc(text.slice(last, m.index)) + `<span class="ph">${esc(m[0])}</span>`; last = m.index + m[0].length; }
  return out + esc(text.slice(last));
}
function cardHTML(it) {
  const done = !!it.done;
  const unseen = B.isUnseen(it);
  const title = (it.title || '').trim() || '(no title)';
  const note = (it.notes || '').split('\n').map(l => l.trim()).find(Boolean) || '';
  const meta = [];
  const [due, dcol] = dueLabel(it.due);
  if (due && !done) meta.push(chip(due, { color: dcol, icon: 'cal' }));
  if (it.shop) meta.push(chip(it.shop, { color: done ? null : storeColor(it.shop), icon: 'cart' }));
  const phones = (it.notes || '').match(PHONE_RE) || [];
  if (phones.length && !(title.match(PHONE_RE) || []).length && !title.includes(phones[0])) meta.push(chip(phones[0], { icon: 'phone' }));
  const checks = B.checks[it.id] || [];
  if (checks.length) { const n = checks.filter(c => c.done).length; meta.push(chip(`${n}/${checks.length}`, { color: n === checks.length ? C_DONE : null, icon: 'list' })); }
  const msgs = B.comments[it.id] || [];
  if (msgs.length) {
    meta.push(B.unseenMessages(it.id).length ? chip(String(msgs.length), { fill: A(C_NEW), fg: '#1b1206', icon: 'chat', attrs: 'data-act="tochat"' })
      : chip(String(msgs.length), { icon: 'chat', attrs: 'data-act="tochat"' }));
  }
  return `<div class="card ${done ? 'done' : ''} ${unseen ? 'new' : ''}" data-cid="${esc(it.id)}">
    <button class="box" data-act="done" aria-label="${done ? 'Uncheck' : 'Check off'}">${ic(done ? 'boxon' : 'box', done ? A(C_DONE) : P.dim, 20)}</button>
    <div class="cbody" data-act="open">
      <div class="ctitle">${phoneMarked(title)}</div>
      ${note ? `<div class="cnote">${esc(note)}</div>` : ''}
      ${meta.length ? `<div class="cmeta">${meta.join('')}</div>` : ''}
    </div>
    <div class="cright">
      ${it.star ? `<button data-act="star" aria-label="Star">${ic('star', done ? P.dim : A(C_SOON), 18)}</button>` : ''}
      ${it.who ? `<button data-act="cyclewho">${whoChip(it, done)}</button>` : ''}
    </div>
    ${unseen ? '<span class="newdot"></span>' : ''}
  </div>`;
}
const storeColor = name => (STORES.find(([n]) => n.toLowerCase() === String(name).toLowerCase()) || [0, '#9aa5b5'])[1];

function sectionHTML(s) {
  const color = A(goodColor(s.color));
  const line = mix(color, P.bg, 0.2), fill = mix(P.bg, color, P.light ? 0.075 : 0.065);
  const folded = S.collapsed.includes(s.id);
  const all = B.items[s.id] || [];
  const opens = all.filter(it => !it.done);
  let counts = '';
  if (all.length && !opens.length) counts = chip('All done', { color: C_DONE, icon: 'check' });
  else {
    for (const pid of [...B.people.map(p => p[0]), 'both', '']) {
      const n = opens.filter(it => (it.who || '') === pid).length;
      if (!n) continue;
      const pc = pid ? goodColor(B.person(pid)[2]) : '#9aa5b5';
      const [f, fg] = chipColors(P, A(pc));
      counts += chip(String(n), { fill: f, fg, icon: pid ? 'person' : null });
    }
  }
  const shown = B.shownItems(s.id, F);
  let body = '';
  if (!folded) {
    body = `<div class="sbody">${shown.map(cardHTML).join('') || (all.length && filtering() ? '' : '<div class="sempty">Nothing here - add a card</div>')}</div>`;
    if (UI.adding === s.id) {
      body += `<div class="addbox"><input id="addInput" placeholder="Add a card to ${esc(s.name || '')}" enterkeyhint="enter" autocomplete="off">
        <div class="addhint">Enter adds it  ·  ${B.people.map(p => '@' + p[1].toLowerCase()).join(' or ')} gives it to someone  ·  ! stars it</div></div>`;
    } else if (!s.virtual) {
      body += `<button class="sfoot" data-act="add" data-ref="${esc(s.id)}">${ic('plus', P.faint, 15)}Add a card</button>`;
    } else body += '<div style="height:8px"></div>';
  }
  return `<div class="sec" style="--sline:${line};--sfill:${fill}" data-sid="${esc(s.id)}">
    <button class="shead" data-act="fold" data-ref="${esc(s.id)}">${ic(folded ? 'chev_r' : 'chev_d', color, 15)}
      <span class="sname" style="color:${AT(color)}">${esc((s.name || 'Section').toUpperCase())}</span><span class="scounts">${counts}</span></button>
    ${body}</div>`;
}
const filtering = () => F.who.size || F.today || F.star || !!F.query.trim();

function renderBoard() {
  const pg = currentPage();
  const secs = B.secs[pg.id] || [];
  const keepAdd = UI.adding && document.activeElement && document.activeElement.id === 'addInput' ? document.activeElement.value : null;
  let html = secs.map(s => (filtering() && !B.shownItems(s.id, F).length && UI.adding !== s.id) ? '' : sectionHTML(s)).join('');
  if (!html) html = `<div class="pnote">${secs.length ? 'No cards here match what is picked above' : 'No sections on this page yet - add them on the desktop board'}</div>`;
  $('#board').innerHTML = html;
  const inp = $('#addInput');
  if (inp) { if (keepAdd !== null) inp.value = keepAdd; inp.focus(); }
}

// ---------- the open card ----------
function renderCard() {
  const it = B.ents[UI.sel];
  if (!it || it.deleted || it.type !== 'item') { closeLayer('card'); return; }
  const sec = B.sectionOf(it), page = B.pageOf(sec);
  const sc = A(goodColor(sec.color));
  const scroller = $('#cardScroll'), keepY = scroller.scrollTop;   // a redraw (e.g. after a sync) keeps the reader's place
  $('#crumb').innerHTML = `${ic('dot', sc, 12)}<span style="color:${AT(sc)}">${esc((page.name || '').toUpperCase())}  ›  ${esc((sec.name || '').toUpperCase())}</span>`;
  // the big done button
  const done = !!it.done;
  let text = 'Mark done';
  if (done) {
    const who = it.done_by ? B.person(it.done_by)[1] : '';
    text = 'Done' + (who ? `  ·  ${who}` : '') + (it.done_at ? `  ·  ${ago(parseFloat(it.done_at))}` : '');
  }
  $('#cTop').innerHTML = `<button class="bigdone" data-act="carddone" style="${done ? `background:${A(C_DONE)};color:#fff` : ''}">
    ${ic(done ? 'boxon' : 'box', done ? '#fff' : P.dim, 22, done ? A(C_DONE) : '#fff')}<span>${esc(text)}</span></button>`;
  // title and notes: never overwrite what's being typed
  const et = $('#edTitle'), en = $('#edNotes');
  if (document.activeElement !== et && (it.title || '') !== UI.titleBase) { et.value = it.title || ''; UI.titleBase = it.title || ''; }
  if (document.activeElement !== en && !UI.notesDirty && (it.notes || '') !== UI.notesBase) { en.value = it.notes || ''; UI.notesBase = it.notes || ''; }
  grow(et); grow(en);
  // who / due / mark / where
  const cur = it.who || '';
  let h = `<div class="prow"><div class="plabel">WHO</div><div class="pills">`;
  for (const [pid, name, color] of B.whoChoices()) h += pill(name, { on: cur === pid, color: goodColor(color), icon: 'person', act: 'setwho', ref: pid });
  h += pill(B.person('both')[1], { on: cur === 'both', color: C_BOTH, act: 'setwho', ref: 'both' });
  h += pill('Nobody', { on: !cur, act: 'setwho', ref: '' }) + '</div></div>';
  const d = parseDay(it.due), td = today();
  const monday = addDays(td, ((8 - td.getDay()) % 7) || 7);
  const quick = [['Today', td], ['Tomorrow', addDays(td, 1)], [`${dayShort(monday)} ${monday.getDate()}`, monday]];
  h += `<div class="prow"><div class="plabel">DUE</div><div class="pills">`;
  for (const [t, day] of quick) h += pill(t, { on: d && iso(d) === iso(day), color: dueLabel(iso(day))[1] || C_SELECT, icon: t === 'Today' ? 'cal' : null, act: 'due', ref: iso(day) });
  if (d && !quick.some(q => iso(q[1]) === iso(d))) h += pill(`${dayShort(d)} ${monShort(d)} ${d.getDate()}`, { on: true, color: dueLabel(it.due)[1] || C_SELECT, act: 'pickdue' });
  else h += pill('Pick…', { icon: 'cal', act: 'pickdue' });
  if (d) h += pill('', { icon: 'x', act: 'due', ref: '' });
  h += `</div></div><div class="prow"><div class="plabel">MARK</div><div class="pills">`;
  h += pill('Star', { on: !!it.star, color: C_SOON, icon: it.star ? 'star' : 'staro', act: 'cardstar' }) + '</div></div>';
  if (page.kind === 'buy' || it.shop) {
    const shop = it.shop || '';
    h += `<div class="prow"><div class="plabel">WHERE</div><div class="pills">`;
    for (const [n, c] of STORES) h += pill(n, { on: shop.toLowerCase() === n.toLowerCase(), color: c, act: 'shop', ref: n });
    if (shop && !STORES.some(([n]) => n.toLowerCase() === shop.toLowerCase())) h += pill(shop, { on: true, color: '#9aa5b5', act: 'shop', ref: shop });
    else h += pill('Other…', { act: 'othershop' });
    h += '</div></div>';
  }
  $('#cProps').innerHTML = h;
  // phone numbers and links in the notes
  const found = [];
  for (const m of ((it.title || '') + '\n' + (it.notes || '')).matchAll(PHONE_RE)) found.push(pill(m[0], { icon: 'phone', tag: 'a', href: 'tel:' + m[0].replace(/[^\d+]/g, '') }));
  for (const m of (it.notes || '').matchAll(LINK_RE)) {
    const url = m[0].startsWith('http') ? m[0] : 'https://' + m[0];
    found.push(pill(m[0].replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 40), { icon: 'link', tag: 'a', href: url }));
  }
  $('#cLinks').innerHTML = found.length ? `<div class="linkpills">${found.slice(0, 6).join('')}</div>` : '';
  // checklist (not while a step is being edited)
  if (!(UI.editStep && document.activeElement && document.activeElement.id === 'edStepText')) {
    const checks = B.checks[it.id] || [];
    const nd = checks.filter(c => c.done).length;
    let ch = `<div class="label">CHECKLIST${checks.length ? `   ${nd} / ${checks.length}` : ''}</div>`;
    if (checks.length) ch += `<div class="progress"><div style="width:${(100 * nd / checks.length).toFixed(1)}%"></div></div>`;
    for (const c of checks) {
      if (UI.editStep === c.id) {
        ch += `<div class="step"><span class="sbox">${ic(c.done ? 'boxon' : 'box', c.done ? A(C_DONE) : P.dim, 20)}</span><input id="edStepText" value="${esc(c.text || '')}" enterkeyhint="done"></div>`;
        continue;
      }
      ch += `<div class="step ${c.done ? 'sdone' : ''}"><button class="sbox" data-act="tick" data-ref="${esc(c.id)}">${ic(c.done ? 'boxon' : 'box', c.done ? A(C_DONE) : P.dim, 20)}</button>
        <div class="stext" data-act="editstep" data-ref="${esc(c.id)}">${esc(c.text || '')}</div>
        <button class="sdel" data-act="delstep" data-ref="${esc(c.id)}" aria-label="Delete step">${ic('x', P.faint, 15)}</button></div>`;
    }
    $('#cChecks').innerHTML = ch;
    const es = $('#edStepText');
    if (es && UI.editStep) { es.focus(); }
  }
  // the conversation
  const msgs = B.comments[it.id] || [];
  const others = B.otherPeople().map(p => p[1]).join(' & ') || 'the other person';
  $('#cChat').innerHTML = `<div class="label">CONVERSATION</div>` + (msgs.length ? messagesHTML(msgs)
    : `<div class="hint">No messages yet. Write one below - ${esc(others)} sees it on this card, and the card glows on their board until they look.</div>`);
  // who made it
  const f = it._f;
  const when = it.created_at ? ago(parseFloat(it.created_at)) : '';
  const seeded = it.created_by === 'claude' && seedDev((f.type || [null, 0, ''])[2]);
  const made = it.created_by && !seeded ? `Added by ${B.person(it.created_by)[1]} ${when}` : 'From the journal page';
  let last = [0, ''];
  for (const [, t, dv] of Object.values(f)) if (!seedDev(dv) && t > last[0]) last = [t, dv];
  $('#cFoot').innerHTML = `<div class="foot">${esc(made)}${last[0] ? `   ·   last changed by ${esc(B.person(userOf(last[1]))[1])} ${esc(ago(last[0] / 1e6))}` : ''}</div>
    <div class="linkpills" style="margin-top:12px">${pill('Move to…', { icon: 'move', act: 'moveto' })}${pill('Copy', { icon: 'copy', act: 'copycard' })}
    ${pill('Mark unread', { icon: 'bell', act: 'unread' })}${pill('Delete card', { icon: 'trash', act: 'delcard', color: '#ff5c5c' })}</div>`;
  $('#edMsg').placeholder = `Message ${others}…`;
  if (scroller.scrollTop !== keepY) scroller.scrollTop = keepY;
}

function messagesHTML(msgs) {
  let lastMineSeen = null;
  for (const c of msgs) if (c.author === B.me && B.otherPeople().some(p => c['seen_' + p[0]])) lastMineSeen = c.id;
  let h = '<div class="msgs">';
  for (const c of msgs) {
    const mine = c.author === B.me;
    const pr = B.person(c.author);
    const color = A(goodColor(pr[2]));
    const fill = mix(P.panel, color, P.light ? 0.15 : 0.2), line = mix(color, P.panel, 0.45);
    const picked = UI.pickMsg === c.id;
    h += `<div class="bubble ${mine ? 'mine' : ''} ${picked ? 'picked' : ''}" style="background:${fill};border-color:${line}" ${mine ? `data-act="pickmsg" data-ref="${esc(c.id)}"` : ''}>
      <div class="bhead"><span class="bname" style="color:${AT(color)}">${esc(pr[1])}</span><span class="btime">${esc(ago(parseFloat(c.at) || 0))}</span></div>
      <div class="btext">${esc(c.text || '')}</div></div>`;
    if (picked) h += `<div class="bdel">${pill('Delete this message', { icon: 'trash', act: 'delmsg', ref: c.id, color: '#ff5c5c' })}</div>`;
    if (c.id === lastMineSeen) h += `<div class="seen">${ic('seen', A(C_DONE), 14)}Seen</div>`;
  }
  return h + '</div>';
}

// ---------- what's new ----------
function renderNew() {
  const events = B.activity(30);
  const others = B.otherPeople().map(p => p[1]).join(' & ') || 'others';
  const isNew = (t, target) => t > B.seenAll && (target === null || target === 'board' || t > (B.seen[target] || 0));
  const fresh = events.some(ev => B.unread.has(ev[3]) || isNew(ev[0], ev[3]));
  $('#seenAllBtn').innerHTML = fresh ? pill('Mark all seen', { icon: 'seen', act: 'seenall' }) : '';
  let h = '';
  if (!events.length) h = `<div class="hint">Nothing from ${esc(others)} yet. When ${esc(others)} checks something off, adds a card or writes a message, it shows up here - and on the board it glows gold until you have looked at it.</div>`;
  const lit = new Set();
  for (const [t, u, text, target] of events.slice(0, 30)) {
    let nw = isNew(t, target);
    if (B.unread.has(target) && !lit.has(target)) { nw = true; lit.add(target); }
    const pr = B.person(u);
    const go = target && (B.ents[target] || target === 'board');
    h += `<button class="ev ${nw ? 'fresh' : ''}" ${go ? `data-act="goto" data-ref="${esc(target)}"` : ''}>
      <span class="edot" style="background:${A(goodColor(pr[2]))}"></span>
      <span class="etext">${esc(pr[1] + ' ' + text)}<span class="ewhen">${esc(ago(t / 1e6))}</span></span>${nw ? '<span class="enew"></span>' : ''}</button>`;
  }
  $('#newList').innerHTML = h;
  const msgs = B.comments.board || [];
  $('#boardMsgs').innerHTML = `<div class="divider"></div><div class="label">MESSAGES  -  NOT ABOUT ONE CARD</div>` +
    (msgs.length ? messagesHTML(msgs.slice(-40)) : `<div class="hint">Anything for ${esc(others)} that isn't about one card goes here - type it below.</div>`);
  $('#edBoardMsg').placeholder = `Message ${others}…`;
  // shown = read: the writer gets 'Seen'
  let marked = false;
  for (const c of msgs) if (B.byOther(c) && !c['seen_' + B.me]) { c._st.put(c.id, { ['seen_' + B.me]: true }); marked = true; }
  if (marked) { B.rebuild(); localChange(false); }
}

// ============================================================ LAYERS (screens and sheets) + the Back button ============================================================
const isOpen = name => UI.layers.includes(name);
function openLayer(name) {
  if (isOpen(name)) return;
  UI.layers.push(name);
  history.pushState({ tb: UI.layers.length }, '');
  showLayers();
}
let popWaiters = [];
function closeLayer(name) {                                     // close it (and anything above it) - through history so Back stays in step.
  const i = UI.layers.indexOf(name);                            // Returns a promise: open the next thing only once the history has moved
  if (i < 0) return Promise.resolve();
  const n = UI.layers.length - i;
  return new Promise(ok => {
    let done = false;
    popWaiters.push(() => { done = true; ok(); });
    history.go(-n);
    setTimeout(() => {                                          // the history didn't move (it can happen): close it here anyway
      if (!done && UI.layers.length > i) {
        dropLayers(UI.layers.length - i);
        history.replaceState({ tb: UI.layers.length }, '');      // so the phone's Back button stays in step
        const w = popWaiters; popWaiters = []; w.forEach(f => f());
      }
    }, 500);
  });
}
function dropLayers(n) {                                        // popstate: the top n layers are gone
  for (let k = 0; k < n && UI.layers.length; k++) {
    const name = UI.layers.pop();
    if (name === 'card') leaveCard();
    if (name === 'sheet') { UI.sheetKind = ''; }
  }
  showLayers();
}
window.addEventListener('popstate', e => {
  const depth = Math.min((e.state && e.state.tb) || 0, UI.layers.length);
  if (depth < UI.layers.length) dropLayers(UI.layers.length - depth);
  const w = popWaiters;
  popWaiters = [];
  w.forEach(f => f());
});
function showLayers() {
  $('#cardScreen').hidden = !isOpen('card');
  $('#newScreen').hidden = !isOpen('new');
  $('#sheet').hidden = $('#backdrop').hidden = !isOpen('sheet');
  document.body.classList.toggle('inscreen', isOpen('card') || isOpen('new'));
  document.body.classList.toggle('insheet', isOpen('sheet'));
  // a screen under a sheet keeps its place; only the top screen matters for focus
}

// ---------- the card screen ----------
function openCard(cid, toChat = false) {
  if (!B.ents[cid]) return;
  if (isOpen('card') && UI.sel !== cid) leaveCard();
  UI.sel = cid;
  UI.pickMsg = null; UI.editStep = null; UI.notesDirty = false;
  UI.titleBase = '\u0000'; UI.notesBase = '\u0000';               // forces the boxes to load
  $('#edMsg').value = (UI.drafts || {})[cid] || '';
  if (B.markSeen(cid)) localChange(false);
  persist();
  if (!isOpen('card')) openLayer('card');
  renderCard();
  renderBoard(); renderHeader();
  const sc = $('#cardScroll');
  requestAnimationFrame(() => { sc.scrollTop = toChat ? $('#cChat').offsetTop - 60 : 0; grow($('#edTitle')); grow($('#edNotes')); });
}
function leaveCard() {                                          // the card screen closes: save what was typed
  saveTitle(); saveNotes();
  UI.drafts = UI.drafts || {};
  if (UI.sel) { const t = $('#edMsg').value; if (t.trim()) UI.drafts[UI.sel] = t; else delete UI.drafts[UI.sel]; }
  UI.sel = null; UI.editStep = null; UI.pickMsg = null;
  $('#edStep').value = '';
  if (document.activeElement) document.activeElement.blur();
  renderBoard(); renderHeader();
}
function saveTitle() {
  const it = B.ents[UI.sel];
  if (!it) return;
  const text = $('#edTitle').value.split(/\s+/).filter(Boolean).join(' ');
  if (text && text !== (it.title || '')) { UI.titleBase = text; B.edit(it.id, 'Renamed card', { title: text }); }
}
function saveNotes() {
  clearTimeout(UI.notesTimer);
  if (!UI.notesDirty) return;
  UI.notesDirty = false;
  const it = B.ents[UI.sel];
  if (!it) return;
  const r = B.saveNotes(it.id, $('#edNotes').value, UI.notesBase);
  if (!r) return;
  UI.notesBase = r.notes;
  if (r.who) { $('#edNotes').value = r.notes; grow($('#edNotes')); toast(`${r.who} edited these notes at the same time - both versions kept`); }
}
function grow(t) {                                              // a text box as tall as its text (without jumping the page it's on)
  if (!t) return;
  const sc = t.closest('.scroll'), y = sc ? sc.scrollTop : 0;
  t.style.height = 'auto';
  t.style.height = (t.scrollHeight + 2) + 'px';
  if (sc && sc.scrollTop !== y) sc.scrollTop = y;
}

// ---------- sheets ----------
function sheet(kind, html) {
  UI.sheetKind = kind;
  $('#sheet').innerHTML = '<div class="grab"></div>' + html;
  if (!isOpen('sheet')) openLayer('sheet'); else showLayers();
  $('#sheet').scrollTop = 0;
}
const closeSheet = () => closeLayer('sheet');

function cardMenu(cid) {
  const it = B.ents[cid];
  if (!it) return;
  const unseen = B.isUnseen(it), who = it.who || '', td = today();
  const row = (icon, text, act, ref = cid, cls = '') => `<button class="row ${cls}" data-act="${act}" data-ref="${esc(ref)}">${ic(icon, cls ? '#ff7b7b' : P.dim, 20)}<span>${esc(text)}</span></button>`;
  let h = `<div class="shtitle">${esc(it.title || '(no title)')}</div>`;
  h += row('open', 'Open', 'm_open');
  h += row('bell', unseen ? 'Mark as read' : 'Mark as unread', unseen ? 'm_read' : 'm_unread');
  h += row(it.done ? 'box' : 'check', it.done ? 'Not done yet' : 'Done', 'm_done');
  h += `<div class="prow"><div class="plabel">WHO</div><div class="pills">` + B.whoChoices().map(([pid, name, color]) =>
    pill(name, { on: who === pid, color: goodColor(color), icon: 'person', act: 'm_who', ref: cid + '|' + pid })).join('') +
    pill(B.person('both')[1], { on: who === 'both', color: C_BOTH, act: 'm_who', ref: cid + '|both' }) + pill('Nobody', { on: !who, act: 'm_who', ref: cid + '|' }) + '</div></div>';
  const monday = addDays(td, ((8 - td.getDay()) % 7) || 7);
  h += `<div class="prow"><div class="plabel">DUE</div><div class="pills">` + pill('Today', { act: 'm_due', ref: cid + '|' + iso(td), icon: 'cal' }) +
    pill('Tomorrow', { act: 'm_due', ref: cid + '|' + iso(addDays(td, 1)) }) + pill('Next week', { act: 'm_due', ref: cid + '|' + iso(monday) }) +
    pill('Pick…', { act: 'm_pickdue', ref: cid }) + (it.due ? pill('No date', { act: 'm_due', ref: cid + '|' }) : '') + '</div></div>';
  h += '<div style="height:6px"></div>';
  h += row(it.star ? 'star' : 'staro', it.star ? 'Unstar' : 'Star', 'm_star');
  h += row('move', 'Move to…', 'moveto');
  h += row('copy', 'Copy as text', 'm_copy');
  h += row('trash', 'Delete', 'm_delete', cid, 'danger');
  UI.menuCard = cid;
  sheet('cardmenu', h);
}

function moveSheet(cid) {
  const it = B.ents[cid];
  if (!it) return;
  UI.menuCard = cid;
  let h = `<div class="shtitle">Move “${esc((it.title || '').slice(0, 60))}” to</div>`;
  for (const pg of B.pages) {
    h += `<div class="label">${esc((pg.name || '').toUpperCase())}</div>`;
    for (const s of B.secs[pg.id] || []) {
      if (s.virtual) continue;
      const here = s.id === it.section;
      h += `<button class="row secrow" data-act="m_move" data-ref="${esc(s.id)}" ${here ? 'disabled style="opacity:.5"' : ''}>
        <span class="sdot" style="background:${A(goodColor(s.color))}"></span><span>${esc(s.name || '')}</span>${here ? '<span class="rsub">(here now)</span>' : ''}</button>`;
    }
  }
  sheet('move', h);
}

function addSheet() {                                           // the + button: a card into a section of this page
  const pg = currentPage();
  const secs = (B.secs[pg.id] || []).filter(s => !s.virtual);
  if (!secs.length) { toast('No sections on this page - add one on the desktop board'); return; }
  if (!secs.some(s => s.id === S.lastSec)) S.lastSec = secs[0].id;
  const h = `<div class="shtitle">Add a card</div>
    <input id="quickAdd" class="sheetinput" placeholder="What needs doing?" enterkeyhint="enter" autocomplete="off">
    <div class="addhint">${B.people.map(p => '@' + p[1].toLowerCase()).join(' or ')} gives it to someone  ·  ! stars it</div>
    <div class="label">INTO</div><div class="pills" id="quickSecs">${quickSecsHTML(secs)}</div>
    <div class="btnrow"><button class="btn" data-act="closesheet">Close</button><button class="btn primary" data-act="quickadd">Add</button></div>`;
  sheet('add', h);
  setTimeout(() => $('#quickAdd') && $('#quickAdd').focus(), 60);
}
function quickSecsHTML(secs) {
  return secs.map(s => pill(s.name || 'Section', { on: s.id === S.lastSec, color: goodColor(s.color), act: 'quicksec', ref: s.id })).join('');
}

function menuSheet() {
  const row = (icon, text, act, sub = '') => `<button class="row" data-act="${act}">${ic(icon, P.dim, 20)}<span style="flex:1">${esc(text)}${sub ? `<br><span class="rsub">${esc(sub)}</span>` : ''}</span></button>`;
  const n = B.unseenCount();
  let h = `<div class="shtitle">${esc(B.board.title || APP)}</div>`;
  h += row('bell', "What's new", 'whatsnew', n ? `${n} new` : '');
  h += row('undo', 'Undo', 'undo', B.undoStack.length ? B.undoStack[B.undoStack.length - 1].label : 'nothing to undo');
  h += row('trash', 'Bring back a deleted card…', 'bringback');
  h += row('sync', 'Sync now', 'syncnow', Sync.lastOk ? `last synced ${ago(Sync.lastOk / 1000)}` : '');
  h += row('palette', 'Theme', 'themes', S.theme);
  h += `<div class="prow" style="padding-left:4px">${ic('text', P.dim, 20)}<div class="pills" style="margin-left:10px">` +
    [85, 100, 115, 130].map(p => pill(`${p}%`, { on: S.tsize === p, act: 'tsize', ref: String(p) })).join('') + '</div></div>';
  h += row('info', 'About', 'about', `Task Board for phones ${VERSION}`);
  h += row('out', 'Sign out of Dropbox', 'signout', `${B.person(B.me)[1]} on ${B.device}`);
  sheet('menu', h);
}

function themeSheet() {
  const names = Object.keys(THEMES);
  const sw = n => { const t = THEMES[n]; return `<button class="tsw ${n === S.theme ? 'on' : ''}" data-act="settheme" data-ref="${n}" style="background:${t.card};color:${t.dim}"><b style="color:${t.text}">Aa</b>${n}</button>`; };
  sheet('themes', `<div class="shtitle">Theme</div><div class="label">DARK</div><div class="themes">${names.slice(0, 16).map(sw).join('')}</div>
    <div class="label">LIGHT</div><div class="themes">${names.slice(16).map(sw).join('')}</div>`);
}

function aboutSheet() {
  const log = (self.CHANGE_LOG || []).map(([d, v, t]) => `<div><b>${esc(v)}</b>  ${esc(d)} - ${esc(t)}</div>`).join('');
  sheet('about', `<div class="shtitle">Task Board for phones ${esc(VERSION)}</div>
    <div class="log"><div>This phone: <b>${esc(B.device)}</b> (writes only ${esc(B.device)}.json)</div><div>Board folder: ${esc(S.folder)}</div>
    <div>Dropbox account: ${esc(DB.accountId())}</div><div>Last synced: ${Sync.lastOk ? esc(ago(Sync.lastOk / 1000)) : 'not yet'}</div></div>
    <div class="label">CHANGE LOG</div><div class="log">${log}</div>`);
}

function bringBackSheet() {
  const rows = B.deletedCards();
  UI.bbRows = rows;
  let h = `<div class="shtitle">Bring back a deleted card</div>`;
  if (!rows.length) h += '<div class="hint">No deleted cards.</div>';
  rows.slice(0, 40).forEach(([t, d, cid, st], i) => {
    const f = st.ents.get(cid);
    const title = (f.title || [''])[0];
    const sec = B.ents[(f.section || [''])[0]];
    const kids = B.goneWith(st, cid);
    const steps = kids.filter(k => (st.ents.get(k).type || [''])[0] === 'check').length, msgs = kids.length - steps;
    const extra = [steps ? `${steps} step${steps > 1 ? 's' : ''}` : '', msgs ? `${msgs} message${msgs > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ');
    h += `<button class="row" data-act="bb" data-ref="${i}">${ic('undo', P.dim, 20)}<span style="flex:1">${esc(title)}<br>
      <span class="rsub">deleted ${esc(ago(t / 1e6))} by ${esc(B.person(userOf(d))[1])}${sec ? ' from ' + esc(sec.name || '') : ''}${extra ? '  ·  ' + esc(extra) : ''}</span></span></button>`;
  });
  sheet('bringback', h);
}

function askText(title, value, done) {                          // a one-line question (e.g. Other shop)
  UI.askDone = done;
  sheet('ask', `<div class="shtitle">${esc(title)}</div><input id="askInput" class="sheetinput" value="${esc(value)}" enterkeyhint="done" autocomplete="off">
    <div class="btnrow"><button class="btn" data-act="closesheet">Cancel</button><button class="btn primary" data-act="askok">OK</button></div>`);
  setTimeout(() => { const a = $('#askInput'); if (a) { a.focus(); a.select(); } }, 60);
}
function confirmSheet(title, text, okText, done) {
  UI.askDone = done;
  sheet('confirm', `<div class="shtitle">${esc(title)}</div><div class="hint">${esc(text)}</div>
    <div class="btnrow"><button class="btn" data-act="closesheet">Cancel</button><button class="btn primary" data-act="confirmok">${esc(okText)}</button></div>`);
}

function pickDate(cid) {
  const dp = $('#datePick');
  const it = B.ents[cid];
  dp.value = (it && parseDay(it.due)) ? it.due.slice(0, 10) : iso(today());
  dp.onchange = () => { if (dp.value) { B.edit(cid, 'Due date', { due: dp.value }); } };
  try { dp.showPicker(); } catch (e) { dp.focus(); dp.click(); }
}

// ---------- the message at the bottom ----------
function toast(text, batch = null, seconds = 0) {
  clearTimeout(UI.toastTimer);
  UI.toast = batch;
  const t = $('#toast');
  t.innerHTML = `<span class="tt">${esc(text)}</span>${batch ? '<button data-act="toastundo">Undo</button>' : ''}`;
  t.hidden = false;
  UI.toastTimer = setTimeout(() => { t.hidden = true; UI.toast = null; }, (seconds || (batch ? 7 : 3.5)) * 1000);
}
const short = (s, n = 40) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function burst(el) {
  const b = document.createElement('span');
  b.className = 'burst';
  el.appendChild(b);
  setTimeout(() => b.remove(), 400);
  if (navigator.vibrate) navigator.vibrate(12);
}

// ============================================================ TAPS ============================================================
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || !B && !t.closest('#setup')) return;
  if (UI.longPressed) { UI.longPressed = false; e.preventDefault(); return; }
  const act = t.dataset.act, ref = t.dataset.ref;
  const cardEl = t.closest('.card');
  const cid = cardEl ? cardEl.dataset.cid : null;
  const it = UI.sel ? B && B.ents[UI.sel] : null;
  if (t.closest('#setup')) { setupAct(act, ref, t); return; }
  switch (act) {
    // header and filters
    case 'menu': menuSheet(); break;
    case 'whatsnew': closeSheet().then(() => { openLayer('new'); renderNew(); $('#newScroll').scrollTop = 0; }); break;
    case 'syncnow': if (isOpen('sheet')) closeSheet(); syncNow(true); break;
    case 'update': applyUpdate(); break;
    case 'page': S.page = ref; saveSettings(); UI.adding = null; renderPages(); renderBoard(); window.scrollTo({ top: 0 }); break;
    case 'pagefold': {
      const sids = (B.secs[currentPage().id] || []).map(s => s.id);
      const all = sids.every(id => S.collapsed.includes(id));
      S.collapsed = all ? S.collapsed.filter(id => !sids.includes(id)) : [...new Set([...S.collapsed, ...sids])];
      saveSettings(); renderPages(); renderBoard(); break;
    }
    case 'who':
      if (ref === 'all') F.who.clear(); else if (F.who.has(ref)) F.who.delete(ref); else F.who.add(ref);
      saveFilter(); renderFilters(); renderBoard(); break;
    case 'ftoday': F.today = !F.today; saveFilter(); renderFilters(); renderBoard(); break;
    case 'fstar': F.star = !F.star; saveFilter(); renderFilters(); renderBoard(); break;
    case 'fdone': F.showDone = !F.showDone; saveFilter(); renderFilters(); renderBoard(); break;
    case 'search': $('#searchRow').hidden = false; $('#search').focus(); break;
    case 'clearsearch': F.query = ''; $('#search').value = ''; $('#searchRow').hidden = true; renderFilters(); renderBoard(); break;
    // sections and cards on the board
    case 'fold': S.collapsed = S.collapsed.includes(ref) ? S.collapsed.filter(x => x !== ref) : [...S.collapsed, ref]; saveSettings(); renderBoard(); break;
    case 'add': UI.adding = ref; S.collapsed = S.collapsed.filter(x => x !== ref); renderBoard(); $('#addInput').focus(); break;
    case 'open': openCard(cid); break;
    case 'tochat': e.stopPropagation(); openCard(cid, true); break;
    case 'done': {
      const b = B.toggleDone(cid);
      const now = B.ents[cid];
      if (now && now.done) { toast(`Checked off “${short(now.title)}”`, b); const box = document.querySelector(`.card[data-cid="${CSS.escape(cid)}"] .box`); if (box) burst(box); }
      break;
    }
    case 'star': B.edit(cid, 'Star', { star: !B.ents[cid].star }); break;
    case 'cyclewho': B.cycleWho(cid); break;
    case 'fab': addSheet(); break;
    // the card screen
    case 'back': closeLayer(UI.layers[UI.layers.length - 1]); break;
    case 'carddone': if (it) { const b = B.toggleDone(it.id); if (B.ents[it.id].done) { toast(`Checked off “${short(it.title)}”`, b); burst(t); } } break;
    case 'setwho': if (it) B.edit(it.id, 'Changed who', { who: ref }); break;
    case 'due': if (it) B.edit(it.id, 'Due date', { due: ref }); break;
    case 'pickdue': if (it) pickDate(it.id); break;
    case 'cardstar': if (it) B.edit(it.id, 'Star', { star: !it.star }); break;
    case 'shop': if (it) B.edit(it.id, 'Where to buy', { shop: (it.shop || '').toLowerCase() === ref.toLowerCase() ? '' : ref }); break;
    case 'othershop': if (it) askText('Where to buy it', it.shop || '', v => B.edit(it.id, 'Where to buy', { shop: v.trim() })); break;
    case 'tick': { const c = B.ents[ref]; if (c) B.edit(ref, c.done ? 'Unticked step' : 'Ticked step', { done: !c.done }); break; }
    case 'delstep': { const c = B.ents[ref]; if (c) { const b = B.edit(ref, 'Deleted step', { deleted: true }); toast(`Deleted step “${short(c.text, 30)}”`, b); } break; }
    case 'editstep': UI.editStep = ref; renderCard(); break;
    case 'pickmsg': UI.pickMsg = UI.pickMsg === ref ? null : ref; renderCard(); if (isOpen('new')) renderNew(); break;
    case 'delmsg': { UI.pickMsg = null; const b = B.deleteMessage(ref); if (b) toast('Message deleted', b); break; }
    case 'send': sendFrom('#edMsg', UI.sel); break;
    case 'sendboard': sendFrom('#edBoardMsg', 'board'); break;
    case 'moveto': moveSheet(isOpen('sheet') ? UI.menuCard : (cid || UI.sel)); break;
    case 'copycard': if (it) copyText(B.cardText(it), 'Copied the card as text'); break;
    case 'unread': if (it) { const id = it.id; closeLayer('card').then(() => markUnread(id)); } break;
    case 'delcard': if (it) { const id = it.id, title = it.title; saveNotes(); closeLayer('card').then(() => { const b = B.deleteCard(id); toast(`Deleted “${short(title)}”`, b); }); } break;
    // what's new
    case 'goto': if (ref === 'board') { $('#newScroll').scrollTop = $('#boardMsgs').offsetTop; } else { closeLayer('new').then(() => openCard(ref)); } break;
    case 'seenall': B.markAllSeen(); persist(); renderNew(); toast('All marked as seen'); break;
    // sheets
    case 'closesheet': closeSheet(); break;
    case 'm_open': closeSheet().then(() => openCard(UI.menuCard)); break;
    case 'm_read': B.markSeen(UI.menuCard); persist(); closeSheet(); renderAll(); break;
    case 'm_unread': closeSheet(); markUnread(UI.menuCard); break;
    case 'm_done': { closeSheet(); const b = B.toggleDone(UI.menuCard); const c = B.ents[UI.menuCard]; if (c && c.done) toast(`Checked off “${short(c.title)}”`, b); break; }
    case 'm_who': { const [c, w] = ref.split('|'); B.edit(c, 'Changed who', { who: w }); cardMenu(c); break; }
    case 'm_due': { const [c, d] = ref.split('|'); B.edit(c, 'Due date', { due: d }); closeSheet(); break; }
    case 'm_pickdue': closeSheet(); pickDate(ref); break;
    case 'm_star': { const c = B.ents[UI.menuCard]; if (c) B.edit(c.id, 'Star', { star: !c.star }); closeSheet(); break; }
    case 'm_copy': { const c = B.ents[UI.menuCard]; closeSheet(); if (c) copyText(B.cardText(c), 'Copied the card as text'); break; }
    case 'm_delete': { const c = B.ents[UI.menuCard]; closeSheet(); if (c) { const b = B.deleteCard(c.id); toast(`Deleted “${short(c.title)}”`, b); } break; }
    case 'm_move': { const b = B.moveCard(UI.menuCard, ref); closeSheet(); if (b) toast(`Moved to ${B.section(ref) ? B.section(ref).name : ''}`, b); break; }
    case 'quicksec': S.lastSec = ref; saveSettings(); $('#quickSecs').innerHTML = quickSecsHTML((B.secs[currentPage().id] || []).filter(s => !s.virtual)); $('#quickAdd').focus(); break;
    case 'quickadd': quickAdd(); break;
    case 'undo': closeSheet(); toast(B.undo()); break;
    case 'toastundo': { const b = UI.toast; $('#toast').hidden = true; UI.toast = null; toast(B.undo(b)); break; }
    case 'bringback': bringBackSheet(); break;
    case 'bb': { const row = UI.bbRows[+ref]; closeSheet().then(() => { if (row) { const b = B.bringBack([row]); toast('Brought back the card', b); openCard(row[2]); } }); break; }
    case 'themes': themeSheet(); break;
    case 'settheme': S.theme = ref; saveSettings(); applyTheme(); renderAll(); themeSheet(); break;
    case 'tsize': S.tsize = +ref; saveSettings(); applyTheme(); renderAll(); menuSheet(); break;
    case 'about': aboutSheet(); break;
    case 'signout': confirmSheet('Sign out of Dropbox?', 'This phone forgets the board and the sign-in. Nothing on the board changes - the next sign-in brings it all back.', 'Sign out', signOut); break;
    case 'askok': { const v = $('#askInput').value; const f = UI.askDone; closeSheet(); if (f) f(v); break; }
    case 'confirmok': { const f = UI.askDone; closeSheet().then(() => f && f()); break; }
  }
});

// long-press a card: its menu
let lp = null;
document.addEventListener('pointerdown', e => {
  UI.longPressed = false;                                       // a new touch: the long-press before it is over
  const card = e.target.closest('.card');
  if (!card || e.button > 0) return;
  lp = { x: e.clientX, y: e.clientY, cid: card.dataset.cid, timer: setTimeout(() => { UI.longPressed = true; lp = null; if (navigator.vibrate) navigator.vibrate(20); cardMenu(card.dataset.cid); }, 480) };
});
document.addEventListener('pointermove', e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) { clearTimeout(lp.timer); lp = null; } });
['pointerup', 'pointercancel'].forEach(n => document.addEventListener(n, () => { if (lp) { clearTimeout(lp.timer); lp = null; } }));
document.addEventListener('contextmenu', e => { if (e.target.closest('.card')) e.preventDefault(); });

// swipe left / right on the board: the next / previous page
let sw = null;
$('#board').addEventListener('touchstart', e => { if (e.touches.length === 1) sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; }, { passive: true });
$('#board').addEventListener('touchend', e => {
  if (!sw || !B) return;
  const dx = e.changedTouches[0].clientX - sw.x, dy = e.changedTouches[0].clientY - sw.y;
  const quick = Date.now() - sw.t < 600;
  sw = null;
  if (quick && Math.abs(dx) > 70 && Math.abs(dy) < 45) {
    const i = B.pages.findIndex(p => p.id === currentPage().id);
    const j = i + (dx < 0 ? 1 : -1);
    if (j >= 0 && j < B.pages.length) { S.page = B.pages[j].id; saveSettings(); UI.adding = null; renderPages(); renderBoard(); window.scrollTo({ top: 0 }); }
  }
}, { passive: true });

// keys and typing
document.addEventListener('keydown', e => {
  const id = e.target.id;
  if (id === 'addInput' && e.key === 'Enter') { e.preventDefault(); addFromSection(); }
  else if (id === 'addInput' && e.key === 'Escape') { UI.adding = null; renderBoard(); }
  else if (id === 'quickAdd' && e.key === 'Enter') { e.preventDefault(); quickAdd(); }
  else if (id === 'askInput' && e.key === 'Enter') { e.preventDefault(); const v = e.target.value; const f = UI.askDone; closeSheet(); if (f) f(v); }
  else if (id === 'edTitle' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  else if (id === 'edStep' && e.key === 'Enter') { e.preventDefault(); addStepNow(); }
  else if (id === 'edStepText' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  else if (id === 'edMsg' && e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); sendFrom('#edMsg', UI.sel); }
  else if (id === 'edBoardMsg' && e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); sendFrom('#edBoardMsg', 'board'); }
});
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'search') { F.query = e.target.value; renderFilters(); renderBoard(); }
  else if (id === 'edTitle') grow(e.target);
  else if (id === 'edNotes') { grow(e.target); UI.notesDirty = true; clearTimeout(UI.notesTimer); UI.notesTimer = setTimeout(saveNotes, 1500); }
  else if (id === 'edMsg' || id === 'edBoardMsg') grow(e.target);
});
document.addEventListener('focusout', e => {
  const id = e.target.id;
  if (id === 'edTitle') saveTitle();
  else if (id === 'edNotes') saveNotes();
  else if (id === 'edStepText') {
    const c = B && B.ents[UI.editStep];
    const v = e.target.value.trim();
    UI.editStep = null;
    if (c && v && v !== c.text) B.edit(c.id, 'Edited step', { text: v }); else renderCard();
  } else if (id === 'addInput') {
    setTimeout(() => { const a = $('#addInput'); if (UI.adding && (!a || (document.activeElement !== a && !a.value.trim()))) { UI.adding = null; renderBoard(); } }, 200);
  }
});

function addFromSection() {
  const inp = $('#addInput');
  const text = inp.value.trim();
  if (!text || !UI.adding) return;
  addCard(UI.adding, text);
  inp.value = '';
}
function addCard(sid, text) {
  let { who, star, title } = B.parseQuick(text);
  if (!who && F.who.size) {                                     // while filtering, a new card goes to someone picked - so it doesn't vanish
    const picks = B.whoChoices().map(p => p[0]).filter(p => F.who.has(p));
    who = picks.includes(B.me) ? B.me : picks[0] || '';
  }
  B.newItem(sid, title || text, { who, star });
  const s = B.section(sid);
  toast(`Added to ${s ? s.name : 'the board'}`, B.undoStack[B.undoStack.length - 1]);
}
function quickAdd() {
  const inp = $('#quickAdd');
  const text = inp.value.trim();
  if (!text) { inp.focus(); return; }
  addCard(S.lastSec, text);
  saveSettings();
  inp.value = '';
  inp.focus();
}
function addStepNow() {
  const inp = $('#edStep');
  const text = inp.value.trim();
  if (!text || !UI.sel) return;
  B.addStep(UI.sel, text);
  inp.value = '';
  inp.focus();
}
function sendFrom(sel, target) {
  const box = $(sel);
  const text = box.value.trim();
  if (!text || !target) return;
  B.sendMessage(target, text);
  box.value = '';
  grow(box);
  if (UI.drafts && target) delete UI.drafts[target];
  const sc = target === 'board' ? $('#newScroll') : $('#cardScroll');
  requestAnimationFrame(() => { sc.scrollTop = sc.scrollHeight; });
}
function markUnread(cid) {
  if (!B.ents[cid]) return;
  B.unread.add(cid);
  persist();
  renderAll();
  toast('Marked as unread - it glows until you open it again');
}
async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch (e) { toast('Could not copy'); }
}

// ============================================================ SYNC: Dropbox <-> this phone ============================================================
function persist() {                                            // this phone's copy of the board, so it opens offline and keeps unsent changes
  if (!B) return;
  clearTimeout(UI.persistTimer);
  UI.persistTimer = setTimeout(() => lsSet(K_STATE, { store: B.shared.toJSON(), seen: B.seen, seenAll: B.seenAll, unread: [...B.unread], savedAt: Sync.savedAt,
    clock: B.clock.last }), 250);
}
function localChange(redraw = true) {                           // after any change made here
  if (redraw) renderAll();
  persist();
  clearTimeout(Sync.saveTimer);
  Sync.saveTimer = setTimeout(() => syncNow(), SAVE_DELAY);
}

async function syncNow(byHand = false) {
  if (!B || !S.folder) return;
  if (Sync.busy) { Sync.again = true; return; }
  Sync.busy = true;
  let merged = false;
  try {
    const st = B.shared;
    const mine = B.device + '.json';
    const files = await DB.listFolder(S.folder);
    for (const f of files) {
      if (st.files[f.name] === f.rev) continue;
      if (f.name === mine && st.files[f.name]) { st.files[f.name] = f.rev; continue; }     // my own file: read once (nobody else writes it)
      const text = await DB.download(S.folder, f.path);
      st.files[f.name] = f.rev;
      const data = parseFile(text);
      if (!data) continue;                                      // not a board file
      if (f.name !== mine) st.peers[String(data.device || f.name.slice(0, -5))] = f.modified;
      if (st.merge(data.ents).size) merged = true;
    }
    if (merged) {
      B.rebuild();
      if (UI.sel && B.markSeen(UI.sel)) { /* the open card's news counts as seen */ }
      UI.pulse = Date.now();
    }
    if (st.dirtyAt || (Date.now() - Sync.savedAt > HEARTBEAT_MS && document.visibilityState === 'visible')) await saveMine();
    Sync.error = '';
    Sync.lastOk = Date.now();
    if (byHand) toast('Synced');
  } catch (e) {
    if (e.signin) { Sync.busy = false; showSetup(e.message); return; }
    const net = navigator.onLine === false || e instanceof TypeError;      // fetch() itself failed: no network
    Sync.error = net ? 'Can’t reach Dropbox - your changes wait on this phone' : (e.message || String(e)).slice(0, 120);
    if (byHand) toast(net ? 'Can’t reach Dropbox right now - your changes wait on this phone' : `Could not sync: ${Sync.error}`);
  } finally {
    Sync.busy = false;
    persist();
    if (merged) renderAll(); else renderHeader();
    if (Sync.again) { Sync.again = false; setTimeout(() => syncNow(), 50); }
  }
}
async function saveMine(keepalive = false) {                    // the ONLY write: this phone's own file, everything it knows
  const st = B.shared;
  const n = st.edits;
  const text = st.text(VERSION);
  const meta = await DB.uploadMine(S.folder, B.device, text, keepalive && text.length < 60000);
  st.files[B.device + '.json'] = meta.rev;
  if (st.edits === n) st.dirtyAt = 0;                           // a change made during the upload stays waiting
  Sync.savedAt = Date.now();
}
function startTimers() {
  if (Sync.started) return;
  Sync.started = true;
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, POLL_MS);
  setInterval(() => { if (document.visibilityState === 'visible' && B) { renderHeader(); } }, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!B) return;
    if (document.visibilityState === 'visible') syncNow();
    else { saveTitle(); saveNotes(); persist(); if (B.shared.dirtyAt) saveMine(true).catch(() => {}); }
  });
  window.addEventListener('online', () => syncNow());
}

// ============================================================ SETUP: sign in, the folder, who you are ============================================================
const SETUP = { error: '', step: '', board: null, people: [], checking: false };
function showSetup(error = '') {
  SETUP.error = error;
  $('#setup').hidden = false;
  renderSetup();
}
function renderSetup() {
  const signed = DB.signedIn();
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const folder = S.folder || (local ? DB.TEST_FOLDER : DB.REAL_FOLDER);
  let h = `<div class="scroll"><img class="slogo" src="icons/icon-192.png" alt=""><h1 class="stitle">Task Board</h1>`;
  if (!signed) {
    h += `<div class="stext">The shared to-do and to-buy board - the same one as on the PC.  It keeps itself up to date through <b>Dropbox</b>,
      so sign in with your own Dropbox account.  The app only ever opens the board's own folder (<b>Task_Board</b>) and writes just one file
      of its own there.</div>
      <button class="bigbtn" data-act="signin">Sign in with Dropbox</button>`;
  } else if (!SETUP.board) {
    h += `<div class="stext">Signed in.  Where is the board's folder in your Dropbox?</div>
      <div class="sfield"><label>BOARD FOLDER</label><input id="setFolder" value="${esc(folder)}" autocomplete="off" spellcheck="false"></div>
      <button class="bigbtn" data-act="checkfolder" ${SETUP.checking ? 'disabled' : ''}>${SETUP.checking ? 'Looking…' : 'Open the board'}</button>
      <button class="btn" data-act="signout_setup" style="align-self:center">Sign in with another Dropbox account</button>`;
  } else {
    const me = SETUP.me || S.me;
    const dev = SETUP.devName != null ? SETUP.devName : freeDevName(me);
    const reuse = me && SETUP.reuse === `${me}_${cleanDevName(dev)}`;
    h += `<div class="stext">Found the board <b>${esc(SETUP.board.board.title || APP)}</b> in <b>${esc(SETUP.folder)}</b>.  Who are you?</div>
      <div class="pills">${SETUP.people.map(([pid, name, color]) => pill(name, { on: me === pid, color: goodColor(color), icon: 'person', act: 'setme', ref: pid })).join('')}</div>
      <div class="sfield"><label>THIS PHONE'S NAME (its file: ${esc((me || 'you') + '_' + (cleanDevName(dev) || 'phone'))}.json)</label>
      <input id="setDev" value="${esc(dev)}" autocomplete="off" spellcheck="false"></div>
      <button class="bigbtn" data-act="start" ${me ? '' : 'disabled'}>${reuse ? 'Yes, this is that phone - Start' : 'Start'}</button>`;
  }
  if (SETUP.error) h += `<div class="serr">${esc(SETUP.error)}</div>`;
  h += `<div class="ver">Task Board for phones ${esc(VERSION)}</div></div>`;
  $('#setup').innerHTML = h;
}
function cleanDevName(v) { return String(v || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''); }
function nameTaken(me, name) { return (SETUP.files || []).some(f => f.toLowerCase() === `${me}_${name}.json`); }
function freeDevName(me) {                                      // 'phone', or phone-2, phone-3... when another device already has that file
  if (!me) return 'phone';
  for (let i = 1; ; i++) { const n = i === 1 ? 'phone' : `phone-${i}`; if (!nameTaken(me, n)) return n; }
}
async function setupAct(act, ref) {
  if (act === 'signin') { SETUP.error = ''; try { await DB.startSignIn(); } catch (e) { SETUP.error = e.message; renderSetup(); } return; }
  if (act === 'signout_setup') { DB.signOut(); SETUP.board = null; renderSetup(); return; }
  if (act === 'checkfolder') {
    const folder = DB.cleanFolder($('#setFolder').value);
    SETUP.error = '';
    if (!folder) { SETUP.error = 'That is not a board folder: it must end in /Task_Board (and the Claude and Private folders are never used).'; renderSetup(); return; }
    SETUP.checking = true; renderSetup();
    try {
      if (!await DB.folderExists(folder)) throw new Error(`There is no folder ${folder} in this Dropbox.  Has the shared folder been added to your Dropbox?`);
      const board = new Board({ me: '', device: '' });
      const files = await DB.listFolder(folder);
      for (const f of files) {
        const data = parseFile(await DB.download(folder, f.path));
        if (data) { board.shared.merge(data.ents); board.shared.files[f.name] = f.rev; board.shared.peers[String(data.device || f.name.slice(0, -5))] = f.modified; }
      }
      board.rebuild();
      if (!files.length) throw new Error('That folder has no board files yet - start the board on a PC first.');
      SETUP.board = board; SETUP.folder = folder; SETUP.people = board.people; SETUP.files = files.map(f => f.name);
    } catch (e) { SETUP.error = e.signin ? 'Please sign in again.' : e.message; if (e.signin) DB.signOut(); }
    SETUP.checking = false; renderSetup(); return;
  }
  if (act === 'setme') { SETUP.me = ref; SETUP.reuse = ''; SETUP.error = ''; renderSetup(); return; }
  if (act === 'start') {
    const name = cleanDevName(($('#setDev') || {}).value) || 'phone';
    const me = SETUP.me || S.me;
    if (!me) return;
    if (nameTaken(me, name) && SETUP.reuse !== `${me}_${name}`) {    // two devices with one name would write one file and undo each other's changes
      SETUP.reuse = `${me}_${name}`; SETUP.devName = name;
      SETUP.error = `${me}_${name}.json is already on the board - another phone or browser uses the name "${name}".  Two devices with the same name `
        + `undo each other's changes, so give this one its own name (like "${freeDevName(me)}").  Only if this IS that same phone, set up again, tap Start again.`;
      renderSetup(); return;
    }
    SETUP.reuse = ''; SETUP.error = ''; SETUP.devName = null;
    S.me = me; S.device = `${me}_${name}`; S.folder = SETUP.folder; saveSettings();
    B = SETUP.board;
    B.me = S.me; B.device = S.device;
    B.seenAll = B.clock.stamp();                                // first run on this phone: everything already here counts as seen (as on a new PC)
    SETUP.board = null;
    $('#setup').hidden = true;
    begin();
    toast(`Hello ${B.person(B.me)[1]} - the board keeps itself up to date while it's open`, null, 5);
  }
}
document.addEventListener('input', e => {
  if (e.target.id !== 'setDev') return;
  SETUP.devName = e.target.value;
  const l = document.querySelector('.sfield label');
  if (l && SETUP.board) l.textContent = `THIS PHONE'S NAME (its file: ${(SETUP.me || S.me || 'you')}_${cleanDevName(e.target.value) || 'phone'}.json)`;
  if (SETUP.reuse) { SETUP.reuse = ''; SETUP.error = ''; const b = document.querySelector('#setup [data-act=start]'); if (b) b.textContent = 'Start';
    const er = document.querySelector('#setup .serr'); if (er) er.remove(); }
});

function signOut() {
  DB.signOut();
  try { localStorage.removeItem(K_STATE); } catch (e) { /* */ }
  S.me = S.device = S.folder = '';
  saveSettings();
  location.reload();
}

// ============================================================ START ============================================================
function begin() {
  B.onChange = () => localChange(true);
  applyTheme();
  renderAll();
  startTimers();
  syncNow();
}

async function main() {
  applyTheme();
  registerWorker();
  try { await DB.finishSignIn(); } catch (e) { showSetup(e.message); return; }
  if (!DB.signedIn() || !S.me || !S.device || !S.folder) { showSetup(); return; }
  B = new Board({ me: S.me, device: S.device });
  const saved = lsGet(K_STATE, null);
  if (saved) {
    B.shared.load(saved.store);
    B.seen = saved.seen || {}; B.seenAll = saved.seenAll || 0; B.unread = new Set(saved.unread || []);
    Sync.savedAt = saved.savedAt || 0;
    if (saved.clock) B.clock.see(saved.clock);
  }
  B.rebuild();
  begin();
}

// ---------- updates: a new version on the server shows "Update" in the header ----------
function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {        // on the PC while building it: no worker (it would keep old files), unless ?sw=1
    if (/[?&]sw=1/.test(location.search)) localStorage.setItem('tb.sw', '1');
    if (/[?&]sw=0/.test(location.search)) localStorage.removeItem('tb.sw');
    if (localStorage.getItem('tb.sw') !== '1') {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
      return;
    }
  }
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    const watch = w => {
      if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) newVersionReady(reg); });
    };
    if (reg.waiting && navigator.serviceWorker.controller) newVersionReady(reg);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
}
async function newVersionReady(reg) {
  UI.waiting = reg.waiting;
  try { const t = await (await fetch('version.js?fresh=' + Date.now(), { cache: 'no-store' })).text(); UI.newVersion = (/APP_VERSION = '([^']+)'/.exec(t) || [])[1] || 'new'; }
  catch (e) { UI.newVersion = 'new'; }
  if (B) { renderHeader(); toast(`Version ${UI.newVersion} is here - tap Update at the top`, null, 6); }
}
function applyUpdate() {
  if (B) { saveTitle(); saveNotes(); persist(); }
  if (UI.waiting) UI.waiting.postMessage('skipWaiting'); else location.reload();
}

main();
