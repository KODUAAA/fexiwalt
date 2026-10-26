# FEXIWALT

**Live: [fexiwalt.com](https://fexiwalt.com)**

An ecommerce and classifieds marketplace for Ghana, where people buy and sell phones, vehicles, property, fashion and more. Designed, built and deployed by [Bright Akwasi Kodua](https://github.com/KODUAAA).

## Features
- Category browsing, deal listings, search and paging
- Post an ad with photos (compressed in the browser, uploaded to Cloudinary)
- Accounts with email or Google sign-in, password reset, "My ads", wishlist, follow sellers
- WhatsApp-based contact between buyers and sellers, share and report buttons
- Admin page for moderating ads and users (role-based)
- Installable web app (PWA) with offline support, dark mode, SEO and accessibility helpers
- Firestore and Storage security rules, plus Firebase App Check

**Stack:** HTML · CSS · JavaScript (ES modules, no build step) · Firebase (Auth, Firestore, Hosting) · Cloudinary · PWA

## Project layout
Classifieds marketplace for Ghana. Plain HTML/CSS/JS with Firebase (login + database) and Cloudinary (photos). No build step.

```
/                 the pages (kept at the top so the web addresses stay short: /help.html, /login.html ...)
                  index, category (browse), ad, post-ad, my-ads, wishlist, seller, sellers, login, register,
                  forgot-password, admin, help, contact, terms, privacy, 404, offline
                  + sw.js (offline/install, must stay here), manifest.webmanifest, robots.txt, sitemap.xml

js/core/          on every page: firebase connection, site details (site.js), header, footer, login state
                  (session.js), dark mode, install/offline, accessibility helpers, SEO, roles, locations
js/features/      shared building blocks: ad cards, paging, photo compress + upload, wishlist, share, report
js/pages/         one script per page (post-ad.js, admin.js, category.js ...)

css/              home.css (base look for all pages) + dark.css + one file per page area
images/           logo, hero and category photos, icons/ (app icons)
firebase/         firestore.rules and storage.rules (paste into the Firebase console to publish)
docs/             TODO-BEFORE-LAUNCH.md (start here), APP_CHECK.md, PHOTOS.md
tools/            make-sitemap.mjs: rebuilds sitemap.xml with all live ads (run before deploying)
old/              early drafts, not used by the site
```

Common edits: contact details -> `js/core/site.js` - header links/categories -> `js/core/header.js` - footer links -> `js/core/footer.js`.
