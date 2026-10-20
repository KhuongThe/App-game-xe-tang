import React, { useState, useEffect } from 'react';
import { CyberTankCanvas } from './components/CyberTankCanvas';
import { LobbyView } from './components/LobbyView';
import { BattleCityArena } from './components/BattleCityArena';
import { RoomState } from './types/multiplayer';
import { networkService } from './services/network';
import { sound } from './services/soundEffects';
import { Shield, Users, Gamepad2, Swords, Trophy, Volume2, VolumeX, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [playerName, setPlayerName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cybertank_player_name') || 'Chiến Binh Mạng';
    }
    return 'Chiến Binh Mạng';
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName);
  const [activeTab, setActiveTab] = useState<'LOBBY' | 'MATCH' | 'PRACTICE'>('LOBBY');
  const [activeRoom, setActiveRoom] = useState<RoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>(() => networkService.getPlayerId());
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.getIsMuted());

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      const trimmed = tempName.trim();
      setPlayerName(trimmed);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cybertank_player_name', trimmed);
      }
      setIsEditingName(false);
    }
  };

  const handleGameStart = (room: RoomState, playerId: string) => {
    setActiveRoom(room);
    setMyPlayerId(playerId || networkService.getPlayerId());
    setActiveTab('MATCH');
  };

  const handleExitMatch = () => {
    setActiveTab('LOBBY');
  };

  // Mẫu phòng thử nghiệm nhanh nếu chưa tạo phòng
  const fallbackRoom: RoomState = activeRoom || {
    pin: 'DEMO',
    hostId: myPlayerId,
    status: 'PLAYING',
    maxPlayers: 4,
    players: [
      { id: myPlayerId, name: playerName, team: 'BLUE', slot: 1, isHost: true, ready: true },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Thanh tiêu đề hiện đại */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                  CYBERTANK
                </h1>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Battle City An Ninh Mạng
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Game xe tăng 2 vs 2 rèn luyện kỹ năng an toàn thông tin
              </p>
            </div>
          </div>

          {/* Khu vực thông tin người chơi & Chuyển Tab */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab('LOBBY')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'LOBBY'
                    ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)] font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Sảnh Đấu 4 Người</span>
              </button>

              {activeRoom && activeRoom.status === 'PLAYING' && (
                <button
                  onClick={() => setActiveTab('MATCH')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'MATCH'
                      ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)] font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>Trận Đấu Đang Diễn Ra</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('PRACTICE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'PRACTICE'
                    ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)] font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Tập Lái Đơn</span>
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-lg">
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    maxLength={15}
                    className="bg-slate-900 border border-cyan-500/50 rounded px-2 py-0.5 text-xs text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="bg-cyan-600 hover:bg-cyan-500 text-black font-semibold text-xs px-2.5 py-0.5 rounded transition cursor-pointer"
                  >
                    Lưu
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Tên:</span>
                  <span className="text-xs font-semibold text-cyan-400 font-mono">
                    {playerName}
                  </span>
                  <button
                    onClick={() => {
                      setTempName(playerName);
                      setIsEditingName(true);
                    }}
                    className="text-[11px] text-slate-400 hover:text-cyan-300 underline underline-offset-2 ml-1 cursor-pointer"
                  >
                    Đổi
                  </button>
                </div>
              )}
            </div>

            {/* Bật/Tắt âm thanh toàn app (Mốc 5) */}
            <button
              onClick={() => {
                const muted = sound.toggleMute();
                setIsMuted(muted);
              }}
              title={isMuted ? "Bật âm thanh Web Audio" : "Tắt âm thanh"}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                isMuted
                  ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  : 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/60 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              }`}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-500" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
              <span className="hidden sm:inline font-mono">{isMuted ? 'Muted' : 'Audio On'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Nội dung chính */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 flex flex-col items-center">
        {/* Banner tiến độ Mốc 5 Hoàn Thiện */}
        <div className="w-full max-w-4xl bg-gradient-to-r from-emerald-950/50 via-cyan-950/40 to-blue-950/50 border border-emerald-500/50 rounded-xl p-3.5 mb-5 flex flex-wrap items-center justify-between gap-4 shadow-[0_0_25px_rgba(16,185,129,0.18)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-slate-950 font-bold shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              <Trophy className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Mốc 5: Hoàn Thiện Luật Thi Đấu, Âm Thanh & Vinh Danh Hiệp Sĩ An Ninh Mạng
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Đầy Đủ Tính Năng
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Hiệp đấu 180s kịch tính • Âm thanh Web Audio 8-bit sống động • Bảng tổng kết vinh danh Cyber MVP • Chơi lại ván mới liền mạch.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-emerald-900/70 text-emerald-200 border border-emerald-600/60 px-3 py-1 rounded-lg font-bold shadow-sm">
              MỐC 5/5
            </span>
          </div>
        </div>

        {/* Chuyển đổi nội dung theo tab */}
        {activeTab === 'LOBBY' ? (
          <LobbyView
            initialRoom={activeRoom}
            playerName={playerName}
            onNameChange={(name) => {
              setPlayerName(name);
              if (typeof window !== 'undefined') {
                localStorage.setItem('cybertank_player_name', name);
              }
            }}
            onGameStart={handleGameStart}
            onRoomUpdate={(room, pid) => {
              setActiveRoom(room);
              if (pid) setMyPlayerId(pid);
            }}
          />
        ) : activeTab === 'MATCH' ? (
          <div className="w-full flex flex-col items-center">
            <BattleCityArena
              room={fallbackRoom}
              myPlayerId={myPlayerId}
              playerName={playerName}
              onExitMatch={handleExitMatch}
            />
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            <CyberTankCanvas playerName={playerName} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-3 text-center text-xs text-slate-600">
        CyberTank: Battle City An Ninh Mạng • Dành cho học sinh & người học an toàn thông tin
      </footer>
    </div>
  );
}
