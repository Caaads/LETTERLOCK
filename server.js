const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const PORT = Number(process.env.PORT || 3000);
const ROUND_SECONDS = 15;
const REVEAL_BUFFER_SECONDS = 3;
const MAX_ROOM_PLAYERS = 2;
const STARTING_LIVES = 20;
const DATAMUSE_URL = "https://api.datamuse.com/words";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const GAME_MODES = {
  PICK: "pick",
  RANDOM: "random"
};

// Add your own always-valid words here. These are merged with Datamuse results.
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

const corsOrigins = CORS_ORIGIN
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname)));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const rooms = new Map();
const socketToRoom = new Map();
const wordCache = new Map();
const exactWordCache = new Map();

io.on("connection", (socket) => {
  socket.on("join-room", async (payload = {}) => {
    try {
      const roomCode = normalizeRoomCode(payload.roomCode);
      const username = sanitizeUsername(payload.username || "Player");
      const userId = String(payload.userId || socket.id);

      if (!roomCode) {
        socket.emit("room-error", { message: "Invalid room code." });
        return;
      }

      let room = rooms.get(roomCode);
      if (!room) {
        room = createRoom(roomCode);
        rooms.set(roomCode, room);
      }

      if (room.players.length >= MAX_ROOM_PLAYERS) {
        socket.emit("room-error", { message: "Room is full." });
        return;
      }

      if (room.players.some((player) => player.socketId === socket.id)) {
        socket.emit("room-error", { message: "Already in room." });
        return;
      }

      room.players.push({ socketId: socket.id, username, userId });
      room.letterHistory[socket.id] = [];

      if (!room.hostSocketId) {
        room.hostSocketId = socket.id;
      }

      socketToRoom.set(socket.id, roomCode);
      socket.join(roomCode);

      socket.emit("join-success", { roomCode });
      const joinStatus = room.players.length === 2
        ? "Both players joined. Click Ready when you are set. Host can start the game."
        : "Joined room. You are the host.";
      broadcastRoomUpdate(roomCode, room, joinStatus);
    } catch (_error) {
      socket.emit("room-error", { message: "Could not join room." });
    }
  });

  socket.on("update-room-settings", (payload = {}, ack) => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) {
      if (typeof ack === "function") {
        ack({ ok: false, message: "Not in a room." });
      }
      return;
    }

    const room = rooms.get(roomCode);
    ensureRoomState(room);
    ensureHostSocketId(room);
    if (!room || room.hostSocketId !== socket.id) {
      if (typeof ack === "function") {
        ack({ ok: false, message: "Only host can update room settings." });
      }
      return;
    }

    room.settings = sanitizeRoomSettings(payload, room.settings);
    broadcastRoomUpdate(roomCode, room, "Room settings updated by host.");
    if (typeof ack === "function") {
      ack({ ok: true, settings: serializeRoomSettings(room.settings) });
    }
  });

  socket.on("set-ready", (payload = {}) => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) {
      return;
    }

    const room = rooms.get(roomCode);
    if (!room || room.players.length < 2) {
      return;
    }

    if (payload.ready) {
      room.ready.add(socket.id);
    } else {
      room.ready.delete(socket.id);
    }

    const status = room.ready.size >= 2
      ? "Both players are ready. Host can press Play."
      : "Waiting for both players to click Ready...";
    broadcastRoomUpdate(roomCode, room, status);
  });

  socket.on("round-ready", () => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) {
      return;
    }

    const room = rooms.get(roomCode);
    if (!room || room.players.length < 2) {
      return;
    }

    room.ready.add(socket.id);
    const status = room.ready.size >= 2
      ? "Both players are ready. Host can press Play."
      : "Waiting for both players to click Ready...";
    broadcastRoomUpdate(roomCode, room, status);
  });

  socket.on("play-round", () => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) {
      return;
    }

    const room = rooms.get(roomCode);
    ensureHostSocketId(room);
    if (!room || room.players.length < 2 || room.round || room.pickPhase) {
      return;
    }

    if (room.hostSocketId !== socket.id) {
      socket.emit("room-error", { message: "Only the host can start the game." });
      return;
    }

    if (room.ready.size < 2) {
      broadcastRoomUpdate(roomCode, room, "Both players must click Ready first.");
      return;
    }

    const [playerA, playerB] = room.players;
    if (!playerA || !playerB) {
      return;
    }

    ensureLives(room, playerA.socketId);
    ensureLives(room, playerB.socketId);

    if (room.lives[playerA.socketId] <= 0 || room.lives[playerB.socketId] <= 0) {
      broadcastRoomUpdate(roomCode, room, "Match is over. Go Back to Start for a new game.");
      return;
    }

    room.ready.clear();

    if (room.settings.mode === GAME_MODES.RANDOM) {
      const letterA = pickRandomAllowedLetter(room, playerA.socketId);
      const letterB = pickRandomAllowedLetter(room, playerB.socketId, letterA);
      startRoundWithLetters(roomCode, room, letterA, letterB);
      return;
    }

    startPickPhase(roomCode, room);
  });

  socket.on("submit-letter", (payload = {}, ack) => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) {
      if (typeof ack === "function") {
        ack({ ok: false, message: "Not in a room." });
      }
      return;
    }

    const room = rooms.get(roomCode);
    if (!room || !room.pickPhase) {
      if (typeof ack === "function") {
        ack({ ok: false, message: "Pick phase is not active." });
      }
      return;
    }

    const now = Date.now();
    if (now > room.pickPhase.deadlineAt) {
      if (typeof ack === "function") {
        ack({ ok: false, message: "Pick timer already ended." });
      }
      return;
    }

    if (!(socket.id in room.pickPhase.letters)) {
      if (typeof ack === "function") {
        ack({ ok: false, message: "You are not part of this pick phase." });
      }
      return;
    }

    const letter = String(payload.letter || "").trim().toUpperCase();
    if (!LETTERS.includes(letter)) {
      if (typeof ack === "function") {
        ack({ ok: false, message: "Invalid letter selected." });
      }
      return;
    }

    const disallowed = room.pickPhase.disallowed[socket.id] || [];
    if (disallowed.includes(letter)) {
      socket.emit("room-error", {
        message: `Letter ${letter} is on cooldown. Pick another letter.`
      });
      if (typeof ack === "function") {
        ack({ ok: false, message: `Letter ${letter} is on cooldown.` });
      }
      return;
    }

    room.pickPhase.letters[socket.id] = letter;
    if (typeof ack === "function") {
      ack({ ok: true });
    }

    const allPicked = room.players.every((player) => Boolean(room.pickPhase.letters[player.socketId]));
    if (allPicked) {
      finalizePickPhase(roomCode, room);
    }
  });

  socket.on("round-submit", async (payload = {}) => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) {
      return;
    }

    const room = rooms.get(roomCode);
    if (!room || !room.round || room.round.resolved) {
      return;
    }

    const round = room.round;
    if (!round.startedAt || Date.now() > round.deadlineAt) {
      return;
    }

    if (round.submissions[socket.id]) {
      return;
    }

    const word = String(payload.word || "").trim().toLowerCase();
    const playerLetter = round.letters[socket.id]?.playerLetter;
    const opponentLetter = round.letters[socket.id]?.opponentLetter;

    if (!playerLetter || !opponentLetter) {
      return;
    }

    const valid = await isValidWord(word, playerLetter, opponentLetter);
    round.submissions[socket.id] = {
      word,
      valid,
      timestamp: Date.now()
    };

    const shouldEnd = valid || Object.keys(round.submissions).length >= 2;
    if (shouldEnd) {
      finalizeRound(roomCode, room);
    }
  });

  socket.on("disconnect", () => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) {
      return;
    }

    const room = rooms.get(roomCode);
    socketToRoom.delete(socket.id);

    if (!room) {
      return;
    }

    room.players = room.players.filter((player) => player.socketId !== socket.id);
    room.ready.delete(socket.id);
    delete room.lives[socket.id];
    delete room.letterHistory[socket.id];

    if (room.pickPhase) {
      clearTimeout(room.pickPhase.timeoutId);
      room.pickPhase = null;
    }

    if (room.round && !room.round.resolved) {
      clearTimeout(room.round.timeoutId);
      room.round.resolved = true;
    }

    if (room.hostSocketId === socket.id) {
      room.hostSocketId = room.players[0]?.socketId || null;
    }

    if (room.players.length === 0) {
      rooms.delete(roomCode);
      return;
    }

    broadcastRoomUpdate(roomCode, room, "Opponent disconnected.");
    io.to(roomCode).emit("round-waiting", {
      status: "Opponent disconnected. Waiting for player..."
    });
  });
});

