import { BoardState, Die, PlayerColor } from '../types/game';

export interface LegalMoveInfo {
  to: number | 'off';
  dieValue: number;
  dieIndex: number;
  dieIndices: number[];
  hit: boolean;
  isCombined?: boolean;
  intermediates?: (number | 'off')[];
}

/**
 * Creates the initial classic backgammon board state (15 checkers each)
 */
export function getInitialBoard(): BoardState {
  const points: BoardState['points'] = {};
  for (let i = 1; i <= 24; i++) {
    points[i] = { color: null, count: 0 };
  }

  // Classic Backgammon Starting Setup:
  // White:
  // 2 on 24
  // 5 on 13
  // 3 on 8
  // 5 on 6
  points[24] = { color: 'white', count: 2 };
  points[13] = { color: 'white', count: 5 };
  points[8] = { color: 'white', count: 3 };
  points[6] = { color: 'white', count: 5 };

  // Black:
  // 2 on 1
  // 5 on 12
  // 3 on 17
  // 5 on 19
  points[1] = { color: 'black', count: 2 };
  points[12] = { color: 'black', count: 5 };
  points[17] = { color: 'black', count: 3 };
  points[19] = { color: 'black', count: 5 };

  return {
    points,
    bar: { white: 0, black: 0 },
    borneOff: { white: 0, black: 0 },
  };
}

/**
 * Deep clone board state
 */
export function cloneBoard(board: BoardState): BoardState {
  const newPoints: BoardState['points'] = {};
  for (let i = 1; i <= 24; i++) {
    newPoints[i] = { ...board.points[i] };
  }
  return {
    points: newPoints,
    bar: { ...board.bar },
    borneOff: { ...board.borneOff },
  };
}

/**
 * Generates dice roll (two dice, or 4 if doubles)
 */
export function rollDice(): Die[] {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;

  if (d1 === d2) {
    return [
      { value: d1, used: false, id: `d-1-${Date.now()}` },
      { value: d1, used: false, id: `d-2-${Date.now()}` },
      { value: d1, used: false, id: `d-3-${Date.now()}` },
      { value: d1, used: false, id: `d-4-${Date.now()}` },
    ];
  }

  return [
    { value: d1, used: false, id: `d-1-${Date.now()}` },
    { value: d2, used: false, id: `d-2-${Date.now()}` },
  ];
}

/**
 * Checks if a player has all remaining checkers in their home board
 */
