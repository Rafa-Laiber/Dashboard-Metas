// Perfil, aparência (tema) e Face ID / digital.
/* ---------- perfil ---------- */
const temPasskey=()=>!!(window.PublicKeyCredential&&navigator.credentials);
const meuNome=()=>(prefs.nome||"").trim();
const corVar=c=>{c=parseInt(c,10);return c>=1&&c<=8?"var(--c"+c+")":"var(--accent)"};
const CORES=[[0,"Azul"],[1,"Verde"],[3,"Turquesa"],[4,"Roxo"],[5,"Rosa"],[6,"Âmbar"],[7,"Vermelho"],[8,"Grafite"]];
function mostrarUsuario(){
  if(!usuario)return;
  const n=meuNome(),ini=iniciaisDe(n,usuario.email);
  $("btnPerfil").textContent=ini;$("pAvatar").textContent=ini;$("pAvatar2").textContent=ini;
  ["btnPerfil","pAvatar","pAvatar2"].forEach(i=>$(i).style.background=corVar(prefs.cor));
  $("hello").textContent=n?"Olá, "+n.split(/\s+/)[0]+"!":"Olá!";
  $("pNome").textContent=n||"Sem nome";$("pEmail").textContent=usuario.email||"";
  $("quem").textContent=usuario.email||"";
}
function desenharAreas(){
  const lista=minhasAreas();
  $("areasEd").innerHTML=lista.map((a,i)=>`<div class="area-ed"><button class="sw" type="button" style="--ac:var(--c${a.c})" data-acor="${i}" title="Trocar cor" aria-label="Trocar cor de ${esc(a.k)}"></button><input type="text" value="${esc(a.k)}" data-aname="${i}" aria-label="Nome da área ${i+1}" maxlength="30"><button class="icon" type="button" data-arm="${i}" title="Remover área">×</button></div>`).join("");
}
const TITULOS={main:"Meu perfil",cor:"Cor do avatar",face:"Face ID / digital",senha:"Trocar senha",aparencia:"Aparência",semana:"Primeiro dia da semana",areas:"Minhas áreas"};
function pVer(v){
  $("pBody").dataset.view=v;
  document.querySelectorAll("[data-pview]").forEach(e=>e.hidden=e.dataset.pview!==v);
  $("pTitulo").textContent=TITULOS[v]||"Meu perfil";$("pVoltar").hidden=v==="main";
  $("pBody").scrollTop=0;
  if(v==="main")atualizarPerfil();
  if(v==="areas")desenharAreas();
  if(v==="cor")desenharCores();
  if(v==="face")listarFace();
  if(v==="senha"){["senhaOk","senhaErr"].forEach(i=>$(i).textContent="");setTimeout(()=>$("pS1").focus(),250)}
}
const NOME_TEMA={claro:"Claro",escuro:"Escuro",auto:"Automático"};
function atualizarPerfil(){
  $("lvTema").textContent=NOME_TEMA[temaAtual()];
  $("lvSem").textContent=inicioDomingo()?"Domingo":"Segunda";
  const na=minhasAreas().length;$("lvAreas").textContent=na+" área"+(na>1?"s":"");
  const nc=CORES.find(c=>String(c[0])===String(parseInt(prefs.cor,10)||0));
  $("lvCor").innerHTML=`<span class="cor-bola" style="background:${corVar(prefs.cor)}"></span>${esc(nc?nc[1]:"Azul")}`;
  document.querySelectorAll("[data-tema]").forEach(b=>b.setAttribute("aria-checked",String(b.dataset.tema===temaAtual())));
  document.querySelectorAll("[data-semini]").forEach(b=>b.setAttribute("aria-checked",String((b.dataset.semini==="dom")===inicioDomingo())));
  listarFace();
}
function desenharCores(){
  const atual=parseInt(prefs.cor,10)||0;
  $("coresGrade").innerHTML=CORES.map(([c,nome])=>`<button type="button" class="cor-op" role="radio" aria-checked="${c===atual}" aria-label="${nome}" title="${nome}" style="--cx:${corVar(c)}" data-cor="${c}"></button>`).join("");
}
function abrirPerfil(){
  fechar();fecharSemana();editarNome(false);pVer("main");
  ["faceOk","faceErr"].forEach(i=>$(i).textContent="");
  $("perfil").classList.add("open");$("scrim").classList.add("open");
}
$("pVoltar").addEventListener("click",()=>pVer("main"));
document.addEventListener("click",async e=>{
  const ir=e.target.closest("[data-pir]");if(ir){pVer(ir.dataset.pir);return}
  const c=e.target.closest("[data-cor]");
  if(c){const n=+c.dataset.cor;prefs.cor=n;mostrarUsuario();desenharCores();if(perfis[usuario.id])perfis[usuario.id].cor=n;await salvarPrefs({cor:n});return}
  const si=e.target.closest("[data-semini]");
  if(si){const v=si.dataset.semini;prefs.semana=v;atualizarPerfil();render();await salvarPrefs({semana:v});toast("A semana agora começa no "+(v==="dom"?"domingo":"segunda")+".");return}
  if(e.target.closest("#pBaixar")){exportar();return}
  const st=e.target.closest("#pSairTodos");
  if(st){if(st.classList.contains("armed")){const r=await sb.auth.signOut({scope:"global"});const error=r&&r.error;if(error){toast("Não consegui sair de todos: "+error.message);return}conviteChecado=false;fecharPerfil();metas=[];perfis={};loaded=false;usuario=null;prefs={};mostrar("login");toast("Você saiu de todos os aparelhos.")}
    else{st.classList.add("armed");st.querySelector(".li-val").textContent="Toque de novo para confirmar";setTimeout(()=>{if(st.isConnected){st.classList.remove("armed");st.querySelector(".li-val").textContent=""}},4000)}}
});
function fecharPerfil(){$("perfil").classList.remove("open");if(!editId)$("scrim").classList.remove("open")}
$("btnPerfil").addEventListener("click",abrirPerfil);
$("pFechar").addEventListener("click",fecharPerfil);
function editarNome(on){
  $("pNomeVer").hidden=on;$("fNome").hidden=!on;
  if(on){const i=$("pNomeIn");i.value=meuNome();i.focus();i.select()}
}
$("pEditar").addEventListener("click",()=>editarNome(true));
$("pCancelar").addEventListener("click",()=>editarNome(false));
$("pNomeIn").addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();editarNome(false)}});
$("fNome").addEventListener("submit",async e=>{
  e.preventDefault();const nome=$("pNomeIn").value.trim().slice(0,40);if(!nome)return;
  if(nome===meuNome()){editarNome(false);return}
  if(await salvarPrefs({nome})){mostrarUsuario();if(perfis[usuario.id])perfis[usuario.id].nome=nome;editarNome(false);toast("Nome salvo.")}
});

