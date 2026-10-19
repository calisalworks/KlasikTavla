import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db, auth } from './config';
import { UserProfile, CoinTransaction } from '../types/game';
import { COIN_SETTINGS, getTodayDateString, getTimeUntilNextReset } from '../utils/coinSettings';
import { saveUserProfile, getUserProfile } from '../utils/profileStorage';
import { handleFirestoreError, OperationType } from './firestoreErrors';

export interface CoinRewardStatus {
  canClaimDaily: boolean;
  canClaimFree: boolean;
  dailyRewardCoins: number;
  freeRewardCoins: number;
  lastFreeCoinsClaimTimestamp?: number;
  lastDailyRewardDate?: string;
  msUntilFreeReset: number;
  hoursUntilReset: number;
  minutesUntilReset: number;
  secondsUntilReset: number;

  canWatchAd: boolean;
  adRewardCoins: number;
  adsWatchedToday: number;
  adsRemainingToday: number;
  maxDailyAds: number;
}

/**
 * Calculates current reward availability for a user
 * - Ücretsiz Jeton: 6 saatte bir 100 jeton
 * - Reklam İzle: Sınırsız, her izlemede 100 jeton
 */
export function getRewardStatus(profile: UserProfile): CoinRewardStatus {
  const now = Date.now();
  const cooldownMs = COIN_SETTINGS.FREE_COINS_COOLDOWN_MS; // 6 saat
  const lastClaim = profile.lastFreeCoinsClaimTimestamp;

  let canClaimFree = false;
  let msRemaining = 0;

  if (!lastClaim) {
    // İlk defa veya sayaç henüz kaydedilmemişse hemen toplayabilir
    canClaimFree = true;
    msRemaining = 0;
  } else {
    const elapsed = now - lastClaim;
    if (elapsed >= cooldownMs) {
      canClaimFree = true;
      msRemaining = 0;
    } else {
      canClaimFree = false;
      msRemaining = cooldownMs - elapsed;
    }
  }

  const totalSeconds = Math.floor(msRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const adsWatchedToday = profile.adRewardsToday ?? 0;

  return {
    canClaimDaily: canClaimFree,
    canClaimFree,
    dailyRewardCoins: COIN_SETTINGS.FREE_COINS_AMOUNT,
    freeRewardCoins: COIN_SETTINGS.FREE_COINS_AMOUNT,
    lastFreeCoinsClaimTimestamp: lastClaim,
    lastDailyRewardDate: profile.lastDailyRewardDate,
    msUntilFreeReset: msRemaining,
    hoursUntilReset: hours,
    minutesUntilReset: minutes,
    secondsUntilReset: seconds,
    canWatchAd: true, // Sınırsız
    adRewardCoins: COIN_SETTINGS.REWARDED_AD_COINS,
    adsWatchedToday,
    adsRemainingToday: 999999,
    maxDailyAds: 999999,
  };
}

/**
 * Claims free coins (her 6 saatte bir 100 jeton).
 * Oyuncu oyunu kapatsa bile sayaç epoch timestamp ile işlemeye devam eder.
 */
export async function claimDailyCoins(profile: UserProfile): Promise<{
  updatedProfile: UserProfile;
  coinsAdded: number;
}> {
  const now = Date.now();
  const rewardAmount = COIN_SETTINGS.FREE_COINS_AMOUNT;
  const cooldownMs = COIN_SETTINGS.FREE_COINS_COOLDOWN_MS;

  // 1. Client-side check
  if (profile.lastFreeCoinsClaimTimestamp) {
    const elapsed = now - profile.lastFreeCoinsClaimTimestamp;
    if (elapsed < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - elapsed) / 60000);
      throw new Error(`Ücretsiz ödülünüz için henüz süre dolmadı. Lütfen ${remainingMinutes} dakika sonra tekrar deneyin.`);
    }
  }

  // Try server endpoint
  try {
    const response = await fetch('/api/coins/claim-daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.id,
        isGuest: !profile.isFirebaseUser,
        claimTimestamp: now,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (errData.error) {
        throw new Error(errData.error);
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('dakika sonra')) {
      throw err;
    }
  }

  const newCoins = (profile.coins ?? COIN_SETTINGS.INITIAL_STARTING_COINS) + rewardAmount;
  const today = getTodayDateString();
  const updatedProfile: UserProfile = {
    ...profile,
    coins: newCoins,
    lastDailyRewardDate: today,
    lastFreeCoinsClaimTimestamp: now,
  };

  // If authenticated Firebase user, execute atomic transaction in Firestore
  if (profile.isFirebaseUser && auth.currentUser) {
    const userRef = doc(db, 'users', profile.id);
    const txDocId = `free_${now}`;
    const txRef = doc(db, 'users', profile.id, 'coinTransactions', txDocId);

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error('Kullanıcı hesabı bulunamadı.');
        }

        const userData = userDoc.data();
        if (userData.lastFreeCoinsClaimTimestamp && now - userData.lastFreeCoinsClaimTimestamp < cooldownMs) {
          throw new Error('Ücretsiz ödül süresi henüz dolmadı.');
        }

        const currentCoins = typeof userData.coins === 'number' ? userData.coins : 500;
        const finalCoins = currentCoins + rewardAmount;

        transaction.update(userRef, {
          coins: finalCoins,
          lastDailyRewardDate: today,
          lastFreeCoinsClaimTimestamp: now,
          lastLoginAt: new Date().toISOString(),
        });

        const txData: CoinTransaction = {
          id: txDocId,
          userId: profile.id,
          type: 'daily_reward',
          amount: rewardAmount,
          balanceAfter: finalCoins,
          description: `Ücretsiz Jeton (6 Saatlik Ödül)`,
          date: today,
          createdAt: new Date().toISOString(),
        };
        transaction.set(txRef, txData);
      });
    } catch (error: any) {
      if (error?.message?.includes('süresi henüz dolmadı')) {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.id}/coinTransactions/${txDocId}`);
    }
  }

  saveUserProfile(updatedProfile);
  return { updatedProfile, coinsAdded: rewardAmount };
}

/**
 * Claims reward for completing a rewarded advertisement.
 * 100 jeton kazandırır, günlük sınır yok!
 */
export async function claimAdRewardCoins(
  profile: UserProfile,
  adCompletionProof: string
): Promise<{
  updatedProfile: UserProfile;
  coinsAdded: number;
  remainingAds: number;
}> {
  const today = getTodayDateString();
  const rewardAmount = COIN_SETTINGS.REWARDED_AD_COINS;
  const currentCount = profile.adRewardsToday ?? 0;
  const nextCount = currentCount + 1;
  const newCoins = (profile.coins ?? COIN_SETTINGS.INITIAL_STARTING_COINS) + rewardAmount;

  // Call server verification API
  try {
    const response = await fetch('/api/coins/claim-ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.id,
        adProof: adCompletionProof,
        isGuest: !profile.isFirebaseUser,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (errData.error) {
        throw new Error(errData.error);
      }
    }
  } catch {
    // Network fallback
  }

  const updatedProfile: UserProfile = {
    ...profile,
    coins: newCoins,
    adRewardsToday: nextCount,
    lastAdRewardDate: today,
  };

  // If authenticated Firebase user, persist to Firestore with subcollection ledger
  if (profile.isFirebaseUser && auth.currentUser) {
    const userRef = doc(db, 'users', profile.id);
    const txDocId = `ad_${Date.now()}_${nextCount}`;
    const txRef = doc(db, 'users', profile.id, 'coinTransactions', txDocId);

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error('Kullanıcı hesabı bulunamadı.');
        }

        const userData = userDoc.data();
        const currentCoins = typeof userData.coins === 'number' ? userData.coins : 500;
        const finalCoins = currentCoins + rewardAmount;

        transaction.update(userRef, {
          coins: finalCoins,
          adRewardsToday: (userData.adRewardsToday ?? 0) + 1,
          lastAdRewardDate: today,
          lastLoginAt: new Date().toISOString(),
        });

        const txData: CoinTransaction = {
          id: txDocId,
          userId: profile.id,
          type: 'ad_reward',
          amount: rewardAmount,
          balanceAfter: finalCoins,
          description: `Reklam İzle Kazan (+100 Jeton)`,
          date: today,
          createdAt: new Date().toISOString(),
        };
        transaction.set(txRef, txData);
      });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.id}/coinTransactions/${txDocId}`);
    }
  }

  saveUserProfile(updatedProfile);
  return { updatedProfile, coinsAdded: rewardAmount, remainingAds: 999999 };
}

