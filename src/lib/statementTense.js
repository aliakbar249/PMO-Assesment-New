// ─── Statement Tense Adapter ─────────────────────────────────────────────────
// Statements are stored in a neutral 3rd-person singular form (no explicit
// subject, capitalised verb: "Ensures…", "Engages…", "Is comfortable…").
// This module converts them for display:
//
//   SELF     →  "I ensure…"    / "My team is empowered…"
//   REVIEWER →  "Tom ensures…" / "Tom's team is empowered…"
//
// Processing order:
//  1.  "The entire team…"         → My/[Name]'s entire team…
//  2.  "The team…"                → My/[Name]'s team…
//  3.  "As a team…"               → kept as-is (self) / [Name]'s team: … (reviewer)
//  4.  "Team communications…"     → My/[Name]'s team's communications…
//  5.  Named-rewrite table        → exact-match rewrites for irregular statements
//  6.  "Views themselves…"        → I view myself… / [Name] views themselves…
//  7.  "Is …" (linking verb)      → I am… / [Name] is…
//  8.  Verb-first (the majority)  → de-conjugate for self, keep for reviewer
//  +   Reviewer pronoun fixes
// ─────────────────────────────────────────────────────────────────────────────

// ─── toInfinitive ─────────────────────────────────────────────────────────────
// Converts a 3rd-person-singular present verb to its base/infinitive form.
// Examples:
//   ensures   → ensure    prioritizes → prioritize    pushes → push
//   identifies→ identify  replies     → reply         trusts → trust
//   addresses → address   engages     → engage        works  → work
function toInfinitive(verb) {
  const v = verb.toLowerCase().trim();

  // Irregulars first
  const IRREGULAR = { is: 'be', has: 'have', does: 'do', goes: 'go' };
  if (IRREGULAR[v]) return IRREGULAR[v];

  // -izes / -ises  (prioritizes→prioritize, recognizes→recognize) — before general -es
  if (v.endsWith('izes') || v.endsWith('ises')) return v.slice(0, -1);

  // -ies → -y  (replies→reply, identifies→identify, tries→try)
  if (v.endsWith('ies') && v.length > 4) return v.slice(0, -3) + 'y';

  // -sses → -ss  (addresses→address, assesses→assess)
  if (v.endsWith('sses')) return v.slice(0, -2);

  // -ches / -shes / -xes → drop -es  (watches→watch, pushes→push, fixes→fix)
  if (v.endsWith('ches') || v.endsWith('shes') || v.endsWith('xes')) return v.slice(0, -2);

  // -oes → -o  (goes already handled above; echoes→echo, vetoes→veto)
  if (v.endsWith('oes') && v.length > 3) return v.slice(0, -2);

  // -es where stripping -s leaves a word ending in -e
  //   ensures→ensure, engages→engage, provides→provide, creates→create, makes→make
  if (v.endsWith('es') && v.length > 3) {
    const minusS = v.slice(0, -1);          // "ensures" → "ensure"
    if (minusS.endsWith('e')) return minusS; // keep "ensure" (ends in e)
    return v.slice(0, -2);                  // otherwise drop both chars
  }

  // Plain -s  (trusts→trust, works→work, asks→ask, meets→meet, keeps→keep)
  if (v.endsWith('s') && v.length > 3) return v.slice(0, -1);

  return v; // fallback: already base form
}

// ─── De-conjugate compounds: "and/or [Verb-3ps]" inside a sentence ────────────
// "Works and seeks input…"             → " and seek input…"
// "Meets those timelines or provides…" → " or provide…"
//
// Guards against false positives on plural nouns like "stakeholders", "members":
// we skip words with noun-typical suffixes (-ers, -ors, -ees, -ists, -ings, -ments,
// -lines, -bles when standalone, -bers) and only de-conjugate known verb patterns.
const NOUN_SUFFIX_RE = /(?:ders|ters|ners|bers|ers|ors|ees|ists|ings|ments|lines|bles|ples)$/;

function fixCompoundVerbs(remainder) {
  return remainder.replace(
    /\b(and|or)\s+([A-Za-z]{3,})\b/g,
    (match, conj, v) => {
      const vl = v.toLowerCase();
      // Skip words that look like plural nouns
      if (NOUN_SUFFIX_RE.test(vl)) return match;
      // Skip unless it ends in a verb suffix (-s or -es)
      if (!vl.endsWith('s')) return match;
      const inf = toInfinitive(vl);
      // Only replace if toInfinitive actually changed something (i.e. it was conjugated)
      return inf !== vl ? conj + ' ' + inf : match;
    }
  );
}

