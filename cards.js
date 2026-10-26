// The ad card used on the homepage, browse page and wishlist page.
// The heart button is wired up globally by js/wishlist.js (any element with data-heart="<ad id>").
import { esc, money, timeAgo, discountPct } from "../core/util.js";
import { optimizeImg } from "./cloudinary.js";

export const skeletons = n => Array.from({ length: n }, () => '<div class="ad-card skeleton"></div>').join("");

export function adCard(ad) {
  const isNew = ad.createdAt?.toMillis && Date.now() - ad.createdAt.toMillis() < 3 * 864e5;
  const img = ad.images?.[0];
  const off = discountPct(ad);
  return `<a class="ad-card" href="ad.html?id=${encodeURIComponent(ad.id)}">
    <div class="ad-img">
      ${img ? `<img loading="lazy" src="${esc(optimizeImg(img, 600))}" alt="${esc(ad.title)}">` : '<i class="fa-regular fa-image"></i>'}
      ${ad.condition ? `<span class="ad-cond">${esc(ad.condition)}</span>` : ""}
      ${isNew ? '<span class="ad-new">New</span>' : ""}
      <button type="button" class="heart" data-heart="${esc(ad.id)}" aria-label="Save to wishlist" aria-pressed="false"><i class="fa-regular fa-heart"></i></button>
    </div>
    <div class="ad-body">
      <h3>${esc(ad.title)}</h3>
      <div class="ad-price">${money(ad.price)}${off ? ` <s class="was">${money(ad.oldPrice)}</s><em class="off-pill">-${off}%</em>` : ""}${ad.negotiable ? "<small>Negotiable</small>" : ""}</div>
      <div class="ad-meta"><span><i class="fa-solid fa-location-dot"></i> ${esc(ad.location)}</span><span>${timeAgo(ad.createdAt)}</span></div>
    </div></a>`;
}
