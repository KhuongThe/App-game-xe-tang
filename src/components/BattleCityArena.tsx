import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Direction, Bullet, Explosion, TankState, TileType, ServerBaseState, LootCrate, CyberQuestion, RewardType, PlayerMatchStats } from '../types/game';
import { RoomState, Team, RoomPlayer } from '../types/multiplayer';
import { networkService } from '../services/network';
import { sound } from '../services/soundEffects';
import { CYBER_QUESTIONS, getRandomQuestion } from '../data/cyberQuestions';
import { CyberQuizModal } from './CyberQuizModal';
import { MatchEndSummary } from './MatchEndSummary';
import { Shield, Swords, Trophy, AlertTriangle, ArrowLeft, Award, Sparkles, Zap, Lock, Clock, Volume2, VolumeX, RefreshCw } from 'lucide-react';

interface BattleCityArenaProps {
  room: RoomState;
  myPlayerId: string;
  playerName: string;
  onExitMatch: () => void;
}

const TILE_SIZE = 40;
const COLS = 16;
const ROWS = 13;
const CANVAS_WIDTH = COLS * TILE_SIZE; // 640
const CANVAS_HEIGHT = ROWS * TILE_SIZE; // 520
const TANK_SIZE = 28;

// Bản đồ chiến thuật 2 phe chuẩn (Mốc 3 & Mốc 4)
const MAP_TEMPLATE: TileType[][] = [
  ['STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL'],
  ['STEEL', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'BRICK', 'STEEL', 'STEEL', 'BRICK', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'STEEL'],
  ['STEEL', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'STEEL'],
  ['STEEL', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'RIVER', 'EMPTY', 'EMPTY', 'RIVER', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'STEEL'],
  ['STEEL', 'BRICK', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'RIVER', 'EMPTY', 'EMPTY', 'RIVER', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'BRICK', 'STEEL'],
  ['STEEL', 'BRICK', 'BRICK', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'BUSH', 'BUSH', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'BRICK', 'BRICK', 'STEEL'],
  ['STEEL', 'BRICK', 'BASE_BLUE', 'BRICK', 'EMPTY', 'STEEL', 'EMPTY', 'BUSH', 'BUSH', 'EMPTY', 'STEEL', 'EMPTY', 'BRICK', 'BASE_RED', 'BRICK', 'STEEL'],
  ['STEEL', 'BRICK', 'BRICK', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'BUSH', 'BUSH', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'BRICK', 'BRICK', 'STEEL'],
  ['STEEL', 'BRICK', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'RIVER', 'EMPTY', 'EMPTY', 'RIVER', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'BRICK', 'STEEL'],
  ['STEEL', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'RIVER', 'EMPTY', 'EMPTY', 'RIVER', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'STEEL'],
  ['STEEL', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'STEEL'],
  ['STEEL', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'BRICK', 'STEEL', 'STEEL', 'BRICK', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'STEEL'],
  ['STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL'],
];

