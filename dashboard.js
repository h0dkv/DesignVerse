import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const loginLink = document.getElementById("login-link");
  const dashboard = document.getElementById("dashboard");
  const dashboardBtn = document.getElementById("dashboard-btn");
  const dashboardMenu = document.getElementById("dashboard-menu");
  const logoutBtn = document.getElementById("logout-btn");
  const greeting = document.getElementById("user-greeting");
  const userNameEl = document.getElementById("user-name");

  onAuthStateChanged(auth, user => {
    if (user) {
      if (loginLink) loginLink.style.display = "none";
      if (dashboard) dashboard.style.display = "block";
      if (greeting) greeting.textContent = `Здравей, ${user.displayName || user.email.split("@")[0]}!`;

      const btn = document.getElementById("dashboard-btn");
      if (btn && user.photoURL) {
        btn.innerHTML = `<img src="${user.photoURL}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;">`;
      }

      (async () => {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists() && userNameEl) {
            userNameEl.textContent = snap.data().username || user.displayName || user.email.split("@")[0];
          }
        } catch (err) { console.error("Failed to fetch user doc:", err); }
      })();

    } else {
      if (loginLink) loginLink.style.display = "inline-block";
      if (dashboard) dashboard.style.display = "none";
    }
  });

  if (dashboardBtn && dashboardMenu) {
    dashboardBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dashboardMenu.classList.toggle("show");
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try { await signOut(auth); } catch (err) { console.error(err); }
      window.location.href = "index.html";
    });
  }

  document.addEventListener("click", e => {
    if (dashboard && dashboardMenu && !dashboard.contains(e.target)) {
      dashboardMenu.classList.remove("show");
    }
  });
});