"use strict";

/* =========================================
   CONSTANTS
   ========================================= */
const MAX_ROUNDS = 5;
const EMOTIONS = ["rage", "extase", "melancolie", "angoisse"];

const emotionColors = {
  rage: "var(--emotion-rage)",
  extase: "var(--emotion-extase)",
  melancolie: "var(--emotion-melancolie)",
  angoisse: "var(--emotion-angoisse)"
};

/* =========================================
   DOM (cached)
   ========================================= */
const DOM = {
  screens: () => document.querySelectorAll(".screen"),
  home: () => document.getElementById("home-screen"),
  playerCount: () => document.getElementById("player-count-screen"),
  setup: () => document.getElementById("setup-emotions-screen"),
  round: () => document.getElementById("round-screen"),
  victory: () => document.getElementById("victory-screen"),

  playersSetupList: () => document.getElementById("players-setup-list"),

  displayZone: () => document.getElementById("dynamic-content-zone"),
  roundTitle: () => document.getElementById("round-title"),
  firstPlayerInfo: () => document.getElementById("first-player-info"),

  btnNewGame: () => document.getElementById("btn-new-game"),
  btnPlayerCount: () => document.querySelectorAll(".btn-select-count"),
  btnStartGame: () => document.getElementById("btn-start-game"),
  btnMainAction: () => document.getElementById("btn-main-action"),
  btnSwitchDisplay: () => document.getElementById("btn-switch-display"),
  btnRestart: () => document.getElementById("btn-restart"),

  stepperTemplate: () => document.getElementById("stepper-template"),

  eyeContainer: () => document.getElementById("main-eye-container"),
  eyeBase: () => document.getElementById("eye-base"),
  pupilLayer: () => document.getElementById("eye-pupils-layer"),
  neutralPupil: () => document.getElementById("pupil-neutral"),
  overlay: () => document.getElementById("eye-color-overlay"),

  gameContainer: () => document.querySelector(".game-container"),
  classementFinal: () => document.getElementById("classement-final")
};

/* =========================================
   UTILS
   ========================================= */
function getActiveColor(emo) {
  if (!emo) return "var(--emotion-neutral)";
  return emotionColors[String(emo).toLowerCase()] || "var(--emotion-neutral)";
}
function setEmotionTheme(cardEl, emo) {
  if (!cardEl) return;
  cardEl.classList.remove("is_rage", "is_extase", "is_melancolie", "is_angoisse");
  cardEl.classList.add(`is_${emo}`);
}
function safeText(str, fallback = "") {
  return (typeof str === "string" && str.length) ? str : fallback;
}
function lockEyeToViewport(eye) {
  const startRect = eye.getBoundingClientRect();

  gsap.killTweensOf(eye);

  gsap.set(eye, {
    position: "fixed",
    left: startRect.left,
    top: startRect.top,
    width: startRect.width,
    height: startRect.height,
    margin: 0,
    zIndex: 9999,

    // ultra important pour éviter le “transformOrigin qui déplace le texte”
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    transformOrigin: "50% 50%",
    filter: "brightness(1) contrast(1)"
  });

  const centerLeft = (window.innerWidth / 2) - (startRect.width / 2);
  const centerTop  = (window.innerHeight / 2) - (startRect.height / 2);

  return { startRect, centerLeft, centerTop };
}

function restoreEye(eye) {
  gsap.set(eye, { clearProps: "all" });
}

/* =========================================
   STATE (split)
   ========================================= */
const GameState = {
  // data
  database: {},     // loaded + mutated (events removed as they are drawn)
  players: [],
  playerCount: 0,

  scores: {},
  tempScores: {},

  round: 4,

  lastWinner: null,
  lastEvent: null,

  aliceMoves: 0
};

const UIState = {
  screen: "home",
  mode: "scores" // "scores" | "event"
};

/* =========================================
   GAME ENGINE (pure logic)
   ========================================= */
