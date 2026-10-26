# Firebase App Check (bot protection): setup guide

App Check makes Firebase refuse requests that don't come from **your** website. It is switched **off** in
`js/core/firebase.js` until you paste a site key, so nothing breaks before you finish these steps.

**Do the steps in this order. Turning on "Enforce" too early blocks your own site.**

## 1. Get a reCAPTCHA v3 key (free)
1. Go to https://www.google.com/recaptcha/admin and sign in with your Google account.
2. Create a site: label `FEXIWALT`, type **reCAPTCHA v3**.
3. Domains: add `localhost` and, later, your real domain (e.g. `fexiwalt.com`).
4. You get a **Site key** (public) and a **Secret key** (private). Keep the secret key; never put it in the code.

## 2. Register the app in Firebase
1. Firebase console -> **App Check** -> **Apps** tab -> your web app (`flexiwalt-web`) -> **reCAPTCHA** provider.
2. Paste the **Secret key** from step 1 (it goes here, into Firebase, not into your code). Save.

## 3. Turn it on in the code
1. Open `js/core/firebase.js` and paste the **Site key** into `APP_CHECK_SITE_KEY`.
2. Open the site on `http://localhost:5173` and press F12 -> Console. You will see one line:
   `App Check debug token: xxxxxxxx-....` (localhost uses a debug token, not reCAPTCHA).
3. Firebase console -> App Check -> Apps -> your app -> **Manage debug tokens** -> add that token.

## 4. Watch, then enforce
1. Use the site normally for a day or two. In the console, **App Check -> APIs** shows what share of requests
   are "verified". You want ~100% for **Cloud Firestore** and **Authentication**.
2. When verified requests are ~100%, click **Enforce** for Cloud Firestore (and Authentication if you like).
3. If anything breaks, click **Unenforce** to go back instantly. Nothing is lost.

## Notes
- The reCAPTCHA **site key** is public by design. The **secret key** stays in the Firebase console only.
- App Check does not cover Cloudinary (photo uploads). Its upload preset limits are set in Cloudinary.
- The per-day ad limit is enforced separately by `firebase/firestore.rules` (see "daily posting limit").
