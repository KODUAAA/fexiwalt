import { auth, A, db, F } from "../core/firebase.js";

const form = document.getElementById("authForm");
const mode = form.dataset.mode; // "login" | "register"
const $ = (s, r = document) => r.querySelector(s);

// ---------- field validation ----------
const setErr = (name, msg) => {
  const box = $(`.err[data-for="${name}"]`);
  if (!box) return;
  box.textContent = msg;
  (box.closest(".field") || box.parentElement).classList.toggle("invalid", !!msg);
};

const rules = {
  name: v => v.valueMissing ? "Enter your name" : v.tooShort ? "Name is too short" : "",
  email: v => v.valueMissing ? "Enter your email" : v.typeMismatch ? "Enter a valid email address" : "",
  password: (v, el) => v.valueMissing ? "Enter your password" : (v.tooShort || (mode === "register" && el.value.length < 8)) ? "Password must be at least 8 characters" : "",
  confirm: (v, el) => v.valueMissing ? "Confirm your password" : el.value !== form.elements.password.value ? "Passwords do not match" : "",
  terms: v => v.valueMissing ? "You must accept the terms" : ""
};
const names = Object.keys(rules).filter(n => form.elements[n]);

function check(name) {
  const el = form.elements[name];
  const msg = rules[name](el.validity, el);
  setErr(name, msg);
  return !msg;
}

names.forEach(n => {
  const el = form.elements[n];
  el.addEventListener("blur", () => check(n));
  el.addEventListener("input", () => {
    if (el.closest(".field")?.classList.contains("invalid") || el.type === "checkbox") check(n);
    if (n === "password" && form.elements.confirm?.value) check("confirm");
  });
});

// show / hide password
$(".eye")?.addEventListener("click", e => {
  const btn = e.currentTarget, inp = form.elements.password, show = inp.type === "password";
  inp.type = show ? "text" : "password";
  btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  btn.firstElementChild.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
});

// password strength meter (register only)
const meter = document.getElementById("strength");
if (meter) {
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  form.elements.password.addEventListener("input", e => {
    const p = e.target.value;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    if (!p) s = 0;
    meter.dataset.s = s;
    document.getElementById("strengthText").textContent = labels[s];
  });
}

// ---------- Firebase ----------
const FRIENDLY = {
  "auth/email-already-in-use": "An account with this email already exists. Try logging in instead.",
  "auth/invalid-credential": "Incorrect email or password. Please try again.",
  "auth/wrong-password": "Incorrect email or password. Please try again.",
  "auth/user-not-found": "Incorrect email or password. Please try again.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "Network problem. Check your internet connection and try again.",
  "auth/operation-not-allowed": "This sign-in method isn't enabled yet in the Firebase console.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/unauthorized-domain": "This website address isn't authorised for Google sign-in yet (Firebase console → Authentication → Settings → Authorized domains).",
  "auth/account-exists-with-different-credential": "An account with this email already exists. Log in with your email and password instead.",
  "auth/weak-password": "Password is too weak. Use at least 8 characters."
};

const swal = (opts) => Swal.fire({ confirmButtonColor: "#0a3fc4", ...opts });

// only follow ?next=page.html for local pages, never external URLs
function nextPage() {
  const n = new URLSearchParams(location.search).get("next");
  return n && /^[\w-]+\.html$/.test(n) ? n : "index.html";
}

// ---------- Continue with Google ----------
// In the browser a Google popup opens. In the installed app (home-screen icon) popups can't report back,
// so the whole page goes to Google and comes back here instead ("redirect"), then finishes below.
const installedApp = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

async function afterGoogle(user) {
  // first time here: create the profile (an existing profile, and its role, is never overwritten)
  const ref = F.doc(db, "users", user.uid);
  const exists = await F.getDoc(ref).then(s => s.exists()).catch(() => true);
  if (!exists) await F.setDoc(ref, { name: user.displayName || "", email: user.email, role: "user", createdAt: F.serverTimestamp() })
    .catch(err => console.warn("Couldn't save profile:", err.code));
  location.href = nextPage();
}

