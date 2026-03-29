import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { saveProtocol, getProtocols, deleteProtocol, createProtocol, updateProtocol } from './protocols.js';
import { saveCustomTest, getCustomTests, updateCustomTest } from './custom_tests.js';
import { graphTemplates } from './graph_templates.js';

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
let currentFilterCategory = 'all';
let currentFilterText = '';
let currentSelectedTests = []; // Array of test objects
let availableTests = []; // Combined Static + Custom
let editingTestId = null; // Track if we are editing a custom test
let currentEditingProtocolId = null; // Track if we are editing a protocol
let dragSrcIndex = null; // For drag-and-drop reordering

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Manager: User logged in:", user.uid);
            if (window.applyCustomLogo) window.applyCustomLogo(user);
            await loadAndRenderTests(); // NEW: Fetch custom tests then render
            await renderProtocolList();
            setupManagerListeners();
            initCreateTestModal();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Sidebar Navigation (Basic Links)
    ['save-data-sidebar-btn', 'import-data', 'export-data', 'clear-form', 'pdf-preview'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => window.location.href = 'dashboard.html');
    });
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = 'index.html');
    });
});

function setupManagerListeners() {
    // Save Protocol Button
    const saveBtn = document.getElementById('manager-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            await handleSaveProtocol();
        });
    }

    // Input Enter Key
    const nameInput = document.getElementById('manager-protocol-name');
    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSaveProtocol();
        });
    }

    // Search Input
    const searchInput = document.getElementById('test-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentFilterText = e.target.value.toLowerCase();
            renderTestGrid();
        });
    }

    // Modal Logic: View Protocols
    const viewProtocolsBtn = document.getElementById('view-protocols-btn');
    const protocolsModal = document.getElementById('protocols-modal');
    const closeProtocolsModal = document.getElementById('close-protocols-modal');

    if (viewProtocolsBtn && protocolsModal) {
        viewProtocolsBtn.addEventListener('click', () => {
            protocolsModal.style.display = 'flex';
            renderProtocolList(); // Refresh on open
        });
    }

    if (closeProtocolsModal && protocolsModal) {
        closeProtocolsModal.addEventListener('click', () => {
            protocolsModal.style.display = 'none';
        });
    }

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === protocolsModal) {
            protocolsModal.style.display = 'none';
        }
    });

    // Filter Buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            filterBtns.forEach(b => b.classList.remove('active'));
            filterBtns.forEach(b => b.style.backgroundColor = ''); // Reset inline styles if any
            filterBtns.forEach(b => b.style.color = '');

            // Add active class to clicked
            btn.classList.add('active');

            // Stylistic feedback (manual logic if class styles aren't enough)
            filterBtns.forEach(b => {
                if (b.classList.contains('active')) {
                    b.style.background = 'var(--app-primary-color)';
                    b.style.color = 'white';
                } else {
                    b.style.background = 'white';
                    b.style.color = 'var(--text-color)';
                }
            });

            currentFilterCategory = btn.dataset.category;
            renderTestGrid();
        });

        // Init visual state
        if (btn.dataset.category === 'all') {
            btn.style.background = 'var(--app-primary-color)';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'white';
            btn.style.color = 'var(--text-color)';
        }
    });
}

// --- 1. RENDER TEST LIST (Available Tests) ---

async function loadAndRenderTests() {
    try {
        const custom = await getCustomTests();
        availableTests = [...STATIC_TESTS, ...custom];
        console.log("Manager: Loaded tests", availableTests.length);
        renderTestGrid();
    } catch (e) {
        console.error("Manager: Failed to load custom tests", e);
        availableTests = [...STATIC_TESTS];
        renderTestGrid();
    }
}

function renderTestGrid() {
    const grid = document.getElementById('manager-test-grid-container');
    if (!grid) return;

    grid.innerHTML = '';

    // Filter Logic
    const filtered = availableTests.filter(test => {
        const matchCategory = currentFilterCategory === 'all' || test.category === currentFilterCategory;
        const matchText = test.name.toLowerCase().includes(currentFilterText);
        return matchCategory && matchText;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="text-align:center; opacity:0.5; padding: 20px;">Inga tester matchar.</p>';
        return;
    }

    filtered.forEach(test => {
        const btn = document.createElement('div'); // Using div for better list styling, click handled on icon or whole row
        btn.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            border-radius: var(--border-radius);
            background: var(--box-background-color); /* Grayish background for contrast */
            border: 1px solid var(--medium-gray);
            color: var(--text-color);
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        `;

        let actionsHtml = `<i class="fas fa-plus action-add" style="color: var(--app-primary-color); font-size: 0.9rem; opacity: 0.7;"></i>`;

        if (test.type === 'custom') {
            actionsHtml = `
                 <div style="display:flex; gap:15px; align-items:center;">
                     <i class="fas fa-edit action-edit" style="color: var(--app-primary-color); font-size: 0.9rem; opacity: 0.7;" title="Redigera"></i>
                     <i class="fas fa-trash action-delete" style="color: var(--danger-color); font-size: 0.9rem; opacity: 0.7;" title="Ta bort"></i>
                     ${actionsHtml}
                 </div>
             `;
        }

        btn.innerHTML = `
            <span style="font-weight: 500;">${test.name}</span> 
            ${actionsHtml}
        `;

        // Hover Effect
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-1px)';
            btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
            renderPreview(test); // Updated to pass full test object
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = 'var(--subtle-shadow)';
        });

        // Click to Add
        btn.addEventListener('click', (e) => {
            if (e.target.closest('.action-edit') || e.target.closest('.action-delete')) return;

            addTestToProtocol(test);

            // Visual feedback
            const icon = btn.querySelector('.action-add');
            if (icon) {
                icon.classList.remove('fa-plus');
                icon.classList.add('fa-check');
                setTimeout(() => {
                    icon.classList.remove('fa-check');
                    icon.classList.add('fa-plus');
                }, 600);
            }
        });

        // Click to Edit
        const editBtn = btn.querySelector('.action-edit');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditTestModal(test);
            });
        }

        // Click to Delete
        const deleteBtn = btn.querySelector('.action-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Är du säker på att du vill ta bort testet "${test.name}" permanent?`)) {
                    await deleteCustomTest(test.id);
                }
            });
        }

        grid.appendChild(btn);
    });
}

// New Function to Delete Custom Test
async function deleteCustomTest(testId) {
    try {
        await deleteDoc(doc(db, `users/${auth.currentUser.uid}/custom_tests`, testId));
        // Refresh list
        loadAndRenderTests();
        showToast("Test borttaget", "success");
    } catch (e) {
        console.error("Error deleting test:", e);
        showToast("Kunde inte ta bort test", "error");
    }
}

