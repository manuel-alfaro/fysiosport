import { db, auth } from './firebase-config.js';
import {
    doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc, updateDoc, orderBy, limit, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { testTemplates } from './templates.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { saveProtocol, getProtocols, deleteProtocol, createProtocol } from './protocols.js';
import { getCustomTests, generateTemplate } from './custom_tests.js';
import { graphTemplates } from './graph_templates.js';
import { testConfigs } from './test_config.js';
import { PROTOCOL_REGISTRY, getProtocol } from './protocols/index.js';

// --- CONSTANTS ---
const STATIC_TESTS = [
    // STYRKA (Strength)
    { id: 'hipthrust', name: 'Hip Thrusters', category: 'Styrka' },
    { id: 'quads', name: 'Quadriceps Isometrisk', category: 'Styrka' },
    { id: 'staticsquat-handdrag', name: 'Static Squat (Handdrag)', category: 'Styrka' },
    { id: 'staticsquat-hoftrem', name: 'Static Squat (Höftrem)', category: 'Styrka' },
    { id: 'hamstring', name: 'Hamstring Isometrisk', category: 'Styrka' },
    { id: 'nordic-hamstring', name: 'Nordic Hamstrings', category: 'Styrka' },

    // HOPP (Jumps)
    { id: 'cmj', name: 'Max Hopp CMJ (Enbens)', category: 'Hopp' },
    { id: 'cmj2ben', name: 'Max Hopp CMJ (Tvåbens)', category: 'Hopp' },
    { id: 'tia', name: 'Repeterade Hopp (TIA)', category: 'Hopp' },
    { id: 'sidehop', name: 'Sidhopp', category: 'Hopp' },
    { id: 'repeated_bilateral', name: 'Repeated Bilateral Jump', category: 'Hopp' },

    // BALANS & ANALYS (Balance/Analysis)
    { id: 'balance', name: 'Balans (Enbens)', category: 'Balans & Analys' },
    { id: 'squat', name: 'Squat Analytics', category: 'Balans & Analys' },

    // ÖVRIGT (Other)
    { id: 'manual', name: 'Manuella Mätningar', category: 'Övrigt' }
];

// --- STATE ---
window.STATIC_TESTS = STATIC_TESTS;
window.allTests = [...STATIC_TESTS];
let currentPatient = null;
let currentScreeningId = null;
let currentProtocolName = '';

// --- WIZARD STATE ---
let currentView = 'view-home'; // Initial view
let wizardActiveTests = [];
let currentTestIndex = 0;

window.setTextContent = function (id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
};

window.switchView = function (viewId) {
    console.log("switchView to:", viewId);
    
    // Auto-resolve active protocol config before rendering views if a session is active
    if (!window.activeProtocol && currentProtocolName) {
        let matchingKey = Object.keys(PROTOCOL_REGISTRY).find(k => 
            PROTOCOL_REGISTRY[k].name.toLowerCase() === currentProtocolName.toLowerCase()
        );
        if (matchingKey) window.activeProtocol = PROTOCOL_REGISTRY[matchingKey];
    }

    const targetView = document.getElementById(viewId);

    document.querySelectorAll('video').forEach(v => {
        if (targetView && targetView.contains(v)) return;
        if (typeof v.pause === 'function') v.pause();
    });

    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.remove('active-view');
        view.classList.add('hidden-view');
    });
    if (targetView) {
        targetView.classList.remove('hidden-view');
        targetView.classList.add('active-view');
        currentView = viewId;
    }

    // Hide legacy forms section unless we are actually in a test or selection mode
    const formsSection = document.getElementById('main-content-forms');
    if (formsSection) {
        if (viewId === 'view-protocol' || viewId === 'view-wizard' || viewId === 'view-session-intro') {
            formsSection.style.display = 'block';
        } else {
            formsSection.style.display = 'none';
        }
    }
    // Update sidebar active states
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
    let btnId = '';
    if (viewId === 'view-home') btnId = 'nav-home';
    else if (viewId === 'view-search' || viewId === 'view-overview') btnId = 'nav-clients';
    else if (viewId === 'view-protocol' || viewId === 'view-wizard' || viewId === 'view-session-intro') btnId = 'nav-sessions';
    else if (viewId === 'view-review') btnId = 'nav-activities';
    if (btnId) {
        const btn = document.getElementById(btnId);
        if (btn) btn.classList.add('active');
    }

    // Auto-load clients when entering search view
    if (viewId === 'view-search' && typeof searchPatients === 'function') {
        searchPatients('', 'search-results-list-inline');
    }
};

// Global Wizard State
let wizardSessionStartTime = 0;
let wizardTimerInterval = null;
let wizardAttemptsData = {}; // Format: { "custom_rtp_max_pull": [ { left: 10, right: 12, diff: "N/A" } ] }

window.fetchPreviousSessionData = async function() {
    window.previousSessionData = null;
    window.allHistoricalSessions = [];
    if (!currentPatient || !currentProtocolName) return;
    try {
        const q = query(
            collection(db, `users/${auth.currentUser.uid}/patients/${currentPatient.id}/screenings`),
            orderBy("createdAt", "desc"),
            limit(20)
        );
        const snap = await getDocs(q);
        let found = null;
        let allSessions = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.isWizardSession && (data.protocolName === currentProtocolName)) {
                allSessions.push(data);
                if (!found) found = data;
            }
        });
        window.allHistoricalSessions = allSessions;
        window.previousSessionData = found;
        console.log(`Cached previous session & ${allSessions.length} total historical states for delta UI.`);
    } catch(e) {
        console.warn("Delta memory fail", e);
    }
};

window.startWizard = async function () {
    await window.fetchPreviousSessionData();
    // Check for draft resumption
    const draftJson = localStorage.getItem('alphatek_reports_draft');
    if (draftJson && currentProtocolName) {
        try {
            const draft = JSON.parse(draftJson);
            if (draft.protocolName === currentProtocolName && draft.wizard && draft.wizard.activeTests && draft.wizard.activeTests.length > 0) {
                wizardActiveTests = draft.wizard.activeTests;
                currentTestIndex = draft.wizard.currentIndex || 0;
                wizardAttemptsData = draft.wizard.attempts || {};
                
                wizardSessionStartTime = Date.now(); 
                if (wizardTimerInterval) clearInterval(wizardTimerInterval);
                wizardTimerInterval = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - wizardSessionStartTime) / 1000);
                    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
                    const secs = String(elapsed % 60).padStart(2, '0');
                    const timeEl = document.getElementById('wizard-time-elapsed');
                    if (timeEl) timeEl.textContent = `${mins}:${secs}`;
                }, 1000);

                const wView = draft.wizard.view || 'view-wizard';
                if (wView === 'view-attempt-result' && wizardAttemptsData[wizardActiveTests[currentTestIndex]] && wizardAttemptsData[wizardActiveTests[currentTestIndex]].length > 0) {
                    const latest = wizardAttemptsData[wizardActiveTests[currentTestIndex]].slice(-1)[0];
                    const tId = wizardActiveTests[currentTestIndex];
                    window.showAttemptResult(latest.rawLeft || latest.left, latest.rawRight || latest.right, latest.asym || 100, tId);
                } else {
                    renderWizardTest();
                    switchView('view-wizard');
                }
                return; // Abort standard start, jump into restored timeline
            }
        } catch(e){}
    }

    if (!window.wizardPendingTests || window.wizardPendingTests.length === 0) {
        console.warn("No tests available in this session!");
        return;
    }

    wizardActiveTests = window.wizardPendingTests;
    currentTestIndex = 0;
    wizardSessionStartTime = Date.now();
    wizardAttemptsData = {};
    window.isViewingHistory = false;
    saveDraft();

    // Initialize empty array for each test
    wizardActiveTests.forEach(id => {
        wizardAttemptsData[id] = [];
    });

    // Start timer
    if (wizardTimerInterval) clearInterval(wizardTimerInterval);
    wizardTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - wizardSessionStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        const timeEl = document.getElementById('wizard-time-elapsed');
        if (timeEl) timeEl.textContent = `${mins}:${secs}`;
    }, 1000);

    window.showingSystemSetup = window.showInstructionsEnabled === true;
    renderWizardTest();
    switchView('view-wizard');
};

