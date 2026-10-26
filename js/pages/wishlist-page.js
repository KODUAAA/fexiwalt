// Wishlist page: shows every ad the logged-in user has saved.
// (The list of saved ids and the heart toggling live in js/wishlist.js.)
import { db, F } from "../core/firebase.js";
import { onWishlist } from "../features/wishlist.js";
import { adCard, skeletons } from "../features/cards.js";
import { isExpired } from "../core/util.js";

const grid = document.getElementById("wishGrid");
const summary = document.getElementById("wishSummary");
const cache = new Map();   // adId -> ad data, or null if it no longer exists / isn't visible
let first = true;

async function fetchAd(id) {
  if (cache.has(id)) return cache.get(id);
  let ad = null;
  try {
    const snap = await F.getDoc(F.doc(db, "ads", id));
    if (snap.exists() && snap.data().status === "approved" && !isExpired(snap.data())) ad = { id, ...snap.data() }; // only live ads
  } catch (err) {
    console.warn("Couldn't load saved ad", id, err.code); // e.g. deleted or no longer approved
  }
  cache.set(id, ad);
  return ad;
}

let run = 0;
onWishlist(async (saved, ready) => {
  if (!ready) { if (first) grid.innerHTML = skeletons(4); return; }
  first = false;
  const my = ++run;                       // ignore results from an older update
  const ids = [...saved];

  if (!ids.length) {
    summary.textContent = "Nothing saved yet.";
    grid.innerHTML = `<div class="ads-msg"><i class="fa-regular fa-heart"></i><h3>Your wishlist is empty</h3>
      <p>Tap the heart on any ad to save it here.</p><a href="category.html?all=1" class="btn solid">Browse ads</a></div>`;
    return;
  }

  const ads = (await Promise.all(ids.map(fetchAd))).filter(Boolean);
  if (my !== run) return;

  const missing = ids.length - ads.length;
  summary.textContent = `${ads.length} saved ad${ads.length === 1 ? "" : "s"}` +
    (missing ? ` · ${missing} no longer available` : "");
  grid.innerHTML = ads.length ? ads.map(adCard).join("")
    : `<div class="ads-msg"><i class="fa-regular fa-heart"></i><h3>These ads are no longer available</h3>
       <p>The ads you saved were removed or taken down.</p><a href="category.html?all=1" class="btn solid">Browse ads</a></div>`;
});
