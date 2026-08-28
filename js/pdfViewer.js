/**
 * PDF Viewer & Comprehensive Interactive Annotation / Markup Engine for ThesisMind
 * Features:
 * - Page Rotation (หมุนแนวตั้ง/แนวนอน แยกตามหน้าหรือหน้าปัจจุบัน 90°, 180°, 270°)
 * - High-performance canvas rendering & detached ArrayBuffer protection
 * - Multi-color Highlights, Sticky Text Boxes, Image Insertions, Freehand Pen, Box shapes, Eraser & Undo
 */

import { HighlightColors, MarkupColors, PaperThemes, createHighlight, createSideNote, createMarkupItem } from './models.js';
import { db } from './db.js';
import { tts } from './tts.js';

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

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
    this.pageRotations = {}; // { [pageNum]: degrees (0, 90, 180, 270) }
    
    // Active tool: 'select' | 'textbox' | 'image' | 'pen' | 'rect' | 'eraser'
    this.activeTool = 'select';
    this.activeColor = '#facc15';
    this.activeStrokeWidth = 2.5;
    this.isDrawing = false;
    this.currentDrawingPath = [];
    
    this.selectionToolbar = null;
    this.highlightPopover = null;
    this.markupDock = null;
    this.textboxFormatBar = null;
    this.activeTextboxMarkup = null;
    this.activeTextboxEl = null;
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
    this._initTextboxFormatBar();
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
      <button class="btn-tool px-2.5 py-1.5 rounded-xl font-medium flex items-center space-x-1.5 transition text-zinc-400 hover:text-rose-300 hover:bg-rose-950/40 active:scale-95" data-tool="eraser" title="Eraser (E) - Drag over drawing to erase">
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

    this.markupDock.querySelector('#btn-undo-drawing')?.addEventListener('click', async () => {
      await this.undoLastDrawing();
    });

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

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'v' || e.key === 'V') this.setTool('select');
      if (e.key === 't' || e.key === 'T') this.setTool('textbox');
      if (e.key === 'p' || e.key === 'P') this.setTool('pen');
      if (e.key === 'e' || e.key === 'E') this.setTool('eraser');
      if (e.key === 'r' || e.key === 'R') this.rotateCurrentPage();
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
        c.style.cursor = tool === 'eraser' ? 'pointer' : 'crosshair';
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

  // Rotate a specific page 90 degrees
  async rotatePage(pageNum, degrees = 90) {
    if (!this.currentFile || !this.pdfDoc) return;
    
    this.pageRotations[pageNum] = ((this.pageRotations[pageNum] || 0) + degrees) % 360;
    await db.saveSetting(`rotations_${this.currentFile.id}`, this.pageRotations);
    
    await this._rerenderSinglePage(pageNum);
  }

  // Rotate currently viewed page
  async rotateCurrentPage(degrees = 90) {
    if (this.currentPage) {
      await this.rotatePage(this.currentPage, degrees);
    }
  }

  async _rerenderSinglePage(pageNum) {
    const oldContainer = document.getElementById(`page-${pageNum}`);
    if (!oldContainer || !this.pdfDoc) return;

    const page = await this.pdfDoc.getPage(pageNum);
    const pageRotation = (page.rotate + (this.pageRotations[pageNum] || 0)) % 360;
    const viewport = page.getViewport({ scale: this.scale, rotation: pageRotation });
    const outputScale = window.devicePixelRatio || 1;

    const widthPx = Math.floor(viewport.width);
    const heightPx = Math.floor(viewport.height);

    const newContainer = document.createElement('div');
    newContainer.className = `pdf-page-container group relative mx-auto my-6 rounded-2xl overflow-hidden flex-shrink-0 transition-all duration-150 pdf-theme-${this.theme}`;
    newContainer.id = `page-${pageNum}`;
    newContainer.setAttribute('data-page-number', pageNum);
    newContainer.style.width = `${widthPx}px`;
    newContainer.style.height = `${heightPx}px`;
    newContainer.style.minWidth = `${widthPx}px`;
    newContainer.style.minHeight = `${heightPx}px`;

    // Canvas layer
    const canvas = document.createElement('canvas');
    canvas.className = 'block absolute top-0 left-0 z-[1]';
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${widthPx}px`;
    canvas.style.height = `${heightPx}px`;
    const ctx = canvas.getContext('2d');
    newContainer.appendChild(canvas);

    // Text layer
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${widthPx}px`;
    textLayerDiv.style.height = `${heightPx}px`;
    newContainer.appendChild(textLayerDiv);

    // Highlight overlay layer
    const highlightLayer = document.createElement('div');
    highlightLayer.className = 'highlight-layer absolute top-0 left-0 w-full h-full pointer-events-none z-[3]';
    newContainer.appendChild(highlightLayer);

    // Interactive Markup Layer
    const markupLayer = document.createElement('div');
    markupLayer.className = 'markup-layer';
    newContainer.appendChild(markupLayer);

    // Drawing Canvas Layer
    const drawingCanvas = document.createElement('canvas');
    drawingCanvas.className = `drawing-canvas ${this.activeTool === 'pen' || this.activeTool === 'rect' || this.activeTool === 'eraser' ? 'active' : ''}`;
    drawingCanvas.width = widthPx;
    drawingCanvas.height = heightPx;
    newContainer.appendChild(drawingCanvas);

    // Floating Rotate Page Button (Top Right corner)
    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'btn-rotate-page absolute top-2.5 right-2.5 p-1.5 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition shadow-lg z-20 border border-white/[0.08]';
    rotateBtn.setAttribute('data-page', pageNum);
    rotateBtn.title = 'Rotate this page 90° (หมุนแนวตั้ง/แนวนอน)';
    rotateBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.rotatePage(pageNum);
    });
    newContainer.appendChild(rotateBtn);

    oldContainer.replaceWith(newContainer);

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
      textLayerDiv.style.setProperty('--scale-factor', `${viewport.scale}`);
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
      this._renderHighlightOnPage(newContainer, hl);
    });

    // Render Markups
    const pageMarkups = this.markups.filter(m => m.pageNumber === pageNum);
    pageMarkups.forEach(m => {
      if (m.type === 'textbox') this._renderTextBox(newContainer, m);
      if (m.type === 'image') this._renderImageBox(newContainer, m);
      if (m.type === 'drawing') this._renderDrawing(drawingCanvas, m);
    });

    this._bindPageMarkupEvents(newContainer, drawingCanvas, pageNum);
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

    // Show toolbar ONLY on mouseup after user finishes selecting text cleanly
    document.addEventListener('mouseup', (e) => {
      if (this.activeTool !== 'select') return;
      if (this.selectionToolbar && this.selectionToolbar.contains(e.target)) return;
      if (this.highlightPopover && this.highlightPopover.contains(e.target)) return;
      
      // Delay slightly so browser selection range settles accurately
      setTimeout(() => {
        this._handleSelectionChange();
      }, 20);
    });

    // Hide toolbar when selection is cleared
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        this.hideSelectionToolbar();
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (this.selectionToolbar && !this.selectionToolbar.contains(e.target)) {
        if (window.getSelection()?.isCollapsed) {
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

    const isCurrentlyPlaying = tts.isPlaying && tts.currentText === hl.text.trim();

    this.highlightPopover.innerHTML = `
      <div class="flex items-center space-x-1 pr-1.5 border-r border-white/[0.08]">
        ${Object.values(HighlightColors).map(col => `
          <button class="btn-change-color w-4 h-4 rounded-full border ${hl.color === col.id ? 'ring-2 ring-white scale-110' : 'border-white/20'} transition hover:scale-125" style="background-color: ${col.hex}" data-color="${col.id}"></button>
        `).join('')}
      </div>
      <button id="btn-pop-note" class="px-2 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white font-medium transition">Note</button>
      <button id="btn-pop-tts" class="px-2 py-1 rounded-lg ${isCurrentlyPlaying ? 'bg-rose-600 text-white' : 'bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white'} font-medium transition flex items-center space-x-1">
        ${isCurrentlyPlaying ? `<span>⏹ Stop</span>` : `<span>🔊 Read</span>`}
      </button>
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
      tts.toggleSpeak(hl.text);
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

  _initTextboxFormatBar() {
    this.textboxFormatBar = document.createElement('div');
    this.textboxFormatBar.className = 'textbox-format-bar fixed z-50 hidden minimal-dropdown rounded-2xl shadow-2xl px-2.5 py-1.5 flex items-center space-x-2 border border-white/[0.12] text-xs select-none backdrop-blur-xl';
    
    this.textboxFormatBar.innerHTML = `
      <!-- Font Size Adjuster -->
      <div class="flex items-center space-x-0.5 bg-white/[0.06] rounded-lg px-1 py-0.5" title="Font Size (ขนาดตัวอักษร)">
        <button id="tb-bar-size-down" class="px-1 text-[11px] font-bold text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded transition">A-</button>
        <span id="tb-bar-size-display" class="text-[10px] font-mono text-zinc-200 px-1 min-w-[28px] text-center font-medium">13px</span>
        <button id="tb-bar-size-up" class="px-1 text-[11px] font-bold text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded transition">A+</button>
      </div>

      <div class="w-px h-3.5 bg-white/[0.1]"></div>

      <!-- Bold & Italic -->
      <div class="flex items-center space-x-0.5">
        <button id="tb-bar-bold" class="w-6 h-6 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] font-bold transition text-xs flex items-center justify-center" title="Bold (ตัวหนา)">B</button>
        <button id="tb-bar-italic" class="w-6 h-6 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] italic font-serif transition text-xs flex items-center justify-center" title="Italic (ตัวเอียง)">I</button>
      </div>

      <div class="w-px h-3.5 bg-white/[0.1]"></div>

      <!-- Text Color Picker -->
      <div class="flex items-center space-x-1" title="Text Color (สีตัวอักษร)">
        <span class="text-[9px] text-zinc-500 font-mono uppercase">Text</span>
        <button class="w-3.5 h-3.5 rounded-full bg-zinc-900 border border-white/40 hover:scale-125 transition tb-bar-text-color" data-color="#18181b" title="Dark Text"></button>
        <button class="w-3.5 h-3.5 rounded-full bg-white border border-white/40 hover:scale-125 transition tb-bar-text-color" data-color="#ffffff" title="White Text"></button>
        <button class="w-3.5 h-3.5 rounded-full bg-blue-500 border border-white/40 hover:scale-125 transition tb-bar-text-color" data-color="#2563eb" title="Blue Text"></button>
        <button class="w-3.5 h-3.5 rounded-full bg-rose-500 border border-white/40 hover:scale-125 transition tb-bar-text-color" data-color="#e11d48" title="Red Text"></button>
      </div>

      <div class="w-px h-3.5 bg-white/[0.1]"></div>

      <!-- Box Background & Border Color Picker -->
      <div class="flex items-center space-x-1" title="Box & Border Color (สีกรอบและพื้นหลัง)">
        <span class="text-[9px] text-zinc-500 font-mono uppercase">Box</span>
        <button class="w-3.5 h-3.5 rounded-full bg-yellow-200 border border-black/20 hover:scale-125 transition tb-bar-box-color" data-bg="#fef08a" data-border="#eab308" title="Yellow"></button>
        <button class="w-3.5 h-3.5 rounded-full bg-blue-200 border border-black/20 hover:scale-125 transition tb-bar-box-color" data-bg="#bfdbfe" data-border="#3b82f6" title="Blue"></button>
        <button class="w-3.5 h-3.5 rounded-full bg-emerald-200 border border-black/20 hover:scale-125 transition tb-bar-box-color" data-bg="#bbf7d0" data-border="#22c55e" title="Green"></button>
        <button class="w-3.5 h-3.5 rounded-full bg-pink-200 border border-black/20 hover:scale-125 transition tb-bar-box-color" data-bg="#fbcfe8" data-border="#ec4899" title="Pink"></button>
        <button class="w-3.5 h-3.5 rounded-full bg-zinc-900 border border-white/30 hover:scale-125 transition tb-bar-box-color" data-bg="#18181b" data-border="#3f3f46" title="Dark Slate"></button>
      </div>

      <div class="w-px h-3.5 bg-white/[0.1]"></div>

      <!-- Delete Button -->
      <button id="tb-bar-delete" class="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition" title="Delete Textbox (ลบกล่องนี้)">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    `;

    document.body.appendChild(this.textboxFormatBar);

    // Font size controls
    this.textboxFormatBar.querySelector('#tb-bar-size-down')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!this.activeTextboxMarkup || !this.activeTextboxEl) return;
      let size = (this.activeTextboxMarkup.data.fontSize || 13) - 1;
      if (size < 9) size = 9;
      this.activeTextboxMarkup.data.fontSize = size;
      const textarea = this.activeTextboxEl.querySelector('.tb-input');
      if (textarea) textarea.style.fontSize = `${size}px`;
      this.textboxFormatBar.querySelector('#tb-bar-size-display').textContent = `${size}px`;
      await db.saveMarkup(this.activeTextboxMarkup);
    });

    this.textboxFormatBar.querySelector('#tb-bar-size-up')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!this.activeTextboxMarkup || !this.activeTextboxEl) return;
      let size = (this.activeTextboxMarkup.data.fontSize || 13) + 1;
      if (size > 36) size = 36;
      this.activeTextboxMarkup.data.fontSize = size;
      const textarea = this.activeTextboxEl.querySelector('.tb-input');
      if (textarea) textarea.style.fontSize = `${size}px`;
      this.textboxFormatBar.querySelector('#tb-bar-size-display').textContent = `${size}px`;
      await db.saveMarkup(this.activeTextboxMarkup);
    });

    // Bold toggle
    this.textboxFormatBar.querySelector('#tb-bar-bold')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!this.activeTextboxMarkup || !this.activeTextboxEl) return;
      this.activeTextboxMarkup.data.isBold = !this.activeTextboxMarkup.data.isBold;
      const textarea = this.activeTextboxEl.querySelector('.tb-input');
      if (textarea) textarea.style.fontWeight = this.activeTextboxMarkup.data.isBold ? 'bold' : 'normal';
      this._updateFormatBarActiveStyles();
      await db.saveMarkup(this.activeTextboxMarkup);
    });

    // Italic toggle
    this.textboxFormatBar.querySelector('#tb-bar-italic')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!this.activeTextboxMarkup || !this.activeTextboxEl) return;
      this.activeTextboxMarkup.data.isItalic = !this.activeTextboxMarkup.data.isItalic;
      const textarea = this.activeTextboxEl.querySelector('.tb-input');
      if (textarea) textarea.style.fontStyle = this.activeTextboxMarkup.data.isItalic ? 'italic' : 'normal';
      this._updateFormatBarActiveStyles();
      await db.saveMarkup(this.activeTextboxMarkup);
    });

    // Text color buttons
    this.textboxFormatBar.querySelectorAll('.tb-bar-text-color').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!this.activeTextboxMarkup || !this.activeTextboxEl) return;
        const color = btn.getAttribute('data-color');
        this.activeTextboxMarkup.data.textColor = color;
        const textarea = this.activeTextboxEl.querySelector('.tb-input');
        if (textarea) textarea.style.color = color;
        await db.saveMarkup(this.activeTextboxMarkup);
      });
    });

    // Box & border color buttons
    this.textboxFormatBar.querySelectorAll('.tb-bar-box-color').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!this.activeTextboxMarkup || !this.activeTextboxEl) return;
        const bg = btn.getAttribute('data-bg');
        const border = btn.getAttribute('data-border');
        this.activeTextboxMarkup.data.bgColor = bg;
        this.activeTextboxMarkup.data.borderColor = border;
        this.activeTextboxEl.style.backgroundColor = bg;
        this.activeTextboxEl.style.borderColor = border;
        await db.saveMarkup(this.activeTextboxMarkup);
      });
    });

    // Delete button
    this.textboxFormatBar.querySelector('#tb-bar-delete')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!this.activeTextboxMarkup || !this.activeTextboxEl) return;
      const mId = this.activeTextboxMarkup.id;
      await db.deleteMarkup(mId);
      this.markups = this.markups.filter(m => m.id !== mId);
      this.activeTextboxEl.remove();
      this.hideTextboxFormatBar();
      this.onMarkupDeleted(mId);
    });

    // Hide formatting bar when clicking outside
    document.addEventListener('mousedown', (e) => {
      if (this.textboxFormatBar && !this.textboxFormatBar.contains(e.target) && !e.target.closest('.markup-textbox')) {
        this.hideTextboxFormatBar();
      }
    });
  }

  showTextboxFormatBar(markup, el) {
    this.activeTextboxMarkup = markup;
    this.activeTextboxEl = el;

    document.querySelectorAll('.markup-textbox').forEach(box => box.classList.remove('selected'));
    el.classList.add('selected');

    const rect = el.getBoundingClientRect();
    const size = markup.data.fontSize || 13;

    const sizeDisplay = this.textboxFormatBar.querySelector('#tb-bar-size-display');
    if (sizeDisplay) sizeDisplay.textContent = `${size}px`;

    this._updateFormatBarActiveStyles();

    const topPos = Math.max(12, rect.top - 46);
    const leftPos = Math.max(180, Math.min(window.innerWidth - 180, rect.left + rect.width / 2));

    this.textboxFormatBar.style.left = `${leftPos}px`;
    this.textboxFormatBar.style.top = `${topPos}px`;
    this.textboxFormatBar.style.transform = 'translateX(-50%)';
    this.textboxFormatBar.classList.remove('hidden');
  }

  _updateFormatBarActiveStyles() {
    if (!this.activeTextboxMarkup || !this.textboxFormatBar) return;
    const boldBtn = this.textboxFormatBar.querySelector('#tb-bar-bold');
    const italicBtn = this.textboxFormatBar.querySelector('#tb-bar-italic');

    if (boldBtn) {
      if (this.activeTextboxMarkup.data.isBold) {
        boldBtn.className = 'w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center';
      } else {
        boldBtn.className = 'w-6 h-6 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] font-bold transition text-xs flex items-center justify-center';
      }
    }

    if (italicBtn) {
      if (this.activeTextboxMarkup.data.isItalic) {
        italicBtn.className = 'w-6 h-6 rounded-lg bg-blue-600 text-white italic font-serif text-xs flex items-center justify-center';
      } else {
        italicBtn.className = 'w-6 h-6 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] italic font-serif transition text-xs flex items-center justify-center';
      }
    }
  }

  hideTextboxFormatBar() {
    if (this.textboxFormatBar) {
      this.textboxFormatBar.classList.add('hidden');
    }
    if (this.activeTextboxEl) {
      this.activeTextboxEl.classList.remove('selected');
      this.activeTextboxEl = null;
      this.activeTextboxMarkup = null;
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
      this.hideSelectionToolbar();
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length === 0) {
      this.hideSelectionToolbar();
      return;
    }

    const range = selection.getRangeAt(0);
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

    if (rect.width === 0 && rect.height === 0) {
      this.hideSelectionToolbar();
      return;
    }

    this.activeSelection = {
      text: selectedText,
      pageNumber: pageNum,
      range: range.cloneRange(),
      pageEl: pageEl,
      rect: rect
    };

    const topPos = Math.max(16, rect.top - 46);
    const leftPos = Math.max(120, Math.min(window.innerWidth - 120, rect.left + rect.width / 2));

    this.selectionToolbar.style.left = `${leftPos}px`;
    this.selectionToolbar.style.top = `${topPos}px`;
    this.selectionToolbar.style.transform = 'translateX(-50%)';
    this.selectionToolbar.classList.remove('hidden');
  }

  hideSelectionToolbar() {
    if (this.selectionToolbar) {
      this.selectionToolbar.classList.add('hidden');
    }
  }

  _extractPreciseSelectionRects(range, pageEl) {
    const pageRect = pageEl.getBoundingClientRect();
    
    // Extract exact text nodes intersecting the range (ignore empty whitespace margins)
    const textNodes = [];
    const root = range.commonAncestorContainer;
    const walker = document.createTreeWalker(
      root.nodeType === Node.TEXT_NODE ? root.parentNode : root,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node = walker.nextNode();
    while (node) {
      if (range.intersectsNode(node) && node.textContent.trim().length > 0) {
        textNodes.push(node);
      }
      node = walker.nextNode();
    }

    const rawRects = [];
    if (textNodes.length > 0) {
      textNodes.forEach(tNode => {
        const subRange = document.createRange();
        const start = (tNode === range.startContainer) ? range.startOffset : 0;
        const end = (tNode === range.endContainer) ? range.endOffset : tNode.textContent.length;
        
        // Trim leading and trailing whitespace so highlights never extend past actual text
        const sliceText = tNode.textContent.substring(start, end);
        const leadingSpaces = (sliceText.match(/^\s+/) || [''])[0].length;
        const trailingSpaces = (sliceText.match(/\s+$/) || [''])[0].length;
        
        const actualStart = start + leadingSpaces;
        const actualEnd = Math.max(actualStart, end - trailingSpaces);
        
        if (actualEnd > actualStart) {
          subRange.setStart(tNode, actualStart);
          subRange.setEnd(tNode, actualEnd);
          Array.from(subRange.getClientRects()).forEach(r => {
            if (r.width > 1 && r.height > 1) {
              rawRects.push(r);
            }
          });
        }
      });
    } else {
      Array.from(range.getClientRects()).forEach(r => {
        if (r.width > 2 && r.height > 2) rawRects.push(r);
      });
    }

    if (!rawRects.length) return [];

    // Group rects into lines by vertical alignment (tolerance 6px)
    const lines = [];
    rawRects.forEach(rect => {
      const matchedLine = lines.find(l => Math.abs(l.top - rect.top) < 6);
      if (matchedLine) {
        matchedLine.rects.push(rect);
        matchedLine.top = Math.min(matchedLine.top, rect.top);
        matchedLine.bottom = Math.max(matchedLine.bottom, rect.bottom);
      } else {
        lines.push({
          top: rect.top,
          bottom: rect.bottom,
          rects: [rect]
        });
      }
    });

    const mergedRects = [];
    lines.forEach(line => {
      line.rects.sort((a, b) => a.left - b.left);
      let cur = {
        left: line.rects[0].left,
        right: line.rects[0].right,
        top: line.top,
        height: line.bottom - line.top
      };

      for (let i = 1; i < line.rects.length; i++) {
        const r = line.rects[i];
        if (r.left <= cur.right + 6) {
          cur.right = Math.max(cur.right, r.right);
        } else {
          mergedRects.push({
            left: cur.left,
            top: cur.top,
            width: cur.right - cur.left,
            height: cur.height
          });
          cur = {
            left: r.left,
            right: r.right,
            top: line.top,
            height: line.bottom - line.top
          };
        }
      }
      mergedRects.push({
        left: cur.left,
        top: cur.top,
        width: cur.right - cur.left,
        height: cur.height
      });
    });

    return mergedRects.map(r => {
      const adjustedTop = r.top + r.height * 0.05;
      const adjustedHeight = r.height * 0.90;
      return {
        left: Math.max(0, (r.left - pageRect.left) / pageRect.width),
        top: Math.max(0, (adjustedTop - pageRect.top) / pageRect.height),
        width: Math.min(1, r.width / pageRect.width),
        height: Math.min(1, adjustedHeight / pageRect.height)
      };
    });
  }

  async _applyHighlight(colorId) {
    if (!this.activeSelection || !this.currentFile) return;

    const { text, pageNumber, range, pageEl } = this.activeSelection;
    const normalizedRects = this._extractPreciseSelectionRects(range, pageEl);
    if (!normalizedRects.length) return;

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
    const normalizedRects = this._extractPreciseSelectionRects(range, pageEl);
    if (!normalizedRects.length) return;

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
      this.pageRotations = await db.getSetting(`rotations_${paperFile.id}`, {}) || {};
      
      const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
      if (!pdfjsLib) throw new Error('PDF.js library is not loaded');

      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      let loadingTask;
      if (paperFile.pdfData instanceof ArrayBuffer) {
        loadingTask = pdfjsLib.getDocument({ data: paperFile.pdfData.slice(0) });
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
    const pageRotation = (page.rotate + (this.pageRotations[pageNum] || 0)) % 360;
    const viewport = page.getViewport({ scale: this.scale, rotation: pageRotation });
    const outputScale = window.devicePixelRatio || 1;

    const widthPx = Math.floor(viewport.width);
    const heightPx = Math.floor(viewport.height);

    const pageContainer = document.createElement('div');
    pageContainer.className = `pdf-page-container group relative mx-auto my-6 rounded-2xl overflow-hidden flex-shrink-0 transition-all duration-150 pdf-theme-${this.theme}`;
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

    // Floating Rotate Page Button (Top Right corner)
    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'btn-rotate-page absolute top-2.5 right-2.5 p-1.5 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition shadow-lg z-20 border border-white/[0.08]';
    rotateBtn.setAttribute('data-page', pageNum);
    rotateBtn.title = 'Rotate this page 90° (หมุนแนวตั้ง/แนวนอน)';
    rotateBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.rotatePage(pageNum);
    });
    pageContainer.appendChild(rotateBtn);

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
      textLayerDiv.style.setProperty('--scale-factor', `${viewport.scale}`);
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
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;
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
        if (e.target.closest('.markup-textbox') || e.target.closest('.markup-image-box') || e.target.closest('.btn-rotate-page')) return;
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

    const eraseAtPoint = async (clientX, clientY) => {
      const rect = drawingCanvas.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;
      const width = rect.width;
      const height = rect.height;

      const pageDrawings = this.markups.filter(m => m.pageNumber === pageNum && m.type === 'drawing');
      let erasedAny = false;

      for (const m of pageDrawings) {
        let hit = false;
        if (m.data.shapeType === 'rect') {
          const rx = m.x * width;
          const ry = m.y * height;
          const rw = m.width * width;
          const rh = m.height * height;
          const dTop = distToSegment(clickX, clickY, rx, ry, rx + rw, ry);
          const dBottom = distToSegment(clickX, clickY, rx, ry + rh, rx + rw, ry + rh);
          const dLeft = distToSegment(clickX, clickY, rx, ry, rx, ry + rh);
          const dRight = distToSegment(clickX, clickY, rx + rw, ry, rx + rw, ry + rh);
          if (Math.min(dTop, dBottom, dLeft, dRight) <= 20) {
            hit = true;
          }
        } else if (m.data.paths && m.data.paths.length > 0) {
          for (let i = 0; i < m.data.paths.length - 1; i++) {
            const p1 = m.data.paths[i];
            const p2 = m.data.paths[i + 1];
            const d = distToSegment(clickX, clickY, p1.x * width, p1.y * height, p2.x * width, p2.y * height);
            if (d <= 22) {
              hit = true;
              break;
            }
          }
          if (!hit && m.data.paths.length === 1) {
            const p = m.data.paths[0];
            if (Math.hypot(clickX - p.x * width, clickY - p.y * height) <= 22) {
              hit = true;
            }
          }
        }

        if (hit) {
          await db.deleteMarkup(m.id);
          this.markups = this.markups.filter(item => item.id !== m.id);
          erasedAny = true;
        }
      }

      if (erasedAny) {
        this._redrawPageCanvas(pageNum);
      }
    };

    const startDraw = async (e) => {
      if (this.activeTool === 'eraser') {
        await eraseAtPoint(e.clientX, e.clientY);
        return;
      }

      if (this.activeTool !== 'pen' && this.activeTool !== 'rect') return;
      this.isDrawing = true;
      const rect = drawingCanvas.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      this.currentDrawingPath = [{ x: startX, y: startY }];
    };

    const drawMove = async (e) => {
      if (this.activeTool === 'eraser' && (e.buttons === 1)) {
        await eraseAtPoint(e.clientX, e.clientY);
        return;
      }

      if (!this.isDrawing) return;
      const rect = drawingCanvas.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;

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
      } else if (this.activeTool === 'rect') {
        // Redraw existing saved drawings + live dashed preview box & dimension badge
        ctx.clearRect(0, 0, rect.width, rect.height);
        const pageDrawings = this.markups.filter(m => m.pageNumber === pageNum && m.type === 'drawing');
        pageDrawings.forEach(m => this._renderDrawing(drawingCanvas, m));

        const x = Math.min(startX, curX);
        const y = Math.min(startY, curY);
        const w = Math.abs(curX - startX);
        const h = Math.abs(curY - startY);

        // Dashed preview box with soft translucent fill
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = this.activeColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(x, y, w, h);

        // Live Dimension Badge (e.g. 180 × 95 px)
        if (w > 20 || h > 20) {
          ctx.setLineDash([]);
          const badgeText = `${Math.round(w)} × ${Math.round(h)} px`;
          ctx.font = '500 10px Inter, -apple-system, sans-serif';
          const textMetrics = ctx.measureText(badgeText);
          const badgeW = textMetrics.width + 12;
          const badgeH = 18;
          const badgeX = Math.min(rect.width - badgeW - 6, Math.max(6, curX + 10));
          const badgeY = Math.min(rect.height - badgeH - 6, Math.max(6, curY + 12));

          ctx.fillStyle = 'rgba(9, 9, 11, 0.9)';
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#f4f4f5';
          ctx.fillText(badgeText, badgeX + 6, badgeY + 12.5);
        }
        ctx.restore();
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

        // Redraw page cleanly without dashed preview and badge
        this._redrawPageCanvas(pageNum);
      } else if (this.activeTool === 'pen' && this.currentDrawingPath.length >= 1) {
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
    el.style.width = `${(markup.width || 0.28) * 100}%`;
    if (markup.height) {
      el.style.height = `${markup.height * 100}%`;
    }
    el.style.backgroundColor = markup.data.bgColor || '#fef08a';
    el.style.borderColor = markup.data.borderColor || '#eab308';

    const currentFontSize = markup.data.fontSize || 13;
    const isBold = markup.data.isBold || false;
    const isItalic = markup.data.isItalic || false;
    const textColor = markup.data.textColor || '#18181b';

    el.innerHTML = `
      <textarea class="tb-input" style="font-size: ${currentFontSize}px; font-weight: ${isBold ? 'bold' : 'normal'}; font-style: ${isItalic ? 'italic' : 'normal'}; color: ${textColor};" placeholder="Type text here...">${markup.data.text || ''}</textarea>
      
      <!-- Resizable Corner Drag Handle -->
      <div class="tb-resize-handle flex items-center justify-center" title="Drag to resize (ลากมุมเพื่อปรับขนาด)">
        <svg class="w-2.5 h-2.5 text-black/40" viewBox="0 0 24 24" fill="currentColor"><path d="M22 22H20V20H22V22ZM22 16H20V18H22V16ZM18 20H16V22H18V20ZM22 12H20V14H22V12ZM14 20H12V22H14V20ZM18 16H16V18H18V16Z"/></svg>
      </div>
    `;

    markupLayer.appendChild(el);

    const textarea = el.querySelector('.tb-input');

    if (autoFocus) {
      setTimeout(() => {
        textarea.focus();
        textarea.select();
        this.showTextboxFormatBar(markup, el);
      }, 50);
    }

    textarea.addEventListener('input', () => {
      markup.data.text = textarea.value;
      db.saveMarkup(markup);
    });

    // Show floating format bar on click or focus
    el.addEventListener('click', (e) => {
      if (e.target.closest('.tb-resize-handle')) return;
      this.showTextboxFormatBar(markup, el);
    });

    textarea.addEventListener('focus', () => {
      this.showTextboxFormatBar(markup, el);
    });

    // Make Draggable
    this._makeDraggable(el, pageContainer, markup);

    // Make Resizable via interactive drag handle
    const resizeHandle = el.querySelector('.tb-resize-handle');
    if (resizeHandle) {
      let isResizing = false;
      let startW = 0, startH = 0, startMouseX = 0, startMouseY = 0;

      resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        isResizing = true;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        startW = el.offsetWidth;
        startH = el.offsetHeight;
      });

      window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const pageRect = pageContainer.getBoundingClientRect();
        const newW = Math.max(80, Math.min(pageRect.width - el.offsetLeft, startW + (e.clientX - startMouseX)));
        const newH = Math.max(38, Math.min(pageRect.height - el.offsetTop, startH + (e.clientY - startMouseY)));

        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;

        markup.width = newW / pageRect.width;
        markup.height = newH / pageRect.height;

        if (this.activeTextboxEl === el) {
          this.showTextboxFormatBar(markup, el);
        }
      });

      window.addEventListener('mouseup', async () => {
        if (isResizing) {
          isResizing = false;
          await db.saveMarkup(markup);
        }
      });
    }
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
    } else if (markup.data.paths && markup.data.paths.length > 0) {
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
    
    if (this.pdfDoc && this.currentFile) {
      const savedScrollPage = this.currentPage;
      this.container.innerHTML = '';
      for (let num = 1; num <= this.totalPages; num++) {
        await this._renderPage(num);
      }
      this.scrollToPage(savedScrollPage);
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
