import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Direction, Bullet, Explosion, TankState, TileType } from '../types/game';

interface CyberTankCanvasProps {
  playerName: string;
  onStatsUpdate?: (stats: { bricksDestroyed: number; shotsFired: number }) => void;
}

const TILE_SIZE = 40;
const COLS = 16;
const ROWS = 13;
const CANVAS_WIDTH = COLS * TILE_SIZE; // 640
const CANVAS_HEIGHT = ROWS * TILE_SIZE; // 520
const TANK_SIZE = 28;

// Bản đồ thử nghiệm cho Mốc 1 - khu vực xuất phát hoàn toàn thông thoáng
const INITIAL_MAP: TileType[][] = [
  ['STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL'],
  ['STEEL', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'STEEL'],
  ['STEEL', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'STEEL'],
  ['STEEL', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'STEEL', 'STEEL', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'STEEL'],
  ['STEEL', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'STEEL'],
  ['STEEL', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'STEEL'],
  ['STEEL', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'BRICK', 'STEEL', 'EMPTY', 'EMPTY', 'STEEL', 'BRICK', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'STEEL'],
  ['STEEL', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'STEEL'],
  ['STEEL', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'STEEL'],
  ['STEEL', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'STEEL', 'STEEL', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'BRICK', 'EMPTY', 'STEEL'],
  ['STEEL', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'STEEL'],
  ['STEEL', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'BRICK', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'STEEL'],
  ['STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL', 'STEEL'],
];

