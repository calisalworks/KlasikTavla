import React, { useState, useEffect, useRef } from 'react';
import { GameRoom, RoomTierConfig, UserProfile } from '../types/game';
import { ONLINE_ROOM_TIERS } from '../utils/coinSettings';
import { tavlaAudio } from '../utils/audio';
import { deductMatchEntryFee } from '../firebase/coinService';
import { getWebSocketConfig } from '../utils/wsConfig';
import {
  Coins,
  ShieldAlert,
  Loader2,
  X,
  Swords,
  Trophy,
  ArrowRight,
  Gift,
  Video,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface OnlineLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onMatchFound: (roomId: string, myColor: 'white' | 'black', roomData: GameRoom) => void;
  onProfileUpdated?: (profile: UserProfile) => void;
  onOpenRewardedAd?: () => void;
  onClaimDailyReward?: () => void;
}

export const OnlineLobbyModal: React.FC<OnlineLobbyModalProps> = ({
  isOpen,
  onClose,
  profile,
  onMatchFound,
  onProfileUpdated,
  onOpenRewardedAd,
}) => {
  const [searchingTier, setSearchingTier] = useState<RoomTierConfig | null>(null);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [matchedOpponent, setMatchedOpponent] = useState<{
    name: string;
    avatar?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessingEntry, setIsProcessingEntry] = useState(false);

  // Horizontal room tier carousel state
  const [currentTierIndex, setCurrentTierIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handlePrevTier = () => {
    tavlaAudio.playButtonClick();
    setCurrentTierIndex((prev) => (prev > 0 ? prev - 1 : ONLINE_ROOM_TIERS.length - 1));
  };

  const handleNextTier = () => {
    tavlaAudio.playButtonClick();
    setCurrentTierIndex((prev) => (prev < ONLINE_ROOM_TIERS.length - 1 ? prev + 1 : 0));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    setTouchDeltaX(0);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const currentX = e.touches[0].clientX;
    setTouchDeltaX(currentX - touchStartXRef.current);
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current !== null) {
      if (touchDeltaX < -40) {
        handleNextTier();
      } else if (touchDeltaX > 40) {
        handlePrevTier();
      }
    }
    touchStartXRef.current = null;
    setTouchDeltaX(0);
    setIsDragging(false);
  };

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Maintain WebSocket connection for matchmaking
  useEffect(() => {
    if (!isOpen) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setSearchingTier(null);
      setSearchSeconds(0);
      setMatchedOpponent(null);
      setErrorMessage(null);
      return;
    }

    const wsConfig = getWebSocketConfig();
    if (!wsConfig.url) {
      setErrorMessage(wsConfig.errorMessage || 'Canlı sunucu adresi tanımlanmadı.');
      return;
    }
    const ws = new WebSocket(wsConfig.url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'player:init',
          playerId: profile.id,
          playerName: profile.name,
          playerAvatar: profile.avatar,
          avatar: profile.avatar,
          playerCoins: profile.coins,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'matchmaking:queued': {
            setIsProcessingEntry(false);
            break;
          }

          case 'matchmaking:cancelled': {
            setSearchingTier(null);
            setSearchSeconds(0);
            setIsProcessingEntry(false);
            break;
          }

          case 'match:found': {
            // Opponent found!
            tavlaAudio.playDiceRoll();
            setMatchedOpponent(msg.opponent);

            // Wait 1.2s to show celebration before switching to board
            setTimeout(() => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                try {
                  wsRef.current.send(JSON.stringify({ type: 'lobby:leaving_for_board' }));
                } catch {
                  // ignore
                }
                wsRef.current.close();
                wsRef.current = null;
              }
              onMatchFound(msg.roomId, msg.myColor, msg.room);
            }, 1200);
            break;
          }

          case 'room:joined': {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              try {
                wsRef.current.send(JSON.stringify({ type: 'lobby:leaving_for_board' }));
              } catch {
                // ignore
              }
              wsRef.current.close();
              wsRef.current = null;
            }
            onMatchFound(msg.room.id, msg.myColor || 'white', msg.room);
            break;
          }

          case 'error': {
            setErrorMessage(msg.message || 'Bir hata oluştu.');
            setIsProcessingEntry(false);
            setSearchingTier(null);
            break;
          }
        }
      } catch (e) {
        console.error('Lobby WS error:', e);
      }
    };

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isOpen]);

  // Matchmaking elapsed timer
  useEffect(() => {
    if (searchingTier && !matchedOpponent) {
      setSearchSeconds(0);
      timerRef.current = setInterval(() => {
        setSearchSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [searchingTier, matchedOpponent]);

  // Start matchmaking in a tier
  const handleSelectTier = async (tier: RoomTierConfig) => {
    setErrorMessage(null);
    const userCoins = profile.coins ?? 1000;

    // 1. Balance verification check
    if (userCoins < tier.entryFee) {
      setErrorMessage(
        `Yetersiz jeton! ${tier.name} odasına giriş için ${tier.entryFee} jeton gereklidir. Mevcut: ${userCoins} jeton.`
      );
      tavlaAudio.playButtonClick();
      return;
    }

    tavlaAudio.playButtonClick();
    setIsProcessingEntry(true);
    setSearchingTier(tier);

    try {
      // Deduct entry fee atomically from client and server
      const tempMatchId = `queue_${tier.id}_${Date.now()}`;
      const updatedProfile = await deductMatchEntryFee(
        profile,
        tier.entryFee,
        tempMatchId,
        tier.name
      );
      if (onProfileUpdated) {
        onProfileUpdated(updatedProfile);
      }

      // Send join queue message
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'matchmaking:join',
            tierId: tier.id,
            profile: updatedProfile,
          })
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Eşleşme başlatılamadı.');
      setSearchingTier(null);
      setIsProcessingEntry(false);
    }
  };

  // Cancel matchmaking and refund entry fee
  const handleCancelSearch = () => {
    if (!searchingTier) return;
    tavlaAudio.playButtonClick();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'matchmaking:cancel' }));
    }

    // Refund entry fee back to user
    const refundedCoins = (profile.coins ?? 1000) + searchingTier.entryFee;
    const updated = { ...profile, coins: refundedCoins };
    if (onProfileUpdated) {
      onProfileUpdated(updated);
    }

    setSearchingTier(null);
    setSearchSeconds(0);
    setIsProcessingEntry(false);
  };

  if (!isOpen) return null;

  const userCoins = profile.coins ?? 1000;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="w-full max-w-md sm:max-w-lg rounded-3xl bg-gradient-to-b from-[#2e1a0e] via-[#241309] to-[#1a0c05] border-2 border-amber-600/70 text-amber-100 shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col">
        {/* Compact Header (Küçültülmüş başlık, 'Jetonlu' ve 'Özel Masa' ibareleri kaldırıldı) */}
        <div className="flex items-center justify-between px-4 py-2.5 sm:py-3 border-b border-amber-800/60 bg-[#25140b] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-950 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow">
              <Swords className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <h2 className="text-xs sm:text-sm font-extrabold text-amber-100 tracking-wide">
              Online Odalar
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            {/* User Coin Balance Badge */}
            <div className="px-2.5 py-1 rounded-xl bg-[#1c0d05] border border-amber-500/50 shadow flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-xs font-black text-amber-200">
                {userCoins.toLocaleString()}
              </span>
            </div>

            <button
              onClick={() => {
                if (searchingTier) handleCancelSearch();
                onClose();
              }}
              className="p-1 rounded-xl hover:bg-amber-900/60 text-amber-300 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mx-3 mt-2 p-2 rounded-xl bg-red-950/90 border border-red-500/70 text-red-200 text-xs flex items-center justify-between shadow shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {onOpenRewardedAd && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenRewardedAd();
                  }}
                  className="px-2 py-0.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Video className="w-3 h-3" />
                  <span>Jeton Al</span>
                </button>
              )}
              <button
                onClick={() => setErrorMessage(null)}
                className="p-1 hover:bg-red-900/60 rounded text-red-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Body Container (Ekrana sığar, aşağı-yukarı kaydırma yok, sadece sağa-sola geçiş) */}
        <div className="p-3 sm:p-4 overflow-hidden">
          {/* SEARCHING OVERLAY */}
          {searchingTier ? (
            <div className="flex flex-col items-center justify-center py-4 px-3 text-center space-y-3 animate-fadeIn">
              {matchedOpponent ? (
                /* MATCH FOUND! */
                <div className="flex flex-col items-center gap-2.5">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center animate-bounce">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h3 className="text-base font-black text-emerald-300">RAKİP BULUNDU!</h3>
                  <div className="text-xs text-amber-100 font-bold flex items-center gap-2">
                    <span>{matchedOpponent.name}</span>
                    <span className="text-amber-400/60">•</span>
                    <span className="text-amber-300">{searchingTier.name}</span>
                  </div>
                  <div className="text-[10px] text-amber-300/80">Oyun tahtası yükleniyor...</div>
                </div>
              ) : (
                /* SEARCHING ANIMATION */
                <div className="flex flex-col items-center gap-2.5 max-w-xs">
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-600/30 to-amber-950/80 border border-amber-500/60 flex items-center justify-center shadow-inner">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-stone-900 text-[10px] font-black">
                      {searchSeconds}s
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-amber-100">
                      Uygun Rakip Aranıyor...
                    </h3>
                    <div className="text-xs text-amber-300/80 mt-0.5">
                      Oda: <strong className="text-amber-200">{searchingTier.name}</strong> • Giriş: <strong>{searchingTier.entryFee} Jeton</strong>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-[#1b0d05] border border-amber-800/50 text-[11px] text-amber-300/70 text-center w-full">
                    <div>Ödül Havuzu: <strong className="text-emerald-400 font-bold">{searchingTier.prizePool} Jeton</strong></div>
                  </div>

                  <button
                    onClick={handleCancelSearch}
                    className="w-full py-2 rounded-xl bg-[#2e160a] hover:bg-red-950/80 text-amber-300 hover:text-red-200 border border-amber-700/60 hover:border-red-500/60 text-xs font-bold shadow transition-all cursor-pointer"
                  >
                    Eşleşmeyi İptal Et
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* YANLAMASINA KAYDIRILAN ODA CAROUSEL'İ (HER KAYDIRMADA 1 ODA, AŞAĞI YUKARI KAYDIRMA YOK) */
            <div className="flex flex-col justify-between space-y-2.5">
              {/* Header Info & Swipe Hint */}
              <div className="flex items-center justify-between px-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-amber-200 uppercase tracking-wider text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-600/50">
                    Oda {currentTierIndex + 1} / {ONLINE_ROOM_TIERS.length}
                  </span>
                  <span className="text-amber-300/70 hidden sm:inline text-[11px]">
                    2 Kişilik • Tek Maç
                  </span>
                </div>

                <div className="text-[10px] sm:text-[11px] font-semibold text-amber-400 flex items-center gap-1 animate-pulse">
                  <span>← Sağa / sola kaydırın →</span>
                </div>
              </div>

              {/* Horizontal Carousel Area with Left & Right Arrow Buttons */}
              <div className="relative flex items-center gap-2">
                {/* Sol Ok Butonu */}
                <button
                  onClick={handlePrevTier}
                  title="Önceki Oda"
                  aria-label="Önceki Oda"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#1d0e06]/95 hover:bg-amber-600 border-2 border-amber-500/70 text-amber-300 hover:text-white flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.8)] transition-all hover:scale-105 active:scale-90 cursor-pointer shrink-0 z-10"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Akışkan, Animasyonlu Oda Kartları Alanı (Tüm kartlar yan yana dizili, yatay kaydırma animasyonlu) */}
                <div
                  className="flex-1 overflow-hidden relative rounded-2xl cursor-grab active:cursor-grabbing"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <div
                    className="flex w-full will-change-transform"
                    style={{
                      transform: isDragging
                        ? `calc(-${currentTierIndex * 100}% + ${touchDeltaX}px)`
                        : `translateX(-${currentTierIndex * 100}%)`,
                      transition: isDragging
                        ? 'none'
                        : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    {ONLINE_ROOM_TIERS.map((tier) => {
                      const hasEnoughCoins = userCoins >= tier.entryFee;

                      return (
                        <div key={tier.id} className="w-full shrink-0 flex-none px-0.5">
                          <div
                            className={`relative p-3 sm:p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-colors select-none shadow-[0_8px_24px_rgba(0,0,0,0.8)] ${
                              hasEnoughCoins
                                ? 'bg-gradient-to-b from-[#3d2010] via-[#2c170b] to-[#1a0c05] border-amber-500/80 hover:border-amber-400'
                                : 'bg-[#180d06]/90 border-amber-900/50 opacity-80'
                            }`}
                          >
                            {/* Top Badges */}
                            <div className="flex items-center justify-between mb-2">
                              <span className="px-2 py-0.5 rounded-lg bg-amber-950 border border-amber-500/60 text-xs font-black text-amber-200 uppercase tracking-widest shadow">
                                {tier.name}
                              </span>
                              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-black text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded-lg border border-emerald-500/50 shadow">
                                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>{tier.prizePool} Jeton Ödül</span>
                              </div>
                            </div>

                            {/* Description */}
                            <div className="text-[11px] sm:text-xs text-amber-100/90 font-medium mb-2 line-clamp-1">
                              {tier.description}
                            </div>

                            {/* Room Stats Highlight Boxes */}
                            <div className="grid grid-cols-2 gap-2 mb-2.5">
                              <div className="p-2 rounded-xl bg-[#160b04]/90 border border-amber-900/50 flex flex-col">
                                <span className="text-[9px] sm:text-[10px] text-amber-400/70 font-semibold uppercase">
                                  Giriş Ücreti
                                </span>
                                <span className="text-xs sm:text-sm font-black text-amber-200 flex items-center gap-1 mt-0.5">
                                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                                  {tier.entryFee} Jeton
                                </span>
                              </div>

                              <div className="p-2 rounded-xl bg-[#160b04]/90 border border-amber-900/50 flex flex-col">
                                <span className="text-[9px] sm:text-[10px] text-emerald-400/70 font-semibold uppercase">
                                  Kazanan Ödülü
                                </span>
                                <span className="text-xs sm:text-sm font-black text-emerald-400 flex items-center gap-1 mt-0.5">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                  {tier.prizePool} Jeton
                                </span>
                              </div>
                            </div>

                            {/* Action Button */}
                            <div className="pt-2 border-t border-amber-900/60 flex items-center justify-between gap-2">
                              <div className="text-[10px] sm:text-[11px] text-amber-300/80 hidden sm:block">
                                Bakiyeniz: <strong className="text-white font-bold">{userCoins.toLocaleString()}</strong>
                              </div>

                              <button
                                onClick={() => handleSelectTier(tier)}
                                disabled={!hasEnoughCoins || isProcessingEntry}
                                className={`w-full sm:w-auto px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all shadow-lg ${
                                  hasEnoughCoins
                                    ? 'bg-gradient-to-b from-amber-500 via-amber-600 to-amber-800 hover:from-amber-400 hover:to-amber-700 text-white border border-amber-300/80 cursor-pointer hover:scale-[1.02] active:scale-95'
                                    : 'bg-stone-800 text-stone-400 border border-stone-700 cursor-not-allowed'
                                }`}
                              >
                                {hasEnoughCoins ? (
                                  <>
                                    <span>OYNA ({tier.entryFee} JETON)</span>
                                    <ArrowRight className="w-4 h-4" />
                                  </>
                                ) : (
                                  <span>Yetersiz Jeton ({tier.entryFee} Gerekli)</span>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sağ Ok Butonu */}
                <button
                  onClick={handleNextTier}
                  title="Sonraki Oda"
                  aria-label="Sonraki Oda"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#1d0e06]/95 hover:bg-amber-600 border-2 border-amber-500/70 text-amber-300 hover:text-white flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.8)] transition-all hover:scale-105 active:scale-90 cursor-pointer shrink-0 z-10"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Carousel Pagination Dots */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {ONLINE_ROOM_TIERS.map((tier, idx) => {
                  const isActive = idx === currentTierIndex;
                  return (
                    <button
                      key={tier.id}
                      onClick={() => {
                        tavlaAudio.playButtonClick();
                        setCurrentTierIndex(idx);
                      }}
                      title={tier.name}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        isActive
                          ? 'w-6 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                          : 'w-2 bg-stone-700 hover:bg-amber-600/60'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Insufficient coins quick reward tip */}
              {userCoins < ONLINE_ROOM_TIERS[currentTierIndex].entryFee && onOpenRewardedAd && (
                <div className="p-2 rounded-xl bg-[#1b0e06] border border-amber-800/40 flex items-center justify-between text-xs mt-1">
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-amber-300/80">
                    <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Jetonunuz yetersiz. Reklam izleyerek hemen jeton kazanın.</span>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenRewardedAd();
                    }}
                    className="px-2 py-0.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-bold shrink-0 cursor-pointer ml-2"
                  >
                    Reklam İzle
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="px-4 py-2 border-t border-amber-800/60 bg-[#25140b] flex justify-between items-center shrink-0 text-xs text-amber-300/80">
          <div className="text-[11px] sm:text-xs">
            Oyuncu: <strong className="text-amber-100">{profile.name}</strong>
          </div>
          <button
            onClick={() => {
              if (searchingTier) handleCancelSearch();
              onClose();
            }}
            className="px-3.5 py-1 rounded-xl bg-[#1c0d05] hover:bg-[#2c1509] text-amber-200 border border-amber-700/40 text-xs font-semibold cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
