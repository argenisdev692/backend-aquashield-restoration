import sanitizeHtml from 'sanitize-html';

/**
 * Safe allowlist for rich blog post content (Markdown-rendered or light HTML).
 *
 * Follows OWASP best practices + the existing pattern used in ResendEmailAdapter.
 * Strips scripts, event handlers, javascript: URLs, style attributes, etc.
 *
 * Allowed features:
 * - Headings, paragraphs, lists
 * - Emphasis (bold, italic, underline, strikethrough)
 * - Links (with safe href)
 * - Blockquotes, code/pre
 * - Images (src must be http/https or data; no javascript:)
 * - Basic tables
 *
 * Use this for `postContent` and any other user/AI-generated rich text fields.
 */
const RICH_CONTENT_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'br',
    'hr',
    'ul',
    'ol',
    'li',
    'strong',
    'em',
    'b',
    'i',
    'u',
    's',
    'a',
    'blockquote',
    'pre',
    'code',
    'img',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': [], // no other global attributes (no style, no onclick, etc.)
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  // Force safe rel on links to prevent reverse tabnabbing
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'noopener noreferrer',
    }),
  },
  // Explicitly forbid dangerous stuff even if someone bypasses tags
  disallowedTagsMode: 'discard',
};

/**
 * Sanitizes rich text content intended for blog posts / articles.
 * Safe to call on both manually-provided content and AI-generated Markdown/HTML.
 *
 * Returns a clean string that can be stored and later rendered by the frontend
 * (using react-markdown, marked, or a safe HTML renderer).
 */
export function sanitizeRichContent(input: string | null | undefined): string {
  if (!input) return '';
  return sanitizeHtml(input, RICH_CONTENT_CONFIG);
}

/**
 * Strict sanitizer for short text fields (titles, slugs, meta, excerpts, keywords).
 * Removes ALL HTML tags.
 */
export function sanitizePlainText(input: string | null | undefined): string {
  if (!input) return '';
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  });
}
