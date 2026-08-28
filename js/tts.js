/**
 * ThesisMind Intelligent Speech Synthesis (TTS) Engine
 * Features:
 * - Multi-language support: Thai (th-TH) & English (en) with auto-detection.
 * - "F.R.I.D.A.Y." AI Assistant Voice Persona (Iron Man AI cadence - Irish/British crisp, intelligent tone).
 * - Clean academic text filtering (strips bracketed citations [1], markdown, formulas).
 */

class TTSEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.rate = 1.0;
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

  isThaiText(text) {
    return /[\u0E00-\u0E7F]/.test(text);
  }

  getThaiVoice() {
    if (!this.voices.length) this._loadVoices();
    // Prioritize natural Thai female voices
    return (
      this.voices.find(v => v.lang.startsWith('th') && (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Premwadee') || v.name.includes('Google'))) ||
      this.voices.find(v => v.lang.startsWith('th') || v.lang.includes('TH')) ||
      null
    );
  }

  getFridayAIVoice() {
    if (!this.voices.length) this._loadVoices();
    // FRIDAY persona: Irish (en-IE) or British (en-GB) crisp AI assistant voice
    return (
      // 1. Irish English (FRIDAY original accent)
      this.voices.find(v => (v.lang === 'en-IE' || v.lang.startsWith('en_IE')) && (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Emily') || v.name.includes('Moira'))) ||
      this.voices.find(v => v.lang === 'en-IE' || v.lang.startsWith('en_IE')) ||
      // 2. British English Female (Libby, Sonia, Victoria, Fiona, Hazel, Google UK)
      this.voices.find(v => (v.lang === 'en-GB' || v.lang.startsWith('en_GB')) && (v.name.includes('Libby') || v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Sonia') || v.name.includes('Victoria'))) ||
      this.voices.find(v => (v.lang === 'en-GB' || v.lang.startsWith('en_GB')) && (v.name.includes('Google') || v.name.includes('Female') || v.name.includes('Fiona'))) ||
      this.voices.find(v => v.lang === 'en-GB' || v.lang.startsWith('en_GB')) ||
      // 3. Smooth US English AI Female fallback (Jenny, Samantha, Ava)
      this.voices.find(v => v.lang.startsWith('en') && (v.name.includes('Jenny') || v.name.includes('Samantha') || v.name.includes('Natural') || v.name.includes('Neural'))) ||
      this.voices.find(v => v.lang.startsWith('en')) ||
      this.voices[0] ||
      null
    );
  }

  _cleanTextForSpeech(text) {
    return text
      .replace(/\[\d+(?:,\s*\d+)*\]/g, '') // remove [1], [2, 3] citations
      .replace(/\((?:(?:19|20)\d{2}|[A-Z][a-z]+(?:\s+et\s+al\.)?,\s*(?:19|20)\d{2})\)/g, '') // remove (Author, 2024)
      .replace(/https?:\/\/\S+/g, 'link')
      .replace(/[*_#`~>]/g, '') // strip markdown
      .replace(/\s+/g, ' ')
      .trim();
  }

  speak(text) {
    if (!this.synth) {
      alert('Your browser does not support Speech Synthesis.');
      return;
    }

    if (!text || !text.trim()) return;

    this.stop();

    const cleanText = this._cleanTextForSpeech(text);
    if (!cleanText) return;

    this.currentText = text.trim();
    this.currentUtterance = new SpeechSynthesisUtterance(cleanText);

    const isThai = this.isThaiText(cleanText);

    if (isThai) {
      this.currentUtterance.lang = 'th-TH';
      const thaiVoice = this.getThaiVoice();
      if (thaiVoice) this.currentUtterance.voice = thaiVoice;
      this.currentUtterance.pitch = 1.05;
      this.currentUtterance.rate = this.rate * 1.0;
    } else {
      this.currentUtterance.lang = 'en-GB';
      const fridayVoice = this.getFridayAIVoice();
      if (fridayVoice) this.currentUtterance.voice = fridayVoice;
      // F.R.I.D.A.Y. AI tone: slightly elevated pitch (1.08) for crisp, clear synthetic delivery
      this.currentUtterance.pitch = 1.08;
      this.currentUtterance.rate = this.rate * 1.03;
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
