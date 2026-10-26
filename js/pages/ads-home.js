// Homepage:
//   - "Latest Ads": loaded from Firestore a batch at a time (12 per click on "Load more").
//   - "Flash Deals": ads whose seller entered an original price above the current price. These come from
//     the newest ads that have been loaded (the first fetch holds the 48 newest approved ads).
//
// Paging: Firestore returns 48 ads per request; we show them 12 at a time, and only ask Firestore again
// when those run out. Newest first needs a composite index (status + createdAt). Until you create it
// (the console shows a one-click link), we fall back to an unordered query and sort each batch ourselves.
import { db, F } from "../core/firebase.js";
import { adCard as card, skeletons } from "../features/cards.js";
import { esc, money, discountPct, isExpired } from "../core/util.js";
import { PAGE_SIZE, loadMoreBar, clearLoadMore } from "../features/paging.js";
import { optimizeImg } from "../features/cloudinary.js";

const FETCH_SIZE = 48;   // ads per Firestore request (4 pages of 12)

const grid = document.getElementById("adsGrid");
const count = document.getElementById("adsCount");
const dealsSection = document.getElementById("deals");
const dealsGrid = document.getElementById("dealsGrid");

let buffer = [];         // fetched but not shown yet
let cursor = null;       // last document of the previous request
let exhausted = false;   // no more ads to fetch
let indexMissing = false;
let shown = 0;
let firstBatch = true;

const ts = a => a.createdAt?.toMillis?.() ?? 0;

// ---- flash deals
function dealCard(ad) {
  const img = ad.images?.[0];
  return `<a class="deal" href="ad.html?id=${encodeURIComponent(ad.id)}">
    <span class="off">-${discountPct(ad)}%</span>
    <div class="dimg">${img ? `<img loading="lazy" src="${esc(optimizeImg(img, 500))}" alt="${esc(ad.title)}">` : '<i class="fa-regular fa-image"></i>'}</div>
    <h3>${esc(ad.title)}</h3>
    <div class="dp"><b>${money(ad.price)}</b><s>${money(ad.oldPrice)}</s></div>
    <div class="dloc"><i class="fa-solid fa-location-dot"></i> ${esc(ad.location)}</div>
  </a>`;
}

function renderDeals(ads) {
  const deals = ads.filter(a => discountPct(a) > 0).sort((a, b) => discountPct(b) - discountPct(a)).slice(0, 6);
  dealsSection.hidden = !deals.length;   // no real deals yet, so the section stays hidden
  dealsGrid.innerHTML = deals.map(dealCard).join("");
}

// ---- fetching
async function fetchBatch() {
  const ads = F.collection(db, "ads");
  const paging = cursor ? [F.startAfter(cursor)] : [];
  const build = ordered => F.query(ads, F.where("status", "==", "approved"),
    ...(ordered ? [F.orderBy("createdAt", "desc")] : []), ...paging, F.limit(FETCH_SIZE));

  let snap;
  try {
    snap = await F.getDocs(build(!indexMissing));
  } catch (err) {
    if (err.code !== "failed-precondition" || indexMissing) throw err;
    indexMissing = true;   // stay on the unordered query for every later page, so the cursor stays valid
    console.warn("Newest-first paging needs a Firestore index. Open this link to create it (optional):\n", err.message);
    snap = await F.getDocs(build(false));
  }

  cursor = snap.docs[snap.docs.length - 1] ?? cursor;
  if (snap.size < FETCH_SIZE) exhausted = true;
  const batch = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => !isExpired(a));   // expired ads are not shown
  if (indexMissing) batch.sort((a, b) => ts(b) - ts(a));
  buffer.push(...batch);
  return batch;
}

// ---- showing
const bar = loadMoreBar(grid);
const btn = bar.querySelector("button"), note = bar.querySelector("small");

function updateBar() {
  const more = buffer.length > 0 || !exhausted;
  bar.hidden = !more;
  btn.disabled = false;
  btn.textContent = "Load more ads";
  note.textContent = `Showing ${shown} ad${shown === 1 ? "" : "s"}`;
  count.textContent = shown ? `${shown}${more ? "+" : ""} ad${shown === 1 ? "" : "s"}` : "";
}

async function showNext() {
  btn.disabled = true; btn.textContent = "Loading…";
  try {
    while (buffer.length < PAGE_SIZE && !exhausted) {
      const batch = await fetchBatch();
      if (firstBatch) { renderDeals(batch); firstBatch = false; }
    }
    const next = buffer.splice(0, PAGE_SIZE);
    if (shown === 0) grid.innerHTML = "";
    grid.insertAdjacentHTML("beforeend", next.map(card).join(""));   // card() escapes every ad field
    shown += next.length;
    if (!shown) {
      grid.innerHTML = `<div class="ads-msg"><i class="fa-solid fa-store"></i><h3>No ads yet</h3>
        <p>Approved ads will appear here. Be the first to post one!</p>
        <a href="post-ad.html" class="btn solid">Post an Ad</a></div>`;
    }
    updateBar();
  } catch (err) {
    console.error(err.code, err);
    if (!shown) {
      clearLoadMore(grid);
      grid.innerHTML = `<div class="ads-msg"><i class="fa-solid fa-triangle-exclamation"></i><h3>Couldn't load ads</h3>
        <p>${err.code === "permission-denied" ? "Something went wrong on our side. Please try again in a moment." : "Check your connection and try again."}</p>
        <button class="btn solid" id="retryAds">Try again</button></div>`;
      document.getElementById("retryAds")?.addEventListener("click", start);
    } else {   // some ads are already on screen: keep them and let the visitor retry the button
      btn.disabled = false; btn.textContent = "Couldn't load, tap to retry";
    }
  }
}

function start() {
  buffer = []; cursor = null; exhausted = false; indexMissing = false; shown = 0; firstBatch = true;
  grid.innerHTML = skeletons(8);
  bar.hidden = true;
  showNext();
}

btn.addEventListener("click", showNext);
start();
