import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, query, getDocs, deleteDoc, doc, serverTimestamp, orderBy, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { DEFAULT_PROTOCOLS } from './default_protocols.js';

/**
 * Creates a protocol object.
 * @param {string} name - Name of the protocol.
 * @param {string[]} testIds - Array of test IDs included in the protocol.
 * @returns {object} The protocol object ready for saving.
 */
export function createProtocol(name, testIds) {
    return {
        name: name,
        testIds: testIds,
        createdAt: serverTimestamp()
    };
}

/**
 * Saves a new protocol to Firebase for the current user.
 * @param {object} protocol - The protocol object.
 * @returns {Promise<string>} The ID of the saved protocol.
 */
export async function saveProtocol(protocol) {
    if (!auth.currentUser) throw new Error("User not authenticated");

    try {
        const protocolsRef = collection(db, "users", auth.currentUser.uid, "protocols");
        const docRef = await addDoc(protocolsRef, protocol);
        console.log("Protocol saved with ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding protocol: ", e);
        throw e;
    }
}

/**
 * Fetches all protocols for the current user from Firebase.
 * @returns {Promise<object[]>} Array of protocol objects with IDs.
 */
export async function getProtocols() {
    if (!auth.currentUser) return [...DEFAULT_PROTOCOLS];

    try {
        const protocolsRef = collection(db, "users", auth.currentUser.uid, "protocols");
        const q = query(protocolsRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        const protocols = [...DEFAULT_PROTOCOLS];
        querySnapshot.forEach((doc) => {
            protocols.push({ id: doc.id, ...doc.data() });
        });
        return protocols;
    } catch (e) {
        console.error("Error fetching protocols: ", e);
        return [];
    }
}

/**
 * Updates an existing protocol by ID.
 * @param {string} protocolId - The ID of the protocol to update.
 * @param {string} name - New name for the protocol.
 * @param {string[]} testIds - New array of test IDs.
 */
export async function updateProtocol(protocolId, name, testIds) {
    if (!auth.currentUser) throw new Error("User not authenticated");

    try {
        const protocolRef = doc(db, "users", auth.currentUser.uid, "protocols", protocolId);
        await updateDoc(protocolRef, { name, testIds });
        console.log("Protocol updated:", protocolId);
    } catch (e) {
        console.error("Error updating protocol: ", e);
        throw e;
    }
}

/**
 * Deletes a protocol by ID.
 * @param {string} protocolId - The ID of the protocol to delete.
 */
export async function deleteProtocol(protocolId) {
    if (!auth.currentUser) throw new Error("User not authenticated");

    try {
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "protocols", protocolId));
        console.log("Protocol deleted");
    } catch (e) {
        console.error("Error deleting protocol: ", e);
        throw e;
    }
}
