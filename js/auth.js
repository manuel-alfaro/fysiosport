import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submit-btn');
const toggleBtn = document.getElementById('toggle-btn');
const formTitle = document.getElementById('form-title');
const authMessage = document.getElementById('auth-message');
const toggleText = document.getElementById('toggle-text');
const submitText = document.getElementById('submit-text');
const registerFields = document.getElementById('register-fields');
const nameInput = document.getElementById('name');
const roleSelect = document.getElementById('role');
const roleCustom = document.getElementById('role-custom');

let isLoginMode = true;

// Only execute UI logic if on login.html
if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;

        authMessage.textContent = 'Processing...';
        authMessage.className = '';

        try {
            let userCredential;
            if (isLoginMode) {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
                // Update Last Login
                const user = userCredential.user;
                await setDoc(doc(db, "users", user.uid), {
                    email: email,
                    lastLogin: serverTimestamp()
                }, { merge: true });

                // Redirect on success (onAuthStateChanged will handle it generally, but we can force it here for speed)
                window.location.href = 'dashboard.html';
            } else {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                let rawRole = roleSelect ? roleSelect.value : '';
                if (rawRole === 'Other' && roleCustom) {
                    rawRole = roleCustom.value.trim() || 'User';
                }

                const finalName = nameInput ? nameInput.value.trim() : '';

                // Capture Extended Profile into Firestore
                await setDoc(doc(db, "users", user.uid), {
                    email: email,
                    name: finalName,
                    role: rawRole,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                });

                authMessage.textContent = 'Account created! Logging in...';
                authMessage.className = 'success-message';
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            }
        } catch (error) {
            console.error("Auth error:", error);
            let message = 'An error occurred.';
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                message = 'Invalid email or password.';
            } else if (error.code === 'auth/email-already-in-use') {
                message = 'Email address is already in use.';
            } else if (error.code === 'auth/weak-password') {
                message = 'Password is too weak (min 6 characters).';
            }
            authMessage.textContent = message;
            authMessage.className = 'error-message';
        }
    });

    toggleBtn.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        if (isLoginMode) {
            if (submitText) submitText.textContent = 'Login';
            toggleText.textContent = "Don't have an account?";
            toggleBtn.textContent = 'Sign Up';
            if (registerFields) {
                registerFields.style.opacity = '0';
                setTimeout(() => registerFields.style.display = 'none', 200);
            }
        } else {
            if (submitText) submitText.textContent = 'Sign Up';
            toggleText.textContent = 'Already have an account?';
            toggleBtn.textContent = 'Login';
            if (registerFields) {
                registerFields.style.display = 'block';
                setTimeout(() => registerFields.style.opacity = '1', 10);
            }
        }
        authMessage.textContent = '';
    });
}

// Global Auth State Monitor
onAuthStateChanged(auth, (user) => {
    const path = window.location.pathname;
    const isLoginPage = path.includes('index.html') || path === '/' || path.endsWith('alphatek-reports.web.app/');

    if (user) {
        // User is signed in
        if (isLoginPage) {
            // Prevent auto-redirect loop. Only redirect if we just logged in (handled by form submit)
            // Or show a message "You are logged in".
            console.log("User already logged in. Navigate to index manually if needed or wait for manual redirect.");
            // Optional: Auto-redirect ONLY if not coming from index? Hard to know.
            // SAFEST: Let the user click or just rely on the form submit redirect?
            // Form submit does: window.location.href = 'index.html';

            // For now, let's STOP the auto-redirect here to break the loop the user is seeing.
            // We can replace the form content with a "Go to App" button if we want, but let's just log it.
            // window.location.href = 'index.html'; // Wait, checking this IS the loop cause. 
        }
        // If needed, we can expose the user globally or simple dispatch an event
        window.currentUser = user;
        console.log("User logged in:", user.email);
    } else {
        // User is signed out
        if (!isLoginPage) {
            window.location.href = 'index.html';
        }
    }
});

// Logout Helper (attach to window for easy access from non-module scripts if needed, though we will try to stick to modules)
window.logoutUser = async () => {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Logout failed", error);
    }
};
