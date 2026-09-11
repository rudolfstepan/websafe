(function () {
  "use strict";
  if (window.__webSafePageGuard) return;
  window.__webSafePageGuard = true;
  let popupProtection = true;
  let riskyDownloadProtection = true;

  const originalOpen = window.open.bind(window);
  const explicitPattern = /(^|[\W_])(porn(?:o|ography|ografie)?|xxx|hentai|rule34|gangbang|blowjob|camgirls?|sexcam|sexvideos?|nudes)([\W_]|$)/i;
  const riskyFilePattern = /\.(?:exe|msi|msix|scr|com|pif|cpl|dll|sys|bat|cmd|ps1|vbs|js|jar|lnk|hta|iso|img|dmg|pkg|deb|rpm|apk|crx|docm|xlsm|pptm)(?:[?#]|$)/i;

  function looksExplicit(value) {
    if (!value) return false;
    try { return explicitPattern.test(decodeURIComponent(String(value))); }
    catch (_) { return explicitPattern.test(String(value)); }
  }

  function isExternal(value) {
    if (!value) return true;
    try {
      const target = new URL(String(value), location.href);
      return /^https?:$/.test(target.protocol) && target.origin !== location.origin;
    } catch (_) {
      return true;
    }
  }

  window.addEventListener("websafe:config", function (event) {
    try {
      const config = JSON.parse(String(event.detail || "{}"));
      popupProtection = Boolean(config.enabled && config.blockPopups);
      riskyDownloadProtection = Boolean(config.enabled && config.blockRiskyDownloads);
    } catch (_) {}
  });

  window.open = function webSafeOpen(url, target, features) {
    const automatic = !navigator.userActivation || !navigator.userActivation.isActive;
    if (popupProtection && (automatic || isExternal(url) || looksExplicit(url))) {
      window.dispatchEvent(new CustomEvent("websafe:popup-blocked", { detail: String(url || "") }));
      return null;
    }
    return originalOpen(url, target, features);
  };

  document.addEventListener("click", function (event) {
    const link = event.target && event.target.closest && event.target.closest("a[href]");
    const declaredName = link && link.getAttribute("download") || "";
    const riskyDownload = link && (riskyFilePattern.test(declaredName) || riskyFilePattern.test(link.href));
    const automaticDownload = link && link.hasAttribute("download") && !event.isTrusted;
    if (riskyDownloadProtection && (riskyDownload || automaticDownload)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent("websafe:download-blocked", {
        detail: JSON.stringify({
          url: link.href,
          filename: declaredName,
          reason: riskyDownload
            ? "Dieser Dateityp kann Programme, Skripte oder aktive Inhalte ausführen."
            : "Die Seite hat versucht, ohne echten Benutzerklick einen Download zu starten."
        })
      }));
      return;
    }
    if (popupProtection && link && looksExplicit(link.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent("websafe:popup-blocked", { detail: link.href }));
    }
  }, true);
})();
