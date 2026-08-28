/**
 * ThesisMind Intelligent Speech Synthesis (TTS) Engine - "F.R.I.D.A.Y." AI Persona
 * Features:
 * - Dual Language support (Thai & English) tuned to the sleek, crisp, intelligent "F.R.I.D.A.Y." AI tone.
 * - Instant togglePlay/Stop support (Click to read, click again to stop, or press ESC).
 * - Text preprocessing for smooth academic cadence (strips bracket citations [1], URLs, markdown).
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
    this._initKeyboardShortcut();
  }

  _initKeyboardShortcut() {
    window.addEventListener('keydown', (e) => {
      // ESC stops audio immediately
      if (e.key === 'Escape' && this.isPlaying) {
        this.stop();
      }
    });
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
    // Initial notify
    listener({
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      rate: this.rate,
      text: this.currentText,
    });
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

  getThaiFridayVoice() {
    if (!this.voices.length) this._loadVoices();
    // Prioritize natural, articulate Thai female AI voice
    return (
      this.voices.find(v => (v.lang.startsWith('th') || v.lang.includes('TH')) && (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Premwadee'))) ||
      this.voices.find(v => (v.lang.startsWith('th') || v.lang.includes('TH')) && v.name.includes('Google')) ||
      this.voices.find(v => (v.lang.startsWith('th') || v.lang.includes('TH')) && (v.name.includes('Kanya') || v.name.includes('Narisa') || v.name.includes('Female'))) ||
      this.voices.find(v => v.lang.startsWith('th') || v.lang.includes('TH')) ||
      null
    );
  }

  getEnglishFridayVoice() {
    if (!this.voices.length) this._loadVoices();
    // FRIDAY persona: Irish (en-IE) or British (en-GB) crisp AI assistant voice
    return (
      // 1. Irish English (FRIDAY original accent from Iron Man / Kerry Condon)
      this.voices.find(v => (v.lang === 'en-IE' || v.lang.startsWith('en_IE')) && (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Emily') || v.name.includes('Moira'))) ||
      this.voices.find(v => v.lang === 'en-IE' || v.lang.startsWith('en_IE')) ||
      // 2. British English Female (Libby, Sonia, Victoria, Fiona, Google UK)
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
      .replace(/\((?:(?:19|20)\d{2}|[A-Z][a-z]+(?:\s+et\s+al\.)?,\s*(?:19|20)\d{2})\)/g, '') // remove (Chen et al., 2024)
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
      const thaiVoice = this.getThaiFridayVoice();
      if (thaiVoice) this.currentUtterance.voice = thaiVoice;
      // F.R.I.D.A.Y. Thai Tone: Crisp, intelligent, clear pitch & calm cadence
      this.currentUtterance.pitch = 1.08;
      this.currentUtterance.rate = this.rate * 1.02;
    } else {
      this.currentUtterance.lang = 'en-GB';
      const fridayVoice = this.getEnglishFridayVoice();
      if (fridayVoice) this.currentUtterance.voice = fridayVoice;
      // F.R.I.D.A.Y. English Tone: Signature Marvel AI cadence
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
      console.warn('TTS Speech ended/cancelled:', e);
      this.isPlaying = false;
      this.isPaused = false;
      this.notify();
    };

    this.synth.speak(this.currentUtterance);
  }

  // Toggle speech: If already speaking this text -> STOP. Else -> SPEAK.
  toggleSpeak(text) {
    if (this.isPlaying && this.currentText === text.trim()) {
      this.stop();
      return false;
    } else {
      this.speak(text);
      return true;
    }
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
