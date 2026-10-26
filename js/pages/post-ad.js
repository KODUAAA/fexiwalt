// Post an Ad  (also the Edit page: post-ad.html?edit=<ad id> loads that ad and updates it on submit)
import { app, auth, A, db, F } from "../core/firebase.js";
import { uploadToCloudinary } from "../features/cloudinary.js";
import { compressImage, formatBytes } from "../features/compress.js";
import { deleteImages } from "../features/adstore.js";
import { REGIONS, REGION_NAMES, joinLocation } from "../core/locations.js";
import { banInfo } from "../core/roles.js";
import { esc } from "../core/util.js";

const MAX_FILES = 8;
const MAX_MB = 15;   // size of the ORIGINAL file; it is shrunk (see js/compress.js) before uploading
const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

const form = document.getElementById("adForm");
const input = document.getElementById("images");
const drop = document.getElementById("drop");
const previews = document.getElementById("previews");

const editId = new URLSearchParams(location.search).get("edit");
let existing = [];         // edit mode: photo URLs already saved on the ad and still kept
let originalImages = [];   // edit mode: photo URLs the ad had when it was loaded
let files = [];            // newly selected photos (not uploaded yet)
let wasApproved = false;   // edit mode: the ad was live before this edit
const total = () => existing.length + files.length;

// ---- location: a region dropdown plus an area/town box that suggests places in that region
const regionSel = form.elements.region, areaInput = form.elements.area, areaList = document.getElementById("areas");
regionSel.append(...REGION_NAMES.map(r => new Option(r, r)));

function fillAreas() {
  areaList.replaceChildren(...(REGIONS[regionSel.value] || []).map(a => Object.assign(document.createElement("option"), { value: a })));
  areaInput.placeholder = regionSel.value ? `e.g. ${(REGIONS[regionSel.value] || [])[2] || "your town"}` : "Choose a region first, then start typing";
}
regionSel.addEventListener("change", fillAreas);

const $ = (s, r = document) => r.querySelector(s);
const setErr = (name, msg) => {
  const box = $(`.err[data-for="${name}"]`);
  if (!box) return;
  box.textContent = msg;
  box.closest(".field")?.classList.toggle("invalid", !!msg);
};

// ---- live character counters
const counter = (id, out, max) => {
  const el = document.getElementById(id), o = document.getElementById(out);
  const upd = () => (o.textContent = `${el.value.length} / ${max}`);
  el.addEventListener("input", upd); upd();
  return upd;
};
const updTitle = counter("title", "titleCount", 80);
const updDesc = counter("description", "descCount", 2000);

// ---- photo handling
function thumb(src, label, onRemove) {
  const wrap = document.createElement("div"); wrap.className = "pv";
  const img = document.createElement("img"); img.alt = label; img.src = src;
  const btn = document.createElement("button"); btn.type = "button"; btn.setAttribute("aria-label", `Remove ${label}`);
  btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  btn.onclick = onRemove;
  wrap.append(img, btn);
  return wrap;
}

function renderPreviews() {
  const nodes = [
    ...existing.map((url, i) => thumb(url, `photo ${i + 1}`, () => { existing.splice(i, 1); renderPreviews(); validateImages(); })),
    ...files.map((f, i) => {
      const t = thumb(URL.createObjectURL(f), f.name, () => { files.splice(i, 1); renderPreviews(); validateImages(); });
      const img = t.querySelector("img"); img.onload = () => URL.revokeObjectURL(img.src);
      return t;
    })
  ];
  nodes[0]?.append(Object.assign(document.createElement("span"), { className: "cover", textContent: "Cover" }));
  previews.replaceChildren(...nodes);
}

function addFiles(list) {
  const problems = [];
  for (const f of list) {
    if (!OK_TYPES.includes(f.type)) { problems.push(`${f.name}: only JPG, PNG or WebP allowed`); continue; }
    if (f.size > MAX_MB * 1024 * 1024) { problems.push(`${f.name}: larger than ${MAX_MB} MB`); continue; }
    if (total() >= MAX_FILES) { problems.push(`Maximum ${MAX_FILES} photos`); break; }
    if (!files.some(x => x.name === f.name && x.size === f.size)) files.push(f);
  }
  renderPreviews();
  validateImages(problems[0] || "");
}

