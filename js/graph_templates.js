
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

export const graphTemplates = {
    // 1. Standard Paired Bar (Left/Right)
    'paired-bar': {
        name: 'Standard Paired Bar',
        create: (data, config) => {
            const vaColor = hexToRgba(getCssVar('--va-color'), 0.8);
            const hoColor = hexToRgba(getCssVar('--ho-color'), 0.8);
            const white = getCssVar('--white');
            const darkGray = getCssVar('--dark-gray');

            const { leftVal1, rightVal1 } = data;
            const { yAxisTitle, metricNames, decimals = 1 } = config;

            const leftTexts = [leftVal1.toFixed(decimals), ''];
            const rightTexts = [rightVal1.toFixed(decimals), ''];

            const maxY = Math.max(leftVal1, rightVal1, 0.1) * 1.25;
            const fontSize = Math.round(18 * globalScaleFactor);

            return {
                data: [
                    { type: 'bar', name: 'VÄ', x: [metricNames[0]], y: [leftVal1], marker: { color: vaColor }, text: [leftTexts[0]], textposition: 'inside', insidetextanchor: 'middle', textfont: { color: white, size: fontSize, angle: 0 }, hoverinfo: 'name+y', yaxis: 'y' },
                    { type: 'bar', name: 'HÖ', x: [metricNames[0]], y: [rightVal1], marker: { color: hoColor }, text: [rightTexts[0]], textposition: 'inside', insidetextanchor: 'middle', textfont: { color: white, size: fontSize, angle: 0 }, hoverinfo: 'name+y', yaxis: 'y' },
                    { type: 'bar', name: 'VÄ', x: [metricNames[1]], y: [0], marker: { color: 'rgba(0,0,0,0)' }, text: [''], hoverinfo: 'none', yaxis: 'y2', showlegend: false },
                    { type: 'bar', name: 'HÖ', x: [metricNames[1]], y: [0], marker: { color: 'rgba(0,0,0,0)' }, text: [''], hoverinfo: 'none', yaxis: 'y2', showlegend: false }
                ],
                layout: {
                    autosize: true, barmode: 'group',
                    font: { color: darkGray, family: 'Avenir, sans-serif', size: Math.round(14 * globalScaleFactor), weight: 400 },
                    yaxis: { title: yAxisTitle, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, range: [0, maxY], showgrid: false, zeroline: false },
                    yaxis2: { visible: false, range: [0, 1] },
                    xaxis: {
                        showgrid: false, zeroline: false, showline: false, showticklabels: true,
                        tickangle: 0, tickfont: { size: Math.round(14 * globalScaleFactor) },
                        automargin: true, fixedrange: true, categoryorder: 'array', categoryarray: metricNames, type: 'category'
                    },
                    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
                    legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "left", x: 0, font: { size: Math.round(14 * globalScaleFactor) } },
                    margin: { l: 40, r: 25, b: 75, t: 35, pad: 5 },
                    bargap: 0.4,
                    bargroupgap: 0.1
                }
            };
        }
    },

    // 2. Single Metric Bar (Single Value per Side)
    'single-bar': {
        name: 'Single Metric Bar',
        create: (data, config) => {
            const vaColor = hexToRgba(getCssVar('--va-color'), 0.8);
            const hoColor = hexToRgba(getCssVar('--ho-color'), 0.8);
            const white = getCssVar('--white');
            const darkGray = getCssVar('--dark-gray');

            const { leftVal, rightVal } = data;
            const { yAxisTitle, metricName, decimals = 1 } = config;
            const maxY = Math.max(leftVal, rightVal, 10) * 1.25;

            return {
                data: [
                    { type: 'bar', name: 'VÄ', x: [metricName], y: [leftVal], marker: { color: vaColor }, text: [leftVal.toFixed(decimals)], textposition: 'inside', textfont: { color: white }, hoverinfo: 'name+y' },
                    { type: 'bar', name: 'HÖ', x: [metricName], y: [rightVal], marker: { color: hoColor }, text: [rightVal.toFixed(decimals)], textposition: 'inside', textfont: { color: white }, hoverinfo: 'name+y' }
                ],
                layout: {
                    autosize: true, barmode: 'group',
                    font: { color: darkGray, family: 'Avenir', size: Math.round(14 * globalScaleFactor), weight: 400 },
                    yaxis: { title: yAxisTitle, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, range: [0, maxY], showgrid: true, zeroline: false },
                    xaxis: { showgrid: false, zeroline: false, showline: false, tickfont: { size: Math.round(14 * globalScaleFactor) }, automargin: true, fixedrange: true },
                    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
                    legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "center", x: 0.5, font: { size: Math.round(14 * globalScaleFactor) } },
                    margin: { l: 50, r: 20, b: 75, t: 35, pad: 5 },
                    bargroupgap: 0.1
                }
            };
        }
    },

    // 3. Three Bar (Left, Right, Both)
    'three-bar': {
        name: 'Three Bar Chart',
        create: (data, config) => {
            const vaColor = hexToRgba(getCssVar('--va-color'), 0.8);
            const hoColor = hexToRgba(getCssVar('--ho-color'), 0.8);
            const bothColor = hexToRgba('#1e88e5', 0.8);
            const white = getCssVar('--white');
            const darkGray = getCssVar('--dark-gray');

            const { leftVal, rightVal, bothVal } = data;
            const { yAxisTitle, decimals = 1, labels } = config;
            const maxY = Math.max(leftVal, rightVal, bothVal, 10) * 1.25;
            const xLabels = labels && labels.length === 3 ? labels : ['VÄ', 'HÖ', 'TVÅ BEN'];

            return {
                data: [{
                    type: 'bar', x: xLabels, y: [leftVal, rightVal, bothVal],
                    marker: { color: [vaColor, hoColor, bothColor] },
                    text: [leftVal.toFixed(decimals), rightVal.toFixed(decimals), bothVal.toFixed(decimals)],
                    textposition: 'inside', textfont: { color: white }, hoverinfo: 'x+y'
                }],
                layout: {
                    autosize: true, showlegend: false,
                    font: { color: darkGray, family: 'Avenir', size: Math.round(14 * globalScaleFactor), weight: 400 },
                    yaxis: { title: yAxisTitle, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, range: [0, maxY], showgrid: true, zeroline: false },
                    xaxis: { showgrid: false, zeroline: false, showline: false, tickfont: { size: Math.round(14 * globalScaleFactor) }, automargin: true, fixedrange: true },
                    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
                    margin: { l: 50, r: 20, b: 75, t: 35, pad: 5 },
                    bargap: 0.4
                }
            };
        }
    },

    // 4. Dual Axis Paired (Metric 1 Left/Right, Metric 2 Left/Right)
    'dual-axis': {
        name: 'Dual Axis Paired',
        create: (data, config) => {
            const vaColor = hexToRgba(getCssVar('--va-color'), 0.8);
            const hoColor = hexToRgba(getCssVar('--ho-color'), 0.8);
            const white = getCssVar('--white');
            const darkGray = getCssVar('--dark-gray');

            const { leftVal1, rightVal1, leftVal2, rightVal2 } = data;
            const { metricNames = ['V1', 'V2'], y1Title, y2Title, y1Decimals = 1, y2Decimals = 2 } = config;

            const m1 = metricNames[0] || 'V1';
            const m2 = metricNames[1] || 'V2';

            const maxY1 = Math.max(leftVal1 || 0, rightVal1 || 0, 0.1) * 1.25;
            const maxY2 = Math.max(leftVal2 || 0, rightVal2 || 0, 0.1) * 1.25;

            return {
                data: [
                    { type: 'bar', name: 'VÄ', x: [m1], y: [leftVal1 || 0], marker: { color: vaColor }, text: [(leftVal1 || 0).toFixed(y1Decimals)], textposition: 'inside', textfont: { color: white }, yaxis: 'y' },
                    { type: 'bar', name: 'HÖ', x: [m1], y: [rightVal1 || 0], marker: { color: hoColor }, text: [(rightVal1 || 0).toFixed(y1Decimals)], textposition: 'inside', textfont: { color: white }, yaxis: 'y' },
                    { type: 'bar', name: 'VÄ', x: [m2], y: [leftVal2 || 0], marker: { color: vaColor }, text: [(leftVal2 || 0).toFixed(y2Decimals)], textposition: 'inside', textfont: { color: white }, yaxis: 'y2', showlegend: false },
                    { type: 'bar', name: 'HÖ', x: [m2], y: [rightVal2 || 0], marker: { color: hoColor }, text: [(rightVal2 || 0).toFixed(y2Decimals)], textposition: 'inside', textfont: { color: white }, yaxis: 'y2', showlegend: false }
                ],
                layout: {
                    autosize: true, barmode: 'group',
                    font: { color: darkGray, family: 'Avenir', size: Math.round(14 * globalScaleFactor), weight: 400 },
                    yaxis: { title: y1Title, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, range: [0, maxY1], showgrid: false, zeroline: false },
                    yaxis2: { title: y2Title, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, overlaying: 'y', side: 'right', showgrid: false, zeroline: false, showline: false, range: [0, maxY2] },
                    xaxis: { showgrid: false, zeroline: false, showline: false, tickfont: { size: Math.round(14 * globalScaleFactor) }, automargin: true, fixedrange: true, categoryorder: 'array', categoryarray: [m1, m2], type: 'category' },
                    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
                    legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "center", x: 0.5, font: { size: Math.round(14 * globalScaleFactor) } },
                    margin: { l: 50, r: 65, b: 75, t: 35, pad: 5 },
                    bargap: 0.4, bargroupgap: 0.1
                }
            };
        }
    },
    // 5...
    'bilateral': {
        name: 'Bilateral Dual Axis',
        create: (data, config) => {
            const primaryColor = hexToRgba(getCssVar('--app-primary-color'), 0.8);
            const white = getCssVar('--white');
            const darkGray = getCssVar('--dark-gray');

            const { val1, val2 } = data;
            const { metricNames = ['V1', 'V2'], y1Title, y2Title } = config; // Robust default

            const maxY1 = (val1 || 0) * 1.25;
            const maxY2 = (val2 || 0) * 1.25;

            return {
                data: [
                    { type: 'bar', name: metricNames[0] || 'V1', x: [metricNames[0] || 'V1'], y: [val1 || 0], marker: { color: primaryColor }, text: [(val1 || 0).toFixed(1)], textposition: 'inside', textfont: { color: white }, yaxis: 'y' },
                    { type: 'bar', name: metricNames[1] || 'V2', x: [metricNames[1] || 'V2'], y: [val2 || 0], marker: { color: primaryColor }, text: [(val2 || 0).toFixed(2)], textposition: 'inside', textfont: { color: white }, yaxis: 'y2' }
                ],
                // ... same layout ...
                layout: {
                    autosize: true, showlegend: false,
                    font: { color: darkGray, family: 'Avenir', size: Math.round(14 * globalScaleFactor), weight: 400 },
                    yaxis: { title: y1Title, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, range: [0, maxY1], showgrid: false, zeroline: false },
                    yaxis2: { title: y2Title, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, overlaying: 'y', side: 'right', showgrid: false, zeroline: false, showline: false, range: [0, maxY2] },
                    xaxis: { showgrid: false, zeroline: false, showline: false, tickfont: { size: Math.round(14 * globalScaleFactor) }, automargin: true, fixedrange: true, categoryorder: 'array', categoryarray: metricNames, type: 'category' },
                    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
                    margin: { l: 50, r: 65, b: 75, t: 35, pad: 5 },
                    bargap: 0.5
                } // Bilateral
            };
        }
    },

    // 6... (Unchanged)
    'donut': {
        name: 'Donut Chart (Multi)',
        create: (data, config) => {
            const primaryColor = hexToRgba(getCssVar('--app-primary-color'), 0.8);
            const emptyColor = 'rgba(222, 226, 230, 0.8)';
            const darkGray = getCssVar('--dark-gray');

            // Data can be single value or array of values (e.g. [85, 92, 88])
            let values = [];
            if (Array.isArray(data.values)) values = data.values;
            else if (typeof data === 'object' && data.value) values = [data.value];
            else if (typeof data === 'number') values = [data];
            else if (Array.isArray(data)) values = data;
            else values = [0];

            const { displayType = 'percent' } = config || {};
            const traces = [];
            const annotations = [];

            // Layout based on number of values (1 to 3 supported nicely)
            const count = values.length;
            const domains = count === 1 ? [[0, 1]] : count === 2 ? [[0, 0.45], [0.55, 1]] : [[0, 0.30], [0.35, 0.65], [0.70, 1]];

            values.forEach((val, i) => {
                const domain = domains[i] || [0, 1]; // Fallback
                const xCenter = (domain[0] + domain[1]) / 2;

                let text = `${val || 0}`;
                if (displayType === 'percent') text += '%';

                if (displayType === 'percent') {
                    const barWidth = 360 * ((val || 0) / 100);
                    const polarName = i === 0 ? 'polar' : `polar${i + 1}`;

                    traces.push(
                        { type: "barpolar", r: [100], theta: [0], width: [360], marker: { color: emptyColor }, hoverinfo: "none", layer: 'below', subplot: polarName },
                        { type: "barpolar", r: [100], theta: [barWidth / 2], width: [barWidth], marker: { color: primaryColor }, hoverinfo: "none", subplot: polarName }
                    );

                    annotations.push({ font: { size: 14, weight: 'bold', color: darkGray }, showarrow: false, text: text, x: xCenter, y: 0.5, xref: 'paper', yref: 'paper', xanchor: 'center', yanchor: 'middle' });
                    // Labels
                    if (config.labels && config.labels[i]) {
                        annotations.push({ font: { size: 12, color: darkGray }, showarrow: false, text: config.labels[i], x: xCenter, y: -0.1, xref: 'paper', yref: 'paper', xanchor: 'center', yanchor: 'top' });
                    }

                } else {
                    traces.push({ type: "pie", values: [100], hole: 0.7, marker: { colors: [primaryColor] }, textinfo: "none", domain: { x: domain } });
                    annotations.push({ font: { size: 20, weight: 'bold', color: darkGray }, showarrow: false, text: text, x: xCenter, y: 0.5 });
                }
            });

            const layout = {
                showlegend: false, autosize: true,
                paper_bgcolor: 'rgba(0,0,0,0)', margin: { t: 20, b: 50, l: 5, r: 5 },
                annotations: annotations
            };

            // Configure Polars
            if (displayType === 'percent') {
                values.forEach((_, i) => {
                    const polarName = i === 0 ? 'polar' : `polar${i + 1}`;
                    const domain = domains[i];
                    layout[polarName] = {
                        domain: { x: domain, y: [0, 1] },
                        hole: 0.7, barmode: 'overlay', radialaxis: { visible: false, range: [0, 100] }, angularaxis: { visible: false },
                        bgcolor: 'rgba(0,0,0,0)'
                    };
                });
            }

            return { data: traces, layout: layout };
        }
    },

    'single-bars-3': {
        name: 'Single Bars (3 attempts)',
        create: (data, config) => {
            const primaryColor = hexToRgba(getCssVar('--app-primary-color'), 1.0); // Full Blue
            const white = getCssVar('--white');
            const darkGray = getCssVar('--dark-gray');

            let values = [];
            if (Array.isArray(data.values)) values = data.values;
            else if (typeof data === 'object' && data.value) values = [data.value];
            else values = [0, 0, 0];
            // Ensure values are numbers
            values = values.map(v => v || 0);

            const labels = config.labels || ['1', '2', '3'];
            const { yTitle, decimals = 1 } = config || {};
            const maxY = Math.max(...values, 10) * 1.2;

            return {
                data: [
                    {
                        type: 'bar',
                        x: labels,
                        y: values,
                        marker: { color: primaryColor },
                        text: values.map(v => v.toFixed(decimals)),
                        textposition: 'inside',
                        textfont: { color: white },
                        hovertemplate: '%{x}: %{y}<extra></extra>'
                    }
                ],
                layout: {
                    autosize: true,
                    font: { color: darkGray, family: 'Avenir', size: Math.round(14 * globalScaleFactor), weight: 400 },
                    yaxis: { title: yTitle || '', titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, range: [0, maxY], showgrid: false, zeroline: false },
                    xaxis: { showgrid: false, zeroline: false, showline: false, tickfont: { size: Math.round(14 * globalScaleFactor) }, automargin: true, fixedrange: true, type: 'category' }, // Force Categorical
                    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
                    margin: { l: 50, r: 20, b: 50, t: 35, pad: 5 },
                    bargap: 0.3
                }
            };
        }
    },

    // 7. Grouped Bar (General Support for 2 or 3 pairs)
    'grouped-bar': {
        name: 'Grouped Bar Chart',
        create: (data, config) => {
            const vaColor = hexToRgba(getCssVar('--va-color'), 0.8);
            const hoColor = hexToRgba(getCssVar('--ho-color'), 0.8);
            const white = getCssVar('--white');
            const darkGray = getCssVar('--dark-gray');

            const { labels, vaValues, hoValues } = data;
            const { yTitle } = config;
            const maxY = Math.max(...vaValues, ...hoValues, 10) + 10;

            return {
                data: [
                    { type: 'bar', name: 'VÄ', x: labels, y: vaValues, marker: { color: vaColor }, text: vaValues.map(String), textposition: 'inside', textfont: { color: white }, hovertemplate: 'VÄ: %{y}<extra></extra>' },
                    { type: 'bar', name: 'HÖ', x: labels, y: hoValues, marker: { color: hoColor }, text: hoValues.map(String), textposition: 'inside', textfont: { color: white }, hovertemplate: 'HÖ: %{y}<extra></extra>' }
                ],
                layout: {
                    autosize: true, barmode: 'group',
                    font: { color: darkGray, family: 'Avenir', size: Math.round(14 * globalScaleFactor), weight: 400 },
                    yaxis: { title: yTitle, titlefont: { size: Math.round(16 * globalScaleFactor) }, tickfont: { size: Math.round(14 * globalScaleFactor) }, range: [0, maxY], showgrid: false, zeroline: false },
                    xaxis: { showgrid: false, zeroline: false, showline: false, tickfont: { size: Math.round(14 * globalScaleFactor) }, automargin: true, fixedrange: true },
                    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
                    legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "center", x: 0.5, font: { size: Math.round(14 * globalScaleFactor) } },
                    margin: { l: 50, r: 20, b: 75, t: 35, pad: 5 },
                    bargroupgap: 0.1
                }
            };
        }
    },

    // 8. Donut/Gauge (Circular Progress) - For percentage-based metrics
    'donut': {
        name: 'Donut Gauge',
        create: (data, config) => {
            const darkGray = getCssVar('--dark-gray');
            const primaryColor = getCssVar('--primary-color') || '#4CAF50';

            const { value } = data;
            const { metricName = 'Värde', decimals = 0 } = config;

            // Clamp value between 0-100
            const clampedValue = Math.max(0, Math.min(100, value || 0));

            return {
                data: [{
                    type: 'indicator',
                    mode: 'gauge+number',
                    value: clampedValue,
                    number: {
                        suffix: '%',
                        font: {
                            size: Math.round(28 * globalScaleFactor),
                            color: darkGray
                        }
                    },
                    gauge: {
                        axis: {
                            range: [0, 100],
                            tickwidth: 1,
                            tickcolor: darkGray,
                            tickfont: { size: Math.round(12 * globalScaleFactor) }
                        },
                        bar: { color: primaryColor, thickness: 0.75 },
                        bgcolor: 'rgba(200, 200, 200, 0.2)',
                        borderwidth: 0,
                        bordercolor: 'transparent',
                        steps: [
                            { range: [0, 100], color: 'rgba(230, 230, 230, 0.3)' }
                        ],
                        threshold: {
                            line: { color: 'transparent', width: 0 },
                            thickness: 0,
                            value: 100
                        }
                    }
                }],
                layout: {
                    autosize: true,
                    font: {
                        color: darkGray,
                        family: 'Avenir, sans-serif',
                        size: Math.round(14 * globalScaleFactor)
                    },
                    margin: { t: 10, r: 10, l: 10, b: 10 },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    showlegend: false
                }
            };
        }
    },

    // 8. Placeholders for "14" if needed (Line, Scatter, Heatmap, etc.)
    'line-chart': { name: 'Line Chart (Placeholder)', create: () => ({ data: [], layout: {} }) },
    'scatter-plot': { name: 'Scatter Plot (Placeholder)', create: () => ({ data: [], layout: {} }) },
    'table': { name: 'Data Table', create: () => ({ data: [], layout: {} }) }
};

// Export helper functions for use in other modules
export { globalScaleFactor, hexToRgba, getCssVar };
