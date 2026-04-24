import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
    collection, query, where, orderBy, getDocs, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const grid = document.getElementById("uploads-grid");
const countEl = document.getElementById("uploads-count");
const overlay = document.getElementById("confirm-overlay");
const confirmYes = document.getElementById("confirm-yes");
const confirmNo = document.getElementById("confirm-no");

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

function formatSize(bytes) {
    if (!bytes) return "";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ["B", "KB", "MB", "GB"][i];
}

function formatDate(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("bg-BG");
}

let pendingDeleteId = null;

confirmNo.addEventListener("click", () => {
    overlay.classList.remove("show");
    pendingDeleteId = null;
});

confirmYes.addEventListener("click", async () => {
    if (!pendingDeleteId) return;
    overlay.classList.remove("show");
    try {
        await deleteDoc(doc(db, "models", pendingDeleteId));
        document.querySelector(`[data-model-id="${pendingDeleteId}"]`)?.remove();
        const remaining = grid.querySelectorAll(".upload-item").length;
        countEl.textContent = `${remaining} модела`;
        if (remaining === 0) showEmpty();
        showToast("Моделът е изтрит успешно.");
    } catch (err) {
        console.error(err);
        showToast("Грешка при изтриване.", "error");
    }
    pendingDeleteId = null;
});

function showEmpty() {
    grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="icon">📭</div>
          <p>Нямате качени модели.</p>
          <a href="upload.html" class="btn" style="margin-top:1rem">Качи първия си модел</a>
        </div>`;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "auth.html"; return; }

    grid.innerHTML = "";
    try {
        const q = query(
            collection(db, "models"),
            where("uploadedBy", "==", user.uid),
            orderBy("createdAt", "desc")
        );
        const snaps = await getDocs(q);

        if (snaps.empty) { showEmpty(); countEl.textContent = "0 модела"; return; }

        countEl.textContent = `${snaps.size} модела`;

        snaps.forEach((d, i) => {
            const data = d.data();
            const statusClass = data.status === "approved" ? "status-approved" : "status-pending";
            const statusText = data.status === "approved" ? "✅ Одобрен" : "⏳ Чака одобрение";

            const card = document.createElement("div");
            card.className = "upload-item";
            card.dataset.modelId = d.id;
            card.style.animationDelay = `${i * 0.07}s`;
            card.innerHTML = `
            <h4>${data.title || "Без заглавие"}</h4>
            <div class="meta">${data.fileName || ""} ${data.fileSize ? "• " + formatSize(data.fileSize) : ""} ${data.createdAt ? "• " + formatDate(data.createdAt) : ""}</div>
            <span class="status ${statusClass}">${statusText}</span>
            <div class="upload-item-actions">
              <a href="model-view.html?model=${d.id}" class="btn-sm primary">👁 Преглед</a>
              <button class="btn-sm danger del-btn" data-id="${d.id}">🗑️ Изтрий</button>
            </div>
          `;
            grid.appendChild(card);
        });

        grid.addEventListener("click", (e) => {
            const btn = e.target.closest(".del-btn");
            if (!btn) return;
            pendingDeleteId = btn.dataset.id;
            overlay.classList.add("show");
        });

    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">⚠️</div><p>Грешка при зареждане.</p></div>`;
    }
});