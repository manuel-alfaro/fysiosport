import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, query, getDocs, deleteDoc, updateDoc, doc, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { DEFAULT_CUSTOM_TESTS } from './default_protocols.js';

/**
 * Saves a new custom test to Firestore.
 * @param {object} testConfig - The test configuration object.
 * @returns {Promise<string>} The ID of the saved test.
 */
export async function saveCustomTest(testConfig) {
    if (!auth.currentUser) throw new Error("User not authenticated");

    try {
        const testsRef = collection(db, "users", auth.currentUser.uid, "custom_tests");
        // Ensure standard fields
        const payload = {
            ...testConfig,
            type: 'custom',
            createdAt: serverTimestamp()
        };
        const docRef = await addDoc(testsRef, payload);
        console.log("Custom test saved with ID: ", docRef.id);
        return docRef.id;
    } catch (e) {
        console.error("Error adding custom test: ", e);
        throw e;
    }
}

/**
 * Fetches all custom tests for the current user.
 * @returns {Promise<object[]>} Array of test objects.
 */
export async function getCustomTests() {
    if (!auth.currentUser) return [...DEFAULT_CUSTOM_TESTS];

    try {
        const testsRef = collection(db, "users", auth.currentUser.uid, "custom_tests");
        const q = query(testsRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        const tests = [...DEFAULT_CUSTOM_TESTS];
        querySnapshot.forEach((doc) => {
            tests.push({ id: doc.id, ...doc.data() });
        });
        return tests;
    } catch (e) {
        console.error("Error fetching custom tests: ", e);
        return [];
    }
}

/**
 * Deletes a custom test.
 * @param {string} testId 
 */
export async function deleteCustomTest(testId) {
    if (!auth.currentUser) throw new Error("User not authenticated");
    try {
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "custom_tests", testId));
    } catch (e) {
        console.error("Error deleting custom test: ", e);
        throw e;
    }
}

/**
 * Generates the HTML template string for a custom test.
 * This creates EXACT copies of existing test HTML structures.
 * @param {object} test - The full test object (must include id, config).
 * @returns {string} The HTML template string.
 */
