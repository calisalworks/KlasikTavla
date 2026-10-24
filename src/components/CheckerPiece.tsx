import React from 'react';
import { PlayerColor } from '../types/game';

interface CheckerPieceProps {
  color: PlayerColor;
  isSelected?: boolean;
  isInteractive?: boolean;
  size?: number; // diameter in px or %
  badgeCount?: number;
  onClick?: () => void;
  className?: string;
}

export const CheckerPiece: React.FC<CheckerPieceProps> = ({
  color,
  isSelected = false,
  isInteractive = false,
  size = 44,
  badgeCount,
  onClick,
  className = '',
}) => {
  const isWhite = color === 'white';

  return (
    <div
      onClick={isInteractive ? onClick : undefined}
      style={{ width: size, height: size }}
      className={`relative rounded-full select-none transition-transform duration-150 flex items-center justify-center ${
        isInteractive ? 'cursor-pointer active:scale-95 hover:brightness-105' : ''
      } ${isSelected ? 'scale-110 z-30' : 'z-10'} ${className}`}
    >
      {/* Outer shadow for 3D wood bevel */}
      <div
        className={`absolute inset-0 rounded-full ${
          isSelected
            ? 'ring-3 ring-amber-300 ring-offset-2 ring-offset-amber-950 shadow-[0_6px_14px_rgba(0,0,0,0.65)]'
            : 'shadow-[0_4px_8px_rgba(0,0,0,0.5),0_1px_2px_rgba(0,0,0,0.4)]'
        }`}
      />

      {/* Main Checker Disc with Tactile Carved Wood/Resin Look */}
      <div
        className={`w-full h-full rounded-full relative overflow-hidden flex items-center justify-center ${
          isWhite
            ? 'bg-gradient-to-b from-[#fbf8f2] via-[#ede4d3] to-[#d6c7b0] border border-[#fbf9f4]'
            : 'bg-gradient-to-b from-[#3a3532] via-[#24201e] to-[#141211] border border-[#4a423e]'
        }`}
      >
        {/* Subtle radial inner highlight */}
        <div
          className={`absolute inset-0 rounded-full opacity-60 ${
            isWhite
              ? 'bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,0.9),transparent_65%)]'
              : 'bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,0.22),transparent_60%)]'
          }`}
        />

        {/* Traditional carved concentric circular groove (klasik tavla pulu halkası) */}
        <div
          className={`w-[66%] h-[66%] rounded-full border flex items-center justify-center transition-all ${
            isWhite
              ? 'border-[#caa885]/70 bg-gradient-to-b from-[#f2ebdf] to-[#dfd3bf] shadow-[inset_0_2px_3px_rgba(0,0,0,0.18)]'
              : 'border-[#4e4540]/80 bg-gradient-to-b from-[#2a2624] to-[#181615] shadow-[inset_0_2px_4px_rgba(0,0,0,0.55)]'
          }`}
        >
          {/* Inner center button/core */}
          <div
            className={`w-[45%] h-[45%] rounded-full ${
              isWhite
                ? 'bg-gradient-to-b from-[#fcf9f2] to-[#ded2bd] border border-[#d2bfa6]/50 shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                : 'bg-gradient-to-b from-[#38332f] to-[#1c1a18] border border-[#524943]/60 shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
            }`}
          />
        </div>

        {/* Top subtle rim sheen */}
        <div className="absolute top-0.5 inset-x-2 h-1/3 rounded-t-full bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />

        {/* Optional Count Badge when stack has many checkers */}
        {badgeCount && badgeCount > 1 ? (
          <div
            className={`absolute z-20 font-bold text-xs px-1.5 py-0.5 rounded-full shadow-md ${
              isWhite
                ? 'bg-amber-900/90 text-amber-100 border border-amber-700/60'
                : 'bg-amber-100 text-amber-950 border border-amber-300 font-extrabold'
            }`}
          >
            {badgeCount}
          </div>
        ) : null}
      </div>
    </div>
  );
};
