const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ROUND_SECONDS = 15;
const REVEAL_STEP_MS = 700;
const STARTING_LIVES = 20;
const DATAMUSE_URL = "https://api.datamuse.com/words";
const DATAMUSE_MAX_RESULTS = 120;
const wordCache = new Map();
const APP_CONFIG = window.APP_CONFIG || {};
const SOCKET_SERVER_URL = normalizeBaseUrl(APP_CONFIG.socketServerUrl);
const OAUTH_REDIRECT_TO = normalizeBaseUrl(APP_CONFIG.oauthRedirectTo) || window.location.origin;

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
  "escape", "eternal", "evade", "evolve", "excite", "exile", "explode", "explore", "extreme", "fabric", "fable",
  "facade", "faction", "falcon", "familiar", "fathom", "feature", "federate", "feeble", "fiction", "figure",
  "finale", "fissure", "flair", "flash", "flight", "flourish", "flute", "focus", "fondle", "force", "forecast",
  "forego", "forge", "forsake", "fossil", "foster", "found", "fracture", "frank", "freedom", "frighten", "frolic",
  "frown", "fumble", "funny", "garden", "gaze", "giggle", "glance", "glow", "glue", "gossip", "grace", "grasp",
  "grind", "gristle", "guitar", "gullible", "haggle", "harmless", "harmony", "harsh", "haste", "hatch", "haunt",
  "haze", "hedge", "heirloom", "heritage", "hiss", "hitch", "hobble", "hollow", "honey", "hook", "hug", "humble",
  "hunger", "hush", "hut", "hype", "hypothesis", "iceberg", "idiotic", "ignite", "illusion", "illustrious",
  "imagine", "imitate", "impossible", "impulse", "incline", "inconceivable", "incredible", "incurable", "inert",
  "infinite", "injure", "innocent", "insane", "insecure", "insightful", "inspiration", "inspire", "intense",
  "intuitive", "invent", "inventive", "juxtapose", "juxtaposition", "juxtapositional", "juxtapositionally", "juxtapositions",
  "keen", "kettle", "keyhole", "kindle", "kingdom", "kiss", "kitten", "knack", "label", "labor", "ladder", "ladybug",
  "lament", "lapse", "latch", "launch", "lavish", "leap", "leash", "leather", "leap", "leash", "leather", "leap", "leash",
  "leather", "legacy", "legend", "lemon", "lens", "leopard", "letter", "level", "liberty", "library", "license", "lick",
  "light", "limb", "limelight", "limit", "linguist", "linguistic", "linguistically", "linguistics", "linguist", "linguistic",
  "linguistically", "linguistics", "liquid", "list", "lithe", "liver", "lizard", "loft", "logic", "lonely", "longing",
  "loophole", "loose", "lounge", "love", "loyal", "lucid", "lucky", "lure", "machine", "madness", "magnet", "magnificent",
  "majesty", "major", "make", "malice", "mammal", "manage", "mandate", "mangle", "maniac", "mantle", "manual",
  "marble", "march", "margin", "marine", "marvel", "mascot", "mask", "master", "match", "material", "matrix",
  "matter", "maximum", "maze", "meadow", "measure", "medal", "mediate", "melody", "melt", "member", "memory",
  "mention", "mercy", "merge", "merit", "merry", "mesh", "message", "metal", "method", "meticulous",
  "mettle", "midnight", "might", "mild", "military", "milk", "mill", "mindful", "miracle", "mischief",
  "misery", "misfit", "misfortune", "misguided", "mishap", "missile", "mission", "mistake", "mister",
  "mix", "moan", "mobile", "mock", "model", "modern", "modest", "modify", "module", "moisture", "molecule",
  "moment", "monarch", "monastery", "monument", "mood", "moral", "morality", "morbid", "moral"
];

