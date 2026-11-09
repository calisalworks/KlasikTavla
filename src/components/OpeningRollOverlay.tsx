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
  const phaseRef = useRef<'waiting_for_roll' | 'rolling' | 'revealed'>('waiting_for_roll');
  const [countdown, setCountdown] = useState<number>(5);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clearTimers = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    countdownIntervalRef.current = null;
    rollTimeoutRef.current = null;
    autoCloseTimeoutRef.current = null;
  };

  const startRoll = useCallback(() => {
    if (phaseRef.current !== 'waiting_for_roll') return;
    phaseRef.current = 'rolling';
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setPhase('rolling');
    tavlaAudio.playDiceRoll();

    rollTimeoutRef.current = setTimeout(() => {
      phaseRef.current = 'revealed';
      setPhase('revealed');
      tavlaAudio.playDiceDrop();
      autoCloseTimeoutRef.current = setTimeout(() => onCompleteRef.current(), 2600);
    }, 700);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      clearTimers();
      phaseRef.current = 'waiting_for_roll';
      setPhase('waiting_for_roll');
      setCountdown(5);
      return;
    }

    phaseRef.current = 'waiting_for_roll';
    setPhase('waiting_for_roll');
    setCountdown(5);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          startRoll();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimers;
  }, [isOpen, startRoll]);

  if (!isOpen) return null;

  const renderPips = (value: number) => {
    const pipPositions: Record<number, number[]> = {
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
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {activePips.includes(i) && (
              <div className="w-2.5 h-2.5 rounded-full bg-[#18181b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]" />
            )}
          </div>
        ))}
      </div>
    );
  };

  const whiteIsRight = (myColor ?? 'white') === 'white';
  const isWhiteWinner = winner === 'white';
  const isMeWinner = winner === (myColor ?? 'white');

  const renderPlayer = (
    side: 'left' | 'right',
    name: string,
    avatar: string | undefined,
    colorName: string,
    value: number,
    isWinner: boolean,
  ) => (
    <div
      className={`absolute top-1/2 -translate-y-1/2 ${side === 'left' ? 'left-[17%]' : 'right-[17%]'} flex flex-col items-center gap-2 sm:gap-3 transition-all duration-300`}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#160d08]/90 border border-amber-700/60 shadow-lg backdrop-blur-sm">
        <AvatarDisplay avatar={avatar} name={name} size={30} />
        <div className="text-left max-w-[110px]">
          <div className="text-[10px] sm:text-xs font-black text-amber-100 truncate">{name}</div>
          <div className="text-[8px] sm:text-[9px] font-bold text-amber-400/80">{colorName}</div>
        </div>
        {phase === 'revealed' && isWinner && (
          <Trophy className="w-4 h-4 text-amber-300 shrink-0" />
        )}
      </div>

      <div
        className={`w-14 h-14 sm:w-[68px] sm:h-[68px] rounded-xl bg-gradient-to-br from-white via-stone-100 to-stone-300 border-[3px] flex items-center justify-center shadow-[0_8px_18px_rgba(0,0,0,0.65)] transition-all duration-300 ${
          phase === 'rolling'
            ? 'border-amber-300 animate-spin scale-90'
            : phase === 'revealed' && isWinner
              ? 'border-amber-300 ring-4 ring-amber-400/50 scale-110 shadow-[0_0_28px_rgba(245,158,11,0.75)]'
              : 'border-stone-300'
        }`}
      >
        {phase === 'revealed' ? renderPips(value) : (
          <Dices className={`w-7 h-7 ${phase === 'rolling' ? 'text-stone-600 animate-pulse' : 'text-amber-700'}`} />
        )}
      </div>
      <div className="min-w-8 px-2 py-0.5 rounded-lg bg-black/80 border border-amber-600/60 text-center text-sm font-black text-amber-100 shadow">
        {phase === 'revealed' ? value : phase === 'waiting_for_roll' ? '?' : '…'}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto select-none animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/35 pointer-events-auto" />
      <div className="absolute top-[13%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-[#160d08]/90 border border-amber-600/70 shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-1.5 text-amber-100 text-[11px] sm:text-sm font-black uppercase tracking-wider">
          <Dices className="w-4 h-4 text-amber-400" />
          Başlangıç Zarı
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="text-[9px] sm:text-[10px] text-amber-300 font-semibold">
          Yüksek atan oyuna başlar
          {phase === 'waiting_for_roll' && <span className="ml-2 text-amber-100">({countdown} sn)</span>}
        </div>
        {ties.length > 0 && (
          <div className="text-[8px] sm:text-[9px] text-amber-300/80">
            Eşitlik nedeniyle tekrar atıldı: {ties.map((t) => `${t.white}-${t.black}`).join(', ')}
          </div>
        )}
      </div>

      {renderPlayer(
        whiteIsRight ? 'right' : 'left',
        whitePlayerName,
        whiteAvatar,
        'Beyaz oyuncu',
        whiteDie,
        isWhiteWinner,
      )}
      {renderPlayer(
        whiteIsRight ? 'left' : 'right',
        blackPlayerName,
        blackAvatar,
        'Siyah oyuncu',
        blackDie,
        !isWhiteWinner,
      )}

      {phase === 'revealed' && (
        <div className="pointer-events-auto absolute top-[78%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="px-4 py-2 rounded-xl bg-[#160d08]/95 border border-amber-500/70 text-center text-[10px] sm:text-xs font-black text-amber-100 shadow-xl backdrop-blur-sm">
            {isMeWinner
              ? `Tebrikler! ${myColor === 'black' ? blackDie : whiteDie} attınız. Oyuna siz başlıyorsunuz.`
              : `Rakip ${isWhiteWinner ? whiteDie : blackDie} attı ve oyuna başlıyor.`}
          </div>
          <button
            onClick={onComplete}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 text-stone-950 text-[10px] sm:text-xs font-black border border-amber-300 shadow-lg active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            OYUNA GEÇ <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {phase === 'waiting_for_roll' && (
        <button
          onClick={startRoll}
          className="pointer-events-auto absolute top-[78%] left-1/2 -translate-x-1/2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 text-stone-950 text-[10px] sm:text-xs font-black border border-amber-300 shadow-lg animate-pulse flex items-center gap-2 cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5" /> ZARI AT ({countdown})
        </button>
      )}
    </div>
  );
};
