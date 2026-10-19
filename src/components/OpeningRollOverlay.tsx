import React, { useEffect, useState } from 'react';
import { PlayerColor } from '../types/game';
import { AvatarDisplay } from './AvatarDisplay';
import { tavlaAudio } from '../utils/audio';
import { Sparkles, Trophy, Dices, ArrowRight } from 'lucide-react';

interface OpeningRollOverlayProps {
  isOpen: boolean;
  whitePlayerName: string;
  blackPlayerName: string;
  whiteAvatar?: string;
  blackAvatar?: string;
  whiteDie: number;
  blackDie: number;
  winner: PlayerColor;
  ties?: { white: number; black: number }[];
  myColor?: PlayerColor;
  onComplete: () => void;
}

export const OpeningRollOverlay: React.FC<OpeningRollOverlayProps> = ({
  isOpen,
  whitePlayerName,
  blackPlayerName,
  whiteAvatar,
  blackAvatar,
  whiteDie,
  blackDie,
  winner,
  ties = [],
  myColor,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'rolling' | 'revealed'>('rolling');

  useEffect(() => {
    if (!isOpen) {
      setPhase('rolling');
      return;
    }

    tavlaAudio.playDiceRoll();
    const revealTimer = setTimeout(() => {
      setPhase('revealed');
      tavlaAudio.playDiceDrop();
    }, 700);

    const autoCloseTimer = setTimeout(() => {
      onComplete();
    }, 2800);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(autoCloseTimer);
    };
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  const renderPips = (value: number) => {
    const pipPositions: { [val: number]: number[] } = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    const activePips = pipPositions[value] || [4];

    return (
      <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-2 gap-1">
        {Array.from({ length: 9 }).map((_, i) => {
          const hasPip = activePips.includes(i);
          return (
            <div key={i} className="flex items-center justify-center">
              {hasPip && (
                <div className="w-2.5 h-2.5 rounded-full bg-[#18181b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const isWhiteWinner = winner === 'white';
  const isMeWinner = myColor ? winner === myColor : isWhiteWinner;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-[#2a1b12] via-[#20140d] to-[#140b07] border-2 border-amber-600/70 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col items-center p-6 text-center select-none">
        {/* Glow backdrop */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/50 shadow-inner">
            <Dices className="w-6 h-6 text-amber-400 animate-pulse" />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-black text-amber-100 tracking-wide uppercase flex items-center gap-1.5">
              <span>Başlangıç Zarı</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h2>
            <p className="text-[11px] text-amber-300/80 font-medium">
              Yüksek zar atan oyuna başlar
            </p>
          </div>
        </div>

        {/* Ties indicator if re-rolled */}
        {ties.length > 0 && (
          <div className="my-2 px-3 py-1 rounded-full bg-amber-950/70 border border-amber-600/40 text-[11px] text-amber-300 font-bold">
            Eşitlik: {ties.map((t) => `${t.white}-${t.black}`).join(', ')} (Tekrar atıldı)
          </div>
        )}

        {/* Two Players Duel Cards */}
        <div className="w-full grid grid-cols-2 gap-4 my-4 relative items-center">
          {/* VS Center badge */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[#180e08] border-2 border-amber-500/80 shadow-lg flex items-center justify-center text-[11px] font-black text-amber-300">
            VS
          </div>

          {/* White Player */}
          <div
            className={`flex flex-col items-center p-3 rounded-2xl border transition-all ${
              phase === 'revealed' && isWhiteWinner
                ? 'bg-gradient-to-b from-amber-950/90 to-amber-900/60 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] scale-105'
                : 'bg-[#1b120c] border-[#3f2719] opacity-85'
            }`}
          >
            <div className="relative mb-2">
              <AvatarDisplay avatar={whiteAvatar} name={whitePlayerName} size={44} />
              {phase === 'revealed' && isWhiteWinner && (
                <div className="absolute -top-2 -right-2 p-1 rounded-full bg-amber-500 text-stone-950 shadow-md">
                  <Trophy className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <span className="text-xs font-bold text-amber-100 truncate max-w-[130px]">
              {whitePlayerName}
            </span>
            <span className="text-[10px] text-amber-400/80 font-semibold mb-2">
              (Beyaz)
            </span>

            {/* Die */}
            <div
              className={`w-14 h-14 rounded-2xl bg-gradient-to-b from-white via-stone-100 to-stone-200 border-2 border-stone-300 shadow-[0_8px_16px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all ${
                phase === 'rolling'
                  ? 'animate-spin scale-90'
                  : isWhiteWinner
                  ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-[#20140d] scale-110'
                  : 'opacity-70 scale-95'
              }`}
            >
              {phase === 'revealed' ? (
                renderPips(whiteDie)
              ) : (
                <Dices className="w-7 h-7 text-stone-600 animate-pulse" />
              )}
            </div>
            <div className="mt-2 text-sm font-black text-amber-200">
              {phase === 'revealed' ? `${whiteDie}` : '...'}
            </div>
          </div>

          {/* Black Player */}
          <div
            className={`flex flex-col items-center p-3 rounded-2xl border transition-all ${
              phase === 'revealed' && !isWhiteWinner
                ? 'bg-gradient-to-b from-amber-950/90 to-amber-900/60 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] scale-105'
                : 'bg-[#1b120c] border-[#3f2719] opacity-85'
            }`}
          >
            <div className="relative mb-2">
              <AvatarDisplay avatar={blackAvatar} name={blackPlayerName} size={44} />
              {phase === 'revealed' && !isWhiteWinner && (
                <div className="absolute -top-2 -right-2 p-1 rounded-full bg-amber-500 text-stone-950 shadow-md">
                  <Trophy className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <span className="text-xs font-bold text-amber-100 truncate max-w-[130px]">
              {blackPlayerName}
            </span>
            <span className="text-[10px] text-amber-400/80 font-semibold mb-2">
              (Siyah)
            </span>

            {/* Die */}
            <div
              className={`w-14 h-14 rounded-2xl bg-gradient-to-b from-white via-stone-100 to-stone-200 border-2 border-stone-300 shadow-[0_8px_16px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all ${
                phase === 'rolling'
                  ? 'animate-spin scale-90'
                  : !isWhiteWinner
                  ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-[#20140d] scale-110'
                  : 'opacity-70 scale-95'
              }`}
            >
              {phase === 'revealed' ? (
                renderPips(blackDie)
              ) : (
                <Dices className="w-7 h-7 text-stone-600 animate-pulse" />
              )}
            </div>
            <div className="mt-2 text-sm font-black text-amber-200">
              {phase === 'revealed' ? `${blackDie}` : '...'}
            </div>
          </div>
        </div>

        {/* Result Announcement */}
        {phase === 'revealed' && (
          <div className="w-full mt-2 p-3 rounded-2xl bg-gradient-to-r from-amber-950/80 via-[#3a2315] to-amber-950/80 border border-amber-500/50 flex flex-col items-center gap-1 shadow-inner animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-xs font-black text-amber-100 flex items-center gap-1.5">
              <span>
                {isMeWinner
                  ? `🎉 Tebrikler! ${isWhiteWinner ? whiteDie : blackDie} attınız ve oyuna siz başlıyorsunuz!`
                  : `⚔️ Rakip ${isWhiteWinner ? whiteDie : blackDie} attı ve oyuna başlıyor!`}
              </span>
            </div>
            <div className="text-[11px] text-amber-300/80 font-medium">
              İlk hamle zarları: <span className="font-bold text-amber-200">{Math.max(whiteDie, blackDie)} - {Math.min(whiteDie, blackDie)}</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={onComplete}
          className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-white font-black text-xs shadow-lg border border-amber-400/60 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
        >
          <span>HEMEN BAŞLA</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
