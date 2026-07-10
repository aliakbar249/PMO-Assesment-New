// ─────────────────────────────────────────────────────────────────────────────
//  KPI Management & Training Targets — Data Layer
//  Uses localStorage (same pattern as db.js) so it works alongside Supabase
//  for the existing modules without touching any existing tables.
// ─────────────────────────────────────────────────────────────────────────────

const KPI_KEY      = 'optem_kpi_db';
const TRAIN_KEY    = 'optem_training_db';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

// ─── KPI SEED DATA ────────────────────────────────────────────────────────────

const SEED_KPI_ITEMS = [
  // Activity — higher is better for all except violations
  { id: 'kpi_act_01', name: 'Daily Calls per Rep',        category: 'activity',   targetValue: 9,   unit: 'count',  frequency: 'daily',     isMandatory: false, targetDirection: 'higher', linkedCompetency: '',                  archived: false, description: 'Average number of HCP calls made per working day' },
  { id: 'kpi_act_02', name: 'HCP Coverage %',             category: 'activity',   targetValue: 90,  unit: '%',      frequency: 'monthly',   isMandatory: false, targetDirection: 'higher', linkedCompetency: 'Customer Focus',    archived: false, description: 'Percentage of target HCPs contacted in the period' },
  { id: 'kpi_act_03', name: 'New HCP Visits per Month',   category: 'activity',   targetValue: 15,  unit: 'count',  frequency: 'monthly',   isMandatory: false, targetDirection: 'higher', linkedCompetency: '',                  archived: false, description: 'Number of first-time HCP visits in the month' },
  { id: 'kpi_act_04', name: 'Follow-up Call Rate',        category: 'activity',   targetValue: 70,  unit: '%',      frequency: 'monthly',   isMandatory: false, targetDirection: 'higher', linkedCompetency: 'Customer Focus',    archived: false, description: 'Percentage of calls that are follow-ups to prior visits' },
  // Output
  { id: 'kpi_out_01', name: 'Sales vs Quota Attainment', category: 'output',     targetValue: 100, unit: '%',      frequency: 'monthly',   isMandatory: false, targetDirection: 'higher', linkedCompetency: 'Selling Skills',    archived: false, description: 'Actual sales as a percentage of assigned quota' },
  { id: 'kpi_out_02', name: 'Rx Conversion Rate',        category: 'output',     targetValue: 65,  unit: '%',      frequency: 'monthly',   isMandatory: false, targetDirection: 'higher', linkedCompetency: 'Selling Skills',    archived: false, description: 'Percentage of detailing visits leading to a new prescription' },
  { id: 'kpi_out_03', name: 'Formulary Wins per Quarter', category: 'output',    targetValue: 3,   unit: 'count',  frequency: 'quarterly', isMandatory: false, targetDirection: 'higher', linkedCompetency: '',                  archived: false, description: 'Number of new formulary additions secured in the quarter' },
  // Engagement
  { id: 'kpi_eng_01', name: 'Call Quality Score',         category: 'engagement', targetValue: 4.0, unit: 'score',  frequency: 'monthly',   isMandatory: false, targetDirection: 'higher', linkedCompetency: 'Customer Focus',    archived: false, description: 'Average call quality rating out of 5 (manager-assessed)' },
  { id: 'kpi_eng_02', name: 'HCP Satisfaction NPS',      category: 'engagement', targetValue: 40,  unit: 'score',  frequency: 'quarterly', isMandatory: false, targetDirection: 'higher', linkedCompetency: 'Customer Focus',    archived: false, description: 'Net Promoter Score from HCP satisfaction surveys' },
  { id: 'kpi_eng_03', name: 'Digital Engagement Rate',   category: 'engagement', targetValue: 50,  unit: '%',      frequency: 'monthly',   isMandatory: false, targetDirection: 'higher', linkedCompetency: 'Digital Proficiency', archived: false, description: 'Percentage of HCPs engaged via digital channels' },
  // Compliance
  { id: 'kpi_cmp_01', name: 'Compliance Module Completion', category: 'compliance', targetValue: 100, unit: '%',   frequency: 'quarterly', isMandatory: true,  targetDirection: 'higher', linkedCompetency: 'Compliance & Ethics', archived: false, description: 'Mandatory compliance training modules completed' },
  { id: 'kpi_cmp_02', name: 'Promotional Code Violations', category: 'compliance', targetValue: 0,   unit: 'count', frequency: 'monthly',  isMandatory: true,  targetDirection: 'lower',  linkedCompetency: 'Compliance & Ethics', archived: false, description: 'Number of promotional code violations (target: zero)' },
  { id: 'kpi_cmp_03', name: 'Sample Accountability Rate', category: 'compliance', targetValue: 100, unit: '%',     frequency: 'monthly',  isMandatory: true,  targetDirection: 'higher', linkedCompetency: 'Compliance & Ethics', archived: false, description: 'Percentage of product samples correctly accounted for' },
];

