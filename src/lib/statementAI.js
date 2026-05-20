// ─── AI-Powered Statement Transformer ────────────────────────────────────────
//
// Uses the LLM API to intelligently rewrite PMO assessment statements for:
//   • "self"     — first-person self-assessment  ("I ensure…", "My team…")
//   • "reviewer" — third-person review           ("[Name] ensures…", "[Name]'s team…")
//
// Architecture:
//   1. Batched   — all statements for a section sent in ONE API call
//   2. Cached    — results stored in sessionStorage so navigation never re-calls
//   3. Fallback  — on API failure, falls back to rule-based adaptStatement()
//   4. Deduped   — identical (text, mode, name) combos share one cached result
//
// Setup:
//   Add to .env:
//     VITE_OPENAI_API_KEY=<your-genspark-api-key>
//     VITE_OPENAI_BASE_URL=https://www.genspark.ai/api/llm_proxy/v1
//
// Public API:
//   transformStatements(statements, mode, firstName)  → Promise<Map<id, text>>
//   useStatementTransforms(statements, mode, firstName) → { texts: Map, loading }
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { adaptStatement } from './statementTense';

// ─── Config ────────────────────────────────────────────────────────────────
const API_KEY  = import.meta.env.VITE_OPENAI_API_KEY  || '';
const BASE_URL = import.meta.env.VITE_OPENAI_BASE_URL || 'https://www.genspark.ai/api/llm_proxy/v1';
const MODEL    = 'gpt-5-mini';   // fast, cheap — perfect for grammar transforms
const CACHE_NS = 'stmtAI_v3_';  // v3: bumped to clear stale pre-fix cache entries

// Whether we have a plausibly-valid key (non-empty, 20+ chars)
// If false we skip the API call entirely and fall straight to rule-based
const API_ENABLED = API_KEY.length >= 20;

// ─── Session-level in-memory cache (Map: cacheKey → transformedText) ────────
// Also mirrored to sessionStorage so hot-reloads don't re-fetch
const _memCache = new Map();

// Track if we've confirmed the API key works in this session (null = untested)
// true = confirmed working, false = confirmed broken (skip all further calls)
let _apiKeyOk = null;

function cacheKey(id, mode, firstName) {
  return `${CACHE_NS}${mode}::${(firstName || '').toLowerCase()}::${id}`;
}

function loadFromSession(key) {
  try { return sessionStorage.getItem(key) || null; } catch { return null; }
}

function saveToSession(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* quota exceeded — ignore */ }
}

// ─── System prompt ─────────────────────────────────────────────────────────
function buildSystemPrompt() {
  return `You are a grammar transformation engine for a PMO (Project Management Office) 360° assessment tool.

Your job is to rewrite neutral assessment statements into grammatically correct first-person (self-assessment) or third-person (reviewer) forms.

RULES:
Self mode:
- If the statement starts with a verb (e.g. "Engages", "Ensures", "Delivers") → prepend "I" and keep the verb in base form: "I engage…", "I ensure…"
- If the statement starts with a noun/noun phrase (e.g. "The team", "Conflicts") → prepend "My" → "My team…" OR rewrite naturally: "In my team…"
- Replace any mid-sentence "this person" with "I" and adjust the verb
- Keep "The team…" statements that refer to team culture (e.g. "The team is empowered") as "My team is empowered…"
- "As a team" → "As a team, we…"
- "Views themselves" → "I view myself…"
- "Is comfortable" → "I am comfortable…"

Reviewer mode (employee name is provided):
- If the statement starts with a verb → use the employee name as subject and conjugate verb to third-person singular (add -s/-es): "[Name] engages…", "[Name] ensures…"
- If the statement starts with "The team" or "As a team" → prepend "[Name]'s": "[Name]'s team is empowered…" OR "As a team, [Name]'s group…" — choose whichever reads more naturally
- Replace "this person" with [Name]
- Replace "myself" with "themselves"
- "Views themselves" → "[Name] views themselves…"
- "Is comfortable" → "[Name] is comfortable…"
- Replace mid-sentence "my" with "[Name]'s"

CRITICAL:
- Return ONLY the rewritten statement text — no explanation, no numbering, no quotes
- Preserve the meaning exactly — do not add or remove information
- One rewritten statement per line, in the SAME ORDER as the input list
- Do not skip any statement`;
}

// ─── Build user message ────────────────────────────────────────────────────
function buildUserMessage(statements, mode, firstName) {
  const modeDesc = mode === 'self'
    ? 'SELF (first-person self-assessment)'
    : `REVIEWER (third-person — employee name: "${firstName || 'This person'}")`;

  const numbered = statements
    .map((s, i) => `${i + 1}. ${s.text}`)
    .join('\n');

  return `Transform the following ${statements.length} neutral PMO assessment statements to ${modeDesc} form.
Return exactly ${statements.length} lines — one rewritten statement per line, same order, no numbering, no extra text.

Neutral statements:
${numbered}`;
}