window.renderWizardTest = function () {
    const instructionDiv = document.getElementById('wizard-inline-instructions');
    const instructionWrapper = document.getElementById('wizard-inline-instructions-wrapper');
    const lrWrapper = document.getElementById('wizard-input-wrapper-lr');
    const singleWrapper = document.getElementById('wizard-input-wrapper-single');
    const masterWrapper = document.getElementById('wizard-input-master-wrapper');
    const wizardNav = document.getElementById('wizard-navigation-bar');
    const submitBtn = document.getElementById('btn-submit-attempt');
    
    if (window.showingSystemSetup) {
        setTextContent('wizard-test-title', 'System Setup');
        setTextContent('wizard-session-name', currentProtocolName || 'Session');
        setTextContent('wizard-progress-text', `0/${wizardActiveTests.length}`);
        
        const pFill = document.getElementById('wizard-progress-bar-fill');
        if (pFill) pFill.style.width = `0%`;

        if (wizardNav) wizardNav.style.display = 'none';
        if (masterWrapper) masterWrapper.style.display = 'none';
        if (lrWrapper) lrWrapper.style.display = 'none';
        if (singleWrapper) singleWrapper.style.display = 'none';
        
        if (submitBtn) {
            submitBtn.style.display = 'none';
        }

        if (instructionDiv && instructionWrapper) {
            instructionWrapper.style.display = 'flex';
            
            instructionDiv.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
                    <div onclick="const v = this.querySelector('video'); const i = this.querySelector('.vid-btn i'); const btn = this.querySelector('.vid-btn'); if(v.paused){ v.play(); i.className='fas fa-pause'; btn.style.opacity='0'; } else { v.pause(); i.className='fas fa-play'; btn.style.opacity='1'; }" style="position: relative; width: 100%; border-radius: 8px; overflow: hidden; cursor: pointer;" onmouseenter="if(!this.querySelector('video').paused) this.querySelector('.vid-btn').style.opacity='1';" onmouseleave="if(!this.querySelector('video').paused) this.querySelector('.vid-btn').style.opacity='0';">
                        <video src="https://storage.googleapis.com/intro_alphatek/RTP_Videos/system%20instillinger-1.mov" autoplay playsinline style="width: 100%; height: auto; border: none; display: block; background: transparent;"></video>
                        <div class="vid-btn" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 64px; height: 64px; background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.2); transition: opacity 0.2s; opacity: 0; pointer-events: none;">
                            <i class="fas fa-pause" style="color: #FFF; font-size: 24px; margin-left: 0;"></i>
                        </div>
                        <div class="fullscreen-btn" onclick="event.stopPropagation(); const v = this.parentElement.querySelector('video'); if (v.requestFullscreen) { v.requestFullscreen(); } else if (v.webkitEnterFullscreen) { v.webkitEnterFullscreen(); }" style="position: absolute; bottom: 16px; right: 16px; width: 44px; height: 44px; background: rgba(0,0,0,0.5); border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.2); transition: background 0.2s; z-index: 10;" onmouseover="this.style.background='rgba(0,0,0,0.8)';" onmouseout="this.style.background='rgba(0,0,0,0.5)';">
                            <i class="fas fa-expand" style="color: #FFF; font-size: 18px;"></i>
                        </div>
                    </div>
                    
                    <button type="button" onclick="window.nextWizardTest()" style="margin-top: 24px; width: 100%; padding: 16px; border-radius: 0; background: #85FFB6; border: none; color: #000; font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 17px; cursor: pointer; transition: transform 0.2s; display: flex; justify-content: center; align-items: center; gap: 16px;" onmouseover="this.style.transform='scale(1.02)';" onmouseout="this.style.transform='scale(1)';">
                        <span>Start Tests</span>
                        <i class="fas fa-arrow-right" style="color: #000; font-size: 16px;"></i>
                    </button>
                </div>
            `;
            const vWiz = instructionDiv.querySelector('video');
            if (vWiz) vWiz.play().catch(e=>{});
        }
        return;
    }

    if (instructionDiv && instructionWrapper) {
        // Restore formatting for normal runtime tests if visible natively (usually it's hidden during active generic tests)
        const h3Title = instructionWrapper.querySelector('h3');
        if (h3Title) h3Title.style.display = 'block';
        instructionDiv.style.padding = '24px 16px';
        instructionDiv.style.background = 'rgba(255, 255, 255, 0.15)';
        instructionWrapper.style.display = 'none'; // Ensure normal test conceals generic instructions until demanded
    }

    if (wizardNav) wizardNav.style.display = 'flex';
    if (masterWrapper) masterWrapper.style.display = 'flex';
    if (lrWrapper) lrWrapper.style.display = 'flex';
    if (singleWrapper) singleWrapper.style.display = 'none'; // Fallback handled elsewhere
    
    if (submitBtn) {
        submitBtn.style.display = 'block';
        submitBtn.textContent = 'Submit Attempt';
        submitBtn.onclick = function() { window.submitWizardAttempt(); };
    }

    const tId = wizardActiveTests[currentTestIndex];
    let testName = tId;

    // Attempt to map name (duplicating fallback logic)
    const nameMap = {
        'max_pull': 'Pull',
        'cmj_jump': 'Squat Jump',
        'cmj_force': 'Drop Jump',
        'balance': 'Balance',
        'endurance': 'Isometric Push',
        'custom_rtp_endurance': 'Endurance & Landing Control',
        'custom_rtp_maximum_capacity': 'Maximum Capacity',
        'custom_rtp_reactive_strength': 'Reactive Strength',
        'custom_rtp_agility': 'Agility',
        'custom_rtp_motor_control': 'Motor Control'
    };
    if (nameMap[tId]) {
        testName = nameMap[tId];
    } else {
        testName = testName.replace(/^custom_rtp_/, '').replace(/^custom_/, '');
        testName = testName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    setTextContent('wizard-test-title', testName);
    setTextContent('wizard-session-name', currentProtocolName || 'Session');
    setTextContent('wizard-progress-text', `${currentTestIndex + 1}/${wizardActiveTests.length}`);
    
    const pFill = document.getElementById('wizard-progress-bar-fill');
    if (pFill) pFill.style.width = `${((currentTestIndex + 1) / wizardActiveTests.length) * 100}%`;

    // Reset input fields
    const leftEl = document.getElementById('wizard-input-left');
    const rightEl = document.getElementById('wizard-input-right');
    const attempts = wizardAttemptsData[tId] || [];
    if (attempts.length > 0) {
        const latest = attempts[attempts.length - 1];
        if (leftEl) leftEl.value = latest.left > 0 ? latest.left : '';
        if (rightEl) rightEl.value = latest.right > 0 ? latest.right : '';
    } else {
        if (leftEl) leftEl.value = '';
        if (rightEl) rightEl.value = '';
    }

    const rInst = window.getTestInstructions ? window.getTestInstructions(testName, currentTestIndex) : {};
    const un = rInst.unit ? ` (${rInst.unit})` : '';
    const lLabel = document.getElementById('wizard-label-left');
    const rLabel = document.getElementById('wizard-label-right');
    if (lLabel) lLabel.textContent = `Left${un}`;
    if (rLabel) rLabel.textContent = `Right${un}`;

    if (instructionDiv && instructionWrapper) {
        if (window.showInstructionsEnabled) {
            instructionWrapper.style.display = 'flex';
            const instData = window.getTestInstructions ? window.getTestInstructions(testName) : { explanation: '', protocol: [], metrics: '' };
            let pHtml = '';
            (instData.protocol || []).forEach((step, idx) => {
                pHtml += `
                    <div style="display: flex; flex-direction: row; justify-content: flex-start; align-items: flex-start; gap: 12px; width: 100%;">
                        <div style="width: 20px; height: 20px; border: 1px solid #FFF; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #FFF; flex-shrink: 0; margin-top: 2px;">${idx + 1}</div>
                        <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">${step}</span>
                    </div>
                `;
            });
            const clinicalHtml = window.getClinicalCardHtml ? window.getClinicalCardHtml(currentTestIndex) : '';
            instructionDiv.innerHTML = `
                <div style="display: flex; flex-direction: column; width: 100%;">
                    <!-- Header Row: Test Name + Learn More -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; margin-bottom: 24px;">
                        <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 16px; color: #FFFFFF; margin: 0; padding: 0; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; max-width: 60%;">${instData.subtitle || testName}</h3>
                        
                        <div id="runtime-instruction-toggle-btn" 
                            onclick="const a=document.getElementById('runtime-instructions-pane'); const b=document.getElementById('runtime-clinical-pane'); const v=document.getElementById('runtime-video-wrapper'); if(a.style.display==='none'){a.style.display='flex'; b.style.display='none'; if(v){v.style.display='block';} this.innerHTML='<span style=\\'font-family:\\'Nimbus Sans\\',var(--font-main); font-size:12px; font-weight:400; text-transform:none; letter-spacing:1px; color:#85FFB6;\\'>Learn More</span>'; this.style.background='rgba(133,255,182,0.1)';}else{a.style.display='none'; b.style.display='flex'; if(v){v.style.display='none';} this.innerHTML='<span style=\\'font-family:\\'Nimbus Sans\\',var(--font-main); font-size:12px; font-weight:400; text-transform:none; letter-spacing:1px; color:#A1A1A3;\\'>Instructions</span>'; this.style.background='rgba(255,255,255,0.05)';}" 
                            style="display: flex; align-items: center; justify-content: center; width: fit-content; padding: 6px 10px; background: rgba(133,255,182,0.1); border-radius: 4px; cursor: pointer; transition: background 0.2s; margin-top: -2px; flex-shrink: 0;" 
                            onmouseover="this.style.background='rgba(133,255,182,0.2)';" 
                            onmouseout="if(document.getElementById('runtime-instructions-pane').style.display!=='none'){this.style.background='rgba(133,255,182,0.1)';}else{this.style.background='rgba(255,255,255,0.05)';}">
                            <span style="font-family: 'Nimbus Sans', var(--font-main); font-size: 12px; font-weight: 400; text-transform: none; letter-spacing: 1px; color: #85FFB6;">Learn More</span>
                        </div>
                    </div>

                    <!-- Inner Vertical Container -->
                    <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                        ${instData.videoWizard ? `
                        <div id="runtime-video-wrapper" style="width: 150px; height: 267px; max-width: 100%; overflow: hidden; position: relative; z-index: 1; border-radius: 8px; margin-bottom: 32px;">
                            <video src="${instData.videoWizard}" autoplay loop muted playsinline style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border: none; display: block; background: transparent; transform: scale(1.05) translateZ(0); transform-origin: center;"></video>
                        </div>` : ''}

                        <div id="runtime-instructions-pane" style="width: 100%; display: flex; flex-direction: column;">
                            <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Explanation</h3>
                            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8); margin-top: 4px;">${instData.explanation}</div>
                            
                            <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 24px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Protocol</h3>
                            <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 12px; width: 100%; margin-top: 12px;">
                                ${pHtml}
                            </div>

                            <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 24px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Metrics</h3>
                            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8); margin-top: 4px;">${instData.metrics}</div>
                        </div>

                        <div id="runtime-clinical-pane" style="width: 100%; display: none; flex-direction: column; padding-bottom: 24px;">
                            ${clinicalHtml}
                        </div>
                    </div>
                </div>
            `;
            const vWiz = instructionDiv.querySelector('video');
            if (vWiz) vWiz.play().catch(e=>{});
        } else {
            instructionWrapper.style.display = 'none';
        }
    }

    renderWizardTimeline();
};

window.submitWizardAttempt = function () {
    const leftEl = document.getElementById('wizard-input-left');
    const rightEl = document.getElementById('wizard-input-right');
    const leftVal = leftEl && leftEl.value !== '' ? parseFloat(leftEl.value) : NaN;
    const rightVal = rightEl && rightEl.value !== '' ? parseFloat(rightEl.value) : NaN;

    if (isNaN(leftVal) && isNaN(rightVal)) {
        return; // Do nothing if both are empty
    }

    const l = isNaN(leftVal) ? 0 : leftVal;
    const r = isNaN(rightVal) ? 0 : rightVal;
    const rawAvg = (isNaN(leftVal) || isNaN(rightVal)) ? (l + r) : ((l + r) / 2); // If only one filled, use it as score

    const tId = wizardActiveTests[currentTestIndex];
    
    // OVERWRITE fully so that old results are deleted
    wizardAttemptsData[tId] = [];
    const attempts = wizardAttemptsData[tId];

    let diffText = "N/A";
    let isPositive = true;

    // Calculate Asymmetry (LSI) before push
    let asym = 100;
    if (l > 0 && r > 0) {
        asym = Math.round((Math.min(l, r) / Math.max(l, r)) * 100);
    } else if ((l > 0 && r === 0) || (r > 0 && l === 0)) {
        asym = 0;
    }

    attempts.push({
        left: l,
        right: r,
        diff: diffText,
        isPositive: isPositive,
        rawAvg: rawAvg,
        asym: asym
    });

    // Clear inputs
    if (leftEl) leftEl.value = '';
    if (rightEl) rightEl.value = '';

    renderWizardTimeline();
    
    // Save draft after logging attempt
    saveDraft();
    
    // Trigger Overlay immediately
    window.showAttemptResult(l, r, asym, tId);
};

window.renderWizardTimeline = function () {
    const tId = wizardActiveTests[currentTestIndex];
    const attempts = wizardAttemptsData[tId] || [];
    const container = document.getElementById('wizard-attempt-timeline');
    if (!container) return;

    // Inject header if there are attempts
    let html = '';
    if (attempts.length > 0) {
        html += `
        <div style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; padding-bottom: 15px;">
            <span style="font-family: 'Nimbus Sans', var(--font-main); font-size: 15px; letter-spacing: 1px; color: #A1A1A3; flex: 1;">Attempt</span>
            <span style="font-family: 'Nimbus Sans', var(--font-main); font-size: 15px; letter-spacing: 1px; color: #A1A1A3; flex: 1;">Result</span>
            <span style="font-family: 'Nimbus Sans', var(--font-main); font-size: 15px; letter-spacing: 1px; color: #A1A1A3; flex: 2; text-align: right;">Improvement</span>
        </div>
        <div style="width: 100%; height: 1px; background: rgba(255,255,255,0.2);"></div>
        `;
    }

    attempts.forEach((att, idx) => {
        const attemptNum = String(idx + 1).padStart(2, '0');
        const passText = (idx === 0) ? "Passed" : att.rawAvg.toFixed(1);

        let diffColor = "#A1A1A3";
        if (att.diff !== "N/A") {
            diffColor = att.isPositive ? "#85FFB6" : "#FF3D3D";
        }

        const isLatest = (idx === attempts.length - 1);
        const textColor = isLatest ? "#FFFFFF" : "#A1A1A3";
        const valColor = isLatest ? (att.isPositive && idx !== 0 ? '#85FFB6' : '#FFFFFF') : "#FFFFFF"; // Highlight value if it's the newest

        html += `
        <div style="display: flex; flex-direction: column; width: 100%;">
            <div style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 0;">
                <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; letter-spacing: 1px; color: ${textColor}; flex: 1;">${attemptNum}</span>
                <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; letter-spacing: 1px; color: ${valColor}; flex: 1;">${passText}</span>
                <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; letter-spacing: 1px; color: ${diffColor}; flex: 2; text-align: right;">${att.diff}</span>
            </div>
            <div style="width: 100%; height: 1px; background: rgba(255,255,255,0.1);"></div>
        </div>
        `;
    });
    container.innerHTML = html;
};

window.resetWizardTest = function () {
    const tId = wizardActiveTests[currentTestIndex];
    wizardAttemptsData[tId] = [];
    renderWizardTimeline();
};

window.nextWizardTest = function () {
    if (window.showingSystemSetup) {
        window.showingSystemSetup = false;
        renderWizardTest();
        return;
    }
    
    window.submitWizardAttempt();
    
    const tId = wizardActiveTests[currentTestIndex];
    const attempts = wizardAttemptsData[tId] || [];
    if (attempts.length > 0) {
        const latest = attempts[attempts.length - 1];
        window.showAttemptResult(latest.rawLeft || latest.left, latest.rawRight || latest.right, latest.asym || 100, tId);
    } else {
        window.dismissAttemptResult();
    }
    
    saveDraft();
};

window.prevWizardTest = function () {
    if (window.showingSystemSetup) return; // already at beginning
    
    window.submitWizardAttempt();
    if (currentTestIndex > 0) {
        currentTestIndex--;
        renderWizardTest();
        saveDraft();
    } else if (currentTestIndex === 0 && window.showInstructionsEnabled) {
        window.showingSystemSetup = true;
        renderWizardTest();
    }
};

window.showAttemptResult = function (leftVal, rightVal, asym, tId) {
    const clinDrop = document.getElementById('result-clinical-dropdown');
    if (clinDrop) {
        clinDrop.style.display = 'none';
        if (window.getClinicalCardHtml) {
            clinDrop.innerHTML = window.getClinicalCardHtml(window.currentTestIndex);
        }
    }

    // Populate dynamic header info
    const testTitleEl = document.getElementById('wizard-test-title');
    setTextContent('result-test-title', testTitleEl ? testTitleEl.textContent : 'Test');
    setTextContent('result-head-session-name', currentProtocolName || 'Session');
    const progEl = document.getElementById('wizard-progress-text');
    setTextContent('result-progress-text', progEl ? progEl.textContent : `${currentTestIndex + 1}/${wizardActiveTests.length}`);
    
    const rpFill = document.getElementById('result-progress-bar-fill');
    if (rpFill) rpFill.style.width = `${((currentTestIndex + 1) / wizardActiveTests.length) * 100}%`;

    const timeEl = document.getElementById('wizard-time-elapsed');
    setTextContent('result-time-elapsed', timeEl ? timeEl.textContent : '00:00');

    let rm = tId;
    if (tId) rm = rm.replace(/^custom_rtp_/, '').replace(/^custom_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const ri = window.getTestInstructions ? window.getTestInstructions(rm, wizardActiveTests.indexOf(tId)) : {};
    const un = ri.unit ? ` ${ri.unit}` : '';

    setTextContent('result-left-val', leftVal.toFixed(1) + un);
    setTextContent('result-right-val', rightVal.toFixed(1) + un);
    
    const asymEl = document.getElementById('result-asymmetry-val');
    if (asymEl) asymEl.innerHTML = `${asym}%`;

    // Inject improvement delta for Asymmetry, Left, and Right
    let improvementHtml = '';
    let leftImpHtml = '';
    let rightImpHtml = '';

    if (tId && window.previousSessionData && window.previousSessionData.attempts) {
        const prevAttempts = window.previousSessionData.attempts[tId] || [];
        if (prevAttempts.length > 0) {
            const prev = prevAttempts[prevAttempts.length - 1];
            const prevAsym = prev.asym || 100;
            const diff = asym - prevAsym;
            
            if (diff !== 0) {
                const isPos = diff > 0;
                const col = isPos ? '#85FFB6' : '#FF3D3D';
                const ico = isPos ? 'fa-arrow-up' : 'fa-arrow-down';
                improvementHtml = `<div id="result-improvement-pill" style="display:inline-flex; align-items:center; gap:6px; font-family:'Nimbus Sans', var(--font-main); font-size:16px; color:${col}; background:rgba(${isPos?'133,255,182':'255,61,61'},0.08); padding:6px 14px; border-radius:14px; font-weight: 400; border: 1px solid rgba(${isPos?'133,255,182':'255,61,61'},0.1);"><i class="fas ${ico}"></i> ${Math.abs(diff)}% from last</div>`;
            } else {
                improvementHtml = `<div id="result-improvement-pill" style="display:inline-flex; align-items:center; gap:6px; font-family:'Nimbus Sans', var(--font-main); font-size:16px; color:#A1A1A3; background:rgba(255,255,255,0.05); padding:6px 14px; border-radius:14px; font-weight: 400; border: 1px solid rgba(255,255,255,0.1);">- 0% from last</div>`;
            }
            
            const prevL = prev.left || prev.rawLeft || 0;
            const prevR = prev.right || prev.rawRight || 0;
            const diffL = leftVal - prevL;
            const diffR = rightVal - prevR;
            
            const pctL = prevL > 0 ? (diffL / prevL) * 100 : 0;
            const pctR = prevR > 0 ? (diffR / prevR) * 100 : 0;
            
            if (diffL !== 0) {
                const isPos = diffL > 0;
                const col = isPos ? '#85FFB6' : '#FF3D3D';
                const ico = isPos ? 'fa-arrow-up' : 'fa-arrow-down';
                leftImpHtml = `<div style="margin-top: 8px; display:inline-flex; align-items:center; gap:6px; font-family:'Nimbus Sans', var(--font-main); font-size:15px; color:${col}; background:rgba(${isPos?'133,255,182':'255,61,61'},0.08); padding:4px 12px; border-radius:10px; font-weight: 400;"><i class="fas ${ico}"></i> ${Math.abs(pctL).toFixed(1)}%</div>`;
            }
            if (diffR !== 0) {
                const isPos = diffR > 0;
                const col = isPos ? '#85FFB6' : '#FF3D3D';
                const ico = isPos ? 'fa-arrow-up' : 'fa-arrow-down';
                rightImpHtml = `<div style="margin-top: 8px; display:inline-flex; align-items:center; gap:6px; font-family:'Nimbus Sans', var(--font-main); font-size:15px; color:${col}; background:rgba(${isPos?'133,255,182':'255,61,61'},0.08); padding:4px 12px; border-radius:10px; font-weight: 400;"><i class="fas ${ico}"></i> ${Math.abs(pctR).toFixed(1)}%</div>`;
            }
        }
    }
    
    // Inject Left Pill
    const leftValEl = document.getElementById('result-left-val');
    if (leftValEl) {
        const leftParent = leftValEl.parentNode;
        const oldLeftPill = document.getElementById('result-left-imp-pill');
        if (oldLeftPill) oldLeftPill.remove();
        if (leftImpHtml) {
            const temp = document.createElement('div');
            temp.id = 'result-left-imp-pill';
            temp.innerHTML = leftImpHtml;
            leftParent.appendChild(temp);
        }
    }

    // Inject Right Pill
    const rightValEl = document.getElementById('result-right-val');
    if (rightValEl) {
        const rightParent = rightValEl.parentNode;
        const oldRightPill = document.getElementById('result-right-imp-pill');
        if (oldRightPill) oldRightPill.remove();
        if (rightImpHtml) {
            const temp = document.createElement('div');
            temp.id = 'result-right-imp-pill';
            temp.innerHTML = rightImpHtml;
            rightParent.appendChild(temp);
        }
    }

    let container = document.getElementById('result-asymmetry-container');
    if (!container && asymEl) {
        const parent = asymEl.parentNode;
        container = document.createElement('div');
        container.id = 'result-asymmetry-container';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'flex-end';
        parent.replaceChild(container, asymEl);
        container.appendChild(asymEl);
    }
    
    const oldPill = document.getElementById('result-improvement-pill');
    if (oldPill) oldPill.remove();

    const topContainer = document.getElementById('result-improvement-pill-container');
    if (improvementHtml && topContainer) {
        topContainer.innerHTML = improvementHtml;
    }

    // Reset backgrounds
    const bgGreen = document.getElementById('result-bg-green');
    const bgYellow = document.getElementById('result-bg-yellow');
    const bgRed = document.getElementById('result-bg-red');
    if(bgGreen) bgGreen.style.opacity = '0';
    if(bgYellow) bgYellow.style.opacity = '0';
    if(bgRed) bgRed.style.opacity = '0';

    let heading = "";
    if (asym >= 90) {
        heading = "Great work!";
        if(bgGreen) bgGreen.style.opacity = '1';
    } else if (asym >= 70) {
        heading = "Well done!";
        if(bgYellow) bgYellow.style.opacity = '1';
    } else {
        heading = "Good effort!";
        if(bgRed) bgRed.style.opacity = '1';
    }

    setTextContent('result-heading', heading);
    
    // Update the button string text dynamically!
    const btnLabel = document.getElementById('result-next-test-label');
    if (btnLabel) {
        if (currentTestIndex < wizardActiveTests.length - 1) {
            btnLabel.textContent = "Next Test";
        } else {
            btnLabel.textContent = "Finish Tests";
        }
    }

    switchView('view-attempt-result');
};

window.dismissAttemptResult = function () {
    if (currentTestIndex < wizardActiveTests.length - 1) {
        currentTestIndex++;
        renderWizardTest();
        switchView('view-wizard');
        saveDraft();
    } else {
        if (wizardTimerInterval) clearInterval(wizardTimerInterval);
        saveDraft();
        switchView('view-session-done');
    }
};

window.resumeLastWizardTest = function () {
    renderWizardTest();
    switchView('view-wizard');
};

window.saveAndShowSummary = async function () {
    if (!currentPatient || !auth.currentUser) return;
    try {
        const screeningsRef = collection(db, `users/${auth.currentUser.uid}/patients/${currentPatient.id}/screenings`);
        
        let asymSum = 0;
        let count = 0;
        wizardActiveTests.forEach(tId => {
            const attempts = wizardAttemptsData[tId] || [];
            if(attempts.length > 0) {
                const best = [...attempts].sort((a,b) => b.rawAvg - a.rawAvg)[0];
                asymSum += best.asym || 100;
                count++;
            }
        });
        const totalAsym = count > 0 ? Math.round(asymSum / count) : 0;

        let sessionData = {
            patientId: currentPatient.id,
            patientName: `${currentPatient.firstName} ${currentPatient.lastName}`,
            protocolName: currentProtocolName || 'Return to Play',
            testDate: new Date().toISOString().split('T')[0],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isWizardSession: true,
            attempts: wizardAttemptsData,
            activeTests: wizardActiveTests,
            activeTestIds: wizardActiveTests,
            totalSymmetry: totalAsym
        };

        // Store a clean snapshot for the share code system (no serverTimestamp sentinels)
        window.currentSessionData = {
            patientId: currentPatient.id,
            patientName: `${currentPatient.firstName} ${currentPatient.lastName}`,
            protocolName: currentProtocolName || 'Return to Play',
            testDate: new Date().toISOString(),
            timestamp: new Date().toISOString(),
            isWizardSession: true,
            attempts: wizardAttemptsData,
            activeTests: wizardActiveTests,
            activeTestIds: wizardActiveTests,
            totalSymmetry: totalAsym
        };
        
        const docRef = await addDoc(screeningsRef, sessionData);
        window.currentSessionData.id = docRef.id; // Capture ID for precise deduplication
        console.log('[Session] Saved to DB with ID:', docRef.id, 'currentSessionData ready for sharing.');

        if (window.loadPatientHistory) {
            window.loadPatientHistory(currentPatient.id);
        }
    } catch (e) {
        console.error("Error saving session to DB:", e);
    }
    
    // Clear draft history to prepare for clean restart
    localStorage.removeItem('alphatek_reports_draft');
    
    window.showSessionResultSummary();
};

window.isHistoryToggled = false;
window.toggleHistoricalPlots = function() {
    window.isHistoryToggled = !window.isHistoryToggled;
    const btn = document.getElementById('history-toggle-btn');
    if (btn) {
        if (window.isHistoryToggled) {
            btn.style.background = 'rgba(255,255,255,0.05)';
            btn.style.border = '1px solid rgba(255,255,255,0.2)';
            btn.style.color = '#FFF';
            btn.style.transform = 'scale(1)';
            btn.innerHTML = 'Hide history';
        } else {
            btn.style.background = '#85FFB6';
            btn.style.border = 'none';
            btn.style.color = '#000';
            btn.innerHTML = 'Show all history';
        }
    }
    
    // Toggle dashboard header logic
    const hdrFromLast = document.getElementById('header-fromlast');
    const hdrSym = document.getElementById('header-sym');
    if (window.isHistoryToggled) {
        if (hdrFromLast) hdrFromLast.style.display = 'none';
        if (hdrSym) {
            hdrSym.style.textAlign = 'right';
            hdrSym.style.width = '100px'; 
        }
    } else {
        if (hdrFromLast) hdrFromLast.style.display = 'block';
        if (hdrSym) {
            hdrSym.style.textAlign = 'center';
            hdrSym.style.width = '80px';
        }
    }
    
    window.showSessionResultSummary();
};

window.getPlotNodes = function() {
    let nodes = [];
    if (window.allHistoricalSessions) {
        nodes = [...window.allHistoricalSessions].reverse();
    }
    
    if (!window.isViewingHistory && wizardActiveTests && wizardActiveTests.length > 0) {
        let asymSum = 0;
        let count = 0;
        wizardActiveTests.forEach(tId => {
            const att = wizardAttemptsData[tId] || [];
            if(att.length > 0) {
                const b = [...att].sort((a,b) => b.rawAvg - a.rawAvg)[0];
                asymSum += b.asym || 100;
                count++;
            }
        });
        const totalAsym = count > 0 ? Math.round(asymSum / count) : 0;
        nodes.push({
            isLive: true,
            totalSymmetry: totalAsym,
            attempts: JSON.parse(JSON.stringify(wizardAttemptsData)),
            dateDisplay: "I dag"
        });
    }
    return nodes;
};

window.generateGlobalBarPlotHTML = function() {
    const nodes = window.getPlotNodes();
    if (nodes.length <= 0) return '<span style="color:#A1A1A3; font-size:12px; margin-top: 20px;">Ikke nok testdata.</span>';
    
    let html = `<div style="display: flex; align-items: flex-end; justify-content: flex-start; gap: 24px; height: 160px; border-bottom: 2px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-top: 20px; padding-top: 10px;">`;
    
    nodes.forEach((n, idx) => {
        let sym = n.totalSymmetry;
        if (sym === undefined && n.attempts) {
            let lSum = 0, lCount = 0;
            const tKeys = n.activeTestIds || n.activeTests || Object.keys(n.attempts);
            tKeys.forEach(tKey => {
                const arr = n.attempts[tKey];
                if (arr && arr.length > 0) {
                    const b = [...arr].sort((a,x) => (x.rawAvg||0)-(a.rawAvg||0))[0];
                    lSum += b.asym !== undefined ? b.asym : 100;
                    lCount++;
                }
            });
            sym = lCount > 0 ? Math.round(lSum / lCount) : 100;
        } else if (sym === undefined) {
            sym = 100;
        }
        
        let deltaHtml = '';
        if (idx > 0) {
            let prevSym = nodes[idx-1].totalSymmetry;
            if (prevSym === undefined && nodes[idx-1].attempts) {
                let lSum = 0, lCount = 0;
                const tKeys = nodes[idx-1].activeTestIds || nodes[idx-1].activeTests || Object.keys(nodes[idx-1].attempts);
                tKeys.forEach(tKey => {
                    const arr = nodes[idx-1].attempts[tKey];
                    if (arr && arr.length > 0) {
                        const b = [...arr].sort((a,x) => (x.rawAvg||0)-(a.rawAvg||0))[0];
                        lSum += b.asym !== undefined ? b.asym : 100;
                        lCount++;
                    }
                });
                prevSym = lCount > 0 ? Math.round(lSum / lCount) : 100;
            } else if (prevSym === undefined) {
                prevSym = 100;
            }

            const d = sym - prevSym;
            if (d !== 0) {
                const isP = d > 0;
                const c = isP ? '#85FFB6' : '#FF3D3D';
                const i = isP ? 'fa-arrow-up' : 'fa-arrow-down';
                deltaHtml = `<div style="font-family:'Nimbus Sans', var(--font-main); font-size:12px; font-weight: 500; color:${c}; margin-bottom: 6px; white-space: nowrap;"><i class="fas ${i}"></i> ${Math.abs(d)}%</div>`;
            } else {
                deltaHtml = `<div style="font-family:'Nimbus Sans', var(--font-main); font-size:12px; font-weight: 500; color:#A1A1A3; margin-bottom: 6px; white-space: nowrap;">- 0%</div>`;
            }
        }
        
        const hPct = Math.max(10, sym);
        const col = sym >= 90 ? '#85FFB6' : (sym >= 70 ? '#F6B45E' : '#FF3D3D');
        
        html += `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; width: 60px; position: relative;">
                ${deltaHtml}
                <div style="width: 100%; height: ${hPct}%; background: ${col}; border-radius: 0; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 8px; box-shadow: 0 0 14px ${col}50; transition: height 0.5s ease-out;">
                    <span style="font-family: '188 Pixel', 'Courier New', monospace; font-size: 18px; color: ${sym >= 90 ? '#000' : '#FFF'};">${sym}%</span>
                </div>
                <span style="position: absolute; bottom: -24px; left: 50%; transform: translateX(-50%); font-family: 'Nimbus Sans', var(--font-main); font-size: 12px; color: rgba(255,255,255,0.4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px; text-align: center;">${n.isLive ? 'I dag' : (n.dateDisplay || '')}</span>
            </div>
        `;
    });
    html += `</div>`;
    return html;
};

window.generateTestBarPlotHTML = function(tId) {
    const nodes = window.getPlotNodes();
    if (nodes.length <= 0) return '';
    
    const extract = (n) => {
        const atts = n.attempts && n.attempts[tId] ? n.attempts[tId] : [];
        if (atts.length === 0) return null;
        const b = [...atts].sort((a,b) => b.rawAvg - a.rawAvg)[0];
        return { l: b.rawLeft||b.left||0, r: b.rawRight||b.right||0, s: b.asym||100 };
    };

    const buildSeries = (label, getter, isPct, maxVal) => {
        let block = `<div style="display: flex; flex-direction: column; align-items: flex-start; height: 120px; width: 100%;">`;
        block += `<span style="font-family: 'Nimbus Sans', var(--font-main); font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.6); text-transform: uppercase; margin-bottom: 10px;">${label}</span>`;
        block += `<div style="display: flex; align-items: flex-end; justify-content: flex-start; gap: 40px; height: 100%; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">`;
        
        let validNodeCount = 0;
        nodes.forEach((n, idx) => {
            const vObj = extract(n);
            if (!vObj) return;
            const val = getter(vObj);
            validNodeCount++;
            
            let deltaHtml = '';
            if (idx > 0) {
                let prevVal = null;
                for(let i = idx-1; i >= 0; i--) {
                    const pb = extract(nodes[i]);
                    if (pb) { prevVal = getter(pb); break; }
                }
                
                if (prevVal !== null) {
                    let d = 0;
                    if (isPct) {
                        d = val - prevVal;
                        if (d !== 0) {
                            const isP = d > 0;
                            const c = isP ? '#85FFB6' : '#FF3D3D';
                            const ico = isP ? 'up' : 'down';
                            deltaHtml = `<div style="font-size:11px; font-family: 'Nimbus Sans', var(--font-main); color:${c}; margin-bottom: 4px;"><i class="fas fa-arrow-${ico}"></i> ${Math.abs(d)}%</div>`;
                        } else {
                            deltaHtml = `<div style="font-size:11px; font-family: 'Nimbus Sans', var(--font-main); color:#A1A1A3; margin-bottom: 4px;">- 0%</div>`;
                        }
                    } else {
                        const pctD = prevVal > 0 ? ((val - prevVal) / prevVal) * 100 : 0;
                        if (pctD !== 0) {
                            const isP = pctD > 0;
                            const c = isP ? '#85FFB6' : '#FF3D3D';
                            const ico = isP ? 'up' : 'down';
                            deltaHtml = `<div style="font-size:11px; font-family: 'Nimbus Sans', var(--font-main); color:${c}; margin-bottom: 4px;"><i class="fas fa-arrow-${ico}"></i> ${Math.abs(pctD).toFixed(0)}%</div>`;
                        } else {
                            deltaHtml = `<div style="font-size:11px; font-family: 'Nimbus Sans', var(--font-main); color:#A1A1A3; margin-bottom: 4px;">- 0%</div>`;
                        }
                    }
                }
            }
            
            const hPct = Math.max(8, (val / maxVal) * 100);
            const col = isPct ? (val >= 90 ? '#85FFB6' : (val >= 70 ? '#F6B45E' : '#FF3D3D')) : 'rgba(255,255,255,0.2)';
            const txtCol = isPct && val >= 90 ? '#000' : '#FFF';
            const displayVal = isPct ? val+'%' : Math.round(val);
            
            block += `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; width: 76px;">
                    ${deltaHtml}
                    <div style="width: 100%; height: ${Math.min(100, hPct)}%; background: ${col}; border-radius: 0; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 6px; ${isPct ? `box-shadow: 0 0 10px ${col}40;` : ''}">
                        <span style="font-family: '188 Pixel', 'Courier New', monospace; font-size: 14px; color: ${txtCol};">${displayVal}</span>
                    </div>
                </div>
            `;
        });
        
        block += `</div></div>`;
        return validNodeCount > 1 ? block : '';
    };

    const buildDualSeries = (label, maxVal) => {
        let block = `<div style="display: flex; flex-direction: column; align-items: flex-start; height: 140px; width: 100%;">`;
        block += `<span style="font-family: 'Nimbus Sans', var(--font-main); font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.6); text-transform: uppercase; margin-bottom: 10px;">${label}</span>`;
        block += `<div style="display: flex; align-items: flex-end; justify-content: flex-start; gap: 40px; height: 100%; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">`;
        
        let validNodeCount = 0;
        nodes.forEach((n, idx) => {
            const vObj = extract(n);
            if (!vObj) return;
            validNodeCount++;
            
            const lVal = vObj.l;
            const rVal = vObj.r;
            
            let lDeltaHtml = '';
            let rDeltaHtml = '';
            
            if (idx > 0) {
                let prevObj = null;
                for(let i = idx-1; i >= 0; i--) {
                    const pb = extract(nodes[i]);
                    if (pb) { prevObj = pb; break; }
                }
                
                if (prevObj !== null) {
                    let pctDL = prevObj.l > 0 ? ((lVal - prevObj.l) / prevObj.l) * 100 : 0;
                    if (pctDL !== 0) {
                        const isP = pctDL > 0;
                        const c = isP ? '#85FFB6' : '#FF3D3D';
                        const ico = isP ? 'up' : 'down';
                        lDeltaHtml = `<div style="font-size:10px; font-family: 'Nimbus Sans', var(--font-main); color:${c}; margin-bottom: 4px;"><i class="fas fa-arrow-${ico}"></i> ${Math.abs(pctDL).toFixed(0)}%</div>`;
                    } else {
                        lDeltaHtml = `<div style="font-size:10px; font-family: 'Nimbus Sans', var(--font-main); color:#A1A1A3; margin-bottom: 4px;">- 0%</div>`;
                    }
                    
                    let pctDR = prevObj.r > 0 ? ((rVal - prevObj.r) / prevObj.r) * 100 : 0;
                    if (pctDR !== 0) {
                        const isP = pctDR > 0;
                        const c = isP ? '#85FFB6' : '#FF3D3D';
                        const ico = isP ? 'up' : 'down';
                        rDeltaHtml = `<div style="font-size:10px; font-family: 'Nimbus Sans', var(--font-main); color:${c}; margin-bottom: 4px;"><i class="fas fa-arrow-${ico}"></i> ${Math.abs(pctDR).toFixed(0)}%</div>`;
                    } else {
                        rDeltaHtml = `<div style="font-size:10px; font-family: 'Nimbus Sans', var(--font-main); color:#A1A1A3; margin-bottom: 4px;">- 0%</div>`;
                    }
                }
            }
            
            const hPctL = Math.max(8, (lVal / maxVal) * 100);
            const hPctR = Math.max(8, (rVal / maxVal) * 100);
            
            block += `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%;">
                    <div style="display: flex; align-items: flex-end; justify-content: center; gap: 4px; height: 100%;">
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; width: 36px;">
                            ${lDeltaHtml}
                            <div style="width: 100%; height: ${Math.min(100, hPctL)}%; background: rgba(255,255,255,0.4); border-radius: 0; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 6px;">
                                <span style="font-family: '188 Pixel', 'Courier New', monospace; font-size: 12px; color: #FFF;">${Math.round(lVal)}</span>
                            </div>
                            <span style="font-family: 'Nimbus Sans', var(--font-main); font-size: 9px; color: rgba(255,255,255,0.5); margin-top: 4px;">L</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; width: 36px;">
                            ${rDeltaHtml}
                            <div style="width: 100%; height: ${Math.min(100, hPctR)}%; background: rgba(255,255,255,0.2); border-radius: 0; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 6px;">
                                <span style="font-family: '188 Pixel', 'Courier New', monospace; font-size: 12px; color: #FFF;">${Math.round(rVal)}</span>
                            </div>
                            <span style="font-family: 'Nimbus Sans', var(--font-main); font-size: 9px; color: rgba(255,255,255,0.3); margin-top: 4px;">R</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        block += `</div></div>`;
        return validNodeCount > 1 ? block : '';
    };

    let maxAbs = 10;
    nodes.forEach(n => {
        const v = extract(n);
        if (v) {
            if (v.l > maxAbs) maxAbs = v.l;
            if (v.r > maxAbs) maxAbs = v.r;
        }
    });
    maxAbs = maxAbs * 1.2;

    const symHtml = buildSeries('Symmetry', v=>v.s, true, 100);
    const dualHtml = buildDualSeries('Left & Right Leg', maxAbs);
    
    if (!symHtml && !dualHtml) return '';
    
    return `
        <div style="display: flex; flex-direction: column; gap: 32px; padding-top: 24px; margin-top: 16px; border-top: 1px dashed rgba(255,255,255,0.05); width: 100%;">
            ${dualHtml}
            <div style="display: flex; justify-content: center; width: 100%;">
                ${symHtml}
            </div>
        </div>
    `;
};
window.generatePrintableHistoryTable = function() {
    const container = document.getElementById('print-history-container');
    if (!container) return;

    let nodes = window.getPlotNodes();
    if (!nodes || nodes.length === 0) {
        if (window.allHistoricalSessions && window.allHistoricalSessions.length > 0) {
            nodes = [...window.allHistoricalSessions];
            if (window.currentSessionData) nodes.push({ ...window.currentSessionData, isLive: true });
        } else if (window.currentSessionData) {
            nodes = [{ ...window.currentSessionData, isLive: true }];
        } else {
            container.innerHTML = `<div style="font-family:sans-serif;padding:40px;">Ingen data.</div>`;
            return;
        }
    }

    // Resolve a human-readable date from a session node
    function resolveDate(n) {
        if (n.isLive) return new Date().toLocaleDateString('no-NO');
        if (n.dateDisplay) return n.dateDisplay;
        // Try all common timestamp fields
        const raw = n.timestamp || n.sessionDate || n.date || n.createdAt || null;
        if (!raw) return null;
        try {
            // Firestore Timestamp object?
            if (raw.toDate) return raw.toDate().toLocaleDateString('no-NO');
            // Firestore Timestamp as seconds
            if (typeof raw === 'object' && raw.seconds) return new Date(raw.seconds * 1000).toLocaleDateString('no-NO');
            const d = new Date(raw);
            if (!isNaN(d)) return d.toLocaleDateString('no-NO');
        } catch(e) {}
        return null;
    }

    function getTestName(tId) {
        if (window.allTests) {
            const cleanId = tId.replace('custom_', '');
            const found = window.allTests.find(x => x.id === cleanId || x.id === tId);
            if (found) return found.name;
        }
        return tId.replace('custom_', '').replace(/_/g, ' ');
    }

    function getNodeSym(n) {
        if (n.totalSymmetry !== undefined) return n.totalSymmetry;
        if (!n.attempts) return null;
        const keys = n.activeTestIds || n.activeTests || Object.keys(n.attempts);
        let sum = 0, count = 0;
        keys.forEach(k => {
            const arr = n.attempts[k] || [];
            if (arr.length > 0) {
                const b = [...arr].sort((a,x) => (x.rawAvg||0)-(a.rawAvg||0))[0];
                sum += (b.asym ?? 100);
                count++;
            }
        });
        return count > 0 ? Math.round(sum / count) : null;
    }

    const ptName = (window.currentPatient && window.currentPatient.firstName)
        ? `${window.currentPatient.firstName} ${window.currentPatient.lastName || ''}`.trim()
        : 'Ukjent Pasient';
    const protoName = currentProtocolName || 'Return to Play';
    const printDate = new Date().toLocaleDateString('no-NO');

    // Oldest first → newest session is always at the bottom
    const printNodes = [...nodes];

    let printPagesHtml = '';
    const SCREENINGS_PER_PAGE = 3;

    for (let i = 0; i < printNodes.length; i += SCREENINGS_PER_PAGE) {
        const pageNodes = printNodes.slice(i, i + SCREENINGS_PER_PAGE);
        let sessionsHtml = '';

        pageNodes.forEach((n, relativeIdx) => {
            const idx = i + relativeIdx;
            const dateStr = resolveDate(n) || `Sesjon ${printNodes.length - idx}`;
            const totalSym = getNodeSym(n);
            const symColor = totalSym >= 90 ? '#1A7A4A' : (totalSym >= 70 ? '#946800' : '#C00');

            // Get previous node (one step older = previous index, since list is oldest-first)
            const prevNode = idx > 0 ? printNodes[idx - 1] : null;
            const prevTotalSym = prevNode ? getNodeSym(prevNode) : null;

            // Build total symmetry delta badge
            let totalDelta = '';
            if (prevTotalSym !== null && totalSym !== null) {
                const d = totalSym - prevTotalSym;
                if (d !== 0) {
                    const dc = d > 0 ? '#1A7A4A' : '#C00';
                    totalDelta = `<span style="font-size:13px; color:${dc}; margin-left:10px;">${d > 0 ? '↑' : '↓'} ${Math.abs(d)}%</span>`;
                }
            }

            const activeKeys = n.activeTestIds || n.activeTests || (n.attempts ? Object.keys(n.attempts) : []);
            let testRowsHtml = '';

            activeKeys.forEach(tId => {
                const atts = (n.attempts && n.attempts[tId]) ? n.attempts[tId] : [];
                if (atts.length === 0) return;
                const best = [...atts].sort((a, b) => (b.rawAvg || 0) - (a.rawAvg || 0))[0];
                const s = best.asym !== undefined ? best.asym : null;
                const l = best.rawLeft !== undefined ? Math.round(best.rawLeft) : (best.left !== undefined ? Math.round(best.left) : null);
                const r = best.rawRight !== undefined ? Math.round(best.rawRight) : (best.right !== undefined ? Math.round(best.right) : null);
                const sColor = s !== null ? (s >= 90 ? '#1A7A4A' : (s >= 70 ? '#946800' : '#C00')) : '#000';

                // Compute deltas vs previous session
                function delta(curr, prevN, getter, asPercentage = false) {
                    if (curr === null || !prevN) return '';
                    const pAtts = (prevN.attempts && prevN.attempts[tId]) ? prevN.attempts[tId] : [];
                    if (pAtts.length === 0) return '';
                    const pb = [...pAtts].sort((a, b) => (b.rawAvg || 0) - (a.rawAvg || 0))[0];
                    const prev = getter(pb);
                    if (prev === null || prev === 0) return '';
                    const rawDiff = curr - prev;
                    if (rawDiff === 0) return '';
                    
                    let displayVal;
                    if (asPercentage) {
                        displayVal = Math.round((rawDiff / Math.abs(prev)) * 100);
                    } else {
                        displayVal = rawDiff;
                    }
                    
                    const dc = rawDiff > 0 ? '#1A7A4A' : '#C00';
                    return `<span style="font-size:10px; color:${dc}; margin-left:4px;">${rawDiff > 0 ? '↑' : '↓'}${Math.abs(displayVal)}${asPercentage ? '%' : ''}</span>`;
                }

                const lD = delta(l, prevNode, pb => pb.rawLeft !== undefined ? Math.round(pb.rawLeft) : (pb.left !== undefined ? Math.round(pb.left) : null), true);
                const rD = delta(r, prevNode, pb => pb.rawRight !== undefined ? Math.round(pb.rawRight) : (pb.right !== undefined ? Math.round(pb.right) : null), true);
                const sD = delta(s, prevNode, pb => pb.asym !== undefined ? pb.asym : null, false);

                testRowsHtml += `
                    <tr>
                        <td style="padding:8px 10px; border-bottom:1px solid #E8E8E8;">${getTestName(tId)}</td>
                        <td style="padding:8px 10px; border-bottom:1px solid #E8E8E8; text-align:center;">${l !== null ? l : '—'}${lD}</td>
                        <td style="padding:8px 10px; border-bottom:1px solid #E8E8E8; text-align:center;">${r !== null ? r : '—'}${rD}</td>
                        <td style="padding:8px 10px; border-bottom:1px solid #E8E8E8; text-align:center; font-weight:600; color:${sColor};">${s !== null ? s + '%' : '—'}${sD}</td>
                    </tr>
                `;
            });

            sessionsHtml += `
                <div style="margin-bottom:32px; page-break-inside: avoid;">
                    <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid #111; padding-bottom:8px; margin-bottom:12px;">
                        <span style="font-size:16px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">${dateStr}</span>
                        ${totalSym !== null ? `<span style="font-size:22px; font-weight:700; color:${symColor};">Total: ${totalSym}%${totalDelta}</span>` : ''}
                    </div>
                    ${testRowsHtml ? `
                    <table style="width:100%; border-collapse:collapse; font-size:13px;">
                        <thead>
                            <tr style="background:#F0F0F0;">
                                <th style="padding:8px 10px; text-align:left; font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; width:40%;">Test</th>
                                <th style="padding:8px 10px; text-align:center; font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; width:20%;">Venstre</th>
                                <th style="padding:8px 10px; text-align:center; font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; width:20%;">Høyre</th>
                                <th style="padding:8px 10px; text-align:center; font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; width:20%;">Symmetri</th>
                            </tr>
                        </thead>
                        <tbody>${testRowsHtml}</tbody>
                    </table>` : '<p style="color:#999; font-size:13px;">Ingen testdata</p>'}
                </div>
            `;
        });

        const isLastPage = (i + SCREENINGS_PER_PAGE) >= printNodes.length;
        const pageBreakCSS = isLastPage ? '' : 'page-break-after: always; break-after: page;';

        printPagesHtml += `
            <div style="font-family:'Nimbus Sans', Helvetica, Arial, sans-serif; color:#000; padding:40px; background:#FFF; box-sizing:border-box; line-height:1.5; ${pageBreakCSS}">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #000; padding-bottom:14px; margin-bottom:28px;">
                    <div>
                        <h1 style="margin:0; font-size:28px; font-weight:300; text-transform:uppercase; letter-spacing:-1px;">Alphatek Protokoll</h1>
                        <div style="font-size:12px; text-transform:uppercase; letter-spacing:1.5px; color:#666; margin-top:4px;">${protoName}</div>
                    </div>
                    <div style="text-align:right; font-size:12px; color:#444; line-height:1.8;">
                        <strong>${ptName}</strong><br>${printDate}
                    </div>
                </div>
                ${sessionsHtml}
                <div style="margin-top:40px; padding-top:16px; border-top:1px solid #DDD; font-size:10px; color:#999; text-align:center; text-transform:uppercase; letter-spacing:1px;">
                    Generert av Alphatek Protocols &nbsp;•&nbsp; ${printDate} &nbsp;•&nbsp; Side ${Math.floor(i/3)+1} av ${Math.ceil(printNodes.length/3)}
                </div>
            </div>
        `;
    }

    container.innerHTML = printPagesHtml;
};