const SEED_KPI_TEMPLATE = {
  id: 'tmpl_q2_2026',
  name: 'Standard MR KPI Set Q2 2026',
  description: 'Full quarterly KPI set for medical representatives covering all four performance categories.',
  intendedRole: 'Medical Representative',
  cycle: 'Q2 2026',
  period: { start: '2026-04-01', end: '2026-06-30' },
  createdBy: 'admin',
  createdAt: '2026-03-15T08:00:00Z',
  // kpiEntries: array of { kpiId, targetOverride } — overrides default target per template
  kpiEntries: SEED_KPI_ITEMS.map(k => ({ kpiId: k.id, targetOverride: null })),
  // legacy flat list kept for backwards-compat with buildScorecard
  kpiIds: SEED_KPI_ITEMS.map(k => k.id),
};

// Three demo employees (we use fixed IDs so the seed is deterministic)
const DEMO_EMP_IDS = ['demo_emp_alice', 'demo_emp_ben', 'demo_emp_carol'];

const SEED_ASSIGNMENTS = [
  { id: 'asgn_alice', templateId: 'tmpl_q2_2026', employeeId: 'demo_emp_alice', employeeName: 'Alice Fernandez', territory: 'North Region', team: 'Team A', period: 'Q2 2026', status: 'active' },
  { id: 'asgn_ben',   templateId: 'tmpl_q2_2026', employeeId: 'demo_emp_ben',   employeeName: 'Ben Okafor',      territory: 'West Region',  team: 'Team B', period: 'Q2 2026', status: 'active' },
  { id: 'asgn_carol', templateId: 'tmpl_q2_2026', employeeId: 'demo_emp_carol', employeeName: 'Carol Mendes',   territory: 'South Region', team: 'Team A', period: 'Q2 2026', status: 'active' },
];

// Actuals: Alice=high performer, Ben=mid, Carol=at-risk
const makeActuals = (assignmentId, empId, actuals) =>
  SEED_KPI_ITEMS.map((kpi, i) => ({
    id: `act_${empId}_${kpi.id}`,
    assignmentId,
    kpiItemId: kpi.id,
    actualValue: actuals[i],
    enteredBy: 'admin',
    enteredAt: '2026-06-01T09:00:00Z',
  }));

const ALICE_VALS = [9.2, 94, 18, 78, 102, 70, 4, 4.4, 52, 58, 100, 0, 100];
const BEN_VALS   = [7.5, 81, 11, 62, 78,  52, 2, 3.6, 35, 41, 100, 0, 98 ];
const CAROL_VALS = [5.8, 72,  7, 45, 48,  38, 1, 2.9, 18, 22, 85,  2, 79 ];

const SEED_ACTUALS = [
  ...makeActuals('asgn_alice', 'alice', ALICE_VALS),
  ...makeActuals('asgn_ben',   'ben',   BEN_VALS),
  ...makeActuals('asgn_carol', 'carol', CAROL_VALS),
];

// ─── TRAINING SEED DATA ───────────────────────────────────────────────────────

