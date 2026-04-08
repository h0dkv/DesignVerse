import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  collection, getDocs, query, where,
  doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const pendingList = document.getElementById("pending-list");
const searchEl = document.getElementById("pm-search");
const refreshBtn = document.getElementById("pm-refresh");

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

async function sendNotification(uid, type, modelTitle) {
  if (!uid) return;
  try {
    await addDoc(collection(db, "notifications"), {
      uid, type,
      message: type === "approved"
        ? `Моделът „${modelTitle}" беше одобрен и е публикуван в каталога! ✅`
        : `Моделът „${modelTitle}" беше отхвърлен от администратор.`,
      link: type === "approved" ? "catalog.html" : "uploads.html",
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (err) { console.error("Notification error:", err); }
}

async function fetchPending(filter = "") {
  if (!pendingList) return;
  pendingList.innerHTML = "<p>Зареждане...</p>";
  try {
    const snap = await getDocs(query(collection(db, "models"), where("status", "==", "pending")));
    let items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    if (filter) items = items.filter(i => (i.title || "").toLowerCase().includes(filter.toLowerCase()));
    render(items);
  } catch (err) {
    pendingList.innerHTML = "<p>Грешка: " + err.message + "</p>";
  }
}

function render(items) {
  if (!items.length) {
    pendingList.innerHTML = `<div style="text-align:center;padding:3rem;color:rgba(255,255,255,0.5);grid-column:1/-1"><div style="font-size:3rem;margin-bottom:1rem">✅</div><p>Няма модели в очакване.</p></div>`;
    return;
  }
  pendingList.innerHTML = "";
  items.forEach((it, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.animationDelay = `${index * 0.07}s`;
    const img = it.imageURL || it.imageUrl || "";
    const title = it.title || "Без заглавие";
    card.innerHTML = `
      ${img ? `<img src="${img}" alt="${title}" style="width:100%;height:160px;object-fit:cover;border-radius:12px;margin-bottom:0.8rem;" onerror="this.style.display='none'">` : `<div style="font-size:3rem;text-align:center;padding:1rem 0">📦</div>`}
      <h3>${title}</h3>
      <p style="color:rgba(255,255,255,0.6);font-size:0.9rem;margin-bottom:0.5rem">${it.description || "Няма описание"}</p>
      <p style="color:rgba(255,255,255,0.45);font-size:0.8rem;margin-bottom:1rem">📧 ${it.uploaderEmail || "—"}<br>📁 ${it.fileName || "—"}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${it.fileURL ? `<a href="${it.fileURL}" target="_blank" class="btn" style="font-size:0.85rem;padding:0.5rem 1rem;">⬇️ Файл</a>` : ""}
        <button class="btn" style="font-size:0.85rem;padding:0.5rem 1rem;background:linear-gradient(135deg,#28a745,#20c997)" data-id="${it.id}" data-uid="${it.uploadedBy || ""}" data-title="${title}" data-action="approve">✅ Одобри</button>
        <button class="btn" style="font-size:0.85rem;padding:0.5rem 1rem;background:linear-gradient(135deg,#dc3545,#c82333)" data-id="${it.id}" data-uid="${it.uploadedBy || ""}" data-title="${title}" data-action="reject">❌ Отхвърли</button>
      </div>
    `;
    pendingList.appendChild(card);
  });

  pendingList.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { id, uid, title, action } = btn.dataset;
      btn.disabled = true; btn.textContent = "Обработка...";
      try {
        const modelRef = doc(db, "models", id);
        if (!(await getDoc(modelRef)).exists()) throw new Error("Моделът не съществува");
        if (action === "approve") {
          await updateDoc(modelRef, { status: "approved", publishedAt: serverTimestamp() });
          await sendNotification(uid, "approved", title);
          showToast("Одобрено! Потребителят е уведомен. ✅");
        } else {
          await deleteDoc(modelRef);
          await sendNotification(uid, "rejected", title);
          showToast("Отхвърлено. Потребителят е уведомен.", "error");
        }
      } catch (err) {
        showToast("Грешка: " + err.message, "error");
      } finally {
        fetchPending(searchEl?.value || "");
      }
    });
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists() || snap.data().role !== "admin") {
      showToast("Нямате администраторски достъп.", "error");
      setTimeout(() => { window.location.href = "index.html"; }, 2000);
      return;
    }
  } catch (err) { return; }
  fetchPending();
});

if (searchEl) searchEl.addEventListener("input", () => fetchPending(searchEl.value));
if (refreshBtn) refreshBtn.addEventListener("click", () => fetchPending(searchEl?.value || ""));