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

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const rooms = new Map();
const socketToRoom = new Map();
const wordCache = new Map();

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
      socketToRoom.set(socket.id, roomCode);
      socket.join(roomCode);

      socket.emit("join-success", { roomCode });
      const joinStatus = room.players.length === 2
        ? "Both players joined. Click Ready when you are set."
        : "Joined room.";
      broadcastRoomUpdate(roomCode, room, joinStatus);
    } catch (error) {
      socket.emit("room-error", { message: "Could not join room." });
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
      ? "Both players are ready. Press Play to start."
      : "Waiting for both players to click Ready...";
    broadcastRoomUpdate(roomCode, room, status);
  });

  socket.on("round-ready", () => {
    // Backward compatibility with older clients that only sent round-ready.
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
      ? "Both players are ready. Press Play to start."
      : "Waiting for both players to click Ready...";
    broadcastRoomUpdate(roomCode, room, status);
  });

  socket.on("play-round", () => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) {
      return;
    }

    const room = rooms.get(roomCode);
    if (!room || room.players.length < 2 || room.round) {
      return;
    }

    if (room.ready.size < 2) {
      broadcastRoomUpdate(roomCode, room, "Both players must click Ready first.");
      return;
    }

    startRound(roomCode, room);
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

    if (room.round && !room.round.resolved) {
      clearTimeout(room.round.timeoutId);
      room.round.resolved = true;
    }

    if (room.players.length === 0) {
      rooms.delete(roomCode);
      return;
    }

    broadcastRoomUpdate(roomCode, room, "Opponent disconnected.");
    io.to(roomCode).emit("round-waiting", { status: "Opponent disconnected. Waiting for player..." });
  });
});

function createRoom(roomCode) {
  return {
    roomCode,
    players: [],
    ready: new Set(),
    lives: {},
    round: null
  };
}

function broadcastRoomUpdate(roomCode, room, status) {
  const readySocketIds = room.players
    .filter((player) => room.ready.has(player.socketId))
    .map((player) => player.socketId);

  const readyUserIds = room.players
    .filter((player) => room.ready.has(player.socketId))
    .map((player) => player.userId);

  io.to(roomCode).emit("room-update", {
    players: room.players.map((player) => ({
      username: player.username,
      userId: player.userId,
      socketId: player.socketId
    })),
    readySocketIds,
    readyUserIds,
    status
  });
}

function startRound(roomCode, room) {
  if (room.ready.size < 2) {
    return;
  }

  room.ready.clear();

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

  const letterA = randomLetter();
  const letterB = randomLetter(letterA);

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

function finalizeRound(roomCode, room) {
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

  const suggestionsA = getSuggestionsSync(lettersA.playerLetter, lettersA.opponentLetter);
  const suggestionsB = getSuggestionsSync(lettersB.playerLetter, lettersB.opponentLetter);

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

  const someoneKnockedOut = room.lives[playerA.socketId] <= 0 || room.lives[playerB.socketId] <= 0;
  room.round = null;
  if (someoneKnockedOut) {
    broadcastRoomUpdate(roomCode, room, "Match over. A player reached 0 lives. Go Back to Start for a new game.");
  } else {
    broadcastRoomUpdate(roomCode, room, "Round finished. Click Ready when you are set for next round.");
  }
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

  const words = await getValidWords(startLetter, endLetter);
  return words.includes(word);
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
  } catch (_error) {
    const fallback = [
      "apple", "angle", "alive", "abide", "eagle", "engine", "enclave", "enigma", "orange", "operate"
    ].filter((word) => word.startsWith(start) && word.endsWith(end) && word.length >= 4);

    wordCache.set(key, fallback);
    return fallback;
  }
}

function getSuggestionsSync(startLetter, endLetter) {
  const key = `${startLetter.toLowerCase()}_${endLetter.toLowerCase()}`;
  const cached = wordCache.get(key) || [];
  return cached.slice(0, 2);
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

function randomLetter(excludeLetter) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter((letter) => letter !== excludeLetter);
  return letters[Math.floor(Math.random() * letters.length)];
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