"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "src");
const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, "manifest.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const rules = JSON.parse(fs.readFileSync(path.join(sourceRoot, "rules", "blocklist.json"), "utf8"));
const filter = require(path.join(sourceRoot, "shared", "filter.js"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, "WebSafe");
assert.equal(packageJson.version, manifest.version, "package.json und Manifest müssen dieselbe Version verwenden");
assert.ok(manifest.permissions.includes("downloads"));
assert.ok(Array.isArray(rules) && rules.length >= 4);
const ids = rules.map((rule) => rule.id);
assert.equal(new Set(ids).size, ids.length, "Regel-IDs müssen eindeutig sein");

for (const file of [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_page,
  ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...(entry.css || [])]),
  ...manifest.declarative_net_request.rule_resources.map((entry) => entry.path),
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
  ...manifest.web_accessible_resources.flatMap((entry) => entry.resources)
]) {
  assert.ok(fs.existsSync(path.join(sourceRoot, file)), `Manifest-Datei fehlt: ${file}`);
}

for (const rule of rules) {
  const extensionPath = rule.action && rule.action.redirect && rule.action.redirect.extensionPath;
  if (extensionPath) {
    assert.ok(fs.existsSync(path.join(sourceRoot, extensionPath.replace(/^\//, ""))), `Umleitungsziel fehlt: ${extensionPath}`);
  }
}

function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  });
}

for (const htmlFile of filesBelow(path.join(sourceRoot, "pages")).filter((file) => file.endsWith(".html"))) {
  const html = fs.readFileSync(htmlFile, "utf8");
  const references = Array.from(html.matchAll(/(?:src|href)="([^"#]+)"/g), (match) => match[1]);
  for (const reference of references.filter((value) => !/^(?:https?:|data:)/.test(value))) {
    assert.ok(fs.existsSync(path.resolve(path.dirname(htmlFile), reference)), `HTML-Ressource fehlt: ${reference} in ${path.relative(root, htmlFile)}`);
  }
  assert.doesNotMatch(html, /<script[^>]+src="https?:/i, `Remote-Code ist nicht erlaubt: ${path.relative(root, htmlFile)}`);
}

for (const file of ["tests/manual/test-page.html", "tests/manual/test-page.css", "tests/manual/test-page.js"]) {
  assert.ok(fs.existsSync(path.join(root, file)), `Testdatei fehlt: ${file}`);
}

const ruleDomains = new Set(rules.find((rule) => rule.id === 1).condition.requestDomains);
for (const domain of filter.BLOCKED_DOMAINS) {
  assert.ok(ruleDomains.has(domain), `Domain fehlt in DNR-Regeln: ${domain}`);
}

console.log("validate-extension.js: Manifest und Regeln sind konsistent");
