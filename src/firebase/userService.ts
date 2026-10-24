import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './config';
import { UserProfile } from '../types/game';
import { saveUserProfile, getUserProfile } from '../utils/profileStorage';

import { COIN_SETTINGS, getTodayDateString } from '../utils/coinSettings';

export interface FirestoreUserData {
  id: string; // Permanent UID
  displayName: string;
  photoURL?: string;
  equippedFrame?: string;
  trophies?: number;
  wins: number;
  losses: number;
  abandoned: number;
  coins: number;
  level: number;
  lastDailyRewardDate?: string;
  lastFreeCoinsClaimTimestamp?: number;
  adRewardsToday?: number;
  lastAdRewardDate?: string;
  createdAt: string;
  lastLoginAt: string;
}

/**
 * Synchronizes authenticated Firebase user with Firestore `users/{uid}` document.
 * Ensures that returning users access their persistent account, stats, and coins.
 * E-mail address is kept private and never exposed to the public users collection.
 */
export async function syncUserWithFirestore(user: User): Promise<UserProfile> {
  const localProfile = getUserProfile();
  const userRef = doc(db, 'users', user.uid);

  try {
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as FirestoreUserData;
      const trophies = typeof data.trophies === 'number' ? data.trophies : (localProfile.trophies || 0);
      const level = typeof data.level === 'number' ? data.level : (localProfile.level || 1);

      const updatedProfile: UserProfile = {
        id: user.uid,
        name: data.displayName || user.displayName || localProfile.name || 'Oyuncu',
        avatar: data.photoURL || user.photoURL || localProfile.avatar || 'avatar-1',
        equippedFrame: data.equippedFrame || localProfile.equippedFrame || 'frame-1',
        trophies,
        level,
        wins: typeof data.wins === 'number' ? data.wins : 0,
        losses: typeof data.losses === 'number' ? data.losses : 0,
        abandoned: typeof data.abandoned === 'number' ? data.abandoned : 0,
        isFirebaseUser: true,
        coins: typeof data.coins === 'number' ? data.coins : COIN_SETTINGS.INITIAL_STARTING_COINS,
        lastDailyRewardDate: data.lastDailyRewardDate || undefined,
        lastFreeCoinsClaimTimestamp:
          typeof data.lastFreeCoinsClaimTimestamp === 'number'
            ? data.lastFreeCoinsClaimTimestamp
            : localProfile.lastFreeCoinsClaimTimestamp,
        adRewardsToday: typeof data.adRewardsToday === 'number' ? data.adRewardsToday : 0,
        lastAdRewardDate: data.lastAdRewardDate || undefined,
      };

      // Refresh lastLoginAt timestamp & sync any name/photo changes
      await updateDoc(userRef, {
        lastLoginAt: new Date().toISOString(),
        ...(user.displayName ? { displayName: user.displayName } : {}),
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
      }).catch((err) => {
        console.warn('Could not update lastLoginAt in Firestore:', err);
      });

      saveUserProfile(updatedProfile);
      return updatedProfile;
    } else {
      // First-time user: create brand new user profile document in Firestore
      // Preserve guest progress (coins, trophies, wins, losses, level) so no data is lost
      const guestCoins = typeof localProfile.coins === 'number' && localProfile.coins > 0
        ? localProfile.coins
        : COIN_SETTINGS.INITIAL_STARTING_COINS;
      const initialCoins = Math.max(guestCoins, COIN_SETTINGS.INITIAL_STARTING_COINS);
      const isGuestMigration = guestCoins > COIN_SETTINGS.INITIAL_STARTING_COINS;

      const newDoc: FirestoreUserData = {
        id: user.uid,
        displayName: user.displayName || localProfile.name || 'Oyuncu',
        photoURL: user.photoURL || localProfile.avatar || '',
        equippedFrame: localProfile.equippedFrame || 'frame-1',
        trophies: Math.max(localProfile.trophies || 0, 0),
        wins: Math.max(localProfile.wins || 0, 0),
        losses: Math.max(localProfile.losses || 0, 0),
        abandoned: Math.max(localProfile.abandoned || 0, 0),
        coins: initialCoins,
        level: Math.max(localProfile.level || 1, 1),
        lastDailyRewardDate: localProfile.lastDailyRewardDate || undefined,
        lastFreeCoinsClaimTimestamp:
          typeof localProfile.lastFreeCoinsClaimTimestamp === 'number'
            ? localProfile.lastFreeCoinsClaimTimestamp
            : undefined,
        adRewardsToday: typeof localProfile.adRewardsToday === 'number' ? localProfile.adRewardsToday : 0,
        lastAdRewardDate: localProfile.lastAdRewardDate || undefined,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      await setDoc(userRef, newDoc);

      // Create initial welcome bonus or guest migration transaction in ledger
      try {
        const today = getTodayDateString();
        const initialTxRef = doc(db, 'users', user.uid, 'coinTransactions', 'tx_initial_bonus');
        await setDoc(initialTxRef, {
          id: 'tx_initial_bonus',
          userId: user.uid,
          type: isGuestMigration ? 'guest_migration' : 'initial_bonus',
          amount: initialCoins,
          balanceAfter: initialCoins,
          description: isGuestMigration ? 'Misafir Hesabından Aktarılan Bakiye' : 'Başlangıç Hoş Geldin Bonusu',
          date: today,
          createdAt: new Date().toISOString(),
        });
      } catch (txErr) {
        console.warn('Could not create initial bonus transaction doc:', txErr);
      }

      const createdProfile: UserProfile = {
        id: user.uid,
        name: newDoc.displayName,
        avatar: newDoc.photoURL || 'avatar-1',
        equippedFrame: newDoc.equippedFrame || 'frame-1',
        trophies: newDoc.trophies || 0,
        wins: newDoc.wins,
        losses: newDoc.losses,
        abandoned: newDoc.abandoned,
        isFirebaseUser: true,
        coins: newDoc.coins,
        level: newDoc.level,
        lastDailyRewardDate: newDoc.lastDailyRewardDate,
        lastFreeCoinsClaimTimestamp: newDoc.lastFreeCoinsClaimTimestamp,
        adRewardsToday: newDoc.adRewardsToday || 0,
        lastAdRewardDate: newDoc.lastAdRewardDate,
      };

      saveUserProfile(createdProfile);
      return createdProfile;
    }
  } catch (err) {
    console.warn('Firestore sync error, continuing with local fallback profile:', err);
    const fallbackProfile: UserProfile = {
      id: user.uid,
      name: user.displayName || localProfile.name || 'Oyuncu',
      avatar: user.photoURL || localProfile.avatar || 'avatar-1',
      equippedFrame: localProfile.equippedFrame || 'frame-1',
      trophies: localProfile.trophies || 0,
      wins: localProfile.wins,
      losses: localProfile.losses,
      abandoned: localProfile.abandoned,
      isFirebaseUser: true,
      coins: localProfile.coins ?? COIN_SETTINGS.INITIAL_STARTING_COINS,
      level: localProfile.level ?? 1,
      lastDailyRewardDate: localProfile.lastDailyRewardDate,
      lastFreeCoinsClaimTimestamp: localProfile.lastFreeCoinsClaimTimestamp,
      adRewardsToday: localProfile.adRewardsToday ?? 0,
      lastAdRewardDate: localProfile.lastAdRewardDate,
    };
    saveUserProfile(fallbackProfile);
    return fallbackProfile;
  }
}

