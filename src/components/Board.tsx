import React, { useState, useEffect, useRef } from 'react';
import {
  BoardState,
  Die,
  GameSettings,
  PlayerColor,
  TargetScore,
  TurnSnapshot,
  UserProfile,
} from '../types/game';
import {
  applyCombinedMove,
  applyMove,
  calculatePipCounts,
  canBearOff,
  cloneBoard,
  evaluateWin,
  getInitialBoard,
  getLegalMovesForPosition,
  hasAnyLegalMoves,
  LegalMoveInfo,
  rollDice,
} from '../utils/backgammonLogic';
import { findBestMovesForAI, findBestMovesForPlayer } from '../utils/aiPlayer';
import { tavlaAudio } from '../utils/audio';
import { CheckerPiece } from './CheckerPiece';
import { DicePhysicsView } from './DicePhysicsView';
import { AvatarDisplay } from './AvatarDisplay';
import { OpeningRollOverlay } from './OpeningRollOverlay';
import { RotateCcw, Check, Settings, Trophy, Info, RefreshCw, Home, Maximize, AlertTriangle, Bot, Clock } from 'lucide-react';

interface BoardProps {
  profile?: UserProfile;
  settings: GameSettings;
  targetScore: TargetScore;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onReturnToMenu: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  onRecordMatch: (result: 'win' | 'loss' | 'abandoned') => void;
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

export const Board: React.FC<BoardProps> = ({
  profile,
  settings,
  targetScore,
  onOpenSettings,
  onOpenRules,
  onReturnToMenu,
  onToggleFullscreen,
  isFullscreen,
  onRecordMatch,
}) => {
  // Game state
  const [board, setBoard] = useState<BoardState>(getInitialBoard);
  const [turn, setTurn] = useState<PlayerColor>('white');
  const [dice, setDice] = useState<Die[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<number | 'bar' | null>(null);
  const [validDestinations, setValidDestinations] = useState<LegalMoveInfo[]>([]);

  // Drag and drop state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const pointerCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Double click tracker for fast bearing-off
  const lastPointClickTimeRef = useRef<{ point: number | 'bar'; time: number }>({ point: 0, time: 0 });

  // References to guarantee no race conditions or double AI turns
  const boardRefState = useRef<BoardState>(board);
  boardRefState.current = board;
  const diceRef = useRef<Die[]>(dice);
  diceRef.current = dice;
  const isAITurnRef = useRef(false);
  const aiTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const autoPlayTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const pendingAutoPassTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoPassIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [autoPassSecondsLeft, setAutoPassSecondsLeft] = useState<number | null>(null);

  // 15-second active turn timer
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTurnTimer = () => {
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
    }
    autoPlayTimeoutsRef.current.forEach(clearTimeout);
    autoPlayTimeoutsRef.current = [];
    setTurnSecondsLeft(null);
  };

  const handlePlayerTimeout = () => {
    if (winnerInfo || matchWinner) return;

    const currentDice = diceRef.current;
    const unusedDice = currentDice.filter((d) => !d.used);

    if (currentDice.length === 0 || unusedDice.length === 0) {
      // Oyuncu 15 saniye içinde zar atmadı: Zarları otomatik at ve en iyi hamleleri yap
      const rolled = rollDice();
      setDice(rolled);
      diceRef.current = rolled;
      tavlaAudio.playDiceRoll();

      const dropT = setTimeout(() => {
        tavlaAudio.playDiceDrop();
        const currentB = cloneBoard(boardRefState.current);
        const moves = findBestMovesForPlayer(currentB, 'white', rolled, 'medium');

        if (moves.length === 0) {
          setStatusMessage('15 saniyelik süre doldu! Otomatik zar atıldı, oynanacak hamle yok. Sıra rakibe geçti.');
          const passT = setTimeout(() => {
            passTurn();
          }, 1200);
          autoPlayTimeoutsRef.current.push(passT);
        } else {
          let bState = cloneBoard(currentB);
          let dState = rolled.map((d) => ({ ...d }));

          moves.forEach((step, idx) => {
            const stepT = setTimeout(() => {
              const res = applyMove(bState, step.from, step.to, 'white');
              bState = res.newBoard;
              setBoard(cloneBoard(bState));

              const dIdx = dState.findIndex((d) => !d.used && d.value === step.dieValue);
              if (dIdx !== -1) {
                dState[dIdx].used = true;
                setDice([...dState]);
              }

              if (step.hit) {
                tavlaAudio.playCheckerHit();
              } else if (step.to === 'off') {
                tavlaAudio.playBearOff();
              } else {
                tavlaAudio.playCheckerMove();
              }

              if (idx === moves.length - 1) {
                setStatusMessage('15 saniye doldu! Otomatik hamleler oynandı ve sıra devredildi.');
                const finalPassT = setTimeout(() => {
                  passTurn();
                }, 1000);
                autoPlayTimeoutsRef.current.push(finalPassT);
              }
            }, (idx + 1) * 350);
            autoPlayTimeoutsRef.current.push(stepT);
          });
        }
      }, 500);
      autoPlayTimeoutsRef.current.push(dropT);
      return;
    }

    // Zarlar zaten atılmıştı, kalan zarlarla hamle yap
    const currentB = cloneBoard(boardRefState.current);
    const moves = findBestMovesForPlayer(currentB, 'white', currentDice, 'medium');

    if (moves.length === 0) {
      setStatusMessage('15 saniye doldu! Yapılabilecek hamle yok, sıra rakibe geçti.');
      passTurn();
      return;
    }

    let bState = cloneBoard(currentB);
    let dState = currentDice.map((d) => ({ ...d }));

    moves.forEach((step, idx) => {
      const stepT = setTimeout(() => {
        const res = applyMove(bState, step.from, step.to, 'white');
        bState = res.newBoard;
        setBoard(cloneBoard(bState));

        const dIdx = dState.findIndex((d) => !d.used && d.value === step.dieValue);
        if (dIdx !== -1) {
          dState[dIdx].used = true;
          setDice([...dState]);
        }

        if (step.hit) {
          tavlaAudio.playCheckerHit();
        } else if (step.to === 'off') {
          tavlaAudio.playBearOff();
        } else {
          tavlaAudio.playCheckerMove();
        }

        if (idx === moves.length - 1) {
          setStatusMessage('15 saniye doldu! Hamleler otomatik oynandı ve sıra devredildi.');
          const finalPassT = setTimeout(() => {
            passTurn();
          }, 1000);
          autoPlayTimeoutsRef.current.push(finalPassT);
        }
      }, (idx + 1) * 350);
      autoPlayTimeoutsRef.current.push(stepT);
    });
  };

  const startTurnTimer = (activeTurn: PlayerColor) => {
    clearTurnTimer();
    setTurnSecondsLeft(15);
    let rem = 15;
    turnTimerRef.current = setInterval(() => {
      rem -= 1;
      if (rem <= 0) {
        clearTurnTimer();
        if (activeTurn === 'white') {
          handlePlayerTimeout();
        }
      } else {
        setTurnSecondsLeft(rem);
      }
    }, 1000);
  };

  const selectedAtRef = useRef<{ point: number | 'bar' | null; timestamp: number }>({
    point: null,
    timestamp: 0,
  });
  const justSelectedRef = useRef<number | 'bar' | null>(null);

  // Turn history for "GERİ AL" (Undo)
  const [turnSnapshot, setTurnSnapshot] = useState<TurnSnapshot | null>(null);

  // Scores
  const [whiteScore, setWhiteScore] = useState(0);
  const [blackScore, setBlackScore] = useState(0);
  const [winnerInfo, setWinnerInfo] = useState<{
    winner: PlayerColor;
    winType: 'normal' | 'mars' | 'katmerli';
    points: number;
  } | null>(null);
  const [matchWinner, setMatchWinner] = useState<PlayerColor | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasRecordedMatch, setHasRecordedMatch] = useState(false);

