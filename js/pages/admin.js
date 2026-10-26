// Admin dashboard: stats, ads (approve / reject with a reason / delete), reports, and users (promote / ban).
// Access is checked here (UI) AND enforced by firebase/firestore.rules (real security).
import { auth, A, db, F } from "../core/firebase.js";
import { isAdmin } from "../core/roles.js";
import { deleteImages } from "../features/adstore.js";
import { esc, money, timeAgo, isExpired, EXPIRY_DAYS } from "../core/util.js";
import { optimizeImg } from "../features/cloudinary.js";

const $ = id => document.getElementById(id);
const main = $("adminMain"), deny = $("deny"), wrap = $("tableWrap");

let view = "pending";     // all | pending | approved | rejected | reports | users
let ads = [];             // every ad, any status (admins may read them all)
let users = [];           // every profile document in the users collection
let reports = [];         // ads reported by buyers
let verified = new Set(); // seller ids marked verified (sellers/<uid>.verified)
let query = "";           // search box text
let catFilter = "";       // category filter (ad views)
let userFilter = "";      // "", admin, banned, active (users view)

const swal = o => Swal.fire({ confirmButtonColor: "#0a3fc4", ...o });
const ts = t => t?.toMillis?.() ?? 0;
const STATUS = { pending: "Pending", approved: "Live", rejected: "Rejected", sold: "Sold", expired: "Expired" };
// a live ad past its 60 days is shown as "Expired" (buyers no longer see it)
const stateOf = ad => (ad.status === "approved" && isExpired(ad) ? "expired" : ad.status);
const me = () => auth.currentUser?.uid;

// The reasons an admin can give when rejecting or taking down an ad. The seller sees the reason in My Ads.
const REJECT_REASONS = [
  "Prohibited or illegal item", "Misleading or fake ad", "Suspected scam", "Unclear or poor photos",
  "Wrong category", "Duplicate ad", "Missing or wrong contact details", "Account suspended", "Other"
];
// map a buyer's report reason onto the closest rejection reason
const FROM_REPORT = { "Scam or fraud": "Suspected scam", "Fake or misleading ad": "Misleading or fake ad", "Prohibited item": "Prohibited or illegal item", "Wrong category": "Wrong category", "Duplicate ad": "Duplicate ad" };

// ---------- data ----------
async function loadAll() {
  wrap.innerHTML = '<div class="table-skel"></div>';
  try {
    const [adSnap, userSnap, repSnap, sellerSnap] = await Promise.all([
      F.getDocs(F.collection(db, "ads")),
      F.getDocs(F.collection(db, "users")),
      // reports need the newest Firestore rules; if they aren't published yet, the rest of the dashboard still works
      F.getDocs(F.collection(db, "reports")).catch(err => { console.warn("Reports unavailable:", err.code); return { docs: [] }; }),
      F.getDocs(F.collection(db, "sellers")).catch(err => { console.warn("Sellers unavailable:", err.code); return { docs: [] }; })
    ]);
    verified = new Set(sellerSnap.docs.filter(d => d.data().verified).map(d => d.id));
    reports = repSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    ads = adSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
    users = userSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
    fillCategories();
    render();
  } catch (err) {
    console.error(err.code, err);
    wrap.innerHTML = `<div class="ads-msg"><i class="fa-solid fa-triangle-exclamation"></i><h3>Couldn't load data</h3>
      <p>${err.code === "permission-denied" ? "Your account doesn't have admin access, or your session expired. Log out and in again." : "Check your connection and press Refresh."}</p></div>`;
  }
}

// ---------- search + filters ----------
// every word typed must appear somewhere in the row's text
const matches = (fields, q) => {
  if (!q) return true;
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
};

function fillCategories() {
  const sel = $("adminCat"), keep = sel.value;
  const cats = [...new Set(ads.map(a => a.category).filter(Boolean))].sort();
  sel.replaceChildren(new Option("All categories", ""), ...cats.map(c => new Option(c, c)));
  sel.value = cats.includes(keep) ? keep : "";
  catFilter = sel.value;
}