const GameEngine = {
  resetGame() {
    GameState.players = [];
    GameState.playerCount = 0;
    GameState.scores = {};
    GameState.tempScores = {};
    GameState.round = 1;
    GameState.lastWinner = null;
    GameState.lastEvent = null;
    GameState.aliceMoves = 0;
    UIState.mode = "scores";
  },

  setPlayers(players) {
    GameState.players = [...players];
    GameState.scores = {};
    GameState.tempScores = {};
    players.forEach(p => {
      GameState.scores[p] = 0;
      GameState.tempScores[p] = 0;
    });
  },

  resetTempScores() {
    GameState.players.forEach(p => (GameState.tempScores[p] = 0));
  },

  commitTempScores() {
    GameState.players.forEach(p => {
      GameState.scores[p] = (GameState.scores[p] || 0) + (GameState.tempScores[p] || 0);
    });
  },

  getRanking() {
    return [...GameState.players].sort((a, b) => (GameState.scores[b] || 0) - (GameState.scores[a] || 0));
  },

  getFirstPlayerForRound() {
    const idx = (GameState.round - 1) % GameState.players.length;
    return GameState.players[idx];
  },

  /**
   * Draw event for winner emotion.
   * - On final round: picks isFinal event
   * - Otherwise: picks random non-final and removes it from the database pool
   */
  drawEventFor(winner) {
    const pool = GameState.database[winner];
    if (!Array.isArray(pool) || pool.length === 0) {
      console.warn("[drawEventFor] Pool vide ou introuvable pour:", winner);
      return null;
    }

    // Final round
    if (GameState.round === MAX_ROUNDS) {
      const finalEvent = pool.find(e => e && e.isFinal === true);
      if (!finalEvent) {
        console.warn("[drawEventFor] Aucun final event trouvé pour:", winner);
        return null;
      }
      return finalEvent;
    }

    // Normal rounds: non-final
    const available = pool.filter(e => e && e.isFinal !== true);
    if (!available.length) {
      console.warn("[drawEventFor] Plus d'events non-final pour:", winner);
      return null;
    }

    const event = available[Math.floor(Math.random() * available.length)];
    // remove from pool to avoid drawing again
    const realIndex = pool.indexOf(event);
    if (realIndex >= 0) pool.splice(realIndex, 1);

    return event;
  },

  pickRoundWinner(ranking) {
    // same behavior: 75% top, else second (or top)
    return Math.random() < 0.75 ? ranking[0] : (ranking[1] || ranking[0]);
  },

  setLastResult(winner, event) {
    GameState.lastWinner = winner;
    GameState.lastEvent = event;
    const movement = event?.mechanic?.movement;
    GameState.aliceMoves = Number.isFinite(movement) ? movement : 0;
  },

  nextRoundOrVictory() {
    GameState.round += 1;
    return (GameState.round > MAX_ROUNDS) ? "victory" : "round";
  }
};

/* =========================================
   RENDERER (DOM only)
   ========================================= */
