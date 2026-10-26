# FEXIWALT: things to finish before launch

Tick these off as you go. Nothing here blocks testing, but most of it blocks going live.

## 1. Client details (edit `js/core/site.js`, then every page updates)
- [x] Email, phone, WhatsApp, address, hours and social links: client's real details added (1 Oct 2026)
- [x] WhatsApp is 0541364246 (confirmed)
- [ ] Confirm with the client that the LinkedIn link is a company page (linkedin.com/company/fexiwalt)
- [ ] `updated` date: change it whenever the Terms or Privacy Policy change

## 2. Photos (`images/`, list in `docs/PHOTOS.md`)
- [ ] Replace stock photos with the client's own: `hero-1.jpg` (not Ghana), `cat-property.jpg`, `cat-fashion.jpg`,
      `cat-furniture.jpg`, `cat-services.jpg`. Same file names.
- [ ] Optional: a logo file with a transparent background (the current one has white edges)

## 3. Legal
- [ ] Have a lawyer in Ghana review `terms.html` and `privacy.html` (draft notices removed from both pages)
- [ ] Check whether the business must register with Ghana's Data Protection Commission

## 4. Firebase / accounts (do these in the client's name if the client owns the site)
- [ ] Move the Firebase project and the Cloudinary account to the client's own Google/Cloudinary accounts
- [ ] Publish the latest `firebase/firestore.rules` after any change
- [ ] Make the client an admin: Firestore -> users -> (their UID) -> `role: "admin"`
- [ ] Firebase -> Authentication -> Templates: set the sender name and wording of the verification and reset emails
- [ ] Cloudinary upload preset `fexiwalt_ads`: allowed formats `jpg,png,webp`, max file size `5000000`
- [ ] App Check: follow `docs/APP_CHECK.md` (only turn on "Enforce" once ~100% of requests are verified)
- [ ] Optional: create the Firestore index the homepage asks for (click the link in the browser console)

## 5. Going live
- [ ] In `firebase.json` (Hosting), add a header so `sw.js` is never cached for long (otherwise updates reach phones late):
      `{ "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }`
- [ ] After deploying, test the installable app on a real phone: open the live site in Chrome, use "Install app" on the home page
      (Android), or Share -> Add to Home Screen (iPhone). Also bump `VERSION` in `sw.js` after big changes.
- [ ] Deploy with Firebase Hosting (needs a `firebase.json` that leaves out `old/`, `docs/`, `firebase/` and `*.md`; keep `404.html` in the site root, Hosting serves it automatically for unknown addresses)
- [ ] Firebase -> Authentication -> Settings -> Authorized domains: add the live domain
- [x] Domain set to `fexiwalt.com` everywhere (pages, robots.txt, sitemap.xml)
      (page tags, `robots.txt`, `sitemap.xml`)
- [ ] Add the live domain to the reCAPTCHA site (for App Check)
- [ ] Submit `sitemap.xml` in Google Search Console

## 6. Later, when they exist
- [ ] A Google Play listing (optional): the installable web app can be wrapped for the Play Store later (Trusted Web Activity)
- [ ] Cloud Function so each shared ad gets its own WhatsApp/Facebook preview (needs the Blaze plan)
- [ ] Sitemap that includes individual ads

## Google sign-in
- Firebase console → Authentication → Sign-in method → turn on **Google** (pick a support email) → Save.
- Authentication → Settings → Authorized domains: make sure your real domain (e.g. fexiwalt.com) is listed (localhost is there by default).

## Search engines (SEO)
- [ ] Before each deploy run `node tools/make-sitemap.mjs https://fexiwalt.com` (rebuilds sitemap.xml with every live ad) and deploy. Repeat this now and then (weekly is plenty) so new ads are listed.
- [ ] Google Search Console (search.google.com/search-console): add the domain, verify it (DNS record), submit `sitemap.xml`.
- [ ] Optional later: a Firebase Cloud Function so WhatsApp/Facebook previews show each ad's own photo and price (needs the Blaze plan).

## Handover to the client (do this LAST, after everything works on fexiwalt.com)
- [ ] Firebase console → Project settings → Users and permissions → add `fexiwalt@gmail.com` as **Owner**; client accepts the email invite
- [ ] Client registers on the site; set their `users/<uid>` document `role` to `admin` in Firestore
- [ ] Authentication → Sign-in method → Google → support email: `fexiwalt@gmail.com`
- [ ] Cloudinary → account settings → change the login email to `fexiwalt@gmail.com` (photos stay where they are)
- [ ] Only after the client confirms they can log in: client lowers you to Editor (if you keep maintaining it) or removes you

## Google sign-in in the iPhone home-screen app
The iPhone app signs in with Google directly (js/pages/auth.js → googleDirect), and Google returns to login.html.
Google Cloud console → APIs & Services → Credentials → "Web client (auto created by Google Service)" → Authorized redirect URIs must include:
- https://flexiwalt.web.app/login.html
- https://fexiwalt.com/login.html
- https://www.fexiwalt.com/login.html
