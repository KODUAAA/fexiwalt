// Runs on every page: shows who is logged in and protects pages.
//
// To make a page login-only, put  data-auth="required"  on its <body>.
// Example (already done for post-ad.html):  <body data-auth="required">
import { auth, A } from "./firebase.js";
import { isAdmin } from "./roles.js";
import "../features/wishlist.js"; // heart buttons + header counter on every page
import "./footer.js";   // shared footer + top-bar social links
import "./theme.js";    // dark mode toggle (must load after footer.js, which builds the footer it adds a button to)
import "./pwa.js";      // installable app: service worker + Install button
import "./a11y.js";     // screen-reader helpers (icons, errors, live counts)
import "../features/notify.js";   // notification bell

const protectedPage = document.body.dataset.auth === "required";
if (protectedPage) document.body.style.visibility = "hidden"; // avoid flashing content to logged-out visitors

const page = location.pathname.split("/").pop() || "index.html";

function paintHeader(user) {
  const account = document.querySelector(".hd-actions a.act");
  if (!account) return;
  const label = account.querySelector("small");

  if (user) {
    const name = user.displayName || user.email.split("@")[0];
    account.href = "my-ads.html"; // clicking your name opens your ads
    account.title = user.email;
    if (label) label.textContent = `Hello, ${name.split(" ")[0]}`;

    if (!document.getElementById("logoutBtn")) {
      const out = document.createElement("a");
      out.href = "#"; out.id = "logoutBtn"; out.className = "act";
      out.innerHTML = '<i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span>Log out</span>';
      out.addEventListener("click", async e => {
        e.preventDefault();
        await A.signOut(auth);
        location.href = "index.html";
      });
      account.parentElement.append(out);
    }
  } else {
    account.href = "login.html";
    if (label) label.textContent = "Sign in";
    document.getElementById("logoutBtn")?.remove();
  }
}

// ---------- mobile menu (opened by the hamburger button) ----------
const CATS = window.SITE_CATEGORIES || ["Electronics", "Vehicles", "Property", "Fashion", "Others"];   // list lives in js/header.js
const burger = document.querySelector(".burger");
let drawer;

