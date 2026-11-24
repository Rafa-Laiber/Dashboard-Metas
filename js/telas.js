// Desenho da tela: ordem, gráfico, cartões, ano, resumo da semana e gaveta de edição.
/* ---------- ordem ---------- */
const PR=m=>PRIOS.indexOf(m.prioridade)<0?9:PRIOS.indexOf(m.prioridade);
const chaveOrdem=m=>{const o=prefs.ordem&&prefs.ordem[m.id];return typeof o==="number"?o:1e6+(Number(m.ordem)||0)};
function ordenar(l,modo){
  return l.slice().sort((a,b)=>{
    if(modo==="prazo")return (a.prazo||"9999").localeCompare(b.prazo||"9999");
    if(modo==="progresso")return progresso(b)-progresso(a);
    if(modo==="nome")return (a.nome||"").localeCompare(b.nome||"","pt-BR");
    if(modo==="prioridade")return PR(a)-PR(b)||chaveOrdem(a)-chaveOrdem(b);
    return chaveOrdem(a)-chaveOrdem(b);
  });
}
function visiveis(){
  let l=doAno().slice();
  if(filtroArea)l=l.filter(m=>m.area===filtroArea);
  if($("ocultar").checked)l=l.filter(m=>m.status!=="Concluída");
  return ordenar(l,$("ordem").value);
}
function salvarOrdemArrastada(){
  const vis=[...$("grid").querySelectorAll(".card")].map(c=>c.dataset.id);
  const todos=ordenar(metas,"ordem").map(m=>m.id);
  const pos=todos.map((id,i)=>vis.includes(id)?i:-1).filter(i=>i>=0);
  pos.forEach((p,i)=>{todos[p]=vis[i]});
  const ordem={};todos.forEach((id,i)=>ordem[id]=i);
  prefs.ordem=ordem;render();salvarPrefs({ordem});
}

/* ---------- gráfico ---------- */
function grafico(barras,{fmt=num,meta=null,cor="var(--accent)"}={}){
  const W=420,H=170,L=8,R=8,T=18,B=22,n=barras.length||1;
  const max=Math.max(meta||0,...barras.map(b=>b.v),1);
  const cw=(W-L-R)/n,bw=Math.min(34,cw*.62);
  const y=v=>T+(H-T-B)*(1-v/max);
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico">`;
  [0.5,1].forEach(f=>{s+=`<line x1="${L}" x2="${W-R}" y1="${y(max*f)}" y2="${y(max*f)}" stroke="var(--line)" stroke-dasharray="2 4"/>`});
  s+=`<line x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}" stroke="var(--line)"/>`;
  barras.forEach((b,i)=>{
    const x=L+cw*i+(cw-bw)/2,yy=y(Math.max(0,b.v)),h=H-B-yy;
    const ult=i===barras.length-1;
    s+=`<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0,h).toFixed(1)}" rx="3" fill="${cor}" opacity="${ult?1:.55}"/>`;
    if(b.v>0&&(n<=8||ult||b.v===Math.max(...barras.map(z=>z.v))))s+=`<text class="v" x="${(x+bw/2).toFixed(1)}" y="${(yy-4).toFixed(1)}" text-anchor="middle">${esc(fmt(b.v))}</text>`;
    s+=`<text x="${(x+bw/2).toFixed(1)}" y="${H-7}" text-anchor="middle">${esc(b.rot)}</text>`;
  });
  if(meta){const ym=y(meta);s+=`<line x1="${L}" x2="${W-R}" y1="${ym}" y2="${ym}" stroke="var(--warn)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${W-R}" y="${ym-4}" text-anchor="end" style="fill:var(--warn)">meta ${esc(fmt(meta))}</text>`}
  return s+"</svg>";
}
function evolucaoNumerica(m){
  const regs=m.registros||[];if(!regs.length)return `<p class="hint">O gráfico aparece quando você registrar o primeiro avanço.</p>`;
  const somas={};regs.forEach(r=>{const k=(r.data||"").slice(0,7);somas[k]=(somas[k]||0)+Number(r.valor||0)});
  const h=new Date();const meses=[];const primeiro=Object.keys(somas).sort()[0];
  for(let i=11;i>=0;i--){const d=new Date(h.getFullYear(),h.getMonth()-i,1);const k=d.getFullYear()+"-"+pad(d.getMonth()+1);if(k>=primeiro||i<6)meses.push({k,rot:MESES[d.getMonth()]})}
  const barras=meses.map(x=>({rot:x.rot,v:arred(somas[x.k]||0)}));
  const ult3=barras.slice(-3),media=ult3.reduce((s,b)=>s+b.v,0)/ult3.length;
  const melhor=Math.max(...barras.map(b=>b.v));
  const falta=Math.max(0,(Number(m.alvo)||0)-(Number(m.atual)||0));
  let prev="—";
  if(falta===0)prev="alvo atingido";else if(media>0){const meses=Math.ceil(falta/media);const d=new Date(h.getFullYear(),h.getMonth()+meses,1);prev=MESES[d.getMonth()]+"/"+d.getFullYear()}
  const f=v=>comUnidade(v,m.unidade);
  return grafico(barras,{fmt:v=>m.unidade==="R$"?num(Math.round(v)):num(v)})+
   `<div class="stats"><div><b>${esc(f(arred(media)))}</b><span>média dos últimos 3 meses</span></div><div><b>${esc(f(melhor))}</b><span>melhor mês</span></div><div><b>${esc(prev)}</b><span>no ritmo atual, chega ao alvo em</span></div></div>`;
}
function evolucaoHabito(m){
  const c=contagemSemanas(m),v=Math.max(1,Number(m.vezes)||1);const seg=segunda(new Date());const barras=[];
  for(let i=11;i>=0;i--){const d=new Date(seg);d.setDate(d.getDate()-7*i);barras.push({rot:pad(d.getDate())+"/"+pad(d.getMonth()+1),v:c[iso(d)]||0})}
  return grafico(barras,{meta:v,cor:"var(--good)"})+
   `<div class="stats"><div><b>${semanasCumpridas(m)}</b><span>semanas cumpridas</span></div><div><b>${sequencia(m)}</b><span>semanas seguidas</span></div><div><b>${(m.dias||[]).length}</b><span>dias registrados</span></div></div>`;
}

