// Browse/search page: loads approved ads once, then filters and sorts them in the browser.
// URL params (shared with the header search): ?q=&cat=&min=&max=&loc=&cond=&sort=
import { db, F } from "../core/firebase.js";
import { adCard as card, skeletons } from "../features/cards.js";
import { renderBatched, clearLoadMore } from "../features/paging.js";
import { discountPct, isExpired, esc } from "../core/util.js";
import { setSeo } from "../core/seo.js";
import { REGIONS, REGION_NAMES } from "../core/locations.js";

const $ = id => document.getElementById(id);
const form = $("filterForm"), results = $("results");
let all = [];
let loaded = false;    // ads are only fetched once the visitor searches, filters, or asks to see everything
let showAll = false;   // ?all=1  ->  list every ad even with no keyword or filter (used by the "Shop" / "Browse all ads" links)
const FILTER_KEYS = ["q", "cat", "region", "loc", "min", "max", "cond", "deals"];
const isActive = () => {
  if (showAll) return true;
  const d = new FormData(form);
  return FILTER_KEYS.some(k => String(d.get(k) || "").trim() !== "");
};

// region dropdown + area suggestions (suggestions follow the chosen region; with none chosen, show every area)
form.elements.region.append(...REGION_NAMES.map(r => new Option(r, r)));
function fillFilterAreas() {
  const r = form.elements.region.value;
  const areas = r ? REGIONS[r] : Object.values(REGIONS).flat();
  $("filterAreas").replaceChildren(...areas.map(a => Object.assign(document.createElement("option"), { value: a })));
}
form.elements.region.addEventListener("change", fillFilterAreas);



// read form <-> URL
const params = () => new URLSearchParams(location.search);
function fillFormFromUrl() {
  const p = params();
  for (const k of ["q", "cat", "min", "max", "loc", "region"]) if (form.elements[k]) form.elements[k].value = p.get(k) || "";
  fillFilterAreas();
  const c = p.get("cond") || "";
  form.querySelectorAll('input[name="cond"]').forEach(r => (r.checked = r.value === c));
  form.elements.deals.checked = p.get("deals") === "1";
  $("sort").value = ["new", "low", "high", "discount"].includes(p.get("sort")) ? p.get("sort") : (p.get("deals") === "1" ? "discount" : "new");
}
function writeUrl() {
  const d = new FormData(form), p = new URLSearchParams();
  for (const [k, v] of d) if (String(v).trim()) p.set(k, String(v).trim());
  if (showAll) p.set("all", "1");
  if ($("sort").value !== (p.get("deals") ? "discount" : "new")) p.set("sort", $("sort").value);
  history.replaceState(null, "", p.toString() ? `?${p}` : location.pathname);
}

// ---- active filters shown as removable tags, and the Apply button showing how many ads match
const chipsEl = $("activeFilters"), applyBtn = form.querySelector(".apply");

function renderChips(d, count) {
  const chips = [];
  if (showAll) chips.push(["Showing all ads", () => (showAll = false)]);
  const q = String(d.get("q") || "").trim();
  if (q) chips.push([`“${q}”`, () => (form.elements.q.value = "")]);
  if (d.get("cat")) chips.push([d.get("cat"), () => (form.elements.cat.value = "")]);
  if (d.get("region")) chips.push([d.get("region"), () => { form.elements.region.value = ""; fillFilterAreas(); }]);
  if (String(d.get("loc") || "").trim()) chips.push([String(d.get("loc")).trim(), () => (form.elements.loc.value = "")]);
  const min = d.get("min"), max = d.get("max");
  if (min || max) chips.push([min && max ? `GH₵ ${min} to ${max}` : min ? `From GH₵ ${min}` : `Up to GH₵ ${max}`, () => { form.elements.min.value = ""; form.elements.max.value = ""; }]);
  if (d.get("cond")) chips.push([d.get("cond"), () => form.querySelectorAll('input[name="cond"]').forEach(r => (r.checked = r.value === ""))]);
  if (d.get("deals")) chips.push(["On sale", () => (form.elements.deals.checked = false)]);

  chipsEl.replaceChildren(...chips.map(([label, clear]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.title = "Remove this filter";
    b.append(label + " ", Object.assign(document.createElement("i"), { className: "fa-solid fa-xmark" }));
    b.onclick = () => { clear(); refresh(); };
    return b;
  }));
  chipsEl.hidden = !chips.length;
  // the button always says what pressing it will show
  applyBtn.textContent = `Show ${count} ad${count === 1 ? "" : "s"}`;
}

