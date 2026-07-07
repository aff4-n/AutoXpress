const CACHE = 'autoxpress-v2';
const ASSETS = [
  './', './index.html', './manifest.json',
  './css/style.css?v=2',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js', // <-- ADD THIS
  './js/icons.js', './js/utils.js', './js/storage.js', './js/notifications.js', './js/theme.js',
  './js/metrics.js', './js/dashboard.js', './js/inventory.js', './js/sales.js', './js/investment.js',
  './js/analytics.js', './js/reports.js', './js/settings.js', './js/app.js'
];
  
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  if(e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      const fetchPromise = fetch(e.request).then(res=>{
        // Change this line to accept local origin OR the cdn origin
        if(res && res.status===200 && (e.request.url.startsWith(self.location.origin) || e.request.url.includes('cdnjs.cloudflare.com'))){
          const clone = res.clone();
          caches.open(CACHE).then(c=>c.put(e.request, clone));
        }
        return res;
      }).catch(()=>cached);
      return cached || fetchPromise;
    })
  );
});
