import { auth, A, db, F } from "../core/firebase.js";
import { timeAgo, whatsappLink, discountPct, isExpired } from "../core/util.js";
import { reportAd } from "../features/report.js";
import { setSeo, clip } from "../core/seo.js";
import { shareAd } from "../features/share.js";
import { optimizeImg } from "../features/cloudinary.js";
import { mountFollow } from "../features/follow.js";

const ADS = {};   // (demo ads removed for launch: every ad now comes from the database)

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "GH₵ " + Number(n).toLocaleString();
const PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#eef3ff"/><text x="50%" y="50%" fill="#7b859c" font-family="Arial" font-size="28" text-anchor="middle">Image unavailable</text></svg>');


const id = new URLSearchParams(location.search).get("id");

// Look the ad up in the database (no id, or an unknown id, shows "Ad not found").
async function loadAd() {
  if (!id) return null;
  try {
    const snap = await F.getDoc(F.doc(db, "ads", id));
    if (!snap.exists()) return null;
    const a = snap.data();
    return {
      title: a.title, price: a.price, category: a.category, condition: a.condition || "Used",
      negotiable: !!a.negotiable, location: a.location, posted: timeAgo(a.createdAt),
      id, sellerId: a.sellerId, oldPrice: a.oldPrice,
      status: a.status, expiresAt: a.expiresAt, reviewedAt: a.reviewedAt, createdAt: a.createdAt,
      seller: { id: a.sellerId, name: a.sellerName || "Seller", phone: a.phone },
      description: a.description, images: a.images?.length ? a.images : [PLACEHOLDER]
    };
  } catch (err) {
    console.error(err.code, err); // e.g. permission-denied for ads that aren't approved yet
    return null;
  }
}
const ad = await loadAd();