// ─── Core batch transform via API ─────────────────────────────────────────
async function batchTransformViaAPI(statements, mode, firstName) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: buildUserMessage(statements, mode, firstName) },
      ],
      temperature: 0.1,   // very low — we want consistent grammar, not creativity
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => 'unknown error');
    // Mark key as broken on auth errors so we stop retrying
    if (response.status === 401 || response.status === 403) {
      _apiKeyOk = false;
      console.warn('[statementAI] API key invalid/expired (401/403). Using rule-based fallback for this session.');
    }
    throw new Error(`API error ${response.status}: ${err}`);
  }

  // Mark key as working on first success
  _apiKeyOk = true;

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content || '';

  // Split on newlines, strip any accidental numbering like "1. " or "- "
  const lines = content
    .split('\n')
    .map(l => l.replace(/^\s*\d+\.\s+/, '').replace(/^\s*-\s+/, '').trim())
    .filter(l => l.length > 0);

  return lines;
}

// ─── Public: transform a batch of statements ──────────────────────────────
// Returns a Map<statementId → transformedText>
// Hits cache first; only calls API for uncached items.
// If API is disabled or confirmed broken, uses rule-based fallback.
export async function transformStatements(statements, mode, firstName) {
  if (!statements || statements.length === 0) return new Map();

  const result  = new Map();
  const toFetch = [];   // statements not yet in cache

  // ── 1. Cache check ──────────────────────────────────────────────────────
  for (const stmt of statements) {
    const key    = cacheKey(stmt.id, mode, firstName);
    const cached = _memCache.get(key) || loadFromSession(key);
    if (cached) {
      _memCache.set(key, cached);
      result.set(stmt.id, cached);
    } else {
      toFetch.push(stmt);
    }
  }

  if (toFetch.length === 0) return result;

  // ── 2. API call (if enabled and not confirmed broken) ───────────────────
  const shouldCallAPI = API_ENABLED && _apiKeyOk !== false;

  if (shouldCallAPI) {
    try {
      const lines = await batchTransformViaAPI(toFetch, mode, firstName);

      toFetch.forEach((stmt, i) => {
        // Fallback to rule-based for any missing lines
        const transformed = (lines[i] && lines[i].length > 0)
          ? lines[i]
          : adaptStatement(stmt.text, mode, firstName);
        const key = cacheKey(stmt.id, mode, firstName);
        _memCache.set(key, transformed);
        saveToSession(key, transformed);
        result.set(stmt.id, transformed);
      });

      return result;
    } catch (err) {
      console.warn('[statementAI] API call failed, falling back to rule-based adapter:', err.message);
      // Fall through to rule-based below
    }
  } else if (!API_ENABLED) {
    console.info('[statementAI] No API key configured — using rule-based transforms. Add VITE_OPENAI_API_KEY to .env to enable AI transforms.');
  }

  // ── 3. Rule-based fallback ──────────────────────────────────────────────
  for (const stmt of toFetch) {
    const fallback = adaptStatement(stmt.text, mode, firstName);
    const key      = cacheKey(stmt.id, mode, firstName);
    _memCache.set(key, fallback);
    saveToSession(key, fallback);
    result.set(stmt.id, fallback);
  }

  return result;
}

// ─── Public: transform assignment questions ────────────────────────────────
// Returns a Map<questionId → transformedText> (same shape as transformStatements)
export async function transformQuestions(questions, mode, firstName) {
  if (!questions || questions.length === 0) return new Map();
  const withIds = questions.map(q => ({ id: q.id || q.text.slice(0, 30), text: q.text }));
  return transformStatements(withIds, mode, firstName);
}

// ─── React hook: load transforms for a section's statements ───────────────
//
// Usage:
//   const { texts, loading } = useStatementTransforms(section.statements, 'self', '');
//   const { texts, loading } = useStatementTransforms(section.statements, 'reviewer', 'Sarah');
//
// texts   — Map<statementId → string>   (falls back to stmt.text if not ready)
// loading — true while async transform is in flight

export function useStatementTransforms(statements, mode, firstName) {
  const [texts,   setTexts]   = useState(() => {
    // Seed synchronously from cache to avoid a flash of empty text on re-mount
    const map = new Map();
    for (const stmt of (statements || [])) {
      const key = cacheKey(stmt.id, mode, firstName);
      const hit = _memCache.get(key) || loadFromSession(key);
      if (hit) { _memCache.set(key, hit); map.set(stmt.id, hit); }
    }
    return map;
  });

  const [loading, setLoading] = useState(false);

  // Track last-seen signature to skip re-fetches when nothing changed
  const sigRef = useRef('');

  useEffect(() => {
    if (!statements || statements.length === 0) return;

    // Signature: mode + name + ordered statement IDs
    const sig = `${mode}::${firstName}::${statements.map(s => s.id).join(',')}`;
    if (sigRef.current === sig) return;
    sigRef.current = sig;

    // ── Fast path: everything already cached ────────────────────────────
    const allCached = statements.every(s => {
      const key = cacheKey(s.id, mode, firstName);
      return _memCache.has(key) || loadFromSession(key) !== null;
    });

    if (allCached) {
      const map = new Map();
      for (const stmt of statements) {
        const key = cacheKey(stmt.id, mode, firstName);
        const val = _memCache.get(key) || loadFromSession(key);
        if (val) { _memCache.set(key, val); map.set(stmt.id, val); }
      }
      setTexts(map);
      return;
    }

    // ── Slow path: fetch missing transforms ─────────────────────────────
    setLoading(true);
    transformStatements(statements, mode, firstName).then(map => {
      // Guard against stale updates landing after a fresh sig
      if (sigRef.current !== sig) return;
      setTexts(map);
      setLoading(false);
    });
  }, [statements, mode, firstName]);

  return { texts, loading };
}
