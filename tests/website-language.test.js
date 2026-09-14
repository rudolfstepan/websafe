"use strict";

// Run with Playwright installed, or set PLAYWRIGHT_MODULE to its local module path.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../website");
const server = http.createServer((request, response) => {
  const filename = path.resolve(root, "." + new URL(request.url, "http://localhost").pathname);
  if (!filename.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader("Content-Type", ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".png": "image/png" })[path.extname(filename)] || "application/octet-stream");
    response.end(fs.readFileSync(filename));
  } catch { response.writeHead(404).end(); }
});

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [locale, expected] of [["de-AT", "de"], ["de-DE", "de"], ["en-GB", "en"], ["fr-FR", "en"]]) {
      const context = await browser.newContext({ locale });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      for (const file of ["index.html", "privacy.html", "404.html"]) {
        await page.goto(`${base}/${file}`);
        assert.equal(await page.locator("html").getAttribute("lang"), expected);
        assert.equal(await page.locator(`[data-language="${expected}"]`).getAttribute("aria-pressed"), "true");
        const title = await page.title();
        const original = await page.locator("body").innerText();
        await page.locator('[data-language="de"]').click();
        assert.equal(await page.locator("html").getAttribute("lang"), "de");
        await page.locator('[data-language="en"]').click();
        assert.equal(await page.locator("html").getAttribute("lang"), "en");
        await page.locator(`[data-language="${expected}"]`).click();
        assert.equal(await page.title(), title);
        assert.equal(await page.locator("body").innerText(), original);
        for (const width of [360, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${file} ${expected}: overflow at ${width}px`);
          assert.ok(await page.locator('[data-language-switch]').isVisible());
        }
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    const context = await browser.newContext({ locale: "de-AT" });
    const page = await context.newPage();
    await page.goto(`${base}/index.html`);
    await page.locator('[data-language="en"]').click();
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    await page.goto(`${base}/privacy.html`);
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    await page.evaluate(() => localStorage.setItem("websafe-language", "invalid"));
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("lang"), "de");
    await context.close();

    const blocked = await browser.newContext({ locale: "fr-FR" });
    await blocked.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage disabled"); } });
    });
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(`${base}/index.html`);
    assert.equal(await blockedPage.locator("html").getAttribute("lang"), "en");
    await blockedPage.locator('[data-language="de"]').click();
    assert.equal(await blockedPage.locator("html").getAttribute("lang"), "de");
    assert.equal(await blockedPage.locator("h1").innerText(), "Sicher surfen.\nRuhig bleiben.");
    await blockedPage.setViewportSize({ width: 360, height: 800 });
    await blockedPage.locator(".nav-toggle").click();
    assert.equal(await blockedPage.locator(".nav-toggle").getAttribute("aria-expanded"), "true");
    await blockedPage.locator('[data-language="en"]').click();
    await blockedPage.locator('.nav-links a[href="#funktionen"]').click();
    assert.equal(await blockedPage.locator(".nav-toggle").getAttribute("aria-expanded"), "false");
    await blockedPage.locator(".faq-list summary").first().click();
    await blockedPage.locator('[data-language="de"]').click();
    assert.equal(await blockedPage.locator(".faq-list details[open]").count(), 1);
    const installLinks = await blockedPage.locator('a.button[href*="chromewebstore.google.com"]').evaluateAll(links => links.map(link => link.href));
    assert.equal(installLinks.length, 3);
    assert.ok(installLinks.every(link => link === "https://chromewebstore.google.com/detail/mkmceahekngdjiplgonjfjkgldblimjg?utm_source=item-share-cb"));
    assert.equal(await blockedPage.locator("[data-extension-version]").innerText(), require("../src/manifest.json").version);
    await blocked.close();

    const noJS = await browser.newContext({ javaScriptEnabled: false, locale: "de-AT" });
    const fallback = await noJS.newPage();
    for (const file of ["index.html", "privacy.html", "404.html"]) {
      await fallback.goto(`${base}/${file}`);
      assert.equal(await fallback.locator("html").getAttribute("lang"), "en");
      assert.ok(await fallback.locator("h1").isVisible());
      assert.equal(await fallback.locator("[data-language-switch]").isVisible(), false);
    }
    await noJS.close();
    console.log("website-language.test.js: language detection, switching, persistence, fallbacks and responsive pages passed");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