window.showSessionResultSummary = function () {
    const clinDrop = document.getElementById('result-clinical-dropdown');
    if (clinDrop) clinDrop.style.display = 'none';
    const sumCont = document.getElementById('clinical-session-summary-container');
    if (sumCont) sumCont.style.display = 'none';

    setTextContent('session-summary-protocol-name', currentProtocolName || 'Return to Play');
    
    const timeEl = document.getElementById('wizard-time-elapsed');
    setTextContent('session-time-elapsed', timeEl ? timeEl.textContent : '00:00');

    // Calculate overall symmetry
    let asymSum = 0;
    let testsCounted = 0;
    let testsListHtml = '';
    window.sessionClinicalScores = [];

    wizardActiveTests.forEach(tId => {
        const attempts = wizardAttemptsData[tId] || [];
        if(attempts.length > 0) {
            const best = [...attempts].sort((a,b) => b.rawAvg - a.rawAvg)[0];
            asymSum += best.asym || 100;
            testsCounted++;
            
            // Build test list element for summary
            let testName = tId.replace(/^custom_rtp_/, '').replace(/^custom_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            window.sessionClinicalScores.push({ testId: tId, score: best.asym || 100, testName: testName });
            
            let colorBg = '';
            if (best.asym >= 90) colorBg = 'rgba(133, 255, 182, 0.4)';
            else if (best.asym >= 75) colorBg = 'rgba(255, 215, 0, 0.4)';
            else if (best.asym >= 65) colorBg = 'rgba(246, 180, 94, 0.4)';
            else colorBg = 'rgba(255, 61, 61, 0.4)';

            // Improve Delta
            let rowImp = '';
            let expandedPlotHtml = '';
            
            if (window.isHistoryToggled) {
                expandedPlotHtml = window.generateTestBarPlotHTML(tId);
            } else {
                if (window.previousSessionData && window.previousSessionData.attempts) {
                    const pAtt = window.previousSessionData.attempts[tId] || [];
                    if (pAtt.length > 0) {
                        const pBest = [...pAtt].sort((a,b) => (b.rawAvg||0) - (a.rawAvg||0))[0];
                        const pAsym = pBest.asym !== undefined ? pBest.asym : 100;
                        const d = best.asym - pAsym;
                        if (d !== 0) {
                            const isP = d > 0;
                            const c = isP ? '#85FFB6' : '#FF3D3D';
                            const ii = isP ? 'fa-arrow-up' : 'fa-arrow-down';
                            rowImp = `<div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; font-family:'Nimbus Sans', var(--font-main); font-size:16px; color:${c}; width: 100px; text-align: right;"><i class="fas ${ii}"></i> ${Math.abs(d)}%</div>`;
                        } else {
                            rowImp = `<div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; font-family:'Nimbus Sans', var(--font-main); font-size:16px; color:#A1A1A3; width: 100px; text-align: right;">- 0%</div>`;
                        }
                    } else {
                        rowImp = `<div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; font-family:'Nimbus Sans', var(--font-main); font-size:16px; color:#A1A1A3; opacity: 0.3; width: 100px; text-align: right;">N/A</div>`;
                    }
                } else {
                    rowImp = `<div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; font-family:'Nimbus Sans', var(--font-main); font-size:16px; color:#A1A1A3; opacity: 0.3; width: 100px; text-align: right;">N/A</div>`;
                }
            }

            const blobSize = window.isHistoryToggled ? '300px' : '150px';
            const blobTop = window.isHistoryToggled ? '-50px' : '50%';
            const blobTrans = window.isHistoryToggled ? 'none' : 'translateY(-50%)';

            testsListHtml += `
                <div style="background: rgba(255,255,255,0.02); border-radius: 0; padding: 24px; position: relative; overflow: hidden; display: flex; flex-direction: column;">
                    <div id="clinical-blob-${tId}" style="position: absolute; width: ${blobSize}; height: ${blobSize}; left: -50px; top: ${blobTop}; transform: ${blobTrans}; background: radial-gradient(circle, ${colorBg} 0%, rgba(0,0,0,0) 70%); filter: blur(20px); pointer-events: none; z-index: 1; transition: all 0.5s ease;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <div style="display: flex; flex-direction: column; justify-content: center; width: 40%; position: relative; z-index: 2;">
                            <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFF;">${testName}</span>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: flex-end; position: relative; z-index: 2; width: 60%;">
                            <span id="clinical-sym-${tId}" style="font-family: '188 Pixel', 'Courier New', monospace; font-size: 24px; color: #FFF; width: 100%; text-align: right; transition: all 0.3s ease;">${best.asym}%</span>
                        </div>
                    </div>
                    ${expandedPlotHtml}
                    <div id="clinical-exp-${tId}" style="display: none; flex-direction: column; width: 100%; border-top: 1px dashed rgba(255,255,255,0.1); margin-top: 16px; padding-top: 16px;"></div>
                </div>
            `;
        }
    });

    const totalAsym = testsCounted > 0 ? Math.round(asymSum / testsCounted) : 0;
    window.sessionClinicalAvgScore = totalAsym;
    setTextContent('session-summary-total-asym', String(totalAsym));
    
    let totalImp = '';
    if (window.isHistoryToggled) {
        totalImp = window.generateGlobalBarPlotHTML();
    } else {
        if (window.previousSessionData) {
            let prevTotalSym = window.previousSessionData.totalSymmetry;
            
            if (prevTotalSym === undefined && window.previousSessionData.attempts) {
                let legacySum = 0;
                let legacyCount = 0;
                const tKeys = window.previousSessionData.activeTestIds || window.previousSessionData.activeTests || Object.keys(window.previousSessionData.attempts);
                tKeys.forEach(tKey => {
                    const arr = window.previousSessionData.attempts[tKey];
                    if (arr && arr.length > 0) {
                        const aBest = [...arr].sort((a,b) => (b.rawAvg||0) - (a.rawAvg||0))[0];
                        legacySum += aBest.asym !== undefined ? aBest.asym : 100;
                        legacyCount++;
                    }
                });
                if (legacyCount > 0) prevTotalSym = Math.round(legacySum / legacyCount);
            }

            if (prevTotalSym !== undefined) {
                const diff = totalAsym - prevTotalSym;
                if (diff !== 0) {
                    const isPos = diff > 0;
                    const col = isPos ? '#85FFB6' : '#FF3D3D';
                    const ico = isPos ? 'fa-arrow-up' : 'fa-arrow-down';
                    totalImp = `<div style="display:inline-flex; align-items:center; justify-content:center; gap:6px; font-family:'Nimbus Sans', var(--font-main); font-size:14px; color:${col}; background:rgba(${isPos?'133,255,182':'255,61,61'},0.1); padding:8px 16px; border-radius:16px; margin-top: 40px; font-weight: 400; position: relative; z-index: 2;"><i class="fas ${ico}"></i> ${Math.abs(diff)}% vs last session</div>`;
                } else {
                    totalImp = `<div style="display:inline-flex; align-items:center; justify-content:center; gap:6px; font-family:'Nimbus Sans', var(--font-main); font-size:14px; color:#A1A1A3; background:rgba(255,255,255,0.05); padding:8px 16px; border-radius:16px; margin-top: 40px; font-weight: 400; position: relative; z-index: 2;">- 0% vs last session</div>`;
                }
            }
        }
    }

    const totalSymEl = document.getElementById('session-summary-total-asym');
    if (totalSymEl) {
        const parentContainer = totalSymEl.closest('div').parentNode;
        const oldImp = document.getElementById('summary-total-improvement-pill');
        if (oldImp) oldImp.remove();
        if (totalImp) {
            const p = document.createElement('div');
            p.id = 'summary-total-improvement-pill';
            p.style.display = 'flex';
            p.style.justifyContent = 'center';
            p.style.width = '100%';
            p.innerHTML = totalImp;
            parentContainer.appendChild(p);
        }
    }
    
    // Reset backgrounds
    const bgGreen = document.getElementById('session-bg-green');
    const bgYellow = document.getElementById('session-bg-yellow');
    const bgRed = document.getElementById('session-bg-red');
    if(bgGreen) bgGreen.style.opacity = '0';
    if(bgYellow) bgYellow.style.opacity = '0';
    if(bgRed) bgRed.style.opacity = '0';
    
    // Inject blob colors and page background
    const totalBlob = document.getElementById('session-summary-total-blob');
    if (totalBlob) {
        let totalColor = '';
        if (totalAsym >= 90) {
            totalColor = 'rgba(133, 255, 182, 0.4)';
        }
        else if (totalAsym >= 75) {
            totalColor = 'rgba(255, 215, 0, 0.4)';
        }
        else if (totalAsym >= 65) {
            totalColor = 'rgba(246, 180, 94, 0.4)';
        }
        else {
            totalColor = 'rgba(255, 61, 61, 0.4)';
        }
        totalBlob.style.background = `radial-gradient(circle, ${totalColor} 0%, rgba(0,0,0,0) 70%)`;
    }
    
    const listContainer = document.getElementById('session-summary-test-list');
    if (listContainer) listContainer.innerHTML = testsListHtml;

    if (typeof window.generatePrintableHistoryTable === 'function') {
        window.generatePrintableHistoryTable();
    }

    switchView('view-session-result');
};

window.toggleResultExplanations = function() {
    if (window.isHistoryToggled) {
        window.toggleHistoricalPlots();
    }

    const sumCont = document.getElementById('clinical-session-summary-container');
    if(!sumCont) return;

    if(sumCont.style.display === 'none') {
        const scores = window.sessionClinicalScores || [];
        scores.forEach(s => {
            const expCont = document.getElementById(`clinical-exp-${s.testId}`);
            const blob = document.getElementById(`clinical-blob-${s.testId}`);
            const sym = document.getElementById(`clinical-sym-${s.testId}`);
            
            if(expCont && window.clinicalGenerator) {
                expCont.innerHTML = window.clinicalGenerator.getClinicalTestExplanation(s.testId, s.score, s.testName);
                expCont.style.display = 'flex';
                
                if (blob) {
                    blob.style.width = '450px';
                    blob.style.height = '450px';
                    blob.style.top = '-100px';
                    blob.style.left = '-100px';
                    blob.style.transform = 'none';
                }
                if (sym) {
                    sym.style.fontSize = '42px';
                }
            }
        });
        if(window.clinicalGenerator) {
            sumCont.innerHTML = window.clinicalGenerator.getSessionClinicalSummary(scores, window.sessionClinicalAvgScore || 0);
            sumCont.style.display = 'block';
        }
    } else {
        const scores = window.sessionClinicalScores || [];
        scores.forEach(s => {
            const expCont = document.getElementById(`clinical-exp-${s.testId}`);
            const blob = document.getElementById(`clinical-blob-${s.testId}`);
            const sym = document.getElementById(`clinical-sym-${s.testId}`);
            
            if(expCont) expCont.style.display = 'none';
            if (blob) {
                blob.style.width = window.isHistoryToggled ? '300px' : '150px';
                blob.style.height = window.isHistoryToggled ? '300px' : '150px';
                blob.style.top = window.isHistoryToggled ? '-50px' : '50%';
                blob.style.left = '-50px';
                blob.style.transform = window.isHistoryToggled ? 'none' : 'translateY(-50%)';
            }
            if (sym) {
                sym.style.fontSize = '24px';
            }
        });
        sumCont.style.display = 'none';
    }
};

window.finishSessionAndSave = async function() {
    localStorage.removeItem('alphatek_reports_draft');

    // Generate code instantly (client-side, no async needed for the UI)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const shareLink = `https://alphatek-myresults.web.app/?code=${code}`;

    // Show the Share Results page immediately — never skip it
    const codeEl = document.getElementById('share-code-display');
    if (codeEl) codeEl.textContent = code;
    const linkEl = document.getElementById('share-link-display');
    if (linkEl) { linkEl.textContent = shareLink; linkEl.href = shareLink; }
    
    // Generate QR Code
    const qrContainer = document.getElementById('share-qrcode');
    if (qrContainer) {
        qrContainer.innerHTML = ''; // Clear any previous QR
        new QRCode(qrContainer, {
            text: shareLink,
            width: 180,
            height: 180,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.M
        });
    }

    window.currentShareCode = code;
    window.currentShareLink = shareLink;
    switchView('view-share-results');

    // Reset status indicator
    const statusEl = document.getElementById('share-save-status');

    // Write to Firestore in the background (non-blocking)
    try {
        if (auth.currentUser && currentPatient && window.currentSessionData) {
            const patientEmail = (currentPatient.email || currentPatient.emailAddress || '').toLowerCase().trim() || null;
            const protocolName = currentProtocolName || 'Return to Play';

            // Fetch all historical sessions for this protocol so patient gets full graphs
            let historicalSessions = [];
            try {
                const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const screeningsRef = collection(db, `users/${auth.currentUser.uid}/patients/${currentPatient.id}/screenings`);
                const snap = await getDocs(screeningsRef);
                snap.forEach(d => {
                    const sd = d.data();
                    if ((sd.protocolName || 'Return to Play') === protocolName) {
                        historicalSessions.push({ ...sd, id: d.id });
                    }
                });
            } catch (err) {
                console.warn('[Share] Failed to fetch historical sessions:', err);
            }

            // Sanitize: strip undefined/non-serializable values Firestore rejects
            const cleanSnapshot = JSON.parse(JSON.stringify(window.currentSessionData));
            const cleanHistory = JSON.parse(JSON.stringify(historicalSessions));

            await setDoc(doc(db, 'session_codes', code), {
                therapistUid: auth.currentUser.uid,
                patientId: currentPatient.id,
                patientName: `${currentPatient.firstName || ''} ${currentPatient.lastName || ''}`.trim(),
                patientEmail: patientEmail,
                protocolName: protocolName,
                sessionSnapshot: cleanSnapshot,
                historicalSessions: cleanHistory,
                createdAt: serverTimestamp()
            });
            console.log('[Share] Code saved to Firestore (with history):', code);
            if (statusEl) {
                statusEl.textContent = '✓ Code saved — patient can now access results';
                statusEl.style.color = '#85FFB6';
            }
        } else {
            console.warn('[Share] Missing auth/patient/session:', {
                hasUser: !!auth.currentUser,
                hasPatient: !!currentPatient,
                hasSession: !!window.currentSessionData
            });
            if (statusEl) {
                statusEl.textContent = '⚠ Code not saved to database. Patient cannot access yet.';
                statusEl.style.color = '#F6B45E';
            }
        }
    } catch(err) {
        console.error('[Share] Firestore write failed:', err);
        if (statusEl) {
            statusEl.textContent = `⚠ Save failed: ${err.code || err.message}`;
            statusEl.style.color = '#FF5C5C';
        }
    }
};


window.copyShareLink = function() {
    const link = window.currentShareLink || '';
    navigator.clipboard.writeText(link).then(() => {
        const btn = document.getElementById('share-copy-btn');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy Link', 2000); }
    }).catch(() => {
        prompt('Copy this link:', link);
    });
};

window.copyShareCode = function() {
    const code = window.currentShareCode || '';
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('share-copy-code-btn');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy Code', 2000); }
    }).catch(() => {
        prompt('Copy this code:', code);
    });
};


window.renderReviewSummary = function () {
    const data = collectDataFromForm();
    const summaryContainer = document.getElementById('review-data-table');
    const protocolNameEl = document.getElementById('review-protocol-name');

    if (protocolNameEl) protocolNameEl.textContent = `Protokoll: ${data.patientInfo.reportName || 'Alphatek Report'}`;

    if (!summaryContainer || !data || !data.tests) return;

    let html = '<table style="width:100%; text-align:left; border-collapse:collapse; font-size:1.1rem;">';
    html += '<tr style="border-bottom:2px solid #ddd; color: var(--app-primary-color);"><th style="padding:10px;">Test</th><th style="padding:10px;">Verdi</th></tr>';

    data.tests.forEach(test => {
        html += `<tr style="border-bottom:1px solid #eee;">
                    <td style="padding:15px 10px;"><strong>${test.Test}</strong></td>
                    <td style="padding:15px 10px; font-weight:bold;">${test.Verdi || '-'}</td>
                 </tr>`;
    });
    html += '</table>';
    summaryContainer.innerHTML = html;
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-wizard-next')?.addEventListener('click', window.nextTest);
    document.getElementById('btn-wizard-prev')?.addEventListener('click', window.prevTest);
    document.getElementById('btn-goto-protocol')?.addEventListener('click', () => {
        window.switchView('view-protocol');
    });
});
console.log("Index.js: Global allTests initialized", window.allTests);


// --- CHART CREATION FUNCTIONS REMOVED (Now using graph_templates.js) ---

// saveData removed - replaced by async version below in Core Logic

// collectDataFromForm removed (duplicate)

// populateFormFromData removed (duplicate)

// updateManualPreview removed (duplicate)

function updateAsymmetryDisplay(valV, valH, referenceSide, displayId, isLowerBetter = false) {
    const displayEl = document.getElementById(displayId);
    if (!displayEl) return;

    if (valV === 0 || valH === 0 || referenceSide === 'Ingen') {
        displayEl.innerHTML = 'Asymmetri: N/A';
        displayEl.dataset.asymmetryValue = 0;
        return;
    }

    let referenceVal = (referenceSide === 'Vänster') ? valV : valH;
    let otherVal = (referenceSide === 'Vänster') ? valH : valV;

    let asymmetryPercent = ((otherVal - referenceVal) / referenceVal) * 100;
    if (isLowerBetter) {
        asymmetryPercent *= -1;
    }

    const color = asymmetryPercent < -10 ? '#d9534f' : '#5cb85c';
    const asymmetryHTML = `Asymmetri: <span style="color: ${color}; font-weight: bold;">${asymmetryPercent.toFixed(1)}%</span>`;

    displayEl.innerHTML = asymmetryHTML;
    displayEl.dataset.asymmetryValue = asymmetryPercent.toFixed(1);
}

function updateCombinedAsymmetryDisplay(v1, h1, isLowerBetter1, v2, h2, isLowerBetter2, referenceSide, displayId) {
    const displayEl = document.getElementById(displayId);
    if (!displayEl) return;

    const asymmetries = [];

    if (v1 > 0 && h1 > 0 && referenceSide !== 'Ingen') {
        let ref = (referenceSide === 'Vänster') ? v1 : h1;
        let other = (referenceSide === 'Vänster') ? h1 : v1;
        let percent = ((other - ref) / ref) * 100;
        if (isLowerBetter1) percent *= -1;
        asymmetries.push(percent);
    }

    if (v2 > 0 && h2 > 0 && referenceSide !== 'Ingen') {
        let ref = (referenceSide === 'Vänster') ? v2 : h2;
        let other = (referenceSide === 'Vänster') ? h2 : v2;
        let percent = ((other - ref) / ref) * 100;
        if (isLowerBetter2) percent *= -1;
        asymmetries.push(percent);
    }

    if (asymmetries.length === 0) {
        displayEl.innerHTML = 'Asymmetri: N/A';
        displayEl.dataset.asymmetryValue = 0;
        return;
    }

    const avgPercent = asymmetries.reduce((a, b) => a + b, 0) / asymmetries.length;
    const color = avgPercent < -10 ? '#d9534f' : '#5cb85c';
    const asymmetryHTML = `Sammanlagd Asymmetri: <span style="color: ${color}; font-weight: bold;">${avgPercent.toFixed(1)}%</span>`;

    displayEl.innerHTML = asymmetryHTML;
    displayEl.dataset.asymmetryValue = avgPercent.toFixed(1);
}