function adsFiltered() {
  return (view === "all" ? ads : ads.filter(a => a.status === view))
    .filter(a => (!catFilter || a.category === catFilter)
      && matches([a.title, a.description, a.sellerName, a.phone, a.category, a.location, a.id], query));
}

function usersFiltered() {
  return users.filter(u => (userFilter === "admin" ? u.role === "admin" : userFilter === "banned" ? u.banned === true : userFilter === "active" ? u.banned !== true : true)
    && matches([u.name, u.email, u.role, u.banned ? "banned suspended" : "", u.id], query));
}

function reportsFiltered() {
  return reports.filter(r => matches([r.adTitle, r.reason, r.details, r.status], query));
}

// ---------- rendering ----------
function stats() {
  const n = s => ads.filter(a => a.status === s).length;
  $("sTotal").textContent = ads.length;
  $("sPending").textContent = n("pending");
  $("sApproved").textContent = ads.filter(a => a.status === "approved" && !isExpired(a)).length;   // live = approved and not expired
  $("sSold").textContent = n("sold");
  $("sUsers").textContent = users.length;
  $("cPending").textContent = n("pending");
  const open = reports.filter(r => r.status === "open").length;
  $("sReports").textContent = open;
  $("cReports").textContent = open;
  $("cReports").hidden = !open;
}

function adRow(ad) {
  const img = ad.images?.[0];
  const state = stateOf(ad);
  const approve = ad.status !== "approved" && ad.status !== "sold"
    ? `<button class="btn ok sm" data-act="approved" data-id="${esc(ad.id)}"><i class="fa-solid fa-check"></i> Approve</button>` : "";
  const reject = ad.status !== "rejected"
    ? `<button class="btn del sm" data-act="rejected" data-id="${esc(ad.id)}"><i class="fa-solid fa-xmark"></i> ${ad.status === "approved" ? "Take down" : "Reject"}</button>` : "";
  const why = ad.status === "rejected" && ad.rejectReason
    ? `<small class="why">Reason: ${esc(ad.rejectReason)}${ad.rejectNote ? ` · ${esc(ad.rejectNote)}` : ""}</small>` : "";
  return `<tr>
    <td><div class="thumb">${img ? `<img loading="lazy" src="${esc(optimizeImg(img, 300))}" alt="">` : '<i class="fa-regular fa-image"></i>'}</div></td>
    <td class="t-title"><b>${esc(ad.title)}</b><small>${money(ad.price)} · ${esc(ad.category)}</small>
      <details><summary>Description</summary><p>${esc(ad.description)}</p></details></td>
    <td>${esc(ad.sellerName || "—")}<small>${esc(ad.phone || "no phone")}</small></td>
    <td>${esc(ad.location)}</td>
    <td><span class="status ${esc(state)}">${esc(STATUS[state] || state)}</span>${why}</td>
    <td class="nowrap">${timeAgo(ad.createdAt)}</td>
    <td class="acts">${approve}${reject}
      <button class="btn del sm icon" data-del="${esc(ad.id)}" title="Delete permanently" aria-label="Delete permanently"><i class="fa-regular fa-trash-can"></i></button></td>
  </tr>`;
}

function adsTable() {
  const rows = adsFiltered();
  if (!rows.length) {
    const filtered = query || catFilter;
    return `<div class="ads-msg"><i class="fa-regular fa-circle-check"></i><h3>${filtered ? "No matches" : "Nothing here"}</h3>
      <p>${filtered ? "No ads match your search or filter." : view === "all" ? "No ads have been posted yet." : `No ${view} ads right now.`}</p></div>`;
  }
  return `<table class="tbl"><thead><tr><th></th><th>Ad</th><th>Seller</th><th>Location</th><th>Status</th><th>Posted</th><th>Actions</th></tr></thead>
    <tbody>${rows.map(adRow).join("")}</tbody></table>`;
}

