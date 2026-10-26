// Keeps the page title, description, share-preview tags and search-engine data in step with what is on screen.
//
// Pages whose content comes from Firestore (an ad, a seller, a category) call setSeo() once the data has loaded.
// Google runs JavaScript, so it sees these updated tags. WhatsApp, Facebook and X do NOT run JavaScript, so
// their link previews use the fixed tags written into each HTML page (the FEXIWALT card). Per-ad previews
// would need the page to be rendered on a server (for example a Firebase Cloud Function).

// Set <meta attr="key" content="value">, creating the tag if the page doesn't have it yet.
function setMeta(attr, key, value) {
  if (value == null || value === "") return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.append(el);
  }
  el.setAttribute("content", value);
}

function setCanonical(url) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.append(el);
  }
  el.href = url;
}

/** Trim text to a search-result-friendly length. */
export const clip = (s, n = 155) => {
  s = String(s ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
};

/**
 * setSeo({ title, description, image, url, type, jsonLd })
 *   image  full https URL (share previews need an absolute address)
 *   url    the page's own address for this content (ad.html?id=abc), used for og:url and the canonical link
 *   jsonLd an object describing the thing on the page (schema.org), given to search engines as rich data
 */
export function setSeo({ title, description, image, url, type = "website", jsonLd, robots } = {}) {
  const desc = clip(description);
  if (title) {
    document.title = title;
    setMeta("property", "og:title", title);
    setMeta("name", "twitter:title", title);
  }
  if (desc) {
    setMeta("name", "description", desc);
    setMeta("property", "og:description", desc);
    setMeta("name", "twitter:description", desc);
  }
  if (image) {
    setMeta("property", "og:image", image);
    setMeta("name", "twitter:image", image);
    setMeta("name", "twitter:card", "summary_large_image");
  }
  if (url) {
    setMeta("property", "og:url", url);
    setCanonical(url);
  }
  setMeta("property", "og:type", type);
  setMeta("name", "robots", robots);   // e.g. "noindex,follow" for sold or expired ads

  const old = document.getElementById("ld-json");
  if (jsonLd) {
    const s = old || document.createElement("script");
    s.id = "ld-json";
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(jsonLd);   // textContent: the data can never break out of the script tag
    if (!old) document.head.append(s);
  } else {
    old?.remove();
  }
}