/* ---------- aparência: claro, escuro ou automático ---------- */
function temaAtual(){try{return localStorage.getItem("metas_tema")||"auto"}catch(e){return "auto"}}
function aplicarTema(t){
  const r=document.documentElement;
  if(t==="claro")r.setAttribute("data-theme","light");else if(t==="escuro")r.setAttribute("data-theme","dark");else r.removeAttribute("data-theme");
  try{t==="auto"?localStorage.removeItem("metas_tema"):localStorage.setItem("metas_tema",t)}catch(e){}
  const metas=document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach(m=>{const escuro=m.getAttribute("media")&&m.getAttribute("media").includes("dark");m.setAttribute("content",t==="claro"?"#eef1f6":t==="escuro"?"#10141c":(escuro?"#10141c":"#eef1f6"))});
  document.querySelectorAll("[data-tema]").forEach(b=>b.setAttribute("aria-checked",String(b.dataset.tema===t)));
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-tema]");if(b){aplicarTema(b.dataset.tema);if($("lvTema"))$("lvTema").textContent=NOME_TEMA[b.dataset.tema]}});
aplicarTema(temaAtual());

$("areasEd").addEventListener("click",async e=>{
  const cor=e.target.closest("[data-acor]"),rm=e.target.closest("[data-arm]");
  const lista=minhasAreas().map(x=>({...x}));
  if(cor){const i=+cor.dataset.acor;lista[i].c=lista[i].c%8+1;await salvarPrefs({areas:lista});desenharAreas();render()}
  if(rm){const i=+rm.dataset.arm;const k=lista[i].k;const usadas=metas.filter(m=>m.area===k&&souDono(m)).length;
    if(lista.length<=1){toast("Você precisa ter pelo menos uma área.");return}
    if(usadas){toast(`Antes de remover, mude a área das ${usadas} meta${usadas>1?"s":""} de “${k}”.`);return}
    lista.splice(i,1);await salvarPrefs({areas:lista});desenharAreas();render()}
});
$("areasEd").addEventListener("change",async e=>{
  const inp=e.target.closest("[data-aname]");if(!inp)return;
  const i=+inp.dataset.aname,lista=minhasAreas().map(x=>({...x})),velho=lista[i].k,novo=inp.value.trim().slice(0,30);
  if(!novo||novo===velho){inp.value=velho;return}
  if(lista.some((a,j)=>j!==i&&a.k===novo)){toast("Já existe uma área com esse nome.");inp.value=velho;return}
  lista[i].k=novo;await salvarPrefs({areas:lista});
  metas.filter(m=>m.area===velho&&souDono(m)).forEach(m=>salvar(m.id,{area:novo}));
  if(filtroArea===velho)filtroArea=novo;desenharAreas();render();toast("Área renomeada.");
});
$("fArea").addEventListener("submit",async e=>{
  e.preventDefault();const k=$("novaArea").value.trim().slice(0,30);if(!k)return;
  const lista=minhasAreas().map(x=>({...x}));
  if(lista.some(a=>a.k===k)){toast("Essa área já existe.");return}
  const usadas=new Set(lista.map(a=>a.c));let c=1;while(usadas.has(c)&&c<8)c++;
  lista.push({k,c});await salvarPrefs({areas:lista});$("novaArea").value="";desenharAreas();render();
});
$("fSenha").addEventListener("submit",async e=>{
  e.preventDefault();$("senhaOk").textContent="";$("senhaErr").textContent="";
  const a=$("pS1").value,b=$("pS2").value;
  if(a.length<8){$("senhaErr").textContent="Use pelo menos 8 caracteres.";return}
  if(a!==b){$("senhaErr").textContent="As duas senhas não são iguais.";return}
  const {error}=await sb.auth.updateUser({password:a});
  if(error){$("senhaErr").textContent=/different from the old/i.test(error.message)?"A nova senha precisa ser diferente da atual.":/weak|short|characters/i.test(error.message)?"Senha fraca: use letras e números, com pelo menos 8 caracteres.":"Não consegui trocar: "+error.message;return}
  $("pS1").value="";$("pS2").value="";$("senhaOk").textContent="Senha trocada.";
});