// --- 2. RENDER SELECTED TESTS (Included List, with drag-and-drop + up/down) ---
function renderSelectedTests() {
    const container = document.getElementById('selected-tests-container');
    if (!container) return;

    container.innerHTML = '';

    if (currentSelectedTests.length === 0) {
        container.innerHTML = '<span style="opacity: 0.5; padding: 20px; font-style: italic; text-align: center;">Ingen tester valgt. Klikk (+) i listen for å legge til.</span>';
        return;
    }

    currentSelectedTests.forEach((test, index) => {
        const chip = document.createElement('div');
        chip.setAttribute('draggable', 'true');
        chip.dataset.index = index;
        chip.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            background: var(--white);
            color: var(--text-color);
            border-radius: var(--border-radius);
            box-shadow: var(--subtle-shadow);
            animation: fadeIn 0.2s ease;
            cursor: grab;
            transition: opacity 0.2s, transform 0.15s;
            border: 2px solid transparent;
        `;

        chip.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-grip-vertical" style="color: var(--medium-gray); font-size: 0.85rem; cursor: grab;"></i>
                <span style="color: var(--app-primary-color); font-weight: 600; font-size: 0.8rem; width: 20px;">${index + 1}.</span>
                <span>${test.name}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <button class="order-up-btn" title="Flytt opp"
                        style="background:none; border:none; cursor:pointer; padding:2px 6px; color:var(--app-primary-color); opacity:${index === 0 ? '0.2' : '0.7'};"
                        ${index === 0 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-up" style="font-size:0.75rem;"></i>
                    </button>
                    <button class="order-down-btn" title="Flytt ned"
                        style="background:none; border:none; cursor:pointer; padding:2px 6px; color:var(--app-primary-color); opacity:${index === currentSelectedTests.length - 1 ? '0.2' : '0.7'};"
                        ${index === currentSelectedTests.length - 1 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-down" style="font-size:0.75rem;"></i>
                    </button>
                </div>
                <i class="fas fa-trash-alt remove-btn" style="cursor: pointer; color: var(--danger-color, #ff6b6b); opacity: 0.6; transition: opacity 0.2s;"></i>
            </div>
        `;

        // Remove
        const removeBtn = chip.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => removeTestFromProtocol(index));
        removeBtn.addEventListener('mouseenter', (e) => e.target.style.opacity = '1');
        removeBtn.addEventListener('mouseleave', (e) => e.target.style.opacity = '0.6');

        // Up/Down buttons
        chip.querySelector('.order-up-btn').addEventListener('click', () => {
            if (index > 0) {
                [currentSelectedTests[index - 1], currentSelectedTests[index]] =
                    [currentSelectedTests[index], currentSelectedTests[index - 1]];
                renderSelectedTests();
            }
        });
        chip.querySelector('.order-down-btn').addEventListener('click', () => {
            if (index < currentSelectedTests.length - 1) {
                [currentSelectedTests[index + 1], currentSelectedTests[index]] =
                    [currentSelectedTests[index], currentSelectedTests[index + 1]];
                renderSelectedTests();
            }
        });

        // Drag-and-drop
        chip.addEventListener('dragstart', (e) => {
            dragSrcIndex = index;
            e.dataTransfer.effectAllowed = 'move';
            chip.style.opacity = '0.4';
        });
        chip.addEventListener('dragend', () => {
            chip.style.opacity = '1';
            container.querySelectorAll('[draggable]').forEach(el => {
                el.style.border = '2px solid transparent';
            });
        });
        chip.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            chip.style.border = '2px solid var(--app-primary-color)';
        });
        chip.addEventListener('dragleave', () => {
            chip.style.border = '2px solid transparent';
        });
        chip.addEventListener('drop', (e) => {
            e.preventDefault();
            chip.style.border = '2px solid transparent';
            const destIndex = parseInt(chip.dataset.index);
            if (dragSrcIndex !== null && dragSrcIndex !== destIndex) {
                const moved = currentSelectedTests.splice(dragSrcIndex, 1)[0];
                currentSelectedTests.splice(destIndex, 0, moved);
                dragSrcIndex = null;
                renderSelectedTests();
            }
        });

        container.appendChild(chip);
    });
}

function addTestToProtocol(test) {
    currentSelectedTests.push(test);
    renderSelectedTests();
}

function removeTestFromProtocol(index) {
    currentSelectedTests.splice(index, 1);
    renderSelectedTests();
}


// --- 3. PREVIEW LOGIC (Real Graph Configs) ---

function renderPreview(test) {
    const plotDiv = document.getElementById('preview-plot');
    const placeholder = document.getElementById('preview-placeholder');
    const titleEl = document.getElementById('preview-test-name');

    if (!plotDiv || !placeholder) return;

    // Show Title
    if (titleEl) {
        titleEl.textContent = test.name;
        titleEl.style.opacity = '1';
    }

    placeholder.style.display = 'none';
    plotDiv.innerHTML = ''; // Clear previous
    plotDiv.style.display = 'block'; // Default block, flex if needed
    plotDiv.style.flex = '1';

    const config = getPreviewConfig(test.id);

    // Overlay Elements
    const overlayImage = document.getElementById('preview-overlay-image');
    const overlayText = document.getElementById('preview-overlay-text');
    if (overlayImage) overlayImage.style.display = 'none';
    if (overlayText) overlayText.style.display = 'none';

    // Animal Overlay Logic for Preview
    if (['hipthrust', 'staticsquat-handdrag', 'staticsquat-hoftrem'].includes(test.id)) {
        const dummyTva = 255;
        updateAnimalOverlay(dummyTva, overlayImage, overlayText);
    }

    const staticConfig = { displayModeBar: false, staticPlot: true, responsive: true };

    // === HANDLE MANUAL TYPE ===
    if (config.type === 'manual') {
        plotDiv.innerHTML = `<div style="text-align:center; padding-top:40px; color:var(--dark-gray); opacity: 0.6;"><i class="fas fa-edit" style="font-size:3rem; margin-bottom:10px;"></i><br>Manuell inmatning av värden</div>`;
        return;
    }

    // === HANDLE DONUT TYPE ===
    if (config.type === 'donut' || config.type === 'donuts') {
        plotDiv.style.display = 'flex';
        plotDiv.style.justifyContent = 'space-around';
        plotDiv.style.alignItems = 'center';
        plotDiv.style.gap = '5px';
        plotDiv.style.padding = '10px';
        plotDiv.style.overflow = 'hidden';

        // Show 3 donuts
        const donutValues = config.data.donutValues || [85, 92, 88];
        donutValues.forEach((val) => {
            const subDiv = document.createElement('div');
            subDiv.style.width = '90px';  // Match report.css donut-wrapper
            subDiv.style.height = '90px'; // Match report.css donut-wrapper
            subDiv.style.display = 'flex';
            subDiv.style.justifyContent = 'center';
            subDiv.style.alignItems = 'center';
            plotDiv.appendChild(subDiv);

            const chart = createSingleDonutChart(val);
            const donutLayout = {
                ...chart.layout,
                width: 90,   // Match report size
                height: 90,  // Match report size
                margin: { t: 0, b: 0, l: 0, r: 0 },
                paper_bgcolor: 'rgba(0,0,0,0)'
            };

            Plotly.newPlot(subDiv, chart.data, donutLayout, { ...staticConfig, responsive: false });
        });
        return;
    }

    console.log("DEBUG: renderPreview called for type:", config.type, "with config:", config);

    // === HANDLE CHART TYPES ===
    let fig;

    if (config.type === 'dual-axis') {
        fig = createDualAxisBarChart(config.data.chartData, config.data);
    } else if (config.type === 'grouped-bar') {
        fig = createGroupedBarChart(config.data.chartData, config.data);
    } else if (config.type === 'single-bar') {
        fig = createSingleMetricBarChart(config.data.chartData, config.data);
    } else if (config.type === 'bilateral') {
        fig = createBilateralDualAxisChart(config.data.chartData, config.data);
    } else if (config.type === 'paired-bar') {
        fig = createPage2CustomBarChart(config.data.chartData, config.data);
    } else if (config.type === 'single-bars-3') {
        console.log("DEBUG: Rendering single-bars-3");
        // Use generic values for preview if not present
        const data = config.data.chartData || { values: [10, 15, 12] };
        try {
            fig = graphTemplates['single-bars-3'].create(data, config.data);
            console.log("DEBUG: single-bars-3 fig created:", fig);
        } catch (e) {
            console.error("DEBUG: Error creating single-bars-3:", e);
        }
    } else if (config.type === 'grouped-bar-3') {
        const data = config.data.chartData || { labels: ['Test 1', 'Test 2', 'Test 3'], vaValues: [10, 12, 11], hoValues: [11, 13, 12] };
        fig = createGroupedBarChart(data, config.data);
    } else if (config.type === 'three-bar') {
        const data = config.data.chartData || { leftVal: 10, rightVal: 12, bothVal: 20 };
        fig = graphTemplates['three-bar'].create(data, config.data);
    } else {
        console.warn(`Unknown chart type: ${config.type}`);
        plotDiv.innerHTML = `<div style="text-align:center; padding-top:40px; color:var(--danger-color);"><i class="fas fa-exclamation-triangle" style="font-size:3rem; margin-bottom:10px;"></i><br>Stöds inte: ${config.type}<br><small>Version: 1.2</small></div>`;
        return;
    }

    // Render with Plotly
    if (fig) {
        Plotly.newPlot(plotDiv, fig.data, fig.layout, staticConfig);
    }
}