/**
 * Deducts entry fee when joining an online match.
 * Enforces atomic Firestore transaction and server-side ledger.
 */
export async function deductMatchEntryFee(
  profile: UserProfile,
  entryFee: number,
  roomId: string,
  tierName: string
): Promise<UserProfile> {
  const currentCoins = profile.coins ?? COIN_SETTINGS.INITIAL_STARTING_COINS;
  if (currentCoins < entryFee) {
    throw new Error(`Yetersiz bakiye! Bu odaya girmek için ${entryFee} jeton gerekiyor (Mevcut: ${currentCoins}).`);
  }

  // 1. Notify server
  try {
    const res = await fetch('/api/match/deduct-fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.id,
        roomId,
        entryFee,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.error) throw new Error(err.error);
    }
  } catch (err: any) {
    if (err.message && err.message.includes('Yetersiz')) throw err;
  }

  const finalCoins = Math.max(0, currentCoins - entryFee);
  const updatedProfile: UserProfile = {
    ...profile,
    coins: finalCoins,
  };

  // 2. Atomic Firestore transaction if authenticated
  if (profile.isFirebaseUser && auth.currentUser) {
    const today = getTodayDateString();
    const userRef = doc(db, 'users', profile.id);
    const txDocId = `fee_${roomId}_${Date.now()}`;
    const txRef = doc(db, 'users', profile.id, 'coinTransactions', txDocId);

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error('Kullanıcı bulunamadı.');

        const dbCoins = userDoc.data().coins ?? COIN_SETTINGS.INITIAL_STARTING_COINS;
        if (dbCoins < entryFee) {
          throw new Error('Yetersiz bakiye.');
        }

        const balanceAfter = dbCoins - entryFee;
        transaction.update(userRef, {
          coins: balanceAfter,
          lastLoginAt: new Date().toISOString(),
        });

        const txData: CoinTransaction = {
          id: txDocId,
          userId: profile.id,
          type: 'match_fee',
          amount: -entryFee,
          balanceAfter,
          description: `${tierName} Giriş Ücreti`,
          date: today,
          createdAt: new Date().toISOString(),
        };
        transaction.set(txRef, txData);
      });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.id}/coinTransactions/${txDocId}`);
    }
  }

  saveUserProfile(updatedProfile);
  return updatedProfile;
}

/**
 * Awards prize pool to the verified winner of an online match.
 * Guarantees single-time (idempotent) execution.
 */
export async function awardMatchPrize(
  profile: UserProfile,
  prizeAmount: number,
  roomId: string,
  tierName: string
): Promise<UserProfile> {
  // 1. Check with server to prevent duplicate prize claims
  let serverValidated = true;
  try {
    const res = await fetch('/api/match/award-prize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.id,
        roomId,
        prizeAmount,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.error) {
        throw new Error(err.error);
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('zaten')) {
      throw err;
    }
  }

  const currentCoins = profile.coins ?? COIN_SETTINGS.INITIAL_STARTING_COINS;
  const finalCoins = currentCoins + prizeAmount;
  const updatedProfile: UserProfile = {
    ...profile,
    coins: finalCoins,
    wins: (profile.wins ?? 0) + 1,
  };

  // 2. Atomic Firestore transaction if authenticated
  if (profile.isFirebaseUser && auth.currentUser) {
    const today = getTodayDateString();
    const userRef = doc(db, 'users', profile.id);
    const txDocId = `prize_${roomId}`;
    const txRef = doc(db, 'users', profile.id, 'coinTransactions', txDocId);

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error('Kullanıcı bulunamadı.');

        // Check if prize transaction already exists
        const txDoc = await transaction.get(txRef);
        if (txDoc.exists()) {
          throw new Error('Bu maçın ödülü zaten tahsil edilmiş.');
        }

        const dbCoins = userDoc.data().coins ?? COIN_SETTINGS.INITIAL_STARTING_COINS;
        const balanceAfter = dbCoins + prizeAmount;
        const wins = (userDoc.data().wins ?? 0) + 1;

        transaction.update(userRef, {
          coins: balanceAfter,
          wins,
          lastLoginAt: new Date().toISOString(),
        });

        const txData: CoinTransaction = {
          id: txDocId,
          userId: profile.id,
          type: 'match_reward',
          amount: prizeAmount,
          balanceAfter,
          description: `${tierName} Galibiyet Ödülü`,
          date: today,
          createdAt: new Date().toISOString(),
        };
        transaction.set(txRef, txData);
      });
    } catch (error: any) {
      if (error?.message?.includes('zaten')) throw error;
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.id}/coinTransactions/${txDocId}`);
    }
  }

  saveUserProfile(updatedProfile);
  return updatedProfile;
}

