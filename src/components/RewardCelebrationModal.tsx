import React from 'react';
import { Sparkles, Coins, Check } from 'lucide-react';
import { tavlaAudio } from '../utils/audio';

interface RewardCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  coinsEarned: number;
  newBalance: number;
}

export const RewardCelebrationModal: React.FC<RewardCelebrationModalProps> = ({
  isOpen,
  onClose,
  title,
  coinsEarned,
  newBalance,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#3a2010] via-[#241309] to-[#140a04] border-2 border-amber-500 p-5 shadow-[0_20px_50px_rgba(245,158,11,0.3)] text-center text-amber-100 flex flex-col items-center animate-in zoom-in-95 duration-200">
        {/* Animated Coins Icon */}
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center text-amber-950 shadow-[0_0_25px_rgba(245,158,11,0.7)] mb-3 animate-bounce">
          <Coins className="w-9 h-9 text-amber-950" />
          <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-white animate-spin" />
        </div>

        <h3 className="text-lg font-black text-white mb-1">
          {title}
        </h3>

        <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-emerald-300 to-amber-300 mb-2">
          +{coinsEarned.toLocaleString()} JETON
        </div>

        <div className="w-full py-2 px-3 rounded-xl bg-black/60 border border-amber-600/40 text-xs text-amber-200/90 mb-4 flex items-center justify-between">
          <span className="text-amber-400/80">Güncel Bakiyeniz:</span>
          <strong className="text-emerald-400 font-extrabold text-sm">
            {newBalance.toLocaleString()} Jeton
          </strong>
        </div>

        <button
          onClick={() => {
            tavlaAudio.playButtonClick();
            onClose();
          }}
          className="w-full py-2.5 rounded-xl bg-gradient-to-b from-amber-500 via-amber-600 to-amber-800 hover:from-amber-400 hover:to-amber-700 text-white font-extrabold text-xs shadow-lg border border-amber-400 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Check className="w-4 h-4 text-white" />
          <span>HARİKA, TEŞEKKÜRLER!</span>
        </button>
      </div>
    </div>
  );
};
