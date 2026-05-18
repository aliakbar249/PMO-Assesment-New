// ─── Statement Tense Adapter ─────────────────────────────────────────────────
// Statements in the DB are stored in an uninflected "action" form
// (no subject, mixed case). This module converts them for display:
//
//   SELF       →  "I engage the team…"  /  "I am comfortable…"
//   REVIEWER   →  "Tom engages the team…"  /  "Tom is comfortable…"
//
// Rules applied in order:
//  1. Statements starting with "The team", "As a team" — kept as-is (subject
//     is the team, not the individual being rated).
//  2. "Views themselves…" — special-cased to "I view myself…" / "Tom views themselves…"
//  3. "Is " / "Is comfortable" etc. (linking-verb start) →
//       self: "I am …"   |  reviewer: "[Name] is …"
//  4. Plain verb-first statements →
//       self: "I [verb]…" (first letter lower-cased)
//       reviewer: "[Name] [verb]…" (first letter lower-cased)
//  5. Any "my " / " my " inside the text → reviewer: "his/her " (default "their")
//  6. Any "myself" → reviewer: "themselves"
//  7. "this person" → reviewer: first name
// ────────────────────────────────────────────────────────────────────────────

// Patterns where the team is the grammatical subject — no personal prefix added
const TEAM_SUBJECT_PREFIXES = [
  'the team',
  'as a team',
  'team communications',
];

function isTeamSubject(text) {
  const lower = text.trim().toLowerCase();
  return TEAM_SUBJECT_PREFIXES.some(p => lower.startsWith(p));
}

/**
 * adaptStatement(text, mode, firstName)
 *
 * @param {string} text        - Raw statement text from DB
 * @param {'self'|'reviewer'}  mode
 * @param {string} firstName   - Employee first name (used for reviewer mode)
 * @returns {string}           - Display-ready sentence
 */
export function adaptStatement(text, mode, firstName) {
  if (!text) return text;

  const name = firstName || 'This person';

  // ── 1. Team-subject statements — return capitalised but no prefix ──
  if (isTeamSubject(text)) {
    // Capitalise first letter
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // ── 2. Special case: "Views themselves…" ──────────────────────────
  const lower = text.toLowerCase();
  if (lower.startsWith('views themselves')) {
    if (mode === 'self') {
      const rest = text.slice('views themselves'.length);
      return 'I view myself' + rest;
    } else {
      return name + ' ' + text.charAt(0).toLowerCase() + text.slice(1);
    }
  }

  // ── 3. Linking-verb "Is …" start ─────────────────────────────────
  if (lower.startsWith('is ')) {
    const rest = text.slice(3); // strip "Is "
    if (mode === 'self') {
      return 'I am ' + rest.charAt(0).toLowerCase() + rest.slice(1);
    } else {
      return name + ' is ' + rest.charAt(0).toLowerCase() + rest.slice(1);
    }
  }

  // ── 4. Plain verb-first ───────────────────────────────────────────
  const body = text.charAt(0).toLowerCase() + text.slice(1);

  let result;
  if (mode === 'self') {
    result = 'I ' + body;
    // Replace "my " with "my " (self is correct already)
    // Replace "myself" → "myself" (already correct)
  } else {
    result = name + ' ' + body;
    // Replace possessive/reflexive pronouns for reviewer mode
    result = result
      .replace(/\bmy\b/g,     name + "'s")
      .replace(/\bmyself\b/g, 'themselves')
      .replace(/\bthis person\b/gi, name);
  }

  return result;
}
