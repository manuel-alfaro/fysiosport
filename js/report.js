import { db, auth } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getCustomTests } from './custom_tests.js';
import { graphTemplates } from './graph_templates.js';
import { testConfigs } from './test_config.js';

const globalScaleFactor = 0.65;
const plotlyConfig = { displayModeBar: false, staticPlot: true };

function scaleHtmlFontSizes(scaleFactor) {
    document.documentElement.style.setProperty('--scale-factor', scaleFactor);
    const originalSizes = { body: 16, h1: 32, h2: 24, h3Base: 18.4, explanationBoxBase: 14.4 };
    const newBodyFontSize = Math.round(originalSizes.body * scaleFactor);
    document.body.style.fontSize = newBodyFontSize + 'px';

    document.querySelectorAll('h3.position-title, h3.normative-title').forEach(el => { el.style.fontSize = Math.round(originalSizes.h3Base * scaleFactor) + 'px'; });
    document.querySelectorAll('.explanation-box-small').forEach(el => { el.style.fontSize = Math.round(originalSizes.explanationBoxBase * scaleFactor) + 'px'; });
}

// --- PAGE 2 ANIMAL LOGIC ---
// Uses getAnimalForWeight from utils.js

function updateAnimalOverlay(weight, imageElement, textElement) {
    const animal = getAnimalForWeight(weight);
    imageElement.src = animal.url;
    textElement.innerHTML = `Sammanlagd kraft: ${weight.toFixed(1)} kg<br>Du är en ${animal.name}!`;
}

// --- HELPERS ---

function populateInfoBoxes(patientInfo) {
    document.getElementById('p1-name').textContent = patientInfo.name || 'N/A';
    document.getElementById('p1-date').textContent = patientInfo.date || 'N/A';
    document.getElementById('p1-sport').textContent = patientInfo.sportPosition || 'N/A';
    document.getElementById('p1-createdBy').textContent = patientInfo.createdBy || 'N/A';

    document.getElementById('p2-name').textContent = patientInfo.name || 'N/A';
    document.getElementById('p2-date').textContent = patientInfo.date || 'N/A';
    document.getElementById('p2-sport').textContent = patientInfo.sportPosition || 'N/A';
    document.getElementById('p2-createdBy').textContent = patientInfo.createdBy || 'N/A';

    document.getElementById('p3-name').textContent = patientInfo.name || 'N/A';
    document.getElementById('p3-date').textContent = patientInfo.date || 'N/A';
    document.getElementById('p3-sport').textContent = patientInfo.sportPosition || 'N/A';
    document.getElementById('p3-createdBy').textContent = patientInfo.createdBy || 'N/A';
}

