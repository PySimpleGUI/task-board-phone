// engine.js - the Task Board's data, ported line for line from task_board.pyw 1.0.7 (Clock, Store, rebuild, Batch / undo, what's new).
// No screen code here, so tests can run it in Node next to the real task_board.pyw.
//
// How the sharing works (the same as the desktop board):  every device writes ONLY its own <person>_<device>.json in the shared folder and
// merges everyone else's.  Every field is [value, stamp, device]; the larger (stamp, device) wins.  Stamps come from a hybrid clock (wall
// microseconds, always later than any stamp seen).  Records are never removed - a deleted one keeps deleted = true.

export const FORMAT = 'task-board-replica';
export const TYPES = ['board', 'page', 'section', 'item', 'check', 'comment'];
export const CONTENT_FIELDS = ['title', 'notes', 'shop', 'name', 'text', 'people'];
export const CLAUDE_DEVICE = 'claude_chat';
export const APP = 'Task Board';

// ---------- the look (the same values as the desktop) ----------
export const THEMES = {
  Toybox: { card: '#141821', border: '#2f3a4e', track: '#1e2430', text: '#e6eaf2', dim: '#8a93a3' },
  Carbon: { card: '#121212', border: '#2e2e2e', track: '#1f1f1f', text: '#e0e0e0', dim: '#8c8c8c' },
  Slate: { card: '#2a3140', border: '#48526a', track: '#363e50', text: '#eef1f6', dim: '#a3acbd' },
  CrimsonVelvet: { card: '#5e0d1f', border: '#8f1530', track: '#781429', text: '#f9d276', dim: '#d6a7a0' },
  Ember: { card: '#451f11', border: '#773c27', track: '#5c2f1e', text: '#f1e4df', dim: '#bd9f93' },
  Espresso: { card: '#2c2016', border: '#594331', track: '#423224', text: '#f1e7df', dim: '#bda693' },
  Bronze: { card: '#48310f', border: '#7b5823', track: '#60441b', text: '#f1eadf', dim: '#bdac93' },
  Olive: { card: '#2a3013', border: '#545f2b', track: '#3e4620', text: '#eef1df', dim: '#b5bd93' },
  ForestFloor: { card: '#101c0e', border: '#2a4424', track: '#1b2e18', text: '#d0e0c8', dim: '#83977d' },
  Jade: { card: '#113124', border: '#29614a', track: '#1e4836', text: '#dff1ea', dim: '#93bdac' },
  Lagoon: { card: '#0e3434', border: '#236767', track: '#1a4c4c', text: '#dff1f1', dim: '#93bdbd' },
  Petrol: { card: '#0f303e', border: '#235a71', track: '#1b4456', text: '#dfecf1', dim: '#93b1bd' },
  Cobalt: { card: '#132949', border: '#294a7a', track: '#20395f', text: '#dfe6f1', dim: '#93a4bd' },
  Indigo: { card: '#1e1e48', border: '#383876', track: '#2c2c5d', text: '#dfdff1', dim: '#9393bd' },
  Plum: { card: '#341c3f', border: '#5a376c', track: '#472b54', text: '#ebdff1', dim: '#af93bd' },
  Mulberry: { card: '#3f1731', border: '#6e3057', track: '#552544', text: '#f1dfea', dim: '#bd93ae' },
  Paper: { card: '#f5f7fb', border: '#c9d1dc', track: '#dadfe8', text: '#1b2130', dim: '#5c6676' },
  Fog: { card: '#dde2e8', border: '#b8c0ca', track: '#c5ccd5', text: '#1b2028', dim: '#545d69' },
  Stone: { card: '#e1dedb', border: '#b9b5b1', track: '#c5c2be', text: '#2b2117', dim: '#63574b' },
  Sand: { card: '#e7dfcf', border: '#c1b6a4', track: '#cbc2b3', text: '#2b2417', dim: '#675942' },
  Linen: { card: '#f7f2e8', border: '#dcd1bd', track: '#e4dac9', text: '#2b2620', dim: '#73685a' },
  Butter: { card: '#fbf5dc', border: '#e3d7a6', track: '#e8ddb1', text: '#2e2a18', dim: '#766c4c' },
  Peach: { card: '#fce9df', border: '#dfbdaa', track: '#e6ccbc', text: '#2b1e17', dim: '#705d51' },
  Blush: { card: '#faedf0', border: '#eccad2', track: '#efd1d8', text: '#321c22', dim: '#80606a' },
  Rose: { card: '#ecd5dd', border: '#c7a9b3', track: '#d1b8c0', text: '#2b171e', dim: '#70515c' },
  Orchid: { card: '#f4e5f5', border: '#d1b6d3', track: '#dbc6dc', text: '#2a172b', dim: '#6e5170' },
  Lavender: { card: '#f0ecfa', border: '#d2c9ec', track: '#dad3f0', text: '#231e33', dim: '#665e80' },
  Periwinkle: { card: '#e3e6f7', border: '#b2b7d6', track: '#c3c7df', text: '#171a2b', dim: '#515670' },
  Sky: { card: '#e7f0fa', border: '#bdd2ea', track: '#c7daee', text: '#18222f', dim: '#53667d' },
  Aqua: { card: '#ddf2f3', border: '#aecfd0', track: '#bfd9d9', text: '#172a2b', dim: '#516f70' },
  Mint: { card: '#e8f5ee', border: '#bcdccb', track: '#c5e1d2', text: '#1b2a22', dim: '#557064' },
  Pistachio: { card: '#ebf3dd', border: '#c4cfaf', track: '#cfd9bf', text: '#242b17', dim: '#657051' },
};
export const C_BOTH = '#ffb74d', C_CLAUDE = '#d97757', C_SELECT = '#3d8bfd';
export const C_DONE = '#2ecc71', C_TODAY = '#ff9f43', C_SOON = '#f4c542', C_LATE = '#ff5c5c', C_NEW = '#ffc83d', C_CLOSE = '#c0392b';
export const STORES = [['Amazon', '#ff9900'], ['Grocery', '#2ecc71'], ['Pharmacy', '#38b6ff'], ['Pet store', '#ff7eb6'], ['Hardware', '#c8956c'],
  ['Costco', '#e8457c'], ['Online', '#a77bff']];
