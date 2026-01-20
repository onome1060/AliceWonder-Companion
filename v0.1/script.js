// Base de données des événements
const eventsDatabase = {
    rage: [
        { title: "Excès autodestructeur", description: "Alice détruit sa tile et se déplace sur la suivante." },
        { title: "Enragement", description: "Chaque joueur peut détruire une tile pour poser." },
        { title: "Effondrement", description: "Alice détruit les bords et revient au centre." },
        { title: "Impulsion", description: "Alice va sur la tile rouge la plus proche." },
        { title: "Colère confuse", description: "Alice bouge au hasard. Sacrifiez une tile spéciale." }
    ],
    extase: [
        { title: "Sursaut joyeux", description: "Alice bouge d'1 case. Valeur de la tile +1." },
        { title: "Promenade entrainante", description: "Alice bouge 4 fois. +1 valeur partout." },
        { title: "Tout est super génial", description: "Chaque joueur pose immédiatement une tile humeur." },
        { title: "Inspiration formidable", description: "Move random forcé. Fin de manche : tile d'Alice +2." },
        { title: "Allégresse partagée", description: "Posez une tile du shop immédiatement." }
    ],
    melancolie: [
        { title: "Flétrissement", description: "Tiles adjacentes face cachée. Alice bouge." },
        { title: "Avenir terne", description: "Shop face cachée." },
        { title: "Acédie", description: "Shop 1 slot. Max 1 pose par joueur." },
        { title: "Repli sur soi", description: "Alice au centre face cachée." },
        { title: "Apathie", description: "Retourner une tile pour n'en poser qu'une." }
    ],
    angoisse: [
        { title: "Mouvement de panique", description: "Alice bouge 3x. Nouvelle tile dessous." },
        { title: "Peur de la séparation", description: "Alice bouge avec sa tile." },
        { title: "Avalanche de possibles", description: "Reroll shop autorisé avant de poser." },
        { title: "Indécision nerveuse", description: "Alice bouge 2x, détruit l'arrivée." },
        { title: "Sursaut", description: "Pose immédiate d'une tile piochée." }
    ]
};

// Variables d'état
let activePlayersList = []; 
let cumulativeScores = {};         
let currentRoundNumber = 1;       
let currentActiveEvent = null;    
let selectedPlayerCount = 0;
let temporaryRoundScores = {}; // Scores saisis pendant la manche en cours

// --- FONCTIONS UTILITAIRES ---

// Renvoie le chemin de l'image (à remplacer par tes fichiers .png plus tard)
function getRuneImagePath(emotion) {
    return `https://via.placeholder.com/80?text=${emotion.charAt(0).toUpperCase()}`;
}

function hideAllScreens() {
    const allScreens = document.querySelectorAll('.screen');
    allScreens.forEach(function(screen) { screen.classList.add('hidden'); });
}

// --- FONCTIONS DE NAVIGATION ET SETUP ---

function showPlayerCountScreen() {
    hideAllScreens();
    document.getElementById('player-count-screen').classList.remove('hidden');
}

function prepareEmotionAssignment(count) {
    selectedPlayerCount = count;
    hideAllScreens();
    const setupZone = document.getElementById('players-setup-list');
    setupZone.innerHTML = "";

    for (let i = 1; i <= count; i++) {
        setupZone.innerHTML += `
            <div style="margin:10px; display:flex; justify-content:space-between;">
                <label>Joueur ${i} : </label>
                <select id="select-p${i}">
                    <option value="rage">Rage</option>
                    <option value="extase">Extase</option>
                    <option value="melancolie">Mélancolie</option>
                    <option value="angoisse">Angoisse</option>
                </select>
            </div>`;
    }
    document.getElementById('setup-emotions-screen').classList.remove('hidden');
}

function startTheGame() {
    activePlayersList = [];
    cumulativeScores = {};
    for (let i = 1; i <= selectedPlayerCount; i++) {
        const emotion = document.getElementById('select-p' + i).value;
        if (activePlayersList.includes(emotion)) {
            alert("Chaque émotion doit être unique !");
            return;
        }
        activePlayersList.push(emotion);
        cumulativeScores[emotion] = 0;
    }
    currentRoundNumber = 1;
    currentActiveEvent = null;
    updateRoundScreen();
}

// --- GESTION DU SCORE (STEPPER) ---

function changeTemporaryScore(emotion, delta) {
    temporaryRoundScores[emotion] = Math.max(0, temporaryRoundScores[emotion] + delta);
    document.getElementById('badge-' + emotion).innerText = temporaryRoundScores[emotion];
}

// --- LOGIQUE DE MANCHE ---

function updateLiveScoreboard() {
    const scoreboardZone = document.getElementById('live-scoreboard');
    scoreboardZone.innerHTML = "";
    activePlayersList.forEach(function(emotion) {
        scoreboardZone.innerHTML += `
            <div class="scoreboard-item">
                <span class="scoreboard-score">${cumulativeScores[emotion]}</span>
                <span class="scoreboard-label">${emotion}</span>
            </div>`;
    });
}

