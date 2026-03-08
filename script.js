const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ROUND_SECONDS = 15;
const DATAMUSE_URL = "https://api.datamuse.com/words";
const DATAMUSE_MAX_RESULTS = 120;
const wordCache = new Map();

const DIFFICULTIES = {
  easy: {
    label: "Easy",
    minDelay: 4000,
    maxDelay: 8000,
    failChance: 0.4,
    strategy: "random"
  },
  medium: {
    label: "Medium",
    minDelay: 2000,
    maxDelay: 5000,
    failChance: 0.2,
    strategy: "short-prefer"
  },
  hard: {
    label: "Hard",
    minDelay: 1000,
    maxDelay: 3000,
    failChance: 0.05,
    strategy: "shortest",
    fastMoveChance: 0.1,
    fastMinDelay: 500,
    fastMaxDelay: 1200
  }
};

const FALLBACK_WORDS = [
  "abode", "absolve", "adore", "adventure", "airplane", "alpine", "alliance", "amaze", "ambience", "ample",
  "anchor", "angle", "animate", "antique", "aperture", "apple", "arcade", "archive", "armoire", "article",
  "astride", "athlete", "attune", "avenue", "backbone", "badge", "balance", "bargain", "baseline", "beacon",
  "beehive", "behave", "believe", "beret", "bicycle", "bitrate", "blame", "blue", "border", "breeze",
  "bridge", "brine", "bronze", "bubble", "bundle", "butter", "cable", "candle", "captive", "carafe",
  "carefree", "carnage", "castle", "cave", "cellphone", "chance", "chase", "cheese", "chime", "circle",
  "climate", "closet", "combine", "compete", "compose", "concrete", "console", "cottage", "course", "cradle",
  "create", "cruise", "curious", "damage", "dance", "debate", "decade", "declare", "delicate", "desire",
  "device", "dignity", "dispute", "dove", "dragline", "dream", "eagle", "earphone", "eclipse", "elegance",
  "eliminate", "embarrass", "embrace", "empire", "enclave", "engine", "enhance", "enigma", "entire", "envelope",
  "episode", "estate", "evening", "evolve", "example", "excite", "explore", "expose", "fabric", "famine",
  "feature", "fierce", "figure", "finance", "flame", "flexible", "fortune", "fragile", "future", "garage",
  "garden", "genuine", "glimpse", "globe", "grace", "grapple", "habitable", "haze", "heroine", "hologram",
  "horizon", "humble", "ignite", "image", "improve", "include", "inspire", "invoice", "isolate", "jasmine",
  "jungle", "justice", "kingdom", "knowledge", "language", "latitude", "league", "legend", "lifetime", "machine",
  "manage", "marble", "measure", "message", "migrate", "miracle", "mobile", "molecule", "nature", "notable",
  "observe", "octave", "offense", "online", "operate", "orange", "outcome", "palace", "parade", "passage",
  "peace", "people", "phrase", "pinnacle", "pirate", "planet", "please", "posture", "prairie", "prepare",
  "pursue", "quality", "quartz", "queue", "radiance", "range", "rapid", "realize", "referee", "rescue",
  "resource", "rhythmic", "romance", "safeguard", "sample", "savage", "scheme", "science", "secure", "serene",
  "service", "silence", "simple", "skylane", "solace", "source", "space", "sphere", "spiral", "stable",
  "stature", "storage", "strange", "sunrise", "table", "talent", "teammate", "texture", "timelike", "tornado",
  "topple", "treasure", "tribe", "turbine", "ultimate", "universe", "upgrade", "venture", "vintage", "visible",
  "voyage", "warfare", "welcome", "where", "wildfire", "window", "witness", "xylophone", "yearn", "yodel",
  "zealous", "zenlike", "zigzag", "zone",
  "abacus", "abrasive", "abyss", "accelerate", "activate", "activate", "acquire", "address", "adjust", "admit",
  "adventure", "advise", "affinity", "afternoon", "aftermath", "again", "aggregation", "algorithm", "alignment", "also",
  "altitude", "amplify", "amplitude", "anaconda", "anchor", "annotate", "antenna", "aperture", "appliance", "application",
  "argument", "arithmetic", "array", "artificial", "ascend", "aspect", "assemble", "assertion", "assimilate", "assistance",
  "associated", "assume", "asymptote", "attribute", "austere", "automatic", "auxiliary", "availability", "average", "avoid",
  "axis", "background", "backup", "balance", "bandwidth", "base", "baseline", "battery", "behind", "behave", "believe",
  "below", "beyond", "bicycle", "binary", "bind", "biometric", "blade", "blank", "block", "blueprint", "body", "boil",
  "both", "bottle", "bounce", "bound", "branch", "breakthrough", "brightness", "broadcast", "browser", "budget", "buffer",
  "build", "bump", "bundle", "burst", "business", "byte", "calculate", "call", "camera", "cancel", "canvas", "captive",
  "card", "care", "carry", "case", "catalyst", "category", "ceiling", "cell", "center", "certify", "chain", "chart",
  "check", "choice", "circle", "circuit", "class", "clear", "client", "clock", "clone", "close", "cloud", "cluster",
  "code", "coefficient", "cohesion", "coil", "collapse", "color", "column", "combine", "command", "comment", "commit",
  "compare", "compile", "complete", "component", "composite", "compress", "compute", "concentrate", "concept", "conclusion",
  "connect", "consent", "construct", "container", "contain", "context", "continue", "contract", "control", "converge",
  "conversion", "convert", "coordinate", "copy", "core", "correlate", "count", "couple", "course", "coverage", "create",
  "credit", "criteria", "crop", "curve", "cursor", "custom", "cycle", "data", "database", "debug", "declare", "default",
  "define", "degree", "delay", "delete", "deliver", "density", "deploy", "deposit", "detection", "diffuse", "digital",
  "dimension", "direction", "directory", "disable", "discovery", "distance", "distort", "distribute", "document", "domain",
  "download", "draft", "draw", "drive", "duplicate", "duration", "dynamic", "earth", "echo", "edge", "edit", "element",
  "else", "email", "empty", "encode", "end", "endpoint", "energy", "engine", "enhance", "enough", "enter", "entity",
  "environment", "equal", "error", "escape", "estimate", "evaluation", "event", "example", "exchange", "execute", "exist",
  "exit", "expand", "expect", "experience", "expert", "explain", "explicit", "explode", "export", "expose", "expression", "extend", "money", "monitor", "month", "moral", "motion", "move", "multiple", "multiply", "mutation", "myth", "narrative", "native", "nature", "navigate", "network", "neutral", "new", "next", "node", "noise", "nominal", "normal", "notion",
  "novel", "null", "number", "object", "obscure", "observe", "obtain", "occur", "offer", "office", "offline", "offset",
  "onion", "online", "only", "open", "operate", "opinion", "opponent", "option", "orange", "order", "organize",
  "origin", "other", "output", "outside", "overall", "overlap", "overlay", "owner", "package", "page", "pair", "panel", "paradigm", "parameter", "parent", "part", "pass", "patch", "path", "pattern", "pause", "pay", "peak", "peer", "penalty", "people", "perceive", "perform", "period", "permission",
  "persist", "personality", "perspective", "phase", "phone", "photo", "phrase", "physical", "pick", "picture",
  "piece", "pipeline", "place", "plan", "platform", "play", "player", "please", "point", "policy", "port", "pose",
  "position", "positive", "possible", "post", "potential", "power", "practice", "preference", "prepare", "present",
  "pressure", "price", "primary", "prime", "print", "priority", "privacy", "private", "process", "produce", "product",
  "production", "professional", "profile", "program", "progress", "project", "promise", "prompt", "proof", "property",
  "protect", "protocol", "provider", "public", "pull", "purpose", "push", "quality", "quarter", "question", "queue",
];

