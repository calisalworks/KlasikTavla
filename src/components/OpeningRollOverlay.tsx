import React, { useEffect, useRef, useState } from 'react';
import { Die, PlayerColor } from '../types/game';
import { DicePhysicsView } from './DicePhysicsView';
import { tavlaAudio } from '../utils/audio';

interface OpeningRollOverlayProps {
  isOpen: boolean;
  whitePlayerName: string;
  blackPlayerName: string;
  whiteDie: number;
  blackDie: number;
  whiteRolled?: boolean;
  blackRolled?: boolean;
  myColor?: PlayerColor;
  isLocalGame?: boolean;
  onRoll: (color: PlayerColor) => void;
  onComplete: () => void;
}

export const OpeningRollOverlay: React.FC<OpeningRollOverlayProps> = ({
  isOpen,
  whitePlayerName,
  blackPlayerName,
  whiteDie,
  blackDie,
  whiteRolled = false,
  blackRolled = false,
  myColor,
  isLocalGame = false,
  onRoll,
  onComplete,
}) => {
  const [whiteRolling, setWhiteRolling] = useState(false);
  const [blackRolling, setBlackRolling] = useState(false);
  const [whiteSettled, setWhiteSettled] = useState(false);
  const [blackSettled, setBlackSettled] = useState(false);
  const [whiteSeconds, setWhiteSeconds] = useState(5);
  const [blackSeconds, setBlackSeconds] = useState(5);
  const requestedRef = useRef<Record<PlayerColor, boolean>>({ white: false, black: false });
  const completedRef = useRef(false);

  const requestRoll = (color: PlayerColor) => {
    if (requestedRef.current[color]) return;
    requestedRef.current[color] = true;
    tavlaAudio.playButtonClick();
    onRoll(color);
  };

  useEffect(() => {
    if (!isOpen) {
      requestedRef.current = { white: false, black: false };
      completedRef.current = false;
      setWhiteRolling(false);
      setBlackRolling(false);
      setWhiteSettled(false);
      setBlackSettled(false);
      setWhiteSeconds(5);
      setBlackSeconds(5);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    const startCountdown = (color: PlayerColor, alreadyRolled: boolean) => {
      if (alreadyRolled) {
        requestedRef.current[color] = true;
        return;
      }

      const canAutoRoll = isLocalGame || myColor === color;
      let seconds = 5;
      const setSeconds = color === 'white' ? setWhiteSeconds : setBlackSeconds;
      setSeconds(5);

      const interval = setInterval(() => {
        seconds -= 1;
        setSeconds(Math.max(0, seconds));
      }, 1000);
      intervals.push(interval);

      if (canAutoRoll) {
        const timeout = setTimeout(() => {
          clearInterval(interval);
          setSeconds(0);
          requestRoll(color);
        }, 5000);
        timers.push(timeout);
      }
    };

    startCountdown('white', whiteRolled);
    startCountdown('black', blackRolled);

    return () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [isOpen, isLocalGame, myColor, whiteRolled, blackRolled]);

  useEffect(() => {
    if (!isOpen || !whiteRolled) return;
    setWhiteRolling(true);
    tavlaAudio.playDiceRoll();
    const drop = setTimeout(() => {
      setWhiteRolling(false);
      setWhiteSettled(true);
      tavlaAudio.playDiceDrop();
    }, 1450);
    return () => clearTimeout(drop);
  }, [isOpen, whiteRolled]);

  useEffect(() => {
    if (!isOpen || !blackRolled) return;
    setBlackRolling(true);
    tavlaAudio.playDiceRoll();
    const drop = setTimeout(() => {
      setBlackRolling(false);
      setBlackSettled(true);
      tavlaAudio.playDiceDrop();
    }, 1450);
    return () => clearTimeout(drop);
  }, [isOpen, blackRolled]);

  useEffect(() => {
    if (!isOpen || !whiteSettled || !blackSettled || completedRef.current) return;
    completedRef.current = true;
    const finish = setTimeout(onComplete, 450);
    return () => clearTimeout(finish);
  }, [isOpen, whiteSettled, blackSettled, onComplete]);

  if (!isOpen) return null;

  const renderSide = (
    color: PlayerColor,
    name: string,
    value: number,
    rolled: boolean,
    rolling: boolean,
    seconds: number,
    settled: boolean
  ) => {
    const isMySide = isLocalGame ? color === 'white' : myColor === color;
    const die: Die = { value, used: false, id: `opening-${color}-die` };
    return (
      <div className="pointer-events-auto flex w-1/2 flex-col items-center justify-center gap-2 px-1">
        <div className="max-w-full truncate rounded-full border border-amber-500/50 bg-black/75 px-3 py-1 text-[10px] font-black text-amber-100 shadow-lg">
          {name}
        </div>
        {rolled ? (
          <DicePhysicsView
            dice={[die]}
            isRolling={rolling}
            canRoll={false}
            onRollClick={() => undefined}
            className="scale-110"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-amber-500/40 bg-black/35 text-3xl font-black text-amber-100 shadow-inner">
            <span className="opacity-50">?</span>
          </div>
        )}
        {!rolled && isMySide ? (
          <button
            onClick={() => requestRoll(color)}
            className="rounded-xl border border-amber-300 bg-gradient-to-b from-amber-500 to-amber-800 px-3 py-2 text-[10px] font-black tracking-wide text-white shadow-lg active:scale-95"
          >
            BAŞLANGIÇ ZARI AT
          </button>
        ) : !rolled ? (
          <div className="rounded-full border border-amber-700/50 bg-black/65 px-3 py-1 text-[9px] font-bold text-amber-200/90">
            {isLocalGame ? 'Rakip atışı bekleniyor' : 'Oyuncunun atışı bekleniyor'}
          </div>
        ) : (
          <div className="rounded-full border border-emerald-500/50 bg-black/70 px-3 py-1 text-[9px] font-bold text-emerald-200">
            {settled ? 'ZAR ATILDI' : 'ZAR ATIŞI...'}
          </div>
        )}
        {!rolled && (
          <div className="text-[10px] font-black text-amber-200 drop-shadow">
            {seconds} sn
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[60] flex items-center">
      {renderSide('black', blackPlayerName, blackDie, blackRolled, blackRolling, blackSeconds, blackSettled)}
      {renderSide('white', whitePlayerName, whiteDie, whiteRolled, whiteRolling, whiteSeconds, whiteSettled)}
    </div>
  );
};
