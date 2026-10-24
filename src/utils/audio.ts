/**
 * Physical acoustic audio synthesis for Backgammon (Tavla)
 * Generates natural wood and melamine checker/dice sounds using Web Audio API.
 */

class TavlaAudioManager {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private ambientEnabled: boolean = false;
  private ambientNode: AudioNode | null = null;

  constructor() {
    // Lazily initialized on first user interaction
  }

  private cachedDiceAudio: HTMLAudioElement | null = null;
  private cachedNoiseBuffer: AudioBuffer | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        try {
          const bufferSize = Math.floor(this.ctx.sampleRate * 1.5);
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          this.cachedNoiseBuffer = buffer;
        } catch {
          // ignore
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.cachedDiceAudio && typeof window !== 'undefined') {
      try {
        this.cachedDiceAudio = new Audio('/dice-roll.wav');
        this.cachedDiceAudio.preload = 'auto';
        this.cachedDiceAudio.volume = 0.9;
      } catch {
        // ignore
      }
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setAmbientEnabled(enabled: boolean) {
    this.ambientEnabled = enabled;
    if (enabled) {
      this.startAmbient();
    } else {
      this.stopAmbient();
    }
  }

  /**
   * Helper to generate a short noise burst with custom envelope (uses cached buffer for mobile zero-GC)
   */
  private createNoiseBuffer(duration: number): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.cachedNoiseBuffer) {
      return this.cachedNoiseBuffer;
    }
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Realistic checker placed on wooden board (tok ahşap taş sesi)
   */
  public playCheckerMove() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, t);
    masterGain.connect(this.ctx.destination);

    // 1. Wood body resonant strike (low-mid fundamental thud)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(260 + Math.random() * 30, t);
    osc1.frequency.exponentialRampToValueAtTime(110, t + 0.06);

    gain1.gain.setValueAtTime(0.4, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(t);
    osc1.stop(t + 0.06);

    // 2. High snap click of hard resin/wood surface
    const noise = this.createNoiseBuffer(0.035);
    if (noise) {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noise;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200 + Math.random() * 400, t);
      filter.Q.setValueAtTime(3.5, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain);

      noiseSource.start(t);
      noiseSource.stop(t + 0.035);
    }
  }

  /**
   * Hitting/capturing opponent checker (taş kırma sesi - firm impact)
   */
  public playCheckerHit() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.45, t);
    masterGain.connect(this.ctx.destination);

    // Stronger impact body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.08);

    oscGain.gain.setValueAtTime(0.7, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.08);

    // Sharp clack
    const noise = this.createNoiseBuffer(0.04);
    if (noise) {
      const src = this.ctx.createBufferSource();
      src.buffer = noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, t);
      filter.Q.setValueAtTime(2.0, t);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.6, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(masterGain);
      src.start(t);
      src.stop(t + 0.04);
    }
  }

  /**
   * Realistic dice roll clatter using uploaded sound file with procedural fallback
   */
  public playDiceRoll() {
    if (!this.soundEnabled) return;
    this.initContext();

    try {
      if (this.cachedDiceAudio) {
        this.cachedDiceAudio.currentTime = 0;
        const playPromise = this.cachedDiceAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            this.playSynthesizedDiceRoll();
          });
        }
      } else {
        this.playSynthesizedDiceRoll();
      }
    } catch {
      this.playSynthesizedDiceRoll();
    }
  }

  private playSynthesizedDiceRoll() {
    if (!this.soundEnabled) return;
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // 5 micro-impacts simulating rolling dice bouncing
    const impacts = [0, 0.05, 0.11, 0.18, 0.26, 0.34];

    impacts.forEach((delay, idx) => {
      const impactTime = t + delay;
      const decay = 0.025 + Math.random() * 0.02;
      const amp = (1 - idx * 0.12) * (0.2 + Math.random() * 0.15);

      const noise = this.createNoiseBuffer(decay);
      if (noise && this.ctx) {
        const src = this.ctx.createBufferSource();
        src.buffer = noise;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        // Bone/melamine dice resonance
        filter.frequency.setValueAtTime(2200 + Math.random() * 800, impactTime);
        filter.Q.setValueAtTime(4, impactTime);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(amp, impactTime);
        gain.gain.exponentialRampToValueAtTime(0.001, impactTime + decay);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        src.start(impactTime);
        src.stop(impactTime + decay);
      }

      // Wooden hollow under-tone for each bounce
      if (this.ctx) {
        const osc = this.ctx.createOscillator();
        const og = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200 + Math.random() * 80, impactTime);
        osc.frequency.exponentialRampToValueAtTime(80, impactTime + 0.03);

        og.gain.setValueAtTime(amp * 0.4, impactTime);
        og.gain.exponentialRampToValueAtTime(0.001, impactTime + 0.03);

        osc.connect(og);
        og.connect(this.ctx.destination);
        osc.start(impactTime);
        osc.stop(impactTime + 0.03);
      }
    });
  }

  /**
   * Final dice settle sound (zarların masada duruşu)
   */
  public playDiceDrop() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.04);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  /**
   * Checker bear-off slide & drop (taş toplama sesi)
   */
  public playBearOff() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Wood slide friction followed by gentle wooden stack clack
    const noise = this.createNoiseBuffer(0.08);
    if (noise) {
      const src = this.ctx.createBufferSource();
      src.buffer = noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.linearRampToValueAtTime(400, t + 0.08);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(t);
      src.stop(t + 0.08);
    }

    // Stack tap
    setTimeout(() => {
      this.playCheckerMove();
    }, 40);
  }

  /**
   * Clean wooden button or interface tap
   */
  public playButtonClick() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.03);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  /**
   * Soft, gentle chime notification when it becomes the player's turn (yumuşak sıra sende uyarısı)
   */
  public playTurnNotification() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    // Two warm, soft ascending chime notes (C5: 523.25 Hz -> E5: 659.25 Hz)
    const tones = [
      { freq: 523.25, offsetMs: 0, duration: 0.32, gain: 0.13 },
      { freq: 659.25, offsetMs: 110, duration: 0.42, gain: 0.15 },
    ];

    tones.forEach(({ freq, offsetMs, duration, gain: maxGain }) => {
      setTimeout(() => {
        if (!this.ctx || !this.soundEnabled) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        // Sine wave for sweet, round, mellow chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        // Soft attack to avoid click, gentle natural exponential decay
        gainNode.gain.setValueAtTime(0.0001, t);
        gainNode.gain.linearRampToValueAtTime(maxGain, t + 0.025);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + duration);
      }, offsetMs);
    });
  }

  /**
   * Warm game victory melody (wooden marimba acoustic chords)
   */
  public playVictory() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const notes = [261.63, 329.63, 392.0, 523.25, 659.25]; // C4, E4, G4, C5, E5
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
      }, idx * 110);
    });
  }

  /**
   * Soft ambient cafe/room warmth (calm and subtle)
   */
  private startAmbient() {
    this.initContext();
    if (!this.ctx || this.ambientNode) return;
    try {
      // Gentle pink noise filtered like distant cozy room atmosphere
      const buffer = this.createNoiseBuffer(2);
      if (!buffer) return;
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noiseSource.start();
      this.ambientNode = noiseSource;
    } catch {
      // ignore
    }
  }

  private stopAmbient() {
    if (this.ambientNode) {
      try {
        (this.ambientNode as AudioBufferSourceNode).stop();
        this.ambientNode.disconnect();
      } catch {
        // ignore
      }
      this.ambientNode = null;
    }
  }
}

export const tavlaAudio = new TavlaAudioManager();
