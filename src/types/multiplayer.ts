import { Direction, Bullet, TileType, GameMatchState, LootCrate, RewardType, PlayerMatchStats } from './game';

export type Team = 'BLUE' | 'RED';

export interface RoomPlayer {
  id: string;
  name: string;
  team: Team;
  slot: number; // 1, 2 for Blue; 3, 4 for Red
  isHost: boolean;
  ready: boolean;
  lastActive?: number;
}

export interface RoomState {
  pin: string;
  hostId: string;
  status: 'LOBBY' | 'PLAYING' | 'ENDED';
  players: RoomPlayer[];
  maxPlayers: number;
}

export type ClientMessage =
  | { type: 'CREATE_ROOM'; playerName: string; playerId?: string }
  | { type: 'JOIN_ROOM'; pin: string; playerName: string; playerId?: string }
  | { type: 'IDENTIFY'; pin: string; playerId: string }
  | { type: 'SWITCH_TEAM'; pin: string; team: Team }
  | { type: 'TOGGLE_READY'; pin: string }
  | { type: 'START_GAME'; pin: string }
  | { type: 'LEAVE_ROOM'; pin: string }
  | { type: 'PLAYER_MOVE'; pin: string; playerId: string; x: number; y: number; direction: Direction }
  | { type: 'PLAYER_SHOOT'; pin: string; bullet: Bullet }
  | { type: 'HIT_TANK'; pin: string; targetId: string; damage: number; attackerId: string }
  | { type: 'HIT_BASE'; pin: string; team: Team; damage: number; attackerId: string }
  | { type: 'HIT_BRICK'; pin: string; row: number; col: number; playerId?: string }
  | { type: 'LOOT_COLLECTED'; pin: string; crateId: string; playerId: string }
  | { type: 'APPLY_BUFF'; pin: string; playerId: string; rewardType: RewardType; isMalware: boolean }
  | { type: 'RESTART_GAME'; pin: string }
  | { type: 'PING' };

export type ServerMessage =
  | { type: 'ROOM_CREATED'; room: RoomState; playerId: string }
  | { type: 'ROOM_JOINED'; room: RoomState; playerId: string }
  | { type: 'ROOM_UPDATE'; room: RoomState }
  | { type: 'GAME_STARTED'; room: RoomState; matchState?: GameMatchState }
  | { type: 'PLAYER_MOVED'; playerId: string; x: number; y: number; direction: Direction }
  | { type: 'BULLET_FIRED'; bullet: Bullet }
  | { type: 'TANK_DAMAGED'; targetId: string; health: number; isAlive: boolean; attackerId: string }
  | { type: 'BASE_DAMAGED'; team: Team; health: number; isDestroyed: boolean }
  | { type: 'BRICK_DESTROYED'; row: number; col: number }
  | { type: 'LOOT_SPAWNED'; crate: LootCrate }
  | { type: 'LOOT_REMOVED'; crateId: string; collectorId: string }
  | { type: 'BUFF_APPLIED'; playerId: string; rewardType: RewardType; isMalware: boolean }
  | { type: 'MATCH_TICK'; timeLeft: number }
  | { 
      type: 'GAME_OVER'; 
      winnerTeam: Team; 
      reason?: 'BASE_DESTROYED' | 'TIMEOUT'; 
      stats?: { [playerId: string]: PlayerMatchStats }; 
      mvpPlayerId?: string 
    }
  | { type: 'PONG' }
  | { type: 'ERROR'; message: string };