function updatePreview() {
    const data = collectDataFromForm();
    const referenceSide = data.patientInfo.dominantSide;

    const sections = document.querySelectorAll('.test-section');
    const typeCounts = {};
    const plotlyConfig = { displayModeBar: false, staticPlot: true, responsive: true };

    sections.forEach(sec => {
        const type = sec.dataset.testType;
        const index = sec.dataset.instanceIndex || ''; // e.g. "_0"

        if (!type) return;

        // Determine Data Key logic matching collectDataFromForm
        typeCounts[type] = (typeCounts[type] || 0) + 1;
        const isFirst = typeCounts[type] === 1;

        let key = type;
        if (type === 'repeated_bilateral') key = 'repeatedBilateral';
        if (type === 'cmj2ben') key = 'cmj2ben';
        if (type === 'squat') key = 'squatAnalytics';

        // Page 2 mapping
        let p2key = type;
        if (type === 'hipthrust') p2key = 'hipThrust';
        if (type === 'quads') p2key = 'quadriceps';
        if (type === 'staticsquat-handdrag') p2key = 'staticsquatHanddrag';
        if (type === 'staticsquat-hoftrem') p2key = 'staticsquatHoftrem';
        if (type === 'nordic-hamstring') p2key = 'nordicHamstring';

        let finalKey = key;
        if (!isFirst) finalKey += `_${typeCounts[type] - 1}`;
        let finalP2Key = p2key;
        if (!isFirst) finalP2Key += `_${typeCounts[type] - 1}`;


        let sectionData = null;

        // Find the data object
        if (type === 'manual') {
            if (isFirst) sectionData = data.page2.manual;
            else sectionData = data.page2[finalP2Key];
        } else if (['hipthrust', 'quads', 'staticsquat-handdrag', 'staticsquat-hoftrem', 'hamstring', 'nordic-hamstring'].includes(type) || type === 'manual') {
            if (type !== 'manual') {
                if (isFirst) sectionData = data.page2.strengthTests[p2key];
                else sectionData = data.page2.strengthTests[finalP2Key];
            }
        } else if (type.startsWith('custom_')) {
            // CRITICAL FIX: Custom tests are stored in data.page2.custom[customId]
            const customId = type.replace('custom_', '');
            sectionData = data.page2.custom ? data.page2.custom[customId] : null;
        } else {
            // Page 1
            sectionData = data.page1[finalKey];
        }

        if (!sectionData) return;

        // Render Graph
        const container = sec.querySelector('.graph-container');
        if (container) {
            container.style.display = 'block';

            if (type === 'balance') {
                updateCombinedAsymmetryDisplay(sectionData.leftScore, sectionData.rightScore, false, sectionData.leftDiff, sectionData.rightDiff, true, referenceSide, `asymmetry_balance${index}`);

                const template = graphTemplates[testConfigs.balance.template];
                const chartData = { leftVal1: sectionData.leftScore, rightVal1: sectionData.rightScore, leftVal2: sectionData.leftDiff, rightVal2: sectionData.rightDiff };
                const fig = template.create(chartData, testConfigs.balance.config);
                Plotly.react(`p1-chart-balance${index}`, fig.data, fig.layout, plotlyConfig);

            } else if (type === 'cmj') {
                const avgVJump = (sectionData.vaJumps.reduce((a, b) => a + b, 0) / 3) || 0;
                const avgHJump = (sectionData.hoJumps.reduce((a, b) => a + b, 0) / 3) || 0;
                updateAsymmetryDisplay(avgVJump, avgHJump, referenceSide, `asymmetry_cmj${index}`);

                const template = graphTemplates[testConfigs.cmj.template];
                const chartData = { labels: testConfigs.cmj.config.labels, vaValues: sectionData.vaJumps, hoValues: sectionData.hoJumps };
                const fig = template.create(chartData, testConfigs.cmj.config);
                Plotly.react(`p1-chart-cmj${index}`, fig.data, fig.layout, plotlyConfig);

            } else if (type === 'tia') {
                updateCombinedAsymmetryDisplay(sectionData.leftJump, sectionData.rightJump, true, sectionData.leftGct, sectionData.rightGct, false, referenceSide, `asymmetry_tia${index}`);

                const template = graphTemplates[testConfigs.tia.template];
                const chartData = { leftVal1: sectionData.leftJump, rightVal1: sectionData.rightJump, leftVal2: sectionData.leftGct, rightVal2: sectionData.rightGct };
                const fig = template.create(chartData, testConfigs.tia.config);
                Plotly.react(`p1-chart-tia${index}`, fig.data, fig.layout, plotlyConfig);

            } else if (type === 'sidehop') {
                updateAsymmetryDisplay(sectionData.leftCount, sectionData.rightCount, referenceSide, `asymmetry_sidehop${index}`);

                const template = graphTemplates[testConfigs.sidehop.template];
                const chartData = { leftVal: sectionData.leftCount, rightVal: sectionData.rightCount };
                const fig = template.create(chartData, testConfigs.sidehop.config);
                Plotly.react(`p1-chart-sidehop${index}`, fig.data, fig.layout, plotlyConfig);

            } else if (type === 'squat') {
                const template = graphTemplates[testConfigs.squatAnalytics.template];
                [sectionData.attempt1, sectionData.attempt2, sectionData.attempt3].forEach((val, i) => {
                    const fig = template.create({ value: val }, testConfigs.squatAnalytics.config);
                    Plotly.react(`p1-chart-donut-${i + 1}${index}`, fig.data, fig.layout, plotlyConfig);
                });

            } else if (type === 'repeated_bilateral') {
                const template = graphTemplates[testConfigs.repeatedBilateral.template];
                const chartData = { val1: sectionData.avgHeight, val2: sectionData.avgGct };
                const fig = template.create(chartData, testConfigs.repeatedBilateral.config);
                Plotly.react(`p1-chart-repeated-bilateral${index}`, fig.data, fig.layout, plotlyConfig);

            } else if (type === 'cmj2ben') {
                const template = graphTemplates[testConfigs.cmj2ben.template];
                [sectionData.attempt1, sectionData.attempt2, sectionData.attempt3].forEach((val, i) => {
                    const fig = template.create({ value: val }, testConfigs.cmj2ben.config);
                    Plotly.react(`p1-chart-donut-cmj2ben-${i + 1}${index}`, fig.data, fig.layout, plotlyConfig);
                });

            } else if (['hipthrust', 'quads', 'staticsquat-handdrag', 'staticsquat-hoftrem', 'hamstring'].includes(type)) {
                let chartIdBase = `p2-chart-`;
                let suffix = '';
                if (type === 'hipthrust') suffix = 'hipthrust';
                else if (type === 'quads') suffix = 'quads';
                else if (type === 'staticsquat-handdrag') suffix = 'squat-handdrag';
                else if (type === 'staticsquat-hoftrem') suffix = 'squat-hoftrem';
                else if (type === 'hamstring') suffix = 'hamstring';
                chartIdBase += suffix;

                updateAsymmetryDisplay(sectionData.left, sectionData.right, referenceSide, `asymmetry_${type.replace(/-/g, '_')}${index}`);

                const configKey = p2key;
                const cfg = testConfigs[configKey];
                const template = graphTemplates[cfg.template];
                const chartData = { leftVal1: sectionData.left, rightVal1: sectionData.right };

                const fig = template.create(chartData, cfg.config);
                Plotly.react(`${chartIdBase}${index}`, fig.data, fig.layout, plotlyConfig);

                if (type === 'hipthrust') {
                    updateAnimalOverlay(sectionData.tva, document.getElementById(`overlay-image-hipthrust${index}`), document.getElementById(`overlay-text-hipthrust${index}`));
                } else if (type === 'staticsquat-handdrag') {
                    updateAnimalOverlay(sectionData.both, document.getElementById(`overlay-image-squat-handdrag${index}`), document.getElementById(`overlay-text-squat-handdrag${index}`));
                } else if (type === 'staticsquat-hoftrem') {
                    updateAnimalOverlay(sectionData.both, document.getElementById(`overlay-image-squat-hoftrem${index}`), document.getElementById(`overlay-text-squat-hoftrem${index}`));
                }

            } else if (type === 'nordic-hamstring') {
                const template = graphTemplates[testConfigs.nordicHamstring.template];
                [sectionData.attempt1, sectionData.attempt2, sectionData.attempt3].forEach((val, i) => {
                    const fig = template.create({ value: val }, testConfigs.nordicHamstring.config);
                    Plotly.react(`p2-chart-donut-nordic-${i + 1}${index}`, fig.data, fig.layout, plotlyConfig);
                });

            } else if (type.startsWith('custom_')) {
                const customId = type.replace('custom_', '');
                if (sectionData && sectionData.active) {
                    const chartId = `custom-chart-${customId}${index}`;
                    const container = document.getElementById(chartId);

                    if (container) {
                        const testDef = allTests.find(t => t.id === customId);
                        if (testDef) {
                            const config = {
                                yAxisTitle: testDef.config.yAxisTitle,
                                metricNames: testDef.config.metricNames || ['Värde 1'],
                                metricName: (testDef.config.metricNames || ['Värde 1'])[0], // For single-bar template
                                inputLabels: testDef.config.inputLabels,
                                labels: testDef.config.inputLabels, // Map to labels for templates
                                decimals: 1,
                                // Pass other config props
                                y1Title: testDef.config.yAxisTitle,
                                y2Title: testDef.config.y2Title || null,
                                displayType: testDef.config.displayType || 'percent'
                            };
                            let templateId = testDef.graphType;

                            // Alias Mapping
                            if (templateId === 'grouped-bar-2' || templateId === 'grouped-bar-3') templateId = 'grouped-bar';
                            if (templateId === 'dual-metric-paired') templateId = 'dual-axis';
                            if (templateId === 'bar-gauge') templateId = 'single-bars-3';
                            // single-bar maps to single-bar. single-bars-3 maps to single-bars-3.

                            const template = graphTemplates[templateId];
                            console.log(`DEBUG: Custom Graph Render. ID: ${customId}, Type: ${templateId}, TemplateFound: ${!!template}`);

                            if (template) {
                                let cData = {};
                                const d = sectionData; // Short alias

                                try {
                                    if (templateId === 'single-bar') {
                                        // single-bar uses leftVal/rightVal
                                        cData = { leftVal: d.left || 0, rightVal: d.right || 0 };
                                        if (d.asymmetryPercent !== undefined) {
                                            updateAsymmetryDisplay(d.left, d.right, referenceSide, `asymmetry_custom_${customId}${index}`);
                                        }
                                    }
                                    else if (templateId === 'paired-bar') {
                                        // paired-bar template expects leftVal1/rightVal1
                                        cData = { leftVal1: d.left || 0, rightVal1: d.right || 0 };
                                        if (d.asymmetryPercent !== undefined) {
                                            updateAsymmetryDisplay(d.left, d.right, referenceSide, `asymmetry_custom_${customId}${index}`);
                                        }
                                    }
                                    else if (templateId === 'single-bars-3') {
                                        cData = { values: [d.val1 || 0, d.val2 || 0, d.val3 || 0] };
                                    }
                                    else if (templateId === 'dual-axis') {
                                        cData = {
                                            leftVal1: d.val1_L || 0, rightVal1: d.val1_R || 0,
                                            leftVal2: d.val2_L || 0, rightVal2: d.val2_R || 0
                                        };
                                        // Symmetry on Metric 1 (Bars)
                                        if (d.asymmetryPercent !== undefined) {
                                            updateAsymmetryDisplay(d.val1_L, d.val1_R, referenceSide, `asymmetry_custom_${customId}${index}`);
                                        }
                                    }
                                    else if (templateId === 'grouped-bar') {
                                        // 3 Groups
                                        const rawLabels = testDef.config.inputLabels || [];
                                        const safeLabels = rawLabels.length > 0
                                            ? rawLabels.map((l, i) => l || `Värde ${i + 1}`)
                                            : ['1', '2', '3'];

                                        cData = {
                                            labels: safeLabels,
                                            vaValues: [d.g1_L || 0, d.g2_L || 0, d.g3_L || 0],
                                            hoValues: [d.g1_R || 0, d.g2_R || 0, d.g3_R || 0]
                                        };
                                        // Symmetry on Average of 3 Attempts
                                        const avgL = (d.g1_L + d.g2_L + d.g3_L) / 3;
                                        const avgR = (d.g1_R + d.g2_R + d.g3_R) / 3;
                                        if (avgL > 0 && avgR > 0) {
                                            updateAsymmetryDisplay(avgL, avgR, referenceSide, `asymmetry_custom_${customId}${index}`);
                                        }
                                    }
                                    else if (templateId === 'three-bar') {
                                        cData = { leftVal: d.val_L || 0, rightVal: d.val_R || 0, bothVal: d.val_Both || 0 };

                                        // Animal Overlay for Three Bar (uses "Två ben" value like Static Squat)
                                        const bothKg = d.val_Both || 0;
                                        if (bothKg > 0) {
                                            const ovImg = document.getElementById(`overlay-image-custom_${customId}${index}`);
                                            const ovTxt = document.getElementById(`overlay-text-custom_${customId}${index}`);
                                            if (ovImg && ovTxt) {
                                                updateAnimalOverlay(bothKg, ovImg, ovTxt);
                                            }
                                        }

                                        // Asymmetry display for left/right
                                        if (d.asymmetryPercent !== undefined) {
                                            updateAsymmetryDisplay(d.val_L, d.val_R, referenceSide, `asymmetry_custom_${customId}${index}`);
                                        }
                                    }
                                    else if (templateId === 'bilateral') {
                                        cData = { val1: d.val1 || 0, val2: d.val2 || 0 };
                                    }
                                    else if (templateId === 'donut') {
                                        // Donut template has 3 separate divs, render each separately
                                        const template = graphTemplates[templateId];
                                        const values = [d.val1 || 0, d.val2 || 0, d.val3 || 0];
                                        values.forEach((val, i) => {
                                            const donutChartId = `custom-chart-donut-${i + 1}-${customId}${index}`;
                                            const fig = template.create({ value: val }, config);
                                            Plotly.react(donutChartId, fig.data, fig.layout, plotlyConfig);
                                        });
                                        return; // Skip the main render below
                                    }
                                    else if (templateId === 'bar-gauge') {
                                        cData = { values: [d.val1 || 0, d.val2 || 0, d.val3 || 0] };
                                        config.labels = testDef.config.inputLabels;
                                    }
                                    else if (templateId === 'manual') {
                                        // Manual type has no graph, only text inputs
                                        // Hide the graph container
                                        container.style.display = 'none';
                                        return; // Skip graph rendering
                                    }

                                    const fig = template.create(cData, config);
                                    Plotly.react(chartId, fig.data, fig.layout, plotlyConfig);

                                } catch (err) {
                                    console.error(`Error rendering custom chart ${customId}:`, err);
                                    container.innerHTML = `<p style="color:red; font-size: 12px;">Graph Error: ${err.message}</p>`;
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (data.page2.manual) {
        updateManualPreview(data.page2.manual);
    }
}

function exportToExcel() {
    const data = collectDataFromForm();
    const flatData = [
        { Test: 'Namn', Verdi: data.patientInfo.name },
        { Test: 'Datum', Verdi: data.patientInfo.date },
        { Test: 'Sport/Position', Verdi: data.patientInfo.sportPosition },
        { Test: 'Skapad Av', Verdi: data.patientInfo.createdBy },
        { Test: 'Referenstyp', Verdi: data.patientInfo.dominantSideType },
        { Test: 'Referenssida', Verdi: data.patientInfo.dominantSide },
    ];

    if (data.page1.balance) {
        flatData.push(
            { Test: 'Balans - VÄ Score', Verdi: data.page1.balance.leftScore },
            { Test: 'Balans - HÖ Score', Verdi: data.page1.balance.rightScore },
            { Test: 'Balans - VÄ Gen. diff', Verdi: data.page1.balance.leftDiff },
            { Test: 'Balans - HÖ Gen. diff', Verdi: data.page1.balance.rightDiff },
            { Test: 'Balans - Kommentar', Verdi: data.page1.balance.comment },
            { Test: 'Balans - Asymmetri %', Verdi: data.page1.balance.asymmetryPercent }
        );
    }

    if (data.page1.cmj) {
        flatData.push(
            { Test: 'CMJ - VÄ Hopp 1', Verdi: data.page1.cmj.vaJumps[0] },
            { Test: 'CMJ - VÄ Hopp 2', Verdi: data.page1.cmj.vaJumps[1] },
            { Test: 'CMJ - VÄ Hopp 3', Verdi: data.page1.cmj.vaJumps[2] },
            { Test: 'CMJ - HÖ Hopp 1', Verdi: data.page1.cmj.hoJumps[0] },
            { Test: 'CMJ - HÖ Hopp 2', Verdi: data.page1.cmj.hoJumps[1] },
            { Test: 'CMJ - HÖ Hopp 3', Verdi: data.page1.cmj.hoJumps[2] },
            { Test: 'CMJ - Kommentar', Verdi: data.page1.cmj.comment },
            { Test: 'CMJ - Asymmetri %', Verdi: data.page1.cmj.asymmetryPercent }
        );
    }

    if (data.page1.tia) {
        flatData.push(
            { Test: 'TIA - VÄ Hopphöjd', Verdi: data.page1.tia.leftJump },
            { Test: 'TIA - HÖ Hopphöjd', Verdi: data.page1.tia.rightJump },
            { Test: 'TIA - VÄ GCT', Verdi: data.page1.tia.leftGct },
            { Test: 'TIA - HÖ GCT', Verdi: data.page1.tia.rightGct },
            { Test: 'TIA - Kommentar', Verdi: data.page1.tia.comment },
            { Test: 'TIA - Asymmetri %', Verdi: data.page1.tia.asymmetryPercent }
        );
    }

    if (data.page1.sidehop) {
        flatData.push(
            { Test: 'Sidhopp - VÄ Antal', Verdi: data.page1.sidehop.leftCount },
            { Test: 'Sidhopp - HÖ Antal', Verdi: data.page1.sidehop.rightCount },
            { Test: 'Sidhopp - Kommentar', Verdi: data.page1.sidehop.comment },
            { Test: 'Sidhopp - Asymmetri %', Verdi: data.page1.sidehop.asymmetryPercent }
        );
    }

    if (data.page1.squatAnalytics) {
        flatData.push(
            { Test: 'Squat Analytics - Försök 1', Verdi: data.page1.squatAnalytics.attempt1 },
            { Test: 'Squat Analytics - Försök 2', Verdi: data.page1.squatAnalytics.attempt2 },
            { Test: 'Squat Analytics - Försök 3', Verdi: data.page1.squatAnalytics.attempt3 },
            { Test: 'Squat Analytics - Kommentar', Verdi: data.page1.squatAnalytics.comment }
        );
    }

    if (data.page1.repeatedBilateral) {
        flatData.push(
            { Test: 'Repeated Bilateral - Gen. Hopphöjd', Verdi: data.page1.repeatedBilateral.avgHeight },
            { Test: 'Repeated Bilateral - Gen. GCT', Verdi: data.page1.repeatedBilateral.avgGct },
            { Test: 'Repeated Bilateral - Kommentar', Verdi: data.page1.repeatedBilateral.comment }
        );
    }

    if (data.page1.cmj2ben) {
        flatData.push(
            { Test: 'CMJ Två Ben - Försök 1', Verdi: data.page1.cmj2ben.attempt1 },
            { Test: 'CMJ Två Ben - Försök 2', Verdi: data.page1.cmj2ben.attempt2 },
            { Test: 'CMJ Två Ben - Försök 3', Verdi: data.page1.cmj2ben.attempt3 },
            { Test: 'CMJ Två Ben - Kommentar', Verdi: data.page1.cmj2ben.comment }
        );
    }

    if (data.page2.strengthTests.hipThrust) {
        flatData.push(
            { Test: 'Styrka - Hip Thrust VÄ', Verdi: data.page2.strengthTests.hipThrust.left },
            { Test: 'Styrka - Hip Thrust HÖ', Verdi: data.page2.strengthTests.hipThrust.right },
            { Test: 'Styrka - Hip Thrust Två ben', Verdi: data.page2.strengthTests.hipThrust.tva },
            { Test: 'Styrka - Hip Thrust Kommentar', Verdi: data.page2.strengthTests.hipThrust.comment },
            { Test: 'Styrka - Hip Thrust Asymmetri %', Verdi: data.page2.strengthTests.hipThrust.asymmetryPercent }
        );
    }

    if (data.page2.strengthTests.quadriceps) {
        flatData.push(
            { Test: 'Styrka - Quadriceps VÄ', Verdi: data.page2.strengthTests.quadriceps.left },
            { Test: 'Styrka - Quadriceps HÖ', Verdi: data.page2.strengthTests.quadriceps.right },
            { Test: 'Styrka - Quadriceps Kommentar', Verdi: data.page2.strengthTests.quadriceps.comment },
            { Test: 'Styrka - Quadriceps Asymmetri %', Verdi: data.page2.strengthTests.quadriceps.asymmetryPercent }
        );
    }

    if (data.page2.strengthTests.staticsquatHanddrag) {
        flatData.push(
            { Test: 'Styrka - Squat Handdrag VÄ', Verdi: data.page2.strengthTests.staticsquatHanddrag.left },
            { Test: 'Styrka - Squat Handdrag HÖ', Verdi: data.page2.strengthTests.staticsquatHanddrag.right },
            { Test: 'Styrka - Squat Handdrag Två ben', Verdi: data.page2.strengthTests.staticsquatHanddrag.both },
            { Test: 'Styrka - Squat Handdrag Kommentar', Verdi: data.page2.strengthTests.staticsquatHanddrag.comment },
            { Test: 'Styrka - Squat Handdrag Asymmetri %', Verdi: data.page2.strengthTests.staticsquatHanddrag.asymmetryPercent }
        );
    }

    if (data.page2.strengthTests.staticsquatHoftrem) {
        flatData.push(
            { Test: 'Styrka - Squat Höftrem VÄ', Verdi: data.page2.strengthTests.staticsquatHoftrem.left },
            { Test: 'Styrka - Squat Höftrem HÖ', Verdi: data.page2.strengthTests.staticsquatHoftrem.right },
            { Test: 'Styrka - Squat Höftrem Två ben', Verdi: data.page2.strengthTests.staticsquatHoftrem.both },
            { Test: 'Styrka - Squat Höftrem Kommentar', Verdi: data.page2.strengthTests.staticsquatHoftrem.comment },
            { Test: 'Styrka - Squat Höftrem Asymmetri %', Verdi: data.page2.strengthTests.staticsquatHoftrem.asymmetryPercent }
        );
    }

    if (data.page2.strengthTests.hamstring) {
        flatData.push(
            { Test: 'Styrka - Hamstring VÄ', Verdi: data.page2.strengthTests.hamstring.left },
            { Test: 'Styrka - Hamstring HÖ', Verdi: data.page2.strengthTests.hamstring.right },
            { Test: 'Styrka - Hamstring Kommentar', Verdi: data.page2.strengthTests.hamstring.comment },
            { Test: 'Styrka - Hamstring Asymmetri %', Verdi: data.page2.strengthTests.hamstring.asymmetryPercent }
        );
    }

    if (data.page2.strengthTests.nordicHamstring) {
        flatData.push(
            { Test: 'Styrka - Nordic Hamstring Försök 1', Verdi: data.page2.strengthTests.nordicHamstring.attempt1 },
            { Test: 'Styrka - Nordic Hamstring Försök 2', Verdi: data.page2.strengthTests.nordicHamstring.attempt2 },
            { Test: 'Styrka - Nordic Hamstring Försök 3', Verdi: data.page2.strengthTests.nordicHamstring.attempt3 },
            { Test: 'Styrka - Nordic Hamstring Kommentar', Verdi: data.page2.strengthTests.nordicHamstring.comment }
        );
    }

    if (data.page2.manual) {
        flatData.push(
            { Test: 'Manuell - SRP Tare', Verdi: data.page2.manual.srp.tare },
            { Test: 'Manuell - SRP Force', Verdi: data.page2.manual.srp.force },
            { Test: 'Manuell - SPTS kg', Verdi: data.page2.manual.spts.kg },
            { Test: 'Manuell - MPU Tare', Verdi: data.page2.manual.mpu.tare },
            { Test: 'Manuell - MPU Force', Verdi: data.page2.manual.mpu.force },
            { Test: 'Manuell - BPC Hits', Verdi: data.page2.manual.bpc.hits }
        );
    }

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Testdata");
    XLSX.writeFile(workbook, `Alphatek_Reports_Data_${data.patientInfo.name || 'patient'}_${data.patientInfo.date || ''}.xlsx`);
}

function setDefaultComments() {
    document.getElementById('comment_balance').value = 'Visar balanspoäng och genomsnittlig avvikelse i cm.';
    document.getElementById('comment_cmj').value = 'Visar hopphöjd i centimeter (cm) för tre separata hopp.';
    document.getElementById('comment_tia').value = 'Visar genomsnittlig hopphöjd (cm) och markkontakttid (sekunder).';
    document.getElementById('comment_sidehop').value = 'Visar antal sidhopp utförda inom tidsramen.';
    document.getElementById('comment_squat').value = 'Visar poäng för tre separata knäböjsförsök.';
    document.getElementById('comment_repeated_bilateral').value = 'Visar genomsnittlig hopphöjd och markkontakttid för hopp på två ben.';
    document.getElementById('comment_cmj2ben').value = 'Visar poäng för tre separata CMJ-hopp på två ben.';
    const defaultStrengthComment = 'Visar kraftutveckling för vänster (VÄ) och höger (HÖ) sida.';
    document.getElementById('comment_hipthrust').value = defaultStrengthComment;
    document.getElementById('comment_quads').value = defaultStrengthComment;
    document.getElementById('comment_squat_pull_handdrag').value = defaultStrengthComment;
    document.getElementById('comment_squat_pull_hoftrem').value = defaultStrengthComment;
    document.getElementById('comment_hamstring').value = defaultStrengthComment;
    document.getElementById('comment_nordic_hamstring').value = 'Visar poäng för tre separata Nordic Hamstring-försök.';
}

// --- EVENT LISTENERS & INITIALIZATION ---
// Global listeners moved to DOMContentLoaded


function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        const structuredData = {
            patientInfo: {},
            page1: {
                balance: {},
                cmj: { vaJumps: [], hoJumps: [] },
                tia: {},
                sidehop: {},
                squatAnalytics: {},
                repeatedBilateral: {},
                cmj2ben: {}
            },
            page2: {
                strengthTests: {
                    hipThrust: {},
                    quadriceps: {},
                    staticsquatHanddrag: {},
                    staticsquatHoftrem: {},
                    hamstring: {},
                    nordicHamstring: {}
                },
                manual: {
                    srp: {},
                    spts: {},
                    mpu: {},
                    bpc: {}
                }
            }
        };

        json.forEach(row => {
            const key = row.Test;
            const value = row.Verdi;
            switch (key) {
                case 'Namn': structuredData.patientInfo.name = value; break;
                case 'Datum': structuredData.patientInfo.date = value; break;
                case 'Sport/Position': structuredData.patientInfo.sportPosition = value; break;
                case 'Skapad Av': structuredData.patientInfo.createdBy = value; break;
                case 'Referenstyp': structuredData.patientInfo.dominantSideType = value; break;
                case 'Referenssida': structuredData.patientInfo.dominantSide = value; break;
                case 'Balans - VÄ Score': structuredData.page1.balance.leftScore = value; break;
                case 'Balans - HÖ Score': structuredData.page1.balance.rightScore = value; break;
                case 'Balans - VÄ Gen. diff': structuredData.page1.balance.leftDiff = value; break;
                case 'Balans - HÖ Gen. diff': structuredData.page1.balance.rightDiff = value; break;
                case 'Balans - Kommentar': structuredData.page1.balance.comment = value; break;
                case 'CMJ - VÄ Hopp 1': structuredData.page1.cmj.vaJumps[0] = value; break;
                case 'CMJ - VÄ Hopp 2': structuredData.page1.cmj.vaJumps[1] = value; break;
                case 'CMJ - VÄ Hopp 3': structuredData.page1.cmj.vaJumps[2] = value; break;
                case 'CMJ - HÖ Hopp 1': structuredData.page1.cmj.hoJumps[0] = value; break;
                case 'CMJ - HÖ Hopp 2': structuredData.page1.cmj.hoJumps[1] = value; break;
                case 'CMJ - HÖ Hopp 3': structuredData.page1.cmj.hoJumps[2] = value; break;
                case 'CMJ - Kommentar': structuredData.page1.cmj.comment = value; break;
                case 'TIA - VÄ Hopphöjd': structuredData.page1.tia.leftJump = value; break;
                case 'TIA - HÖ Hopphöjd': structuredData.page1.tia.rightJump = value; break;
                case 'TIA - VÄ GCT': structuredData.page1.tia.leftGct = value; break;
                case 'TIA - HÖ GCT': structuredData.page1.tia.rightGct = value; break;
                case 'TIA - Kommentar': structuredData.page1.tia.comment = value; break;
                case 'Sidhopp - VÄ Antal': structuredData.page1.sidehop.leftCount = value; break;
                case 'Sidhopp - HÖ Antal': structuredData.page1.sidehop.rightCount = value; break;
                case 'Sidhopp - Kommentar': structuredData.page1.sidehop.comment = value; break;
                case 'Squat Analytics - Försök 1': structuredData.page1.squatAnalytics.attempt1 = value; break;
                case 'Squat Analytics - Försök 2': structuredData.page1.squatAnalytics.attempt2 = value; break;
                case 'Squat Analytics - Försök 3': structuredData.page1.squatAnalytics.attempt3 = value; break;
                case 'Squat Analytics - Kommentar': structuredData.page1.squatAnalytics.comment = value; break;
                case 'Repeated Bilateral - Gen. Hopphöjd': structuredData.page1.repeatedBilateral.avgHeight = value; break;
                case 'Repeated Bilateral - Gen. GCT': structuredData.page1.repeatedBilateral.avgGct = value; break;
                case 'Repeated Bilateral - Kommentar': structuredData.page1.repeatedBilateral.comment = value; break;
                case 'CMJ Två Ben - Försök 1': structuredData.page1.cmj2ben.attempt1 = value; break;
                case 'CMJ Två Ben - Försök 2': structuredData.page1.cmj2ben.attempt2 = value; break;
                case 'CMJ Två Ben - Försök 3': structuredData.page1.cmj2ben.attempt3 = value; break;
                case 'CMJ Två Ben - Kommentar': structuredData.page1.cmj2ben.comment = value; break;
                case 'Styrka - Hip Thrust VÄ': structuredData.page2.strengthTests.hipThrust.left = value; break;
                case 'Styrka - Hip Thrust HÖ': structuredData.page2.strengthTests.hipThrust.right = value; break;
                case 'Styrka - Hip Thrust Två ben': structuredData.page2.strengthTests.hipThrust.tva = value; break;
                case 'Styrka - Hip Thrust Kommentar': structuredData.page2.strengthTests.hipThrust.comment = value; break;
                case 'Styrka - Hip Thrust Asymmetri %': structuredData.page2.strengthTests.hipThrust.asymmetryPercent = value; break;
                case 'Styrka - Quadriceps VÄ': structuredData.page2.strengthTests.quadriceps.left = value; break;
                case 'Styrka - Quadriceps HÖ': structuredData.page2.strengthTests.quadriceps.right = value; break;
                case 'Styrka - Quadriceps Kommentar': structuredData.page2.strengthTests.quadriceps.comment = value; break;
                case 'Styrka - Squat Handdrag VÄ': structuredData.page2.strengthTests.staticsquatHanddrag.left = value; break;
                case 'Styrka - Squat Handdrag HÖ': structuredData.page2.strengthTests.staticsquatHanddrag.right = value; break;
                case 'Styrka - Squat Handdrag Två ben': structuredData.page2.strengthTests.staticsquatHanddrag.both = value; break;
                case 'Styrka - Squat Handdrag Kommentar': structuredData.page2.strengthTests.staticsquatHanddrag.comment = value; break;
                case 'Styrka - Squat Höftrem VÄ': structuredData.page2.strengthTests.staticsquatHoftrem.left = value; break;
                case 'Styrka - Squat Höftrem HÖ': structuredData.page2.strengthTests.staticsquatHoftrem.right = value; break;
                case 'Styrka - Squat Höftrem Två ben': structuredData.page2.strengthTests.staticsquatHoftrem.both = value; break;
                case 'Styrka - Squat Höftrem Kommentar': structuredData.page2.strengthTests.staticsquatHoftrem.comment = value; break;
                case 'Styrka - Hamstring VÄ': structuredData.page2.strengthTests.hamstring.left = value; break;
                case 'Styrka - Hamstring HÖ': structuredData.page2.strengthTests.hamstring.right = value; break;
                case 'Styrka - Hamstring Kommentar': structuredData.page2.strengthTests.hamstring.comment = value; break;
                case 'Styrka - Nordic Hamstring Försök 1': structuredData.page2.strengthTests.nordicHamstring.attempt1 = value; break;
                case 'Styrka - Nordic Hamstring Försök 2': structuredData.page2.strengthTests.nordicHamstring.attempt2 = value; break;
                case 'Styrka - Nordic Hamstring Försök 3': structuredData.page2.strengthTests.nordicHamstring.attempt3 = value; break;
                case 'Styrka - Nordic Hamstring Kommentar': structuredData.page2.strengthTests.nordicHamstring.comment = value; break;
                case 'Manuell - SRP Tare': structuredData.page2.manual.srp.tare = value; break;
                case 'Manuell - SRP Force': structuredData.page2.manual.srp.force = value; break;
                case 'Manuell - SPTS kg': structuredData.page2.manual.spts.kg = value; break;
                case 'Manuell - MPU Tare': structuredData.page2.manual.mpu.tare = value; break;
                case 'Manuell - MPU Force': structuredData.page2.manual.mpu.force = value; break;
                case 'Manuell - BPC Hits': structuredData.page2.manual.bpc.hits = value; break;
            }
        });

        populateFormFromData(structuredData);
        document.querySelectorAll('.test-section').forEach(section => {
            section.style.display = 'block';
        });
        alert('Data importerad!');
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

document.querySelectorAll('#input-form input, #input-form textarea, #input-form input[type="radio"]').forEach(input => {
    input.addEventListener('input', debounce(() => {
        updatePreview();
        // saveData(); // REMOVED: Auto-save disabled per user request
    }, 1000));
});

document.querySelectorAll('textarea[id^="comment_"]').forEach(textarea => {
    textarea.addEventListener('focus', () => {
        textarea.dataset.isDefault = 'false';
    });
});

// --- Test Selection Logic ---
function renderTestSelection(activeTestIds = null) {
    const inputContainer = document.getElementById('test-input-container');
    if (!inputContainer) return; // Use new Wizard UI instead, ignore legacy rendering

    const buttonContainer = document.getElementById('test-list');

    if (inputContainer) inputContainer.innerHTML = '';
    if (buttonContainer) buttonContainer.innerHTML = '';

    // Determine what to render
    let testsToRender = [];
    if (activeTestIds) {
        console.log("renderTestSelection Called with IDs:", activeTestIds);
        testsToRender = activeTestIds;
    } else {
        console.log("renderTestSelection Called with NULL, using default");
        // Default: One of each available test
        if (window.allTests) {
            testsToRender = window.allTests.map(t => t.id);
        } else {
            console.error("Critical: window.allTests is undefined!");
            testsToRender = [];
        }
    }

    const counts = {};
    const totalCounts = {};
    testsToRender.forEach(id => totalCounts[id] = (totalCounts[id] || 0) + 1);

    testsToRender.forEach((testId, i) => {
        counts[testId] = (counts[testId] || 0) + 1;

        let template = testTemplates[testId];

        if (!template) {
            // Fix: Strip 'custom_' prefix if present when searching in allTests
            // allTests IDs are raw Firestore IDs (e.g. 'abc'). testId here is 'custom_abc'.
            const rawId = testId.startsWith('custom_') ? testId.replace('custom_', '') : testId;
            const testDef = window.allTests ? window.allTests.find(t => t.id === rawId) : null;

            if (testDef && (testDef.isCustom || testDef.type === 'custom')) {
                // Ensure generateTemplate is imported or available! 
                // It is imported as 'generateTemplate'.
                console.log(`DEBUG: Generating template for custom test. ID: ${rawId}, Name: ${testDef.name}, GraphType: ${testDef.graphType}`);
                template = generateTemplate(testDef);
                console.log(`DEBUG: Generated template length: ${template ? template.length : 'NULL'}`);
            }
        }

        if (!template) {
            console.warn(`Template not found for test: ${testId}`);
            return;
        }

        const label = totalCounts[testId] > 1 ? ` #${counts[testId]}` : '';
        const suffix = `_${i}`; // Unique suffix based on position in list

        // Replace placeholders
        const html = template
            .replace(/{{INDEX}}/g, suffix)
            .replace(/{{INDEX_LABEL}}/g, label);

        // Debug: Log first 500 chars of HTML for custom tests
        if (testId.startsWith('custom_')) {
            console.log(`DEBUG: Inserting HTML for ${testId}. First 500 chars:`, html.substring(0, 500));
        }

        inputContainer.insertAdjacentHTML('beforeend', html);
    });

    // Re-attach listeners for graph updates
    if (inputContainer) {
        inputContainer.querySelectorAll('input, textarea').forEach(input => {
            input.addEventListener('input', () => {
                updatePreview();
                // Debounced save could go here
            });
        });
    }

    // Immediately update preview to render empty graphs
    updatePreview();
}



// Event listener removed as it was duplicate of individual button onclick handlers above

// Imports moved to top

// Ensure global functions from utils are available if needed (utils.js should be imported as module too)
// Note: Since index.js is now a module, global functions like 'saveData' won't be exposed to window automatically unless we do it explicitly.
// However, the event listeners are attached in JS, so it should be fine.

// Helper to remove undefined values for Firestore
function sanitizeData(obj) {
    if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
            if (obj[key] === undefined) {
                delete obj[key];
            } else if (typeof obj[key] === 'object') {
                sanitizeData(obj[key]);
                // Optional: remove empty objects? 
                // data.page1 might become {} if no tests selected. Firestore handles {} fine.
            }
        });
    }
    return obj;
}

// --- LOGIC: SAVE / LOAD DATA ---
async function saveData() {
    if (!auth.currentUser) return;
    if (!currentPatient) {
        console.warn("Cannot save: No patient selected.");
        alert("Du måste välja en patient först.");
        return;
    }

    // 1. Collect all data from the form
    let data = collectDataFromForm();

    // 2. Add Metadata
    data.userId = auth.currentUser.uid;
    // Add User Details for Admin Dashboard
    data.createdByEmail = auth.currentUser.email;
    if (auth.currentUser.displayName) data.createdByName = auth.currentUser.displayName;

    data.updatedAt = serverTimestamp(); // Always update timestamp
    if (!data.createdAt) {
        // This might be overwritten if we load existing, handle in populate
    }

    data.patientId = currentPatient.id;
    data.patientInternalId = currentPatient.internalId; // redundant but useful
    data.patientName = `${currentPatient.firstName} ${currentPatient.lastName}`;
    data.protocolName = currentProtocolName || '';

    // 3. Sanitize Data (Remove undefined)
    data = sanitizeData(data);

    // 4. Save to Firestore
    try {
        const screeningsRef = collection(db, `users/${auth.currentUser.uid}/patients/${currentPatient.id}/screenings`);

        // AUTOMATIC SAVE AS NEW LOGIC
        // If we are editing an existing document, but the DATE has changed, treat as NEW.
        if (currentScreeningId) {
            const formDate = document.getElementById('date')?.value;
            if (window.originalAssessmentDate && formDate && formDate !== window.originalAssessmentDate) {
                console.log(`Date changed from ${window.originalAssessmentDate} to ${formDate}. Saving as NEW.`);
                currentScreeningId = null; // Forces new creation
            }
        }

        if (currentScreeningId) {
            // Update existing
            // Ensure date is updated if changed (though logic above handles date change differently)
            data.testDate = document.getElementById('date')?.value || data.testDate || new Date().toISOString().split('T')[0];
            await setDoc(doc(screeningsRef, currentScreeningId), data, { merge: true });
            console.log("Assessment updated:", currentScreeningId);
        } else {
            // Create new
            data.createdAt = serverTimestamp();
            // Use selected date or default to today
            data.testDate = document.getElementById('date')?.value || new Date().toISOString().split('T')[0];
            const docRef = await addDoc(screeningsRef, data);
            currentScreeningId = docRef.id;
            // Update original date to match current so subsequent saves updates THIS new doc
            window.originalAssessmentDate = data.testDate;
            console.log("New Assessment created:", currentScreeningId);
        }

        // Refresh history list
        loadPatientHistory(currentPatient.id);

        // Show feedback
        // alert('Data sparad!'); // Removing alert for smoother workflow with Save & PDF

        // Show non-blocking feedback
        const feedback = document.createElement('div');
        feedback.textContent = 'Data sparad!';
        feedback.style.position = 'fixed';
        feedback.style.bottom = '20px';
        feedback.style.right = '20px';
        feedback.style.background = 'var(--app-secondary-color)';
        feedback.style.color = 'white';
        feedback.style.padding = '10px 20px';
        feedback.style.borderRadius = '55px';
        feedback.style.zIndex = '9999';
        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 2000);

        return currentScreeningId; // Return ID for chaining

    } catch (e) {
        console.error("Error saving assessment: ", e);
        alert("Ett fel uppstod vid sparning: " + e.message);
        return null;
    }
}

window.saveData = saveData;

// --- PATIENT UI & LOGIC IMPLEMENTATION ---

window.openNewPatientModal = openNewPatientModal;
async function openNewPatientModal(existingPatient = null) {
    const modalContent = document.getElementById('patient-modal-content');
    // Ensure it's a real object with an ID, not a DOM Event or random object
    const isEdit = !!(existingPatient && existingPatient.id);
    const title = isEdit ? 'Edit Client' : 'New Client';
    const btnText = isEdit ? 'Save Changes' : 'Add Client';

    modalContent.innerHTML = `
        <div style="padding: 10px;">
            <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 32px; letter-spacing: -1px; color: #FFFFFF; margin-bottom: 30px; margin-top: 0;">${title}</h3>
            
            <style>
                .minimal-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
                .minimal-form-item { display: flex; flex-direction: column; gap: 8px; }
                .minimal-form-item label { font-family: 'Nimbus Sans', var(--font-main); font-size: 14px; color: #A1A1A3; letter-spacing: 1px; }
                .minimal-form-item input, .minimal-form-item select { 
                    background: rgba(255,255,255,0.05); 
                    border: 1px solid rgba(255, 255, 255, 0.2); 
                    color: #FFFFFF; 
                    padding: 12px 16px; 
                    font-size: 16px; 
                    font-family: 'Nimbus Sans', var(--font-main);
                    border-radius: 0;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .minimal-form-item input:focus, .minimal-form-item select:focus { border-color: #FFFFFF; background: rgba(255,255,255,0.1); }
                .minimal-form-item select option { background: #191C1A; color: #FFFFFF; }
                .minimal-form-grid @media (max-width: 600px) { grid-template-columns: 1fr; }
            </style>

            <div class="minimal-form-grid" id="new-patient-form-container">
                <div class="minimal-form-item" style="grid-column: span 2;"><label>Name / ID</label><input id="p-name" value="${((existingPatient?.firstName || '') + ' ' + (existingPatient?.lastName || '')).trim()}"></div>
                <div class="minimal-form-item"><label>Date of birth</label><input id="p-dob" type="date" value="${existingPatient?.dob || ''}" style="color-scheme: dark;"></div>
                <div class="minimal-form-item"><label>Gender</label>
                    <select id="p-gender">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="minimal-form-item"><label>Sport</label><input id="p-sport" value="${existingPatient?.sport || ''}"></div>
                <div class="minimal-form-item"><label>Injury</label><input id="p-injury" value="${existingPatient?.injury || ''}"></div>
                <div class="minimal-form-item"><label>Injured Side</label>
                    <select id="p-injured-side">
                        <option value="Right">Right</option>
                        <option value="Left">Left</option>
                        <option value="None">None</option>
                    </select>
                </div>
                 <div class="minimal-form-item" style="grid-column: span 2;"><label>Bodyweight (kg)</label><input id="p-bodyweight" type="number" step="0.1" value="${existingPatient?.bodyweight || ''}"></div>
                 <div class="minimal-form-item" style="grid-column: span 2;"><label>Patient Email <span style="color:rgba(133,255,182,0.7);font-size:10px;margin-left:6px;letter-spacing:1px;">USED FOR SHARING</span></label><input id="p-email" type="email" placeholder="patient@email.com" value="${existingPatient?.email || ''}"></div>
            </div>

            <div style="display: flex; gap: 16px; justify-content: flex-end;">
                <button type="button" id="cancel-new-patient" style="box-sizing: border-box; display: flex; justify-content: center; align-items: center; padding: 16px 32px; height: 56px; background: rgba(255, 255, 255, 0.1); border: none; cursor: pointer; transition: all 0.3s ease; font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; color: #FFFFFF; letter-spacing: 1px; outline: none;" onmouseover="this.style.background='rgba(255,255,255,0.2)';" onmouseout="this.style.background='rgba(255,255,255,0.1)';">Cancel</button>
                <button type="button" id="btn-create-patient-action" style="box-sizing: border-box; display: flex; justify-content: center; align-items: center; padding: 16px 32px; height: 56px; background: rgba(255, 255, 255, 0.2); border: 1px solid #FFFFFF; cursor: pointer; transition: all 0.3s ease; font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; color: #FFFFFF; letter-spacing: 1px; outline: none;" onmouseover="this.style.background='rgba(255,255,255,0.3)';" onmouseout="this.style.background='rgba(255,255,255,0.2)';">${btnText}</button>
            </div>
        </div>
    `;

    // Set Select Defaults
    if (existingPatient) {
        if (existingPatient.gender) document.getElementById('p-gender').value = existingPatient.gender;
        if (existingPatient.injuredSide) document.getElementById('p-injured-side').value = existingPatient.injuredSide;
    }

    document.getElementById('patient-modal-overlay').style.display = 'flex';

    document.getElementById('cancel-new-patient').onclick = () => {
        document.getElementById('patient-modal-overlay').style.display = 'none';
    };

    document.getElementById('btn-create-patient-action').onclick = async () => {
        const btn = document.getElementById('btn-create-patient-action');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        const nameInput = document.getElementById('p-name')?.value.trim() || 'Unknown';
        const nameParts = nameInput.split(' ');

        const patientData = {
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ') || '',
            internalId: nameInput || `Gen-${Date.now()}`,
            dob: document.getElementById('p-dob').value,
            age: document.getElementById('p-dob').value ? new Date().getFullYear() - new Date(document.getElementById('p-dob').value).getFullYear() : 0,
            gender: document.getElementById('p-gender').value,
            sport: document.getElementById('p-sport').value,
            injury: document.getElementById('p-injury').value,
            injuredSide: document.getElementById('p-injured-side').value,
            bodyweight: parseFloat(document.getElementById('p-bodyweight').value) || 0,
            email: (document.getElementById('p-email')?.value || '').trim().toLowerCase(),
            updatedAt: serverTimestamp()
        };

        if (isEdit) {
            patientData.userId = existingPatient.userId; // Keep original owner
            // Update
            try {
                await updateDoc(doc(db, "users", auth.currentUser.uid, "patients", existingPatient.id), patientData);
                console.log('Client updated!');

                // Update local object and UI
                currentPatient = { ...currentPatient, ...patientData };
                renderPatientCard(currentPatient);
                document.getElementById('patient-modal-overlay').style.display = 'none';

            } catch (e) {
                console.error("Update failed", e);
                alert("Kunde inte uppdatera: " + e.message);
            } finally {
                btn.disabled = false;
                btn.textContent = btnText;
            }
        } else {
            // Create New
            patientData.createdBy = auth.currentUser.uid;
            patientData.userId = auth.currentUser.uid;
            patientData.createdAt = serverTimestamp();
            await createNewPatient(patientData);
            btn.disabled = false;
            btn.textContent = btnText;
        }
    };
}

async function createNewPatient(data) {
    console.log("Attempting to create patient with data:", data);

    try {
        console.log("Step 1: Check/Create User Doc");
        // Ensure user document exists (required for some Security Rules)
        await setDoc(doc(db, "users", auth.currentUser.uid), {
            email: auth.currentUser.email,
            lastLogin: serverTimestamp()
        }, { merge: true });
        console.log("Step 1: Success.");
    } catch (e) {
        console.warn("Step 1 Failed (Non-fatal?):", e);
    }

    try {
        console.log("Step 2: Create Patient Doc");

        // Strict Data Sanitization
        const cleanData = {
            firstName: String(data.firstName || ''),
            lastName: String(data.lastName || ''),
            dob: String(data.dob || ''),
            age: Number(data.age) || 0,
            gender: String(data.gender || 'Annat'),
            sport: String(data.sport || ''),
            injury: String(data.injury || ''),
            injuredSide: String(data.injuredSide || 'Right'), // Changed default
            bodyweight: Number(data.bodyweight) || 0,
            internalId: String(data.internalId || ''),
            createdBy: String(auth.currentUser.uid),
            userId: String(auth.currentUser.uid),
            createdAt: serverTimestamp(),
            // Adding a simple string date as extra safety
            registeredDate: new Date().toISOString().split('T')[0]
        };

        const docRef = await addDoc(collection(db, "users", auth.currentUser.uid, "patients"), cleanData);
        console.log("Step 2: Success. ID:", docRef.id);

        cleanData.id = docRef.id;
        selectPatient(cleanData);
        document.getElementById('patient-modal-overlay').style.display = 'none';

        // Clear search input if open
        const searchInputModal = document.getElementById('patient-search-input-modal');
        const searchInputInline = document.getElementById('patient-search-input-inline');
        if (searchInputModal) searchInputModal.value = '';
        if (searchInputInline) searchInputInline.value = '';

        // Clear search lists
        const searchResultsModal = document.getElementById('search-results-list-modal');
        const searchResultsInline = document.getElementById('search-results-list-inline');
        if (searchResultsModal) searchResultsModal.innerHTML = '';
        if (searchResultsInline) searchResultsInline.innerHTML = '';

    } catch (e) {
        console.error("Error creating patient: ", e);
        alert(`Kunde inte skapa patient: ${e.message}`);
    }
}

async function searchPatients_OLD(term) {
    const list = document.getElementById('search-results-list');

    if (!list) return;

    list.innerHTML = 'Söker...';

    const q = query(collection(db, "users", auth.currentUser.uid, "patients"));
    try {
        const querySnapshot = await getDocs(q);
        list.innerHTML = '';
        const searchLower = term.toLowerCase();

        let found = 0;
        querySnapshot.forEach((doc) => {
            const p = doc.data();
            p.id = doc.id;
            const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
            const internalId = (p.internalId || '').toString().toLowerCase();

            if (fullName.includes(searchLower) || internalId.includes(searchLower)) {
                found++;
                const btn = document.createElement('button');
                btn.className = 'patient-search-result-item';

                btn.innerHTML = `
                    <strong>${p.firstName} ${p.lastName}</strong>
                    <span class="meta-info">ID: ${p.internalId || '-'}</span>
                `;
                btn.onclick = () => selectPatient(p);
                list.appendChild(btn);
            }
        });

        if (found === 0) list.innerHTML = '<div style="padding:10px; color:rgba(255,255,255,0.6);">Inga patienter hittades.</div>';
    } catch (e) {
        console.error("Error searching: ", e);
        list.innerHTML = '<div style="padding:10px; color:rgba(255,100,100,0.8);">Fel vid sökning (kontrollera konsol).</div>';
    }
}

// --- HELPER: RESET FORM STATE ---
function resetFormState() {
    // 1. Clear text/number inputs
    document.querySelectorAll('#input-form input[type="text"], #input-form input[type="number"], #input-form textarea').forEach(input => {
        input.value = '';
    });

    // 2. Reset Test Selections (Select All by Default)
    // First, unselect everything to be safe
    document.querySelectorAll('.test-selector-btn').forEach(btn => {
        btn.dataset.selected = 'false'; // Will be set to true immediately after for default behavior
    });
    // Then select all (default state) or let populateFormFromData handle it? 
    // "Default state" for a new patient often implies all tests available OR none. 
    // Based on previous code: renderTestSelection sets all to true.
    document.querySelectorAll('.test-selector-btn').forEach(btn => {
        btn.dataset.selected = 'true';
    });

    // 3. Show all sections
    document.querySelectorAll('.test-section').forEach(section => {
        section.style.display = '';
    });

    // 4. Reset Radio Buttons (e.g. Dominance)
    const domTypes = document.querySelectorAll('input[name="dominance_type"]');
    if (domTypes.length > 0) domTypes[0].checked = true; // Default to first

    // 5. Clear Manual Data Defaults if any (already handled by clearing inputs)

    // 6. Update Preview to clear it effectively
    updatePreview();
}

function selectPatient(patient) {
    console.log("selectPatient: Called with:", patient);
    if (!patient || !patient.id) {
        console.error("selectPatient: Missing patient ID!", patient);
        return;
    }

    // Optional: Check if already selected to avoid redundant loads, 
    // but user says it "doesn't work" so maybe we WANT a reload.
    // if (currentPatient && currentPatient.id === patient.id) return;

    currentPatient = patient;
    currentScreeningId = null; // New session/screening context

    // UI Updates
    const searchModal = document.getElementById('search-modal-overlay');
    if (searchModal) searchModal.style.display = 'none';

    // Hide search inline container if open
    const inlineContainer = document.getElementById('existing-patient-search-container');
    if (inlineContainer) inlineContainer.style.display = 'none';

    // NEW GRID LAYOUT: Show the main dashboard wrapper
    const dashboardWrapper = document.getElementById('active-patient-dashboard');
    if (dashboardWrapper) {
        dashboardWrapper.style.display = 'block';

        // Fix: Do not show main-content-forms here, switchView will handle it!

        // Ensure protocol selector container is visible
        const testSelContainer = document.getElementById('test-selection-container');
        if (testSelContainer) testSelContainer.style.display = 'block';
    } else {
        // Fallback for safety/partial migrations
        console.warn('Dashboard wrapper not found, falling back to legacy display logic');
        const overviewSection = document.getElementById('patient-overview-section');
        if (overviewSection) overviewSection.style.display = 'flex';
    }

    // Update Card
    renderPatientCard(patient);

    // RESET FORM STATE COMPLETE
    resetFormState();

    // Form Pre-fill
    // Update personalia fields based on patient data
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('name', `${patient.firstName} ${patient.lastName}`);
    setVal('sport', patient.sport);
    setVal('date', new Date().toISOString().split('T')[0]);
    // For now keep default or logic if we added it to patient model.

    // Load History
    try {
        loadPatientHistory(patient.id);
    } catch (e) {
        console.error("selectPatient: Failed to load history", e);
    }

    // Force reload of protocols to ensure they are visible
    console.log("selectPatient: Reloading protocol selector...");
    loadAndRenderProtocolSelector();

    // SAVE STATE IMMEDIATELY so it persists on refresh
    saveDraft();

    // Switch view to patient overview
    window.switchView('view-overview');

    // Update Header
    updateGlobalHeader(patient);
}

// --- NEW GLOBAL HEADER UPDATER ---
window.updateGlobalHeader = function (patient) {
    const bUnlinked = document.getElementById('badge-unlinked');
    const bLinked = document.getElementById('badge-linked');
    const badgeId = document.getElementById('badge-client-id');

    if (patient) {
        if (bUnlinked) bUnlinked.style.display = 'none';
        if (bLinked) bLinked.style.display = 'flex';
        if (badgeId) {
            let displayName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
            if (!displayName) displayName = 'Anonymous';
            badgeId.textContent = `${displayName}`;
        }
    } else {
        if (bUnlinked) bUnlinked.style.display = 'flex';
        if (bLinked) bLinked.style.display = 'none';
        if (badgeId) badgeId.textContent = '';
    }
}

// --- NEW DROPDOWN CONTROLS ---
window.toggleHeaderDropdown = function () {
    const dropdown = document.getElementById('header-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
    }
}

window.unlinkCurrentClient = function () {
    currentPatient = null;
    currentScreeningId = null;
    window.updateGlobalHeader(null);

    const dropdown = document.getElementById('header-dropdown');
    if (dropdown) dropdown.style.display = 'none';

    saveDraft();
}

function renderPatientCard(patient) {
    const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt || '-';
    };

    setTxt('card-patient-name', `${patient.firstName} ${patient.lastName}`.trim());
    setTxt('card-patient-email', patient.email || patient.internalId || 'No email registered');

    const injured = patient.injuredSide || 'None';
    setTxt('card-patient-injured', injured);

    setTxt('card-patient-sessions', patient.sessionCount || 0);

    setTxt('card-patient-sport', patient.sport || '-');
    setTxt('card-patient-gender', patient.gender || '-');
    setTxt('card-patient-bw', patient.bodyweight ? `${patient.bodyweight} kg` : '-');
    setTxt('card-patient-dob', patient.dob || '-');

    const editIcon = document.getElementById('edit-patient-icon');
    if (editIcon) {
        editIcon.onclick = () => {
            if (window.openNewPatientModal) {
                window.openNewPatientModal(patient);
            }
        };
    }

    const injuredEl = document.getElementById('card-patient-injured-side');
    if (injuredEl) {
        injuredEl.textContent = patient.injuredSide || '-';
        injuredEl.dataset.side = patient.injuredSide || 'Ingen';
    }
}


async function loadPatientHistory(patientId) {
    const list = document.getElementById('selected-patient-tests-list');
    if (!list) return;



    list.innerHTML = '<li>Laddar historik...</li>';

    const q = query(
        collection(db, `users/${auth.currentUser.uid}/patients/${patientId}/screenings`)
    );

    try {
        const snapshot = await getDocs(q);
        list.innerHTML = '';

        // Populate exactly how many tests they ran in the Sessions tab
        const sessionCountEl = document.getElementById('card-patient-sessions');
        if (sessionCountEl) sessionCountEl.textContent = snapshot.size;

        if (snapshot.empty) {
            list.innerHTML = '<li style="color:#A1A1A3;">No registered tests.</li>';
            return;
        }

        // Fetch protocols for fallback identification
        const allProtocols = await getProtocols();

        // Client-side sorting to include old docs without updatedAt
        const docs = [];
        snapshot.forEach(docSnap => docs.push({ id: docSnap.id, data: docSnap.data() }));

        docs.sort((a, b) => {
            const getT = (d) => {
                if (d.createdAt && d.createdAt.toDate) return d.createdAt.toDate().getTime();
                if (d.updatedAt && d.updatedAt.toDate) return d.updatedAt.toDate().getTime();
                if (d.testDate) return new Date(d.testDate).getTime();
                return 0;
            };
            return getT(b.data) - getT(a.data);
        });

        const groupedSessions = {};

        docs.forEach(({ id, data }) => {
            let dateDisplay = 'N/A';
            if (data.testDate) dateDisplay = data.testDate;
            else if (data.updatedAt) dateDisplay = data.updatedAt.toDate().toLocaleDateString();

            let nameDisplay = data.protocolName;
            
            let testNames = [];
            if (data.activeTestIds && window.allTests) {
                testNames = data.activeTestIds.map(tid => {
                    const cleanId = tid.replace('custom_', '');
                    const t = window.allTests.find(x => x.id === cleanId || x.id === tid);
                    return t ? t.name : tid;
                });
            }

            if (!nameDisplay && data.activeTestIds) {
                const normalize = (ids) => ids.map(i => i.replace('custom_', '')).sort().join(',');
                const dataIds = normalize(data.activeTestIds);
                const foundProtocol = allProtocols.find(p => normalize(p.testIds) === dataIds);
                if (foundProtocol) nameDisplay = foundProtocol.name;
            }

            if (!nameDisplay && testNames.length === 1) {
                nameDisplay = testNames[0];
            }

            if (!nameDisplay) {
                if (testNames.length > 0) nameDisplay = testNames.length <= 3 ? testNames.join(', ') : `${testNames.length} Tester`;
                else nameDisplay = 'Session';
            }

            if (!groupedSessions[nameDisplay]) groupedSessions[nameDisplay] = [];
            groupedSessions[nameDisplay].push({ id, data, dateDisplay });
        });

        // Render Group Boxes
        Object.keys(groupedSessions).forEach(protocol => {
            const sessions = groupedSessions[protocol];
            const latestSession = sessions[0];
            const count = sessions.length;

            const wrapper = document.createElement('div');
            wrapper.style.cssText = `display: flex; flex-direction: row; gap: 8px; margin-bottom: 2px; align-items: stretch;`;

            const card = document.createElement('div');
            card.style.cssText = `
                flex: 1; display: flex; flex-direction: row; justify-content: space-between; align-items: center;
                padding: 16px 24px; height: 100px;
                background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.9) 100%), rgba(255, 255, 255, 0.05);
                border-top: 2px solid #735B06; position: relative; cursor: pointer;
                box-sizing: border-box; transition: transform 0.2s; border-radius: 0; overflow: hidden;
            `;

            card.onmouseover = () => { card.style.transform = 'scale(1.01)'; };
            card.onmouseout = () => { card.style.transform = 'scale(1)'; };

            card.innerHTML = `
                <div style="position: absolute; width: 150px; height: 150px; right: -50px; top: -50px; background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, rgba(0,0,0,0) 70%); filter: blur(20px); pointer-events: none; z-index: 1;"></div>
                
                <div style="display: flex; flex-direction: column; justify-content: center; z-index: 2; position: relative; gap: 4px;">
                    <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 10px; color: #A1A1A3; letter-spacing: 1px; text-transform: uppercase;">Session History</span>
                    <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF;">${protocol}</span>
                </div>
                
                <div style="display: flex; align-items: center; gap: 16px; z-index: 2; position: relative;">
                    <div style="display: flex; flex-direction: column; text-align: right; justify-content: center; gap: 6px;">
                        <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 11px; color: #A1A1A3;">Latest: ${latestSession.dateDisplay.split(' ')[0]}</span>
                        <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 12px; color: #FFFFFF;">${count} Session${count > 1 ? 's' : ''}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                const data = latestSession.data;
                const id = latestSession.id;
                
                window.isViewingHistory = true;
                window.allHistoricalSessions = sessions.map(s => s.data);
                
                if (sessions.length > 1) {
                    window.previousSessionData = sessions[1].data;
                } else {
                    window.previousSessionData = null;
                }
                
                if (data.isWizardSession) {
                    wizardActiveTests = data.activeTests || data.activeTestIds || [];
                    wizardAttemptsData = data.attempts || {};
                    currentProtocolName = data.protocolName || protocol;

                    let historyKey = Object.keys(PROTOCOL_REGISTRY).find(k => 
                        PROTOCOL_REGISTRY[k].name.toLowerCase() === currentProtocolName.toLowerCase()
                    );
                    window.activeProtocol = historyKey ? PROTOCOL_REGISTRY[historyKey] : null;

                    // Set currentSessionData so Share Results works from history too
                    window.currentSessionData = {
                        id: id, // Critical for preventing patient app duplication
                        patientId: data.patientId || (currentPatient && currentPatient.id) || '',
                        patientName: data.patientName || (currentPatient && `${currentPatient.firstName} ${currentPatient.lastName}`) || '',
                        protocolName: data.protocolName || protocol || 'Return to Play',
                        testDate: data.testDate || data.timestamp || new Date().toISOString(),
                        timestamp: data.testDate || data.timestamp || new Date().toISOString(),
                        isWizardSession: true,
                        attempts: data.attempts || {},
                        activeTests: data.activeTests || data.activeTestIds || [],
                        activeTestIds: data.activeTests || data.activeTestIds || [],
                        totalSymmetry: data.totalSymmetry || 0
                    };

                    window.showSessionResultSummary();
                } else {
                    // Legacy pipeline
                    loadAssessment(id, data);
                    window.switchView('view-home');
                    const formEl = document.getElementById('main-content-forms');
                    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                }
            });

            const editBtn = document.createElement('div');
            editBtn.style.cssText = `
                width: 60px; display: flex; align-items: center; justify-content: center;
                background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.9) 100%), rgba(255, 255, 255, 0.05);
                border-top: 2px solid #85FFB6; cursor: pointer; transition: transform 0.2s;
            `;
            editBtn.onmouseover = () => { editBtn.style.transform = 'scale(1.05)'; editBtn.style.background = 'rgba(255,255,255,0.1)'; };
            editBtn.onmouseout = () => { editBtn.style.transform = 'scale(1)'; editBtn.style.background = 'linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.9) 100%), rgba(255, 255, 255, 0.05)'; };
            editBtn.innerHTML = `<i class="fas fa-pencil-alt" style="color: #85FFB6; font-size: 16px;"></i>`;
            
            editBtn.onclick = (e) => {
                e.stopPropagation();
                window.openSessionEditorModal(protocol, sessions);
            };

            wrapper.appendChild(card);
            wrapper.appendChild(editBtn);
            list.appendChild(wrapper);
        });
    } catch (e) {
        console.error("History error: ", e);
        list.innerHTML = '<li>Kunde inte ladda historik.</li>';
    }
}

async function deleteScreening(patientId, screeningId) {
    try {
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "patients", patientId, "screenings", screeningId));
        // Refresh list
        loadPatientHistory(patientId);
        // If current displayed screening is the one deleted, clear the form? 
        if (currentScreeningId === screeningId) {
            alert('Visat test raderades. Formuläret rensas.');
            // clear form logic or reload page
            // For now just notify
        }
    } catch (e) {
        console.error("Error deleting screening: ", e);
        alert("Kunde inte radera testet: " + e.message);
    }
}

window.openSessionEditorModal = function(protocolName, sessions) {
    const modal = document.getElementById('history-list-modal');
    const title = document.getElementById('hlm-title');
    const list = document.getElementById('hlm-list');
    
    if(!modal || !title || !list) return;
    
    title.textContent = protocolName;
    list.innerHTML = '';
    
    sessions.forEach(sessionObj => {
        const row = document.createElement('div');
        row.style.cssText = `
            display: flex; justify-content: space-between; align-items: center;
            padding: 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 0;
        `;
        
        row.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 16px; color: #FFF;">${sessionObj.dateDisplay}</span>
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="sh-edit-btn" style="background: transparent; border: 1px solid #85FFB6; color: #85FFB6; padding: 6px 12px; cursor: pointer; font-family: 'Nimbus Sans', var(--font-main); font-size: 12px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Edit</button>
                <button class="sh-del-btn" style="background: transparent; border: 1px solid #FF3D3D; color: #FF3D3D; padding: 6px 12px; cursor: pointer; font-family: 'Nimbus Sans', var(--font-main); font-size: 12px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Delete</button>
            </div>
        `;
        
        row.querySelector('.sh-edit-btn').onclick = () => {
            modal.style.display = 'none';
            window.openRawSessionEditor(sessionObj, protocolName);
        };
        
        row.querySelector('.sh-del-btn').onclick = async () => {
            if(confirm("Are you sure you want to permanently delete this session?")) {
                await deleteScreening(currentPatient.id, sessionObj.id);
                modal.style.display = 'none';
            }
        };
        
        list.appendChild(row);
    });
    
    modal.style.display = 'flex';
};

window.openRawSessionEditor = function(sessionObj, protocolName) {
    const modal = document.getElementById('history-raw-editor-modal');
    const subtitle = document.getElementById('hrem-subtitle');
    const list = document.getElementById('hrem-list');
    if(!modal || !subtitle || !list) return;

    window.currentEditingSession = sessionObj;
    subtitle.textContent = `${protocolName} - ${sessionObj.dateDisplay.split(' ')[0]}`;
    list.innerHTML = '';
    
    const data = sessionObj.data;
    if(!data.isWizardSession || !data.activeTests) {
        alert("This is a legacy session and cannot be edited in raw mode.");
        return;
    }
    
    data.activeTests.forEach(tId => {
        const attempts = (data.attempts || {})[tId] || [];
        let L = 0, R = 0;
        if(attempts.length > 0) {
            L = attempts[0].left || 0;
            R = attempts[0].right || 0;
        }

        const testDef = window.allTests ? window.allTests.find(t => t.id === tId) : null;
        const testName = testDef ? testDef.name : tId.toString().replace('custom_', '').replace(/_/g, ' ');

        const block = document.createElement('div');
        block.style.cssText = `display: flex; flex-direction: column; gap: 8px; padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.05);`;
        
        block.innerHTML = `
            <span style="font-size: 16px; color: #FFF; font-weight: 300; text-transform: capitalize;">${testName}</span>
            <div style="display: flex; gap: 16px;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 10px; color: #A1A1A3; text-transform: uppercase; letter-spacing: 1px;">Left</span>
                    <input type="number" data-tid="${tId}" data-side="left" value="${L}" style="width: 100%; padding: 12px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #FFF; font-family: '188 Pixel', 'Courier New', monospace; font-size: 20px; outline: none; box-sizing: border-box;" onfocus="this.style.borderColor='#85FFB6'" onblur="this.style.borderColor='rgba(255,255,255,0.2)'">
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 10px; color: #A1A1A3; text-transform: uppercase; letter-spacing: 1px;">Right</span>
                    <input type="number" data-tid="${tId}" data-side="right" value="${R}" style="width: 100%; padding: 12px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #FFF; font-family: '188 Pixel', 'Courier New', monospace; font-size: 20px; outline: none; box-sizing: border-box;" onfocus="this.style.borderColor='#85FFB6'" onblur="this.style.borderColor='rgba(255,255,255,0.2)'">
                </div>
            </div>
        `;
        list.appendChild(block);
    });
    
    modal.style.display = 'flex';
};

window.saveRawSessionEdits = async function() {
    const list = document.getElementById('hrem-list');
    const inputs = list.querySelectorAll('input[type="number"]');
    if(!window.currentEditingSession || !inputs.length) return;

    const data = window.currentEditingSession.data;
    const screeningId = window.currentEditingSession.id;
    const patientId = currentPatient.id;

    let newAttempts = { ...data.attempts };
    
    data.activeTests.forEach(tId => {
        newAttempts[tId] = [];
    });

    inputs.forEach(inp => {
        const tId = inp.getAttribute('data-tid');
        const side = inp.getAttribute('data-side');
        const val = parseFloat(inp.value) || 0;
        
        if(newAttempts[tId].length === 0) {
            newAttempts[tId].push({ left: 0, right: 0, diff: "N/A", asym: 100, rawAvg: 0 });
        }
        
        if(side === 'left') newAttempts[tId][0].left = val;
        else newAttempts[tId][0].right = val;
    });

    let asymSum = 0;
    let count = 0;
    data.activeTests.forEach(tId => {
        if (!newAttempts[tId] || newAttempts[tId].length === 0) return;
        const att = newAttempts[tId][0];
        const L = parseFloat(att.left) || 0;
        const R = parseFloat(att.right) || 0;
        const min = Math.min(L, R);
        const max = Math.max(L, R);
        
        let sym = 100;
        if(max > 0) {
            sym = Math.max(0, Math.min(100, Math.round((min / max) * 100)));
        }
        if(L===0 && R===0) sym = 100;
        
        att.asym = sym;
        att.rawAvg = (L+R)/2;
        att.diff = Math.abs(L-R);
        
        asymSum += sym;
        count++;
    });

    const totalSym = count > 0 ? Math.round(asymSum / count) : 0;
    data.attempts = newAttempts;
    data.totalSymmetry = totalSym;

    try {
        const docRef = doc(db, "users", auth.currentUser.uid, "patients", patientId, "screenings", screeningId);
        await updateDoc(docRef, {
            attempts: newAttempts,
            totalSymmetry: totalSym,
            updatedAt: serverTimestamp()
        });
        document.getElementById('history-raw-editor-modal').style.display='none';
        
        loadPatientHistory(patientId);
        
    } catch(e) {
        console.error("Error saving raw edits:", e);
        alert("Failed to save changes. Check connection.");
    }
}

function loadAssessment(docId, data) {
    currentScreeningId = docId;
    // Track original date for "Save as New" logic
    window.originalAssessmentDate = data.testDate || data.patientInfo?.date;
    populateFormFromData(data);

    // Feedback
    // alert("Testdata laddad."); 
    // Scroll to form?
    document.getElementById('main-content-forms').scrollIntoView({ behavior: 'smooth' });
}


function updateManualPreview(manualData) {
    const previewContainer = document.getElementById('manual-preview-content');
    if (!previewContainer) return;

    // If manualData not provided (e.g. called from save), fetch it
    if (!manualData) {
        // We need collectDataFromForm but it's defined later or before?
        // It is defined in this file. It depends on hoisting.
        // But wait, if I put this BEFORE collectDataFromForm which is below...
        // Function declarations are hoisted. 
        // But to be safe let's assume manualData is passed or check.
        // Actually, updateManualPreview calls imply it expects data or fetches it.
        // In the legacy code it did: if (!manualData) { const d = collectDataFromForm(); manualData = d.page2.manual; }
        // Let's restore that logic.
        const d = collectDataFromForm();
        manualData = d.page2.manual;
    }

    const srpResult = (manualData.srp.force || 0) - (manualData.srp.tare || 0);
    const mpuResult = (manualData.mpu.force || 0) - (manualData.mpu.tare || 0);

    previewContainer.innerHTML = `
        <div class="manual-preview-box">
            <h4>Static Row Pull</h4>
            <p>Resultat</p>
            <b>${srpResult.toFixed(0)} N</b>
        </div>
        <div class="manual-preview-box">
            <h4>Squat Power to Speed</h4>
            <p>Vikt</p>
            <b>${manualData.spts.kg || 0} kg</b>
        </div>
        <div class="manual-preview-box">
            <h4>Max Press Push Up</h4>
            <p>Resultat</p>
            <b>${mpuResult.toFixed(0)} N</b>
        </div>
        <div class="manual-preview-box">
            <h4>Blaze Pod Challenge</h4>
            <p>Antal träffar</p>
            <b>${manualData.bpc.hits || 0} st</b>
        </div>
    `;

    // Process custom manual tests dynamically
    if (d && d.page2 && d.page2.custom) {
        Object.keys(d.page2.custom).forEach(customId => {
            const customData = d.page2.custom[customId];
            if (customData.active && customData.graphType === 'manual') {
                const title = customData.title || 'Manuell Test';
                const vals = customData.manualValues || [];
                // Look up config for labels, fallback below
                const testDef = window.allTests ? window.allTests.find(t => t.id === customId) : null;
                const labels = testDef?.config?.metricNames || [];

                let boxContent = `
                    <h4 style="margin: 0 0 10px 0; color: var(--app-primary-color); font-size: 15px;">${title}</h4>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                `;

                vals.forEach((val, i) => {
                    const label = labels[i] || `Värde ${i + 1}`;
                    if (val) {
                        boxContent += `
                            <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 4px;">
                                <span style="font-size: 0.85rem; color: var(--dark-gray);">${label}</span>
                                <b style="font-size: 1.2rem; margin-left:10px;">${val}</b>
                            </div>
                        `;
                    }
                });

                boxContent += `</div>`;

                if (vals.some(v => v)) {
                    previewContainer.innerHTML += `
                        <div class="manual-preview-box" style="padding: 15px; background: #fff; box-shadow: var(--subtle-shadow); border: 1px solid var(--medium-gray); display:block; text-align:left;">
                            ${boxContent}
                        </div>
                    `;
                }
            }
        });
    }
}


function collectDataFromForm() {
    const rName = typeof currentProtocolName !== 'undefined' && currentProtocolName ? currentProtocolName : 'Alphatek Report';

    const data = {
        patientInfo: {
            reportName: rName,
            name: document.getElementById('card-patient-name')?.innerText || '',
            internalId: document.getElementById('card-patient-id')?.innerText || '',
            date: document.getElementById('date')?.value || '',
            sportPosition: document.getElementById('card-patient-sport')?.innerText || '',
            createdBy: document.getElementById('createdBy')?.value || '',
            dominantSideType: document.querySelector('input[name="dominance_type"]:checked')?.value,
            dominantSide: document.getElementById('card-patient-injured-side')?.dataset.side || 'Höger',
            injuredSide: document.getElementById('card-patient-injured-side')?.innerText || '',
        },
        page1: {},
        page1: {},
        page2: { strengthTests: {}, manual: {}, custom: {} },
        activeTestIds: [] // Save order for reconstruction
    };

    const sections = document.querySelectorAll('.test-section');
    const typeCounts = {};

    sections.forEach(sec => {
        const type = sec.dataset.testType;
        const index = sec.dataset.instanceIndex; // e.g. "_0"

        data.activeTestIds.push(type);

        // Count for key naming collision resolution
        typeCounts[type] = (typeCounts[type] || 0) + 1;
        const isFirst = typeCounts[type] === 1;

        // Key mapping
        let key = type;
        if (type === 'repeated_bilateral') key = 'repeatedBilateral';
        if (type === 'cmj2ben') key = 'cmj2ben'; // same
        if (type === 'squat') key = 'squatAnalytics';

        // Page 2 mapping
        let p2key = type;
        if (type === 'hipthrust') p2key = 'hipThrust';
        if (type === 'quads') p2key = 'quadriceps';
        if (type === 'staticsquat-handdrag') p2key = 'staticsquatHanddrag';
        if (type === 'staticsquat-hoftrem') p2key = 'staticsquatHoftrem';
        if (type === 'nordic-hamstring') p2key = 'nordicHamstring';
        // hamstring remains hamstring

        // Determined Key Name
        let finalKey = key;
        if (!isFirst) finalKey += `_${typeCounts[type] - 1}`;
        let finalP2Key = p2key;
        if (!isFirst) finalP2Key += `_${typeCounts[type] - 1}`;

        // Helper
        const getNum = (baseId) => parseFloat(document.getElementById(`${baseId}${index}`)?.value) || 0;
        const getText = (baseId) => document.getElementById(`${baseId}${index}`)?.value || '';
        const getAsymmetry = (baseId) => {
            const el = document.getElementById(`${baseId}${index}`);
            return el ? parseFloat(el.dataset.asymmetryValue) || 0 : 0;
        };

        if (type === 'balance') {
            data.page1[finalKey] = {
                leftScore: getNum('p1_g1_va_score'), rightScore: getNum('p1_g1_ho_score'),
                leftDiff: getNum('p1_g1_va_diff'), rightDiff: getNum('p1_g1_ho_diff'),
                comment: getText('comment_balance'), asymmetryPercent: getAsymmetry('asymmetry_balance')
            };
        } else if (type === 'cmj') {
            data.page1[finalKey] = {
                vaJumps: [getNum('p1_g2_va_1'), getNum('p1_g2_va_2'), getNum('p1_g2_va_3')],
                hoJumps: [getNum('p1_g2_ho_1'), getNum('p1_g2_ho_2'), getNum('p1_g2_ho_3')],
                comment: getText('comment_cmj'), asymmetryPercent: getAsymmetry('asymmetry_cmj')
            };
        } else if (type === 'tia') {
            data.page1[finalKey] = {
                leftJump: getNum('p1_g3_va_jump'), rightJump: getNum('p1_g3_ho_jump'),
                leftGct: getNum('p1_g3_va_gct'), rightGct: getNum('p1_g3_ho_gct'),
                comment: getText('comment_tia'), asymmetryPercent: getAsymmetry('asymmetry_tia')
            };
        } else if (type === 'sidehop') {
            data.page1[finalKey] = {
                leftCount: getNum('p1_g4_va_count'), rightCount: getNum('p1_g4_ho_count'),
                comment: getText('comment_sidehop'), asymmetryPercent: getAsymmetry('asymmetry_sidehop')
            };
        } else if (type === 'squat') {
            data.page1[finalKey] = {
                attempt1: getNum('p1_g5_attempt_1'), attempt2: getNum('p1_g5_attempt_2'), attempt3: getNum('p1_g5_attempt_3'),
                comment: getText('comment_squat')
            };
        } else if (type === 'repeated_bilateral') {
            data.page1[finalKey] = {
                avgHeight: getNum('p1_g6_avg_height'), avgGct: getNum('p1_g6_avg_gct'),
                comment: getText('comment_repeated_bilateral')
            };
        } else if (type === 'cmj2ben') {
            data.page1[finalKey] = {
                attempt1: getNum('p1_g7_attempt_1'), attempt2: getNum('p1_g7_attempt_2'), attempt3: getNum('p1_g7_attempt_3'),
                comment: getText('comment_cmj2ben')
            };
        } else if (type === 'manual') {
            // Manual is page2.manual
            data.page2.manual[finalP2Key] = { // Wait, manual nesting.. 
                // If finalP2Key is 'manual' (first), it goes to data.page2.manual.
                // If 'manual_1', it goes to data.page2.manual_1? 
                // Original structure: page2: { manual: { srp: ... } }
                // New structure if multiple manuals:
                // page2: { manual: { srp... }, manual_1: { srp... } } is cleaner.
                // So we need to put it on data.page2 directly?
            };
            // Let's use flexible assignment
            if (isFirst) {
                data.page2.manual = {
                    srp: { tare: getNum('p2_text_srp_tare'), force: getNum('p2_text_srp_force') },
                    spts: { kg: getNum('p2_text_spts_kg') },
                    mpu: { tare: getNum('p2_text_mpu_tare'), force: getNum('p2_text_mpu_force') },
                    bpc: { hits: getNum('p2_text_bpc_hits') }
                };
            } else {
                data.page2[finalP2Key] = { // manual_1
                    srp: { tare: getNum('p2_text_srp_tare'), force: getNum('p2_text_srp_force') },
                    spts: { kg: getNum('p2_text_spts_kg') },
                    mpu: { tare: getNum('p2_text_mpu_tare'), force: getNum('p2_text_mpu_force') },
                    bpc: { hits: getNum('p2_text_bpc_hits') }
                };
            }
        } else if (type.startsWith('custom_')) {
            // Custom Tests data collection
            const customId = type.replace('custom_', '');

            // Look up definition for Graph Type
            // FIX: Use customId (stripped), not type (custom_ID)
            const testDef = window.allTests ? window.allTests.find(t => t.id === customId) : null;
            // Note: type is 'custom_ID'. allTests IDs are 'custom_ID'.

            let customData = { active: true };
            const baseKey = `custom_${customId}`;

            if (testDef) {
                // SAVE METADATA FOR REPORT.HTML
                customData.graphType = testDef.graphType;
                customData.title = testDef.name || testDef.title; // Fix: Use name if title is missing
                customData.config = testDef.config;

                const gType = testDef.graphType;

                if (gType === 'grouped-bar-3') {
                    customData.g1_L = getNum(`${baseKey}_g1_L`); customData.g1_R = getNum(`${baseKey}_g1_R`);
                    customData.g2_L = getNum(`${baseKey}_g2_L`); customData.g2_R = getNum(`${baseKey}_g2_R`);
                    customData.g3_L = getNum(`${baseKey}_g3_L`); customData.g3_R = getNum(`${baseKey}_g3_R`);
                    // Calc Asymmetry from Badge (updated by updatePreview)
                    customData.asymmetryPercent = getAsymmetry(`asymmetry_custom_${customId}`);
                } else if (gType === 'dual-axis') {
                    customData.val1_L = getNum(`${baseKey}_val1_L`); customData.val1_R = getNum(`${baseKey}_val1_R`);
                    customData.val2_L = getNum(`${baseKey}_val2_L`); customData.val2_R = getNum(`${baseKey}_val2_R`);
                    // Calc Asymmetry from Badge
                    customData.asymmetryPercent = getAsymmetry(`asymmetry_custom_${customId}`);
                } else if (gType === 'three-bar') {
                    customData.val_L = getNum(`${baseKey}_val_L`);
                    customData.val_R = getNum(`${baseKey}_val_R`);
                    customData.val_Both = getNum(`${baseKey}_val_Both`);
                    customData.asymmetryPercent = getAsymmetry(`asymmetry_custom_${customId}`);
                } else if (gType === 'donut' || gType === 'single-bars-3') {
                    customData.val1 = getNum(`${baseKey}_val1`);
                    customData.val2 = getNum(`${baseKey}_val2`);
                    customData.val3 = getNum(`${baseKey}_val3`);
                } else if (gType === 'manual') {
                    customData.manualValues = [];
                    const fields = testDef.config.metricNames || [];
                    fields.forEach((_, i) => {
                        customData.manualValues.push(getText(`${baseKey}_manual_${i + 1}`));
                    });
                } else if (gType === 'single-bar' || gType === 'paired-bar') {
                    // single-bar and paired-bar use left/right field naming
                    customData.left = getNum(`${baseKey}_left`);
                    customData.right = getNum(`${baseKey}_right`);
                    customData.asymmetryPercent = getAsymmetry(`asymmetry_custom_${customId}`);
                } else if (gType === 'bilateral') {
                    customData.val1 = getNum(`${baseKey}_val1`);
                    customData.val2 = getNum(`${baseKey}_val2`);
                } else {
                    // Default fallback
                    customData.val1 = getNum(`${baseKey}_val1`);
                }
            } else {
                // Fallback if def missing
                customData.val1 = getNum(`${baseKey}_val1`);
                customData.val2 = getNum(`${baseKey}_val2`);
                customData.title = customId; // Fallback title
                customData.graphType = 'unknown';
            }

            customData.comment = getText(`comment_${baseKey}`); // ID in template: comment_custom_ID{{INDEX}}
            customData.active = true; // CRITICAL: updatePreview() checks for .active flag!
            // Wait, template ID is `comment_custom_${id}{{INDEX}}`. 
            // In Loop: `baseKey` IS `custom_${customId}`.
            // But `getText` adds `index` suffix dynamically?
            // `getText` definition: `document.getElementById(`${id}${index}`)`. 
            // Yes.

            // Ensure path exists
            if (!data.page2.custom) data.page2.custom = {};
            data.page2.custom[customId] = customData;
        } else {
            // Strength Tests
            const stVal = {
                left: getNum(`p2_g${type === 'hipthrust' ? '1' : type === 'quads' ? '2' : type === 'staticsquat-handdrag' ? '3' : type === 'staticsquat-hoftrem' ? '4' : '5'}_va`),
                right: getNum(`p2_g${type === 'hipthrust' ? '1' : type === 'quads' ? '2' : type === 'staticsquat-handdrag' ? '3' : type === 'staticsquat-hoftrem' ? '4' : '5'}_ho`),
                active: true
            };
            if (type === 'hipthrust' || type.includes('squat')) stVal.tva = getNum(`p2_g${type === 'hipthrust' ? '1' : '3'}_tva`);

            if (type === 'hipthrust') {
                stVal.tva = getNum('p2_g1_tva');
                stVal.comment = getText('comment_hipthrust');
                stVal.asymmetryPercent = getAsymmetry('asymmetry_hipthrust');
            } else if (type === 'quads') {
                stVal.comment = getText('comment_quads');
                stVal.asymmetryPercent = getAsymmetry('asymmetry_quads');
            } else if (type === 'staticsquat-handdrag') {
                stVal.both = getNum('p2_g3_tva');
                stVal.comment = getText('comment_squat_pull_handdrag');
                stVal.asymmetryPercent = getAsymmetry('asymmetry_squat_pull_handdrag');
            } else if (type === 'staticsquat-hoftrem') {
                stVal.both = getNum('p2_g4_tva');
                stVal.comment = getText('comment_squat_pull_hoftrem');
                stVal.asymmetryPercent = getAsymmetry('asymmetry_squat_pull_hoftrem');
            } else if (type === 'hamstring') {
                stVal.comment = getText('comment_hamstring');
                stVal.asymmetryPercent = getAsymmetry('asymmetry_hamstring');
            }

            if (type === 'nordic-hamstring') {
                data.page2.strengthTests[finalP2Key] = {
                    attempt1: getNum('p2_g6_attempt_1'), attempt2: getNum('p2_g6_attempt_2'), attempt3: getNum('p2_g6_attempt_3'),
                    comment: getText('comment_nordic_hamstring')
                };
            } else {
                data.page2.strengthTests[finalP2Key] = stVal;
            }
        }
    });

    return data;
}

// ... (populateFormFromData function remains the same, I will assume it's defined above or below but since I'm replacing the end of file I should include it if it was there) ...
// Actually, I am replacing from "document.addEventListener" down in the previous file view, but let's make sure I don't lose the middle parts.
// I will check the file content again to be safe. I see I am replacing logically the persistence parts.

function populateFormFromData(data) {
    if (!data) return;

    // 1. Reconstruct Active Tests List
    let activeTestIds = [];
    if (data.activeTestIds && Array.isArray(data.activeTestIds)) {
        activeTestIds = data.activeTestIds;
    } else {
        // Legacy Data Reconstruction
        // Helper to map keys back to IDs
        const reverseMap = {
            repeatedBilateral: 'repeated_bilateral',
            cmj2ben: 'cmj2ben',
            squatAnalytics: 'squat',
            hipThrust: 'hipthrust',
            quadriceps: 'quads',
            staticsquatHanddrag: 'staticsquat-handdrag',
            staticsquatHoftrem: 'staticsquat-hoftrem',
            nordicHamstring: 'nordic-hamstring'
        };
        const getTestId = (k) => reverseMap[k] || k;

        if (data.page1) {
            Object.keys(data.page1).forEach(key => {
                let baseKey = key.replace(/_\d+$/, '');
                activeTestIds.push(getTestId(baseKey));
            });
        }
        if (data.page2) {
            if (data.page2.strengthTests) {
                Object.keys(data.page2.strengthTests).forEach(key => {
                    let baseKey = key.replace(/_\d+$/, '');
                    activeTestIds.push(getTestId(baseKey));
                });
            }
            if (data.page2.manual) {
                activeTestIds.push('manual');
            }
            // Check for extra manual keys if any (unlikely in legacy but possible)
            Object.keys(data.page2).forEach(key => {
                if (key !== 'strengthTests' && key !== 'manual') {
                    if (key.startsWith('manual')) activeTestIds.push('manual');
                }
            });
        }
    }

    // 2. Render UI
    renderTestSelection(activeTestIds);

    // 3. Populate Values
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = (val === 0 || val === '0') ? '' : val;
    };
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    // We iterate activeTestIds to track suffix counts
    const typeCounts = {};

    activeTestIds.forEach((testId, i) => {
        typeCounts[testId] = (typeCounts[testId] || 0) + 1;
        const indexSuffix = `_${i}`; // Match renderTestSelection logic
        const dataIndex = typeCounts[testId] - 1;

        let dataKeyBase = testId;
        if (testId === 'repeated_bilateral') dataKeyBase = 'repeatedBilateral';
        else if (testId === 'squat') dataKeyBase = 'squatAnalytics';
        else if (testId === 'hipthrust') dataKeyBase = 'hipThrust';
        else if (testId === 'quads') dataKeyBase = 'quadriceps';
        else if (testId === 'staticsquat-handdrag') dataKeyBase = 'staticsquatHanddrag';
        else if (testId === 'staticsquat-hoftrem') dataKeyBase = 'staticsquatHoftrem';
        else if (testId === 'nordic-hamstring') dataKeyBase = 'nordicHamstring';

        let dataKey = dataIndex === 0 ? dataKeyBase : `${dataKeyBase}_${dataIndex}`;

        let testData = null;
        if (data.page1 && data.page1[dataKey]) testData = data.page1[dataKey];
        else if (data.page2 && data.page2.strengthTests && data.page2.strengthTests[dataKey]) testData = data.page2.strengthTests[dataKey];
        else if (data.page2 && (dataKeyBase === 'manual')) {
            if (dataIndex === 0 && data.page2.manual) testData = data.page2.manual;
            else if (data.page2[dataKey]) testData = data.page2[dataKey];
        } else if (data.page2 && data.page2.custom && dataKeyBase.startsWith('custom_')) {
            // FIX: Retrieve custom test data using the stripped ID
            const customId = dataKeyBase.replace('custom_', '');
            // In case dataIndex > 0, we might need a suffix? Custom tests usually single instance in current implementation but generic support:
            // Custom collection uses: data.page2.custom[customId] = customData;
            // It doesn't seem to support multiple instances of the SAME custom test yet in key naming (unlike standard exams).
            // But let's check exact key.
            testData = data.page2.custom[customId];
        }

        if (!testData) return;

        const s = indexSuffix;

        if (testId === 'balance') {
            setVal(`p1_g1_va_score${s}`, testData.leftScore);
            setVal(`p1_g1_ho_score${s}`, testData.rightScore);
            setVal(`p1_g1_va_diff${s}`, testData.leftDiff);
            setVal(`p1_g1_ho_diff${s}`, testData.rightDiff);
            setText(`comment_balance${s}`, testData.comment);
        } else if (testId === 'cmj') {
            if (testData.vaJumps) {
                setVal(`p1_g2_va_1${s}`, testData.vaJumps[0]);
                setVal(`p1_g2_va_2${s}`, testData.vaJumps[1]);
                setVal(`p1_g2_va_3${s}`, testData.vaJumps[2]);
            }
            if (testData.hoJumps) {
                setVal(`p1_g2_ho_1${s}`, testData.hoJumps[0]);
                setVal(`p1_g2_ho_2${s}`, testData.hoJumps[1]);
                setVal(`p1_g2_ho_3${s}`, testData.hoJumps[2]);
            }
            setText(`comment_cmj${s}`, testData.comment);
        } else if (testId === 'tia') {
            setVal(`p1_g3_va_jump${s}`, testData.leftJump);
            setVal(`p1_g3_ho_jump${s}`, testData.rightJump);
            setVal(`p1_g3_va_gct${s}`, testData.leftGct);
            setVal(`p1_g3_ho_gct${s}`, testData.rightGct);
            setText(`comment_tia${s}`, testData.comment);
        } else if (testId === 'sidehop') {
            setVal(`p1_g4_va_count${s}`, testData.leftCount);
            setVal(`p1_g4_ho_count${s}`, testData.rightCount);
            setText(`comment_sidehop${s}`, testData.comment);
        } else if (testId === 'squat') {
            setVal(`p1_g5_attempt_1${s}`, testData.attempt1);
            setVal(`p1_g5_attempt_2${s}`, testData.attempt2);
            setVal(`p1_g5_attempt_3${s}`, testData.attempt3);
            setText(`comment_squat${s}`, testData.comment);
        } else if (testId === 'repeated_bilateral') {
            setVal(`p1_g6_avg_height${s}`, testData.avgHeight);
            setVal(`p1_g6_avg_gct${s}`, testData.avgGct);
            setText(`comment_repeated_bilateral${s}`, testData.comment);
        } else if (testId === 'cmj2ben') {
            setVal(`p1_g7_attempt_1${s}`, testData.attempt1);
            setVal(`p1_g7_attempt_2${s}`, testData.attempt2);
            setVal(`p1_g7_attempt_3${s}`, testData.attempt3);
            setText(`comment_cmj2ben${s}`, testData.comment);
        } else if (['hipthrust', 'quads', 'staticsquat-handdrag', 'staticsquat-hoftrem', 'hamstring'].includes(testId)) {
            const map = {
                hipthrust: 'p2_g1', quads: 'p2_g2', 'staticsquat-handdrag': 'p2_g3',
                'staticsquat-hoftrem': 'p2_g4', hamstring: 'p2_g5'
            };
            const base = map[testId];
            setVal(`${base}_va${s}`, testData.left);
            setVal(`${base}_ho${s}`, testData.right);
            if (testData.tva) setVal(`${base}_tva${s}`, testData.tva);
            if (testData.both) setVal(`${base}_tva${s}`, testData.both);

            let commentId = '';
            if (testId === 'hipthrust') commentId = 'comment_hipthrust';
            else if (testId === 'quads') commentId = 'comment_quads';
            else if (testId === 'staticsquat-handdrag') commentId = 'comment_squat_pull_handdrag';
            else if (testId === 'staticsquat-hoftrem') commentId = 'comment_squat_pull_hoftrem';
            else if (testId === 'hamstring') commentId = 'comment_hamstring';
            setText(`${commentId}${s}`, testData.comment);
        } else if (testId === 'nordic-hamstring') {
            setVal(`p2_g6_attempt_1${s}`, testData.attempt1);
            setVal(`p2_g6_attempt_2${s}`, testData.attempt2);
            setVal(`p2_g6_attempt_3${s}`, testData.attempt3);
            setText(`comment_nordic_hamstring${s}`, testData.comment);
        } else if (testId === 'manual') {
            if (testData.srp) { setVal(`p2_text_srp_tare${s}`, testData.srp.tare); setVal(`p2_text_srp_force${s}`, testData.srp.force); }
            if (testData.spts) { setVal(`p2_text_spts_kg${s}`, testData.spts.kg); }
            if (testData.mpu) { setVal(`p2_text_mpu_tare${s}`, testData.mpu.tare); setVal(`p2_text_mpu_force${s}`, testData.mpu.force); }
            if (testData.bpc) { setVal(`p2_text_bpc_hits${s}`, testData.bpc.hits); }
        } else if (testId.startsWith('custom_') || (testData && testData.active)) {
            // Check if it's a known custom test or we have data for it
            let customId = testId.replace('custom_', '');

            // If data was found in the generic lookup (lines 1744+)
            if (testData) {
                const baseKey = `custom_${customId}`;
                // Helper helper
                const setCVal = (suffix, val) => setVal(`${baseKey}_${suffix}${s}`, val);
                const setCText = (suffix, val) => setText(`${baseKey}_${suffix}${s}`, val);

                if (testData.g1_L !== undefined) { // Grouped Bar 3
                    setCVal('g1_L', testData.g1_L); setCVal('g1_R', testData.g1_R);
                    setCVal('g2_L', testData.g2_L); setCVal('g2_R', testData.g2_R);
                    setCVal('g3_L', testData.g3_L); setCVal('g3_R', testData.g3_R);
                } else if (testData.val1_L !== undefined) { // Dual Axis
                    setCVal('val1_L', testData.val1_L); setCVal('val1_R', testData.val1_R);
                    setCVal('val2_L', testData.val2_L); setCVal('val2_R', testData.val2_R);
                } else if (testData.val_L !== undefined) { // Three Bar
                    setCVal('val_L', testData.val_L);
                    setCVal('val_R', testData.val_R);
                    setCVal('val_Both', testData.val_Both);
                } else if (testData.val1 !== undefined) { // Simple / Donut / Bilateral
                    setCVal('val1', testData.val1);
                    if (testData.val2 !== undefined) setCVal('val2', testData.val2);
                    if (testData.val3 !== undefined) setCVal('val3', testData.val3);
                } else if (testData.left !== undefined) { // Single Bar / Paired
                    setCVal('left', testData.left);
                    setCVal('right', testData.right);
                } else if (testData.manualValues) { // Manual
                    testData.manualValues.forEach((val, i) => {
                        setCText(`manual_${i + 1}`, val);
                    });
                }

                if (testData.comment) setText(`comment_${baseKey}${s}`, testData.comment);
            }
        }

    });

    // Handle Patient Info & Navigation States
    if (data.patientInfo) {
        setVal('date', data.patientInfo.date);
        setVal('createdBy', data.patientInfo.createdBy);
        const domType = data.patientInfo.dominantSideType;
        if (domType) {
            const el = document.querySelector(`input[name="dominance_type"][value="${domType}"]`);
            if (el) el.checked = true;
        }

        const setTextContent = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
        setTextContent('card-patient-name', data.patientInfo.name);
        setTextContent('card-patient-sport', data.patientInfo.sportPosition);
        setTextContent('card-patient-id', data.patientInfo.internalId);
        setTextContent('card-patient-injured-side', data.patientInfo.injuredSide);

        const dashboardWrapper = document.getElementById('active-patient-dashboard');
        if (dashboardWrapper) {
            dashboardWrapper.style.display = 'block';
            if (window.switchView) window.switchView('view-overview');
        }
        const mainForms = document.getElementById('main-content-forms');
        if (mainForms) mainForms.style.display = 'block';
        const choiceContainer = document.getElementById('patient-choice-container');
        if (choiceContainer) choiceContainer.style.display = 'none';
        const searchContainer = document.getElementById('existing-patient-search-container');
        if (searchContainer) searchContainer.style.display = 'none';
    }

    updatePreview();
}


// --- INITIALIZATION ---
// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Index.js: Auth detected, initializing data...");
            if (window.applyCustomLogo) window.applyCustomLogo(user);

            // 0. Fetch Admin Profile
            try {
                const profileSnap = await getDoc(doc(db, 'users', user.uid));
                if (profileSnap.exists()) {
                    const profileData = profileSnap.data();
                    const adminName = profileData.name || user.email.split('@')[0];
                    window.currentAdminProfile = profileData;
                    
                    const badgeName = document.getElementById('admin-profile-name');
                    if (badgeName) badgeName.textContent = adminName;
                }
            } catch(e) { console.error("Index: Failed to load admin profile", e); }

            // 1. Fetch Tests
            try {
                const custom = await getCustomTests();
                window.allTests = [...window.STATIC_TESTS, ...custom];
                console.log("Index: Loaded custom tests, total:", window.allTests.length);
            } catch (e) {
                console.error("Index: Failed to load custom tests", e);
                window.allTests = [...window.STATIC_TESTS];
            }

            // 2. Render UI
            renderTestSelection();

            // 3. Restore Session
            loadDraft();

            // 4. Load Protocols (Ensure visible)
            loadAndRenderProtocolSelector();

        } else {
            console.log("Index.js: No user signed in. Redirecting to login.");
            window.location.href = 'index.html';
        }
    });

    // Output Listeners regarding saving
    const inputForm = document.getElementById('input-form');
    if (inputForm) {
        inputForm.addEventListener('input', (e) => {
            updatePreview();
            // Save Draft to LocalStorage on every input (Debounce logic if needed, but LS is fast)
            // Debounce slightly to avoid spamming
            clearTimeout(window.draftTimeout);
            window.draftTimeout = setTimeout(saveDraft, 500);
        });
    }

    // Explicitly attach Save Data Button Listener
    const sideSaveBtn = document.getElementById('save-data-sidebar-btn');
    if (sideSaveBtn) {
        sideSaveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveData();
        });
    }

    // Modal Control: Admin Profile Overrides
    window.openAdminProfileModal = function() {
        const pData = window.currentAdminProfile || {};
        document.getElementById('edit-profile-email').value = pData.email || auth.currentUser?.email || '';
        document.getElementById('edit-profile-name').value = pData.name || '';
        document.getElementById('edit-profile-role').value = pData.role || '';
        document.getElementById('admin-profile-modal-overlay').style.display = 'flex';
    };

    const saveProfileBtn = document.getElementById('btn-save-profile');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            saveProfileBtn.textContent = "Lagrer...";
            saveProfileBtn.disabled = true;

            try {
                const newName = document.getElementById('edit-profile-name').value.trim();
                const newRole = document.getElementById('edit-profile-role').value.trim();
                
                await updateDoc(doc(db, "users", auth.currentUser.uid), {
                    name: newName,
                    role: newRole
                });
                
                if (!window.currentAdminProfile) window.currentAdminProfile = {};
                window.currentAdminProfile.name = newName;
                window.currentAdminProfile.role = newRole;
                
                const badgeName = document.getElementById('admin-profile-name');
                if (badgeName) badgeName.textContent = newName || auth.currentUser.email.split('@')[0];
                
                document.getElementById('admin-profile-modal-overlay').style.display = 'none';
            } catch(err) {
                console.error("Failed to update profile", err);
                alert("Feil ved lagring av profil.");
            } finally {
                saveProfileBtn.textContent = "Lagre endringer";
                saveProfileBtn.disabled = false;
            }
        });
    }

    // Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                console.log('User signed out.');
                window.location.href = 'index.html';
            }).catch((error) => {
                console.error('Sign out error', error);
            });
        });
    }

    // Patient Buttons
    const btnNewPatient = document.getElementById('btn-new-patient-workspace');
    if (btnNewPatient) {
        btnNewPatient.addEventListener('click', () => {
            console.log('New Patient button clicked');
            openNewPatientModal();
        });
    }

    const btnExistingPatient = document.getElementById('btn-existing-patient-workspace');
    if (btnExistingPatient) {
        btnExistingPatient.addEventListener('click', () => {
            console.log('Existing Patient button clicked');
            const searchModal = document.getElementById('search-modal-overlay');
            if (searchModal) {
                searchModal.style.display = 'flex';
                // Focus search input
                const searchInput = document.getElementById('patient-search-input-modal');
                if (searchInput) {
                    searchInput.value = ''; // Reset input
                    searchInput.focus();
                }

                // Load initial patients
                searchPatients('', 'search-results-list-modal');
            }
        });
    }

    // Modal Search Input Listener
    const searchInputModal = document.getElementById('patient-search-input-modal');
    if (searchInputModal) {
        searchInputModal.addEventListener('input', (e) => {
            searchPatients(e.target.value, 'search-results-list-modal');
        });
    }

    // Modal Close Button Listener
    const closeSearchModalBtn = document.getElementById('close-search-modal');
    const searchModalOverlay = document.getElementById('search-modal-overlay');
    if (closeSearchModalBtn && searchModalOverlay) {
        closeSearchModalBtn.addEventListener('click', () => {
            searchModalOverlay.style.display = 'none';
        });
    }

    // Close on click outside
    if (searchModalOverlay) {
        searchModalOverlay.addEventListener('click', (e) => {
            if (e.target === searchModalOverlay) {
                searchModalOverlay.style.display = 'none';
            }
        });
    }

});





