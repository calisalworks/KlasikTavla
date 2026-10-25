import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  RewardAdPluginEvents,
  AdLoadInfo,
  AdMobError,
  AdMobRewardItem,
} from '@capacitor-community/admob';

/**
 * AdMob is deliberately in Google's test mode by default.
 * Production builds must supply real IDs and explicitly set VITE_ADMOB_TEST_MODE=false.
 */
const TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';

export const ADMOB_CONFIG = {
  APP_ID: import.meta.env.VITE_ADMOB_APP_ID || TEST_APP_ID,
  REWARDED_AD_UNIT_ID: import.meta.env.VITE_ADMOB_REWARDED_AD_UNIT_ID || TEST_REWARDED_AD_UNIT_ID,
  TEST_MODE: import.meta.env.VITE_ADMOB_TEST_MODE !== 'false',
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

  /** Checks if running on a native Android device/APK. */
  public isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /** Initializes the Google Mobile Ads SDK on native platform. */
  public async initialize(): Promise<boolean> {
    if (!this.isNativeAndroid()) {
      return false;
    }

    if (this.isInitialized) {
      return true;
    }

    try {
      await AdMob.initialize({
        testingDevices: ADMOB_CONFIG.TEST_MODE ? ['EMULATOR'] : [],
        initializeForTesting: ADMOB_CONFIG.TEST_MODE,
      });

      this.setupEventListeners();
      this.isInitialized = true;
      return true;
    } catch (err) {
      console.warn('[AdMob] Initialization failed:', err);
      return false;
    }
  }

  /** Sets up native AdMob lifecycle event listeners. */
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
      // This client event is UX-only; it is not authoritative proof for coin credit.
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

  /** Preloads a rewarded video ad in background. */
  public async prepareRewardedAd(userId?: string): Promise<{ success: boolean; errorMessage?: string }> {
    if (!this.isNativeAndroid()) {
      return { success: false, errorMessage: 'AdMob yalnızca yerel Android uygulamasında çalışır.' };
    }

    try {
      await this.initialize();
      this.isLoading = true;
      this.isAdLoaded = false;
      this.sessionRewarded = false;

      await AdMob.prepareRewardVideoAd({
        adId: ADMOB_CONFIG.REWARDED_AD_UNIT_ID,
        isTesting: ADMOB_CONFIG.TEST_MODE,
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

  /** Displays the loaded rewarded ad and waits for native completion event. */
  public async showRewardedAd(userId?: string): Promise<AdMobRewardResult> {
    if (!this.isNativeAndroid()) {
      return {
        success: false,
        rewarded: false,
        rewardAmount: 0,
        errorMessage: 'Web test modundasınız. Gerçek AdMob reklamları Android APK üzerinde çalışır.',
      };
    }

    try {
      await this.initialize();

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

      // This nonce is for local session correlation only, never trusted as server-side ad proof.
      const sessionNonce = `admob_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      this.activeSessionToken = sessionNonce;
      this.sessionRewarded = false;

      const rewardItem = await AdMob.showRewardVideoAd();

      if (this.sessionRewarded || (rewardItem && rewardItem.amount > 0)) {
        return {
          success: true,
          rewarded: true,
          rewardAmount: ADMOB_CONFIG.REWARD_AMOUNT,
          adProofToken: `proof_${sessionNonce}`,
        };
      }

      return {
        success: false,
        rewarded: false,
        rewardAmount: 0,
        errorMessage: 'Reklam ödülü kazanmak için reklamı sonuna kadar izlemelisiniz. Jeton verilmedi.',
      };
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
