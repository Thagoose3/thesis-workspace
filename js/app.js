/**
 * ThesisMind - Core Application Orchestrator
 * Connects PDF Viewer, Markup Engine, File Explorer, Annotation Studio, Search, Matrix, TTS, and Firebase Cloud Sync.
 */

import { db } from './db.js';
import { populateSampleData } from './sampleData.js';
import { FileExplorer } from './explorer.js';
import { PDFViewerEngine } from './pdfViewer.js';
import { AnnotationStudio } from './annotations.js';
import { SummaryMatrixModal } from './matrix.js';
import { GlobalSearchModal } from './search.js';
import { exportFolderSummary } from './export.js';
import { tts } from './tts.js';
import { firebaseService } from './firebase.js';
import { syncManager } from './sync.js';

class ThesisMindApp {
  constructor() {
    this.explorer = null;
    this.viewer = null;
    this.studio = null;
    this.matrixModal = null;
    this.searchModal = null;
    this.currentFile = null;
    this.openTabs = [];
    this.activeFileId = null;
    this.currentTheme = 'light';
    this.leftPanelVisible = true;
    this.rightPanelVisible = true;
  }

  async init() {
    // 1. Initialize IndexedDB & Preload Sample Data
    await db.ready();
    await populateSampleData(db);

    // 2. Initialize UI Components
    this._initViewer();
    this._initStudio();
    this._initExplorer();
    this._initModals();
    this._initHeaderEvents();
    this._initTTSPlayer();
    this._initSplitResizers();
    this._initAuthAndSync();

    // 3. Load first paper
    const files = await db.getAll('files');
    if (files.length > 0) {
      await this.openFile(files[0]);
    }
  }

  _initExplorer() {
    const container = document.getElementById('explorer-container');
    this.explorer = new FileExplorer(container, {
      onFileSelect: (file) => this.openFile(file),
      onFileClose: (fileId) => fileId ? this.closeTab(fileId) : this.closeCurrentFile(),
      onFolderChange: (folderId) => console.log('Folder changed:', folderId),
      onOpenMatrix: (folderId) => this.matrixModal.open(folderId),
      onExportFolder: async (folderId) => {
        await exportFolderSummary(folderId);
        this.showToast('Folder Review exported as Markdown!');
      },
      onShowToast: (msg) => this.showToast(msg)
    });
    this.explorer.init();
  }

  _initViewer() {
    const container = document.getElementById('pdf-canvas-container');
    this.viewer = new PDFViewerEngine(container, {
      onHighlightCreated: async () => {
        if (this.studio) await this.studio.loadFile(this.currentFile);
        this.showToast('Highlight saved');
      },
      onHighlightDeleted: async () => {
        if (this.studio) await this.studio.loadFile(this.currentFile);
        this.showToast('Highlight removed');
      },
      onHighlightUpdated: async () => {
        if (this.studio) await this.studio.loadFile(this.currentFile);
      },
      onHighlightClicked: (hl) => {
        if (this.studio) {
          this.studio.activeTab = 'annotations';
          this.studio.loadFile(this.currentFile);
        }
        this.viewer.flashHighlight(hl.id);
      },
      onMarkupCreated: async () => {
        if (this.studio) await this.studio.loadFile(this.currentFile);
        this.showToast('Markup added');
      },
      onMarkupDeleted: async () => {
        if (this.studio) await this.studio.loadFile(this.currentFile);
        this.showToast('Markup deleted');
      },
      onPageChanged: (cur, total) => {
        const ind = document.getElementById('page-indicator');
        const inp = document.getElementById('page-input');
        if (ind) ind.textContent = `/ ${total}`;
        if (inp) inp.value = cur;
      }
    });
  }

  _initStudio() {
    const container = document.getElementById('annotation-studio-container');
    this.studio = new AnnotationStudio(container, {
      onJumpToPage: (pageNum) => this.viewer.scrollToPage(pageNum),
      onFlashHighlight: (hlId) => this.viewer.flashHighlight(hlId),
      onDeleteHighlight: async (hlId) => {
        await this.viewer.deleteHighlight(hlId);
      },
      onUpdateHighlightColor: async (hlId, color) => {
        await this.viewer.updateHighlightColor(hlId, color);
      },
      onDeleteMarkup: async (mkId) => {
        await db.deleteMarkup(mkId);
        const el = document.getElementById(`markup-${mkId}`);
        if (el) el.remove();
        if (this.viewer) {
          this.viewer.markups = this.viewer.markups.filter(m => m.id !== mkId);
        }
      },
      onShowToast: (msg) => this.showToast(msg)
    });
  }

