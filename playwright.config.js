const { defineConfig, devices } = require("@playwright/test");
module.exports = defineConfig({
  testDir: ".",
  testMatch: "*.spec.js",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { serviceWorkers: "block", baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure", launchOptions: process.env.CHROME ? { executablePath: process.env.CHROME } : {} },
  webServer: { command: "node servidor.js", url: "http://127.0.0.1:4173/index.html", reuseExistingServer: true },
  projects: [
    { name: "computador", testMatch: /(site|aovivo|offline)\.spec\.js/, use: { browserName: "chromium", viewport: { width: 1366, height: 800 } } },
    { name: "celular", testMatch: "celular.spec.js", use: { ...devices["iPhone 14"], browserName: "chromium" } }
  ]
});