// iPhone / iPad home-screen app: Firebase's popup and redirect sign-in both lose the login there (Apple opens
// them in a separate Safari window). Instead the app's own window goes straight to Google, and Google sends it
// back to login.html with a sign-in token in the address, which we hand to Firebase. Nothing depends on popups
// or on Firebase's sign-in pages. The return address must be listed in Google Cloud (see docs/TODO-BEFORE-LAUNCH.md).
const iosApp = installedApp && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const GOOGLE_CLIENT_ID = "954475488563-qn2gf3ssbcsdtgv1iep9aur0u670c41m.apps.googleusercontent.com";   // public, safe to show
const G_KEY = "fx-google-direct";
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");

function googleDirect() {
  const state = randomId(), nonce = randomId();
  try { localStorage.setItem(G_KEY, JSON.stringify({ state, next: nextPage(), at: Date.now() })); } catch { /* private mode */ }
  const p = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${location.origin}/login.html`,
    response_type: "id_token",
    scope: "openid email profile",
    prompt: "select_account",
    state, nonce
  });
  location.href = `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

// back from Google with "#id_token=…&state=…" in the address
async function finishGoogleDirect() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.has("id_token") && !h.has("error")) return false;
  history.replaceState(null, "", location.pathname + location.search);   // take the token out of the address bar
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(G_KEY)); localStorage.removeItem(G_KEY); } catch { /* nothing saved */ }
  if (h.has("error")) return h.get("error") === "access_denied" ? true : (swal({ icon: "error", title: "Google sign-in failed", text: "Please try again." }), true);
  if (!saved || saved.state !== h.get("state") || Date.now() - saved.at > 15 * 60e3) {   // not started by us, or too old
    swal({ icon: "error", title: "Google sign-in failed", text: "That sign-in link expired. Please tap Continue with Google again." });
    return true;
  }
  const btn = $("#googleBtn");
  if (btn) { btn.disabled = true; btn.lastElementChild.textContent = "Signing you in…"; }
  try {
    await A.setPersistence(auth, A.browserLocalPersistence);
    const { user } = await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(h.get("id_token")));
    if (saved.next) history.replaceState(null, "", `${location.pathname}?next=${encodeURIComponent(saved.next)}`);   // so nextPage() returns them where they started
    await afterGoogle(user);
  } catch (err) {
    console.error(err.code, err.message);
    if (btn) { btn.disabled = false; btn.lastElementChild.textContent = "Continue with Google"; }
    swal({ icon: "error", title: "Google sign-in failed", text: FRIENDLY[err.code] || "Something went wrong. Please try again." });
  }
  return true;
}
finishGoogleDirect();

// Tested on iPhone: Apple still returns from Google into a separate Safari window, so even the direct way can't
// finish inside the home-screen app. Until a native App Store app exists, show a clear note there instead.
// (googleDirect above is kept, and still works if Apple changes this; switch it back on in the click handler.)
if (iosApp && $("#googleBtn")) {
  const note = document.createElement("p");
  note.className = "ios-note";
  note.innerHTML = `<i class="fa-brands fa-apple" aria-hidden="true"></i> <span>Google sign-in isn't available in the iPhone app. Use your email below, or sign in with Google on the website in Safari.</span>`;
  $("#googleBtn").replaceWith(note);
  document.querySelector(".or span").textContent = mode === "register" ? "sign up with your email" : "log in with your email";
}

