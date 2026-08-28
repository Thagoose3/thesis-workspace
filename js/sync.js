/**
 * Cross-Device Cloud Sync Engine using Firebase Cloud Firestore
 * Features:
 * - Bi-directional syncing between local IndexedDB and Cloud Firestore
 * - ArrayBuffer to Base64 serialization for PDF documents
 * - Auto sync upon Google login and manual "Sync Now" trigger
 * - Live sync status indicator for the UI
 */

import { firebaseService } from './firebase.js';
import { db } from './db.js';
import { 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  collection, 
  writeBatch 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Helpers for binary PDF conversion
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

class CloudSyncManager {
  constructor() {
    this.status = 'idle'; // 'idle' | 'syncing' | 'synced' | 'error'
    this.lastSyncedAt = null;
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
      isSyncing: this.syncInProgress
    });
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = {
      status: this.status,
      lastSyncedAt: this.lastSyncedAt,
      isSyncing: this.syncInProgress
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
    this.notify();

    try {
      const uid = user.uid;

      // 1. Sync Folders
      await this._syncCollection(uid, 'folders', () => db.getFolders(), (item) => db.saveFolder(item));

      // 2. Sync Papers (including PDF Data)
      await this._syncPapers(uid);

      // 3. Sync Highlights
      await this._syncCollection(uid, 'highlights', () => db.getAllHighlights(), (item) => db.saveHighlight(item));

      // 4. Sync Markups
      await this._syncCollection(uid, 'markups', () => db.getAllMarkups(), (item) => db.saveMarkup(item));

      // 5. Sync SideNotes
      await this._syncCollection(uid, 'notes', () => db.getAllSideNotes(), (item) => db.saveSideNote(item));

      this.status = 'synced';
      this.lastSyncedAt = new Date();
    } catch (err) {
      console.error('Cloud Sync Error:', err);
      this.status = 'error';
    } finally {
      this.syncInProgress = false;
      this.notify();
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

  // Paper sync with ArrayBuffer binary serialization
  async _syncPapers(uid) {
    const firestore = firebaseService.db;
    const colRef = collection(firestore, `users/${uid}/papers`);

    const snapshot = await getDocs(colRef);
    const remoteDocs = new Map();
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.pdfDataBase64) {
        data.pdfData = base64ToArrayBuffer(data.pdfDataBase64);
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
        if (payload.pdfData instanceof ArrayBuffer) {
          payload.pdfDataBase64 = arrayBufferToBase64(payload.pdfData);
          delete payload.pdfData;
        }
        await setDoc(doc(firestore, `users/${uid}/papers`, id), payload);
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
        payload.pdfDataBase64 = arrayBufferToBase64(payload.pdfData);
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
