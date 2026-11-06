// version.js - the phone Task Board's version and change log.  The page shows them (menu > About) and the service worker uses the version,
// so changing this file is what makes phones offer "Version x is here - tap to update".  Bump APP_VERSION and add a line for every change.
//
// CHANGE LOG (newest first, 1 line per change):
// 2026-11-06  v1.0.3  Hold a checklist step in an open card and move it up or down to put the steps in order
// 2026-11-05  v1.0.2  Hold a card and move it to drag it to a new place (in its section or another one), like on the PC; hold and let go = its menu
// 2026-11-05  v1.0.1  Setup warns when another phone or browser already uses that name (its file is on the board) and suggests a free one (phone-2...)
// 2026-11-05  v1.0.0  First version: the DO / BUY pages, cards, check off, add, checklist, messages, what's new, the gold glow - on the shared Dropbox folder

self.APP_VERSION = '1.0.3';
self.CHANGE_LOG = [
  ['2026-11-06', '1.0.3', 'Hold a checklist step in an open card and move it up or down to put the steps in order'],
  ['2026-11-05', '1.0.2', 'Hold a card and move it to drag it to a new place (in its section or another one), like on the PC; hold and let go = its menu'],
  ['2026-11-05', '1.0.1', 'Setup warns when another phone or browser already uses that name (its file is on the board) and suggests a free one (phone-2...)'],
  ['2026-11-05', '1.0.0', 'First version: the DO / BUY pages, cards, check off, add, checklist, messages, what\'s new, the gold glow - on the shared Dropbox folder'],
];