const Renderer = {
  showScreen(id) {
    DOM.screens().forEach(s => s.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
    UIState.screen = id;
  },

  updateMainButtons() {
    const btnMain = DOM.btnMainAction();
    const btnSwitch = DOM.btnSwitchDisplay();

    
    if (GameState.round > MAX_ROUNDS){
      btnSwitch.innerText = "Retour au menu";
      console.log(btnMain);
    }
    // else if (GameState.round === MAX_ROUNDS && UIState.mode === "scores") {
    //   btnMain.innerText = "Manche finale";
    // }
    else if (UIState.mode === "event") {
      btnMain.innerText = "Déplacer Alice";
      btnSwitch.innerText = "Gérer les scores";
      btnMain.style.display = GameState.aliceMoves > 0 ? "block" : "none";
    } 
    else {
      btnMain.innerText = "Manche suivante";
      btnSwitch.innerText = "Event en cours";
      btnMain.style.display = "block";
    }

    btnSwitch.style.display = (GameState.round > 1) ? "block" : "none";
  },

  renderRoundHeader() {
    const roundTitle = DOM.roundTitle();
    const firstInfo = DOM.firstPlayerInfo();

    roundTitle.innerHTML = `Manche <span class="number">${GameState.round}</span>`;

    const firstPlayer = GameEngine.getFirstPlayerForRound();
    const color = getActiveColor(firstPlayer);

    firstInfo.innerHTML = `
      <p>
        <span style="color:${color}; text-shadow: 0 0 5px rgba(255,255,255,0.1);">
          ${String(firstPlayer).toUpperCase()}
        </span>
        <br>
        débute la manche
      </p>
    `;

    firstInfo.style.display = "block";
    roundTitle.style.display = "block";
  },

  renderScoreView() {
    UIState.mode = "scores";
    const displayZone = DOM.displayZone();
    displayZone.replaceChildren();

    const wrapper = document.createElement("div");
    wrapper.id = "score-inputs";
    wrapper.className = "score-inputs-container";
    displayZone.appendChild(wrapper);

    const template = DOM.stepperTemplate();

    GameState.players.forEach(emo => {
      const clone = template.content.cloneNode(true);
      const badge = clone.querySelector(".score-badge");
      const baseTotal = GameState.scores[emo] || 0;

      const updateBadge = () => {
        const newTotal = baseTotal + (GameState.tempScores[emo] || 0);
        badge.innerText = String(newTotal);
        badge.style.color = (newTotal < 0) ? "#ff4d4d" : "#ffffffff";
      };

      updateBadge();

      clone.querySelector(".rune-image-place").innerHTML = `<img src="assets/${emo}.png" alt="">`;

      // minus
      const btnMinus = clone.querySelector(".btn-minus");
      const imgMinusDef = btnMinus.querySelector(".img-minus-default");
      const imgMinusAct = btnMinus.querySelector(".img-minus-active");

      btnMinus.addEventListener("click", () => {
        GameState.tempScores[emo] = (GameState.tempScores[emo] || 0) - 1;
        updateBadge();

        gsap.killTweensOf([imgMinusDef, imgMinusAct, badge]);
        const tl = gsap.timeline();
        tl.to(imgMinusDef, { opacity: 0, scale: 0.7, duration: 0.1 }, 0)
          .to(imgMinusAct, { opacity: 1, scale: 1.1, duration: 0.1 }, 0)
          .to(imgMinusDef, { opacity: 1, scale: 1, duration: 0.4, ease: "elastic.out(1, 0.3)" }, "+=0.1")
          .to(imgMinusAct, { opacity: 0, scale: 0.7, duration: 0.4, ease: "elastic.out(1, 0.3)" }, "<");

        // gsap.fromTo(badge, { x: -10, scale: 1.2 }, { x: 0, scale: 1, duration: 0.4, ease: "back.out(2)" });
        gsap.fromTo(
          badge,
          { xPercent: -50, yPercent: -50, x: -10, scale: 1.2 },
          { xPercent: -50, yPercent: -50, x: 0, scale: 1, duration: 0.4, ease: "back.out(2)", overwrite: "auto" }
        );
      });

      // plus
      const btnPlus = clone.querySelector(".btn-plus");
      const imgPlusDef = btnPlus.querySelector(".img-plus-default");
      const imgPlusAct = btnPlus.querySelector(".img-plus-active");

      btnPlus.addEventListener("click", () => {
        GameState.tempScores[emo] = (GameState.tempScores[emo] || 0) + 1;
        updateBadge();

        gsap.killTweensOf([imgPlusDef, imgPlusAct, badge]);
        const tl = gsap.timeline();
        tl.to(imgPlusDef, { opacity: 0, scale: 0.7, duration: 0.1 }, 0)
          .to(imgPlusAct, { opacity: 1, scale: 1.1, duration: 0.1 }, 0)
          .to(imgPlusDef, { opacity: 1, scale: 1, duration: 0.4, ease: "elastic.out(1, 0.3)" }, "+=0.1")
          .to(imgPlusAct, { opacity: 0, scale: 0.7, duration: 0.4, ease: "elastic.out(1, 0.3)" }, "<");

        // gsap.fromTo(badge, { y: -15, scale: 1.3 }, { y: 0, scale: 1, duration: 0.4, ease: "back.out(2)" });
        gsap.fromTo(
          badge,
          { xPercent: -50, yPercent: -50, y: -15, scale: 1.3 },
          { xPercent: -50, yPercent: -50, y: 0, scale: 1, duration: 0.4, ease: "back.out(2)", overwrite: "auto" }
        );
      });

      wrapper.appendChild(clone);
    });

    this.updateMainButtons();
  },

  createEventCard(emo, event) {

    const activeColor = getActiveColor(emo);

    const box = document.createElement("div");
    box.className = "event-result-box";

    const card = document.createElement("div");
    card.className = "event-card";

    const title = document.createElement("div");
    title.className = "event-title";
    // title.style.color = activeColor;
    setEmotionTheme(title, emo);
    title.textContent = safeText(event?.title, "Événement");

    const desc = document.createElement("div");
    desc.className = "event-description narrative-note";
    desc.textContent = safeText(event?.description, "");

    const split = document.createElement("img");
    split.src = "assets/section-split-bar.png";
    split.alt = "";
    split.className = "section-split-bar";

    card.appendChild(title);
    card.appendChild(desc);

    if (event?.mechanic?.description) {
      const mech = document.createElement("div");
      mech.className = "event-mechanics";
      // mechanic description contains spans; keep as HTML
      mech.innerHTML = event.mechanic.description;

      card.appendChild(split);
      card.appendChild(mech);
    }

    box.appendChild(card);
    return box;
  },

  renderEventView(emo, event, { animate = true } = {}) {
    UIState.mode = "event";
    const displayZone = DOM.displayZone();
    displayZone.replaceChildren(this.createEventCard(emo, event));
    this.updateMainButtons();

    if (animate) Animator.playEventReveal();
    this.updateMainButtons();
  },

  renderVictory() {
    this.showScreen("victory-screen");
    const ranking = GameEngine.getRanking();
    DOM.classementFinal().innerHTML = ranking
      .map((e, i) => `<h3>#${i + 1} ${String(e).toUpperCase()} : ${GameState.scores[e]} pts</h3>`)
      .join("");
  }
};

/* =========================================
   ANIMATOR (GSAP only)
   ========================================= */
const Animator = {
  cached: {
    pupils: {},   // emo -> element
    contours: {}, // emo -> element
    allPupils: [],
    allContours: []
  },

  ensureEyeLayers(players) {
    const pupilLayer = DOM.pupilLayer();
    const overlay = DOM.overlay();
    const overlayParent = overlay.parentNode;

    players.forEach(emo => {
      // pupil
      let p = pupilLayer.querySelector(`.pupil-rune.${emo}`);
      if (!p) {
        p = document.createElement("div");
        p.className = `pupil-rune ${emo}`;
        p.innerHTML = `<img src="assets/eye-pupil_${emo}.png" alt="">`;
        pupilLayer.appendChild(p);
      }

      // contour
      let c = document.querySelector(`.eye-contour-${emo}`);
      if (!c) {
        c = document.createElement("img");
        c.className = `eye-layer eye-contour eye-contour-${emo}`;
        c.src = `assets/eye-contour_${emo}.png`;
        overlayParent.insertBefore(c, overlay);
      }

      this.cached.pupils[emo] = p;
      this.cached.contours[emo] = c;
    });

    this.cached.allPupils = Object.values(this.cached.pupils);
    this.cached.allContours = Object.values(this.cached.contours);

    // init visibility
    gsap.set(this.cached.allPupils, { opacity: 0, scale: 1 });
    gsap.set(this.cached.allContours, { opacity: 0, scale: 1 });
  },

  hideRoundUI() {
    DOM.displayZone().replaceChildren();
    DOM.btnMainAction().style.display = "none";
    DOM.btnSwitchDisplay().style.display = "none";
    DOM.roundTitle().style.display = "none";
    DOM.firstPlayerInfo().style.display = "none";
  },

  showRoundUI() {
    DOM.roundTitle().style.display = "block";
    DOM.firstPlayerInfo().style.display = "block";
  },

  playRoulette({ winner, players }) {
    return new Promise(resolve => {
      const eye = DOM.eyeContainer();
      const baseEye = DOM.eyeBase();
      const neutralPupil = DOM.neutralPupil();

      this.ensureEyeLayers(players);

      const { startRect, centerLeft, centerTop } = lockEyeToViewport(eye);


      // 4) Préparer les calques (neutre visible)
      gsap.set(baseEye, { opacity: 1 });
      gsap.set(neutralPupil, { opacity: 1 });

      // 5) TL
      const tl = gsap.timeline({
        onComplete: () => {
          restoreEye(eye);
          resolve();
        }
      });

      // A) glisser au centre
      tl.to(eye, {
        left: centerLeft,
        top: centerTop,
        duration: 1,
        scale: 2,
        ease: "sine.inOut"
      });

      // C) neutre s'efface
      tl.to([baseEye, neutralPupil], {
        opacity: 0,
        duration: 0.35,
        ease: "power1.in"
      });

      // D) roulette (optimisée : pas de querySelector dans la boucle)
      const rouletteData = { index: -1 };
      let lastIndex = -1;

      tl.to(rouletteData, {
        index: (players.length * 5) + players.indexOf(winner),
        duration: 3,
        ease: "power3.inOut",
        onUpdate: () => {
          const currentIndex = Math.floor(rouletteData.index) % players.length;
          if (currentIndex === lastIndex) return;

          const currentPlayer = players[currentIndex];

          // hide all
          this.cached.allPupils.forEach(el => (el.style.opacity = "0"));
          this.cached.allContours.forEach(el => (el.style.opacity = "0"));

          // show current
          const p = this.cached.pupils[currentPlayer];
          const c = this.cached.contours[currentPlayer];
          if (p) p.style.opacity = "1";
          if (c) c.style.opacity = "1";

          lastIndex = currentIndex;
        }
      });

      // E) punch final
      tl.to(eye, { filter: "brightness(4) contrast(1.2)", duration: 0.1 });
      tl.to(this.cached.pupils[winner], { scale: 1.3, duration: 0.15, ease: "back.out(2)" }, "<");
      tl.to(eye, { filter: "brightness(1) contrast(1)", duration: 0.5 });
      tl.to(this.cached.pupils[winner], { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" }, "-=0.3");

      // G) puis glisser back vers la position initiale de la grid
      tl.to(eye, {
        left: startRect.left,
        top: startRect.top,
        scale: 1,
        duration: 1,
        ease: "sine.out"
      });
    });
  },

  playFinalImpact(winner) {
    return new Promise(resolve => {
      const eye = DOM.eyeContainer();
      this.ensureEyeLayers(GameState.players);

      const { startRect, centerLeft, centerTop } = lockEyeToViewport(eye);

      const tl = gsap.timeline({
        onComplete: () => {
          restoreEye(eye);
          resolve();
        }
      });

      // 1) aller au centre (comme ta roulette)
      tl.to(eye, {
        left: centerLeft,
        top: centerTop,
        duration: 0.8,
        ease: "sine.inOut"
      });

      // 2) impact (zoom + flash léger)
      tl.to(eye, { scale: 2.2, duration: 0.9, ease: "power2.inOut" });
      tl.to(eye, { filter: "brightness(3) contrast(1.2)", duration: 0.08 }, "<");
      tl.to(eye, { filter: "brightness(1) contrast(1)", duration: 0.35 }, ">");

      // 3) afficher le winner (sans casser les scales globales)
      tl.add(() => {
        this.cached.allPupils.forEach(el => (el.style.opacity = "0"));
        this.cached.allContours.forEach(el => (el.style.opacity = "0"));

        const p = this.cached.pupils[winner];
        const c = this.cached.contours[winner];

        if (p) gsap.set(p, { opacity: 1, scale: 1 });
        if (c) gsap.set(c, { opacity: 1, scale: 1 });

        // petit “punch” local sur le winner
        if (p) gsap.to(p, { scale: 1.35, duration: 0.25, ease: "back.out(2)" });
        if (c) gsap.to(c, { scale: 1.2, duration: 0.25, ease: "back.out(2)" });
      }, "<");

      // 4) shake
      tl.to(eye, {
        x: "+=6",
        yoyo: true,
        repeat: 10,
        duration: 0.08,
        ease: "none"
      }, "+=0.15");

      // 5) retour à la position d’origine (grid)
      tl.to(eye, {
        left: startRect.left,
        top: startRect.top,
        scale: 1,
        x: 0,
        duration: 0.8,
        ease: "sine.inOut"
      });
    });
  },


  playEventReveal() {
    const zone = DOM.displayZone();
    const box = zone.querySelector(".event-result-box");
    const card = zone.querySelector(".event-card");
    const title = zone.querySelector(".event-title");
    const desc = zone.querySelector(".event-description");
    const mech = zone.querySelector(".event-mechanics");
    const split = zone.querySelector(".section-split-bar");

    if (!box || !card) return Promise.resolve();

    // Reset propre avant anim (important si tu reviens sur un event)
    gsap.killTweensOf([box, card, title, desc, mech, split]);
    // gsap.set([box, card, title, desc, mech, split].filter(Boolean), { clearProps: "all" });
    gsap.set([box, card, title, desc, mech, split].filter(Boolean), {
      clearProps: "transform,opacity,filter"
    });
    gsap.set(box, { opacity: 1 });
    gsap.set(card, { opacity: 0, y: 18, scale: 0.98, transformOrigin: "50% 50%" });

    if (title) gsap.set(title, { opacity: 0, y: 10 });
    if (desc) gsap.set(desc, { opacity: 0, y: 10 });
    if (split) gsap.set(split, { opacity: 0, scaleX: 0.2, transformOrigin: "50% 50%" });
    if (mech) gsap.set(mech, { opacity: 0, y: 10 });

    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });

      tl.to(card, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "power3.out" });

      // texte en cascade
      if (title) tl.to(title, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, "-=0.25");
      if (desc)  tl.to(desc,  { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, "-=0.20");

      // séparateur + mécanique
      if (split) tl.to(split, { opacity: 1, scaleX: 1, duration: 0.35, ease: "power2.out" }, "-=0.15");
      if (mech)  tl.to(mech,  { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, "-=0.20");
    });
  }

};

