// auth.js (place in project root, load as <script type="module" src="auth.js"></script>)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js"; // optional
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdToken
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeCaB9Y_gzRq9BMtZs1ufbHahGlWj8E6M",
  authDomain: "socially-2cd7b.firebaseapp.com",
  projectId: "socially-2cd7b",
  storageBucket: "socially-2cd7b.firebasestorage.app",
  messagingSenderId: "25029623485",
  appId: "1:25029623485:web:eefe4b7c1efbc2a64bc1d4",
  measurementId: "G-ERH0N7NXWM"
};

// init
const app = initializeApp(firebaseConfig);
// analytics is optional; remove if not needed or server-side
try { const analytics = getAnalytics(app); } catch(e) { /* ignore if not available */ }

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Google popup sign-in
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // result.user is firebase user
    return result.user;
  } catch (err) {
    console.error('Google sign-in error', err);
    throw err;
  }
}

// Email/password sign-in
export async function signInEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err) {
    console.error('Email sign-in error', err);
    throw err;
  }
}

// Signup
export async function signUpEmail(name, email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // optional: updateProfile(cred.user, { displayName: name }) if you import updateProfile
    return cred.user;
  } catch (err) {
    console.error('Signup error', err);
    throw err;
  }
}

// Sign out
export async function doSignOut() {
  await signOut(auth);
}

// Get current user's ID token (for sending to your socket server)
export async function getCurrentIdToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) throw new Error('No user logged in');
  return await getIdToken(user, forceRefresh);
}

// React to auth state changes
onAuthStateChanged(auth, user => {
  if (user) {
    console.log('User signed in:', user.uid, user.email);
    // you can dispatch a custom event so your UI knows:
    document.dispatchEvent(new CustomEvent('socially:loggedIn', { detail: { user } }));
  } else {
    console.log('No user');
    document.dispatchEvent(new CustomEvent('socially:loggedOut'));
  }
});
