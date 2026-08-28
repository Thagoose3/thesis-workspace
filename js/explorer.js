/**
 * Ultra-Minimalist File Explorer & Folder Tree Component
 * Clean, distraction-free document tree inspired by Notion / Linear.
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

    this.container.innerHTML = `
      <div class="h-full flex flex-col bg-zinc-900 text-zinc-300 border-r border-white/[0.06] select-none">
        
        <!-- Header: Minimal Title + Action Icons -->
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

        <!-- Breadcrumb / Path -->
        <div class="px-3 py-1.5 border-b border-white/[0.04] bg-zinc-950/40 flex items-center space-x-1 text-[11px] overflow-x-auto whitespace-nowrap">
          <button class="btn-breadcrumb text-zinc-500 hover:text-zinc-300 transition font-medium" data-folder-id="root">
            Root
          </button>
          ${breadcrumbPath.map(f => `
            <span class="text-zinc-700">/</span>
            <button class="btn-breadcrumb font-medium transition truncate max-w-[100px] ${f.id === this.currentFolderId ? 'text-blue-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}" data-folder-id="${f.id}">
              ${f.name}
            </button>
          `).join('')}
        </div>

        <!-- Minimal Tag Pills -->
        ${allTags.length > 0 ? `
          <div class="px-3 py-1.5 border-b border-white/[0.04] flex items-center space-x-1 overflow-x-auto text-[10px]">
            ${allTags.map(tag => `
              <button class="btn-tag px-2 py-0.5 rounded-md transition ${this.activeTag === tag ? 'bg-blue-500/20 text-blue-300 font-medium' : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08]'}" data-tag="${tag}">
                #${tag}
              </button>
            `).join('')}
          </div>
        ` : ''}

        <!-- Main Tree Content -->
        <div class="flex-1 overflow-y-auto p-2 space-y-3" id="drop-zone">
          
          <!-- Subfolders -->
          ${subfolders.length > 0 && !this.activeTag ? `
            <div class="space-y-0.5">
              <div class="text-[9px] font-mono text-zinc-500 uppercase px-1.5 mb-1">Folders</div>
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
          ` : ''}

          <!-- Papers List -->
          <div class="space-y-0.5">
            <div class="text-[9px] font-mono text-zinc-500 uppercase px-1.5 mb-1 flex justify-between">
              <span>Papers (${files.length})</span>
            </div>

            ${files.length === 0 ? `
              <div class="p-5 text-center border border-dashed border-white/[0.08] rounded-xl bg-zinc-950/20 text-zinc-500">
                <p class="text-[11px] text-zinc-400">No papers here</p>
                <p class="text-[10px] text-zinc-600 mt-0.5">Drop PDF files to upload</p>
              </div>
            ` : `
              <div class="space-y-1">
                ${files.map(file => {
                  const isSelected = file.id === this.selectedFileId;
                  return `
                    <div class="group px-2.5 py-2 rounded-xl transition cursor-pointer file-item ${isSelected ? 'bg-blue-600/15 text-zinc-100 ring-1 ring-blue-500/40' : 'hover:bg-white/[0.04] text-zinc-300'}" data-file-id="${file.id}">
                      <div class="flex items-start justify-between space-x-2">
                        <div class="flex items-start space-x-2 min-w-0 flex-1">
                          <svg class="w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-zinc-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                          <div class="min-w-0 flex-1">
                            <p class="text-xs font-medium truncate ${isSelected ? 'text-blue-200' : 'text-zinc-200 group-hover:text-zinc-100'}">${file.name}</p>
                            <div class="flex items-center space-x-1.5 mt-0.5 text-[10px] text-zinc-500">
                              <span>${file.pageCount || 1}p</span>
                              <span>·</span>
                              <span>${(file.size / 1024).toFixed(0)}kb</span>
                            </div>
                          </div>
                        </div>

                        <!-- Actions -->
                        <div class="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 transition">
                          <button class="p-1 hover:bg-white/[0.08] rounded text-zinc-400 hover:text-zinc-200 btn-rename-file" data-file-id="${file.id}" title="Rename">
                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                          </button>
                          <button class="p-1 hover:bg-white/[0.08] rounded text-zinc-400 hover:text-blue-400 btn-move-file" data-file-id="${file.id}" title="Move">
                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                          </button>
                          <button class="p-1 hover:bg-rose-900/40 rounded text-zinc-400 hover:text-rose-400 btn-delete-file" data-file-id="${file.id}" title="Delete">
                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      </div>
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

  async promptMoveFile(fileId) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;

    const options = [
      { id: null, name: '📁 [Root]' },
      ...this.folders.map(f => ({ id: f.id, name: `📁 ${f.name}` }))
    ];

    const folderNames = options.map((opt, idx) => `${idx + 1}. ${opt.name}`).join('\n');
    const choice = prompt(`Move "${file.name}" to:\n\n${folderNames}\n\nNumber:`);
    
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
    if (confirm(`Delete "${file.name}"?`)) {
      await db.deleteFileComplete(fileId);
      if (this.selectedFileId === fileId) {
        this.selectedFileId = null;
      }
      await this.refresh();
    }
  }
}
