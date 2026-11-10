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
  color, isSelected = false, isInteractive = false, size = 44,
  badgeCount, onClick, className = '',
}) => {
  const isWhite = color === 'white';
  const id = isWhite ? 'ivory' : 'ebony';
  return (
    <div onClick={isInteractive ? onClick : undefined} style={{ width: size, height: size }}
      className={'relative isolate flex select-none items-center justify-center transition-transform duration-150 ' +
        (isInteractive ? 'cursor-pointer active:scale-95 hover:brightness-110 ' : '') +
        (isSelected ? 'z-30 scale-110 ' : 'z-10 ') + className}>
      <svg viewBox="0 0 120 120" role="img"
        aria-label={isWhite ? 'Fildişi tavla pulu' : 'Siyah tavla pulu'}
        className="h-full w-full overflow-visible drop-shadow-[0_5px_5px_rgba(0,0,0,0.62)]">
        <defs>
          <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
            {isWhite ? <><stop offset="0" stopColor="#fffef8"/><stop offset=".48" stopColor="#d8c8a9"/><stop offset="1" stopColor="#8b7657"/></> :
              <><stop offset="0" stopColor="#77716a"/><stop offset=".42" stopColor="#24211e"/><stop offset="1" stopColor="#050505"/></>}
          </linearGradient>
          <radialGradient id={`${id}-face`} cx="30%" cy="22%" r="82%">
            {isWhite ? <><stop offset="0" stopColor="#fffef8"/><stop offset=".42" stopColor="#eee5d4"/><stop offset=".82" stopColor="#c7b493"/><stop offset="1" stopColor="#8e795a"/></> :
              <><stop offset="0" stopColor="#59534c"/><stop offset=".38" stopColor="#24211e"/><stop offset=".82" stopColor="#0b0a09"/><stop offset="1" stopColor="#030303"/></>}
          </radialGradient>
          <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff0b2"/><stop offset=".5" stopColor="#bd8a32"/><stop offset="1" stopColor="#704713"/>
          </linearGradient>
        </defs>
        <circle cx="60" cy="62" r="56" fill="#000" opacity=".32"/>
        <circle cx="60" cy="58" r="55" fill={`url(#${id}-rim)`} stroke={isWhite ? '#fff8e8' : '#82766a'} strokeWidth="1.5"/>
        <circle cx="60" cy="57" r="48" fill={`url(#${id}-face)`} stroke={isWhite ? '#fff8e9' : '#6c6258'} strokeWidth="1.4"/>
        <circle cx="60" cy="57" r="39" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2.2"/>
        <circle cx="60" cy="57" r="34" fill="none" stroke={isWhite ? '#fff9eb' : '#a18a61'} strokeWidth=".9" opacity=".65"/>
        <path d="M60 27 L65 51 L89 57 L65 63 L60 87 L55 63 L31 57 L55 51 Z" fill={`url(#${id}-gold)`} stroke="#6f4c1b" strokeWidth=".8"/>
        <path d="M60 39 L63 55 L78 57 L63 59 L60 75 L57 59 L42 57 L57 55 Z" fill={isWhite ? '#fff8e7' : '#d9b66e'} opacity=".85"/>
        <path d="M24 40 Q42 12 73 15" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity={isWhite ? '.72' : '.22'}/>
      </svg>
      {isSelected && <span className="pointer-events-none absolute -inset-1 rounded-full border-[3px] border-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.9)]"/>}
      {badgeCount && badgeCount > 1 ? <div className={'absolute z-20 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-black shadow-[0_2px_5px_rgba(0,0,0,0.65)] ' +
        (isWhite ? 'border border-amber-900 bg-gradient-to-b from-amber-700 to-amber-950 text-amber-50' :
          'border border-amber-100 bg-gradient-to-b from-amber-50 to-amber-300 text-amber-950')}>{badgeCount}</div> : null}
    </div>
  );
};
