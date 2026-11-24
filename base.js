// Constantes, estado, utilidades, preferências, pessoas e regras de progresso.
/* ================= Metas: app ================= */
const DEF_AREAS=[{k:"Finanças",c:1},{k:"Carreira e estudos",c:2},{k:"Saúde e hábitos",c:3},{k:"Projetos pessoais",c:4},{k:"Pessoal e família",c:5}];
const STATUS=["Não iniciada","Em andamento","Concluída","Pausada"];
const STATUS_CLS={"Não iniciada":"s-idle","Em andamento":"s-run","Concluída":"s-done","Pausada":"s-pause"};
const PRIOS=["Alta","Média","Baixa"];
const PRIO_CLS={"Alta":"p-alta","Média":"p-media","Baixa":"p-baixa"};
const TIPOS=["Numérica","Etapas","Marco único","Hábito semanal"];
const SEMANA_SEG=["seg","ter","qua","qui","sex","sáb","dom"],SEMANA_DOM=["dom","seg","ter","qua","qui","sex","sáb"];
const inicioDomingo=()=>prefs&&prefs.semana==="dom";
const diasSem=()=>inicioDomingo()?SEMANA_DOM:SEMANA_SEG;
const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

let sb=null, usuario=null, prefs={}, metas=[], perfis={}, loaded=false, erroCarga=false;
let filtroArea=null, editId=null, sortable=null;
const MQ=window.matchMedia("(max-width: 700px)");
const isMob=()=>MQ.matches;
let aba="metas", abaGaveta="prog", arrastando=false;

/* ---------- utilidades ---------- */
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Math.random().toString(36).slice(2,10);
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const hoje=()=>iso(new Date());
const deIso=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
function segunda(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const w=inicioDomingo()?x.getDay():(x.getDay()+6)%7;x.setDate(x.getDate()-w);return x}
const semanaDe=s=>iso(segunda(deIso(s)));
function lerNumero(v){
  let t=String(v??"").trim().replace(/\s|R\$/g,"");
  if(t.includes(","))t=t.replace(/\./g,"").replace(",",".");
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,"");
  return parseFloat(t);
}
const pctTxt=p=>{const v=p*100;return (v>0&&v<10?v.toLocaleString("pt-BR",{maximumFractionDigits:1}):Math.round(v))+"%"};
const num=n=>Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:2});
const comUnidade=(n,u)=>u==="R$"?"R$ "+num(n):num(n)+(u?" "+u:"");
const dataBR=s=>{if(!s)return"";const [y,m,d]=s.split("-");return d+"/"+m+"/"+y};
function diasAte(s){if(!s)return null;const h=new Date();h.setHours(0,0,0,0);return Math.round((deIso(s)-h)/86400000)}
const arred=n=>Math.round(n*100)/100;

/* ---------- preferências (guardadas na conta) ---------- */
const anoAtual=()=>new Date().getFullYear();
const anoDe=m=>m.prazo?parseInt(m.prazo.slice(0,4),10):null;
const todosAnos=()=>prefs.ano==="todos";
// ano escolhido; sem escolha salva, usa o primeiro ano (do atual em diante) que tem metas
function ano(){
  const a=parseInt(prefs.ano,10);if(a>=2000&&a<=2100)return a;
  const futuros=metas.map(anoDe).filter(y=>y&&y>=anoAtual()).sort((x,y)=>x-y);
  return futuros[0]||anoAtual();
}
const noAno=(m,a)=>!m.prazo||anoDe(m)===a;
const doAno=()=>todosAnos()?metas:metas.filter(m=>noAno(m,ano()));
function anosComMetas(){return [...new Set(metas.map(anoDe).filter(Boolean))].sort((a,b)=>a-b)}
function novoPrazo(p,alvo){if(!p)return alvo+"-12-31";let md=p.slice(4);if(md==="-02-29"&&!(alvo%4===0&&(alvo%100!==0||alvo%400===0)))md="-02-28";return alvo+md}
const corNum=c=>{c=parseInt(c,10);return c>=1&&c<=8?c:8};
// só aceita nome em texto e cor de 1 a 8 (protege contra dados estranhos nas preferências)
function minhasAreas(){const a=Array.isArray(prefs.areas)&&prefs.areas.length?prefs.areas:DEF_AREAS;
  return a.filter(x=>x&&typeof x.k==="string"&&x.k.trim()).map(x=>({k:x.k,c:corNum(x.c)}))}