function userRow(u) {
  const adCount = ads.filter(a => a.sellerId === u.id).length;
  const isMe = u.id === me(), isAdm = u.role === "admin", banned = u.banned === true, ver = verified.has(u.id);
  const verifyBtn = banned ? "" : ver
    ? `<button class="btn cancel sm" data-user="unverify" data-id="${esc(u.id)}"><i class="fa-solid fa-circle-minus"></i> Unverify</button>`
    : `<button class="btn ok sm" data-user="verify" data-id="${esc(u.id)}"><i class="fa-solid fa-circle-check"></i> Verify seller</button>`;
  const actions = isMe ? `<span class="you">This is you</span> ${verifyBtn}` : `
    ${verifyBtn}
    ${isAdm
      ? `<button class="btn cancel sm" data-user="demote" data-id="${esc(u.id)}"><i class="fa-solid fa-user-minus"></i> Remove admin</button>`
      : `<button class="btn cancel sm" data-user="promote" data-id="${esc(u.id)}"><i class="fa-solid fa-user-shield"></i> Make admin</button>`}
    ${isAdm ? "" : banned
      ? `<button class="btn ok sm" data-user="unban" data-id="${esc(u.id)}"><i class="fa-solid fa-user-check"></i> Unban</button>`
      : `<button class="btn del sm" data-user="ban" data-id="${esc(u.id)}"><i class="fa-solid fa-user-slash"></i> Ban</button>`}`;
  const why = banned && u.bannedReason ? `<small class="why">${esc(u.bannedReason)}</small>` : "";
  return `<tr>
    <td><b>${esc(u.name || "—")}</b>${ver ? ' <i class="fa-solid fa-circle-check verified-tick" title="Verified seller"></i>' : ""}</td>
    <td>${esc(u.email || "—")}</td>
    <td><span class="status ${isAdm ? "approved" : "pending"}">${esc(u.role || "user")}</span></td>
    <td>${banned ? '<span class="status rejected">Banned</span>' : '<span class="status approved">Active</span>'}${why}</td>
    <td>${adCount}</td>
    <td class="nowrap">${u.createdAt ? timeAgo(u.createdAt) : "—"}</td>
    <td class="acts">${actions}</td></tr>`;
}

function usersTable() {
  const rows = usersFiltered();
  if (!rows.length) {
    return `<div class="ads-msg"><i class="fa-solid fa-users"></i><h3>${query || userFilter ? "No matches" : "No users yet"}</h3>
      <p>${query || userFilter ? "No users match your search or filter." : "Users appear here once they register."}</p></div>`;
  }
  return `<table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Ads</th><th>Joined</th><th>Actions</th></tr></thead>
    <tbody>${rows.map(userRow).join("")}</tbody></table>
    <p class="note">Shows accounts that have a profile document. Accounts created before profiles were saved
    (or by hand in the Firebase console) may be missing; see <b>Authentication → Users</b> for the full list.
    A banned person can still log in and browse, but cannot post or edit ads.
    <b>Verified sellers</b> get a badge and can be followed; their followers are notified about each new ad you approve.</p>`;
}

const REP_STATUS = { open: ["Open", "pending"], resolved: ["Resolved", "approved"], dismissed: ["Dismissed", "rejected"] };

function reportsTable() {
  const list = reportsFiltered();
  if (!list.length) {
    return `<div class="ads-msg"><i class="fa-regular fa-flag"></i><h3>${query ? "No matches" : "No reports"}</h3><p>${query ? "No reports match your search." : "Ads that buyers report will show up here."}</p></div>`;
  }
  const order = { open: 0, resolved: 1, dismissed: 2 };
  const rows = [...list].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || ts(b.createdAt) - ts(a.createdAt));
  const perAd = id => reports.filter(r => r.adId === id && r.status === "open").length;
  return `<table class="tbl"><thead><tr><th>Ad</th><th>Reason</th><th>Details</th><th>Status</th><th>Reported</th><th>Actions</th></tr></thead>
    <tbody>${rows.map(r => {
      const [label, cls] = REP_STATUS[r.status] || [r.status, "pending"];
      const many = r.status === "open" && perAd(r.adId) > 1 ? `<small><b>${perAd(r.adId)}</b> open reports on this ad</small>` : "";
      const open = r.status === "open";
      return `<tr>
        <td class="t-title"><b>${esc(r.adTitle || "(untitled)")}</b>${many}
          <small><a href="ad.html?id=${encodeURIComponent(r.adId)}" target="_blank" rel="noopener">View ad</a></small></td>
        <td>${esc(r.reason)}</td>
        <td class="t-title"><small style="white-space:pre-line;color:var(--text)">${esc(r.details || "—")}</small></td>
        <td><span class="status ${cls}">${esc(label)}</span></td>
        <td class="nowrap">${timeAgo(r.createdAt)}</td>
        <td class="acts">${open ? `
          <button class="btn del sm" data-rep="takedown" data-id="${esc(r.id)}" data-ad="${esc(r.adId)}"><i class="fa-solid fa-ban"></i> Take down ad</button>
          <button class="btn cancel sm" data-rep="dismiss" data-id="${esc(r.id)}">Dismiss</button>` : ""}</td>
      </tr>`;
    }).join("")}</tbody></table>`;
}

