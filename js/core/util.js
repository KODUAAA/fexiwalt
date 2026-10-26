// Small helpers shared by several pages.
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const money = n => "GH₵ " + Number(n).toLocaleString();

// Firestore Timestamp (or Date) -> "3 hours ago"
export function timeAgo(ts) {
  const ms = ts?.toMillis ? ts.toMillis() : ts instanceof Date ? ts.getTime() : null;
  if (!ms) return "Just now";
  const s = Math.max(0, (Date.now() - ms) / 1000);
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [name, secs] of units) {
    const n = Math.floor(s / secs);
    if (n >= 1) return `${n} ${name}${n > 1 ? "s" : ""} ago`;
  }
  return "Just now";
}

/**
 * Build a WhatsApp click-to-chat link for an ad.
 *   whatsappLink(ad.phone, ad.title)  ->  https://wa.me/233240000000?text=Hi%2C%20I'm%20interested...
 * Accepts Ghana numbers as 0240000000, 240000000, 233240000000, +233 24 000 0000, etc.
 * Returns null when the number is missing or invalid, so callers can hide the button.
 */
export function whatsappLink(phone, title) {
  let d = String(phone ?? "").replace(/\D/g, "");    // keep digits only
  if (d.startsWith("00")) d = d.slice(2);            // 00233... -> 233...
  if (d.startsWith("0")) d = "233" + d.slice(1);     // local 0240... -> 233240...
  else if (d.length === 9) d = "233" + d;            // 240000000 -> 233240000000
  if (!/^233\d{9}$/.test(d)) return null;            // wa.me needs full international format
  const msg = `Hi, I'm interested in your ad: ${title || "your ad"}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`;
}

/** Percent off when an ad has an original price above its price (0 = no discount). */
export const discountPct = ad => ad?.oldPrice > ad?.price ? Math.round((1 - ad.price / ad.oldPrice) * 100) : 0;

// ---- ad lifetime -------------------------------------------------------------------------------------
// A live ad is shown for 60 days. Admin approval (and Renew / Relist) writes an `expiresAt` date on the ad.
// Older ads without one count 60 days from when they were approved (or posted). The site hides expired ads
// from every list and marks their page "expired"; the seller can renew them from My Ads with one tap.
export const EXPIRY_DAYS = 60;
const DAY = 864e5;
export const expiresMs = ad => ad?.expiresAt?.toMillis?.()
  ?? ((ad?.reviewedAt?.toMillis?.() ?? ad?.createdAt?.toMillis?.() ?? Date.now()) + EXPIRY_DAYS * DAY);
export const isExpired = ad => expiresMs(ad) < Date.now();
export const daysLeft = ad => Math.ceil((expiresMs(ad) - Date.now()) / DAY);
/** A new expiry date, in milliseconds: 60 days from now, minus an hour of margin for clock differences
 *  (the Firestore rules refuse anything more than 60 days ahead of the server's time). */
export const newExpiryMs = () => Date.now() + EXPIRY_DAYS * DAY - 3600e3;
