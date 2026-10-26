// The site footer, built once here so every page stays in sync (edit the links below, not 16 HTML files).
// Social icons come from SOCIAL (js/core/site.js); an icon with no link is simply not shown.
import { SITE, SOCIAL } from "./site.js";

const LINKS = [
  ["Browse ads", "category.html?all=1"],
  ["Post an Ad", "post-ad.html"],
  ["Help Center", "help.html"],
  ["Safety tips", "help.html#safety"],
  ["Contact", "contact.html"],
  ["Terms", "terms.html"],
  ["Privacy", "privacy.html"]
];

const ICONS = { facebook: "fab fa-facebook-f", instagram: "fab fa-instagram", tiktok: "fab fa-tiktok", youtube: "fab fa-youtube", x: "fab fa-x-twitter", threads: "fab fa-threads", pinterest: "fab fa-pinterest-p", linkedin: "fab fa-linkedin-in", snapchat: "fab fa-snapchat", whatsapp: "fab fa-whatsapp" };
const LABELS = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X", threads: "Threads", pinterest: "Pinterest", linkedin: "LinkedIn", snapchat: "Snapchat", whatsapp: "WhatsApp" };

const isUrl = v => /^https?:\/\//i.test(v || "");

// ---- footer
const el = document.getElementById("siteFooter") || document.body.appendChild(document.createElement("footer"));
el.className = "ft";

const social = Object.keys(ICONS).filter(k => isUrl(SOCIAL[k]))
  .map(k => `<a href="${SOCIAL[k]}" target="_blank" rel="noopener" aria-label="${LABELS[k]}"><i class="${ICONS[k]}"></i></a>`).join("");

el.innerHTML = `
  <div class="wrap ft-main">
    <a class="ft-brand" href="index.html" aria-label="${SITE.name} home"><img src="images/logo.jpg" alt=""><b>${SITE.name}</b></a>
    <nav class="ft-links" aria-label="Footer">${LINKS.map(([t, h]) => `<a href="${h}">${t}</a>`).join("")}</nav>
    ${social ? `<div class="ft-social">${social}</div>` : ""}
  </div>
  <div class="wrap ft-bottom">
    <span>&copy; ${new Date().getFullYear()} ${SITE.name}. All rights reserved.</span>
    <button type="button" class="ft-top" id="toTop">Back to top <i class="fa-solid fa-arrow-up"></i></button>
  </div>`;

document.getElementById("toTop").addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