const state = {
  gameStarted: false,
  difficulty: "medium",
  lastDifficultyFaced: null,
  playerScore: 0,
  botScore: 0,
  playerLetter: "",
  botLetter: "",
  timerLeft: ROUND_SECONDS,
  timerTickId: null,
  timerEndMs: null,
  phase: "start",
  botStatus: "",
  roundSettled: false,
  playerSubmission: null,
  botSubmission: null,
  roundWordPools: {
    player: [],
    bot: [],
    loading: false,
    error: false
  },
  pendingTimeouts: []
};

const el = {
  startScreen: document.getElementById("startScreen"),
  letterPhase: document.getElementById("letterPhase"),
  revealPhase: document.getElementById("revealPhase"),
  challengePhase: document.getElementById("challengePhase"),
  resultPhase: document.getElementById("resultPhase"),
  startGameBtn: document.getElementById("startGameBtn"),
  difficultySelect: document.getElementById("difficultySelect"),
  lastDifficultyText: document.getElementById("lastDifficultyText"),
  letterGrid: document.getElementById("letterGrid"),
  confirmLetterBtn: document.getElementById("confirmLetterBtn"),
  revealPlayerLetter: document.getElementById("revealPlayerLetter"),
  revealBotLetter: document.getElementById("revealBotLetter"),
  revealCountdown: document.getElementById("revealCountdown"),
  livePlayerLetter: document.getElementById("livePlayerLetter"),
  liveBotLetter: document.getElementById("liveBotLetter"),
  timerRing: document.getElementById("timerRing"),
  timerText: document.getElementById("timerText"),
  botStatus: document.getElementById("botStatus"),
  wordForm: document.getElementById("wordForm"),
  wordInput: document.getElementById("wordInput"),
  submitWordBtn: document.getElementById("submitWordBtn"),
  inputHint: document.getElementById("inputHint"),
  winnerText: document.getElementById("winnerText"),
  resultPlayerWord: document.getElementById("resultPlayerWord"),
  resultBotWord: document.getElementById("resultBotWord"),
  resultSuggestions: document.getElementById("resultSuggestions"),
  nextRoundBtn: document.getElementById("nextRoundBtn"),
  backToStartBtns: document.querySelectorAll("#backToStartBtn"),
  playerScore: document.getElementById("playerScore"),
  botScore: document.getElementById("botScore")
};

