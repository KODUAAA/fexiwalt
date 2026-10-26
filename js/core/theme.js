// Dark mode. The saved choice is applied before the page paints by a tiny inline script in each page's <head>
// (so there's no white flash). This file adds the switch and remembers the choice.
//
//   no saved choice -> follows the device's light/dark setting
//   flip the switch -> changes theme, and the choice is remembered on this device (localStorage)
//
// The switch lives in the header on desktop, and at the bottom of the hamburger menu on phones
// (that one is built by js/session.js).
const root = document.documentElement;

const stored = () => { try { return localStorage.getItem("theme"); } catch { return null; } };
const save = v => { try { localStorage.setItem("theme", v); } catch { /* private mode: still works this visit */ } };
const isDark = () => root.dataset.theme === "dark";

function apply(dark) {
  if (dark) root.dataset.theme = "dark"; else delete root.dataset.theme;
  document.querySelectorAll("[data-theme-toggle]").forEach(b => {
    b.setAttribute("aria-checked", String(dark));
    b.setAttribute("title", dark ? "Switch to light mode" : "Switch to dark mode");
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b1220" : "#ffffff");
}

// desktop switch: first item in the header's actions row (next to Account).
// On phones that row is hidden and the same switch is at the bottom of the hamburger menu (built by js/session.js).
const bar = document.querySelector(".hd-actions");
if (bar && !bar.querySelector("[data-theme-toggle]")) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "theme-toggle"; b.dataset.themeToggle = "";
  b.setAttribute("role", "switch");
  b.setAttribute("aria-label", "Dark mode");
  b.innerHTML = `<span class="sw" aria-hidden="true"><i class="fa-solid fa-sun"></i><i class="fa-solid fa-moon"></i><b class="knob"></b></span>`;
  bar.prepend(b);
}

// one handler for every switch on the page (header + phone menu)
document.addEventListener("click", e => {
  if (!e.target.closest("[data-theme-toggle]")) return;
  const dark = !isDark();
  save(dark ? "dark" : "light");
  apply(dark);
});

// follow the device setting live, unless the visitor picked a theme themselves
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", e => { if (!stored()) apply(e.matches); });

apply(isDark());
