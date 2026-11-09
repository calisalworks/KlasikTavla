import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PlayerColor } from '../types/game';
import { AvatarDisplay } from './AvatarDisplay';
import { tavlaAudio } from '../utils/audio';
import { Sparkles, Trophy, ArrowRight, Dices } from 'lucide-react';

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

const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 180, y: 0 },
};

const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const OpeningDie3D: React.FC<{ value: number; phase: 'waiting_for_roll' | 'rolling' | 'revealed'; winner: boolean }> = ({
  value,
  phase,
  winner,
}) => {
  const target = FACE_ROTATIONS[value] || FACE_ROTATIONS[1];
  const transform = phase === 'rolling'
    ? 'rotateX(720deg) rotateY(540deg) rotateZ(360deg)'
    : phase === 'revealed'
      ? 'rotateX(' + (720 + target.x) + 'deg) rotateY(' + (540 + target.y) + 'deg) rotateZ(360deg)'
      : 'rotateX(-12deg) rotateY(18deg) rotateZ(-4deg)';

  const face = (faceValue: number, transformStyle: string) => (
    <div
      className="absolute inset-0 flex items-center justify-center rounded-[13px] border border-white/90 bg-gradient-to-br from-white via-slate-100 to-slate-300 shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-3px_5px_rgba(15,23,42,0.16)]"
      style={{ transform: transformStyle, backfaceVisibility: 'hidden' }}
    >
      <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-0.5 p-2">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="flex items-center justify-center">
            {(PIP_POSITIONS[faceValue] || []).includes(index) && (
              <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-slate-900 to-slate-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),0_1px_2px_rgba(0,0,0,0.45)]" />
            )}
          </div>
        ))}
      </div>
      <span className="pointer-events-none absolute inset-x-2 top-1 h-2 rounded-full bg-white/55 blur-[2px]" />
    </div>
  );

  return (
    <div className="relative h-[76px] w-[76px] sm:h-[88px] sm:w-[88px]" style={{ perspective: '520px' }}>
      <div
        className="absolute inset-0 rounded-[16px] bg-black/50 blur-md"
        style={{ transform: 'translateY(9px) scale(0.92)' }}
      />
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: 'preserve-3d',
          transform,
          transition: phase === 'rolling' ? 'transform 820ms cubic-bezier(0.18, 0.72, 0.18, 1)' : 'transform 760ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {face(1, 'translateZ(38px)')}
        {face(6, 'rotateY(180deg) translateZ(38px)')}
        {face(3, 'rotateY(90deg) translateZ(38px)')}
        {face(4, 'rotateY(-90deg) translateZ(38px)')}
        {face(2, 'rotateX(90deg) translateZ(38px)')}
        {face(5, 'rotateX(-90deg) translateZ(38px)')}
      </div>
      {winner && phase === 'revealed' && (
        <div className="absolute -right-2 -top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-amber-200 bg-gradient-to-br from-amber-300 to-amber-600 text-amber-950 shadow-[0_3px_10px_rgba(0,0,0,0.55)]">
          <Trophy className="h-4 w-4" />
        </div>
      )}
    </div>
  );
};

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
  const [countdown, setCountdown] = useState(3);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const completionSentRef = useRef(false);
  onCompleteRef.current = onComplete;

  const completeOnce = useCallback(() => {
    if (completionSentRef.current) return;
    completionSentRef.current = true;
    onCompleteRef.current();
  }, []);

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
      autoCloseTimeoutRef.current = setTimeout(completeOnce, 2200);
    }, 820);
  }, [completeOnce]);

  useEffect(() => {
    if (!isOpen) {
      clearTimers();
      phaseRef.current = 'waiting_for_roll';
      completionSentRef.current = false;
      setPhase('waiting_for_roll');
      setCountdown(3);
      return;
    }

    phaseRef.current = 'waiting_for_roll';
    completionSentRef.current = false;
    setPhase('waiting_for_roll');
    setCountdown(3);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((previous) => {
        if (previous <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          startRoll();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return clearTimers;
  }, [isOpen, startRoll, completeOnce]);

  if (!isOpen) return null;

  const whiteIsRight = (myColor ?? 'white') === 'white';
  const whiteWins = winner === 'white';
  const meWins = winner === (myColor ?? 'white');

  const renderPlayer = (
    name: string,
    avatar: string | undefined,
    playerLabel: string,
    value: number,
    isWinner: boolean,
  ) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.025] px-2 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_24px_rgba(0,0,0,0.2)] sm:px-4 sm:py-5">
      <div className="flex w-full min-w-0 items-center justify-center gap-2">
        <AvatarDisplay avatar={avatar} name={name} size={34} />
        <div className="min-w-0 text-left">
          <div className="max-w-[112px] truncate text-[11px] font-black text-white sm:text-sm">{name}</div>
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-200/70">{playerLabel}</div>
        </div>
      </div>
      <div className="py-1">
        <OpeningDie3D value={value} phase={phase} winner={isWinner} />
      </div>
      <div className="min-h-7 rounded-full border border-white/10 bg-black/30 px-4 py-1 text-center text-sm font-black tabular-nums text-white shadow-inner">
        {phase === 'revealed' ? value : phase === 'waiting_for_roll' ? '—' : '…'}
      </div>
      {phase === 'revealed' && isWinner && (
        <div className="rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-amber-200">
          Başlangıç hakkı
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/80 px-3 py-5 backdrop-blur-md animate-in fade-in duration-300 select-none">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(14,165,233,0.16),transparent_48%),radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.12),transparent_42%)]" />
      <div className="relative my-auto w-full max-w-[460px] overflow-hidden rounded-[28px] border border-cyan-200/20 bg-gradient-to-br from-slate-900 via-slate-950 to-[#101b2b] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(255,255,255,0.12)] sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative mb-5 flex flex-col items-center text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200/30 bg-gradient-to-br from-cyan-300/20 to-blue-500/10 text-cyan-100 shadow-[0_6px_22px_rgba(14,165,233,0.16)]">
            <Dices className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200 sm:text-xs">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Başlangıç Atışı
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          </div>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Kim başlayacak?</h2>
          <p className="mt-1 text-[10px] font-medium text-slate-300 sm:text-xs">
            Her oyuncu bir zar atar. Yüksek atan başlar.
          </p>
          {ties.length > 0 && (
            <div className="mt-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[9px] font-semibold text-amber-100/80">
              Eşitlik: {ties.map((tie) => tie.white + '–' + tie.black).join('  •  ')} · Tekrar atılıyor
            </div>
          )}
        </div>

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
          {whiteIsRight
            ? renderPlayer(blackPlayerName, blackAvatar, 'SİYAH', blackDie, !whiteWins)
            : renderPlayer(whitePlayerName, whiteAvatar, 'BEYAZ', whiteDie, whiteWins)}
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-200/20 bg-slate-800 text-[10px] font-black tracking-wider text-cyan-100 shadow-[0_4px_14px_rgba(0,0,0,0.4)]">
            VS
          </div>
          {whiteIsRight
            ? renderPlayer(whitePlayerName, whiteAvatar, 'BEYAZ', whiteDie, whiteWins)
            : renderPlayer(blackPlayerName, blackAvatar, 'SİYAH', blackDie, !whiteWins)}
        </div>

        <div className="relative mt-5 flex min-h-[58px] flex-col items-center justify-center gap-2">
          {phase === 'waiting_for_roll' && (
            <>
              <div className="text-[10px] font-semibold text-slate-300">
                Zarlar hazırlanıyor <span className="ml-1 font-black tabular-nums text-cyan-200">{countdown}</span>
              </div>
              <button
                onClick={startRoll}
                className="flex items-center gap-2 rounded-xl border border-cyan-100/40 bg-gradient-to-b from-cyan-300 to-sky-600 px-5 py-2.5 text-[10px] font-black tracking-wider text-slate-950 shadow-[0_7px_20px_rgba(14,165,233,0.3),inset_0_1px_0_rgba(255,255,255,0.7)] transition hover:brightness-110 active:scale-95"
              >
                <Dices className="h-4 w-4" /> ŞİMDİ AT
                <span className="text-slate-900/60">({countdown})</span>
              </button>
            </>
          )}
          {phase === 'rolling' && (
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-100">
              <span className="h-2 w-2 animate-ping rounded-full bg-cyan-300" />
              Zarlar atılıyor…
            </div>
          )}
          {phase === 'revealed' && (
            <>
              <div className="text-center text-[11px] font-black text-white sm:text-sm">
                {meWins
                  ? 'Tebrikler! Oyuna siz başlayacaksınız.'
                  : (whiteWins ? whitePlayerName : blackPlayerName) + ' oyuna başlıyor.'}
              </div>
              <button
                onClick={completeOnce}
                className="flex items-center gap-2 rounded-xl border border-amber-200/50 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 px-6 py-2.5 text-[10px] font-black tracking-wider text-amber-950 shadow-[0_7px_20px_rgba(245,158,11,0.25),inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:brightness-110 active:scale-95"
              >
                OYUNA GEÇ <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
