/**
 * Firebase App Initialization & Authentication Engine
 * Features:
 * - Google Account Sign-In (Firebase Auth popup)
 * - Cloud Firestore instance
 * - LocalStorage Config Persistence with Interactive Setup Modal
 */

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
  getFirestore 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const STORAGE_KEY_FIREBASE_CONFIG = 'thesismind_firebase_config';

class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.currentUser = null;
    this.authListeners = new Set();
    this.isConfigured = false;

    this.init();
  }

  getSavedConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FIREBASE_CONFIG);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Failed to parse saved Firebase config:', e);
      return null;
    }
  }

  saveConfig(configObj) {
    if (!configObj || typeof configObj !== 'object') return false;
    localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, JSON.stringify(configObj));
    return this.init(configObj);
  }

  init(customConfig = null) {
    const config = customConfig || this.getSavedConfig();

    if (!config || !config.apiKey || !config.projectId) {
      this.isConfigured = false;
      return false;
    }

    try {
      if (getApps().length === 0) {
        this.app = initializeApp(config);
      } else {
        this.app = getApp();
      }

      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      this.isConfigured = true;

      onAuthStateChanged(this.auth, (user) => {
        this.currentUser = user;
        this.notifyAuthListeners(user);
      });

      return true;
    } catch (err) {
      console.error('Firebase initialization error:', err);
      this.isConfigured = false;
      return false;
    }
  }

  subscribeAuth(listener) {
    this.authListeners.add(listener);
    // Initial call
    listener(this.currentUser, this.isConfigured);
    return () => this.authListeners.delete(listener);
  }

  notifyAuthListeners(user) {
    for (const listener of this.authListeners) {
      listener(user, this.isConfigured);
    }
  }

  async signInWithGoogle() {
    if (!this.isConfigured || !this.auth) {
      throw new Error('CONFIG_REQUIRED');
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(this.auth, provider);
      this.currentUser = result.user;
      return result.user;
    } catch (error) {
      console.error('Google Sign-in Error:', error);
      throw error;
    }
  }

  async signOut() {
    if (this.auth) {
      await signOut(this.auth);
      this.currentUser = null;
    }
  }
}

export const firebaseService = new FirebaseService();
