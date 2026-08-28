/**
 * Literature Review & Folder Summary Exporter
 * Bundles papers, citations, notes, highlights, and synthesis matrix into a ready-to-use .md file.
 */

import { db } from './db.js';
import { formatAPA, formatBibTeX } from './citation.js';

export async function exportFolderSummary(folderId = null) {
  let files = [];
  if (folderId) {
    files = await db.getByIndex('files', 'folderId', folderId);
  } else {
    files = await db.getAll('files');
  }

  const folders = await db.getFolders();
  const currentFolder = folders.find(f => f.id === folderId);
  const folderTitle = currentFolder ? currentFolder.name : 'Thesis Complete Collection';

  let md = `# Thesis Literature Review Summary\n\n`;
  md += `**Scope:** ${folderTitle}  \n`;
  md += `**Generated Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}  \n`;
  md += `**Total Papers:** ${files.length}\n\n`;
  md += `---\n\n`;

  // 1. Table of Contents / Bibliography
  md += `## 📚 Bibliography & Overview\n\n`;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const meta = await db.getMetadata(f.id);
    const apa = formatAPA(meta) || f.name;
    md += `${i + 1}. ${apa}\n`;
  }
  md += `\n---\n\n`;

  // 2. Detailed Breakdown per paper
  md += `## 📑 Detailed Paper Notes & Highlights\n\n`;

  for (const f of files) {
    const meta = await db.getMetadata(f.id);
    const highlights = await db.getHighlights(f.id);
    const notes = await db.getSideNotes(f.id);
    const scratchpad = await db.getScratchpad(f.id);
    const bibtex = formatBibTeX(meta, f.id);

    md += `### 📄 ${meta?.title || f.name}\n\n`;
    if (meta?.authors) md += `- **Authors:** ${meta.authors} (${meta.year || 'n.d.'})\n`;
    if (meta?.journal) md += `- **Publication:** ${meta.journal}\n`;
    if (meta?.doi) md += `- **DOI:** [${meta.doi}](https://doi.org/${meta.doi})\n`;
    if (f.tags && f.tags.length > 0) md += `- **Tags:** \`${f.tags.map(t => `#${t}`).join(' ')}\`\n`;
    md += `\n`;

    // Synthesis Matrix Points
    if (meta?.contributions || meta?.limitations || meta?.methodology || meta?.findings) {
      md += `#### 🔬 Research Summary Matrix\n\n`;
      if (meta.contributions) md += `**Key Contributions (จุดเด่น):**\n> ${meta.contributions.replace(/\n/g, '\n> ')}\n\n`;
      if (meta.limitations) md += `**Limitations (ข้อจำกัด):**\n> ${meta.limitations.replace(/\n/g, '\n> ')}\n\n`;
      if (meta.methodology) md += `**Methodology (วิธีวิจัย):**\n> ${meta.methodology.replace(/\n/g, '\n> ')}\n\n`;
      if (meta.findings) md += `**Findings (ผลการทดลอง):**\n> ${meta.findings.replace(/\n/g, '\n> ')}\n\n`;
    }

    // Highlights & Notes
    if (highlights.length > 0) {
      md += `#### ✏️ Key Quotes & Side-Notes\n\n`;
      const pages = {};
      highlights.forEach(h => {
        if (!pages[h.pageNumber]) pages[h.pageNumber] = [];
        pages[h.pageNumber].push(h);
      });

      for (const pageNum of Object.keys(pages).sort((a, b) => Number(a) - Number(b))) {
        md += `*Page ${pageNum}:*\n`;
        for (const hl of pages[pageNum]) {
          md += `- Quote: *"${hl.text}"*\n`;
          const note = notes.find(n => n.highlightId === hl.id);
          if (note && note.content) {
            md += `  - 💡 **Note:** ${note.content}\n`;
          }
        }
        md += `\n`;
      }
    }

    // Scratchpad notes
    if (scratchpad && scratchpad.trim()) {
      md += `#### 📝 Scratchpad Synthesis\n\n${scratchpad}\n\n`;
    }

    // BibTeX Entry
    if (bibtex) {
      md += `#### 🏷️ BibTeX (LaTeX)\n\`\`\`bibtex\n${bibtex}\n\`\`\`\n\n`;
    }

    md += `---\n\n`;
  }

  // Trigger download
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = folderTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `${safeName}_Literature_Review_Summary.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return true;
}
