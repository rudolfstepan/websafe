/* global WebSafeFilter */
"use strict";

const $ = (selector) => document.querySelector(selector);
let state = null;
let currentHost = "";

function updateView() {
  if (!state) return;
  $("#enabled").checked = state.enabled;
  $("#blockPopups").checked = state.blockPopups;
  $("#scanContent").checked = state.scanContent;
  $("#strictSearch").checked = state.strictSearch;
  $("#blockRiskyDownloads").checked = state.blockRiskyDownloads;
  $("#blockScareware").checked = state.blockScareware;
  $("#blockedCount").textContent = Number(state.blockedCount || 0).toLocaleString("de-DE");
  $("#blockedDownloadCount").textContent = Number(state.blockedDownloadCount || 0).toLocaleString("de-DE");
  $("#statusCard").classList.toggle("paused", !state.enabled);
  $("#statusTitle").textContent = state.enabled ? "Schutz aktiv" : "Schutz pausiert";
  $("#statusText").textContent = state.enabled
    ? "Adult-Inhalte und Pop-ups werden blockiert."
    : "Webseiten werden derzeit nicht gefiltert.";
  const allowed = WebSafeFilter.isAllowlisted(currentHost, state.allowlist);
  $("#toggleSite").textContent = allowed ? "Ausnahme entfernen" : "Ausnahme";
  $("#toggleSite").disabled = !currentHost;
}

chrome.runtime.sendMessage({ type: "GET_TAB_STATE" }, (response) => {
  if (!response) return;
  state = response.settings;
  try { currentHost = WebSafeFilter.normalizeHost(new URL(response.tab.url).hostname); } catch (_) { currentHost = ""; }
  $("#currentHost").textContent = currentHost || "Interne Seite";
  updateView();
});

for (const key of ["enabled", "blockPopups", "scanContent", "strictSearch", "blockRiskyDownloads", "blockScareware"]) {
  $("#" + key).addEventListener("change", async (event) => {
    state[key] = event.target.checked;
    await chrome.storage.local.set({ [key]: state[key] });
    updateView();
  });
}

$("#toggleSite").addEventListener("click", async () => {
  if (!currentHost) return;
  const allowlist = new Set(state.allowlist || []);
  if (WebSafeFilter.isAllowlisted(currentHost, Array.from(allowlist))) {
    for (const entry of allowlist) {
      if (WebSafeFilter.normalizeHost(entry) === currentHost) allowlist.delete(entry);
    }
  } else {
    allowlist.add(currentHost);
  }
  state.allowlist = Array.from(allowlist).sort();
  await chrome.storage.local.set({ allowlist: state.allowlist });
  updateView();
});

$("#openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
