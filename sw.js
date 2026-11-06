// sw.js - keeps the app on the phone so it opens without the network, and fetches a new version when version.js changes.
// The new version waits until the person taps "Update" (app.js sends 'skipWaiting').  Dropbox calls are never cached.
importScripts('version.js');
const CACHE = 'tb-app-' + self.APP_VERSION;
const FONTS = 'tb-fonts';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'engine.js', 'dropbox.js', 'version.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/favicon-64.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('tb-app-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.searchParams.has('fresh')) return;    // the page asking what the newest version is: always the network
  if (url.origin === location.origin) {                         // the app's own files: from the cache, the network only for what isn't there
    e.respondWith(caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req))));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  }
});
