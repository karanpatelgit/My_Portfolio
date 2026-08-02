/* ==========================
sw.js
========================== */

const CACHE="lifeos-v5";

const FILES=[

"./",

"./index.html",

"./style.css",

"./app.js",

"./api.js",

"./charts.js",

"./settings.js",

"./chat.js",

"./reminders.js",

"./manifest.json",

"https://cdn.jsdelivr.net/npm/chart.js",

"https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",

"https://fonts.googleapis.com/icon?family=Material+Icons+Round"

];

self.addEventListener("install",e=>{

e.waitUntil(

caches.open(CACHE).then(cache=>

Promise.allSettled(

FILES.map(url=>cache.add(url).catch(err=>console.warn("SW cache skip:",url,err)))

)

)

);

self.skipWaiting();

});

self.addEventListener("fetch",e=>{

if(e.request.method!=="GET") return;

const url=new URL(e.request.url);
const isSameOrigin=url.origin===self.location.origin;

if(isSameOrigin){

e.respondWith(

fetch(e.request)

.then(res=>{

const clone=res.clone();

caches.open(CACHE).then(cache=>cache.put(e.request,clone));

return res;

})

.catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html")))

);

return;

}

e.respondWith(

caches.match(e.request)

.then(r=>r||fetch(e.request))

.catch(()=>caches.match("./index.html"))

);

});

self.addEventListener("activate",e=>{

e.waitUntil(

caches.keys()

.then(keys=>

Promise.all(

keys

.filter(k=>k!==CACHE)

.map(k=>caches.delete(k))

)

).then(()=>self.clients.claim())

);

});
