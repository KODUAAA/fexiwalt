// Seller profile: seller.html?id=<seller uid>  ->  that seller's live (approved) ads.
// Only public information is shown: the name and the ads the seller chose to publish.
import { db, F } from "../core/firebase.js";
import { adCard, skeletons } from "../features/cards.js";
import { renderBatched } from "../features/paging.js";
import { setSeo } from "../core/seo.js";
import { isExpired } from "../core/util.js";
import { optimizeImg } from "../features/cloudinary.js";
import { mountFollow } from "../features/follow.js";

const id = new URLSearchParams(location.search).get("id");
const grid = document.getElementById("sellerGrid");
const head = document.getElementById("sellerHead");

const initials = name => String(name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const notFound = (title, text) => {
  grid.innerHTML = `<div class="ads-msg"><i class="fa-solid fa-user-slash"></i><h3>${title}</h3><p>${text}</p>
    <a href="sellers.html" class="btn solid">See top sellers</a></div>`;
};

async function load() {
  if (!id) return notFound("Seller not found", "This link is missing the seller.");
  grid.innerHTML = skeletons(4);
  try {
    // two equality filters: no composite index needed
    const snap = await F.getDocs(F.query(F.collection(db, "ads"),
      F.where("sellerId", "==", id), F.where("status", "==", "approved")));
    const ads = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => !isExpired(a))   // expired ads are not shown
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    if (!ads.length) return notFound("No live ads", "This seller has no live ads right now.");

    const name = ads[0].sellerName || "Seller";
    const cats = [...new Set(ads.map(a => a.category).filter(Boolean))];
    setSeo({
      title: `${name} - Seller on FEXIWALT`,
      description: `${name} has ${ads.length} live ad${ads.length === 1 ? "" : "s"} on FEXIWALT${cats.length ? `, including ${cats.slice(0, 3).join(", ")}` : ""}. Browse their ads and contact them on WhatsApp.`,
      image: ads[0].images?.[0] && /^https?:\/\//.test(ads[0].images[0]) ? optimizeImg(ads[0].images[0], 1200) : undefined,
      url: `${location.origin}${location.pathname}?id=${encodeURIComponent(id)}`
    });
    document.getElementById("crumbName").textContent = name;
    document.getElementById("sName").textContent = name;
    document.getElementById("sAvatar").textContent = initials(name);
    document.getElementById("sCount").textContent = ads.length;
    document.getElementById("sCats").textContent = cats.length ? `Sells: ${cats.slice(0, 3).join(", ")}` : "";
    head.hidden = false;
    const fol = document.getElementById("sFollowers");
    mountFollow(document.getElementById("followBox"), id, n => { fol.querySelector("b").textContent = n; fol.hidden = false; });
    renderBatched(grid, ads, adCard);   // 12 at a time, with a "Load more" button
  } catch (err) {
    console.error(err.code, err);
    notFound("Couldn't load this seller", err.code === "permission-denied" ? "Something went wrong on our side. Please try again in a moment." : "Check your connection and try again.");
  }
}
load();
