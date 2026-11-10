import React, { useEffect, useState } from 'react';

const GAME_TIPS = [
  'Açıkta tek taş bırakmamaya çalışın; rakibiniz bu taşı kırabilir.',
  'İki veya daha fazla taşla aynı haneyi kapatarak güvenli kapılar oluşturun.',
  'Kırık taşınız varsa önce onu oyuna sokmanız gerekir.',
  'Rakibin ev bölgesindeki kapıları takip edin; girişinizi engelleyebilir.',
  'Taşlarınızı dengeli ilerletin; geride tek taş bırakmamaya dikkat edin.',
  'Çift zar geldiğinde aynı sayıyı dört kez oynarsınız.',
  'Rakibin tek taşını kırmak oyunun gidişatını değiştirebilir.',
  'Uygun durumlarda büyük zarınızı kullanarak taş toplamaya başlayabilirsiniz.',
  'Bir hanede iki veya daha fazla taşınız varsa rakip o haneye gelemez.',
  'Hamle yapmadan önce iki zarın da kullanılabileceği seçenekleri değerlendirin.',
];

export const GameTips: React.FC = () => {
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTipIndex((index) => (index + 1) % GAME_TIPS.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-w-0 flex-1 overflow-hidden relative h-full flex items-center" aria-live="polite">
      <style>{`
        @keyframes tavla-tip-slide {
          0% { transform: translateX(100%); opacity: 0; }
          8% { opacity: 1; }
          88% { opacity: 1; }
          100% { transform: translateX(-100%); opacity: 0; }
        }
      `}</style>
      <span key={tipIndex} className="inline-block whitespace-nowrap text-[10px] sm:text-[11px] text-amber-200/90" style={{ animation: 'tavla-tip-slide 6.5s linear both' }}>
        {GAME_TIPS[tipIndex]}
      </span>
    </div>
  );
};