export function canBearOff(board: BoardState, player: PlayerColor): boolean {
  if (board.bar[player] > 0) return false;

  if (player === 'white') {
    // White moves down towards 1..6. Any checkers in 7..24 means cannot bear off.
    for (let i = 7; i <= 24; i++) {
      if (board.points[i].color === 'white' && board.points[i].count > 0) {
        return false;
      }
    }
    return true;
  } else {
    // Black moves up towards 19..24. Any checkers in 1..18 means cannot bear off.
    for (let i = 1; i <= 18; i++) {
      if (board.points[i].color === 'black' && board.points[i].count > 0) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Finds highest occupied point in home board (for bear-off overflow rule)
 */
function getHighestOccupiedHomePoint(board: BoardState, player: PlayerColor): number {
  if (player === 'white') {
    for (let p = 6; p >= 1; p--) {
      if (board.points[p].color === 'white' && board.points[p].count > 0) {
        return p;
      }
    }
    return 0;
  } else {
    for (let p = 19; p <= 24; p++) {
      if (board.points[p].color === 'black' && board.points[p].count > 0) {
        return p;
      }
    }
    return 0;
  }
}

/**
 * Tries a single step on a board state. Returns new destination, hit status, and intermediate board if legal.
 */
function trySingleStep(
  board: BoardState,
  from: number | 'bar',
  player: PlayerColor,
  val: number
): { to: number | 'off'; hit: boolean; nextBoard: BoardState } | null {
  const opponent: PlayerColor = player === 'white' ? 'black' : 'white';

  if (from === 'bar') {
    let targetPoint: number;
    if (player === 'white') {
      targetPoint = 25 - val;
    } else {
      targetPoint = val;
    }

    const target = board.points[targetPoint];
    if (target.color === opponent && target.count >= 2) {
      return null;
    }

    const hit = target.color === opponent && target.count === 1;
    const { newBoard } = applyMove(board, 'bar', targetPoint, player);
    return { to: targetPoint, hit, nextBoard: newBoard };
  }

  // From normal point
  const pt = board.points[from];
  if (pt.color !== player || pt.count <= 0) return null;

  if (player === 'white') {
    const dest = from - val;
    if (dest > 0) {
      const target = board.points[dest];
      if (target.color === opponent && target.count >= 2) {
        return null;
      }
      const hit = target.color === opponent && target.count === 1;
      const { newBoard } = applyMove(board, from, dest, player);
      return { to: dest, hit, nextBoard: newBoard };
    } else if (dest === 0) {
      if (canBearOff(board, 'white')) {
        const { newBoard } = applyMove(board, from, 'off', player);
        return { to: 'off', hit: false, nextBoard: newBoard };
      }
      return null;
    } else {
      // dest < 0: Over-roll bear off
      if (canBearOff(board, 'white')) {
        const highest = getHighestOccupiedHomePoint(board, 'white');
        if (from === highest) {
          const { newBoard } = applyMove(board, from, 'off', player);
          return { to: 'off', hit: false, nextBoard: newBoard };
        }
      }
      return null;
    }
  } else {
    // Black player
    const dest = from + val;
    if (dest <= 24) {
      const target = board.points[dest];
      if (target.color === opponent && target.count >= 2) {
        return null;
      }
      const hit = target.color === opponent && target.count === 1;
      const { newBoard } = applyMove(board, from, dest, player);
      return { to: dest, hit, nextBoard: newBoard };
    } else if (dest === 25) {
      if (canBearOff(board, 'black')) {
        const { newBoard } = applyMove(board, from, 'off', player);
        return { to: 'off', hit: false, nextBoard: newBoard };
      }
      return null;
    } else {
      if (canBearOff(board, 'black')) {
        const furthest = getHighestOccupiedHomePoint(board, 'black');
        if (from === furthest) {
          const { newBoard } = applyMove(board, from, 'off', player);
          return { to: 'off', hit: false, nextBoard: newBoard };
        }
      }
      return null;
    }
  }
}

/**
 * Gets legal destinations for a checker at a given position ('bar' or 1..24) using available dice.
 * Supports BOTH single die moves AND combined 2-dice moves (sum of 2 dice in a single action)!
 */
export function getLegalMovesForPosition(
  board: BoardState,
  from: number | 'bar',
  player: PlayerColor,
  availableDice: Die[]
): LegalMoveInfo[] {
  const unusedDice = availableDice
    .map((d, index) => ({ die: d, index }))
    .filter((item) => !item.die.used);

  if (unusedDice.length === 0) return [];

  // If player has checkers on the bar, ONLY bar can move!
  if (board.bar[player] > 0 && from !== 'bar') {
    return [];
  }

  const results: LegalMoveInfo[] = [];
  const visitedKeys = new Set<string>();

  // 1. Single Die Moves
  for (const item1 of unusedDice) {
    const step1 = trySingleStep(board, from, player, item1.die.value);
    if (!step1) continue;

    const key = `single-${step1.to}-${item1.die.value}`;
    if (!visitedKeys.has(key)) {
      visitedKeys.add(key);
      results.push({
        to: step1.to,
        dieValue: item1.die.value,
        dieIndex: item1.index,
        dieIndices: [item1.index],
        hit: step1.hit,
        isCombined: false,
      });
    }

    // 2. Combined 2-Dice Moves (2 zarın toplamı kadar tek hamlede oynama!)
    if (step1.to !== 'off') {
      for (const item2 of unusedDice) {
        if (item2.index === item1.index) continue; // Must be a different die!

        const step2 = trySingleStep(step1.nextBoard, step1.to, player, item2.die.value);
        if (!step2) continue;

        const sumVal = item1.die.value + item2.die.value;
        const targetKey = `comb-${step2.to}-${sumVal}`;

        // If this destination with this sum value already exists, check if new path hits a blot
        const existingIdx = results.findIndex(
          (r) => r.isCombined && r.to === step2.to && r.dieValue === sumVal
        );

        if (existingIdx !== -1) {
          if (!results[existingIdx].hit && (step1.hit || step2.hit)) {
            results[existingIdx].hit = true;
            results[existingIdx].intermediates = [step1.to];
          }
        } else if (!visitedKeys.has(targetKey)) {
          visitedKeys.add(targetKey);
          results.push({
            to: step2.to,
            dieValue: sumVal,
            dieIndex: item1.index,
            dieIndices: [item1.index, item2.index],
            hit: step1.hit || step2.hit,
            isCombined: true,
            intermediates: [step1.to],
          });
        }
      }
    }
  }

  // 3. For doubles with 3 or 4 unused dice, also support 3x or 4x dice if legal
  if (unusedDice.length >= 3 && unusedDice.every((d) => d.die.value === unusedDice[0].die.value)) {
    const val = unusedDice[0].die.value;
    const step1 = trySingleStep(board, from, player, val);
    if (step1 && step1.to !== 'off') {
      const step2 = trySingleStep(step1.nextBoard, step1.to, player, val);
      if (step2 && step2.to !== 'off') {
        const step3 = trySingleStep(step2.nextBoard, step2.to, player, val);
        if (step3) {
          const key3 = `comb-${step3.to}-3x`;
          if (!visitedKeys.has(key3)) {
            visitedKeys.add(key3);
            results.push({
              to: step3.to,
              dieValue: val * 3,
              dieIndex: unusedDice[0].index,
              dieIndices: [unusedDice[0].index, unusedDice[1].index, unusedDice[2].index],
              hit: step1.hit || step2.hit || step3.hit,
              isCombined: true,
              intermediates: [step1.to, step2.to],
            });
          }

          if (unusedDice.length >= 4 && step3.to !== 'off') {
            const step4 = trySingleStep(step3.nextBoard, step3.to, player, val);
            if (step4) {
              const key4 = `comb-${step4.to}-4x`;
              if (!visitedKeys.has(key4)) {
                visitedKeys.add(key4);
                results.push({
                  to: step4.to,
                  dieValue: val * 4,
                  dieIndex: unusedDice[0].index,
                  dieIndices: unusedDice.map((u) => u.index),
                  hit: step1.hit || step2.hit || step3.hit || step4.hit,
                  isCombined: true,
                  intermediates: [step1.to, step2.to, step3.to],
                });
              }
            }
          }
        }
      }
    }
  }

  // 4. Backgammon Rule: If a sequence exists where both dice can be played,
  // do NOT allow a single-die move that blocks the second die!
  return filterMovesForMaximumDiceUsage(board, from, player, availableDice, results);
}

/**
 * Ensures that if it is possible to play 2 dice (or more), the player is not allowed
 * to make a single die move that leaves 0 legal moves for the remaining die.
 * Also, if only ONE of two distinct dice can be played, the larger die MUST be played.
 */
function filterMovesForMaximumDiceUsage(
  board: BoardState,
  from: number | 'bar',
  player: PlayerColor,
  availableDice: Die[],
  moves: LegalMoveInfo[]
): LegalMoveInfo[] {
  const unusedDice = availableDice
    .map((d, index) => ({ die: d, index }))
    .filter((item) => !item.die.used);

  // If 0 or 1 die left, no restriction
  if (unusedDice.length <= 1) return moves;

  // Check if ANY 2-step sequence exists anywhere on the board
  let anyTwoDicePossible = false;
  const uniquePositions: (number | 'bar')[] = [];
  if (board.bar[player] > 0) {
    uniquePositions.push('bar');
  } else {
    for (let p = 1; p <= 24; p++) {
      if (board.points[p].color === player && board.points[p].count > 0) {
        uniquePositions.push(p);
      }
    }
  }

  // Find if anywhere on the board, a 1st move can be followed by a 2nd move
  for (const pos of uniquePositions) {
    for (const item1 of unusedDice) {
      const step1 = trySingleStep(board, pos, player, item1.die.value);
      if (!step1) continue;

      const remainingDice = unusedDice.filter((d) => d.index !== item1.index);
      // Can any checker move on step1.nextBoard with any remaining die?
      let canMoveSecond = false;
      if (step1.nextBoard.bar[player] > 0) {
        for (const item2 of remainingDice) {
          if (trySingleStep(step1.nextBoard, 'bar', player, item2.die.value)) {
            canMoveSecond = true;
            break;
          }
        }
      } else {
        for (let p2 = 1; p2 <= 24; p2++) {
          if (step1.nextBoard.points[p2].color === player && step1.nextBoard.points[p2].count > 0) {
            for (const item2 of remainingDice) {
              if (trySingleStep(step1.nextBoard, p2, player, item2.die.value)) {
                canMoveSecond = true;
                break;
              }
            }
            if (canMoveSecond) break;
          }
        }
      }

      if (canMoveSecond) {
        anyTwoDicePossible = true;
        break;
      }
    }
    if (anyTwoDicePossible) break;
  }

  if (anyTwoDicePossible) {
    // A 2-die sequence IS possible somewhere on the board!
    // Filter out any single-die move that would leave NO remaining legal moves!
    return moves.filter((m) => {
      // Combined moves already use 2 dice! Always valid!
      if (m.isCombined) return true;

      // Single move: check if after this move, at least 1 move is still possible with remaining dice
      const step = trySingleStep(board, from, player, m.dieValue);
      if (!step) return false;

      const remainingDice = unusedDice.filter((d) => d.index !== m.dieIndex);
      if (step.nextBoard.bar[player] > 0) {
        return remainingDice.some((d) => trySingleStep(step.nextBoard, 'bar', player, d.die.value));
      }

      for (let p = 1; p <= 24; p++) {
        if (step.nextBoard.points[p].color === player && step.nextBoard.points[p].count > 0) {
          if (remainingDice.some((d) => trySingleStep(step.nextBoard, p, player, d.die.value))) {
            return true;
          }
        }
      }
      return false;
    });
  }

  // If 2 dice cannot be played anywhere, check if only one of two distinct dice can be played.
  // Backgammon rule: When only one die can be played, player must play the larger die if possible!
  if (unusedDice.length === 2 && unusedDice[0].die.value !== unusedDice[1].die.value) {
    const higherVal = Math.max(unusedDice[0].die.value, unusedDice[1].die.value);
    const lowerVal = Math.min(unusedDice[0].die.value, unusedDice[1].die.value);

    // Can higher die be played anywhere?
    let higherPossibleAnywhere = false;
    for (const pos of uniquePositions) {
      if (trySingleStep(board, pos, player, higherVal)) {
        higherPossibleAnywhere = true;
        break;
      }
    }

    if (higherPossibleAnywhere) {
      // Must filter out moves using the lower die
      const filtered = moves.filter((m) => m.dieValue !== lowerVal);
      if (filtered.length > 0) return filtered;
    }
  }

  return moves;
}

/**
 * Checks if a player has ANY valid moves left with current board and dice
 */
export function hasAnyLegalMoves(board: BoardState, player: PlayerColor, dice: Die[]): boolean {
  if (dice.every((d) => d.used)) return false;

  // Check bar first
  if (board.bar[player] > 0) {
    const barMoves = getLegalMovesForPosition(board, 'bar', player, dice);
    return barMoves.length > 0;
  }

  // Check all 24 points
  for (let i = 1; i <= 24; i++) {
    if (board.points[i].color === player && board.points[i].count > 0) {
      const moves = getLegalMovesForPosition(board, i, player, dice);
      if (moves.length > 0) return true;
    }
  }

  return false;
}

/**
 * Executes a move on the board state, returning new board state and info
 */
export function applyMove(
  board: BoardState,
  from: number | 'bar',
  to: number | 'off',
  player: PlayerColor
): { newBoard: BoardState; hit: boolean } {
  const newBoard = cloneBoard(board);
  const opponent: PlayerColor = player === 'white' ? 'black' : 'white';
  let hit = false;

  // Remove from source
  if (from === 'bar') {
    newBoard.bar[player] = Math.max(0, newBoard.bar[player] - 1);
  } else {
    const src = newBoard.points[from];
    src.count -= 1;
    if (src.count <= 0) {
      src.color = null;
      src.count = 0;
    }
  }

  // Add to destination
  if (to === 'off') {
    newBoard.borneOff[player] += 1;
  } else {
    const dest = newBoard.points[to];
    if (dest.color === opponent && dest.count === 1) {
      // Hit opponent checker!
      dest.color = player;
      dest.count = 1;
      newBoard.bar[opponent] += 1;
      hit = true;
    } else {
      dest.color = player;
      dest.count += 1;
    }
  }

  return { newBoard, hit };
}

/**
 * Applies a combined move traversing intermediate points
 */
export function applyCombinedMove(
  board: BoardState,
  from: number | 'bar',
  to: number | 'off',
  intermediates: (number | 'off')[],
  player: PlayerColor
): { newBoard: BoardState; hit: boolean } {
  let curBoard = board;
  let totalHit = false;
  let curFrom: number | 'bar' = from;

  for (const nextStep of [...intermediates, to]) {
    const res = applyMove(curBoard, curFrom, nextStep, player);
    curBoard = res.newBoard;
    if (res.hit) totalHit = true;
    if (nextStep !== 'off') {
      curFrom = nextStep;
    }
  }

  return { newBoard: curBoard, hit: totalHit };
}

/**
 * Calculates pip count for both players
 */
export function calculatePipCounts(board: BoardState): { white: number; black: number } {
  let whitePip = board.bar.white * 25;
  let blackPip = board.bar.black * 25;

  for (let i = 1; i <= 24; i++) {
    const pt = board.points[i];
    if (pt.color === 'white') {
      whitePip += pt.count * i;
    } else if (pt.color === 'black') {
      blackPip += pt.count * (25 - i);
    }
  }

  return { white: whitePip, black: blackPip };
}

/**
 * Checks winner and win type ('normal', 'mars' / gammon, 'katmerli' / backgammon)
 */
export function evaluateWin(
  board: BoardState
): { winner: PlayerColor; winType: 'normal' | 'mars' | 'katmerli'; points: number } | null {
  if (board.borneOff.white === 15) {
    // Geleneksel Tavla: Karşı taraf hiç pul toplayamamışsa (borneOff = 0) MARS (2 puan)
    if (board.borneOff.black === 0) {
      return { winner: 'white', winType: 'mars', points: 2 };
    }
    return { winner: 'white', winType: 'normal', points: 1 };
  }

  if (board.borneOff.black === 15) {
    // Geleneksel Tavla: Karşı taraf hiç pul toplayamamışsa (borneOff = 0) MARS (2 puan)
    if (board.borneOff.white === 0) {
      return { winner: 'black', winType: 'mars', points: 2 };
    }
    return { winner: 'black', winType: 'normal', points: 1 };
  }

  return null;
}
