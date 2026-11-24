// Carregar dados, exemplos, backup, login e início do app.
/* ---------- carregar, exemplos e backup ---------- */
function exemplos(){const A=ano();return[
 {nome:"Montar uma reserva de emergência",area:"Finanças",tipo:"Numérica",prioridade:"Alta",alvo:10000,unidade:"R$",notas:"Exemplo. Ajuste o alvo para uns 6 meses dos seus gastos."},
 {nome:"Ler 12 livros",area:"Saúde e hábitos",tipo:"Numérica",prioridade:"Média",alvo:12,unidade:"livros",notas:"Exemplo."},
 {nome:"Treinar 3x por semana",area:"Saúde e hábitos",tipo:"Hábito semanal",prioridade:"Média",vezes:3,alvo:45,notas:"Exemplo. Marque no cartão os dias em que treinou."},
 {nome:"Fazer check-up médico anual",area:"Saúde e hábitos",tipo:"Marco único",prioridade:"Média",prazo:A+"-06-30",notas:"Exemplo."},
 {nome:"Aprender algo novo",area:"Carreira e estudos",tipo:"Etapas",prioridade:"Média",notas:"Exemplo. Troque pelo curso ou habilidade que quiser.",etapas:["Escolher o curso","Fazer a inscrição","Chegar na metade","Concluir"]},
 {nome:"Fazer uma viagem",area:"Pessoal e família",tipo:"Etapas",prioridade:"Baixa",notas:"Exemplo.",etapas:["Escolher o destino","Definir o orçamento","Comprar as passagens","Reservar a hospedagem"]}
]}
async function carregar(){
  // metas, pessoas e histórico de avanços chegam juntos
  const [r,p,av]=await Promise.all([sb.from("metas").select(SEL()),sb.from("perfis").select("id,email,nome,cor"),lerAvancos()]);
  const falhou=r.error||av.error;
  if(falhou){erroCarga=true;aviso("Não consegui carregar suas metas: "+falhou.message+". Se o projeto no Supabase estiver pausado, abra o painel do Supabase e clique em Resume project.");loaded=true;render();return}
  perfis={};if(!p.error)p.data.forEach(x=>perfis[x.id]=x);
  const porMeta={};av.data.forEach(({meta_id,...x})=>(porMeta[meta_id]=porMeta[meta_id]||[]).push(x));
  erroCarga=false;if(!pend.length)pend=lerPend();
  metas=r.data.map(d=>reaplicar(comRegs(d,porMeta[d.id]||[])));loaded=true;
  const ids=new Set(metas.map(m=>m.id));if(pend.some(x=>!ids.has(x.id))){pend=pend.filter(x=>ids.has(x.id));guardarPend()}
  enviarPend();
  if($("notice").textContent.startsWith("Não consegui carregar"))aviso("");
  render();convidarFace();
}
async function semear(){
  const A=ano();
  const linhas=exemplos().map((x,i)=>limpar({...novaMetaBase({area:x.area}),...x,prazo:x.prazo?novoPrazo(x.prazo,A):A+"-12-31",ordem:i+1,etapas:(x.etapas||[]).map(t=>({id:uid(),texto:t,feita:false})),registros:[],dias:[]}));
  const {error}=await sb.from("metas").insert(linhas);
  if(error){toast("Não consegui criar os exemplos: "+error.message);return}
  carregar();
}
function exportar(){
  const minhas=metas.filter(souDono).map(({id,user_id,created_at,updated_at,meta_membros,...r})=>r);
  const blob=new Blob([JSON.stringify({exportadoEm:new Date().toISOString(),preferencias:{ano:prefs.ano,areas:prefs.areas},metas:minhas},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="metas-backup-"+hoje()+".json";document.body.appendChild(a);a.click();a.remove();
}
async function importar(file){
  let j;try{j=JSON.parse(await file.text())}catch(e){toast("Esse arquivo não é um backup válido.");return}
  const lista=Array.isArray(j)?j:j.metas;if(!Array.isArray(lista)){toast("Esse arquivo não é um backup válido.");return}
  const minhas=metas.filter(souDono);
  if(minhas.length&&!window.confirm("Restaurar vai APAGAR as suas "+minhas.length+" metas atuais e colocar as "+lista.length+" do backup. Metas que outras pessoas compartilham com você não são afetadas. Continuar?"))return;
  if(minhas.length){const {error}=await sb.from("metas").delete().in("id",minhas.map(m=>m.id));if(error){toast("Não consegui limpar: "+error.message);return}}
  // o histórico vai junto: o banco move os avanços para a tabela própria sozinho
  const {error}=await sb.from("metas").insert(lista.map(x=>limpar({...x,registros:(x.registros||[]).filter(r=>r&&Number.isFinite(Number(r.valor)))})));
  if(error){toast("Não consegui restaurar: "+error.message);return}
  if(j.preferencias&&(j.preferencias.areas||j.preferencias.ano))await salvarPrefs(Object.fromEntries(Object.entries(j.preferencias).filter(([k,v])=>v)));
  toast("Backup restaurado.");carregar();
}
document.addEventListener("click",e=>{if(e.target.id==="btnSeed")semear();if(e.target.id==="btnZero")criarMeta()});
$("btnExport").addEventListener("click",exportar);
$("fImport").addEventListener("change",e=>{const f=e.target.files[0];e.target.value="";if(f)importar(f)});
async function sair(){if(pend.length&&!window.confirm("Ainda há "+pend.length+" alteração(ões) não salva(s). Elas ficam guardadas neste aparelho e são enviadas quando você entrar de novo. Sair mesmo assim?"))return;pend=[];clearTimeout(timerPend);conviteChecado=false;fecharPerfil();fechar();await sb.auth.signOut();metas=[];perfis={};loaded=false;usuario=null;prefs={};mostrar("login")}
$("btnSair").addEventListener("click",sair);
$("pSair").addEventListener("click",sair);
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();$("lErr").textContent="";$("lBtn").disabled=true;
  const email=$("lEmail").value.trim();try{localStorage.setItem("metas_email",email)}catch(err){}
  const {error}=await sb.auth.signInWithPassword({email,password:$("lSenha").value});
  $("lBtn").disabled=false;
  if(error)$("lErr").textContent=error.message==="Invalid login credentials"?"E-mail ou senha incorretos.":error.message;
});
function mostrar(qual){$("login").hidden=qual!=="login";$("app").hidden=qual!=="app";esconderAbertura()}
function esconderAbertura(){const s=$("splash");if(s&&!s.classList.contains("fora")){s.classList.add("fora");setTimeout(()=>s.remove(),500)}}
function ajustarModo(){
  if(sortable){sortable.option("handle",isMob()?null:".drag");sortable.option("filter",isMob()?"input,button,select,textarea,form":".sem-filtro");}
  if(!isMob()){aba="metas"}
  if(loaded||!$("app").hidden)render();
  if(editId)desenharGaveta();
}
MQ.addEventListener?MQ.addEventListener("change",ajustarModo):MQ.addListener(ajustarModo);
setTimeout(esconderAbertura,4000);

/* puxar para atualizar (celular) */
(()=>{let y0=null,dy=0;const ptr=$("ptr");const lbl=ptr.querySelector("em"),ic=ptr.querySelector("span");
  const ativo=()=>isMob()&&!$("app").hidden&&!editId&&!$("perfil").classList.contains("open")&&!arrastando;
  window.addEventListener("touchstart",e=>{if(ativo()&&window.scrollY<=0&&e.touches.length===1){y0=e.touches[0].clientY;dy=0}else y0=null},{passive:true});
  window.addEventListener("touchmove",e=>{if(y0==null)return;dy=e.touches[0].clientY-y0;if(dy<=0){ptr.style.transform="";return}
    const d=Math.min(dy*.5,70);ptr.classList.add("puxando");ptr.style.transform=`translate(-50%,${d-60}px)`;
    const ok=dy>110;lbl.textContent=ok?"Solte para atualizar":"Puxe para atualizar";ic.textContent=ok?"↻":"↓"},{passive:true});
  window.addEventListener("touchend",async()=>{if(y0==null)return;const ok=dy>110;y0=null;ptr.classList.remove("puxando");
    if(ok){lbl.textContent="Atualizando…";ic.textContent="↻";ptr.style.transform="translate(-50%,0)";await carregar();lbl.textContent="Atualizado";setTimeout(()=>ptr.style.transform="",700)}
    else ptr.style.transform=""});
})();

/* arrastar a folha para baixo para fechar (celular) */
function arrastarParaFechar(painel,fecharFn){
  let y0=null,dy=0;const zona=painel.querySelector("header"),grab=painel.querySelector(".grab");
  const ini=e=>{if(!isMob()||e.target.closest("button"))return;y0=e.clientY;dy=0;painel.classList.add("arrastando");try{e.target.setPointerCapture(e.pointerId)}catch(err){}};
  const mov=e=>{if(y0==null)return;dy=Math.max(0,e.clientY-y0);painel.style.transform=`translateY(${dy}px)`};
  const fim=()=>{if(y0==null)return;y0=null;painel.classList.remove("arrastando");painel.style.transform="";if(dy>110)fecharFn()};
  [zona,grab].forEach(z=>{z.addEventListener("pointerdown",ini);z.addEventListener("pointermove",mov);z.addEventListener("pointerup",fim);z.addEventListener("pointercancel",fim)});
}
arrastarParaFechar($("drawer"),()=>fechar());
arrastarParaFechar($("perfil"),()=>fecharPerfil());
arrastarParaFechar($("trazer"),()=>fecharTrazer());
arrastarParaFechar($("semana"),()=>fecharSemana());
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&sb&&!$("app").hidden&&!editId&&!$("perfil").classList.contains("open"))carregar()});

