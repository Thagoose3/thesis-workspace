/**
 * Ultra-Minimalist File Explorer & Document Tree for ThesisMind
 * Features:
 * - Back Button & ".." Parent Navigation (ปุ่มย้อนกลับจากการเข้าโฟลเดอร์)
 * - Native Drag & Drop Moving (ลากไฟล์เปเปอร์ไปวางใส่โฟลเดอร์/ปุ่มย้อนกลับได้ทันที)
 * - Recent / Active Reading List with 1-click Close
 * - Subfolders, Breadcrumbs, Tags, Rename, Delete, Hide/Archive.
 */

import { db } from './db.js';
import { createFolder, createPaperFile, createPaperMetadata } from './models.js';

export class FileExplorer {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options;
    this.currentFolderId = null;
    this.activeTag = null;
    this.folders = [];
    this.files = [];
    this.recentFileIds = [];
    this.selectedFileId = null;
    this.showHidden = false;
    this.draggedFileId = null;
    
    this.onFileSelect = options.onFileSelect || (() => {});
    this.onFileClose = options.onFileClose || (() => {});
    this.onFolderChange = options.onFolderChange || (() => {});
    this.onOpenMatrix = options.onOpenMatrix || (() => {});
    this.onExportFolder = options.onExportFolder || (() => {});
    this.onShowToast = options.onShowToast || ((msg) => console.log(msg));