export const BattleCityArena: React.FC<BattleCityArenaProps> = ({
  room,
  myPlayerId,
  playerName,
  onExitMatch,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Xác định người chơi hiện tại
  const playersList = room?.players || [];
  const myPlayerInRoom = playersList.find((p) => p.id === myPlayerId) || playersList[0];
  const effectiveMyId = myPlayerInRoom?.id || myPlayerId;
  const myTeam = myPlayerInRoom?.team || 'BLUE';

  // Vị trí xuất phát cố định cho từng slot
  const getSpawnPos = (slot: number): { x: number; y: number; dir: Direction } => {
    switch (slot) {
      case 1: return { x: 46, y: 46, dir: 'RIGHT' };
      case 2: return { x: 46, y: 446, dir: 'RIGHT' };
      case 3: return { x: 566, y: 46, dir: 'LEFT' };
      case 4: return { x: 566, y: 446, dir: 'LEFT' };
      default: return { x: 46, y: 46, dir: 'RIGHT' };
    }
  };

  const tanksRef = useRef<{ [id: string]: TankState }>({});
  const mapRef = useRef<TileType[][]>(JSON.parse(JSON.stringify(MAP_TEMPLATE)));
  const bulletsRef = useRef<Bullet[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const keysDownRef = useRef<{ [key: string]: boolean }>({});
  const lastShotTimeRef = useRef<number>(0);
  const lastSyncMoveTimeRef = useRef<number>(0);
  const knownBulletIdsRef = useRef<Set<string>>(new Set());
  const lootCrateRef = useRef<LootCrate | null>(null);

  // Trạng thái căn cứ 2 phe
  const [baseBlue, setBaseBlue] = useState<ServerBaseState>({
    team: 'BLUE',
    x: 2 * TILE_SIZE,
    y: 6 * TILE_SIZE,
    health: 100,
    maxHealth: 100,
    isDestroyed: false,
  });

  const [baseRed, setBaseRed] = useState<ServerBaseState>({
    team: 'RED',
    x: 13 * TILE_SIZE,
    y: 6 * TILE_SIZE,
    health: 100,
    maxHealth: 100,
    isDestroyed: false,
  });

  const [winner, setWinner] = useState<Team | null>(null);
  const [winReason, setWinReason] = useState<'BASE_DESTROYED' | 'TIMEOUT' | undefined>(undefined);
  const [timeLeft, setTimeLeft] = useState<number>(180);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getIsMuted());
  const [matchStats, setMatchStats] = useState<{ [playerId: string]: PlayerMatchStats } | undefined>(undefined);
  const [mvpPlayerId, setMvpPlayerId] = useState<string | undefined>(undefined);
  const [myHp, setMyHp] = useState<number>(100);
  const [myShield, setMyShield] = useState<number>(0);
  const [hasSuperBullet, setHasSuperBullet] = useState<boolean>(false);
  const [isParalyzed, setIsParalyzed] = useState<boolean>(false);
  const [practiceBot, setPracticeBot] = useState<boolean>(false);

  // Đếm ngược thời gian hiệp đấu (Mốc 5)
  useEffect(() => {
    if (winner) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [winner]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Modal câu hỏi an ninh mạng Mốc 4
  const [activeQuizQuestion, setActiveQuizQuestion] = useState<CyberQuestion | null>(null);
  const [correctAnswersCount, setCorrectAnswersCount] = useState<number>(0);
  const [floatingNotice, setFloatingNotice] = useState<string | null>(null);

  // Thông báo nổi ngắn hạn
  const showNotice = (text: string) => {
    setFloatingNotice(text);
    setTimeout(() => {
      setFloatingNotice(null);
    }, 3500);
  };

  // Bật/tắt bot luyện tập khi người chơi yêu cầu
  useEffect(() => {
    if (practiceBot) {
      const spawn = getSpawnPos(myTeam === 'BLUE' ? 3 : 1);
      tanksRef.current['practice-bot'] = {
        id: 'practice-bot',
        name: '🤖 Xe Luyện Tập',
        team: myTeam === 'BLUE' ? 'RED' : 'BLUE',
        slot: myTeam === 'BLUE' ? 3 : 1,
        x: spawn.x,
        y: spawn.y,
        direction: spawn.dir,
        speed: 2,
        health: 100,
        maxHealth: 100,
        shield: 0,
        color: myTeam === 'BLUE' ? '#ef4444' : '#06b6d4',
        isAlive: true,
        respawnTimer: 0,
        score: 0,
      };
    } else {
      delete tanksRef.current['practice-bot'];
    }
  }, [practiceBot, myTeam]);

  // Khởi tạo xe tăng
  useEffect(() => {
    const initialTanks: { [id: string]: TankState } = {};

    playersList.forEach((p) => {
      const spawn = getSpawnPos(p.slot);
      initialTanks[p.id] = {
        id: p.id,
        name: p.id === effectiveMyId && playerName ? playerName : p.name,
        team: p.team,
        slot: p.slot,
        x: spawn.x,
        y: spawn.y,
        direction: spawn.dir,
        speed: 3.5,
        health: 100,
        maxHealth: 100,
        shield: 0,
        color: p.team === 'BLUE' ? '#06b6d4' : '#ef4444',
        isAlive: true,
        respawnTimer: 0,
        score: 0,
      };
    });

    if (!initialTanks[effectiveMyId]) {
      const spawn = getSpawnPos(myPlayerInRoom?.slot || 1);
      initialTanks[effectiveMyId] = {
        id: effectiveMyId,
        name: playerName || 'Chiến Binh Mạng',
        team: myTeam,
        slot: myPlayerInRoom?.slot || 1,
        x: spawn.x,
        y: spawn.y,
        direction: spawn.dir,
        speed: 3.5,
        health: 100,
        maxHealth: 100,
        shield: 0,
        color: myTeam === 'BLUE' ? '#06b6d4' : '#ef4444',
        isAlive: true,
        respawnTimer: 0,
        score: 0,
      };
    }

    tanksRef.current = initialTanks;
  }, [room?.players, effectiveMyId, playerName, myTeam]);

  // Nhận sự kiện đồng bộ từ mạng
  useEffect(() => {
    const unsubscribe = networkService.subscribe((msg) => {
      if (msg.type === 'ROOM_UPDATE') {
        if (msg.room?.status === 'LOBBY') {
          onExitMatch();
        }
      } else if (msg.type === 'PLAYER_MOVED') {
        if (msg.playerId !== effectiveMyId) {
          if (!tanksRef.current[msg.playerId]) {
            const playerInRoom = Array.isArray(playersList) ? playersList.find((p) => p && p.id === msg.playerId) : undefined;
            const team: Team = playerInRoom?.team || (myTeam === 'BLUE' ? 'RED' : 'BLUE');
            tanksRef.current[msg.playerId] = {
              id: msg.playerId,
              name: playerInRoom?.name || 'Chiến Binh Đồng Đội',
              team,
              slot: playerInRoom?.slot || 3,
              x: msg.x,
              y: msg.y,
              direction: msg.direction,
              speed: 3.5,
              health: 100,
              maxHealth: 100,
              shield: 0,
              color: team === 'BLUE' ? '#06b6d4' : '#ef4444',
              isAlive: true,
              respawnTimer: 0,
              score: 0,
            };
          } else {
            tanksRef.current[msg.playerId].x = msg.x;
            tanksRef.current[msg.playerId].y = msg.y;
            tanksRef.current[msg.playerId].direction = msg.direction;
          }
        }
      } else if (msg.type === 'BULLET_FIRED') {
        if (msg.bullet.ownerId !== effectiveMyId && !knownBulletIdsRef.current.has(msg.bullet.id)) {
          knownBulletIdsRef.current.add(msg.bullet.id);
          bulletsRef.current.push(msg.bullet);
        }
      } else if (msg.type === 'TANK_DAMAGED') {
        sound.playExplosion();
        if (tanksRef.current[msg.targetId]) {
          tanksRef.current[msg.targetId].health = msg.health;
          tanksRef.current[msg.targetId].isAlive = msg.isAlive;
          if (msg.targetId === effectiveMyId) {
            setMyHp(msg.health);
          }
        }
      } else if (msg.type === 'BASE_DAMAGED') {
        sound.playBaseAlert();
        if (msg.team === 'BLUE') {
          setBaseBlue((prev) => ({ ...prev, health: msg.health, isDestroyed: msg.isDestroyed }));
        } else {
          setBaseRed((prev) => ({ ...prev, health: msg.health, isDestroyed: msg.isDestroyed }));
        }
      } else if (msg.type === 'BRICK_DESTROYED') {
        sound.playExplosion();
        if (mapRef.current[msg.row] && mapRef.current[msg.row][msg.col] === 'BRICK') {
          mapRef.current[msg.row][msg.col] = 'EMPTY';
        }
      } else if (msg.type === 'LOOT_SPAWNED') {
        lootCrateRef.current = msg.crate;
        sound.playLootSpawn();
        showNotice('📦 Hòm Tiếp Tế An Ninh Mạng vừa xuất hiện trên chiến trường!');
      } else if (msg.type === 'LOOT_REMOVED') {
        lootCrateRef.current = null;
      } else if (msg.type === 'BUFF_APPLIED') {
        if (tanksRef.current[msg.playerId]) {
          const tank = tanksRef.current[msg.playerId];
          if (msg.isMalware) {
            tank.isParalyzed = true;
            tank.paralyzedTimer = 3;
            if (msg.playerId === effectiveMyId) setIsParalyzed(true);
          } else {
            if (msg.rewardType === 'SHIELD') {
              tank.shield = 50;
              if (msg.playerId === effectiveMyId) setMyShield(50);
            } else if (msg.rewardType === 'SUPER_BULLET') {
              tank.hasSuperBullet = true;
              tank.superBulletTimer = 20;
              if (msg.playerId === effectiveMyId) setHasSuperBullet(true);
            } else if (msg.rewardType === 'HEAL_BASE') {
              if (tank.team === 'BLUE') {
                setBaseBlue((prev) => ({ ...prev, health: Math.min(100, prev.health + 20) }));
              } else {
                setBaseRed((prev) => ({ ...prev, health: Math.min(100, prev.health + 20) }));
              }
            }
          }
        }
      } else if (msg.type === 'MATCH_TICK') {
        setTimeLeft(msg.timeLeft);
      } else if (msg.type === 'GAME_OVER') {
        setWinner(msg.winnerTeam);
        if (msg.reason) setWinReason(msg.reason);
        if (msg.stats) setMatchStats(msg.stats);
        if (msg.mvpPlayerId) setMvpPlayerId(msg.mvpPlayerId);
        sound.playVictory();
      }
    });

    return () => unsubscribe();
  }, [effectiveMyId, onExitMatch, myTeam, room?.players]);

  // Vòng lặp đồng bộ REST tốc độ cao (70ms/lần)
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      const myTank = tanksRef.current[effectiveMyId];
      if (!myTank) return;

      const res = await networkService.syncMatch(room.pin, {
        playerId: effectiveMyId,
        x: myTank.x,
        y: myTank.y,
        direction: myTank.direction,
      });

      if (res) {
        if (res.status === 'LOBBY') {
          onExitMatch();
          return;
        }

        if (res.winner) {
          setWinner(res.winner);
          if (res.winReason) setWinReason(res.winReason);
          if (res.stats) setMatchStats(res.stats);
          if (res.mvpPlayerId) setMvpPlayerId(res.mvpPlayerId);
        }

        if (res.timeLeft !== undefined) {
          setTimeLeft(res.timeLeft);
        }

        if (res.baseBlue) {
          setBaseBlue(res.baseBlue);
        }

        if (res.baseRed) {
          setBaseRed(res.baseRed);
        }

        if (res.lootCrate !== undefined) {
          lootCrateRef.current = res.lootCrate;
        }

        if (res.destroyedBricks && Array.isArray(res.destroyedBricks)) {
          for (const b of res.destroyedBricks) {
            if (mapRef.current[b.row] && mapRef.current[b.row][b.col] === 'BRICK') {
              mapRef.current[b.row][b.col] = 'EMPTY';
            }
          }
        }

        if (res.recentBullets && Array.isArray(res.recentBullets)) {
          for (const bullet of res.recentBullets) {
            if (bullet.ownerId !== effectiveMyId && !knownBulletIdsRef.current.has(bullet.id)) {
              knownBulletIdsRef.current.add(bullet.id);
              bulletsRef.current.push(bullet);
            }
          }
        }

        if (res.tanks) {
          Object.entries(res.tanks).forEach(([id, remoteTank]: [string, any]) => {
            if (id !== effectiveMyId) {
              if (tanksRef.current[id]) {
                tanksRef.current[id].x = remoteTank.x;
                tanksRef.current[id].y = remoteTank.y;
                tanksRef.current[id].direction = remoteTank.direction;
                tanksRef.current[id].health = remoteTank.health;
                tanksRef.current[id].shield = remoteTank.shield || 0;
                tanksRef.current[id].hasSuperBullet = remoteTank.hasSuperBullet || false;
                tanksRef.current[id].isParalyzed = remoteTank.isParalyzed || false;
                tanksRef.current[id].isAlive = remoteTank.isAlive;
              } else {
                tanksRef.current[id] = {
                  id,
                  name: remoteTank.name || 'Chiến Binh Đồng Đội',
                  team: remoteTank.team,
                  slot: remoteTank.slot || 3,
                  x: remoteTank.x,
                  y: remoteTank.y,
                  direction: remoteTank.direction,
                  speed: 3.5,
                  health: remoteTank.health,
                  maxHealth: 100,
                  shield: remoteTank.shield || 0,
                  hasSuperBullet: remoteTank.hasSuperBullet || false,
                  isParalyzed: remoteTank.isParalyzed || false,
                  color: remoteTank.team === 'BLUE' ? '#06b6d4' : '#ef4444',
                  isAlive: remoteTank.isAlive,
                  respawnTimer: 0,
                  score: 0,
                };
              }
            }
          });
        }
      }
    }, 70);

    return () => clearInterval(syncInterval);
  }, [effectiveMyId, room.pin, onExitMatch]);

  // Kiểm tra va chạm hộp (AABB)
  const isColliding = useCallback((newX: number, newY: number, size: number): boolean => {
    if (newX < 0 || newX + size > CANVAS_WIDTH || newY < 0 || newY + size > CANVAS_HEIGHT) {
      return true;
    }

    const startCol = Math.floor(newX / TILE_SIZE);
    const endCol = Math.floor((newX + size - 1) / TILE_SIZE);
    const startRow = Math.floor(newY / TILE_SIZE);
    const endRow = Math.floor((newY + size - 1) / TILE_SIZE);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          const tile = mapRef.current[r][c];
          if (tile === 'BRICK' || tile === 'STEEL' || tile === 'RIVER' || tile === 'BASE_BLUE' || tile === 'BASE_RED') {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  // Xử lý ăn hòm tiếp tế
  const collectLoot = useCallback((crate: LootCrate) => {
    lootCrateRef.current = null;
    explosionsRef.current.push({
      id: `exp-loot-${Date.now()}`,
      x: crate.x + 20,
      y: crate.y + 20,
      radius: 6,
      maxRadius: 28,
      life: 1.0,
      color: '#facc15',
    });

    networkService.send({
      type: 'LOOT_COLLECTED',
      pin: room.pin,
      crateId: crate.id,
      playerId: effectiveMyId,
    });

    const q = CYBER_QUESTIONS.find((item) => item.id === crate.questionId) || getRandomQuestion();
    setActiveQuizQuestion(q);
  }, [room.pin, effectiveMyId]);

  // Nhận kết quả trả lời câu hỏi an ninh mạng
  const handleQuizAnswer = (isCorrect: boolean) => {
    if (!activeQuizQuestion) return;

    const myTank = tanksRef.current[effectiveMyId];
    if (isCorrect) {
      setCorrectAnswersCount((prev) => prev + 1);
      const reward = activeQuizQuestion.rewardType;

      if (reward === 'SHIELD') {
        if (myTank) myTank.shield = 50;
        setMyShield(50);
        showNotice('🛡️ NHẬN ĐƯỢC KHIÊN TƯỜNG LỬA (CHẶN 2 PHÁT ĐẠN)!');
      } else if (reward === 'SUPER_BULLET') {
        if (myTank) {
          myTank.hasSuperBullet = true;
          myTank.superBulletTimer = 20;
        }
        setHasSuperBullet(true);
        showNotice('⚡ NHẬN ĐƯỢC ĐẠN DIỆT VIRUS (X2 SÁT THƯƠNG TRONG 20S)!');
      } else if (reward === 'HEAL_BASE') {
        if (myTeam === 'BLUE') {
          setBaseBlue((prev) => ({ ...prev, health: Math.min(100, prev.health + 20) }));
        } else {
          setBaseRed((prev) => ({ ...prev, health: Math.min(100, prev.health + 20) }));
        }
        showNotice('🏥 KHẮC PHỤC SỰ CỐ: HỒI 20% MÁU CĂN CỨ SERVER!');
      }

      networkService.send({
        type: 'APPLY_BUFF',
        pin: room.pin,
        playerId: effectiveMyId,
        rewardType: reward,
        isMalware: false,
      });
    } else {
      if (myTank) {
        myTank.isParalyzed = true;
        myTank.paralyzedTimer = 3;
      }
      setIsParalyzed(true);
      showNotice('⚠️ DÍNH MÃ ĐỘC MALWARE: XE TĂNG BỊ TÊ LIỆT 3 GIÂY!');

      networkService.send({
        type: 'APPLY_BUFF',
        pin: room.pin,
        playerId: effectiveMyId,
        rewardType: activeQuizQuestion.rewardType,
        isMalware: true,
      });
    }
  };

  // Bắn đạn
  const fireBullet = useCallback(() => {
    if (winner || activeQuizQuestion) return;
    const now = performance.now();
    if (now - lastShotTimeRef.current < 250) return;

    const myTank = tanksRef.current[effectiveMyId];
    if (!myTank || !myTank.isAlive || myTank.isParalyzed) return;
    lastShotTimeRef.current = now;

    let bx = myTank.x + TANK_SIZE / 2;
    let by = myTank.y + TANK_SIZE / 2;

    if (myTank.direction === 'UP') by = myTank.y - 4;
    else if (myTank.direction === 'DOWN') by = myTank.y + TANK_SIZE + 4;
    else if (myTank.direction === 'LEFT') bx = myTank.x - 4;
    else if (myTank.direction === 'RIGHT') bx = myTank.x + TANK_SIZE + 4;

    const isSuper = myTank.hasSuperBullet ?? false;
    const bulletId = `b-${effectiveMyId}-${now}`;
    const newBullet: Bullet = {
      id: bulletId,
      x: bx,
      y: by,
      direction: myTank.direction,
      speed: isSuper ? 8.5 : 7,
      ownerId: effectiveMyId,
      team: myTank.team,
      damage: isSuper ? 50 : 25,
      color: isSuper ? '#facc15' : myTank.team === 'BLUE' ? '#38bdf8' : '#f87171',
      isSuper,
    };

    knownBulletIdsRef.current.add(bulletId);
    bulletsRef.current.push(newBullet);

    if (isSuper) {
      sound.playSuperShoot();
    } else {
      sound.playShoot();
    }

    networkService.send({
      type: 'PLAYER_SHOOT',
      pin: room.pin,
      bullet: newBullet,
    });
  }, [effectiveMyId, room.pin, winner, activeQuizQuestion]);

  // Xử lý bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeQuizQuestion) return;
      const key = e.key.toLowerCase();
      keysDownRef.current[key] = true;

      if (e.code === 'Space') {
        e.preventDefault();
        fireBullet();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysDownRef.current[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [fireBullet, activeQuizQuestion]);

  // Game Loop chính
  useEffect(() => {
    let animationFrameId: number;

    const updateGame = () => {
      const myTank = tanksRef.current[effectiveMyId];
      const keys = keysDownRef.current;

      // Giảm timer của Buffs
      if (myTank) {
        if (myTank.hasSuperBullet && myTank.superBulletTimer) {
          myTank.superBulletTimer -= 0.016;
          if (myTank.superBulletTimer <= 0) {
            myTank.hasSuperBullet = false;
            setHasSuperBullet(false);
          }
        }
        if (myTank.isParalyzed && myTank.paralyzedTimer) {
          myTank.paralyzedTimer -= 0.016;
          if (myTank.paralyzedTimer <= 0) {
            myTank.isParalyzed = false;
            setIsParalyzed(false);
          }
        }
      }

      // Di chuyển xe người chơi (nếu không bị tê liệt và không mở quiz)
      if (myTank && myTank.isAlive && !winner && !myTank.isParalyzed && !activeQuizQuestion) {
        let dx = 0;
        let dy = 0;
        let newDir: Direction = myTank.direction;

        if (keys['w'] || keys['arrowup']) {
          dy = -myTank.speed;
          newDir = 'UP';
        } else if (keys['s'] || keys['arrowdown']) {
          dy = myTank.speed;
          newDir = 'DOWN';
        } else if (keys['a'] || keys['arrowleft']) {
          dx = -myTank.speed;
          newDir = 'LEFT';
        } else if (keys['d'] || keys['arrowright']) {
          dx = myTank.speed;
          newDir = 'RIGHT';
        }

        if (dx !== 0 || dy !== 0) {
          myTank.direction = newDir;
          const targetX = myTank.x + dx;
          const targetY = myTank.y + dy;

          if (!isColliding(targetX, targetY, TANK_SIZE)) {
            myTank.x = targetX;
            myTank.y = targetY;
          } else if (dx !== 0 && !isColliding(targetX, myTank.y, TANK_SIZE)) {
            myTank.x = targetX;
          } else if (dy !== 0 && !isColliding(myTank.x, targetY, TANK_SIZE)) {
            myTank.y = targetY;
          }

          // Kiểm tra xe đè lên Hòm Tiếp Tế
          if (lootCrateRef.current) {
            const crate = lootCrateRef.current;
            const dist = Math.hypot(
              myTank.x + TANK_SIZE / 2 - (crate.x + 20),
              myTank.y + TANK_SIZE / 2 - (crate.y + 20)
            );
            if (dist < TANK_SIZE / 2 + 16) {
              collectLoot(crate);
            }
          }

          // Đồng bộ vị trí với máy khác
          const now = performance.now();
          if (now - lastSyncMoveTimeRef.current > 35) {
            lastSyncMoveTimeRef.current = now;
            networkService.send({
              type: 'PLAYER_MOVE',
              pin: room.pin,
              playerId: effectiveMyId,
              x: myTank.x,
              y: myTank.y,
              direction: myTank.direction,
            });
          }
        }
      }

      // Xử lý đạn và va chạm
      const activeBullets: Bullet[] = [];
      for (const bullet of bulletsRef.current) {
        if (bullet.direction === 'UP') bullet.y -= bullet.speed;
        else if (bullet.direction === 'DOWN') bullet.y += bullet.speed;
        else if (bullet.direction === 'LEFT') bullet.x -= bullet.speed;
        else if (bullet.direction === 'RIGHT') bullet.x += bullet.speed;

        if (bullet.x < 0 || bullet.x > CANVAS_WIDTH || bullet.y < 0 || bullet.y > CANVAS_HEIGHT) {
          continue;
        }

        let hit = false;

        // Va chạm Hòm Tiếp Tế
        if (lootCrateRef.current) {
          const crate = lootCrateRef.current;
          const dist = Math.hypot(bullet.x - (crate.x + 20), bullet.y - (crate.y + 20));
          if (dist < 22) {
            hit = true;
            collectLoot(crate);
          }
        }

        const tileCol = Math.floor(bullet.x / TILE_SIZE);
        const tileRow = Math.floor(bullet.y / TILE_SIZE);

        // Va chạm tường & căn cứ
        if (!hit && tileRow >= 0 && tileRow < ROWS && tileCol >= 0 && tileCol < COLS) {
          const tile = mapRef.current[tileRow][tileCol];

          if (tile === 'BRICK') {
            mapRef.current[tileRow][tileCol] = 'EMPTY';
            hit = true;
            networkService.send({
              type: 'HIT_BRICK',
              pin: room.pin,
              row: tileRow,
              col: tileCol,
            });
            explosionsRef.current.push({
              id: `exp-${Date.now()}-${Math.random()}`,
              x: tileCol * TILE_SIZE + TILE_SIZE / 2,
              y: tileRow * TILE_SIZE + TILE_SIZE / 2,
              radius: 4,
              maxRadius: 18,
              life: 1.0,
              color: '#f97316',
            });
          } else if (tile === 'STEEL') {
            hit = true;
            explosionsRef.current.push({
              id: `exp-${Date.now()}-${Math.random()}`,
              x: bullet.x,
              y: bullet.y,
              radius: 2,
              maxRadius: 10,
              life: 1.0,
              color: '#38bdf8',
            });
          } else if (tile === 'BASE_BLUE' && bullet.team === 'RED') {
            hit = true;
            setBaseBlue((prev) => {
              const newHp = Math.max(0, prev.health - (bullet.isSuper ? 40 : 20));
              const isDestroyed = newHp <= 0;
              networkService.send({
                type: 'HIT_BASE',
                pin: room.pin,
                team: 'BLUE',
                damage: 100 - newHp,
                attackerId: bullet.ownerId,
              });
              if (isDestroyed) setWinner('RED');
              return { ...prev, health: newHp, isDestroyed };
            });
            explosionsRef.current.push({
              id: `exp-${Date.now()}-${Math.random()}`,
              x: bullet.x,
              y: bullet.y,
              radius: 6,
              maxRadius: 28,
              life: 1.0,
              color: '#ef4444',
            });
          } else if (tile === 'BASE_RED' && bullet.team === 'BLUE') {
            hit = true;
            setBaseRed((prev) => {
              const newHp = Math.max(0, prev.health - (bullet.isSuper ? 40 : 20));
              const isDestroyed = newHp <= 0;
              networkService.send({
                type: 'HIT_BASE',
                pin: room.pin,
                team: 'RED',
                damage: 100 - newHp,
                attackerId: bullet.ownerId,
              });
              if (isDestroyed) setWinner('BLUE');
              return { ...prev, health: newHp, isDestroyed };
            });
            explosionsRef.current.push({
              id: `exp-${Date.now()}-${Math.random()}`,
              x: bullet.x,
              y: bullet.y,
              radius: 6,
              maxRadius: 28,
              life: 1.0,
              color: '#06b6d4',
            });
          }
        }

        // Va chạm xe tăng đối phương
        if (!hit) {
          Object.values(tanksRef.current).forEach((targetTank) => {
            if (targetTank.isAlive && targetTank.team !== bullet.team) {
              const dist = Math.hypot(
                bullet.x - (targetTank.x + TANK_SIZE / 2),
                bullet.y - (targetTank.y + TANK_SIZE / 2)
              );
              if (dist < TANK_SIZE / 2 + 4) {
                hit = true;

                // Khiên bảo vệ giảm sát thương trước
                let effectiveDamage = bullet.damage;
                if (targetTank.shield > 0) {
                  const absorbed = Math.min(targetTank.shield, effectiveDamage);
                  targetTank.shield -= absorbed;
                  effectiveDamage -= absorbed;
                  if (targetTank.id === effectiveMyId) setMyShield(targetTank.shield);
                }

                const newHp = Math.max(0, targetTank.health - effectiveDamage);
                targetTank.health = newHp;
                if (newHp <= 0) {
                  targetTank.isAlive = false;
                  targetTank.respawnTimer = 4;
                  targetTank.shield = 0;
                  targetTank.hasSuperBullet = false;
                }
                if (targetTank.id === effectiveMyId) {
                  setMyHp(newHp);
                }

                networkService.send({
                  type: 'HIT_TANK',
                  pin: room.pin,
                  targetId: targetTank.id,
                  damage: 100 - newHp,
                  attackerId: bullet.ownerId,
                });
                explosionsRef.current.push({
                  id: `exp-${Date.now()}-${Math.random()}`,
                  x: targetTank.x + TANK_SIZE / 2,
                  y: targetTank.y + TANK_SIZE / 2,
                  radius: 5,
                  maxRadius: 24,
                  life: 1.0,
                  color: targetTank.team === 'BLUE' ? '#38bdf8' : '#ef4444',
                });
              }
            }
          });
        }

        if (!hit) {
          activeBullets.push(bullet);
        }
      }
      bulletsRef.current = activeBullets;

      // Hồi sinh xe
      Object.values(tanksRef.current).forEach((tank) => {
        if (!tank.isAlive && tank.respawnTimer > 0) {
          tank.respawnTimer -= 0.016;
          if (tank.respawnTimer <= 0) {
            const spawn = getSpawnPos(tank.slot);
            tank.x = spawn.x;
            tank.y = spawn.y;
            tank.health = 100;
            tank.shield = 0;
            tank.hasSuperBullet = false;
            tank.isParalyzed = false;
            tank.isAlive = true;
            if (tank.id === effectiveMyId) {
              setMyHp(100);
              setMyShield(0);
              setHasSuperBullet(false);
              setIsParalyzed(false);
            }
          }
        }
      });

      // Hiệu ứng nổ
      explosionsRef.current = explosionsRef.current
        .map((exp) => ({
          ...exp,
          radius: exp.radius + (exp.maxRadius - exp.radius) * 0.2,
          life: exp.life - 0.08,
        }))
        .filter((exp) => exp.life > 0);

      renderCanvas();
      animationFrameId = requestAnimationFrame(updateGame);
    };

    // Vẽ Canvas
    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Lưới nền
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1;
      for (let x = 0; x <= CANVAS_WIDTH; x += TILE_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += TILE_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // 1. Vẽ bản đồ
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const tile = mapRef.current[r][c];
          const px = c * TILE_SIZE;
          const py = r * TILE_SIZE;

          if (tile === 'BRICK') {
            ctx.fillStyle = '#b45309';
            ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            ctx.fillStyle = '#d97706';
            ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12);
          } else if (tile === 'STEEL') {
            ctx.fillStyle = '#334155';
            ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            ctx.fillStyle = '#64748b';
            ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            ctx.strokeStyle = '#0284c7';
            ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          } else if (tile === 'RIVER') {
            ctx.fillStyle = '#0369a1';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px + 4, py + TILE_SIZE / 2);
            ctx.lineTo(px + TILE_SIZE - 4, py + TILE_SIZE / 2);
            ctx.stroke();
          } else if (tile === 'BASE_BLUE') {
            ctx.fillStyle = '#0c4a6e';
            ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.fillStyle = baseBlue.isDestroyed ? '#64748b' : '#38bdf8';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(baseBlue.isDestroyed ? '💥' : '🛡️', px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 7);
          } else if (tile === 'BASE_RED') {
            ctx.fillStyle = '#7f1d1d';
            ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.fillStyle = baseRed.isDestroyed ? '#64748b' : '#f87171';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(baseRed.isDestroyed ? '💥' : '🛡️', px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 7);
          }
        }
      }

      // 2. Vẽ Hòm Tiếp Tế An Ninh Mạng (Mốc 4)
      if (lootCrateRef.current) {
        const crate = lootCrateRef.current;
        const pulse = Math.sin(Date.now() / 180) * 3;
        ctx.save();
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 16 + pulse;
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(crate.x + 3, crate.y + 3, 34, 34);
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        ctx.strokeRect(crate.x + 3, crate.y + 3, 34, 34);

        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔑', crate.x + 20, crate.y + 26);

        // Chữ "HÒM BẢO MẬT" phía trên
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('HÒM BẢO MẬT', crate.x + 20, crate.y - 3);
        ctx.restore();
      }

      // 3. Vẽ đạn
      for (const bullet of bulletsRef.current) {
        ctx.save();
        ctx.shadowColor = bullet.color;
        ctx.shadowBlur = bullet.isSuper ? 18 : 10;
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.isSuper ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. Vẽ nổ
      for (const exp of explosionsRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, exp.life);
        ctx.shadowColor = exp.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = exp.color;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 5. Vẽ xe tăng & Buffs
      Object.values(tanksRef.current).forEach((tank) => {
        const isMe = tank.id === effectiveMyId;

        if (!tank.isAlive) {
          ctx.fillStyle = '#64748b';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`Hồi sinh: ${Math.ceil(tank.respawnTimer)}s`, tank.x + TANK_SIZE / 2, tank.y);
          return;
        }

        // Hào quang xe của bạn
        if (isMe) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(tank.x + TANK_SIZE / 2, tank.y + TANK_SIZE / 2, TANK_SIZE / 2 + 6, 0, Math.PI * 2);
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#eab308';
          ctx.shadowBlur = 10;
          ctx.stroke();

          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('▼ BẠN Ở ĐÂY', tank.x + TANK_SIZE / 2, tank.y - 28);
          ctx.restore();
        }

        // Vẽ Khiên Tường Lửa (Shield) bọc quanh xe
        if (tank.shield > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(tank.x + TANK_SIZE / 2, tank.y + TANK_SIZE / 2, TANK_SIZE / 2 + 8, 0, Math.PI * 2);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#0284c7';
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.restore();
        }

        // Vẽ hiệu ứng Tê Liệt Mã Độc (Malware Glitch)
        if (tank.isParalyzed) {
          ctx.save();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.fillRect(tank.x - 4, tank.y - 4, TANK_SIZE + 8, TANK_SIZE + 8);
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚠️ TÊ LIỆT', tank.x + TANK_SIZE / 2, tank.y + TANK_SIZE + 12);
          ctx.restore();
        }

        // Vẽ hiệu ứng Đạn Siêu Cấp X2
        if (tank.hasSuperBullet) {
          ctx.save();
          ctx.fillStyle = '#facc15';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚡ ĐẠN X2', tank.x + TANK_SIZE / 2, tank.y + TANK_SIZE + 12);
          ctx.restore();
        }

        ctx.save();
        ctx.translate(tank.x + TANK_SIZE / 2, tank.y + TANK_SIZE / 2);

        let angle = 0;
        if (tank.direction === 'DOWN') angle = Math.PI;
        else if (tank.direction === 'LEFT') angle = -Math.PI / 2;
        else if (tank.direction === 'RIGHT') angle = Math.PI / 2;
        ctx.rotate(angle);

        // Thân xe
        ctx.shadowColor = tank.hasSuperBullet ? '#facc15' : tank.color;
        ctx.shadowBlur = isMe ? 12 : 6;
        ctx.fillStyle = tank.team === 'BLUE' ? '#082f49' : '#450a0a';
        ctx.fillRect(-TANK_SIZE / 2 + 2, -TANK_SIZE / 2 + 2, TANK_SIZE - 4, TANK_SIZE - 4);

        // Bánh xích
        ctx.fillStyle = tank.color;
        ctx.fillRect(-TANK_SIZE / 2, -TANK_SIZE / 2, 5, TANK_SIZE);
        ctx.fillRect(TANK_SIZE / 2 - 5, -TANK_SIZE / 2, 5, TANK_SIZE);

        // Tháp pháo
        ctx.fillStyle = tank.hasSuperBullet ? '#facc15' : tank.team === 'BLUE' ? '#0284c7' : '#dc2626';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        // Nòng pháo
        ctx.fillStyle = isMe ? '#fde047' : tank.color;
        ctx.fillRect(-2, -TANK_SIZE / 2 - 4, 4, TANK_SIZE / 2 + 4);

        ctx.restore();

        // Thanh máu
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(tank.x, tank.y - 12, TANK_SIZE, 3);
        ctx.fillStyle = tank.team === 'BLUE' ? '#38bdf8' : '#ef4444';
        ctx.fillRect(tank.x, tank.y - 12, (tank.health / tank.maxHealth) * TANK_SIZE, 3);

        // Tên người chơi
        ctx.save();
        ctx.font = isMe ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = isMe ? '#fde047' : (tank.team === 'BLUE' ? '#38bdf8' : '#f87171');
        ctx.fillText(
          `${isMe ? '⭐ ' : ''}${tank.name} (${tank.team === 'BLUE' ? 'Xanh' : 'Đỏ'})`,
          tank.x + TANK_SIZE / 2,
          tank.y - 16
        );
        ctx.restore();
      });

      // 6. Vẽ bụi cây
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (mapRef.current[r][c] === 'BUSH') {
            const px = c * TILE_SIZE;
            const py = r * TILE_SIZE;
            ctx.fillStyle = 'rgba(16, 185, 129, 0.75)';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          }
        }
      }
    };

    animationFrameId = requestAnimationFrame(updateGame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isColliding, effectiveMyId, room.pin, winner, collectLoot, activeQuizQuestion]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Bảng thông tin thanh máu Server căn cứ 2 phe, đồng hồ 180s & Âm thanh (Mốc 5) */}
      <div className="w-full max-w-[640px] flex flex-col gap-2.5 bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-lg">
        {/* Thanh công cụ đỉnh: Đồng hồ đếm ngược hiệp đấu & Nút âm thanh */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">⚔️ CHIẾN TRƯỜNG AN NINH MẠNG</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Đồng hồ đếm ngược 180s */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono font-bold text-xs ${
              timeLeft <= 30
                ? 'bg-red-950/90 border-red-500 text-red-300 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                : 'bg-slate-950 border-cyan-800/80 text-cyan-300'
            }`}>
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{formatTime(timeLeft)}</span>
            </div>

            {/* Nút bật / tắt âm thanh */}
            <button
              onClick={() => {
                const muted = sound.toggleMute();
                setIsMuted(muted);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs text-slate-300 cursor-pointer transition select-none"
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">Âm thanh: TẮT</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Âm thanh: BẬT</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Căn cứ Xanh */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0 font-bold">
              🛡️
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-bold text-cyan-400">SERVER PHE XANH</span>
                <span className="font-mono text-cyan-300 font-bold">{baseBlue.health}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-cyan-900">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
                  style={{ width: `${baseBlue.health}%` }}
                />
              </div>
            </div>
          </div>

          {/* Căn cứ Đỏ */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-950 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0 font-bold">
              🛡️
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-bold text-red-400">SERVER PHE ĐỎ</span>
                <span className="font-mono text-red-300 font-bold">{baseRed.health}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-red-900">
                <div
                  className="bg-gradient-to-r from-red-500 to-amber-500 h-full transition-all duration-300"
                  style={{ width: `${baseRed.health}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Thanh trạng thái Buff và Điểm Kiến Thức An Ninh Mạng (Mốc 4) */}
        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-bold text-amber-300 bg-amber-950/60 border border-amber-600/40 px-2.5 py-0.5 rounded-lg">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Kiến thức an ninh đúng: <strong>{correctAnswersCount}</strong> câu</span>
            </span>

            {myShield > 0 && (
              <span className="flex items-center gap-1 text-cyan-300 bg-cyan-950 border border-cyan-600/50 px-2 py-0.5 rounded">
                <Shield className="w-3 h-3 text-cyan-400" />
                <span>Khiên: {myShield}</span>
              </span>
            )}

            {hasSuperBullet && (
              <span className="flex items-center gap-1 text-yellow-300 bg-yellow-950 border border-yellow-600/50 px-2 py-0.5 rounded animate-pulse">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span>Đạn X2 Sát thương</span>
              </span>
            )}

            {isParalyzed && (
              <span className="flex items-center gap-1 text-red-300 bg-red-950 border border-red-600/50 px-2 py-0.5 rounded animate-bounce">
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <span>Bị tê liệt mã độc!</span>
              </span>
            )}
          </div>

          <span className="text-[11px] text-slate-400">
            Bắn hoặc đè lên <strong>🔑 Hòm tiếp tế</strong> để trả lời tình huống nhận Buff!
          </span>
        </div>
      </div>

      {/* Thông báo nổi (Toast) */}
      {floatingNotice && (
        <div className="w-full max-w-[640px] bg-cyan-950 border border-cyan-400 text-cyan-200 px-4 py-2 rounded-xl text-xs font-bold text-center shadow-[0_0_20px_rgba(6,182,212,0.4)] animate-bounce">
          {floatingNotice}
        </div>
      )}

      {/* Chiến trường Canvas 2D */}
      <div className="relative border-2 border-cyan-500/50 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.3)] bg-slate-950">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block cursor-crosshair"
        />

        {/* Nút thoát về lại sảnh & Nút bật xe luyện tập */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <button
            onClick={() => {
              networkService.requestRematch(room.pin);
              onExitMatch();
            }}
            className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-800 text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded border border-slate-700 backdrop-blur cursor-pointer transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Về Sảnh Chờ</span>
          </button>

          <button
            onClick={() => setPracticeBot(!practiceBot)}
            className={`text-xs px-2.5 py-1 rounded border backdrop-blur cursor-pointer transition font-semibold ${
              practiceBot
                ? 'bg-amber-950/90 border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {practiceBot ? '🛑 Tắt xe bot' : '🎯 Bật xe bot'}
          </button>
        </div>

        {/* Thông tin phòng & Người chơi */}
        <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur px-3 py-1 rounded border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
          <span>Phòng: <strong className="font-mono text-cyan-300">#{room.pin}</strong></span>
          <span className="text-slate-500">|</span>
          <span>Số người: <strong className="text-white">{playersList.length}</strong></span>
        </div>

        {/* MÀN HÌNH TỔNG KẾT & VINH DANH AN NINH MẠNG (MỐC 5) */}
        {winner && (
          <MatchEndSummary
            winner={winner}
            myTeam={myTeam}
            winReason={winReason}
            players={playersList}
            stats={matchStats}
            mvpPlayerId={mvpPlayerId}
            onRematch={() => {
              networkService.requestRematch(room.pin);
              onExitMatch();
            }}
          />
        )}
      </div>

      {/* MODAL CÂU HỎI TÌNH HUỐNG AN TOÀN THÔNG TIN MẠNG (MỐC 4) */}
      {activeQuizQuestion && (
        <CyberQuizModal
          question={activeQuizQuestion}
          onAnswer={handleQuizAnswer}
          onClose={() => setActiveQuizQuestion(null)}
        />
      )}

      {/* Phím ảo điều khiển và bắn đạn */}
      <div className="flex items-center justify-between w-full max-w-[640px] px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-3 gap-1 w-28">
            <div />
            <button
              onMouseDown={() => { keysDownRef.current['w'] = true; }}
              onMouseUp={() => { keysDownRef.current['w'] = false; }}
              onMouseLeave={() => { keysDownRef.current['w'] = false; }}
              onTouchStart={() => { keysDownRef.current['w'] = true; }}
              onTouchEnd={() => { keysDownRef.current['w'] = false; }}
              className="py-1.5 bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 rounded text-slate-200 font-bold text-center border border-slate-700 select-none cursor-pointer text-xs"
              title="Tiến lên (W / Phím Lên)"
            >
              ▲
            </button>
            <div />
            <button
              onMouseDown={() => { keysDownRef.current['a'] = true; }}
              onMouseUp={() => { keysDownRef.current['a'] = false; }}
              onMouseLeave={() => { keysDownRef.current['a'] = false; }}
              onTouchStart={() => { keysDownRef.current['a'] = true; }}
              onTouchEnd={() => { keysDownRef.current['a'] = false; }}
              className="py-1.5 bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 rounded text-slate-200 font-bold text-center border border-slate-700 select-none cursor-pointer text-xs"
              title="Rẽ trái (A / Phím Trái)"
            >
              ◀
            </button>
            <button
              onMouseDown={() => { keysDownRef.current['s'] = true; }}
              onMouseUp={() => { keysDownRef.current['s'] = false; }}
              onMouseLeave={() => { keysDownRef.current['s'] = false; }}
              onTouchStart={() => { keysDownRef.current['s'] = true; }}
              onTouchEnd={() => { keysDownRef.current['s'] = false; }}
              className="py-1.5 bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 rounded text-slate-200 font-bold text-center border border-slate-700 select-none cursor-pointer text-xs"
              title="Lùi xuống (S / Phím Xuống)"
            >
              ▼
            </button>
            <button
              onMouseDown={() => { keysDownRef.current['d'] = true; }}
              onMouseUp={() => { keysDownRef.current['d'] = false; }}
              onMouseLeave={() => { keysDownRef.current['d'] = false; }}
              onTouchStart={() => { keysDownRef.current['d'] = true; }}
              onTouchEnd={() => { keysDownRef.current['d'] = false; }}
              className="py-1.5 bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 rounded text-slate-200 font-bold text-center border border-slate-700 select-none cursor-pointer text-xs"
              title="Rẽ phải (D / Phím Phải)"
            >
              ▶
            </button>
          </div>
          <div className="text-xs text-slate-300">
            <div>Xe của bạn: <strong className="text-yellow-400 font-bold">{playerName}</strong> ({myTeam === 'BLUE' ? 'Đội Xanh' : 'Đội Đỏ'})</div>
            <div>Máu xe: <strong className="text-cyan-400 font-mono">{myHp}/100</strong></div>
            <div className="text-[11px] text-slate-500">Phím: WASD hoặc Mũi tên</div>
          </div>
        </div>

        <button
          onClick={fireBullet}
          disabled={isParalyzed || !!activeQuizQuestion}
          className={`px-6 py-3 rounded-xl border text-xs font-black uppercase tracking-wider select-none transition ${
            isParalyzed
              ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] cursor-pointer'
          }`}
        >
          {isParalyzed ? '⚠️ ĐANG BỊ TÊ LIỆT' : '💥 BẮN ĐẠN (SPACE)'}
        </button>
      </div>
    </div>
  );
};
