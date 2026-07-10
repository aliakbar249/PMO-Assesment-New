import { useState, useCallback } from 'react';
import {
  getActiveReportingLines, getAllReportingLines, getOrgEmployees,
  getHierarchyLevels, saveReportingLine, endDateReportingLine,
  getReportingLinesByEmployee, RELATIONSHIP_TYPES,
} from '../lib/orgDb';
import { Search, Plus, Edit2, XCircle, AlertTriangle, CheckCircle, X, ChevronDown, ChevronUp, Users } from 'lucide-react';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
      ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Relationship badge ───────────────────────────────────────────────────────
function RelBadge({ type }) {
  const rel = RELATIONSHIP_TYPES[type] || { label: type, cls: 'bg-gray-100 text-gray-700' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rel.cls}`}>{rel.label}</span>;
}

// ─── Searchable employee dropdown ─────────────────────────────────────────────
function EmpSelect({ label, value, onChange, employees, levels, placeholder = 'Search employee…', exclude = [], required }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const selected = employees.find(e => e.id === value);
  const lvlMap = Object.fromEntries(levels.map(l => [l.id, l]));
  const filtered = employees
    .filter(e => !exclude.includes(e.id))
    .filter(e => q === '' || e.name.toLowerCase().includes(q.toLowerCase()) || (lvlMap[e.levelId]?.abbreviation || '').toLowerCase().includes(q.toLowerCase()));

  const handleSelect = (emp) => { onChange(emp.id); setOpen(false); setQ(''); };
  const handleClear  = () => { onChange(''); setQ(''); };

  return (
    <div className="relative">
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>}
      <div
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:border-[#01A2B1] focus-within:border-[#01A2B1] focus-within:ring-1 focus-within:ring-[#01A2B1]/30 bg-white"
        onClick={() => setOpen(o => !o)}
      >
        {selected ? (
          <span className="flex items-center gap-2 flex-1 min-w-0">
            <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">{selected.name[0]}</span>
            <span className="truncate text-gray-800">{selected.name}</span>
            <span className="text-gray-400 text-xs flex-shrink-0">{lvlMap[selected.levelId]?.abbreviation}</span>
          </span>
        ) : (
          <span className="text-gray-400 flex-1">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {selected && <button type="button" onClick={e => { e.stopPropagation(); handleClear(); }} className="text-gray-300 hover:text-red-400"><X size={14} /></button>}
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Type to search…"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#01A2B1]"
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No employees found</p>}
            {filtered.map(emp => (
              <button
                key={emp.id}
                type="button"
                onClick={() => handleSelect(emp)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[#01A2B1]/5 transition-colors
                  ${emp.id === value ? 'bg-[#01A2B1]/10 text-[#01A2B1]' : 'text-gray-700'}`}
              >
                <span className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">{emp.name[0]}</span>
                <span className="flex-1 min-w-0">
                  <span className="font-medium truncate block">{emp.name}</span>
                  <span className="text-xs text-gray-400 truncate block">{lvlMap[emp.levelId]?.name} · {emp.region}</span>
                </span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: lvlMap[emp.levelId]?.colorTag + '22', color: lvlMap[emp.levelId]?.colorTag }}>
                  {lvlMap[emp.levelId]?.abbreviation}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add/Edit Reporting Line Modal ────────────────────────────────────────────