function validateImages(extra = "") {
  const msg = extra || (total() ? "" : "Please add at least one photo");
  setErr("images", msg);
  return !msg;
}

input.addEventListener("change", () => { addFiles([...input.files]); input.value = ""; });
["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", e => addFiles([...e.dataTransfer.files]));

// ---- validation (HTML5 constraint API, with friendly messages)
const messages = {
  title: v => v.valueMissing ? "Enter a title" : v.tooShort ? "Title must be at least 5 characters" : "",
  category: v => v.valueMissing ? "Choose a category" : "",
  condition: v => v.valueMissing ? "Select New or Used" : "",
  price: v => v.valueMissing ? "Enter a price" : (v.rangeUnderflow || v.badInput) ? "Enter a valid price" : v.rangeOverflow ? "Price is too high" : "",
  region: v => v.valueMissing ? "Choose a region" : "",
  area: v => v.valueMissing ? "Enter the area or town" : v.tooShort ? "Area is too short" : "",
  description: v => v.valueMissing ? "Enter a description" : v.tooShort ? "Description must be at least 20 characters" : "",
  phone: v => v.valueMissing ? "Enter your WhatsApp number" : v.patternMismatch ? "Use a Ghana number like 0240000000 or +233240000000" : "",
  terms: v => v.valueMissing ? "You must accept the terms" : ""
};

// optional "was" price for Deals: empty is fine, otherwise it must be higher than the price
messages.oldPrice = (v, el) => {
  if (el.value === "") return "";
  if (v.rangeUnderflow || v.badInput) return "Enter a valid price";
  return Number(el.value) <= Number(form.elements.price.value) ? "Original price must be higher than the price" : "";
};
form.elements.price.addEventListener("input", () => form.elements.oldPrice.value && validateField("oldPrice"));

function validateField(name) {
  const el = form.elements[name];
  const target = el instanceof RadioNodeList ? el[0] : el;
  const msg = messages[name](target.validity, target);
  setErr(name, msg);
  return !msg;
}

Object.keys(messages).forEach(name => {
  const el = form.elements[name];
  (el instanceof RadioNodeList ? [...el] : [el]).forEach(n => {
    n.addEventListener("blur", () => validateField(name));
    n.addEventListener("input", () => { if (n.closest(".field")?.classList.contains("invalid") || n.type === "checkbox") validateField(name); });
    n.addEventListener("change", () => validateField(name));
  });
});

const FRIENDLY = {
  "cloudinary/not-configured": "Photo uploads are temporarily unavailable. Please try again later.",
  "cloudinary/network": "Network problem while uploading photos. Check your connection and try again.",
  "cloudinary/failed": "A photo could not be uploaded. Use a JPG, PNG or WebP under 15 MB and try again.",
  "app/daily-limit": "You've reached today's limit of 5 new ads. Please try again tomorrow. You can still edit your existing ads.",
  "permission-denied": "We couldn't save your ad. Please log out, log back in and try again. If it keeps happening, contact us.",
  "app/not-verified": "Please verify your email first. Open the link we emailed you (check spam too), then try again.",
  "app/banned": "Your account has been suspended, so you can't post ads. Contact us if you think this is a mistake.",
  "unavailable": "Can't reach the server. Check your connection and try again.",
  "app/slow": "Your connection is very slow. Check My Ads in a minute: your ad may already be there. If it isn't, please try again."
};
const swal = opts => Swal.fire({ confirmButtonColor: "#0a3fc4", ...opts });

// ---- daily posting limit (the Firestore rules enforce it; this check just fails early and politely)
// Each new ad is written together with a counter bump in one batch. See "daily posting limit" in firebase/firestore.rules.
const DAILY_LIMIT = 5;   // keep in sync with dailyLimit() in firebase/firestore.rules
const dayKey = () => { const n = new Date(); return `${n.getUTCFullYear()}-${n.getUTCMonth() + 1}-${n.getUTCDate()}`; };   // UTC day, same as the rules

