"use strict";

const params = new URLSearchParams(location.search);
document.querySelector("#filename").textContent = params.get("filename") || "Unbekannte Datei";
document.querySelector("#source").textContent = params.get("source") || "Unbekannte Quelle";
document.querySelector("#reason").textContent = params.get("reason") || "Dieser Dateityp kann aktive oder schädliche Inhalte ausführen.";
document.querySelector("#closeTab").addEventListener("click", () => window.close());
document.querySelector("#openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
