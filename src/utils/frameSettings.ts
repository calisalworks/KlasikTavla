/**
 * Klasik Tavla - 10 Yuvarlak Çerçeve & Kupa Seviye Sistemi
 * Oyuncu seviyesi Online maçlarda kazanılan kupalarla belirlenir.
 * Seviye 1 (Başlangıç): 0-199 kupa
 * Seviye 2: 200 kupa, Seviye 3: 300 kupa ... Seviye 10: 1.000 kupa ... Seviye 100: 10.000 kupa
 */

export interface ProfileFrame {
  id: string;
  name: string;
  minLevel: number;
  minTrophies: number;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  // CSS Classes for circular avatar container
  ringClass: string;
  borderClass: string;
  glowClass: string;
  badgeBg: string;
  icon: string;
}

export const PROFILE_FRAMES: ProfileFrame[] = [
  {
    id: 'frame-1',
    name: 'Ahşap Çırak',
    minLevel: 1,
    minTrophies: 0,
    description: 'Klasik ceviz ağacı ve pirinç perçinli çırak çerçevesi',
    rarity: 'common',
    ringClass: 'ring-2 ring-amber-700/80',
    borderClass: 'border-2 border-amber-600/90',
    glowClass: 'shadow-[0_0_8px_rgba(180,83,9,0.4)]',
    badgeBg: 'from-amber-700 to-amber-900',
    icon: '🪵',
  },
  {
    id: 'frame-2',
    name: 'Bronz Savaşçı',
    minLevel: 10,
    minTrophies: 1000,
    description: 'Dövme bronz halka ve parlatılmış pirinç işlemeler',
    rarity: 'common',
    ringClass: 'ring-2 ring-amber-500/90',
    borderClass: 'border-2 border-amber-400',
    glowClass: 'shadow-[0_0_12px_rgba(245,158,11,0.5)]',
    badgeBg: 'from-amber-600 to-yellow-800',
    icon: '🥉',
  },
  {
    id: 'frame-3',
    name: 'Demir Muhafız',
    minLevel: 20,
    minTrophies: 2000,
    description: 'Fırçalanmış çelik zırh ve gümüş ışıltılı kenarlar',
    rarity: 'rare',
    ringClass: 'ring-2 ring-slate-300/90',
    borderClass: 'border-2 border-slate-200',
    glowClass: 'shadow-[0_0_14px_rgba(226,232,240,0.55)]',
    badgeBg: 'from-slate-400 to-slate-700',
    icon: '🛡️',
  },
  {
    id: 'frame-4',
    name: 'Zümrüt Sedef',
    minLevel: 30,
    minTrophies: 3000,
    description: 'Doğal yeşil zümrüt taşı ve sedef kakma desenler',
    rarity: 'rare',
    ringClass: 'ring-2 ring-emerald-400',
    borderClass: 'border-2 border-emerald-300',
    glowClass: 'shadow-[0_0_16px_rgba(16,185,129,0.6)]',
    badgeBg: 'from-emerald-500 to-teal-800',
    icon: '💎',
  },
  {
    id: 'frame-5',
    name: 'Safir Fırtına',
    minLevel: 40,
    minTrophies: 4000,
    description: 'Kobalt mavi safir kristalleri ve fırtına aurası',
    rarity: 'rare',
    ringClass: 'ring-2 ring-sky-400',
    borderClass: 'border-2 border-sky-300',
    glowClass: 'shadow-[0_0_18px_rgba(14,165,233,0.65)]',
    badgeBg: 'from-sky-500 to-indigo-800',
    icon: '⚡',
  },
  {
    id: 'frame-6',
    name: 'Yakut Sultan',
    minLevel: 50,
    minTrophies: 5000,
    description: 'Kraliyet kızıl yakut işlemeli altın varaklı çerçeve',
    rarity: 'epic',
    ringClass: 'ring-2 ring-rose-500',
    borderClass: 'border-2 border-amber-300',
    glowClass: 'shadow-[0_0_20px_rgba(244,63,94,0.7)]',
    badgeBg: 'from-rose-600 via-amber-600 to-rose-900',
    icon: '👑',
  },
  {
    id: 'frame-7',
    name: 'Altın Şampiyon',
    minLevel: 60,
    minTrophies: 6000,
    description: '24 Ayar saf altın halka ve göz alıcı şampiyon tacı',
    rarity: 'epic',
    ringClass: 'ring-2 ring-yellow-300',
    borderClass: 'border-2 border-yellow-200',
    glowClass: 'shadow-[0_0_22px_rgba(253,224,71,0.75)]',
    badgeBg: 'from-yellow-400 to-amber-700',
    icon: '🏆',
  },
  {
    id: 'frame-8',
    name: 'Ametist Hükümdar',
    minLevel: 70,
    minTrophies: 7000,
    description: 'Asil mor ametist kristalleri ve mistik güç halkası',
    rarity: 'legendary',
    ringClass: 'ring-2 ring-purple-400',
    borderClass: 'border-2 border-purple-200',
    glowClass: 'shadow-[0_0_24px_rgba(168,85,247,0.8)]',
    badgeBg: 'from-purple-500 to-violet-900',
    icon: '🔮',
  },
  {
    id: 'frame-9',
    name: 'Obsidyen Ejder',
    minLevel: 80,
    minTrophies: 8000,
    description: 'Volkanik siyah obsidyen ve sönmeyen kızıl lav közleri',
    rarity: 'legendary',
    ringClass: 'ring-2 ring-red-500',
    borderClass: 'border-2 border-orange-400',
    glowClass: 'shadow-[0_0_26px_rgba(239,68,68,0.85)]',
    badgeBg: 'from-zinc-900 via-red-900 to-stone-900',
    icon: '🐉',
  },
  {
    id: 'frame-10',
    name: 'Tavla Efsanesi',
    minLevel: 100,
    minTrophies: 10000,
    description: '100. Seviye ustalarına layık kozmik prizmatik efsane çerçevesi',
    rarity: 'mythic',
    ringClass: 'ring-2 ring-amber-300 animate-pulse',
    borderClass: 'border-2 border-amber-100',
    glowClass: 'shadow-[0_0_30px_rgba(251,191,36,0.95)]',
    badgeBg: 'from-amber-300 via-rose-400 to-indigo-500',
    icon: '✨',
  },
];

