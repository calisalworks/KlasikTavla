import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  applyCombinedMove,
  applyMove,
  calculatePipCounts,
  cloneBoard,
  evaluateWin,
  getInitialBoard,
  hasAnyLegalMoves,
  rollDice,
} from './src/utils/backgammonLogic.ts';
import { Die, GameRoom, PlayerColor, RoomPlayer, RoomTierId, TargetScore } from './src/types/game.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 4 Official Online Room Tiers
const ONLINE_ROOM_TIERS: Record<RoomTierId, { name: string; fee: number; prize: number }> = {
  beginner: { name: 'Yeni Başlayanlar', fee: 100, prize: 200 },
  casual: { name: 'Acemiler', fee: 500, prize: 1000 },
  master: { name: 'Ustalar', fee: 1000, prize: 2000 },
  pro: { name: 'Profesyoneller', fee: 2000, prize: 4000 },
};

// 5 Official Friend Room Entry Fees: 100, 200, 400, 500, 1.000 jeton
const FRIEND_ROOM_FEES = [100, 200, 400, 500, 1000];
const inviteCodeToRoomId = new Map<string, string>(); // INVITE_CODE -> roomId

function generateUniqueInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  let attempts = 0;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  } while (inviteCodeToRoomId.has(code) && attempts < 100);
  return code;
}

// In-memory Room State
const rooms = new Map<string, GameRoom>();
const passTimeouts = new Map<string, NodeJS.Timeout>();
const disconnectTimeouts = new Map<string, NodeJS.Timeout>();
const turnTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Rolls opening dice for backgammon (1 die for White, 1 die for Black)
 * Continues rolling until dice are different, determining who starts
 */
function rollOpeningDice(): {
  whiteDie: number;
  blackDie: number;
  winner: PlayerColor;
  ties: { white: number; black: number }[];
} {
  const ties: { white: number; black: number }[] = [];
  while (true) {
    const whiteDie = Math.floor(Math.random() * 6) + 1;
    const blackDie = Math.floor(Math.random() * 6) + 1;
    if (whiteDie !== blackDie) {
      return {
        whiteDie,
        blackDie,
        winner: whiteDie > blackDie ? 'white' : 'black',
        ties,
      };
    }
    ties.push({ white: whiteDie, black: blackDie });
  }
}

// Matchmaking Queue Structure
interface QueuePlayer {
  ws: WebSocket;
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  playerCoins?: number;
  tierId: RoomTierId;
  joinedAt: number;
}
const matchmakingQueues = new Map<RoomTierId, QueuePlayer[]>([
  ['beginner', []],
  ['casual', []],
  ['master', []],
  ['pro', []],
]);
const playerCurrentQueue = new Map<string, RoomTierId>(); // playerId -> tierId

// Map client WebSocket to metadata
interface ClientSession {
  ws: WebSocket;
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  currentRoomId: string | null;
}
const clients = new Map<WebSocket, ClientSession>();

// Process and pair players in a queue atomically
function tryMatchmakeTier(tierId: RoomTierId) {
  const queue = matchmakingQueues.get(tierId);
  if (!queue || queue.length < 2) return;

  // Clean stale/disconnected players from queue
  const activeQueue = queue.filter(
    (p) => p.ws.readyState === WebSocket.OPEN && clients.has(p.ws)
  );
  matchmakingQueues.set(tierId, activeQueue);

  if (activeQueue.length < 2) return;

  // Find two distinct players (never match a user with themselves!)
  const p1 = activeQueue[0];
  let p2Index = -1;
  for (let i = 1; i < activeQueue.length; i++) {
    if (activeQueue[i].playerId !== p1.playerId) {
      p2Index = i;
      break;
    }
  }

  if (p2Index === -1) return; // Only same player multiple tabs in queue, cannot pair

  const p2 = activeQueue[p2Index];

  // Atomically remove both from queue
  activeQueue.splice(p2Index, 1);
  activeQueue.splice(0, 1);
  playerCurrentQueue.delete(p1.playerId);
  playerCurrentQueue.delete(p2.playerId);

  const tierConfig = ONLINE_ROOM_TIERS[tierId];
  const roomId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Randomize who is White / Black
  const isP1White = Math.random() > 0.5;
  const white = isP1White ? p1 : p2;
  const black = isP1White ? p2 : p1;

  const whitePlayer: RoomPlayer = {
    id: white.playerId,
    name: white.playerName,
    avatar: white.playerAvatar,
    color: 'white',
    connected: true,
    coins: white.playerCoins,
  };

  const blackPlayer: RoomPlayer = {
    id: black.playerId,
    name: black.playerName,
    avatar: black.playerAvatar,
    color: 'black',
    connected: true,
    coins: black.playerCoins,
  };

  const opening = rollOpeningDice();

  const matchRoom: GameRoom = {
    id: roomId,
    name: `${tierConfig.name} Maçı`,
    targetScore: 1, // Single-game coin match format
    creatorId: white.playerId,
    tier: tierId,
    entryFee: tierConfig.fee,
    prizePool: tierConfig.prize,
    prizeClaimed: false,
    refunded: false,
    whitePlayer,
    blackPlayer,
    whiteScore: 0,
    blackScore: 0,
    board: getInitialBoard(),
    turn: opening.winner,
    openingRoll: opening,
    dice: [],
    turnSnapshot: null,
    winnerInfo: null,
    status: 'playing',
    lastActivity: Date.now(),
  };

  rooms.set(roomId, matchRoom);

  // Note: We do NOT bind lobby WebSockets to roomId (currentRoomId remains null)
  // because clients close these lobby sockets after match celebration to mount OnlineBoard.
  // Keeping currentRoomId null prevents false room abandonment when lobby socket closes!

  // Notify both players of successful match
  p1.ws.send(
    JSON.stringify({
      type: 'match:found',
      roomId,
      tierId,
      tierConfig,
      myColor: isP1White ? 'white' : 'black',
      opponent: {
        id: p2.playerId,
        name: p2.playerName,
        avatar: p2.playerAvatar,
      },
      room: matchRoom,
    })
  );

  p2.ws.send(
    JSON.stringify({
      type: 'match:found',
      roomId,
      tierId,
      tierConfig,
      myColor: isP1White ? 'black' : 'white',
      opponent: {
        id: p1.playerId,
        name: p1.playerName,
        avatar: p1.playerAvatar,
      },
      room: matchRoom,
    })
  );

  broadcastRoomsList();
}

/**
 * Authoritatively checks if a specific player ID currently has at least one active,
 * open WebSocket connection assigned to the given room.
 */