// --- PDF GENERATION ---
document.addEventListener('DOMContentLoaded', () => {
    const pdfBtn = document.getElementById('pdf-preview');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', (e) => {
            try {
                const data = collectDataFromForm();
                if (data) {
                    try {
                        localStorage.setItem('alphatekReportsData', JSON.stringify(data));
                        // Force cache bust for report.html
                        window.open('report.html?v=' + Date.now(), '_blank');
                    } catch (e) {
                        console.error("Storage/Open Error:", e);
                        alert("Kunde inte öppna rapporten: " + e.message);
                    }
                } else {
                    alert("Kunde inte samla in data. Kontrollera att tester är valda.");
                }
            } catch (err) {
                console.error("CRITICAL: collectDataFromForm crashed:", err);
                alert("Ett kritiskt fel uppstod vid datasamling: " + err.message);
            }
        });
    }
});

// --- NEW SEARCH LOGIC (Fixing Empty Results) ---
async function searchPatients_Attempt1(term) {
    const list = document.getElementById('search-results-list');
    if (!list) return;

    list.innerHTML = '<div style="padding:10px; color:rgba(255,255,255,0.6);">Söker...</div>';

    let q;
    // If term is empty or undefined, fetch recent 20 patients
    if (!term || term.trim() === '') {
        q = query(
            collection(db, "users", auth.currentUser.uid, "patients"),
            orderBy("createdAt", "desc"),
            limit(20)
        );
    } else {
        q = query(collection(db, "users", auth.currentUser.uid, "patients"));
    }

    try {
        const querySnapshot = await getDocs(q);
        list.innerHTML = '';
        const searchLower = term ? term.toLowerCase() : '';

        let found = 0;
        querySnapshot.forEach((doc) => {
            const p = doc.data();
            p.id = doc.id;

            const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
            const internalId = (p.internalId || '').toString().toLowerCase();

            if (!term || fullName.includes(searchLower) || internalId.includes(searchLower)) {
                found++;
                const btn = document.createElement('button');
                btn.className = 'patient-search-result-item';

                btn.innerHTML = `
                    <strong>${p.firstName} ${p.lastName}</strong>
                    <span class="meta-info">ID: ${p.internalId || '-'}</span>
                `;
                btn.onclick = () => selectPatient(p);
                list.appendChild(btn);
            }
        });

        if (found === 0) list.innerHTML = '<div style="padding:10px; color:rgba(255,255,255,0.6);">Inga patienter hittades.</div>';
    } catch (e) {
        console.error("Error searching: ", e);
        list.innerHTML = `<div style="padding:10px; color:rgba(255,100,100,0.8);">Fel vid sökning: ${e.message}</div>`;
    }
}

