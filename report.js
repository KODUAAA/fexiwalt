// Report an ad: a signed-in buyer flags a scam or a rule-breaking ad. Admins see reports in the dashboard.
// One report per person per ad (the document id is "<adId>_<reporterUid>", and the Firestore rules allow it once).
import { auth, db, F } from "../core/firebase.js";

export const REASONS = ["Scam or fraud", "Fake or misleading ad", "Prohibited item", "Wrong category", "Already sold", "Duplicate ad", "Other"];

const swal = o => Swal.fire({ confirmButtonColor: "#0a3fc4", ...o });

export async function reportAd(ad) {
  const user = auth.currentUser;
  if (!user) { location.href = `login.html?next=${location.pathname.split("/").pop()}`; return; }
  if (ad.sellerId && ad.sellerId === user.uid) return swal({ icon: "info", title: "This is your ad", text: "You can't report your own ad." });
  const ref = F.doc(db, "reports", `${ad.id}_${user.uid}`);

  try {
    if ((await F.getDoc(ref)).exists()) {
      return swal({ icon: "info", title: "Already reported", text: "Thanks. We already have your report for this ad and will look into it." });
    }
  } catch (err) { console.warn("Duplicate check skipped:", err.code); }

  const { value } = await swal({
    title: "Report this ad",
    html: `<select id="rReason" class="swal2-select" style="width:90%;margin:.5rem 0">
             <option value="">Choose a reason…</option>${REASONS.map(r => `<option>${r}</option>`).join("")}
           </select>
           <textarea id="rDetails" class="swal2-textarea" maxlength="500" placeholder="Tell us what's wrong (optional)" style="width:90%;margin:.3rem 0"></textarea>`,
    showCancelButton: true, confirmButtonText: "Send report", confirmButtonColor: "#e11d48",
    focusConfirm: false,
    preConfirm: () => {
      const reason = document.getElementById("rReason").value;
      if (!reason) { Swal.showValidationMessage("Please choose a reason"); return false; }
      return { reason, details: document.getElementById("rDetails").value.trim().slice(0, 500) };
    }
  });
  if (!value) return;

  try {
    await F.setDoc(ref, {
      adId: ad.id, adTitle: String(ad.title || "").slice(0, 80),
      reporterId: user.uid, reason: value.reason, details: value.details,
      status: "open", createdAt: F.serverTimestamp()
    });
    swal({ icon: "success", title: "Report sent", text: "Thank you for helping keep FEXIWALT safe. Our team will review it." });
  } catch (err) {
    console.error(err.code, err);
    swal({ icon: "error", title: "Couldn't send the report",
      text: err.code === "permission-denied" ? "You have already reported this ad. Thanks, our team will review it." : "Please try again." });
  }
}