function getPreviewConfig(testId) {
    // 1. Check Custom Tests
    const customTest = availableTests.find(t => t.id === testId && t.type === 'custom');
    if (customTest) {
        const { graphType, config } = customTest;

        // Base structure
        let previewConfig = {
            type: graphType,
            data: {
                yAxisTitle: config.yAxisTitle,
                metricNames: config.metricNames || ['Vänster', 'Höger'],
                decimals: config.decimals || 1
            }
        };

        // Add dummy chart data based on graph type
        if (graphType === 'dual-axis') {
            previewConfig.data.chartData = { leftVal1: 100, rightVal1: 110, leftVal2: 0.45, rightVal2: 0.42 };
            previewConfig.data.y1Title = config.metricNames?.[0] || 'Metric 1';
            previewConfig.data.y2Title = config.metricNames?.[1] || 'Metric 2';
        } else if (graphType === 'grouped-bar') {
            previewConfig.data.chartData = {
                labels: ['Försök 1', 'Försök 2', 'Försök 3'],
                vaValues: [20, 22, 21],
                hoValues: [24, 23, 25]
            };
            previewConfig.data.yTitle = config.yAxisTitle;
        } else if (graphType === 'grouped-bar-3') {
            // FIXED: Structure must match createGroupedBarChart expectations
            previewConfig.data.chartData = {
                labels: ['Försök 1', 'Försök 2', 'Försök 3'],
                vaValues: [100, 105, 102],
                hoValues: [110, 112, 115]
            };
            previewConfig.data.yTitle = config.yAxisTitle;
        } else if (graphType === 'single-bars-3') {
            // FIXED: Structure for single-bars-3
            previewConfig.data.chartData = { values: [85, 90, 88] };
            previewConfig.data.labels = config.metricNames || ['1', '2', '3'];
            previewConfig.data.yTitle = config.yAxisTitle;
        } else if (graphType === 'three-bar') {
            // FIXED: Structure for three-bar (Left, Right, Both)
            previewConfig.data.chartData = { leftVal: 100, rightVal: 110, bothVal: 220 };
            previewConfig.data.labels = config.metricNames || ['Vänster', 'Höger', 'Båda'];
            previewConfig.data.yAxisTitle = config.yAxisTitle;
        } else if (graphType === 'single-bar' || graphType === 'paired-bar') {
            previewConfig.data.chartData = { leftVal: 100, rightVal: 110 };
            previewConfig.data.metricName = config.metricNames?.[0] || 'Värde';
        } else if (graphType === 'bilateral') {
            previewConfig.data.chartData = { val1: 24.5, val2: 0.35 };
            previewConfig.data.y1Title = config.metricNames?.[0] || 'Metric 1';
            previewConfig.data.y2Title = config.metricNames?.[1] || 'Metric 2';
        } else if (graphType === 'donut') {
            previewConfig.data.donutValues = [85, 92, 88];
        } else if (graphType === 'manual') {
            // Manual type - no chart data needed
        }

        return previewConfig;
    }

    // 2. Standard Tests Configuration
    switch (testId) {
        case 'balance':
            return {
                type: 'dual-axis',
                data: {
                    chartData: { leftVal1: 85, rightVal1: 82, leftVal2: 2.1, rightVal2: 2.3 },
                    metricNames: ['Score', 'Gj. diff'],
                    y1Title: 'Score',
                    y2Title: 'cm',
                    y1Decimals: 0,
                    y2Decimals: 2
                }
            };

        case 'cmj':
            return {
                type: 'grouped-bar',
                data: {
                    chartData: {
                        labels: ['Hopp 1', 'Hopp 2', 'Hopp 3'],
                        vaValues: [22, 23, 21],
                        hoValues: [24, 25, 24]
                    },
                    yTitle: 'Hopphöjd (cm)'
                }
            };

        case 'tia':
            return {
                type: 'dual-axis',
                data: {
                    chartData: { leftVal1: 18.5, rightVal1: 19.2, leftVal2: 0.45, rightVal2: 0.42 },
                    metricNames: ['Gj. hopp', 'GCT'],
                    y1Title: 'cm',
                    y2Title: 's',
                    y1Decimals: 1,
                    y2Decimals: 2
                }
            };

        case 'sidehop':
            return {
                type: 'single-bar',
                data: {
                    chartData: { leftVal: 45, rightVal: 48 },
                    yAxisTitle: 'Antal (st)',
                    metricName: 'Antal',
                    decimals: 0
                }
            };

        case 'hipthrust':
        case 'quads':
        case 'staticsquat-handdrag':
        case 'staticsquat-hoftrem':
        case 'hamstring':
            return {
                type: 'paired-bar',
                data: {
                    chartData: { leftVal1: 120, rightVal1: 135 },
                    yAxisTitle: testId === 'hamstring' ? 'N' : 'KG',
                    metricNames: ['Kraft'],
                    decimals: 1
                }
            };

        case 'repeated_bilateral':
            return {
                type: 'bilateral',
                data: {
                    chartData: { val1: 24.5, val2: 0.35 },
                    metricNames: ['Gj. hopp', 'Gj. GCT'],
                    y1Title: 'cm',
                    y2Title: 's'
                }
            };

        case 'squat':
        case 'cmj2ben':
        case 'nordic-hamstring':
            return {
                type: 'donut',
                data: {
                    donutValues: [85, 92, 88]
                }
            };

        case 'srp':
        case 'spts':
        case 'mpu':
        case 'bpc':
            return { type: 'manual' };

        default:
            return { type: 'manual' };
    }
}


// --- CHART LIBRARY ---
// Chart functions copied from report.html to ensure exact match

const globalScaleFactor = 0.65;

function hexToRgba(hex, alpha) {
    if (!hex) return 'rgba(0,0,0,1)';
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function createDualAxisBarChart(data, config) {
    const vaColorHex = getCssVar('--va-color');
    const hoColorHex = getCssVar('--ho-color');
    const leftColorRgba = hexToRgba(vaColorHex, 0.8);
    const rightColorRgba = hexToRgba(hoColorHex, 0.8);
    const darkGrayColor = getCssVar('--dark-gray');
    const whiteColor = getCssVar('--white');

    const { leftVal1, rightVal1, leftVal2, rightVal2 } = data;
    const { metricNames, y1Title, y2Title, y1Decimals, y2Decimals } = config;

    const maxY1 = Math.max(leftVal1, rightVal1, 0.1) * 1.25;
    const maxY2 = Math.max(leftVal2, rightVal2, 0.1) * 1.25;
    const barTextFontSize = Math.round(18 * globalScaleFactor);

    const fig = {
        data: [
            { type: 'bar', name: 'VÄ', x: [metricNames[0]], y: [leftVal1], marker: { color: leftColorRgba }, text: [leftVal1.toFixed(y1Decimals)], textposition: 'inside', insidetextanchor: 'middle', textfont: { color: whiteColor, size: barTextFontSize }, hoverinfo: 'name+x+y', yaxis: 'y' },
            { type: 'bar', name: 'HÖ', x: [metricNames[0]], y: [rightVal1], marker: { color: rightColorRgba }, text: [rightVal1.toFixed(y1Decimals)], textposition: 'inside', insidetextanchor: 'middle', textfont: { color: whiteColor, size: barTextFontSize }, hoverinfo: 'name+x+y', yaxis: 'y' },
            { type: 'bar', name: 'VÄ', x: [metricNames[1]], y: [leftVal2], marker: { color: leftColorRgba }, text: [leftVal2.toFixed(y2Decimals)], textposition: 'inside', insidetextanchor: 'middle', textfont: { color: whiteColor, size: barTextFontSize }, hoverinfo: 'name+x+y', yaxis: 'y2', showlegend: false },
            { type: 'bar', name: 'HÖ', x: [metricNames[1]], y: [rightVal2], marker: { color: rightColorRgba }, text: [rightVal2.toFixed(y2Decimals)], textposition: 'inside', insidetextanchor: 'middle', textfont: { color: whiteColor, size: barTextFontSize }, hoverinfo: 'name+x+y', yaxis: 'y2', showlegend: false },
        ],
        layout: {
            height: 200, barmode: 'group',
            font: { color: darkGrayColor, family: 'Avenir, sans-serif', size: Math.round(14 * globalScaleFactor), weight: 400 },
            yaxis: { title: y1Title, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, range: [0, maxY1], showgrid: false, zeroline: false },
            yaxis2: { title: y2Title, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, overlaying: 'y', side: 'right', showgrid: false, zeroline: false, showline: false, range: [0, maxY2] },
            xaxis: { showgrid: false, zeroline: false, showline: false, tickfont: { size: Math.round(14 * globalScaleFactor) }, automargin: true, fixedrange: true, categoryorder: 'array', categoryarray: metricNames },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "center", x: 0.5, font: { size: Math.round(14 * globalScaleFactor) } },
            margin: { l: 50, r: 65, b: 75, t: 35, pad: 5 },
            width: 285, bargap: 0.4, bargroupgap: 0.1
        }
    };
    return fig;
}