const gBtn = $("#googleBtn");
if (gBtn) {
  const gLabel = gBtn.lastElementChild.textContent;
  const busy = text => { gBtn.disabled = true; gBtn.lastElementChild.textContent = text; };
  const reset = () => { gBtn.disabled = false; gBtn.lastElementChild.textContent = gLabel; };
  const fail = err => {
    console.error(err.code, err.message);
    reset();
    if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;   // they just closed it
    swal({ icon: "error", title: "Google sign-in failed", text: FRIENDLY[err.code] || "Something went wrong. Please try again." });
  };

  // coming back from Google after a redirect: finish signing in. This runs quietly in the background and
  // never blocks the button (on some phones the check can take a long time, or never answer).
  A.getRedirectResult(auth)
    .then(res => { if (res?.user) { busy("Signing you in…"); return afterGoogle(res.user); } })
    .catch(err => { if (err.code !== "auth/no-auth-event") fail(err); });
  // backup: if the redirect signed them in but the check above is slow, the normal login listener catches it
  if (sessionStorage.getItem("fx-google-redirect")) {
    sessionStorage.removeItem("fx-google-redirect");
    const off = A.onAuthStateChanged(auth, user => { if (user) { off(); busy("Signing you in…"); afterGoogle(user); } });
  }

  gBtn.addEventListener("click", async () => {
    busy("Opening Google…");
    try {
      await A.setPersistence(auth, A.browserLocalPersistence);   // Google sign-in always keeps you signed in on this device
      const provider = new A.GoogleAuthProvider();
      if (iosApp) return googleDirect();   // iPhone home-screen app (see above)
      if (installedApp) { try { sessionStorage.setItem("fx-google-redirect", "1"); } catch {} return await A.signInWithRedirect(auth, provider); }   // leaves the page
      try {
        const { user } = await A.signInWithPopup(auth, provider);
        await afterGoogle(user);
      } catch (err) {
        if (err.code === "auth/popup-blocked") { try { sessionStorage.setItem("fx-google-redirect", "1"); } catch {} return await A.signInWithRedirect(auth, provider); }   // popups blocked: go the redirect way
        throw err;
      }
    } catch (err) { fail(err); }
  });
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  if (!names.map(check).every(Boolean)) { form.querySelector(".invalid input")?.focus(); return; }

  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const btn = form.querySelector(".submit");
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = mode === "login" ? "Logging in…" : "Creating account…";

  try {
    if (mode === "register") {
      const { user } = await A.createUserWithEmailAndPassword(auth, email, password);
      const name = form.elements.name.value.trim();
      await A.updateProfile(user, { displayName: name });
      // ask them to confirm their email (required before they can post an ad); failure here isn't fatal
      A.sendEmailVerification(user, { url: `${location.origin}/post-ad.html` })
        .catch(() => A.sendEmailVerification(user))   // address not in Firebase's authorized domains: send the plain email instead
        .catch(err => console.warn("Verification email not sent:", err.code));
      // profile document; role is always "user" here. Admins are promoted by hand in the Firebase console.
      // (Failure is non-fatal: the account already exists and the profile can be recreated later.)
      await F.setDoc(F.doc(db, "users", user.uid), { name, email, role: "user", createdAt: F.serverTimestamp() })
        .catch(err => console.warn("Couldn't save profile:", err.code));
      await swal({
        icon: "success", title: "Account created!",
        text: `Welcome to FEXIWALT, ${form.elements.name.value.trim().split(" ")[0]}. We've emailed you a link to verify your address. You'll need it to post ads.`,
        confirmButtonText: "Continue", timer: 3500, timerProgressBar: true
      });
      location.href = nextPage();
    } else {
      // "Remember me" keeps you signed in after the browser closes; otherwise only for this tab session.
      await A.setPersistence(auth, form.elements.remember?.checked ? A.browserLocalPersistence : A.browserSessionPersistence);
      await A.signInWithEmailAndPassword(auth, email, password);
      location.href = nextPage(); // homepage unless a protected page sent you here
    }
  } catch (err) {
    console.error(err.code, err.message);
    await swal({
      icon: "error",
      title: mode === "register" ? "Registration failed" : "Login failed",
      text: FRIENDLY[err.code] || "Something went wrong. Please try again."
    });
    btn.disabled = false; btn.textContent = label;
  }
});
