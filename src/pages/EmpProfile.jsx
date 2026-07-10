import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { getEmployeeByUserId, updateEmployee } from '../lib/supabase';
import { Button, Input, Select, Alert, Card, PageHeader, Badge } from '../components/UI';
import { User, CheckCircle, ChevronDown, ChevronRight, Edit2, X, EyeOff, GitBranch, BarChart2, ChevronDown as CD } from 'lucide-react';
import {
  getOrgEmployees, getHierarchyLevels, getActiveReportingLines,
  getCustomFields, getCustomFieldValues,
  saveCustomFieldValue, getProfileCompleteness, getAutoRuleLogs,
  getAutoRules, RELATIONSHIP_TYPES, FIELD_SECTIONS,
  resolveReportingChain, getOrgUnits, OCCUPANCY_TYPES,
} from '../lib/orgDb';

const DEPARTMENTS = ['Engineering', 'Project Management', 'Operations', 'Finance', 'HR', 'Sales', 'Marketing', 'IT', 'Legal', 'Procurement', 'Other'];
const LEVELS = ['Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Senior Manager', 'Director', 'VP', 'C-Suite'];

// ─── Completeness Bar ─────────────────────────────────────────────────────────
function CompletenessBar({ filled, total, pct }) {
  const color = pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold whitespace-nowrap" style={{ color }}>
        {filled}/{total} required fields · {pct}%
      </span>
    </div>
  );
}

