/**
 * IndexedDB Database Service for ThesisMind
 * High-performance, offline-first client storage for papers, annotations, markups, and metadata.
 */

const DB_NAME = 'ThesisMindDB';
const DB_VERSION = 2; // Incremented for markups store

class DatabaseService {
  constructor() {
    this.db = null;
    this.initPromise = this._init();
  }

  _init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Folders store
        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('parentId', 'parentId', { unique: false });
        }

        // Files store
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('folderId', 'folderId', { unique: false });
          fileStore.createIndex('tags', 'tags', { multiEntry: true });
        }

        // Highlights store
        if (!db.objectStoreNames.contains('highlights')) {
          const hlStore = db.createObjectStore('highlights', { keyPath: 'id' });
          hlStore.createIndex('fileId', 'fileId', { unique: false });
          hlStore.createIndex('fileAndPage', ['fileId', 'pageNumber'], { unique: false });
        }

        // Side notes store
        if (!db.objectStoreNames.contains('sideNotes')) {
          const noteStore = db.createObjectStore('sideNotes', { keyPath: 'id' });
          noteStore.createIndex('fileId', 'fileId', { unique: false });
          noteStore.createIndex('highlightId', 'highlightId', { unique: false });
        }

        // Markups store (Text boxes, Images, Drawings, Shapes)
        if (!db.objectStoreNames.contains('markups')) {
          const markupStore = db.createObjectStore('markups', { keyPath: 'id' });
          markupStore.createIndex('fileId', 'fileId', { unique: false });
          markupStore.createIndex('fileAndPage', ['fileId', 'pageNumber'], { unique: false });
        }

        // Scratchpads store
        if (!db.objectStoreNames.contains('scratchpads')) {
          db.createObjectStore('scratchpads', { keyPath: 'fileId' });
        }

        // Metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'fileId' });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async ready() {
    await this.initPromise;
    return this.db;
  }

  async getAll(storeName) {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async get(storeName, key) {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, value) {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getByIndex(storeName, indexName, indexValue) {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(indexValue);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // Folders
  async getFolders() {
    return this.getAll('folders');
  }

  async saveFolder(folder) {
    folder.updatedAt = new Date().toISOString();
    return this.put('folders', folder);
  }

  async deleteFolderRecursive(folderId) {
    const allFolders = await this.getFolders();
    const childFolderIds = [folderId];
    
    const findChildren = (pid) => {
      for (const f of allFolders) {
        if (f.parentId === pid) {
          childFolderIds.push(f.id);
          findChildren(f.id);
        }
      }
    };
    findChildren(folderId);

    const allFiles = await this.getAll('files');
    const filesToDelete = allFiles.filter(f => childFolderIds.includes(f.folderId));

    for (const file of filesToDelete) {
      await this.deleteFileComplete(file.id);
    }

    for (const fid of childFolderIds) {
      await this.delete('folders', fid);
    }
  }

  // Files
  async getFiles(folderId = null) {
    if (folderId === null) {
      return this.getAll('files');
    }
    return this.getByIndex('files', 'folderId', folderId);
  }

  async saveFile(file) {
    file.updatedAt = new Date().toISOString();
    return this.put('files', file);
  }

  async deleteFileComplete(fileId) {
    await this.delete('files', fileId);
    await this.delete('scratchpads', fileId);
    await this.delete('metadata', fileId);

    const highlights = await this.getByIndex('highlights', 'fileId', fileId);
    for (const hl of highlights) {
      await this.delete('highlights', hl.id);
    }

    const notes = await this.getByIndex('sideNotes', 'fileId', fileId);
    for (const note of notes) {
      await this.delete('sideNotes', note.id);
    }

    const markups = await this.getByIndex('markups', 'fileId', fileId);
    for (const mk of markups) {
      await this.delete('markups', mk.id);
    }
  }

  // Highlights
  async getHighlights(fileId) {
    return this.getByIndex('highlights', 'fileId', fileId);
  }

  async saveHighlight(hl) {
    return this.put('highlights', hl);
  }

  async deleteHighlight(hlId) {
    const notes = await this.getByIndex('sideNotes', 'highlightId', hlId);
    for (const n of notes) {
      await this.delete('sideNotes', n.id);
    }
    return this.delete('highlights', hlId);
  }

  // Side Notes
  async getSideNotes(fileId) {
    return this.getByIndex('sideNotes', 'fileId', fileId);
  }

  async saveSideNote(note) {
    note.updatedAt = new Date().toISOString();
    return this.put('sideNotes', note);
  }

  async deleteSideNote(noteId) {
    return this.delete('sideNotes', noteId);
  }

  // Markups (Text boxes, Images, Drawings, Shapes)
  async getMarkups(fileId) {
    return this.getByIndex('markups', 'fileId', fileId);
  }

  async saveMarkup(markup) {
    markup.updatedAt = new Date().toISOString();
    return this.put('markups', markup);
  }

  async deleteMarkup(markupId) {
    return this.delete('markups', markupId);
  }

  // Scratchpads
  async getScratchpad(fileId) {
    const res = await this.get('scratchpads', fileId);
    return res ? res.markdownContent : '';
  }

  async saveScratchpad(fileId, markdownContent) {
    return this.put('scratchpads', {
      fileId,
      markdownContent,
      updatedAt: new Date().toISOString()
    });
  }

  // Metadata
  async getMetadata(fileId) {
    return this.get('metadata', fileId);
  }

  async saveMetadata(metadata) {
    metadata.updatedAt = new Date().toISOString();
    return this.put('metadata', metadata);
  }

  // Settings
  async getSetting(key, defaultValue = null) {
    const item = await this.get('settings', key);
    return item ? item.value : defaultValue;
  }

  async saveSetting(key, value) {
    return this.put('settings', { key, value });
  }
}

export const db = new DatabaseService();
