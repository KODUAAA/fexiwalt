// Verified sellers and following.
//
//   sellers/<uid>   { verified, name, followers }   public; an admin marks a seller as verified (Admin → Users)
//   follows/<me>_<seller>   { followerId, sellerId, createdAt }   one document per person you follow
//
// Only verified sellers can be followed. When an admin approves a new ad from a verified seller, everyone who
// follows them gets a notification (see notifyFollowers in js/pages/admin.js and the bell in js/features/notify.js).
import { auth, A, db, F } from "../core/firebase.js";

/** Public seller info, or null. */
export async function sellerInfo(sid) {
  if (!sid) return null;
  try {
    const s = await F.getDoc(F.doc(db, "sellers", sid));
    return s.exists() ? s.data() : null;
  } catch { return null; }
}

const once = () => new Promise(res => { const off = A.onAuthStateChanged(auth, u => { off(); res(u); }); });

/**
 * Fills `box` with a "Verified seller" badge and a Follow / Following button for verified sellers.
 * Does nothing for sellers who aren't verified. `onCount(n)` gets the follower count whenever it changes.
 */
export async function mountFollow(box, sid, onCount = () => {}) {
  if (!box || !sid) return;
  const info = await sellerInfo(sid);
  if (!info?.verified) return;
  let count = Math.max(0, info.followers || 0);
  onCount(count);

  box.innerHTML = `<span class="verified-badge" title="FEXIWALT has checked this seller"><i class="fa-solid fa-circle-check"></i> Verified seller</span>
    <button type="button" class="btn follow-btn" hidden></button>`;
  const btn = box.querySelector(".follow-btn");
  box.hidden = false;

  const user = await once();
  if (user?.uid === sid) return;   // your own profile: badge only
  let following = false;
  if (user) {
    try { following = (await F.getDoc(F.doc(db, "follows", `${user.uid}_${sid}`))).exists(); } catch { /* treat as not following */ }
  }
  const paint = () => {
    btn.classList.toggle("on", following);
    btn.innerHTML = following ? '<i class="fa-solid fa-check"></i> Following' : '<i class="fa-solid fa-plus"></i> Follow';
    btn.setAttribute("aria-pressed", String(following));
    btn.title = following ? "Stop getting notifications about this seller's new ads" : "Get a notification when this seller posts a new ad";
  };
  paint(); btn.hidden = false;

  btn.onclick = async () => {
    const me = auth.currentUser;
    if (!me) { location.href = `login.html?next=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`; return; }
    btn.disabled = true;
    const followRef = F.doc(db, "follows", `${me.uid}_${sid}`), sellerRef = F.doc(db, "sellers", sid);
    try {
      const batch = F.writeBatch(db);   // the follow and the follower count change together
      if (following) { batch.delete(followRef); batch.update(sellerRef, { followers: F.increment(-1) }); }
      else { batch.set(followRef, { followerId: me.uid, sellerId: sid, createdAt: F.serverTimestamp() }); batch.update(sellerRef, { followers: F.increment(1) }); }
      await batch.commit();
      following = !following;
      count = Math.max(0, count + (following ? 1 : -1));
      onCount(count); paint();
      if (following) Swal.fire({ toast: true, position: "top", icon: "success", title: "You'll be notified when they post a new ad", timer: 2500, showConfirmButton: false });
    } catch (err) {
      console.error(err.code, err);
      Swal.fire({ icon: "error", title: "Couldn't update", text: "Please try again.", confirmButtonColor: "#0a3fc4" });
    }
    btn.disabled = false;
  };
}
