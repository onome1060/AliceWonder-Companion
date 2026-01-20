'use strict';

/* =========================================
   STATE
   ========================================= */
const GameState = {
  database: {},
  players: [],
  scores: {},
  tempScores: {},
  currentRound: 1,
  playerCount: 0,

  isDisplayingEvent: false,
  isDisplayingScore: false,

  lastWinner: "",
  lastEvent: "",
  currentEventHTML: "",

  aliceMoveCount: 0
};

/* =========================================
   CONSTANTS
   ========================================= */
const MAX_ROUNDS = 5;

const EMOTIONS = ['rage', 'extase', 'melancolie', 'angoisse'];

const emotionColors = {
  rage: "var(--emotion-rage)",
  extase: "var(--emotion-extase)",
  melancolie: "var(--emotion-melancolie)",
  angoisse: "var(--emotion-angoisse)"
};

/* =========================================
   DOM
   ========================================= */
const displayZone = document.getElementById('dynamic-content-zone');
const currentRoundDisplay = document.getElementById('round-title');
const StartingPlayerDisplay = document.getElementById('first-player-info');

const btnNewGame = document.getElementById('btn-new-game');
const btnPlayerCount = document.querySelectorAll('.btn-select-count');
const btnStartGame = document.getElementById('btn-start-game');
const btnMainAction = document.getElementById('btn-main-action');
const btnSwitchDisplay = document.getElementById('btn-switch-display');

/* =========================================
   HELPERS
   ========================================= */
function getActiveColor(emo) {
  if (!emo) return "var(--emotion-neutral)";
  return emotionColors[String(emo).toLowerCase()] || "var(--emotion-neutral)";
}

function resetTempScores() {
  GameState.players.forEach(p => (GameState.tempScores[p] = 0));
}

function commitTempScores() {
  GameState.players.forEach(p => (GameState.scores[p] += GameState.tempScores[p]));
}

function getRanking() {
  return [...GameState.players].sort((a, b) => (GameState.scores[b] || 0) - (GameState.scores[a] || 0));
}

/* =========================================
   UI CONTROLLER
   ========================================= */
