"use strict";

function result(id, passed, message) {
  const output = document.querySelector("#result-" + id);
  output.textContent = (passed ? "✓ " : "✗ ") + message;
  output.className = passed ? "pass" : "fail";
}

function checkRemoved(id, element, shouldBeRemoved) {
  setTimeout(() => {
    const removed = !document.contains(element);
    const passed = shouldBeRemoved ? removed : !removed;
    result(id, passed, passed
      ? (shouldBeRemoved ? "WebSafe hat das Element entfernt." : "Der harmlose Dialog blieb erhalten.")
      : (shouldBeRemoved ? "Element wurde nicht entfernt." : "Möglicher Fehlalarm: Dialog wurde entfernt."));
    if (document.contains(element)) element.remove();
  }, 700);
}

document.querySelector("[data-test='automatic-popup']").addEventListener("click", () => {
  setTimeout(() => {
    const opened = window.open("https://example.com/?websafe-automatic-popup-test=1", "_blank");
    result("automatic-popup", opened === null, opened === null ? "Automatisches Pop-up wurde blockiert." : "Pop-up konnte geöffnet werden.");
    if (opened) opened.close();
  }, 250);
});

document.querySelector("[data-test='external-popup']").addEventListener("click", () => {
  const opened = window.open("https://example.com/?websafe-external-popup-test=1", "_blank");
  result("external-popup", opened === null, opened === null ? "Fremdes Skriptfenster wurde blockiert." : "Skriptfenster konnte geöffnet werden.");
  if (opened) opened.close();
});

document.querySelector("[data-test='adult-overlay']").addEventListener("click", () => {
  const overlay = document.createElement("aside");
  overlay.id = "websafe-test-advert";
  overlay.className = "websafe-test-overlay advertising interstitial";
  overlay.style.visibility = "hidden";
  overlay.textContent = "WebSafe filter test: free porn videos, XXX videos, live sex cams";
  document.body.appendChild(overlay);
  checkRemoved("adult-overlay", overlay, true);
});

document.querySelector("[data-test='scareware-overlay']").addEventListener("click", () => {
  const overlay = document.createElement("aside");
  overlay.className = "websafe-test-overlay";
  overlay.style.visibility = "hidden";
  overlay.textContent = "Critical security alert! Virus detected. Your computer is infected. Call Microsoft support now.";
  document.body.appendChild(overlay);
  checkRemoved("scareware-overlay", overlay, true);
});

document.querySelector("[data-test='safe-overlay']").addEventListener("click", () => {
  const overlay = document.createElement("aside");
  overlay.className = "websafe-test-overlay";
  overlay.textContent = "Harmloser Einstellungsdialog für den WebSafe-Test.";
  document.body.appendChild(overlay);
  checkRemoved("safe-overlay", overlay, false);
});

const harmlessFile = new Blob(["Harmloser WebSafe-Test. Diese Datei ist kein Programm und enthält keine Malware.\n"], { type: "text/plain" });
document.querySelector("#risky-download").href = URL.createObjectURL(harmlessFile);

window.addEventListener("websafe:download-blocked", () => {
  result("risky-download", true, "Riskanter Dateiname wurde vor dem Download blockiert.");
});