export const CyberTankCanvas: React.FC<CyberTankCanvasProps> = ({ playerName, onStatsUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Trạng thái xe tăng (khởi đầu ở vị trí thông thoáng x=46, y=46)
  const tankRef = useRef<TankState>({
    id: 'player-1',
    name: playerName || 'Chiến Binh Mạng',
    team: 'BLUE',
    x: 46,
    y: 46,
    direction: 'RIGHT',
    speed: 3,
    health: 100,
    maxHealth: 100,
    shield: 50,
    color: '#06b6d4',
    slot: 1,
    isAlive: true,
    respawnTimer: 0,
    score: 0,
  });

  // Cập nhật tên khi prop thay đổi
  useEffect(() => {
    tankRef.current.name = playerName || 'Chiến Binh Mạng';
  }, [playerName]);

  // Trạng thái bản đồ
  const mapRef = useRef<TileType[][]>(JSON.parse(JSON.stringify(INITIAL_MAP)));
  const bulletsRef = useRef<Bullet[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const keysDownRef = useRef<{ [key: string]: boolean }>({});
  const lastShotTimeRef = useRef<number>(0);

  // Thống kê
  const [stats, setStats] = useState({ bricksDestroyed: 0, shotsFired: 0 });

  // Kiểm tra va chạm hộp (AABB)
  const isColliding = useCallback((newX: number, newY: number, size: number): boolean => {
    // Va chạm với biên sàn
    if (newX < 0 || newX + size > CANVAS_WIDTH || newY < 0 || newY + size > CANVAS_HEIGHT) {
      return true;
    }

    // Kiểm tra va chạm với các ô gạch / thép trên bản đồ
    const startCol = Math.floor(newX / TILE_SIZE);
    const endCol = Math.floor((newX + size - 1) / TILE_SIZE);
    const startRow = Math.floor(newY / TILE_SIZE);
    const endRow = Math.floor((newY + size - 1) / TILE_SIZE);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          const tile = mapRef.current[r][c];
          if (tile === 'BRICK' || tile === 'STEEL') {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  // Bắn đạn
  const fireBullet = useCallback(() => {
    const now = performance.now();
    if (now - lastShotTimeRef.current < 250) return; // Khoảng trễ bắn 250ms
    lastShotTimeRef.current = now;

    const tank = tankRef.current;
    let bx = tank.x + TANK_SIZE / 2;
    let by = tank.y + TANK_SIZE / 2;

    if (tank.direction === 'UP') by = tank.y - 4;
    else if (tank.direction === 'DOWN') by = tank.y + TANK_SIZE + 4;
    else if (tank.direction === 'LEFT') bx = tank.x - 4;
    else if (tank.direction === 'RIGHT') bx = tank.x + TANK_SIZE + 4;

    const newBullet: Bullet = {
      id: `b-${now}-${Math.random()}`,
      x: bx,
      y: by,
      direction: tank.direction,
      speed: 7,
      ownerId: tank.id,
      team: 'BLUE',
      damage: 25,
      color: '#38bdf8',
    };

    bulletsRef.current.push(newBullet);
    setStats((prev) => {
      const next = { ...prev, shotsFired: prev.shotsFired + 1 };
      onStatsUpdate?.(next);
      return next;
    });
  }, [onStatsUpdate]);

  // Xử lý sự kiện bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysDownRef.current[key] = true;

      // Phím Cách (Space) bắn đạn
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
  }, [fireBullet]);

  // Reset lại bản đồ
  const resetMap = () => {
    mapRef.current = JSON.parse(JSON.stringify(INITIAL_MAP));
    tankRef.current.x = 46;
    tankRef.current.y = 46;
    tankRef.current.direction = 'RIGHT';
    bulletsRef.current = [];
    explosionsRef.current = [];
    setStats({ bricksDestroyed: 0, shotsFired: 0 });
    onStatsUpdate?.({ bricksDestroyed: 0, shotsFired: 0 });
  };

  // Vòng lặp trò chơi (Game Loop)
  useEffect(() => {
    let animationFrameId: number;

    const updateGame = () => {
      const tank = tankRef.current;
      const keys = keysDownRef.current;

      // Di chuyển xe tăng
      let dx = 0;
      let dy = 0;
      let newDir: Direction = tank.direction;

      if (keys['w'] || keys['arrowup']) {
        dy = -tank.speed;
        newDir = 'UP';
      } else if (keys['s'] || keys['arrowdown']) {
        dy = tank.speed;
        newDir = 'DOWN';
      } else if (keys['a'] || keys['arrowleft']) {
        dx = -tank.speed;
        newDir = 'LEFT';
      } else if (keys['d'] || keys['arrowright']) {
        dx = tank.speed;
        newDir = 'RIGHT';
      }

      if (dx !== 0 || dy !== 0) {
        tank.direction = newDir;
        const targetX = tank.x + dx;
        const targetY = tank.y + dy;

        if (!isColliding(targetX, targetY, TANK_SIZE)) {
          tank.x = targetX;
          tank.y = targetY;
        } else if (dx !== 0 && !isColliding(targetX, tank.y, TANK_SIZE)) {
          tank.x = targetX;
        } else if (dy !== 0 && !isColliding(tank.x, targetY, TANK_SIZE)) {
          tank.y = targetY;
        }
      }

      // Cập nhật vị trí đạn & va chạm
      const activeBullets: Bullet[] = [];
      for (const bullet of bulletsRef.current) {
        if (bullet.direction === 'UP') bullet.y -= bullet.speed;
        else if (bullet.direction === 'DOWN') bullet.y += bullet.speed;
        else if (bullet.direction === 'LEFT') bullet.x -= bullet.speed;
        else if (bullet.direction === 'RIGHT') bullet.x += bullet.speed;

        // Ra khỏi bản đồ
        if (
          bullet.x < 0 ||
          bullet.x > CANVAS_WIDTH ||
          bullet.y < 0 ||
          bullet.y > CANVAS_HEIGHT
        ) {
          continue;
        }

        // Va chạm với gạch hoặc thép
        const tileCol = Math.floor(bullet.x / TILE_SIZE);
        const tileRow = Math.floor(bullet.y / TILE_SIZE);

        let hit = false;
        if (tileRow >= 0 && tileRow < ROWS && tileCol >= 0 && tileCol < COLS) {
          const tile = mapRef.current[tileRow][tileCol];

          if (tile === 'BRICK') {
            // Phá hủy gạch
            mapRef.current[tileRow][tileCol] = 'EMPTY';
            hit = true;
            setStats((prev) => {
              const next = { ...prev, bricksDestroyed: prev.bricksDestroyed + 1 };
              onStatsUpdate?.(next);
              return next;
            });
            // Thêm hiệu ứng nổ nhỏ
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
            // Thép không vỡ, chỉ tạo tia lửa
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
          }
        }

        if (!hit) {
          activeBullets.push(bullet);
        }
      }
      bulletsRef.current = activeBullets;

      // Cập nhật hiệu ứng nổ
      explosionsRef.current = explosionsRef.current
        .map((exp) => ({
          ...exp,
          radius: exp.radius + (exp.maxRadius - exp.radius) * 0.2,
          life: exp.life - 0.08,
        }))
        .filter((exp) => exp.life > 0);

      // Vẽ lên Canvas
      renderCanvas();
      animationFrameId = requestAnimationFrame(updateGame);
    };

    // Hàm vẽ đồ họa
    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Xóa màn hình nền Cyber Dark
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Vẽ lưới radar nhẹ nền
      ctx.strokeStyle = '#1e293b';
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

      // 2. Vẽ bản đồ (Tường gạch và Tường thép)
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const tile = mapRef.current[r][c];
          const px = c * TILE_SIZE;
          const py = r * TILE_SIZE;

          if (tile === 'BRICK') {
            // Tường bảo mật (gạch cyberpunk)
            ctx.fillStyle = '#b45309';
            ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);

            // Vân bảo mật
            ctx.fillStyle = '#d97706';
            ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);

            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12);
          } else if (tile === 'STEEL') {
            // Tường thép (Tường lửa kiên cố)
            ctx.fillStyle = '#334155';
            ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);

            // Khối kim loại sáng
            ctx.fillStyle = '#64748b';
            ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);

            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          }
        }
      }

      // 3. Vẽ đạn
      for (const bullet of bulletsRef.current) {
        ctx.save();
        ctx.shadowColor = bullet.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. Vẽ hiệu ứng nổ
      for (const exp of explosionsRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, exp.life);
        ctx.shadowColor = exp.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = exp.color;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 5. Vẽ xe tăng người chơi
      const tank = tankRef.current;
      ctx.save();
      ctx.translate(tank.x + TANK_SIZE / 2, tank.y + TANK_SIZE / 2);

      // Quay theo hướng
      let angle = 0;
      if (tank.direction === 'DOWN') angle = Math.PI;
      else if (tank.direction === 'LEFT') angle = -Math.PI / 2;
      else if (tank.direction === 'RIGHT') angle = Math.PI / 2;
      ctx.rotate(angle);

      // Thân xe (Chassis)
      ctx.shadowColor = tank.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-TANK_SIZE / 2 + 2, -TANK_SIZE / 2 + 2, TANK_SIZE - 4, TANK_SIZE - 4);

      // Bánh xích 2 bên
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-TANK_SIZE / 2, -TANK_SIZE / 2, 6, TANK_SIZE);
      ctx.fillRect(TANK_SIZE / 2 - 6, -TANK_SIZE / 2, 6, TANK_SIZE);

      // Tháp pháo trung tâm
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // Nòng pháo
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-2.5, -TANK_SIZE / 2 - 4, 5, TANK_SIZE / 2 + 4);

      ctx.restore();

      // Tên hiển thị trên đầu xe
      ctx.fillStyle = '#38bdf8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tank.name, tank.x + TANK_SIZE / 2, tank.y - 8);
    };

    animationFrameId = requestAnimationFrame(updateGame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isColliding, onStatsUpdate]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative border-2 border-cyan-500/50 rounded-lg overflow-hidden shadow-[0_0_25px_rgba(6,182,212,0.25)] bg-slate-950">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block cursor-crosshair"
        />

        {/* HUD góc trên Canvas */}
        <div className="absolute top-2 left-2 flex items-center gap-3 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded border border-cyan-500/30 text-xs text-slate-200">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="font-semibold text-cyan-400">{tankRef.current.name}</span>
          </span>
          <span className="text-slate-400">|</span>
          <span>Đạn đã bắn: <strong className="text-white">{stats.shotsFired}</strong></span>
          <span className="text-slate-400">|</span>
          <span>Gạch đã phá: <strong className="text-amber-400">{stats.bricksDestroyed}</strong></span>
        </div>

        <button
          onClick={resetMap}
          className="absolute top-2 right-2 bg-slate-800/90 hover:bg-slate-700 text-xs px-2.5 py-1 rounded border border-slate-600 text-slate-300 hover:text-white transition cursor-pointer"
        >
          Đặt lại bản đồ
        </button>
      </div>

      {/* Bảng điều khiển cảm ứng / chuột hỗ trợ song song bàn phím */}
      <div className="flex items-center justify-between w-full max-w-[640px] px-2 py-1 bg-slate-900/50 rounded-lg border border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-semibold">Phím ảo:</span>
          <div className="grid grid-cols-3 gap-1 w-28">
            <div />
            <button
              onMouseDown={() => { keysDownRef.current['w'] = true; }}
              onMouseUp={() => { keysDownRef.current['w'] = false; }}
              onMouseLeave={() => { keysDownRef.current['w'] = false; }}
              onTouchStart={() => { keysDownRef.current['w'] = true; }}
              onTouchEnd={() => { keysDownRef.current['w'] = false; }}
              className="py-1.5 bg-slate-800 hover:bg-cyan-600 active:bg-cyan-500 rounded text-slate-200 font-bold text-center border border-slate-700 select-none cursor-pointer text-xs"
              title="Lên (W / Phím Lên)"
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
              title="Trái (A / Phím Trái)"
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
              title="Xuống (S / Phím Xuống)"
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
              title="Phải (D / Phím Phải)"
            >
              ▶
            </button>
          </div>
        </div>

        <button
          onClick={fireBullet}
          className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-bold rounded-lg border border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.35)] cursor-pointer text-xs uppercase tracking-wider select-none transition"
        >
          💥 BẮN ĐẠN (SPACE)
        </button>
      </div>

      {/* Điều khiển phím tắt bàn phím máy tính */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
        <span className="font-semibold text-cyan-300">Phím tắt:</span>
        <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded font-mono">W / A / S / D</span>
        <span>hoặc</span>
        <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded font-mono">↑ / ← / ↓ / →</span>
        <span>để di chuyển xe</span>
        <span className="text-slate-500">|</span>
        <span className="bg-slate-800 text-cyan-300 px-2 py-0.5 rounded font-mono font-bold">Phím Cách (Space)</span>
        <span>để bắn đạn nổ</span>
      </div>
    </div>
  );
};
