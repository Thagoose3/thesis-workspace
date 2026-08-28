/**
 * ThesisMind - Core Application Orchestrator
 * Connects PDF Viewer, Markup Engine, File Explorer, Annotation Studio, Search, Matrix, and TTS.
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

class ThesisMindApp {
  constructor() {
    this.explorer = null;
    this.viewer = null;
    this.studio = null;
    this.matrixModal = null;
    this.searchModal = null;
    this.currentFile = null;
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
      onFolderChange: (folderId) => console.log('Folder changed:', folderId),
      onOpenMatrix: (folderId) => this.matrixModal.open(folderId),
      onExportFolder: async (folderId) => {
        await exportFolderSummary(folderId);
        this.showToast('Folder Review exported as Markdown!');
      }
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
    this.currentFile = file;
    if (this.explorer) {
      this.explorer.selectedFileId = file.id;
      this.explorer.render();
    }

    const titleEl = document.getElementById('current-file-title');
    if (titleEl) titleEl.textContent = file.name;

    await this.viewer.loadPDF(file);
    await this.studio.loadFile(file);
  }

  _initHeaderEvents() {
    document.getElementById('btn-open-search')?.addEventListener('click', () => {
      this.searchModal.open();
    });

    document.getElementById('btn-header-matrix')?.addEventListener('click', () => {
      const currentFolderId = this.explorer ? this.explorer.currentFolderId : null;
      this.matrixModal.open(currentFolderId);
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
    const rateSelect = document.getElementById('tts-rate-select');
    const textPreview = document.getElementById('tts-text-preview');

    tts.subscribe((state) => {
      if (state.isPlaying || state.isPaused) {
        bar.classList.remove('hidden');
        textPreview.textContent = `Reading: "${state.text}"`;
        playPauseBtn.innerHTML = state.isPlaying
          ? `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
          : `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
      } else {
        bar.classList.add('hidden');
      }
    });

    playPauseBtn?.addEventListener('click', () => tts.togglePlayPause());
    stopBtn?.addEventListener('click', () => tts.stop());
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
