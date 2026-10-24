import React from 'react';
import { Die } from '../types/game';

interface DiceViewProps {
  dice: Die[];
  isRolling: boolean;
  canRoll: boolean;
  onRollClick: () => void;
  className?: string;
}

export const DiceView: React.FC<DiceViewProps> = ({
  dice,
  isRolling,
  canRoll,
  onRollClick,
  className = '',
}) => {
  // Render pips for a standard d6 face
  const renderPips = (value: number) => {
    // 3x3 grid coordinates
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
                <div className="w-1.5 h-1.5 rounded-full bg-[#18181b] shadow-[inset_0_1px_1px_rgba(0,0,0,0.8)]" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {dice.length === 0 ? (
        canRoll && (
          <button
            onClick={onRollClick}
            className="group relative px-4 py-2 rounded-xl font-bold text-xs tracking-wide bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 text-amber-100 shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-amber-500/50 hover:from-amber-500 hover:to-amber-800 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>ZAR AT</span>
          </button>
        )
      ) : (
        <div
          onClick={canRoll ? onRollClick : undefined}
          className={`flex items-center gap-2 p-1.5 rounded-2xl transition-all ${
            canRoll ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
          }`}
        >
          {dice.map((die, index) => (
            <div
              key={die.id || index}
              className={`relative w-7 h-7 rounded-lg bg-gradient-to-b from-[#ffffff] via-[#f7f5f0] to-[#e8e4dc] border border-[#d4cfc3] shadow-[0_4px_8px_rgba(0,0,0,0.4),0_2px_3px_rgba(0,0,0,0.25)] flex items-center justify-center transition-all ${
                isRolling ? 'animate-bounce rotate-12 scale-105' : ''
              } ${die.used ? 'opacity-30 grayscale scale-90' : 'opacity-100'}`}
              style={{
                transform: isRolling
                  ? `rotate(${((index * 47) % 30) - 15}deg) translateY(${Math.sin(index) * 4}px)`
                  : 'none',
              }}
            >
              {/* Inner bevel sheen */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-tr from-black/5 via-transparent to-white/40 pointer-events-none" />

              {/* Pips */}
              {renderPips(die.value)}

              {/* Used check indicator */}
              {die.used && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                  <div className="w-4 h-0.5 bg-zinc-600 rotate-45 rounded" />
                </div>
              )}
            </div>
          ))}

          {canRoll && (
            <button
              onClick={onRollClick}
              className="ml-2 px-3 py-1.5 rounded-lg bg-amber-700/80 hover:bg-amber-600 text-amber-100 text-xs font-semibold border border-amber-500/40 shadow cursor-pointer transition-colors"
            >
              Yeniden At
            </button>
          )}
        </div>
      )}
    </div>
  );
};
