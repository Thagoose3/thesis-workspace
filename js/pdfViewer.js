/**
 * PDF Viewer & Comprehensive Interactive Annotation / Markup Engine for ThesisMind
 * Features: Multi-color Highlighting, Text Boxes, Image Insertion,
 * Freehand Pen, Shapes, Eraser Tool, Undo, and Page Drawing Clear.
 */

import { HighlightColors, MarkupColors, PaperThemes, createHighlight, createSideNote, createMarkupItem } from './models.js';
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
    this.markups = [];
    
    // Active tool: 'select' | 'textbox' | 'image' | 'pen' | 'rect' | 'eraser'
    this.activeTool = 'select';
    this.activeColor = '#facc15';
    this.activeStrokeWidth = 2.5;
    this.isDrawing = false;
    this.currentDrawingPath = [];
    
    this.selectionToolbar = null;
    this.highlightPopover = null;
    this.markupDock = null;
    this.activeSelection = null;
    this.activeHighlight = null;
    
    this.onHighlightCreated = options.onHighlightCreated || (() => {});
    this.onHighlightDeleted = options.onHighlightDeleted || (() => {});
    this.onHighlightUpdated = options.onHighlightUpdated || (() => {});
    this.onHighlightClicked = options.onHighlightClicked || (() => {});
    this.onMarkupCreated = options.onMarkupCreated || (() => {});
    this.onMarkupDeleted = options.onMarkupDeleted || (() => {});
    this.onPageChanged = options.onPageChanged || (() => {});
    
    this._initSelectionToolbar();
    this._initHighlightPopover();
    this._initMarkupDock();
    this._initScrollObserver();
    this._initClipboardPasteListener();
  }

  _initMarkupDock() {
    this.markupDock = document.createElement('div');
    this.markupDock.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-40 minimal-dropdown rounded-2xl shadow-2xl p-1.5 flex items-center space-x-1 border border-white/[0.08] select-none text-xs';
    
    this.markupDock.innerHTML = `
      <!-- Tool Buttons -->
      <button class="btn-tool px-2.5 py-1.5 rounded-xl font-medium flex items-center space-x-1.5 transition text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] active:scale-95" data-tool="select" title="Cursor / Select (V)">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/></svg>
        <span class="hidden sm:inline text-[11px]">Select</span>
      </button>

      <button class="btn-tool px-2.5 py-1.5 rounded-xl font-medium flex items-center space-x-1.5 transition text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] active:scale-95" data-tool="textbox" title="Add Sticky Text Box (T)">
        <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
        <span class="hidden sm:inline text-[11px]">Text</span>
      </button>

      <button class="btn-tool px-2.5 py-1.5 rounded-xl font-medium flex items-center space-x-1.5 transition text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] active:scale-95" data-tool="image" title="Insert Image / Figure">
        <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
        <span class="hidden sm:inline text-[11px]">Image</span>
      </button>

      <button class="btn-tool px-2.5 py-1.5 rounded-xl font-medium flex items-center space-x-1.5 transition text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] active:scale-95" data-tool="pen" title="Freehand Pen (P)">
        <svg class="w-3.5 h-3.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        <span class="hidden sm:inline text-[11px]">Draw</span>
      </button>

      <button class="btn-tool px-2.5 py-1.5 rounded-xl font-medium flex items-center space-x-1.5 transition text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] active:scale-95" data-tool="rect" title="Box / Frame">
        <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"></path></svg>
        <span class="hidden sm:inline text-[11px]">Box</span>
      </button>

      <!-- Eraser Tool (ยางลบ) -->
      <button class="btn-tool px-2.5 py-1.5 rounded-xl font-medium flex items-center space-x-1.5 transition text-zinc-400 hover:text-rose-300 hover:bg-rose-950/40 active:scale-95" data-tool="eraser" title="Eraser (E) - Click/Drag over drawing to erase">
        <svg class="w-3.5 h-3.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        <span class="hidden sm:inline text-[11px]">Eraser</span>
      </button>

      <!-- Undo Drawing Button -->
      <button id="btn-undo-drawing" class="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition" title="Undo Drawing (Ctrl+Z)">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2m0 0l-3-3m3 3l3-3M3 10l3-3m-3 3l3 3"/></svg>
      </button>

      <!-- Color Swatches -->
      <div class="flex items-center space-x-1 pl-1.5 border-l border-white/[0.08]">
        ${MarkupColors.slice(0, 5).map(c => `
          <button class="btn-markup-color w-4 h-4 rounded-full border border-white/20 transition hover:scale-125" style="background-color: ${c.id}" data-color="${c.id}" title="${c.name}"></button>
        `).join('')}
      </div>

      <input type="file" id="markup-image-input" accept="image/*" class="hidden" />
    `;

    document.body.appendChild(this.markupDock);
    this._bindMarkupDockEvents();
    this.setTool('select');
  }

  _bindMarkupDockEvents() {
    this.markupDock.querySelectorAll('.btn-tool').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        if (tool === 'image') {
          const imgInput = this.markupDock.querySelector('#markup-image-input');
          if (imgInput) imgInput.click();
        } else {
          this.setTool(tool);
        }
      });
    });

    this.markupDock.querySelectorAll('.btn-markup-color').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeColor = btn.getAttribute('data-color');
        this.markupDock.querySelectorAll('.btn-markup-color').forEach(b => b.classList.remove('ring-2', 'ring-white', 'scale-110'));
        btn.classList.add('ring-2', 'ring-white', 'scale-110');
      });
    });

    // Undo Drawing
    this.markupDock.querySelector('#btn-undo-drawing')?.addEventListener('click', async () => {
      await this.undoLastDrawing();
    });

    // Image Upload
    const imgInput = this.markupDock.querySelector('#markup-image-input');
    if (imgInput) {
      imgInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = async (event) => {
            await this.insertImageOnPage(this.currentPage, event.target.result, file.name);
            imgInput.value = '';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'v' || e.key === 'V') this.setTool('select');
      if (e.key === 't' || e.key === 'T') this.setTool('textbox');
      if (e.key === 'p' || e.key === 'P') this.setTool('pen');
      if (e.key === 'e' || e.key === 'E') this.setTool('eraser');
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        this.undoLastDrawing();
      }
    });
  }

  _initClipboardPasteListener() {
    window.addEventListener('paste', async (e) => {
      if (!this.currentFile) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = async (event) => {
            await this.insertImageOnPage(this.currentPage, event.target.result, 'Pasted Figure');
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    });
  }

  setTool(tool) {
    this.activeTool = tool;
    this.markupDock.querySelectorAll('.btn-tool').forEach(btn => {
      const isCurrent = btn.getAttribute('data-tool') === tool;
      if (isCurrent) {
        btn.className = 'btn-tool px-2.5 py-1.5 rounded-xl font-medium flex items-center space-x-1.5 transition bg-blue-600 text-white shadow-sm scale-105';
      } else {
        btn.className = 'btn-tool px-2.5 py-1.5 rounded-xl font-medium flex items-center space-x-1.5 transition text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] active:scale-95';
      }
    });

    const drawingCanvases = this.container.querySelectorAll('.drawing-canvas');
    drawingCanvases.forEach(c => {
      if (tool === 'pen' || tool === 'rect' || tool === 'eraser') {
        c.classList.add('active');
        c.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
      } else {
        c.classList.remove('active');
        c.style.cursor = 'default';
      }
    });
  }

  async undoLastDrawing() {
    if (!this.currentFile) return;
    const pageDrawings = this.markups.filter(m => m.pageNumber === this.currentPage && m.type === 'drawing');
    if (pageDrawings.length > 0) {
      const last = pageDrawings[pageDrawings.length - 1];
      await db.deleteMarkup(last.id);
      this.markups = this.markups.filter(m => m.id !== last.id);
      this._redrawPageCanvas(this.currentPage);
    }
  }

  _redrawPageCanvas(pageNum) {
    const pageContainer = document.getElementById(`page-${pageNum}`);
    if (!pageContainer) return;
    const canvas = pageContainer.querySelector('.drawing-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pageMarkups = this.markups.filter(m => m.pageNumber === pageNum && m.type === 'drawing');
    pageMarkups.forEach(m => {
      this._renderDrawing(canvas, m);
    });
  }

  _initSelectionToolbar() {
    this.selectionToolbar = document.createElement('div');
    this.selectionToolbar.className = 'floating-toolbar fixed z-50 hidden minimal-dropdown rounded-2xl shadow-2xl p-1.5 flex items-center space-x-1.5 border border-white/[0.1] text-xs';
    
    const colorsContainer = document.createElement('div');
    colorsContainer.className = 'flex items-center space-x-1 pr-1.5 border-r border-white/[0.08]';

    Object.values(HighlightColors).forEach(col => {
      const btn = document.createElement('button');
      btn.className = 'w-5 h-5 rounded-full border border-white/20 transition-all hover:scale-125 active:scale-95 shadow-sm';
      btn.style.backgroundColor = col.hex;
      btn.title = `Highlight ${col.name}`;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._applyHighlight(col.id);
      });
      colorsContainer.appendChild(btn);
    });

    const noteBtn = document.createElement('button');
    noteBtn.className = 'px-2 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white font-medium flex items-center space-x-1 transition';
    noteBtn.innerHTML = `<span>Note</span>`;
    noteBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this._applyHighlightAndNote();
    });

    const ttsBtn = document.createElement('button');
    ttsBtn.className = 'px-2 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white font-medium flex items-center space-x-1 transition';
    ttsBtn.innerHTML = `<span>Read</span>`;
    ttsBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (this.activeSelection && this.activeSelection.text) {
        tts.speak(this.activeSelection.text);
        this.hideSelectionToolbar();
      }
    });

    this.selectionToolbar.appendChild(colorsContainer);
    this.selectionToolbar.appendChild(noteBtn);
    this.selectionToolbar.appendChild(ttsBtn);
    document.body.appendChild(this.selectionToolbar);

    document.addEventListener('selectionchange', () => {
      this._handleSelectionChange();
    });

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
    this.highlightPopover = document.createElement('div');
    this.highlightPopover.className = 'highlight-popover fixed z-50 hidden minimal-dropdown rounded-2xl shadow-2xl p-1.5 flex items-center space-x-1.5 border border-white/[0.1] text-xs';
    document.body.appendChild(this.highlightPopover);
  }

  showHighlightPopover(hl, targetElement) {
    this.activeHighlight = hl;
    const rect = targetElement.getBoundingClientRect();

    this.highlightPopover.innerHTML = `
      <div class="flex items-center space-x-1 pr-1.5 border-r border-white/[0.08]">
        ${Object.values(HighlightColors).map(col => `
          <button class="btn-change-color w-4 h-4 rounded-full border ${hl.color === col.id ? 'ring-2 ring-white scale-110' : 'border-white/20'} transition hover:scale-125" style="background-color: ${col.hex}" data-color="${col.id}"></button>
        `).join('')}
      </div>
      <button id="btn-pop-note" class="px-2 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white font-medium transition">Note</button>
      <button id="btn-pop-tts" class="px-2 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white font-medium transition">Read</button>
      <button id="btn-pop-delete" class="px-2 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white font-medium transition">Remove</button>
    `;

    this.highlightPopover.style.left = `${Math.max(10, rect.left + rect.width / 2)}px`;
    this.highlightPopover.style.top = `${Math.max(10, rect.top - 42)}px`;
    this.highlightPopover.style.transform = 'translateX(-50%)';
    this.highlightPopover.classList.remove('hidden');

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
    
    const els = document.querySelectorAll(`.highlight-id-${hlId}`);
    els.forEach(el => el.remove());

    this.onHighlightDeleted(hlId);
  }

  async updateHighlightColor(hlId, newColor) {
    const hl = this.highlights.find(h => h.id === hlId);
    if (!hl) return;
    hl.color = newColor;
    await db.saveHighlight(hl);

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
    if (this.activeTool !== 'select') return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

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

    this.selectionToolbar.style.left = `${rect.left + rect.width / 2}px`;
    this.selectionToolbar.style.top = `${Math.max(10, rect.top - 44)}px`;
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
      <div class="flex flex-col items-center justify-center h-full min-h-[400px] text-zinc-500 space-y-2">
        <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-xs font-medium">Loading document...</p>
      </div>
    `;

    try {
      this.highlights = await db.getHighlights(paperFile.id);
      this.markups = await db.getMarkups(paperFile.id);
      
      const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
      if (!pdfjsLib) throw new Error('PDF.js library is not loaded');

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

      for (let num = 1; num <= this.totalPages; num++) {
        await this._renderPage(num);
      }
    } catch (err) {
      console.error('Error loading PDF:', err);
      this.container.innerHTML = `
        <div class="p-6 text-center text-rose-400 bg-rose-950/20 border border-rose-800/40 rounded-2xl m-6">
          <p class="font-medium text-xs mb-1">Failed to load PDF</p>
          <p class="text-[10px] text-zinc-500">${err.message}</p>
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

    const pageContainer = document.createElement('div');
    pageContainer.className = `pdf-page-container relative mx-auto my-6 rounded-2xl overflow-hidden flex-shrink-0 transition-all duration-150 pdf-theme-${this.theme}`;
    pageContainer.id = `page-${pageNum}`;
    pageContainer.setAttribute('data-page-number', pageNum);
    pageContainer.style.width = `${widthPx}px`;
    pageContainer.style.height = `${heightPx}px`;
    pageContainer.style.minWidth = `${widthPx}px`;
    pageContainer.style.minHeight = `${heightPx}px`;

    // Canvas layer
    const canvas = document.createElement('canvas');
    canvas.className = 'block absolute top-0 left-0 z-[1]';
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${widthPx}px`;
    canvas.style.height = `${heightPx}px`;
    const ctx = canvas.getContext('2d');
    pageContainer.appendChild(canvas);

    // Text layer
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${widthPx}px`;
    textLayerDiv.style.height = `${heightPx}px`;
    pageContainer.appendChild(textLayerDiv);

    // Highlight overlay layer
    const highlightLayer = document.createElement('div');
    highlightLayer.className = 'highlight-layer absolute top-0 left-0 w-full h-full pointer-events-none z-[3]';
    pageContainer.appendChild(highlightLayer);

    // Interactive Markup Layer
    const markupLayer = document.createElement('div');
    markupLayer.className = 'markup-layer';
    pageContainer.appendChild(markupLayer);

    // Drawing Canvas Layer
    const drawingCanvas = document.createElement('canvas');
    drawingCanvas.className = `drawing-canvas ${this.activeTool === 'pen' || this.activeTool === 'rect' || this.activeTool === 'eraser' ? 'active' : ''}`;
    drawingCanvas.width = widthPx;
    drawingCanvas.height = heightPx;
    pageContainer.appendChild(drawingCanvas);

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

    // Render Highlights
    const pageHighlights = this.highlights.filter(h => h.pageNumber === pageNum);
    pageHighlights.forEach(hl => {
      this._renderHighlightOnPage(pageContainer, hl);
    });

    // Render Markups
    const pageMarkups = this.markups.filter(m => m.pageNumber === pageNum);
    pageMarkups.forEach(m => {
      if (m.type === 'textbox') this._renderTextBox(pageContainer, m);
      if (m.type === 'image') this._renderImageBox(pageContainer, m);
      if (m.type === 'drawing') this._renderDrawing(drawingCanvas, m);
    });

    this._bindPageMarkupEvents(pageContainer, drawingCanvas, pageNum);
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
          this.showHighlightPopover(hl, el);
        });

        highlightLayer.appendChild(el);
      });
    }
  }

  _bindPageMarkupEvents(pageContainer, drawingCanvas, pageNum) {
    pageContainer.addEventListener('click', async (e) => {
      if (this.activeTool === 'textbox') {
        if (e.target.closest('.markup-textbox') || e.target.closest('.markup-image-box')) return;
        const rect = pageContainer.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        const markup = createMarkupItem({
          fileId: this.currentFile.id,
          pageNumber: pageNum,
          type: 'textbox',
          x,
          y,
          width: 0.28,
          height: 0.08,
          data: {
            text: 'Type your note...',
            bgColor: '#fef08a',
            textColor: '#18181b',
            fontSize: 12
          }
        });

        await db.saveMarkup(markup);
        this.markups.push(markup);
        this._renderTextBox(pageContainer, markup, true);
        this.onMarkupCreated(markup);
        this.setTool('select');
      }
    });

    const ctx = drawingCanvas.getContext('2d');
    let startX = 0;
    let startY = 0;

    const startDraw = async (e) => {
      const rect = drawingCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Handle ERASER tool
      if (this.activeTool === 'eraser') {
        const normX = clickX / rect.width;
        const normY = clickY / rect.height;

        // Find drawing markup near click
        const pageDrawings = this.markups.filter(m => m.pageNumber === pageNum && m.type === 'drawing');
        for (const m of pageDrawings) {
          let hit = false;
          if (m.data.shapeType === 'rect') {
            if (normX >= m.x && normX <= m.x + m.width && normY >= m.y && normY <= m.y + m.height) {
              hit = true;
            }
          } else if (m.data.paths) {
            for (const p of m.data.paths) {
              const dx = Math.abs(p.x - normX) * rect.width;
              const dy = Math.abs(p.y - normY) * rect.height;
              if (Math.sqrt(dx * dx + dy * dy) < 20) {
                hit = true;
                break;
              }
            }
          }

          if (hit) {
            await db.deleteMarkup(m.id);
            this.markups = this.markups.filter(item => item.id !== m.id);
            this._redrawPageCanvas(pageNum);
            break;
          }
        }
        return;
      }

      if (this.activeTool !== 'pen' && this.activeTool !== 'rect') return;
      this.isDrawing = true;
      startX = clickX;
      startY = clickY;
      this.currentDrawingPath = [{ x: startX, y: startY }];
    };

    const drawMove = async (e) => {
      const rect = drawingCanvas.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;

      // Eraser drag support
      if (this.activeTool === 'eraser' && (e.buttons === 1)) {
        const normX = curX / rect.width;
        const normY = curY / rect.height;
        const pageDrawings = this.markups.filter(m => m.pageNumber === pageNum && m.type === 'drawing');
        for (const m of pageDrawings) {
          let hit = false;
          if (m.data.shapeType === 'rect') {
            if (normX >= m.x && normX <= m.x + m.width && normY >= m.y && normY <= m.y + m.height) {
              hit = true;
            }
          } else if (m.data.paths) {
            for (const p of m.data.paths) {
              const dx = Math.abs(p.x - normX) * rect.width;
              const dy = Math.abs(p.y - normY) * rect.height;
              if (Math.sqrt(dx * dx + dy * dy) < 18) {
                hit = true;
                break;
              }
            }
          }
          if (hit) {
            await db.deleteMarkup(m.id);
            this.markups = this.markups.filter(item => item.id !== m.id);
            this._redrawPageCanvas(pageNum);
            break;
          }
        }
        return;
      }

      if (!this.isDrawing) return;

      if (this.activeTool === 'pen') {
        ctx.strokeStyle = this.activeColor;
        ctx.lineWidth = this.activeStrokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        const prev = this.currentDrawingPath[this.currentDrawingPath.length - 1];
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curX, curY);
        ctx.stroke();

        this.currentDrawingPath.push({ x: curX, y: curY });
      }
    };

    const stopDraw = async (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;

      const rect = drawingCanvas.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;

      if (this.activeTool === 'rect') {
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX);
        const h = Math.abs(endY - startY);

        if (w > 10 && h > 10) {
          ctx.strokeStyle = this.activeColor;
          ctx.lineWidth = this.activeStrokeWidth;
          ctx.strokeRect(x, y, w, h);

          const markup = createMarkupItem({
            fileId: this.currentFile.id,
            pageNumber: pageNum,
            type: 'drawing',
            x: x / rect.width,
            y: y / rect.height,
            width: w / rect.width,
            height: h / rect.height,
            data: {
              shapeType: 'rect',
              strokeColor: this.activeColor,
              strokeWidth: this.activeStrokeWidth
            }
          });
          await db.saveMarkup(markup);
          this.markups.push(markup);
        }
      } else if (this.activeTool === 'pen' && this.currentDrawingPath.length > 2) {
        const markup = createMarkupItem({
          fileId: this.currentFile.id,
          pageNumber: pageNum,
          type: 'drawing',
          data: {
            paths: this.currentDrawingPath.map(p => ({ x: p.x / rect.width, y: p.y / rect.height })),
            strokeColor: this.activeColor,
            strokeWidth: this.activeStrokeWidth
          }
        });
        await db.saveMarkup(markup);
        this.markups.push(markup);
      }
    };

    drawingCanvas.addEventListener('mousedown', startDraw);
    drawingCanvas.addEventListener('mousemove', drawMove);
    drawingCanvas.addEventListener('mouseup', stopDraw);
    drawingCanvas.addEventListener('mouseleave', stopDraw);
  }

  _renderTextBox(pageContainer, markup, autoFocus = false) {
    const markupLayer = pageContainer.querySelector('.markup-layer') || pageContainer;

    const el = document.createElement('div');
    el.className = 'markup-textbox group';
    el.id = `markup-${markup.id}`;
    el.style.left = `${markup.x * 100}%`;
    el.style.top = `${markup.y * 100}%`;
    el.style.width = `${markup.width * 100}%`;
    el.style.backgroundColor = markup.data.bgColor || '#fef08a';
    el.style.color = markup.data.textColor || '#18181b';

    el.innerHTML = `
      <div class="flex items-center justify-between opacity-0 group-hover:opacity-100 transition mb-1 -mt-1 -mr-1">
        <div class="flex items-center space-x-1">
          <button class="w-3 h-3 rounded-full bg-yellow-200 border border-black/20 btn-tb-color" data-color="#fef08a"></button>
          <button class="w-3 h-3 rounded-full bg-blue-200 border border-black/20 btn-tb-color" data-color="#bfdbfe"></button>
          <button class="w-3 h-3 rounded-full bg-emerald-200 border border-black/20 btn-tb-color" data-color="#bbf7d0"></button>
          <button class="w-3 h-3 rounded-full bg-pink-200 border border-black/20 btn-tb-color" data-color="#fbcfe8"></button>
        </div>
        <button class="p-0.5 rounded text-black/50 hover:text-black hover:bg-black/10 transition btn-delete-markup">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <textarea class="tb-input" rows="2" style="font-size: ${markup.data.fontSize || 12}px">${markup.data.text || ''}</textarea>
    `;

    markupLayer.appendChild(el);

    const textarea = el.querySelector('.tb-input');
    if (autoFocus) {
      textarea.focus();
      textarea.select();
    }

    textarea.addEventListener('input', () => {
      markup.data.text = textarea.value;
      db.saveMarkup(markup);
    });

    el.querySelectorAll('.btn-tb-color').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = btn.getAttribute('data-color');
        el.style.backgroundColor = color;
        markup.data.bgColor = color;
        db.saveMarkup(markup);
      });
    });

    el.querySelector('.btn-delete-markup')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await db.deleteMarkup(markup.id);
      this.markups = this.markups.filter(m => m.id !== markup.id);
      el.remove();
      this.onMarkupDeleted(markup.id);
    });

    this._makeDraggable(el, pageContainer, markup);
  }

  _renderImageBox(pageContainer, markup) {
    const markupLayer = pageContainer.querySelector('.markup-layer') || pageContainer;

    const el = document.createElement('div');
    el.className = 'markup-image-box group';
    el.id = `markup-${markup.id}`;
    el.style.left = `${markup.x * 100}%`;
    el.style.top = `${markup.y * 100}%`;
    el.style.width = `${markup.width * 100}%`;

    el.innerHTML = `
      <div class="relative">
        <img src="${markup.data.src}" alt="Figure" class="rounded-md object-contain max-h-64" />
        <button class="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition btn-delete-img">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <input type="text" class="w-full mt-1 px-1.5 py-0.5 bg-black/50 rounded text-[10px] font-mono text-zinc-300 text-center border-none focus:outline-none placeholder-zinc-600" value="${markup.data.caption || ''}" placeholder="Figure caption..." />
    `;

    markupLayer.appendChild(el);

    const captionInput = el.querySelector('input');
    captionInput?.addEventListener('input', () => {
      markup.data.caption = captionInput.value;
      db.saveMarkup(markup);
    });

    el.querySelector('.btn-delete-img')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await db.deleteMarkup(markup.id);
      this.markups = this.markups.filter(m => m.id !== markup.id);
      el.remove();
      this.onMarkupDeleted(markup.id);
    });

    this._makeDraggable(el, pageContainer, markup);
  }

  _renderDrawing(canvas, markup) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    if (markup.data.shapeType === 'rect') {
      ctx.strokeStyle = markup.data.strokeColor || '#f87171';
      ctx.lineWidth = markup.data.strokeWidth || 2.5;
      ctx.strokeRect(markup.x * width, markup.y * height, markup.width * width, markup.height * height);
    } else if (markup.data.paths && markup.data.paths.length > 1) {
      ctx.strokeStyle = markup.data.strokeColor || '#f87171';
      ctx.lineWidth = markup.data.strokeWidth || 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const p0 = markup.data.paths[0];
      ctx.moveTo(p0.x * width, p0.y * height);
      for (let i = 1; i < markup.data.paths.length; i++) {
        const p = markup.data.paths[i];
        ctx.lineTo(p.x * width, p.y * height);
      }
      ctx.stroke();
    }
  }

  _makeDraggable(element, container, markup) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let elemStartX = 0, elemStartY = 0;

    element.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      elemStartX = element.offsetLeft;
      elemStartY = element.offsetTop;
      element.style.cursor = 'grabbing';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const containerRect = container.getBoundingClientRect();

      const newLeft = Math.max(0, Math.min(containerRect.width - element.offsetWidth, elemStartX + dx));
      const newTop = Math.max(0, Math.min(containerRect.height - element.offsetHeight, elemStartY + dy));

      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
      element.style.transform = 'none';

      markup.x = newLeft / containerRect.width;
      markup.y = newTop / containerRect.height;
    });

    window.addEventListener('mouseup', async () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
        await db.saveMarkup(markup);
      }
    });
  }

  async insertImageOnPage(pageNum, srcDataUrl, caption = '') {
    if (!this.currentFile) return;

    const pageContainer = document.getElementById(`page-${pageNum}`);
    if (!pageContainer) return;

    const markup = createMarkupItem({
      fileId: this.currentFile.id,
      pageNumber: pageNum,
      type: 'image',
      x: 0.2,
      y: 0.3,
      width: 0.45,
      height: 0.3,
      data: {
        src: srcDataUrl,
        caption: caption || 'Inserted Figure'
      }
    });

    await db.saveMarkup(markup);
    this.markups.push(markup);
    this._renderImageBox(pageContainer, markup);
    this.onMarkupCreated(markup);
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
      setTimeout(() => el.classList.remove('highlight-flash'), 1000);
    });
  }
}
