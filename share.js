// Share an ad. On phones this opens the phone's own share sheet (WhatsApp, Messages, etc.).
// On computers, or where that isn't available, a small pop-up offers WhatsApp, Facebook, X, Telegram,
// email and "Copy link". Needs SweetAlert2 on the page.
export async function shareAd({ title, url, priceText }) {
  const text = `${title}${priceText ? ` for ${priceText}` : ""} on FEXIWALT`;

  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; }
    catch (err) {
      if (err?.name === "AbortError") return;   // the visitor cancelled: nothing more to do
      // any other problem: fall through to the pop-up below
    }
  }

  // Every part that comes from the ad is URL-encoded, so it can't inject anything into the pop-up.
  const e = encodeURIComponent;
  const links = [
    ["WhatsApp", "fab fa-whatsapp", "#25d366", `https://wa.me/?text=${e(`${text} ${url}`)}`],
    ["Facebook", "fab fa-facebook-f", "#1877f2", `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`],
    ["X", "fab fa-x-twitter", "#111827", `https://twitter.com/intent/tweet?text=${e(text)}&url=${e(url)}`],
    ["Telegram", "fab fa-telegram", "#229ed9", `https://t.me/share/url?url=${e(url)}&text=${e(text)}`],
    ["Email", "fa-regular fa-envelope", "#6b7280", `mailto:?subject=${e(title)}&body=${e(`${text}\n${url}`)}`]
  ];

  await Swal.fire({
    title: "Share this ad",
    html: `<div class="share-grid">
        ${links.map(([name, icon, color, href]) =>
          `<a href="${href}" target="_blank" rel="noopener" style="--c:${color}"><i class="${icon}"></i><span>${name}</span></a>`).join("")}
        <button type="button" id="copyLink" style="--c:#0a3fc4"><i class="fa-regular fa-copy"></i><span>Copy link</span></button>
      </div>
      <input class="share-url" id="shareUrl" readonly aria-label="Ad link">`,
    showConfirmButton: false, showCloseButton: true,
    didOpen: () => {
      const input = document.getElementById("shareUrl");
      input.value = url;   // set as a value, never as HTML
      const btn = document.getElementById("copyLink");
      const label = btn.querySelector("span");
      btn.onclick = async () => {
        try { await navigator.clipboard.writeText(url); }
        catch { input.select(); document.execCommand("copy"); }   // older browsers
        label.textContent = "Copied!";
        setTimeout(() => (label.textContent = "Copy link"), 1800);
      };
    }
  });
}
