import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore, collection, getDocs, doc, getDoc, collectionGroup, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Firebase Config (Copied from firebase-config.js or imported if module resolvable) ---
// Since this is in a subdirectory, imports from ../js might fail depending on server config.
// For safety, I'll assume standard raw config or try to import from the file if served correctly.
// Let's try relative import first.

import { db } from '../js/firebase-config.js';

import { auth } from '../js/firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- STATE ---
const state = {
    users: [],
    reports: [],
    protocols: [],
    loading: false,
    currentUser: null
};

// --- DOM ELEMENTS ---
const loadingIndicator = document.getElementById('loading-indicator');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    setupLogin();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Admin: User logged in:", user.email);
            if (window.applyCustomLogo) window.applyCustomLogo(user);
            if (user.email === 'manuel@alphatek.ai') {
                document.getElementById('admin-login-container').style.display = 'none';
                state.currentUser = user;
                await loadAllData();
                renderDashboard();
                renderUsers();
                renderReports();
                renderProtocols();
            } else {
                alert("Åtkomst nekad. Du har inte admin-behörighet.");
                auth.signOut();
            }
        } else {
            console.log("Admin: No user logged in. Showing login form.");
            document.getElementById('admin-login-container').style.display = 'flex';
        }
    });

});

function setupLogin() {
    const loginForm = document.getElementById('admin-login-form');
    // Ensure form exists (it might not if HTML not reloaded or cache)
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        const errorMsg = document.getElementById('login-error');

        try {
            errorMsg.textContent = 'Loggar in...';
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle the rest
            errorMsg.textContent = '';
        } catch (error) {
            console.error("Login failed:", error);
            errorMsg.textContent = "Fel e-post eller lösenord.";
        }
    });
}

function setupNavigation() {
    const buttons = document.querySelectorAll('.sidebar-nav .nav-button');
    const tabs = document.querySelectorAll('.tab-content');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.tab;

            // UI Toggle
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            tabs.forEach(t => {
                t.id === `tab-${targetId}` ? t.classList.add('active') : t.classList.remove('active');
            });

            // Re-render graphs if dashboard
            if (targetId === 'dashboard') {
                renderDashboard();
            }
        });
    });

    // Search
    const searchInput = document.getElementById('report-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderReports(e.target.value);
        });
    }
}

// --- DATA FETCHING ---
async function loadAllData() {
    setLoading(true);
    try {
        console.log("Fetching global data...");

        // 1. Fetch Users (From 'users' collection)
        // Note: 'users' collection permissions must allow list.
        const usersSnap = await getDocs(collection(db, 'users'));
        state.users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`Fetched ${state.users.length} users.`);

        // 2. Fetch Reports (using Collection Group 'screenings')
        // Must have index or small dataset. With 'screenings' collection group.
        const reportsSnap = await getDocs(collectionGroup(db, 'screenings'));
        state.reports = reportsSnap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() }));
        console.log(`Fetched ${state.reports.length} reports.`);

        // 3. Fetch Protocols (using Collection Group 'protocols')
        const protocolsSnap = await getDocs(collectionGroup(db, 'protocols'));
        // Protocols are usually under users/{uid}/protocols
        state.protocols = protocolsSnap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() }));
        console.log(`Fetched ${state.protocols.length} protocols.`);

    } catch (e) {
        console.error("Error loading admin data:", e);
        alert("Kunde inte ladda data. Kontrollera behörigheter (firestore.rules) eller konsolen.");
    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    loadingIndicator.style.display = isLoading ? 'block' : 'none';
}

// --- RENDERING ---

function renderDashboard() {
    // Stats
    document.getElementById('stat-total-users').textContent = state.users.length;
    document.getElementById('stat-total-reports').textContent = state.reports.length;
    document.getElementById('stat-total-protocols').textContent = state.protocols.length;

    // Charts
    renderReportsTimeline();
    renderTestTypesChart();
}


