// ─── Statement Tense Adapter ─────────────────────────────────────────────────
// Statements are stored in the DB in FIRST-PERSON INFINITIVE form with no
// subject, e.g.:
//   "trust my team and stakeholders"
//   "am willing to make tough decisions when needed"
//   "team is empowered to operate independently"
//   "As a team we seek to develop creative solutions"
//
// This module converts them for display:
//
//   SELF     →  "I trust my team…"       / "My team is empowered…"
//   REVIEWER →  "Sarah trusts Sarah's…"  / "Sarah's team is empowered…"
//
// Processing order (first match wins):
//  1.  "The entire team…"            → My/[Name]'s entire team…
//  2.  "Team communications…"        → My/[Name]'s team's communications…
//  3.  "team …" (no article)         → My/[Name]'s team…
//  4.  "As a team we …"              → kept (self) / [Name]'s team [verb+s]… (reviewer)
//  5.  "am …"                        → I am… / [Name] is…
//  6.  "view myself…"                → I view myself… / [Name] views themselves…
//  7.  "When decisions are taken…"   → exact rewrite (contains embedded "I")
//  8.  "If I am not sure…"           → exact rewrite
//  9.  "don't avoid conflict…"       → I don't… / [Name] doesn't…
// 10.  All other infinitives         → I [verb]… / [Name] [verb+s]…
// ─────────────────────────────────────────────────────────────────────────────

// ─── toThirdPerson ────────────────────────────────────────────────────────────
// Converts a base-form VERB to 3rd-person singular present.
// Guards against modal/auxiliary verbs and adverbs.
const MODALS = new Set(['can', 'could', 'will', 'would', 'shall', 'should',
                         'may', 'might', 'must', 'need', 'dare', 'ought']);

// Words ending in these suffixes are almost certainly adverbs/adjectives,
// not verbs — skip conjugation entirely.
const NON_VERB_SUFFIX_RE = /(?:ly|ful|ous|ive|ible|able|ment|ness|tion|sion|ity)$/;

function toThirdPerson(verb) {
  const v = verb.toLowerCase().trim();

  // Modals never inflect
  if (MODALS.has(v)) return v;

  // Adverbs / adjectives / nouns — return as-is
  if (NON_VERB_SUFFIX_RE.test(v)) return v;

  // Irregulars
  if (v === 'be')   return 'is';
  if (v === 'have') return 'has';
  if (v === 'do')   return 'does';
  if (v === 'go')   return 'goes';

  // Ends in consonant + y → drop y, add -ies  (reply→replies, try→tries)
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ies';

  // Ends in s, x, z, ch, sh → add -es  (push→pushes, address→addresses)
  if (/(?:s|x|z|ch|sh)$/.test(v)) return v + 'es';

  // Default: add -s
  return v + 's';
}

// ─── fixReviewerBody ──────────────────────────────────────────────────────────
// Transforms first-person references throughout the body of a reviewer sentence:
//   "my"     → "[Name]'s"
//   "myself" → "themselves"
//   "me"     → "[Name]"     (object pronoun: "advises me", "trust me")
//   "I"      → "[Name]"     (subject pronoun: "team and I work")
// Also conjugates verbs that immediately follow the replaced "I":
//   "what I need" → "what Sarah needs"
//   "so I know"   → "so Sarah knows"
function fixReviewerBody(text, name) {
  let result = text;

  // 1. my → [Name]'s
  result = result.replace(/\bmy\b/gi, name + "'s");

  // 2. myself → themselves
  result = result.replace(/\bmyself\b/gi, 'themselves');

  // 3. me → [Name]   (object pronoun)
  result = result.replace(/\bme\b/g, name);

  // 4. "I [adverb*] [verb]" → "[Name] [adverb*] [verb+s]"
  //    Handles: "I use" → "Sarah uses"
  //             "I actively listen" → "Sarah actively listens"
  //    Skip when I is part of a compound subject ("and I", "or I").
  result = result.replace(/\bI\s+((?:[a-z]+ly\s+)*)([a-z]+)/g, (match, adverbs, verb, offset) => {
    const before = result.slice(Math.max(0, offset - 6), offset).toLowerCase();
    if (/\b(and|or)\s+$/.test(before)) {
      // Compound subject: replace I→name, keep verb base-form
      return name + ' ' + adverbs + verb;
    }
    return name + ' ' + adverbs + toThirdPerson(verb);
  });

  // 5. Remaining bare "I" not followed by a verb (edge cases)
  result = result.replace(/\bI\b/g, name);

  return result;
}

