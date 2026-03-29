/**
 * Central registry for built-in, default protocols and custom tests.
 * These are injected globally into the application so all users have access to them.
 */

export const DEFAULT_CUSTOM_TESTS = [
    {
        id: "rtp_maximum_capacity",
        name: "Maximum Capacity",
        graphType: "paired-bar", // Matches Quadriceps Isometrisk Styrke style
        config: {
            yAxisTitle: "Jump High",
            metricNames: ["Jump High"],
            unit: "cm"
        },
        type: "custom" // Treat it as a custom test so it uses the dynamic template engine
    },
    {
        id: "rtp_endurance_landing",
        name: "Endurance & Landing control",
        graphType: "paired-bar",
        config: {
            yAxisTitle: "Accumulated High",
            metricNames: ["Accumulated High"],
            unit: ""
        },
        type: "custom"
    },
    {
        id: "rtp_reactive_strength",
        name: "Reactive Strength",
        graphType: "paired-bar",
        config: {
            yAxisTitle: "RSI",
            metricNames: ["RSI"],
            unit: ""
        },
        type: "custom"
    },
    {
        id: "rtp_lateral_control",
        name: "Lateral control",
        graphType: "paired-bar",
        config: {
            yAxisTitle: "nr of jumps",
            metricNames: ["nr of jumps"],
            unit: ""
        },
        type: "custom"
    }
];

export const DEFAULT_PROTOCOLS = [
    {
        id: "protocol_return_to_play",
        name: "Return To Play",
        testIds: [
            "custom_rtp_maximum_capacity",
            "custom_rtp_endurance_landing",
            "custom_rtp_reactive_strength",
            "custom_rtp_lateral_control"
        ]
    }
];
