import React from 'react';
import { ChevronLeft, ChevronRight, RadioTower, Volume2 } from 'lucide-react';

export const RADIO_STATIONS = [
  { id: 'powerturk', name: 'PowerTürk', url: 'https://listen.powerapp.com.tr/powerturk/128/icecast.audio' },
  { id: 'superfm', name: 'Süper FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/SUPER_FM.mp3' },
  { id: 'joyturk', name: 'JoyTürk', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_TURK_ITUNES.mp3' },
  { id: 'metrofm', name: 'Metro FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO_FM.mp3' },
  { id: 'alemfm', name: 'Alem FM', url: 'https://turkmedya.radyotvonline.net/alemfmaac' },
] as const;

interface RadioControlsProps {
  isPlaying: boolean;
  stationIndex: number;
  hasEnabledStations: boolean;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export const RadioControls: React.FC<RadioControlsProps> = ({
  isPlaying,
  stationIndex,
  hasEnabledStations,
  onToggle,
  onPrevious,
  onNext,
}) => {
  const station = RADIO_STATIONS[stationIndex] ?? RADIO_STATIONS[0];

  return (
    <div className="flex items-center gap-2 shrink-0 mr-2" aria-label="İnternet radyosu">
      <button type="button" onClick={onPrevious} disabled={!hasEnabledStations} title="Önceki radyo" aria-label="Önceki radyo" className="w-10 h-10 min-w-10 flex items-center justify-center rounded-lg text-amber-200 bg-[#3b2517] border border-amber-600/60 hover:bg-[#56351f] active:scale-95 active:bg-[#6b4226] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer touch-manipulation">
        <ChevronLeft className="w-6 h-6" strokeWidth={3} />
      </button>
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasEnabledStations}
        title={hasEnabledStations ? `${station.name} - ${isPlaying ? 'Radyoyu kapat' : 'Radyoyu aç'}` : 'Ayarlar bölümünden en az bir radyo kanalını etkinleştirin'}
        aria-label={`${station.name} radyosunu ${isPlaying ? 'kapat' : 'aç'}`}
        aria-pressed={isPlaying}
        className={`w-10 h-10 min-w-10 flex items-center justify-center rounded-xl border-2 shadow-md cursor-pointer transition-colors active:scale-95 active:bg-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation ${isPlaying ? 'bg-amber-500/30 border-amber-300 text-amber-100 shadow-amber-500/20' : 'bg-[#2e1d13] hover:bg-[#4b2c18] text-amber-300 border-amber-600/60'}`}
      >
        <RadioTower className="w-7 h-7" strokeWidth={2.4} />
      </button>
      <button type="button" onClick={onNext} disabled={!hasEnabledStations} title="Sonraki radyo" aria-label="Sonraki radyo" className="w-10 h-10 min-w-10 flex items-center justify-center rounded-lg text-amber-200 bg-[#3b2517] border border-amber-600/60 hover:bg-[#56351f] active:scale-95 active:bg-[#6b4226] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer touch-manipulation">
        <ChevronRight className="w-6 h-6" strokeWidth={3} />
      </button>
    </div>
  );
};

interface MasterVolumeControlProps {
  value: number;
  onChange: (value: number) => void;
}

export const MasterVolumeControl: React.FC<MasterVolumeControlProps> = ({ value, onChange }) => (
  <label className="h-9 flex items-center gap-1.5 px-2 rounded-lg bg-[#2e1d13] border border-amber-700/50 text-amber-300 shrink-0" title="Müzik, radyo ve zar ses seviyesi">
    <Volume2 className="w-4 h-4 shrink-0" />
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label="Ortak ses seviyesi"
      className="w-[76px] h-5 accent-amber-400 cursor-pointer touch-manipulation"
    />
    <span className="w-7 text-right text-[10px] tabular-nums">{value}%</span>
  </label>
);