export const DEFAULT_PEOPLE = [['mike', 'Mike', '#4da3ff'], ['deb', 'Deb', '#ff6fae']];
export const PHONE_RE = /(?<![\d-])(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}(?![\d-])/g;
export const LINK_RE = /https?:\/\/[^\s<>"]+|www\.[^\s<>"]+/g;

// ---------- colors ----------
const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const hexc = v => '#' + v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
export const mix = (c1, c2, f) => { const a = rgb(c1), b = rgb(c2); return hexc(a.map((x, i) => x + (b[i] - x) * f)); };
export const isLight = c => { const [r, g, b] = rgb(c); return 0.299 * r + 0.587 * g + 0.114 * b > 140; };
export const goodColor = (c, d = '#9aa5b5') => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) ? c : d;

export function palette(name) {
  const t = THEMES[name] || THEMES.Toybox;
  const bg = t.card, text = t.text, light = isLight(bg);
  return Object.assign({}, t, {
    light, bg,
    strip: mix(bg, t.border, light ? 0.45 : 0.33),
    panel: mix(bg, text, light ? 0.035 : 0.03),
    line: mix(bg, text, light ? 0.15 : 0.12),
    cardbg: light ? mix(bg, '#ffffff', 0.75) : mix(bg, text, 0.075),
    card_line: mix(bg, text, light ? 0.17 : 0.12),
    card_hover: light ? mix(bg, '#ffffff', 0.95) : mix(bg, text, 0.115),
    card_hover_line: mix(bg, text, light ? 0.34 : 0.27),
    card_done: light ? mix(bg, '#ffffff', 0.3) : mix(bg, text, 0.035),
    field: light ? mix(bg, '#ffffff', 0.85) : mix(bg, text, 0.06),
    field_line: mix(bg, text, light ? 0.22 : 0.18),
    chip: mix(bg, text, light ? 0.1 : 0.09),
    chip_hover: mix(bg, text, light ? 0.2 : 0.17),
    faint: mix(t.dim, bg, 0.3),
    menu: mix(bg, text, 0.04),
  });
}
export const acc = (p, c) => p.light ? mix(c, '#000000', 0.18) : c;                 // an accent as drawn on this theme
export const accText = (p, c) => p.light ? mix(c, '#000000', 0.34) : mix(c, '#ffffff', 0.12);
export const chipColors = (p, c) => p.light ? [mix('#ffffff', c, 0.2), mix(c, '#000000', 0.38)] : [mix(p.bg, c, 0.24), mix(c, '#ffffff', 0.2)];

// ---------- dates ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function today() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
export function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
export function parseDay(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(text || ''));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}
export const monShort = d => MONTHS[d.getMonth()];
export const dayLong = d => DAYS[d.getDay()];
export const dayShort = d => DAYS[d.getDay()].slice(0, 3);
const dayDiff = (a, b) => Math.round((a - b) / 86400000);