/* =========================================
   UI CONTROLLER (orchestration)
   ========================================= */
const UIController = {
  async init() {
    // load database (clone to allow mutation without touching source)
    const resp = await fetch("events.json");
    const json = await resp.json();
    GameState.database = JSON.parse(JSON.stringify(json));

    this.initListeners();
    Renderer.showScreen("home-screen");
  },

  initListeners() {
    DOM.btnNewGame().addEventListener("click", () => Renderer.showScreen("player-count-screen"));

    DOM.btnPlayerCount().forEach(btn => {
      btn.addEventListener("click", () => {
        GameState.playerCount = parseInt(btn.dataset.count, 10);
        this.prepareEmotionSetup();
      });
    });

    DOM.btnStartGame().addEventListener("click", () => this.handleStartGame());
    DOM.btnSwitchDisplay().addEventListener("click", () => this.toggleMode());
    DOM.btnMainAction().addEventListener("click", () => this.handleMainAction());

    const restart = DOM.btnRestart();
    if (restart) restart.addEventListener("click", () => this.resetToHome());
  },

  prepareEmotionSetup() {
    Renderer.showScreen("setup-emotions-screen");

    const container = DOM.playersSetupList();
    container.innerHTML = "";

    for (let i = 1; i <= GameState.playerCount; i++) {
      const row = document.createElement("div");
      row.className = "player-setup-row";

      const needsSplit = i < GameState.playerCount;
      row.innerHTML = `
        <h3 class="player-setup-number">Joueur <span class="number">${i}</span></h3>
        <div class="emotion-choices"></div>
        ${needsSplit ? `<img src="assets/section-split-bar.png" alt="" class="section-split-bar">` : ""}
      `;

      const grid = row.querySelector(".emotion-choices");

      EMOTIONS.forEach(emo => {
        const card = document.createElement("div");
        card.className = `emotion-choice-card ${emo}`;
        card.dataset.emotionValue = emo;
        card.innerHTML = `<img src="assets/${emo}.png" alt="">`;

        card.addEventListener("click", () => {
          const wasSelected = card.classList.contains("selected");

          grid.querySelectorAll(".emotion-choice-card").forEach(c => c.classList.remove("selected"));
          if (!wasSelected) card.classList.add("selected");

          this.updateEmotionAvailability();
        });

        grid.appendChild(card);
      });

      container.appendChild(row);
    }
  },

  updateEmotionAvailability() {
    document.querySelectorAll(".player-setup-row").forEach(row => {
      const selectedInRow = row.querySelector(".emotion-choice-card.selected");
      const cardsInRow = row.querySelectorAll(".emotion-choice-card");

      cardsInRow.forEach(card => {
        if (selectedInRow) {
          if (!card.classList.contains("selected")) card.classList.add("disabled");
          else card.classList.remove("disabled");
        } else {
          card.classList.remove("disabled");
        }
      });
    });
  },

  handleStartGame() {
    const selected = document.querySelectorAll(".emotion-choice-card.selected");

    if (selected.length < GameState.playerCount) {
      alert("Sélection incomplète ! Chaque joueur doit choisir une émotion.");
      return;
    }

    const chosen = Array.from(selected).map(c => c.dataset.emotionValue);
    const unique = new Set(chosen);

    if (unique.size < chosen.length) {
      alert("Chaque joueur doit choisir une émotion différente !");
      return;
    }

    GameEngine.setPlayers(chosen);
    this.renderRound();
  },

  renderRound() {
    Renderer.showScreen("round-screen");
    if (GameState.round <= 5) {
      Renderer.renderRoundHeader();
    }
    // Renderer.renderRoundHeader();

    GameEngine.resetTempScores();

    // round 1 starts on scores
    if (GameState.round === 1) {
      Renderer.renderScoreView();
      return;
    }

    // round > 1 : show last event by default
    if (GameState.lastWinner && GameState.lastEvent) {
      Renderer.renderEventView(GameState.lastWinner, GameState.lastEvent);
    } else {
      Renderer.renderScoreView();
    }
  },

  toggleMode() {
        // if victory already reached
    if (GameState.round > MAX_ROUNDS) {
      this.resetToHome();
      return;
    }

    if (UIState.mode === "event") {
      Renderer.renderScoreView();
    } else {
      if (GameState.lastWinner && GameState.lastEvent) {
        Renderer.renderEventView(GameState.lastWinner, GameState.lastEvent, { animate: false });
      } else {
        // no event yet -> stay scores
        Renderer.renderScoreView();
      }
    }
  },

  async handleMainAction() {
    // if victory already reached
    if (GameState.round > MAX_ROUNDS) {
      this.resetToHome();
      return;
    }

    // if event mode: movement overlay
    if (UIState.mode === "event") {
      if (GameState.aliceMoves > 0 && GameState.round <= MAX_ROUNDS) {
        this.openMovementOverlay();
      }
      return;
    }

    // scores mode -> commit and transition
    await this.startEventTransition();
  },

  async afterEventResolved() {
    const next = GameEngine.nextRoundOrVictory();
    this.renderRound();
  },

  async startEventTransition() {
  // 1) commit temp scores
  GameEngine.commitTempScores();

  // 2) ranking + winner
  const ranking = GameEngine.getRanking();
  const trueWinner = ranking[0];
  const isFinalRound = (GameState.round === MAX_ROUNDS);

  const roundWinner = isFinalRound ? trueWinner : GameEngine.pickRoundWinner(ranking);

  // 3) draw event
  const event = GameEngine.drawEventFor(roundWinner);
  if (!event) {
    console.warn("[startEventTransition] event null, fallback -> next round");
    GameEngine.setLastResult(roundWinner, {
      title: "Silence",
      description: "Aucun événement disponible.",
      mechanic: { description: "", movement: 0 }
    });
    this.afterEventResolved();
    return;
  }

  // 4) animate transition
  Animator.hideRoundUI();

  if (isFinalRound) {
    // ✅ Manche 5 : seulement final impact
    await Animator.playFinalImpact(roundWinner);
  } else {
    // ✅ Manches 1-4 : roulette
    await Animator.playRoulette({ winner: roundWinner, players: GameState.players });
  }

  // 5) store result
  GameEngine.setLastResult(roundWinner, event);

  // 6) after animation -> next round
  this.afterEventResolved();
},


  openMovementOverlay() {
    if (document.querySelector(".movement-overlay")) return;

    const container = DOM.gameContainer();
    const activeColor = getActiveColor(GameState.lastWinner);

    const overlay = document.createElement("div");
    overlay.className = "movement-overlay";
    overlay.innerHTML = `
      <div class="movement-content">
        <div class="screen-title compass-title">
          <h2>Déplacement d'Alice</h2>
        </div>

        <div class="narrative-note compass-ui-text">
          <p>Appuyez pour découvrir<br>la direction que prend Alice</p>
        </div>

        <div class="compass-container">
          <img class="compass-move" src="assets/movement.png" id="movement-arrow" alt="">
          <img class="compass-direction" src="assets/movement-direction.png" id="movement-direction" alt="">
        </div>

        <div class="movement-steps-left">
          <p style="color:${activeColor};">
            Alice se déplace<br>encore
            <span class="number" style="color: var(--text-main-color);">${GameState.aliceMoves}</span>
            fois
          </p>
        </div>
      </div>
    `;

    container.appendChild(overlay);

    const arrow = overlay.querySelector("#movement-arrow");
    const stepsNumber = overlay.querySelector(".number");
    const stepsText = overlay.querySelector(".movement-steps-left");
    const helper = overlay.querySelector(".compass-ui-text");

    overlay.addEventListener("click", () => {
      if (GameState.aliceMoves > 0) {
        const angles = [0, 90, 180, 270];
        const randomAngle = angles[Math.floor(Math.random() * angles.length)];

        gsap.to(arrow, {
          rotation: `+=${720 + randomAngle}`,
          duration: 0.8,
          ease: "power2.out",
          onComplete: () => {
            GameState.aliceMoves -= 1;
            stepsNumber.innerText = String(GameState.aliceMoves);
            Renderer.updateMainButtons();

            if (GameState.aliceMoves === 0) {
              stepsText.style.display = "none";
              helper.innerHTML = `<p>Alice a fini de se déplacer<br>Appuyez pour fermer</p>`;
              // reveal main button after movement ended
              DOM.btnMainAction().style.display = "none";
            }
          }
        });
      } else {
        gsap.to(overlay, { opacity: 0, duration: 0.3, onComplete: () => overlay.remove() });
      }
    });
  },

  resetToHome() {
    // remove overlays
    document.querySelectorAll(".movement-overlay").forEach(el => el.remove());

    // reset state
    GameEngine.resetGame();

    // reload events fresh
    // (simple approach: reload page state without refresh)
    // Re-fetch initial database
    (async () => {
      const resp = await fetch("events.json");
      const json = await resp.json();
      GameState.database = JSON.parse(JSON.stringify(json));
      Renderer.showScreen("home-screen");
    })();
  }
};

/* =========================================
   BOOT
   ========================================= */
UIController.init();
