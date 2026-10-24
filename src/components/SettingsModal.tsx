import React, { useState } from 'react';
import { GameSettings } from '../types/game';
import {
  X,
  Volume2,
  VolumeX,
  Music,
  Sparkles,
  Check,
  BookOpen,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'RULES'>('SETTINGS');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none">
      {/* Compact Landscape-Optimized Container */}
      <div className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-gradient-to-b from-[#2e1a0e] via-[#241309] to-[#1a0c05] border-2 border-amber-600/70 text-amber-100 shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-800/60 bg-[#25140b] shrink-0">
          <div className="flex items-center gap-2">
            {/* Tabs inside Header */}
            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'SETTINGS'
                  ? 'bg-amber-700 text-white shadow border border-amber-400/50'
                  : 'text-amber-300/70 hover:text-amber-200 hover:bg-amber-900/40'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Ayarlar</span>
            </button>

            <button
              onClick={() => setActiveTab('RULES')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'RULES'
                  ? 'bg-amber-700 text-white shadow border border-amber-400/50'
                  : 'text-amber-300/70 hover:text-amber-200 hover:bg-amber-900/40'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Tavla Kuralları</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-900/80 hover:bg-amber-800 text-amber-200 border border-amber-600/50 text-xs font-bold transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Kapat</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 text-xs">
          {activeTab === 'SETTINGS' ? (
            <>
              {/* Audio Toggles Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* 1. Ses Efektleri */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#1c0d05] border border-amber-900/50">
                  <div className="flex items-center gap-2">
                    {settings.soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-stone-500 shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold text-amber-100 text-[11px]">Taş & Zar Sesi</div>
                      <div className="text-[9px] text-amber-400/60">Doğal ahşap vuruş sesleri</div>
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer border shrink-0 ${
                      settings.soundEnabled ? 'bg-amber-600 border-amber-400' : 'bg-stone-800 border-stone-600'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white shadow transform transition-transform ${
                        settings.soundEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 2. Ortam Sesi */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#1c0d05] border border-amber-900/50">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-amber-100 text-[11px]">Sakin Ortam Sesi</div>
                      <div className="text-[9px] text-amber-400/60">Hafif oda akustiği</div>
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ ambientSound: !settings.ambientSound })}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer border shrink-0 ${
                      settings.ambientSound ? 'bg-amber-600 border-amber-400' : 'bg-stone-800 border-stone-600'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white shadow transform transition-transform ${
                        settings.ambientSound ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 3. Hamle İpuçları (Highlight) */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#1c0d05] border border-amber-900/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-amber-100 text-[11px]">Oynanabilir Hane Vurgusu</div>
                    <div className="text-[9px] text-amber-400/60">Seçili taşın gidebileceği yerleri yeşil halkayla göster</div>
                  </div>
                </div>
                <button
                  onClick={() => onUpdateSettings({ highlightMoves: !settings.highlightMoves })}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer border shrink-0 ${
                    settings.highlightMoves ? 'bg-emerald-600 border-emerald-400' : 'bg-stone-800 border-stone-600'
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full bg-white shadow transform transition-transform ${
                      settings.highlightMoves ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </>
          ) : (
            /* RULES TAB */
            <div className="space-y-2.5 text-amber-200/90 pr-1">
              <div className="p-3 rounded-xl bg-[#1c0d05] border border-amber-900/40">
                <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Oyunun Amacı
                </h3>
                <p className="text-[11px] leading-relaxed">
                  Her iki oyuncunun 15 taşı bulunur. Amaç tüm taşları kendi ev bölgesine (Beyaz için 1-6, Siyah için 19-24) getirmek ve ardından tahtadan toplamaktır. 15 taşını ilk toplayan oyunu kazanır.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#1c0d05] border border-amber-900/40">
                <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Zarlar & Çift Zar Kuralı
                </h3>
                <p className="text-[11px] leading-relaxed">
                  Zarlar atıldığında gelen sayılar kadar taşlar ilerletilir. Çift zar gelirse (ör. 4-4), o sayıdan 4 kez oynanır.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#1c0d05] border border-amber-900/40">
                <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Kapı Alma & Taş Kırma
                </h3>
                <p className="text-[11px] leading-relaxed">
                  Bir hanede 2 veya daha fazla taşınız varsa orası <strong>Kapı</strong> olur ve rakip gelemez. Rakibin tek taşının (<strong>Açık</strong>) bulunduğu haneye basarak taşı <strong>kırabilir</strong> ve Bara gönderebilirsiniz.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#1c0d05] border border-amber-900/40">
                <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Kırık Taşın Oyuna Girişi
                </h3>
                <p className="text-[11px] leading-relaxed">
                  Bar bölgesinde kırık taşınız varken diğer taşlarınızı oynayamazsınız. Atılan zarlarla kırık taş önce rakibin ev bölgesinden boş veya açığı olan haneye sokulmalıdır.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#1c0d05] border border-amber-900/40">
                <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Puanlama (Normal Galibiyet, Mars, Katmerli Mars)
                </h3>
                <p className="text-[11px] leading-relaxed">
                  • <strong>Normal Galibiyet (1 Puan):</strong> Rakip en az 1 taş toplamışsa.
                  <br />
                  • <strong>Mars (2 Puan):</strong> Rakip hiç taş toplayamamışsa.
                  <br />
                  • <strong>Katmerli Mars (3 Puan):</strong> Rakip taş toplayamamış ve rakibin evinizde veya barda taşı kalmışsa.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-amber-800/60 bg-[#25140b] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-1.5 rounded-xl bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-100 font-bold text-xs shadow-md border border-amber-500/50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>KAYDET VE DÖN</span>
          </button>
        </div>
      </div>
    </div>
  );
};
