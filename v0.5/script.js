// --- VARIABLES D'ÉTAT ---
let activePlayersList = []; 
let cumulativeScores = {};         
let currentRoundNumber = 1;       
let currentActiveEvent = null;    
let selectedPlayerCount = 0;
let temporaryRoundScores = {}; 

// --- UTILITAIRES ---
function getEmotionImagePath(emotion) {
    // return `https://via.placeholder.com/80?text=${emotion.charAt(0).toUpperCase()}`;
    return `assets/${emotion}.png`;
}
function getEmotionEventImagePath(emotion) {
    // return `https://via.placeholder.com/80?text=${emotion.charAt(0).toUpperCase()}`;
    return `assets/${emotion}_eye.png`;
}
function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
}
// --- NAVIGATION ---
function showPlayerCountScreen() {
    hideAllScreens();
    document.getElementById('player-count-screen').classList.remove('hidden');
}

// --- SÉLECTION DES ÉMOTIONS ---
function prepareEmotionAssignment(count) {
    selectedPlayerCount = count;
    hideAllScreens();
    const setupZone = document.getElementById('players-setup-list');
    setupZone.innerHTML = ""; 

    const emotions = ['rage', 'extase', 'melancolie', 'angoisse'];

    for (let i = 1; i <= count; i++) {
        let playerRow = document.createElement('div');
        playerRow.className = "player-setup-row";
        playerRow.innerHTML = `<h3>Joueur ${i}</h3>`;
        
        let choiceContainer = document.createElement('div');
        choiceContainer.className = "emotion-choices";

        emotions.forEach(emotion => {
            const card = document.createElement('div');
            card.className = `emotion-choice-card ${emotion}`;
            card.dataset.emotionValue = emotion; 
            card.innerHTML = 
                `<img src="${getEmotionImagePath(emotion)}">`;
            
            card.onclick = function() {
                if (card.classList.contains('disabled') && !card.classList.contains('selected')) return;
                choiceContainer.querySelectorAll('.emotion-choice-card').forEach(el => el.classList.remove('selected'));
                card.classList.add('selected');
                refreshEmotionAvailability();
            };
            choiceContainer.appendChild(card);
        });
        playerRow.appendChild(choiceContainer);
        setupZone.appendChild(playerRow);
    }
    document.getElementById('setup-emotions-screen').classList.remove('hidden');
}

function refreshEmotionAvailability() {
    const allCards = document.querySelectorAll('.emotion-choice-card');
    const selectedEmotions = Array.from(document.querySelectorAll('.emotion-choice-card.selected'))
                                  .map(c => c.dataset.emotionValue);

    allCards.forEach(card => {
        const emo = card.dataset.emotionValue;
        if (selectedEmotions.includes(emo) && !card.classList.contains('selected')) {
            card.classList.add('disabled');
        } else {
            card.classList.remove('disabled');
        }
    });
}

function startTheGame() {
    activePlayersList = [];
    cumulativeScores = {};
    const selections = document.querySelectorAll('.emotion-choice-card.selected');
    
    if (selections.length < selectedPlayerCount) {
        alert("Chaque joueur doit choisir une émotion !");
        return;
    }

    selections.forEach(card => {
        const emotion = card.dataset.emotionValue;
        activePlayersList.push(emotion);
        cumulativeScores[emotion] = 0;
    });

    currentRoundNumber = 1;
    currentActiveEvent = null;
    updateRoundScreen();
}
