function createRoom(roomCode) {
  return {
    roomCode,
    players: [],
    hostSocketId: null,
    settings: defaultRoomSettings(),
    ready: new Set(),
    lives: {},
    letterHistory: {},
    pickPhase: null,
    round: null
  };
}

function defaultRoomSettings() {
  return {
    mode: GAME_MODES.PICK,
    pickSeconds: 5,
    repeatCooldownRounds: 2
  };
}

function ensureRoomState(room) {
  if (!room) {
    return;
  }

  if (!room.settings || typeof room.settings !== "object") {
    room.settings = defaultRoomSettings();
    return;
  }

  room.settings = sanitizeRoomSettings(room.settings, defaultRoomSettings());
}

function sanitizeRoomSettings(raw, current = defaultRoomSettings()) {
  const next = { ...current };

  if (raw.mode === GAME_MODES.RANDOM || raw.mode === GAME_MODES.PICK) {
    next.mode = raw.mode;
  }

  const pickSeconds = Number(raw.pickSeconds);
  if (Number.isFinite(pickSeconds)) {
    next.pickSeconds = Math.max(3, Math.min(15, Math.floor(pickSeconds)));
  }

  const repeatCooldownRounds = Number(raw.repeatCooldownRounds);
  if (Number.isFinite(repeatCooldownRounds)) {
    next.repeatCooldownRounds = Math.max(0, Math.min(3, Math.floor(repeatCooldownRounds)));
  }

  return next;
}

