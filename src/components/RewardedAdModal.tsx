import React, { useState, useEffect, useRef } from 'react';
import { COIN_SETTINGS } from '../utils/coinSettings';
import { tavlaAudio } from '../utils/audio';
import { admobService } from '../services/admobService';
import {
  Play,
  CheckCircle,
  Coins,
  AlertTriangle,
  Smartphone,
  Globe,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface RewardedAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdCompleted: (adProofToken: string) => Promise<void>;
  remainingAdsToday: number;
  userId?: string;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  isOpen,
  onClose,
  onAdCompleted,
  remainingAdsToday,
  userId,
}) => {
  const isAndroid = admobService.isNativeAndroid();

  // Android Native Ad State
  const [adStatus, setAdStatus] = useState<'idle' | 'loading' | 'ready' | 'showing' | 'completed' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  // Web Fallback Simulation Timer
  const [webSecondsLeft, setWebSecondsLeft] = useState(COIN_SETTINGS.TEST_AD_DURATION_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and load ad on open
  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAdStatus('idle');
      setErrorMessage(null);
      setIsClaiming(false);
      return;
    }

    setErrorMessage(null);
    setIsClaiming(false);

    if (isAndroid) {
      // Native Android AdMob Lifecycle
      loadAndroidAd();
    } else {
      // Web simulation preview mode
      setWebSecondsLeft(COIN_SETTINGS.TEST_AD_DURATION_SECONDS);
      let rem = COIN_SETTINGS.TEST_AD_DURATION_SECONDS;
      timerRef.current = setInterval(() => {
        rem -= 1;
        if (rem <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          setWebSecondsLeft(0);
          tavlaAudio.playVictory();
        } else {
          setWebSecondsLeft(rem);
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isAndroid]);

  // Preloads the native AdMob rewarded ad
  const loadAndroidAd = async () => {
    setAdStatus('loading');
    setErrorMessage(null);

    const result = await admobService.prepareRewardedAd(userId);
    if (result.success) {
      setAdStatus('ready');
    } else {
      setAdStatus('failed');
      setErrorMessage(
        result.errorMessage || 'Şu anda uygun reklam bulunamadı. Lütfen daha sonra tekrar deneyiniz.'
      );
    }
  };

  // Triggers native AdMob full-screen video
  const handleWatchNativeAd = async () => {
    if (adStatus !== 'ready') return;
    setAdStatus('showing');
    setErrorMessage(null);

    try {
      const result = await admobService.showRewardedAd(userId);

      if (result.rewarded && result.adProofToken) {
        // User strictly earned reward from Google AdMob SDK
        setAdStatus('completed');
        setIsClaiming(true);
        tavlaAudio.playVictory();

        try {
          await onAdCompleted(result.adProofToken);
          onClose();
        } catch (claimErr: any) {
          setErrorMessage(claimErr?.message || 'Ödül hesabınıza tanımlanırken bir sorun oluştu.');
          setAdStatus('failed');
        } finally {
          setIsClaiming(false);
        }
      } else {
        // User dismissed early, skipped, or ad failed to show -> NO COINS
        setAdStatus('failed');
        setErrorMessage(
          result.errorMessage ||
            'Reklam ödülünü kazanmak için reklamı sonuna kadar izlemelisiniz. Jeton verilmedi.'
        );
      }
    } catch (err: any) {
      setAdStatus('failed');
      setErrorMessage(err?.message || 'Reklam gösterilirken bir sorun oluştu. Jeton verilmedi.');
    }
  };

  if (!isOpen) return null;

  const webProgressPercent = Math.min(
    100,
    Math.round(
      ((COIN_SETTINGS.TEST_AD_DURATION_SECONDS - webSecondsLeft) /
        COIN_SETTINGS.TEST_AD_DURATION_SECONDS) *
        100
    )
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-[#2a170d] via-[#1e0f07] to-[#120803] border-2 border-amber-600/70 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-amber-100 flex flex-col items-center overflow-hidden">
        {/* Test Mode Banner */}
        <div className="w-full mb-3 px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/40 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>TEST MODU: Google AdMob</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-amber-200/80 bg-[#160c06] px-2 py-0.5 rounded-md border border-amber-700/30">
            {isAndroid ? (
              <>
                <Smartphone className="w-3 h-3 text-emerald-400" />
                <span>Android Native SDK</span>
              </>
            ) : (
              <>
                <Globe className="w-3 h-3 text-cyan-400" />
                <span>Web Simülasyonu</span>
              </>
            )}
          </div>
        </div>

        {/* Video / Status Screen Container */}
        <div className="w-full aspect-video rounded-xl bg-gradient-to-b from-[#100803] to-[#201006] border border-amber-700/40 relative overflow-hidden flex flex-col items-center justify-center p-4 shadow-inner">
          {/* Animated Background Grid */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />

          {isAndroid ? (
            /* Android Native AdMob States */
            adStatus === 'loading' ? (
              <div className="relative z-10 flex flex-col items-center text-center">
                <Loader2 className="w-9 h-9 animate-spin text-amber-400 mb-2" />
                <h4 className="text-sm font-bold text-amber-200">AdMob Reklamı Yükleniyor...</h4>
                <p className="text-[10px] text-amber-300/70 mt-1">Google Test Ağına bağlanılıyor</p>
              </div>
            ) : adStatus === 'ready' ? (
              <div className="relative z-10 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                <div className="w-11 h-11 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 mb-2 shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                  <Play className="w-6 h-6 ml-0.5 text-amber-300" />
                </div>
                <h4 className="text-sm font-extrabold text-white">Reklam Hazır!</h4>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  İzleyip bitirdiğinizde <strong>+{COIN_SETTINGS.REWARDED_AD_COINS} Jeton</strong> kazanacaksınız
                </p>
              </div>
            ) : adStatus === 'showing' ? (
              <div className="relative z-10 flex flex-col items-center text-center">
                <Smartphone className="w-8 h-8 text-amber-400 animate-pulse mb-2" />
                <h4 className="text-sm font-bold text-amber-200">Reklam Tam Ekranda Oynatılıyor</h4>
                <p className="text-[10px] text-amber-300/70 mt-1">Ödülü kazanmak için reklamı kapatmayınız</p>
              </div>
            ) : adStatus === 'completed' ? (
              <div className="relative z-10 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 mb-2 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h4 className="text-base font-extrabold text-white mb-0.5">Reklam Başarıyla Tamamlandı!</h4>
                <p className="text-xs text-emerald-300 font-semibold">
                  Ödülünüz hesabınıza tanımlanıyor: +{COIN_SETTINGS.REWARDED_AD_COINS} Jeton
                </p>
              </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center text-center p-2">
                <AlertTriangle className="w-8 h-8 text-amber-500 mb-1" />
                <h4 className="text-xs font-bold text-amber-200">Reklam Başlatılamadı</h4>
                <p className="text-[10px] text-amber-300/70 mt-0.5 max-w-[260px] leading-relaxed">
                  {errorMessage || 'Şu anda uygun test reklamı bulunamadı.'}
                </p>
              </div>
            )
          ) : (
            /* Web Fallback Simulation States */
            webSecondsLeft === 0 ? (
              <div className="relative z-10 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                <div className="w-11 h-11 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 mb-2">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-extrabold text-white">Web Simülasyonu Tamamlandı</h4>
                <p className="text-[10px] text-cyan-300/80 mt-0.5 max-w-[260px]">
                  Web ortamında jeton üretilmez. Gerçek ödüllü reklamlar ve jeton kazanımı Android uygulamasında (APK) aktiftir.
                </p>
              </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-amber-600/30 border border-amber-400/50 flex items-center justify-center text-amber-300 mb-2 animate-pulse">
                  <Play className="w-5 h-5 ml-0.5" />
                </div>
                <div className="text-xs font-bold text-amber-200 mb-1">Web Önizleme Test Modu</div>
                <p className="text-[10px] text-amber-300/70 max-w-[240px] leading-relaxed">
                  Gerçek AdMob SDK mobil cihazda çalışır. Web üzerinde yalnızca arayüz simülasyonu gösterilir.
                </p>
                <div className="mt-2 px-2.5 py-0.5 rounded-full bg-black/70 border border-amber-500/50 text-[10px] font-bold text-amber-300">
                  Simülasyon: <strong>{webSecondsLeft}s</strong>
                </div>
              </div>
            )
          )}

          {/* Web Progress Bar */}
          {!isAndroid && (
            <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/60">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-400 transition-all duration-300"
                style={{ width: `${webProgressPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Info & Rewards */}
        <div className="w-full mt-3 flex items-center justify-between text-xs text-amber-300/80 px-1">
          <div className="flex items-center gap-1.5 font-medium">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>
              Kazanılacak:{' '}
              <strong className="text-amber-200">
                {isAndroid ? `+${COIN_SETTINGS.REWARDED_AD_COINS} Jeton` : '0 Jeton (Web Modu)'}
              </strong>
            </span>
          </div>
          <div className="text-[11px] font-semibold text-amber-300/90">
            Hak: <strong className="text-emerald-400">Sınırsız</strong>
          </div>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div className="w-full mt-2 p-2 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs text-center leading-relaxed">
            {errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full mt-3 flex items-center gap-2">
          {/* Close button */}
          <button
            onClick={onClose}
            disabled={adStatus === 'showing' || isClaiming}
            className="flex-1 py-2 px-3 rounded-xl bg-[#221006] hover:bg-[#2e170a] text-amber-400/80 hover:text-amber-200 text-xs font-semibold border border-amber-800/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            {adStatus === 'completed' ? 'Kapat' : 'Vazgeç'}
          </button>

          {/* Primary Action Button */}
          {isAndroid ? (
            adStatus === 'failed' ? (
              <button
                onClick={loadAndroidAd}
                className="flex-1 py-2 px-4 rounded-xl bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-white font-black text-xs border border-amber-400 shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tekrar Dene</span>
              </button>
            ) : (
              <button
                onClick={handleWatchNativeAd}
                disabled={adStatus !== 'ready' || isClaiming}
                className="flex-1 py-2 px-4 rounded-xl bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-900 hover:from-emerald-500 hover:to-emerald-800 text-white font-black text-xs border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isClaiming || adStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>{isClaiming ? 'Tanımlanıyor...' : 'Yükleniyor...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>REKLAMI BAŞLAT</span>
                  </>
                )}
              </button>
            )
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-xl bg-[#2e1c12] hover:bg-[#3d2518] text-amber-300 font-bold text-xs border border-amber-700/60 transition-all cursor-pointer"
            >
              Kapat (Web Modu)
            </button>
          )}
        </div>

        {/* Environmental Platform Note */}
        <div className="mt-2 text-[9px] text-amber-400/50 text-center leading-tight">
          {isAndroid
            ? 'Android APK sürümünde Google AdMob Resmi Test Ödüllü Reklam SDK aktiftir.'
            : 'Web tarayıcısında gerçek jeton üretimi kapalıdır; AdMob yalnızca Android APK üzerinde jeton kazandırır.'}
        </div>
      </div>
    </div>
  );
};