(async()=>{
  try{const o=localStorage.getItem("metas_ordem");if(o)$("ordem").value=o}catch(e){}
  const C=window.METAS_CONFIG||{};
  if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_KEY||C.SUPABASE_URL.includes("COLE_")){
    mostrar("login");$("loginForm").hidden=true;$("btnFace").hidden=true;
    $("lIntro").textContent="Falta configurar: preencha SUPABASE_URL e SUPABASE_KEY no arquivo config.js (veja o README).";return;
  }
  sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,experimental:{passkey:true}}});
  if(temPasskey()){$("btnFace").hidden=false;$("lOr").hidden=false}
  try{const em=localStorage.getItem("metas_email");if(em)$("lEmail").value=em}catch(e){}
  if(window.Sortable)sortable=Sortable.create($("grid"),{handle:".drag",draggable:".card",animation:150,forceFallback:true,fallbackTolerance:3,
    delay:350,delayOnTouchOnly:true,touchStartThreshold:6,filter:".sem-filtro",preventOnFilter:false,
    onStart:()=>{arrastando=true;if(navigator.vibrate)try{navigator.vibrate(15)}catch(e){}},
    onEnd:()=>{setTimeout(()=>arrastando=false,250);try{localStorage.setItem("metas_dica_ordem","1")}catch(e){}salvarOrdemArrastada()}});
  ajustarModo();
  sb.auth.onAuthStateChange((ev,session)=>{
    if(session){usuario=session.user;prefs=usuario.user_metadata||{};mostrarUsuario();if($("app").hidden){mostrar("app");render();carregar()}}
    else mostrar("login");
  });
  const {data}=await sb.auth.getSession();
  if(!data.session)mostrar("login");
})();