// ─── Named rewrites for irregular / passive / adverb-first statements ─────────
// These are statements that can't be handled by the generic verb-prefix rules.
// Matched in order against the lower-cased statement text.
const NAMED_REWRITES = [
  {
    // "Conflicts are not avoided and are dealt with constructively" — noun-first passive
    match: /^conflicts are/i,
    self:     'In my team, conflicts are not avoided and are dealt with constructively',
    reviewer: (name) => `In ${name}'s team, conflicts are not avoided and are dealt with constructively`,
  },
  {
    // "Benefits alignment is discussed as a team" — noun-first ("Benefits" is a noun here)
    match: /^benefits alignment/i,
    self:     'I ensure benefits alignment is discussed as a team',
    reviewer: (name) => `${name} ensures benefits alignment is discussed as a team`,
  },
  {
    // "Actively listens and pays attention" — adverb-first (verb is the 2nd word)
    match: /^actively listens/i,
    self:     'I actively listen and pay attention',
    reviewer: (name) => `${name} actively listens and pays attention`,
  },
  {
    // "When decisions are taken, action steps are ensured" — subordinate-clause-first
    match: /^when decisions are taken/i,
    self:     'I ensure action steps are taken when decisions are made',
    reviewer: (name) => `${name} ensures action steps are taken when decisions are made`,
  },
];

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * adaptStatement(text, mode, firstName)
 *
 * @param {string} text        - Raw statement text from the data file
 * @param {'self'|'reviewer'}  mode
 * @param {string} firstName   - Employee first name (used for reviewer mode only)
 * @returns {string}           - Display-ready grammatically correct sentence
 */
export function adaptStatement(text, mode, firstName) {
  if (!text) return text;

  const name  = firstName || 'This person';
  const lower = text.trim().toLowerCase();

  // ── 1. "The entire team…" ──────────────────────────────────────────────────
  if (lower.startsWith('the entire team')) {
    const rest = text.slice('The entire team'.length);
    if (mode === 'self') {
      return ('My entire team' + rest).replace(/\bthis person\b/gi, 'me');
    }
    return (name + "'s entire team" + rest).replace(/\bthis person\b/gi, name);
  }

  // ── 2. "The team…" ────────────────────────────────────────────────────────
  if (lower.startsWith('the team')) {
    const rest = text.slice('The team'.length);
    return mode === 'self'
      ? 'My team' + rest
      : name + "'s team" + rest;
  }

  // ── 3. "As a team…" ───────────────────────────────────────────────────────
  // Passive form ("As a team, solutions are sought") — kept for self; reworded for reviewer.
  if (lower.startsWith('as a team')) {
    if (mode === 'self') {
      return text; // reads naturally as written
    }
    const afterComma = text.slice('As a team'.length).replace(/^,\s*/, '');
    return name + "'s team: " + afterComma.charAt(0).toUpperCase() + afterComma.slice(1);
  }

  // ── 4. "Team communications…" ─────────────────────────────────────────────
  if (lower.startsWith('team communications')) {
    const rest = text.slice('Team communications'.length);
    return mode === 'self'
      ? "My team's communications" + rest
      : name + "'s team's communications" + rest;
  }

  // ── 5. Named rewrites for irregular statements ────────────────────────────
  for (const rule of NAMED_REWRITES) {
    if (rule.match.test(lower)) {
      return mode === 'self' ? rule.self : rule.reviewer(name);
    }
  }

  // ── 6. "Views themselves…" ────────────────────────────────────────────────
  if (lower.startsWith('views themselves')) {
    const rest = text.slice('views themselves'.length);
    if (mode === 'self') {
      return 'I view myself' + rest.replace(/\band is\b/gi, 'and am');
    }
    return name + ' views themselves' + rest;
  }

  // ── 7. "Is …" (linking verb start) ───────────────────────────────────────
  if (lower.startsWith('is ')) {
    const rest = text.slice(3);
    return mode === 'self'
      ? 'I am ' + rest.charAt(0).toLowerCase() + rest.slice(1)
      : name + ' is ' + rest.charAt(0).toLowerCase() + rest.slice(1);
  }

  // ── 8. Verb-first statements (the large majority) ─────────────────────────
  // Raw text: "Ensures project information is shared…"
  //   self     → "I ensure project information is shared…"   (de-conjugated)
  //   reviewer → "Sarah ensures project information is shared…" (kept conjugated)
  const spaceIdx   = text.indexOf(' ');
  const firstWord  = spaceIdx >= 0 ? text.slice(0, spaceIdx) : text;
  const remainder  = spaceIdx >= 0 ? text.slice(spaceIdx) : '';   // includes leading space

  if (mode === 'self') {
    const infinitive      = toInfinitive(firstWord);
    const fixedRemainder  = fixCompoundVerbs(remainder);
    return 'I ' + infinitive + fixedRemainder;
  }

  // Reviewer: keep original conjugated verb, fix pronouns in body
  const conjugated = firstWord.charAt(0).toLowerCase() + firstWord.slice(1);
  let result = name + ' ' + conjugated + remainder;
  result = result
    .replace(/\bmy\b/gi,          name + "'s")
    .replace(/\bmyself\b/gi,      'themselves')
    .replace(/\bthis person\b/gi, name);
  return result;
}