// ─── Inline field edit row ────────────────────────────────────────────────────
function FieldRow({ field, value, onEdit, isAdminOrManager, editing, editValue, onEditChange, onSave, onCancel }) {
  if (!isAdminOrManager && !field.isVisibleToEmployee) return null;

  const displayValue = (() => {
    if (!value) return <span className="text-gray-300 italic text-xs">Not set</span>;
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr)) {
        if (arr.length === 0) return <span className="text-gray-300 italic text-xs">Not set</span>;
        return (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {arr.map(v => <span key={v} className="px-1.5 py-0.5 bg-[#01A2B1]/10 text-[#01A2B1] text-xs rounded-full">{v}</span>)}
          </div>
        );
      }
    } catch {}
    if (value === 'true')  return <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">Yes</span>;
    if (value === 'false') return <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">No</span>;
    return <span className="text-sm text-gray-800">{value}</span>;
  })();

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium text-gray-500">{field.label}</span>
          {field.isRequired && <span className="text-red-400 text-xs" title="Required">*</span>}
          {!field.isVisibleToEmployee && <EyeOff size={10} className="text-amber-400" title="Admin/manager only" />}
        </div>
        {editing ? (
          <div className="flex items-start gap-2 mt-1">
            <div className="flex-1">
              {field.fieldType === 'dropdown_single' ? (
                <select
                  autoFocus
                  value={editValue}
                  onChange={e => onEditChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#01A2B1] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#01A2B1]/30 bg-white"
                >
                  <option value="">— select —</option>
                  {(field.options || []).map(o => <option key={o}>{o}</option>)}
                </select>
              ) : field.fieldType === 'dropdown_multi' ? (
                <div className="flex flex-wrap gap-1.5">
                  {(field.options || []).map(o => {
                    let selected = [];
                    try { selected = JSON.parse(editValue || '[]'); } catch {}
                    const isSel = selected.includes(o);
                    return (
                      <button key={o} type="button"
                        onClick={() => {
                          let arr = []; try { arr = JSON.parse(editValue || '[]'); } catch {}
                          onEditChange(JSON.stringify(isSel ? arr.filter(v => v !== o) : [...arr, o]));
                        }}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-all
                          ${isSel ? 'bg-[#01A2B1] text-white border-[#01A2B1]' : 'border-gray-200 text-gray-600 hover:border-[#01A2B1]/50 bg-white'}`}>
                        {o}
                      </button>
                    );
                  })}
                </div>
              ) : field.fieldType === 'toggle' ? (
                <div className="flex items-center gap-2 py-1">
                  <button type="button"
                    onClick={() => onEditChange(editValue === 'true' ? 'false' : 'true')}
                    className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                    style={{ background: editValue === 'true' ? '#01A2B1' : '#D1D5DB' }}>
                    <span className="absolute bg-white rounded-full shadow transition-transform"
                      style={{ width: 16, height: 16, top: 2, left: 2, transform: editValue === 'true' ? 'translateX(20px)' : 'none' }} />
                  </button>
                  <span className="text-sm text-gray-600">{editValue === 'true' ? 'Yes' : 'No'}</span>
                </div>
              ) : field.fieldType === 'textarea' ? (
                <textarea autoFocus value={editValue} onChange={e => onEditChange(e.target.value)} rows={3}
                  className="w-full px-2.5 py-1.5 border border-[#01A2B1] rounded-lg text-sm focus:outline-none resize-none" />
              ) : (
                <input autoFocus
                  type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
                  value={editValue} onChange={e => onEditChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#01A2B1] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#01A2B1]/30" />
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0 mt-0.5">
              <button onClick={onSave}   className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Save"><CheckCircle size={14} /></button>
              <button onClick={onCancel} className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors" title="Cancel"><X size={14} /></button>
            </div>
          </div>
        ) : (
          <div className="mt-0.5">{displayValue}</div>
        )}
      </div>
      {isAdminOrManager && !editing && (
        <button onClick={() => onEdit(field, value)}
          className="mt-1 p-1.5 rounded-lg text-gray-200 hover:text-[#01A2B1] hover:bg-[#01A2B1]/10 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
          <Edit2 size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Collapsible custom field section ────────────────────────────────────────
function CustomSection({ section, fields, values, orgEmpId, isAdminOrManager, onSaved }) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing]     = useState({}); // { fieldId: currentEditValue }

  // fields prop is already filtered to this section + appliesTo + active
  // additionally filter visibility
  const visible = fields.filter(f => isAdminOrManager || f.isVisibleToEmployee)
                        .sort((a, b) => a.displayOrder - b.displayOrder);

  if (visible.length === 0) return null;

  const getVal = (fieldId) => values.find(v => v.fieldDefinitionId === fieldId)?.value || '';

  const handleEditStart = (field, value) => setEditing(prev => ({ ...prev, [field.id]: value || '' }));
  const handleCancel    = (fieldId)       => setEditing(prev => { const n = { ...prev }; delete n[fieldId]; return n; });

  const handleSave = (field) => {
    saveCustomFieldValue(orgEmpId, field.id, editing[field.id] ?? '', 'user');
    handleCancel(field.id);
    onSaved(); // trigger re-read in parent
  };

  // Count filled fields
  const filledCount = visible.filter(f => {
    const v = getVal(f.id);
    return v && v !== '' && v !== '[]';
  }).length;

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-5 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-100"
        onClick={() => setCollapsed(c => !c)}
      >
        {collapsed ? <ChevronRight size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        <span className="font-semibold text-gray-700 text-sm">{section}</span>
        <span className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          <span>{filledCount}/{visible.length} filled</span>
          {filledCount < visible.length && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Has empty fields" />
          )}
        </span>
      </button>
      {!collapsed && (
        <div className="px-5 pb-3 pt-1 divide-y divide-gray-50">
          {visible.map(f => (
            <FieldRow
              key={f.id}
              field={f}
              value={getVal(f.id)}
              isAdminOrManager={isAdminOrManager}
              editing={f.id in editing}
              editValue={editing[f.id] ?? ''}
              onEdit={handleEditStart}
              onEditChange={v => setEditing(prev => ({ ...prev, [f.id]: v }))}
              onSave={() => handleSave(f)}
              onCancel={() => handleCancel(f.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Position & Reporting Section (position-based, runtime-derived) ───────────
function PositionReportingSection({ orgEmpId }) {
  const chain = resolveReportingChain(orgEmpId);
  const { position, orgUnit, level, supervisor, directReports, dottedLineManagers, positionHistory, allOccupancies } = chain;
  const units = getOrgUnits();

  // Ancestor unit chain
  const unitAncestors = (() => {
    if (!orgUnit) return [];
    const all = [];
    const visited = new Set();
    let current = orgUnit;
    while (current) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      all.unshift(current);
      current = units.find(u => u.id === current.parentOrgUnitId) || null;
    }
    return all;
  })();

  if (!position && allOccupancies.length === 0) return (
    <Card className="p-5 border-dashed border-2 text-center">
      <GitBranch size={22} className="mx-auto mb-2 text-gray-300" />
      <p className="text-sm text-gray-400">No position assigned. Contact HR to assign a position.</p>
    </Card>
  );

  const PersonChip = ({ emp, pos, lvl, badge, vacant }) => (
    <div className={`flex items-center gap-2.5 p-3 rounded-xl border ${vacant ? 'border-dashed border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50'}`}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
        style={{ background: vacant ? '#FEE2E2' : ((lvl?.colorTag || '#01A2B1') + '22'), color: vacant ? '#EF4444' : (lvl?.colorTag || '#01A2B1') }}>
        {vacant ? '?' : (emp?.name?.[0] || '?')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800">{vacant ? 'Vacant' : (emp?.name || '—')}</div>
        {pos && <div className="text-xs text-gray-400">{pos.title} · <span className="font-mono">{pos.positionCode}</span></div>}
        {lvl && <div className="text-xs" style={{color: lvl.colorTag || '#6B7280'}}>{lvl.abbreviation} — {lvl.name}</div>}
      </div>
      {badge && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{badge}</span>}
      {vacant && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-500 font-medium">Vacant</span>}
    </div>
  );

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
        <GitBranch size={15} className="text-[#01A2B1]" />
        <h3 className="text-sm font-semibold text-gray-700">Position &amp; Reporting</h3>
        <span className="ml-auto text-xs text-gray-400">Derived from org structure</span>
      </div>

      <div className="p-5 space-y-5">
        {/* Current position details */}
        {position && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Current Position</div>
            <div className="bg-gradient-to-r from-[#01A2B1]/5 to-transparent rounded-xl border border-[#01A2B1]/15 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background: level?.colorTag || '#01A2B1'}}>
                  <span className="text-white font-bold text-sm">{level?.abbreviation || '?'}</span>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-800">{position.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5 font-mono">{position.positionCode}</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {level && <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{background: level.colorTag || '#6B7280'}}>{level.name}</span>}
                    {orgUnit && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{orgUnit.name}</span>}
                    {position.division && <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">{position.division}</span>}
                  </div>
                  {unitAncestors.length > 1 && (
                    <div className="text-xs text-gray-400 mt-2">
                      {unitAncestors.map((u, i) => (
                        <span key={u.id}>{i > 0 && ' › '}{u.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All active occupancies (for employees in multiple positions) */}
        {allOccupancies.length > 1 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">All Active Positions</div>
            <div className="space-y-2">
              {allOccupancies.map(({ occupancy, position: p, level: l }) => {
                const typeInfo = OCCUPANCY_TYPES.find(t => t.value === occupancy.occupancyType);
                return p ? (
                  <div key={occupancy.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="font-mono text-xs text-gray-500">{p.positionCode}</span>
                    <span className="text-xs text-gray-700 flex-1">{p.title}</span>
                    {typeInfo && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.cls}`}>{typeInfo.label}</span>}
                    <span className="text-xs text-gray-400">from {occupancy.effectiveFrom}</span>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Supervisor */}
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Reports To</div>
          {supervisor ? (
            <PersonChip emp={supervisor.employee} pos={supervisor.position} lvl={supervisor.level} vacant={supervisor.vacant} />
          ) : (
            <p className="text-xs text-gray-400 italic px-1">No supervisor — top of hierarchy or no position assigned.</p>
          )}
        </div>

        {/* Direct Reports */}
        {directReports.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Direct Reports ({directReports.length})
            </div>
            <div className="space-y-2">
              {directReports.map(({ employee: emp, position: p, level: l, vacant }) => (
                <PersonChip key={p?.id || Math.random()} emp={emp} pos={p} lvl={l} vacant={vacant} />
              ))}
            </div>
          </div>
        )}

        {/* Dotted-line */}
        {dottedLineManagers.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Dotted-line / Functional</div>
            <div className="space-y-2">
              {dottedLineManagers.map(({ employee: emp, position: p, level: l, occupancyType }) => (
                <PersonChip key={p?.id || Math.random()} emp={emp} pos={p} lvl={l}
                  badge={occupancyType === 'functional' ? 'Functional' : 'Dotted-line'} />
              ))}
            </div>
          </div>
        )}

        {/* Position history */}
        {positionHistory.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Position History</div>
            <div className="space-y-1.5">
              {positionHistory.map(({ occupancy, position: p }) => (
                <div key={occupancy.id} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 opacity-70">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-600">{p?.title || occupancy.positionId}</div>
                    <div className="text-xs text-gray-400 font-mono">{p?.positionCode}</div>
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {occupancy.effectiveFrom} → {occupancy.effectiveTo}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Auto-Rule Logs Section ───────────────────────────────────────────────────
function RulesLogSection({ orgEmpId }) {
  const logs  = getAutoRuleLogs(orgEmpId);
  const rules = getAutoRules();
  if (logs.length === 0) return null;
  const ruleMap = Object.fromEntries(rules.map(r => [r.id, r]));
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <BarChart2 size={16} className="text-purple-500" />Auto-Assignment Log
      </h3>
      <div className="space-y-0">
        {logs.slice(0, 8).map(log => (
          <div key={log.id} className="flex items-start gap-2.5 text-xs py-1.5 border-b border-gray-50 last:border-0">
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-purple-300" />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-700">{ruleMap[log.ruleId]?.name || 'Rule'}</span>
              <span className="text-gray-400"> → {(log.actionType || '').replace(/_/g, ' ')}</span>
            </div>
            <div className="text-gray-300 flex-shrink-0 whitespace-nowrap">
              {new Date(log.triggeredAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Org employee picker (admin only — lets admin view any employee) ──────────
function OrgEmployeePicker({ employees, levels, value, onChange }) {
  const lvlMap = Object.fromEntries(levels.map(l => [l.id, l]));
  return (
    <div className="mb-4 bg-[#01A2B1]/5 border border-[#01A2B1]/20 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex-1">
        <p className="text-xs font-semibold text-[#01A2B1] mb-0.5">Viewing org profile for:</p>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full sm:max-w-xs px-3 py-1.5 border border-[#01A2B1]/30 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:border-[#01A2B1]"
        >
          <option value="">— No org employee linked —</option>
          {employees.map(e => {
            const l = lvlMap[e.levelId];
            return <option key={e.id} value={e.id}>{e.name} ({l?.abbreviation || '?'})</option>;
          })}
        </select>
      </div>
      <p className="text-xs text-gray-500">Admins can browse any employee's org profile.<br/>Employees see their own only.</p>
    </div>
  );
}

// ─── Main Profile Page ────────────────────────────────────────────────────────
export default function EmpProfile() {
  const { currentUser, refresh } = useApp();
  const [employee, setEmployee]   = useState(null);
  const [form, setForm] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    employeeCode: '',
    jobTitle: '',
    department: '',
    level: '',
    organization: '',
    phone: '',
    manager: '',
    location: '',
    bio: '',
  });
  const [errors, setErrors] = useState({});
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Org data — stored in state so bumping orgTick re-reads from localStorage ─
  const [orgTick, setOrgTick] = useState(0);
  const [orgData, setOrgData] = useState({
    employees: [], levels: [], lines: [], customFields: [],
    fieldValues: [], completeness: null,
  });
  // Admin-override: which org employee to display (empty = auto-detect by email)
  const isAdminOrManager = ['admin', 'company_admin', 'manager'].includes(currentUser?.role);
  const [adminEmpId, setAdminEmpId] = useState(''); // empty = auto

  // Re-read all org data whenever orgTick changes (after inline edits)
  useEffect(() => {
    const employees    = getOrgEmployees();
    const levels       = getHierarchyLevels();
    const lines        = getActiveReportingLines(); // kept for backward compat
    const customFields = getCustomFields().filter(f => f.status === 'active');

    // Determine which org employee to show
    let orgEmp = null;
    if (isAdminOrManager && adminEmpId) {
      orgEmp = employees.find(e => e.id === adminEmpId) || null;
    } else {
      // Match by email (works for demo seed users)
      orgEmp = employees.find(e =>
        e.email?.toLowerCase() === currentUser?.email?.toLowerCase()
      ) || null;
      // Fallback for admin: auto-pick first employee when no email match
      if (!orgEmp && isAdminOrManager && employees.length > 0) {
        orgEmp = employees[0];
        if (!adminEmpId) setAdminEmpId(employees[0].id);
      }
    }

    const fieldValues  = orgEmp ? getCustomFieldValues(orgEmp.id) : [];
    const completeness = orgEmp ? getProfileCompleteness(orgEmp.id) : null;

    setOrgData({ employees, levels, lines, customFields, fieldValues, completeness, orgEmp });
  }, [orgTick, adminEmpId, currentUser?.email, isAdminOrManager]);

  const bumpOrg = useCallback(() => setOrgTick(t => t + 1), []);

  // Load Supabase employee data
  useEffect(() => {
    if (!currentUser) return;
    getEmployeeByUserId(currentUser.id).then(emp => {
      if (emp) {
        setEmployee(emp);
        setForm({
          name:         emp.name         || currentUser?.name  || '',
          email:        emp.email        || currentUser?.email || '',
          employeeCode: emp.employeeId   || '',
          jobTitle:     emp.jobTitle     || '',
          department:   emp.department   || '',
          level:        emp.level        || '',
          organization: emp.organization || '',
          phone:        emp.phone        || '',
          manager:      emp.manager      || '',
          location:     emp.location     || '',
          bio:          emp.bio          || '',
        });
      }
    });
  }, [currentUser?.id]);

  const set = k => e => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setErrors(er => ({ ...er, [k]: '' }));
    setSaved(false);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())         e.name         = 'Required';
    if (!form.jobTitle.trim())     e.jobTitle      = 'Required';
    if (!form.department)          e.department    = 'Required';
    if (!form.organization.trim()) e.organization  = 'Required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSave = async () => {
    if (!validate() || !employee) return;
    setSaving(true);
    await updateEmployee(employee.id, {
      name: form.name, jobTitle: form.jobTitle, department: form.department,
      level: form.level, organization: form.organization, phone: form.phone,
      manager: form.manager, location: form.location, profileComplete: true,
    });
    refresh();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const { employees, levels, lines, customFields, fieldValues, completeness, orgEmp } = orgData;
  const orgLevel = orgEmp ? levels.find(l => l.id === orgEmp.levelId) : null;

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Keep your professional details up to date." />

      {saved && (
        <Alert type="success" className="mb-4">
          <div className="flex items-center gap-2"><CheckCircle size={14} />Profile saved successfully.</div>
        </Alert>
      )}

      {/* Completeness bar */}
      {orgEmp && completeness && completeness.total > 0 && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Org Profile Completeness</span>
          </div>
          <CompletenessBar {...completeness} />
        </div>
      )}

      {/* Admin employee picker */}
      {isAdminOrManager && (
        <OrgEmployeePicker
          employees={employees}
          levels={levels}
          value={adminEmpId}
          onChange={id => { setAdminEmpId(id); }}
        />
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ── Left: avatar card ── */}
        <Card className="p-6 flex flex-col items-center text-center lg:col-span-1 h-fit">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-3"
            style={{
              background: orgLevel
                ? `linear-gradient(135deg, ${orgLevel.colorTag}bb, ${orgLevel.colorTag})`
                : 'linear-gradient(135deg, #818CF8, #4F46E5)',
            }}>
            <span className="text-3xl font-bold text-white">
              {(orgEmp?.name || form.name || '?')[0].toUpperCase()}
            </span>
          </div>

          <h3 className="font-semibold text-gray-800">{orgEmp?.name || form.name || '—'}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{form.jobTitle || '—'}</p>

          {form.department && <Badge variant="primary" className="mt-2">{form.department}</Badge>}

          {/* Org level pill */}
          {orgLevel ? (
            <span className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ background: orgLevel.colorTag }}>
              {orgLevel.abbreviation} — {orgLevel.name}
            </span>
          ) : (
            form.level && <Badge variant="default" className="mt-1">{form.level}</Badge>
          )}

          <div className="mt-4 w-full text-left space-y-1.5 text-xs text-gray-600">
            {(orgEmp?.email || form.email) && (
              <p className="truncate"><span className="font-medium">Email:</span> {orgEmp?.email || form.email}</p>
            )}
            {form.organization && <p><span className="font-medium">Org:</span> {form.organization}</p>}
            {(orgEmp?.city || form.location) && (
              <p><span className="font-medium">City:</span> {orgEmp?.city || form.location}</p>
            )}
            {form.phone && <p><span className="font-medium">Phone:</span> {form.phone}</p>}
            {orgEmp?.region   && <p><span className="font-medium">Region:</span> {orgEmp.region}</p>}
            {orgEmp?.division && <p><span className="font-medium">Division:</span> {orgEmp.division}</p>}
          </div>
        </Card>

        {/* ── Right: form panels ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Existing Supabase panels — unchanged */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <User size={16} className="text-indigo-500" />Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Full Name" value={form.name} onChange={set('name')} error={errors.name} required />
              <Input label="Email Address" type="email" value={form.email} disabled hint="Email cannot be changed" />
              <Input label="Employee Code" placeholder="EMP001" value={form.employeeCode} disabled hint="Auto-assigned" />
              <Input label="Phone" type="tel" placeholder="+1 555 0000" value={form.phone} onChange={set('phone')} />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <User size={16} className="text-indigo-500" />Professional Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Job Title" placeholder="Project Manager" value={form.jobTitle} onChange={set('jobTitle')} error={errors.jobTitle} required />
              <Select label="Department" value={form.department} onChange={set('department')} error={errors.department} required>
                <option value="">Select department</option>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </Select>
              <Input label="Organization" placeholder="Acme Corp" value={form.organization} onChange={set('organization')} error={errors.organization} required />
              <Select label="Level / Grade" value={form.level} onChange={set('level')}>
                <option value="">Select level</option>
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </Select>
              <Input label="Reports To" placeholder="Manager Name" value={form.manager} onChange={set('manager')} />
              <Input label="Office / Location" placeholder="New York" value={form.location} onChange={set('location')} />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Short Bio <span className="text-gray-400 font-normal">(optional)</span>
            </h3>
            <textarea value={form.bio} onChange={set('bio')} rows={3}
              placeholder="Brief professional background…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-indigo-400 focus:ring-indigo-100 bg-white resize-none" />
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} size="lg" disabled={saving}>
              {saving ? 'Saving…' : 'Save Profile'}
            </Button>
          </div>

          {/* ── Org-aware sections — always shown when an orgEmp is resolved ── */}
          {orgEmp ? (
            <>
              {/* Position & Reporting (position-based — runtime derived) */}
              <PositionReportingSection orgEmpId={orgEmp.id} />

              {/* Custom field sections — one collapsible card per FIELD_SECTION */}
              {FIELD_SECTIONS.map(section => {
                // Filter to fields that belong to this section, are active,
                // and apply to this employee's level (empty appliesToLevels = all)
                const sectionFields = customFields.filter(f =>
                  f.section === section &&
                  (f.appliesToLevels?.length === 0 || f.appliesToLevels?.includes(orgEmp.levelId))
                );
                return (
                  <CustomSection
                    key={`${orgEmp.id}-${section}`}
                    section={section}
                    fields={sectionFields}
                    values={fieldValues}
                    orgEmpId={orgEmp.id}
                    isAdminOrManager={isAdminOrManager}
                    onSaved={bumpOrg}
                  />
                );
              })}

              {/* Auto-rule assignment log */}
              <RulesLogSection orgEmpId={orgEmp.id} />
            </>
          ) : (
            /* No matching org employee found for this user */
            <Card className="p-6 text-center text-gray-400 border-dashed border-2">
              <GitBranch size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium text-gray-500">No org employee record linked</p>
              <p className="text-xs text-gray-400 mt-1">
                Ask an admin to add you to the org employee list in{' '}
                <strong>Configuration → Hierarchy Levels</strong>.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