const UI = {
  /* ---------- INIT ---------- */
  async init() {
    const resp = await fetch('events.json');
    GameState.database = await resp.json();
    this.initEventListeners();
  },

  /* ---------- SCREEN MANAGEMENT ---------- */
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
  },

  /* ---------- MAIN BUTTONS UI ---------- */
  updateMainButtonUI() {
    // Labels
    if (GameState.isDisplayingEvent) {
      btnMainAction.innerText = "Déplacer Alice";
      btnSwitchDisplay.innerText = "Gérer les scores";
    } else {
      btnMainAction.innerText = "Manche suivante";
      btnSwitchDisplay.innerText = "Event en cours";
    }

    // Affichage btn principal
    if (GameState.isDisplayingEvent) {
      btnMainAction.style.display = (GameState.aliceMoveCount > 0) ? "block" : "none";
    } else {
      btnMainAction.style.display = "block";
    }

    // Affichage switch Event/Scores
    btnSwitchDisplay.style.display = (GameState.currentRound > 1) ? "block" : "none";
  },

  /* =========================================
     EVENTS LISTENERS
     ========================================= */
  initEventListeners() {
    btnNewGame.addEventListener("click", () => this.showScreen('player-count-screen'));

    btnPlayerCount.forEach(btn => {
      btn.addEventListener("click", () => {
        GameState.playerCount = parseInt(btn.dataset.count, 10);
        this.prepareEmotionSetup();
      });
    });

    btnStartGame.addEventListener("click", () => this.handleStartGame());

    btnSwitchDisplay.addEventListener("click", () => this.toggleEventScoreView());

    btnMainAction.addEventListener("click", () => this.handleMainAction());
  },

  handleStartGame() {
    const selected = document.querySelectorAll('.emotion-choice-card.selected');

    // 1) Vérif nombre
    if (selected.length < GameState.playerCount) {
      alert("Sélection incomplète ! Chaque joueur doit choisir une émotion.");
      return;
    }

    // 2) Vérif doublons
    const chosen = Array.from(selected).map(c => c.dataset.emotionValue);
    const unique = new Set(chosen);

    if (unique.size < chosen.length) {
      alert("Chaque joueur doit choisir une émotion différente !");
      return;
    }

    // 3) Init game state
    GameState.players = chosen;
    GameState.players.forEach(p => (GameState.scores[p] = 0));

    this.renderRound();
  },

  toggleEventScoreView() {
    if (GameState.isDisplayingEvent) {
      GameState.isDisplayingEvent = false;
      this.displayScoreView();
    } else {
      GameState.isDisplayingEvent = true;
      this.displayEventResult(GameState.lastWinner, GameState.lastEvent);
    }
    this.updateMainButtonUI();
  },

  handleMainAction() {
    // Fin de partie (ton comportement actuel)
    if (GameState.currentRound > MAX_ROUNDS) {
      this.resetGameToHome();
      return;
    }

    // Si event affiché : on gère le déplacement
    if (GameState.isDisplayingEvent) {
      if (GameState.aliceMoveCount > 0 && GameState.currentRound < (MAX_ROUNDS + 1)) {
        this.initiateMovement();
        return;
      }
    }

    // Sinon -> transition event
    this.startEventTransition();
  },

  /* =========================================
     SETUP EMOTIONS
     ========================================= */
  prepareEmotionSetup() {
    this.showScreen('setup-emotions-screen');

    const container = document.getElementById('players-setup-list');
    container.innerHTML = "";

    for (let i = 1; i <= GameState.playerCount; i++) {
      const row = document.createElement('div');
      row.className = "player-setup-row";

      const needsSplit = i < GameState.playerCount;
      row.innerHTML = `
        <h3 class="player-setup-number">Joueur <span class="number">${i}</span></h3>
        <div class="emotion-choices"></div>
        ${needsSplit ? `<img src="assets/section-split-bar.png" alt="" class="section-split-bar">` : ""}
      `;

      const grid = row.querySelector('.emotion-choices');

      EMOTIONS.forEach(emo => {
        const card = document.createElement('div');
        card.className = `emotion-choice-card ${emo}`;
        card.dataset.emotionValue = emo;
        card.innerHTML = `<img src="assets/${emo}.png">`;

        card.addEventListener("click", () => {
          const wasSelected = card.classList.contains('selected');

          grid.querySelectorAll('.emotion-choice-card').forEach(c => c.classList.remove('selected'));
          if (!wasSelected) card.classList.add('selected');

          this.updateEmotionAvailability();
        });

        grid.appendChild(card);
      });

      container.appendChild(row);
    }
  },

  updateEmotionAvailability() {
    document.querySelectorAll('.player-setup-row').forEach(row => {
      const selectedInRow = row.querySelector('.emotion-choice-card.selected');
      const cardsInRow = row.querySelectorAll('.emotion-choice-card');

      cardsInRow.forEach(card => {
        if (selectedInRow) {
          if (!card.classList.contains('selected')) card.classList.add('disabled');
          else card.classList.remove('disabled');
        } else {
          card.classList.remove('disabled');
        }
      });
    });
  },

  /* =========================================
     GAME FLOW
     ========================================= */
  nextRound() {
    GameState.currentRound++;

    if (GameState.currentRound > MAX_ROUNDS) {
      this.showScreen('victory-screen');
      this.renderVictory();
      return;
    }

    this.renderRound();
  },

  // !!!!!!!!!!!!! inutilisé pour le moment !!!!!!!!!!!!!
  renderVictory() {
    const ranking = getRanking();
    document.getElementById('classement-final').innerHTML = ranking
      .map((e, i) => `<h3>#${i + 1} ${e.toUpperCase()} : ${GameState.scores[e]} pts</h3>`)
      .join('');
  },

  renderRound() {
    this.showScreen('round-screen');

    currentRoundDisplay.innerHTML = `Manche <span class="number">${GameState.currentRound}</span>`;

    const firstIdx = (GameState.currentRound - 1) % GameState.players.length;
    const playerName = GameState.players[firstIdx];
    const activeColor = getActiveColor(playerName);

    StartingPlayerDisplay.innerHTML = 
      `
      <p>
        <span style="color: ${activeColor};"; text-shadow: 0 0 5px rgba(255, 255, 255, 0.1);">
          ${playerName.toUpperCase()}
        </span> 
        <br>
        débute la manche
      </p>
      `;

    StartingPlayerDisplay.style.display = "block";
    currentRoundDisplay.style.display = "block";

    resetTempScores();

    if (GameState.currentRound > 1) {
      if (GameState.lastEvent && GameState.lastEvent.mechanic) {
        GameState.aliceMoveCount = GameState.lastEvent.mechanic.movement.number;
      } else {
        GameState.aliceMoveCount = 0;
      }

      this.displayEventResult(GameState.lastWinner, GameState.lastEvent);
    } else {
      this.displayScoreView();
    }

    this.updateMainButtonUI();
  },

  /* =========================================
     SCORE VIEW
     ========================================= */
  displayScoreView() {
    GameState.isDisplayingEvent = false;

    displayZone.innerHTML = `<div id="score-inputs" class="score-inputs-container"></div>`;
    const container = document.getElementById('score-inputs');
    const template = document.getElementById('stepper-template');

    GameState.players.forEach(emo => {
      const clone = template.content.cloneNode(true);
      const badge = clone.querySelector('.score-badge');

      const baseTotal = GameState.scores[emo] || 0;

      const updateScoreBadge = () => {
        const newTotal = baseTotal + GameState.tempScores[emo];
        badge.innerText = newTotal;

        // (comportement original)
        if (newTotal < 0) badge.style.color = "#ff4d4d";
      };

      updateScoreBadge();

      clone.querySelector('.rune-image-place').innerHTML = `<img src="assets/${emo}.png">`;

      // minus
      const btnMinus = clone.querySelector('.btn-minus');
      const imgMinusDef = btnMinus.querySelector('.img-minus-default');
      const imgMinusAct = btnMinus.querySelector('.img-minus-active');

      btnMinus.addEventListener("click", () => {
        GameState.tempScores[emo]--;
        updateScoreBadge();

        gsap.killTweensOf([imgMinusDef, imgMinusAct, badge]);
        const tl = gsap.timeline();

        tl.to(imgMinusDef, { opacity: 0, scale: 0.7, duration: 0.1 }, 0)
          .to(imgMinusAct, { opacity: 1, scale: 1.1, duration: 0.1 }, 0)
          .to(imgMinusDef, { opacity: 1, scale: 1, duration: 0.4, ease: "elastic.out(1, 0.3)" }, "+=0.1")
          .to(imgMinusAct, { opacity: 0, scale: 0.7, duration: 0.4, ease: "elastic.out(1, 0.3)" }, "<");

        gsap.fromTo(badge, { x: -10, scale: 1.2 }, { x: 0, scale: 1, duration: 0.4, ease: "back.out(2)" });
      });

      // plus
      const btnPlus = clone.querySelector('.btn-plus');
      const imgPlusDef = btnPlus.querySelector('.img-plus-default');
      const imgPlusAct = btnPlus.querySelector('.img-plus-active');

      btnPlus.addEventListener("click", () => {
        GameState.tempScores[emo]++;
        updateScoreBadge();

        gsap.killTweensOf([imgPlusDef, imgPlusAct, badge]);
        const tl = gsap.timeline();

        tl.to(imgPlusDef, { opacity: 0, scale: 0.7, duration: 0.1 }, 0)
          .to(imgPlusAct, { opacity: 1, scale: 1.1, duration: 0.1 }, 0)
          .to(imgPlusDef, { opacity: 1, scale: 1, duration: 0.4, ease: "elastic.out(1, 0.3)" }, "+=0.1")
          .to(imgPlusAct, { opacity: 0, scale: 0.7, duration: 0.4, ease: "elastic.out(1, 0.3)" }, "<");

        gsap.fromTo(badge, { y: -15, scale: 1.3 }, { y: 0, scale: 1, duration: 0.4, ease: "back.out(2)" });
      });

      container.appendChild(clone);

    });

    this.updateMainButtonUI();
  },

  /* =========================================
     EVENT VIEW
     ========================================= */
  displayEventResult(emo, event) {
    GameState.isDisplayingEvent = true;

    const activeColor = getActiveColor(emo);

    GameState.currentEventHTML = `
      <div class="event-result-box">
        <div class="event-card">
          <div class="event-title" style="color: ${activeColor}">${event.title}</div>
          <div class="event-description narrative-note">${event.description}</div>
          <img src="assets/section-split-bar.png" alt="" class="section-split-bar">
          <div class="event-mechanics">${event.mechanic.description}</div>
        </div>
      </div>
    `;

    displayZone.innerHTML = GameState.currentEventHTML;
    this.updateMainButtonUI();
  },

  /* =========================================
     EVENT TRANSITION (ROULETTE)
     ========================================= */
  startEventTransition() {

    // 1) Appliquer les scores temp
    commitTempScores();

    // 2) Classement
    const ranking = getRanking();
    const trueWinner = ranking[0];

    // 3) Manche finale
    if (GameState.currentRound === MAX_ROUNDS) {
      const event = GameState.database[trueWinner].find(e => e.isFinal === true);
      this.startEventFinal(trueWinner, event);
      return;
    }

    // 4) Manches 1..4 : tirage gagnant
    const roundWinner = Math.random() < 0.75 ? ranking[0] : (ranking[1] || ranking[0]);

    // On génère un nombre entre 0 et 1
    const chance = Math.random(); 

    // On filtre pour ne garder que les event qui n'ont pas isFinal: true
    const eventDispo = GameState.database[roundWinner].filter(e => !e.isFinal);

    // On choisit un index aléatoire dans ce pool filtré
    const randomIndex = Math.floor(Math.random() * eventDispo.length);
    const event = eventDispo[randomIndex];

    // On retire l'event de la base de données pour ne plus le tirer
    const realIndex = GameState.database[roundWinner].indexOf(event);
    GameState.database[roundWinner].splice(realIndex, 1);

    const winner = roundWinner;

    // Cibles
    const pupilLayer = document.getElementById('eye-pupils-layer');
    const overlay = document.getElementById('eye-color-overlay');
    const baseEye = document.getElementById('eye-base');
    const neutralPupil = document.getElementById('pupil-neutral');

    // Nettoyage UI
    displayZone.innerHTML = "";
    btnMainAction.style.display = "none";
    btnSwitchDisplay.style.display = "none";
    currentRoundDisplay.style.display = "none";
    StartingPlayerDisplay.style.display = "none";

    // Préparer calques
    GameState.players.forEach(emo => {
      if (!pupilLayer.querySelector(`.${emo}`)) {
        const p = document.createElement('div');
        p.className = `pupil-rune ${emo}`;
        p.innerHTML = `<img src="assets/eye-pupil_${emo}.png">`;
        pupilLayer.appendChild(p);
      }

      if (!document.querySelector(`.eye-contour-${emo}`)) {
        const c = document.createElement('img');
        c.className = `eye-layer eye-contour eye-contour-${emo}`;
        c.src = `assets/eye-contour_${emo}.png`;
        overlay.parentNode.insertBefore(c, overlay);
      }

      gsap.set([`.pupil-rune.${emo}`, `.eye-contour-${emo}`], { opacity: 0, scale: 1 });
    });

    const tl = gsap.timeline();

    // A) état initial : neutre visible
    tl.set(baseEye, { opacity: 1 });
    tl.set(neutralPupil, { opacity: 1 });

    // B) neutre s'efface
    tl.to([baseEye, neutralPupil], { opacity: 0, duration: 0.4, ease: "power1.in" });

    // C) roulette
    let rouletteData = { index: -1 };
    let lastIndex = -1;

    tl.to(rouletteData, {
      index: (GameState.players.length * 3) + GameState.players.indexOf(winner),
      duration: 3,
      ease: "power3.inOut",
      onUpdate: () => {
        const currentIndex = Math.floor(rouletteData.index) % GameState.players.length;

        if (currentIndex !== lastIndex) {
          const currentPlayer = GameState.players[currentIndex];

          gsap.to(`.pupil-rune:not(.neutral), [class*="eye-contour-"]`, {
            opacity: 0, duration: 0.1, overwrite: "auto"
          });

          gsap.to([`.pupil-rune.${currentPlayer}`, `.eye-contour-${currentPlayer}`], {
            opacity: 1, duration: 0.1, overwrite: "auto"
          });

          lastIndex = currentIndex;
        }
      }
    });

    // D) fixation finale
    tl.to("#main-eye-container", { filter: "brightness(4) contrast(1.2)", duration: 0.1 });
    tl.to(`.pupil-rune.${winner}`, { scale: 1.3, duration: 0.15, ease: "back.out(2)" }, "<");
    tl.to("#main-eye-container", { filter: "brightness(1) contrast(1)", duration: 0.5 });
    tl.to(`.pupil-rune.${winner}`, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" }, "-=0.3");

    // E) finalisation
    tl.add(() => {
      GameState.isDisplayingEvent = true;
      GameState.lastWinner = winner;
      GameState.lastEvent = event;
      GameState.aliceMoveCount = event.mechanic.movement.number;

      this.nextRound();
      this.updateMainButtonUI();
    }, "-=0.3");
  },

  /* =========================================
     FINAL EVENT
     ========================================= */
  startEventFinal(winner, event) {
    // Nettoyage UI
    displayZone.innerHTML = "";
    btnMainAction.style.display = "none";
    btnSwitchDisplay.style.display = "none";
    currentRoundDisplay.style.display = "none";
    StartingPlayerDisplay.style.display = "none";

    const tl = gsap.timeline();

    tl.to("#main-eye-container", { scale: 1.2, duration: 1, ease: "power2.inOut" });

    tl.add(() => {
      gsap.to(".pupil-rune", { opacity: 0, duration: 0.5 });
      gsap.to(`.pupil-rune.${winner}`, { opacity: 1, scale: 1.3, duration: 0.8 });

      gsap.to(".eye-contour", { opacity: 0, duration: 0.5 });
      gsap.to(`.eye-contour-${winner}`, { opacity: 1, scale: 1.2, duration: 0.8 });
    });

    tl.to("#main-eye-container", {
      x: "+=5",
      yoyo: true,
      repeat: 10,
      duration: 0.08,
      ease: "none"
    }, "+=0.5");

    tl.add(() => this.displayEventFinal(winner, event));
  },

  displayEventFinal(winner, event) {
    GameState.aliceMoveCount = 0;
    GameState.isDisplayingEvent = true;
    GameState.currentRound = MAX_ROUNDS + 1;

    const activeColor = getActiveColor(winner);

    displayZone.innerHTML = `
      <div class="event-result-box final-sequence" style="text-align:center; padding: 20px;">
        <h2 class="event-title" style="color: ${activeColor};">
          ${event.title}
        </h2>
        <p class="narrative-note">
          "${event.description}"
        </p>
      </div>
    `;

    btnMainAction.innerText = "Retour au menu";
    btnMainAction.style.display = "block";
  },

  /* =========================================
     RESET GAME
     ========================================= */
  resetGameToHome() {
    const existingOverlay = document.querySelector('.movement-content');
    if (existingOverlay) existingOverlay.remove();

    gsap.to(".game-container", {
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        GameState.currentRound = 1;
        GameState.isDisplayingEvent = false;
        GameState.aliceMoveCount = 0;

        GameState.players.forEach(p => {
          GameState.scores[p] = 0;
          GameState.tempScores[p] = 0;
        });

        GameState.players.forEach(emo => {
          if (emo === 'neutral') return;

          const pupil = document.querySelector(`.pupil-rune.${emo}`);
          const contour = document.querySelector(`.eye-contour-${emo}`);

          if (pupil) {
            gsap.set(pupil, { clearProps: "all" });
            pupil.style.opacity = "0";
          }

          if (contour) {
            gsap.set(contour, { clearProps: "all" });
            contour.style.opacity = "0";
          }
        });

        const eyeBase = document.getElementById('eye-base');
        if (eyeBase) {
          eyeBase.style.filter = "none";
          eyeBase.style.opacity = "1";
        }

        const neutralPupil = document.querySelector('.pupil-rune.neutral');
        if (neutralPupil) {
          neutralPupil.style.filter = "none";
          neutralPupil.style.opacity = "1";
        }

        gsap.set("#main-eye-container", { clearProps: "all", scale: 1, rotation: 0, opacity: 1 });
        btnMainAction.innerText = "Valider les scores";

        this.showScreen('home-screen');
        gsap.to(".game-container", { opacity: 1, duration: 0.2 });
      }
    });
  },

  /* =========================================
     MOVEMENT OVERLAY
     ========================================= */
  initiateMovement() {
    if (document.querySelector('.movement-overlay')) return;

    const container = document.querySelector('.game-container');
    const activeColor = getActiveColor(GameState.lastWinner);
    // GameState.lastWinner, GameState.lastEvent

    const overlay = document.createElement('div');
    overlay.className = 'movement-overlay';
    overlay.innerHTML = `
      <div class="movement-content">
        <div class="screen-title compass-title">
          <h2 class="">Déplacement d'Alice</h2>
        </div>

        <div class="narrative-note compass-ui-text">
          <p>Appuyez pour découvrir<br>la direction que prend Alice</p>
        </div>

        <div class="compass-container">
          <img class="compass-move" src="assets/movement.png" id="movement-arrow">
          <img class="compass-direction" src="assets/movement-direction.png" id="movement-direction">
        </div>
        
        <div class="movement-steps-left">
          <p style="color: ${activeColor};">
            Alice se déplace<br>encore
            <span class="number" style="color: var(--text-main-color);">${GameState.aliceMoveCount}</span> 
            fois
          </p>
        </div>
      </div>
    `;
    // <span style="color: ${activeColor};"></span>

    container.appendChild(overlay);

    const arrow = document.getElementById('movement-arrow');
    const stepsNumber = overlay.querySelector('.number');
    const stepsText = overlay.querySelector('.movement-steps-left');

    stepsText.style.display = "block";

    overlay.addEventListener('click', () => {
      if (GameState.aliceMoveCount > 0) {
        const angles = [0, 90, 180, 270];
        const randomAngle = angles[Math.floor(Math.random() * angles.length)];

        gsap.to(arrow, {
          rotation: `+=${720 + randomAngle}`,
          duration: 0.8,
          ease: "power2.out",
          onComplete: () => {
            GameState.aliceMoveCount--;
            stepsNumber.innerText = GameState.aliceMoveCount;

            this.updateMainButtonUI();

            if (GameState.aliceMoveCount === 0) {
              stepsText.style.display = "none";
              overlay.querySelector('.narrative-note').innerHTML = "Alice a fini de se déplacer<br>Appuyez pour fermer";
            }
          }
        });
      } else {
        gsap.to(overlay, {
          opacity: 0,
          duration: 0.3,
          onComplete: () => overlay.remove()
        });
      }
    });
  }
};

UI.init();
