import { auth, db } from "./firebase-init.js";
import {
  collection, getDocs, updateDoc, deleteDoc, doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const list = document.getElementById("users-list");
const searchEl = document.getElementById("userSearch");
const refreshBtn = document.getElementById("refreshUsers");
const countEl = document.getElementById("users-count");

/* ---------------- TOAST ---------------- */
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

/* ---------------- RENDER ---------------- */
function renderUsers(users) {
  list.innerHTML = "";

  if (!users.length) {
    list.innerHTML = `<div style="text-align:center;padding:3rem;color:rgba(255,255,255,0.5);grid-column:1/-1"><div style="font-size:3rem">👥</div><p>Няма намерени потребители.</p></div>`;
    return;
  }

  countEl.textContent = `${users.length} потребители`;

  users.forEach((u, index) => {
    const isAdmin = u.role === "admin";
    const card = document.createElement("div");
    card.className = "card";
    card.style.animationDelay = `${index * 0.05}s`;

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.8rem;margin-bottom:0.8rem;">
        <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">
          ${u.photoURL ? `<img src="${u.photoURL}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;">` : "👤"}
        </div>
        <div>
          <div style="font-weight:600;color:#fff;font-size:0.95rem;">${u.displayName || u.email?.split("@")[0] || "—"}</div>
          <div style="font-size:0.8rem;color:rgba(255,255,255,0.55);">${u.email || "—"}</div>
        </div>
      </div>

      <div style="margin-bottom:1rem;">
        <span style="display:inline-block;padding:0.25rem 0.8rem;border-radius:20px;font-size:0.78rem;font-weight:600;${isAdmin ? "background:rgba(168,102,131,0.3);color:#ffb3d1;border:1px solid rgba(168,102,131,0.4);" : "background:rgba(255,193,69,0.15);color:var(--accent);border:1px solid rgba(255,193,69,0.3);"}">
          ${isAdmin ? "👑 Администратор" : "👤 Потребител"}
        </span>
      </div>

      <div style="display:flex;gap:0.6rem;flex-wrap:wrap;">
        ${!isAdmin
        ? `<button class="btn" style="font-size:0.85rem;padding:0.45rem 0.9rem;" data-uid="${u.uid}" data-action="makeAdmin">👑 Направи админ</button>`
        : `<button class="btn" style="font-size:0.85rem;padding:0.45rem 0.9rem;background:rgba(255,255,255,0.1);" data-uid="${u.uid}" data-action="makeUser">👤 Направи потребител</button>`
      }
        <button class="btn" style="font-size:0.85rem;padding:0.45rem 0.9rem;background:linear-gradient(135deg,#dc3545,#c82333);" data-uid="${u.uid}" data-action="delete">🗑️ Изтрий</button>
      </div>
    `;

    list.appendChild(card);
  });

  // Бутони
  list.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.uid;
      const action = btn.dataset.action;
      btn.disabled = true;
      btn.textContent = "...";

      try {
        if (action === "makeAdmin") {
          await updateDoc(doc(db, "users", uid), { role: "admin" });
          showToast("Потребителят е направен администратор.");
        } else if (action === "makeUser") {
          await updateDoc(doc(db, "users", uid), { role: "user" });
          showToast("Потребителят е върнат към обикновен акаунт.");
        } else if (action === "delete") {
          await deleteDoc(doc(db, "users", uid));
          showToast("Потребителят е изтрит.", "error");
        }
        await loadUsers();
      } catch (err) {
        console.error(err);
        showToast("Грешка: " + err.message, "error");
        btn.disabled = false;
      }
    });
  });
}

/* ---------------- LOAD ---------------- */
let allUsers = [];

async function loadUsers() {
  list.innerHTML = "<p style='padding:1rem'>Зареждане...</p>";
  try {
    const snap = await getDocs(collection(db, "users"));
    allUsers = [];
    snap.forEach(d => allUsers.push({ uid: d.id, ...d.data() }));
    filterAndRender();
  } catch (err) {
    console.error(err);
    list.innerHTML = `<p style='color:red'>Грешка: ${err.message}</p>`;
  }
}

function filterAndRender() {
  const term = searchEl?.value.toLowerCase() || "";
  const filtered = term
    ? allUsers.filter(u => (u.email || "").toLowerCase().includes(term) || (u.displayName || "").toLowerCase().includes(term))
    : allUsers;
  renderUsers(filtered);
}

/* ---------------- AUTH CHECK ---------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html"; return; }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists() || snap.data().role !== "admin") {
      showToast("Нямате администраторски достъп.", "error");
      setTimeout(() => { window.location.href = "index.html"; }, 2000);
      return;
    }
  } catch (err) {
    console.error(err);
    return;
  }

  await loadUsers();
});

if (searchEl) searchEl.addEventListener("input", filterAndRender);
if (refreshBtn) refreshBtn.addEventListener("click", loadUsers);