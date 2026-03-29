window.clinicalGenerator = {
    getTestConfig: function(testId, testNameParam) {
        if (window.activeProtocol && typeof window.activeProtocol.getTestConfig === 'function') {
            return window.activeProtocol.getTestConfig(testId, testNameParam);
        }
        return null;
    },

    buildList: function(array) {
        if(!array || !array.length) return '';
        return `<ul style="margin: 4px 0 0 0; padding-left: 20px; font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 14px; color: rgba(255,255,255,0.9); line-height: 20px;">
            ${array.map(item => `<li style="margin-bottom: 4px;">${item}</li>`).join('')}
        </ul>`;
    },

    getClinicalTestExplanation: function(testId, score, testNameParam) {
        const conf = this.getTestConfig(testId, testNameParam);
        if(!conf) return '';
        
        let headerColor = score < conf.threshold ? '#FF3D3D' : '#85FFB6';
        let headerText = score < conf.threshold ? `Training Focus (< 90%)` : `Maintain (> 90%)`;

        let statusText = score < conf.threshold 
            ? `<div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 14px; color: rgba(255,255,255,0.8); margin-bottom: 24px;"><strong>Deficit warning:</strong> Due to the asymmetry, it is critical to implement these focus areas to ensure progression.</div>`
            : `<div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 14px; color: rgba(255,255,255,0.8); margin-bottom: 24px;">Score > 90%. This is a strength. Maintain this quality by respecting the test's core mechanism.</div>`;

        let focusHtml = `
            <div style="padding: 24px; background: rgba(255,255,255,0.02); border: none; border-radius: 0;">
                <h4 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 14px; text-transform: uppercase; color: ${headerColor}; margin: 0 0 16px 0; letter-spacing: 1px;">${headerText}</h4>
                ${statusText}

                <div style="display: flex; gap: 16px; width: 100%; flex-wrap: wrap;">
                    <div style="flex: 1; background: rgba(255,255,255,0.03); padding: 20px; border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; min-width: 200px;">
                        <h5 style="color: #FFF; font-size: 14px; margin: 0; font-weight: 400;">Focus:</h5>
                        ${this.buildList(conf.focus)}
                    </div>
                    <div style="flex: 1; background: rgba(255,255,255,0.03); padding: 20px; border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; min-width: 200px;">
                        <h5 style="color: #FFF; font-size: 14px; margin: 0; font-weight: 400;">Training Principles:</h5>
                        ${this.buildList(conf.principles)}
                    </div>
                    <div style="flex: 1; background: rgba(255,255,255,0.03); padding: 20px; border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; min-width: 200px;">
                        <h5 style="color: #FFF; font-size: 14px; margin: 0; font-weight: 400;">Examples:</h5>
                        ${this.buildList(conf.examples)}
                    </div>
                </div>
            </div>
        `;

        return `
            <div style="display: flex; flex-direction: column;">
                <div style="display: flex; gap: 24px; margin-bottom: 24px;">
                    ${conf.videoUrl ? `
                    <div style="flex: 0 0 120px; border-radius: 8px; overflow: hidden; height: 210px; background: #000; position: relative; z-index: 10;">
                        <video src="${conf.videoUrl}" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover; position: relative; z-index: 10;"></video>
                    </div>
                    ` : ''}
                    <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start; font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8); position: relative; z-index: 10;">
                        <div style="color: #FFF; font-weight: 500; font-size: 16px; margin-bottom: 8px;">${conf.metricsDesc}</div>
                        <div style="color: rgba(255,255,255,0.7);">${conf.interpretation(score)}</div>
                    </div>
                </div>
                ${focusHtml}
            </div>
        `;
    },

    getSessionClinicalSummary: function(scoresArray, avgScore) {
        if (!scoresArray || scoresArray.length === 0) return '';

        let under90 = [];
        let over90 = [];

        scoresArray.forEach(s => {
            const c = this.getTestConfig(s.testId, s.testName);
            if(c) {
                if(s.score < 90) under90.push({score: s.score, conf: c, id: s.testId, name: s.testName});
                else over90.push({score: s.score, conf: c, id: s.testId, name: s.testName});
            }
        });

        under90.sort((a,b) => a.score - b.score);
        
        let buckets = [];
        let currentBucket = [];
        let bucketBaseScore = null;

        for (let i = 0; i < under90.length; i++) {
            let item = under90[i];
            if (currentBucket.length === 0) {
                currentBucket.push(item);
                bucketBaseScore = item.score;
            } else {
                if (item.score <= bucketBaseScore + 8) {
                    currentBucket.push(item);
                } else {
                    buckets.push(currentBucket);
                    currentBucket = [item];
                    bucketBaseScore = item.score;
                }
            }
        }
        if (currentBucket.length > 0) {
            buckets.push(currentBucket);
        }

        let html = `
            <div style="display: flex; flex-direction: column; gap: 24px; background: rgba(255,255,255,0.02); padding: 32px; margin-top: 40px; margin-bottom: 24px;">
                <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 24px; color: #FFFFFF; margin: 0;">Analysis Summary & Focus</h3>
                
                <!-- Average Explanation -->
                <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">
                    The session average across tests is <strong>${avgScore}%</strong>. Capacities are measured relatively against the healthy side.
                </div>
        `;

        if (over90.length > 0) {
            let n = over90.map(x => `"${x.conf.title}" (${x.score}%)`).join(', ');
            html += `
                <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(133,255,182,0.9);">
                    <strong style="color: #85FFB6; font-weight: 400;">Strengths (over 90%):</strong><br/>
                    Qualities like ${n} are intact and approved. These should be strictly maintained.
                </div>
            `;
        }

        if (buckets.length > 0) {
            html += `
                <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">
                    <strong style="color: #FFF; font-weight: 400;">Primary Deficits & Programming Priorities:</strong><br/>
                    Deficits are grouped dynamically. Tests within 8% of the weakest link share the same priority block.
                </div>
            `;
            
            const renderBucket = (bucket, title, color) => {
                if(bucket.length === 0) return '';
                let bHtml = `<h4 style="font-family: 'Nimbus Sans', var(--font-main); font-size: 14px; color: ${color}; text-transform: uppercase; margin: 16px 0 8px 0; font-weight: 400;">${title}</h4>`;
                bucket.forEach(f => {
                    bHtml += `
                    <div style="background: rgba(255, 255, 255, 0.05); border-left: 3px solid ${color}; padding: 16px; margin-bottom: 12px; border-radius: 4px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; color: #FFF; text-transform: uppercase;">${f.name}</span>
                            <span style="font-family: '188 Pixel', monospace; font-size: 18px; color: ${color};">${f.score}%</span>
                        </div>
                        <span style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 14px; color: rgba(255,255,255,0.8); line-height: 20px;">
                            ${f.conf.keyDifference}<br/>
                            <div style="margin-top: 8px; font-size: 13px; color: rgba(255,255,255,0.5);"><strong>Exercises:</strong> ${f.conf.examples.join(', ')}</div>
                        </span>
                    </div>
                    `;
                });
                return bHtml;
            };

            const titles = ["Primary Focus", "Secondary Focus", "Tertiary Focus", "Minor Focus"];
            const colors = ['#FF3D3D', '#F6B45E', '#FFEB85', '#FFF'];

            buckets.forEach((b, index) => {
                let t = titles[index] || `Priority Level ${index + 1}`;
                let c = colors[index] || '#FFF';
                html += renderBucket(b, t, c);
            });
            
        } else {
            html += `
                <div style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 15px; line-height: 24px; color: rgba(133,255,182,0.9);">
                    Excellent! All mapped qualities are > 90%. The client is clear for Return to Play.
                </div>
            `;
        }

        html += `
                <!-- Central Focus Key Placeholder -->
                <div style="margin-top: 16px; padding: 16px; border: 1px dashed rgba(255,255,255,0.2); border-radius: 0;">
                    <h5 style="color: #FFF; font-size: 14px; margin: 0 0 8px 0; font-weight: 400;">Training Note (HOW to perform):</h5>
                    <div style="font-size: 14px; color: rgba(255,255,255,0.8); line-height: 20px;">
                        The main difference between the tests is not the exercises — it is HOW they are performed:
                        <ul style="margin: 8px 0 0 0; padding-left: 16px;">
                            <li><strong>Test 1:</strong> Max force, full ROM, full recovery</li>
                            <li><strong>Test 2:</strong> Repeated effort, control, higher fatigue</li>
                            <li><strong>Test 3:</strong> Very fast, very short GCT, minimal movement</li>
                            <li><strong>Test 4:</strong> Lateral, functional, directional control</li>
                        </ul>
                    </div>
                </div>
        `;

        html += `</div>`;
        return html;
    }
};
