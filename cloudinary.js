// Photo hosting on Cloudinary (free tier), used instead of Firebase Storage.
//
// SETUP (once):
//   1. cloudinary.com -> create a free account.
//   2. Settings -> Upload -> Upload presets -> Add: Signing mode = "Unsigned". Copy the preset name.
//   3. Paste your cloud name (Dashboard, top left) and the preset name below.
// Neither value is a secret. Never put the API secret in this file.
export const CLOUDINARY = {
  cloudName: "f6uviysy",
  uploadPreset: "fexiwalt_ads"
};

const configured = () => !/^YOUR_/.test(CLOUDINARY.cloudName) && !/^YOUR_/.test(CLOUDINARY.uploadPreset);

const fail = (code, message) => Object.assign(new Error(message), { code });

/** Upload one image; onProgress gets 0-1; resolves with the image's https URL. */
export function uploadToCloudinary(file, onProgress = () => {}) {
  if (!configured()) return Promise.reject(fail("cloudinary/not-configured", "Cloudinary isn't set up yet"));

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CLOUDINARY.uploadPreset);
    form.append("folder", "fexiwalt/ads");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`);
    xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(fail("cloudinary/network", "Network error while uploading"));
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) { onProgress(1); resolve(body.secure_url); }
      else reject(fail("cloudinary/failed", body.error?.message || `Upload failed (${xhr.status})`));
    };
    xhr.send(form);
  });
}

/**
 * Serve a smaller, auto-optimised version of a Cloudinary image (faster pages).
 * Other URLs (e.g. old Firebase Storage links) are returned unchanged.
 *   optimizeImg(url, 600)  ->  .../image/upload/f_auto,q_auto,w_600/v123/photo.jpg
 */
export function optimizeImg(url, width = 800) {
  return typeof url === "string" && url.includes("res.cloudinary.com") && url.includes("/image/upload/")
    ? url.replace("/image/upload/", `/image/upload/f_auto,q_auto,w_${width}/`)
    : url;
}
