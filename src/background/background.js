/* global WebSafeFilter */
"use strict";

importScripts("../shared/filter.js");

const DEFAULTS = Object.freeze({
  enabled: true,
  blockPopups: true,
  scanContent: true,
  strictSearch: true,
  blockRiskyDownloads: true,
  blockScareware: true,
  allowlist: [],
  blockedCount: 0,
  blockedDownloadCount: 0,
  lastBlocked: null
});

const ALL_RESOURCE_TYPES = [
  "main_frame", "sub_frame", "stylesheet", "script", "image", "font",
  "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket",
  "webtransport", "webbundle", "other"
];

async function getSettings() {
  return chrome.storage.local.get(DEFAULTS);
}

async function initialize() {
  const existing = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const missing = {};
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (existing[key] === undefined) missing[key] = value;
  }
  if (Object.keys(missing).length) await chrome.storage.local.set(missing);
  const settings = { ...DEFAULTS, ...existing, ...missing };
  await applyProtectionState(settings.enabled);
  await rebuildAllowRules(settings.allowlist);
  await updateBadge(settings);
}

async function applyProtectionState(enabled) {
  const update = enabled
    ? { enableRulesetIds: ["blocklist"] }
    : { disableRulesetIds: ["blocklist"] };
  await chrome.declarativeNetRequest.updateEnabledRulesets(update);
}