  _initModals() {
    const matrixEl = document.getElementById('matrix-modal-container');
    this.matrixModal = new SummaryMatrixModal(matrixEl, {
      onShowToast: (msg) => this.showToast(msg)
    });

    const searchEl = document.getElementById('search-modal-container');
    this.searchModal = new GlobalSearchModal(searchEl, {
      onSelectResult: async (file, pageNumber, hlId) => {
        await this.openFile(file);
        if (pageNumber) {
          setTimeout(() => {
            this.viewer.scrollToPage(pageNumber);
            if (hlId) this.viewer.flashHighlight(hlId);
          }, 300);
        }
      }
    });
  }

  async openFile(file) {
    if (!file) return;

    // Add to open tabs if not already present
    const existingIndex = this.openTabs.findIndex(f => f.id === file.id);
    if (existingIndex === -1) {
      this.openTabs.push(file);
    } else {
      this.openTabs[existingIndex] = file;
    }

    this.activeFileId = file.id;
    this.currentFile = file;

    this._renderTabs();

    if (this.explorer) {
      this.explorer.selectedFileId = file.id;
      this.explorer.render();
    }

    await this.viewer.loadPDF(file);
    await this.studio.loadFile(file);
  }

  async closeTab(fileId, event = null) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    const index = this.openTabs.findIndex(f => f.id === fileId);
    if (index === -1) return;

    this.openTabs.splice(index, 1);

