/**
 * ThesisMind Intelligent Speech Synthesis (TTS) Engine - "F.R.I.D.A.Y." & Thai Tactical AI Assistant
 * Voice Persona: AI ผู้หญิง โทนใจเย็น สุขุม ฉลาด ชัดถ้อยชัดคำ และคอยประสานงานข้างหู
 * Features:
 * - Dual Language support (Thai & English) with auto-detection.
 * - Subdued, highly articulate, calm tactical AI co-pilot cadence.
 * - Subtle earphone comms link cue (Web Audio API).
 * - Instant togglePlay / Stop everywhere (Click to read, click again to stop, or press ESC).
 */

class TTSEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.audioCtx = null;
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

  // Play a soft, futuristic earphone link chime when AI starts speaking
  _playCommsCue() {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.audioCtx = new AudioContext();
      }
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);

      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (err) {
      // Audio context might be restricted, ignore silently
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
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

  getThaiAssistantVoice() {
    if (!this.voices.length) this._loadVoices();
    // Prioritize soothing, natural, ultra-intelligent Thai female voices (Premwadee / Natural / Online)
    return (
      this.voices.find(v => (v.lang.startsWith('th') || v.lang.includes('TH')) && (v.name.includes('Premwadee') || v.name.includes('Natural') || v.name.includes('Online'))) ||
      this.voices.find(v => (v.lang.startsWith('th') || v.lang.includes('TH')) && v.name.includes('Google')) ||
      this.voices.find(v => (v.lang.startsWith('th') || v.lang.includes('TH')) && (v.name.includes('Kanya') || v.name.includes('Narisa') || v.name.includes('Achara') || v.name.includes('Female'))) ||
      this.voices.find(v => v.lang.startsWith('th') || v.lang.includes('TH')) ||
      null
    );
  }

  getEnglishFridayVoice() {
    if (!this.voices.length) this._loadVoices();
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
      .replace(/https?:\/\/\S+/g, 'ลิงก์')
      .replace(/[*_#`~>]/g, '') // strip markdown
      .replace(/[-•]\s+/g, '. ') // turn bullet dashes into natural cadence pauses
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

    this._playCommsCue();

    this.currentText = text.trim();
    this.currentUtterance = new SpeechSynthesisUtterance(cleanText);

    const isThai = this.isThaiText(cleanText);

    if (isThai) {
      this.currentUtterance.lang = 'th-TH';
      const thaiVoice = this.getThaiAssistantVoice();
      if (thaiVoice) this.currentUtterance.voice = thaiVoice;
      
      // Tone: AI ผู้หญิงใจเย็น สุขุม ฉลาด ประสานงานข้างหู
      // Pitch: 1.0 (โทนเสียงสงบนิ่ง สบายหู)
      // Rate: 0.88 (จังหวะช้าลง นุ่มนวล ชัดถ้อยชัดคำ ไม่เร่งรีบ)
      this.currentUtterance.pitch = 1.0;
      this.currentUtterance.rate = this.rate * 0.88;
    } else {
      this.currentUtterance.lang = 'en-GB';
      const fridayVoice = this.getEnglishFridayVoice();
      if (fridayVoice) this.currentUtterance.voice = fridayVoice;
      
      // F.R.I.D.A.Y. English Tone
      this.currentUtterance.pitch = 1.05;
      this.currentUtterance.rate = this.rate * 1.0;
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