initialize();

function initialize() {
  buildLetterGrid();

  el.startGameBtn.addEventListener("click", startGame);
  el.confirmLetterBtn.addEventListener("click", lockPlayerLetter);
  el.wordForm.addEventListener("submit", onPlayerSubmit);
  el.wordInput.addEventListener("input", onPlayerInputPreview);
  el.nextRoundBtn.addEventListener("click", prepareRound);
  el.backToStartBtns.forEach((btn) => btn.addEventListener("click", goBackToStart));

  setPhase("start");
  renderScore();
  renderLastDifficulty();
}

function buildLetterGrid() {
  el.letterGrid.innerHTML = "";
  LETTERS.forEach((letter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "letter-btn";
    button.textContent = letter;
    button.addEventListener("click", () => selectPlayerLetter(letter, button));
    el.letterGrid.appendChild(button);
  });
}

function startGame() {
  state.gameStarted = true;
  state.playerScore = 0;
  state.botScore = 0;
  state.difficulty = el.difficultySelect.value;
  renderScore();
  prepareRound();
}

function prepareRound() {
  clearAllTimers();

  state.playerLetter = "";
  state.botLetter = "";
  state.timerLeft = ROUND_SECONDS;
  state.phase = "letter";
  state.roundSettled = false;
  state.playerSubmission = null;
  state.botSubmission = null;
  state.roundWordPools = {
    player: [],
    bot: [],
    loading: false,
    error: false
  };

  el.confirmLetterBtn.disabled = true;
  el.inputHint.textContent = "";
  el.wordInput.value = "";
  el.wordInput.disabled = false;
  el.submitWordBtn.disabled = false;
  el.wordInput.classList.remove("good", "bad", "shake");
  setBotStatus("Bot is waiting...");

  [...el.letterGrid.children].forEach((btn) => btn.classList.remove("selected"));
  setPhase("letter");
}