async function rebuildAllowRules(allowlist) {
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = oldRules.filter((rule) => rule.id >= 10000).map((rule) => rule.id);
  const cleanDomains = Array.from(new Set((allowlist || [])
    .map(WebSafeFilter.normalizeHost)
    .filter(Boolean)))
    .slice(0, 500);
  const addRules = cleanDomains.map((domain, index) => ({
    id: 10000 + index,
    priority: 100,
    action: { type: "allow" },
    condition: { requestDomains: [domain], resourceTypes: ALL_RESOURCE_TYPES }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

async function updateBadge(settings) {
  await chrome.action.setBadgeBackgroundColor({ color: settings.enabled ? "#168A64" : "#68737D" });
  await chrome.action.setBadgeText({ text: settings.enabled ? "✓" : "" });
  await chrome.action.setTitle({ title: settings.enabled ? "WebSafe ist aktiv" : "WebSafe ist pausiert" });
}

function blockedPageUrl(originalUrl, reason) {
  const params = new URLSearchParams({ url: originalUrl || "", reason: reason || "Inhalt blockiert" });
  return chrome.runtime.getURL("pages/blocked/blocked.html") + "?" + params.toString();
}

async function recordBlock(url, reason) {
  const settings = await getSettings();
  await chrome.storage.local.set({
    blockedCount: Number(settings.blockedCount || 0) + 1,
    lastBlocked: { url, reason, time: Date.now() }
  });
}

const handledDownloadIds = new Set();

function downloadWarningUrl(item, verdict) {
  let source = "Unbekannte Quelle";
  for (const candidate of [item.referrer, item.finalUrl, item.url]) {
    try {
      const hostname = new URL(candidate).hostname;
      if (hostname) { source = hostname; break; }
    } catch (_) {}
  }
  const params = new URLSearchParams({
    filename: verdict.filename || "Unbekannte Datei",
    source,
    reason: verdict.reason,
    category: verdict.category
  });
  return chrome.runtime.getURL("pages/download-blocked/download-blocked.html") + "?" + params.toString();
}

async function recordDownloadBlock(item, verdict) {
  const settings = await getSettings();
  await chrome.storage.local.set({
    blockedDownloadCount: Number(settings.blockedDownloadCount || 0) + 1,
    lastBlockedDownload: {
      filename: verdict.filename,
      source: item.finalUrl || item.url || item.referrer || "",
      reason: verdict.reason,
      time: Date.now()
    }
  });
  try { await chrome.tabs.create({ url: downloadWarningUrl(item, verdict), active: true }); } catch (_) {}
}

async function blockDownload(item, verdict) {
  if (!item || handledDownloadIds.has(item.id)) return;
  const settings = await getSettings();
  if (!settings.enabled || !settings.blockRiskyDownloads) return;
  let sourceHost = "";
  try { sourceHost = new URL(item.referrer || item.finalUrl || item.url).hostname; } catch (_) {}
  if (WebSafeFilter.isAllowlisted(sourceHost, settings.allowlist)) return;
  if (Number.isInteger(item.tabId) && item.tabId >= 0) {
    try {
      const sourceTab = await chrome.tabs.get(item.tabId);
      const tabHost = new URL(sourceTab.url).hostname;
      if (WebSafeFilter.isAllowlisted(tabHost, settings.allowlist)) return;
    } catch (_) {}
  }
  if (handledDownloadIds.has(item.id)) return;
  handledDownloadIds.add(item.id);
  try { await chrome.downloads.cancel(item.id); } catch (_) {}
  await recordDownloadBlock(item, verdict);
}

async function inspectNewDownload(item) {
  const settings = await getSettings();
  if (!settings.enabled || !settings.blockRiskyDownloads) return;
  const verdict = WebSafeFilter.inspectDownload(item);
  if (verdict.blocked) await blockDownload(item, verdict);
}

async function blockTab(tabId, url, reason) {
  if (!Number.isInteger(tabId) || String(url).startsWith(chrome.runtime.getURL(""))) return;
  const settings = await getSettings();
  if (!settings.enabled) return;
  let host = "";
  try { host = new URL(url).hostname; } catch (_) {}
  if (WebSafeFilter.isAllowlisted(host, settings.allowlist)) return;
  await recordBlock(url, reason);
  try {
    await chrome.tabs.update(tabId, { url: blockedPageUrl(url, reason) });
  } catch (_) {}
}

function enforceSafeSearch(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch (_) { return null; }
  const host = WebSafeFilter.normalizeHost(url.hostname);
  let changed = false;
  const set = (key, value) => {
    if (url.searchParams.get(key) !== value) {
      url.searchParams.set(key, value);
      changed = true;
    }
  };

  if ((host === "google.com" || host.endsWith(".google.com") || /(^|\.)google\.[a-z.]+$/.test(host)) && url.pathname === "/search") {
    set("safe", "active");
  } else if ((host === "bing.com" || host.endsWith(".bing.com")) && url.pathname.startsWith("/search")) {
    set("adlt", "strict");
  } else if ((host === "duckduckgo.com" || host.endsWith(".duckduckgo.com")) && url.searchParams.has("q")) {
    set("kp", "1");
  } else if ((host === "search.brave.com" || host.endsWith(".search.brave.com")) && url.pathname.startsWith("/search")) {
    set("safesearch", "strict");
  } else if ((host === "search.yahoo.com" || host.endsWith(".search.yahoo.com")) && url.pathname.startsWith("/search")) {
    set("vm", "r");
  }
  return changed ? url.href : null;
}

chrome.runtime.onInstalled.addListener(() => initialize().catch(console.error));
chrome.runtime.onStartup.addListener(() => initialize().catch(console.error));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;
  if (message.type === "BLOCK_PAGE") {
    const url = String(message.url || sender.tab && sender.tab.url || "").slice(0, 8000);
    const reason = String(message.reason || "Pornografischer Inhalt erkannt").slice(0, 500);
    blockTab(sender.tab && sender.tab.id, url, reason).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "BLOCK_DOWNLOAD_ATTEMPT") {
    (async () => {
      const settings = await getSettings();
      if (!settings.enabled || !settings.blockRiskyDownloads) return;
      const item = {
        filename: String(message.filename || "Unbekannte Datei").slice(0, 1000),
        url: String(message.url || "").slice(0, 8000),
        referrer: sender.tab && sender.tab.url || ""
      };
      let sourceHost = "";
      try { sourceHost = new URL(item.referrer).hostname; } catch (_) {}
      if (WebSafeFilter.isAllowlisted(sourceHost, settings.allowlist)) return;
      const verdict = WebSafeFilter.inspectDownload(item);
      if (!verdict.blocked) {
        verdict.blocked = true;
        verdict.filename = item.filename;
        verdict.category = "automatic-download";
        verdict.reason = String(message.reason || "Riskanter Download verhindert").slice(0, 500);
      }
      await recordDownloadBlock(item, verdict);
    })().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "GET_TAB_STATE") {
    Promise.all([getSettings(), chrome.tabs.query({ active: true, currentWindow: true })])
      .then(([settings, tabs]) => sendResponse({ settings, tab: tabs[0] || null }));
    return true;
  }
  return false;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.enabled) {
    applyProtectionState(Boolean(changes.enabled.newValue)).catch(console.error);
    getSettings().then(updateBadge).catch(console.error);
  }
  if (changes.allowlist) rebuildAllowRules(changes.allowlist.newValue || []).catch(console.error);
});

chrome.downloads.onCreated.addListener((item) => {
  inspectNewDownload(item).catch(console.error);
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  inspectNewDownload(item)
    .catch(console.error)
    .finally(() => suggest());
  return true;
});

chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.danger || !WebSafeFilter.DANGEROUS_VERDICTS.includes(delta.danger.current)) return;
  const items = await chrome.downloads.search({ id: delta.id });
  const item = items[0];
  if (!item || item.state !== "in_progress") return;
  const verdict = WebSafeFilter.inspectDownload(item);
  if (verdict.blocked) await blockDownload(item, verdict);
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0 || !/^https?:/i.test(details.url)) return;
  const settings = await getSettings();
  if (!settings.enabled) return;
  const verdict = WebSafeFilter.inspectUrl(details.url, settings.allowlist);
  if (verdict.blocked) {
    await blockTab(details.tabId, details.url, verdict.reason);
    return;
  }
  if (settings.strictSearch) {
    const safeUrl = enforceSafeSearch(details.url);
    if (safeUrl) {
      try { await chrome.tabs.update(details.tabId, { url: safeUrl }); } catch (_) {}
    }
  }
});
