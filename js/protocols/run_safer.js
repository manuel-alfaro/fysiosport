export const RUN_SAFER_PROTOCOL = {
    id: 'run_safer',
    name: 'Run Safer',
    
    generateProgram(sessionData, container) {
        if (!container) return;
        
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; background: rgba(0,0,0,0.4); border-radius: 8px; margin-top: 40px;">
                <i class="fas fa-tools" style="font-size: 48px; color: rgba(133, 255, 182, 0.4); margin-bottom: 24px;"></i>
                <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 300; font-size: 24px; color: #FFF; margin: 0 0 12px 0;">Under Construction</h3>
                <p style="font-family: 'Nimbus Sans', var(--font-main); font-size: 15px; color: rgba(255,255,255,0.5); max-width: 400px; line-height: 1.5;">The dynamic training algorithm for <strong>Run Safer</strong> is currently being configured.</p>
            </div>
        `;
    }
};
