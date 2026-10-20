import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomPlayer, RoomState, ClientMessage, ServerMessage, Team } from './src/types/multiplayer';
import { Bullet, Direction, LootCrate, PlayerMatchStats } from './src/types/game';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

interface MatchTankData {
  x: number;
  y: number;
  direction: Direction;
  health: number;
  maxHealth: number;
  shield: number;
  hasSuperBullet?: boolean;
  superBulletTimer?: number;
  isParalyzed?: boolean;
  paralyzedTimer?: number;
  isAlive: boolean;
  team: Team;
  name: string;
  slot: number;
}

interface MatchState {
  pin: string;
  status: 'LOBBY' | 'PLAYING' | 'ENDED';
  winner: Team | null;
  winReason?: 'BASE_DESTROYED' | 'TIMEOUT';
  startTime: number;
  duration: number; // Thời gian hiệp đấu (180 giây = 3 phút)
  baseBlue: { health: number; isDestroyed: boolean };
  baseRed: { health: number; isDestroyed: boolean };
  tanks: { [id: string]: MatchTankData };
  bullets: Bullet[];
  destroyedBricks: { row: number; col: number }[];
  lootCrate: LootCrate | null;
  nextLootSpawnTime: number;
  lastUpdate: number;
  stats: { [id: string]: PlayerMatchStats };
  mvpPlayerId?: string;
}

// Lưu trữ các phòng chơi và trận đấu đang hoạt động
const rooms = new Map<string, RoomState>();
const matches = new Map<string, MatchState>();
// Map lưu client socket -> { pin: string, playerId: string }
const clientRoomMap = new Map<WebSocket, { pin: string; playerId: string }>();

function generatePin(): string {
  let pin = '';
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(pin));
  return pin;
}

function getSpawnPos(slot: number): { x: number; y: number; dir: Direction } {
  switch (slot) {
    case 1: return { x: 46, y: 46, dir: 'RIGHT' };
    case 2: return { x: 46, y: 446, dir: 'RIGHT' };
    case 3: return { x: 566, y: 46, dir: 'LEFT' };
    case 4: return { x: 566, y: 446, dir: 'LEFT' };
    default: return { x: 46, y: 46, dir: 'RIGHT' };
  }
}

// Các vị trí thông thoáng giữa bản đồ để thả Hòm Tiếp Tế An Ninh Mạng
const LOOT_SPAWN_SPOTS = [
  { x: 7 * 40, y: 2 * 40 },
  { x: 8 * 40, y: 2 * 40 },
  { x: 7 * 40, y: 10 * 40 },
  { x: 8 * 40, y: 10 * 40 },
  { x: 4 * 40, y: 3 * 40 },
  { x: 11 * 40, y: 3 * 40 },
  { x: 4 * 40, y: 9 * 40 },
  { x: 11 * 40, y: 9 * 40 },
  { x: 7 * 40, y: 6 * 40 },
  { x: 8 * 40, y: 6 * 40 },
];

