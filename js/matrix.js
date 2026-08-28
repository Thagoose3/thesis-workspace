/**
 * Ultra-Minimalist Paper Summary Matrix (Literature Review Comparison Table)
 */

import { db } from './db.js';
import { generateBibTeXKey, copyToClipboard } from './citation.js';

export class SummaryMatrixModal {
  constructor(modalElement, options = {}) {
    this.modal = modalElement;
    this.options = options;
    this.currentFolderId = null;
    this.papersData = [];
    this.onShowToast = options.onShowToast || ((msg) => console.log(msg));
  }

  async open(folderId = null) {
    this.currentFolderId = folderId;
    await this.loadData();
    this.render();
    this.modal.classList.remove('hidden');
  }

  close() {
    this.modal.classList.add('hidden');
  }

  async loadData() {
    let files = [];
    if (this.currentFolderId) {
      files = await db.getByIndex('files', 'folderId', this.currentFolderId);
    } else {
      files = await db.getAll('files');
    }

    const folders = await db.getFolders();
    const currentFolder = folders.find(f => f.id === this.currentFolderId);
    this.folderName = currentFolder ? currentFolder.name : 'All Folders';

    this.papersData = [];
    for (const file of files) {
      const meta = await db.getMetadata(file.id) || { fileId: file.id };
      this.papersData.push({
        file,
        meta,
        bibKey: generateBibTeXKey(meta, file.name)
      });
    }
  }