function updateRoundScreen() {
    hideAllScreens();
    document.getElementById('round-screen').classList.remove('hidden');
    document.getElementById('round-title').innerText = "Manche " + currentRoundNumber;
    updateLiveScoreboard();

    const firstPlayerIndex = (currentRoundNumber - 1) % activePlayersList.length;
    document.getElementById('first-player-info').innerHTML = 
        `C'est à <strong>${activePlayersList[firstPlayerIndex].toUpperCase()}</strong> de commencer.`;

    // Affichage event
    const eventBox = document.getElementById('active-event-display');
    if (currentActiveEvent) {
        eventBox.classList.remove('hidden');
        document.getElementById('event-text').innerText = `${currentActiveEvent.title} : ${currentActiveEvent.description}`;
    } else {
        eventBox.classList.add('hidden');
    }

    // Génération des steppers
    const inputZone = document.getElementById('score-inputs');
    inputZone.innerHTML = "";
    activePlayersList.forEach(function(emotion) {
        temporaryRoundScores[emotion] = 0;
        inputZone.innerHTML += `
            <div class="score-stepper">
                <button class="arrow-button btn-minus" data-emotion="${emotion}">◀</button>
                <div class="rune-badge-container">
                    <img src="${getRuneImagePath(emotion)}" class="rune-icon ${emotion}">
                    <div class="score-badge" id="badge-${emotion}">0</div>
                </div>
                <button class="arrow-button btn-plus" data-emotion="${emotion}">▶</button>
            </div>`;
    });

    // On attache les événements aux nouveaux boutons créés
    document.querySelectorAll('.btn-minus').forEach(btn => {
        btn.addEventListener('click', function() { changeTemporaryScore(this.dataset.emotion, -1); });
    });
    document.querySelectorAll('.btn-plus').forEach(btn => {
        btn.addEventListener('click', function() { changeTemporaryScore(this.dataset.emotion, 1); });
    });
}

function validateRound() {
    activePlayersList.forEach(function(emotion) {
        cumulativeScores[emotion] += temporaryRoundScores[emotion];
    });

    if (currentRoundNumber === 6) {
        showVictoryScreen();
    } else {
        prepareEventDraw();
    }
}

// --- LOGIQUE DE TIRAGE ---

function prepareEventDraw() {
    hideAllScreens();
    document.getElementById('event-screen').classList.remove('hidden');
    document.getElementById('resultat-tirage').classList.add('hidden');
    document.getElementById('btn-draw-event').classList.remove('hidden');

    let ranking = activePlayersList.slice().sort((a, b) => cumulativeScores[b] - cumulativeScores[a]);
    let max = cumulativeScores[ranking[0]];
    let leaders = ranking.filter(e => cumulativeScores[e] === max);

    let html = "<h3>Probabilités :</h3>";
    if (leaders.length > 1) {
        let p = (100 / leaders.length).toFixed(1);
        leaders.forEach(e => html += `<p>${e.toUpperCase()} : ${p}%</p>`);
    } else {
        html += `<p>${ranking[0].toUpperCase()} (Leader) : 75%</p>`;
        let secScore = cumulativeScores[ranking[1]];
        let seconds = ranking.filter(e => cumulativeScores[e] === secScore);
        let pSec = (25 / seconds.length).toFixed(1);
        seconds.forEach(e => html += `<p>${e.toUpperCase()} : ${pSec}%</p>`);
    }
    document.getElementById('probabilites-display').innerHTML = html;
}

function executeDraw() {
    let roll = Math.random() * 100;
    let winner = "";
    let ranking = activePlayersList.slice().sort((a, b) => cumulativeScores[b] - cumulativeScores[a]);
    let leaders = ranking.filter(e => cumulativeScores[e] === cumulativeScores[ranking[0]]);

    if (leaders.length > 1) {
        winner = leaders[Math.floor(Math.random() * leaders.length)];
    } else {
        if (roll <= 75) winner = ranking[0];
        else {
            let seconds = ranking.filter(e => cumulativeScores[e] === cumulativeScores[ranking[1]]);
            winner = seconds[Math.floor(Math.random() * seconds.length)];
        }
    }

    currentActiveEvent = eventsDatabase[winner].shift();
    document.getElementById('btn-draw-event').classList.add('hidden');
    document.getElementById('resultat-tirage').classList.remove('hidden');
    document.getElementById('gagnant-annonce').innerHTML = `
        <img src="${getRuneImagePath(winner)}" class="rune-icon ${winner}" style="width:80px; height:80px;">
        <h2>${winner.toUpperCase()} DOMINE !</h2>
        <div class="event-box"><strong>${currentActiveEvent.title}</strong> : ${currentActiveEvent.description}</div>`;
}

function showVictoryScreen() {
    hideAllScreens();
    document.getElementById('victory-screen').classList.remove('hidden');
    let finalRanking = activePlayersList.slice().sort((a, b) => cumulativeScores[b] - cumulativeScores[a]);
    let res = document.getElementById('classement-final');
    res.innerHTML = "";
    finalRanking.forEach((e, i) => {
        res.innerHTML += `<div class="score-stepper"><img src="${getRuneImagePath(e)}" class="rune-icon ${e}"> #${i+1} ${e.toUpperCase()} - ${cumulativeScores[e]} pts</div>`;
    });
}

// --- ÉCOUTEURS D'ÉVÉNEMENTS ---

document.getElementById('btn-new-game').addEventListener('click', showPlayerCountScreen);

document.querySelectorAll('.btn-select-count').forEach(btn => {
    btn.addEventListener('click', function() { prepareEmotionAssignment(parseInt(this.dataset.count)); });
});

document.getElementById('btn-start-game').addEventListener('click', startTheGame);
document.getElementById('btn-validate-round').addEventListener('click', validateRound);
document.getElementById('btn-draw-event').addEventListener('click', executeDraw);
document.getElementById('btn-next-round').addEventListener('click', () => { currentRoundNumber++; updateRoundScreen(); });
document.getElementById('btn-restart').addEventListener('click', () => location.reload());