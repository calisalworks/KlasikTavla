import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  RewardAdPluginEvents,
  AdLoadInfo,
  AdMobError,
  AdMobRewardItem,
} from '@capacitor-community/admob';
import {
  GOOGLE_TEST_ADMOB_APP_ID,
  GOOGLE_TEST_REWARDED_AD_UNIT_ID,
  resolveAdMobConfig,
} from './admobConfig';

const runtimeAdMobConfig = resolveAdMobConfig({
  VITE_ADMOB_MODE: import.meta.env.VITE_ADMOB_MODE || (import.meta.env.DEV ? 'test' : 'disabled'),
  VITE_ADMOB_ANDROID_APP_ID: import.meta.env.VITE_ADMOB_ANDROID_APP_ID,
  VITE_ADMOB_REWARDED_AD_UNIT_ID: import.meta.env.VITE_ADMOB_REWARDED_AD_UNIT_ID,
});

/** Runtime-selected AdMob configuration; production never silently falls back to sample IDs. */
export const ADMOB_CONFIG = {
  TEST_APP_ID: GOOGLE_TEST_ADMOB_APP_ID,
  TEST_REWARDED_AD_UNIT_ID: GOOGLE_TEST_REWARDED_AD_UNIT_ID,
  APP_ID: runtimeAdMobConfig.appId,
  REWARDED_AD_UNIT_ID: runtimeAdMobConfig.rewardedAdUnitId,
  mode: runtimeAdMobConfig.mode,
  enabled: runtimeAdMobConfig.enabled,
  isTesting: runtimeAdMobConfig.isTesting,
  errorMessage: runtimeAdMobConfig.errorMessage,
  // Reward amount matching game settings (100 Jeton)
  REWARD_AMOUNT: 100,
};

export interface AdMobRewardResult {
  success: boolean;
  rewarded: boolean;
  rewardAmount: number;
  adProofToken?: string;
  errorMessage?: string;
}

class AdMobService {
  private isInitialized = false;
  private isAdLoaded = false;
  private isLoading = false;
  private activeSessionToken: string | null = null;
  private sessionRewarded = false;

  /**
   * Checks if running on a native Android device/APK.
   */
  public isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Initializes the Google Mobile Ads SDK on native platform.
   */
  public async initialize(): Promise<boolean> {
    if (!this.isNativeAndroid()) {
      return false;
    }

    if (!ADMOB_CONFIG.enabled) {
      console.warn('[AdMob] Ads disabled:', ADMOB_CONFIG.errorMessage);
      return false;
    }

    if (this.isInitialized) {
      return true;
    }

    try {
      await AdMob.initialize({
        testingDevices: ADMOB_CONFIG.isTesting ? ['EMULATOR'] : [],
        initializeForTesting: ADMOB_CONFIG.isTesting,
      });

      this.setupEventListeners();
      this.isInitialized = true;
      return true;
    } catch (err) {
      console.warn('[AdMob] Initialization failed:', err);
      return false;
    }
  }

