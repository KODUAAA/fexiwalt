// My Ads: lists the logged-in seller's own ads (any status) and lets them delete one.
import { auth, A, db, F } from "../core/firebase.js";
import { esc, money, timeAgo, isExpired, daysLeft, newExpiryMs, EXPIRY_DAYS } from "../core/util.js";
import { optimizeImg } from "../features/cloudinary.js";
import { deleteImages } from "../features/adstore.js";
import { banInfo } from "../core/roles.js";

let current = []; // ads currently shown (used to find a deleted ad's photos)

const list = document.getElementById("myList");
const summary = document.getElementById("summary");

const STATUS = {
  pending: ["Pending review", "pending"],
  approved: ["Live", "approved"],
  rejected: ["Rejected", "rejected"],
  sold: ["Sold", "sold"],
  expired: ["Expired", "expired"]
};
// a live ad whose 60 days are up is shown as "Expired" (the site has already stopped showing it)
const stateOf = ad => (ad.status === "approved" && isExpired(ad) ? "expired" : ad.status);

const skeletons = n => Array.from({ length: n }, () => '<div class="my-item skeleton"></div>').join("");

function row(ad) {
  const state = stateOf(ad);
  const [label, cls] = STATUS[state] || [state, "pending"];
  const id = esc(ad.id), left = daysLeft(ad);
  const img = ad.images?.[0];
  return `<article class="my-item" data-id="${esc(ad.id)}">
    <div class="my-img">${img ? `<img loading="lazy" src="${esc(optimizeImg(img, 300))}" alt="">` : '<i class="fa-regular fa-image"></i>'}</div>
    <div class="my-info">
      <h3>${esc(ad.title)}</h3>
      <div class="ad-price">${money(ad.price)}</div>
      <div class="ad-meta"><span><i class="fa-solid fa-location-dot"></i> ${esc(ad.location)}</span><span>${timeAgo(ad.createdAt)}</span></div>
      <span class="status ${cls}">${esc(label)}</span>
      ${state === "approved" ? `<span class="life${left <= 7 ? " soon" : ""}"><i class="fa-regular fa-clock"></i> Expires in ${left} day${left === 1 ? "" : "s"}</span>` : ""}
      ${ad.views || ad.waClicks ? `<span class="ad-stats"><span title="People who opened this ad"><i class="fa-regular fa-eye"></i> ${ad.views || 0} view${ad.views === 1 ? "" : "s"}</span><span title="Taps on the WhatsApp button"><i class="fa-brands fa-whatsapp"></i> ${ad.waClicks || 0} WhatsApp tap${ad.waClicks === 1 ? "" : "s"}</span></span>` : ""}
      ${state === "expired" ? '<div class="why">This ad is no longer shown to buyers. Renew it to put it back for 60 days.</div>' : ""}
      ${state === "sold" ? '<div class="why">Hidden from buyers. Tap Relist if it is available again.</div>' : ""}
      ${ad.status === "rejected" ? `<div class="why"><b>Why:</b> ${esc(ad.rejectReason || "Not approved")}${ad.rejectNote ? ` · ${esc(ad.rejectNote)}` : ""}
        <br>Edit the ad to fix this, and it will be reviewed again.</div>` : ""}
    </div>
    <div class="my-actions">
      ${state === "approved" || state === "sold" ? `<a class="btn cancel sm" href="ad.html?id=${encodeURIComponent(ad.id)}">View</a>` : ""}
      ${state === "approved" ? `<button class="btn ok sm" data-sold="${id}"><i class="fa-solid fa-circle-check"></i> Mark as sold</button>` : ""}
      ${state === "expired" ? `<button class="btn ok sm" data-renew="${id}"><i class="fa-solid fa-rotate"></i> Renew</button>` : ""}
      ${state === "sold" ? `<button class="btn ok sm" data-relist="${id}"><i class="fa-solid fa-rotate-left"></i> Relist</button>` : ""}
      ${state === "sold" ? "" : `<a class="btn cancel sm" href="post-ad.html?edit=${encodeURIComponent(ad.id)}"><i class="fa-regular fa-pen-to-square"></i> Edit</a>`}
      <button class="btn del sm" data-del="${esc(ad.id)}"><i class="fa-regular fa-trash-can"></i> Delete</button>
    </div>
  </article>`;
}

