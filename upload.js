import { auth, db } from "./firebase-init.js";
import {
  addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

/* ---------------- CLOUDINARY ---------------- */
const CLOUD_NAME = "djyxlskkh";
const UPLOAD_PRESET = "DesignRealm";

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

/* ---------------- DOM ---------------- */
const titleInput = document.getElementById("title");
const descInput = document.getElementById("description");
const fileInput = document.getElementById("file");
const dropZone = document.getElementById("drop-zone");
const fileInfo = document.getElementById("file-info");
const fileName = document.getElementById("file-name");
const fileSize = document.getElementById("file-size");
const uploadBtn = document.getElementById("uploadBtn");
const progressContainer = document.getElementById("progress-container");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");

// Снимка
const imageDropZone = document.getElementById("image-drop-zone");
const imageFileInput = document.getElementById("image-file");
const imagePreviewWrap = document.getElementById("image-preview-wrap");
const imagePreview = document.getElementById("image-preview");

let selectedFile = null;
let selectedImage = null;
let currentUser = null;

/* ---------------- AUTH ---------------- */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    showToast("Моля първо влезте в профила си.", "error");
    setTimeout(() => { window.location.href = "auth.html"; }, 2000);
    return;
  }
  currentUser = user;
});

/* ---------------- IMAGE DROP ZONE ---------------- */
imageDropZone.addEventListener("click", () => imageFileInput.click());
imageDropZone.addEventListener("dragover", (e) => { e.preventDefault(); imageDropZone.classList.add("dragover"); });
imageDropZone.addEventListener("dragleave", () => imageDropZone.classList.remove("dragover"));
imageDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  imageDropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length > 0) handleImageSelect(e.dataTransfer.files[0]);
});
imageFileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) handleImageSelect(e.target.files[0]);
});

function handleImageSelect(file) {
  if (!file.type.startsWith("image/")) {
    showToast("Моля изберете снимка (JPG, PNG, WEBP).", "error");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast("Снимката е над 10MB.", "error");
    return;
  }
  selectedImage = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    imagePreviewWrap.style.display = "block";
  };
  reader.readAsDataURL(file);
}

/* ---------------- FILE DROP ZONE ---------------- */
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
});

function handleFileSelect(file) {
  if (!file) return;
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
  if (![".stl", ".zip"].includes(ext)) {
    showToast("Позволени са само STL или ZIP файлове.", "error");
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showToast("Файлът е над 50MB.", "error");
    return;
  }
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);
  fileInfo.style.display = "block";
  checkForm();
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + ["Bytes", "KB", "MB", "GB"][i];
}

titleInput.addEventListener("input", checkForm);
function checkForm() {
  uploadBtn.disabled = !(titleInput.value.trim() && selectedFile);
}

/* ---------------- CLOUDINARY UPLOAD HELPER ---------------- */
function uploadToCloudinary(file, resourceType = "raw") {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`);

    if (resourceType === "raw") {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          progressFill.style.width = percent + "%";
          progressText.textContent = "Качване на файл... " + percent + "%";
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error("Cloudinary error: " + xhr.responseText));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Мрежова грешка")));
    xhr.send(formData);
  });
}

/* ---------------- UPLOAD ---------------- */
uploadBtn.onclick = async () => {
  if (!currentUser) {
    showToast("Моля първо влезте в профила си.", "error");
    return;
  }

  const title = titleInput.value.trim();
  const description = descInput ? descInput.value.trim() : "";

  if (!title || !selectedFile) {
    showToast("Липсва ime или файл.", "error");
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Качване...";
  progressContainer.style.display = "block";

  try {
    // 1. Качи снимката ако има
    let imageURL = "";
    if (selectedImage) {
      progressText.textContent = "Качване на снимка...";
      const imgResult = await uploadToCloudinary(selectedImage, "image");
      imageURL = imgResult.secure_url;
    }

    // 2. Качи файла
    progressText.textContent = "Качване на файл... 0%";
    const fileResult = await uploadToCloudinary(selectedFile, "raw");

    // 3. Запиши в Firestore
    await addDoc(collection(db, "models"), {
      title,
      description,
      fileURL: fileResult.secure_url,
      imageURL,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      status: "pending",
      uploadedBy: currentUser.uid,
      uploaderEmail: currentUser.email,
      createdAt: serverTimestamp()
    });

    progressFill.style.width = "100%";
    progressText.textContent = "Качено успешно! ✅";
    showToast("Моделът е качен успешно! 🎉", "success");
    setTimeout(() => resetForm(), 2000);

  } catch (err) {
    console.error("Upload error:", err);
    showToast("Грешка при качването: " + err.message, "error");
    resetForm();
  }
};

/* ---------------- RESET ---------------- */
function resetForm() {
  titleInput.value = "";
  if (descInput) descInput.value = "";
  fileInput.value = "";
  imageFileInput.value = "";
  selectedFile = null;
  selectedImage = null;
  fileInfo.style.display = "none";
  imagePreviewWrap.style.display = "none";
  imagePreview.src = "";
  progressContainer.style.display = "none";
  progressFill.style.width = "0%";
  uploadBtn.disabled = true;
  uploadBtn.textContent = "⬆ Качи модел";
}