/* ---------- desenho ---------- */
function render(){
  document.title="Metas";
  desenharAno();
  const lista=doAno();
  const tot=lista.length;
  const geral=tot?lista.reduce((s,m)=>s+progresso(m),0)/tot:0;
  $("pctGeral").textContent=pctTxt(geral);
  $("ringArc").setAttribute("stroke-dashoffset",(326.7*(1-geral)).toFixed(1));
  $("miniArc").setAttribute("stroke-dashoffset",(100.5*(1-geral)).toFixed(1));$("miniPct").textContent=Math.round(geral*100)+"%";
  document.body.classList.toggle("ver-hoje",isMob()&&aba==="hoje");
  document.querySelectorAll("#tabbar [data-tab]").forEach(b=>b.classList.toggle("on",b.dataset.tab===aba));
  $("tTotal").textContent=tot;
  $("tDone").textContent=lista.filter(m=>m.status==="Concluída").length;
  $("tRun").textContent=lista.filter(m=>m.status==="Em andamento").length;
  const A=ano(),AA=anoAtual();
  if(todosAnos()){$("tDays").textContent=anosComMetas().length;$("tDaysLbl").textContent="anos com metas"}
  else if(A<AA){$("tDays").textContent="Fim";$("tDaysLbl").textContent="ano encerrado"}
  else if(A>AA){$("tDays").textContent=Math.max(0,diasAte(A+"-01-01"));$("tDaysLbl").textContent="dias até começar "+A}
  else{$("tDays").textContent=Math.max(0,diasAte(A+"-12-31"));$("tDaysLbl").textContent="dias até 31/12/"+A}
  if(loaded)$("sub").textContent=erroCarga?"":tot?"Toque numa etapa, num dia ou adicione um valor: o progresso se atualiza na hora.":"Comece criando sua primeira meta.";

  // lembretes de prazo
  const prox=metas.filter(m=>m.prazo&&m.status!=="Concluída"&&m.status!=="Pausada").map(m=>({m,d:diasAte(m.prazo)})).filter(x=>x.d<=30).sort((a,b)=>a.d-b.d);
  const lb=$("lembretes");
  if(prox.length){
    lb.hidden=false;
    const itens=`<ul>${prox.slice(0,6).map(({m,d})=>`<li><button type="button" data-act="editar" data-id="${m.id}"><span class="quando ${d<0?"late":"soon"}">${quandoTxt(d)}</span><b>${esc(m.nome)}</b><span class="hint">${pctTxt(progresso(m))}</span></button></li>`).join("")}</ul>${prox.length>6?`<p class="hint">e mais ${prox.length-6}.</p>`:""}`;
    const atras=prox.filter(x=>x.d<0).length;
    const aberto=lb.querySelector("details")?lb.querySelector("details").open:false;
    lb.innerHTML=isMob()?`<details ${aberto?"open":""}><summary><span>${prox.length} prazo${prox.length>1?"s":""} próximo${prox.length>1?"s":""}${atras?` · <span class="late" style="color:var(--bad)">${atras} atrasada${atras>1?"s":""}</span>`:""}</span></summary>${itens}</details>`:`<h2>Prazos próximos</h2>${itens}`;
  }else lb.hidden=true;

  // áreas
  const areas=todasAreas();
  if(filtroArea&&!areas.some(a=>a.k===filtroArea))filtroArea=null;
  $("areas").innerHTML=[{k:null,c:0}].concat(areas).map(a=>{
    const l=a.k?lista.filter(m=>m.area===a.k):lista;
    const p=l.length?l.reduce((s,m)=>s+progresso(m),0)/l.length:0;
    const cor=a.k?"var(--c"+a.c+")":"var(--accent)";
    return `<button type="button" class="area ${filtroArea===a.k?"on":""}" style="--ac:${cor}" data-act="area" data-area="${esc(a.k||"")}">
      <div class="row"><b>${a.k?esc(a.k):"Todas as áreas"}</b><span>${l.length} · ${pctTxt(p)}</span></div>
      <div class="bar"><i style="width:${(p*100).toFixed(1)}%"></i></div></button>`;
  }).join("");
  $("filtroInfo").textContent=filtroArea?"Mostrando: "+filtroArea:"";

  // cartões
  if(!loaded){$("grid").innerHTML=`<div class="empty">Carregando…</div>`;return}
  if(erroCarga){$("grid").innerHTML=`<div class="empty">Suas metas não puderam ser carregadas agora. Veja o aviso acima e tente recarregar a página.</div>`;return}
  if(!metas.length){$("grid").innerHTML=`<div class="empty">Você ainda não tem metas.<br><br><div class="topbtns" style="justify-content:center"><button class="btn primary" type="button" id="btnSeed">Começar com metas de exemplo</button><button class="btn" type="button" id="btnZero">Começar do zero</button></div><p class="hint" style="margin-top:12px">Os exemplos podem ser editados ou apagados depois.</p></div>`;return}
  if(!lista.length){$("grid").innerHTML=anoVazio();return}
  const l=visiveis();
  if(!l.length){$("grid").innerHTML=`<div class="empty">Nenhuma meta neste filtro.</div>`;return}
  const semDatadas=!todosAnos()&&!lista.some(m=>m.prazo);
  $("grid").innerHTML=(semDatadas?anoVazio(true):"")+(isMob()&&$("ordem").value==="ordem"&&l.length>1&&!dicaOrdemVista()?`<p class="ordem-hint">Segure um cartão para mudar a ordem.</p>`:"")+l.map(cartao).join("");
  if(sortable)sortable.option("disabled",$("ordem").value!=="ordem");
  if(isMob()&&aba==="hoje")renderHoje();
}
function dicaOrdemVista(){try{return !!localStorage.getItem("metas_dica_ordem")}catch(e){return false}}
const quandoTxt=d=>d<0?"Atrasada "+(-d)+" dia"+(-d===1?"":"s"):d===0?"Vence hoje":"Vence em "+d+" dia"+(d===1?"":"s");
const proximaEtapa=m=>(m.etapas||[]).find(e=>!e.feita);
function semanaDots(m){const seg=segunda(new Date()),hj=hoje(),set=new Set(m.dias||[]);let f=0;
  const d=diasSem().map((nm,i)=>{const x=new Date(seg);x.setDate(x.getDate()+i);const k=iso(x);const on=set.has(k);if(on)f++;return `<i class="${on?"on":""} ${k===hj?"hj":""}"></i>`}).join("");
  return {html:`<span class="dots" aria-hidden="true">${d}</span>`,feitos:f}}
