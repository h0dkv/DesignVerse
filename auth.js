import { auth, db } from "./firebase-init.js";
import {
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    signInWithRedirect
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const adminEmails = [
    "hristianfortnite@gmail.com",
    "milabtv@gmail.com",
    "noit@oupvolov.com"
];

// ===== TOAST СИСТЕМА =====
function showToast(message, type = "success") {
    const existing = document.querySelector(".dr-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `dr-toast dr-toast--${type}`;
    toast.innerHTML = `
        <span class="dr-toast__icon">${type === "success" ? "✅" : "❌"}</span>
        <span class="dr-toast__msg">${message}</span>
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("dr-toast--show"));

    setTimeout(() => {
        toast.classList.remove("dr-toast--show");
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ===== AUTH STATE =====
onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const role = snap.data().role;
    if (role === "admin") {
        document.body.classList.add("admin");
    }
});

onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const role = adminEmails.includes(user.email) ? "admin" : "user";
        const userData = {
            email: user.email,
            role,
            displayName: user.displayName || null,
            photoURL: user.photoURL || null
        };

        if (!snap.exists()) {
            await setDoc(ref, { ...userData, createdAt: serverTimestamp() });
        } else {
            await setDoc(ref, userData, { merge: true });
        }
    } catch (err) {
        console.error("Failed to ensure user doc:", err);
    }
});

onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    const adminLink = document.getElementById("admin-link");
    if (snap.exists() && snap.data().role === "admin" && adminLink) {
        adminLink.style.display = "inline-block";
    }
});

// ===== DOM READY =====
document.addEventListener("DOMContentLoaded", () => {
    const loginLink = document.getElementById("login-link");
    const userMenu = document.getElementById("user-menu");
    const logoutBtn = document.getElementById("logout-btn");

    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (loginLink) loginLink.style.display = "none";
            if (userMenu) userMenu.style.display = "flex";
            const userNameEl = document.getElementById("user-name");
            if (userNameEl) userNameEl.textContent = user.displayName || user.email.split("@")[0];
        } else {
            if (loginLink) loginLink.style.display = "inline-block";
            if (userMenu) userMenu.style.display = "none";
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                window.location.href = "index.html";
            });
        });
    }

    // ===== GOOGLE SIGN-IN =====
    const googleButtons = [
        document.getElementById('google-signin'),
        document.getElementById('google-register')
    ].filter(Boolean);

    const provider = new GoogleAuthProvider();

    googleButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (btn.disabled) return;
            btn.disabled = true;
            try {
                await signInWithPopup(auth, provider);
                window.location.href = 'profile.html';
            } catch (err) {
                console.error('Google sign-in failed', err);

                if (err.code === 'auth/popup-closed-by-user') {
                    showToast('Затворихте прозореца. Опитайте отново.', 'error');
                } else if (
                    err.code === 'auth/popup-blocked' ||
                    err.code === 'auth/cancelled-popup-request' ||
                    err.code === 'auth/operation-not-supported-in-this-environment'
                ) {
                    try {
                        await signInWithRedirect(auth, provider);
                    } catch (rerr) {
                        console.error('Redirect fallback failed', rerr);
                        showToast('Грешка при пренасочване за вход.', 'error');
                    }
                } else if (err.code === 'auth/account-exists-with-different-credential') {
                    showToast('Вече имате акаунт с този имейл чрез друг доставчик.', 'error');
                } else {
                    showToast('Неуспешен вход с Google. Опитайте отново.', 'error');
                }
            } finally {
                btn.disabled = false;
            }
        });
    });

    const githubButtons = [
        document.getElementById('github-signin'),
        document.getElementById('github-register')
    ].filter(Boolean);

    const githubProvider = new GithubAuthProvider();

    githubButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (btn.disabled) return;
            btn.disabled = true;
            try {
                await signInWithPopup(auth, githubProvider);
                window.location.href = 'profile.html';
            } catch (err) {
                if (err.code === 'auth/popup-closed-by-user') {
                    showToast('Затворихте прозореца. Опитайте отново.', 'error');
                } else if (err.code === 'auth/account-exists-with-different-credential') {
                    showToast('Вече имате акаунт с този имейл чрез друг доставчик.', 'error');
                } else {
                    showToast('Неуспешен вход с GitHub.', 'error');
                }
            } finally {
                btn.disabled = false;
            }
        });
    }); 
});