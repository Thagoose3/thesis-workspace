/**
 * Global Deep Search Engine & Modal Dialog for ThesisMind
 * Indexes and searches across File names, Tags, Highlights, Side-Notes, and Paper Metadata.
 */

import { db } from './db.js';

export class GlobalSearchModal {
  constructor(modalElement, options = {}) {
    this.modal = modalElement;
    this.options = options;
    this.onSelectResult = options.onSelectResult || (() => {});
    this.searchIndex = [];
    this.isOpen = false;

    this._bindKeyboardShortcut();
  }

  _bindKeyboardShortcut() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.open();
      }
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  async buildIndex() {
    const files = await db.getAll('files');
    const highlights = await db.getAll('highlights');
    const notes = await db.getAll('sideNotes');
    const metadata = await db.getAll('metadata');

    this.searchIndex = [];

    // Index Files
    for (const f of files) {
      this.searchIndex.push({
        type: 'file',
        fileId: f.id,
        fileName: f.name,
        title: f.name,
        snippet: `Tags: ${(f.tags || []).join(', ')}`,
        pageNumber: 1,
        matchField: 'Filename & Tags'
      });
    }

    // Index Metadata
    for (const m of metadata) {
      const file = files.find(f => f.id === m.fileId);
      if (!file) continue;

      if (m.title) {
        this.searchIndex.push({
          type: 'metadata',
          fileId: m.fileId,
          fileName: file.name,
          title: m.title,
          snippet: `Authors: ${m.authors || 'Unknown'} (${m.year || ''}) · ${m.journal || ''}`,
          pageNumber: 1,
          matchField: 'Title & Authors'
        });
      }
      if (m.contributions || m.findings || m.abstract) {
        this.searchIndex.push({
          type: 'synthesis',
          fileId: m.fileId,
          fileName: file.name,
          title: `Synthesis: ${m.title || file.name}`,
          snippet: `${m.contributions} ${m.findings} ${m.abstract}`.trim(),
          pageNumber: 1,
          matchField: 'Research Synthesis'
        });
      }
    }

    // Index Highlights
    for (const hl of highlights) {
      const file = files.find(f => f.id === hl.fileId);
      if (!file) continue;

      this.searchIndex.push({
        type: 'highlight',
        fileId: hl.fileId,
        fileName: file.name,
        title: `Highlight (Page ${hl.pageNumber}) in ${file.name}`,
        snippet: `"${hl.text}"`,
        pageNumber: hl.pageNumber,
        hlId: hl.id,
        matchField: 'PDF Highlight'
      });
    }

    // Index Side-Notes
    for (const n of notes) {
      const file = files.find(f => f.id === n.fileId);
      if (!file) continue;

      this.searchIndex.push({
        type: 'note',
        fileId: n.fileId,
        fileName: file.name,
        title: `Side-Note (Page ${n.pageNumber}) in ${file.name}`,
        snippet: n.content,
        pageNumber: n.pageNumber,
        hlId: n.highlightId,
        matchField: 'Side-Note'
      });
    }
  }

  async open() {
    this.isOpen = true;
    await this.buildIndex();
    this.render();
    this.modal.classList.remove('hidden');

    const input = this.modal.querySelector('#global-search-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  close() {
    this.isOpen = false;
    this.modal.classList.add('hidden');
  }

  render() {
    this.modal.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-950/80 backdrop-blur-md">
        <div class="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
          
          <!-- Search Header Input -->
          <div class="p-3 border-b border-slate-800 flex items-center space-x-3 bg-slate-950/80">
            <svg class="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input type="text" id="global-search-input" placeholder="Search files, tags, notes, highlights, citations... (Ctrl+K)" class="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none" />
            <kbd class="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px] border border-slate-700">ESC</kbd>
          </div>

          <!-- Search Results Container -->
          <div id="search-results-list" class="max-h-[60vh] overflow-y-auto p-2 divide-y divide-slate-800/50">
            <div class="p-8 text-center text-slate-500">
              <p class="text-xs">Type a keyword to search across all your research files & annotations.</p>
            </div>
          </div>

          <!-- Search Footer -->
          <div class="p-2.5 border-t border-slate-800 bg-slate-950/90 text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>Indexed ${this.searchIndex.length} items</span>
            <span>Use ↑ ↓ to navigate · Enter to jump</span>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const input = this.modal.querySelector('#global-search-input');
    const resultsContainer = this.modal.querySelector('#search-results-list');

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal.firstElementChild) {
        this.close();
      }
    });

    if (input) {
      input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        if (!query) {
          resultsContainer.innerHTML = `
            <div class="p-8 text-center text-slate-500">
              <p class="text-xs">Type a keyword to search across all your research files & annotations.</p>
            </div>
          `;
          return;
        }

        const matches = this.searchIndex.filter(item => {
          return (
            (item.fileName && item.fileName.toLowerCase().includes(query)) ||
            (item.title && item.title.toLowerCase().includes(query)) ||
            (item.snippet && item.snippet.toLowerCase().includes(query)) ||
            (item.matchField && item.matchField.toLowerCase().includes(query))
          );
        }).slice(0, 20);

        if (matches.length === 0) {
          resultsContainer.innerHTML = `
            <div class="p-8 text-center text-slate-500">
              <p class="text-xs text-slate-400 font-semibold">No results found for "${query}"</p>
              <p class="text-[11px] text-slate-500 mt-1">Try another keyword, tag, or author name.</p>
            </div>
          `;
          return;
        }

        const highlightText = (text, q) => {
          if (!text) return '';
          const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          return text.replace(regex, '<mark class="bg-amber-400/30 text-amber-200 px-0.5 rounded">$1</mark>');
        };

        resultsContainer.innerHTML = matches.map((res, index) => {
          let badgeColor = 'bg-blue-600/20 text-blue-400 border-blue-500/30';
          if (res.type === 'highlight') badgeColor = 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30';
          if (res.type === 'note') badgeColor = 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30';
          if (res.type === 'synthesis') badgeColor = 'bg-purple-600/20 text-purple-400 border-purple-500/30';

          return `
            <div class="p-2.5 rounded-xl hover:bg-slate-800/80 cursor-pointer transition flex items-start space-x-3 search-result-item" data-index="${index}">
              <div class="mt-0.5">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono border ${badgeColor}">
                  ${res.matchField}
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <h4 class="text-xs font-semibold text-slate-200 leading-snug">${highlightText(res.title, query)}</h4>
                <p class="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">${highlightText(res.snippet, query)}</p>
                <div class="text-[10px] text-slate-500 mt-1 flex items-center space-x-2">
                  <span>📄 ${res.fileName}</span>
                  ${res.pageNumber ? `<span>•</span><span>Page ${res.pageNumber}</span>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Bind clicks on search results
        resultsContainer.querySelectorAll('.search-result-item').forEach(itemEl => {
          itemEl.addEventListener('click', async () => {
            const idx = parseInt(itemEl.getAttribute('data-index'), 10);
            const selected = matches[idx];
            if (selected) {
              const file = await db.get('files', selected.fileId);
              if (file) {
                this.onSelectResult(file, selected.pageNumber, selected.hlId);
                this.close();
              }
            }
          });
        });
      });
    }
  }
}
