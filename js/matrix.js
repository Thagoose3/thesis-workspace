/**
 * Paper Summary Matrix (Literature Review Comparison Table)
 * Synthesizes all papers in a folder into a comparison matrix for Thesis Chapter 2.
 */

import { db } from './db.js';
import { generateBibTeXKey, formatBibTeX, copyToClipboard } from './citation.js';

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
    this.folderName = currentFolder ? currentFolder.name : 'All Folders (Root)';

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
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <div class="w-full max-w-6xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          <!-- Modal Header -->
          <div class="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
            <div class="flex items-center space-x-3">
              <div class="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              </div>
              <div>
                <h2 class="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <span>Literature Review Summary Matrix</span>
                  <span class="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 text-xs font-mono border border-indigo-800">Chapter 2 Helper</span>
                </h2>
                <p class="text-xs text-slate-400">Comparing ${this.papersData.length} papers in: <b class="text-slate-200">${this.folderName}</b></p>
              </div>
            </div>

            <!-- Export & Close Buttons -->
            <div class="flex items-center space-x-2">
              <button id="btn-copy-md-matrix" class="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-medium flex items-center space-x-1.5 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                <span>Copy Markdown Table</span>
              </button>
              <button id="btn-download-csv" class="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center space-x-1.5 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                <span>Download CSV</span>
              </button>
              <button id="btn-close-matrix" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>

          <!-- Table Container -->
          <div class="flex-1 overflow-auto p-4">
            ${this.papersData.length === 0 ? `
              <div class="p-12 text-center text-slate-500">
                <p class="text-sm font-semibold text-slate-400">No papers found in this folder</p>
                <p class="text-xs text-slate-500 mt-1">Upload or move papers to this folder to build your synthesis matrix.</p>
              </div>
            ` : `
              <div class="overflow-x-auto border border-slate-800 rounded-xl">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="bg-slate-950/90 text-slate-300 border-b border-slate-800 font-mono text-[11px]">
                      <th class="p-3 w-64 min-w-[200px] border-r border-slate-800">Paper & Authors</th>
                      <th class="p-3 w-72 min-w-[220px] border-r border-slate-800 text-emerald-400">Key Contributions (จุดเด่น)</th>
                      <th class="p-3 w-72 min-w-[220px] border-r border-slate-800 text-amber-400">Limitations (ข้อจำกัด)</th>
                      <th class="p-3 w-64 min-w-[200px] border-r border-slate-800 text-blue-400">Methodology (วิธีวิจัย)</th>
                      <th class="p-3 w-64 min-w-[200px] border-r border-slate-800 text-purple-400">Findings (ผลลัพธ์)</th>
                      <th class="p-3 w-36 min-w-[120px]">Citation Key</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800/70 bg-slate-900/50">
                    ${this.papersData.map((item, index) => {
                      const { file, meta, bibKey } = item;
                      return `
                        <tr class="hover:bg-slate-800/40 transition">
                          <!-- Paper Title & Info -->
                          <td class="p-3 align-top border-r border-slate-800/70">
                            <p class="font-semibold text-slate-100 leading-snug">${meta.title || file.name}</p>
                            <p class="text-[11px] text-slate-400 mt-1">${meta.authors || 'Unknown Authors'} (${meta.year || 'n.d.'})</p>
                            <p class="text-[10px] text-slate-500 italic mt-0.5">${meta.journal || ''}</p>
                          </td>

                          <!-- Contributions -->
                          <td class="p-2.5 align-top border-r border-slate-800/70">
                            <textarea class="w-full h-24 p-2 rounded bg-slate-950/60 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 focus:outline-none text-slate-200 text-xs resize-none transition matrix-cell" data-file-id="${file.id}" data-field="contributions" placeholder="Enter key strengths & contributions...">${meta.contributions || ''}</textarea>
                          </td>

                          <!-- Limitations -->
                          <td class="p-2.5 align-top border-r border-slate-800/70">
                            <textarea class="w-full h-24 p-2 rounded bg-slate-950/60 border border-slate-800 hover:border-slate-700 focus:border-amber-500 focus:outline-none text-slate-200 text-xs resize-none transition matrix-cell" data-file-id="${file.id}" data-field="limitations" placeholder="Enter weaknesses or research gaps...">${meta.limitations || ''}</textarea>
                          </td>

                          <!-- Methodology -->
                          <td class="p-2.5 align-top border-r border-slate-800/70">
                            <textarea class="w-full h-24 p-2 rounded bg-slate-950/60 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none text-slate-200 text-xs resize-none transition matrix-cell" data-file-id="${file.id}" data-field="methodology" placeholder="Algorithms, datasets, methods...">${meta.methodology || ''}</textarea>
                          </td>

                          <!-- Findings -->
                          <td class="p-2.5 align-top border-r border-slate-800/70">
                            <textarea class="w-full h-24 p-2 rounded bg-slate-950/60 border border-slate-800 hover:border-slate-700 focus:border-purple-500 focus:outline-none text-slate-200 text-xs resize-none transition matrix-cell" data-file-id="${file.id}" data-field="findings" placeholder="Empirical metrics, recall, speed...">${meta.findings || ''}</textarea>
                          </td>

                          <!-- Citation Key & Action -->
                          <td class="p-3 align-top">
                            <span class="inline-block px-2 py-1 rounded bg-slate-800 text-emerald-400 font-mono text-[11px] border border-slate-700 select-all">\\cite{${bibKey}}</span>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- Modal Footer -->
          <div class="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
            <span class="font-mono text-[11px]">⚡ Edits in matrix are automatically synced to paper metadata.</span>
            <button id="btn-save-all-matrix" class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition shadow-sm">Save Changes</button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // Close modal
    this.modal.querySelector('#btn-close-matrix')?.addEventListener('click', () => this.close());
    
    // Save all edits
    this.modal.querySelector('#btn-save-all-matrix')?.addEventListener('click', async () => {
      await this._saveAllEdits();
      this.onShowToast('Literature Review Matrix saved successfully!');
      this.close();
    });

    // Auto save on change
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

    // Copy Markdown Table
    this.modal.querySelector('#btn-copy-md-matrix')?.addEventListener('click', async () => {
      const mdTable = this.generateMarkdownTable();
      await copyToClipboard(mdTable);
      this.onShowToast('Copied Matrix as Markdown Table!');
    });

    // Download CSV
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
    let md = `# Literature Review Comparison Matrix: ${this.folderName}\n\n`;
    md += `| Paper & Authors | Key Contributions (จุดเด่น) | Limitations (ข้อจำกัด) | Methodology (วิธีวิจัย) | Findings (ผลการทดลอง) | Citation Key |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    this.papersData.forEach(item => {
      const { file, meta, bibKey } = item;
      const title = (meta.title || file.name).replace(/\|/g, '\\|');
      const authors = `${meta.authors || 'Unknown'} (${meta.year || 'n.d.'})`.replace(/\|/g, '\\|');
      const contrib = (meta.contributions || '-').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      const limit = (meta.limitations || '-').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      const method = (meta.methodology || '-').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      const findings = (meta.findings || '-').replace(/\|/g, '\\|').replace(/\n/g, '<br>');

      md += `| **${title}**<br>*${authors}* | ${contrib} | ${limit} | ${method} | ${findings} | \`\\cite{${bibKey}}\` |\n`;
    });

    return md;
  }

  downloadCSV() {
    const headers = ['Title', 'Authors', 'Year', 'Journal', 'Contributions', 'Limitations', 'Methodology', 'Findings', 'CitationKey'];
    const rows = this.papersData.map(item => {
      const { file, meta, bibKey } = item;
      return [
        `"${(meta.title || file.name).replace(/"/g, '""')}"`,
        `"${(meta.authors || '').replace(/"/g, '""')}"`,
        `"${meta.year || ''}"`,
        `"${(meta.journal || '').replace(/"/g, '""')}"`,
        `"${(meta.contributions || '').replace(/"/g, '""')}"`,
        `"${(meta.limitations || '').replace(/"/g, '""')}"`,
        `"${(meta.methodology || '').replace(/"/g, '""')}"`,
        `"${(meta.findings || '').replace(/"/g, '""')}"`,
        `"${bibKey}"`
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
    this.onShowToast('Downloaded CSV matrix file!');
  }
}
