export interface SpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

class SpeechEngine {
  private enabled = true;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public cancel(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore speech synthesis errors in restricted environments
      }
    }
  }

  public speak(text: string, options: SpeechOptions = {}): void {
    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = options.lang ?? 'zh-CN';
      utter.rate = options.rate ?? 1.12;
      utter.pitch = options.pitch ?? 1.02;
      utter.volume = options.volume ?? 0.88;
      synth.speak(utter);
    } catch {
      // Ignore speech synthesis errors in restricted environments
    }
  }
}

export const speechEngine = new SpeechEngine();
