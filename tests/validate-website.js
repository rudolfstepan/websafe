"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const websiteRoot = path.join(root, "website");
const htmlFiles = fs.readdirSync(websiteRoot)
  .filter((file) => file.endsWith(".html"))
  .map((file) => path.join(websiteRoot, file));

assert.ok(htmlFiles.length >= 3, "Startseite, Datenschutzseite und 404-Seite werden erwartet");

for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, "utf8");
  const relativeName = path.relative(root, htmlFile);

  assert.match(html, /<html lang="de">/, `Sprachattribut fehlt: ${relativeName}`);
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

const css = fs.readFileSync(path.join(websiteRoot, "styles.css"), "utf8");
assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, "CSS-Klammern sind nicht ausgeglichen");

console.log("validate-website.js: statische Website ist konsistent");