function goBackToStart() {
  clearAllTimers();

  if (state.gameStarted) {
    state.lastDifficultyFaced = state.difficulty;
  }

  state.gameStarted = false;
  state.roundSettled = true;
  state.playerScore = 0;
  state.botScore = 0;
  state.playerSubmission = null;
  state.botSubmission = null;
  state.playerLetter = "";
  state.botLetter = "";

  if (state.lastDifficultyFaced) {
    el.difficultySelect.value = state.lastDifficultyFaced;
  }

  renderScore();
  renderLastDifficulty();
  setPhase("start");
}

function selectPlayerLetter(letter, buttonElement) {
  state.playerLetter = letter;
  [...el.letterGrid.children].forEach((btn) => btn.classList.remove("selected"));
  buttonElement.classList.add("selected");
  el.confirmLetterBtn.disabled = false;
}

function lockPlayerLetter() {
  if (!state.playerLetter) {
    return;
  }

  state.botLetter = getRandomBotLetter(state.playerLetter);
  runRevealAnimation();
}

function runRevealAnimation() {
  setPhase("reveal");
  el.revealPlayerLetter.textContent = state.playerLetter;
  el.revealBotLetter.textContent = "?";

  let count = 3;
  el.revealCountdown.textContent = String(count);

  const countdownId = setInterval(() => {
    count -= 1;

    if (count > 0) {
      el.revealCountdown.textContent = String(count);
      return;
    }

    clearInterval(countdownId);
    el.revealBotLetter.textContent = state.botLetter;
    el.revealCountdown.textContent = "Fight!";

    const timeoutId = setTimeout(() => beginChallengeRound(), 700);
    state.pendingTimeouts.push(timeoutId);
  }, 700);

  state.pendingTimeouts.push(countdownId);
}

function beginChallengeRound() {
  state.phase = "challenge";
  state.timerLeft = ROUND_SECONDS;
  state.timerEndMs = Date.now() + ROUND_SECONDS * 1000;

  el.livePlayerLetter.textContent = state.playerLetter;
  el.liveBotLetter.textContent = state.botLetter;
  el.wordInput.value = "";
  el.wordInput.focus();
  el.wordInput.disabled = false;
  el.submitWordBtn.disabled = false;
  el.inputHint.textContent = "Enter a word with 4+ letters.";
  setBotStatus("Bot is thinking...");

  setPhase("challenge");
  renderTimer();

  primeRoundWordPools();

  state.timerTickId = setInterval(updateTimer, 100);
  scheduleBotAttempt();
}

function updateTimer() {
  const msLeft = Math.max(0, state.timerEndMs - Date.now());
  state.timerLeft = msLeft / 1000;
  renderTimer();

  if (msLeft <= 0) {
    settleRound("time");
  }
}

function renderTimer() {
  const wholeSeconds = Math.ceil(state.timerLeft);
  const progress = Math.max(0, Math.min(100, (state.timerLeft / ROUND_SECONDS) * 100));
  el.timerText.textContent = String(wholeSeconds);
  el.timerRing.style.setProperty("--p", `${progress}%`);
}

function onPlayerInputPreview() {
  if (state.phase !== "challenge" || state.roundSettled) {
    return;
  }

  const value = el.wordInput.value.trim();
  el.wordInput.classList.remove("good", "bad");

  if (!value) {
    el.inputHint.textContent = "Enter a word with 4+ letters.";
    return;
  }

  const shapeValid = shapeIsValid(value, state.playerLetter, state.botLetter);
  el.wordInput.classList.add(shapeValid ? "good" : "bad");
  el.inputHint.textContent = shapeValid
    ? "Pattern looks valid. Submit now."
    : `Must start with ${state.playerLetter} and end with ${state.botLetter}.`;
}