function updateManualTextBoxes(manualData) {
    if (!manualData) manualData = {};

    const srpContent = document.getElementById('manual-srp');
    if (srpContent) {
        if (!manualData.srp || (manualData.srp.force === 0 && manualData.srp.tare === 0)) {
            srpContent.innerHTML = `<div class="no-data-placeholder"><i class="fas fa-tasks"></i><p>Test ej genomfört</p></div>`;
        } else {
            const srpResult = (manualData.srp.force || 0) - (manualData.srp.tare || 0);
            srpContent.innerHTML = `
                <p><b>Tare:</b> ${manualData.srp.tare || 0}N (Detta visar din ursprungsvikt i Newton på plattan)</p>
                <p><b>Force:</b> ${manualData.srp.force || 0}N (Detta visar din kraftutveckling)</p>
                <p>= <b>${srpResult.toFixed(0)}N</b> i Kraftutveckling</p>`;
        }
    }

    const sptsContent = document.getElementById('manual-spts');
    if (sptsContent) {
        if (!manualData.spts || manualData.spts.kg === 0) {
            sptsContent.innerHTML = `<div class="no-data-placeholder"><i class="fas fa-tasks"></i><p>Test ej genomfört</p></div>`;
        } else {
            sptsContent.innerHTML = `
                <p>Vi testade på vilken vikt du kunde bibehålla din <b>explosivitet</b> i knäböj kring <b>0,85m/s</b> (mellan <b>POWER og SPEED</b>) under 12 repetitioner, 3 set.</p>
                <p>= <b>${manualData.spts.kg || 0}kg</b></p>`;
        }
    }

    const mpuContent = document.getElementById('manual-mpu');
    if (mpuContent) {
        if (!manualData.mpu || (manualData.mpu.force === 0 && manualData.mpu.tare === 0)) {
            mpuContent.innerHTML = `<div class="no-data-placeholder"><i class="fas fa-tasks"></i><p>Test ej genomfört</p></div>`;
        } else {
            const mpuResult = (manualData.mpu.force || 0) - (manualData.mpu.tare || 0);
            mpuContent.innerHTML = `
                <p><b>Tare:</b> ${manualData.mpu.tare || 0}N (Detta visar din överkropps ursprungsvikt i Newton på plattan)</p>
                <p><b>Force:</b> ${manualData.mpu.force || 0}N (Detta visar din kraftutveckling)</p>
                <p>= <b>${mpuResult.toFixed(0)}N</b> i Kraftutveckling</p>`;
        }
    }

    const bpcContent = document.getElementById('manual-bpc');
    if (bpcContent) {
        if (!manualData.bpc || manualData.bpc.hits === 0) {
            bpcContent.innerHTML = `<div class="no-data-placeholder"><i class="fas fa-tasks"></i><p>Test ej genomfört</p></div>`;
        } else {
            bpcContent.innerHTML = `
                <p>Plankstående 30s <b>reaktionsförmåga</b>, <b>max antal nudd</b></p>
                <p>= <b>${manualData.bpc.hits || 0}st</b></p>`;
        }
    }
}