function createGroupedBarChart(data, config) {
    const hoColorHex = getCssVar('--ho-color');
    const vaColorHex = getCssVar('--va-color');
    const hoColorRgba = hexToRgba(hoColorHex, 0.8);
    const vaColorRgba = hexToRgba(vaColorHex, 0.8);
    const darkGrayColor = getCssVar('--dark-gray');
    const whiteColor = getCssVar('--white');

    const { labels, vaValues, hoValues } = data;
    const { yTitle } = config;
    const maxYValue = Math.max(...vaValues, ...hoValues, 10) + 10;
    const barTextFontSize = Math.round(18 * globalScaleFactor);

    const fig = {
        data: [
            { type: 'bar', name: 'VÄ', x: labels, y: vaValues, marker: { color: vaColorRgba }, text: vaValues.map(String), textposition: 'inside', insidetextanchor: 'middle', textfont: { color: whiteColor, size: barTextFontSize }, hoverinfo: 'name', hovertemplate: 'VÄ: %{y} cm<extra></extra>' },
            { type: 'bar', name: 'HÖ', x: labels, y: hoValues, marker: { color: hoColorRgba }, text: hoValues.map(String), textposition: 'inside', insidetextanchor: 'middle', textfont: { color: whiteColor, size: barTextFontSize }, hoverinfo: 'name', hovertemplate: 'HÖ: %{y} cm<extra></extra>' }
        ],
        layout: {
            height: 200, barmode: 'group',
            font: { color: darkGrayColor, family: 'Avenir', size: Math.round(14 * globalScaleFactor), weight: 400 },
            yaxis: { title: yTitle, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, range: [0, maxYValue], showgrid: false, zeroline: false },
            xaxis: { showgrid: false, zeroline: false, showline: false, tickfont: { size: Math.round(14 * globalScaleFactor) }, automargin: true, fixedrange: true },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "center", x: 0.5, font: { size: Math.round(14 * globalScaleFactor) } },
            margin: { l: 50, r: 20, b: 75, t: 35, pad: 5 },
            width: 285, bargroupgap: 0.1
        }
    };
    return fig;
}

function createSingleMetricBarChart(data, config) {
    const hoColorHex = getCssVar('--ho-color');
    const vaColorHex = getCssVar('--va-color');
    const hoColorRgba = hexToRgba(hoColorHex, 0.8);
    const vaColorRgba = hexToRgba(vaColorHex, 0.8);
    const darkGrayColor = getCssVar('--dark-gray');
    const whiteColor = getCssVar('--white');

    const { leftVal, rightVal } = data;
    const { yAxisTitle, metricName, decimals } = config;
    const maxYValue = Math.max(leftVal, rightVal, 10) * 1.25;
    const barTextFontSize = Math.round(18 * globalScaleFactor);

    const fig = {
        data: [
            { type: 'bar', name: 'VÄ', x: [' ', metricName, '  '], y: [null, leftVal, null], marker: { color: vaColorRgba }, text: [null, leftVal.toFixed(decimals), null], textposition: 'inside', insidetextanchor: 'middle', textfont: { color: whiteColor, size: barTextFontSize }, hoverinfo: 'name', hovertemplate: 'VÄ: %{y}<extra></extra>' },
            { type: 'bar', name: 'HÖ', x: [' ', metricName, '  '], y: [null, rightVal, null], marker: { color: hoColorRgba }, text: [null, rightVal.toFixed(decimals), null], textposition: 'inside', insidetextanchor: 'middle', textfont: { color: whiteColor, size: barTextFontSize }, hoverinfo: 'name', hovertemplate: 'HÖ: %{y}<extra></extra>' }
        ],
        layout: {
            height: 200, barmode: 'group',
            font: { color: darkGrayColor, family: 'Avenir', size: Math.round(14 * globalScaleFactor), weight: 400 },
            yaxis: { title: yAxisTitle, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, range: [0, maxYValue], showgrid: true, zeroline: false },
            xaxis: { showgrid: false, zeroline: false, showline: false, tickfont: { size: Math.round(14 * globalScaleFactor) }, automargin: true, fixedrange: true },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "center", x: 0.5, font: { size: Math.round(14 * globalScaleFactor) } },
            margin: { l: 50, r: 20, b: 75, t: 35, pad: 5 },
            width: 285, bargroupgap: 0.1
        }
    };
    return fig;
}

function createSingleDonutChart(value) {
    const primaryColor = getCssVar('--app-primary-color');
    const primaryColorRgba = hexToRgba(primaryColor, 0.8);
    const emptyColorRgba = 'rgba(222, 226, 230, 0.8)';
    const darkGrayColor = getCssVar('--dark-gray');

    const barWidth = 360 * (value / 100);

    const data = [
        { type: "barpolar", r: [100], theta: [0], width: [360], marker: { color: emptyColorRgba }, hoverinfo: "none", layer: 'below' },
        { type: "barpolar", r: [100], theta: [barWidth / 2], width: [barWidth], marker: { color: primaryColorRgba }, hoverinfo: "none" }
    ];

    const layout = {
        showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 5, b: 5, l: 5, r: 5 },
        polar: { hole: 0.7, barmode: 'overlay', radialaxis: { visible: false, range: [0, 100] }, angularaxis: { rotation: 90, direction: "clockwise", visible: false } },
        annotations: [{ font: { size: Math.round(20 * globalScaleFactor), color: darkGrayColor, weight: 'bold' }, showarrow: false, text: `${value}`, x: 0.5, y: 0.5, xanchor: 'center', yanchor: 'middle' }]
    };
    return { data, layout };
}

function createBilateralDualAxisChart(data, config) {
    const primaryColorHex = getCssVar('--app-primary-color');
    const primaryColorRgba = hexToRgba(primaryColorHex, 0.8);
    const darkGrayColor = getCssVar('--dark-gray');
    const whiteColor = getCssVar('--white');

    const { val1, val2 } = data;
    const { metricNames, y1Title, y2Title } = config;

    const maxY1 = val1 * 1.25;
    const maxY2 = val2 * 1.25;
    const barTextFontSize = Math.round(18 * globalScaleFactor);

    const fig = {
        data: [
            { type: 'bar', name: metricNames[0], x: [metricNames[0]], y: [val1], marker: { color: primaryColorRgba }, text: [val1.toFixed(1)], textposition: 'inside', insidetextanchor: 'middle', textfont: { color: whiteColor, size: barTextFontSize }, hoverinfo: 'name+y', yaxis: 'y' },
            { type: 'bar', name: metricNames[1], x: [metricNames[1]], y: [val2], marker: { color: primaryColorRgba }, text: [val2.toFixed(2)], textposition: 'inside', insidetextanchor: 'middle', textfont: { color: whiteColor, size: barTextFontSize }, hoverinfo: 'name+y', yaxis: 'y2' },
        ],
        layout: {
            height: 200, barmode: 'group', showlegend: false,
            font: { color: darkGrayColor, family: 'Avenir', size: Math.round(14 * globalScaleFactor), weight: 400 },
            yaxis: { title: y1Title, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, range: [0, maxY1], showgrid: false, zeroline: false },
            yaxis2: { title: y2Title, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, overlaying: 'y', side: 'right', showgrid: false, zeroline: false, showline: false, range: [0, maxY2] },
            xaxis: { showgrid: false, zeroline: false, showline: false, tickfont: { size: Math.round(14 * globalScaleFactor) }, automargin: true, fixedrange: true, categoryorder: 'array', categoryarray: metricNames },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { l: 50, r: 65, b: 75, t: 35, pad: 5 },
            width: 285, bargap: 0.5,
        }
    };
    return fig;
}