const SEED_MODULES = [
  {
    id: 'mod_prod_01',
    title: 'Cardio Product Line — Mechanism & Indications',
    category: 'product_knowledge',
    description: 'Deep-dive into the pharmacology, clinical data, and approved indications for the cardiovascular product portfolio. Covers MOA, dosing, contraindications, and competitive landscape.',
    format: 'e-learning',
    duration: 90,
    isMandatory: false,
    linkedKPIs: ['kpi_out_02', 'kpi_eng_01'],
    assessmentTrigger: { competency: 'Product Knowledge', thresholdScore: 3.0 },
    passingScore: 80,
  },
  {
    id: 'mod_cmp_01',
    title: 'Ethical Promotion & FDA Regulatory Compliance',
    category: 'compliance',
    description: 'Mandatory module covering OPDP regulations, PhRMA code requirements, sample management rules, and reporting obligations. Required for all field force personnel annually.',
    format: 'e-learning',
    duration: 120,
    isMandatory: true,
    linkedKPIs: ['kpi_cmp_01', 'kpi_cmp_02', 'kpi_cmp_03'],
    assessmentTrigger: { competency: 'Compliance & Ethics', thresholdScore: 3.5 },
    passingScore: 90,
  },
  {
    id: 'mod_dig_01',
    title: 'Digital Detailing & Remote Engagement Tools',
    category: 'digital_skills',
    description: 'Hands-on training for using the Veeva CRM digital detailing suite, remote engagement platforms (Zoom for HCP), and analytics dashboards. Covers best practices for virtual call excellence.',
    format: 'workshop',
    duration: 60,
    isMandatory: false,
    linkedKPIs: ['kpi_eng_03', 'kpi_act_04'],
    assessmentTrigger: { competency: 'Digital Proficiency', thresholdScore: 3.0 },
    passingScore: 75,
  },
  {
    id: 'mod_sal_01',
    title: 'Consultative Selling & Objection Handling',
    category: 'sales_skills',
    description: 'Advanced selling skills workshop covering the SPIN selling methodology, handling clinical and formulary objections, navigating multi-stakeholder environments, and closing techniques for HCP conversations.',
    format: 'workshop',
    duration: 180,
    isMandatory: false,
    linkedKPIs: ['kpi_out_01', 'kpi_out_02', 'kpi_act_02'],
    assessmentTrigger: { competency: 'Selling Skills', thresholdScore: 3.0 },
    passingScore: 75,
  },
];

// Training assignments: varied completion levels per demo employee
const SEED_TRAIN_ASSIGNMENTS = [
  // Alice — high performer: all nearly done
  { id: 'ta_alice_prod', moduleId: 'mod_prod_01', employeeId: 'demo_emp_alice', employeeName: 'Alice Fernandez', assignedBy: 'Admin', assignedDate: '2026-04-01', deadline: '2026-06-30', status: 'completed',   completionPct: 100 },
  { id: 'ta_alice_cmp',  moduleId: 'mod_cmp_01', employeeId: 'demo_emp_alice', employeeName: 'Alice Fernandez', assignedBy: 'Admin', assignedDate: '2026-04-01', deadline: '2026-05-15', status: 'completed',   completionPct: 100 },
  { id: 'ta_alice_dig',  moduleId: 'mod_dig_01', employeeId: 'demo_emp_alice', employeeName: 'Alice Fernandez', assignedBy: 'Admin', assignedDate: '2026-04-15', deadline: '2026-06-30', status: 'in_progress', completionPct: 75  },
  { id: 'ta_alice_sal',  moduleId: 'mod_sal_01', employeeId: 'demo_emp_alice', employeeName: 'Alice Fernandez', assignedBy: 'Admin', assignedDate: '2026-05-01', deadline: '2026-06-30', status: 'completed',   completionPct: 100 },
  // Ben — mid performer
  { id: 'ta_ben_prod',   moduleId: 'mod_prod_01', employeeId: 'demo_emp_ben', employeeName: 'Ben Okafor', assignedBy: 'Admin', assignedDate: '2026-04-01', deadline: '2026-06-30', status: 'completed',   completionPct: 100 },
  { id: 'ta_ben_cmp',    moduleId: 'mod_cmp_01', employeeId: 'demo_emp_ben', employeeName: 'Ben Okafor', assignedBy: 'Admin', assignedDate: '2026-04-01', deadline: '2026-05-15', status: 'completed',   completionPct: 100 },
  { id: 'ta_ben_dig',    moduleId: 'mod_dig_01', employeeId: 'demo_emp_ben', employeeName: 'Ben Okafor', assignedBy: 'Admin', assignedDate: '2026-04-15', deadline: '2026-06-30', status: 'in_progress', completionPct: 40  },
  { id: 'ta_ben_sal',    moduleId: 'mod_sal_01', employeeId: 'demo_emp_ben', employeeName: 'Ben Okafor', assignedBy: 'Admin', assignedDate: '2026-05-01', deadline: '2026-06-30', status: 'not_started', completionPct: 0   },
  // Carol — at-risk: overdue items
  { id: 'ta_carol_prod', moduleId: 'mod_prod_01', employeeId: 'demo_emp_carol', employeeName: 'Carol Mendes', assignedBy: 'Admin', assignedDate: '2026-04-01', deadline: '2026-05-30', status: 'overdue',     completionPct: 30  },
  { id: 'ta_carol_cmp',  moduleId: 'mod_cmp_01', employeeId: 'demo_emp_carol', employeeName: 'Carol Mendes', assignedBy: 'Admin', assignedDate: '2026-04-01', deadline: '2026-05-15', status: 'overdue',     completionPct: 60  },
  { id: 'ta_carol_dig',  moduleId: 'mod_dig_01', employeeId: 'demo_emp_carol', employeeName: 'Carol Mendes', assignedBy: 'Admin', assignedDate: '2026-04-15', deadline: '2026-06-30', status: 'not_started', completionPct: 0   },
  { id: 'ta_carol_sal',  moduleId: 'mod_sal_01', employeeId: 'demo_emp_carol', employeeName: 'Carol Mendes', assignedBy: 'Admin', assignedDate: '2026-05-01', deadline: '2026-06-30', status: 'not_started', completionPct: 0   },
];