function createRandomLootCrate(): LootCrate {
  const spot = LOOT_SPAWN_SPOTS[Math.floor(Math.random() * LOOT_SPAWN_SPOTS.length)];
  const qIndex = Math.floor(Math.random() * 8) + 1;
  return {
    id: `crate-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    x: spot.x,
    y: spot.y,
    questionId: `q${qIndex}`,
    spawnTime: Date.now(),
  };
}

// Tính toán điểm số tổng hợp và xác định MVP xuất sắc nhất (Mốc 5)
function calculateScores(match: MatchState): { stats: { [id: string]: PlayerMatchStats }; mvpId: string } {
  let maxScore = -1;
  let mvpId = '';

  Object.values(match.stats).forEach((s) => {
    s.totalScore = s.cyberCorrect * 150 + s.damageDealt + s.bricksDestroyed * 10 + s.kills * 100;
    if (s.totalScore > maxScore) {
      maxScore = s.totalScore;
      mvpId = s.playerId;
    }
  });

  if (mvpId && match.stats[mvpId]) {
    match.stats[mvpId].isMvp = true;
  }
  match.mvpPlayerId = mvpId;
  return { stats: match.stats, mvpId };
}

function initMatch(pin: string, room: RoomState): MatchState {
  const tanks: { [id: string]: MatchTankData } = {};
  const stats: { [id: string]: PlayerMatchStats } = {};

  room.players.forEach((p) => {
    const spawn = getSpawnPos(p.slot);
    tanks[p.id] = {
      x: spawn.x,
      y: spawn.y,
      direction: spawn.dir,
      health: 100,
      maxHealth: 100,
      shield: 0,
      hasSuperBullet: false,
      isParalyzed: false,
      isAlive: true,
      team: p.team,
      name: p.name,
      slot: p.slot,
    };

    stats[p.id] = {
      playerId: p.id,
      name: p.name,
      team: p.team,
      damageDealt: 0,
      bricksDestroyed: 0,
      cyberCorrect: 0,
      cyberAttempts: 0,
      kills: 0,
      totalScore: 0,
      isMvp: false,
    };
  });

  const firstCrate = createRandomLootCrate();

  const match: MatchState = {
    pin,
    status: 'PLAYING',
    winner: null,
    winReason: undefined,
    startTime: Date.now(),
    duration: 180, // 3 phút
    baseBlue: { health: 100, isDestroyed: false },
    baseRed: { health: 100, isDestroyed: false },
    tanks,
    bullets: [],
    destroyedBricks: [],
    lootCrate: firstCrate,
    nextLootSpawnTime: Date.now() + 15000,
    lastUpdate: Date.now(),
    stats,
  };

  matches.set(pin, match);
  return match;
}

function sendToClient(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastToRoom(pin: string, message: ServerMessage) {
  for (const [ws, info] of clientRoomMap.entries()) {
    if (info.pin === pin && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}

// Kiểm tra hết giờ trận đấu (Mốc 5)
function checkMatchTimeout(match: MatchState, pin: string) {
  if (match.status !== 'PLAYING') return;
  const elapsed = Math.floor((Date.now() - match.startTime) / 1000);
  const timeLeft = Math.max(0, match.duration - elapsed);

  if (timeLeft <= 0) {
    // Hết giờ thi đấu: Quyết định đội thắng theo máu Server căn cứ
    let winner: Team = 'BLUE';
    if (match.baseBlue.health > match.baseRed.health) {
      winner = 'BLUE';
    } else if (match.baseRed.health > match.baseBlue.health) {
      winner = 'RED';
    } else {
      // Nếu máu căn cứ bằng nhau, tính tổng điểm an ninh mạng của 2 đội
      let blueTotal = 0;
      let redTotal = 0;
      Object.values(match.stats).forEach((s) => {
        if (s.team === 'BLUE') blueTotal += s.cyberCorrect * 100 + s.damageDealt;
        else redTotal += s.cyberCorrect * 100 + s.damageDealt;
      });
      winner = blueTotal >= redTotal ? 'BLUE' : 'RED';
    }

    match.status = 'ENDED';
    match.winner = winner;
    match.winReason = 'TIMEOUT';
    const room = rooms.get(pin);
    if (room) room.status = 'ENDED';

    const { stats, mvpId } = calculateScores(match);
    broadcastToRoom(pin, {
      type: 'GAME_OVER',
      winnerTeam: winner,
      reason: 'TIMEOUT',
      stats,
      mvpPlayerId: mvpId,
    });
  }
}

// Vòng lặp kiểm tra thời gian trận đấu và sinh hòm tiếp tế mỗi 1 giây
setInterval(() => {
  for (const [pin, match] of matches.entries()) {
    if (match.status === 'PLAYING') {
      checkMatchTimeout(match, pin);

      // Tự động sinh Hòm Tiếp Tế ngẫu nhiên định kỳ
      if (!match.lootCrate && Date.now() > match.nextLootSpawnTime) {
        match.lootCrate = createRandomLootCrate();
        broadcastToRoom(pin, { type: 'LOOT_SPAWNED', crate: match.lootCrate });
      }
    }
  }
}, 1000);

// Xử lý WebSocket
wss.on('connection', (ws: WebSocket) => {
  sendToClient(ws, { type: 'PONG' });

  ws.on('message', (data: string) => {
    try {
      const msg: any = JSON.parse(data.toString());

      if (msg.type === 'PING') {
        sendToClient(ws, { type: 'PONG' });
      } else if (msg.type === 'IDENTIFY') {
        clientRoomMap.set(ws, { pin: msg.pin, playerId: msg.playerId });
        const room = rooms.get(msg.pin);
        if (room) {
          const player = room.players.find((p) => p.id === msg.playerId);
          if (player) {
            player.lastActive = Date.now();
          }
          sendToClient(ws, { type: 'ROOM_UPDATE', room });
        }
      } else if (msg.type === 'CREATE_ROOM') {
        const pin = generatePin();
        const playerId = msg.playerId || `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const hostPlayer: RoomPlayer = {
          id: playerId,
          name: msg.playerName || 'Chiến Binh 1',
          team: 'BLUE',
          slot: 1,
          isHost: true,
          ready: true,
          lastActive: Date.now(),
        };

        const room: RoomState = {
          pin,
          hostId: playerId,
          status: 'LOBBY',
          players: [hostPlayer],
          maxPlayers: 4,
        };

        rooms.set(pin, room);
        clientRoomMap.set(ws, { pin, playerId });
        sendToClient(ws, { type: 'ROOM_CREATED', room, playerId });
      } else if (msg.type === 'JOIN_ROOM') {
        const pin = (msg.pin || '').trim();
        const room = rooms.get(pin);

        if (!room) {
          sendToClient(ws, { type: 'ERROR', message: `Không tìm thấy phòng #${pin}!` });
          return;
        }

        const existingPlayerId = msg.playerId;
        const existingPlayer = existingPlayerId ? room.players.find((p) => p.id === existingPlayerId) : null;

        if (existingPlayer) {
          if (msg.playerName && msg.playerName.trim()) {
            existingPlayer.name = msg.playerName.trim();
          }
          existingPlayer.lastActive = Date.now();
          clientRoomMap.set(ws, { pin, playerId: existingPlayer.id });
          sendToClient(ws, { type: 'ROOM_JOINED', room, playerId: existingPlayer.id });
          broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
          return;
        }

        if (room.players.length >= room.maxPlayers) {
          sendToClient(ws, { type: 'ERROR', message: `Phòng #${pin} đã đầy (tối đa 4 người)!` });
          return;
        }

        const newPlayerId = existingPlayerId || `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const blueCount = room.players.filter((p) => p.team === 'BLUE').length;
        const redCount = room.players.filter((p) => p.team === 'RED').length;
        const assignedTeam: Team = blueCount <= redCount ? 'BLUE' : 'RED';

        const usedSlots = new Set(room.players.map((p) => p.slot));
        let slot = 1;
        if (assignedTeam === 'BLUE') {
          slot = !usedSlots.has(1) ? 1 : 2;
        } else {
          slot = !usedSlots.has(3) ? 3 : 4;
        }

        const newPlayer: RoomPlayer = {
          id: newPlayerId,
          name: msg.playerName || `Chiến Binh ${room.players.length + 1}`,
          team: assignedTeam,
          slot,
          isHost: false,
          ready: false,
          lastActive: Date.now(),
        };

        room.players.push(newPlayer);
        clientRoomMap.set(ws, { pin, playerId: newPlayerId });

        sendToClient(ws, { type: 'ROOM_JOINED', room, playerId: newPlayerId });
        broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
      } else if (msg.type === 'SWITCH_TEAM') {
        const info = clientRoomMap.get(ws);
        if (info) {
          const room = rooms.get(info.pin);
          if (room) {
            const player = room.players.find((p) => p.id === info.playerId);
            if (player && player.team !== msg.team) {
              const teamMembers = room.players.filter((p) => p.team === msg.team);
              if (teamMembers.length >= 2) {
                sendToClient(ws, { type: 'ERROR', message: `Phe ${msg.team === 'BLUE' ? 'Xanh' : 'Đỏ'} đã đủ 2 người!` });
                return;
              }
              player.team = msg.team;
              const usedSlots = new Set(room.players.filter((p) => p.id !== player.id).map((p) => p.slot));
              if (msg.team === 'BLUE') {
                player.slot = !usedSlots.has(1) ? 1 : 2;
              } else {
                player.slot = !usedSlots.has(3) ? 3 : 4;
              }
              broadcastToRoom(info.pin, { type: 'ROOM_UPDATE', room });
            }
          }
        }
      } else if (msg.type === 'TOGGLE_READY') {
        const info = clientRoomMap.get(ws);
        if (info) {
          const room = rooms.get(info.pin);
          if (room) {
            const player = room.players.find((p) => p.id === info.playerId);
            if (player) {
              player.ready = !player.ready;
              player.lastActive = Date.now();
              broadcastToRoom(info.pin, { type: 'ROOM_UPDATE', room });
            }
          }
        }
      } else if (msg.type === 'START_GAME') {
        const info = clientRoomMap.get(ws);
        if (!info) return;
        const room = rooms.get(info.pin);
        if (!room) return;

        if (room.hostId !== info.playerId) {
          sendToClient(ws, { type: 'ERROR', message: 'Chỉ có Chủ phòng (Host) mới có quyền bấm Bắt đầu!' });
          return;
        }

        const otherPlayers = room.players.filter((p) => !p.isHost);
        if (otherPlayers.length > 0 && !otherPlayers.every((p) => p.ready)) {
          sendToClient(ws, { type: 'ERROR', message: 'Vui lòng chờ tất cả người chơi bấm Sẵn sàng trước khi bắt đầu!' });
          return;
        }

        room.status = 'PLAYING';
        const match = initMatch(info.pin, room);
        broadcastToRoom(info.pin, { type: 'GAME_STARTED', room });
        if (match.lootCrate) {
          broadcastToRoom(info.pin, { type: 'LOOT_SPAWNED', crate: match.lootCrate });
        }
      } else if (msg.type === 'PLAYER_MOVE') {
        const info = clientRoomMap.get(ws);
        if (info) {
          const match = matches.get(info.pin);
          if (match && match.tanks[msg.playerId]) {
            match.tanks[msg.playerId].x = msg.x;
            match.tanks[msg.playerId].y = msg.y;
            match.tanks[msg.playerId].direction = msg.direction;
          }
          broadcastToRoom(info.pin, {
            type: 'PLAYER_MOVED',
            playerId: msg.playerId,
            x: msg.x,
            y: msg.y,
            direction: msg.direction,
          });
        }
      } else if (msg.type === 'PLAYER_SHOOT') {
        const info = clientRoomMap.get(ws);
        if (info) {
          const match = matches.get(info.pin);
          if (match) {
            match.bullets.push(msg.bullet);
            if (match.bullets.length > 30) match.bullets.shift();
          }
          broadcastToRoom(info.pin, {
            type: 'BULLET_FIRED',
            bullet: msg.bullet,
          });
        }
      } else if (msg.type === 'HIT_TANK') {
        const info = clientRoomMap.get(ws);
        if (info) {
          const match = matches.get(info.pin);
          const remainingHp = Math.max(0, 100 - msg.damage);
          if (match) {
            if (match.tanks[msg.targetId]) {
              match.tanks[msg.targetId].health = remainingHp;
              match.tanks[msg.targetId].isAlive = remainingHp > 0;
            }
            if (msg.attackerId && match.stats[msg.attackerId]) {
              match.stats[msg.attackerId].damageDealt += msg.damage;
              if (remainingHp <= 0) {
                match.stats[msg.attackerId].kills += 1;
              }
            }
          }
          broadcastToRoom(info.pin, {
            type: 'TANK_DAMAGED',
            targetId: msg.targetId,
            health: remainingHp,
            isAlive: remainingHp > 0,
            attackerId: msg.attackerId,
          });
        }
      } else if (msg.type === 'HIT_BASE') {
        const info = clientRoomMap.get(ws);
        if (info) {
          const remainingHp = Math.max(0, 100 - msg.damage);
          const isDestroyed = remainingHp <= 0;
          const match = matches.get(info.pin);
          if (match) {
            if (msg.team === 'BLUE') {
              match.baseBlue.health = remainingHp;
              match.baseBlue.isDestroyed = isDestroyed;
            } else {
              match.baseRed.health = remainingHp;
              match.baseRed.isDestroyed = isDestroyed;
            }
            if (msg.attackerId && match.stats[msg.attackerId]) {
              match.stats[msg.attackerId].damageDealt += msg.damage;
            }
          }

          broadcastToRoom(info.pin, {
            type: 'BASE_DAMAGED',
            team: msg.team,
            health: remainingHp,
            isDestroyed,
          });

          if (isDestroyed && match && match.status === 'PLAYING') {
            const winner = msg.team === 'BLUE' ? 'RED' : 'BLUE';
            match.winner = winner;
            match.winReason = 'BASE_DESTROYED';
            match.status = 'ENDED';
            const room = rooms.get(info.pin);
            if (room) room.status = 'ENDED';

            const { stats, mvpId } = calculateScores(match);
            broadcastToRoom(info.pin, {
              type: 'GAME_OVER',
              winnerTeam: winner,
              reason: 'BASE_DESTROYED',
              stats,
              mvpPlayerId: mvpId,
            });
          }
        }
      } else if (msg.type === 'HIT_BRICK') {
        const info = clientRoomMap.get(ws);
        if (info) {
          const match = matches.get(info.pin);
          if (match) {
            match.destroyedBricks.push({ row: msg.row, col: msg.col });
            if (msg.playerId && match.stats[msg.playerId]) {
              match.stats[msg.playerId].bricksDestroyed += 1;
            }
          }
          broadcastToRoom(info.pin, {
            type: 'BRICK_DESTROYED',
            row: msg.row,
            col: msg.col,
          });
        }
      } else if (msg.type === 'LOOT_COLLECTED') {
        const info = clientRoomMap.get(ws);
        if (info) {
          const match = matches.get(info.pin);
          if (match) {
            match.lootCrate = null;
            match.nextLootSpawnTime = Date.now() + 20000;
          }
          broadcastToRoom(info.pin, {
            type: 'LOOT_REMOVED',
            crateId: msg.crateId,
            collectorId: msg.playerId,
          });
        }
      } else if (msg.type === 'APPLY_BUFF') {
        const info = clientRoomMap.get(ws);
        if (info) {
          const match = matches.get(info.pin);
          if (match && match.stats[msg.playerId]) {
            match.stats[msg.playerId].cyberAttempts += 1;
            if (!msg.isMalware) {
              match.stats[msg.playerId].cyberCorrect += 1;
            }
          }
          broadcastToRoom(info.pin, {
            type: 'BUFF_APPLIED',
            playerId: msg.playerId,
            rewardType: msg.rewardType,
            isMalware: msg.isMalware,
          });
        }
      } else if (msg.type === 'RESTART_GAME') {
        const info = clientRoomMap.get(ws);
        if (info) {
          const room = rooms.get(info.pin);
          if (room) {
            room.status = 'LOBBY';
            room.players.forEach((p) => {
              if (!p.isHost) {
                p.ready = false;
              }
            });
            matches.delete(info.pin);
            broadcastToRoom(info.pin, { type: 'ROOM_UPDATE', room });
          }
        }
      }
    } catch (e) {
      // bỏ qua lỗi parse json
    }
  });

  ws.on('close', () => {
    const info = clientRoomMap.get(ws);
    if (info) {
      const room = rooms.get(info.pin);
      if (room) {
        room.players = room.players.filter((p) => p.id !== info.playerId);
        if (room.players.length === 0) {
          rooms.delete(info.pin);
          matches.delete(info.pin);
        } else {
          if (room.hostId === info.playerId) {
            room.hostId = room.players[0].id;
            room.players[0].isHost = true;
            room.players[0].ready = true;
          }
          broadcastToRoom(info.pin, { type: 'ROOM_UPDATE', room });
        }
      }
      clientRoomMap.delete(ws);
    }
  });
});

// REST Fallback API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    activeMatches: matches.size,
    timestamp: Date.now(),
  });
});

app.post(['/api/rooms', '/api/rooms/create'], (req, res) => {
  const { playerName, playerId } = req.body;
  const pin = generatePin();
  const effectiveId = playerId || `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const hostPlayer: RoomPlayer = {
    id: effectiveId,
    name: (playerName && playerName.trim()) || 'Chiến Binh 1',
    team: 'BLUE',
    slot: 1,
    isHost: true,
    ready: true,
    lastActive: Date.now(),
  };

  const room: RoomState = {
    pin,
    hostId: effectiveId,
    status: 'LOBBY',
    players: [hostPlayer],
    maxPlayers: 4,
  };

  rooms.set(pin, room);
  res.json({
    room,
    playerId: effectiveId,
    pin: room.pin,
    players: room.players,
    hostId: room.hostId,
    status: room.status,
    maxPlayers: room.maxPlayers,
  });
});