if (!ad) {
  $("notfound").hidden = false;
} else {
  // page title, description, share-preview tags and search-engine data for this ad (see js/seo.js)
  // what state is this ad in? (sample ads have no status and count as live)
  const state = ad.status === "sold" ? "sold"
    : ad.status === "approved" && isExpired(ad) ? "expired"
    : ad.status === "pending" || ad.status === "rejected" ? ad.status : "live";
  const closed = state === "sold" || state === "expired";   // buyers can no longer contact the seller
  const pageUrl = `${location.origin}${location.pathname}?id=${encodeURIComponent(id ?? "iphone-14")}`;
  const photos = (ad.images || []).filter(u => /^https?:\/\//.test(u));
  setSeo({
    title: `${ad.title} - ${money(ad.price)} | FEXIWALT`,
    description: `${ad.condition}. ${money(ad.price)} in ${ad.location}. ${ad.description}`,
    image: photos[0] ? optimizeImg(photos[0], 1200) : undefined,
    url: pageUrl,
    robots: state === "live" && id ? undefined : "noindex,follow",   // sold, expired and unreviewed ads stay out of search results
    jsonLd: [{
      "@context": "https://schema.org", "@type": "Product",
      name: ad.title, description: clip(ad.description, 500), category: ad.category,
      ...(photos.length ? { image: photos } : {}),
      itemCondition: ad.condition === "New" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
      offers: {
        "@type": "Offer", priceCurrency: "GHS", price: ad.price, url: pageUrl,
        availability: state === "sold" ? "https://schema.org/SoldOut" : closed ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        seller: { "@type": "Person", name: ad.seller.name },
        ...(ad.expiresAt?.toMillis ? { priceValidUntil: new Date(ad.expiresAt.toMillis()).toISOString().slice(0, 10) } : {})
      }
    }, {
      // breadcrumb trail (Home > Category > Ad): search engines show it under the result title
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${location.origin}/index.html` },
        { "@type": "ListItem", position: 2, name: ad.category, item: `${location.origin}/category.html?cat=${encodeURIComponent(ad.category)}` },
        { "@type": "ListItem", position: 3, name: ad.title, item: pageUrl }
      ]
    }]
  });
  $("shareBtn").onclick = () => shareAd({ title: ad.title, url: pageUrl, priceText: money(ad.price) });

  $("crumbCat").textContent = ad.category;
  $("crumbTitle").textContent = ad.title;
  $("title").textContent = ad.title;
  $("price").textContent = money(ad.price);
  $("ctaPrice").textContent = money(ad.price);
  $("location").textContent = ad.location;
  $("posted").textContent = ad.posted;
  $("category").textContent = ad.category;
  $("condition").textContent = ad.condition;
  $("negotiable").textContent = ad.negotiable ? "Negotiable" : "Fixed price";
  $("description").textContent = ad.description;
  if (ad.seller.id) {   // real ads: the seller name links to their profile
    const link = Object.assign(document.createElement("a"), { href: `seller.html?id=${encodeURIComponent(ad.seller.id)}`, textContent: ad.seller.name });
    $("sellerName").replaceChildren(link);
  } else $("sellerName").textContent = ad.seller.name;
  const off = discountPct(ad);   // deal: show the old price and the discount
  if (off) {
    const was = Object.assign(document.createElement("s"), { className: "was", textContent: money(ad.oldPrice) });
    const pill = Object.assign(document.createElement("em"), { className: "off-pill", textContent: `-${off}%` });
    $("price").append(" ", was, pill);
  }
  $("avatar").textContent = ad.seller.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const wa = whatsappLink(ad.seller.phone, ad.title);
  if (wa && !closed) { $("waBtn").href = wa; $("waBtn2").href = wa; }
  else { $("waBtn").hidden = true; $("waBtn2").hidden = true; } // no valid number, or the ad is sold / expired

  const banner = {
    sold: ["fa-solid fa-handshake", "This item has been sold."],
    expired: ["fa-regular fa-clock", "This ad has expired and may no longer be available."],
    pending: ["fa-regular fa-eye", "Only you can see this ad. It is waiting for review."],
    rejected: ["fa-solid fa-ban", "This ad was not approved, so only you can see it."]
  }[state];
  if (banner) {
    $("stateBanner").replaceChildren(Object.assign(document.createElement("i"), { className: banner[0] }), document.createTextNode(" " + banner[1]));
    $("stateBanner").className = `state-banner ${state}`;
    $("stateBanner").hidden = false;
  }

  $("mainSlides").innerHTML = ad.images.map(src =>
    `<div class="swiper-slide"><img src="${esc(optimizeImg(src, 1200))}" alt="${esc(ad.title)}" onerror="this.onerror=null;this.src='${PLACEHOLDER}'"></div>`).join("");
  $("thumbSlides").innerHTML = ad.images.map(src =>
    `<div class="swiper-slide"><img src="${esc(optimizeImg(src, 240))}" alt="" onerror="this.onerror=null;this.src='${PLACEHOLDER}'"></div>`).join("");

  if (id && !ADS[id]) {   // wishlist and reporting work for real ads only
    $("saveBtn").dataset.heart = id; $("saveBtn").hidden = false;
    $("reportBtn").hidden = false;
    $("reportBtn").onclick = () => reportAd(ad);
  }
  // verified badge + Follow button (real sellers only)
  if (ad.seller.id) mountFollow($("followBox"), ad.seller.id);

  // count a view and WhatsApp taps for the seller (once per visit each; never the seller's own visits)
  if (id && !ADS[id] && state === "live") {
    const bump = field => {
      const key = `fx-${field}-${id}`;
      try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* private mode: count anyway */ }
      if (auth.currentUser?.uid === ad.sellerId) return;
      F.updateDoc(F.doc(db, "ads", id), { [field]: F.increment(1) }).catch(() => {});   // best effort
    };
    const offView = A.onAuthStateChanged(auth, () => { offView(); bump("views"); });
    ["waBtn", "waBtn2"].forEach(b => $(b).addEventListener("click", () => bump("waClicks")));
  }
  $("ad").hidden = false;
  $("mobileCta").hidden = closed;   // the phone's bottom "price + WhatsApp" bar is pointless once sold or expired

  const thumbs = new Swiper(".adThumbs", { slidesPerView: 5, spaceBetween: 10, watchSlidesProgress: true, freeMode: true });
  const main = new Swiper(".adMain", {
    spaceBetween: 10,
    navigation: { nextEl: ".adMain .swiper-button-next", prevEl: ".adMain .swiper-button-prev" },
    thumbs: { swiper: thumbs },
    on: { slideChange: s => ($("counter").textContent = `${s.activeIndex + 1} / ${ad.images.length}`) }
  });
  $("counter").textContent = `1 / ${ad.images.length}`;
  if (ad.images.length < 2) { document.querySelector(".adThumbs").hidden = true; document.querySelector(".adMain").classList.add("single"); }
}
