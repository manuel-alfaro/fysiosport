export const testTemplates = {
    balance: `
    <div class="test-section" data-test-type="balance" data-instance-index="{{INDEX}}">
        <h3 class="test-title">1. Balans {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>VÄ Score:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g1_va_score{{INDEX}}"><span class="unit-text phantom"></span></div>
                    </div>
                    <div class="input-row"><label>VÄ Gen. diff:</label>
                        <div class="input-wrapper"><input type="number" step="0.01" id="p1_g1_va_diff{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>HÖ Score:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g1_ho_score{{INDEX}}"><span class="unit-text phantom"></span></div>
                    </div>
                    <div class="input-row"><label>HÖ Gen. diff:</label>
                        <div class="input-wrapper"><input type="number" step="0.01" id="p1_g1_ho_diff{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_balance{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_balance{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>Balans</h3>
                <div id="p1-chart-balance{{INDEX}}" class="js-plotly-plot"></div>
            </div>
        </div>
    </div>`,

    cmj: `
    <div class="test-section" data-test-type="cmj" data-instance-index="{{INDEX}}">
        <h3 class="test-title">2. Max Hopp CMJ {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>VÄ Hopp 1:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g2_va_1{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>VÄ Hopp 2:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g2_va_2{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>VÄ Hopp 3:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g2_va_3{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>HÖ Hopp 1:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g2_ho_1{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>HÖ Hopp 2:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g2_ho_2{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>HÖ Hopp 3:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g2_ho_3{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_cmj{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_cmj{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>Max Hopp CMJ</h3>
                <div id="p1-chart-cmj{{INDEX}}" class="js-plotly-plot"></div>
            </div>
        </div>
    </div>`,

    tia: `
    <div class="test-section" data-test-type="tia" data-instance-index="{{INDEX}}">
        <h3 class="test-title">3. Repeterade Hopp (TIA) {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>VÄ Gen. hopphöjd:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p1_g3_va_jump{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>VÄ GCT:</label>
                        <div class="input-wrapper"><input type="number" step="0.01" id="p1_g3_va_gct{{INDEX}}"><span class="unit-text">s</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>HÖ Gen. hopphöjd:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p1_g3_ho_jump{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>HÖ GCT:</label>
                        <div class="input-wrapper"><input type="number" step="0.01" id="p1_g3_ho_gct{{INDEX}}"><span class="unit-text">s</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_tia{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_tia{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>Repeterade Hopp (TIA)</h3>
                <div id="p1-chart-tia{{INDEX}}" class="js-plotly-plot"></div>
            </div>
        </div>
    </div>`,

    sidehop: `
    <div class="test-section" data-test-type="sidehop" data-instance-index="{{INDEX}}">
        <h3 class="test-title">4. Sidhopp (TIA) {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>VÄ Antal:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g4_va_count{{INDEX}}"><span class="unit-text">st</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>HÖ Antal:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g4_ho_count{{INDEX}}"><span class="unit-text">st</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_sidehop{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_sidehop{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>Sidhopp (TIA)</h3>
                <div id="p1-chart-sidehop{{INDEX}}" class="js-plotly-plot"></div>
            </div>
        </div>
    </div>`,

    squat: `
    <div class="test-section" data-test-type="squat" data-instance-index="{{INDEX}}">
        <h3 class="test-title">5. Squat Analytics {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>Försök 1:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g5_attempt_1{{INDEX}}"><span class="unit-text">%</span></div>
                    </div>
                    <div class="input-row"><label>Försök 2:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g5_attempt_2{{INDEX}}"><span class="unit-text">%</span></div>
                    </div>
                    <div class="input-row"><label>Försök 3:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g5_attempt_3{{INDEX}}"><span class="unit-text">%</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_squat{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>Squat Analytics</h3>
                <div id="donut-container-{{INDEX}}" style="display:flex; justify-content:center; gap:10px;">
                    <div class="donut-wrapper"><div id="p1-chart-donut-1{{INDEX}}" class="js-plotly-plot"></div><p class="donut-label">Försök 1</p></div>
                    <div class="donut-wrapper"><div id="p1-chart-donut-2{{INDEX}}" class="js-plotly-plot"></div><p class="donut-label">Försök 2</p></div>
                    <div class="donut-wrapper"><div id="p1-chart-donut-3{{INDEX}}" class="js-plotly-plot"></div><p class="donut-label">Försök 3</p></div>
                </div>
            </div>
        </div>
    </div>`,

    repeated_bilateral: `
    <div class="test-section" data-test-type="repeated_bilateral" data-instance-index="{{INDEX}}">
        <h3 class="test-title">6. Repeated Jumps (Två Ben) {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>Gen. hopphöjd:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p1_g6_avg_height{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>Gen. GCT:</label>
                        <div class="input-wrapper"><input type="number" step="0.01" id="p1_g6_avg_gct{{INDEX}}"><span class="unit-text">s</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_repeated_bilateral{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>Repeated Jumps (Två Ben)</h3>
                <div id="p1-chart-repeated-bilateral{{INDEX}}" class="js-plotly-plot"></div>
            </div>
        </div>
    </div>`,

    cmj2ben: `
    <div class="test-section" data-test-type="cmj2ben" data-instance-index="{{INDEX}}">
        <h3 class="test-title">7. CMJ (TOV) Två Ben {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>Försök 1:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g7_attempt_1{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>Försök 2:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g7_attempt_2{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                    <div class="input-row"><label>Försök 3:</label>
                        <div class="input-wrapper"><input type="number" id="p1_g7_attempt_3{{INDEX}}"><span class="unit-text">cm</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_cmj2ben{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
             <div class="graph-container">
                <h3>CMJ (TOV) Två Ben</h3>
                <div id="donut-container-cmj2ben-{{INDEX}}" style="display:flex; justify-content:center; gap:10px;">
                    <div class="donut-wrapper"><div id="p1-chart-donut-cmj2ben-1{{INDEX}}" class="js-plotly-plot"></div><p class="donut-label">Försök 1</p></div>
                    <div class="donut-wrapper"><div id="p1-chart-donut-cmj2ben-2{{INDEX}}" class="js-plotly-plot"></div><p class="donut-label">Försök 2</p></div>
                    <div class="donut-wrapper"><div id="p1-chart-donut-cmj2ben-3{{INDEX}}" class="js-plotly-plot"></div><p class="donut-label">Försök 3</p></div>
                </div>
            </div>
        </div>
    </div>`,

    hipthrust: `
    <div class="test-section" data-test-type="hipthrust" data-instance-index="{{INDEX}}">
        <h3 class="test-title">8. Hip Thrusters Pull {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>Hip Thrust VÄ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g1_va{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                    <div class="input-row"><label>Hip Thrust HÖ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g1_ho{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>Två ben (Djur):</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g1_tva{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_hipthrust{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_hipthrust{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>Hip Thrusters Pull</h3>
                <div id="p2-chart-hipthrust{{INDEX}}" class="js-plotly-plot"></div>
                <div id="overlay-text-hipthrust{{INDEX}}" class="graph-overlay-text"></div>
            </div>
        </div>
    </div>`,

    quads: `
    <div class="test-section" data-test-type="quads" data-instance-index="{{INDEX}}">
        <h3 class="test-title">9. Quadriceps Isometrisk Styrka {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>Quadriceps VÄ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g2_va{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>Quadriceps HÖ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g2_ho{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_quads{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_quads{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>Quadriceps Isometrisk Styrka</h3>
                <div id="p2-chart-quads{{INDEX}}" class="js-plotly-plot"></div>
            </div>
        </div>
    </div>`,

    'staticsquat-handdrag': `
    <div class="test-section" data-test-type="staticsquat-handdrag" data-instance-index="{{INDEX}}">
        <h3 class="test-title">10. Static Squat (Hand) {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>VÄ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g3_va{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                    <div class="input-row"><label>HÖ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g3_ho{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>Två ben (Djur):</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g3_tva{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_squat_pull_handdrag{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_squat_pull_handdrag{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>Static Squat (Hand)</h3>
                <div id="p2-chart-squat-handdrag{{INDEX}}" class="js-plotly-plot"></div>
                <div id="overlay-text-squat-handdrag{{INDEX}}" class="graph-overlay-text"></div>
            </div>
        </div>
    </div>`,

    'staticsquat-hoftrem': `
    <div class="test-section" data-test-type="staticsquat-hoftrem" data-instance-index="{{INDEX}}">
        <h3 class="test-title">11. Static Squat (Höftrem) {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>VÄ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g4_va{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                    <div class="input-row"><label>HÖ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g4_ho{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>Två ben (Djur):</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g4_tva{{INDEX}}"><span class="unit-text">kg</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_squat_pull_hoftrem{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_squat_pull_hoftrem{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>Static Squat (Höftrem)</h3>
                <div id="p2-chart-squat-hoftrem{{INDEX}}" class="js-plotly-plot"></div>
                <div id="overlay-text-squat-hoftrem{{INDEX}}" class="graph-overlay-text"></div>
            </div>
        </div>
    </div>`,

    hamstring: `
    <div class="test-section" data-test-type="hamstring" data-instance-index="{{INDEX}}">
        <h3 class="test-title">12. Hamstring Isometrisk Styrka {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>Hamstring VÄ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g5_va{{INDEX}}"><span class="unit-text">N</span></div>
                    </div>
                    <hr class="input-separator">
                    <div class="input-row"><label>Hamstring HÖ:</label>
                        <div class="input-wrapper"><input type="number" step="0.1" id="p2_g5_ho{{INDEX}}"><span class="unit-text">N</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="asymmetry-display" id="asymmetry_hamstring{{INDEX}}"></div>
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_hamstring{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>Hamstring Isometrisk Styrka</h3>
                <div id="p2-chart-hamstring{{INDEX}}" class="js-plotly-plot"></div>
            </div>
        </div>
    </div>`,

    'nordic-hamstring': `
    <div class="test-section" data-test-type="nordic-hamstring" data-instance-index="{{INDEX}}">
        <h3 class="test-title">13. Nordic Hamstrings {{INDEX_LABEL}}</h3>
        <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="input-row"><label>Försök 1:</label>
                        <div class="input-wrapper"><input type="number" id="p2_g6_attempt_1{{INDEX}}"><span class="unit-text">N</span></div>
                    </div>
                    <div class="input-row"><label>Försök 2:</label>
                        <div class="input-wrapper"><input type="number" id="p2_g6_attempt_2{{INDEX}}"><span class="unit-text">N</span></div>
                    </div>
                    <div class="input-row"><label>Försök 3:</label>
                        <div class="input-wrapper"><input type="number" id="p2_g6_attempt_3{{INDEX}}"><span class="unit-text">N</span></div>
                    </div>
                </div>
                <div class="comment-container">
                    <div class="input-group"><label>Kommentar:</label><textarea id="comment_nordic_hamstring{{INDEX}}"></textarea><div class="comment-actions" style="display:flex; gap:8px; margin-top:5px;"><button type="button" class="btn-save-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Spara kommentar för detta test"><i class="fas fa-save"></i></button><button type="button" class="btn-load-comment" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:1.1rem;transition:0.2s;" title="Hämta sparade kommentarer"><i class="fas fa-list"></i></button></div></div>
                </div>
            </div>
            <div class="graph-container">
                <h3>Nordic Hamstrings</h3>
                <div id="donut-container-nordic-{{INDEX}}" style="display:flex; justify-content:center; gap:10px;">
                    <div class="donut-wrapper"><div id="p2-chart-donut-nordic-1{{INDEX}}" class="js-plotly-plot"></div><p class="donut-label">Försök 1</p></div>
                    <div class="donut-wrapper"><div id="p2-chart-donut-nordic-2{{INDEX}}" class="js-plotly-plot"></div><p class="donut-label">Försök 2</p></div>
                    <div class="donut-wrapper"><div id="p2-chart-donut-nordic-3{{INDEX}}" class="js-plotly-plot"></div><p class="donut-label">Försök 3</p></div>
                </div>
            </div>
        </div>
    </div>`,

    manual: `
    <div class="test-section" data-test-type="manual" data-instance-index="{{INDEX}}">
        <h3 class="test-title">14. Manuella Mätningar {{INDEX_LABEL}}</h3>
         <div class="test-row">
            <div class="input-column">
                <div class="input-container">
                    <div class="manual-measurements-grid">
                        <div class="manual-box">
                            <h4>Static Row Pull</h4>
                            <div class="input-group"><label>Tare (N):</label><input type="number" id="p2_text_srp_tare{{INDEX}}"></div>
                            <div class="input-group"><label>Force (N):</label><input type="number" id="p2_text_srp_force{{INDEX}}"></div>
                        </div>
                        <div class="manual-box">
                            <h4>Squat Power to Speed</h4>
                            <div class="input-group"><label>Vikt (kg):</label><input type="number" id="p2_text_spts_kg{{INDEX}}"></div>
                        </div>
                        <div class="manual-box">
                            <h4>Max Press Push Up</h4>
                            <div class="input-group"><label>Tare (N):</label><input type="number" id="p2_text_mpu_tare{{INDEX}}"></div>
                            <div class="input-group"><label>Force (N):</label><input type="number" id="p2_text_mpu_force{{INDEX}}"></div>
                        </div>
                        <div class="manual-box">
                            <h4>Blaze Pod Challenge</h4>
                            <div class="input-group"><label>Antal träffar:</label><input type="number" id="p2_text_bpc_hits{{INDEX}}"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`
};