function updateLiveScoreboard() {
    const scoreboardZone = document.getElementById('live-scoreboard');
    scoreboardZone.innerHTML = ""; 

    const scores = Object.values(cumulativeScores);
    const maxScore = Math.max(...scores, 10); 

    activePlayersList.forEach((emotion, index) => {
        const score = cumulativeScores[emotion];
        
        // 1. Angle de répartition
        const angle = (index * (360 / activePlayersList.length)) * (Math.PI / 180);
        
        // 2. Facteur de rapprochement (0 = au bord, 1 = au centre)
        const factor = Math.min(score / maxScore, 1);

        // 3. Rayons de l'ellipse (ajustés pour ton image eye.png)
        // On réduit un peu les valeurs (120 et 60) pour ne pas toucher les bords blancs
        const radiusX = 120 * (1 - factor * 0.8); 
        const radiusY = 60 * (1 - factor * 0.8);

        const x = Math.cos(angle) * radiusX;
        const y = Math.sin(angle) * radiusY;

        const pupil = document.createElement('div');
        pupil.className = `pupil-rune ${emotion}`;
        // On utilise translate pour positionner par rapport au centre
        pupil.style.transform = `translate(${x}px, ${y}px)`;
        
        pupil.innerHTML = `
            <img src="${getEmotionImagePath(emotion)}" alt="${emotion}">
            <span class="pupil-score-val">${score}</span>
        `;
        scoreboardZone.appendChild(pupil);
    });
}














// --- GESTION DE LA MANCHE ---
function updateRoundScreen() {
    hideAllScreens();
    document.getElementById('round-screen').classList.remove('hidden');
    document.getElementById('round-title').innerText = "Manche " + currentRoundNumber;
    updateLiveScoreboard();

    const firstIdx = (currentRoundNumber - 1) % activePlayersList.length;
    document.getElementById('first-player-info').innerHTML = `C'est à <b>${activePlayersList[firstIdx].toUpperCase()}</b> de commencer.`;

    // Événement
    const evBox = document.getElementById('active-event-display');
    if (currentActiveEvent) {
        evBox.classList.remove('hidden');
        document.getElementById('event-text').innerText = `${currentActiveEvent.title} : ${currentActiveEvent.mechanic}`;
    } else { evBox.classList.add('hidden'); }

    // COMPTEURS (C'est ici que l'on réactive les flèches)
    const inputZone = document.getElementById('score-inputs');
    inputZone.innerHTML = "";
    const template = document.getElementById('stepper-template');

    activePlayersList.forEach(emotion => {
        temporaryRoundScores[emotion] = 0;
        const clone = template.content.cloneNode(true);
        clone.querySelector('.rune-image-place').innerHTML = `<img src="${getEmotionImagePath(emotion)}">`;
        const badge = clone.querySelector('.score-badge');
        
        clone.querySelector('.btn-minus').onclick = () => {
            temporaryRoundScores[emotion] = Math.max(0, temporaryRoundScores[emotion] - 1);
            badge.innerText = temporaryRoundScores[emotion];
        };
        clone.querySelector('.btn-plus').onclick = () => {
            temporaryRoundScores[emotion]++;
            badge.innerText = temporaryRoundScores[emotion];
            // updateLiveScoreboard();
        };
        inputZone.appendChild(clone);
    });
}

function validateRound() {
    activePlayersList.forEach(e => cumulativeScores[e] += temporaryRoundScores[e]);
    if (currentRoundNumber === 6) showVictoryScreen();
    else prepareEventDraw();
}

// --- TIRAGE ---
function prepareEventDraw() {
    hideAllScreens();
    document.getElementById('event-screen').classList.remove('hidden');
    document.getElementById('resultat-tirage').classList.add('hidden');
    document.getElementById('btn-draw-event').classList.remove('hidden');

    const ranking = activePlayersList.slice().sort((a, b) => cumulativeScores[b] - cumulativeScores[a]);
}