// --- ROBUST SEARCH LOGIC (Attempt 2: Fallback for Index + Dark Text) ---
// --- ROBUST SEARCH LOGIC (Attempt 3: Fetch All + Client Side Logic) ---
async function searchPatients(term, targetListId) {
    // Determine which list to use. If targetListId is provided, use it.
    // Otherwise try to find the visible one.
    let list;
    if (targetListId) {
        list = document.getElementById(targetListId);
    } else {
        // Fallback or default behavior: Try modal first, then inline
        const modalList = document.getElementById('search-results-list-modal');
        const inlineList = document.getElementById('search-results-list-inline');

        // Check visibility (offsetParent is null if display:none)
        if (modalList && modalList.offsetParent !== null) {
            list = modalList;
        } else if (inlineList && inlineList.offsetParent !== null) {
            list = inlineList;
        } else {
            // If neither is strictly visible, default to modal for now as it's the primary use case.
            // If both are null, this will also be null, and the function will return early.
            list = modalList || inlineList;
        }
    }

    if (!list) return;

    // Use dark text for Light Theme visibility
    list.innerHTML = '<div style="padding:10px; color:rgba(255,255,255,0.8);">Laddar alla patienter...</div>';

    try {
        // SIMPLIFIED QUERY: Fetch all patients (or reasonable limit) without orderBy to avoid index issues
        // If the list grows > 100 we might need indexes, but for now this guarantees data visibility
        const q = query(collection(db, "users", auth.currentUser.uid, "patients"), limit(100));

        console.log("Fetching patients with simplified query...");
        const querySnapshot = await getDocs(q);

        list.innerHTML = '';
        const searchLower = term ? term.toLowerCase() : '';
        let patients = [];

        querySnapshot.forEach((doc) => {
            const p = doc.data();
            p.id = doc.id;
            patients.push(p);
        });

        // Client-side Sort: Sort by createdAt desc (if available), else by name
        patients.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA; // Descending
        });

        console.log(`Fetched ${patients.length} patients. Filtering for: "${searchLower}"`);

        let found = 0;
        patients.forEach(p => {
            const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
            const internalId = (p.internalId || '').toString().toLowerCase();

            // Filter
            if (!term || term.trim() === '' || fullName.includes(searchLower) || internalId.includes(searchLower)) {
                found++;
                const btn = document.createElement('div');
                btn.className = 'client-card-glass';
                btn.dataset.patientId = p.id;

                btn.innerHTML = `
                    <div class="client-name">${p.firstName} ${p.lastName}</div>
                    <div class="client-sub">ID: ${p.internalId || '-'}</div>
                    <div class="client-meta-left">
                        <i class="far fa-clock"></i>
                        <span>${p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div class="client-meta-right">
                        <i class="fas fa-chart-line"></i>
                        <span>${p.sessionCount || 0} Sessions</span>
                    </div>
                `;
                btn.onclick = () => selectPatient(p);
                list.appendChild(btn);
            }
        });

        if (found === 0) {
            list.innerHTML = '<div style="padding:10px; color:rgba(255,255,255,0.8);">Inga patienter hittades.</div>';
        }
    } catch (e) {
        console.error("Critical error searching patients: ", e);
        list.innerHTML = `<div style="padding:10px; color:rgba(255,100,100,1);">Kritisk fel vid hämtning: ${e.message}.<br>Kontrollera konsol.</div>`;
    }
}

