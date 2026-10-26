// Profile checks used by the header (Admin link), the admin page, and the post-an-ad page.
// Everything comes from the user's Firestore document users/<uid>:
//   role: "admin"   -> an administrator
//   banned: true    -> a suspended account (can log in and browse, but can't post or edit ads)
// NOTE: this only decides what the UI shows. The real protection is in firebase/firestore.rules.
import { db, F } from "./firebase.js";

const cache = new Map();

// one read of the profile, shared by every check on the page
function profile(user) {
  if (!user) return Promise.resolve(null);
  if (!cache.has(user.uid)) {
    cache.set(user.uid, F.getDoc(F.doc(db, "users", user.uid))
      .then(s => (s.exists() ? s.data() : null))
      .catch(err => { console.warn("Profile check failed:", err.code); return null; }));
  }
  return cache.get(user.uid);
}

export const isAdmin = async user => (await profile(user))?.role === "admin";
export const isBanned = async user => (await profile(user))?.banned === true;
/** The ban details, so the person can be told why: { reason } or null when not banned. */
export async function banInfo(user) {
  const p = await profile(user);
  return p?.banned === true ? { reason: p.bannedReason || "" } : null;
}
