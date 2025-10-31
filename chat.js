// chat-firestore.js  (type="module")
// Minimal, no-backend chat using Firestore real-time listeners + toasts
// Requires index.html to have: #chatWidget, #chatBody, #chatForm, #chatInput
// Place <script type="module" src="./chat-firestore.js"></script> at end of body

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ---------- CONFIG: dəyişdirməyi unutma ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyDeCaB9Y_gzRq9BMtZs1ufbHahGlWj8E6M",
  authDomain: "socially-2cd7b.firebaseapp.com",
  projectId: "socially-2cd7b",
  storageBucket: "socially-2cd7b.firebasestorage.app",
  messagingSenderId: "25029623485",
  appId: "1:25029623485:web:eefe4b7c1efbc2a64bc1d4",
  measurementId: "G-ERH0N7NXWM"
};
/* ------------------------------------------------- */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// UI refs (sənin HTML-də olmalı)
const chatWidget = document.getElementById('chatWidget');
const chatBody = document.getElementById('chatBody');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

if (!chatBody || !chatForm || !chatInput) {
  console.warn('chat-firestore.js: chat elements not found in DOM. Make sure #chatBody, #chatForm, #chatInput exist.');
}

// toast container CSS (inject once)
(function injectToastCSS(){
  if (document.getElementById('socially-toast-css')) return;
  const css = `
  .socially-toast-wrap{position:fixed;right:18px;top:18px;z-index:99999;display:flex;flex-direction:column;gap:10px}
  .socially-toast{min-width:200px;padding:10px 14px;border-radius:10px;background:linear-gradient(90deg,#111 0%,#333 100%);color:#fff;box-shadow:0 10px 30px rgba(0,0,0,0.18);font-weight:600;opacity:0;transform:translateY(-6px);transition:all .32s cubic-bezier(.2,.9,.3,1)}
  .socially-toast.show{opacity:1;transform:none}
  .socially-toast.info{background:linear-gradient(90deg,#0ea5e9,#0673b8)}
  .socially-toast.success{background:linear-gradient(90deg,#10b981,#059669)}
  .socially-toast.warn{background:linear-gradient(90deg,#f59e0b,#b45309)}
  .socially-toast .close-btn{float:right;margin-left:8px;cursor:pointer;background:transparent;border:0;color:rgba(255,255,255,0.9);font-weight:700}
  `;
  const s = document.createElement('style'); s.id='socially-toast-css'; s.innerHTML = css; document.head.appendChild(s);
  const wrap = document.createElement('div'); wrap.className = 'socially-toast-wrap'; wrap.id = 'socially-toast-wrap'; document.body.appendChild(wrap);
})();

// showToast function
function showToast(text, kind = 'info', timeout = 3500) {
  const wrap = document.getElementById('socially-toast-wrap');
  if (!wrap) return; 
  const t = document.createElement('div');
  t.className = `socially-toast ${kind}`;
  t.innerHTML = `<span>${escapeHtml(text)}</span><button class="close-btn" aria-label="close">×</button>`;
  wrap.appendChild(t);
  // show animation
  requestAnimationFrame(()=> t.classList.add('show'));
  // close handler
  t.querySelector('.close-btn').addEventListener('click', () => { hide(t); });
  // auto hide
  const id = setTimeout(()=> hide(t), timeout);
  function hide(el){ if (!el) return; el.classList.remove('show'); setTimeout(()=> el.remove(), 260); clearTimeout(id); }
}

// simple html-escape
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// chat collection path (simple global room). If you want DM: use conversationId variable and collection(`conversations/${conversationId}/messages`)
const MESSAGES_COLLECTION = collection(db, 'messages'); // top-level 'messages' collection
const MESSAGES_QUERY = query(MESSAGES_COLLECTION, orderBy('ts', 'asc'), limit(1000)); // adjust limit as needed

let unsubscribe = null;
let currentUser = null;

// Render message into chatBody
function appendMessageToUI({fromUid, displayName, text, ts}) {
  if (!chatBody) return;
  const wrapper = document.createElement('div');
  const isMe = currentUser && (fromUid === currentUser.uid);
  wrapper.className = 'msg' + (isMe ? ' sent' : '');
  // simple structure
  wrapper.innerHTML = `
    ${isMe ? '' : `<div class="msg-from">${escapeHtml(displayName || 'Anon')}</div>`}
    <div class="msg-text">${escapeHtml(text)}</div>
    <div class="msg-time">${ts ? new Date(ts.seconds ? ts.seconds * 1000 : ts).toLocaleTimeString() : ''}</div>
  `;
  chatBody.appendChild(wrapper);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// start listening messages
function startListening() {
  if (unsubscribe) unsubscribe();
  // using MESSAGES_QUERY
  unsubscribe = onSnapshot(MESSAGES_QUERY, (snap) => {
    // clear and re-render or better: only handle changes (we'll handle changes incremental)
    // We'll append new docs only
    // But for simplicity, let's clear and render all (safe for small load)
    chatBody.innerHTML = '';
    snap.forEach(doc => {
      const data = doc.data();
      appendMessageToUI({
        fromUid: data.fromUid,
        displayName: data.displayName,
        text: data.text,
        ts: data.ts
      });
    });
    // show toast for last message if it's not from me
    const last = snap.docs[snap.docs.length -1];
    if (last) {
      const d = last.data();
      if (!currentUser || d.fromUid !== currentUser.uid) {
        showToast(`${d.displayName || 'New'}: ${String(d.text).slice(0,60)}`, 'info', 3000);
      }
    }
  }, (err) => {
    console.error('messages onSnapshot error', err);
    showToast('Mesaj oxunmasında xəta', 'warn', 3000);
  });
}

// send message (writes to Firestore)
async function sendMessage(text) {
  if (!currentUser) {
    showToast('Zəhmət olmasa giriş et', 'warn');
    return;
  }
  const payload = {
    text: String(text).slice(0, 4000),
    fromUid: currentUser.uid,
    displayName: currentUser.displayName || currentUser.email || 'You',
    ts: serverTimestamp()
  };
  try {
    await addDoc(MESSAGES_COLLECTION, payload);
    // optimistic UI handled by onSnapshot; still you can append immediate if you want
  } catch (err) {
    console.error('sendMessage error', err);
    showToast('Mesaj göndərilmədi', 'warn');
  }
}

/* ---------- wire up form ---------- */
if (chatForm) {
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const txt = (chatInput.value || '').trim();
    if (!txt) return;
    await sendMessage(txt);
    chatInput.value = '';
  });
}

/* ---------- Auth handling ---------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    console.log('Signed in as', user.uid);
    showToast(`Xoş gəldin, ${user.displayName || (user.email ? user.email.split('@')[0] : 'user')}`, 'success', 2200);
    // start listening to messages once authenticated
    startListening();
  } else {
    // sign in anonymously as fallback
    try {
      const anon = await signInAnonymously(auth);
      currentUser = anon.user;
      showToast('Anonim daxil oldun', 'info', 1400);
      startListening();
    } catch (err) {
      console.error('Anonymous sign-in failed', err);
      showToast('Giriş alınmadı', 'warn', 2200);
    }
  }
});
