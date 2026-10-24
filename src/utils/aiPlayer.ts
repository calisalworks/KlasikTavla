import { BoardState, Die, MoveStep, PlayerColor } from '../types/game';
import { applyMove, canBearOff, cloneBoard, getLegalMovesForPosition } from './backgammonLogic';

interface MoveSequence {
  steps: {
    from: number | 'bar';
    to: number | 'off';
    dieValue: number;
    dieIndex: number;
    hit: boolean;
  }[];
  finalBoard: BoardState;
  score: number;
}

/**
 * Heuristic evaluation function for a board state from playerColor's perspective
 */
function evaluateBoard(
  board: BoardState,
  playerColor: PlayerColor,
  difficulty: 'easy' | 'medium' | 'hard'
): number {
  const opponentColor: PlayerColor = playerColor === 'white' ? 'black' : 'white';
  let score = 0;

  // 1. Borne off checkers (huge bonus)
  score += board.borneOff[playerColor] * 150;
  score -= board.borneOff[opponentColor] * 150;

  // 2. Bar checkers
  score -= board.bar[playerColor] * 120;
  score += board.bar[opponentColor] * 120;

  // 3. Home board strength & Gates (kapı alma)
  for (let i = 1; i <= 24; i++) {
    const pt = board.points[i];
    if (pt.color === playerColor) {
      if (pt.count >= 2) {
        // Gate made!
        score += 25;
        // Home board gates
        const isHomeGate = playerColor === 'white' ? i >= 1 && i <= 6 : i >= 19 && i <= 24;
        if (isHomeGate) {
          score += 40;
        }
        // Prime bonus (consecutive gates)
        const nextPt = playerColor === 'white' ? i - 1 : i + 1;
        if (nextPt >= 1 && nextPt <= 24 && board.points[nextPt].color === playerColor && board.points[nextPt].count >= 2) {
          score += 35;
        }
      } else if (pt.count === 1) {
        // Exposed blot
        score -= 30;
      }

      // Checkers advancing towards home board
      const progress = playerColor === 'white' ? (25 - i) / 24 : i / 24;
      score += progress * 20;
    } else if (pt.color === opponentColor && pt.count === 1) {
      score += 15;
    }
  }

  // Slight randomness based on difficulty
  if (difficulty === 'easy') {
    score += (Math.random() - 0.5) * 80;
  } else if (difficulty === 'medium') {
    score += (Math.random() - 0.5) * 20;
  }

  return score;
}

/**
 * Finds all valid full-turn move sequences for a given player color (White or Black)
 */
export function findBestMovesForPlayer(
  initialBoard: BoardState,
  playerColor: PlayerColor,
  initialDice: Die[],
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): { from: number | 'bar'; to: number | 'off'; dieValue: number; dieIndex: number; hit: boolean }[] {
  const sequences: MoveSequence[] = [];

  function search(currentBoard: BoardState, currentDice: Die[], currentSteps: MoveSequence['steps']) {
    const unusedDice = currentDice
      .map((d, index) => ({ die: d, index }))
      .filter((d) => !d.die.used);

    if (unusedDice.length === 0) {
      sequences.push({
        steps: [...currentSteps],
        finalBoard: currentBoard,
        score: evaluateBoard(currentBoard, playerColor, difficulty),
      });
      return;
    }

    let anyMoveMade = false;

    // Check bar first
    if (currentBoard.bar[playerColor] > 0) {
      const moves = getLegalMovesForPosition(currentBoard, 'bar', playerColor, currentDice).filter((m) => !m.isCombined);
      for (const m of moves) {
        anyMoveMade = true;
        const { newBoard, hit } = applyMove(currentBoard, 'bar', m.to, playerColor);
        const nextDice = currentDice.map((d, i) => (i === m.dieIndex ? { ...d, used: true } : d));
        search(newBoard, nextDice, [
          ...currentSteps,
          { from: 'bar', to: m.to, dieValue: m.dieValue, dieIndex: m.dieIndex, hit },
        ]);
      }
    } else {
      // Check all 24 points
      for (let i = 1; i <= 24; i++) {
        if (currentBoard.points[i].color === playerColor && currentBoard.points[i].count > 0) {
          const moves = getLegalMovesForPosition(currentBoard, i, playerColor, currentDice).filter((m) => !m.isCombined);
          for (const m of moves) {
            anyMoveMade = true;
            const { newBoard, hit } = applyMove(currentBoard, i, m.to, playerColor);
            const nextDice = currentDice.map((d, idx) => (idx === m.dieIndex ? { ...d, used: true } : d));
            search(newBoard, nextDice, [
              ...currentSteps,
              { from: i, to: m.to, dieValue: m.dieValue, dieIndex: m.dieIndex, hit },
            ]);
          }
        }
      }
    }

    if (!anyMoveMade) {
      sequences.push({
        steps: [...currentSteps],
        finalBoard: currentBoard,
        score: evaluateBoard(currentBoard, playerColor, difficulty),
      });
    }
  }

  search(initialBoard, initialDice, []);

  if (sequences.length === 0) return [];

  // Sort sequences: prefer using more dice first, then highest heuristic score
  sequences.sort((a, b) => {
    if (b.steps.length !== a.steps.length) {
      return b.steps.length - a.steps.length;
    }
    return b.score - a.score;
  });

  return sequences[0]?.steps || [];
}

/**
 * Finds all valid full-turn move sequences for the AI (Black)
 */
export function findBestMovesForAI(
  initialBoard: BoardState,
  initialDice: Die[],
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): { from: number | 'bar'; to: number | 'off'; dieValue: number; dieIndex: number; hit: boolean }[] {
  return findBestMovesForPlayer(initialBoard, 'black', initialDice, difficulty);
}
