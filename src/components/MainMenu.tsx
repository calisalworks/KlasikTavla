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
    <div className="relative w-full h-full flex items-center justify-center bg-[#090707] p-3 sm:p-5 select-none overflow-hidden" style={{ backgroundImage: 'radial-gradient(ellipse at 50% 48%, rgba(74,39,19,.58) 0%, rgba(24,13,10,.78) 43%, rgba(5,5,7,.98) 100%), repeating-linear-gradient(135deg, rgba(196,151,76,.035) 0px, rgba(196,151,76,.035) 1px, transparent 1px, transparent 7px)' }}>
      <div className="pointer-events-none absolute inset-3 sm:inset-5 border border-amber-700/50 shadow-[inset_0_0_45px_rgba(0,0,0,.9),0_0_18px_rgba(180,123,48,.12)] rounded-sm" />
      <div className="pointer-events-none absolute inset-5 sm:inset-8 border border-amber-300/15 rounded-sm" />
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[70vw] h-[50vh] rounded-full bg-amber-500/5 blur-3xl" />
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 w-full h-full opacity-75" viewBox="0 0 1200 800" preserveAspectRatio="none">
        <defs>
          <linearGradient id="menuGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0b0"/><stop offset=".38" stopColor="#c99543"/><stop offset=".72" stopColor="#7b4b1b"/><stop offset="1" stopColor="#f3d88a"/></linearGradient>
          <pattern id="menuDamask" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M50 5 C68 20 68 32 50 50 C32 32 32 20 50 5 M50 95 C32 80 32 68 50 50 C68 68 68 80 50 95 M5 50 C20 32 32 32 50 50 C32 68 20 68 5 50 M95 50 C80 68 68 68 50 50 C68 32 80 32 95 50" fill="none" stroke="#b68a4b" strokeOpacity=".13" strokeWidth="1.1"/>
            <circle cx="50" cy="50" r="4" fill="none" stroke="#d8b56e" strokeOpacity=".12"/>
          </pattern>
        </defs>
        <rect width="1200" height="800" fill="url(#menuDamask)"/>
        <rect x="18" y="18" width="1164" height="764" rx="3" fill="none" stroke="url(#menuGold)" strokeOpacity=".65" strokeWidth="1.5"/>
        <rect x="25" y="25" width="1150" height="750" rx="2" fill="none" stroke="#e5c47d" strokeOpacity=".22"/>
        {[[30,30,1,1],[1170,30,-1,1],[30,770,1,-1],[1170,770,-1,-1]].map(([x,y,sx,sy],i)=><g key={i} transform={`translate(${x} ${y}) scale(${sx} ${sy})`} fill="none" stroke="url(#menuGold)" strokeWidth="2">
          <path d="M0 105 C5 55 20 20 75 0 C45 28 43 48 62 58 C82 67 95 42 78 28 C112 38 112 75 83 86 C57 96 33 77 39 55 C15 70 14 91 0 105Z"/>
          <path d="M8 82 C28 70 31 45 17 31 C43 38 49 60 35 76 M54 13 C69 20 73 34 68 45 M16 105 C30 93 47 93 59 101"/>
          <circle cx="78" cy="28" r="4" fill="#d6ae60" stroke="none"/>
        </g>)}
      </svg>
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
      <div className="relative z-10 w-full max-w-3xl max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain px-2 sm:px-5 py-1 sm:py-2 flex flex-col items-center">
        {/* Header / Title (Küçültülmüş ve yukarı taşınmış Klasik Tavla) */}
        <div className="text-center mb-2 sm:mb-3 mt-0 relative shrink-0">
          <svg aria-hidden="true" className="mx-auto mb-0.5 w-36 sm:w-64 h-5 sm:h-6 text-amber-300" viewBox="0 0 420 55" fill="none"><path d="M8 29 H145 C164 29 174 10 190 10 C203 10 205 24 210 29 C215 24 217 10 230 10 C246 10 256 29 275 29 H412 M25 36 H155 M265 36 H395" stroke="#c99a4c" strokeWidth="1.5"/><path d="M210 2 C196 18 196 37 210 49 C224 37 224 18 210 2Z" stroke="#f1d58d" strokeWidth="1.5"/><path d="M185 29 Q197 12 210 29 Q223 12 235 29 M198 40 Q210 50 222 40" stroke="#e4bd70" strokeWidth="1.4"/><circle cx="210" cy="28" r="4" fill="#e7c16e"/><circle cx="145" cy="29" r="2.5" fill="#e7c16e"/><circle cx="275" cy="29" r="2.5" fill="#e7c16e"/></svg>
          <h1 className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#fff4c9] via-[#e6c477] to-[#9d6928] tracking-[.12em] font-['Cinzel',serif] drop-shadow-[0_3px_8px_rgba(0,0,0,.95)]">
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
        <div className="w-full space-y-2 sm:space-y-3 mb-2 sm:mb-3 shrink-0">
          {/* 1. Tek Kişilik */}
          <button
            onClick={() => {
              tavlaAudio.playButtonClick();
              onStartSinglePlayer();
            }}
            className="w-full group relative py-2.5 sm:py-3.5 px-3 sm:px-6 rounded-xl bg-gradient-to-r from-[#160e0b] via-[#28160f] to-[#100b09] hover:from-[#2a1a11] hover:to-[#1c100b] text-amber-50 font-bold shadow-[0_8px_22px_rgba(0,0,0,.75),inset_0_1px_3px_rgba(255,230,170,.12)] border-2 border-[#b88a43] outline outline-1 outline-offset-[-6px] outline-amber-200/20 active:scale-[.99] transition-all flex items-center justify-between cursor-pointer"
          >
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 w-full h-full rounded-xl" viewBox="0 0 1000 150" preserveAspectRatio="none"><rect x="5" y="5" width="990" height="140" rx="13" fill="none" stroke="#f1d18a" strokeOpacity=".38" strokeWidth="1.5"/><path d="M8 48 C22 45 22 18 48 8 C36 25 42 35 54 34 C67 32 68 18 58 14 C82 17 87 39 68 48 C49 58 29 43 32 29 M992 48 C978 45 978 18 952 8 C964 25 958 35 946 34 C933 32 932 18 942 14 C918 17 913 39 932 48 C951 58 971 43 968 29 M8 102 C22 105 22 132 48 142 C36 125 42 115 54 116 C67 118 68 132 58 136 C82 133 87 111 68 102 C49 92 29 107 32 121 M992 102 C978 105 978 132 952 142 C964 125 958 115 946 116 C933 118 932 132 942 136 C918 133 913 111 932 102 C951 92 971 107 968 121" fill="none" stroke="#e4bd70" strokeOpacity=".72" strokeWidth="2"/><circle cx="48" cy="8" r="3" fill="#f4d994"/><circle cx="952" cy="8" r="3" fill="#f4d994"/><circle cx="48" cy="142" r="3" fill="#f4d994"/><circle cx="952" cy="142" r="3" fill="#f4d994"/></svg>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#fff0b0] via-[#b98332] to-[#59320e] border-2 border-[#f8df91] flex items-center justify-center text-[#3b210b] group-hover:scale-105 transition-transform shadow-[0_3px_10px_rgba(0,0,0,.8),inset_0_1px_3px_rgba(255,255,255,.8)]">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="font-extrabold text-[#f6e8c7] text-base sm:text-xl tracking-wide font-['Cinzel',serif]">
                Tek Kişilik
              </span>
            </div>
            <span className="text-xs sm:text-base font-black text-[#e9c77c] group-hover:translate-x-1 transition-transform">
              OYNA →
            </span>
          </button>

          {/* 2. Online */}
          <button
            onClick={() => {
              tavlaAudio.playButtonClick();
              onOpenOnlineLobby();
            }}
            className="w-full group relative py-2.5 sm:py-3.5 px-3 sm:px-6 rounded-xl bg-gradient-to-r from-[#061b16] via-[#073b2d] to-[#061a15] hover:from-[#0b3025] hover:to-[#08271e] text-white font-bold shadow-[0_8px_22px_rgba(0,0,0,.75),inset_0_1px_3px_rgba(255,230,170,.12)] border-2 border-[#b88a43] outline outline-1 outline-offset-[-6px] outline-amber-200/20 active:scale-[.99] transition-all flex items-center justify-between cursor-pointer"
          >
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 w-full h-full rounded-xl" viewBox="0 0 1000 150" preserveAspectRatio="none"><rect x="5" y="5" width="990" height="140" rx="13" fill="none" stroke="#f1d18a" strokeOpacity=".38" strokeWidth="1.5"/><path d="M8 48 C22 45 22 18 48 8 C36 25 42 35 54 34 C67 32 68 18 58 14 C82 17 87 39 68 48 C49 58 29 43 32 29 M992 48 C978 45 978 18 952 8 C964 25 958 35 946 34 C933 32 932 18 942 14 C918 17 913 39 932 48 C951 58 971 43 968 29 M8 102 C22 105 22 132 48 142 C36 125 42 115 54 116 C67 118 68 132 58 136 C82 133 87 111 68 102 C49 92 29 107 32 121 M992 102 C978 105 978 132 952 142 C964 125 958 115 946 116 C933 118 932 132 942 136 C918 133 913 111 932 102 C951 92 971 107 968 121" fill="none" stroke="#e4bd70" strokeOpacity=".72" strokeWidth="2"/><circle cx="48" cy="8" r="3" fill="#f4d994"/><circle cx="952" cy="8" r="3" fill="#f4d994"/><circle cx="48" cy="142" r="3" fill="#f4d994"/><circle cx="952" cy="142" r="3" fill="#f4d994"/></svg>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#fff0b0] via-[#b98332] to-[#59320e] border-2 border-[#f8df91] flex items-center justify-center text-[#174132] group-hover:scale-105 transition-transform shadow-[0_3px_10px_rgba(0,0,0,.8),inset_0_1px_3px_rgba(255,255,255,.8)]">
                <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="font-extrabold text-[#f6e8c7] text-base sm:text-xl tracking-wide font-['Cinzel',serif]">
                Online
              </span>
            </div>
            <span className="text-xs sm:text-base font-black text-[#e9c77c] group-hover:translate-x-1 transition-transform">
              ODALAR →
            </span>
          </button>

          {/* 3. Arkadaşınla Oyna */}
          <button
            onClick={() => {
              tavlaAudio.playButtonClick();
              onOpenFriendRoom();
            }}
            className="w-full group relative py-2.5 sm:py-3.5 px-3 sm:px-6 rounded-xl bg-gradient-to-r from-[#1b100c] via-[#352014] to-[#130b08] hover:from-[#352014] hover:to-[#21130c] text-white font-bold shadow-[0_8px_22px_rgba(0,0,0,.75),inset_0_1px_3px_rgba(255,230,170,.12)] border-2 border-[#b88a43] outline outline-1 outline-offset-[-6px] outline-amber-200/20 active:scale-[.99] transition-all flex items-center justify-between cursor-pointer"
          >
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 w-full h-full rounded-xl" viewBox="0 0 1000 150" preserveAspectRatio="none"><rect x="5" y="5" width="990" height="140" rx="13" fill="none" stroke="#f1d18a" strokeOpacity=".38" strokeWidth="1.5"/><path d="M8 48 C22 45 22 18 48 8 C36 25 42 35 54 34 C67 32 68 18 58 14 C82 17 87 39 68 48 C49 58 29 43 32 29 M992 48 C978 45 978 18 952 8 C964 25 958 35 946 34 C933 32 932 18 942 14 C918 17 913 39 932 48 C951 58 971 43 968 29 M8 102 C22 105 22 132 48 142 C36 125 42 115 54 116 C67 118 68 132 58 136 C82 133 87 111 68 102 C49 92 29 107 32 121 M992 102 C978 105 978 132 952 142 C964 125 958 115 946 116 C933 118 932 132 942 136 C918 133 913 111 932 102 C951 92 971 107 968 121" fill="none" stroke="#e4bd70" strokeOpacity=".72" strokeWidth="2"/><circle cx="48" cy="8" r="3" fill="#f4d994"/><circle cx="952" cy="8" r="3" fill="#f4d994"/><circle cx="48" cy="142" r="3" fill="#f4d994"/><circle cx="952" cy="142" r="3" fill="#f4d994"/></svg>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#fff0b0] via-[#b98332] to-[#59320e] border-2 border-[#f8df91] flex items-center justify-center text-[#3b210b] group-hover:scale-105 transition-transform shadow-[0_3px_10px_rgba(0,0,0,.8),inset_0_1px_3px_rgba(255,255,255,.8)]">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="font-extrabold text-[#f6e8c7] text-base sm:text-xl tracking-wide font-['Cinzel',serif]">
                Arkadaşınla Oyna
              </span>
            </div>
            <span className="text-xs sm:text-base font-black text-[#e9c77c] group-hover:translate-x-1 transition-transform">
              GİRİŞ →
            </span>
          </button>
        </div>

        {/* Alt Bölüm: Ücretsiz Jeton (6 Saatlik Sayaç) & Reklam İzle Kazan Sekmeleri */}
        <div className="w-full grid grid-cols-2 gap-2 sm:gap-4 pt-0.5 shrink-0">
          {/* Ücretsiz Jeton Butonu (6 saatte bir 100 Jeton, küçük sayaçlı) */}
          <button
            onClick={handleClaimDaily}
            disabled={!rewardStatus.canClaimDaily || isClaimingReward}
            className={`relative p-2 sm:p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
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
            className="relative p-2 sm:p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer bg-gradient-to-b from-[#1b2b1a] via-[#223d21] to-[#122112] border-emerald-500/70 shadow-[0_4px_15px_rgba(16,185,129,0.2)] hover:border-emerald-400 hover:scale-[1.02] active:scale-98"
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
