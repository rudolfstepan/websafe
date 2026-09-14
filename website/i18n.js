"use strict";

// English HTML remains usable when JavaScript is disabled.
(() => {
  const dictionary = window.websafeTranslations;
  const storageKey = "websafe-language";
  const bindings = [];
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest("script, style, [data-language-switch]")) continue;
    const original = node.nodeValue;
    const key = original.trim();
    if (Object.hasOwn(dictionary, key)) {
      bindings.push((language) => {
        node.nodeValue = original.replace(key, () => language === "de" ? dictionary[key] : key);
      });
    }
  }
  for (const element of document.querySelectorAll("[aria-label], [alt], meta[content]")) {
    for (const attribute of ["aria-label", "alt", "content"]) {
      const key = element.getAttribute(attribute);
      if (key && Object.hasOwn(dictionary, key)) {
        bindings.push((language) => element.setAttribute(attribute, language === "de" ? dictionary[key] : key));
      }
    }
  }
  let savedLanguage;
  try { savedLanguage = localStorage.getItem(storageKey); } catch { /* Storage may be disabled. */ }
  const browserLanguage = navigator.languages?.[0] || navigator.language || "en";
  let language = ["de", "en"].includes(savedLanguage)
    ? savedLanguage
    : /^de(?:-|$)/i.test(browserLanguage) ? "de" : "en";

  function applyLanguage(nextLanguage) {
    language = nextLanguage === "de" ? "de" : "en";
    document.documentElement.lang = language;
    for (const update of bindings) update(language);
    const locale = document.querySelector('meta[property="og:locale"]');
    if (locale) locale.content = language === "de" ? "de_AT" : "en_US";
    for (const button of document.querySelectorAll("[data-language]")) {
      button.setAttribute("aria-pressed", String(button.dataset.language === language));
    }
    for (const control of document.querySelectorAll("[data-language-switch]")) {
      control.setAttribute("aria-label", language === "de" ? "Sprache wählen" : "Choose language");
      control.hidden = false;
    }
  }
  for (const button of document.querySelectorAll("[data-language]")) {
    button.addEventListener("click", () => {
      applyLanguage(button.dataset.language);
      try { localStorage.setItem(storageKey, language); } catch { /* Switching still works. */ }
    });
  }
  applyLanguage(language);
})();
