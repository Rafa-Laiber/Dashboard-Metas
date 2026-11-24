// Service worker: deixa o site abrir sem internet.
// Com internet: sempre busca a versão mais nova dos arquivos (e guarda uma cópia).
// Sem internet (ou internet muito lenta): usa a cópia guardada.
// Os dados das metas não passam por aqui: eles ficam guardados pelo próprio app.
const VERSAO = "metas-v12";
const ARQUIVOS = [
  "./", "index.html", "config.js", "manifest.json", "favicon.svg", "icon-180.png", "icon-192.png",
  "css/app.css?v=12", "js/tema.js?v=12", "js/base.js?v=12", "js/dados.js?v=12", "js/telas.js?v=12",
  "js/gaveta.js?v=12", "js/eventos.js?v=12", "js/perfil.js?v=12", "js/inicio.js?v=12",
  "lib/supabase.js?v=2.119.0", "lib/Sortable.min.js?v=1.15.2"
];
const FONTES = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => Promise.all(ARQUIVOS.map(a => c.add(new Request(a, { cache: "no-cache" })).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function redePrimeiro(req) {
  const cache = await caches.open(VERSAO);
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
  try {
    const resp = await fetch(req.url, { cache: "no-cache", credentials: "same-origin", signal: ctl.signal });
    clearTimeout(t);
    if (resp.ok) cache.put(req.url, resp.clone());
    return resp;
  } catch (err) {
    clearTimeout(t);
    const guardado = await cache.match(req.url) || (req.mode === "navigate" ? await cache.match("index.html") || await cache.match("./") : null);
    if (guardado) return guardado;
    throw err;
  }
}

async function fontes(req) {
  const cache = await caches.open(VERSAO);
  const guardado = await cache.match(req);
  const busca = fetch(req).then(r => { if (r.ok || r.type === "opaque") cache.put(req, r.clone()); return r; }).catch(() => null);
  return guardado || (await busca) || Response.error();
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(redePrimeiro(req));
  else if (FONTES.test(req.url)) e.respondWith(fontes(req));
  // o resto (banco de dados, login) vai direto, sem passar pelo cache
});
