import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Die } from '../types/game';
import { DicePhysicsView } from './DicePhysicsView';
import { tavlaAudio } from '../utils/audio';

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

/**
 * The opening roll is deliberately rendered directly over the visible board.
 * It is not a modal: the two physical dice are thrown onto the playing surface,
 * then handed to the normal turn UI as the first move's dice.
 */
export const OpeningRollOverlay: React.FC<OpeningRollOverlayProps> = ({
  isOpen,
  whitePlayerName,
  blackPlayerName,
  whiteDie,
  blackDie,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'rolling' | 'settled'>('rolling');
  const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);
  onCompleteRef.current = onComplete;

  const completeOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  }, []);

  const openingDice: Die[] = [
    { value: whiteDie, used: false, id: 'opening-white-die' },
    { value: blackDie, used: false, id: 'opening-black-die' },
  ];

  useEffect(() => {
    if (!isOpen) {
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
      rollTimeoutRef.current = null;
      completeTimeoutRef.current = null;
      completedRef.current = false;
      setPhase('rolling');
      return;
    }

    completedRef.current = false;
    setPhase('rolling');
    tavlaAudio.playDiceRoll();

    rollTimeoutRef.current = setTimeout(() => {
      setPhase('settled');
      tavlaAudio.playDiceDrop();
      completeTimeoutRef.current = setTimeout(completeOnce, 1150);
    }, 1450);

    return () => {
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
    };
  }, [isOpen, completeOnce]);

  if (!isOpen) return null;

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-[60] flex w-1/2 items-center justify-center">
      <div className="relative flex flex-col items-center">
        <div className="mb-1 flex w-40 items-center justify-between gap-3 px-1 text-[9px] font-black uppercase tracking-wider text-amber-100/90 drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
          <span className="max-w-[68px] truncate">{whitePlayerName}</span>
          <span className="max-w-[68px] truncate text-right">{blackPlayerName}</span>
        </div>
        <DicePhysicsView
          dice={openingDice}
          isRolling={phase === 'rolling'}
          canRoll={false}
          onRollClick={() => undefined}
          className="scale-110"
        />
        <div className="mt-1 min-h-4 text-[9px] font-black uppercase tracking-[0.18em] text-amber-100/85 drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
          {phase === 'rolling' ? 'BAŞLANGIÇ ATIŞI' : 'İLK HAMLE ZARLARI'}
        </div>
      </div>
    </div>
  );
};
