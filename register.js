import { auth, db } from "./firebase-init.js";
import { createUserWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const form = document.querySelector(".register-form");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (!username || !email || !password || !confirmPassword) {
      alert("Моля, попълнете всички полета!");
      return;
    }

    if (password !== confirmPassword) {
      alert("Паролите не съвпадат!");
      return;
    }

    if (password.length < 8) {
      alert("Паролата трябва да бъде минимум 8 символа!");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // 🔥 Записваме в Firestore
      await setDoc(doc(db, "users", cred.user.uid), {
        username: username,
        email: email,
        role: "user", // можеш да го направиш dynamic
        createdAt: serverTimestamp(),
        avatar: "images/avatar_placeholder.png"
      });

      alert("Успешна регистрация!");
      window.location.href = "auth.html";

    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        alert("Този имейл вече е регистриран!");
      } else if (error.code === "auth/invalid-email") {
        alert("Невалиден имейл!");
      } else {
        alert("Грешка: " + error.message);
      }
    }
  });
}