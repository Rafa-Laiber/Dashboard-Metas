// Testes do site no computador. Rodam com um banco simulado (mock.js), sem tocar nos seus dados.
const { test, expect } = require("@playwright/test");
const { abrir, dadosPadrao, banco, esperarFilaVazia } = require("./ajuda");

const valorTela = (page, id = "x0") => page.locator(`.card[data-id=${id}] .big`).innerText();
async function somar(page, v, id = "x0") { await page.fill(`#q-${id}`, String(v)); await page.press(`#q-${id}`, "Enter"); }

test("bibliotecas verdadeiras passam na conferência de segurança", async ({ page }) => {
  const r = await abrir(page, { real: true, logado: false });
  await expect.poll(() => page.evaluate(() => typeof window.supabase?.createClient + "/" + typeof window.Sortable), { timeout: 3000 }).toBe("function/function").catch(e => { console.log(r.avisosConsole, r.erros); throw e; });
  await expect(page.locator("#login")).toBeVisible();
  expect(r.avisosConsole.filter(t => /Security Policy|integrity/i.test(t))).toEqual([]);
  expect(r.erros).toEqual([]);
});

test("login: senha errada avisa, senha certa entra", async ({ page }) => {
  await abrir(page, { logado: false });
  await page.fill("#lEmail", "rafa@x.com"); await page.fill("#lSenha", "errada"); await page.click("#lBtn");
  await expect(page.locator("#lErr")).not.toBeEmpty();
  await page.fill("#lSenha", "certa"); await page.click("#lBtn");
  await expect(page.locator(".card")).toHaveCount(3);
});

test("mostra as metas e o histórico vindo da tabela de avanços", async ({ page }) => {
  const r = await abrir(page);
  await expect(page.locator(".card")).toHaveCount(3);
  expect(await valorTela(page)).toContain("R$ 30");
  expect(await page.evaluate(() => metas.find(m => m.id === "x0").registros.length)).toBe(3);
  expect(r.erros).toEqual([]);
  expect(r.avisosConsole.filter(t => /Security Policy/.test(t))).toEqual([]);
});

test("somar avanço e apagar do histórico", async ({ page }) => {
  await abrir(page);
  await somar(page, 50); await esperarFilaVazia(page);
  let db = await banco(page);
  expect(db.metas[0].atual).toBe(80); expect(db.avancos).toHaveLength(4);
  await page.click("button[data-act=editar][data-id=x0]");
  await page.evaluate(() => document.querySelector("[data-act=rmReg]").click());
  await esperarFilaVazia(page);
  db = await banco(page);
  expect(db.metas[0].atual).toBe(30); expect(db.avancos).toHaveLength(3);
});

test("etapas: marcar, criar, renomear, mover e apagar", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => {
    marcarEtapa("x1", "e1", true);
    gravar("x1", { t: "etapaAdd", eid: "n1", texto: "Fotógrafo" });
    gravar("x1", { t: "etapaTexto", eid: "e2", texto: "Buffet e bolo" });
    gravar("x1", { t: "etapaMover", eid: "n1", para: 0 });
    gravar("x1", { t: "etapaRm", eid: "e3" });
  });
  await esperarFilaVazia(page);
  const m = (await banco(page)).metas[1];
  expect(m.etapas.map(e => e.texto)).toEqual(["Fotógrafo", "Local", "Buffet e bolo"]);
  expect(m.etapas.find(e => e.id === "e1").feita).toBe(true);
});

test("hábito: marcar e desmarcar dia", async ({ page }) => {
  await abrir(page);
  const dia = page.locator(".card[data-id=x2] [data-act=dia]").first();
  await dia.click(); await esperarFilaVazia(page);
  expect((await banco(page)).metas[2].dias).toHaveLength(1);
  await dia.click(); await esperarFilaVazia(page);
  expect((await banco(page)).metas[2].dias).toHaveLength(0);
});

test("criar meta e trocar o nome", async ({ page }) => {
  await abrir(page);
  await page.click("#btnNova");
  await expect(page.locator("#drawer")).toHaveClass(/open/);
  const nome = page.locator("#drawer [data-f=nome]");
  await nome.fill("Passar no Revalida"); await nome.press("Tab");
  await esperarFilaVazia(page);
  expect((await banco(page)).metas.map(m => m.nome)).toContain("Passar no Revalida");
});

test("sem internet: guarda, avisa e envia quando a conexão volta", async ({ page, context }) => {
  await abrir(page);
  await page.evaluate(() => { window.__offline = true; });
  await context.setOffline(true);
  await somar(page, 50);
  await expect(page.locator("#pend")).toBeVisible();
  await expect(page.locator("#pend")).toContainText("não salva");
  expect(await valorTela(page)).toContain("R$ 80");
  expect((await banco(page)).metas[0].atual).toBe(30);
  await context.setOffline(false);
  await page.evaluate(() => { window.__offline = false; dispatchEvent(new Event("online")); });
  await expect(page.locator("#pend")).toBeHidden();
  expect((await banco(page)).metas[0].atual).toBe(80);
});

