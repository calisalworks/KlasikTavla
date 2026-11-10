/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Board } from './components/Board';
import { OnlineBoard } from './components/OnlineBoard';
import { MainMenu } from './components/MainMenu';
import { SinglePlayerSetupModal } from './components/SinglePlayerSetupModal';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { FriendRoomModal } from './components/FriendRoomModal';
import { ProfileModal } from './components/ProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { RulesModal } from './components/RulesModal';
import { LandscapeNotice } from './components/LandscapeNotice';
import { AIDifficulty, GameSettings, TargetScore, UserProfile } from './types/game';
import { getUserProfile, recordMatchResult } from './utils/profileStorage';
import { loginWithGoogle, logoutUser, subscribeToAuthChanges } from './firebase/authService';
import { syncUserWithFirestore, recordMatchInFirestore } from './firebase/userService';
import { claimDailyCoins, claimAdRewardCoins, getRewardStatus } from './firebase/coinService';
import { RewardedAdModal } from './components/RewardedAdModal';
import { RewardCelebrationModal } from './components/RewardCelebrationModal';
import { tavlaAudio } from './utils/audio';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';

export default function App() {
  const [activeView, setActiveView] = useState<'MENU' | 'SINGLE_PLAYER' | 'ONLINE_BOARD'>('MENU');

  // CALISAL WORKS marka açılışı — Harf Yolu ile aynı görsel, 3,5 saniye.
  const [showBrandSplash, setShowBrandSplash] = useState(true);
  useEffect(() => {
    const splashTimer = window.setTimeout(() => setShowBrandSplash(false), 3500);
    return () => window.clearTimeout(splashTimer);
  }, []);
  const [singlePlayerTargetScore, setSinglePlayerTargetScore] = useState<TargetScore>(3);
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>(getUserProfile);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Friend Room & URL Invite States
  const [isFriendRoomOpen, setIsFriendRoomOpen] = useState(false);
  const [urlInviteCode, setUrlInviteCode] = useState<string | null>(null);

  // Authentication State
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Reward Modals & Processing State
  const [isRewardedAdOpen, setIsRewardedAdOpen] = useState(false);
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    title: string;
    coinsEarned: number;
    newBalance: number;
  } | null>(null);

  // Modals
  const [isSingleSetupOpen, setIsSingleSetupOpen] = useState(false);
  const [isOnlineLobbyOpen, setIsOnlineLobbyOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  // Detect invite link parameters (?friendRoom=XYZ or ?invite=XYZ)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('friendRoom') || params.get('invite');
      if (code && code.trim().length >= 4) {
        setUrlInviteCode(code.trim().toUpperCase());
        setIsFriendRoomOpen(true);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // Android Capacitor: Otomatik yatay ekran (landscape) kilitleme ve bildirim çubuklarını gizleme
  useEffect(() => {
    const applyMobileDisplay = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.hide();
        } catch {
          // ignore
        }
        try {
          await ScreenOrientation.lock({ orientation: 'landscape' });
        } catch {
          // ignore
        }
      } else {
        try {
          if (screen?.orientation && 'lock' in (screen.orientation as any)) {
            (screen.orientation as any).lock('landscape').catch(() => {});
          }
        } catch {
          // Not available in standard desktop browser
        }
      }
    };

    applyMobileDisplay();
  }, []);

  // Listen to Firebase Authentication state changes
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (firebaseUser) => {
      if (firebaseUser) {
        setIsAuthLoading(true);
        try {
          const synced = await syncUserWithFirestore(firebaseUser);
          setProfile(synced);
          setAuthError(null);
        } catch (err: any) {
          console.warn('Error syncing user with Firestore:', err);
          setAuthError('Profil senkronizasyonunda bir sorun oluştu.');
        } finally {
          setIsAuthLoading(false);
        }
      } else {
        setProfile(getUserProfile());
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLoginWithGoogle = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const user = await loginWithGoogle();
      const synced = await syncUserWithFirestore(user);
      setProfile(synced);
    } catch (err: any) {
      console.warn('Google login failed:', err);
      setAuthError(err.message || 'Google ile giriş yapılamadı.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      const local = getUserProfile();
      setProfile({
        ...local,
        isFirebaseUser: false,
      });
      setAuthError(null);
    } catch (err: any) {
      console.warn('Logout error:', err);
    }
  };

  // Claim Daily Free Coins
  const handleClaimDailyReward = async () => {
    setIsClaimingReward(true);
    try {
      const res = await claimDailyCoins(profile);
      setProfile(res.updatedProfile);
      tavlaAudio.playVictory();
      setCelebrationData({
        title: 'Günlük Ücretsiz Ödül Alındı!',
        coinsEarned: res.coinsAdded,
        newBalance: res.updatedProfile.coins ?? 1000,
      });
    } catch (err: any) {
      console.warn('Daily reward error:', err);
      throw err;
    } finally {
      setIsClaimingReward(false);
    }
  };

  // Complete Rewarded Ad and Claim Coins
  const handleCompleteRewardedAd = async (adProofToken: string) => {
    setIsClaimingReward(true);
    try {
      const res = await claimAdRewardCoins(profile, adProofToken);
      setProfile(res.updatedProfile);
      tavlaAudio.playVictory();
      setCelebrationData({
        title: 'Ödüllü Reklam Tamamlandı!',
        coinsEarned: res.coinsAdded,
        newBalance: res.updatedProfile.coins ?? 1000,
      });
    } catch (err: any) {
      console.warn('Ad reward error:', err);
      throw err;
    } finally {
      setIsClaimingReward(false);
    }
  };

  // General Settings (without target score)
  const [settings, setSettings] = useState<GameSettings>(() => {
    const defaults: GameSettings = {
      soundEnabled: true,
      ambientSound: true,
      autoRoll: false,
      highlightMoves: true,
      aiDifficulty: 'medium',
    };
    try {
      const saved = localStorage.getItem('klasik-tavla-settings');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  // Keep user preferences between sessions.
  useEffect(() => {
    try {
      localStorage.setItem('klasik-tavla-settings', JSON.stringify(settings));
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, [settings]);

  // Start music only after the brand splash; pause it whenever the app is backgrounded.
  useEffect(() => {
    tavlaAudio.setAmbientEnabled(settings.ambientSound && !showBrandSplash);
  }, [settings.ambientSound, showBrandSplash]);

  useEffect(() => {
    const updateVisibility = () => tavlaAudio.setAppVisible(!document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  // Retry playback after the first user gesture if the browser blocks autoplay.
  useEffect(() => {
    if (!settings.ambientSound || showBrandSplash) return;
    const retry = () => tavlaAudio.retryBackgroundMusic();
    window.addEventListener('pointerdown', retry, { once: true });
    window.addEventListener('touchstart', retry, { once: true });
    window.addEventListener('keydown', retry, { once: true });
    return () => {
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('touchstart', retry);
      window.removeEventListener('keydown', retry);
    };
  }, [settings.ambientSound, showBrandSplash]);

  // Fullscreen support
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleRecordMatch = (result: 'win' | 'loss' | 'abandoned') => {
    const updated = recordMatchResult(result);
    setProfile(updated);
    if (updated.isFirebaseUser && updated.id) {
      recordMatchInFirestore(updated.id, result).catch((err) => {
        console.warn('Could not record match in Firestore:', err);
      });
    }
  };

  const handleStartSinglePlayer = (score: TargetScore, difficulty: AIDifficulty) => {
    setSinglePlayerTargetScore(score);
    setSettings((prev) => ({ ...prev, aiDifficulty: difficulty }));
    setIsSingleSetupOpen(false);
    setActiveView('SINGLE_PLAYER');
  };

  const handleJoinOnlineRoom = (roomId: string) => {
    setOnlineRoomId(roomId);
    setIsOnlineLobbyOpen(false);
    setActiveView('ONLINE_BOARD');
  };

  const handleCreateOnlineRoom = async (name: string, targetScore: TargetScore) => {
    // Send request via WebSocket or REST to create room
    try {
      // Connect temporary ws to create room
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'player:init',
          playerId: profile.id,
          playerName: profile.name,
        }));
        ws.send(JSON.stringify({
          type: 'room:create',
          name,
          targetScore,
        }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'room:joined') {
          ws.close();
          handleJoinOnlineRoom(msg.room.id);
        }
      };
    } catch {
      // fallback
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#120d09] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col select-none touch-none">
      {showBrandSplash && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black">
          <img src="/calisal-works-intro.jpg" alt="CALISAL WORKS" className="h-full w-full object-contain" />
        </div>
      )}
      {/* Strict Landscape Lock Screen for Mobile/Tablets */}
      <LandscapeNotice
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Main Viewport Router */}
      <main className="flex-1 w-full h-full relative overflow-hidden">
        {activeView === 'MENU' && (
          <MainMenu
            onStartSinglePlayer={() => setIsSingleSetupOpen(true)}
            onOpenOnlineLobby={() => setIsOnlineLobbyOpen(true)}
            onOpenFriendRoom={() => setIsFriendRoomOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
            onOpenRules={() => setIsRulesOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
            profile={profile}
            onLoginWithGoogle={handleLoginWithGoogle}
            onLogout={handleLogout}
            isAuthLoading={isAuthLoading}
            authError={authError}
            onClearAuthError={() => setAuthError(null)}
            onClaimDailyReward={handleClaimDailyReward}
            onOpenRewardedAd={() => setIsRewardedAdOpen(true)}
            isClaimingReward={isClaimingReward}
          />
        )}

        {activeView === 'SINGLE_PLAYER' && (
          <Board
            profile={profile}
            settings={settings}
            targetScore={singlePlayerTargetScore}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleMusic={() => setSettings((prev) => ({ ...prev, ambientSound: !prev.ambientSound }))}
            onOpenRules={() => setIsRulesOpen(true)}
            onReturnToMenu={() => setActiveView('MENU')}
            onToggleFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
            onRecordMatch={handleRecordMatch}
          />
        )}

        {activeView === 'ONLINE_BOARD' && onlineRoomId && (
          <OnlineBoard
            roomId={onlineRoomId}
            profile={profile}
            settings={settings}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleMusic={() => setSettings((prev) => ({ ...prev, ambientSound: !prev.ambientSound }))}
            onOpenRules={() => setIsSettingsOpen(true)}
            onLeaveRoom={() => {
              setOnlineRoomId(null);
              setActiveView('MENU');
            }}
            onToggleFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
            onRecordMatch={handleRecordMatch}
            onProfileUpdated={setProfile}
          />
        )}
      </main>

      {/* 1. Single Player Game Setup (Hedef Puan 1, 3, 5) */}
      <SinglePlayerSetupModal
        isOpen={isSingleSetupOpen}
        onClose={() => setIsSingleSetupOpen(false)}
        onStart={handleStartSinglePlayer}
        initialDifficulty={settings.aiDifficulty}
      />

      {/* 2. Online Rooms Lobby (4 Oda Seviyesi & Jeton Bahisleri) */}
      <OnlineLobbyModal
        isOpen={isOnlineLobbyOpen}
        onClose={() => setIsOnlineLobbyOpen(false)}
        profile={profile}
        onMatchFound={(roomId) => {
          setOnlineRoomId(roomId);
          setIsOnlineLobbyOpen(false);
          setActiveView('ONLINE_BOARD');
        }}
        onProfileUpdated={setProfile}
        onOpenRewardedAd={() => setIsRewardedAdOpen(true)}
        onClaimDailyReward={handleClaimDailyReward}
      />

      {/* 2b. Arkadaşınla Oyna Modal (5 Özel Bahis Seviyesi & Davet Kodu) */}
      <FriendRoomModal
        isOpen={isFriendRoomOpen}
        onClose={() => {
          setIsFriendRoomOpen(false);
          setUrlInviteCode(null);
        }}
        profile={profile}
        initialInviteCode={urlInviteCode}
        onMatchFound={(roomId) => {
          setOnlineRoomId(roomId);
          setIsFriendRoomOpen(false);
          setActiveView('ONLINE_BOARD');
        }}
        onProfileUpdated={setProfile}
        onOpenRewardedAd={() => setIsRewardedAdOpen(true)}
        onClaimDailyReward={handleClaimDailyReward}
      />

      {/* 3. Player Profile & Achievements Modal (Galibiyet, Mağlubiyet, Yarıda Bırakılan) */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        onProfileUpdated={setProfile}
        onLoginWithGoogle={handleLoginWithGoogle}
        onLogout={handleLogout}
        isAuthLoading={isAuthLoading}
      />

      {/* 4. Settings Modal (Landscape-optimized, target score removed) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(part) => setSettings((prev) => ({ ...prev, ...part }))}
      />

      {/* 5. Rules Modal */}
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      {/* 6. Rewarded Ad Modal (AdMob on Android, Simulation on Web) */}
      <RewardedAdModal
        isOpen={isRewardedAdOpen}
        onClose={() => setIsRewardedAdOpen(false)}
        onAdCompleted={handleCompleteRewardedAd}
        remainingAdsToday={getRewardStatus(profile).adsRemainingToday}
        userId={profile?.id}
      />

      {/* 7. Reward Celebration Modal */}
      <RewardCelebrationModal
        isOpen={!!celebrationData}
        onClose={() => setCelebrationData(null)}
        title={celebrationData?.title || ''}
        coinsEarned={celebrationData?.coinsEarned || 0}
        newBalance={celebrationData?.newBalance || 0}
      />
    </div>
  );
}