async function onPlayerSubmit(event) {
  event.preventDefault();

  if (state.phase !== "challenge" || state.roundSettled || state.playerSubmission) {
    return;
  }

  const value = el.wordInput.value.trim();
  const submittedAt = Date.now();
  const startLetter = state.playerLetter;
  const endLetter = state.botLetter;

  if (!shapeIsValid(value, startLetter, endLetter)) {
    el.wordInput.classList.remove("shake");
    void el.wordInput.offsetWidth;
    el.wordInput.classList.add("bad", "shake");
    el.inputHint.textContent = `Invalid word. Use 4+ letters, start ${startLetter}, end ${endLetter}.`;
    return;
  }

  el.submitWordBtn.disabled = true;
  el.inputHint.textContent = "Checking dictionary...";

  let validWords = state.roundWordPools.player;
  if (!validWords.length) {
    validWords = await getValidWords(startLetter, endLetter);
  }

  if (!isCurrentRound(startLetter, endLetter)) {
    return;
  }

  const valid = validWords.includes(value.toLowerCase());

  if (!valid) {
    el.submitWordBtn.disabled = false;
    el.wordInput.classList.remove("shake");
    void el.wordInput.offsetWidth;
    el.wordInput.classList.add("bad", "shake");
    el.inputHint.textContent = `Not found in dictionary. Keep ${startLetter}...${endLetter}.`;
    return;
  }

  state.playerSubmission = {
    word: value,
    valid: true,
    timestamp: submittedAt
  };

  el.wordInput.disabled = true;
  el.submitWordBtn.disabled = true;
  el.wordInput.classList.remove("bad");
  el.wordInput.classList.add("good");
  el.inputHint.textContent = "Valid submit locked.";

  maybeAutoSettle();
}

function scheduleBotAttempt() {
  const settings = DIFFICULTIES[state.difficulty];
  const startLetter = state.botLetter;
  const endLetter = state.playerLetter;

  let thinkingDelay = randomInt(settings.minDelay, settings.maxDelay);
  let failChance = settings.failChance;

  if (state.difficulty === "hard" && Math.random() < settings.fastMoveChance) {
    thinkingDelay = randomInt(settings.fastMinDelay, settings.fastMaxDelay);
    failChance = 0;
  }

  const thinkingTimer = setTimeout(async () => {
    if (state.roundSettled || state.phase !== "challenge") {
      return;
    }

    let validWords = state.roundWordPools.bot;
    if (!validWords.length) {
      setBotStatus("Bot is checking words...");
      validWords = await getValidWords(startLetter, endLetter);
    }

    if (!isCurrentRound(endLetter, startLetter)) {
      return;
    }

    if (!validWords.length || Math.random() < failChance) {
      setBotStatus("I got nothing...");
      state.botSubmission = {
        word: "",
        valid: false,
        timestamp: Date.now()
      };
      maybeAutoSettle();
      return;
    }

    const chosenWord = pickBotWord(validWords, settings.strategy);

    setBotStatus("Bot is typing...");
    const typingDelay = Math.max(450, chosenWord.length * 120);

    const typingTimer = setTimeout(() => {
      if (state.roundSettled || state.phase !== "challenge") {
        return;
      }

      state.botSubmission = {
        word: chosenWord,
        valid: true,
        timestamp: Date.now()
      };

      setBotStatus("Bot submitted!");
      maybeAutoSettle();
    }, typingDelay);

    state.pendingTimeouts.push(typingTimer);
  }, thinkingDelay);

  state.pendingTimeouts.push(thinkingTimer);
}

function maybeAutoSettle() {
  if (state.roundSettled) {
    return;
  }

  if (state.playerSubmission && state.botSubmission) {
    settleRound("both-finished");
  }
}

