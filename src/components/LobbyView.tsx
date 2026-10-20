import React, { useState, useEffect } from 'react';
import { RoomState, Team, RoomPlayer } from '../types/multiplayer';
import { networkService } from '../services/network';
import { sound } from '../services/soundEffects';
import { Users, Copy, Check, Shield, Swords, LogOut, Play, Share2, Link as LinkIcon, AlertCircle, Volume2, VolumeX } from 'lucide-react';

interface LobbyViewProps {
  initialRoom?: RoomState | null;
  playerName: string;
  onNameChange: (name: string) => void;
  onGameStart: (room: RoomState, myPlayerId: string) => void;
  onRoomUpdate?: (room: RoomState, myPlayerId: string) => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  initialRoom,
  playerName,
  onNameChange,
  onGameStart,
  onRoomUpdate,
}) => {
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(initialRoom || null);
  const [myPlayerId, setMyPlayerId] = useState<string>(networkService.getPlayerId());
  const [joinPin, setJoinPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [invitedPin, setInvitedPin] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getIsMuted());

  // Đồng bộ initialRoom nếu có từ App component
  useEffect(() => {
    if (initialRoom && !currentRoom) {
      setCurrentRoom(initialRoom);
    }
  }, [initialRoom]);

  // Tự động nhận diện mã PIN từ URL khi máy khác mở link
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPin = params.get('pin');
      if (urlPin && urlPin.length === 4) {
        setJoinPin(urlPin);
        setInvitedPin(urlPin);
      }
    }
  }, []);

  useEffect(() => {
    networkService.connect();

    const unsubscribe = networkService.subscribe((msg) => {
      if (msg.type === 'ROOM_CREATED' || msg.type === 'ROOM_JOINED') {
        if (msg.room && msg.room.pin) {
          setCurrentRoom(msg.room);
          setMyPlayerId(msg.playerId);
          networkService.setPlayerId(msg.playerId);
          networkService.setPin(msg.room.pin);
          setErrorMsg(null);
          onRoomUpdate?.(msg.room, msg.playerId);
        }
      } else if (msg.type === 'ROOM_UPDATE') {
        if (msg.room && msg.room.pin && Array.isArray(msg.room.players)) {
          setCurrentRoom(msg.room);
          const pid = myPlayerId || networkService.getPlayerId();
          onRoomUpdate?.(msg.room, pid);
          // Khi chủ phòng bấm bắt đầu, tất cả máy khác lập tức vào game đồng loạt
          if (msg.room.status === 'PLAYING') {
            sound.playSuperShoot();
            onGameStart(msg.room, pid);
          }
        }
      } else if (msg.type === 'GAME_STARTED') {
        if (msg.room && msg.room.pin) {
          setCurrentRoom(msg.room);
          const pid = myPlayerId || networkService.getPlayerId();
          sound.playSuperShoot();
          onGameStart(msg.room, pid);
        }
      } else if (msg.type === 'ERROR') {
        setErrorMsg(msg.message);
        setTimeout(() => setErrorMsg(null), 4000);
      }
    });

    return () => unsubscribe();
  }, [myPlayerId, onGameStart, onRoomUpdate]);

  const handleCreateRoom = async () => {
    setConnecting(true);
    setErrorMsg(null);
    try {
      const room = await networkService.createRoom(playerName || 'Chiến Binh Mạng');
      if (room) {
        setCurrentRoom(room);
        const pid = networkService.getPlayerId();
        setMyPlayerId(pid);
        onRoomUpdate?.(room, pid);
      }
    } catch (err: any) {
      console.error('Lỗi tạo phòng:', err);
      setErrorMsg('Không thể khởi tạo phòng. Vui lòng thử lại!');
    } finally {
      setConnecting(false);
    }
  };

  const handleJoinRoom = async (e?: React.FormEvent, customPin?: string) => {
    if (e) e.preventDefault();
    const targetPin = (customPin || joinPin.trim() || invitedPin || '').trim();
    if (!targetPin) return;
    setConnecting(true);
    setErrorMsg(null);
    try {
      const result = await networkService.joinRoom(targetPin, playerName || 'Chiến Binh Mạng');
      if (!result.success) {
        setErrorMsg(result.error || 'Không thể tham gia phòng. Vui lòng kiểm tra lại mã PIN!');
      } else {
        setInvitedPin(null);
      }
    } catch (err: any) {
      console.error('Lỗi vào phòng:', err);
      setErrorMsg('Lỗi kết nối phòng');
    } finally {
      setConnecting(false);
    }
  };

  const handleSwitchTeam = (team: Team) => {
    if (!currentRoom) return;
    networkService.send({
      type: 'SWITCH_TEAM',
      pin: currentRoom.pin,
      team,
    });
  };

  const handleToggleReady = () => {
    if (!currentRoom) return;
    sound.playQuizCorrect();
    networkService.send({
      type: 'TOGGLE_READY',
      pin: currentRoom.pin,
    });
  };

  const handleStartGame = () => {
    if (!currentRoom) return;
    networkService.send({
      type: 'START_GAME',
      pin: currentRoom.pin,
    });
  };

  const handleLeaveRoom = () => {
    if (!currentRoom) return;
    networkService.send({
      type: 'LEAVE_ROOM',
      pin: currentRoom.pin,
    });
    setCurrentRoom(null);
  };

  const copyPin = () => {
    if (currentRoom) {
      navigator.clipboard.writeText(currentRoom.pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  // Tạo liên kết mời công khai chuẩn, mở được trên mọi máy tính và điện thoại
  const inviteUrl = currentRoom ? networkService.getPublicInviteUrl(currentRoom.pin) : '';

  const copyInviteLink = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const roomPlayers = currentRoom?.players || [];
  const effectiveId = myPlayerId || networkService.getPlayerId();
  const myPlayer = roomPlayers.find((p) => p.id === effectiveId)
    || (currentRoom?.hostId && roomPlayers.find((p) => p.id === currentRoom.hostId))
    || roomPlayers[0];
  const isHost = myPlayer?.isHost ?? (currentRoom?.hostId === effectiveId);

  const bluePlayers = roomPlayers.filter((p) => p.team === 'BLUE');
  const redPlayers = roomPlayers.filter((p) => p.team === 'RED');

  // Kiểm tra xem tất cả người chơi khác đã sẵn sàng chưa
  const otherPlayers = roomPlayers.filter((p) => !p.isHost);
  const allOthersReady = otherPlayers.length > 0 && otherPlayers.every((p) => p.ready);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      {/* Banner nếu nhận được link mời từ máy khác */}
      {invitedPin && !currentRoom && (
        <div className="w-full mb-5 bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-500 p-4 rounded-xl flex items-center justify-between gap-4 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎮</span>
            <div>
              <p className="text-xs font-bold text-cyan-300">
                Bạn nhận được lời mời tham chiến vào phòng <strong className="font-mono text-white text-sm">#{invitedPin}</strong>!
              </p>
              <p className="text-[11px] text-slate-300">
                Tên của bạn là <strong className="text-cyan-400">{playerName}</strong>. Bấm nút dưới đây để bước vào sảnh ngay.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleJoinRoom(undefined, invitedPin)}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase rounded-lg shadow cursor-pointer shrink-0"
          >
            Vào phòng ngay
          </button>
        </div>
      )}

      {/* Thông báo lỗi nếu có */}
      {errorMsg && (
        <div className="w-full mb-4 bg-red-950/80 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm animate-pulse">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Ô nhập tên người chơi nổi bật */}
      <div className="w-full mb-5 bg-slate-900/90 border border-cyan-500/40 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 text-lg shadow-[0_0_10px_rgba(6,182,212,0.3)]">
            🪪
          </div>
          <div>
            <label className="text-xs text-slate-300 font-bold block">
              Tên chiến binh của bạn (hiển thị trên đầu xe):
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => onNameChange(e.target.value)}
              maxLength={15}
              placeholder="Nhập tên của bạn (VD: Nam, Quân, Linh...)"
              className="mt-1 bg-slate-950 border border-cyan-500/60 rounded-lg px-3 py-1.5 text-sm font-bold text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 min-w-[240px]"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">
            Tên: <strong className="text-cyan-400 font-bold font-mono">{playerName}</strong>
          </div>
          <button
            onClick={() => {
              const m = sound.toggleMute();
              setIsMuted(m);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-xs text-slate-300 cursor-pointer transition select-none"
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-red-400" />
                <span>Âm thanh: TẮT</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Âm thanh: BẬT</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!currentRoom ? (
        /* Màn hình khởi tạo phòng hoặc vào phòng */
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/40 p-6 md:p-8 rounded-2xl border border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          {/* Cột 1: Tạo phòng mới */}
          <div className="flex flex-col justify-between bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-xl border border-cyan-500/30">
            <div>
              <div className="w-12 h-12 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Tạo phòng đấu mới</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Tạo một phòng 4 người (2 vs 2). Bạn sẽ nhận được <strong>Mã PIN 4 số</strong> và <strong>Link mời trực tiếp</strong> để gửi sang bất kỳ máy tính hoặc điện thoại nào cùng chơi!
              </p>
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={connecting}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-black font-bold text-sm rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.4)] transition cursor-pointer disabled:opacity-50"
            >
              {connecting ? 'Đang tạo phòng...' : '⚡ TẠO PHÒNG NGAY'}
            </button>
          </div>

          {/* Cột 2: Vào phòng bằng mã PIN */}
          <div className="flex flex-col justify-between bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-xl border border-red-500/30">
            <div>
              <div className="w-12 h-12 rounded-lg bg-red-950 border border-red-500/50 flex items-center justify-center text-red-400 mb-4 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                <Swords className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Tham gia phòng có sẵn</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Nếu bạn bè đã tạo phòng trên máy khác, hãy nhập mã PIN 4 chữ số do bạn bè gửi:
              </p>

              <form onSubmit={handleJoinRoom} className="space-y-3">
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Nhập mã PIN (VD: 8492)"
                  value={joinPin}
                  onChange={(e) => setJoinPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.3em] font-mono text-xl py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  disabled={joinPin.length !== 4 || connecting}
                  className="w-full py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.4)] transition cursor-pointer disabled:opacity-50"
                >
                  {connecting ? 'Đang kết nối...' : '👉 VÀO PHÒNG CHƠI'}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* Màn hình Sảnh Chờ (Lobby) 4 người */
        <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.6)] backdrop-blur">
          {/* Header phòng: Mã PIN và Cách mời máy khác */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">MÃ PHÒNG:</span>
              <div className="flex items-center gap-2 bg-slate-950 border border-cyan-500/50 px-3 py-1.5 rounded-lg">
                <span className="font-mono text-xl font-black text-cyan-300 tracking-widest">
                  {currentRoom.pin}
                </span>
                <button
                  onClick={copyPin}
                  className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
                  title="Sao chép mã PIN"
                >
                  {copiedPin ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Nút sao chép link mời bạn bè gửi sang máy khác */}
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-1.5 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/50 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Đã chép link mời!' : 'Sao chép link gửi máy khác'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Số người: <strong className="text-white">{roomPlayers.length}/4</strong></span>
              </div>

              <button
                onClick={handleLeaveRoom}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Rời phòng</span>
              </button>
            </div>
          </div>

          {/* Hướng dẫn và ô hiển thị link phòng chơi trực tiếp */}
          <div className="my-4 bg-slate-950/90 border border-cyan-800/50 p-4 rounded-xl text-xs text-slate-300 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <LinkIcon className="w-4 h-4 shrink-0" />
                <span>Link vào phòng chơi trực tiếp:</span>
              </div>
              <span className="text-[11px] text-amber-300 font-mono bg-amber-950/60 border border-amber-600/40 px-2 py-0.5 rounded">
                Mã PIN: {currentRoom.pin}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 select-all focus:outline-none"
              />
              <button
                onClick={copyInviteLink}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black rounded-lg shrink-0 cursor-pointer transition shadow-[0_0_15px_rgba(6,182,212,0.3)] text-xs uppercase"
              >
                {copiedLink ? '✓ ĐÃ CHÉP LINK' : 'SAO CHÉP LINK'}
              </button>
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <div>
                👉 <strong>Cách 1 (Mở nhanh trên máy này):</strong> Bấm <em>Sao chép link</em> ở trên, mở thêm một <strong>Tab mới</strong> trên trình duyệt này và dán vào là 2 xe vào chung sảnh ngay!
              </div>
              <div>
                👉 <strong>Cách 2 (Nhập mã PIN):</strong> Người chơi khác chỉ cần vào trang game và nhập 4 số PIN <strong className="text-cyan-300 font-mono">#{currentRoom.pin}</strong> vào ô <em>Tham gia phòng có sẵn</em>.
              </div>
            </div>
          </div>

          {/* 2 Phe: Đội Xanh vs Đội Đỏ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
            {/* ĐỘI XANH */}
            <div className="bg-gradient-to-b from-cyan-950/40 to-slate-950 p-5 rounded-xl border border-cyan-500/40">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></div>
                  <h4 className="font-bold text-cyan-300 text-sm tracking-wide">
                    ĐỘI XANH (BẢO VỆ SERVER TRÁI)
                  </h4>
                </div>
                <span className="text-xs text-cyan-400/80 font-mono">
                  {bluePlayers.length}/2
                </span>
              </div>

              {/* Danh sách người chơi Đội Xanh */}
              <div className="space-y-2 mb-4">
                {[0, 1].map((index) => {
                  const p = bluePlayers[index];
                  const isCurrentMe = Boolean(p && (p.id === effectiveId || (p.isHost && isHost && roomPlayers.length === 1)));
                  return (
                    <div
                      key={p ? p.id : `empty-blue-${index}`}
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        p
                          ? isCurrentMe
                            ? 'bg-cyan-950/80 border-cyan-400'
                            : 'bg-slate-900/90 border-cyan-900/60'
                          : 'bg-slate-950/50 border-dashed border-slate-800 text-slate-600'
                      }`}
                    >
                      {p ? (
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">🚜</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                {p.name} {isCurrentMe && '(Bạn)'}
                              </span>
                              {p.isHost && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-semibold">
                                  Chủ phòng
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">Vị trí: Cổng Bắc</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs italic">Đang chờ người chơi...</span>
                      )}

                      {p && (
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded font-mono font-bold ${
                            p.ready
                              ? 'bg-green-950 text-green-400 border border-green-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {p.ready ? '✓ Sẵn sàng' : 'Chưa sẵn sàng'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {myPlayer?.team !== 'BLUE' && bluePlayers.length < 2 && (
                <button
                  onClick={() => handleSwitchTeam('BLUE')}
                  className="w-full py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 text-xs font-semibold rounded border border-cyan-700/60 transition cursor-pointer"
                >
                  Chuyển sang Đội Xanh
                </button>
              )}
            </div>

            {/* ĐỘI ĐỎ */}
            <div className="bg-gradient-to-b from-red-950/40 to-slate-950 p-5 rounded-xl border border-red-500/40">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400 shadow-[0_0_8px_#f87171]"></div>
                  <h4 className="font-bold text-red-300 text-sm tracking-wide">
                    ĐỘI ĐỎ (BẢO VỆ SERVER PHẢI)
                  </h4>
                </div>
                <span className="text-xs text-red-400/80 font-mono">
                  {redPlayers.length}/2
                </span>
              </div>

              {/* Danh sách người chơi Đội Đỏ */}
              <div className="space-y-2 mb-4">
                {[0, 1].map((index) => {
                  const p = redPlayers[index];
                  const isCurrentMe = Boolean(p && (p.id === effectiveId || (p.isHost && isHost && roomPlayers.length === 1)));
                  return (
                    <div
                      key={p ? p.id : `empty-red-${index}`}
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        p
                          ? isCurrentMe
                            ? 'bg-red-950/80 border-red-400'
                            : 'bg-slate-900/90 border-red-900/60'
                          : 'bg-slate-950/50 border-dashed border-slate-800 text-slate-600'
                      }`}
                    >
                      {p ? (
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">🚜</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                {p.name} {isCurrentMe && '(Bạn)'}
                              </span>
                              {p.isHost && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-semibold">
                                  Chủ phòng
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">Vị trí: Cổng Nam</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs italic">Đang chờ người chơi...</span>
                      )}

                      {p && (
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded font-mono font-bold ${
                            p.ready
                              ? 'bg-green-950 text-green-400 border border-green-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {p.ready ? '✓ Sẵn sàng' : 'Chưa sẵn sàng'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {myPlayer?.team !== 'RED' && redPlayers.length < 2 && (
                <button
                  onClick={() => handleSwitchTeam('RED')}
                  className="w-full py-1.5 bg-red-950 hover:bg-red-900 text-red-300 text-xs font-semibold rounded border border-red-700/60 transition cursor-pointer"
                >
                  Chuyển sang Đội Đỏ
                </button>
              )}
            </div>
          </div>

          {/* Thanh tác vụ dưới: Bấm Sẵn sàng & Bắt đầu */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-3">
              {!isHost && (
                <button
                  onClick={handleToggleReady}
                  className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer shadow ${
                    myPlayer?.ready
                      ? 'bg-amber-600 hover:bg-amber-500 text-black'
                      : 'bg-green-500 hover:bg-green-400 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                  }`}
                >
                  {myPlayer?.ready ? '❌ HỦY SẴN SÀNG' : '✓ BẤM SẴN SÀNG'}
                </button>
              )}
              <span className="text-xs text-slate-400">
                {isHost
                  ? otherPlayers.length === 0
                    ? 'Bạn có thể bắt đầu chơi một mình hoặc đợi máy khác vào.'
                    : allOthersReady
                    ? 'Tất cả các máy đã sẵn sàng! Bấm nút bên phải để bắt đầu hiệp đấu.'
                    : 'Đang đợi tất cả người chơi khác bấm Sẵn sàng...'
                  : myPlayer?.ready
                  ? 'Bạn đã sẵn sàng! Đang đợi chủ phòng bấm Bắt đầu...'
                  : 'Vui lòng bấm nút "BẤM SẴN SÀNG" để chủ phòng có thể bắt đầu hiệp mới.'}
              </span>
            </div>

            {isHost && (
              <button
                onClick={handleStartGame}
                disabled={otherPlayers.length > 0 && !allOthersReady}
                className={`flex items-center gap-2 px-7 py-3 font-black text-xs uppercase tracking-wider rounded-lg transition active:scale-95 ${
                  otherPlayers.length === 0 || allOthersReady
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.5)] cursor-pointer'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>BẮT ĐẦU HIỆP MỚI</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