function LineFormModal({ line, employees, levels, onClose, onSaved }) {
  const isEdit = !!line?.id;

  const [form, setForm] = useState({
    employeeId:         line?.employeeId         || '',
    reportsToEmployeeId:line?.reportsToEmployeeId|| '',
    relationshipType:   line?.relationshipType   || 'primary',
    effectiveFrom:      line?.effectiveFrom      || new Date().toISOString().split('T')[0],
  });
  const [errors, setErrors] = useState({});
  const [warn, setWarn]     = useState('');

  const lvlMap = Object.fromEntries(levels.map(l => [l.id, l]));
  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(er => ({ ...er, [k]: '' }));
    setWarn('');
  };

  // Validate hierarchy direction + primary-line warn
  const validate = () => {
    const errs = {};
    if (!form.employeeId)           errs.employeeId = 'Required';
    if (!form.reportsToEmployeeId)  errs.reportsToEmployeeId = 'Required';
    if (!form.effectiveFrom)        errs.effectiveFrom = 'Required';

    if (form.employeeId && form.reportsToEmployeeId) {
      if (form.employeeId === form.reportsToEmployeeId) {
        errs.reportsToEmployeeId = 'An employee cannot report to themselves.';
      } else {
        const empLevel  = lvlMap[empMap[form.employeeId]?.levelId];
        const mgrLevel  = lvlMap[empMap[form.reportsToEmployeeId]?.levelId];
        if (empLevel && mgrLevel && empLevel.rank <= mgrLevel.rank) {
          errs.reportsToEmployeeId = `Hierarchy direction invalid: ${empMap[form.employeeId]?.name} (rank ${empLevel.rank}) cannot report to ${empMap[form.reportsToEmployeeId]?.name} (rank ${mgrLevel.rank}). The manager must have a lower rank number.`;
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Check for existing primary line
  const checkPrimaryWarn = (empId) => {
    if (form.relationshipType !== 'primary' || !empId) return;
    const existing = getReportingLinesByEmployee(empId).filter(r => r.relationshipType === 'primary' && (!isEdit || r.id !== line?.id));
    if (existing.length > 0) {
      const mgr = empMap[existing[0].reportsToEmployeeId];
      setWarn(`${empMap[empId]?.name} already has a primary line to ${mgr?.name || 'another manager'}. Adding a new one will create a duplicate. Consider end-dating the existing line first.`);
    }
  };

  const handleSubmit = () => {
    if (!validate()) return;
    try {
      saveReportingLine(isEdit ? { ...line, ...form } : { ...form, createdBy: 'admin' });
      onSaved(isEdit ? 'Reporting line updated.' : 'Reporting line added.');
    } catch (err) {
      setErrors({ general: err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{isEdit ? 'Edit Reporting Line' : 'Add Reporting Line'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {errors.general && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errors.general}</div>}
          {warn && (
            <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{warn}</span>
            </div>
          )}

          <EmpSelect
            label="Employee (who reports)"
            value={form.employeeId}
            onChange={v => { set('employeeId', v); checkPrimaryWarn(v); }}
            employees={employees}
            levels={levels}
            exclude={form.reportsToEmployeeId ? [form.reportsToEmployeeId] : []}
            required
          />
          {errors.employeeId && <p className="text-xs text-red-500 -mt-2">{errors.employeeId}</p>}

          <EmpSelect
            label="Reports To (manager)"
            value={form.reportsToEmployeeId}
            onChange={v => set('reportsToEmployeeId', v)}
            employees={employees}
            levels={levels}
            exclude={form.employeeId ? [form.employeeId] : []}
            required
          />
          {errors.reportsToEmployeeId && <p className="text-xs text-red-500 -mt-2">{errors.reportsToEmployeeId}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Relationship Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(RELATIONSHIP_TYPES).map(([key, { label, cls }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { set('relationshipType', key); if (key === 'primary') checkPrimaryWarn(form.employeeId); }}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all
                    ${form.relationshipType === key ? 'border-[#01A2B1] bg-[#01A2B1]/10 text-[#01A2B1]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Effective From <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.effectiveFrom}
              onChange={e => set('effectiveFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1] focus:ring-1 focus:ring-[#01A2B1]/20"
            />
            {errors.effectiveFrom && <p className="text-xs text-red-500 mt-1">{errors.effectiveFrom}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: '#01A2B1' }}
          >
            {isEdit ? 'Save Changes' : 'Add Line'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── End-Date Confirm Modal ───────────────────────────────────────────────────
function EndDateConfirm({ line, empMap, onClose, onConfirm }) {
  const emp = empMap[line.employeeId];
  const mgr = empMap[line.reportsToEmployeeId];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><AlertTriangle size={20} className="text-amber-600" /></div>
          <h2 className="text-base font-semibold text-gray-800">End-Date Reporting Line?</h2>
        </div>
        <p className="text-sm text-gray-600 mb-1">
          This will end the <strong>{RELATIONSHIP_TYPES[line.relationshipType]?.label}</strong> reporting line:
        </p>
        <div className="my-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
          <span className="font-medium">{emp?.name}</span> → <span className="font-medium">{mgr?.name}</span>
        </div>
        <p className="text-xs text-gray-500 mb-5">The effective-to date will be set to today. Historical data is preserved.</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium">End-Date Line</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportingLines() {
  const [toast, setToast]         = useState(null);
  const [search, setSearch]       = useState('');
  const [filterType, setFilterType] = useState('');
  const [showEnded, setShowEnded] = useState(false);
  const [formTarget, setFormTarget] = useState(null);  // null | line object | 'new'
  const [endTarget, setEndTarget]   = useState(null);
  const [refresh, setRefresh]       = useState(0);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const bump = () => setRefresh(r => r + 1);

  // Data
  const levels    = getHierarchyLevels();
  const employees = getOrgEmployees();
  const allLines  = getAllReportingLines();
  const lvlMap    = Object.fromEntries(levels.map(l => [l.id, l]));
  const empMap    = Object.fromEntries(employees.map(e => [e.id, e]));

  // Filter
  const lines = allLines
    .filter(r => showEnded ? true : !r.effectiveTo)
    .filter(r => filterType === '' || r.relationshipType === filterType)
    .filter(r => {
      if (!search) return true;
      const emp = empMap[r.employeeId]?.name?.toLowerCase() || '';
      const mgr = empMap[r.reportsToEmployeeId]?.name?.toLowerCase() || '';
      const q   = search.toLowerCase();
      return emp.includes(q) || mgr.includes(q);
    })
    .sort((a, b) => {
      // Active first, then by employee name
      if (!a.effectiveTo && b.effectiveTo) return -1;
      if (a.effectiveTo && !b.effectiveTo) return 1;
      return (empMap[a.employeeId]?.name || '').localeCompare(empMap[b.employeeId]?.name || '');
    });

  const handleEndDate = () => {
    endDateReportingLine(endTarget.id);
    setEndTarget(null);
    showToast('Reporting line ended.');
    bump();
  };

  const handleSaved = (msg) => {
    setFormTarget(null);
    showToast(msg);
    bump();
  };

  // Stats
  const activeCount   = allLines.filter(r => !r.effectiveTo).length;
  const primaryCount  = allLines.filter(r => r.relationshipType === 'primary' && !r.effectiveTo).length;
  const dottedCount   = allLines.filter(r => r.relationshipType === 'dotted-line' && !r.effectiveTo).length;
  const funcCount     = allLines.filter(r => r.relationshipType === 'functional' && !r.effectiveTo).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reporting Lines</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage primary, dotted-line and functional reporting relationships.</p>
        </div>
        <button
          onClick={() => setFormTarget({ id: null })}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: '#01A2B1' }}
        >
          <Plus size={16} /> Add Reporting Line
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Lines', value: activeCount,  color: '#01A2B1' },
          { label: 'Primary',      value: primaryCount, color: '#4F46E5' },
          { label: 'Dotted-Line',  value: dottedCount,  color: '#D97706' },
          { label: 'Functional',   value: funcCount,    color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.color + '18' }}>
              <Users size={16} style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-800">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by employee or manager name…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1] focus:ring-1 focus:ring-[#01A2B1]/20"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-[#01A2B1]"
        >
          <option value="">All Types</option>
          {Object.entries(RELATIONSHIP_TYPES).map(([k, { label }]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
          <input type="checkbox" checked={showEnded} onChange={e => setShowEnded(e.target.checked)} className="rounded" />
          Show ended
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {lines.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No reporting lines found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reports To</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Effective From</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map(r => {
                  const emp = empMap[r.employeeId];
                  const mgr = empMap[r.reportsToEmployeeId];
                  const empLvl = lvlMap[emp?.levelId];
                  const mgrLvl = lvlMap[mgr?.levelId];
                  const isEnded = !!r.effectiveTo;
                  return (
                    <tr key={r.id} className={`hover:bg-gray-50/50 transition-colors ${isEnded ? 'opacity-50' : ''}`}>
                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: (empLvl?.colorTag || '#6B7280') + '22', color: empLvl?.colorTag || '#6B7280' }}>
                            {emp?.name?.[0] || '?'}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{emp?.name || <span className="text-gray-400 italic">Unknown</span>}</div>
                            <div className="text-xs text-gray-400">{empLvl?.name}</div>
                          </div>
                        </div>
                      </td>
                      {/* Reports To */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: (mgrLvl?.colorTag || '#6B7280') + '22', color: mgrLvl?.colorTag || '#6B7280' }}>
                            {mgr?.name?.[0] || '?'}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{mgr?.name || <span className="text-gray-400 italic">Unknown</span>}</div>
                            <div className="text-xs text-gray-400">{mgrLvl?.name}</div>
                          </div>
                        </div>
                      </td>
                      {/* Type */}
                      <td className="px-4 py-3"><RelBadge type={r.relationshipType} /></td>
                      {/* Effective From */}
                      <td className="px-4 py-3 text-gray-600">{r.effectiveFrom || '—'}</td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        {isEnded ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Ended {r.effectiveTo}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            Active
                          </span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!isEnded && (
                            <>
                              <button
                                onClick={() => setFormTarget(r)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-[#01A2B1] hover:bg-[#01A2B1]/10 transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => setEndTarget(r)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                title="End-date this line"
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {formTarget !== null && (
        <LineFormModal
          line={formTarget?.id ? formTarget : null}
          employees={employees}
          levels={levels}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}
      {endTarget && (
        <EndDateConfirm
          line={endTarget}
          empMap={empMap}
          onClose={() => setEndTarget(null)}
          onConfirm={handleEndDate}
        />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
