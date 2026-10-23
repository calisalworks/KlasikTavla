import React, { useState, useEffect, useRef } from 'react';
import {
  Die,
  GameRoom,
  GameSettings,
  PlayerColor,
  UserProfile,
} from '../types/game';
import {
  calculatePipCounts,
  canBearOff,
  getLegalMovesForPosition,
  hasAnyLegalMoves,
  LegalMoveInfo,
} from '../utils/backgammonLogic';
import { tavlaAudio } from '../utils/audio';
import { findBestMovesForPlayer } from '../utils/aiPlayer';
import { CheckerPiece } from './CheckerPiece';
import { DicePhysicsView } from './DicePhysicsView';
import { AvatarDisplay } from './AvatarDisplay';
import { OpeningRollOverlay } from './OpeningRollOverlay';
import { awardMatchPrize } from '../firebase/coinService';
import { recordOnlineMatchInFirestore } from '../firebase/userService';
import { recordOnlineMatchResult } from '../utils/profileStorage';
import {
  Settings,
  Trophy,
  Info,
  Maximize,
  LogOut,
  Home,
  Users,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Check,
  Coins,
  Sparkles,
  Clock,
} from 'lucide-react';

interface OnlineBoardProps {
  roomId: string;
  profile: UserProfile;
  settings: GameSettings;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onLeaveRoom: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  onRecordMatch: (result: 'win' | 'loss' | 'abandoned') => void;
  onProfileUpdated?: (profile: UserProfile) => void;
}

interface DragState {
  from: number | 'bar';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
  hoveredTarget: number | 'off' | null;
}

