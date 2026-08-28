/**
 * ThesisMind Data Models & Type Helpers
 * Extended with Rich Markup & Annotation Models (Text Box, Image/Figure, Drawing, Shape).
 */

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
}

export const HighlightColors = {
  YELLOW: { id: 'yellow', name: 'Yellow', hex: '#fef08a', class: 'highlight-yellow', border: '#facc15' },
  GREEN: { id: 'green', name: 'Green', hex: '#bbf7d0', class: 'highlight-green', border: '#4ade80' },
  BLUE: { id: 'blue', name: 'Blue', hex: '#bfdbfe', class: 'highlight-blue', border: '#60a5fa' },
  PURPLE: { id: 'purple', name: 'Purple', hex: '#e9d5ff', class: 'highlight-purple', border: '#c084fc' },
  PINK: { id: 'pink', name: 'Pink', hex: '#fbcfe8', class: 'highlight-pink', border: '#f472b6' },
};

export const MarkupColors = [
  { id: '#facc15', name: 'Yellow' },
  { id: '#60a5fa', name: 'Blue' },
  { id: '#4ade80', name: 'Green' },
  { id: '#f87171', name: 'Red' },
  { id: '#c084fc', name: 'Purple' },
  { id: '#ffffff', name: 'White' },
  { id: '#18181b', name: 'Dark' }
];

export const PaperThemes = {
  LIGHT: 'light',
  SEPIA: 'sepia',
  DARK: 'dark',
};

export function createFolder({ name, parentId = null }) {
  return {
    id: generateId('fld'),
    name: name.trim(),
    parentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createPaperFile({ name, folderId = null, size = 0, mimeType = 'application/pdf', tags = [], pdfData = null, pageCount = 1 }) {
  return {
    id: generateId('file'),
    name: name.trim(),
    folderId,
    size,
    mimeType,
    tags: Array.isArray(tags) ? tags : [],
    pdfData,
    pageCount,
    readingProgress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createHighlight({ fileId, pageNumber, text, color = 'yellow', rects = [] }) {
  return {
    id: generateId('hl'),
    fileId,
    pageNumber: Number(pageNumber),
    text: text.trim(),
    color,
    rects,
    createdAt: new Date().toISOString(),
  };
}

export function createSideNote({ fileId, highlightId = null, pageNumber = 1, content = '' }) {
  return {
    id: generateId('note'),
    fileId,
    highlightId,
    pageNumber: Number(pageNumber),
    content: content.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createMarkupItem({ fileId, pageNumber = 1, type = 'textbox', x = 0.1, y = 0.1, width = 0.25, height = 0.15, data = {} }) {
  return {
    id: generateId('mk'),
    fileId,
    pageNumber: Number(pageNumber),
    type, // 'textbox' | 'image' | 'drawing' | 'shape'
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    width: Math.max(0.05, Math.min(1, width)),
    height: Math.max(0.03, Math.min(1, height)),
    data: {
      text: data.text || '',
      bgColor: data.bgColor || '#fef08a',
      textColor: data.textColor || '#18181b',
      fontSize: data.fontSize || 13,
      src: data.src || '',
      caption: data.caption || '',
      strokeColor: data.strokeColor || '#f87171',
      strokeWidth: data.strokeWidth || 2,
      paths: data.paths || [],
      shapeType: data.shapeType || 'rect',
      ...data
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createPaperMetadata({ fileId, title = '', authors = '', year = '', journal = '', volume = '', issue = '', pages = '', doi = '', publisher = '', abstract = '', contributions = '', limitations = '', methodology = '', findings = '' }) {
  return {
    fileId,
    title: title || '',
    authors: authors || '',
    year: year || '',
    journal: journal || '',
    volume: volume || '',
    issue: issue || '',
    pages: pages || '',
    doi: doi || '',
    publisher: publisher || '',
    abstract: abstract || '',
    contributions: contributions || '',
    limitations: limitations || '',
    methodology: methodology || '',
    findings: findings || '',
    updatedAt: new Date().toISOString(),
  };
}