function executeDraw() {
    let winner = "";
    const ranking = activePlayersList.slice().sort((a, b) => cumulativeScores[b] - cumulativeScores[a]);
    winner = Math.random() < 0.75 ? ranking[0] : (ranking[1] || ranking[0]);

    const article = (winner === 'extase' || winner === 'angoisse') ? "l'" : "la ";

    currentActiveEvent = eventsDatabase[winner].shift();
    document.getElementById('btn-draw-event').classList.add('hidden');
    document.getElementById('resultat-tirage').classList.remove('hidden');


    if (currentRoundNumber === 1) {
        document.getElementById('gagnant-annonce').innerHTML = `
        
        <h2>Alice glisse doucement vers ${article}${winner} !</h2>
        <img class="event-active-emotion" src="${getEmotionEventImagePath(winner)}";">
        <div class="event-box">
            <div class="event-title">
                ${currentActiveEvent.title}
            </div>
            <div class="event-description">
                ${currentActiveEvent.description}
            </div>
            <div class="event-mechanics">
                ${currentActiveEvent.mechanic}
            </div>
        </div>`;
    } else if (currentRoundNumber === 2) {
        document.getElementById('gagnant-annonce').innerHTML = `
        <h2>Alice s'abandonne à ${article}${winner} !</h2>
        <img class="event-active-emotion" src="${getEmotionEventImagePath(winner)}";">
        <div class="event-box">
            <div class="event-title">
                ${currentActiveEvent.title}
            </div>
            <div class="event-description">
                ${currentActiveEvent.description}
            </div>
            <div class="event-mechanics">
                ${currentActiveEvent.mechanic}
            </div>
        </div>`;
    } else if(currentRoundNumber === 3) {
        document.getElementById('gagnant-annonce').innerHTML = `
        <h2>Alice se laisse envahir par ${article}${winner} !</h2>
        <img class="event-active-emotion" src="${getEmotionEventImagePath(winner)}";">
        <div class="event-box">
            <div class="event-title">
                ${currentActiveEvent.title}
            </div>
            <div class="event-description">
                ${currentActiveEvent.description}
            </div>
            <div class="event-mechanics">
                ${currentActiveEvent.mechanic}
            </div>
        </div>`;
    } else if(currentRoundNumber === 4) {
        document.getElementById('gagnant-annonce').innerHTML = `
        <h2>Alice finit par céder à ${article}${winner} !</h2>
        <img class="event-active-emotion" src="${getEmotionEventImagePath(winner)}";">
        <div class="event-box">
            <div class="event-title">
                ${currentActiveEvent.title}
            </div>
            <div class="event-description">
                ${currentActiveEvent.description}
            </div>
            <div class="event-mechanics">
                ${currentActiveEvent.mechanic}
            </div>
        </div>`;
    } else if(currentRoundNumber === 5) {
        document.getElementById('gagnant-annonce').innerHTML = `
        <h2>Alice plonge dans ${article}${winner} !</h2>
        <img class="event-active-emotion" src="${getEmotionEventImagePath(winner)}";">
        <div class="event-box">
            <div class="event-title">
                ${currentActiveEvent.title}
            </div>
            <div class="event-description">
                ${currentActiveEvent.description}
            </div>
            <div class="event-mechanics">
                ${currentActiveEvent.mechanic}
            </div>
        </div>`;
    } else if(currentRoundNumber === 6) {
        document.getElementById('gagnant-annonce').innerHTML = `
        <h2>Alice se laisse happer par ${article}${winner} !</h2>
        <img class="event-active-emotion" src="${getEmotionEventImagePath(winner)}";">
        <div class="event-box">
            <div class="event-title">
                ${currentActiveEvent.title}
            </div>
            <div class="event-description">
                ${currentActiveEvent.description}
            </div>
            <div class="event-mechanics">
                ${currentActiveEvent.mechanic}
            </div>
        </div>`;
    } ;
}

function showVictoryScreen() {
    hideAllScreens();
    document.getElementById('victory-screen').classList.remove('hidden');
    const final = activePlayersList.slice().sort((a, b) => cumulativeScores[b] - cumulativeScores[a]);
    let res = document.getElementById('classement-final');
    res.innerHTML = "";
    final.forEach((e, i) => {
        res.innerHTML += `<h3>#${i+1} ${e.toUpperCase()} - ${cumulativeScores[e]} points</h3>`;
    });
}

// --- ÉCOUTEURS ---
document.getElementById('btn-new-game').onclick = showPlayerCountScreen;
document.querySelectorAll('.btn-select-count').forEach(b => {
    b.onclick = () => prepareEmotionAssignment(parseInt(b.dataset.count));
});
document.getElementById('btn-start-game').onclick = startTheGame;
document.getElementById('btn-validate-round').onclick = validateRound;
document.getElementById('btn-draw-event').onclick = executeDraw;
document.getElementById('btn-next-round').onclick = () => { currentRoundNumber++; updateRoundScreen(); };
document.getElementById('btn-restart').onclick = () => location.reload();






