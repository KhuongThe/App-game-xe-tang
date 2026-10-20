import { ClientMessage, ServerMessage, RoomState, Team } from '../types/multiplayer';
import { Direction, Bullet, RewardType } from '../types/game';

type MessageHandler = (msg: ServerMessage) => void;

class NetworkService {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private currentPin: string | null = null;
  private currentPlayerId: string = '';
  private pollingTimer: any = null;
  private reconnectTimer: any = null;
  private isConnecting: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Lưu và tái sử dụng PlayerId duy nhất của tab này trong sessionStorage
      let savedId = sessionStorage.getItem('cybertank_player_id');
      if (!savedId) {
        savedId = `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        sessionStorage.setItem('cybertank_player_id', savedId);
      }
      this.currentPlayerId = savedId;

      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('cybertank_multiplayer_channel');
        this.broadcastChannel.onmessage = (event) => {
          const msg = event.data as ServerMessage;
          this.notifyHandlers(msg);
        };
      }
    }
  }

  public getPlayerId(): string {
    return this.currentPlayerId;
  }

  public setPlayerId(id: string) {
    this.currentPlayerId = id;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('cybertank_player_id', id);
    }
  }

  public getCurrentPin(): string | null {
    return this.currentPin;
  }

  public setPin(pin: string) {
    this.currentPin = pin;
    this.startPolling();
  }

  // Lấy đường link mời chuẩn theo đúng địa chỉ máy chủ đang chạy
  public getPublicInviteUrl(pin: string): string {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/?pin=${pin}`;
  }