  // Status message
  const [statusMessage, setStatusMessage] = useState<string>('Zarları atarak oyuna başlayın');
  const [autoRoll, setAutoRoll] = useState<boolean>(settings.autoRoll);

  // AI turn flag
  const [isAITurn, setIsAITurn] = useState(false);

  // Opening roll to determine who goes first (classic backgammon rule)
  const [openingRoll, setOpeningRoll] = useState<{
    whiteDie: number;
    blackDie: number;
    winner: PlayerColor;
    ties: { white: number; black: number }[];
    isComplete: boolean;
  } | null>(null);

  const startOpeningRoll = () => {
    isAITurnRef.current = false;
    aiTimeoutsRef.current.forEach(clearTimeout);
    aiTimeoutsRef.current = [];
    clearAutoPassTimers();
    clearTurnTimer();
    setDice([]);

    const ties: { white: number; black: number }[] = [];
    let w = 0, b = 0;
    while (w === b) {
      w = Math.floor(Math.random() * 6) + 1;
      b = Math.floor(Math.random() * 6) + 1;
      if (w === b) {
        ties.push({ white: w, black: b });
      }
    }
    const win: PlayerColor = w > b ? 'white' : 'black';
    setOpeningRoll({
      whiteDie: w,
      blackDie: b,
      winner: win,
      ties,
      isComplete: false,
    });
  };

