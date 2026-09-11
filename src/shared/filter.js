(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WebSafeFilter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BLOCKED_DOMAINS = Object.freeze([
    "4tube.com", "8muses.com", "adultfriendfinder.com", "beeg.com",
    "brazzers.com", "cam4.com", "chaturbate.com", "clips4sale.com",
    "efukt.com", "eporner.com", "erome.com", "fapello.com",
    "fapster.xxx", "hclips.com", "hentaihaven.xxx", "hqporner.com",
    "imagefap.com", "ixxx.com", "livejasmin.com", "literotica.com",
    "manyvids.com", "motherless.com", "nhentai.net", "nudevista.com",
    "onlyfans.com", "porn.com", "porn300.com", "pornhat.com",
    "pornhub.com", "pornpics.com", "pornrox.com", "pornwild.com",
    "redgifs.com", "redtube.com", "rule34.xxx", "sex.com",
    "spankbang.com", "stripchat.com", "thumbzilla.com", "tnaflix.com",
    "tube8.com", "txxx.com", "upornia.com", "xhamster.com",
    "xnxx.com", "xvideos.com", "youporn.com", "yuvutu.com"
  ]);

  const URL_TERMS = Object.freeze([
    "porn", "porno", "pornografie", "xxx", "hentai", "rule34",
    "gangbang", "blowjob", "camgirl", "camgirls", "sexcam", "sexvideo",
    "nudes", "onlyfans"
  ]);

  const STRONG_TERMS = Object.freeze([
    "hardcore porn", "free porn", "porn videos", "porn video", "pornofilme",
    "porno videos", "porno video", "xxx videos", "adult videos", "live sex cams",
    "nude cam girls", "hentai porn", "watch porn", "sex videos", "sexfilme"
  ]);

  const MEDIUM_TERMS = Object.freeze([
    "porn", "porno", "pornography", "pornografie", "xxx", "hentai",
    "gangbang", "blowjob", "camgirl", "camgirls", "sexcam", "nudes",
    "explicit sex", "adult entertainment", "erotic videos"
  ]);

  const RISKY_EXTENSIONS = Object.freeze([
    "exe", "msi", "msp", "msix", "msixbundle", "appx", "appxbundle",
    "scr", "com", "pif", "cpl", "dll", "sys", "drv", "gadget", "application",
    "bat", "cmd", "ps1", "psm1", "psd1", "vbs", "vbe", "js", "jse",
    "wsf", "wsh", "hta", "reg", "inf", "ins", "isp",
    "lnk", "scf", "url", "chm", "jar", "jnlp", "apk", "crx", "xpi",
    "iso", "img", "vhd", "vhdx", "cab", "dmg", "pkg", "deb", "rpm", "appimage",
    "docm", "dotm", "xlsm", "xltm", "xlam", "pptm", "potm", "ppam", "sldm"
  ]);

  const DANGEROUS_VERDICTS = Object.freeze([
    "file", "url", "content", "uncommon", "host", "unwanted",
    "accountCompromise", "sensitiveContentBlock", "blockedScanFailed",
    "deepScannedOpenedDangerous"
  ]);

  const RISKY_MIME_TYPES = Object.freeze([
    "application/x-msdownload", "application/x-msdos-program",
    "application/x-executable", "application/x-sh", "application/x-bat",
    "application/java-archive", "application/vnd.microsoft.portable-executable"
  ]);

  function normalizeHost(value) {
    let host = String(value || "").trim().toLowerCase();
    try {
      if (host.includes("://")) host = new URL(host).hostname;
    } catch (_) {}
    host = host.replace(/^www\./, "").replace(/^\.+|\.+$/g, "");
    return host;
  }

  function hostMatches(host, domain) {
    return host === domain || host.endsWith("." + domain);
  }

  function isAllowlisted(host, allowlist) {
    const normalized = normalizeHost(host);
    return (allowlist || []).some((entry) => hostMatches(normalized, normalizeHost(entry)));
  }

  function hasBlockedDomain(host) {
    const normalized = normalizeHost(host);
    return BLOCKED_DOMAINS.some((domain) => hostMatches(normalized, domain));
  }

  function decodedUrl(url) {
    try {
      return decodeURIComponent(String(url)).toLowerCase();
    } catch (_) {
      return String(url || "").toLowerCase();
    }
  }

  function hasExplicitUrlTerm(url) {
    const value = decodedUrl(url).replace(/%2f|%3f|%26|%3d/g, "/");
    return URL_TERMS.some((term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp("(^|[\\W_])" + escaped + "([\\W_]|$)", "i").test(value);
    });
  }

  function inspectUrl(url, allowlist) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (_) {
      return { blocked: false, reason: "" };
    }
    if (!/^https?:$/.test(parsed.protocol) || isAllowlisted(parsed.hostname, allowlist)) {
      return { blocked: false, reason: "" };
    }
    if (hasBlockedDomain(parsed.hostname)) {
      return { blocked: true, reason: "Diese Domain ist als Erwachsenenangebot eingestuft." };
    }
    if (hasExplicitUrlTerm(parsed.href)) {
      return { blocked: true, reason: "Die Adresse enthält einen eindeutig pornografischen Begriff." };
    }
    return { blocked: false, reason: "" };
  }

  function occurrences(text, term) {
    let count = 0;
    let from = 0;
    while ((from = text.indexOf(term, from)) !== -1) {
      count += 1;
      from += term.length;
      if (count >= 8) break;
    }
    return count;
  }

  function inspectText(input) {
    const title = String(input && input.title || "").toLowerCase().slice(0, 500);
    const metadata = String(input && input.metadata || "").toLowerCase().slice(0, 3000);
    const body = String(input && input.body || "").toLowerCase().slice(0, 30000);
    const mediaUrls = String(input && input.mediaUrls || "").toLowerCase().slice(0, 15000);
    let score = 0;
    const matches = new Set();

    for (const term of STRONG_TERMS) {
      if (title.includes(term)) { score += 10; matches.add(term); }
      if (metadata.includes(term)) { score += 8; matches.add(term); }
      const bodyCount = occurrences(body, term);
      if (bodyCount) { score += Math.min(12, bodyCount * 4); matches.add(term); }
    }
    for (const term of MEDIUM_TERMS) {
      if (title.includes(term)) { score += 5; matches.add(term); }
      if (metadata.includes(term)) { score += 4; matches.add(term); }
      const bodyCount = occurrences(body, term);
      if (bodyCount >= 2) { score += Math.min(8, bodyCount * 2); matches.add(term); }
      if (mediaUrls.includes(term)) { score += 4; matches.add(term); }
    }

    return {
      blocked: score >= 12 && matches.size >= 2,
      score,
      matches: Array.from(matches).slice(0, 5),
      reason: "Die Seite wurde anhand mehrerer eindeutiger Inhaltssignale gesperrt."
    };
  }

  function filenameFrom(value) {
    let name = String(value || "");
    try {
      const url = new URL(name);
      name = url.pathname;
    } catch (_) {}
    try { name = decodeURIComponent(name); } catch (_) {}
    return name.replace(/\\/g, "/").split("/").pop().split(/[?#]/)[0].trim();
  }

  function inspectDownload(input) {
    const item = input || {};
    const candidates = [item.filename, item.finalUrl, item.url]
      .map(filenameFrom).filter(Boolean);
    const riskyPattern = new RegExp("\\.(" + RISKY_EXTENSIONS.join("|") + ")\\s*$", "i");
    const disguisePattern = new RegExp("\\.(pdf|txt|rtf|docx?|xlsx?|pptx?|jpe?g|png|gif|webp|mp3|mp4|zip|rar|7z)\\.(" + RISKY_EXTENSIONS.join("|") + ")$", "i");

    try {
      const endpoint = new URL(item.finalUrl || item.url);
      const local = endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1" || endpoint.hostname === "[::1]";
      if (endpoint.protocol === "http:" && !local) {
        return { blocked: true, category: "insecure-transport", filename: candidates[0] || "Unbekannte Datei", reason: "Der Download wurde unverschlüsselt über HTTP übertragen und könnte unterwegs verändert werden." };
      }
    } catch (_) {}

    for (const name of candidates) {
      if (disguisePattern.test(name)) {
        return { blocked: true, category: "double-extension", filename: name, reason: "Die Datei tarnt ihre ausführbare Endung hinter einer harmlosen Endung." };
      }
      if (riskyPattern.test(name)) {
        return { blocked: true, category: "risky-extension", filename: name, reason: "Dieser Dateityp kann Programme, Skripte oder aktive Inhalte ausführen." };
      }
    }

    if (DANGEROUS_VERDICTS.includes(item.danger)) {
      return { blocked: true, category: "browser-verdict", filename: candidates[0] || "Unbekannte Datei", reason: "Brave hat diesen Download als verdächtig oder gefährlich eingestuft." };
    }
    if (RISKY_MIME_TYPES.includes(String(item.mime || "").toLowerCase())) {
      return { blocked: true, category: "risky-mime", filename: candidates[0] || "Unbekannte Datei", reason: "Der gemeldete Dateityp kann ausführbaren Inhalt enthalten." };
    }
    return { blocked: false, category: "", filename: candidates[0] || "", reason: "" };
  }

  function inspectThreatText(input) {
    const value = String(input || "").toLowerCase().slice(0, 20000);
    const patterns = [
      /(?:your|the) (?:computer|device|pc) (?:is|has been) (?:infected|at risk)/,
      /(?:virus|malware|trojan) (?:detected|found)/,
      /(?:computer|gerät|pc) (?:ist|wurde) (?:infiziert|gefährdet)/,
      /(?:virus|schadsoftware|trojaner) (?:erkannt|gefunden)/,
      /click (?:allow|here) to (?:continue|download|remove)/,
      /klicke? (?:auf )?[„\"]?(?:zulassen|erlauben)[“\"]?,? um fortzufahren/,
      /call (?:microsoft|apple|support) (?:now|immediately)/,
      /rufen sie (?:jetzt|sofort) (?:den )?(?:microsoft|apple|support)/,
      /(?:critical|kritische) (?:security |sicherheits)?(?:alert|warnung)/
    ];
    const matches = patterns.filter((pattern) => pattern.test(value)).length;
    return {
      blocked: matches >= 2,
      score: matches,
      reason: "WebSafe hat typische Merkmale einer gefälschten Viren- oder Supportwarnung erkannt."
    };
  }

  return {
    BLOCKED_DOMAINS,
    URL_TERMS,
    RISKY_EXTENSIONS,
    DANGEROUS_VERDICTS,
    normalizeHost,
    isAllowlisted,
    hasBlockedDomain,
    hasExplicitUrlTerm,
    inspectUrl,
    inspectText,
    inspectDownload,
    inspectThreatText
  };
});