function serializeRoomSettings(settings) {
  return {
    mode: settings.mode,
    pickSeconds: settings.pickSeconds,
    repeatCooldownRounds: settings.repeatCooldownRounds
  };
}

function broadcastRoomUpdate(roomCode, room, status) {
  ensureHostSocketId(room);

  const readySocketIds = room.players
    .filter((player) => room.ready.has(player.socketId))
    .map((player) => player.socketId);

  const readyUserIds = room.players
    .filter((player) => room.ready.has(player.socketId))
    .map((player) => player.userId);

  const payload = {
    players: room.players.map((player) => ({
      username: player.username,
      userId: player.userId,
      socketId: player.socketId
    })),
    hostSocketId: room.hostSocketId,
    settings: serializeRoomSettings(room.settings),
    readySocketIds,
    readyUserIds,
    status
  };

  io.to(roomCode).emit("room-update", payload);
}

function ensureHostSocketId(room) {
  if (!room) {
    return;
  }

  const hasCurrentHost = room.players.some((player) => player.socketId === room.hostSocketId);
  if (room.hostSocketId && hasCurrentHost) {
    return;
  }

  room.hostSocketId = room.players[0]?.socketId || null;
}

function startPickPhase(roomCode, room) {
  ensureRoomState(room);

  const [playerA, playerB] = room.players;
  if (!playerA || !playerB) {
    return;
  }

  const pickSeconds = Number.isFinite(Number(room.settings.pickSeconds))
    ? Math.max(3, Math.min(15, Math.floor(Number(room.settings.pickSeconds))))
    : 5;
  const disallowedA = getDisallowedLetters(room, playerA.socketId);
  const disallowedB = getDisallowedLetters(room, playerB.socketId);

  room.pickPhase = {
    deadlineAt: Date.now() + pickSeconds * 1000,
    letters: {
      [playerA.socketId]: null,
      [playerB.socketId]: null
    },
    disallowed: {
      [playerA.socketId]: disallowedA,
      [playerB.socketId]: disallowedB
    },
    timeoutId: null
  };

  io.to(playerA.socketId).emit("pick-start", {
    pickSeconds,
    disallowedLetters: disallowedA,
    opponentName: playerB.username
  });

  io.to(playerB.socketId).emit("pick-start", {
    pickSeconds,
    disallowedLetters: disallowedB,
    opponentName: playerA.username
  });

  broadcastRoomUpdate(roomCode, room, `Pick your letters. ${pickSeconds}s timer is running.`);

  room.pickPhase.timeoutId = setTimeout(() => {
    finalizePickPhase(roomCode, room);
  }, pickSeconds * 1000);
}