async function claimSlot(user) {
  const key = `${user.uid}_${dayKey()}`;
  const counterRef = F.doc(db, "dailyAds", key);
  const snap = await F.getDoc(counterRef);
  const used = snap.exists() ? snap.data().count : 0;
  if (used >= DAILY_LIMIT) throw Object.assign(new Error("Daily limit reached"), { code: "app/daily-limit" });
  return { used, counterRef, adRef: F.doc(db, "ads", `${key}_${used + 1}`) };
}

// Photos are hosted on Cloudinary (see js/features/cloudinary.js); we keep only the returned URLs in Firestore.
const uploadImage = (file, _uid, _index, onProgress) => uploadToCloudinary(file, onProgress);

// ---- edit mode: load the ad into the form
async function enterEditMode(user) {
  const btn = form.querySelector(".submit");
  $(".post-head h1").textContent = "Edit your ad";
  $(".post-head p").textContent = "Update the details below and save your changes.";
  btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save changes';
  document.title = "Edit Ad - FEXIWALT";
  $(".crumbs span").textContent = "Edit Ad";
  form.classList.add("loading");

  try {
    const snap = await F.getDoc(F.doc(db, "ads", editId));
    const ad = snap.exists() ? snap.data() : null;
    if (!ad || ad.sellerId !== user.uid) {
      await swal({ icon: "error", title: "Can't edit this ad", text: ad ? "You can only edit your own ads." : "This ad no longer exists." });
      location.href = "my-ads.html";
      return;
    }
    form.elements.title.value = ad.title || "";
    form.elements.category.value = ad.category || "";
    form.elements.price.value = ad.price ?? "";
    form.elements.oldPrice.value = ad.oldPrice ?? "";
    wasApproved = ad.status === "approved";
    $("#reviewNote").hidden = !wasApproved;
    form.elements.negotiable.checked = !!ad.negotiable;
    form.elements.region.value = ad.region || "";        // ads posted before regions existed have none: the seller picks one
    form.elements.area.value = ad.area || ad.location || "";
    fillAreas();
    form.elements.description.value = ad.description || "";
    form.elements.phone.value = ad.phone || "";
    const cond = [...form.querySelectorAll('input[name="condition"]')].find(r => r.value === ad.condition);
    if (cond) cond.checked = true;
    form.elements.terms.checked = true; // already accepted when the ad was first posted
    updTitle(); updDesc();
    existing = [...(ad.images || [])];
    originalImages = [...existing];
    renderPreviews();
  } catch (err) {
    console.error(err.code, err);
    await swal({ icon: "error", title: "Couldn't load the ad", text: FRIENDLY[err.code] || "Please try again." });
    location.href = "my-ads.html";
  } finally {
    form.classList.remove("loading");
  }
}

if (editId) {
  const off = A.onAuthStateChanged(auth, user => { if (user) { off(); enterEditMode(user); } });
} else {
  // ---- new ads need a verified email (the Firestore rules enforce this too)
  const layout = document.querySelector(".post-layout");
  const panel = document.getElementById("verifyPanel");
  const off = A.onAuthStateChanged(auth, user => {
    if (!user) return;   // session.js sends logged-out visitors to the login page
    off();
    if (user.emailVerified) return;
    layout.hidden = true; panel.hidden = false;
    document.getElementById("verifyEmail").textContent = user.email;

    document.getElementById("verifiedBtn").onclick = async e => {
      const b = e.currentTarget; b.disabled = true;
      try {
        await A.reload(user);
        await user.getIdToken(true);   // refresh the login token so Firestore sees the verified email
        if (user.emailVerified) { panel.hidden = true; layout.hidden = false; }
        else swal({ icon: "info", title: "Not verified yet", text: "Open the link in the email we sent, then press this button again." });
      } catch (err) { console.error(err.code); swal({ icon: "error", title: "Couldn't check", text: "Please try again." }); }
      b.disabled = false;
    };

    document.getElementById("resendBtn").onclick = async e => {
      const b = e.currentTarget; b.disabled = true;
      try {
        await A.sendEmailVerification(user, { url: `${location.origin}/post-ad.html` })
          .catch(err => err.code === "auth/unauthorized-continue-uri" ? A.sendEmailVerification(user) : Promise.reject(err));   // "Continue" button in the email brings them back here
        swal({ icon: "success", title: "Email sent", text: `Check ${user.email}, including your spam folder.` });
      } catch (err) {
        console.error(err.code);
        swal({ icon: "error", title: "Couldn't send", text: err.code === "auth/too-many-requests" ? "Too many requests. Please wait a few minutes." : "Please try again." });
      }
      setTimeout(() => (b.disabled = false), 30000); // avoid hammering the send button
    };
  });
}