app.get('/api/rooms/:pin', (req, res) => {
  const pin = req.params.pin.trim();
  const room = rooms.get(pin);
  if (!room) {
    return res.status(404).json({ error: 'Không tìm thấy phòng!' });
  }
  res.json({
    room,
    pin: room.pin,
    players: room.players,
    hostId: room.hostId,
    status: room.status,
    maxPlayers: room.maxPlayers,
  });
});

app.post('/api/rooms/:pin/join', (req, res) => {
  const pin = req.params.pin.trim();
  const { playerName, playerId } = req.body;
  const room = rooms.get(pin);

  if (!room) {
    return res.status(404).json({ error: 'Không tìm thấy phòng!' });
  }

  const existingPlayerId = playerId;
  const existingPlayer = existingPlayerId ? room.players.find((p) => p.id === existingPlayerId) : null;

  if (existingPlayer) {
    if (playerName && playerName.trim()) {
      existingPlayer.name = playerName.trim();
    }
    existingPlayer.lastActive = Date.now();
    broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
    return res.json({ room, playerId: existingPlayer.id });
  }

  if (room.players.length >= room.maxPlayers) {
    return res.status(400).json({ error: 'Phòng đã đầy (tối đa 4 người)!' });
  }

  const effectiveId = existingPlayerId || `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const blueCount = room.players.filter((p) => p.team === 'BLUE').length;
  const redCount = room.players.filter((p) => p.team === 'RED').length;
  const assignedTeam: Team = blueCount <= redCount ? 'BLUE' : 'RED';

  const usedSlots = new Set(room.players.map((p) => p.slot));
  let slot = 1;
  if (assignedTeam === 'BLUE') {
    slot = !usedSlots.has(1) ? 1 : 2;
  } else {
    slot = !usedSlots.has(3) ? 3 : 4;
  }

  const newPlayer: RoomPlayer = {
    id: effectiveId,
    name: playerName || `Chiến Binh ${room.players.length + 1}`,
    team: assignedTeam,
    slot,
    isHost: false,
    ready: false,
    lastActive: Date.now(),
  };

  room.players.push(newPlayer);
  broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
  res.json({ room, playerId: effectiveId });
});

app.post('/api/rooms/:pin/switch-team', (req, res) => {
  const pin = req.params.pin.trim();
  const { playerId, team } = req.body;
  const room = rooms.get(pin);

  if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng!' });
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return res.status(404).json({ error: 'Không tìm thấy người chơi!' });

  const teamMembers = room.players.filter((p) => p.team === team);
  if (teamMembers.length >= 2) {
    return res.status(400).json({ error: `Phe ${team === 'BLUE' ? 'Xanh' : 'Đỏ'} đã đủ 2 người!` });
  }

  player.team = team;
  const usedSlots = new Set(room.players.filter((p) => p.id !== player.id).map((p) => p.slot));
  if (team === 'BLUE') {
    player.slot = !usedSlots.has(1) ? 1 : 2;
  } else {
    player.slot = !usedSlots.has(3) ? 3 : 4;
  }

  broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
  res.json({ room });
});

app.post('/api/rooms/:pin/ready', (req, res) => {
  const pin = req.params.pin.trim();
  const { playerId } = req.body;
  const room = rooms.get(pin);

  if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng!' });
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return res.status(404).json({ error: 'Không tìm thấy người chơi!' });

  player.ready = !player.ready;
  player.lastActive = Date.now();
  broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
  res.json({ room });
});

app.post('/api/rooms/:pin/start', (req, res) => {
  const pin = req.params.pin.trim();
  const { playerId } = req.body;
  const room = rooms.get(pin);

  if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng!' });
  if (room.hostId !== playerId) {
    return res.status(403).json({ error: 'Chỉ có Chủ phòng mới có quyền bấm Bắt đầu!' });
  }

  const otherPlayers = room.players.filter((p) => !p.isHost);
  if (otherPlayers.length > 0 && !otherPlayers.every((p) => p.ready)) {
    return res.status(400).json({ error: 'Vui lòng chờ tất cả người chơi bấm Sẵn sàng trước khi bắt đầu!' });
  }

  room.status = 'PLAYING';
  let match = matches.get(pin);
  if (!match) {
    match = initMatch(pin, room);
    broadcastToRoom(pin, { type: 'GAME_STARTED', room });
    if (match.lootCrate) {
      broadcastToRoom(pin, { type: 'LOOT_SPAWNED', crate: match.lootCrate });
    }
  }

  broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
  res.json({ room });
});

app.post('/api/rooms/:pin/rematch', (req, res) => {
  const pin = req.params.pin.trim();
  const room = rooms.get(pin);

  if (!room) {
    return res.status(404).json({ error: 'Không tìm thấy phòng!' });
  }

  room.status = 'LOBBY';
  room.players.forEach((p) => {
    if (!p.isHost) {
      p.ready = false;
    }
  });
  matches.delete(pin);

  broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
  res.json({
    room,
    pin: room.pin,
    players: room.players,
    hostId: room.hostId,
    status: room.status,
  });
});

// Xử lý các thao tác sảnh qua REST API (SWITCH_TEAM, TOGGLE_READY, START_GAME, LEAVE_ROOM)
app.post('/api/rooms/:pin/action', (req, res) => {
  const pin = req.params.pin.trim();
  const { action, playerId, team } = req.body;
  const room = rooms.get(pin);

  if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng!' });

  if (action === 'SWITCH_TEAM' && team) {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return res.status(404).json({ error: 'Không tìm thấy người chơi!' });
    const teamMembers = room.players.filter((p) => p.team === team && p.id !== playerId);
    if (teamMembers.length >= 2) return res.status(400).json({ error: 'Phe này đã đủ người!' });
    player.team = team;
    player.lastActive = Date.now();
    broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
    return res.json({ room, pin: room.pin, players: room.players });
  }

  if (action === 'TOGGLE_READY') {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return res.status(404).json({ error: 'Không tìm thấy người chơi!' });
    player.ready = !player.ready;
    player.lastActive = Date.now();
    broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
    return res.json({ room, pin: room.pin, players: room.players });
  }

  if (action === 'START_GAME') {
    if (room.hostId !== playerId) return res.status(403).json({ error: 'Chỉ có Chủ phòng mới có quyền bắt đầu!' });
    room.status = 'PLAYING';
    let match = matches.get(pin);
    if (!match) {
      match = initMatch(pin, room);
      broadcastToRoom(pin, { type: 'GAME_STARTED', room });
    }
    broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
    return res.json({ room, pin: room.pin, players: room.players });
  }

  if (action === 'LEAVE_ROOM') {
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.players.length === 0) {
      rooms.delete(pin);
      matches.delete(pin);
      return res.json({ message: 'Phòng đã giải tán' });
    }
    if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
      room.players[0].ready = true;
    }
    broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
    return res.json({ room, pin: room.pin, players: room.players });
  }

  res.json({ room, pin: room.pin, players: room.players });
});

app.post('/api/rooms/:pin/leave', (req, res) => {
  const pin = req.params.pin.trim();
  const { playerId } = req.body;
  const room = rooms.get(pin);
  if (!room) return res.json({ success: true });

  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.players.length === 0) {
    rooms.delete(pin);
    matches.delete(pin);
    return res.json({ success: true });
  }
  if (room.hostId === playerId && room.players.length > 0) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
    room.players[0].ready = true;
  }
  broadcastToRoom(pin, { type: 'ROOM_UPDATE', room });
  res.json({ success: true, room });
});

// Đồng bộ trận đấu thời gian thực qua REST
app.post('/api/match/:pin/sync', (req, res) => {
  const pin = req.params.pin.trim();
  const {
    playerId,
    x,
    y,
    direction,
    newBullet,
    baseDamage,
    tankDamage,
    destroyedBrick,
    lootCollected,
    appliedBuff,
  } = req.body;
  const room = rooms.get(pin);
  let match = matches.get(pin);

  if (!match && room && room.status === 'PLAYING') {
    match = initMatch(pin, room);
  }

  if (match) {
    checkMatchTimeout(match, pin);

    // Tự động sinh Hòm Tiếp Tế mới sau mỗi 20s
    if (!match.lootCrate && Date.now() > match.nextLootSpawnTime) {
      match.lootCrate = createRandomLootCrate();
      broadcastToRoom(pin, { type: 'LOOT_SPAWNED', crate: match.lootCrate });
    }

    if (playerId && match.tanks[playerId]) {
      match.tanks[playerId].x = x;
      match.tanks[playerId].y = y;
      match.tanks[playerId].direction = direction;
    }

    if (newBullet) {
      match.bullets.push(newBullet);
      if (match.bullets.length > 30) match.bullets.shift();
      broadcastToRoom(pin, { type: 'BULLET_FIRED', bullet: newBullet });
    }

    if (baseDamage) {
      const remainingHp = Math.max(0, 100 - baseDamage.damage);
      const isDestroyed = remainingHp <= 0;
      if (baseDamage.team === 'BLUE') {
        match.baseBlue.health = remainingHp;
        match.baseBlue.isDestroyed = isDestroyed;
      } else {
        match.baseRed.health = remainingHp;
        match.baseRed.isDestroyed = isDestroyed;
      }

      if (playerId && match.stats[playerId]) {
        match.stats[playerId].damageDealt += baseDamage.damage;
      }

      broadcastToRoom(pin, {
        type: 'BASE_DAMAGED',
        team: baseDamage.team,
        health: remainingHp,
        isDestroyed,
      });

      if (isDestroyed && match.status === 'PLAYING') {
        const winner = baseDamage.team === 'BLUE' ? 'RED' : 'BLUE';
        match.winner = winner;
        match.winReason = 'BASE_DESTROYED';
        match.status = 'ENDED';
        if (room) room.status = 'ENDED';

        const { stats, mvpId } = calculateScores(match);
        broadcastToRoom(pin, {
          type: 'GAME_OVER',
          winnerTeam: winner,
          reason: 'BASE_DESTROYED',
          stats,
          mvpPlayerId: mvpId,
        });
      }
    }

    if (tankDamage && match.tanks[tankDamage.targetId]) {
      const remainingHp = Math.max(0, 100 - tankDamage.damage);
      match.tanks[tankDamage.targetId].health = remainingHp;
      match.tanks[tankDamage.targetId].isAlive = remainingHp > 0;

      if (tankDamage.attackerId && match.stats[tankDamage.attackerId]) {
        match.stats[tankDamage.attackerId].damageDealt += tankDamage.damage;
        if (remainingHp <= 0) {
          match.stats[tankDamage.attackerId].kills += 1;
        }
      }

      broadcastToRoom(pin, {
        type: 'TANK_DAMAGED',
        targetId: tankDamage.targetId,
        health: remainingHp,
        isAlive: remainingHp > 0,
        attackerId: tankDamage.attackerId,
      });
    }

    if (destroyedBrick) {
      match.destroyedBricks.push(destroyedBrick);
      if (playerId && match.stats[playerId]) {
        match.stats[playerId].bricksDestroyed += 1;
      }
      broadcastToRoom(pin, {
        type: 'BRICK_DESTROYED',
        row: destroyedBrick.row,
        col: destroyedBrick.col,
      });
    }

    if (lootCollected && match.lootCrate) {
      match.lootCrate = null;
      match.nextLootSpawnTime = Date.now() + 20000;
      broadcastToRoom(pin, {
        type: 'LOOT_REMOVED',
        crateId: lootCollected,
        collectorId: playerId,
      });
    }

    if (appliedBuff && playerId && match.stats[playerId]) {
      match.stats[playerId].cyberAttempts += 1;
      if (!appliedBuff.isMalware) {
        match.stats[playerId].cyberCorrect += 1;
      }
    }

    const elapsed = Math.floor((Date.now() - match.startTime) / 1000);
    const timeLeft = Math.max(0, match.duration - elapsed);

    return res.json({
      status: match.status,
      winner: match.winner,
      winReason: match.winReason,
      timeLeft,
      stats: match.stats,
      mvpPlayerId: match.mvpPlayerId,
      baseBlue: match.baseBlue,
      baseRed: match.baseRed,
      tanks: match.tanks,
      lootCrate: match.lootCrate,
      destroyedBricks: match.destroyedBricks,
      recentBullets: match.bullets.slice(-8),
    });
  }

  res.json({ status: room?.status || 'LOBBY' });
});

// Phục vụ frontend (Vite middlewares cho Dev và dist tĩnh cho Production)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server đang chạy tại http://0.0.0.0:${PORT}`);
  });
}

startServer();
