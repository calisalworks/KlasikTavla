/**
 * Klasik Tavla - Jeton ve Ödül Sistemi Yapılandırması
 * Bu dosyadaki değerler daha sonra kolayca değiştirilebilir.
 */

export const COIN_SETTINGS = {
  // Yeni kayıt olan veya misafir kullanıcılar için başlangıç bakiyesi (500 Jeton)
  INITIAL_STARTING_COINS: 500,

  // Her 6 saatte bir alınabilen Ücretsiz Jeton miktarı (100 Jeton)
  FREE_COINS_AMOUNT: 100,
  FREE_COINS_COOLDOWN_MS: 6 * 60 * 60 * 1000, // 6 saat (milisaniye)

  // Legacy fallback
  DAILY_FREE_COINS: 100,

  // Ödüllü reklam tamamlandığında verilen jeton miktarı (100 Jeton)
  REWARDED_AD_COINS: 100,

  // Reklam izlemede günlük sınır yok! (Sınırsız)
  MAX_DAILY_ADS: 999999,

  // Test modu reklam süresi (saniye cinsinden)
  TEST_AD_DURATION_SECONDS: 6,
};

import { RoomTierConfig } from '../types/game';

/**
 * 4 Resmi Online Oda Seviyesi ve Giriş / Ödül Yapılandırması
 * Yeni Başlayanlar: 100 Jeton
 * Acemiler: 500 Jeton
 * Ustalar: 1.000 Jeton
 * Profesyoneller: 2.000 Jeton
 */
export const ONLINE_ROOM_TIERS: RoomTierConfig[] = [
  {
    id: 'beginner',
    name: 'Yeni Başlayanlar',
    entryFee: 100,
    prizePool: 200,
    description: 'Temel seviye tavla oyuncuları için',
    badgeColor: 'from-amber-600 to-amber-800',
  },
  {
    id: 'casual',
    name: 'Acemiler',
    entryFee: 500,
    prizePool: 1000,
    description: 'Kendini geliştiren heyecanlı oyuncular',
    badgeColor: 'from-blue-600 to-blue-800',
  },
  {
    id: 'master',
    name: 'Ustalar',
    entryFee: 1000,
    prizePool: 2000,
    description: 'Tavla ustalarına özel çekişmeli maçlar',
    badgeColor: 'from-emerald-600 to-emerald-800',
  },
  {
    id: 'pro',
    name: 'Profesyoneller',
    entryFee: 2000,
    prizePool: 4000,
    description: 'En yüksek bahisli elit tavla şampiyonası',
    badgeColor: 'from-purple-600 to-purple-800',
  },
];

export interface FriendRoomOption {
  fee: number;
  prize: number;
  label: string;
  tag: string;
}

/**
 * Arkadaşınla Oyna - 5 Resmi Özel Oda Bahis Seviyesi
 * 100, 200, 400, 500, 1.000 jeton
 */
export const FRIEND_ROOM_OPTIONS: FriendRoomOption[] = [
  { fee: 100, prize: 200, label: '100 Jeton', tag: 'Dostluk Maçı' },
  { fee: 200, prize: 400, label: '200 Jeton', tag: 'Klasik Düello' },
  { fee: 400, prize: 800, label: '400 Jeton', tag: 'Büyük İddia' },
  { fee: 500, prize: 1000, label: '500 Jeton', tag: 'Şampiyonluk' },
  { fee: 1000, prize: 2000, label: '1.000 Jeton', tag: 'Büyük Final' },
];

/**
 * Returns current UTC date string in YYYY-MM-DD format for consistent daily resets
 */
export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Calculates remaining time until next UTC midnight reset in hours and minutes
 */
export function getTimeUntilNextReset(): { hours: number; minutes: number } {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const diffMs = tomorrow.getTime() - now.getTime();
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes };
}