export const OnlineBoard: React.FC<OnlineBoardProps> = ({
  roomId,
  profile,
  settings,
  onOpenSettings,
  onOpenRules,
  onLeaveRoom,
  onToggleFullscreen,
  isFullscreen,
  onRecordMatch,
  onProfileUpdated,
}) => {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [myColor, setMyColor] = useState<PlayerColor | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<number | 'bar' | null>(null);
  const [validDestinations, setValidDestinations] = useState<LegalMoveInfo[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Odaya bağlanılıyor...');
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [abandonedNotice, setAbandonedNotice] = useState<string | null>(null);
  const [matchRecorded, setMatchRecorded] = useState(false);
  const [prizeCoinsWon, setPrizeCoinsWon] = useState<number | null>(null);
  const [trophyDeltaWon, setTrophyDeltaWon] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const pointerCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastPointClickTimeRef = useRef<{ point: number | 'bar' | null; time: number }>({
    point: null,
    time: 0,
  });
  const autoPassIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [autoPassSecondsLeft, setAutoPassSecondsLeft] = useState<number | null>(null);
  const selectedAtRef = useRef<{ point: number | 'bar' | null; timestamp: number }>({
    point: null,
    timestamp: 0,
  });
  const justSelectedRef = useRef<number | 'bar' | null>(null);
  const prizeAwardedRef = useRef<boolean>(false);

  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [rematchStatus, setRematchStatus] = useState<'idle' | 'sent' | 'received'>('idle');
  const [rematchRequesterName, setRematchRequesterName] = useState<string | null>(null);
  const [opponentSliding, setOpponentSliding] = useState<{
    from: number | 'bar';
    to: number | 'off';
    color: PlayerColor;
    hit: boolean;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    progress: boolean;
  } | null>(null);

  const clearTurnTimer = () => {
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
    }
    setTurnSecondsLeft(null);
  };

  const getPointCoords = (
    point: number | 'bar' | 'off',
    color: PlayerColor,
    isBlack: boolean
  ) => {
    if (point === 'bar') {
      const isOpponent = color !== myColor;
      return { x: 50, y: isOpponent ? 25 : 75 };
    }
    if (point === 'off') {
      return { x: 96, y: 50 };
    }
    const lt = isBlack ? [12, 11, 10, 9, 8, 7] : [13, 14, 15, 16, 17, 18];
    const lb = isBlack ? [13, 14, 15, 16, 17, 18] : [12, 11, 10, 9, 8, 7];
    const rt = isBlack ? [6, 5, 4, 3, 2, 1] : [19, 20, 21, 22, 23, 24];
    const rb = isBlack ? [19, 20, 21, 22, 23, 24] : [6, 5, 4, 3, 2, 1];

    const ltIdx = lt.indexOf(point);
    if (ltIdx !== -1) return { x: 8 + ltIdx * 6.5, y: 22 };
    const lbIdx = lb.indexOf(point);
    if (lbIdx !== -1) return { x: 8 + lbIdx * 6.5, y: 78 };
    const rtIdx = rt.indexOf(point);
    if (rtIdx !== -1) return { x: 57 + rtIdx * 6.5, y: 22 };
    const rbIdx = rb.indexOf(point);
    if (rbIdx !== -1) return { x: 57 + rbIdx * 6.5, y: 78 };
    return { x: 50, y: 50 };
  };

  const triggerOpponentSlide = (
    from: number | 'bar',
    to: number | 'off',
    oppColor: PlayerColor,
    hit: boolean
  ) => {
    const isBlack = myColor === 'black';
    const start = getPointCoords(from, oppColor, isBlack);
    const target = getPointCoords(to, oppColor, isBlack);

    setOpponentSliding({
      from,
      to,
      color: oppColor,
      hit,
      startX: start.x,
      startY: start.y,
      targetX: target.x,
      targetY: target.y,
      progress: false,
    });

    requestAnimationFrame(() => {
      setOpponentSliding((prev) => (prev ? { ...prev, progress: true } : null));
    });

    setTimeout(() => {
      setOpponentSliding(null);
    }, 450);
  };

  const [shownOpeningRollKey, setShownOpeningRollKey] = useState<string | null>(null);
  const [isOpeningRollOpen, setIsOpeningRollOpen] = useState(false);

  useEffect(() => {
    if (!room || !room.openingRoll || room.status !== 'playing') return;
    const rollKey = `${room.id}_${room.openingRoll.whiteDie}_${room.openingRoll.blackDie}_${room.whiteScore}_${room.blackScore}`;
    if (shownOpeningRollKey !== rollKey) {
      setShownOpeningRollKey(rollKey);
      setIsOpeningRollOpen(true);
    }
  }, [room?.openingRoll, room?.status, room?.whiteScore, room?.blackScore, room?.id, shownOpeningRollKey]);

  const handleOpeningRollComplete = () => {
    setIsOpeningRollOpen(false);
    if (room && room.status === 'playing' && !room.winnerInfo) {
      startTurnTimer(room.turn);
    }
  };

  const startTurnTimer = (activeTurn?: PlayerColor) => {
    clearTurnTimer();
    setTurnSecondsLeft(15);
    let rem = 15;
    turnTimerRef.current = setInterval(() => {
      rem -= 1;
      if (rem <= 0) {
        clearTurnTimer();
        const currentActive = activeTurn || room?.turn;
        if (myColor && currentActive === myColor) {
          autoPlayRemainingDiceWithAI();
        }
      } else {
        setTurnSecondsLeft(rem);
      }
    }, 1000);
  };

  const autoPlayRemainingDiceWithAI = () => {
    setRoom((currRoom) => {
      if (!currRoom || !myColor || currRoom.turn !== myColor || currRoom.winnerInfo) return currRoom;
      const unusedDice = currRoom.dice.filter((d) => !d.used);
      if (unusedDice.length === 0) {
        wsRef.current?.send(JSON.stringify({ type: 'game:pass', roomId: currRoom.id }));
        return currRoom;
      }

      const moves = findBestMovesForPlayer(currRoom.board, myColor, currRoom.dice, 'medium');
      if (moves && moves.length > 0) {
        moves.forEach((step, idx) => {
          setTimeout(() => {
            wsRef.current?.send(
              JSON.stringify({
                type: 'game:move',
                from: step.from,
                to: step.to,
                dieValue: step.dieValue,
                dieIndex: step.dieIndex,
                roomId: currRoom.id,
              })
            );
          }, idx * 160);
        });
        setStatusMessage('15 saniyelik süre doldu! Hamle yapay zeka tarafından oynatıldı ve sıra devredildi.');
        // After AI moves are played, pass turn to opponent
        setTimeout(() => {
          wsRef.current?.send(JSON.stringify({ type: 'game:pass', roomId: currRoom.id }));
        }, moves.length * 160 + 250);
      } else {
        wsRef.current?.send(JSON.stringify({ type: 'game:pass', roomId: currRoom.id }));
      }
      return currRoom;
    });
  };

  const clearAutoPassTimers = () => {
    if (autoPassIntervalRef.current) {
      clearInterval(autoPassIntervalRef.current);
      autoPassIntervalRef.current = null;
    }
    setAutoPassSecondsLeft(null);
  };

  // Sync sound settings
  useEffect(() => {
    tavlaAudio.setSoundEnabled(settings.soundEnabled);
    tavlaAudio.setAmbientEnabled(settings.ambientSound);
  }, [settings.soundEnabled, settings.ambientSound]);

  // WebSocket Connection with automatic recovery after brief network/server interruptions.
  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;

    const connect = () => {
      if (disposed) return;
      // In the Android Capacitor APK, window.location.host is local (usually localhost).
      // Always connect to the deployed WebSocket backend.
      const ws = new WebSocket('wss://klasiktavla.onrender.com/ws');
      wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts = 0;
      // 1. Init player
      ws.send(
        JSON.stringify({
          type: 'player:init',
          playerId: profile.id,
          playerName: profile.name,
          avatar: profile.avatar,
          playerAvatar: profile.avatar,
        })
      );
      // 2. Join room
      ws.send(
        JSON.stringify({
          type: 'room:join',
          roomId,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'room:joined': {
            setRoom(msg.room);
            setMyColor(msg.myColor);
            setStatusMessage(
              msg.room.status === 'waiting'
                ? 'Rakip oyuncu bekleniyor... (1/2 Kişi)'
                : 'Oyun başladı! İyi şanslar.'
            );
            break;
          }

          case 'room:updated': {
            setRoom(msg.room);
            if (msg.room.status === 'waiting') {
              setStatusMessage('Rakip oyuncu bekleniyor... (1/2 Kişi)');
            } else if (msg.systemMessage) {
              setStatusMessage(msg.systemMessage);
            }
            break;
          }

          case 'game:rolled': {
            setIsRolling(true);
            tavlaAudio.playDiceRoll();
            setTimeout(() => {
              setIsRolling(false);
              tavlaAudio.playDiceDrop();
              setRoom(msg.room);
              if (!msg.hasMoves) {
                clearTurnTimer();
                setStatusMessage('Hamle yok! Sıra diğer oyuncuya geçiyor.');
              } else {
                setStatusMessage(
                  `Zarlar: ${msg.dice.map((d: Die) => d.value).join(' - ')}`
                );
                // Start 15-second turn timer for active player!
                startTurnTimer(msg.room.turn);
              }
            }, 400);
            break;
          }

          case 'game:moved': {
            setRoom(msg.room);
            setSelectedPoint(null);
            setValidDestinations([]);
            setDragState(null);

            // If opponent moved, display animated sliding checker across the board
            if (myColor && msg.room.turn !== myColor && msg.from !== undefined && msg.to !== undefined) {
              const oppColor: PlayerColor = myColor === 'white' ? 'black' : 'white';
              triggerOpponentSlide(msg.from, msg.to, oppColor, !!msg.hit);
            }

            if (msg.hit) {
              tavlaAudio.playCheckerHit();
              setStatusMessage('Taş kırıldı!');
            } else if (msg.to === 'off') {
              tavlaAudio.playBearOff();
              setStatusMessage('Taş toplandı!');
            } else {
              tavlaAudio.playCheckerMove();
            }

            clearAutoPassTimers();
            if (myColor && msg.room.turn === myColor && !msg.room.winnerInfo) {
              const hasRemaining = hasAnyLegalMoves(msg.room.board, myColor, msg.room.dice);
              const allUsed = msg.room.dice.every((d: Die) => d.used);
              if (allUsed || !hasRemaining) {
                clearTurnTimer();
                setAutoPassSecondsLeft(4);
                let rem = 4;
                autoPassIntervalRef.current = setInterval(() => {
                  rem -= 1;
                  if (rem <= 0) {
                    clearAutoPassTimers();
                    handlePassTurn();
                  } else {
                    setAutoPassSecondsLeft(rem);
                  }
                }, 1000);
              }
            } else {
              clearTurnTimer();
            }
            break;
          }

          case 'game:undo_applied': {
            clearAutoPassTimers();
            setRoom(msg.room);
            setSelectedPoint(null);
            setValidDestinations([]);
            setDragState(null);
            tavlaAudio.playButtonClick();
            setStatusMessage('Hamle geri alındı. Zarlarınızı yeniden oynayabilirsiniz.');
            break;
          }

          case 'game:turn_passed': {
            clearTurnTimer();
            clearAutoPassTimers();
            setRoom(msg.room);
            setSelectedPoint(null);
            setValidDestinations([]);
            setDragState(null);
            if (msg.room.status === 'playing' && !msg.room.winnerInfo) {
              startTurnTimer(msg.room.turn);
            }
            break;
          }

          case 'game:reset': {
            clearTurnTimer();
            clearAutoPassTimers();
            setRoom(msg.room);
            setSelectedPoint(null);
            setValidDestinations([]);
            setDragState(null);
            setMatchRecorded(false);
            setAbandonedNotice(null);
            setRematchStatus('idle');
            prizeAwardedRef.current = false;
            setStatusMessage('Yeni el başladı. Zarları atın.');
            break;
          }

          case 'game:rematch_requested': {
            if (msg.requesterId !== profile.id) {
              setRematchStatus('received');
              setRematchRequesterName(msg.requesterName || 'Rakibiniz');
              tavlaAudio.playDiceRoll();
            } else {
              setRematchStatus('sent');
            }
            break;
          }

          case 'room:closed_to_menu': {
            clearTurnTimer();
            clearAutoPassTimers();
            setRematchStatus('idle');
            setStatusMessage(msg.message || 'Masa kapandı. Ana menüye dönülüyor...');
            tavlaAudio.playButtonClick();
            setTimeout(() => {
              onLeaveRoom();
            }, 1200);
            break;
          }

          case 'room:player_abandoned': {
            clearTurnTimer();
            clearAutoPassTimers();
            setRoom(msg.room);
            setAbandonedNotice(
              `${msg.abandonedPlayerName} masadan ayrıldı! Hükmen kazandınız.`
            );
            tavlaAudio.playVictory();
            break;
          }

          case 'error': {
            setStatusMessage(`Hata: ${msg.message}`);
            break;
          }
        }
      } catch {
        // error
      }
    };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        clearTurnTimer();
        clearAutoPassTimers();
        if (disposed) return;

        setStatusMessage('Bağlantı koptu. Yeniden bağlanılıyor...');
        reconnectAttempts += 1;
        const delay = Math.min(1000 * Math.pow(2, Math.min(reconnectAttempts - 1, 3)), 8000);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearTurnTimer();
      clearAutoPassTimers();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [roomId, profile.id, profile.name]);

  // Handle Win/Loss Recording once per game match, Award Prize & Calculate Cups (+10/-5)
  useEffect(() => {
    if (!room || matchRecorded || !myColor) return;

    if (abandonedNotice) {
      onRecordMatch('win');
      if (!room.isFriendMatch) {
        const { profile: updated, trophyDelta } = recordOnlineMatchResult('win', true);
        setTrophyDeltaWon(trophyDelta);
        if (onProfileUpdated) onProfileUpdated(updated);
        if (updated.isFirebaseUser && updated.id) {
          recordOnlineMatchInFirestore(updated.id, 'win', trophyDelta, updated.level).catch((err) =>
            console.warn('Could not record online match in Firestore:', err)
          );
        }
      }
      setMatchRecorded(true);

      if (room.prizePool && !prizeAwardedRef.current) {
        prizeAwardedRef.current = true;
        setPrizeCoinsWon(room.prizePool);
        awardMatchPrize(profile, room.prizePool, room.id, room.name)
          .then((updated) => {
            if (onProfileUpdated) onProfileUpdated(updated);
          })
          .catch((err) => console.warn('Could not award match prize:', err));
      }
      return;
    }

    if (room.winnerInfo) {
      if (room.winnerInfo.winner === myColor) {
        onRecordMatch('win');
        tavlaAudio.playVictory();

        if (!room.isFriendMatch) {
          const { profile: updated, trophyDelta } = recordOnlineMatchResult('win');
          setTrophyDeltaWon(trophyDelta);
          if (onProfileUpdated) onProfileUpdated(updated);
          if (updated.isFirebaseUser && updated.id) {
            recordOnlineMatchInFirestore(updated.id, 'win', trophyDelta, updated.level).catch((err) =>
              console.warn('Could not record online match in Firestore:', err)
            );
          }
        }

        if (room.prizePool && !prizeAwardedRef.current) {
          prizeAwardedRef.current = true;
          setPrizeCoinsWon(room.prizePool);
          awardMatchPrize(profile, room.prizePool, room.id, room.name)
            .then((updated) => {
              if (onProfileUpdated) onProfileUpdated(updated);
            })
            .catch((err) => console.warn('Could not award match prize:', err));
        }
      } else {
        onRecordMatch('loss');
        if (!room.isFriendMatch) {
          const { profile: updated, trophyDelta } = recordOnlineMatchResult('loss');
          setTrophyDeltaWon(trophyDelta);
          if (onProfileUpdated) onProfileUpdated(updated);
          if (updated.isFirebaseUser && updated.id) {
            recordOnlineMatchInFirestore(updated.id, 'loss', trophyDelta, updated.level).catch((err) =>
              console.warn('Could not record online match in Firestore:', err)
            );
          }
        }
      }
      setMatchRecorded(true);
    }
  }, [room, matchRecorded, myColor, abandonedNotice, onRecordMatch, profile, onProfileUpdated]);

  // Dice roll
  const handleRollDice = () => {
    if (!room || !myColor || isRolling || room.status !== 'playing' || room.winnerInfo) return;
    if (room.turn !== myColor) return;
    if (room.dice.length > 0 && room.dice.some((d) => !d.used)) return;

    wsRef.current?.send(
      JSON.stringify({
        type: 'game:roll',
        roomId: room.id,
      })
    );
  };

  // Undo moves made during current turn
  const handleUndo = () => {
    clearAutoPassTimers();
    if (!room || !myColor || isRolling || room.winnerInfo || room.status !== 'playing') return;
    if (room.turn !== myColor) return;
    if (!room.turnSnapshot || !room.dice.some((d) => d.used)) return;

    wsRef.current?.send(
      JSON.stringify({
        type: 'game:undo',
        roomId: room.id,
      })
    );
  };

  // Immediate turn pass when user clicks TAMAM
  const handlePassTurn = () => {
    clearAutoPassTimers();
    if (!room || !myColor || isRolling || room.winnerInfo || room.status !== 'playing') return;
    if (room.turn !== myColor) return;

    wsRef.current?.send(
      JSON.stringify({
        type: 'game:pass',
        roomId: room.id,
      })
    );
  };

  // Helper to find target at coordinates with high sensitivity and proximity snapping
  const findDropTarget = (
    clientX: number,
    clientY: number,
    validList: LegalMoveInfo[]
  ): number | 'off' | null => {
    if (validList.length === 0) return null;

    // 1. Direct hit-testing via elementFromPoint
    const elem = document.elementFromPoint(clientX, clientY);
    const dropTargetElem = elem?.closest('[data-drop-point]');
    if (dropTargetElem) {
      const dropVal = dropTargetElem.getAttribute('data-drop-point');
      if (dropVal === 'off' && validList.some((d) => d.to === 'off')) {
        return 'off';
      }
      if (dropVal && dropVal !== 'off') {
        const pIdx = parseInt(dropVal, 10);
        if (validList.some((d) => d.to === pIdx)) {
          return pIdx;
        }
      }
    }

    // 2. High-sensitivity bounding box proximity fallback
    for (const move of validList) {
      const selector = `[data-drop-point="${move.to}"]`;
      const targetEl = document.querySelector(selector);
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        if (
          clientX >= rect.left - 18 &&
          clientX <= rect.right + 18 &&
          clientY >= rect.top - 32 &&
          clientY <= rect.bottom + 32
        ) {
          return move.to;
        }
      }
    }

    return null;
  };

  // Move piece (supports single die AND 2-dice combined moves!)
  const executeMoveTo = (target: number | 'off') => {
    const from = selectedPoint ?? dragState?.from;
    if (from === null || from === undefined || !room) return;

    const matchedMove = validDestinations.find((m) => m.to === target);
    if (!matchedMove) return;

    wsRef.current?.send(
      JSON.stringify({
        type: 'game:move',
        roomId: room.id,
        from,
        to: target,
        dieValue: matchedMove.dieValue,
        dieIndices: matchedMove.dieIndices,
        intermediates: matchedMove.intermediates || [],
        isCombined: !!matchedMove.isCombined,
      })
    );

    setSelectedPoint(null);
    setValidDestinations([]);
    setDragState(null);
  };

  // HIGH-SENSITIVITY & ULTRA-HIGH FPS DRAG & DROP HANDLERS
  const handlePointerDownOnChecker = (e: React.PointerEvent, from: number | 'bar') => {
    if (!room || !myColor || isRolling || room.status !== 'playing' || room.winnerInfo) return;
    if (room.turn !== myColor) return;
    if (room.dice.length === 0 || room.dice.every((d) => d.used)) return;

    if (room.board.bar[myColor] > 0 && from !== 'bar') {
      setStatusMessage('Kırık taşınız var! Önce kırık taşı oyuna sokmalısınız.');
      return;
    }

    // If another piece was selected: check if 'from' is a valid target to move to, OR switch selection!
    if (selectedPoint !== null && selectedPoint !== from) {
      if (from !== 'bar' && validDestinations.some((d) => d.to === from)) {
        executeMoveTo(from);
        return;
      }
      // Switch selection smoothly to this friendly checker on single click!
      const moves = getLegalMovesForPosition(room.board, from, myColor, room.dice);
      if (moves.length === 0) {
        setStatusMessage('Bu taş ile oynanabilecek geçerli bir hamle yok.');
        return;
      }
      setSelectedPoint(from);
      setValidDestinations(moves);
      justSelectedRef.current = from;
      selectedAtRef.current = { point: from, timestamp: Date.now() };
      tavlaAudio.playButtonClick();
      return;
    }

    const moves = getLegalMovesForPosition(room.board, from, myColor, room.dice);
    if (moves.length === 0) {
      setStatusMessage('Bu taş ile oynanabilecek geçerli bir hamle yok.');
      return;
    }

    if (selectedPoint !== from) {
      setSelectedPoint(from);
      setValidDestinations(moves);
      justSelectedRef.current = from;
      selectedAtRef.current = { point: from, timestamp: Date.now() };
      tavlaAudio.playButtonClick();
    }

    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore if pointer capture unsupported
    }

    pointerCoordsRef.current = { x: e.clientX, y: e.clientY };

    setDragState({
      from,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
      hoveredTarget: null,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;

    pointerCoordsRef.current = { x: e.clientX, y: e.clientY };

    // Direct DOM translation update for 120Hz/60Hz buttery smoothness
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
    }

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    const distance = Math.hypot(dx, dy);

    const hoveredTarget = findDropTarget(e.clientX, e.clientY, validDestinations);

    // Only update React state when dragging status or hovered drop target changes
    if ((!dragState.isDragging && distance > 3) || dragState.hoveredTarget !== hoveredTarget) {
      setDragState((prev) =>
        prev
          ? {
              ...prev,
              currentX: e.clientX,
              currentY: e.clientY,
              isDragging: true,
              hoveredTarget,
            }
          : null
      );
    }
  };

  const handlePointerUp = (e?: React.PointerEvent) => {
    if (!dragState) return;

    const finalX = e ? e.clientX : pointerCoordsRef.current.x;
    const finalY = e ? e.clientY : pointerCoordsRef.current.y;

    if (dragState.isDragging) {
      const dropTarget = dragState.hoveredTarget ?? findDropTarget(finalX, finalY, validDestinations);
      if (dropTarget !== null && validDestinations.some((d) => d.to === dropTarget)) {
        executeMoveTo(dropTarget);
        setDragState(null);
        return;
      }
    }

    setDragState(null);
  };

  const handlePointClick = (pointIndex: number | 'bar') => {
    if (!room || !myColor || isRolling || room.status !== 'playing' || room.winnerInfo) return;
    if (room.turn !== myColor) return;
    if (room.dice.length === 0 || room.dice.every((d) => d.used)) return;

    if (room.board.bar[myColor] > 0 && pointIndex !== 'bar') {
      setStatusMessage('Kırık taşınız var! Önce kırık taşı oyuna sokmalısınız.');
      return;
    }

    const now = Date.now();
    const isDoubleClick =
      lastPointClickTimeRef.current.point === pointIndex &&
      now - lastPointClickTimeRef.current.time < 350;
    lastPointClickTimeRef.current = { point: pointIndex, time: now };

    // Request 6: pullar toplanırken çift tıklanarak toplanabilsin
    if (isDoubleClick && canBearOff(room.board, myColor)) {
      const movesForThisPoint = getLegalMovesForPosition(room.board, pointIndex, myColor, room.dice);
      const bearOffMove = movesForThisPoint.find((m) => m.to === 'off');
      if (bearOffMove) {
        setSelectedPoint(pointIndex);
        executeMoveTo('off');
        return;
      }
    }

    if (pointIndex === 'bar') {
      if (room.board.bar[myColor] <= 0) return;
      if (selectedPoint === 'bar') {
        if (justSelectedRef.current === 'bar') {
          justSelectedRef.current = null;
          return;
        }
        setSelectedPoint(null);
        setValidDestinations([]);
        justSelectedRef.current = null;
        selectedAtRef.current = { point: null, timestamp: 0 };
        tavlaAudio.playButtonClick();
        setStatusMessage('Seçim kaldırıldı.');
        return;
      }
      const moves = getLegalMovesForPosition(room.board, 'bar', myColor, room.dice);
      if (moves.length === 0) {
        setStatusMessage('Kırık taş oyuna sokulamıyor, uygun zar yok.');
        return;
      }
      setSelectedPoint('bar');
      setValidDestinations(moves);
      justSelectedRef.current = 'bar';
      selectedAtRef.current = { point: 'bar', timestamp: Date.now() };
      tavlaAudio.playButtonClick();
      return;
    }

    const pt = room.board.points[pointIndex];
    if (pt.color === myColor && pt.count > 0) {
      if (selectedPoint === pointIndex) {
        if (justSelectedRef.current === pointIndex) {
          justSelectedRef.current = null;
          return;
        }
        setSelectedPoint(null);
        setValidDestinations([]);
        justSelectedRef.current = null;
        selectedAtRef.current = { point: null, timestamp: 0 };
        tavlaAudio.playButtonClick();
        setStatusMessage('Seçim kaldırıldı.');
      } else if (selectedPoint === null) {
        const moves = getLegalMovesForPosition(room.board, pointIndex, myColor, room.dice);
        if (moves.length === 0) {
          setStatusMessage('Bu taş ile oynanabilecek geçerli bir hamle yok.');
          return;
        }
        setSelectedPoint(pointIndex);
        setValidDestinations(moves);
        justSelectedRef.current = pointIndex;
        selectedAtRef.current = { point: pointIndex, timestamp: Date.now() };
        tavlaAudio.playButtonClick();
      } else {
        if (validDestinations.some((d) => d.to === pointIndex)) {
          executeMoveTo(pointIndex);
        } else {
          // Switch selection immediately!
          const moves = getLegalMovesForPosition(room.board, pointIndex, myColor, room.dice);
          if (moves.length === 0) {
            setStatusMessage('Bu taş ile oynanabilecek geçerli bir hamle yok.');
            return;
          }
          setSelectedPoint(pointIndex);
          setValidDestinations(moves);
          justSelectedRef.current = pointIndex;
          selectedAtRef.current = { point: pointIndex, timestamp: Date.now() };
          tavlaAudio.playButtonClick();
        }
      }
    } else if (selectedPoint !== null) {
      executeMoveTo(pointIndex);
    }
  };

  // Leave Room & Abandon logic
  const handleConfirmLeave = () => {
    if (room && room.status === 'playing' && !room.winnerInfo) {
      // Record abandoned for leaving player and deduct 5 cups
      if (!room.isFriendMatch) {
        const { profile: updated, trophyDelta } = recordOnlineMatchResult('abandoned');
        setTrophyDeltaWon(trophyDelta);
        if (onProfileUpdated) onProfileUpdated(updated);
        if (updated.isFirebaseUser && updated.id) {
          recordOnlineMatchInFirestore(updated.id, 'abandoned', trophyDelta, updated.level).catch((err) =>
            console.warn('Could not record online abandon in Firestore:', err)
          );
        }
      }
      onRecordMatch('abandoned');
    }
    wsRef.current?.send(JSON.stringify({ type: 'room:leave', roomId }));
    onLeaveRoom();
  };

  const handleRematch = () => {
    wsRef.current?.send(JSON.stringify({ type: 'game:rematch', roomId }));
  };

  if (!room) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#181310] text-amber-200 text-xs">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-amber-500" />
        <div>{statusMessage}</div>
      </div>
    );
  }

  const pipCounts = calculatePipCounts(room.board);
  const opponentColor: PlayerColor = myColor === 'white' ? 'black' : 'white';
  const opponentPlayer = opponentColor === 'white' ? room.whitePlayer : room.blackPlayer;
  const isMyTurn = room.turn === myColor;

  const isBlackPlayer = myColor === 'black';

  // Perspective inversion:
  // "Oyun başladığında her oyuncu kendi oyun alanını tahtanın alt kısmında görmeli."
  const leftTopPoints = isBlackPlayer ? [12, 11, 10, 9, 8, 7] : [13, 14, 15, 16, 17, 18];
  const leftBottomPoints = isBlackPlayer ? [13, 14, 15, 16, 17, 18] : [12, 11, 10, 9, 8, 7];
  const rightTopPoints = isBlackPlayer ? [6, 5, 4, 3, 2, 1] : [19, 20, 21, 22, 23, 24];
  const rightBottomPoints = isBlackPlayer ? [19, 20, 21, 22, 23, 24] : [6, 5, 4, 3, 2, 1];

  const canSelectedBearOff =
    (selectedPoint !== null || dragState?.from !== undefined) &&
    validDestinations.some((d) => d.to === 'off');

  const renderPointCheckers = (pointIndex: number, isTopRow: boolean) => {
    const pt = room.board.points[pointIndex];
    if (!pt.color || pt.count <= 0) return null;

    const count = pt.count;
    const isSelected = selectedPoint === pointIndex || dragState?.from === pointIndex;
    const isInteractive =
      myColor === pt.color &&
      room.turn === myColor &&
      room.dice.some((d) => !d.used) &&
      (room.board.bar[myColor] === 0 || selectedPoint === 'bar' || dragState?.from === 'bar');

    const maxVisible = Math.min(count, 5);
    const pieceSize = 34;
    const overlapSpacing = count > 5 ? 20 : 26;

    return (
      <div
        className={`absolute inset-x-0 ${
          isTopRow ? 'top-1 flex-col' : 'bottom-1 flex-col-reverse'
        } flex items-center pointer-events-none z-10`}
      >
        {Array.from({ length: maxVisible }).map((_, i) => {
          const isTopChecker = i === maxVisible - 1;
          const showCountBadge = isTopChecker && count > 5 ? count : undefined;
          const isBeingDragged =
            dragState?.isDragging && dragState.from === pointIndex && isTopChecker;

          return (
            <div
              key={i}
              style={{
                marginTop: isTopRow && i > 0 ? `-${pieceSize - overlapSpacing}px` : undefined,
                marginBottom: !isTopRow && i > 0 ? `-${pieceSize - overlapSpacing}px` : undefined,
                opacity: isBeingDragged ? 0.3 : 1,
              }}
              onPointerDown={
                isInteractive
                  ? (e) => {
                      e.stopPropagation();
                      handlePointerDownOnChecker(e, pointIndex);
                    }
                  : undefined
              }
              onClick={(e) => {
                e.stopPropagation();
                handlePointClick(pointIndex);
              }}
              className={`pointer-events-auto ${
                isInteractive ? 'touch-none cursor-grab active:cursor-grabbing' : ''
              }`}
            >
              <CheckerPiece
                color={pt.color!}
                size={pieceSize}
                isSelected={isSelected && isTopChecker}
                isInteractive={isInteractive}
                badgeCount={showCountBadge}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderTriangle = (pointIndex: number, isTopRow: boolean, triangleColorDark: boolean) => {
    const matchingMove = validDestinations.find((d) => d.to === pointIndex);
    const isValidTarget = !!matchingMove;
    const isHoveredTarget = dragState?.hoveredTarget === pointIndex && isValidTarget;

    const pt = room?.board.points[pointIndex];
    const isFriendlyAndInteractive =
      room &&
      myColor &&
      room.turn === myColor &&
      pt &&
      pt.color === myColor &&
      pt.count > 0 &&
      room.dice.some((d) => !d.used) &&
      (room.board.bar[myColor] === 0 || selectedPoint === 'bar' || dragState?.from === 'bar');

    return (
      <div
        key={pointIndex}
        data-drop-point={pointIndex}
        onPointerDown={
          isFriendlyAndInteractive
            ? (e) => handlePointerDownOnChecker(e, pointIndex)
            : undefined
        }
        onClick={() => handlePointClick(pointIndex)}
        className={`relative flex-1 h-full cursor-pointer flex justify-center group overflow-hidden transition-all ${
          isHoveredTarget ? 'bg-emerald-500/35 ring-2 ring-emerald-400/80 ring-inset' : ''
        }`}
      >
        <svg
          viewBox="0 0 100 240"
          preserveAspectRatio="none"
          className="w-full h-full drop-shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] pointer-events-none"
        >
          <defs>
            <linearGradient id={`point-grad-online-${pointIndex}`} x1="0%" y1="0%" x2="100%" y2="100%">
              {triangleColorDark ? (
                <>
                  <stop offset="0%" stopColor="#965223" />
                  <stop offset="60%" stopColor="#7a3e14" />
                  <stop offset="100%" stopColor="#54280a" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#ecc07c" />
                  <stop offset="60%" stopColor="#dca85d" />
                  <stop offset="100%" stopColor="#c38d43" />
                </>
              )}
            </linearGradient>
          </defs>

          {isTopRow ? (
            <polygon
              points="0,0 100,0 50,225"
              fill={`url(#point-grad-online-${pointIndex})`}
              className="stroke-[#47220b]/30 stroke-[1.5]"
            />
          ) : (
            <polygon
              points="0,240 100,240 50,15"
              fill={`url(#point-grad-online-${pointIndex})`}
              className="stroke-[#47220b]/30 stroke-[1.5]"
            />
          )}
        </svg>

        <span
          className={`absolute text-[10px] font-bold text-amber-950/60 pointer-events-none select-none ${
            isTopRow ? 'top-0.5' : 'bottom-0.5'
          }`}
        >
          {pointIndex}
        </span>

        {/* Destination Highlight & Die Indicator */}
        {isValidTarget && matchingMove && (
          <div
            className={`absolute z-30 flex flex-col items-center justify-center pointer-events-auto transition-transform ${
              isTopRow ? 'bottom-4' : 'top-4'
            } ${isHoveredTarget ? 'scale-125' : 'hover:scale-110'}`}
          >
            <div
              className={`min-w-6 h-6 px-1.5 rounded-full border-2 transition-all flex items-center justify-center shadow-lg ${
                matchingMove.isCombined
                  ? isHoveredTarget
                    ? 'bg-amber-400 border-white text-amber-950 font-black shadow-[0_0_18px_rgba(251,191,36,1)] scale-125'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-200 text-white font-extrabold shadow-[0_0_14px_rgba(245,158,11,0.95)] animate-pulse'
                  : isHoveredTarget
                  ? 'bg-emerald-400 border-white text-emerald-950 font-black shadow-[0_0_16px_rgba(52,211,153,1)] scale-125'
                  : 'bg-emerald-600 border-emerald-200 text-white font-bold shadow-[0_0_10px_rgba(16,185,129,0.85)] animate-pulse'
              }`}
            >
              <span className="text-[10px] leading-none font-bold">
                {matchingMove.isCombined ? `+${matchingMove.dieValue}` : matchingMove.dieValue}
              </span>
            </div>
            {matchingMove.isCombined && (
              <span className="mt-0.5 text-[8px] font-black tracking-wider uppercase text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap">
                2 ZAR
              </span>
            )}
          </div>
        )}

        {renderPointCheckers(pointIndex, isTopRow)}
      </div>
    );
  };

  return (
    <div
      ref={boardRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative w-full h-full flex flex-row items-stretch select-none overflow-hidden bg-[#181310] touch-none"
    >
      {/* 1. LEFT PANEL */}
      <div className="w-36 md:w-44 flex flex-col justify-between py-2.5 px-2 bg-[#221711] border-r border-[#3f291b] shadow-2xl z-20 shrink-0">
        {/* Top: Opponent Card */}
        <div
          className={`relative p-2 rounded-2xl border transition-all ${
            room.turn === opponentColor
              ? 'bg-[#3b2416] border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
              : 'bg-[#2b1c13] border-[#442c1e]'
          }`}
        >
          {room.turn === opponentColor && (
            <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-[#2b1c13] animate-ping" />
          )}

          <div className="flex items-center gap-2">
            <AvatarDisplay
              avatar={opponentPlayer?.avatar}
              name={opponentPlayer?.name || 'Rakip'}
              size={36}
              className="border-2 border-amber-600/70 shadow-inner"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-amber-100 truncate tracking-wide">
                {opponentPlayer ? opponentPlayer.name : 'Bekleniyor...'}
              </div>
              <div className="text-[10px] text-amber-400/80 font-semibold flex items-center gap-1">
                <span>{opponentColor === 'white' ? 'Beyaz' : 'Siyah'}</span>
                <span>•</span>
                <span>{opponentColor === 'white' ? room.whiteScore : room.blackScore} Puan</span>
              </div>
            </div>
          </div>

          <div className="mt-1.5 pt-1 border-t border-[#442d1f] flex items-center justify-between text-[11px]">
            {room.turn === opponentColor ? (
              <div
                className={`flex items-center gap-1.5 font-bold px-2 py-0.5 rounded-full border transition-all ${
                  (turnSecondsLeft ?? 15) <= 5
                    ? 'bg-red-950/90 text-red-300 border-red-500/80 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                    : 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{turnSecondsLeft !== null ? `${turnSecondsLeft} sn` : '15 sn'}</span>
              </div>
            ) : (
              <span className="text-amber-200/50 text-[10px] font-medium">Bekliyor</span>
            )}
            <span className={room.turn === opponentColor ? 'text-emerald-400 font-bold text-[10px]' : 'text-amber-200/40 text-[10px]'}>
              {room.turn === opponentColor ? 'Sıra onda' : 'Sıra değil'}
            </span>
          </div>
        </div>

        {/* Center: Match Goal & Controls */}
        <div className="my-auto flex flex-col items-center gap-2 py-1">
          <div className="w-full p-2 rounded-xl bg-[#2e1d13] border border-amber-600/40 text-center shadow space-y-1">
            <div className="text-xs font-black text-amber-100 truncate">
              {room.name}
            </div>

            {room.entryFee ? (
              <div className="flex items-center justify-center gap-1 text-[10px]">
                <span className="text-amber-300 font-semibold">{room.entryFee} Jeton</span>
                <span className="text-amber-400/50">•</span>
                <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                  <Coins className="w-3 h-3 text-amber-400" />
                  {room.prizePool} Ödül
                </span>
              </div>
            ) : (
              <div className="text-[9px] uppercase tracking-wider text-amber-300/70 font-semibold">
                Online Masa ({room.targetScore} Puan)
              </div>
            )}
          </div>

          <div className="w-full flex flex-col gap-1.5 px-1">
            {isMyTurn && (
              <>
                {room.dice.length === 0 && !isRolling && !room.winnerInfo && (
                  <button
                    onClick={handleRollDice}
                    className="w-full py-2 px-2 rounded-xl bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-50 text-xs font-bold shadow-lg border border-amber-400/50 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>ZAR AT</span>
                  </button>
                )}

                {room.turnSnapshot && room.dice.some((d) => d.used) && !room.winnerInfo && (
                  <button
                    onClick={handleUndo}
                    className="w-full py-1.5 px-2 rounded-lg bg-[#3d2719] hover:bg-[#4d3221] text-amber-200 text-[11px] font-semibold border border-amber-700/50 shadow active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 text-amber-300" />
                    <span>GERİ AL</span>
                  </button>
                )}
              </>
            )}

            {/* Quick Action Icons */}
            <div className="flex items-center justify-center gap-2 mt-1">
              {/* Anamenü Butonu */}
              <button
                onClick={() => {
                  if (room.status === 'playing' && !room.winnerInfo) {
                    setShowAbandonConfirm(true);
                  } else {
                    handleConfirmLeave();
                  }
                }}
                title="Anamenüye Dön"
                className="px-2 py-1.5 rounded-lg bg-[#2e1d13] hover:bg-red-950/80 text-amber-300 hover:text-red-300 border border-amber-700/40 shadow cursor-pointer transition-colors flex items-center gap-1 text-[11px] font-bold"
              >
                <Home className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Anamenü</span>
              </button>

              <button
                onClick={onToggleFullscreen}
                title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Yap'}
                className="p-1.5 rounded-lg bg-[#2e1d13] hover:bg-[#3e271a] text-amber-300/80 hover:text-amber-200 border border-amber-700/40 shadow cursor-pointer transition-colors"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onOpenSettings}
                title="Ayarlar & Kurallar"
                className="p-1.5 rounded-lg bg-[#2e1d13] hover:bg-[#3e271a] text-amber-300/80 hover:text-amber-200 border border-amber-700/40 shadow cursor-pointer transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: Player Card */}
        <div
          className={`relative p-2 rounded-2xl border transition-all ${
            isMyTurn
              ? 'bg-[#3b2416] border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
              : 'bg-[#2b1c13] border-[#442c1e]'
          }`}
        >
          {isMyTurn && (
            <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-[#2b1c13] animate-ping" />
          )}

          <div className="flex items-center gap-2">
            <AvatarDisplay
              avatar={profile.avatar}
              name={profile.name}
              size={36}
              className="border-2 border-amber-500/80 shadow-inner"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-amber-100 truncate tracking-wide">
                {profile.name} (Siz)
              </div>
              <div className="text-[10px] text-amber-300/80 flex items-center gap-1 font-semibold">
                <Coins className="w-3 h-3 text-amber-400" />
                <span>{profile.coins?.toLocaleString() ?? '1,000'}</span>
              </div>
            </div>
          </div>

          <div className="mt-1.5 pt-1 border-t border-[#442d1f] flex items-center justify-between text-[11px]">
            {isMyTurn ? (
              <div
                className={`flex items-center gap-1.5 font-bold px-2 py-0.5 rounded-full border transition-all ${
                  (turnSecondsLeft ?? 15) <= 5
                    ? 'bg-red-950/95 text-red-200 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.7)] animate-pulse'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{turnSecondsLeft !== null ? `${turnSecondsLeft} sn` : '15 sn'}</span>
              </div>
            ) : (
              <span className="text-amber-200/50 text-[10px] font-medium">Bekliyor</span>
            )}
            <span className={isMyTurn ? 'text-emerald-400 font-bold text-[10px]' : 'text-amber-200/40 text-[10px]'}>
              {isMyTurn ? 'Sıra Sizde' : 'Sıra değil'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. BOARD */}
      <div className="flex-1 flex flex-col p-1.5 md:p-2 bg-[#1b130e] overflow-hidden">
        {/* Top Status */}
        <div className="h-6 flex items-center justify-between px-3 text-xs text-amber-200/80 mb-1 select-none">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-medium text-amber-100 truncate">{statusMessage}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-amber-400/80">Sıra:</span>
            <div
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                room.turn === 'white'
                  ? 'bg-amber-100 text-amber-950 shadow-sm'
                  : 'bg-stone-900 text-stone-100 border border-stone-700 shadow-sm'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  room.turn === 'white' ? 'bg-amber-800' : 'bg-amber-400'
                }`}
              />
              {room.turn === 'white' ? 'BEYAZ' : 'SİYAH'}
            </div>
          </div>
        </div>

        {/* Master Wooden Table */}
        <div className="flex-1 relative rounded-2xl p-2 bg-gradient-to-b from-[#874b21] via-[#6a3815] to-[#4e270b] border-4 border-[#3b1c06] shadow-[0_15px_35px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.2)] flex flex-row overflow-hidden">
          <div className="flex-1 relative rounded-xl bg-gradient-to-b from-[#dcb274] via-[#cca062] to-[#b88c4e] border-2 border-[#542d11] shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)] flex flex-row overflow-hidden">
            {/* Left Tray */}
            <div className="flex-1 flex flex-col border-r border-[#693917]">
              <div className="flex-1 flex flex-row border-b border-[#5e3213]/40">
                {leftTopPoints.map((pt, i) =>
                  renderTriangle(pt, true, i % 2 === 0)
                )}
              </div>
              <div className="flex-1 flex flex-row">
                {leftBottomPoints.map((pt, i) =>
                  renderTriangle(pt, false, i % 2 === 1)
                )}
              </div>
            </div>

            {/* Middle Bar */}
            <div className="w-11 md:w-14 relative bg-gradient-to-r from-[#593014] via-[#48250d] to-[#593014] border-x-2 border-[#361905] shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_0_10px_rgba(0,0,0,0.5)] flex flex-col justify-between items-center py-2 z-20 shrink-0">
              <div className="w-8 h-4 rounded-sm bg-gradient-to-b from-[#fcd34d] via-[#d97706] to-[#92400e] border border-[#78350f] shadow-md flex items-center justify-around px-1">
                <div className="w-1 h-1 rounded-full bg-[#451a03]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#78350f]" />
                <div className="w-1 h-1 rounded-full bg-[#451a03]" />
              </div>

              <div className="flex-1 flex flex-col justify-between items-center w-full my-2 pt-1 pb-3">
                {/* Top Bar Checker (Opponent) */}
                <div className="flex flex-col items-center gap-1">
                  {(isBlackPlayer ? room.board.bar.white : room.board.bar.black) > 0 && (
                    <div
                      onPointerDown={(e) =>
                        handlePointerDownOnChecker(e, 'bar')
                      }
                      onClick={() => handlePointClick('bar')}
                      className={`cursor-pointer transition-transform hover:scale-105 ${
                        dragState?.isDragging && dragState.from === 'bar' ? 'opacity-30' : ''
                      }`}
                    >
                      <CheckerPiece
                        color={isBlackPlayer ? 'white' : 'black'}
                        size={32}
                        isSelected={
                          selectedPoint === 'bar' &&
                          myColor === (isBlackPlayer ? 'white' : 'black')
                        }
                        badgeCount={
                          isBlackPlayer ? room.board.bar.white : room.board.bar.black
                        }
                        isInteractive={myColor === (isBlackPlayer ? 'white' : 'black')}
                      />
                    </div>
                  )}
                  {(isBlackPlayer ? room.board.bar.white : room.board.bar.black) > 0 && (
                    <span className="text-[9px] font-bold text-amber-200/80">Kırık</span>
                  )}
                </div>

                {/* Bottom Bar Checker (Friendly - Stacked lower down for easy access) */}
                <div className="flex flex-col items-center gap-1 mt-auto">
                  {(isBlackPlayer ? room.board.bar.black : room.board.bar.white) > 0 && (
                    <div
                      onPointerDown={(e) =>
                        handlePointerDownOnChecker(e, 'bar')
                      }
                      onClick={() => handlePointClick('bar')}
                      className={`cursor-pointer transition-transform hover:scale-110 active:scale-95 ${
                        dragState?.isDragging && dragState.from === 'bar' ? 'opacity-30' : ''
                      }`}
                    >
                      <CheckerPiece
                        color={isBlackPlayer ? 'black' : 'white'}
                        size={32}
                        isSelected={
                          selectedPoint === 'bar' &&
                          myColor === (isBlackPlayer ? 'black' : 'white')
                        }
                        badgeCount={
                          isBlackPlayer ? room.board.bar.black : room.board.bar.white
                        }
                        isInteractive={myColor === (isBlackPlayer ? 'black' : 'white')}
                      />
                    </div>
                  )}
                  {(isBlackPlayer ? room.board.bar.black : room.board.bar.white) > 0 && (
                    <span className="text-[9px] font-bold text-amber-200/90 bg-amber-950/80 px-1 rounded border border-amber-600/40">
                      Kırık Taş
                    </span>
                  )}
                </div>
              </div>

              <div className="w-8 h-4 rounded-sm bg-gradient-to-b from-[#fcd34d] via-[#d97706] to-[#92400e] border border-[#78350f] shadow-md flex items-center justify-around px-1">
                <div className="w-1 h-1 rounded-full bg-[#451a03]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#78350f]" />
                <div className="w-1 h-1 rounded-full bg-[#451a03]" />
              </div>
            </div>

            {/* Right Tray */}
            <div className="flex-1 flex flex-col border-l border-[#693917]">
              <div className="flex-1 flex flex-row border-b border-[#5e3213]/40">
                {rightTopPoints.map((pt, i) =>
                  renderTriangle(pt, true, i % 2 === 0)
                )}
              </div>
              <div className="flex-1 flex flex-row">
                {rightBottomPoints.map((pt, i) =>
                  renderTriangle(pt, false, i % 2 === 1)
                )}
              </div>
            </div>

            {/* Floating Live 3D Physics Dice - Positioned in the Right Tray to prevent covering middle bar checkers */}
            <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none flex flex-col items-center justify-center z-30">
              <div className="pointer-events-auto pr-8 flex flex-col items-center">
                {/* 15-Second Turn Countdown Badge on top of the thrown dice */}
                {turnSecondsLeft !== null && isMyTurn && room.dice.length > 0 && room.dice.some((d) => !d.used) && !room.winnerInfo && (
                  <div
                    className={`mb-1 px-3 py-1 rounded-full border shadow-xl font-black text-xs flex items-center gap-1.5 transition-all ${
                      turnSecondsLeft <= 4
                        ? 'bg-red-950/95 text-red-200 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse scale-110'
                        : turnSecondsLeft <= 8
                        ? 'bg-amber-950/90 text-amber-200 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                        : 'bg-black/85 text-emerald-300 border-emerald-500/70 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{turnSecondsLeft}s</span>
                  </div>
                )}
                <DicePhysicsView
                  dice={room.dice}
                  isRolling={isRolling}
                  canRoll={isMyTurn && room.dice.length === 0 && !room.winnerInfo}
                  onRollClick={handleRollDice}
                />
              </div>
            </div>

            {/* Animated Opponent Sliding Checker: Visualizes opponent dragging/moving pieces across board */}
            {opponentSliding && (
              <div
                className="absolute pointer-events-none z-50 transition-all duration-[420ms] ease-out -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${opponentSliding.progress ? opponentSliding.targetX : opponentSliding.startX}%`,
                  top: `${opponentSliding.progress ? opponentSliding.targetY : opponentSliding.startY}%`,
                }}
              >
                <div className="relative flex flex-col items-center">
                  <div className="relative filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)] scale-110 animate-pulse">
                    <CheckerPiece color={opponentSliding.color} size={34} isSelected />
                    {opponentSliding.hit && (
                      <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center animate-ping">
                        💥
                      </div>
                    )}
                  </div>
                  <div className="mt-1 whitespace-nowrap px-2 py-0.5 rounded-full bg-black/90 border border-amber-400 text-[10px] font-black text-amber-200 shadow-xl backdrop-blur-sm">
                    Rakip: {opponentSliding.from === 'bar' ? 'Bar' : opponentSliding.from} ➔ {opponentSliding.to === 'off' ? 'Toplandı' : opponentSliding.to}
                  </div>
                </div>
              </div>
            )}

            {/* Request 1: Geri Al ve Tamam Seçenekleri Tahtanın İçinde Sağ Kısmında */}
            {isMyTurn && !room.winnerInfo && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 pointer-events-auto">
                {/* GERİ AL BUTONU: En az bir zar kullanılmışsa görünür */}
                {room.turnSnapshot && room.dice.some((d) => d.used) && (
                  <button
                    onClick={handleUndo}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-b from-[#4a2e1c] to-[#2e190d] hover:from-[#5a3822] hover:to-[#381f10] text-amber-200 hover:text-amber-100 text-xs font-bold border-2 border-amber-600/70 shadow-[0_4px_14px_rgba(0,0,0,0.8)] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                    <span>GERİ AL</span>
                  </button>
                )}

                {/* TAMAM BUTONU: Tüm zarlar oynanmışsa veya başka hamle kalmamışsa görünür; basıldığında direkt geçer */}
                {((room.dice.length > 0 && room.dice.every((d) => d.used)) ||
                  (room.dice.length > 0 && !hasAnyLegalMoves(room.board, myColor, room.dice))) && (
                  <button
                    onClick={handlePassTurn}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-900 hover:from-emerald-500 hover:to-emerald-800 text-white text-xs font-black border-2 border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.7)] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer animate-pulse"
                  >
                    <Check className="w-4 h-4 text-emerald-100" />
                    <span>TAMAM</span>
                  </button>
                )}

                {/* 4 SANİYELİK GERİ SAYIM: Tuşların hemen altında görünür */}
                {autoPassSecondsLeft !== null && (
                  <div className="w-full text-center py-1 px-2.5 rounded-xl bg-black/85 border border-amber-500/60 text-[11px] font-bold text-amber-200 shadow-[0_4px_12px_rgba(0,0,0,0.85)] flex items-center justify-center gap-1.5 backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <span className="truncate">
                      Geçiş: <strong className="text-emerald-300 font-black text-xs">{autoPassSecondsLeft}s</strong>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bear-off trays (Top = Opponent, Bottom = Friendly) */}
          <div className="w-16 md:w-20 ml-2 rounded-xl bg-gradient-to-b from-[#46230b] via-[#351906] to-[#251003] border-2 border-[#542d11] p-1.5 flex flex-col justify-between items-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.7)] shrink-0">
            {/* Top (Opponent) */}
            <div className="w-full flex-1 flex flex-col items-center justify-start rounded-lg bg-[#221004] border border-[#522c11] p-1 overflow-hidden relative">
              <div className="w-full text-center py-0.5 rounded bg-amber-950/80 border border-amber-800/40 text-[10px] font-bold text-amber-200">
                {isBlackPlayer ? room.board.borneOff.white : room.board.borneOff.black}/15
              </div>
              <div className="flex-1 w-full flex flex-col justify-end items-center gap-0.5 py-1">
                {Array.from({
                  length: Math.min(
                    isBlackPlayer ? room.board.borneOff.white : room.board.borneOff.black,
                    8
                  ),
                }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-10 h-2 rounded border shadow-sm ${
                      isBlackPlayer
                        ? 'bg-gradient-to-r from-amber-100 to-amber-200 border-amber-300'
                        : 'bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 border border-stone-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="my-1.5 px-2 py-0.5 rounded-md bg-[#2b1608] border border-amber-700/40 text-center">
              <div className="text-[9px] text-amber-400 font-bold">FARK</div>
              <div className="text-xs font-black text-amber-100">
                {Math.abs(pipCounts.white - pipCounts.black)}
              </div>
            </div>

            {/* Bottom (Friendly - Player's own bear-off always at bottom!) */}
            <div
              data-drop-point="off"
              onClick={() => {
                if (canSelectedBearOff) {
                  executeMoveTo('off');
                }
              }}
              className={`w-full flex-1 flex flex-col items-center justify-end rounded-lg p-1 overflow-hidden relative transition-all ${
                canSelectedBearOff
                  ? 'bg-emerald-950/70 border-2 border-emerald-400 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.7)] animate-pulse'
                  : 'bg-[#221004] border border-[#522c11]'
              }`}
            >
              {canSelectedBearOff && (
                <div className="absolute top-2 inset-x-1 text-center py-0.5 rounded bg-emerald-700 text-[10px] font-black text-white">
                  TOPLA
                </div>
              )}
              <div className="flex-1 w-full flex flex-col justify-end items-center gap-0.5 py-1">
                {Array.from({
                  length: Math.min(
                    isBlackPlayer ? room.board.borneOff.black : room.board.borneOff.white,
                    8
                  ),
                }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-10 h-2 rounded border shadow-sm ${
                      isBlackPlayer
                        ? 'bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 border border-stone-700'
                        : 'bg-gradient-to-r from-amber-100 via-amber-50 to-amber-200 border border-amber-300'
                    }`}
                  />
                ))}
              </div>
              <div className="w-full text-center py-0.5 rounded bg-amber-950/80 border border-amber-800/40 text-[10px] font-bold text-amber-200">
                {isBlackPlayer ? room.board.borneOff.black : room.board.borneOff.white}/15
              </div>
            </div>
          </div>
        </div>

        {/* Bottom hint and Undo bar */}
        <div className="h-7 flex items-center justify-between px-3 mt-1 text-[11px] text-amber-300/80 select-none bg-[#241710]/60 rounded-lg border border-amber-900/30">
          <div className="flex items-center gap-3">
            <span>{room.status === 'waiting' ? 'Rakip oyuncu bekleniyor...' : 'Taşı sürükleyerek veya hedef haneye dokunarak oynayın.'}</span>
            {isMyTurn && room.turnSnapshot && room.dice.some((d) => d.used) && !room.winnerInfo && (
              <button
                onClick={handleUndo}
                className="px-2.5 py-0.5 rounded-md bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-600 hover:to-amber-800 text-amber-100 text-[11px] font-bold border border-amber-500/60 shadow flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-amber-300" />
                <span>GERİ AL</span>
              </button>
            )}
          </div>
          <div>Masa: <strong>{room.name}</strong></div>
        </div>
      </div>

      {/* Drag Ghost Piece (High-Performance Direct DOM transform) */}
      {dragState?.isDragging && (
        <div
          ref={ghostRef}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            transform: `translate3d(${dragState.currentX}px, ${dragState.currentY}px, 0) translate(-50%, -50%)`,
            willChange: 'transform',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <CheckerPiece
            color={myColor || 'white'}
            size={42}
            isSelected={true}
            className="shadow-2xl scale-110 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
          />
        </div>
      )}

      {/* Abandon Confirm Dialog */}
      {showAbandonConfirm && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#3a1a0c] to-[#241005] border-2 border-red-500/70 p-5 text-center text-amber-100 shadow-2xl">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-amber-100 mb-2">
              Oyun yarım bırakmak istediğinize emin misiniz? (-5 kupa)
            </h3>
            <p className="text-xs text-amber-300/80 mb-4 leading-relaxed">
              Masadan şimdi ayrılırsanız profilinizden <strong className="text-red-400 font-bold">-5 kupa</strong> silinir. Masada kalan rakip oyuncu ise maçı kazanarak <strong className="text-emerald-400 font-bold">+10 kupa</strong> kazanır.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAbandonConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-[#2a1408] hover:bg-[#381c0c] text-amber-300 font-semibold text-xs border border-amber-800/60 cursor-pointer"
              >
                Oyuna Devam Et
              </button>
              <button
                onClick={handleConfirmLeave}
                className="flex-1 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs border border-red-500 cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.5)]"
              >
                Evet, Ayrıl (-5 Kupa)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Game Over Modal */}
      {(room.winnerInfo || abandonedNotice) && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#3a2010] to-[#201006] border-2 border-amber-500/80 p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 flex items-center justify-center text-amber-950 shadow-lg">
              <Trophy className="w-9 h-9" />
            </div>

            <h2 className="text-xl font-black text-amber-100 tracking-wide">
              {abandonedNotice
                ? 'RAKİP AYRILDI!'
                : room.winnerInfo?.winner === myColor
                ? 'TEBRİKLER! KAZANDINIZ!'
                : 'OYUN BİTTİ! RAKİP KAZANDI'}
            </h2>

            <p className="mt-1 text-xs font-semibold text-amber-300">
              {abandonedNotice ||
                (room.winnerInfo?.winType === 'katmerli'
                  ? 'Katmerli Mars (+3 Puan)'
                  : room.winnerInfo?.winType === 'mars'
                  ? 'Mars (+2 Puan)'
                  : 'Normal Galibiyet (+1 Puan)')}
            </p>

            {/* Trophy Won/Lost Banner for Online Matches */}
            {!room.isFriendMatch && (
              <div className={`my-2 p-1.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-black ${
                (abandonedNotice || room.winnerInfo?.winner === myColor)
                  ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'bg-red-950/80 border-red-500/70 text-red-300'
              }`}>
                <Trophy className="w-4 h-4" />
                <span>
                  {(abandonedNotice || room.winnerInfo?.winner === myColor)
                    ? '+10 Kupa Kazandınız!'
                    : '-5 Kupa Kaybettiniz'}
                </span>
              </div>
            )}

            {/* Prize Won Banner */}
            {prizeCoinsWon && (
              <div className="my-2 p-2 rounded-2xl bg-gradient-to-r from-amber-950 via-[#3d200e] to-amber-950 border border-amber-500/70 shadow flex items-center justify-center gap-2 animate-pulse">
                <Coins className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-black text-amber-200">
                  +{prizeCoinsWon} Jeton Kazandınız!
                </span>
              </div>
            )}

            <div className="my-4 p-3 rounded-2xl bg-[#1c0d05] border border-amber-700/40 flex justify-around">
              <div>
                <div className="text-xs text-amber-400/80">SİZ</div>
                <div className="text-xl font-bold text-amber-100">
                  {myColor === 'white' ? room.whiteScore : room.blackScore}
                </div>
              </div>
              <div className="text-amber-600 font-bold flex items-center">VS</div>
              <div>
                <div className="text-xs text-amber-400/80">RAKİP</div>
                <div className="text-xl font-bold text-amber-100">
                  {myColor === 'white' ? room.blackScore : room.whiteScore}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {rematchStatus === 'sent' ? (
                <div className="p-3 rounded-2xl bg-black/70 border border-amber-500/50 flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Yeni el teklifi rakibe iletildi. Yanıt bekleniyor...</span>
                  </div>
                  <button
                    onClick={handleConfirmLeave}
                    className="w-full py-2 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-200 text-xs font-semibold border border-red-700/60 cursor-pointer transition-all"
                  >
                    Vazgeç ve Ana Menüye Dön
                  </button>
                </div>
              ) : rematchStatus === 'received' ? (
                <div className="p-3.5 rounded-2xl bg-gradient-to-b from-[#4a2610] to-[#251206] border-2 border-amber-400 shadow-2xl flex flex-col items-center gap-2.5 animate-in fade-in zoom-in-95 duration-200">
                  <div className="text-xs font-extrabold text-amber-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-bounce" />
                    <span>{rematchRequesterName || 'Rakibiniz'} yeni bir el oynamak istiyor!</span>
                  </div>
                  <p className="text-[11px] text-amber-300/80">Kabul ediyor musunuz?</p>
                  <div className="flex gap-2 w-full mt-1">
                    <button
                      onClick={() => {
                        wsRef.current?.send(
                          JSON.stringify({
                            type: 'game:rematch_response',
                            accept: true,
                            roomId: room.id,
                          })
                        );
                        setRematchStatus('idle');
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md border border-emerald-400 active:scale-95 transition-all cursor-pointer"
                    >
                      Kabul Et
                    </button>
                    <button
                      onClick={() => {
                        wsRef.current?.send(
                          JSON.stringify({
                            type: 'game:rematch_response',
                            accept: false,
                            roomId: room.id,
                          })
                        );
                        setRematchStatus('idle');
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-red-800 hover:bg-red-700 text-white font-bold text-xs shadow-md border border-red-500 active:scale-95 transition-all cursor-pointer"
                    >
                      Reddet / Ana Menü
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setRematchStatus('sent');
                      wsRef.current?.send(
                        JSON.stringify({ type: 'game:rematch_request', roomId: room.id })
                      );
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-amber-950 font-black text-xs tracking-wide shadow-lg border border-amber-300 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>YENİ EL OYNA</span>
                  </button>
                  <button
                    onClick={handleConfirmLeave}
                    className="w-full py-2 rounded-xl bg-[#2e170c] hover:bg-[#3d2012] text-amber-200 text-xs font-bold border border-amber-800/60 transition-all cursor-pointer"
                  >
                    ANA MENÜYE DÖN
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Classic Backgammon Opening Roll Overlay */}
      {room && room.openingRoll && (
        <OpeningRollOverlay
          isOpen={isOpeningRollOpen}
          whitePlayerName={room.whitePlayer?.name || 'Beyaz Oyuncu'}
          blackPlayerName={room.blackPlayer?.name || 'Siyah Oyuncu'}
          whiteAvatar={room.whitePlayer?.avatar}
          blackAvatar={room.blackPlayer?.avatar}
          whiteDie={room.openingRoll.whiteDie}
          blackDie={room.openingRoll.blackDie}
          winner={room.openingRoll.winner}
          ties={room.openingRoll.ties ?? []}
          myColor={myColor ?? undefined}
          onComplete={handleOpeningRollComplete}
        />
      )}
    </div>
  );
};
