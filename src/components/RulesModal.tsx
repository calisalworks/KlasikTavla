import React from 'react';
import { X, BookOpen, CheckCircle2 } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-gradient-to-b from-[#2e1a0e] via-[#241309] to-[#1a0c05] border-2 border-amber-600/70 p-5 text-amber-100 shadow-[0_25px_60px_rgba(0,0,0,0.95)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-amber-800/50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-amber-100">Klasik Tavla Kuralları</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-amber-900/60 text-amber-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 text-xs leading-relaxed pr-1 text-amber-200/90">
          <div className="p-3 rounded-xl bg-[#1c0d05] border border-amber-900/40">
            <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Oyunun Amacı
            </h3>
            <p>
              Her iki oyuncunun 15 taşı bulunur. Amaç tüm taşları kendi ev bölgesine (Beyaz için 1-6 arası, Siyah için 19-24 arası) getirmek ve ardından tahtadan toplamaktır. Tüm taşlarını ilk toplayan oyunu kazanır.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#1c0d05] border border-amber-900/40">
            <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Zar ve Taş Hareketi
            </h3>
            <p>
              Atılan iki zarın değeri kadar taşlar ilerletilir. Çift zar gelirse (örneğin 4-4), o sayıdan 4 kez oynanır. Tek bir taşla iki zar toplamı kadar veya iki ayrı taşla zarlar oynanabilir.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#1c0d05] border border-amber-900/40">
            <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Kapı Alma & Taş Kırma
            </h3>
            <p>
              Bir hanede 2 veya daha fazla taşınız varsa orası <strong>Kapı</strong> olur ve rakip o haneye konamaz. Bir hanede rakibin sadece 1 taşı varsa (<strong>Açık</strong>), o haneye basarak rakip taşı <strong>kırabilir</strong> ve tahtanın ortasındaki Bara gönderebilirsiniz.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#1c0d05] border border-amber-900/40">
            <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Kırık Taşın Tahtaya Girişi
            </h3>
            <p>
              Bar bölgesinde kırık taşınız varken tahtadaki başka hiçbir taşı oynayamazsınız. Atılan zarlarla kırık taş rakibin ev bölgesinden (Beyaz için 19-24, Siyah için 1-6) boş veya açığı olan hanelere girmelidir.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#1c0d05] border border-amber-900/40">
            <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Taş Toplama ve Puanlama (Mars)
            </h3>
            <p>
              Tüm 15 taşınız kendi ev bölgesine girdiğinde zarların hanesindeki taşlar toplanabilir.
              <br />
              • <strong>Normal Galibiyet:</strong> Rakip en az 1 taş toplamışsa (1 Puan).
              <br />
              • <strong>Mars:</strong> Rakip hiç taş toplayamamışsa (2 Puan).
              <br />
              • <strong>Katmerli Mars:</strong> Rakip hiç taş toplayamamış ve sizin evinizde veya barda taşı kalmışsa (3 Puan).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-amber-800/50">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-100 font-bold text-xs shadow-md border border-amber-500/50 cursor-pointer transition-colors"
          >
            ANLADIM
          </button>
        </div>
      </div>
    </div>
  );
};
