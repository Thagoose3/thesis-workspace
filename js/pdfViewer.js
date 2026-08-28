/**
 * PDF Viewer & Interactive Annotation Engine for ThesisMind
 * Powered by PDF.js with real Canvas rendering, Text Selection Layer, Multi-color Highlights,
 * and Contextual Highlight Management Popover (Undo/Remove, Change Color, Note, TTS).
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
    this.highlights = [];
    this.selectionToolbar = null;
    this.highlightPopover = null;
    this.activeSelection = null;
    this.activeHighlight = null;
    
    this.onHighlightCreated = options.onHighlightCreated || (() => {});
    this.onHighlightDeleted = options.onHighlightDeleted || (() => {});
    this.onHighlightUpdated = options.onHighlightUpdated || (() => {});
    this.onHighlightClicked = options.onHighlightClicked || (() => {});
    this.onPageChanged = options.onPageChanged || (() => {});
    
    this._initSelectionToolbar();
    this._initHighlightPopover();
    this._initScrollObserver();
  }

  _initSelectionToolbar() {
    this.selectionToolbar = document.createElement('div');
    this.selectionToolbar.className = 'floating-toolbar fixed z-50 hidden glass-dropdown rounded-2xl shadow-2xl p-1.5 flex items-center space-x-1.5 border border-slate-700/70 text-xs';
    
    // Highlight colors
    const colorsContainer = document.createElement('div');
    colorsContainer.className = 'flex items-center space-x-1 pr-1.5 border-r border-slate-700/70';

    Object.values(HighlightColors).forEach(col => {
      const btn = document.createElement('button');
      btn.className = 'w-6 h-6 rounded-full border border-white/20 transition-all hover:scale-125 active:scale-95 shadow-sm hover:shadow-md';
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
    noteBtn.className = 'px-2.5 py-1 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-medium flex items-center space-x-1.5 transition hover:scale-105 active:scale-95';
    noteBtn.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
      <span>Note</span>
    `;
    noteBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this._applyHighlightAndNote();
    });

    // TTS Read button
    const ttsBtn = document.createElement('button');
    ttsBtn.className = 'px-2.5 py-1 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-medium flex items-center space-x-1.5 transition hover:scale-105 active:scale-95';
    ttsBtn.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
      <span>Read</span>
    `;
    ttsBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (this.activeSelection && this.activeSelection.text) {
        tts.speak(this.activeSelection.text);
        this.hideSelectionToolbar();
      }
    });

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition hover:scale-105 active:scale-95';
    copyBtn.title = 'Copy Text';
    copyBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
    copyBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (this.activeSelection && this.activeSelection.text) {
        navigator.clipboard.writeText(this.activeSelection.text);
        this.hideSelectionToolbar();
      }
    });

    this.selectionToolbar.appendChild(colorsContainer);
    this.selectionToolbar.appendChild(noteBtn);
    this.selectionToolbar.appendChild(ttsBtn);
    this.selectionToolbar.appendChild(copyBtn);
    document.body.appendChild(this.selectionToolbar);

    // Text selection listener
    document.addEventListener('selectionchange', () => {
      this._handleSelectionChange();
    });

    // Dismiss popups on click outside
    document.addEventListener('mousedown', (e) => {
      if (this.selectionToolbar && !this.selectionToolbar.contains(e.target)) {
        if (!window.getSelection()?.isCollapsed) {
          // keep
        } else {
          this.hideSelectionToolbar();
        }
      }
      if (this.highlightPopover && !this.highlightPopover.contains(e.target) && !e.target.closest('.pdf-highlight')) {
        this.hideHighlightPopover();
      }
    });
  }

  _initHighlightPopover() {
    // Popover shown when user clicks on an existing highlight to edit/remove it
    this.highlightPopover = document.createElement('div');
    this.highlightPopover.className = 'highlight-popover fixed z-50 hidden glass-dropdown rounded-2xl shadow-2xl p-2 flex items-center space-x-2 border border-slate-700/80 text-xs animate-in fade-in zoom-in-95 duration-100';
    document.body.appendChild(this.highlightPopover);
  }

  showHighlightPopover(hl, targetElement) {
    this.activeHighlight = hl;
    const rect = targetElement.getBoundingClientRect();

    this.highlightPopover.innerHTML = `
      <div class="flex items-center space-x-1.5 pr-2 border-r border-slate-700/70">
        ${Object.values(HighlightColors).map(col => `
          <button class="btn-change-color w-5 h-5 rounded-full border ${hl.color === col.id ? 'ring-2 ring-white scale-110' : 'border-white/20'} transition hover:scale-125" style="background-color: ${col.hex}" data-color="${col.id}" title="Change to ${col.name}"></button>
        `).join('')}
      </div>
      <button id="btn-pop-note" class="px-2 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-medium flex items-center space-x-1 transition" title="Add or Edit Note">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
        <span>Note</span>
      </button>
      <button id="btn-pop-tts" class="px-2 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-medium flex items-center space-x-1 transition" title="Read Aloud">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
        <span>Read</span>
      </button>
      <button id="btn-pop-delete" class="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white font-medium flex items-center space-x-1 transition" title="Remove Highlight">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        <span>Remove</span>
      </button>
    `;

    // Position popover right above the clicked highlight
    this.highlightPopover.style.left = `${Math.max(10, rect.left + rect.width / 2)}px`;
    this.highlightPopover.style.top = `${Math.max(10, rect.top - 46)}px`;
    this.highlightPopover.style.transform = 'translateX(-50%)';
    this.highlightPopover.classList.remove('hidden');

    // Bind Popover events
    this.highlightPopover.querySelectorAll('.btn-change-color').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newColor = btn.getAttribute('data-color');
        await this.updateHighlightColor(hl.id, newColor);
        this.hideHighlightPopover();
      });
    });

    this.highlightPopover.querySelector('#btn-pop-note')?.addEventListener('click', () => {
      this.onHighlightClicked(hl);
      this.hideHighlightPopover();
    });

    this.highlightPopover.querySelector('#btn-pop-tts')?.addEventListener('click', () => {
      tts.speak(hl.text);
      this.hideHighlightPopover();
    });

    this.highlightPopover.querySelector('#btn-pop-delete')?.addEventListener('click', async () => {
      await this.deleteHighlight(hl.id);
      this.hideHighlightPopover();
    });
  }

  hideHighlightPopover() {
    if (this.highlightPopover) {
      this.highlightPopover.classList.add('hidden');
    }
  }

  async deleteHighlight(hlId) {
    await db.deleteHighlight(hlId);
    this.highlights = this.highlights.filter(h => h.id !== hlId);
    
    // Remove DOM elements immediately
    const els = document.querySelectorAll(`.highlight-id-${hlId}`);
    els.forEach(el => el.remove());

    this.onHighlightDeleted(hlId);
  }

  async updateHighlightColor(hlId, newColor) {
    const hl = this.highlights.find(h => h.id === hlId);
    if (!hl) return;
    hl.color = newColor;
    await db.saveHighlight(hl);

    // Update DOM colors immediately
    const colorObj = HighlightColors[newColor.toUpperCase()] || HighlightColors.YELLOW;
    const els = document.querySelectorAll(`.highlight-id-${hlId}`);
    els.forEach(el => {
      el.className = `pdf-highlight ${colorObj.class} highlight-id-${hl.id}`;
    });

    this.onHighlightUpdated(hl);
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
      this.hideSelectionToolbar();
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

    // Position floating selection toolbar
    this.selectionToolbar.style.left = `${rect.left + rect.width / 2}px`;
    this.selectionToolbar.style.top = `${Math.max(10, rect.top - 48)}px`;
    this.selectionToolbar.style.transform = 'translateX(-50%)';
    this.selectionToolbar.classList.remove('hidden');
  }

  hideSelectionToolbar() {
    if (this.selectionToolbar) {
      this.selectionToolbar.classList.add('hidden');
    }
  }

  async _applyHighlight(colorId) {
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
      color: colorId,
      rects: normalizedRects
    });

    await db.saveHighlight(hl);
    this.highlights.push(hl);
    this._renderHighlightOnPage(pageEl, hl);

    window.getSelection()?.removeAllRanges();
    this.hideSelectionToolbar();
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

    const note = createSideNote({
      fileId: this.currentFile.id,
      highlightId: hl.id,
      pageNumber,
      content: ''
    });
    await db.saveSideNote(note);

    window.getSelection()?.removeAllRanges();
    this.hideSelectionToolbar();
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

    // Page Container with explicit fixed width, height, and flex-shrink-0
    const pageContainer = document.createElement('div');
    pageContainer.className = `pdf-page-container relative mx-auto my-6 shadow-2xl rounded-2xl overflow-hidden flex-shrink-0 transition-all duration-200 pdf-theme-${this.theme}`;
    pageContainer.id = `page-${pageNum}`;
    pageContainer.setAttribute('data-page-number', pageNum);
    pageContainer.style.width = `${widthPx}px`;
    pageContainer.style.height = `${heightPx}px`;
    pageContainer.style.minWidth = `${widthPx}px`;
    pageContainer.style.minHeight = `${heightPx}px`;

    // Canvas layer with Hi-DPI
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
        el.title = `"${hl.text}" — Click to edit or remove`;
        
        // Click to show contextual highlight popover
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showHighlightPopover(hl, el);
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
