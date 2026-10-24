import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types/game';
import { AvatarDisplay } from './AvatarDisplay';
import { getProfileFrame } from '../utils/frameSettings';
import {
  Trophy,
  X,
  Medal,
  Crown,
  Sparkles,
  Flame,
  ShieldCheck,
  RefreshCw,
  Search,
} from 'lucide-react';

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  avatar?: string;
  equippedFrame?: string;
  trophies: number;
  level: number;
  wins: number;
  winRate: number;
  isCurrentUser?: boolean;
}

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
}

// Master Tavla Players Seed
const BASE_LEADERBOARD: Omit<LeaderboardEntry, 'rank'>[] = [
  {
    id: 'legend_1',
    name: 'Süleyman Usta',
    avatar: 'avatar-2',
    equippedFrame: 'frame-10',
    trophies: 10420,
    level: 100,
    wins: 980,
    winRate: 84,
  },
  {
    id: 'legend_2',
    name: 'Zar Prensi Kemal',
    avatar: 'avatar-3',
    equippedFrame: 'frame-9',
    trophies: 8750,
    level: 87,
    wins: 820,
    winRate: 79,
  },
  {
    id: 'legend_3',
    name: 'Gözüpek Derya',
    avatar: 'avatar-4',
    equippedFrame: 'frame-8',
    trophies: 7300,
    level: 73,
    wins: 690,
    winRate: 75,
  },
  {
    id: 'legend_4',
    name: 'Mars Canavarı Selim',
    avatar: 'avatar-7',
    equippedFrame: 'frame-7',
    trophies: 6150,
    level: 61,
    wins: 580,
    winRate: 72,
  },
  {
    id: 'legend_5',
    name: 'Sultan Murat',
    avatar: 'avatar-6',
    equippedFrame: 'frame-6',
    trophies: 5200,
    level: 52,
    wins: 490,
    winRate: 70,
  },
  {
    id: 'legend_6',
    name: 'Kapı Ustası Ayşe',
    avatar: 'avatar-1',
    equippedFrame: 'frame-5',
    trophies: 4100,
    level: 41,
    wins: 395,
    winRate: 68,
  },
  {
    id: 'legend_7',
    name: 'Şeşbeş Mehmet',
    avatar: 'avatar-5',
    equippedFrame: 'frame-4',
    trophies: 3050,
    level: 30,
    wins: 290,
    winRate: 64,
  },
  {
    id: 'legend_8',
    name: 'Tavla Kurdu Barış',
    avatar: 'avatar-8',
    equippedFrame: 'frame-3',
    trophies: 2150,
    level: 21,
    wins: 210,
    winRate: 61,
  },
  {
    id: 'legend_9',
    name: 'Çırak Emre',
    avatar: 'avatar-1',
    equippedFrame: 'frame-2',
    trophies: 1200,
    level: 12,
    wins: 115,
    winRate: 58,
  },
];

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    // Calculate current user winRate
    const totalMatches = currentUser.wins + currentUser.losses + currentUser.abandoned;
    const userWinRate = totalMatches > 0 ? Math.round((currentUser.wins / totalMatches) * 100) : 0;

    const userEntry: Omit<LeaderboardEntry, 'rank'> = {
      id: currentUser.id,
      name: currentUser.name,
      avatar: currentUser.avatar,
      equippedFrame: currentUser.equippedFrame || 'frame-1',
      trophies: currentUser.trophies || 0,
      level: currentUser.level || 1,
      wins: currentUser.wins || 0,
      winRate: userWinRate,
      isCurrentUser: true,
    };

    // Try fetching from server or compute dynamically
    fetch('/api/leaderboard')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        let baseList: Omit<LeaderboardEntry, 'rank'>[] = BASE_LEADERBOARD;
        if (data && Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
          baseList = data.leaderboard;
        }

        // Deduplicate user if already in list
        const filtered = baseList.filter((e) => e.id !== currentUser.id);
        filtered.push(userEntry);

        // Sort descending by trophies
        filtered.sort((a, b) => b.trophies - a.trophies);

        // Assign ranks
        const ranked: LeaderboardEntry[] = filtered.map((item, idx) => ({
          ...item,
          rank: idx + 1,
        }));

        setEntries(ranked);
      })
      .catch(() => {
        // Fallback
        const filtered = BASE_LEADERBOARD.filter((e) => e.id !== currentUser.id);
        filtered.push(userEntry);
        filtered.sort((a, b) => b.trophies - a.trophies);
        const ranked: LeaderboardEntry[] = filtered.map((item, idx) => ({
          ...item,
          rank: idx + 1,
        }));
        setEntries(ranked);
      });
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const currentUserRankEntry = entries.find((e) => e.isCurrentUser);

  const filteredEntries = entries.filter((e) =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl bg-gradient-to-b from-[#2e1a0e] via-[#241309] to-[#160b05] border-2 border-amber-600/70 text-amber-100 shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-amber-800/60 bg-[#25140b] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-amber-950 shadow">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-amber-100 tracking-wide flex items-center gap-1.5">
                <span>Kupa Sıralaması</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  Online Lider Tablosu
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-amber-950/80 hover:bg-amber-800 text-amber-300 flex items-center justify-center transition-colors border border-amber-700/50 cursor-pointer"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User's Quick Rank Banner */}
        {currentUserRankEntry && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-amber-950/90 via-[#3a1d0d] to-amber-950/90 border-b border-amber-700/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-amber-600 text-amber-950 font-black text-xs flex items-center justify-center shadow">
                #{currentUserRankEntry.rank}
              </span>
              <AvatarDisplay
                avatar={currentUser.avatar}
                name={currentUser.name}
                frameId={currentUser.equippedFrame || 'frame-1'}
                size={34}
              />
              <div>
                <div className="font-extrabold text-xs text-amber-100 flex items-center gap-1">
                  <span>{currentUser.name}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-600/40">
                    Siz
                  </span>
                </div>
                <div className="text-[10px] text-amber-300/80">
                  Seviye {currentUser.level || 1} • {getProfileFrame(currentUser.equippedFrame).name}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-black text-amber-300 flex items-center gap-1 justify-end">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>{(currentUser.trophies || 0).toLocaleString()} Kupa</span>
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold">
                {currentUser.wins} Galibiyet
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="px-4 py-2 bg-[#1b0d06] border-b border-amber-900/40 flex items-center gap-2 shrink-0">
          <Search className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
          <input
            type="text"
            placeholder="Oyuncu ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs text-amber-100 placeholder-amber-500/50 focus:outline-none"
          />
        </div>

        {/* Leaderboard Table List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs">
          {filteredEntries.map((player) => {
            const isTop1 = player.rank === 1;
            const isTop2 = player.rank === 2;
            const isTop3 = player.rank === 3;
            const isSelf = player.isCurrentUser;

            return (
              <div
                key={player.id}
                className={`p-2.5 rounded-2xl border flex items-center justify-between transition-all ${
                  isSelf
                    ? 'bg-amber-950/80 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)] ring-1 ring-amber-400'
                    : isTop1
                    ? 'bg-gradient-to-r from-[#3d270c] via-[#2d1808] to-[#1c0e05] border-yellow-500/80 shadow'
                    : isTop2
                    ? 'bg-gradient-to-r from-[#29221c] via-[#20150d] to-[#180e06] border-slate-400/60 shadow'
                    : isTop3
                    ? 'bg-gradient-to-r from-[#2c1c14] via-[#1f110a] to-[#160a04] border-amber-700/60 shadow'
                    : 'bg-[#1a0e07]/90 border-amber-900/40 hover:bg-[#26140b]'
                }`}
              >
                {/* Left: Rank Badge + Avatar + Name + Frame */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Rank Badge */}
                  <div className="w-7 h-7 shrink-0 flex items-center justify-center font-black text-xs">
                    {isTop1 ? (
                      <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-yellow-300 to-amber-600 text-yellow-950 flex items-center justify-center shadow-md font-black">
                        🥇
                      </span>
                    ) : isTop2 ? (
                      <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 flex items-center justify-center shadow-md font-black">
                        🥈
                      </span>
                    ) : isTop3 ? (
                      <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 flex items-center justify-center shadow-md font-black">
                        🥉
                      </span>
                    ) : (
                      <span className="text-amber-400/80 font-bold text-xs">#{player.rank}</span>
                    )}
                  </div>

                  {/* Avatar with Equipped Frame */}
                  <AvatarDisplay
                    avatar={player.avatar}
                    name={player.name}
                    frameId={player.equippedFrame || 'frame-1'}
                    size={38}
                  />

                  {/* Player Name and Level */}
                  <div className="min-w-0 flex flex-col">
                    <div className="font-bold text-amber-100 text-xs sm:text-sm truncate flex items-center gap-1.5">
                      <span>{player.name}</span>
                      {isSelf && (
                        <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-500 text-amber-950">
                          SİZ
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-amber-400/70 flex items-center gap-1.5">
                      <span className="font-semibold text-amber-300">Seviye {player.level}</span>
                      <span>•</span>
                      <span className="truncate max-w-[110px]">
                        {getProfileFrame(player.equippedFrame).name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Trophy count & Win rate */}
                <div className="text-right shrink-0 pl-2">
                  <div className="font-black text-amber-300 text-xs sm:text-sm flex items-center gap-1 justify-end">
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{player.trophies.toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-semibold">
                    %{player.winRate} G • {player.wins} Galibiyet
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-amber-800/60 bg-[#25140b] flex items-center justify-between shrink-0">
          <span className="text-[10px] text-amber-400/70">
            * Kupalar yalnızca Online maçlarda kazanılır (Galibiyet: +10, Mağlubiyet: -5)
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-100 font-bold text-xs shadow border border-amber-500/50 cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
