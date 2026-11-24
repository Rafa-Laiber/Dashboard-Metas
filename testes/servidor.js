// Servidor simples que entrega os arquivos do site (a pasta acima de testes/).
const http=require("http"),fs=require("fs"),path=require("path");
const raiz=path.resolve(__dirname,"..");
const tipos={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png"};
http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p.endsWith("/"))p+="index.html";
  const f=path.join(raiz,p);
  if(!f.startsWith(raiz)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end("404")}
  res.writeHead(200,{"content-type":tipos[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});
  fs.createReadStream(f).pipe(res);
}).listen(4173,()=>console.log("site em http://127.0.0.1:4173"));
