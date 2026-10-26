// Forgot password: emails a reset link through Firebase Authentication.
import { auth, A } from "../core/firebase.js";

const form = document.getElementById("forgotForm");
const askPanel = document.getElementById("askPanel");
const sentPanel = document.getElementById("sentPanel");
const emailInput = form.elements.email;
const err = document.querySelector('.err[data-for="email"]');

const setErr = msg => {
  err.textContent = msg;
  emailInput.closest(".field").classList.toggle("invalid", !!msg);
};
const validate = () => {
  const v = emailInput.validity;
  const msg = v.valueMissing ? "Enter your email" : v.typeMismatch ? "Enter a valid email address" : "";
  setErr(msg);
  return !msg;
};
emailInput.addEventListener("blur", validate);
emailInput.addEventListener("input", () => emailInput.closest(".field").classList.contains("invalid") && validate());

const FRIENDLY = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "Network problem. Check your internet connection and try again.",
  "auth/operation-not-allowed": "Email/password sign-in isn't enabled in the Firebase console."
};

form.addEventListener("submit", async e => {
  e.preventDefault();
  if (!validate()) { emailInput.focus(); return; }

  const email = emailInput.value.trim();
  const btn = form.querySelector(".submit");
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = "Sending…";

  try {
    await A.sendPasswordResetEmail(auth, email, { url: `${location.origin}/login.html` })
      .catch(err => err.code === "auth/unauthorized-continue-uri" ? A.sendPasswordResetEmail(auth, email) : Promise.reject(err));   // after choosing a new password, "Continue" goes to the login page
  } catch (e2) {
    // "no account with this email" is reported as success on purpose, so nobody can use this
    // form to find out which emails are registered.
    if (e2.code !== "auth/user-not-found") {
      console.error(e2.code, e2.message);
      Swal.fire({
        icon: "error", title: "Couldn't send the email",
        text: FRIENDLY[e2.code] || "Something went wrong. Please try again.",
        confirmButtonColor: "#0a3fc4"
      });
      btn.disabled = false; btn.textContent = label;
      return;
    }
  }

  document.getElementById("sentText").textContent =
    `If an account exists for ${email}, we've sent a link to reset your password.`;
  askPanel.hidden = true; sentPanel.hidden = false;
  btn.disabled = false; btn.textContent = label;
});

document.getElementById("againBtn").addEventListener("click", () => {
  sentPanel.hidden = true; askPanel.hidden = false;
  emailInput.value = ""; setErr(""); emailInput.focus();
});