function acaoRapida(m,ctx){
  const st=m.status||"Não iniciada";
  if(m.tipo==="Numérica")return `<div class="cm-line"><span class="txt"><b>${esc(comUnidade(m.atual,m.unidade))}</b>de ${esc(comUnidade(m.alvo,m.unidade))}</span></div>
    <form class="quick" data-form="add" data-id="${m.id}"><input type="text" inputmode="decimal" placeholder="Quanto avançou? ex.: 100" aria-label="Valor para adicionar em ${esc(m.nome)}"><button class="btn primary" type="submit">Adicionar</button></form>`;
  if(m.tipo==="Hábito semanal"){const w=semanaDots(m),v=Math.max(1,Number(m.vezes)||1),on=(m.dias||[]).includes(hoje());
    return `<div class="cm-line"><span class="txt">${w.html}<span style="display:block;margin-top:6px">Esta semana: <b style="display:inline">${w.feitos} de ${v}</b>${w.feitos>=v?" · cumprida":""}</span></span><button type="button" class="ok-btn ${on?"on":""}" data-act="dia" data-id="${m.id}" data-d="${hoje()}" aria-pressed="${on}" aria-label="${on?"Desmarcar hoje":"Marcar hoje"} em ${esc(m.nome)}">✓ <small>Hoje</small></button></div>`}
  const p=proximaEtapa(m);
  if(p)return `<div class="cm-line"><span class="txt">Próxima etapa<b>${esc(p.texto)}</b></span><button type="button" class="ok-btn" data-act="etapaFeita" data-id="${m.id}" data-eid="${esc(p.id)}" aria-label="Marcar “${esc(p.texto)}” como feita">✓</button></div>`;
  if(m.tipo==="Marco único"&&st!=="Concluída")return `<div class="cm-line"><span class="txt">${(m.etapas||[]).length?"Todas as etapas feitas":"Ainda não aconteceu"}</span><button type="button" class="ok-btn" data-act="marco" data-id="${m.id}"><small>Concluir</small></button></div>`;
  if((m.etapas||[]).length)return `<div class="cm-line"><span class="txt">Todas as ${(m.etapas||[]).length} etapas feitas</span></div>`;
  return ctx==="hoje"?"":`<div class="cm-line"><span class="txt">Sem etapas. Toque para editar.</span></div>`;
}
function cartaoMobile(m){
  const p=progresso(m),c=corArea(m.area),d=diasAte(m.prazo),st=m.status||"Não iniciada";
  let meta=[];
  if(m.prazo&&st!=="Concluída"&&d<=30)meta.push(`<span class="${d<0?"late":"soon"}">${quandoTxt(d)}</span>`);
  if(!souDono(m))meta.push("De "+esc(primeiroNome(m.user_id)));else{const mb=membrosDe(m);if(mb.length)meta.push("Com "+esc(mb.map(primeiroNome).join(", ")))}
  if(m.prioridade==="Alta")meta.push("Prioridade alta");
  return `<article class="card cm ${st==="Concluída"?"done":""}" style="--ac:${c}" data-id="${m.id}">
    <div class="cm-top"><span class="area-name">${esc(m.area)}</span><span class="cm-st ${STATUS_CLS[st]||"s-idle"}">${esc(st)}</span></div>
    <h3>${esc(m.nome)}</h3>
    <div class="prog"><div class="bar"><i style="width:${(p*100).toFixed(1)}%"></i></div><b>${pctTxt(p)}</b></div>
    ${acaoRapida(m,"card")}
    ${meta.length?`<div class="cm-meta">${meta.join("<span>·</span>")}</div>`:""}
  </article>`;
}
function renderHoje(){
  const ativas=metas.filter(m=>m.status!=="Concluída"&&m.status!=="Pausada"&&(!m.prazo||anoDe(m)>=anoAtual()));
  const hab=ativas.filter(m=>m.tipo==="Hábito semanal");
  const eta=ativas.filter(m=>(m.tipo==="Etapas"||m.tipo==="Marco único")&&proximaEtapa(m));
  const num_=ativas.filter(m=>m.tipo==="Numérica");
  const prox=ativas.filter(m=>m.prazo&&diasAte(m.prazo)<=30).sort((a,b)=>diasAte(a.prazo)-diasAte(b.prazo));
  const item=(m,corpo)=>`<div class="hj-item" style="--ac:${corArea(m.area)}"><div><span class="nome">${esc(m.nome)}</span> <span class="sub">· ${pctTxt(progresso(m))}</span></div>${corpo}</div>`;
  let dataHoje=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});dataHoje=dataHoje.charAt(0).toUpperCase()+dataHoje.slice(1);
  let h=`<h2>Hoje</h2><p class="data">${esc(dataHoje)}</p><button type="button" class="hj-resumo" data-act="abrirResumo"><span class="t"><b>Sua semana</b><span>${esc(resumoCurto())}</span></span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>`;
  if(prox.length)h+=`<section><h3>Prazos</h3>${prox.map(m=>`<button type="button" class="hj-item" style="--ac:${corArea(m.area)};text-align:left" data-act="editar" data-id="${m.id}"><span class="nome">${esc(m.nome)}</span><span class="sub ${diasAte(m.prazo)<0?"late":""}" style="${diasAte(m.prazo)<0?"color:var(--bad)":""}">${quandoTxt(diasAte(m.prazo))} · ${pctTxt(progresso(m))}</span></button>`).join("")}</section>`;
  if(hab.length)h+=`<section><h3>Hábitos da semana</h3>${hab.map(m=>item(m,acaoRapida(m,"hoje"))).join("")}</section>`;
  if(eta.length)h+=`<section><h3>Próximas etapas</h3>${eta.map(m=>item(m,acaoRapida(m,"hoje"))).join("")}</section>`;
  if(num_.length)h+=`<section><h3>Registrar avanço</h3>${num_.map(m=>item(m,acaoRapida(m,"hoje"))).join("")}</section>`;
  if(!prox.length&&!hab.length&&!eta.length&&!num_.length)h+=`<div class="hj-vazio">Nada pendente por hoje. Bom trabalho!</div>`;
  $("hoje").innerHTML=h;
}
function cartao(m){
  if(isMob())return cartaoMobile(m);
  const p=progresso(m),c=corArea(m.area),d=diasAte(m.prazo);
  const st=m.status||"Não iniciada";const modoOrdem=$("ordem").value==="ordem";
  let prazo="";
  if(m.prazo){prazo=st==="Concluída"?"Prazo "+dataBR(m.prazo):d<0?`<span class="late">Atrasada ${-d} dia${-d===1?"":"s"}</span>`:`Prazo ${dataBR(m.prazo)} · faltam ${d} dias`}
  let share="";
  if(!souDono(m))share=`<span class="pill sh">De ${esc(primeiroNome(m.user_id))}</span>`;
  else{const mb=membrosDe(m);if(mb.length)share=`<span class="pill sh">Com ${esc(mb.map(primeiroNome).join(", "))}</span>`}
  let corpo="";
  if(m.tipo==="Numérica"){
    const regs=m.registros||[];const ult=regs[regs.length-1];
    const falta=Math.max(0,(Number(m.alvo)||0)-(Number(m.atual)||0));
    corpo=`<div class="big">${esc(comUnidade(m.atual,m.unidade))} <small>de ${esc(comUnidade(m.alvo,m.unidade))}</small></div>
      <form class="quick" data-form="add" data-id="${m.id}">
        <input id="q-${m.id}" type="text" inputmode="decimal" placeholder="Quanto você avançou? ex.: 100" aria-label="Valor para adicionar em ${esc(m.nome)}">
        <button class="btn small primary" type="submit">Adicionar</button>
      </form>
      <div class="meta-line"><span>${ult?"Último: "+(ult.valor>0?"+":"")+esc(comUnidade(ult.valor,m.unidade))+" em "+dataBR(ult.data):"Nenhum avanço registrado ainda"}</span><span>${falta>0?"Faltam "+esc(comUnidade(falta,m.unidade)):"Alvo atingido"}</span></div>`;
  }else if(m.tipo==="Hábito semanal"){
    const seg=segunda(new Date()),hj=hoje(),set=new Set(m.dias||[]),v=Math.max(1,Number(m.vezes)||1);
    let feitos=0;const bt=diasSem().map((nm,i)=>{const dd=new Date(seg);dd.setDate(dd.getDate()+i);const k=iso(dd);const on=set.has(k);if(on)feitos++;
      return `<button type="button" class="dia ${on?"on":""} ${k===hj?"hoje":""}" data-act="dia" data-id="${m.id}" data-d="${k}" aria-pressed="${on}" aria-label="${nm} ${dataBR(k)}" ${k>hj?"disabled":""}>${nm}<b>${dd.getDate()}</b></button>`}).join("");
    corpo=`<div class="semana">${bt}</div>
      <div class="meta-line"><span>Esta semana: <b>${feitos} de ${v}</b>${feitos>=v?" · cumprida":""}</span><span>Sequência: ${sequencia(m)} sem.</span></div>
      <div class="meta-line"><span>${semanasCumpridas(m)} de ${num(m.alvo)} semanas cumpridas</span></div>`;
  }else{
    const et=m.etapas||[];
    corpo=et.length?`<ul class="steps">${et.map(e=>`<li><label><input type="checkbox" data-act="etapa" data-id="${m.id}" data-eid="${esc(e.id)}" ${e.feita?"checked":""}><span class="${e.feita?"ok":""}">${esc(e.texto)}</span></label></li>`).join("")}</ul>
      <div class="meta-line"><span>${et.filter(e=>e.feita).length} de ${et.length} etapas</span></div>`
      :`<p class="hint">${m.tipo==="Marco único"?"Sem etapas: marque como concluída quando acontecer.":"Nenhuma etapa ainda. Use Editar para adicionar."}</p>`;
    if(m.tipo==="Marco único")corpo+=`<button class="btn small" type="button" data-act="marco" data-id="${m.id}">${st==="Concluída"?"Reabrir meta":"Marcar como concluída"}</button>`;
  }
  return `<article class="card ${st==="Concluída"?"done":""}" style="--ac:${c}" data-id="${m.id}">
    <div class="head"><div><div class="area-name">${esc(m.area)}</div><h3>${esc(m.nome)}</h3></div>${modoOrdem?`<button class="drag" type="button" title="Arraste para mudar a ordem" aria-label="Arrastar ${esc(m.nome)}">⋮⋮</button>`:""}</div>
    <div class="pills"><span class="pill ${STATUS_CLS[st]||"s-idle"}">${esc(st)}</span><span class="pill ${PRIO_CLS[m.prioridade]||"p-baixa"}">Prioridade ${esc((m.prioridade||"").toLowerCase())}</span>${share}</div>
    <div class="prog"><div class="bar"><i style="width:${(p*100).toFixed(1)}%"></i></div><b>${pctTxt(p)}</b></div>
    ${corpo}
    <div class="meta-line"><span>${prazo}</span></div>
    <div class="foot"><button class="btn small" type="button" data-act="editar" data-id="${m.id}">Editar</button></div>
  </article>`;
}

