import { auth } from './config';
import { UserProfile } from '../types/game';
import { COIN_SETTINGS } from '../utils/coinSettings';
import { saveUserProfile } from '../utils/profileStorage';

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

interface AuthoritativeCoinResult {
  coinEconomyEnabled?: boolean;
  balance?: number;
  transactionId?: string;
  coinsAdded?: number;
  lastFreeCoinsClaimTimestamp?: number;
  lastDailyRewardDate?: string;
  adRewardsToday?: number;
  lastAdRewardDate?: string;
  adsRemainingToday?: number;
  wins?: number;
}

function isValidPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * The client is never an authority for coin balances. Every mutation requires
 * a Firebase ID token and a server response with an authoritative balance and
 * an idempotent ledger transaction ID. The current server intentionally
 * returns 503 until trusted persistence and reward verification are deployed.
 */
async function requestCoinMutation(
  endpoint: string,
  profile: UserProfile,
  payload: Record<string, unknown>
): Promise<AuthoritativeCoinResult> {
  const user = auth.currentUser;
  if (!profile.isFirebaseUser || !user || user.uid !== profile.id) {
    throw new Error('Jeton işlemi için eşleşen, doğrulanmış Firebase hesabıyla giriş yapın.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ ...payload, userId: user.uid }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || 'Jeton işlemi sunucu tarafından onaylanmadı.');
  }

  if (
    result.coinEconomyEnabled !== true ||
    typeof result.balance !== 'number' ||
    !Number.isSafeInteger(result.balance) ||
    result.balance < 0 ||
    typeof result.transactionId !== 'string' ||
    result.transactionId.length < 1
  ) {
    throw new Error('Sunucu güvenilir bakiye ve işlem makbuzu döndürmedi; jeton bakiyesi değiştirilmedi.');
  }

  return result as AuthoritativeCoinResult;
}

/** UI hint only; the server must enforce every cooldown and limit. */
export function getRewardStatus(profile: UserProfile): CoinRewardStatus {
  const now = Date.now();
  const cooldownMs = COIN_SETTINGS.FREE_COINS_COOLDOWN_MS;
  const lastClaim = profile.lastFreeCoinsClaimTimestamp;
  const elapsed = lastClaim ? now - lastClaim : cooldownMs;
  const msRemaining = Math.max(0, cooldownMs - elapsed);
  const totalSeconds = Math.floor(msRemaining / 1000);

  return {
    canClaimDaily: msRemaining === 0,
    canClaimFree: msRemaining === 0,
    dailyRewardCoins: COIN_SETTINGS.FREE_COINS_AMOUNT,
    freeRewardCoins: COIN_SETTINGS.FREE_COINS_AMOUNT,
    lastFreeCoinsClaimTimestamp: lastClaim,
    lastDailyRewardDate: profile.lastDailyRewardDate,
    msUntilFreeReset: msRemaining,
    hoursUntilReset: Math.floor(totalSeconds / 3600),
    minutesUntilReset: Math.floor((totalSeconds % 3600) / 60),
    secondsUntilReset: totalSeconds % 60,
    // Display values only. Server-side policy is authoritative.
    canWatchAd: false,
    adRewardCoins: COIN_SETTINGS.REWARDED_AD_COINS,
    adsWatchedToday: profile.adRewardsToday ?? 0,
    adsRemainingToday: 0,
    maxDailyAds: 0,
  };
}

/** Claims the six-hour free reward only after a trusted server receipt. */
export async function claimDailyCoins(profile: UserProfile): Promise<{
  updatedProfile: UserProfile;
  coinsAdded: number;
}> {
  const now = Date.now();
  const cooldownMs = COIN_SETTINGS.FREE_COINS_COOLDOWN_MS;
  const lastClaim = profile.lastFreeCoinsClaimTimestamp;
  if (lastClaim && now - lastClaim < cooldownMs) {
    const remainingMinutes = Math.ceil((cooldownMs - (now - lastClaim)) / 60000);
    throw new Error(`Ücretsiz ödülünüz için henüz süre dolmadı. Lütfen ${remainingMinutes} dakika sonra tekrar deneyin.`);
  }

  const result = await requestCoinMutation('/api/coins/claim-daily', profile, {});
  if (
    result.coinsAdded !== COIN_SETTINGS.FREE_COINS_AMOUNT ||
    typeof result.lastFreeCoinsClaimTimestamp !== 'number' ||
    typeof result.lastDailyRewardDate !== 'string'
  ) {
    throw new Error('Sunucu günlük ödül için eksiksiz doğrulanmış makbuz döndürmedi.');
  }

  const updatedProfile: UserProfile = {
    ...profile,
    coins: result.balance!,
    lastDailyRewardDate: result.lastDailyRewardDate,
    lastFreeCoinsClaimTimestamp: result.lastFreeCoinsClaimTimestamp,
  };
  saveUserProfile(updatedProfile);
  return { updatedProfile, coinsAdded: result.coinsAdded };
}

/**
 * An ad callback/proof supplied by the client is only an untrusted hint.
 * The server must validate AdMob SSV independently before issuing a receipt.
 */
export async function claimAdRewardCoins(
  profile: UserProfile,
  adCompletionProof: string
): Promise<{
  updatedProfile: UserProfile;
  coinsAdded: number;
  remainingAds: number;
}> {
  if (typeof adCompletionProof !== 'string' || adCompletionProof.length < 1 || adCompletionProof.length > 2048) {
    throw new Error('Reklam ödülü isteği geçersiz.');
  }

  const result = await requestCoinMutation('/api/coins/claim-ad', profile, {
    adProof: adCompletionProof,
  });
  if (
    result.coinsAdded !== COIN_SETTINGS.REWARDED_AD_COINS ||
    typeof result.adRewardsToday !== 'number' ||
    !Number.isSafeInteger(result.adRewardsToday) ||
    typeof result.lastAdRewardDate !== 'string' ||
    typeof result.adsRemainingToday !== 'number' ||
    !Number.isSafeInteger(result.adsRemainingToday) ||
    result.adsRemainingToday < 0
  ) {
    throw new Error('Sunucu reklam ödülü için eksiksiz doğrulanmış makbuz döndürmedi.');
  }

  const updatedProfile: UserProfile = {
    ...profile,
    coins: result.balance!,
    adRewardsToday: result.adRewardsToday!,
    lastAdRewardDate: result.lastAdRewardDate,
  };
  saveUserProfile(updatedProfile);
  return {
    updatedProfile,
    coinsAdded: result.coinsAdded,
    remainingAds: result.adsRemainingToday!,
  };
}

/** Match fee mutations are server-authoritative; no client Firestore writes. */
export async function deductMatchEntryFee(
  profile: UserProfile,
  entryFee: number,
  roomId: string,
  tierName: string
): Promise<UserProfile> {
  if (!isValidPositiveInteger(entryFee) || !roomId) throw new Error('Maç giriş ücreti isteği geçersiz.');

  const result = await requestCoinMutation('/api/match/deduct-fee', profile, { roomId, entryFee, tierName });
  const updatedProfile: UserProfile = { ...profile, coins: result.balance! };
  saveUserProfile(updatedProfile);
  return updatedProfile;
}

/** Awards a prize only when the server confirms it and returns its ledger receipt. */
export async function awardMatchPrize(
  profile: UserProfile,
  prizeAmount: number,
  roomId: string,
  tierName: string
): Promise<UserProfile> {
  if (!isValidPositiveInteger(prizeAmount) || !roomId) throw new Error('Maç ödülü isteği geçersiz.');

  const result = await requestCoinMutation('/api/match/award-prize', profile, { roomId, prizeAmount, tierName });
  if (typeof result.wins !== 'number' || !Number.isSafeInteger(result.wins) || result.wins < 0) {
    throw new Error('Sunucu maç ödülü için doğrulanmış galibiyet sayısı döndürmedi.');
  }

  const updatedProfile: UserProfile = {
    ...profile,
    coins: result.balance!,
    wins: result.wins,
  };
  saveUserProfile(updatedProfile);
  return updatedProfile;
}

/** Refunds require the same trusted server receipt as every other mutation. */
export async function refundMatchEntryFee(
  profile: UserProfile,
  entryFee: number,
  roomId: string,
  tierName: string
): Promise<UserProfile> {
  if (!isValidPositiveInteger(entryFee) || !roomId) throw new Error('Maç iadesi isteği geçersiz.');

  const result = await requestCoinMutation('/api/match/refund-fee', profile, { roomId, entryFee, tierName });
  const updatedProfile: UserProfile = { ...profile, coins: result.balance! };
  saveUserProfile(updatedProfile);
  return updatedProfile;
}