const state = {
  phase: "start",
  mode: null,
  authType: null,
  userId: null,
  username: null,
  supabaseReady: false,
  gameStarted: false,
  difficulty: "medium",
  lastDifficultyFaced: null,
  playerScore: STARTING_LIVES,
  opponentScore: STARTING_LIVES,
  playerLetter: "",
  opponentLetter: "",
  timerLeft: ROUND_SECONDS,
  timerTickId: null,
  timerEndMs: null,
  roundSettled: false,
  playerSubmission: null,
  opponentSubmission: null,
  roundWordPools: {
    player: [],
    opponent: []
  },
  pendingTimeouts: [],
  socket: null,
  roomCode: null,
  lobbyPlayers: [],
  lobbyReadySocketIds: [],
  lobbyReadyUserIds: [],
  opponentName: "Opponent",
  roundPendingStart: false
};

const el = {
  startScreen: document.getElementById("startScreen"),
  lobbyPhase: document.getElementById("lobbyPhase"),
  letterPhase: document.getElementById("letterPhase"),
  revealPhase: document.getElementById("revealPhase"),
  challengePhase: document.getElementById("challengePhase"),
  resultPhase: document.getElementById("resultPhase"),
  playerScore: document.getElementById("playerScore"),
  botScore: document.getElementById("botScore"),
  authStatusText: document.getElementById("authStatusText"),
  googleLoginBtn: document.getElementById("googleLoginBtn"),
  guestEntryBtn: document.getElementById("guestEntryBtn"),
  guestForm: document.getElementById("guestForm"),
  guestUsernameInput: document.getElementById("guestUsernameInput"),
  guestContinueBtn: document.getElementById("guestContinueBtn"),
  modePanel: document.getElementById("modePanel"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  difficultySelect: document.getElementById("difficultySelect"),
  startBotGameBtn: document.getElementById("startBotGameBtn"),
  lastDifficultyText: document.getElementById("lastDifficultyText"),
  lobbyRoomText: document.getElementById("lobbyRoomText"),
  lobbyStatusText: document.getElementById("lobbyStatusText"),
  lobbyPlayersText: document.getElementById("lobbyPlayersText"),
  lobbyReadyBtn: document.getElementById("lobbyReadyBtn"),
  lobbyPlayBtn: document.getElementById("lobbyPlayBtn"),
  letterGrid: document.getElementById("letterGrid"),
  confirmLetterBtn: document.getElementById("confirmLetterBtn"),
  playerLetterLabel: document.getElementById("playerLetterLabel"),
  opponentLetterLabel: document.getElementById("opponentLetterLabel"),
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
  backToStartBtns: document.querySelectorAll(".back-to-start-btn")
};

let supabaseClient = null;

initialize();

async function initialize() {
  buildLetterGrid();
  bindEvents();
  initializeSupabase();
  await recoverSupabaseSession();

  setPhase("start");
  renderScore();
  renderLastDifficulty();
  updateAuthStatus();
  updateModePanelVisibility();
}

function bindEvents() {
  el.googleLoginBtn.addEventListener("click", loginWithGoogle);
  el.guestEntryBtn.addEventListener("click", () => {
    el.guestForm.hidden = false;
    el.guestUsernameInput.focus();
  });

  el.guestContinueBtn.addEventListener("click", continueAsGuest);
  el.guestUsernameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      continueAsGuest();
    }
  });

  el.joinRoomBtn.addEventListener("click", joinMultiplayerRoom);
  el.lobbyReadyBtn.addEventListener("click", toggleLobbyReady);
  el.lobbyPlayBtn.addEventListener("click", startLobbyRound);
  el.startBotGameBtn.addEventListener("click", startBotMode);
  el.confirmLetterBtn.addEventListener("click", lockPlayerLetter);
  el.wordForm.addEventListener("submit", onPlayerSubmit);
  el.wordInput.addEventListener("input", onPlayerInputPreview);
  el.nextRoundBtn.addEventListener("click", onNextRoundClick);
  el.backToStartBtns.forEach((btn) => btn.addEventListener("click", goBackToStart));
}

function initializeSupabase() {
  if (!window.supabase || !APP_CONFIG.supabaseUrl || !APP_CONFIG.supabaseAnonKey) {
    state.supabaseReady = false;
    return;
  }

  supabaseClient = window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
  state.supabaseReady = true;
}

async function recoverSupabaseSession() {
  if (!supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Supabase session error", error);
    return;
  }

  if (data.session?.user) {
    applyAuthenticatedUser(data.session.user, "google");
  }
}