/**
 * Records match results directly to Firestore for logged-in players with permanent UID
 */
export async function recordMatchInFirestore(
  uid: string,
  result: 'win' | 'loss' | 'abandoned'
): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    const updatePayload: Record<string, any> = {
      lastLoginAt: new Date().toISOString(),
    };
    if (result === 'win') {
      updatePayload.wins = increment(1);
    } else if (result === 'loss') {
      updatePayload.losses = increment(1);
    } else if (result === 'abandoned') {
      updatePayload.abandoned = increment(1);
    }
    await updateDoc(userRef, updatePayload);
  } catch (err) {
    console.warn('Could not record match stats to Firestore:', err);
  }
}

/**
 * Records online match outcome and cup delta directly to Firestore
 */
export async function recordOnlineMatchInFirestore(
  uid: string,
  result: 'win' | 'loss' | 'abandoned',
  trophyDelta: number,
  newLevel?: number
): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    const updatePayload: Record<string, any> = {
      lastLoginAt: new Date().toISOString(),
    };
    if (result === 'win') {
      updatePayload.wins = increment(1);
    } else if (result === 'loss') {
      updatePayload.losses = increment(1);
    } else if (result === 'abandoned') {
      updatePayload.abandoned = increment(1);
    }
    if (trophyDelta !== 0) {
      updatePayload.trophies = increment(trophyDelta);
    }
    if (typeof newLevel === 'number') {
      updatePayload.level = newLevel;
    }
    await updateDoc(userRef, updatePayload);
  } catch (err) {
    console.warn('Could not record online match stats to Firestore:', err);
  }
}