function finalizePickPhase(roomCode, room) {
  if (!room.pickPhase) {
    return;
  }

  const [playerA, playerB] = room.players;
  if (!playerA || !playerB) {
    clearTimeout(room.pickPhase.timeoutId);
    room.pickPhase = null;
    return;
  }

  clearTimeout(room.pickPhase.timeoutId);

  const pickedA = room.pickPhase.letters[playerA.socketId];
  const pickedB = room.pickPhase.letters[playerB.socketId];

  const letterA = pickedA || pickRandomAllowedLetter(room, playerA.socketId);
  const letterB = pickedB || pickRandomAllowedLetter(room, playerB.socketId, letterA);

  room.pickPhase = null;
  startRoundWithLetters(roomCode, room, letterA, letterB);
}

function startRoundWithLetters(roomCode, room, letterA, letterB) {
  const [playerA, playerB] = room.players;
  if (!playerA || !playerB) {
    return;
  }

  room.round = {
    startedAt: Date.now(),
    deadlineAt: Date.now() + (ROUND_SECONDS + REVEAL_BUFFER_SECONDS) * 1000,
    resolved: false,
    submissions: {},
    letters: {
      [playerA.socketId]: { playerLetter: letterA, opponentLetter: letterB },
      [playerB.socketId]: { playerLetter: letterB, opponentLetter: letterA }
    },
    timeoutId: null
  };

  io.to(playerA.socketId).emit("round-start", {
    playerLetter: letterA,
    opponentLetter: letterB,
    opponentName: playerB.username
  });

  io.to(playerB.socketId).emit("round-start", {
    playerLetter: letterB,
    opponentLetter: letterA,
    opponentName: playerA.username
  });

  room.round.timeoutId = setTimeout(() => {
    finalizeRound(roomCode, room);
  }, (ROUND_SECONDS + REVEAL_BUFFER_SECONDS) * 1000);
}

