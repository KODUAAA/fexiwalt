// Your business details, shown on the legal, help and contact pages.
// EDIT THE VALUES BELOW, then every page updates automatically.
// (Any element written as  <span data-site="email"></span>  is filled from this list.)
export const SITE = {
  name: "FEXIWALT",
  email: "fexiwalt@gmail.com",
  whatsapp: "0541364246",                // WhatsApp chat number (Ghana format)
  phone: "0207312484",                   // main phone line
  phone2: "0541364246",                  // second phone line
  address: "P. O. Box 2, Diaso, Dunkwa-on-Offin, Central Region, Ghana",
  hours: "Open 24/7",
  updated: "30 September 2026"           // update this when you change the Terms or Privacy Policy
};

const digits = v => {
  let d = String(v).replace(/\D/g, "");
  if (d.startsWith("0")) d = "233" + d.slice(1);
  return d;
};

document.querySelectorAll("[data-site]").forEach(el => {
  const key = el.dataset.site;
  const v = SITE[key];
  if (v == null) return;
  el.textContent = v;
  if (el.tagName === "A") {
    if (key === "email") el.href = `mailto:${v}`;
    if (key === "phone" || key === "phone2") el.href = `tel:+${digits(v)}`;
    if (key === "whatsapp") { el.href = `https://wa.me/${digits(v)}`; el.target = "_blank"; el.rel = "noopener"; }
  }
});

// Social links. Add the full address of each page you have (leave "" to hide that icon everywhere).
// Example:  instagram: "https://instagram.com/yourpage"
export const SOCIAL = {
  facebook: "https://www.facebook.com/fexiwalt",
  instagram: "https://www.instagram.com/fexiwalt",
  tiktok: "https://www.tiktok.com/@fexiwaltofficial",
  youtube: "https://www.youtube.com/@fexiwalt",
  x: "https://x.com/fexiwalt",
  threads: "https://www.threads.net/@fexiwalt",
  pinterest: "https://www.pinterest.com/fexiwalt",
  linkedin: "https://www.linkedin.com/company/fexiwalt",
  snapchat: "https://www.snapchat.com/add/fexiwalt",
  whatsapp: "https://wa.me/233541364246"
};
