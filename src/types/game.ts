export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type TileType = 
  | 'EMPTY'        // Đường trống
  | 'BRICK'        // Tường bảo mật (bắn 1-2 phát vỡ)
  | 'STEEL'        // Tường lửa cứng (không thể phá hủy bằng đạn thường)
  | 'RIVER'        // Dòng dữ liệu (xe không đi qua được, đạn bay qua được)
  | 'BUSH'         // Vùng ẩn danh (xe đi vào thì ngụy trang)
  | 'BASE_BLUE'    // Căn cứ Server phe Xanh
  | 'BASE_RED';    // Căn cứ Server phe Đỏ

export interface Position {
  x: number;
  y: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  direction: Direction;
  speed: number;
  ownerId: string;
  team: 'BLUE' | 'RED';
  damage: number;
  color: string;
  isSuper?: boolean;
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number; // 0 to 1
  color: string;
}

export interface TankState {
  id: string;
  name: string;
  team: 'BLUE' | 'RED';
  slot: number; // 1, 2 (Blue) or 3, 4 (Red)
  x: number;
  y: number;
  direction: Direction;
  speed: number;
  health: number;
  maxHealth: number;
  shield: number; // Điểm khiên bảo vệ (chặn đạn)
  color: string;
  isAlive: boolean;
  respawnTimer: number; // seconds until respawn
  score: number;
  isBot?: boolean;
  hasSuperBullet?: boolean; // Buff đạn diệt virus x2 sát thương
  superBulletTimer?: number;
  isParalyzed?: boolean; // Tê liệt do dính mã độc khi trả lời sai
  paralyzedTimer?: number;
}

export interface ServerBaseState {
  team: 'BLUE' | 'RED';
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  isDestroyed: boolean;
}

export type RewardType = 'SHIELD' | 'SUPER_BULLET' | 'HEAL_BASE';

export interface CyberQuestion {
  id: string;
  topic: 'PHISHING' | 'PASSWORD' | 'MALWARE' | 'NETWORK_SAFETY' | 'PRIVACY';
  topicLabel: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  rewardType: RewardType;
  rewardLabel: string;
}

export interface LootCrate {
  id: string;
  x: number;
  y: number;
  questionId: string;
  spawnTime: number;
}

// Bảng thống kê điểm thi đấu & an ninh mạng cho từng người chơi (Mốc 5)
export interface PlayerMatchStats {
  playerId: string;
  name: string;
  team: 'BLUE' | 'RED';
  damageDealt: number;
  bricksDestroyed: number;
  cyberCorrect: number;
  cyberAttempts: number;
  kills: number;
  totalScore: number;
  isMvp?: boolean;
}

export interface GameMatchState {
  pin: string;
  status: 'LOBBY' | 'PLAYING' | 'ENDED';
  winnerTeam: 'BLUE' | 'RED' | null;
  map: TileType[][];
  tanks: { [id: string]: TankState };
  baseBlue: ServerBaseState;
  baseRed: ServerBaseState;
  bullets: Bullet[];
  explosions: Explosion[];
  lootCrate?: LootCrate | null;
  timeLeft?: number;
  stats?: { [playerId: string]: PlayerMatchStats };
  mvpPlayerId?: string;
}