async function finalizeRound(roomCode, room) {
  if (!room.round || room.round.resolved) {
    return;
  }

  room.round.resolved = true;
  clearTimeout(room.round.timeoutId);

  const [playerA, playerB] = room.players;
  if (!playerA || !playerB) {
    room.round = null;
    return;
  }

  const subA = room.round.submissions[playerA.socketId] || null;
  const subB = room.round.submissions[playerB.socketId] || null;

  const winnerSocketId = computeWinner(subA, subB, playerA.socketId, playerB.socketId);
  const winningSubmission = winnerSocketId === playerA.socketId ? subA : winnerSocketId === playerB.socketId ? subB : null;
  const damage = computeDamageFromWord(winningSubmission?.word);

  if (winnerSocketId === playerA.socketId && damage > 0) {
    room.lives[playerB.socketId] = Math.max(0, room.lives[playerB.socketId] - damage);
  } else if (winnerSocketId === playerB.socketId && damage > 0) {
    room.lives[playerA.socketId] = Math.max(0, room.lives[playerA.socketId] - damage);
  }

  const lettersA = room.round.letters[playerA.socketId];
  const lettersB = room.round.letters[playerB.socketId];

  const suggestionsA = await getSuggestions(lettersA.playerLetter, lettersA.opponentLetter);
  const suggestionsB = await getSuggestions(lettersB.playerLetter, lettersB.opponentLetter);

  io.to(playerA.socketId).emit("round-result", {
    youLives: room.lives[playerA.socketId],
    opponentLives: room.lives[playerB.socketId],
    // Legacy fields for older clients.
    youScore: room.lives[playerA.socketId],
    opponentScore: room.lives[playerB.socketId],
    youWord: subA?.valid ? subA.word : "",
    opponentWord: subB?.valid ? subB.word : "",
    resultText: winnerMessage(winnerSocketId, playerA.socketId, playerB.username, damage, room.lives[playerB.socketId]),
    suggestions: suggestionsA
  });

  io.to(playerB.socketId).emit("round-result", {
    youLives: room.lives[playerB.socketId],
    opponentLives: room.lives[playerA.socketId],
    // Legacy fields for older clients.
    youScore: room.lives[playerB.socketId],
    opponentScore: room.lives[playerA.socketId],
    youWord: subB?.valid ? subB.word : "",
    opponentWord: subA?.valid ? subA.word : "",
    resultText: winnerMessage(winnerSocketId, playerB.socketId, playerA.username, damage, room.lives[playerA.socketId]),
    suggestions: suggestionsB
  });

  recordRoundLetters(room);

  const someoneKnockedOut = room.lives[playerA.socketId] <= 0 || room.lives[playerB.socketId] <= 0;
  room.round = null;
  if (someoneKnockedOut) {
    broadcastRoomUpdate(roomCode, room, "Match over. A player reached 0 lives. Go Back to Start for a new game.");
  } else {
    broadcastRoomUpdate(roomCode, room, "Round finished. Click Ready when you are set for next round.");
  }
}

function recordRoundLetters(room) {
  if (!room.round) {
    return;
  }

  const cooldownMemory = Math.max(3, room.settings.repeatCooldownRounds + 1);

  room.players.forEach((player) => {
    const letter = room.round.letters[player.socketId]?.playerLetter;
    if (!letter) {
      return;
    }

    const history = room.letterHistory[player.socketId] || [];
    history.push(letter);
    room.letterHistory[player.socketId] = history.slice(-cooldownMemory);
  });
}

function getDisallowedLetters(room, socketId) {
  const cooldown = room.settings.repeatCooldownRounds;
  if (cooldown <= 0) {
    return [];
  }

  const history = room.letterHistory[socketId] || [];
  return history.slice(-cooldown);
}

function pickRandomAllowedLetter(room, socketId, excludeLetter) {
  const disallowed = new Set(getDisallowedLetters(room, socketId));
  const choices = LETTERS.filter((letter) => letter !== excludeLetter && !disallowed.has(letter));
  const fallback = LETTERS.filter((letter) => letter !== excludeLetter);
  const source = choices.length > 0 ? choices : fallback;
  return source[Math.floor(Math.random() * source.length)];
}

function computeWinner(subA, subB, socketA, socketB) {
  if (subA?.valid && subB?.valid) {
    return subA.timestamp <= subB.timestamp ? socketA : socketB;
  }

  if (subA?.valid) {
    return socketA;
  }

  if (subB?.valid) {
    return socketB;
  }

  return null;
}

function winnerMessage(winnerSocketId, selfSocketId, opponentName, damage, opponentLives) {
  if (!winnerSocketId) {
    return "No damage this round.";
  }

  if (winnerSocketId === selfSocketId) {
    const koSuffix = opponentLives <= 0 ? " Opponent is out of lives." : "";
    return `You hit ${opponentName} for ${damage} damage.${koSuffix}`;
  }

  const koSuffix = opponentLives <= 0 ? " You are out of lives." : "";
  return `${opponentName} hit you for ${damage} damage.${koSuffix}`;
}