// nothing searched yet: show 0 ads and invite a search (the homepage is where the latest ads live)
function renderIdle() {
  clearLoadMore(results);
  $("heading").textContent = "Search ads"; $("crumb").textContent = "Search";
  setSeo({
    robots: "noindex,follow",   // the empty "search to see ads" screen has nothing worth indexing
    title: "Browse Ads - FEXIWALT",
    description: "Search and filter ads by category, price and location. Find phones, vehicles, property, fashion and more near you on FEXIWALT."
  });
  $("resultCount").textContent = "0 ads";
  chipsEl.replaceChildren(); chipsEl.hidden = true;
  applyBtn.textContent = "Search";
  const cats = [...form.elements.cat.options].filter(o => o.value)
    .map(o => `<a href="category.html?cat=${encodeURIComponent(o.value)}">${esc(o.value)}</a>`).join("");
  results.innerHTML = `<div class="ads-msg idle"><i class="fa-solid fa-magnifying-glass"></i><h3>Search to see ads</h3>
    <p>Type a keyword, or choose a category, region or price on the left.</p>
    <button type="button" class="btn solid" id="showAllBtn">Show all ads</button>
    <div class="idle-cats">${cats}</div></div>`;
  $("showAllBtn").onclick = () => { showAll = true; refresh(); };
  writeUrl();
}