// --- DONNÉES DES ÉVÉNEMENTS ---
const eventsDatabase = {
    rage: [
        { title: "Excès autodestructeur", 
            mechanic: "Alice détruit la tuile sur laquelle elle se trouve puis se déplace aléatoirement.",
            description:"La haine de soi est souvent le premier carburant de la colère. Une essence volatile qui a poussé Alice à se blesser plus d’une fois. "
         },
        { title: "Escalade violente", 
            mechanic: "Pendant la prochaine manche, chaque joueur peut détruire une tuile pour la remplacer par une tuile qu’il pose. Chaque fois que cette action se résout, Alice rejoint la tuile nouvellement placée.",
            description:"Alice n’est pas étrangère au goût du sang. Son sang ou celui d’autrui, un élixir qui pousse à la surenchère permanente, jusqu’à l’horreur définitive."
         },
        { title: "Effondrement cathartique", 
            mechanic: "Alice détruit toutes les tuiles au bord du plateau et revient sur la case centrale.",
            description:"Impuissante face aux destructions passées, Alice réclame désormais son contrôle au travers de cette même violence. Ce qui est brisé de sa main ne pourra plus l’être par celle de l’Extérieur."
         },
        { title: "Impulsion furieuse", 
            mechanic: "Alice se déplace aléatoirement (direction de 1 à 4) deux fois. Ensuite, le joueur avec le moins de point peut détruire une tuile adjacente à elle. (En cas d’égalité c’est le joueur qui jouera le plus tard lors de la manche suivante qui prend le choix)",
            description:"Le sang appelle le sang, l’injuste appelle l’abjecte. Les éclats les plus marquant sont toujours les plus isolés. "
         },
        { title: "Colère confuse", 
            mechanic: "Alice se déplace aléatoirement. Chaque joueur doit jeter une de ses tuiles humeurs encore en réserve dans le sachet de tuiles. ",
            description:"Lorsqu’elle gronde à son paroxysme, la Rage perd parfois toute substance. Il ne reste alors qu’un sentiment qui dévore son hôte de l’intérieur."
         }
    ],
    extase: [
        { title: "Sursaut joyeux", 
            mechanic: "Alice se déplace aléatoirement et pose un jeton bonus sur la case où elle arrive.  (une valeur négative augmentée reste négative / Une tuile d’infusion augmentée rapporte autant de point à son ou ses humeurs. / Ce bonus est représenté par un petit jeton)",
            description:"Le simple souvenir de ce sourire et voilà qu’Alice en esquisse un elle aussi. "
         },
        { title: "Euphorie vivifiante", 
            mechanic: "Alice se déplace aléatoirement 4 fois. Chaque case parcourue par Alice et celle où elle s’arrête gagne 1 jeton bonus.",
            description:"Et si au final les songes du passés n’avait pas d’importance, au fond, n’est ce pas excitant d’imaginer qu’on peut repartir d’une page blanche ? "
         },
        { title: "Réalisation affranchie", 
            mechanic: "En commençant par le joueur plus faible dans l’ordre du tour, chaque joueur disposant encore d’au moins une tuile humeur spéciale dans sa réserve doit immédiatement en poser une.",
            description:"Alice n’a jusqu’à présent vécu qu’au travers de limites, ses limites. Des barrières artificielles dont elle peut, d’une pensée, décider de s’affranchir."
         },
        { title: "Inspiration formidable", 
            mechanic: "Durant la prochaine manche, chaque joueur peut poser une tuile spéciale en plus des deux tuiles qu’il a choisi dans la réserve commune.",
            description:"Alice n’a pas besoin de force pour surmonter ses maux, mais d’une simple idée. C’est là toute la puissance de son art."
         },
        { title: "Allégresse partagée", 
            mechanic: "Chaque joueur peut poser une tuile présente dans la réserve commune immédiatement en commençant par le joueur actif. Alice se déplace sur la dernière tuile posée et la réserve est remélangée puis restituée.",
            description:"Autour d’elle, sa création s’embrase de ses sentiments. Alice leur partage ses maux mais elle peut aussi choisir de leur infuser son énergie. "
         }
    ],
    melancolie: [
        { title: " Flétrissement de Wonder", 
            mechanic: "Les tuiles adjacentes à Alice sont tournées face cachée. Elle se déplace aléatoirement ensuite.",
            description:"Tandis que sa passion s’éteint, c’est toute son œuvre, Wonder, qui fane avec Alice. "
         },
        { title: "Avenir incertain", 
            mechanic: "Remélangez la réserve neutre pour y poser des tuiles face cachée à la place. Pour le reste de la manche les tuiles dans la réserve neutre sont toujours posées face caché. Avant de tirer le prochain évènement, révélez-les.",
            description:"Combien d’autres disparaitront par elle, pour elle ? Et si ces questions demeuraient éternellement sans réponse ? "
         },
        { title: "Acédie", 
            mechanic: "Remélangez la réserve neutre pour y poser une seule tuile par emplacement. Chaque fois que la réserve neutre est restituée pendant cette manche n’y mettez qu’une seule tuile. Les joueurs ne peuvent pas poser plus d’une tuile durant cette manche. Restituez normalement la réserve neutre avant de tirer le prochain évènement.",
            description:"La douceur de l’immobilisme. Un cocon de sécurité et de stabilité. Un sommeil dans lequel il parait si facile de sombrer…"
         },
        { title: "Repli sur soi", 
            mechanic: "Alice retourne au centre du plateau et retourne la tuile centrale face cachée. Ensuite, si elle ne s’est pas déplacée pour revenir au centre du plateau elle se déplace aléatoirement.",
            description:"Frey, Vulbis, Afstir… À quoi bon retenir ces noms quand la solitude est si simple."
         },
        { title: "Déliquescence", 
            mechanic: "Durant la prochaine manche, chaque joueur peut choisir de retourner une tuile et de poser une tuile comme action du tour.",
            description:"Sous l’œil épuisé d’Alice, le paysage de Wonder fond en une masse uniforme et grise. Un automne du monde et de l’âme."
         }
    ],
    angoisse: [
        { title: "Mouvement de panique", 
            mechanic: "Alice se déplace aléatoirement 3 fois. Ensuite elle pioche une tuile aléatoirement à mettre sous elle (en remplaçant si besoin la tuile sous elle qui est défaussée dans la pioche). Le joueur le plus faible oriente la nouvelle tuile.",
            description:"Et si un autre cataclysme attendait là, tapi dans la brume nébuleuse du Destin ? Voilà une pensée qui gardera Alice en alerte."
         },
        { title: "Peur de la séparation", 
            mechanic: "Peur de la séparation: Alice se déplace avec la tuile sous elle aléatoirement. (Échangeant la place de deux tuiles si besoin mais sans changer leur orientation)",
            description:"Peut-elle seulement s’empêcher de les poursuivre ?  Cette course est à sens unique pour Alice."
         },
        { title: "Avalanche de possibles", 
            mechanic: "Durant cette manche, chaque joueur peut remélanger un des emplacements de la réserve neutre et le restituer avant de jouer.",
            description:"Peut-être faudrait-il s’hâter de retrouver Frey, ou bien se concentrer sur sa nouvelle œuvre ou alors est-ce dans le vaste Extérieur qu’Alice devrait  trouver une voie ? "
         },
        { title: "Indécision nerveuse", 
            mechanic: "Alice se déplace aléatoirement 2 fois. Alice détruit la tuile sur laquelle elle arrive et le joueur le plus faible doit ensuite replacer la tuile détruite.",
            description:"Choisir revient à renoncer. Alors, Alice tisse et détisse, inlassablement, jusqu’à ce que sa dernière œuvre soit là où elle doit être."
         },
        { title: "Sursaut", 
            mechanic: "Chaque joueur DOIT poser une tuile piochée aléatoirement dans l’ordre du tour.",
            description:"Le perfectionnisme est l’obstacle de tout artiste. Mais Alice n’a plus ce luxe, son œuvre est sa vie."
         }
    ]
};