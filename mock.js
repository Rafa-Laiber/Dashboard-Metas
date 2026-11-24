(()=>{
const DB=JSON.parse(localStorage.getItem('__db')||'null')||{metas:[],membros:[],avancos:[],users:{
 'u1':{id:'u1',email:'rafa@x.com',user_metadata:{nome:'Rafael Laiber'}},'u2':{id:'u2',email:'ana@x.com',user_metadata:{nome:'Ana Paula'}}}};
DB.avancos=DB.avancos||[];
const V10=true;
const save=()=>localStorage.setItem('__db',JSON.stringify(DB));
let me=sessionStorage.getItem('__me');let n=DB.metas.length+100,seq=0;const subs=[];window.__calls=0;
const visivel=r=>r.user_id===me||DB.membros.some(x=>x.meta_id===r.id&&x.user_id===me);
const embed=r=>({...r,meta_membros:DB.membros.filter(x=>x.meta_id===r.id&&(x.user_id===me||r.user_id===me)).map(x=>({user_id:x.user_id}))});
function mover(m){if(V10&&Array.isArray(m.registros)&&m.registros.length){m.registros.forEach(r=>{if(!DB.avancos.some(a=>a.meta_id===m.id&&a.id===r.id))DB.avancos.push({meta_id:m.id,id:r.id,valor:r.valor,data:r.data,criado_em:String(++seq).padStart(8,'0')})});m.registros=[]}}
// falhas simuladas: __offline (sem internet) e __negar (erro de permissão)
const falha=(w=true)=>window.__offline?{data:null,error:{message:'TypeError: Failed to fetch',code:''},status:0}:window.__negar&&w?{data:null,error:{message:'new row violates row-level security policy',code:'42501'},status:403}:null;
const resp=out=>{window.__calls++;save();return new Promise(r=>setTimeout(()=>r(JSON.parse(JSON.stringify(out))),20))};
function q(table){let op='select',payload=null,filts=[],single=false,maybe=false,cols='*',rg=null;
 const api={select(c){if(op==='select')cols=c||'*';return api},order(){return api},limit(){return api},range(a,b){rg=[a,b];return api},insert(d){op='insert';payload=Array.isArray(d)?d:[d];return api},update(d){op='update';payload=d;return api},delete(){op='delete';return api},
  eq(k,v){filts.push(r=>r[k]===v);return api},in(k,vs){filts.push(r=>vs.includes(r[k]));return api},single(){single=true;return api},maybeSingle(){maybe=true;return api},
  then(res,rej){const f=(op!=='select'||table==='metas'&&single||maybe)&&falha(op!=='select');if(f)return resp(f).then(res,rej);
   let out={data:null,error:null,status:200};const F=r=>filts.every(f=>f(r));
   if(table==='perfis'){out.data=Object.values(DB.users).map(u=>({id:u.id,email:u.email,nome:u.user_metadata.nome||''}))}
   else if(table==='avancos'){if(!V10){out={data:null,error:{message:"Could not find the table 'public.avancos' in the schema cache",code:'PGRST205'},status:404}}
     else{let l=DB.avancos.filter(a=>{const m=DB.metas.find(x=>x.id===a.meta_id);return m&&visivel(m)}).filter(F).sort((a,b)=>(a.data+a.criado_em).localeCompare(b.data+b.criado_em));if(rg)l=l.slice(rg[0],rg[1]+1);out.data=l}}
   else if(table==='meta_membros'){
     if(op==='insert'){for(const p of payload){const m=DB.metas.find(x=>x.id===p.meta_id);if(!m||m.user_id!==me){out.error={message:'new row violates row-level security policy'};break}DB.membros.push(p)}}
     if(op==='delete'){DB.membros=DB.membros.filter(r=>!(F(r)&&(r.user_id===me||(DB.metas.find(m=>m.id===r.meta_id)||{}).user_id===me)))}
   }else{
     if(op==='select'){const l=DB.metas.filter(visivel).filter(F).map(r=>cols.includes('meta_membros')?embed(r):{...r});out.data=(single||maybe)?(l[0]||null):l;if(single&&!l[0])out.error={message:'no rows'}}
     if(op==='insert'){const add=payload.map(p=>({id:'m'+(++n),user_id:me,vezes:3,dias:[],registros:[],...JSON.parse(JSON.stringify(p))}));add.forEach(mover);DB.metas.push(...add);out.data=single?embed(add[0]):add}
     if(op==='update'){const l=DB.metas.filter(visivel).filter(F);l.forEach(r=>{Object.assign(r,JSON.parse(JSON.stringify(payload)));mover(r)});out.data=single?embed(l[0]):l.map(embed)}
     if(op==='delete'){const ids=DB.metas.filter(r=>F(r)&&r.user_id===me).map(r=>r.id);DB.metas=DB.metas.filter(r=>!ids.includes(r.id));DB.avancos=DB.avancos.filter(a=>!ids.includes(a.meta_id))}
   }
   return resp(out).then(res,rej)}};return api}
function rpc(nome,a){return{then(res,rej){const f=falha();if(f)return resp(f).then(res,rej);
  if(!V10)return resp({data:null,error:{message:'Could not find the function',code:'PGRST202'},status:404}).then(res,rej);
  const m=DB.metas.find(x=>x.id===a.p_meta&&visivel(x));if(!m)return resp({data:null,error:{message:'Meta não encontrada',code:'P0002'},status:400}).then(res,rej);
  if(nome==='avanco_somar'){if(!DB.avancos.some(x=>x.meta_id===m.id&&x.id===a.p_id)){DB.avancos.push({meta_id:m.id,id:a.p_id,valor:a.p_valor,data:a.p_data,criado_em:String(++seq).padStart(8,'0')});m.atual=Math.round((m.atual+a.p_valor)*100)/100}}
  if(nome==='avanco_apagar'){const i=DB.avancos.findIndex(x=>x.meta_id===m.id&&x.id===a.p_id);if(i>=0){m.atual=Math.round((m.atual-DB.avancos[i].valor)*100)/100;DB.avancos.splice(i,1)}}
  if(window.__perder){window.__perder=false;return resp({data:null,error:{message:'TypeError: Failed to fetch'},status:0}).then(res,rej)}
  return resp({data:{...m},error:null,status:200}).then(res,rej)}}}
window.__db=DB;
const sess=()=>me?{user:JSON.parse(JSON.stringify(DB.users[me]))}:null;
const fire=e=>subs.forEach(f=>f(e,sess()));
window.supabase={createClient:()=>({from:q,rpc,auth:{
 getSession:async()=>({data:{session:sess()}}),
 onAuthStateChange:f=>{subs.push(f);setTimeout(()=>f('INITIAL',sess()),0)},
 signInWithPassword:async({email,password})=>{const u=Object.values(DB.users).find(u=>u.email===email);if(!u||password!=='certa')return{error:{message:'Invalid login credentials'}};me=u.id;sessionStorage.setItem('__me',me);fire('SIGNED_IN');return{error:null}},
 signInWithPasskey:async()=>({error:{message:'Passkey not found'}}),registerPasskey:async()=>({data:{},error:null}),
 passkey:{list:async()=>({data:[],error:null}),delete:async()=>({error:null})},
 updateUser:async(a)=>{const f=falha();if(f)return{data:null,error:f.error};if(a.data)DB.users[me].user_metadata={...DB.users[me].user_metadata,...a.data};save();fire('USER_UPDATED');return{data:{user:sess().user},error:null}},
 signOut:async()=>{me=null;sessionStorage.removeItem('__me');fire('SIGNED_OUT')}}})};})();
