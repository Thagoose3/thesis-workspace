/**
 * Instant Text-to-Speech (TTS) Engine for Thesis & Paper Reading
 * Uses standard Web Speech API with rate adjustment and playback state callbacks.
 */

class TTSEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.rate = 1.0; // 0.75, 1.0, 1.25, 1.5
    this.currentText = '';
    this.listeners = new Set();
    this.voices = [];
    this._loadVoices();
  }

  _loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => {
        this.voices = this.synth.getVoices();
      };
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      rate: this.rate,
      text: this.currentText,
    };
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  getEnglishVoice() {
    if (!this.voices.length) this._loadVoices();
    // Prefer Google UK/US English or Natural voices
    return (
      this.voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))) ||
      this.voices.find(v => v.lang.startsWith('en')) ||
      this.voices[0] ||
      null
    );
  }

  speak(text) {
    if (!this.synth) {
      alert('Your browser does not support Speech Synthesis.');
      return;
    }

    if (!text || !text.trim()) return;

    this.stop();

    this.currentText = text.trim();
    this.currentUtterance = new SpeechSynthesisUtterance(this.currentText);
    this.currentUtterance.rate = this.rate;

    const voice = this.getEnglishVoice();
    if (voice) {
      this.currentUtterance.voice = voice;
    }

    this.currentUtterance.onstart = () => {
      this.isPlaying = true;
      this.isPaused = false;
      this.notify();
    };

    this.currentUtterance.onend = () => {
      this.isPlaying = false;
      this.isPaused = false;
      this.notify();
    };

    this.currentUtterance.onerror = (e) => {
      console.warn('TTS Speech error:', e);
      this.isPlaying = false;
      this.isPaused = false;
      this.notify();
    };

    this.synth.speak(this.currentUtterance);
  }

  pause() {
    if (this.synth && this.isPlaying && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
      this.notify();
    }
  }

  resume() {
    if (this.synth && this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
      this.notify();
    }
  }

  togglePlayPause() {
    if (!this.isPlaying && this.currentText) {
      this.speak(this.currentText);
    } else if (this.isPaused) {
      this.resume();
    } else if (this.isPlaying) {
      this.pause();
    }
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.isPlaying = false;
      this.isPaused = false;
      this.notify();
    }
  }

  setRate(rate) {
    this.rate = rate;
    if (this.isPlaying && this.currentText) {
      const text = this.currentText;
      this.speak(text);
    } else {
      this.notify();
    }
  }
}

export const tts = new TTSEngine();