function render() {
  stats();
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.view === view));
  // toolbar: which filters make sense for this view
  $("adminCat").hidden = view === "users" || view === "reports";
  $("adminUserFilter").hidden = view !== "users";
  $("adminSearch").placeholder = view === "users" ? "Search users by name or email…" : view === "reports" ? "Search reports…" : "Search ads by title, seller, phone, location…";
  const count = view === "users" ? usersFiltered().length : view === "reports" ? reportsFiltered().length : adsFiltered().length;
  $("resultCount").textContent = `${count} result${count === 1 ? "" : "s"}`;
  wrap.innerHTML = view === "users" ? usersTable() : view === "reports" ? reportsTable() : adsTable();
}

// ---------- rejection reason dialog ----------
async function askReason({ title, lead, confirmText, preselect = "" }) {
  const { value } = await swal({
    icon: "warning", title,
    html: `<p style="margin-bottom:.6rem">${lead}</p>
           <select id="rjReason" class="swal2-select" style="width:90%;margin:.3rem 0">
             <option value="">Choose a reason…</option>${REJECT_REASONS.map(r => `<option>${esc(r)}</option>`).join("")}
           </select>
           <textarea id="rjNote" class="swal2-textarea" maxlength="300" placeholder="Optional note for the seller (they will see it)" style="width:90%;margin:.3rem 0"></textarea>`,
    showCancelButton: true, confirmButtonText: confirmText, confirmButtonColor: "#e11d48", focusConfirm: false,
    didOpen: () => { if (preselect) document.getElementById("rjReason").value = preselect; },
    preConfirm: () => {
      const reason = document.getElementById("rjReason").value;
      if (!reason) { Swal.showValidationMessage("Please choose a reason"); return false; }
      return { reason, note: document.getElementById("rjNote").value.trim().slice(0, 300) };
    }
  });
  return value || null;
}

// ---------- verified sellers + notifications ----------
// A verified seller gets a badge on their ads and profile, and buyers can follow them.
async function setVerified(u, on) {
  const who = u.name || u.email || "this seller";
  const { isConfirmed } = await swal({
    icon: "question",
    title: on ? `Verify ${esc(who)}?` : `Remove verification from ${esc(who)}?`,
    text: on ? "They get a \"Verified seller\" badge, and buyers can follow them to hear about their new ads. Only verify sellers you have checked."
             : "The badge disappears and buyers can no longer follow them. Existing followers stop getting notifications.",
    showCancelButton: true, confirmButtonText: on ? "Verify" : "Remove", confirmButtonColor: on ? "#0aa591" : "#e11d48"
  });
  if (!isConfirmed) return;
  try {
    await F.setDoc(F.doc(db, "sellers", u.id), on
      ? { verified: true, name: u.name || "Seller", verifiedAt: F.serverTimestamp(), verifiedBy: me() }
      : { verified: false }, { merge: true });
    on ? verified.add(u.id) : verified.delete(u.id);
    render();
    swal({ icon: "success", title: on ? "Seller verified" : "Verification removed", timer: 1500, showConfirmButton: false });
  } catch (err) {
    console.error(err.code, err);
    swal({ icon: "error", title: "Couldn't update", text: "Please try again." });
  }
}

