import React, { useState, useRef } from 'react';
import { UserProfile } from '../types/game';
import {
  updatePlayerName,
  updatePlayerAvatar,
  updateEquippedFrame,
} from '../utils/profileStorage';
import {
  PROFILE_FRAMES,
  getLevelProgress,
  isFrameUnlocked,
  getProfileFrame,
} from '../utils/frameSettings';
import { AvatarDisplay, PRESET_AVATARS } from './AvatarDisplay';
import {
  X,
  Trophy,
  AlertTriangle,
  ShieldCheck,
  Edit2,
  Check,
  Upload,
  Camera,
  Coins,
  Sparkles,
  LogOut,
  Loader2,
  Fingerprint,
  Lock,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
  onLoginWithGoogle?: () => void;
  onLogout?: () => void;
  isAuthLoading?: boolean;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
  onLoginWithGoogle,
  onLogout,
  isAuthLoading = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const totalMatches = profile.wins + profile.losses + profile.abandoned;
  const winRate = totalMatches > 0 ? Math.round((profile.wins / totalMatches) * 100) : 0;

  const handleSaveName = () => {
    const updated = updatePlayerName(nameInput);
    onProfileUpdated(updated);
    setIsEditing(false);
  };

  const handleSelectPresetAvatar = (avatarId: string) => {
    const updated = updatePlayerAvatar(avatarId);
    onProfileUpdated(updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Lütfen geçerli bir görsel dosyası seçin.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        // Compress/downscale to ensure localStorage limit isn't exceeded
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 120;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            const updated = updatePlayerAvatar(compressed);
            onProfileUpdated(updated);
          }
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  const levelProgress = getLevelProgress(profile.trophies || 0);

  const handleSelectFrame = (frameId: string) => {
    if (!isFrameUnlocked(frameId, profile.trophies || 0)) return;
    const updated = updateEquippedFrame(frameId);
    onProfileUpdated(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="w-full max-w-md max-h-[92vh] flex flex-col rounded-2xl bg-gradient-to-b from-[#2e1a0e] via-[#241309] to-[#1a0c05] border-2 border-amber-600/70 text-amber-100 shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-800/60 bg-[#25140b] shrink-0">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-amber-100">Oyuncu Profili & Başarılar</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-amber-900/60 text-amber-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
          {/* Player Identity Card */}
          <div className="p-3 rounded-xl bg-[#1c0d05] border border-amber-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Avatar with equipped frame and quick photo upload badge */}
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <AvatarDisplay
                    avatar={profile.avatar}
                    name={profile.name}
                    frameId={profile.equippedFrame || 'frame-1'}
                    size={48}
                  />
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      maxLength={16}
                      className="px-2 py-1 rounded bg-[#2e1a0e] border border-amber-500 text-amber-100 text-xs focus:outline-none w-32"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      className="p-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="font-bold text-amber-100 text-sm flex items-center gap-1.5">
                      <span>{profile.name}</span>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-amber-400/80 hover:text-amber-200 p-0.5 cursor-pointer"
                        title="İsmi Değiştir"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[10px] text-amber-400/70">Kazanma Oranı: %{winRate}</div>
                  </div>
                )}
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-amber-400/70 font-semibold">Toplam Maç</span>
                <div className="text-base font-black text-amber-100">{totalMatches}</div>
              </div>
            </div>

            {/* Account Details & Progression: UID, Level, Coins, Trophies */}
            <div className="pt-2 border-t border-amber-950/80 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Jeton */}
                <span className="flex items-center gap-1 font-semibold text-amber-300 bg-[#291408] px-2 py-0.5 rounded-lg border border-amber-800/40">
                  <Coins className="w-3 h-3 text-amber-400" />
                  <span>{profile.coins?.toLocaleString() ?? '500'} Jeton</span>
                </span>
                {/* Kupa Sayısı */}
                <span className="flex items-center gap-1 font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-500/50">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  <span>{(profile.trophies || 0).toLocaleString()} Kupa</span>
                </span>
                {/* Seviye */}
                <span className="flex items-center gap-1 font-bold text-yellow-200 bg-[#291408] px-2 py-0.5 rounded-lg border border-amber-800/40">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Seviye {profile.level ?? 1}</span>
                </span>
              </div>

              {profile.isFirebaseUser ? (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-600/40">
                  <Fingerprint className="w-3 h-3 text-emerald-400" />
                  <span>UID: {profile.id.slice(0, 6)}...{profile.id.slice(-4)}</span>
                </div>
              ) : (
                <span className="text-[10px] text-amber-400/60 italic">Misafir Hesap</span>
              )}
            </div>

            {/* Seviye İlerleme Çubuğu */}
            <div className="pt-1.5 border-t border-amber-950/80">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-amber-300 font-semibold flex items-center gap-1">
                  <span>Seviye {levelProgress.currentLevel}</span>
                  {levelProgress.currentLevel < 100 && (
                    <span className="text-amber-400/60">→ Seviye {levelProgress.nextLevel}</span>
                  )}
                </span>
                <span className="text-amber-400/80 font-mono">
                  {levelProgress.currentLevel >= 100
                    ? 'Maksimum Seviye (100)'
                    : `${(profile.trophies || 0)} / ${levelProgress.trophiesRequiredForNext} Kupa (${levelProgress.remainingTrophies} Kupa Kaldı)`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#120703] rounded-full overflow-hidden border border-amber-900/60">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-500"
                  style={{ width: `${levelProgress.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Google Authentication Actions */}
            {profile.isFirebaseUser ? (
              <div className="pt-1 flex items-center justify-between">
                <span className="text-[10px] text-emerald-300 font-medium">✓ Google Hesabı ile Senkronize</span>
                {onLogout && (
                  <button
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-900/90 text-red-200 text-[10px] font-semibold border border-red-700/50 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Çıkış Yap</span>
                  </button>
                )}
              </div>
            ) : onLoginWithGoogle ? (
              <div className="pt-1">
                <button
                  onClick={onLoginWithGoogle}
                  disabled={isAuthLoading}
                  className="w-full py-1.5 px-3 rounded-xl bg-white hover:bg-stone-100 text-stone-900 font-bold text-xs shadow border border-stone-300 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                >
                  {isAuthLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                      <span>Google ile Bağlanıyor...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.15C3.25 21.31 7.31 24 12 24z" />
                        <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.39l4-3.15z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.61l4 3.15c.95-2.85 3.6-4.96 6.73-4.96z" />
                      </svg>
                      <span>Google ile Giriş Yap ve İlerlemeyi Kaydet</span>
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </div>

          {/* 10 Yuvarlak Çerçeve Seçimi (Seviye 1 - Seviye 100 Ödülleri) */}
          <div className="p-3 rounded-xl bg-[#211108] border border-amber-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wide">
                  Profil Çerçeveleri (10 Seviye Ödülü)
                </span>
              </div>
              <span className="text-[10px] text-amber-400/80 font-medium">
                Aktif: {getProfileFrame(profile.equippedFrame).name}
              </span>
            </div>

            {/* Yatay Akışkan Çerçeve Listesi */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              {PROFILE_FRAMES.map((fr) => {
                const unlocked = isFrameUnlocked(fr.id, profile.trophies || 0);
                const isEquipped = (profile.equippedFrame || 'frame-1') === fr.id;

                return (
                  <div
                    key={fr.id}
                    className={`relative p-2 rounded-xl flex flex-col items-center justify-between transition-all select-none border text-center ${
                      isEquipped
                        ? 'bg-amber-950/70 border-amber-400 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]'
                        : unlocked
                        ? 'bg-[#180d06] hover:bg-[#28150a] border-amber-900/50 hover:border-amber-600/70'
                        : 'bg-[#120703]/80 border-stone-800/60 opacity-65'
                    }`}
                  >
                    {/* Frame Preview with User's Avatar */}
                    <div className="relative my-1">
                      <AvatarDisplay
                        avatar={profile.avatar}
                        name={profile.name}
                        frameId={fr.id}
                        size={38}
                      />
                      {!unlocked && (
                        <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                      )}
                    </div>

                    {/* Frame Name */}
                    <div className="font-bold text-[10px] text-amber-100 truncate w-full mt-0.5">
                      {fr.name}
                    </div>

                    {/* Requirement or Status */}
                    <div className="text-[9px] text-amber-400/80 mb-1.5 font-medium">
                      {fr.minLevel <= 1 ? 'Başlangıç' : `Sev. ${fr.minLevel} (${fr.minTrophies} 🏆)`}
                    </div>

                    {/* Equip / Status Button */}
                    {unlocked ? (
                      <button
                        onClick={() => handleSelectFrame(fr.id)}
                        disabled={isEquipped}
                        className={`w-full py-1 rounded-lg text-[9px] font-black transition-all cursor-pointer ${
                          isEquipped
                            ? 'bg-emerald-700 text-white shadow cursor-default'
                            : 'bg-amber-600 hover:bg-amber-500 text-amber-950 shadow active:scale-95'
                        }`}
                      >
                        {isEquipped ? '✓ SEÇİLİ' : 'KULLAN'}
                      </button>
                    ) : (
                      <span className="w-full py-0.5 rounded bg-stone-900 text-stone-400 text-[8px] font-bold border border-stone-800 flex items-center justify-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> KİLİTLİ
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Avatar Seçimi & Fotoğraf Yükleme */}
          <div className="p-3 rounded-xl bg-[#211108] border border-amber-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wide">
                Profil Fotoğrafı Seç
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 rounded-lg bg-amber-800 hover:bg-amber-700 text-amber-100 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors border border-amber-600/50"
              >
                <Upload className="w-3 h-3" />
                <span>Fotoğraf Yükle</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Hazır Profil Fotoğrafları */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
              {PRESET_AVATARS.map((preset) => {
                const isSelected = profile.avatar === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPresetAvatar(preset.id)}
                    title={preset.name}
                    className={`relative p-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-600/40 ring-2 ring-amber-400 scale-105 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                        : 'bg-[#190d06] hover:bg-[#2b170c] border border-amber-900/40 hover:scale-105'
                    }`}
                  >
                    <AvatarDisplay avatar={preset.id} name={preset.name} size={34} />
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white flex items-center justify-center text-[8px] text-white font-black">
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sadece 3 Başarı İstatistiği (Galibiyet, Mağlubiyet, Yarıda Bırakılan) */}
          <div className="grid grid-cols-3 gap-2">
            {/* 1. Galibiyet */}
            <div className="p-3 rounded-xl bg-gradient-to-b from-[#18311d] to-[#0f2013] border border-emerald-600/50 text-center shadow">
              <div className="w-6 h-6 mx-auto mb-1 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                Galibiyet
              </div>
              <div className="text-xl font-black text-emerald-100 mt-0.5">
                {profile.wins}
              </div>
            </div>

            {/* 2. Mağlubiyet */}
            <div className="p-3 rounded-xl bg-gradient-to-b from-[#311818] to-[#200f0f] border border-red-600/40 text-center shadow">
              <div className="w-6 h-6 mx-auto mb-1 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </div>
              <div className="text-[10px] font-bold text-red-300 uppercase tracking-wider">
                Mağlubiyet
              </div>
              <div className="text-xl font-black text-red-100 mt-0.5">
                {profile.losses}
              </div>
            </div>

            {/* 3. Yarıda Bırakılan */}
            <div className="p-3 rounded-xl bg-gradient-to-b from-[#312518] to-[#20170f] border border-amber-600/40 text-center shadow">
              <div className="w-6 h-6 mx-auto mb-1 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                Yarıda Bırakılan
              </div>
              <div className="text-xl font-black text-amber-100 mt-0.5">
                {profile.abandoned}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-amber-800/60 bg-[#25140b] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 rounded-xl bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-100 font-bold text-xs shadow-md border border-amber-500/50 cursor-pointer"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
