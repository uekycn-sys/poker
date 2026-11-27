class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playNoise(
    duration: number,
    filterFreq: number,
    q: number,
    volume: number,
    delay = 0,
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(q, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  public playSelect(): void {
    this.playTone(980, 1280, 0.045, 'triangle', 0.08);
  }

  public playChipClink(): void {
    this.playTone(1850, 2400, 0.055, 'sine', 0.09);
    this.playTone(2650, 3100, 0.045, 'triangle', 0.06, 0.03);
  }

  public playDeal(): void {
    for (let i = 0; i < 6; i++) {
      this.playNoise(0.05, 1900 + i * 180, 1.2, 0.08, i * 0.055);
    }
  }

  public playCardSlap(emphasis = false): void {
    this.playNoise(0.075, emphasis ? 1400 : 1100, 0.9, emphasis ? 0.24 : 0.16);
    this.playTone(emphasis ? 190 : 150, 62, 0.09, 'sine', emphasis ? 0.22 : 0.14);
  }

  public playPass(): void {
    this.playTone(260, 140, 0.09, 'sine', 0.08);
  }

  public playTick(): void {
    this.playTone(1150, 880, 0.05, 'square', 0.045);
  }

  public playComboSweep(): void {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.06, 0.18, 'triangle', 0.09, idx * 0.045);
    });
  }

  public playBomb(): void {
    this.playTone(135, 32, 0.55, 'sawtooth', 0.28);
    this.playTone(92, 28, 0.65, 'sine', 0.32);
    this.playNoise(0.45, 520, 0.6, 0.34);
  }

  public playRocket(): void {
    this.playTone(260, 1420, 0.28, 'sawtooth', 0.16);
    this.playTone(120, 28, 0.65, 'sine', 0.34, 0.2);
    this.playNoise(0.55, 760, 0.55, 0.35, 0.18);
  }

  public playVictory(): void {
    const arp = [523.25, 659.25, 783.99, 1046.5];
    arp.forEach((f, idx) => {
      this.playTone(f, f, 0.28, 'triangle', 0.13, idx * 0.085);
    });
  }

  public playDefeat(): void {
    const notes = [392, 349.23, 293.66];
    notes.forEach((f, idx) => {
      this.playTone(f, f * 0.96, 0.26, 'sine', 0.1, idx * 0.12);
    });
  }

  public playBeansAid(): void {
    const sparkle = [659.25, 783.99, 987.77, 1318.51];
    sparkle.forEach((f, idx) => {
      this.playTone(f, f * 1.02, 0.18, 'sine', 0.12, idx * 0.06);
    });
  }

  public playShuffle(): void {
    for (let i = 0; i < 8; i++) {
      this.playNoise(0.038, 1600 + (i % 4) * 260, 1.4, 0.075, i * 0.042);
    }
    this.playNoise(0.09, 950, 0.9, 0.12, 0.36);
  }

  public playChipStack(intensity: 'small' | 'medium' | 'large' = 'medium'): void {
    const count = intensity === 'large' ? 5 : intensity === 'medium' ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const delay = i * 0.04;
      this.playTone(1950 + i * 160, 2600 + i * 140, 0.048, 'sine', 0.085, delay);
      this.playTone(3100 + i * 120, 3400, 0.03, 'triangle', 0.045, delay + 0.015);
    }
  }

  public playCheck(): void {
    this.playTone(145, 72, 0.055, 'sine', 0.14, 0);
    this.playTone(155, 76, 0.055, 'sine', 0.12, 0.1);
  }

  public playFold(): void {
    this.playNoise(0.09, 1050, 0.85, 0.09, 0);
    this.playTone(210, 110, 0.08, 'sine', 0.06, 0.01);
  }

  public playHeartbeat(beats = 3): void {
    for (let i = 0; i < beats; i++) {
      const base = i * 0.62;
      // Lub
      this.playTone(68, 36, 0.14, 'sine', 0.26, base);
      // Dub
      this.playTone(58, 32, 0.16, 'sine', 0.2, base + 0.16);
    }
  }

  public playShowdownReveal(): void {
    this.playNoise(0.06, 1750, 1.1, 0.1, 0);
    this.playTone(587.33, 880, 0.18, 'triangle', 0.09, 0.04);
  }

  public playQuizSuccess(): void {
    const notes = [659.25, 880, 1174.66];
    notes.forEach((f, idx) => {
      this.playTone(f, f * 1.03, 0.16, 'triangle', 0.11, idx * 0.06);
    });
  }

  public playQuizFail(): void {
    this.playTone(280, 190, 0.18, 'sawtooth', 0.07, 0);
    this.playTone(210, 140, 0.22, 'sine', 0.09, 0.1);
  }
}

export const soundEngine = new SoundEngine();
