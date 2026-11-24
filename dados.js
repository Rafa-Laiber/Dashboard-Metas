// Banco: fila de salvamento (funciona sem internet), histórico de avanços, criar/excluir/compartilhar.
/* ---------- banco ---------- */
const CAMPOS=["nome","area","tipo","prioridade","status","prazo","atual","alvo","unidade","notas","ordem","etapas","registros","vezes","dias","concluida_em"];
const limpar=o=>{const r={};for(const k of CAMPOS)if(k in o){r[k]=(k==="prazo"&&!o[k])?null:o[k]}return r};
const norm=d=>({...d,prazo:d.prazo||"",atual:Number(d.atual)||0,alvo:Number(d.alvo)||0,vezes:Number(d.vezes)||3,
  etapas:(d.etapas||[]).map(e=>({...e})),registros:(d.registros||[]).map(r=>({...r})),dias:(d.dias||[]).slice(),meta_membros:(d.meta_membros||[]).map(x=>({...x}))});
const SEL=()=>"*, meta_membros(user_id)";
/* Cada alteração vira uma "operação" simples (dá para guardar e repetir sem duplicar).
   A tela muda na hora; a operação entra numa fila guardada no aparelho e só sai de lá
   quando o banco confirma. Sem internet, ela espera e tenta de novo sozinha. */