function settleRound(reason) {
  if (state.roundSettled) {
    return;
  }

  state.roundSettled = true;
  clearInterval(state.timerTickId);
  state.timerTickId = null;

  const winner = determineWinner();

  if (winner === "player") {
    state.playerScore += 1;
    triggerConfetti();
  } else if (winner === "bot") {
    state.botScore += 1;
  }

  renderScore();
  renderResult(winner, reason);
  setPhase("result");
}

function determineWinner() {
  const p = state.playerSubmission;
  const b = state.botSubmission;

  if (p && p.valid && b && b.valid) {
    if (p.timestamp < b.timestamp) {
      return "player";
    }
    if (b.timestamp < p.timestamp) {
      return "bot";
    }
    return "none";
  }

  if (p && p.valid && (!b || !b.valid)) {
    return "player";
  }

  if (b && b.valid && (!p || !p.valid)) {
    return "bot";
  }

  return "none";
}

function renderResult(winner) {
  const playerWord = state.playerSubmission?.word || "No valid word";
  const botWord = state.botSubmission?.word || "No valid word";

  el.resultPlayerWord.textContent = playerWord;
  el.resultBotWord.textContent = botWord;

  if (winner === "player") {
    el.winnerText.textContent = "You won the round! +1 point";
  } else if (winner === "bot") {
    el.winnerText.textContent = "Bot won the round! +1 point";
  } else {
    el.winnerText.textContent = "No points this round.";
  }

  renderRoundSuggestions();
}

async function renderRoundSuggestions() {
  const startLetter = state.playerLetter;
  const endLetter = state.botLetter;

  el.resultSuggestions.textContent = `Possible words (${startLetter}...${endLetter}): loading...`;

  let words = state.roundWordPools.player;
  if (!words.length) {
    words = await getValidWords(startLetter, endLetter);
  }

  if (state.phase !== "result" || state.playerLetter !== startLetter || state.botLetter !== endLetter) {
    return;
  }

  if (!words.length) {
    el.resultSuggestions.textContent = `Possible words (${startLetter}...${endLetter}): none found this round.`;
    return;
  }

  const picks = pickSuggestionWords(words);
  el.resultSuggestions.textContent = `Possible words (${startLetter}...${endLetter}): ${picks.join(", ")}`;
}

function pickSuggestionWords(words) {
  const unique = [...new Set(words.map((word) => word.toLowerCase()))];
  const shuffled = [...unique].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(2, shuffled.length));
  return picked;
}

function renderScore() {
  el.playerScore.textContent = String(state.playerScore);
  el.botScore.textContent = String(state.botScore);
}

function renderLastDifficulty() {
  if (!state.lastDifficultyFaced) {
    el.lastDifficultyText.hidden = true;
    el.lastDifficultyText.textContent = "";
    return;
  }

  const difficultyLabel = DIFFICULTIES[state.lastDifficultyFaced]?.label || state.lastDifficultyFaced;
  el.lastDifficultyText.hidden = false;
  el.lastDifficultyText.textContent = `Last opponent: ${difficultyLabel} Bot`;
}

function setBotStatus(text) {
  state.botStatus = text;
  el.botStatus.textContent = text;
}

function setPhase(nextPhase) {
  state.phase = nextPhase;

  const map = {
    start: el.startScreen,
    letter: el.letterPhase,
    reveal: el.revealPhase,
    challenge: el.challengePhase,
    result: el.resultPhase
  };

  Object.entries(map).forEach(([phaseKey, section]) => {
    const isActive = phaseKey === nextPhase;
    section.classList.toggle("active", isActive);
    section.setAttribute("aria-hidden", String(!isActive));
  });
}

function clearAllTimers() {
  clearInterval(state.timerTickId);
  state.timerTickId = null;

  state.pendingTimeouts.forEach((timerId) => {
    clearTimeout(timerId);
    clearInterval(timerId);
  });

  state.pendingTimeouts = [];
}

