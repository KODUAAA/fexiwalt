// The notification bell in the header (signed-in people only).
//
// What it shows:
//   • notifications/<id> written for you: "Your ad was approved", "Your ad was rejected: reason",
//     "New ad from <seller you follow>" (admins write these when they approve / reject, see js/pages/admin.js)
//   • Admins: how many ads are waiting for review and how many reports are open (counted live, nothing stored)
//   • Sellers: new views and WhatsApp taps on your ads since you last opened the bell
//
// Everything runs inside the website; nothing reaches a phone while the site is closed (that would be push
// notifications, which need Firebase's paid Blaze plan).
import { auth, A, db, F } from "../core/firebase.js";
import { isAdmin } from "../core/roles.js";
import { esc, timeAgo } from "../core/util.js";

const bell = document.querySelector(".hd .bell");
const badge = bell?.querySelector(".bell-count");
let panel;
let stored = [];        // notifications documents
let adminItems = [];    // computed admin items
let statsItem = null;   // computed seller stats item
let statsNow = null;    // current totals, saved as "seen" when the bell is opened
let unsubscribe = null;
let adminTimer = null;

const statsKey = uid => `fx-stats-${uid}`;
const readSeen = uid => { try { return JSON.parse(localStorage.getItem(statsKey(uid))) || null; } catch { return null; } };
const saveSeen = (uid, v) => { try { localStorage.setItem(statsKey(uid), JSON.stringify(v)); } catch { /* private mode */ } };

const ICON = { approved: "fa-circle-check ok", rejected: "fa-circle-xmark bad", "follow-ad": "fa-store", admin: "fa-user-shield", stats: "fa-chart-line", info: "fa-bell" };

function unread() {
  return stored.filter(n => !n.read).length + adminItems.reduce((a, i) => a + i.count, 0) + (statsItem ? 1 : 0);
}

function paintBadge() {
  if (!badge) return;
  const n = unread();
  badge.textContent = n > 99 ? "99+" : String(n);
  badge.hidden = n === 0;
  bell.setAttribute("aria-label", n ? `Notifications, ${n} new` : "Notifications");
}

function item({ id = "", type, title, body = "", link = "#", time = "", fresh = false }) {
  if (!/^[\w-]+\.html([?#][^\s"'<>]*)?$/.test(link)) link = "#";   // only links to our own pages
  return `<a class="nt-item${fresh ? " new" : ""}" href="${esc(link)}" data-nid="${esc(id)}">
    <i class="fa-solid ${ICON[type] || ICON.info}" aria-hidden="true"></i>
    <span><b>${esc(title)}</b>${body ? `<small>${esc(body)}</small>` : ""}${time ? `<em>${esc(time)}</em>` : ""}</span>
  </a>`;
}

function paintPanel() {
  if (!panel) return;
  const rows = [
    ...adminItems.map(i => item({ type: "admin", title: i.title, body: i.body, link: i.link, fresh: true })),
    ...(statsItem ? [item({ type: "stats", ...statsItem, fresh: true })] : []),
    ...stored.map(n => item({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link || "#", time: n.createdAt ? timeAgo(n.createdAt) : "", fresh: !n.read }))
  ];
  panel.querySelector(".nt-list").innerHTML = rows.length ? rows.join("")
    : '<div class="nt-empty"><i class="fa-regular fa-bell-slash" aria-hidden="true"></i><p>No notifications yet.</p></div>';
  panel.querySelector(".nt-all").hidden = !stored.some(n => !n.read);
}

function buildPanel() {
  panel = document.createElement("div");
  panel.className = "nt-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Notifications");
  panel.innerHTML = `<div class="nt-head"><b>Notifications</b><button type="button" class="nt-all">Mark all read</button></div><div class="nt-list"></div>`;
  bell.after(panel);

  panel.querySelector(".nt-all").onclick = () => markRead(stored.filter(n => !n.read));
  panel.addEventListener("click", e => {
    const a = e.target.closest(".nt-item");
    if (!a) return;
    const n = stored.find(x => x.id === a.dataset.nid);
    if (n && !n.read) markRead([n]);   // the link still opens
  });
}

async function markRead(list) {
  list.forEach(n => (n.read = true));
  paintBadge(); paintPanel();
  await Promise.all(list.map(n => F.updateDoc(F.doc(db, "notifications", n.id), { read: true }).catch(() => {})));
}

function open() {
  if (!panel) buildPanel();
  paintPanel();
  panel.hidden = false;
  bell.setAttribute("aria-expanded", "true");
  // opening the bell counts as having seen the view / WhatsApp numbers
  if (statsItem && statsNow && auth.currentUser) { saveSeen(auth.currentUser.uid, statsNow); statsItem = null; paintBadge(); }
}
function close() {
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  bell.setAttribute("aria-expanded", "false");
}

bell?.addEventListener("click", e => { e.stopPropagation(); panel && !panel.hidden ? close() : open(); });
document.addEventListener("click", e => { if (panel && !panel.hidden && !panel.contains(e.target) && e.target !== bell) close(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && panel && !panel.hidden) { close(); bell.focus(); } });

// ---- your notifications (live)
function listen(uid) {
  const col = F.collection(db, "notifications");
  const sorted = F.query(col, F.where("to", "==", uid), F.orderBy("createdAt", "desc"), F.limit(30));
  const plain = F.query(col, F.where("to", "==", uid), F.limit(50));   // used until the database index is ready
  const onSnap = snap => {
    stored = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)).slice(0, 30);
    paintBadge(); paintPanel();
  };
  unsubscribe = F.onSnapshot(sorted, onSnap, err => {
    if (err.code === "failed-precondition") unsubscribe = F.onSnapshot(plain, onSnap, e => console.warn("Notifications:", e.code));
    else console.warn("Notifications:", err.code);
  });
}