function createPage2CustomBarChart(chartData, config = {}) {
    const vaColorHex = getCssVar('--va-color');
    const hoColorHex = getCssVar('--ho-color');
    const vaColorRgba = hexToRgba(vaColorHex, 0.8);
    const hoColorRgba = hexToRgba(hoColorHex, 0.8);
    const darkGrayColor = getCssVar('--dark-gray');
    const whiteColor = getCssVar('--white');

    const { leftVal1 = 0, rightVal1 = 0 } = chartData;
    const { yAxisTitle = 'Value', metricNames = ['Gj. hopphøyde', 'GCT'], decimals = 1 } = config;

    const leftTexts = [leftVal1.toFixed(decimals), ''];
    const rightTexts = [rightVal1.toFixed(decimals), ''];

    const maxY1 = Math.max(leftVal1, rightVal1, 0.1) * 1.25;
    const barTextFontSize = Math.round(18 * globalScaleFactor);

    const data = [
        { type: 'bar', name: 'VÄ', x: [metricNames[0]], y: [leftVal1], marker: { color: vaColorRgba }, text: [leftTexts[0]], textposition: 'inside', insidetextanchor: 'middle', textfont: { color: whiteColor, size: barTextFontSize, angle: 0 }, hoverinfo: 'name+y', yaxis: 'y' },
        { type: 'bar', name: 'HÖ', x: [metricNames[0]], y: [rightVal1], marker: { color: hoColorRgba }, text: [rightTexts[0]], textposition: 'inside', insidetextanchor: 'middle', textfont: { color: whiteColor, size: barTextFontSize, angle: 0 }, hoverinfo: 'name+y', yaxis: 'y' },
        { type: 'bar', name: 'VÄ', x: [metricNames[1]], y: [0], marker: { color: 'rgba(0,0,0,0)' }, text: [''], hoverinfo: 'none', yaxis: 'y2', showlegend: false },
        { type: 'bar', name: 'HÖ', x: [metricNames[1]], y: [0], marker: { color: 'rgba(0,0,0,0)' }, text: [''], hoverinfo: 'none', yaxis: 'y2', showlegend: false }
    ];

    const fig = {
        data: data,
        layout: {
            height: 200, barmode: 'group',
            font: { color: darkGrayColor, family: 'Avenir', size: Math.round(14 * globalScaleFactor), weight: 400 },
            yaxis: { title: yAxisTitle, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, range: [0, maxY1], showgrid: false, zeroline: false },
            yaxis2: { visible: false, range: [0, 1] },
            xaxis: {
                showgrid: false, zeroline: false, showline: false, showticklabels: true,
                tickangle: 0, tickfont: { size: Math.round(14 * globalScaleFactor) },
                automargin: true, fixedrange: true, categoryorder: 'array', categoryarray: metricNames
            },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "left", x: 0, font: { size: Math.round(14 * globalScaleFactor) } },
            margin: { l: 40, r: 25, b: 75, t: 35, pad: 5 },
            annotations: [],
            width: 285,
            bargap: 0.4,
            bargroupgap: 0.1
        }
    };
    return fig;
}

// Graph Type Change Listener Removed - Logic moved to renderCustomTestPreview
// document.getElementById('custom-test-type')?.addEventListener('change', ...);

let isRenderingPreview = false; // Guard against infinite render loops

