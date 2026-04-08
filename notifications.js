import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
    collection, query, where, onSnapshot,
    doc, updateDoc, getDocs, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/* ─── CSS ─── */
const style = document.createElement("style");
style.textContent = `
  #dashboard { position: relative; }
  .notif-badge {
    position: absolute; top: -4px; right: -4px;
    background: #e53935; color: #fff;
    font-size: 10px; font-weight: 700;
    width: 18px; height: 18px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none; z-index: 10;
    animation: notifPop 0.3s ease;
  }
  @keyframes notifPop { from { transform: scale(0); } to { transform: scale(1); } }
  .notif-panel {
    position: absolute; top: calc(100% + 10px); right: 0;
    width: 300px;
    background: rgba(45,18,40,0.98);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 18px; box-shadow: 0 12px 35px rgba(0,0,0,0.4);
    z-index: 9999; display: none; flex-direction: column; overflow: hidden;
  }
  .notif-panel.show { display: flex; }
  .notif-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.9rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.08);
    font-size: 0.85rem; font-weight: 700; color: #fff;
  }
  .notif-clear-btn {
    background: none; border: none; color: rgba(255,255,255,0.45);
    font-size: 0.78rem; cursor: pointer; padding: 0; transition: color 0.2s;
  }
  .notif-clear-btn:hover { color: var(--accent); }
  .notif-list { max-height: 320px; overflow-y: auto; }
  .notif-list::-webkit-scrollbar { width: 4px; }
  .notif-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
  .notif-item {
    display: flex; align-items: flex-start; gap: 0.7rem;
    padding: 0.85rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background 0.2s;
  }
  .notif-item:last-child { border-bottom: none; }
  .notif-item.unread { background: rgba(255,193,69,0.06); }
  .notif-item:hover { background: rgba(255,255,255,0.05); }
  .notif-icon { font-size: 1.2rem; flex-shrink: 0; margin-top: 0.1rem; }
  .notif-text { flex: 1; }
  .notif-text strong { display: block; font-size: 0.85rem; color: #fff; margin-bottom: 0.15rem; }
  .notif-text span { font-size: 0.78rem; color: rgba(255,255,255,0.45); }
  .notif-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-top: 0.4rem; }
  .notif-empty { padding: 2rem 1rem; text-align: center; color: rgba(255,255,255,0.4); font-size: 0.88rem; }
  .notif-empty-icon { font-size: 2rem; margin-bottom: 0.5rem; }
  .notif-toggle-btn {
    display: flex; align-items: center; gap: 0.5rem;
    background: none; border: none; color: #fff; font-size: 0.95rem;
    cursor: pointer; padding: 10px 12px; width: 100%; text-align: left;
    border-radius: 10px; transition: background 0.2s; box-sizing: border-box;
  }
  .notif-toggle-btn:hover { background: rgba(255,255,255,0.1); }
`;
document.head.appendChild(style);

function timeAgo(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "преди малко";
    if (diff < 3600) return `преди ${Math.floor(diff / 60)} мин`;
    if (diff < 86400) return `преди ${Math.floor(diff / 3600)} ч`;
    return `преди ${Math.floor(diff / 86400)} дни`;
}

function notifIcon(type) {
    if (type === "approved") return "✅";
    if (type === "rejected") return "❌";
    if (type === "welcome") return "👋";
    return "🔔";
}

function renderNotifs(notifs, listEl) {
    if (!notifs.length) {
        listEl.innerHTML = `<div class="notif-empty"><div class="notif-empty-icon">🔕</div><p>Нямате известия</p></div>`;
        return;
    }
    listEl.innerHTML = "";
    notifs.forEach(n => {
        const item = document.createElement("div");
        item.className = `notif-item${n.read ? "" : " unread"}`;
        item.innerHTML = `
      <span class="notif-icon">${notifIcon(n.type)}</span>
      <div class="notif-text">
        <strong>${n.message || "Ново известие"}</strong>
        <span>${timeAgo(n.createdAt)}</span>
      </div>
      ${!n.read ? '<div class="notif-dot"></div>' : ""}
    `;
        listEl.appendChild(item);
    });
}

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const dashboard = document.getElementById("dashboard");
    const dashboardBtn = document.getElementById("dashboard-btn");
    if (!dashboard || !dashboardBtn) return;

    // Добави панела
    const panel = document.createElement("div");
    panel.id = "notif-panel";
    panel.className = "notif-panel";
    panel.innerHTML = `
    <div class="notif-header">
      <span>🔔 Известия</span>
      <button class="notif-clear-btn" id="notif-clear">Маркирай всички</button>
    </div>
    <div class="notif-list" id="notif-list">
      <div class="notif-empty"><div class="notif-empty-icon">🔕</div><p>Нямате известия</p></div>
    </div>
  `;
    dashboard.appendChild(panel);

    // Badge върху аватара
    const badge = document.createElement("span");
    badge.id = "notif-badge";
    badge.className = "notif-badge";
    badge.style.display = "none";
    dashboardBtn.style.position = "relative";
    dashboardBtn.appendChild(badge);

    // Бутон в dashboard-menu
    const dashMenu = document.getElementById("dashboard-menu");
    if (dashMenu && !dashMenu.querySelector("#notif-toggle")) {
        const btn = document.createElement("button");
        btn.id = "notif-toggle";
        btn.className = "notif-toggle-btn";
        btn.innerHTML = `🔔 Известия <span id="notif-menu-count" style="display:none;background:#e53935;color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;font-weight:700;margin-left:auto;"></span>`;
        const logoutBtn = dashMenu.querySelector("#logout-btn");
        if (logoutBtn) dashMenu.insertBefore(btn, logoutBtn);
        else dashMenu.appendChild(btn);
    }

    const listEl = document.getElementById("notif-list");
    const clearBtn = document.getElementById("notif-clear");
    const notifToggle = document.getElementById("notif-toggle");
    const menuCount = document.getElementById("notif-menu-count");

    // Toggle панела
    notifToggle?.addEventListener("click", (e) => {
        e.stopPropagation();
        panel.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
        if (!panel.contains(e.target) && e.target !== notifToggle) {
            panel.classList.remove("show");
        }
    });

    // Маркирай всички като прочетени
    clearBtn?.addEventListener("click", async () => {
        const q = query(collection(db, "notifications"), where("uid", "==", user.uid), where("read", "==", false));
        const snap = await getDocs(q);
        snap.forEach(async (d) => await updateDoc(doc(db, "notifications", d.id), { read: true }));
    });

    // Live слушател
    const q = query(
        collection(db, "notifications"),
        where("uid", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(20)
    );

    onSnapshot(q, (snap) => {
        const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const unread = notifs.filter(n => !n.read).length;

        if (unread > 0) {
            const label = unread > 9 ? "9+" : String(unread);
            badge.textContent = label; badge.style.display = "flex";
            if (menuCount) { menuCount.textContent = label; menuCount.style.display = "inline"; }
        } else {
            badge.style.display = "none";
            if (menuCount) menuCount.style.display = "none";
        }

        renderNotifs(notifs, listEl);
    });
});