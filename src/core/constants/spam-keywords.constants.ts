export const SPAM_KEYWORD_PATTERNS: RegExp[] = [
  /\bsubscri(?:be|ption|ptions?)\b/i,
  /\boffer(?:s)?\b/i,
  /\bpromo(?:tion(?:al)?|tions?|code)?\b/i,
  /\bdiscount(?:s)?\b/i,
  /\bfree\s+(?:trial|gift|money|cash|prize|membership)\b/i,
  /\bwin(?:ner|ners|ning)?\b/i,
  /\bclick\s+here\b/i,
  /\bact\s+now\b/i,
  /\blimited[\s-]time\b/i,
  /\bcasino\b/i,
  /\blotter(?:y|ies)\b/i,
  /\bbitcoin\b/i,
  /\bcryptocurrenc(?:y|ies)\b/i,
  /\binvestment\s+opportunit(?:y|ies)\b/i,
  /\bmake\s+(?:easy\s+)?money\b/i,
  /\bearn\s+(?:money|cash|income)\b/i,
  /\bwork\s+from\s+home\b/i,
  /\bpassive\s+income\b/i,
  /\bviagra\b/i,
  /\bcialis\b/i,
  /\bclick\s+(?:the\s+)?link\b/i,
  /\bunsubscribe\b/i,
  /\bspam\b/i,
  /\bget\s+rich\b/i,
  /\b100\s*%\s*free\b/i,
  /\bno\s+credit\s+card\s+required\b/i,
  /\brisk[\s-]free\b/i,
  /\bgift\s+card\b/i,
];

export const URL_PATTERN = /https?:\/\/[^\s]+/gi;

export const MAX_URLS_IN_FIELD = 1;

export const SPAM_CHECKED_FIELDS: readonly string[] = [
  'message',
  'additionalNote',
  'notes',
];
