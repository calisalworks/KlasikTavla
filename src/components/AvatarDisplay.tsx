import React from 'react';

export interface PresetAvatar {
  id: string;
  name: string;
  gradient: string;
  borderColor: string;
  textColor: string;
  symbol: string;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'avatar-1',
    name: 'Klasik Zar',
    gradient: 'from-amber-400 via-amber-500 to-amber-700',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-950',
    symbol: '🎲',
  },
  {
    id: 'avatar-2',
    name: 'Kral Taç',
    gradient: 'from-yellow-400 via-amber-600 to-amber-900',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-950',
    symbol: '👑',
  },
  {
    id: 'avatar-3',
    name: 'Usta Kaplan',
    gradient: 'from-orange-500 via-red-600 to-amber-900',
    borderColor: 'border-orange-300',
    textColor: 'text-amber-100',
    symbol: '🐯',
  },
  {
    id: 'avatar-4',
    name: 'Gözüpek Kartal',
    gradient: 'from-emerald-500 via-teal-700 to-slate-900',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-100',
    symbol: '🦅',
  },
  {
    id: 'avatar-5',
    name: 'Kıdemli Kurt',
    gradient: 'from-slate-500 via-stone-700 to-stone-900',
    borderColor: 'border-stone-400',
    textColor: 'text-stone-100',
    symbol: '🐺',
  },
  {
    id: 'avatar-6',
    name: 'Şimşek',
    gradient: 'from-blue-500 via-indigo-600 to-purple-900',
    borderColor: 'border-sky-300',
    textColor: 'text-sky-100',
    symbol: '⚡',
  },
  {
    id: 'avatar-7',
    name: 'Alev Ustası',
    gradient: 'from-rose-500 via-red-600 to-amber-950',
    borderColor: 'border-rose-300',
    textColor: 'text-rose-100',
    symbol: '🔥',
  },
  {
    id: 'avatar-8',
    name: 'Şampiyon Kupa',
    gradient: 'from-amber-300 via-yellow-500 to-amber-800',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-950',
    symbol: '🏆',
  },
];

import { getProfileFrame } from '../utils/frameSettings';

interface AvatarDisplayProps {
  avatar?: string;
  name: string;
  size?: number;
  className?: string;
  frameId?: string;
}

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  avatar,
  name,
  size = 40,
  className = '',
  frameId = 'frame-1',
}) => {
  const frame = getProfileFrame(frameId);

  // 1. If it's a data URL or image URL
  if (avatar && (avatar.startsWith('data:image') || avatar.startsWith('http') || avatar.startsWith('/'))) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-full overflow-hidden ${frame.ringClass} ${frame.borderClass} ${frame.glowClass} bg-stone-900 flex items-center justify-center shrink-0 transition-transform ${className}`}
        title={`${name} • Çerçeve: ${frame.name}`}
      >
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  // 2. If it's one of the preset avatars
  const preset = PRESET_AVATARS.find((p) => p.id === avatar);
  if (preset) {
    return (
      <div
        style={{ width: size, height: size, fontSize: Math.floor(size * 0.48) }}
        className={`rounded-full bg-gradient-to-tr ${preset.gradient} ${frame.ringClass} ${frame.borderClass} ${frame.glowClass} flex items-center justify-center select-none shrink-0 transition-transform ${className}`}
        title={`${name} • Çerçeve: ${frame.name}`}
      >
        <span>{preset.symbol}</span>
      </div>
    );
  }

  // 3. Fallback to Initial Letter with elegant gradient
  const initial = name ? name.trim().charAt(0).toUpperCase() : '?';
  return (
    <div
      style={{ width: size, height: size, fontSize: Math.floor(size * 0.42) }}
      className={`rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 ${frame.ringClass} ${frame.borderClass} ${frame.glowClass} flex items-center justify-center text-amber-950 font-black select-none shrink-0 transition-transform ${className}`}
      title={`${name} • Çerçeve: ${frame.name}`}
    >
      <span>{initial}</span>
    </div>
  );
};
