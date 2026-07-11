// ─────────────────────────────────────────────────────────────────────────────
//  OPTEM ACUITY — Dynamic Org & Employee Configuration Data Layer
//  Position-based model: reporting chain ALWAYS derived at runtime from position tree.
//  All data stored in localStorage. Follows same mutate pattern as kpiTraining.js
// ─────────────────────────────────────────────────────────────────────────────

const ORG_KEY = 'optem_org_db';

// ─── uid helper ──────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function toSnakeCase(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
//  SEED DATA
// ─────────────────────────────────────────────────────────────────────────────

const SEED_HIERARCHY_LEVELS = [
  { id: 'lvl_nsm', name: 'National Sales Manager', abbreviation: 'NSM', rank: 1, canBeAssessed: true,  canBeReviewer: true,  hasPlatformAccess: true, accessRole: 'admin',    colorTag: '#7C3AED', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lvl_zm',  name: 'Zonal Manager',           abbreviation: 'ZM',  rank: 2, canBeAssessed: true,  canBeReviewer: true,  hasPlatformAccess: true, accessRole: 'admin',    colorTag: '#0891B2', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lvl_rsm', name: 'Regional Sales Manager',  abbreviation: 'RSM', rank: 3, canBeAssessed: true,  canBeReviewer: true,  hasPlatformAccess: true, accessRole: 'manager',  colorTag: '#059669', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lvl_asm', name: 'Area Sales Manager',      abbreviation: 'ASM', rank: 4, canBeAssessed: true,  canBeReviewer: true,  hasPlatformAccess: true, accessRole: 'manager',  colorTag: '#D97706', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lvl_smr', name: 'Senior Medical Rep',      abbreviation: 'SMR', rank: 5, canBeAssessed: true,  canBeReviewer: false, hasPlatformAccess: true, accessRole: 'employee', colorTag: '#DC2626', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lvl_mr',  name: 'Medical Representative',  abbreviation: 'MR',  rank: 6, canBeAssessed: true,  canBeReviewer: false, hasPlatformAccess: true, accessRole: 'employee', colorTag: '#6B7280', createdAt: '2026-01-01T00:00:00Z' },
];

// ─── OrgUnit seed ────────────────────────────────────────────────────────────
const SEED_ORG_UNITS = [
  { id: 'ou_pak',       name: 'Pakistan',          unitType: 'Division',   parentOrgUnitId: null,       unitCode: 'PAK',     createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'ou_north',     name: 'North Zone',         unitType: 'Zone',       parentOrgUnitId: 'ou_pak',   unitCode: 'N-ZONE',  createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'ou_lhr',       name: 'Lahore Region',      unitType: 'Region',     parentOrgUnitId: 'ou_north', unitCode: 'LHR',     createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'ou_glb',       name: 'Gulberg Area',       unitType: 'Area',       parentOrgUnitId: 'ou_lhr',   unitCode: 'GLB',     createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'ou_dha',       name: 'DHA Area',           unitType: 'Area',       parentOrgUnitId: 'ou_lhr',   unitCode: 'DHA',     createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'ou_lhr001',    name: 'LHR-001 Territory',  unitType: 'Territory',  parentOrgUnitId: 'ou_glb',   unitCode: 'LHR-001', createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'ou_lhr002',    name: 'LHR-002 Territory',  unitType: 'Territory',  parentOrgUnitId: 'ou_glb',   unitCode: 'LHR-002', createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'ou_lhr003',    name: 'LHR-003 Territory',  unitType: 'Territory',  parentOrgUnitId: 'ou_dha',   unitCode: 'LHR-003', createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'ou_south',     name: 'South Zone',         unitType: 'Zone',       parentOrgUnitId: 'ou_pak',   unitCode: 'S-ZONE',  createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'ou_khi',       name: 'Karachi Region',     unitType: 'Region',     parentOrgUnitId: 'ou_south', unitCode: 'KHI',     createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
];

// ─── Position seed ────────────────────────────────────────────────────────────
const SEED_POSITIONS = [
  { id: 'pos_nsm001',    positionCode: 'NSM-001',      title: 'NSM Pakistan',  hierarchyLevelId: 'lvl_nsm', parentPositionId: null,         orgUnitId: 'ou_pak',   division: 'Primary Care', isActive: true, createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'pos_zm001',     positionCode: 'ZM-001',       title: 'ZM North',      hierarchyLevelId: 'lvl_zm',  parentPositionId: 'pos_nsm001', orgUnitId: 'ou_north', division: 'Primary Care', isActive: true, createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'pos_rsmlhr01',  positionCode: 'RSM-LHR-01',   title: 'RSM Lahore',    hierarchyLevelId: 'lvl_rsm', parentPositionId: 'pos_zm001',  orgUnitId: 'ou_lhr',   division: 'Primary Care', isActive: true, createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'pos_asmglb01',  positionCode: 'ASM-GLB-01',   title: 'ASM Gulberg',   hierarchyLevelId: 'lvl_asm', parentPositionId: 'pos_rsmlhr01', orgUnitId: 'ou_glb',  division: 'Primary Care', isActive: true, createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'pos_asmdha01',  positionCode: 'ASM-DHA-01',   title: 'ASM DHA',       hierarchyLevelId: 'lvl_asm', parentPositionId: 'pos_rsmlhr01', orgUnitId: 'ou_dha',  division: 'Oncology',     isActive: true, createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'pos_mrlhr001',  positionCode: 'MR-LHR-001',   title: 'MR LHR-001',    hierarchyLevelId: 'lvl_mr',  parentPositionId: 'pos_asmglb01', orgUnitId: 'ou_lhr001', division: 'Primary Care', isActive: true, createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'pos_mrlhr002',  positionCode: 'MR-LHR-002',   title: 'MR LHR-002',    hierarchyLevelId: 'lvl_mr',  parentPositionId: 'pos_asmglb01', orgUnitId: 'ou_lhr002', division: 'Primary Care', isActive: true, createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
  { id: 'pos_mrlhr003',  positionCode: 'MR-LHR-003',   title: 'MR LHR-003',    hierarchyLevelId: 'lvl_mr',  parentPositionId: 'pos_asmdha01', orgUnitId: 'ou_lhr003', division: 'Oncology',     isActive: true, createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin' },
];

// ─── PositionOccupancy seed — empty; assigned by admin via Position Occupancy page ──
const SEED_OCCUPANCIES = [];

// ─── Employees — intentionally empty; all employees are created by admins ──────
const SEED_ORG_EMPLOYEES = [];

// ─── Reporting Lines (legacy — kept for backward compatibility, superseded by position model) ───
const SEED_REPORTING_LINES = [];

// ─── Custom Field Definitions ─────────────────────────────────────────────────
const SEED_CUSTOM_FIELDS = [
  // Section: Role & Designation
  { id: 'cf_grade',     label: 'Grade / Band',              fieldKey: 'grade_band',          fieldType: 'dropdown_single', options: ['MR-1','MR-2','Senior MR','ASM','RSM','ZM','NSM'],                             section: 'Role & Designation',   displayOrder: 1, isRequired: false, isFilterable: true,  isVisibleToEmployee: true,  appliesToLevels: [], status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cf_yoe',       label: 'Years of Field Experience', fieldKey: 'years_field_exp',     fieldType: 'number',          options: [],                                                                             section: 'Role & Designation',   displayOrder: 2, isRequired: false, isFilterable: false, isVisibleToEmployee: true,  appliesToLevels: [], status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cf_emptype',   label: 'Employment Type',           fieldKey: 'employment_type',     fieldType: 'dropdown_single', options: ['Permanent','Contract','Probation'],                                           section: 'Role & Designation',   displayOrder: 3, isRequired: false, isFilterable: true,  isVisibleToEmployee: true,  appliesToLevels: [], status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  // Section: Territory & Coverage (Region/Zone/Territory now derived from occupancy; keep territory code + size)
  { id: 'cf_terr_code', label: 'Territory Code',            fieldKey: 'territory_code',      fieldType: 'text',            options: [],                                                                             section: 'Territory & Coverage', displayOrder: 1, isRequired: false, isFilterable: true,  isVisibleToEmployee: true,  appliesToLevels: [], status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cf_terr_size', label: 'Territory Size (sq km)',    fieldKey: 'territory_size_sqkm', fieldType: 'number',          options: [],                                                                             section: 'Territory & Coverage', displayOrder: 2, isRequired: false, isFilterable: false, isVisibleToEmployee: true,  appliesToLevels: [], status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  // Section: Product Portfolio
  { id: 'cf_division',  label: 'Division',                  fieldKey: 'division',            fieldType: 'dropdown_single', options: ['Primary Care','Oncology','Vaccines','CNS','Cardiology','Respiratory'],       section: 'Product Portfolio',    displayOrder: 1, isRequired: false, isFilterable: true,  isVisibleToEmployee: true,  appliesToLevels: [], status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cf_ta',        label: 'Therapeutic Area',          fieldKey: 'therapeutic_area',    fieldType: 'dropdown_multi',  options: ['Primary Care','Oncology','Vaccines','CNS','Cardiology','Respiratory'],       section: 'Product Portfolio',    displayOrder: 2, isRequired: false, isFilterable: true,  isVisibleToEmployee: true,  appliesToLevels: [], status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cf_products',  label: 'Products Carried',          fieldKey: 'products_carried',    fieldType: 'dropdown_multi',  options: ['CardioMax','OncoPrime','VacciShield','NeuroCalm','RespirEase','ImmuBoost'],  section: 'Product Portfolio',    displayOrder: 3, isRequired: false, isFilterable: true,  isVisibleToEmployee: true,  appliesToLevels: [], status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cf_vehicle',   label: 'Has Company Vehicle',       fieldKey: 'has_company_vehicle', fieldType: 'toggle',          options: [],                                                                             section: 'Product Portfolio',    displayOrder: 4, isRequired: false, isFilterable: false, isVisibleToEmployee: true,  appliesToLevels: [], status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  // Section: Compensation & Grade
  { id: 'cf_comp_band', label: 'Compensation Band',         fieldKey: 'compensation_band',   fieldType: 'dropdown_single', options: ['Band A','Band B','Band C','Band D'],                                         section: 'Compensation & Grade', displayOrder: 1, isRequired: false, isFilterable: true,  isVisibleToEmployee: false, appliesToLevels: [], status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cf_incentive', label: 'Incentive Plan',            fieldKey: 'incentive_plan',      fieldType: 'dropdown_single', options: ['Standard','Accelerated','KAM Plan'],                                         section: 'Compensation & Grade', displayOrder: 2, isRequired: false, isFilterable: false, isVisibleToEmployee: false, appliesToLevels: [], status: 'active', createdAt: '2026-01-01T00:00:00Z' },
];

// ─── Custom field values — empty; populated by admin when editing employee profiles ──
const SEED_CUSTOM_FIELD_VALUES = [];

// ─── Auto-Assignment Rules seed ───────────────────────────────────────────────
const SEED_AUTO_RULES = [
  {
    id: 'rule_01',
    name: 'MR — Standard Compliance Training',
    trigger: 'position_filled',
    conditions: [{ field: 'hierarchyLevel', operator: 'equals', value: 'lvl_mr' }],
    actions: [{ type: 'assign_training_module', entityId: 'mod_cmp_01' }],
    priority: 10,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'admin',
  },
  {
    id: 'rule_02',
    name: 'Oncology Division — Product Training',
    trigger: 'field_updated',
    conditions: [{ field: 'cf_division', operator: 'equals', value: 'Oncology' }],
    actions: [{ type: 'assign_training_module', entityId: 'mod_prod_01' }],
    priority: 5,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'admin',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  STORAGE LAYER
// ─────────────────────────────────────────────────────────────────────────────

function loadOrg() {
  try {
    const raw = localStorage.getItem(ORG_KEY);
    if (!raw) {
      const initial = {
        hierarchyLevels:   SEED_HIERARCHY_LEVELS,
        orgEmployees:      [],
        reportingLines:    SEED_REPORTING_LINES,
        orgUnits:          SEED_ORG_UNITS,
        positions:         SEED_POSITIONS,
        occupancies:       [],
        customFields:      SEED_CUSTOM_FIELDS,
        customFieldValues: [],
        autoRules:         SEED_AUTO_RULES,
        autoRuleLogs:      [],
      };
      localStorage.setItem(ORG_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    // Backfill pattern — new tables get seeded if missing
    return {
      hierarchyLevels:   parsed.hierarchyLevels   || SEED_HIERARCHY_LEVELS,
      orgEmployees:      parsed.orgEmployees       || [],
      reportingLines:    parsed.reportingLines     || SEED_REPORTING_LINES,
      orgUnits:          parsed.orgUnits           || SEED_ORG_UNITS,
      positions:         parsed.positions          || SEED_POSITIONS,
      occupancies:       parsed.occupancies        || SEED_OCCUPANCIES,
      customFields:      parsed.customFields       || SEED_CUSTOM_FIELDS,
      customFieldValues: parsed.customFieldValues  || [],
      autoRules:         parsed.autoRules          || SEED_AUTO_RULES,
      autoRuleLogs:      parsed.autoRuleLogs       || [],
    };
  } catch {
    return {
      hierarchyLevels: SEED_HIERARCHY_LEVELS, orgEmployees: [],
      reportingLines: SEED_REPORTING_LINES, orgUnits: SEED_ORG_UNITS,
      positions: SEED_POSITIONS, occupancies: SEED_OCCUPANCIES,
      customFields: SEED_CUSTOM_FIELDS, customFieldValues: [],
      autoRules: SEED_AUTO_RULES, autoRuleLogs: [],
    };
  }
}

function saveOrg(db) {
  try { localStorage.setItem(ORG_KEY, JSON.stringify(db)); } catch (e) { console.error(e); }
}

function mutateOrg(updater) {
  const db = loadOrg();
  const next = updater(db);
  saveOrg(next);
  return next;
}

// ═════════════════════════════════════════════════════════════════════════════
//  HIERARCHY LEVELS API
// ═════════════════════════════════════════════════════════════════════════════

export function getHierarchyLevels() {
  return [...loadOrg().hierarchyLevels].sort((a, b) => a.rank - b.rank);
}

export function getHierarchyLevelById(id) {
  return loadOrg().hierarchyLevels.find(l => l.id === id) || null;
}

export function saveHierarchyLevel(level) {
  mutateOrg(db => {
    const exists = db.hierarchyLevels.find(l => l.id === level.id);
    return {
      ...db,
      hierarchyLevels: exists
        ? db.hierarchyLevels.map(l => l.id === level.id ? { ...l, ...level } : l)
        : [...db.hierarchyLevels, { ...level, id: uid(), createdAt: new Date().toISOString() }],
    };
  });
}

export function reorderHierarchyLevels(orderedIds) {
  mutateOrg(db => ({
    ...db,
    hierarchyLevels: db.hierarchyLevels.map(l => ({
      ...l,
      rank: orderedIds.indexOf(l.id) + 1,
    })),
  }));
}

/** Updated: checks positions (not orgEmployees) */
export function deleteHierarchyLevel(id) {
  const db = loadOrg();
  const inUse = db.positions.some(p => p.hierarchyLevelId === id && p.isActive);
  if (inUse) throw new Error('Cannot delete: active positions are assigned to this level.');
  mutateOrg(db => ({ ...db, hierarchyLevels: db.hierarchyLevels.filter(l => l.id !== id) }));
}

/** Updated: counts positions at this level */
export function countEmployeesAtLevel(levelId) {
  const db = loadOrg();
  // Count employees whose PRIMARY position has this levelId
  const positionsAtLevel = db.positions.filter(p => p.hierarchyLevelId === levelId && p.isActive).map(p => p.id);
  const today = new Date().toISOString().split('T')[0];
  const occupantIds = new Set(
    db.occupancies
      .filter(o => positionsAtLevel.includes(o.positionId) && o.occupancyType === 'primary' && !o.effectiveTo)
      .map(o => o.employeeId)
  );
  return occupantIds.size;
}

// ═════════════════════════════════════════════════════════════════════════════
//  ORG EMPLOYEES API
// ═════════════════════════════════════════════════════════════════════════════

export function getOrgEmployees() { return loadOrg().orgEmployees; }

export function getOrgEmployeeById(id) { return loadOrg().orgEmployees.find(e => e.id === id) || null; }

export function saveOrgEmployee(emp) {
  mutateOrg(db => {
    const exists = db.orgEmployees.find(e => e.id === emp.id);
    const record = exists
      ? db.orgEmployees.map(e => e.id === emp.id ? { ...e, ...emp } : e)
      : [...db.orgEmployees, { ...emp, id: uid(), status: 'active' }];
    return { ...db, orgEmployees: record };
  });
}

export function deleteOrgEmployee(id) {
  mutateOrg(db => ({
    ...db,
    orgEmployees:      db.orgEmployees.filter(e => e.id !== id),
    reportingLines:    db.reportingLines.filter(r => r.employeeId !== id && r.reportsToEmployeeId !== id),
    occupancies:       db.occupancies.filter(o => o.employeeId !== id),
    customFieldValues: db.customFieldValues.filter(v => v.employeeId !== id),
  }));
}

// ═════════════════════════════════════════════════════════════════════════════
//  REPORTING LINES API (legacy — kept for backward compatibility)
// ═════════════════════════════════════════════════════════════════════════════

export function getReportingLines() { return loadOrg().reportingLines; }
export function getActiveReportingLines() { return loadOrg().reportingLines.filter(r => !r.effectiveTo); }
export function getReportingLinesByEmployee(employeeId) {
  return loadOrg().reportingLines.filter(r => r.employeeId === employeeId && !r.effectiveTo);
}
export function getDirectReports(managerId) {
  return loadOrg().reportingLines.filter(r => r.reportsToEmployeeId === managerId && !r.effectiveTo && r.relationshipType === 'primary');
}
export function getAllReportingLines() { return loadOrg().reportingLines; }
export function saveReportingLine(line) {
  mutateOrg(db => {
    const exists = db.reportingLines.find(r => r.id === line.id);
    return {
      ...db,
      reportingLines: exists
        ? db.reportingLines.map(r => r.id === line.id ? { ...r, ...line } : r)
        : [...db.reportingLines, { ...line, id: uid(), createdAt: new Date().toISOString() }],
    };
  });
}
export function endDateReportingLine(id) {
  mutateOrg(db => ({
    ...db,
    reportingLines: db.reportingLines.map(r =>
      r.id === id ? { ...r, effectiveTo: new Date().toISOString().split('T')[0] } : r
    ),
  }));
}

// ═════════════════════════════════════════════════════════════════════════════
//  ORG UNIT API
// ═════════════════════════════════════════════════════════════════════════════

export function getOrgUnits() { return loadOrg().orgUnits; }

export function getOrgUnitById(id) { return loadOrg().orgUnits.find(u => u.id === id) || null; }

export function saveOrgUnit(unit) {
  mutateOrg(db => {
    const exists = db.orgUnits.find(u => u.id === unit.id);
    return {
      ...db,
      orgUnits: exists
        ? db.orgUnits.map(u => u.id === unit.id ? { ...u, ...unit } : u)
        : [...db.orgUnits, { ...unit, id: uid(), createdAt: new Date().toISOString() }],
    };
  });
}

export function deleteOrgUnit(id) {
  const db = loadOrg();
  const hasChildren = db.orgUnits.some(u => u.parentOrgUnitId === id);
  if (hasChildren) throw new Error('Cannot delete: this unit has child units.');
  const hasPositions = db.positions.some(p => p.orgUnitId === id && p.isActive);
  if (hasPositions) throw new Error('Cannot delete: active positions reference this org unit.');
  mutateOrg(db => ({ ...db, orgUnits: db.orgUnits.filter(u => u.id !== id) }));
}

/** Returns array of units as tree nodes: each node gets a `children` array */
export function getOrgUnitTree() {
  const units = loadOrg().orgUnits;
  const map = {};
  units.forEach(u => { map[u.id] = { ...u, children: [] }; });
  const roots = [];
  units.forEach(u => {
    if (u.parentOrgUnitId && map[u.parentOrgUnitId]) {
      map[u.parentOrgUnitId].children.push(map[u.id]);
    } else {
      roots.push(map[u.id]);
    }
  });
  return roots;
}

/** Returns ordered array of ancestor org units from current up to root */
export function getOrgUnitAncestors(id) {
  const units = loadOrg().orgUnits;
  const ancestors = [];
  const visited = new Set();
  let current = id;
  while (current) {
    if (visited.has(current)) break;
    visited.add(current);
    const unit = units.find(u => u.id === current);
    if (!unit) break;
    ancestors.unshift(unit);
    current = unit.parentOrgUnitId;
  }
  return ancestors;
}

// ═════════════════════════════════════════════════════════════════════════════
//  POSITION API
// ═════════════════════════════════════════════════════════════════════════════

export function getPositions() { return loadOrg().positions; }

export function getActivePositions() { return loadOrg().positions.filter(p => p.isActive); }

export function getPositionById(id) { return loadOrg().positions.find(p => p.id === id) || null; }

export function getPositionByCode(code) { return loadOrg().positions.find(p => p.positionCode === code) || null; }

export function savePosition(position) {
  mutateOrg(db => {
    const exists = db.positions.find(p => p.id === position.id);
    return {
      ...db,
      positions: exists
        ? db.positions.map(p => p.id === position.id ? { ...p, ...position } : p)
        : [...db.positions, { ...position, id: uid(), isActive: true, createdAt: new Date().toISOString() }],
    };
  });
}

export function deactivatePosition(id) {
  mutateOrg(db => ({
    ...db,
    positions: db.positions.map(p => p.id === id ? { ...p, isActive: false } : p),
  }));
}

/** Positions with no current primary occupant */
export function getVacantPositions() {
  const db = loadOrg();
  const activePositions = db.positions.filter(p => p.isActive);
  const filledIds = new Set(
    db.occupancies
      .filter(o => o.occupancyType === 'primary' && !o.effectiveTo)
      .map(o => o.positionId)
  );
  return activePositions.filter(p => !filledIds.has(p.id));
}

export function getChildPositions(positionId) {
  return loadOrg().positions.filter(p => p.parentPositionId === positionId && p.isActive);
}

export function getAllDescendantPositions(positionId) {
  const db = loadOrg();
  const result = [];
  const queue = [positionId];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    const children = db.positions.filter(p => p.parentPositionId === current && p.isActive);
    children.forEach(p => {
      result.push(p);
      queue.push(p.id);
    });
  }
  return result;
}

/** Bulk import positions from parsed CSV rows */
export function bulkImportPositions(rows) {
  // rows: [{ position_code, title, hierarchy_level_name, parent_position_code, org_unit_name, division }]
  const db = loadOrg();
  const results = { created: 0, failed: [], skipped: 0 };

  const levelByName = {};
  db.hierarchyLevels.forEach(l => { levelByName[l.name.toLowerCase()] = l.id; });
  const positionByCode = {};
  db.positions.forEach(p => { positionByCode[p.positionCode] = p.id; });
  const unitByName = {};
  db.orgUnits.forEach(u => { unitByName[u.name.toLowerCase()] = u.id; });

  const newPositions = [...db.positions];

  rows.forEach((row, idx) => {
    const { position_code, title, hierarchy_level_name, parent_position_code, org_unit_name, division } = row;
    if (!position_code || !title || !hierarchy_level_name) {
      results.failed.push({ row: idx + 1, reason: 'Missing required fields: position_code, title, hierarchy_level_name' });
      return;
    }
    const levelId = levelByName[String(hierarchy_level_name).toLowerCase()];
    if (!levelId) {
      results.failed.push({ row: idx + 1, reason: `Hierarchy level not found: "${hierarchy_level_name}"` });
      return;
    }
    if (positionByCode[position_code]) {
      results.skipped++;
      return;
    }
    const parentPositionId = parent_position_code ? (positionByCode[parent_position_code] || null) : null;
    const orgUnitId = org_unit_name ? (unitByName[String(org_unit_name).toLowerCase()] || null) : null;
    const newPos = {
      id: uid(), positionCode: position_code, title, hierarchyLevelId: levelId,
      parentPositionId, orgUnitId, division: division || '', isActive: true,
      createdAt: new Date().toISOString(), createdBy: 'admin',
    };
    newPositions.push(newPos);
    positionByCode[position_code] = newPos.id;
    results.created++;
  });

  mutateOrg(db => ({ ...db, positions: newPositions }));
  return results;
}

// ═════════════════════════════════════════════════════════════════════════════
//  POSITION OCCUPANCY API
// ═════════════════════════════════════════════════════════════════════════════

export function getOccupancies() { return loadOrg().occupancies; }

export function getActiveOccupancies() {
  return loadOrg().occupancies.filter(o => !o.effectiveTo);
}

export function getOccupanciesByPosition(positionId) {
  return loadOrg().occupancies.filter(o => o.positionId === positionId);
}

export function getOccupanciesByEmployee(employeeId) {
  return loadOrg().occupancies.filter(o => o.employeeId === employeeId);
}

/** Returns employeeId of current primary occupant, or null if vacant */
export function getCurrentPrimaryOccupant(positionId) {
  const occ = loadOrg().occupancies.find(
    o => o.positionId === positionId && o.occupancyType === 'primary' && !o.effectiveTo
  );
  return occ ? occ.employeeId : null;
}

/** Returns the position object for employee's current primary occupancy, or null */
export function getEmployeePrimaryPosition(employeeId) {
  const db = loadOrg();
  const occ = db.occupancies.find(
    o => o.employeeId === employeeId && o.occupancyType === 'primary' && !o.effectiveTo
  );
  if (!occ) return null;
  return db.positions.find(p => p.id === occ.positionId) || null;
}

/**
 * Save an occupancy record.
 * If occupancyType === 'primary', auto-end-date any existing primary occupancy
 * for the same position before inserting the new one.
 */
export function saveOccupancy(occupancy) {
  const isNew       = !occupancy.id || !loadOrg().occupancies.find(o => o.id === occupancy.id);
  const isNewPrimary = isNew && occupancy.occupancyType === 'primary';

  mutateOrg(db => {
    const exists = db.occupancies.find(o => o.id === occupancy.id);
    let occupancies = [...db.occupancies];

    if (!exists && occupancy.occupancyType === 'primary') {
      // Auto-end-date the previous primary for this position
      occupancies = occupancies.map(o => {
        if (o.positionId === occupancy.positionId && o.occupancyType === 'primary' && !o.effectiveTo) {
          return { ...o, effectiveTo: occupancy.effectiveFrom || new Date().toISOString().split('T')[0] };
        }
        return o;
      });
    }

    if (exists) {
      occupancies = occupancies.map(o => o.id === occupancy.id ? { ...o, ...occupancy } : o);
    } else {
      occupancies = [...occupancies, { ...occupancy, id: uid(), createdAt: new Date().toISOString() }];
    }

    return { ...db, occupancies };
  });

  // ── Auto-assignment engine hook ─────────────────────────────────────────────
  // Fire 'position_filled' rules only when a brand-new Primary occupancy is saved
  if (isNewPrimary && occupancy.employeeId) {
    // Micro-delay lets the mutation settle before we read it back for snapshot
    try { evaluateAndFireRules(occupancy.employeeId, 'position_filled', 'system:position_filled'); } catch { /* never throw */ }
  }
}

export function endDateOccupancy(id) {
  mutateOrg(db => ({
    ...db,
    occupancies: db.occupancies.map(o =>
      o.id === id ? { ...o, effectiveTo: new Date().toISOString().split('T')[0] } : o
    ),
  }));
}

/** Bulk import occupancies from CSV rows */
export function bulkImportOccupancy(rows) {
  // rows: [{ employee_id, position_code, occupancy_type, effective_from }]
  const db = loadOrg();
  const results = { created: 0, failed: [], skipped: 0 };

  const positionByCode = {};
  db.positions.forEach(p => { positionByCode[p.positionCode] = p.id; });
  const validEmployeeIds = new Set(db.orgEmployees.map(e => e.id));
  const validTypes = new Set(['primary', 'acting', 'dotted-line', 'functional']);

  const toProcess = [];

  rows.forEach((row, idx) => {
    const { employee_id, position_code, occupancy_type, effective_from } = row;
    if (!employee_id || !position_code || !occupancy_type || !effective_from) {
      results.failed.push({ row: idx + 1, reason: 'Missing required fields: employee_id, position_code, occupancy_type, effective_from' });
      return;
    }
    if (!validEmployeeIds.has(employee_id)) {
      results.failed.push({ row: idx + 1, reason: `Employee not found: "${employee_id}"` });
      return;
    }
    const positionId = positionByCode[position_code];
    if (!positionId) {
      results.failed.push({ row: idx + 1, reason: `Position not found: "${position_code}"` });
      return;
    }
    if (!validTypes.has(occupancy_type)) {
      results.failed.push({ row: idx + 1, reason: `Invalid occupancy_type: "${occupancy_type}". Must be primary/acting/dotted-line/functional` });
      return;
    }
    toProcess.push({ positionId, employeeId: employee_id, occupancyType: occupancy_type, effectiveFrom: effective_from, effectiveTo: null, notes: '', createdBy: 'admin' });
    results.created++;
  });

  // Process in sequence so auto-end-date logic applies correctly
  toProcess.forEach(occ => saveOccupancy(occ));
  return results;
}

// ═════════════════════════════════════════════════════════════════════════════
//  RUNTIME REPORTING CHAIN RESOLVER
//  Reporting chain is NEVER stored — always derived from position tree.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Resolves the full org context for an employee at runtime.
 * Returns:
 * {
 *   position,          // Position object (primary position) or null
 *   orgUnit,           // OrgUnit object or null
 *   level,             // HierarchyLevel object or null
 *   supervisor,        // { employee, position, level } or null
 *   directReports,     // [{ employee, position, level }]
 *   peers,             // [{ employee, position, level }]
 *   dottedLineManagers,// [{ employee, position, level, occupancyType }]
 *   positionHistory,   // [{ occupancy, position }]
 *   allOccupancies,    // all current active occupancies for this employee
 * }
 */
export function resolveReportingChain(employeeId) {
  const db = loadOrg();

  // Employee's primary position
  const primaryOcc = db.occupancies.find(
    o => o.employeeId === employeeId && o.occupancyType === 'primary' && !o.effectiveTo
  );
  const position = primaryOcc ? db.positions.find(p => p.id === primaryOcc.positionId) || null : null;
  const orgUnit  = position ? db.orgUnits.find(u => u.id === position.orgUnitId) || null : null;
  const level    = position ? db.hierarchyLevels.find(l => l.id === position.hierarchyLevelId) || null : null;

  // Supervisor = primary occupant of parent position
  let supervisor = null;
  if (position && position.parentPositionId) {
    const parentPos = db.positions.find(p => p.id === position.parentPositionId);
    if (parentPos) {
      const supOcc = db.occupancies.find(
        o => o.positionId === parentPos.id && o.occupancyType === 'primary' && !o.effectiveTo
      );
      if (supOcc) {
        const supEmp = db.orgEmployees.find(e => e.id === supOcc.employeeId);
        const supLevel = db.hierarchyLevels.find(l => l.id === parentPos.hierarchyLevelId);
        supervisor = supEmp ? { employee: supEmp, position: parentPos, level: supLevel || null } : null;
      } else {
        // Supervisor position is vacant
        supervisor = { employee: null, position: parentPos, level: db.hierarchyLevels.find(l => l.id === parentPos.hierarchyLevelId) || null, vacant: true };
      }
    }
  }

  // Direct reports = primary occupants of child positions
  const childPositions = position
    ? db.positions.filter(p => p.parentPositionId === position.id && p.isActive)
    : [];
  const directReports = childPositions.map(childPos => {
    const occ = db.occupancies.find(o => o.positionId === childPos.id && o.occupancyType === 'primary' && !o.effectiveTo);
    const emp = occ ? db.orgEmployees.find(e => e.id === occ.employeeId) || null : null;
    const lvl = db.hierarchyLevels.find(l => l.id === childPos.hierarchyLevelId) || null;
    return { employee: emp, position: childPos, level: lvl, vacant: !emp };
  });

  // Peers = primary occupants of positions at same level in same org unit
  let peers = [];
  if (position && level) {
    const sameUnitSameLevel = db.positions.filter(p =>
      p.id !== position.id &&
      p.isActive &&
      p.hierarchyLevelId === position.hierarchyLevelId &&
      p.orgUnitId === position.orgUnitId
    );
    peers = sameUnitSameLevel.flatMap(p => {
      const occ = db.occupancies.find(o => o.positionId === p.id && o.occupancyType === 'primary' && !o.effectiveTo);
      if (!occ) return [];
      const emp = db.orgEmployees.find(e => e.id === occ.employeeId);
      if (!emp) return [];
      const lvl = db.hierarchyLevels.find(l => l.id === p.hierarchyLevelId) || null;
      return [{ employee: emp, position: p, level: lvl }];
    });
  }

  // Dotted-line / functional managers for this employee's position
  let dottedLineManagers = [];
  if (position) {
    const dottedOccs = db.occupancies.filter(
      o => o.positionId === position.id && (o.occupancyType === 'dotted-line' || o.occupancyType === 'functional') && !o.effectiveTo
    );
    dottedLineManagers = dottedOccs.map(o => {
      const emp = db.orgEmployees.find(e => e.id === o.employeeId);
      const pos = db.positions.find(p => p.id === o.positionId) || null;
      const lvl = pos ? db.hierarchyLevels.find(l => l.id === pos.hierarchyLevelId) || null : null;
      return { employee: emp || null, position: pos, level: lvl, occupancyType: o.occupancyType };
    });
  }

  // Position history (ended occupancies for this employee)
  const positionHistory = db.occupancies
    .filter(o => o.employeeId === employeeId && o.effectiveTo)
    .map(o => {
      const pos = db.positions.find(p => p.id === o.positionId) || null;
      return { occupancy: o, position: pos };
    })
    .sort((a, b) => new Date(b.occupancy.effectiveFrom) - new Date(a.occupancy.effectiveFrom));

  // All current active occupancies for this employee
  const allOccupancies = db.occupancies
    .filter(o => o.employeeId === employeeId && !o.effectiveTo)
    .map(o => {
      const pos = db.positions.find(p => p.id === o.positionId) || null;
      const lvl = pos ? db.hierarchyLevels.find(l => l.id === pos.hierarchyLevelId) || null : null;
      return { occupancy: o, position: pos, level: lvl };
    });

  return { position, orgUnit, level, supervisor, directReports, peers, dottedLineManagers, positionHistory, allOccupancies };
}

/** Suggest reviewers for 360° based on position tree */
export function suggestReviewers(employeeId) {
  const chain = resolveReportingChain(employeeId);
  const supervisors    = chain.supervisor && !chain.supervisor.vacant ? [chain.supervisor.employee.id] : [];
  const subordinates   = chain.directReports.filter(r => !r.vacant).map(r => r.employee.id);
  const peers          = chain.peers.map(r => r.employee.id);
  const dottedLine     = chain.dottedLineManagers.filter(r => r.employee).map(r => r.employee.id);
  const vacantSupervisor = chain.supervisor?.vacant ? chain.supervisor.position : null;
  return { supervisors, subordinates, peers, dottedLine, vacantSupervisor };
}

/** Legacy — resolves upward chain as array of employeeIds */
export function getReportingChain(employeeId) {
  const db = loadOrg();
  const chain = [];
  const visited = new Set();
  let current = employeeId;
  while (current) {
    if (visited.has(current)) break;
    visited.add(current);
    const primaryOcc = db.occupancies.find(o => o.employeeId === current && o.occupancyType === 'primary' && !o.effectiveTo);
    if (!primaryOcc) break;
    const pos = db.positions.find(p => p.id === primaryOcc.positionId);
    if (!pos || !pos.parentPositionId) break;
    const parentPrimary = db.occupancies.find(o => o.positionId === pos.parentPositionId && o.occupancyType === 'primary' && !o.effectiveTo);
    if (!parentPrimary) break;
    chain.push(parentPrimary.employeeId);
    current = parentPrimary.employeeId;
  }
  return chain;
}

/** Legacy — get subordinate chain as array of employeeIds */
export function getSubordinateChain(managerId) {
  const db = loadOrg();
  const result = [];
  const queue = [managerId];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    const primaryOcc = db.occupancies.find(o => o.employeeId === current && o.occupancyType === 'primary' && !o.effectiveTo);
    if (!primaryOcc) continue;
    const pos = db.positions.find(p => p.id === primaryOcc.positionId);
    if (!pos) continue;
    const children = db.positions.filter(p => p.parentPositionId === pos.id && p.isActive);
    children.forEach(c => {
      const childOcc = db.occupancies.find(o => o.positionId === c.id && o.occupancyType === 'primary' && !o.effectiveTo);
      if (childOcc && !result.includes(childOcc.employeeId)) {
        result.push(childOcc.employeeId);
        queue.push(childOcc.employeeId);
      }
    });
  }
  return result;
}

// ═════════════════════════════════════════════════════════════════════════════
//  CUSTOM FIELDS API
// ═════════════════════════════════════════════════════════════════════════════

export function getCustomFields() { return loadOrg().customFields; }
export function getActiveCustomFields() { return loadOrg().customFields.filter(f => f.status === 'active'); }
export function getFilterableFields() { return loadOrg().customFields.filter(f => f.status === 'active' && f.isFilterable); }

export function getFieldsForSection(section) {
  return loadOrg().customFields
    .filter(f => f.status === 'active' && f.section === section)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getFieldsForEmployee(employeeId) {
  const db = loadOrg();
  const emp = db.orgEmployees.find(e => e.id === employeeId);
  if (!emp) return db.customFields.filter(f => f.status === 'active');
  return db.customFields.filter(f => {
    if (f.status !== 'active') return false;
    if (!f.appliesToLevels || f.appliesToLevels.length === 0) return true;
    return f.appliesToLevels.includes(emp.levelId);
  });
}

export function saveCustomField(field) {
  mutateOrg(db => {
    const exists = db.customFields.find(f => f.id === field.id);
    const toSave = exists
      ? { ...field }
      : { ...field, id: uid(), fieldKey: field.fieldKey || toSnakeCase(field.label), status: 'active', createdAt: new Date().toISOString() };
    return {
      ...db,
      customFields: exists
        ? db.customFields.map(f => f.id === field.id ? { ...f, ...toSave } : f)
        : [...db.customFields, toSave],
    };
  });
}

export function archiveCustomField(id) {
  mutateOrg(db => ({ ...db, customFields: db.customFields.map(f => f.id === id ? { ...f, status: 'archived' } : f) }));
}

export function restoreCustomField(id) {
  mutateOrg(db => ({ ...db, customFields: db.customFields.map(f => f.id === id ? { ...f, status: 'active' } : f) }));
}

export function reorderCustomFields(section, orderedIds) {
  mutateOrg(db => ({
    ...db,
    customFields: db.customFields.map(f => {
      if (f.section !== section) return f;
      const idx = orderedIds.indexOf(f.id);
      return idx >= 0 ? { ...f, displayOrder: idx + 1 } : f;
    }),
  }));
}

// ═════════════════════════════════════════════════════════════════════════════
//  CUSTOM FIELD VALUES API
// ═════════════════════════════════════════════════════════════════════════════

export function getCustomFieldValues(employeeId) {
  return loadOrg().customFieldValues.filter(v => v.employeeId === employeeId);
}

export function getCustomFieldValue(employeeId, fieldDefinitionId) {
  return loadOrg().customFieldValues.find(v => v.employeeId === employeeId && v.fieldDefinitionId === fieldDefinitionId) || null;
}

export function getEmployeeFieldMap(employeeId) {
  const db = loadOrg();
  const values = db.customFieldValues.filter(v => v.employeeId === employeeId);
  const map = {};
  values.forEach(v => {
    const field = db.customFields.find(f => f.id === v.fieldDefinitionId);
    if (field) map[field.fieldKey] = v.value;
  });
  return map;
}

export function saveCustomFieldValue(employeeId, fieldDefinitionId, value, updatedBy = 'admin') {
  mutateOrg(db => {
    const existing = db.customFieldValues.find(v => v.employeeId === employeeId && v.fieldDefinitionId === fieldDefinitionId);
    const record = { employeeId, fieldDefinitionId, value: String(value), updatedBy, updatedAt: new Date().toISOString() };
    return {
      ...db,
      customFieldValues: existing
        ? db.customFieldValues.map(v => v.employeeId === employeeId && v.fieldDefinitionId === fieldDefinitionId ? { ...v, ...record } : v)
        : [...db.customFieldValues, { ...record, id: uid() }],
    };
  });

  // ── Auto-assignment engine hook ─────────────────────────────────────────────
  try { evaluateAndFireRules(employeeId, 'field_updated', `system:field_updated:${fieldDefinitionId}`); } catch { /* never throw */ }
}

export function bulkSaveCustomFieldValues(employeeId, valuesMap, updatedBy = 'admin') {
  Object.entries(valuesMap).forEach(([fieldDefinitionId, value]) => {
    if (value !== undefined && value !== null) {
      saveCustomFieldValue(employeeId, fieldDefinitionId, value, updatedBy);
    }
  });
}

export function getProfileCompleteness(employeeId) {
  const db = loadOrg();
  const fields = getFieldsForEmployee(employeeId).filter(f => f.isRequired);
  if (fields.length === 0) return { filled: 0, total: 0, pct: 100 };
  const values = db.customFieldValues.filter(v => v.employeeId === employeeId);
  const filled = fields.filter(f => {
    const val = values.find(v => v.fieldDefinitionId === f.id);
    return val && val.value && val.value !== '' && val.value !== '[]';
  }).length;
  return { filled, total: fields.length, pct: Math.round((filled / fields.length) * 100) };
}

// ═════════════════════════════════════════════════════════════════════════════
//  AUTO-ASSIGNMENT RULES API
// ═════════════════════════════════════════════════════════════════════════════

export function getAutoRules() {
  return [...loadOrg().autoRules].sort((a, b) => b.priority - a.priority);
}

export function saveAutoRule(rule) {
  mutateOrg(db => {
    const exists = db.autoRules.find(r => r.id === rule.id);
    return {
      ...db,
      autoRules: exists
        ? db.autoRules.map(r => r.id === rule.id ? { ...r, ...rule } : r)
        : [...db.autoRules, { ...rule, id: uid(), createdAt: new Date().toISOString() }],
    };
  });
}

export function deleteAutoRule(id) {
  mutateOrg(db => ({ ...db, autoRules: db.autoRules.filter(r => r.id !== id) }));
}

export function toggleAutoRule(id) {
  mutateOrg(db => ({
    ...db,
    autoRules: db.autoRules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r),
  }));
}

/** Evaluate all conditions for a single rule against a built attribute snapshot. Returns true/false. */
function _evalConditions(conditions, attrSnapshot) {
  return (conditions || []).every(cond => {
    const empValue = attrSnapshot[cond.field] ?? '';
    if (cond.operator === 'equals')    return String(empValue) === String(cond.value);
    if (cond.operator === 'contains')  return String(empValue).toLowerCase().includes(String(cond.value).toLowerCase());
    if (cond.operator === 'is_one_of') {
      const opts = Array.isArray(cond.value) ? cond.value : [cond.value];
      // also handle JSON-encoded multi-select values stored as '["val1","val2"]'
      let parsed = empValue;
      try { parsed = JSON.parse(empValue); } catch { /* not JSON */ }
      if (Array.isArray(parsed)) return parsed.some(v => opts.includes(v));
      return opts.includes(String(empValue));
    }
    return false;
  });
}

/**
 * Build the full attribute snapshot for an employee — used by both the evaluator
 * and the condition builder.
 *
 * Snapshot keys:
 *   hierarchyLevel         — emp.levelId (backward-compat condition field)
 *   position_levelId       — levelId of the employee's PRIMARY position
 *   position_orgUnitId     — orgUnitId of the PRIMARY position
 *   position_division      — division field of the PRIMARY position
 *   position_positionCode  — positionCode of the PRIMARY position
 *   <customField.id>       — raw stored value for every custom field
 *   <customField.fieldKey> — same value, accessed by fieldKey
 */
function _buildAttrSnapshot(employeeId, db) {
  const emp = db.orgEmployees.find(e => e.id === employeeId);
  if (!emp) return null;

  const snapshot = {};

  // Legacy hierarchy level (from orgEmployee.levelId)
  snapshot['hierarchyLevel'] = emp.levelId || '';

  // Position-derived attributes
  const primaryOcc = db.occupancies.find(
    o => o.employeeId === employeeId && o.occupancyType === 'primary' && !o.effectiveTo
  );
  if (primaryOcc) {
    const pos = db.positions.find(p => p.id === primaryOcc.positionId);
    if (pos) {
      snapshot['position_levelId']      = pos.hierarchyLevelId || '';
      snapshot['position_orgUnitId']    = pos.orgUnitId        || '';
      snapshot['position_division']     = pos.division         || '';
      snapshot['position_positionCode'] = pos.positionCode     || '';
    }
  }

  // Custom field values — indexed by both field.id and field.fieldKey
  const values = db.customFieldValues.filter(v => v.employeeId === employeeId);
  values.forEach(v => {
    const field = db.customFields.find(f => f.id === v.fieldDefinitionId);
    if (field) {
      snapshot[field.id]       = v.value;
      snapshot[field.fieldKey] = v.value;
    }
  });

  return snapshot;
}

/**
 * Evaluate all active rules for an employee.
 * Optionally filtered by trigger. Passes the full attribute snapshot
 * (including position-derived fields) through _evalConditions.
 * Does NOT write any logs — use evaluateAndFireRules for auto-execution.
 */
export function evaluateRulesForEmployee(employeeId, triggerFilter = null) {
  const db = loadOrg();
  const snapshot = _buildAttrSnapshot(employeeId, db);
  if (!snapshot) return [];

  let activeRules = [...db.autoRules].filter(r => r.isActive).sort((a, b) => b.priority - a.priority);
  if (triggerFilter) activeRules = activeRules.filter(r => r.trigger === triggerFilter);

  const matched = [];
  activeRules.forEach(rule => {
    if (_evalConditions(rule.conditions, snapshot)) {
      matched.push({ rule, actions: rule.actions });
    }
  });
  return matched;
}

/**
 * Auto-execution engine — evaluates rules for employeeId filtered by trigger,
 * logs every matched action to autoRuleLogs, and returns a summary.
 *
 * Called automatically by:
 *   saveOccupancy()       → trigger = 'position_filled'  (new primary only)
 *   saveCustomFieldValue() → trigger = 'field_updated'
 *
 * @param {string} employeeId
 * @param {'position_filled'|'field_updated'} trigger
 * @param {string} [firedBy='system']
 * @returns {{ firedCount: number, logIds: string[] }}
 */
export function evaluateAndFireRules(employeeId, trigger, firedBy = 'system') {
  const db = loadOrg();
  const emp = db.orgEmployees.find(e => e.id === employeeId);
  if (!emp) return { firedCount: 0, logIds: [] };

  const snapshot = _buildAttrSnapshot(employeeId, db);
  if (!snapshot) return { firedCount: 0, logIds: [] };

  const activeRules = [...db.autoRules]
    .filter(r => r.isActive && r.trigger === trigger)
    .sort((a, b) => b.priority - a.priority);

  const logEntries = [];
  const now = new Date().toISOString();

  activeRules.forEach(rule => {
    if (_evalConditions(rule.conditions, snapshot)) {
      (rule.actions || []).forEach(action => {
        logEntries.push({
          id:               uid(),
          employeeId,
          ruleId:           rule.id,
          ruleName:         rule.name,
          trigger,
          actionType:       action.type,
          assignedEntityId: action.entityId || '',
          firedBy,
          triggeredAt:      now,
          conditionSnapshot: JSON.stringify(snapshot),
        });
      });
    }
  });

  if (logEntries.length > 0) {
    mutateOrg(db2 => ({
      ...db2,
      autoRuleLogs: [...db2.autoRuleLogs, ...logEntries],
    }));
  }

  return { firedCount: logEntries.length, logIds: logEntries.map(e => e.id) };
}

export function getAutoRuleLogs(employeeId) {
  return loadOrg().autoRuleLogs.filter(l => l.employeeId === employeeId);
}

/** Returns ALL rule execution logs, sorted newest-first. */
export function getAllAutoRuleLogs() {
  return [...loadOrg().autoRuleLogs].sort((a, b) => new Date(b.triggeredAt) - new Date(a.triggeredAt));
}

/** Clear the full execution log (admin action). */
export function clearAutoRuleLogs() {
  mutateOrg(db => ({ ...db, autoRuleLogs: [] }));
}

export function logAutoRuleAction(employeeId, ruleId, actionType, assignedEntityId, triggeredBy = 'system') {
  mutateOrg(db => ({
    ...db,
    autoRuleLogs: [...db.autoRuleLogs, {
      id: uid(), employeeId, ruleId, actionType, assignedEntityId,
      triggeredAt: new Date().toISOString(), triggeredBy,
    }],
  }));
}

// ═════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════

export const FIELD_SECTIONS = [
  'Role & Designation',
  'Territory & Coverage',
  'Product Portfolio',
  'Compensation & Grade',
  'Other',
];

export const FIELD_TYPES = {
  text:             'Single-line Text',
  textarea:         'Multi-line Text',
  number:           'Number',
  date:             'Date',
  dropdown_single:  'Dropdown (Single)',
  dropdown_multi:   'Dropdown (Multi-select)',
  toggle:           'Toggle (Yes/No)',
  org_unit_lookup:  'Org Unit Lookup',
  hierarchy_lookup: 'Hierarchy Lookup',
};

export const OCCUPANCY_TYPES = [
  { value: 'primary',     label: 'Primary',     cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'acting',      label: 'Acting',      cls: 'bg-amber-100 text-amber-700'    },
  { value: 'dotted-line', label: 'Dotted-line', cls: 'bg-blue-100 text-blue-700'      },
  { value: 'functional',  label: 'Functional',  cls: 'bg-purple-100 text-purple-700'  },
];

export const ORG_UNIT_TYPES = [
  'Division', 'Zone', 'Region', 'Area', 'Territory', 'Business Unit',
];

export const RELATIONSHIP_TYPES = {
  primary:       { label: 'Primary',      cls: 'bg-indigo-100 text-indigo-700' },
  'dotted-line': { label: 'Dotted Line',  cls: 'bg-amber-100 text-amber-700'  },
  functional:    { label: 'Functional',   cls: 'bg-purple-100 text-purple-700' },
};

export const ACCESS_ROLES = ['admin', 'manager', 'employee'];

export const RULE_OPERATORS = [
  { value: 'equals',    label: 'equals' },
  { value: 'contains',  label: 'contains' },
  { value: 'is_one_of', label: 'is one of' },
];

export const RULE_ACTION_TYPES = [
  { value: 'assign_assessment_template', label: 'Assign Assessment Template' },
  { value: 'assign_kpi_template',        label: 'Assign KPI Template' },
  { value: 'assign_training_module',     label: 'Assign Training Module' },
];

export const RULE_TRIGGERS = [
  { value: 'position_filled', label: 'Position filled (new occupancy created)' },
  { value: 'field_updated',   label: 'Employee custom field updated' },
];
