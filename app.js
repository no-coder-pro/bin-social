// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit,
  deleteDoc, doc, where, updateDoc, arrayUnion, arrayRemove, getDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* -----------------------
   OWNER: এই UID-টা এডমিন হিসেবে গণ্য হবে
------------------------ */
const OWNER_UID = "Wzjx0uKoOZe82zAKns3dXpixOVH2";

/* -----------------------
   Firebase config
------------------------ */
const firebaseConfig = {
  apiKey: "AIzaSyBZeTFuBELvzeVYaxlKxM_Kfh8w3fZnjjw",
  authDomain: "bin-share-platform.firebaseapp.com",
  projectId: "bin-share-platform",
  storageBucket: "bin-share-platform.firebasestorage.app",
  messagingSenderId: "859371344608",
  appId: "1:859371344608:web:d809ebfeb323c340177685",
  measurementId: "G-3XQG0LDD8Q"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

/* -----------------------
   UI refs
------------------------ */
const userBox = document.getElementById("userBox");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const list = document.getElementById("list");
const meAvatar = document.getElementById("meAvatar");
const openComposer = document.getElementById("openComposer");
const openComposer2 = document.getElementById("openComposer2");
const composer = document.getElementById("composer");
const closeComposer = document.getElementById("closeComposer");
const cancelComposer = document.getElementById("cancelComposer");
const form = document.getElementById("form");
const pagination = document.getElementById("pagination");

// Edit modal refs
const editor = document.getElementById("editor");
const closeEditor = document.getElementById("closeEditor");
const cancelEditor = document.getElementById("cancelEditor");
const editForm = document.getElementById("editForm");
const editBinId = document.getElementById("editBinId");
const editTitle = document.getElementById("editTitle");
const editContent = document.getElementById("editContent");


// footer links (set your links)
document.getElementById("year").textContent = new Date().getFullYear();
document.getElementById("tgLink").href = "https://t.me/your_channel";
document.getElementById("fbLink").href = "https://facebook.com/your_page";
document.getElementById("ghLink").href = "https://github.com/your_repo";

/* -----------------------
   Filters & pagination
------------------------ */
let currentTab = "all";
let authorFilter = null;
let currentPage = 1;
const BINS_PER_PAGE = 25;

/* -----------------------
   Helpers
------------------------ */
const escapeHTML = (s = "") =>
  s.replace(/[&<>"']/g, m => ({ '&': "&amp;", '<': "&lt;", '>': "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const stripLinks = (text = "") => text.replace(/\b((?:https?:\/\/|www\.)\S+)\b/gi, "[link removed]");

/* -----------------------
   Auth
------------------------ */
loginBtn.onclick = async () => {
  try { await signInWithPopup(auth, provider); await auth.currentUser?.getIdToken(true); }
  catch (e) { alert(e?.message || "Login failed"); }
};
logoutBtn.onclick = async () => { await signOut(auth); };

/* -----------------------
   Modal handlers
------------------------ */
// Composer modal
const openComposerModal = () => { composer.classList.remove("hidden"); composer.setAttribute("aria-hidden", "false"); };
const closeComposerModal = () => { composer.classList.add("hidden"); composer.setAttribute("aria-hidden", "true"); form.reset(); };
openComposer.onclick = openComposerModal;
openComposer2.onclick = openComposerModal;
closeComposer.onclick = closeComposerModal;
cancelComposer.onclick = closeComposerModal;
composer.addEventListener("click", (e) => { if (e.target === composer) closeComposerModal(); });

// Editor modal
const openEditorModal = () => { editor.classList.remove("hidden"); editor.setAttribute("aria-hidden", "false"); };
const closeEditorModal = () => { editor.classList.add("hidden"); editor.setAttribute("aria-hidden", "true"); editForm.reset(); };
closeEditor.onclick = closeEditorModal;
cancelEditor.onclick = closeEditorModal;
editor.addEventListener("click", (e) => { if (e.target === editor) closeEditorModal(); });

/* -----------------------
   Tabs
------------------------ */
document.querySelectorAll('input[name="tab"]').forEach(r => {
  r.addEventListener("change", async (e) => {
    currentTab = e.target.value;
    currentPage = 1;
    authorFilter = null; // Reset author filter when changing tabs
    await setupRealtimeListener();
  });
});

/* -----------------------
   Session state
------------------------ */
let ME = null;
let IS_ADMIN = false;

onAuthStateChanged(auth, async (user) => {
  ME = user;
  if (user) {
    await user.getIdTokenResult(true);
    IS_ADMIN = (user.uid === OWNER_UID);

    userBox.textContent = `${user.displayName || user.email}${IS_ADMIN ? " (admin)" : ""}`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    if (meAvatar) {
      meAvatar.src = user.photoURL || "";
      meAvatar.alt = user.displayName || user.email || "me";
    }
  } else {
    IS_ADMIN = false;
    userBox.textContent = "Not logged in";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    if (meAvatar) {
      meAvatar.src = "";
      meAvatar.alt = "me";
    }
  }
  
  // Compose বাটনের অ্যাক্টিভিটি এখন login state-এর উপর নির্ভর করবে
  [openComposer, openComposer2].forEach(btn => {
    if (!btn) return;
    btn.disabled = !user;
    btn.setAttribute("aria-disabled", !user);
    btn.title = user ? "" : "You must be logged in to post.";
    btn.classList.toggle("disabled", !user);
  });

  await setupRealtimeListener();
});

/* -----------------------
   Create bin
------------------------ */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert("Please login first.");

  const title = document.getElementById("title").value.trim().slice(0, 120);
  const content = stripLinks(document.getElementById("content").value).trim();
  if (!content) return alert("Content is empty.");

  try {
    await addDoc(collection(db, "bins"), {
      title,
      content,
      syntax: "plain",
      authorId: user.uid,
      authorName: user.displayName || user.email || "Unknown",
      authorPhoto: user.photoURL || "",
      authorIsAdmin: IS_ADMIN,
      workingBy: [],
      brokenBy: [],
      createdAt: serverTimestamp(),
    });
    closeComposerModal();
  } catch (e) {
    alert(e?.message || "Failed to create bin");
  }
});

/* -----------------------
   Edit bin
------------------------ */
editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert("Please login first.");

  const docId = editBinId.value;
  const newTitle = editTitle.value.trim().slice(0, 120);
  const newContent = stripLinks(editContent.value).trim();
  if (!newContent) return alert("Content is empty.");
  
  try {
    const binRef = doc(db, "bins", docId);
    await updateDoc(binRef, {
      title: newTitle,
      content: newContent
    });
    closeEditorModal();
  } catch (e) {
    alert(e?.message || "Failed to update bin");
  }
});

