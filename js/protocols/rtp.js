export const RTP_PROTOCOL = {
    id: "protocol_return_to_play",
    name: "Return To Play",
    
    // Clinical Explanations for the specific RTP Tests
    getTestConfig: function(testId, testNameParam) {
        const idLower = (testId || '').toLowerCase();
        const nameLower = (testNameParam || '').toLowerCase();
        
        const match = (str1, str2) => idLower.includes(str1) || idLower.includes(str2) || nameLower.includes(str1) || nameLower.includes(str2);

        if (match('cmj', 'maximum_capacity') && !match('repeated', 'endurance')) {
            return {
                title: 'Maximum Capacity',
                metricsDesc: 'Evaluates the absolute ceiling of pure force and raw power production.',
                interpretation: score => {
                    if (score >= 90) return `At ${score}% symmetry, max force capacity is fully intact. No foundational restrictions.`;
                    if (score >= 75) return `At ${score}% symmetry, strength is well within Phase 3 tolerances. Maximal plyometric loads are safe to perform.`;
                    if (score >= 65) return `At ${score}% symmetry, force production suggests a Phase 2 approach. Prioritize repeated submaximal tasks before progressing to explosive leaps.`;
                    return `At ${score}% symmetry, this severe deficit suggests restricting the program to Phase 1: heavy, controlled strength exercises with plyometrics explicitly locked.`;
                },
                threshold: 90,
                focus: ['Max strength', 'Full range of motion', 'Max explosive power'],
                principles: ['Heavy resistance training (4–6 RM)', 'Full depth / full ROM', 'Max intent in every rep', 'Plyometrics with full recovery'],
                examples: ['Squat / Trap bar deadlift', 'Bulgarian split squat', 'CMJ / box jumps'],
                videoUrl: 'https://storage.googleapis.com/intro_alphatek/RTP_Videos/RTP_Test1_onlyjump-1.mov'
            };
        }
        else if (match('repeated', 'endurance')) {
            return {
                title: 'Endurance & Landing Control',
                metricsDesc: 'Evaluates the ability to absorb eccentric force and maintain clean landing mechanics under fatigue.',
                interpretation: score => {
                    if (score >= 90) return `At ${score}% symmetry, landing mechanics and structural endurance are excellent. No volume restrictions applied.`;
                    if (score >= 75) return `At ${score}% symmetry (Phase 3), landing endurance is sufficient to safely tolerate fast, reactive plyometrics.`;
                    if (score >= 65) return `At ${score}% symmetry, endurance deficits explicitly drop the program to Phase 2. Focus strictly on submaximal repeated tasks and isolated landing mechanics.`;
                    return `At ${score}% symmetry, severe landing fatigue keeps the client in Phase 1. True jump training is suspended until fundamental capacity improves.`;
                },
                threshold: 90,
                focus: ['Landing mechanics', 'Eccentric control', 'Anaerobic endurance'],
                principles: ['Repeated plyometric work', 'Higher ground contact time than reactive work', 'Focus on control over time', 'Higher reps, moderate load'],
                examples: ['Repeated CMJ', 'Drop jumps (controlled landing)', 'Step-downs', 'Balance / stability drills', 'Split squats (higher reps)'],
                videoUrl: 'https://storage.googleapis.com/intro_alphatek/RTP_Videos/RTP_Test2_onlyjump-1.mov'
            };
        }
        else if (match('pogo', 'reactive_strength')) {
            return {
                title: 'Reactive Strength',
                metricsDesc: 'Evaluates ankle stiffness and the stretch-shortening cycle with minimal ground contact time.',
                interpretation: score => {
                    if (score >= 90) return `At ${score}% symmetry, ankle stiffness is fully intact. The client is cleared for maximal reactive performance execution.`;
                    if (score >= 75) return `At ${score}% symmetry (Phase 3), the client has unlocked true elastic stiffness capacity allowing maximal plyometric loads.`;
                    if (score >= 65) return `At ${score}% symmetry, stiffness is too low for true plyometrics (restricted to Phase 2). Focus on introductory bounding with controlled ground contacts.`;
                    return `At ${score}% symmetry, reactive strength is severely compromised (Phase 1). Completely avoid all bouncy, short ground-contact plyometrics.`;
                },
                threshold: 90,
                focus: ['Very short ground contact time', 'Ankle stiffness', 'Functional speed (sprint / agility)'],
                principles: ['Plyometrics with minimal knee and hip flexion', 'Much shorter GCT than Test 2', 'Fast, reactive movements', 'Strength with short ROM and explosive intent'],
                examples: ['Pogo jumps (single-leg)', 'Sprint drills', 'Agility drills', 'Heavy calf raises', 'Explosive strength (short ROM)'],
                videoUrl: 'https://storage.googleapis.com/intro_alphatek/RTP_Videos/RTP_Test3_onlyjump-1.mov'
            };
        }
        else if (match('lateral', 'agility') || match('motor', 'control')) {
            return {
                title: 'Lateral Stability',
                metricsDesc: 'Evaluates frontal plane stability, force absorption, and change-of-direction control.',
                interpretation: score => {
                    if (score >= 90) return `At ${score}% symmetry, frontal plane stability is perfectly intact. Cleared for unrestricted multidirectional speed and cutting.`;
                    if (score >= 75) return `At ${score}% symmetry (Phase 3), lateral mechanics are sufficient for intense agility and maximal change-of-direction tasks.`;
                    if (score >= 65) return `At ${score}% symmetry (Phase 2), strictly utilize controlled, submaximal lateral jumps and bounds before engaging top-speed agility.`;
                    return `At ${score}% symmetry (Phase 1), severe lateral instability requires immediate foundational focus on closed-chain single-leg control without explosive lateral leaps.`;
                },
                threshold: 90,
                focus: ['Lateral stability', 'Change of direction', 'Single-leg control'],
                principles: ['Functional, sport-like movements', 'Lateral force production and absorption', 'Progress speed and complexity'],
                examples: ['Lateral jumps (single-leg)', 'Lateral bounds', 'Change of direction drills', 'Lateral lunges'],
                videoUrl: 'https://storage.googleapis.com/intro_alphatek/RTP_Videos/RTP_Test4_onlyjump-1.mov'
            };
        }
        return null;
    },

    // Training Generator Specifics
    getTrainingSubtitleHTML: function() {
        return `<div style="margin-bottom: 32px; width: 100%;">
            <div style="font-size: 18px; font-weight: 400; color: #FFF; margin-bottom: 8px;">2-Session Training Block</div>
            <div style="color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 16px;">The system dynamically suggests training phases based on the client's lowest capacities:</div>
            
            <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px;">
                <div style="flex: 1; min-width: 180px; background: rgba(255,255,255,0.02); padding: 24px; border-radius: 4px; border: none; display: flex; flex-direction: column; position: relative; overflow: hidden;">
                    <div style="position: absolute; width: 220px; height: 220px; top: -110px; left: -110px; background: #FF3D3D; opacity: 0.15; border-radius: 50%; filter: blur(40px); pointer-events: none;"></div>
                    <span style="font-family: '188 Pixel', monospace, sans-serif; font-size: 32px; color: #FFF; margin-bottom: 16px; line-height: 1; position: relative; z-index: 2;">&lt;65%</span>
                    <div style="display: flex; flex-direction: column; position: relative; z-index: 2;">
                        <div style="color: #FFF; font-weight: 700; font-size: 11px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Phase 1</div>
                        <div style="color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.5;">Heavy foundational strength and isolated landing mechanics. Jump training and plyometrics explicitly locked.</div>
                    </div>
                </div>
                <div style="flex: 1; min-width: 180px; background: rgba(255,255,255,0.02); padding: 24px; border-radius: 4px; border: none; display: flex; flex-direction: column; position: relative; overflow: hidden;">
                    <div style="position: absolute; width: 220px; height: 220px; top: -110px; left: -110px; background: #F6B45E; opacity: 0.15; border-radius: 50%; filter: blur(40px); pointer-events: none;"></div>
                    <span style="font-family: '188 Pixel', monospace, sans-serif; font-size: 32px; color: #FFF; margin-bottom: 16px; line-height: 1; position: relative; z-index: 2;">65%</span>
                    <div style="display: flex; flex-direction: column; position: relative; z-index: 2;">
                        <div style="color: #FFF; font-weight: 700; font-size: 11px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Phase 2</div>
                        <div style="color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.5;">Controlled submaximal tasks and repeated endurance capacities dynamically introduced.</div>
                    </div>
                </div>
                <div style="flex: 1; min-width: 180px; background: rgba(255,255,255,0.02); padding: 24px; border-radius: 4px; border: none; display: flex; flex-direction: column; position: relative; overflow: hidden;">
                    <div style="position: absolute; width: 220px; height: 220px; top: -110px; left: -110px; background: #FFD700; opacity: 0.15; border-radius: 50%; filter: blur(40px); pointer-events: none;"></div>
                    <span style="font-family: '188 Pixel', monospace, sans-serif; font-size: 32px; color: #FFF; margin-bottom: 16px; line-height: 1; position: relative; z-index: 2;">75%</span>
                    <div style="display: flex; flex-direction: column; position: relative; z-index: 2;">
                        <div style="color: #FFF; font-weight: 700; font-size: 11px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Phase 3</div>
                        <div style="color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.5;">True elastic stiffness and intensive reactive plyometric loads unlocked for loading.</div>
                    </div>
                </div>
                <div style="flex: 1; min-width: 180px; background: rgba(255,255,255,0.02); padding: 24px; border-radius: 4px; border: none; display: flex; flex-direction: column; position: relative; overflow: hidden;">
                    <div style="position: absolute; width: 220px; height: 220px; top: -110px; left: -110px; background: #85FFB6; opacity: 0.15; border-radius: 50%; filter: blur(40px); pointer-events: none;"></div>
                    <span style="font-family: '188 Pixel', monospace, sans-serif; font-size: 32px; color: #FFF; margin-bottom: 16px; line-height: 1; position: relative; z-index: 2;">&gt;90%</span>
                    <div style="display: flex; flex-direction: column; position: relative; z-index: 2;">
                        <div style="color: #FFF; font-weight: 700; font-size: 11px; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Performance</div>
                        <div style="color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.5;">Maintenance phase. No major functional deficits. Safely cleared for unrestricted maximal performance execution.</div>
                    </div>
                </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.05); padding: 16px 24px; display: inline-flex; align-items: center; justify-content: center; font-weight: 500; font-size: 13px; color: rgba(255,255,255,0.9); width: 100%; box-sizing: border-box; text-transform: uppercase; letter-spacing: 1px;">
                Retest to know where to go next phase <i class="fas fa-arrow-right" style="margin-left: 12px; opacity: 0.5;"></i>
            </div>
        </div>`;
    },

    getTrainingPhaseMetrics: function(worstScore) {
        if (worstScore < 65) return 'severe';
        if (worstScore < 75) return 'moderate';
        return 'mild';
    },

    getTrainingSetsReps: function(severityPhase) {
        if (severityPhase === 'severe') return { sets: 3, reps: 8 };
        if (severityPhase === 'moderate') return { sets: 3, reps: 6 };
        return { sets: 3, reps: 5 };
    },

    exerciseDatabase: {
        severe: { // < 70%
            force: [
                { name: "Squat (Controlled Tempo)", cue: "Stand with feet shoulder-width apart. Lower yourself slowly and with total control (e.g., 3 seconds down) by bending your knees and pushing your hips back. Go as deep as your mobility comfortably allows, and push back up to a standing position without bouncing at the bottom." },
                { name: "Trap Bar Deadlift", cue: "Use a trap-bar (hex bar). Stand in the center, bend your knees and hips, and grip the handles. Keep your chest up and your back straight. Push the floor away with your feet, extending your hips and knees simultaneously until fully upright." },
                { name: "Bulgarian Split Squat", cue: "Place your rear foot on a bench or box behind you. Keep your torso upright and lower your hips straight down toward the floor until your front thigh is parallel. Push back up using exclusively the power of your front leg." },
                { name: "Step-ups", cue: "Place one foot flat on a sturdy box. Drive through the heel of the foot on the box to push yourself all the way up to a standing position. Lower yourself slowly and under full control back to the starting position." },
                { name: "Hip Thrust", cue: "Sit on the floor with your upper back resting against a bench. Place your feet flat on the floor shoulder-width apart. Drive through your heels and push your hips toward the ceiling until your body forms a straight line. Squeeze your glutes hard at the top before lowering under control." }
            ],
            endurance: [
                { name: "Single-Leg Squat to Box", cue: "Stand on one leg facing away from a box or bench. Slowly lower yourself by bending your knee and hip until you feel your glutes lightly touch the box. Stand back up immediately without resting your weight on the box and without losing your balance." },
                { name: "Step-down (Slow Eccentric)", cue: "Stand with one leg on a box while the other hangs freely off the edge. Bend the knee of the standing leg and lower yourself extremely slowly (up to 4 seconds) toward the floor until the free foot lightly touches the ground. Use both legs to stand back up." },
                { name: "Split Squat (Tempo)", cue: "Stand in a staggered stance with one foot strictly in front of the other. Lower your hips slowly toward the floor (3 to 4 seconds) until your rear knee almost touches the ground. Push back up under strict control without losing your balance." },
                { name: "Isometric Hold (Lunge)", cue: "Start in a lunge position. Lower yourself until both knees are bent at approximately 90-degree angles. Hold this absolute bottom position completely still, focusing entirely on preventing any shaking or loss of posture." },
                { name: "Single-Leg Balance Drills", cue: "Stand on one leg with a slight bend in the knee. Keep your torso completely stable and upright. Fix your gaze on a single point and actively use your ankle and hip to maintain balance for an extended period." }
            ],
            stiffness: [
                { name: "Heavy Calf Raises", cue: "Stand with the ball of your foot on an elevation, letting your heel hang off the edge. Press straight up onto your toes as high as possible. Lower yourself extremely slowly until you feel a deep stretch in your calf." },
                { name: "Isometric Calf Hold", cue: "Stand on both legs or one leg. Lift your heels fully off the ground to maximum height, and hold this top position entirely statically. Focus on keeping your entire body stable without losing balance or letting the heels drop." },
                { name: "Tibialis Raises", cue: "Stand with your back against a wall and your feet a short distance in front of you. Keeping your heels planted, lift your toes as high toward your shins as possible. Lower them back down with full control and repeat." },
                { name: "Slow Pogo Jumps", cue: "Perform small, light bounces where almost all the force comes from your ankles. Keep your knees relatively straight and land softly on the balls of your feet. Focus strictly on rhythm and technique, not on maximum jump height." },
                { name: "Jump Rope (Slow)", cue: "Jump rope at a slow, steady pace. Perform light, small bounces on both feet simultaneously. The primary goal is to establish a stable rhythm, keeping movements minimal and your upper body relaxed." }
            ],
            lateral: [
                { name: "Lateral Step-down", cue: "Stand sideways with the edge of your foot on the very edge of a box, letting the other leg hang free. Bend the knee on the box and lower yourself sideways with maximum control. Focus heavily on preventing the knee from collapsing inward." },
                { name: "Lateral Lunges", cue: "Stand with feet together. Take a wide step directly out to the side. Bend the knee of the leg you stepped out with and sit your hips back while keeping the other leg perfectly straight. Push off explosively to return to the starting position." },
                { name: "Single-Leg Balance (Perturbation)", cue: "Stand on one leg. Your balance will be challenged here, either by closing your eyes, using an uneven surface, or by having a partner apply very light pushes against your shoulders. Fight to maintain balance without letting your free leg rotate." },
                { name: "Copenhagen Plank", cue: "Lie on your side and place your top foot securely on a bench (the bottom foot rests on the floor). Lift yourself into a side plank so the line from your shoulders to your ankles is perfectly straight. This demands high control from the inner thigh." },
                { name: "Controlled Lateral Step and Hold", cue: "Stand in a neutral position. Take a deliberate and relatively quick leaping step straight out to the side on one leg, and 'freeze' the movement instantly as your foot hits the ground. Stand there completely still before resetting." }
            ],
            base: [
                { name: "Goblet Squat", cue: "Hold a dumbbell or kettlebell vertically directly in front of your chest with both hands. Stand with your feet slightly wider than shoulder-width apart, bend your knees and hips, and sink down while keeping your chest held very high and proud." },
                { name: "Romanian Deadlift", cue: "Stand upright holding weights in front of your hips with a slight bend in your knees. Initiate the movement exclusively by pushing your hips as far back as you can. Keep your back neutral. Push your hips forward once you feel a strong stretch in your hamstrings." },
                { name: "Pallof Press", cue: "Stand sideways to a cable machine or resistance band. Hold the handle firmly in the middle of your chest with both hands. Press your hands straight forward and actively resist the forces attempting to rotate your torso toward the machine." }
            ]
        },
        moderate: { // 70-80%
            force: [
                { name: "Loaded Squat Jumps", cue: "Hold a very light dumbbell or kettlebell, or wear a light weighted vest. Perform a fast, shallow squat dip and immediately explode upward into a vertical jump. Land smoothly and reset before the next repetition." },
                { name: "Box Jumps (Low Box)", cue: "Stand with your feet together in front of a relatively low box. Perform a quick dip in your hips and jump onto the box. Dedicate most of your attention to executing a soft, symmetrical, and completely flawless landing (like a ninja)." },
                { name: "Vertical Medicine Ball Toss", cue: "Stand holding a medicine ball down near your knees. In one continuous, highly explosive movement—primarily driving with your hips and legs—toss the ball as high straight up into the air as you possibly can." }
            ],
            endurance: [
                { name: "Small Repeated Jumps", cue: "Perform continuous, unbroken jumps with both feet. Jump at a low to medium height without any pauses between landings. The most important aspect is that the rhythm feels incredibly tight and elastic from the first to the last rep." },
                { name: "Repeated Bounds (Submaximal)", cue: "Perform flying leaps forward in an exaggerated running motion (bounding). Keep the physical intensity deliberately down around 75%. Focus on ensuring the ground contact and landing feel rock-solid before pushing off into the next stride." },
                { name: "Alternating Split Jumps", cue: "Start in a deep lunge position. Jump forcefully straight up into the air. While suspended in the air, quickly switch your feet back and forth so you land in a new, fully controlled lunge with the opposite leg positioned forward." }
            ],
            stiffness: [
                { name: "Pogo Jumps (Increasing Speed)", cue: "Bounce continuously on the ground using almost exclusively your ankles. Accelerate the tempo in steps so your foot's contact time with the floor becomes shorter and shorter with every impact." },
                { name: "Line Hops", cue: "Place a rope or mark a line on the floor. Jump with both feet straight and remarkably fast either forward and back, or side to side over the line. Keep your hips highly stable while your feet glide back and forth as quickly as possible." },
                { name: "Quick Skips", cue: "Perform traditional forward 'skipping' steps. Work with extremely light impacts where the soles of your feet merely tap and instantly scorch off the floor again. The rhythm and frequency completely take precedence over the height achieved." }
            ],
            lateral: [
                { name: "Small Lateral Jumps", cue: "Stand with your feet close together. Jump very quickly, but at a low height, from side to side (roughly the width of a training mat). The main focus is on aggressive push-off angles before the ankle collapses." },
                { name: "Controlled Change of Direction Drills", cue: "Run forward under control for three to five meters, freeze the movement instantly by abruptly planting your outside foot diagonally into the ground, and immediately accelerate into a completely new angle." },
                { name: "Lateral Bounds (Submaximal)", cue: "Stand on one leg. Push off sideways, soar laterally through the air, and land safely on the exact opposite leg. The intensity should not be too high—only high enough to firmly glue the balance upon landing." }
            ],
            base: [
                { name: "Bulgarian Split Squat (Explosive)", cue: "Place your rear foot on a bench at hip height. Lower your hips normally to build potential energy. The critical difference here is that you must simultaneously drive your torso up at extreme speed when returning to the top." },
                { name: "Single Leg Romanian Deadlift", cue: "Stand on one leg with a slight bend in the knee. Carefully hinge your torso forward like a lever by pushing your hips back, and return upright. The danger here is pelvic rotation—ensure your hips remain 100% parallel to the floor." },
                { name: "Double Leg Jump (Landing Control)", cue: "Jump vertically into the air. Before catching the landing, fixate entirely on both thigh muscles absorbing the impact absolutely symmetrically without any wobbling. If weight shifts to one side, it is too heavy." }
            ]
        },
        mild: { // > 80%
            force: [
                { name: "Counter Movement Jump (Maximal Height)", cue: "Jump from a completely stationary standing position. Drop your hips very swiftly straight down to utilize muscular stiffness, then unconditionally explode—you must literally jump as high as humanly possible." },
                { name: "Box Jump (Maximal Height)", cue: "Challenge a remarkably high, yet safe, elevated jump box. Accelerate all your bodyweight and jump forcefully from ground level to land on top. Very soft and deep landings at the apex demonstrate raw power efficiency." },
                { name: "Trap Bar Jumps", cue: "Use a trap-bar loaded with a moderate weight. Stand perfectly in the center and jump extremely powerfully straight up from the starting position. Remain highly focused on ensuring your landing happens exactly where you began." }
            ],
            endurance: [
                { name: "Repeated Counter Movement Jumps (30 Seconds)", cue: "Set a timer for 30 seconds. Jump consecutively, create a rapid drop, catch the floor forcefully, and explode upward. The overarching goal is not to lose any visible explosiveness from start to finish." },
                { name: "Drop Jumps", cue: "This is performed by passively stepping (falling, not jumping) off the edge of a 30cm box. The exact millisecond both forefoot plates hit the ground, react like white-hot steel to shoot straight back out of the floor." },
                { name: "Single Leg Eccentric Step Downs (Fast)", cue: "Stand vertically bearing all your weight on a tall box. You will literally fall or forcefully drop your entire body mass exclusively onto one leg in a fraction of a second, absorbing all force instantly before stopping entirely." }
            ],
            stiffness: [
                { name: "Single Leg Pogo Jumps (Maximal)", cue: "Similar to two-legged ankle hops, but funneling all the challenge entirely into one leg. Focus heavily on ground contact that is as snappy as a track sprinter. Flex the ankle and calf very aggressively!" },
                { name: "Drop Jumps (Reactive)", cue: "Deliberately drop from the box, and completely ignore the jump height—the absolutely essential metric here is minimizing contact time. It should literally sound like two instantaneous ‘smacks’ in the room before rebounding." },
                { name: "Isometric Calf Hold (Single Leg)", cue: "Test your absolute limits on one leg. Lift the heel to the highest possible altitude the ankle can support. Lock your body completely so the center of gravity aligns perfectly through the middle toes without any muscle vibration." }
            ],
            lateral: [
                { name: "Maximal Lateral Bounds", cue: "Stand solidly on one leg. Push off to the widest, largest, and longest horizontal distance you can manage straight to the side, aggressively catching and stopping your own momentum with the receiving opposite leg." },
                { name: "Fast Change of Direction Sprint Drills", cue: "Perform actual sprints—whether it's tight turns or signal-based reaction drills. Build full speed, brake as violently as your thighs and footwear can handle, and immediately break inertia to blast off into a new trajectory." },
                { name: "Lateral Pogo Jumps", cue: "Bounce strictly from the ankle (do not rely on a heavy squat dip for upward momentum) but lean your position to aggressively explore lateral motion while keeping your physical center of mass perfectly upright and secure." }
            ],
            base: [
                { name: "Olympic Lift Variations", cue: "Performed via Cleans, Snatches, or derivatives from the hip or hang positions aimed at explosive total-body extension. This exercise recruits everything in the neuromuscular system simultaneously for ultimate power output." },
                { name: "Depth Jump to Vertical Height", cue: "The absolute climax of plyometrics. Step off a substantial box and instantly hijack the gravitational energy upon ground contact, converting it purely into a maximally victorious vertical jump the millisecond landing is initiated." },
                { name: "Sprint Starts", cue: "The extreme depth of posture. Channel all your forward-leaning acceleration purely into the starting line, ignoring top speed completely, as the work exclusively evaluates the brutal first 5 and 10 meters charging toward the horizon." }
            ]
        }
    },

    generateProgram: function(scoresArray) {
        document.getElementById('results-container').style.display = 'block';
        const output = document.getElementById('program-output');
        const subtitle = document.getElementById('program-subtitle');
        output.innerHTML = '';
        
        let baseScores = { force: 100, endurance: 100, stiffness: 100, lateral: 100 };
        if (scoresArray && scoresArray.length > 0) {
            scoresArray.forEach(s => {
                const idStr = (s.testId || '').toLowerCase();
                const nmStr = (s.testName || '').toLowerCase();
                const match = (...args) => args.some(a => idStr.includes(a) || nmStr.includes(a));
                
                if (match('cmj', 'capacity')) baseScores.force = s.score;
                else if (match('repeated', 'endurance')) baseScores.endurance = s.score;
                else if (match('pogo', 'reactive', 'stiffness')) baseScores.stiffness = s.score;
                else if (match('lateral', 'agility', 'motor', 'control')) baseScores.lateral = s.score;
            });
        }

        const scoresMap = [
            { id: 'force', label: 'Maximum Capacity', val: baseScores.force },
            { id: 'endurance', label: 'Endurance & Landing Control', val: baseScores.endurance },
            { id: 'stiffness', label: 'Reactive Strength', val: baseScores.stiffness },
            { id: 'lateral', label: 'Lateral Stability', val: baseScores.lateral }
        ];

        const under90 = scoresMap.filter(s => s.val < 90);
        under90.sort((a,b) => a.val - b.val);
        
        let buckets = [];
        let currentBucket = [];
        let bucketBaseScore = null;

        for (let i = 0; i < under90.length; i++) {
            let item = under90[i];
            if (currentBucket.length === 0) {
                currentBucket.push(item);
                bucketBaseScore = item.val;
            } else {
                if (item.val <= bucketBaseScore + 8) {
                    currentBucket.push(item);
                } else {
                    buckets.push(currentBucket);
                    currentBucket = [item];
                    bucketBaseScore = item.val;
                }
            }
        }
        if (currentBucket.length > 0) buckets.push(currentBucket);

        const allPassed = under90.length === 0;
        let primaryFocus = allPassed ? [] : buckets[0];
        let worstScore = allPassed ? 100 : buckets[0][0].val;
        let severityPhase = this.getTrainingPhaseMetrics(worstScore);

        subtitle.innerHTML = this.getTrainingSubtitleHTML();

        let pool = this.exerciseDatabase[severityPhase];
        let w2Pool = [];

        if (allPassed) {
            w2Pool = [pool.force[0], pool.endurance[0], pool.stiffness[0], pool.base[1]];
        } else {
            let countPerItem = Math.ceil(3 / primaryFocus.length);
            primaryFocus.forEach(item => {
                if(pool[item.id]) w2Pool.push(...pool[item.id].slice(0, countPerItem));
            });
            w2Pool = w2Pool.slice(0, 3);
            
            let secFocus = buckets[1] && buckets[1][0] ? buckets[1][0] : {id: 'base'};
            let p2Safe = pool[secFocus.id] && pool[secFocus.id][0] ? pool[secFocus.id][0] : pool.base[0];
            if (p2Safe) w2Pool.push(p2Safe);
            w2Pool.push(pool.base[1]);
        }

        const { sets, reps } = this.getTrainingSetsReps(severityPhase);

        const w1 = [
            pool.base[0],
            pool.force[0],
            pool.endurance[1] || pool.endurance[0],
            pool.base[2] || pool.base[1]
        ].filter(Boolean).map(ex => ({...ex, sets, reps}));

        const w2 = w2Pool.filter(Boolean).map(ex => ({...ex, sets, reps}));

        const buildCard = (ex, i) => `
            <div style="background: rgba(255, 255, 255, 0.03); border-left: 3px solid #85FFB6; padding: 16px; margin-bottom: 12px; border-radius: 4px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-family: 'Nimbus Sans', var(--font-main); font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Exercise ${i + 1}</span>
                        <h4 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 16px; color: #FFF; margin: 4px 0 0 0;">${ex.name}</h4>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-family: 'Nimbus Sans', var(--font-main); font-size: 14px; font-weight: 500; color: #85FFB6; padding: 4px 8px; background: rgba(133,255,182,0.1); border-radius: 4px;">${ex.sets} x ${ex.reps}</span>
                        <button onclick="var inst = this.parentElement.parentElement.nextElementSibling; inst.style.display = inst.style.display === 'none' ? 'block' : 'none';" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); width: 28px; height: 28px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; font-family: sans-serif; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#FFF';" onmouseout="this.style.background='transparent'; this.style.color='rgba(255,255,255,0.6)';">
                            ?
                        </button>
                    </div>
                </div>
                <div style="display: none; margin-top: 8px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.1); font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5;">
                    <strong style="color: #85FFB6; font-size: 11px; text-transform: uppercase;">Instructions:</strong><br/>
                    ${ex.cue}
                </div>
            </div>
        `;

        const renderWorkout = (label, title, description, exercises) => `
            <div style="display: flex; flex-direction: column; margin-bottom: 24px;">
                <div style="margin-bottom: 20px; display: flex; flex-direction: column; align-items: flex-start;">
                    <div style="font-family: 'Nimbus Sans', var(--font-main); font-size: 11px; font-weight: 600; color: #000; background: #85FFB6; padding: 4px 12px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                        ${label}
                    </div>
                    <h3 style="font-family: 'Nimbus Sans', var(--font-main); font-weight: 400; font-size: 20px; color: #FFF; margin: 0 0 6px 0;">${title}</h3>
                    <p style="font-family: 'Nimbus Sans', var(--font-main); font-size: 13px; color: rgba(255,255,255,0.5); margin: 0; line-height: 1.5;">${description}</p>
                </div>
                <div style="display: flex; flex-direction: column;">
                    ${exercises.map((ex, i) => buildCard(ex, i)).join('')}
                </div>
            </div>
        `;

        output.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 40px; width: 100%;">
                ${renderWorkout('Workout 1', 'Base Strength & Athleticism', 'Focuses on fundamental compound movements and raw physical groundwork.', w1)}
                ${renderWorkout('Workout 2', 'Targeted Deficit Rehabilitation', 'Dynamically tailored based on your poorest clinical performance scores.', w2)}
            </div>
        `;
    }
};