const makeNote = (to, type, title, body, link) =>
  ({ to, type, title, body, link, read: false, createdAt: F.serverTimestamp() });

// tell the seller their ad was approved / rejected (best effort: the review itself already succeeded)
async function notifySeller(ad, approved, reason = "") {
  if (!ad.sellerId) return;
  const n = approved
    ? makeNote(ad.sellerId, "approved", "Your ad is live", `“${ad.title}” was approved and buyers can now see it.`, `ad.html?id=${encodeURIComponent(ad.id)}`)
    : makeNote(ad.sellerId, "rejected", "Your ad was not approved", `“${ad.title}”: ${reason || "see My Ads"}. Edit it and it will be reviewed again.`, "my-ads.html");
  await F.addDoc(F.collection(db, "notifications"), n).catch(err => console.warn("Seller notification:", err.code));
}

// a verified seller's NEW ad goes live: notify everyone who follows them (once per ad)
async function notifyFollowers(ad) {
  if (!ad.sellerId || !verified.has(ad.sellerId) || ad.followersNotified) return;
  try {
    const snap = await F.getDocs(F.query(F.collection(db, "follows"), F.where("sellerId", "==", ad.sellerId)));
    const followers = snap.docs.map(d => d.data().followerId).filter(Boolean);
    const seller = ad.sellerName || "A seller you follow";
    for (let i = 0; i < followers.length; i += 450) {   // a batch holds up to 500 writes
      const batch = F.writeBatch(db);
      followers.slice(i, i + 450).forEach(uid => batch.set(F.doc(F.collection(db, "notifications")),
        makeNote(uid, "follow-ad", `New ad from ${seller}`, `${ad.title} · GH₵ ${Number(ad.price).toLocaleString()}`, `ad.html?id=${encodeURIComponent(ad.id)}`)));
      await batch.commit();
    }
    await F.updateDoc(F.doc(db, "ads", ad.id), { followersNotified: true });
    ad.followersNotified = true;
  } catch (err) { console.warn("Follower notifications:", err.code); }
}

// ---------- ad actions ----------
async function setStatus(id, next) {
  const ad = ads.find(a => a.id === id);
  if (!ad) return;
  const base = { status: next, reviewedAt: F.serverTimestamp(), reviewedBy: me() };
  let extra;

  if (next === "approved") {
    const { isConfirmed } = await swal({
      icon: "question", title: "Approve this ad?", text: ad.title,
      showCancelButton: true, confirmButtonText: "Approve", confirmButtonColor: "#0aa591"
    });
    if (!isConfirmed) return;
    // clear any old rejection message, and start the ad's 60-day lifetime
    extra = { rejectReason: F.deleteField(), rejectNote: F.deleteField(), expiresAt: F.Timestamp.fromMillis(Date.now() + EXPIRY_DAYS * 864e5) };
  } else {
    const r = await askReason({
      title: ad.status === "approved" ? "Take down this ad?" : "Reject this ad?",
      lead: `“${esc(ad.title)}” will be hidden from the site. The seller will see your reason and can edit and resubmit.`,
      confirmText: ad.status === "approved" ? "Take down" : "Reject"
    });
    if (!r) return;
    extra = { rejectReason: r.reason, rejectNote: r.note };
  }

  try {
    await F.updateDoc(F.doc(db, "ads", id), { ...base, ...extra });
    ad.status = next;                                       // update locally so the table changes instantly
    if (next === "approved") { delete ad.rejectReason; delete ad.rejectNote; ad.expiresAt = extra.expiresAt; ad.reviewedAt = { toMillis: () => Date.now() }; }
    else { ad.rejectReason = extra.rejectReason; ad.rejectNote = extra.rejectNote; }
    render();
    notifySeller(ad, next === "approved", extra.rejectReason);
    if (next === "approved") notifyFollowers(ad);
  } catch (err) {
    console.error(err.code, err);
    swal({ icon: "error", title: "Couldn't update", text: err.code === "permission-denied" ? "You don't have permission to do this. Log out and in again, then retry." : "Please try again." });
  }
}

