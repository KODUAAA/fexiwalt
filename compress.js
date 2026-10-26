// Shrink a photo in the browser before it is uploaded.
//
// A phone photo is often 3-8 MB and 4000px wide, far more than a web page needs. This resizes it so the
// longest side is at most `maxSide` px and re-saves it as an optimised JPEG. Pages load faster, mobile
// data is saved, and less storage is used. If shrinking would not help (already small, or the result would
// be bigger), the original file is returned untouched, so it is always safe to call.
//
//   const small = await compressImage(file);        // returns a File
export async function compressImage(file, { maxSide = 1600, quality = 0.82, keepBelow = 250 * 1024 } = {}) {
  if (!file?.type?.startsWith("image/") || file.type === "image/gif") return file;   // leave animations alone

  let bmp;
  try {
    // "from-image" applies the camera's rotation, so portrait phone photos don't come out sideways
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;   // browser can't read it: upload as is
  }

  try {
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.type === "image/jpeg" && file.size <= keepBelow) return file;   // already small

    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";            // PNG/WebP transparency would turn black in a JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);

    const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;   // no saving: keep the original

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bmp.close?.();
  }
}

export const formatBytes = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
