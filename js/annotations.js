/**
 * Annotation Sidebar, Contextual Side-Notes, Markdown Scratchpad & Citation Hub
 */

import { db } from './db.js';
import { HighlightColors, createSideNote } from './models.js';
import { formatBibTeX, formatAPA, formatIEEE, formatMLA, copyToClipboard } from './citation.js';
import { tts } from './tts.js';

export class AnnotationStudio {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options;
    this.currentFile = null;
    this.activeTab = 'annotations'; // 'annotations' | 'scratchpad' | 'citation'
    this.highlights = [];
    this.sideNotes = [];
    this.scratchpadMarkdown = '';
    this.metadata = null;
    this.isScratchpadPreview = false;
    this.onJumpToPage = options.onJumpToPage || (() => {});
    this.onFlashHighlight = options.onFlashHighlight || (() => {});
    this.onShowToast = options.onShowToast || ((msg) => console.log(msg));
  }

  async loadFile(paperFile) {
    this.currentFile = paperFile;
    if (!paperFile) {
      this.renderEmpty();
      return;
    }

    this.highlights = await db.getHighlights(paperFile.id);
    this.sideNotes = await db.getSideNotes(paperFile.id);
    this.scratchpadMarkdown = await db.getScratchpad(paperFile.id);
    this.metadata = await db.getMetadata(paperFile.id) || { fileId: paperFile.id };

    this.render();
  }

  renderEmpty() {
    this.container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 bg-slate-900/60">
        <svg class="w-12 h-12 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
        <p class="text-sm font-semibold text-slate-400">No Paper Selected</p>
        <p class="text-xs text-slate-500 mt-1 max-w-[200px]">Select a paper from the explorer to view annotations and citations</p>
      </div>
    `;
  }

  render() {
    if (!this.currentFile) {
      this.renderEmpty();
      return;
    }

    const hlCount = this.highlights.length;
    const noteCount = this.sideNotes.length;

    this.container.innerHTML = `
      <div class="h-full flex flex-col bg-slate-900/95 text-slate-200 border-l border-slate-800">
        <!-- Top Tabs -->
        <div class="p-2 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div class="flex items-center space-x-1">
            <button class="btn-tab px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${this.activeTab === 'annotations' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'}" data-tab="annotations">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
              <span>Notes (${hlCount + noteCount})</span>
            </button>
            <button class="btn-tab px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${this.activeTab === 'scratchpad' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'}" data-tab="scratchpad">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              <span>Scratchpad</span>
            </button>
            <button class="btn-tab px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${this.activeTab === 'citation' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'}" data-tab="citation">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
              <span>Citation</span>
            </button>
          </div>
        </div>

        <!-- Tab Content Area -->
        <div class="flex-1 overflow-y-auto">
          ${this.activeTab === 'annotations' ? this.renderAnnotationsTab() : ''}
          ${this.activeTab === 'scratchpad' ? this.renderScratchpadTab() : ''}
          ${this.activeTab === 'citation' ? this.renderCitationTab() : ''}
        </div>
      </div>
    `;

    this._bindEvents();
  }

  renderAnnotationsTab() {
    if (this.highlights.length === 0) {
      return `
        <div class="p-8 text-center text-slate-500">
          <svg class="w-8 h-8 mx-auto mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
          <p class="text-xs font-semibold text-slate-400">No Highlights or Notes Yet</p>
          <p class="text-[11px] text-slate-500 mt-1">Select any text in the PDF document to highlight, attach notes, or listen via TTS.</p>
        </div>
      `;
    }

    // Group highlights by page number
    const pages = {};
    this.highlights.forEach(hl => {
      if (!pages[hl.pageNumber]) pages[hl.pageNumber] = [];
      pages[hl.pageNumber].push(hl);
    });

    return `
      <div class="p-3 space-y-4">
        ${Object.keys(pages).sort((a, b) => Number(a) - Number(b)).map(pageNum => `
          <div class="space-y-2">
            <div class="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
              <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-blue-400 font-semibold">Page ${pageNum}</span>
              <div class="h-px flex-1 bg-slate-800"></div>
            </div>

            <div class="space-y-2.5">
              ${pages[pageNum].map(hl => {
                const colorObj = HighlightColors[hl.color.toUpperCase()] || HighlightColors.YELLOW;
                const note = this.sideNotes.find(n => n.highlightId === hl.id);

                return `
                  <div class="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 transition space-y-2 group highlight-card" data-hl-id="${hl.id}" data-page="${hl.pageNumber}">
                    <!-- Highlighted quote -->
                    <div class="flex items-start justify-between space-x-2">
                      <div class="flex items-start space-x-2 min-w-0 flex-1 cursor-pointer btn-jump" data-page="${hl.pageNumber}" data-hl-id="${hl.id}">
                        <div class="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style="background-color: ${colorObj.hex}; box-shadow: 0 0 6px ${colorObj.border}"></div>
                        <p class="text-xs text-slate-200 italic line-clamp-3 hover:text-blue-300 transition">"${hl.text}"</p>
                      </div>
                      <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition">
                        <button class="p-1 text-slate-400 hover:text-emerald-400 rounded transition btn-tts-quote" data-text="${encodeURIComponent(hl.text)}" title="Read Aloud">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                        </button>
                        <button class="p-1 text-slate-400 hover:text-rose-400 rounded transition btn-delete-hl" data-hl-id="${hl.id}" title="Delete Highlight">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </div>

                    <!-- Contextual Side-Note input / display -->
                    <div class="pt-1.5 border-t border-slate-700/50">
                      ${note && note.content ? `
                        <div class="p-2 rounded-lg bg-slate-900/80 border border-slate-700/70 text-xs text-slate-300 space-y-1">
                          <div class="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span>SIDE NOTE</span>
                            <button class="hover:text-blue-400 btn-edit-note" data-note-id="${note.id}">Edit</button>
                          </div>
                          <p class="whitespace-pre-wrap">${note.content}</p>
                        </div>
                      ` : `
                        <div class="flex items-center space-x-1.5">
                          <input type="text" placeholder="Add a research note for this quote..." class="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-900/80 border border-slate-700/60 focus:border-blue-500 focus:outline-none text-slate-200 placeholder-slate-500 input-side-note" data-hl-id="${hl.id}" data-page="${hl.pageNumber}" />
                          <button class="px-2 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-medium transition btn-save-note" data-hl-id="${hl.id}" data-page="${hl.pageNumber}">Save</button>
                        </div>
                      `}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderScratchpadTab() {
    return `
      <div class="h-full flex flex-col p-3 space-y-2">
        <!-- Markdown Toolbar -->
        <div class="flex items-center justify-between bg-slate-950/80 p-1.5 rounded-lg border border-slate-800 text-xs">
          <div class="flex items-center space-x-1">
            <button class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 btn-md-action" data-action="bold" title="Bold"><b>B</b></button>
            <button class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 btn-md-action" data-action="italic" title="Italic"><i>I</i></button>
            <button class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 btn-md-action" data-action="h2" title="Heading 2">H2</button>
            <button class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 btn-md-action" data-action="list" title="Bullet List">• List</button>
            <button class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 btn-md-action" data-action="quote" title="Quote">” Quote</button>
            <button class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 btn-md-action" data-action="code" title="Code">&lt;/&gt;</button>
          </div>
          <div class="flex items-center space-x-1">
            <button class="px-2 py-0.5 rounded text-[11px] font-medium transition ${this.isScratchpadPreview ? 'bg-slate-800 text-slate-300' : 'bg-blue-600/30 text-blue-300'} btn-toggle-preview" data-mode="edit">Edit</button>
            <button class="px-2 py-0.5 rounded text-[11px] font-medium transition ${this.isScratchpadPreview ? 'bg-blue-600/30 text-blue-300' : 'bg-slate-800 text-slate-300'} btn-toggle-preview" data-mode="preview">Preview</button>
          </div>
        </div>

        <!-- Editor or Live Markdown Preview -->
        <div class="flex-1 min-h-[300px] flex flex-col">
          ${this.isScratchpadPreview ? `
            <div class="flex-1 p-3 bg-slate-900 rounded-xl border border-slate-800 overflow-y-auto markdown-preview text-xs leading-relaxed">
              ${window.marked ? window.marked.parse(this.scratchpadMarkdown || '*No summary notes written yet.*') : this.scratchpadMarkdown}
            </div>
          ` : `
            <textarea id="scratchpad-input" class="flex-1 w-full p-3 bg-slate-950/90 rounded-xl border border-slate-800 text-xs font-mono text-slate-200 focus:border-blue-500 focus:outline-none resize-none leading-relaxed" placeholder="Write overall paper synthesis, thesis takeaways, methodology critique in Markdown...">${this.scratchpadMarkdown || ''}</textarea>
          `}
        </div>
        <p class="text-[10px] text-slate-500 font-mono text-right">Auto-saved to local database</p>
      </div>
    `;
  }

  renderCitationTab() {
    const meta = this.metadata || {};
    const bibtex = formatBibTeX(meta, this.currentFile.id);
    const apa = formatAPA(meta);
    const ieee = formatIEEE(meta);
    const mla = formatMLA(meta);

    return `
      <div class="p-3 space-y-4">
        <!-- 1-Click Copy Citation Section -->
        <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
          <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
            <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
            <span>One-Click Citation Copy</span>
          </h3>

          <div class="grid grid-cols-2 gap-2">
            <button class="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 text-xs font-medium flex items-center justify-center space-x-1.5 transition btn-copy-citation" data-format="bibtex">
              <span>📋 BibTeX (LaTeX)</span>
            </button>
            <button class="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-center space-x-1.5 transition btn-copy-citation" data-format="apa">
              <span>📋 APA 7th</span>
            </button>
            <button class="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 text-xs font-medium flex items-center justify-center space-x-1.5 transition btn-copy-citation" data-format="ieee">
              <span>📋 IEEE</span>
            </button>
            <button class="px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center justify-center space-x-1.5 transition btn-copy-citation" data-format="mla">
              <span>📋 MLA 9th</span>
            </button>
          </div>

          <!-- BibTeX Preview Box -->
          <div class="mt-2">
            <div class="text-[10px] font-mono text-slate-500 mb-1">BIBTEX CODE:</div>
            <pre class="p-2.5 bg-slate-900 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800 max-h-32 select-all">${bibtex}</pre>
          </div>
        </div>

        <!-- Metadata Editor Form -->
        <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider">Paper Metadata</h3>
            <button id="btn-save-meta" class="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition">Save Details</button>
          </div>

          <div class="space-y-2 text-xs">
            <div>
              <label class="block text-[10px] font-mono text-slate-400 mb-0.5">PAPER TITLE</label>
              <input type="text" id="meta-title" value="${meta.title || ''}" class="w-full px-2.5 py-1.5 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 focus:border-blue-500 focus:outline-none" />
            </div>

            <div>
              <label class="block text-[10px] font-mono text-slate-400 mb-0.5">AUTHORS</label>
              <input type="text" id="meta-authors" value="${meta.authors || ''}" placeholder="e.g. Alex Chen, Sarah Jenkins" class="w-full px-2.5 py-1.5 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 focus:border-blue-500 focus:outline-none" />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-mono text-slate-400 mb-0.5">YEAR</label>
                <input type="text" id="meta-year" value="${meta.year || ''}" placeholder="2024" class="w-full px-2.5 py-1.5 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label class="block text-[10px] font-mono text-slate-400 mb-0.5">DOI LINK</label>
                <input type="text" id="meta-doi" value="${meta.doi || ''}" placeholder="10.1109/SP.2024..." class="w-full px-2.5 py-1.5 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 focus:border-blue-500 focus:outline-none" />
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-mono text-slate-400 mb-0.5">JOURNAL / CONFERENCE</label>
              <input type="text" id="meta-journal" value="${meta.journal || ''}" placeholder="e.g. IEEE S&P / ACM CCS" class="w-full px-2.5 py-1.5 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 focus:border-blue-500 focus:outline-none" />
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] font-mono text-slate-400 mb-0.5">VOLUME</label>
                <input type="text" id="meta-vol" value="${meta.volume || ''}" class="w-full px-2 py-1 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label class="block text-[10px] font-mono text-slate-400 mb-0.5">ISSUE</label>
                <input type="text" id="meta-issue" value="${meta.issue || ''}" class="w-full px-2 py-1 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label class="block text-[10px] font-mono text-slate-400 mb-0.5">PAGES</label>
                <input type="text" id="meta-pages" value="${meta.pages || ''}" placeholder="100-115" class="w-full px-2 py-1 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
          </div>
        </div>

        <!-- Research Synthesis Matrix Fields -->
        <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
          <h3 class="text-xs font-bold text-indigo-400 uppercase tracking-wider">Literature Review Matrix Fields</h3>
          <p class="text-[10px] text-slate-400">These fields populate the Chapter 2 Comparison Table.</p>

          <div class="space-y-2 text-xs">
            <div>
              <label class="block text-[10px] font-mono text-emerald-400 mb-0.5">KEY CONTRIBUTIONS / จุดเด่น</label>
              <textarea id="meta-contrib" rows="2" class="w-full px-2.5 py-1.5 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 focus:border-blue-500 focus:outline-none resize-none">${meta.contributions || ''}</textarea>
            </div>
            <div>
              <label class="block text-[10px] font-mono text-amber-400 mb-0.5">LIMITATIONS / ข้อจำกัด</label>
              <textarea id="meta-limit" rows="2" class="w-full px-2.5 py-1.5 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 focus:border-blue-500 focus:outline-none resize-none">${meta.limitations || ''}</textarea>
            </div>
            <div>
              <label class="block text-[10px] font-mono text-blue-400 mb-0.5">METHODOLOGY / วิธีการวิจัย</label>
              <textarea id="meta-method" rows="2" class="w-full px-2.5 py-1.5 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 focus:border-blue-500 focus:outline-none resize-none">${meta.methodology || ''}</textarea>
            </div>
            <div>
              <label class="block text-[10px] font-mono text-purple-400 mb-0.5">KEY FINDINGS / ผลการทดลอง</label>
              <textarea id="meta-findings" rows="2" class="w-full px-2.5 py-1.5 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 focus:border-blue-500 focus:outline-none resize-none">${meta.findings || ''}</textarea>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    // Tabs switching
    this.container.querySelectorAll('.btn-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-tab');
        this.render();
      });
    });

    // Jump to page on click
    this.container.querySelectorAll('.btn-jump').forEach(el => {
      el.addEventListener('click', () => {
        const pageNum = parseInt(el.getAttribute('data-page'), 10);
        const hlId = el.getAttribute('data-hl-id');
        this.onJumpToPage(pageNum);
        this.onFlashHighlight(hlId);
      });
    });

    // TTS speak quote
    this.container.querySelectorAll('.btn-tts-quote').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = decodeURIComponent(btn.getAttribute('data-text'));
        tts.speak(text);
      });
    });

    // Delete Highlight
    this.container.querySelectorAll('.btn-delete-hl').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const hlId = btn.getAttribute('data-hl-id');
        if (confirm('Delete this highlight and its note?')) {
          await db.deleteHighlight(hlId);
          await this.loadFile(this.currentFile);
        }
      });
    });

    // Save Side Note from input
    this.container.querySelectorAll('.btn-save-note').forEach(btn => {
      btn.addEventListener('click', async () => {
        const hlId = btn.getAttribute('data-hl-id');
        const pageNum = parseInt(btn.getAttribute('data-page'), 10);
        const input = this.container.querySelector(`.input-side-note[data-hl-id="${hlId}"]`);
        if (input && input.value.trim()) {
          const note = createSideNote({
            fileId: this.currentFile.id,
            highlightId: hlId,
            pageNumber: pageNum,
            content: input.value.trim()
          });
          await db.saveSideNote(note);
          await this.loadFile(this.currentFile);
        }
      });
    });

    // Edit existing note
    this.container.querySelectorAll('.btn-edit-note').forEach(btn => {
      btn.addEventListener('click', async () => {
        const noteId = btn.getAttribute('data-note-id');
        const note = this.sideNotes.find(n => n.id === noteId);
        if (note) {
          const newContent = prompt('Edit note:', note.content);
          if (newContent !== null) {
            note.content = newContent.trim();
            await db.saveSideNote(note);
            await this.loadFile(this.currentFile);
          }
        }
      });
    });

    // Scratchpad input auto-save
    const scratchpadInput = this.container.querySelector('#scratchpad-input');
    if (scratchpadInput) {
      let timeout;
      scratchpadInput.addEventListener('input', () => {
        this.scratchpadMarkdown = scratchpadInput.value;
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          await db.saveScratchpad(this.currentFile.id, this.scratchpadMarkdown);
        }, 500);
      });
    }

    // Scratchpad Markdown toolbar actions
    this.container.querySelectorAll('.btn-md-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        this._applyMarkdownAction(action);
      });
    });

    // Scratchpad Preview Toggle
    this.container.querySelectorAll('.btn-toggle-preview').forEach(btn => {
      btn.addEventListener('click', () => {
        this.isScratchpadPreview = btn.getAttribute('data-mode') === 'preview';
        this.render();
      });
    });

    // Citation Copy Buttons
    this.container.querySelectorAll('.btn-copy-citation').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fmt = btn.getAttribute('data-format');
        let textToCopy = '';
        if (fmt === 'bibtex') textToCopy = formatBibTeX(this.metadata, this.currentFile.id);
        if (fmt === 'apa') textToCopy = formatAPA(this.metadata);
        if (fmt === 'ieee') textToCopy = formatIEEE(this.metadata);
        if (fmt === 'mla') textToCopy = formatMLA(this.metadata);

        await copyToClipboard(textToCopy);
        this.onShowToast(`Copied ${fmt.toUpperCase()} Citation to clipboard!`);
      });
    });

    // Save Metadata details
    const saveMetaBtn = this.container.querySelector('#btn-save-meta');
    if (saveMetaBtn) {
      saveMetaBtn.addEventListener('click', async () => {
        this.metadata.title = this.container.querySelector('#meta-title')?.value || '';
        this.metadata.authors = this.container.querySelector('#meta-authors')?.value || '';
        this.metadata.year = this.container.querySelector('#meta-year')?.value || '';
        this.metadata.doi = this.container.querySelector('#meta-doi')?.value || '';
        this.metadata.journal = this.container.querySelector('#meta-journal')?.value || '';
        this.metadata.volume = this.container.querySelector('#meta-vol')?.value || '';
        this.metadata.issue = this.container.querySelector('#meta-issue')?.value || '';
        this.metadata.pages = this.container.querySelector('#meta-pages')?.value || '';
        this.metadata.contributions = this.container.querySelector('#meta-contrib')?.value || '';
        this.metadata.limitations = this.container.querySelector('#meta-limit')?.value || '';
        this.metadata.methodology = this.container.querySelector('#meta-method')?.value || '';
        this.metadata.findings = this.container.querySelector('#meta-findings')?.value || '';

        await db.saveMetadata(this.metadata);
        this.onShowToast('Metadata saved successfully!');
        this.render();
      });
    }
  }

  _applyMarkdownAction(action) {
    const textarea = this.container.querySelector('#scratchpad-input');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    let replacement = '';

    switch (action) {
      case 'bold': replacement = `**${selected || 'bold text'}**`; break;
      case 'italic': replacement = `*${selected || 'italic text'}*`; break;
      case 'h2': replacement = `\n## ${selected || 'Heading'}\n`; break;
      case 'list': replacement = `\n- ${selected || 'List item'}`; break;
      case 'quote': replacement = `\n> "${selected || 'Quote'}"\n`; break;
      case 'code': replacement = `\`${selected || 'code'}\``; break;
    }

    textarea.setRangeText(replacement, start, end, 'end');
    this.scratchpadMarkdown = textarea.value;
    db.saveScratchpad(this.currentFile.id, this.scratchpadMarkdown);
  }
}
