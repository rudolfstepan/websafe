"use strict";

const params = new URLSearchParams(location.search);
const originalUrl = params.get("url") || "";
const reason = params.get("reason") || "Die Seite enthält möglicherweise pornografische Inhalte.";
document.querySelector("#reason").textContent = reason;
document.querySelector("#blockedUrl").textContent = originalUrl || "Nicht verfügbar";
document.querySelector("#blockedUrl").title = originalUrl;

document.querySelector("#goBack").addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.replace("about:blank");
});
document.querySelector("#closeTab").addEventListener("click", () => window.close());
