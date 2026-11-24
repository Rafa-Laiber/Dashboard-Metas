// Metas compartilhadas ao vivo: mudanças de outras pessoas aparecem sem recarregar.
const { test, expect } = require("@playwright/test");
const { abrir, dadosPadrao, banco, esperarFilaVazia } = require("./ajuda");

function comMetaDaAna() {
  const db = dadosPadrao();
  db.metas.push({ ...db.metas[1], id: "x9", user_id: "u2", nome: "Casamento", updated_at: "2026-11-01T00:00:00Z",
    etapas: [{ id: "c1", texto: "Buffet", feita: false }] });
  db.membros.push({ meta_id: "x9", user_id: "u1" });
  return db;
}
const conectado = page => expect.poll(() => page.evaluate(() => (window.__canais || []).length)).toBe(1);

test("quando a Ana marca uma etapa, o cartão muda na hora e avisa", async ({ page }) => {
  await abrir(page, { db: comMetaDaAna() }); await conectado(page);
  await page.evaluate(() => __emitir("metas", "UPDATE", { ...JSON.parse(localStorage.__db).metas[3],
    etapas: [{ id: "c1", texto: "Buffet", feita: true }], status: "Concluída", alterado_por: "u2", updated_at: "2026-11-24T12:00:00Z" }, { id: "x9" }));
  await expect(page.locator("#toast")).toContainText("Ana atualizou");
  await expect(page.locator(".card[data-id=x9]")).toHaveClass(/vivo/);
  expect(await page.evaluate(() => metas.find(m => m.id === "x9").etapas[0].feita)).toBe(true);
});

test("avanço registrado por outra pessoa entra no histórico", async ({ page }) => {
  await abrir(page, { db: comMetaDaAna() }); await conectado(page);
  await page.evaluate(() => __emitir("avancos", "INSERT", { meta_id: "x0", id: "ana1", valor: 200, data: "2026-11-20", user_id: "u2" }));
  await expect.poll(() => page.evaluate(() => metas.find(m => m.id === "x0").registros.length)).toBe(4);
  await page.evaluate(() => __emitir("avancos", "DELETE", {}, { meta_id: "x0", id: "ana1" }));
  await expect.poll(() => page.evaluate(() => metas.find(m => m.id === "x0").registros.length)).toBe(3);
});

test("meta apagada pela dona some da tela", async ({ page }) => {
  await abrir(page, { db: comMetaDaAna() }); await conectado(page);
  await page.evaluate(() => __emitir("metas", "DELETE", {}, { id: "x9" }));
  await expect(page.locator(".card[data-id=x9]")).toHaveCount(0);
});

test("meta compartilhada agora aparece sem recarregar", async ({ page }) => {
  await abrir(page); await conectado(page);
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.__db);
    db.metas.push({ ...db.metas[1], id: "x7", user_id: "u2", nome: "Lua de mel", etapas: [] });
    db.membros.push({ meta_id: "x7", user_id: "u1" });
    localStorage.__db = JSON.stringify(db); Object.assign(window.__db, db);
    __emitir("meta_membros", "INSERT", { meta_id: "x7", user_id: "u1" });
  });
  await expect(page.locator(".card[data-id=x7]")).toBeVisible();
});

test("as minhas próprias alterações não geram aviso nem piscada", async ({ page }) => {
  await abrir(page); await conectado(page);
  await page.fill("#q-x0", "50"); await page.press("#q-x0", "Enter");
  await esperarFilaVazia(page);
  await page.waitForTimeout(400);
  await expect(page.locator(".card.vivo")).toHaveCount(0);
  await expect(page.locator("#toast")).not.toContainText("atualizou");
  expect((await banco(page)).metas[0].atual).toBe(80);
  expect(await page.evaluate(() => metas[0].registros.length)).toBe(4);
});

test("ao sair da conta, para de ouvir as mudanças", async ({ page }) => {
  await abrir(page); await conectado(page);
  await page.evaluate(() => sair());
  await expect.poll(() => page.evaluate(() => window.__canais.length)).toBe(0);
});
