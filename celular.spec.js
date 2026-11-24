// Testes do modo app no celular.
const { test, expect } = require("@playwright/test");
const { abrir, banco, esperarFilaVazia } = require("./ajuda");

test("abre como app: barra de abas e nada passando da tela", async ({ page }) => {
  const r = await abrir(page);
  await expect(page.locator("#tabbar")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(r.erros).toEqual([]);
});

test("aba Hoje e aba Perfil", async ({ page }) => {
  await abrir(page);
  await page.click("#tabbar [data-tab=hoje]");
  await expect(page.locator("body")).toHaveClass(/ver-hoje/);
  await page.click("#tabbar [data-tab=perfil]");
  await expect(page.locator("#perfil")).toHaveClass(/open/);
});

test("tema escuro pelo perfil", async ({ page }) => {
  await abrir(page);
  await page.click("#tabbar [data-tab=perfil]");
  await page.click("[data-pir=aparencia]");
  await page.click("[data-tema=escuro]");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("aviso de alteração não salva aparece e some", async ({ page, context }) => {
  await abrir(page);
  await page.evaluate(() => { window.__offline = true; });
  await context.setOffline(true);
  await page.evaluate(() => marcarEtapa("x1", "e1", true));
  await expect(page.locator("#pend")).toBeVisible();
  const caixa = await page.locator("#pend").boundingBox();
  expect(caixa.x).toBeGreaterThanOrEqual(0);
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(page.viewportSize().width);
  await context.setOffline(false);
  await page.evaluate(() => { window.__offline = false; dispatchEvent(new Event("online")); });
  await expect(page.locator("#pend")).toBeHidden();
  await esperarFilaVazia(page);
  expect((await banco(page)).metas[1].etapas[0].feita).toBe(true);
});
