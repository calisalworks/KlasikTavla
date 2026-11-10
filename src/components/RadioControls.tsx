import React from 'react';
import { ChevronLeft, ChevronRight, Radio } from 'lucide-react';

export const RADIO_STATIONS = [
  { name: 'PowerTürk', url: 'https://listen.powerapp.com.tr/powerturk/128/icecast.audio' },
  { name: 'Süper FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/SUPER_FM.mp3' },
  { name: 'JoyTürk', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_TURK_ITUNES.mp3' },
  { name: 'Metro FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO_FM.mp3' },
  { name: 'Number One Türk', url: 'https://19643.live.streamtheworld.com/NUMBER1TURK_FMAAC.aac' },
] as const;

interface RadioControlsProps {
  isPlaying: boolean;
  stationIndex: number;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export const RadioControls: React.FC<RadioControlsProps> = ({
  isPlaying,
  stationIndex,
  onToggle,
  onPrevious,
  onNext,
}) => {
  const station = RADIO_STATIONS[stationIndex] ?? RADIO_STATIONS[0];

  return (
    <div className="flex items-center gap-0.5 shrink-0" aria-label="İnternet radyosu">
      <button onClick={onPrevious} title="Önceki radyo" aria-label="Önceki radyo" className="p-1 rounded-md text-amber-300/80 hover:text-amber-200 hover:bg-[#3e271a] cursor-pointer">
        <ChevronLeft className="w-3 h-3" />
      </button>
      <button
        onClick={onToggle}
        title={`${station.name} - ${isPlaying ? 'Radyoyu kapat' : 'Radyoyu aç'}`}
        aria-label={`${station.name} radyosunu ${isPlaying ? 'kapat' : 'aç'}`}
        aria-pressed={isPlaying}
        className={`p-1.5 rounded-lg border shadow cursor-pointer transition-colors ${isPlaying ? 'bg-amber-500/25 border-amber-400 text-amber-200' : 'bg-[#2e1d13] hover:bg-[#3e271a] text-amber-300 border-amber-700/40'}`}
      >
        <Radio className="w-3.5 h-3.5" />
      </button>
      <button onClick={onNext} title="Sonraki radyo" aria-label="Sonraki radyo" className="p-1 rounded-md text-amber-300/80 hover:text-amber-200 hover:bg-[#3e271a] cursor-pointer">
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
};
