import React, { useState, useEffect } from 'react';
import { Smartphone, RotateCw, Maximize } from 'lucide-react';

interface LandscapeNoticeProps {
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export const LandscapeNotice: React.FC<LandscapeNoticeProps> = ({
  onToggleFullscreen,
  isFullscreen,
}) => {
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Screen orientation check: portrait when window height is strictly greater than window width
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-[#241208] via-[#1a0b04] to-[#0f0602] flex flex-col items-center justify-center p-6 text-center select-none">
      {/* Animated Rotating Phone Graphic */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-3xl bg-amber-950/60 border-2 border-amber-600/50 flex items-center justify-center shadow-[0_0_30px_rgba(217,119,6,0.3)]">
          <Smartphone className="w-14 h-14 text-amber-400 rotate-90 animate-pulse" />
        </div>
        <RotateCw className="w-7 h-7 text-amber-300 absolute -top-2 -right-2 animate-spin" />
      </div>

      {/* Strict Requirement Notice */}
      <h2 className="text-xl md:text-2xl font-black text-amber-100 mb-2 font-['Cinzel',serif] tracking-wide">
        YATAY EKRAN GEREKLİDİR
      </h2>

      <p className="text-sm text-amber-300/80 max-w-xs leading-relaxed mb-6 font-medium">
        Tavla oyunu yalnızca <strong>yatay (landscape)</strong> modda çalışır. Lütfen telefonunuzu yatay konuma çevirin.
      </p>

      {/* Fullscreen Button */}
      {onToggleFullscreen && (
        <button
          onClick={onToggleFullscreen}
          className="py-3 px-6 rounded-2xl bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-100 text-xs font-bold shadow-lg border border-amber-400/50 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
        >
          <Maximize className="w-4 h-4" />
          <span>{isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Yap'}</span>
        </button>
      )}
    </div>
  );
};