async function loginWithGoogle() {
  if (!supabaseClient) {
    updateAuthStatus("Supabase not configured. Use guest mode or set app-config.js.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: OAUTH_REDIRECT_TO
    }
  });

  if (error) {
    updateAuthStatus(`Google login failed: ${error.message}`);
  }
}

function continueAsGuest() {
  const username = sanitizeUsername(el.guestUsernameInput.value);
  if (!username) {
    updateAuthStatus("Enter a guest username first.");
    return;
  }

  state.authType = "guest";
  state.username = username;
  state.userId = `guest_${username.toLowerCase()}`;
  updateAuthStatus();
  updateModePanelVisibility();
}

function applyAuthenticatedUser(user, type) {
  const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
  const emailName = user.email ? user.email.split("@")[0] : "Player";
  state.authType = type;
  state.userId = user.id;
  state.username = sanitizeUsername(metaName || emailName || "Player");
  updateAuthStatus();
  updateModePanelVisibility();
}

function updateAuthStatus(overrideText) {
  if (overrideText) {
    el.authStatusText.textContent = overrideText;
    return;
  }

  if (!state.authType) {
    el.authStatusText.textContent = "Not authenticated";
    return;
  }

  const method = state.authType === "google" ? "Google" : "Guest";
  el.authStatusText.textContent = `Signed in as ${state.username} (${method})`;
}

function updateModePanelVisibility() {
  el.modePanel.hidden = !state.authType;
}

function sanitizeUsername(value) {
  const clean = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .slice(0, 20);
  return clean;
}

function startBotMode() {
  if (!state.authType) {
    updateAuthStatus("Authenticate first before starting.");
    return;
  }

  disconnectSocket();
  state.mode = "bot";
  state.gameStarted = true;
  state.opponentName = "Bot";
  state.difficulty = el.difficultySelect.value;
  state.playerScore = STARTING_LIVES;
  state.opponentScore = STARTING_LIVES;
  renderScore();
  prepareBotRound();
}

