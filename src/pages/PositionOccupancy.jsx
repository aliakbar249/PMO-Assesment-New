import { useState, useCallback, useRef } from 'react';
import {
  getOccupancies, getActiveOccupancies, saveOccupancy, endDateOccupancy, bulkImportOccupancy,
  getPositions, getActivePositions, getOrgEmployees, getHierarchyLevels, getOrgUnits,
  getCurrentPrimaryOccupant, getOrgEmployeeById, OCCUPANCY_TYPES,
} from '../lib/orgDb';
import { PageHeader, Button } from '../components/UI';
import {
  Plus, X, Check, AlertTriangle, Upload, Search, Edit2, UserCheck, UserX,
} from 'lucide-react';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const bg = type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${bg}`}>
      {type === 'error' ? <AlertTriangle size={15} /> : <Check size={15} />}
      <span>{msg}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

// ─── Occupancy Form Modal ─────────────────────────────────────────────────────
function OccupancyModal({ occupancy, positions, employees, levels, onSave, onClose }) {
  const isEdit = !!occupancy?.id;

  const [form, setForm] = useState({
    positionId:    occupancy?.positionId || '',
    employeeId:    occupancy?.employeeId || '',
    occupancyType: occupancy?.occupancyType || 'primary',
    effectiveFrom: occupancy?.effectiveFrom || new Date().toISOString().split('T')[0],
    effectiveTo:   occupancy?.effectiveTo || '',
    notes:         occupancy?.notes || '',
  });
  const [error, setError] = useState('');
  const [empSearch, setEmpSearch] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const levelById = Object.fromEntries(levels.map(l => [l.id, l]));

  // Show current primary occupant warning
  const selectedPos = positions.find(p => p.id === form.positionId);
  const currentPrimary = form.positionId && form.occupancyType === 'primary'
    ? getCurrentPrimaryOccupant(form.positionId) : null;
  const currentPrimaryEmp = currentPrimary ? employees.find(e => e.id === currentPrimary) : null;

  const filteredEmployees = employees.filter(e =>
    e.status === 'active' && (!empSearch || e.name.toLowerCase().includes(empSearch.toLowerCase()) || e.email.toLowerCase().includes(empSearch.toLowerCase()))
  );

  function submit() {
    if (!form.positionId) { setError('Position is required.'); return; }
    if (!form.employeeId) { setError('Employee is required.'); return; }
    if (!form.effectiveFrom) { setError('Effective from date is required.'); return; }
    onSave({
      ...(isEdit ? { id: occupancy.id } : {}),
      positionId:    form.positionId,
      employeeId:    form.employeeId,
      occupancyType: form.occupancyType,
      effectiveFrom: form.effectiveFrom,
      effectiveTo:   form.effectiveTo || null,
      notes:         form.notes.trim(),
      createdBy:     'admin',
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-800">{isEdit ? 'Edit Occupancy' : 'Assign Employee to Position'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-600 text-xs rounded-lg border border-red-200">{error}</div>}

        {/* Primary-occupant warning */}
        {currentPrimaryEmp && !isEdit && (
          <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>{currentPrimaryEmp.name}</strong> is currently the primary occupant.
              Saving will automatically end-date their occupancy effective <strong>{form.effectiveFrom || 'today'}</strong>.
            </span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Position <span className="text-red-400">*</span></label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
              value={form.positionId} onChange={e => set('positionId', e.target.value)}>
              <option value="">— Select position —</option>
              {positions.filter(p => p.isActive).map(p => {
                const lvl = levelById[p.hierarchyLevelId];
                return <option key={p.id} value={p.id}>{p.positionCode} — {p.title}{lvl ? ` (${lvl.abbreviation})` : ''}</option>;
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Occupancy Type <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-2">
              {OCCUPANCY_TYPES.map(t => (
                <button key={t.value}
                  onClick={() => set('occupancyType', t.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${form.occupancyType === t.value ? t.cls + ' border-current' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee <span className="text-red-400">*</span></label>
            <div className="relative mb-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
                placeholder="Search employees…" value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
            </div>
            <select size={5} className="w-full border border-gray-200 rounded-xl px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
              value={form.employeeId} onChange={e => set('employeeId', e.target.value)}>
              <option value="">— Select employee —</option>
              {filteredEmployees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.email}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Effective From <span className="text-red-400">*</span></label>
              <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
                value={form.effectiveFrom} onChange={e => set('effectiveFrom', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Effective To</label>
              <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
                value={form.effectiveTo} onChange={e => set('effectiveTo', e.target.value)}
                placeholder="Leave blank = current" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
              value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="e.g. Covering for maternity leave" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} className="flex-1 py-2 rounded-xl text-sm font-medium text-white" style={{background:'#01A2B1'}}>
            {isEdit ? 'Save Changes' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Import Modal ────────────────────────────────────────────────────────
function BulkImportModal({ onClose, onImport }) {
  const fileRef = useRef();
  const [preview, setPreview]   = useState(null);
  const [result, setResult]     = useState(null);
  const [dragging, setDragging] = useState(false);

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ''; });
      return row;
    });
  }

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { setPreview(parseCSV(e.target.result).slice(0, 5)); setResult(null); };
    reader.readAsText(file);
  }

  function doImport() {
    if (!fileRef.current?.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => { const rows = parseCSV(e.target.result); setResult(onImport(rows)); };
    reader.readAsText(fileRef.current.files[0]);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">Bulk Import Occupancy</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {!result ? (
          <>
            <p className="text-xs text-gray-500 mb-2">
              CSV columns: <code className="bg-gray-100 px-1 rounded">employee_id, position_code, occupancy_type, effective_from</code>
            </p>
            <p className="text-xs text-gray-400 mb-3">occupancy_type must be one of: primary, acting, dotted-line, functional</p>
            <button className="mb-4 text-xs text-[#01A2B1] hover:underline"
              onClick={() => {
                const csv = 'employee_id,position_code,occupancy_type,effective_from\noemp_tariq,NSM-001,primary,2026-01-01';
                const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'occupancy_template.csv'; a.click();
              }}>
              Download CSV template
            </button>

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-[#01A2B1] bg-[#01A2B1]/5' : 'border-gray-200 hover:border-gray-300'}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); fileRef.current.files = e.dataTransfer.files; }}
              onClick={() => fileRef.current.click()}
            >
              <Upload size={24} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">Drop CSV here or <span className="text-[#01A2B1]">browse</span></p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            </div>

            {preview && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
                <table className="text-xs w-full">
                  <thead className="bg-gray-50">
                    <tr>{Object.keys(preview[0] || {}).map(k => <th key={k} className="px-2 py-1.5 text-left font-medium text-gray-500">{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1.5 text-gray-700">{v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={doImport} disabled={!preview}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40" style={{background:'#01A2B1'}}>
                Import
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <Check size={16} className="text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">{result.created} occupanc{result.created !== 1 ? 'ies' : 'y'} created</span>
              </div>
              {result.failed.length > 0 && (
                <div className="px-4 py-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-sm font-medium text-red-700 mb-2">{result.failed.length} row{result.failed.length !== 1 ? 's' : ''} failed:</p>
                  <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                    {result.failed.map((f, i) => <li key={i}>Row {f.row}: {f.reason}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <button onClick={onClose} className="w-full py-2 rounded-xl text-sm font-medium text-white" style={{background:'#01A2B1'}}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── End-date confirm ─────────────────────────────────────────────────────────
function EndDateConfirm({ occ, posName, empName, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <UserX size={16} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">End Occupancy</h3>
            <p className="text-xs text-gray-500 mt-1">
              End <strong>{empName}</strong>'s occupancy of <strong>{posName}</strong>? This will set the effective-to date to today.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600">End Occupancy</button>
        </div>
      </div>
    </div>
  );
}

// ─── Type badge ───────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const t = OCCUPANCY_TYPES.find(o => o.value === type);
  return t ? (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.cls}`}>{t.label}</span>
  ) : null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PositionOccupancy() {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick(t => t + 1), []);

  const occupancies = getOccupancies();
  const positions   = getPositions();
  const employees   = getOrgEmployees();
  const levels      = getHierarchyLevels();
  const units       = getOrgUnits();

  // ── Filters ──
  const [search, setSearch]       = useState('');
  const [filterPos, setFPos]      = useState('');
  const [filterType, setFType]    = useState('');
  const [showHistory, setHistory] = useState(false);

  // ── Modals ──
  const [modal, setModal]       = useState(null);
  const [endConfirm, setEndConfirm] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast]       = useState({ msg: '', type: 'success' });

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '' }), 3500);
  }

  const posById  = Object.fromEntries(positions.map(p => [p.id, p]));
  const empById  = Object.fromEntries(employees.map(e => [e.id, e]));
  const lvlById  = Object.fromEntries(levels.map(l => [l.id, l]));
  const unitById = Object.fromEntries(units.map(u => [u.id, u]));

  // Filtered
  const filtered = occupancies.filter(o => {
    if (!showHistory && o.effectiveTo) return false;
    if (showHistory  && !o.effectiveTo) return false;
    if (filterPos  && o.positionId !== filterPos) return false;
    if (filterType && o.occupancyType !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      const emp = empById[o.employeeId];
      const pos = posById[o.positionId];
      return (emp?.name.toLowerCase().includes(q)) || (pos?.title.toLowerCase().includes(q)) || (pos?.positionCode.toLowerCase().includes(q));
    }
    return true;
  });

  function handleSave(data) {
    try {
      saveOccupancy(data);
      bump();
      setModal(null);
      showToast(data.id ? 'Occupancy updated.' : 'Employee assigned to position.');
    } catch (e) { showToast(e.message, 'error'); }
  }

  function handleEndDate(occId) {
    try {
      endDateOccupancy(occId);
      bump();
      setEndConfirm(null);
      showToast('Occupancy ended.');
    } catch (e) { showToast(e.message, 'error'); }
  }

  function handleImport(rows) {
    const result = bulkImportOccupancy(rows);
    bump();
    return result;
  }

  // Stats
  const activeOccs = occupancies.filter(o => !o.effectiveTo);
  const primaryCount = activeOccs.filter(o => o.occupancyType === 'primary').length;
  const actingCount  = activeOccs.filter(o => o.occupancyType === 'acting').length;
  const dottedCount  = activeOccs.filter(o => o.occupancyType === 'dotted-line' || o.occupancyType === 'functional').length;

  return (
    <div>
      <PageHeader
        title="Position Occupancy Manager"
        subtitle={`${primaryCount} primary · ${actingCount} acting · ${dottedCount} dotted-line / functional`}
        action={
          <div className="flex gap-2">
            <Button icon={Upload} variant="secondary" onClick={() => setShowImport(true)}>Bulk Import</Button>
            <Button icon={Plus} onClick={() => setModal({ mode: 'add', occupancy: null })}>Assign Employee</Button>
          </div>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <div className="text-2xl font-bold text-gray-800">{activeOccs.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Active Occupancies</div>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 px-4 py-3">
          <div className="text-2xl font-bold text-emerald-600">{primaryCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Primary</div>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 px-4 py-3">
          <div className="text-2xl font-bold text-amber-500">{actingCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Acting</div>
        </div>
        <div className="bg-white rounded-xl border border-purple-100 px-4 py-3">
          <div className="text-2xl font-bold text-purple-500">{dottedCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Dotted / Functional</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[180px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
              placeholder="Search employee or position…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterPos} onChange={e => setFPos(e.target.value)}>
            <option value="">All Positions</option>
            {positions.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.positionCode} — {p.title}</option>)}
          </select>
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterType} onChange={e => setFType(e.target.value)}>
            <option value="">All Types</option>
            {OCCUPANCY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button onClick={() => setHistory(h => !h)}
            className={`px-3 py-2 rounded-xl text-sm border transition-colors ${showHistory ? 'border-[#01A2B1] text-[#01A2B1] bg-[#01A2B1]/5' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {showHistory ? 'History' : 'Active'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Position</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Effective From</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Effective To</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                    <UserCheck size={28} className="mx-auto mb-3 opacity-30" />
                    No occupancy records{showHistory ? ' in history' : ''}. {!showHistory && 'Assign an employee to get started.'}
                  </td>
                </tr>
              ) : filtered.map(occ => {
                const emp = empById[occ.employeeId];
                const pos = posById[occ.positionId];
                const lvl = pos ? lvlById[pos.hierarchyLevelId] : null;
                const unit = pos ? unitById[pos.orgUnitId] : null;

                return (
                  <tr key={occ.id} className={`hover:bg-gray-50/50 transition-colors ${occ.effectiveTo ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:'#01A2B1'}}>
                          {emp?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800 text-sm">{emp?.name || <span className="text-gray-400">Unknown</span>}</div>
                          <div className="text-xs text-gray-400">{emp?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 text-sm">{pos?.title || '—'}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono">{pos?.positionCode}</span>
                        {lvl && <span className="text-xs px-1.5 py-0.5 rounded-full text-white" style={{background: lvl.colorTag || '#6B7280'}}>{lvl.abbreviation}</span>}
                      </div>
                      {unit && <div className="text-xs text-gray-400">{unit.name}</div>}
                    </td>
                    <td className="px-4 py-3"><TypeBadge type={occ.occupancyType} /></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{occ.effectiveFrom}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{occ.effectiveTo || <span className="text-emerald-500 text-xs font-medium">Current</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[150px] truncate">{occ.notes || '—'}</td>
                    <td className="px-4 py-3">
                      {!occ.effectiveTo && (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setModal({ mode: 'edit', occupancy: occ })}
                            className="p-1.5 rounded-lg hover:bg-[#01A2B1]/10 text-gray-400 hover:text-[#01A2B1]">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => setEndConfirm(occ)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                            <UserX size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
          Showing {filtered.length} of {occupancies.length} records
        </div>
      </div>

      {/* Modals */}
      {modal && (
        <OccupancyModal
          occupancy={modal.occupancy}
          positions={positions}
          employees={employees}
          levels={levels}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {endConfirm && (
        <EndDateConfirm
          occ={endConfirm}
          posName={posById[endConfirm.positionId]?.title || endConfirm.positionId}
          empName={empById[endConfirm.employeeId]?.name || endConfirm.employeeId}
          onConfirm={() => handleEndDate(endConfirm.id)}
          onClose={() => setEndConfirm(null)}
        />
      )}
      {showImport && (
        <BulkImportModal onClose={() => { setShowImport(false); bump(); }} onImport={handleImport} />
      )}
      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '' })} />
    </div>
  );
}
