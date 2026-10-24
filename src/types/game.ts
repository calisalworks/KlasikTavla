export type PlayerColor = 'white' | 'black';

export interface Die {
  value: number;
  used: boolean;
  id: string;
}

export interface BoardState {
  points: { [pointIndex: number]: { color: PlayerColor | null; count: number } };
  bar: {
    white: number;
    black: number;
  };
  borneOff: {
    white: number;
    black: number;
  };
}

export interface MoveStep {
  from: number | 'bar';
  to: number | 'off';
  dieValue: number;
  hit: boolean;
}

export interface TurnSnapshot {
  board: BoardState;
  dice: Die[];
  movesMade: MoveStep[];
}

export type GameMode = 'ai' | 'pvp' | 'online';
export type AIDifficulty = 'easy' | 'medium' | 'hard';
export type TargetScore = 1 | 3 | 5;

export interface GameSettings {
  soundEnabled: boolean;
  ambientSound: boolean;
  autoRoll: boolean;
  highlightMoves: boolean;
  aiDifficulty: AIDifficulty;
}

export type RoomTierId = 'beginner' | 'casual' | 'master' | 'pro';

export interface RoomTierConfig {
  id: RoomTierId;
  name: string;
  entryFee: number;
  prizePool: number;
  description: string;
  minLevel?: number;
  badgeColor: string;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  type: 'initial_bonus' | 'daily_reward' | 'ad_reward' | 'match_fee' | 'match_reward' | 'match_refund';
  amount: number;
  balanceAfter: number;
  description: string;
  date: string; // YYYY-MM-DD (UTC)
  createdAt: string; // ISO
}

export interface UserProfile {
  id: string;        // Permanent UID (from Firebase Auth when logged in)
  name: string;      // Display name
  avatar?: string;   // Preset avatar key or photo URL
  equippedFrame?: string; // ID of circular frame (frame-1 to frame-10)
  trophies?: number; // Kupa sayısı (yalnızca online maçlardan kazanılır)
  wins: number;      // Galibiyet
  losses: number;    // Mağlubiyet
  abandoned: number; // Yarıda Bırakılan
  isFirebaseUser?: boolean;
  coins?: number;
  level?: number;
  lastDailyRewardDate?: string; // YYYY-MM-DD (legacy fallback)
  lastFreeCoinsClaimTimestamp?: number; // 6 saatlik sayaç epoch ms
  adRewardsToday?: number;      // İzlenen reklam sayısı
  lastAdRewardDate?: string;    // YYYY-MM-DD
}

export interface RoomPlayer {
  id: string;
  name: string;
  avatar?: string;
  equippedFrame?: string;
  trophies?: number;
  color: PlayerColor;
  connected: boolean;
  coins?: number;
}

export interface OpeningRollInfo {
  whiteDie: number;
  blackDie: number;
  winner: PlayerColor;
  ties?: { white: number; black: number }[];
}

export interface GameRoom {
  id: string;
  name: string;
  targetScore: TargetScore;
  creatorId: string;
  tier?: RoomTierId;
  entryFee?: number;
  prizePool?: number;
  prizeClaimed?: boolean;
  refunded?: boolean;
  isFriendMatch?: boolean;
  inviteCode?: string;
  whitePlayer: RoomPlayer | null;
  blackPlayer: RoomPlayer | null;
  whiteScore: number;
  blackScore: number;
  board: BoardState;
  turn: PlayerColor;
  dice: Die[];
  turnSnapshot?: TurnSnapshot | null;
  openingRoll?: OpeningRollInfo | null;
  winnerInfo: { winner: PlayerColor; winType: 'normal' | 'mars' | 'katmerli'; points: number } | null;
  status: 'waiting' | 'playing' | 'finished';
  lastActivity: number;
  whiteTimeouts?: number;
  blackTimeouts?: number;
}
