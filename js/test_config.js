export const testConfigs = {
    // PAGE 1
    'balance': {
        template: 'dual-axis',
        title: 'STÅENDE BALANS 15S - UTAN RÖRELSE',
        config: {
            metricNames: ['Score', 'Gj. diff'],
            y1Title: 'Score',
            y2Title: 'cm',
            y1Decimals: 0,
            y2Decimals: 2
        },
        getData: (data) => {
            const d = data.page1.balance;
            if (!d) return null;
            return { leftVal1: d.leftScore, rightVal1: d.rightScore, leftVal2: d.leftDiff, rightVal2: d.rightDiff };
        }
    },
    'cmj': {
        template: 'grouped-bar',
        title: 'MAX HOPP CMJ (TOV)',
        config: {
            yTitle: 'Hopphøyde (cm)',
            labels: ['Hopp 1', 'Hopp 2', 'Hopp 3']
        },
        getData: (data) => {
            const d = data.page1.cmj;
            if (!d) return null;
            return { labels: ['Hopp 1', 'Hopp 2', 'Hopp 3'], vaValues: d.vaJumps, hoValues: d.hoJumps };
        }
    },
    'tia': {
        template: 'dual-axis',
        title: 'REPETERADE HOPP (TIA) ETT BEN I TAGET',
        config: {
            metricNames: ['Gj. hopp', 'GCT'],
            y1Title: 'cm',
            y2Title: 's',
            y1Decimals: 1,
            y2Decimals: 2
        },
        getData: (data) => {
            const d = data.page1.tia;
            if (!d) return null;
            return { leftVal1: d.leftJump, rightVal1: d.rightJump, leftVal2: d.leftGct, rightVal2: d.rightGct };
        }
    },
    'sidehop': {
        template: 'single-bar',
        title: 'SIDOHOPP (TIA) 1 FÖRSÖK PER BEN, ANTAL',
        config: {
            metricName: 'Antall',
            yAxisTitle: 'Antall (stk)',
            decimals: 0
        },
        getData: (data) => {
            const d = data.page1.sidehop;
            if (!d) return null;
            return { leftVal: d.leftCount, rightVal: d.rightCount };
        }
    },
    'squatAnalytics': {
        template: 'donut',
        title: 'Squat Analytics',
        config: { displayType: 'percent' },
        isMultiInstance: true, // Indicates this test renders 3 charts (Attempt 1, 2, 3)
        instances: ['Försök 1', 'Försök 2', 'Försök 3'],
        getData: (data) => {
            const d = data.page1.squatAnalytics;
            if (!d) return null;
            return [d.attempt1, d.attempt2, d.attempt3];
        }
    },
    'repeatedBilateral': {
        template: 'bilateral',
        title: 'REPETERADE HOPP (TIA) TVÅ BEN',
        config: {
            metricNames: ['Gj. hopp', 'Gj. GCT'],
            y1Title: 'cm',
            y2Title: 's'
        },
        getData: (data) => {
            const d = data.page1.repeatedBilateral;
            if (!d) return null;
            return { val1: d.avgHeight, val2: d.avgGct };
        }
    },
    'cmj2ben': {
        template: 'donut',
        title: 'CMJ (TOV) TVÅ BEN',
        config: { displayType: 'percent' },
        isMultiInstance: true,
        instances: ['Försök 1', 'Försök 2', 'Försök 3'],
        getData: (data) => {
            const d = data.page1.cmj2ben;
            if (!d) return null;
            return [d.attempt1, d.attempt2, d.attempt3];
        }
    },

    // PAGE 2
    'hipThrust': {
        template: 'paired-bar',
        title: 'HIP THRUSTERS PULL',
        config: {
            yAxisTitle: 'KG',
            metricNames: ['Force', ' '],
            decimals: 1
        },
        getData: (data) => {
            const d = data.page2.strengthTests.hipThrust;
            if (!d) return null;
            // Handle overlay data (TVA) separately or attached?
            // The template doesn't handle overlay logic. That's DOM logic.
            // I'll return extra props.
            return { leftVal1: d.left, rightVal1: d.right, overlayVal: d.tva, overlayImageId: 'overlay-image-I', overlayTextId: 'overlay-text-I' };
        }
    },
    'quadriceps': {
        template: 'paired-bar',
        title: 'QUADRICEPS ISOMETRISK STYRKA',
        config: {
            yAxisTitle: 'KG',
            metricNames: ['Force', ' '],
            decimals: 1
        },
        getData: (data) => {
            const d = data.page2.strengthTests.quadriceps;
            if (!d) return null;
            return { leftVal1: d.left, rightVal1: d.right };
        }
    },
    'staticsquatHanddrag': {
        template: 'paired-bar',
        title: 'STATIC SQUAT PULL - HANDDRAG',
        config: {
            yAxisTitle: 'KG',
            metricNames: ['Force', ' '],
            decimals: 1
        },
        getData: (data) => {
            const d = data.page2.strengthTests.staticsquatHanddrag;
            if (!d) return null;
            return { leftVal1: d.left, rightVal1: d.right, overlayVal: d.both, overlayImageId: 'overlay-image-handdrag', overlayTextId: 'overlay-text-handdrag' };
        }
    },
    'staticsquatHoftrem': {
        template: 'paired-bar',
        title: 'STATIC SQUAT PULL - HÖFTREM',
        config: {
            yAxisTitle: 'KG',
            metricNames: ['Force', ' '],
            decimals: 1
        },
        getData: (data) => {
            const d = data.page2.strengthTests.staticsquatHoftrem;
            if (!d) return null;
            return { leftVal1: d.left, rightVal1: d.right, overlayVal: d.both, overlayImageId: 'overlay-image-hoftrem', overlayTextId: 'overlay-text-hoftrem' };
        }
    },
    'hamstring': {
        template: 'paired-bar',
        title: 'HAMSTRING ISOMETRISK STYRKA',
        config: {
            yAxisTitle: 'Newton',
            metricNames: ['Force', ' '],
            decimals: 1
        },
        getData: (data) => {
            const d = data.page2.strengthTests.hamstring;
            if (!d) return null;
            return { leftVal1: d.left, rightVal1: d.right };
        }
    },
    'nordicHamstring': {
        template: 'donut',
        title: 'NORDIC HAMSTRINGS (TVÅ BEN)',
        config: { displayType: 'percent' },
        isMultiInstance: true,
        instances: ['Försök 1', 'Försök 2', 'Försök 3'],
        getData: (data) => {
            const d = data.page2.strengthTests.nordicHamstring;
            if (!d) return null;
            return [d.attempt1, d.attempt2, d.attempt3];
        }
    }
};