async function remove(id) {
  const ad = ads.find(a => a.id === id);
  const { isConfirmed } = await swal({
    icon: "warning", title: "Delete permanently?",
    text: `"${ad?.title}" and its photos will be removed, whatever its status. This can't be undone.`,
    showCancelButton: true, confirmButtonText: "Delete", confirmButtonColor: "#e11d48"
  });
  if (!isConfirmed) return;
  try {
    await F.deleteDoc(F.doc(db, "ads", id));
    if (ad?.images?.length) deleteImages(ad.images); // best effort
    ads = ads.filter(a => a.id !== id);
    render();
  } catch (err) {
    console.error(err.code, err);
    swal({ icon: "error", title: "Couldn't delete", text: "Please try again." });
  }
}

// ---------- report actions: dismiss, or take the reported ad down (which also resolves the report) ----------
async function handleReport(btn) {
  const rep = reports.find(r => r.id === btn.dataset.id);
  if (!rep) return;
  const takedown = btn.dataset.rep === "takedown";
  let reason = null;

  if (takedown) {
    reason = await askReason({
      title: "Take down this ad?",
      lead: `“${esc(rep.adTitle)}” will be rejected and hidden from the site.`,
      confirmText: "Take down", preselect: FROM_REPORT[rep.reason] || ""
    });
    if (!reason) return;
  } else {
    const { isConfirmed } = await swal({
      icon: "warning", title: "Dismiss this report?", text: "The ad stays as it is.",
      showCancelButton: true, confirmButtonText: "Dismiss"
    });
    if (!isConfirmed) return;
  }

  try {
    if (takedown) {
      const note = { rejectReason: reason.reason, rejectNote: reason.note };
      try { await F.updateDoc(F.doc(db, "ads", rep.adId), { status: "rejected", reviewedAt: F.serverTimestamp(), reviewedBy: me(), ...note }); }
      catch (err) { if (err.code !== "not-found") throw err; }   // ad already deleted: still close the report
      const ad = ads.find(a => a.id === rep.adId); if (ad) { Object.assign(ad, { status: "rejected", ...note }); notifySeller(ad, false, note.rejectReason); }
      // every open report about this ad is now handled
      await Promise.all(reports.filter(r => r.adId === rep.adId && r.status === "open").map(async r => {
        await F.updateDoc(F.doc(db, "reports", r.id), { status: "resolved", resolvedBy: me(), resolvedAt: F.serverTimestamp() });
        r.status = "resolved";
      }));
    } else {
      await F.updateDoc(F.doc(db, "reports", rep.id), { status: "dismissed", resolvedBy: me(), resolvedAt: F.serverTimestamp() });
      rep.status = "dismissed";
    }
    render();
  } catch (err) {
    console.error(err.code, err);
    swal({ icon: "error", title: "Couldn't update", text: err.code === "permission-denied" ? "You don't have permission to do this. Log out and in again, then retry." : "Please try again." });
  }
}