function efeito(b,op){
  const et=()=>(b.etapas||[]).map(x=>({...x})),regs=b.registros||[];
  switch(op.t){
    case "set":return{...op.p};
    case "soma":if(regs.some(r=>r.id===op.rid))return null;
      return{atual:arred((Number(b.atual)||0)+op.v),registros:[...regs,{id:op.rid,valor:op.v,data:op.d}]};
    case "rmReg":{const r=regs.find(x=>x.id===op.rid);if(!r)return null;
      return{registros:regs.filter(x=>x.id!==op.rid),atual:arred((Number(b.atual)||0)-Number(r.valor||0))}}
    case "etapa":{const l=et(),e=l.find(x=>x.id===op.eid);if(!e||!!e.feita===op.feita)return null;
      e.feita=op.feita;if(op.feita)e.feitaEm=op.d;else delete e.feitaEm;return{etapas:l}}
    case "etapaAdd":{const l=et();if(l.some(x=>x.id===op.eid))return null;l.push({id:op.eid,texto:op.texto,feita:false});return{etapas:l}}
    case "etapaRm":{const l=et();if(!l.some(x=>x.id===op.eid))return null;return{etapas:l.filter(x=>x.id!==op.eid)}}
    case "etapaTexto":{const l=et(),e=l.find(x=>x.id===op.eid);if(!e||e.texto===op.texto)return null;e.texto=op.texto;return{etapas:l}}
    case "etapaMover":{const l=et(),i=l.findIndex(x=>x.id===op.eid);if(i<0||i===op.para)return null;
      const [e]=l.splice(i,1);l.splice(Math.max(0,Math.min(op.para,l.length)),0,e);return{etapas:l}}
    case "dia":{const st=new Set(b.dias||[]);if(st.has(op.dia)===op.on)return null;op.on?st.add(op.dia):st.delete(op.dia);return{dias:[...st].sort()}}
  }
  return null;
}
let pend=[],enviando=false,denovo=false,tentativa=0,timerPend=null;
const chavePend=()=>"metas_pend_"+(usuario?usuario.id:"");
function guardarPend(){try{pend.length?localStorage.setItem(chavePend(),JSON.stringify(pend)):localStorage.removeItem(chavePend())}catch(e){}}
function lerPend(){try{const l=JSON.parse(localStorage.getItem(chavePend())||"[]");return Array.isArray(l)?l.filter(x=>x&&x.id&&x.op&&x.op.t):[]}catch(e){return[]}}
// reaplica na tela o que ainda não chegou ao banco (depois de recarregar dados do servidor)
function reaplicar(m){for(const it of pend)if(it.id===m.id){const pt=efeito(m,it.op);if(pt&&Object.keys(pt).length)Object.assign(m,comStatus(m,pt))}return m}
function redesenhar(id){render();if(editId===id&&!$("drawer").contains(document.activeElement))desenharGaveta()}
function gravar(id,op){
  const m=metas.find(x=>x.id===id);if(!m)return;
  const local=efeito(m,op);if(!local||!Object.keys(local).length)return;
  Object.assign(m,comStatus(m,local));redesenhar(id);
  pend.push({id,op});guardarPend();enviarPend();
}
const salvar=(id,patch)=>gravar(id,{t:"set",p:{...patch}});
function erroDe(r){const e=new Error((r.error&&r.error.message)||"erro");e.status=r.status;e.code=r.error&&r.error.code;return e}
// erro de conexão (vale tentar de novo) x erro de verdade (não adianta repetir)
function passageiro(e){
  if(typeof navigator!=="undefined"&&navigator.onLine===false)return true;
  if(e.status===0||e.status===408||e.status===429||e.status>=500)return true;
  return /fetch|network|load failed|timeout|timed out|offline|JWT expired|conex/i.test(e.message||"");
}
async function lerMeta(id){
  const r=await sb.from("metas").select(SEL()).eq("id",id).maybeSingle();
  if(r.error)throw erroDe(r);
  if(!r.data){const e=new Error("essa meta não existe mais ou deixou de ser compartilhada com você");e.status=404;throw e}
  return r.data;
}
const comRegs=(d,regs)=>norm({...d,registros:regs});
async function executar(id,op){
  const atual=metas.find(x=>x.id===id),regs=atual?atual.registros:[];
  let base;
  if(op.t==="soma"||op.t==="rmReg"){
    // a soma e o histórico são gravados juntos, numa operação só no banco (não duplica se repetir)
    const r=op.t==="soma"?await sb.rpc("avanco_somar",{p_meta:id,p_id:op.rid,p_valor:op.v,p_data:op.d})
                         :await sb.rpc("avanco_apagar",{p_meta:id,p_id:op.rid});
    if(r.error)throw erroDe(r);
    base=comRegs(await lerMeta(id),regs);
    const st=comStatus(base,{});if(!Object.keys(st).length)return base;
    const u=await sb.from("metas").update(limpar(st)).eq("id",id).select(SEL()).single();
    if(u.error)throw erroDe(u);return comRegs(u.data,regs);
  }
  base=comRegs(await lerMeta(id),regs);
  const patch=efeito(base,op);if(!patch||!Object.keys(patch).length)return base;
  const envio=limpar(comStatus(base,patch));delete envio.registros;
  const u=await sb.from("metas").update(envio).eq("id",id).select(SEL()).single();
  if(u.error)throw erroDe(u);return comRegs(u.data,regs);
}
async function enviarPend(){
  if(enviando){denovo=true;return}
  if(!pend.length||!sb||!usuario){mostrarPend();return}
  enviando=true;clearTimeout(timerPend);mostrarPend();
  try{
    while(pend.length){
      const it=pend[0];
      try{
        const novo=await executar(it.id,it.op);
        pend.shift();guardarPend();tentativa=0;
        const i=metas.findIndex(x=>x.id===it.id);if(i>=0){metas[i]=reaplicar(novo);redesenhar(it.id)}
      }catch(e){
        if(passageiro(e)){tentativa++;timerPend=setTimeout(enviarPend,[3,8,20,45][tentativa-1]*1000||90000);break}
        pend.shift();guardarPend();
        toast("Não consegui salvar: "+(e.message||"erro")+". Voltei a meta para o que está salvo.",6000);
        await recarregarMeta(it.id);
      }
    }
  }finally{enviando=false;mostrarPend();if(denovo&&pend.length){denovo=false;tentativa=0;setTimeout(enviarPend,0)}denovo=false}
}
async function recarregarMeta(id){
  try{const d=await lerMeta(id);let regs=[];
    {const a=await lerAvancos(id);if(!a.error)regs=a.data}
    const i=metas.findIndex(x=>x.id===id);if(i>=0)metas[i]=reaplicar(comRegs(d,regs));
  }catch(e){if(e.status===404){metas=metas.filter(x=>x.id!==id);pend=pend.filter(x=>x.id!==id);guardarPend();if(editId===id)fechar()}}
  redesenhar(id);
}
function mostrarPend(){
  const el=$("pend");if(!el)return;const n=pend.length;
  el.hidden=!n;if(!n)return;
  const off=navigator.onLine===false,txt=n===1?"1 alteração não salva":n+" alterações não salvas";
  el.querySelector("span").textContent=enviando&&!off?"Salvando…":(off?"Sem internet · ":"")+txt;
  el.querySelector("button").hidden=enviando;
  el.classList.toggle("off",off);
}
window.addEventListener("online",()=>{tentativa=0;if(semConexao)carregar();else enviarPend()});

