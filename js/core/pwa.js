// Installable app support (loaded on every page through session.js).
//   1. Registers the service worker (sw.js): faster loads, and an "offline" page when there's no internet.
//   2. Powers every  <button data-install>  on the site (home page card, phone menu):
//        - where the browser can install the app (Android Chrome, desktop Chrome/Edge): one tap opens its install prompt
//        - elsewhere (iPhone Safari, Firefox): a short "how to add it to your home screen" guide
//   Once the app is installed and opened from the home screen, the install buttons hide themselves (see home.css).

// ---- 1. service worker (only on https, or localhost while developing)
if ("serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(err => console.warn("Service worker not registered:", err.message));
  });
}

// ---- 2. install button
let deferredPrompt = null;   // the browser's install prompt, saved until the visitor taps Install

addEventListener("beforeinstallprompt", e => {
  e.preventDefault();        // we show it ourselves, when the visitor asks
  deferredPrompt = e;
});
addEventListener("appinstalled", () => { deferredPrompt = null; });

// SweetAlert2 isn't on every page, so load it only when the how-to guide is needed
function loadSwal() {
  if (window.Swal) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
    s.onload = resolve; s.onerror = reject;
    document.head.append(s);
  });
}

const ua = navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = /android/i.test(ua);

async function showHowTo() {
  const steps = isIOS
    ? ["Open this page in <b>Safari</b>.", "Tap the <b>Share</b> button (the square with an arrow).", "Scroll down and tap <b>Add to Home Screen</b>.", "Tap <b>Add</b>."]
    : isAndroid
    ? ["Tap the <b>⋮ menu</b> in your browser.", "Tap <b>Install app</b> (or <b>Add to Home screen</b>).", "Tap <b>Install</b>."]
    : ["Look for the <b>install icon</b> at the right end of the address bar, or open the browser menu.", "Click <b>Install FEXIWALT</b>."];
  try {
    await loadSwal();
    await Swal.fire({
      title: "Install FEXIWALT",
      html: `<ol style="text-align:left;margin:.4rem 0 0 1.2rem;line-height:1.8">${steps.map(s => `<li>${s}</li>`).join("")}</ol>`,
      confirmButtonText: "Got it", confirmButtonColor: "#0a3fc4"
    });
  } catch {
    alert("To install: " + steps.join(" ").replace(/<[^>]+>/g, ""));   // offline or blocked: plain text version
  }
}

document.addEventListener("click", async e => {
  if (!e.target.closest("[data-install]")) return;
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;   // accepted or dismissed; either way the prompt can't be reused
    deferredPrompt = null;
  } else {
    showHowTo();
  }
});
