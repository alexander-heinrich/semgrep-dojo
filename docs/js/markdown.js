// Markdown rendering for instructions / follow-ups (content is authored in this repo, not user input).
import { marked } from '../vendor/editor.bundle.js';

marked.setOptions({ gfm: true, breaks: false });

export function md(text) {
  return marked.parse(text || '');
}
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