/**
 * Calculates current player level based on online trophies
 * Trophies < 200 => Level 1
 * 200 trophies => Level 2, 300 => Level 3, ..., 1000 => Level 10, ..., 10000 => Level 100
 */
export function calculateLevelFromTrophies(trophies: number = 0): number {
  if (trophies < 200) return 1;
  const calculated = Math.floor(trophies / 100);
  return Math.min(100, Math.max(1, calculated));
}

/**
 * Trophies required to achieve a specific level
 */
export function getTrophiesRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  return level * 100;
}

/**
 * Calculates progress percent and remaining trophies to the next level
 */
export function getLevelProgress(trophies: number = 0): {
  currentLevel: number;
  nextLevel: number;
  trophiesInCurrentLevel: number;
  trophiesRequiredForNext: number;
  progressPercent: number;
  remainingTrophies: number;
} {
  const currentLevel = calculateLevelFromTrophies(trophies);
  if (currentLevel >= 100) {
    return {
      currentLevel: 100,
      nextLevel: 100,
      trophiesInCurrentLevel: 10000,
      trophiesRequiredForNext: 10000,
      progressPercent: 100,
      remainingTrophies: 0,
    };
  }

  const nextLevel = currentLevel + 1;
  const currentLevelThreshold = getTrophiesRequiredForLevel(currentLevel);
  const nextLevelThreshold = getTrophiesRequiredForLevel(nextLevel);

  const neededSpan = nextLevelThreshold - currentLevelThreshold;
  const earnedSpan = Math.max(0, trophies - currentLevelThreshold);
  const percent = Math.min(100, Math.max(0, Math.round((earnedSpan / (neededSpan || 1)) * 100)));

  return {
    currentLevel,
    nextLevel,
    trophiesInCurrentLevel: trophies,
    trophiesRequiredForNext: nextLevelThreshold,
    progressPercent: percent,
    remainingTrophies: Math.max(0, nextLevelThreshold - trophies),
  };
}

/**
 * Checks if a frame is unlocked for the user
 */
export function isFrameUnlocked(frameId: string, trophies: number = 0): boolean {
  const frame = PROFILE_FRAMES.find((f) => f.id === frameId);
  if (!frame) return false;
  if (frame.minLevel <= 1) return true; // Default unlocked
  const playerLevel = calculateLevelFromTrophies(trophies);
  return playerLevel >= frame.minLevel;
}

/**
 * Gets frame config by ID with fallback to Ahşap Çırak
 */
export function getProfileFrame(frameId?: string): ProfileFrame {
  const found = PROFILE_FRAMES.find((f) => f.id === frameId);
  return found || PROFILE_FRAMES[0];
}
