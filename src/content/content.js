/* global WebSafeFilter */
(async function () {
  "use strict";

  const settings = await chrome.storage.local.get({
    enabled: true,
    blockPopups: true,
    scanContent: true,
    blockRiskyDownloads: true,
    blockScareware: true,
    allowlist: []
  });
  const currentHost = WebSafeFilter.normalizeHost(location.hostname);
  function syncPageGuard() {
    window.dispatchEvent(new CustomEvent("websafe:config", {
      detail: JSON.stringify({
        enabled: settings.enabled && !WebSafeFilter.isAllowlisted(currentHost, settings.allowlist),
        blockPopups: settings.blockPopups,
        blockRiskyDownloads: settings.blockRiskyDownloads
      })
    }));
  }

  syncPageGuard();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of ["enabled", "blockPopups", "scanContent", "blockRiskyDownloads", "blockScareware", "allowlist"]) {
      if (changes[key]) settings[key] = changes[key].newValue;
    }
    syncPageGuard();
  });
  if (!settings.enabled) return;
  if (WebSafeFilter.isAllowlisted(currentHost, settings.allowlist)) return;

  let blockRequested = false;
  let noticeTimer = null;

  function protectionActive() {
    return settings.enabled && !WebSafeFilter.isAllowlisted(currentHost, settings.allowlist);
  }

  function requestBlock(reason) {
    if (!protectionActive() || blockRequested || window.top !== window) return;
    blockRequested = true;
    chrome.runtime.sendMessage({ type: "BLOCK_PAGE", url: location.href, reason });
  }

  function showNotice(message) {
    if (window.top !== window || !document.documentElement) return;
    let notice = document.getElementById("websafe-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "websafe-notice";
      notice.setAttribute("role", "status");
      document.documentElement.appendChild(notice);
    }
    notice.textContent = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => notice.remove(), 3200);
  }

  const urlVerdict = WebSafeFilter.inspectUrl(location.href, settings.allowlist);
  if (urlVerdict.blocked) {
    requestBlock(urlVerdict.reason);
    return;
  }

  if (settings.blockPopups) {
    window.addEventListener("websafe:popup-blocked", () => {
      showNotice("WebSafe hat ein automatisches oder nicht jugendfreies Pop-up blockiert.");
    });
  }
  window.addEventListener("websafe:download-blocked", (event) => {
    showNotice("WebSafe hat einen automatisch ausgelösten Download gestoppt.");
    try {
      const detail = JSON.parse(String(event.detail || "{}"));
      chrome.runtime.sendMessage({
        type: "BLOCK_DOWNLOAD_ATTEMPT",
        url: detail.url || "",
        filename: detail.filename || "Unbekannte Datei",
        reason: detail.reason || "Riskanter Download verhindert"
      });
    } catch (_) {}
  });

  function elementUrl(element) {
    return element && (element.src || element.href || element.getAttribute && element.getAttribute("data-src") || "");
  }

  function isExternalUrl(value) {
    try {
      const url = new URL(value, location.href);
      return /^https?:$/.test(url.protocol) && url.origin !== location.origin;
    } catch (_) {
      return false;
    }
  }

  const explicitAdPattern = /(^|[\W_])(porn(?:o|ography|ografie)?|xxx|hentai|nudes?|naked|horny|camgirls?|live\s*sex|adult\s*chat|eroti[ck]|sex\s*(?:chat|cam|video)|milf)([\W_]|$)/i;
  const adMarkerPattern = /(^|[\s_-])(ads?|advert(?:ising|isement)?|sponsor(?:ed)?|promo(?:tion)?|popunder|interstitial)([\s_-]|$)/i;

  function collectElementSignals(node) {
    const media = Array.from(node.querySelectorAll("a[href], img[src], img[data-src], iframe[src], video[src], source[src]"), (element) => [
      elementUrl(element), element.getAttribute("alt"), element.getAttribute("title"), element.getAttribute("aria-label")
    ].filter(Boolean).join(" ")).slice(0, 120).join(" ");
    const background = getComputedStyle(node).backgroundImage || "";
    return [
      node.id, node.className, node.getAttribute("role"), node.getAttribute("aria-label"),
      node.getAttribute("title"), node.textContent, media, background
    ].filter((value) => typeof value === "string").join(" ").slice(0, 12000);
  }

  function neutralizeExplicitEmbeds(root) {
    if (!protectionActive() || !root || !root.querySelectorAll) return;
    const selector = "iframe[src], embed[src], object[data], video[src], source[src]";
    const candidates = [
      ...(root.matches && root.matches(selector) ? [root] : []),
      ...root.querySelectorAll(selector)
    ];
    for (const element of candidates) {
      const url = elementUrl(element) || element.getAttribute("data") || "";
      if (WebSafeFilter.inspectUrl(url, settings.allowlist).blocked) {
        element.remove();
        showNotice("WebSafe hat eingebetteten Erwachseneninhalt entfernt.");
      }
    }
  }

  function removeExplicitOverlay(node) {
    if (!protectionActive() || !(node instanceof Element)) return;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const zIndex = Number.parseInt(style.zIndex, 10) || 0;
    const overlayPosition = style.position === "fixed" ||
      (style.position === "absolute" && zIndex >= 100);
    const overlay = overlayPosition &&
      rect.width >= innerWidth * 0.35 && rect.height >= innerHeight * 0.25;
    if (!overlay) return;
    const sample = collectElementSignals(node);
    const verdict = WebSafeFilter.inspectText({ title: sample, body: sample, metadata: "", mediaUrls: sample });
    const threat = WebSafeFilter.inspectThreatText(sample);
    const identity = [node.id, node.className, node.getAttribute("aria-label")].filter(Boolean).join(" ");
    const externalFrame = Array.from(node.querySelectorAll("iframe[src], embed[src], object[data]"))
      .some((element) => isExternalUrl(elementUrl(element) || element.getAttribute("data")));
    const externalMedia = Array.from(node.querySelectorAll("img[src], a[href]"))
      .some((element) => isExternalUrl(elementUrl(element)));
    const structuredAd = adMarkerPattern.test(identity) && externalMedia;
    if (verdict.blocked || (settings.blockScareware && threat.blocked) || explicitAdPattern.test(sample) || WebSafeFilter.hasExplicitUrlTerm(sample) || externalFrame || structuredAd) {
      node.remove();
      showNotice("WebSafe hat ein verdächtiges Werbe-Overlay entfernt.");
    }
  }

  function scanOverlays(root) {
    if (!root || !root.querySelectorAll) return;
    const candidates = root === document
      ? Array.from(document.querySelectorAll("body > *, [role='dialog'], [class*='interstitial' i], [class*='popunder' i]"))
      : [root, ...Array.from(root.querySelectorAll("[role='dialog'], [style], [class*='ad-' i], [class*='advert' i], [class*='interstitial' i]"))];
    for (const candidate of candidates.slice(0, 500)) removeExplicitOverlay(candidate);
  }

  function scanDocument() {
    if (!protectionActive() || !settings.scanContent || !document.documentElement || blockRequested) return;
    neutralizeExplicitEmbeds(document);
    scanOverlays(document);
    const metadata = Array.from(document.querySelectorAll("meta[name='description'], meta[name='keywords'], meta[property='og:title'], meta[property='og:description']"))
      .map((meta) => meta.content || "").join(" ");
    const mediaUrls = Array.from(document.querySelectorAll("img[src], video[src], iframe[src], a[href]"))
      .slice(0, 350).map(elementUrl).join(" ");
    const verdict = WebSafeFilter.inspectText({
      title: document.title,
      metadata,
      body: document.body ? document.body.innerText : "",
      mediaUrls
    });
    if (verdict.blocked) requestBlock(verdict.reason);
    if (settings.blockScareware) {
      const pageText = [document.title, metadata, document.body ? document.body.innerText : ""].join(" ");
      const threat = WebSafeFilter.inspectThreatText(pageText);
      const hasUrgentContact = Boolean(document.querySelector("a[href^='tel:'], a[href*='notification' i]"));
      if (threat.score >= 3 && hasUrgentContact) requestBlock(threat.reason);
    }
  }

  const start = () => {
    scanDocument();
    const observer = new MutationObserver((mutations) => {
      if (!protectionActive() || !settings.scanContent) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            neutralizeExplicitEmbeds(node);
            scanOverlays(node);
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(scanDocument, 1200);
    setTimeout(scanDocument, 3500);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
