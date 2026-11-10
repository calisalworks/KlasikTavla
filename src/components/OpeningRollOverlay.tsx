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
  const onRollRef = useRef(onRoll);
  const onCompleteRef = useRef(onComplete);
  onRollRef.current = onRoll;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (isOpen) return;
    requestedRef.current = { white: false, black: false };
    completedRef.current = false;
    setWhiteRolling(false);
    setBlackRolling(false);
    setWhiteSettled(false);
    setBlackSettled(false);
    setWhiteSeconds(5);
    setBlackSeconds(5);
  }, [isOpen]);

  const requestRoll = (color: PlayerColor) => {
    if (requestedRef.current[color]) return;
    requestedRef.current[color] = true;
    tavlaAudio.playButtonClick();
    onRollRef.current(color);
  };

  useEffect(() => {
    if (!isOpen || whiteRolled) return;
    const canAutoRoll = isLocalGame || myColor === 'white';
    let seconds = 5;
    setWhiteSeconds(5);
    const interval = setInterval(() => {
      seconds -= 1;
      setWhiteSeconds(Math.max(0, seconds));
    }, 1000);
    const timeout = canAutoRoll ? setTimeout(() => {
      clearInterval(interval);
      setWhiteSeconds(0);
      requestRoll('white');
    }, 5000) : null;
    return () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [isOpen, isLocalGame, myColor, whiteRolled]);

  useEffect(() => {
    if (!isOpen || blackRolled) return;
    // In the local game, the AI rolls separately after the human's roll.
    if (isLocalGame && !whiteRolled) return;
    const canAutoRoll = isLocalGame || myColor === 'black';
    const delayMs = isLocalGame ? 700 : 5000;
    let seconds = Math.ceil(delayMs / 1000);
    setBlackSeconds(seconds);
    const interval = setInterval(() => {
      seconds -= 1;
      setBlackSeconds(Math.max(0, seconds));
    }, 1000);
    const timeout = canAutoRoll ? setTimeout(() => {
      clearInterval(interval);
      setBlackSeconds(0);
      requestRoll('black');
    }, delayMs) : null;
    return () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [isOpen, isLocalGame, myColor, blackRolled, whiteRolled]);

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
    const finish = setTimeout(() => onCompleteRef.current(), 450);
    return () => clearTimeout(finish);
  }, [isOpen, whiteSettled, blackSettled]);

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
            throwSide={isMySide ? 'right' : 'left'}
            canRoll={false}
            onRollClick={() => undefined}
            className="scale-90"
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
            {isLocalGame ? 'Rakip atışı bekleniyor' : 'Rakibin atışı bekleniyor'}
          </div>
        ) : (
          <div className="rounded-full border border-emerald-500/50 bg-black/70 px-3 py-1 text-[9px] font-bold text-emerald-200">
            {settled ? 'ZAR ATILDI' : 'ZAR ATIŞI...'}
          </div>
        )}
        {!rolled && (!isLocalGame || isMySide || (isLocalGame && color === 'black' && whiteRolled)) && (
          <div className="text-[10px] font-black text-amber-200 drop-shadow">
            {seconds} sn
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[60] flex items-center">
      {(() => {
        const leftColor: PlayerColor = isLocalGame || myColor === 'white' ? 'black' : 'white';
        const rightColor: PlayerColor = isLocalGame ? 'white' : (myColor ?? 'white');
        const side = (color: PlayerColor) => color === 'white'
          ? renderSide('white', whitePlayerName, whiteDie, whiteRolled, whiteRolling, whiteSeconds, whiteSettled)
          : renderSide('black', blackPlayerName, blackDie, blackRolled, blackRolling, blackSeconds, blackSettled);
        return <>{side(leftColor)}{side(rightColor)}</>;
      })()}
    </div>
  );
};