// --- SWITCH PATIENT LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const switchPatientBtn = document.getElementById('switch-patient-sidebar-btn');
    if (switchPatientBtn) {
        switchPatientBtn.addEventListener('click', () => {
            // Simple reload to reset state safely
            if (confirm('Är du säker på att du vill byta patient? Osparade ändringar kan gå förlorade.')) {
                window.location.reload();
            }
        });
    }
});

// --- STATE PERSISTENCE ---
function saveDraft() {
    console.log("saveDraft: Saving state...", { hasPatient: !!currentPatient });
    const data = collectDataFromForm();

    const protocolSelect = document.getElementById('protocol-selector');
    const selectedProtocolId = protocolSelect ? protocolSelect.value : null;

    let currentViewId = 'view-home';
    const activeViewEl = document.querySelector('.app-view:not(.hidden-view)');
    if (activeViewEl) currentViewId = activeViewEl.id;

    const wizardState = {
        pendingTests: window.wizardPendingTests || [],
        activeTests: wizardActiveTests || [],
        currentIndex: currentTestIndex || 0,
        attempts: wizardAttemptsData || {},
        view: currentViewId,
        sessionName: currentProtocolName || ''
    };

    const state = {
        patient: currentPatient,
        data: data,
        selectedProtocolId: selectedProtocolId,
        wizard: wizardState
    };
    localStorage.setItem('alphatek_reports_draft', JSON.stringify(state));
    console.log('saveDraft: Draft saved to localStorage', { protocolId: selectedProtocolId, view: currentViewId });
}

function loadDraft() {
    console.log("loadDraft: Attempting to load draft...");
    const draftJson = localStorage.getItem('alphatek_reports_draft');
    if (!draftJson) {
        console.log("loadDraft: No draft found.");
        return;
    }

    try {
        const state = JSON.parse(draftJson);
        console.log("loadDraft: State parsed", state);

        // Restore Patient
        if (state.patient) {
            console.log("loadDraft: Restoring patient", state.patient.firstName);
            selectPatient(state.patient);
        } else {
            console.log("loadDraft: No patient in saved state.");
        }

        // Restore Protocol Selection
        if (state.selectedProtocolId) {
            const protocolSelect = document.getElementById('protocol-selector');
            if (protocolSelect) {
                protocolSelect.value = state.selectedProtocolId;
                protocolSelect.dispatchEvent(new Event('change'));
            }
        }

        // Restore Form Data
        if (state.data) {
            setTimeout(() => {
                populateFormFromData(state.data);
                
                // RESTORE EXACT WIZARD STATE
                if (state.wizard && state.wizard.activeTests && state.wizard.activeTests.length > 0) {
                    window.wizardPendingTests = state.wizard.pendingTests || [];
                    wizardActiveTests = state.wizard.activeTests || [];
                    currentTestIndex = state.wizard.currentIndex || 0;
                    wizardAttemptsData = state.wizard.attempts || {};
                    currentProtocolName = state.wizard.sessionName || '';

                    console.log("loadDraft: Silently restored wizard state to memory for future startWizard usage.");
                }
            }, 500); 
        }
    } catch (e) {
        console.error('Failed to load draft', e);
    }
}

// --- PROTOCOL MANAGEMENT LOGIC ---

// --- PROTOCOL MANAGEMENT LOGIC ---
// Moved to manage_protocols.js and manage_protocols.html



// --- CHART HELPERS ---



// --- MAIN VIEW SELECTOR (UPDATED) ---
async function loadAndRenderProtocolSelector() {
    console.log("loadAndRenderProtocolSelector: Started");
    const container = document.getElementById('protocol-selector');
    const searchInput = document.getElementById('selector-search-input');
    if (!container || !searchInput) return;

    let allProtocols = [];

    try {
        // 2. Fetch Data
        allProtocols = await getProtocols();

        // 3. Render Helpers
        const render = (filterText = '') => {
            container.innerHTML = '';
            const lowerFilter = filterText.toLowerCase();

            let filtered = allProtocols.filter(p => p.name.toLowerCase().includes(lowerFilter));

            // If empty, user requested hardcoded placeholders
            if (filtered.length === 0 && filterText === '') {
                filtered = [
                    { id: 'mock-1', name: 'Return to play', testIds: [] },
                    { id: 'mock-2', name: 'Shoulder screening', testIds: [] },
                    { id: 'mock-3', name: 'Senior fitness test', testIds: [] },
                    { id: 'mock-4', name: 'Run Safer', testIds: [] },
                    { id: 'mock-5', name: 'Rehab Early phase', testIds: [] },
                    { id: 'mock-6', name: 'Rehab Late Phase', testIds: [] }
                ];
            }

            if (filtered.length === 0) {
                container.innerHTML = '<div style="padding:10px; color:#A1A1A3; font-family: var(--font-main);">No sessions found.</div>';
                return;
            }

            filtered.forEach(p => {
                const card = document.createElement('div');
                card.style.cssText = `
                    display: flex; flex-direction: column; justify-content: space-between;
                    padding: 24px; width: 100%; max-width: 377px; height: 240px;
                    background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.9) 100%), rgba(255, 255, 255, 0.05);
                    border-top: 2px solid #735B06; position: relative; cursor: pointer;
                    box-sizing: border-box; transition: transform 0.2s; border-radius: 0;
                `;

                card.onmouseover = () => card.style.transform = 'scale(1.02)';
                card.onmouseout = () => card.style.transform = 'scale(1)';

                card.innerHTML = `
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 12px; color: #A1A1A3; letter-spacing: 1px; text-transform: uppercase;">Session</span>
                            <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 22px; color: #FFFFFF;">${p.name}</span>
                        </div>
                        <i class="far fa-bookmark" style="color: #FFFFFF; font-size: 16px;"></i>
                    </div>
                    <!-- Footer Info -->
                    <div style="display: flex; justify-content: flex-start; align-items: center; gap: 40px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; margin-top: auto;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 12px; color: #A1A1A3;">Time</span>
                            <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 13px; color: #FFFFFF;">≈ 15 min</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 12px; color: #A1A1A3;">Tests</span>
                            <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 13px; color: #FFFFFF;">${p.testIds ? p.testIds.length : 5} Tests</span>
                        </div>
                    </div>
                `;

                card.onclick = () => {
                    currentProtocolName = p.name;
                    window.activeProtocol = getProtocol(p.id) || null;
                    if (!currentPatient) {
                        openSessionLinkModal(p.id, p.testIds || []);
                    } else {
                        setActiveProtocol(p.id, p.testIds || []);
                    }
                };

                container.appendChild(card);
            });
        };

        // 4. Bind Events
        if (searchInput) searchInput.addEventListener('input', (e) => render(e.target.value));

        // 5. Initial Render
        render();

    } catch (e) {
        console.error("Failed to fetch protocols:", e);
        container.innerHTML = '<div style="color:#ff4444; font-family: var(--font-main);">Error loading sessions.</div>';
    }
}