/* -----------------------
   Realtime feed + filters
------------------------ */
let unsubscribeFromBins = null;

async function setupRealtimeListener() {
  if (unsubscribeFromBins) unsubscribeFromBins();

  const base = collection(db, "bins");
  // We will fetch all bins and filter/sort on the client-side to avoid index issues.
  let q = query(base, orderBy("createdAt", "desc"));

  unsubscribeFromBins = onSnapshot(q, (snapshot) => {
    let bins = snapshot.docs;

    // Apply filters
    if (authorFilter?.id) {
      bins = bins.filter(doc => doc.data().authorId === authorFilter.id);
    } else if (currentTab === "admin") {
      bins = bins.filter(doc => doc.data().authorId === OWNER_UID);
    } else if (currentTab === "user") {
      bins = bins.filter(doc => doc.data().authorId !== OWNER_UID);
    }
    
    renderList(bins);
  }, (error) => {
    list.innerHTML = "";
    alert(error?.message || "Failed to load bins");
  });
}

/* -----------------------
   Render + pagination
------------------------ */
function renderList(allBins) {
  const totalPages = Math.ceil(allBins.length / BINS_PER_PAGE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * BINS_PER_PAGE;
  const endIndex = startIndex + BINS_PER_PAGE;
  const binsToRender = allBins.slice(startIndex, endIndex);

  const frag = document.createDocumentFragment();
  if (binsToRender.length === 0) {
    list.innerHTML = `<p class='meta'>No bins found for this selection.</p>`;
  } else {
    binsToRender.forEach(d => {
      const data = d.data();
      const item = createBinItem(d.id, data);
      frag.appendChild(item);
    });
    list.innerHTML = "";
    list.appendChild(frag);
  }
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  pagination.innerHTML = "";
  if (totalPages <= 1) return;

  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.textContent = i;
    if (i === currentPage) pageBtn.classList.add("active");
    pageBtn.onclick = () => { currentPage = i; setupRealtimeListener(); };
    pagination.appendChild(pageBtn);
  }
}