// Carol has a low competency score (simulates assessment trigger)
const SEED_ASSESSMENT_SCORES = [
  { employeeId: 'demo_emp_carol', employeeName: 'Carol Mendes', scores: {
    'Product Knowledge': 2.4,
    'Selling Skills': 2.1,
    'Digital Proficiency': 2.7,
    'Compliance & Ethics': 3.8,
    'Customer Focus': 3.1,
  }},
  { employeeId: 'demo_emp_ben', employeeName: 'Ben Okafor', scores: {
    'Product Knowledge': 3.2,
    'Selling Skills': 2.8,
    'Digital Proficiency': 3.5,
    'Compliance & Ethics': 4.1,
    'Customer Focus': 3.8,
  }},
  { employeeId: 'demo_emp_alice', employeeName: 'Alice Fernandez', scores: {
    'Product Knowledge': 4.3,
    'Selling Skills': 4.1,
    'Digital Proficiency': 3.9,
    'Compliance & Ethics': 4.6,
    'Customer Focus': 4.4,
  }},
];

// ─── KPI Storage ─────────────────────────────────────────────────────────────

function loadKPI() {
  try {
    const raw = localStorage.getItem(KPI_KEY);
    if (!raw) {
      const initial = { items: SEED_KPI_ITEMS, templates: [SEED_KPI_TEMPLATE], assignments: SEED_ASSIGNMENTS, actuals: SEED_ACTUALS };
      localStorage.setItem(KPI_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    // Back-fill any missing fields on existing seed items (e.g. after upgrade)
    const items = (parsed.items || SEED_KPI_ITEMS).map(item => ({
      targetDirection: 'higher',
      linkedCompetency: '',
      archived: false,
      ...item,
    }));
    // Back-fill kpiEntries on existing templates
    const templates = (parsed.templates || [SEED_KPI_TEMPLATE]).map(t => ({
      description: '',
      intendedRole: '',
      kpiEntries: (t.kpiIds || []).map(id => ({ kpiId: id, targetOverride: null })),
      ...t,
    }));
    return {
      items,
      templates,
      assignments: parsed.assignments || SEED_ASSIGNMENTS,
      actuals:     parsed.actuals     || SEED_ACTUALS,
    };
  } catch { return { items: SEED_KPI_ITEMS, templates: [SEED_KPI_TEMPLATE], assignments: SEED_ASSIGNMENTS, actuals: SEED_ACTUALS }; }
}

function saveKPI(db) {
  try { localStorage.setItem(KPI_KEY, JSON.stringify(db)); } catch (e) { console.error(e); }
}

function mutateKPI(updater) {
  const db = loadKPI();
  const next = updater(db);
  saveKPI(next);
  return next;
}

// ─── Training Storage ─────────────────────────────────────────────────────────

function loadTraining() {
  try {
    const raw = localStorage.getItem(TRAIN_KEY);
    if (!raw) {
      const initial = { modules: SEED_MODULES, assignments: SEED_TRAIN_ASSIGNMENTS, assessmentScores: SEED_ASSESSMENT_SCORES };
      localStorage.setItem(TRAIN_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return {
      modules:          parsed.modules          || SEED_MODULES,
      assignments:      parsed.assignments      || SEED_TRAIN_ASSIGNMENTS,
      assessmentScores: parsed.assessmentScores || SEED_ASSESSMENT_SCORES,
    };
  } catch { return { modules: SEED_MODULES, assignments: SEED_TRAIN_ASSIGNMENTS, assessmentScores: SEED_ASSESSMENT_SCORES }; }
}

function saveTraining(db) {
  try { localStorage.setItem(TRAIN_KEY, JSON.stringify(db)); } catch (e) { console.error(e); }
}

function mutateTraining(updater) {
  const db = loadTraining();
  const next = updater(db);
  saveTraining(next);
  return next;
}

// ═════════════════════════════════════════════════════════════════════════════
//  KPI PUBLIC API
// ═════════════════════════════════════════════════════════════════════════════

// — KPI Items (library) ——————————————————————————————————————————————————————

/** All library items (including archived) */
export function getKPIItems() { return loadKPI().items; }

/** Only active (non-archived) items */
export function getActiveKPIItems() { return loadKPI().items.filter(i => !i.archived); }

/** Create or update a KPI in the library */
export function saveKPIItem(item) {
  mutateKPI(db => {
    const exists = db.items.find(i => i.id === item.id);
    return {
      ...db,
      items: exists
        ? db.items.map(i => i.id === item.id ? { ...i, ...item } : i)
        : [...db.items, { targetDirection: 'higher', linkedCompetency: '', archived: false, ...item, id: uid(), createdAt: new Date().toISOString() }],
    };
  });
}

/** Archive a KPI (soft-delete — hidden from new templates, preserved in history) */
export function archiveKPIItem(id) {
  mutateKPI(db => ({ ...db, items: db.items.map(i => i.id === id ? { ...i, archived: true } : i) }));
}

/** Restore an archived KPI back to active */
export function restoreKPIItem(id) {
  mutateKPI(db => ({ ...db, items: db.items.map(i => i.id === id ? { ...i, archived: false } : i) }));
}

/** Hard-delete — only used if the KPI has never been used in any template */
export function deleteKPIItem(id) {
  mutateKPI(db => ({ ...db, items: db.items.filter(i => i.id !== id) }));
}

/** Count how many templates use this KPI */
export function countKPIUsage(kpiId) {
  return loadKPI().templates.filter(t =>
    (t.kpiEntries || []).some(e => e.kpiId === kpiId) ||
    (t.kpiIds || []).includes(kpiId)
  ).length;
}

// — KPI Templates ————————————————————————————————————————————————————————————
export function getKPITemplates() { return loadKPI().templates; }

export function saveKPITemplate(tpl) {
  mutateKPI(db => {
    const exists = db.templates.find(t => t.id === tpl.id);
    // Always keep kpiIds in sync with kpiEntries for backwards compat
    const kpiIds = (tpl.kpiEntries || []).map(e => e.kpiId);
    const normalized = { ...tpl, kpiIds };
    const record = exists
      ? db.templates.map(t => t.id === tpl.id ? { ...t, ...normalized } : t)
      : [...db.templates, { description: '', intendedRole: '', ...normalized, id: uid(), createdAt: new Date().toISOString() }];
    return { ...db, templates: record };
  });
}

export function deleteKPITemplate(id) {
  mutateKPI(db => ({ ...db, templates: db.templates.filter(t => t.id !== id) }));
}

/**
 * Get the effective target for a KPI within a specific template.
 * Returns the per-template override if set, otherwise the library default.
 */
export function getEffectiveTarget(template, kpiId) {
  const entry = (template.kpiEntries || []).find(e => e.kpiId === kpiId);
  if (entry && entry.targetOverride !== null && entry.targetOverride !== undefined && entry.targetOverride !== '') {
    return parseFloat(entry.targetOverride);
  }
  const db = loadKPI();
  const item = db.items.find(i => i.id === kpiId);
  return item ? item.targetValue : 0;
}

// — KPI Assignments ——————————————————————————————————————————————————————————
export function getKPIAssignments() { return loadKPI().assignments; }

export function getKPIAssignmentsByEmployee(employeeId) {
  return loadKPI().assignments.filter(a => a.employeeId === employeeId);
}

export function saveKPIAssignment(asgn) {
  mutateKPI(db => {
    const exists = db.assignments.find(a => a.id === asgn.id);
    return {
      ...db,
      assignments: exists
        ? db.assignments.map(a => a.id === asgn.id ? { ...a, ...asgn } : a)
        : [...db.assignments, { ...asgn, id: uid() }],
    };
  });
}

export function deleteKPIAssignment(id) {
  mutateKPI(db => ({ ...db, assignments: db.assignments.filter(a => a.id !== id) }));
}

// — KPI Actuals ——————————————————————————————————————————————————————————————
export function getKPIActuals() { return loadKPI().actuals; }

export function getKPIActualsByAssignment(assignmentId) {
  return loadKPI().actuals.filter(a => a.assignmentId === assignmentId);
}

export function saveKPIActual(actual) {
  mutateKPI(db => {
    const exists = db.actuals.find(a => a.id === actual.id);
    const record = exists
      ? db.actuals.map(a => a.id === actual.id ? { ...a, ...actual, enteredAt: new Date().toISOString() } : a)
      : [...db.actuals, { ...actual, id: uid(), enteredAt: new Date().toISOString() }];
    return { ...db, actuals: record };
  });
}

// Bulk-save a map of kpiItemId → actualValue for an assignment
export function bulkSaveActuals(assignmentId, valueMap, enteredBy) {
  mutateKPI(db => {
    const updated = [...db.actuals];
    Object.entries(valueMap).forEach(([kpiItemId, actualValue]) => {
      const idx = updated.findIndex(a => a.assignmentId === assignmentId && a.kpiItemId === kpiItemId);
      const record = { id: idx >= 0 ? updated[idx].id : uid(), assignmentId, kpiItemId, actualValue: parseFloat(actualValue) || 0, enteredBy, enteredAt: new Date().toISOString() };
      if (idx >= 0) updated[idx] = record;
      else updated.push(record);
    });
    return { ...db, actuals: updated };
  });
}

// ─── Computed KPI helpers ────────────────────────────────────────────────────

export function computeAttainment(actual, target, isMandatory, unit) {
  if (target === 0) return actual === 0 ? 100 : actual > 0 ? 0 : 100; // violations KPI
  const pct = Math.round((actual / target) * 100);
  return Math.min(pct, 150); // cap at 150% to avoid distortion
}

export function kpiStatus(actual, target, isMandatory, unit) {
  // Special case: "violations" KPI where target is 0
  if (target === 0) {
    if (actual === 0) return 'on_track';
    return isMandatory ? 'mandatory_failed' : 'below_target';
  }
  const pct = (actual / target) * 100;
  if (isMandatory && pct < 100) return 'mandatory_failed';
  if (pct >= 90) return 'on_track';
  if (pct >= 70) return 'at_risk';
  return 'below_target';
}

// Build a full scorecard for one assignment
export function buildScorecard(assignment) {
  const db = loadKPI();
  const template = db.templates.find(t => t.id === assignment.templateId);
  if (!template) return null;

  // Support both old kpiIds and new kpiEntries
  const kpiIds  = template.kpiIds || (template.kpiEntries || []).map(e => e.kpiId);
  const items   = db.items.filter(i => kpiIds.includes(i.id));
  const actuals = db.actuals.filter(a => a.assignmentId === assignment.id);
  const actualMap = Object.fromEntries(actuals.map(a => [a.kpiItemId, a.actualValue]));

  const categories = ['activity', 'output', 'engagement', 'compliance'];
  const sections = categories.map(cat => {
    const catItems = items.filter(i => i.category === cat);
    const kpis = catItems.map(item => {
      const effectiveTarget = getEffectiveTarget(template, item.id);
      const actual = actualMap[item.id] ?? null;
      const attPct = actual !== null ? computeAttainment(actual, effectiveTarget, item.isMandatory, item.unit) : null;
      const status = actual !== null ? kpiStatus(actual, effectiveTarget, item.isMandatory, item.unit) : 'not_entered';
      return { ...item, effectiveTarget, actual, attainmentPct: attPct, status };
    });
    const entered = kpis.filter(k => k.actual !== null);
    const catAvg = entered.length ? Math.round(entered.reduce((s, k) => s + k.attainmentPct, 0) / entered.length) : null;
    return { category: cat, kpis, avg: catAvg };
  });

  const allEntered = sections.flatMap(s => s.kpis).filter(k => k.actual !== null);
  const overallAvg = allEntered.length
    ? Math.round(allEntered.reduce((s, k) => s + k.attainmentPct, 0) / allEntered.length)
    : null;

  // Recommended actions for below-target KPIs
  const actions = sections.flatMap(s => s.kpis)
    .filter(k => k.status === 'below_target' || k.status === 'mandatory_failed' || k.status === 'at_risk')
    .map(k => {
      if (k.status === 'mandatory_failed') return { kpi: k.name, level: 'critical', message: `${k.name} at ${k.actual}${k.unit === '%' ? '%' : ''} (target: ${k.effectiveTarget ?? k.targetValue}) — mandatory target not met. Immediate remediation required.` };
      if (k.status === 'below_target')     return { kpi: k.name, level: 'high',     message: `${k.name} at ${k.attainmentPct}% of target — schedule coaching session and review territory plan.` };
      return { kpi: k.name, level: 'medium', message: `${k.name} at ${k.attainmentPct}% of target — monitor closely and adjust call plan.` };
    });

  return { assignment, template, sections, overallAvg, actions };
}

// Build team-level summary (all assignments for the dashboard grid)
export function buildTeamSummary() {
  const db = loadKPI();
  return db.assignments.map(asgn => {
    const sc = buildScorecard(asgn);
    if (!sc) return { ...asgn, overallAvg: null, categoryAvgs: {} };
    const categoryAvgs = Object.fromEntries(sc.sections.map(s => [s.category, s.avg]));
    return { ...asgn, overallAvg: sc.overallAvg, categoryAvgs };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  TRAINING PUBLIC API
// ═════════════════════════════════════════════════════════════════════════════

// — Training Modules ——————————————————————————————————————————————————————————
export function getTrainingModules() { return loadTraining().modules; }

export function saveTrainingModule(mod) {
  mutateTraining(db => {
    const exists = db.modules.find(m => m.id === mod.id);
    return {
      ...db,
      modules: exists
        ? db.modules.map(m => m.id === mod.id ? { ...m, ...mod } : m)
        : [...db.modules, { ...mod, id: uid() }],
    };
  });
}

export function deleteTrainingModule(id) {
  mutateTraining(db => ({ ...db, modules: db.modules.filter(m => m.id !== id) }));
}

// — Training Assignments ——————————————————————————————————————————————————————
export function getTrainingAssignments() { return loadTraining().assignments; }

export function getTrainingAssignmentsByEmployee(employeeId) {
  return loadTraining().assignments.filter(a => a.employeeId === employeeId);
}

export function saveTrainingAssignment(asgn) {
  mutateTraining(db => {
    const exists = db.assignments.find(a => a.id === asgn.id);
    return {
      ...db,
      assignments: exists
        ? db.assignments.map(a => a.id === asgn.id ? { ...a, ...asgn } : a)
        : [...db.assignments, { ...asgn, id: uid() }],
    };
  });
}

export function deleteTrainingAssignment(id) {
  mutateTraining(db => ({ ...db, assignments: db.assignments.filter(a => a.id !== id) }));
}

export function updateTrainingProgress(id, completionPct, status) {
  mutateTraining(db => ({
    ...db,
    assignments: db.assignments.map(a => a.id === id
      ? { ...a, completionPct, status, ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}) }
      : a),
  }));
}

// — Assessment Scores ————————————————————————————————————————————————————————
export function getAssessmentScores() { return loadTraining().assessmentScores; }

export function getAssessmentScoresByEmployee(employeeId) {
  return loadTraining().assessmentScores.find(s => s.employeeId === employeeId) || null;
}

export function saveAssessmentScore(record) {
  mutateTraining(db => {
    const exists = db.assessmentScores.find(s => s.employeeId === record.employeeId);
    return {
      ...db,
      assessmentScores: exists
        ? db.assessmentScores.map(s => s.employeeId === record.employeeId ? { ...s, ...record } : s)
        : [...db.assessmentScores, record],
    };
  });
}

// — Integration: Assessment → Training recommendations ———————————————————————
export function getTrainingRecommendations(employeeId) {
  const scoreRecord = getAssessmentScoresByEmployee(employeeId);
  if (!scoreRecord) return [];
  const modules = getTrainingModules();
  const assignments = getTrainingAssignmentsByEmployee(employeeId);
  const assignedModuleIds = new Set(assignments.map(a => a.moduleId));

  const recommendations = [];
  modules.forEach(mod => {
    if (!mod.assessmentTrigger) return;
    const { competency, thresholdScore } = mod.assessmentTrigger;
    const score = scoreRecord.scores[competency];
    if (score !== undefined && score < thresholdScore) {
      recommendations.push({
        module: mod,
        competency,
        score,
        threshold: thresholdScore,
        alreadyAssigned: assignedModuleIds.has(mod.id),
      });
    }
  });
  return recommendations;
}

// — Integration: KPI → Training link —————————————————————————————————————————
export function getLinkedModulesForKPI(kpiItemId) {
  return getTrainingModules().filter(m => (m.linkedKPIs || []).includes(kpiItemId));
}

// — Team training summary (for manager tracker view) ————————————————————————
export function buildTrainingTeamSummary() {
  const db = loadTraining();
  // Group assignments by module
  const byModule = {};
  db.assignments.forEach(a => {
    if (!byModule[a.moduleId]) byModule[a.moduleId] = [];
    byModule[a.moduleId].push(a);
  });

  return db.modules.map(mod => {
    const asgns = byModule[mod.id] || [];
    const completed = asgns.filter(a => a.status === 'completed').length;
    const teamPct   = asgns.length ? Math.round((completed / asgns.length) * 100) : 0;
    const overdue   = asgns.filter(a => a.status === 'overdue').length;
    return { module: mod, assignments: asgns, teamCompletionPct: teamPct, overdueCount: overdue, totalAssigned: asgns.length };
  });
}

// — Constants (exported for UI use) ——————————————————————————————————————————
export const KPI_CATEGORY_LABELS = {
  activity:   'Activity',
  output:     'Output',
  engagement: 'Engagement',
  compliance: 'Compliance',
};

export const KPI_CATEGORY_COLORS = {
  activity:   { bg: 'bg-blue-50',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700',    bar: 'blue'    },
  output:     { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', bar: 'green' },
  engagement: { bg: 'bg-purple-50',  text: 'text-purple-700',  badge: 'bg-purple-100 text-purple-700',  bar: 'indigo' },
  compliance: { bg: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',    bar: 'amber'  },
};

export const STATUS_CONFIG = {
  on_track:        { label: 'On Track',        cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  at_risk:         { label: 'At Risk',         cls: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500'   },
  below_target:    { label: 'Below Target',    cls: 'bg-red-100 text-red-700',         dot: 'bg-red-500'     },
  mandatory_failed:{ label: 'Mandatory Failed',cls: 'bg-red-100 text-red-800 font-semibold', dot: 'bg-red-600' },
  not_entered:     { label: 'Not Entered',     cls: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-400'    },
};

export const TRAIN_STATUS_CONFIG = {
  completed:   { label: 'Completed',   cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500'   },
  not_started: { label: 'Not Started', cls: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400'    },
  overdue:     { label: 'Overdue',     cls: 'bg-red-100 text-red-700',         dot: 'bg-red-500'     },
};

export const TRAIN_CATEGORY_LABELS = {
  product_knowledge: 'Product Knowledge',
  compliance:        'Compliance',
  digital_skills:    'Digital Skills',
  sales_skills:      'Sales Skills',
  field_operations:  'Field Operations',
};

export const TRAIN_CATEGORY_COLORS = {
  product_knowledge: 'bg-blue-100 text-blue-700',
  compliance:        'bg-amber-100 text-amber-700',
  digital_skills:    'bg-purple-100 text-purple-700',
  sales_skills:      'bg-emerald-100 text-emerald-700',
  field_operations:  'bg-orange-100 text-orange-700',
};

export const FORMAT_LABELS = {
  'e-learning': 'E-Learning',
  workshop:     'Workshop',
  'on-the-job': 'On-the-Job',
};

export const KPI_UNIT_LABELS = {
  '%':        'Percentage (%)',
  count:      'Count',
  score:      'Score',
  ratio:      'Ratio',
  currency:   'Currency',
};

export const KPI_FREQUENCY_LABELS = {
  daily:     'Daily',
  weekly:    'Weekly',
  monthly:   'Monthly',
  quarterly: 'Quarterly',
};

export const ASSESSMENT_COMPETENCIES = [
  'Product Knowledge',
  'Selling Skills',
  'Digital Proficiency',
  'Compliance & Ethics',
  'Customer Focus',
  'Field Operations',
  'Communication',
  'Teamwork',
];

export const INTENDED_ROLES = [
  'Medical Representative',
  'Senior Medical Representative',
  'Area Manager',
  'Regional Manager',
  'Key Account Manager',
  'All Levels',
];
