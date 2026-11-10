import React, { useRef, useState } from 'react';
import { UserProfile } from '../types/game';
import { updatePlayerName, updatePlayerAvatar } from '../utils/profileStorage';
import { getLevelProgress } from '../utils/frameSettings';
import { AvatarDisplay, PRESET_AVATARS } from './AvatarDisplay';
import {
  X,
  Trophy,
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
  AlertTriangle,
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
  const levelProgress = getLevelProgress(profile.trophies || 0);

  const handleSaveName = () => {
    const updated = updatePlayerName(nameInput.trim());
    onProfileUpdated(updated);
    setIsEditing(false);
  };

  const handleSelectPresetAvatar = (avatarId: string) => {
    onProfileUpdated(updatePlayerAvatar(avatarId));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Lütfen geçerli bir görsel dosyası seçin.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const maxDim = 160;
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * ratio));
        const height = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(img, 0, 0, width, height);
        onProfileUpdated(updatePlayerAvatar(canvas.toDataURL('image/jpeg', 0.84)));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-1.5 sm:p-3 select-none">
      <div className="w-[98vw] max-w-6xl h-[94dvh] max-h-[94dvh] flex flex-col rounded-2xl bg-gradient-to-b from-[#2e1a0e] via-[#241309] to-[#1a0c05] border-2 border-amber-600/70 text-amber-100 shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-amber-800/60 bg-[#25140b] shrink-0">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-amber-100">Oyuncu Profili & Başarılar</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-amber-900/60 text-amber-300 cursor-pointer" aria-label="Profili kapat">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-2 gap-3 p-2.5 sm:p-3 text-xs overflow-hidden">
          {/* Sol taraf: profil fotoğrafı ve ayarlar */}
          <section className="min-w-0 min-h-0 flex flex-col gap-2 overflow-hidden">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#1c0d05] border border-amber-900/50 shrink-0">
              <div className="relative shrink-0 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <AvatarDisplay avatar={profile.avatar} name={profile.name} size={64} className="border border-amber-600/60" />
                <div className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-amber-400/70 font-semibold mb-1">Profil Bilgileri</div>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input type="text" value={nameInput} onChange={(event) => setNameInput(event.target.value)} maxLength={16} className="min-w-0 flex-1 px-2 py-1.5 rounded bg-[#2e1a0e] border border-amber-500 text-amber-100 text-xs focus:outline-none" autoFocus />
                    <button onClick={handleSaveName} className="p-1.5 rounded bg-emerald-700 text-white cursor-pointer" aria-label="İsmi kaydet"><Check className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="truncate font-bold text-amber-100 text-sm">{profile.name}</span>
                    <button onClick={() => { setNameInput(profile.name); setIsEditing(true); }} className="shrink-0 text-amber-400 hover:text-amber-200 p-1 cursor-pointer" title="İsmi Değiştir"><Edit2 className="w-3 h-3" /></button>
                  </div>
                )}
                <div className="text-[10px] text-amber-300/70 mt-1">Fotoğrafı değiştirmek için üzerine dokunun.</div>
                <button onClick={() => fileInputRef.current?.click()} className="mt-1.5 px-2.5 py-1 rounded-lg bg-amber-800 hover:bg-amber-700 text-amber-100 text-[10px] font-semibold flex items-center gap-1 border border-amber-600/50 cursor-pointer">
                  <Upload className="w-3 h-3" /> Fotoğraf Yükle
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </div>
            </div>

            <div className="flex-1 min-h-0 p-2.5 rounded-xl bg-[#211108] border border-amber-900/50 overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wide">Profil Fotoğrafı Seç</span>
                <span className="text-[9px] text-amber-400/60">Hazır fotoğraflar</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AVATARS.map((preset) => {
                  const selected = profile.avatar === preset.id;
                  return (
                    <button key={preset.id} onClick={() => handleSelectPresetAvatar(preset.id)} title={preset.name} aria-pressed={selected} className={selected ? "relative min-h-0 p-1.5 rounded-xl flex flex-col items-center justify-center gap-1 bg-amber-600/40 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)] cursor-pointer" : "relative min-h-0 p-1.5 rounded-xl flex flex-col items-center justify-center gap-1 bg-[#190d06] border border-amber-900/40 hover:bg-[#2b170c] cursor-pointer"}>
                      <AvatarDisplay avatar={preset.id} name={preset.name} size={34} />
                      <span className="text-[9px] text-amber-200/80 truncate max-w-full">{preset.name}</span>
                      {selected && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white flex items-center justify-center text-[8px] text-white font-black">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Sağ taraf: oyun istatistikleri ve hesap bilgileri */}
          <section className="min-w-0 min-h-0 flex flex-col gap-2 overflow-hidden">
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <div className="p-2.5 rounded-xl bg-[#1c0d05] border border-amber-900/50 text-center">
                <div className="text-[9px] uppercase tracking-wider text-amber-400/70 font-semibold">Toplam Maç</div>
                <div className="text-xl font-black text-amber-100 tabular-nums">{totalMatches}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#1c0d05] border border-amber-900/50 text-center">
                <div className="text-[9px] uppercase tracking-wider text-amber-400/70 font-semibold">Kazanma Oranı</div>
                <div className="text-xl font-black text-emerald-300 tabular-nums">%{winRate}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 shrink-0">
              <div className="p-2.5 rounded-xl bg-gradient-to-b from-[#18311d] to-[#0f2013] border border-emerald-600/50 text-center">
                <ShieldCheck className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                <div className="text-[9px] font-bold text-emerald-300 uppercase">Galibiyet</div>
                <div className="text-xl font-black text-emerald-100">{profile.wins}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-gradient-to-b from-[#311818] to-[#200f0f] border border-red-600/40 text-center">
                <X className="w-5 h-5 mx-auto mb-1 text-red-400" />
                <div className="text-[9px] font-bold text-red-300 uppercase">Mağlubiyet</div>
                <div className="text-xl font-black text-red-100">{profile.losses}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-gradient-to-b from-[#312518] to-[#20170f] border border-amber-600/40 text-center">
                <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                <div className="text-[9px] font-bold text-amber-300 uppercase">Yarıda Bırakılan</div>
                <div className="text-xl font-black text-amber-100">{profile.abandoned}</div>
              </div>
            </div>

            <div className="flex-1 min-h-0 p-2.5 rounded-xl bg-[#1c0d05] border border-amber-900/50 flex flex-col justify-between overflow-hidden">
              <div>
                <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-2">Hesap ve Seviye</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="flex items-center gap-1 font-semibold text-amber-300 bg-[#291408] px-2 py-1 rounded-lg border border-amber-800/40 text-[10px]"><Coins className="w-3 h-3" /> {profile.coins?.toLocaleString() ?? '500'} Jeton</span>
                  <span className="flex items-center gap-1 font-bold text-amber-300 bg-amber-950/80 px-2 py-1 rounded-lg border border-amber-500/50 text-[10px]"><Trophy className="w-3 h-3" /> {(profile.trophies || 0).toLocaleString()} Kupa</span>
                  <span className="flex items-center gap-1 font-bold text-yellow-200 bg-[#291408] px-2 py-1 rounded-lg border border-amber-800/40 text-[10px]"><Sparkles className="w-3 h-3" /> Seviye {profile.level ?? 1}</span>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[9px] mb-1">
                    <span className="text-amber-300 font-semibold">Seviye {levelProgress.currentLevel}{levelProgress.currentLevel < 100 ? ' → ' + levelProgress.nextLevel : ''}</span>
                    <span className="text-amber-400/70">{levelProgress.currentLevel >= 100 ? 'Maksimum Seviye' : levelProgress.remainingTrophies + ' kupa kaldı'}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#120703] rounded-full overflow-hidden border border-amber-900/60">
                    <div className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300" style={{ width: levelProgress.progressPercent + '%' }} />
                  </div>
                </div>
                {profile.isFirebaseUser ? (
                  <div className="mt-2 flex items-center gap-1.5 text-[9px] text-emerald-300 font-mono"><Fingerprint className="w-3 h-3" /> UID: {profile.id.slice(0, 6)}...{profile.id.slice(-4)}</div>
                ) : (
                  <div className="mt-2 text-[10px] text-amber-400/60 italic">Misafir Hesap</div>
                )}
              </div>

              {profile.isFirebaseUser ? (
                onLogout && <button onClick={() => { onLogout(); onClose(); }} className="self-end mt-2 px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-200 text-[10px] font-semibold border border-red-700/50 flex items-center gap-1 cursor-pointer"><LogOut className="w-3 h-3" /> Çıkış Yap</button>
              ) : (
                onLoginWithGoogle && <button onClick={onLoginWithGoogle} disabled={isAuthLoading} className="w-full mt-2 py-2 px-3 rounded-xl bg-white hover:bg-stone-100 text-stone-900 font-bold text-[10px] shadow border border-stone-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                  {isAuthLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" /> : <span className="font-black text-sm text-blue-600">G</span>}
                  <span>{isAuthLoading ? 'Google ile Bağlanıyor...' : 'Google ile Giriş Yap ve İlerlemeyi Kaydet'}</span>
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="px-4 py-2 border-t border-amber-800/60 bg-[#25140b] flex justify-end shrink-0">
          <button onClick={onClose} className="w-full sm:w-auto px-6 py-1.5 rounded-xl bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-100 font-bold text-xs shadow-md border border-amber-500/50 cursor-pointer">Tamam</button>
        </div>
      </div>
    </div>
  );
};