/* -----------------------
   Card builder
------------------------ */
function createBinItem(docId, data) {
  const item = document.createElement("div");
  item.className = "item";

  const safeTitle = escapeHTML(data.title || "(untitled)");
  const syntax = data.syntax || "plain";
  const ts = data.createdAt?.toDate?.();
  const dateStr = ts ? ts.toLocaleString() : "";
  const authorName = escapeHTML(data.authorName || "Unknown");
  const authorBadge = (data.authorId === OWNER_UID) ? `<span class="badge">ADMIN</span>` : "";
  const authorPhoto = data.authorPhoto || "";

  const myId = ME?.uid;
  const isMyBin = myId === data.authorId;
  const canEdit = isMyBin || IS_ADMIN;
  const canDelete = isMyBin || IS_ADMIN;
  
  const workingCount = Array.isArray(data.workingBy) ? data.workingBy.length : 0;
  const brokenCount  = Array.isArray(data.brokenBy)  ? data.brokenBy.length  : 0;
  const iW = myId && Array.isArray(data.workingBy) && data.workingBy.includes(myId);
  const iB = myId && Array.isArray(data.brokenBy) && data.brokenBy.includes(myId);

  item.innerHTML = `
    <div class="itemHead">
      <a href="/profile.html?user=${data.authorId}"><img class="avatar" src="${authorPhoto}" alt="${authorName}" onerror="this.style.display='none'"/></a>
      <div>
        <a href="/profile.html?user=${data.authorId}" class="authorBtn" title="See ${authorName}'s bins">${authorName}</a>
        ${authorBadge}
        <div class="meta">${escapeHTML(dateStr)} • ${syntax}</div>
      </div>
    </div>

    <div class="content">
      ${safeTitle !== "(untitled)" ? `<div class="row"><strong>${safeTitle}</strong></div>` : ""}
      <pre class="code">${escapeHTML(data.content || "")}</pre>
    </div>
    
    ${canEdit ? `
    <div class="top-actions">
        <button class="editBtn iconBtn hidden" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        </button>
    </div>` : ''}

    <div class="row actions">
      <button class="voteBtn workBtn ${iW ? "active" : ""}" ${ME ? "" : "disabled title='Login to vote'"}>✅ <span class="count">(${workingCount})</span></button>
      <button class="voteBtn brokeBtn ${iB ? "active" : ""}" ${ME ? "" : "disabled title='Login to vote'"}>❌ <span class="count">(${brokenCount})</span></button>
      <span class="gap"></span>
      
      <div class="action-icons">
          <button class="delBtn iconBtn hidden" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
          </button>
      </div>
    </div>
  `;
  
  // Conditionally show edit/delete buttons
  const editBtn = item.querySelector(".editBtn");
  const delBtn = item.querySelector(".delBtn");
  
  if (editBtn && canEdit) {
      editBtn.classList.remove("hidden");
      editBtn.onclick = () => {
          editBinId.value = docId;
          editTitle.value = data.title || "";
          editContent.value = data.content || "";
          openEditorModal();
      };
  }
  
  if (delBtn && canDelete) {
      delBtn.classList.remove("hidden");
      delBtn.onclick = async () => {
          if (!confirm("Delete this bin?")) return;
          try { await deleteDoc(doc(db, "bins", docId)); }
          catch (e) { alert(e?.message || "Delete failed"); }
      };
  }
  
  // Author filter toggle
  const authorBtn = item.querySelector(".authorBtn");
  if (authorBtn) {
    authorBtn.onclick = (e) => {
      e.preventDefault();
      window.location.href = `/profile.html?user=${data.authorId}`;
    };
  }

  // Vote
  const workBtn = item.querySelector(".workBtn");
  const brokeBtn = item.querySelector(".brokeBtn");
  if (ME) {
      workBtn.onclick = async () => { await toggleVote(docId, true); };
      brokeBtn.onclick = async () => { await toggleVote(docId, false); };
  }
  
  return item;
}

/* -----------------------
   Vote toggle
------------------------ */
async function toggleVote(docId, isWorking) {
  const ref = doc(db, "bins", docId);
  const uid = auth.currentUser.uid;
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() || {};
  
  let workingBy = data.workingBy || [];
  let brokenBy = data.brokenBy || [];

  const hasW = workingBy.includes(uid);
  const hasB = brokenBy.includes(uid);

  if (isWorking) {
    if (hasW) {
      // remove from working
      workingBy = workingBy.filter(id => id !== uid);
    } else {
      // add to working, remove from broken
      workingBy.push(uid);
      brokenBy = brokenBy.filter(id => id !== uid);
    }
  } else {
    if (hasB) {
      // remove from broken
      brokenBy = brokenBy.filter(id => id !== uid);
    } else {
      // add to broken, remove from working
      brokenBy.push(uid);
      workingBy = workingBy.filter(id => id !== uid);
    }
  }

  await updateDoc(ref, { workingBy, brokenBy });
}