function showNoDataPlaceholder(plotDivId, message = "Test ej genomfört") {
    const plotDiv = document.getElementById(plotDivId);
    if (plotDiv) {
        Plotly.purge(plotDiv);
        plotDiv.innerHTML = `
            <div class="no-data-placeholder">
                <i class="fas fa-chart-line"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

function populateCommentsAndDifferences(reportData) {
    function updateBox(boxId, comment, asymmetryPercent, hasData) {
        const box = document.getElementById(boxId);
        if (!box) return;

        const commentEl = box.querySelector('.comment-text');
        if (!commentEl) return;

        if (!hasData) {
            commentEl.innerHTML = `<p style="color: var(--medium-gray); font-style: italic;">Ingen data för denna testen.</p>`;
            return;
        }

        let contentHTML = '';
        if (asymmetryPercent !== undefined && !isNaN(asymmetryPercent)) {
            const colorClass = asymmetryPercent <= -10 ? 'red' : 'green';
            contentHTML += `<span class="percentage-display ${colorClass}">Asymmetri: ${asymmetryPercent.toFixed(1)}%.</span> `;
        }

        contentHTML += (comment || 'Ingen kommentar.');
        commentEl.innerHTML = contentHTML;
    }

    // Page 1
    const balanceData = reportData.page1.balance;
    const hasBalanceData = balanceData && !(balanceData.leftScore === 0 && balanceData.rightScore === 0 && balanceData.leftDiff === 0 && balanceData.rightDiff === 0);
    updateBox('p1-balance-comment-box', balanceData?.comment, balanceData?.asymmetryPercent, hasBalanceData);

    const cmjData = reportData.page1.cmj;
    const hasCmjData = cmjData && !(cmjData.vaJumps.every(j => j === 0) && cmjData.hoJumps.every(j => j === 0));
    updateBox('p1-cmj-comment-box', cmjData?.comment, cmjData?.asymmetryPercent, hasCmjData);

    const tiaData = reportData.page1.tia;
    const hasTiaData = tiaData && !(tiaData.leftJump === 0 && tiaData.rightJump === 0 && tiaData.leftGct === 0 && tiaData.rightGct === 0);
    updateBox('p1-tia-comment-box', tiaData?.comment, tiaData?.asymmetryPercent, hasTiaData);

    const sidehopData = reportData.page1.sidehop;
    const hasSidehopData = sidehopData && !(sidehopData.leftCount === 0 && sidehopData.rightCount === 0);
    updateBox('p1-sidehop-comment-box', sidehopData?.comment, sidehopData?.asymmetryPercent, hasSidehopData);

    const squatData = reportData.page1.squatAnalytics;
    const hasSquatData = squatData && !(squatData.attempt1 === 0 && squatData.attempt2 === 0 && squatData.attempt3 === 0);
    updateBox('p1-squat-comment-box', squatData?.comment, undefined, hasSquatData);

    const repeatedData = reportData.page1.repeatedBilateral;
    const hasRepeatedData = repeatedData && !(repeatedData.avgHeight === 0 && repeatedData.avgGct === 0);
    updateBox('p1-repeated-comment-box', repeatedData?.comment, undefined, hasRepeatedData);

    const cmj2benData = reportData.page1.cmj2ben;
    const hasCmj2benData = cmj2benData && !(cmj2benData.attempt1 === 0 && cmj2benData.attempt2 === 0 && cmj2benData.attempt3 === 0);
    updateBox('p1-cmj2ben-comment-box', cmj2benData?.comment, undefined, hasCmj2benData);

    // Page 2
    const hipThrustData = reportData.page2.strengthTests.hipThrust;
    const hasHipThrustData = hipThrustData && !(hipThrustData.left === 0 && hipThrustData.right === 0);
    updateBox('p2-hipthrust-comment-box', hipThrustData?.comment, hipThrustData?.asymmetryPercent, hasHipThrustData);

    const quadsData = reportData.page2.strengthTests.quadriceps;
    const hasQuadsData = quadsData && !(quadsData.left === 0 && quadsData.right === 0);
    updateBox('p2-quads-comment-box', quadsData?.comment, quadsData?.asymmetryPercent, hasQuadsData);

    const staticsquatHanddragData = reportData.page2.strengthTests.staticsquatHanddrag;
    const hasStaticsquatHanddragData = staticsquatHanddragData && !(staticsquatHanddragData.left === 0 && staticsquatHanddragData.right === 0 && staticsquatHanddragData.both === 0);
    updateBox('p2-staticsquat-handdrag-comment-box', staticsquatHanddragData?.comment, staticsquatHanddragData?.asymmetryPercent, hasStaticsquatHanddragData);

    const staticsquatHoftremData = reportData.page2.strengthTests.staticsquatHoftrem;
    const hasStaticsquatHoftremData = staticsquatHoftremData && !(staticsquatHoftremData.left === 0 && staticsquatHoftremData.right === 0 && staticsquatHoftremData.both === 0);
    updateBox('p2-staticsquat-hoftrem-comment-box', staticsquatHoftremData?.comment, staticsquatHoftremData?.asymmetryPercent, hasStaticsquatHoftremData);

    const hamstringData = reportData.page2.strengthTests.hamstring;
    const hasHamstringData = hamstringData && !(hamstringData.left === 0 && hamstringData.right === 0);
    updateBox('p2-hamstring-comment-box', hamstringData?.comment, hamstringData?.asymmetryPercent, hasHamstringData);

    const nordicHamstringData = reportData.page2.strengthTests.nordicHamstring;
    const hasNordicHamstringData = nordicHamstringData && !(nordicHamstringData.attempt1 === 0 && nordicHamstringData.attempt2 === 0 && nordicHamstringData.attempt3 === 0);
    updateBox('p2-nordic-hamstring-comment-box', nordicHamstringData?.comment, undefined, hasNordicHamstringData);
}

async function updateLayoutAndRenderGraphs(reportData) {
    const plotPromises = [];
    const templates = document.getElementById('templates');

    // Helper to render block
    function renderBlock(testId, domId) {
        const cfg = testConfigs[testId];
        if (!cfg) return null;

        const data = cfg.getData(reportData);
        // Check "hasData" logic from previous implementation? 
        // getData returns null if no data.

        return {
            id: testId,
            col: templates.querySelector('#' + domId),
            hasData: !!data,
            render: (element) => {
                const titleEl = element.querySelector('.position-title') || element.querySelector('.normative-title');
                if (titleEl) titleEl.textContent = cfg.title;

                const template = graphTemplates[cfg.template];

                // Multi-Instance (Donuts)
                if (cfg.isMultiInstance && Array.isArray(data)) {
                    const divs = element.querySelectorAll('.js-plotly-plot');
                    data.forEach((val, i) => {
                        const fig = template.create({ value: val }, cfg.config);
                        if (divs[i]) plotPromises.push(Plotly.newPlot(divs[i], fig.data, fig.layout, plotlyConfig));
                    });
                } else if (data) {
                    // Standard
                    const fig = template.create(data, cfg.config);
                    plotPromises.push(Plotly.react(element.querySelector('.js-plotly-plot'), fig.data, fig.layout, plotlyConfig));

                    // Overlays
                    if (data.overlayVal && data.overlayImageId) {
                        const img = element.querySelector('#' + data.overlayImageId);
                        const txt = element.querySelector('#' + data.overlayTextId);
                        if (img && txt) {
                            if (data.overlayVal > 0) updateAnimalOverlay(data.overlayVal, img, txt);
                            else { img.style.display = 'none'; txt.style.display = 'none'; }
                        }
                    }
                }
            }
        };
    }

    const allTestBlocks = [
        renderBlock('balance', 'col-balance'),
        renderBlock('cmj', 'col-cmj'),
        renderBlock('tia', 'col-tia'),
        renderBlock('sidehop', 'col-sidehop'),
        renderBlock('squatAnalytics', 'col-squat'),
        renderBlock('repeatedBilateral', 'col-repeated'),
        renderBlock('cmj2ben', 'col-cmj2ben'),
        renderBlock('hipThrust', 'col-hipthrust'),
        renderBlock('quadriceps', 'col-quads'),
        renderBlock('staticsquatHanddrag', 'col-staticsquat-handdrag'),
        renderBlock('staticsquatHoftrem', 'col-staticsquat-hoftrem'),
        renderBlock('hamstring', 'col-hamstring'),
        renderBlock('nordicHamstring', 'col-nordic-hamstring'),
        // Manual Tests (No Config/Template yet, keep legacy logic for now or migrate?)
        // Manuals are just text boxes mostly, except maybe future graphs.
        // For now, they were in the list. I'll add them manually as before.
        {
            id: 'srp', col: templates.querySelector('#col-srp'), isManual: true,
            hasData: reportData.page2.manual?.srp && !(reportData.page2.manual.srp.force === 0 && reportData.page2.manual.srp.tare === 0)
        },
        {
            id: 'spts', col: templates.querySelector('#col-spts'), isManual: true,
            hasData: reportData.page2.manual?.spts && reportData.page2.manual.spts.kg !== 0
        },
        {
            id: 'mpu', col: templates.querySelector('#col-mpu'), isManual: true,
            hasData: reportData.page2.manual?.mpu && !(reportData.page2.manual.mpu.force === 0 && reportData.page2.manual.mpu.tare === 0)
        },
        {
            id: 'bpc', col: templates.querySelector('#col-bpc'), isManual: true,
            hasData: reportData.page2.manual?.bpc && reportData.page2.manual.bpc.hits !== 0
        }
    ];

    // Inject Custom Tests
    try {
        const customTests = await getCustomTests();
        if (customTests) {
            customTests.forEach(test => {
                const tmpl = templates.querySelector('#col-custom').cloneNode(true);
                tmpl.id = `col-custom-${test.id}`;

                const cData = reportData.page2.custom ? reportData.page2.custom[test.id] : null;
                const hasData = cData && cData.active;

                // For Custom Tests, we get config FROM the test object, not testconfigs.js (dynamic)
                const templateId = test.graphType === 'grouped-bar-2' || test.graphType === 'grouped-bar-3' ? 'grouped-bar' :
                    test.graphType === 'dual-metric-paired' ? 'dual-axis' : test.graphType;

                const block = {
                    id: `custom_${test.id}`,
                    col: tmpl,
                    hasData: hasData,
                    render: (element) => {
                        element.querySelector('.position-title').textContent = test.name.toUpperCase();

                        const template = graphTemplates[templateId];
                        if (template) {
                            // Map Content
                            let chartData = {};
                            let chartConfig = test.config;

                            // Minimal Mapping Logic for Custom Data
                            if (templateId === 'paired-bar') {
                                chartData = { leftVal1: cData.val1 || 0, rightVal1: cData.val2 || 0 };
                            } else if (templateId === 'single-bar') {
                                chartData = { leftVal: cData.val1 || 0, rightVal: cData.val2 || 0 };
                            } else if (templateId === 'grouped-bar') {
                                chartData = {
                                    labels: test.config.inputLabels,
                                    vaValues: [cData.val1, cData.val3, cData.val5].filter(v => v !== undefined), // Mock mapping? Crap.
                                    // Custom Tests in Manage Protocols don't really support Data Entry yet?
                                    // The user only asked for Architecture.
                                    // For now, map generic fields.
                                    vaValues: [cData.val1 || 0, cData.val3 || 0],
                                    hoValues: [cData.val2 || 0, cData.val4 || 0]
                                };
                            }
                            // Fallback to Paired for now if undefined mapping
                            if (!chartData.leftVal1 && !chartData.vaValues) chartData = { leftVal1: cData.val1 || 0, rightVal1: cData.val2 || 0 };

                            const fig = template.create(chartData, chartConfig);
                            Plotly.react(element.querySelector('.js-plotly-plot'), fig.data, fig.layout, plotlyConfig);
                        }

                        const commentEl = element.querySelector('.comment-text');
                        if (commentEl) commentEl.textContent = cData.comment || 'Ingen kommentar.';
                    }
                };
                allTestBlocks.push(block);
            });
        }
    } catch (e) {
        console.error("Error loading custom tests in report:", e);
    }

    const activeBlocks = allTestBlocks.filter(b => b && b.hasData);
    const page1Container = document.getElementById('report-content-page1');
    const page2Container = document.getElementById('report-content-page2');
    const page3Container = document.getElementById('report-content-page3');

    let currentRow = null;
    let currentContainer = page1Container;

    activeBlocks.forEach((block, index) => {
        if (index % 2 === 0) {
            if (index >= 12) {
                currentContainer = page3Container;
            } else if (index >= 6) {
                currentContainer = page2Container;
            } else {
                currentContainer = page1Container;
            }
            currentRow = document.createElement('div');
            currentRow.className = 'position-row';
            currentContainer.appendChild(currentRow);
        }

        currentRow.appendChild(block.col);
        if (block.render) {
            block.render(block.col);
        }
    });

    const totalItems = activeBlocks.length;
    const page1 = document.getElementById('page-1');
    const page2 = document.getElementById('page-2');
    const page3 = document.getElementById('page-3');

    page1.classList.remove('page-break');
    page2.classList.remove('page-break');
    page2.classList.add('hidden');
    page3.classList.add('hidden');

    if (totalItems > 12) {
        page1.classList.add('page-break');
        page2.classList.remove('hidden');
        page2.classList.add('page-break');
        page3.classList.remove('hidden');
    } else if (totalItems > 6) {
        page1.classList.add('page-break');
        page2.classList.remove('hidden');
    }

    await Promise.all(plotPromises);

    setTimeout(() => {
        const allPlotDivs = document.querySelectorAll('.js-plotly-plot');
        allPlotDivs.forEach(gd => {
            if (gd && typeof gd.layout !== 'undefined') {
                try { Plotly.Plots.resize(gd); } catch (e) { console.warn("Error resizing plot:", gd.id, e); }
            }
        });
        setTimeout(() => window.print(), 500);
    }, 150);
}

window.addEventListener('load', () => {
    scaleHtmlFontSizes(globalScaleFactor);

    const storedData = localStorage.getItem('alphatekReportsData');

    if (storedData) {
        try {
            const reportData = JSON.parse(storedData);
            populateInfoBoxes(reportData.patientInfo);
            updateManualTextBoxes(reportData.page2.manual);
            populateCommentsAndDifferences(reportData);
            updateLayoutAndRenderGraphs(reportData);
        } catch (e) {
            console.error("Failed to parse or render data from localStorage:", e);
        }
    } else {
        console.warn("No data found in localStorage. Cannot generate report.");
    }
});

window.addEventListener('resize', () => {
    const allDivs = document.querySelectorAll('.js-plotly-plot');
    allDivs.forEach(gd => {
        if (gd && typeof gd.layout !== 'undefined') {
            try { Plotly.Plots.resize(gd); } catch (e) { /* Ignore */ }
        }
    });
}, 150);
