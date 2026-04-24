import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  collection, getDocs, query, where, doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const totalUsersEl = document.getElementById("total-users");
const approvedModelsEl = document.getElementById("approved-models");
const pendingModelsEl = document.getElementById("pending-models");
const favoritesEl = document.getElementById("favorites-count");

function showToast(message, type = "success") {
  const existing = document.querySelector(".dr-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = `dr-toast dr-toast--${type}`;
  toast.innerHTML = `<span class="dr-toast__icon">${type === "success" ? "✅" : "❌"}</span><span class="dr-toast__msg">${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("dr-toast--show"));
  setTimeout(() => { toast.classList.remove("dr-toast--show"); setTimeout(() => toast.remove(), 400); }, 3500);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html"; return; }

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) { window.location.href = "index.html"; return; }

    const role = userSnap.data().role;
    if (role !== "admin") {
      showToast("Нямате достъп до статистиките.", "error");
      setTimeout(() => { window.location.href = "index.html"; }, 2000);
      return;
    }

    await loadStatistics();
  } catch (err) {
    console.error("Auth error:", err);
  }
});

async function loadStatistics() {
  try {
    // Потребители
    const usersSnap = await getDocs(collection(db, "users"));
    if (totalUsersEl) totalUsersEl.textContent = usersSnap.size;

    // Одобрени модели
    const approvedSnap = await getDocs(query(collection(db, "models"), where("status", "==", "approved")));
    if (approvedModelsEl) approvedModelsEl.textContent = approvedSnap.size;

    // Чакащи модели
    const pendingSnap = await getDocs(query(collection(db, "models"), where("status", "==", "pending")));
    if (pendingModelsEl) pendingModelsEl.textContent = pendingSnap.size;

    // Любими
    const favoritesSnap = await getDocs(collection(db, "favorites"));
    if (favoritesEl) favoritesEl.textContent = favoritesSnap.size;

  } catch (err) {
    console.error("Статистики грешка:", err);
    showToast("Грешка при зареждане на статистиките.", "error");
  }
}