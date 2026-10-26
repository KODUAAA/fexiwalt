// Photo slots. Any element with  data-photo="images/xyz.jpg"  shows that photo once the file loads.
// If the file doesn't exist yet, nothing changes and the icon / artwork fallback stays.
// (CSS in css/photos.css decides how each kind of slot looks when it has a photo.)
document.querySelectorAll("[data-photo]").forEach(el => {
  const img = new Image();
  img.onload = () => {
    el.style.setProperty("--photo", `url("${img.src}")`);
    el.classList.add("has-photo");
  };
  img.src = el.dataset.photo;   // a missing file just fires onerror, which we ignore on purpose
});
