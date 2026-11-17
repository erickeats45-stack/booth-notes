const CACHE='zhanyu-booth-notes-v1';
const ASSETS=['./','./index.html','./style.css','./app.js','./card-parser.js','./demo-card.png','./manifest.json','./icon.png','./icon-512.png','./tesseract.min.js','./worker.min.js','./tesseract-core-simd-lstm.wasm.js','./tesseract-core-lstm.wasm.js','./eng.traineddata.gz'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('zhanyu-booth-notes-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));});

self.addEventListener('message',event=>{if(event.data==='activate')self.skipWaiting();});
