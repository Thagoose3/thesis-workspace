/**
 * Firebase App Initialization & Authentication Engine for PaperVault
 * Connected Project: papervault-61ba0
 * Features:
 * - Google Account Sign-In (Firebase Auth popup)
 * - Cloud Firestore cross-device sync
 * - Ready out-of-the-box with pre-configured project credentials
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

const STORAGE_KEY_FIREBASE_CONFIG = 'papervault_firebase_config';

// Default pre-configured Firebase project for PaperVault
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyA8iKTyMKo13XS921r9xJDiUDQwTYZmLbg",
  authDomain: "papervault-61ba0.firebaseapp.com",
  projectId: "papervault-61ba0",
  storageBucket: "papervault-61ba0.firebasestorage.app",
  messagingSenderId: "1028823295239",
  appId: "1:1028823295239:web:e2488035dbdfb982c751a2",
  measurementId: "G-84X5TVYT7Z"
};

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
      return raw ? JSON.parse(raw) : DEFAULT_FIREBASE_CONFIG;
    } catch (e) {
      console.warn('Failed to parse saved Firebase config, using default:', e);
      return DEFAULT_FIREBASE_CONFIG;
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
