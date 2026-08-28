/**
 * Cross-Device Cloud Sync Engine using Firebase Cloud Firestore for PaperVault
 * Features:
 * - Resilient Bi-directional sync between local IndexedDB and Cloud Firestore
 * - Safe document size thresholding (Firestore 1MB limit protection)
 * - Granular per-item error isolation so large files never break notes/highlights sync
 * - Clear diagnostics and helpful error feedback for Firestore security rules
 */

import { firebaseService } from './firebase.js';
import { db } from './db.js';
import { 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  collection 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const MAX_FIRESTORE_BLOB_SIZE = 700 * 1024; // 700 KB safe limit for 1MB Firestore document

// Helpers for binary PDF conversion
function arrayBufferToBase64(buffer) {
  try {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } catch (e) {
    console.warn('Failed to convert ArrayBuffer to Base64:', e);
    return null;
  }
}

function base64ToArrayBuffer(base64) {
  try {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    console.warn('Failed to convert Base64 to ArrayBuffer:', e);
    return null;
  }
}

class CloudSyncManager {
  constructor() {
    this.status = 'idle'; // 'idle' | 'syncing' | 'synced' | 'error'
    this.lastSyncedAt = null;
    this.lastErrorMessage = null;
    this.listeners = new Set();
    this.syncInProgress = false;

    // Auto-sync when user signs in
    firebaseService.subscribeAuth((user) => {
      if (user) {
        this.syncAll();
      } else {
        this.status = 'idle';
        this.notify();
      }
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener({
      status: this.status,
      lastSyncedAt: this.lastSyncedAt,
      isSyncing: this.syncInProgress,
      errorMessage: this.lastErrorMessage
    });
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = {
      status: this.status,
      lastSyncedAt: this.lastSyncedAt,
      isSyncing: this.syncInProgress,
      errorMessage: this.lastErrorMessage
    };
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  async syncAll() {
    const user = firebaseService.currentUser;
    const firestore = firebaseService.db;

    if (!user || !firestore) {
      this.status = 'idle';
      this.notify();
      return;
    }

    if (this.syncInProgress) return;
    this.syncInProgress = true;
    this.status = 'syncing';
    this.lastErrorMessage = null;
    this.notify();

    let hadErrors = false;
    const uid = user.uid;

    try {
      // 1. Sync Folders
      try {
        await this._syncCollection(uid, 'folders', () => db.getFolders(), (item) => db.saveFolder(item));
      } catch (err) {
        console.warn('Folders sync warning:', err);
        hadErrors = true;
        this._handleSyncError(err);
      }

      // 2. Sync Highlights
      try {
        await this._syncCollection(uid, 'highlights', () => db.getAllHighlights(), (item) => db.saveHighlight(item));
      } catch (err) {
        console.warn('Highlights sync warning:', err);
        hadErrors = true;
        this._handleSyncError(err);
      }

      // 3. Sync Markups
      try {
        await this._syncCollection(uid, 'markups', () => db.getAllMarkups(), (item) => db.saveMarkup(item));
      } catch (err) {
        console.warn('Markups sync warning:', err);
        hadErrors = true;
        this._handleSyncError(err);
      }

      // 4. Sync SideNotes
      try {
        await this._syncCollection(uid, 'notes', () => db.getAllSideNotes(), (item) => db.saveSideNote(item));
      } catch (err) {
        console.warn('Notes sync warning:', err);
        hadErrors = true;
        this._handleSyncError(err);
      }

      // 5. Sync Papers (Metadata + safe size payloads)
      try {
        await this._syncPapers(uid);
      } catch (err) {
        console.warn('Papers sync warning:', err);
        hadErrors = true;
        this._handleSyncError(err);
      }

      if (!hadErrors) {
        this.status = 'synced';
        this.lastSyncedAt = new Date();
        this.lastErrorMessage = null;
      } else {
        this.status = 'error';
      }
    } catch (err) {
      console.error('Fatal Cloud Sync Error:', err);
      this.status = 'error';
      this._handleSyncError(err);
    } finally {
      this.syncInProgress = false;
      this.notify();
    }
  }

  _handleSyncError(err) {
    if (err && (err.code === 'permission-denied' || err.message?.includes('permission'))) {
      this.lastErrorMessage = 'Firestore permission denied. Please create Firestore Database in Firebase Console and set rules to allow read/write.';
    } else if (err && err.message?.includes('size')) {
      this.lastErrorMessage = 'Some documents exceeded Firestore size limit.';
    } else {
      this.lastErrorMessage = err?.message || 'Sync error occurred';
    }
  }

  // Generic collection synchronization
  async _syncCollection(uid, colName, localGetter, localSaver) {
    const firestore = firebaseService.db;
    const colRef = collection(firestore, `users/${uid}/${colName}`);
    
    // 1. Pull from Firestore
    const snapshot = await getDocs(colRef);
    const remoteDocs = new Map();
    snapshot.forEach(docSnap => {
      remoteDocs.set(docSnap.id, docSnap.data());
    });

    // 2. Pull local items
    const localItems = await localGetter();
    const localDocs = new Map();
    localItems.forEach(item => {
      localDocs.set(item.id, item);
    });

    // Merge remote to local
    for (const [id, remoteItem] of remoteDocs.entries()) {
      const localItem = localDocs.get(id);
      if (!localItem || (remoteItem.updatedAt && (!localItem.updatedAt || new Date(remoteItem.updatedAt) > new Date(localItem.updatedAt)))) {
        await localSaver(remoteItem);
      }
    }

    // Push local to remote
    for (const [id, localItem] of localDocs.entries()) {
      const remoteItem = remoteDocs.get(id);
      if (!remoteItem || (localItem.updatedAt && (!remoteItem.updatedAt || new Date(localItem.updatedAt) > new Date(remoteItem.updatedAt)))) {
        await setDoc(doc(firestore, `users/${uid}/${colName}`, id), JSON.parse(JSON.stringify(localItem)));
      }
    }
  }

  // Paper sync with 1MB Firestore size protection
  async _syncPapers(uid) {
    const firestore = firebaseService.db;
    const colRef = collection(firestore, `users/${uid}/papers`);

    const snapshot = await getDocs(colRef);
    const remoteDocs = new Map();
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.pdfDataBase64) {
        const buffer = base64ToArrayBuffer(data.pdfDataBase64);
        if (buffer) data.pdfData = buffer;
        delete data.pdfDataBase64;
      }
      remoteDocs.set(docSnap.id, data);
    });

    const localPapers = await db.getPapers();
    const localDocs = new Map();
    localPapers.forEach(paper => localDocs.set(paper.id, paper));

    // Save remote papers locally
    for (const [id, remotePaper] of remoteDocs.entries()) {
      const localPaper = localDocs.get(id);
      if (!localPaper) {
        await db.savePaper(remotePaper);
      }
    }

    // Push local papers to Firestore
    for (const [id, localPaper] of localDocs.entries()) {
      const remotePaper = remoteDocs.get(id);
      if (!remotePaper) {
        const payload = { ...localPaper };
        const byteLength = payload.pdfData instanceof ArrayBuffer 
          ? payload.pdfData.byteLength 
          : (typeof payload.pdfData === 'string' ? payload.pdfData.length : 0);

        if (payload.pdfData instanceof ArrayBuffer) {
          if (byteLength <= MAX_FIRESTORE_BLOB_SIZE) {
            payload.pdfDataBase64 = arrayBufferToBase64(payload.pdfData);
          } else {
            payload.isLargeFileStoredLocally = true;
          }
          delete payload.pdfData;
        }

        try {
          await setDoc(doc(firestore, `users/${uid}/papers`, id), payload);
        } catch (itemErr) {
          console.warn(`Could not sync paper ${id} to cloud:`, itemErr);
        }
      }
    }
  }

  // Single item push to cloud
  async pushItem(type, item) {
    const user = firebaseService.currentUser;
    const firestore = firebaseService.db;
    if (!user || !firestore || !item || !item.id) return;

    try {
      const uid = user.uid;
      const colName = type.endsWith('s') ? type : `${type}s`;
      const payload = { ...item, updatedAt: new Date().toISOString() };

      if (type === 'paper' && payload.pdfData instanceof ArrayBuffer) {
        const byteLength = payload.pdfData.byteLength;
        if (byteLength <= MAX_FIRESTORE_BLOB_SIZE) {
          payload.pdfDataBase64 = arrayBufferToBase64(payload.pdfData);
        } else {
          payload.isLargeFileStoredLocally = true;
        }
        delete payload.pdfData;
      }

      await setDoc(doc(firestore, `users/${uid}/${colName}`, item.id), JSON.parse(JSON.stringify(payload)));
      this.lastSyncedAt = new Date();
      this.status = 'synced';
      this.notify();
    } catch (e) {
      console.warn('Failed to push item to cloud:', e);
    }
  }

  async deleteItem(type, itemId) {
    const user = firebaseService.currentUser;
    const firestore = firebaseService.db;
    if (!user || !firestore || !itemId) return;

    try {
      const uid = user.uid;
      const colName = type.endsWith('s') ? type : `${type}s`;
      await deleteDoc(doc(firestore, `users/${uid}/${colName}`, itemId));
    } catch (e) {
      console.warn('Failed to delete item from cloud:', e);
    }
  }
}

export const syncManager = new CloudSyncManager();
