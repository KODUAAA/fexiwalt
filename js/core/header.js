// THE site header: one file, used by every page. To change the logo, search bar, menu links or categories
// for the whole site, edit this file (and nothing else).
//
// Each page contains just:   <header class="hd" id="siteHeader"></header>
//                            <script src="js/header.js"></script>
// This is a plain (non-module) script on purpose: it runs the moment the browser reaches it, so the header is
// on screen from the first paint and is already there when the page's other scripts start.
(function () {
  var host = document.getElementById("siteHeader");
  if (!host) return;

  var CATEGORIES = [
    ["Electronics", "fa-laptop"], ["Mobile Phones & Tablets", "fa-mobile-screen-button"], ["Vehicles", "fa-car"],
    ["Property", "fa-house"], ["Fashion", "fa-shirt"], ["Home & Furniture", "fa-couch"],
    ["Health & Beauty", "fa-heart-pulse"], ["Jobs", "fa-briefcase"], ["Services", "fa-screwdriver-wrench"], ["Others", "fa-ellipsis"]
  ];
  window.SITE_CATEGORIES = CATEGORIES.map(function (c) { return c[0]; });   // other scripts (the phone menu) reuse this list

  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };
  var page = location.pathname.split("/").pop() || "index.html";
  var q = new URLSearchParams(location.search);
  var onBrowse = page === "category.html";

  // which menu link is "you are here"
  var here = {
    home: page === "index.html",
    shop: onBrowse && q.get("all") === "1" && !q.get("sort") && !q.get("deals"),
    deals: onBrowse && q.get("deals") === "1",
    fresh: onBrowse && q.get("sort") === "new",
    sellers: page === "sellers.html" || page === "seller.html",
    sell: page === "post-ad.html"
  };
  var on = function (k) { return here[k] ? ' class="on" aria-current="page"' : ""; };

  // ---- skip link: lets keyboard users jump past the menus to the page content
  document.body.insertAdjacentHTML("afterbegin", '<a class="skip-link" href="#main">Skip to main content</a>');
  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector("main");
    if (main && !main.id) main.id = "main";
    if (main) main.setAttribute("tabindex", "-1");   // so the skip link can move focus there
  });

  // ---- top bar: logo, search, account, wishlist, menu button (phones)
  host.innerHTML =
    '<div class="wrap hd-main">' +
      '<a href="index.html" class="brand" aria-label="FEXIWALT home">' +
        '<img src="images/logo.jpg" alt="" width="58" height="58">' +
        '<span><b>FEXIWALT</b><small>Discover More, Shop Better.</small></span>' +
      '</a>' +
      '<form class="search" role="search" action="category.html" method="get">' +
        '<select name="cat" aria-label="Search in category"><option value="">All Categories</option>' +
          CATEGORIES.map(function (c) { return "<option>" + esc(c[0]) + "</option>"; }).join("") + '</select>' +
        '<input type="search" name="q" placeholder="Search for products, brands and more..." aria-label="Search for products">' +
        '<button type="submit" aria-label="Search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></button>' +
      '</form>' +
      '<div class="hd-actions">' +
        '<a href="login.html" class="act"><i class="fa-regular fa-user" aria-hidden="true"></i><span><small>Sign in</small>Account</span></a>' +
        '<a href="my-ads.html" class="act"><i class="fa-solid fa-rectangle-list" aria-hidden="true"></i><span><small>Manage</small>My Ads</span></a>' +
        '<a href="wishlist.html" class="act"><i class="fa-regular fa-heart" aria-hidden="true"></i><em class="wish-count" aria-hidden="true">0</em><span>Wishlist</span></a>' +
      '</div>' +
      '<button class="bell" type="button" aria-label="Notifications" aria-haspopup="true" aria-expanded="false" hidden><i class="fa-regular fa-bell" aria-hidden="true"></i><em class="bell-count" hidden>0</em></button>' +
      '<button class="burger" type="button" aria-label="Open menu" aria-haspopup="dialog" aria-expanded="false"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>' +
    '</div>';

  // keep the search box's category in step with the address (e.g. after searching inside a category)
  var sel = host.querySelector(".search select");
  if (sel && q.get("cat")) sel.value = q.get("cat");

  // ---- menu row (desktop only; hidden on phones, where the menu button opens the drawer)
  host.insertAdjacentHTML("beforeend",
    '<div class="wrap hd-nav">' +
      '<div class="dd">' +
        '<a href="category.html?all=1" class="shop-cats"><i class="fa-solid fa-bars" aria-hidden="true"></i> Shop by Categories</a>' +
        '<div class="dd-menu">' +
          CATEGORIES.map(function (c) {
            return '<a href="category.html?cat=' + encodeURIComponent(c[0]) + '"><i class="fa-solid ' + c[1] + '" aria-hidden="true"></i> ' + esc(c[0]) + "</a>";
          }).join("") +
        '</div>' +
      '</div>' +
      '<nav aria-label="Main">' +
        '<a href="index.html"' + on("home") + '>Home</a>' +
        '<a href="category.html?all=1"' + on("shop") + '>Shop</a>' +
        '<a href="category.html?deals=1"' + on("deals") + '>Deals</a>' +
        '<a href="category.html?all=1&amp;sort=new"' + on("fresh") + '>New Arrivals</a>' +
        '<a href="sellers.html"' + on("sellers") + '>Top Sellers</a>' +
        '<a href="post-ad.html"' + on("sell") + '>Sell on FEXIWALT</a>' +
      '</nav>' +
    '</div>');
})();