  // Khởi tạo phòng đấu mới trực tiếp qua REST API (đảm bảo 100% nhận ngay mã PIN và thông tin phòng)
  public async createRoom(playerName: string): Promise<RoomState | null> {
    const pName = (playerName || 'Chiến Binh Mạng').trim();
    const pId = this.currentPlayerId || `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.currentPlayerId = pId;

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: pName, playerId: pId }),
      });
      if (res.ok) {
        const data = await res.json();
        const room: RoomState = data.room || data;
        const assignedId = data.playerId || pId;
        this.currentPin = room.pin;
        this.currentPlayerId = assignedId;
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('cybertank_player_id', assignedId);
        }

        // Định danh với WebSocket nếu đã kết nối
        this.connect().then(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              type: 'IDENTIFY',
              pin: room.pin,
              playerId: assignedId,
            }));
          }
        });

        const serverMsg: ServerMessage = { type: 'ROOM_CREATED', room, playerId: assignedId };
        this.notifyHandlers(serverMsg);
        this.broadcastChannel?.postMessage(serverMsg);
        this.startPolling();
        return room;
      }
    } catch (e) {
      console.error('Lỗi gọi REST tạo phòng:', e);
    }

    // Dự phòng WebSocket
    await this.connect();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'CREATE_ROOM',
        playerName: pName,
        playerId: pId,
      }));
    }
    return null;
  }

  // Tham gia phòng đấu bằng mã PIN trực tiếp
  public async joinRoom(pin: string, playerName: string): Promise<{ success: boolean; error?: string }> {
    const cleanPin = pin.trim();
    const pName = (playerName || 'Chiến Binh Mạng').trim();
    const pId = this.currentPlayerId || `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.currentPlayerId = pId;

    try {
      const res = await fetch(`/api/rooms/${cleanPin}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: pName, playerId: pId }),
      });
      const data = await res.json();
      if (res.ok) {
        const room: RoomState = data.room || data;
        const assignedId = data.playerId || pId;
        this.currentPin = room.pin;
        this.currentPlayerId = assignedId;
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('cybertank_player_id', assignedId);
        }

        this.connect().then(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              type: 'IDENTIFY',
              pin: room.pin,
              playerId: assignedId,
            }));
          }
        });

        const serverMsg: ServerMessage = { type: 'ROOM_JOINED', room, playerId: assignedId };
        this.notifyHandlers(serverMsg);
        this.broadcastChannel?.postMessage(serverMsg);
        this.startPolling();
        return { success: true };
      } else {
        const err = data.error || 'Không thể vào phòng!';
        this.notifyHandlers({ type: 'ERROR', message: err });
        return { success: false, error: err };
      }
    } catch (e) {
      console.error('Lỗi join room:', e);
      return { success: false, error: 'Lỗi kết nối máy chủ' };
    }
  }

  // Kết nối đến WebSocket Server với cơ chế tự động kết nối lại
  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve(true);
        return;
      }

      if (this.isConnecting) {
        resolve(false);
        return;
      }

      this.isConnecting = true;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }

          if (this.currentPin && this.currentPlayerId) {
            this.ws?.send(
              JSON.stringify({
                type: 'IDENTIFY',
                pin: this.currentPin,
                playerId: this.currentPlayerId,
              })
            );
          }
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: ServerMessage = JSON.parse(event.data);
            if (msg.type === 'PONG') return;

            if (msg.type === 'ROOM_CREATED' || msg.type === 'ROOM_JOINED') {
              this.currentPin = msg.room.pin;
              this.currentPlayerId = msg.playerId;
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('cybertank_player_id', msg.playerId);
              }
              this.startPolling();
            }
            this.notifyHandlers(msg);
            this.broadcastChannel?.postMessage(msg);
          } catch (e) {
            console.error('Lỗi nhận tin nhắn socket:', e);
          }
        };

        this.ws.onerror = () => {
          this.isConnecting = false;
          this.startPolling();
          this.scheduleReconnect();
          resolve(false);
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.startPolling();
          this.scheduleReconnect();
        };
      } catch (err) {
        this.isConnecting = false;
        this.startPolling();
        this.scheduleReconnect();
        resolve(false);
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  public subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private notifyHandlers(msg: ServerMessage) {
    for (const handler of this.handlers) {
      handler(msg);
    }
  }

  // Gửi tin nhắn qua mạng (kết hợp WebSocket + REST API dự phòng toàn diện)
  public async send(msg: ClientMessage) {
    let wsSent = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
        wsSent = true;
      } catch (e) {
        wsSent = false;
      }
    }

    // Đẩy qua BroadcastChannel để tab cùng máy nhận phản hồi lập tức
    if (msg.type === 'PLAYER_MOVE') {
      this.broadcastChannel?.postMessage({
        type: 'PLAYER_MOVED',
        playerId: msg.playerId,
        x: msg.x,
        y: msg.y,
        direction: msg.direction,
      });
    } else if (msg.type === 'PLAYER_SHOOT') {
      this.broadcastChannel?.postMessage({
        type: 'BULLET_FIRED',
        bullet: msg.bullet,
      });
    } else if (msg.type === 'START_GAME') {
      this.broadcastChannel?.postMessage({
        type: 'GAME_STARTED',
        room: { pin: msg.pin, status: 'PLAYING' } as any,
      });
    }

    // NẾU WEBSOCKET CHƯA KẾT NỐI HOẶC BỊ TẮC NGHẼN -> GỬI REST API
    if (!wsSent) {
      if (msg.type === 'CREATE_ROOM') {
        try {
          const res = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName: msg.playerName, playerId: this.currentPlayerId }),
          });
          if (res.ok) {
            const data = await res.json();
            const room: RoomState = data.room || data;
            const assignedId = data.playerId || this.currentPlayerId;
            this.currentPin = room.pin;
            this.currentPlayerId = assignedId;
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('cybertank_player_id', assignedId);
            }
            const serverMsg: ServerMessage = { type: 'ROOM_CREATED', room, playerId: assignedId };
            this.notifyHandlers(serverMsg);
            this.broadcastChannel?.postMessage(serverMsg);
            this.startPolling();
          }
        } catch (e) {
          console.error('Lỗi tạo phòng qua REST:', e);
        }
      } else if (msg.type === 'JOIN_ROOM') {
        try {
          const res = await fetch(`/api/rooms/${msg.pin}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName: msg.playerName, playerId: this.currentPlayerId }),
          });
          const data = await res.json();
          if (res.ok) {
            const room: RoomState = data.room || data;
            const assignedId = data.playerId || this.currentPlayerId;
            this.currentPin = room.pin;
            this.currentPlayerId = assignedId;
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('cybertank_player_id', assignedId);
            }
            const serverMsg: ServerMessage = { type: 'ROOM_JOINED', room, playerId: assignedId };
            this.notifyHandlers(serverMsg);
            this.broadcastChannel?.postMessage(serverMsg);
            this.startPolling();
          } else {
            this.notifyHandlers({ type: 'ERROR', message: data.error || 'Không thể vào phòng' });
          }
        } catch (e) {
          console.error('Lỗi vào phòng qua REST:', e);
        }
      } else if (msg.type === 'SWITCH_TEAM' || msg.type === 'TOGGLE_READY' || msg.type === 'START_GAME') {
        if (this.currentPin && this.currentPlayerId) {
          try {
            await fetch(`/api/rooms/${msg.pin}/action`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: msg.type,
                playerId: this.currentPlayerId,
                team: msg.type === 'SWITCH_TEAM' ? msg.team : undefined,
              }),
            });
          } catch (e) {
            console.error('Lỗi action qua REST:', e);
          }
        }
      } else if (msg.type === 'PLAYER_MOVE') {
        // Gửi tọa độ qua REST sync
        this.syncMatch(msg.pin, {
          playerId: msg.playerId,
          x: msg.x,
          y: msg.y,
          direction: msg.direction,
        });
      } else if (msg.type === 'PLAYER_SHOOT') {
        this.syncMatch(msg.pin, {
          playerId: this.currentPlayerId,
          x: 0,
          y: 0,
          direction: 'RIGHT',
          newBullet: msg.bullet,
        });
      } else if (msg.type === 'HIT_BASE') {
        this.syncMatch(msg.pin, {
          playerId: this.currentPlayerId,
          x: 0,
          y: 0,
          direction: 'RIGHT',
          baseDamage: { team: msg.team, damage: msg.damage, attackerId: msg.attackerId },
        });
      } else if (msg.type === 'HIT_TANK') {
        this.syncMatch(msg.pin, {
          playerId: this.currentPlayerId,
          x: 0,
          y: 0,
          direction: 'RIGHT',
          tankDamage: { targetId: msg.targetId, damage: msg.damage, attackerId: msg.attackerId },
        });
      } else if (msg.type === 'HIT_BRICK') {
        this.syncMatch(msg.pin, {
          playerId: this.currentPlayerId,
          x: 0,
          y: 0,
          direction: 'RIGHT',
          destroyedBrick: { row: msg.row, col: msg.col },
        });
      } else if (msg.type === 'LOOT_COLLECTED') {
        this.syncMatch(msg.pin, {
          playerId: msg.playerId,
          x: 0,
          y: 0,
          direction: 'RIGHT',
          lootCollected: msg.crateId,
        });
      } else if (msg.type === 'APPLY_BUFF') {
        this.syncMatch(msg.pin, {
          playerId: msg.playerId,
          x: 0,
          y: 0,
          direction: 'RIGHT',
          appliedBuff: { rewardType: msg.rewardType, isMalware: msg.isMalware },
        });
      } else if (msg.type === 'RESTART_GAME') {
        this.requestRematch(msg.pin);
      }
    }
  }

  // Yêu cầu quay về Sảnh Chờ để tất cả máy tính cùng sẵn sàng hiệp mới
  public async requestRematch(pin: string) {
    try {
      this.send({ type: 'RESTART_GAME', pin });
      const res = await fetch(`/api/rooms/${pin}/rematch`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        this.notifyHandlers({ type: 'ROOM_UPDATE', room: data.room });
        this.broadcastChannel?.postMessage({ type: 'ROOM_UPDATE', room: data.room });
      }
    } catch (e) {
      console.error('Lỗi yêu cầu rematch:', e);
    }
  }

  // Đồng bộ trận đấu thời gian thực qua REST API (chạy song song liên tục, đảm bảo mọi máy tính đều mượt mà)
  public async syncMatch(
    pin: string,
    payload: {
      playerId: string;
      x: number;
      y: number;
      direction: Direction;
      newBullet?: Bullet;
      baseDamage?: { team: Team; damage: number; attackerId: string };
      tankDamage?: { targetId: string; damage: number; attackerId: string };
      destroyedBrick?: { row: number; col: number };
      lootCollected?: string;
      appliedBuff?: { rewardType: RewardType; isMalware: boolean };
    }
  ): Promise<any> {
    try {
      const res = await fetch(`/api/match/${pin}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // bỏ qua lỗi tạm thời
    }
    return null;
  }

  // Polling liên tục mỗi 450ms khi ở sảnh chờ để đồng bộ người chơi mới, trạng thái sẵn sàng và lệnh bắt đầu trận đấu
  public startPolling() {
    if (this.pollingTimer) return;
    this.pollingTimer = setInterval(async () => {
      if (!this.currentPin) return;
      try {
        const res = await fetch(`/api/rooms/${this.currentPin}`);
        if (res.ok) {
          const data = await res.json();
          const room: RoomState = data.room || data;
          if (room && room.pin && Array.isArray(room.players)) {
            this.notifyHandlers({ type: 'ROOM_UPDATE', room });
            if (room.status === 'PLAYING') {
              this.notifyHandlers({ type: 'GAME_STARTED', room });
            }
          }
        }
      } catch (err) {
        // bỏ qua
      }
    }, 450);
  }

  public stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}

export const networkService = new NetworkService();