function renderCustomTestPreview(typeOverride) {
    // Prevent recursive/infinite rendering
    if (isRenderingPreview) return;
    isRenderingPreview = true;

    try {
        console.log("DEBUG: Render Called");
        const typeEl = document.getElementById('custom-test-type');
        const plotDiv = document.getElementById('custom-test-preview-plot');

        console.log("DEBUG: typeEl exists:", !!typeEl);
        console.log("DEBUG: plotDiv exists:", !!plotDiv);

        // Check if modal is open - we need typeEl and plotDiv at minimum
        const modalIsOpen = typeEl && plotDiv;
        if (!modalIsOpen) {
            console.log("DEBUG: Modal not open yet - missing elements:", {
                typeEl: !!typeEl,
                plotDiv: !!plotDiv
            });
            return; // Can't render preview without DOM elements
        }

        console.log("DEBUG: Modal IS OPEN, proceeding with render");
        const type = typeOverride || typeEl.value;
        console.log("DEBUG: Render Type is: '" + type + "'");
        const yAxisTitle = document.getElementById('custom-yaxis-title')?.value || 'Enhet';
        const yAxis2Title = document.getElementById('custom-yaxis-2-title')?.value || 'Tid (ms)';
        const label1 = document.getElementById('custom-label-1')?.value || '';
        const label2 = document.getElementById('custom-label-2')?.value || '';
        const label3 = document.getElementById('custom-label-3')?.value || '';
        const unit = yAxisTitle; // Unit is derived from Y-axis title

        let chartResponse;
        // --- Dynamic Input Visibility Logic ---
        const pairedInputs = document.getElementById('config-paired-bar');
        const y2InputGroup = document.getElementById('group-yaxis-2');
        const label3Group = document.getElementById('group-label-3');
        const yAxisInputGroup = document.getElementById('custom-yaxis-title')?.parentElement;

        if (pairedInputs && y2InputGroup) {
            // Reset specific inputs
            const label2InputGroup = document.getElementById('custom-label-2')?.parentElement;
            if (label2InputGroup) label2InputGroup.style.display = 'block';

            // Visibility Rules
            // Hide X-axis labels for types that use fixed/default labels
            const hideLabels = ['dual-axis', 'single-bar', 'bilateral', 'grouped-bar-3', 'single-bars-3', 'donut'].includes(type);

            if (hideLabels) {
                pairedInputs.style.display = 'none';
            } else {
                pairedInputs.style.display = 'block';

                // Just double check label 2 is visible (was hidden for single-bar previously)
                if (label2InputGroup) label2InputGroup.style.display = 'block';
            }


            // Label 3 Visibility (manual type usually needs 3 labels)
            if (label3Group) {
                if (['three-bar', 'manual'].includes(type)) {
                    label3Group.style.display = 'block';
                } else {
                    label3Group.style.display = 'none';
                }
            }

            // Y-Axis Title - Hide for manual type
            if (yAxisInputGroup) {
                if (type === 'manual') {
                    yAxisInputGroup.style.display = 'none';
                } else {
                    yAxisInputGroup.style.display = 'block';
                }
            }

            // Y2 Axis
            if (['dual-metric-paired', 'bilateral', 'dual-axis'].includes(type)) {
                y2InputGroup.style.display = 'block';
            } else {
                y2InputGroup.style.display = 'none';
            }
        }

        // Construct Labels explicitly based on Type to avoid race condition with Visibility
        let inputLabels = [label1, label2];
        if (['grouped-bar-3', 'donut', 'single-bars-3', 'three-bar', 'manual'].includes(type)) {
            inputLabels.push(label3);
        }

        // Default Labels for Donut / Single Bars 3 / Grouped Bar 3 if empty
        if (['grouped-bar-3', 'donut', 'single-bars-3', 'manual'].includes(type)) {
            inputLabels = inputLabels.map((l, i) => l || `Försök ${i + 1}`);
        }

        // Clear PlotDiv to remove Manual HTML artifacts
        if (type !== 'manual') {
            plotDiv.innerHTML = '';
            plotDiv.style.display = 'block';
        }

        // Mock Data Generators using Templates
        let templateName = type;
        // Map alias
        if (type === 'dual-metric-paired') templateName = 'dual-axis';
        if (type === 'grouped-bar-3') templateName = 'grouped-bar';

        // No longer check graphTemplates - we use direct functions now
        if (type === 'paired-bar') {
            const config = { yAxisTitle, metricNames: [label1, label2], decimals: 1 };
            chartResponse = createPage2CustomBarChart({ leftVal1: 100, rightVal1: 115 }, config);

        } else if (type === 'single-bar') {
            const config = { yAxisTitle: yAxisTitle, metricName: label1 || 'Värde', decimals: 1 };
            chartResponse = createSingleMetricBarChart({ leftVal: 100, rightVal: 115 }, config);
            // Hide X-axis labels and reduce bottom margin to prevent overlap
            if (chartResponse.layout.xaxis) chartResponse.layout.xaxis.showticklabels = false;
            chartResponse.layout.margin = { l: 50, r: 20, b: 35, t: 35, pad: 5 };

        } else if (type === 'grouped-bar-3') {
            console.log("DEBUG: Logic Grouped Bar 3 Entered");
            try {
                const config = { yTitle: yAxisTitle };
                // Use Direct Function
                chartResponse = createGroupedBarChart({ labels: inputLabels, vaValues: [100, 105, 108], hoValues: [110, 115, 112] }, config);
                console.log("DEBUG: Template Created Successfully");
            } catch (e) {
                console.error("DEBUG ERROR: " + e.message);
            }

        } else if (type === 'three-bar') {
            const config = { yAxisTitle, decimals: 1, labels: inputLabels };
            const template = graphTemplates['three-bar'];
            chartResponse = template.create({ leftVal: 100, rightVal: 95, bothVal: 180 }, config);

        } else if (type === 'dual-axis') {
            const config = { metricNames: [label1, label2], y1Title: yAxisTitle, y2Title: yAxis2Title, y1Decimals: 1, y2Decimals: 2 };
            const template = graphTemplates['dual-axis'];
            chartResponse = template.create({ leftVal1: 100, rightVal1: 110, leftVal2: 0.5, rightVal2: 0.45 }, config);
            // Hide X-axis labels and reduce bottom margin
            if (chartResponse.layout.xaxis) chartResponse.layout.xaxis.showticklabels = false;
            chartResponse.layout.margin = { l: 50, r: 65, b: 35, t: 35, pad: 5 };

        } else if (type === 'bilateral') {
            const config = { metricNames: [label1, label2], y1Title: yAxisTitle, y2Title: yAxis2Title || yAxisTitle };
            const template = graphTemplates['bilateral'];
            chartResponse = template.create({ val1: 100, val2: 85 }, config);
            // Hide X-axis labels and reduce bottom margin
            if (chartResponse.layout.xaxis) chartResponse.layout.xaxis.showticklabels = false;
            chartResponse.layout.margin = { l: 50, r: 65, b: 35, t: 35, pad: 5 };

        } else if (type === 'donut') {
            // Donut needs special multi-chart rendering
            plotDiv.style.display = 'flex';
            plotDiv.style.justifyContent = 'space-around';
            plotDiv.style.alignItems = 'center';
            plotDiv.innerHTML = '';

            const donutValues = [85, 92, 88];
            donutValues.forEach((val, index) => {
                // Container for Chart + Label
                const containerDiv = document.createElement('div');
                containerDiv.style.display = 'flex';
                containerDiv.style.flexDirection = 'column';
                containerDiv.style.alignItems = 'center';
                containerDiv.style.margin = '0 5px';

                // Chart Div
                const subDiv = document.createElement('div');
                subDiv.style.width = '90px';
                subDiv.style.height = '90px';
                subDiv.style.display = 'flex';
                subDiv.style.justifyContent = 'center';
                subDiv.style.alignItems = 'center';

                // Label
                const labelDiv = document.createElement('div');
                labelDiv.textContent = `Försök ${index + 1}`;
                labelDiv.style.fontSize = '12px';
                labelDiv.style.color = 'var(--text-color)'; // Use variable or fixed color
                labelDiv.style.marginTop = '5px';
                labelDiv.style.fontFamily = 'Avenir';

                containerDiv.appendChild(subDiv);
                containerDiv.appendChild(labelDiv);
                plotDiv.appendChild(containerDiv);

                const chart = createSingleDonutChart(val);
                const donutLayout = {
                    ...chart.layout,
                    width: 90,
                    height: 90,
                    margin: { t: 0, b: 0, l: 0, r: 0 },
                    paper_bgcolor: 'rgba(0,0,0,0)'
                };

                Plotly.newPlot(subDiv, chart.data, donutLayout, { displayModeBar: false, staticPlot: true, responsive: false });
            });
            return; // Don't fall through to single chart render

        } else if (type === 'single-bars-3') {
            const template = graphTemplates['single-bars-3'];
            chartResponse = template.create({ values: [100, 110, 105] }, { yTitle: yAxisTitle, labels: inputLabels });

        } else if (type === 'manual') {
            plotDiv.style.display = 'block';
            plotDiv.innerHTML = `
            <div style="background-color: #f0f2f5; padding: 10px; border-radius: 4px; height: 250px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-sizing: border-box;">
                <div class="manual-box" style="width: 90%; max-width: 280px; margin: 0 auto; pointer-events: none;">
                    <h4 style="margin: 0 0 8px 0; color: #495057; font-size: 14px;">Testnamn</h4>
                    <div class="input-group" style="margin-bottom: 8px;">
                        <label style="font-size: 13px;">${inputLabels[0] || 'Värde 1'}:</label>
                        <input type="number" disabled style="width: 100%; pointer-events: none; font-size: 13px;">
                    </div>
                    ${inputLabels[1] ? `
                    <div class="input-group" style="margin-bottom: 8px;">
                        <label style="font-size: 13px;">${inputLabels[1]}:</label>
                        <input type="number" disabled style="width: 100%; pointer-events: none; font-size: 13px;">
                    </div>
                    ` : ''}
                    ${inputLabels[2] ? `
                    <div class="input-group" style="margin-bottom: 8px;">
                        <label style="font-size: 13px;">${inputLabels[2]}:</label>
                        <input type="number" disabled style="width: 100%; pointer-events: none; font-size: 13px;">
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
            return;
        }

        if (chartResponse) {
            // Standardize dimensions to match Single Metric (consistent size for all)
            chartResponse.layout.width = 285;
            chartResponse.layout.height = 200;
            chartResponse.layout.autosize = false; // Disable autosize to enforce fixed dimensions

            // Ensure VÄ/HÖ legend is visible for appropriate graph types
            // Bilateral should NOT show legend (single blue bar), others should
            const showLegendTypes = ['single-bar', 'grouped-bar-3', 'paired-bar', 'three-bar', 'dual-axis'];
            if (showLegendTypes.includes(type) && chartResponse.data.length >= 2) {
                chartResponse.layout.showlegend = true;
                chartResponse.layout.legend = {
                    orientation: "h",
                    yanchor: "bottom",
                    y: 1.02,
                    xanchor: "center",
                    x: 0.5,
                    font: { size: Math.round(14 * globalScaleFactor) }
                };
            } else {
                chartResponse.layout.showlegend = false;
            }

            // Plotly Graph
            const config = { responsive: true, displayModeBar: false, staticPlot: true };
            Plotly.newPlot(plotDiv, chartResponse.data, chartResponse.layout, config);
        }

        // Animal Overlay - Only for paired-bar (which is now removed, so effectively always hidden)
        const overlayContainer = document.getElementById('custom-test-overlay-container');
        const overlayImage = document.getElementById('custom-test-overlay-image');
        const overlayText = document.getElementById('custom-test-overlay-text');

        // Hide by default for all types, especially manual
        if (overlayContainer) overlayContainer.style.display = 'none';

        // Paired-bar is removed, so this block will never execute
        if (type === 'paired-bar' && overlayContainer && overlayImage && overlayText) {
            const dummyKg = 285;
            updateAnimalOverlay(dummyKg, overlayImage, overlayText);
            overlayContainer.style.display = 'block';
        }

        // Update label text ONLY if it has changed (prevent DOM mutation triggers)
        const label1Input = document.getElementById('custom-label-1');
        const label2Input = document.getElementById('custom-label-2');
        const label1Label = label1Input?.previousElementSibling;
        const label2Label = label2Input?.previousElementSibling;

        if (type === 'manual') {
            if (label1Label && label1Label.textContent !== 'Värde 1') {
                label1Label.textContent = 'Värde 1';
            }
            if (label2Label && label2Label.textContent !== 'Värde 2') {
                label2Label.textContent = 'Värde 2';
            }
            const label3Label = document.getElementById('custom-label-3')?.previousElementSibling;
            if (label3Label && label3Label.textContent !== 'Värde 3') {
                label3Label.textContent = 'Värde 3';
            }
        } else {
            if (label1Label && label1Label.textContent !== 'Etikett X1') {
                label1Label.textContent = 'Etikett X1';
            }
            if (label2Label && label2Label.textContent !== 'Etikett X2') {
                label2Label.textContent = 'Etikett X2';
            }
        }
    } finally {
        isRenderingPreview = false;
    }
}

