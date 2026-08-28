/**
 * Ultra-Minimalist Command Palette Search Dialog (Raycast / Linear style)
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

    // Files
    for (const f of files) {
      this.searchIndex.push({
        type: 'file',
        fileId: f.id,
        fileName: f.name,
        title: f.name,
        snippet: (f.tags || []).map(t => `#${t}`).join(' '),
        pageNumber: 1,
        matchField: 'Paper'
      });
    }

    // Metadata
    for (const m of metadata) {
      const file = files.find(f => f.id === m.fileId);
      if (!file) continue;

      if (m.title) {
        this.searchIndex.push({
          type: 'metadata',
          fileId: m.fileId,
          fileName: file.name,
          title: m.title,
          snippet: `${m.authors || ''} (${m.year || ''})`,
          pageNumber: 1,
          matchField: 'Metadata'
        });
      }
    }

    // Highlights
    for (const hl of highlights) {
      const file = files.find(f => f.id === hl.fileId);
      if (!file) continue;

      this.searchIndex.push({
        type: 'highlight',
        fileId: hl.fileId,
        fileName: file.name,
        title: hl.text,
        snippet: `Page ${hl.pageNumber} in ${file.name}`,
        pageNumber: hl.pageNumber,
        hlId: hl.id,
        matchField: 'Quote'
      });
    }

    // Notes
    for (const n of notes) {
      const file = files.find(f => f.id === n.fileId);
      if (!file) continue;

      this.searchIndex.push({
        type: 'note',
        fileId: n.fileId,
        fileName: file.name,
        title: n.content,
        snippet: `Note on Page ${n.pageNumber}`,
        pageNumber: n.pageNumber,
        hlId: n.highlightId,
        matchField: 'Note'
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
      <div class="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/60 backdrop-blur-md">
        <div class="w-full max-w-xl bg-zinc-900 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          
          <!-- Search Input -->
          <div class="px-4 py-3 border-b border-white/[0.06] flex items-center space-x-3 bg-zinc-950/70">
            <svg class="w-4 h-4 text-zinc-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input type="text" id="global-search-input" placeholder="Type to search papers, quotes, notes..." class="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none" />
            <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[9px] border border-white/[0.06]">ESC</kbd>
          </div>

          <!-- Results -->
          <div id="search-results-list" class="max-h-80 overflow-y-auto p-1.5 divide-y divide-white/[0.02]">
            <div class="p-6 text-center text-zinc-500">
              <p class="text-xs">Search papers, highlights, notes, and tags</p>
            </div>
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
            <div class="p-6 text-center text-zinc-500">
              <p class="text-xs">Search papers, highlights, notes, and tags</p>
            </div>
          `;
          return;
        }

        const matches = this.searchIndex.filter(item => {
          return (
            (item.fileName && item.fileName.toLowerCase().includes(query)) ||
            (item.title && item.title.toLowerCase().includes(query)) ||
            (item.snippet && item.snippet.toLowerCase().includes(query))
          );
        }).slice(0, 15);

        if (matches.length === 0) {
          resultsContainer.innerHTML = `
            <div class="p-6 text-center text-zinc-500">
              <p class="text-xs font-medium text-zinc-400">No results found for "${query}"</p>
            </div>
          `;
          return;
        }

        resultsContainer.innerHTML = matches.map((res, index) => {
          return `
            <div class="px-3 py-2 rounded-xl hover:bg-white/[0.05] cursor-pointer transition flex items-center justify-between space-x-3 search-result-item" data-index="${index}">
              <div class="min-w-0 flex-1">
                <h4 class="text-xs font-medium text-zinc-200 truncate">${res.title}</h4>
                <p class="text-[10px] text-zinc-500 truncate mt-0.5">${res.snippet}</p>
              </div>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-800 text-zinc-400 border border-white/[0.06]">
                ${res.matchField}
              </span>
            </div>
          `;
        }).join('');

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
