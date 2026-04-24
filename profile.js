import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  // Имейл и име
  const displayName = user.displayName || user.email.split("@")[0];
  document.getElementById("profile-name").textContent = displayName;
  document.getElementById("profile-email").textContent = user.email;
  document.getElementById("info-email").textContent = user.email;

  // Аватар от Google
  if (user.photoURL) {
    const avatarEl = document.getElementById("profile-avatar");
    avatarEl.innerHTML = `<img src="${user.photoURL}" alt="Аватар">`;
  }

  // Роля от Firestore
  const snap = await getDoc(doc(db, "users", user.uid));
  const role = snap.exists() ? snap.data().role : "user";
  document.getElementById("info-role").textContent = role === "admin" ? "Администратор" : "Потребител";

  const badge = document.getElementById("profile-badge");
  if (role === "admin") {
    badge.textContent = "👑 Администратор";
    badge.classList.add("admin");
  } else {
    badge.textContent = "Потребител";
  }

  // Брой качвания
  try {
    const uploadsQ = query(collection(db, "models"), where("uid", "==", user.uid));
    const uploadsSnap = await getDocs(uploadsQ);
    document.getElementById("stat-uploads").textContent = uploadsSnap.size;
  } catch (e) {
    document.getElementById("stat-uploads").textContent = "—";
  }

  // Брой любими
  try {
    const favsQ = query(collection(db, "favorites"), where("uid", "==", user.uid));
    const favsSnap = await getDocs(favsQ);
    document.getElementById("stat-favorites").textContent = favsSnap.size;
  } catch (e) {
    document.getElementById("stat-favorites").textContent = "—";
  }
});