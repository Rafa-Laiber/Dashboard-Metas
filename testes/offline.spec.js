// Funcionar sem internet: abrir o site, ver as metas e registrar avanços offline.
const { test, expect } = require("@playwright/test");
const { abrir, banco, esperarFilaVazia } = require("./ajuda");

test("abre sem internet com as metas salvas e envia tudo quando a conexão volta", async ({ page }) => {
  await abrir(page);                                    // 1ª vez com internet: guarda a cópia
  await page.evaluate(() => localStorage.setItem("__off", "1"));
  await page.reload();
  await expect(page.locator(".card")).toHaveCount(3);   // abriu com a cópia
  await expect(page.locator("#notice")).toContainText("Sem internet");
  await page.fill("#q-x0", "25"); await page.press("#q-x0", "Enter");
  await expect(page.locator("#pend")).toBeVisible();
  expect((await banco(page)).metas[0].atual).toBe(30);
  await page.evaluate(() => { localStorage.removeItem("__off"); dispatchEvent(new Event("online")); });
  await esperarFilaVazia(page);
  await expect(page.locator("#notice")).not.toContainText("Sem internet");
  expect((await banco(page)).metas[0].atual).toBe(55);
});

test("sem internet e sem cópia salva: explica o que fazer", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("__off", "1"));
  await abrir(page, { esperar: false });
  await expect(page.locator("#notice")).toContainText("Conecte-se uma vez");
});

test("sair da conta apaga a cópia dos dados deste aparelho", async ({ page }) => {
  await abrir(page);
  expect(await page.evaluate(() => !!localStorage.getItem("metas_copia_u1"))).toBe(true);
  await page.evaluate(() => sair());
  expect(await page.evaluate(() => localStorage.getItem("metas_copia_u1"))).toBeNull();
});

test.describe("com o site guardado no aparelho", () => {
  test.use({ serviceWorkers: "allow" });
  test("o site abre mesmo com o aparelho totalmente offline", async ({ page, context }) => {
    await abrir(page);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload(); await page.locator(".card").first().waitFor();   // agora o site passa pelo service worker
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.evaluate(() => localStorage.setItem("__off", "1"));
    await page.reload();
    await expect(page.locator(".card")).toHaveCount(3);
    await expect(page.locator("#notice")).toContainText("Sem internet");
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain("Plex");
    await context.setOffline(false);
  });
});
