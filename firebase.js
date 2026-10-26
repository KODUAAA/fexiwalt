// Firebase setup (loaded as ES modules straight from Google's CDN, no build step needed).
// These web config values identify the project and are safe in front-end code.
// What protects the data is Authentication plus the Firestore/Storage security rules
// (see firestore.rules and storage.rules in this folder).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import * as A from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import * as F from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import * as S from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCC-k773y_Bxv5IczIowWXoQ670TugFteg",
  // Sign-in pages are served from the site's own address when it is hosted on Firebase Hosting
  // (flexiwalt.web.app or fexiwalt.com). Phones block sign-in that bounces through a different domain,
  // which breaks "Continue with Google" in the installed app. Elsewhere (localhost) use the default.
  authDomain: ["flexiwalt.web.app", "flexiwalt.firebaseapp.com", "fexiwalt.com", "www.fexiwalt.com"].includes(location.hostname)
    ? location.hostname : "flexiwalt.firebaseapp.com",
  projectId: "flexiwalt",
  storageBucket: "flexiwalt.firebasestorage.app",
  messagingSenderId: "954475488563",
  appId: "1:954475488563:web:80a2b2d91336dc53e38a46"
};

export const app = initializeApp(firebaseConfig);

// ---- Firebase App Check (bot protection) -----------------------------------------------------------
// App Check makes Firebase reject requests that don't come from YOUR website (scripts, bots, copied keys).
// It stays OFF until you paste a reCAPTCHA v3 SITE key below, so nothing breaks before it is set up.
// Setup steps: see "App Check" in the project notes (Firebase console -> App Check -> register the web app
// with reCAPTCHA v3, paste the site key here, test, and only then switch on "Enforce" for Firestore).
// The site key is public by design; the reCAPTCHA *secret* key never goes in this file.
const APP_CHECK_SITE_KEY = "";   // e.g. "6Lc...": your reCAPTCHA v3 site key

if (APP_CHECK_SITE_KEY) {
  // While developing on localhost, use a debug token instead of reCAPTCHA. The browser console prints
  // "App Check debug token: ..." once. Register that token in Firebase console -> App Check -> Apps -> Manage debug tokens.
  if (["localhost", "127.0.0.1"].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  const AC = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js");
  AC.initializeAppCheck(app, { provider: new AC.ReCaptchaV3Provider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
}
// ----------------------------------------------------------------------------------------------------

export const auth = A.getAuth(app);
// Long polling: on mobile networks and some Wi-Fi/antivirus setups the normal streaming connection
// gets stuck (saving hangs or says "offline"). Long polling uses plain web requests, which get through everywhere.
export const db = F.initializeFirestore(app, { experimentalForceLongPolling: true });
export const storage = S.getStorage(app);
export { A, F, S };
