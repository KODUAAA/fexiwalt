// Wishlist (favourites). Loaded on every page through session.js.
//
// Data:   users/<uid>/wishlist/<adId>   ->  { adId, createdAt }     (only the owner can read/write it)
// UI:     any element with  data-heart="<adId>"  becomes a toggle button (ad cards, the ad page's Save button)
//         any element with  class="wish-count"   shows how many ads are saved (header counter)
import { auth, A, db, F } from "../core/firebase.js";

const saved = new Set();
const listeners = new Set();
let ready = false;      // true once we know the logged-in state and have the first wishlist snapshot
let unsub = null;

export const isSaved = id => saved.has(id);

/** Call cb(savedIds, ready) now and whenever the wishlist changes. Returns an unsubscribe function. */
export function onWishlist(cb) {
  listeners.add(cb);
  cb(saved, ready);
  return () => listeners.delete(cb);
}

function paint() {
  document.querySelectorAll("[data-heart]").forEach(b => {
    const on = saved.has(b.dataset.heart);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Remove from wishlist" : "Save to wishlist");
    const i = b.querySelector("i");
    if (i) i.className = on ? "fa-solid fa-heart" : "fa-regular fa-heart";
    const label = b.querySelector(".lbl");
    if (label) label.textContent = on ? "Saved" : "Save";
  });
  document.querySelectorAll(".wish-count").forEach(e => (e.textContent = saved.size));
}
const notify = () => { paint(); listeners.forEach(cb => cb(saved, ready)); };

// cards are rendered after page load, so re-paint whenever new nodes appear
let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; paint(); });
}).observe(document.body, { childList: true, subtree: true });

// follow the logged-in user's wishlist in real time
A.onAuthStateChanged(auth, user => {
  unsub?.(); unsub = null;
  saved.clear(); ready = false;
  if (!user) { ready = true; notify(); return; }
  unsub = F.onSnapshot(F.collection(db, "users", user.uid, "wishlist"),
    snap => { saved.clear(); snap.forEach(d => saved.add(d.id)); ready = true; notify(); },
    err => { console.warn("Wishlist unavailable:", err.code); ready = true; notify(); });
});

// click on any heart / save button
document.addEventListener("click", async e => {
  const btn = e.target.closest("[data-heart]");
  if (!btn || !btn.dataset.heart) return;
  e.preventDefault();  // hearts sit inside ad cards, which are links
  e.stopPropagation();
  if (!ready) return;

  const user = auth.currentUser;
  if (!user) {
    const page = location.pathname.split("/").pop();
    location.href = /^[\w-]+\.html$/.test(page) ? `login.html?next=${page}` : "login.html";
    return;
  }

  const id = btn.dataset.heart;
  const ref = F.doc(db, "users", user.uid, "wishlist", id);
  btn.disabled = true;
  try {
    if (saved.has(id)) await F.deleteDoc(ref);
    else await F.setDoc(ref, { adId: id, createdAt: F.serverTimestamp() });
  } catch (err) {
    console.error(err.code, err);
  } finally {
    btn.disabled = false;
  }
});