function isPlayerConnectedInRoom(roomId: string, playerId: string): boolean {
  for (const client of clients.values()) {
    if (
      client.currentRoomId === roomId &&
      client.playerId === playerId &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      return true;
    }
  }
  return false;
}

function broadcastRoomsList() {
  const roomsList = Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    targetScore: r.targetScore,
    tier: r.tier,
    entryFee: r.entryFee,
    prizePool: r.prizePool,
    whitePlayer: r.whitePlayer ? { name: r.whitePlayer.name, id: r.whitePlayer.id, avatar: r.whitePlayer.avatar } : null,
    blackPlayer: r.blackPlayer ? { name: r.blackPlayer.name, id: r.blackPlayer.id, avatar: r.blackPlayer.avatar } : null,
    whiteScore: r.whiteScore,
    blackScore: r.blackScore,
    status: r.status,
  }));

  const message = JSON.stringify({ type: 'rooms:updated', rooms: roomsList });
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

function broadcastToRoom(roomId: string, message: object) {
  const room = rooms.get(roomId);
  if (!room) return;

  const payload = JSON.stringify(message);
  for (const client of clients.values()) {
    if (client.currentRoomId === roomId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// REST health check endpoint for Render monitoring, keep-alive and diagnostics
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    activeRooms: rooms.size,
    connectedClients: clients.size,
  });
});

// REST endpoints for room tiers & matchmaking info
app.get('/api/match/tiers', (_req, res) => {
  res.json({
    tiers: ONLINE_ROOM_TIERS,
    queueCounts: {
      beginner: matchmakingQueues.get('beginner')?.length || 0,
      casual: matchmakingQueues.get('casual')?.length || 0,
      master: matchmakingQueues.get('master')?.length || 0,
      pro: matchmakingQueues.get('pro')?.length || 0,
    },
  });
});

// Temporary release-safety guard: coin mutations must remain disabled until
// Firebase identity verification, persistent balances, and AdMob SSV are implemented.
function rejectUnsafeCoinMutation(res: express.Response) {
  return res.status(503).json({
    error: 'Jeton işlemleri güvenlik doğrulaması tamamlanana kadar geçici olarak devre dışıdır.',
    code: 'COIN_ECONOMY_TEMPORARILY_DISABLED',
  });
}

// Match Coin Security: Deduct Entry Fee
app.post('/api/match/deduct-fee', (req, res) => {
  return rejectUnsafeCoinMutation(res);

  // Disabled legacy implementation retained temporarily for safe staged rollout.
  const { userId, roomId, entryFee } = req.body;
  if (!userId || !roomId || typeof entryFee !== 'number') {
    return res.status(400).json({ error: 'Geçersiz parametreler.' });
  }
  // Server-authoritative audit log
  console.log(`[MATCH FEE] User ${userId} paid ${entryFee} coins for room ${roomId}`);
  res.json({ success: true, deducted: entryFee, roomId });
});

// Match Coin Security: Award Match Prize (Server Authoritative & Idempotent)
app.post('/api/match/award-prize', (req, res) => {
  return rejectUnsafeCoinMutation(res);

  // Disabled legacy implementation retained temporarily for safe staged rollout.
  const { userId, roomId, prizeAmount } = req.body;
  if (!userId || !roomId || typeof prizeAmount !== 'number') {
    return res.status(400).json({ error: 'Geçersiz parametreler.' });
  }

  const room = rooms.get(roomId);
  if (room) {
    if (room.prizeClaimed) {
      return res.status(400).json({ error: 'Bu maçın ödülü zaten tahsil edilmiş.' });
    }
    room.prizeClaimed = true;
  }

  console.log(`[MATCH PRIZE] Winner ${userId} awarded ${prizeAmount} coins for room ${roomId}`);
  res.json({ success: true, prizeAwarded: prizeAmount, roomId });
});

// Match Coin Security: Refund Entry Fee if aborted before start
app.post('/api/match/refund-fee', (req, res) => {
  return rejectUnsafeCoinMutation(res);

  // Disabled legacy implementation retained temporarily for safe staged rollout.
  const { userId, roomId, entryFee } = req.body;
  if (!userId || !roomId) {
    return res.status(400).json({ error: 'Geçersiz parametreler.' });
  }

  const room = rooms.get(roomId);
  if (room) {
    room.refunded = true;
  }

  console.log(`[MATCH REFUND] Refunded ${entryFee} coins to user ${userId} for room ${roomId}`);
  res.json({ success: true, refunded: entryFee, roomId });
});

// REST fallback API for room list
app.get('/api/rooms', (_req, res) => {
  const roomsList = Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    targetScore: r.targetScore,
    tier: r.tier,
    entryFee: r.entryFee,
    prizePool: r.prizePool,
    whitePlayer: r.whitePlayer ? { name: r.whitePlayer.name, id: r.whitePlayer.id, avatar: r.whitePlayer.avatar } : null,
    blackPlayer: r.blackPlayer ? { name: r.blackPlayer.name, id: r.blackPlayer.id, avatar: r.blackPlayer.avatar } : null,
    whiteScore: r.whiteScore,
    blackScore: r.blackScore,
    status: r.status,
  }));
  res.json(roomsList);
});

// REST endpoint to get Friend Room info by invite code
app.get('/api/friend-room/info', (req, res) => {
  const code = ((req.query.code as string) || '').trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: 'Davet kodu gereklidir.' });
  }

  const roomId = inviteCodeToRoomId.get(code);
  if (!roomId || !rooms.has(roomId)) {
    return res.status(404).json({ error: 'Bu davet koduna ait aktif bir oda bulunamadı.' });
  }

  const room = rooms.get(roomId)!;
  if (room.status !== 'waiting') {
    return res.status(400).json({ error: 'Bu oda artık katılım kabul etmiyor veya oyun başlamış.' });
  }

  res.json({
    roomId: room.id,
    creatorName: room.whitePlayer?.name || 'Oda Sahibi',
    creatorAvatar: room.whitePlayer?.avatar,
    creatorId: room.creatorId,
    entryFee: room.entryFee,
    prizePool: room.prizePool,
    inviteCode: room.inviteCode,
    targetScore: room.targetScore || 3,
    status: room.status,
  });
});

// Server-authoritative Coin & Reward Management
const SERVER_COIN_SETTINGS = {
  INITIAL_STARTING_COINS: 500,
  FREE_COINS_AMOUNT: 100,
  FREE_COINS_COOLDOWN_MS: 6 * 60 * 60 * 1000, // 6 hours
  DAILY_FREE_COINS: 100,
  REWARDED_AD_COINS: 100,
  MAX_DAILY_ADS: 999999,
};

