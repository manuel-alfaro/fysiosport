// DEBUG SCRIPT: Paste into Browser Console or link in index.html temporarily
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, collectionGroup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './firebase-config.js'; // Ensure path is correct

async function inspectData() {
    console.log("--- STARTING DATA INSPECTION ---");

    try {
        // 1. Check USERS Collection
        console.log("%c 1. Users Collection (Top Level)", "color: orange; font-weight: bold;");
        const usersSnap = await getDocs(collection(db, 'users'));
        if (usersSnap.empty) {
            console.log("No documents in 'users' collection.");
        } else {
            console.log(`Found ${usersSnap.size} users.`);
            usersSnap.forEach(doc => {
                console.log(`User ID: ${doc.id}`, doc.data());
            });
        }

        // 2. Check PROTOCOLS Collection Group
        console.log("%c 2. Protocols (All Collections)", "color: orange; font-weight: bold;");
        const protocolsSnap = await getDocs(collectionGroup(db, 'protocols'));
        if (protocolsSnap.empty) {
            console.log("No documents in 'protocols' collection group.");
        } else {
            console.log(`Found ${protocolsSnap.size} protocols.`);
            protocolsSnap.forEach(doc => {
                const path = doc.ref.path;
                // Try to extract user ID from path users/{uid}/protocols/{pid}
                const parts = path.split('/');
                const uid = parts.length > 1 ? parts[1] : 'unknown';
                console.log(`Protocol: ${doc.data().name} (Owner: ${uid})`, doc.data());
            });
        }

        // 3. Check SCREENINGS Collection Group
        console.log("%c 3. Screenings (Reports)", "color: orange; font-weight: bold;");
        const screeningsSnap = await getDocs(collectionGroup(db, 'screenings'));
        if (screeningsSnap.empty) {
            console.log("No documents in 'screenings' collection group.");
        } else {
            console.log(`Found ${screeningsSnap.size} screenings.`);
            // Only show first 5 to avoid spam
            let count = 0;
            screeningsSnap.forEach(doc => {
                if (count < 5) {
                    const data = doc.data();
                    console.log(`Screening ${doc.id}:`, {
                        patient: data.patientName,
                        createdBy: data.createdBy,
                        email: data.createdByEmail, // Check if this exists
                        userId: data.userId,
                        activeTestIds: data.activeTestIds
                    });
                }
                count++;
            });
        }

    } catch (e) {
        console.error("Inspection Failed:", e);
    }
    console.log("--- END INSPECTION ---");
}

// Auto-run if loaded
inspectData();
