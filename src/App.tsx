/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Board, SavedSinglePlayerGame } from './components/Board';
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
import { getWebSocketConfig } from './utils/wsConfig';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';

export default function App() {
  const [activeView, setActiveView] = useState<'MENU' | 'SINGLE_PLAYER' | 'ONLINE_BOARD'>('MENU');
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportLayout, setViewportLayout] = useState({ scale: 1, canvasWidth: 1024 });

  // Uniformly enlarge the complete game UI while keeping the viewport edge-to-edge.
  // A 510px logical design height enlarges the complete UI while preserving proportions; width still follows each device's actual aspect ratio.
  const DESIGN_HEIGHT = 510;
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateScale = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (width > 0 && height > 0) {
        const scale = height / DESIGN_HEIGHT;
        setViewportLayout({ scale, canvasWidth: width / scale });
      }
    };
    updateScale();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScale) : null;
    observer?.observe(viewport);
    window.addEventListener('resize', updateScale);
    window.visualViewport?.addEventListener('resize', updateScale);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateScale);
      window.visualViewport?.removeEventListener('resize', updateScale);
    };
  }, []);

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
  const [radioAvailability, setRadioAvailability] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let cancelled = false;
    const scanTimer = window.setTimeout(() => {
      const wsUrl = getWebSocketConfig().url;
      const statusUrl = wsUrl ? wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace('/ws', '/api/radio/status') : '/api/radio/status';
      fetch(statusUrl).then((response) => { if (!response.ok) throw new Error('Radyo durumları alınamadı'); return response.json(); })
        .then((data) => { if (!cancelled && data?.statuses && typeof data.statuses === 'object') setRadioAvailability(data.statuses); })
        .catch((error) => console.warn('Radyo kanalları arka planda kontrol edilemedi:', error));
    }, 1800);
    return () => { cancelled = true; window.clearTimeout(scanTimer); };
  }, []);
  const [enabledRadioStations, setEnabledRadioStations] = useState<string[]>(() => {
    // Make every configured station available in channel navigation after the radio update.
    return RADIO_STATIONS.map((station) => station.id);
  });
  const [radioChannel, setRadioChannel] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('klasik-tavla-radio-channel'));
      const migrated = saved <= 4 ? saved : saved === 8 ? 5 : saved === 9 ? 6 : saved === 10 ? 7 : saved === 12 ? 8 : 0;
      return Number.isInteger(migrated) && migrated >= 0 && migrated < RADIO_STATIONS.length ? migrated : 0;
    } catch {
      return 0;
    }
  });

  const radioChannelRef = useRef(radioChannel);
  const radioPlayRequestRef = useRef(0);
  useEffect(() => { radioChannelRef.current = radioChannel; }, [radioChannel]);
  const navigableRadioIndexes = RADIO_STATIONS.map((station, index) => enabledRadioStations.includes(station.id) && radioAvailability[station.id] !== false ? index : -1).filter((index) => index >= 0);

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
  const [isResumePromptOpen, setIsResumePromptOpen] = useState(false);
  const [resumeSinglePlayer, setResumeSinglePlayer] = useState(false);
  const [savedSinglePlayerGame, setSavedSinglePlayerGame] = useState<SavedSinglePlayerGame | null>(() => {
    try {
      const raw = localStorage.getItem('klasik-tavla-single-player-save');
      return raw ? JSON.parse(raw) as SavedSinglePlayerGame : null;
    } catch { return null; }
  });
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
      ambientVolume: 60,
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
    if (!audio || radioAvailability[RADIO_STATIONS[index]?.id] === false) return;
    const requestId = ++radioPlayRequestRef.current;
    audio.pause();
    audio.src = RADIO_STATIONS[index].url;
    audio.volume = (settings.ambientVolume ?? 60) / 100;
    audio.load();
    audio.play().catch((error) => {
      if (requestId !== radioPlayRequestRef.current) return;
      console.warn('Radyo yayını başlatılamadı:', error);
      setIsRadioPlaying(false);
      setRadioAvailability((previous) => ({ ...previous, [RADIO_STATIONS[index].id]: false }));
    });
  };

  const handleToggleRadio = () => {
    if (isRadioPlaying) {
      radioAudioRef.current?.pause();
      setIsRadioPlaying(false);
      return;
    }
    const firstEnabled = navigableRadioIndexes[0] ?? -1;
    if (firstEnabled < 0) return;
    const selectedIndex = navigableRadioIndexes.includes(radioChannel) ? radioChannel : firstEnabled;
    setRadioChannel(selectedIndex);
    radioChannelRef.current = selectedIndex;
    tavlaAudio.setAmbientEnabled(false);
    setSettings((prev) => ({ ...prev, ambientSound: false }));
    setIsRadioPlaying(true);
    playRadioChannel(selectedIndex);
  };

  const handleChangeRadioChannel = (direction: -1 | 1) => {
    const enabledIndexes = navigableRadioIndexes;
    if (enabledIndexes.length === 0) return;
    const currentPosition = enabledIndexes.indexOf(radioChannelRef.current);
    const basePosition = currentPosition >= 0 ? currentPosition : 0;
    const nextIndex = enabledIndexes[(basePosition + direction + enabledIndexes.length) % enabledIndexes.length];
    setRadioChannel(nextIndex);
    radioChannelRef.current = nextIndex;
    if (isRadioPlaying) playRadioChannel(nextIndex);
  };

  const handleToggleRadioStation = (stationId: string) => {
    const next = enabledRadioStations.includes(stationId)
      ? enabledRadioStations.filter((id) => id !== stationId)
      : [...enabledRadioStations, stationId];
    setEnabledRadioStations(next);
    if (stationId === RADIO_STATIONS[radioChannel].id && !next.includes(stationId)) {
      const nextEnabledIndex = RADIO_STATIONS.findIndex((station) => next.includes(station.id) && radioAvailability[station.id] !== false);
      if (nextEnabledIndex < 0) {
        radioAudioRef.current?.pause();
        setIsRadioPlaying(false);
      } else {
        setRadioChannel(nextEnabledIndex);
        radioChannelRef.current = nextEnabledIndex;
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
    if (isRadioPlaying && radioAvailability[RADIO_STATIONS[radioChannel]?.id] === false) {
      radioAudioRef.current?.pause();
      setIsRadioPlaying(false);
    }
  }, [radioAvailability, radioChannel, isRadioPlaying]);

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

  // One master level controls game music, internet radio and all sound effects.
  useEffect(() => {
    const volume = settings.ambientVolume ?? 60;
    tavlaAudio.setMasterVolume(volume);
    if (radioAudioRef.current) radioAudioRef.current.volume = volume / 100;
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

  const handleOpenSinglePlayer = () => {
    try {
      const raw = localStorage.getItem('klasik-tavla-single-player-save');
      const saved = raw ? JSON.parse(raw) as SavedSinglePlayerGame : null;
      if (saved?.board && saved?.turn && !saved.matchWinner) {
        setSavedSinglePlayerGame(saved);
        setSinglePlayerTargetScore(saved.targetScore ?? 3);
        setIsResumePromptOpen(true);
      } else {
        setIsSingleSetupOpen(true);
      }
    } catch { setIsSingleSetupOpen(true); }
  };

  const handleSaveSinglePlayerGame = useCallback((game: SavedSinglePlayerGame | null) => {
    setSavedSinglePlayerGame(game);
    try {
      if (game) localStorage.setItem('klasik-tavla-single-player-save', JSON.stringify(game));
      else localStorage.removeItem('klasik-tavla-single-player-save');
    } catch { /* Keep the current session playable if storage is unavailable. */ }
  }, []);

  const handleStartSinglePlayer = (score: TargetScore, difficulty: AIDifficulty) => {
    handleSaveSinglePlayerGame(null);
    setResumeSinglePlayer(false);
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
    <div ref={viewportRef} className="relative w-[100dvw] h-[100dvh] overflow-hidden bg-[#120d09]">
      <div className="absolute left-1/2 top-1/2 overflow-hidden" style={{ width: viewportLayout.canvasWidth, height: DESIGN_HEIGHT, transform: `translate(-50%, -50%) scale(${viewportLayout.scale})`, transformOrigin: 'center center' }}>
      <div className="relative w-full h-full overflow-hidden bg-[#120d09] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col select-none touch-none">
      <audio ref={radioAudioRef} preload="none" onError={() => { setIsRadioPlaying(false); const failedId = RADIO_STATIONS[radioChannel]?.id; if (failedId) setRadioAvailability((previous) => ({ ...previous, [failedId]: false })); }} className="hidden" />
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
      <main className="flex-1 w-full h-full min-w-0 min-h-0 relative overflow-hidden">
        {activeView === 'MENU' && (
          <MainMenu
            onStartSinglePlayer={handleOpenSinglePlayer}
            onOpenOnlineLobby={() => setIsOnlineLobbyOpen(true)}
            onOpenFriendRoom={() => setIsFriendRoomOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
            onOpenRules={() => setIsRulesOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
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
          <div className="game-stage">
          <Board
            profile={profile}
            masterVolume={settings.ambientVolume ?? 60}
            onChangeMasterVolume={(volume) => setSettings((prev) => ({ ...prev, ambientVolume: volume }))}
            settings={settings}
            targetScore={singlePlayerTargetScore}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleMusic={handleToggleMusic}
            isRadioPlaying={isRadioPlaying}
            hasEnabledRadioStations={navigableRadioIndexes.length > 0}
            radioChannel={radioChannel}
            onToggleRadio={handleToggleRadio}
            onPreviousRadio={() => handleChangeRadioChannel(-1)}
            onNextRadio={() => handleChangeRadioChannel(1)}
            onOpenRules={() => setIsRulesOpen(true)}
            onReturnToMenu={() => setActiveView('MENU')}
            onToggleFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
            onRecordMatch={handleRecordMatch}
            initialSavedGame={resumeSinglePlayer ? savedSinglePlayerGame : null}
            onSaveGame={handleSaveSinglePlayerGame}
          />
          </div>
        )}

        {activeView === 'ONLINE_BOARD' && onlineRoomId && (
          <div className="game-stage">
          <OnlineBoard
            roomId={onlineRoomId}
            masterVolume={settings.ambientVolume ?? 60}
            onChangeMasterVolume={(volume) => setSettings((prev) => ({ ...prev, ambientVolume: volume }))}
            profile={profile}
            settings={settings}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleMusic={handleToggleMusic}
            isRadioPlaying={isRadioPlaying}
            hasEnabledRadioStations={navigableRadioIndexes.length > 0}
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
          </div>
        )}
      </main>

      {isResumePromptOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border-2 border-amber-600/70 bg-gradient-to-b from-[#2e1a0e] to-[#1a0c05] p-5 text-amber-100 shadow-2xl">
            <h2 className="mb-2 text-center text-lg font-bold">Yarım Kalan Oyun</h2>
            <p className="mb-5 text-center text-sm text-amber-200/80">Önceki tek kişilik oyununuz kayıtlı. Nasıl devam etmek istersiniz?</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setIsResumePromptOpen(false); setResumeSinglePlayer(true); setActiveView('SINGLE_PLAYER'); }} className="rounded-xl border border-amber-300/70 bg-amber-600 px-4 py-3 text-sm font-bold text-white">Devam Et</button>
              <button onClick={() => { setIsResumePromptOpen(false); setResumeSinglePlayer(false); setIsSingleSetupOpen(true); }} className="rounded-xl border border-amber-800/70 bg-[#2b170c] px-4 py-3 text-sm font-bold text-amber-200">Yeni Oyun Başlat</button>
              <button onClick={() => setIsResumePromptOpen(false)} className="rounded-xl px-4 py-2 text-xs text-amber-300/70">Vazgeç</button>
            </div>
          </div>
        </div>
      )}

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
        radioAvailability={radioAvailability}
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
      </div>
    </div>
  );
}