  /**
   * Sets up native AdMob lifecycle event listeners.
   */
  private setupEventListeners(): void {
    AdMob.addListener(RewardAdPluginEvents.Loaded, (info: AdLoadInfo) => {
      console.log('[AdMob] Rewarded Ad loaded successfully:', info);
      this.isAdLoaded = true;
      this.isLoading = false;
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error: AdMobError) => {
      console.warn('[AdMob] Rewarded Ad failed to load:', error);
      this.isAdLoaded = false;
      this.isLoading = false;
    });

    AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: AdMobRewardItem) => {
      console.log('[AdMob] User earned reward:', reward);
      // Strictly set session reward flag when Google SDK fires the rewarded event
      this.sessionRewarded = true;
    });

    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      console.log('[AdMob] Rewarded Ad dismissed by user.');
      this.isAdLoaded = false;
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error: AdMobError) => {
      console.warn('[AdMob] Rewarded Ad failed to show:', error);
      this.isAdLoaded = false;
    });
  }

  /**
   * Preloads a rewarded video ad in background.
   */
  public async prepareRewardedAd(userId?: string): Promise<{ success: boolean; errorMessage?: string }> {
    if (!this.isNativeAndroid()) {
      return { success: false, errorMessage: 'AdMob yalnızca yerel Android uygulamasında çalışır.' };
    }

    if (!ADMOB_CONFIG.enabled) {
      return {
        success: false,
        errorMessage: ADMOB_CONFIG.errorMessage || 'AdMob yapılandırması eksik.',
      };
    }

    try {
      const initialized = await this.initialize();
      if (!initialized) {
        return { success: false, errorMessage: ADMOB_CONFIG.errorMessage || 'AdMob başlatılamadı.' };
      }
      this.isLoading = true;
      this.isAdLoaded = false;
      this.sessionRewarded = false;

      await AdMob.prepareRewardVideoAd({
        adId: ADMOB_CONFIG.REWARDED_AD_UNIT_ID,
        isTesting: ADMOB_CONFIG.isTesting,
        ssv: userId ? { userId } : undefined,
      });

      this.isAdLoaded = true;
      this.isLoading = false;
      return { success: true };
    } catch (err: any) {
      this.isLoading = false;
      this.isAdLoaded = false;
      const errorMsg =
        err?.message || 'Şu anda uygun reklam bulunamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyiniz.';
      return { success: false, errorMessage: errorMsg };
    }
  }

  /**
   * Displays the loaded rewarded ad and waits for native completion event.
   * Only returns success: true and a valid adProofToken if the user actually watched until the reward was earned.
   */
  public async showRewardedAd(userId?: string): Promise<AdMobRewardResult> {
    if (!this.isNativeAndroid()) {
      return {
        success: false,
        rewarded: false,
        rewardAmount: 0,
        errorMessage: 'Web test modundasınız. Gerçek AdMob reklamları Android APK üzerinde çalışır.',
      };
    }

    if (!ADMOB_CONFIG.enabled) {
      return {
        success: false,
        rewarded: false,
        rewardAmount: 0,
        errorMessage: ADMOB_CONFIG.errorMessage || 'AdMob yapılandırması eksik.',
      };
    }

    try {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          rewarded: false,
          rewardAmount: 0,
          errorMessage: ADMOB_CONFIG.errorMessage || 'AdMob başlatılamadı.',
        };
      }

      // Ensure ad is prepared if not already
      if (!this.isAdLoaded) {
        const prep = await this.prepareRewardedAd(userId);
        if (!prep.success) {
          return {
            success: false,
            rewarded: false,
            rewardAmount: 0,
            errorMessage: prep.errorMessage || 'Reklam yüklenemedi. Lütfen daha sonra tekrar deneyiniz.',
          };
        }
      }

      // Generate a single-use session nonce to prevent replay attacks
      const sessionNonce = `admob_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      this.activeSessionToken = sessionNonce;
      this.sessionRewarded = false;

      // Show native full-screen rewarded video
      const rewardItem = await AdMob.showRewardVideoAd();

      // Verify that Google AdMob SDK acknowledged the reward
      if (this.sessionRewarded || (rewardItem && rewardItem.amount > 0)) {
        const proofToken = `proof_${sessionNonce}`;
        return {
          success: true,
          rewarded: true,
          rewardAmount: ADMOB_CONFIG.REWARD_AMOUNT,
          adProofToken: proofToken,
        };
      } else {
        return {
          success: false,
          rewarded: false,
          rewardAmount: 0,
          errorMessage: 'Reklam ödülü kazanmak için reklamı sonuna kadar izlemelisiniz. Jeton verilmedi.',
        };
      }
    } catch (err: any) {
      console.warn('[AdMob] showRewardedAd error:', err);
      return {
        success: false,
        rewarded: false,
        rewardAmount: 0,
        errorMessage:
          err?.message || 'Reklam gösterilirken bir sorun oluştu veya kullanıcı reklamı erken kapattı.',
      };
    } finally {
      this.isAdLoaded = false;
      this.activeSessionToken = null;
    }
  }

  /**
   * Returns current ad load state.
   */
  public getStatus() {
    return {
      isNativeAndroid: this.isNativeAndroid(),
      isInitialized: this.isInitialized,
      isAdLoaded: this.isAdLoaded,
      isLoading: this.isLoading,
    };
  }
}

export const admobService = new AdMobService();
