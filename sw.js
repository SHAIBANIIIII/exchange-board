/**
 * Service Worker — لوحة أسعار العملات (العالمية إكسبرس)
 * - يخزّن الصفحة نفسها (Shell كامل) للعمل بدون إنترنت.
 * - يخزّن الأيقونات والخط.
 * - يتعامل مع بيانات الـ Worker API بأسلوب "الشبكة أولاً ثم النسخة المحفوظة"
 *   عشان تكون البيانات محدثة عند توفر الإنترنت، وتشتغل من آخر نسخة محفوظة عند انقطاعه.
 * - لا يعيد تحميل الصفحة كاملة أبدًا؛ فقط يعترض الطلبات (fetch) بالخلفية.
 */

const CACHE_VERSION = 'exchange-board-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon-180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('SW install cache error', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Live API calls (state + images): network-first, cache as a fallback for offline.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Everything else (the app shell, fonts, icons): cache-first, refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
