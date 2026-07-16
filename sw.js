const CACHE = 'luma-pbr-v1';
const ASSETS = [
  './pbr.html',
  './pbr.css',
  './pbr.js',
  './assets/pbr/metal-color.jpg',
  './assets/pbr/metal-normal.jpg',
  './assets/pbr/metal-roughness.jpg',
  './assets/pbr/metal-metalness.jpg',
  './assets/pbr/metal-height.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});
