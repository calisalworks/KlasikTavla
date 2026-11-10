import React from 'react';
import { ChevronLeft, ChevronRight, Radio } from 'lucide-react';

export const RADIO_STATIONS = [
  { id: 'powerturk', name: 'PowerTürk', url: 'https://listen.powerapp.com.tr/powerturk/128/icecast.audio' },
  { id: 'superfm', name: 'Süper FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/SUPER_FM.mp3' },
  { id: 'joyturk', name: 'JoyTürk', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_TURK_ITUNES.mp3' },
  { id: 'metrofm', name: 'Metro FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO_FM.mp3' },
  { id: 'alemfm', name: 'Alem FM', url: 'https://turkmedya.radyotvonline.net/alemfmaac' },
  { id: 'slowturk', name: 'Slow Türk', url: 'https://radyo.duhnet.tv/ak_dtvh_slowturk' },
  { id: 'number1turk', name: 'Number1 Türk', url: 'https://19643.live.streamtheworld.com/NUMBER1TURK_FMAAC.aac' },
  { id: 'number1slow', name: 'Number1 Türk Slow', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/NUMBER1TURK_SLOWAAC.aac' },
  { id: 'babaradyo', name: 'Baba Radyo', url: 'https://officialbabaradyo.radyotvonline.net/babaofficial' },
  { id: 'radyo45lik', name: 'Radyo 45lik', url: 'https://stream.radyo45lik.com:4545/stream' },
  { id: 'radyoilef', name: 'Radyo İlef', url: 'https://radyoilef.ankara.edu.tr/live' },
  { id: 'fenomen', name: 'Radyo Fenomen', url: 'https://live.radyofenomen.com/fenomen/256/icecast.audio' },
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
    <div className="flex items-center gap-1.5 shrink-0 mr-2" aria-label="İnternet radyosu">
      <button onClick={onPrevious} disabled={!hasEnabledStations} title="Önceki radyo" aria-label="Önceki radyo" className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-200 bg-[#3b2517] border border-amber-600/60 hover:bg-[#56351f] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
        <ChevronLeft className="w-5 h-5" strokeWidth={3} />
      </button>
      <button
        onClick={onToggle}
        disabled={!hasEnabledStations}
        title={hasEnabledStations ? `${station.name} - ${isPlaying ? 'Radyoyu kapat' : 'Radyoyu aç'}` : 'Ayarlar bölümünden en az bir radyo kanalını etkinleştirin'}
        aria-label={`${station.name} radyosunu ${isPlaying ? 'kapat' : 'aç'}`}
        aria-pressed={isPlaying}
        className={`w-9 h-9 flex items-center justify-center rounded-xl border-2 shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${isPlaying ? 'bg-amber-500/30 border-amber-300 text-amber-100 shadow-amber-500/20' : 'bg-[#2e1d13] hover:bg-[#4b2c18] text-amber-300 border-amber-600/60'}`}
      >
        <Radio className="w-6 h-6" strokeWidth={2.5} />
      </button>
      <button onClick={onNext} disabled={!hasEnabledStations} title="Sonraki radyo" aria-label="Sonraki radyo" className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-200 bg-[#3b2517] border border-amber-600/60 hover:bg-[#56351f] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
        <ChevronRight className="w-5 h-5" strokeWidth={3} />
      </button>
    </div>
  );
};