    if (this.activeFileId === fileId) {
      if (this.openTabs.length > 0) {
        const nextIndex = Math.min(index, this.openTabs.length - 1);
        await this.openFile(this.openTabs[nextIndex]);
      } else {
        this.closeCurrentFile();
      }
    } else {
      this._renderTabs();
    }
  }

  closeCurrentFile() {
    this.openTabs = [];
    this.activeFileId = null;
    this.currentFile = null;

    this._renderTabs();

    if (this.explorer) {
      this.explorer.selectedFileId = null;
      this.explorer.render();
    }

    const ind = document.getElementById('page-indicator');
    const inp = document.getElementById('page-input');
    if (ind) ind.textContent = '/ 1';
    if (inp) inp.value = 1;

    const container = document.getElementById('pdf-canvas-container');
    if (container) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-zinc-600 space-y-2">
          <p class="text-xs text-zinc-500 font-medium">Select a thesis paper from the left panel to begin reading</p>
        </div>
      `;
    }

    if (this.studio) {
      this.studio.renderEmpty();
    }
  }

  _renderTabs() {
    const bar = document.getElementById('pdf-tabs-bar');
    if (!bar) return;

    if (this.openTabs.length === 0) {
      bar.innerHTML = `
        <div id="pdf-tabs-empty" class="flex items-center space-x-2 text-zinc-500 text-xs">
          <span class="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
          <span class="text-xs font-medium text-zinc-400">No Document Selected</span>
        </div>
      `;
      return;
    }

    bar.innerHTML = this.openTabs.map(file => {
      const isActive = file.id === this.activeFileId;
      return `
        <div class="pdf-tab group flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-medium cursor-pointer transition-all flex-shrink-0 border ${isActive ? 'bg-zinc-800/95 text-zinc-100 border-white/[0.14] shadow-sm' : 'bg-zinc-950/50 text-zinc-400 border-white/[0.04] hover:text-zinc-200 hover:bg-white/[0.04]'}" data-file-id="${file.id}">
          <span class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-zinc-600'}"></span>
          <span class="truncate max-w-[130px] text-[11px] select-none" title="${file.name}">${file.name}</span>
          <button class="btn-close-tab p-0.5 rounded-md text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.1] transition opacity-60 group-hover:opacity-100" data-file-id="${file.id}" title="Close tab (ปิดแท็บ)">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      `;
    }).join('');

    // Click tab to switch
    bar.querySelectorAll('.pdf-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        if (e.target.closest('.btn-close-tab')) return;
        const fileId = tab.getAttribute('data-file-id');
        const targetFile = this.openTabs.find(f => f.id === fileId);
        if (targetFile && targetFile.id !== this.activeFileId) {
          this.openFile(targetFile);
        }
      });
    });

    // Close tab button
    bar.querySelectorAll('.btn-close-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileId = btn.getAttribute('data-file-id');
        this.closeTab(fileId, e);
      });
    });
  }

  _initAuthAndSync() {
    const loginBtn = document.getElementById('btn-google-login');
    const profileMenu = document.getElementById('user-profile-menu');
    const userAvatarBtn = document.getElementById('btn-user-avatar');
    const userDropdown = document.getElementById('user-dropdown-popover');
    const userAvatarImg = document.getElementById('user-avatar-img');
    const userNameEl = document.getElementById('user-display-name');
    const userEmailEl = document.getElementById('user-display-email');
    
    const syncBadge = document.getElementById('sync-status-badge');
    const syncDot = document.getElementById('sync-status-dot');
    const syncText = document.getElementById('sync-status-text');

    const modalFirebase = document.getElementById('firebase-modal');
    const configInput = document.getElementById('firebase-config-input');

    // Subscribe to Auth state
    firebaseService.subscribeAuth((user, isConfigured) => {
      if (user) {
        loginBtn?.classList.add('hidden');
        profileMenu?.classList.remove('hidden');
        syncBadge?.classList.remove('hidden');
        syncBadge?.classList.add('flex');

        if (userAvatarImg) userAvatarImg.src = user.photoURL || 'https://www.gravatar.com/avatar/?d=mp';
        if (userNameEl) userNameEl.textContent = user.displayName || 'Google User';
        if (userEmailEl) userEmailEl.textContent = user.email || '';
      } else {
        loginBtn?.classList.remove('hidden');
        profileMenu?.classList.add('hidden');
        syncBadge?.classList.add('hidden');
        syncBadge?.classList.remove('flex');
        userDropdown?.classList.add('hidden');
      }
    });

    // Subscribe to Sync state
    syncManager.subscribe((state) => {
      if (!syncDot || !syncText) return;
      if (state.status === 'syncing') {
        syncDot.className = 'w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping';
        syncText.textContent = 'Syncing...';
      } else if (state.status === 'synced') {
        syncDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500';
        syncText.textContent = 'Synced';
        // Refresh local views
        this.explorer?.render();
        if (this.currentFile && this.studio) {
          this.studio.loadFile(this.currentFile);
        }
      } else if (state.status === 'error') {
        syncDot.className = 'w-1.5 h-1.5 rounded-full bg-rose-500';
        syncText.textContent = 'Sync Error';
      } else {
        syncDot.className = 'w-1.5 h-1.5 rounded-full bg-zinc-500';
        syncText.textContent = 'Offline';
      }
    });

    // Google Sign-In Click
    loginBtn?.addEventListener('click', async () => {
      try {
        await firebaseService.signInWithGoogle();
        this.showToast('Signed in successfully with Google!');
      } catch (err) {
        if (err.message === 'CONFIG_REQUIRED' || !firebaseService.isConfigured) {
          this._openFirebaseModal();
        } else {
          this.showToast(`Login failed: ${err.message}`);
        }
      }
    });

    // Profile Dropdown Toggle
    userAvatarBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown?.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (userDropdown && !userDropdown.contains(e.target) && !userAvatarBtn.contains(e.target)) {
        userDropdown.classList.add('hidden');
      }
    });

    // Menu Actions
    document.getElementById('btn-menu-sync-now')?.addEventListener('click', async () => {
      userDropdown?.classList.add('hidden');
      this.showToast('Syncing with Cloud...');
      await syncManager.syncAll();
      this.showToast('Cloud Sync completed!');
    });

    syncBadge?.addEventListener('click', async () => {
      this.showToast('Syncing with Cloud...');
      await syncManager.syncAll();
      this.showToast('Cloud Sync completed!');
    });

    document.getElementById('btn-menu-firebase-config')?.addEventListener('click', () => {
      userDropdown?.classList.add('hidden');
      this._openFirebaseModal();
    });

    document.getElementById('btn-menu-signout')?.addEventListener('click', async () => {
      userDropdown?.classList.add('hidden');
      await firebaseService.signOut();
      this.showToast('Signed out');
    });

    // Firebase Setup Modal Events
    document.getElementById('btn-close-firebase-modal')?.addEventListener('click', () => {
      modalFirebase?.classList.add('hidden');
    });

    document.getElementById('btn-cancel-firebase-modal')?.addEventListener('click', () => {
      modalFirebase?.classList.add('hidden');
    });

    document.getElementById('btn-save-firebase-modal')?.addEventListener('click', async () => {
      const val = configInput?.value.trim();
      if (!val) return;

      try {
        let configObj;
        if (val.startsWith('{')) {
          configObj = JSON.parse(val);
        } else {
          // Attempt key/value cleanup
          const jsonStr = val.replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":');
          configObj = JSON.parse(jsonStr);
        }

        const success = firebaseService.saveConfig(configObj);
        if (success) {
          modalFirebase?.classList.add('hidden');
          this.showToast('Firebase Connected! Now signing in with Google...');
          try {
            await firebaseService.signInWithGoogle();
          } catch (e) {
            console.log('User can click sign-in button');
          }
        } else {
          alert('Invalid Firebase configuration object. Please make sure apiKey and projectId are present.');
        }
      } catch (err) {
        alert('Could not parse JSON. Please paste a valid Firebase config object.');
      }
    });

    document.getElementById('btn-clear-firebase-config')?.addEventListener('click', () => {
      localStorage.removeItem('thesismind_firebase_config');
      if (configInput) configInput.value = '';
      this.showToast('Firebase configuration cleared');
    });
  }

  _openFirebaseModal() {
    const modalFirebase = document.getElementById('firebase-modal');
    const configInput = document.getElementById('firebase-config-input');
    const saved = firebaseService.getSavedConfig();
    if (saved && configInput) {
      configInput.value = JSON.stringify(saved, null, 2);
    }
    modalFirebase?.classList.remove('hidden');
  }

  _initHeaderEvents() {
    document.getElementById('btn-open-search')?.addEventListener('click', () => {
      this.searchModal.open();
    });

    document.getElementById('btn-header-matrix')?.addEventListener('click', () => {
      const currentFolderId = this.explorer ? this.explorer.currentFolderId : null;
      this.matrixModal.open(currentFolderId);
    });

    document.getElementById('btn-close-current-file')?.addEventListener('click', () => {
      this.closeCurrentFile();
    });

    const leftCol = document.getElementById('explorer-col');
    const rightCol = document.getElementById('studio-col');
    const leftResizer = document.getElementById('resizer-left');
    const rightResizer = document.getElementById('resizer-right');

    document.getElementById('btn-toggle-left-panel')?.addEventListener('click', () => {
      this.leftPanelVisible = !this.leftPanelVisible;
      if (leftCol) leftCol.style.display = this.leftPanelVisible ? 'flex' : 'none';
      if (leftResizer) leftResizer.style.display = this.leftPanelVisible ? 'block' : 'none';
    });

    document.getElementById('btn-toggle-right-panel')?.addEventListener('click', () => {
      this.rightPanelVisible = !this.rightPanelVisible;
      if (rightCol) rightCol.style.display = this.rightPanelVisible ? 'flex' : 'none';
      if (rightResizer) rightResizer.style.display = this.rightPanelVisible ? 'block' : 'none';
    });

    const btnThemeNormal = document.getElementById('btn-theme-normal');
    const btnThemeSepia = document.getElementById('btn-theme-sepia');
    const btnThemeDark = document.getElementById('btn-theme-dark');

    const updateThemeButtons = (theme) => {
      [btnThemeNormal, btnThemeSepia, btnThemeDark].forEach(b => b?.classList.remove('bg-blue-600', 'text-white'));
      if (theme === 'light') btnThemeNormal?.classList.add('bg-blue-600', 'text-white');
      if (theme === 'sepia') btnThemeSepia?.classList.add('bg-amber-600', 'text-white');
      if (theme === 'dark') btnThemeDark?.classList.add('bg-zinc-800', 'text-white');
    };

    btnThemeNormal?.addEventListener('click', () => {
      this.currentTheme = 'light';
      this.viewer.setTheme('light');
      updateThemeButtons('light');
    });

    btnThemeSepia?.addEventListener('click', () => {
      this.currentTheme = 'sepia';
      this.viewer.setTheme('sepia');
      updateThemeButtons('sepia');
    });

    btnThemeDark?.addEventListener('click', () => {
      this.currentTheme = 'dark';
      this.viewer.setTheme('dark');
      updateThemeButtons('dark');
    });

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.viewer.zoomIn());
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.viewer.zoomOut());
    document.getElementById('btn-zoom-fit')?.addEventListener('click', () => this.viewer.fitWidth());
    document.getElementById('btn-rotate-page')?.addEventListener('click', async () => {
      await this.viewer.rotateCurrentPage();
      this.showToast('Rotated page 90°');
    });

    document.getElementById('btn-page-prev')?.addEventListener('click', () => {
      if (this.viewer.currentPage > 1) {
        this.viewer.scrollToPage(this.viewer.currentPage - 1);
      }
    });

    document.getElementById('btn-page-next')?.addEventListener('click', () => {
      if (this.viewer.currentPage < this.viewer.totalPages) {
        this.viewer.scrollToPage(this.viewer.currentPage + 1);
      }
    });

    const pageInput = document.getElementById('page-input');
    pageInput?.addEventListener('change', () => {
      const p = parseInt(pageInput.value, 10);
      if (p >= 1 && p <= this.viewer.totalPages) {
        this.viewer.scrollToPage(p);
      }
    });
  }

  _initTTSPlayer() {
    const bar = document.getElementById('tts-player-bar');
    const playPauseBtn = document.getElementById('btn-tts-playpause');
    const stopBtn = document.getElementById('btn-tts-stop');
    const headerStopBtn = document.getElementById('btn-header-tts-stop');
    const rateSelect = document.getElementById('tts-rate-select');
    const textPreview = document.getElementById('tts-text-preview');

    tts.subscribe((state) => {
      if (state.isPlaying) {
        if (headerStopBtn) headerStopBtn.classList.remove('hidden');
      } else {
        if (headerStopBtn) headerStopBtn.classList.add('hidden');
      }

      if (state.isPlaying || state.isPaused) {
        bar?.classList.remove('hidden');
        if (textPreview) textPreview.textContent = `F.R.I.D.A.Y.: "${state.text}"`;
        if (playPauseBtn) {
          playPauseBtn.innerHTML = state.isPlaying
            ? `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
            : `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
        }
      } else {
        bar?.classList.add('hidden');
      }

      // Re-render notes tab to refresh playing icon
      if (this.studio && this.studio.activeTab === 'annotations') {
        this.studio.render();
      }
    });

    playPauseBtn?.addEventListener('click', () => tts.togglePlayPause());
    stopBtn?.addEventListener('click', () => {
      tts.stop();
      this.showToast('Stopped reading');
    });
    headerStopBtn?.addEventListener('click', () => {
      tts.stop();
      this.showToast('Stopped reading');
    });
    rateSelect?.addEventListener('change', (e) => tts.setRate(parseFloat(e.target.value)));
  }

  _initSplitResizers() {
    const leftResizer = document.getElementById('resizer-left');
    const explorerCol = document.getElementById('explorer-col');
    let isResizingLeft = false;

    leftResizer?.addEventListener('mousedown', () => {
      isResizingLeft = true;
      leftResizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
    });

    const rightResizer = document.getElementById('resizer-right');
    const studioCol = document.getElementById('studio-col');
    let isResizingRight = false;

    rightResizer?.addEventListener('mousedown', () => {
      isResizingRight = true;
      rightResizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
    });

    window.addEventListener('mousemove', (e) => {
      if (isResizingLeft && explorerCol) {
        const newWidth = Math.max(180, Math.min(420, e.clientX));
        explorerCol.style.width = `${newWidth}px`;
      }
      if (isResizingRight && studioCol) {
        const newWidth = Math.max(240, Math.min(550, window.innerWidth - e.clientX));
        studioCol.style.width = `${newWidth}px`;
      }
    });

    window.addEventListener('mouseup', () => {
      if (isResizingLeft) {
        isResizingLeft = false;
        leftResizer.classList.remove('resizing');
        document.body.style.cursor = '';
      }
      if (isResizingRight) {
        isResizingRight = false;
        rightResizer.classList.remove('resizing');
        document.body.style.cursor = '';
      }
    });
  }

  showToast(message) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast-animate flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/[0.1] text-zinc-200 text-xs font-medium shadow-2xl backdrop-blur-xl';
    toast.innerHTML = `
      <svg class="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
      <span>${message}</span>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  }
}

// Start application
window.addEventListener('DOMContentLoaded', () => {
  window.app = new ThesisMindApp();
  window.app.init();
});