function openEditTestModal(test) {
    try {
        console.log("DEBUG: openEditTestModal called for:", test);
        if (!test) throw new Error("Test objektet mangler (is null/undefined)");

        editingTestId = test.id;
        const header = document.querySelector('#create-test-modal h3');
        if (header) header.textContent = 'Redigera Test';

        // Fill Config
        const { config } = test;
        if (!config) {
            console.warn("DEBUG: Config missing for test:", test);
            alert("Kunde inte redigera: Testkonfiguration saknas.");
            return;
        }

        const nameInput = document.getElementById('custom-test-name');
        if (nameInput) nameInput.value = test.name || '';

        const typeInput = document.getElementById('custom-test-type');
        if (typeInput) typeInput.value = test.graphType || 'dual-axis';

        renderGraphTypeGrid(); // Refresh grid selection state

        const outputCategory = document.getElementById('custom-test-category');
        if (outputCategory) outputCategory.value = test.category || 'Övrigt';

        const animalInput = document.getElementById('custom-test-animal');
        if (animalInput) animalInput.value = config.animal || 'none';

        const yAxisInput = document.getElementById('custom-yaxis-title');
        if (yAxisInput) yAxisInput.value = config.yAxisTitle || '';

        const yAxis2Input = document.getElementById('custom-yaxis-2-title');
        if (yAxis2Input) yAxis2Input.value = config.y2Title || '';

        // Labels
        const savedLabels = config.inputLabels || config.metricNames || [];
        const label1Input = document.getElementById('custom-label-1');
        if (label1Input) label1Input.value = savedLabels[0] || '';

        const label2Input = document.getElementById('custom-label-2');
        if (label2Input) label2Input.value = savedLabels[1] || '';

        const label3Input = document.getElementById('custom-label-3');
        if (label3Input) {
            label3Input.value = savedLabels[2] || '';
        }

        // Trigger change to update inputs visibility
        if (typeInput) typeInput.dispatchEvent(new Event('change'));

        const modal = document.getElementById('create-test-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.style.zIndex = '9999';
        } else {
            console.error("DEBUG: Modal element #create-test-modal not found");
        }

        renderCustomTestPreview();
    } catch (e) {
        console.error("DEBUG: Error in openEditTestModal:", e);
        alert("Ett fel inträffade när testet skulle redigeras: " + e.message);
    }
}

async function handleSaveProtocol() {
    const nameInput = document.getElementById('manager-protocol-name');
    const name = nameInput.value.trim();
    if (!name) { showToast('Gi protokollet et navn.', 'error'); return; }
    const selectedIds = currentSelectedTests.map(t => t.id);
    try {
        if (currentEditingProtocolId) {
            // UPDATE existing protocol
            await updateProtocol(currentEditingProtocolId, name, selectedIds);
            showToast('Protokoll oppdatert!', 'success');
            exitEditingMode();
        } else {
            // CREATE new protocol
            await saveProtocol(createProtocol(name, selectedIds));
            showToast('Protokoll lagret!', 'success');
            nameInput.value = '';
            currentSelectedTests = [];
            renderSelectedTests();
            renderTestGrid();
        }
        renderProtocolList();
    } catch (e) {
        showToast('Feil ved lagring: ' + e.message, 'error');
    }
}

function exitEditingMode() {
    currentEditingProtocolId = null;
    const nameInput = document.getElementById('manager-protocol-name');
    if (nameInput) nameInput.value = '';
    currentSelectedTests = [];
    renderSelectedTests();
    renderTestGrid();
    updateEditingBanner();
}

function updateEditingBanner() {
    let banner = document.getElementById('editing-protocol-banner');
    if (currentEditingProtocolId) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'editing-protocol-banner';
            banner.style.cssText = `
                background: linear-gradient(135deg, var(--app-primary-color), #2980b9);
                color: white;
                padding: 12px 20px;
                border-radius: var(--border-radius);
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                font-weight: 500;
                font-size: 0.95rem;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            `;
            const mainContent = document.querySelector('#protocol-management-view > div');
            if (mainContent) mainContent.insertBefore(banner, mainContent.firstChild);
        }
        banner.innerHTML = `
            <span><i class="fas fa-pen" style="margin-right:8px;"></i>Redigeringsmodus: <strong>${document.getElementById('manager-protocol-name')?.value || ''}</strong></span>
            <button id="cancel-edit-protocol-btn" style="
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.5);
                color: white;
                padding: 6px 14px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.85rem;
                transition: background 0.2s;
            ">
                <i class="fas fa-times"></i> Avbryt
            </button>
        `;
        banner.querySelector('#cancel-edit-protocol-btn').addEventListener('click', exitEditingMode);
    } else {
        if (banner) banner.remove();
    }
}

// --- 5. RENDER EXISTING PROTOCOLS ---
async function renderProtocolList() {
    const listContainer = document.getElementById('manager-protocol-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p style="text-align:center; opacity:0.5;">Laster...</p>';

    try {
        const protocols = await getProtocols();
        listContainer.innerHTML = '';

        if (protocols.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; opacity:0.5; margin-top:20px;">Ingen lagrede protokoller ennå.</p>';
            return;
        }

        protocols.forEach(p => {
            const el = document.createElement('div');
            el.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                border-radius: 8px;
                background: var(--white);
                border: 1px solid var(--medium-gray);
                margin-bottom: 10px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            `;

            el.innerHTML = `
                <div>
                    <strong style="display:block; font-size:1rem; color: var(--app-primary-color);">${p.name}</strong>
                    <span style="font-size:0.8rem; opacity:0.6; color: var(--text-color);">${(p.testIds || []).length} tester</span>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button class="edit-protocol-btn" title="Rediger protokoll"
                        style="background:none; border:1px solid var(--app-primary-color); color:var(--app-primary-color); border-radius:6px; padding:5px 10px; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; gap:5px; transition: all 0.2s;">
                        <i class="fas fa-pen"></i> Rediger
                    </button>
                    <button class="delete-btn" title="Slett protokoll"
                        style="background:none; border:none; color:var(--danger-color); cursor:pointer; padding:5px 8px; font-size:0.9rem;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            el.querySelector('.edit-protocol-btn').addEventListener('mouseenter', (e) => {
                e.currentTarget.style.background = 'var(--app-primary-color)';
                e.currentTarget.style.color = 'white';
            });
            el.querySelector('.edit-protocol-btn').addEventListener('mouseleave', (e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--app-primary-color)';
            });

            el.querySelector('.edit-protocol-btn').addEventListener('click', () => {
                loadProtocolForEditing(p);
                // Close the modal
                const modal = document.getElementById('protocols-modal');
                if (modal) modal.style.display = 'none';
            });

            el.querySelector('.delete-btn').addEventListener('click', async () => {
                if (confirm(`Slette protokoll "${p.name}"?`)) {
                    await deleteProtocol(p.id);
                    renderProtocolList();
                    showToast('Protokoll slettet', 'success');
                }
            });

            listContainer.appendChild(el);
        });

    } catch (e) {
        listContainer.innerHTML = `<p style="color:var(--danger-color);">Kunne ikke laste protokoller.</p>`;
    }
}