  useEffect(() => {
    startOpeningRoll();
    return () => {
      clearTurnTimer();
      clearAutoPassTimers();
      aiTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const handleOpeningRollComplete = () => {
    if (!openingRoll) return;
    const { whiteDie, blackDie, winner: win } = openingRoll;
    setOpeningRoll((prev) => (prev ? { ...prev, isComplete: true } : null));

    // Tekli zarlar sadece oyuna kimin başlayacağını belirler.
    // Oyuna başlayan taraf sıfırdan YENİ ZARLAR atarak başlar.
    setDice([]);
    setTurnSnapshot(null);
    setTurn(win);

    if (win === 'white') {
      setIsAITurn(false);
      isAITurnRef.current = false;
      setStatusMessage(`Oyuna siz başlıyorsunuz (${whiteDie} > ${blackDie})! Zarlarınızı atın.`);
      tavlaAudio.playDiceDrop();
      startTurnTimer('white');
    } else {
      setIsAITurn(true);
      setStatusMessage(`Yapay Zeka oyuna başlıyor (${blackDie} > ${whiteDie})...`);
      startTurnTimer('black');
    }
  };

  // Sound sync
  useEffect(() => {
    tavlaAudio.setSoundEnabled(settings.soundEnabled);
    tavlaAudio.setAmbientEnabled(settings.ambientSound);
  }, [settings.soundEnabled, settings.ambientSound]);

  // Pip counts
  const pipCounts = calculatePipCounts(board);

  // Check round and match win conditions
  useEffect(() => {
    const win = evaluateWin(board);
    if (win && !winnerInfo) {
      setWinnerInfo(win);
      tavlaAudio.playVictory();

      const newWhiteScore = win.winner === 'white' ? whiteScore + win.points : whiteScore;
      const newBlackScore = win.winner === 'black' ? blackScore + win.points : blackScore;

      setWhiteScore(newWhiteScore);
      setBlackScore(newBlackScore);

      const typeText =
        win.winType === 'katmerli'
          ? 'Katmerli Mars (+3 Puan)!'
          : win.winType === 'mars'
          ? 'Mars (+2 Puan)!'
          : 'Normal Galibiyet (+1 Puan)!';

      // Check if match target score reached
      if (newWhiteScore >= targetScore) {
        setMatchWinner('white');
        setStatusMessage(`TEBRİKLER! ${targetScore} puana ulaşarak maçı kazandınız!`);
        if (!hasRecordedMatch) {
          onRecordMatch('win');
          setHasRecordedMatch(true);
        }
      } else if (newBlackScore >= targetScore) {
        setMatchWinner('black');
        setStatusMessage(`MAÇ BİTTİ! Rakip ${targetScore} puana ulaşarak maçı kazandı.`);
        if (!hasRecordedMatch) {
          onRecordMatch('loss');
          setHasRecordedMatch(true);
        }
      } else {
        setStatusMessage(`${win.winner === 'white' ? 'Siz' : 'Rakip'} eli kazandı: ${typeText}`);
      }
    }
  }, [board, winnerInfo, whiteScore, blackScore, targetScore, hasRecordedMatch, onRecordMatch]);

  // Handle dice rolling
  const handleRollDice = () => {
    if (isRolling || winnerInfo || matchWinner) return;
    if (dice.length > 0 && dice.some((d) => !d.used)) return;

    setIsRolling(true);
    tavlaAudio.playDiceRoll();

    setTimeout(() => {
      const newDice = rollDice();
      setDice(newDice);
      diceRef.current = newDice;
      setIsRolling(false);
      tavlaAudio.playDiceDrop();

      setTurnSnapshot({
        board: cloneBoard(board),
        dice: newDice.map((d) => ({ ...d })),
        movesMade: [],
      });

      const hasMoves = hasAnyLegalMoves(board, turn, newDice);
      if (!hasMoves) {
        clearTurnTimer();
        setStatusMessage('Hamle yok! Sıra rakibe geçiyor.');
        if (pendingAutoPassTimeoutRef.current) {
          clearTimeout(pendingAutoPassTimeoutRef.current);
        }
        pendingAutoPassTimeoutRef.current = setTimeout(() => {
          passTurn();
        }, 1200);
      } else {
        startTurnTimer('white');
        setStatusMessage(
          newDice.length === 4
            ? `Çift zar (${newDice[0].value}-${newDice[0].value})! 4 hamle hakkınız var.`
            : `Zarlar: ${newDice[0].value} - ${newDice[1].value}. Taşı sürükleyin veya dokunun.`
        );
      }
    }, 700);
  };

  const clearAutoPassTimers = () => {
    if (pendingAutoPassTimeoutRef.current) {
      clearTimeout(pendingAutoPassTimeoutRef.current);
      pendingAutoPassTimeoutRef.current = null;
    }
    if (autoPassIntervalRef.current) {
      clearInterval(autoPassIntervalRef.current);
      autoPassIntervalRef.current = null;
    }
    setAutoPassSecondsLeft(null);
  };

  // Switch Turn
  const passTurn = () => {
    clearTurnTimer();
    clearAutoPassTimers();

    setSelectedPoint(null);
    setValidDestinations([]);
    setDragState(null);
    setTurnSnapshot(null);
    setDice([]);
    diceRef.current = [];

    const nextPlayer: PlayerColor = turn === 'white' ? 'black' : 'white';
    setTurn(nextPlayer);

    startTurnTimer(nextPlayer);

    if (nextPlayer === 'black') {
      setIsAITurn(true);
      setStatusMessage('Rakip düşünüyor ve zar atıyor...');
    } else {
      setIsAITurn(false);
      isAITurnRef.current = false;
      setStatusMessage('Sıra Sizde. Zarları atın.');
    }
  };

  // AI Turn Loop (strictly single execution guarded against multiple consecutive runs)
  useEffect(() => {
    if (turn !== 'black' || isAITurnRef.current || winnerInfo || matchWinner) {
      return;
    }

    isAITurnRef.current = true;
    aiTimeoutsRef.current.forEach(clearTimeout);
    aiTimeoutsRef.current = [];

    const rollTimer = setTimeout(() => {
      setIsRolling(true);
      tavlaAudio.playDiceRoll();

      const dropTimer = setTimeout(() => {
        const aiDice = rollDice();
        setDice(aiDice);
        diceRef.current = aiDice;
        setIsRolling(false);
        tavlaAudio.playDiceDrop();

        setStatusMessage(`Rakip zar attı: ${aiDice[0].value} - ${aiDice[1].value}`);

        const currentBoardSnapshot = cloneBoard(boardRefState.current);
        const bestSteps = findBestMovesForAI(currentBoardSnapshot, aiDice, settings.aiDifficulty);

        if (bestSteps.length === 0) {
          setStatusMessage('Rakip hamle yapamadı. Sıra sizde!');
          const noMoveTimer = setTimeout(() => {
            setTurn('white');
            setIsAITurn(false);
            isAITurnRef.current = false;
            setDice([]);
            diceRef.current = [];
            startTurnTimer('white');
            setStatusMessage('Sıra Sizde. Zarları atın.');
          }, 1500);
          aiTimeoutsRef.current.push(noMoveTimer);
          return;
        }

        let currentB = cloneBoard(currentBoardSnapshot);
        let currentD = aiDice.map((d) => ({ ...d }));

        bestSteps.forEach((step, idx) => {
          const stepTimer = setTimeout(() => {
            const res = applyMove(currentB, step.from, step.to, 'black');
            currentB = res.newBoard;
            setBoard(cloneBoard(currentB));

            const dIndex = currentD.findIndex((d) => !d.used && d.value === step.dieValue);
            if (dIndex !== -1) {
              currentD[dIndex].used = true;
              setDice([...currentD]);
              diceRef.current = [...currentD];
            }

            const fromLabel = step.from === 'bar' ? 'Bar' : `${step.from}. hane`;
            const toLabel = step.to === 'off' ? 'Toplama alanı' : `${step.to}. hane`;

            if (step.hit) {
              tavlaAudio.playCheckerHit();
              setStatusMessage(`Yapay Zeka: ${fromLabel}'den ${toLabel}'ye oynadı ve taş kırdı!`);
            } else if (step.to === 'off') {
              tavlaAudio.playBearOff();
              setStatusMessage(`Yapay Zeka: ${fromLabel}'den taş topladı.`);
            } else {
              tavlaAudio.playCheckerMove();
              setStatusMessage(`Yapay Zeka: ${fromLabel}'den ${toLabel}'ye oynadı.`);
            }

            // After final AI move, pass turn to White safely with comfortable pause
            if (idx === bestSteps.length - 1) {
              const finishTimer = setTimeout(() => {
                setTurn('white');
                setIsAITurn(false);
                isAITurnRef.current = false;
                setDice([]);
                diceRef.current = [];
                startTurnTimer('white');
                setStatusMessage('Sıra Sizde. Zarları atın.');
              }, 1100);
              aiTimeoutsRef.current.push(finishTimer);
            }
          }, (idx + 1) * 1100);
          aiTimeoutsRef.current.push(stepTimer);
        });
      }, 700);
      aiTimeoutsRef.current.push(dropTimer);
    }, 800);

    aiTimeoutsRef.current.push(rollTimer);

    return () => {
      aiTimeoutsRef.current.forEach(clearTimeout);
      aiTimeoutsRef.current = [];
    };
  }, [turn, winnerInfo, matchWinner, settings.aiDifficulty]);

  // Auto roll for player
  useEffect(() => {
    if (autoRoll && turn === 'white' && dice.length === 0 && !isRolling && !winnerInfo && !matchWinner) {
      const timer = setTimeout(() => {
        handleRollDice();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoRoll, turn, dice, isRolling, winnerInfo, matchWinner]);

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
        // Generous touch margin (+/- 18px horizontal, +/- 32px vertical)
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

  // Execute selected move (supports single die AND 2-dice combined moves!)
  const executeMoveTo = (target: number | 'off') => {
    const from = selectedPoint ?? dragState?.from;
    if (from === null || from === undefined) return;

    const matchedMove = validDestinations.find((m) => m.to === target);
    if (!matchedMove) return;

    let newBoard: BoardState;
    let hit = false;

    if (matchedMove.isCombined && matchedMove.intermediates && matchedMove.intermediates.length > 0) {
      const res = applyCombinedMove(board, from, target, matchedMove.intermediates, turn);
      newBoard = res.newBoard;
      hit = res.hit;
    } else {
      const res = applyMove(board, from, target, turn);
      newBoard = res.newBoard;
      hit = res.hit;
    }

    setBoard(newBoard);

    if (hit) {
      tavlaAudio.playCheckerHit();
      setStatusMessage(
        matchedMove.isCombined
          ? `Taş kırıldı! 2 zar ile (${matchedMove.dieValue} hane) tek hamlede oynandı.`
          : 'Taş kırıldı! Rakip taş bara gönderildi.'
      );
    } else if (target === 'off') {
      tavlaAudio.playBearOff();
      setStatusMessage(
        matchedMove.isCombined
          ? '2 zar kullanılarak taş toplandı!'
          : 'Taş toplandı!'
      );
    } else {
      tavlaAudio.playCheckerMove();
      if (matchedMove.isCombined) {
        setStatusMessage(`2 zarın toplamı kadar (${matchedMove.dieValue} hane) tek hamlede oynandı.`);
      }
    }

    // Mark ALL consumed dice as used!
    const usedIndices = matchedMove.dieIndices || [matchedMove.dieIndex];
    const updatedDice = dice.map((d, i) =>
      usedIndices.includes(i) ? { ...d, used: true } : d
    );
    setDice(updatedDice);

    setSelectedPoint(null);
    setValidDestinations([]);
    setDragState(null);

    const hasRemainingMoves = hasAnyLegalMoves(newBoard, turn, updatedDice);
    const allDiceUsed = updatedDice.every((d) => d.used);

    // Clear any active auto-pass timeout/interval if player still has undo rights
    clearAutoPassTimers();

    if (allDiceUsed || !hasRemainingMoves) {
      clearTurnTimer();
      if (allDiceUsed) {
        setStatusMessage('Tüm zarlar oynandı. Geçmek için "TAMAM"a basın veya hamleyi geri alın.');
      } else {
        setStatusMessage('Başka hamle yapılamıyor. Geçmek için "TAMAM"a basın veya hamleyi geri alın.');
      }
      // 4 saniyelik süre ve geri sayım
      setAutoPassSecondsLeft(4);
      let remaining = 4;
      autoPassIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearAutoPassTimers();
          passTurn();
        } else {
          setAutoPassSecondsLeft(remaining);
        }
      }, 1000);
    }
  };

  // HIGH-SENSITIVITY & ULTRA-HIGH FPS DRAG & DROP HANDLERS
  const handlePointerDownOnChecker = (e: React.PointerEvent, from: number | 'bar') => {
    if (winnerInfo || matchWinner || isRolling) return;
    if (turn === 'black') return;
    if (dice.length === 0 || dice.every((d) => d.used)) return;

    if (board.bar[turn] > 0 && from !== 'bar') {
      setStatusMessage('Kırık taşınız var! Önce kırık taşı oyuna sokmalısınız.');
      return;
    }

    // If another piece was selected: check if 'from' is a valid target to move to, OR switch selection
    if (selectedPoint !== null && selectedPoint !== from) {
      if (from !== 'bar' && validDestinations.some((d) => d.to === from)) {
        executeMoveTo(from);
        return;
      }
      // Switch selection smoothly to this friendly checker on single click!
      const moves = getLegalMovesForPosition(board, from, turn, dice);
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

    const moves = getLegalMovesForPosition(board, from, turn, dice);
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
    if (winnerInfo || matchWinner || isRolling) return;
    if (turn === 'black') return;
    if (dice.length === 0 || dice.every((d) => d.used)) return;

    if (board.bar[turn] > 0 && pointIndex !== 'bar') {
      setStatusMessage('Kırık taşınız var! Önce kırık taşı oyuna sokmalısınız.');
      return;
    }

    const now = Date.now();
    const isDoubleClick =
      lastPointClickTimeRef.current.point === pointIndex &&
      now - lastPointClickTimeRef.current.time < 350;
    lastPointClickTimeRef.current = { point: pointIndex, time: now };

    // Request 6: Pullar toplanırken çift tıklanarak toplanabilsin
    if (isDoubleClick && canBearOff(board, turn)) {
      const movesForThisPoint = getLegalMovesForPosition(board, pointIndex, turn, dice);
      const bearOffMove = movesForThisPoint.find((m) => m.to === 'off');
      if (bearOffMove) {
        setSelectedPoint(pointIndex);
        executeMoveTo('off');
        return;
      }
    }

    // Clicking on Bar
    if (pointIndex === 'bar') {
      if (board.bar[turn] <= 0) return;
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
      const moves = getLegalMovesForPosition(board, 'bar', turn, dice);
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

    const pt = board.points[pointIndex];
    if (pt.color === turn && pt.count > 0) {
      // Friendly checker tapped:
      if (selectedPoint === pointIndex) {
        // If it was just selected in pointerdown / this click sequence, keep it selected!
        if (justSelectedRef.current === pointIndex) {
          justSelectedRef.current = null;
          return;
        }
        // User intentionally clicked the already selected checker again -> deselect it!
        setSelectedPoint(null);
        setValidDestinations([]);
        justSelectedRef.current = null;
        selectedAtRef.current = { point: null, timestamp: 0 };
        tavlaAudio.playButtonClick();
        setStatusMessage('Seçim kaldırıldı.');
      } else if (selectedPoint === null) {
        // Nothing was selected yet -> select this checker immediately in one click!
        const moves = getLegalMovesForPosition(board, pointIndex, turn, dice);
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
        // Another checker was already selected! Check if this point is a valid destination:
        if (validDestinations.some((d) => d.to === pointIndex)) {
          executeMoveTo(pointIndex);
        } else {
          // Switch selection to this friendly checker immediately!
          const moves = getLegalMovesForPosition(board, pointIndex, turn, dice);
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
      // An empty point or opponent point tapped -> attempt move if legal
      executeMoveTo(pointIndex);
    }
  };

  const handleUndo = () => {
    if (!turnSnapshot || isRolling || winnerInfo || matchWinner) return;

    clearAutoPassTimers();
    startTurnTimer('white');

    setBoard(cloneBoard(turnSnapshot.board));
    setDice(turnSnapshot.dice.map((d) => ({ ...d })));
    diceRef.current = turnSnapshot.dice.map((d) => ({ ...d }));
    setSelectedPoint(null);
    setValidDestinations([]);
    setDragState(null);
    tavlaAudio.playButtonClick();
    setStatusMessage('Hamleler geri alındı. Zarlarınızı yeniden oynayabilirsiniz.');
  };

  const handleNextRound = () => {
    isAITurnRef.current = false;
    aiTimeoutsRef.current.forEach(clearTimeout);
    aiTimeoutsRef.current = [];
    clearTurnTimer();
    clearAutoPassTimers();

    setBoard(getInitialBoard());
    setDice([]);
    diceRef.current = [];
    setSelectedPoint(null);
    setValidDestinations([]);
    setDragState(null);
    setTurnSnapshot(null);
    setWinnerInfo(null);
    setIsAITurn(false);
    tavlaAudio.playButtonClick();
    startOpeningRoll();
  };

  const handleRestartFullMatch = () => {
    isAITurnRef.current = false;
    aiTimeoutsRef.current.forEach(clearTimeout);
    aiTimeoutsRef.current = [];
    clearTurnTimer();
    clearAutoPassTimers();

    setBoard(getInitialBoard());
    setDice([]);
    diceRef.current = [];
    setSelectedPoint(null);
    setValidDestinations([]);
    setDragState(null);
    setTurnSnapshot(null);
    setWinnerInfo(null);
    setMatchWinner(null);
    setWhiteScore(0);
    setBlackScore(0);
    setHasRecordedMatch(false);
    setIsAITurn(false);
    tavlaAudio.playButtonClick();
    startOpeningRoll();
  };

  const handleMenuExit = () => {
    tavlaAudio.playButtonClick();
    if (!matchWinner && !winnerInfo) {
      setShowExitConfirm(true);
    } else {
      onReturnToMenu();
    }
  };

  const handleConfirmAbandonExit = () => {
    isAITurnRef.current = false;
    aiTimeoutsRef.current.forEach(clearTimeout);
    aiTimeoutsRef.current = [];
    clearAutoPassTimers();

    if (!hasRecordedMatch && !matchWinner) {
      onRecordMatch('abandoned');
    }
    onReturnToMenu();
  };

  const activeFrom = selectedPoint ?? dragState?.from;
  const canSelectedBearOff =
    activeFrom !== null && activeFrom !== undefined && validDestinations.some((d) => d.to === 'off');

  const renderPointCheckers = (pointIndex: number, isTopRow: boolean) => {
    const pt = board.points[pointIndex];
    if (!pt.color || pt.count <= 0) return null;

    const count = pt.count;
    const isSelected = selectedPoint === pointIndex || dragState?.from === pointIndex;
    const isInteractive =
      turn === pt.color &&
      dice.some((d) => !d.used) &&
      (board.bar[turn] === 0 || selectedPoint === 'bar' || dragState?.from === 'bar');

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

    const pt = board.points[pointIndex];
    const isFriendlyAndInteractive =
      turn === pt.color &&
      pt.count > 0 &&
      dice.some((d) => !d.used) &&
      (board.bar[turn] === 0 || selectedPoint === 'bar' || dragState?.from === 'bar');

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
            <linearGradient id={`point-grad-${pointIndex}`} x1="0%" y1="0%" x2="100%" y2="100%">
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
              fill={`url(#point-grad-${pointIndex})`}
              className="stroke-[#47220b]/30 stroke-[1.5]"
            />
          ) : (
            <polygon
              points="0,240 100,240 50,15"
              fill={`url(#point-grad-${pointIndex})`}
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
      {/* 1. LEFT SIDE PANEL */}
      <div className="w-36 md:w-44 flex flex-col justify-between py-2.5 px-2 bg-[#221711] border-r border-[#3f291b] shadow-2xl z-20 shrink-0">
        {/* Top: Opponent Card */}
        <div
          className={`relative p-2 rounded-2xl border transition-all ${
            turn === 'black'
              ? 'bg-[#3b2416] border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
              : 'bg-[#2b1c13] border-[#442c1e]'
          }`}
        >
          {turn === 'black' && (
            <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-[#2b1c13] animate-ping" />
          )}

          <div className="flex items-center gap-2">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-amber-600/70 bg-[#160f0a] flex items-center justify-center shadow-inner shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-stone-800 to-stone-600 flex items-center justify-center text-xs font-bold text-amber-200">
                <Bot className="w-4 h-4 text-amber-300" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-amber-100 truncate tracking-wide">
                Yapay Zeka
              </div>
              <div className="text-[11px] text-amber-400/80 font-semibold flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-400" />
                <span>{blackScore} Puan</span>
              </div>
            </div>
          </div>

          <div className="mt-1.5 pt-1 border-t border-[#442d1f] flex items-center justify-between text-[11px]">
            {turn === 'black' ? (
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
            <span className={turn === 'black' ? 'text-emerald-400 font-bold text-[10px]' : 'text-amber-200/40 text-[10px]'}>
              {turn === 'black' ? 'Sıra onda' : 'Sıra değil'}
            </span>
          </div>
        </div>

        {/* Center: Match Goal */}
        <div className="my-auto flex flex-col items-center gap-2 py-1">
          <div className="px-3 py-1 rounded-xl bg-[#2e1d13] border border-amber-600/40 text-center shadow">
            <div className="text-[9px] uppercase tracking-wider text-amber-300/70 font-semibold">Hedef</div>
            <div className="text-sm font-black text-amber-100 flex items-center gap-1 justify-center">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>{targetScore} Puan</span>
            </div>
          </div>

          <div className="w-full flex flex-col gap-1.5 px-1">
            {turn === 'white' && dice.length === 0 && !isRolling && !winnerInfo && (
              <button
                onClick={handleRollDice}
                className="w-full py-2 px-2 rounded-xl bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-50 text-xs font-bold shadow-lg border border-amber-400/50 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>ZAR AT</span>
              </button>
            )}

            <div className="flex items-center justify-center gap-1.5 mt-1">
              <button
                onClick={handleMenuExit}
                title="Ana Menüye Dön"
                className="p-1.5 rounded-lg bg-[#2e1d13] hover:bg-[#3e271a] text-amber-300/80 hover:text-amber-200 border border-amber-700/40 shadow cursor-pointer transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
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
                title="Ayarlar"
                className="p-1.5 rounded-lg bg-[#2e1d13] hover:bg-[#3e271a] text-amber-300/80 hover:text-amber-200 border border-amber-700/40 shadow cursor-pointer transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onOpenRules}
                title="Kurallar"
                className="p-1.5 rounded-lg bg-[#2e1d13] hover:bg-[#3e271a] text-amber-300/80 hover:text-amber-200 border border-amber-700/40 shadow cursor-pointer transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: Player Card */}
        <div
          className={`relative p-2 rounded-2xl border transition-all ${
            turn === 'white'
              ? 'bg-[#3b2416] border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
              : 'bg-[#2b1c13] border-[#442c1e]'
          }`}
        >
          {turn === 'white' && (
            <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-[#2b1c13] animate-ping" />
          )}

          <div className="flex items-center gap-2">
            <AvatarDisplay
              avatar={profile?.avatar}
              name={profile?.name || 'SİZ'}
              size={38}
              className="border-2 border-amber-500/80 shadow-inner"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-amber-100 truncate tracking-wide">
                {profile?.name || 'SİZ'} (Beyaz)
              </div>
              <div className="text-[11px] text-amber-400/80 font-semibold flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-400" />
                <span>{whiteScore} Puan</span>
              </div>
            </div>
          </div>

          <div className="mt-1.5 pt-1 border-t border-[#442d1f] flex items-center justify-between text-[11px]">
            {turn === 'white' ? (
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
            <span className={turn === 'white' ? 'text-emerald-400 font-bold text-[10px]' : 'text-amber-200/40 text-[10px]'}>
              {turn === 'white' ? 'Sıra Sizde' : 'Sıra değil'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. BOARD */}
      <div className="flex-1 flex flex-col p-1.5 md:p-2 bg-[#1b130e] overflow-hidden">
        {/* Subtle Status Bar */}
        <div className="h-6 flex items-center justify-between px-3 text-xs text-amber-200/80 mb-1 select-none">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-medium text-amber-100 truncate">{statusMessage}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-amber-400/80">Sıra:</span>
            <div
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                turn === 'white'
                  ? 'bg-amber-100 text-amber-950 shadow-sm'
                  : 'bg-stone-900 text-stone-100 border border-stone-700 shadow-sm'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  turn === 'white' ? 'bg-amber-800' : 'bg-amber-400'
                }`}
              />
              {turn === 'white' ? 'BEYAZ' : 'SİYAH'}
            </div>
          </div>
        </div>

        {/* Master Board */}
        <div className="flex-1 relative rounded-2xl p-2 bg-gradient-to-b from-[#874b21] via-[#6a3815] to-[#4e270b] border-4 border-[#3b1c06] shadow-[0_15px_35px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.2)] flex flex-row overflow-hidden">
          <div className="flex-1 relative rounded-xl bg-gradient-to-b from-[#dcb274] via-[#cca062] to-[#b88c4e] border-2 border-[#542d11] shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)] flex flex-row overflow-hidden">
            {/* Left Tray */}
            <div className="flex-1 flex flex-col border-r border-[#693917]">
              <div className="flex-1 flex flex-row border-b border-[#5e3213]/40">
                {[13, 14, 15, 16, 17, 18].map((pt, i) =>
                  renderTriangle(pt, true, i % 2 === 0)
                )}
              </div>
              <div className="flex-1 flex flex-row">
                {[12, 11, 10, 9, 8, 7].map((pt, i) =>
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
                {/* Top Bar Checker (Black / AI) */}
                <div className="flex flex-col items-center gap-1">
                  {board.bar.black > 0 && (
                    <div
                      onPointerDown={(e) => handlePointerDownOnChecker(e, 'bar')}
                      onClick={() => handlePointClick('bar')}
                      className={`cursor-pointer transition-transform hover:scale-105 ${
                        dragState?.isDragging && dragState.from === 'bar' ? 'opacity-30' : ''
                      }`}
                    >
                      <CheckerPiece
                        color="black"
                        size={32}
                        isSelected={selectedPoint === 'bar' && turn === 'black'}
                        badgeCount={board.bar.black}
                        isInteractive={turn === 'black'}
                      />
                    </div>
                  )}
                  {board.bar.black > 0 && (
                    <span className="text-[9px] font-bold text-amber-200/80">Kırık</span>
                  )}
                </div>

                {/* Bottom Bar Checker (White / Player - Stacked lower down for easy access) */}
                <div className="flex flex-col items-center gap-1 mt-auto">
                  {board.bar.white > 0 && (
                    <div
                      onPointerDown={(e) => handlePointerDownOnChecker(e, 'bar')}
                      onClick={() => handlePointClick('bar')}
                      className={`cursor-pointer transition-transform hover:scale-110 active:scale-95 ${
                        dragState?.isDragging && dragState.from === 'bar' ? 'opacity-30' : ''
                      }`}
                    >
                      <CheckerPiece
                        color="white"
                        size={32}
                        isSelected={selectedPoint === 'bar' && turn === 'white'}
                        badgeCount={board.bar.white}
                        isInteractive={turn === 'white'}
                      />
                    </div>
                  )}
                  {board.bar.white > 0 && (
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
                {[19, 20, 21, 22, 23, 24].map((pt, i) =>
                  renderTriangle(pt, true, i % 2 === 0)
                )}
              </div>
              <div className="flex-1 flex flex-row">
                {[6, 5, 4, 3, 2, 1].map((pt, i) =>
                  renderTriangle(pt, false, i % 2 === 1)
                )}
              </div>
            </div>

            {/* Floating Live 3D Physics Dice - Positioned in the Right Tray to prevent covering middle bar checkers */}
            <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none flex items-center justify-center z-30">
              <div className="pointer-events-auto pr-8">
                <DicePhysicsView
                  dice={dice}
                  isRolling={isRolling}
                  canRoll={turn === 'white' && dice.length === 0 && !winnerInfo && !matchWinner}
                  onRollClick={handleRollDice}
                />
              </div>
            </div>

            {/* Request 1: Geri Al ve Tamam Seçenekleri Tahtanın İçinde Sağ Kısmında */}
            {turn === 'white' && !winnerInfo && !matchWinner && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 pointer-events-auto">
                {/* GERİ AL BUTONU: En az bir zar kullanılmışsa görünür */}
                {turnSnapshot && dice.some((d) => d.used) && (
                  <button
                    onClick={handleUndo}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-b from-[#4a2e1c] to-[#2e190d] hover:from-[#5a3822] hover:to-[#381f10] text-amber-200 hover:text-amber-100 text-xs font-bold border-2 border-amber-600/70 shadow-[0_4px_14px_rgba(0,0,0,0.8)] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                    <span>GERİ AL</span>
                  </button>
                )}

                {/* TAMAM BUTONU: Tüm zarlar oynanmışsa veya başka hamle kalmamışsa görünür; basıldığında direkt geçer */}
                {((dice.length > 0 && dice.every((d) => d.used)) ||
                  (dice.length > 0 && !hasAnyLegalMoves(board, turn, dice))) && (
                  <button
                    onClick={passTurn}
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

          {/* Bear-off Trays */}
          <div className="w-16 md:w-20 ml-2 rounded-xl bg-gradient-to-b from-[#46230b] via-[#351906] to-[#251003] border-2 border-[#542d11] p-1.5 flex flex-col justify-between items-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.7)] shrink-0">
            {/* Top (Black) */}
            <div className="w-full flex-1 flex flex-col items-center justify-start rounded-lg bg-[#221004] border border-[#522c11] p-1 overflow-hidden relative">
              <div className="w-full text-center py-0.5 rounded bg-amber-950/80 border border-amber-800/40 text-[10px] font-bold text-amber-200">
                {board.borneOff.black}/15
              </div>
              <div className="flex-1 w-full flex flex-col justify-end items-center gap-0.5 py-1">
                {Array.from({ length: Math.min(board.borneOff.black, 8) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-10 h-2 rounded bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 border border-stone-700 shadow-sm"
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

            {/* Bottom (White) */}
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
              } ${dragState?.hoveredTarget === 'off' && canSelectedBearOff ? 'scale-105 bg-emerald-900/90' : ''}`}
            >
              {canSelectedBearOff && (
                <div className="absolute top-2 inset-x-1 text-center py-0.5 rounded bg-emerald-700 text-[10px] font-black text-white">
                  TOPLA
                </div>
              )}
              <div className="flex-1 w-full flex flex-col justify-end items-center gap-0.5 py-1">
                {Array.from({ length: Math.min(board.borneOff.white, 8) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-10 h-2 rounded bg-gradient-to-r from-amber-100 via-amber-50 to-amber-200 border border-amber-300 shadow-sm"
                  />
                ))}
              </div>
              <div className="w-full text-center py-0.5 rounded bg-amber-950/80 border border-amber-800/40 text-[10px] font-bold text-amber-200">
                {board.borneOff.white}/15
              </div>
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="h-7 flex items-center justify-between px-3 mt-1 text-[11px] text-amber-300/80 select-none bg-[#241710]/60 rounded-lg border border-amber-900/30">
          <div className="flex items-center gap-3">
            <span>Taşı sürükleyin veya hedef haneye dokunun</span>
            {turn === 'white' && turnSnapshot && dice.some((d) => d.used) && !winnerInfo && (
              <button
                onClick={handleUndo}
                className="px-2.5 py-0.5 rounded-md bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-600 hover:to-amber-800 text-amber-100 text-[11px] font-bold border border-amber-500/60 shadow flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-amber-300" />
                <span>GERİ AL</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
              OTO ZAR AT
            </span>
            <button
              onClick={() => setAutoRoll(!autoRoll)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer border ${
                autoRoll ? 'bg-amber-600 border-amber-400' : 'bg-stone-800 border-stone-600'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white shadow-md transform transition-transform ${
                  autoRoll ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
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
            color={turn}
            size={42}
            isSelected={true}
            className="shadow-2xl scale-110 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
          />
        </div>
      )}

      {/* Exit / Abandon Confirm */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#3a1a0c] to-[#241005] border-2 border-amber-500/80 p-5 text-center text-amber-100 shadow-2xl">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-amber-100 mb-2">
              Ana menüye dönmek istediğinize emin misiniz?
            </h3>
            <p className="text-xs text-amber-300/80 mb-4 leading-relaxed">
              Devam eden oyununuz sonlandırılacaktır. Çıkmak istediğinize emin misiniz?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-[#2a1408] hover:bg-[#381c0c] text-amber-300 font-semibold text-xs border border-amber-800/60 cursor-pointer"
              >
                Oyuna Devam Et
              </button>
              <button
                onClick={handleConfirmAbandonExit}
                className="flex-1 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs border border-red-500 cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.5)]"
              >
                Evet, Çık
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Round or Match Celebration Modal */}
      {winnerInfo && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#3a2010] to-[#201006] border-2 border-amber-500/80 p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 flex items-center justify-center text-amber-950 shadow-lg">
              <Trophy className="w-9 h-9" />
            </div>

            <h2 className="text-xl font-black text-amber-100 tracking-wide">
              {matchWinner
                ? matchWinner === 'white'
                  ? 'TEBRİKLER! MAÇI KAZANDINIZ!'
                  : 'MAÇ BİTTİ! RAKİP KAZANDI'
                : winnerInfo.winner === 'white'
                ? 'ELİ KAZANDINIZ!'
                : 'RAKİP ELİ KAZANDI'}
            </h2>

            <p className="mt-1 text-xs font-semibold text-amber-300">
              {winnerInfo.winType === 'katmerli'
                ? 'Katmerli Mars (+3 Puan)'
                : winnerInfo.winType === 'mars'
                ? 'Mars (+2 Puan)'
                : 'Normal Galibiyet (+1 Puan)'}
            </p>

            <div className="my-4 p-3 rounded-2xl bg-[#1c0d05] border border-amber-700/40 flex justify-around">
              <div>
                <div className="text-xs text-amber-400/80">SİZ</div>
                <div className="text-xl font-bold text-amber-100">{whiteScore}</div>
              </div>
              <div className="text-amber-600 font-bold flex items-center">
                / {targetScore} Hedef
              </div>
              <div>
                <div className="text-xs text-amber-400/80">RAKİP</div>
                <div className="text-xl font-bold text-amber-100">{blackScore}</div>
              </div>
            </div>

            <div className="space-y-2">
              {!matchWinner ? (
                <button
                  onClick={handleNextRound}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-bold text-xs shadow-lg border border-emerald-400 cursor-pointer active:scale-95 transition-all"
                >
                  SONRAKİ ELE GEÇ →
                </button>
              ) : (
                <button
                  onClick={handleRestartFullMatch}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-amber-950 font-black text-xs shadow-lg border border-amber-300 cursor-pointer active:scale-95 transition-all"
                >
                  YENİ MAÇ BAŞLAT
                </button>
              )}

              <button
                onClick={onReturnToMenu}
                className="w-full py-2 rounded-xl bg-[#2e170c] hover:bg-[#3d2012] text-amber-200 text-xs font-bold border border-amber-800/60 transition-all cursor-pointer"
              >
                ANA MENÜYE DÖN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Classic Opening Roll Overlay */}
      <OpeningRollOverlay
        isOpen={!!openingRoll && !openingRoll.isComplete}
        whitePlayerName={profile?.name || 'SİZ'}
        blackPlayerName="Yapay Zeka"
        whiteAvatar={profile?.avatar}
        whiteDie={openingRoll?.whiteDie ?? 1}
        blackDie={openingRoll?.blackDie ?? 1}
        winner={openingRoll?.winner ?? 'white'}
        ties={openingRoll?.ties ?? []}
        myColor="white"
        onComplete={handleOpeningRollComplete}
      />
    </div>
  );
};