function getRandomBotLetter(excludeLetter) {
  const choices = LETTERS.filter((letter) => letter !== excludeLetter);
  return choices[Math.floor(Math.random() * choices.length)];
}

function shapeIsValid(word, startLetter, endLetter) {
  const clean = word.toLowerCase();
  return (
    clean.length >= 4 &&
    clean.startsWith(startLetter.toLowerCase()) &&
    clean.endsWith(endLetter.toLowerCase())
  );
}

async function primeRoundWordPools() {
  state.roundWordPools.loading = true;
  state.roundWordPools.error = false;

  const playerStart = state.playerLetter;
  const playerEnd = state.botLetter;
  const botStart = state.botLetter;
  const botEnd = state.playerLetter;

  try {
    const [playerWords, botWords] = await Promise.all([
      getValidWords(playerStart, playerEnd),
      getValidWords(botStart, botEnd)
    ]);

    if (!isCurrentRound(playerStart, playerEnd)) {
      return;
    }

    state.roundWordPools.player = playerWords;
    state.roundWordPools.bot = botWords;
    state.roundWordPools.loading = false;
  } catch (error) {
    state.roundWordPools.loading = false;
    state.roundWordPools.error = true;
    console.error("Failed to load Datamuse words", error);
  }
}

async function getValidWords(startLetter, endLetter) {
  const start = startLetter.toLowerCase();
  const end = endLetter.toLowerCase();
  const key = `${start}_${end}`;

  if (wordCache.has(key)) {
    return wordCache.get(key);
  }

  const pattern = `${start}*${end}`;
  const url = `${DATAMUSE_URL}?sp=${encodeURIComponent(pattern)}&max=${DATAMUSE_MAX_RESULTS}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Datamuse request failed: ${response.status}`);
    }

    const data = await response.json();
    const words = [...new Set(data
      .map((entry) => String(entry.word || "").toLowerCase())
      .filter((word) =>
        word.length >= 4 &&
        /^[a-z]+$/.test(word) &&
        word.startsWith(start) &&
        word.endsWith(end)
      ))];

    wordCache.set(key, words);
    return words;
  } catch (error) {
    console.warn("Using fallback words after Datamuse error", error);
    const fallback = FALLBACK_WORDS.filter((word) =>
      word.startsWith(start) &&
      word.endsWith(end) &&
      word.length >= 4
    );
    wordCache.set(key, fallback);
    return fallback;
  }
}

function isCurrentRound(playerLetter, botLetter) {
  return (
    state.phase === "challenge" &&
    !state.roundSettled &&
    state.playerLetter === playerLetter &&
    state.botLetter === botLetter
  );
}

function pickBotWord(validWords, strategy) {
  const words = [...validWords];

  if (strategy === "shortest") {
    words.sort((a, b) => a.length - b.length || a.localeCompare(b));
    return words[0];
  }

  if (strategy === "short-prefer") {
    words.sort((a, b) => a.length - b.length || a.localeCompare(b));
    const topHalf = words.slice(0, Math.ceil(words.length / 2));
    return topHalf[Math.floor(Math.random() * topHalf.length)];
  }

  return words[Math.floor(Math.random() * words.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function triggerConfetti() {
  const count = 40;
  const colors = ["#dd5a2a", "#2466a6", "#f0b429", "#1c9b59"];

  for (let i = 0; i < count; i += 1) {
    const bit = document.createElement("span");
    bit.className = "confetti";
    bit.style.left = `${Math.random() * 100}vw`;
    bit.style.background = colors[Math.floor(Math.random() * colors.length)];
    bit.style.setProperty("--drift", `${randomInt(-120, 120)}px`);
    bit.style.animationDelay = `${Math.random() * 200}ms`;
    document.body.appendChild(bit);

    setTimeout(() => bit.remove(), 1300);
  }
}
