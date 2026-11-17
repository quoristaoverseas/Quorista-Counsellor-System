import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
$("year").textContent = new Date().getFullYear();

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("login-button");
  $("auth-message").textContent = "";
  button.disabled = true;
  button.textContent = "Signing in…";
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
  } catch (error) {
    $("auth-message").textContent = error.code === "auth/invalid-credential"
      ? "The email or password is incorrect."
      : error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
});

$("signout-button").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $("auth-view").classList.remove("hidden");
    $("dashboard-view").classList.add("hidden");
    return;
  }
  try {
    const [profileSnap, staffSnap] = await Promise.all([
      getDoc(doc(db, "users", user.uid)),
      getDoc(doc(db, "staff", user.uid))
    ]);
    if (!profileSnap.exists() || !staffSnap.exists()) {
      await signOut(auth);
      $("auth-message").textContent = "This account is missing its staff access profile. Please contact the Super Admin.";
      return;
    }

    const profile = profileSnap.data();
    const staff = staffSnap.data();
    const roleService = {
      study_counsellor: "study_abroad",
      tourism_counsellor: "tourism"
    };
    const expectedService = roleService[profile.role];
    const staffIsActive = staff.active === true &&
      ["counsellor", "super_admin"].includes(staff.role) &&
      Array.isArray(staff.services);
    const roleMatchesService = profile.role === "super_admin"
      ? staff.role === "super_admin"
      : Boolean(expectedService && staff.services.includes(expectedService));

    if (profile.accountStatus !== "active" || !staffIsActive || !roleMatchesService) {
      await signOut(auth);
      $("auth-message").textContent = "This account is inactive or its staff permissions do not match. Please contact the Super Admin.";
      return;
    }

    const serviceNames = staff.services.map(service =>
      service === "study_abroad" ? "Study Abroad" :
      service === "tourism" ? "International Tourism" : service
    );
    $("welcome-title").textContent = "Welcome, " + (profile.fullName || "Team member");
    $("profile-email").textContent = serviceNames.length
      ? "Authorized services: " + serviceNames.join(", ")
      : (profile.email || user.email || "");
    $("auth-view").classList.add("hidden");
    $("dashboard-view").classList.remove("hidden");
  } catch (error) {
    $("auth-message").textContent = "Unable to load your profile. Please try again later.";
    console.error(error);
  }
});