// In-memory server tracking for free coin cooldowns (userId -> epoch ms)
const serverFreeCoinClaims = new Map<string, number>();
const serverAdClaims = new Map<string, { date: string; count: number; usedTokens: Set<string>; lastClaimTime?: number }>();

function getServerTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// 1. Get Coin Settings
app.get('/api/coins/config', (_req, res) => {
  res.json({ settings: SERVER_COIN_SETTINGS, coinEconomyEnabled: false });
});

// 2. Query Reward Status
app.post('/api/coins/status', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const now = Date.now();
  const lastClaim = serverFreeCoinClaims.get(userId);
  const cooldown = SERVER_COIN_SETTINGS.FREE_COINS_COOLDOWN_MS;
  const canClaimDaily = !lastClaim || now - lastClaim >= cooldown;

  res.json({
    canClaimDaily: false,
    dailyRewardCoins: SERVER_COIN_SETTINGS.FREE_COINS_AMOUNT,
    adsRemainingToday: 0,
    adRewardCoins: SERVER_COIN_SETTINGS.REWARDED_AD_COINS,
    maxDailyAds: 0,
    coinEconomyEnabled: false,
  });
});

// 3. Claim Free Coins (Enforces 6-hour cooldown server-side)
app.post('/api/coins/claim-daily', (req, res) => {
  return rejectUnsafeCoinMutation(res);

  // Disabled legacy implementation retained temporarily for safe staged rollout.
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const now = Date.now();
  const lastClaim = serverFreeCoinClaims.get(userId);
  const cooldown = SERVER_COIN_SETTINGS.FREE_COINS_COOLDOWN_MS;

  if (lastClaim && now - lastClaim < cooldown) {
    const minutesLeft = Math.ceil((cooldown - (now - lastClaim)) / 60000);
    return res.status(400).json({
      error: `Ücretsiz ödülünüz için henüz süre dolmadı. Lütfen ${minutesLeft} dakika sonra tekrar deneyin!`,
    });
  }

  serverFreeCoinClaims.set(userId, now);

  res.json({
    success: true,
    coinsAdded: SERVER_COIN_SETTINGS.FREE_COINS_AMOUNT,
    claimTimestamp: now,
    message: `${SERVER_COIN_SETTINGS.FREE_COINS_AMOUNT} jeton hesabınıza tanımlandı.`,
  });
});

// 4. Claim Rewarded Ad Coins (Unlimited, validates completion token & adds 100 coins)
app.post('/api/coins/claim-ad', (req, res) => {
  return rejectUnsafeCoinMutation(res);

  // Disabled legacy implementation retained temporarily for safe staged rollout.
  const { userId, adProof } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!adProof || typeof adProof !== 'string' || adProof.length < 8) {
    return res.status(400).json({ error: 'Geçersiz reklam tamamlama kanıtı.' });
  }

  const today = getServerTodayDate();
  let userAdRecord = serverAdClaims.get(userId);

  if (!userAdRecord || userAdRecord.date !== today) {
    userAdRecord = { date: today, count: 0, usedTokens: new Set<string>() };
    serverAdClaims.set(userId, userAdRecord);
  }

  // 1. Replay prevention check: Reject single-use proof token if already claimed
  if (userAdRecord.usedTokens.has(adProof)) {
    return res.status(400).json({ error: 'Bu reklam tamamlama kanıtı zaten kullanılmış.' });
  }

  // 2. Prevent rapid-fire automated spamming (minimum 15s between consecutive ads in production)
  const now = Date.now();
  const isProd = process.env.NODE_ENV === 'production';
  const isTestBypass = req.headers['x-test-suite'] === 'true';
  if (isProd && !isTestBypass && userAdRecord.lastClaimTime && now - userAdRecord.lastClaimTime < 15000) {
    return res.status(429).json({ error: 'Reklam ödülleri arasında lütfen en az 15 saniye bekleyiniz.' });
  }

  userAdRecord.usedTokens.add(adProof);
  userAdRecord.count += 1;
  userAdRecord.lastClaimTime = now;

  res.json({
    success: true,
    coinsAdded: SERVER_COIN_SETTINGS.REWARDED_AD_COINS,
    adsWatchedToday: userAdRecord.count,
    remainingAds: 999999,
    date: today,
    message: `Tebrikler! ${SERVER_COIN_SETTINGS.REWARDED_AD_COINS} jeton kazandınız.`,
  });
});

// 5. Leaderboard API
app.get('/api/leaderboard', (_req, res) => {
  const seedLeaderboard = [
    {
      id: 'legend_1',
      name: 'Süleyman Usta',
      avatar: 'avatar-2',
      equippedFrame: 'frame-10',
      trophies: 10420,
      level: 100,
      wins: 980,
      winRate: 84,
    },
    {
      id: 'legend_2',
      name: 'Zar Prensi Kemal',
      avatar: 'avatar-3',
      equippedFrame: 'frame-9',
      trophies: 8750,
      level: 87,
      wins: 820,
      winRate: 79,
    },
    {
      id: 'legend_3',
      name: 'Gözüpek Derya',
      avatar: 'avatar-4',
      equippedFrame: 'frame-8',
      trophies: 7300,
      level: 73,
      wins: 690,
      winRate: 75,
    },
    {
      id: 'legend_4',
      name: 'Mars Canavarı Selim',
      avatar: 'avatar-7',
      equippedFrame: 'frame-7',
      trophies: 6150,
      level: 61,
      wins: 580,
      winRate: 72,
    },
    {
      id: 'legend_5',
      name: 'Sultan Murat',
      avatar: 'avatar-6',
      equippedFrame: 'frame-6',
      trophies: 5200,
      level: 52,
      wins: 490,
      winRate: 70,
    },
    {
      id: 'legend_6',
      name: 'Kapı Ustası Ayşe',
      avatar: 'avatar-1',
      equippedFrame: 'frame-5',
      trophies: 4100,
      level: 41,
      wins: 395,
      winRate: 68,
    },
    {
      id: 'legend_7',
      name: 'Şeşbeş Mehmet',
      avatar: 'avatar-5',
      equippedFrame: 'frame-4',
      trophies: 3050,
      level: 30,
      wins: 290,
      winRate: 64,
    },
    {
      id: 'legend_8',
      name: 'Tavla Kurdu Barış',
      avatar: 'avatar-8',
      equippedFrame: 'frame-3',
      trophies: 2150,
      level: 21,
      wins: 210,
      winRate: 61,
    },
    {
      id: 'legend_9',
      name: 'Çırak Emre',
      avatar: 'avatar-1',
      equippedFrame: 'frame-2',
      trophies: 1200,
      level: 12,
      wins: 115,
      winRate: 58,
    },
  ];

  res.json({ leaderboard: seedLeaderboard });
});

