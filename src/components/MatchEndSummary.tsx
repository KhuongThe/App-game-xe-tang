import React from 'react';
import { Team, RoomPlayer } from '../types/multiplayer';
import { PlayerMatchStats } from '../types/game';
import { Trophy, AlertTriangle, Crown, Award, Shield, Zap, Sparkles, RefreshCw, Star } from 'lucide-react';

interface MatchEndSummaryProps {
  winner: Team;
  myTeam: Team;
  winReason?: 'BASE_DESTROYED' | 'TIMEOUT';
  players: RoomPlayer[];
  stats?: { [playerId: string]: PlayerMatchStats };
  mvpPlayerId?: string;
  onRematch: () => void;
}

export const MatchEndSummary: React.FC<MatchEndSummaryProps> = ({
  winner,
  myTeam,
  winReason,
  players,
  stats,
  mvpPlayerId,
  onRematch,
}) => {
  const isWinner = winner === myTeam;

  // Lập danh sách thống kê người chơi và sắp xếp theo tổng điểm
  const safePlayers = players || [];
  const playerStatsList: PlayerMatchStats[] = safePlayers.map((p) => {
    if (stats && stats[p.id]) {
      return stats[p.id];
    }
    return {
      playerId: p.id,
      name: p.name,
      team: p.team,
      damageDealt: 0,
      bricksDestroyed: 0,
      cyberCorrect: 0,
      cyberAttempts: 0,
      kills: 0,
      totalScore: 0,
      isMvp: p.id === mvpPlayerId,
    };
  }).sort((a, b) => b.totalScore - a.totalScore);

  const mvp = playerStatsList.find((p) => p.playerId === mvpPlayerId) || playerStatsList[0];

  const getCyberTitle = (correct: number, damage: number): string => {
    if (correct >= 3) return 'Đại Sứ An Ninh Mạng Cấp Cao';
    if (correct >= 2) return 'Chuyên Gia Tường Lửa & 2FA';
    if (correct >= 1) return 'Chiến Binh Phòng Chống Phishing';
    if (damage >= 80) return 'Pháo Thủ Xuyên Phá Căn Cứ';
    return 'Tân Binh Bảo Vệ Không Gian Mạng';
  };

  return (
    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-lg flex flex-col items-center justify-center p-4 z-40 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border-2 border-cyan-500/60 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.35)] p-5 md:p-6 text-center my-auto">
        
        {/* Banner Thắng / Thua */}
        {isWinner ? (
          <div className="mb-4">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 items-center justify-center text-amber-300 mb-2 shadow-[0_0_30px_rgba(251,191,36,0.5)]">
              <Trophy className="w-9 h-9 animate-bounce" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 uppercase">
              🏆 CHIẾN THẮNG TUYỆT ĐỐI!
            </h2>
            <p className="text-xs md:text-sm text-amber-100/90 mt-1">
              {winReason === 'TIMEOUT' ? (
                <span>⏰ <strong>Hết giờ thi đấu (180s):</strong> Căn cứ Server của <strong>{myTeam === 'BLUE' ? 'Phe Xanh' : 'Phe Đỏ'}</strong> được bảo toàn an toàn hơn đối phương!</span>
              ) : (
                <span>⚡ <strong>Hạ gục Máy chủ Căn cứ:</strong> Đội của bạn đã triệt hạ thành công hệ thống dữ liệu đối phương!</span>
              )}
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-red-950/80 border-2 border-red-500 items-center justify-center text-red-400 mb-2 shadow-[0_0_30px_rgba(239,68,68,0.5)]">
              <AlertTriangle className="w-9 h-9 animate-pulse" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-300 to-red-500 uppercase">
              💀 THẤT BẠI TRẬN NÀY (GAME OVER)
            </h2>
            <p className="text-xs md:text-sm text-red-200/90 mt-1">
              {winReason === 'TIMEOUT' ? (
                <span>⏰ <strong>Hết giờ thi đấu:</strong> Máy chủ <strong>{myTeam === 'BLUE' ? 'Phe Xanh' : 'Phe Đỏ'}</strong> chịu nhiều tổn thất an ninh mạng hơn. Hãy phục thù ở hiệp kế tiếp!</span>
              ) : (
                <span>⚠️ <strong>Căn cứ Server bị phá hủy:</strong> Hàng rào an ninh mạng đã bị xuyên thủng!</span>
              )}
            </p>
          </div>
        )}

        {/* Khối Vinh Danh MVP */}
        {mvp && (
          <div className="mb-5 bg-gradient-to-r from-amber-950/50 via-slate-900 to-yellow-950/50 border border-amber-500/60 rounded-xl p-3.5 text-left relative overflow-hidden shadow-lg">
            <div className="absolute -right-3 -top-3 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 shadow">
                  <Crown className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500 text-black font-mono">
                      👑 MVP TRẬN ĐẤU
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      mvp.team === 'BLUE' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-red-950 text-red-400 border border-red-800'
                    }`}>
                      {mvp.team === 'BLUE' ? 'Phe Xanh' : 'Phe Đỏ'}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-amber-200 mt-0.5">{mvp.name}</h4>
                  <p className="text-[11px] text-amber-300/80 font-medium">{getCyberTitle(mvp.cyberCorrect, mvp.damageDealt)}</p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xl font-black text-amber-400 font-mono">{mvp.totalScore}</div>
                <div className="text-[10px] text-amber-300 uppercase tracking-wider font-semibold">Tổng điểm</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-amber-500/30 text-center text-xs">
              <div className="bg-slate-950/60 rounded p-1">
                <span className="text-slate-400 block text-[10px]">An ninh đúng</span>
                <span className="font-bold text-cyan-300">🎯 {mvp.cyberCorrect} câu</span>
              </div>
              <div className="bg-slate-950/60 rounded p-1">
                <span className="text-slate-400 block text-[10px]">Sát thương</span>
                <span className="font-bold text-red-400">💥 {mvp.damageDealt} HP</span>
              </div>
              <div className="bg-slate-950/60 rounded p-1">
                <span className="text-slate-400 block text-[10px]">Phá gạch</span>
                <span className="font-bold text-amber-300">🧱 {mvp.bricksDestroyed} ô</span>
              </div>
            </div>
          </div>
        )}

        {/* Bảng Chi Tiết Điểm Số Cả Phòng */}
        <div className="mb-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 text-left">
          <div className="bg-slate-800/80 px-3 py-2 text-xs font-bold text-slate-300 flex items-center justify-between border-b border-slate-700">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-cyan-400" />
              <span>BẢNG TỔNG KẾT CHIẾN BINH AN NINH MẠNG</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Hiệp đấu 180s</span>
          </div>

          <div className="divide-y divide-slate-800/60 text-xs">
            {playerStatsList.map((player, idx) => (
              <div
                key={player.playerId}
                className={`p-2.5 flex items-center justify-between hover:bg-slate-900/50 transition ${
                  player.isMvp ? 'bg-amber-950/20' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    idx === 0 ? 'bg-amber-500 text-black' : idx === 1 ? 'bg-slate-300 text-black' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-slate-200">
                      <span>{player.name}</span>
                      <span className={`text-[9px] px-1 rounded ${
                        player.team === 'BLUE' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-red-950 text-red-400 border border-red-800'
                      }`}>
                        {player.team === 'BLUE' ? 'Xanh' : 'Đỏ'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {getCyberTitle(player.cyberCorrect, player.damageDealt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div className="hidden sm:block">
                    <div className="text-slate-400 text-[10px]">Tình huống đúng</div>
                    <div className="text-cyan-400 font-bold font-mono">{player.cyberCorrect} câu</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Tổng điểm</div>
                    <div className="text-amber-400 font-bold font-mono text-sm">{player.totalScore}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nút bấm chơi lại ván mới */}
        <div className="space-y-2">
          <button
            onClick={onRematch}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.5)] cursor-pointer active:scale-98 transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4 animate-spin-slow" />
            <span>🔄 CHƠI LẠI VÁN MỚI (QUAY VỀ SẢNH CHỜ)</span>
          </button>
          <p className="text-[11px] text-slate-400">
            Tất cả người chơi trong phòng sẽ cùng được đưa về Sảnh Chờ để đổi phe và bấm Sẵn Sàng cho hiệp mới.
          </p>
        </div>

      </div>
    </div>
  );
};
