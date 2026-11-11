import React from 'react';
import { ChevronLeft, ChevronRight, RadioTower, Volume2 } from 'lucide-react';
import { RADIO_STATIONS } from '../utils/radioStations';
export { RADIO_STATIONS } from '../utils/radioStations';

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
    <div className="flex items-center gap-1.5 shrink-0 mr-2" aria-label="İnternet radyosu">
      <button type="button" onClick={onPrevious} disabled={!hasEnabledStations} title="Önceki radyo" aria-label="Önceki radyo" className="w-12 h-8 min-w-12 flex items-center justify-center rounded-lg text-amber-200 bg-[#3b2517] border border-amber-600/60 hover:bg-[#56351f] active:scale-95 active:bg-[#6b4226] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer touch-manipulation">
        <ChevronLeft className="w-6 h-6" strokeWidth={3} />
      </button>
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasEnabledStations}
        title={hasEnabledStations ? `${station.name} - ${isPlaying ? 'Radyoyu kapat' : 'Radyoyu aç'}` : 'Ayarlar bölümünden en az bir radyo kanalını etkinleştirin'}
        aria-label={`${station.name} radyosunu ${isPlaying ? 'kapat' : 'aç'}`}
        aria-pressed={isPlaying}
        className={`relative w-12 h-8 min-w-12 flex items-center justify-center rounded-xl border-2 shadow-md cursor-pointer transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation ${isPlaying ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 shadow-emerald-500/30' : 'bg-red-950/90 hover:bg-red-900 border-red-500 text-red-300'}`}
      >
        <RadioTower className="w-6 h-6" strokeWidth={2.4} />
        <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-0.5 rounded-full bg-[#160d07] border border-amber-400/80 text-amber-100 text-[8px] leading-3 font-black text-center">{stationIndex + 1}</span>
      </button>
      <button type="button" onClick={onNext} disabled={!hasEnabledStations} title="Sonraki radyo" aria-label="Sonraki radyo" className="w-12 h-8 min-w-12 flex items-center justify-center rounded-lg text-amber-200 bg-[#3b2517] border border-amber-600/60 hover:bg-[#56351f] active:scale-95 active:bg-[#6b4226] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer touch-manipulation">
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
  <label className="h-9 min-w-0 max-w-full flex items-center gap-1.5 px-2 rounded-lg bg-[#2e1d13] border border-amber-700/50 text-amber-300 shrink" title="Müzik, radyo ve zar ses seviyesi">
    <Volume2 className="w-4 h-4 shrink-0" />
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label="Ortak ses seviyesi"
      className="w-[clamp(2.75rem,10vw,7.25rem)] min-w-0 h-5 accent-amber-400 cursor-pointer touch-manipulation"
    />
    <span className="w-7 text-right text-[10px] tabular-nums">{value}%</span>
  </label>
);
