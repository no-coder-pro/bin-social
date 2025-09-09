import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');
const profilePosts = document.getElementById('profile-posts');

const urlParams = new URLSearchParams(window.location.search);
const userIdParam = urlParams.get('user');
const userId = userIdParam ? userIdParam.trim() : null;

function renderBins(bins) {
    if (!profilePosts) return;
    profilePosts.innerHTML = '';
    if (bins.length === 0) {
        profilePosts.innerHTML = '<p>This user has no posts.</p>';
        return;
    }
    bins.forEach(binDoc => {
        const binData = binDoc.data();
        const item = document.createElement('div');
        item.className = 'item';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';

        if (binData.title) {
            const title = document.createElement('strong');
            title.textContent = binData.title;
            contentDiv.appendChild(title);
        }

        const pre = document.createElement('pre');
        pre.className = 'code';
        pre.textContent = binData.content;
        contentDiv.appendChild(pre);

        item.appendChild(contentDiv);
        profilePosts.appendChild(item);

        // Set profile info from the first bin
        if (!profileName.textContent || profileName.textContent === 'User Name') {
            profileName.textContent = binData.authorName;
            profileAvatar.src = binData.authorPhoto;
        }
    });
}

if (userId) {
    const binsRef = collection(db, "bins");
    const q = query(binsRef, where("authorId", "==", userId));
    onSnapshot(q, (snapshot) => {
        const bins = snapshot.docs.sort((a, b) => b.data().createdAt - a.data().createdAt);
        renderBins(bins);
    }, (error) => {
        console.error("Error fetching user posts: ", error);
        profilePosts.innerHTML = "<p>Could not load posts. See console for details.</p>";
    });
} else {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // This is the current user's profile, redirect with their ID
            window.location.search = `?user=${user.uid}`;
        } else {
            profileName.textContent = 'Please log in';
        }
    });
}