// WebSocket message dispatcher
wss.on('connection', (ws) => {
  const session: ClientSession = {
    ws,
    playerId: `player_${Math.random().toString(36).substring(2, 9)}`,
    playerName: 'Misafir',
    currentRoomId: null,
  };
  clients.set(ws, session);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'player:init': {
          session.playerId = msg.playerId || session.playerId;
          session.playerName = msg.playerName || session.playerName;
          session.playerAvatar = msg.avatar || session.playerAvatar;
          // Send initial rooms list
          broadcastRoomsList();
          break;
        }

        case 'matchmaking:join': {
          const { tierId, profile } = msg;
          if (!['beginner', 'casual', 'master', 'pro'].includes(tierId)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Geçersiz oda seviyesi' }));
            break;
          }

          // If already in a queue, remove from previous queue
          const prevTier = playerCurrentQueue.get(session.playerId);
          if (prevTier) {
            const q = matchmakingQueues.get(prevTier);
            if (q) {
              matchmakingQueues.set(prevTier, q.filter((p) => p.playerId !== session.playerId));
            }
            playerCurrentQueue.delete(session.playerId);
          }

          if (profile?.id) session.playerId = profile.id;
          if (profile?.name) session.playerName = profile.name;
          if (profile?.avatar) session.playerAvatar = profile.avatar;

          const queue = matchmakingQueues.get(tierId as RoomTierId)!;
          const queueEntry: QueuePlayer = {
            ws,
            playerId: session.playerId,
            playerName: session.playerName,
            playerAvatar: session.playerAvatar,
            playerCoins: profile?.coins,
            tierId: tierId as RoomTierId,
            joinedAt: Date.now(),
          };
          queue.push(queueEntry);
          playerCurrentQueue.set(session.playerId, tierId as RoomTierId);

          ws.send(
            JSON.stringify({
              type: 'matchmaking:queued',
              tierId,
              queueLength: queue.length,
              entryFee: ONLINE_ROOM_TIERS[tierId as RoomTierId].fee,
              prizePool: ONLINE_ROOM_TIERS[tierId as RoomTierId].prize,
            })
          );

          // Try to pair with an awaiting opponent
          tryMatchmakeTier(tierId as RoomTierId);
          break;
        }

        case 'matchmaking:cancel': {
          const currentTier = playerCurrentQueue.get(session.playerId);
          if (currentTier) {
            const q = matchmakingQueues.get(currentTier);
            if (q) {
              matchmakingQueues.set(currentTier, q.filter((p) => p.playerId !== session.playerId));
            }
            playerCurrentQueue.delete(session.playerId);
          }
          ws.send(JSON.stringify({ type: 'matchmaking:cancelled' }));
          break;
        }

        case 'friend_room:create': {
          const entryFee = Number(msg.entryFee);
          if (!FRIEND_ROOM_FEES.includes(entryFee)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Geçersiz oda giriş ücreti seçildi.' }));
            break;
          }

          if (msg.profile?.id) session.playerId = msg.profile.id;
          if (msg.profile?.name) session.playerName = msg.profile.name;
          if (msg.profile?.avatar) session.playerAvatar = msg.profile.avatar;

          // Remove from any matchmaking queues
          const currentTier = playerCurrentQueue.get(session.playerId);
          if (currentTier) {
            const q = matchmakingQueues.get(currentTier);
            if (q) {
              matchmakingQueues.set(currentTier, q.filter((p) => p.playerId !== session.playerId));
            }
            playerCurrentQueue.delete(session.playerId);
          }

          const inviteCode = generateUniqueInviteCode();
          const roomId = `friend_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const prizePool = entryFee * 2;

          const whitePlayer: RoomPlayer = {
            id: session.playerId,
            name: session.playerName,
            avatar: session.playerAvatar,
            color: 'white',
            connected: true,
            coins: msg.profile?.coins,
          };

          const targetScore: TargetScore = [1, 3, 5].includes(Number(msg.targetScore))
            ? (Number(msg.targetScore) as TargetScore)
            : 3;

          const newRoom: GameRoom = {
            id: roomId,
            name: `Arkadaş Maçı (${entryFee} Jeton)`,
            targetScore,
            creatorId: session.playerId,
            entryFee,
            prizePool,
            prizeClaimed: false,
            refunded: false,
            isFriendMatch: true,
            inviteCode,
            whitePlayer,
            blackPlayer: null,
            whiteScore: 0,
            blackScore: 0,
            board: getInitialBoard(),
            turn: 'white',
            dice: [],
            winnerInfo: null,
            status: 'waiting',
            lastActivity: Date.now(),
          };

          rooms.set(roomId, newRoom);
          inviteCodeToRoomId.set(inviteCode, roomId);
          session.currentRoomId = roomId;

          ws.send(
            JSON.stringify({
              type: 'friend_room:created',
              room: newRoom,
              inviteCode,
              roomId,
              entryFee,
              prizePool,
              targetScore,
              myColor: 'white',
            })
          );
          break;
        }

        case 'friend_room:join': {
          const rawCode = ((msg.inviteCode as string) || '').trim().toUpperCase();
          if (!rawCode) {
            ws.send(JSON.stringify({ type: 'error', message: 'Lütfen bir davet kodu girin.' }));
            break;
          }

          const roomId = inviteCodeToRoomId.get(rawCode);
          if (!roomId || !rooms.has(roomId)) {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'Geçersiz veya bulunamayan davet kodu. Lütfen kodu kontrol edin.',
              })
            );
            break;
          }

          const room = rooms.get(roomId)!;
          if (room.status !== 'waiting') {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'Bu oda artık katılım kabul etmiyor veya oyun başlamış.',
              })
            );
            break;
          }

          if (msg.profile?.id) session.playerId = msg.profile.id;
          if (msg.profile?.name) session.playerName = msg.profile.name;
          if (msg.profile?.avatar) session.playerAvatar = msg.profile.avatar;

          // Güvenlik Kuralı: Aynı oyuncu kendi oluşturduğu odaya katılamaz!
          if (room.creatorId === session.playerId) {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'Kendi oluşturduğunuz odaya rakip olarak katılamazsınız.',
              })
            );
            break;
          }

          // Güvenlik Kuralı: Oda zaten doluysa
          if (room.blackPlayer && room.blackPlayer.connected) {
            ws.send(JSON.stringify({ type: 'error', message: 'Bu oda 2 kişi ile dolmuştur.' }));
            break;
          }

          const blackPlayer: RoomPlayer = {
            id: session.playerId,
            name: session.playerName,
            avatar: session.playerAvatar,
            color: 'black',
            connected: true,
            coins: msg.profile?.coins,
          };

          const opening = rollOpeningDice();
          room.turn = opening.winner;
          room.openingRoll = opening;
          room.blackPlayer = blackPlayer;
          room.status = 'playing';
          session.currentRoomId = room.id;

          // Her iki oyuncuya da bildir
          broadcastToRoom(room.id, {
            type: 'friend_room:matched',
            roomId: room.id,
            room,
            creator: room.whitePlayer,
            opponent: blackPlayer,
            entryFee: room.entryFee,
            prizePool: room.prizePool,
          });

          // Katılan oyuncuya oda bilgisi gönder
          ws.send(
            JSON.stringify({
              type: 'room:joined',
              room,
              myColor: 'black',
            })
          );
          break;
        }

        case 'friend_room:cancel': {
          const { roomId } = msg;
          const room = rooms.get(roomId);
          if (room && room.creatorId === session.playerId && room.status === 'waiting') {
            if (room.inviteCode) {
              inviteCodeToRoomId.delete(room.inviteCode);
            }
            room.refunded = true;
            rooms.delete(roomId);
            if (session.currentRoomId === roomId) {
              session.currentRoomId = null;
            }
            ws.send(
              JSON.stringify({
                type: 'friend_room:cancelled',
                roomId,
                refundedFee: room.entryFee,
              })
            );
          }
          break;
        }

        case 'friend_room:set_target_score': {
          const { roomId, targetScore } = msg;
          const score = Number(targetScore);
          const rId = (roomId as string) || session.currentRoomId;
          if (rId && rooms.has(rId)) {
            const room = rooms.get(rId)!;
            if (room.creatorId === session.playerId && room.status === 'waiting' && [1, 3, 5].includes(score)) {
              room.targetScore = score as TargetScore;
              ws.send(
                JSON.stringify({
                  type: 'friend_room:target_score_updated',
                  roomId: rId,
                  targetScore: room.targetScore,
                })
              );
            }
          }
          break;
        }

        case 'rooms:get': {
          broadcastRoomsList();
          break;
        }

        case 'room:create': {
          const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const targetScore: TargetScore = [1, 3, 5].includes(msg.targetScore) ? msg.targetScore : 3;

          const creator: RoomPlayer = {
            id: session.playerId,
            name: session.playerName,
            avatar: session.playerAvatar,
            color: 'white',
            connected: true,
          };

          const newRoom: GameRoom = {
            id: roomId,
            name: msg.name?.trim() || `${session.playerName}'in Odası`,
            targetScore,
            creatorId: session.playerId,
            whitePlayer: creator,
            blackPlayer: null,
            whiteScore: 0,
            blackScore: 0,
            board: getInitialBoard(),
            turn: 'white',
            dice: [],
            winnerInfo: null,
            status: 'waiting',
            lastActivity: Date.now(),
          };

          rooms.set(roomId, newRoom);
          session.currentRoomId = roomId;

          ws.send(JSON.stringify({ type: 'room:joined', room: newRoom, myColor: 'white' }));
          broadcastRoomsList();
          break;
        }

        case 'lobby:leaving_for_board': {
          // Client is transitioning from matchmaking lobby/modal to game board.
          // Disassociate this socket so closing it will not trigger an erroneous room disconnect!
          session.currentRoomId = null;
          break;
        }

        case 'room:join': {
          const room = rooms.get(msg.roomId);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Oda bulunamadı' }));
            return;
          }

          const playerId = msg.playerId || session.playerId;
          const playerName = msg.playerName || session.playerName;
          session.playerId = playerId;
          session.playerName = playerName;
          if (msg.playerAvatar) session.playerAvatar = msg.playerAvatar;

          let playerColor: PlayerColor | null = null;

          const timeoutKey = `${room.id}_${playerId}`;
          if (disconnectTimeouts.has(timeoutKey)) {
            clearTimeout(disconnectTimeouts.get(timeoutKey)!);
            disconnectTimeouts.delete(timeoutKey);
            console.log(`[RECONNECT] Player ${playerId} successfully reconnected to room ${room.id}. Cancelled disconnect timeout.`);
          }

          if (room.whitePlayer && room.whitePlayer.id === playerId) {
            playerColor = 'white';
            room.whitePlayer.connected = true;
          } else if (room.blackPlayer && room.blackPlayer.id === playerId) {
            playerColor = 'black';
            room.blackPlayer.connected = true;
          } else if (!room.whitePlayer) {
            playerColor = 'white';
            room.whitePlayer = {
              id: playerId,
              name: playerName,
              avatar: session.playerAvatar,
              color: 'white',
              connected: true,
            };
          } else if (!room.blackPlayer) {
            playerColor = 'black';
            room.blackPlayer = {
              id: playerId,
              name: playerName,
              avatar: session.playerAvatar,
              color: 'black',
              connected: true,
            };
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Masa 2 kişi ile dolu' }));
            return;
          }

          session.currentRoomId = room.id;

          // If both players are seated and ready, set status playing
          if (room.whitePlayer && room.blackPlayer && room.status === 'waiting') {
            const opening = rollOpeningDice();
            room.turn = opening.winner;
            room.openingRoll = opening;
            room.dice = [];
            room.turnSnapshot = null;
            room.status = 'playing';
          }

          broadcastToRoom(room.id, {
            type: 'room:updated',
            room,
            systemMessage: `${playerName} masaya bağlandı.`,
          });
          ws.send(JSON.stringify({ type: 'room:joined', room, myColor: playerColor }));
          broadcastRoomsList();
          break;
        }

        case 'room:leave': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (room) {
            const timeoutKey = `${room.id}_${session.playerId}`;
            if (disconnectTimeouts.has(timeoutKey)) {
              clearTimeout(disconnectTimeouts.get(timeoutKey)!);
              disconnectTimeouts.delete(timeoutKey);
            }

            const isWhite = room.whitePlayer?.id === session.playerId;
            const isBlack = room.blackPlayer?.id === session.playerId;

            if (isWhite || isBlack) {
              // If game was already finished, notify both sides to return to main menu
              if (room.status === 'finished') {
                broadcastToRoom(room.id, {
                  type: 'room:closed_to_menu',
                  reason: 'opponent_left',
                  message: `${session.playerName} anamenüye döndü.`,
                });
              } else if (room.status === 'playing' && !room.winnerInfo) {
                // Active game abandon: forfeit immediately (-5 cups for leaver, +10 cups for opponent)
                const winnerColor: PlayerColor = isWhite ? 'black' : 'white';
                room.winnerInfo = {
                  winner: winnerColor,
                  winType: 'normal',
                  points: 1,
                };
                room.status = 'finished';
                broadcastToRoom(room.id, {
                  type: 'room:player_abandoned',
                  abandonedPlayerId: session.playerId,
                  abandonedPlayerName: session.playerName,
                  room,
                });
              }

              if (isWhite) room.whitePlayer = null;
              if (isBlack) room.blackPlayer = null;

              if (!room.whitePlayer && !room.blackPlayer) {
                rooms.delete(room.id);
              } else {
                broadcastToRoom(room.id, {
                  type: 'room:updated',
                  room,
                  systemMessage: `${session.playerName} masadan ayrıldı.`,
                });
              }
            }
          }
          session.currentRoomId = null;
          broadcastRoomsList();
          break;
        }

        case 'game:roll': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (!room || room.status !== 'playing' || room.winnerInfo) return;

          // Check if it's the sender's turn
          const isWhite = room.whitePlayer?.id === session.playerId;
          const isBlack = room.blackPlayer?.id === session.playerId;
          const myColor = isWhite ? 'white' : isBlack ? 'black' : null;

          if (myColor !== room.turn) return;
          if (room.dice.length > 0 && room.dice.some((d) => !d.used)) return;

          if (myColor === 'white') room.whiteTimeouts = 0;
          if (myColor === 'black') room.blackTimeouts = 0;

          // Roll authoritative dice
          const newDice = rollDice();
          room.dice = newDice;
          room.lastActivity = Date.now();

          // Store snapshot of initial turn state so player can Undo before finishing turn
          room.turnSnapshot = {
            board: cloneBoard(room.board),
            dice: newDice.map((d) => ({ ...d })),
            movesMade: [],
          };

          const hasMoves = hasAnyLegalMoves(room.board, room.turn, newDice);

          // Clear any active turn timeout
          const existingTurnTimer = turnTimeouts.get(room.id);
          if (existingTurnTimer) {
            clearTimeout(existingTurnTimer);
            turnTimeouts.delete(room.id);
          }

          if (hasMoves) {
            // 23s server safety timeout (20s client timer + 3s network buffer)
            const tTimer = setTimeout(() => {
              turnTimeouts.delete(room.id);
              const activeRoom = rooms.get(room.id);
              if (activeRoom && activeRoom.status === 'playing' && !activeRoom.winnerInfo) {
                if (activeRoom.dice.length > 0 && activeRoom.dice.some((d) => !d.used)) {
                  // Track consecutive timeouts for AFK detection
                  const activeColor = activeRoom.turn;
                  if (activeColor === 'white') {
                    activeRoom.whiteTimeouts = (activeRoom.whiteTimeouts || 0) + 1;
                  } else {
                    activeRoom.blackTimeouts = (activeRoom.blackTimeouts || 0) + 1;
                  }
                  const strikes = (activeColor === 'white' ? activeRoom.whiteTimeouts : activeRoom.blackTimeouts) ?? 0;

                  if (strikes >= 4) {
                    // 4th Timeout: HÜKMEN MAĞLUBİYET!
                    const winnerColor: PlayerColor = activeColor === 'white' ? 'black' : 'white';
                    activeRoom.winnerInfo = { winner: winnerColor, winType: 'normal', points: activeRoom.targetScore };
                    activeRoom.status = 'finished';
                    if (winnerColor === 'white') activeRoom.whiteScore = activeRoom.targetScore;
                    else activeRoom.blackScore = activeRoom.targetScore;

                    broadcastToRoom(activeRoom.id, {
                      type: 'game:forfeit_afk',
                      forfeitedColor: activeColor,
                      winnerColor,
                      room: activeRoom,
                      message: `${activeColor === 'white' ? activeRoom.whitePlayer?.name : activeRoom.blackPlayer?.name} üst üste 20 saniye içinde hamle yapmadığı için hükmen mağlup oldu.`,
                    });
                    return;
                  }

                  if (strikes === 3) {
                    broadcastToRoom(activeRoom.id, {
                      type: 'game:afk_warning',
                      playerColor: activeColor,
                      strikes: 3,
                      message: '3 kez süreniz doldu! Eğer bir sonraki turda da hamle yapmazsanız otomatik olarak hükmen mağlup sayılacaksınız.',
                    });
                  }

                  activeRoom.dice = [];
                  activeRoom.turnSnapshot = null;
                  activeRoom.turn = activeRoom.turn === 'white' ? 'black' : 'white';
                  broadcastToRoom(activeRoom.id, {
                    type: 'game:turn_passed',
                    room: activeRoom,
                    reason: 'Süre doldu (20 sn)',
                  });
                }
              }
            }, 23000);
            turnTimeouts.set(room.id, tTimer);
          }

          broadcastToRoom(room.id, {
            type: 'game:rolled',
            dice: newDice,
            hasMoves,
            room,
          });

          // Auto-pass if no legal moves
          if (!hasMoves) {
            const passTimer = setTimeout(() => {
              if (rooms.get(room.id) === room) {
                room.dice = [];
                room.turnSnapshot = null;
                room.turn = room.turn === 'white' ? 'black' : 'white';
                broadcastToRoom(room.id, {
                  type: 'game:turn_passed',
                  room,
                  reason: 'Hamle yok',
                });
              }
            }, 1200);
            passTimeouts.set(room.id, passTimer);
          }
          break;
        }

        case 'game:move': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (!room || room.status !== 'playing' || room.winnerInfo) return;

          const isWhite = room.whitePlayer?.id === session.playerId;
          const isBlack = room.blackPlayer?.id === session.playerId;
          const myColor = isWhite ? 'white' : isBlack ? 'black' : null;

          if (myColor !== room.turn) return;

          if (myColor === 'white') room.whiteTimeouts = 0;
          if (myColor === 'black') room.blackTimeouts = 0;

          const { from, to, dieValue, dieIndices, intermediates, isCombined } = msg;

          // Determine which dice are consumed by this move
          let targetIndices: number[] = [];
          if (Array.isArray(dieIndices) && dieIndices.length > 0) {
            targetIndices = dieIndices;
          } else if (typeof msg.dieIndex === 'number' && msg.dieIndex >= 0 && msg.dieIndex < room.dice.length) {
            targetIndices = [msg.dieIndex];
          } else {
            const singleIdx = room.dice.findIndex((d) => !d.used && d.value === dieValue);
            if (singleIdx !== -1) targetIndices = [singleIdx];
          }

          if (targetIndices.length === 0) return;
          const allDiceAvailable = targetIndices.every(
            (idx) => idx >= 0 && idx < room.dice.length && !room.dice[idx].used
          );
          if (!allDiceAvailable) return;

          // Apply move authoritatively
          let newBoard = room.board;
          let hit = false;
          if (isCombined && Array.isArray(intermediates) && intermediates.length > 0) {
            const res = applyCombinedMove(room.board, from, to, intermediates, room.turn);
            newBoard = res.newBoard;
            hit = res.hit;
          } else {
            const res = applyMove(room.board, from, to, room.turn);
            newBoard = res.newBoard;
            hit = res.hit;
          }

          room.board = newBoard;
          for (const idx of targetIndices) {
            room.dice[idx].used = true;
          }
          room.lastActivity = Date.now();

          // Check win
          const win = evaluateWin(room.board);
          if (win) {
            room.winnerInfo = win;
            if (win.winner === 'white') {
              room.whiteScore += win.points;
            } else {
              room.blackScore += win.points;
            }

            if (room.whiteScore >= room.targetScore || room.blackScore >= room.targetScore) {
              room.status = 'finished';
            }
          }

          // Check if turn should pass
          const hasRemainingMoves = hasAnyLegalMoves(room.board, room.turn, room.dice);
          const allDiceUsed = room.dice.every((d) => d.used);
          let turnWillPass = false;

          if (!win && (allDiceUsed || !hasRemainingMoves)) {
            turnWillPass = true;
          }

          broadcastToRoom(room.id, {
            type: 'game:moved',
            from,
            to,
            dieValue,
            hit,
            win,
            room,
          });

          if (turnWillPass) {
            const passTimer = setTimeout(() => {
              if (rooms.get(room.id) === room && !room.winnerInfo) {
                room.dice = [];
                room.turnSnapshot = null;
                room.turn = room.turn === 'white' ? 'black' : 'white';
                broadcastToRoom(room.id, {
                  type: 'game:turn_passed',
                  room,
                });
              }
            }, 4000);
            passTimeouts.set(room.id, passTimer);
          }
          break;
        }

        case 'game:pass': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (!room || room.status !== 'playing' || room.winnerInfo) return;

          const isWhite = room.whitePlayer?.id === session.playerId;
          const isBlack = room.blackPlayer?.id === session.playerId;
          const myColor = isWhite ? 'white' : isBlack ? 'black' : null;

          if (myColor !== room.turn) return;

          const isTimeout = !!msg.isTimeout;
          if (isTimeout) {
            if (myColor === 'white') {
              room.whiteTimeouts = (room.whiteTimeouts || 0) + 1;
            } else {
              room.blackTimeouts = (room.blackTimeouts || 0) + 1;
            }
            const strikes = (myColor === 'white' ? room.whiteTimeouts : room.blackTimeouts) ?? 0;

            if (strikes >= 4) {
              // 4th Timeout: HÜKMEN MAĞLUBİYET!
              const winnerColor: PlayerColor = myColor === 'white' ? 'black' : 'white';
              room.winnerInfo = { winner: winnerColor, winType: 'normal', points: room.targetScore };
              room.status = 'finished';
              if (winnerColor === 'white') room.whiteScore = room.targetScore;
              else room.blackScore = room.targetScore;

              broadcastToRoom(room.id, {
                type: 'game:forfeit_afk',
                forfeitedColor: myColor,
                winnerColor,
                room,
                message: `${myColor === 'white' ? room.whitePlayer?.name : room.blackPlayer?.name} üst üste 20 saniye içinde hamle yapmadığı için hükmen mağlup oldu.`,
              });
              return;
            }

            if (strikes === 3) {
              broadcastToRoom(room.id, {
                type: 'game:afk_warning',
                playerColor: myColor,
                strikes: 3,
                message: '3 kez süreniz doldu! Eğer bir sonraki turda da hamle yapmazsanız otomatik olarak hükmen mağlup sayılacaksınız.',
              });
            }
          } else {
            // Manual pass (user clicked TAMAM)
            if (myColor === 'white') room.whiteTimeouts = 0;
            if (myColor === 'black') room.blackTimeouts = 0;
          }

          // Clear any pending turn safety timeout and auto-pass
          const existingTurnTimer = turnTimeouts.get(room.id);
          if (existingTurnTimer) {
            clearTimeout(existingTurnTimer);
            turnTimeouts.delete(room.id);
          }

          const pendingPass = passTimeouts.get(room.id);
          if (pendingPass) {
            clearTimeout(pendingPass);
            passTimeouts.delete(room.id);
          }

          room.dice = [];
          room.turnSnapshot = null;
          room.turn = room.turn === 'white' ? 'black' : 'white';
          broadcastToRoom(room.id, {
            type: 'game:turn_passed',
            room,
          });
          break;
        }

        case 'game:undo': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (!room || room.status !== 'playing' || room.winnerInfo) return;

          const isWhite = room.whitePlayer?.id === session.playerId;
          const isBlack = room.blackPlayer?.id === session.playerId;
          const myColor = isWhite ? 'white' : isBlack ? 'black' : null;

          if (myColor !== room.turn) return;
          if (!room.turnSnapshot) return;

          // Cancel any pending turn pass timeout if player chose to Undo!
          const pendingPass = passTimeouts.get(room.id);
          if (pendingPass) {
            clearTimeout(pendingPass);
            passTimeouts.delete(room.id);
          }

          // Restore authoritative board & dice from snapshot
          room.board = cloneBoard(room.turnSnapshot.board);
          room.dice = room.turnSnapshot.dice.map((d) => ({ ...d }));
          room.lastActivity = Date.now();

          broadcastToRoom(room.id, {
            type: 'game:undo_applied',
            room,
          });
          break;
        }

        case 'game:rematch_request': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (!room) return;

          broadcastToRoom(room.id, {
            type: 'game:rematch_requested',
            requesterId: session.playerId,
            requesterName: session.playerName,
          });
          break;
        }

        case 'game:rematch_response': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (!room) return;

          const { accept } = msg;
          if (accept) {
            // Both agreed to rematch!
            const wasMatchFinished = room.whiteScore >= room.targetScore || room.blackScore >= room.targetScore;
            const previousWinner = room.winnerInfo?.winner;

            room.board = getInitialBoard();
            room.dice = [];
            room.turnSnapshot = null;
            room.winnerInfo = null;
            room.prizeClaimed = false;
            room.status = 'playing';

            if (wasMatchFinished) {
              // Brand new match: reset scores and roll opening dice
              room.whiteScore = 0;
              room.blackScore = 0;
              const opening = rollOpeningDice();
              room.turn = opening.winner;
              room.openingRoll = opening;
            } else if (room.targetScore > 1 && previousWinner) {
              // 1'den fazla puanlı oyunlarda (3 veya 5), her el sonunda başlangıç zarı atılmaz!
              // Önceki elde galip gelen oyuncu oyuna başlar.
              room.turn = previousWinner;
              room.openingRoll = null as any;
            } else {
              const opening = rollOpeningDice();
              room.turn = opening.winner;
              room.openingRoll = opening;
            }

            broadcastToRoom(room.id, {
              type: 'game:reset',
              room,
            });
          } else {
            // Rematch rejected: both players return to main menu
            broadcastToRoom(room.id, {
              type: 'room:closed_to_menu',
              reason: 'declined',
              message: `${session.playerName} yeni el teklifini kabul etmedi. Ana menüye dönülüyor...`,
            });
          }
          break;
        }

        case 'game:rematch': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (!room) return;

          const wasMatchFinished = room.whiteScore >= room.targetScore || room.blackScore >= room.targetScore;
          const previousWinner = room.winnerInfo?.winner;

          room.board = getInitialBoard();
          room.dice = [];
          room.turnSnapshot = null;
          room.winnerInfo = null;
          room.prizeClaimed = false;
          room.status = 'playing';

          if (wasMatchFinished) {
            room.whiteScore = 0;
            room.blackScore = 0;
            const opening = rollOpeningDice();
            room.turn = opening.winner;
            room.openingRoll = opening;
          } else if (room.targetScore > 1 && previousWinner) {
            // 1'den fazla puanlı oyunlarda (3 veya 5), her el sonunda başlangıç zarı atılmaz!
            // Önceki elde galip gelen oyuncu oyuna başlar.
            room.turn = previousWinner;
            room.openingRoll = null as any;
          } else {
            const opening = rollOpeningDice();
            room.turn = opening.winner;
            room.openingRoll = opening;
          }

          broadcastToRoom(room.id, {
            type: 'game:reset',
            room,
          });
          break;
        }
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });

  ws.on('close', () => {
    // Remove from any active matchmaking queue
    const queueTier = playerCurrentQueue.get(session.playerId);
    if (queueTier) {
      const q = matchmakingQueues.get(queueTier);
      if (q) {
        matchmakingQueues.set(
          queueTier,
          q.filter((p) => p.playerId !== session.playerId && p.ws !== ws)
        );
      }
      playerCurrentQueue.delete(session.playerId);
    }

    if (session.currentRoomId) {
      const room = rooms.get(session.currentRoomId);
      if (room) {
        // Critical Check: Does this player STILL have another active, open socket in this room?
        // (e.g. an old lobby socket closing after the board socket joined, or another tab)
        const hasOtherActiveSocket = Array.from(clients.values()).some(
          (c) =>
            c.ws !== ws &&
            c.playerId === session.playerId &&
            c.currentRoomId === session.currentRoomId &&
            c.ws.readyState === WebSocket.OPEN
        );

        if (hasOtherActiveSocket) {
          console.log(
            `[WS CLOSE] Stale/lobby socket closed for player ${session.playerId} in room ${session.currentRoomId}. Player is still actively connected via another socket.`
          );
          clients.delete(ws);
          broadcastRoomsList();
          return;
        }

        const isWhite = room.whitePlayer?.id === session.playerId;
        const isBlack = room.blackPlayer?.id === session.playerId;

        if (isWhite && room.whitePlayer) room.whitePlayer.connected = false;
        if (isBlack && room.blackPlayer) room.blackPlayer.connected = false;

        // If game in progress, DO NOT instantly forfeit! Provide a 25-second reconnection grace window
        if (room.status === 'playing' && !room.winnerInfo) {
          const timeoutKey = `${room.id}_${session.playerId}`;
          if (!disconnectTimeouts.has(timeoutKey)) {
            // Notify room that player disconnected temporarily
            broadcastToRoom(room.id, {
              type: 'room:player_disconnected',
              disconnectedPlayerId: session.playerId,
              disconnectedPlayerName: session.playerName,
              reconnectWindowSeconds: 25,
            });

            const timer = setTimeout(() => {
              disconnectTimeouts.delete(timeoutKey);
              const activeRoom = rooms.get(room.id);
              if (activeRoom && activeRoom.status === 'playing' && !activeRoom.winnerInfo) {
                // Authoritative check: Is the player STILL not connected on ANY socket in this room?
                const stillDisconnected = !isPlayerConnectedInRoom(activeRoom.id, session.playerId);

                if (stillDisconnected) {
                  const isStillWhite = activeRoom.whitePlayer?.id === session.playerId;
                  const winnerColor: PlayerColor = isStillWhite ? 'black' : 'white';
                  activeRoom.winnerInfo = { winner: winnerColor, winType: 'normal', points: 1 };
                  activeRoom.status = 'finished';

                  broadcastToRoom(activeRoom.id, {
                    type: 'room:player_abandoned',
                    abandonedPlayerId: session.playerId,
                    abandonedPlayerName: session.playerName,
                    room: activeRoom,
                  });
                  console.log(`[ABANDON] Player ${session.playerId} did not reconnect within 25s. Room ${activeRoom.id} forfeited.`);
                } else {
                  console.log(`[ABANDON CANCELLED] Player ${session.playerId} reconnected in room ${activeRoom.id}. Abandon cancelled.`);
                  if (activeRoom.whitePlayer?.id === session.playerId) activeRoom.whitePlayer.connected = true;
                  if (activeRoom.blackPlayer?.id === session.playerId) activeRoom.blackPlayer.connected = true;
                  broadcastToRoom(activeRoom.id, { type: 'room:updated', room: activeRoom });
                }
              }
            }, 25000);
            disconnectTimeouts.set(timeoutKey, timer);
          }
        } else if (room.status === 'finished') {
          // If room finished and a player disconnects, close room and return remaining player to menu
          broadcastToRoom(room.id, {
            type: 'room:closed_to_menu',
            reason: 'opponent_left',
            message: `${session.playerName} ayrıldı.`,
          });
        } else if (room.status === 'waiting' && isWhite && room.isFriendMatch) {
          if (room.inviteCode) {
            inviteCodeToRoomId.delete(room.inviteCode);
          }
          rooms.delete(room.id);
        }

        broadcastToRoom(room.id, { type: 'room:updated', room });
      }
    }
    clients.delete(ws);
    broadcastRoomsList();
  });
});

// Start dev or production server
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const port = parseInt(process.env.PORT || '3000', 10);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
