// Caller phrases are an explicit OR of casefolded substrings.
// This is not a role-family model and it does not select employment.

export function normalizePhrase(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function canonicalPhrases(phrases) {
  const out = [];
  const seen = new Set();
  for (const phrase of phrases) {
    const normalized = normalizePhrase(phrase);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  out.sort();
  return out;
}

export function phraseError(phrases) {
  if (!Array.isArray(phrases) || phrases.length < 1 || phrases.length > 8) return 'criteria_required';
  for (const phrase of phrases) {
    if (typeof phrase !== 'string') return 'criteria_required';
    const normalized = normalizePhrase(phrase);
    if (normalized.length < 2 || normalized.length > 80) return 'criteria_required';
    if (!/[a-z]/.test(normalized)) return 'criteria_required';
    if (/[/:@\\]/.test(phrase) || phrase.includes('://')) return 'criteria_required';
  }
  return null;
}

export function titleMatches(title, phrases) {
  const normalized = normalizePhrase(title);
  return phrases.some((phrase) => normalized.includes(phrase));
}

export function journeyKey(board, phrases) {
  return `${board}\n${phrases.join('\n')}`;
}
