// Small accessibility helpers that apply to every page (loaded by session.js).
//  - decorative Font Awesome icons are hidden from screen readers (the words next to them say the same thing)
//  - error messages are announced when they appear, and invalid fields are flagged
//  - the result count on the browse page is announced when a search changes it
const hideIcons = root => root.querySelectorAll?.('i[class*="fa-"]:not([aria-hidden])').forEach(i => i.setAttribute("aria-hidden", "true"));
hideIcons(document);
new MutationObserver(list => {
  for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches?.('i[class*="fa-"]')) n.setAttribute("aria-hidden", "true"); hideIcons(n); }
}).observe(document.body, { childList: true, subtree: true });

document.querySelectorAll(".form-msg").forEach(m => m.setAttribute("role", "alert"));
document.getElementById("resultCount")?.setAttribute("aria-live", "polite");
document.getElementById("results")?.setAttribute("aria-busy", "false");

// a field the browser rejects gets aria-invalid, so screen readers say so
document.addEventListener("invalid", e => e.target.setAttribute("aria-invalid", "true"), true);
document.addEventListener("input", e => e.target.removeAttribute?.("aria-invalid"), true);
