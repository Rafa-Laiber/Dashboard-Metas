// Cliques, toques e formulários da tela principal e da gaveta.
/* ---------- eventos ---------- */
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-act]");if(!t)return;
  const a=t.dataset.act;
  if(a==="area"){filtroArea=t.dataset.area||null;render()}
  else if(a==="editar")abrir(t.dataset.id);
  else if(a==="fechar")fechar();
  else if(a==="marco")marcoConcluir(t.dataset.id);
  else if(a==="etapaFeita"){marcarEtapa(t.dataset.id,t.dataset.eid,true);toast("Etapa concluída.")}
  else if(a==="dia")marcarDia(t.dataset.id,t.dataset.d,t.getAttribute("aria-pressed")!=="true");
  else if(a==="rmEtapa")gravar(editId,{t:"etapaRm",eid:t.dataset.eid})
  else if(a==="subir"){const m=metas.find(x=>x.id===editId),i=m?(m.etapas||[]).findIndex(x=>x.id===t.dataset.eid):-1;if(i>0)gravar(editId,{t:"etapaMover",eid:t.dataset.eid,para:i-1})}
  else if(a==="rmReg")gravar(editId,{t:"rmReg",rid:t.dataset.rid});
  else if(a==="histTudo"){histTudo=true;desenharGaveta()}
  else if(a==="excluir"){if(t.classList.contains("armed"))excluirMeta(editId);else{t.classList.add("armed");t.textContent="Toque de novo para excluir de vez";setTimeout(()=>{if(t.isConnected){t.classList.remove("armed");t.textContent="Excluir meta"}},4000)}}
  else if(a==="sairMeta"){if(t.classList.contains("armed"))sairDaMeta(editId);else{t.classList.add("armed");t.textContent="Toque de novo para sair da meta";setTimeout(()=>{if(t.isConnected){t.classList.remove("armed");t.textContent="Sair desta meta"}},4000)}}
});
document.addEventListener("click",e=>{
  const gt=e.target.closest("[data-gtab]");
  if(gt){abaGaveta=gt.dataset.gtab;$("dBody").dataset.tab=abaGaveta;$("dBody").querySelectorAll("[data-gtab]").forEach(b=>b.classList.toggle("on",b===gt));$("dBody").scrollTop=0;return}
  const tb=e.target.closest("#tabbar [data-tab]");
  if(tb){const t=tb.dataset.tab;
    if(t==="nova"){criarMeta();return}
    if(t==="perfil"){abrirPerfil();return}
    aba=t;fechar();fecharPerfil();render();window.scrollTo({top:0,behavior:"smooth"});return}
  const card=e.target.closest(".card.cm");
  if(card&&!arrastando&&!e.target.closest("button,input,select,textarea,form,label,a"))abrir(card.dataset.id);
});
document.addEventListener("click",e=>{
  const seta=e.target.closest("[data-anopasso]");
  if(seta){const base=todosAnos()?anoAtual():ano();irParaAno(base+ +seta.dataset.anopasso);return}
  if(e.target.closest("#anoBtn")){$("anoMenu").hidden?abrirMenuAno():fecharMenuAno();return}
  const ir=e.target.closest("[data-anoir]");
  if(ir){irParaAno(ir.dataset.anoir==="todos"?"todos":+ir.dataset.anoir);return}
  const tz=e.target.closest("[data-trazer]");
  if(tz){abrirTrazer(tz.dataset.trazer==="1"?"copiar":tz.dataset.trazer,tz.dataset.de);return}
  const md=e.target.closest("[data-tzmodo]");
  if(md){trazer.modo=md.dataset.tzmodo;trazer.sel=new Set();desenharTrazer();return}
  if(!$("anoMenu").hidden&&!e.target.closest("#anoMenu"))fecharMenuAno();
});
document.addEventListener("change",e=>{
  if(e.target.id==="tzDe"){trazer.de=+e.target.value;trazer.sel=new Set();desenharTrazer();return}
  if(e.target.id==="tzTodas"){const l=listaTrazer();trazer.sel=e.target.checked?new Set(l.map(m=>m.id)):new Set();desenharTrazer();return}
  if(e.target.dataset&&e.target.dataset.tz){e.target.checked?trazer.sel.add(e.target.dataset.tz):trazer.sel.delete(e.target.dataset.tz);desenharTrazer();return}
});
document.addEventListener("change",e=>{
  const t=e.target;
  if(t.dataset.act==="etapa"){marcarEtapa(t.dataset.id,t.dataset.eid,t.checked);return}
  if(t.dataset.share&&editId){alternarMembro(editId,t.dataset.share,t.checked);return}
  if(t.dataset.f&&editId){
    let v=t.value;const f=t.dataset.f;
    if(t.dataset.num){v=lerNumero(v);if(isNaN(v))v=0}
    if(f==="vezes")v=Math.min(7,Math.max(1,Math.round(v)||1));
    if(f==="nome"&&!v.trim())v="Sem nome";
    const patch={[f]:v};
    if(f==="tipo"&&v==="Hábito semanal"){const m=metas.find(x=>x.id===editId);if(!(m.alvo>0)||m.tipo==="Numérica")patch.alvo=50;if(!m.vezes)patch.vezes=3}
    salvar(editId,patch);
    if(f==="tipo"||f==="vezes")setTimeout(desenharGaveta,0);
    return;
  }
  if(t.dataset.etxt&&editId){gravar(editId,{t:"etapaTexto",eid:t.dataset.etxt,texto:t.value})}
  if(t.id==="ordem"){try{localStorage.setItem("metas_ordem",t.value)}catch(err){}render()}
  if(t.id==="ocultar")render();
});
document.addEventListener("submit",e=>{
  const f=e.target;if(!f.dataset.form)return;e.preventDefault();
  if(f.dataset.form==="add"){adicionarValor(f.dataset.id,f.querySelector("input"));f.querySelector("input").value=""}
  if(f.dataset.form==="novaEtapa"){const inp=$("f-novaEtapa");const txt=inp.value.trim();if(!txt)return;const nid=uid();
    gravar(editId,{t:"etapaAdd",eid:nid,texto:txt});setTimeout(()=>{desenharGaveta();const n=$("f-novaEtapa");if(n)n.focus()},30)}
});
$("btnNova").addEventListener("click",criarMeta);
$("pendBtn").addEventListener("click",()=>{tentativa=0;enviarPend()});
$("scrim").addEventListener("click",()=>{fechar();fecharPerfil();fecharTrazer();fecharSemana()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){fechar();fecharPerfil();fecharTrazer();fecharSemana();fecharMenuAno()}});
$("tzFechar").addEventListener("click",fecharTrazer);
$("sFechar").addEventListener("click",fecharSemana);
$("tzOk").addEventListener("click",confirmarTrazer);

let toastT;function toast(msg,ms){const el=$("toast");el.textContent=msg;el.style.display="block";clearTimeout(toastT);toastT=setTimeout(()=>el.style.display="none",ms||2800)}
function aviso(msg){const n=$("notice");n.textContent=msg;n.hidden=!msg}