function renderUsers() {
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';

    // Since we can't get all Auth users client-side, we use the 'users' collection 
    // AND unique userIds found in reports to build a comprehensive list.
    const userMap = new Map();

    // 1. Add users from 'users' collection (if any exist)
    state.users.forEach(u => userMap.set(u.id, { ...u, source: 'firestore' }));

    // 2. Add users found in reports
    state.reports.forEach(r => {
        if (!userMap.has(r.userId) && r.userId) {
            userMap.set(r.userId, {
                id: r.userId,
                email: r.createdBy || 'Okänd (Endast ID)', // Fallback if no email saved
                source: 'report'
            });
        } else if (userMap.has(r.userId)) {
            // Try to enrich if we have a better name/email in report
            const existing = userMap.get(r.userId);
            if (!existing.email && r.createdBy) existing.email = r.createdBy;
        }
    });

    const allUsers = Array.from(userMap.values());

    allUsers.forEach(user => {
        // Enriched info (count reports for this user)
        const userReports = state.reports.filter(r => r.userId === user.id).length;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="user-badge">${user.id.substring(0, 6)}...</span></td>
            <td>${user.email || 'N/A'}</td> 
            <td>${user.email || 'Användare'}</td> 
            <td>${userReports} st</td>
            <td>-</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderReports(searchTerm = '') {
    const tbody = document.querySelector('#reports-table tbody');
    tbody.innerHTML = '';

    const term = searchTerm.toLowerCase();

    const filtered = state.reports.filter(r => {
        const text = `${r.patientName} ${r.userId} ${r.protocolName}`.toLowerCase();
        return text.includes(term);
    });

    // Sort by Date Descending
    filtered.sort((a, b) => new Date(b.testDate) - new Date(a.testDate));

    filtered.forEach(r => {
        // Extract Detailed Test Names
        let testNames = [];

        // 1. Check activeTestIds (e.g. ['balance', 'custom_123'])
        if (r.activeTestIds && Array.isArray(r.activeTestIds)) {
            r.activeTestIds.forEach(testId => {
                let name = getReadableTestName(testId, r);
                testNames.push(name);
            });
        }
        // 2. Fallback: Check page1/page2 keys if activeTestIds missing
        else {
            if (r.page1) Object.keys(r.page1).forEach(k => testNames.push(getReadableTestName(k, r)));
            if (r.page2 && r.page2.strengthTests) Object.keys(r.page2.strengthTests).forEach(k => testNames.push(getReadableTestName(k, r)));
            if (r.page2 && r.page2.custom) Object.keys(r.page2.custom).forEach(k => testNames.push(getReadableTestName('custom_' + k, r)));
        }

        // Deduplicate and join
        const uniqueTests = [...new Set(testNames)];
        const testListString = uniqueTests.join(', ');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.testDate || '-'}</td>
            <td><strong>${r.patientName || 'Okänd'}</strong></td>
            <td>${r.createdBy || r.userId || '-'}</td>
            <td>${r.protocolName || 'Standard'}</td>
            <td>${testListString || '-'}</td> 
        `;
        tbody.appendChild(tr);
    });
}

// Helper to get readable name
function getReadableTestName(testId, reportData) {
    // Standard Tests
    const standardMap = {
        'balance': 'Balans (Enhota)',
        'cmj': 'CMJ (Hopp)',
        'tia': 'TIA (Repeated Jump)',
        'sidehop': 'Sidhopp',
        'squat': 'Squat Analytics',
        'repeated_bilateral': 'Repeated Bilateral',
        'cmj2ben': 'CMJ 2 Ben',
        'hipthrust': 'Hip Thrust',
        'quads': 'Quadriceps Iso',
        'staticsquat-handdrag': 'Static Squat (Hand)',
        'staticsquat-hoftrem': 'Static Squat (Höft)',
        'hamstring': 'Hamstring Iso',
        'nordic-hamstring': 'Nordic Hamstring',
        'manual': 'Manuella Mätningar'
    };

    // Clean ID (remove suffix like _1)
    let baseId = testId.replace(/_\d+$/, '');

    if (standardMap[baseId]) return standardMap[baseId];

    // Custom Tests: Look up in report data
    if (testId.startsWith('custom_')) {
        const customId = testId.replace('custom_', '');
        // Check page2.custom
        if (reportData.page2 && reportData.page2.custom && reportData.page2.custom[customId]) {
            return reportData.page2.custom[customId].title || reportData.page2.custom[customId].name || 'Custom Test ' + customId;
        }
        return 'Custom Test';
    }

    return testId; // Fallback
}

function renderProtocols() {
    const tbody = document.querySelector('#protocols-table tbody');
    tbody.innerHTML = '';

    state.protocols.forEach(p => {
        // Parent ID (User ID) is in the path: users/{uid}/protocols/{pid}
        const pathParts = p.path.split('/');
        const userId = pathParts[1] || 'Okänd';

        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td><strong>${p.name}</strong></td>
        <td><span class="user-badge">${userId.substring(0, 6)}...</span></td>
        <td>${p.testIds ? p.testIds.length : 0} tester</td>
        <td>${p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : '-'}</td>
    `;
        tbody.appendChild(tr);
    });
}

// --- CHARTS (Plotly) ---

function renderReportsTimeline() {
    const counts = {};

    state.reports.forEach(r => {
        if (!r.testDate) return;
        const month = r.testDate.substring(0, 7); // YYYY-MM
        counts[month] = (counts[month] || 0) + 1;
    });

    const sortedMonths = Object.keys(counts).sort();
    const values = sortedMonths.map(m => counts[m]);

    const data = [{
        x: sortedMonths,
        y: values,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#3498db', width: 3 },
        marker: { size: 8 }
    }];

    const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#ffffff' },
        margin: { t: 20, l: 40, r: 20, b: 40 },
        height: 350
    };

    Plotly.newPlot('chart-reports-timeline', data, layout, { displayModeBar: false });
}

function renderTestTypesChart() {
    const counts = {};

    state.reports.forEach(r => {
        const ids = r.activeTestIds || [];
        ids.forEach(id => {
            // Clean ID (remove suffix etc)
            let baseId = id;
            if (id.startsWith('custom_')) baseId = 'Custom Test'; // Group customs or keep separate?
            else baseId = id.replace(/_\d+$/, ''); // Remove _1, _2

            // Map nice names
            if (baseId === 'cmj') baseId = 'CMJ';
            if (baseId === 'balance') baseId = 'Balans';

            counts[baseId] = (counts[baseId] || 0) + 1;
        });
    });

    const labels = Object.keys(counts);
    const values = Object.values(counts);

    const data = [{
        x: labels,
        y: values,
        type: 'bar',
        marker: { color: '#9b59b6' }
    }];

    const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#ffffff' },
        margin: { t: 20, l: 40, r: 20, b: 80 }, // more bottom margin for labels
        height: 350
    };

    Plotly.newPlot('chart-test-types', data, layout, { displayModeBar: false });
}