function todasAreas(){const l=minhasAreas().slice();metas.forEach(m=>{if(m.area&&!l.some(a=>a.k===m.area))l.push({k:m.area,c:8,extra:true})});return l}
const corArea=k=>"var(--c"+corNum((todasAreas().find(a=>a.k===k)||{c:8}).c)+")";
async function salvarPrefs(obj){
  const antes=prefs;prefs={...prefs,...obj};
  const {data,error}=await sb.auth.updateUser({data:obj});
  if(error){prefs=antes;toast("Não consegui salvar a preferência: "+error.message,5000);return false}
  usuario=data.user;prefs=usuario.user_metadata||{};return true;
}

/* ---------- pessoas ---------- */
const souDono=m=>!!usuario&&m.user_id===usuario.id;
const membrosDe=m=>(m.meta_membros||[]).map(x=>x.user_id);
const compartilhada=m=>membrosDe(m).filter(id=>id!==m.user_id).length>0||!souDono(m);
function nomePessoa(id){const p=perfis[id];if(!p)return"alguém da família";return (p.nome||"").trim()||(p.email||"").split("@")[0]}
const primeiroNome=id=>nomePessoa(id).split(/\s+/)[0];
function iniciaisDe(nome,email){
  const n=(nome||"").trim();
  if(n){const p=n.split(/\s+/).filter(Boolean);return ((p[0]||"")[0]+(p.length>1?p[p.length-1][0]:"")).toUpperCase()}
  return (email||"?").slice(0,2).toUpperCase();
}

/* ---------- progresso ---------- */
function contagemSemanas(m){const c={};(m.dias||[]).forEach(d=>{const k=semanaDe(d);c[k]=(c[k]||0)+1});return c}
function semanasCumpridas(m){const v=Math.max(1,Number(m.vezes)||1);return Object.values(contagemSemanas(m)).filter(n=>n>=v).length}
function sequencia(m){
  const v=Math.max(1,Number(m.vezes)||1),c=contagemSemanas(m);let s=0;
  let w=segunda(new Date());
  if((c[iso(w)]||0)<v)w.setDate(w.getDate()-7); // semana atual ainda em andamento
  while((c[iso(w)]||0)>=v){s++;w.setDate(w.getDate()-7)}
  return s;
}
function progresso(m){
  if(m.tipo==="Numérica"){const a=Number(m.atual)||0,t=Number(m.alvo)||0;return t>0?Math.max(0,Math.min(1,a/t)):0}
  if(m.tipo==="Hábito semanal"){const t=Number(m.alvo)||0;return t>0?Math.min(1,semanasCumpridas(m)/t):0}
  if(m.status==="Concluída"&&m.tipo==="Marco único")return 1;
  const et=m.etapas||[];
  if(!et.length)return m.status==="Concluída"?1:0;
  return et.filter(e=>e.feita).length/et.length;
}
function comStatus(m,patch){carimbar(m,regraStatus(m,patch));return patch}
function carimbar(m,patch){
  if(!("status" in patch))return patch;
  if(patch.status==="Concluída"&&m.status!=="Concluída")patch.concluida_em=hoje();
  else if(patch.status!=="Concluída"&&m.status==="Concluída")patch.concluida_em=null;
  return patch;
}
function regraStatus(m,patch){
  const n={...m,...patch};const p=progresso(n);
  if(n.status==="Pausada"||"status" in patch)return patch;
  if(p>=1&&n.status!=="Concluída")patch.status="Concluída";
  else if(p<1&&n.status==="Não iniciada"&&(p>0||(n.dias||[]).length||(n.registros||[]).length))patch.status="Em andamento";
  else if(p>0&&p<1&&n.status==="Concluída")patch.status="Em andamento";
  else if(p===0&&n.status==="Em andamento"&&!(n.registros||[]).length&&!(n.dias||[]).length)patch.status="Não iniciada";
  return patch;
}