function render() {
  if (!isActive()) return renderIdle();
  const d = new FormData(form);
  const q = String(d.get("q") || "").trim().toLowerCase();
  const cat = d.get("cat"), loc = String(d.get("loc") || "").trim().toLowerCase(), cond = d.get("cond");
  const region = d.get("region") || "";
  const min = d.get("min") === "" ? null : Number(d.get("min")), max = d.get("max") === "" ? null : Number(d.get("max"));

  let list = all.filter(a =>
    (!q || q.split(/\s+/).every(w => String(a.title).toLowerCase().includes(w))) && // every keyword must appear in the title
    (!cat || a.category === cat) &&
    (!region || a.region === region || String(a.location).toLowerCase().includes(region.toLowerCase())) &&   // older ads have no region field: fall back to the text
    (!loc || String(a.location).toLowerCase().includes(loc)) &&
    (!cond || a.condition === cond) &&
    (!d.get("deals") || discountPct(a) > 0) &&
    (min === null || a.price >= min) && (max === null || a.price <= max));

  const sort = $("sort").value;
  list.sort((a, b) => sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : sort === "discount" ? discountPct(b) - discountPct(a)
    : (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

  const base = cat || (q ? `Results for "${d.get("q").trim()}"` : d.get("deals") ? "Deals" : "");
  const title = base ? (region ? `${base} in ${region}` : base) : (region ? `Ads in ${region}` : "All ads");
  $("heading").textContent = title; $("crumb").textContent = title;
  // Google should index "Vehicles", "Property" ... landing pages, not every keyword/price combination (endless near-duplicates)
  const onlyCat = cat && !q && !region && !loc && !cond && !d.get("deals") && min === null && max === null;
  const plainAll = !cat && !q && !region && !loc && !cond && !d.get("deals") && min === null && max === null;
  const seoUrl = onlyCat ? `${location.origin}${location.pathname}?cat=${encodeURIComponent(cat)}` : `${location.origin}${location.pathname}?all=1`;
  setSeo({
    url: seoUrl,
    robots: onlyCat || plainAll ? "index,follow" : "noindex,follow",
    title: `${title} - FEXIWALT`,
    description: cat
      ? `Browse ${cat} ads across Ghana on FEXIWALT. Filter by price, location and condition, and contact sellers on WhatsApp.`
      : d.get("deals") ? "Discounted ads from sellers across Ghana. Find the best deals on FEXIWALT."
      : "Search and filter ads by category, price and location. Find phones, vehicles, property, fashion and more near you on FEXIWALT."
  });
  $("resultCount").textContent = `${list.length} ad${list.length === 1 ? "" : "s"} found`;
  renderChips(d, list.length);

  if (list.length) renderBatched(results, list, card);   // 12 at a time, with a "Load more" button
  else {
    clearLoadMore(results);
    results.innerHTML = `<div class="ads-msg"><i class="fa-solid fa-magnifying-glass"></i><h3>No ads found</h3><p>Try different keywords or clear some filters.</p></div>`;
  }
  writeUrl();
}

// Firestore does the heavy lifting for status, category and price range.
// (Keyword-in-title and location are matched in the browser because Firestore has no "contains" search.)
// Price range + category needs a composite index. If it's missing, Firestore gives an error with a
// one-click link to create it; until then we fall back to loading all approved ads.
const serverKey = () => ["cat", "min", "max"].map(k => form.elements[k].value.trim()).join("|");
let loadedKey = null;

async function fetchAds() {
  const ads = F.collection(db, "ads");
  const c = [F.where("status", "==", "approved")];
  const { cat, min, max } = Object.fromEntries(["cat", "min", "max"].map(k => [k, form.elements[k].value.trim()]));
  if (cat) c.push(F.where("category", "==", cat));
  if (min !== "" && !isNaN(min)) c.push(F.where("price", ">=", Number(min)));
  if (max !== "" && !isNaN(max)) c.push(F.where("price", "<=", Number(max)));
  try {
    return await F.getDocs(F.query(ads, ...c));
  } catch (err) {
    if (err.code !== "failed-precondition") throw err;
    console.warn("Firestore needs a composite index for this filter. Open this link to create it:\n", err.message);
    return F.getDocs(F.query(ads, F.where("status", "==", "approved"))); // fallback; the filters below still apply
  }
}

// re-query Firestore only when a server-side filter changed, otherwise just re-filter what we have
const refresh = () => (isActive() && (!loaded || serverKey() !== loadedKey) ? load() : render());

async function load() {
  results.innerHTML = skeletons(8);
  const key = serverKey();
  try {
    const snap = await fetchAds();
    all = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => !isExpired(a));   // expired ads are not shown
    loadedKey = key;
    loaded = true;
    render();
  } catch (err) {
    console.error(err.code, err);
    $("resultCount").textContent = "";
    clearLoadMore(results);
    results.innerHTML = `<div class="ads-msg"><i class="fa-solid fa-triangle-exclamation"></i><h3>Couldn't load ads</h3>
      <p>${err.code === "permission-denied" ? "Something went wrong on our side. Please try again in a moment." : "Check your connection and try again."}</p>
      <button class="btn solid" id="retry">Try again</button></div>`;
    $("retry")?.addEventListener("click", load);
  }
}

form.addEventListener("submit", e => {
  e.preventDefault();
  refresh();
  $("filters").classList.remove("open");
  // on phones the results sit below the filters, so take the visitor to them
  if (matchMedia("(max-width: 820px)").matches) {
    scrollTo({ top: results.getBoundingClientRect().top + scrollY - 130, behavior: "smooth" });
  }
  // a short pulse on the result count, so it is clear something happened
  const c = $("resultCount"); c.classList.remove("pulse"); void c.offsetWidth; c.classList.add("pulse");
});
form.addEventListener("change", refresh);
$("sort").addEventListener("change", render);
["q", "loc"].forEach(n => form.elements[n].addEventListener("input", refresh)); // filter while typing
$("clearBtn").addEventListener("click", () => { form.reset(); $("sort").value = "new"; showAll = false; fillFilterAreas(); refresh(); });
$("filterToggle").addEventListener("click", () => $("filters").classList.toggle("open"));

// the header search bar on this page updates the filters live too
document.querySelector(".hd .search")?.addEventListener("submit", e => {
  e.preventDefault();
  const h = new FormData(e.currentTarget);
  form.elements.q.value = h.get("q") || ""; form.elements.cat.value = h.get("cat") || "";
  refresh();
});

showAll = params().get("all") === "1";
fillFormFromUrl();
refresh();   // loads ads only if the address already has a search, a filter, or all=1
