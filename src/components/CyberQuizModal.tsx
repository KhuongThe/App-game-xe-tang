import React, { useState, useEffect } from 'react';
import { CyberQuestion } from '../types/game';
import { Shield, Sparkles, AlertTriangle, CheckCircle2, XCircle, Timer, Award } from 'lucide-react';

import { sound } from '../services/soundEffects';

interface CyberQuizModalProps {
  question: CyberQuestion;
  onAnswer: (isCorrect: boolean) => void;
  onClose: () => void;
}

export const CyberQuizModal: React.FC<CyberQuizModalProps> = ({
  question,
  onAnswer,
  onClose,
}) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(15);

  // Đếm ngược 15 giây để trả lời tình huống
  useEffect(() => {
    if (answered) return;
    if (timeLeft <= 0) {
      // Hết giờ coi như trả lời sai
      handleSelectOption(-1);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, answered]);

  const handleSelectOption = (index: number) => {
    if (answered) return;
    setSelectedOption(index);
    setAnswered(true);

    const isCorrect = index === question.correctIndex;
    if (isCorrect) {
      sound.playQuizCorrect();
    } else {
      sound.playQuizWrong();
    }
    onAnswer(isCorrect);
  };

  const isCorrect = selectedOption === question.correctIndex;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-xl bg-slate-900 border-2 border-cyan-500 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.4)] overflow-hidden flex flex-col">
        {/* Header tình huống */}
        <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 px-5 py-3.5 border-b border-cyan-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-900/80 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold">
                {question.topicLabel}
              </span>
              <h3 className="text-sm font-black text-white tracking-wide mt-0.5">
                TÌNH HUỐNG AN TOÀN THÔNG TIN MẠNG
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs bg-slate-950 px-3 py-1 rounded-lg border border-slate-700">
            <Timer className={`w-3.5 h-3.5 ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-cyan-400'}`} />
            <span className={`font-bold ${timeLeft <= 5 ? 'text-red-400' : 'text-cyan-300'}`}>
              {timeLeft}s
            </span>
          </div>
        </div>

        {/* Nội dung câu hỏi */}
        <div className="p-6 flex-1 flex flex-col">
          <div className="mb-4 bg-slate-950/80 border border-slate-800 rounded-xl p-4 shadow-inner">
            <p className="text-sm md:text-base font-semibold text-slate-100 leading-relaxed">
              {question.question}
            </p>
          </div>

          {/* Phần thưởng nếu trả lời đúng */}
          <div className="flex items-center gap-2 text-xs bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 px-3.5 py-2 rounded-lg mb-4">
            <Award className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Phần thưởng khi trả lời đúng: <strong>{question.rewardLabel}</strong></span>
          </div>

          {/* Danh sách lựa chọn */}
          <div className="space-y-2.5 mb-4">
            {question.options.map((option, idx) => {
              const letter = String.fromCharCode(65 + idx); // A, B, C
              const isThisSelected = selectedOption === idx;
              const isThisCorrect = question.correctIndex === idx;

              let btnStyle = 'bg-slate-950 hover:bg-slate-800/80 border-slate-700 text-slate-200';

              if (answered) {
                if (isThisCorrect) {
                  btnStyle = 'bg-green-950/90 border-green-500 text-green-200 shadow-[0_0_15px_rgba(34,197,94,0.4)]';
                } else if (isThisSelected) {
                  btnStyle = 'bg-red-950/90 border-red-500 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.4)]';
                } else {
                  btnStyle = 'bg-slate-950/50 border-slate-800 text-slate-500 opacity-60';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={answered}
                  className={`w-full text-left p-3.5 rounded-xl border flex items-start gap-3 transition cursor-pointer ${btnStyle}`}
                >
                  <span className={`w-6 h-6 rounded-lg font-bold font-mono text-xs flex items-center justify-center shrink-0 border ${
                    answered && isThisCorrect
                      ? 'bg-green-500 text-black border-green-400'
                      : answered && isThisSelected
                      ? 'bg-red-500 text-white border-red-400'
                      : 'bg-slate-800 text-cyan-400 border-slate-600'
                  }`}>
                    {letter}
                  </span>
                  <span className="text-xs md:text-sm leading-relaxed flex-1 pt-0.5">
                    {option}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Lời giải thích khi đã trả lời */}
          {answered && (
            <div className={`p-4 rounded-xl border mb-4 animate-fade-in ${
              isCorrect
                ? 'bg-green-950/80 border-green-500 text-green-200'
                : 'bg-red-950/80 border-red-500 text-red-200'
            }`}>
              <div className="flex items-center gap-2 font-black text-sm mb-1.5">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <span className="text-green-300 uppercase">CHÍNH XÁC! BẠN ĐÃ NHẬN ĐƯỢC BUFF</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-300 uppercase">SAI RỒI! XE TĂNG BỊ DÍNH MÃ ĐỘC (TÊ LIỆT 3S)</span>
                  </>
                )}
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                💡 <strong>Kiến thức an toàn:</strong> {question.explanation}
              </p>
            </div>
          )}

          {/* Nút tiếp tục khi đã trả lời */}
          {answered && (
            <button
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer active:scale-95 transition"
            >
              🚀 TIẾP TỤC CHIẾN ĐẤU
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
