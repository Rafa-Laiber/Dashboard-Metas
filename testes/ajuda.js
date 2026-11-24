// Prepara o navegador de teste: banco simulado (mock.js), dados iniciais e usuário logado.
const path = require("path");
const MOCK = path.join(__dirname, "mock.js");
const SORTABLE = require.resolve("sortablejs/Sortable.min.js");
const SUPABASE = path.join(path.dirname(require.resolve("@supabase/supabase-js/package.json")), "dist/umd/supabase.js");

function dadosPadrao() {
  const regs = [10, 10, 10].map((v, j) => ({ meta_id: "x0", id: "r" + j, valor: v, data: "2026-11-0" + (j + 1), criado_em: "0000000" + j }));
  const base = { prioridade: "Alta", status: "Em andamento", prazo: "2027-12-31", unidade: "", notas: "", vezes: 3, dias: [], registros: [], etapas: [], atual: 0, alvo: 0 };
  return {
    metas: [
      { ...base, id: "x0", user_id: "u1", nome: "Juntar dinheiro", area: "Finanças", tipo: "Numérica", atual: 30, alvo: 100000, unidade: "R$", ordem: 0 },
      { ...base, id: "x1", user_id: "u1", nome: "Casar", area: "Pessoal e família", tipo: "Etapas", ordem: 1,
        etapas: [{ id: "e1", texto: "Local", feita: false }, { id: "e2", texto: "Buffet", feita: false }, { id: "e3", texto: "Convites", feita: false }] },
      { ...base, id: "x2", user_id: "u1", nome: "Treinar", area: "Saúde e hábitos", tipo: "Hábito semanal", alvo: 45, prioridade: "Média", ordem: 2 }
    ],
    membros: [], avancos: regs,
    users: {
      u1: { id: "u1", email: "rafa@x.com", user_metadata: { nome: "Rafa", ano: 2027 } },
      u2: { id: "u2", email: "ana@x.com", user_metadata: { nome: "Ana Paula" } }
    }
  };
}

// abre o site. opcoes: { db, logado (padrão true), real (usa as bibliotecas verdadeiras do CDN) }
async function abrir(page, opcoes = {}) {
  const db = opcoes.db || dadosPadrao();
  const logado = opcoes.logado !== false;
  const erros = [], avisosConsole = [];
  page.on("pageerror", e => erros.push(String(e)));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") avisosConsole.push(m.text()); });
  page.on("dialog", d => d.accept());
  await page.addInitScript(([db, logado]) => {
    if (!localStorage.getItem("__db")) localStorage.setItem("__db", JSON.stringify(db));
    if (logado && !sessionStorage.getItem("__saiu")) sessionStorage.setItem("__me", "u1");
    localStorage.setItem("metas_face", "1");
  }, [db, logado]);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.route(/supabase\.co/, r => r.abort());
  const cors = { "access-control-allow-origin": "*" };
  await page.route(/cdn\.jsdelivr\.net\/npm\/sortablejs/, r => r.fulfill({ path: SORTABLE, contentType: "text/javascript", headers: cors }));
  if (opcoes.real) {
    await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, r => r.fulfill({ path: SUPABASE, contentType: "text/javascript", headers: cors }));
  } else {
    await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, r => r.fulfill({ path: MOCK, contentType: "text/javascript", headers: cors }));
    // o banco simulado não é o arquivo verdadeiro, então tira só a conferência dele
    await page.route(/\/(index\.html)?(\?.*)?$/, async r => {
      const resp = await r.fetch();
      const html = (await resp.text()).replace(/(supabase\.js") integrity="[^"]+"/, "$1");
      await r.fulfill({ response: resp, body: html });
    });
  }
  await page.route("**/config.js", r => r.fulfill({ body: 'window.METAS_CONFIG={SUPABASE_URL:"https://teste.supabase.co",SUPABASE_KEY:"k"}', contentType: "text/javascript" }));
  await page.goto("/index.html");
  if (logado && !opcoes.real) await page.locator(".card").first().waitFor();
  return { erros, avisosConsole };
}
const banco = page => page.evaluate(() => JSON.parse(localStorage.getItem("__db")));
// (o site bloqueia "eval" pela regra de segurança, então a espera é feita perguntando de tempos em tempos)
const { expect } = require("@playwright/test");
const esperarFilaVazia = page => expect.poll(() => page.evaluate(() => typeof pend !== "undefined" && pend.length === 0 && !enviando), { timeout: 8000 }).toBe(true);
module.exports = { abrir, dadosPadrao, banco, esperarFilaVazia };