/* ---------- ao vivo: mudanças de outras pessoas aparecem na hora ---------- */
let canal=null,aoVivoCaiu=false,timerRecarga=null;
function ligarAoVivo(){
  if(canal||!sb||typeof sb.channel!=="function")return;
  const ouvir={event:"*",schema:"public"};
  canal=sb.channel("metas-ao-vivo")
    .on("postgres_changes",{...ouvir,table:"metas"},aoVivo)
    .on("postgres_changes",{...ouvir,table:"avancos"},aoVivo)
    .on("postgres_changes",{...ouvir,table:"meta_membros"},aoVivo)
    .subscribe(st=>{
      // se a conexão ao vivo caiu e voltou, busca tudo de novo para não perder nada do intervalo
      if(st==="SUBSCRIBED"){if(aoVivoCaiu){aoVivoCaiu=false;recarregarLogo()}}
      else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT"||st==="CLOSED")aoVivoCaiu=true;
    });
}
function desligarAoVivo(){if(canal){try{sb.removeChannel(canal)}catch(e){}canal=null}}
function recarregarLogo(){clearTimeout(timerRecarga);timerRecarga=setTimeout(()=>{if(usuario)carregar()},700)}
function aoVivo(p){
  if(!usuario||!loaded)return;
  const t=p.table,ev=p.eventType,n=p.new||{},o=p.old||{};
  if(t==="meta_membros"){recarregarLogo();return}
  if(t==="metas"){
    if(ev==="DELETE"){
      if(!metas.some(m=>m.id===o.id))return;
      metas=metas.filter(m=>m.id!==o.id);pend=pend.filter(x=>x.id!==o.id);guardarPend();
      if(editId===o.id)fechar();render();return;
    }
    const i=metas.findIndex(m=>m.id===n.id);
    if(i<0){recarregarLogo();return} // meta nova (de outro aparelho ou compartilhada agora)
    const m=metas[i];
    if(n.updated_at&&m.updated_at===n.updated_at)return; // eco do que eu mesmo salvei
    metas[i]=reaplicar(comRegs({...n,meta_membros:m.meta_membros},m.registros));
    redesenhar(n.id);
    if(n.alterado_por&&n.alterado_por!==usuario.id){
      toast(primeiroNome(n.alterado_por)+" atualizou \u201c"+metas[i].nome+"\u201d");piscar(n.id);
    }
    return;
  }
  if(t==="avancos"){
    const id=n.meta_id||o.meta_id,m=metas.find(x=>x.id===id);if(!m)return;
    if(ev==="INSERT"&&!m.registros.some(r=>r.id===n.id)){
      m.registros=[...m.registros,{id:n.id,valor:Number(n.valor)||0,data:n.data}].sort((a,b)=>String(a.data).localeCompare(String(b.data)));
    }else if(ev==="DELETE"){m.registros=m.registros.filter(r=>r.id!==o.id)}else return;
    redesenhar(id);
  }
}
function piscar(id){requestAnimationFrame(()=>{const el=document.querySelector('.card[data-id="'+CSS.escape(id)+'"]');if(el){el.classList.remove("vivo");void el.offsetWidth;el.classList.add("vivo")}})}