  render() {
    this.modal.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <div class="w-full max-w-5xl max-h-[85vh] bg-zinc-900 border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          
          <!-- Header -->
          <div class="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between bg-zinc-950/50">
            <div>
              <h2 class="text-sm font-semibold text-zinc-100">Literature Review Matrix</h2>
              <p class="text-[11px] text-zinc-500 font-mono mt-0.5">${this.papersData.length} papers in ${this.folderName}</p>
            </div>

            <div class="flex items-center space-x-2">
              <button id="btn-copy-md-matrix" class="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-zinc-300 text-xs font-medium transition">
                Copy Markdown
              </button>
              <button id="btn-download-csv" class="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-zinc-300 text-xs font-medium transition">
                CSV
              </button>
              <button id="btn-close-matrix" class="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>

          <!-- Table Content -->
          <div class="flex-1 overflow-auto p-4">
            ${this.papersData.length === 0 ? `
              <div class="p-12 text-center text-zinc-500">
                <p class="text-xs">No papers in this folder</p>
              </div>
            ` : `
              <div class="overflow-x-auto border border-white/[0.06] rounded-xl">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="bg-zinc-950/80 text-zinc-400 border-b border-white/[0.06] font-mono text-[10px]">
                      <th class="p-3 w-56 border-r border-white/[0.06]">Paper</th>
                      <th class="p-3 w-64 border-r border-white/[0.06]">Contributions (จุดเด่น)</th>
                      <th class="p-3 w-64 border-r border-white/[0.06]">Limitations (ข้อจำกัด)</th>
                      <th class="p-3 w-56 border-r border-white/[0.06]">Methodology</th>
                      <th class="p-3 w-56">Findings</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/[0.04] bg-zinc-900/40">
                    ${this.papersData.map((item) => {
                      const { file, meta } = item;
                      return `
                        <tr class="hover:bg-white/[0.02] transition">
                          <td class="p-3 align-top border-r border-white/[0.06]">
                            <p class="font-medium text-zinc-200 leading-snug">${meta.title || file.name}</p>
                            <p class="text-[10px] text-zinc-500 mt-1">${meta.authors || 'Unknown'} (${meta.year || ''})</p>
                          </td>

                          <td class="p-2 align-top border-r border-white/[0.06]">
                            <textarea class="w-full h-20 p-2 rounded-lg bg-zinc-950/50 border border-white/[0.04] hover:border-white/[0.08] focus:border-blue-500/80 focus:outline-none text-zinc-300 text-xs resize-none transition matrix-cell" data-file-id="${file.id}" data-field="contributions" placeholder="Key contributions...">${meta.contributions || ''}</textarea>
                          </td>

                          <td class="p-2 align-top border-r border-white/[0.06]">
                            <textarea class="w-full h-20 p-2 rounded-lg bg-zinc-950/50 border border-white/[0.04] hover:border-white/[0.08] focus:border-blue-500/80 focus:outline-none text-zinc-300 text-xs resize-none transition matrix-cell" data-file-id="${file.id}" data-field="limitations" placeholder="Limitations...">${meta.limitations || ''}</textarea>
                          </td>

                          <td class="p-2 align-top border-r border-white/[0.06]">
                            <textarea class="w-full h-20 p-2 rounded-lg bg-zinc-950/50 border border-white/[0.04] hover:border-white/[0.08] focus:border-blue-500/80 focus:outline-none text-zinc-300 text-xs resize-none transition matrix-cell" data-file-id="${file.id}" data-field="methodology" placeholder="Methodology...">${meta.methodology || ''}</textarea>
                          </td>

                          <td class="p-2 align-top">
                            <textarea class="w-full h-20 p-2 rounded-lg bg-zinc-950/50 border border-white/[0.04] hover:border-white/[0.08] focus:border-blue-500/80 focus:outline-none text-zinc-300 text-xs resize-none transition matrix-cell" data-file-id="${file.id}" data-field="findings" placeholder="Findings...">${meta.findings || ''}</textarea>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- Footer -->
          <div class="px-5 py-2.5 border-t border-white/[0.06] bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-500 font-mono text-[11px]">
            <span>Edits auto-saved</span>
            <button id="btn-save-all-matrix" class="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition">Done</button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    this.modal.querySelector('#btn-close-matrix')?.addEventListener('click', () => this.close());
    
    this.modal.querySelector('#btn-save-all-matrix')?.addEventListener('click', async () => {
      await this._saveAllEdits();
      this.onShowToast('Matrix saved');
      this.close();
    });

    this.modal.querySelectorAll('.matrix-cell').forEach(cell => {
      cell.addEventListener('change', async () => {
        const fileId = cell.getAttribute('data-file-id');
        const field = cell.getAttribute('data-field');
        const value = cell.value;
        const meta = await db.getMetadata(fileId) || { fileId };
        meta[field] = value;
        await db.saveMetadata(meta);
      });
    });

    this.modal.querySelector('#btn-copy-md-matrix')?.addEventListener('click', async () => {
      const mdTable = this.generateMarkdownTable();
      await copyToClipboard(mdTable);
      this.onShowToast('Copied Markdown table');
    });

    this.modal.querySelector('#btn-download-csv')?.addEventListener('click', () => {
      this.downloadCSV();
    });
  }

  async _saveAllEdits() {
    const cells = this.modal.querySelectorAll('.matrix-cell');
    for (const cell of cells) {
      const fileId = cell.getAttribute('data-file-id');
      const field = cell.getAttribute('data-field');
      const value = cell.value;
      const meta = await db.getMetadata(fileId) || { fileId };
      meta[field] = value;
      await db.saveMetadata(meta);
    }
  }

  generateMarkdownTable() {
    let md = `# Literature Review Matrix: ${this.folderName}\n\n`;
    md += `| Paper | Key Contributions | Limitations | Methodology | Findings |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;

    this.papersData.forEach(item => {
      const { file, meta } = item;
      const title = (meta.title || file.name).replace(/\|/g, '\\|');
      const authors = `${meta.authors || 'Unknown'} (${meta.year || 'n.d.'})`.replace(/\|/g, '\\|');
      const contrib = (meta.contributions || '-').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      const limit = (meta.limitations || '-').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      const method = (meta.methodology || '-').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      const findings = (meta.findings || '-').replace(/\|/g, '\\|').replace(/\n/g, '<br>');

      md += `| **${title}**<br>*${authors}* | ${contrib} | ${limit} | ${method} | ${findings} |\n`;
    });

    return md;
  }

  downloadCSV() {
    const headers = ['Title', 'Authors', 'Year', 'Contributions', 'Limitations', 'Methodology', 'Findings'];
    const rows = this.papersData.map(item => {
      const { file, meta } = item;
      return [
        `"${(meta.title || file.name).replace(/"/g, '""')}"`,
        `"${(meta.authors || '').replace(/"/g, '""')}"`,
        `"${meta.year || ''}"`,
        `"${(meta.contributions || '').replace(/"/g, '""')}"`,
        `"${(meta.limitations || '').replace(/"/g, '""')}"`,
        `"${(meta.methodology || '').replace(/"/g, '""')}"`,
        `"${(meta.findings || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Literature_Review_Matrix_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.onShowToast('Downloaded CSV');
  }
}
