'use strict';

const GameState = {
    database: {},
    players: [],
    scores: {},
    tempScores: {},
    currentRound: 1,
    playerCount: 0,
    isDisplayingEvent: false
};

const UI = {
    async init() {
        const resp = await fetch('events.json');
        GameState.database = await resp.json();
        this.initEventListeners();
    },

    initEventListeners() {
        document.getElementById('btn-new-game').onclick = () => this.showScreen('player-count-screen');
        
        document.querySelectorAll('.btn-select-count').forEach(btn => {
            btn.onclick = () => {
                GameState.playerCount = parseInt(btn.dataset.count);
                this.prepareEmotionSetup();
            };
        });

        document.getElementById('btn-start-game').onclick = () => {
            const selected = document.querySelectorAll('.emotion-choice-card.selected');
            
            // 1. Vérification du nombre
            if (selected.length < GameState.playerCount) {
                return alert("Sélection incomplète ! Chaque joueur doit choisir une émotion.");
            }

            // 2. Vérification des doublons
            const emotionsChoisies = Array.from(selected).map(c => c.dataset.emotionValue);
            const uniqueEmotions = new Set(emotionsChoisies);

            if (uniqueEmotions.size < emotionsChoisies.length) {
                return alert("Chaque joueur doit choisir une émotion différente !");
            }

            // 3. Initialisation du jeu
            GameState.players = emotionsChoisies;
            GameState.players.forEach(p => GameState.scores[p] = 0);
            
            this.renderRound();
        };

        document.getElementById('btn-main-action').onclick = () => {
            if (GameState.isDisplayingEvent) {
                this.nextRound();
            } else {
                this.startEventTransition();
            }
        };
    },

    // renderRound() {
    //     this.showScreen('round-screen');
    //     GameState.isDisplayingEvent = false;
    //     document.getElementById('round-title').innerText = `Manche ${GameState.currentRound}`;
    //     document.getElementById('btn-main-action').innerText = "Valider les scores";
        
    //     const firstIdx = (GameState.currentRound - 1) % GameState.players.length;
    //     document.getElementById('first-player-info').innerHTML = `<p>C'est à <b>${GameState.players[firstIdx].toUpperCase()}</b> de jouer en premier.</p>`;

    //     // On reset les points de manche
    //     GameState.players.forEach(p => GameState.tempScores[p] = 0);
    //     this.renderSteppers();

    //     // Si c'est le début du jeu, on initialise les pupilles sur le cercle
    //     if (GameState.currentRound === 1) {
    //         this.initPupilsOnCircle();
    //     }
    // },
    renderRound() {
        this.showScreen('round-screen');
        GameState.isDisplayingEvent = false;
        document.getElementById('round-title').innerText = `Manche ${GameState.currentRound}`;
        document.getElementById('btn-main-action').innerText = "Valider les scores";
        
        const firstIdx = (GameState.currentRound - 1) % GameState.players.length;
        document.getElementById('first-player-info').innerHTML = `<p>Alice commence par <b>${GameState.players[firstIdx].toUpperCase()}</b></p>`;

        GameState.players.forEach(p => GameState.tempScores[p] = 0);
        this.renderSteppers();

        // À chaque début de manche, on s'assure que seule la pupille "active" est visible au centre
        // Si manche 1 : Neutre. Si manche > 1 : Le dernier gagnant.
    },

    initPupilsOnCircle() {
        const layer = document.getElementById('eye-pupils-layer');
        layer.innerHTML = "";
        const orbitRadius = 60;

        GameState.players.forEach((emo, i) => {
            const p = document.createElement('div');
            p.className = `pupil-rune ${emo}`;
            p.innerHTML = `<img src="assets/eye-pupil_${emo}.png">`;
            const angle = (i * (360 / GameState.players.length)) * (Math.PI / 180);
            gsap.set(p, {
                x: Math.cos(angle) * orbitRadius,
                y: Math.sin(angle) * orbitRadius,
                scale: 0.8
            });
            layer.appendChild(p);
        });
    },

    startEventTransition() {
        // 1. Enregistrer les scores
        GameState.players.forEach(e => GameState.scores[e] += GameState.tempScores[e]);
        
        // 2. Tirage au sort
        const ranking = [...GameState.players].sort((a, b) => GameState.scores[b] - GameState.scores[a]);
        const winner = Math.random() < 0.75 ? ranking[0] : (ranking[1] || ranking[0]);
        const event = GameState.database[winner].shift();

        // 3. Éléments
        const layer = document.getElementById('eye-pupils-layer');
        const overlay = document.getElementById('eye-color-overlay');
        const baseEye = document.getElementById('eye-base'); // L'oeil de base
        const orbitRadius = 10;

        // Masquer l'UI de score
        document.getElementById('dynamic-content-zone').innerHTML = "";
        document.getElementById('btn-main-action').style.display = "none";

        // 4. Préparer les pupilles (si elles n'existent pas encore)
        GameState.players.forEach(emo => {
            if (!layer.querySelector(`.${emo}`)) {
                const p = document.createElement('div');
                p.className = `pupil-rune ${emo}`;
                p.innerHTML = `<img src="assets/eye-pupil_${emo}.png">`;
                gsap.set(p, { x: 0, y: 0, opacity: 0, scale: 0 });
                layer.appendChild(p);
            }
        });

        const currentCenterPupil = layer.querySelector('.pupil-rune:not([style*="display: none"]):not([style*="opacity: 0"])');
        const allPlayerPupils = layer.querySelectorAll('.pupil-rune:not(.neutral)');
        
        const tl = gsap.timeline();

        // --- SÉQUENCE D'ANIMATION ---

        // A. La pupille centrale implose
        tl.to(currentCenterPupil, { scale: 0.2, duration: 0.5, ease: "power2.in" });

        // B. Éclosion vers le cercle
        tl.to(allPlayerPupils, {
            opacity: 1,
            scale: 0.5,
            duration: 0.8,
            ease: "back.out(1.5)",
            onUpdate: function() {
                const prog = this.progress();
                allPlayerPupils.forEach((p, i) => {
                    const angle = (i * (360 / allPlayerPupils.length)) * (Math.PI / 180);
                    gsap.set(p, {
                        x: Math.cos(angle) * (orbitRadius * prog),
                        y: Math.sin(angle) * (orbitRadius * prog)
                    });
                });
            }
        }, "-=0.2");

        tl.to(currentCenterPupil, { opacity: 0, scale: 0, duration: 0.3 }, "<");

        // C. Rotation
        tl.to(allPlayerPupils, {
            duration: 4,
            ease: "power2.inOut",
            onUpdate: function() {
                const rot = this.progress() * 25; 
                allPlayerPupils.forEach((p, i) => {
                    const angle = (i * (360 / allPlayerPupils.length) * (Math.PI / 180)) + rot;
                    gsap.set(p, {
                        x: Math.cos(angle) * orbitRadius,
                        y: Math.sin(angle) * orbitRadius
                    });
                });
            }
        }, "-=0.3");

        // D. TRANSITION DES CONTOURS (L'oeil de base s'efface, l'overlay apparaît)
        tl.to(baseEye, { opacity: 0, duration: 1 }, "-=1"); // L'oeil neutre disparaît
        tl.to(overlay, { 
            opacity: 1, 
            duration: 1, 
            onStart: () => { overlay.src = `assets/eye-contour_${winner}.png`; } 
        }, "<"); // En même temps, l'oeil coloré apparaît

        // E. Fixation du gagnant
        const winnerEl = layer.querySelector(`.${winner}`);
        const others = layer.querySelectorAll(`.pupil-rune:not(.${winner})`);

        tl.to(winnerEl, { x: 0, y: 0, scale: 1, opacity: 1, duration: 1.2, ease: "elastic.out(1, 0.8)" }, "-=0.5");
        tl.to(others, { opacity: 0, scale: 0, duration: 0.4 }, "<");

        // F. Finalisation
        tl.add(() => {
            GameState.isDisplayingEvent = true;
            this.showEventResult(winner, event);
            document.getElementById('btn-main-action').style.display = "block";
            document.getElementById('btn-main-action').innerText = "Manche suivante";
        });
    },

    // showEventResult(emo, event) {
    //     const zone = document.getElementById('dynamic-content-zone');
    //     zone.innerHTML = `
    //         <div class="event-result-box">
    //             <h2 style="font-size:1.4rem">Alice succombe à l'${emo}</h2>
    //             <div class="event-title">${event.title}</div>
    //             <div class="event-mechanics" style="margin-top:10px">${event.mechanic}</div>
    //         </div>
    //     `;
    //     gsap.from(".event-result-box", { opacity: 0, y: 20 });
    // },

    showEventResult(emo, event) {
    const zone = document.getElementById('dynamic-content-zone');
    
    // 1. Liste narrative évolutive selon la manche
    const sentences = [
        "glisse doucement vers",   // Manche 1
        "s'abandonne à",           // Manche 2
        "se laisse envahir par",   // Manche 3
        "finit par céder à",       // Manche 4
        "plonge dans",             // Manche 5
        "se laisse happer par"     // Manche 6
    ];

    // On récupère le verbe correspondant à la manche actuelle (index - 1)
    const verb = sentences[GameState.currentRound - 1] || "succombe à";
    
    // 2. Gestion de l'article élidé (l') ou défini (la)
    const art = ['extase', 'angoisse'].includes(emo.toLowerCase()) ? "l'" : "la ";
    
    // 3. Formatage du nom de l'émotion (Majuscule)
    const emoDisplay = emo.charAt(0).toUpperCase() + emo.slice(1);

    // 4. Injection du HTML
    zone.innerHTML = `
        <div class="event-result-box">
            <h2 class="event-headline">Alice ${verb} ${art}${emoDisplay}</h2>
            
            <div class="event-card">
                <div class="event-title">${event.title}</div>
                <div class="event-description">"${event.description}"</div>
                <hr class="event-separator">
                <div class="event-mechanics">
                    <strong>Effet :</strong> ${event.mechanic}
                </div>
            </div>
        </div>
    `;

    // 5. Animation d'apparition du texte
    gsap.from(".event-result-box", { 
        opacity: 0, 
        y: 30, 
        duration: 1, 
        ease: "power2.out" 
    });
},
    

    nextRound() {
        GameState.currentRound++;
        if (GameState.currentRound > 6) {
            this.showScreen('victory-screen');
            this.renderVictory();
        } else {
            this.renderRound();
        }
    },

    renderSteppers() {
            const zone = document.getElementById('dynamic-content-zone');
            zone.innerHTML = `<div id="score-inputs"></div>`;
            const container = document.getElementById('score-inputs');
            const template = document.getElementById('stepper-template');

            GameState.players.forEach(emo => {
                const clone = template.content.cloneNode(true);
                const badge = clone.querySelector('.score-badge');
                
                // Affichage de l'icône et du SCORE TOTAL
                const totalScore = GameState.scores[emo];
                clone.querySelector('.rune-image-place').innerHTML = `
                    <div class="stepper-info">
                        <img src="assets/${emo}.png">
                        <span class="total-score-label">Total: ${totalScore}</span>
                    </div>
                `;
                
                // Logique des boutons pour le score de la MANCHE
                clone.querySelector('.btn-minus').onclick = () => {
                    GameState.tempScores[emo] = Math.max(0, GameState.tempScores[emo] - 1);
                    badge.innerText = GameState.tempScores[emo];
                };
                clone.querySelector('.btn-plus').onclick = () => {
                    GameState.tempScores[emo]++;
                    badge.innerText = GameState.tempScores[emo];
                };
                container.appendChild(clone);
            });
        },

    prepareEmotionSetup() {
        this.showScreen('setup-emotions-screen');
        const container = document.getElementById('players-setup-list');
        container.innerHTML = "";
        const emotions = ['rage', 'extase', 'melancolie', 'angoisse'];

        for (let i = 1; i <= GameState.playerCount; i++) {
            const row = document.createElement('div');
            row.className = "player-setup-row";
            row.innerHTML = `<h3>Joueur ${i}</h3><div class="emotion-choices"></div>`;
            const grid = row.querySelector('.emotion-choices');

            emotions.forEach(emo => {
                const card = document.createElement('div');
                card.className = `emotion-choice-card ${emo}`;
                card.dataset.emotionValue = emo;
                card.innerHTML = `<img src="assets/${emo}.png">`;
                card.onclick = () => {
                    grid.querySelectorAll('.emotion-choice-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    this.updateEmotionAvailability();
                };
                grid.appendChild(card);
            });
            container.appendChild(row);
        }
    },

    updateEmotionAvailability() {
        // On parcourt chaque ligne de joueur
        document.querySelectorAll('.player-setup-row').forEach(row => {
            const selectedInRow = row.querySelector('.emotion-choice-card.selected');
            const cardsInRow = row.querySelectorAll('.emotion-choice-card');

            cardsInRow.forEach(card => {
                if (selectedInRow) {
                    // Si une émotion est choisie dans cette ligne, 
                    // on grise celles qui ne sont pas l'élue
                    if (!card.classList.contains('selected')) {
                        card.classList.add('disabled');
                    } else {
                        card.classList.remove('disabled');
                    }
                } else {
                    // Si rien n'est choisi dans cette ligne, tout est brillant
                    card.classList.remove('disabled');
                }
            });
        });
    },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
    },

    renderVictory() {
        const ranking = [...GameState.players].sort((a, b) => GameState.scores[b] - GameState.scores[a]);
        document.getElementById('classement-final').innerHTML = ranking.map((e, i) => 
            `<h3>#${i+1} ${e.toUpperCase()} : ${GameState.scores[e]} pts</h3>`
        ).join('');
    }
};

UI.init();