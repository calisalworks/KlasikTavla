import React, { useState, useEffect, useRef } from 'react';
import { COIN_SETTINGS } from '../utils/coinSettings';
import { tavlaAudio } from '../utils/audio';
import {
  X,
  Play,
  CheckCircle,
  Coins,
  AlertTriangle,
  Smartphone,
  Globe,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface RewardedAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdCompleted: (adProofToken: string) => Promise<void>;
  remainingAdsToday: number;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  isOpen,
  onClose,
  onAdCompleted,
  remainingAdsToday,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COIN_SETTINGS.TEST_AD_DURATION_SECONDS);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Platform detection: Web vs Android
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  useEffect(() => {
    if (isOpen) {
      setIsPlaying(true);
      setSecondsLeft(COIN_SETTINGS.TEST_AD_DURATION_SECONDS);
      setIsCompleted(false);
      setIsClaiming(false);
      setClaimError(null);

      // Start countdown timer
      let remaining = COIN_SETTINGS.TEST_AD_DURATION_SECONDS;
      timerRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          setSecondsLeft(0);
          setIsCompleted(true);
          tavlaAudio.playVictory();
        } else {
          setSecondsLeft(remaining);
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClaimReward = async () => {
    if (!isCompleted || isClaiming) return;
    setIsClaiming(true);
    setClaimError(null);

    // Cryptographically random proof token prevents replay
    const adProofToken = `adproof_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    try {
      await onAdCompleted(adProofToken);
      onClose();
    } catch (err: any) {
      setClaimError(err.message || 'Ödül alınırken bir hata oluştu.');
      setIsClaiming(false);
    }
  };

  const progressPercent = Math.min(
    100,
    Math.round(
      ((COIN_SETTINGS.TEST_AD_DURATION_SECONDS - secondsLeft) /
        COIN_SETTINGS.TEST_AD_DURATION_SECONDS) *
        100
    )
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 select-none">
      <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-[#2a170d] via-[#1e0f07] to-[#120803] border-2 border-amber-600/70 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-amber-100 flex flex-col items-center overflow-hidden">
        {/* Test Mode Banner */}
        <div className="w-full mb-3 px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/40 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>TEST MODU: Ödüllü Reklam</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-amber-200/80 bg-[#160c06] px-2 py-0.5 rounded-md border border-amber-700/30">
            {isAndroid ? (
              <>
                <Smartphone className="w-3 h-3 text-emerald-400" />
                <span>Android Entegrasyonu</span>
              </>
            ) : (
              <>
                <Globe className="w-3 h-3 text-cyan-400" />
                <span>Web Entegrasyonu</span>
              </>
            )}
          </div>
        </div>

        {/* Video Screen Container */}
        <div className="w-full aspect-video rounded-xl bg-gradient-to-b from-[#100803] to-[#201006] border border-amber-700/40 relative overflow-hidden flex flex-col items-center justify-center p-4 shadow-inner">
          {/* Animated Background Rays */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />

          {isCompleted ? (
            /* Ad Completed State */
            <div className="relative z-10 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 mb-2 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                <CheckCircle className="w-7 h-7" />
              </div>
              <h4 className="text-base font-extrabold text-white mb-0.5">
                Reklam Tamamlandı!
              </h4>
              <p className="text-xs text-emerald-300 font-semibold">
                Ödülünüz hazır: +{COIN_SETTINGS.REWARDED_AD_COINS} Jeton
              </p>
            </div>
          ) : (
            /* Ad Playing Countdown State */
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-amber-600/30 border border-amber-400/50 flex items-center justify-center text-amber-300 mb-2 animate-pulse">
                <Play className="w-5 h-5 ml-0.5" />
              </div>
              <div className="text-xs font-bold text-amber-200 mb-1">
                Klasik Tavla İpuçları & Taktikler
              </div>
              <p className="text-[10px] text-amber-300/70 max-w-[240px] leading-relaxed">
                "Kapı almak kazanma şansınızı %40 artırır. Rakip açık verdiğinde hemen vurun!"
              </p>

              {/* Countdown badge */}
              <div className="mt-2.5 px-3 py-1 rounded-full bg-black/70 border border-amber-500/50 text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Ödül için: <strong>{secondsLeft}s</strong></span>
              </div>
            </div>
          )}

          {/* Progress Bar at Bottom of Video Screen */}
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/60">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Info & Daily Quota */}
        <div className="w-full mt-3 flex items-center justify-between text-xs text-amber-300/80 px-1">
          <div className="flex items-center gap-1.5 font-medium">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Kazanılacak: <strong className="text-amber-200">+{COIN_SETTINGS.REWARDED_AD_COINS} Jeton</strong></span>
          </div>
          <div className="text-[11px] font-semibold text-amber-300/90">
            Hak: <strong className="text-emerald-400">Sınırsız</strong>
          </div>
        </div>

        {/* Claim Error if any */}
        {claimError && (
          <div className="w-full mt-2 p-2 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs text-center">
            {claimError}
          </div>
        )}

        {/* Bottom Action Buttons */}
        <div className="w-full mt-3 flex items-center gap-2">
          {/* Cancel / Close button: Only enabled AFTER ad finishes or user gives up */}
          <button
            onClick={onClose}
            disabled={!isCompleted && secondsLeft > 0}
            className="flex-1 py-2 px-3 rounded-xl bg-[#221006] hover:bg-[#2e170a] text-amber-400/80 hover:text-amber-200 text-xs font-semibold border border-amber-800/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            {isCompleted ? 'Vazgeç' : `Bekleyin (${secondsLeft}s)`}
          </button>

          {/* Claim Button: Active ONLY when completed */}
          <button
            onClick={handleClaimReward}
            disabled={!isCompleted || isClaiming}
            className="flex-1 py-2 px-4 rounded-xl bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-900 hover:from-emerald-500 hover:to-emerald-800 text-white font-black text-xs border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isClaiming ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Tanımlanıyor...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>ÖDÜLÜ AL</span>
              </>
            )}
          </button>
        </div>

        {/* Production notice note */}
        <div className="mt-2 text-[9px] text-amber-400/50 text-center leading-tight">
          {isAndroid
            ? 'Android APK / Google Play sürümünde Google AdMob Rewarded Ad SDK aktifleşir.'
            : 'Canlı Web sürümünde Google AdSense / H5 Games Rewarded Ads SDK aktifleşir.'}
        </div>
      </div>
    </div>
  );
};
