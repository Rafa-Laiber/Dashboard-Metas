// Gaveta de edição de uma meta (no celular, folha que sobe de baixo).
/* ---------- gaveta de edição ---------- */
let histTudo=false;
function abrir(id,tab){fecharPerfil();fecharSemana();if(editId!==id){abaGaveta=tab||"prog";histTudo=false}editId=id;desenharGaveta();$("dBody").scrollTop=0;$("drawer").classList.add("open");$("scrim").classList.add("open")}
function fechar(){editId=null;$("drawer").classList.remove("open");if(!$("perfil").classList.contains("open"))$("scrim").classList.remove("open")}
const opts=(lista,v)=>lista.map(x=>`<option ${x===v?"selected":""}>${esc(x)}</option>`).join("");
function desenharGaveta(){
  const m=metas.find(x=>x.id===editId);if(!m){fechar();return}
  $("dTitle").textContent=m.nome||"Editar meta";
  const tipo=m.tipo,dono=souDono(m);
  const areas=todasAreas().map(a=>a.k);if(m.area&&!areas.includes(m.area))areas.push(m.area);
  let compart="";
  {
    if(dono){
      const outros=Object.keys(perfis).filter(id=>id!==usuario.id);const mb=membrosDe(m);
      compart=`<div class="sec"><h3>Compartilhar</h3>${outros.length?`<p class="hint">Quem você marcar vê esta meta e pode atualizar o progresso. Só você pode excluí-la.</p><ul class="share">${outros.map(id=>`<li><label for="sh-${id}"><input type="checkbox" id="sh-${id}" data-share="${id}" ${mb.includes(id)?"checked":""}><span class="mini-av" style="${perfis[id].cor?`background:${corVar(perfis[id].cor)};color:var(--surface)`:""}">${esc(iniciaisDe(perfis[id].nome,perfis[id].email))}</span><span>${esc(nomePessoa(id))}<br><small class="hint">${esc(perfis[id].email)}</small></span></label></li>`).join("")}</ul>`:`<p class="hint">Quando houver outras pessoas cadastradas, elas aparecem aqui.</p>`}</div>`;
    }else compart=`<div class="sec"><h3>Compartilhada</h3><p class="hint">Esta meta é de ${esc(nomePessoa(m.user_id))}. Você pode atualizar o progresso e editar, mas só ${esc(primeiroNome(m.user_id))} pode excluí-la.</p></div>`;
  }
  const temHist=tipo==="Numérica"||tipo==="Hábito semanal";
  if(abaGaveta==="hist"&&!temHist)abaGaveta="prog";
  const T=(k,l)=>`<button type="button" class="${abaGaveta===k?"on":""}" data-gtab="${k}">${l}</button>`;
  const set=new Set(m.dias||[]);
  let progM="";
  if(tipo==="Numérica")progM=`<div class="big">${esc(comUnidade(m.atual,m.unidade))} <small>de ${esc(comUnidade(m.alvo,m.unidade))}</small></div>
      <form class="quick" data-form="add" data-id="${m.id}"><input type="text" inputmode="decimal" placeholder="Quanto avançou? ex.: 100" aria-label="Valor para adicionar"><button class="btn primary" type="submit">Adicionar</button></form>`;
  if(tipo==="Hábito semanal"){const seg=segunda(new Date()),hj=hoje();
    progM=`<div class="semana">${diasSem().map((nm,i)=>{const dd=new Date(seg);dd.setDate(dd.getDate()+i);const k=iso(dd);const on=set.has(k);return `<button type="button" class="dia ${on?"on":""} ${k===hj?"hoje":""}" style="--ac:${corArea(m.area)}" data-act="dia" data-id="${m.id}" data-d="${k}" aria-pressed="${on}" aria-label="${nm} ${dataBR(k)}" ${k>hj?"disabled":""}>${nm}<b>${dd.getDate()}</b></button>`}).join("")}</div>`}
  if(tipo==="Marco único")progM=`<button class="btn" type="button" data-act="marco" data-id="${m.id}">${m.status==="Concluída"?"Reabrir meta":"Marcar como concluída"}</button>`;
  $("dBody").dataset.tab=abaGaveta;
  $("dBody").innerHTML=`
    <div class="only-m"><nav class="sheet-tabs" aria-label="Seções">${T("prog","Progresso")}${T("det","Detalhes")}${temHist?T("hist","Histórico"):""}</nav></div>
    ${progM?`<div data-tab="prog" class="only-m"><div style="display:flex;flex-direction:column;gap:12px">${progM}</div></div>`:""}
    <div data-tab="det">
    <label class="field" for="f-nome"><span>Meta</span><input id="f-nome" type="text" value="${esc(m.nome)}" data-f="nome"></label>
    <div class="two">
      <label class="field" for="f-area"><span>Área</span><select id="f-area" data-f="area">${opts(areas,m.area)}</select></label>
      <label class="field" for="f-tipo"><span>Tipo</span><select id="f-tipo" data-f="tipo">${opts(TIPOS,tipo)}</select></label>
      <label class="field" for="f-status"><span>Status</span><select id="f-status" data-f="status">${opts(STATUS,m.status)}</select></label>
      <label class="field" for="f-prio"><span>Prioridade</span><select id="f-prio" data-f="prioridade">${opts(PRIOS,m.prioridade)}</select></label>
    </div>
    <label class="field" for="f-prazo"><span>Prazo</span><input id="f-prazo" type="date" value="${esc(m.prazo||"")}" data-f="prazo"></label>
    ${tipo==="Numérica"?`<div class="three">
      <label class="field" for="f-atual"><span>Valor atual</span><input id="f-atual" type="text" inputmode="decimal" value="${esc(m.atual??0)}" data-f="atual" data-num="1"></label>
      <label class="field" for="f-alvo"><span>Alvo</span><input id="f-alvo" type="text" inputmode="decimal" value="${esc(m.alvo??0)}" data-f="alvo" data-num="1"></label>
      <label class="field" for="f-un"><span>Unidade</span><input id="f-un" type="text" placeholder="R$, horas…" value="${esc(m.unidade||"")}" data-f="unidade"></label>
    </div><p class="hint">Para somar um depósito ou avanço, use o campo “Adicionar”${isMob()?" na aba Progresso":" no cartão"}: ele guarda o histórico e alimenta o gráfico.</p>`:""}
    ${tipo==="Hábito semanal"?`<div class="two">
      <label class="field" for="f-vezes"><span>Vezes por semana</span><input id="f-vezes" type="number" min="1" max="7" value="${esc(m.vezes||3)}" data-f="vezes" data-num="1"></label>
      <label class="field" for="f-alvo2"><span>Meta de semanas</span><input id="f-alvo2" type="number" min="1" max="104" value="${esc(m.alvo||50)}" data-f="alvo" data-num="1"></label>
    </div><p class="hint">Uma semana conta como cumprida quando você marca pelo menos ${esc(m.vezes||3)} dias nela.${isMob()?"":" Marque os dias direto no cartão."}</p>`:""}
    <label class="field" for="f-notas"><span>Notas</span><textarea id="f-notas" data-f="notas">${esc(m.notas||"")}</textarea></label>
    </div>
    ${tipo==="Numérica"?`<div class="sec" data-tab="prog"><h3>Evolução por mês</h3>${evolucaoNumerica(m)}</div>`:""}
    ${tipo==="Hábito semanal"?`<div class="sec" data-tab="prog"><h3>Últimas 12 semanas</h3>${evolucaoHabito(m)}</div>`:""}
    ${tipo==="Etapas"||tipo==="Marco único"?`<div class="sec" data-tab="prog"><h3>Etapas</h3>
      ${(m.etapas||[]).map((e,i)=>`<div class="ed-step">
        <input type="checkbox" id="fe-c-${e.id}" data-act="etapa" data-id="${m.id}" data-eid="${esc(e.id)}" ${e.feita?"checked":""} aria-label="Feita">
        <input type="text" id="fe-t-${e.id}" value="${esc(e.texto)}" data-etxt="${esc(e.id)}" aria-label="Etapa ${i+1}">
        <button class="icon" type="button" title="Subir" data-act="subir" data-eid="${esc(e.id)}" ${i===0?"disabled":""}>↑</button>
        <button class="icon" type="button" title="Remover etapa" data-act="rmEtapa" data-eid="${esc(e.id)}">×</button></div>`).join("")||`<p class="hint">Nenhuma etapa.</p>`}
      <form class="quick" data-form="novaEtapa"><input id="f-novaEtapa" type="text" placeholder="Nova etapa" aria-label="Nova etapa"><button class="btn small" type="submit">Adicionar etapa</button></form>
    </div>`:""}
    ${tipo==="Numérica"?`<div class="sec" data-tab="hist"><h3>Histórico de avanços</h3>
      ${(m.registros||[]).length?`<ul class="hist">${(m.registros||[]).slice().reverse().slice(0,histTudo?Infinity:100).map(r=>`<li><span>${dataBR(r.data)}</span><span class="v">${r.valor>0?"+":""}${esc(comUnidade(r.valor,m.unidade))}</span><button class="icon" type="button" title="Apagar este registro" data-act="rmReg" data-rid="${esc(r.id)}">×</button></li>`).join("")}</ul>${!histTudo&&m.registros.length>100?`<button class="btn" type="button" data-act="histTudo">Mostrar todos (${m.registros.length})</button>`:""}`:`<p class="hint">Nada registrado ainda.</p>`}
    </div>`:""}
    ${tipo==="Hábito semanal"?`<div class="only-m" data-tab="hist"><div class="sec"><h3>Dias registrados</h3>${(m.dias||[]).length?`<ul class="hist">${(m.dias||[]).slice().reverse().slice(0,60).map(d=>`<li><span>${esc(deIso(d).toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"}))}</span><button class="icon" type="button" title="Desmarcar este dia" data-act="dia" data-id="${m.id}" data-d="${esc(d)}" aria-pressed="true">×</button></li>`).join("")}</ul>`:`<p class="hint">Nenhum dia marcado ainda.</p>`}</div></div>`:""}
    ${compart?`<div data-tab="det">${compart}</div>`:""}
    <div class="sec" data-tab="det">${dono?`<button class="btn danger" type="button" data-act="excluir" id="btnExcluir">Excluir meta</button>`:`<button class="btn danger" type="button" data-act="sairMeta" id="btnSairMeta">Sair desta meta</button>`}</div>`;
}