// ---------- user actions: promote / demote, ban / unban ----------
async function handleUser(btn) {
  const u = users.find(x => x.id === btn.dataset.id);
  const act = btn.dataset.user;
  if (!u) return;
  if (act === "verify" || act === "unverify") return setVerified(u, act === "verify");
  if (u.id === me()) return;   // you can't change your own role or ban yourself
  const who = u.name || u.email || "this user";
  const ref = F.doc(db, "users", u.id);

  try {
    if (act === "promote" || act === "demote") {
      const promote = act === "promote";
      const { isConfirmed } = await swal({
        icon: promote ? "warning" : "question",
        title: promote ? `Make ${esc(who)} an admin?` : `Remove admin rights from ${esc(who)}?`,
        text: promote ? "Admins can approve, reject and delete any ad, and manage users. Only do this for people you trust." : "They will become a normal user.",
        showCancelButton: true, confirmButtonText: promote ? "Make admin" : "Remove admin",
        confirmButtonColor: promote ? "#e11d48" : "#0a3fc4"
      });
      if (!isConfirmed) return;
      await F.updateDoc(ref, { role: promote ? "admin" : "user" });
      u.role = promote ? "admin" : "user";

    } else if (act === "ban") {
      const { value } = await swal({
        icon: "warning", title: `Ban ${esc(who)}?`,
        html: `<p style="margin-bottom:.6rem">They can still log in and browse, but they will not be able to post or edit ads.</p>
               <textarea id="banReason" class="swal2-textarea" maxlength="200" placeholder="Reason (optional, shown to them)" style="width:90%;margin:.3rem 0"></textarea>
               <label style="display:flex;gap:.5rem;align-items:center;justify-content:center;font-size:.9rem;margin-top:.6rem">
                 <input type="checkbox" id="banTake" checked> Also take down their live ads</label>`,
        showCancelButton: true, confirmButtonText: "Ban", confirmButtonColor: "#e11d48", focusConfirm: false,
        preConfirm: () => ({ reason: document.getElementById("banReason").value.trim().slice(0, 200), take: document.getElementById("banTake").checked })
      });
      if (!value) return;
      await F.updateDoc(ref, { banned: true, bannedReason: value.reason, bannedAt: F.serverTimestamp(), bannedBy: me() });
      Object.assign(u, { banned: true, bannedReason: value.reason });
      if (value.take) {
        const live = ads.filter(a => a.sellerId === u.id && a.status === "approved");
        const batch = F.writeBatch(db);
        live.forEach(a => batch.update(F.doc(db, "ads", a.id), { status: "rejected", reviewedAt: F.serverTimestamp(), reviewedBy: me(), rejectReason: "Account suspended", rejectNote: "" }));
        if (live.length) await batch.commit();
        live.forEach(a => Object.assign(a, { status: "rejected", rejectReason: "Account suspended", rejectNote: "" }));
      }

    } else if (act === "unban") {
      const { isConfirmed } = await swal({
        icon: "question", title: `Unban ${esc(who)}?`, text: "They will be able to post and edit ads again. Ads taken down when they were banned stay down.",
        showCancelButton: true, confirmButtonText: "Unban", confirmButtonColor: "#0aa591"
      });
      if (!isConfirmed) return;
      await F.updateDoc(ref, { banned: false, bannedReason: F.deleteField(), bannedAt: F.deleteField(), bannedBy: F.deleteField() });
      Object.assign(u, { banned: false, bannedReason: "" });
    }
    render();
  } catch (err) {
    console.error(err.code, err);
    swal({ icon: "error", title: "Couldn't update the user", text: err.code === "permission-denied" ? "You don't have permission to do this. Log out and in again, then retry." : "Please try again." });
  }
}

// ---------- events ----------
wrap.addEventListener("click", e => {
  const a = e.target.closest("[data-act]"), d = e.target.closest("[data-del]"), r = e.target.closest("[data-rep]"), u = e.target.closest("[data-user]");
  if (a) setStatus(a.dataset.id, a.dataset.act);
  else if (d) remove(d.dataset.del);
  else if (r) handleReport(r);
  else if (u) handleUser(u);
});

const setView = v => { view = v; render(); };
$("tabs").addEventListener("click", e => { const t = e.target.closest(".tab"); if (t) setView(t.dataset.view); });
document.querySelector(".stats").addEventListener("click", e => { const s = e.target.closest(".stat"); if (s) { setView(s.dataset.view); scrollTo({ top: $("tabs").offsetTop - 90, behavior: "smooth" }); } });
$("refreshBtn").addEventListener("click", loadAll);

$("adminSearch").addEventListener("input", e => { query = e.target.value.trim(); render(); });
$("adminCat").addEventListener("change", e => { catFilter = e.target.value; render(); });
$("adminUserFilter").addEventListener("change", e => { userFilter = e.target.value; render(); });

// ---------- guard: only admins get past this point ----------
const off = A.onAuthStateChanged(auth, async user => {
  if (!user) return; // session.js sends logged-out visitors to the login page
  off();
  if (await isAdmin(user)) {
    deny.hidden = true; main.hidden = false;
    loadAll();
  } else {
    deny.innerHTML = '<i class="fa-solid fa-lock"></i><h2>Admins only</h2><p>You don\'t have access to this page.</p><a class="btn solid" href="index.html">Back to home</a>';
  }
});