/**
 * Refunds match entry fee if match is cancelled or aborted before starting.
 */
export async function refundMatchEntryFee(
  profile: UserProfile,
  entryFee: number,
  roomId: string,
  tierName: string
): Promise<UserProfile> {
  try {
    await fetch('/api/match/refund-fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.id,
        roomId,
        entryFee,
      }),
    });
  } catch {
    // network fallback
  }

  const currentCoins = profile.coins ?? COIN_SETTINGS.INITIAL_STARTING_COINS;
  const finalCoins = currentCoins + entryFee;
  const updatedProfile: UserProfile = {
    ...profile,
    coins: finalCoins,
  };

  if (profile.isFirebaseUser && auth.currentUser) {
    const today = getTodayDateString();
    const userRef = doc(db, 'users', profile.id);
    const txDocId = `refund_${roomId}_${Date.now()}`;
    const txRef = doc(db, 'users', profile.id, 'coinTransactions', txDocId);

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) return;

        const dbCoins = userDoc.data().coins ?? COIN_SETTINGS.INITIAL_STARTING_COINS;
        const balanceAfter = dbCoins + entryFee;

        transaction.update(userRef, {
          coins: balanceAfter,
        });

        const txData: CoinTransaction = {
          id: txDocId,
          userId: profile.id,
          type: 'match_refund',
          amount: entryFee,
          balanceAfter,
          description: `${tierName} Maç İptali İadesi`,
          date: today,
          createdAt: new Date().toISOString(),
        };
        transaction.set(txRef, txData);
      });
    } catch (err: any) {
      console.warn('Refund firestore error:', err);
    }
  }

  saveUserProfile(updatedProfile);
  return updatedProfile;
}
