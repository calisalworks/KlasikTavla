import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types/game';
import { tavlaAudio } from '../utils/audio';
import { AvatarDisplay } from './AvatarDisplay';
import { getRewardStatus } from '../firebase/coinService';
import { LeaderboardModal } from './LeaderboardModal';
import {
  Bot,
  Globe,
  BookOpen,
  Settings,
  Maximize,
  Trophy,
  User as UserIcon,
  Sparkles,
  Coins,
  AlertCircle,
  X,
  Loader2,
  Gift,
  Video,
  Clock,
  CheckCircle2,
  Users,
} from 'lucide-react';

interface MainMenuProps {
  onStartSinglePlayer: () => void;
  onOpenOnlineLobby: () => void;
  onOpenFriendRoom: () => void;
  onOpenProfile: () => void;
  onOpenRules: () => void;
  onOpenSettings: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  profile: UserProfile;
  onLoginWithGoogle: () => void;
  onLogout: () => void;
  isAuthLoading: boolean;
  authError: string | null;
  onClearAuthError: () => void;
  onClaimDailyReward: () => Promise<void>;
  onOpenRewardedAd: () => void;
  isClaimingReward?: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartSinglePlayer,
  onOpenOnlineLobby,
  onOpenFriendRoom,
  onOpenProfile,
  onOpenRules,
  onOpenSettings,
  onToggleFullscreen,
  isFullscreen,
  profile,
  onLoginWithGoogle,
  onLogout,
  isAuthLoading,
  authError,
  onClearAuthError,
  onClaimDailyReward,
  onOpenRewardedAd,
  isClaimingReward = false,
}) => {
  const [rewardClaimError, setRewardClaimError] = useState<string | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  // Live 1-second ticker for precise 6-hour countdown display
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute live reward status based on user account
  const rewardStatus = getRewardStatus(profile);

  const handleClaimDaily = async () => {
    if (!rewardStatus.canClaimDaily || isClaimingReward) return;
    setRewardClaimError(null);
    try {
      tavlaAudio.playButtonClick();
      await onClaimDailyReward();
    } catch (err: any) {
      setRewardClaimError(err.message || 'Ücretsiz jeton alınırken bir hata oluştu.');
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1c0f08] via-[#2a170d] to-[#120803] p-3 select-none overflow-hidden">
      {/* Top-Left Corner: Profile Avatar, Details & Google Login/Logout */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
        <div
          onClick={() => {
            tavlaAudio.playButtonClick();
            onOpenProfile();
          }}
          className="p-1 sm:p-1.5 pr-2.5 sm:pr-3 rounded-2xl bg-[#261308]/95 hover:bg-[#381c0c] text-amber-100 border border-amber-600/60 shadow-[0_4px_14px_rgba(0,0,0,0.8)] cursor-pointer transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 max-w-[190px] sm:max-w-[260px]"
          title="Profil ve İstatistikleri Görüntüle"
        >
          <div className="relative shrink-0">
            <AvatarDisplay
              avatar={profile.avatar}
              name={profile.name}
              frameId={profile.equippedFrame || 'frame-1'}
              size={34}
            />
            {profile.isFirebaseUser && (
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-[#261308] flex items-center justify-center text-[7px] text-white font-black shadow">
                ✓
              </span>
            )}
          </div>
          <div className="min-w-0 flex flex-col text-left">
            <div className="text-xs font-bold text-amber-100 truncate max-w-[80px] sm:max-w-[130px]">
              {profile.name}
            </div>
            <div className="text-[10px] text-amber-400 flex items-center gap-1 font-semibold">
              <Coins className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-amber-200">{profile.coins?.toLocaleString() ?? '500'}</span>
            </div>
          </div>
        </div>

        {/* Google Login for Guest User */}
        {!profile.isFirebaseUser && (
          <button
            onClick={() => {
              tavlaAudio.playButtonClick();
              onLoginWithGoogle();
            }}
            disabled={isAuthLoading}
            title="Google ile Giriş Yap"
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-stone-100 active:scale-95 text-stone-900 text-xs font-bold shadow-md border border-stone-300 flex items-center gap-1.5 cursor-pointer transition-all shrink-0 disabled:opacity-50"
          >
            {isAuthLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
            ) : (
              <>
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.15C3.25 21.31 7.31 24 12 24z" />
                  <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.39l4-3.15z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.61l4 3.15c.95-2.85 3.6-4.96 6.73-4.96z" />
                </svg>
                <span className="hidden sm:inline text-[11px] font-semibold text-stone-800">Giriş Yap</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Top-Right Corner Action Symbols: Leaderboard, Fullscreen and Settings */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
        {/* Sıralama Sekmesi / Butonu */}
        <button
          onClick={() => {
            tavlaAudio.playButtonClick();
            setIsLeaderboardOpen(true);
          }}
          title="Kupa Sıralaması & Lider Tablosu"
          className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#3d2010] to-[#261308] hover:from-[#522b16] hover:to-[#381c0c] text-amber-200 border border-amber-500/70 shadow-[0_4px_12px_rgba(0,0,0,0.7)] cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-amber-200">Sıralama</span>
        </button>

        <button
          onClick={() => {
            tavlaAudio.playButtonClick();
            onToggleFullscreen();
          }}
          title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Yap'}
          className="p-2 rounded-xl bg-[#261308]/95 hover:bg-[#381c0c] text-amber-300 border border-amber-600/60 shadow-[0_4px_12px_rgba(0,0,0,0.7)] cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
        >
          <Maximize className="w-4 h-4 text-amber-300" />
        </button>

        <button
          onClick={() => {
            tavlaAudio.playButtonClick();
            onOpenSettings();
          }}
          title="Ayarlar ve Tavla Kuralları"
          className="p-2 rounded-xl bg-[#261308]/95 hover:bg-[#381c0c] text-amber-300 border border-amber-600/60 shadow-[0_4px_12px_rgba(0,0,0,0.7)] cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
        >
          <Settings className="w-4 h-4 text-amber-300" />
        </button>
      </div>

      {/* Main Wood Craft Menu Board */}
      <div className="relative z-10 w-full max-w-md sm:max-w-lg rounded-3xl bg-gradient-to-b from-[#6b3816] via-[#4e270d] to-[#341807] border-4 border-[#241004] p-4 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.95),inset_0_2px_4px_rgba(255,255,255,0.2)] flex flex-col items-center">
        {/* Header / Title (Küçültülmüş ve yukarı taşınmış Klasik Tavla) */}
        <div className="text-center mb-4 mt-0.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-200 to-amber-400 tracking-wider font-['Cinzel',serif] drop-shadow-md">
            KLASİK TAVLA
          </h1>
        </div>

        {/* Auth Error Notification Banner */}
        {authError && (
          <div className="w-full mb-3 p-2 rounded-xl bg-red-950/90 border border-red-500/60 text-red-200 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="truncate">{authError}</span>
            </div>
            <button
              onClick={onClearAuthError}
              className="p-1 hover:bg-red-900/60 rounded text-red-300 cursor-pointer ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Reward Claim Error Notification */}
        {rewardClaimError && (
          <div className="w-full mb-3 p-2 rounded-xl bg-amber-950/90 border border-amber-500/60 text-amber-200 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">{rewardClaimError}</span>
            </div>
            <button
              onClick={() => setRewardClaimError(null)}
              className="p-1 hover:bg-amber-900/60 rounded text-amber-300 cursor-pointer ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Menü Seçenekleri (Sırayla: 'Tek Kişilik', 'Online', 'Arkadaşınla Oyna' - Alt açıklamalar kaldırıldı) */}
        <div className="w-full space-y-2.5 mb-4">
          {/* 1. Tek Kişilik */}
          <button
            onClick={() => {
              tavlaAudio.playButtonClick();
              onStartSinglePlayer();
            }}
            className="w-full group relative py-3.5 px-5 rounded-2xl bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 hover:from-amber-500 hover:to-amber-800 text-amber-50 font-bold shadow-[0_6px_16px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.35)] border border-amber-400/60 active:scale-98 transition-all flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-400/40 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform shadow-inner">
                <Bot className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-white text-base sm:text-lg tracking-wide">
                Tek Kişilik
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-amber-300 group-hover:translate-x-1 transition-transform">
              OYNA →
            </span>
          </button>

          {/* 2. Online */}
          <button
            onClick={() => {
              tavlaAudio.playButtonClick();
              onOpenOnlineLobby();
            }}
            className="w-full group relative py-3.5 px-5 rounded-2xl bg-gradient-to-b from-emerald-700 via-emerald-800 to-emerald-950 hover:from-emerald-600 hover:to-emerald-900 text-white font-bold shadow-[0_6px_16px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.25)] border border-emerald-400/60 active:scale-98 transition-all flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-400/40 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition-transform shadow-inner">
                <Globe className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-white text-base sm:text-lg tracking-wide">
                Online
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-emerald-300 group-hover:translate-x-1 transition-transform">
              ODALAR →
            </span>
          </button>

          {/* 3. Arkadaşınla Oyna */}
          <button
            onClick={() => {
              tavlaAudio.playButtonClick();
              onOpenFriendRoom();
            }}
            className="w-full group relative py-3.5 px-5 rounded-2xl bg-gradient-to-b from-[#d97706] via-[#b45309] to-[#78350f] hover:from-[#f59e0b] hover:to-[#92400e] text-white font-bold shadow-[0_6px_16px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.3)] border border-amber-400/70 active:scale-98 transition-all flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-300/50 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform shadow-inner">
                <Users className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-white text-base sm:text-lg tracking-wide">
                Arkadaşınla Oyna
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-amber-200 group-hover:translate-x-1 transition-transform">
              GİRİŞ →
            </span>
          </button>
        </div>

        {/* Alt Bölüm: Ücretsiz Jeton (6 Saatlik Sayaç) & Reklam İzle Kazan Sekmeleri */}
        <div className="w-full grid grid-cols-2 gap-2.5 pt-2 border-t border-amber-900/60">
          {/* Ücretsiz Jeton Butonu (6 saatte bir 100 Jeton, küçük sayaçlı) */}
          <button
            onClick={handleClaimDaily}
            disabled={!rewardStatus.canClaimDaily || isClaimingReward}
            className={`relative p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              rewardStatus.canClaimDaily
                ? 'bg-gradient-to-b from-[#3a2010] via-[#4e2a14] to-[#2b1509] border-amber-400 shadow-[0_4px_15px_rgba(245,158,11,0.25)] hover:border-amber-300 hover:scale-[1.02] active:scale-98'
                : 'bg-[#1a0e07]/80 border-amber-900/40 opacity-75 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    rewardStatus.canClaimDaily
                      ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow'
                      : 'bg-stone-800 text-stone-400'
                  }`}
                >
                  <Gift className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-amber-100 uppercase tracking-wide">
                  Ücretsiz Jeton
                </span>
              </div>
              {rewardStatus.canClaimDaily && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>

            <div className="mt-2 flex items-center justify-between">
              {rewardStatus.canClaimDaily ? (
                <>
                  <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    +{rewardStatus.dailyRewardCoins} Jeton
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow">
                    AL
                  </span>
                </>
              ) : (
                <div className="text-[10px] text-amber-300/80 flex items-center gap-1 font-mono font-bold">
                  <Clock className="w-3 h-3 text-amber-400/90" />
                  <span>
                    Kaldı:{' '}
                    {String(rewardStatus.hoursUntilReset).padStart(2, '0')}:
                    {String(rewardStatus.minutesUntilReset).padStart(2, '0')}:
                    {String(rewardStatus.secondsUntilReset).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>
          </button>

          {/* Reklam İzle ve Jeton Kazan Butonu (100 Jeton, Sınırsız Hak) */}
          <button
            onClick={() => {
              tavlaAudio.playButtonClick();
              onOpenRewardedAd();
            }}
            className="relative p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer bg-gradient-to-b from-[#1b2b1a] via-[#223d21] to-[#122112] border-emerald-500/70 shadow-[0_4px_15px_rgba(16,185,129,0.2)] hover:border-emerald-400 hover:scale-[1.02] active:scale-98"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow">
                  <Video className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-amber-100 uppercase tracking-wide">
                  Reklam İzle Kazan
                </span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-emerald-950 text-emerald-300 border border-emerald-500/50 shadow">
                Sınırsız
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-black text-amber-300 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                +100 Jeton
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-600 hover:bg-amber-500 text-amber-950 font-black shadow">
                İZLE
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Leaderboard Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentUser={profile}
      />
    </div>
  );
};
