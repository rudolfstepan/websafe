"use strict";

const assert = require("node:assert/strict");
const filter = require("../../src/shared/filter.js");

assert.equal(filter.inspectUrl("https://www.pornhub.com/view", []).blocked, true);
assert.equal(filter.inspectUrl("https://cdn.example.org/files/free-porn-video.mp4", []).blocked, true);
assert.equal(filter.inspectUrl("https://www.essex.ac.uk/", []).blocked, false);
assert.equal(filter.inspectUrl("https://example.org/article/adult-education", []).blocked, false);
assert.equal(filter.inspectUrl("https://pornhub.com/", ["pornhub.com"]).blocked, false);
assert.equal(filter.isAllowlisted("sub.example.org", ["example.org"]), true);

const adultPage = filter.inspectText({
  title: "Free porn videos and XXX videos",
  metadata: "Watch porn video and live sex cams",
  body: "porn porno xxx hentai porn porno xxx hentai",
  mediaUrls: "https://media.example/porn/video.mp4"
});
assert.equal(adultPage.blocked, true);

const newsPage = filter.inspectText({
  title: "Debatte über Jugendschutz im Internet",
  metadata: "Ein Bericht über Medienkompetenz",
  body: "Der Artikel erwähnt Pornografie einmal im Rahmen einer politischen Debatte.",
  mediaUrls: "https://news.example/header.jpg"
});
assert.equal(newsPage.blocked, false);

assert.equal(filter.inspectDownload({ filename: "setup.exe", danger: "safe" }).blocked, true);
assert.equal(filter.inspectDownload({ filename: "Rechnung.pdf.exe", danger: "safe" }).category, "double-extension");
assert.equal(filter.inspectDownload({ filename: "fotos.zip", danger: "safe", mime: "application/zip" }).blocked, false);
assert.equal(filter.inspectDownload({ filename: "handbuch.pdf", danger: "safe", mime: "application/pdf" }).blocked, false);
assert.equal(filter.inspectDownload({ filename: "archiv.zip", danger: "url" }).category, "browser-verdict");
assert.equal(filter.inspectDownload({ filename: "datei.bin", danger: "safe", mime: "application/x-msdownload" }).category, "risky-mime");
assert.equal(filter.inspectDownload({ filename: "handbuch.pdf", finalUrl: "http://downloads.example/handbuch.pdf", danger: "safe" }).category, "insecure-transport");
assert.equal(filter.inspectDownload({ filename: "test.pdf", finalUrl: "http://localhost/test.pdf", danger: "safe" }).blocked, false);

const fakeVirusWarning = filter.inspectThreatText("Critical security alert! Virus detected. Your computer is infected. Call Microsoft support now.");
assert.equal(fakeVirusWarning.blocked, true);
assert.equal(filter.inspectThreatText("Ein sachlicher Artikel über sicheres Surfen und Virenschutz.").blocked, false);

console.log("filter.test.js: alle Tests erfolgreich");
