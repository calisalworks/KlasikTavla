import React, { useState } from 'react';
import { TargetScore, AIDifficulty } from '../types/game';
import { tavlaAudio } from '../utils/audio';
import { Bot, Trophy, X, Play } from 'lucide-react';

interface SinglePlayerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (targetScore: TargetScore, difficulty: AIDifficulty) => void;
  initialDifficulty: AIDifficulty;
}

export const SinglePlayerSetupModal: React.FC<SinglePlayerSetupModalProps> = ({
  isOpen,
  onClose,
  onStart,
  initialDifficulty,
}) => {
  const [targetScore, setTargetScore] = useState<TargetScore>(3);
  const [difficulty, setDifficulty] = useState<AIDifficulty>(initialDifficulty);

  if (!isOpen) return null;

  const handleStartGame = () => {
    tavlaAudio.playButtonClick();
    onStart(targetScore, difficulty);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="w-full max-w-sm max-h-[92vh] flex flex-col rounded-2xl bg-gradient-to-b from-[#2e1a0e] via-[#241309] to-[#1a0c05] border-2 border-amber-600/70 text-amber-100 shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-800/60 bg-[#25140b] shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-amber-100">Tek Kişilik Oyun Kur</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-amber-900/60 text-amber-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 text-xs">
          {/* Sadece 1, 3 ve 5 Seçenekleri */}
          <div>
            <label className="block text-[11px] text-amber-300/90 font-bold mb-1.5 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Hedef Puan Seçimi</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([1, 3, 5] as TargetScore[]).map((score) => (
                <button
                  type="button"
                  key={score}
                  onClick={() => setTargetScore(score)}
                  className={`py-2 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                    targetScore === score
                      ? 'bg-amber-600 border-amber-300 text-white shadow'
                      : 'bg-[#2b170c] border-amber-900/60 text-amber-300/70 hover:bg-[#381e10]'
                  }`}
                >
                  {score} Puan
                </button>
              ))}
            </div>
            <p className="text-[10px] text-amber-400/60 mt-1">
              İlk {targetScore} puana ulaşan oyuncu maçı kazanır.
            </p>
          </div>

          {/* AI Seviyesi */}
          <div>
            <label className="block text-[11px] text-amber-300/90 font-bold mb-1.5 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-amber-400" />
              <span>Yapay Zeka Zorluğu</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((level) => (
                <button
                  type="button"
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`py-2 rounded-xl border text-xs font-semibold capitalize transition-all cursor-pointer ${
                    difficulty === level
                      ? 'bg-amber-600 border-amber-300 text-white shadow'
                      : 'bg-[#2b170c] border-amber-900/60 text-amber-300/70 hover:bg-[#381e10]'
                  }`}
                >
                  {level === 'easy' ? 'Kolay' : level === 'medium' ? 'Orta' : 'Usta'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-amber-800/60 bg-[#25140b] flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#201006] hover:bg-[#2b170c] text-amber-300 text-xs font-semibold cursor-pointer"
          >
            İptal
          </button>
          <button
            onClick={handleStartGame}
            className="px-5 py-2 rounded-xl bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-white text-xs font-bold shadow border border-amber-400/60 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Oyunu Başlat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