// ---- admins: ads waiting for review and open reports
async function adminCounts() {
  try {
    const [pending, reports] = await Promise.all([
      F.getCountFromServer(F.query(F.collection(db, "ads"), F.where("status", "==", "pending"))),
      F.getCountFromServer(F.query(F.collection(db, "reports"), F.where("status", "==", "open"))).catch(() => null)
    ]);
    const p = pending.data().count, r = reports ? reports.data().count : 0;
    adminItems = [
      ...(p ? [{ count: p, title: `${p} ad${p === 1 ? "" : "s"} waiting for review`, body: "Approve or reject them in Admin", link: "admin.html" }] : []),
      ...(r ? [{ count: r, title: `${r} open report${r === 1 ? "" : "s"}`, body: "Buyers reported these ads", link: "admin.html" }] : [])
    ];
    paintBadge(); paintPanel();
  } catch (err) { console.warn("Admin counts:", err.code); }
}

// ---- sellers: new views and WhatsApp taps since you last looked
async function sellerStats(uid) {
  try {
    const snap = await F.getDocs(F.query(F.collection(db, "ads"), F.where("sellerId", "==", uid)));
    let views = 0, wa = 0;
    snap.forEach(d => { const a = d.data(); views += a.views || 0; wa += a.waClicks || 0; });
    statsNow = { views, wa };
    const seen = readSeen(uid);
    if (!seen) { saveSeen(uid, statsNow); return; }   // first time: start counting from now
    const dv = views - seen.views, dw = wa - seen.wa;
    if (dv > 0 || dw > 0) {
      const parts = [dv > 0 && `${dv} new view${dv === 1 ? "" : "s"}`, dw > 0 && `${dw} WhatsApp tap${dw === 1 ? "" : "s"}`].filter(Boolean);
      statsItem = { title: `Your ads got ${parts.join(" and ")}`, body: "See each ad's numbers in My Ads", link: "my-ads.html" };
      paintBadge(); paintPanel();
    }
  } catch (err) { console.warn("Seller stats:", err.code); }
}

A.onAuthStateChanged(auth, async user => {
  unsubscribe?.(); unsubscribe = null;
  clearInterval(adminTimer);
  stored = []; adminItems = []; statsItem = null; statsNow = null;
  close();
  if (!bell) return;
  bell.hidden = !user;
  paintBadge();
  if (!user) return;
  listen(user.uid);
  sellerStats(user.uid);
  if (await isAdmin(user)) { adminCounts(); adminTimer = setInterval(adminCounts, 60000); }
});
