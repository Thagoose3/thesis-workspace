/**
 * PDF Viewer & Interactive Annotation Engine for ThesisMind
 * Powered by PDF.js with real Canvas rendering, Text Selection Layer, and Multi-color Highlights.
 */

import { HighlightColors, PaperThemes, createHighlight, createSideNote } from './models.js';
import { db } from './db.js';
import { tts } from './tts.js';

export class PDFViewerEngine {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options;
    this.pdfDoc = null;
    this.currentFile = null;
    this.scale = 1.25;
    this.theme = PaperThemes.LIGHT;
    this.currentPage = 1;
    this.totalPages = 0;
    this.pageRendering = false;
    this.highlights = [];
    this.floatingToolbar = null;
    this.activeSelection = null;
    this.onHighlightCreated = options.onHighlightCreated || (() => {});
    this.onHighlightClicked = options.onHighlightClicked || (() => {});
    this.onPageChanged = options.onPageChanged || (() => {});
    
    this._initFloatingToolbar();
    this._initScrollObserver();
  }

  _initFloatingToolbar() {
    this.floatingToolbar = document.createElement('div');
    this.floatingToolbar.className = 'floating-toolbar fixed z-50 hidden glass-dropdown rounded-xl shadow-2xl p-1.5 flex items-center space-x-1.5 border border-slate-700/60 text-xs';
    
    // Highlight colors
    const colorsContainer = document.createElement('div');
    colorsContainer.className = 'flex items-center space-x-1 pr-1.5 border-r border-slate-700';

    Object.values(HighlightColors).forEach(col => {
      const btn = document.createElement('button');
      btn.className = 'w-6 h-6 rounded-full border border-white/20 transition-transform hover:scale-110 active:scale-95 shadow-sm';
      btn.style.backgroundColor = col.hex;
      btn.title = `Highlight ${col.name}`;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._applyHighlight(col.id);
      });
      colorsContainer.appendChild(btn);
    });

    // Add Note button
    const noteBtn = document.createElement('button');
    noteBtn.className = 'px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-medium flex items-center space-x-1 transition';
    noteBtn.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
      <span>Note</span>
    `;
    noteBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this._applyHighlightAndNote();
    });

    // TTS Speak button
    const ttsBtn = document.createElement('button');
    ttsBtn.className = 'px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-medium flex items-center space-x-1 transition';
    ttsBtn.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
      <span>Read</span>
    `;
    ttsBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (this.activeSelection && this.activeSelection.text) {
        tts.speak(this.activeSelection.text);
        this.hideToolbar();
      }
    });

    // Copy text button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition';
    copyBtn.title = 'Copy Text';
    copyBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
    copyBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (this.activeSelection && this.activeSelection.text) {
        navigator.clipboard.writeText(this.activeSelection.text);
        this.hideToolbar();
      }
    });

    this.floatingToolbar.appendChild(colorsContainer);
    this.floatingToolbar.appendChild(noteBtn);
    this.floatingToolbar.appendChild(ttsBtn);
    this.floatingToolbar.appendChild(copyBtn);
    document.body.appendChild(this.floatingToolbar);

    // Global listener for text selection
    document.addEventListener('selectionchange', () => {
      this._handleSelectionChange();
    });

    // Dismiss toolbar on clicks outside
    document.addEventListener('mousedown', (e) => {
      if (this.floatingToolbar && !this.floatingToolbar.contains(e.target)) {
        if (!window.getSelection()?.isCollapsed) {
          // keep toolbar if still selecting within reader
        } else {
          this.hideToolbar();
        }
      }
    });
  }

  _initScrollObserver() {
    this.container.addEventListener('scroll', () => {
      const pageElements = this.container.querySelectorAll('.pdf-page-container');
      const containerTop = this.container.getBoundingClientRect().top;
      
      for (const el of pageElements) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= containerTop + 150 && rect.bottom >= containerTop + 50) {
          const pageNum = parseInt(el.getAttribute('data-page-number'), 10);
          if (pageNum && pageNum !== this.currentPage) {
            this.currentPage = pageNum;
            this.onPageChanged(this.currentPage, this.totalPages);
          }
          break;
        }
      }
    });
  }

  _handleSelectionChange() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Check if selection is inside this PDF viewer
    const commonAncestor = range.commonAncestorContainer;
    const pageEl = commonAncestor.nodeType === Node.ELEMENT_NODE 
      ? commonAncestor.closest('.pdf-page-container')
      : commonAncestor.parentElement?.closest('.pdf-page-container');

    if (!pageEl || !this.container.contains(pageEl)) {
      this.hideToolbar();
      return;
    }

    const pageNum = parseInt(pageEl.getAttribute('data-page-number'), 10);
    const rect = range.getBoundingClientRect();

    this.activeSelection = {
      text: selectedText,
      pageNumber: pageNum,
      range: range.cloneRange(),
      pageEl: pageEl,
      rect: rect
    };

    // Position floating toolbar above selection
    this.floatingToolbar.style.left = `${rect.left + rect.width / 2}px`;
    this.floatingToolbar.style.top = `${Math.max(10, rect.top - 48)}px`;
    this.floatingToolbar.classList.remove('hidden');
  }

  hideToolbar() {
    if (this.floatingToolbar) {
      this.floatingToolbar.classList.add('hidden');
    }
  }

  async _applyHighlight(colorId) {
    if (!this.activeSelection || !this.currentFile) return;

    const { text, pageNumber, range, pageEl } = this.activeSelection;
    const pageRect = pageEl.getBoundingClientRect();
    const clientRects = Array.from(range.getClientRects());
    
    // Normalize coordinates relative to page container
    const normalizedRects = clientRects.map(r => ({
      left: (r.left - pageRect.left) / pageRect.width,
      top: (r.top - pageRect.top) / pageRect.height,
      width: r.width / pageRect.width,
      height: r.height / pageRect.height,
    }));

    const hl = createHighlight({
      fileId: this.currentFile.id,
      pageNumber,
      text,
      color: colorId,
      rects: normalizedRects
    });

    await db.saveHighlight(hl);
    this.highlights.push(hl);
    this._renderHighlightOnPage(pageEl, hl);

    window.getSelection()?.removeAllRanges();
    this.hideToolbar();
    this.onHighlightCreated(hl);
  }

  async _applyHighlightAndNote() {
    if (!this.activeSelection || !this.currentFile) return;

    const { text, pageNumber, range, pageEl } = this.activeSelection;
    const pageRect = pageEl.getBoundingClientRect();
    const clientRects = Array.from(range.getClientRects());
    
    const normalizedRects = clientRects.map(r => ({
      left: (r.left - pageRect.left) / pageRect.width,
      top: (r.top - pageRect.top) / pageRect.height,
      width: r.width / pageRect.width,
      height: r.height / pageRect.height,
    }));

    const hl = createHighlight({
      fileId: this.currentFile.id,
      pageNumber,
      text,
      color: 'yellow',
      rects: normalizedRects
    });

    await db.saveHighlight(hl);
    this.highlights.push(hl);
    this._renderHighlightOnPage(pageEl, hl);

    // Create initial note
    const note = createSideNote({
      fileId: this.currentFile.id,
      highlightId: hl.id,
      pageNumber,
      content: ''
    });
    await db.saveSideNote(note);

    window.getSelection()?.removeAllRanges();
    this.hideToolbar();
    this.onHighlightCreated(hl, note);
  }

  async loadPDF(paperFile) {
    this.currentFile = paperFile;
    this.container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 space-y-3">
        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm font-medium">Loading document: ${paperFile.name}...</p>
      </div>
    `;

    try {
      this.highlights = await db.getHighlights(paperFile.id);
      
      const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
      if (!pdfjsLib) {
        throw new Error('PDF.js library is not loaded');
      }

      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      let loadingTask;
      if (paperFile.pdfData instanceof ArrayBuffer) {
        loadingTask = pdfjsLib.getDocument({ data: paperFile.pdfData });
      } else if (typeof paperFile.pdfData === 'string') {
        loadingTask = pdfjsLib.getDocument(paperFile.pdfData);
      } else {
        throw new Error('Invalid PDF data format');
      }

      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;

      this.container.innerHTML = '';
      this.onPageChanged(this.currentPage, this.totalPages);

      // Render all pages in document order
      for (let num = 1; num <= this.totalPages; num++) {
        await this._renderPage(num);
      }
    } catch (err) {
      console.error('Error loading PDF:', err);
      this.container.innerHTML = `
        <div class="p-8 text-center text-rose-400 bg-rose-950/20 border border-rose-800/50 rounded-xl m-6">
          <p class="font-semibold text-base mb-1">Failed to load PDF</p>
          <p class="text-xs text-slate-400">${err.message}</p>
        </div>
      `;
    }
  }

  async _renderPage(pageNum) {
    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: this.scale });
    const outputScale = window.devicePixelRatio || 1;

    const widthPx = Math.floor(viewport.width);
    const heightPx = Math.floor(viewport.height);

    // Page Container with explicit fixed width, height, and flex-shrink-0 to prevent vertical squishing
    const pageContainer = document.createElement('div');
    pageContainer.className = `pdf-page-container relative mx-auto my-6 shadow-2xl rounded-lg overflow-hidden flex-shrink-0 transition-all duration-200 pdf-theme-${this.theme}`;
    pageContainer.id = `page-${pageNum}`;
    pageContainer.setAttribute('data-page-number', pageNum);
    pageContainer.style.width = `${widthPx}px`;
    pageContainer.style.height = `${heightPx}px`;
    pageContainer.style.minWidth = `${widthPx}px`;
    pageContainer.style.minHeight = `${heightPx}px`;

    // Canvas layer with Hi-DPI support
    const canvas = document.createElement('canvas');
    canvas.className = 'block absolute top-0 left-0 z-[1]';
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${widthPx}px`;
    canvas.style.height = `${heightPx}px`;
    const ctx = canvas.getContext('2d');

    pageContainer.appendChild(canvas);

    // Text layer for selection
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${widthPx}px`;
    textLayerDiv.style.height = `${heightPx}px`;
    pageContainer.appendChild(textLayerDiv);

    // Highlight overlay layer
    const highlightLayer = document.createElement('div');
    highlightLayer.className = 'highlight-layer absolute top-0 left-0 w-full h-full pointer-events-none z-[3]';
    pageContainer.appendChild(highlightLayer);

    this.container.appendChild(pageContainer);

    // Render Canvas
    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
    await page.render({
      canvasContext: ctx,
      transform: transform,
      viewport: viewport
    }).promise;

    // Render Text Layer
    const textContent = await page.getTextContent();
    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    
    if (pdfjsLib.renderTextLayer) {
      await pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport: viewport,
        textDivs: []
      }).promise;
    }

    // Render existing highlights
    const pageHighlights = this.highlights.filter(h => h.pageNumber === pageNum);
    pageHighlights.forEach(hl => {
      this._renderHighlightOnPage(pageContainer, hl);
    });
  }

  _renderHighlightOnPage(pageContainer, hl) {
    const highlightLayer = pageContainer.querySelector('.highlight-layer') || pageContainer;
    const colorObj = HighlightColors[hl.color.toUpperCase()] || HighlightColors.YELLOW;

    if (hl.rects && Array.isArray(hl.rects) && hl.rects.length > 0) {
      hl.rects.forEach(rect => {
        const el = document.createElement('div');
        el.className = `pdf-highlight ${colorObj.class} highlight-id-${hl.id}`;
        el.style.left = `${rect.left * 100}%`;
        el.style.top = `${rect.top * 100}%`;
        el.style.width = `${rect.width * 100}%`;
        el.style.height = `${rect.height * 100}%`;
        el.title = hl.text;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onHighlightClicked(hl);
        });
        highlightLayer.appendChild(el);
      });
    }
  }

  setTheme(theme) {
    this.theme = theme;
    const pageContainers = this.container.querySelectorAll('.pdf-page-container');
    pageContainers.forEach(el => {
      el.classList.remove('pdf-theme-light', 'pdf-theme-sepia', 'pdf-theme-dark');
      el.classList.add(`pdf-theme-${theme}`);
    });
  }

  async setScale(newScale) {
    if (newScale < 0.5 || newScale > 3.0) return;
    this.scale = newScale;
    if (this.currentFile) {
      await this.loadPDF(this.currentFile);
    }
  }

  zoomIn() {
    this.setScale(this.scale + 0.2);
  }

  zoomOut() {
    this.setScale(this.scale - 0.2);
  }

  fitWidth() {
    if (!this.container || !this.pdfDoc) return;
    const containerWidth = this.container.clientWidth - 80;
    this.pdfDoc.getPage(1).then(page => {
      const unscaledViewport = page.getViewport({ scale: 1 });
      const targetScale = containerWidth / unscaledViewport.width;
      this.setScale(Math.max(0.6, Math.min(2.5, targetScale)));
    });
  }

  scrollToPage(pageNum) {
    const targetEl = document.getElementById(`page-${pageNum}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.currentPage = pageNum;
      this.onPageChanged(this.currentPage, this.totalPages);
    }
  }

  flashHighlight(hlId) {
    const els = document.querySelectorAll(`.highlight-id-${hlId}`);
    els.forEach(el => {
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 1300);
    });
  }
}
