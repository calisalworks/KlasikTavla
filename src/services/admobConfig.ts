export const GOOGLE_TEST_ADMOB_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
export const GOOGLE_TEST_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';

export type AdMobMode = 'test' | 'production' | 'disabled';

export interface AdMobRuntimeConfig {
  mode: AdMobMode;
  enabled: boolean;
  isTesting: boolean;
  appId: string;
  rewardedAdUnitId: string;
  errorMessage?: string;
}

/**
 * Test ads are enabled only by an explicit test mode (or Vite dev mode at the call site).
 * A production build with missing or sample IDs disables ads instead of silently shipping
 * Google's sample units as if they were the game's live monetization configuration.
 */
export function resolveAdMobConfig(env: Record<string, string | undefined>): AdMobRuntimeConfig {
  if (env.VITE_ADMOB_MODE === 'test') {
    return {
      mode: 'test',
      enabled: true,
      isTesting: true,
      appId: env.VITE_ADMOB_ANDROID_APP_ID || GOOGLE_TEST_ADMOB_APP_ID,
      rewardedAdUnitId: env.VITE_ADMOB_REWARDED_AD_UNIT_ID || GOOGLE_TEST_REWARDED_AD_UNIT_ID,
    };
  }

  if (env.VITE_ADMOB_MODE === 'production') {
    const appId = env.VITE_ADMOB_ANDROID_APP_ID || '';
    const rewardedAdUnitId = env.VITE_ADMOB_REWARDED_AD_UNIT_ID || '';
    const validAppId = /^ca-app-pub-\d+~\d+$/.test(appId) && appId !== GOOGLE_TEST_ADMOB_APP_ID;
    const validRewardedUnit = /^ca-app-pub-\d+\/\d+$/.test(rewardedAdUnitId)
      && rewardedAdUnitId !== GOOGLE_TEST_REWARDED_AD_UNIT_ID;

    if (!validAppId || !validRewardedUnit) {
      return {
        mode: 'disabled',
        enabled: false,
        isTesting: false,
        appId: '',
        rewardedAdUnitId: '',
        errorMessage: 'Üretim AdMob kimlikleri yapılandırılmamış. Reklamlar güvenlik için devre dışı bırakıldı.',
      };
    }

    return { mode: 'production', enabled: true, isTesting: false, appId, rewardedAdUnitId };
  }

  return {
    mode: 'disabled',
    enabled: false,
    isTesting: false,
    appId: '',
    rewardedAdUnitId: '',
    errorMessage: 'AdMob modu açıkça yapılandırılmadığı için reklamlar devre dışı.',
  };
}