function joinMultiplayerRoom() {
  if (!state.authType) {
    updateAuthStatus("Authenticate first before joining a room.");
    return;
  }

  if (typeof io !== "function") {
    updateAuthStatus("Socket client not available. Start server first.");
    return;
  }

  const code = String(el.roomCodeInput.value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

  if (code.length < 4) {
    updateAuthStatus("Room code must be at least 4 characters.");
    return;
  }

  state.mode = "multiplayer";
  state.gameStarted = true;
  state.playerScore = STARTING_LIVES;
  state.opponentScore = STARTING_LIVES;
  renderScore();

  connectSocket(code);
}

function connectSocket(roomCode) {
  disconnectSocket();

  const socket = SOCKET_SERVER_URL
    ? io(SOCKET_SERVER_URL, { transports: ["websocket", "polling"] })
    : io();
  state.socket = socket;

  socket.on("connect", () => {
    socket.emit("join-room", {
      roomCode,
      username: state.username,
      userId: state.userId
    });
  });

  socket.on("join-success", (payload) => {
    state.roomCode = payload.roomCode;
    state.lobbyReadySocketIds = [];
    state.lobbyReadyUserIds = [];
    setPhase("lobby");
    renderLobby("Waiting for opponent to join...");
  });

  socket.on("room-update", (payload) => {
    state.lobbyPlayers = payload.players || [];
    state.lobbyReadySocketIds = payload.readySocketIds || [];
    state.lobbyReadyUserIds = payload.readyUserIds || [];
    renderLobby(payload.status || "Room updated.");
  });

  socket.on("round-start", (payload) => {
    state.lobbyReadySocketIds = [];
    state.lobbyReadyUserIds = [];
    state.roundPendingStart = true;
    state.playerLetter = payload.playerLetter;
    state.opponentLetter = payload.opponentLetter;
    state.opponentName = payload.opponentName || "Opponent";
    runRevealAnimation(() => beginChallengeRound("multiplayer"));
  });

  socket.on("round-result", (payload) => {
    state.roundSettled = true;
    clearInterval(state.timerTickId);
    state.timerTickId = null;
    state.playerScore = typeof payload.youLives === "number" ? payload.youLives : payload.youScore;
    state.opponentScore = typeof payload.opponentLives === "number" ? payload.opponentLives : payload.opponentScore;
    state.playerSubmission = payload.youWord ? { word: payload.youWord, valid: true } : null;
    state.opponentSubmission = payload.opponentWord ? { word: payload.opponentWord, valid: true } : null;

    renderScore();
    renderMultiplayerResult(payload);
    setPhase("result");
  });

  socket.on("round-waiting", (payload) => {
    setPhase("lobby");
    renderLobby(payload.status || "Waiting for opponent...");
  });

  socket.on("room-error", (payload) => {
    updateAuthStatus(payload.message || "Failed to join room.");
    goBackToStart();
  });

  socket.on("disconnect", () => {
    if (state.mode === "multiplayer") {
      setBotStatus("Disconnected from room.");
      setPhase("lobby");
      renderLobby("Connection lost. Rejoin room from start.");
    }
  });
}

function renderLobby(statusText) {
  el.lobbyRoomText.textContent = `Room: ${state.roomCode || "-"}`;
  el.lobbyStatusText.textContent = statusText;
  if (!state.lobbyPlayers.length) {
    el.lobbyPlayersText.textContent = "";
    updateLobbyControls();
    return;
  }

  const names = state.lobbyPlayers
    .map((player) => {
      const isReady = isPlayerReadyInLobby(player);
      const youTag = isSelfPlayer(player) ? " [You]" : "";
      return `${player.username}${youTag} (${isReady ? "Ready" : "Not ready"})`;
    })
    .join(" vs ");
  el.lobbyPlayersText.textContent = `Players: ${names}`;
  updateLobbyControls();
}

function onNextRoundClick() {
  if (state.mode === "multiplayer") {
    setPhase("lobby");
    renderLobby("Click Ready when you are set, then press Play.");
    return;
  }

  prepareBotRound();
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

function prepareBotRound() {
  clearAllTimers();

  state.playerLetter = "";
  state.opponentLetter = "";
  state.timerLeft = ROUND_SECONDS;
  state.phase = "letter";
  state.roundSettled = false;
  state.playerSubmission = null;
  state.opponentSubmission = null;
  state.roundWordPools = { player: [], opponent: [] };

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
  disconnectSocket();

  if (state.mode === "bot" && state.gameStarted) {
    state.lastDifficultyFaced = state.difficulty;
  }

  state.mode = null;
  state.gameStarted = false;
  state.roundSettled = true;
  state.playerScore = STARTING_LIVES;
  state.opponentScore = STARTING_LIVES;
  state.playerSubmission = null;
  state.opponentSubmission = null;
  state.playerLetter = "";
  state.opponentLetter = "";
  state.roomCode = null;
  state.lobbyPlayers = [];
  state.lobbyReadySocketIds = [];
  state.lobbyReadyUserIds = [];
  state.opponentName = "Opponent";

  renderScore();
  renderLastDifficulty();
  setPhase("start");
}

function disconnectSocket() {
  if (state.socket) {
    state.socket.disconnect();
  }
  state.socket = null;
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/\/+$/, "");
}

function toggleLobbyReady() {
  if (!state.socket || state.lobbyPlayers.length < 2) {
    return;
  }

  const nextReady = !isSelfReadyInLobby();
  state.socket.emit("set-ready", { ready: nextReady });

  // Compatibility path for older servers that only understand round-ready.
  if (nextReady) {
    state.socket.emit("round-ready");
  }

  renderLobby(nextReady ? "Marking you as ready..." : "Marking you as not ready...");
}

function startLobbyRound() {
  if (!state.socket || !canPlayFromLobby()) {
    return;
  }

  el.lobbyPlayBtn.disabled = true;
  state.socket.emit("play-round");
  renderLobby("Starting round...");
}

function isSelfReadyInLobby() {
  const selfPlayer = state.lobbyPlayers.find((player) => isSelfPlayer(player));
  if (!selfPlayer) {
    return false;
  }

  return isPlayerReadyInLobby(selfPlayer);
}

function canPlayFromLobby() {
  if (state.lobbyPlayers.length < 2) {
    return false;
  }

  return state.lobbyPlayers.every((player) => isPlayerReadyInLobby(player));
}

function isSelfPlayer(player) {
  if (!player) {
    return false;
  }

  const selfSocketId = state.socket?.id;
  if (selfSocketId && player.socketId === selfSocketId) {
    return true;
  }

  return Boolean(player.userId) && player.userId === state.userId;
}

function isPlayerReadyInLobby(player) {
  if (!player) {
    return false;
  }

  if (player.socketId && state.lobbyReadySocketIds.includes(player.socketId)) {
    return true;
  }

  return Boolean(player.userId) && state.lobbyReadyUserIds.includes(player.userId);
}

function updateLobbyControls() {
  const hasOpponent = state.lobbyPlayers.length === 2;
  const selfReady = isSelfReadyInLobby();
  const allReady = canPlayFromLobby();

  el.lobbyReadyBtn.disabled = !hasOpponent;
  el.lobbyReadyBtn.textContent = selfReady ? "Unready" : "Ready";
  el.lobbyPlayBtn.disabled = !allReady;
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

  state.opponentLetter = getRandomLetter(state.playerLetter);
  runRevealAnimation(() => beginChallengeRound("bot"));
}

function runRevealAnimation(onComplete) {
  setPhase("reveal");
  el.playerLetterLabel.textContent = "Your Letter";
  el.opponentLetterLabel.textContent = state.mode === "bot" ? "Bot Letter" : `${state.opponentName} Letter`;
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
    el.revealBotLetter.textContent = state.opponentLetter;
    el.revealCountdown.textContent = "Fight!";

    const timeoutId = setTimeout(onComplete, REVEAL_STEP_MS);
    state.pendingTimeouts.push(timeoutId);
  }, REVEAL_STEP_MS);

  state.pendingTimeouts.push(countdownId);
}