test("fechar e abrir o site com alteração pendente não perde nada", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => { window.__offline = true; });
  await somar(page, 5);
  await expect(page.locator("#pend")).toBeVisible();
  await page.reload(); await page.locator(".card").first().waitFor();
  await esperarFilaVazia(page);
  const db = await banco(page);
  expect(db.metas[0].atual).toBe(35); expect(db.avancos).toHaveLength(4);
});

test("resposta perdida e repetida não soma duas vezes", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => { window.__perder = true; });
  await somar(page, 7);
  await expect(page.locator("#pend")).toBeVisible();
  await page.click("#pendBtn"); await esperarFilaVazia(page);
  const db = await banco(page);
  expect(db.metas[0].atual).toBe(37); expect(db.avancos).toHaveLength(4);
});

test("erro de verdade: a tela volta para o que está salvo e explica", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => { window.__negar = true; });
  await somar(page, 1000);
  await expect(page.locator("#toast")).toContainText("Não consegui salvar");
  await esperarFilaVazia(page);
  await expect.poll(() => valorTela(page)).toContain("R$ 30");
});

test("preferência que não salvou volta ao valor anterior", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => { window.__offline = true; });
  expect(await page.evaluate(() => salvarPrefs({ semana: "dom" }))).toBe(false);
  expect(await page.evaluate(() => prefs.semana || "seg")).toBe("seg");
});

test("histórico sem limite: 2.500 avanços carregam e a gaveta continua rápida", async ({ page }) => {
  const db = dadosPadrao();
  db.avancos = Array.from({ length: 2500 }, (_, j) => ({ meta_id: "x0", id: "g" + j, valor: 1, data: "2026-01-01", criado_em: String(j).padStart(8, "0") }));
  await abrir(page, { db });
  expect(await page.evaluate(() => metas[0].registros.length)).toBe(2500);
  await page.click("button[data-act=editar][data-id=x0]");
  await expect(page.locator("#drawer ul.hist li")).toHaveCount(100);
  await page.locator("[data-act=histTudo]").click({ force: true });
  await expect(page.locator("#drawer ul.hist li")).toHaveCount(2500);
});

test("restaurar backup leva o histórico junto", async ({ page }) => {
  await abrir(page);
  const bk = { metas: [{ nome: "Do backup", area: "Finanças", tipo: "Numérica", prioridade: "Média", status: "Em andamento", prazo: "2027-12-31", atual: 30, alvo: 100, unidade: "R$", notas: "", ordem: 0, etapas: [], vezes: 3, dias: [],
    registros: [{ id: "b1", valor: 10, data: "2026-01-01" }, { id: "b2", valor: 20, data: "2026-02-01" }] }] };
  await page.setInputFiles("#fImport", { name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bk)) });
  await expect(page.locator(".card")).toHaveCount(1);
  const db = await banco(page);
  expect(db.avancos).toHaveLength(2);
  expect(await page.evaluate(() => metas[0].registros.length)).toBe(2);
});

test("texto malicioso aparece como texto e não roda", async ({ page }) => {
  const db = dadosPadrao();
  db.metas[0].nome = "<img src=x onerror=window.__xss=1>";
  db.metas[1].etapas[0].id = 'e1" onmouseover="window.__xss=2';
  db.metas[1].notas = "<script>window.__xss=3</script>";
  db.users.u1.user_metadata.areas = [{ k: "<b onmouseover=window.__xss=4>A</b>", c: "1;}body{display:none" }];
  const r = await abrir(page, { db });
  await page.click("button[data-act=editar][data-id=x1]");
  await page.evaluate(() => document.querySelectorAll("#drawer [data-eid]").forEach(e => e.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))));
  expect(await page.evaluate(() => window.__xss || null)).toBeNull();
  await expect(page.locator(".card[data-id=x0] h3")).toContainText("<img");
  expect(await page.evaluate(() => getComputedStyle(document.body).display)).not.toBe("none");
  expect(r.erros).toEqual([]);
});

test("setas do ano trocam o ano", async ({ page }) => {
  await abrir(page);
  await expect(page.locator("#anoBtn")).toHaveText("2027");
  await page.click("[data-anopasso='1']");
  await expect(page.locator("#anoBtn")).toHaveText("2028");
  await page.click("[data-anopasso='-1']");
  await expect(page.locator("#anoBtn")).toHaveText("2027");
});

test("meta compartilhada: quem participa vê e pode sair", async ({ page }) => {
  const db = dadosPadrao();
  db.metas.push({ ...db.metas[1], id: "x9", user_id: "u2", nome: "Meta da Ana", etapas: [] });
  db.membros.push({ meta_id: "x9", user_id: "u1" });
  await abrir(page, { db });
  await expect(page.locator(".card[data-id=x9]")).toBeVisible();
  await page.click("button[data-act=editar][data-id=x9]");
  await expect(page.locator("#btnSairMeta")).toBeVisible();
  await expect(page.locator("#btnExcluir")).toHaveCount(0);
});