function buildDrawer() {
  drawer = document.createElement("div");
  drawer.className = "drawer";
  drawer.hidden = true;
  drawer.innerHTML = `
    <div class="drawer-bg" data-close></div>
    <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="drawer-head"><b>Menu</b><button type="button" class="drawer-x" data-close aria-label="Close menu"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>
      <div class="drawer-user" id="drawerUser"></div>
      <a href="index.html"><i class="fa-solid fa-house" aria-hidden="true"></i> Home</a>
      <a href="category.html?all=1"><i class="fa-solid fa-store" aria-hidden="true"></i> Shop all ads</a>
      <a href="category.html?all=1&sort=new"><i class="fa-solid fa-star" aria-hidden="true"></i> New arrivals</a>
      <a href="category.html?deals=1"><i class="fa-solid fa-bolt" aria-hidden="true"></i> Deals</a>
      <a href="sellers.html"><i class="fa-solid fa-trophy" aria-hidden="true"></i> Top sellers</a>
      <a href="post-ad.html" class="drawer-cta"><i class="fa-solid fa-plus" aria-hidden="true"></i> Post an Ad</a>
      <a href="wishlist.html"><i class="fa-regular fa-heart" aria-hidden="true"></i> Wishlist <span class="wish-count drawer-count">0</span></a>
      <a href="my-ads.html"><i class="fa-solid fa-rectangle-list" aria-hidden="true"></i> My Ads</a>
      <h4>Categories</h4>
      ${CATS.map(c => `<a href="category.html?cat=${encodeURIComponent(c)}">${c.replace(/&/g, "&amp;")}</a>`).join("")}
      <div class="drawer-foot">
        <button type="button" class="drawer-install" data-install><span><i class="fa-solid fa-download" aria-hidden="true"></i> Install app</span></button>
  <button type="button" class="drawer-theme" data-theme-toggle role="switch" aria-checked="false"><span><i class="fa-regular fa-moon" aria-hidden="true"></i> Dark mode</span><span class="sw" aria-hidden="true"><i class="fa-solid fa-sun" aria-hidden="true"></i><i class="fa-solid fa-moon" aria-hidden="true"></i><b class="knob"></b></span></button>
      </div>
    </aside>`;
  document.body.append(drawer);
  drawer.addEventListener("click", e => { if (e.target.closest("[data-close]") || e.target.closest("a")) closeDrawer(); });
  document.addEventListener("keydown", e => {
    if (drawer.hidden) return;
    if (e.key === "Escape") return closeDrawer();
    if (e.key !== "Tab") return;   // keep Tab inside the open menu
    const items = [...drawer.querySelectorAll("a[href], button")].filter(n => !n.hidden && n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}
function openDrawer() { if (!drawer) buildDrawer(); if (adminInDrawer) addDrawerAdmin(); drawer.querySelector("[data-theme-toggle]")?.setAttribute("aria-checked", String(document.documentElement.dataset.theme === "dark")); drawer.hidden = false; document.body.classList.add("no-scroll"); paintDrawer(auth.currentUser); burger?.setAttribute("aria-expanded", "true"); drawer.querySelector(".drawer-x")?.focus(); }
function closeDrawer() { if (!drawer || drawer.hidden) return; drawer.hidden = true; document.body.classList.remove("no-scroll"); burger?.setAttribute("aria-expanded", "false"); burger?.focus(); }
burger?.addEventListener("click", openDrawer);

function paintDrawer(user) {
  const box = document.getElementById("drawerUser");
  if (!box) return;
  box.replaceChildren();
  if (user) {
    const p = document.createElement("div");
    p.innerHTML = '<small>Signed in as</small>';
    const n = document.createElement("b");
    n.textContent = user.displayName || user.email;
    p.append(n);
    const out = document.createElement("button");
    out.type = "button"; out.className = "btn cancel"; out.textContent = "Log out";
    out.onclick = async () => { await A.signOut(auth); location.href = "index.html"; };
    box.append(p, out);
  } else {
    box.innerHTML = '<a class="btn solid" href="login.html">Log in</a><a class="btn cancel" href="register.html">Sign up</a>';
  }
}

// show an "Admin" link (header + mobile menu) to admins only
function paintAdminLink(user) {
  document.querySelectorAll(".admin-link").forEach(n => n.remove());
  if (!user) return;
  isAdmin(user).then(ok => {
    if (!ok || auth.currentUser?.uid !== user.uid) return;
    const bar = document.querySelector(".hd-actions");
    if (bar) {
      const a = document.createElement("a");
      a.href = "admin.html"; a.className = "act admin-link";
      a.innerHTML = '<i class="fa-solid fa-user-shield" aria-hidden="true"></i><span>Admin</span>';
      bar.prepend(a);
    }
    adminInDrawer = true;
    if (drawer) addDrawerAdmin();
  });
}
let adminInDrawer = false;
function addDrawerAdmin() {
  if (!drawer || drawer.querySelector(".admin-link")) return;
  const a = document.createElement("a");
  a.href = "admin.html"; a.className = "admin-link";
  a.innerHTML = '<i class="fa-solid fa-user-shield" aria-hidden="true"></i> Admin dashboard';
  drawer.querySelector('a[href="my-ads.html"]')?.after(a);
}

A.onAuthStateChanged(auth, user => {
  paintHeader(user);
  paintDrawer(user);
  if (!user) adminInDrawer = false;
  paintAdminLink(user);
  document.dispatchEvent(new CustomEvent("authchange", { detail: { user } })); // other scripts can listen for this

  if (protectedPage) {
    if (!user) {
      location.replace(`login.html?next=${encodeURIComponent(page)}`);
      return;
    }
    document.body.style.visibility = "visible";
  }
});