function beginChallengeRound(mode) {
  state.phase = "challenge";
  state.mode = mode;
  state.timerLeft = ROUND_SECONDS;
  state.timerEndMs = Date.now() + ROUND_SECONDS * 1000;
  state.roundSettled = false;
  state.playerSubmission = null;
  state.opponentSubmission = null;

  el.livePlayerLetter.textContent = state.playerLetter;
  el.liveBotLetter.textContent = state.opponentLetter;
  el.wordInput.value = "";
  el.wordInput.focus();
  el.wordInput.disabled = false;
  el.submitWordBtn.disabled = false;
  el.inputHint.textContent = "Enter a word with 4+ letters.";
  setBotStatus(mode === "bot" ? "Bot is thinking..." : `${state.opponentName} is thinking...`);

  setPhase("challenge");
  renderTimer();

  if (mode === "bot") {
    primeRoundWordPools();
    scheduleBotAttempt();
  }

  state.timerTickId = setInterval(updateTimer, 100);
}

function updateTimer() {
  const msLeft = Math.max(0, state.timerEndMs - Date.now());
  state.timerLeft = msLeft / 1000;
  renderTimer();

  if (msLeft > 0) {
    return;
  }

  clearInterval(state.timerTickId);
  state.timerTickId = null;

  if (state.mode === "bot") {
    settleBotRound("time");
  } else {
    state.roundSettled = true;
    el.wordInput.disabled = true;
    el.submitWordBtn.disabled = true;
    el.inputHint.textContent = "Waiting for server result...";
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

  const shapeValid = shapeIsValid(value, state.playerLetter, state.opponentLetter);
  el.wordInput.classList.add(shapeValid ? "good" : "bad");
  el.inputHint.textContent = shapeValid
    ? "Pattern looks valid. Submit now."
    : `Must start with ${state.playerLetter} and end with ${state.opponentLetter}.`;
}

async function onPlayerSubmit(event) {
  event.preventDefault();

  if (state.phase !== "challenge" || state.roundSettled || state.playerSubmission) {
    return;
  }

  const value = el.wordInput.value.trim();
  const submittedAt = Date.now();

  if (!shapeIsValid(value, state.playerLetter, state.opponentLetter)) {
    shakeInput();
    el.inputHint.textContent = `Invalid shape. Must be ${state.playerLetter}...${state.opponentLetter}.`;
    return;
  }

  if (state.mode === "multiplayer") {
    state.playerSubmission = { word: value, valid: true, timestamp: submittedAt };
    el.wordInput.disabled = true;
    el.submitWordBtn.disabled = true;
    setBotStatus("Submitted. Waiting for opponent...");
    state.socket?.emit("round-submit", { word: value });
    return;
  }

  el.submitWordBtn.disabled = true;
  el.inputHint.textContent = "Checking dictionary...";

  let validWords = state.roundWordPools.player;
  if (!validWords.length) {
    validWords = await getValidWords(state.playerLetter, state.opponentLetter);
  }

  if (!isCurrentBotRound()) {
    return;
  }

  const valid = validWords.includes(value.toLowerCase());
  if (!valid) {
    el.submitWordBtn.disabled = false;
    shakeInput();
    el.inputHint.textContent = "Not found in dictionary.";
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

  maybeAutoSettleBotRound();
}

function shakeInput() {
  el.wordInput.classList.remove("shake");
  void el.wordInput.offsetWidth;
  el.wordInput.classList.add("bad", "shake");
}

function scheduleBotAttempt() {
  const settings = DIFFICULTIES[state.difficulty];
  let thinkingDelay = randomInt(settings.minDelay, settings.maxDelay);
  let failChance = settings.failChance;

  if (state.difficulty === "hard" && Math.random() < settings.fastMoveChance) {
    thinkingDelay = randomInt(settings.fastMinDelay, settings.fastMaxDelay);
    failChance = 0;
  }

  const thinkingTimer = setTimeout(async () => {
    if (!isCurrentBotRound()) {
      return;
    }

    let validWords = state.roundWordPools.opponent;
    if (!validWords.length) {
      setBotStatus("Bot is checking words...");
      validWords = await getValidWords(state.opponentLetter, state.playerLetter);
    }

    if (!isCurrentBotRound()) {
      return;
    }

    if (!validWords.length || Math.random() < failChance) {
      setBotStatus("I got nothing...");
      state.opponentSubmission = {
        word: "",
        valid: false,
        timestamp: Date.now()
      };
      maybeAutoSettleBotRound();
      return;
    }

    const chosenWord = pickBotWord(validWords, settings.strategy);
    setBotStatus("Bot is typing...");

    const typingTimer = setTimeout(() => {
      if (!isCurrentBotRound()) {
        return;
      }

      state.opponentSubmission = {
        word: chosenWord,
        valid: true,
        timestamp: Date.now()
      };

      setBotStatus("Bot submitted!");
      maybeAutoSettleBotRound();
    }, Math.max(450, chosenWord.length * 120));

    state.pendingTimeouts.push(typingTimer);
  }, thinkingDelay);

  state.pendingTimeouts.push(thinkingTimer);
}

function maybeAutoSettleBotRound() {
  if (state.playerSubmission && state.opponentSubmission) {
    settleBotRound("both-finished");
  }
}

function settleBotRound() {
  if (state.roundSettled) {
    return;
  }

  state.roundSettled = true;
  clearInterval(state.timerTickId);
  state.timerTickId = null;

  const winner = determineWinnerFromSubmissions();
  const damage = getDamageFromWinner(winner);
  const gameOver = applyRoundDamage(winner, damage);

  if (winner === "player" && damage > 0) {
    triggerConfetti();
  }

  renderScore();
  renderBotResult(winner, damage, gameOver);
  setPhase("result");
}

function getDamageFromWinner(winner) {
  if (winner === "player") {
    return getDamageFromWord(state.playerSubmission?.word);
  }

  if (winner === "opponent") {
    return getDamageFromWord(state.opponentSubmission?.word);
  }

  return 0;
}

function applyRoundDamage(winner, damage) {
  if (damage <= 0 || winner === "none") {
    return false;
  }

  if (winner === "player") {
    state.opponentScore = Math.max(0, state.opponentScore - damage);
    return state.opponentScore <= 0;
  }

  state.playerScore = Math.max(0, state.playerScore - damage);
  return state.playerScore <= 0;
}

function determineWinnerFromSubmissions() {
  const p = state.playerSubmission;
  const o = state.opponentSubmission;

  if (p && p.valid && o && o.valid) {
    return p.timestamp < o.timestamp ? "player" : "opponent";
  }

  if (p && p.valid && (!o || !o.valid)) {
    return "player";
  }

  if (o && o.valid && (!p || !p.valid)) {
    return "opponent";
  }

  return "none";
}

function renderBotResult(winner, damage, gameOver) {
  el.resultPlayerWord.textContent = state.playerSubmission?.word || "No valid word";
  el.resultBotWord.textContent = state.opponentSubmission?.word || "No valid word";

  if (winner === "player") {
    const koSuffix = gameOver ? " Bot is out of lives." : "";
    el.winnerText.textContent = `You hit Bot for ${damage} damage.${koSuffix}`;
  } else if (winner === "opponent") {
    const koSuffix = gameOver ? " You are out of lives." : "";
    el.winnerText.textContent = `Bot hit you for ${damage} damage.${koSuffix}`;
  } else {
    el.winnerText.textContent = "No damage this round.";
  }

  renderRoundSuggestions();
}

function renderMultiplayerResult(payload) {
  el.resultPlayerWord.textContent = payload.youWord || "No valid word";
  el.resultBotWord.textContent = payload.opponentWord || "No valid word";
  el.winnerText.textContent = payload.resultText || "Round finished.";

  const picks = (payload.suggestions || []).slice(0, 2);
  if (!picks.length) {
    el.resultSuggestions.textContent = `Possible words (${state.playerLetter}...${state.opponentLetter}): none found.`;
  } else {
    el.resultSuggestions.textContent = `Possible words (${state.playerLetter}...${state.opponentLetter}): ${picks.join(", ")}`;
  }
}

async function renderRoundSuggestions() {
  const startLetter = state.playerLetter;
  const endLetter = state.opponentLetter;

  el.resultSuggestions.textContent = `Possible words (${startLetter}...${endLetter}): loading...`;

  let words = state.roundWordPools.player;
  if (!words.length) {
    words = await getValidWords(startLetter, endLetter);
  }

  if (state.phase !== "result" || state.playerLetter !== startLetter || state.opponentLetter !== endLetter) {
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
  return shuffled.slice(0, Math.min(2, shuffled.length));
}

function setBotStatus(text) {
  el.botStatus.textContent = text;
}

function setPhase(nextPhase) {
  state.phase = nextPhase;
  const map = {
    start: el.startScreen,
    lobby: el.lobbyPhase,
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

function renderScore() {
  el.playerScore.textContent = String(state.playerScore);
  el.botScore.textContent = String(state.opponentScore);
}

function getDamageFromWord(word) {
  const clean = String(word || "").trim();
  if (clean.length < 4) {
    return 0;
  }

  // 4-5 letters: 1 damage, 6-7: 2, 8-9: 3, etc., capped for balance.
  return Math.max(1, Math.min(8, 1 + Math.floor((clean.length - 4) / 2)));
}

function renderLastDifficulty() {
  if (!state.lastDifficultyFaced) {
    el.lastDifficultyText.hidden = true;
    el.lastDifficultyText.textContent = "";
    return;
  }

  const label = DIFFICULTIES[state.lastDifficultyFaced]?.label || state.lastDifficultyFaced;
  el.lastDifficultyText.hidden = false;
  el.lastDifficultyText.textContent = `Last bot difficulty: ${label}`;
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

function getRandomLetter(excludeLetter) {
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

function isCurrentBotRound() {
  return state.phase === "challenge" && !state.roundSettled && state.mode === "bot";
}

async function primeRoundWordPools() {
  const playerStart = state.playerLetter;
  const playerEnd = state.opponentLetter;
  const opponentStart = state.opponentLetter;
  const opponentEnd = state.playerLetter;

  const [playerWords, opponentWords] = await Promise.all([
    getValidWords(playerStart, playerEnd),
    getValidWords(opponentStart, opponentEnd)
  ]);

  if (!isCurrentBotRound()) {
    return;
  }

  state.roundWordPools.player = playerWords;
  state.roundWordPools.opponent = opponentWords;
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
    const fallback = FALLBACK_WORDS.filter((word) =>
      word.length >= 4 &&
      word.startsWith(start) &&
      word.endsWith(end)
    );
    wordCache.set(key, fallback);
    return fallback;
  }
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
