/* global WebSafeFilter */
"use strict";

let allowlist = [];
const list = document.querySelector("#allowlist");
const empty = document.querySelector("#emptyState");
const input = document.querySelector("#domain");
const error = document.querySelector("#formError");

function render() {
  list.textContent = "";
  empty.hidden = allowlist.length > 0;
  for (const domain of allowlist) {
    const item = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = domain;
    const button = document.createElement("button");
    button.className = "remove";
    button.type = "button";
    button.textContent = "Entfernen";
    button.addEventListener("click", async () => {
      allowlist = allowlist.filter((entry) => entry !== domain);
      await chrome.storage.local.set({ allowlist });
      render();
    });
    item.append(code, button);
    list.appendChild(item);
  }
}

chrome.storage.local.get({ allowlist: [] }).then((data) => {
  allowlist = data.allowlist;
  render();
});

document.querySelector("#allowForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "";
  const domain = WebSafeFilter.normalizeHost(input.value);
  if (!domain || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)) {
    error.textContent = "Bitte gib eine gültige Domain ein.";
    return;
  }
  if (!allowlist.includes(domain)) allowlist = [...allowlist, domain].sort();
  await chrome.storage.local.set({ allowlist });
  input.value = "";
  render();
});
