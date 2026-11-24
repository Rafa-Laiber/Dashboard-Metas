// Servidor simples que entrega os arquivos do site (a pasta acima de testes/).
const http=require("http"),fs=require("fs"),path=require("path");
const raiz=path.resolve(__dirname,"..");
const tipos={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png"};
http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p.endsWith("/"))p+="index.html";
  // nos testes: cookie "teste" troca o config.js por um falso e cookie "mock" troca o Supabase pelo banco simulado
  const ck=req.headers.cookie||"";
  if(p==="/config.js"&&/teste=1/.test(ck)){res.writeHead(200,{"content-type":"text/javascript","cache-control":"no-store"});return res.end('window.METAS_CONFIG={SUPABASE_URL:"https://teste.supabase.co",SUPABASE_KEY:"k"}')}
  if(p==="/lib/supabase.js"&&/mock=1/.test(ck)){res.writeHead(200,{"content-type":"text/javascript","cache-control":"no-store"});return fs.createReadStream(path.join(__dirname,"mock.js")).pipe(res)}
  const f=path.join(raiz,p);
  if(!f.startsWith(raiz)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end("404")}
  res.writeHead(200,{"content-type":tipos[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});
  fs.createReadStream(f).pipe(res);
}).listen(4173,()=>console.log("site em http://127.0.0.1:4173"));
