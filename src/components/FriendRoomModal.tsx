import React, { useState, useEffect, useRef } from 'react';
import { GameRoom, TargetScore, UserProfile } from '../types/game';
import { FRIEND_ROOM_OPTIONS, FriendRoomOption } from '../utils/coinSettings';
import { tavlaAudio } from '../utils/audio';
import { deductMatchEntryFee, refundMatchEntryFee } from '../firebase/coinService';
import { AvatarDisplay } from './AvatarDisplay';
import { getWebSocketConfig } from '../utils/wsConfig';
import {
  Users,
  Coins,
  Copy,
  Check,
  Share2,
  X,
  Loader2,
  AlertCircle,
  Swords,
  Trophy,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface FriendRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  initialInviteCode?: string | null;
  onMatchFound: (roomId: string, myColor: 'white' | 'black', roomData: GameRoom) => void;
  onProfileUpdated?: (profile: UserProfile) => void;
  onOpenRewardedAd?: () => void;
  onClaimDailyReward?: () => void;
}

export const FriendRoomModal: React.FC<FriendRoomModalProps> = ({
  isOpen,
  onClose,
  profile,
  initialInviteCode,
  onMatchFound,
  onProfileUpdated,
  onOpenRewardedAd,
}) => {
  const [activeTab, setActiveTab] = useState<'CREATE' | 'JOIN'>('CREATE');

  // Create room state (Yatay akışkan geçişli bahis sistemi)
  const [currentOptionIndex, setCurrentOptionIndex] = useState(0);
  const selectedOption = FRIEND_ROOM_OPTIONS[currentOptionIndex];
  const touchStartXRef = useRef<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handlePrevOption = () => {
    tavlaAudio.playButtonClick();
    setCurrentOptionIndex((prev) => (prev > 0 ? prev - 1 : FRIEND_ROOM_OPTIONS.length - 1));
    setErrorMessage(null);
  };

  const handleNextOption = () => {
    tavlaAudio.playButtonClick();
    setCurrentOptionIndex((prev) => (prev < FRIEND_ROOM_OPTIONS.length - 1 ? prev + 1 : 0));
    setErrorMessage(null);
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
        handleNextOption();
      } else if (touchDeltaX > 40) {
        handlePrevOption();
      }
    }
    touchStartXRef.current = null;
    setTouchDeltaX(0);
    setIsDragging(false);
  };

  const [roomTargetScore, setRoomTargetScore] = useState<TargetScore>(3);
  const [createdRoom, setCreatedRoom] = useState<{
    roomId: string;
    inviteCode: string;
    entryFee: number;
    prizePool: number;
    targetScore: TargetScore;
  } | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isShareSuccess, setIsShareSuccess] = useState(false);

  // Join room state
  const [inputCode, setInputCode] = useState('');
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [roomPreview, setRoomPreview] = useState<{
    roomId: string;
    creatorName: string;
    creatorAvatar?: string;
    creatorId: string;
    entryFee: number;
    prizePool: number;
    inviteCode: string;
    targetScore?: TargetScore;
  } | null>(null);

  // General state
  const [matchedOpponent, setMatchedOpponent] = useState<{
    name: string;
    avatar?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const transitionTriggeredRef = useRef<boolean>(false);
  const userCoins = profile.coins ?? 1000;

  // Pre-fill initial invite code if opened via URL link
  useEffect(() => {
    if (initialInviteCode) {
      setActiveTab('JOIN');
      setInputCode(initialInviteCode.trim().toUpperCase());
      fetchRoomPreview(initialInviteCode.trim().toUpperCase());
    }
  }, [initialInviteCode, isOpen]);

  // Connect WebSocket when modal is open
  useEffect(() => {
    if (!isOpen) {
      cleanupWs();
      resetState();
      return;
    }

    transitionTriggeredRef.current = false;
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
          case 'friend_room:created': {
            setIsCreatingRoom(false);
            const targetScore = (msg.targetScore as TargetScore) || roomTargetScore;
            setCreatedRoom({
              roomId: msg.roomId,
              inviteCode: msg.inviteCode,
              entryFee: msg.entryFee,
              prizePool: msg.prizePool,
              targetScore,
            });
            break;
          }

          case 'friend_room:target_score_updated': {
            if (msg.targetScore) {
              const newScore = msg.targetScore as TargetScore;
              setRoomTargetScore(newScore);
              setCreatedRoom((prev) =>
                prev ? { ...prev, targetScore: newScore } : null
              );
              setSuccessNotice(`Hedef puan ${newScore} olarak güncellendi.`);
              setTimeout(() => setSuccessNotice(null), 2500);
            }
            break;
          }

          case 'friend_room:matched': {
            // Opponent joined friend room!
            if (transitionTriggeredRef.current) break;
            transitionTriggeredRef.current = true;
            tavlaAudio.playDiceRoll();
            const opponent = msg.creator?.id === profile.id ? msg.opponent : msg.creator;
            setMatchedOpponent(opponent);

            // Wait 1.2s to show celebration banner before launching board
            setTimeout(() => {
              cleanupWs();
              const myColor = msg.creator?.id === profile.id ? 'white' : 'black';
              onMatchFound(msg.roomId, myColor, msg.room);
            }, 1200);
            break;
          }

          case 'room:joined': {
            // Player successfully joined room as guest
            if (transitionTriggeredRef.current) break;
            if (msg.room) {
              transitionTriggeredRef.current = true;
              tavlaAudio.playDiceRoll();
              setTimeout(() => {
                cleanupWs();
                onMatchFound(msg.room.id, msg.myColor || 'black', msg.room);
              }, 1200);
            }
            break;
          }

          case 'friend_room:cancelled': {
            setCreatedRoom(null);
            setIsCreatingRoom(false);
            break;
          }

          case 'error': {
            setErrorMessage(msg.message || 'Bir hata oluştu.');
            setIsCreatingRoom(false);
            setIsJoiningRoom(false);
            break;
          }
        }
      } catch (e) {
        console.error('Friend Room WS parse error:', e);
      }
    };

    return () => {
      cleanupWs();
    };
  }, [isOpen, profile.id, profile.name]);

  const cleanupWs = () => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'lobby:leaving_for_board' }));
        } catch {
          // ignore
        }
      }
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const resetState = () => {
    setCreatedRoom(null);
    setIsCreatingRoom(false);
    setIsCopied(false);
    setIsShareSuccess(false);
    setInputCode('');
    setIsCheckingCode(false);
    setIsJoiningRoom(false);
    setRoomPreview(null);
    setMatchedOpponent(null);
    setErrorMessage(null);
    setSuccessNotice(null);
  };

  // 1. CREATE FRIEND ROOM
  const handleCreateRoom = async () => {
    setErrorMessage(null);

    // Balance check
    if (userCoins < selectedOption.fee) {
      setErrorMessage(
        `Yetersiz jeton! Bu odayı kurmak için ${selectedOption.fee} jeton gereklidir. Mevcut: ${userCoins} jeton.`
      );
      tavlaAudio.playButtonClick();
      return;
    }

    tavlaAudio.playButtonClick();
    setIsCreatingRoom(true);

    try {
      // Deduct entry fee atomically
      const tempId = `friend_pending_${Date.now()}`;
      const updated = await deductMatchEntryFee(
        profile,
        selectedOption.fee,
        tempId,
        `Özel Masa (${selectedOption.fee} Jeton)`
      );
      if (onProfileUpdated) onProfileUpdated(updated);

      // Tell server to create room
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'friend_room:create',
            entryFee: selectedOption.fee,
            targetScore: roomTargetScore,
            profile: updated,
          })
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Oda oluşturulamadı.');
      setIsCreatingRoom(false);
    }
  };

  const handleUpdateTargetScore = (newScore: TargetScore) => {
    tavlaAudio.playButtonClick();
    setRoomTargetScore(newScore);
    if (createdRoom) {
      setCreatedRoom((prev) => (prev ? { ...prev, targetScore: newScore } : null));
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'friend_room:set_target_score',
            roomId: createdRoom.roomId,
            targetScore: newScore,
          })
        );
      }
    }
  };

  // 2. CANCEL & REFUND CREATED ROOM
  const handleCancelCreatedRoom = async () => {
    if (!createdRoom) return;
    tavlaAudio.playButtonClick();

    try {
      // Notify server
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'friend_room:cancel',
            roomId: createdRoom.roomId,
          })
        );
      }

      // Refund fee on client and Firestore
      const updated = await refundMatchEntryFee(
        profile,
        createdRoom.entryFee,
        createdRoom.roomId,
        'Özel Masa'
      );
      if (onProfileUpdated) onProfileUpdated(updated);

      setCreatedRoom(null);
      setSuccessNotice(`${createdRoom.entryFee} jeton hesabınıza iade edildi.`);
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err: any) {
      console.warn('Refund error:', err);
      setCreatedRoom(null);
    }
  };

  // 3. COPY INVITE CODE
  const handleCopyCode = async () => {
    if (!createdRoom) return;
    tavlaAudio.playButtonClick();

    try {
      await navigator.clipboard.writeText(createdRoom.inviteCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  // 4. SHARE INVITE LINK
  const handleShareLink = async () => {
    if (!createdRoom) return;
    tavlaAudio.playButtonClick();

    const shareUrl = `${window.location.origin}/?friendRoom=${createdRoom.inviteCode}`;
    const shareText = `Tavla'da seninle kapışalım! Davet Kodum: ${createdRoom.inviteCode} (${createdRoom.entryFee} Jeton Bahisli)`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Klasik Tavla - Arkadaşınla Oyna',
          text: shareText,
          url: shareUrl,
        });
        setIsShareSuccess(true);
        setTimeout(() => setIsShareSuccess(false), 2500);
      } catch (err) {
        // User cancelled or share failed, fallback to clipboard
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      }
    } else {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  // 5. FETCH ROOM PREVIEW BY CODE
  const fetchRoomPreview = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setRoomPreview(null);
      return;
    }

    setIsCheckingCode(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/friend-room/info?code=${encodeURIComponent(clean)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRoomPreview(null);
        if (clean.length === 6) {
          setErrorMessage(data.error || 'Oda bulunamadı.');
        }
        return;
      }
      const roomData = await res.json();
      setRoomPreview(roomData);
    } catch {
      setRoomPreview(null);
    } finally {
      setIsCheckingCode(false);
    }
  };

  // 6. JOIN ROOM BY CODE
  const handleJoinRoom = async () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) {
      setErrorMessage('Lütfen davet kodunu girin.');
      return;
    }

    if (!roomPreview) {
      await fetchRoomPreview(code);
      return;
    }

    // Security check: cannot play against self
    if (roomPreview.creatorId === profile.id) {
      setErrorMessage('Kendi oluşturduğunuz odaya katılamazsınız.');
      return;
    }

    // Balance check
    if (userCoins < roomPreview.entryFee) {
      setErrorMessage(
        `Yetersiz jeton! Bu odaya katılmak için ${roomPreview.entryFee} jeton gereklidir. Mevcut: ${userCoins} jeton.`
      );
      tavlaAudio.playButtonClick();
      return;
    }

    tavlaAudio.playButtonClick();
    setIsJoiningRoom(true);

    try {
      // Deduct entry fee
      const tempId = `friend_join_${roomPreview.roomId}`;
      const updated = await deductMatchEntryFee(
        profile,
        roomPreview.entryFee,
        tempId,
        `Özel Masa Katılımı (${roomPreview.entryFee} Jeton)`
      );
      if (onProfileUpdated) onProfileUpdated(updated);

      // Send join message via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'friend_room:join',
            inviteCode: code,
            profile: updated,
          })
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Odaya katılırken bir hata oluştu.');
      setIsJoiningRoom(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md sm:max-w-lg max-h-[92vh] flex flex-col rounded-3xl bg-gradient-to-b from-[#2d1b11] via-[#1f120a] to-[#140b06] border-2 border-amber-600/70 shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden text-amber-50">
        {/* Top Header Bar (Kompakt ve ekrana sığan tasarım) */}
        <div className="relative py-2 sm:py-2.5 px-4 border-b border-amber-700/40 bg-gradient-to-r from-amber-950/80 via-[#3a2012]/90 to-amber-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold text-amber-100 tracking-wide flex items-center gap-1.5">
                <span>Arkadaşınla Oyna</span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Özel Oda
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* User Coin Display */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-950/90 border border-amber-400/40 text-[11px] font-black text-amber-300 shadow-inner">
              <Coins className="w-3 h-3 text-amber-400 animate-pulse" />
              <span>{userCoins.toLocaleString('tr-TR')}</span>
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                if (createdRoom) {
                  handleCancelCreatedRoom();
                }
                tavlaAudio.playButtonClick();
                onClose();
              }}
              className="w-7 h-7 rounded-full bg-amber-950/80 hover:bg-amber-800 text-amber-300 flex items-center justify-center transition-colors border border-amber-700/50 cursor-pointer"
              title="Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher (Only if room is not yet created) */}
        {!createdRoom && (
          <div className="px-4 pt-1.5 pb-1 flex border-b border-amber-800/30 gap-2 shrink-0">
            <button
              onClick={() => {
                tavlaAudio.playButtonClick();
                setActiveTab('CREATE');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'CREATE'
                  ? 'bg-amber-600 text-amber-950 shadow-[0_4px_12px_rgba(217,119,6,0.35)] font-black'
                  : 'bg-[#2a170d] hover:bg-[#341d11] text-amber-300/80 border border-amber-800/40'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Oda Oluştur</span>
            </button>
            <button
              onClick={() => {
                tavlaAudio.playButtonClick();
                setActiveTab('JOIN');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'JOIN'
                  ? 'bg-amber-600 text-amber-950 shadow-[0_4px_12px_rgba(217,119,6,0.35)] font-black'
                  : 'bg-[#2a170d] hover:bg-[#341d11] text-amber-300/80 border border-amber-800/40'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Odaya Katıl</span>
            </button>
          </div>
        )}

        {/* Modal Body Content (CREATE modunda aşağı kaydırma yok, ekrana tam sığar) */}
        <div
          className={`flex-1 ${
            activeTab === 'CREATE' && !createdRoom ? 'overflow-hidden' : 'overflow-y-auto'
          } p-3 sm:p-4 space-y-2.5`}
        >
          {/* Notifications / Errors */}
          {errorMessage && (
            <div className="p-2 sm:p-2.5 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs flex items-center gap-2 shadow shrink-0">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <div className="flex-1 text-[11px]">{errorMessage}</div>
              {errorMessage.includes('Yetersiz') && onOpenRewardedAd && (
                <button
                  onClick={() => {
                    tavlaAudio.playButtonClick();
                    onOpenRewardedAd();
                  }}
                  className="px-2 py-0.5 rounded-lg bg-amber-500 text-amber-950 font-bold text-[10px] shrink-0 hover:bg-amber-400 cursor-pointer"
                >
                  Jeton Kazan
                </button>
              )}
            </div>
          )}

          {successNotice && (
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs flex items-center gap-2 shadow shrink-0">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="flex-1 font-semibold text-[11px]">{successNotice}</div>
            </div>
          )}

          {/* Matched Opponent Celebration Banner */}
          {matchedOpponent && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-amber-950 shadow-xl flex items-center justify-center gap-2.5 animate-bounce shrink-0">
              <Swords className="w-5 h-5 animate-spin" />
              <div className="text-center">
                <div className="text-xs sm:text-sm font-black tracking-wide">RAKİP BULUNDU!</div>
                <div className="text-[11px] font-bold text-amber-900">
                  {matchedOpponent.name} masaya bağlandı, maç başlıyor...
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: ODA OLUŞTUR (KÜÇÜLTÜLMÜŞ, YALNIZCA SAĞA-SOLA KAYDIRILAN, AŞAĞI KAYDIRMASIZ) */}
          {activeTab === 'CREATE' && !createdRoom && (
            <div className="space-y-2">
              {/* Header Info & Swipe Hint */}
              <div className="flex items-center justify-between px-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-amber-200 uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-600/50">
                    Bahis {currentOptionIndex + 1} / {FRIEND_ROOM_OPTIONS.length}
                  </span>
                  <span className="text-amber-300/70 hidden sm:inline text-[10px]">
                    2 Kişilik • Özel Masa
                  </span>
                </div>

                <div className="text-[10px] font-semibold text-amber-400 flex items-center gap-1 animate-pulse">
                  <span>← Sağa / sola kaydırın →</span>
                </div>
              </div>

              {/* Horizontal Carousel Area with Left & Right Arrow Buttons */}
              <div className="relative flex items-center gap-1.5 sm:gap-2">
                {/* Sol Ok Butonu */}
                <button
                  type="button"
                  onClick={handlePrevOption}
                  title="Önceki Bahis"
                  aria-label="Önceki Bahis"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1d0e06]/95 hover:bg-amber-600 border-2 border-amber-500/70 text-amber-300 hover:text-white flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.8)] transition-all hover:scale-105 active:scale-90 cursor-pointer shrink-0 z-10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Akışkan, Animasyonlu Bahis Kartları Alanı (Küçültülmüş boyutlar, ekrana sığar) */}
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
                        ? `calc(-${currentOptionIndex * 100}% + ${touchDeltaX}px)`
                        : `translateX(-${currentOptionIndex * 100}%)`,
                      transition: isDragging
                        ? 'none'
                        : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    {FRIEND_ROOM_OPTIONS.map((opt, idx) => {
                      const canAfford = userCoins >= opt.fee;

                      return (
                        <div key={opt.fee} className="w-full shrink-0 flex-none px-0.5">
                          <div
                            className={`relative p-2.5 sm:p-3 rounded-xl border-2 text-left flex flex-col justify-between transition-colors select-none shadow-[0_6px_20px_rgba(0,0,0,0.8)] ${
                              canAfford
                                ? 'bg-gradient-to-b from-[#3d2010] via-[#2c170b] to-[#1a0c05] border-amber-500/80 hover:border-amber-400'
                                : 'bg-[#180d06]/90 border-amber-900/50 opacity-80'
                            }`}
                          >
                            {/* Top Badges */}
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="px-2 py-0.5 rounded-lg bg-amber-950 border border-amber-500/60 text-[10px] font-black text-amber-200 uppercase tracking-widest shadow">
                                {opt.tag}
                              </span>
                              {canAfford ? (
                                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-black text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded-lg border border-emerald-500/50 shadow">
                                  <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span>{opt.prize.toLocaleString('tr-TR')} Jeton Ödül</span>
                                </div>
                              ) : (
                                <span className="text-[9px] text-red-400 font-bold px-1.5 py-0.5 rounded-md bg-red-950/90 border border-red-500/50 flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" /> Yetersiz
                                </span>
                              )}
                            </div>

                            {/* Description (Küçük 1 satır) */}
                            <div className="text-[10px] sm:text-[11px] text-amber-100/90 font-medium mb-1.5 line-clamp-1">
                              {opt.label} • Kazanan tüm havuzu ({opt.prize.toLocaleString('tr-TR')} Jeton) alır
                            </div>

                            {/* Room Stats Highlight Boxes (Kompakt boyutlar) */}
                            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                              <div className="p-1.5 rounded-lg bg-[#160b04]/90 border border-amber-900/50 flex flex-col">
                                <span className="text-[8px] sm:text-[9px] text-amber-400/70 font-semibold uppercase">
                                  Giriş Ücreti
                                </span>
                                <span className="text-xs sm:text-sm font-black text-amber-200 flex items-center gap-1 mt-0.5">
                                  <Coins className="w-3 h-3 text-amber-400" />
                                  {opt.fee.toLocaleString('tr-TR')} Jeton
                                </span>
                              </div>

                              <div className="p-1.5 rounded-lg bg-[#160b04]/90 border border-amber-900/50 flex flex-col">
                                <span className="text-[8px] sm:text-[9px] text-emerald-400/70 font-semibold uppercase">
                                  Kazanan Ödülü
                                </span>
                                <span className="text-xs sm:text-sm font-black text-emerald-400 flex items-center gap-1 mt-0.5">
                                  <Sparkles className="w-3 h-3 text-amber-400" />
                                  {opt.prize.toLocaleString('tr-TR')} Jeton
                                </span>
                              </div>
                            </div>

                            {/* Footer balance note inside card */}
                            <div className="pt-1 border-t border-amber-900/60 flex items-center justify-between text-[9px] sm:text-[10px] text-amber-300/80">
                              <span>Mevcut Bakiye:</span>
                              <strong className="text-white font-bold">{userCoins.toLocaleString('tr-TR')} Jeton</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sağ Ok Butonu */}
                <button
                  type="button"
                  onClick={handleNextOption}
                  title="Sonraki Bahis"
                  aria-label="Sonraki Bahis"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1d0e06]/95 hover:bg-amber-600 border-2 border-amber-500/70 text-amber-300 hover:text-white flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.8)] transition-all hover:scale-105 active:scale-90 cursor-pointer shrink-0 z-10"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Carousel Pagination Dots */}
              <div className="flex items-center justify-center gap-1.5 py-0.5">
                {FRIEND_ROOM_OPTIONS.map((opt, idx) => {
                  const isActive = idx === currentOptionIndex;
                  return (
                    <button
                      key={opt.fee}
                      type="button"
                      onClick={() => {
                        tavlaAudio.playButtonClick();
                        setCurrentOptionIndex(idx);
                        setErrorMessage(null);
                      }}
                      title={opt.label}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        isActive
                          ? 'w-5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                          : 'w-1.5 bg-stone-700 hover:bg-amber-600/60'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Action Button: Create Room (Kompakt ve Şık) */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={isCreatingRoom || userCoins < selectedOption.fee}
                  className="w-full py-2 sm:py-2.5 rounded-xl bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 disabled:opacity-50 text-amber-950 font-black text-xs sm:text-sm tracking-wide shadow-[0_4px_14px_rgba(217,119,6,0.4)] border border-amber-300 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                >
                  {isCreatingRoom ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Oda Oluşturuluyor...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{selectedOption.fee.toLocaleString('tr-TR')} Jeton ile Oda Oluştur</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Quick ad tip if coins insufficient */}
              {userCoins < selectedOption.fee && onOpenRewardedAd && (
                <div className="p-1.5 rounded-xl bg-[#1b0e06] border border-amber-800/40 flex items-center justify-between text-xs mt-0.5">
                  <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-amber-300/80">
                    <Coins className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Jetonunuz yetersiz. Reklam izleyerek hemen jeton kazanın.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenRewardedAd();
                    }}
                    className="px-2 py-0.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-[9px] font-bold shrink-0 cursor-pointer ml-2"
                  >
                    Reklam İzle
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CREATED ROOM WAITING LOBBY */}
          {createdRoom && (
            <div className="space-y-5 text-center py-2">
              <div className="p-4 rounded-3xl bg-gradient-to-b from-[#3b2213] to-[#241308] border-2 border-amber-500/70 shadow-2xl space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-300/80">
                  Arkadaşın İçin Davet Kodu
                </div>

                {/* Big Distinctive Invite Code */}
                <div className="py-3 px-6 rounded-2xl bg-gradient-to-r from-[#170a03] via-[#2a1306] to-[#170a03] border-2 border-amber-400/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] flex items-center justify-center gap-3">
                  <span className="text-3xl md:text-4xl font-black tracking-[0.25em] text-amber-200 select-all font-mono">
                    {createdRoom.inviteCode}
                  </span>
                </div>

                {/* Match Stake Info */}
                <div className="flex items-center justify-center gap-4 text-xs font-bold text-amber-200/90 pt-1">
                  <div className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>Giriş: {createdRoom.entryFee} Jeton</span>
                  </div>
                  <span className="text-amber-500">•</span>
                  <div className="flex items-center gap-1 text-emerald-400">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Ödül Havuzu: {createdRoom.prizePool} Jeton</span>
                  </div>
                </div>

                {/* Hedef Puan Belirleme (1, 3 veya 5 Puan) */}
                <div className="p-3 rounded-2xl bg-[#1e0e06] border border-amber-600/50 space-y-2 text-left">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-200 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>Maç Hedef Puanı:</span>
                    </span>
                    <span className="text-[11px] text-amber-300 font-bold">
                      İlk {createdRoom.targetScore || roomTargetScore} puana ulaşan kazanır
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {([1, 3, 5] as TargetScore[]).map((score) => {
                      const isSelected = (createdRoom.targetScore || roomTargetScore) === score;
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => handleUpdateTargetScore(score)}
                          className={`py-2 px-2.5 rounded-xl font-black text-xs transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                            isSelected
                              ? 'bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 text-stone-950 border-amber-300 shadow-[0_2px_10px_rgba(245,158,11,0.4)] scale-102'
                              : 'bg-[#281408] text-amber-300/80 border-amber-900/60 hover:border-amber-600 hover:text-amber-100'
                          }`}
                        >
                          <span>{score} Puan</span>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Copy & Share Actions */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={handleCopyCode}
                    className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-950" />
                        <span>Kopyalandı!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Kodu Kopyala</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleShareLink}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    {isShareSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Paylaşıldı!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>Bağlantı Paylaş</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Waiting Status Card */}
              <div className="p-3.5 rounded-2xl bg-[#241309] border border-amber-700/40 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                <div className="text-left">
                  <div className="text-xs font-bold text-amber-100">
                    Arkadaşının odaya katılması bekleniyor...
                  </div>
                  <div className="text-[11px] text-amber-300/70">
                    Kodu arkadaşına ilet, kod ile bağlandığında maç otomatik başlayacaktır.
                  </div>
                </div>
              </div>

              {/* Cancel Room Button */}
              <button
                onClick={handleCancelCreatedRoom}
                className="px-5 py-2.5 rounded-xl bg-red-950/70 hover:bg-red-900 text-red-200 border border-red-500/50 font-bold text-xs transition-colors cursor-pointer"
              >
                Odayı İptal Et ve Jetonu Geri Al
              </button>
            </div>
          )}

          {/* TAB 2: ODAYA KATIL */}
          {activeTab === 'JOIN' && !createdRoom && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-amber-200 uppercase tracking-wider block">
                  Arkadaşının Davet Kodunu Gir
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={8}
                    value={inputCode}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setInputCode(val);
                      if (val.trim().length >= 4) {
                        fetchRoomPreview(val);
                      } else {
                        setRoomPreview(null);
                        setErrorMessage(null);
                      }
                    }}
                    placeholder="Örn: 7X8K2M"
                    className="w-full py-3 px-4 rounded-2xl bg-[#1c0d06] border-2 border-amber-600/60 focus:border-amber-400 text-amber-100 font-mono font-black text-xl tracking-[0.2em] text-center placeholder:text-amber-800/60 focus:outline-none shadow-inner"
                  />
                  {isCheckingCode && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Room Preview Card if found */}
              {roomPreview && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#3b2213] to-[#251307] border-2 border-amber-500/80 shadow-xl space-y-3 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between border-b border-amber-700/40 pb-2">
                    <span className="text-xs font-bold text-amber-300">Oda Bulundu!</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Katılıma Açık
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <AvatarDisplay
                      avatar={roomPreview.creatorAvatar}
                      name={roomPreview.creatorName}
                      size={44}
                      className="border-2 border-amber-500/80 shadow"
                    />
                    <div>
                      <div className="text-sm font-black text-amber-100">
                        {roomPreview.creatorName}
                      </div>
                      <div className="text-xs text-amber-300/80">Oda Sahibi (Beyaz Pul)</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-xl bg-[#1c0e06] border border-amber-800/40">
                      <div className="text-[10px] text-amber-400 font-semibold">Giriş</div>
                      <div className="text-xs font-black text-amber-100 flex items-center justify-center gap-1">
                        <Coins className="w-3 h-3 text-amber-400" />
                        <span>{roomPreview.entryFee}</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-[#1c0e06] border border-amber-800/40">
                      <div className="text-[10px] text-emerald-400 font-semibold">Ödül</div>
                      <div className="text-xs font-black text-emerald-300 flex items-center justify-center gap-1">
                        <Trophy className="w-3 h-3 text-amber-400" />
                        <span>{roomPreview.prizePool}</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-[#1c0e06] border border-amber-800/40">
                      <div className="text-[10px] text-amber-300 font-semibold">Hedef</div>
                      <div className="text-xs font-black text-amber-200 flex items-center justify-center gap-1">
                        <Trophy className="w-3 h-3 text-amber-400" />
                        <span>{roomPreview.targetScore || 3} Puan</span>
                      </div>
                    </div>
                  </div>

                  {userCoins < roomPreview.entryFee && (
                    <div className="p-2 rounded-xl bg-red-950/70 border border-red-500/50 text-[11px] text-red-200 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>Yetersiz jeton! Bu odaya katılmak için {roomPreview.entryFee} jeton gereklidir.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Button: Join Room */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleJoinRoom}
                  disabled={
                    isJoiningRoom ||
                    !inputCode.trim() ||
                    Boolean(roomPreview && userCoins < roomPreview.entryFee)
                  }
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 disabled:opacity-50 text-amber-950 font-black text-sm tracking-wide shadow-[0_6px_20px_rgba(217,119,6,0.45)] border border-amber-300 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                >
                  {isJoiningRoom ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Odaya Katılınıyor...</span>
                    </>
                  ) : (
                    <>
                      <Swords className="w-4 h-4" />
                      <span>
                        {roomPreview
                          ? `${roomPreview.entryFee} Jeton ile Maça Katıl`
                          : 'Kodu Onayla ve Odaya Katıl'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