async function isValidWord(word, startLetter, endLetter) {
  if (!shapeValid(word, startLetter, endLetter)) {
    return false;
  }

  const start = startLetter.toLowerCase();
  const end = endLetter.toLowerCase();
  const cleanWord = String(word || "").trim().toLowerCase();

  const fallbackWords = getFallbackWordsForPattern(start, end);
  if (fallbackWords.includes(cleanWord)) {
    return true;
  }

  if (exactWordCache.has(cleanWord)) {
    return exactWordCache.get(cleanWord);
  }

  try {
    const exactUrl = `${DATAMUSE_URL}?sp=${encodeURIComponent(cleanWord)}&max=10`;
    const response = await fetch(exactUrl);
    if (response.ok) {
      const data = await response.json();
      const matched = data.some((entry) => String(entry.word || "").toLowerCase() === cleanWord);
      if (matched) {
        exactWordCache.set(cleanWord, true);
        return true;
      }
    }
  } catch (_error) {
    // Continue with pattern-list fallback below.
  }

  const words = await getValidWords(startLetter, endLetter);
  const valid = words.includes(cleanWord);
  exactWordCache.set(cleanWord, valid);
  return valid;
}

function shapeValid(word, startLetter, endLetter) {
  return (
    word.length >= 4 &&
    word.startsWith(startLetter.toLowerCase()) &&
    word.endsWith(endLetter.toLowerCase())
  );
}

async function getValidWords(startLetter, endLetter) {
  const start = startLetter.toLowerCase();
  const end = endLetter.toLowerCase();
  const key = `${start}_${end}`;

  if (wordCache.has(key)) {
    return wordCache.get(key);
  }

  const url = `${DATAMUSE_URL}?sp=${encodeURIComponent(`${start}*${end}`)}&max=120`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Datamuse ${response.status}`);
    }

    const data = await response.json();
    const apiWords = [...new Set(data
      .map((entry) => String(entry.word || "").toLowerCase())
      .filter((word) =>
        word.length >= 4 &&
        /^[a-z]+$/.test(word) &&
        word.startsWith(start) &&
        word.endsWith(end)
      ))];
    const fallbackWords = getFallbackWordsForPattern(start, end);
    const words = [...new Set([...apiWords, ...fallbackWords])];

    wordCache.set(key, words);
    return words;
  } catch (_error) {
    const fallback = getFallbackWordsForPattern(start, end);
    wordCache.set(key, fallback);
    return fallback;
  }
}

function getFallbackWordsForPattern(start, end) {
  return [...new Set(FALLBACK_WORDS
    .map((word) => String(word || "").toLowerCase().trim())
    .filter((word) =>
      word.length >= 4 &&
      /^[a-z]+$/.test(word) &&
      word.startsWith(start) &&
      word.endsWith(end)
    ))];
}

async function getSuggestions(startLetter, endLetter) {
  const words = await getValidWords(startLetter, endLetter);
  if (!words.length) {
    return [];
  }

  const unique = [...new Set(words.map((word) => String(word || "").toLowerCase()))];
  const shuffled = [...unique].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(2, shuffled.length));
}

function ensureLives(room, socketId) {
  if (typeof room.lives[socketId] !== "number") {
    room.lives[socketId] = STARTING_LIVES;
  }
}

function computeDamageFromWord(word) {
  const clean = String(word || "").trim();
  if (clean.length < 4) {
    return 0;
  }

  // 4-5 letters: 1 damage, 6-7: 2, 8-9: 3, etc., capped for balance.
  return Math.max(1, Math.min(8, 1 + Math.floor((clean.length - 4) / 2)));
}

function sanitizeUsername(value) {
  return String(value || "Player")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .slice(0, 20) || "Player";
}

function normalizeRoomCode(value) {
  const clean = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

  return clean.length >= 4 ? clean : "";
}

server.listen(PORT, () => {
  console.log(`LetterLock server listening on port ${PORT}`);
});
