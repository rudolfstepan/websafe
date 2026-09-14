"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const websiteRoot = path.join(root, "website");
const htmlFiles = fs.readdirSync(websiteRoot)
  .filter((file) => file.endsWith(".html"))
  .map((file) => path.join(websiteRoot, file));

assert.ok(htmlFiles.length >= 3, "Startseite, Datenschutzseite und 404-Seite werden erwartet");

const translationContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(websiteRoot, "translations.js"), "utf8"), translationContext);
const translations = translationContext.window.websafeTranslations;
const untranslatedNames = new Set([
  "WebSafe", "Installation", "FAQ", "DE", "EN", "Open Source", "download-portal.example",
  "MV3", "MIT", "URL", "DOM", "FILE", "Issues", "WebSafe Contributors.", "chrome.storage.local",
  "Choose language", "Deutsch", "English"
]);
for (const [english, german] of Object.entries(translations)) {
  assert.ok(english.trim() && typeof german === "string" && german.trim(), "Leere Übersetzung");
}
function checkTranslation(text, file) {
  const decoded = text.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
  if (!/[a-zA-Z]/.test(decoded) || untranslatedNames.has(decoded)) return;
  assert.ok(Object.hasOwn(translations, decoded), `Übersetzung fehlt in ${file}: ${decoded}`);
}

for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, "utf8");
  const relativeName = path.relative(root, htmlFile);

  assert.match(html, /data-language="de"/, `Deutscher Sprachumschalter fehlt: ${relativeName}`);
  assert.match(html, /data-language="en"/, `Englischer Sprachumschalter fehlt: ${relativeName}`);
  assert.match(html, /src="translations.js" defer[\s\S]*src="i18n.js" defer/, `Sprachskripte fehlen: ${relativeName}`);
  for (const [, text] of html.matchAll(/>([^<>]+)</g)) checkTranslation(text, relativeName);
  for (const [, text] of html.matchAll(/(?:aria-label|alt)="([^"]+)"/g)) checkTranslation(text, relativeName);
  for (const [, text] of html.matchAll(/<meta (?:name="description"|property="og:(?:title|description)") content="([^"]+)"/g)) checkTranslation(text, relativeName);

  assert.match(html, /<html lang="en">/, `Sprachattribut fehlt: ${relativeName}`);
  assert.match(html, /<meta name="viewport"/, `Viewport fehlt: ${relativeName}`);
  assert.match(html, /<title>[^<]+<\/title>/, `Titel fehlt: ${relativeName}`);
  assert.doesNotMatch(html, /<script(?![^>]+src=)/i, `Inline-Skript gefunden: ${relativeName}`);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/i, `Remote-Skript gefunden: ${relativeName}`);

  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const reference = match[1];
    if (reference.startsWith("#")) {
      if (reference.length > 1) assert.match(html, new RegExp(`id=["']${reference.slice(1)}["']`), `Sprungziel fehlt: ${reference}`);
      continue;
    }
    if (/^(?:https?:|mailto:|tel:)/.test(reference)) continue;
    const localPath = path.resolve(path.dirname(htmlFile), reference.split(/[?#]/)[0]);
    assert.ok(fs.existsSync(localPath), `Ressource fehlt: ${reference} in ${relativeName}`);
  }

  for (const link of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)) {
    assert.match(link[0], /rel="[^"]*noopener[^"]*"/i, `noopener fehlt: ${relativeName}`);
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "src", "manifest.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const homepage = fs.readFileSync(path.join(websiteRoot, "index.html"), "utf8");
const websiteVersions = [...homepage.matchAll(/<span data-extension-version>([^<]+)<\/span>/g)];
assert.ok(websiteVersions.length > 0, "Die Website muss die Erweiterungsversion anzeigen");
for (const [, version] of websiteVersions) {
  assert.equal(version, manifest.version, "Website und Store-Paket (src/manifest.json) müssen dieselbe Version verwenden");
  assert.equal(version, packageJson.version, "Website und package.json müssen dieselbe Version verwenden");
}
const css = fs.readFileSync(path.join(websiteRoot, "styles.css"), "utf8");
assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, "CSS-Klammern sind nicht ausgeglichen");

console.log("validate-website.js: statische Website ist konsistent");
