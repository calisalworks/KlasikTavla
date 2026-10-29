import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db, auth } from './config';
import { UserProfile, CoinTransaction } from '../types/game';
import { COIN_SETTINGS, getTodayDateString, getTimeUntilNextReset } from '../utils/coinSettings';
import { saveUserProfile, getUserProfile } from '../utils/profileStorage';
import { handleFirestoreError, OperationType } from './firestoreErrors';

/** Attach a fresh Firebase ID token to server API calls when the player is signed in.
 * Guest requests intentionally have no bearer token and must never be treated as verified users.
 */
async function getServerAuthHeaders(profile: UserProfile): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const currentUser = auth.currentUser;

  if (profile.isFirebaseUser) {
    if (!currentUser) {
      throw new Error('Oturum doğrulanamadı. Lütfen tekrar giriş yapın.');
    }
    if (currentUser.uid !== profile.id) {
      throw new Error('Oturum ile oyuncu hesabı eşleşmiyor. Lütfen tekrar giriş yapın.');
    }
    headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
  } else if (currentUser) {
    // Do not silently send a signed-in Firebase identity for a guest profile.
    throw new Error('Misafir hesabı ile oturum açılmış hesap eşleşmiyor. Lütfen hesabınızı yenileyin.');
  }

  return headers;
}

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
      headers: await getServerAuthHeaders(profile),
      body: JSON.stringify({
        userId: profile.id,
        isGuest: !profile.isFirebaseUser,
        claimTimestamp: now,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Ücretsiz jeton ödülü doğrulanamadı.');
    }
  } catch (err) {
    // Never grant a local reward when the server cannot confirm the claim.
    throw err instanceof Error ? err : new Error('Ücretsiz jeton ödülü doğrulanamadı.');
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
  const response = await fetch('/api/coins/claim-ad', {
    method: 'POST',
    headers: await getServerAuthHeaders(profile),
    body: JSON.stringify({
      userId: profile.id,
      adProof: adCompletionProof,
      isGuest: !profile.isFirebaseUser,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Reklam ödülü doğrulanamadı.');
  }

  const updatedProfile: UserProfile = {
    ...profile,
    coins: newCoins,
    adRewardsToday: nextCount,
    lastAdRewardDate: today,
  };

  // If authenticated Firebase user, persist to Firestore with idempotent subcollection ledger
  if (profile.isFirebaseUser && auth.currentUser) {
    const userRef = doc(db, 'users', profile.id);
    const cleanProof = adCompletionProof.replace(/[^a-zA-Z0-9_-]/g, '_');
    const txDocId = `ad_${cleanProof}`;
    const txRef = doc(db, 'users', profile.id, 'coinTransactions', txDocId);

    try {
      await runTransaction(db, async (transaction) => {
        const txDoc = await transaction.get(txRef);
        if (txDoc.exists()) {
          throw new Error('Bu reklam ödülü zaten hesabınıza tanımlandı.');
        }

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
      throw error;
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
      headers: await getServerAuthHeaders(profile),
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
  } catch (err) {
    // A failed or unavailable server must never be treated as a successful fee deduction.
    throw err instanceof Error ? err : new Error('Maç giriş ücreti sunucu tarafından doğrulanamadı.');
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
      headers: await getServerAuthHeaders(profile),
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
  } catch (err) {
    // Do not continue to local/Firestore prize updates unless the server accepted the award.
    throw err instanceof Error ? err : new Error('Maç ödülü sunucu tarafından doğrulanamadı.');
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
  const refundResponse = await fetch('/api/match/refund-fee', {
    method: 'POST',
    headers: await getServerAuthHeaders(profile),
    body: JSON.stringify({
      userId: profile.id,
      roomId,
      entryFee,
    }),
  });
  if (!refundResponse.ok) {
    const err = await refundResponse.json().catch(() => ({}));
    throw new Error(err.error || 'Maç ücreti iadesi sunucu tarafından doğrulanamadı.');
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