    this._loadRecentFromStorage();
  }

  _loadRecentFromStorage() {
    try {
      const stored = localStorage.getItem('thesismind_recent_files');
      if (stored) {
        this.recentFileIds = JSON.parse(stored);
      }
    } catch (e) {
      this.recentFileIds = [];
    }
  }

  _saveRecentToStorage() {
    try {
      localStorage.setItem('thesismind_recent_files', JSON.stringify(this.recentFileIds));
    } catch (e) {}
  }

  addToRecent(fileId) {
    if (!fileId) return;
    this.recentFileIds = [fileId, ...this.recentFileIds.filter(id => id !== fileId)].slice(0, 10);
    this._saveRecentToStorage();
    this.render();
  }

  removeFromRecent(fileId) {
    this.recentFileIds = this.recentFileIds.filter(id => id !== fileId);
    this._saveRecentToStorage();
    if (this.selectedFileId === fileId) {
      this.selectedFileId = null;
      this.onFileClose();
    }
    this.render();
  }

  async init() {
    await this.refresh();
  }

  async refresh() {
    this.folders = await db.getFolders();
    this.files = await db.getAll('files');
    this.render();
  }

  setCurrentFolder(folderId) {
    this.currentFolderId = folderId;
    this.activeTag = null;
    this.onFolderChange(folderId);
    this.render();
  }

  goBackToParent() {
    if (!this.currentFolderId) return;
    const curFolder = this.folders.find(f => f.id === this.currentFolderId);
    const parentId = curFolder ? curFolder.parentId : null;
    this.setCurrentFolder(parentId);
  }

  setTagFilter(tag) {
    this.activeTag = this.activeTag === tag ? null : tag;
    this.render();
  }

  getBreadcrumbPath(folderId) {
    const path = [];
    let curId = folderId;
    while (curId) {
      const folder = this.folders.find(f => f.id === curId);
      if (!folder) break;
      path.unshift(folder);
      curId = folder.parentId;
    }
    return path;
  }

  getAllTags() {
    const tagsSet = new Set();
    this.files.forEach(f => {
      if (!f.isHidden && Array.isArray(f.tags)) {
        f.tags.forEach(t => tagsSet.add(t));
      }
    });
    return Array.from(tagsSet);
  }

  getFilteredFiles() {
    let list = this.files;
    
    if (this.activeTag) {
      list = list.filter(f => f.tags && f.tags.includes(this.activeTag));
    } else if (this.currentFolderId !== null) {
      list = list.filter(f => f.folderId === this.currentFolderId);
    } else {
      list = list.filter(f => f.folderId === null);
    }

    if (!this.showHidden) {
      list = list.filter(f => !f.isHidden);
    }

    return list;
  }

  getCurrentFolderChildren() {
    return this.folders.filter(f => f.parentId === this.currentFolderId);
  }

  getHiddenCount() {
    if (this.activeTag) {
      return this.files.filter(f => f.isHidden && f.tags && f.tags.includes(this.activeTag)).length;
    }
    return this.files.filter(f => f.isHidden && f.folderId === this.currentFolderId).length;
  }

  getRecentFiles() {
    return this.recentFileIds
      .map(id => this.files.find(f => f.id === id))
      .filter(Boolean);
  }

  render() {
    const breadcrumbPath = this.getBreadcrumbPath(this.currentFolderId);
    const subfolders = this.getCurrentFolderChildren();
    const folderFiles = this.getFilteredFiles();
    const recentFiles = this.getRecentFiles();
    const allTags = this.getAllTags();
    const hiddenCount = this.getHiddenCount();

    const curFolder = this.folders.find(f => f.id === this.currentFolderId);
    const folderLabel = curFolder ? curFolder.name : 'Root';
    const isInsideFolder = this.currentFolderId !== null;
    const parentFolderId = curFolder ? curFolder.parentId : null;

    this.container.innerHTML = `
      <div class="h-full flex flex-col bg-zinc-900 text-zinc-300 border-r border-white/[0.06] select-none">
        
        <!-- Top Header: Title + Actions -->
        <div class="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
          <span class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Explorer</span>

          <div class="flex items-center space-x-0.5">
            <button id="btn-new-folder" class="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition" title="New Folder">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path></svg>
            </button>
            <button id="btn-upload-paper" class="p-1 rounded-md text-blue-400 hover:text-blue-300 hover:bg-white/[0.06] transition" title="Upload PDF">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            </button>
          </div>
        </div>

        <!-- Breadcrumb & Back Navigation Bar -->
        <div class="px-2.5 py-1.5 border-b border-white/[0.04] bg-zinc-950/50 flex items-center space-x-1.5 text-[11px] overflow-x-auto whitespace-nowrap">
          ${isInsideFolder ? `
            <button id="btn-folder-back" class="px-1.5 py-0.5 rounded-md bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 transition flex items-center space-x-1 font-medium flex-shrink-0" title="Back to previous folder (ย้อนกลับ)">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
              <span>Back</span>
            </button>
          ` : ''}

          <div class="flex items-center space-x-1 overflow-x-auto">
            <button class="btn-breadcrumb text-zinc-500 hover:text-zinc-300 transition font-medium px-1 rounded hover:bg-white/[0.04]" data-folder-id="root">
              Root
            </button>
            ${breadcrumbPath.map(f => `
              <span class="text-zinc-700">/</span>
              <button class="btn-breadcrumb font-medium transition truncate max-w-[90px] px-1 rounded ${f.id === this.currentFolderId ? 'text-blue-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}" data-folder-id="${f.id}">
                ${f.name}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Tag Pills -->
        ${allTags.length > 0 ? `
          <div class="px-3 py-1.5 border-b border-white/[0.04] flex items-center space-x-1 overflow-x-auto text-[10px]">
            ${allTags.map(tag => `
              <button class="btn-tag px-2 py-0.5 rounded-md transition ${this.activeTag === tag ? 'bg-blue-500/20 text-blue-300 font-medium' : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08]'}" data-tag="${tag}">
                #${tag}
              </button>
            `).join('')}
          </div>
        ` : ''}

        <!-- Main Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-2 space-y-3.5" id="drop-zone">
          
          <!-- Section 1: Recent / Opened Papers -->
          ${recentFiles.length > 0 ? `
            <div class="space-y-1">
              <div class="text-[9px] font-mono text-zinc-500 uppercase px-1.5 flex items-center justify-between">
                <span>Recent (${recentFiles.length})</span>
                <span class="text-[8px] text-zinc-600">Active</span>
              </div>

              <div class="space-y-0.5">
                ${recentFiles.map(file => {
                  const isSelected = file.id === this.selectedFileId;
                  return `
                    <div class="group px-2 py-1.5 rounded-xl transition cursor-pointer file-item ${isSelected ? 'bg-blue-600/20 text-zinc-100 ring-1 ring-blue-500/40' : 'hover:bg-white/[0.04] text-zinc-300'}" draggable="true" data-file-id="${file.id}">
                      <div class="flex items-center justify-between space-x-1.5">
                        <div class="flex items-center space-x-1.5 min-w-0 flex-1">
                          <svg class="w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-zinc-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                          <p class="text-xs truncate ${isSelected ? 'text-blue-200 font-medium' : 'text-zinc-200'}">${file.name}</p>
                        </div>

                        <button class="p-1 hover:bg-white/[0.08] rounded text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition btn-close-recent" data-file-id="${file.id}" title="Close / Remove from Recent">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Section 2: Folders (Drag Targets & Parent ".." row) -->
          <div class="space-y-0.5">
            <div class="text-[9px] font-mono text-zinc-500 uppercase px-1.5 mb-1 flex items-center justify-between">
              <span>Folders</span>
              <span class="text-[8px] text-zinc-600">Drag papers here</span>
            </div>

            <div class="space-y-0.5">
              <!-- Up/Parent folder item if inside subfolder -->
              ${isInsideFolder ? `
                <div class="group flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-blue-600/10 text-blue-400 hover:text-blue-300 transition cursor-pointer folder-item-parent" data-folder-id="${parentFolderId || 'root'}">
                  <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
                  <span class="text-xs font-medium truncate">.. (Up to ${parentFolderId ? 'Parent' : 'Root'})</span>
                </div>
              ` : ''}

              ${subfolders.length === 0 && !this.activeTag && !isInsideFolder ? `
                <p class="text-[10px] text-zinc-600 px-2 italic">No subfolders</p>
              ` : ''}

              ${subfolders.map(f => `
                <div class="group flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition cursor-pointer folder-item" data-folder-id="${f.id}">
                  <div class="flex items-center space-x-2 min-w-0 flex-1">
                    <svg class="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400/90 flex-shrink-0 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                    <span class="text-xs text-zinc-300 group-hover:text-zinc-100 truncate transition">${f.name}</span>
                  </div>
                  <div class="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 transition">
                    <button class="p-0.5 hover:bg-white/[0.08] rounded text-zinc-500 hover:text-zinc-200 btn-rename-folder" data-folder-id="${f.id}" title="Rename">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button class="p-0.5 hover:bg-rose-900/40 rounded text-zinc-500 hover:text-rose-400 btn-delete-folder" data-folder-id="${f.id}" title="Delete">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Section 3: Papers in Current Folder (Draggable) -->
          <div class="space-y-0.5">
            <div class="text-[9px] font-mono text-zinc-500 uppercase px-1.5 mb-1 flex items-center justify-between">
              <span>In ${folderLabel} (${folderFiles.length})</span>
            </div>

            ${folderFiles.length === 0 ? `
              <div class="p-5 text-center border border-dashed border-white/[0.08] rounded-xl bg-zinc-950/20 text-zinc-500">
                <p class="text-[11px] text-zinc-400">No papers in this folder</p>
                <p class="text-[10px] text-zinc-600 mt-0.5">Drop PDF to upload or drag papers into folders</p>
              </div>
            ` : `
              <div class="space-y-1">
                ${folderFiles.map(file => {
                  const isSelected = file.id === this.selectedFileId;
                  const isFileHidden = Boolean(file.isHidden);

                  return `
                    <div class="group px-2.5 py-2 rounded-xl transition cursor-grab file-item ${isSelected ? 'bg-blue-600/15 text-zinc-100 ring-1 ring-blue-500/40' : 'hover:bg-white/[0.04] text-zinc-300'} ${isFileHidden ? 'opacity-50' : ''}" draggable="true" data-file-id="${file.id}">
                      <div class="flex items-start justify-between space-x-2">
                        <div class="flex items-start space-x-2 min-w-0 flex-1">
                          <svg class="w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-zinc-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center space-x-1.5">
                              <p class="text-xs font-medium truncate ${isSelected ? 'text-blue-200' : 'text-zinc-200 group-hover:text-zinc-100'}">${file.name}</p>
                              ${isFileHidden ? `<span class="px-1 py-0.2 rounded bg-zinc-800 text-[9px] font-mono text-zinc-400">hidden</span>` : ''}
                            </div>
                            <div class="flex items-center space-x-1.5 mt-0.5 text-[10px] text-zinc-500">
                              <span>${file.pageCount || 1}p</span>
                              <span>·</span>
                              <span>${(file.size / 1024).toFixed(0)}kb</span>
                            </div>
                          </div>
                        </div>

                        <!-- Actions -->
                        <div class="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 transition">
                          ${isSelected ? `
                            <button class="p-1 hover:bg-white/[0.08] rounded text-zinc-400 hover:text-zinc-200 btn-close-file" data-file-id="${file.id}" title="Close Document (ปิดหน้านี้)">
                              <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                          ` : ''}

                          <button class="p-1 hover:bg-white/[0.08] rounded text-zinc-400 hover:text-zinc-200 btn-rename-file" data-file-id="${file.id}" title="Rename">
                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                          </button>

                          ${isFileHidden ? `
                            <button class="p-1 hover:bg-emerald-950/40 rounded text-emerald-400 hover:text-emerald-300 btn-unhide-file" data-file-id="${file.id}" title="Show back in sidebar">
                              <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                            </button>
                          ` : `
                            <button class="p-1 hover:bg-amber-950/40 rounded text-zinc-400 hover:text-amber-400 btn-hide-file" data-file-id="${file.id}" title="Hide from sidebar">
                              <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
                            </button>
                          `}

                          <button class="p-1 hover:bg-rose-900/40 rounded text-zinc-400 hover:text-rose-400 btn-delete-file" data-file-id="${file.id}" title="Delete Permanently">
                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}

            <!-- Hidden Files Drawer Toggle -->
            ${hiddenCount > 0 ? `
              <div class="pt-2 px-1 flex items-center justify-between text-[10px] text-zinc-500 font-mono border-t border-white/[0.04]">
                <span>Hidden (${hiddenCount})</span>
                <button id="btn-toggle-hidden" class="text-blue-400 hover:text-blue-300 underline font-sans transition">
                  ${this.showHidden ? 'Hide' : 'Show'}
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        <input type="file" id="file-input" accept="application/pdf" class="hidden" multiple />
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // Back Button in breadcrumbs
    this.container.querySelector('#btn-folder-back')?.addEventListener('click', () => {
      this.goBackToParent();
    });

    // Parent ".." item click & drop target
    const parentFolderEl = this.container.querySelector('.folder-item-parent');
    if (parentFolderEl) {
      const parentIdAttr = parentFolderEl.getAttribute('data-folder-id');
      const targetParentId = parentIdAttr === 'root' ? null : parentIdAttr;

      parentFolderEl.addEventListener('click', () => {
        this.setCurrentFolder(targetParentId);
      });

      parentFolderEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        parentFolderEl.classList.add('drag-over');
      });
      parentFolderEl.addEventListener('dragleave', () => {
        parentFolderEl.classList.remove('drag-over');
      });
      parentFolderEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        parentFolderEl.classList.remove('drag-over');
        const fileId = e.dataTransfer.getData('text/plain');
        if (fileId) {
          await this._moveFileToFolder(fileId, targetParentId);
        }
      });
    }

    // Breadcrumbs click & drop target
    this.container.querySelectorAll('.btn-breadcrumb').forEach(btn => {
      const fId = btn.getAttribute('data-folder-id');
      const targetFolderId = fId === 'root' ? null : fId;

      btn.addEventListener('click', () => {
        this.setCurrentFolder(targetFolderId);
      });

      btn.addEventListener('dragover', (e) => {
        e.preventDefault();
        btn.classList.add('drag-over');
      });
      btn.addEventListener('dragleave', () => {
        btn.classList.remove('drag-over');
      });
      btn.addEventListener('drop', async (e) => {
        e.preventDefault();
        btn.classList.remove('drag-over');
        const fileId = e.dataTransfer.getData('text/plain');
        if (fileId) {
          await this._moveFileToFolder(fileId, targetFolderId);
        }
      });
    });

    // Tag filtering
    this.container.querySelectorAll('.btn-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag');
        this.setTagFilter(tag);
      });
    });

    // Subfolders click & Drag-over / Drop target
    this.container.querySelectorAll('.folder-item').forEach(el => {
      const fId = el.getAttribute('data-folder-id');

      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.setCurrentFolder(fId);
      });

      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', () => {
        el.classList.remove('drag-over');
      });
      el.addEventListener('drop', async (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const fileId = e.dataTransfer.getData('text/plain');
        if (fileId) {
          await this._moveFileToFolder(fileId, fId);
        }
      });
    });

    // Draggable File Items (Drag & Drop moving)
    this.container.querySelectorAll('.file-item').forEach(el => {
      const fileId = el.getAttribute('data-file-id');

      el.addEventListener('dragstart', (e) => {
        this.draggedFileId = fileId;
        e.dataTransfer.setData('text/plain', fileId);
        el.classList.add('dragging');
      });

      el.addEventListener('dragend', () => {
        this.draggedFileId = null;
        el.classList.remove('dragging');
      });

      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.selectedFileId = fileId;
        const file = this.files.find(f => f.id === fileId);
        if (file) {
          this.addToRecent(file.id);
          this.onFileSelect(file);
          this.render();
        }
      });
    });

    // Close / Remove from Recent
    this.container.querySelectorAll('.btn-close-recent').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fileId = btn.getAttribute('data-file-id');
        this.removeFromRecent(fileId);
        this.onShowToast('Removed from recent');
      });
    });

    // Close Active Paper
    this.container.querySelectorAll('.btn-close-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedFileId = null;
        this.onFileClose();
        this.render();
      });
    });

    // Hide file from sidebar
    this.container.querySelectorAll('.btn-hide-file').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fileId = btn.getAttribute('data-file-id');
        const file = this.files.find(f => f.id === fileId);
        if (file) {
          file.isHidden = true;
          await db.saveFile(file);
          this.onShowToast(`Removed "${file.name}" from sidebar (still in folder)`);
          await this.refresh();
        }
      });
    });

    // Unhide / Restore file to sidebar
    this.container.querySelectorAll('.btn-unhide-file').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fileId = btn.getAttribute('data-file-id');
        const file = this.files.find(f => f.id === fileId);
        if (file) {
          file.isHidden = false;
          await db.saveFile(file);
          this.onShowToast(`Restored "${file.name}" to sidebar`);
          await this.refresh();
        }
      });
    });

    // Toggle show/hide hidden papers
    this.container.querySelector('#btn-toggle-hidden')?.addEventListener('click', () => {
      this.showHidden = !this.showHidden;
      this.render();
    });

    // New Folder Button
    const newFolderBtn = this.container.querySelector('#btn-new-folder');
    if (newFolderBtn) {
      newFolderBtn.addEventListener('click', () => this.promptNewFolder());
    }

    // Rename Folder
    this.container.querySelectorAll('.btn-rename-folder').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fId = btn.getAttribute('data-folder-id');
        this.promptRenameFolder(fId);
      });
    });

    // Delete Folder
    this.container.querySelectorAll('.btn-delete-folder').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fId = btn.getAttribute('data-folder-id');
        this.promptDeleteFolder(fId);
      });
    });

    // Rename File
    this.container.querySelectorAll('.btn-rename-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fileId = btn.getAttribute('data-file-id');
        this.promptRenameFile(fileId);
      });
    });

    // Delete File
    this.container.querySelectorAll('.btn-delete-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fileId = btn.getAttribute('data-file-id');
        this.promptDeleteFile(fileId);
      });
    });

    // Upload triggers
    const uploadBtn = this.container.querySelector('#btn-upload-paper');
    const fileInput = this.container.querySelector('#file-input');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this._handleFileInput(e));
    }

    // Drag & drop file uploads from OS
    const dropZone = this.container.querySelector('#drop-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('bg-blue-950/20');
      });
      dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-blue-950/20');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-blue-950/20');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this._processUploadedFiles(e.dataTransfer.files);
        }
      });
    }
  }

  async _moveFileToFolder(fileId, targetFolderId) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;

    if (file.folderId === targetFolderId) return;

    file.folderId = targetFolderId;
    await db.saveFile(file);

    const targetFolder = this.folders.find(f => f.id === targetFolderId);
    const destName = targetFolder ? `📁 ${targetFolder.name}` : '📁 Root';
    this.onShowToast(`Moved "${file.name}" to ${destName}`);
    await this.refresh();
  }

  async _handleFileInput(e) {
    if (e.target.files && e.target.files.length > 0) {
      await this._processUploadedFiles(e.target.files);
    }
  }

  async _processUploadedFiles(fileList) {
    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;

    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        alert(`File "${file.name}" is not a PDF.`);
        continue;
      }

      const arrayBuffer = await file.arrayBuffer();
      let pageCount = 1;
      try {
        if (pdfjsLib) {
          const doc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
          pageCount = doc.numPages;
        }
      } catch (err) {
        console.warn('Could not read page count:', err);
      }

      const defaultTags = [];
      const cleanName = file.name.replace(/\.pdf$/i, '');
      if (/cloud/i.test(cleanName)) defaultTags.push('CloudSecurity');
      if (/ransom|malware/i.test(cleanName)) defaultTags.push('Ransomware');
      if (/ai|deep|learn|transformer|gpt/i.test(cleanName)) defaultTags.push('DeepLearning');
      if (/auth|zero|trust/i.test(cleanName)) defaultTags.push('ZeroTrust');

      const paperFile = createPaperFile({
        name: file.name,
        folderId: this.currentFolderId,
        size: file.size,
        pdfData: arrayBuffer,
        tags: defaultTags,
        pageCount: pageCount
      });

      await db.saveFile(paperFile);

      const meta = createPaperMetadata({
        fileId: paperFile.id,
        title: cleanName.replace(/_/g, ' '),
        authors: 'Author',
        year: new Date().getFullYear().toString()
      });
      await db.saveMetadata(meta);
    }

    await this.refresh();
  }

  async promptNewFolder() {
    const name = prompt('Folder name:');
    if (name && name.trim()) {
      const folder = createFolder({
        name: name.trim(),
        parentId: this.currentFolderId
      });
      await db.saveFolder(folder);
      await this.refresh();
    }
  }

  async promptRenameFolder(folderId) {
    const folder = this.folders.find(f => f.id === folderId);
    if (!folder) return;
    const newName = prompt('Rename folder:', folder.name);
    if (newName && newName.trim() && newName !== folder.name) {
      folder.name = newName.trim();
      await db.saveFolder(folder);
      await this.refresh();
    }
  }

  async promptDeleteFolder(folderId) {
    const folder = this.folders.find(f => f.id === folderId);
    if (!folder) return;
    if (confirm(`Delete folder "${folder.name}" and contents?`)) {
      await db.deleteFolderRecursive(folderId);
      if (this.currentFolderId === folderId) {
        this.currentFolderId = folder.parentId;
      }
      await this.refresh();
    }
  }

  async promptRenameFile(fileId) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;
    const newName = prompt('Rename paper:', file.name);
    if (newName && newName.trim() && newName !== file.name) {
      file.name = newName.trim();
      await db.saveFile(file);
      await this.refresh();
    }
  }

  async promptDeleteFile(fileId) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;
    if (confirm(`Delete "${file.name}" permanently?`)) {
      await db.deleteFileComplete(fileId);
      if (this.selectedFileId === fileId) {
        this.selectedFileId = null;
        this.onFileClose();
      }
      this.removeFromRecent(fileId);
      await this.refresh();
    }
  }
}
