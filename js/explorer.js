/**
 * Windows-Style File Explorer & Folder Tree Component
 * Supports nested folders, breadcrumb navigation, drag & drop PDF upload, and tag filtering.
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
    this.selectedFileId = null;
    this.onFileSelect = options.onFileSelect || (() => {});
    this.onFolderChange = options.onFolderChange || (() => {});
    this.onOpenMatrix = options.onOpenMatrix || (() => {});
    this.onExportFolder = options.onExportFolder || (() => {});
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
      if (Array.isArray(f.tags)) {
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
    }
    return list;
  }

  getCurrentFolderChildren() {
    return this.folders.filter(f => f.parentId === this.currentFolderId);
  }

  render() {
    const breadcrumbPath = this.getBreadcrumbPath(this.currentFolderId);
    const subfolders = this.getCurrentFolderChildren();
    const files = this.getFilteredFiles();
    const allTags = this.getAllTags();
    const currentFolder = this.folders.find(f => f.id === this.currentFolderId);

    this.container.innerHTML = `
      <div class="h-full flex flex-col bg-slate-900/90 text-slate-200 border-r border-slate-800">
        <!-- Explorer Header Toolbar -->
        <div class="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
            </div>
            <div>
              <h2 class="text-xs font-bold text-slate-200 uppercase tracking-wider">Thesis Explorer</h2>
              <p class="text-[10px] text-slate-400 font-mono">${this.files.length} Papers · ${this.folders.length} Folders</p>
            </div>
          </div>
          <div class="flex items-center space-x-1">
            <button id="btn-new-folder" class="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 transition" title="New Folder">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path></svg>
            </button>
            <button id="btn-upload-paper" class="p-1.5 rounded-md hover:bg-slate-800 text-blue-400 transition" title="Upload PDF">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            </button>
          </div>
        </div>

        <!-- Breadcrumbs Navigation -->
        <div class="px-3 py-2 bg-slate-950/50 border-b border-slate-800/80 flex items-center space-x-1.5 text-xs overflow-x-auto whitespace-nowrap">
          <button class="btn-breadcrumb text-slate-400 hover:text-blue-400 transition font-medium flex items-center space-x-1" data-folder-id="root">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
            <span>Thesis Root</span>
          </button>
          ${breadcrumbPath.map(f => `
            <span class="text-slate-600">/</span>
            <button class="btn-breadcrumb font-medium transition ${f.id === this.currentFolderId ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}" data-folder-id="${f.id}">
              ${f.name}
            </button>
          `).join('')}
        </div>

        <!-- Tags Filter Bar -->
        ${allTags.length > 0 ? `
          <div class="px-3 py-2 border-b border-slate-800/50 flex items-center space-x-1.5 overflow-x-auto text-[11px]">
            <span class="text-slate-500 font-mono text-[10px]">TAGS:</span>
            ${allTags.map(tag => `
              <button class="btn-tag px-2 py-0.5 rounded-full border transition ${this.activeTag === tag ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-medium' : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'}" data-tag="${tag}">
                #${tag}
              </button>
            `).join('')}
          </div>
        ` : ''}

        <!-- Folder Actions (Matrix & Export) -->
        <div class="p-2 border-b border-slate-800/60 flex items-center space-x-2">
          <button id="btn-open-matrix" class="flex-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium flex items-center justify-center space-x-1.5 transition shadow-sm">
            <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <span>Summary Matrix</span>
          </button>
          <button id="btn-export-folder" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-medium flex items-center space-x-1.5 transition" title="Export Folder Review Notes">
            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            <span>Export</span>
          </button>
        </div>

        <!-- Main Explorer Content: Subfolders & Files -->
        <div class="flex-1 overflow-y-auto p-3 space-y-3" id="drop-zone">
          <!-- Subfolders List -->
          ${subfolders.length > 0 && !this.activeTag ? `
            <div class="space-y-1">
              <div class="text-[10px] font-mono text-slate-500 uppercase px-1">Subfolders</div>
              <div class="grid grid-cols-1 gap-1.5">
                ${subfolders.map(f => `
                  <div class="group flex items-center justify-between p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition cursor-pointer folder-item" data-folder-id="${f.id}">
                    <div class="flex items-center space-x-2.5 min-w-0">
                      <svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"></path></svg>
                      <span class="text-xs font-medium text-slate-200 truncate group-hover:text-blue-300">${f.name}</span>
                    </div>
                    <div class="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition">
                      <button class="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 btn-rename-folder" data-folder-id="${f.id}" title="Rename">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                      </button>
                      <button class="p-1 hover:bg-rose-900/50 rounded text-slate-400 hover:text-rose-400 btn-delete-folder" data-folder-id="${f.id}" title="Delete">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Files List -->
          <div class="space-y-1.5">
            <div class="text-[10px] font-mono text-slate-500 uppercase px-1 flex justify-between items-center">
              <span>Papers (${files.length})</span>
              ${this.activeTag ? `<span class="text-blue-400 font-normal">Filtered by #${this.activeTag}</span>` : ''}
            </div>

            ${files.length === 0 ? `
              <div class="p-6 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/40 text-slate-500">
                <svg class="w-8 h-8 mx-auto mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <p class="text-xs font-medium text-slate-400">No papers in this folder</p>
                <p class="text-[11px] text-slate-500 mt-1">Drag & drop PDF files here to upload</p>
              </div>
            ` : `
              <div class="space-y-2">
                ${files.map(file => {
                  const isSelected = file.id === this.selectedFileId;
                  return `
                    <div class="group relative p-2.5 rounded-xl border transition cursor-pointer file-item ${isSelected ? 'bg-blue-600/15 border-blue-500/50 shadow-md ring-1 ring-blue-500/30' : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'}" data-file-id="${file.id}">
                      <div class="flex items-start justify-between space-x-2">
                        <div class="flex items-start space-x-2.5 min-w-0 flex-1">
                          <div class="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span class="text-[9px] font-bold">PDF</span>
                          </div>
                          <div class="min-w-0 flex-1">
                            <h3 class="text-xs font-semibold text-slate-100 truncate group-hover:text-blue-300">${file.name}</h3>
                            <div class="flex items-center space-x-2 mt-1 text-[10px] text-slate-400">
                              <span>${file.pageCount || 1} Pages</span>
                              <span>•</span>
                              <span>${(file.size / 1024).toFixed(0)} KB</span>
                            </div>
                          </div>
                        </div>

                        <!-- Action buttons -->
                        <div class="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 transition">
                          <button class="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 btn-rename-file" data-file-id="${file.id}" title="Rename">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                          </button>
                          <button class="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400 btn-move-file" data-file-id="${file.id}" title="Move Folder">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                          </button>
                          <button class="p-1 hover:bg-rose-900/50 rounded text-slate-400 hover:text-rose-400 btn-delete-file" data-file-id="${file.id}" title="Delete">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      </div>

                      <!-- Tags list -->
                      ${file.tags && file.tags.length > 0 ? `
                        <div class="flex flex-wrap gap-1 mt-2">
                          ${file.tags.map(t => `
                            <span class="px-1.5 py-0.5 rounded bg-slate-900/80 text-[10px] text-blue-300 font-mono border border-slate-700/50">#${t}</span>
                          `).join('')}
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Hidden input for file upload -->
        <input type="file" id="file-input" accept="application/pdf" class="hidden" multiple />
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // Breadcrumbs
    this.container.querySelectorAll('.btn-breadcrumb').forEach(btn => {
      btn.addEventListener('click', () => {
        const fId = btn.getAttribute('data-folder-id');
        this.setCurrentFolder(fId === 'root' ? null : fId);
      });
    });

    // Tag filtering
    this.container.querySelectorAll('.btn-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag');
        this.setTagFilter(tag);
      });
    });

    // Subfolders click
    this.container.querySelectorAll('.folder-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const fId = el.getAttribute('data-folder-id');
        this.setCurrentFolder(fId);
      });
    });

    // File selection
    this.container.querySelectorAll('.file-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const fileId = el.getAttribute('data-file-id');
        this.selectedFileId = fileId;
        const file = this.files.find(f => f.id === fileId);
        if (file) {
          this.onFileSelect(file);
          this.render();
        }
      });
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

    // Move File
    this.container.querySelectorAll('.btn-move-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fileId = btn.getAttribute('data-file-id');
        this.promptMoveFile(fileId);
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

    // Matrix Button
    const matrixBtn = this.container.querySelector('#btn-open-matrix');
    if (matrixBtn) {
      matrixBtn.addEventListener('click', () => {
        this.onOpenMatrix(this.currentFolderId);
      });
    }

    // Export Folder Button
    const exportBtn = this.container.querySelector('#btn-export-folder');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.onExportFolder(this.currentFolderId);
      });
    }

    // Upload triggers
    const uploadBtn = this.container.querySelector('#btn-upload-paper');
    const fileInput = this.container.querySelector('#file-input');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this._handleFileInput(e));
    }

    // Drag & drop handlers
    const dropZone = this.container.querySelector('#drop-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('bg-blue-950/40', 'border-blue-500');
      });
      dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-blue-950/40', 'border-blue-500');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-blue-950/40', 'border-blue-500');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this._processUploadedFiles(e.dataTransfer.files);
        }
      });
    }
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

      // Auto tag based on filename
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

      // Create initial metadata entry
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
    const name = prompt('Enter folder name: (e.g. Chapter 3 - Methodology)');
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
    if (confirm(`Are you sure you want to delete folder "${folder.name}" and all its contents?`)) {
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
    const newName = prompt('Rename paper file:', file.name);
    if (newName && newName.trim() && newName !== file.name) {
      file.name = newName.trim();
      await db.saveFile(file);
      await this.refresh();
    }
  }

  async promptMoveFile(fileId) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;

    const options = [
      { id: null, name: '📁 [Root] Top Level' },
      ...this.folders.map(f => ({ id: f.id, name: `📁 ${f.name}` }))
    ];

    const folderNames = options.map((opt, idx) => `${idx + 1}. ${opt.name}`).join('\n');
    const choice = prompt(`Select target folder for "${file.name}":\n\n${folderNames}\n\nEnter number:`);
    
    if (choice) {
      const index = parseInt(choice, 10) - 1;
      if (index >= 0 && index < options.length) {
        file.folderId = options[index].id;
        await db.saveFile(file);
        await this.refresh();
      }
    }
  }

  async promptDeleteFile(fileId) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;
    if (confirm(`Are you sure you want to delete paper "${file.name}"?`)) {
      await db.deleteFileComplete(fileId);
      if (this.selectedFileId === fileId) {
        this.selectedFileId = null;
      }
      await this.refresh();
    }
  }
}