function loadProtocolForEditing(protocol) {
    currentEditingProtocolId = protocol.id;

    // Set protocol name
    const nameInput = document.getElementById('manager-protocol-name');
    if (nameInput) nameInput.value = protocol.name || '';

    // Resolve test objects from testIds
    const testIds = protocol.testIds || [];
    currentSelectedTests = testIds.map(id => {
        return availableTests.find(t => t.id === id) || { id, name: id, category: 'Övrigt' };
    });

    renderSelectedTests();
    renderTestGrid();
    updateEditingBanner();

    // Scroll to top so banner is visible
    const mainView = document.getElementById('protocol-management-view');
    if (mainView) mainView.scrollTo({ top: 0, behavior: 'smooth' });
}

// Inject style for fade animation
const style = document.createElement('style');
style.innerHTML = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
.filter-btn {
    padding: 6px 12px;
    border: 1px solid var(--medium-gray);
    border-radius: 20px;
    background: var(--white);
    color: var(--text-color);
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s ease;
}
.filter-btn:hover {
    border-color: var(--app-primary-color);
}
`;
document.head.appendChild(style);

// --- CUSTOM TEST LOGIC ---

function initCreateTestModal() {
    const btn = document.getElementById('create-custom-test-btn');

    if (btn) {
        btn.addEventListener('click', () => {
            try {
                editingTestId = null;
                document.querySelector('#create-test-modal h3').textContent = 'Skapa Nytt Test';

                // Populate Grid instead of Select
                renderGraphTypeGrid();

                // Set default to dual-axis graph
                const typeInput = document.getElementById('custom-test-type');
                if (typeInput) typeInput.value = 'dual-axis';

                // Reset Inputs
                document.getElementById('custom-test-name').value = '';
                document.getElementById('custom-test-category').value = 'Styrka';
                // document.getElementById('custom-test-animal').value = 'none'; // Removed
                document.getElementById('custom-yaxis-title').value = 'Kraft (N)';
                document.getElementById('custom-label-1').value = '';
                document.getElementById('custom-label-2').value = '';

                // Reset Visibility - hide paired-bar config for dual-axis default
                document.getElementById('config-paired-bar').style.display = 'none';
                const label3Group = document.getElementById('group-label-3');
                if (label3Group) label3Group.style.display = 'none';
                document.getElementById('group-yaxis-2').style.display = 'block'; // Show for dual-axis
                if (document.getElementById('custom-label-3')) document.getElementById('custom-label-3').value = '';

                const modal = document.getElementById('create-test-modal');
                if (!modal) throw new Error("Modal element not found!");

                if (modal.parentNode !== document.body) document.body.appendChild(modal);

                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.width = '100vw';
                modal.style.height = '100vh';

                document.getElementById('custom-test-type').dispatchEvent(new Event('change'));

                document.getElementById('create-test-modal').style.display = 'flex';
                document.getElementById('create-test-modal').style.zIndex = '9999';
                renderCustomTestPreview();
            } catch (e) {
                console.error("Error opening modal:", e);
                alert("Kunde inte öppna modalen: " + e.message);
            }
        });
    }

    const saveBtn = document.getElementById('save-custom-test-btn');
    if (saveBtn) {
        saveBtn.onclick = handleSaveCustomTest;
    }

    const closeBtn = document.getElementById('close-create-test-modal');
    if (closeBtn) {
        closeBtn.onclick = () => document.getElementById('create-test-modal').style.display = 'none';
    }
}

async function handleSaveCustomTest() {
    const name = document.getElementById('custom-test-name').value;
    if (!name) { alert("Ange ett namn på testet."); return; }

    const type = document.getElementById('custom-test-type').value;
    const category = document.getElementById('custom-test-category').value;
    // Animal Removed
    // const animal = document.getElementById('custom-test-animal').value;
    const yAxisTitle = document.getElementById('custom-yaxis-title').value;
    const yAxis2Title = document.getElementById('custom-yaxis-2-title').value;
    const label1 = document.getElementById('custom-label-1').value || 'Värde 1';
    const label2 = document.getElementById('custom-label-2').value || 'Värde 2';
    const label3 = document.getElementById('custom-label-3')?.value || 'Värde 3';

    const inputLabels = [label1, label2];
    // Include Label 3 for types that support it (Fixed Logic)
    if (['grouped-bar-3', 'donut', 'single-bars-3', 'manual', 'three-bar'].includes(type) && label3) {
        inputLabels.push(label3);
    }

    // Build Config
    const newTest = {
        name: name,
        graphType: type,
        category: category,
        config: {
            yAxisTitle: yAxisTitle,
            y2Title: yAxis2Title || null,
            animal: 'none',
            // Generic Storage of Labels
            metricNames: inputLabels,
            inputLabels: inputLabels
        }
    };

    try {
        if (editingTestId) {
            await updateCustomTest(editingTestId, newTest);
        } else {
            await saveCustomTest(newTest);
        }
        document.getElementById('create-test-modal').style.display = 'none';
        await loadAndRenderTests();
    } catch (e) {
        alert("Fel vid sparande: " + e.message);
    }
}

function renderGraphTypeGrid() {
    const container = document.getElementById('graph-type-grid');
    const input = document.getElementById('custom-test-type');
    if (!container || !input) return;

    container.innerHTML = '';

    const options = [
        { val: 'dual-axis', text: 'Dual Axis Graph', icon: 'fa-chart-area', symmetry: true },
        { val: 'grouped-bar-3', text: 'Grouped Bar 3 Attempts', icon: 'fa-layer-group', symmetry: true },
        { val: 'three-bar', text: 'Three Bar', icon: 'fa-chart-bar', symmetry: true },
        { val: 'single-bar', text: 'Single Metric Grouped', icon: 'fa-chart-column', symmetry: true },
        { val: 'bilateral', text: 'Bilateral Dual-Axis', icon: 'fa-right-left', symmetry: true },
        { val: 'donut', text: 'Donut Gauge', icon: 'fa-chart-pie' },
        { val: 'single-bars-3', text: 'Bar Gauge (3 Attempts)', icon: 'fa-chart-bar' },
        { val: 'manual', text: 'Manuell inmatning', icon: 'fa-keyboard' }
    ];

    console.log("DEBUG: Options Loop Running");
    options.forEach(opt => {
        const btn = document.createElement('div');
        const isActive = input.value === opt.val;

        btn.className = `graph-type-option ${isActive ? 'active' : ''}`;
        btn.dataset.val = opt.val;
        btn.style.cssText = `
            border: 1px solid ${isActive ? 'var(--app-primary-color)' : 'var(--medium-gray)'};
            background: ${isActive ? '#eef6fc' : '#fff'};
            padding: 8px;
            border-radius: 4px;
            cursor: pointer;
            text-align: center;
            font-size: 0.8rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            transition: all 0.2s ease;
            position: relative;
        `;

        // Symmetry Badge
        let symmetryHTML = '';
        if (opt.symmetry) {
            symmetryHTML = `<span style="font-size: 0.65rem; color: var(--success-color); font-weight: 600;">(Asymmetri)</span>`;
        }

        btn.innerHTML = `
            <i class="fas ${opt.icon}" style="font-size: 1.2rem; color: ${isActive ? 'var(--app-primary-color)' : 'var(--dark-gray)'};"></i>
            <span style="color: ${isActive ? 'var(--app-primary-color)' : 'var(--text-color)'}; font-weight: 500;">${opt.text}</span>
            ${symmetryHTML}
        `;

        // Click -> Select
        btn.onclick = () => {
            console.log("DEBUG: Grid Clicked: " + opt.val);
            input.value = opt.val;
            console.log("DEBUG: Dispatching Change Event");
            input.dispatchEvent(new Event('change'));

            // Re-render grid to update selection styles (Inline Styles)
            renderGraphTypeGrid();

            // Trigger Preview
            renderCustomTestPreview();
        };

        // Hover -> Preview
        btn.addEventListener('mouseenter', () => {
            renderCustomTestPreview(opt.val);
        });

        // Leave -> Restore Selection
        btn.addEventListener('mouseleave', () => {
            renderCustomTestPreview(input.value);
        });

        container.appendChild(btn);
    });
}

// Helper: Show Toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: ${type === 'error' ? 'var(--danger-color, #ff6b6b)' : type === 'success' ? 'var(--success-color, #51cf66)' : '#333'};
        color: white;
        padding: 12px 24px;
        border-radius: 4px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: 'Avenir', sans-serif;
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
    });

    // Animate out
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
