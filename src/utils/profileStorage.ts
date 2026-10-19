import { UserProfile } from '../types/game';
import { COIN_SETTINGS } from './coinSettings';
import { calculateLevelFromTrophies } from './frameSettings';

const PROFILE_KEY = 'tavla_user_profile_v1';

export function getUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const trophies = typeof parsed.trophies === 'number' ? Math.max(0, parsed.trophies) : 0;
      const level = calculateLevelFromTrophies(trophies);

      return {
        id: parsed.id || `user_${Math.random().toString(36).substring(2, 9)}`,
        name: parsed.name || 'Oyuncu',
        avatar: parsed.avatar || 'avatar-1',
        equippedFrame: parsed.equippedFrame || 'frame-1',
        trophies,
        level,
        wins: Number(parsed.wins) || 0,
        losses: Number(parsed.losses) || 0,
        abandoned: Number(parsed.abandoned) || 0,
        isFirebaseUser: !!parsed.isFirebaseUser,
        coins: typeof parsed.coins === 'number' ? parsed.coins : COIN_SETTINGS.INITIAL_STARTING_COINS,
        lastDailyRewardDate: parsed.lastDailyRewardDate || undefined,
        lastFreeCoinsClaimTimestamp:
          typeof parsed.lastFreeCoinsClaimTimestamp === 'number'
            ? parsed.lastFreeCoinsClaimTimestamp
            : undefined,
        adRewardsToday: typeof parsed.adRewardsToday === 'number' ? parsed.adRewardsToday : 0,
        lastAdRewardDate: parsed.lastAdRewardDate || undefined,
      };
    }
  } catch {
    // fallback
  }

  const newProfile: UserProfile = {
    id: `user_${Math.random().toString(36).substring(2, 9)}`,
    name: 'Oyuncu',
    avatar: 'avatar-1',
    equippedFrame: 'frame-1',
    trophies: 0,
    level: 1,
    wins: 0,
    losses: 0,
    abandoned: 0,
    isFirebaseUser: false,
    coins: COIN_SETTINGS.INITIAL_STARTING_COINS,
    adRewardsToday: 0,
  };
  saveUserProfile(newProfile);
  return newProfile;
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    // Re-verify level matches trophies before saving
    profile.level = calculateLevelFromTrophies(profile.trophies ?? 0);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // fallback
  }
}

export function recordMatchResult(result: 'win' | 'loss' | 'abandoned'): UserProfile {
  const profile = getUserProfile();
  if (result === 'win') {
    profile.wins += 1;
  } else if (result === 'loss') {
    profile.losses += 1;
  } else if (result === 'abandoned') {
    profile.abandoned += 1;
  }
  saveUserProfile(profile);
  return profile;
}

/**
 * Records Online Match Outcome with Official Cup Scoring:
 * - Win (or opponent abandoned): +10 cups
 * - Loss: -5 cups (minimum 0)
 * - Abandoned by user: -5 cups (minimum 0)
 */
export function recordOnlineMatchResult(
  result: 'win' | 'loss' | 'abandoned',
  opponentAbandoned: boolean = false
): { profile: UserProfile; trophyDelta: number } {
  const profile = getUserProfile();
  let trophyDelta = 0;

  if (opponentAbandoned || result === 'win') {
    profile.wins += 1;
    trophyDelta = 10;
  } else if (result === 'loss') {
    profile.losses += 1;
    trophyDelta = -5;
  } else if (result === 'abandoned') {
    profile.abandoned += 1;
    trophyDelta = -5;
  }

  const currentTrophies = profile.trophies ?? 0;
  profile.trophies = Math.max(0, currentTrophies + trophyDelta);
  profile.level = calculateLevelFromTrophies(profile.trophies);

  saveUserProfile(profile);
  return { profile, trophyDelta };
}

export function updateEquippedFrame(frameId: string): UserProfile {
  const profile = getUserProfile();
  profile.equippedFrame = frameId;
  saveUserProfile(profile);
  return profile;
}

export function updatePlayerName(newName: string): UserProfile {
  const profile = getUserProfile();
  profile.name = newName.trim() || 'Oyuncu';
  saveUserProfile(profile);
  return profile;
}

export function updatePlayerAvatar(avatar: string): UserProfile {
  const profile = getUserProfile();
  profile.avatar = avatar;
  saveUserProfile(profile);
  return profile;
}