/* ---------- ano: setas, menu e "trazer metas" ---------- */
function desenharAno(){
  const t=todosAnos();
  $("anoBtn").textContent=t?"Todos":ano();
  $("anoBtn").setAttribute("aria-label",t?"Todos os anos. Toque para escolher outro ano":"Ano "+ano()+". Toque para escolher outro ano");
}
async function irParaAno(v){
  fecharMenuAno();
  prefs.ano=v;filtroArea=null;render();window.scrollTo({top:0,behavior:"smooth"});
  salvarPrefs({ano:v});
}
function anosDoMenu(){const s=new Set([...anosComMetas(),anoAtual(),anoAtual()+1]);if(!todosAnos())s.add(ano());return [...s].sort((a,b)=>a-b)}
function abrirMenuAno(){
  const menu=$("anoMenu");
  const itens=anosDoMenu().map(y=>{const l=metas.filter(m=>anoDe(m)===y);const p=l.length?l.reduce((s,m)=>s+progresso(m),0)/l.length:0;
    return `<button type="button" role="menuitemradio" aria-checked="${!todosAnos()&&y===ano()}" data-anoir="${y}"><b>${y}</b><span>${l.length?l.length+" meta"+(l.length>1?"s":"")+" · "+pctTxt(p):"sem metas"}</span></button>`}).join("");
  menu.innerHTML=itens+`<button type="button" role="menuitemradio" aria-checked="${todosAnos()}" data-anoir="todos"><b>Todos os anos</b><span>${metas.length} metas</span></button><hr><button type="button" data-trazer="1"><b>Trazer metas de outro ano</b><span>Copiar ou levar as não concluídas</span></button>`;
  menu.hidden=false;$("anoBtn").setAttribute("aria-expanded","true");
}
function fecharMenuAno(){$("anoMenu").hidden=true;$("anoBtn").setAttribute("aria-expanded","false")}
function anoVazio(faixa){
  if(todosAnos())return `<div class="empty">Nenhuma meta.</div>`;
  const A=ano(),ant=A-1;
  const deAnt=metas.filter(m=>anoDe(m)===ant),pend=deAnt.filter(m=>m.status!=="Concluída");
  if(faixa&&!deAnt.length)return "";
  return `<div class="empty" ${faixa?'style="grid-column:1/-1"':""}>Nenhuma meta com prazo em ${A} ainda.<br><br><div class="topbtns" style="justify-content:center">
    ${deAnt.length?`<button class="btn primary" type="button" data-trazer="copiar" data-de="${ant}">Copiar metas de ${ant}</button>`:""}
    ${pend.length?`<button class="btn" type="button" data-trazer="levar" data-de="${ant}">Levar não concluídas de ${ant} (${pend.length})</button>`:""}
    <button class="btn" type="button" id="btnZero">Criar meta</button></div>
    ${!deAnt.length&&metas.length?`<p class="hint" style="margin-top:12px">Para trazer metas de outro ano, toque no ano lá em cima.</p>`:""}</div>`;
}
let trazer={modo:"copiar",de:null,sel:new Set()};
function alvoTrazer(){return todosAnos()?anoAtual():ano()}
function abrirTrazer(modo,de){
  fecharMenuAno();fechar();fecharPerfil();
  const alvo=alvoTrazer();
  const outros=anosComMetas().filter(y=>y!==alvo);
  trazer={modo:modo||"copiar",de:de?+de:(outros.includes(alvo-1)?alvo-1:(outros.filter(y=>y<alvo).pop()||outros[0]||alvo-1)),sel:new Set()};
  desenharTrazer();$("trazer").classList.add("open");$("scrim").classList.add("open");
}
function fecharTrazer(){$("trazer").classList.remove("open");if(!editId&&!$("perfil").classList.contains("open"))$("scrim").classList.remove("open")}
function listaTrazer(){const l=metas.filter(m=>anoDe(m)===trazer.de);return trazer.modo==="levar"?l.filter(m=>m.status!=="Concluída"):l}
function desenharTrazer(){
  const alvo=alvoTrazer(),outros=anosComMetas().filter(y=>y!==alvo);
  if(!outros.includes(trazer.de)&&outros.length)trazer.de=outros.includes(alvo-1)?alvo-1:outros[outros.length-1];
  const l=listaTrazer();trazer.sel=new Set([...trazer.sel].filter(id=>l.some(m=>m.id===id)));
  $("tzTitle").textContent="Trazer metas para "+alvo;
  const n=trazer.sel.size;
  $("tzBody").innerHTML=`
    <nav class="seg" aria-label="O que fazer"><button type="button" data-tzmodo="copiar" class="${trazer.modo==="copiar"?"on":""}">Copiar</button><button type="button" data-tzmodo="levar" class="${trazer.modo==="levar"?"on":""}">Levar não concluídas</button></nav>
    <p class="hint">${trazer.modo==="copiar"?`Cria cópias novas em ${alvo}, <b>zeradas</b>: etapas desmarcadas, sem valores nem dias registrados. As metas de origem ficam como estão.`:`Move as metas escolhidas para ${alvo}, <b>mantendo o progresso</b>. Só o prazo muda para ${alvo}.`}</p>
    ${outros.length?`<label class="field" for="tzDe"><span>Do ano</span><select id="tzDe">${outros.map(y=>`<option value="${y}" ${y===trazer.de?"selected":""}>${y}</option>`).join("")}</select></label>`:`<p class="hint">Ainda não há metas em outros anos.</p>`}
    ${l.length?`<label class="tz-todas"><input type="checkbox" id="tzTodas" ${n===l.length?"checked":""}> Selecionar todas (${l.length})</label>
    <ul class="share tz-lista">${l.map(m=>`<li><label for="tz-${m.id}" style="--ac:${corArea(m.area)}"><input type="checkbox" id="tz-${m.id}" data-tz="${m.id}" ${trazer.sel.has(m.id)?"checked":""}><span><b>${esc(m.nome)}</b><br><small class="hint">${esc(m.area)} · ${esc(m.status)} · ${pctTxt(progresso(m))}${m.prazo?" · prazo "+dataBR(m.prazo):""}</small></span></label></li>`).join("")}</ul>`
      :outros.length?`<p class="hint">${trazer.modo==="levar"?"Todas as metas de "+trazer.de+" já foram concluídas.":"Nenhuma meta em "+trazer.de+"."}</p>`:""}`;
  const b=$("tzOk");b.disabled=!n;
  b.textContent=n?(trazer.modo==="copiar"?`Copiar ${n} meta${n>1?"s":""} para ${alvo}`:`Levar ${n} meta${n>1?"s":""} para ${alvo}`):"Escolha as metas";
}
async function confirmarTrazer(){
  const alvo=alvoTrazer(),ids=[...trazer.sel];if(!ids.length)return;
  const escolhidas=metas.filter(m=>ids.includes(m.id));
  $("tzOk").disabled=true;
  if(trazer.modo==="copiar"){
    const linhas=escolhidas.map((m,i)=>limpar({...m,prazo:novoPrazo(m.prazo,alvo),status:"Não iniciada",concluida_em:null,atual:0,registros:[],dias:[],
      etapas:(m.etapas||[]).map(e=>({id:uid(),texto:e.texto,feita:false})),ordem:Date.now()%1e9+i}));
    const {data,error}=await sb.from("metas").insert(linhas).select(SEL());
    if(error){toast("Não consegui copiar: "+error.message);$("tzOk").disabled=false;return}
    data.forEach(d=>metas.push(norm(d)));
    toast(`${escolhidas.length} meta${escolhidas.length>1?"s":""} copiada${escolhidas.length>1?"s":""} para ${alvo}.`);
  }else{
    escolhidas.forEach(m=>salvar(m.id,{prazo:novoPrazo(m.prazo,alvo)}));
    toast(`${escolhidas.length} meta${escolhidas.length>1?"s":""} levada${escolhidas.length>1?"s":""} para ${alvo}.`);
  }
  fecharTrazer();if(todosAnos())prefs.ano=alvo;render();salvarPrefs({ano:alvo});
}