/* ---------- cópia dos dados no aparelho (para abrir sem internet) ---------- */
let semConexao=false;
const chaveCopia=()=>"metas_copia_"+(usuario?usuario.id:"");
function guardarCopia(d){try{localStorage.setItem(chaveCopia(),JSON.stringify({...d,quando:Date.now()}))}catch(e){}}
function lerCopia(){try{return JSON.parse(localStorage.getItem(chaveCopia())||"null")}catch(e){return null}}
function apagarCopia(){try{localStorage.removeItem(chaveCopia())}catch(e){}}
window.addEventListener("offline",mostrarPend);
window.addEventListener("beforeunload",e=>{if(pend.length){try{localStorage.setItem(chavePend(),JSON.stringify(pend))}catch(err){e.preventDefault();e.returnValue=""}}});
// histórico de avanços (tabela própria, lida em páginas de 1000)
async function lerAvancos(metaId){
  let out=[];
  for(let de=0;;de+=1000){
    let q=sb.from("avancos").select("meta_id,id,valor,data,criado_em");
    if(metaId)q=q.eq("meta_id",metaId);
    const r=await q.order("data").order("criado_em").order("id").range(de,de+999);
    if(r.error)return{error:r.error};
    out=out.concat(r.data||[]);if(!r.data||r.data.length<1000)break;
  }
  return{data:out.map(x=>({id:x.id,valor:Number(x.valor)||0,data:x.data,meta_id:x.meta_id}))};
}
function novaMetaBase(o){return{nome:"Nova meta",area:filtroArea||minhasAreas()[0].k,tipo:"Etapas",prioridade:"Média",status:"Não iniciada",prazo:ano()+"-12-31",atual:0,alvo:0,unidade:"",notas:"",ordem:Date.now()%1e9,etapas:[],registros:[],vezes:3,dias:[],...o}}
async function criarMeta(){
  const {data,error}=await sb.from("metas").insert(limpar(novaMetaBase({}))).select(SEL()).single();
  if(error){toast("Não consegui criar a meta: "+error.message);return}
  metas.push(norm(data));render();abrir(data.id,"det");
}
async function excluirMeta(id){
  const {error}=await sb.from("metas").delete().eq("id",id);
  if(error){toast("Não consegui excluir: "+error.message);return}
  metas=metas.filter(m=>m.id!==id);fechar();render();toast("Meta excluída.");
}
async function sairDaMeta(id){
  const {error}=await sb.from("meta_membros").delete().eq("meta_id",id).eq("user_id",usuario.id);
  if(error){toast("Não consegui sair da meta: "+error.message);return}
  metas=metas.filter(m=>m.id!==id);fechar();render();toast("Você saiu da meta.");
}
async function alternarMembro(id,pessoa,ligar){
  const m=metas.find(x=>x.id===id);if(!m)return;
  const q=ligar?sb.from("meta_membros").insert({meta_id:id,user_id:pessoa}):sb.from("meta_membros").delete().eq("meta_id",id).eq("user_id",pessoa);
  const {error}=await q;
  if(error){toast("Não consegui atualizar o compartilhamento: "+error.message);desenharGaveta();return}
  m.meta_membros=ligar?[...(m.meta_membros||[]),{user_id:pessoa}]:(m.meta_membros||[]).filter(x=>x.user_id!==pessoa);
  render();toast(ligar?"Compartilhada com "+primeiroNome(pessoa)+".":"Deixou de compartilhar com "+primeiroNome(pessoa)+".");
}

/* ---------- ações nos cartões ---------- */
function adicionarValor(id,inp){
  const m=metas.find(x=>x.id===id);inp=inp||$("q-"+id);
  const v=lerNumero(inp.value);
  if(!v){inp.focus();return}
  const rid=uid(),d=hoje();
  gravar(id,{t:"soma",rid,v,d});
  toast((v>0?"+":"")+comUnidade(v,m.unidade)+" em "+m.nome);
}
function marcarEtapa(id,eid,feita){gravar(id,{t:"etapa",eid,feita:!!feita,d:hoje()})}
function marcarDia(id,dia,on){gravar(id,{t:"dia",dia,on:!!on})}
function marcoConcluir(id){const m=metas.find(x=>x.id===id);salvar(id,{status:m.status==="Concluída"?"Em andamento":"Concluída"})}
