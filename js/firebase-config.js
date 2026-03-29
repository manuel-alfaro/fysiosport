import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCAh5-C-fnIBd6w0bcSSrvibuZsLygfETc",
    authDomain: "alphatek-reports.firebaseapp.com",
    projectId: "alphatek-reports",
    storageBucket: "alphatek-reports.firebasestorage.app",
    messagingSenderId: "660435776370",
    appId: "1:660435776370:web:321f8c45d19e4c213e23eb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
