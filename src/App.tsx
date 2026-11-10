/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Board } from './components/Board';
import { OnlineBoard } from './components/OnlineBoard';
import { RADIO_STATIONS } from './components/RadioControls';
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
  const radioAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [enabledRadioStations, setEnabledRadioStations] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('klasik-tavla-radio-enabled');
      if (!saved) return RADIO_STATIONS.map((station) => station.id);
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((id) => RADIO_STATIONS.some((station) => station.id === id)) : RADIO_STATIONS.map((station) => station.id);
    } catch {
      return RADIO_STATIONS.map((station) => station.id);
    }
  });
  const [radioChannel, setRadioChannel] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('klasik-tavla-radio-channel'));
      return Number.isInteger(saved) && saved >= 0 && saved < RADIO_STATIONS.length ? saved : 0;
    } catch {
      return 0;
    }
  });

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
      ambientVolume: 12,
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

  const playRadioChannel = (index: number) => {
    const audio = radioAudioRef.current;
    if (!audio) return;
    audio.src = RADIO_STATIONS[index].url;
    audio.load();
    audio.play().catch((error) => {
      console.warn('Radyo yayını başlatılamadı:', error);
      setIsRadioPlaying(false);
    });
  };

  const handleToggleRadio = () => {
    if (isRadioPlaying) {
      radioAudioRef.current?.pause();
      setIsRadioPlaying(false);
      return;
    }
    const firstEnabled = RADIO_STATIONS.findIndex((station) => enabledRadioStations.includes(station.id));
    if (firstEnabled < 0) return;
    const selectedIndex = enabledRadioStations.includes(RADIO_STATIONS[radioChannel].id) ? radioChannel : firstEnabled;
    setRadioChannel(selectedIndex);
    tavlaAudio.setAmbientEnabled(false);
    setSettings((prev) => ({ ...prev, ambientSound: false }));
    setIsRadioPlaying(true);
    playRadioChannel(selectedIndex);
  };

  const handleChangeRadioChannel = (direction: -1 | 1) => {
    const enabledIndexes = RADIO_STATIONS.map((station, index) => enabledRadioStations.includes(station.id) ? index : -1).filter((index) => index >= 0);
    if (enabledIndexes.length === 0) return;
    const currentPosition = enabledIndexes.indexOf(radioChannel);
    const basePosition = currentPosition >= 0 ? currentPosition : 0;
    const nextIndex = enabledIndexes[(basePosition + direction + enabledIndexes.length) % enabledIndexes.length];
    setRadioChannel(nextIndex);
    if (isRadioPlaying) playRadioChannel(nextIndex);
  };

  const handleToggleRadioStation = (stationId: string) => {
    const next = enabledRadioStations.includes(stationId)
      ? enabledRadioStations.filter((id) => id !== stationId)
      : [...enabledRadioStations, stationId];
    setEnabledRadioStations(next);
    if (stationId === RADIO_STATIONS[radioChannel].id && !next.includes(stationId)) {
      const nextEnabledIndex = RADIO_STATIONS.findIndex((station) => next.includes(station.id));
      if (nextEnabledIndex < 0) {
        radioAudioRef.current?.pause();
        setIsRadioPlaying(false);
      } else {
        setRadioChannel(nextEnabledIndex);
        if (isRadioPlaying) playRadioChannel(nextEnabledIndex);
      }
    }
  };

  const handleToggleMusic = () => {
    if (!settings.ambientSound) {
      radioAudioRef.current?.pause();
      setIsRadioPlaying(false);
    }
    setSettings((prev) => ({ ...prev, ambientSound: !prev.ambientSound }));
  };

  useEffect(() => {
    try {
      localStorage.setItem('klasik-tavla-radio-enabled', JSON.stringify(enabledRadioStations));
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, [enabledRadioStations]);

  useEffect(() => {
    try {
      localStorage.setItem('klasik-tavla-radio-channel', String(radioChannel));
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, [radioChannel]);

  useEffect(() => {
    if (activeView === 'MENU' && isRadioPlaying) {
      radioAudioRef.current?.pause();
      setIsRadioPlaying(false);
    }
  }, [activeView, isRadioPlaying]);

  // Start music only after the brand splash; pause it whenever the app is backgrounded.
  useEffect(() => {
    tavlaAudio.setAmbientEnabled(settings.ambientSound && !showBrandSplash);
  }, [settings.ambientSound, showBrandSplash]);

  // Apply the user's saved music volume immediately, including while music is playing.
  useEffect(() => {
    tavlaAudio.setBackgroundMusicVolume(settings.ambientVolume ?? 12);
  }, [settings.ambientVolume]);

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
      <audio ref={radioAudioRef} preload="none" onError={() => setIsRadioPlaying(false)} className="hidden" />
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
            onToggleMusic={handleToggleMusic}
            isRadioPlaying={isRadioPlaying}
            hasEnabledRadioStations={enabledRadioStations.length > 0}
            radioChannel={radioChannel}
            onToggleRadio={handleToggleRadio}
            onPreviousRadio={() => handleChangeRadioChannel(-1)}
            onNextRadio={() => handleChangeRadioChannel(1)}
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
            onToggleMusic={handleToggleMusic}
            isRadioPlaying={isRadioPlaying}
            hasEnabledRadioStations={enabledRadioStations.length > 0}
            radioChannel={radioChannel}
            onToggleRadio={handleToggleRadio}
            onPreviousRadio={() => handleChangeRadioChannel(-1)}
            onNextRadio={() => handleChangeRadioChannel(1)}
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
        enabledRadioStations={enabledRadioStations}
        onToggleRadioStation={handleToggleRadioStation}
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