// ---- suspended accounts: hide the form and explain (the Firestore rules refuse the write as well)
{
  const offBan = A.onAuthStateChanged(auth, async user => {
    if (!user) return;
    offBan();
    const info = await banInfo(user);
    if (!info) return;
    document.querySelector(".post-layout").hidden = true;
    document.getElementById("verifyPanel").hidden = true;
    document.getElementById("banReason").textContent = info.reason ? `Reason: ${info.reason}` : "";
    document.getElementById("banPanel").hidden = false;
  });
}

// Polls the database over a plain web request until the document exists (used when the normal reply is stuck).
async function waitUntilSaved(user, path) {
  const url = `https://firestore.googleapis.com/v1/projects/${app.options.projectId}/databases/(default)/documents/${path}`;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, i ? 3000 : 6000));   // first check after 6 s, then every 3 s (about 2 minutes)
    if (i === 2) submitBtn().textContent = "Still saving… slow connection, keep this page open";
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      if (res.ok) return;
    } catch { /* offline for a moment: keep trying */ }
  }
  throw Object.assign(new Error("Save not confirmed"), { code: "app/slow" });
}
const submitBtn = () => form.querySelector(".submit");

// ---- submit: create a new ad, or update the one being edited
form.addEventListener("submit", async e => {
  e.preventDefault();
  const results = Object.keys(messages).map(validateField);
  const imagesOk = validateImages();
  if (![...results, imagesOk].every(Boolean)) {
    const first = form.querySelector(".field.invalid");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
    first?.querySelector("input,select,textarea")?.focus({ preventScroll: true });
    return;
  }

  const user = auth.currentUser;
  if (!user) { location.href = `login.html?next=${editId ? "my-ads.html" : "post-ad.html"}`; return; }

  const d = new FormData(form);
  const btn = form.querySelector(".submit");
  const btnHtml = btn.innerHTML;
  btn.disabled = true;
  const say = t => (btn.textContent = t);

  let ad;
  try {
    // The login token remembers whether the email was verified when it was issued (up to an hour ago).
    // Someone who verified a moment ago still has an old "not verified" token, and the database refuses it,
    // so check the token and refresh it if needed before uploading anything.
    if (!editId) {
      let t = await user.getIdTokenResult();
      if (!t.claims.email_verified) {
        await A.reload(user);
        t = await user.getIdTokenResult(true);
        if (!t.claims.email_verified) throw Object.assign(new Error("Email not verified"), { code: "app/not-verified" });
      }
      if (await banInfo(user)) throw Object.assign(new Error("Banned"), { code: "app/banned" });
    }

    // new ads: check the daily limit first, so nobody waits for an upload that would be refused
    const slot = editId ? null : await claimSlot(user);

    // photos: shrink in the browser, then upload them (in parallel) with overall progress
    let uploaded = [];
    if (files.length) {
      // 1) shrink the photos in the browser (a 6 MB phone photo usually becomes a few hundred KB)
      say("Optimizing photos…");
      const prepared = await Promise.all(files.map(f => compressImage(f)));
      const before = files.reduce((a, f) => a + f.size, 0), after = prepared.reduce((a, f) => a + f.size, 0);
      const sizes = after < before ? ` (${formatBytes(before)} → ${formatBytes(after)})` : "";

      // 2) upload the smaller files
      const progress = new Array(prepared.length).fill(0);
      const show = () => say(`Uploading photos${sizes}… ${Math.round(progress.reduce((a, b) => a + b, 0) / prepared.length * 100)}%`);
      show();
      uploaded = await Promise.all(prepared.map((f, i) => uploadImage(f, user.uid, i, p => { progress[i] = p; show(); })));
    }

    // 2) write to Firestore
    say(editId ? "Saving changes…" : "Saving your ad…");
    const fields = {
      title: d.get("title").trim(),
      category: d.get("category"),
      condition: d.get("condition"),
      price: Number(d.get("price")),
      negotiable: d.has("negotiable"),
      region: d.get("region"),
      area: d.get("area").trim(),
      location: joinLocation(d.get("region"), d.get("area").trim()),   // "Greater Accra, Ashaley Botwe": shown on cards and ad pages
      description: d.get("description").trim(),
      images: [...existing, ...uploaded],
      phone: d.get("phone").trim()
    };

    const old = d.get("oldPrice");
    const hasOld = old !== null && old !== "";

    if (editId) {
      // update in place. sellerId and createdAt are left untouched, and every seller edit goes back
      // to "pending" so an admin reviews the change before it is shown again.
      ad = fields;
      await F.updateDoc(F.doc(db, "ads", editId), {
        ...fields,
        oldPrice: hasOld ? Number(old) : F.deleteField(),
        status: "pending",
        updatedAt: F.serverTimestamp()
      });
      // photos the seller removed are cleaned out of Storage (best effort, after the ad is saved)
      deleteImages(originalImages.filter(u => !fields.images.includes(u)));
    } else {
      ad = {
        ...fields,
        ...(hasOld ? { oldPrice: Number(old) } : {}),
        sellerId: user.uid,
        sellerName: user.displayName || user.email.split("@")[0],
        status: "pending",
        createdAt: F.serverTimestamp()
      };
      const batch = F.writeBatch(db);   // the ad and today's counter are written together, or not at all
      batch.set(slot.adRef, ad);
      batch.set(slot.counterRef, { count: slot.used + 1, updatedAt: F.serverTimestamp() });
      // Sometimes the save reaches the database but the "saved" reply never makes it back over a stuck
      // connection, and the page would wait forever. So while waiting, also ask the database directly
      // (a separate, simple web request) whether the ad is there yet: whichever answers first wins.
      await Promise.race([batch.commit(), waitUntilSaved(user, slot.adRef.path)]);
    }
  } catch (err) {
    console.error(err.code, err);
    btn.disabled = false; btn.innerHTML = btnHtml;
    swal({ icon: "error", title: editId ? "Couldn't save changes" : "Couldn't post your ad", text: FRIENDLY[err.code] || "Something went wrong. Please try again." });
    return;
  }

  // Done: a clear popup in the middle of the screen (wherever the person has scrolled to), then a fresh form.
  if (editId) {
    await swal({
      icon: "success",
      title: "Changes saved",
      text: wasApproved
        ? "Your ad is back in review and will go live again once an admin approves it."
        : "Your ad is waiting for approval from an admin.",
      confirmButtonText: "Go to My Ads", allowOutsideClick: false
    });
    location.href = "my-ads.html";
    return;
  }

  // clear everything so it's obvious the ad went through (and nobody posts it twice by accident)
  form.reset();
  files = []; existing = [];
  renderPreviews();
  fillAreas(); updTitle(); updDesc();
  form.querySelectorAll(".field.invalid").forEach(f => f.classList.remove("invalid"));
  form.querySelectorAll(".err").forEach(e => (e.textContent = ""));
  btn.disabled = false; btn.innerHTML = btnHtml;
  scrollTo({ top: 0, behavior: "smooth" });

  const r = await swal({
    icon: "success",
    title: "Ad posted!",
    html: `<b>${esc(ad.title)}</b> is waiting for approval from an admin.<br>It will appear on FEXIWALT as soon as it's approved. You can follow it in <b>My Ads</b>.`,
    showCancelButton: true,
    confirmButtonText: "View My Ads",
    cancelButtonText: "Post another ad",
    allowOutsideClick: false
  });
  if (r.isConfirmed) location.href = "my-ads.html";
});