/* ---------- resumo da semana ---------- */
let semOff=0;
const fmtDia=d=>d.toLocaleDateString("pt-BR",{day:"numeric",month:"short"}).replace(".","");
function dadosSemana(off){
  const ini=segunda(new Date());ini.setDate(ini.getDate()+7*off);const fim=new Date(ini);fim.setDate(fim.getDate()+6);
  const a=iso(ini),z=iso(fim),dentro=d=>!!d&&d>=a&&d<=z;
  const avancos=metas.filter(m=>m.tipo==="Numérica").map(m=>{const r=(m.registros||[]).filter(x=>dentro(x.data));return{m,soma:arred(r.reduce((s,x)=>s+Number(x.valor||0),0)),n:r.length}}).filter(x=>x.n);
  const etapas=[];metas.forEach(m=>(m.etapas||[]).forEach(e=>{if(e.feita&&dentro(e.feitaEm))etapas.push({m,e})}));
  const concl=metas.filter(m=>m.status==="Concluída"&&dentro(m.concluida_em));
  const habitos=metas.filter(m=>m.tipo==="Hábito semanal"&&(m.status!=="Concluída"||dentro(m.concluida_em))).map(m=>{const v=Math.max(1,Number(m.vezes)||1);const f=(m.dias||[]).filter(dentro).length;return{m,f,v,ok:f>=v}});
  const p0=new Date(fim);p0.setDate(p0.getDate()+1);const p1=new Date(p0);p1.setDate(p1.getDate()+6);
  const prox=metas.filter(m=>m.prazo&&m.status!=="Concluída"&&m.prazo>=iso(p0)&&m.prazo<=iso(p1));
  return{ini,fim,avancos,etapas,concl,habitos,prox,p0,p1};
}
function desenharSemana(){
  const d=dadosSemana(semOff);
  const rot=semOff===0?"Esta semana":semOff===-1?"Semana passada":`${fmtDia(d.ini)} – ${fmtDia(d.fim)}`;
  const hOk=d.habitos.filter(h=>h.ok).length;
  const item=(m,t,sub,v,ok)=>`<div class="s-item" style="--ac:${corArea(m.area)}"><span class="t">${esc(t)}${sub?`<small>${esc(sub)}</small>`:""}</span><span class="v ${ok?"ok":""}">${esc(v)}</span></div>`;
  let h=`<div class="s-nav"><button type="button" class="ano-seta" data-sem="-1" aria-label="Semana anterior">‹</button><div style="text-align:center"><b>${rot}</b><div class="hint">${fmtDia(d.ini)} a ${fmtDia(d.fim)}</div></div><button type="button" class="ano-seta" data-sem="1" aria-label="Próxima semana" ${semOff>=0?"disabled":""}>›</button></div>
  <div class="s-tiles"><div><b>${d.avancos.reduce((s,x)=>s+x.n,0)}</b><span>avanços registrados</span></div><div><b>${d.etapas.length}</b><span>etapas concluídas</span></div><div><b>${d.habitos.length?hOk+"/"+d.habitos.length:"–"}</b><span>hábitos cumpridos</span></div><div><b>${d.concl.length}</b><span>metas concluídas</span></div></div>`;
  h+=`<div class="s-sec"><h3>Avanços</h3>${d.avancos.length?d.avancos.map(x=>item(x.m,x.m.nome,x.n+" registro"+(x.n>1?"s":""),(x.soma>0?"+":"")+comUnidade(x.soma,x.m.unidade),true)).join(""):`<p class="s-vazio">Nenhum valor registrado nesta semana.</p>`}</div>`;
  h+=`<div class="s-sec"><h3>Hábitos</h3>${d.habitos.length?d.habitos.map(x=>item(x.m,x.m.nome,x.ok?"Semana cumprida":"Faltou "+(x.v-x.f)+" dia"+(x.v-x.f>1?"s":""),x.f+" de "+x.v,x.ok)).join(""):`<p class="s-vazio">Você não tem hábitos semanais.</p>`}</div>`;
  h+=`<div class="s-sec"><h3>Etapas concluídas</h3>${d.etapas.length?d.etapas.map(x=>item(x.m,x.e.texto,x.m.nome,"✓",true)).join(""):`<p class="s-vazio">Nenhuma etapa marcada como feita nesta semana.</p>`}</div>`;
  if(d.concl.length)h+=`<div class="s-sec"><h3>Metas concluídas</h3>${d.concl.map(m=>item(m,m.nome,m.area,"Concluída",true)).join("")}</div>`;
  if(semOff===0)h+=`<div class="s-sec"><h3>Prazos da próxima semana</h3>${d.prox.length?d.prox.map(m=>item(m,m.nome,"Prazo "+dataBR(m.prazo),pctTxt(progresso(m)),false)).join(""):`<p class="s-vazio">Nenhum prazo na próxima semana.</p>`}</div>`;
  $("sBody").innerHTML=h;
}
function resumoCurto(){const d=dadosSemana(0);const n=d.avancos.reduce((s,x)=>s+x.n,0),ok=d.habitos.filter(h=>h.ok).length;
  const p=[];p.push(n+" avanço"+(n===1?"":"s"));if(d.habitos.length)p.push(ok+" de "+d.habitos.length+" hábitos");p.push(d.etapas.length+" etapa"+(d.etapas.length===1?"":"s"));return p.join(" · ")}
function abrirSemana(){fechar();fecharPerfil();semOff=0;desenharSemana();$("semana").classList.add("open");$("scrim").classList.add("open");$("sBody").scrollTop=0}
function fecharSemana(){$("semana").classList.remove("open");if(!editId&&!$("perfil").classList.contains("open"))$("scrim").classList.remove("open")}
document.addEventListener("click",e=>{
  if(e.target.closest('[data-act="abrirResumo"]')){abrirSemana();return}
  const sm=e.target.closest("[data-sem]");if(sm&&!sm.disabled){semOff=Math.min(0,semOff+ +sm.dataset.sem);desenharSemana()}
});