export function dueLabel(due) {                                 // [text, color] for a due date chip
  const d = parseDay(due);
  if (!d) return ['', null];
  const days = dayDiff(d, today());
  if (days < 0) return [`Late · ${monShort(d)} ${d.getDate()}`, C_LATE];
  if (days === 0) return ['Today', C_TODAY];
  if (days === 1) return ['Tomorrow', C_SOON];
  if (days < 7) return [dayLong(d), null];
  return [`${monShort(d)} ${d.getDate()}`, null];
}
export function clockText(t) {
  const d = new Date(t * 1000);
  return `${(d.getHours() + 11) % 12 + 1}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'am' : 'pm'}`;
}
export function ago(t) {                                        // 'just now', '5 min ago', '2 h ago', 'yesterday 3:10 pm', 'Mon 9:40 am', 'Oct 21'
  const sec = Date.now() / 1000 - t;
  if (sec < 50) return 'just now';
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))} min ago`;
  const when = new Date(t * 1000);
  const days = dayDiff(today(), new Date(when.getFullYear(), when.getMonth(), when.getDate()));
  if (days === 0) return sec < 6 * 3600 ? `${Math.round(sec / 3600)} h ago` : clockText(t);
  if (days === 1) return `yesterday ${clockText(t)}`;
  if (days < 7) return `${dayShort(when)} ${clockText(t)}`;
  return `${monShort(when)} ${when.getDate()}`;
}

// ---------- ids and devices ----------
export function newId() {
  const b = new Uint8Array(6);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}
export const userOf = device => String(device).split('_')[0];
export const seedDev = device => userOf(device) === 'claude' && device !== CLAUDE_DEVICE;
const later = (t, d, ct, cd) => t > ct || (t === ct && d > cd);   // (t, d) > (ct, cd) as Python compares tuples

// ---------- the hybrid clock ----------
export class Clock {
  constructor(offsetMs = 0) { this.last = 0; this.offset = offsetMs; }   // offset: only for tests (a slow clock)
  stamp() { this.last = Math.max(Math.floor((Date.now() + this.offset) * 1000), this.last + 1); return this.last; }
  see(t) { if (t > this.last) this.last = t; }
}

// ---------- one data folder ----------
export class Store {
  constructor(board) {
    this.board = board;                                         // for device and clock
    this.ents = new Map();                                      // id -> {field: [value, stamp, device]}
    this.files = {};                                            // file name -> rev already merged
    this.dirtyAt = 0;
    this.edits = 0;                                             // counts every change, so a save knows if more came in while it uploaded
    this.peers = {};                                            // device -> time (s) its file last changed
    this.error = '';
  }

  merge(ents) {                                                 // returns the ids that changed
    const changed = new Set();
    if (!ents || typeof ents !== 'object') return changed;
    for (const [eid, fields] of Object.entries(ents)) {
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) continue;
      let mine = this.ents.get(eid);
      if (!mine) { mine = {}; this.ents.set(eid, mine); }
      for (const [f, trip] of Object.entries(fields)) {
        if (!Array.isArray(trip) || trip.length !== 3) continue;
        let [v, t, d] = trip;
        t = typeof t === 'number' ? Math.trunc(t) : (typeof t === 'string' && /^\s*-?\d+\s*$/.test(t) ? parseInt(t, 10) : NaN);
        if (!Number.isFinite(t)) continue;
        d = String(d);
        const cur = mine[f];
        if (cur === undefined || later(t, d, cur[1], cur[2])) {
          mine[f] = [v, t, d];
          changed.add(eid);
          if (f === 'deleted' && v === true && cur !== undefined && d !== this.board.device && !this.dirtyAt)
          { this.dirtyAt = Date.now(); this.edits++; }        // rewrite my file soon, so deleted text leaves it too
        }
        this.board.clock.see(t);
      }
    }
    return changed;
  }

  put(eid, fields) {                                            // a change made here: each field gets a new stamp; returns the old trips (undo)
    let ent = this.ents.get(eid);
    if (!ent) { ent = {}; this.ents.set(eid, ent); }
    const old = {};
    for (const [f, v] of Object.entries(fields)) {
      old[f] = ent[f] === undefined ? null : ent[f];
      ent[f] = [v, this.board.clock.stamp(), this.board.device];
    }
    this.edits++;
    if (!this.dirtyAt) this.dirtyAt = Date.now();
    return old;
  }

  text(appVersion) {                                            // my file, laid out like the desktop's (one record per line)
    const now = new Date();
    const p2 = n => String(n).padStart(2, '0');
    const saved = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;
    const head = { format: FORMAT, version: 1, device: this.board.device, user: this.board.me, app: appVersion, saved, alive: Math.floor(Date.now() / 1000) };
    const headText = '{' + Object.entries(head).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(', ');
    const rows = [];
    for (const [eid, f] of this.ents) rows.push(JSON.stringify(eid) + ': ' + JSON.stringify(f));
    return headText + ',\n"ents": {\n' + rows.join(',\n') + '\n}}\n';
  }

  toJSON() { return { ents: Object.fromEntries(this.ents), files: this.files, dirtyAt: this.dirtyAt, peers: this.peers }; }
  load(o) {
    if (!o) return;
    this.ents = new Map(Object.entries(o.ents || {}));
    this.files = o.files || {};
    this.dirtyAt = o.dirtyAt || 0;
    this.peers = o.peers || {};
    for (const f of this.ents.values()) for (const trip of Object.values(f)) if (Array.isArray(trip)) this.board.clock.see(trip[1]);
  }
}

// Parse one downloaded file.  Returns its ents or null (not a board file)
export function parseFile(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return null; }
  if (!data || typeof data !== 'object' || data.format !== FORMAT || !data.ents || typeof data.ents !== 'object' || Array.isArray(data.ents)) return null;
  return data;
}

const orderKey = e => { const p = parseFloat(e.pos); return Number.isFinite(p) ? p : 0; };
const byOrder = (a, b) => (orderKey(a) - orderKey(b)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ---------- the board: everything the screens are drawn from ----------
export class Board {
  constructor({ me = '', device = '', clockOffset = 0 } = {}) {
    this.me = me; this.device = device;
    this.clock = new Clock(clockOffset);
    this.shared = new Store(this);
    this.stores = [this.shared];
    this.seen = {}; this.seenAll = 0; this.unread = new Set();
    this.undoStack = [];
    this.onChange = null;                                       // called after every change made here
    this.rebuild();
  }

  // --- merged view (task_board.pyw rebuild()) ---
  rebuild() {
    const ents = {};
    for (const st of this.stores) {
      for (const [eid, f] of st.ents) {
        const e = {};
        for (const [k, v] of Object.entries(f)) e[k] = v[0];
        e.id = eid; e._st = st; e._f = f;
        const prev = ents[eid];
        if (!prev || !e.deleted || prev.deleted) ents[eid] = e;
      }
    }
    this.ents = ents;
    const live = Object.values(ents).filter(e => !e.deleted && TYPES.includes(e.type));
    this.board = live.find(e => e.type === 'board') || { id: 'board', type: 'board', title: APP };
    let people = this.board.people;
    if (!(Array.isArray(people) && people.length && people.every(p => Array.isArray(p) && p.length === 3))) people = DEFAULT_PEOPLE;
    this.people = people.map(p => p.map(String));
    this.pages = live.filter(e => e.type === 'page').sort(byOrder);
    if (!this.pages.length) this.pages = [{ id: '_page', type: 'page', name: 'DO', kind: 'do', _st: this.shared, virtual: true }];
    const pageIds = new Set(this.pages.map(p => p.id));
    this.secs = {};
    for (const p of this.pages) this.secs[p.id] = [];
    const sections = live.filter(e => e.type === 'section').sort(byOrder);
    for (const s of sections) this.secs[pageIds.has(s.page) ? s.page : this.pages[0].id].push(s);
    const secIds = new Set(sections.map(s => s.id));
    this.items = {};
    for (const s of sections) this.items[s.id] = [];
    const orphans = [];
    for (const it of live.filter(e => e.type === 'item').sort(byOrder)) (secIds.has(it.section) ? this.items[it.section] : orphans).push(it);
    if (orphans.length) {
      this.secs[this.pages[0].id].push({ id: '_orphans', type: 'section', name: 'Unsorted', color: '#9aa5b5', virtual: true, _st: this.shared });
      this.items._orphans = orphans;
    }
    this.checks = {}; this.comments = {};
    for (const e of live.filter(e => e.type === 'check').sort(byOrder)) (this.checks[e.item] = this.checks[e.item] || []).push(e);
    const at = e => parseFloat(e.at) || 0;
    for (const e of live.filter(e => e.type === 'comment').sort((a, b) => (at(a) - at(b)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)))
      (this.comments[e.item] = this.comments[e.item] || []).push(e);
  }

  // --- people ---
  person(pid) {
    for (const p of this.people) if (p[0] === pid) return p;
    if (pid === 'both') return ['both', this.people.length === 2 ? 'Both' : 'All', C_BOTH];
    if (pid === 'claude') return ['claude', 'Claude', C_CLAUDE];
    const n = pid || '';
    return [n, n ? n[0].toUpperCase() + n.slice(1) : '', '#9aa5b5'];
  }
  otherPeople() { return this.people.filter(p => p[0] !== this.me); }
  whoChoices() { return this.people; }                         // the phone never sees the Claude page
  forWhom(it) {
    const w = it.who || '';
    if (w === 'both') return new Set(this.people.map(p => p[0]));
    return w ? new Set([w]) : new Set();
  }
  quiet(device) { return userOf(device) === this.me || seedDev(device); }
  byOther(c) { return c.author !== this.me && !this.quiet((c._f.author || [null, 0, this.device])[2]); }

  // --- where things are ---
  section(sid) { for (const ss of Object.values(this.secs)) for (const s of ss) if (s.id === sid) return s; return null; }
  sectionOf(it) { return this.section(it.section) || this.section('_orphans') || { id: '', name: '', color: '#9aa5b5' }; }
  pageOf(sec) { return this.pages.find(p => (this.secs[p.id] || []).some(s => s.id === sec.id)) || this.pages[0]; }
  allSections() { return this.pages.flatMap(p => this.secs[p.id] || []); }

  // --- changes, with undo ---
  batch(label) {
    const board = this, parts = [];
    return {
      label, parts,
      put(eid, fields, store) { const st = store || board.storeOf(eid); parts.push([st, eid, st.put(eid, fields)]); return this; },
      done() { if (parts.length) { board.undoStack.push(this); board.undoStack.splice(0, Math.max(0, board.undoStack.length - 60)); board.changed(); } return this; },
    };
  }
  storeOf(eid) { const e = this.ents[eid]; return e ? e._st : this.shared; }
  edit(eid, label, fields) { return this.batch(label).put(eid, fields).done(); }
  changed() { this.rebuild(); if (this.onChange) this.onChange(); }

  undo(target) {                                                // the last change, or the one a message at the bottom is about
    let b;
    if (target) {
      const i = this.undoStack.lastIndexOf(target);
      if (i < 0) return 'That was undone already';
      b = this.undoStack.splice(i, 1)[0];
    } else {
      if (!this.undoStack.length) return 'Nothing to undo';
      b = this.undoStack.pop();
    }
    for (const [st, eid, old] of [...b.parts].reverse()) {
      if ('type' in old && old.type === null) {                 // the change created this record: undo deletes it again, text and all
        const blank = {};
        for (const f of CONTENT_FIELDS) if (f in (st.ents.get(eid) || {})) blank[f] = '';
        st.put(eid, Object.assign(blank, { deleted: true }));
        continue;
      }
      const back = {};
      for (const [f, trip] of Object.entries(old)) back[f] = trip ? trip[0] : (['deleted', 'done', 'star'].includes(f) ? false : '');
      st.put(eid, back);
    }
    this.changed();
    return `Undone: ${b.label}`;
  }

  nextPos(secId) {
    const items = this.items[secId] || [];
    return items.length ? (parseFloat(items[items.length - 1].pos) || 0) + 1.0 : 1.0;
  }
  newItem(secId, title, { who = '', star = false, shop = '' } = {}) {
    const eid = newId();
    this.batch('Added card').put(eid, { type: 'item', section: secId, title, who, star, shop, done: false, notes: '', due: '',
      pos: this.nextPos(secId), created_by: this.me, created_at: Date.now() / 1000, deleted: false }, this.shared).done();
    return eid;
  }
  toggleDone(cid) {
    const it = this.ents[cid];
    if (!it) return null;
    const done = !it.done;
    return this.edit(cid, done ? 'Checked off' : 'Unchecked', { done, done_by: done ? this.me : '', done_at: done ? Date.now() / 1000 : 0 });
  }
  cycleWho(cid) {
    const it = this.ents[cid];
    if (!it) return;
    const order = [...this.whoChoices().map(p => p[0]), 'both', ''];
    const cur = it.who || '';
    const i = order.indexOf(cur);
    this.edit(cid, 'Changed who', { who: i >= 0 ? order[(i + 1) % order.length] : order[0] });
  }
  children(itemId) { return [...(this.checks[itemId] || []), ...(this.comments[itemId] || [])].map(e => e.id); }
  deleteCard(cid) {
    if (!this.ents[cid]) return null;
    const b = this.batch('Deleted card').put(cid, { deleted: true });
    for (const ch of this.children(cid)) b.put(ch, { deleted: true });
    return b.done();
  }
  deleteMessage(mid) {
    const c = this.ents[mid];
    if (c && c.author === this.me && !c.deleted) return this.edit(mid, 'Deleted message', { deleted: true, text: '' });
    return null;
  }
  sendMessage(target, text) {
    const st = this.ents[target] ? this.ents[target]._st : this.shared;
    return this.batch('Sent message').put(newId(), { type: 'comment', item: target, author: this.me, text, at: Date.now() / 1000, deleted: false }, st).done();
  }
  addStep(cid, text) {
    const it = this.ents[cid];
    if (!it) return null;
    const checks = this.checks[cid] || [];
    const pos = checks.length ? (parseFloat(checks[checks.length - 1].pos) || 0) + 1 : 1.0;
    return this.batch('Added step').put(newId(), { type: 'check', item: cid, text, done: false, pos, deleted: false }, it._st).done();
  }
  moveCard(cid, sid) {                                          // to the end of another section's open cards
    const it = this.ents[cid];
    if (!it || it.section === sid) return null;
    const sec = this.section(sid);
    return this.edit(cid, `Moved to ${sec ? sec.name : 'another section'}`, { section: sid, pos: this.nextPos(sid) });
  }
  placeCard(cid, sid, index, F) {                               // = move_card in task_board.pyw: a dragged card dropped into section sid at
    const it = this.ents[cid];                                  // `index` among the cards shown there (not counting it); open and checked-off
    if (!it) return null;                                       // cards are shown in two groups, so it goes right after the shown card of its
    const shown = this.shownItems(sid, F).filter(c => c.id !== cid);   // own kind above the drop (or right before the first one) in the real order
    if (it.section === sid) {
      const cur = this.shownItems(sid, F).map(c => c.id);
      if (cur.includes(cid) && cur.indexOf(cid) === index) return null;
    }
    const same = shown.filter(c => !!c.done === !!it.done).map(c => c.id);
    const j = shown.slice(0, index).filter(c => !!c.done === !!it.done).length;
    const after = j > 0 ? same[j - 1] : null, before = j === 0 && same.length ? same[0] : null;
    const sec = this.section(sid);
    const b = this.batch(it.section === sid ? 'Moved card' : `Moved to ${sec ? sec.name : 'another section'}`);
    const fields = { pos: this.posNear((this.items[sid] || []).filter(x => x.id !== cid), after, before, b) };
    if (it.section !== sid) fields.section = sid;
    return b.put(cid, fields).done();
  }
  placeStep(card, ck, index) {                                  // = move_step in task_board.pyw: checklist step ck to `index` among its other steps
    const checks = this.checks[card] || [], ids = checks.map(c => c.id);
    if (!ids.includes(ck) || ids.indexOf(ck) === index) return null;
    const rest = checks.filter(c => c.id !== ck);
    const b = this.batch('Moved step');
    const pos = this.posNear(rest, index > 0 ? rest[index - 1].id : null, index === 0 && rest.length ? rest[0].id : null, b);
    return b.put(ck, { pos }).done();
  }
  posNear(items, after, before, b) {                            // = pos_near: a pos right after `after` (or right before `before`; neither = the end).
    if (!items.length) return 1.0;                              // If the gap has become too small the cards are numbered 1, 2, 3 ... first (in b)
    const ids = items.map(e => e.id), pos = n => parseFloat(items[n].pos) || 0;
    let lo, hi, slot;
    if (after && ids.includes(after)) { const i = ids.indexOf(after); lo = pos(i); hi = i + 1 < items.length ? pos(i + 1) : pos(i) + 2.0; slot = i + 1; }
    else if (before && ids.includes(before)) { const i = ids.indexOf(before); lo = i > 0 ? pos(i - 1) : pos(i) - 2.0; hi = pos(i); slot = i; }
    else return pos(items.length - 1) + 1.0;
    if (hi - lo < 1e-6) {
      items.forEach((e, n) => b.put(e.id, { pos: n + 1 }));
      lo = slot; hi = slot < items.length ? slot + 1 : slot + 2.0;
    }
    return (lo + hi) / 2;
  }
  saveNotes(cid, mine, base) {                                  // both versions kept if the other person changed them meanwhile
    const it = this.ents[cid];
    if (!it) return null;
    mine = mine.replace(/\s+$/, '');
    const cur = it.notes || '';
    if (mine === cur) return { notes: cur, who: null };
    let who = null;
    if (cur !== base && cur.trim()) {
      who = this.person(userOf((it._f.notes || ['', 0, ''])[2]))[1];
      mine = `${mine}\n\n--- ${who} changed these notes at the same time - their version: ---\n${cur}`;
    }
    this.edit(cid, 'Edited notes', { notes: mine });
    return { notes: mine, who };
  }

  // --- what the other person did ---
  otherStamp(e) {
    let best = 0;
    for (const [f, [, t, d]] of Object.entries(e._f)) if (t > best && !f.startsWith('seen_') && f !== 'pos' && !this.quiet(d)) best = t;
    return best;
  }
  cardOtherStamp(it) { return Math.max(this.otherStamp(it), ...[...(this.checks[it.id] || []), ...(this.comments[it.id] || [])].map(e => this.otherStamp(e))); }
  isUnseen(it) {
    if (this.unread.has(it.id)) return true;
    const t = this.cardOtherStamp(it);
    return t > this.seenAll && t > (this.seen[it.id] || 0);
  }
  markSeen(cid) {                                               // returns true if anything was written (messages got my 'seen' mark)
    const it = this.ents[cid];
    if (!it) return false;
    this.unread.delete(cid);
    const t = this.cardOtherStamp(it);
    if (t > (this.seen[cid] || 0)) this.seen[cid] = t;
    let marked = false;
    for (const c of this.comments[cid] || []) {
      if (this.byOther(c) && !c['seen_' + this.me]) { c._st.put(c.id, { ['seen_' + this.me]: true }); marked = true; }
    }
    if (marked) this.rebuild();
    return marked;
  }
  markAllSeen() {
    this.seenAll = this.clock.stamp();
    for (const st of this.stores) for (const [eid, f] of st.ents) {
      const a = f.author || [this.me, 0, this.device];
      if ((f.type || [null])[0] === 'comment' && a[0] !== this.me && !this.quiet(a[2]) && !f['seen_' + this.me]) st.put(eid, { ['seen_' + this.me]: true });
    }
    this.unread.clear();
    this.changed();
  }
  unseenMessages(itemId) {
    return (this.comments[itemId] || []).filter(c => this.byOther(c) && !c['seen_' + this.me] && (parseFloat(c.at) || 0) * 1e6 > this.seenAll);
  }
  unseenCount() {
    let n = 0;
    for (const ss of Object.values(this.items)) for (const it of ss) if (this.isUnseen(it)) n++;
    return n + this.unseenMessages('board').length;
  }

  activity(limit = 40) {                                        // [[stamp, person, text, card id or null], ...] newest first
    const events = [];
    const names = {};
    for (const s of this.allSections()) names[s.id] = s.name || '';
    const add = (t, d, text, target) => { if (!this.quiet(d)) events.push([t, userOf(d), text, target]); };
    for (const e of Object.values(this.ents)) {
      const f = e._f, typ = e.type;
      const created = f.type || [null, 0, ''];
      const madeThen = fld => fld in f && f[fld][2] === created[2] && Math.abs(f[fld][1] - created[1]) < 3000000;
      const title = String(e.title || e.name || e.text || '').trim();
      const short = title.length > 49 ? title.slice(0, 48) + '…' : title;
      if (typ === 'item') {
        if (e.deleted) { if ('deleted' in f && short) add(f.deleted[1], f.deleted[2], `deleted “${short}”`, null); continue; }
        add(created[1], created[2], `added “${short}” to ${names[e.section] || 'the board'}`, e.id);
        if ('done' in f && !madeThen('done')) add(f.done[1], f.done[2], `${e.done ? 'checked off' : 'unchecked'} “${short}”`, e.id);
        if ('who' in f && !madeThen('who')) {
          const w = e.who, to = w === this.me ? 'you' : this.person(w)[1];
          add(f.who[1], f.who[2], w && w !== 'both' ? `gave “${short}” to ${to}` : w === 'both' ? `made “${short}” for both of you` : `unassigned “${short}”`, e.id);
        }
        if ('due' in f && !madeThen('due'))
          add(f.due[1], f.due[2], e.due ? `set “${short}” due ${dueLabel(e.due)[0].toLowerCase()}` : `cleared the due date of “${short}”`, e.id);
        if ('title' in f && !madeThen('title')) add(f.title[1], f.title[2], `renamed a card “${short}”`, e.id);
        if ('notes' in f && !madeThen('notes')) add(f.notes[1], f.notes[2], `edited the notes of “${short}”`, e.id);
        if ('section' in f && !madeThen('section')) add(f.section[1], f.section[2], `moved “${short}” to ${names[e.section] || 'another section'}`, e.id);
        if ('shop' in f && !madeThen('shop') && e.shop) add(f.shop[1], f.shop[2], `set where to buy “${short}”: ${e.shop}`, e.id);
        if ('star' in f && !madeThen('star') && e.star) add(f.star[1], f.star[2], `starred “${short}”`, e.id);
      } else if (typ === 'comment' && !e.deleted) {
        const target = this.ents[e.item] ? e.item : null;
        const card = String((this.ents[e.item] || {}).title || '');
        const where = target ? ` on “${card.slice(0, 30)}${card.length > 30 ? '…' : ''}”` : '';
        add(created[1], created[2], `wrote${where}: “${short}”`, target || 'board');
      } else if (typ === 'check' && !e.deleted) {
        const parent = this.ents[e.item] || {};
        const card = String(parent.title || '').slice(0, 30);
        const made = (parent._f || {}).type || [null, 0, ''];
        if (!(made[2] === created[2] && Math.abs(made[1] - created[1]) < 3000000)) add(created[1], created[2], `added step “${short}” to “${card}”`, e.item);
        if ('done' in f && !madeThen('done') && e.done) add(f.done[1], f.done[2], `ticked “${short}” on “${card}”`, e.item);
      } else if (typ === 'section') {
        if (e.deleted) { if ('deleted' in f && short) add(f.deleted[1], f.deleted[2], `deleted the section ${short}`, null); continue; }
        add(created[1], created[2], `added the section ${short}`, null);
        if ('name' in f && !madeThen('name')) add(f.name[1], f.name[2], `renamed a section to ${short}`, null);
      }
    }
    events.sort((a, b) => b[0] - a[0]);
    const out = [], seen = new Set();
    for (const ev of events) {
      const key = ev[2] + '\u0000' + ev[3];
      if (!seen.has(key)) { seen.add(key); out.push(ev); }
      if (out.length >= limit) break;
    }
    return out;
  }

  // --- what's shown ---
  itemMatches(it, F) {
    if (F.who.size) {
      const people = this.forWhom(it);
      if (!(people.size ? [...people].every(p => F.who.has(p)) : F.who.has('nobody'))) return false;
    }
    if (F.star && !it.star) return false;
    if (F.today) { const d = parseDay(it.due); if (it.done || !d || d > today()) return false; }
    const q = (F.query || '').trim().toLowerCase();
    if (q) {
      const hay = [it.title || '', it.notes || '', it.shop || '', ...(this.checks[it.id] || []).map(c => c.text || ''),
        ...(this.comments[it.id] || []).map(c => c.text || '')].join(' ').toLowerCase();
      if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
    }
    return true;
  }
  doneToday(it) {
    const t = parseFloat(it.done_at) || 0;
    if (!t) return false;
    const d = new Date(t * 1000);
    return iso(d) === iso(today());
  }
  shownItems(secId, F) {                                        // open cards in order, then the done ones (today's, or all with Show done)
    const open = [], done = [];
    for (const it of this.items[secId] || []) {
      if (!this.itemMatches(it, F)) continue;
      if (it.done) { if (F.showDone || this.doneToday(it) || (F.query || '').trim()) done.push(it); } else open.push(it);
    }
    return open.concat(done);
  }
  counts() {
    const opens = Object.values(this.items).flat().filter(it => !it.done);
    const only = (it, pid) => { const s = this.forWhom(it); return s.size === 1 && s.has(pid); };
    const c = { all: opens.length, both: opens.filter(it => it.who === 'both').length, nobody: opens.filter(it => !it.who).length };
    for (const [pid] of this.people) c[pid] = opens.filter(it => only(it, pid)).length;
    c.claude = opens.filter(it => only(it, 'claude')).length;   // always 0 here: the Claude page never reaches the shared folder
    const td = today();
    c.today = opens.filter(it => { const d = parseDay(it.due); return d && d <= td; }).length;
    c.star = opens.filter(it => it.star).length;
    return c;
  }

  // --- bringing back a deleted card ---
  goneWith(st, cid) {
    const d = (st.ents.get(cid) || {}).deleted;
    if (!d || d[0] !== true) return [];
    const out = [];
    for (const [eid, f] of st.ents) {
      const dd = f.deleted;
      if (dd && dd[0] === true && dd[2] === d[2] && d[1] - 100000 <= dd[1] && dd[1] <= d[1] + 2000000 && (f.item || [''])[0] === cid &&
          ['check', 'comment'].includes((f.type || [''])[0]) && String((f.text || [''])[0]).trim()) out.push(eid);
    }
    return out;
  }
  deletedCards() {
    const found = {};
    for (const st of this.stores) for (const [eid, f] of st.ents) {
      const d = f.deleted;
      if (!d || d[0] !== true || (f.type || [''])[0] !== 'item' || !String((f.title || [''])[0]).trim()) continue;
      const e = this.ents[eid];
      if (e && !e.deleted) continue;
      if (!found[eid] || d[1] > found[eid][0]) found[eid] = [d[1], d[2], eid, st];
    }
    return Object.values(found).sort((a, b) => b[0] - a[0]);
  }
  bringBack(rows) {
    if (!rows.length) return null;
    const b = this.batch(rows.length === 1 ? 'Brought back card' : `Brought back ${rows.length} cards`);
    for (const [, , cid, st] of rows) {
      const kids = this.goneWith(st, cid);
      b.put(cid, { deleted: false }, st);
      for (const eid of kids) b.put(eid, { deleted: false }, st);
      const sec = this.ents[(st.ents.get(cid).section || [''])[0]];
      if (sec && sec.deleted && sec.type === 'section' && String(sec.name || '').trim()) { b.put(sec.id, { deleted: false }, sec._st); sec.deleted = false; }
    }
    return b.done();
  }

  cardText(it) {
    const lines = [(it.done ? '[x] ' : '[ ] ') + (it.title || '')];
    for (const c of this.checks[it.id] || []) lines.push((c.done ? '    [x] ' : '    [ ] ') + (c.text || ''));
    if ((it.notes || '').trim()) for (const l of it.notes.trim().split('\n')) lines.push('    ' + l);
    return lines.join('\n');
  }

  parseQuick(text) {                                            // '@deb buy stamps !' -> who 'deb', star, title 'buy stamps'
    let who = '', star = false;
    const words = [];
    const names = {};
    for (const p of this.people) { names[p[0]] = p[0]; names[p[1].toLowerCase()] = p[0]; }
    names.both = 'both'; names.all = 'both';
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const key = word.slice(1).toLowerCase().replace(/^[.,]+|[.,]+$/g, '');
      if (word.startsWith('@') && key in names) who = names[key];
      else if (word === '!') star = true;
      else words.push(word);
    }
    let title = words.join(' ');
    if (title.startsWith('!')) { star = true; title = title.slice(1).trim(); }
    return { who, star, title };
  }
}
