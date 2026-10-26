// Top Sellers: everyone with live ads, ranked by how many live ads they have.
import { db, F } from "../core/firebase.js";
import { esc, isExpired } from "../core/util.js";

const grid = document.getElementById("sellersGrid");
const summary = document.getElementById("sellersSummary");
const initials = name => String(name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

function card(s, rank) {
  return `<a class="seller-card" href="seller.html?id=${encodeURIComponent(s.id)}">
    <span class="rank">${rank}</span>
    <div class="avatar">${esc(initials(s.name))}</div>
    <h3>${esc(s.name)}${s.verified ? ' <i class="fa-solid fa-circle-check verified-tick" title="Verified seller"></i>' : ""}</h3>
    <div class="meta"><b>${s.count}</b> live ad${s.count === 1 ? "" : "s"}</div>
    <small>${esc([...s.cats].slice(0, 2).join(", "))}</small>
    <span class="view">View profile <i class="fa-solid fa-arrow-right"></i></span>
  </a>`;
}

async function load() {
  grid.innerHTML = '<div class="ads-msg"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  try {
    const [snap, sellerSnap] = await Promise.all([
      F.getDocs(F.query(F.collection(db, "ads"), F.where("status", "==", "approved"))),
      F.getDocs(F.collection(db, "sellers")).catch(() => ({ docs: [] }))
    ]);
    const verified = new Set(sellerSnap.docs.filter(d => d.data().verified).map(d => d.id));
    const by = new Map();
    snap.forEach(d => {
      const a = d.data();
      if (!a.sellerId || isExpired(a)) return;   // expired ads do not count
      const s = by.get(a.sellerId) || { id: a.sellerId, name: a.sellerName || "Seller", count: 0, cats: new Set() };
      s.count++; if (a.category) s.cats.add(a.category);
      s.verified = verified.has(a.sellerId);
      by.set(a.sellerId, s);
    });
    const sellers = [...by.values()].sort((a, b) => (b.verified - a.verified) || b.count - a.count || a.name.localeCompare(b.name)).slice(0, 24);

    summary.textContent = sellers.length ? `${sellers.length} seller${sellers.length === 1 ? "" : "s"}, ranked by live ads` : "No sellers yet.";
    grid.innerHTML = sellers.length ? sellers.map((s, i) => card(s, i + 1)).join("")
      : `<div class="ads-msg"><i class="fa-solid fa-store"></i><h3>No sellers yet</h3><p>Sellers appear here once they have a live ad.</p>
         <a href="post-ad.html" class="btn solid">Post an Ad</a></div>`;
  } catch (err) {
    console.error(err.code, err);
    summary.textContent = "";
    grid.innerHTML = `<div class="ads-msg"><i class="fa-solid fa-triangle-exclamation"></i><h3>Couldn't load sellers</h3>
      <p>${err.code === "permission-denied" ? "Something went wrong on our side. Please try again in a moment." : "Check your connection and try again."}</p></div>`;
  }
}
load();
