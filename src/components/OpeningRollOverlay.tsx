import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PlayerColor } from '../types/game';
import { AvatarDisplay } from './AvatarDisplay';
import { tavlaAudio } from '../utils/audio';
import { Sparkles, Trophy, Dices, ArrowRight, Clock } from 'lucide-react';

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
  const [phase, setPhase] = useState<'waiting_for_roll' | 'rolling' | 'revealed'>('waiting_for_roll');
  const [countdown, setCountdown] = useState<number>(5);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startRoll = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setPhase('rolling');
    tavlaAudio.playDiceRoll();

    rollTimeoutRef.current = setTimeout(() => {
      setPhase('revealed');
      tavlaAudio.playDiceDrop();

      autoCloseTimeoutRef.current = setTimeout(() => {
        onComplete();
      }, 2600);
    }, 700);
  }, [onComplete]);

  useEffect(() => {
    if (!isOpen) {
      setPhase('waiting_for_roll');
      setCountdown(5);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
      return;
    }

    setPhase('waiting_for_roll');
    setCountdown(5);

    // 5-second countdown timer for manual roll
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          startRoll();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    };
  }, [isOpen, startRoll]);

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
      <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-1.5 gap-0.5">
        {Array.from({ length: 9 }).map((_, i) => {
          const hasPip = activePips.includes(i);
          return (
            <div key={i} className="flex items-center justify-center">
              {hasPip && (
                <div className="w-2 h-2 rounded-full bg-[#18181b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const isWhiteWinner = winner === 'white';
  const isMeWinner = myColor ? winner === myColor : isWhiteWinner;
  const isMeWhite = myColor ? myColor === 'white' : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-1.5 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm sm:max-w-lg max-h-[92vh] overflow-y-auto bg-gradient-to-b from-[#2a1b12] via-[#20140d] to-[#140b07] border-2 border-amber-600/70 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] flex flex-col items-center p-2 sm:p-4 text-center select-none">
        {/* Glow backdrop */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Compact Header Row */}
        <div className="w-full flex items-center justify-between gap-1.5 pb-1 sm:pb-2 mb-1 sm:mb-2 border-b border-amber-800/40">
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-lg bg-amber-950/90 border border-amber-500/50 shadow-inner">
              <Dices className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            </div>
            <div className="text-left">
              <h2 className="text-[11px] sm:text-sm font-black text-amber-100 tracking-wide uppercase flex items-center gap-1 leading-tight">
                <span>Başlangıç Zarı</span>
                <Sparkles className="w-3 h-3 text-amber-400" />
              </h2>
              <p className="text-[9px] sm:text-[10px] text-amber-300/80 font-medium leading-none">
                Yüksek atan oyuna başlar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {ties.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-600/40 text-[8px] sm:text-[9px] text-amber-300 font-bold">
                Eşitlik: {ties.map((t) => `${t.white}-${t.black}`).join(', ')}
              </span>
            )}
            {phase === 'waiting_for_roll' && (
              <div className="px-1.5 sm:px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border border-amber-400/60 flex items-center gap-1 shadow-inner animate-pulse">
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
                <span className="text-[9px] sm:text-[11px] font-black text-amber-200">
                  {countdown} sn
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Duel Cards */}
        <div className="w-full grid grid-cols-2 gap-1.5 sm:gap-3 my-0.5 sm:my-1 relative items-center">
          {/* VS Center badge */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#180e08] border border-amber-500/80 shadow-md flex items-center justify-center text-[8px] sm:text-[9px] font-black text-amber-300">
            VS
          </div>

          {/* White Player */}
          <div
            onClick={() => {
              if (phase === 'waiting_for_roll' && isMeWhite) {
                startRoll();
              }
            }}
            className={`flex items-center justify-between p-1.5 sm:p-2 rounded-xl border transition-all ${
              phase === 'revealed' && isWhiteWinner
                ? 'bg-gradient-to-b from-amber-950/90 to-amber-900/60 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                : phase === 'waiting_for_roll' && isMeWhite
                ? 'bg-gradient-to-b from-[#2e1d13] to-[#1c0f08] border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.3)] cursor-pointer active:scale-98'
                : 'bg-[#1b120c] border-[#3f2719] opacity-85'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 text-left">
              <div className="relative shrink-0">
                <AvatarDisplay avatar={whiteAvatar} name={whitePlayerName} size={28} />
                {phase === 'revealed' && isWhiteWinner && (
                  <div className="absolute -top-1 -right-1 p-0.5 rounded-full bg-amber-500 text-stone-950 shadow-md">
                    <Trophy className="w-2 h-2" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] font-bold text-amber-100 truncate">
                  {whitePlayerName}
                </div>
                <div className="text-[8px] sm:text-[9px] text-amber-400/80 font-semibold leading-tight">
                  (Beyaz)
                </div>
              </div>
            </div>

            {/* Die */}
            <div className="flex items-center gap-1 shrink-0 pl-1">
              <div
                className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-b from-white via-stone-100 to-stone-200 border-2 border-stone-300 shadow-md flex items-center justify-center transition-all ${
                  phase === 'rolling'
                    ? 'animate-spin scale-90'
                    : phase === 'waiting_for_roll'
                    ? 'border-amber-400/80 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse'
                    : isWhiteWinner
                    ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-[#20140d] scale-105'
                    : 'opacity-70 scale-95'
                }`}
              >
                {phase === 'revealed' ? (
                  renderPips(whiteDie)
                ) : phase === 'waiting_for_roll' ? (
                  <Dices className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 animate-bounce" />
                ) : (
                  <Dices className="w-4 h-4 sm:w-5 sm:h-5 text-stone-600 animate-pulse" />
                )}
              </div>
              <div className="text-[11px] sm:text-xs font-black text-amber-200 w-3 text-center">
                {phase === 'revealed' ? `${whiteDie}` : phase === 'waiting_for_roll' ? '?' : '..'}
              </div>
            </div>
          </div>

          {/* Black Player */}
          <div
            onClick={() => {
              if (phase === 'waiting_for_roll' && !isMeWhite) {
                startRoll();
              }
            }}
            className={`flex items-center justify-between p-1.5 sm:p-2 rounded-xl border transition-all ${
              phase === 'revealed' && !isWhiteWinner
                ? 'bg-gradient-to-b from-amber-950/90 to-amber-900/60 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                : phase === 'waiting_for_roll' && !isMeWhite
                ? 'bg-gradient-to-b from-[#2e1d13] to-[#1c0f08] border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.3)] cursor-pointer active:scale-98'
                : 'bg-[#1b120c] border-[#3f2719] opacity-85'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 text-left">
              <div className="relative shrink-0">
                <AvatarDisplay avatar={blackAvatar} name={blackPlayerName} size={28} />
                {phase === 'revealed' && !isWhiteWinner && (
                  <div className="absolute -top-1 -right-1 p-0.5 rounded-full bg-amber-500 text-stone-950 shadow-md">
                    <Trophy className="w-2 h-2" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] font-bold text-amber-100 truncate">
                  {blackPlayerName}
                </div>
                <div className="text-[8px] sm:text-[9px] text-amber-400/80 font-semibold leading-tight">
                  (Siyah)
                </div>
              </div>
            </div>

            {/* Die */}
            <div className="flex items-center gap-1 shrink-0 pl-1">
              <div
                className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-b from-white via-stone-100 to-stone-200 border-2 border-stone-300 shadow-md flex items-center justify-center transition-all ${
                  phase === 'rolling'
                    ? 'animate-spin scale-90'
                    : phase === 'waiting_for_roll'
                    ? 'border-amber-400/80 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                    : !isWhiteWinner
                    ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-[#20140d] scale-105'
                    : 'opacity-70 scale-95'
                }`}
              >
                {phase === 'revealed' ? (
                  renderPips(blackDie)
                ) : phase === 'waiting_for_roll' ? (
                  <Dices className="w-4 h-4 sm:w-5 sm:h-5 text-stone-500" />
                ) : (
                  <Dices className="w-4 h-4 sm:w-5 sm:h-5 text-stone-600 animate-pulse" />
                )}
              </div>
              <div className="text-[11px] sm:text-xs font-black text-amber-200 w-3 text-center">
                {phase === 'revealed' ? `${blackDie}` : phase === 'waiting_for_roll' ? '?' : '..'}
              </div>
            </div>
          </div>
        </div>

        {/* Result Announcement */}
        {phase === 'revealed' && (
          <div className="w-full mt-1 sm:mt-1.5 py-1 sm:py-1.5 px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-amber-950/90 via-[#3a2315] to-amber-950/90 border border-amber-500/50 flex items-center justify-between gap-1.5 shadow-inner animate-in fade-in duration-200">
            <span className="text-[10px] sm:text-[11px] font-black text-amber-100 truncate">
              {isMeWinner
                ? `🎉 ${isWhiteWinner ? whiteDie : blackDie} attınız ve oyuna siz başlıyorsunuz!`
                : `⚔️ Rakip ${isWhiteWinner ? whiteDie : blackDie} attı ve oyuna başlıyor!`}
            </span>
            <button
              onClick={onComplete}
              className="shrink-0 px-2.5 sm:px-3 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-[9px] sm:text-[10px] shadow border border-amber-400/60 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>BAŞLA</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Action Controls */}
        {phase === 'waiting_for_roll' ? (
          <div className="w-full flex items-center justify-between gap-2 sm:gap-3 mt-1 sm:mt-2 pt-0.5 sm:pt-1">
            <button
              onClick={startRoll}
              className="flex-1 py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-stone-950 font-black text-xs sm:text-sm shadow-[0_0_15px_rgba(245,158,11,0.5)] border-2 border-amber-300 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
            >
              <Dices className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-950" />
              <span>ZARI AT</span>
              <span className="px-1.5 py-0.5 rounded-full bg-stone-950 text-amber-300 text-[9px] sm:text-[10px] font-black">
                {countdown}s
              </span>
            </button>
            <span className="text-[9px] sm:text-[10px] text-amber-300/70 font-medium shrink-0 hidden sm:inline">
              (5 saniye sonra otomatik atılır)
            </span>
          </div>
        ) : phase === 'rolling' ? (
          <div className="mt-1 sm:mt-2 py-0.5 sm:py-1 flex items-center gap-1.5 text-amber-300 text-xs font-bold animate-pulse">
            <Dices className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-spin" />
            <span>Zarlar atılıyor...</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
