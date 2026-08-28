/**
 * Ultra-Minimalist Annotation Sidebar, Markdown Scratchpad & Citation Studio
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
    this.onDeleteHighlight = options.onDeleteHighlight || (() => {});
    this.onUpdateHighlightColor = options.onUpdateHighlightColor || (() => {});
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
      <div class="h-full flex flex-col items-center justify-center p-6 text-center text-zinc-500 bg-zinc-900 select-none">
        <p class="text-xs font-medium text-zinc-400">No Paper Selected</p>
        <p class="text-[11px] text-zinc-600 mt-1 max-w-[180px]">Select a paper to view notes and citations</p>
      </div>
    `;
  }

  render() {
    if (!this.currentFile) {
      this.renderEmpty();
      return;
    }

    const hlCount = this.highlights.length;

    this.container.innerHTML = `
      <div class="h-full flex flex-col bg-zinc-900 text-zinc-200 border-l border-white/[0.06]">
        
        <!-- Minimal Segmented Tab Switcher -->
        <div class="p-2 border-b border-white/[0.06] bg-zinc-950/40">
          <div class="grid grid-cols-3 gap-0.5 bg-zinc-950 p-0.5 rounded-lg border border-white/[0.06] text-xs">
            <button class="btn-tab py-1 px-2 rounded-md font-medium transition flex items-center justify-center space-x-1 ${this.activeTab === 'annotations' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}" data-tab="annotations">
              <span>Notes</span>
              ${hlCount > 0 ? `<span class="text-[10px] font-mono text-zinc-400">(${hlCount})</span>` : ''}
            </button>
            <button class="btn-tab py-1 px-2 rounded-md font-medium transition flex items-center justify-center ${this.activeTab === 'scratchpad' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}" data-tab="scratchpad">
              <span>Summary</span>
            </button>
            <button class="btn-tab py-1 px-2 rounded-md font-medium transition flex items-center justify-center ${this.activeTab === 'citation' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}" data-tab="citation">
              <span>Cite</span>
            </button>
          </div>
        </div>

        <!-- Tab Content -->
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
        <div class="p-6 text-center text-zinc-500 space-y-2">
          <p class="text-xs font-medium text-zinc-400">No Highlights Yet</p>
          <p class="text-[11px] text-zinc-600 max-w-[190px] mx-auto">Select text in the PDF to highlight, attach notes, or listen via TTS.</p>
        </div>
      `;
    }

    const pages = {};
    this.highlights.forEach(hl => {
      if (!pages[hl.pageNumber]) pages[hl.pageNumber] = [];
      pages[hl.pageNumber].push(hl);
    });

    return `
      <div class="p-2.5 space-y-3">
        ${Object.keys(pages).sort((a, b) => Number(a) - Number(b)).map(pageNum => `
          <div class="space-y-1.5">
            <div class="flex items-center space-x-1.5 text-[10px] font-mono text-zinc-500 px-1">
              <span>Page ${pageNum}</span>
              <div class="h-px flex-1 bg-white/[0.04]"></div>
            </div>

            <div class="space-y-1.5">
              ${pages[pageNum].map(hl => {
                const colorObj = HighlightColors[hl.color.toUpperCase()] || HighlightColors.YELLOW;
                const note = this.sideNotes.find(n => n.highlightId === hl.id);

                return `
                  <div class="p-2.5 rounded-xl bg-zinc-950/60 hover:bg-zinc-950 border border-white/[0.05] hover:border-white/[0.1] transition space-y-2 group highlight-card" data-hl-id="${hl.id}" data-page="${hl.pageNumber}">
                    
                    <!-- Card Header -->
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-1.5 cursor-pointer btn-jump" data-page="${hl.pageNumber}" data-hl-id="${hl.id}">
                        <div class="w-2 h-2 rounded-full" style="background-color: ${colorObj.hex}"></div>
                        <span class="text-[10px] font-mono text-zinc-500 group-hover:text-blue-400 transition">p. ${hl.pageNumber}</span>
                      </div>

                      <div class="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 transition">
                        <button class="p-1 hover:bg-white/[0.08] text-zinc-400 hover:text-emerald-400 rounded-md transition btn-tts-quote" data-text="${encodeURIComponent(hl.text)}" title="Read Aloud">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                        </button>
                        <button class="p-1 hover:bg-rose-900/40 text-zinc-400 hover:text-rose-400 rounded-md transition btn-delete-hl" data-hl-id="${hl.id}" title="Remove Highlight">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </div>

                    <!-- Highlight Quote -->
                    <div class="cursor-pointer btn-jump" data-page="${hl.pageNumber}" data-hl-id="${hl.id}">
                      <p class="text-xs text-zinc-300 italic leading-relaxed line-clamp-3">"${hl.text}"</p>
                    </div>

                    <!-- Side Note -->
                    <div class="pt-1 border-t border-white/[0.04]">
                      ${note && note.content ? `
                        <div class="p-2 rounded-lg bg-zinc-900 border border-white/[0.06] text-xs text-zinc-300 space-y-1">
                          <div class="flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                            <span class="text-blue-400">NOTE</span>
                            <button class="hover:text-zinc-200 btn-edit-note" data-note-id="${note.id}">edit</button>
                          </div>
                          <p class="whitespace-pre-wrap leading-relaxed text-zinc-200 text-xs">${note.content}</p>
                        </div>
                      ` : `
                        <div class="flex items-center space-x-1">
                          <input type="text" placeholder="Add note..." class="flex-1 px-2 py-1 text-xs rounded-lg bg-zinc-900 border border-white/[0.06] focus:border-blue-500 focus:outline-none text-zinc-200 placeholder-zinc-600 input-side-note" data-hl-id="${hl.id}" data-page="${hl.pageNumber}" />
                          <button class="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-blue-600 hover:text-white text-zinc-300 text-xs transition btn-save-note" data-hl-id="${hl.id}" data-page="${hl.pageNumber}">Add</button>
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
      <div class="h-full flex flex-col p-2.5 space-y-2">
        <div class="flex items-center justify-between bg-zinc-950/70 p-1 rounded-lg border border-white/[0.06] text-xs">
          <div class="flex items-center space-x-0.5">
            <button class="px-1.5 py-0.5 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 btn-md-action" data-action="bold" title="Bold"><b>B</b></button>
            <button class="px-1.5 py-0.5 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 btn-md-action" data-action="italic" title="Italic"><i>I</i></button>
            <button class="px-1.5 py-0.5 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 btn-md-action" data-action="h2" title="Heading 2">H2</button>
            <button class="px-1.5 py-0.5 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 btn-md-action" data-action="list" title="Bullet List">•</button>
            <button class="px-1.5 py-0.5 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 btn-md-action" data-action="quote" title="Quote">”</button>
          </div>
          <div class="flex items-center bg-zinc-900 p-0.5 rounded text-[10px]">
            <button class="px-1.5 py-0.5 rounded font-medium transition ${!this.isScratchpadPreview ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'} btn-toggle-preview" data-mode="edit">Edit</button>
            <button class="px-1.5 py-0.5 rounded font-medium transition ${this.isScratchpadPreview ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'} btn-toggle-preview" data-mode="preview">Preview</button>
          </div>
        </div>

        <div class="flex-1 min-h-[260px] flex flex-col">
          ${this.isScratchpadPreview ? `
            <div class="flex-1 p-3 bg-zinc-950/50 rounded-xl border border-white/[0.05] overflow-y-auto markdown-preview text-xs leading-relaxed">
              ${window.marked ? window.marked.parse(this.scratchpadMarkdown || '*No summary written yet.*') : this.scratchpadMarkdown}
            </div>
          ` : `
            <textarea id="scratchpad-input" class="flex-1 w-full p-3 bg-zinc-950/70 rounded-xl border border-white/[0.06] text-xs font-mono text-zinc-200 focus:border-blue-500/80 focus:outline-none resize-none leading-relaxed" placeholder="Write overall paper synthesis in Markdown...">${this.scratchpadMarkdown || ''}</textarea>
          `}
        </div>
      </div>
    `;
  }

  renderCitationTab() {
    const meta = this.metadata || {};
    const bibtex = formatBibTeX(meta, this.currentFile.id);

    return `
      <div class="p-2.5 space-y-3">
        <!-- 1-Click Copy Buttons -->
        <div class="p-2.5 rounded-xl bg-zinc-950/60 border border-white/[0.06] space-y-2">
          <div class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Quick Copy</div>
          <div class="grid grid-cols-2 gap-1.5">
            <button class="py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 text-xs font-medium transition btn-copy-citation" data-format="bibtex">
              <span>BibTeX</span>
            </button>
            <button class="py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 text-xs font-medium transition btn-copy-citation" data-format="apa">
              <span>APA 7th</span>
            </button>
            <button class="py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 text-xs font-medium transition btn-copy-citation" data-format="ieee">
              <span>IEEE</span>
            </button>
            <button class="py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 text-xs font-medium transition btn-copy-citation" data-format="mla">
              <span>MLA 9th</span>
            </button>
          </div>

          <!-- BibTeX Preview -->
          <div class="mt-1">
            <pre class="p-2 bg-zinc-900 rounded-lg text-[10px] font-mono text-emerald-400/90 overflow-x-auto border border-white/[0.04] max-h-28 select-all">${bibtex}</pre>
          </div>
        </div>

        <!-- Metadata Form -->
        <div class="p-2.5 rounded-xl bg-zinc-950/60 border border-white/[0.06] space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Metadata</span>
            <button id="btn-save-meta" class="px-2 py-0.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition">Save</button>
          </div>

          <div class="space-y-2 text-xs">
            <div>
              <label class="block text-[9px] font-mono text-zinc-500 mb-0.5">TITLE</label>
              <input type="text" id="meta-title" value="${meta.title || ''}" class="w-full px-2 py-1 bg-zinc-900 rounded-lg border border-white/[0.06] text-zinc-200 focus:border-blue-500 focus:outline-none" />
            </div>

            <div>
              <label class="block text-[9px] font-mono text-zinc-500 mb-0.5">AUTHORS</label>
              <input type="text" id="meta-authors" value="${meta.authors || ''}" placeholder="e.g. Alex Chen, Sarah Jenkins" class="w-full px-2 py-1 bg-zinc-900 rounded-lg border border-white/[0.06] text-zinc-200 focus:border-blue-500 focus:outline-none" />
            </div>

            <div class="grid grid-cols-2 gap-1.5">
              <div>
                <label class="block text-[9px] font-mono text-zinc-500 mb-0.5">YEAR</label>
                <input type="text" id="meta-year" value="${meta.year || ''}" placeholder="2024" class="w-full px-2 py-1 bg-zinc-900 rounded-lg border border-white/[0.06] text-zinc-200 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label class="block text-[9px] font-mono text-zinc-500 mb-0.5">DOI</label>
                <input type="text" id="meta-doi" value="${meta.doi || ''}" placeholder="10.1109..." class="w-full px-2 py-1 bg-zinc-900 rounded-lg border border-white/[0.06] text-zinc-200 focus:border-blue-500 focus:outline-none" />
              </div>
            </div>

            <div>
              <label class="block text-[9px] font-mono text-zinc-500 mb-0.5">JOURNAL / CONF</label>
              <input type="text" id="meta-journal" value="${meta.journal || ''}" placeholder="e.g. IEEE S&P" class="w-full px-2 py-1 bg-zinc-900 rounded-lg border border-white/[0.06] text-zinc-200 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    // Tabs
    this.container.querySelectorAll('.btn-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-tab');
        this.render();
      });
    });

    // Jump
    this.container.querySelectorAll('.btn-jump').forEach(el => {
      el.addEventListener('click', () => {
        const pageNum = parseInt(el.getAttribute('data-page'), 10);
        const hlId = el.getAttribute('data-hl-id');
        this.onJumpToPage(pageNum);
        this.onFlashHighlight(hlId);
      });
    });

    // TTS
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
        await this.onDeleteHighlight(hlId);
        await this.loadFile(this.currentFile);
        this.onShowToast('Highlight removed');
      });
    });

    // Save Note
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

    // Edit Note
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

    // Scratchpad Auto-save
    const scratchpadInput = this.container.querySelector('#scratchpad-input');
    if (scratchpadInput) {
      let timeout;
      scratchpadInput.addEventListener('input', () => {
        this.scratchpadMarkdown = scratchpadInput.value;
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          await db.saveScratchpad(this.currentFile.id, this.scratchpadMarkdown);
        }, 400);
      });
    }

    // Markdown Actions
    this.container.querySelectorAll('.btn-md-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        this._applyMarkdownAction(action);
      });
    });

    // Toggle Preview
    this.container.querySelectorAll('.btn-toggle-preview').forEach(btn => {
      btn.addEventListener('click', () => {
        this.isScratchpadPreview = btn.getAttribute('data-mode') === 'preview';
        this.render();
      });
    });

    // Copy Citation
    this.container.querySelectorAll('.btn-copy-citation').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fmt = btn.getAttribute('data-format');
        let textToCopy = '';
        if (fmt === 'bibtex') textToCopy = formatBibTeX(this.metadata, this.currentFile.id);
        if (fmt === 'apa') textToCopy = formatAPA(this.metadata);
        if (fmt === 'ieee') textToCopy = formatIEEE(this.metadata);
        if (fmt === 'mla') textToCopy = formatMLA(this.metadata);

        await copyToClipboard(textToCopy);
        this.onShowToast(`Copied ${fmt.toUpperCase()}`);
      });
    });

    // Save Metadata
    const saveMetaBtn = this.container.querySelector('#btn-save-meta');
    if (saveMetaBtn) {
      saveMetaBtn.addEventListener('click', async () => {
        this.metadata.title = this.container.querySelector('#meta-title')?.value || '';
        this.metadata.authors = this.container.querySelector('#meta-authors')?.value || '';
        this.metadata.year = this.container.querySelector('#meta-year')?.value || '';
        this.metadata.doi = this.container.querySelector('#meta-doi')?.value || '';
        this.metadata.journal = this.container.querySelector('#meta-journal')?.value || '';

        await db.saveMetadata(this.metadata);
        this.onShowToast('Metadata saved');
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
      case 'bold': replacement = `**${selected || 'bold'}**`; break;
      case 'italic': replacement = `*${selected || 'italic'}*`; break;
      case 'h2': replacement = `\n## ${selected || 'Heading'}\n`; break;
      case 'list': replacement = `\n- ${selected || 'Item'}`; break;
      case 'quote': replacement = `\n> "${selected || 'Quote'}"\n`; break;
    }

    textarea.setRangeText(replacement, start, end, 'end');
    this.scratchpadMarkdown = textarea.value;
    db.saveScratchpad(this.currentFile.id, this.scratchpadMarkdown);
  }
}
