"use strict";

const header = document.querySelector("#site-header");
const navigationToggle = document.querySelector(".nav-toggle");
const navigationLinks = document.querySelector("#nav-links");

function closeNavigation() {
  if (!navigationToggle || !navigationLinks) return;
  navigationToggle.setAttribute("aria-expanded", "false");
  navigationLinks.classList.remove("open");
  document.body.classList.remove("menu-open");
}

if (navigationToggle && navigationLinks) {
  navigationToggle.addEventListener("click", () => {
    const open = navigationToggle.getAttribute("aria-expanded") === "true";
    navigationToggle.setAttribute("aria-expanded", String(!open));
    navigationLinks.classList.toggle("open", !open);
    document.body.classList.toggle("menu-open", !open);
  });

  navigationLinks.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeNavigation();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) closeNavigation();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNavigation();
  });
}

function updateHeader() {
  if (header) header.classList.toggle("scrolled", window.scrollY > 8);
}

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

for (const detail of document.querySelectorAll(".faq-list details")) {
  detail.addEventListener("toggle", () => {
    if (!detail.open) return;
    for (const other of document.querySelectorAll(".faq-list details[open]")) {
      if (other !== detail) other.open = false;
    }
  });
}

for (const year of document.querySelectorAll("[data-year]")) {
  year.textContent = String(new Date().getFullYear());
}