async function load(user) {
  list.innerHTML = skeletons(3);
  try {
    const snap = await F.getDocs(F.query(F.collection(db, "ads"), F.where("sellerId", "==", user.uid)));
    const ads = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    current = ads;
    summary.textContent = ads.length ? `${ads.length} ad${ads.length > 1 ? "s" : ""}` : "You haven't posted any ads yet.";
    list.innerHTML = ads.length ? ads.map(row).join("") :
      `<div class="ads-msg"><i class="fa-solid fa-store"></i><h3>No ads yet</h3><p>Post your first ad and reach buyers across Ghana.</p><a href="post-ad.html" class="btn solid">Post an Ad</a></div>`;
  } catch (err) {
    console.error(err.code, err);
    summary.textContent = "";
    list.innerHTML = `<div class="ads-msg"><i class="fa-solid fa-triangle-exclamation"></i><h3>Couldn't load your ads</h3>
      <p>${err.code === "permission-denied" ? "Something went wrong on our side. Please log out and in again." : "Check your connection and try again."}</p></div>`;
  }
}

// ---- mark as sold, relist, renew (the Firestore rules allow exactly these changes to your own ads)
async function changeAd(btn, { confirm, changes, done }) {
  if (confirm) {
    const { isConfirmed } = await Swal.fire({ ...confirm, showCancelButton: true, confirmButtonColor: "#0aa591" });
    if (!isConfirmed) return;
  }
  btn.disabled = true;
  try {
    await F.updateDoc(F.doc(db, "ads", btn.dataset.sold || btn.dataset.relist || btn.dataset.renew), changes());
    await load(auth.currentUser);
    Swal.fire({ icon: "success", title: done, timer: 1800, showConfirmButton: false });
  } catch (err) {
    console.error(err.code, err);
    btn.disabled = false;
    Swal.fire({ icon: "error", confirmButtonColor: "#0a3fc4", title: "Couldn't update the ad",
      text: err.code === "permission-denied" ? "This change isn't allowed. Your account may be suspended. Contact us if you think this is a mistake." : "Please try again." });
  }
}
const newExpiry = () => F.Timestamp.fromMillis(newExpiryMs());

list.addEventListener("click", e => {
  const sold = e.target.closest("[data-sold]"), relist = e.target.closest("[data-relist]"), renew = e.target.closest("[data-renew]");
  if (sold) changeAd(sold, {
    confirm: { icon: "question", title: "Mark as sold?", text: "It will be hidden from buyers straight away. You can relist it later if it becomes available again.", confirmButtonText: "Yes, it's sold" },
    changes: () => ({ status: "sold", soldAt: F.serverTimestamp() }),
    done: "Marked as sold"
  });
  else if (relist) changeAd(relist, {
    confirm: { icon: "question", title: "Relist this ad?", text: `It will be shown to buyers again for ${EXPIRY_DAYS} days.`, confirmButtonText: "Relist" },
    changes: () => ({ status: "approved", soldAt: F.deleteField(), expiresAt: newExpiry(), renewedAt: F.serverTimestamp() }),
    done: "Ad relisted"
  });
  else if (renew) changeAd(renew, {
    changes: () => ({ expiresAt: newExpiry(), renewedAt: F.serverTimestamp() }),
    done: `Renewed for ${EXPIRY_DAYS} days`
  });
});

list.addEventListener("click", async e => {
  const btn = e.target.closest("[data-del]");
  if (!btn) return;
  const { isConfirmed } = await Swal.fire({
    icon: "warning", title: "Delete this ad?", text: "This can't be undone.",
    showCancelButton: true, confirmButtonText: "Yes, delete", confirmButtonColor: "#e11d48"
  });
  if (!isConfirmed) return;
  const ad = current.find(a => a.id === btn.dataset.del);
  btn.disabled = true;
  try {
    await F.deleteDoc(F.doc(db, "ads", btn.dataset.del));   // 1) remove the ad itself
    if (ad?.images?.length) await deleteImages(ad.images);   // 2) then its photos from Storage (best effort)
    await load(auth.currentUser);
    Swal.fire({ icon: "success", title: "Ad deleted", timer: 1500, showConfirmButton: false });
  } catch (err) {
    console.error(err.code, err);
    btn.disabled = false;
    Swal.fire({ icon: "error", title: "Couldn't delete", text: "Please try again.", confirmButtonColor: "#0a3fc4" });
  }
});

// a suspended account gets a clear notice at the top of this page
async function showBanNotice(user) {
  const info = await banInfo(user);
  if (!info) return;
  const box = document.createElement("div");
  box.className = "ban-note";
  box.innerHTML = '<i class="fa-solid fa-user-slash"></i><div><b>Your account is suspended.</b> You can still browse and manage your existing ads, but you cannot post or edit ads.<span></span></div>';
  if (info.reason) box.querySelector("span").textContent = ` Reason: ${info.reason}`;   // plain text, never HTML
  document.querySelector(".page-head").after(box);
}

// wait for Firebase to restore the session (session.js redirects if logged out)
const off = A.onAuthStateChanged(auth, user => { if (user) { off(); load(user); showBanNotice(user); } });
