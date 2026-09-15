/* =================================================================
   Auton Huoltokirja – service worker
   Muuta VERSION aina kun julkaiset päivityksen.
   ================================================================= */
const VERSION = "2.0.0";
const CACHE   = "huoltokirja-" + VERSION;

/* Suhteelliset polut, jotta sovellus toimii missä tahansa alikansiossa. */
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/* ---------- Asennus ---------- */
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .catch(err => console.warn("Esilataus epäonnistui", err))
  );
  /* Ei skipWaiting täällä: uusi versio odottaa, kunnes käyttäjä painaa Päivitä. */
});

/* ---------- Aktivointi: siivoa vanhat välimuistit ---------- */
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    if(self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch(err){}
    }
    await self.clients.claim();
  })());
});

/* ---------- Sovellus pyytää siirtymään uuteen versioon ---------- */
self.addEventListener("message", e => {
  if(e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

/* ---------- Haku ---------- */
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);

  /* Firestorea ja kirjautumista ei koskaan välimuistiteta. */
  if(/firestore\.googleapis\.com|identitytoolkit|securetoken|firebaseinstallations/.test(url.hostname)) return;

  /* 1) HTML ja sivun avaus: verkko ensin, välimuisti varalla.
        Tämä on se korjaus, jonka ansiosta julkaistu päivitys näkyy heti. */
  if(req.mode === "navigate" || req.destination === "document"){
    e.respondWith((async () => {
      try{
        const preload = await e.preloadResponse;
        const res = preload || await fetch(req);
        const c = await caches.open(CACHE);
        c.put("./index.html", res.clone());
        return res;
      }catch(err){
        const c = await caches.open(CACHE);
        return (await c.match("./index.html")) || (await c.match("./")) ||
               new Response("Ei verkkoyhteyttä.", { status:503, headers:{ "Content-Type":"text/plain;charset=utf-8" } });
      }
    })());
    return;
  }

  /* 2) Firebase-kirjastot: välimuisti ensin, päivitys taustalla. */
  if(url.hostname === "www.gstatic.com"){
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if(res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || new Response("", { status:504 });
    })());
    return;
  }

  /* 3) Oma staattinen sisältö: välimuisti ensin, päivitys taustalla. */
  if(url.origin === location.origin){
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      const net = fetch(req).then(res => {
        if(res && res.status === 200 && res.type === "basic") c.put(req, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await net) || new Response("", { status:504 });
    })());
  }
});