// ─── fixCompoundVerbs ─────────────────────────────────────────────────────────
// In reviewer mode, conjugate "and/or [verb]" in the remainder to match
// the 3rd-person subject already established.
// "follows through on plans and maintain good call discipline"
//   → "follows through on plans and maintains good call discipline"
// Skips proper nouns (Title-case), clear noun suffixes, and modals.
const NOUN_SUFFIX_RE = /(?:ders|ters|ners|bers|ers|ors|ees|ists|ings|ments|lines|bles|ples|ness|tion|sion|ity|ory|ary|ery)$/;

function fixCompoundVerbs(remainder, name) {
  return remainder.replace(
    /\b(and|or)\s+([A-Za-z]{2,})\b/g,
    (match, conj, v) => {
      const vl = v.toLowerCase();
      // Skip Title-case words — likely proper nouns (e.g. "and Sarah")
      if (v.charAt(0) !== v.charAt(0).toLowerCase()) return match;
      // Skip words that are clearly nouns/adjectives
      if (NOUN_SUFFIX_RE.test(vl)) return match;
      // Skip modals — they never inflect
      if (MODALS.has(vl)) return match;
      const conjugated = toThirdPerson(vl);
      // Only replace if conjugation actually changed something
      return conjugated !== vl ? conj + ' ' + conjugated : match;
    }
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * adaptStatement(text, mode, firstName)
 *
 * @param {string}            text       - Raw statement text from the DB
 * @param {'self'|'reviewer'} mode
 * @param {string}            firstName  - Employee first name (reviewer mode only)
 * @returns {string}                     - Display-ready grammatically correct sentence
 */
export function adaptStatement(text, mode, firstName) {
  if (!text) return text;

  const raw   = text.trim();
  const lower = raw.toLowerCase();
  const name  = (firstName || 'This person').trim();

  // Self helper: "I" + lowercase-first-char version of raw
  const selfPrefix = () => 'I ' + raw.charAt(0).toLowerCase() + raw.slice(1);

  // ── 1. "The entire team…" ──────────────────────────────────────────────────
  if (lower.startsWith('the entire team')) {
    const rest = raw.slice('The entire team'.length);
    if (mode === 'self') return 'My entire team' + rest;
    // Fix embedded "me" references: "(including me)" → "(including [Name])"
    return name + "'s entire team" + rest.replace(/\bme\b/g, name);
  }

  // ── 2. "Team communications…" ─────────────────────────────────────────────
  if (lower.startsWith('team communications')) {
    const rest = raw.slice('Team communications'.length);
    if (mode === 'self') return "My team's communications" + rest;
    return name + "'s team's communications" + rest;
  }

  // ── 3. "team …" (no article, lowercase or Title-case) ────────────────────
  // Covers: "team is empowered", "team and stakeholders are engaged",
  //         "team knows that I support them", "team and I work to…",
  //         "team advises me of issues immediately", etc.
  if (lower.startsWith('team ')) {
    const rest = raw.slice('team'.length); // keeps leading space
    if (mode === 'self') {
      return 'My team' + rest;
    }
    // Reviewer: replace embedded I/me/my in rest
    return name + "'s team" + fixReviewerBody(rest, name);
  }

  // ── 4. "As a team we …" ───────────────────────────────────────────────────
  if (lower.startsWith('as a team')) {
    if (mode === 'self') {
      // Capitalise and keep as-is — reads naturally in self-assessment
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    // Reviewer: strip "As a team we " → "[Name]'s team [verb+s] …"
    const afterWe = raw.replace(/^as a team\s+we\s+/i, '');
    const spIdx   = afterWe.indexOf(' ');
    const verb    = spIdx >= 0 ? afterWe.slice(0, spIdx) : afterWe;
    const rest    = spIdx >= 0 ? afterWe.slice(spIdx)    : '';
    return name + "'s team " + toThirdPerson(verb) + rest;
  }

  // ── 5. "am …" statements (implicit "I am") ────────────────────────────────
  // DB: "am willing to make tough decisions when needed"
  //     "am mindful about the words I use when I speak to others"
  if (lower.startsWith('am ')) {
    const rest = raw.slice(3); // everything after "am "
    if (mode === 'self') return 'I am ' + rest;
    // Reviewer: fix any embedded I/my/me inside the body
    return name + ' is ' + fixReviewerBody(rest, name);
  }

  // ── 6. "view myself…" ─────────────────────────────────────────────────────
  if (lower.startsWith('view myself')) {
    const rest = raw.slice('view myself'.length);
    if (mode === 'self') {
      return 'I view myself' + rest.replace(/\band am\b/gi, 'and am');
    }
    return name + ' views themselves' + rest.replace(/\band am\b/gi, 'and is');
  }

  // ── 7. "When decisions are taken, I ensure action steps are taken" ─────────
  if (lower.startsWith('when decisions are taken')) {
    if (mode === 'self') return 'When decisions are taken, I ensure action steps are taken';
    return 'When decisions are taken, ' + name + ' ensures action steps are taken';
  }

  // ── 8. "If I am not sure about something, then I make that clear" ──────────
  if (lower.startsWith('if i am not sure')) {
    if (mode === 'self') return 'If I am not sure about something, then I make that clear';
    return 'If ' + name + ' is not sure about something, then ' + name + ' makes that clear';
  }

  // ── 9. "don't avoid conflict, and we deal with it constructively" ──────────
  if (lower.startsWith("don't") || lower.startsWith("dont")) {
    if (mode === 'self') return "I don't avoid conflict, and we deal with it constructively";
    return name + " doesn't avoid conflict, and the team deals with it constructively";
  }

  // ── 10. All other infinitive-led statements (the large majority) ───────────
  // DB format: "trust my team and stakeholders"          → I trust my team…
  //            "ensure project information is shared…"   → I ensure project…
  //            "explain my decisions to the team…"       → I explain my decisions…
  //            "work with my team to proactively…"       → I work with my team…
  //            "consistently work within company…"       → I consistently work…
  //                                                         Sarah consistently works…

  if (mode === 'self') {
    // Prepend "I " with the verb lowercased
    return selfPrefix();
  }

  // Reviewer: find the first true verb (skip leading adverbs like "consistently")
  const words = raw.split(' ');
  let verbIdx = 0;
  while (verbIdx < words.length - 1 && NON_VERB_SUFFIX_RE.test(words[verbIdx].toLowerCase())) {
    verbIdx++;
  }

  // Build the reviewer sentence:
  // prefix = any leading adverbs (e.g. "consistently ")
  // verb   = the first real verb (conjugated)
  // rest   = everything after the verb
  const prefix    = verbIdx > 0 ? words.slice(0, verbIdx).join(' ') + ' ' : '';
  const firstVerb = words[verbIdx];
  const remainder = words.slice(verbIdx + 1).length > 0
    ? ' ' + words.slice(verbIdx + 1).join(' ')
    : '';

  const conjugated     = toThirdPerson(firstVerb);
  const fixedRemainder = fixCompoundVerbs(fixReviewerBody(remainder, name), name);

  return name + ' ' + prefix + conjugated + fixedRemainder;
}
