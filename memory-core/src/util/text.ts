/** Minimal English stopword set for keyword extraction. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'for', 'of', 'to',
  'in', 'on', 'at', 'by', 'with', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we',
  'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'our', 'their', 'do',
  'does', 'did', 'so', 'not', 'no', 'yes', 'can', 'will', 'would', 'should',
  'could', 'have', 'has', 'had', 'what', 'which', 'who', 'how', 'when', 'where',
]);

/** Lower-case, split on non-word characters, drop stopwords and very short tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** Return the most frequent tokens (descending), up to `limit`. */
export function topKeywords(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const tok of tokenize(text)) {
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tok]) => tok);
}