/* ---------- Face ID / digital (passkeys) ---------- */
function erroFace(err){
  const m=(err&&err.message)||"";
  if(/cancel|abort|NotAllowed|timed out/i.test(m))return "Cancelado. Tente de novo quando quiser.";
  if(/not enabled|disabled|passkey.*not.*(allowed|enabled)/i.test(m))return "O login com Face ID ainda não foi ligado no Supabase (Authentication → Passkeys).";
  if(/does not support/i.test(m))return "Este navegador não aceita Face ID / digital. Use o Safari ou o Chrome atualizados.";
  if(/not found|no credential|unknown/i.test(m))return "Nenhuma chave encontrada neste aparelho. Entre com a senha e ative o Face ID no seu perfil.";
  return "Não deu certo: "+m;
}
async function listarFace(){
  const ul=$("faceLista");ul.innerHTML="";
  if(!temPasskey()){$("faceHint").textContent="Este navegador não aceita Face ID / digital.";$("btnFaceAtivar").hidden=true;$("lvFace").textContent="Indisponível";return}
  try{
    const {data,error}=await sb.auth.passkey.list();
    if(error)throw error;
    const lista=Array.isArray(data)?data:(data&&data.passkeys)||[];
    ul.innerHTML=lista.map(p=>`<li><span>${esc(p.friendly_name||"Aparelho")}<br><small class="hint">desde ${p.created_at?new Date(p.created_at).toLocaleDateString("pt-BR"):"—"}</small></span><button class="icon" type="button" title="Remover" data-pk="${esc(p.id)}">×</button></li>`).join("");
    if(lista.length)lembrarFace();
    $("lvFace").textContent=lista.length?(lista.length===1?"1 aparelho":lista.length+" aparelhos"):"Desligado";
    $("faceHint").textContent=lista.length?"Aparelhos que podem entrar sem senha:":"Ative neste aparelho e, da próxima vez, entre sem digitar a senha.";
  }catch(e){$("faceHint").textContent="Ative neste aparelho e, da próxima vez, entre sem digitar a senha."}
}
async function ativarFace(){
  $("faceOk").textContent="";$("faceErr").textContent="";
  const {error}=await sb.auth.registerPasskey();
  if(error){$("faceErr").textContent=erroFace(error);return false}
  try{localStorage.setItem("metas_face","1")}catch(e){}
  $("faceOk").textContent="Pronto! Da próxima vez, toque em “Entrar com Face ID / digital”.";listarFace();return true;
}
$("btnFaceAtivar").addEventListener("click",ativarFace);
$("faceLista").addEventListener("click",async e=>{
  const b=e.target.closest("[data-pk]");if(!b)return;
  const {error}=await sb.auth.passkey.delete({passkeyId:b.dataset.pk});
  if(error){$("faceErr").textContent="Não consegui remover: "+error.message;return}
  listarFace();
});
let conviteChecado=false;
function lembrarFace(){try{localStorage.setItem("metas_face","1")}catch(e){}}
async function convidarFace(){
  let ja=false;try{ja=localStorage.getItem("metas_face")}catch(e){}
  if(ja||conviteChecado||!temPasskey()||erroCarga||!$("notice").hidden)return;
  conviteChecado=true;
  // pergunta à conta se já existe alguma chave cadastrada antes de oferecer
  try{const {data,error}=await sb.auth.passkey.list();const l=Array.isArray(data)?data:(data&&data.passkeys)||[];
    if(error||l.length){if(l.length)lembrarFace();return}}catch(e){return}
  if(!$("notice").hidden||$("app").hidden)return;
  const n=$("notice");n.hidden=false;
  n.innerHTML='Quer entrar com Face ID / digital da próxima vez, sem digitar a senha? <button class="btn small primary" type="button" id="cfSim">Ativar</button><button class="btn small" type="button" id="cfNao">Agora não</button>';
  $("cfSim").onclick=async()=>{n.hidden=true;const ok=await ativarFace();if(!ok)abrirPerfil();else toast("Face ID ativado neste aparelho.")};
  $("cfNao").onclick=()=>{n.hidden=true;try{localStorage.setItem("metas_face","adiado")}catch(e){}};
}
$("btnFace").addEventListener("click",async()=>{
  $("fErr").textContent="";
  const {error}=await sb.auth.signInWithPasskey();
  if(error)$("fErr").textContent=erroFace(error);else lembrarFace();
});