function setActiveProtocol(id, testIds) {
    console.log("Setting active protocol:", id, testIds);
    const allChips = document.querySelectorAll('.protocol-chip');
    allChips.forEach(c => c.classList.remove('active'));

    const activeChip = document.querySelector(`.protocol-chip[data-protocol-id="${id}"]`);
    if (activeChip) activeChip.classList.add('active');

    // Make sure we pass the test IDs correctly
    if (Array.isArray(testIds)) {
        // Transform IDs: add 'custom_' prefix for custom tests
        const transformedIds = testIds.map(id => {
            // Check if this is a custom test by looking it up in allTests
            const testDef = window.allTests ? window.allTests.find(t => t.id === id) : null;
            if (testDef && (testDef.isCustom || testDef.type === 'custom')) {
                return `custom_${id}`;
            }
            return id; // Keep standard test IDs as-is
        });

        console.log("DEBUG: Transformed IDs for rendering:", transformedIds);
        renderTestSelection(transformedIds);

        // --- 1. Populate Intro Screen Meta ---
        const titleEl = document.getElementById('intro-session-title');
        if (titleEl) titleEl.textContent = currentProtocolName || "Session";

        const countTxt = document.getElementById('intro-session-activities');
        if (countTxt) countTxt.textContent = `${testIds.length} Tests`;

        const timeTxt = document.getElementById('intro-session-time');
        const estimatedTime = testIds.length * 3; // Approx 3 mins per test
        if (timeTxt) timeTxt.textContent = `≈ ${estimatedTime} minutes`;

        // --- 2. Populate Step List ---
        const stepsContainer = document.getElementById('intro-steps-container');
        if (stepsContainer) {
            stepsContainer.innerHTML = '';

            let html = `<div style="display: flex; flex-direction: column; gap: 16px;">`;

            testIds.forEach((tId, index) => {
                let testName = tId;
                let testCategory = "General";

                const nameMap = {
                    'max_pull': { name: 'Pull', cat: 'Strength Capacity' },
                    'iso_pull': { name: 'Isometric Pull', cat: 'Strength Capacity' },
                    'sc_push': { name: 'Push', cat: 'Strength Capacity' },
                    'max_push': { name: 'Max Push', cat: 'Strength Capacity' },
                    'iso_push': { name: 'Isometric Push', cat: 'Strength Capacity' },
                    'cmj_jump': { name: 'Jump', cat: 'Explosive Power' },
                    'cmj': { name: 'CMJ', cat: 'Explosive Power' },
                    'sj': { name: 'Squat Jump', cat: 'Explosive Power' },
                    'dj': { name: 'Drop Jump', cat: 'Reactive Strength' },
                    'balance': { name: 'Balance', cat: 'Cognitive Stability' },
                    'balance_left': { name: 'Balance (Left)', cat: 'Cognitive Stability' },
                    'balance_right': { name: 'Balance (Right)', cat: 'Cognitive Stability' },
                    'ash_test': { name: 'ASH Test', cat: 'Shoulder Strength' },
                    'grip': { name: 'Grip', cat: 'Strength Capacity' }
                };

                if (nameMap[tId]) {
                    testName = nameMap[tId].name;
                    testCategory = nameMap[tId].cat;
                } else if (window.allTests) {
                    const testDef = window.allTests.find(t => t.id === tId);
                    if (testDef) {
                        testName = testDef.name || tId;
                        testCategory = testDef.category || testDef.type || "General";
                    }
                }

                if (testName === tId) {
                    // Fallback cleanup: "custom_rtp_maximum_capacity" -> "Maximum Capacity"
                    let cleanCat = testCategory;
                    if (testName.startsWith('custom_rtp_')) {
                        cleanCat = 'Return to Play';
                    }
                    testName = testName.replace(/^custom_rtp_/, '').replace(/^custom_/, '');
                    testName = testName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    testCategory = cleanCat;
                }

                const instData = window.getTestInstructions ? window.getTestInstructions(testName, index) : { explanation: '', protocol: [], metrics: '' };
                let protocolHtml = '';
                (instData.protocol || []).forEach((step, idx) => {
                    protocolHtml += `
                                    <div style="display: flex; flex-direction: row; justify-content: flex-start; align-items: flex-start; gap: 12px; width: 100%;">
                                        <div style="width: 20px; height: 20px; border: 1px solid #FFF; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #FFF; flex-shrink: 0; margin-top: 2px;">${idx + 1}</div>
                                        <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: #FFFFFF;">${step}</span>
                                    </div>
                    `;
                });

                html += `
                        <div style="display: flex; flex-direction: column; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px; padding-top: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: flex-start; gap: 15px;">
                                    <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 22px; color: #A1A1A3; line-height: 22px; margin-top: 2px;">${String(index + 1).padStart(2, '0')}</span>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 22px; color: #FFFFFF;">${testName}</span>
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span onclick="window.toggleTestInstructionDropdown(${index})" style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 12px; color: #A1A1A3; cursor: pointer; text-transform: none; letter-spacing: 1px; padding: 6px 10px; background: rgba(255,255,255,0.05); border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.background='rgba(255,255,255,0.05)';">Instructions</span>
                                    <span onclick="window.toggleClinicalLearnMore(${index})" style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 12px; color: #85FFB6; cursor: pointer; text-transform: none; letter-spacing: 1px; padding: 6px 10px; background: rgba(133,255,182,0.1); border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(133,255,182,0.2)';" onmouseout="this.style.background='rgba(133,255,182,0.1)';">Learn More</span>
                                </div>
                            </div>
                            <!-- Inline Dropdown (Hidden initially) -->
                            <div id="instruction-dropdown-${index}" style="display: none; flex-direction: column; gap: 32px; width: 100%; margin-top: 16px; padding: 72px; box-sizing: border-box; background: rgba(255, 255, 255, 0.15); border: none;">
                                    <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 0; padding: 0; text-transform: uppercase; letter-spacing: 1px;">${instData.subtitle || testName}</h3>
                                    ${instData.videoList ? `<div onclick="const v = this.querySelector('video'); const i = this.querySelector('.vid-btn i'); const btn = this.querySelector('.vid-btn'); if(v.paused){ v.play(); i.className='fas fa-pause'; btn.style.opacity='0'; } else { v.pause(); i.className='fas fa-play'; btn.style.opacity='1'; }" style="position: relative; width: 100%; cursor: pointer;" onmouseenter="if(!this.querySelector('video').paused) this.querySelector('.vid-btn').style.opacity='1';" onmouseleave="if(!this.querySelector('video').paused) this.querySelector('.vid-btn').style.opacity='0';">
                                        <video src="${instData.videoList}" playsinline style="width: 100%; border-radius: 0; border: none; background: transparent; transform: translateZ(0); pointer-events: none;"></video>
                                        <div class="vid-btn" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 64px; height: 64px; background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.2); transition: opacity 0.2s; pointer-events: none;">
                                            <i class="fas fa-play" style="color: #FFF; font-size: 24px; margin-left: 4px;"></i>
                                        </div>
                                        <div class="fullscreen-btn" onclick="event.stopPropagation(); const v = this.parentElement.querySelector('video'); if (v.requestFullscreen) { v.requestFullscreen(); } else if (v.webkitEnterFullscreen) { v.webkitEnterFullscreen(); }" style="position: absolute; bottom: 16px; right: 16px; width: 44px; height: 44px; background: rgba(0,0,0,0.5); border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.2); transition: background 0.2s; z-index: 10;" onmouseover="this.style.background='rgba(0,0,0,0.8)';" onmouseout="this.style.background='rgba(0,0,0,0.5)';">
                                            <i class="fas fa-expand" style="color: #FFF; font-size: 18px;"></i>
                                        </div>
                                    </div>` : ''}
                                        <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Explanation</h3>
                                <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">${instData.explanation}</div>
                                
                                <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 12px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Protocol</h3>
                                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 12px; width: 100%;">
                                    ${protocolHtml}
                                </div>

                                <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 12px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Metrics</h3>
                                <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">${instData.metrics}</div>
                            </div>
                            <!-- Clinical Knowledge Dropdown (Hidden initially) -->
                            <div id="learn-more-dropdown-${index}" style="display: none; flex-direction: column; gap: 32px; width: 100%; margin-top: 16px; padding: 72px; box-sizing: border-box; background: rgba(255, 255, 255, 0.15); border: none;">
                                <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 0; padding: 0; text-transform: uppercase; letter-spacing: 1px;">${instData.subtitle || testName}</h3>
                                ${window.getClinicalCardHtml(index)}
                            </div>
                        </div>
                `;
            });

            html += `</div>`;
            stepsContainer.innerHTML = html;
        }

        window.wizardPendingTests = transformedIds;
        window.switchView('view-session-intro');
    } else {
        console.error("Invalid testIds for protocol:", testIds);
    }
}

window.toggleTestInstructionDropdown = function(index) {
    const dropdown = document.getElementById(`instruction-dropdown-${index}`);
    const learnMore = document.getElementById(`learn-more-dropdown-${index}`);
    if (dropdown) {
        if (dropdown.style.display === 'none') {
            dropdown.style.display = 'flex';
            if (learnMore) learnMore.style.display = 'none';
        } else {
            dropdown.style.display = 'none';
            const vid = dropdown.querySelector('video');
            if (vid && typeof vid.pause === 'function') {
                vid.pause();
                const btn = dropdown.querySelector('.vid-btn');
                if(btn){btn.style.opacity='1'; btn.querySelector('i').className='fas fa-play';}
            }
        }
    }
};

window.toggleClinicalLearnMore = function(index) {
    const dropdown = document.getElementById(`learn-more-dropdown-${index}`);
    const instDrop = document.getElementById(`instruction-dropdown-${index}`);
    if (dropdown) {
        if (dropdown.style.display === 'none') {
            dropdown.style.display = 'flex';
            if (instDrop) {
                instDrop.style.display = 'none';
                const vid = instDrop.querySelector('video');
                if (vid && typeof vid.pause === 'function') {
                    vid.pause();
                    const btn = instDrop.querySelector('.vid-btn');
                    if(btn){btn.style.opacity='1'; btn.querySelector('i').className='fas fa-play';}
                }
            }
        } else {
            dropdown.style.display = 'none';
        }
    }
};

window.toggleResultClinicalLearnMore = function() {
    const dropdown = document.getElementById('result-clinical-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
    }
};

window.getTestInstructions = function(testName, index) {
    const nameLower = (testName || '').toLowerCase();
    
    // Test 4: Lateral Hops
    if (index === 3 || nameLower.includes("lateral") || nameLower.includes("side")) {
        return {
            subtitle: "SL Side To Side Hop",
            unit: "reps",
            videoList: "https://storage.googleapis.com/intro_alphatek/RTP_Videos/RTP_Test4.mov",
            videoWizard: "https://storage.googleapis.com/intro_alphatek/RTP_Videos/RTP_Test4_onlyjump-1.mov",
            explanation: "This test measures lateral explosive power, agility, and endurance. It is designed to evaluate an athlete's ability to perform rapid, explosive side-to-side movements.",
            protocol: [
                "Mark two lines on the ground, spaced approximately 30 cm apart. The athlete starts on one side of the line, balancing on one foot. The athlete begins hopping laterally from one side of the line to the other as quickly as possible for 30 seconds. The test should be performed with maximal effort, ensuring each hop clears the line completely.",
                "Maintain proper form and balance throughout the test to avoid falls or incomplete hops. The system counts all repetitions. The therapist only notes the number of unapproved reps and subtracts them from the total.",
                "Instructions for the Tester: \"Perform lateral hops from side to side as quickly and as many times as possible within the given time frame. Make sure to fully clear the line with each hop and maintain balance to achieve the best score.\""
            ],
            metrics: "Number of Hops"
        };
    }
    
    // Test 3: Reactive Strength Index (10 Hops / Drop Jump)
    if (index === 2 || nameLower.includes("hop") || nameLower.includes("rsi") || nameLower.includes("10") || nameLower.includes("drop") || nameLower.includes("dj") || nameLower.includes("reactive")) {
        return {
            subtitle: "SL Pogo Jump",
            unit: "RSI",
            videoList: "https://storage.googleapis.com/intro_alphatek/RTP_Videos/RTP_Test3.mov",
            videoWizard: "https://storage.googleapis.com/intro_alphatek/RTP_Videos/RTP_Test3_onlyjump-1.mov",
            explanation: "This test measures the athlete's ability to perform rapid, repeated hops on one leg to assess lower-body reactive strength. It specifically focuses on minimizing ground contact time with minimal knee flexion to evaluate the efficiency of the fast stretch-shortening cycle. Ground contact time should be under 0.25 seconds.",
            protocol: [
                "The athlete performs 10 single-leg hops on one limb, aiming to jump as high as possible with minimal ground contact. Each hop should be performed with maximal effort, focusing on quick, explosive movements with minimal knee bend.",
                "Instructions for the Tester: \"Perform 10 single-leg hops as high as possible with minimal ground contact time. Focus on quick, explosive hops with minimal knee flexion. Maximal effort throughout the set.\"",
                "The therapist should repeat the trial if the ground contact time is not below 0.25 seconds.",
                "Repeat the same procedure with the other limb."
            ],
            metrics: "Reactive Strength Index (RSI)"
        };
    }
    
    // Test 2: Accumulated height achieved (CMJ Endurance)
    if (index === 1 || nameLower.includes("accumulated") || nameLower.includes("cmj") || nameLower.includes("endurance")) {
        return {
            subtitle: "SL Repeated Counter Movement Jump",
            unit: "cm",
            videoList: "https://storage.googleapis.com/intro_alphatek/RTP_Videos/RTP_Test2.mov",
            videoWizard: "https://storage.googleapis.com/intro_alphatek/RTP_Videos/RTP_Test2_onlyjump-1.mov",
            explanation: "This test measures jump capabilities over time to assess lower-body power, the efficiency of the slow stretch-shortening cycle and slow RSI, and plyometric endurance. Additionally, it evaluates how fatigue affects jump performance.",
            protocol: [
                "The athlete performs as many single-leg CMJs as possible on one limb within a specified duration or until a set number of jumps is reached. Each jump should be performed with maximal effort, aiming for maximum height. It is very important that the ground contact time stays above 0.5 seconds.",
                "Instructions for the tester: \"Perform CM Jumps as high as possible with minimal ground contact time while ensuring proper CMJ technique (GCT > 0.5). Continue jumping repeatedly without pausing between jumps. Do all the set with maximal effort.\"",
                "Repeat the same procedure with the other limb."
            ],
            metrics: "Accumulated height achieved"
        };
    }
    
    // Test 1: Max Vertical Jump Height
    if (index === 0 || nameLower.includes("jump") || nameLower.includes("pull") || nameLower.includes("push") || nameLower.includes("max") || nameLower.includes("capacity")) {
        return {
            subtitle: "SL Counter Movement Jump",
            unit: "cm",
            videoList: "https://storage.googleapis.com/intro_alphatek/RTP_Videos/RTP_Test1.mov",
            videoWizard: "https://storage.googleapis.com/intro_alphatek/RTP_Videos/RTP_Test1_onlyjump-1.mov",
            explanation: "This test measures maximal plyometrics capabilities to assess lower-body power, slow stretch-shortening cycle capacities.",
            protocol: [
                "Perform 5 repetitions with one limb at maximum effort, with a 5-second break between each. Start from a standing position. Perform a quick downward movement followed by an immediate upward movement to jump as high as possible.",
                "Instructions for the tester: \"Try to jump as high as possible. On the way down, try to quickly bend your knee and then immediately spring upward. After each jump, stabilize yourself before performing the next jump. Repeat this 5 times. Hold your arms on your hips.\"",
                "Repeat the same procedure with the other limb."
            ],
            metrics: "Max Vertical Jump Height"
        };
    }

    // Generic Fallback
    return {
        videoList: null,
        videoWizard: null,
        explanation: "This test measures general physical capacity and performance.",
        protocol: [
            "Have enough space to move freely",
            "Wear comfortable clothing",
            "Please stand in the designated area",
            "Follow all guidelines from the coach"
        ],
        metrics: "N/A"
    };
};

// --- NEW SESSION LINK LOGIC ---
let pendingSessionProtocol = null;
window.openSessionLinkModal = function (protocolId, testIds) {
    pendingSessionProtocol = { id: protocolId, tests: testIds };
    document.getElementById('session-link-modal-overlay').style.display = 'flex';
}

// --- NEW ACTION BAR LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {

    // Header init - now a no-op
    if (window.updateGlobalHeader) window.updateGlobalHeader(currentPatient);

    // Session Link Modal
    const btnChoose = document.getElementById('btn-session-link-choose');
    const btnAnon = document.getElementById('btn-session-link-anonymous');

    if (btnChoose) {
        btnChoose.onclick = () => {
            document.getElementById('session-link-modal-overlay').style.display = 'none';
            window.switchView('view-search');
        };
    }
    if (btnAnon) {
        btnAnon.onclick = () => {
            document.getElementById('session-link-modal-overlay').style.display = 'none';
            currentPatient = null;
            window.updateGlobalHeader(null);
            if (pendingSessionProtocol) {
                setActiveProtocol(pendingSessionProtocol.id, pendingSessionProtocol.tests);
                pendingSessionProtocol = null;
            }
        };
    }

    const btnSavePdf = document.getElementById('btn-save-and-pdf');
    const btnSaveOnly = document.getElementById('btn-save-only');
    const btnPdfOnly = document.getElementById('btn-pdf-only');

    // --- NEW: Saved Comments Logic ---
    const commentsModalOverlay = document.getElementById('comments-modal-overlay');
    const closeCommentsModalBtn = document.getElementById('close-comments-modal');
    const savedCommentsList = document.getElementById('saved-comments-list');
    let currentCommentTargetId = null;

    if (closeCommentsModalBtn && commentsModalOverlay) {
        closeCommentsModalBtn.addEventListener('click', () => {
            commentsModalOverlay.style.display = 'none';
        });
        commentsModalOverlay.addEventListener('click', (e) => {
            if (e.target === commentsModalOverlay) {
                commentsModalOverlay.style.display = 'none';
            }
        });
    }

    const testInputContainerEl = document.getElementById('test-input-container');
    if (testInputContainerEl) {
        testInputContainerEl.addEventListener('click', async (e) => {
            const saveBtn = e.target.closest('.btn-save-comment');
            const loadBtn = e.target.closest('.btn-load-comment');

            if (saveBtn) {
                e.preventDefault();
                const testSection = saveBtn.closest('.test-section');
                if (!testSection) return;
                const testId = testSection.dataset.testType;
                const textarea = testSection.querySelector('textarea');
                if (!textarea) return;

                const text = textarea.value.trim();
                if (!text) {
                    showToast('Skriv en kommentar för att spara', 'error');
                    return;
                }

                try {
                    const userObj = auth.currentUser;
                    if (!userObj) {
                        showToast('Du måste vara inloggad', 'error');
                        return;
                    }
                    const commentsRef = collection(db, 'users', userObj.uid, 'saved_comments');
                    await addDoc(commentsRef, {
                        testId: testId,
                        text: text,
                        createdAt: serverTimestamp()
                    });
                    showToast('Kommentar sparad!', 'success');
                } catch (err) {
                    console.error("Fel vid sparande av kommentar:", err);
                    showToast('Kunde inte spara kommentar', 'error');
                }
            }

            if (loadBtn) {
                e.preventDefault();
                const testSection = loadBtn.closest('.test-section');
                if (!testSection) return;
                const testId = testSection.dataset.testType;
                const textarea = testSection.querySelector('textarea');
                if (!textarea) return;

                currentCommentTargetId = textarea.id;

                try {
                    const userObj = auth.currentUser;
                    if (!userObj) return;

                    const q = query(
                        collection(db, 'users', userObj.uid, 'saved_comments'),
                        where("testId", "==", testId),
                        orderBy("createdAt", "desc")
                    );

                    const snapshot = await getDocs(q);
                    if (!savedCommentsList) return;
                    savedCommentsList.innerHTML = '';

                    if (snapshot.empty) {
                        savedCommentsList.innerHTML = '<li><p style="color:var(--text-color); opacity:0.7;">Inga sparade kommentarer för detta test.</p></li>';
                    } else {
                        snapshot.forEach(docSnap => {
                            const data = docSnap.data();
                            const li = document.createElement('li');
                            li.style.cssText = 'background: rgba(255,255,255,0.05); padding: 10px; margin-bottom: 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 8px; border: 1px solid rgba(255,255,255,0.1);';

                            const p = document.createElement('p');
                            p.textContent = data.text;
                            p.style.cssText = 'color: var(--text-color); font-size: 0.95rem; margin: 0; white-space: pre-wrap;';

                            const actionsObj = document.createElement('div');
                            actionsObj.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

                            const useBtn = document.createElement('button');
                            useBtn.className = 'btn-save glass-button';
                            useBtn.style.padding = '5px 10px';
                            useBtn.textContent = 'Använd';
                            useBtn.onclick = () => {
                                const target = document.getElementById(currentCommentTargetId);
                                if (target) {
                                    target.value = data.text;
                                }
                                commentsModalOverlay.style.display = 'none';
                            };

                            const delBtn = document.createElement('button');
                            delBtn.className = 'btn-delete glass-button-danger';
                            delBtn.style.padding = '5px 10px';
                            delBtn.textContent = 'Radera';
                            delBtn.onclick = async () => {
                                if (confirm('Är du säker på att du vill radera denna kommentar?')) {
                                    try {
                                        await deleteDoc(doc(db, 'users', userObj.uid, 'saved_comments', docSnap.id));
                                        li.remove();
                                        if (savedCommentsList.children.length === 0) {
                                            savedCommentsList.innerHTML = '<li><p style="color:var(--text-color); opacity:0.7;">Inga sparade kommentarer för detta test.</p></li>';
                                        }
                                        showToast('Kommentar raderad', 'success');
                                    } catch (e) {
                                        console.error(e);
                                        showToast('Kunde inte radera', 'error');
                                    }
                                }
                            };

                            actionsObj.appendChild(useBtn);
                            actionsObj.appendChild(delBtn);
                            li.appendChild(p);
                            li.appendChild(actionsObj);
                            savedCommentsList.appendChild(li);
                        });
                    }
                    commentsModalOverlay.style.display = 'flex';
                } catch (err) {
                    console.error("Fel vid hämtning av kommentarer:", err);
                    if (err.message && err.message.includes('index')) {
                        console.warn("Index kreves! Sjekk konsollen for å opprette indexen.");
                        savedCommentsList.innerHTML = `<li><p style="color:#ff6b6b; font-size:0.9rem;">Databasen bygger upp index för kommentarer. Vänligen klicka på länken i utvecklarkonsollen och prova igen om någon minut.</p></li>`;
                        commentsModalOverlay.style.display = 'flex';
                    } else {
                        showToast('Kunde inte ladda kommentarer', 'error');
                    }
                }
            }
        });
    }

    if (btnSavePdf) {
        btnSavePdf.addEventListener('click', async (e) => {
            e.preventDefault();
            // 1. Save
            const savedId = await saveData();
            if (savedId) {
                // 2. Open PDF
                generatePdfPreview();
            }
        });
    }

    if (btnSaveOnly) {
        btnSaveOnly.addEventListener('click', async (e) => {
            e.preventDefault();
            await saveData();
        });
    }

    if (btnPdfOnly) {
        btnPdfOnly.addEventListener('click', (e) => {
            e.preventDefault();
            generatePdfPreview();
        });
    }
});

function generatePdfPreview() {
    try {
        const data = collectDataFromForm();
        if (data) {
            try {
                localStorage.setItem('alphatekReportsData', JSON.stringify(data));
                window.open('report.html?v=' + Date.now(), '_blank');
            } catch (e) {
                console.error("Storage/Open Error:", e);
                alert("Kunde inte öppna rapporten: " + e.message);
            }
        } else {
            alert("Kunde inte samla in data. Kontrollera att tester är valda.");
        }
    } catch (err) {
        console.error("CRITICAL: collectDataFromForm crashed:", err);
        alert("Ett kritiskt fel uppstod vid datasamling: " + err.message);
    }
}

window.showClinicalLearnMore = function(index) {
    const modal = document.getElementById('clinical-learn-more-modal');
    const content = document.getElementById('clinical-modal-content');
    if (modal && content) {
        content.innerHTML = window.getClinicalCardHtml(index);
        modal.classList.remove('hidden-view');
        modal.style.display = 'flex';
    }
};

window.closeClinicalLearnMore = function() {
    const modal = document.getElementById('clinical-learn-more-modal');
    if (modal) {
        modal.classList.add('hidden-view');
        modal.style.display = 'none';
    }
};

window.getClinicalCardHtml = function(index) {
    const cards = [
        `
        <div style="display: flex; flex-direction: column; gap: 32px; width: 100%;">
            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">Maximum explosive force production in a vertical movement utilizing a countermovement. Here we observe the raw ability to recruit motor units rapidly.</div>
            
            <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Indicators of a Low Score</h3>
            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">Inability to generate peak power. Often related to low base strength or sluggish neural drive.</div>
            
            <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 0; text-transform: uppercase; letter-spacing: 1px;">How to Improve</h3>
            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">Heavy base strength (squats/deadlifts) combined with maximum intensity jumps and full rest periods.</div>
        </div>`,
        `
        <div style="display: flex; flex-direction: column; gap: 32px; width: 100%;">
            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">Neuromuscular endurance and control. The test runs for 30 seconds. We look for drift in jump height and loss of stability during landings.</div>
            
            <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Indicators of a Low Score</h3>
            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">Poor utilization of elastic energy over time. Early fatigue leading to dangerous landing mechanics (valgus/stiff knees).</div>
            
            <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 0; text-transform: uppercase; letter-spacing: 1px;">How to Improve</h3>
            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">Eccentric deceleration training, "sticking the landing," and sets of sub-maximal repetitive jumps.</div>
        </div>`,
        `
        <div style="display: flex; flex-direction: column; gap: 32px; width: 100%;">
            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">Ankle stiffness and reactive strength (Fast SSC). This is the underlying "spring" in running and sprinting. GCT should be minimal (< 0.25s) with stiff knees.</div>
            
            <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Indicators of a Low Score</h3>
            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">"Soft ankle" - the foot collapses upon contact. This significantly increases knee loading and drastically reduces speed.</div>
            
            <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 0; text-transform: uppercase; letter-spacing: 1px;">How to Improve</h3>
            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">Isometric calf strength, pogo variations, and drop jumps focusing on the shortest possible ground contact time.</div>
        </div>`,
        `
        <div style="display: flex; flex-direction: column; gap: 32px; width: 100%;">
            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">The ability to control the center of mass during lateral displacement. Highly relevant for ACL rehabilitation and sports involving rapid changes of direction.</div>
            
            <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Indicators of a Low Score</h3>
            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">Unstable landing (knee caves inward) or inability to push off powerfully from a lateral stance.</div>
            
            <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 18px; color: #FFFFFF; margin: 0; text-transform: uppercase; letter-spacing: 1px;">How to Improve</h3>
            <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">Single-leg balance on uneven surfaces, skater bounds, and lateral stability training for the hip complex.</div>
        </div>`
    ];
    return cards[index] || '';
};

window.showProgramGenerator = function() {
    window.switchView('view-generator');

    if (window.activeProtocol && typeof window.activeProtocol.generateProgram === 'function') {
        window.activeProtocol.generateProgram(window.sessionClinicalScores || []);
    } else {
        const output = document.getElementById('program-output');
        const subtitle = document.getElementById('program-subtitle');
        if (subtitle) subtitle.innerHTML = '';
        if (output) output.innerHTML = '<div style="color: #A1A1A3; font-family: var(--font-main); text-align: center; margin-top: 40px; font-size: 16px;">This session does not have a training program module configured.</div>';
        document.getElementById('results-container').style.display = 'block';
    }
};

window.saveAthleteData = function() {
    alert("Clinical profile and program are automatically saved with RTP results in the cloud when you complete the session via 'Share Results'.");
};

