// Photo cleanup helpers shared by the Post/Edit page, My Ads and the admin dashboard.
import { storage, S } from "../core/firebase.js";

const isFirebaseUrl = u => typeof u === "string" && u.includes("firebasestorage");

/**
 * Delete an ad's photos when the ad or a photo is removed.
 *  - Firebase Storage photos are deleted (best effort; a failure never blocks the caller).
 *  - Cloudinary photos can NOT be deleted from the browser (that needs a secret key), so they are
 *    left in your Cloudinary media library. Clear them out there occasionally if space matters.
 * Returns how many photos could not be deleted.
 */
export async function deleteImages(urls = []) {
  const res = await Promise.allSettled(urls.filter(isFirebaseUrl).map(async u => S.deleteObject(S.ref(storage, u))));
  const failed = res.filter(r => r.status === "rejected");
  failed.forEach(r => console.warn("Couldn't delete image:", r.reason?.code || r.reason));
  return failed.length;
}