export function generateTemplate(test) {
    const { id, name, config, graphType } = test;

    // Configurable Labels
    const labels = config.inputLabels || config.metricNames || ["Värde 1", "Värde 2", "Värde 3"];
    const l1 = labels[0] || "Värde 1";
    const l2 = labels[1] || "Värde 2";
    const l3 = labels[2] || "Värde 3";
    const unit = config.unit || '';

    // EXACT COPY from TIA template (lines 72-102 in templates.js)
    if (graphType === 'dual-axis') {
        return `
    <div class="test-section" data-test-type="custom_${id}" data-instance-index="{{INDEX}}" data-custom="true">
        <h3 class="test-title">${name} {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>VÄ ${l1}:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="custom_${id}_val1_L{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>VÄ ${l2}:</label>
                        <div class="input-wrapper"><input type="number" step="0.01" id="custom_${id}_val2_L{{INDEX}}"><span class="unit-text">s</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>HÖ ${l1}:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="custom_${id}_val1_R{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>HÖ ${l2}:</label>
                        <div class="input-wrapper"><input type="number" step="0.01" id="custom_${id}_val2_R{{INDEX}}"><span class="unit-text">s</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_custom_${id}{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_custom_${id}{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>${name}</h3>
                <div id="custom-chart-${id}{{INDEX}}" class="js-plotly-plot"></div>
            </div>
        </div>
    </div>`;
    }

    // EXACT COPY from CMJ template (lines 34-70 in templates.js)
    if (graphType === 'grouped-bar-3') {
        return `
    <div class="test-section" data-test-type="custom_${id}" data-instance-index="{{INDEX}}" data-custom="true">
        <h3 class="test-title">${name} {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>VÄ ${l1}:</label>
                        <div class="input-wrapper"><input type="number" id="custom_${id}_g1_L{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>VÄ ${l2}:</label>
                        <div class="input-wrapper"><input type="number" id="custom_${id}_g2_L{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>VÄ ${l3}:</label>
                        <div class="input-wrapper"><input type="number" id="custom_${id}_g3_L{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>HÖ ${l1}:</label>
                        <div class="input-wrapper"><input type="number" id="custom_${id}_g1_R{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>HÖ ${l2}:</label>
                        <div class="input-wrapper"><input type="number" id="custom_${id}_g2_R{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>HÖ ${l3}:</label>
                        <div class="input-wrapper"><input type="number" id="custom_${id}_g3_R{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_custom_${id}{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_custom_${id}{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>${name}</h3>
                <div id="custom-chart-${id}{{INDEX}}" class="js-plotly-plot"></div>
            </div>
        </div>
    </div>`;
    }

    // EXACT COPY from Static Squat Höftrem template (lines 302-330 in templates.js)
    if (graphType === 'three-bar') {
        return `
    <div class="test-section" data-test-type="custom_${id}" data-instance-index="{{INDEX}}" data-custom="true">
        <h3 class="test-title">${name} {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>VÄ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="custom_${id}_val_L{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                    <div class="input-row"><label>HÖ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="custom_${id}_val_R{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>Två ben (Djur):</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="custom_${id}_val_Both{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_custom_${id}{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_custom_${id}{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>${name}</h3>
                <div id="custom-chart-${id}{{INDEX}}" class="js-plotly-plot"></div>
                <div id="overlay-text-custom_${id}{{INDEX}}" class="graph-overlay-text"></div>
            </div>
        </div>
    </div>`;
    }

    // EXACT COPY from Hamstring template (lines 332-356 in templates.js) - for single-bar / paired-bar
    if (graphType === 'single-bar' || graphType === 'paired-bar') {
        return `
    <div class="test-section" data-test-type="custom_${id}" data-instance-index="{{INDEX}}" data-custom="true">
        <h3 class="test-title">${name} {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>VÄ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="custom_${id}_left{{INDEX}}"><span class="unit-text">${unit}</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>HÖ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="custom_${id}_right{{INDEX}}"><span class="unit-text">${unit}</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_custom_${id}{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_custom_${id}{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>${name}</h3>
                <div id="custom-chart-${id}{{INDEX}}" class="js-plotly-plot"></div>
            </div>
        </div>
    </div>`;
    }

    // EXACT COPY from Repeated Bilateral template (lines 161-183 in templates.js)
    if (graphType === 'bilateral') {
        return `
    <div class="test-section" data-test-type="custom_${id}" data-instance-index="{{INDEX}}" data-custom="true">
        <h3 class="test-title">${name} {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>${l1}:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="custom_${id}_val1{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>${l2}:</label>
                        <div class="input-wrapper"><input type="number" step="0.01" id="custom_${id}_val2{{INDEX}}"><span class="unit-text">s</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_custom_${id}{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>${name}</h3>
                <div id="custom-chart-${id}{{INDEX}}" class="js-plotly-plot"></div>
            </div>
        </div>
    </div>`;
    }

    // EXACT COPY from Squat Analytics template (lines 130-159 in templates.js)
    if (graphType === 'donut') {
        return `
    <div class="test-section" data-test-type="custom_${id}" data-instance-index="{{INDEX}}" data-custom="true">
        <h3 class="test-title">${name} {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>${l1}:</label>
                        <div class="input-wrapper"><input type="number" id="custom_${id}_val1{{INDEX}}"><span class="unit-text">%</span></div>
                    </div>
                    <div class="input-row"><label>${l2}:</label>
                        <div class="input-wrapper"><input type="number" id="custom_${id}_val2{{INDEX}}"><span class="unit-text">%</span></div>
                    </div>
                    <div class="input-row"><label>${l3}:</label>
                        <div class="input-wrapper"><input type="number" id="custom_${id}_val3{{INDEX}}"><span class="unit-text">%</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_custom_${id}{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>${name}</h3>
                <div id="donut-container-custom-${id}-{{INDEX}}" style="display:flex; justify-content:center; gap:10px;">
                    <div class="donut-wrapper"><div id="custom-chart-donut-1-${id}{{INDEX}}" class="js-plotly-plot"></div><p class="donut-label">${l1}</p></div>
                    <div class="donut-wrapper"><div id="custom-chart-donut-2-${id}{{INDEX}}" class="js-plotly-plot"></div><p class="donut-label">${l2}</p></div>
                    <div class="donut-wrapper"><div id="custom-chart-donut-3-${id}{{INDEX}}" class="js-plotly-plot"></div><p class="donut-label">${l3}</p></div>
                </div>
            </div>
        </div>
    </div>`;
    }

    // NEW: Bar Gauge template - like Squat Analytics but with bars instead of donuts
    if (graphType === 'bar-gauge' || graphType === 'single-bars-3') {
        return `
    <div class="test-section" data-test-type="custom_${id}" data-instance-index="{{INDEX}}" data-custom="true">
        <h3 class="test-title">${name} {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>${l1}:</label>
                        <div class="input-wrapper"><input type="number" id="custom_${id}_val1{{INDEX}}"><span class="unit-text">${unit}</span></div>
                    </div>
                    <div class="input-row"><label>${l2}:</label>
                        <div class="input-wrapper"><input type="number" id="custom_${id}_val2{{INDEX}}"><span class="unit-text">${unit}</span></div>
                    </div>
                    <div class="input-row"><label>${l3}:</label>
                        <div class="input-wrapper"><input type="number" id="custom_${id}_val3{{INDEX}}"><span class="unit-text">${unit}</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_custom_${id}{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>${name}</h3>
                <div id="custom-chart-${id}{{INDEX}}" class="js-plotly-plot"></div>
            </div>
        </div>
    </div>`;
    }

    // Manual Input (Text Only - No Graph) - Text fields for each metric
    if (graphType === 'manual') {
        // Build field inputs dynamically from metricNames
        const fields = labels.map((label, i) => `
                        <div class="input-row">
                            <label>${label}:</label>
                            <div class="input-wrapper">
                                <input type="text" id="custom_${id}_manual_${i + 1}{{INDEX}}" placeholder="Skriv värde...">
                            </div>
                        </div>`).join('');

        return `
    <div class="test-section" data-test-type="custom_${id}" data-instance-index="{{INDEX}}" data-custom="true">
        <h3 class="test-title">${name} {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column" style="width: 100%;">
                <div class="input-container">
                    ${fields}
                </div>
                <div class="comment-container">
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_custom_${id}{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
        </div>
    </div>`;
    }

    // Fallback for unknown types
    return `
    <div class="test-section" data-test-type="custom_${id}" data-instance-index="{{INDEX}}" data-custom="true">
        <h3 class="test-title">${name} {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <p>Unknown Graph Type: ${graphType}</p>
                </div>
            </div>
        </div>
    </div>`;
}


/**
 * Updates an existing custom test.
 * @param {string} testId 
 * @param {object} testConfig 
 */
export async function updateCustomTest(testId, testConfig) {
    if (!auth.currentUser) throw new Error("User not authenticated");
    try {
        const docRef = doc(db, "users", auth.currentUser.uid, "custom_tests", testId);
        // Ensure standard fields
        const payload = {
            ...testConfig,
            updatedAt: serverTimestamp()
        };
        await updateDoc(docRef, payload);
        console.log("Custom test updated:", testId);
    } catch (e) {
        console.error("Error updating custom test: ", e);
        throw e;
    }

}

