/**
 * Citation Formatter & BibTeX Generator for Thesis & LaTeX
 */

export function generateBibTeXKey(metadata, fallbackId = 'paper') {
  const firstAuthor = (metadata.authors || '')
    .split(',')[0]
    .split(' and ')[0]
    .trim()
    .split(' ')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'author';
  
  const year = metadata.year ? metadata.year.toString().trim() : '2024';
  
  const firstWord = (metadata.title || fallbackId)
    .trim()
    .split(/\s+/)
    .find(w => w.length > 3) || 'paper';
  const cleanWord = firstWord.toLowerCase().replace(/[^a-z0-9]/g, '');

  return `${firstAuthor}${year}${cleanWord}`;
}

export function formatBibTeX(metadata, fileId = 'paper') {
  if (!metadata) return '';
  const key = generateBibTeXKey(metadata, fileId);
  const isJournal = Boolean(metadata.journal && !metadata.journal.toLowerCase().includes('conference'));
  const type = isJournal ? 'article' : 'inproceedings';

  const fields = [];
  if (metadata.title) fields.push(`  title = {${metadata.title}}`);
  if (metadata.authors) fields.push(`  author = {${metadata.authors}}`);
  if (metadata.year) fields.push(`  year = {${metadata.year}}`);
  if (isJournal && metadata.journal) {
    fields.push(`  journal = {${metadata.journal}}`);
  } else if (metadata.journal) {
    fields.push(`  booktitle = {${metadata.journal}}`);
  }
  if (metadata.volume) fields.push(`  volume = {${metadata.volume}}`);
  if (metadata.issue) fields.push(`  number = {${metadata.issue}}`);
  if (metadata.pages) fields.push(`  pages = {${metadata.pages}}`);
  if (metadata.publisher) fields.push(`  publisher = {${metadata.publisher}}`);
  if (metadata.doi) fields.push(`  doi = {${metadata.doi}}`);

  return `@${type}{${key},\n${fields.join(',\n')}\n}`;
}

export function formatAPA(metadata) {
  if (!metadata) return '';
  const authors = metadata.authors || 'Unknown Author';
  const year = metadata.year ? `(${metadata.year})` : '(n.d.)';
  const title = metadata.title ? `${metadata.title}.` : '';
  const journal = metadata.journal ? `*${metadata.journal}*` : '';
  const vol = metadata.volume ? `, ${metadata.volume}` : '';
  const issue = metadata.issue ? `(${metadata.issue})` : '';
  const pages = metadata.pages ? `, ${metadata.pages}` : '';
  const doi = metadata.doi ? ` https://doi.org/${metadata.doi.replace(/^https?:\/\/doi\.org\//, '')}` : '';

  return `${authors} ${year}. ${title} ${journal}${vol}${issue}${pages}.${doi}`.trim();
}

export function formatIEEE(metadata) {
  if (!metadata) return '';
  const authors = metadata.authors || 'Unknown Author';
  const title = metadata.title ? `"${metadata.title},"` : '';
  const journal = metadata.journal ? `*${metadata.journal}*` : '';
  const vol = metadata.volume ? `, vol. ${metadata.volume}` : '';
  const issue = metadata.issue ? `, no. ${metadata.issue}` : '';
  const pages = metadata.pages ? `, pp. ${metadata.pages}` : '';
  const year = metadata.year ? `, ${metadata.year}` : '';
  const doi = metadata.doi ? `, doi: ${metadata.doi}` : '';

  return `${authors}, ${title} ${journal}${vol}${issue}${pages}${year}${doi}.`.trim();
}

export function formatMLA(metadata) {
  if (!metadata) return '';
  const authors = metadata.authors || 'Unknown Author';
  const title = metadata.title ? `"${metadata.title}."` : '';
  const journal = metadata.journal ? `*${metadata.journal}*` : '';
  const vol = metadata.volume ? `, vol. ${metadata.volume}` : '';
  const issue = metadata.issue ? `, no. ${metadata.issue}` : '';
  const year = metadata.year ? `, ${metadata.year}` : '';
  const pages = metadata.pages ? `, pp. ${metadata.pages}` : '';

  return `${authors}. ${title} ${journal}${vol}${issue}${year}${pages}.`.trim();
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    // Fallback using textarea
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}
