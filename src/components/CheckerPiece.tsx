import React from 'react';
import { PlayerColor } from '../types/game';

interface CheckerPieceProps {
  color: PlayerColor;
  isSelected?: boolean;
  isInteractive?: boolean;
  size?: number;
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
      className={
        'relative isolate flex select-none items-center justify-center rounded-full transition-transform duration-150 ' +
        (isInteractive ? 'cursor-pointer active:scale-95 hover:brightness-110 ' : '') +
        (isSelected ? 'z-30 scale-110 ' : 'z-10 ') +
        className
      }
    >
      <div
        className={
          'absolute -inset-[2px] rounded-full transition-all ' +
          (isSelected
            ? 'ring-[3px] ring-amber-300 ring-offset-2 ring-offset-amber-950 shadow-[0_8px_18px_rgba(0,0,0,0.72)]'
            : 'shadow-[0_6px_12px_rgba(0,0,0,0.58),0_2px_3px_rgba(0,0,0,0.42)]')
        }
      />

      <div
        className={
          'relative h-full w-full overflow-hidden rounded-full border p-[3px] ' +
          (isWhite
            ? 'border-[#fffdf7] bg-gradient-to-br from-white via-[#d9d2c5] to-[#81745f]'
            : 'border-[#71675f] bg-gradient-to-br from-[#81776f] via-[#292522] to-[#080707]')
        }
      >
        <div
          className={
            'relative h-full w-full overflow-hidden rounded-full border ' +
            (isWhite
              ? 'border-[#fffdf4] bg-[radial-gradient(circle_at_32%_24%,#ffffff_0%,#f5f0e6_34%,#d8c9b0_78%,#9d8a70_100%)] shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-4px_7px_rgba(70,48,24,0.28)]'
              : 'border-[#514841] bg-[radial-gradient(circle_at_32%_24%,#69615b_0%,#302b27_38%,#171412_78%,#080707_100%)] shadow-[inset_0_2px_4px_rgba(255,255,255,0.22),inset_0_-5px_8px_rgba(0,0,0,0.9)]')
          }
        >
          <div
            className={
              'absolute inset-[12%] rounded-full border ' +
              (isWhite
                ? 'border-white/90 bg-gradient-to-br from-white/80 via-[#f1e7d7] to-[#c9b698] shadow-[inset_0_2px_3px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(91,64,34,0.25),0_1px_2px_rgba(255,255,255,0.75)]'
                : 'border-[#8a7e72]/60 bg-gradient-to-br from-[#51483f] via-[#2b2622] to-[#100e0d] shadow-[inset_0_2px_3px_rgba(255,255,255,0.18),inset_0_-3px_5px_rgba(0,0,0,0.9)]')
            }
          >
            <div
              className={
                'absolute inset-[22%] rounded-full border ' +
                (isWhite
                  ? 'border-white/80 bg-gradient-to-br from-white to-[#d7c7ae] shadow-[0_1px_3px_rgba(70,48,24,0.2),inset_0_1px_2px_white]'
                  : 'border-[#71665c]/70 bg-gradient-to-br from-[#62584e] to-[#1b1714] shadow-[0_2px_4px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.18)]')
              }
            />
          </div>

          <div className="pointer-events-none absolute inset-x-[12%] top-[5%] h-[28%] rounded-[100%] bg-gradient-to-b from-white/60 via-white/15 to-transparent blur-[1px]" />
          <div className="pointer-events-none absolute bottom-[8%] left-[22%] h-[12%] w-[56%] rounded-full bg-black/10 blur-[3px]" />

          {badgeCount && badgeCount > 1 ? (
            <div
              className={
                'absolute z-20 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-black shadow-[0_2px_5px_rgba(0,0,0,0.5)] ' +
                (isWhite
                  ? 'border border-amber-700/70 bg-gradient-to-b from-amber-700 to-amber-950 text-amber-50'
                  : 'border border-amber-100 bg-gradient-to-b from-amber-50 to-amber-300 text-amber-950')
              }
            >
              {badgeCount}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
