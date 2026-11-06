// version.js - the phone Task Board's version and change log.  The page shows them (menu > About) and the service worker uses the version,
// so changing this file is what makes phones offer "Version x is here - tap to update".  Bump APP_VERSION and add a line for every change.
//
// CHANGE LOG (newest first, 1 line per change):
// 2026-11-05  v1.0.1  Setup warns when another phone or browser already uses that name (its file is on the board) and suggests a free one (phone-2...)
// 2026-11-05  v1.0.0  First version: the DO / BUY pages, cards, check off, add, checklist, messages, what's new, the gold glow - on the shared Dropbox folder

self.APP_VERSION = '1.0.1';
self.CHANGE_LOG = [
  ['2026-11-05', '1.0.1', 'Setup warns when another phone or browser already uses that name (its file is on the board) and suggests a free one (phone-2...)'],
  ['2026-11-05', '1.0.0', 'First version: the DO / BUY pages, cards, check off, add, checklist, messages, what\'s new, the gold glow - on the shared Dropbox folder'],
];
